#!/usr/bin/env tsx
/**
 * report_label_agreement — ranker error, separated from label noise.
 *
 * `road-to-a-ranker-that-routes` 1.4. A top-1 of 0.21 is a statement about two
 * things at once: how often the ranker is wrong, and how often "wrong" is one
 * reasonable person disagreeing with another about which skill a prompt wants.
 * The second is bounded by how far two independent labelling seats agree, and
 * that bound was published as a single aggregate (39 / 55 exact-set agreement)
 * with no per-row record — so nobody could ask the only question that matters
 * here: what does the ranker score on the rows the seats actually AGREE on?
 *
 * This script answers it, and it needs a second seat's labels per row to do so.
 * The store it reads is {@link SECOND_SEAT_FILE}: a flat `{ case id: [skill
 * ids] }` map written by seats that had not read this ranker's scoring, under
 * the protocol in `tests/eval/routing-matrix/README.md`. The first seat's labels
 * are the `expected_skills` lists in the matrix itself.
 *
 * THE DISAGREEMENTS ARE NOT RECONCILED, and that is the point. Overwriting one
 * seat with the other would replace the honest width of the ground truth with a
 * narrower number that looks better and means less.
 *
 * THREE AGREEMENT DEFINITIONS, reported side by side because they answer
 * different questions and the gap between them IS the finding:
 *
 *   - `exact`    — the two label sets are identical. The strictest, and the one
 *                  the published 70.9 % figure used.
 *   - `overlap`  — the two sets share at least one skill, or are both empty. A
 *                  hit is scored when ANY labelled skill appears in the top-k,
 *                  so this is the definition the MEASUREMENT actually cares
 *                  about: on an overlap row the two seats would score the same
 *                  top-1 answer the same way.
 *   - `polarity` — the two seats agree only on whether a skill answer exists at
 *                  all. The weakest, and the floor under the other two.
 *
 * **`polarity` IS ONE-SIDED ON THIS DENOMINATOR and must not be compared with a
 * two-sided figure.** The first seat's labels arrive through
 * `readMatrixLabelledPrompts`, which keeps only NON-EMPTY lists, so "seat one
 * thinks a skill answer exists" is true for every row here by construction and
 * the `agrees` both-empty branch is unreachable from this caller. The number
 * therefore reads "the second seat also wrote a non-empty label", not "the two
 * seats agree about whether an answer exists". It is still worth reporting — it
 * counts the rows the second seat declined — and it is NOT the published
 * two-sided agreement figure wearing the same name.
 *
 * `second_seat_rows` and `relabelled_and_labelled` differ by exactly the rows
 * the second seat relabelled that the first seat had left empty: those are
 * absent from `first` and so cannot be paired.
 *
 * Usage:
 *     ./scripts-run src/scripts/report_label_agreement
 *     ./scripts-run src/scripts/report_label_agreement --ranker idf
 *
 * Output is JSON on stdout, always — there is no second format and therefore no
 * flag to pick one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wilsonInterval } from './_lib/capture_rate.js';
import {
    REPO,
    SKILLS_DIR,
    type LabelledPrompt,
    parseRanker,
    rankOptionsFor,
    readMatrixLabelledPrompts,
    sliceForId,
} from './measure_skill_ranker_baseline.js';
import { rank } from './skill_tools/score_skill_relevance.js';

/** Where the second seat's per-row labels live, relative to the repo root. */
export const SECOND_SEAT_FILE = path.join('tests', 'eval', 'routing-matrix', 'second-seat-2026-10-01.json');

export type AgreementKind = 'exact' | 'overlap' | 'polarity';
export const AGREEMENT_KINDS: readonly AgreementKind[] = ['exact', 'overlap', 'polarity'];

/**
 * The store, or `{}` when nobody has relabelled.
 *
 * A MALFORMED store is a third state and must not look like either of the other
 * two: an empty object would read as "nobody has relabelled" and a raw
 * `SyntaxError` out of `main` would bypass the message that distinguishes them.
 */
export function readSecondSeat(repo = REPO): Record<string, string[]> {
    const file = path.join(repo, SECOND_SEAT_FILE);
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    try {
        return JSON.parse(raw) as Record<string, string[]>;
    } catch (err) {
        throw new Error(
            `report_label_agreement: ${SECOND_SEAT_FILE} is not valid JSON (${(err as Error).message}). ` +
                'That is a corrupt store, NOT an empty one — the two must not be confused.',
        );
    }
}

export function agrees(a: readonly string[], b: readonly string[], kind: AgreementKind): boolean {
    if (kind === 'polarity') return (a.length > 0) === (b.length > 0);
    if (kind === 'overlap') {
        if (a.length === 0 || b.length === 0) return a.length === b.length;
        return a.some((s) => b.includes(s));
    }
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((s, i) => s === sb[i]);
}

export interface AgreementArm {
    kind: AgreementKind | 'all-relabelled';
    n: number;
    top1: number;
    top1_ci95: { lower: number; upper: number };
    top3: number;
    top3_ci95: { lower: number; upper: number };
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function arm(
    kind: AgreementArm['kind'],
    rows: readonly { prompt: LabelledPrompt; ranked: string[] }[],
): AgreementArm {
    let t1 = 0;
    let t3 = 0;
    for (const r of rows) {
        if (r.prompt.expected.some((e) => r.ranked.slice(0, 1).includes(e))) t1 += 1;
        if (r.prompt.expected.some((e) => r.ranked.slice(0, 3).includes(e))) t3 += 1;
    }
    const n = rows.length;
    const ci = (s: number): { lower: number; upper: number } => {
        const raw = wilsonInterval(s, n);
        return { lower: round3(raw.lower), upper: round3(raw.upper) };
    };
    return {
        kind,
        n,
        top1: n ? round3(t1 / n) : 0,
        top1_ci95: ci(t1),
        top3: n ? round3(t3 / n) : 0,
        top3_ci95: ci(t3),
    };
}

export interface AgreementReport {
    ranker: string;
    second_seat_rows: number;
    relabelled_and_labelled: number;
    agreement: Record<AgreementKind, { agreed: number; share: number }>;
    arms: AgreementArm[];
    /** Rows where the two seats share no skill at all — the honest width. */
    disjoint: { id: string; first: string[]; second: string[] }[];
}

export function measureAgreement(opts: {
    repo?: string;
    skillsDir?: string;
    ranker: string;
}): AgreementReport {
    const repo = opts.repo ?? REPO;
    const skillsDir = opts.skillsDir ?? SKILLS_DIR;
    const second = readSecondSeat(repo);
    const first = readMatrixLabelledPrompts(repo);
    const rankOpts = rankOptionsFor(opts.ranker);

    const paired = first.filter((p) => second[p.id] !== undefined);
    const ranked = new Map<string, string[]>();
    for (const p of paired) ranked.set(p.id, rank(p.prompt, skillsDir, rankOpts).map((r) => r[0]));

    const rows = paired.map((prompt) => ({ prompt, ranked: ranked.get(prompt.id) ?? [] }));
    const agreement = {} as Record<AgreementKind, { agreed: number; share: number }>;
    const arms: AgreementArm[] = [arm('all-relabelled', rows)];
    for (const kind of AGREEMENT_KINDS) {
        const kept = rows.filter((r) => agrees(r.prompt.expected, second[r.prompt.id] ?? [], kind));
        agreement[kind] = {
            agreed: kept.length,
            share: rows.length ? round3(kept.length / rows.length) : 0,
        };
        arms.push(arm(kind, kept));
    }
    const disjoint = paired
        .filter((p) => !agrees(p.expected, second[p.id] ?? [], 'overlap'))
        .map((p) => ({ id: p.id, first: p.expected, second: second[p.id] ?? [] }));

    return {
        ranker: opts.ranker,
        second_seat_rows: Object.keys(second).length,
        relabelled_and_labelled: paired.length,
        agreement,
        arms,
        disjoint,
    };
}

/** Every relabelled row is expected to sit in the tuning slice; this says so. */
export function relabelledSliceCensus(repo = REPO): Record<string, number> {
    const out: Record<string, number> = { tuning: 0, sealed: 0 };
    for (const id of Object.keys(readSecondSeat(repo))) out[sliceForId(id)] = (out[sliceForId(id)] ?? 0) + 1;
    return out;
}

export function main(argv: readonly string[]): number {
    let report: AgreementReport;
    try {
        // Same check as `--slice` elsewhere: a present flag with no value is an
        // error, never a silent substitution of the baseline.
        report = measureAgreement({ ranker: parseRanker(argv) });
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
    }
    if (report.second_seat_rows === 0) {
        process.stderr.write(
            `report_label_agreement: no second-seat labels at ${SECOND_SEAT_FILE} — ` +
                'this is "nobody has relabelled", not "the seats disagree about nothing".\n',
        );
        return 2;
    }
    process.stdout.write(
        `${JSON.stringify({ ...report, relabelled_slice_census: relabelledSliceCensus() }, null, 2)}\n`,
    );
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
