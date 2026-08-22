// Tests for src/scripts/ai_council/orchestrator.ts (py2ts Phase 1, ADR-094).
//
// orchestrator coordinates a sequential multi-member council run: member
// dispatch, cost gating + overrun callback, multi-round debate, peer-review,
// consensus scoring, and the Markdown render assembly. It is a pure library
// (no __main__ / argparse / stdout) — so there is no `--help` surface to
// byte-compare. Parity is asserted on the assembled `render()` output and the
// orchestration control flow with STUBBED transport.
//
// Transport stub: tests subclass `ExternalAIClient` (TS) / build duck-typed
// mock objects (Python) whose `ask()` returns a canned `CouncilResponse`
// without any live network call — mirroring how clients.ts seams the
// transport. `latency_ms` is the only non-deterministic field; the mocks pin
// it to a fixed value so render output is byte-stable.
//
// Golden parity drives the LIVE Python twin via a `python3 -c` importlib
// direct-file load. The networked ai_council `__init__` re-exports clients,
// but loading orchestrator.py off disk only pulls the sibling submodules,
// which lazy-import their SDKs inside `ask()` — so no network at import time.
import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import type {
    OverrunEvent} from '../../../src/scripts/ai_council/orchestrator.js';
import {
    consult,
    CostBudget,
    CouncilQuestion,
    DebateCapExceeded,
    estimate,
    estimate_debate_cost,
    render,
    run_consensus_scoring,
    run_debate,
    run_peer_review,
} from '../../../src/scripts/ai_council/orchestrator.js';
import { load_prices, type CostEstimate } from '../../../src/scripts/ai_council/pricing.js';
import { ANTI_CONFORMITY_DIRECTIVE } from '../../../src/scripts/ai_council/prompts.js';
import { EMPTY_HANDOFF } from '../../../src/scripts/ai_council/handoff.js';

// Records the user_prompt each round so a test can observe what reached a member.
class CapturingMock extends ExternalAIClient {
    prompts: string[] = [];
    private roundIdx = 0;
    constructor(
        name: string,
        model: string,
        private readonly replies: string[],
    ) {
        super();
        this.name = name;
        this.model = model;
        this.billable = false;
        this.transport = 'manual';
    }
    override ask(_system_prompt: string, user_prompt: string): CouncilResponse {
        this.prompts.push(user_prompt);
        const text = this.replies[Math.min(this.roundIdx, this.replies.length - 1)] ?? 'reply';
        this.roundIdx += 1;
        return new CouncilResponse({ provider: this.name, model: this.model, text, latency_ms: 1 });
    }
}

// ── TS mock transport (mirrors the Python Mock) ──────────────────────────

interface MockArgs {
    text?: string;
    error?: string | null;
    it?: number;
    ot?: number;
    billable?: boolean;
    transport?: string;
    sub?: string;
    raises?: boolean;
    latency?: number;
}

class Mock extends ExternalAIClient {
    private readonly _t: string;
    private readonly _e: string | null;
    private readonly _it: number;
    private readonly _ot: number;
    private readonly _raises: boolean;
    private readonly _lat: number;

    constructor(name: string, model: string, args: MockArgs = {}) {
        super();
        this.name = name;
        this.model = model;
        this._t = args.text ?? '';
        this._e = args.error ?? null;
        this._it = args.it ?? 10;
        this._ot = args.ot ?? 20;
        this.billable = args.billable ?? true;
        this.transport = args.transport ?? 'api';
        this.subscription_label = args.sub ?? '';
        this._raises = args.raises ?? false;
        this._lat = args.latency ?? 5;
    }

    override ask(): CouncilResponse {
        if (this._raises) {
            throw new Error('boom');
        }
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: this._t,
            error: this._e,
            input_tokens: this._it,
            output_tokens: this._ot,
            latency_ms: this._lat,
        });
    }
}

// ── Unit tests — orchestration control flow ──────────────────────────────

describe('orchestrator — consult basics', () => {
    it('empty members → []', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        expect(consult([], q)).toEqual([]);
    });

    it('dispatches members in input order, accumulates tokens', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'hello' });
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', { text: 'A' }),
            new Mock('openai', 'gpt-4o', { text: 'B' }),
        ];
        const res = consult(members, q);
        expect(res.map((r) => [r.provider, r.model, r.text])).toEqual([
            ['anthropic', 'claude-sonnet-4-5', 'A'],
            ['openai', 'gpt-4o', 'B'],
        ]);
    });

    it('member exception → error-tagged response, never raises', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        const res = consult([new Mock('anthropic', 'claude-sonnet-4-5', { raises: true })], q);
        expect(res[0]!.error).toBe('Error: boom');
        expect(res[0]!.text).toBe('');
    });

    it('rounds < 1 raises', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        expect(() => consult([new Mock('a', 'm')], q, null, { rounds: 0 })).toThrow(
            /rounds must be >= 1/,
        );
    });

    it('too many members for budget.max_calls raises', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        const members = [new Mock('a', 'm1'), new Mock('b', 'm2')];
        const budget = new CostBudget({ max_calls: 1 });
        expect(() => consult(members, q, budget)).toThrow(/budget caps at 1 calls/);
    });
});

// ── mid-flight cli→api fallback (transport_resolver.MidFlightFallback,
//    consumed here for the first time — ai-council-config.md § failure-
//    class-gated) ──────────────────────────────────────────────────────────

describe('orchestrator — mid-flight cli→api fallback', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
    const cliSeat = (error: string): Mock =>
        new Mock('anthropic', 'claude-sonnet-4-6', { error, transport: 'cli', billable: true });
    const apiTwin = (): Mock => new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' });

    it('an eligible cli failure is retried on the api twin; the twin response replaces the seat', () => {
        const constructed: string[] = [];
        const res = consult([cliSeat('auth_expired')], q, null, {
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return apiTwin();
                },
            },
        });
        expect(constructed).toEqual(['anthropic']);
        expect(res).toHaveLength(1); // index alignment: still one response per member
        expect(res[0]!.error).toBeNull();
        expect(res[0]!.text).toBe('via api');
        expect(res[0]!.metadata['fallback_from']).toBe('cli');
        expect(res[0]!.metadata['fallback_reason']).toBe('auth_rejected');
        expect(res[0]!.metadata['fallback_original_error']).toBe('auth_expired');
        // The stamp reflects the member that ANSWERED, not the one that failed.
        expect(res[0]!.metadata['transport']).toBe('api');
    });

    it('quota exhaustion does NOT retry without the opt-in — the cap surfaces unchanged', () => {
        const constructed: string[] = [];
        const res = consult([cliSeat('cli_quota_exhausted')], q, null, {
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return apiTwin();
                },
            },
        });
        expect(constructed).toEqual([]);
        expect(res[0]!.error).toBe('cli_quota_exhausted');
        expect(res[0]!.metadata['transport']).toBe('cli');
    });

    it('quota exhaustion DOES retry under api_on_quota: true', () => {
        const res = consult([cliSeat('cli_quota_exhausted')], q, null, {
            cli_fallback: { api_on_quota: true, construct: () => apiTwin() },
        });
        expect(res[0]!.error).toBeNull();
        expect(res[0]!.text).toBe('via api');
        expect(res[0]!.metadata['fallback_reason']).toBe('quota_exhausted');
    });

    it('a timeout never retries, opt-in or not — the call may have half-completed', () => {
        const constructed: string[] = [];
        const res = consult([cliSeat('timeout')], q, null, {
            cli_fallback: {
                api_on_quota: true,
                construct: (p) => {
                    constructed.push(p);
                    return apiTwin();
                },
            },
        });
        expect(constructed).toEqual([]);
        expect(res[0]!.error).toBe('timeout');
    });

    it('construct → null (strict api_key_ref contract refused) surfaces the original failure', () => {
        const res = consult([cliSeat('auth_expired')], q, null, {
            cli_fallback: { api_on_quota: false, construct: () => null },
        });
        expect(res[0]!.error).toBe('auth_expired');
        expect(res[0]!.metadata['transport']).toBe('cli');
    });

    it('at most one retry per provider across ALL rounds of one invocation', () => {
        let constructions = 0;
        consult([cliSeat('auth_expired')], q, null, {
            rounds: 3,
            cli_fallback: {
                api_on_quota: false,
                construct: () => {
                    constructions += 1;
                    // The twin itself keeps failing so every round re-enters
                    // the failure path — only the ledger stops round 2 and 3.
                    return new Mock('anthropic', 'claude-sonnet-4-6', {
                        error: 'unauthorized',
                    });
                },
            },
        });
        expect(constructions).toBe(1);
    });

    it('an api member failing is never retried — the fallback is cli-scoped', () => {
        const constructed: string[] = [];
        const res = consult(
            [new Mock('openai', 'gpt-5.2', { error: 'auth_rejected', transport: 'api' })],
            q,
            null,
            {
                cli_fallback: {
                    api_on_quota: false,
                    construct: (p) => {
                        constructed.push(p);
                        return apiTwin();
                    },
                },
            },
        );
        expect(constructed).toEqual([]);
        expect(res[0]!.error).toBe('auth_rejected');
    });

    it('no cli_fallback opts → byte-identical to today (failure surfaces, no metadata)', () => {
        const res = consult([cliSeat('auth_expired')], q);
        expect(res[0]!.error).toBe('auth_expired');
        expect(res[0]!.metadata['fallback_from']).toBeUndefined();
        expect(res[0]!.metadata['fallback_skipped']).toBeUndefined();
    });

    it('non-billable members skip cost gate but track tokens + stamp subscription', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        const m = new Mock('manual', 'human', {
            text: 'typed',
            billable: false,
            transport: 'manual',
            sub: 'flat',
            it: 3,
            ot: 4,
        });
        const res = consult([m], q);
        expect(res[0]!.metadata['billable']).toBe(false);
        expect(res[0]!.metadata['transport']).toBe('manual');
        expect(res[0]!.metadata['subscription_label']).toBe('flat');
    });
});

// ── Phase 1: the fallback across the remaining call paths ────────────────
//
// The invocation-scoped ledger only delivers what it was chosen for if a
// provider that fell back is SUBSTITUTED for the rest of the invocation.
// Without that, `MidFlightFallback` hands out `'api'` once per provider and
// round 2 loses the seat outright — strictly worse than a per-round ledger.
// These tests pin the substitution, not just the first retry.

describe('orchestrator — fallback across rounds (sticky substitution)', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });

    /** Fails on every call, as a dead cli binary does. */
    const deadCli = (error: string): Mock =>
        new Mock('anthropic', 'claude-sonnet-4-6', {
            error,
            transport: 'cli',
            billable: false,
        });

    it('a NON-BILLABLE cli seat falls back — the shape every vendor CLI actually has', () => {
        // `CliClient` (clients.ts) is `billable = false` + `transport = 'cli'`,
        // and that branch used to return early, before the retry block. So the
        // mechanism could only fire for the two community subclasses that set
        // `billable = true` — never for anthropic/openai/gemini, the members it
        // was built for. This is the regression pin for that.
        const res = consult([deadCli('auth_expired')], q, null, {
            cli_fallback: {
                api_on_quota: false,
                construct: () =>
                    new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' }),
            },
        });
        expect(res[0]!.error).toBeNull();
        expect(res[0]!.text).toBe('via api');
        expect(res[0]!.metadata['fallback_from']).toBe('cli');
        // The escalating round is not marked sticky — only the reuses are.
        expect(res[0]!.metadata['fallback_sticky']).toBeUndefined();
        // The twin is metered, so the seat is stamped as the api member that
        // answered rather than as the subscription seat that failed.
        expect(res[0]!.metadata['transport']).toBe('api');
        expect(res[0]!.metadata['billable']).toBe(true);
    });

    it('consult over 3 rounds: one construction, one dead-binary call, api for the rest', () => {
        const cli = deadCli('auth_expired');
        let calls = 0;
        const origAsk = cli.ask.bind(cli);
        cli.ask = ((...a: unknown[]) => {
            calls += 1;
            return (origAsk as (...x: unknown[]) => CouncilResponse)(...a);
        }) as typeof cli.ask;

        const constructed: string[] = [];
        consult([cli], q, null, {
            rounds: 3,
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' });
                },
            },
        });

        // The twin is built ONCE — the roadmap's own verify line.
        expect(constructed).toEqual(['anthropic']);
        // And the dead binary is spawned ONCE, not once per round. This is the
        // whole efficiency argument for invocation scope; without the sticky
        // map it would be 3.
        expect(calls).toBe(1);
    });

    it('every round after the fallback answers via the twin and says so', () => {
        const res: CouncilResponse[][] = [];
        consult([deadCli('auth_expired')], q, null, {
            rounds: 3,
            on_round_complete: (_i, r) => {
                res.push(r);
            },
            cli_fallback: {
                api_on_quota: false,
                construct: () =>
                    new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' }),
            },
        });
        expect(res).toHaveLength(3);
        for (const round of res) {
            expect(round[0]!.error).toBeNull();
            expect(round[0]!.text).toBe('via api');
            // No round is silent about the escalation — the condition the
            // council attached to picking invocation scope.
            expect(round[0]!.metadata['fallback_from']).toBe('cli');
            expect(round[0]!.metadata['fallback_reason']).toBe('auth_rejected');
        }
        // Round 1 is the establishing retry; 2 and 3 are substitutions.
        expect(res[0]![0]!.metadata['fallback_sticky']).toBeUndefined();
        expect(res[1]![0]!.metadata['fallback_sticky']).toBe(true);
        expect(res[2]![0]!.metadata['fallback_sticky']).toBe(true);
    });

    it('an INELIGIBLE failure never establishes a twin — every round fails unchanged', () => {
        const constructed: string[] = [];
        const res: CouncilResponse[][] = [];
        consult([deadCli('timeout')], q, null, {
            rounds: 2,
            on_round_complete: (_i, r) => {
                res.push(r);
            },
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' });
                },
            },
        });
        expect(constructed).toEqual([]);
        expect(res[0]![0]!.error).toBe('timeout');
        expect(res[1]![0]!.error).toBe('timeout');
    });

    it('no cli_fallback → multi-round behaviour is byte-identical to today', () => {
        const res: CouncilResponse[][] = [];
        consult([deadCli('auth_expired')], q, null, {
            rounds: 2,
            on_round_complete: (_i, r) => {
                res.push(r);
            },
        });
        expect(res[0]![0]!.error).toBe('auth_expired');
        expect(res[1]![0]!.error).toBe('auth_expired');
        expect(res[1]![0]!.metadata['fallback_from']).toBeUndefined();
    });
});

describe('orchestrator — fallback observability', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
    const deadCli = (error = 'auth_expired'): Mock =>
        new Mock('anthropic', 'claude-sonnet-4-6', { error, transport: 'cli', billable: false });
    type Ev = {
        provider: string;
        failure: string;
        outcome: string;
        api_on_quota: boolean | 'ask';
    };

    it('emits one event per ESTABLISHING escalation, not per substituted call', () => {
        const events: Ev[] = [];
        consult([deadCli()], q, null, {
            rounds: 3,
            cli_fallback: {
                api_on_quota: false,
                construct: () => new Mock('anthropic', 'claude-sonnet-4-6', { text: 'ok' }),
                on_event: (e) => events.push(e),
            },
        });
        // Three rounds, one escalation: rounds 2 and 3 reuse the twin.
        expect(events).toEqual([
            { provider: 'anthropic', failure: 'auth_rejected', outcome: 'retried', api_on_quota: false },
        ]);
    });

    it('a provider with no constructible api rung emits outcome no_twin', () => {
        const events: Ev[] = [];
        const res = consult([deadCli()], q, null, {
            cli_fallback: { api_on_quota: false, construct: () => null, on_event: (e) => events.push(e) },
        });
        expect(events).toEqual([
            { provider: 'anthropic', failure: 'auth_rejected', outcome: 'no_twin', api_on_quota: false },
        ]);
        // The original failure stands — no_twin is not a silent recovery.
        expect(res[0]!.error).toBe('auth_expired');
    });

    it('an ineligible failure emits nothing — there was no escalation to report', () => {
        const events: Ev[] = [];
        consult([deadCli('timeout')], q, null, {
            cli_fallback: {
                api_on_quota: false,
                construct: () => new Mock('anthropic', 'claude-sonnet-4-6', { text: 'ok' }),
                on_event: (e) => events.push(e),
            },
        });
        expect(events).toEqual([]);
    });

    it('the rendered member line names the transport that actually answered', () => {
        const res = consult([deadCli()], q, null, {
            rounds: 2,
            cli_fallback: {
                api_on_quota: false,
                construct: () => new Mock('anthropic', 'claude-sonnet-4-6', { text: 'ok' }),
            },
        });
        const out = render(res);
        // The reuse round says the transport was lost EARLIER in the pass, so
        // a reader does not count two escalations from two rendered lines.
        expect(out).toContain('transport: api (cli lost earlier this pass: auth_rejected)');
    });

    it('the establishing round renders as a fall-back, not as a reuse', () => {
        const res = consult([deadCli()], q, null, {
            cli_fallback: {
                api_on_quota: false,
                construct: () => new Mock('anthropic', 'claude-sonnet-4-6', { text: 'ok' }),
            },
        });
        expect(render(res)).toContain('transport: api (fell back from cli: auth_rejected)');
    });

    it('a pass with no fallback renders exactly as before', () => {
        const res = consult([new Mock('anthropic', 'claude-x', { text: 'ok' })], q);
        expect(render(res)).not.toContain('transport: api (');
    });
});

describe('orchestrator — fallback on the debate path', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
    const deadCli = (): Mock =>
        new Mock('anthropic', 'claude-sonnet-4-6', {
            error: 'auth_expired',
            transport: 'cli',
            billable: false,
        });

    it('a cli seat failing eligibly in round 1 answers via api in every later round, built once', () => {
        const constructed: string[] = [];
        const rounds = run_debate([deadCli()], q, {
            max_rounds: 3,
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' });
                },
            },
        });
        expect(constructed).toEqual(['anthropic']);
        expect(rounds).toHaveLength(3);
        for (const round of rounds) {
            expect(round[0]!.text).toBe('via api');
            expect(round[0]!.metadata['fallback_from']).toBe('cli');
        }
    });

    it('the restate pass shares the debate ledger — it does not get its own', () => {
        const constructed: string[] = [];
        let restated: CouncilResponse[] = [];
        run_debate([deadCli()], q, {
            max_rounds: 2,
            restate: true,
            on_restate: (r) => {
                restated = r;
            },
            cli_fallback: {
                api_on_quota: false,
                construct: (p) => {
                    constructed.push(p);
                    return new Mock('anthropic', 'claude-sonnet-4-6', { text: 'via api' });
                },
            },
        });
        // Restate + 2 rounds = 3 opportunities, ONE construction: the ledger
        // and the twin map span the whole `run_debate` invocation.
        expect(constructed).toEqual(['anthropic']);
        expect(restated[0]!.text).toBe('via api');
    });

    it('no cli_fallback on the debate path → byte-identical to today', () => {
        const rounds = run_debate([deadCli()], q, { max_rounds: 2 });
        expect(rounds[0]![0]!.error).toBe('auth_expired');
        expect(rounds[1]![0]!.error).toBe('auth_expired');
        expect(rounds[1]![0]!.metadata['fallback_from']).toBeUndefined();
    });
});

describe('orchestrator — cost gating', () => {
    // Token-cap breach with no on_overrun → short-circuits remaining members.
    it('token breach short-circuits remaining members (v1)', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(40) });
        const table = load_prices();
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5'),
            new Mock('openai', 'gpt-4o'),
        ];
        // Tiny input cap so member 0's projection already breaches.
        const budget = new CostBudget({ max_input_tokens: 1, max_output_tokens: 1 });
        const res = consult(members, q, budget, { table });
        expect(res.map((r) => r.error)).toEqual([
            'cost_budget_exceeded',
            'cost_budget_exceeded',
        ]);
    });

    // R2 review, finding 3. Before the unmetered escalation existed, a
    // `billable: false` member returned before this gate and could not reach
    // it; after it, a dead FREE cli seat arrives priced as its metered twin,
    // one branch away from aborting every remaining member of the round. The
    // shipped claim `council-fallback-loses-zero-seats` says that cannot
    // happen, so this pins it from both sides.
    it('a dead FREE cli seat refused by the budget costs its own seat, never the round', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(40) });
        const table = load_prices();
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', {
                error: 'auth_expired',
                transport: 'cli',
                billable: false,
            }),
            new Mock('openai', 'gpt-4o', { text: 'second seat answered', it: 1, ot: 1 }),
        ];
        // A USD ceiling, DERIVED, and both halves matter. A token cap tight
        // enough to breach the twin also breaches seat 1 on its own merits, so
        // the round would end aborted either way and the assertion could not
        // tell the fix from the defect. And a hand-picked USD number is the
        // same trap one layer down — too low breaches everyone, too high
        // breaches no one, and either reads as a passing test. So the ceiling
        // is read off the real price table, strictly between the two seats.
        const twinEst = estimate(
            q,
            [new Mock('anthropic', 'claude-sonnet-4-5')],
            table,
        )[0] as CostEstimate;
        const cheapEst = estimate(q, [members[1] as Mock], table)[0] as CostEstimate;
        const twinUsd = twinEst.input_usd + twinEst.output_usd;
        const cheapUsd = cheapEst.input_usd + cheapEst.output_usd;
        // If this ever stops holding the test is measuring nothing, so it
        // fails loudly here rather than passing for the wrong reason.
        expect(cheapUsd).toBeLessThan(twinUsd);
        const budget = new CostBudget({
            max_input_tokens: 50_000,
            max_output_tokens: 20_000,
            max_total_usd: (cheapUsd + twinUsd) / 2,
        });
        const res = consult(members, q, budget, {
            table,
            cli_fallback: {
                api_on_quota: false,
                construct: () =>
                    new Mock('anthropic', 'claude-sonnet-4-5', { text: 'via api' }),
            },
        });
        // Seat 0 degrades to its OWN original cli failure — not to
        // `cost_budget_exceeded`, which would report the twin's abort as the
        // seat's outcome and discard why the cli died.
        expect(res[0]!.error).toBe('auth_expired');
        // Named, so a reader can tell "not retried" from "retry refused" —
        // the same marker `runGatedRetry` sets on the billable path.
        expect(res[0]!.metadata['fallback_skipped']).toBe('cost_budget');
        expect(res[0]!.metadata['fallback_from']).toBeUndefined();
        // The round survives. This is the assertion the claim rests on.
        expect(res).toHaveLength(2);
        expect(res[1]!.error).toBeNull();
        expect(res[1]!.text).toBe('second seat answered');
    });

    it('on_overrun(false) skips the breaching member only', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(40) });
        const table = load_prices();
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', { text: 'ok', it: 1, ot: 1 }),
            new Mock('openai', 'gpt-4o', { text: 'ok', it: 1, ot: 1 }),
        ];
        const seen: number[] = [];
        const onOverrun = (e: OverrunEvent): boolean => {
            seen.push(e.member_index);
            return false; // skip
        };
        // input cap permits 1 member's projection but not two cumulatively.
        const budget = new CostBudget({ max_input_tokens: 100000, max_output_tokens: 0 });
        const res = consult(members, q, budget, { table, on_overrun: onOverrun });
        expect(res.every((r) => r.error === 'cost_budget_exceeded')).toBe(true);
        expect(seen.length).toBeGreaterThan(0);
    });
});

describe('orchestrator — estimate', () => {
    it('one CostEstimate per member, in order', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'hello world' });
        const table = load_prices();
        const members = [new Mock('anthropic', 'claude-sonnet-4-5'), new Mock('openai', 'gpt-4o')];
        const ests = estimate(q, members, table);
        expect(ests.map((e) => e.provider)).toEqual(['anthropic', 'openai']);
    });
});

describe('orchestrator — estimate_debate_cost', () => {
    it('rounds < 1 raises', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        const table = load_prices();
        expect(() => estimate_debate_cost(q, [new Mock('a', 'm')], table, { rounds: 0 })).toThrow(
            /rounds must be >= 1/,
        );
    });

    it('separates billable vs subscription members; high = expected*1.2', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'hello world' });
        const table = load_prices();
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5'),
            new Mock('manual', 'human', { billable: false, transport: 'manual', sub: 'flat' }),
        ];
        const est = estimate_debate_cost(q, members, table, { rounds: 2 });
        expect(est.subscription_members.map((s) => s['name'])).toEqual(['manual']);
        expect(est.per_member.map((p) => p['name'])).toEqual(['anthropic']);
        expect(est.high_usd).toBeCloseTo(est.expected_usd * 1.2, 12);
    });
});

describe('orchestrator — run_debate', () => {
    it('max_rounds < 1 raises', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
        expect(() => run_debate([new Mock('a', 'm')], q, { max_rounds: 0 })).toThrow(
            /max_rounds must be >= 1/,
        );
    });

    it('seed_round_1 reused verbatim in round 1 (no calls)', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic' });
        const seed = [
            new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'seed A' }),
            new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'seed B' }),
        ];
        const rounds = run_debate(
            [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'r2-A' }), new Mock('openai', 'gpt-4o', { text: 'r2-B' })],
            q,
            { max_rounds: 2, seed_round_1: seed },
        );
        expect(rounds[0]!.map((r) => r.text)).toEqual(['seed A', 'seed B']);
        expect(rounds[1]!.map((r) => r.text)).toEqual(['r2-A', 'r2-B']);
    });

    it('debate_gates injects the anti-conformity directive into round 2+; default off = byte-identical (Phase 3)', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'Adopt A or B?' });
        const seed = [
            new CouncilResponse({ provider: 'anthropic', model: 'm', text: 'seed A' }),
            new CouncilResponse({ provider: 'openai', model: 'm', text: 'seed B' }),
        ];
        // Gates ON → the round-2 prompt (each member's first ask) carries the directive.
        const onA = new CapturingMock('anthropic', 'm', ['r2-A']);
        run_debate([onA, new CapturingMock('openai', 'm', ['r2-B'])], q, {
            max_rounds: 2,
            seed_round_1: seed,
            debate_gates: true,
        });
        expect(onA.prompts[0]).toContain(ANTI_CONFORMITY_DIRECTIVE);

        // Gates OFF (default) → the same run without the directive (byte-identical path).
        const offA = new CapturingMock('anthropic', 'm', ['r2-A']);
        run_debate([offA, new CapturingMock('openai', 'm', ['r2-B'])], q, {
            max_rounds: 2,
            seed_round_1: seed,
        });
        expect(offA.prompts[0]).not.toContain(ANTI_CONFORMITY_DIRECTIVE);
    });

    it('DebateCapExceeded thrown when next round breaches max_total_usd', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic '.repeat(100) });
        const table = load_prices();
        const members = [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'x', it: 5, ot: 5 })];
        // Tiny USD cap → round-2 projection breaches.
        const budget = new CostBudget({ max_total_usd: 0.0000001, max_input_tokens: 1e9, max_output_tokens: 1e9 });
        expect(() => run_debate(members, q, { max_rounds: 2, table, budget })).toThrow(DebateCapExceeded);
    });

    it('on_continue(false) stops after the completed round', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic' });
        const members = [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'a' }), new Mock('openai', 'gpt-4o', { text: 'b' })];
        const rounds = run_debate(members, q, { max_rounds: 3, on_continue: () => false });
        expect(rounds.length).toBe(1);
    });

    // road-to-cache-economy Phase 4 — inter-round cache-gap measurement.
    // The gap approximates the wall-clock time between the previous round's
    // cache WRITE (≈ when it finished) and this round's cache READ attempt
    // (≈ when it starts). An injectable clock avoids a real multi-minute
    // sleep while still exercising the real dispatch loop.
    function scriptedClock(values: readonly number[]): () => number {
        let i = 0;
        return () => {
            const v = values[Math.min(i, values.length - 1)] as number;
            i += 1;
            return v;
        };
    }

    it('on_round_complete receives null on round 1 (nothing written yet) and a real gap on round 2', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic' });
        const members = [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'a' }), new Mock('openai', 'gpt-4o', { text: 'b' })];
        const gaps: Array<number | null | undefined> = [];
        // round1 start=0, round1 end=1_000, round2 start=6_000 (gap=5_000), round2 end=7_000.
        run_debate(members, q, {
            max_rounds: 2,
            now: scriptedClock([0, 1_000, 6_000, 7_000]),
            on_round_complete: (_round_number, _responses, gap) => {
                gaps.push(gap);
            },
        });
        expect(gaps).toEqual([null, 5_000]);
    });

    it('two runs — rounds seconds apart vs a >5-minute gap — produce different recorded gaps', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic' });
        const runWithRound2StartAt = (round2StartMs: number): number | null | undefined => {
            const members = [
                new Mock('anthropic', 'claude-sonnet-4-5', { text: 'a' }),
                new Mock('openai', 'gpt-4o', { text: 'b' }),
            ];
            let captured: number | null | undefined;
            run_debate(members, q, {
                max_rounds: 2,
                now: scriptedClock([0, 1_000, round2StartMs, round2StartMs + 1_000]),
                on_round_complete: (round_number, _responses, gap) => {
                    if (round_number === 2) {
                        captured = gap;
                    }
                },
            });
            return captured;
        };
        const secondsApartGapMs = runWithRound2StartAt(6_000); // 5s after round 1 ended
        const overFiveMinuteGapMs = runWithRound2StartAt(400_000); // ~6.65min after round 1 ended
        const fiveMinutesMs = 5 * 60 * 1000;
        expect(secondsApartGapMs).toBe(5_000);
        expect(overFiveMinuteGapMs).toBe(399_000);
        expect(secondsApartGapMs as number).toBeLessThan(fiveMinutesMs);
        expect(overFiveMinuteGapMs as number).toBeGreaterThan(fiveMinutesMs);
        expect(secondsApartGapMs).not.toBe(overFiveMinuteGapMs);
    });

    it('a caller declaring only (round_number, responses) keeps working — the third arg is additive', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'topic' });
        const members = [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'a' }), new Mock('openai', 'gpt-4o', { text: 'b' })];
        const seen: number[] = [];
        const rounds = run_debate(members, q, {
            max_rounds: 2,
            on_round_complete: (round_number: number, responses: CouncilResponse[]) => {
                seen.push(round_number);
                expect(responses.length).toBe(2);
            },
        });
        expect(seen).toEqual([1, 2]);
        expect(rounds.length).toBe(2);
    });
});

describe('orchestrator — run_peer_review', () => {
    it('needs >= 2 distinct deliberation outputs', () => {
        const r = run_peer_review([new Mock('a', 'm')], [
            new CouncilResponse({ provider: 'a', model: 'm', text: 'only one' }),
        ]);
        expect(r.responses).toEqual([]);
        expect(r.label_to_source.size).toBe(0);
    });

    it('each reviewer critiques others (self filtered)', () => {
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', { text: 'crit-A' }),
            new Mock('openai', 'gpt-4o', { text: 'crit-B' }),
        ];
        const delib = [
            new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'pos A' }),
            new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'pos B' }),
        ];
        const r = run_peer_review(members, delib);
        expect(r.responses.map((x) => x.text)).toEqual(['crit-A', 'crit-B']);
        expect(r.label_to_source.size).toBeGreaterThan(0);
    });
});

describe('orchestrator — run_consensus_scoring', () => {
    it('empty inputs → empty bucket', () => {
        const r = run_consensus_scoring([], []);
        expect(r.findings).toEqual([]);
        expect(r.scores).toEqual([]);
    });

    it('extraction + scoring two-pass populates findings', () => {
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', { text: '[{"id":"a","text":"finding-a"}]' }),
            new Mock('openai', 'gpt-4o', { text: '[{"id":"b","text":"finding-b"}]' }),
        ];
        const delib = [
            new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'delib A' }),
            new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'delib B' }),
        ];
        const r = run_consensus_scoring(members, delib);
        expect(r.findings.map((f) => f.id).sort()).toEqual(['a', 'b']);
    });
});

describe('stance-tally integration (Phase 1)', () => {
    const stanceText = (label: string): string =>
        `Reasoning.\n\nSTANCE: ${label} | CONFIDENCE: high | DEALBREAKER: no`;

    it('consult appends the STANCE contract to the FINAL round only; default off = untouched', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'A or B?' });
        // rounds:2, on → round-1 prompt clean, round-2 (final) carries the contract.
        const on = new CapturingMock('anthropic', 'm', ['pos', stanceText('A')]);
        consult([on, new CapturingMock('openai', 'm', ['pos', stanceText('A')])], q, null, {
            rounds: 2,
            stance_tally: true,
        });
        expect(on.prompts[0]).not.toContain('STANCE:');
        expect(on.prompts[1]).toContain('STANCE: <option-label>');
        // rounds:1, on → the single (final) round carries it.
        const single = new CapturingMock('anthropic', 'm', [stanceText('A')]);
        consult([single], q, null, { rounds: 1, stance_tally: true });
        expect(single.prompts[0]).toContain('STANCE: <option-label>');
        // default off → byte-identical prompt.
        const off = new CapturingMock('anthropic', 'm', ['pos']);
        consult([off], q);
        expect(off.prompts[0]).toBe(q.user_prompt);
    });

    it('render emits the Vote Tally block when stance_tally is on, none when off', () => {
        const responses = [
            new CouncilResponse({ provider: 'anthropic', model: 'm', text: stanceText('Adopt'), latency_ms: 1 }),
            new CouncilResponse({ provider: 'openai', model: 'm', text: stanceText('Adopt'), latency_ms: 1 }),
        ];
        const withTally = render(responses, { stance_tally: true });
        expect(withTally).toContain('### Vote Tally');
        expect(withTally).toContain('Cleared: Adopt');
        expect(render(responses, {})).not.toContain('### Vote Tally');
    });

    it('render Vote Tally escalates a split honestly (never a forced winner)', () => {
        const responses = [
            new CouncilResponse({ provider: 'anthropic', model: 'm', text: stanceText('A'), latency_ms: 1 }),
            new CouncilResponse({ provider: 'openai', model: 'm', text: stanceText('B'), latency_ms: 1 }),
        ];
        const out = render(responses, { stance_tally: true });
        expect(out).toContain('Escalated: no option cleared');
    });
});

describe('chairman synthesis injection (Phase 2 wiring)', () => {
    const rs = [
        new CouncilResponse({ provider: 'anthropic', model: 'm', text: 'pos A', latency_ms: 1 }),
        new CouncilResponse({ provider: 'openai', model: 'm', text: 'pos B', latency_ms: 1 }),
    ];

    it('a chairman-authored text replaces the template, annotation visible', () => {
        const out = render(rs, {
            chairman: { member: 'google', annotation: 'Chairman: google (auto)', text: '### Recommendation\nShip A.\n\n### Kill criteria\n- x\n\n### Concrete next step\nDo y.' },
        });
        expect(out).toContain('_Chairman: google (auto)_');
        expect(out).toContain('Ship A.');
        expect(out).not.toContain('*to be summarised by the host agent*');
    });

    it('a fallback (text null) keeps the template but shows the annotation; absent = byte-identical', () => {
        const withFallback = render(rs, {
            chairman: { member: null, annotation: 'Chairman: host (no non-panel member available)', text: null },
        });
        expect(withFallback).toContain('_Chairman: host (no non-panel member available)_');
        const plain = render(rs, {});
        expect(plain).not.toContain('Chairman:');
    });
});

describe('debate-gate repair dispatch (Phase 3 wiring)', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'A or B?' });
    const seed = [
        new CouncilResponse({ provider: 'anthropic', model: 'm', text: 'I object: A has a flaw in ordering.', latency_ms: 1 }),
        new CouncilResponse({ provider: 'openai', model: 'm', text: 'However, B mishandles retries — I disagree.', latency_ms: 1 }),
    ];

    it('a near-duplicate round-2 reply triggers ONE repair and the repaired reply replaces it', () => {
        // anthropic repeats its round-1 text verbatim in round 2 (novelty dup),
        // then returns a fresh reply on the repair call.
        const a = new CapturingMock('anthropic', 'm', [
            'I object: A has a flaw in ordering.', // round 2 = dup of seed
            'Updated: the ordering flaw is resolved by the queue barrier — I now back B.',
        ]);
        const b = new CapturingMock('openai', 'm', ['However, B mishandles retries — I disagree; the flaw is unaddressed.']);
        const rounds = run_debate([a, b], q, {
            max_rounds: 2,
            seed_round_1: seed,
            debate_gates: true,
            on_repair: () => true,
        });
        expect(a.prompts.length).toBe(2); // round-2 ask + exactly one repair
        expect(a.prompts[1]).toContain('REPAIR RE-PROMPT');
        expect(rounds[1]![0]!.text).toContain('queue barrier'); // repaired reply replaced
    });

    it('on_repair=null (no transport) detects but never dispatches; gates off = no checks', () => {
        const a = new CapturingMock('anthropic', 'm', ['I object: A has a flaw in ordering.']);
        run_debate([a, new CapturingMock('openai', 'm', ['However — I disagree.'])], q, {
            max_rounds: 2,
            seed_round_1: seed,
            debate_gates: true,
            on_repair: null,
        });
        expect(a.prompts.length).toBe(1); // no repair call
        const c = new CapturingMock('anthropic', 'm', ['I object: A has a flaw in ordering.']);
        run_debate([c, new CapturingMock('openai', 'm', ['However — I disagree.'])], q, {
            max_rounds: 2,
            seed_round_1: seed,
        });
        expect(c.prompts.length).toBe(1);
    });

    it('a declined confirm skips the repair', () => {
        const a = new CapturingMock('anthropic', 'm', ['I object: A has a flaw in ordering.']);
        const rounds = run_debate([a, new CapturingMock('openai', 'm', ['However — I disagree.'])], q, {
            max_rounds: 2,
            seed_round_1: seed,
            debate_gates: true,
            on_repair: () => false,
        });
        expect(a.prompts.length).toBe(1);
        expect(rounds[1]![0]!.text).toContain('flaw in ordering'); // original kept
    });
});

describe('stance repair call (Phase 1 wiring)', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'A or B?' });

    it('a member without a stance line gets ONE stance-only repair; the line is appended', () => {
        const a = new CapturingMock('anthropic', 'm', [
            'I prefer A for its simplicity.', // final round: no STANCE line
            'STANCE: A | CONFIDENCE: high | DEALBREAKER: no', // repair reply
        ]);
        const collected: CouncilResponse[] = [];
        const out = consult([a], q, null, {
            stance_tally: true,
            on_stance_repair: () => true,
            on_stance_repair_result: (r) => collected.push(r),
        });
        expect(a.prompts.length).toBe(2);
        expect(a.prompts[1]).toContain('ONLY that single line');
        expect(out[0]!.text).toContain('STANCE: A | CONFIDENCE: high');
        expect(collected.length).toBe(1);
    });

    it('a cosmetically-defect stance (markdown bold) burns ZERO repair calls (A3 tightening)', () => {
        const bold = new CapturingMock('anthropic', 'm', [
            'Reasoning.\n\n**STANCE: A | CONFIDENCE: high | DEALBREAKER: no**',
        ]);
        consult([bold], q, null, { stance_tally: true, on_stance_repair: () => true });
        expect(bold.prompts.length).toBe(1); // lenient parse succeeded — no repair round

        const commas = new CapturingMock('anthropic', 'm', [
            'Reasoning.\n\nSTANCE: A, CONFIDENCE: med, DEALBREAKER: no',
        ]);
        consult([commas], q, null, { stance_tally: true, on_stance_repair: () => true });
        expect(commas.prompts.length).toBe(1);
    });

    it('no transport → detect-only; a parseable stance → no repair', () => {
        const noTransport = new CapturingMock('anthropic', 'm', ['I prefer A.']);
        consult([noTransport], q, null, { stance_tally: true });
        expect(noTransport.prompts.length).toBe(1);
        const hasStance = new CapturingMock('anthropic', 'm', [
            'Reasoning.\n\nSTANCE: A | CONFIDENCE: med | DEALBREAKER: no',
        ]);
        consult([hasStance], q, null, { stance_tally: true, on_stance_repair: () => true });
        expect(hasStance.prompts.length).toBe(1);
    });
});

describe('restate pass (Phase 3 wiring)', () => {
    const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'A or B?' });

    it('restate on → one pre-round-1 call per member, surfaced via on_restate', () => {
        const a = new CapturingMock('anthropic', 'm', ['Restated: choose A or B.', 'pos A']);
        const b = new CapturingMock('openai', 'm', ['Restated: pick between A and B.', 'pos B']);
        const seen: CouncilResponse[][] = [];
        const rounds = run_debate([a, b], q, {
            max_rounds: 1,
            restate: true,
            on_restate: (rs) => seen.push(rs),
        });
        expect(a.prompts.length).toBe(2); // restate + round 1
        expect(a.prompts[0]).toContain('RESTATE');
        expect(a.prompts[1]).not.toContain('RESTATE');
        expect(seen).toHaveLength(1);
        expect(seen[0]!.map((r) => r.text)).toEqual(['Restated: choose A or B.', 'Restated: pick between A and B.']);
        expect(rounds[0]!.map((r) => r.text)).toEqual(['pos A', 'pos B']);
    });

    it('default off → no extra call, round-1 prompt untouched', () => {
        const a = new CapturingMock('anthropic', 'm', ['pos A']);
        run_debate([a], q, { max_rounds: 1 });
        expect(a.prompts.length).toBe(1);
        expect(a.prompts[0]).toBe(q.user_prompt);
    });
});

describe('A3 cross-round read unlock — stable prefix + volatile suffix', () => {
    class SplitCapture extends ExternalAIClient {
        splits: Array<{ stable: string; suffix: string } | null> = [];
        constructor() {
            super();
            this.name = 'anthropic';
            this.model = 'm';
            this.billable = false;
            this.transport = 'manual';
        }
        override ask(_s: string, _u: string): CouncilResponse {
            this.splits.push(null); // non-split path
            return new CouncilResponse({ provider: this.name, model: this.model, text: 'pos', latency_ms: 1 });
        }
        override ask_split(_s: string, stable: string, suffix: string): CouncilResponse {
            this.splits.push({ stable, suffix });
            return new CouncilResponse({ provider: this.name, model: this.model, text: 'pos', latency_ms: 1 });
        }
    }

    it('round 1 has no suffix; round 2+ keep the stable prefix byte-identical', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'ARTEFACT BODY' });
        const m = new SplitCapture();
        consult([m], q, null, { rounds: 3 });
        expect(m.splits.length).toBe(3);
        expect(m.splits[0]).toBeNull(); // round 1: plain ask, no volatile part
        expect(m.splits[1]?.stable).toBe('ARTEFACT BODY');
        expect(m.splits[2]?.stable).toBe('ARTEFACT BODY');
        expect(m.splits[1]?.suffix).toContain('Prior round critiques');
        expect(m.splits[2]?.suffix).toContain('Prior round critiques');
    });

    it('stable + suffix concatenation equals the legacy full prompt', () => {
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'ARTEFACT BODY' });
        const legacy = new CapturingMock('anthropic', 'm', ['pos', 'pos']);
        consult([legacy], q, null, { rounds: 2 });
        const split = new SplitCapture();
        consult([split], q, null, { rounds: 2 });
        const s = split.splits[1];
        expect(s).not.toBeNull();
        expect(`${s!.stable}${s!.suffix}`).toBe(legacy.prompts[1]);
    });
});

// ── road-to-always-on-orchestration Phase 3.2/3.3 — render() additions ───

describe('render — absent_members / quorum sections (Phase 3.2/3.3)', () => {
    const rs = [new CouncilResponse({ provider: 'anthropic', model: 'm', text: 'pos', latency_ms: 1 })];

    it('omitting both options renders byte-identically to today', () => {
        const withoutOpts = render(rs, {});
        const withNulls = render(rs, { absent_members: null, quorum: null });
        expect(withNulls).toBe(withoutOpts);
        expect(withoutOpts).not.toContain('Absent Members');
        expect(withoutOpts).not.toContain('Quorum');
    });

    it('an empty absent_members array renders nothing new either', () => {
        expect(render(rs, { absent_members: [] })).not.toContain('Absent Members');
    });

    it('a populated absent_members list appends a trailing section naming each member and reason', () => {
        const out = render(rs, {
            absent_members: [
                { member: 'openai', reason: 'no_binary', detail: 'codex is not on PATH' },
                { member: 'gemini', reason: null, detail: 'unclassified' },
            ],
        });
        expect(out).toContain('### Absent Members');
        expect(out).toContain('**openai** (no_binary) — codex is not on PATH');
        expect(out).toContain('**gemini** — unclassified');
        expect(out).not.toContain('gemini** (null)');
    });

    it('a concluded quorum renders a plain one-liner', () => {
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 1, total: 2, present: 2 },
        });
        expect(out).toContain('**Quorum:** 2/2 present, needed 1 — concluded.');
    });

    it('an inconclusive quorum visibly names the release-gate hold', () => {
        const out = render(rs, {
            quorum: { status: 'inconclusive', threshold: 1, total: 2, present: 0 },
        });
        expect(out).toContain('INCONCLUSIVE — release gate holds');
    });

    it('a solo-concluded pass says so — it must not read like full attendance', () => {
        // The whole defect: 1-of-2 concludes, and without this marker the
        // rendered pass is indistinguishable from 2-of-2.
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 1, total: 2, present: 1 },
        });
        expect(out).toContain('**Quorum:** 1/2 present, needed 1 — concluded.');
        expect(out).toContain('**solo** — one voice concluded this pass');
    });

    it('full attendance carries NO solo marker', () => {
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 1, total: 2, present: 2 },
        });
        expect(out).not.toContain('solo');
    });

    // The DEGRADED marker shipped on the CLI's stdout line in round 7 and did
    // NOT ship on this renderer, although stdout was mirrored FROM here. The
    // artefact is the surface that gets committed and cited, so it was the
    // worse of the two to leave soft.
    it('a partial-attendance pass is marked DEGRADED in the artefact, not only on stdout', () => {
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 1, total: 2, present: 1 },
        });
        expect(out).toContain('DEGRADED — 1 member(s) did not answer; this is not convergence.');
    });

    // The case the solo marker structurally cannot cover: present > 1 but still
    // short of total, so `isSoloConcluded` is false and the line read as a plain
    // "concluded" with nothing naming the two silent members.
    it('DEGRADED covers partial attendance the solo marker misses (2 of 4)', () => {
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 2, total: 4, present: 2 },
        });
        expect(out).not.toContain('solo');
        expect(out).toContain('DEGRADED — 2 member(s) did not answer; this is not convergence.');
    });

    it('full attendance carries NO degraded marker', () => {
        const out = render(rs, {
            quorum: { status: 'concluded', threshold: 1, total: 2, present: 2 },
        });
        expect(out).not.toContain('DEGRADED');
    });

    it('an inconclusive pass is never marked solo, however few were present', () => {
        const out = render(rs, {
            quorum: { status: 'inconclusive', threshold: 2, total: 3, present: 1 },
        });
        expect(out).not.toContain('solo');
    });

    it('quorum renders before the absent-members section when both are present', () => {
        const out = render(rs, {
            quorum: { status: 'inconclusive', threshold: 1, total: 2, present: 0 },
            absent_members: [{ member: 'openai', reason: 'timeout', detail: 'call timed out' }],
        });
        const quorumIdx = out.indexOf('**Quorum:**');
        const absentIdx = out.indexOf('### Absent Members');
        expect(quorumIdx).toBeGreaterThan(-1);
        expect(absentIdx).toBeGreaterThan(quorumIdx);
    });
});

// ── road-to-always-on-orchestration Phase 4.1 — verdict handoff envelope ──

describe('render — handoff section (Phase 4.1)', () => {
    const rs = [new CouncilResponse({ provider: 'anthropic', model: 'm', text: 'pos', latency_ms: 1 })];

    it('omitting the option renders byte-identically to today', () => {
        const withoutOpt = render(rs, {});
        const withNull = render(rs, { handoff: null });
        expect(withNull).toBe(withoutOpt);
        expect(withoutOpt).not.toContain('Handoff');
    });

    it('an all-null envelope (nothing structured this pass) renders nothing new either', () => {
        expect(render(rs, { handoff: EMPTY_HANDOFF })).not.toContain('Handoff');
    });

    it('a populated envelope appends a Handoff section right after the synthesis slot', () => {
        const out = render(rs, {
            handoff: {
                decision: 'ship now',
                rejected_alternatives: [{ option: 'wait a sprint', reason: 'backed by 0 member(s), weight 0.00 of 1.33 needed to conclude' }],
                constraints: ['must ship behind a feature flag'],
            },
        });
        expect(out).toContain('### Handoff');
        expect(out).toContain('**Decision:** ship now');
        expect(out).toContain('- **wait a sprint** — backed by 0 member(s), weight 0.00 of 1.33 needed to conclude');
        expect(out).toContain('- must ship behind a feature flag');
        const synthesisIdx = out.indexOf('## Convergence / Divergence');
        const handoffIdx = out.indexOf('### Handoff');
        const quorumIdx = out.indexOf('**Quorum:**');
        expect(handoffIdx).toBeGreaterThan(synthesisIdx);
        // Handoff sits BEFORE the trailing quorum/absent bookkeeping when both
        // are supplied — closest to the synthesis it was extracted from.
        expect(render(rs, {
            handoff: { decision: 'x', rejected_alternatives: null, constraints: null },
            quorum: { status: 'concluded', threshold: 1, total: 1, present: 1 },
        }).indexOf('### Handoff')).toBeLessThan(
            render(rs, {
                handoff: { decision: 'x', rejected_alternatives: null, constraints: null },
                quorum: { status: 'concluded', threshold: 1, total: 1, present: 1 },
            }).indexOf('**Quorum:**'),
        );
        expect(quorumIdx).toBe(-1); // this render() call passed no quorum option
    });

    it('a decision with no rejected alternatives or constraints says so honestly, not silently', () => {
        const out = render(rs, {
            handoff: { decision: 'ship now', rejected_alternatives: null, constraints: null },
        });
        expect(out).toContain('**Decision:** ship now');
        expect(out).toContain('**Rejected alternatives:** none recorded.');
        expect(out).toContain('**Constraints:** none recorded.');
    });
});
