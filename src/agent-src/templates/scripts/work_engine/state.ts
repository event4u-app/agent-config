/**
 * Schema v1 of the universal-engine work state.
 *
 * TypeScript twin of `work_engine/state.py` (ADR-200 py2ts). Byte-for-byte
 * serialization parity with the Python original is the contract: field order,
 * defaults, validation order, and error text are all part of the wire format
 * the dispatcher and the freeze-guard replay depend on.
 *
 * The wire format adds five envelope fields on top of the legacy
 * `DeliveryState` shape from `implement_ticket.delivery_state`:
 *
 * - `version` — integer schema version, currently `1`.
 * - `input.kind` — typed input variant (only `"ticket"` for R1).
 * - `input.data` — the original payload (was `state.ticket` in v0).
 * - `intent` — coarse intent label (`"backend-coding"` for R1).
 * - `directive_set` — name of the directive bundle the dispatcher
 *   loads. The enum is forward-compatible: `ui`, `ui-trivial`, and
 *   `mixed` are accepted by the schema even though only `backend`
 *   has working directives in R1 (Phase 4 Step 4 — pre-listed to avoid
 *   a schema bump when R3 V2 lands).
 * - `stack` — optional `{frontend, mtime}` cache populated by
 *   `work_engine.stack.detect` (R3 Phase 1). `null` while the
 *   detector has not yet run; the dispatcher fills it on the first UI
 *   dispatch and re-runs detection when `mtime` no longer matches the
 *   filesystem (manifest edited).
 * - `ui_audit` — optional inventory written by the
 *   `existing-ui-audit` skill (R3 Phase 2). `null` while the audit
 *   has not run; populated dict once the skill returns. `greenfield`
 *   flag plus `greenfield_decision` carry the user's scaffolding
 *   pick. The audit gate (`work_engine.directives.ui.audit`)
 *   refuses to advance to design/apply while the slot is empty or
 *   while `greenfield` is set without a recorded decision.
 * - `app_spec` — optional greenfield grounding artifact written by
 *   `work_engine.directives.ui.app_spec` (greenfield-scaffold
 *   Phase 2). Derives a `pages` set, `entity_model`, and `flow_map`
 *   from the prompt and carries a `confirmed` flag (the lightweight
 *   confirm halt) plus a `bypassed` flag (the "just scaffold" escape).
 *   `null` for every non-greenfield-scaffold flow — the app-spec gate
 *   is a no-op outside `greenfield_decision == "scaffold"`.
 * - `ui_design` — optional design brief produced by
 *   `work_engine.directives.ui.design` (R3 Phase 3 Step 1). Locks
 *   layout / components / states / microcopy / a11y; `design_confirmed`
 *   carries the user's sign-off.
 * - `ui_scaffold` — optional greenfield scaffold plan written by
 *   `work_engine.directives.ui.scaffold` (greenfield-scaffold
 *   Phase 3). Plan-only and stack-agnostic
 *   (`{pages, routes, layout_strategy, component_manifest, token_seed}`);
 *   the engine writes no files — a stack scaffold skill consumes the plan,
 *   creates the skeleton, and sets `scaffolded = true` + `artifacts`.
 *   `null` for every non-greenfield-scaffold flow. The scaffold gate
 *   sits in the `plan` slot (after design): design fixes the abstract
 *   visual language, scaffold maps it onto concrete structure.
 * - `ui_review` — optional review-pass output written by
 *   `work_engine.directives.ui.review` (R3 Phase 3 Step 4). Carries
 *   the design-review findings list and a `review_clean` flag set when
 *   no findings remain.
 * - `ui_polish` — optional polish-pass log written by
 *   `work_engine.directives.ui.polish` (R3 Phase 3 Step 5). Tracks
 *   the round counter (`rounds` <= 2 ceiling) and the per-round
 *   applied-fix list so a re-entry knows whether the loop has been
 *   exhausted.
 * - `contract` — optional backend-contract envelope written by
 *   `work_engine.directives.mixed.contract` (R3 Phase 4 Step 1).
 *   Locks `data_model` and `api_surface` before any UI work starts;
 *   `contract_confirmed` carries the user's sign-off. The mixed UI
 *   step refuses to advance without a confirmed contract — this is the
 *   sentinel that prevents UI work from racing ahead of the backend.
 * - `stitch` — optional integration-verification envelope written by
 *   `work_engine.directives.mixed.stitch` (R3 Phase 4 Step 3).
 *   Carries the end-to-end smoke `scenarios` list, an aggregate
 *   `verdict` (success / blocked / partial), and the
 *   `integration_confirmed` flag the user sets after reviewing the
 *   integration evidence.
 * - `halts` — append-only log of `HookHalt` events the engine
 *   persisted into state. Populated by `emitters._emit_halt` when
 *   it runs against an already-persisted state file (the P3 branch table
 *   is preserved: fresh-run halts before the first `_save` still leave
 *   no state on disk). The `explain_last` trace builder reads the
 *   tail entry to fill the `trace.halt` slot. Each entry is
 *   `{reason, step, surface, timestamp}`. The list defaults to empty
 *   and is omitted from older state files via `from_dict`'s tolerant
 *   reader — no schema-version bump.
 *
 * All other fields keep their v0 names so the dispatcher can read the
 * legacy slice unchanged once Phase 3 wires the steps over.
 *
 * The module exposes:
 *
 * - `SCHEMA_VERSION` — the integer carried in `version`.
 * - `KNOWN_INPUT_KINDS` / `KNOWN_DIRECTIVE_SETS` — the
 *   whitelists used by validation.
 * - `Input`, `WorkState` — typed classes.
 * - `from_dict` / `to_dict` — JSON round-trip helpers.
 * - `SchemaError` — raised on every validation failure.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── JSON value model ────────────────────────────────────────────────────
//
// The persisted state carries arbitrary user JSON (the input payload, the
// plan / changes / tests / verify slots). Model it as the standard JSON
// union so the heterogeneous dict shape and any-missing-key access survive
// without `any`.

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

/** A heterogeneous JSON object, mirroring a Python `dict[str, Any]`. */
export type Dict = { [key: string]: JsonValue };

export const SCHEMA_VERSION = 1;
/** Integer version stored under the `version` key on disk. */

export const DEFAULT_INTENT = 'backend-coding';
/** Intent applied when migrating a v0 file or building a fresh state. */

export const DEFAULT_DIRECTIVE_SET = 'backend';
/** Directive set applied when migrating a v0 file or building a fresh state. */

/**
 * Input kinds accepted by the schema.
 *
 * `ticket` is the R1 kind: pre-structured `{id, title, acceptance_criteria, ...}`
 * fed by the `/implement-ticket` flow. `prompt` is the R2 kind: a free-form
 * user prompt wrapped via `work_engine.resolvers.prompt` into
 * `{raw, reconstructed_ac, assumptions}`; the engine refines the raw text
 * into actionable AC + a confidence band before plan/apply/test/review run.
 *
 * `diff` and `file` are the R3 Phase 1 UI-improve kinds. `diff` carries a
 * unified-diff / patch payload (`{raw, reconstructed_ac, assumptions}`) so the
 * `directives/ui` set can take an "improve this screen" PR-style input; `file`
 * carries a path reference to an existing component/page (`{path,
 * reconstructed_ac, assumptions}`) for the same surface. Both default-route to
 * `ui-improve` via `work_engine.intent.populate_routing`.
 *
 * Per the schema/capability split documented on
 * `work_engine.directives.backend.SUPPORTED_KINDS`, presence here only
 * means the *envelope* is accepted on disk — a directive set still has to
 * list the kind in its `SUPPORTED_KINDS` tuple before the dispatcher will
 * route it. R2 widens the envelope; R2 Phase 3 widens backend's capability
 * tuple in lockstep with the `refine-prompt` skill landing. R3 Phase 1 widens
 * the envelope further; `ui` capability is wired in Phase 3 of the UI track.
 *
 * Other kinds are rejected so unknown values surface as errors instead of
 * silently falling through to a default branch.
 */
export const KNOWN_INPUT_KINDS: ReadonlySet<string> = new Set([
    'ticket',
    'prompt',
    'diff',
    'file',
]);

/**
 * Directive sets recognised by the schema.
 *
 * Per the roadmap (Phase 4 Step 4), `ui`, `ui-trivial`, and `mixed`
 * are intentionally pre-listed so a future R3 V2 release does not need a
 * schema bump. Only `backend` has working directives in R1; the others
 * raise `NotImplementedError` at dispatch time.
 */
export const KNOWN_DIRECTIVE_SETS: ReadonlySet<string> = new Set([
    'backend',
    'ui',
    'ui-trivial',
    'mixed',
]);

/** Raised when a state payload violates the v1 contract. */
export class SchemaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SchemaError';
        Object.setPrototypeOf(this, SchemaError.prototype);
    }
}

/**
 * Typed envelope for the user-supplied work item.
 *
 * `kind` is one of `KNOWN_INPUT_KINDS`; `data` is the raw
 * payload. The legacy `state.ticket` dict lands here as
 * `Input(kind="ticket", data=<dict>)` after migration.
 */
export class Input {
    kind: string;
    data: Dict;

    constructor(kind: string, data: Dict | null = null) {
        this.kind = kind;
        // Mirror `field(default_factory=dict)` — a fresh empty dict per instance.
        this.data = data ?? {};
    }
}

/**
 * Schema v1 of the persisted work state.
 *
 * Field order mirrors the on-disk JSON: envelope (`version`,
 * `input`, `intent`, `directive_set`, `stack`) first, then
 * the legacy `DeliveryState` slice (`persona` ... `report`) so a
 * diff between a v1 file and its v0 ancestor stays readable.
 */
export class WorkState {
    input: Input;
    intent: string;
    directive_set: string;
    stack: Dict | null;
    ui_audit: Dict | null;
    app_spec: Dict | null;
    ui_design: Dict | null;
    ui_scaffold: Dict | null;
    ui_review: Dict | null;
    ui_polish: Dict | null;
    contract: Dict | null;
    stitch: Dict | null;
    halts: Dict[];
    version: number;
    persona: string;
    memory: Dict[];
    plan: JsonValue;
    changes: Dict[];
    tests: JsonValue;
    verify: JsonValue;
    outcomes: { [key: string]: string };
    questions: string[];
    report: string;

    constructor(opts: {
        input: Input;
        intent?: string;
        directive_set?: string;
        stack?: Dict | null;
        ui_audit?: Dict | null;
        app_spec?: Dict | null;
        ui_design?: Dict | null;
        ui_scaffold?: Dict | null;
        ui_review?: Dict | null;
        ui_polish?: Dict | null;
        contract?: Dict | null;
        stitch?: Dict | null;
        halts?: Dict[];
        version?: number;
        persona?: string;
        memory?: Dict[];
        plan?: JsonValue;
        changes?: Dict[];
        tests?: JsonValue;
        verify?: JsonValue;
        outcomes?: { [key: string]: string };
        questions?: string[];
        report?: string;
    }) {
        this.input = opts.input;
        this.intent = opts.intent ?? DEFAULT_INTENT;
        this.directive_set = opts.directive_set ?? DEFAULT_DIRECTIVE_SET;
        this.stack = opts.stack ?? null;
        this.ui_audit = opts.ui_audit ?? null;
        this.app_spec = opts.app_spec ?? null;
        this.ui_design = opts.ui_design ?? null;
        this.ui_scaffold = opts.ui_scaffold ?? null;
        this.ui_review = opts.ui_review ?? null;
        this.ui_polish = opts.ui_polish ?? null;
        this.contract = opts.contract ?? null;
        this.stitch = opts.stitch ?? null;
        this.halts = opts.halts ?? [];
        this.version = opts.version ?? SCHEMA_VERSION;
        this.persona = opts.persona ?? 'senior-engineer';
        this.memory = opts.memory ?? [];
        this.plan = opts.plan ?? null;
        this.changes = opts.changes ?? [];
        this.tests = opts.tests ?? null;
        this.verify = opts.verify ?? null;
        this.outcomes = opts.outcomes ?? {};
        this.questions = opts.questions ?? [];
        this.report = opts.report ?? '';
    }
}

/**
 * Serialise `state` to the canonical v1 JSON shape.
 *
 * Field order is fixed: `version` -> `input` -> `intent` ->
 * `directive_set` -> legacy slice. Stable order keeps state
 * snapshots diff-friendly across re-runs and across the freeze-guard
 * replay. Validation runs before serialisation so an in-memory
 * object that was mutated past the schema cannot reach disk.
 */
export function to_dict(state: WorkState): Dict {
    _validate_kind(state.input.kind);
    _validate_directive_set(state.directive_set);
    if (state.version !== SCHEMA_VERSION) {
        throw new SchemaError(
            `version must be ${SCHEMA_VERSION}; got ${pyRepr(state.version)}`,
        );
    }
    _validate_stack(state.stack);
    _validate_ui_audit(state.ui_audit);
    _validate_app_spec(state.app_spec);
    _validate_ui_design(state.ui_design);
    _validate_ui_scaffold(state.ui_scaffold);
    _validate_ui_review(state.ui_review);
    _validate_ui_polish(state.ui_polish);
    _validate_contract(state.contract);
    _validate_stitch(state.stitch);
    _validate_halts(state.halts);
    return {
        version: state.version,
        input: { kind: state.input.kind, data: state.input.data },
        intent: state.intent,
        directive_set: state.directive_set,
        stack: state.stack,
        ui_audit: state.ui_audit,
        app_spec: state.app_spec,
        ui_design: state.ui_design,
        ui_scaffold: state.ui_scaffold,
        ui_review: state.ui_review,
        ui_polish: state.ui_polish,
        contract: state.contract,
        stitch: state.stitch,
        halts: [...state.halts],
        persona: state.persona,
        memory: state.memory,
        plan: state.plan,
        changes: state.changes,
        tests: state.tests,
        verify: state.verify,
        outcomes: state.outcomes,
        questions: state.questions,
        report: state.report,
    };
}

/**
 * Build a `WorkState` from a parsed JSON payload.
 *
 * Validates the envelope (`version`, `input.kind`,
 * `directive_set`) before instantiating the class. Unknown
 * top-level keys are tolerated and dropped — the schema is additive,
 * not strict-rejecting, so a future field rolled out by a newer
 * engine version does not crash an older reader.
 */
export function from_dict(payload: JsonValue): WorkState {
    if (!_isDict(payload)) {
        throw new SchemaError(
            `state payload must be a JSON object; got ${pyTypeName(payload)}`,
        );
    }

    const version = payload['version'];
    if (version !== SCHEMA_VERSION) {
        throw new SchemaError(
            `version must be ${SCHEMA_VERSION}; got ${pyRepr(version)}. ` +
                'Run the v0→v1 migration before loading legacy files.',
        );
    }

    const raw_input = payload['input'];
    if (!_isDict(raw_input)) {
        throw new SchemaError(
            "state.input must be a JSON object with 'kind' and 'data' keys",
        );
    }
    const kind = raw_input['kind'];
    _validate_kind(kind);
    const data = 'data' in raw_input ? raw_input['data'] : {};
    if (!_isDict(data)) {
        throw new SchemaError(
            `state.input.data must be a JSON object; got ${pyTypeName(data)}`,
        );
    }

    const directive_set = _get(payload, 'directive_set', DEFAULT_DIRECTIVE_SET);
    _validate_directive_set(directive_set);

    const stack = payload['stack'] ?? null;
    _validate_stack(stack);

    const ui_audit = payload['ui_audit'] ?? null;
    _validate_ui_audit(ui_audit);

    const app_spec = payload['app_spec'] ?? null;
    _validate_app_spec(app_spec);

    const ui_design = payload['ui_design'] ?? null;
    _validate_ui_design(ui_design);

    const ui_scaffold = payload['ui_scaffold'] ?? null;
    _validate_ui_scaffold(ui_scaffold);

    const ui_review = payload['ui_review'] ?? null;
    _validate_ui_review(ui_review);

    const ui_polish = payload['ui_polish'] ?? null;
    _validate_ui_polish(ui_polish);

    const contract = payload['contract'] ?? null;
    _validate_contract(contract);

    const stitch = payload['stitch'] ?? null;
    _validate_stitch(stitch);

    const halts = 'halts' in payload ? payload['halts'] : [];
    _validate_halts(halts);

    return new WorkState({
        input: new Input(kind as string, { ...(data as Dict) }),
        intent: _get(payload, 'intent', DEFAULT_INTENT) as string,
        directive_set: directive_set as string,
        stack: _isDict(stack) ? { ...stack } : null,
        ui_audit: _isDict(ui_audit) ? { ...ui_audit } : null,
        app_spec: _isDict(app_spec) ? { ...app_spec } : null,
        ui_design: _isDict(ui_design) ? { ...ui_design } : null,
        ui_scaffold: _isDict(ui_scaffold) ? { ...ui_scaffold } : null,
        ui_review: _isDict(ui_review) ? { ...ui_review } : null,
        ui_polish: _isDict(ui_polish) ? { ...ui_polish } : null,
        contract: _isDict(contract) ? { ...contract } : null,
        stitch: _isDict(stitch) ? { ...stitch } : null,
        halts: Array.isArray(halts) ? ([...halts] as Dict[]) : [],
        version: version as number,
        persona: _get(payload, 'persona', 'senior-engineer') as string,
        memory: [...(_listOrEmpty(_get(payload, 'memory', [])))] as Dict[],
        plan: _get(payload, 'plan', null),
        changes: [...(_listOrEmpty(_get(payload, 'changes', [])))] as Dict[],
        tests: _get(payload, 'tests', null),
        verify: _get(payload, 'verify', null),
        outcomes: { ...(_dictOrEmpty(_get(payload, 'outcomes', {}))) } as {
            [key: string]: string;
        },
        questions: [
            ...(_listOrEmpty(_get(payload, 'questions', []))),
        ] as string[],
        report: _get(payload, 'report', '') as string,
    });
}

/** Read a v1 state file from disk and return a `WorkState`. */
export function load(p: string): WorkState {
    const raw = fs.readFileSync(p, 'utf-8');
    let payload: JsonValue;
    try {
        payload = JSON.parse(raw) as JsonValue;
    } catch (exc) {
        throw new SchemaError(`invalid JSON in ${p}: ${(exc as Error).message}`);
    }
    return from_dict(payload);
}

/** Write `state` to `p` as pretty JSON, terminating newline included. */
export function dump(state: WorkState, p: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, jsonDumps(to_dict(state)) + '\n', 'utf-8');
}

function _validate_kind(kind: JsonValue | undefined): void {
    if (typeof kind !== 'string') {
        throw new SchemaError(
            `state.input.kind must be a string; got ${pyTypeName(kind)}`,
        );
    }
    if (!KNOWN_INPUT_KINDS.has(kind)) {
        throw new SchemaError(
            `unknown input.kind ${pyRepr(kind)}; ` +
                `expected one of ${pyListRepr(pySorted(KNOWN_INPUT_KINDS))}`,
        );
    }
}

function _validate_directive_set(name: JsonValue): void {
    if (typeof name !== 'string') {
        throw new SchemaError(
            `state.directive_set must be a string; got ${pyTypeName(name)}`,
        );
    }
    if (!KNOWN_DIRECTIVE_SETS.has(name)) {
        throw new SchemaError(
            `unknown directive_set ${pyRepr(name)}; ` +
                `expected one of ${pyListRepr(pySorted(KNOWN_DIRECTIVE_SETS))}`,
        );
    }
}

/**
 * Reject malformed stack envelopes; tolerate `null` (not yet detected).
 *
 * The detector populates `state.stack` lazily — the first dispatch
 * of a new state file may run without it set, then the dispatcher
 * fills it in before any UI handler reads it. We only validate the
 * shape when present so the absence-of-detection case stays a normal
 * code path, not an error.
 */
function _validate_stack(stack: JsonValue): void {
    if (stack === null) {
        return;
    }
    if (!_isDict(stack)) {
        throw new SchemaError(
            `state.stack must be a JSON object or null; ` +
                `got ${pyTypeName(stack)}`,
        );
    }
    const frontend = stack['frontend'];
    if (typeof frontend !== 'string' || !frontend) {
        throw new SchemaError('state.stack.frontend must be a non-empty string');
    }
    const mtime = 'mtime' in stack ? stack['mtime'] : 0.0;
    if (!_isNumber(mtime)) {
        throw new SchemaError(
            `state.stack.mtime must be a number; got ${pyTypeName(mtime)}`,
        );
    }
}

/**
 * Reject malformed `ui_audit` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the audit has not run yet — the dispatcher's audit
 * gate (`directives.ui.audit`) will emit the agent-directive that
 * populates it. An empty dict is the in-progress shape after the
 * skill returns but before findings land; the gate treats it the
 * same as `null`. Once populated, `greenfield` (when present)
 * must be a bool, and `greenfield_decision` (when present) must
 * be one of the three documented choices. Other keys (`components`,
 * `patterns`, ...) are validated by the audit handler against the
 * skill contract — the schema only enforces shape, not content.
 */
function _validate_ui_audit(ui_audit: JsonValue): void {
    if (ui_audit === null) {
        return;
    }
    if (!_isDict(ui_audit)) {
        throw new SchemaError(
            `state.ui_audit must be a JSON object or null; ` +
                `got ${pyTypeName(ui_audit)}`,
        );
    }
    if ('greenfield' in ui_audit && typeof ui_audit['greenfield'] !== 'boolean') {
        throw new SchemaError(
            'state.ui_audit.greenfield must be a boolean when present',
        );
    }
    const decision = 'greenfield_decision' in ui_audit
        ? ui_audit['greenfield_decision']
        : null;
    if (
        decision !== null &&
        decision !== 'scaffold' &&
        decision !== 'bare' &&
        decision !== 'external_reference'
    ) {
        throw new SchemaError(
            `state.ui_audit.greenfield_decision must be one of ` +
                `'scaffold', 'bare', 'external_reference', or null; ` +
                `got ${pyRepr(decision)}`,
        );
    }
    if (
        'a11y_baseline' in ui_audit &&
        !Array.isArray(ui_audit['a11y_baseline'])
    ) {
        throw new SchemaError(
            'state.ui_audit.a11y_baseline must be a list when present',
        );
    }
}

/**
 * Reject malformed `app_spec` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the app-spec gate has not produced a grounding
 * artifact yet — the greenfield-scaffold `app_spec` directive
 * (greenfield-scaffold Phase 2) emits the agent-directive that
 * populates it, and the gate is a no-op for every non-greenfield
 * flow so the slot stays `null` there. An empty dict is the
 * in-progress shape after the skill returns but before the page-set
 * lands; the gate treats it the same as `null`. Once populated,
 * `pages` / `entity_model` (when present) must be lists,
 * `flow_map` (when present) must be a list or dict, and
 * `confirmed` / `bypassed` (when present) must be bools — the
 * app-spec gate's confirm/bypass sentinels are simple equality
 * tests, so the schema enforces only shape, not content.
 */
function _validate_app_spec(app_spec: JsonValue): void {
    if (app_spec === null) {
        return;
    }
    if (!_isDict(app_spec)) {
        throw new SchemaError(
            `state.app_spec must be a JSON object or null; ` +
                `got ${pyTypeName(app_spec)}`,
        );
    }
    for (const key of ['pages', 'entity_model']) {
        if (key in app_spec && !Array.isArray(app_spec[key])) {
            throw new SchemaError(
                `state.app_spec.${key} must be a list when present`,
            );
        }
    }
    if (
        'flow_map' in app_spec &&
        !Array.isArray(app_spec['flow_map']) &&
        !_isDict(app_spec['flow_map'])
    ) {
        throw new SchemaError(
            'state.app_spec.flow_map must be a list or object when present',
        );
    }
    for (const key of ['confirmed', 'bypassed']) {
        if (key in app_spec && typeof app_spec[key] !== 'boolean') {
            throw new SchemaError(
                `state.app_spec.${key} must be a boolean when present`,
            );
        }
    }
}

/**
 * Reject malformed `ui_design` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the design step has not produced a brief yet — the
 * dispatcher's design gate (`directives.ui.design`) emits the
 * agent-directive that populates it. An empty dict is the in-progress
 * shape after the skill returns but before the brief lands; the gate
 * treats it the same as `null`. Once populated, `design_confirmed`
 * (when present) must be a bool. Other keys (`layout`, `components`,
 * `states`, `microcopy`, `a11y`, `reused_from_audit`) are
 * validated by the design handler against the skill contract — the
 * schema only enforces shape, not content.
 */
function _validate_ui_design(ui_design: JsonValue): void {
    if (ui_design === null) {
        return;
    }
    if (!_isDict(ui_design)) {
        throw new SchemaError(
            `state.ui_design must be a JSON object or null; ` +
                `got ${pyTypeName(ui_design)}`,
        );
    }
    if (
        'design_confirmed' in ui_design &&
        typeof ui_design['design_confirmed'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.ui_design.design_confirmed must be a boolean when present',
        );
    }
}

/**
 * Reject malformed `ui_scaffold` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the scaffold gate has not produced a plan yet — the
 * greenfield-scaffold `scaffold` directive (greenfield-scaffold
 * Phase 3) emits the agent-directive that populates it, and the gate
 * is a no-op for every non-greenfield flow so the slot stays `null`
 * there. An empty dict is the in-progress shape. Once populated, the
 * stack-agnostic plan keys `pages` / `routes` / `component_manifest`
 * / `artifacts` (when present) must be lists, `layout_strategy`
 * (when present) must be a string, `token_seed` (when present) must
 * be an object, and `scaffolded` (when present) must be a bool — the
 * scaffold gate's "plan produced" and "files created" sentinels are
 * simple shape/equality tests, so the schema enforces only shape.
 */
function _validate_ui_scaffold(ui_scaffold: JsonValue): void {
    if (ui_scaffold === null) {
        return;
    }
    if (!_isDict(ui_scaffold)) {
        throw new SchemaError(
            `state.ui_scaffold must be a JSON object or null; ` +
                `got ${pyTypeName(ui_scaffold)}`,
        );
    }
    for (const key of ['pages', 'routes', 'component_manifest', 'artifacts']) {
        if (key in ui_scaffold && !Array.isArray(ui_scaffold[key])) {
            throw new SchemaError(
                `state.ui_scaffold.${key} must be a list when present`,
            );
        }
    }
    if (
        'layout_strategy' in ui_scaffold &&
        typeof ui_scaffold['layout_strategy'] !== 'string'
    ) {
        throw new SchemaError(
            'state.ui_scaffold.layout_strategy must be a string when present',
        );
    }
    if ('token_seed' in ui_scaffold && !_isDict(ui_scaffold['token_seed'])) {
        throw new SchemaError(
            'state.ui_scaffold.token_seed must be a JSON object when present',
        );
    }
    if (
        'scaffolded' in ui_scaffold &&
        typeof ui_scaffold['scaffolded'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.ui_scaffold.scaffolded must be a boolean when present',
        );
    }
}

/**
 * Reject malformed `ui_review` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the review pass has not run yet — the dispatcher's
 * review gate (`directives.ui.review`) emits the agent-directive
 * that populates it. An empty dict is the in-progress shape after
 * the skill returns but before findings land. Once populated,
 * `findings` (when present) must be a list and `review_clean`
 * (when present) must be a bool. Field content (severity labels,
 * fix suggestions) is validated by the review handler; the schema
 * enforces only shape.
 */
function _validate_ui_review(ui_review: JsonValue): void {
    if (ui_review === null) {
        return;
    }
    if (!_isDict(ui_review)) {
        throw new SchemaError(
            `state.ui_review must be a JSON object or null; ` +
                `got ${pyTypeName(ui_review)}`,
        );
    }
    if ('findings' in ui_review && !Array.isArray(ui_review['findings'])) {
        throw new SchemaError(
            'state.ui_review.findings must be a list when present',
        );
    }
    if (
        'review_clean' in ui_review &&
        typeof ui_review['review_clean'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.ui_review.review_clean must be a boolean when present',
        );
    }
    const a11y = 'a11y' in ui_review ? ui_review['a11y'] : null;
    if (a11y !== null) {
        if (!_isDict(a11y)) {
            throw new SchemaError(
                'state.ui_review.a11y must be a JSON object or null when present',
            );
        }
        if ('violations' in a11y && !Array.isArray(a11y['violations'])) {
            throw new SchemaError(
                'state.ui_review.a11y.violations must be a list when present',
            );
        }
        const floor = 'severity_floor' in a11y ? a11y['severity_floor'] : null;
        if (
            floor !== null &&
            floor !== 'minor' &&
            floor !== 'moderate' &&
            floor !== 'serious' &&
            floor !== 'critical'
        ) {
            throw new SchemaError(
                `state.ui_review.a11y.severity_floor must be one of ` +
                    `'minor', 'moderate', 'serious', 'critical', or null; ` +
                    `got ${pyRepr(floor)}`,
            );
        }
        if (
            'accepted_violations' in a11y &&
            !Array.isArray(a11y['accepted_violations'])
        ) {
            throw new SchemaError(
                'state.ui_review.a11y.accepted_violations must be a list when present',
            );
        }
    }
    const preview = 'preview' in ui_review ? ui_review['preview'] : null;
    if (preview !== null) {
        if (!_isDict(preview)) {
            throw new SchemaError(
                'state.ui_review.preview must be a JSON object or null when present',
            );
        }
        if ('render_ok' in preview && typeof preview['render_ok'] !== 'boolean') {
            throw new SchemaError(
                'state.ui_review.preview.render_ok must be a boolean when present',
            );
        }
    }
}

/**
 * Reject malformed `ui_polish` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the polish loop has not entered yet. Once
 * populated, `rounds` (when present) must be an int in `[0, 2]`
 * by default — the polish-loop ceiling defined in
 * `agents/roadmaps/road-to-product-ui-track.md` Phase 3 Step 5.
 * R4 Phase 2 widens the upper bound to `3` when
 * `extension_used` is `True` (one-shot a11y extension halt).
 * `applied` (when present) must be a list. The polish handler
 * enforces ceiling semantics; the schema enforces only shape.
 */
function _validate_ui_polish(ui_polish: JsonValue): void {
    if (ui_polish === null) {
        return;
    }
    if (!_isDict(ui_polish)) {
        throw new SchemaError(
            `state.ui_polish must be a JSON object or null; ` +
                `got ${pyTypeName(ui_polish)}`,
        );
    }
    if (
        'extension_used' in ui_polish &&
        typeof ui_polish['extension_used'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.ui_polish.extension_used must be a boolean when present',
        );
    }
    const extension_used = _pyBool(
        'extension_used' in ui_polish ? ui_polish['extension_used'] : false,
    );
    if ('rounds' in ui_polish) {
        const rounds = ui_polish['rounds'];
        if (!_isPyInt(rounds)) {
            throw new SchemaError(
                `state.ui_polish.rounds must be an integer; got ${pyTypeName(rounds)}`,
            );
        }
        const max_rounds = extension_used ? 3 : 2;
        if (rounds < 0 || rounds > max_rounds) {
            throw new SchemaError(
                `state.ui_polish.rounds must be in [0, ${max_rounds}]; ` +
                    `got ${rounds} (extension_used=${pyBoolRepr(extension_used)})`,
            );
        }
    }
    if ('applied' in ui_polish && !Array.isArray(ui_polish['applied'])) {
        throw new SchemaError(
            'state.ui_polish.applied must be a list when present',
        );
    }
}

/**
 * Reject malformed `contract` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the contract step has not run yet — the mixed
 * `contract` directive (R3 Phase 4 Step 1) emits the
 * agent-directive that populates it. Once populated,
 * `data_model` and `api_surface` (when present) must be lists,
 * and `contract_confirmed` (when present) must be a bool. Field
 * content (entity names, endpoint shapes) is validated by the
 * contract handler; the schema enforces only shape so the mixed UI
 * step's sentinel check (`contract_confirmed is True`) stays a
 * simple equality test.
 */
function _validate_contract(contract: JsonValue): void {
    if (contract === null) {
        return;
    }
    if (!_isDict(contract)) {
        throw new SchemaError(
            `state.contract must be a JSON object or null; ` +
                `got ${pyTypeName(contract)}`,
        );
    }
    if ('data_model' in contract && !Array.isArray(contract['data_model'])) {
        throw new SchemaError(
            'state.contract.data_model must be a list when present',
        );
    }
    if ('api_surface' in contract && !Array.isArray(contract['api_surface'])) {
        throw new SchemaError(
            'state.contract.api_surface must be a list when present',
        );
    }
    if (
        'contract_confirmed' in contract &&
        typeof contract['contract_confirmed'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.contract.contract_confirmed must be a bool when present',
        );
    }
}

/**
 * Reject malformed `stitch` envelopes; tolerate `null` and `{}`.
 *
 * `null` means the integration-verification step has not run yet
 * — the mixed `stitch` directive (R3 Phase 4 Step 3) emits the
 * agent-directive that populates it. Once populated, `scenarios`
 * (when present) must be a list of integration smoke cases,
 * `verdict` (when present) must be one of
 * `{"success", "blocked", "partial"}`, and
 * `integration_confirmed` (when present) must be a bool. The
 * stitch handler enforces verdict semantics; the schema enforces
 * only shape.
 */
function _validate_stitch(stitch: JsonValue): void {
    if (stitch === null) {
        return;
    }
    if (!_isDict(stitch)) {
        throw new SchemaError(
            `state.stitch must be a JSON object or null; ` +
                `got ${pyTypeName(stitch)}`,
        );
    }
    if ('scenarios' in stitch && !Array.isArray(stitch['scenarios'])) {
        throw new SchemaError(
            'state.stitch.scenarios must be a list when present',
        );
    }
    if ('verdict' in stitch) {
        const verdict = stitch['verdict'];
        if (
            verdict !== 'success' &&
            verdict !== 'blocked' &&
            verdict !== 'partial'
        ) {
            throw new SchemaError(
                `state.stitch.verdict must be one of success/blocked/partial; ` +
                    `got ${pyRepr(verdict)}`,
            );
        }
    }
    if (
        'integration_confirmed' in stitch &&
        typeof stitch['integration_confirmed'] !== 'boolean'
    ) {
        throw new SchemaError(
            'state.stitch.integration_confirmed must be a bool when present',
        );
    }
}

/**
 * Reject malformed `halts` envelopes; tolerate `[]`.
 *
 * Each entry must be a dict with at minimum `reason` (str) and
 * `surface` (list of str). `step` and `timestamp` are optional
 * metadata appended by `emitters._emit_halt`. The schema enforces
 * only shape — the explain renderer is responsible for fallback
 * rendering when optional fields are absent.
 */
function _validate_halts(halts: JsonValue): void {
    if (!Array.isArray(halts)) {
        throw new SchemaError(
            `state.halts must be a list; got ${pyTypeName(halts)}`,
        );
    }
    for (let idx = 0; idx < halts.length; idx++) {
        const entry = halts[idx];
        if (!_isDict(entry)) {
            throw new SchemaError(
                `state.halts[${idx}] must be a JSON object; ` +
                    `got ${pyTypeName(entry)}`,
            );
        }
        const reason = 'reason' in entry ? entry['reason'] : undefined;
        if (typeof reason !== 'string' || !reason) {
            throw new SchemaError(
                `state.halts[${idx}].reason must be a non-empty string`,
            );
        }
        const surface = 'surface' in entry ? entry['surface'] : [];
        if (!Array.isArray(surface)) {
            throw new SchemaError(
                `state.halts[${idx}].surface must be a list; ` +
                    `got ${pyTypeName(surface)}`,
            );
        }
        for (let j = 0; j < surface.length; j++) {
            if (typeof surface[j] !== 'string') {
                throw new SchemaError(
                    `state.halts[${idx}].surface[${j}] must be a string`,
                );
            }
        }
    }
}

// ── Python-parity helpers ───────────────────────────────────────────────

/**
 * True when `v` is a plain JSON object (Python `dict`). Arrays and `null`
 * are excluded, mirroring `isinstance(x, dict)`.
 */
function _isDict(v: JsonValue | undefined): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Mirror Python `isinstance(x, (int, float))` for the `mtime` check. JSON
 * numbers (int or float) are all JS `number`; booleans are NOT numbers in
 * Python's `(int, float)` test only because `bool` IS a subclass of `int`
 * — but `_validate_stack` does not exclude bools, so neither do we: a JSON
 * `true`/`false` never reaches `mtime` as a JS boolean is `typeof boolean`,
 * not `number`. Python's `isinstance(True, (int, float))` is True; to match
 * that edge we treat a JS boolean as a number here too.
 */
function _isNumber(v: JsonValue): boolean {
    return typeof v === 'number' || typeof v === 'boolean';
}

/**
 * Mirror Python `isinstance(x, int) and not isinstance(x, bool)` for the
 * `rounds` check. A JSON integer parses to a JS `number` with no fractional
 * part; a JSON float with a fractional part is rejected; a JSON bool is
 * rejected (Python excludes bool explicitly).
 */
function _isPyInt(v: JsonValue | undefined): v is number {
    return typeof v === 'number' && Number.isInteger(v);
}

/** Mirror Python `bool(x)` truthiness for the values `ui_polish` can hold. */
function _pyBool(v: JsonValue | undefined): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (_isDict(v)) return Object.keys(v).length > 0;
    return true;
}

/** Python `dict.get(key, default)` over a JSON object. */
function _get(obj: Dict, key: string, dflt: JsonValue): JsonValue {
    return key in obj ? (obj[key] as JsonValue) : dflt;
}

/** `list(x)` where x may be a list (copy) or anything else (Python would error,
 * but `from_dict` only feeds it the result of `payload.get(k, [])`, so it is a
 * list or the default `[]`). Returns the array itself for spreading. */
function _listOrEmpty(v: JsonValue): JsonValue[] {
    return Array.isArray(v) ? v : [];
}

/** `dict(x)` where x is the result of `payload.get(k, {})`. */
function _dictOrEmpty(v: JsonValue): Dict {
    return _isDict(v) ? v : {};
}

/**
 * Python `type(x).__name__` for the JSON value classes that appear in the
 * error messages: `dict`, `list`, `str`, `int`, `float`, `bool`, `NoneType`.
 */
function pyTypeName(v: JsonValue | undefined): string {
    if (v === null || v === undefined) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (Array.isArray(v)) return 'list';
    return 'dict';
}

/**
 * Python `repr(x)` for the scalar values that flow into error messages
 * (`version`, `kind`, `decision`, `floor`, `verdict`). Strings → single-quoted
 * with Python escaping; `None` → `None`; bools → `True`/`False`; numbers as-is.
 */
function pyRepr(v: JsonValue | undefined): string {
    if (v === undefined || v === null) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return _pyNumRepr(v);
    if (typeof v === 'string') return pyStrRepr(v);
    if (Array.isArray(v)) {
        return '[' + v.map((x) => pyRepr(x)).join(', ') + ']';
    }
    // dict repr is not exercised by the .py error paths; render Python-ish.
    const items = Object.keys(v).map((k) => `${pyStrRepr(k)}: ${pyRepr(v[k])}`);
    return '{' + items.join(', ') + '}';
}

/** Python numeric repr — integer-valued floats are never produced here because
 * JSON-parsed numbers carry no float/int tag; an integer renders without `.0`. */
function _pyNumRepr(n: number): string {
    return String(n);
}

/**
 * Python `repr(str)` — prefers single quotes, switches to double quotes only
 * when the string contains a single quote but no double quote, and escapes
 * backslash plus the active quote and the standard control characters.
 */
function pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) {
            out += `\\x${code.toString(16).padStart(2, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + quote;
}

/** Python `repr(list_of_str)` for the `sorted(KNOWN_*)` error tails. */
function pyListRepr(items: string[]): string {
    return '[' + items.map((s) => pyStrRepr(s)).join(', ') + ']';
}

/** Python `repr(bool)` — `True` / `False`. */
function pyBoolRepr(b: boolean): string {
    return b ? 'True' : 'False';
}

/**
 * Python `sorted(set_of_str)` — code-point ascending, the default `str`
 * ordering CPython uses. `Array.prototype.sort()` with no comparator sorts
 * by UTF-16 code unit, which matches for the BMP ASCII tokens in these sets;
 * use an explicit code-point comparator to be faithful for any input.
 */
function pySorted(values: ReadonlySet<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Mirror Python `json.dumps(obj, indent=2, ensure_ascii=False)`.
 *
 * For round-tripped JSON (the only producer of a state dict), `JSON.stringify`
 * with a 2-space indent matches CPython byte-for-byte: 2-space indent,
 * `": "` key separator, no trailing space after the array/object item commas,
 * `{}` / `[]` for empties, non-ASCII left verbatim. The one structural
 * difference CPython has — integer-valued floats rendered as `N.0` — cannot
 * arise here: JSON has no float/int tag, so a parsed `1.0` is already the JS
 * number `1` before it ever reaches this serialiser, exactly as a Python
 * reader that parsed the same bytes would diverge. `to_dict` never injects a
 * float that did not come from the parsed payload.
 */
function jsonDumps(obj: Dict): string {
    return JSON.stringify(obj, null, 2);
}
