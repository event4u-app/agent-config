// road-to-a-cold-start-paid-once 3.5 and 3.6: the shadow window as a report,
// and the activation policy's four flip conditions as code that never flips early.
import { describe, expect, it } from 'vitest';

import { flipReadiness, summariseShadowWindow, type ShadowLine } from '../../src/scripts/worker_reuse_shadow_report.js';

const DAY = 86_400_000;
function spawn(tsMs: number, reuse: ShadowLine['reuse']): ShadowLine {
    return { event: 'spawn_guard_shadow', ts: new Date(tsMs).toISOString(), tool: 'Agent', dispatch_kind: 'spawn', reuse };
}
const T0 = Date.parse('2026-10-22T00:00:00.000Z');

describe('worker reuse shadow window', () => {
    it('counts would-resume names and refusal reasons over the reuse-bearing lines only', () => {
        const lines: ShadowLine[] = [
            spawn(T0, { verdict: 'would_resume', name: 'w1', reasons: [] }),
            spawn(T0 + 1000, { verdict: 'fresh', name: null, reasons: ['ttl_expired', 'compacted'] }),
            spawn(T0 + 2000, { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] }),
            { event: 'spawn_guard_shadow', ts: new Date(T0 + 3000).toISOString(), tool: 'SendMessage', dispatch_kind: 'resume' },
            { event: 'subagent_start', ts: new Date(T0).toISOString() } as ShadowLine,
        ];
        const w = summariseShadowWindow(lines);
        expect(w.agent_calls).toBe(3);
        expect(w.would_resume).toBe(1);
        expect(w.would_resume_by_name).toEqual({ w1: 1 });
        expect(w.refusal_reasons).toEqual({ compacted: 1, host_resume_unobserved: 1, ttl_expired: 1 });
        expect(w.resumes_observed).toBe(1);
    });

    it('a window in which every reuse was refused is a valid null, not an error', () => {
        const w = summariseShadowWindow([spawn(T0, { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] })]);
        expect(w.would_resume).toBe(0);
        expect(w.null_window).toBe(true);
    });
});

describe('flip readiness — all four conditions, or shadow', () => {
    const big = Array.from({ length: 120 }, (_, i) => spawn(T0 + i * 1000, { verdict: i % 10 === 0 ? 'would_resume' : 'fresh', name: i % 10 === 0 ? 'w' : null, reasons: i % 10 === 0 ? [] : ['ttl_expired'] }));

    it('stays shadow while false positives and economics are unmeasured, whatever the window', () => {
        const r = flipReadiness(summariseShadowWindow(big), { false_positive_rate: null, cost_avoided: null, friction: null });
        expect(r.ready).toBe(false);
        expect(r.missing).toEqual(['false_positive_rate_measured', 'economics_measured']);
    });

    it('flips only when all four hold', () => {
        const r = flipReadiness(summariseShadowWindow(big), { false_positive_rate: 0.005, cost_avoided: 100, friction: 10 });
        expect(r.ready).toBe(true);
        expect(r.missing).toEqual([]);
    });

    it('a short window or no observed failure keeps it in shadow', () => {
        const short = flipReadiness(summariseShadowWindow(big.slice(0, 20)), { false_positive_rate: 0, cost_avoided: 100, friction: 1 });
        expect(short.missing).toContain('window_met');
        const twoWeeks = [spawn(T0, { verdict: 'fresh', name: null, reasons: ['ttl_expired'] }), spawn(T0 + 15 * DAY, { verdict: 'fresh', name: null, reasons: ['ttl_expired'] })];
        const noFailure = flipReadiness(summariseShadowWindow(twoWeeks), { false_positive_rate: 0, cost_avoided: 1, friction: 0 });
        expect(noFailure.missing).toEqual(['failure_observed']);
    });
});
