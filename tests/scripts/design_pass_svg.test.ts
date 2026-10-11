import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
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
 * WHAT CHANGED. `isUiSurface` now admits an `.svg` anywhere, so the pass
 * reaches `assets/logo.svg` as well as `components/logo.svg`, and the rules it
 * meets there come from a chunk loaded only for that path.
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
        expect(isUiSurface('assets/logo.svg')).toBe(true);
        expect(isUiSurface('public/logo.svg')).toBe(true);
        expect(isUiSurface('components/logo.svg')).toBe(true);
        expect(isSvgAsset('assets/logo.svg')).toBe(true);
        expect(isSvgAsset('assets/logo.svgx')).toBe(false);

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
