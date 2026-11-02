// The web-launch rows read agent-written markup, so they must stay linear on
// pathological input: a minified single-line page, an unclosed <script>, a page
// of '<' or '[' with no closer. Ratification round 2 of the write-time carrier
// found quadratic paths here; each case below reproduced one before the fix.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { classifyLoads, legalPagePlaceholders, loadRegister, tagsOf, visibleText, writeTimeFindings } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');
const register = loadRegister(REPO, '2026-11-02');
const table = loadConfig(REPO).supersessions;
const N = 200_000;

// The hook runs inside one hook event, so a scan of the largest file it reads must
// fit that event's p95 ceiling; a quadratic scan of the megabyte cases measured 2,562 ms.
const EVENT_P95_MS: number = (
    JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'hook-latency-budget.json'), 'utf8')) as {
        budgets_ms: { any_hook_event: { p95_ci: number } };
    }
).budgets_ms.any_hook_event.p95_ci;

const loads = (rel: string, body: string): string[] =>
    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-in-markup').map((h) => `${String(h.line)}`);
const unread = (rel: string, body: string): string[] =>
    writeTimeFindings(rel, body, register, table).filter((h) => h.check === 'third-party-load-unread').map((h) => `${String(h.line)}`);

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
            expect(ms).toBeLessThan(EVENT_P95_MS);
        });
    }

    it('visibleText drops an unclosed script to the end, linearly', () => {
        expect(visibleText('<p>a</p><script>x')).toBe('a');
        expect(visibleText('<p>a</p><style>p{} b')).toBe('a');
        expect(visibleText('<p>a</p><style>p{}</style><p>b</p>')).toBe('a b');
        expect(timed(() => visibleText('<script>'.repeat(N / 8)))).toBeLessThan(EVENT_P95_MS);
    });

    it('a minified page still reports its statute citation', () => {
        const page = `<html><body>${'<p>x</p>'.repeat(200)}<p>Angaben gemäß § 5 TMG</p></body></html>`;
        expect(writeTimeFindings('impressum.html', page, register, table).some((h) => h.check === 'superseded-statute-in-legal-page')).toBe(true);
    });
});

describe('tags are found whatever the line layout (round-3 ratification)', () => {

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

    it('an unterminated tag does not hide the next one, and is itself reported as unread', () => {
        const page = `<link rel="stylesheet" href="https://fonts.googleapis.com/a" ${'x'.repeat(5_000)}\n<link rel="stylesheet" href="https://fonts.googleapis.com/b">`;
        expect(loads('index.html', page)).toEqual(['2']);
        expect(unread('index.html', page)).toEqual(['1']);
    });
});

describe('a long tag is read, an unclosed one is never a silent pass (round-5 ratification)', () => {
    it('a closed tag padded far past any window is still read', () => {
        const page = `<link data-pad="${'x'.repeat(5_000)}" rel="stylesheet" href="https://fonts.googleapis.com/a">`;
        expect(loads('index.html', page)).toEqual(['1']);
    });

    it('an inline base64 image before a load does not hide the load', () => {
        const page = `<img src="data:image/png;base64,${'A'.repeat(20_000)}">\n<link rel="stylesheet" href="https://fonts.googleapis.com/a">`;
        expect(loads('index.html', page)).toEqual(['2']);
        expect(unread('index.html', page)).toEqual([]);
    });

    it('a loadable tag with no closer at all is reported once per file, with its count', () => {
        const page = `<p>a</p>\n<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://x.example/a.js"`;
        const hits = writeTimeFindings('index.html', page, register, table).filter((h) => h.check === 'third-party-load-unread');
        expect(hits.map((h) => h.line)).toEqual([2]);
        expect(hits[0]?.text).toMatch(/2 loadable tags/);
    });

    it('the checker counts the same file undecided, never clean', () => {
        const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"';
        const c = classifyLoads([{ rel: 'index.html', base: 'index.html', text: page, lines: [page] }], register);
        expect(c.findings).toEqual([]);
        expect(c.undecided).toHaveLength(1);
    });

    it('an unclosed tag before a closed one leaves the closed one read', () => {
        const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://www.youtube.com/s.js"></script>';
        expect(loads('index.html', page)).toEqual(['2']);
        expect(unread('index.html', page)).toEqual(['1']);
    });

    it('sparse unclosed tags in a megabyte file read the text once, with or without a final closer', () => {
        const gap = 'x'.repeat(99_990);
        const sparse = Array.from({ length: 10 }, () => `<link href=x${gap}`).join('');
        const dense = '<link '.repeat(166_000);
        const shapes: [string, number, number][] = [
            [sparse, 10, 0],
            [`${sparse}>`, 10, 1],
            [`<link href=x${'x'.repeat(999_000)}`, 1, 0],
            [dense, 166_000, 0],
        ];
        for (const [body, count, closed] of shapes) {
            const tags = tagsOf(body);
            expect([tags.length, tags.filter((t) => t.closed).length]).toEqual([count, closed]);
            expect(unread('index.html', body)).toEqual(['1']);
            expect(timed(() => writeTimeFindings('index.html', body, register, table))).toBeLessThan(EVENT_P95_MS);
        }
    });

    it('a page of unclosed link tags yields one hit, linearly', () => {
        const body = '<link rel=stylesheet href=x'.repeat(N / 28);
        expect(timed(() => expect(unread('index.html', body)).toHaveLength(1))).toBeLessThan(EVENT_P95_MS);
    });
});

describe('tagsOf line numbers at the edges (round-9 ratification)', () => {
    const lines = (text: string): number[] => tagsOf(text).map((t) => t.line);

    it('a tag at offset 0 is on line 1', () => {
        expect(lines('<link href=x>')).toEqual([1]);
    });

    it('a tag starting right after the last newline is on the last line, and one at EOF unclosed still counts', () => {
        expect(lines('a\nb\n<script src=x></script>')).toEqual([3]);
        expect(lines('a\nb\n<img')).toEqual([3]);
    });

    it('CRLF and lone-LF line endings number the same lines', () => {
        const lf = '<p>\n<link href=a>\n\n<script src=b></script>\n<img src=c>';
        expect(lines(lf.replace(/\n/g, '\r\n'))).toEqual(lines(lf));
        expect(lines(lf)).toEqual([2, 4, 5]);
    });

    it('every tag of a page with one tag per line lands on its own line, across the binary-search boundaries', () => {
        for (const n of [1, 2, 3, 4, 7, 8, 9, 16, 17, 1_000]) {
            const page = Array.from({ length: n }, (_, i) => `${' '.repeat(i % 3)}<link href=${String(i)}>`).join('\n');
            expect(lines(page), String(n)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        }
    });

    it('blank lines between tags are counted, not skipped', () => {
        expect(lines('\n\n\n<link href=a>\n\n<img src=b>\n')).toEqual([4, 6]);
    });
});

describe('legal-page placeholders: the bounded lookahead (round-9 ratification)', () => {
    // The pre-bound form, kept here only as the reference the bound must agree with.
    const UNBOUNDED = /\[(?=[^\]\d]*[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;
    const imprint = (text: string) => [{ rel: 'impressum.html', base: 'impressum.html', text, lines: text.split('\n') }];
    const tokens = (text: string): string[] => legalPagePlaceholders(imprint(text)).map((h) => /`([^`]*)`/.exec(h.text)?.[1] ?? '');

    it('reports a word slot, never a footnote, a one-letter bracket, or a slot longer than 40', () => {
        expect(tokens('<p>Inhaber: [Firmenname]</p>')).toEqual(['[Firmenname]']);
        expect(tokens('<p>Quelle [1], Anlage [12a]</p>')).toEqual([]);
        expect(tokens('<p>[a]</p>')).toEqual([]);
        expect(tokens(`<p>[${'x'.repeat(41)}]</p>`)).toEqual([]);
        expect(tokens('<p>Lorem ipsum dolor</p>')).toEqual(['Lorem ipsum']);
    });

    it('agrees with the unbounded form on every line of a generated corpus', () => {
        // Deterministic LCG, so a disagreement reproduces.
        let seed = 7;
        const rnd = (): number => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
        const alphabet = ['[', ']', ' ', 'a', 'Z', 'ß', '1', '-', '.'];
        for (let i = 0; i < 5_000; i++) {
            const len = 1 + Math.floor(rnd() * 90);
            const line = Array.from({ length: len }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('');
            const page = `<p>${line}</p>`;
            const want = UNBOUNDED.exec(visibleText(page))?.[0] ?? null;
            const got = tokens(page)[0] ?? null;
            expect(got, JSON.stringify(line)).toBe(want);
        }
    });

    it('a line of open brackets with no letter finishes within one hook event', () => {
        const line = '[ '.repeat(N / 2);
        expect(timed(() => expect(tokens(line)).toEqual([]))).toBeLessThan(EVENT_P95_MS);
    });
});
