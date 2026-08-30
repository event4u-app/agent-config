/**
 * Council configuration loader — single source of truth.
 *
 * Ported from the retired Python `src/scripts/ai_council/config.py` (ADR-200 —
 * Python→TS migration, Phase 12). Mirrors the Python module's public
 * surface and validation behaviour byte-for-byte: same exported
 * snake_case names, same defaults, same error messages, same precedence.
 *
 * Reads the user-global `~/.event4u/agent-config/settings/.ai-council.yml`
 * per the contract in `docs/contracts/ai-council-config.md` (council
 * config is ALWAYS user-global — ADR-104). Replaces the fragmented
 * `.agent-settings.yml` `ai_council` block (Phase 0 migration).
 *
 * Validation contract (8 rules, all enforced at load time):
 *
 * 1. `enabled` is a bool.
 * 2. `defaults.mode` ∈ {`api`, `manual`, `cli`, `auto`}; per-member mode
 *    same set. Semantics: `api` = SDK call against a stored key (billable);
 *    `manual` = copy & paste — human transports prompt + reply between
 *    the agent and an external chat surface (free); `cli` = shell out to
 *    a locally-installed CLI under subscription auth (free for
 *    first-party CLIs, billable for community wrappers); `auto` = pick
 *    per provider per invocation (cli → api → unavailable), resolved by
 *    `transport_resolver.ts`. `auto` is the SHIPPED DEFAULT
 *    (road-to-always-on-orchestration Phase 3.1 — CLI-first is the
 *    owner-set transport doctrine: ride the vendor CLI under subscription
 *    auth first, fall to the metered API only where no CLI resolves).
 *    `manual` and a pinned `api`/`cli` remain valid explicit per-member or
 *    per-invocation overrides — `auto` never displaces one.
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
 * 8. `binary:` is only valid when the member's effective mode is `cli` or
 *    `auto` (auto may resolve to the cli rung);
 *    `cli_call_budget.max_calls_per_day.<provider>` keys must be valid
 *    providers. `max_calls_per_day` SHIPS POPULATED with a generous
 *    per-provider default (50/day, road-to-always-on-orchestration
 *    Phase 3.4) for every known provider — a guard against a silent
 *    always-on pass exhausting a subscription's plan quota, not a brake;
 *    an explicit per-provider entry overrides just that provider's default.
 * 9. `quorum` ∈ {`"majority"`, a positive integer} (default `"majority"`,
 *    road-to-always-on-orchestration Phase 3.3). `"majority"` at n members
 *    resolves to `ceil(n / 2)` — a SIMPLE majority, deliberately NOT
 *    "more than half": at n=2 that is 1-of-2, because 2-of-2 turns any
 *    single absent member into a deadlocked release gate (council-verified
 *    2026-08-09). See `quorum.ts` for the resolver a caller applies to its
 *    own present/total member counts.
 * 9b. `quorum_min_present` ∈ positive integers (default 2, ADR-224). The
 *    floor a gate-class pass would want — SHADOW ONLY: it is recorded per
 *    pass and enforced nowhere, so no value of this key can hold, delay or
 *    fail a council pass today. See `quorum.ts::wouldSoloFloorHold` for why
 *    the measurement landed without the enforcement.
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
import * as budget from './cli_call_budget.js';
// LAYERING CONSTRAINT, load-bearing: this is a VALUE import from quorum, while
// `quorum.ts` imports `QuorumSetting` back from here. That back-edge is
// `import type` and is erased at build, so there is no runtime cycle today.
// Converting it to a value import — or adding any other runtime import from
// quorum into config — creates a real ESM cycle in the loader's init path.
import { OPENAI_CLI_VENDOR_DEFAULT } from './clients.js';
import { SOLO_FLOOR_MIN_PRESENT } from './quorum.js';

const _VALID_PROVIDERS: ReadonlySet<string> = new Set([
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'perplexity',
]);
const _VALID_MODES: ReadonlySet<string> = new Set(['api', 'manual', 'cli', 'auto']);

// The fallback/second-model surfaces live in `fallback_config.ts` — this file
// is far over the source ceiling and the documented fix is extraction.
const _FALLBACK_DEPS = {
    isDict: _isDict as (v: unknown) => v is Dict,
    isBool: _isBool as (v: unknown) => v is boolean,
    isStr: _isStr as (v: unknown) => v is string,
    repr: _pyRepr, typeName: _pyTypeName, sortedListRepr: _sortedListRepr,
    error: (msg: string): Error => new CouncilConfigError(msg),
};

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

/** Raised when the user-global `.ai-council.yml` violates the schema. */
export class CouncilConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CouncilConfigError';
    }
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
    /** Rolling 24h cap. 0 disables it — and disabling it also disables the spend
     * ledger, since the orchestrator only appends an entry while a cap is live. */
    readonly daily_limit_usd: number;
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
    /**
     * Optional capability rank for chairman-`auto` tie-breaking (Phase 2;
     * council 2026-07-12 — provider-family difference is primary, tier is the
     * tie-break). Higher = stronger. `null` when unset; selection then falls
     * back to deterministic config order.
     */
    readonly tier: number | null;
    /**
     * Cache-control TTL tier for this member's Anthropic breakpoints
     * (road-to-cache-economy Phase 4). `'5m'` is the permanent default —
     * see `prompt_cache.ttl` in `docs/contracts/ai-council-config.md` for
     * the falsification condition that gates ever enabling `'1h'`.
     */
    readonly prompt_cache_ttl: '5m' | '1h';
    /**
     * Optional `YYYY-MM-DD` stamp: the date this member's `model:` pin was last
     * checked against the provider's own surface. `null` when unset.
     *
     * Exists because a hard pin cannot notice its own age. The starter template
     * shipped `claude-sonnet-4-5` on an enabled member with nothing in the file
     * able to flag it — and `check_council_pin_staleness` reads exactly this
     * field. A member on a vendor sentinel (`codex-default`, or an alias like
     * `sonnet` that the provider documents as "the latest model") needs no
     * stamp: it cannot go stale, which is why the gate exempts it rather than
     * demanding a date nobody would refresh.
     */
    readonly verified_at: string | null;
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
    /** Phase 1B — see `inline_findings.ts`. Default `false` until 1B.4's gate is met. */
    readonly inline_findings: boolean;
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
    /**
     * Per-run escape hatch (roadmap A3): member name → model id. A member
     * listed here is pinned to that model for the run — the size classifier
     * and the cache-coupling gate are both skipped for it. Set it in
     * `.ai-council.yml` when a specific artefact needs a specific tier.
     */
    readonly model_tier_override: Readonly<Record<string, string>>;
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

/** Option-level stance tally (road-to-opt-council-deliberation Phase 1). */
export interface StanceTallyConfig {
    readonly enabled: boolean;
}

/** Chairman synthesis (road-to-opt-council-deliberation Phase 2). Default
 *  `host` = today's host-synthesis behaviour, byte-identical. */
export interface ChairmanConfig {
    readonly mode: string; // one of _VALID_CHAIRMAN_MODES
    readonly member: string | null; // required (and validated) when mode === 'member'
}

/** Debate enforcement gates (road-to-opt-council-deliberation Phase 3).
 *  Enables the anti-conformity directive + the deterministic post-round
 *  dissent-quota / novelty checks on the debate path. */
export interface DebateGatesConfig {
    readonly enabled: boolean;
}

/** Pre-round-1 restatement pass (road-to-opt-council-deliberation Phase 3). */
export interface RestateConfig {
    readonly enabled: boolean;
}

const _VALID_CHAIRMAN_MODES: ReadonlySet<string> = new Set(['host', 'member', 'auto']);

/** Routing entry for one impact class (Phase 10). */
export interface DecisionResolutionEntry {
    readonly mode: string;
    readonly confidence_threshold: number;
    /**
     * OPTIONAL local second-model rung — UOTL Phase 4.1. Absent (`null`) →
     * the ladder is unchanged. Provider set, quota binding and the locked-class
     * refusal live in `fallback_config.ts::buildSecondModel`.
     */
    readonly second_model: string | null;
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

/**
 * `"majority"` (default) or a positive integer k — the number of members a
 * pass needs to conclude (road-to-always-on-orchestration Phase 3.3). See
 * `quorum.ts::resolveQuorumThreshold` for how a caller turns this into a
 * concrete threshold against its own total-member count, and the module
 * docstring rule 9 for why `"majority"` is `ceil(n / 2)`, not `> n / 2`.
 */
export type QuorumSetting = 'majority' | number;

/**
 * The `min_present` floor ADR-224 authorized, as an operator-visible key.
 *
 * A SIBLING key rather than a widened `QuorumSetting`, deliberately.
 * `QuorumSetting` is consumed by `resolveQuorumThreshold`, `evaluateQuorum`,
 * `_quorum_setting_from` and their tests; widening it into a union with an
 * object would touch every one of them to express a value none of them read.
 * The floor is not a second threshold — `quorum` answers "did enough members
 * answer to conclude", the floor answers "was that conclusion reached on too
 * few voices to gate on", and they resolve at different call sites.
 *
 * Validated at load like every other key; defaults to
 * `quorum.ts::SOLO_FLOOR_MIN_PRESENT` so the shadow fire-rate accumulates
 * without the operator having to opt in — an unset floor that recorded nothing
 * would leave ADR-224's review trigger (b) with no data to trigger on. Nothing
 * is enforced at any value: see `wouldSoloFloorHold`.
 */
export type QuorumMinPresent = number;

export type { FallbackConfig } from './fallback_config.js';
import { buildFallback, buildSecondModel, type FallbackConfig as _FallbackConfig } from './fallback_config.js';
import {
    _f,
    _pyOct,
    _pyRepr,
    _pyReprFloat,
    _pyReprStr,
    _pyTypeName,
    _sortedListRepr,
} from './py_format.js';

export interface CouncilConfig {
    readonly enabled: boolean;
    readonly defaults: DefaultsConfig;
    readonly cost_budget: CostBudgetConfig;
    readonly members: ReadonlyMap<string, MemberConfig>;
    readonly advisors: ReadonlyMap<string, AdvisorConfig>;
    readonly consensus_scoring: ConsensusScoringConfig;
    readonly cli_call_budget: CliCallBudgetConfig;
    readonly quorum: QuorumSetting;
    readonly quorum_min_present: QuorumMinPresent;
    readonly fallback: _FallbackConfig;
    readonly necessity_classifier: NecessityClassifierConfig;
    readonly model_downgrade: ModelDowngradeConfig;
    readonly debate: DebateConfig;
    readonly decision_replay: DecisionReplayConfig;
    readonly stance_tally: StanceTallyConfig;
    readonly chairman: ChairmanConfig;
    readonly debate_gates: DebateGatesConfig;
    readonly restate: RestateConfig;
    readonly critic_protocol: CriticProtocol;
    readonly decision_resolution: DecisionResolutionConfig;
    readonly routing: RoutingConfig;
    readonly low_impact: LowImpactConfig;
    readonly lens_overrides: LensOverridesConfig;
    readonly source_path: PathLike | null;
    /**
     * Transport keys the config file still carries and the loader deliberately
     * IGNORED — dotted paths, e.g. `defaults.mode`, `members.anthropic.mode`.
     *
     * Transport is resolved per machine per invocation, never configured: the
     * chain is `cli → api → unavailable`, and an airgapped host forces the
     * `api` rung. Deleting the keys from the schema outright would have made
     * every pre-existing installation fail to load, so a stale key is
     * accepted, ignored, and reported once — the migration IS the ignore.
     *
     * Empty on a config that never carried one, which is the shape the current
     * template ships.
     */
    readonly ignored_transport_keys: readonly string[];
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
 * of the user-global default. Mirrors `EVENT4U_CONFIG_HOME` but targets
 * the config file itself (tests / power users). This is the ONLY escape
 * from the user-global location — it is an explicit absolute path, never
 * a "search the project" path.
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
 * **The council config is ALWAYS user-global.** It is a per-developer
 * facility configured once and works in every project, worktree, and
 * CWD — including consumer repos that carry no council file of their
 * own. The project tree is NEVER searched for council config (ADR-104,
 * superseding the project-local override kept by ADR-093).
 *
 * Precedence (first match wins):
 *
 * 1. `$AI_COUNCIL_CONFIG` — explicit absolute override (tests / power
 *    users). Honoured even when the target is absent. This is an
 *    explicit path, not a project search.
 * 2. User-global `~/.event4u/agent-config/settings/.ai-council.yml`
 *    (with the legacy `~/.config/agent-config/` read-fallback).
 *
 * `project_root` is accepted for signature stability with callers but is
 * NOT consulted for config resolution — the council never reads
 * `<project_root>/agents/settings/.ai-council.yml`.
 *
 * Always returns a path (never `null`): when nothing exists yet it
 * returns the user-global write target.
 */
export function resolve_config_path(
    project_root: PathLike,
    options: { env?: user_global_paths.EnvMap | null } = {},
): PathLike {
    void project_root; // intentionally unused — council config is always user-global (ADR-104).
    const env_map = options.env != null ? options.env : process.env;
    const override = env_map[COUNCIL_CONFIG_ENV];
    if (override) {
        return _expanduser(override);
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

    const ignored_transport_keys: string[] = [];
    const defaults = _build_defaults(
        _asDict(_getOr(raw, 'defaults', {})),
        ignored_transport_keys,
    );
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
            _build_member(
                name,
                _asDict(_orEmpty(cfg)),
                defaults.mode,
                ignored_transport_keys,
            ),
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
    const quorum = _build_quorum(_get(raw, 'quorum', 'majority'));
    const quorum_min_present = _build_quorum_min_present(
        _get(raw, 'quorum_min_present', SOLO_FLOOR_MIN_PRESENT),
    );
    const fallback = buildFallback(_get(raw, 'fallback', {}), _FALLBACK_DEPS);
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
    const stance_tally = _build_stance_tally(
        _asDict(_getOr(raw, 'stance_tally', {})),
        'stance_tally',
    );
    const chairman = _build_chairman(
        _asDict(_getOr(raw, 'chairman', {})),
        'chairman',
        members,
    );
    const debate_gates = _build_debate_gates(
        _asDict(_getOr(raw, 'debate_gates', {})),
        'debate_gates',
    );
    const restate = _build_restate(_asDict(_getOr(raw, 'restate', {})), 'restate');
    const critic_protocol = _build_critic_protocol(_getOr(raw, 'critic_protocol', 'legacy'));
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
        quorum,
        quorum_min_present,
        fallback,
        necessity_classifier,
        model_downgrade,
        debate,
        decision_replay,
        stance_tally,
        chairman,
        debate_gates,
        restate,
        critic_protocol,
        decision_resolution,
        routing,
        low_impact,
        lens_overrides,
        source_path,
        ignored_transport_keys,
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
    // 2026-07-28 (road-to-feedback-9.8.0-followups Phase 3): auto_apply
    // default downgraded back to FALSE (suggest, don't silently apply). The
    // A3 flip to TRUE (2026-07-20) shipped without a paired quality
    // measurement and was the only default-ON surface without one (R7
    // watch-item); until a paired eval measures downgraded-member council
    // quality, the downgrade surfaces as a suggestion the caller applies
    // explicitly. Revisit: a paired eval (full-tier vs downgraded, blind
    // judge) showing held quality re-flips this to true.
    const auto_apply = _get(d, 'auto_apply', false);
    if (!_isBool(auto_apply)) {
        throw new CouncilConfigError('`model_downgrade.auto_apply` must be a bool.');
    }
    const override_raw = _get(d, 'model_tier_override', {});
    if (!_isDict(override_raw)) {
        throw new CouncilConfigError('`model_downgrade.model_tier_override` must be a mapping.');
    }
    const model_tier_override: Record<string, string> = {};
    for (const [k, v] of Object.entries(override_raw as Dict)) {
        if (!_isStr(v) || (v as string).length === 0) {
            throw new CouncilConfigError(
                `\`model_downgrade.model_tier_override.${k}\` must be a non-empty string model id.`,
            );
        }
        model_tier_override[k] = v as string;
    }
    return { enabled: Boolean(enabled), auto_apply: Boolean(auto_apply), model_tier_override };
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

/**
 * `ai_council.stance_tally` — option-level stance tally (Phase 1). Default-off;
 * an absent block yields `{ enabled: false }`, keeping the council path
 * byte-identical. Per-field type validation (mirrors `_build_decision_replay`);
 * a non-bool `enabled` is rejected rather than silently coerced.
 */
function _build_stance_tally(d: Dict, scope: string): StanceTallyConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const enabled = _get(d, 'enabled', false);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(`\`${scope}.enabled\` must be a bool.`);
    }
    return { enabled: Boolean(enabled) };
}

/**
 * `ai_council.chairman` (Phase 2). Default `{ mode: 'host', member: null }` =
 * today's host synthesis, byte-identical. Enum-validates `mode`; when
 * `mode: 'member'` the named member must exist AND be enabled (fail-closed at
 * load, mirroring the advisor cross-validation). `mode: 'auto'` needs no member.
 */
function _build_chairman(
    d: Dict,
    scope: string,
    members: ReadonlyMap<string, MemberConfig>,
): ChairmanConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const mode = _get(d, 'mode', 'host');
    if (!(_isStr(mode) && _VALID_CHAIRMAN_MODES.has(mode))) {
        throw new CouncilConfigError(
            `\`${scope}.mode\`=${_pyRepr(mode)} not in ${_sortedListRepr(_VALID_CHAIRMAN_MODES)}.`,
        );
    }
    let member: string | null = null;
    const rawMember = _get(d, 'member', null);
    if (rawMember !== null && rawMember !== undefined) {
        if (!_isStr(rawMember)) {
            throw new CouncilConfigError(`\`${scope}.member\` must be a string.`);
        }
        member = rawMember;
    }
    if (mode === 'member') {
        if (member === null) {
            throw new CouncilConfigError(
                `\`${scope}.mode\` is 'member' but \`${scope}.member\` is unset.`,
            );
        }
        const bound = members.get(member);
        if (bound === undefined) {
            throw new CouncilConfigError(
                `\`${scope}.member\`=${_pyReprStr(member)}: no such member in the \`members\` block.`,
            );
        }
        if (!bound.enabled) {
            throw new CouncilConfigError(
                `\`${scope}.member\`=${_pyReprStr(member)}: member exists but is disabled.`,
            );
        }
    }
    return { mode, member };
}

/** `ai_council.debate_gates` (Phase 3). `{enabled}`, default false. */
function _build_debate_gates(d: Dict, scope: string): DebateGatesConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const enabled = _get(d, 'enabled', false);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(`\`${scope}.enabled\` must be a bool.`);
    }
    return { enabled: Boolean(enabled) };
}

/** `ai_council.restate` (Phase 3). `{enabled}`, default false. */
function _build_restate(d: Dict, scope: string): RestateConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError(`\`${scope}\` must be a mapping.`);
    }
    const enabled = _get(d, 'enabled', false);
    if (!_isBool(enabled)) {
        throw new CouncilConfigError(`\`${scope}.enabled\` must be a bool.`);
    }
    return { enabled: Boolean(enabled) };
}

/**
 * `critic_protocol` (road-to-judgment-and-forensic-evidence Phase 2) — which
 * critic posture adversarial/skeptic review passes use. `legacy` is the
 * shipped free-hunt skeptic; `load_bearing` is the fixed protocol that must
 * name the single load-bearing assumption and may return "holds". Default
 * `legacy` regardless of the A/B outcome (promotion is a separate decision).
 */
export type CriticProtocol = 'legacy' | 'load_bearing';

const _VALID_CRITIC_PROTOCOLS: ReadonlySet<string> = new Set(['legacy', 'load_bearing']);

function _build_critic_protocol(v: unknown): CriticProtocol {
    if (v === undefined || v === null) return 'legacy';
    if (!(_isStr(v) && _VALID_CRITIC_PROTOCOLS.has(v))) {
        throw new CouncilConfigError(
            `\`critic_protocol\`=${_pyRepr(v)} not in ${_sortedListRepr(_VALID_CRITIC_PROTOCOLS)}.`,
        );
    }
    return v as CriticProtocol;
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
        // UOTL Phase 4.1 — the optional local rung, REFUSED on a locked
        // class rather than ignored: a dropped key reads as configured.
            const second_model = buildSecondModel(
            entry_raw as Record<string, unknown>, cls, _LOCKED_IMPACT_CLASSES, _FALLBACK_DEPS);
        classes.set(cls, { mode, confidence_threshold: threshold, second_model });
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
            // Lens overrides inherit the suggest-by-default posture
            // (2026-07-28 downgrade of the unmeasured A3 auto-default).
            const md_auto = _get(md_block, 'auto_apply', false);
            if (!_isBool(md_auto)) {
                throw new CouncilConfigError(
                    `\`lenses.${lens_name}.model_downgrade.auto_apply\` must be a bool.`,
                );
            }
            md_overrides.set(lens_name, {
                enabled: Boolean(md_enabled),
                auto_apply: Boolean(md_auto),
                model_tier_override: {},
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
        inline_findings: Boolean(_pyTruthy(_get(d, 'inline_findings', false))),
    };
}

const _VALID_MEMBER_MODES: ReadonlySet<string> = new Set(['cli', 'api']);

function _build_defaults(d: Dict, ignored: string[] = []): DefaultsConfig {
    if (!_isDict(d)) {
        throw new CouncilConfigError('`defaults` must be a mapping.');
    }
    // Transport is RESOLVED, never configured.
    //
    // The CLI-first flip (road-to-always-on-orchestration Phase 3.1) changed
    // only what a config that OMITS `mode` receives. Every installation that
    // spelled the key out — which the wizard did, and which every pre-flip
    // template shipped — kept its old `api` value forever, silently, and went
    // on paying per token while a subscription CLI sat unused on the same
    // machine. A default that only fires on an absent key does not migrate
    // anybody; it just makes the docs read better than the behaviour.
    //
    // So the key is no longer read. `auto` is the only value this loader
    // produces, and `transport_resolver` picks the concrete rung per machine
    // per invocation (`cli → api → unavailable`, airgap forcing `api`). A file
    // still carrying `mode:` loads fine and is reported via
    // `ignored_transport_keys` — see `CouncilConfig`.
    // `null` as the sentinel, not `undefined`: `_get`'s default parameter is
    // typed `Json`, which excludes `undefined`. A config spelling `mode: null`
    // is indistinguishable from an absent key here, and that is correct — a
    // null transport is not a pin worth reporting.
    if (_get(d, 'mode', null) !== null) {
        ignored.push('defaults.mode');
    }
    const mode = 'auto';
    // `member_mode` (step-9 P8 · U1) — global preference for solo /
    // CLI-mode invocations. Narrower set than the retired `defaults.mode`
    // because `manual` makes no sense as a per-member dispatch default.
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
        daily_limit_usd: _pyFloat(_get(d, 'daily_limit_usd', 0.0)),
    };
    const fields: Array<[keyof CostBudgetConfig, boolean]> = [
        ['max_input_tokens', false],
        ['max_output_tokens', false],
        ['max_calls', false],
        ['max_total_usd', true],
        ['daily_limit_usd', true],
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
    // road-to-always-on-orchestration Phase 3.1: kept in sync with
    // `_build_defaults`'s `auto` default for consistency. The sole call site
    // (`_build_config`) always passes `defaults.mode` explicitly, so this
    // parameter default is unreachable on the live path today; it exists so
    // a future caller that omits the third argument observes the same
    // doctrine rather than silently reverting to the retired `api` default.
    default_mode = 'auto',
    ignored: string[] = [],
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
    // Per-member transport is no longer configurable either — same reasoning
    // as `_build_defaults`. A member that pinned `mode: api` would reintroduce
    // exactly the silent-spend path the global key was removed for, one
    // provider at a time. Recorded as ignored, never read.
    if (_get(cfg, 'mode', null) !== null) {
        ignored.push(`members.${name}.mode`);
    }
    const member_mode: string | null = null;
    const effective_mode = default_mode;
    const binary_raw = _get(cfg, 'binary', null);
    const binary = binary_raw === undefined ? null : binary_raw;
    if (binary !== null) {
        if (!_isStr(binary) || binary.trim() === '') {
            throw new CouncilConfigError(
                `members.${name}.binary must be a non-empty string when set.`,
            );
        }
        // `auto` may resolve to the cli rung, so a binary override is
        // legitimate there too — rejecting it would make `auto` unusable for
        // anyone whose CLI is not on `$PATH` under its default name.
        if (effective_mode !== 'cli' && effective_mode !== 'auto') {
            throw new CouncilConfigError(
                `members.${name}.binary is only valid when the member's ` +
                    `effective mode is 'cli' or 'auto' (got ${_pyRepr(effective_mode)}). Set ` +
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
        // `codex-default` is a SENTINEL, not a model id — "let the transport
        // choose". Requiring it to appear on a downgrade ladder of concrete ids
        // is a category error, and it is the check that blocks the one config
        // that actually works on a subscription account: the shipped template
        // cannot pin an id (every id this package shipped is on
        // `CODEX_MEASURED_UNSERVABLE`), and its ladder is an api-transport
        // concern the CLI's own default cannot be ordered against. Exempting
        // the sentinel is narrower than dropping the check — a real pin is
        // still required to be on its own ladder.
        if (
            member_enabled &&
            model &&
            model !== OPENAI_CLI_VENDOR_DEFAULT &&
            !entries.includes(model)
        ) {
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
    const tier_raw = _get(cfg, 'tier', null);
    let tier: number | null = null;
    if (tier_raw !== null && tier_raw !== undefined) {
        if (typeof tier_raw !== 'number' || !Number.isInteger(tier_raw) || tier_raw < 1) {
            throw new CouncilConfigError(
                `members.${name}.tier must be an integer >= 1 when set ` +
                    `(got ${_pyRepr(tier_raw)}).`,
            );
        }
        tier = tier_raw;
    }
    // road-to-cache-economy Phase 4: `prompt_cache` stays accepted as a
    // bare bool (the pre-existing, undocumented enable/disable form —
    // untouched here) OR as a mapping carrying `ttl`. '5m' is the
    // permanent default; see docs/contracts/ai-council-config.md
    // § Prompt cache TTL for the falsification condition on '1h'.
    // A malformed date fails CLOSED. A stamp is a claim about when a human
    // last looked; accepting `2026-13-45` or `soon` would make the staleness
    // gate report on a string it cannot compare, which is worse than no stamp.
    const verified_at_raw = _get(cfg, 'verified_at', null);
    let verified_at: string | null = null;
    if (verified_at_raw !== null && verified_at_raw !== undefined) {
        // The stamp must be a QUOTED string, and the reason is a measured
        // fail-open rather than a style preference.
        //
        // YAML 1.1 resolves an unquoted `2026-08-22` to a Date. Accepting that
        // and normalising it back with `toISOString()` was the first
        // implementation, and it LAUNDERED impossible dates: the loader silently
        // rolls `2026-13-45` over to 2027-02-14, so the calendar check below saw
        // a valid date and the malformed input passed. Verified against a real
        // config, not reasoned about.
        //
        // A Date is therefore rejected with the fix in the message. That keeps
        // the impossible-date case failing CLOSED, which is the only direction
        // worth defending here: a stamp is a claim about attention, and a
        // silently corrected claim is worse than a rejected one.
        if (verified_at_raw instanceof Date) {
            throw new CouncilConfigError(
                `members.${name}.verified_at must be QUOTED — write ` +
                    `verified_at: "YYYY-MM-DD". Unquoted, YAML parses it as a date and ` +
                    `silently rolls impossible values over (2026-13-45 becomes 2027-02-14), ` +
                    `which would let a malformed stamp through.`,
            );
        }
        const coerced = verified_at_raw;
        if (typeof coerced !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(coerced)) {
            throw new CouncilConfigError(
                `members.${name}.verified_at must be a 'YYYY-MM-DD' string when set ` +
                    `(got ${_pyRepr(verified_at_raw)}).`,
            );
        }
        const [y, m, d] = coerced.split('-').map((x) => Number(x));
        const probe = new Date(Date.UTC(y as number, (m as number) - 1, d as number));
        if (
            probe.getUTCFullYear() !== y ||
            probe.getUTCMonth() + 1 !== m ||
            probe.getUTCDate() !== d
        ) {
            throw new CouncilConfigError(
                `members.${name}.verified_at is not a real calendar date ` +
                    `(got ${_pyRepr(verified_at_raw)}).`,
            );
        }
        verified_at = coerced;
    }
    const prompt_cache_raw = _get(cfg, 'prompt_cache', null);
    let prompt_cache_ttl: '5m' | '1h' = '5m';
    if (prompt_cache_raw !== null && prompt_cache_raw !== undefined && !_isBool(prompt_cache_raw)) {
        if (!_isDict(prompt_cache_raw)) {
            throw new CouncilConfigError(
                `members.${name}.prompt_cache must be a bool or a mapping ` +
                    `(got ${_pyTypeName(prompt_cache_raw)}).`,
            );
        }
        const ttl_raw = _get(prompt_cache_raw, 'ttl', '5m');
        if (ttl_raw !== '5m' && ttl_raw !== '1h') {
            throw new CouncilConfigError(
                `members.${name}.prompt_cache.ttl must be '5m' or '1h' (got ` +
                    `${_pyRepr(ttl_raw)}). '5m' remains the default until a ` +
                    `pre-registered 30-debate gap sample clears 40% at ` +
                    `>=5-minute inter-round gaps.`,
            );
        }
        prompt_cache_ttl = ttl_raw;
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
        tier,
        prompt_cache_ttl,
        verified_at,
    };
}

/**
 * Generous per-provider guard for `mode: cli` / `mode: auto` members
 * (road-to-always-on-orchestration Phase 3.4). Before this default the map
 * shipped empty and an unlisted provider ran uncapped — a plan-quota guard
 * that only existed if the user remembered to opt in.
 *
 * Re-exported from `cli_call_budget.ts`, which owns it: `build_members` and
 * `cmd_quota` both need the same number, and re-deriving it at either site is
 * how the reported cap and the enforced cap drift apart.
 */
export const DEFAULT_CLI_CALLS_PER_DAY = budget.DEFAULT_CLI_CALLS_PER_DAY;

/**
 * Resolve the per-provider daily cap map — the SINGLE authority, shared with the
 * gate and the report. Thin wrapper that supplies this module's provider set;
 * the contract (defaults on omission, lenient where this module is strict) is
 * documented on `budget.resolveCliCallCaps`.
 */
export function resolve_cli_call_caps(raw: unknown): Record<string, number> {
    return budget.resolveCliCallCaps(raw, _VALID_PROVIDERS);
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
    // Validate FIRST, then resolve. Splitting the two is what lets the strict
    // builder and the lenient `resolve_cli_call_caps` share one seeding
    // implementation without either weakening the other: every rejection below
    // still throws, and what survives is handed to the shared resolver rather
    // than seeded a second time here.
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
    }
    const caps = new Map<string, number>(
        Object.entries(resolve_cli_call_caps(raw_caps)),
    );
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

function _build_quorum(raw: Json): QuorumSetting {
    if (raw === 'majority') {
        return 'majority';
    }
    if (_isInt(raw) && !_isBool(raw) && (raw as number) >= 1) {
        return raw as number;
    }
    throw new CouncilConfigError(
        `\`quorum\`=${_pyRepr(raw)} must be 'majority' or an integer >= 1 ` +
            `(got ${_pyTypeName(raw)}).`,
    );
}

/**
 * Validate `quorum_min_present` — the shadow floor's configured value.
 *
 * Rejects the same shapes `_build_quorum` rejects, and for the same reason: a
 * silently coerced floor produces a fire-rate that is an artefact of the
 * coercion rather than of the council. `_isInt` already requires
 * `typeof value === 'number'`, so booleans are excluded by it — the sibling's
 * extra `!_isBool` conjunct is a Python-ism (there `bool` really is an `int`
 * subclass) and is not repeated here.
 *
 * There is no upper bound — a floor above the roster is clamped per-pass by
 * `wouldSoloFloorHold`, where the roster is actually known, and rejecting it
 * at load would refuse a config that is legitimate the moment a member is
 * added.
 */
function _build_quorum_min_present(raw: Json): QuorumMinPresent {
    if (_isInt(raw) && (raw as number) >= 1) {
        return raw as number;
    }
    throw new CouncilConfigError(
        `\`quorum_min_present\`=${_pyRepr(raw)} must be an integer >= 1 ` +
            `(got ${_pyTypeName(raw)}).`,
    );
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
