#!/usr/bin/env tsx
/**
 * measure_routing_signal — does the skill BODY carry routing signal the
 * description does not? (`road-to-governed-harness-evolution` step 5.1.)
 *
 * THE BAR WAS FIXED BEFORE THIS FILE EXISTED. Every threshold, the k, the
 * corpus partition, the verdict function and a committed prediction live in
 * `agents/evidence/analysis/routing-signal-preregistration-2026-08-31.md`,
 * which is committed in an earlier commit that adds no measurement module. The
 * constants below are transcribed from it; they are not chosen here.
 *
 * TWO GAPS, AND ONLY ONE OF THEM IS MEASURABLE HERE.
 *
 *   Gap A — proxy-to-real-session fidelity. Stated by the description-surface
 *           route checker's own header: asking a model which units it would
 *           load is not the host's selection procedure. Measuring it needs real
 *           sessions, and step 5.2 parks the live harness for this whole
 *           roadmap. So this run emits `null` with `status:
 *           unmeasured-by-construction` and the reason. That field is not a
 *           caveat — it bounds the external validity of the Gap B verdict, and
 *           a consumer reading the verdict file gets both or neither.
 *
 *   Gap B — the description-vs-body question this run answers.
 *
 * WHY McNEMAR AND NOT A RERUN BAND. The estimator is deterministic: same tree,
 * same ranking, every time. A rerun band would be identically zero and would
 * measure nothing. The variance that exists is sampling variance over cases, so
 * the paired discordant-pair test is the form that addresses it.
 *
 * ZERO MODEL CALLS AND ZERO SPEND, and that follows from the imports rather
 * than from good behaviour: this module imports a file reader and a pure
 * scorer, and nothing that can open a socket.
 *
 * Usage:
 *   ./scripts-run src/scripts/measure_routing_signal            human table
 *   ./scripts-run src/scripts/measure_routing_signal --json     machine record
 *   ./scripts-run src/scripts/measure_routing_signal --write    persist verdict
 *
 * Exit 0 = the measurement ran · 2 = it could not run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    ARMS,
    type Arm,
    type CatalogueEntry,
    type CorpusCase,
    legacyShaped,
    loadCatalogue,
    loadTrainCases,
    termIndex,
    topK,
} from './_lib/routing_corpus.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where the verdict lands. Step 6.5 derives its input set from this file. */
export const VERDICT_REL = 'agents/evidence/analysis/routing-body-signal-verdict.json';
export const PREREG_REL = 'agents/evidence/analysis/routing-signal-preregistration-2026-08-31.md';

// --- the pre-registered constants, transcribed ------------------------------

export const K = 5;
export const RECALL_GAIN_BAR_PP = 5.0;
export const FALSE_ACTIVATION_GUARD_PP = 2.0;
export const POWER_FLOOR_DISCORDANT = 10;
export const ALPHA = 0.05;

export type Verdict = 'signal' | 'null' | 'harmful' | 'underpowered';

export interface ArmCounts {
    readonly positives: number;
    readonly positiveHits: number;
    readonly negatives: number;
    readonly negativeHits: number;
}

export interface Discordance {
    /** control miss → body hit. */
    readonly gained: number;
    /** control hit → body miss. */
    readonly lost: number;
}

export interface Measurement {
    readonly k: number;
    readonly catalogueSize: number;
    readonly trainCorpora: number;
    readonly legacyShaped: readonly string[];
    readonly cases: number;
    readonly arms: Record<Arm, ArmCounts>;
    readonly recallPp: Record<Arm, number>;
    readonly falseActivationPp: Record<Arm, number>;
    readonly deltaRecallPp: number;
    readonly deltaFalseActivationPp: number;
    readonly positiveDiscordance: Discordance;
    readonly pValue: number;
    readonly verdict: Verdict;
    readonly verdictReason: string;
}

/** Exact two-sided McNemar: a binomial sign test over the discordant pairs. */
export function mcnemarExactP(gained: number, lost: number): number {
    const n = gained + lost;
    if (n === 0) return 1;
    const logFact: number[] = [0];
    for (let i = 1; i <= n; i++) logFact.push((logFact[i - 1] as number) + Math.log(i));
    const logChoose = (a: number, b: number): number =>
        (logFact[a] as number) - (logFact[b] as number) - (logFact[a - b] as number);
    const extreme = Math.min(gained, lost);
    let tail = 0;
    for (let i = 0; i <= extreme; i++) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
    return Math.min(1, 2 * tail);
}

const pp = (hits: number, total: number): number => (total === 0 ? 0 : (hits / total) * 100);

export function measure(repo = REPO, k = K): Measurement {
    const catalogue: CatalogueEntry[] = loadCatalogue(repo);
    const cases: CorpusCase[] = loadTrainCases(repo);
    if (catalogue.length === 0 || cases.length === 0) {
        throw new Error('measure_routing_signal: empty catalogue or corpus — a run over nothing');
    }
    const indexes = new Map<Arm, ReturnType<typeof termIndex>>();
    for (const arm of ARMS) indexes.set(arm, termIndex(catalogue, arm));

    const counts: Record<string, { p: number; ph: number; n: number; nh: number }> = {};
    for (const arm of ARMS) counts[arm] = { p: 0, ph: 0, n: 0, nh: 0 };
    let gained = 0;
    let lost = 0;

    // One ranking pass per (case, arm). The prompt is re-tokenized per arm by
    // `topK`; that is the price of keeping the control arm byte-identical to
    // the shipped call rather than hand-rolling a shared fast path.
    for (const c of cases) {
        const hit: Record<string, boolean> = {};
        for (const arm of ARMS) {
            const ranked = topK(c.prompt, catalogue, indexes.get(arm) as Map<string, Set<string>>, k);
            hit[arm] = ranked.some((r) => r.name === c.skill);
            const bucket = counts[arm] as { p: number; ph: number; n: number; nh: number };
            if (c.expect) {
                bucket.p += 1;
                if (hit[arm]) bucket.ph += 1;
            } else {
                bucket.n += 1;
                if (hit[arm]) bucket.nh += 1;
            }
        }
        if (c.expect) {
            const control = hit['description'] === true;
            const body = hit['description+body'] === true;
            if (!control && body) gained += 1;
            if (control && !body) lost += 1;
        }
    }

    const arms = {} as Record<Arm, ArmCounts>;
    const recallPp = {} as Record<Arm, number>;
    const falsePp = {} as Record<Arm, number>;
    for (const arm of ARMS) {
        const b = counts[arm] as { p: number; ph: number; n: number; nh: number };
        arms[arm] = { positives: b.p, positiveHits: b.ph, negatives: b.n, negativeHits: b.nh };
        recallPp[arm] = pp(b.ph, b.p);
        falsePp[arm] = pp(b.nh, b.n);
    }
    const deltaRecall = (recallPp['description+body'] as number) - (recallPp['description'] as number);
    const deltaFalse =
        (falsePp['description+body'] as number) - (falsePp['description'] as number);
    const p = mcnemarExactP(gained, lost);

    // The pre-registered verdict function, in its pre-registered order.
    let verdict: Verdict;
    let reason: string;
    if (gained + lost < POWER_FLOOR_DISCORDANT) {
        verdict = 'underpowered';
        reason = `${gained + lost} discordant positive pairs < power floor ${POWER_FLOOR_DISCORDANT}`;
    } else if (deltaFalse > FALSE_ACTIVATION_GUARD_PP) {
        verdict = 'harmful';
        reason = `false activation +${deltaFalse.toFixed(2)} pp breaches the +${FALSE_ACTIVATION_GUARD_PP.toFixed(1)} pp guard`;
    } else if (deltaRecall >= RECALL_GAIN_BAR_PP && p < ALPHA) {
        verdict = 'signal';
        reason = `recall +${deltaRecall.toFixed(2)} pp at p=${p.toExponential(2)}`;
    } else {
        verdict = 'null';
        reason = `recall +${deltaRecall.toFixed(2)} pp at p=${p.toExponential(2)} does not clear +${RECALL_GAIN_BAR_PP.toFixed(1)} pp and p<${ALPHA}`;
    }

    return {
        k,
        catalogueSize: catalogue.length,
        trainCorpora: new Set(cases.map((c) => c.skill)).size,
        legacyShaped: legacyShaped(repo),
        cases: cases.length,
        arms,
        recallPp,
        falseActivationPp: falsePp,
        deltaRecallPp: deltaRecall,
        deltaFalseActivationPp: deltaFalse,
        positiveDiscordance: { gained, lost },
        pValue: p,
        verdict,
        verdictReason: reason,
    };
}

/**
 * The verdict record step 6.5 reads.
 *
 * `proxy_to_real_fidelity` is a REQUIRED field carrying `null`. A consumer that
 * reads `body_signal` without reading it has taken the conclusion without its
 * bound, so the two ship in one object.
 */
export function verdictRecord(m: Measurement, measuredAt: string): Record<string, unknown> {
    return {
        schema: 1,
        step: '5.1',
        roadmap: 'road-to-governed-harness-evolution',
        preregistration: PREREG_REL,
        measured_at: measuredAt,
        proxy_to_real_fidelity: {
            value: null,
            status: 'unmeasured-by-construction',
            reason:
                'Step 5.2 parks the live routing harness for this roadmap; a fidelity ' +
                'figure requires real sessions. Every routing conclusion in this file is ' +
                'bounded by this unmeasured quantity.',
        },
        body_signal: {
            verdict: m.verdict,
            reason: m.verdictReason,
            k: m.k,
            delta_recall_pp: Number(m.deltaRecallPp.toFixed(3)),
            delta_false_activation_pp: Number(m.deltaFalseActivationPp.toFixed(3)),
            p_value: Number(m.pValue.toPrecision(4)),
            discordant_positive_pairs: m.positiveDiscordance,
            bars: {
                recall_gain_pp: RECALL_GAIN_BAR_PP,
                false_activation_guard_pp: FALSE_ACTIVATION_GUARD_PP,
                power_floor_discordant: POWER_FLOOR_DISCORDANT,
                alpha: ALPHA,
            },
            arms: m.arms,
            recall_pp: {
                description: Number((m.recallPp['description'] as number).toFixed(3)),
                'description+body': Number((m.recallPp['description+body'] as number).toFixed(3)),
            },
            false_activation_pp: {
                description: Number((m.falseActivationPp['description'] as number).toFixed(3)),
                'description+body': Number(
                    (m.falseActivationPp['description+body'] as number).toFixed(3),
                ),
            },
        },
        corpus: {
            partition: 'train',
            holdout_sealed: true,
            train_corpora: m.trainCorpora,
            legacy_shaped_corpora: m.legacyShaped,
            cases: m.cases,
            catalogue_size: m.catalogueSize,
        },
    };
}

export function render(m: Measurement): string {
    const rows = ARMS.map(
        (arm) =>
            `  ${arm.padEnd(18)} recall@${m.k} ${(m.recallPp[arm] as number).toFixed(2).padStart(6)} %` +
            `   false-activation@${m.k} ${(m.falseActivationPp[arm] as number).toFixed(2).padStart(6)} %`,
    );
    return [
        `measure_routing_signal — step 5.1, k=${m.k}`,
        `  catalogue ${m.catalogueSize} skills · train corpora ${m.trainCorpora}` +
            ` (${m.legacyShaped.length} legacy-shaped: ${m.legacyShaped.join(', ') || 'none'})` +
            ` · cases ${m.cases}`,
        ...rows,
        `  delta recall ${m.deltaRecallPp >= 0 ? '+' : ''}${m.deltaRecallPp.toFixed(2)} pp` +
            ` (bar +${RECALL_GAIN_BAR_PP.toFixed(1)} pp)`,
        `  delta false activation ${m.deltaFalseActivationPp >= 0 ? '+' : ''}${m.deltaFalseActivationPp.toFixed(2)} pp` +
            ` (guard +${FALSE_ACTIVATION_GUARD_PP.toFixed(1)} pp)`,
        `  discordant positives gained ${m.positiveDiscordance.gained} lost ${m.positiveDiscordance.lost}` +
            ` · McNemar exact p=${m.pValue.toExponential(3)}`,
        `  proxy-to-real fidelity: null (unmeasured-by-construction — 5.2 park)`,
        `  VERDICT: ${m.verdict} — ${m.verdictReason}`,
    ].join('\n');
}

export function main(argv: readonly string[]): number {
    const m = measure();
    const record = verdictRecord(m, new Date().toISOString().slice(0, 10));
    if (argv.includes('--write')) {
        fs.writeFileSync(path.join(REPO, VERDICT_REL), `${JSON.stringify(record, null, 2)}\n`);
    }
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(record, null, 2)}\n` : `${render(m)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (err) {
        process.stderr.write(`measure_routing_signal: ${(err as Error).message}\n`);
        process.exit(2);
    }
}
