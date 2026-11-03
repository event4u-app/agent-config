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

const timed = (fn: () => unknown): number => {
    const t = performance.now();
    fn();
    return performance.now() - t;
};

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
    const shapes: Record<string, string> = {
        'one brace-free run (a minified page with no CSS)': 'x'.repeat(N),
        'a run ending in an opening brace that never closes': `${'x'.repeat(N - 1)}{`,
        'many small blocks, one per line': 'a{b}\n'.repeat(N / 5),
        'opening braces only': 'a{'.repeat(N / 2),
        'comment openers that never close': '/*'.repeat(N / 2),
    };
    for (const [name, text] of Object.entries(shapes)) {
        it(name, () => {
            expect(timed(() => cssBlocks(text))).toBeLessThan(EVENT_P95_MS);
        });
    }

    it('and still numbers lines on the megabyte', () => {
        const blocks = cssBlocks('a{b}\n'.repeat(N / 5));
        expect([blocks.length, blocks[0]?.line, blocks.at(-1)?.line]).toEqual([N / 5, 1, N / 5]);
    });
});
