// Tests for src/scripts/ai_council/low_impact.ts (py2ts Phase 1, ADR-094).
//
// low_impact is the lightweight-QA fast-path resolver: it narrows the council
// fan-out to opted-in members, caps spend, runs one round, and stamps a
// transparency marker. It is a pure library (no __main__ / argparse / stdout)
// — so there is no `--help` surface to byte-compare. Parity is asserted on the
// public surfaces with STUBBED transport.
//
// The load-bearing contract is the `fast-path-marker-visibility` Iron Law: the
// four markers (resolved / unavailable / split / aborted) are reproduced
// BYTE-FOR-BYTE. Each is asserted exactly against the live Python twin.
//
// Transport stub: tests subclass `ExternalAIClient` (TS) / build duck-typed
// mock objects (Python) whose `ask()` returns a canned `CouncilResponse`
// without any live network call — mirroring how clients.ts seams the
// transport. Members are duck-typed `MemberConfig`-shaped objects; the config
// is a duck-typed `LowImpactFastPathConfig`-shaped object (only max_members /
// max_tokens / max_cost_usd are read by the planner).
//
// Golden parity drives the LIVE Python twin via a `python3 -c` importlib
// direct-file load. low_impact.py imports its siblings at module top
// (`from scripts.ai_council...`), so the loader runs with PYTHONPATH=src:.
// (mirroring pyproject `pythonpath = ["src", "."]`); the siblings lazy-import
// their SDKs inside `ask()`, so no network at import time.
//
// Normalisation (ADR-094):
// - The clock is injected (`now=...`) on both sides → the ISO8601 timestamp in
//   the session-log line is deterministic; no timestamp normalisation needed.
// - `latency_ms` never reaches a compared surface (markers + log line don't
//   carry it).
// - One intentional divergence (cited at its assertion): the `client raised:
//   <repr>` member-error string differs between Python `RuntimeError('boom')`
//   and JS `Error('boom')`. It is NOT a marker surface — the aborted marker
//   carries only `members tried: <names>`, so every compared marker stays
//   byte-identical. The error-string field itself is asserted structurally
//   (prefix + member), not byte-compared, for that one path.
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import type { LowImpactFastPathConfig, MemberConfig } from '../../../src/scripts/ai_council/config.js';
import {
    build_fast_path_budget,
    classify_impact_with_corpus_fuzzy,
    FastPathPlan,
    LowImpactStats,
    parse_low_impact_log,
    plan_fast_path,
    render_low_impact_stats,
    resolve_low_impact,
    select_fast_path_members,
} from '../../../src/scripts/ai_council/low_impact.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

// ── Python driver: importlib direct-file load + duck-typed mock member ────
//
// `Mem` is a MemberConfig-shaped duck; `Cfg` a LowImpactFastPathConfig-shaped
// duck; `Mock` an ExternalAIClient-shaped duck whose ask() returns a canned
// response. A fixed clock is passed so the session-log timestamp is stable.
const PY_PREAMBLE = `
import importlib.util, sys, json
from datetime import datetime, timezone
_spec = importlib.util.spec_from_file_location("li", "src/scripts/ai_council/low_impact.py")
li = importlib.util.module_from_spec(_spec)
sys.modules["li"] = li
_spec.loader.exec_module(li)
from scripts.ai_council.clients import CouncilResponse

class Mem:
    def __init__(self, name, enabled=True, pli=True):
        self.name = name; self.enabled = enabled; self.participate_low_impact = pli
        self.model = "m"; self.api_key_ref = None

class Cfg:
    def __init__(self, max_members=2, max_tokens=400, max_cost_usd=0.05):
        self.max_members = max_members; self.max_tokens = max_tokens
        self.max_cost_usd = max_cost_usd

class Mock:
    def __init__(self, name, model="m", text="", err=None, it=10, ot=20, raises=False):
        self.name = name; self.model = model; self._t = text; self._e = err
        self._it = it; self._ot = ot; self._raises = raises
        self.billable = True; self.transport = "api"; self.subscription_label = ""
    def ask(self, sp, up, max_tokens=None):
        if self._raises:
            raise RuntimeError("boom")
        return CouncilResponse(provider=self.name, model=self.model, text=self._t,
                               error=self._e, input_tokens=self._it, output_tokens=self._ot)

FIXED = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
CLOCK = lambda: FIXED
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

// ── TS stubs (mirror the Python ducks) ───────────────────────────────────

function mem(name: string, enabled = true, pli = true): MemberConfig {
    return {
        name,
        enabled,
        participate_low_impact: pli,
        model: 'm',
        api_key_ref: null,
        mode: null,
        binary: null,
        model_ladder: [],
    };
}

function cfg(max_members = 2, max_tokens = 400, max_cost_usd = 0.05): LowImpactFastPathConfig {
    return {
        max_members,
        max_rounds: 1,
        max_tokens,
        max_cost_usd,
        // `build_fast_path_budget` never reads fuzzy_match; cast to keep the
        // duck minimal (mirrors the Python `Cfg` which omits it too).
    } as unknown as LowImpactFastPathConfig;
}

interface MockArgs {
    model?: string;
    text?: string;
    error?: string | null;
    it?: number;
    ot?: number;
    raises?: boolean;
}

class Mock extends ExternalAIClient {
    private readonly _t: string;
    private readonly _e: string | null;
    private readonly _it: number;
    private readonly _ot: number;
    private readonly _raises: boolean;

    constructor(name: string, args: MockArgs = {}) {
        super();
        this.name = name;
        this.model = args.model ?? 'm';
        this._t = args.text ?? '';
        this._e = args.error ?? null;
        this._it = args.it ?? 10;
        this._ot = args.ot ?? 20;
        this._raises = args.raises ?? false;
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
        });
    }
}

// Fixed UTC clock matching the Python `FIXED` instant 2026-01-02T03:04:05Z.
const CLOCK = (): Date => new Date(Date.UTC(2026, 0, 2, 3, 4, 5));

// ───────────────────────────────────────────────────────────────────────
// The four markers — byte-for-byte parity (the Iron-Law surface).
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — fast-path markers (byte-for-byte)', () => {
    it('UNAVAILABLE marker — no opted-in members', () => {
        const plan = plan_fast_path({}, cfg());
        const res = resolve_low_impact('q', plan, {});
        expect(res.status).toBe('unavailable');
        expect(res.marker).toBe(
            '> Low-impact council unavailable (no opted-in members) — escalating to user.',
        );
        expect(res.session_log_line).toBe('');
    });

    it.runIf(py3)('UNAVAILABLE marker matches python3', () => {
        const plan = plan_fast_path({}, cfg());
        const res = resolve_low_impact('q', plan, {});
        const out = py(
            'plan = li.plan_fast_path({}, Cfg())\n' +
                'r = li.resolve_low_impact("q", plan, {})\n' +
                'print(json.dumps({"status": r.status, "marker": r.marker, "log": r.session_log_line}))\n',
        );
        expect({ status: res.status, marker: res.marker, log: res.session_log_line }).toEqual(
            JSON.parse(out),
        );
    });

    it('RESOLVED marker — single member', () => {
        const plan = plan_fast_path({ anthropic: mem('anthropic') }, cfg(1));
        const clients = { anthropic: new Mock('anthropic', { text: 'use a DTO\nclearer contract' }) };
        const res = resolve_low_impact('dto or array?', plan, clients, null, CLOCK);
        expect(res.status).toBe('resolved');
        expect(res.marker).toBe(
            '> Resolved via low-impact council fast-path: single-member answer.',
        );
        expect(res.answer).toBe('use a DTO\nclearer contract');
    });

    it('RESOLVED marker — 2-member consensus', () => {
        const plan = plan_fast_path({ anthropic: mem('anthropic'), openai: mem('openai') }, cfg(2));
        const clients = {
            anthropic: new Mock('anthropic', { text: 'Use a DTO.\nClearer.' }),
            openai: new Mock('openai', { text: 'use a dto\ndifferent rationale' }),
        };
        const res = resolve_low_impact('dto?', plan, clients, null, CLOCK);
        expect(res.status).toBe('resolved');
        expect(res.marker).toBe(
            '> Resolved via low-impact council fast-path: 2-member consensus.',
        );
    });

    it('SPLIT marker — 2 members disagree', () => {
        const plan = plan_fast_path({ anthropic: mem('anthropic'), openai: mem('openai') }, cfg(2));
        const clients = {
            anthropic: new Mock('anthropic', { text: 'use a DTO' }),
            openai: new Mock('openai', { text: 'use an array' }),
        };
        const res = resolve_low_impact('dto?', plan, clients, null, CLOCK);
        expect(res.status).toBe('split');
        expect(res.marker).toBe(
            '> Low-impact council split — escalating to user (anthropic: use a DTO / openai: use an array):',
        );
    });

    it('ABORTED marker — all members failed', () => {
        const plan = plan_fast_path({ anthropic: mem('anthropic'), openai: mem('openai') }, cfg(2));
        const clients = {
            anthropic: new Mock('anthropic', { error: 'rate limited' }),
            openai: new Mock('openai', { text: '' }), // empty → error "empty response"
        };
        const res = resolve_low_impact('dto?', plan, clients, null, CLOCK);
        expect(res.status).toBe('aborted');
        expect(res.marker).toBe(
            '> Low-impact council aborted (all members failed) — escalating to user: members tried: anthropic, openai.',
        );
    });

    it.runIf(py3)('all four markers + answer + log match python3', () => {
        // Drive resolved(single), resolved(consensus), split, aborted on both
        // sides with the SAME stubbed transport + fixed clock.
        const tsCases: unknown[] = [];

        // resolved single
        {
            const plan = plan_fast_path({ a: mem('a') }, cfg(1));
            const r = resolve_low_impact('q', plan, { a: new Mock('a', { text: 'ans\nwhy' }) }, null, CLOCK);
            tsCases.push({ status: r.status, marker: r.marker, answer: r.answer, log: r.session_log_line });
        }
        // resolved consensus
        {
            const plan = plan_fast_path({ a: mem('a'), b: mem('b') }, cfg(2));
            const r = resolve_low_impact(
                'q',
                plan,
                { a: new Mock('a', { text: 'Yes.\nx' }), b: new Mock('b', { text: 'yes\ny' }) },
                null,
                CLOCK,
            );
            tsCases.push({ status: r.status, marker: r.marker, answer: r.answer, log: r.session_log_line });
        }
        // split
        {
            const plan = plan_fast_path({ a: mem('a'), b: mem('b') }, cfg(2));
            const r = resolve_low_impact(
                'q',
                plan,
                { a: new Mock('a', { text: 'yes' }), b: new Mock('b', { text: 'no' }) },
                null,
                CLOCK,
            );
            tsCases.push({ status: r.status, marker: r.marker, answer: r.answer, log: r.session_log_line });
        }
        // aborted
        {
            const plan = plan_fast_path({ a: mem('a'), b: mem('b') }, cfg(2));
            const r = resolve_low_impact(
                'q',
                plan,
                { a: new Mock('a', { error: 'rate limited' }), b: new Mock('b', { text: '' }) },
                null,
                CLOCK,
            );
            tsCases.push({ status: r.status, marker: r.marker, answer: r.answer, log: r.session_log_line });
        }

        const out = py(
            'cases = []\n' +
                'plan = li.plan_fast_path({"a": Mem("a")}, Cfg(max_members=1))\n' +
                'r = li.resolve_low_impact("q", plan, {"a": Mock("a", text="ans\\nwhy")}, now=CLOCK)\n' +
                'cases.append({"status": r.status, "marker": r.marker, "answer": r.answer, "log": r.session_log_line})\n' +
                'plan = li.plan_fast_path({"a": Mem("a"), "b": Mem("b")}, Cfg(max_members=2))\n' +
                'r = li.resolve_low_impact("q", plan, {"a": Mock("a", text="Yes.\\nx"), "b": Mock("b", text="yes\\ny")}, now=CLOCK)\n' +
                'cases.append({"status": r.status, "marker": r.marker, "answer": r.answer, "log": r.session_log_line})\n' +
                'plan = li.plan_fast_path({"a": Mem("a"), "b": Mem("b")}, Cfg(max_members=2))\n' +
                'r = li.resolve_low_impact("q", plan, {"a": Mock("a", text="yes"), "b": Mock("b", text="no")}, now=CLOCK)\n' +
                'cases.append({"status": r.status, "marker": r.marker, "answer": r.answer, "log": r.session_log_line})\n' +
                'plan = li.plan_fast_path({"a": Mem("a"), "b": Mem("b")}, Cfg(max_members=2))\n' +
                'r = li.resolve_low_impact("q", plan, {"a": Mock("a", err="rate limited"), "b": Mock("b", text="")}, now=CLOCK)\n' +
                'cases.append({"status": r.status, "marker": r.marker, "answer": r.answer, "log": r.session_log_line})\n' +
                'print(json.dumps(cases))\n',
        );
        expect(tsCases).toEqual(JSON.parse(out));
    });
});

// ───────────────────────────────────────────────────────────────────────
// Planner surfaces — plan marker, budget, member selection.
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — plan_fast_path / select / budget', () => {
    it('selects enabled+opted-in, alphabetical, truncated to max_members', () => {
        const members = {
            zeta: mem('zeta'),
            alpha: mem('alpha'),
            beta_off: mem('beta', false, true),
            gamma_noopt: mem('gamma', true, false),
        };
        const picked = select_fast_path_members(members, cfg(2)).map((m) => m.name);
        expect(picked).toEqual(['alpha', 'zeta']);
    });

    it('budget — 60/40 split, max_calls=max_members', () => {
        const b = build_fast_path_budget(cfg(2, 400, 0.05));
        expect(b.max_input_tokens).toBe(240); // int(400*0.6)
        expect(b.max_output_tokens).toBe(160);
        expect(b.max_calls).toBe(2);
        expect(b.max_total_usd).toBeCloseTo(0.05, 12);
    });

    it('plan marker (resolvable) + reason (unavailable)', () => {
        const plan = plan_fast_path({ openai: mem('openai'), anthropic: mem('anthropic') }, cfg(2, 400, 0.05));
        expect(plan.is_resolvable).toBe(true);
        expect(plan.marker).toBe('[fast-path: 2 members (anthropic, openai) · cap $0.05 · 400 tokens]');

        const none = plan_fast_path({ a: mem('a', true, false) }, cfg());
        expect(none.is_resolvable).toBe(false);
        expect(none.marker).toBe('');
        expect(none.reason).toContain('participate_low_impact: true');
    });

    it.runIf(py3)('plan marker + budget fields match python3', () => {
        const plan = plan_fast_path({ openai: mem('openai'), anthropic: mem('anthropic') }, cfg(1, 250, 0.123));
        const tsView = {
            marker: plan.marker,
            members: plan.members.map((m) => m.name),
            in: plan.budget.max_input_tokens,
            out: plan.budget.max_output_tokens,
            calls: plan.budget.max_calls,
            usd: plan.budget.max_total_usd,
        };
        const out = py(
            'plan = li.plan_fast_path({"openai": Mem("openai"), "anthropic": Mem("anthropic")}, Cfg(max_members=1, max_tokens=250, max_cost_usd=0.123))\n' +
                'print(json.dumps({"marker": plan.marker, "members": [m.name for m in plan.members],' +
                ' "in": plan.budget.max_input_tokens, "out": plan.budget.max_output_tokens,' +
                ' "calls": plan.budget.max_calls, "usd": plan.budget.max_total_usd}))\n',
        );
        expect(tsView).toEqual(JSON.parse(out));
    });
});

// ───────────────────────────────────────────────────────────────────────
// Cost-cap abort — over-budget answer is refused.
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — cost cap', () => {
    // A duck-typed price table: charges $1/1M tokens both ways.
    const priceTable = {
        lookup() {
            return { input_per_1m_usd: 1_000_000, output_per_1m_usd: 1_000_000 };
        },
    };

    it('over-budget member → aborted (no ok answer survives)', () => {
        const plan = plan_fast_path({ a: mem('a') }, cfg(1, 400, 0.01));
        // it=10, ot=20 → cost = 30 USD ≫ cap 0.01 → refused, no ok answer.
        const res = resolve_low_impact('q', plan, { a: new Mock('a', { text: 'x' }) }, priceTable, CLOCK);
        expect(res.status).toBe('aborted');
        expect(res.marker).toBe(
            '> Low-impact council aborted (all members failed) — escalating to user: members tried: a.',
        );
    });

    it.runIf(py3)('cost-cap abort matches python3', () => {
        const plan = plan_fast_path({ a: mem('a') }, cfg(1, 400, 0.01));
        const res = resolve_low_impact('q', plan, { a: new Mock('a', { text: 'x' }) }, priceTable, CLOCK);
        const out = py(
            'class PT:\n' +
                '    def lookup(self, p, m):\n' +
                '        class P: input_per_1m_usd = 1000000; output_per_1m_usd = 1000000\n' +
                '        return P()\n' +
                'plan = li.plan_fast_path({"a": Mem("a")}, Cfg(max_members=1, max_tokens=400, max_cost_usd=0.01))\n' +
                'r = li.resolve_low_impact("q", plan, {"a": Mock("a", text="x")}, price_table=PT(), now=CLOCK)\n' +
                'print(json.dumps({"status": r.status, "marker": r.marker}))\n',
        );
        expect({ status: res.status, marker: res.marker }).toEqual(JSON.parse(out));
    });
});

// ───────────────────────────────────────────────────────────────────────
// Missing-client + raising-client (the one cited divergence).
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — member failure paths', () => {
    it('missing client → recorded as failure, aborted marker stays byte-stable', () => {
        const plan = plan_fast_path({ a: mem('a') }, cfg(1));
        const res = resolve_low_impact('q', plan, {}, null, CLOCK); // no client for "a"
        expect(res.status).toBe('aborted');
        expect(res.answers[0]!.error).toBe('no client instantiated');
        expect(res.marker).toBe(
            '> Low-impact council aborted (all members failed) — escalating to user: members tried: a.',
        );
    });

    it('raising client → error recorded (repr divergence is non-marker)', () => {
        const plan = plan_fast_path({ a: mem('a') }, cfg(1));
        const res = resolve_low_impact('q', plan, { a: new Mock('a', { raises: true }) }, null, CLOCK);
        expect(res.status).toBe('aborted');
        // INTENTIONAL DIVERGENCE (ADR-094): the `client raised: <repr>` string
        // differs (Python `RuntimeError('boom')` vs JS `Error('boom')`). It is
        // NOT a marker surface, so the aborted marker stays byte-identical —
        // assert the error structurally, the marker byte-for-byte.
        expect(res.answers[0]!.error).toMatch(/^client raised: /);
        expect(res.marker).toBe(
            '> Low-impact council aborted (all members failed) — escalating to user: members tried: a.',
        );
    });
});

// ───────────────────────────────────────────────────────────────────────
// Stats parse / render over the session-log shape.
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — parse_low_impact_log / render_low_impact_stats', () => {
    const LOG = [
        '# header that should be skipped',
        '2026-01-02T03:04:05Z | resolved | members=1/1 | members(anthropic) cost=$0.0010 | Q=dto?',
        '2026-01-02T03:04:06Z | split | members=2/2 | members(anthropic, openai) cost=$0.0500 | Q=array?',
        'not a log line at all',
        '2026-01-02T03:04:07Z | resolved | members=2/2 | members(openai, anthropic) cost=$0.0000 | Q=trait?',
    ].join('\n');

    it('parses counts + sorted maps + rounded cost', () => {
        const stats = parse_low_impact_log(LOG);
        expect(stats.total).toBe(3);
        expect(Object.fromEntries(stats.by_status)).toEqual({ resolved: 2, split: 1 });
        expect(Object.fromEntries(stats.by_member)).toEqual({ anthropic: 3, openai: 2 });
        expect(stats.total_cost_usd).toBeCloseTo(0.051, 12);
        // insertion order = sorted-key order
        expect([...stats.by_status.keys()]).toEqual(['resolved', 'split']);
        expect([...stats.by_member.keys()]).toEqual(['anthropic', 'openai']);
    });

    it('renders the summary block', () => {
        const stats = parse_low_impact_log(LOG);
        const rendered = render_low_impact_stats(stats);
        expect(rendered).toBe(
            '# Low-impact fast-path · session summary\n' +
                '\n' +
                '- attempts: 3\n' +
                '- status: resolved=2 · split=1\n' +
                '- members: anthropic=3 · openai=2\n' +
                '- total cost: $0.0510\n',
        );
    });

    it('empty body → zeroed stats + (none) status', () => {
        const stats = parse_low_impact_log('');
        expect(stats.total).toBe(0);
        const rendered = render_low_impact_stats(stats);
        expect(rendered).toBe(
            '# Low-impact fast-path · session summary\n\n- attempts: 0\n- status: (none)\n- total cost: $0.0000\n',
        );
    });

    it.runIf(py3)('parse + render match python3', () => {
        const stats = parse_low_impact_log(LOG);
        const tsView = {
            total: stats.total,
            by_status: Object.fromEntries(stats.by_status),
            by_member: Object.fromEntries(stats.by_member),
            cost: stats.total_cost_usd,
            rendered: render_low_impact_stats(stats),
        };
        const out = py(
            `log = ${JSON.stringify(LOG)}\n` +
                's = li.parse_low_impact_log(log)\n' +
                'print(json.dumps({"total": s.total, "by_status": s.by_status,' +
                ' "by_member": s.by_member, "cost": s.total_cost_usd,' +
                ' "rendered": li.render_low_impact_stats(s)}))\n',
        );
        expect(tsView).toEqual(JSON.parse(out));
    });
});

// ───────────────────────────────────────────────────────────────────────
// Stats class — direct construction (insertion-order semantics).
// ───────────────────────────────────────────────────────────────────────

describe('low_impact — LowImpactStats render', () => {
    it('no members → members line omitted', () => {
        const stats = new LowImpactStats({
            total: 1,
            by_status: new Map([['aborted', 1]]),
            by_member: new Map(),
            total_cost_usd: 0,
        });
        expect(render_low_impact_stats(stats)).toBe(
            '# Low-impact fast-path · session summary\n\n- attempts: 1\n- status: aborted=1\n- total cost: $0.0000\n',
        );
    });
});

// ───────────────────────────────────────────────────────────────────────
// Fuzzy corpus classifier — Iron-Law precedence + vetoes.
// ───────────────────────────────────────────────────────────────────────

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

describe('low_impact — classify_impact_with_corpus_fuzzy', () => {
    function writeCorpus(validated: string[], anti: string[]): { dir: string; file: string } {
        const dir = mkdtempSync(path.join(tmpdir(), 'li-corpus-'));
        const file = path.join(dir, 'low-impact-decisions.md');
        const body = [
            '## Validated',
            '',
            ...validated.map((v) => `- "${v}"`),
            '',
            '## Anti-Examples (Always Ask User)',
            '',
            ...anti.map((a) => `- "${a}"`),
            '',
        ].join('\n');
        writeFileSync(file, body, 'utf8');
        return { dir, file };
    }

    it('no corpus → base verdict', async () => {
        const v = await classify_impact_with_corpus_fuzzy('use a dto vs array', null);
        // "dto" is a low_impact trigger → base is already low_impact.
        expect(v.impact_class).toBe('low_impact');
        expect(v.category).not.toBe('corpus_validated_fuzzy');
    });

    it('locked class (high_impact) skips fuzzy entirely', async () => {
        const { dir, file } = writeCorpus(['rotate the secret api key'], []);
        try {
            const v = await classify_impact_with_corpus_fuzzy('rotate the secret api key', [file]);
            expect(v.impact_class).toBe('high_impact'); // veto never reached; base locked
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('near-paraphrase of a Validated phrase → corpus_validated_fuzzy', async () => {
        const { dir, file } = writeCorpus(['use composition over inheritance here'], []);
        try {
            const v = await classify_impact_with_corpus_fuzzy(
                'use composition over inheritance here.',
                [file],
                { threshold: 0.9 },
            );
            expect(v.impact_class).toBe('low_impact');
            expect(v.category).toBe('corpus_validated_fuzzy');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it.runIf(py3)('fuzzy classifier matches python3 across cases', async () => {
        const { dir, file } = writeCorpus(
            ['use composition over inheritance here', 'prefer a value object for money'],
            ['drop the production database now'],
        );
        try {
            const cases: Array<{ q: string; th: number }> = [
                { q: 'use composition over inheritance here.', th: 0.9 },
                { q: 'totally unrelated sentence about widgets', th: 0.9 },
                { q: 'prefer a value object for money', th: 0.92 },
                { q: '', th: 0.9 },
            ];
            const tsView = [];
            for (const c of cases) {
                const v = await classify_impact_with_corpus_fuzzy(c.q, [file], { threshold: c.th });
                tsView.push({
                    cls: v.impact_class,
                    conf: v.confidence,
                    rationale: v.rationale,
                    category: v.category,
                });
            }
            const out = py(
                `casesj = ${JSON.stringify(cases)}\n` +
                    `corpus = ${JSON.stringify(file)}\n` +
                    'res = []\n' +
                    'for c in casesj:\n' +
                    '    v = li.classify_impact_with_corpus_fuzzy(c["q"], (corpus,), threshold=c["th"])\n' +
                    '    res.append({"cls": v.impact_class, "conf": v.confidence,' +
                    ' "rationale": v.rationale, "category": v.category})\n' +
                    'print(json.dumps(res))\n',
            );
            expect(tsView).toEqual(JSON.parse(out));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// A no-op reference so `FastPathPlan` import is exercised by the type system.
void FastPathPlan;
