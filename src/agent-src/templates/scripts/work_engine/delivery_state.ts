/**
 * `DeliveryState` — the only object shared between orchestrator steps.
 *
 * TypeScript twin of `work_engine/delivery_state.py` (ADR-094 py2ts Phase 1 —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-094 — Python style is part of the contract).
 *
 * The shape mirrors `docs/contracts/implement-ticket-flow.md`. No step
 * may invent fields not declared here; extensions require a roadmap
 * amendment plus a flow-contract update.
 *
 * Steps return a `StepResult` with one of three `Outcome` values:
 *
 * - `SUCCESS`  — step populated its slice of `DeliveryState` and the
 *   dispatcher continues to the next step.
 * - `BLOCKED`  — step hit an ambiguity it cannot resolve on its own.
 *   `questions` carries pre-formatted numbered options per the
 *   `user-interaction` rule. The dispatcher halts.
 * - `PARTIAL`  — step populated its slice *and* produced open
 *   questions. The dispatcher halts with the same surface as BLOCKED;
 *   the calling orchestrator (Phase 3) decides whether to prompt the
 *   user to continue or stop.
 *
 * `DeliveryState` is a plain dataclass rather than a typed dict so
 * step handlers can rely on attribute access, defaults, and mutation
 * semantics without resorting to dictionary indirection.
 */

/** Arbitrary JSON-ish value, mirroring the Python `Any` fields. */
export type Any = unknown;

/**
 * Terminal outcome of a single step.
 *
 * The Python source subclasses `str` + `Enum`, so each member serialises as
 * its string form. We mirror that with a string-valued const object: the
 * values are exactly the strings the Python enum members carry.
 */
export const Outcome = {
    SUCCESS: 'success',
    BLOCKED: 'blocked',
    PARTIAL: 'partial',
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

/**
 * Return value of a single `Step` invocation.
 *
 * `questions` is only populated for `BLOCKED` / `PARTIAL` outcomes. Each
 * entry is a fully-formatted numbered line so the dispatcher can surface
 * them verbatim without reformatting.
 *
 * Field order (outcome, questions, message) mirrors the Python dataclass so
 * an `asdict`-style projection stays key-order identical.
 */
export class StepResult {
    outcome: Outcome;
    questions: string[];
    message: string;

    constructor(args: { outcome: Outcome; questions?: string[]; message?: string }) {
        this.outcome = args.outcome;
        // `field(default_factory=list)` → every instance owns its own array.
        this.questions = args.questions ?? [];
        this.message = args.message ?? '';
    }
}

/**
 * Canonical state passed between orchestrator steps.
 *
 * Field order matches the table in `docs/contracts/implement-ticket-flow.md`.
 * Mutable defaults are created per-instance (the Python
 * `field(default_factory=...)` contract) so every instance owns its own
 * containers — a single shared array across runs would be a cross-run
 * contamination hazard for the metrics pipeline.
 */
export class DeliveryState {
    ticket: Record<string, Any>;
    persona: string;
    memory: Array<Record<string, Any>>;
    plan: Any;
    changes: Array<Record<string, Any>>;
    tests: Any;
    verify: Any;
    outcomes: Record<string, string>;
    questions: string[];
    report: string;
    ui_audit: Record<string, Any> | null;
    ui_design: Record<string, Any> | null;
    ui_review: Record<string, Any> | null;
    ui_polish: Record<string, Any> | null;
    contract: Record<string, Any> | null;
    stitch: Record<string, Any> | null;
    stack: Record<string, Any> | null;

    constructor(args: {
        ticket: Record<string, Any>;
        persona?: string;
        memory?: Array<Record<string, Any>>;
        plan?: Any;
        changes?: Array<Record<string, Any>>;
        tests?: Any;
        verify?: Any;
        outcomes?: Record<string, string>;
        questions?: string[];
        report?: string;
        ui_audit?: Record<string, Any> | null;
        ui_design?: Record<string, Any> | null;
        ui_review?: Record<string, Any> | null;
        ui_polish?: Record<string, Any> | null;
        contract?: Record<string, Any> | null;
        stitch?: Record<string, Any> | null;
        stack?: Record<string, Any> | null;
    }) {
        this.ticket = args.ticket;
        this.persona = args.persona ?? 'senior-engineer';
        this.memory = args.memory ?? [];
        this.plan = args.plan ?? null;
        this.changes = args.changes ?? [];
        this.tests = args.tests ?? null;
        this.verify = args.verify ?? null;
        this.outcomes = args.outcomes ?? {};
        this.questions = args.questions ?? [];
        this.report = args.report ?? '';
        this.ui_audit = args.ui_audit ?? null;
        this.ui_design = args.ui_design ?? null;
        this.ui_review = args.ui_review ?? null;
        this.ui_polish = args.ui_polish ?? null;
        this.contract = args.contract ?? null;
        this.stitch = args.stitch ?? null;
        this.stack = args.stack ?? null;
    }
}

/**
 * Protocol every step handler must satisfy.
 *
 * A step reads and writes `DeliveryState` in place; its return value
 * carries only the terminal `Outcome` and any surfaced questions.
 */
export type Step = (state: DeliveryState) => StepResult;

/**
 * Marker that flags a `questions[0]` entry as agent-addressed, not
 * user-addressed.
 *
 * When a step cannot run deterministically from pure Python (edits,
 * subprocess calls, anything that needs tools the dispatcher doesn't
 * own), it returns `BLOCKED` with this prefix as the first entry of
 * `questions`. The orchestrator reads it and drives the matching
 * skill; the user-facing numbered options follow on subsequent lines.
 *
 * The prefix is public contract: changing it breaks every agent that
 * has learned to recognise it. See
 * `docs/contracts/implement-ticket-flow.md#agent-directives`.
 */
export const AGENT_DIRECTIVE_PREFIX = '@agent-directive:';

/**
 * Python `str(value)` for the scalar value kinds an agent-directive payload
 * carries. The Python source coerces every payload value with `str(...)`, so
 * `True` → `"True"`, `False` → `"False"`, `None` → `"None"`; numbers and
 * strings render as-is.
 */
function pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

/**
 * Format a canonical `@agent-directive:` line.
 *
 * `name` is the directive verb the agent dispatches on (for example
 * `"implement-plan"` or `"run-tests"`). `payload` entries are rendered as
 * `key=value` pairs on the same line, so the whole directive stays a single
 * greppable string. Values are coerced with Python `str()` semantics — richer
 * payloads belong on the `DeliveryState` itself, not in the directive line.
 *
 * Insertion order of `payload` keys is preserved, matching Python's `**kwargs`
 * ordering.
 */
export function agent_directive(name: string, payload: Record<string, unknown> = {}): string {
    const suffix = Object.entries(payload)
        .map(([key, value]) => `${key}=${pyStr(value)}`)
        .join(' ');
    return suffix
        ? `${AGENT_DIRECTIVE_PREFIX} ${name} ${suffix}`.trim()
        : `${AGENT_DIRECTIVE_PREFIX} ${name}`;
}

/**
 * True when `question` is an agent-addressed directive line.
 *
 * Used by the orchestrator to split `state.questions` into the
 * agent-facing directive (at most one, always at index 0) and the
 * user-facing numbered options (everything else).
 */
export function is_agent_directive(question: unknown): boolean {
    return typeof question === 'string' && pyLstrip(question).startsWith(AGENT_DIRECTIVE_PREFIX);
}

/**
 * Python `str.lstrip()` with no argument — strips leading whitespace as
 * Python defines it (the `str.isspace` set). JS `String.prototype.trimStart`
 * covers the same Unicode whitespace set for the inputs this module sees.
 */
function pyLstrip(s: string): string {
    return s.trimStart();
}
