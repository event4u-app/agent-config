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
});

// A no-op reference so `FastPathPlan` import is exercised by the type system.
void FastPathPlan;
