// Tests for src/scripts/_lib/bench_ab_activation.ts — deltas #1–#4 of the S0.3
// harness-feasibility spike (road-to-solution-minimalism Phase 3 prerequisites).
//
// The whole point of this module is to catch a sweep that LOOKS fine, so every
// positive case is paired with a negative one that must NOT fire. Without the
// negatives these would be tautologies: an audit that flags everything and an
// audit that flags nothing both "pass" a positive-only suite.
import { describe, expect, it } from 'vitest';

import {
    ACTIVATION_MIN_LIFT_RATIO,
    SweepBudget,
    activation_verdict,
    audit_activation,
    cost_usd,
    expected_injection,
    is_bare_alias,
    normalize_model_id,
    prompt_tokens,
    tier_for_model,
    verify_model_id,
    type TierRates,
    type TokensBreakdown,
} from '../../src/scripts/_lib/bench_ab_activation.js';

const SONNET: TierRates = { input: 3.0, output: 15.0, cache_write: 3.75, cache_read: 0.3 };

function tb(over: Partial<TokensBreakdown> = {}): TokensBreakdown {
    return {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        ...over,
    };
}

/** One trial record in the shape `collect_records` writes. */
function run(over: Record<string, unknown> = {}): Record<string, unknown> {
    return { seed: 0, errored: false, tokens_breakdown: tb({ input_tokens: 1000 }), ...over };
}

function record(id: string, arms: Record<string, Record<string, unknown>[]>): Record<string, unknown> {
    return { id, arms };
}

describe('prompt_tokens', () => {
    it('sums the three prompt-side buckets', () => {
        expect(
            prompt_tokens(tb({ input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 30 })),
        ).toBe(60);
    });

    it('EXCLUDES output tokens — a bigger system prompt does not reliably change them', () => {
        expect(prompt_tokens(tb({ input_tokens: 10, output_tokens: 9999 }))).toBe(10);
    });

    it('treats a missing or empty breakdown as zero rather than throwing', () => {
        expect(prompt_tokens(undefined)).toBe(0);
        expect(prompt_tokens({})).toBe(0);
    });
});

describe('expected_injection', () => {
    it('classifies the three real arm shapes', () => {
        // vanilla: settings scoped away, no text → the baseline.
        expect(expected_injection({ setting_sources: 'project,local', inject: null })).toBe('none');
        // package: rides global settings — invisible to injected_chars.
        expect(expected_injection({ setting_sources: null, inject: null })).toBe('plugin');
        // placebo / rules-*: a file the harness wrote.
        expect(expected_injection({ setting_sources: 'project,local', inject: 'placebo' })).toBe('text');
    });

    it('lets the text channel win when an arm carries both', () => {
        expect(expected_injection({ setting_sources: null, inject: 'hardened' })).toBe('text');
    });
});

describe('activation_verdict', () => {
    it('passes a text arm that carried its injection', () => {
        const v = activation_verdict({
            expected: 'text',
            tokens_breakdown: tb({ input_tokens: 5000 }),
            injected_chars: 2000,
            errored: false,
        });
        expect(v.verdict).toBe('ok');
    });

    it('flags a text arm that carried NO injection', () => {
        const v = activation_verdict({
            expected: 'text',
            tokens_breakdown: tb({ input_tokens: 5000 }),
            injected_chars: 0,
            errored: false,
        });
        expect(v.verdict).toBe('violation');
        expect(v.reason).toContain('no injection');
    });

    it('flags a baseline arm that unexpectedly carried one', () => {
        const v = activation_verdict({
            expected: 'none',
            tokens_breakdown: tb({ input_tokens: 5000 }),
            injected_chars: 2000,
            errored: false,
        });
        expect(v.verdict).toBe('violation');
        expect(v.reason).toContain('2000-char injection');
    });

    it('passes a plugin arm: injected_chars is 0 BY CONSTRUCTION there, not a fault', () => {
        const v = activation_verdict({
            expected: 'plugin',
            tokens_breakdown: tb({ input_tokens: 90_000 }),
            injected_chars: 0,
            errored: false,
        });
        expect(v.verdict).toBe('ok');
    });

    it('returns unknown — never violation — for an errored run', () => {
        const v = activation_verdict({
            expected: 'text',
            tokens_breakdown: tb({ input_tokens: 5000 }),
            injected_chars: 0,
            errored: true,
        });
        expect(v.verdict).toBe('unknown');
    });

    it('returns unknown when the usage block is zeroed (budget-capped run)', () => {
        const v = activation_verdict({ expected: 'plugin', tokens_breakdown: tb(), injected_chars: 0, errored: false });
        expect(v.verdict).toBe('unknown');
    });
});

describe('audit_activation — the paired plugin direction', () => {
    const healthy = [
        record('t1', {
            vanilla: [run({ tokens_breakdown: tb({ input_tokens: 10_000 }) })],
            package: [run({ tokens_breakdown: tb({ input_tokens: 90_000 }) })],
        }),
    ];

    it('passes a sweep where the treatment arm carries a real footprint lift', () => {
        const a = audit_activation(healthy, { baseline_arm: 'vanilla', lift_arms: ['package'] });
        expect(a.violations).toEqual([]);
        expect(a.checked).toBe(1);
    });

    it('flags a treatment arm that COLLAPSED to the baseline footprint', () => {
        // The canonical failure: the plugin is disabled or version-drifted, so
        // every treatment run silently degrades to vanilla and the report looks
        // identical to a real one.
        const collapsed = [
            record('t1', {
                vanilla: [run({ tokens_breakdown: tb({ input_tokens: 10_000 }) })],
                package: [run({ tokens_breakdown: tb({ input_tokens: 10_100 }) })],
            }),
        ];
        const a = audit_activation(collapsed, { baseline_arm: 'vanilla', lift_arms: ['package'] });
        expect(a.violations).toHaveLength(1);
        expect(a.violations[0]!.kind).toBe('collapsed-to-baseline');
        expect(a.violations[0]!.arm).toBe('package');
    });

    it('does NOT fire just above the threshold — ordinary variance is not a violation', () => {
        const base = 10_000;
        const justOver = Math.ceil(base * ACTIVATION_MIN_LIFT_RATIO) + 1;
        const marginal = [
            record('t1', {
                vanilla: [run({ tokens_breakdown: tb({ input_tokens: base }) })],
                package: [run({ tokens_breakdown: tb({ input_tokens: justOver }) })],
            }),
        ];
        expect(audit_activation(marginal, { baseline_arm: 'vanilla', lift_arms: ['package'] }).violations).toEqual([]);
    });

    it('skips a pair whose baseline errored instead of judging it', () => {
        const halfDead = [
            record('t1', {
                vanilla: [run({ errored: true })],
                package: [run({ tokens_breakdown: tb({ input_tokens: 90_000 }) })],
            }),
        ];
        const a = audit_activation(halfDead, { baseline_arm: 'vanilla', lift_arms: ['package'] });
        expect(a.violations).toEqual([]);
        expect(a.skipped).toBe(1);
        expect(a.checked).toBe(0);
    });

    it('pairs by seed, never across seeds', () => {
        const twoSeeds = [
            record('t1', {
                vanilla: [
                    run({ seed: 0, tokens_breakdown: tb({ input_tokens: 10_000 }) }),
                    run({ seed: 1, tokens_breakdown: tb({ input_tokens: 80_000 }) }),
                ],
                // seed 1 collapses against ITS OWN baseline (80k), even though it
                // dwarfs seed 0's baseline.
                package: [
                    run({ seed: 0, tokens_breakdown: tb({ input_tokens: 90_000 }) }),
                    run({ seed: 1, tokens_breakdown: tb({ input_tokens: 81_000 }) }),
                ],
            }),
        ];
        const a = audit_activation(twoSeeds, { baseline_arm: 'vanilla', lift_arms: ['package'] });
        expect(a.violations).toHaveLength(1);
        expect(a.violations[0]!.seed).toBe(1);
    });

    it('surfaces a stamped per-trial violation from the record', () => {
        const stamped = [
            record('t1', {
                placebo: [run({ activation: { verdict: 'violation', reason: 'text arm carried no injection' } })],
            }),
        ];
        const a = audit_activation(stamped, { baseline_arm: 'vanilla', lift_arms: [] });
        expect(a.violations).toHaveLength(1);
        expect(a.violations[0]!.kind).toBe('text-injection-missing');
    });

    it('surfaces a model mismatch stamped on the record', () => {
        const stamped = [
            record('t1', {
                package: [run({ model_check: { ok: false, reason: 'requested X but envelope billed Y' } })],
            }),
        ];
        const a = audit_activation(stamped, { baseline_arm: 'vanilla', lift_arms: [] });
        expect(a.violations).toHaveLength(1);
        expect(a.violations[0]!.kind).toBe('model-mismatch');
    });

    it('stays silent on a record whose model_check passed', () => {
        const stamped = [record('t1', { package: [run({ model_check: { ok: true, reason: 'matches' } })] })];
        expect(audit_activation(stamped, { baseline_arm: 'vanilla', lift_arms: [] }).violations).toEqual([]);
    });
});

describe('model-id verification', () => {
    it('recognises the bare aliases that make a report unreproducible', () => {
        expect(is_bare_alias('sonnet')).toBe(true);
        expect(is_bare_alias('SONNET')).toBe(true);
        expect(is_bare_alias('opus')).toBe(true);
        expect(is_bare_alias('claude-sonnet-4-6')).toBe(false);
    });

    it('normalises away a trailing build stamp', () => {
        expect(normalize_model_id('claude-sonnet-4-5-20250929')).toBe('claude-sonnet-4-5');
        expect(normalize_model_id('claude-sonnet-4-5')).toBe('claude-sonnet-4-5');
    });

    it('refuses a bare alias outright', () => {
        expect(verify_model_id('sonnet', ['claude-sonnet-4-5']).ok).toBe(false);
    });

    it('accepts a dated id against its undated request', () => {
        expect(verify_model_id('claude-sonnet-4-5', ['claude-sonnet-4-5-20250929']).ok).toBe(true);
    });

    it('refuses a genuine mid-sweep model swap', () => {
        const v = verify_model_id('claude-sonnet-4-5', ['claude-opus-4-8']);
        expect(v.ok).toBe(false);
        expect(v.reason).toContain('claude-opus-4-8');
    });

    it('refuses when only SOME runs were billed to the requested model', () => {
        expect(verify_model_id('claude-sonnet-4-5', ['claude-sonnet-4-5', 'claude-haiku-4-5']).ok).toBe(false);
    });

    it('accepts an envelope that reported no model usage — a reporting gap is not a mismatch', () => {
        expect(verify_model_id('claude-sonnet-4-5', []).ok).toBe(true);
    });
});

describe('cost', () => {
    it('maps full model ids onto pricing tiers, and returns null for an unknown one', () => {
        expect(tier_for_model('claude-sonnet-4-6')).toBe('sonnet');
        expect(tier_for_model('claude-haiku-4-5-20251001')).toBe('haiku');
        expect(tier_for_model('gpt-4o')).toBeNull();
    });

    it('prices the four buckets separately — a blended rate is a DIFFERENT number', () => {
        const b = tb({ input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 });
        // Per-bucket: 1M × $3.00 + 1M × $0.30 = $3.30.
        expect(cost_usd(b, SONNET)).toBeCloseTo(3.3, 6);
        // A blended input rate over the summed 2M would say $6.00 — 1.8× off.
        expect(cost_usd(b, SONNET)).not.toBeCloseTo(6.0, 2);
    });
});

describe('SweepBudget', () => {
    it('aborts on the run that crosses the cap, not before', () => {
        const budget = new SweepBudget(5.0, SONNET);
        // $3.00 per 1M input tokens → two runs of 1M each = $6.00 total.
        expect(budget.add(tb({ input_tokens: 1_000_000 }))).toBeNull();
        expect(budget.spent_usd).toBeCloseTo(3.0, 6);
        const abort = budget.add(tb({ input_tokens: 1_000_000 }));
        expect(abort).toContain('sweep budget abort');
        expect(abort).toContain('6.00');
    });

    it('never aborts without a cap — the pre-existing uncapped behaviour is preserved', () => {
        const budget = new SweepBudget(null, SONNET);
        for (let i = 0; i < 100; i += 1) {
            expect(budget.add(tb({ input_tokens: 1_000_000 }))).toBeNull();
        }
        expect(budget.spent_usd).toBeCloseTo(300.0, 4);
    });

    it('stays inert when no pricing row matched the model', () => {
        const budget = new SweepBudget(1.0, null);
        expect(budget.add(tb({ input_tokens: 10_000_000 }))).toBeNull();
        expect(budget.spent_usd).toBe(0);
    });
});
