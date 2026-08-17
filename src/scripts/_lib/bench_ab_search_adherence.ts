/**
 * T5 — search adherence, rubric-judged at k=2.
 *
 * The pre-registration (`internal/bench/ab-v2-phase3-PREREG.md` § Thresholds)
 * defines T5 as *"search-adherence (rubric-judged, k=2)"* with the rationale
 * from F8: the ladder enforces a **search** discipline, while lines-of-code
 * measures output volume. A run can shrink a diff without anyone having looked
 * for an existing mechanism, so a size-only report measures the wrong
 * hypothesis. This module scores the question the roadmap asks — *did the run
 * demonstrably consider a cheaper existing mechanism before writing new code* —
 * off the trial's own transcript.
 *
 * WHY A RUBRIC HERE AND AN EXECUTION PROBE FOR T4. The two endpoints are not
 * the same shape and the pre-registration already says so, tagging only this
 * one `rubric-judged`. T4 asks whether a property still holds in the running
 * code, which an interpreter answers. T5 asks what the run *did before it
 * wrote* — an act with no residue in the final tree at all. There is nothing to
 * execute; the transcript is the only evidence, and reading it is a judgement.
 *
 * WHY k=2 AND WHY THE AGGREGATION IS CONSERVATIVE. One judge on a
 * judgement-shaped rubric is a single point of failure whose error is invisible.
 * Two judges make disagreement observable, and `resolveK2` counts an item as
 * satisfied only when **both** agree it was — the same asymmetry
 * `_lib/anchor_eval.ts` uses, and for the same reason: the failure that matters
 * is crediting adherence that did not happen. Crediting it needs unanimity;
 * denying it needs one.
 *
 * NULL, NEVER ZERO. A judge that cannot answer after its one retry makes the
 * TRIAL unmeasured, not zero-scoring. A zero would say "this run looked for
 * nothing", which is a claim about the run; the truth is a claim about the
 * measurement. `compare()` requires the metric on both sides of a pair, so an
 * unmeasured trial removes its pair rather than biasing it.
 *
 * PURE BY CONSTRUCTION. Nothing here imports a model client. The judge arrives
 * as an injected `AskFn`, which is what lets every property below be pinned in
 * a unit test with no key, no network, and no spend — the idiom
 * `bench_quality_run.ts` and `anchor_eval.ts` already use.
 */
import { ALPHA, type PairedContinuous } from './bench_ab_size_claim.js';

/** The three rubric items, in the order the prompt presents them. */
export const SEARCH_RUBRIC_ITEMS = ['named', 'inspected', 'justified'] as const;
export type SearchRubricItem = (typeof SEARCH_RUBRIC_ITEMS)[number];

/** Pre-registered judge count. */
export const SEARCH_ADHERENCE_K = 2;

/** A judge: one prompt in, one raw completion out. */
export type AskFn = (prompt: string) => string;

export interface JudgeReading {
    /** Per item: `true` satisfied, `false` not, `null` unparseable. */
    items: Record<SearchRubricItem, boolean | null>;
    /** True when every item parsed to a boolean. */
    complete: boolean;
}

export interface SearchAdherenceResult {
    /** Fraction of rubric items both judges credited, or `null` if unmeasured. */
    score: number | null;
    readings: JudgeReading[];
    reason: string;
}

/**
 * Delimiters around the transcript inside the judge prompt.
 *
 * They exist because the RUBRIC that follows the transcript necessarily
 * contains the very words the rubric asks about — "reuse", "existing", "read",
 * "grepped", "because". Any reader that slices the prompt at `TRANSCRIPT:` and
 * takes the rest is therefore reading the instrument, not the evidence, and
 * scores every input at the ceiling. That is not hypothetical: the dry-run
 * judge did exactly this on its first pass and its own test caught it.
 */
export const TRANSCRIPT_OPEN = '--- BEGIN TRANSCRIPT ---';
export const TRANSCRIPT_CLOSE = '--- END TRANSCRIPT ---';

/**
 * Extract the transcript back out of a built prompt.
 *
 * Returns `''` when the delimiters are absent, which yields a credit-nothing
 * reading rather than a ceiling one — the safe direction for a rubric whose
 * failure mode is crediting adherence that did not happen.
 */
export function transcriptFromPrompt(prompt: string): string {
    const start = prompt.indexOf(TRANSCRIPT_OPEN);
    const end = prompt.indexOf(TRANSCRIPT_CLOSE);
    if (start === -1 || end === -1 || end <= start) return '';
    return prompt.slice(start + TRANSCRIPT_OPEN.length, end);
}

/**
 * Build the judge prompt.
 *
 * Three properties are deliberate. The rubric is **stated as evidence tests**,
 * not as a quality opinion — each item asks whether a specific thing appears in
 * the transcript, so two judges are reading for the same artefact rather than
 * forming the same taste. The output shape is a fixed three-line block, which
 * makes an incomplete answer detectable instead of silently half-parsed. And it
 * says explicitly not to reward brevity: T5 exists precisely because a shorter
 * diff is not evidence of a search, so a judge rewarding shortness here would
 * launder T1 into T5 and destroy the independence the pair depends on.
 */
export function searchAdherencePrompt(taskPrompt: string, transcript: string): string {
    return [
        'You are scoring one transcript against a three-item evidence rubric.',
        'Answer only from what the transcript shows. Do not infer intent, and do',
        'not reward or penalise how long, short, or elegant the resulting change is.',
        '',
        'TASK GIVEN TO THE RUN:',
        taskPrompt,
        '',
        TRANSCRIPT_OPEN,
        transcript,
        TRANSCRIPT_CLOSE,
        '',
        'RUBRIC — for each item answer yes or no:',
        'NAMED: before writing new code, the run named a specific existing mechanism',
        '  it could reuse instead (a file, function, class, library, or built-in).',
        '  A generic statement that something might already exist is NOT enough.',
        'INSPECTED: the run actually looked at that mechanism — read, listed, grepped,',
        '  or opened it — rather than only mentioning it.',
        'JUSTIFIED: the run stated why it did or did not reuse what it found.',
        '',
        'Answer with exactly these three lines and nothing else:',
        'NAMED: yes|no',
        'INSPECTED: yes|no',
        'JUSTIFIED: yes|no',
    ].join('\n');
}

// Leading whitespace is tolerated on purpose: a judge that indents its block,
// or emits it inside a list, has still answered. Anchoring hard at column 0
// dropped exactly that item to `null`, which then reads as "incomplete reading"
// and discards a trial for a formatting habit.
const _LINE = /^[ \t>*-]*(NAMED|INSPECTED|JUSTIFIED)\s*:\s*(yes|no)\b/gim;
const _KEY_TO_ITEM: Record<string, SearchRubricItem> = {
    NAMED: 'named',
    INSPECTED: 'inspected',
    JUSTIFIED: 'justified',
};

/**
 * Parse one judge completion.
 *
 * Unmatched items stay `null` and `complete` goes false — the caller retries
 * once and then gives up on the trial. Defaulting a missing line to `no` would
 * be the cheap read and the wrong one: it converts "the judge did not answer"
 * into "the run did not search", which is a different claim and the one this
 * endpoint is measuring.
 */
export function parseSearchVerdict(text: string): JudgeReading {
    const items: Record<SearchRubricItem, boolean | null> = {
        named: null,
        inspected: null,
        justified: null,
    };
    _LINE.lastIndex = 0;
    let m: RegExpExecArray | null = _LINE.exec(text ?? '');
    while (m !== null) {
        const item = _KEY_TO_ITEM[(m[1] ?? '').toUpperCase()];
        if (item !== undefined && items[item] === null) {
            items[item] = (m[2] ?? '').toLowerCase() === 'yes';
        }
        m = _LINE.exec(text ?? '');
    }
    const complete = SEARCH_RUBRIC_ITEMS.every((k) => items[k] !== null);
    return { items, complete };
}

/**
 * Combine two readings — an item counts only when both judges credit it.
 *
 * Returns the satisfied-item count, never a score, so the caller owns the
 * denominator. A `null` on either side is not a credit, which is the same
 * direction as a `no`: the burden is on evidence of a search, not on evidence
 * of its absence.
 */
export function resolveK2(a: JudgeReading, b: JudgeReading): number {
    let credited = 0;
    for (const key of SEARCH_RUBRIC_ITEMS) {
        if (a.items[key] === true && b.items[key] === true) credited += 1;
    }
    return credited;
}

/**
 * Ask one judge, with exactly one retry on an unparseable or partial answer.
 *
 * One retry, not a loop: a judge that produced half a block twice is telling us
 * something about the prompt or the model, and burning further calls on it
 * would spend money to keep a bad reading warm.
 */
export function askWithRetry(ask: AskFn, prompt: string): JudgeReading {
    let reading: JudgeReading;
    try {
        reading = parseSearchVerdict(ask(prompt));
    } catch {
        reading = { items: { named: null, inspected: null, justified: null }, complete: false };
    }
    if (reading.complete) return reading;
    try {
        return parseSearchVerdict(ask(prompt));
    } catch {
        return { items: { named: null, inspected: null, justified: null }, complete: false };
    }
}

/**
 * Score one trial at k=2.
 *
 * `asks` carries one judge per element — two distinct judges is the pre-
 * registered shape, and passing the SAME function twice is accepted rather than
 * rejected because that is the legitimate degraded case (one vendor reachable);
 * the caller records which it used. Fewer than two, or any judge that never
 * produced a complete reading, yields `null`.
 */
export function scoreSearchAdherence(opts: {
    asks: AskFn[];
    taskPrompt: string;
    transcript: string;
}): SearchAdherenceResult {
    const { asks, taskPrompt, transcript } = opts;
    if (asks.length < SEARCH_ADHERENCE_K) {
        return { score: null, readings: [], reason: `fewer than k=${SEARCH_ADHERENCE_K} judges supplied` };
    }
    if (!transcript || transcript.trim() === '') {
        return { score: null, readings: [], reason: 'no transcript recorded for this trial' };
    }
    const prompt = searchAdherencePrompt(taskPrompt, transcript);
    const readings = asks.slice(0, SEARCH_ADHERENCE_K).map((ask) => askWithRetry(ask, prompt));
    const incomplete = readings.filter((r) => !r.complete).length;
    if (incomplete > 0) {
        return {
            score: null,
            readings,
            reason: `${incomplete} of ${readings.length} judges returned an incomplete reading after one retry`,
        };
    }
    const credited = resolveK2(readings[0] as JudgeReading, readings[1] as JudgeReading);
    return {
        score: credited / SEARCH_RUBRIC_ITEMS.length,
        readings,
        reason: `${credited}/${SEARCH_RUBRIC_ITEMS.length} rubric items credited by both judges`,
    };
}

export interface SearchClaimInput {
    arm_treatment: string | null;
    arm_baseline: string | null;
    search: PairedContinuous;
}

export interface SearchClaimVerdict {
    arm_treatment: string | null;
    arm_baseline: string | null;
    verdict: 'PASS' | 'REFUSED-SEARCH-REGRESSION' | 'INCONCLUSIVE';
    reason: string;
    search_measured: boolean;
}

/**
 * Evaluate T5 for one comparison.
 *
 * The pre-registered threshold is *no significant regression*, two-sided at
 * p < 0.05 in the harmful direction — so `PASS` is "the test did not reject",
 * NOT "the treatment scored higher". Reading a non-rejection as a win is the
 * mistake this comment exists to prevent: T5 is a guard on the size claim, not
 * a second thing the ladder gets to win.
 *
 * An unmeasured endpoint is `INCONCLUSIVE`, never a pass — the same contract
 * `evaluateSizeClaim` holds for T1/T2/T4.
 */
export function evaluateSearchAdherence(input: SearchClaimInput): SearchClaimVerdict {
    const { search } = input;
    const base = { arm_treatment: input.arm_treatment, arm_baseline: input.arm_baseline };
    if (!search.measured) {
        return {
            ...base,
            verdict: 'INCONCLUSIVE',
            reason: 'T5 search-adherence not measured — no analysed pair carried it on both sides',
            search_measured: false,
        };
    }
    if (search.median_delta < 0 && search.wilcoxon_p < ALPHA) {
        return {
            ...base,
            verdict: 'REFUSED-SEARCH-REGRESSION',
            reason:
                'search adherence fell significantly (T5) — the ladder enforces a search ' +
                'discipline, so a size result bought by skipping it is not the hypothesis under test',
            search_measured: true,
        };
    }
    return {
        ...base,
        verdict: 'PASS',
        reason: 'no significant regression in search adherence (T5)',
        search_measured: true,
    };
}

/** Render the T5 section of the stats report. */
export function renderSearchAdherenceSection(verdicts: readonly SearchClaimVerdict[]): string[] {
    const L: string[] = [];
    L.push('## T5 — search adherence (rubric-judged, k=2)');
    L.push('');
    if (verdicts.length === 0) {
        L.push('No comparison produced a search-adherence verdict.');
        return L;
    }
    L.push('| treatment | baseline | verdict | reason |');
    L.push('|---|---|---|---|');
    for (const v of verdicts) {
        L.push(
            `| ${v.arm_treatment ?? '-'} | ${v.arm_baseline ?? '-'} | ${v.verdict} | ${v.reason} |`,
        );
    }
    L.push('');
    L.push(
        '`PASS` means the pre-registered test did not reject in the harmful direction. ' +
            'It is not a claim that the treatment searched *more*.',
    );
    return L;
}
