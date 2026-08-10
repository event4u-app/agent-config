// Contract tests for the bounded self-fix loop
// (work_engine/directives/backend/_self_fix.ts) and its two lanes.
//
// The loop's whole value claim is that a red check the agent can fix stops
// costing a user round-trip, so the load-bearing assertions are about the SHAPE
// of the halt (does it carry an `@agent-directive:` line?) rather than about
// prose. The load-bearing SAFETY assertion is the inverse: an exhausted or
// non-progressing loop must never reach `SUCCESS`, because a loop that hides a
// failure is worse than the round-trip it removed.
//
// Every fixture is a plain object — no clock, no randomness — so a signature is
// reproducible across runs. The volatile-key case is the exception that proves
// it: `duration_ms` MUST be ignored, or the no-progress floor could never fire.
import { describe, expect, it } from 'vitest';

import {
    SELF_FIX_CEILING,
    VOLATILE_KEYS,
    decide,
    partial_exit,
    record_attempt,
    unmet_dod,
    verdict_signature,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/_self_fix.js';
import { run as test_run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/test.js';
import { diagnose_dod } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/refine.js';
import { run as verify_run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/verify.js';
import {
    DeliveryState,
    Outcome,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { WorkState, Input, type Dict, from_dict, to_dict } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

/** A red `test` lane state, ready to run. */
function red_test_state(extra: Record<string, unknown> = {}): DeliveryState {
    return new DeliveryState({
        ticket: { id: 'SF-1' },
        outcomes: { implement: Outcome.SUCCESS },
        tests: { verdict: 'failed', targeted: '2 failed', ...extra },
    });
}

/** Does this halt surface delegate, or does it ask a human? */
function delegates(questions: string[]): boolean {
    return questions.some((q) => is_agent_directive(q));
}

describe('_self_fix — verdict signature', () => {
    it('is stable across key order — order is not progress', () => {
        const a = verdict_signature('test', { verdict: 'failed', targeted: '2 failed' });
        const b = verdict_signature('test', { targeted: '2 failed', verdict: 'failed' });
        expect(a).toBe(b);
    });

    it('ignores every volatile key at any depth', () => {
        const base = { verdict: 'failed', nested: { targeted: '2 failed' } };
        const first = verdict_signature('test', base);
        for (const key of VOLATILE_KEYS) {
            expect(verdict_signature('test', { ...base, [key]: 1 })).toBe(first);
            expect(verdict_signature('test', { ...base, nested: { targeted: '2 failed', [key]: 2 } })).toBe(first);
        }
    });

    it('separates lanes — the same payload signs differently per lane', () => {
        const payload = { verdict: 'failed' };
        expect(verdict_signature('test', payload)).not.toBe(verdict_signature('verify', payload));
    });

    it('a genuinely different failure signs differently', () => {
        expect(verdict_signature('test', { verdict: 'failed', targeted: '2 failed' })).not.toBe(
            verdict_signature('test', { verdict: 'failed', targeted: '1 failed' }),
        );
    });
});

describe('_self_fix — the two floors', () => {
    it('spends exactly SELF_FIX_CEILING attempts when the signature keeps changing', () => {
        const state = red_test_state();
        for (let i = 0; i < SELF_FIX_CEILING; i += 1) {
            const signature = verdict_signature('test', { verdict: 'failed', round: i });
            const decision = decide(state, 'test', signature);
            expect(decision.kind).toBe('retry');
            expect(decision.next_attempt).toBe(i + 1);
            record_attempt(state, 'test', signature);
        }
        const exhausted = decide(state, 'test', verdict_signature('test', { verdict: 'failed', round: 99 }));
        expect(exhausted.kind).toBe('exhausted');
        expect(exhausted.attempts).toBe(SELF_FIX_CEILING);
    });

    it('stops on the second identical signature even with budget left', () => {
        const state = red_test_state();
        const signature = verdict_signature('test', { verdict: 'failed', targeted: '2 failed' });
        expect(decide(state, 'test', signature).kind).toBe('retry');
        record_attempt(state, 'test', signature);

        const repeated = decide(state, 'test', signature);
        expect(repeated.kind).toBe('no_progress');
        // The point of the floor: budget remained and was deliberately not spent.
        expect(repeated.attempts).toBeLessThan(SELF_FIX_CEILING);
    });

    it('counts per lane — a red verify does not consume the test budget', () => {
        const state = red_test_state();
        record_attempt(state, 'test', 'test:a');
        record_attempt(state, 'test', 'test:b');
        expect(decide(state, 'verify', 'verify:a').attempts).toBe(0);
        expect(decide(state, 'verify', 'verify:a').kind).toBe('retry');
    });

    it('a corrupt counter degrades to zero rather than crashing', () => {
        for (const bad of [-1, 1.5, true, 'three', null]) {
            const state = red_test_state();
            state.self_fix = { test: { attempts: bad, signatures: 'not-a-list' } };
            expect(decide(state, 'test', 'test:x').attempts).toBe(0);
            expect(decide(state, 'test', 'test:x').kind).toBe('retry');
        }
    });
});

describe('_self_fix — unmet_dod', () => {
    it('returns only entries the agent has not recorded as proven', () => {
        const state = new DeliveryState({
            ticket: {
                id: 'SF-2',
                dod: [
                    { id: 'a', check: 'npm test -- a', proven: true },
                    { id: 'b', check: 'npm test -- b' },
                    { id: 'c', check: 'npm test -- c', proven: false },
                ],
            },
        });
        expect(unmet_dod(state).map((d) => d.id)).toEqual(['b', 'c']);
    });

    it('never infers proven — a missing flag is unproven', () => {
        const state = new DeliveryState({ ticket: { id: 'SF-3', dod: [{ id: 'a', check: 'x' }] } });
        expect(unmet_dod(state)).toHaveLength(1);
    });

    it('an absent or non-list dod is empty, not an error', () => {
        expect(unmet_dod(new DeliveryState({ ticket: { id: 'SF-4' } }))).toEqual([]);
        expect(unmet_dod(new DeliveryState({ ticket: { id: 'SF-4', dod: 'nope' } }))).toEqual([]);
    });
});

describe('test lane — the halt shape is the value claim', () => {
    it('a red verdict delegates instead of asking the user', () => {
        const state = red_test_state();
        const result = test_run(state);
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(delegates(result.questions)).toBe(true);
        expect(result.questions[0]).toContain('lane=test');
        expect(result.questions[0]).toContain('attempt=1');
    });

    it('the counter survives on the state so the next dispatch sees it', () => {
        const state = red_test_state();
        test_run(state);
        const lanes = state.self_fix as Record<string, { attempts: number } | undefined>;
        expect(lanes.test?.attempts).toBe(1);
    });

    it('an unchanged verdict across dispatches exits PARTIAL, never SUCCESS', () => {
        const state = red_test_state();
        expect(test_run(state).outcome).toBe(Outcome.BLOCKED);
        const second = test_run(state);
        expect(second.outcome).toBe(Outcome.PARTIAL);
        expect(second.outcome).not.toBe(Outcome.SUCCESS);
    });

    it('the PARTIAL exit still carries the red verdict — no failure is hidden', () => {
        const state = red_test_state();
        test_run(state);
        const exit = test_run(state);
        expect(exit.questions.join('\n')).toContain('STILL `failed`');
        expect(exit.message).toContain('`failed`');
        // Nothing here delegates: the loop is done asking the agent.
        expect(delegates(exit.questions)).toBe(false);
    });

    it('a green verdict never enters the loop', () => {
        const state = new DeliveryState({
            ticket: { id: 'SF-5' },
            outcomes: { implement: Outcome.SUCCESS },
            tests: { verdict: 'success' },
        });
        expect(test_run(state).outcome).toBe(Outcome.SUCCESS);
        expect(state.self_fix).toBeNull();
    });

    it('the PARTIAL exit names the unproven dod items', () => {
        const state = red_test_state();
        state.ticket.dod = [{ id: 'db-index', check: 'npm test -- index' }];
        test_run(state);
        expect(test_run(state).questions.join('\n')).toContain('`db-index`');
    });
});

describe('verify lane — same contract, own counter', () => {
    function red_verify_state(): DeliveryState {
        return new DeliveryState({
            ticket: { id: 'SF-6' },
            outcomes: { implement: Outcome.SUCCESS, test: Outcome.SUCCESS },
            verify: { verdict: 'blocked', findings: 2 },
        });
    }

    it('delegates the first attempt', () => {
        const result = verify_run(red_verify_state());
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions[0]).toContain('lane=verify');
    });

    it('exits PARTIAL on an unchanged verdict and never claims completion', () => {
        const state = red_verify_state();
        verify_run(state);
        const exit = verify_run(state);
        expect(exit.outcome).toBe(Outcome.PARTIAL);
        expect(exit.questions.join('\n')).toContain('STILL `blocked`');
    });
});

describe('partial_exit — the reason is honest about which floor fired', () => {
    it('names the no-progress floor distinctly from the spent budget', () => {
        const shared = { lane: 'test', ticket_id: 'SF-7', verdict: 'failed', unmet: [], rerun_directive: 'run-tests' };
        const no_progress = partial_exit({
            ...shared,
            decision: { kind: 'no_progress', attempts: 1, next_attempt: 2, ceiling: 3, signature: 's' },
        });
        const exhausted = partial_exit({
            ...shared,
            decision: { kind: 'exhausted', attempts: 3, next_attempt: 4, ceiling: 3, signature: 's' },
        });
        expect(no_progress.questions.join('\n')).toContain('identical');
        expect(exhausted.questions.join('\n')).toContain('budget');
        expect(no_progress.questions.join('\n')).not.toContain('budget for');
    });

    it('every exit carries a non-empty surface (the halt-surface audit floor)', () => {
        const exit = partial_exit({
            lane: 'test',
            ticket_id: 'SF-8',
            verdict: 'mixed',
            decision: { kind: 'exhausted', attempts: 3, next_attempt: 4, ceiling: 3, signature: 's' },
            unmet: [],
            rerun_directive: 'run-tests',
        });
        expect(exit.questions.length).toBeGreaterThan(0);
    });
});

describe('refine — the dod[] shape gate', () => {
    it('accepts an absent slot and an empty list', () => {
        expect(diagnose_dod({ id: 'x' })).toEqual([]);
        expect(diagnose_dod({ id: 'x', dod: [] })).toEqual([]);
    });

    it('accepts a well-formed entry', () => {
        expect(diagnose_dod({ dod: [{ id: 'a', check: 'npm test -- a', description: 'why' }] })).toEqual([]);
    });

    it('rejects a non-list slot', () => {
        expect(diagnose_dod({ dod: 'npm test' })[0]).toContain('must be a list');
    });

    it('rejects an entry without a runnable check', () => {
        expect(diagnose_dod({ dod: [{ id: 'a', check: '   ' }] })[0]).toContain('`check`');
        expect(diagnose_dod({ dod: [{ id: 'a' }] })[0]).toContain('`check`');
    });

    it('rejects a missing id and a duplicate id', () => {
        expect(diagnose_dod({ dod: [{ check: 'x' }] })[0]).toContain('`id`');
        const dupes = diagnose_dod({ dod: [{ id: 'a', check: 'x' }, { id: 'a', check: 'y' }] });
        expect(dupes.join(' ')).toContain('repeats id');
    });

    it('rejects a non-boolean proven flag', () => {
        expect(diagnose_dod({ dod: [{ id: 'a', check: 'x', proven: 'yes' }] })[0]).toContain('`proven`');
    });
});

describe('state — self_fix survives the wire round-trip', () => {
    function work(self_fix: Dict | null): WorkState {
        return new WorkState({ input: new Input('ticket', { id: 'SF-9' }), self_fix });
    }

    it('round-trips a populated counter', () => {
        const payload = to_dict(work({ test: { attempts: 2, signatures: ['a', 'b'] } }));
        expect(from_dict(payload).self_fix).toEqual({ test: { attempts: 2, signatures: ['a', 'b'] } });
    });

    it('treats an absent key as null rather than inventing a record', () => {
        const payload = to_dict(work(null));
        expect(payload.self_fix).toBeNull();
        delete payload.self_fix;
        expect(from_dict(payload).self_fix).toBeNull();
    });

    it('rejects a malformed counter at the schema boundary', () => {
        expect(() => to_dict(work({ test: { attempts: -1 } }))).toThrow(/non-negative/u);
        expect(() => to_dict(work({ test: { attempts: 1.5 } }))).toThrow(/non-negative/u);
        expect(() => to_dict(work({ test: { signatures: [1] } }))).toThrow(/strings/u);
        expect(() => to_dict(work({ test: 'nope' } as never))).toThrow(/must be a JSON object/u);
    });

    it('accepts a spent budget rather than crashing on it', () => {
        expect(() => to_dict(work({ test: { attempts: 99, signatures: [] } }))).not.toThrow();
    });
});
