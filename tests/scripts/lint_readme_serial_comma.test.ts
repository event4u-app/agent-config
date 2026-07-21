// Tests for src/scripts/lint_readme_serial_comma.ts.
//
// Behavioural spec over the exported `collect_hits` — the fixture layer the
// council asked for: strings that MUST fail (serial comma in prose) and the
// carve-outs that MUST NOT fail (code, backticks, tables, comments, URLs,
// two-item lists, the phantom-comma-after-a-masked-span regression).
import { describe, expect, it } from 'vitest';

import { collect_hits } from '../../src/scripts/lint_readme_serial_comma.js';

describe('lint_readme_serial_comma — violations', () => {
    it('flags a serial comma before a final "and"', () => {
        expect(collect_hits('skills, commands, and rules').length).toBe(1);
    });

    it('flags a serial comma before a final "or"', () => {
        expect(collect_hits('one, two, or three').length).toBe(1);
    });

    it('flags a comma before "and" even between two clauses', () => {
        // House style is absolute — no comma directly before and/or.
        expect(collect_hits('build the thing, and ship it').length).toBe(1);
    });

    it('flags every violation on a multi-item line', () => {
        expect(collect_hits('a, b, and c on intent, and more').length).toBe(2);
    });
});

describe('lint_readme_serial_comma — carve-outs (must not flag)', () => {
    it('accepts the fixed style with no serial comma', () => {
        expect(collect_hits('skills, commands and rules')).toEqual([]);
    });

    it('accepts a two-item list', () => {
        expect(collect_hits('model or vendor')).toEqual([]);
    });

    it('ignores a serial comma inside a fenced code block', () => {
        const md = ['```', 'const x = [a, and, b];', '```'].join('\n');
        expect(collect_hits(md)).toEqual([]);
    });

    it('ignores a serial comma inside an inline backtick span', () => {
        expect(collect_hits('run `foo, and bar` now')).toEqual([]);
    });

    it('ignores a serial comma inside an HTML comment', () => {
        expect(collect_hits('text <!-- a, and b --> more')).toEqual([]);
    });

    it('ignores a Markdown table row', () => {
        expect(collect_hits('| a, and b | c |')).toEqual([]);
    });

    it('does not invent a phantom comma when a masked span sits before or/and', () => {
        // Regression: `qa` masked to a space would collapse "(default), `qa` or"
        // into a phantom ", or". The first list comma is legitimate.
        expect(collect_hits('modes: `senior` (default), `qa` or `advisory`')).toEqual([]);
    });
});
