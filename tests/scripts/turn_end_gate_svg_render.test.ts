import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openSvgObligation } from '../../src/scripts/hooks/svg_obligation.js';
import { renderNames } from '../../src/scripts/hooks/svg_obligation.js';
import { isVerificationAttempt, isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';
import { detectUnverifiedEdit } from '../../src/scripts/hooks/turn_end_gate_hook.js';
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
        expect(noRender?.reason).toContain("naming this file ran after THIS file's last edit");
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

    it('a planted-fixture prefix reached through `..` is not exempt', () => {
        const file = writeSvg('public/a.svg', SVG_CLEAN);
        const sneaky = 'tests/design-artifacts/fixtures/../../../public/a.svg';
        expect(openSvgObligation(root, [edit(sneaky)])).not.toBeNull();
        expect(file).toBe('public/a.svg');
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
        expect(finding?.reason).toContain('discharge nothing');
    });

    it('a hand-written manifest plus a render naming the file still discharges nothing', () => {
        // 16.5.0 release review: the render only had to NAME the file, so a
        // manifest written by hand — by an edit tool or by a shell redirect —
        // followed by any render naming the file (one that failed, say)
        // cleared a blocking gate. Writing into the render directory by any
        // route other than the render itself now voids the manifests.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeManifest('hand-written', {
            profile: 'asset',
            verification: 'verified',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        const viaTool = openSvgObligation(root, [
            edit(file),
            edit('agents/runtime/state/render/hand-written/manifest.json'),
            RENDER,
        ]);
        expect(viaTool).not.toBeNull();
        expect(viaTool?.reason).toContain('render directory');

        const viaShell = openSvgObligation(root, [
            edit(file),
            bash(`echo '{}' > agents/runtime/state/render/hand-written/manifest.json`),
            RENDER,
        ]);
        expect(viaShell).not.toBeNull();

        // A write sharing one shell call with the render, and a write through a
        // relative path after `cd` (cross-provider review of this fix).
        const sameCall = bash(
            `printf '{}' > agents/runtime/state/render/hand-written/manifest.json; ` +
                'agent-config ui:render assets/logo.svg --profile asset',
        );
        expect(openSvgObligation(root, [edit(file), sameCall])).not.toBeNull();
        const viaCd = bash(`cd agents/runtime/state && printf '{}' > render/hand-written/manifest.json`);
        expect(openSvgObligation(root, [edit(file), viaCd, RENDER])).not.toBeNull();

        // Control: the same manifest with only the render discharges — also when
        // the render's output is piped, and when the manifest is READ afterwards.
        expect(openSvgObligation(root, [edit(file), RENDER])).toBeNull();
        const piped = bash('agent-config ui:render assets/logo.svg --profile asset 2>&1 | tail -5');
        const readBack = bash('cat agents/runtime/state/render/hand-written/manifest.json | jq .verification');
        expect(openSvgObligation(root, [edit(file), piped, readBack])).toBeNull();
        // Every write route the re-cut review named voids the manifests too.
        for (const w of [
            'echo x | tee agents/runtime/state/render/hand-written/manifest.json',
            'cp /tmp/m.json agents/runtime/state/render/hand-written/manifest.json',
            `node -e "require('fs').writeFileSync('agents/runtime/state/render/x/manifest.json','{}')"`,
            `python3 -c "open('render/x/manifest.json','w').write('{}')"`,
            `jq . m.json | sponge agents/runtime/state/render/x/manifest.json`,
            `printf 'open("agents/runtime/state/render/x/manifest.json","w").write("{}")' | python3`,
            `deno eval 'Deno.writeTextFileSync("agents/runtime/state/render/x/manifest.json","{}")'`,
            `node --eval 'require("fs").appendFileSync("agents/runtime/state/render/x/manifest.json","{}")'`,
        ]) {
            expect(openSvgObligation(root, [edit(file), bash(w), RENDER]), w).not.toBeNull();
        }
        const afterCd = bash('cd assets && agent-config ui:render logo.svg --profile asset');
        expect(openSvgObligation(root, [edit(file), afterCd])).toBeNull();
    });

    it('a render of SOME OTHER file discharges nothing', () => {
        // Finding 2 of this change's completion review. `renderObserved` used
        // to be one boolean for the whole turn, so ANY asset render unlocked
        // every manifest on disk: a hand-written manifest plus a decoy render
        // on an unrelated file discharged the obligation — the exact hole the
        // module header claimed to have closed.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        writeSvg('assets/other.svg', SVG_CLEAN.replace('#2563eb', '#16a34a'));
        writeManifest('logo', {
            profile: 'asset',
            verification: 'verified',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        const decoy = bash('agent-config ui:render assets/other.svg --profile asset');
        expect(openSvgObligation(root, [edit(file), decoy])).not.toBeNull();

        // The same manifest, with a render that NAMES the file, discharges.
        expect(
            openSvgObligation(root, [edit(file), bash('agent-config ui:render assets/logo.svg --profile asset')]),
        ).toBeNull();
        // A bare basename after a `cd` counts too, which is the shape a real
        // turn uses and the reason the match is not path-equality.
        expect(openSvgObligation(root, [edit(file), bash('agent-config ui:render logo.svg --profile asset')])).toBeNull();
    });

    it('an absolute path still reaches the planted-fixture exemption', () => {
        // Finding 1, and it was a live gate risk: the exemption matched a
        // forward-slashed path as given, so an ABSOLUTE edit to a
        // deliberately-broken fixture opened an obligation no render could ever
        // discharge — on a gate declared blocking.
        const planted = writeSvg('tests/design-artifacts/fixtures/svg-assets/bad.svg', SVG_BROKEN);
        expect(openSvgObligation(root, [edit(planted)])).toBeNull();
        expect(openSvgObligation(root, [edit(path.join(root, planted))])).toBeNull();

        // And an absolute path OUTSIDE those prefixes is still an obligation,
        // so the exemption did not widen into "absolute paths are exempt".
        const normal = writeSvg('assets/logo.svg', SVG_CLEAN);
        expect(openSvgObligation(root, [edit(path.join(root, normal)), RENDER])).not.toBeNull();
        // Reported repo-relative, which is what `SvgObligation.file` promises.
        expect(openSvgObligation(root, [edit(path.join(root, normal)), RENDER])?.evidence).toBe('assets/logo.svg');
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

describe('what the second review round found by reading, and a run confirmed', () => {
    it('an interleaved turn is not refused for a file it rendered', () => {
        // Finding 2. The render window used to start at the turn's LAST `.svg`
        // edit globally, while the obligation is per file. So the ordinary
        // shape — edit a, render a, edit b, render b — hid render-a behind
        // edit-b and refused a turn in which both files were rendered after
        // their own edits. Verified red against the previous code.
        const a = writeSvg('assets/a.svg', SVG_CLEAN);
        const b = writeSvg('assets/b.svg', SVG_CLEAN.replace('#2563eb', '#16a34a'));
        writeManifest('a', {
            profile: 'asset',
            verification: 'verified',
            goal: 'unassessed',
            asset: { digest: digestOf(SVG_CLEAN) },
        });
        writeManifest('b', {
            profile: 'asset',
            verification: 'verified',
            goal: 'unassessed',
            asset: { digest: digestOf(SVG_CLEAN.replace('#2563eb', '#16a34a')) },
        });
        expect(
            openSvgObligation(root, [
                edit(a),
                bash('agent-config ui:render assets/a.svg --profile asset'),
                edit(b),
                bash('agent-config ui:render assets/b.svg --profile asset'),
            ]),
        ).toBeNull();

        // The window is still a window, and it is per file: re-editing `a`
        // AFTER its render reopens `a` alone. A rule that only widened would
        // have passed the case above by accident.
        expect(
            openSvgObligation(root, [
                edit(a),
                bash('agent-config ui:render assets/a.svg --profile asset'),
                edit(b),
                bash('agent-config ui:render assets/b.svg --profile asset'),
                edit(a),
            ])?.evidence,
        ).toBe('assets/a.svg');
    });

    it('the prescribed render satisfies detector C without discharging the obligation', () => {
        // Finding 3, and it is the exact converse of round one's claim C2 —
        // both are right, about different detectors. Detector C asks whether
        // the author tried; the obligation asks what the render found.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        const calls = [edit(file), RENDER];

        // Tried: detector C is satisfied. Before this it refused the one
        // command this package PRESCRIBES for an `.svg`.
        expect(detectUnverifiedEdit(calls)).toBeNull();
        // Found nothing: the obligation still fires, with its own better reason.
        expect(openSvgObligation(root, calls)?.reason).toContain('no asset manifest matches');

        // And the predicate round one reversed is UNCHANGED — the attempt
        // question has its own name rather than widening the verdict question.
        expect(isVerificationCommand('agent-config ui:render assets/logo.svg --profile asset')).toBe(false);
        expect(isVerificationAttempt('agent-config ui:render assets/logo.svg --profile asset')).toBe(true);
        expect(isVerificationAttempt('npx vitest run tests/x.test.ts')).toBe(true);
        // A page render is not an asset render and satisfies neither.
        expect(isVerificationAttempt('agent-config ui:render page.html')).toBe(false);
    });
});

describe('a render names a file, not a substring of its path', () => {
    it('public/icon.svg does not name n.svg', () => {
        // Finding 3 of the fourth completion review. The path branch was a
        // bare `includes`, so any file whose path is a substring of another
        // file's path was discharged by a render it had nothing to do with —
        // the any-render-unlocks-everything hole this function replaced,
        // reopened one character at a time.
        const r = ['agent-config ui:render public/icon.svg --profile asset'];
        expect(renderNames(r, 'n.svg')).toBe(false);
        expect(renderNames(r, 'on.svg')).toBe(false);
        expect(renderNames(r, 'con.svg')).toBe(false);

        // What must keep working: the path as written, a `./` prefix, and a
        // caller who `cd`-ed first and wrote only the basename.
        expect(renderNames(r, 'public/icon.svg')).toBe(true);
        expect(renderNames(['agent-config ui:render ./public/icon.svg --profile asset'], 'public/icon.svg')).toBe(true);
        expect(renderNames(['agent-config ui:render icon.svg --profile asset'], 'public/icon.svg')).toBe(true);
        // The documented narrower hole is unchanged and still deliberate: a
        // basename collision inside one turn still matches.
        expect(renderNames(r, 'other/icon.svg')).toBe(true);
    });
});

describe('both discharge paths have an error floor', () => {
    it('a verified render whose own reading errs discharges nothing', () => {
        // Finding 2 of the fifth completion review. `verification: 'verified'`
        // is written unconditionally by the render and means a digest-bound
        // render HAPPENED — which is what the skill's status table says and
        // what it should keep meaning. This gate discharged on it without
        // looking at what the render FOUND, while the weaker renderer-absent
        // path refused at a single error. The rigour was inverted: the path
        // that saw more of the file demanded less of it.
        const file = writeSvg('assets/logo.svg', SVG_CLEAN);
        const digest = digestOf(SVG_CLEAN);

        writeManifest('logo', {
            profile: 'asset',
            verification: 'verified',
            goal: 'unassessed',
            asset: { digest, findings: [{ rule: 'geometry/background-bleed-inside-silhouette', detail: 'x', severity: 'error' }] },
        });
        expect(openSvgObligation(root, [edit(file), RENDER])).not.toBeNull();

        // A WARNING is a reading, not a refusal — the same line the static
        // witness draws, now drawn on both paths.
        writeManifest('logo', {
            profile: 'asset',
            verification: 'verified',
            goal: 'unassessed',
            asset: { digest, findings: [{ rule: 'geometry/icon-off-grid', detail: 'x', severity: 'warning' }] },
        });
        expect(openSvgObligation(root, [edit(file), RENDER])).toBeNull();

        // And no findings at all still discharges, which is the ordinary case.
        writeManifest('logo', { profile: 'asset', verification: 'verified', goal: 'unassessed', asset: { digest } });
        expect(openSvgObligation(root, [edit(file), RENDER])).toBeNull();
    });
});
