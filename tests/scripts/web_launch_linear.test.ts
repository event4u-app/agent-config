// The web-launch rows read agent-written markup, so they must stay linear on
// pathological input: a minified single-line page, an unclosed <script>, a page
// of '<' or '[' with no closer. Ratification round 2 of the write-time carrier
// found quadratic paths here; each case below reproduced one before the fix.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { loadRegister, visibleText, writeTimeFindings } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');
const register = loadRegister(REPO, '2026-11-02');
const table = loadConfig(REPO).supersessions;
const N = 200_000;

const timed = (fn: () => unknown): number => {
    const t = performance.now();
    fn();
    return performance.now() - t;
};

const CASES: Record<string, string> = {
    'unclosed script tags on one line': '<script>'.repeat(N / 8),
    'opening angle brackets with no closer': '<'.repeat(N),
    'link tags with no closer': '<link rel=stylesheet href=x'.repeat(N / 28),
    'brackets with no closer': '[Firmenname'.repeat(N / 11),
};

describe('linear on pathological input', () => {
    for (const [name, body] of Object.entries(CASES)) {
        it(`${name} (${String(body.length)} chars) finishes fast in an imprint`, () => {
            const ms = timed(() => writeTimeFindings('impressum.html', body, register, table));
            expect(ms).toBeLessThan(1_000);
        });
    }

    it('visibleText drops an unclosed script to the end, linearly', () => {
        expect(visibleText('<p>a</p><script>x')).toBe('a');
        expect(timed(() => visibleText('<script>'.repeat(N / 8)))).toBeLessThan(500);
    });

    it('a minified page still reports its statute citation', () => {
        const page = `<html><body>${'<p>x</p>'.repeat(200)}<p>Angaben gemäß § 5 TMG</p></body></html>`;
        expect(writeTimeFindings('impressum.html', page, register, table).some((h) => h.check === 'superseded-statute-in-legal-page')).toBe(true);
    });
});
