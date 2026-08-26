/**
 * Judge hygiene — what an assertion is worth, and what a pass verdict must show.
 *
 * `road-to-skill-ecosystem-eval-integrity` Phase 3, Steps 3–6. Steps 1 and 2
 * (blinding and the order-swap) were already met by
 * `check_quality_regression.evaluatePair`, which judges every pair in both
 * orders and resolves a flip to `inconsistent` rather than to a winner — that
 * is stronger than the step's own "default to a tie", because a flagged tie is
 * still a tie in a denominator while `inconsistent` is its own bucket with its
 * own reported rate.
 *
 * ── Why an assertion that always passes is worse than no assertion ──────────
 * It inflates the treatment pass rate without reflecting any value: both arms
 * satisfy it, so it contributes a guaranteed point to each and narrows nothing.
 * The reverse — an assertion that always fails — is not noise but a broken
 * check or an impossible expectation, and it is worth finding for a different
 * reason. The interesting set is neither: the assertions that pass in treatment
 * and fail in control ARE the measurement, and everything else is overhead
 * masquerading as coverage.
 */

/** How a rubric item or assertion is phrased, which is what overfitting looks like. */
export type OverfitShape = 'outcome' | 'technique' | 'vocabulary';

export interface OverfitClassification {
    shape: OverfitShape;
    /** Why this shape, in one clause, printable in an advisory report. */
    reason: string;
}

/**
 * Phrases that name HOW rather than WHAT.
 *
 * `technique` is an assertion that prescribes a mechanism — it passes only for
 * an implementation that took the route the author had in mind, so a better
 * solution scores lower. `vocabulary` is narrower and worse: it checks that a
 * particular WORD appears, which any arm can satisfy by saying the word.
 */
const TECHNIQUE_MARKERS = [
    'using ',
    'by calling',
    'via ',
    'with the helper',
    'implemented as',
    'should call',
    'must call',
    'invokes',
];

const VOCABULARY_MARKERS = [
    'mentions',
    'contains the word',
    'uses the term',
    'the phrase',
    'says ',
    'literally',
];

/**
 * Classify one criterion by shape. ADVISORY — this gates nothing.
 *
 * Deliberately a keyword heuristic and deliberately never a verdict input. A
 * classifier that decided anything would need to be right, and no phrase list
 * is right about natural language; what it can do honestly is put a shape
 * beside each item so a human reviewing a rubric sees that nine of twelve items
 * check vocabulary. That is a real finding and it costs nothing to be wrong
 * about one of them.
 */
export function classifyOverfit(criterion: string): OverfitClassification {
    const c = criterion.toLowerCase();
    for (const m of VOCABULARY_MARKERS) {
        if (c.includes(m)) {
            return {
                shape: 'vocabulary',
                reason: `phrased around wording ("${m.trim()}") — any arm passes by saying the word`,
            };
        }
    }
    for (const m of TECHNIQUE_MARKERS) {
        if (c.includes(m)) {
            return {
                shape: 'technique',
                reason: `prescribes a mechanism ("${m.trim()}") — a better route scores lower`,
            };
        }
    }
    return { shape: 'outcome', reason: 'phrased as a result rather than a route or a wording' };
}

/** One assertion's behaviour across both arms of a paired run. */
export interface AssertionObservation {
    id: string;
    /** Trials where this assertion passed in the treatment arm. */
    treatment_passes: number;
    /** Trials where it passed in the control arm. */
    control_passes: number;
    trials: number;
}

export type AssertionVerdict =
    | 'discriminating'
    | 'non-discriminating-always-pass'
    | 'non-discriminating-always-fail'
    | 'inverted'
    | 'partial';

export interface AssertionFinding {
    id: string;
    verdict: AssertionVerdict;
    /** The prescribed action, so the report does not stop at a label. */
    action: string;
}

/**
 * Classify an assertion by whether it separates the arms.
 *
 * The pruning rule of Step 5 is expressed HERE rather than as prose in a
 * document, because a rule that lives only in a document is applied by whoever
 * remembers it:
 *
 *   · always passes in both  → REMOVE or replace. It is pure inflation.
 *   · always fails in both   → INVESTIGATE. A broken check or an impossible bar.
 *   · treatment > control    → KEEP. This is where the value is.
 *   · control > treatment    → KEEP and read it. An inverted assertion is a
 *                              finding about the treatment, not a defect here.
 */
export function classifyAssertion(o: AssertionObservation): AssertionFinding {
    if (o.trials <= 0) {
        return {
            id: o.id,
            verdict: 'partial',
            action: 'no trials — the assertion was never exercised, which is not a result',
        };
    }
    const allT = o.treatment_passes === o.trials;
    const allC = o.control_passes === o.trials;
    const noneT = o.treatment_passes === 0;
    const noneC = o.control_passes === 0;
    if (allT && allC) {
        return {
            id: o.id,
            verdict: 'non-discriminating-always-pass',
            action:
                'remove or replace — it passes in both arms, so it adds a guaranteed point to each ' +
                'and inflates the treatment pass rate without reflecting value',
        };
    }
    if (noneT && noneC) {
        return {
            id: o.id,
            verdict: 'non-discriminating-always-fail',
            action:
                'investigate — an assertion nothing satisfies is a broken check or an impossible ' +
                'expectation, not a measurement of the treatment',
        };
    }
    if (o.treatment_passes > o.control_passes) {
        return { id: o.id, verdict: 'discriminating', action: 'keep — this is where the value is' };
    }
    if (o.control_passes > o.treatment_passes) {
        return {
            id: o.id,
            verdict: 'inverted',
            action:
                'keep and read it — the control satisfies this more often, which is a finding about ' +
                'the treatment rather than a defect in the assertion',
        };
    }
    return {
        id: o.id,
        verdict: 'partial',
        action: 'keep — equal pass counts but not saturated, so it still carries information',
    };
}

/** Summary a report can print, with the inflation number named. */
export interface AssertionAudit {
    findings: readonly AssertionFinding[];
    discriminating: number;
    non_discriminating: number;
    /** Points every arm is guaranteed by always-pass assertions. */
    guaranteed_points: number;
}

export function auditAssertions(obs: readonly AssertionObservation[]): AssertionAudit {
    const findings = obs.map(classifyAssertion);
    const nd = findings.filter((f) => f.verdict.startsWith('non-discriminating')).length;
    return {
        findings,
        discriminating: findings.filter((f) => f.verdict === 'discriminating').length,
        non_discriminating: nd,
        guaranteed_points: findings.filter((f) => f.verdict === 'non-discriminating-always-pass').length,
    };
}

/**
 * Does a section carry EVIDENCE, or only the label a pass was looking for?
 *
 * Step 6. The failure it names is specific and common: a section headed with the
 * expected label followed by one vague sentence scores as a pass, because the
 * label being present was mistaken for the substance being present. The check is
 * deliberately crude — a length floor plus a concreteness signal — because the
 * alternative is a judge, and a judge is the thing whose output this is meant to
 * check.
 *
 * Returns `null` when the section passes, or the reason it does not.
 */
export function evidenceDeficit(section: string, opts: { minWords?: number } = {}): string | null {
    const minWords = opts.minWords ?? 25;
    const body = section.replace(/^#{1,6} .*$/gm, '').trim();
    const words = body.split(/\s+/).filter((w) => w !== '').length;
    if (words < minWords) {
        return `carries ${String(words)} word(s) of body, below the ${String(minWords)}-word floor — ` +
            'the label is present and the substance is not';
    }
    // A concrete claim cites something a reader can check: a path, a number, a
    // command, an identifier. Prose with none of those is an assertion about
    // itself.
    const concrete =
        /[\w./-]+\.(?:ts|js|md|json|ya?ml|py|sh)\b/.test(body) ||
        /\b\d+(?:\.\d+)?\s*(?:%|ms|s|MB|KB|lines?|files?|cases?|trials?)\b/.test(body) ||
        /`[^`]+`/.test(body);
    if (!concrete) {
        return 'no checkable reference — no path, no measured figure, no identifier. A section that ' +
            'cites nothing is a claim about itself.';
    }
    return null;
}
