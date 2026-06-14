// Council-necessity classifier (Phase 6) — TypeScript twin (py2ts Phase 1).
//
// Heuristic pre-flight that decides whether the request actually warrants
// a council deliberation. Three verdicts drive three exit paths in the
// dispatcher (skip / educate / proceed). See
// `docs/contracts/ai-council-config.md` for the trigger lists and the
// toggle schema.
//
// The classifier is **shape-based**, not semantic — it scans the prompt
// for marker words associated with each bucket. False positives are
// preferable to false negatives on the `necessary` side (an extra council
// run is cheaper than a missed strategic decision); the educate path
// exists exactly to let the user override a wrong `unnecessary` verdict.
//
// Parity notes (ADR-094):
// - Trigger tables are plain objects whose insertion order mirrors the
//   Python dict literal — `_count_matches` relies on that order for
//   tie-breaking (first-defined bucket wins).
// - `_compile` builds `\b<escaped>\b` IGNORECASE regexes, exactly like
//   Python `re`. The redundant whitespace branch in the Python source is
//   preserved (both arms are identical) so the twin reads 1:1.
// - `len(text)` → code-point count via `_pyLen` (matters for the length
//   tier cut-offs and the truncation snippets).
// - `:.2f` rationale formatting → `_pyFixed` (round-half-to-even), matching
//   CPython float formatting.
// - `re.sub` corpus normalisation mirrors `[^\w\s]` (Unicode `\w` under
//   Python `re` defaults) and `\s+` collapsing.

import { load_validated_phrases as _load } from './low_impact_corpus.js';

export type NecessityVerdict = 'necessary' | 'borderline' | 'unnecessary';
export type Invocation = 'agent' | 'user_explicit';

// Length tier cut-offs in characters (stripped prompt). Tier names are
// used in `classify_size_fit` rationales; tweak only with a parametrised
// test update.
const _SHORT_PROMPT_MAX = 200;
const _MEDIUM_PROMPT_MAX = 800;

// Lenses where the size classifier never suggests a downgrade. Debate is
// structurally expensive but also depends on top-tier reasoning to produce
// useful dissent — surfacing a downgrade prompt mid-debate degrades
// signal-to-noise.
const _NO_DOWNGRADE_LENSES: ReadonlySet<string> = new Set(['debate']);

// Trigger words that flag a prompt as `necessary`. Each entry must be a
// lowercase, whole-word match — surrounding word boundaries are enforced
// by `_count_matches`. Buckets:
//
// - architecture: structural / boundary / cross-component decisions
// - tradeoff: multi-stakeholder or multi-axis trade-off shape
// - ambiguity: explicit uncertainty markers in the prompt
// - strategic: decision verbs that move the artefact across a fork
export const NECESSARY_TRIGGERS: Record<string, readonly string[]> = {
    architecture: [
        'architecture', 'architectural', 'system design', 'boundary',
        'boundaries', 'coupling', 'decouple', 'monorepo', 'microservice',
        'microservices', 'service boundary', 'module boundary',
        'refactor strategy', 'migration plan', 'rewrite', 'redesign',
    ],
    tradeoff: [
        'trade-off', 'tradeoff', 'trade off', 'stakeholder', 'stakeholders',
        'competing', 'tension', 'balance', 'weigh', 'pros and cons',
        'alternatives', 'options', 'vs', 'versus',
    ],
    ambiguity: [
        'unsure', 'uncertain', 'ambiguous', 'unclear', 'not sure',
        "don't know", 'dont know', 'open question', 'controversial',
        'debate', 'second opinion', 'sanity check',
    ],
    strategic: [
        'should we', 'shall we', 'do we', 'roadmap', 'long-term',
        'strategic', 'strategy', 'vision', 'direction', 'decision',
        'decide', 'choose', 'select', 'approach', 'policy',
    ],
};

// Trigger words that flag a prompt as `unnecessary`. Same matching rules
// as `NECESSARY_TRIGGERS`. Buckets:
//
// - bugfix: localised defect / error / crash hunt
// - syntax: tooling / format / lint level
// - single_file: implementation scoped to one file or function
// - lookup: information retrieval, not deliberation
export const UNNECESSARY_TRIGGERS: Record<string, readonly string[]> = {
    bugfix: [
        'bug', 'bugfix', 'fix bug', 'crash', 'error', 'exception',
        'stack trace', 'traceback', 'failing test', 'fails', 'broken',
        'regression',
    ],
    syntax: [
        'syntax', 'typo', 'format', 'formatting', 'lint', 'linter',
        'indent', 'indentation', 'rename', 'import order',
    ],
    single_file: [
        'this function', 'this method', 'this file', 'one-line',
        'one liner', 'small change', 'rename', 'extract method',
        'extract function', 'add a getter', 'add a setter',
    ],
    lookup: [
        'what is', "what's", 'what does', 'how does', 'look up',
        'documentation', 'docs', 'example', 'snippet', 'syntax of',
        'api of',
    ],
};

// Lenses where the necessity bar is tighter — debate is expensive, so a
// `borderline` verdict on the `debate` lens gets nudged toward
// `unnecessary` when no `necessary` marker is present. `pr` lens fires on
// diffs and stays neutral. Other lenses use the default scoring.
const _STRICT_LENSES: ReadonlySet<string> = new Set(['debate']);

/**
 * Outcome of a necessity classification.
 *
 * - verdict: One of `necessary` / `borderline` / `unnecessary`.
 * - category: Best-match trigger bucket (`architecture`, `bugfix`,
 *   `lookup`, …) or `"unclassified"` when no marker fired.
 * - rationale: One-line human-readable explanation suitable for inline
 *   display in session.md or the educate path.
 * - necessary_hits: Number of `necessary` triggers matched.
 * - unnecessary_hits: Number of `unnecessary` triggers matched.
 */
export class ClassificationResult {
    readonly verdict: NecessityVerdict;
    readonly category: string;
    readonly rationale: string;
    readonly necessary_hits: number;
    readonly unnecessary_hits: number;

    constructor(args: {
        verdict: NecessityVerdict;
        category: string;
        rationale: string;
        necessary_hits: number;
        unnecessary_hits: number;
    }) {
        this.verdict = args.verdict;
        this.category = args.category;
        this.rationale = args.rationale;
        this.necessary_hits = args.necessary_hits;
        this.unnecessary_hits = args.unnecessary_hits;
    }
}

const _WORD_RE_CACHE: Map<string, RegExp> = new Map();

/** Mirror Python `len(str)` — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Mirror Python `str.strip()` — strips whitespace both ends. */
function _pyStrip(s: string): string {
    return s.trim();
}

/**
 * Escape a literal for use in a RegExp body — mirrors Python `re.escape`
 * closely enough for the alnum/punctuation trigger words used here.
 */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _compile(trigger: string): RegExp {
    const cached = _WORD_RE_CACHE.get(trigger);
    if (cached !== undefined) {
        return cached;
    }
    let pattern: string;
    // Python builds the identical pattern on both branches; preserve the
    // structure for a 1:1 read.
    if ([...trigger].some((ch) => /\s/.test(ch))) {
        pattern = '\\b' + _reEscape(trigger) + '\\b';
    } else {
        pattern = '\\b' + _reEscape(trigger) + '\\b';
    }
    const compiled = new RegExp(pattern, 'i');
    _WORD_RE_CACHE.set(trigger, compiled);
    return compiled;
}

/**
 * Return `[total_hits, top_bucket_or_null]`.
 *
 * Top bucket = the bucket with the most matches in `text`. Ties are broken
 * by definition order in the input object — JS objects preserve string-key
 * insertion order, so the trigger tables above act as priority lists.
 */
function _count_matches(
    text: string,
    triggers: Record<string, readonly string[]>,
): [number, string | null] {
    let best_bucket: string | null = null;
    let best_count = 0;
    let total = 0;
    for (const bucket of Object.keys(triggers)) {
        const words = triggers[bucket]!;
        let count = 0;
        for (const w of words) {
            if (_compile(w).test(text)) {
                count += 1;
            }
        }
        total += count;
        if (count > best_count) {
            best_count = count;
            best_bucket = bucket;
        }
    }
    return [total, best_bucket];
}

/**
 * Classify a council request as necessary / borderline / unnecessary.
 *
 * @param prompt The raw prompt text the council would deliberate on.
 *   Whitespace-stripped; empty input maps to `unnecessary` / `"empty"`.
 * @param lens Active lens (`analysis`, `debate`, `pr`, …). Strict lenses
 *   (currently `debate`) raise the bar — a borderline verdict with no
 *   `necessary` hits flips to `unnecessary`.
 * @param invocation Source signal — `agent` or `user_explicit`. Does not
 *   change the verdict itself; the dispatcher routes on the pair
 *   `(verdict, invocation)`.
 * @returns A {@link ClassificationResult} with verdict, top-matched
 *   category, one-line rationale, and raw hit counts (useful for tests and
 *   session.md provenance).
 */
export function classify_necessity(
    prompt: string,
    lens = 'analysis',
    _invocation: Invocation = 'agent',
): ClassificationResult {
    const text = _pyStrip(prompt || '');
    if (!text) {
        return new ClassificationResult({
            verdict: 'unnecessary',
            category: 'empty',
            rationale: 'Empty prompt — nothing to deliberate.',
            necessary_hits: 0,
            unnecessary_hits: 0,
        });
    }

    const [n_hits, n_bucket] = _count_matches(text, NECESSARY_TRIGGERS);
    const [u_hits, u_bucket] = _count_matches(text, UNNECESSARY_TRIGGERS);

    // Decision table (intentionally simple — heuristic by design):
    //   strong necessary signal     → necessary
    //   strong unnecessary signal   → unnecessary (unless necessary also fires)
    //   mixed                       → borderline
    //   no signal                   → borderline
    let verdict: NecessityVerdict;
    let category: string;
    let rationale: string;
    if (n_hits >= 2 && n_hits > u_hits) {
        verdict = 'necessary';
        category = n_bucket || 'unclassified';
        rationale =
            `Matched ${n_hits} \`necessary\` trigger(s) in bucket ` +
            `\`${category}\`; council deliberation typically warranted.`;
    } else if (n_hits >= 1 && u_hits === 0) {
        verdict = n_hits >= 2 ? 'necessary' : 'borderline';
        category = n_bucket || 'unclassified';
        rationale =
            `${n_hits} \`necessary\` marker(s) in \`${category}\`, no ` +
            `\`unnecessary\` markers — leaning toward deliberation.`;
    } else if (u_hits >= 2 && n_hits === 0) {
        verdict = 'unnecessary';
        category = u_bucket || 'unclassified';
        rationale =
            `Matched ${u_hits} \`unnecessary\` trigger(s) in bucket ` +
            `\`${category}\`; council typically does not add value here.`;
    } else if (u_hits >= 1 && n_hits === 0) {
        verdict = u_hits >= 2 ? 'unnecessary' : 'borderline';
        category = u_bucket || 'unclassified';
        rationale =
            `${u_hits} \`unnecessary\` marker(s) in \`${category}\`, no ` +
            `\`necessary\` markers — leaning away from deliberation.`;
    } else {
        // Mixed or no markers — borderline by default.
        verdict = 'borderline';
        category = (n_bucket || u_bucket) || 'unclassified';
        rationale =
            `Mixed signals: necessary=${n_hits}, unnecessary=${u_hits}. ` +
            `Borderline — proceed with a one-line note in session.md.`;
    }

    // Lens-strictness pass: debate-tier lenses nudge borderline →
    // unnecessary when no `necessary` marker is present, to prevent
    // expensive debate runs on trivial questions.
    if (_STRICT_LENSES.has(lens) && verdict === 'borderline' && n_hits === 0) {
        verdict = 'unnecessary';
        rationale =
            `Lens \`${lens}\` is strict (expensive deliberation); ` +
            `borderline with zero \`necessary\` markers → unnecessary.`;
    }

    return new ClassificationResult({
        verdict,
        category,
        rationale,
        necessary_hits: n_hits,
        unnecessary_hits: u_hits,
    });
}

/**
 * Return the user-facing educate paragraph for the dispatcher.
 *
 * Emitted only on the `user_explicit + unnecessary` path. The skill layer
 * pairs this with a numbered-options prompt (1=proceed, 2=skip); the CLI
 * surfaces it as plain text and returns a non-zero exit code unless
 * `--proceed-anyway` is set.
 */
export function educate_message(result: ClassificationResult, lens: string): string {
    return (
        `This request looks like \`${result.category}\` ` +
        `(${result.unnecessary_hits} matching marker(s)) on the ` +
        `\`${lens}\` lens. Council typically adds value when the request ` +
        `involves architectural trade-offs, multi-stakeholder ` +
        `decisions, or strategic direction — not for localised bug ` +
        `fixes, syntax / formatting work, or lookups.\n` +
        `\n` +
        `Re-run with \`--proceed-anyway\` to invoke the council anyway.`
    );
}

// --- Phase 7: Model-size classifier + downgrade suggestion ---------------

export type LengthTier = 'short' | 'medium' | 'long';

/**
 * Outcome of a model-size fit classification.
 *
 * - fit: `true` when `current_model` is appropriate for the prompt shape;
 *   `false` when a cheaper / faster sibling on the same ladder would answer
 *   as well.
 * - suggested_model: ladder entry recommended when `fit=false`. `null`
 *   when `fit=true` (no swap proposed).
 * - reason: one-line human-readable rationale.
 * - current_index: zero-based index of `current_model` in the ladder
 *   (smallest = 0). `-1` when `current_model` is not on the ladder.
 * - length_tier: `"short"` / `"medium"` / `"long"`.
 * - complexity_hits: count of `necessary`-bucket markers in the prompt
 *   (proxy for "needs big model").
 */
export class SizeFitVerdict {
    readonly fit: boolean;
    readonly suggested_model: string | null;
    readonly reason: string;
    readonly current_index: number;
    readonly length_tier: LengthTier;
    readonly complexity_hits: number;

    constructor(args: {
        fit: boolean;
        suggested_model: string | null;
        reason: string;
        current_index: number;
        length_tier: LengthTier;
        complexity_hits: number;
    }) {
        this.fit = args.fit;
        this.suggested_model = args.suggested_model;
        this.reason = args.reason;
        this.current_index = args.current_index;
        this.length_tier = args.length_tier;
        this.complexity_hits = args.complexity_hits;
    }
}

function _length_tier(text: string): LengthTier {
    if (_pyLen(text) < _SHORT_PROMPT_MAX) {
        return 'short';
    }
    if (_pyLen(text) < _MEDIUM_PROMPT_MAX) {
        return 'medium';
    }
    return 'long';
}

/**
 * Decide whether `current_model` fits the prompt shape.
 *
 * Heuristic — never suggests an UP-tier swap (Phase 7 is downgrade-only).
 * When the prompt is short AND carries no complexity markers AND the
 * current model is above the smallest tier, suggest the next rung down.
 * Longer prompts or multi-axis complexity keep the current model.
 *
 * @param prompt raw prompt text the council would deliberate on.
 * @param current_model model id currently selected for the member.
 * @param ladder provider's `model_ladder` ordered smallest → largest.
 *   When `current_model` is not on the ladder, returns `fit=true` with an
 *   explanatory reason (no downgrade suggested — caller should configure
 *   the ladder first).
 * @param lens active lens; `debate` lens disables downgrade suggestions to
 *   keep dissent quality high.
 * @returns A {@link SizeFitVerdict}.
 */
export function classify_size_fit(
    prompt: string,
    current_model: string,
    ladder: readonly string[],
    lens = 'analysis',
): SizeFitVerdict {
    const text = _pyStrip(prompt || '');
    const tier = _length_tier(text);
    const [n_hits] = _count_matches(text.toLowerCase(), NECESSARY_TRIGGERS);

    const ladder_list = [...(ladder || [])];
    const idx = ladder_list.indexOf(current_model);
    if (idx === -1) {
        return new SizeFitVerdict({
            fit: true,
            suggested_model: null,
            reason:
                `\`${current_model}\` is not on the configured ladder ` +
                `(${ladder_list.length ? _pyListRepr(ladder_list) : 'empty'}) — no downgrade path.`,
            current_index: -1,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    if (idx === 0) {
        return new SizeFitVerdict({
            fit: true,
            suggested_model: null,
            reason: `\`${current_model}\` is already on the smallest tier.`,
            current_index: idx,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    if (_NO_DOWNGRADE_LENSES.has(lens)) {
        return new SizeFitVerdict({
            fit: true,
            suggested_model: null,
            reason:
                `Lens \`${lens}\` keeps the top tier for dissent quality; ` +
                `no downgrade suggested.`,
            current_index: idx,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    if (n_hits >= 2 || tier === 'long') {
        return new SizeFitVerdict({
            fit: true,
            suggested_model: null,
            reason:
                `Complexity warrants the current tier ` +
                `(length=${tier}, complexity_hits=${n_hits}).`,
            current_index: idx,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    if (tier === 'short' && n_hits === 0) {
        const suggested = ladder_list[Math.max(0, idx - 1)]!;
        return new SizeFitVerdict({
            fit: false,
            suggested_model: suggested,
            reason:
                `Short prompt (${_pyLen(text)} chars) with no complexity ` +
                `markers — \`${suggested}\` should answer as well.`,
            current_index: idx,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    if (tier === 'medium' && n_hits === 0 && idx >= 1) {
        const suggested = ladder_list[Math.max(0, idx - 1)]!;
        return new SizeFitVerdict({
            fit: false,
            suggested_model: suggested,
            reason:
                `Medium-length prompt with no complexity markers — ` +
                `\`${suggested}\` likely sufficient.`,
            current_index: idx,
            length_tier: tier,
            complexity_hits: n_hits,
        });
    }

    return new SizeFitVerdict({
        fit: true,
        suggested_model: null,
        reason:
            `Length / complexity balance keeps current tier ` +
            `(length=${tier}, complexity_hits=${n_hits}).`,
        current_index: idx,
        length_tier: tier,
        complexity_hits: n_hits,
    });
}

/**
 * Render a Python `repr(list[str])` for the not-on-ladder reason string —
 * `['a', 'b']` style. Only reached when the ladder is non-empty.
 */
function _pyListRepr(items: readonly string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

/**
 * User-facing downgrade-suggestion paragraph.
 *
 * Emitted by the dispatcher when `model_downgrade` is enabled and
 * `classify_size_fit` returned `fit=false`. Followed by a single
 * numbered-options prompt at the agent surface (1=use suggested / 2=keep
 * current / 3=skip this member).
 */
export function downgrade_message(verdict: SizeFitVerdict, current_model: string): string {
    return (
        `Current model \`${current_model}\` looks oversized for this ` +
        `request. Suggested: \`${verdict.suggested_model}\` ` +
        `(reason: ${verdict.reason}).`
    );
}

// --- Phase 10: Five-class impact classifier + routing --------------------

export type ImpactClass =
    | 'trivial'
    | 'low_impact'
    | 'medium_impact'
    | 'high_impact'
    | 'user_required';

// Classes that are structurally LOCKED to `user` routing. The schema
// validator in `config.py` rejects any attempt to remap these via
// `decision_resolution.<class>.mode`. Iron Law per the roadmap: security /
// auth / billing / tenant-boundary / migration / production-destructive
// decisions always reach the user.
export const LOCKED_IMPACT_CLASSES: ReadonlySet<ImpactClass> = new Set<ImpactClass>([
    'high_impact',
    'user_required',
]);

// User-fence markers that force `user_required` regardless of any other
// signal. Mirrors the "fenced step" language in `scope-control`: when the
// user has set a review gate, the agent never auto-routes the question
// away from them.
const _USER_FENCE_MARKERS: readonly string[] = [
    'ask me', 'review first', 'plan only', "don't decide", 'do not decide',
    'wait for me', "I'll decide", 'i will decide', 'let me decide',
    'frag mich', 'warte auf mich',
];

// Trigger words per impact class. Whole-word match via `_count_matches`.
// Ordered by structural severity — when a prompt matches multiple classes,
// the higher-severity class wins (handled by the override precedence in
// `classify_impact`).
export const IMPACT_TRIGGERS: Record<ImpactClass, readonly string[]> = {
    trivial: [
        'naming', 'rename', 'name this', 'what should i call',
        'whitespace', 'indent', 'indentation', 'comment style',
        'import order', 'import ordering', 'variable case', 'snake_case',
        'camelcase', 'typo', 'spacing',
    ],
    low_impact: [
        'service vs repository', 'repository vs service', 'idiom',
        'dto', 'dto vs array', 'value object', 'job vs sync',
        'queue vs sync', 'test extension', 'test suffix', 'trait vs class',
        'helper vs static', 'use composition', 'use inheritance',
    ],
    medium_impact: [
        'api shape', 'endpoint shape', 'contract change', 'contract update',
        'cross-module', 'cross module', 'module boundary', 'package boundary',
        'interface change', 'signature change', 'breaking change',
    ],
    high_impact: [
        'security', 'auth', 'authentication', 'authorization', 'permission',
        'tenant', 'tenants', 'tenant boundary', 'migration', 'schema migration',
        'production', 'prod database', 'destructive', 'drop table', 'truncate',
        'delete column', 'billing', 'secret', 'secrets', 'api key',
        'credentials', 'encryption', 'sso', 'oauth', 'iam',
        'policy change', 'data retention', 'personal data', 'pii',
    ],
    user_required: [],
};

/**
 * Outcome of an impact classification (Phase 10).
 *
 * - impact_class: One of {@link ImpactClass}.
 * - confidence: 0.0–1.0 self-rated certainty in the verdict. Used by the
 *   routing layer's `confidence_threshold` gate: high-confidence
 *   `low_impact` skips council, low-confidence falls through to council
 *   (Phase 11) or user.
 * - rationale: One-line explanation suitable for inline session.md display.
 *   Includes the matched trigger bucket when applicable.
 * - category: Best-match trigger bucket (or `"unclassified"` when no marker
 *   fired and the prompt defaulted to a class).
 */
export class ImpactVerdict {
    readonly impact_class: ImpactClass;
    readonly confidence: number;
    readonly rationale: string;
    readonly category: string;

    constructor(args: {
        impact_class: ImpactClass;
        confidence: number;
        rationale: string;
        category: string;
    }) {
        this.impact_class = args.impact_class;
        this.confidence = args.confidence;
        this.rationale = args.rationale;
        this.category = args.category;
    }
}

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython float formatting (`f"{x:.2f}"`).
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

/**
 * Classify a pending agent question by stakes / blast-radius.
 *
 * Heuristic, keyword-shape based — no LLM call, fully explainable.
 * Precedence (highest wins): user-fence marker → high_impact markers →
 * medium_impact markers → low_impact markers → trivial markers → default
 * fallback. Confidence is rule-based and reflects how many distinct markers
 * fired, not learned probability.
 *
 * @param question_text The pending question text the agent is about to
 *   surface. Whitespace-stripped before scanning; empty input maps to
 *   `user_required` / confidence `1.0` (no agent should silently resolve an
 *   empty question).
 * @returns An {@link ImpactVerdict} with class, confidence, rationale, and
 *   matched bucket.
 */
export function classify_impact(question_text: string): ImpactVerdict {
    const text = _pyStrip(question_text || '');
    if (!text) {
        return new ImpactVerdict({
            impact_class: 'user_required',
            confidence: 1.0,
            rationale: 'Empty question — user must clarify.',
            category: 'empty',
        });
    }

    const lower = text.toLowerCase();

    // User fence → user_required, beats every other signal. The agent
    // never auto-routes around an explicit review gate.
    for (const marker of _USER_FENCE_MARKERS) {
        if (_compile(marker).test(lower)) {
            return new ImpactVerdict({
                impact_class: 'user_required',
                confidence: 1.0,
                rationale:
                    `User-fence marker (\`${marker}\`) — explicit review ` +
                    `gate, routes to user regardless of topic.`,
                category: 'user_fence',
            });
        }
    }

    // Severity precedence: count distinct triggers per class, take the
    // highest-severity class with at least one hit. Confidence scales with
    // hit count for the winning class.
    const ordered: ImpactClass[] = ['high_impact', 'medium_impact', 'low_impact', 'trivial'];
    const hits_per_class: Map<ImpactClass, [number, string]> = new Map();
    for (const cls of ordered) {
        const [hits, bucket] = _count_matches(lower, { [cls]: IMPACT_TRIGGERS[cls] });
        if (hits) {
            hits_per_class.set(cls, [hits, bucket || cls]);
        }
    }

    for (const cls of ordered) {
        const entry = hits_per_class.get(cls);
        if (entry !== undefined) {
            const [hits, bucket] = entry;
            let confidence = Math.min(1.0, 0.5 + 0.15 * hits);
            // high_impact is Iron-Law: cap confidence at 1.0 with at least
            // one explicit marker — never downgrade.
            if (cls === 'high_impact') {
                confidence = Math.max(confidence, 0.85);
            }
            const rationale =
                `Matched ${hits} \`${cls}\` marker(s) in bucket \`${bucket}\` — ` +
                `confidence ${_pyFixed(confidence, 2)}.`;
            return new ImpactVerdict({
                impact_class: cls,
                confidence,
                rationale,
                category: bucket,
            });
        }
    }

    // No markers fired — default to medium_impact / low confidence so the
    // routing layer falls through to council or user rather than silently
    // letting the agent resolve.
    return new ImpactVerdict({
        impact_class: 'medium_impact',
        confidence: 0.3,
        rationale:
            'No impact markers fired — defaulting to `medium_impact` at ' +
            'low confidence; routing layer should escalate.',
        category: 'unclassified',
    });
}

/**
 * Return normalised `## Validated` question strings from a corpus.
 *
 * Thin re-export of `low_impact_corpus.load_validated_phrases` — the
 * hardened parser (step-9 P4) lives there; routing stays lenient so a
 * broken corpus never blocks classification. Strict-mode contract
 * validation lives in `low_impact_corpus.parse_corpus_strict`.
 */
export function load_validated_phrases(corpus_path: string): string[] {
    return _load(corpus_path);
}

/**
 * Corpus-aware variant of {@link classify_impact} (Phase 12).
 *
 * Loads `## Validated` phrases from every `corpus_paths` entry
 * (project-local first, upstream seed second) and short-circuits to
 * `low_impact` confidence `0.9` on exact-after-normalisation match.
 * Probation / anti-example sections are excluded.
 *
 * The locked-class Iron Law from {@link classify_impact} still wins —
 * user-fence markers AND `high_impact` triggers are checked BEFORE the
 * corpus lookup, so a question with both a corpus hit and a security marker
 * still routes to `user`.
 */
export function classify_impact_with_corpus(
    question_text: string,
    corpus_paths: readonly string[] | null = null,
): ImpactVerdict {
    const base = classify_impact(question_text);
    if (LOCKED_IMPACT_CLASSES.has(base.impact_class)) {
        return base;
    }
    if (!corpus_paths || corpus_paths.length === 0) {
        return base;
    }
    // Python `re.sub(r"[^\w\s]", ...)` uses Unicode `\w` (`[A-Za-z0-9_]`
    // plus all Unicode letters/digits/connector-punct) and Unicode `\s`.
    // JS `\w` / `\s` are ASCII-only even under `/u`, so spell out the
    // Unicode classes explicitly to keep normalisation byte-identical.
    let norm_q = (question_text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\s]/gu, ' ');
    norm_q = _pyStrip(norm_q.replace(/\s+/gu, ' '));
    if (!norm_q) {
        return base;
    }
    for (const p of corpus_paths) {
        for (const phrase of load_validated_phrases(p)) {
            if (norm_q === phrase) {
                return new ImpactVerdict({
                    impact_class: 'low_impact',
                    confidence: 0.9,
                    rationale:
                        'Matched Validated corpus entry — routing as ' +
                        '`low_impact` (Phase 12 learning loop).',
                    category: 'corpus_validated',
                });
            }
        }
    }
    return base;
}

export type ResolutionMode = 'agent' | 'council' | 'user';
const _RESOLUTION_RUNGS: readonly ResolutionMode[] = ['agent', 'council', 'user'];

/**
 * Final routing decision (Phase 10).
 *
 * Combines {@link ImpactVerdict} with the per-class
 * `DecisionResolutionEntry` from config to produce the mode the chokepoint
 * should dispatch to.
 *
 * - verdict: Underlying impact classification.
 * - mode: Final resolution mode after Iron-Law + confidence-gate.
 * - upgraded: `true` when the confidence-threshold pushed the mode one rung
 *   up (e.g. `agent` → `council`).
 * - rationale: One-line explanation suitable for session.md.
 */
export class DecisionRouting {
    readonly verdict: ImpactVerdict;
    readonly mode: ResolutionMode;
    readonly upgraded: boolean;
    readonly rationale: string;

    constructor(args: {
        verdict: ImpactVerdict;
        mode: ResolutionMode;
        upgraded: boolean;
        rationale: string;
    }) {
        this.verdict = args.verdict;
        this.mode = args.mode;
        this.upgraded = args.upgraded;
        this.rationale = args.rationale;
    }
}

/**
 * A `DecisionResolutionEntry`-shaped object: exposes `mode` and
 * `confidence_threshold`. Typed loosely to keep this module free of a
 * config import cycle.
 */
export interface ResolutionEntryLike {
    mode?: ResolutionMode;
    confidence_threshold?: number;
}

/**
 * Classify + route a pending agent question.
 *
 * @param question_text The text the agent was about to ask the user.
 * @param classes Mapping `impact_class -> DecisionResolutionEntry` (typed
 *   loosely to keep this module free of a config import cycle). Each entry
 *   must expose `mode` and `confidence_threshold` attributes.
 * @returns A {@link DecisionRouting} with the final mode. Iron Law:
 *   {@link LOCKED_IMPACT_CLASSES} always returns `mode="user"` regardless of
 *   config or confidence.
 */
export function route_decision(
    question_text: string,
    classes: Record<string, ResolutionEntryLike | undefined> | Map<string, ResolutionEntryLike>,
): DecisionRouting {
    const verdict = classify_impact(question_text);
    const entry =
        classes instanceof Map
            ? classes.get(verdict.impact_class)
            : classes[verdict.impact_class];
    if (entry === undefined || entry === null) {
        // No config — Iron-Law fallback to user.
        return new DecisionRouting({
            verdict,
            mode: 'user',
            upgraded: false,
            rationale:
                `No routing entry for \`${verdict.impact_class}\` — ` +
                `defaulting to user (Iron-Law fallback).`,
        });
    }

    const base_mode: ResolutionMode = entry.mode ?? 'user';
    const threshold: number = entry.confidence_threshold ?? 0.6;

    if (LOCKED_IMPACT_CLASSES.has(verdict.impact_class)) {
        return new DecisionRouting({
            verdict,
            mode: 'user',
            upgraded: false,
            rationale:
                `\`${verdict.impact_class}\` is Iron-Law locked to \`user\` ` +
                `— bypass refused.`,
        });
    }

    let upgraded = false;
    let mode: ResolutionMode = base_mode;
    if (mode !== 'user' && verdict.confidence < threshold) {
        const idx = _RESOLUTION_RUNGS.indexOf(base_mode);
        if (idx === -1) {
            mode = 'user';
            upgraded = true;
        } else {
            mode = _RESOLUTION_RUNGS[Math.min(idx + 1, _RESOLUTION_RUNGS.length - 1)]!;
            upgraded = mode !== base_mode;
        }
    }

    const rationale =
        `Class \`${verdict.impact_class}\` (confidence ` +
        `${_pyFixed(verdict.confidence, 2)}, threshold ${_pyFixed(threshold, 2)}) → ` +
        `mode \`${mode}\`` +
        (upgraded ? ` (upgraded from \`${base_mode}\`)` : '') +
        '.';
    return new DecisionRouting({
        verdict,
        mode,
        upgraded,
        rationale,
    });
}
