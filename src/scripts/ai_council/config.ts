/**
 * Council configuration loader — single source of truth.
 *
 * TypeScript twin of `src/scripts/ai_council/config.py` (ADR-200 —
 * Python→TS migration, Phase 12). Mirrors the Python module's public
 * surface and validation behaviour byte-for-byte: same exported
 * snake_case names, same defaults, same error messages, same precedence.
 *
 * Reads `agents/settings/.ai-council.yml` per the contract in
 * `docs/contracts/ai-council-config.md`. Replaces the fragmented
 * `.agent-settings.yml` `ai_council` block (Phase 0 migration).
 *
 * Validation contract (8 rules, all enforced at load time):
 *
 * 1. `enabled` is a bool.
 * 2. `defaults.mode` ∈ {`api`, `manual`, `cli`}; per-member mode same
 *    set. Semantics: `api` = SDK call against a stored key (billable);
 *    `manual` = copy & paste — human transports prompt + reply between
 *    the agent and an external chat surface (free); `cli` = shell out to
 *    a locally-installed CLI under subscription auth (free for
 *    first-party CLIs, billable for community wrappers).
 * 3. `members.<name>` keys are restricted to the known provider set.
 * 4. `cost_budget.*` numeric fields are >= 0.
 * 5. Enabled members carry a non-empty `model` and `api_key_ref` when
 *    their effective mode is `api`. CLI-mode members do NOT require
 *    `api_key_ref` (subscription auth is provided by the CLI binary
 *    itself).
 * 6. `api_key_ref` starts with `file:` or `env:` — raw keys are refused
 *    even if syntactically plausible.
 * 7. Resolved `file:` key paths must have mode 0o600 (delegated to
 *    `resolve_api_key`; runs at use-time, not parse-time).
 * 8. `binary:` is only valid when the member's effective mode is `cli`;
 *    `cli_call_budget.max_calls_per_day.<provider>` keys must be valid
 *    providers.
 *
 * Parity notes (intentional, documented):
 *   - YAML is parsed with `yaml` (npm) at `version: '1.1'`, matching
 *     PyYAML's `safe_load` scalar grammar — the same approach the sibling
 *     twins (`move_artefact.ts`, `new_skill.ts`, `agent_settings.ts`) use.
 *   - JS has no int/float distinction, so a `.0`-suffixed YAML float in
 *     an int-only field (`max_members`, `auth_check_timeout_seconds`,
 *     `max_tokens`) parses to a JS integer and passes the int check where
 *     Python would reject it as a `float`. This is the same parity
 *     boundary the YAML twins accept; integers written as `2` (the only
 *     realistic shape) behave identically.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import * as user_global_paths from '../_lib/user_global_paths.js';

const _VALID_PROVIDERS: ReadonlySet<string> = new Set([
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'perplexity',
]);
const _VALID_MODES: ReadonlySet<string> = new Set(['api', 'manual', 'cli']);

/**
 * Prefixes that signal "this is a raw API key" so we refuse it loudly
 * even when the user accidentally inlined it in `api_key_ref`.
 */
export const _RAW_KEY_PREFIXES: readonly string[] = [
    'sk-',
    'sk-ant-',
    'ya29.',
    'AIza',
    'xai-',
    'pplx-',
    'gsk_',
];

// ── value type shapes ──────────────────────────────────────────────

/** Any JSON-like value parsed out of the YAML (mirrors Python `Any`). */
export type Json =
    | string
    | number
    | boolean
    | null
    | Json[]
    | { [key: string]: Json };

type Dict = { [key: string]: Json };

/** Mirror of `pathlib.Path` for the public surface — a filesystem string. */
export type PathLike = string;

// ── error type ─────────────────────────────────────────────────────

/** Raised when `agents/settings/.ai-council.yml` violates the schema. */
export class CouncilConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CouncilConfigError';
    }
}

// ── Python-format helpers (byte-faithful error messages) ───────────

/** Python `repr()` for a string scalar (single-quoted, escaped). */
function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Python `repr()` for a float value (shortest round-trip, `N.0` for ints). */
function _pyReprFloat(value: number): string {
    if (Number.isInteger(value) && Number.isFinite(value)) {
        return `${value}.0`;
    }
    if (value === Infinity) {
        return 'inf';
    }
    if (value === -Infinity) {
        return '-inf';
    }
    if (Number.isNaN(value)) {
        return 'nan';
    }
    return String(value);
}

/**
 * Python `repr()` for an arbitrary parsed value. Floats are tracked via
 * `_FLOAT` so int-valued floats render `N.0`; bare numbers render as
 * Python ints (no decimal). Mirrors `{value!r}` formatting.
 */
function _pyRepr(value: unknown): string {
    if (value instanceof _Float) {
        return _pyReprFloat(value.value);
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'string') {
        return _pyReprStr(value);
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyRepr(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            parts.push(`${_pyReprStr(k)}: ${_pyRepr(v)}`);
        }
        return `{${parts.join(', ')}}`;
    }
    return String(value);
}

/** Wrapper marking a number that should `repr()` as a Python float. */
class _Float {
    constructor(readonly value: number) {}
}

/** Mark `n` so `_pyRepr` renders it with a Python float repr (`N.0`). */
function _f(n: number): _Float {
    return new _Float(n);
}

/** Python `type(value).__name__`. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (typeof value === 'boolean') {
        return 'bool';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (typeof value === 'string') {
        return 'str';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    if (typeof value === 'object') {
        return 'dict';
    }
    return typeof value;
}

/** Python `sorted(set_of_strings)` rendered as a list repr `['a', 'b']`. */
function _sortedListRepr(items: Iterable<string>): string {
    const sorted = [...items].sort();
    return `[${sorted.map((s) => _pyReprStr(s)).join(', ')}]`;
}

/** Python `oct(mode)` → `0o600`-shaped string. */
function _pyOct(mode: number): string {
    return `0o${mode.toString(8)}`;
}

// ── Python int()/float() coercion + isinstance helpers ─────────────

/**
 * Mirror Python `int(x)`: ints pass through, floats truncate toward
 * zero, bools → 0/1, numeric strings parse. Anything else raises —
 * but the config only ever feeds values that `int()` accepts (the
 * call sites are `int(d.get(...))` with numeric defaults).
 */
function _pyInt(value: Json | undefined): number {
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        // Python int("3") works; int("3.0") raises ValueError. The config
        // never relies on that edge — keep it simple: parse base-10 ints.
        if (/^[+-]?\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
        }
        throw new CouncilConfigError(
            `invalid literal for int() with base 10: ${_pyReprStr(value)}`,
        );
    }
    throw new CouncilConfigError(
        `int() argument must be a string or a number, not ` +
            `'${_pyTypeName(value)}'`,
    );
}

/**
 * Mirror Python `float(x)`: numbers + bools coerce, numeric strings
 * parse. The config call sites pass numbers/bools/strings.
 */
function _pyFloat(value: Json | undefined): number {
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(parsed)) {
            return parsed;
        }
        if (/^[+-]?inf(inity)?$/i.test(trimmed)) {
            return trimmed.startsWith('-') ? -Infinity : Infinity;
        }
        if (/^[+-]?nan$/i.test(trimmed)) {
            return NaN;
        }
        throw new CouncilConfigError(
            `could not convert string to float: ${_pyReprStr(value)}`,
        );
    }
    throw new CouncilConfigError(
        `float() argument must be a string or a number, not ` +
            `'${_pyTypeName(value)}'`,
    );
}

/** Mirror Python `isinstance(x, bool)`. */
function _isBool(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/** Mirror Python `isinstance(x, int) and not isinstance(x, bool)`. */
function _isInt(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value);
}

/** Mirror Python `isinstance(x, (int, float)) and not isinstance(x, bool)`. */
function _isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

/** Mirror Python `isinstance(x, dict)`. */
function _isDict(value: unknown): value is Dict {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

/** Mirror Python `isinstance(x, str)`. */
function _isStr(value: unknown): value is string {
    return typeof value === 'string';
}

/** Mirror Python `isinstance(x, (list, tuple))`. */
function _isList(value: unknown): value is Json[] {
    return Array.isArray(value);
}

/**
 * Mirror Python truthiness for `d.get(k) or {}` / `or ()` patterns:
 * `None`, `False`, `0`, `0.0`, `''`, `[]`, `{}` are falsy. Used to
 * replicate the `raw.get("x") or {}` idiom exactly.
 */
function _getOr<T extends Json>(d: Dict, key: string, fallback: T): Json | T {
    const v = d[key];
    if (v === undefined) {
        return fallback;
    }
    if (
        v === null ||
        v === false ||
        v === 0 ||
        v === '' ||
        (Array.isArray(v) && v.length === 0) ||
        (_isDict(v) && Object.keys(v).length === 0)
    ) {
        return fallback;
    }
    return v;
}

/** Mirror `d.get(key, default)` — `undefined` (absent) → default. */
function _get(d: Dict, key: string, fallback: Json): Json {
    const v = d[key];
    return v === undefined ? fallback : v;
}

// ── config dataclasses (frozen → readonly interfaces) ──────────────

export interface DefaultsConfig {
    readonly mode: string;
    readonly member_mode: string;
    readonly min_rounds: number;
    readonly deep_min_rounds: number;
    readonly max_output_tokens: number;
    readonly session_retention_days: number;
    readonly debate_max_rounds: number;
}

export interface CostBudgetConfig {
    readonly max_input_tokens: number;
    readonly max_output_tokens: number;
    readonly max_calls: number;
    readonly max_total_usd: number;
}

export interface MemberConfig {
    readonly name: string;
    readonly enabled: boolean;
    readonly model: string;
    readonly api_key_ref: string | null;
    readonly mode: string | null;
    readonly binary: string | null;
    readonly model_ladder: readonly string[];
    readonly participate_low_impact: boolean;
}

/**
 * Replace-mode advisor binding (Phase 6).
 *
 * `member` names the provider whose plain call is replaced by this
 * advisor-persona call. `persona` is the path to the advisor persona
 * file (resolved relative to the package root). `model` is an optional
 * override of the bound member's plain model.
 */
export interface AdvisorConfig {
    readonly name: string;
    readonly enabled: boolean;
    readonly member: string;
    readonly persona: string;
    readonly model: string | null;
}

/**
 * Consensus-scoring round settings (Phase 4 / F3). Only the `analysis`
 * lens activates the scoring round today; other lenses see this as
 * inert config. Thresholds are inclusive on the `strong` side and
 * exclusive on the `minority` side. Defaults mirror the roadmap.
 */
export interface ConsensusScoringConfig {
    readonly enabled: boolean;
    readonly strong_threshold: number;
    readonly minority_threshold: number;
    readonly lenses: readonly string[];
}

const _VALID_NECESSITY_MODES: ReadonlySet<string> = new Set([
    'off',
    'educate',
    'block',
    'warn-only',
]);
const _VALID_DISCLOSURE_MODES: ReadonlySet<string> = new Set([
    'always',
    'above_threshold',
    'off',
]);

/**
 * Council-necessity classifier toggle (Phase 6). `mode` controls the
 * agent invocation path; `user_explicit_mode` the user-explicit path.
 */
export interface NecessityClassifierConfig {
    readonly enabled: boolean;
    readonly mode: string;
    readonly user_explicit_mode: string;
}

/** Model-size downgrade-suggestion toggle (Phase 7). */
export interface ModelDowngradeConfig {
    readonly enabled: boolean;
    readonly auto_apply: boolean;
}

/** Pre-flight cost-disclosure toggle (Phase 8). */
export interface CostDisclosureConfig {
    readonly mode: string;
    readonly threshold_usd: number;
    readonly show_per_member: boolean;
}

/** Debate cost-visibility + hard refusal cap (Phase 8). */
export interface DebateConfig {
    readonly max_cost_usd: number;
    readonly cost_disclosure: CostDisclosureConfig;
}

/** Decision-replay artefact toggle (Phase 9). */
export interface DecisionReplayConfig {
    readonly enabled: boolean;
    readonly include_member_arguments: boolean;
}

/** Routing entry for one impact class (Phase 10). */
export interface DecisionResolutionEntry {
    readonly mode: string;
    readonly confidence_threshold: number;
}

/** Opt-in fuzzy matching for the corpus-aware classifier (step-9 P5). */
export interface FuzzyMatchConfig {
    readonly enabled: boolean;
    readonly threshold: number;
}

/** Hard caps for the lightweight-QA fast-path (Phase 11). */
export interface LowImpactFastPathConfig {
    readonly max_members: number;
    readonly max_rounds: number;
    readonly max_tokens: number;
    readonly max_cost_usd: number;
    readonly fuzzy_match: FuzzyMatchConfig;
}

/** Impact-class → routing map (Phase 10). */
export interface DecisionResolutionConfig {
    readonly enabled: boolean;
    readonly classes: ReadonlyMap<string, DecisionResolutionEntry>;
    readonly fast_path: LowImpactFastPathConfig;
}

/** Per-lens overrides keyed by lens name (Phase 6+). */
export interface LensOverridesConfig {
    readonly necessity_classifier_mode: ReadonlyMap<string, string>;
    readonly necessity_classifier_user_explicit_mode: ReadonlyMap<string, string>;
    readonly model_downgrade: ReadonlyMap<string, ModelDowngradeConfig>;
    readonly cost_disclosure: ReadonlyMap<string, CostDisclosureConfig>;
    readonly decision_replay: ReadonlyMap<string, DecisionReplayConfig>;
}

/** Solo-member dispatch fallback chain (step-9 P8/P9 · U2). */
export interface RoutingConfig {
    readonly solo_member_fallback_chain: readonly string[];
    readonly auth_check_timeout_seconds: number;
}

/** Low-impact dispatch + shadow-mode config (step-9 P8/P10 · U3). */
export interface LowImpactConfig {
    readonly dispatch: string;
    readonly shadow_sample_rate: number;
    readonly solo_confidence_floor: number;
}

/** Per-day call-count guard for `mode: cli` members (Phase 0). */
export interface CliCallBudgetConfig {
    readonly max_calls_per_day: ReadonlyMap<string, number>;
    readonly warn_at: number;
}

export interface CouncilConfig {
    readonly enabled: boolean;
    readonly defaults: DefaultsConfig;
    readonly cost_budget: CostBudgetConfig;
    readonly members: ReadonlyMap<string, MemberConfig>;
    readonly advisors: ReadonlyMap<string, AdvisorConfig>;
    readonly consensus_scoring: ConsensusScoringConfig;
    readonly cli_call_budget: CliCallBudgetConfig;
    readonly necessity_classifier: NecessityClassifierConfig;
    readonly model_downgrade: ModelDowngradeConfig;
    readonly debate: DebateConfig;
    readonly decision_replay: DecisionReplayConfig;
    readonly decision_resolution: DecisionResolutionConfig;
    readonly routing: RoutingConfig;
    readonly low_impact: LowImpactConfig;
    readonly lens_overrides: LensOverridesConfig;
    readonly source_path: PathLike | null;
}

// ── default factories (dataclass defaults) ─────────────────────────

function _defaultCostDisclosure(): CostDisclosureConfig {
    return { mode: 'always', threshold_usd: 1.0, show_per_member: true };
}

function _defaultFuzzyMatch(): FuzzyMatchConfig {
    return { enabled: false, threshold: 0.92 };
}

function _defaultFastPath(): LowImpactFastPathConfig {
    return {
        max_members: 2,
        max_rounds: 1,
        max_tokens: 2500,
        max_cost_usd: 0.05,
        fuzzy_match: _defaultFuzzyMatch(),
    };
}

// ── path constants ─────────────────────────────────────────────────

/** Dotfile name for the council config in any scope. */
export const COUNCIL_CONFIG_RELNAME = '.ai-council.yml';

/**
 * User-global location, relative to `event4u_root()` — under `settings/`
 * alongside the other per-user config (`.agent-settings.yml`,
 * `.agent-user.yml`). This is exactly the path the browser setup wizard
 * reads/writes (`<writeRoot>/settings/.ai-council.yml` in
 * `src/server/routes/wizard.ts`), so a council configured in the wizard
 * is the same file the CLI reads.
 */
export const COUNCIL_CONFIG_USER_GLOBAL_REL = 'settings/.ai-council.yml';

/**
 * Env var pinning the council config to an explicit absolute path, ahead
 * of the project → user-global search. Mirrors `EVENT4U_CONFIG_HOME` but
 * targets the config file itself (tests / power users).
 */
export const COUNCIL_CONFIG_ENV = 'AI_COUNCIL_CONFIG';

// ── expanduser (Python Path.expanduser parity) ────────────────────

function _expanduser(p: string): string {
    if (p === '~') {
        return os.homedir();
    }
    if (
        p.startsWith('~/') ||
        (process.platform === 'win32' && p.startsWith('~\\'))
    ) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/** Mirror of `pathlib.Path.is_absolute()` (POSIX + Windows). */
function _isAbsoluteLikePython(p: string): boolean {
    if (process.platform === 'win32') {
        return (
            /^[a-zA-Z]:[\\/]/.test(p) ||
            /^([\\/]{2})[^\\/]+[\\/][^\\/]+/.test(p)
        );
    }
    return p.startsWith('/');
}

// ── path resolution ────────────────────────────────────────────────

/**
 * Resolve which `.ai-council.yml` the council reads.
 *
 * Precedence (first match wins):
 *
 * 1. `$AI_COUNCIL_CONFIG` — explicit absolute override (tests / power
 *    users). Honoured even when the target is absent.
 * 2. Project-local `<project_root>/agents/settings/.ai-council.yml`.
 * 3. User-global `~/.event4u/agent-config/settings/.ai-council.yml`
 *    (with the legacy `~/.config/agent-config/` read-fallback).
 *
 * Always returns a path (never `null`): when nothing exists yet it
 * returns the user-global write target.
 */
export function resolve_config_path(
    project_root: PathLike,
    options: { env?: user_global_paths.EnvMap | null } = {},
): PathLike {
    const env_map = options.env != null ? options.env : process.env;
    const override = env_map[COUNCIL_CONFIG_ENV];
    if (override) {
        return _expanduser(override);
    }
    const project_path = path.join(
        project_root,
        'agents',
        'settings',
        COUNCIL_CONFIG_RELNAME,
    );
    if (fs.existsSync(project_path)) {
        return project_path;
    }
    const found = user_global_paths.resolve_with_fallback(
        COUNCIL_CONFIG_USER_GLOBAL_REL,
        { env: options.env ?? null },
    );
    if (found !== null) {
        return found;
    }
    return user_global_paths.write_target(COUNCIL_CONFIG_USER_GLOBAL_REL, {
        env: options.env ?? null,
    });
}

// ── YAML loading ───────────────────────────────────────────────────

/** Load and validate the council YAML at `path`. */
export function load_council_config(p: PathLike): CouncilConfig {
    if (!fs.existsSync(p)) {
        throw new CouncilConfigError(
            `Council config not found at ${p}. ` +
                `Create it per docs/contracts/ai-council-config.md.`,
        );
    }
    let raw: Json;
    try {
        const text = fs.readFileSync(p, 'utf-8');
        // version '1.1' matches PyYAML's safe_load scalar grammar.
        const parsed = parseYaml(text, { version: '1.1' }) as Json;
        raw = parsed === null || parsed === undefined ? {} : parsed;
    } catch (exc) {
        if (exc instanceof CouncilConfigError) {
            throw exc;
        }
        const msg = exc instanceof Error ? exc.message : String(exc);
        throw new CouncilConfigError(`${p}: invalid YAML — ${msg}`);
    }
    if (!_isDict(raw)) {
        throw new CouncilConfigError(`${p}: top-level must be a mapping.`);
    }
    return _build_config(raw, p);
}

// ── builders ───────────────────────────────────────────────────────

export function _build_config(raw: Dict, source_path: PathLike): CouncilConfig {
    const enabled = _get(raw, 'enabled', false);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError('`enabled` must be a bool.');
    }

    const defaults = _build_defaults(_asDict(_getOr(raw, 'defaults', {})));
    const cost_budget = _build_cost_budget(
        _asDict(_getOr(raw, 'cost_budget', {})),
    );

    const members_raw = _getOr(raw, 'members', {});
    if (!_isDict(members_raw)) {
        throw new CouncilConfigError('`members` must be a mapping.');
    }
    const members = new Map<string, MemberConfig>();
    for (const [name, cfg] of Object.entries(members_raw)) {
        members.set(
            name,
            _build_member(name, _asDict(_orEmpty(cfg)), defaults.mode),
        );
    }

    const advisors_raw = _getOr(raw, 'advisors', {});
    if (!_isDict(advisors_raw)) {
        throw new CouncilConfigError('`advisors` must be a mapping.');
    }
    const advisors = new Map<string, AdvisorConfig>();
    for (const [adv_name, adv_cfg] of Object.entries(advisors_raw)) {
        advisors.set(adv_name, _build_advisor(adv_name, _asDict(_orEmpty(adv_cfg))));
    }

    // Cross-validate enabled advisors against the members block. An
    // advisor referencing a missing or disabled member is a hard error
    // — never a silent skip — so a typo never costs the user money on
    // an unintended call plan.
    for (const adv of advisors.values()) {
        if (!adv.enabled) {
            continue;
        }
        const bound = members.get(adv.member);
        if (bound === undefined) {
            throw new CouncilConfigError(
                `advisors.${adv.name}.member=${_pyReprStr(adv.member)}: no such ` +
                    `member in the \`members\` block.`,
            );
        }
        if (!bound.enabled) {
            throw new CouncilConfigError(
                `advisors.${adv.name}.member=${_pyReprStr(adv.member)}: member ` +
                    `exists but is disabled. Enable the member or disable ` +
                    `the advisor.`,
            );
        }
    }

    const consensus = _build_consensus_scoring(
        _asDict(_getOr(raw, 'consensus_scoring', {})),
    );
    const cli_call_budget = _build_cli_call_budget(
        _asDict(_getOr(raw, 'cli_call_budget', {})),
    );
    const necessity_classifier = _build_necessity_classifier(
        _asDict(_getOr(raw, 'necessity_classifier', {})),
    );
    const model_downgrade = _build_model_downgrade(
        _asDict(_getOr(raw, 'model_downgrade', {})),
    );
    const debate = _build_debate(_asDict(_getOr(raw, 'debate', {})));
    const decision_replay = _build_decision_replay(
        _asDict(_getOr(raw, 'decision_replay', {})),
        'decision_replay',
    );
    const decision_resolution = _build_decision_resolution(
        _asDict(_getOr(raw, 'decision_resolution', {})),
    );
    const routing = _build_routing(_asDict(_getOr(raw, 'routing', {})), members);
    const low_impact = _build_low_impact(
        _asDict(_getOr(raw, 'low_impact', {})),
        members,
        routing,
    );
    _reject_top_level_locked_dispatch(raw);
    const lens_overrides = _build_lens_overrides(
        _asDict(_getOr(raw, 'lenses', {})),
    );

    return {
        enabled,
        defaults,
        cost_budget,
        members,
        advisors,
        consensus_scoring: consensus,
        cli_call_budget,
        necessity_classifier,
        model_downgrade,
        debate,
        decision_replay,
        decision_resolution,
        routing,
        low_impact,
        lens_overrides,
        source_path,
    };
}

/**
 * Mirror Python's `cfg or {}` for a per-entry value: falsy → `{}`.
 * Used for `cfg or {}` / `adv_cfg or {}` in the members/advisors loops.
 */
function _orEmpty(value: Json): Json {
    if (
        value === null ||
        value === undefined ||
        value === false ||
        value === 0 ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (_isDict(value) && Object.keys(value).length === 0)
    ) {
        return {};
    }
    return value;
}

/**
 * Narrow a `Json` known to be a dict (after a `_getOr(..., {})` /
 * `_orEmpty` upstream) — but a non-dict here means the caller passed a
 * raw value that the builder will reject with its own message. Pass the
 * raw value through so per-builder `isinstance(d, dict)` checks fire.
 */
function _asDict(value: Json): Dict {
    return value as Dict;
}

function _build_necessity_classifier(d: Dict): NecessityClassifierConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`necessity_classifier` must be a mapping.');
    }
    const enabled = _get(d, 'enabled', true);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(
            '`necessity_classifier.enabled` must be a bool.',
        );
    }
    const mode = _get(d, 'mode', 'educate');
    if (!(_isStr(mode) && _VALID_NECESSITY_MODES.has(mode))) {
        throw new CouncilConfigError(
            `necessity_classifier.mode=${_pyRepr(mode)} not in ` +
                `${_sortedListRepr(_VALID_NECESSITY_MODES)}.`,
        );
    }
    const user_explicit_mode = _get(d, 'user_explicit_mode', 'warn-only');
    if (
        !(_isStr(user_explicit_mode) && _VALID_NECESSITY_MODES.has(user_explicit_mode))
    ) {
        throw new CouncilConfigError(
            `necessity_classifier.user_explicit_mode=` +
                `${_pyRepr(user_explicit_mode)} not in ` +
                `${_sortedListRepr(_VALID_NECESSITY_MODES)}.`,
        );
    }
    return {
        enabled: Boolean(enabled),
        mode,
        user_explicit_mode,
    };
}

function _build_model_downgrade(d: Dict): ModelDowngradeConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`model_downgrade` must be a mapping.');
    }
    const enabled = _get(d, 'enabled', true);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError('`model_downgrade.enabled` must be a bool.');
    }
    const auto_apply = _get(d, 'auto_apply', false);
    if (!_isBool(auto_apply)) {
        throw new CouncilConfigError('`model_downgrade.auto_apply` must be a bool.');
    }
    return { enabled: Boolean(enabled), auto_apply: Boolean(auto_apply) };
}

function _build_cost_disclosure(d: Dict, scope: string): CostDisclosureConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const mode = _get(d, 'mode', 'always');
    if (!(_isStr(mode) && _VALID_DISCLOSURE_MODES.has(mode))) {
        throw new CouncilConfigError(
            `${scope}.mode=${_pyRepr(mode)} not in ` +
                `${_sortedListRepr(_VALID_DISCLOSURE_MODES)}.`,
        );
    }
    const threshold = _pyFloat(_get(d, 'threshold_usd', 1.0));
    if (threshold < 0) {
        throw new CouncilConfigError(
            `${scope}.threshold_usd must be >= 0 (got ${_pyRepr(_f(threshold))}).`,
        );
    }
    const show_per_member = _get(d, 'show_per_member', true);
    if (!_isBool(show_per_member)) {
        throw new CouncilConfigError(`\`${scope}.show_per_member\` must be a bool.`);
    }
    return {
        mode,
        threshold_usd: threshold,
        show_per_member: Boolean(show_per_member),
    };
}

function _build_debate(d: Dict): DebateConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`debate` must be a mapping.');
    }
    const cap = _pyFloat(_get(d, 'max_cost_usd', 5.0));
    if (cap < 0) {
        throw new CouncilConfigError(
            `debate.max_cost_usd must be >= 0 (got ${_pyRepr(_f(cap))}; ` +
                `use 0 to disable the cap).`,
        );
    }
    const disclosure_raw = _getOr(d, 'cost_disclosure', {});
    const disclosure = _build_cost_disclosure(
        _asDict(disclosure_raw),
        'debate.cost_disclosure',
    );
    return { max_cost_usd: cap, cost_disclosure: disclosure };
}

function _build_decision_replay(d: Dict, scope: string): DecisionReplayConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const enabled = _get(d, 'enabled', true);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(`\`${scope}.enabled\` must be a bool.`);
    }
    const include_args = _get(d, 'include_member_arguments', true);
    if (!_isBool(include_args)) {
        throw new CouncilConfigError(
            `\`${scope}.include_member_arguments\` must be a bool.`,
        );
    }
    return {
        enabled: Boolean(enabled),
        include_member_arguments: Boolean(include_args),
    };
}

const _VALID_RESOLUTION_MODES: ReadonlySet<string> = new Set([
    'agent',
    'council',
    'user',
]);
const _IMPACT_CLASSES: readonly string[] = [
    'trivial',
    'low_impact',
    'medium_impact',
    'high_impact',
    'user_required',
];
const _LOCKED_IMPACT_CLASSES: ReadonlySet<string> = new Set([
    'high_impact',
    'user_required',
]);

const _DEFAULT_RESOLUTION_MODES: Readonly<Record<string, string>> = {
    trivial: 'agent',
    low_impact: 'agent',
    medium_impact: 'council',
    high_impact: 'user',
    user_required: 'user',
};

function _build_decision_resolution(d: Dict): DecisionResolutionConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`decision_resolution` must be a mapping.');
    }
    const enabled = _get(d, 'enabled', true);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(
            '`decision_resolution.enabled` must be a bool.',
        );
    }
    const classes_raw = _getOr(d, 'classes', {});
    if (!_isDict(classes_raw)) {
        throw new CouncilConfigError(
            '`decision_resolution.classes` must be a mapping.',
        );
    }
    const classes = new Map<string, DecisionResolutionEntry>();
    for (const cls of _IMPACT_CLASSES) {
        const entry_raw = _orEmpty(classes_raw[cls] ?? null);
        if (!_isDict(entry_raw)) {
            throw new CouncilConfigError(
                `\`decision_resolution.classes.${cls}\` must be a mapping.`,
            );
        }
        const mode = _get(entry_raw, 'mode', _DEFAULT_RESOLUTION_MODES[cls] as string);
        if (!(_isStr(mode) && _VALID_RESOLUTION_MODES.has(mode))) {
            throw new CouncilConfigError(
                `decision_resolution.classes.${cls}.mode=${_pyRepr(mode)} not in ` +
                    `${_sortedListRepr(_VALID_RESOLUTION_MODES)}.`,
            );
        }
        // Iron Law: high_impact + user_required are locked to user.
        if (_LOCKED_IMPACT_CLASSES.has(cls) && mode !== 'user') {
            throw new CouncilConfigError(
                `decision_resolution.classes.${cls}.mode=${_pyRepr(mode)}: ` +
                    `class \`${cls}\` is LOCKED to \`user\` (Iron Law) — ` +
                    `high-impact and user-required decisions never bypass ` +
                    `the user.`,
            );
        }
        // Iron Law: `dispatch` is not configurable for locked classes
        // (step-9 P8/P11 · U3). Any nested `dispatch` key — including
        // smuggled-in YAML anchor merges — is a hard schema error.
        if (_LOCKED_IMPACT_CLASSES.has(cls) && 'dispatch' in entry_raw) {
            throw new CouncilConfigError(
                `decision_resolution.classes.${cls}.dispatch=` +
                    `${_pyRepr(entry_raw.dispatch)}: dispatch is not ` +
                    `configurable for high-impact / user-required ` +
                    `decisions — always full council.`,
            );
        }
        const threshold = _pyFloat(_get(entry_raw, 'confidence_threshold', 0.6));
        if (!(0.0 <= threshold && threshold <= 1.0)) {
            throw new CouncilConfigError(
                `decision_resolution.classes.${cls}.confidence_threshold ` +
                    `must be in [0.0, 1.0] (got ${_pyRepr(_f(threshold))}).`,
            );
        }
        classes.set(cls, { mode, confidence_threshold: threshold });
    }
    const fast_path_raw = _getOr(d, 'fast_path', {});
    if (!_isDict(fast_path_raw)) {
        throw new CouncilConfigError(
            '`decision_resolution.fast_path` must be a mapping.',
        );
    }
    const fast_path = _build_fast_path(_asDict(fast_path_raw));
    return { enabled: Boolean(enabled), classes, fast_path };
}

function _build_fast_path(d: Dict): LowImpactFastPathConfig {
    const max_members = _get(d, 'max_members', 2);
    if (!_isInt(max_members) || _isBool(max_members)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_members must be an int ' +
                `(got ${_pyTypeName(max_members)}).`,
        );
    }
    if (max_members < 1 || max_members > 2) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_members must be 1 or 2 ' +
                `(got ${max_members}). Fast-path is by design a 1-2 member ` +
                'lookup — wider fan-out belongs in the standard council path.',
        );
    }
    const max_rounds = _get(d, 'max_rounds', 1);
    if (max_rounds !== 1) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_rounds is LOCKED to 1 ' +
                `(got ${_pyRepr(max_rounds)}). Multi-round fast-paths defeat the ` +
                'purpose — escalate to standard council instead.',
        );
    }
    const max_tokens = _get(d, 'max_tokens', 2500);
    if (!_isInt(max_tokens) || _isBool(max_tokens) || max_tokens <= 0) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_tokens must be a positive ' +
                `int (got ${_pyRepr(max_tokens)}).`,
        );
    }
    const max_cost_raw = _get(d, 'max_cost_usd', 0.05);
    if (_isBool(max_cost_raw) || !_isNumber(max_cost_raw)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_cost_usd must be a ' +
                `number (got ${_pyTypeName(max_cost_raw)}).`,
        );
    }
    const max_cost = _pyFloat(max_cost_raw);
    if (max_cost <= 0.0) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.max_cost_usd must be > 0 ' +
                `(got ${_pyRepr(_f(max_cost))}).`,
        );
    }
    const fuzzy_match = _build_fuzzy_match(_asDict(_getOr(d, 'fuzzy_match', {})));
    return {
        max_members,
        max_rounds: 1,
        max_tokens,
        max_cost_usd: max_cost,
        fuzzy_match,
    };
}

function _build_fuzzy_match(d: Dict): FuzzyMatchConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.fuzzy_match must be a mapping.',
        );
    }
    const enabled = _get(d, 'enabled', false);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.fuzzy_match.enabled must be a bool ' +
                `(got ${_pyTypeName(enabled)}).`,
        );
    }
    const threshold_raw = _get(d, 'threshold', 0.92);
    if (_isBool(threshold_raw) || !_isNumber(threshold_raw)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.fuzzy_match.threshold must be a ' +
                `number (got ${_pyTypeName(threshold_raw)}).`,
        );
    }
    const threshold = _pyFloat(threshold_raw);
    if (!(0.0 < threshold && threshold <= 1.0)) {
        throw new CouncilConfigError(
            'decision_resolution.fast_path.fuzzy_match.threshold must be in ' +
                `(0.0, 1.0] (got ${_pyRepr(_f(threshold))}).`,
        );
    }
    return { enabled, threshold };
}

function _build_lens_overrides(d: Dict): LensOverridesConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`lenses` must be a mapping.');
    }
    const nc_overrides = new Map<string, string>();
    const nc_user_overrides = new Map<string, string>();
    const md_overrides = new Map<string, ModelDowngradeConfig>();
    const cd_overrides = new Map<string, CostDisclosureConfig>();
    const dr_overrides = new Map<string, DecisionReplayConfig>();
    for (const [lens_name, lens_cfg] of Object.entries(d)) {
        if (!_isDict(lens_cfg)) {
            throw new CouncilConfigError(
                `\`lenses.${lens_name}\` must be a mapping.`,
            );
        }
        const nc_block = lens_cfg.necessity_classifier;
        if (nc_block !== undefined && nc_block !== null) {
            if (!_isDict(nc_block)) {
                throw new CouncilConfigError(
                    `\`lenses.${lens_name}.necessity_classifier\` must be a mapping.`,
                );
            }
            const mode = nc_block.mode;
            if (mode !== undefined && mode !== null) {
                if (!(_isStr(mode) && _VALID_NECESSITY_MODES.has(mode))) {
                    throw new CouncilConfigError(
                        `lenses.${lens_name}.necessity_classifier.mode=${_pyRepr(mode)} ` +
                            `not in ${_sortedListRepr(_VALID_NECESSITY_MODES)}.`,
                    );
                }
                nc_overrides.set(lens_name, mode);
            }
            const user_mode = nc_block.user_explicit_mode;
            if (user_mode !== undefined && user_mode !== null) {
                if (!(_isStr(user_mode) && _VALID_NECESSITY_MODES.has(user_mode))) {
                    throw new CouncilConfigError(
                        `lenses.${lens_name}.necessity_classifier.` +
                            `user_explicit_mode=${_pyRepr(user_mode)} ` +
                            `not in ${_sortedListRepr(_VALID_NECESSITY_MODES)}.`,
                    );
                }
                nc_user_overrides.set(lens_name, user_mode);
            }
        }
        const md_block = lens_cfg.model_downgrade;
        if (md_block !== undefined && md_block !== null) {
            if (!_isDict(md_block)) {
                throw new CouncilConfigError(
                    `\`lenses.${lens_name}.model_downgrade\` must be a mapping.`,
                );
            }
            const md_enabled = _get(md_block, 'enabled', true);
            if (!_isBool(md_enabled)) {
                throw new CouncilConfigError(
                    `\`lenses.${lens_name}.model_downgrade.enabled\` must be a bool.`,
                );
            }
            const md_auto = _get(md_block, 'auto_apply', false);
            if (!_isBool(md_auto)) {
                throw new CouncilConfigError(
                    `\`lenses.${lens_name}.model_downgrade.auto_apply\` must be a bool.`,
                );
            }
            md_overrides.set(lens_name, {
                enabled: Boolean(md_enabled),
                auto_apply: Boolean(md_auto),
            });
        }
        const cd_block = lens_cfg.cost_disclosure;
        if (cd_block !== undefined && cd_block !== null) {
            cd_overrides.set(
                lens_name,
                _build_cost_disclosure(
                    _asDict(cd_block),
                    `lenses.${lens_name}.cost_disclosure`,
                ),
            );
        }
        const dr_block = lens_cfg.decision_replay;
        if (dr_block !== undefined && dr_block !== null) {
            dr_overrides.set(
                lens_name,
                _build_decision_replay(
                    _asDict(dr_block),
                    `lenses.${lens_name}.decision_replay`,
                ),
            );
        }
    }
    return {
        necessity_classifier_mode: nc_overrides,
        necessity_classifier_user_explicit_mode: nc_user_overrides,
        model_downgrade: md_overrides,
        cost_disclosure: cd_overrides,
        decision_replay: dr_overrides,
    };
}

function _build_consensus_scoring(d: Dict): ConsensusScoringConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`consensus_scoring` must be a mapping.');
    }
    const strong = _pyFloat(_get(d, 'strong_threshold', 0.7));
    const minority = _pyFloat(_get(d, 'minority_threshold', 0.4));
    if (!(0.0 <= minority && minority <= strong && strong <= 1.0)) {
        throw new CouncilConfigError(
            `consensus_scoring thresholds broken: require ` +
                `0 <= minority (${_pyNum(minority)}) <= strong (${_pyNum(strong)}) <= 1.`,
        );
    }
    const lenses_raw = _get(d, 'lenses', ['analysis']);
    if (!_isList(lenses_raw) || !lenses_raw.every((x) => _isStr(x))) {
        throw new CouncilConfigError(
            '`consensus_scoring.lenses` must be a list of strings.',
        );
    }
    return {
        enabled: Boolean(_pyTruthy(_get(d, 'enabled', false))),
        strong_threshold: strong,
        minority_threshold: minority,
        lenses: lenses_raw as string[],
    };
}

const _VALID_MEMBER_MODES: ReadonlySet<string> = new Set(['cli', 'api']);

function _build_defaults(d: Dict): DefaultsConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`defaults` must be a mapping.');
    }
    const mode = _get(d, 'mode', 'api');
    if (!(_isStr(mode) && _VALID_MODES.has(mode))) {
        throw new CouncilConfigError(
            `defaults.mode=${_pyRepr(mode)} not in ${_sortedListRepr(_VALID_MODES)}.`,
        );
    }
    // `member_mode` (step-9 P8 · U1) — global preference for solo /
    // CLI-mode invocations. Narrower set than `defaults.mode` because
    // `manual` makes no sense as a per-member dispatch default.
    const member_mode = _get(d, 'member_mode', 'cli');
    if (!(_isStr(member_mode) && _VALID_MEMBER_MODES.has(member_mode))) {
        throw new CouncilConfigError(
            `defaults.member_mode=${_pyRepr(member_mode)} not in ` +
                `${_sortedListRepr(_VALID_MEMBER_MODES)}.`,
        );
    }
    return {
        mode,
        member_mode,
        min_rounds: _pyInt(_get(d, 'min_rounds', 2)),
        deep_min_rounds: _pyInt(_get(d, 'deep_min_rounds', 3)),
        max_output_tokens: _pyInt(_get(d, 'max_output_tokens', 0)),
        session_retention_days: _pyInt(_get(d, 'session_retention_days', 7)),
        debate_max_rounds: _pyInt(_get(d, 'debate_max_rounds', 4)),
    };
}

const _VALID_DISPATCH_MODES: ReadonlySet<string> = new Set(['full', 'single']);

function _build_routing(d: Dict, members: Map<string, MemberConfig>): RoutingConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`routing` must be a mapping.');
    }
    const chain_raw = _get(d, 'solo_member_fallback_chain', []);
    if (!_isList(chain_raw)) {
        throw new CouncilConfigError(
            '`routing.solo_member_fallback_chain` must be a list ' +
                `(got ${_pyTypeName(chain_raw)}).`,
        );
    }
    const chain: string[] = [];
    const seen = new Set<string>();
    for (let idx = 0; idx < chain_raw.length; idx++) {
        const entry = chain_raw[idx];
        if (!_isStr(entry) || entry.trim() === '') {
            throw new CouncilConfigError(
                `routing.solo_member_fallback_chain[${idx}]: each ` +
                    `entry must be a non-empty string (got ${_pyRepr(entry)}).`,
            );
        }
        if (seen.has(entry)) {
            throw new CouncilConfigError(
                `routing.solo_member_fallback_chain[${idx}]: ` +
                    `duplicate entry ${_pyReprStr(entry)} — chain order must be ` +
                    `unique.`,
            );
        }
        if (!members.has(entry)) {
            throw new CouncilConfigError(
                `routing.solo_member_fallback_chain[${idx}]=${_pyReprStr(entry)}: ` +
                    `no such member in the \`members\` block.`,
            );
        }
        seen.add(entry);
        chain.push(entry);
    }
    const timeout_raw = _get(d, 'auth_check_timeout_seconds', 3);
    if (
        !_isInt(timeout_raw) ||
        _isBool(timeout_raw) ||
        !(1 <= timeout_raw && timeout_raw <= 30)
    ) {
        throw new CouncilConfigError(
            'routing.auth_check_timeout_seconds must be an int in ' +
                `[1, 30] (got ${_pyRepr(timeout_raw)}).`,
        );
    }
    return {
        solo_member_fallback_chain: chain,
        auth_check_timeout_seconds: timeout_raw,
    };
}

function _build_low_impact(
    d: Dict,
    members: Map<string, MemberConfig>,
    routing: RoutingConfig,
): LowImpactConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`low_impact` must be a mapping.');
    }
    const dispatch = _get(d, 'dispatch', 'full');
    if (!(_isStr(dispatch) && _VALID_DISPATCH_MODES.has(dispatch))) {
        throw new CouncilConfigError(
            `low_impact.dispatch=${_pyRepr(dispatch)} not in ` +
                `${_sortedListRepr(_VALID_DISPATCH_MODES)}.`,
        );
    }
    if (dispatch === 'single') {
        const enabled_in_chain = routing.solo_member_fallback_chain.filter(
            (name) => members.get(name) !== undefined && members.get(name)!.enabled,
        );
        if (enabled_in_chain.length === 0) {
            throw new CouncilConfigError(
                "low_impact.dispatch='single' requires at least one " +
                    'enabled member in routing.solo_member_fallback_chain ' +
                    `(chain=${_pyRepr([...routing.solo_member_fallback_chain])}). ` +
                    "Enable a chain member or set dispatch back to 'full'.",
            );
        }
    }
    const shadow_raw = _get(d, 'shadow_sample_rate', 0.1);
    if (_isBool(shadow_raw) || !_isNumber(shadow_raw)) {
        throw new CouncilConfigError(
            'low_impact.shadow_sample_rate must be a number ' +
                `(got ${_pyTypeName(shadow_raw)}).`,
        );
    }
    const shadow = _pyFloat(shadow_raw);
    if (!(0.0 <= shadow && shadow <= 1.0)) {
        throw new CouncilConfigError(
            'low_impact.shadow_sample_rate must be in [0.0, 1.0] ' +
                `(got ${_pyRepr(_f(shadow))}).`,
        );
    }
    const floor_raw = _get(d, 'solo_confidence_floor', 0.7);
    if (_isBool(floor_raw) || !_isNumber(floor_raw)) {
        throw new CouncilConfigError(
            'low_impact.solo_confidence_floor must be a number ' +
                `(got ${_pyTypeName(floor_raw)}).`,
        );
    }
    const floor = _pyFloat(floor_raw);
    if (!(0.0 <= floor && floor <= 1.0)) {
        throw new CouncilConfigError(
            'low_impact.solo_confidence_floor must be in [0.0, 1.0] ' +
                `(got ${_pyRepr(_f(floor))}).`,
        );
    }
    return {
        dispatch,
        shadow_sample_rate: shadow,
        solo_confidence_floor: floor,
    };
}

function _reject_top_level_locked_dispatch(raw: Dict): void {
    for (const cls of _LOCKED_IMPACT_CLASSES) {
        const block = raw[cls];
        if (!_isDict(block)) {
            continue;
        }
        if ('dispatch' in block) {
            throw new CouncilConfigError(
                `${cls}.dispatch=${_pyRepr(block.dispatch)}: dispatch is ` +
                    `not configurable for high-impact / user-required ` +
                    `decisions — always full council.`,
            );
        }
        if ('solo_confidence_floor' in block) {
            throw new CouncilConfigError(
                `${cls}.solo_confidence_floor=` +
                    `${_pyRepr(block.solo_confidence_floor)}: irrelevant on ` +
                    `high-impact / user-required classes — they never ` +
                    `dispatch solo. Set on \`low_impact\` instead.`,
            );
        }
    }
}

function _build_cost_budget(d: Dict): CostBudgetConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`cost_budget` must be a mapping.');
    }
    const cb: CostBudgetConfig = {
        max_input_tokens: _pyInt(_get(d, 'max_input_tokens', 500_000)),
        max_output_tokens: _pyInt(_get(d, 'max_output_tokens', 200_000)),
        max_calls: _pyInt(_get(d, 'max_calls', 50)),
        max_total_usd: _pyFloat(_get(d, 'max_total_usd', 20.0)),
    };
    const fields: Array<[keyof CostBudgetConfig, boolean]> = [
        ['max_input_tokens', false],
        ['max_output_tokens', false],
        ['max_calls', false],
        ['max_total_usd', true],
    ];
    for (const [fname, isFloat] of fields) {
        const val = cb[fname];
        if (val < 0) {
            throw new CouncilConfigError(
                `cost_budget.${fname} must be >= 0 (got ` +
                    `${isFloat ? _pyRepr(_f(val)) : _pyRepr(val)}).`,
            );
        }
    }
    return cb;
}

function _build_member(
    name: string,
    cfg: Dict,
    default_mode = 'api',
): MemberConfig {
    if (!_VALID_PROVIDERS.has(name)) {
        throw new CouncilConfigError(
            `members.${name}: unknown provider; valid: ` +
                `${_sortedListRepr(_VALID_PROVIDERS)}.`,
        );
    }
    const member_enabled = Boolean(_pyTruthy(_get(cfg, 'enabled', false)));
    const modelVal = _get(cfg, 'model', null);
    const model = _pyTruthy(modelVal) ? (modelVal as string) : '';
    const api_key_ref_raw = _get(cfg, 'api_key_ref', null);
    const api_key_ref = api_key_ref_raw === undefined ? null : api_key_ref_raw;
    const member_mode_raw = _get(cfg, 'mode', null);
    const member_mode = member_mode_raw === undefined ? null : member_mode_raw;
    if (member_mode !== null && !(_isStr(member_mode) && _VALID_MODES.has(member_mode))) {
        throw new CouncilConfigError(
            `members.${name}.mode=${_pyRepr(member_mode)} not in ` +
                `${_sortedListRepr(_VALID_MODES)}.`,
        );
    }
    const effective_mode = member_mode !== null ? (member_mode as string) : default_mode;
    const binary_raw = _get(cfg, 'binary', null);
    const binary = binary_raw === undefined ? null : binary_raw;
    if (binary !== null) {
        if (!_isStr(binary) || binary.trim() === '') {
            throw new CouncilConfigError(
                `members.${name}.binary must be a non-empty string when set.`,
            );
        }
        if (effective_mode !== 'cli') {
            throw new CouncilConfigError(
                `members.${name}.binary is only valid when the member's ` +
                    `effective mode is 'cli' (got ${_pyRepr(effective_mode)}). Set ` +
                    `\`mode: cli\` on the member or \`defaults.mode: cli\` to use ` +
                    `this field.`,
            );
        }
    }
    if (member_enabled) {
        if (!model) {
            throw new CouncilConfigError(
                `members.${name}: enabled members require a non-empty \`model\`.`,
            );
        }
        // CLI-mode members authenticate via the subscription bound to
        // the local CLI binary; api_key_ref is not required for them.
        // Manual mode is human-transported and also key-free. Only
        // api-mode members must supply an api_key_ref.
        if (effective_mode === 'api' && !_pyTruthy(api_key_ref)) {
            throw new CouncilConfigError(
                `members.${name}: enabled api-mode members require an \`api_key_ref\`.`,
            );
        }
    }
    if (api_key_ref !== null) {
        _validate_api_key_ref(`members.${name}`, api_key_ref);
    }
    const ladder_raw = _getOr(cfg, 'model_ladder', []);
    if (!_isList(ladder_raw)) {
        throw new CouncilConfigError(
            `members.${name}.model_ladder must be a list (got ` +
                `${_pyTypeName(ladder_raw)}).`,
        );
    }
    let ladder: string[] = [];
    if (ladder_raw.length > 0) {
        const entries: string[] = [];
        for (const entry of ladder_raw) {
            if (!_isStr(entry) || entry.trim() === '') {
                throw new CouncilConfigError(
                    `members.${name}.model_ladder entries must be non-empty ` +
                        `strings (got ${_pyRepr(entry)}).`,
                );
            }
            entries.push(entry);
        }
        if (member_enabled && model && !entries.includes(model)) {
            throw new CouncilConfigError(
                `members.${name}.model_ladder must include the active ` +
                    `\`model\` (${_pyReprStr(model)}); got ${_pyRepr(entries)}.`,
            );
        }
        ladder = entries;
    }
    const participate_raw = _get(cfg, 'participate_low_impact', false);
    if (!_isBool(participate_raw)) {
        throw new CouncilConfigError(
            `members.${name}.participate_low_impact must be a bool ` +
                `(got ${_pyTypeName(participate_raw)}).`,
        );
    }
    return {
        name,
        enabled: member_enabled,
        model,
        api_key_ref: (api_key_ref as string | null) ?? null,
        mode: (member_mode as string | null) ?? null,
        binary: (binary as string | null) ?? null,
        model_ladder: ladder,
        participate_low_impact: participate_raw,
    };
}

function _build_cli_call_budget(d: Dict): CliCallBudgetConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`cli_call_budget` must be a mapping.');
    }
    const raw_caps = _getOr(d, 'max_calls_per_day', {});
    if (!_isDict(raw_caps)) {
        throw new CouncilConfigError(
            '`cli_call_budget.max_calls_per_day` must be a mapping.',
        );
    }
    const caps = new Map<string, number>();
    for (const [provider, value] of Object.entries(raw_caps)) {
        if (!_VALID_PROVIDERS.has(provider)) {
            throw new CouncilConfigError(
                `cli_call_budget.max_calls_per_day.${provider}: unknown ` +
                    `provider; valid: ${_sortedListRepr(_VALID_PROVIDERS)}.`,
            );
        }
        if (!_isInt(value) || _isBool(value) || value < 0) {
            throw new CouncilConfigError(
                `cli_call_budget.max_calls_per_day.${provider} must be a ` +
                    `non-negative integer (got ${_pyRepr(value)}).`,
            );
        }
        caps.set(provider, value);
    }
    const warn_at_raw = _get(d, 'warn_at', 0.8);
    if (_isBool(warn_at_raw) || !_isNumber(warn_at_raw)) {
        throw new CouncilConfigError(
            `cli_call_budget.warn_at must be a number in [0.0, 1.0] ` +
                `(got ${_pyRepr(warn_at_raw)}).`,
        );
    }
    const warn_at = _pyFloat(warn_at_raw);
    if (!(0.0 <= warn_at && warn_at <= 1.0)) {
        throw new CouncilConfigError(
            `cli_call_budget.warn_at must be in [0.0, 1.0] (got ${_pyNum(warn_at)}).`,
        );
    }
    return { max_calls_per_day: caps, warn_at };
}

function _build_advisor(name: string, cfg: Dict): AdvisorConfig {
    if (!_isDict(cfg)) {
        throw new CouncilConfigError(`advisors.${name}: must be a mapping.`);
    }
    const member = _get(cfg, 'member', null);
    if (!(_isStr(member) && _VALID_PROVIDERS.has(member))) {
        throw new CouncilConfigError(
            `advisors.${name}.member=${_pyRepr(member)} not a valid provider; ` +
                `valid: ${_sortedListRepr(_VALID_PROVIDERS)}.`,
        );
    }
    // `persona` may be set explicitly; otherwise default to the
    // convention path so the YAML stays terse.
    const personaVal = _get(cfg, 'persona', null);
    const persona = _pyTruthy(personaVal)
        ? (personaVal as string)
        : `personas/advisors/${name}.md`;
    const modelVal = _get(cfg, 'model', null);
    const model = modelVal === undefined ? null : modelVal;
    if (model !== null && !_isStr(model)) {
        throw new CouncilConfigError(
            `advisors.${name}.model must be a string when set.`,
        );
    }
    return {
        name,
        enabled: Boolean(_pyTruthy(_get(cfg, 'enabled', false))),
        member,
        persona,
        model: (model as string | null) ?? null,
    };
}

function _validate_api_key_ref(scope: string, ref: Json): void {
    if (!_isStr(ref) || ref === '') {
        throw new CouncilConfigError(`${scope}.api_key_ref must be a non-empty string.`);
    }
    if (_RAW_KEY_PREFIXES.some((prefix) => ref.startsWith(prefix))) {
        throw new CouncilConfigError(
            `${scope}.api_key_ref looks like a raw API key. ` +
                `Use \`file:<path>\` (0600) or \`env:<VAR>\` — never inline secrets.`,
        );
    }
    if (ref.startsWith('file:')) {
        if (ref.slice('file:'.length).trim() === '') {
            throw new CouncilConfigError(`${scope}.api_key_ref \`file:\` ref missing path.`);
        }
        return;
    }
    if (ref.startsWith('env:')) {
        if (ref.slice('env:'.length).trim() === '') {
            throw new CouncilConfigError(
                `${scope}.api_key_ref \`env:\` ref missing variable name.`,
            );
        }
        return;
    }
    throw new CouncilConfigError(
        `${scope}.api_key_ref must start with \`file:\` or \`env:\` (got ${_pyRepr(ref)}).`,
    );
}

/**
 * Resolve `file:<path>` or `env:<VAR>` to the raw key string.
 *
 * `file:` — relative paths resolve under the user-global namespace
 * (`~/.event4u/agent-config/` today, with the pre-2.4
 * `~/.config/agent-config/` tree read as a fallback). Mode must be
 * 0o600. `env:` — reads from the environment; empty/missing is a hard
 * error. Never echoes the value.
 */
export function resolve_api_key(ref: string, scope = 'api_key_ref'): string {
    _validate_api_key_ref(scope, ref);
    if (ref.startsWith('env:')) {
        const variable = ref.slice('env:'.length).trim();
        if (variable === '') {
            throw new CouncilConfigError(`${scope}: \`env:\` ref missing variable name.`);
        }
        const value = (process.env[variable] ?? '').trim();
        if (value === '') {
            throw new CouncilConfigError(
                `${scope}: env var ${_pyReprStr(variable)} is unset or empty.`,
            );
        }
        return value;
    }
    const spec = ref.slice('file:'.length).trim();
    if (spec === '') {
        throw new CouncilConfigError(`${scope}: \`file:\` ref missing path.`);
    }
    let resolved = _expanduser(spec);
    if (!_isAbsoluteLikePython(resolved)) {
        const found = user_global_paths.resolve_with_fallback(spec);
        if (found === null) {
            const target = user_global_paths.write_target(spec);
            throw new CouncilConfigError(
                `${scope}: key file not found at ${target} (or legacy fallback).`,
            );
        }
        resolved = found;
    }
    if (!fs.existsSync(resolved)) {
        throw new CouncilConfigError(`${scope}: key file does not exist at ${resolved}.`);
    }
    const mode = fs.statSync(resolved).mode & 0o7777;
    if (mode !== 0o600) {
        throw new CouncilConfigError(
            `${scope}: unsafe permissions on ${resolved}: got ${_pyOct(mode)}, ` +
                `expected 0o600. Fix:  chmod 600 ${resolved}`,
        );
    }
    const value = fs.readFileSync(resolved, 'utf-8').trim();
    if (value === '') {
        throw new CouncilConfigError(`${scope}: key file at ${resolved} is empty.`);
    }
    return value;
}

// ── small numeric helpers for f-string `{x}` (non-repr) interpolation ─

/**
 * Mirror Python `str(number)` inside an f-string `{x}` (no `!r`). For
 * the consensus / warn_at messages Python interpolates the FLOAT value
 * via `{minority}` / `{warn_at}` — these came through `float(...)` so a
 * whole value renders `1.0`, not `1`.
 */
function _pyNum(value: number): string {
    return _pyReprFloat(value);
}

/** Mirror Python truthiness for `bool(x)` / `x or ...` scalar tests. */
function _pyTruthy(value: Json): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value !== '';
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return Object.keys(value).length > 0;
}
