import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    checkRecord,
    isConvergent,
    owesOwnerOptions,
    parseRecord,
} from '../../src/scripts/council_record_shape.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'decision-closure');

function fixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

const F3A = 'F3a-conclusive-technical.md';
const F3B = 'F3b-non-convergent-product.md';

describe('council_record_shape — fixture F3', () => {
    it('F3a: a conclusive technical verdict conforms, and carries no options block', () => {
        const text = fixture(F3A);
        expect(parseRecord(text).hasOptionsBlock).toBe(false);
        expect(checkRecord(F3A, text)).toEqual([]);
    });

    it('F3a: adding an options block to it is a finding', () => {
        // The whole point of AC-3 in one assertion. Without this the fixture
        // would pass for a contract that never changed.
        const v = checkRecord(F3A, fixture(F3A) + '\n## Options\n\n1. Pick one\n2. Pick the other\n');
        expect(v).toHaveLength(1);
        expect(v[0]).toMatch(/routes a technical decision to the owner/);
    });

    it('F3b: a non-convergent product trade-off conforms, and keeps its proposal', () => {
        const text = fixture(F3B);
        expect(parseRecord(text).hasOptionsBlock).toBe(true);
        expect(checkRecord(F3B, text)).toEqual([]);
    });

    it('F3b: removing its options block is a finding', () => {
        const stripped = fixture(F3B).replace(/## Options[\s\S]*?(?=## Revisit if)/, '');
        const v = checkRecord(F3B, stripped);
        expect(v).toHaveLength(1);
        expect(v[0]).toMatch(/carries no owner-facing options block/);
    });

    it('the fixtures read their ownership and convergence from the record', () => {
        expect(parseRecord(fixture(F3A)).ownership).toBe('contested-technical');
        expect(parseRecord(fixture(F3A)).convergent).toBe(true);
        expect(parseRecord(fixture(F3B)).ownership).toBe('product-owned');
        expect(parseRecord(fixture(F3B)).convergent).toBe(false);
    });
});

describe('council_record_shape — convergence is read, not inferred', () => {
    it.each(['2/2', '3/3 unanimous', 'convergent'])('reads %s as conclusive', (line) => {
        expect(isConvergent(line)).toBe(true);
    });

    it.each(['1/2', 'split', '2/3 no quorum', '2/2 but split'])(
        'reads %s as not conclusive',
        (line) => {
            expect(isConvergent(line)).toBe(false);
        },
    );

    it('a record with no convergence line is the finding, not a pass', () => {
        const v = checkRecord('x', '- Ownership: contested-technical\n');
        expect(v.join(' ')).toMatch(/no `Convergence:` line/);
    });
});

describe('council_record_shape — who the block is owed to', () => {
    it.each(['product-owned', 'business-owned', 'destructive-owned'])(
        '%s owes the owner a proposal even when the council converged',
        (ownership) => {
            const shape = parseRecord(`- Ownership: ${ownership}\n- Convergence: 2/2\n`);
            expect(owesOwnerOptions(shape)).toBe(true);
        },
    );

    it.each(['deterministic', 'reversible-technical', 'contested-technical', 'critical-technical'])(
        '%s owes nothing once the council converged',
        (ownership) => {
            const shape = parseRecord(`- Ownership: ${ownership}\n- Convergence: 2/2\n`);
            expect(owesOwnerOptions(shape)).toBe(false);
        },
    );

    it('critical-technical is the discriminating row — hard is not owner-owned', () => {
        const shape = parseRecord('- Ownership: critical-technical\n- Convergence: 2/2\n');
        expect(owesOwnerOptions(shape)).toBe(false);
    });

    it('a non-convergent technical verdict still owes the owner a proposal', () => {
        const shape = parseRecord('- Ownership: contested-technical\n- Convergence: 1/2 split\n');
        expect(owesOwnerOptions(shape)).toBe(true);
    });

    it('emphasis around the label does not hide it', () => {
        expect(parseRecord('- **Ownership:** product-owned\n').ownership).toBe('product-owned');
    });
});
