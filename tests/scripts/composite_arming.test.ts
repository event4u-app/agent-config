/**
 * Tests for Phase A1 of `road-to-per-turn-hook-economy-carry` — making
 * `per_turn_composite.arming_precondition` evaluable at all.
 *
 * The precondition is "at least 10 CI gate readings of the composite, from at
 * least 2 distinct runner sessions". Before this phase the bench printed the
 * composite and stored nothing, so the precondition could not be evaluated in
 * either direction — which is what made step A2.1 (a MAINTAINER ACT) unreachable
 * and, transitively, parked `road-to-mcp-runtime-integrity`.
 *
 * SABOTAGE PROBES, run 2026-08-23 before this file was trusted:
 *   1. count rows instead of distinct sessions → the `12 from 1 session` case
 *      goes green, which is precisely the shape the floor exists to reject;
 *   2. treat a null composite as 0 instead of dropping it → the drop case goes
 *      green and the floor is met by a reading that measured nothing;
 *   3. return a bare boolean with no `failures` → both not-armable cases lose
 *      the clause that failed.
 * Each was applied, observed red, and reverted from a backup copy.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { composeReadingRecord } from '../../src/scripts/bench_hook_latency.js';
import {
    MIN_READINGS,
    MIN_SESSIONS,
    evaluate,
    parseStore,
    renderDistribution,
    selfTest,
} from '../../src/scripts/check_composite_arming.js';

const reading = (ms: number | null, session: string): { composite_ms: number | null; session: string } => ({
    composite_ms: ms,
    session,
});

describe('A1.1 — the reading record carries a session identity, not just a count', () => {
    it('two runs in the same process family are still distinguishable locally', () => {
        // A1.1's verify: "two consecutive gate runs leave two records whose
        // runner identities are distinguishable". Locally that is host + pid.
        const a = composeReadingRecord({ ms: 1000, parts: { pre_tool_use: 10 } }, 10, {});
        expect(String(a['session'])).toMatch(/^local-/);
        expect(String(a['session'])).toContain(String(process.pid));
    });

    it('a CI run keys the session on run id, OS and attempt', () => {
        // The OS half is what makes A1.1's third clause work — "a third run on a
        // different OS leaves a third that the predicate counts as a second
        // session" — without needing a second machine to assert it.
        const ubuntu = composeReadingRecord({ ms: 1000, parts: {} }, 10, {
            GITHUB_RUN_ID: '42', RUNNER_OS: 'Linux', GITHUB_RUN_ATTEMPT: '1',
        });
        const macos = composeReadingRecord({ ms: 1100, parts: {} }, 10, {
            GITHUB_RUN_ID: '42', RUNNER_OS: 'macOS', GITHUB_RUN_ATTEMPT: '1',
        });
        expect(ubuntu['session']).not.toBe(macos['session']);
        expect(evaluate([
            reading(1000, String(ubuntu['session'])),
            reading(1100, String(macos['session'])),
        ]).sessions).toHaveLength(2);
    });

    it('a re-run of the same workflow is a DIFFERENT session', () => {
        // A retry runs on a fresh runner, so it is a genuinely independent
        // reading — counting it as the same session would under-count.
        const a = composeReadingRecord({ ms: 1000, parts: {} }, 10, { GITHUB_RUN_ID: '42', RUNNER_OS: 'Linux', GITHUB_RUN_ATTEMPT: '1' });
        const b = composeReadingRecord({ ms: 1000, parts: {} }, 10, { GITHUB_RUN_ID: '42', RUNNER_OS: 'Linux', GITHUB_RUN_ATTEMPT: '2' });
        expect(a['session']).not.toBe(b['session']);
    });

    it('a null composite is written as null, not skipped', () => {
        // Skipping would make the store's own length a lie about how many runs
        // contributed, and the reader must distinguish "no run" from "a run whose
        // slots were incomplete".
        const r = composeReadingRecord(null, 10, {});
        expect(r['composite_ms']).toBeNull();
        expect(r['parts']).toBeNull();
        expect(r['session']).toBeTruthy();
    });
});

describe('A1.2 — the predicate refuses to guess', () => {
    it('9 readings from 3 sessions is NOT armable, naming the readings clause', () => {
        // A1.2's verify names this exact case.
        const v = evaluate(Array.from({ length: 9 }, (_, i) => reading(1000 + i, `s${String(i % 3)}`)));
        expect(v.armable).toBe(false);
        expect(v.failures).toHaveLength(1);
        expect(v.failures[0]).toMatch(/^readings: 9 usable of 10 required \(short by 1\)/);
    });

    it('12 readings from 1 session is NOT armable, naming the sessions clause', () => {
        // The other half of A1.2's verify, and the one a bare counter gets wrong.
        const v = evaluate(Array.from({ length: 12 }, (_, i) => reading(1000 + i, 'only')));
        expect(v.armable).toBe(false);
        expect(v.failures).toHaveLength(1);
        expect(v.failures[0]).toMatch(/^sessions: 1 distinct of 2 required/);
        // The message must carry WHY, not just the shortfall — the floor exists
        // because the instability it excludes was measured on one machine.
        expect(v.failures[0]).toContain('ONE machine');
    });

    it('both clauses can fail at once, and both are named', () => {
        const v = evaluate([reading(1000, 'a')]);
        expect(v.failures).toHaveLength(2);
    });

    it('10 from 2 is armable — the floor is a floor, not a target', () => {
        expect(evaluate(Array.from({ length: MIN_READINGS }, (_, i) => reading(1000 + i, `s${String(i % MIN_SESSIONS)}`))).armable).toBe(true);
    });

    it('a null composite does not count toward the floor', () => {
        // The direction matters: a composite over a subset reads LOW, and low is
        // the direction that makes a ceiling look met.
        const nine = Array.from({ length: 9 }, (_, i) => reading(1000 + i, `s${String(i % 2)}`));
        const v = evaluate([...nine, reading(null, 'sX')]);
        expect(v.usable).toBe(9);
        expect(v.unusable).toBe(1);
        expect(v.armable).toBe(false);
    });

    it('a null-composite session does not count toward the session floor either', () => {
        const v = evaluate([...Array.from({ length: 10 }, (_, i) => reading(1000 + i, 'one')), reading(null, 'two')]);
        expect(v.sessions).toEqual(['one']);
        expect(v.armable).toBe(false);
    });

    it('parseStore counts malformed lines rather than silently dropping them', () => {
        const { readings, malformed } = parseStore('{"composite_ms":1,"session":"a"}\nnot json\n{"session":"b"}\n');
        expect(readings).toHaveLength(1);
        expect(malformed).toBe(2);
    });
});

describe('A1.3 — publish the distribution, do not choose from it', () => {
    const ok = Array.from({ length: 10 }, (_, i) => reading(1000 + i * 10, `s${String(i % 2)}`));

    it('states its own n and session count', () => {
        const out = renderDistribution(ok, evaluate(ok));
        expect(out).toContain('n = 10 usable reading(s) across 2 session(s)');
    });

    it('writes no p50_ci value — only the sentence saying it does not', () => {
        // A1.3's verify: "no p50_ci value is written by this step". The phrase
        // appears once, in the sentence disclaiming it, and never as an
        // assignment.
        const out = renderDistribution(ok, evaluate(ok));
        expect(out).toContain('writes **no `p50_ci`**');
        expect(out).not.toMatch(/p50_ci"?\s*[:=]\s*\d/);
    });

    it('keeps the pathology net separate from the cap', () => {
        // Step 3 of the recorded arming procedure: one spike should be caught as
        // a pathology rather than by lowering the cap for every run.
        const out = renderDistribution(ok, evaluate(ok));
        expect(out).toContain('pathology net stays separate from the cap');
        expect(out).toContain('absolute');
    });

    it('names the dropped readings rather than averaging them away', () => {
        const withNull = [...ok, reading(null, 'sZ')];
        expect(renderDistribution(withNull, evaluate(withNull))).toContain('DROPPED as unusable');
    });

    it('a not-armable distribution says so, and says the numbers are insufficient', () => {
        const few = [reading(1000, 'a'), reading(1100, 'b')];
        const out = renderDistribution(few, evaluate(few));
        expect(out).toContain('NOT ARMABLE YET');
        expect(out).toContain('informative before it is sufficient');
    });
});

describe('the store round-trips through a real file', () => {
    it('appended records parse back and evaluate', () => {
        const d = mkdtempSync(join(tmpdir(), 'arm-rt-'));
        try {
            const f = join(d, 's.jsonl');
            const rows = [
                composeReadingRecord({ ms: 1200, parts: { pre_tool_use: 50 } }, 10, { GITHUB_RUN_ID: '1', RUNNER_OS: 'Linux' }),
                composeReadingRecord({ ms: 1250, parts: { pre_tool_use: 52 } }, 10, { GITHUB_RUN_ID: '2', RUNNER_OS: 'macOS' }),
            ];
            writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
            const { readings, malformed } = parseStore(readFileSync(f, 'utf-8'));
            expect(malformed).toBe(0);
            expect(evaluate(readings).sessions).toHaveLength(2);
        } finally {
            rmSync(d, { recursive: true, force: true });
        }
    });

    it('self-test passes', () => {
        expect(selfTest()).toBe(0);
    }, 120_000);
});
