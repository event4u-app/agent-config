/**
 * bench_parity_count.ts — cross-model parity eval, count-distribution pass.
 *
 * Design: docs/design/cross-model-parity-eval.md (road-to-opt-measurement-unblock
 * Phase 3). Re-scope: council-transport execution, NOT an in-host subagent
 * harness — each orchestration-corpus task is rendered into a single
 * self-contained prompt (fixture files inlined) asking the model to produce
 * the findings it would surface, dispatched identically to ≥2 vendors via the
 * existing `ExternalAIClient` transport. Output: per-host finding-count
 * distributions + the derived `finding_floor` calibration.
 *
 * Pre-registered BEFORE the first billable call (2026-07-12, maintainer
 * approved "Bauen + Count-Pass", ceiling $8):
 *   - VENDORS: anthropic/claude-sonnet-4-5 + openai/gpt-4o (the two council
 *     defaults; no new transport, no new auth surface).
 *   - REPEATS = 3 identical calls per (task × vendor) — distribution, not
 *     a point estimate.
 *   - MAX_TOKENS = 2000 per call.
 *   - MAX_USD = 8.0 hard abort (exit 2) — the authorized ceiling.
 *   - Floor rule: per non-control task, floor = max(1, min over hosts of the
 *     median per-host count) — the cross-host lower envelope, so the gate
 *     fires on a host/task that under-produces relative to the cross-vendor
 *     norm, never relative to one vendor.
 *   - pv-02 is a NEGATIVE CONTROL (clean code): its counts are reported but
 *     excluded from floor derivation — a well-behaved host surfaces ~0
 *     findings there, and a floor > 0 would reward spurious findings.
 *   - Counting uses the SAME `_count_findings` as `run_skill_evals.ts`, so
 *     calibration and gate measure identically.
 *
 * Usage:
 *   npx tsx src/scripts/bench_parity_count.ts --dry-run   # render prompts, no API
 *   npx tsx src/scripts/bench_parity_count.ts --live      # billable
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { _count_findings } from './run_skill_evals.js';
import { price_usd } from './bench_quality_rerun.js';

export const REPEATS = 3;
export const MAX_TOKENS = 2000;
export const DEFAULT_MAX_USD = 8.0;
export const CORPUS_DIR = 'internal/bench/orchestration/corpus';
export const REPORT_PATH = 'internal/bench/reports/parity-count.json';

/** Fixture roots searched, in order, when inlining files a task references. */
export const FIXTURE_ROOTS = [
    'internal/bench/ab/fixture',
    'internal/bench/ab/fixtures-v2/agL-debug-01',
    'internal/bench/orchestration/fixtures/pv-hollow',
];

/** Static, auditable map: corpus task id → files inlined into its prompt. */
export const TASK_FILES: Record<string, { files: string[]; control: boolean }> = {
    'orch-01-multifile-analysis': {
        files: ['src/parser.ts', 'src/formatter.ts', 'src/cli.ts', 'src/reducers.mjs'],
        control: false,
    },
    'orch-02-ordered-refactor': {
        files: ['src/parser.ts', 'src/formatter.ts'],
        control: false,
    },
    'orch-03-competitive-impl': {
        files: ['src/parser.ts'],
        control: false,
    },
    'pv-01-hollow-detection': {
        files: ['src/charge.ts', 'tests/charge.test.ts'],
        control: false,
    },
    'pv-02-negative-control': {
        files: ['src/slugify.ts'],
        control: true,
    },
};

const SYSTEM_PROMPT = [
    'You are a senior engineer reviewing code for a benchmark. You cannot run',
    'code, modify files, or spawn agents. Work only from the file contents',
    'provided in the message.',
].join(' ');

const OUTPUT_CONTRACT = [
    '',
    '---',
    'OUTPUT CONTRACT (benchmark): Do NOT modify files and do NOT describe how',
    'you would delegate. Output ONLY a numbered markdown list of the concrete',
    'findings / changes you would surface for this task — one finding per',
    'list item, most important first, each with its file reference. If the',
    'code is clean and you have nothing to surface, output exactly:',
    'NO FINDINGS',
    'with no list.',
].join('\n');

/** Extract the first fenced block after a `## Task prompt` heading. */
export function extract_task_prompt(md: string): string {
    const at = md.indexOf('## Task prompt');
    if (at === -1) throw new Error('no "## Task prompt" heading');
    const rest = md.slice(at);
    const m = rest.match(/```\n([\s\S]*?)```/);
    if (!m || m[1] === undefined) throw new Error('no fenced task-prompt block');
    return m[1].trimEnd();
}

/** Resolve a task-referenced file against the fixture roots. */
export function resolve_fixture(rel: string, repoRoot = '.'): string {
    for (const root of FIXTURE_ROOTS) {
        const p = path.join(repoRoot, root, rel);
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`fixture file not found in any root: ${rel}`);
}

export function render_user_prompt(taskId: string, taskPrompt: string, repoRoot = '.'): string {
    const spec = TASK_FILES[taskId];
    if (!spec) throw new Error(`no TASK_FILES entry for ${taskId}`);
    const parts: string[] = ['Here are the project files for this task:', ''];
    for (const rel of spec.files) {
        const body = fs.readFileSync(resolve_fixture(rel, repoRoot), 'utf-8');
        parts.push(`### ${rel}`, '```', body.trimEnd(), '```', '');
    }
    parts.push('## Task', '', taskPrompt, OUTPUT_CONTRACT);
    return parts.join('\n');
}

export function median(xs: number[]): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

export interface TaskCounts {
    task: string;
    control: boolean;
    /** host → the REPEATS finding counts */
    counts: Record<string, number[]>;
}

export interface FloorRow {
    task: string;
    control: boolean;
    medians: Record<string, number>;
    /** min over hosts of the per-host median (the lower envelope). */
    envelope: number;
    /** calibrated floor; null for controls (excluded by design). */
    floor: number | null;
}

/** Pre-registered floor rule — see header. */
export function derive_floors(rows: TaskCounts[]): FloorRow[] {
    return rows.map((r) => {
        const medians: Record<string, number> = {};
        for (const [host, xs] of Object.entries(r.counts)) medians[host] = median(xs);
        const vals = Object.values(medians);
        const envelope = vals.length ? Math.min(...vals) : 0;
        return {
            task: r.task,
            control: r.control,
            medians,
            envelope,
            floor: r.control ? null : Math.max(1, Math.floor(envelope)),
        };
    });
}

interface Vendor {
    host: string;
    model: string;
    ask: (system: string, user: string, maxTokens: number) => {
        text: string;
        input_tokens: number;
        output_tokens: number;
        error: string | null;
    };
}

async function load_vendors(): Promise<Vendor[]> {
    const c = await import('./ai_council/clients.js');
    const anthropic = new c.AnthropicClient({ api_key: c.load_anthropic_key() });
    const openai = new c.OpenAIClient({ api_key: c.load_openai_key() });
    return [
        {
            host: `anthropic/${c.DEFAULT_ANTHROPIC_MODEL}`,
            model: c.DEFAULT_ANTHROPIC_MODEL,
            ask: (s, u, m) => anthropic.ask(s, u, m),
        },
        {
            host: `openai/${c.DEFAULT_OPENAI_MODEL}`,
            model: c.DEFAULT_OPENAI_MODEL,
            ask: (s, u, m) => openai.ask(s, u, m),
        },
    ];
}

export async function main(argv: string[]): Promise<number> {
    const live = argv.includes('--live');
    const dry = argv.includes('--dry-run') || !live;
    let maxUsd = DEFAULT_MAX_USD;
    const mi = argv.indexOf('--max-usd');
    if (mi !== -1) maxUsd = Number(argv[mi + 1]);

    const taskIds = Object.keys(TASK_FILES);
    const prompts: Record<string, string> = {};
    for (const id of taskIds) {
        const md = fs.readFileSync(path.join(CORPUS_DIR, `${id}.md`), 'utf-8');
        prompts[id] = render_user_prompt(id, extract_task_prompt(md));
    }

    if (dry) {
        for (const id of taskIds) {
            process.stdout.write(`--- ${id} (${(prompts[id] ?? '').length} chars)\n`);
        }
        process.stdout.write('dry-run: prompts rendered, no API calls.\n');
        return 0;
    }

    const vendors = await load_vendors();
    let spent = 0;
    const rows: TaskCounts[] = [];
    const raw: Array<Record<string, unknown>> = [];
    for (const id of taskIds) {
        const counts: Record<string, number[]> = {};
        for (const v of vendors) {
            const hostCounts: number[] = [];
            counts[v.host] = hostCounts;
            for (let rep = 0; rep < REPEATS; rep += 1) {
                if (spent >= maxUsd) {
                    process.stderr.write(`ABORT: spent $${spent.toFixed(2)} >= --max-usd ${maxUsd}\n`);
                    return 2;
                }
                const resp = v.ask(SYSTEM_PROMPT, prompts[id] ?? '', MAX_TOKENS);
                if (resp.error) {
                    process.stderr.write(`ERROR ${id} × ${v.host} rep${rep}: ${resp.error}\n`);
                    return 1;
                }
                spent += price_usd(v.model, resp.input_tokens, resp.output_tokens);
                const n = /^\s*NO FINDINGS\s*$/m.test(resp.text) ? 0 : _count_findings(resp.text);
                hostCounts.push(n);
                raw.push({ task: id, host: v.host, rep, count: n, text: resp.text });
                process.stdout.write(`${id} × ${v.host} rep${rep}: ${n} findings ($${spent.toFixed(3)} total)\n`);
            }
        }
        rows.push({ task: id, control: TASK_FILES[id]?.control ?? false, counts });
    }

    const floors = derive_floors(rows);
    const report = {
        schema: 'parity-count/1',
        stamp: new Date().toISOString(),
        design: 'docs/design/cross-model-parity-eval.md',
        vendors: vendors.map((v) => v.host),
        repeats: REPEATS,
        max_tokens: MAX_TOKENS,
        floor_rule: 'max(1, floor(min over hosts of median per-host count)); controls excluded',
        counter: 'run_skill_evals._count_findings (identical to the gate)',
        cost_usd_actual: Number(spent.toFixed(4)),
        tasks: rows,
        floors,
        raw,
    };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 1)}\n`);
    process.stdout.write(`wrote ${REPORT_PATH} ($${spent.toFixed(2)} actual)\n`);
    return 0;
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err) => {
            process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
            process.exit(1);
        },
    );
}
