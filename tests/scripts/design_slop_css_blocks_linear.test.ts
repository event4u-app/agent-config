// cssBlocks feeds nine design-slop rules and runs on every dispatched write of an
// .html/.css file. Its first form rescanned the rest of the text from every start
// position of a brace-free run, and counted lines from the top for every block:
// a 100,000-character minified page took 39 s through the hook.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cssBlocks } from '../../src/scripts/design_slop_rules';

const REPO = path.resolve(__dirname, '..', '..');
const EVENT_P95_MS: number = (
    JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'hook-latency-budget.json'), 'utf-8')) as {
        budgets_ms: { any_hook_event: { p95_ci: number } };
    }
).budgets_ms.any_hook_event.p95_ci;

// The removed implementation, verbatim: the reference the new one must equal.
function REMOVED(content: string): Array<{ selector: string; body: string; line: number }> {
    const blocks: Array<{ selector: string; body: string; line: number }> = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    content = content.replace(/\/\*[^]*?\*\//g, (c) => c.replace(/./g, ' '));
    const lineOf = (index: number): number => (content.slice(0, index).match(/\n/g) ?? []).length + 1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        const sel = m[1] ?? '';
        blocks.push({ selector: sel.trim(), body: m[2] ?? '', line: lineOf(m.index + sel.length - sel.trimStart().length) });
    }
    return blocks;
}

// Fastest of `runs`: the sample least disturbed by GC and scheduling, which is what a
// ratio between two sizes needs.
const fastest = (fn: () => unknown, runs: number): number => {
    let best = Infinity;
    for (let i = 0; i < runs; i++) {
        const t = performance.now();
        fn();
        best = Math.min(best, performance.now() - t);
    }
    return best;
};

// Growth from n/8 to n, measured 2026-11-05 on one developer machine: the current
// implementation grows ~8x (11-13x on the allocation-heavy shapes, through GC); the
// removed form grows 62-67x. The bound sits near their geometric mean. It is built to
// catch the quadratic shape this file exists for, not every superlinear one: an n^1.5
// regression grows ~23x and would pass. A full-size run under FLOOR_MS is not timed as
// a ratio — at that size and speed no growth is worth reporting, and the small run
// would be too short to divide by.
const SCALE = 8;
const MAX_GROWTH = 28;
const FLOOR_MS = 5;

function grows(fn: (text: string) => unknown, make: (n: number) => string, n: number, runs = 3): { small: number; big: number; linear: boolean } {
    const smallText = make(n / SCALE);
    const bigText = make(n);
    const small = fastest(() => fn(smallText), runs);
    const big = fastest(() => fn(bigText), runs);
    return { small, big, linear: big < FLOOR_MS || big / Math.max(small, 0.01) < MAX_GROWTH };
}

describe('cssBlocks equals the regex it replaced', () => {
    const files = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(dir, e.name);
            return e.isDirectory() ? files(p) : /\.(html?|css)$/i.test(e.name) ? [p] : [];
        });

    it('on every .html/.css fixture in the tree', () => {
        const all = files(path.join(REPO, 'tests', 'fixtures'));
        expect(all.length).toBeGreaterThanOrEqual(20);
        for (const p of all) {
            const text = fs.readFileSync(p, 'utf-8');
            expect(cssBlocks(text), path.relative(REPO, p)).toEqual(REMOVED(text));
        }
    });

    it('on 5,000 generated strings over the characters the scan branches on', () => {
        let seed = 11;
        const next = (): number => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
        const alphabet = ['{', '}', 'a', ' ', '\n', '/', '*', ':', ';', '\r'];
        for (let k = 0; k < 5_000; k++) {
            const s = Array.from({ length: 1 + Math.floor(next() * 40) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');
            expect(cssBlocks(s), JSON.stringify(s)).toEqual(REMOVED(s));
        }
    });
});

describe('cssBlocks is linear on a megabyte', () => {
    const N = 1_000_000;
    const shapes: Record<string, (n: number) => string> = {
        'one brace-free run (a minified page with no CSS)': (n) => 'x'.repeat(n),
        'a run ending in an opening brace that never closes': (n) => `${'x'.repeat(n - 1)}{`,
        'many small blocks, one per line': (n) => 'a{b}\n'.repeat(n / 5),
        'opening braces only': (n) => 'a{'.repeat(n / 2),
        'comment openers that never close': (n) => '/*'.repeat(n / 2),
    };
    for (const [name, make] of Object.entries(shapes)) {
        it(name, () => {
            const g = grows(cssBlocks, make, N);
            expect(g.linear, `n/${SCALE}: ${g.small.toFixed(1)} ms, n: ${g.big.toFixed(1)} ms`).toBe(true);
            // A backstop against a slowdown that keeps its growth rate. This is NOT the hook
            // budget: a megabyte is no longer held to 250 ms, because a single 1 MB sample
            // on a shared runner measured 253-302 ms with the code unchanged. The budget is
            // held on the realistic page in the next test instead.
            expect(g.big).toBeLessThan(4 * EVENT_P95_MS);
        });
    }

    it('keeps the 100,000-character minified page this file was written for inside the hook budget', () => {
        const page = `<style>${'a{b:c}'.repeat(5_000)}</style>${'x'.repeat(69_985)}`;
        expect(page.length).toBe(100_000);
        expect(fastest(() => cssBlocks(page), 3)).toBeLessThan(EVENT_P95_MS);
    });

    // The removed form was quadratic twice over — the rescan of a brace-free run and the
    // per-block line count — and one shape exercises each. Margins, measured locally: its
    // full-size run takes ~250 ms, 50x above FLOOR_MS, and the whole test ~0.8 s, so a
    // runner 8x slower stays far inside the 60 s timeout.
    it('rejects the removed implementation, so the growth check can stand in for a time bound on a megabyte', () => {
        for (const name of ['one brace-free run (a minified page with no CSS)', 'many small blocks, one per line']) {
            const make = shapes[name] as (n: number) => string;
            expect(grows(REMOVED, make, 24_000).linear, name).toBe(false);
        }
    }, 60_000);

    it('and still numbers lines on the megabyte', () => {
        const blocks = cssBlocks('a{b}\n'.repeat(N / 5));
        expect([blocks.length, blocks[0]?.line, blocks.at(-1)?.line]).toEqual([N / 5, 1, N / 5]);
    });
});
