/**
 * Confidence scoring for prompt-driven execution (R2 Phase 3 Step 2).
 *
 * TypeScript twin of `work_engine/scoring/confidence.py` (ADR-094 py2ts
 * Phase 1 — work_engine scoring subpackage). Public API names stay snake_case
 * to mirror the Python module 1:1 (per ADR-094 — Python style is part of the
 * contract).
 *
 * The scorer judges whether a reconstructed prompt is good enough for the
 * `work_engine` to proceed silently, halt for confirmation, or refuse to
 * plan. It is heuristic-only — no LLM calls — so the same prompt produces
 * the same score across replays and the freeze-guard harness can pin
 * expectations.
 *
 * Rubric (each dimension 0–2, total / 10 → band):
 *
 * - `goal_clarity` — does the raw prompt name a single action verb +
 *   object + observable result?
 * - `scope_boundary` — does the prompt name a file, class, module, or
 *   domain that bounds the change?
 * - `ac_evidence` — did the refiner produce concrete, anchored
 *   acceptance criteria?
 * - `stack_data` — does the prompt imply stack / data / migration work
 *   *and* identify the touched surface? (penalty if implied + unspecified)
 * - `reversibility` — would a wrong reconstruction be cheaply rollback-
 *   able?
 *
 * Bands (per `agents/roadmaps/archive/road-to-prompt-driven-execution.md`):
 *
 * - `high`   — score >= 0.8 → dispatcher proceeds silently
 * - `medium` — 0.5 <= score < 0.8 → assumptions-report halt
 * - `low`    — score < 0.5 → one-question halt
 *
 * The scorer is the single source of truth for both the rubric and the
 * band thresholds. Documentation (SKILL.md, ADR, contexts) cite this
 * module — they do not re-derive the values.
 */

// --- Public types ------------------------------------------------------

/**
 * Canonical dimension order. Matches the roadmap rubric and is the
 * order `ConfidenceScore.dimensions` is rendered in by callers.
 */
export const DIMENSION_NAMES: readonly string[] = [
    'goal_clarity',
    'scope_boundary',
    'ac_evidence',
    'stack_data',
    'reversibility',
] as const;

/** Per-dimension ceiling. Five dimensions × 2 = 10 = full score. */
export const MAX_PER_DIMENSION = 2;

export const BAND_HIGH_MIN = 0.8;
export const BAND_MEDIUM_MIN = 0.5;
/**
 * Band thresholds. Inclusive on the lower bound, exclusive on the upper.
 *
 * A score of exactly 0.8 lands in `high` (per roadmap: `high >= 0.8`);
 * exactly 0.5 lands in `medium`. Anything below 0.5 is `low`.
 */

/**
 * Immutable result of one scoring pass.
 *
 * The Python source is a `@dataclass(frozen=True)`. We mirror the field set
 * and the `field(default_factory=list)` default for `reasons` (each instance
 * owns its own array). `Object.freeze` echoes `frozen=True` so callers cannot
 * mutate a band after the dispatcher has routed on it.
 */
export class ConfidenceScore {
    readonly band: string;
    readonly score: number;
    readonly dimensions: Record<string, number>;
    readonly reasons: string[];
    readonly ui_intent: boolean;

    constructor(args: {
        band: string;
        score: number;
        dimensions: Record<string, number>;
        reasons?: string[];
        ui_intent?: boolean;
    }) {
        this.band = args.band;
        this.score = args.score;
        this.dimensions = args.dimensions;
        this.reasons = args.reasons ?? [];
        this.ui_intent = args.ui_intent ?? false;
        Object.freeze(this);
    }
}

// --- Heuristic vocabularies -------------------------------------------

const _ACTION_VERBS: ReadonlySet<string> = new Set([
    'add', 'build', 'create', 'implement', 'introduce', 'write',
    'fix', 'patch', 'repair', 'resolve',
    'refactor', 'rename', 'extract', 'inline', 'split',
    'remove', 'delete', 'drop', 'purge',
    'update', 'upgrade', 'bump', 'migrate',
    'optimize', 'speed', 'improve', 'tune',
    'document', 'describe', 'explain',
    'test', 'validate', 'verify',
    'expose', 'publish', 'deprecate',
    'configure', 'wire', 'connect',
]);

const _DOMAIN_NOUNS: ReadonlySet<string> = new Set([
    'auth', 'authentication', 'authorization', 'login', 'logout', 'signup',
    'user', 'users', 'account', 'profile',
    'dashboard', 'search', 'checkout', 'cart', 'billing', 'payment',
    'admin', 'settings', 'config',
    'api', 'endpoint', 'webhook', 'queue', 'job', 'worker',
    'frontend', 'backend', 'ui', 'view', 'page', 'form',
    'database', 'migration', 'schema',
    'report', 'export', 'import',
]);

const _STACK_DATA_KEYWORDS: ReadonlySet<string> = new Set([
    'migration', 'schema', 'table', 'column', 'index',
    'database', 'db', 'postgres', 'mysql', 'mariadb', 'sqlite',
    'redis', 'cache', 'queue',
    'dependency', 'package', 'library', 'framework', 'upgrade',
    'breaking change', 'deprecate', 'api version',
    'deploy', 'release',
]);

const _IRREVERSIBLE_KEYWORDS: ReadonlySet<string> = new Set([
    'drop ', 'delete ', 'purge', 'wipe', 'truncate',
    'send email', 'charge', 'refund', 'billing', 'payment', 'money',
    'production data', 'live database', 'broadcast',
]);

const _UI_KEYWORDS: ReadonlySet<string> = new Set([
    'redesign', 'color', 'colour', 'css', 'tailwind', 'layout',
    'font', 'spacing', 'padding', 'margin', 'button', 'icon',
    'responsive', 'mobile view', 'look', 'polish', 'prettier',
    'theme', 'dark mode', 'light mode',
]);

// Python `re.compile(...)` — the four alternatives, joined verbatim. The
// JS `RegExp` source mirrors the Python pattern character-for-character; the
// only escaping difference is `\\` in the PHP-namespace branch, which is a
// single backslash in the compiled pattern on both engines.
const _FILE_PATH_RE = new RegExp(
    '`[^`]+`' + // backtick-wrapped tokens
        '|[\\w./-]+\\.(?:py|php|ts|tsx|js|jsx|vue|blade\\.php|sql|yml|yaml|json|md)' +
        '|[A-Z][\\w]+(?:\\\\[A-Z][\\w]+)+' + // PHP namespaces (Foo\Bar\Baz)
        '|[A-Z][a-zA-Z]+::[a-zA-Z]+' + // PHP static call (Foo::bar)
        '|[a-z]+(?:[A-Z][a-z]+){2,}', // camelCase identifiers w/ >=2 humps
);

// --- Public API --------------------------------------------------------

/**
 * Score a reconstructed prompt and return the band + rubric breakdown.
 *
 * @param raw The original user prompt text. Pre-stripped or not; the scorer
 *   normalises whitespace internally.
 * @param ac Reconstructed acceptance criteria from the `refine-prompt`
 *   skill. `null`/`undefined` is treated as an empty list (no AC produced).
 * @param assumptions Inferred assumptions surfaced by the refiner. Currently
 *   informational — the rubric does not penalise assumption count directly
 *   because medium-band halts are the resolution surface.
 */
export function score(args: {
    raw: string;
    ac?: string[] | null;
    assumptions?: string[] | null;
}): ConfidenceScore {
    const raw = args.raw;
    // `(raw or "").strip()` — Python `str.strip()` removes leading/trailing
    // whitespace per the `str.isspace` set; JS `trim()` covers the same
    // Unicode whitespace for these inputs.
    const text = (raw || '').trim();
    const text_lower = text.toLowerCase();
    const ac_list = [...(args.ac ?? [])];

    const [g_val, g_reason] = _score_goal_clarity(text, text_lower);
    const [s_val, s_reason] = _score_scope_boundary(text, text_lower);
    const [e_val, e_reason] = _score_acceptance_evidence(ac_list);
    const [k_val, k_reason] = _score_stack_data(text_lower);
    const [r_val, r_reason] = _score_reversibility(text_lower);

    const dimensions: Record<string, number> = {
        goal_clarity: g_val,
        scope_boundary: s_val,
        ac_evidence: e_val,
        stack_data: k_val,
        reversibility: r_val,
    };
    const total = Object.values(dimensions).reduce((a, b) => a + b, 0);
    const norm = _pyRound(total / (MAX_PER_DIMENSION * DIMENSION_NAMES.length), 4);
    return new ConfidenceScore({
        band: _band_from_score(norm),
        score: norm,
        dimensions,
        reasons: [g_reason, s_reason, e_reason, k_reason, r_reason],
        ui_intent: _detect_ui_intent(text_lower),
    });
}

// --- Band mapping ------------------------------------------------------

/**
 * Map a normalised score to one of `high` / `medium` / `low`.
 *
 * Inclusive on the lower bound to match the roadmap contract
 * (`high >= 0.8`); a score of exactly `0.8` lands in `high`,
 * exactly `0.5` in `medium`, anything below `0.5` in `low`.
 */
function _band_from_score(score_value: number): string {
    if (score_value >= BAND_HIGH_MIN) {
        return 'high';
    }
    if (score_value >= BAND_MEDIUM_MIN) {
        return 'medium';
    }
    return 'low';
}

// --- Per-dimension scorers --------------------------------------------

/** Score whether the prompt names a single, observable outcome. */
function _score_goal_clarity(text: string, text_lower: string): [number, string] {
    if (!text) {
        return [0, 'goal_clarity=0: empty prompt'];
    }
    const has_verb = [..._ACTION_VERBS].some((v) =>
        new RegExp(`\\b${_reEscape(v)}\\w*\\b`).test(text_lower),
    );
    // `text.rstrip().endswith("?")`
    const is_question = _pyRstrip(text).endsWith('?');
    // `len(text.split())` — Python `str.split()` with no args splits on runs
    // of whitespace and drops empty tokens.
    const word_count = _pySplitWhitespace(text).length;
    const conjunction_split = /\b(and then|and also|plus)\b/.test(text_lower);

    if (has_verb && !is_question && 4 <= word_count && word_count <= 40 && !conjunction_split) {
        return [2, 'goal_clarity=2: action verb + bounded length + single outcome'];
    }
    if (has_verb && !is_question) {
        if (conjunction_split) {
            return [1, 'goal_clarity=1: verb present but multiple outcomes joined'];
        }
        return [1, 'goal_clarity=1: verb present but length is borderline'];
    }
    if (is_question) {
        return [0, 'goal_clarity=0: prompt is a question, no executable verb'];
    }
    return [0, 'goal_clarity=0: no recognisable action verb'];
}

/** Score whether the prompt bounds the change to a concrete surface. */
function _score_scope_boundary(text: string, text_lower: string): [number, string] {
    const has_path = _FILE_PATH_RE.test(text);
    const has_domain = [..._DOMAIN_NOUNS].some((n) =>
        new RegExp(`\\b${_reEscape(n)}\\b`).test(text_lower),
    );
    if (has_path) {
        return [2, 'scope_boundary=2: explicit file/class/identifier named'];
    }
    if (has_domain) {
        return [1, 'scope_boundary=1: domain noun present, no concrete path'];
    }
    return [0, 'scope_boundary=0: no file or domain anchor'];
}

/** Score the reconstructed AC list produced by the refiner. */
function _score_acceptance_evidence(ac: string[]): [number, string] {
    const n = ac.length;
    if (n === 0) {
        return [0, 'ac_evidence=0: no acceptance criteria reconstructed'];
    }
    const anchored_signals = ['should', 'must', 'given', 'when', 'then', 'expect'];
    let anchored = 0;
    for (const line of ac) {
        const low = line.toLowerCase();
        if (anchored_signals.some((s) => low.includes(s))) {
            anchored += 1;
        }
    }
    if (n >= 3 && anchored >= 2) {
        return [2, `ac_evidence=2: ${n} criteria, ${anchored} anchored`];
    }
    if (n >= 1) {
        return [1, `ac_evidence=1: ${n} criteria, ${anchored} anchored`];
    }
    return [0, 'ac_evidence=0: empty AC list'];
}

/** Penalise stack/data work that is implied but not bounded. */
function _score_stack_data(text_lower: string): [number, string] {
    const implies_stack = [..._STACK_DATA_KEYWORDS].some((k) => text_lower.includes(k));
    if (!implies_stack) {
        return [2, 'stack_data=2: prompt is behavioural, no stack/data signal'];
    }
    const has_target = /\b(table|column|index|file|migration)\s+[`"\w]/.test(text_lower);
    if (has_target) {
        return [2, 'stack_data=2: stack/data work named with explicit target'];
    }
    return [0, 'stack_data=0: stack/data work implied without target'];
}

/** Score how cheaply a wrong reconstruction could be rolled back. */
function _score_reversibility(text_lower: string): [number, string] {
    if ([..._IRREVERSIBLE_KEYWORDS].some((k) => text_lower.includes(k))) {
        return [0, 'reversibility=0: irreversible keyword detected'];
    }
    const config_signals = ['config', 'env', 'secret', '.env', 'deploy'];
    if (config_signals.some((s) => text_lower.includes(s))) {
        return [1, 'reversibility=1: config/env surface, partial rollback cost'];
    }
    return [2, 'reversibility=2: code-only change, cheap to revert'];
}

/** Flag prompts that read as UI work for R3 routing. */
function _detect_ui_intent(text_lower: string): boolean {
    return [..._UI_KEYWORDS].some((k) => text_lower.includes(k));
}

// --- Python-parity primitives -----------------------------------------

/** Python `re.escape` for the literal tokens in the heuristic vocabularies. */
function _reEscape(s: string): string {
    // Python `re.escape` escapes every non-alphanumeric, non-underscore char.
    // The vocab tokens are ASCII letters / spaces / dots, so this matches.
    return s.replace(/[^a-zA-Z0-9_]/g, (ch) => '\\' + ch);
}

/** Python `str.rstrip()` (no arg) — strip trailing whitespace. */
function _pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Python `str.split()` (no arg) — split on whitespace runs, drop empties. */
function _pySplitWhitespace(s: string): string[] {
    const trimmed = s.trim();
    if (trimmed === '') {
        return [];
    }
    return trimmed.split(/\s+/u);
}

/**
 * Python 3 `round(x, ndigits)` — round-half-to-even (banker's rounding) on
 * the exact decimal expansion of the IEEE-754 double. Same algorithm as
 * `value_ladder.ts::pyRound` / `report_renderer.ts::_pyRound`. Inlined to
 * keep the consumer-shipped module free of cross-tree imports (ADR-094 §7).
 */
function _pyRound(value: number, ndigits = 0): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        const factor = 10 ** ndigits;
        return value > 0
            ? (Math.round(abs * factor) / factor) * sign
            : -Math.round(abs * factor) / factor;
    }
    let [intPart, fracPart = ''] = str.split('.');
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keep = fracPart.slice(0, ndigits);
    const deciding = fracPart[ndigits] ?? '0';
    const rest = fracPart.slice(ndigits + 1).replace(/0+$/, '');
    let digits = (intPart + keep).replace(/^0+(?=\d)/, '');
    let roundUp = false;
    if (deciding > '5' || (deciding === '5' && rest !== '')) {
        roundUp = true;
    } else if (deciding === '5' && rest === '') {
        // exact half → round to even
        const lastKept = digits.length > 0 ? (digits[digits.length - 1] ?? '0') : '0';
        roundUp = (lastKept.charCodeAt(0) - 48) % 2 === 1;
    }
    if (roundUp) {
        digits = _incrementDecimalString(digits);
    }
    // Reinsert the decimal point `ndigits` places from the right.
    let result: number;
    if (ndigits === 0) {
        result = Number(digits);
    } else {
        const padded = digits.padStart(ndigits + 1, '0');
        const cut = padded.length - ndigits;
        const intStr = padded.slice(0, cut) || '0';
        const fracStr = padded.slice(cut);
        result = Number(`${intStr}.${fracStr}`);
    }
    return result * sign;
}

/** Add one to a non-negative integer represented as a decimal string. */
function _incrementDecimalString(s: string): string {
    const chars = (s === '' ? '0' : s).split('');
    let i = chars.length - 1;
    while (i >= 0) {
        const ch = chars[i] ?? '0';
        if (ch === '9') {
            chars[i] = '0';
            i -= 1;
        } else {
            chars[i] = String.fromCharCode(ch.charCodeAt(0) + 1);
            return chars.join('');
        }
    }
    return '1' + chars.join('');
}
