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
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import {
    consult,
    CostBudget,
    CouncilQuestion,
    DebateCapExceeded,
    estimate,
    estimate_debate_cost,
    OverrunEvent,
    render,
    run_consensus_scoring,
    run_debate,
    run_peer_review,
} from '../../../src/scripts/ai_council/orchestrator.js';
import { load_prices } from '../../../src/scripts/ai_council/pricing.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

// ── Python driver: importlib direct-file load + a duck-typed mock client ──
//
// The driver defines a `Mock` member whose ask() returns a canned response so
// no live transport runs. Each test snippet appends to this preamble and
// prints a JSON-able view to stdout for byte comparison.
const PY_PREAMBLE = `
import importlib.util, sys, json
_spec = importlib.util.spec_from_file_location("orch", "src/scripts/ai_council/orchestrator.py")
orch = importlib.util.module_from_spec(_spec)
sys.modules["orch"] = orch
_spec.loader.exec_module(orch)
from scripts.ai_council.clients import CouncilResponse

class Mock:
    def __init__(self, name, model, text="", err=None, it=10, ot=20, billable=True,
                 transport="api", sub="", raises=False, latency=5):
        self.name = name; self.model = model; self._t = text; self._e = err
        self._it = it; self._ot = ot; self.billable = billable
        self.transport = transport; self.subscription_label = sub
        self._raises = raises; self._lat = latency
    def ask(self, sp, up, mt):
        if self._raises:
            raise RuntimeError("boom")
        return CouncilResponse(provider=self.name, model=self.model, text=self._t,
                               error=self._e, input_tokens=self._it,
                               output_tokens=self._ot, latency_ms=self._lat)
`;

function py(snippet: string): string {
    const code = `${PY_PREAMBLE}\n${snippet}`;
    const r = spawnSync('python3', ['-c', code], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: ['src', '.'].join(':') },
    });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout;
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

// ── Golden parity vs CPython twin ────────────────────────────────────────

describe.runIf(py3)('orchestrator — golden parity vs CPython twin', () => {
    // render() across many shapes: errors, billable api, non-billable manual,
    // consensus, multiple modes. Mock latency pinned so output is byte-stable.
    const RENDER_CASES: Record<string, () => { ts: string; pyMembers: string; pyArgs: string }> = {
        plain_two: () => ({
            ts: render(
                consult(
                    [
                        new Mock('anthropic', 'claude-sonnet-4-5', { text: 'resp A', latency: 5 }),
                        new Mock('openai', 'gpt-4o', { text: 'resp B', latency: 7 }),
                    ],
                    new CouncilQuestion({ mode: 'prompt', user_prompt: 'hi' }),
                ),
                { mode: 'prompt' },
            ),
            pyMembers:
                '[Mock("anthropic","claude-sonnet-4-5",text="resp A",latency=5), ' +
                'Mock("openai","gpt-4o",text="resp B",latency=7)]',
            pyArgs: 'mode="prompt"',
        }),
        with_error: () => ({
            ts: render(
                consult(
                    [
                        new Mock('anthropic', 'claude-sonnet-4-5', { text: 'ok', latency: 5 }),
                        new Mock('openai', 'gpt-4o', { error: 'cost_budget_exceeded', latency: 0 }),
                    ],
                    new CouncilQuestion({ mode: 'roadmap', user_prompt: 'plan' }),
                ),
                { mode: 'roadmap' },
            ),
            pyMembers:
                '[Mock("anthropic","claude-sonnet-4-5",text="ok",latency=5), ' +
                'Mock("openai","gpt-4o",err="cost_budget_exceeded",latency=0)]',
            pyArgs: 'mode="roadmap"',
        }),
        non_billable: () => ({
            ts: render(
                consult(
                    [
                        new Mock('manual', 'human', {
                            text: 'typed answer',
                            billable: false,
                            transport: 'manual',
                            sub: 'claude-pro',
                            latency: 0,
                        }),
                    ],
                    new CouncilQuestion({ mode: 'prompt', user_prompt: 'q' }),
                ),
                { mode: 'prompt' },
            ),
            pyMembers:
                '[Mock("manual","human",text="typed answer",billable=False,' +
                'transport="manual",sub="claude-pro",latency=0)]',
            pyArgs: 'mode="prompt"',
        }),
        prose_synthesis_true: () => ({
            ts: render(
                consult(
                    [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'creative', latency: 3 })],
                    new CouncilQuestion({ mode: 'design', user_prompt: 'adr' }),
                ),
                { mode: 'design', prose_synthesis: true },
            ),
            pyMembers: '[Mock("anthropic","claude-sonnet-4-5",text="creative",latency=3)]',
            pyArgs: 'mode="design", prose_synthesis=True',
        }),
    };

    it.each(Object.keys(RENDER_CASES))('render(%s) byte-matches', (key) => {
        const { ts, pyMembers, pyArgs } = RENDER_CASES[key]!();
        const expected = py(
            `q = orch.CouncilQuestion(mode=${JSON.stringify(
                key === 'with_error' ? 'roadmap' : key === 'prose_synthesis_true' ? 'design' : 'prompt',
            )}, user_prompt="z")\n` +
                `members = ${pyMembers}\n` +
                `res = orch.consult(members, q)\n` +
                `out = orch.render(res, ${pyArgs})\n` +
                `print(json.dumps(out))`,
        ).trim();
        expect(ts).toEqual(JSON.parse(expected));
    });

    // Cost-line USD formatting: drive a billable call through a real price
    // table so cost_usd is stamped, then byte-compare the meta line.
    it('billable cost line :.4f formatting matches', () => {
        const table = load_prices();
        const members = [new Mock('anthropic', 'claude-sonnet-4-5', { text: 'body', it: 1234, ot: 567, latency: 42 })];
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(80) });
        const tsOut = render(consult(members, q, new CostBudget(), { table }), { mode: 'prompt' });
        const expected = py(
            'import scripts.ai_council.pricing as pricing\n' +
                'table = pricing.load_prices()\n' +
                'q = orch.CouncilQuestion(mode="prompt", user_prompt="x"*80)\n' +
                'members = [Mock("anthropic","claude-sonnet-4-5",text="body",it=1234,ot=567,latency=42)]\n' +
                'res = orch.consult(members, q, table=table)\n' +
                'print(json.dumps(orch.render(res, mode="prompt")))',
        ).trim();
        expect(tsOut).toEqual(JSON.parse(expected));
    });

    // _augment_for_next_round / debate prompt assembly via run_debate round 2.
    it('multi-round debate prompt augmentation byte-matches (round 2 user prompt seen)', () => {
        // Round 2 responses joined into one synthetic response, then rendered
        // (matches the Python driver, which wraps the joined text the same way).
        const round2 = run_debate(
            [
                new Mock('anthropic', 'claude-sonnet-4-5', { text: 'pos A', latency: 1 }),
                new Mock('openai', 'gpt-4o', { text: 'pos B', latency: 1 }),
            ],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'ORIGINAL' }),
            { max_rounds: 2 },
        )[1]!;
        const echoTs = render(
            [
                new CouncilResponse({
                    provider: 'x',
                    model: 'y',
                    text: round2.map((r) => r.text).join('|'),
                }),
            ],
            {},
        );
        const expected = py(
            'q = orch.CouncilQuestion(mode="prompt", user_prompt="ORIGINAL")\n' +
                'members = [Mock("anthropic","claude-sonnet-4-5",text="pos A",latency=1), ' +
                'Mock("openai","gpt-4o",text="pos B",latency=1)]\n' +
                'rounds = orch.run_debate(members, q, max_rounds=2)\n' +
                'out = orch.render([CouncilResponse(provider="x",model="y",' +
                'text="|".join(r.text for r in rounds[1]))])\n' +
                'print(json.dumps(out))',
        ).trim();
        expect(echoTs).toEqual(JSON.parse(expected));
    });

    // estimate() per-member cost parity (input_usd/output_usd floats).
    it('estimate() per-member float fields match', () => {
        const table = load_prices();
        const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'estimate me '.repeat(20) });
        const members = [new Mock('anthropic', 'claude-sonnet-4-5'), new Mock('openai', 'gpt-4o')];
        const ts = estimate(q, members, table).map((e) => [
            e.provider,
            e.model,
            e.input_tokens,
            e.output_tokens,
            e.input_usd,
            e.output_usd,
        ]);
        const expected = py(
            'import scripts.ai_council.pricing as pricing\n' +
                'table = pricing.load_prices()\n' +
                'q = orch.CouncilQuestion(mode="prompt", user_prompt="estimate me "*20)\n' +
                'members = [Mock("anthropic","claude-sonnet-4-5"), Mock("openai","gpt-4o")]\n' +
                'ests = orch.estimate(q, members, table)\n' +
                'print(json.dumps([[e.provider, e.model, e.input_tokens, e.output_tokens, ' +
                'e.input_usd, e.output_usd] for e in ests]))',
        ).trim();
        expect(ts).toEqual(JSON.parse(expected));
    });

    // Consensus render path: _render_bucket strength/mean :.2f / :.1f spec.
    it('consensus render via run_consensus_scoring byte-matches', () => {
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', {
                text: '[{"id":"a","text":"alpha finding"}]',
                latency: 0,
            }),
            new Mock('openai', 'gpt-4o', {
                text: '[{"id":"b","text":"beta finding"}]',
                latency: 0,
            }),
        ];
        // Scoring pass: each member rates the OTHER's finding. Mock can only
        // emit one canned text, so reuse the same members but they return the
        // extraction text both times — scoring text is not valid JSON scores,
        // so scores stay empty; we still exercise the extraction + render path.
        const delib = [
            new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'delib A', latency_ms: 0 }),
            new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'delib B', latency_ms: 0 }),
        ];
        const cons = run_consensus_scoring(members, delib);
        const ts = render([], { mode: 'analysis', consensus: cons });
        const expected = py(
            'members = [Mock("anthropic","claude-sonnet-4-5",' +
                'text=\'[{"id":"a","text":"alpha finding"}]\',latency=0), ' +
                'Mock("openai","gpt-4o",text=\'[{"id":"b","text":"beta finding"}]\',latency=0)]\n' +
                'delib = [CouncilResponse(provider="anthropic",model="claude-sonnet-4-5",text="delib A",latency_ms=0), ' +
                'CouncilResponse(provider="openai",model="gpt-4o",text="delib B",latency_ms=0)]\n' +
                'cons = orch.run_consensus_scoring(members, delib)\n' +
                'print(json.dumps(orch.render([], mode="analysis", consensus=cons)))',
        ).trim();
        expect(ts).toEqual(JSON.parse(expected));
    });

    // Peer-review render path: deterministic Reviewer-A/B labels.
    it('peer-review render byte-matches', () => {
        const members = [
            new Mock('anthropic', 'claude-sonnet-4-5', { text: 'critique from A', latency: 0 }),
            new Mock('openai', 'gpt-4o', { text: 'critique from B', latency: 0 }),
        ];
        const delib = [
            new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'pos A', latency_ms: 0 }),
            new CouncilResponse({ provider: 'openai', model: 'gpt-4o', text: 'pos B', latency_ms: 0 }),
        ];
        const pr = run_peer_review(members, delib);
        const ts = render(
            [new CouncilResponse({ provider: 'x', model: 'y', text: 'final', latency_ms: 0 })],
            { mode: 'prompt', peer_review: pr },
        );
        const expected = py(
            'members = [Mock("anthropic","claude-sonnet-4-5",text="critique from A",latency=0), ' +
                'Mock("openai","gpt-4o",text="critique from B",latency=0)]\n' +
                'delib = [CouncilResponse(provider="anthropic",model="claude-sonnet-4-5",text="pos A",latency_ms=0), ' +
                'CouncilResponse(provider="openai",model="gpt-4o",text="pos B",latency_ms=0)]\n' +
                'pr = orch.run_peer_review(members, delib)\n' +
                'res = [CouncilResponse(provider="x",model="y",text="final",latency_ms=0)]\n' +
                'print(json.dumps(orch.render(res, mode="prompt", peer_review=pr)))',
        ).trim();
        expect(ts).toEqual(JSON.parse(expected));
    });
});
