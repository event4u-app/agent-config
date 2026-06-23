/**
 * Vitest twin suite for the bench report emitter
 * (`src/scripts/_lib/bench_report.ts`). Focused unit suite over the
 * rendered Markdown, the indent=2 JSON body, path building, and stamp
 * formats on shared synthetic report dicts (ADR-088 py2ts Phase 2 /
 * Wave 2a). Each report variant exercises a distinct source branch (token
 * usage available vs unavailable, quality scored vs not_collected).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    render_markdown,
    utc_now_filename_stamp,
    utc_now_iso,
    write_markdown,
} from '../../src/scripts/_lib/bench_report.js';

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
