/**
 * Linear step dispatcher for `/implement-ticket`.
 *
 * TypeScript twin of `work_engine/dispatcher.py` (ADR-200 py2ts Phase 1 —
 * work_engine TOP/integration layer). Public API names stay snake_case to
 * mirror the Python module 1:1 (per ADR-200 — Python style is part of the
 * contract).
 *
 * The dispatcher holds no business logic. It walks the fixed eight-step order
 * declared in `docs/contracts/implement-ticket-flow.md`, hands each step a live
 * `DeliveryState`, and honours the three terminal outcomes:
 *
 * - `SUCCESS` — record and advance.
 * - `BLOCKED` — record, copy questions onto the state, halt.
 * - `PARTIAL` — record, copy questions onto the state, halt.
 *
 * Resumption semantics (Option A, flow contract §agent-directives): steps whose
 * name is already marked `success` in `state.outcomes` are **skipped**. This
 * lets a caller re-invoke the dispatcher after executing an agent-directive,
 * update the relevant slice of `DeliveryState`, record `success` on the resumed
 * step, and continue without replaying earlier work.
 *
 * Step handlers are injected by the caller rather than discovered at import
 * time, so the dispatcher is trivially testable and never depends on handler
 * import order.
 */

import type {
    DeliveryState,
    StepResult} from './delivery_state.js';
import {
    Outcome,
    type Step
} from './delivery_state.js';
import type { HookHalt} from './hooks/index.js';
import { HookContext, HookEvent, HookRunner } from './hooks/index.js';
import { KNOWN_DIRECTIVE_SETS } from './state.js';

// Static directive-set registry. The Python source uses `import_module` to load
// `work_engine.directives.<pkg>` dynamically; a `.ts` twin may not import a
// `.py` and resolves statically instead (ADR-200). The map is keyed by the
// *wire* name (the `_PACKAGE_NAME_OVERRIDES` translation is folded into the
// keys here, e.g. `ui-trivial` → the `ui_trivial` module).
import * as _backend from './directives/backend/index.js';
import * as _mixed from './directives/mixed/index.js';
import * as _ui from './directives/ui/index.js';
import * as _ui_trivial from './directives/ui_trivial/index.js';

/** Shape every directive-set index module exposes. */
interface DirectiveSetModule {
    get_steps?: () => Map<string, Step>;
    SUPPORTED_KINDS?: ReadonlyArray<string>;
}

/**
 * Shared empty-registry runner reused when `dispatch` is called without an
 * explicit `hooks` argument. `HookRunner.emit` short-circuits when no callbacks
 * are registered, so the hot path stays branch-light while the call sites stay
 * uniform.
 */
const _NOOP_RUNNER: HookRunner = new HookRunner();

/**
 * Canonical execution order. Eight steps, fixed, no branching.
 *
 * Changing this order is a roadmap-level decision — not a PR rider — per the
 * surface-growth guardrails in `agents/roadmaps/road-to-implement-ticket.md`.
 */
export const STEP_ORDER: ReadonlyArray<string> = [
    'refine',
    'memory',
    'analyze',
    'plan',
    'implement',
    'test',
    'verify',
    'report',
];

/**
 * Directive set chosen when `state` does not carry one explicitly.
 *
 * Backwards compatibility for v0 `DeliveryState` callers: the legacy shape has
 * no `directive_set` field, so `select_directive_set` falls back to `"backend"`
 * and the engine behaves exactly as it did before R1 Phase 4.
 */
export const DEFAULT_DIRECTIVE_SET = 'backend';

// Schema enum names use hyphens (`ui-trivial`) but Python packages cannot. The
// loader is the single place that bridges between the two forms; everywhere
// else uses the wire form. (Folded into `_DIRECTIVE_SET_MODULES` keys here.)
const _PACKAGE_NAME_OVERRIDES: Record<string, string> = { 'ui-trivial': 'ui_trivial' };

/** Wire-name → static directive-set module. */
const _DIRECTIVE_SET_MODULES: Record<string, DirectiveSetModule> = {
    backend: _backend,
    ui: _ui,
    'ui-trivial': _ui_trivial,
    mixed: _mixed,
};

/**
 * Run the eight steps linearly against `state`.
 *
 * Returns a `[final_outcome, halting_step]` tuple. `halting_step` is `null`
 * when every step succeeded; otherwise it carries the name of the step whose
 * result halted the flow.
 *
 * `state` is mutated in place: each step's outcome is recorded in
 * `state.outcomes` under the step name, and any surfaced questions land on
 * `state.questions`.
 *
 * `steps` maps step name to handler. Every entry in {@link STEP_ORDER} must be
 * present; missing entries throw (mirroring Python `KeyError`) at dispatch time
 * rather than silently skipping, so incomplete wiring surfaces as a hard
 * failure.
 *
 * `hooks` is an optional {@link HookRunner}. `null` preserves every existing
 * call site verbatim — internally `dispatch` falls back to a shared
 * empty-registry runner so hook bookkeeping stays uniform without a per-emit
 * `if hooks is null` branch.
 *
 * @throws KeyError-equivalent If `steps` does not cover every entry in
 *   {@link STEP_ORDER}.
 */
export function dispatch(
    state: DeliveryState,
    steps: Map<string, Step>,
    hooks: HookRunner | null = null,
): [Outcome, string | null] {
    _assert_all_steps_present(steps);

    // Clear stale questions from a previous halt before we resume so the caller
    // never mistakes old options for fresh ones.
    state.questions = [];

    const runner = hooks !== null ? hooks : _NOOP_RUNNER;

    for (const name of STEP_ORDER) {
        if (_get(state.outcomes, name) === Outcome.SUCCESS) {
            // Already completed on an earlier invocation — skip per the resume
            // contract. The caller is responsible for keeping `state.outcomes`
            // and the matching slice in sync.
            continue;
        }

        const before_halt = runner.emit(
            HookEvent.BEFORE_STEP,
            new HookContext({ step_name: name, delivery: state }),
        );
        if (before_halt !== null) {
            return _hook_halt_blocked(state, runner, name, before_halt, null);
        }

        const handler = _stepLookup(steps, name);
        let result: StepResult;
        try {
            result = handler(state);
        } catch (exc) {
            // Let dispatcher-layer observers see the failure before the
            // exception unwinds the engine. `on_error` is observe-only; the
            // original exception is always re-raised.
            runner.emit(
                HookEvent.ON_ERROR,
                new HookContext({ step_name: name, delivery: state, exception: exc }),
            );
            throw exc;
        }
        _validate_step_result(name, result);

        state.outcomes[name] = result.outcome;

        const after_halt = runner.emit(
            HookEvent.AFTER_STEP,
            new HookContext({ step_name: name, delivery: state, result }),
        );
        if (after_halt !== null) {
            return _hook_halt_blocked(state, runner, name, after_halt, result);
        }

        if (result.outcome === Outcome.BLOCKED) {
            state.questions = [...result.questions];
            _emit_on_halt(runner, name, state, result);
            return [Outcome.BLOCKED, name];
        }

        if (result.outcome === Outcome.PARTIAL) {
            state.questions = [...result.questions];
            _emit_on_halt(runner, name, state, result);
            return [Outcome.PARTIAL, name];
        }
    }

    return [Outcome.SUCCESS, null];
}

/**
 * Translate a hook-driven {@link HookHalt} into a clean engine halt.
 *
 * Hook-driven halts are treated as first-class engine halts per the P2
 * contract: the dispatcher returns `[BLOCKED, step_name]` with `state.questions`
 * rendered verbatim from the halt's `surface`. The step's outcome marker is set
 * to `"blocked"` only when the halt fires before the handler ran (so resume
 * re-enters the gate); when it fires after the handler, the marker the handler
 * produced is preserved so resume reflects what actually happened.
 */
function _hook_halt_blocked(
    state: DeliveryState,
    runner: HookRunner,
    name: string,
    halt: HookHalt,
    result: StepResult | null,
): [Outcome, string | null] {
    if (result === null) {
        state.outcomes[name] = Outcome.BLOCKED;
    }
    state.questions = [...halt.surface];
    _emit_on_halt(runner, name, state, result);
    return [Outcome.BLOCKED, name];
}

/**
 * Fire `on_halt` as an observe-only event.
 *
 * A {@link HookHalt} raised from inside `on_halt` would create a halt-of-a-halt
 * loop; the runner returns it but the dispatcher deliberately ignores it — the
 * halt surface is already populated.
 */
function _emit_on_halt(
    runner: HookRunner,
    name: string,
    state: DeliveryState,
    result: StepResult | null,
): void {
    runner.emit(
        HookEvent.ON_HALT,
        new HookContext({ step_name: name, delivery: state, result }),
    );
}

/**
 * Reject an incomplete step mapping up front.
 *
 * We deliberately fail loudly here: a missing step would otherwise raise deep
 * inside the dispatch loop after partial state mutation, which makes debugging
 * the wiring harder than it needs to be.
 */
function _assert_all_steps_present(steps: Map<string, Step>): void {
    const missing = STEP_ORDER.filter((name) => !steps.has(name));
    if (missing.length > 0) {
        throw new KeyError('Step mapping is missing handlers for: ' + missing.join(', '));
    }
}

/**
 * Enforce the blocked/partial invariant: questions must be set.
 *
 * A step that blocks without surfacing a question is a bug — there is nothing
 * for the user to answer. We throw `ValueError` instead of silently recording
 * the outcome so the defect is visible at the earliest possible point.
 */
function _validate_step_result(name: string, result: StepResult): void {
    if (
        (result.outcome === Outcome.BLOCKED || result.outcome === Outcome.PARTIAL) &&
        result.questions.length === 0
    ) {
        throw new ValueError(
            `Step ${_pyRepr(name)} returned ${result.outcome} with no questions; ` +
                'blocked and partial outcomes must surface at least one numbered option.',
        );
    }
}

/**
 * Return the directive set name to dispatch `state` against.
 *
 * Looks for `state.directive_set` (the v1 `work_engine.state.WorkState` field)
 * and falls back to {@link DEFAULT_DIRECTIVE_SET} when the attribute is missing
 * — the legacy v0 `DeliveryState` has no such field.
 *
 * The returned name is validated against {@link KNOWN_DIRECTIVE_SETS}; an
 * unknown value throws `ValueError` rather than silently falling back, so a typo
 * in a hand-written state file fails loudly.
 */
export function select_directive_set(state: unknown): string {
    const name = _getattr(state, 'directive_set', DEFAULT_DIRECTIVE_SET);
    if (typeof name !== 'string' || name.length === 0) {
        throw new ValueError(
            `directive_set must be a non-empty string; got ${_pyRepr(name)}`,
        );
    }
    if (!KNOWN_DIRECTIVE_SETS.has(name)) {
        throw new ValueError(
            `unknown directive_set ${_pyRepr(name)}; ` +
                `known sets: ${_pyReprList(_sortedStr([...KNOWN_DIRECTIVE_SETS]))}`,
        );
    }
    return name;
}

/**
 * Resolve the `directives.<name>` package and return its step mapping.
 *
 * The selected set's index module exposes a `get_steps()` factory that returns
 * the `{step_name: handler}` mapping the dispatcher walks. The schema enum
 * carries hyphenated wire names (`ui-trivial`) but Python packages must use
 * underscores; {@link _PACKAGE_NAME_OVERRIDES} is the single translation point
 * (folded into the static module registry here).
 */
export function load_directive_set(name: string): Map<string, Step> {
    const moduleEntry = _import_directive_set(name);
    const get_steps = moduleEntry.module.get_steps;
    if (typeof get_steps !== 'function') {
        throw new AttributeError(
            `work_engine.directives.${moduleEntry.leaf} ` +
                'does not expose a callable get_steps()',
        );
    }
    const steps = get_steps();
    if (!(steps instanceof Map)) {
        throw new TypeError_(
            `work_engine.directives.${moduleEntry.leaf}` +
                `.get_steps() must return a Mapping; ` +
                `got ${_pyTypeName(steps)}`,
        );
    }
    return steps;
}

/**
 * Throw `NotImplementedError` if `set_name` cannot handle `kind`.
 *
 * Reads the per-set `SUPPORTED_KINDS` tuple and checks membership. Distinct from
 * {@link select_directive_set}, which only validates the directive-set *name*:
 * this gate validates the name/kind *pair*.
 *
 * Sets that have no `SUPPORTED_KINDS` attribute are treated as "supports
 * nothing".
 */
export function assert_kind_supported(kind: string, set_name: string): void {
    const moduleEntry = _import_directive_set(set_name);
    const supported = moduleEntry.module.SUPPORTED_KINDS ?? [];
    if (!supported.includes(kind)) {
        throw new NotImplementedError(
            `directive_set ${_pyRepr(set_name)} does not handle ` +
                `input.kind=${_pyRepr(kind)}; supported kinds: ` +
                `${_pyReprList(_sortedStr(_dedup([...supported])))}`,
        );
    }
}

/** Validate `name` and resolve the matching static package module. */
function _import_directive_set(name: string): { module: DirectiveSetModule; leaf: string } {
    if (!KNOWN_DIRECTIVE_SETS.has(name)) {
        throw new ValueError(
            `unknown directive_set ${_pyRepr(name)}; ` +
                `known sets: ${_pyReprList(_sortedStr([...KNOWN_DIRECTIVE_SETS]))}`,
        );
    }
    const leaf = _PACKAGE_NAME_OVERRIDES[name] ?? name;
    const module = _DIRECTIVE_SET_MODULES[name];
    if (module === undefined) {
        // A name in KNOWN_DIRECTIVE_SETS with no registered module would mean
        // the static registry drifted from the schema enum — surface it loudly,
        // mirroring Python's ImportError from a missing package.
        throw new ModuleNotFoundError(
            `No module named 'work_engine.directives.${leaf}'`,
        );
    }
    return { module, leaf };
}

// ── Python-parity helpers ────────────────────────────────────────────────

/** `Map.get` with a key-membership guard mirroring `dict.get`. */
function _get(obj: Record<string, string>, key: string): string | undefined {
    return key in obj ? obj[key] : undefined;
}

/** Look up a step handler, throwing the KeyError shape on a miss. */
function _stepLookup(steps: Map<string, Step>, name: string): Step {
    const handler = steps.get(name);
    if (handler === undefined) {
        throw new KeyError(_pyRepr(name));
    }
    return handler;
}

/** Python `getattr(obj, attr, default)` for plain object attribute access. */
function _getattr(obj: unknown, attr: string, dflt: unknown): unknown {
    if (obj !== null && typeof obj === 'object' && attr in (obj as Record<string, unknown>)) {
        const v = (obj as Record<string, unknown>)[attr];
        return v === undefined ? dflt : v;
    }
    return dflt;
}

/** Python `repr(x)` for the scalar shapes interpolated via `{value!r}`. */
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

/** Python `repr(list_of_str)` — `['a', 'b']`. */
function _pyReprList(values: string[]): string {
    return '[' + values.map((v) => _pyRepr(v)).join(', ') + ']';
}

/** Python `sorted(list_of_str)` — code-point ascending. */
function _sortedStr(values: string[]): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Python `set(...)` dedup (insertion order does not matter; sorted after). */
function _dedup(values: string[]): string[] {
    return [...new Set(values)];
}

/** Python `type(x).__name__` for the shapes the error messages emit. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    if (value instanceof Map) {
        // A Map is the TS stand-in for the Python `dict` get_steps returns; the
        // only non-Map path here is the guard, so report `dict`.
        return 'dict';
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

// ── Python-exception name parity ─────────────────────────────────────────
// The dispatcher raises KeyError / ValueError / TypeError / AttributeError /
// NotImplementedError / ImportError-family. JS only has a handful of builtins,
// so these named subclasses carry the Python exception *name* for callers that
// branch on it (cli.ts catches ValueError + NotImplementedError equivalents).

/** Python `KeyError`. */
export class KeyError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, KeyError.prototype);
        this.name = 'KeyError';
    }
}

/** Python `ValueError`. */
export class ValueError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, ValueError.prototype);
        this.name = 'ValueError';
    }
}

/** Python `TypeError` (named `TypeError_` to avoid the JS builtin clash). */
export class TypeError_ extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, TypeError_.prototype);
        this.name = 'TypeError';
    }
}

/** Python `AttributeError`. */
export class AttributeError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, AttributeError.prototype);
        this.name = 'AttributeError';
    }
}

/** Python `NotImplementedError`. */
export class NotImplementedError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, NotImplementedError.prototype);
        this.name = 'NotImplementedError';
    }
}

/** Python `ModuleNotFoundError` (subclass of ImportError). */
export class ModuleNotFoundError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, ModuleNotFoundError.prototype);
        this.name = 'ModuleNotFoundError';
    }
}
