/**
 * The version-pinned pattern list for the provider-recognition leakage bench's
 * PATTERN-STRIPPED arm.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
 * `blocker: leakage-bench-needs-assembler-and-design-forks`, todo item 3.
 *
 * ── Why this file exists as its own change ──────────────────────────────────
 * The AI council settled the anonymisation protocol on 2026-08-31 (Option C,
 * two arms, 2/2 convergent) and its condition 1 requires the pattern list to be
 * "pre-registered and version-pinned" before the stripped arm runs.
 * `internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md`
 * § Fork 3 DEFERRED the list on an explicit ground: writing it in the same
 * change that settled the protocol "would put an unreviewed floor into the
 * pre-registration under cover of the council's verdict". This module is that
 * separate change. It carries the list, its replacement semantics, and the
 * span-level transformation log condition 2 requires — and nothing else.
 *
 * ── What this module does NOT do ────────────────────────────────────────────
 * It does NOT anonymise in any strong sense, and the label is load-bearing:
 * condition 6 of the verdict says the second arm is called `pattern-stripped`
 * and NEVER `identifier-free`. Regexes miss identifiers. `ARM_LABEL` is the
 * only name this module will answer to, and `FORBIDDEN_ARM_LABELS` names the
 * ones a caller may not substitute; a test asserts neither appears in the
 * rendered output of anything here.
 *
 * It does NOT dispatch, prompt, score, or write. No `main()`, no transport, no
 * filesystem access.
 *
 * ── The residue this design cannot remove, stated here rather than discovered ─
 * Replacement is family-INVARIANT: every rule writes the same placeholder
 * whatever family matched, so the placeholder text itself cannot tell a rater
 * which provider wrote the body. What it cannot make invariant is the COUNT and
 * the POSITION of the placeholders. A family that self-identifies four times
 * and one that never does are distinguishable by `[REDACTED-…]` density alone,
 * and that density is created by the stripping rather than removed by it.
 *
 * This is not a defect to fix here — suppressing it would mean equalising the
 * marker count across families, which is a second transformation with its own
 * distortion. It is a bound on what the arm may claim, and it belongs beside
 * the claim limit both council seats insisted on: the RAW − STRIPPED delta
 * estimates the effect of THESE registered transformations, never "label
 * leakage" in general.
 *
 * ── Freeze semantics ────────────────────────────────────────────────────────
 * Condition 1 makes the list a floor ONCE AN ARM HAS RUN; it does not forbid
 * authoring it. No arm has run at the commit that lands this file
 * (`collectGuesses` and `scoreRecognition` still have zero production callers),
 * so the list is pinned-and-amendable today and frozen the moment the first
 * rater call is made. `PATTERN_LIST_DIGEST` exists so that transition is
 * observable: a test asserts the live list hashes to the recorded digest, so
 * any edit — before or after the freeze — is a loud diff rather than a silent
 * one.
 */
import * as crypto from 'node:crypto';

/** The version id of this list. Bump on ANY change to `LEAKAGE_PATTERNS`. */
export const LEAKAGE_PATTERN_LIST_VERSION = 'leakage-patterns-v1-2026-08-31';

/**
 * The only name the stripped arm may carry. Verdict condition 6: regexes miss
 * identifiers, so a name promising their absence would overstate the result.
 */
export const ARM_LABEL = 'pattern-stripped';

/** Names condition 6 forbids for the stripped arm. Asserted, not documented. */
export const FORBIDDEN_ARM_LABELS: readonly string[] = [
    'identifier-free',
    'anonymised',
    'anonymized',
    'de-identified',
    'deidentified',
];

/**
 * What a rule targets. The four categories are the verdict's own enumeration —
 * "provider names, vendor names, model ids and first-person
 * self-identification" — and the union is closed so a fifth cannot be added
 * without a version bump.
 */
export type PatternCategory =
    | 'provider-name'
    | 'vendor-name'
    | 'model-id'
    | 'first-person-self-identification';

/**
 * The placeholder written in place of a match. ONE token per category, and the
 * SAME token whatever family matched — see the residue note in the header.
 */
export const CATEGORY_PLACEHOLDER: Readonly<Record<PatternCategory, string>> = {
    'provider-name': '[REDACTED-PROVIDER]',
    'vendor-name': '[REDACTED-VENDOR]',
    'model-id': '[REDACTED-MODEL]',
    'first-person-self-identification': '[REDACTED-SELF-ID]',
};

/**
 * How likely this rule is to remove material that is NOT an identifier.
 * Recorded per rule because the council's claim limit turns on exactly this:
 * a rule that also removes stylistic material changes what the delta estimates.
 */
export type FalsePositiveRisk = 'low' | 'moderate';

export interface PatternRule {
    /** Stable id. Appears in the transformation log; never renumbered. */
    readonly id: string;
    readonly category: PatternCategory;
    /** Why this token identifies a family. One clause, checkable by a reader. */
    readonly rationale: string;
    readonly falsePositiveRisk: FalsePositiveRisk;
    /** Source of the pattern. Recompiled per call so lastIndex never leaks. */
    readonly source: string;
    /** Flags. Always contains `g` and `i`; asserted by a test. */
    readonly flags: string;
}

/**
 * The list.
 *
 * ── Two admission rules, applied to every candidate ─────────────────────────
 * (1) A bare token that is also ordinary English is EXCLUDED, and excluded
 *     deliberately rather than forgotten: `meta`, `grok`, `bard`, `gemini` (a
 *     zodiac sign and a common noun in other registers) and `mistral` (a wind)
 *     all appear in prose that has nothing to do with a vendor. Stripping them
 *     unconditionally would delete ordinary sentences, and the deletions would
 *     not be family-uniform, so the arm would measure the regex rather than the
 *     style. Each is admitted ONLY inside an identifying context — a vendor
 *     possessive, a model-id shape, or a self-identification frame.
 * (2) A token whose only role is to name a vendor or a model is admitted bare.
 *     `anthropic`, `openai`, `claude`, `chatgpt` and `codex` carry no ordinary
 *     English sense in this corpus's register.
 *
 * ── Order is part of the pinned artefact ───────────────────────────────────
 * Three tiers, longest frame first, and the reason is span attribution rather
 * than aesthetics: `applyLeakagePatterns` resolves overlap by FIRST-CLAIM-WINS
 * in declaration order, so whichever tier is declared first decides both what
 * is removed and which category the audit log attributes it to.
 *
 *   1. self-identification frames — "I am Claude", "trained by Anthropic".
 *      Declared first so the whole frame is one `[REDACTED-SELF-ID]` span. Put
 *      last, `product-claude` would claim `Claude` on its own, leaving a
 *      dangling "I am " and logging a `provider-name` removal where the thing
 *      actually removed was a self-identification.
 *   2. model ids — `claude-sonnet-4-5`, `gpt-4o`. Ahead of the bare vendor
 *      tokens they contain, so the id is consumed whole rather than leaving
 *      `[REDACTED-PROVIDER]-sonnet-4-5` behind.
 *   3. bare vendor and product tokens — the residue neither tier above framed.
 *
 * A test pins each tier boundary by asserting the span's `patternId`, not only
 * the output text: two orderings can produce the same string and disagree about
 * what the log says was removed, and the log is what condition 2 asks for.
 */
export const LEAKAGE_PATTERNS: readonly PatternRule[] = [
    // ── first-person self-identification, FIRST: longest frames ────────────
    {
        id: 'selfid-i-am-assistant',
        category: 'first-person-self-identification',
        rationale: 'Direct self-naming: "I am Claude", "I\u0027m ChatGPT", "This is Gemini".',
        falsePositiveRisk: 'low',
        source: '\\b(?:I\\s+am|I\u0027m|this\\s+is)\\s+(?:an?\\s+)?(?:claude|chatgpt|gpt(?:[\\w.-]*[\\w])?|gemini|llama|codex|grok|mistral)\\b',
        flags: 'gi',
    },
    {
        id: 'selfid-trained-by',
        category: 'first-person-self-identification',
        rationale: 'Attribution frames: "trained by X", "developed by X", "made by X", "created by X".',
        falsePositiveRisk: 'low',
        source: '\\b(?:trained|developed|built|made|created)\\s+by\\s+(?:anthropic|open\\s?ai|google|meta|mistral|deepseek|xai|cohere)\\b',
        flags: 'gi',
    },
    {
        id: 'selfid-as-an-ai-by',
        category: 'first-person-self-identification',
        rationale: 'The "As an AI assistant developed by …" frame, including the truncated "As an AI model from …".',
        falsePositiveRisk: 'low',
        source: '\\bas\\s+an?\\s+(?:AI|language)\\s+(?:model|assistant)\\s+(?:developed|created|trained|made)?\\s*(?:by|from)\\s+[A-Z][\\w.\\s]{0,20}?(?=[,.;:]|\\s+I\\b)',
        flags: 'g',
    },
    {
        id: 'selfid-my-training',
        category: 'first-person-self-identification',
        rationale: 'First-person model-self talk that names the house: "my training data at Anthropic".',
        falsePositiveRisk: 'moderate',
        source: '\\bmy\\s+(?:training|creators?|developers?|makers?)\\b(?:[^.\\n]{0,40}?\\b(?:anthropic|open\\s?ai|google|meta)\\b)',
        flags: 'gi',
    },
    // ── model ids, second: they contain the bare vendor tokens below ───────
    {
        id: 'model-claude-family',
        category: 'model-id',
        rationale: 'Anthropic model ids: claude-<line>-<version>, incl. dotted and bare line names.',
        falsePositiveRisk: 'low',
        source: 'claude[-\\s](?:sonnet|opus|haiku|instant)(?:[-\\s.\\d]*\\d)?',
        flags: 'gi',
    },
    {
        id: 'model-gpt-family',
        category: 'model-id',
        rationale: 'OpenAI model ids: gpt-4, gpt-4o, gpt-5, and the o-series reasoning ids.',
        falsePositiveRisk: 'low',
        source: '\\bgpt[-\\s]?[0-9](?:[\\w.-]*[\\w])?|\\bo[1-9]\\b(?=[-\\s](?:mini|preview|pro))',
        flags: 'gi',
    },
    {
        id: 'model-codex-family',
        category: 'model-id',
        rationale: 'The codex-* seat ids this repository configures for the openai member.',
        falsePositiveRisk: 'low',
        source: '\\bcodex(?:[-\\s][\\w.]+)?',
        flags: 'gi',
    },
    {
        id: 'model-gemini-family',
        category: 'model-id',
        rationale: 'Google model ids in id shape only — a bare "gemini" is excluded by admission rule 1.',
        falsePositiveRisk: 'low',
        source: '\\bgemini[-\\s][\\d](?:[\\w.-]*[\\w])?|\\bgemini[-\\s](?:pro|flash|ultra|nano)\\b',
        flags: 'gi',
    },
    {
        id: 'model-open-weight-family',
        category: 'model-id',
        rationale: 'Open-weight ids that name their house: llama-N, mixtral-*, deepseek-*, qwen-*.',
        falsePositiveRisk: 'low',
        source: '\\b(?:llama|mixtral|mistral|deepseek|qwen|grok)[-\\s]?[\\d](?:[\\w.-]*[\\w])?',
        flags: 'gi',
    },
    // ── vendor and product names admitted bare (admission rule 2) ───────────
    {
        id: 'vendor-anthropic',
        category: 'vendor-name',
        rationale: 'Company name; no ordinary-English sense.',
        falsePositiveRisk: 'low',
        source: '\\banthropic(?:\u0027s)?\\b',
        flags: 'gi',
    },
    {
        id: 'vendor-openai',
        category: 'vendor-name',
        rationale: 'Company name, hyphenated and spaced spellings included.',
        falsePositiveRisk: 'low',
        source: '\\bopen[-\\s]?ai(?:\u0027s)?\\b',
        flags: 'gi',
    },
    {
        id: 'vendor-possessive-ambiguous',
        category: 'vendor-name',
        rationale: 'Ambiguous tokens admitted ONLY in a vendor possessive/attributive frame (admission rule 1).',
        falsePositiveRisk: 'moderate',
        source: '\\b(?:google|meta|mistral\\s+ai|deepseek|xai|x\\.ai|cohere)(?:\u0027s)?(?=\\s+(?:model|models|api|team|research|assistant|policy|guidelines|training))',
        flags: 'gi',
    },
    {
        id: 'product-claude',
        category: 'provider-name',
        rationale: 'Assistant product name; the single strongest bare identifier in this corpus.',
        falsePositiveRisk: 'low',
        source: '\\bclaude(?:\u0027s)?\\b',
        flags: 'gi',
    },
    {
        id: 'product-chatgpt',
        category: 'provider-name',
        rationale: 'Assistant product name; no ordinary-English sense.',
        falsePositiveRisk: 'low',
        source: '\\bchat[-\\s]?gpt(?:\u0027s)?\\b',
        flags: 'gi',
    },
    {
        id: 'product-bare-gpt',
        category: 'provider-name',
        rationale: 'Bare "GPT" outside a model id; kept separate so its removals are countable on their own.',
        falsePositiveRisk: 'moderate',
        source: '\\bgpt\\b',
        flags: 'gi',
    },
];

/**
 * One removal, with enough information to audit it after the fact. Offsets
 * index the ORIGINAL text, so `original.slice(start, end) === matched` — the
 * property a span-level log has to have to be checkable, and a test asserts it.
 */
export interface TransformationSpan {
    readonly patternId: string;
    readonly category: PatternCategory;
    /** Inclusive start offset in the ORIGINAL text. */
    readonly start: number;
    /** Exclusive end offset in the ORIGINAL text. */
    readonly end: number;
    readonly matched: string;
    readonly replacement: string;
}

export interface StripResult {
    /** The transformed body. Never labelled `identifier-free` — see `ARM_LABEL`. */
    readonly text: string;
    /**
     * Every removal, ascending by `start` and NON-OVERLAPPING. Empty means the
     * body carried no registered identifier — which is a RESULT, not a failure.
     */
    readonly spans: readonly TransformationSpan[];
    /** Echoed so a persisted log is self-describing without its writer. */
    readonly patternListVersion: string;
}

/** Ascending, non-overlapping claim over the original text. */
interface Claim {
    readonly start: number;
    readonly end: number;
    readonly rule: PatternRule;
}

/**
 * Apply the pinned list to one body.
 *
 * Rules are applied in declaration order and a later rule may not claim a
 * region an earlier rule already claimed — which is how `claude-sonnet-4-5`
 * survives as ONE model-id span instead of being cut into a vendor token plus
 * debris. Overlap is resolved by first-claim-wins rather than by longest-match,
 * because the declaration order is itself part of the pinned list and a
 * length heuristic would make the outcome depend on the input.
 */
export function applyLeakagePatterns(original: string): StripResult {
    const claims: Claim[] = [];

    for (const rule of LEAKAGE_PATTERNS) {
        // Recompiled per rule per call so a shared `g` regex cannot carry
        // `lastIndex` across calls.
        //
        // HONEST GAP, recorded because the sabotage run showed it: hoisting
        // this into a module-level cache does NOT turn any test red. The loop
        // below always runs to `exec` returning null, which resets `lastIndex`
        // to 0 on the way out, so today a cached regex is indistinguishable
        // from a fresh one. The recompile is defensive against a future early
        // exit from this loop, and it is UNPROVEN rather than proven.
        const re = new RegExp(rule.source, rule.flags);
        let match: RegExpExecArray | null = re.exec(original);
        while (match !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (match[0].length === 0) {
                re.lastIndex += 1;
                match = re.exec(original);
                continue;
            }
            const overlaps = claims.some((c) => start < c.end && c.start < end);
            if (!overlaps) claims.push({ start, end, rule });
            match = re.exec(original);
        }
    }

    claims.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

    const spans: TransformationSpan[] = [];
    let out = '';
    let cursor = 0;
    for (const claim of claims) {
        const replacement = CATEGORY_PLACEHOLDER[claim.rule.category];
        out += original.slice(cursor, claim.start) + replacement;
        spans.push({
            patternId: claim.rule.id,
            category: claim.rule.category,
            start: claim.start,
            end: claim.end,
            matched: original.slice(claim.start, claim.end),
            replacement,
        });
        cursor = claim.end;
    }
    out += original.slice(cursor);

    return { text: out, spans, patternListVersion: LEAKAGE_PATTERN_LIST_VERSION };
}

/** One item's transformation log — what condition 2 asks be retained. */
export interface ItemTransformationLog {
    readonly itemId: string;
    readonly spans: readonly TransformationSpan[];
}

/**
 * Build an `AssembleOptions.anonymise` seam that ALSO records a span log.
 *
 * The seam's type is `(text: string) => string` and cannot return a log, so the
 * log is accumulated into the array the caller owns. Ordering is the assembler's
 * item order; ids are attached by `attachLogIds` because the seam is called
 * before the item id exists. Keeping the two steps apart is deliberate: a seam
 * that invented an id would make the log's ids disagree with the corpus's.
 */
export function makeRecordingAnonymiser(sink: TransformationSpan[][]): (text: string) => string {
    return (text: string): string => {
        const result = applyLeakagePatterns(text);
        sink.push([...result.spans]);
        return result.text;
    };
}

/** Zip a recorded span sink onto the ids the assembler produced, in order. */
export function attachLogIds(
    sink: readonly (readonly TransformationSpan[])[],
    itemIds: readonly string[],
): readonly ItemTransformationLog[] {
    if (sink.length !== itemIds.length) {
        throw new Error(
            `transformation log length ${sink.length} does not match item count ${itemIds.length}; ` +
                'the log cannot be attributed and must not be published',
        );
    }
    return itemIds.map((itemId, i) => ({ itemId, spans: [...(sink[i] ?? [])] }));
}

/**
 * Canonical serialisation of the list — the input to `PATTERN_LIST_DIGEST`.
 * Every field a rule carries is included, so a rationale edit is as visible as
 * a regex edit: the freeze condition 1 states is about the registered artefact,
 * not only about its matching behaviour.
 */
export function canonicalPatternListSource(): string {
    return JSON.stringify(
        {
            version: LEAKAGE_PATTERN_LIST_VERSION,
            armLabel: ARM_LABEL,
            placeholders: CATEGORY_PLACEHOLDER,
            rules: LEAKAGE_PATTERNS.map((r) => ({
                id: r.id,
                category: r.category,
                rationale: r.rationale,
                falsePositiveRisk: r.falsePositiveRisk,
                source: r.source,
                flags: r.flags,
            })),
        },
        null,
        0,
    );
}

/** sha256 of `canonicalPatternListSource()`. */
export function patternListDigest(): string {
    return crypto.createHash('sha256').update(canonicalPatternListSource(), 'utf8').digest('hex');
}

/**
 * The recorded digest of the pinned list.
 *
 * A test asserts `patternListDigest() === PATTERN_LIST_DIGEST`, so editing a
 * rule without editing this constant is a RED test rather than a quiet change.
 * That is the whole enforcement of condition 1 available before a run exists:
 * it cannot stop an edit, and it makes one impossible to make silently.
 */
export const PATTERN_LIST_DIGEST = '10045caaec23a1bd7053a629f9e8043cb6a3066b44e349ceba6890b058976da6';
