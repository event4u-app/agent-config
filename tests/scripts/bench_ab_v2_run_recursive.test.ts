// Control-flow tests for run_one_recursive (ADR-106 D₂ recursion arm) in
// src/scripts/bench_ab_v2_run.ts. The model call is mocked via the injectable
// attemptFn seam — NO live spend, NO subprocess, NO filesystem. These assert the
// LOOP control flow only (stop conditions, depth cap, verdict threading); whether
// recursion actually lifts quality is the live `bench:ab` question, not tested here.
import { describe, expect, it } from 'vitest';

import { run_one_recursive, type RecursiveAttempt } from '../../src/scripts/bench_ab_v2_run.js';

type Score = { capability_pass: boolean; discipline_pass: boolean; discipline_score: number; files_changed: never[] };

const mkScore = (cap: boolean, disc: boolean, ds: number): Score => ({
    capability_pass: cap,
    discipline_pass: disc,
    discipline_score: ds,
    files_changed: [],
});

const mkRun = (): Record<string, unknown> => ({ errored: false, transcript: '', num_turns: 1, tokens: 100 });

const opts = (max_depth: number) => ({ model: null, max_budget: null, timeout: 1, placebo_chars: 0, sp_dir: '/tmp', max_depth });

/** Scripted attemptFn: returns scores[depth] (clamped) and logs the verdict it saw. */
function scripted(scores: Score[], log?: Array<{ depth: number; verdict: string | null }>) {
    return (depth: number, priorVerdict: string | null): RecursiveAttempt => {
        log?.push({ depth, verdict: priorVerdict });
        return { run: mkRun(), score: scores[Math.min(depth, scores.length - 1)] as unknown as RecursiveAttempt['score'] };
    };
}

describe('run_one_recursive — loop control flow (ADR-106, mocked seam)', () => {
    it('accepts at depth 0 when the first attempt already passes (no re-attempt)', () => {
        const log: Array<{ depth: number; verdict: string | null }> = [];
        const r = run_one_recursive({} as Record<string, unknown>, opts(1), scripted([mkScore(true, true, 1.0)], log));
        expect(r.stop_reason).toBe('accept');
        expect(r.depth_reached).toBe(0);
        expect(r.capability_pass).toBe(true);
        expect(log).toHaveLength(1); // only the depth-0 attempt ran
        expect(log[0]!.verdict).toBeNull();
    });

    it('re-attempts once then accepts; threads a depth-0 verdict into depth 1', () => {
        const log: Array<{ depth: number; verdict: string | null }> = [];
        const r = run_one_recursive(
            {} as Record<string, unknown>,
            opts(1),
            scripted([mkScore(true, false, 0.5), mkScore(true, true, 1.0)], log),
        );
        expect(r.stop_reason).toBe('accept');
        expect(r.depth_reached).toBe(1);
        expect(log).toHaveLength(2);
        expect(log[1]!.verdict).toContain('depth 0'); // verdict threaded into the re-attempt
    });

    it('stops at max_depth when no attempt passes (hard compute cap)', () => {
        const r = run_one_recursive(
            {} as Record<string, unknown>,
            opts(1),
            scripted([mkScore(false, false, 0.0)]),
        );
        expect(r.stop_reason).toBe('max_depth');
        expect(r.depth_reached).toBe(1);
    });

    it('stops on no-progress when two consecutive attempts score identically', () => {
        const r = run_one_recursive(
            {} as Record<string, unknown>,
            opts(5), // high cap — the no-progress floor must fire first
            scripted([mkScore(false, false, 0.5), mkScore(false, false, 0.5)]),
        );
        expect(r.stop_reason).toBe('no_progress');
        expect(r.depth_reached).toBe(1);
    });

    it('max_depth 0 → single attempt, never re-attempts even if failing', () => {
        const log: Array<{ depth: number; verdict: string | null }> = [];
        const r = run_one_recursive(
            {} as Record<string, unknown>,
            opts(0),
            scripted([mkScore(false, false, 0.0)], log),
        );
        expect(r.stop_reason).toBe('max_depth');
        expect(r.depth_reached).toBe(0);
        expect(log).toHaveLength(1);
    });
});
