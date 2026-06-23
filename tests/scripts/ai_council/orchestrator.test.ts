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
import { load_prices } from '../../../src/scripts/ai_council/pricing.js';

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
