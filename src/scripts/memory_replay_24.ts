#!/usr/bin/env tsx
/**
 * Rollback-trigger replay for the memory FTS5 index
 * (road-to-reachable-code-memory Phase 6 item 2 / ADR-129).
 *
 * ADR-129 makes the FTS5 substrate ship WITHOUT a ship-gate lift benchmark
 * (the separator-recall gap is a correctness defect, not a ranking question
 * a lift-gate could measure), but it still records a ROLLBACK trigger: this
 * replay reports recall + tie-distribution for the substring `_score`
 * fallback vs the persisted FTS5 index, over a FIXED 24-query set drawn from
 * REAL entry ids in `agents/memory/*.yml` — not the synthetic
 * needed+distractor bench store `measure_lexical_ranking.ts` uses.
 *
 * Two prior baselines are cited (per ADR-129: "the replay must state which
 * baseline artefact it compares against"), but NEITHER is directly
 * comparable to this replay's own numbers — both were measured over
 * `internal/bench/second-brain/retrieval-store/` (a small store engineered
 * with keyword-overlapping distractors specifically to produce ties), not
 * over the real, distractor-free `agents/memory` corpus this script runs
 * against:
 *
 *   - `internal/bench/reports/second-brain-retrieval.json`:
 *     mean_tie_set_size = 4.111... (live retrieval-precision measurement)
 *   - `internal/bench/reports/lexical-ranking.json`: implied mean tie-set
 *     3.333 for the SAME `_score` scorer over the SAME store (a different
 *     measurement pass — the cross-artefact discrepancy is a known, already
 *     documented finding, see `docs/proof.md`).
 *
 * This replay's own baseline-vs-FTS comparison (computed on the same corpus,
 * same query set, same run) is the load-bearing measurement; the two
 * externals above are context, printed for the record, never averaged in.
 *
 * Usage: memory_replay_24.ts [--write] [--format text|json]
 *   --write  persist the dated note to agents/evidence/reports/memory-fts-replay.md
 * Exit codes: 0 ok, 1 internal error, 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { _iter_curated_entries } from './memory_report.js';
import { _score } from './memory_lookup.js';
import { buildIndex, isStale, queryIndex, resolveIndexPath } from './_lib/memory_fts_index.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const MEMORY_ROOT = path.join(REPO_ROOT, 'agents', 'memory');
export const INTAKE_ROOT = path.join(MEMORY_ROOT, 'intake');
export const NOTE_PATH = path.join(REPO_ROOT, 'agents', 'evidence', 'reports', 'memory-fts-replay.md');

const CURATED_STATUS_EXCLUDE: ReadonlySet<string> = new Set(['deprecated', 'archived', 'superseded']);

/**
 * Fixed 24-query set — real curated entry ids from `agents/memory/*.yml`
 * (2026-07-27 snapshot), deliberately hyphen-heavy so the set exercises the
 * exact separator-recall defect ADR-129 names (`ai_council`-style queries
 * scoring 0 under the literal substring scorer). Each query is the entry's
 * OWN id — "recall" means "does querying by an entry's id retrieve that
 * same entry within the top 5".
 */
export const REPLAY_QUERIES: readonly string[] = [
    'adr-number-collision-on-parallel-prs',
    'agent-config-hooks-need-global-binary',
    'ai-council-cli-repo-local-only',
    'auto-commit-empties-roadmaps',
    'bench-ab-cost-and-activation-mechanics',
    'capability-matrix-coverage-guard',
    'claude-plugin-local-install-via-worktree',
    'command-cluster-ci-surface',
    'commit-relocates-into-per-branch-worktree',
    'council-a1-subagent-contract',
    'council-access-control-and-remediation',
    'council-agent-memory-sunset',
    'council-ai-failure-mode-prevention',
    'council-analysis-workbench',
    'council-chat-history-consolidation',
    'council-claude-code-single-surface',
    'council-command-cluster-phase4',
    'council-contract-integrity',
    'council-curl-timeout-fix',
    'council-decisions-workspace-phases',
    'council-design-antislop-harvest',
    'council-design-exploration-skills',
    'council-discipline-axis-benchmark',
    'council-ecc-harvest',
];

const K = 5;

interface RankedRow {
    id: string;
    score: number;
}

interface EngineResult {
    rank: number; // 0-based index within the top-K, -1 = not recalled
    tieSet: number; // count of entries sharing the TOP score (over the whole ranking)
    top5: string[];
}

interface QueryResult {
    query: string;
    baseline: EngineResult;
    fts: EngineResult;
    top5Overlap: number; // |baseline.top5 ∩ fts.top5| / K
}

/** Corpus entries (id + searchable text), status-excluded entries dropped — mirrors `retrieve()`'s candidate set. */
function _corpusEntries(): Array<{ id: string; entry: Record<string, unknown> }> {
    const out: Array<{ id: string; entry: Record<string, unknown> }> = [];
    for (const [, , entry] of _iter_curated_entries()) {
        const status = entry['status'];
        if (typeof status === 'string' && CURATED_STATUS_EXCLUDE.has(status)) continue;
        const id = typeof entry['id'] === 'string' ? entry['id'] : '';
        if (id === '') continue;
        out.push({ id, entry });
    }
    return out;
}

/** Deterministic ordering: score DESC, id ASC — the memory_lookup.ts contract. */
function _sortRanked(rows: RankedRow[]): void {
    rows.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function _diagnose(ranked: RankedRow[], needed: string): EngineResult {
    const positive = ranked.filter((r) => r.score > 0);
    if (positive.length === 0) return { rank: -1, tieSet: 0, top5: [] };
    const top = positive[0]?.score ?? 0;
    const tieSet = positive.filter((r) => r.score === top).length;
    const top5 = positive.slice(0, K).map((r) => r.id);
    const rank = top5.indexOf(needed);
    return { rank, tieSet, top5 };
}

function _baselineRanked(corpus: Array<{ id: string; entry: Record<string, unknown> }>, keys: string[]): RankedRow[] {
    const rows = corpus.map((c) => ({ id: c.id, score: _score(c.entry, keys) }));
    _sortRanked(rows);
    return rows;
}

function _ftsRanked(indexPath: string, keys: string[]): RankedRow[] {
    const hits = queryIndex(indexPath, keys, []);
    const rows = hits.map((h) => ({ id: h.id, score: h.relevance }));
    _sortRanked(rows);
    return rows;
}

export interface ReplaySummary {
    schema_version: 1;
    kind: 'memory-fts-replay';
    generated_at: string;
    corpus: string;
    corpus_entries: number;
    queries: number;
    k: number;
    baseline_recall_at_k: number;
    fts_recall_at_k: number;
    baseline_mean_tie_set_size: number;
    fts_mean_tie_set_size: number;
    mean_top5_overlap: number;
    compared_against: {
        second_brain_retrieval_json: { path: string; mean_tie_set_size: number };
        lexical_ranking_json: { path: string; note: string };
        comparability_note: string;
    };
}

export function replay(): { results: QueryResult[]; summary: ReplaySummary } {
    const corpus = _corpusEntries();
    const indexPath = resolveIndexPath(REPO_ROOT);
    if (isStale(indexPath, MEMORY_ROOT, INTAKE_ROOT)) {
        buildIndex(indexPath, MEMORY_ROOT, INTAKE_ROOT);
    }

    const results: QueryResult[] = [];
    for (const query of REPLAY_QUERIES) {
        const baseline = _diagnose(_baselineRanked(corpus, [query]), query);
        const fts = _diagnose(_ftsRanked(indexPath, [query]), query);
        const overlapCount = baseline.top5.filter((id) => fts.top5.includes(id)).length;
        const top5Overlap = K > 0 ? overlapCount / K : 0;
        results.push({ query, baseline, fts, top5Overlap });
    }

    const n = results.length;
    const mean = (sel: (r: QueryResult) => number): number =>
        n === 0 ? 0 : Math.round((results.reduce((a, r) => a + sel(r), 0) / n) * 1000) / 1000;
    const recallAt = (sel: (r: QueryResult) => EngineResult): number =>
        n === 0 ? 0 : Math.round((results.filter((r) => sel(r).rank >= 0).length / n) * 1000) / 1000;

    const summary: ReplaySummary = {
        schema_version: 1,
        kind: 'memory-fts-replay',
        generated_at: new Date().toISOString(),
        corpus: 'agents/memory/ (real, distractor-free)',
        corpus_entries: corpus.length,
        queries: n,
        k: K,
        baseline_recall_at_k: recallAt((r) => r.baseline),
        fts_recall_at_k: recallAt((r) => r.fts),
        baseline_mean_tie_set_size: mean((r) => r.baseline.tieSet),
        fts_mean_tie_set_size: mean((r) => r.fts.tieSet),
        mean_top5_overlap: mean((r) => r.top5Overlap),
        compared_against: {
            second_brain_retrieval_json: {
                path: 'internal/bench/reports/second-brain-retrieval.json',
                mean_tie_set_size: 4.111111111111111,
            },
            lexical_ranking_json: {
                path: 'internal/bench/reports/lexical-ranking.json',
                note: 'records ~3.333 mean baseline tie-set for the same _score scorer over the SAME bench store — a different measurement pass, cross-artefact discrepancy documented in docs/proof.md',
            },
            comparability_note:
                'Both cited artefacts were measured over internal/bench/second-brain/retrieval-store/ (engineered needed+distractor fixture). This replay runs over the real agents/memory/ corpus (no engineered distractors) with a DIFFERENT query set (real entry ids, not curated needed/distractor tasks) — the numbers above are NOT directly comparable to either cited artefact. They are cited per ADR-129\'s instruction to name which baseline artefact a replay compares against; this replay\'s own baseline-vs-FTS delta (computed on one corpus, one run) is the load-bearing number.',
        },
    };
    return { results, summary };
}

function _renderMarkdown(out: { results: QueryResult[]; summary: ReplaySummary }): string {
    const s = out.summary;
    const date = s.generated_at.slice(0, 10);
    const lines: string[] = [];
    lines.push(`# Memory FTS5 replay — ${date}`);
    lines.push('');
    lines.push(
        'Rollback-trigger measurement for the memory FTS5 index (road-to-reachable-code-memory ' +
            'Phase 6 item 2 / ADR-129). Compares the substring `_score` fallback against the ' +
            'persisted FTS5 index over a fixed 24-query set of real `agents/memory/*.yml` entry ids.',
    );
    lines.push('');
    lines.push('## Comparability note');
    lines.push('');
    lines.push(s.compared_against.comparability_note);
    lines.push('');
    lines.push('## Cited baselines (context only — not directly comparable, see above)');
    lines.push('');
    lines.push(
        `- \`${s.compared_against.second_brain_retrieval_json.path}\` — ` +
            `mean_tie_set_size = ${s.compared_against.second_brain_retrieval_json.mean_tie_set_size}`,
    );
    lines.push(`- \`${s.compared_against.lexical_ranking_json.path}\` — ${s.compared_against.lexical_ranking_json.note}`);
    lines.push('');
    lines.push('## This replay');
    lines.push('');
    lines.push(`- Corpus: ${s.corpus} (${s.corpus_entries} entries)`);
    lines.push(`- Queries: ${s.queries}, k=${s.k}`);
    lines.push(`- Recall@${s.k}: baseline=${s.baseline_recall_at_k}  fts=${s.fts_recall_at_k}`);
    lines.push(
        `- Mean top tie-set size: baseline=${s.baseline_mean_tie_set_size}  fts=${s.fts_mean_tie_set_size}`,
    );
    lines.push(`- Mean top-${s.k} overlap (baseline ∩ fts): ${s.mean_top5_overlap}`);
    lines.push('');
    lines.push('## Per-query detail');
    lines.push('');
    lines.push('| query | baseline rank | baseline tie | fts rank | fts tie | top5 overlap |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of out.results) {
        lines.push(
            `| \`${r.query}\` | ${r.baseline.rank} | ${r.baseline.tieSet} | ${r.fts.rank} | ${r.fts.tieSet} | ${r.top5Overlap} |`,
        );
    }
    lines.push('');
    return lines.join('\n');
}

export function main(argv: string[]): number {
    let write = false;
    let format: 'text' | 'json' = 'text';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--write') write = true;
        else if (a === '--format') format = (argv[++i] as 'text' | 'json') ?? 'text';
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: memory_replay_24.ts [--write] [--format text|json]\n');
            return 0;
        } else {
            process.stderr.write(`memory_replay_24: unknown argument ${a}\n`);
            return 2;
        }
    }

    let out: { results: QueryResult[]; summary: ReplaySummary };
    try {
        out = replay();
    } catch (exc) {
        process.stderr.write(`memory_replay_24: error: ${String(exc)}\n`);
        return 1;
    }

    if (write) {
        fs.mkdirSync(path.dirname(NOTE_PATH), { recursive: true });
        fs.writeFileSync(NOTE_PATH, _renderMarkdown(out) + '\n');
    }

    if (format === 'json') {
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
        return 0;
    }
    const s = out.summary;
    process.stdout.write(
        `memory-fts-replay (${s.queries} queries, k=${s.k}, corpus=${s.corpus_entries} entries):\n` +
            `  recall@${s.k}       baseline=${s.baseline_recall_at_k}  fts=${s.fts_recall_at_k}\n` +
            `  mean top tie-set   baseline=${s.baseline_mean_tie_set_size}  fts=${s.fts_mean_tie_set_size}\n` +
            `  mean top-${s.k} overlap: ${s.mean_top5_overlap}\n`,
    );
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
