/**
 * The three-arm delivery experiment — `road-to-governed-harness-evolution` 6.1.
 *
 * WHAT 6.1 ASKS, AND WHY IT IS NOT THE PRICE GRID. Step 6.1 says: measure
 * `eager-all` against `thin` against `delivery` — the three values
 * `_lib/lean_projection_mode.ts:19` already declares — BEFORE any new retrieval
 * component is written. `model_rule_injection.ts` already prices those three
 * shapes, and a price grid is a cost model rather than a delivery measurement:
 * it reports what each shape COSTS and never what each shape DELIVERS. The
 * three arms differ on exactly one observable, and it is not cost:
 *
 *   for a given prompt, is the labelled rule's BODY in the model's context?
 *
 * That question is decidable from the tree, so this module answers it for all
 * three arms over one corpus with one matcher, and reports the cost figures
 * beside it so the arms are commensurable on one table.
 *
 * WHAT EACH ARM PUTS IN CONTEXT, read off the two consumers of the mode rather
 * than assumed. `condense.ts:1124` calls `writesThinFiles(mode)`, so `thin` and
 * `delivery` project pointer stubs where `eager-all` projects bodies;
 * `hooks/rule_inject_hook.ts:230` calls `deliversBodies(mode)`, so only
 * `delivery` binds the concern that injects matched bodies back at prompt time.
 * Hence:
 *
 *   eager-all  every projected body is standing.
 *   thin       kernel bodies + no-trigger residue bodies are standing; every
 *              other body is a pointer and is NOT in context. Nothing is
 *              injected, because the concern is not bound.
 *   delivery   thin's standing set, PLUS the bodies `selectForInjection`
 *              returns for this prompt under the concern's byte cap.
 *
 * The `thin` standing set mirrors `standingCorpora` in `model_rule_injection.ts`
 * — kernel or triggerless keeps a body, anything else becomes a pointer — so the
 * delivery half and the cost half classify each rule the same way. Two
 * classifications would be the "measures nothing" defect `_lib/rule_injection.ts`
 * names in its own header.
 *
 * NO SECOND MATCHER, WHICH IS 6.2'S CONSTRAINT AND THIS MODULE'S TOO. Every
 * match here comes from `matchTierRules`, and every selection from
 * `selectForInjection` — both in `_lib/rule_injection.ts`, which owns no matcher
 * of its own and wraps `_lib/router_match.ts`. This module imports nothing else
 * that could answer "which rules fire on this prompt?", and
 * `tests/scripts/single_matcher_preserved.test.ts` fails if it ever does.
 *
 * ZERO MODEL CALLS, and the property follows from the imports rather than from
 * good behaviour: the only import is `_lib/rule_injection.js`, which reads files.
 * Token counting and the standing-corpus sizes are PARAMETERS, not imports, so
 * this module carries no tokenizer and no network surface at all.
 *
 * WHAT IT DOES NOT MEASURE, stated because the gap is the interesting half.
 * It does not measure whether a session that RECEIVES a body behaves like a
 * session that HAD it standing. That is not an expense this run declined to pay
 * — the instrument is closed by ADR-202 (`docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md`),
 * whose status reads "instrument not achievable with available evaluators" at an
 * inter-evaluator kappa of 0.472 against a registered floor of 0.800, with no
 * third attempt licensed. Nothing printed here is evidence about quality.
 */
import {
    kernelIds,
    loadRuleBody,
    matchTierRules,
    selectForInjection,
    triggerlessRuleIds,
    type Router,
} from './rule_injection.js';

/** The three arms, named exactly as `LeanProjectionMode` declares them. */
export const ARMS = ['eager-all', 'thin', 'delivery'] as const;
export type ArmName = (typeof ARMS)[number];

/** The corpus fields this experiment reads. Structurally a `CorpusCase`. */
export interface LabelledCase {
    readonly rule: string;
    readonly prompt: string;
    readonly openFiles: string[] | null;
    readonly label: 'positive' | 'near_miss';
}

export interface ArmRow {
    readonly arm: ArmName;
    /** Positives whose labelled rule body is in context under this arm. */
    readonly delivered: number;
    readonly positives: number;
    /** Near-miss prompts whose labelled rule body is nevertheless in context. */
    readonly falseContext: number;
    readonly nearMisses: number;
    /** Positives the matcher fired on but the byte cap then dropped. */
    readonly capDropped: number;
    /** Exact-BPE tokens standing in context before the first prompt. */
    readonly standingTokens: number;
    /** Mean exact-BPE tokens injected per positive prompt. */
    readonly injectedMeanTokens: number;
    /** Same, at the 90th percentile. */
    readonly injectedP90Tokens: number;
}

export interface ArmExperimentInput {
    readonly repoRoot: string;
    readonly router: Router;
    readonly cases: readonly LabelledCase[];
    /** The concern's per-prompt byte cap. The sensitivity handle. */
    readonly capBytes: number;
    /** Standing exact-BPE tokens per arm, supplied by the caller. */
    readonly standing: Readonly<Record<ArmName, number>>;
    /** Exact-BPE tokenizer, injected so this module imports none. */
    readonly tokensOf: (text: string) => number;
    /**
     * STEP 6.3 — optional per-prompt lexical shortlist, injected so this module
     * builds no index of its own.
     *
     * Absent (the default) the delivery arm is byte-for-byte the arm 6.1
     * measured, which is why its recorded figures stay reproducible. Present,
     * it reaches `selectForInjection` as a TIE-BREAK under the matcher's score —
     * it can change which matched bodies survive a binding cap and can change
     * nothing else, so `delivered` can only move through `capDropped`.
     */
    readonly shortlist?: ((prompt: string) => readonly string[]) | null;
}

/**
 * Ids whose FULL body is standing under `thin` and `delivery`.
 *
 * Kernel is standing by definition; a rule with no trigger cannot be delivered,
 * so the projector keeps it eager under the thin shapes too.
 */
export function thinStandingIds(router: Router): Set<string> {
    const ids = new Set<string>(kernelIds(router));
    for (const id of triggerlessRuleIds(router)) ids.add(id);
    return ids;
}

/** Nearest-rank quantile over a copy. Deterministic. */
function quantile(values: readonly number[], q: number): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
    return s[idx] as number;
}

function mean(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Ids projected with a real body file — the `eager-all` standing set. */
function hasBody(repoRoot: string, id: string): boolean {
    return loadRuleBody(repoRoot, id) !== null;
}

/**
 * Run the experiment. Pure over its inputs; two runs are byte-identical.
 *
 * One walk over the corpus computes all three arms, so no arm can be scored on
 * a different case set than another.
 */
export function runArmExperiment(input: ArmExperimentInput): ArmRow[] {
    const { repoRoot, router, cases, capBytes, standing, tokensOf, shortlist } = input;
    const thinStanding = thinStandingIds(router);

    const delivered: Record<ArmName, number> = { 'eager-all': 0, thin: 0, delivery: 0 };
    const falseContext: Record<ArmName, number> = { 'eager-all': 0, thin: 0, delivery: 0 };
    let positives = 0;
    let nearMisses = 0;
    let capDropped = 0;
    const injectedTokens: number[] = [];

    for (const c of cases) {
        const inEager = hasBody(repoRoot, c.rule);
        const inThin = thinStanding.has(c.rule) && inEager;

        const matches = matchTierRules(router, c.prompt, c.openFiles);
        const sel = selectForInjection(
            repoRoot,
            matches,
            capBytes,
            shortlist ? shortlist(c.prompt) : null,
        );
        const injectedIds = new Set(sel.selected.map((m) => m.id));
        const inDelivery = inThin || injectedIds.has(c.rule);

        if (c.label === 'positive') {
            positives += 1;
            if (inEager) delivered['eager-all'] += 1;
            if (inThin) delivered.thin += 1;
            if (inDelivery) delivered.delivery += 1;
            if (sel.dropped.some((m) => m.id === c.rule)) capDropped += 1;
            let tokens = 0;
            for (const m of sel.selected) tokens += tokensOf(loadRuleBody(repoRoot, m.id) ?? '');
            injectedTokens.push(tokens);
        } else {
            nearMisses += 1;
            if (inEager) falseContext['eager-all'] += 1;
            if (inThin) falseContext.thin += 1;
            if (inDelivery) falseContext.delivery += 1;
        }
    }

    const injMean = Math.round(mean(injectedTokens));
    const injP90 = quantile(injectedTokens, 0.9);
    return ARMS.map((arm) => ({
        arm,
        delivered: delivered[arm],
        positives,
        falseContext: falseContext[arm],
        nearMisses,
        capDropped: arm === 'delivery' ? capDropped : 0,
        standingTokens: standing[arm],
        injectedMeanTokens: arm === 'delivery' ? injMean : 0,
        injectedP90Tokens: arm === 'delivery' ? injP90 : 0,
    }));
}

function ratio(hits: number, total: number): string {
    return total === 0 ? '—' : (hits / total).toFixed(3);
}

function signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
}

/**
 * Render the report. The pairwise deltas are printed, not left to the reader:
 * "measured against one another" is a comparison, and a table of three
 * independent rows is three measurements rather than one comparison.
 */
export function renderArmExperiment(rows: readonly ArmRow[], capBytes: number): string[] {
    const by = new Map<ArmName, ArmRow>(rows.map((r) => [r.arm, r]));
    const eager = by.get('eager-all') as ArmRow;
    const thin = by.get('thin') as ArmRow;
    const delivery = by.get('delivery') as ArmRow;

    const out: string[] = [];
    const push = (s: string): void => {
        out.push(s);
    };

    push('── three-arm delivery experiment (road-to-governed-harness-evolution 6.1) ──');
    push(
        `arms = LeanProjectionMode (_lib/lean_projection_mode.ts:19) · ` +
            `one corpus · one matcher (_lib/router_match.ts) · cap ${capBytes} B`,
    );
    push('');
    push('  arm          delivery(pos)    false-context(near-miss)   standing tok   injected tok/prompt');
    for (const r of rows) {
        const inj =
            r.arm === 'delivery'
                ? `mean ${r.injectedMeanTokens} p90 ${r.injectedP90Tokens}`
                : '0';
        push(
            `  ${r.arm.padEnd(12)} ${ratio(r.delivered, r.positives)} (${r.delivered}/${r.positives})`.padEnd(
                33,
            ) +
                `${ratio(r.falseContext, r.nearMisses)} (${r.falseContext}/${r.nearMisses})`.padEnd(27) +
                `${r.standingTokens}`.padEnd(15) +
                inj,
        );
    }
    push('');
    push('── pairwise deltas ──');
    push(
        `  thin      vs eager-all: delivery ${signed(thin.delivered - eager.delivered)} positives · ` +
            `standing ${signed(thin.standingTokens - eager.standingTokens)} tok`,
    );
    push(
        `  delivery  vs eager-all: delivery ${signed(delivery.delivered - eager.delivered)} positives · ` +
            `standing ${signed(delivery.standingTokens - eager.standingTokens)} tok`,
    );
    push(
        `  delivery  vs thin:      delivery ${signed(delivery.delivered - thin.delivered)} positives · ` +
            `standing ${signed(delivery.standingTokens - thin.standingTokens)} tok`,
    );
    push(`  cap-dropped under delivery: ${delivery.capDropped} of ${delivery.positives} positives`);
    push('');
    push(
        'This measures WHICH BODIES REACH CONTEXT and what they cost. It does not',
    );
    push(
        'measure whether a delivered body behaves like a standing one — that instrument',
    );
    push('is closed by ADR-202 and this run does not reopen it.');
    return out;
}
