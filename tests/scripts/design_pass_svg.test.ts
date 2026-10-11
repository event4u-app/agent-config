import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
    SVG_CATALOG_ID,
    isDesignPassTarget,
    isSvgAsset,
    isUiSurface,
    svgSeverityToPass,
} from '../../src/scripts/hooks/design_pass_hook.js';
import { isUiWrite } from '../../src/scripts/hooks/ui_route_nudge_hook.js';
import { UI_EXTENSIONS, isUiPath } from '../../src/scripts/_lib/ui_surface.js';

/**
 * Step 1.4 of `road-to-svg-with-a-witness` — an `.svg` write gets the SVG
 * rules, and nothing else changes.
 *
 * Two halves of one defect (D9), both observed before the change:
 *
 *   · `components/logo.svg` ALREADY reached the design pass — `isUiTreePath`
 *     is true for it — and was then scanned with `lint_design_slop.scanFile`,
 *     which holds zero SVG rules. It reached the pass and learned nothing.
 *   · `assets/logo.svg` and `public/logo.svg` never reached the pass at all.
 *
 * The pin that matters as much as the fix is the NEGATIVE one. The obvious
 * repair — add `svg` to `UI_EXTENSIONS` — would also have changed
 * `ui_route_nudge_hook`'s `isUiWrite`, because the two read the same
 * predicate, and every icon dropped into `public/` would start drawing a UI
 * routing nudge and its tokens (Risk 4, decision E10). So `isUiWrite` is
 * asserted unchanged in both directions, which is the assertion that would
 * have gone red had the widening been done in `ui_surface.ts`.
 */

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK = path.join(ROOT_DIR, 'src', 'scripts', 'hooks', 'design_pass_hook.ts');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pass-svg-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A throwaway project root with the pass switched on. */
function projectRoot(): string {
    const root = fs.mkdtempSync(path.join(tmp, 'proj-'));
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        'hooks:\n  design_pass:\n    enabled: true\n',
    );
    return root;
}

function runPass(root: string, relFile: string): { code: number; out: string } {
    const payload = JSON.stringify({ tool_input: { file_path: relFile } });
    try {
        const out = execFileSync('npx', ['tsx', HOOK, '--slot', 'post_tool_use'], {
            cwd: root,
            input: payload,
            encoding: 'utf-8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: root },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { code: 0, out };
    } catch (err) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

/** A standalone asset carrying three defects the SVG rules see and slop does not. */
const DEFECTIVE_SVG = `<svg viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="6" fill="url(#nope)" />
</svg>
`;

describe('svg-write-gets-svg-rules-and-no-new-nudge', () => {
    it('svg-write-gets-svg-rules-and-no-new-nudge', () => {
        // --- the predicate split --------------------------------------------
        expect(isSvgAsset('assets/logo.svg')).toBe(true);
        expect(isSvgAsset('components/Logo.tsx')).toBe(false);

        // Both halves of D9 now reach the pass.
        expect(isDesignPassTarget('assets/logo.svg')).toBe(true);
        expect(isDesignPassTarget('public/logo.svg')).toBe(true);
        expect(isDesignPassTarget('components/logo.svg')).toBe(true);
        expect(isDesignPassTarget('components/Logo.tsx')).toBe(true);
        expect(isDesignPassTarget('src/server/queue.ts')).toBe(false);

        // `components/logo.svg` already reached it via the UI-tree fragment —
        // the gap there was the RULE SET, not the trigger.
        expect(isUiSurface('components/logo.svg')).toBe(true);
        expect(isUiSurface('assets/logo.svg')).toBe(false);

        // --- the negative pin: nothing else changed --------------------------
        expect(UI_EXTENSIONS as readonly string[]).not.toContain('svg');
        expect(isUiPath('assets/logo.svg')).toBe(false);
        expect(isUiPath('components/logo.svg')).toBe(false);

        const write = (file: string) => ({ isWrite: true, file }) as Parameters<typeof isUiWrite>[0];
        expect(isUiWrite(write('assets/logo.svg'))).toBe(false);
        expect(isUiWrite(write('public/logo.svg'))).toBe(false);
        expect(isUiWrite(write('components/logo.svg'))).toBe(true);

        // --- the severity map ------------------------------------------------
        // Nothing reaches P0: P0 is the blocking verdict and the SVG family
        // ships advisory (E5).
        expect(svgSeverityToPass('error')).toBe('P1');
        expect(svgSeverityToPass('warning')).toBe('P2');
        expect(svgSeverityToPass('inert')).toBe('P3');
        expect(['P1', 'P2', 'P3']).toContain(svgSeverityToPass('error'));

        // --- end to end, both halves -----------------------------------------
        for (const rel of ['assets/logo.svg', 'components/logo.svg']) {
            const root = projectRoot();
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), DEFECTIVE_SVG);
            const r = runPass(root, rel);
            // `render` prints the catalog id and the MESSAGE, not the rule id,
            // so the assertions read what a consumer actually sees.
            expect(r.out, `${rel}: ${r.out}`).toContain(`[P1 ${SVG_CATALOG_ID}]`);
            expect(r.out).toMatch(/url\(#nope\) points at an id this file does not define/);
            expect(r.out).toMatch(/has no accessible name/);
            expect(r.out).toMatch(/no xmlns/);
            // Advisory: the pass warns, it never refuses.
            expect(r.code, `${rel} exit`).not.toBe(1);
        }
    });

    it('a clean svg produces no findings from this pass', () => {
        const root = projectRoot();
        fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'assets', 'clean.svg'),
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n` +
                `  <title>A filled dot</title>\n` +
                `  <circle cx="12" cy="12" r="6" fill="#1f2933" />\n` +
                `</svg>\n`,
        );
        const r = runPass(root, 'assets/clean.svg');
        // No SVG finding reaches the report. The pass may still speak about the
        // missing render artefact and the missing audit — those are its own
        // pre-existing lines, not an SVG rule firing on a clean file.
        expect(r.out).not.toContain(`[P1 ${SVG_CATALOG_ID}]`);
        expect(r.out).not.toContain(`[P2 ${SVG_CATALOG_ID}]`);
        expect(r.out).not.toContain(`[P3 ${SVG_CATALOG_ID}]`);
    });
});
