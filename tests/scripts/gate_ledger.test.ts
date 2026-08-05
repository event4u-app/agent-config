/**
 * Completeness ledger — the primitive that makes "planned but never judged" loud.
 *
 * The paired negative fixture is the point of this file. `scan_scope` already
 * proves a dead *root* fails; nothing proved that a live root with silently
 * skipped *items* fails, and that is the shape three of this repository's own
 * recorded false greens actually had. A ledger with only a positive fixture
 * cannot be shown to discriminate, so every property below is asserted in both
 * directions.
 */
import { describe, expect, it } from 'vitest';

import {
    GateLedger,
    LedgerUsageError,
    SKIP_REASON_MESSAGE,
    UnaccountedTargetsError,
} from '../../src/scripts/_lib/gate_ledger.js';

function capture(): { write: (chunk: string) => void; text: () => string } {
    const chunks: string[] = [];
    return { write: (chunk: string) => void chunks.push(chunk), text: () => chunks.join('') };
}

describe('GateLedger — terminal accounting', () => {
    it('finalizes when every planned target reached an outcome', () => {
        const ledger = new GateLedger('g');
        ledger.plan(['a.md', 'b.md', 'c.md', 'd.md']);
        ledger.complete('a.md');
        ledger.fail('b.md', 'a finding');
        ledger.skip('c.md', 'size_limit');
        ledger.outOfScope('d.md', 'generated_artifact');

        const tally = ledger.finalize();
        expect(tally).toMatchObject({
            planned: 4,
            completed: 1,
            failed: 1,
            skipped: 1,
            out_of_scope: 1,
            unaccounted: 0,
        });
        expect(tally.skips_by_reason).toEqual({ size_limit: 1, generated_artifact: 1 });
    });

    it('THROWS when one planned target is left unaccounted', () => {
        const ledger = new GateLedger('g');
        ledger.plan(['a.md', 'b.md']);
        ledger.complete('a.md');

        expect(() => ledger.finalize()).toThrow(UnaccountedTargetsError);
    });

    it('names every unaccounted target in the error, so the gap is diagnosable', () => {
        const ledger = new GateLedger('lint_example');
        ledger.plan(['kept.md', 'dropped-one.md', 'dropped-two.md']);
        ledger.complete('kept.md');

        let caught: unknown;
        try {
            ledger.finalize();
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(UnaccountedTargetsError);
        const err = caught as UnaccountedTargetsError;
        expect(err.gate).toBe('lint_example');
        expect(err.targets).toEqual(['dropped-one.md', 'dropped-two.md']);
        expect(err.message).toContain('dropped-one.md');
        expect(err.message).toContain('dropped-two.md');
        expect(err.message).not.toContain('kept.md');
    });

    it('truncates a very long unaccounted list but reports the true total', () => {
        const ledger = new GateLedger('g');
        const targets = Array.from({ length: 25 }, (_, i) => `f${String(i)}.md`);
        ledger.plan(targets);

        let caught: UnaccountedTargetsError | undefined;
        try {
            ledger.finalize();
        } catch (e) {
            caught = e as UnaccountedTargetsError;
        }
        expect(caught?.targets).toHaveLength(25);
        expect(caught?.message).toContain('25 planned target(s)');
        expect(caught?.message).toContain('and 5 more');
    });

    it('accepts an empty plan — zero planned is zero unaccounted', () => {
        const ledger = new GateLedger('g');
        expect(ledger.finalize().planned).toBe(0);
    });

    it('reports the unaccounted set without finalizing, for diagnostics', () => {
        const ledger = new GateLedger('g');
        ledger.plan(['a', 'b']);
        ledger.skip('a', 'binary_content');
        expect(ledger.unaccountedTargets()).toEqual(['b']);
    });
});

describe('GateLedger — usage errors are failures, not warnings', () => {
    it('rejects an outcome for a target that was never planned', () => {
        const ledger = new GateLedger('g');
        expect(() => ledger.complete('never-planned.md')).toThrow(LedgerUsageError);
    });

    it('rejects a second terminal outcome for the same target', () => {
        const ledger = new GateLedger('g');
        ledger.plan('a.md');
        ledger.complete('a.md');
        expect(() => ledger.fail('a.md', 'x')).toThrow(LedgerUsageError);
    });

    it('rejects planning the same target twice', () => {
        const ledger = new GateLedger('g');
        ledger.plan('a.md');
        expect(() => ledger.plan('a.md')).toThrow(LedgerUsageError);
    });
});

describe('GateLedger.report — the denominator on the green path', () => {
    it('prints scanned, planned, and skipped counts', () => {
        const out = capture();
        const ledger = new GateLedger('lint_example');
        ledger.plan(['a', 'b', 'c']);
        ledger.complete('a');
        ledger.fail('b', 'finding');
        ledger.skip('c', 'excluded_directory');

        ledger.report(out.write);
        expect(out.text()).toContain('lint_example ledger: scanned=2 planned=3 skipped=1');
    });

    it('prints one explanatory line per skip code, with its count', () => {
        const out = capture();
        const ledger = new GateLedger('g');
        ledger.plan(['a', 'b', 'c']);
        ledger.skip('a', 'size_limit');
        ledger.skip('b', 'size_limit');
        ledger.outOfScope('c', 'generated_artifact');

        ledger.report(out.write);
        expect(out.text()).toContain(`size_limit ×2 — ${SKIP_REASON_MESSAGE.size_limit}`);
        expect(out.text()).toContain(`generated_artifact ×1 — ${SKIP_REASON_MESSAGE.generated_artifact}`);
    });

    it('WRITES NOTHING when the ledger is incomplete — no green line over unaccounted work', () => {
        const out = capture();
        const ledger = new GateLedger('g');
        ledger.plan(['a', 'b']);
        ledger.complete('a');

        expect(() => ledger.report(out.write)).toThrow(UnaccountedTargetsError);
        expect(out.text()).toBe('');
    });
});

describe('the skip vocabulary is closed and fully described', () => {
    it('carries a non-empty sentence for every code', () => {
        for (const [code, message] of Object.entries(SKIP_REASON_MESSAGE)) {
            expect(message.trim(), `skip reason ${code} has no message`).not.toBe('');
        }
    });

    it('has no message for a code outside the union', () => {
        expect(Object.keys(SKIP_REASON_MESSAGE)).not.toContain('whatever');
    });
});
