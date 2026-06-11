/**
 * Vitest twin parity suite for the telegraph bench serializer
 * (`src/scripts/_lib/bench_telegraph_report.ts`). No pre-existing pytest
 * suite exists, so this is a focused differential suite: the rendered
 * Markdown and the JSON report dict are produced on shared synthetic
 * bench data by both the TS port and the Python original (via
 * `tests/lib/bench_telegraph_py_driver.py`) and asserted byte-identical
 * (ADR-088 py2ts Phase 2 / Wave 2a, parity gate — byte-exact renderer).
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    ArmResult,
    PromptResult,
    carve_out_chars,
} from '../../src/scripts/_lib/bench_telegraph.js';
import {
    build_telegraph_report,
    render_telegraph_markdown,
} from '../../src/scripts/_lib/bench_telegraph_report.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DRIVER = path.join(HERE, 'bench_telegraph_py_driver.py');
const REPO_ROOT = path.resolve(HERE, '..', '..');

function pyDriver(spec: unknown): string {
    return execFileSync('python3', [DRIVER], {
        input: Buffer.from(JSON.stringify(spec), 'utf-8'),
        maxBuffer: 16 * 1024 * 1024,
        cwd: REPO_ROOT,
    }).toString('utf-8');
}

function pythonAvailable(): boolean {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
const PY = pythonAvailable();

interface ArmSpec {
    text: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    error?: string | null;
}
interface PromptSpec {
    id: string;
    category: string;
    expected_carve_out_pct: number;
    arms: Record<string, ArmSpec>;
}

function buildResults(specs: PromptSpec[]): PromptResult[] {
    return specs.map((spec) => {
        const pr = new PromptResult({
            id: spec.id,
            category: spec.category,
            expected_carve_out_pct: spec.expected_carve_out_pct,
        });
        for (const arm of Object.keys(spec.arms)) {
            const a = spec.arms[arm] as ArmSpec;
            pr.arms[arm] = new ArmResult({
                arm,
                text: a.text,
                input_tokens: a.input_tokens,
                output_tokens: a.output_tokens,
                latency_ms: a.latency_ms,
                output_chars: a.text.length,
                carve_out_chars: carve_out_chars(a.text),
                error: a.error ?? null,
            });
        }
        return pr;
    });
}

const META = {
    corpus_path_rel: 'internal/bench/corpora/telegraph/prompts.yaml',
    generated_at: '2026-06-11T00:00:00Z',
    bench_run_version: 'v1',
    model: 'claude-sonnet-4-5',
    transport: 'live',
    pricing_rates: { input: 3.0, output: 15.0 },
    pricing_sourced_on: '2026-06-01',
};

// Mix of carve-out shapes + banker's-rounding median bait (32.5 → 32,
// 46.5 → 46) + a partial-prompt (missing arm) to exercise the "—" path.
const SPECS: PromptSpec[] = [
    {
        id: 'telegraph-01',
        category: 'iron-law-fence',
        expected_carve_out_pct: 0.45,
        arms: {
            condensed: { text: '```X```\nok', input_tokens: 50, output_tokens: 30, latency_ms: 100 },
            terse_control: { text: 'terse', input_tokens: 50, output_tokens: 40, latency_ms: 90 },
            uncondensed: { text: 'long answer here', input_tokens: 50, output_tokens: 60, latency_ms: 120 },
        },
    },
    {
        id: 'telegraph-08',
        category: 'pure-prose',
        expected_carve_out_pct: 0.0,
        arms: {
            condensed: { text: 'plain prose', input_tokens: 40, output_tokens: 20, latency_ms: 80 },
            terse_control: { text: 't', input_tokens: 40, output_tokens: 25, latency_ms: 70 },
            uncondensed: { text: 'plain prose longer', input_tokens: 40, output_tokens: 33, latency_ms: 110 },
        },
    },
];

// A partial prompt (only condensed + uncondensed) to drive the savings_vs_terse
// null path and the "—" cell, plus an error arm to flip verdict → partial.
const SPECS_PARTIAL: PromptSpec[] = [
    {
        id: 'telegraph-05',
        category: 'status-marker',
        expected_carve_out_pct: 0.4,
        arms: {
            condensed: { text: '❌ bad\n`ci`', input_tokens: 12, output_tokens: 9, latency_ms: 33 },
            uncondensed: { text: 'three checks ran here', input_tokens: 12, output_tokens: 21, latency_ms: 44, error: 'rate_limited' },
        },
    },
];

describe('bench_telegraph_report — render_telegraph_markdown (byte-exact vs Python)', () => {
    it.runIf(PY)('matches Python Markdown on the multi-prompt sample', () => {
        const report = build_telegraph_report({ results: buildResults(SPECS), ...META });
        const ts = render_telegraph_markdown(report);
        const py = pyDriver({ mode: 'telegraph_md', results: SPECS, meta: META });
        expect(ts).toBe(py);
    });

    it.runIf(PY)('matches Python Markdown on the partial/error sample (verdict=partial, "—" cells)', () => {
        const report = build_telegraph_report({ results: buildResults(SPECS_PARTIAL), ...META });
        const ts = render_telegraph_markdown(report);
        const py = pyDriver({ mode: 'telegraph_md', results: SPECS_PARTIAL, meta: META });
        expect(ts).toBe(py);
        expect(report.verdict.overall).toBe('partial');
    });
});

describe('bench_telegraph_report — build_telegraph_report JSON (deep-equal vs Python)', () => {
    it.runIf(PY)('produces the same report dict structure + values', () => {
        const report = build_telegraph_report({ results: buildResults(SPECS), ...META });
        const py = JSON.parse(pyDriver({ mode: 'telegraph_json', results: SPECS, meta: META }));
        expect(report).toEqual(py);
    });
});

describe('bench_telegraph_report — structural invariants', () => {
    it('schema_version is telegraph-v1; cost carries live-api fields', () => {
        const report = build_telegraph_report({ results: buildResults(SPECS), ...META });
        expect(report.schema_version).toBe('telegraph-v1');
        expect(report.cost.source).toBe('live-api');
        expect(report.cost.model).toBe('claude-sonnet-4-5');
        expect(report.cost.pricing_sourced_on).toBe('2026-06-01');
        expect(report.verdict.overall).toBe('measured');
    });
});
