/**
 * Second-brain paired-run harness (road-to-second-brain-delta-proof Phase 2).
 * Live calls are spend-bearing and NOT exercised here; the deterministic
 * surfaces (prompt construction, sign test, dry-run wiring) are.
 */
import { describe, expect, it } from 'vitest';

import { loadCorpus } from '../../src/scripts/second_brain_score.js';
import { buildPrompt, run, signTestP } from '../../src/scripts/second_brain_run.js';

describe('signTestP', () => {
    it('all-same-direction is most significant', () => {
        expect(signTestP(9, 0)).toBeCloseTo(2 / 512, 6);
        expect(signTestP(6, 0)).toBeCloseTo(2 / 64, 6);
    });
    it('is symmetric and caps at 1', () => {
        expect(signTestP(3, 3)).toBe(1);
        expect(signTestP(0, 0)).toBe(1);
        expect(signTestP(5, 4)).toBe(signTestP(4, 5));
    });
});

describe('buildPrompt arms', () => {
    const task = loadCorpus()[0]!; // sb-01-api-style: fact = REST/caching
    it('memory-off carries no prior-session block', () => {
        const p = buildPrompt(task, 'memory-off');
        expect(p).toContain(task.session_k1_prompt);
        expect(p).not.toContain('Prior-session memory');
    });
    it('memory-on injects the session-k fact', () => {
        const p = buildPrompt(task, 'memory-on');
        expect(p).toContain(task.session_k);
        expect(p).toContain('Prior-session memory');
    });
    it('placebo is ~equal byte-length to memory-on but omits the fact', () => {
        const on = buildPrompt(task, 'memory-on');
        const placebo = buildPrompt(task, 'placebo');
        // equal-byte isolation: within a few chars of the memory-on length
        expect(Math.abs(placebo.length - on.length)).toBeLessThanOrEqual(2);
        expect(placebo).not.toContain(task.session_k);
    });
});

describe('run --dry-run wiring', () => {
    it('scores the stubbed arms end-to-end with no spend', async () => {
        const report = await run({ mode: 'dry-run', host: 'stub', seeds: 3 });
        expect(report.cost.calls).toBe(0);
        expect(report.aggregate['memory-on'].pass).toBe(report.aggregate['memory-on'].total);
        expect(report.aggregate['memory-off'].pass).toBe(0);
        expect(report.aggregate.placebo.pass).toBe(0);
        expect(report.verdict).toBe('PASS'); // stub is constructed to pass; proves wiring
        expect(report.paired['on-vs-off'].sign_p).toBeLessThan(0.05);
        expect(report.paired['on-vs-placebo'].sign_p).toBeLessThan(0.05);
    });
});
