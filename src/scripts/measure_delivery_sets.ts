#!/usr/bin/env tsx
/**
 * measure_delivery_sets — what a narrowed delivery costs, and which SETS are
 * wrong together (`road-to-governed-harness-evolution` step 6.4).
 *
 * THE CEILING WAS FIXED BEFORE THIS FILE EXISTED. Recall-loss ceiling 20.0 pp,
 * token target 500, k = 5, and the definition of a jointly-wrong pair all live
 * in `agents/evidence/analysis/delivery-set-preregistration-2026-08-31.md`,
 * committed in `fe8749458` — a commit that adds no measurement module and runs
 * nothing. The constants below are transcribed from it.
 *
 * WHY A PAIR METRIC AT ALL. Precision, recall and false activation each score
 * ONE delivery in isolation, so none of them can see the failure where two
 * individually plausible skills are wrong TOGETHER. The right question is which
 * set to deliver, and a per-artefact metric cannot ask it.
 *
 * ITS BOUND, STATED RATHER THAN IMPLIED. A pair is only observable when the
 * SAME prompt is adjudicated by BOTH corpora, because the corpus labels one
 * skill per prompt. So the count is a LOWER bound on joint wrongness and never
 * an estimate of it: a wrong pair whose members share no prompt cannot be seen
 * from this corpus at all.
 *
 * THE RANKING ARM IS NOT CHOSEN HERE. It is resolved from the 5.1 verdict file
 * by `_lib/routing_index_input.ts` (step 6.5): `signal` widens the index to the
 * body, anything else — including a missing or provenance-stripped record —
 * resolves to description-only. Today`s verdict is `harmful`, so this run
 * measures the description index; flipping the verdict file flips what this run
 * indexes, which is the property step 6.5`s verify asks for.
 *
 * ZERO MODEL CALLS AND ZERO SPEND: the imports are a file reader and a pure
 * scorer.
 *
 * Usage:
 *   ./scripts-run src/scripts/measure_delivery_sets           human table
 *   ./scripts-run src/scripts/measure_delivery_sets --json    machine record
 *
 * Exit 0 = the measurement ran; 2 = it could not run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type CatalogueEntry,
    type CorpusCase,
    loadCatalogue,
    loadTrainCases,
    termIndex,
    topK,
} from './_lib/routing_corpus.js';
import { resolveIndexInput } from './_lib/routing_index_input.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PREREG_REL = 'agents/evidence/analysis/delivery-set-preregistration-2026-08-31.md';
export const RECORD_REL = 'agents/evidence/analysis/delivery-set-measurement-2026-08-31.json';

export const K = 5;
export const RECALL_LOSS_CEILING_PP = 20.0;
export const TOKEN_TARGET = 500;
/** The recall curve reported beside k, so a breach says at which k it would clear. */
export const CURVE_KS = [1, 3, 5, 10, 20] as const;

export interface JointlyWrongPair {
    readonly prompt: string;
    readonly pair: readonly [string, string];
}

/**
 * A pair the CORPUS adjudicates wrong together, whether or not delivery
 * currently hands them over together.
 *
 * The step`s verify asks whether *the corpus* contains a jointly-wrong pair.
 * The pre-registration`s own definition added a third condition — both members
 * delivered in the top-k — which turns a corpus property into a delivery
 * property. That is a defect in the pre-registration, found by implementing it,
 * and it is fixed by reporting BOTH rather than by rewriting the definition
 * after seeing the count. `jointlyDeliveredAtK` is the smallest k at which the
 * pair is actually handed over together, or `null` inside the reported curve.
 */
export interface JointlyWrongCandidate {
    readonly prompt: string;
    readonly pair: readonly [string, string];
    readonly jointlyDeliveredAtK: number | null;
}

export interface DeliveryMeasurement {
    readonly k: number;
    readonly catalogueSize: number;
    readonly cases: number;
    readonly prompts: number;
    readonly positives: number;
    readonly negatives: number;
    readonly recallPp: number;
    readonly recallLossPp: number;
    readonly ceilingMet: boolean;
    readonly recallCurvePp: Record<number, number>;
    readonly falseActivationPp: number;
    readonly precisionPp: number;
    readonly adjudicatedDeliveries: number;
    readonly unadjudicatedDeliveries: number;
    readonly contextCostTokens: number;
    readonly tokenTargetMet: boolean;
    readonly benefitUnconditionalPp: number;
    readonly benefitConditionalPp: number;
    /**
     * Prompts where the top-k CUT was decided by the alphabetical tie-break
     * rather than by score — `score(k) === score(k+1)`. Reported, not barred:
     * it is the "recalls but does not rank" pathology, and it bounds how much
     * any of the figures above are about discrimination at all.
     */
    readonly tieDecidedCutPp: number;
    readonly indexInput: ReturnType<typeof resolveIndexInput>;
    readonly sharedPrompts: number;
    readonly jointlyWrongPairs: readonly JointlyWrongPair[];
    readonly jointlyWrongCandidates: readonly JointlyWrongCandidate[];
}

/** The corpus verdict for a `(skill, prompt)` key, absent when unadjudicated. */
export function adjudicationIndex(cases: readonly CorpusCase[]): Map<string, boolean> {
    const index = new Map<string, boolean>();
    for (const c of cases) index.set(`${c.skill} ${c.prompt.trim().toLowerCase()}`, c.expect);
    return index;
}

const pp = (hits: number, total: number): number => (total === 0 ? 0 : (hits / total) * 100);

export function measureDelivery(repo = REPO, k = K): DeliveryMeasurement {
    const catalogue: CatalogueEntry[] = loadCatalogue(repo);
    const cases: CorpusCase[] = loadTrainCases(repo);
    if (catalogue.length === 0 || cases.length === 0) {
        throw new Error('measure_delivery_sets: empty catalogue or corpus — a run over nothing');
    }
    const indexInput = resolveIndexInput(repo);
    const index = termIndex(catalogue, indexInput.indexesBody ? 'description+body' : 'description');
    const adjudicated = adjudicationIndex(cases);
    const cost = new Map<string, number>();
    for (const e of catalogue) cost.set(e.name, `${e.name} ${e.description}`.length);

    // One delivery per distinct prompt: a prompt carried by two corpora is one
    // delivery event, adjudicated twice.
    const byPrompt = new Map<string, CorpusCase[]>();
    for (const c of cases) {
        const key = c.prompt.trim().toLowerCase();
        const bucket = byPrompt.get(key);
        if (bucket === undefined) byPrompt.set(key, [c]);
        else bucket.push(c);
    }

    const curveHits: Record<number, number> = {};
    for (const ck of CURVE_KS) curveHits[ck] = 0;
    const maxK = Math.max(k, ...CURVE_KS);

    let positives = 0;
    let negatives = 0;
    let recallHits = 0;
    let falseHits = 0;
    let adjudicatedDeliveries = 0;
    let correctDeliveries = 0;
    let unadjudicatedDeliveries = 0;
    let totalChars = 0;
    let tieDecidedCuts = 0;
    let sharedPrompts = 0;
    const jointly: JointlyWrongPair[] = [];
    const candidates: JointlyWrongCandidate[] = [];

    for (const [key, group] of [...byPrompt.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const prompt = (group[0] as CorpusCase).prompt;
        const rankedFull = topK(prompt, catalogue, index, maxK);
        const ranked = rankedFull.map((r) => r.name);
        const delivered = ranked.slice(0, k);
        if (
            rankedFull.length > k &&
            (rankedFull[k - 1] as { score: number }).score ===
                (rankedFull[k] as { score: number }).score
        ) {
            tieDecidedCuts += 1;
        }
        const deliveredSet = new Set(delivered);

        for (const c of group) {
            if (c.expect) {
                positives += 1;
                if (deliveredSet.has(c.skill)) recallHits += 1;
                for (const ck of CURVE_KS) {
                    if (ranked.slice(0, ck).includes(c.skill)) curveHits[ck] = (curveHits[ck] ?? 0) + 1;
                }
            } else {
                negatives += 1;
                if (deliveredSet.has(c.skill)) falseHits += 1;
            }
        }

        for (const name of delivered) {
            totalChars += cost.get(name) ?? 0;
            const verdict = adjudicated.get(`${name} ${key}`);
            if (verdict === undefined) unadjudicatedDeliveries += 1;
            else {
                adjudicatedDeliveries += 1;
                if (verdict) correctDeliveries += 1;
            }
        }

        // Set compatibility. Observable only where two corpora adjudicate the
        // same prompt; both members must be delivered AND both recorded false.
        if (group.length < 2) continue;
        sharedPrompts += 1;

        // The corpus-level property the step`s verify names: two corpora
        // adjudicating the same prompt `false`. Independent of delivery.
        const wrongInCorpus = group
            .filter((c) => !c.expect)
            .map((c) => c.skill)
            .sort();
        for (let i = 0; i < wrongInCorpus.length; i++) {
            for (let j = i + 1; j < wrongInCorpus.length; j++) {
                const a = wrongInCorpus[i] as string;
                const b = wrongInCorpus[j] as string;
                let at: number | null = null;
                for (const ck of CURVE_KS) {
                    const head = ranked.slice(0, ck);
                    if (head.includes(a) && head.includes(b)) {
                        at = ck;
                        break;
                    }
                }
                candidates.push({ prompt, pair: [a, b], jointlyDeliveredAtK: at });
            }
        }

        const wrongHere = group
            .filter((c) => !c.expect && deliveredSet.has(c.skill))
            .map((c) => c.skill)
            .sort();
        for (let i = 0; i < wrongHere.length; i++) {
            for (let j = i + 1; j < wrongHere.length; j++) {
                jointly.push({ prompt, pair: [wrongHere[i] as string, wrongHere[j] as string] });
            }
        }
    }

    const recall = pp(recallHits, positives);
    const loss = 100 - recall;
    const curve: Record<number, number> = {};
    for (const ck of CURVE_KS) curve[ck] = pp(curveHits[ck] ?? 0, positives);
    const tokens = byPrompt.size === 0 ? 0 : totalChars / 4 / byPrompt.size;
    const precision = pp(correctDeliveries, adjudicatedDeliveries);

    return {
        k,
        catalogueSize: catalogue.length,
        cases: cases.length,
        prompts: byPrompt.size,
        positives,
        negatives,
        recallPp: recall,
        recallLossPp: loss,
        ceilingMet: loss <= RECALL_LOSS_CEILING_PP,
        recallCurvePp: curve,
        falseActivationPp: pp(falseHits, negatives),
        precisionPp: precision,
        adjudicatedDeliveries,
        unadjudicatedDeliveries,
        contextCostTokens: tokens,
        tokenTargetMet: tokens <= TOKEN_TARGET,
        benefitUnconditionalPp: recall,
        benefitConditionalPp: precision,
        indexInput,
        tieDecidedCutPp: pp(tieDecidedCuts, byPrompt.size),
        sharedPrompts,
        jointlyWrongPairs: jointly,
        jointlyWrongCandidates: candidates,
    };
}

export function record(m: DeliveryMeasurement): Record<string, unknown> {
    return {
        schema: 1,
        step: '6.4',
        roadmap: 'road-to-governed-harness-evolution',
        preregistration: PREREG_REL,
        k: m.k,
        index_input: {
            fields: m.indexInput.fields,
            derived_from: '5.1 verdict file, via _lib/routing_index_input.ts',
            verdict: m.indexInput.verdict,
            reason: m.indexInput.reason,
        },
        bars: { recall_loss_ceiling_pp: RECALL_LOSS_CEILING_PP, token_target: TOKEN_TARGET },
        metrics: {
            precision_at_k: Number(m.precisionPp.toFixed(3)),
            recall_at_k: Number(m.recallPp.toFixed(3)),
            recall_loss_pp: Number(m.recallLossPp.toFixed(3)),
            ceiling_met: m.ceilingMet,
            recall_curve_pp: Object.fromEntries(
                Object.entries(m.recallCurvePp).map(([kk, v]) => [kk, Number(v.toFixed(3))]),
            ),
            false_activation_at_k: Number(m.falseActivationPp.toFixed(3)),
            context_cost_tokens: Number(m.contextCostTokens.toFixed(1)),
            token_target_met: m.tokenTargetMet,
            benefit_unconditional: Number(m.benefitUnconditionalPp.toFixed(3)),
            benefit_conditional_on_activation: Number(m.benefitConditionalPp.toFixed(3)),
            adjudicated_deliveries: m.adjudicatedDeliveries,
            unadjudicated_deliveries: m.unadjudicatedDeliveries,
            tie_decided_cut_pp: Number(m.tieDecidedCutPp.toFixed(3)),
        },
        set_compatibility: {
            shared_prompts: m.sharedPrompts,
            jointly_wrong_pairs_delivered_at_k: m.jointlyWrongPairs.length,
            pairs_delivered_at_k: m.jointlyWrongPairs,
            jointly_wrong_pairs_in_corpus: m.jointlyWrongCandidates.length,
            candidates: m.jointlyWrongCandidates,
        },
        corpus: { partition: 'train', holdout_sealed: true, cases: m.cases, prompts: m.prompts },
    };
}

export function render(m: DeliveryMeasurement): string {
    const curve = CURVE_KS.map((ck) => `@${ck} ${(m.recallCurvePp[ck] ?? 0).toFixed(1)}%`).join('  ');
    return [
        `measure_delivery_sets — step 6.4, k=${m.k}`,
        `  index input ${m.indexInput.fields.join(' + ')} (${m.indexInput.reason})`,
        `  catalogue ${m.catalogueSize} · prompts ${m.prompts} · positives ${m.positives} · negatives ${m.negatives}`,
        `  precision@${m.k}             ${m.precisionPp.toFixed(2)} % over ${m.adjudicatedDeliveries} adjudicated deliveries`,
        `  recall@${m.k}                ${m.recallPp.toFixed(2)} %`,
        `  recall loss              ${m.recallLossPp.toFixed(2)} pp (ceiling ${RECALL_LOSS_CEILING_PP.toFixed(1)} pp: ${m.ceilingMet ? 'MET' : 'BREACHED'})`,
        `  recall curve             ${curve}`,
        `  false activation@${m.k}      ${m.falseActivationPp.toFixed(2)} %`,
        `  context cost             ${m.contextCostTokens.toFixed(1)} tokens/prompt (target ${TOKEN_TARGET}: ${m.tokenTargetMet ? 'MET' : 'BREACHED'})`,
        `  benefit unconditional    ${m.benefitUnconditionalPp.toFixed(2)} %`,
        `  benefit given activation ${m.benefitConditionalPp.toFixed(2)} %`,
        `  unadjudicated deliveries ${m.unadjudicatedDeliveries}`,
        `  tie-decided top-${m.k} cut   ${m.tieDecidedCutPp.toFixed(2)} % of prompts`,
        `  set compatibility        corpus ${m.jointlyWrongCandidates.length} jointly-wrong pair(s)` +
            ` over ${m.sharedPrompts} shared prompt(s); delivered together at k=${m.k}: ${m.jointlyWrongPairs.length}`,
        ...m.jointlyWrongCandidates.map(
            (p) =>
                `    - {${p.pair[0]}, ${p.pair[1]}} jointly delivered at k=` +
                `${p.jointlyDeliveredAtK ?? 'never (k<=20)'} :: ${p.prompt}`,
        ),
    ].join('\n');
}

export function main(argv: readonly string[]): number {
    const m = measureDelivery();
    if (argv.includes('--write')) {
        fs.writeFileSync(path.join(REPO, RECORD_REL), `${JSON.stringify(record(m), null, 2)}\n`);
    }
    process.stdout.write(
        argv.includes('--json') ? `${JSON.stringify(record(m), null, 2)}\n` : `${render(m)}\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (err) {
        process.stderr.write(`measure_delivery_sets: ${(err as Error).message}\n`);
        process.exit(2);
    }
}
