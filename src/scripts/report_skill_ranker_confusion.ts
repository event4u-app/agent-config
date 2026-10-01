#!/usr/bin/env tsx
/**
 * report_skill_ranker_confusion — why the ranker misses, before anything changes.
 *
 * `road-to-a-ranker-that-routes` 1.3. The baseline measurement says the ranker
 * is wrong on four prompts in five; it does not say in what WAY it is wrong, and
 * a signal chosen without that is a guess dressed as a fix. This report is the
 * read that has to come first, and it is deliberately READ-ONLY: it changes no
 * default, flips no flag, and its only output is markdown on stdout.
 *
 * IT READS THE TUNING SLICE, NEVER THE SEALED ONE. The partition lives in
 * `measure_skill_ranker_baseline.sliceForId`. A confusion class read off the
 * sealed rows would make every later "lift on held-out data" claim circular —
 * the rows would have been looked at while choosing what to change. The script
 * therefore takes `--slice` but defaults to `tuning`, and prints the slice it
 * read in the artifact's own header so a reader never has to assume.
 *
 * WHAT IT MEASURES, and each is one of 1.3's five asks:
 *
 *   1. per-pack top-1 — where the misses concentrate;
 *   2. the most frequent (expected, ranked-first) pairs — WHICH skill the
 *      ranker reaches for instead, which is the only form of this number a
 *      candidate signal can be derived from;
 *   3. mean reciprocal rank — whether a miss is a near miss or a rout;
 *   4. the share of misses whose expected skill is outside the top ten —
 *      the same question asked as a cliff rather than as an average;
 *   5. false activation on the deliberate empties — how often a prompt a seat
 *      judged to have NO skill answer draws a top score as confident as a
 *      genuine hit's.
 *
 * Usage:
 *     ./scripts-run src/scripts/report_skill_ranker_confusion > out.md
 *     ./scripts-run src/scripts/report_skill_ranker_confusion --slice sealed
 *     ./scripts-run src/scripts/report_skill_ranker_confusion --ranker keyword-v2
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wilsonInterval } from './_lib/capture_rate.js';
import {
    REPO,
    SKILLS_DIR,
    type LabelledPrompt,
    type SliceName,
    SLICE_NAMES,
    packsForSkill,
    partitionBySlice,
    rankOptionsFor,
    readMatrixCases,
    readMatrixLabelledPrompts,
    sliceForId,
    sliceSizes,
} from './measure_skill_ranker_baseline.js';
import { rank, type RankRow } from './skill_tools/score_skill_relevance.js';

/** How deep "outside the top ten" is. 1.3's own number, not a derived one. */
export const DEEP_MISS_DEPTH = 10;

/** How many confusion pairs the table carries. 1.3's own number. */
export const CONFUSION_PAIRS = 20;

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function pct(n: number, d: number): string {
    return d === 0 ? 'n/a' : `${(100 * (n / d)).toFixed(1)} %`;
}

/**
 * The 1-based position of the first expected skill, or 0 when the ranker never
 * returns one at all.
 *
 * Zero rather than Infinity because the reciprocal of "absent" is 0, which is
 * exactly what MRR wants, and because a sentinel that participates in
 * arithmetic is how a rank-based metric quietly becomes a different metric.
 */
export function firstExpectedRank(rows: readonly RankRow[], expected: readonly string[]): number {
    for (let i = 0; i < rows.length; i += 1) {
        if (expected.includes(rows[i]![0])) return i + 1;
    }
    return 0;
}

export interface RowReading {
    id: string;
    expected: string[];
    rankedFirst: string | null;
    topScore: number;
    rankOfExpected: number;
}

export function readRows(
    prompts: readonly LabelledPrompt[],
    skillsDir: string,
    ranker: string,
): RowReading[] {
    const opts = rankOptionsFor(ranker);
    return prompts.map((p) => {
        const rows = rank(p.prompt, skillsDir, opts);
        return {
            id: p.id,
            expected: p.expected,
            rankedFirst: rows[0]?.[0] ?? null,
            topScore: rows[0]?.[1] ?? 0,
            rankOfExpected: firstExpectedRank(rows, p.expected),
        };
    });
}

export function meanReciprocalRank(readings: readonly RowReading[]): number {
    if (readings.length === 0) return 0;
    let sum = 0;
    for (const r of readings) if (r.rankOfExpected > 0) sum += 1 / r.rankOfExpected;
    return sum / readings.length;
}

export interface PackRow {
    pack: string;
    n: number;
    top1: number;
}

export function perPackTop1(
    readings: readonly RowReading[],
    skillsDir: string,
): PackRow[] {
    const hit = new Map<string, number>();
    const total = new Map<string, number>();
    for (const r of readings) {
        const packs = new Set<string>();
        for (const s of r.expected) for (const p of packsForSkill(skillsDir, s)) packs.add(p);
        const isHit = r.rankOfExpected === 1;
        for (const p of packs) {
            total.set(p, (total.get(p) ?? 0) + 1);
            if (isHit) hit.set(p, (hit.get(p) ?? 0) + 1);
        }
    }
    return [...total.keys()]
        .map((pack) => ({
            pack,
            n: total.get(pack) ?? 0,
            top1: round3((hit.get(pack) ?? 0) / Math.max(total.get(pack) ?? 1, 1)),
        }))
        .sort((a, b) => a.top1 - b.top1 || b.n - a.n || (a.pack < b.pack ? -1 : 1));
}

export interface ConfusionPair {
    expected: string;
    got: string;
    count: number;
}

/**
 * The (expected, ranked-first) pairs, most frequent first.
 *
 * Keyed on the label's FIRST skill — the seat wrote it best-fit-first, so it is
 * the one the pair is a claim about. Counting every skill in a three-slot label
 * would inflate a single row into three confusions and make the frequency column
 * a count of label widths rather than of errors.
 */
export function confusionPairs(readings: readonly RowReading[], limit = CONFUSION_PAIRS): ConfusionPair[] {
    const counts = new Map<string, number>();
    for (const r of readings) {
        if (r.rankOfExpected === 1) continue;
        const expected = r.expected[0] ?? '(none)';
        const got = r.rankedFirst ?? '(nothing ranked)';
        const key = `${expected}\u0000${got}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([key, count]) => {
            const [expected, got] = key.split('\u0000');
            return { expected: expected as string, got: got as string, count };
        })
        .sort((a, b) => b.count - a.count || (a.expected < b.expected ? -1 : 1))
        .slice(0, limit);
}

/** The deliberate `expected_skills: []` rows, partitioned by the same seal. */
export function emptyRowIds(repo: string, slice: SliceName): { id: string; prompt: string }[] {
    const out: { id: string; prompt: string }[] = [];
    for (const c of readMatrixCases(repo)) {
        if (c.expected?.length !== 0) continue;
        const id = `${c.rule}#${c.section}[${String(c.ordinal)}]`;
        if (slice !== 'all' && sliceForId(id) !== slice) continue;
        out.push({ id, prompt: c.prompt });
    }
    return out;
}

export interface FalseActivation {
    empties: number;
    median_correct_hit_score: number;
    at_or_above_median: number;
    share: number;
    correct_hits: number;
}

/**
 * How often a prompt with no skill answer draws a score as confident as a hit.
 *
 * The comparison point is the MEDIAN top score among rows the ranker got right,
 * which is the only threshold available that the ranker itself defines. A fixed
 * cutoff would be a number chosen here, and the question 1.3 asks is whether the
 * ranker's own confidence separates the two populations at all.
 */
export function falseActivation(
    labelled: readonly RowReading[],
    emptyTopScores: readonly number[],
): FalseActivation {
    const hits = labelled.filter((r) => r.rankOfExpected === 1).map((r) => r.topScore).sort((a, b) => a - b);
    const median =
        hits.length === 0
            ? 0
            : hits.length % 2 === 1
              ? (hits[(hits.length - 1) / 2] as number)
              : ((hits[hits.length / 2 - 1] as number) + (hits[hits.length / 2] as number)) / 2;
    const over = emptyTopScores.filter((s) => s >= median).length;
    return {
        empties: emptyTopScores.length,
        median_correct_hit_score: median,
        at_or_above_median: over,
        share: emptyTopScores.length ? round3(over / emptyTopScores.length) : 0,
        correct_hits: hits.length,
    };
}

function interval(successes: number, trials: number): string {
    const raw = wilsonInterval(successes, trials);
    return `${round3(raw.lower).toFixed(3)} – ${round3(raw.upper).toFixed(3)}`;
}

export function renderReport(opts: {
    repo: string;
    skillsDir: string;
    ranker: string;
    slice: SliceName;
    date: string;
}): string {
    const whole = readMatrixLabelledPrompts(opts.repo);
    const sizes = sliceSizes(whole);
    const prompts = partitionBySlice(whole, opts.slice);
    const readings = readRows(prompts, opts.skillsDir, opts.ranker);

    const n = readings.length;
    const top1 = readings.filter((r) => r.rankOfExpected === 1).length;
    const top3 = readings.filter((r) => r.rankOfExpected >= 1 && r.rankOfExpected <= 3).length;
    const unranked = readings.filter((r) => r.rankOfExpected === 0).length;
    const misses = readings.filter((r) => r.rankOfExpected !== 1);
    const deep = misses.filter((r) => r.rankOfExpected === 0 || r.rankOfExpected > DEEP_MISS_DEPTH).length;
    const mrr = meanReciprocalRank(readings);

    const empties = emptyRowIds(opts.repo, opts.slice);
    const rankOpts = rankOptionsFor(opts.ranker);
    const emptyScores = empties.map((e) => rank(e.prompt, opts.skillsDir, rankOpts)[0]?.[1] ?? 0);
    const fa = falseActivation(readings, emptyScores);

    const packs = perPackTop1(readings, opts.skillsDir);
    const pairs = confusionPairs(readings);

    const L: string[] = [];
    L.push(`# Skill-ranker confusion report — ${opts.ranker}, ${opts.slice} slice`);
    L.push('');
    L.push('<!-- evidence-type: analysis -->');
    L.push('');
    L.push(`Produced by \`road-to-a-ranker-that-routes\` 1.3 on ${opts.date}. Read-only: this`);
    L.push('report changes no default and flips no flag. Regenerate every measured figure');
    L.push('below with');
    L.push('');
    L.push('```bash');
    L.push(`./scripts-run src/scripts/report_skill_ranker_confusion --ranker ${opts.ranker} --slice ${opts.slice}`);
    L.push('```');
    L.push('');
    L.push('## What was read');
    L.push('');
    L.push('| | |');
    L.push('|---|---:|');
    L.push(`| labelled rows in the routing matrix | ${String(sizes.all)} |`);
    L.push(`| …in the tuning slice | ${String(sizes.tuning)} |`);
    L.push(`| …in the sealed slice | ${String(sizes.sealed)} |`);
    L.push(`| rows this report read (\`${opts.slice}\`) | ${String(n)} |`);
    L.push(`| deliberate \`expected_skills: []\` rows in the same slice | ${String(empties.length)} |`);
    L.push(`| skills indexed | ${String(fs.readdirSync(opts.skillsDir).filter((s) => fs.existsSync(path.join(opts.skillsDir, s, 'SKILL.md'))).length)} |`);
    L.push('');
    L.push('The sealed slice is **not** read here. A confusion class derived from rows a');
    L.push('later lift is measured on would make that lift circular, which is the one');
    L.push('failure a held-out partition exists to prevent.');
    L.push('');
    L.push('## The headline on this slice');
    L.push('');
    L.push('| measure | value | 95 % CI |');
    L.push('|---|---:|---|');
    L.push(`| top-1 | ${round3(top1 / Math.max(n, 1)).toFixed(3)} | ${interval(top1, n)} |`);
    L.push(`| top-3 | ${round3(top3 / Math.max(n, 1)).toFixed(3)} | ${interval(top3, n)} |`);
    L.push(`| mean reciprocal rank | ${round3(mrr).toFixed(3)} | — |`);
    L.push('');
    L.push('MRR is the average of 1 / (position of the first expected skill), counting a row');
    L.push('where no expected skill appears anywhere in the ranking as 0. It is the figure');
    L.push('that separates "the right answer was second" from "the right answer was never');
    L.push('returned", and top-1 alone cannot.');
    L.push('');
    L.push('## How deep the misses are');
    L.push('');
    L.push('| | count | share of misses |');
    L.push('|---|---:|---:|');
    L.push(`| top-1 misses | ${String(misses.length)} | — |`);
    L.push(`| …expected skill outside the top ${String(DEEP_MISS_DEPTH)} | ${String(deep)} | ${pct(deep, misses.length)} |`);
    L.push(`| …expected skill not ranked at all (score 0) | ${String(unranked)} | ${pct(unranked, misses.length)} |`);
    L.push('');
    L.push('A miss inside the top ten is a ranking problem — the right skill is in the');
    L.push('candidate set and something else outscored it. A miss outside it, and above all');
    L.push('a row where the expected skill scores zero, is a RECALL problem: no re-weighting');
    L.push('of the existing signal can recover a skill the formula never surfaces. The two');
    L.push('take different fixes, which is why the split is reported rather than an average.');
    L.push('');
    L.push('## False activation on the no-skill prompts');
    L.push('');
    L.push('| | |');
    L.push('|---|---:|');
    L.push(`| deliberate empties in this slice | ${String(fa.empties)} |`);
    L.push(`| correct top-1 hits the median is taken over | ${String(fa.correct_hits)} |`);
    L.push(`| median top score of a correct hit | ${String(fa.median_correct_hit_score)} |`);
    L.push(`| empties whose top score reaches that median | ${String(fa.at_or_above_median)} |`);
    L.push(`| share | ${pct(fa.at_or_above_median, fa.empties)} |`);
    L.push('');
    L.push('The threshold is the ranker\'s own median hit score rather than a cutoff chosen');
    L.push('here, because the question is whether the ranker\'s confidence separates the two');
    L.push('populations at all. A share near one half means it does not: a prompt a seat');
    L.push('judged to have no skill answer is scored as confidently as a prompt it got right.');
    L.push('');
    L.push(`## Per-pack top-1, worst first`);
    L.push('');
    L.push('| pack | labelled rows | top-1 |');
    L.push('|---|---:|---:|');
    for (const p of packs) L.push(`| \`${p.pack}\` | ${String(p.n)} | ${p.top1.toFixed(3)} |`);
    L.push('');
    L.push('A row counts once per pack of each skill its label names, so the column sums');
    L.push('above the row count — the same accounting the per-pack census uses.');
    L.push('');
    L.push(`## The ${String(CONFUSION_PAIRS)} most frequent (expected, ranked-first) pairs`);
    L.push('');
    L.push('| expected (label, best fit first) | ranked first instead | rows |');
    L.push('|---|---|---:|');
    for (const p of pairs) L.push(`| \`${p.expected}\` | \`${p.got}\` | ${String(p.count)} |`);
    L.push('');
    return `${L.join('\n')}\n`;
}

export function main(argv: readonly string[]): number {
    const ranker = argv.includes('--ranker') ? (argv[argv.indexOf('--ranker') + 1] ?? 'keyword-v1') : 'keyword-v1';
    const rawSlice = argv.includes('--slice') ? argv[argv.indexOf('--slice') + 1] : 'tuning';
    if (!rawSlice || !SLICE_NAMES.includes(rawSlice as SliceName)) {
        process.stderr.write(
            `report_skill_ranker_confusion: --slice expects one of ${SLICE_NAMES.join(' | ')}, got ${rawSlice ?? '(nothing)'}\n`,
        );
        return 2;
    }
    const date = argv.includes('--date')
        ? (argv[argv.indexOf('--date') + 1] ?? new Date().toISOString().slice(0, 10))
        : new Date().toISOString().slice(0, 10);
    process.stdout.write(
        renderReport({ repo: REPO, skillsDir: SKILLS_DIR, ranker, slice: rawSlice as SliceName, date }),
    );
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
