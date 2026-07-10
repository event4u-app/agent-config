#!/usr/bin/env tsx
/**
 * Second-brain RETRIEVAL-PRECISION follow-up
 * (road-to-second-brain-retrieval-precision).
 *
 * The Phase-2 delta run (road-to-second-brain-delta-proof) injected the exact
 * prior fact — a context-value UPPER BOUND assuming perfect retrieval. This
 * follow-up removes that assumption: it runs the REAL `memory_lookup` retrieval
 * against a populated decision store whose distractors deliberately share query
 * keywords with the needed entry, and measures:
 *
 *   - precision@k  — did retrieval surface the NEEDED decision in the top-k?
 *                    DETERMINISTIC + free (no model), so reported even in
 *                    --dry-run. This is the substrate's real retrieval quality.
 *   - end-to-end   — three arms, scored like Phase 2:
 *       retrieval-on  : inject the top-k RETRIEVED entries (confusers included)
 *       retrieval-off : no memory
 *       placebo       : inject k FIXED unrelated entries (equal count, no query)
 *     retrieval-on vs off/placebo tests whether keyword-retrieved context — with
 *     whatever confuser noise it carries — actually helps the model answer.
 *
 * A low precision@k is a legitimate, honest finding: it is evidence for the
 * lint_knowledge_scale / SQLite-FTS5 activation path (ADR-116), not a failure.
 *
 * Modes: --dry-run (real precision@k + stubbed arms, no spend) · --run (live
 * arms, SPEND) · --host <id> · --seeds <n>. Exit 0 ok / 1 error / 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import { load_anthropic_key } from './ai_council/clients.js';
import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setMemoryRoot,
    retrieve,
} from './memory_lookup.js';
import { sanitize_text } from './_lib/retrieval_sanitize.js';
import { scoreTask } from './second_brain_score.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const STORE_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'second-brain', 'retrieval-store');
export const REPORT_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');

const DEFAULT_HOST = 'claude-haiku-4-5-20251001';
const DEFAULT_SEEDS = 3;
/** Fixed unrelated entries for the placebo arm (equal-count inert context). */
const PLACEBO_IDS = ['dist-ci-runner', 'dist-lint-strict', 'dist-docs-site', 'dist-monorepo'];

export type Arm = 'retrieval-off' | 'retrieval-on' | 'placebo';
export const ARMS: readonly Arm[] = ['retrieval-off', 'retrieval-on', 'placebo'];

export interface RetrievalTask {
    id: string;
    query: string[];
    needed: string;
    prompt: string;
    answer_key: { must_contain: string[]; must_not_contain: string[] };
}

export function bindStore(): void {
    _setMemoryRoot(STORE_DIR);
    _setKnowledgeRoot(path.join(STORE_DIR, 'knowledge-none'));
    _setIntakeRoot(path.join(STORE_DIR, 'intake-none'));
}

export function loadCorpus(): {
    type: string;
    k: number;
    tasks: RetrievalTask[];
    stale_ids?: string[];
    poisoned_ids?: string[];
} {
    const doc = YAML.parse(fs.readFileSync(path.join(STORE_DIR, 'retrieval-corpus.yml'), 'utf-8')) as {
        type: string;
        k: number;
        tasks: RetrievalTask[];
        stale_ids?: string[];
        poisoned_ids?: string[];
    };
    return doc;
}

/**
 * Retrieve for a task's query. Returns the top-k bodies to inject PLUS the
 * discrimination diagnostics the keyword scorer's tie behaviour demands:
 *   - rank of the needed entry in the full sorted list (-1 if absent)
 *   - tie_set_size: how many entries share the TOP score. The scorer gives 0.8
 *     to any keyword match and breaks ties by store order (not relevance), so a
 *     tie_set_size > 1 means retrieval did NOT rank the needed entry by
 *     relevance — it recalled it into a bucket. This is the honest
 *     discrimination signal (ADR-116 evidence), separate from precision@k.
 */
export function retrieveFor(
    task: RetrievalTask,
    type: string,
    k: number,
): { topk: Array<{ id: string; body: string }>; rank: number; tieSetSize: number; topScore: number } {
    const all = retrieve([type], task.query, 100);
    const topScore = all.length ? all[0]!.score : 0;
    const tieSetSize = all.filter((h) => h.score === topScore).length;
    const rank = all.findIndex((h) => h.id === task.needed);
    const topk = all.slice(0, k).map((h) => ({ id: h.id, body: String((h.entry as { body?: unknown }).body ?? '') }));
    return { topk, rank, tieSetSize, topScore };
}

/** Read the fixed placebo entries' bodies straight from the store file. */
function _placeboBodies(type: string): string[] {
    const doc = YAML.parse(fs.readFileSync(path.join(STORE_DIR, `${type}.yml`), 'utf-8')) as {
        entries: Array<{ id: string; body?: string }>;
    };
    const byId = new Map(doc.entries.map((e) => [e.id, e.body ?? '']));
    return PLACEBO_IDS.map((id) => byId.get(id) ?? '').filter(Boolean);
}

function _prompt(task: RetrievalTask, arm: Arm, retrieved: string[], placebo: string[]): string {
    const preamble =
        'You are continuing a multi-session engineering project. Answer using the ' +
        'project decisions on record. Be concise and concrete.';
    if (arm === 'retrieval-off') return `${preamble}\n\n${task.prompt}`;
    const bodies = arm === 'retrieval-on' ? retrieved : placebo;
    const block =
        'Retrieved project memory:\n' + bodies.map((b) => `- ${b.trim()}`).join('\n');
    return `${preamble}\n\n${block}\n\n${task.prompt}`;
}

interface CallResult { text: string; tokens_in: number; tokens_out: number }
async function callAnthropic(model: string, prompt: string, apiKey: string): Promise<CallResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 256, temperature: 0.7, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return { text, tokens_in: data.usage?.input_tokens ?? 0, tokens_out: data.usage?.output_tokens ?? 0 };
}

function _scoreObj(task: RetrievalTask) {
    return { id: task.id, metric: 'retrieval-accuracy' as const, session_k: '', session_k1_prompt: task.prompt, answer_key: task.answer_key };
}
function stub(task: RetrievalTask, arm: Arm, neededRetrieved: boolean): string {
    // retrieval-on passes ONLY if the needed entry was actually retrieved.
    if (arm === 'retrieval-on' && neededRetrieved) {
        return `${task.answer_key.must_contain.join(' ')} — per the retrieved decision.`;
    }
    return "I don't have that decision on record here.";
}

/** Two-sided sign-test p-value via exact binomial (ties excluded). */
export function signTestP(wins: number, losses: number): number {
    const n = wins + losses;
    if (n === 0) return 1;
    const k = Math.min(wins, losses);
    let cum = 0;
    for (let i = 0; i <= k; i++) {
        let c = 1;
        for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
        cum += c;
    }
    return Math.min(1, (cum / 2 ** n) * 2);
}

export async function run(opts: { mode: 'dry-run' | 'live'; host: string; seeds: number }): Promise<Record<string, unknown>> {
    bindStore();
    const { type, k, tasks, stale_ids = [], poisoned_ids = [] } = loadCorpus();
    const staleSet = new Set(stale_ids);
    const poisonedSet = new Set(poisoned_ids);
    const apiKey = opts.mode === 'live' ? load_anthropic_key() : '';
    const placebo = _placeboBodies(type);

    let precisionHits = 0;
    let topkSlots = 0;
    let staleHits = 0;
    let poisonedRetrieved = 0;
    let poisonedNeutralized = 0;
    let tieSetSum = 0;
    const perTask: Array<Record<string, unknown>> = [];
    const armPass: Record<Arm, number> = { 'retrieval-off': 0, 'retrieval-on': 0, placebo: 0 };
    const armTotal: Record<Arm, number> = { 'retrieval-off': 0, 'retrieval-on': 0, placebo: 0 };
    const taskArmPass: Record<string, Record<Arm, number>> = {};
    let calls = 0, tIn = 0, tOut = 0;

    for (const task of tasks) {
        const { topk, rank, tieSetSize } = retrieveFor(task, type, k);
        const ids = topk.map((r) => r.id);
        topkSlots += topk.length;
        for (const hit of topk) {
            if (staleSet.has(hit.id)) staleHits += 1;
            if (poisonedSet.has(hit.id)) {
                poisonedRetrieved += 1;
                // Rejection = the sanitize floor strips every hidden-instruction
                // vector before the body could reach a prompt.
                const clean = sanitize_text(hit.body);
                if (!/[​-‏‪-‮⁦-⁩]/u.test(clean)) poisonedNeutralized += 1;
            }
        }

        const neededInTopK = rank >= 0 && rank < k;
        if (neededInTopK) precisionHits += 1;
        tieSetSum += tieSetSize;
        const tap: Record<Arm, number> = { 'retrieval-off': 0, 'retrieval-on': 0, placebo: 0 };

        for (const arm of ARMS) {
            for (let s = 0; s < opts.seeds; s++) {
                let transcript: string;
                if (opts.mode === 'dry-run') {
                    transcript = stub(task, arm, neededInTopK);
                } else {
                    const r = await callAnthropic(opts.host, _prompt(task, arm, topk.map((x) => x.body), placebo), apiKey);
                    transcript = r.text; calls += 1; tIn += r.tokens_in; tOut += r.tokens_out;
                }
                armTotal[arm] += 1;
                if (scoreTask(transcript, _scoreObj(task)).pass) { armPass[arm] += 1; tap[arm] += 1; }
            }
        }
        taskArmPass[task.id] = tap;
        perTask.push({ id: task.id, needed: task.needed, needed_rank: rank, needed_in_top_k: neededInTopK, tie_set_size: tieSetSize, top_k_ids: ids });
    }

    const precisionAtK = tasks.length ? precisionHits / tasks.length : 0;
    const meanTieSet = tasks.length ? tieSetSum / tasks.length : 0;
    const pair = (a: Arm, b: Arm) => {
        let aw = 0, bw = 0, ties = 0;
        for (const t of tasks) {
            const tap = taskArmPass[t.id]!;
            const pa = tap[a], pb = tap[b];
            if (pa > pb) aw += 1; else if (pb > pa) bw += 1; else ties += 1;
        }
        return { a_wins: aw, b_wins: bw, ties, sign_p: signTestP(aw, bw) };
    };
    const onOff = pair('retrieval-on', 'retrieval-off');
    const onPlacebo = pair('retrieval-on', 'placebo');
    const verdict =
        onOff.a_wins > onOff.b_wins && onOff.sign_p < 0.05 &&
        onPlacebo.a_wins > onPlacebo.b_wins && onPlacebo.sign_p < 0.05 ? 'PASS' : 'NULL';

    return {
        schema_version: 1,
        kind: `second-brain-retrieval-${opts.mode}`,
        roadmap: 'road-to-second-brain-retrieval-precision',
        host: opts.host,
        seeds: opts.seeds,
        mode: opts.mode,
        k,
        store: 'internal/bench/second-brain/retrieval-store/ (5 needed + 19 distractors, keyword-overlapping confusers)',
        precision_at_k: precisionAtK,
        // road-to-proof-under-real-conditions Phase 5 — retrieval quality pair:
        // stale_hit_rate: fraction of retrieved top-k slots occupied by
        // SUPERSEDED store entries (lower is better; the substrate has no
        // recency/supersede weighting yet, so a non-zero rate is the honest
        // baseline the FTS5/recency activation path improves on).
        stale_hit_rate: topkSlots ? staleHits / topkSlots : 0,
        stale_hits: staleHits,
        topk_slots: topkSlots,
        // poisoned_rejection_rate: of poisoned entries that WERE retrieved,
        // the fraction whose hidden-instruction vectors the sanitize floor
        // strips (target 1.0; null when none was retrieved this run).
        poisoned_rejection_rate: poisonedRetrieved ? poisonedNeutralized / poisonedRetrieved : null,
        poisoned_retrieved: poisonedRetrieved,
        poisoned_neutralized: poisonedNeutralized,

        precision_hits: precisionHits,
        mean_tie_set_size: meanTieSet,
        discrimination_note:
            'mean_tie_set_size > 1 means the keyword scorer gave the same top score to multiple ' +
            'entries and broke the tie by STORE ORDER, not relevance — precision@k reflects recall ' +
            'into the top-k, not relevance ranking. This is the ADR-116 (FTS5) signal.',
        tasks: tasks.length,
        per_task: perTask,
        aggregate: Object.fromEntries(ARMS.map((a) => [a, { pass: armPass[a], total: armTotal[a] }])),
        paired: { 'on-vs-off': onOff, 'on-vs-placebo': onPlacebo },
        verdict,
        note:
            'precision@k is deterministic (retrieval only, no spend); the arms are model-scored. ' +
            'A retrieval-on PASS means keyword retrieval both FOUND the right decision under confuser ' +
            'load AND the model used it; a NULL with high precision isolates a model-use gap, a NULL ' +
            'with low precision is evidence for the FTS5 activation path (ADR-116).',
        cost: { calls, tokens_in: tIn, tokens_out: tOut },
    };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const mode = argv.includes('--run') ? 'live' : argv.includes('--dry-run') ? 'dry-run' : null;
    if (mode === null) { process.stderr.write('usage: second_brain_retrieval --dry-run | --run [--host <id>] [--seeds <n>]\n'); return 2; }
    const hi = argv.indexOf('--host'); const host = hi >= 0 ? String(argv[hi + 1]) : DEFAULT_HOST;
    const si = argv.indexOf('--seeds'); const seeds = si >= 0 ? Number(argv[si + 1]) : DEFAULT_SEEDS;
    let report: Record<string, unknown>;
    try { report = await run({ mode, host, seeds }); } catch (e) { process.stderr.write(`second_brain_retrieval: ${String(e)}\n`); return 1; }
    if (mode === 'live') {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
        const out = path.join(REPORT_DIR, 'second-brain-retrieval.json');
        fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(`wrote ${path.relative(REPO_ROOT, out)}\n`);
    }
    const a = report.aggregate as Record<Arm, { pass: number; total: number }>;
    process.stdout.write(
        `${mode}: precision@${report.k}=${((report.precision_at_k as number) * 100).toFixed(0)}% (${report.precision_hits}/${report.tasks}) · ` +
        `mean-tie-set=${(report.mean_tie_set_size as number).toFixed(1)} · ` +
        `on=${a['retrieval-on'].pass}/${a['retrieval-on'].total} off=${a['retrieval-off'].pass}/${a['retrieval-off'].total} placebo=${a.placebo.pass}/${a.placebo.total} · ` +
        `${report.verdict} · calls=${(report.cost as { calls: number }).calls}\n`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1])); } catch { return false; }
}
if (_isCliEntry()) { main().then((code) => process.exit(code)); }
