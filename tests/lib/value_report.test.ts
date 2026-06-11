/**
 * Vitest twin of `tests/test_value_ladder.py` (the value_report portion) plus
 * a byte-exact differential suite asserting the TS port and the Python
 * original (`src/scripts/_lib/value_report.py`) render identical markdown over
 * a synthetic report (ADR-088 py2ts Phase 2 / Wave 2a, parity gate 2 — golden
 * replay via the `python3` driver).
 *
 * `assemble_value_v1` reads live on-disk reports; both implementations point
 * at the same repo root, so the shape assertions exercise the real
 * graceful-degradation path identically.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Dict, JsonValue } from '../../src/scripts/_lib/value_ladder.js';
import * as R from '../../src/scripts/_lib/value_report.js';

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

// ── value_report.py assembler (mirror of pytest) ─────────────────────────

describe('assemble_value_v1', () => {
    it('test_assemble_value_v1_returns_valid_shape', () => {
        const report = R.assemble_value_v1();
        expect(report['schema_version']).toBe(1);
        expect(report['schema_id']).toBe('value-v1');
        expect('generated_at' in report).toBe(true);
        expect('reference_scale' in report).toBe(true);
        expect('baseline' in report).toBe(true);
        expect(Array.isArray(report['cost_ladder'])).toBe(true);
        expect(Array.isArray(report['behaviour'])).toBe(true);
        expect('totals' in report).toBe(true);
        const rung_ids = (report['cost_ladder'] as Dict[]).map((r) => r['id']);
        expect(rung_ids).toEqual(['baseline', 'load', 'thin', 'condense', 'rtk', 'terse']);
        const behaviour_ids = (report['behaviour'] as Dict[]).map((m) => m['id']);
        expect(behaviour_ids).toEqual(['selection', 'destructive-stops', 'ask-vs-act', 'completion']);
    });

    it('test_assemble_value_v1_with_custom_reference', () => {
        const report = R.assemble_value_v1({ requests: 10000 });
        const ref = report['reference_scale'] as Dict;
        expect(ref['requests']).toBe(10000);
        expect(ref['avg_input_tokens']).toBe(8000);
    });

    it('test_md_dump_renders_all_sections', () => {
        const report = R.assemble_value_v1();
        const md = R.render_md_dump(report);
        for (const section of [
            '# Value Report',
            '## Reference scale',
            '## Baseline',
            '## Cost ladder',
            '## Behaviour',
            '## Totals',
            '## Notes',
        ]) {
            expect(md, `missing section: ${section}`).toContain(section);
        }
    });
});

// ── write_value_report (tmp dir) ─────────────────────────────────────────

describe('write_value_report', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'value-report-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('test_write_value_report_creates_files', () => {
        const report = R.assemble_value_v1();
        const out = R.write_value_report(report, tmp);
        expect(fs.existsSync(out)).toBe(true);
        expect(fs.existsSync(path.join(tmp, 'latest.json'))).toBe(true);
        const a = JSON.parse(fs.readFileSync(out, 'utf-8')) as unknown;
        const b = JSON.parse(fs.readFileSync(path.join(tmp, 'latest.json'), 'utf-8')) as unknown;
        expect(a).toEqual(b);
    });

    it('write_md_dump writes the human dump beside the JSON', () => {
        const report = R.assemble_value_v1();
        const md = R.write_md_dump(report, tmp);
        expect(fs.existsSync(md)).toBe(true);
        expect(md.endsWith('.md')).toBe(true);
        expect(fs.readFileSync(md, 'utf-8')).toBe(R.render_md_dump(report));
    });
});

// ── Differential: render_md_dump byte-exact (TS == Python) ───────────────
//
// Build a fully-populated synthetic report (deterministic — no live disk),
// then assert both renderers produce byte-identical markdown. The driver
// returns the rendered string under JSON, so a JSON-decoded string compare
// is a byte-for-byte compare of the markdown body.

function syntheticReport(): Dict {
    return {
        schema_version: 1,
        schema_id: 'value-v1',
        generated_at: '2026-06-11T12:34:56+00:00',
        reference_scale: {
            requests: 1000,
            avg_input_tokens: 8000,
            avg_output_tokens: 600,
            model_tier: 'sonnet',
            pricing_sourced_on: '2026-05-14',
        },
        baseline: {
            label: 'Without package',
            input_tokens_per_request: 8000,
        },
        cost_ladder: [
            {
                id: 'baseline',
                label: 'Without package',
                what_it_does: 'Baseline — the bare request without package rules.',
                token_delta: 0,
                eur_delta: 0.0,
                cumulative_pct: 0.0,
                confidence: 'measured',
                source_report: 'n/a',
            },
            {
                id: 'load',
                label: 'With package (rule load)',
                what_it_does: 'The always-active rules land in the context of every request.',
                token_delta: 59359,
                eur_delta: 163.831,
                cumulative_pct: 741.988,
                confidence: 'measured',
                source_report: 'internal/bench/reports/projection-cost.json',
                footnote: 'Eager default footnote with — em dash and a `tool` span.',
            },
            {
                id: 'terse',
                label: '+ terse (shorter replies)',
                what_it_does: 'Telegraph style aims at terser model replies.',
                token_delta: 56,
                eur_delta: 0.7728,
                cumulative_pct: 742.688,
                confidence: 'measured',
                source_report: 'internal/bench/reports/telegraph-v1.json',
                footnote: "Honest: measured median = -9.27% against 'be terse'.",
            },
        ],
        behaviour: [
            {
                id: 'selection',
                label: 'Right-skill selection',
                what_this_means: 'How often the right skill activates (top-K hit).',
                with: 0.81,
                without: 0.0,
                delta: 0.81,
                unit: 'pct',
                mode: 'live',
                source_report: 'internal/bench/reports/ab/',
            },
            {
                id: 'destructive-stops',
                label: 'Destructive-op stops',
                what_this_means: 'How often the agent stops / asks before destructive ops (of 5).',
                with: null,
                without: null,
                delta: null,
                unit: 'count',
                mode: 'dry-run',
                source_report: 'internal/bench/reports/ab/<destructive-corpus-pair>.json',
            },
        ],
        totals: {
            cumulative_token_delta: 59415,
            cumulative_eur_delta: 164.6038,
            cumulative_pct: 742.688,
            net_verdict: 'net-cost',
        },
        notes: [
            'Cost is reported in tokens only — no € figure.',
            'Pending rungs contribute 0 to the cumulative until measured.',
            'Reference scale: 1000 requests × 8000 input / 600 output tokens per request.',
        ],
    };
}

describe('differential: render_md_dump TS == Python (byte-exact)', () => {
    it('renders a fully-populated report identically', () => {
        const report = syntheticReport();
        const tsMd = R.render_md_dump(report);
        const pyMd = py('render_md_dump', [report as unknown as JsonValue]) as string;
        expect(tsMd).toBe(pyMd);
    });

    it('renders the live assembled report identically (graceful-degradation path)', () => {
        // assemble_value_v1 reads live disk; pin generated_at so the two
        // renders are comparable independent of wall-clock.
        const report = R.assemble_value_v1();
        report['generated_at'] = '2026-06-11T00:00:00+00:00';
        const tsMd = R.render_md_dump(report);
        const pyMd = py('render_md_dump', [report as unknown as JsonValue]) as string;
        expect(tsMd).toBe(pyMd);
    });
});

// ── utc_iso shape ────────────────────────────────────────────────────────

describe('utc_iso', () => {
    it('matches Python isoformat(timespec="seconds") shape', () => {
        const iso = R.utc_iso();
        expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/u);
    });
});
