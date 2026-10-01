#!/usr/bin/env tsx
/**
 * sweep_skill_ranker_signals — every candidate signal, alone, on both slices.
 *
 * `road-to-a-ranker-that-routes` 2.2 asks for top-1, top-3 and MRR with
 * intervals for each candidate flag measured ALONE, and the flags are a table in
 * `measure_skill_ranker_baseline.RANKER_LABELS`. This script is the thing that
 * produces that table, and it exists as a committed script rather than a
 * one-off because a number nobody can regenerate is a claim rather than a
 * measurement.
 *
 * IT PRINTS BOTH SLICES, and the two are read for different purposes. The
 * TUNING reading is what a signal may be CHOSEN on. The SEALED reading is the
 * only one a lift may be CLAIMED on. Printing only the sealed column would
 * invite choosing on it, which is the one thing the partition exists to stop;
 * printing only the tuning column would leave the claim unsupported.
 *
 * Usage:
 *     ./scripts-run src/scripts/sweep_skill_ranker_signals
 *     ./scripts-run src/scripts/sweep_skill_ranker_signals keyword-v1 idf
 *     ./scripts-run src/scripts/sweep_skill_ranker_signals --json
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wilsonInterval } from './_lib/capture_rate.js';
import {
    RANKER_LABELS,
    REPO,
    SKILLS_DIR,
    type SliceName,
    isKnownRanker,
    partitionBySlice,
    readMatrixLabelledPrompts,
} from './measure_skill_ranker_baseline.js';
import { meanReciprocalRank, readRows } from './report_skill_ranker_confusion.js';

export interface SweepRow {
    label: string;
    slice: SliceName;
    n: number;
    top1: number;
    top1_ci95: { lower: number; upper: number };
    top3: number;
    top3_ci95: { lower: number; upper: number };
    mrr: number;
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function ci(successes: number, trials: number): { lower: number; upper: number } {
    const raw = wilsonInterval(successes, trials);
    return { lower: round3(raw.lower), upper: round3(raw.upper) };
}

/**
 * Every configuration on both slices, ONE ranking pass per prompt.
 *
 * `rank()` re-globs and re-reads the whole SKILL.md catalogue on every call, so
 * it is the dominant cost by a wide margin and ranking each prompt twice doubles
 * the whole sweep. The earlier shape took top-1/top-3 from `measureAccuracy` and
 * MRR from a second pass in `readRows`, which also derived the row set from two
 * independent corpus reads — so a future divergence between them would have been
 * silent rather than loud. All three rates now come off the same readings of the
 * same rows.
 */
export function sweep(labels: readonly string[], repo = REPO, skillsDir = SKILLS_DIR): SweepRow[] {
    const whole = readMatrixLabelledPrompts(repo);
    const out: SweepRow[] = [];
    for (const label of labels) {
        for (const slice of ['tuning', 'sealed'] as const) {
            const rows = partitionBySlice(whole, slice);
            const readings = readRows(rows, skillsDir, label);
            const n = readings.length;
            const t1 = readings.filter((r) => r.rankOfExpected === 1).length;
            const t3 = readings.filter((r) => r.rankOfExpected >= 1 && r.rankOfExpected <= 3).length;
            out.push({
                label,
                slice,
                n,
                top1: n ? round3(t1 / n) : 0,
                top1_ci95: ci(t1, n),
                top3: n ? round3(t3 / n) : 0,
                top3_ci95: ci(t3, n),
                mrr: round3(meanReciprocalRank(readings)),
            });
        }
    }
    return out;
}

export function renderTable(rows: readonly SweepRow[]): string {
    const L = ['| configuration | slice | n | top-1 | 95 % CI | top-3 | 95 % CI | MRR |', '|---|---|---:|---:|---|---:|---|---:|'];
    for (const r of rows) {
        L.push(
            `| \`${r.label}\` | ${r.slice} | ${String(r.n)} | ${r.top1.toFixed(3)} | ` +
                `${r.top1_ci95.lower.toFixed(3)} – ${r.top1_ci95.upper.toFixed(3)} | ${r.top3.toFixed(3)} | ` +
                `${r.top3_ci95.lower.toFixed(3)} – ${r.top3_ci95.upper.toFixed(3)} | ${r.mrr.toFixed(3)} |`,
        );
    }
    return `${L.join('\n')}\n`;
}

export function main(argv: readonly string[]): number {
    const json = argv.includes('--json');
    const named = argv.filter((a) => !a.startsWith('--'));
    const labels = named.length > 0 ? named : Object.keys(RANKER_LABELS);
    // `isKnownRanker` (Object.hasOwn), not `in`: `in` walks the prototype chain,
    // so `constructor` and `toString` would pass here while `Object.keys` below
    // prints a set that does not contain them — two answers to one question.
    const unknown = labels.filter((l) => !isKnownRanker(l));
    if (unknown.length > 0) {
        process.stderr.write(
            `sweep_skill_ranker_signals: unknown configuration(s) ${unknown.join(', ')}; ` +
                `known: ${Object.keys(RANKER_LABELS).join(', ')}\n`,
        );
        return 2;
    }
    const rows = sweep(labels);
    process.stdout.write(json ? `${JSON.stringify(rows, null, 2)}\n` : renderTable(rows));
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
