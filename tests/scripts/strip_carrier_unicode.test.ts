import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripCarrierUnicode } from '../../src/scripts/detect_ai_tells.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(REPO, 'src/skills/humanizer/evals/strip_fixtures.json');

interface Case {
    name: string;
    input: string;
    expect_out: string;
    expect_removed: number;
    expect_preserved: number;
}

const fixture = JSON.parse(fs.readFileSync(FIXTURES, 'utf-8')) as {
    cases: Case[];
    recorded_limitation: Record<string, string | string[]>;
};

describe('stripCarrierUnicode — the six reproduced assertions', () => {
    it('the fixture file carries all six cases', () => {
        // Floor, not decoration: deleting a case is the cheapest route to a
        // green suite, and the emoji/ZWNJ pair is exactly what a careless
        // "simplify onto _sanitize" would break.
        expect(fixture.cases).toHaveLength(6);
    });

    it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
        const r = stripCarrierUnicode(c.input);
        expect(r.out).toBe(c.expect_out);
        expect(r.removed).toBe(c.expect_removed);
        expect(r.preserved).toBe(c.expect_preserved);
    });

    it('AC-1: one input demonstrates removal, preservation and idempotence at once', () => {
        // The acceptance criterion asks for all three properties in ONE
        // fixture, because three separate passing cases do not establish that
        // the predicate discriminates within a single string.
        const mixed = 'the​word 👨‍💻 می‌خواهم safe‮file';
        const first = stripCarrierUnicode(mixed);
        expect(first.removed).toBe(2);
        expect(first.preserved).toBe(2);
        expect(first.out).toContain('👨‍💻');
        expect(first.out).toContain('می‌خواهم');
        expect(first.out).not.toContain('​');
        expect(first.out).not.toContain('‮');

        const second = stripCarrierUnicode(first.out);
        expect(second.out).toBe(first.out);
        expect(second.removed).toBe(0);
    });

    it('every record is accounted for — count equals removed + preserved (1.2)', () => {
        const r = stripCarrierUnicode('a​b 👨‍💻 c‮d');
        expect(r.records).toHaveLength(r.removed + r.preserved);
        for (const rec of r.records) {
            expect(rec.codepoint).toMatch(/^U\+[0-9A-F]{4,6}$/);
            expect(rec.cls).not.toBe('');
            if (rec.disposition === 'preserved') expect(rec.reason).not.toBeNull();
            else expect(rec.reason).toBeNull();
        }
    });

    it('a preserved carrier keeps its offset in codepoints, not UTF-16 units', () => {
        // The emoji before it is a surrogate pair; a UTF-16 index would report
        // a different number and make the audit line wrong for exactly the
        // inputs this function exists to protect.
        const r = stripCarrierUnicode('👨‍💻');
        expect(r.records).toHaveLength(1);
        expect(r.records[0]?.offset).toBe(1);
    });

    it('records the curated-block-set limitation rather than claiming generality', () => {
        // The blocker's option (b), pinned: the fixture must SAY it is a block
        // set. A fixture asserting a general claim it does not test is the
        // failure that blocker names.
        expect(fixture.recorded_limitation.untested).toBeTruthy();
        expect(Array.isArray(fixture.recorded_limitation.tested_blocks)).toBe(true);
    });
});
