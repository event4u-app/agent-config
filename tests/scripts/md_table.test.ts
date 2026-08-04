// Regression contract for the escaped-pipe defect (R2 round-3 findings 3 + 4).
// Both plan-governance validators split markdown table rows; splitting on every
// `|` shifted every later cell, so the Risk-Register contract's OWN §1.2 example
// row failed validation and a findings row mentioning `text\|json` lost its
// Status and Reason/Ref cells.
import { describe, expect, it } from 'vitest';

import { splitMarkdownRow } from '../../src/scripts/_lib/md_table.js';

describe('splitMarkdownRow', () => {
    it('splits a plain row into trimmed cells', () => {
        expect(splitMarkdownRow('| 1 | a | b |')).toEqual(['1', 'a', 'b']);
    });

    it('keeps an escaped pipe inside its cell and unescapes it', () => {
        // The contract §1.2 example row, verbatim.
        const row = '| 1    | ...  | product \\| implementation | ... | ... | Phase 2 Step 3 |';
        expect(splitMarkdownRow(row)).toEqual([
            '1',
            '...',
            'product | implementation',
            '...',
            '...',
            'Phase 2 Step 3',
        ]);
    });

    it('does not shift later cells when a findings cell contains an escaped pipe', () => {
        const row = '| 1 | high | a.ts:1 | accepts text\\|json flags | fixed | abc1234 |';
        const cells = splitMarkdownRow(row);
        expect(cells).toHaveLength(6);
        expect(cells[3]).toBe('accepts text|json flags');
        expect(cells[4]).toBe('fixed');
        expect(cells[5]).toBe('abc1234');
    });

    it('handles several escaped pipes in one cell', () => {
        expect(splitMarkdownRow('| a\\|b\\|c | d |')).toEqual(['a|b|c', 'd']);
    });

    it('treats a trailing escaped pipe as content, not a delimiter', () => {
        expect(splitMarkdownRow('| a | b\\|')).toEqual(['a', 'b|']);
    });

    it('tolerates a row without the leading delimiter', () => {
        expect(splitMarkdownRow('a | b')).toEqual(['a', 'b']);
    });
});
