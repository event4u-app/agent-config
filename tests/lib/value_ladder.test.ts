/**
 * Vitest twin of `tests/test_value_ladder.py` (the value_ladder portion) plus
 * a differential suite asserting the TS port and the Python original
 * (`src/scripts/_lib/value_ladder.py`) produce identical scoring / rung output
 * over a corpus of synthetic fixtures (ADR-088 py2ts Phase 2 / Wave 2a, parity
 * gate 2 — golden replay via the `python3` driver).
 *
 * Divergence candidates (latent-bug replications, flagged not fixed):
 *   - `latest_frugality_record` in value_report keeps a dict-only contract;
 *     a non-dict JSON line would crash both implementations downstream.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as L from '../../src/scripts/_lib/value_ladder.js';
import type { Dict, JsonValue } from '../../src/scripts/_lib/value_ladder.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DRIVER = path.join(ROOT, 'tests', 'lib', 'value_py_driver.py');

/** Invoke the Python reference for `fn(...args)` and return the decoded result. */
function py(fn: string, args: JsonValue[]): unknown {
    const out = execFileSync('python3', [DRIVER], {
        input: JSON.stringify({ fn, args }),
        encoding: 'utf-8',
    });
    return JSON.parse(out) as unknown;
}

// ── Shared fixtures (mirror the pytest fixtures) ─────────────────────────

const pricing_row_sonnet: Dict = {
    tier: 'sonnet',
    sourced_on: '2026-05-14',
    input: 3.0,
    output: 15.0,
};

const reference_scale: Dict = {
    requests: 1000,
    avg_input_tokens: 8000,
    avg_output_tokens: 600,
    model_tier: 'sonnet',
    pricing_sourced_on: '2026-05-14',
};

// ── Pricing ─────────────────────────────────────────────────────────────

describe('pricing', () => {
    it('test_price_input_delta_eur_positive', () => {
        const eur = L.price_input_delta_eur(100, reference_scale, pricing_row_sonnet);
        expect(eur).toBeCloseTo(0.276, 3);
    });

    it('test_price_input_delta_eur_negative', () => {
        const eur = L.price_input_delta_eur(-200, reference_scale, pricing_row_sonnet);
        expect(eur).toBeCloseTo(-0.552, 3);
    });

    it('test_price_output_delta_eur', () => {
        const eur = L.price_output_delta_eur(50, reference_scale, pricing_row_sonnet);
        expect(eur).toBeCloseTo(0.69, 3);
    });
});

// ── Pending rungs (missing input) ───────────────────────────────────────

describe('pending rungs on missing input', () => {
    it('test_load_rung_pending_on_missing', () => {
        const rung = L.load_rung_from_frugality(null, reference_scale, pricing_row_sonnet);
        expect(rung['id']).toBe('load');
        expect(rung['confidence']).toBe('pending');
        expect(rung['token_delta']).toBe(0);
        expect(String(rung['source_report'])).toContain('agents/runtime/frugality');
    });

    it('test_load_rung_from_router_pending_on_missing', () => {
        const rung = L.load_rung_from_router(null, null, 0, reference_scale, pricing_row_sonnet);
        expect(rung['id']).toBe('load');
        expect(rung['confidence']).toBe('pending');
        expect(rung['token_delta']).toBe(0);
        expect(String(rung['source_report'])).toContain('dist/router.json');
    });

    it('test_load_rung_from_router_pending_when_kernel_missing', () => {
        const rung = L.load_rung_from_router(
            { schema_version: 1 },
            {},
            0,
            reference_scale,
            pricing_row_sonnet,
        );
        expect(rung['confidence']).toBe('pending');
    });

    it('test_condense_rung_pending_on_missing', () => {
        const rung = L.condense_rung_from_telegraph_v2(null, 8000, reference_scale, pricing_row_sonnet);
        expect(rung['confidence']).toBe('pending');
        expect(rung['token_delta']).toBe(0);
    });

    it('test_rtk_rung_pending_on_missing', () => {
        const rung = L.rtk_rung_from_report(null, reference_scale, pricing_row_sonnet);
        expect(rung['confidence']).toBe('pending');
        expect(String(rung['footnote'])).toContain('Install rtk');
    });

    it('test_terse_rung_pending_on_missing', () => {
        const rung = L.terse_rung_from_telegraph_v1(null, reference_scale, pricing_row_sonnet);
        expect(rung['confidence']).toBe('pending');
    });
});

// ── load_rung_from_router (netto-cuts) ──────────────────────────────────

describe('load_rung_from_router', () => {
    it('test_load_rung_from_router_sums_kernel_chars', () => {
        const router: Dict = { kernel: ['rule-a', 'rule-b', 'rule-c'] };
        const rule_chars = {
            'rule-a': 4000,
            'rule-b': 8000,
            'rule-c': 4000,
            'unrelated-rule': 9999, // must be ignored — not in kernel
        };
        const charter_chars = 4000;
        const rung = L.load_rung_from_router(
            router,
            rule_chars,
            charter_chars,
            reference_scale,
            pricing_row_sonnet,
        );
        expect(rung['token_delta']).toBe(5000);
        expect(rung['confidence']).toBe('measured');
        expect(rung['source_report']).toBe('dist/router.json');
        expect(String(rung['footnote'])).toContain('3 rules');
        expect(String(rung['footnote'])).toContain('16000');
    });

    it('test_load_rung_from_router_exceeds_old_frugality_baseline', () => {
        const router: Dict = { kernel: Array.from({ length: 10 }, (_v, i) => `k${i}`) };
        const rule_chars: Record<string, number> = {};
        for (let i = 0; i < 10; i++) {
            rule_chars[`k${i}`] = 3200;
        }
        const rung = L.load_rung_from_router(
            router,
            rule_chars,
            4000,
            reference_scale,
            pricing_row_sonnet,
        );
        expect(Number(rung['token_delta'])).toBeGreaterThan(4843);
    });
});

// ── load rung from frugality ────────────────────────────────────────────

describe('load_rung_from_frugality', () => {
    it('test_load_rung_from_frugality_extracts_kernel_total', () => {
        const record: Dict = {
            metric_a_footprint: {
                kernel_total_chars: 10000,
                tier_1_total_chars: 5000,
                tier_2_total_chars: 2000,
                charter_chars: 3000,
            },
        };
        const rung = L.load_rung_from_frugality(record, reference_scale, pricing_row_sonnet);
        expect(rung['token_delta']).toBe(5000);
        expect(rung['confidence']).toBe('measured');
        expect(Number(rung['eur_delta'])).toBeGreaterThan(0);
    });
});

// ── Condense rung from telegraph-v2 ─────────────────────────────────────

describe('condense_rung_from_telegraph_v2', () => {
    it('test_condense_rung_excludes_thin_root', () => {
        const report: Dict = {
            aggregate: {
                median_saving_pct: 1.0,
                by_category_median_pct: {
                    'thin-root-package': -4.0,
                    'thin-root-consumer-template': -4.8,
                    'prose-heavy-contract': 4.5,
                    'rule-classification': 0.1,
                },
            },
        };
        const rung = L.condense_rung_from_telegraph_v2(
            report,
            8000,
            reference_scale,
            pricing_row_sonnet,
        );
        expect(rung['token_delta']).toBe(-184);
        expect(rung['confidence']).toBe('measured');
        expect(String(rung['footnote'])).toContain('Thin-Root');
    });
});

// ── rtk rung ────────────────────────────────────────────────────────────

describe('rtk_rung_from_report', () => {
    it('test_rtk_rung_from_report_measured', () => {
        const report: Dict = { schema: 'rtk-v1', aggregate: { tokens_saved_per_request: 250 } };
        const rung = L.rtk_rung_from_report(report, reference_scale, pricing_row_sonnet);
        expect(rung['token_delta']).toBe(-250);
        expect(rung['confidence']).toBe('measured');
    });

    it('test_rtk_rung_zero_aggregate_pending', () => {
        const report: Dict = { aggregate: { tokens_saved_per_request: 0 } };
        const rung = L.rtk_rung_from_report(report, reference_scale, pricing_row_sonnet);
        expect(rung['confidence']).toBe('pending');
        const fn = String(rung['footnote']).toLowerCase();
        expect(fn.includes('re-run') || fn.includes('rerun')).toBe(true);
    });
});

// ── Terse rung — the negative-saving honesty case ───────────────────────

describe('terse_rung_from_telegraph_v1', () => {
    it('test_terse_rung_renders_negative_value_honestly', () => {
        const report: Dict = {
            telegraph: {
                aggregate: {
                    savings_vs_terse: {
                        median: -0.0927,
                    },
                },
            },
        };
        const rung = L.terse_rung_from_telegraph_v1(report, reference_scale, pricing_row_sonnet);
        expect(rung['confidence']).toBe('measured');
        expect(rung['token_delta']).toBe(56);
        expect(String(rung['footnote'])).toContain('Honest');
        expect(Number(rung['eur_delta'])).toBeGreaterThan(0);
    });
});

// ── Behaviour metrics ───────────────────────────────────────────────────

describe('behaviour metrics', () => {
    it('test_destructive_stops_metric_with_both_arms', () => {
        const metric = L.destructive_stops_metric(5, 1);
        expect(metric['with']).toBe(5);
        expect(metric['without']).toBe(1);
        expect(metric['delta']).toBe(4);
        expect(metric['unit']).toBe('count');
        expect(metric['mode']).toBe('live');
    });

    it('test_destructive_stops_metric_pending_when_no_data', () => {
        const metric = L.destructive_stops_metric(null, null);
        expect(metric['with']).toBeNull();
        expect(metric['without']).toBeNull();
        expect(metric['mode']).toBe('dry-run');
    });

    it('test_completion_metric_delta', () => {
        const metric = L.completion_metric(0.85, 0.6, 'live');
        expect(Number(metric['delta'])).toBeCloseTo(0.25, 10);
        expect(metric['mode']).toBe('live');
    });

    it('test_ask_vs_act_metric_lower_is_better', () => {
        const metric = L.ask_vs_act_metric(0.12, 0.4);
        expect(Number(metric['with'])).toBeLessThan(Number(metric['without']));
        expect(Number(metric['delta'])).toBeCloseTo(-0.28, 10);
    });
});

// ── Cumulative assembler ────────────────────────────────────────────────

describe('assemble_ladder', () => {
    it('test_assemble_ladder_running_pct', () => {
        const rungs: L.Rung[] = [
            { id: 'baseline', token_delta: 0, confidence: 'measured' },
            { id: 'load', token_delta: 2000, confidence: 'measured' },
            { id: 'condense', token_delta: -800, confidence: 'measured' },
            { id: 'rtk', token_delta: -500, confidence: 'measured' },
        ];
        const out = L.assemble_ladder(rungs, 8000);
        expect(out[0]!['cumulative_pct']).toBe(0.0);
        expect(out[1]!['cumulative_pct']).toBe(25.0);
        expect(out[2]!['cumulative_pct']).toBe(15.0);
        expect(Number(out[3]!['cumulative_pct'])).toBeCloseTo(8.75, 3);
    });

    it('test_assemble_ladder_pending_contributes_zero', () => {
        const rungs: L.Rung[] = [
            { id: 'baseline', token_delta: 0, confidence: 'measured' },
            { id: 'load', token_delta: 2000, confidence: 'measured' },
            { id: 'rtk', token_delta: -9999, confidence: 'pending' },
            { id: 'terse', token_delta: 56, confidence: 'measured' },
        ];
        const out = L.assemble_ladder(rungs, 8000);
        expect(out[2]!['cumulative_pct']).toBe(25.0);
        expect(Number(out[3]!['cumulative_pct'])).toBeCloseTo(25.7, 3);
    });
});

// ── Totals & verdict ────────────────────────────────────────────────────

describe('compute_totals', () => {
    it('test_compute_totals_net_saving', () => {
        const rungs: L.Rung[] = [
            { id: 'load', token_delta: 2000, confidence: 'measured' },
            { id: 'condense', token_delta: -800, confidence: 'measured' },
            { id: 'rtk', token_delta: -1500, confidence: 'measured' },
        ];
        const totals = L.compute_totals(rungs, 8000, reference_scale, pricing_row_sonnet);
        expect(totals['cumulative_token_delta']).toBe(-300);
        expect(totals['net_verdict']).toBe('net-saving');
        expect(Number(totals['cumulative_pct'])).toBeCloseTo(-3.75, 3);
    });

    it('test_compute_totals_net_cost', () => {
        const rungs: L.Rung[] = [
            { id: 'load', token_delta: 2000, confidence: 'measured' },
            { id: 'condense', token_delta: -100, confidence: 'measured' },
        ];
        const totals = L.compute_totals(rungs, 8000, reference_scale, pricing_row_sonnet);
        expect(totals['cumulative_token_delta']).toBe(1900);
        expect(totals['net_verdict']).toBe('net-cost');
        expect(Number(totals['cumulative_pct'])).toBeGreaterThan(0);
    });

    it('test_compute_totals_excludes_pending', () => {
        const rungs: L.Rung[] = [
            { id: 'load', token_delta: 2000, confidence: 'measured' },
            { id: 'rtk', token_delta: -9999, confidence: 'pending' },
        ];
        const totals = L.compute_totals(rungs, 8000, reference_scale, pricing_row_sonnet);
        expect(totals['cumulative_token_delta']).toBe(2000);
        expect(totals['net_verdict']).toBe('net-cost');
    });
});

// ── Thin-projection lever (roadmap 3.1 honesty fix) ──────────────────────

function projectionFixture(): Dict {
    return {
        rule_footprint: {
            '.claude': { files: 79, chars: 237436, tokens_gpt: 59359 },
            '.windsurfrules': { files: 1, chars: 198676, tokens_gpt: 49669 },
        },
        thin_projection: {
            eager_gpt: 59359,
            thin_gpt: 13502,
            saved_gpt: 45857,
            saved_pct: 77.3,
        },
    };
}

describe('thin projection lever', () => {
    it('test_load_rung_from_projection_uses_eager_footprint', () => {
        const rung = L.load_rung_from_projection(projectionFixture(), L.DEFAULT_REFERENCE_SCALE, {});
        expect(rung).not.toBeNull();
        expect(rung!['id']).toBe('load');
        expect(rung!['token_delta']).toBe(59359);
        expect(rung!['confidence']).toBe('measured');
        expect(String(rung!['source_report'])).toContain('projection-cost.json');
    });

    it('test_load_rung_from_projection_none_without_footprint', () => {
        expect(L.load_rung_from_projection({}, L.DEFAULT_REFERENCE_SCALE, {})).toBeNull();
    });

    it('test_thin_rung_is_available_and_negative', () => {
        const rung = L.thin_rung_from_projection(projectionFixture(), L.DEFAULT_REFERENCE_SCALE, {});
        expect(rung['id']).toBe('thin');
        expect(rung['token_delta']).toBe(-45857);
        expect(rung['confidence']).toBe('available');
        expect(String(rung['footnote'])).toContain('lean_projection.mode');
        expect(String(rung['footnote'])).toContain('13502');
    });

    it('test_thin_rung_pending_without_measurement', () => {
        const rung = L.thin_rung_from_projection({}, L.DEFAULT_REFERENCE_SCALE, {});
        expect(rung['id']).toBe('thin');
        expect(rung['confidence']).toBe('pending');
    });

    it('test_available_rung_excluded_from_cumulative', () => {
        const rungs: L.Rung[] = [
            L.baseline_rung(L.DEFAULT_REFERENCE_SCALE),
            { id: 'load', token_delta: 59359, confidence: 'measured' },
            { id: 'thin', token_delta: -45857, confidence: 'available' },
        ];
        const assembled = L.assemble_ladder(rungs, 8000);
        expect(assembled[1]!['cumulative_pct']).toBe(L.pyRound((100.0 * 59359) / 8000, 3));
        expect(assembled[2]!['cumulative_pct']).toBe(assembled[1]!['cumulative_pct']);
        const totals = L.compute_totals(rungs, 8000, L.DEFAULT_REFERENCE_SCALE, {});
        expect(totals['cumulative_token_delta']).toBe(59359);
        expect(totals['net_verdict']).toBe('net-cost');
    });
});

// ── Differential parity (TS vs Python) ───────────────────────────────────
//
// Run a corpus of fixtures through both implementations and assert the
// produced rung / metric / totals dicts are byte-identical once round-tripped
// through canonical JSON. Covers scoring on >=4 distinct inputs per the
// porting contract.

describe('differential: value_ladder TS == Python (golden replay)', () => {
    const refDefault: Dict = { ...L.DEFAULT_REFERENCE_SCALE };

    interface Case {
        readonly name: string;
        readonly fn: string;
        readonly tsArgs: JsonValue[];
        readonly ts: () => JsonValue;
    }

    const cases: Case[] = [
        {
            name: 'price_tokens_eur',
            fn: 'price_tokens_eur',
            tsArgs: [1234, 567, pricing_row_sonnet],
            ts: () => L.price_tokens_eur(1234, 567, pricing_row_sonnet),
        },
        {
            name: 'price_input_delta_eur',
            fn: 'price_input_delta_eur',
            tsArgs: [137, reference_scale, pricing_row_sonnet],
            ts: () => L.price_input_delta_eur(137, reference_scale, pricing_row_sonnet),
        },
        {
            name: 'load_rung_from_router (kernel chars)',
            fn: 'load_rung_from_router',
            tsArgs: [
                { kernel: ['a', 'b', 'c', 'd'] },
                { a: 3001, b: 5002, c: 7003, d: 1009 },
                4100,
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.load_rung_from_router(
                    { kernel: ['a', 'b', 'c', 'd'] },
                    { a: 3001, b: 5002, c: 7003, d: 1009 },
                    4100,
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'load_rung_from_frugality',
            fn: 'load_rung_from_frugality',
            tsArgs: [
                {
                    metric_a_footprint: {
                        kernel_total_chars: 12345,
                        tier_1_total_chars: 6001,
                        tier_2_total_chars: 2002,
                        charter_chars: 3003,
                    },
                },
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.load_rung_from_frugality(
                    {
                        metric_a_footprint: {
                            kernel_total_chars: 12345,
                            tier_1_total_chars: 6001,
                            tier_2_total_chars: 2002,
                            charter_chars: 3003,
                        },
                    },
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'condense_rung_from_telegraph_v2 (mean)',
            fn: 'condense_rung_from_telegraph_v2',
            tsArgs: [
                {
                    aggregate: {
                        by_category_median_pct: {
                            'thin-root-x': -4.0,
                            'prose-heavy-contract': 3.7,
                            'rule-classification': 1.9,
                            other: 5.1,
                        },
                    },
                },
                8000,
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.condense_rung_from_telegraph_v2(
                    {
                        aggregate: {
                            by_category_median_pct: {
                                'thin-root-x': -4.0,
                                'prose-heavy-contract': 3.7,
                                'rule-classification': 1.9,
                                other: 5.1,
                            },
                        },
                    },
                    8000,
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'condense_rung_from_telegraph_v2 (fallback to median_saving_pct)',
            fn: 'condense_rung_from_telegraph_v2',
            tsArgs: [
                { aggregate: { median_saving_pct: 2.6, by_category_median_pct: { 'thin-root-y': -1.0 } } },
                9000,
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.condense_rung_from_telegraph_v2(
                    { aggregate: { median_saving_pct: 2.6, by_category_median_pct: { 'thin-root-y': -1.0 } } },
                    9000,
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'rtk_rung_from_report (measured)',
            fn: 'rtk_rung_from_report',
            tsArgs: [{ aggregate: { tokens_saved_per_request: 333 } }, reference_scale, pricing_row_sonnet],
            ts: () =>
                L.rtk_rung_from_report(
                    { aggregate: { tokens_saved_per_request: 333 } },
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'terse_rung_from_telegraph_v1 (negative median)',
            fn: 'terse_rung_from_telegraph_v1',
            tsArgs: [
                { telegraph: { aggregate: { savings_vs_terse: { median: -0.0927 } } } },
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.terse_rung_from_telegraph_v1(
                    { telegraph: { aggregate: { savings_vs_terse: { median: -0.0927 } } } },
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'terse_rung_from_telegraph_v1 (positive median)',
            fn: 'terse_rung_from_telegraph_v1',
            tsArgs: [
                { telegraph: { aggregate: { savings_vs_terse: { median: 0.1234 } } } },
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.terse_rung_from_telegraph_v1(
                    { telegraph: { aggregate: { savings_vs_terse: { median: 0.1234 } } } },
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'thin_rung_from_projection',
            fn: 'thin_rung_from_projection',
            tsArgs: [projectionFixture(), reference_scale, pricing_row_sonnet],
            ts: () =>
                L.thin_rung_from_projection(
                    projectionFixture(),
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'load_rung_from_projection',
            fn: 'load_rung_from_projection',
            tsArgs: [projectionFixture(), reference_scale, pricing_row_sonnet],
            ts: () =>
                L.load_rung_from_projection(
                    projectionFixture(),
                    reference_scale,
                    pricing_row_sonnet,
                ) as unknown as JsonValue,
        },
        {
            name: 'selection_metric_from_dev_reports (both arms)',
            fn: 'selection_metric_from_dev_reports',
            tsArgs: [
                { selection: { selection_accuracy: 0.81 }, results: { mode: 'live' } },
                { selection: { selection_accuracy: 0.0 } },
            ],
            ts: () =>
                L.selection_metric_from_dev_reports(
                    { selection: { selection_accuracy: 0.81 }, results: { mode: 'live' } },
                    { selection: { selection_accuracy: 0.0 } },
                ) as unknown as JsonValue,
        },
        {
            name: 'selection_metric_from_dev_reports (none)',
            fn: 'selection_metric_from_dev_reports',
            tsArgs: [null, null],
            ts: () => L.selection_metric_from_dev_reports(null, null) as unknown as JsonValue,
        },
        {
            name: 'ask_vs_act_metric',
            fn: 'ask_vs_act_metric',
            tsArgs: [0.1234, 0.5678, 'live'],
            ts: () => L.ask_vs_act_metric(0.1234, 0.5678, 'live') as unknown as JsonValue,
        },
        {
            name: 'completion_metric',
            fn: 'completion_metric',
            tsArgs: [0.8765, 0.5432, 'live'],
            ts: () => L.completion_metric(0.8765, 0.5432, 'live') as unknown as JsonValue,
        },
        {
            name: 'destructive_stops_metric',
            fn: 'destructive_stops_metric',
            tsArgs: [3, 1, 5],
            ts: () => L.destructive_stops_metric(3, 1, 5) as unknown as JsonValue,
        },
        {
            name: 'assemble_ladder',
            fn: 'assemble_ladder',
            tsArgs: [
                [
                    { id: 'baseline', token_delta: 0, confidence: 'measured' },
                    { id: 'load', token_delta: 59359, confidence: 'measured' },
                    { id: 'thin', token_delta: -45857, confidence: 'available' },
                    { id: 'condense', token_delta: -184, confidence: 'measured' },
                    { id: 'rtk', token_delta: -9999, confidence: 'pending' },
                    { id: 'terse', token_delta: 56, confidence: 'measured' },
                ],
                8000,
            ],
            ts: () =>
                L.assemble_ladder(
                    [
                        { id: 'baseline', token_delta: 0, confidence: 'measured' },
                        { id: 'load', token_delta: 59359, confidence: 'measured' },
                        { id: 'thin', token_delta: -45857, confidence: 'available' },
                        { id: 'condense', token_delta: -184, confidence: 'measured' },
                        { id: 'rtk', token_delta: -9999, confidence: 'pending' },
                        { id: 'terse', token_delta: 56, confidence: 'measured' },
                    ],
                    8000,
                ) as unknown as JsonValue,
        },
        {
            name: 'compute_totals (net cost, mixed confidences)',
            fn: 'compute_totals',
            tsArgs: [
                [
                    { id: 'load', token_delta: 59359, confidence: 'measured' },
                    { id: 'thin', token_delta: -45857, confidence: 'available' },
                    { id: 'condense', token_delta: -184, confidence: 'measured' },
                    { id: 'rtk', token_delta: -9999, confidence: 'pending' },
                ],
                8000,
                reference_scale,
                pricing_row_sonnet,
            ],
            ts: () =>
                L.compute_totals(
                    [
                        { id: 'load', token_delta: 59359, confidence: 'measured' },
                        { id: 'thin', token_delta: -45857, confidence: 'available' },
                        { id: 'condense', token_delta: -184, confidence: 'measured' },
                        { id: 'rtk', token_delta: -9999, confidence: 'pending' },
                    ],
                    8000,
                    reference_scale,
                    pricing_row_sonnet,
                ),
        },
        {
            name: 'compute_totals (break-even)',
            fn: 'compute_totals',
            tsArgs: [[{ id: 'x', token_delta: 0, confidence: 'measured' }], 8000, refDefault, {}],
            ts: () =>
                L.compute_totals([{ id: 'x', token_delta: 0, confidence: 'measured' }], 8000, refDefault, {}),
        },
        {
            name: 'pending_rung with footnote',
            fn: 'pending_rung',
            tsArgs: ['x', 'X label', 'does x', 'some/path.json', 'a caveat'],
            ts: () =>
                L.pending_rung('x', 'X label', 'does x', 'some/path.json', 'a caveat') as unknown as JsonValue,
        },
    ];

    for (const c of cases) {
        it(`matches Python: ${c.name}`, () => {
            const tsResult = JSON.parse(JSON.stringify(c.ts())) as unknown;
            const pyResult = py(c.fn, c.tsArgs);
            expect(tsResult).toEqual(pyResult);
        });
    }
});
