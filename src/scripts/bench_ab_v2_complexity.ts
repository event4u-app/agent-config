#!/usr/bin/env -S npx tsx
/**
 * Offline re-scorer for the Phase-3 metric pair — S0.3 delta #11.
 *
 * Reads a finished `ab-v2` report, walks every trial's **preserved workspace**
 * (delta #7 keyed `task|arm|seed`), and writes two endpoints into each trial's
 * `metrics`:
 *
 *   - `added_lines` — T1's endpoint. Added only, not added+removed: the
 *     discipline oracle's `max_lines_changed` wants the sum, the size claim
 *     wants what the run *wrote*.
 *   - `median_cognitive_complexity` — T2's endpoint, over the functions in the
 *     files that trial actually changed.
 *
 * WHY OFFLINE RATHER THAN IN THE RUNNER. Three reasons, in order of weight.
 * The metric is **retro-fittable**: the workspaces from every completed sweep
 * are on disk, so a run that already cost money can gain the endpoint without
 * being re-run — which is what makes the anti-golfing gate nearly free, and what
 * the roadmap's own text promises. It is **deterministic and model-free**, so
 * re-scoring the same workspace twice cannot produce two numbers. And the
 * grammar load is **async** while `trajectory_metrics` is synchronous and called
 * from four places — threading async through the live path would be a larger
 * diff than the endpoint itself, for no measurement it does not already get.
 *
 * The report is rewritten in place only with `--write`; the default prints the
 * table and touches nothing, because silently rewriting a pinned artefact is how
 * a report stops matching the numbers already quoted from it.
 *
 * Usage:
 *   bench_ab_v2_complexity.ts <report.json> [--write] [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { PinnedRepoError, pristine_tree_for } from './_lib/bench_ab_pinned_repo.js';
import { medianComplexityPerChangedFunction } from './_lib/bench_ab_complexity.js';
import { changed_files, diff_line_counts } from './_lib/bench_ab_scoring_v2.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');

type Dict = Record<string, unknown>;

function _dictOr(v: unknown): Dict {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

/**
 * task id → fixture path. The corpus is the ONLY resolver, deliberately.
 *
 * An earlier draft also had the runner stamp a `fixture` key onto each record so
 * reports would be self-describing, and this function read it first. That is two
 * mechanisms for one fact: the corpus lookup already covers every report,
 * including every one written before the key would have existed. The extra field
 * was dropped rather than kept as a fallback — a reader with no producer is the
 * shape this branch's own completion review flagged elsewhere.
 *
 * A missing or unreadable corpus is not an error: it degrades every affected
 * trial to `skipped_reason: 'task id not in the corpus'`, which is a reportable
 * state, rather than aborting a re-score that may still cover most of the report.
 */
function loadCorpusFixtures(corpusPath: string | null): Map<string, Dict> {
    const byId = new Map<string, Dict>();
    if (!corpusPath || !fs.existsSync(corpusPath)) return byId;
    try {
        const corpus = _dictOr(parseYaml(fs.readFileSync(corpusPath, 'utf8'), { version: '1.1' }));
        const tasks = Array.isArray(corpus['tasks']) ? (corpus['tasks'] as Dict[]) : [];
        for (const t of tasks) {
            if (t['id'] !== undefined && (t['fixture'] !== undefined || t['repo'] !== undefined)) {
                byId.set(String(t['id']), t);
            }
        }
    } catch {
        return byId;
    }
    return byId;
}

export interface TrialRescore {
    task: string;
    arm: string;
    seed: unknown;
    /** `null` when the workspace or the fixture is no longer on disk. */
    added_lines: number | null;
    median_cognitive_complexity: number | null;
    n_functions: number;
    unsupported_files: string[];
    skipped_reason: string | null;
}

/**
 * Re-score one report payload. Pure apart from the filesystem reads it needs;
 * mutates `payload` only when `write` is true. The fixture each trial is diffed
 * against is resolved from the corpus by task id — see `loadCorpusFixtures`.
 */
export async function rescoreReport(
    payload: Dict,
    opts: { fixturesRoot?: string; write?: boolean; corpusPath?: string | null } = {},
): Promise<TrialRescore[]> {
    const fixturesRoot = opts.fixturesRoot ?? FIXTURES_ROOT;
    let wrote = 0;
    const byId = loadCorpusFixtures(opts.corpusPath === undefined ? CORPUS_PATH : opts.corpusPath);
    const out: TrialRescore[] = [];
    const records = Array.isArray(payload['records']) ? (payload['records'] as Dict[]) : [];

    for (const rec of records) {
        const taskId = String(rec['id'] ?? '<unknown>');
        const corpusTask = byId.get(taskId) ?? null;
        const arms = _dictOr(rec['arms']);
        for (const [arm, runsRaw] of Object.entries(arms)) {
            const runs = Array.isArray(runsRaw) ? (runsRaw as Dict[]) : [];
            for (const run of runs) {
                const row: TrialRescore = {
                    task: taskId,
                    arm,
                    seed: run['seed'] ?? null,
                    added_lines: null,
                    median_cognitive_complexity: null,
                    n_functions: 0,
                    unsupported_files: [],
                    skipped_reason: null,
                };

                const workspace = run['workspace'] !== undefined ? String(run['workspace']) : '';
                if (!workspace || !fs.existsSync(workspace)) {
                    // Not a zero — a trial whose workspace was pruned is
                    // unmeasurable, and `compare()` reads a missing metric as
                    // "not measured on this pair" rather than as a value.
                    row.skipped_reason = workspace ? 'workspace missing on disk' : 'no workspace recorded';
                    out.push(row);
                    continue;
                }
                if (corpusTask === null) {
                    row.skipped_reason = 'task id not in the corpus';
                    out.push(row);
                    continue;
                }
                // Delta #9: a pinned task's pristine tree is a local cache entry, and
                // this re-scorer is `offlineOnly` on purpose — a cold cache reports
                // "not materialised" rather than fetching a repository during what is
                // meant to be an offline re-score of a finished sweep. A malformed pin
                // is reported per trial, never thrown: one bad corpus entry must not
                // abort a re-score that still covers every other trial.
                let fixture: string | null;
                try {
                    fixture = pristine_tree_for(corpusTask, { fixturesRoot, offlineOnly: true });
                } catch (err) {
                    row.skipped_reason =
                        err instanceof PinnedRepoError ? `invalid pin: ${err.message}` : 'invalid corpus task';
                    out.push(row);
                    continue;
                }
                if (fixture === null) {
                    row.skipped_reason = 'pinned repo not materialised locally';
                    out.push(row);
                    continue;
                }
                if (!fs.existsSync(fixture)) {
                    row.skipped_reason = 'fixture missing on disk';
                    out.push(row);
                    continue;
                }

                const changed = changed_files(fixture, workspace);
                row.added_lines = diff_line_counts(fixture, workspace, changed).added;
                const rollup = await medianComplexityPerChangedFunction(workspace, changed);
                row.median_cognitive_complexity = rollup.median;
                row.n_functions = rollup.n_functions;
                row.unsupported_files = rollup.unsupported_files;

                if (opts.write) {
                    const metrics = _dictOr(run['metrics']);
                    metrics['added_lines'] = row.added_lines;
                    // `median` is null when the diff contained no scorable
                    // function, and null is written on purpose: `compare()` reads
                    // a null as "not measured on this pair", while a 0 would claim
                    // the run produced maximally simple code. The count sits
                    // beside it so a reader can tell "nothing to score" from
                    // "scored, and it was trivial".
                    metrics['median_cognitive_complexity'] = row.median_cognitive_complexity;
                    metrics['complexity_n_functions'] = row.n_functions;
                    run['metrics'] = metrics;
                    wrote += 1;
                }
                out.push(row);
            }
        }
    }
    if (opts.write) lastWriteCount = wrote;
    return out;
}

/**
 * How many trials the last `rescoreReport({ write: true })` actually touched.
 *
 * The CLI uses it to skip rewriting the report when nothing was measured:
 * re-serialising a pinned artefact for a zero-row pass changes its bytes (and
 * its formatting) without changing a single number, which is exactly the kind of
 * silent churn that makes a report stop matching the figures quoted from it.
 */
let lastWriteCount = 0;
export function trialsWrittenByLastRescore(): number {
    return lastWriteCount;
}

function renderTable(rows: TrialRescore[]): string {
    const L: string[] = [];
    L.push('task | arm | seed | added | median cc | fns | note');
    L.push('-----|-----|------|-------|-----------|-----|-----');
    for (const r of rows) {
        L.push(
            [
                r.task,
                r.arm,
                String(r.seed ?? ''),
                r.added_lines === null ? '-' : String(r.added_lines),
                r.median_cognitive_complexity === null ? '-' : String(r.median_cognitive_complexity),
                String(r.n_functions),
                r.skipped_reason ??
                    (r.unsupported_files.length > 0
                        ? `unsupported: ${r.unsupported_files.join(',')}`
                        : ''),
            ].join(' | '),
        );
    }
    const measured = rows.filter((r) => r.median_cognitive_complexity !== null).length;
    L.push('');
    L.push(`${measured}/${rows.length} trials carry a complexity observation.`);
    return L.join('\n');
}

async function main(argv: string[]): Promise<number> {
    const args = argv.filter((a) => !a.startsWith('--'));
    const write = argv.includes('--write');
    const asJson = argv.includes('--json');
    const reportPath = args[0];
    if (!reportPath) {
        process.stderr.write(
            'usage: bench_ab_v2_complexity.ts <report.json> [--write] [--json]\n',
        );
        return 1;
    }
    if (!fs.existsSync(reportPath)) {
        process.stderr.write(`report not found: ${reportPath}\n`);
        return 1;
    }
    const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Dict;
    const rows = await rescoreReport(payload, { write });
    const written = trialsWrittenByLastRescore();
    if (write && written > 0) {
        fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } else if (write) {
        process.stderr.write('no trial could be measured — report left untouched\n');
    }
    process.stdout.write(asJson ? `${JSON.stringify(rows, null, 2)}\n` : `${renderTable(rows)}\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err: unknown) => {
            process.stderr.write(`${String(err)}\n`);
            process.exit(1);
        },
    );
}
