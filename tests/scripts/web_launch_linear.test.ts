// The web-launch rows read agent-written markup, so they must stay linear on
// pathological input: a minified single-line page, an unclosed <script>, a page
// of '<' or '[' with no closer. Ratification round 2 of the write-time carrier
// found quadratic paths here; each case below reproduced one before the fix.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { classifyLoads, loadRegister, visibleText, writeTimeFindings } from '../../src/scripts/web_launch_third_party';

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

describe('tags are found whatever the line layout (round-3 ratification)', () => {
    const loads = (rel: string, body: string): string[] =>
        writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-in-markup').map((h) => `${String(h.line)}`);

    it('a <link> wrapped over several lines by a formatter is found, on the line it starts', () => {
        const page = '<head>\n  <link\n    rel="stylesheet"\n    href="https://fonts.googleapis.com/css2?family=Inter"\n  />\n</head>';
        expect(loads('index.html', page)).toEqual(['2']);
    });

    it('a minified single-line page still reports its third-party loads', () => {
        const page = `<html><head>${'<meta name="x" content="y">'.repeat(40)}<link rel="stylesheet" href="https://fonts.googleapis.com/css2"><iframe src="https://www.youtube.com/embed/x"></iframe></head></html>`;
        expect(loads('index.html', page)).toEqual(['1', '1']);
    });

    it('a canonical link wrapped over lines still marks the host as the site itself', () => {
        const page = '<link\n rel="canonical"\n href="https://shop.example/"\n><script src="https://shop.example/app.js"></script>';
        const file = { rel: 'index.html', base: 'index.html', text: page, lines: page.split('\n') };
        const c = classifyLoads([file], register);
        expect([c.findings, c.undecided]).toEqual([[], []]);
        // Without the canonical, the same script is an unknown third party.
        const bare = '<script src="https://shop.example/app.js"></script>';
        expect(classifyLoads([{ ...file, text: bare, lines: [bare] }], register).undecided).toHaveLength(1);
    });

    it('a click-to-load iframe carrying only data-src is not a load', () => {
        const page = '<iframe data-src="https://www.youtube.com/embed/x" title="Video"></iframe>';
        expect(loads('ueber-uns.html', page)).toEqual([]);
    });

    it('an unterminated tag is skipped, never read to the end of the file', () => {
        const page = `<link rel="stylesheet" href="https://fonts.googleapis.com/a" ${'x'.repeat(5_000)}\n<link rel="stylesheet" href="https://fonts.googleapis.com/b">`;
        expect(loads('index.html', page)).toEqual(['2']);
    });
});
