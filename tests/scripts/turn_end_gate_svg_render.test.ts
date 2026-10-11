import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openSvgObligation } from '../../src/scripts/hooks/svg_obligation.js';
import { isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';
import { isAssetRenderCommand } from '../../src/scripts/hooks/svg_obligation.js';
import type { ToolCall } from '../../src/scripts/_lib/turn_end_transcript.js';

/**
 * Step 2.1(b) of `road-to-svg-review-followups` — the gate reads the render,
 * never the call.
 *
 * Review claim C2, confirmed against the tree: the transcript path at
 * `turn_end_gate_hook.ts` accepts any Bash segment `isVerificationCommand`
 * matches and never sees an exit code, so teaching it `ui:render` would have
 * discharged an SVG obligation from the command text alone. Both exits are
 * needed, and this file pins the half that lives in the gate.
 */
let root: string;

const SVG_CLEAN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
    '  <title>A square</title>\n' +
    '  <rect x="4" y="4" width="16" height="16" fill="#2563eb"/>\n' +
    '</svg>\n';

const SVG_BROKEN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
    '  <title>Dangling</title>\n' +
    '  <rect width="24" height="24" fill="url(#nowhere)"/>\n' +
    '</svg>\n';

const digestOf = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');

const edit = (p: string): ToolCall => ({ name: 'Write', path: p });
const bash = (command: string): ToolCall => ({ name: 'Bash', command });
const RENDER = bash('agent-config ui:render assets/logo.svg --profile asset');

function writeSvg(relPath: string, content: string): string {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return relPath;
}

/** A manifest under the render directory, exactly as `ui:render` writes one. */
function writeManifest(slug: string, body: Record<string, unknown>): void {
    const dir = path.join(root, 'agents', 'runtime', 'state', 'render', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(body, null, 2)}\n`);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-obligation-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the turn-end gate reads the render, never the call', () => {
    it('bare-asset-render-without-playwright-is-refused', () => {
        // The canonical hole: an `.svg` edit, then the asset render and nothing
        // else. On a machine with no Playwright that call rendered nothing, so
        // there is no manifest describing these bytes.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        const finding = openSvgObligation(root, [edit(file), RENDER]);
        expect(finding).not.toBeNull();
        expect(finding?.evidence).toBe('assets/logo.svg');
        expect(finding?.reason).toContain('no asset manifest matches');

        // And the companion half: the command itself is NOT a verification
        // command, so it cannot discharge anything through the other detector.
        expect(isVerificationCommand('agent-config ui:render assets/logo.svg --profile asset')).toBe(false);
        expect(isVerificationCommand('xmllint --noout assets/logo.svg')).toBe(false);
        // It IS recognised as a render, which is what lets the manifests be read.
        expect(isAssetRenderCommand('agent-config ui:render assets/logo.svg --profile asset')).toBe(true);
        expect(isAssetRenderCommand('agent-config ui:render page.html')).toBe(false);
    });

    it('svg-edit-accepted-on-verified-matching-digest', () => {
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeManifest('logo', {
            profile: 'asset',
            verification: 'verified',
            goal: 'unassessed',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        expect(openSvgObligation(root, [edit(file), RENDER])).toBeNull();

        // The digest is load-bearing. Editing the file after the render
        // reopens the obligation rather than inheriting the old verdict.
        fs.writeFileSync(path.join(root, file), SVG_CLEAN.replace('#2563eb', '#dc2626'));
        expect(openSvgObligation(root, [edit(file), RENDER])).not.toBeNull();
    });

    it('renderer-absent-plus-clean-static-witness-is-static-only', () => {
        // The path that keeps a consumer without Playwright from being refused
        // forever on a gate declared `blocking`.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeManifest('logo', {
            profile: 'asset',
            verification: 'unverified',
            reason: 'renderer-absent',
            goal: 'unassessed',
            static: { errors: 0, digest: digestOf(SVG_CLEAN) },
        });
        expect(openSvgObligation(root, [edit(file), RENDER])).toBeNull();

        // A renderer-absent manifest whose static witness reports an ERROR
        // discharges nothing — the file is broken, not merely unrendered.
        const broken = writeSvg('assets/bad.svg', SVG_BROKEN);
        writeManifest('bad', {
            profile: 'asset',
            verification: 'unverified',
            reason: 'renderer-absent',
            static: { errors: 2, digest: digestOf(SVG_BROKEN) },
        });
        expect(openSvgObligation(root, [edit(broken), RENDER])).not.toBeNull();

        // And a render that RAN and FAILED is not an absent renderer: it is a
        // real failure and discharges nothing, whatever the static layer says.
        const failed = writeSvg('assets/failed.svg', SVG_CLEAN);
        writeManifest('failed', {
            profile: 'asset',
            verification: 'degraded',
            reason: 'render-failed',
            static: { errors: 0, digest: digestOf(SVG_CLEAN) },
        });
        // Same digest as the clean file, so this would discharge if the token
        // were ignored — which is exactly what must not happen.
        fs.rmSync(path.join(root, 'agents/runtime/state/render/logo'), { recursive: true, force: true });
        expect(openSvgObligation(root, [edit(failed), RENDER])).not.toBeNull();
    });

    it('unrelated-check-does-not-discharge-svg-edit', () => {
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        // A real verification command, which satisfies the OTHER detector and
        // must not satisfy this one.
        expect(isVerificationCommand('npx vitest run tests/scripts/foo.test.ts')).toBe(true);
        expect(openSvgObligation(root, [edit(file), bash('npx vitest run tests/scripts/foo.test.ts')])).not.toBeNull();
        expect(openSvgObligation(root, [edit(file), bash('npx eslint src')])).not.toBeNull();

        // Even with a verified manifest present, a turn that never rendered
        // after the edit is refused: precision (iii).
        writeManifest('logo', {
            profile: 'asset',
            verification: 'verified',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        const noRender = openSvgObligation(root, [edit(file), bash('npx vitest run x')]);
        expect(noRender).not.toBeNull();
        expect(noRender?.reason).toContain('no `ui:render --profile asset` ran after the edit');
    });

    it('svg-then-html-edit-keeps-the-svg-obligation', () => {
        // The obligation is about every `.svg` the turn wrote, not about the
        // turn's LAST edit — an `.svg` → `.html` sequence stays covered.
        const svg = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeSvg('site/index.html', '<!doctype html><title>x</title>\n');
        const finding = openSvgObligation(root, [
            edit(svg),
            RENDER,
            edit('site/index.html'),
        ]);
        expect(finding).not.toBeNull();
        expect(finding?.evidence).toBe('assets/logo.svg');
    });

    it('planted-fixture-edit-is-no-svg-obligation', () => {
        // Precision (ii). These files carry errors ON PURPOSE and can never
        // reach `verified`, so without the exemption every turn that creates or
        // edits one would be refused on a blocking gate.
        const planted = writeSvg('tests/design-artifacts/fixtures/svg-assets/bad.svg', SVG_BROKEN);
        expect(openSvgObligation(root, [edit(planted)])).toBeNull();
        const scenario = writeSvg('tests/design-artifacts/scenarios/zoom/control.svg', SVG_BROKEN);
        expect(openSvgObligation(root, [edit(scenario)])).toBeNull();

        // By PATH, not by an inline marker — and the exemption is narrow: a
        // neighbouring test file outside those two prefixes is NOT exempt.
        const elsewhere = writeSvg('tests/fixtures/other/logo.svg', SVG_CLEAN);
        expect(openSvgObligation(root, [edit(elsewhere)])).not.toBeNull();
    });

    it('hand-written-manifest-discharges-nothing', () => {
        // An agent writing a manifest under the render directory, digest
        // included, with no render in the turn. Precision (iii) is the only
        // thing standing between that and a self-discharged obligation.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeManifest('hand-written', {
            profile: 'asset',
            verification: 'verified',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        const finding = openSvgObligation(root, [
            edit(file),
            // The manifest arrived as a Write, not as a render.
            edit('agents/runtime/state/render/hand-written/manifest.json'),
        ]);
        expect(finding).not.toBeNull();
        expect(finding?.reason).toContain('discharges nothing');
    });

    it('deleted-svg-opens-no-obligation', () => {
        // Precision (iv): no current digest, so nothing could be bound to it.
        const finding = openSvgObligation(root, [edit('assets/gone.svg'), RENDER]);
        expect(finding).toBeNull();

        // The file existing is what makes the difference, so the assertion
        // above is about deletion and not about the path shape.
        writeSvg('assets/gone.svg', SVG_CLEAN);
        expect(openSvgObligation(root, [edit('assets/gone.svg'), RENDER])).not.toBeNull();
    });

    it('a turn that touched no .svg is silent', () => {
        // The detector must not fire on the majority of turns — a guard that
        // does is a guard that gets switched off.
        expect(openSvgObligation(root, [edit('src/index.ts'), bash('npx vitest run')])).toBeNull();
        expect(openSvgObligation(root, [])).toBeNull();
    });
});
