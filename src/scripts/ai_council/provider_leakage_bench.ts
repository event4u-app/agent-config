/**
 * Provider-recognition leakage bench — does anonymisation actually anonymise?
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 3, step 3.3:
 * "ask reviewers and judges to guess the provider family from anonymized
 * answers; measure recognition against chance. **Measurement first** — not a
 * justification for rewriting anything." Verified by "recognition rate and
 * chance baseline are both published".
 *
 * The council already strips provider identity from a peer-review or chairman
 * transcript (`consensus.anonymize_responses`, `blind_review.build_blind_labels`).
 * Stripping the LABEL is not the same as removing the SIGNAL: models have house
 * styles, and a reviewer that can name the author of `Response-B` is not blind,
 * whatever the header says. Nothing in this tree had ever measured that, so
 * "the council is blind" was an assumption with a mechanism behind it rather
 * than a result.
 *
 * ── This module measures; it does not decide ────────────────────────────────
 * Step 3.4 (style normalization) is gated on this bench's result, and the gate
 * lives here as `normalizationGateVerdict` so the gate cannot be satisfied by
 * prose. Its default with no data is `unrun`, which is NOT `below-bar`: the
 * difference is the whole point of the step. A null is what a measurement
 * returns; `unrun` is what you have before one.
 *
 * ── Why the transport is injected ───────────────────────────────────────────
 * Everything here is a pure function over data plus one `RaterFn` seam, the
 * same LIBRARY/RUNNER split `check_quality_regression.ts:19-24` uses: the
 * library is unit-tested against a scripted rater at zero cost, and the live
 * pass — which is a paid council call per item per rater — is the operator
 * step. A bench that could only be exercised by spending is a bench nobody
 * regression-tests.
 */

/** Provider families a rater may name. Closed set: an open guess is ungradeable. */
export interface LeakageOptions {
    /** The closed option list shown to every rater, in a fixed order. */
    readonly families: readonly string[];
}

/** One anonymised answer whose true author is known to the scorer, never to the rater. */
export interface LeakageItem {
    readonly id: string;
    /** The anonymised body exactly as a reviewer or judge would receive it. */
    readonly text: string;
    /** Ground truth. MUST be a member of `LeakageOptions.families`. */
    readonly true_family: string;
}

/** What a rater answered for one item. `null` = declined or unparseable. */
export interface LeakageGuess {
    readonly rater: string;
    readonly item_id: string;
    readonly guess: string | null;
}

/**
 * The paid seam. Given the closed option list and one anonymised body, return
 * the rater's guess, or `null` when it declined or its answer did not parse.
 */
export type RaterFn = (rater: string, item: LeakageItem, options: LeakageOptions) => string | null;

/**
 * The prompt a rater sees. Deliberately narrow: it asks ONLY for a family name
 * from the closed list, so a rater cannot pass by hedging and the answer is
 * gradeable without an LLM in the scoring loop.
 *
 * The body is NOT fenced here even though it is untrusted, and that is a
 * deliberate difference from `build_peer_review_user_prompt`. Fencing a body
 * inserts a nonce and a security preamble around it; this bench measures how
 * recognisable a body is, so anything the bench adds to the body is a confound
 * the live path does not have. The rater is asked for one word from a closed
 * list and its answer is matched against that list, so an injected instruction
 * has no schema to alter — the risk fencing buys back is absent by construction.
 */
export function buildRecognitionPrompt(item: LeakageItem, options: LeakageOptions): string {
    return [
        'Below is one anonymised answer produced by an AI model. Its provider',
        'identity has been stripped. Guess which provider family wrote it.',
        '',
        `Answer with EXACTLY one of: ${options.families.join(', ')}`,
        'Answer `unknown` if you genuinely cannot tell. Do not explain.',
        '',
        '---',
        '',
        item.text,
    ].join('\n');
}

/** Run the bench over `items` for each rater, via the injected paid seam. */
export function collectGuesses(
    raters: readonly string[],
    items: readonly LeakageItem[],
    options: LeakageOptions,
    ask: RaterFn,
): LeakageGuess[] {
    const out: LeakageGuess[] = [];
    for (const rater of raters) {
        for (const item of items) {
            const raw = ask(rater, item, options);
            const guess = raw !== null && options.families.includes(raw) ? raw : null;
            out.push({ rater, item_id: item.id, guess });
        }
    }
    return out;
}

export interface RecognitionResult {
    readonly rater: string;
    /** Guesses attempted, gradeable or not. */
    readonly attempted: number;
    /** Guesses that named a family in the closed list. */
    readonly gradeable: number;
    readonly correct: number;
    /** `correct / gradeable`, or `null` when nothing was gradeable. */
    readonly recognition_rate: number | null;
    /**
     * Chance under uniform guessing over the closed list — `1 / families`.
     */
    readonly chance_uniform: number;
    /**
     * Chance for the best CONSTANT guesser: the largest share any single family
     * holds in the graded items. Published beside the uniform baseline because
     * a skewed corpus makes uniform chance the wrong bar — a rater that always
     * says the majority family beats `1/k` while recognising nothing.
     */
    readonly chance_majority: number;
    /**
     * One-sided exact binomial tail: P(at least `correct` successes in
     * `gradeable` trials at the STRICTER of the two baselines). `null` when
     * nothing was gradeable.
     */
    readonly p_value: number | null;
}

/** Score one rater's guesses against ground truth. */
export function scoreRecognition(
    rater: string,
    guesses: readonly LeakageGuess[],
    items: readonly LeakageItem[],
    options: LeakageOptions,
): RecognitionResult {
    const truth = new Map(items.map((i) => [i.id, i.true_family]));
    const mine = guesses.filter((g) => g.rater === rater);
    let gradeable = 0;
    let correct = 0;
    const gradedFamilies: string[] = [];
    for (const g of mine) {
        if (g.guess === null) {
            continue;
        }
        const t = truth.get(g.item_id);
        if (t === undefined) {
            continue;
        }
        gradeable += 1;
        gradedFamilies.push(t);
        if (g.guess === t) {
            correct += 1;
        }
    }
    const k = options.families.length;
    const chance_uniform = k > 0 ? 1 / k : 0;
    const counts = new Map<string, number>();
    for (const f of gradedFamilies) {
        counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const chance_majority = gradeable > 0 ? Math.max(...counts.values()) / gradeable : 0;
    const bar = Math.max(chance_uniform, chance_majority);
    return {
        rater,
        attempted: mine.length,
        gradeable,
        correct,
        recognition_rate: gradeable > 0 ? correct / gradeable : null,
        chance_uniform,
        chance_majority,
        p_value: gradeable > 0 ? binomialUpperTail(correct, gradeable, bar) : null,
    };
}

/**
 * P(X >= k) for X ~ Binomial(n, p), computed exactly.
 *
 * Exact rather than normal-approximated because this bench's honest sample size
 * is small — a few dozen graded items — and a normal approximation at n=20 is
 * the kind of shortcut that turns a null into a finding.
 */
export function binomialUpperTail(k: number, n: number, p: number): number {
    if (n <= 0) {
        return 1;
    }
    if (k <= 0) {
        return 1;
    }
    if (p <= 0) {
        return k > 0 ? 0 : 1;
    }
    if (p >= 1) {
        return k <= n ? 1 : 0;
    }
    let total = 0;
    for (let i = k; i <= n; i += 1) {
        total += Math.exp(_logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log1p(-p));
    }
    return Math.min(1, Math.max(0, total));
}

function _logChoose(n: number, k: number): number {
    return _logGamma(n + 1) - _logGamma(k + 1) - _logGamma(n - k + 1);
}

/** Lanczos log-gamma — enough precision for the small n this bench grades. */
function _logGamma(x: number): number {
    const g = [
        76.18009172947146, -86.5053203294167, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
        -0.5395239384953e-5,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j += 1) {
        y += 1;
        ser += (g[j] as number) / y;
    }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// ── Step 3.4 — the gate style normalization has to clear ────────────────────

/**
 * The step's two conditions, verbatim: normalization lands only if this tree's
 * own leakage bench shows "materially above-chance recognition **and** that
 * recognition correlates with judgment distortion".
 */
export interface NormalizationGateInput {
    /** Per-rater recognition results. Empty = the bench has not been run. */
    readonly recognition: readonly RecognitionResult[];
    /**
     * Whether a SEPARATE measurement established that recognition correlates
     * with judgment distortion. `null` when that arm has not been run — which is
     * not the same as "measured and found absent", and is why this is
     * three-valued rather than a boolean.
     */
    readonly distortion_correlated: boolean | null;
    /** Significance bar for "materially above chance". */
    readonly alpha?: number;
}

export type NormalizationVerdict =
    /** The bench has not produced data. Not a null — nothing was measured. */
    | 'unrun'
    /** Measured, and at least one condition failed. Normalization must NOT land. */
    | 'below-bar'
    /** Both conditions recorded met. Normalization is permitted, still not required. */
    | 'bar-cleared';

export interface NormalizationGateResult {
    readonly verdict: NormalizationVerdict;
    /** Why, in one clause, printable beside the verdict. */
    readonly reason: string;
}

/**
 * Decide whether step 3.4 may proceed.
 *
 * Fails CLOSED in every ambiguous direction: no gradeable data, or a distortion
 * arm that was never run, returns `unrun` and not `below-bar` — because
 * "measured and found harmless" is a claim, and this function must never make
 * one on behalf of a measurement nobody took.
 */
export function normalizationGateVerdict(input: NormalizationGateInput): NormalizationGateResult {
    const alpha = input.alpha ?? 0.05;
    const graded = input.recognition.filter((r) => r.gradeable > 0);
    if (graded.length === 0) {
        return {
            verdict: 'unrun',
            reason: 'no gradeable recognition data — the leakage bench has not been run',
        };
    }
    const significant = graded.filter((r) => r.p_value !== null && r.p_value < alpha);
    if (significant.length === 0) {
        return {
            verdict: 'below-bar',
            reason:
                `no rater recognised the provider above chance at alpha=${String(alpha)} ` +
                `(${String(graded.length)} rater(s) graded) — condition 1 not met`,
        };
    }
    if (input.distortion_correlated === null) {
        return {
            verdict: 'unrun',
            reason:
                `${String(significant.length)} rater(s) recognise above chance, but the ` +
                'recognition-to-distortion correlation arm has not been run — condition 2 unmeasured',
        };
    }
    if (!input.distortion_correlated) {
        return {
            verdict: 'below-bar',
            reason: 'recognition is above chance but does not correlate with judgment distortion — condition 2 not met',
        };
    }
    return {
        verdict: 'bar-cleared',
        reason:
            `${String(significant.length)} rater(s) recognise above chance AND recognition correlates ` +
            'with judgment distortion — both conditions recorded met',
    };
}

/** The publishable block: recognition rate AND chance baseline, per the step's verify. */
export function renderRecognitionReport(rows: readonly RecognitionResult[]): string {
    if (rows.length === 0) {
        return 'provider-recognition leakage: NOT RUN — no rater produced a guess.';
    }
    const pct = (v: number | null): string => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
    return rows
        .map(
            (r) =>
                `recognition · ${r.rater}: ${pct(r.recognition_rate)} ` +
                `(${String(r.correct)}/${String(r.gradeable)} gradeable of ${String(r.attempted)} attempted) · ` +
                `chance uniform ${pct(r.chance_uniform)} · chance majority-class ${pct(r.chance_majority)} · ` +
                `p=${r.p_value === null ? 'n/a' : r.p_value.toFixed(4)}`,
        )
        .join('\n');
}
