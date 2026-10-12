import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    auditIsFresh,
    isPassSurface,
    isSvgAsset,
    isUiSurface,
    svgFindings,
    svgSeverity,
    type SvgRuleFinding,
} from '../../src/scripts/hooks/design_pass_hook.js';
import { isUiWrite } from '../../src/scripts/hooks/ui_route_nudge_hook.js';
import { UI_EXTENSIONS, isUiPath } from '../../src/scripts/_lib/ui_surface.js';
import { scanSvg } from '../../src/scripts/_lib/svg_rules.js';
import {
    CHUNK_BASENAME,
    loadSvgScan,
    loadSvgScanUncached,
    rulesSpecifier,
} from '../../src/scripts/hooks/svg_rules_loader.js';

/**
 * Step 1.4 of `road-to-svg-with-a-witness` was withdrawn and carried into
 * `road-to-svg-rules-in-the-dispatch-path`. This file pinned the deferral; it
 * now pins the step that closed it, and the half it must still never do.
 *
 * WHAT MUST NEVER CHANGE. `UI_EXTENSIONS` must NOT gain `svg`. That was the
 * obvious way to make the design pass see an `.svg`, and it would also have
 * changed `ui_route_nudge_hook`'s `isUiWrite`, because the two read the same
 * predicate — so every icon dropped into `public/` would start drawing a UI
 * routing nudge and its tokens, on every asset write in the tree (decision
 * E10, Risk 4; carried as D3 in the follow-up roadmap). The routing reaches
 * the asset through a LOCAL disjunct in `design_pass_hook` instead.
 *
 * WHAT CHANGED. A SECOND predicate, `isPassSurface`, admits an `.svg`
 * anywhere, so the pass reaches `assets/logo.svg` as well as
 * `components/logo.svg`, and the rules it meets there come from a chunk loaded
 * only for that path.
 *
 * Finding 6 of this change's completion review: the disjunct was first added
 * to `isUiSurface` itself, which is also the predicate every UI-only reading
 * downstream asks — so an `.svg` in `assets/` started reading as a UI surface
 * for those too. The entry gate and the UI question are now two names, and
 * this file pins BOTH, because a widened predicate is invisible to a test that
 * only ever asks the widened one.
 */
describe('step 1.4, closed — the routing, and the predicate it must not widen', () => {
    it('UI_EXTENSIONS does not carry svg, in either direction', () => {
        expect(UI_EXTENSIONS as readonly string[]).not.toContain('svg');
        expect(isUiPath('assets/logo.svg')).toBe(false);
        expect(isUiPath('components/logo.svg')).toBe(false);

        const write = (file: string) => ({ isWrite: true, file }) as Parameters<typeof isUiWrite>[0];
        expect(isUiWrite(write('assets/logo.svg'))).toBe(false);
        expect(isUiWrite(write('public/logo.svg'))).toBe(false);
        // Unchanged for the UI-tree case, which is what "unchanged" has to mean
        // in both directions — a predicate pinned only on the false side can be
        // satisfied by breaking it.
        expect(isUiWrite(write('components/logo.svg'))).toBe(true);
        expect(isUiWrite(write('components/Logo.tsx'))).toBe(true);
    });

    it('svg-write-gets-svg-rules-and-no-new-nudge', () => {
        // The pass reaches an `.svg` inside AND outside a UI tree — the gap the
        // withdrawn step left open. `public/` is the case decision E10 names.
        expect(isPassSurface('assets/logo.svg')).toBe(true);
        expect(isPassSurface('public/logo.svg')).toBe(true);
        expect(isPassSurface('components/logo.svg')).toBe(true);
        expect(isSvgAsset('assets/logo.svg')).toBe(true);
        expect(isSvgAsset('assets/logo.svgx')).toBe(false);

        // And `isUiSurface` is NOT what was widened: an `.svg` outside a UI
        // tree is not a UI surface, which is what every downstream UI-only
        // reading asks. Pinned on the false side, because that is the side a
        // re-widening would break.
        expect(isUiSurface('assets/logo.svg')).toBe(false);
        expect(isUiSurface('public/logo.svg')).toBe(false);
        expect(isUiSurface('components/logo.svg')).toBe(true);
        expect(isUiSurface('components/Logo.tsx')).toBe(true);

        // And the nudge predicate is untouched for exactly those paths.
        const write = (file: string) => ({ isWrite: true, file }) as Parameters<typeof isUiWrite>[0];
        expect(isUiWrite(write('assets/logo.svg'))).toBe(false);
        expect(isUiWrite(write('public/logo.svg'))).toBe(false);

        // What it meets there is the rule set, not `lint_design_slop` alone.
        const defective = `<svg viewBox="0 0 24 24">\n  <circle cx="12" cy="12" r="6" fill="url(#nope)" />\n</svg>\n`;
        const mapped = svgFindings(scanSvg(defective, 'assets/logo.svg') as SvgRuleFinding[], 'assets/logo.svg');
        expect(mapped.map((f) => f.rule)).toContain('svg-structure-dangling-reference');
        expect(mapped.map((f) => f.rule)).toContain('svg-a11y-no-accessible-name');
        expect(mapped.every((f) => f.catalogId === 'SVG')).toBe(true);
        // Never P0: the P0 set is the closed list of objective floors and it is
        // the only thing that computes a block at stop.
        expect(mapped.some((f) => f.severity === 'P0')).toBe(false);
        expect(svgSeverity('error')).toBe('P1');
        expect(svgSeverity('warning')).toBe('P2');
        expect(svgSeverity('inert')).toBeNull();
    });

    it('rule-failure-does-not-reach-an-unrelated-event', () => {
        // (a) A chunk that throws on load, or is absent, yields null — never a
        //     throw escaping into a process that handles every hook event.
        //
        // A fresh directory per case, deliberately: `require` caches by
        // RESOLVED PATH, so rewriting one chunk file in place would serve the
        // first module to every later case and the test would pass by
        // accident. (Measured here, not assumed — the first draft did exactly
        // that and reported `null` for a chunk that exports `scanSvg`.)
        const made: string[] = [];
        const withChunk = (body: string | null): string => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-chunk-'));
            made.push(dir);
            fs.writeFileSync(path.join(dir, 'dispatch.js'), '// stand-in for the dispatch bundle\n');
            if (body !== null) fs.writeFileSync(path.join(dir, CHUNK_BASENAME), body);
            return `file://${path.join(dir, 'dispatch.js')}`;
        };

        // Absent chunk — a consumer install that did not pack the sibling.
        expect(loadSvgScanUncached(withChunk(null), true)).toBeNull();

        // Present chunk that throws at module scope.
        const throwing = withChunk('throw new Error("boom");\n');
        expect(() => loadSvgScanUncached(throwing, true)).not.toThrow();
        expect(loadSvgScanUncached(throwing, true)).toBeNull();

        // Present chunk with no `scanSvg` export — also null, not a crash.
        expect(loadSvgScanUncached(withChunk('module.exports = { nope: 1 };\n'), true)).toBeNull();

        // A real chunk resolves, so "null" is not simply what this always says.
        const real = withChunk('module.exports = { scanSvg: () => [] };\n');
        expect(typeof loadSvgScanUncached(real, true)).toBe('function');

        // A chunk whose bytes no longer match its sidecar is not executed —
        // the same integrity posture `dispatch.js` has (16.5.0 release review).
        // A matching sidecar loads, and so does a chunk with no sidecar at all,
        // which is `unverifiable` and allowed exactly as for the main bundle.
        const body = 'module.exports = { scanSvg: () => [] };\n';
        const sha = createHash('sha256').update(body).digest('hex');
        const sidecarOf = (url: string) => path.join(path.dirname(new URL(url).pathname), `${CHUNK_BASENAME}.sha256`);
        const tampered = withChunk(body);
        fs.writeFileSync(sidecarOf(tampered), `${'0'.repeat(64)}  ${CHUNK_BASENAME}\n`);
        expect(loadSvgScanUncached(tampered, true)).toBeNull();
        const matching = withChunk(body);
        fs.writeFileSync(sidecarOf(matching), `${sha}  ${CHUNK_BASENAME}\n`);
        expect(typeof loadSvgScanUncached(matching, true)).toBe('function');
        for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });

        // (b) An event whose target is not an `.svg` never reaches the loader at
        //     all, because the pass asks the predicate first. Pinned on the
        //     predicate rather than on a spy: the call site is guarded by
        //     exactly this expression.
        expect(isSvgAsset('components/Logo.tsx')).toBe(false);
        expect(isSvgAsset('src/index.ts')).toBe(false);
        expect(isSvgAsset('README.md')).toBe(false);

        // (c) A rule that loops or throws is confined to the file it was called
        //     for: `svgFindings` is pure and takes already-computed findings,
        //     so no unrelated target shares state with it.
        expect(svgFindings([], 'assets/a.svg')).toEqual([]);
    });

    it('the chunk specifier points beside the bundle, and at the source otherwise', () => {
        const bundled = rulesSpecifier('file:///repo/dist/hooks/dispatch.js', true);
        expect(bundled).toBe(path.join('/repo', 'dist', 'hooks', CHUNK_BASENAME));

        const fromSource = rulesSpecifier('file:///repo/src/scripts/hooks/svg_rules_loader.ts', false);
        expect(fromSource).toBe(path.join('/repo', 'src', 'scripts', '_lib', 'svg_rules.ts'));

        const fromJs = rulesSpecifier('file:///repo/src/scripts/hooks/svg_rules_loader.js', false);
        expect(fromJs).toBe(path.join('/repo', 'src', 'scripts', '_lib', 'svg_rules.js'));
    });

    it('the rules the step routes to are shipped and work', () => {
        const defective = `<svg viewBox="0 0 24 24">\n  <circle cx="12" cy="12" r="6" fill="url(#nope)" />\n</svg>\n`;
        const rules = scanSvg(defective, 'assets/logo.svg', { delivery: 'inline' }).map((f) => f.rule);
        expect(rules).toContain('svg-structure-dangling-reference');
        expect(rules).toContain('svg-a11y-no-accessible-name');
        expect(rules).toContain('svg-structure-missing-xmlns');
    });
});

describe('the audit question is asked of UI surfaces, never of an asset', () => {
    it('an .svg has no component inventory to be audited against', () => {
        // Findings 1 and 2 of the third completion review, both reproduced by
        // running the hook. Round one split the ENTRY gate from the UI
        // predicate; `targets` then carried the `.svg` past the split into
        // `auditMissing`, so a clean conformant icon write exited WARN with
        // "no ui-audit.json newer than public/icon.svg".
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-surface-'));
        try {
            const audit = path.join(root, 'agents', 'runtime', 'state', 'ui-audit.json');
            fs.mkdirSync(path.dirname(audit), { recursive: true });
            fs.writeFileSync(audit, '{}');
            const icon = path.join(root, 'public', 'icon.svg');
            fs.mkdirSync(path.dirname(icon), { recursive: true });
            fs.writeFileSync(icon, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
            // The audit file is OLDER than the icon, which is the state the
            // WARN came from. The predicate, not the freshness, is the fix.
            fs.utimesSync(audit, new Date(0), new Date(0));
            expect(auditIsFresh(root, 'public/icon.svg')).toBe(false);

            // So the filter has to drop it before the freshness test runs.
            const targets = ['public/icon.svg', 'components/Logo.tsx'];
            expect(targets.filter((t) => isUiSurface(t))).toEqual(['components/Logo.tsx']);
            // And the pass still REACHES the asset — the entry gate is the
            // other predicate, which is the distinction round one introduced
            // and this one had to finish applying.
            expect(targets.filter((t) => isPassSurface(t))).toEqual(targets);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('the loader cache is keyed by what it was asked', () => {
    it('a second url is not answered by the first one\'s verdict', () => {
        // Finding 13 of the third completion review. A single slot meant the
        // first call's verdict answered every later call whatever url it
        // passed, so the parameter was accepted and ignored — the shape this
        // change's own review found three times under other names.
        //
        // One caller and one url on the hook path, so nothing observable
        // changed. A cache whose key is not its input is wrong regardless of
        // who currently calls it, and this pins it before a second caller
        // arrives rather than after.
        // A url that RESOLVES: the source-tree layout the loader computes,
        // `<dir>/../_lib/svg_rules.js`, built in a temp tree.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-key-'));
        try {
            fs.mkdirSync(path.join(dir, 'hooks'));
            fs.mkdirSync(path.join(dir, '_lib'));
            fs.writeFileSync(
                path.join(dir, '_lib', 'svg_rules.js'),
                'module.exports = { scanSvg: () => [] };\n',
            );
            const good = pathToFileURL(path.join(dir, 'hooks', 'loader.js')).href;
            const bad = pathToFileURL(path.join(os.tmpdir(), 'no-such-dir-at-all', 'loader.js')).href;

            // Ask the BAD one first, so a single-slot cache would answer the
            // good one with `null` — which is the direction that actually
            // broke, and the order the old code passed under by accident if
            // the good one happened to be asked first.
            expect(loadSvgScan(bad)).toBeNull();
            expect(typeof loadSvgScan(good)).toBe('function');
            // Both stay themselves on a second ask.
            expect(loadSvgScan(bad)).toBeNull();
            expect(typeof loadSvgScan(good)).toBe('function');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
