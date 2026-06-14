/**
 * Decision-engine gates — schema, validation, and per-phase evaluation.
 *
 * TypeScript twin of `work_engine/scoring/decision_engine.py` (ADR-094 py2ts
 * Phase 1 — work_engine scoring subpackage). Public API names stay snake_case
 * to mirror the Python module 1:1 (per ADR-094 — Python style is part of the
 * contract).
 *
 * Reads the optional `decision_engine:` block from `.agent-settings.yml`.
 * Absent block = current behaviour (observe-only, no gates fire).
 *
 * Schema (all keys optional; the parser rejects unknown keys hard):
 *
 * - `surface_traces` (bool, default `false`) — opt-in for
 *   `DecisionTraceHook`. Predates the gates; lives here so the
 *   `decision_engine:` block has one source-of-truth schema.
 * - `min_confidence` (`low`/`medium`/`high`/`off`, default
 *   `off`) — confidence-band floor; Phase=Plan refuses to advance
 *   when the band is below.
 * - `block_on_risk` (`low`/`medium`/`high`/`off`, default
 *   `off`) — risk-class ceiling; Phase=Implement refuses to advance
 *   when risk exceeds.
 * - `require_memory_hits` (bool, default `false`) — Phase=Refine
 *   demands `memory_hits >= 1`.
 * - `on_block` (`stop`/`ask`/`warn`, default `stop`) —
 *   what happens when a gate fires.
 * - `ask_timeout_seconds` (int, default `30`) — timeout when
 *   `on_block=ask` runs in a non-interactive context (no TTY, or
 *   `CI=true`).
 * - `on_block_fallback` (`stop`/`warn`, default `stop`) —
 *   resolution after `ask_timeout` elapses.
 *
 * Gate-conflict resolution (first match wins, only one gate fires per
 * phase):
 *
 * 1. `block_on_risk`         (highest impact)
 * 2. `require_memory_hits`
 * 3. `min_confidence`        (lowest impact)
 *
 * See `docs/contracts/decision-engine-gates.md` for the full
 * priority matrix.
 */

/** Arbitrary JSON-ish value, mirroring the Python `Any` fields. */
export type Any = unknown;

export const ALLOWED_KEYS: ReadonlySet<string> = new Set([
    'surface_traces',
    'min_confidence',
    'block_on_risk',
    'require_memory_hits',
    'on_block',
    'ask_timeout_seconds',
    'on_block_fallback',
]);

const _LEVEL_VALUES: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'off']);
const _LEVEL_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };
const _ON_BLOCK_VALUES: ReadonlySet<string> = new Set(['stop', 'ask', 'warn']);
const _FALLBACK_VALUES: ReadonlySet<string> = new Set(['stop', 'warn']);

/**
 * Conflict-resolution order. Highest-impact gate first; the first
 * firing gate emits its reason and downstream gates are skipped.
 */
export const GATE_PRIORITY: readonly string[] = [
    'block_on_risk',
    'require_memory_hits',
    'min_confidence',
] as const;

const _PHASE_FOR_GATE: Record<string, string> = {
    block_on_risk: 'implement',
    require_memory_hits: 'refine',
    min_confidence: 'plan',
};

/** Raised when the `decision_engine:` block is malformed. */
export class DecisionEngineConfigError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, DecisionEngineConfigError.prototype);
        this.name = 'DecisionEngineConfigError';
    }
}

/**
 * Resolved `decision_engine:` block. Frozen to keep gate evaluations
 * replay-stable.
 */
export class DecisionEngineSettings {
    readonly surface_traces: boolean;
    readonly min_confidence: string;
    readonly block_on_risk: string;
    readonly require_memory_hits: boolean;
    readonly on_block: string;
    readonly ask_timeout_seconds: number;
    readonly on_block_fallback: string;

    constructor(args: {
        surface_traces?: boolean;
        min_confidence?: string;
        block_on_risk?: string;
        require_memory_hits?: boolean;
        on_block?: string;
        ask_timeout_seconds?: number;
        on_block_fallback?: string;
    } = {}) {
        this.surface_traces = args.surface_traces ?? false;
        this.min_confidence = args.min_confidence ?? 'off';
        this.block_on_risk = args.block_on_risk ?? 'off';
        this.require_memory_hits = args.require_memory_hits ?? false;
        this.on_block = args.on_block ?? 'stop';
        this.ask_timeout_seconds = args.ask_timeout_seconds ?? 30;
        this.on_block_fallback = args.on_block_fallback ?? 'stop';
        Object.freeze(this);
    }

    /** True when at least one gate is enabled. */
    get any_gate_active(): boolean {
        return (
            this.min_confidence !== 'off' ||
            this.block_on_risk !== 'off' ||
            this.require_memory_hits
        );
    }
}

/**
 * Outcome of one gate evaluation. `action` is the resolved
 * response after applying `on_block` plus the non-TTY fallback.
 */
export class GateDecision {
    readonly gate_id: string;
    readonly phase: string;
    readonly reason: string;
    readonly action: string; // "stop" | "warn" | "ask" | "ask_timeout"

    constructor(args: { gate_id: string; phase: string; reason: string; action: string }) {
        this.gate_id = args.gate_id;
        this.phase = args.phase;
        this.reason = args.reason;
        this.action = args.action;
        Object.freeze(this);
    }
}

/**
 * Parse a `decision_engine` block into validated settings.
 *
 * Returns defaults when `data` is `null`/`undefined` (block absent) or an
 * empty mapping. Raises {@link DecisionEngineConfigError} on unknown keys or
 * invalid values.
 */
export function parse(data: Any): DecisionEngineSettings {
    if (data === null || data === undefined) {
        return new DecisionEngineSettings();
    }
    if (!_isPlainDict(data)) {
        throw new DecisionEngineConfigError(
            'decision_engine: must be a mapping, got ' + _pyTypeName(data),
        );
    }
    const d = data as Record<string, unknown>;
    const unknown: string[] = [];
    for (const k of Object.keys(d)) {
        if (!ALLOWED_KEYS.has(k)) {
            unknown.push(k);
        }
    }
    if (unknown.length > 0) {
        throw new DecisionEngineConfigError(
            'decision_engine: unknown key(s): ' +
                _sortedStr(unknown).join(', ') +
                '. Allowed: ' +
                _sortedStr([...ALLOWED_KEYS]).join(', '),
        );
    }
    return new DecisionEngineSettings({
        surface_traces: _coerce_bool(_get(d, 'surface_traces', undefined), false),
        min_confidence: _coerce_level(_get(d, 'min_confidence', 'off'), 'min_confidence'),
        block_on_risk: _coerce_level(_get(d, 'block_on_risk', 'off'), 'block_on_risk'),
        require_memory_hits: _coerce_bool(_get(d, 'require_memory_hits', undefined), false),
        on_block: _coerce_choice(_get(d, 'on_block', 'stop'), 'on_block', _ON_BLOCK_VALUES),
        ask_timeout_seconds: _coerce_int(_get(d, 'ask_timeout_seconds', 30), 'ask_timeout_seconds'),
        on_block_fallback: _coerce_choice(
            _get(d, 'on_block_fallback', 'stop'),
            'on_block_fallback',
            _FALLBACK_VALUES,
        ),
    });
}

function _coerce_bool(value: Any, dflt: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === null || value === undefined) {
        return dflt;
    }
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (s === 'true' || s === 'yes' || s === 'on' || s === '1') {
            return true;
        }
        if (s === 'false' || s === 'no' || s === 'off' || s === '0') {
            return false;
        }
    }
    throw new DecisionEngineConfigError(`decision_engine.${_pyRepr(value)}: expected bool`);
}

function _coerce_level(value: Any, key: string): string {
    if (value === null || value === undefined) {
        return 'off';
    }
    // YAML 1.1 parses unquoted `off` as boolean False; accept it as the off
    // sentinel so writers don't have to quote. Boolean True stays rejected.
    if (typeof value === 'boolean') {
        if (value === false) {
            return 'off';
        }
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: boolean True is not a valid level ` +
                '(quote a string: low/medium/high/off)',
        );
    }
    if (typeof value !== 'string') {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: expected string, got ` + _pyTypeName(value),
        );
    }
    const s = value.trim().toLowerCase();
    if (!_LEVEL_VALUES.has(s)) {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: invalid value ${_pyRepr(value)}. ` +
                'Allowed: ' +
                _sortedStr([..._LEVEL_VALUES]).join(', '),
        );
    }
    return s;
}

function _coerce_choice(value: Any, key: string, allowed: ReadonlySet<string>): string {
    if (typeof value !== 'string') {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: expected string, got ` + _pyTypeName(value),
        );
    }
    const s = value.trim().toLowerCase();
    if (!allowed.has(s)) {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: invalid value ${_pyRepr(value)}. ` +
                'Allowed: ' +
                _sortedStr([...allowed]).join(', '),
        );
    }
    return s;
}

function _coerce_int(value: Any, key: string): number {
    if (typeof value === 'boolean') {
        throw new DecisionEngineConfigError(`decision_engine.${key}: expected int, got bool`);
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
        if (value < 0) {
            throw new DecisionEngineConfigError(`decision_engine.${key}: must be >= 0`);
        }
        return value;
    }
    throw new DecisionEngineConfigError(
        `decision_engine.${key}: expected int, got ` + _pyTypeName(value),
    );
}

/**
 * Evaluate gates for `phase`. Returns the first firing gate, or `null` when
 * no gate fires.
 *
 * Conflict resolution follows {@link GATE_PRIORITY} — only the first matching
 * gate's phase is considered. Each gate maps to exactly one phase via the
 * internal phase map.
 */
export function evaluate_gates(
    settings: DecisionEngineSettings,
    args: {
        phase: string;
        confidence_band: string | null;
        risk_class: string | null;
        memory_hits: number;
        is_interactive?: (() => boolean) | null;
    },
): GateDecision | null {
    const { phase, confidence_band, risk_class, memory_hits } = args;
    const is_interactive = args.is_interactive ?? null;
    if (!settings.any_gate_active) {
        return null;
    }
    for (const gate_id of GATE_PRIORITY) {
        if (_PHASE_FOR_GATE[gate_id] !== phase) {
            continue;
        }
        const decision = _evaluate_single(gate_id, settings, {
            confidence_band,
            risk_class,
            memory_hits,
        });
        if (decision !== null) {
            const action = _resolve_action(settings, is_interactive);
            return new GateDecision({
                gate_id: decision.gate_id,
                phase: decision.phase,
                reason: decision.reason,
                action,
            });
        }
    }
    return null;
}

function _evaluate_single(
    gate_id: string,
    settings: DecisionEngineSettings,
    args: {
        confidence_band: string | null;
        risk_class: string | null;
        memory_hits: number;
    },
): GateDecision | null {
    const { confidence_band, risk_class, memory_hits } = args;
    if (gate_id === 'min_confidence' && settings.min_confidence !== 'off') {
        // min_confidence is validated to low/medium/high here, all in _LEVEL_RANK.
        const floor = _LEVEL_RANK[settings.min_confidence] ?? 0;
        const actual = _LEVEL_RANK[(confidence_band ?? '').toLowerCase()] ?? 0;
        if (actual < floor) {
            return new GateDecision({
                gate_id,
                phase: 'plan',
                action: 'stop',
                reason:
                    `confidence_band=${_pyRepr(confidence_band)} below floor ` +
                    `min_confidence=${_pyRepr(settings.min_confidence)}`,
            });
        }
    } else if (gate_id === 'block_on_risk' && settings.block_on_risk !== 'off') {
        // block_on_risk is validated to low/medium/high here, all in _LEVEL_RANK.
        const ceiling = _LEVEL_RANK[settings.block_on_risk] ?? 0;
        const actual = _LEVEL_RANK[(risk_class ?? '').toLowerCase()] ?? 0;
        if (actual >= ceiling) {
            return new GateDecision({
                gate_id,
                phase: 'implement',
                action: 'stop',
                reason:
                    `risk_class=${_pyRepr(risk_class)} at/above ceiling ` +
                    `block_on_risk=${_pyRepr(settings.block_on_risk)}`,
            });
        }
    } else if (gate_id === 'require_memory_hits' && settings.require_memory_hits) {
        if (memory_hits < 1) {
            return new GateDecision({
                gate_id,
                phase: 'refine',
                action: 'stop',
                reason:
                    `memory_hits=${memory_hits} but ` +
                    'require_memory_hits=true (need >= 1)',
            });
        }
    }
    return null;
}

/**
 * Map `on_block` to an action, applying the non-TTY fallback.
 *
 * Non-interactive context = either `is_interactive()` returns False, or the
 * `CI` env var is truthy. `on_block=ask` collapses to `ask_timeout` (consumer
 * applies `on_block_fallback`).
 */
function _resolve_action(
    settings: DecisionEngineSettings,
    is_interactive: (() => boolean) | null,
): string {
    if (settings.on_block === 'stop' || settings.on_block === 'warn') {
        return settings.on_block;
    }
    const interactive =
        is_interactive !== null ? is_interactive() : _default_is_interactive();
    if (interactive) {
        return 'ask';
    }
    return 'ask_timeout';
}

function _default_is_interactive(): boolean {
    const ci = (process.env.CI ?? '').trim().toLowerCase();
    if (ci === '1' || ci === 'true' || ci === 'yes') {
        return false;
    }
    // Python: `sys.stdin.isatty() and sys.stdout.isatty()`.
    return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

// ── Python-parity primitives ────────────────────────────────────────────

/** `dict.get(key, default)` for a plain object. */
function _get(obj: Record<string, unknown>, key: string, dflt: unknown): unknown {
    return key in obj ? obj[key] : dflt;
}

/** Python `isinstance(x, dict)` — plain object only (not array, not null). */
function _isPlainDict(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Python `type(x).__name__` for the error-message shapes this module emits:
 * `list`, `str`, `int`, `float`, `bool`, `dict`, `NoneType`.
 */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    switch (typeof value) {
        case 'string':
            return 'str';
        case 'boolean':
            return 'bool';
        case 'number':
            return Number.isInteger(value) ? 'int' : 'float';
        case 'object':
            return 'dict';
        default:
            return typeof value;
    }
}

/**
 * Python `repr(x)` for the scalar shapes the error messages interpolate via
 * `{value!r}` — strings are single-quoted, `None` → `None`, booleans →
 * `True`/`False`, numbers as-is.
 */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
}

/** Python `sorted(list_of_str)` — code-point ascending. */
function _sortedStr(values: string[]): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
