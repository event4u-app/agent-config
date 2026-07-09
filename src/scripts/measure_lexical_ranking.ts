#!/usr/bin/env tsx
/**
 * Ranking-lift measurement for the hand-rolled lexical index
 * (road-to-retrieval-substrate-hardening B2, deterministic + free).
 *
 * The gate on shipping the index (roadmap Phase 2): it must measurably rank
 * BETTER than the current `_score` bucket scorer, else honest-null. This
 * script runs both scorers over the SAME retrieval-precision corpus + store
 * (internal/bench/second-brain/retrieval-store/) and reports, per task and in
 * aggregate:
 *
 *   - mean top tie-set size — how many entries share the TOP score. `_score`
 *     gives 0.8 to any keyword match, so the needed entry ties with its
 *     confusers (the "recalls but does not rank" finding, mean 3.3). A good
 *     ranker drives this toward 1.
 *   - precision@1 / @k — was the NEEDED entry actually first / in the top-k.
 *
 * No model, no spend: pure retrieval scoring. Exit 0 ok / 1 error / 2 usage.
 *
 * Usage: measure_lexical_ranking.ts [--write] [--format text|json]
 *   --write  persist the report to internal/bench/reports/lexical-ranking.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as YAML from 'yaml';

import { LexicalIndex } from './_lib/lexical_index.js';
import { _score, _setIntakeRoot, _setKnowledgeRoot, _setMemoryRoot, retrieve } from './memory_lookup.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const STORE_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'second-brain', 'retrieval-store');
export const CORPUS = path.join(STORE_DIR, 'retrieval-corpus.yml');
export const REPORT = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'lexical-ranking.json');

interface Task {
    id: string;
    query: string[];
    needed: string;
}

interface TaskResult {
    id: string;
    needed: string;
    baseline: { rank: number; tieSet: number };
    index: { rank: number; tieSet: number };
}

/** Text an entry contributes to the index — the fields `_score` also reads. */
function entryText(entry: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const f of ['path', 'key', 'symptom', 'feature', 'rule', 'body']) {
        const v = entry[f];
        if (typeof v === 'string') parts.push(v);
        else if (Array.isArray(v)) for (const x of v) parts.push(String(x));
    }
    return parts.join(' | ');
}

/** Top tie-set size + rank of the needed id in a sorted (id, score) list. */
function diagnose(ranked: Array<{ id: string; score: number }>, needed: string): { rank: number; tieSet: number } {
    if (ranked.length === 0) return { rank: -1, tieSet: 0 };
    const top = ranked[0]?.score ?? 0;
    const tieSet = ranked.filter((r) => r.score === top).length;
    const rank = ranked.findIndex((r) => r.id === needed);
    return { rank, tieSet };
}

export function measure(): { tasks: TaskResult[]; summary: Record<string, number> } {
    _setMemoryRoot(STORE_DIR);
    _setKnowledgeRoot(path.join(STORE_DIR, 'knowledge-none'));
    _setIntakeRoot(path.join(STORE_DIR, 'intake-none'));

    const doc = YAML.parse(fs.readFileSync(CORPUS, 'utf-8')) as { type: string; k: number; tasks: Task[] };
    const type = doc.type;
    const k = doc.k;
    const results: TaskResult[] = [];

    for (const task of doc.tasks) {
        // Shared universe: every store entry `_score` considers relevant.
        const hits = retrieve([type], task.query, 100);

        // Baseline — rank by the current bucket scorer, ties broken by the
        // order `retrieve` already returns (store order), exactly as today.
        const baselineRanked = hits.map((h) => ({ id: h.id, score: h.score }));
        const baseline = diagnose(baselineRanked, task.needed);

        // Index — BM25 over the same entries' text.
        const index = new LexicalIndex(hits.map((h) => ({ id: h.id, text: entryText(h.entry) })));
        const indexRanked = index.rank(task.query);
        const idx = diagnose(indexRanked, task.needed);

        results.push({ id: task.id, needed: task.needed, baseline, index: idx });
        void _score; // referenced for provenance — retrieve() applies it internally
    }

    const n = results.length;
    const mean = (sel: (r: TaskResult) => number): number =>
        n === 0 ? 0 : Math.round((results.reduce((a, r) => a + sel(r), 0) / n) * 1000) / 1000;
    const precAt = (sel: (r: TaskResult) => number, kk: number): number =>
        n === 0 ? 0 : Math.round((results.filter((r) => sel(r) >= 0 && sel(r) < kk).length / n) * 1000) / 1000;

    const summary = {
        tasks: n,
        k,
        baseline_mean_tie_set: mean((r) => r.baseline.tieSet),
        index_mean_tie_set: mean((r) => r.index.tieSet),
        baseline_precision_at_1: precAt((r) => r.baseline.rank, 1),
        index_precision_at_1: precAt((r) => r.index.rank, 1),
        baseline_precision_at_k: precAt((r) => r.baseline.rank, k),
        index_precision_at_k: precAt((r) => r.index.rank, k),
    };
    return { tasks: results, summary };
}

export function main(argv: string[]): number {
    let write = false;
    let format: 'text' | 'json' = 'text';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--write') write = true;
        else if (a === '--format') format = (argv[++i] as 'text' | 'json') ?? 'text';
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: measure_lexical_ranking.ts [--write] [--format text|json]\n');
            return 0;
        } else {
            process.stderr.write(`measure_lexical_ranking: unknown argument ${a}\n`);
            return 2;
        }
    }

    let out: { tasks: TaskResult[]; summary: Record<string, number> };
    try {
        out = measure();
    } catch (exc) {
        process.stderr.write(`measure_lexical_ranking: error: ${String(exc)}\n`);
        return 1;
    }

    if (write) {
        fs.mkdirSync(path.dirname(REPORT), { recursive: true });
        fs.writeFileSync(REPORT, JSON.stringify({ schema_version: 1, ...out }, null, 2) + '\n');
    }
    if (format === 'json') {
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
        return 0;
    }
    const s = out.summary;
    process.stdout.write(
        `lexical-ranking (${s.tasks} tasks, k=${s.k}):\n` +
            `  mean top tie-set   baseline=${s.baseline_mean_tie_set}  index=${s.index_mean_tie_set}\n` +
            `  precision@1        baseline=${s.baseline_precision_at_1}  index=${s.index_precision_at_1}\n` +
            `  precision@${s.k}        baseline=${s.baseline_precision_at_k}  index=${s.index_precision_at_k}\n`,
    );
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
