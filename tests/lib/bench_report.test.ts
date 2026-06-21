/**
 * Vitest twin parity suite for the bench report emitter
 * (`src/scripts/_lib/bench_report.ts`). No pre-existing pytest suite
 * exists, so this is a focused differential suite: the rendered Markdown
 * and the indent=2 JSON body are produced on shared synthetic report
 * dicts by both the TS port and the Python original (via
 * `tests/lib/bench_report_py_driver.py`) and asserted byte-identical
 * (ADR-088 py2ts Phase 2 / Wave 2a, parity gate — byte-exact renderer).
 * Each report variant exercises a distinct source branch (token usage
 * available vs unavailable, quality scored vs not_collected).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    render_markdown,
    report_paths,
    utc_now_filename_stamp,
    utc_now_iso,
    write_json,
    write_markdown,
} from '../../src/scripts/_lib/bench_report.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DRIVER = path.join(HERE, 'bench_report_py_driver.py');
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

// ── synthetic report dicts ──────────────────────────────────────────────────

// Variant A: token source live + quality scored (non-ASCII assertion to
// exercise the JSON ensure_ascii escape + the ❌/✅ status markers).
const REPORT_LIVE_SCORED: Record<string, unknown> = {
    schema_version: 'v1',
    generated_at: '2026-06-11T00:00:00Z',
    corpus: { id: 'routing', path: 'tests/eval/corpus-routing.yaml', prompt_count: 3 },
    runner: { baseline_collector: 'scripts/cost/track.mjs' },
    selection: {
        top_k: 3,
        prompts_hit: 2,
        prompts_total: 3,
        selection_accuracy: 0.6667,
        target: 0.8,
        passed: false,
        per_prompt: [
            { id: 'r-01', hit: true, expected_skills: ['laravel', 'eloquent'], top_k_ranked: ['laravel', 'eloquent', 'pest'] },
            { id: 'r-02', hit: false, expected_skills: [], top_k_ranked: [] },
        ],
    },
    cost: {
        source: 'agents/cost-tracking/sessions.jsonl',
        sessions_scanned: 4,
        per_tier: {
            high: { messages: 2, cost_usd: 0.12 },
            medium: { messages: 0, cost_usd: 0.0 },
            lite: { messages: 5, cost_usd: 0.01 },
        },
        totals: {
            input_tokens: 1200,
            output_tokens: 800,
            cache_read_input_tokens: 50,
            cache_creation_input_tokens: 10,
        },
    },
    quality: {
        source: 'agents/out.json',
        prompts_with_assertion: 2,
        prompts_passing: 1,
        quality_score: 0.5,
        per_prompt: [
            { id: 'r-01', assertion_kind: 'rubric', passed: true, assertion: "must_include=['café ✅']" },
            { id: 'r-02', assertion_kind: 'quality_assertion', passed: false, assertion: '^\\d+' },
        ],
    },
    verdict: { selection: 'FAIL', quality: 'partial', overall: 'partial' },
};

// Variant B: token source unavailable + quality not_collected.
const REPORT_UNAVAILABLE_NOTCOLLECTED: Record<string, unknown> = {
    schema_version: 'v1',
    generated_at: '2026-06-11T12:34:56Z',
    corpus: { id: 'telegraph', path: 'internal/bench/corpora/telegraph/prompts.yaml', prompt_count: 10 },
    runner: { baseline_collector: 'none' },
    selection: {
        top_k: 1,
        prompts_hit: 10,
        prompts_total: 10,
        selection_accuracy: 1.0,
        target: 0.9,
        passed: true,
        per_prompt: [],
    },
    cost: { source: 'unavailable', reason: 'no sessions jsonl', scanned_path: 'agents/cost-tracking/sessions.jsonl' },
    quality: { source: 'not_collected', prompts_with_assertion: 3, prompts_passing: 0, quality_score: 0.0, per_prompt: [] },
    verdict: { selection: 'PASS', quality: 'partial', overall: 'partial' },
};

const REPORTS: Array<[string, Record<string, unknown>]> = [
    ['live+scored', REPORT_LIVE_SCORED],
    ['unavailable+not_collected', REPORT_UNAVAILABLE_NOTCOLLECTED],
];

describe('bench_report — render_markdown (byte-exact vs Python)', () => {
    for (const [name, report] of REPORTS) {
        it.runIf(PY)(`matches Python Markdown — ${name}`, () => {
            const ts = render_markdown(report);
            const py = pyDriver({ mode: 'render_markdown', report });
            expect(ts).toBe(py);
        });
    }
});

describe('bench_report — write_json body (byte-exact vs Python, incl. ensure_ascii)', () => {
    for (const [name, report] of REPORTS) {
        it.runIf(PY)(`matches Python json.dumps(indent=2)+"\\n" — ${name}`, () => {
            let tmp: string | null = null;
            try {
                tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-rep-'));
                const p = path.join(tmp, 'r.json');
                write_json(p, report);
                const ts = fs.readFileSync(p, 'utf-8');
                const py = pyDriver({ mode: 'json', report });
                expect(ts).toBe(py);
            } finally {
                if (tmp) {
                    fs.rmSync(tmp, { recursive: true, force: true });
                }
            }
        });
    }
});

describe('bench_report — report_paths (parity vs Python)', () => {
    it.runIf(PY)('builds the same json/md path pair', () => {
        const [j, m] = report_paths('internal/bench/reports', 'routing', '2026-06-11T00-00-00Z');
        const py = JSON.parse(
            pyDriver({ mode: 'report_paths', reports_dir: 'internal/bench/reports', corpus_id: 'routing', stamp: '2026-06-11T00-00-00Z' }),
        ) as [string, string];
        expect([j, m]).toEqual(py);
    });
});

describe('bench_report — stamp formats', () => {
    it('filename stamp drops colons; iso stamp keeps them', () => {
        expect(utc_now_filename_stamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
        expect(utc_now_iso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
});

describe('bench_report — write_markdown', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
            tmp = null;
        }
    });
    it('writes render_markdown output to disk', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-rep-md-'));
        const p = path.join(tmp, 'nested', 'r.md');
        write_markdown(p, REPORT_LIVE_SCORED);
        expect(fs.readFileSync(p, 'utf-8')).toBe(render_markdown(REPORT_LIVE_SCORED));
    });
});
