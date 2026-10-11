import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { firstSmilLine, smilVerdict } from '../../src/scripts/_lib/svg_motion.js';

/**
 * Step 1.3 of `road-to-svg-with-a-witness` — DQ4 learns the definite case.
 *
 * Observed RED before the change (R10 of that roadmap): an HTML file whose
 * only animation was an infinite `<animate>` returned
 * "✅  lint_design_quality: clean — 1 file(s) checked, no violations." The CSS
 * control — `@keyframes` with no media query — reported `dq4-reduced-motion`
 * the whole time, so the gap was SMIL specifically, not reduced motion.
 *
 * The css-only row is the subtler half (R4): a page-level
 * `svg * { animation: none !important }` under an emulated `reduce` left `cx`
 * moving 20.2 → 76.8 in 700 ms. A file with that declaration passes any check
 * that only asks whether a `prefers-reduced-motion` query exists.
 *
 * The NEGATIVE rows are what keep this honest. A standalone `.svg` must stay
 * out of DQ4 — it cannot see its host's `<picture>` route, and flagging it
 * here would break this linter's zero-false-positive header.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dq4-smil-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function run(name: string, body: string): { code: number; out: string } {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, body);
    // Driven through a child process, the way CI drives it: the linter is a
    // module with a `main()` that reads argv and calls `process.exit`, so
    // importing it into the test would take the test runner down with it.
    const script = path.resolve(__dirname, '../../src/scripts/lint_design_quality.ts');
    try {
        const out = execFileSync('npx', ['tsx', script, '--dir', tmp, '--quiet'], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, out };
    } catch (err) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    } finally {
        fs.rmSync(file, { force: true });
    }
}

const SMIL_NO_ROUTE = `<!doctype html>
<html><body>
<svg viewBox="0 0 200 100" role="img"><title>dot</title>
  <circle cx="20" cy="50" r="10" fill="#333">
    <animate attributeName="cx" from="20" to="180" dur="0.7s" repeatCount="indefinite" />
  </circle>
</svg>
</body></html>
`;

const SMIL_CSS_ONLY = `<!doctype html>
<html><head><style>
@media (prefers-reduced-motion: reduce) {
  svg * { animation: none !important; transition: none !important; }
}
</style></head><body>
<svg viewBox="0 0 200 100" role="img"><title>dot</title>
  <circle cx="20" cy="50" r="10" fill="#333">
    <animate attributeName="cx" from="20" to="180" dur="0.7s" repeatCount="indefinite" />
  </circle>
</svg>
</body></html>
`;

const SMIL_ROUTED = `<!doctype html>
<html><head><style>
@media (prefers-reduced-motion: reduce) {
  #moving { display: none; }
  #still { display: block; }
}
#still { display: none; }
</style></head><body>
<svg viewBox="0 0 200 100" role="img"><title>dot</title>
  <circle id="moving" cx="20" cy="50" r="10" fill="#333">
    <animate attributeName="cx" from="20" to="180" dur="0.7s" repeatCount="indefinite" />
  </circle>
  <circle id="still" cx="100" cy="50" r="10" fill="#333" />
</svg>
</body></html>
`;

describe('inline-smil-without-route-is-reported', () => {
    it('inline-smil-without-route-is-reported', () => {
        // --- the reading itself, which is the part both linters share -------
        expect(smilVerdict(SMIL_NO_ROUTE)).toBe('no-route');
        expect(smilVerdict(SMIL_CSS_ONLY)).toBe('css-only');
        expect(smilVerdict(SMIL_ROUTED)).toBe('routed');
        expect(smilVerdict('<svg><circle cx="1"/></svg>')).toBe('no-smil');
        expect(firstSmilLine(SMIL_NO_ROUTE)).toBe(5);

        // --- end to end through the linter ----------------------------------
        const noRoute = run('smil-only.html', SMIL_NO_ROUTE);
        expect(noRoute.code, noRoute.out).toBe(2);
        expect(noRoute.out).toMatch(/dq4-reduced-motion/);
        expect(noRoute.out).toMatch(/no @media \(prefers-reduced-motion\) route at all/);

        const cssOnly = run('smil-css-only.html', SMIL_CSS_ONLY);
        expect(cssOnly.code, cssOnly.out).toBe(2);
        expect(cssOnly.out).toMatch(/CSS does not reach SMIL/);

        const routed = run('smil-routed.html', SMIL_ROUTED);
        expect(routed.code, routed.out).toBe(0);
    });

    it('standalone-svg-stays-out-of-dq4', () => {
        // DQ4 never walks `.svg` — the extension list has no `svg` entry, and
        // step 1.3 keeps it that way on purpose. A directory of `.svg` alone
        // therefore reaches the scanned-nothing refusal (exit 1), which is the
        // honest answer: it did not check them and must not say clean.
        const dir = fs.mkdtempSync(path.join(tmp, 'svgonly-'));
        fs.writeFileSync(
            path.join(dir, 'spinner.svg'),
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"><title>s</title>` +
                `<circle cx="1" cy="5" r="1"><animate attributeName="cx" from="1" to="9" dur="1s" ` +
                `repeatCount="indefinite"/></circle></svg>`,
        );
        const script = path.resolve(__dirname, '../../src/scripts/lint_design_quality.ts');
        let code = 0;
        let out = '';
        try {
            out = execFileSync('npx', ['tsx', script, '--dir', dir, '--quiet'], {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (err) {
            const e = err as { status?: number; stdout?: string; stderr?: string };
            code = e.status ?? -1;
            out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
        }
        expect(code, out).toBe(1);
        expect(out).not.toMatch(/clean/);
    });
});
