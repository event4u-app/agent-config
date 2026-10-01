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

import {
    RANKER_LABELS,
    REPO,
    SKILLS_DIR,
    type SliceName,
    measureAccuracy,
    partitionBySlice,
    rankOptionsFor,
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

export function sweep(labels: readonly string[], repo = REPO, skillsDir = SKILLS_DIR): SweepRow[] {
    const whole = readMatrixLabelledPrompts(repo);
    const out: SweepRow[] = [];
    for (const label of labels) {
        for (const slice of ['tuning', 'sealed'] as const) {
            const arm = measureAccuracy({
                corpus: 'routing-matrix',
                repo,
                skillsDir,
                rankOpts: rankOptionsFor(label),
                slice,
            });
            const mrr = meanReciprocalRank(readRows(partitionBySlice(whole, slice), skillsDir, label));
            out.push({
                label,
                slice,
                n: arm.corpus_prompts,
                top1: arm.top1,
                top1_ci95: arm.top1_ci95,
                top3: arm.top3,
                top3_ci95: arm.top3_ci95,
                mrr: Math.round(mrr * 1000) / 1000,
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
    const unknown = labels.filter((l) => !(l in RANKER_LABELS));
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
