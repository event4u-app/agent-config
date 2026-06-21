/**
 * `HookContext` — payload carried into every hook callback.
 *
 * TypeScript twin of `work_engine/hooks/context.py` (ADR-200 py2ts —
 * work_engine.hooks subpackage). One class for both layers. Most fields are
 * `null` for any given event; the per-event subset is documented below and
 * locked by the roadmap's hook event surface table. Hooks must tolerate
 * missing fields gracefully.
 *
 * Per-event subset (mirrors the roadmap):
 *
 * Dispatcher layer (`delivery` is set; `work` is `null`):
 *     - `before_step`   → `step_name`, `delivery`
 *     - `after_step`    → `step_name`, `delivery`, `result`
 *     - `on_halt`       → `step_name`, `delivery`, `result`
 *     - `on_error`      → `step_name`, `delivery`, `exception`
 *
 * CLI layer (`work` is set; `delivery` may be set after load):
 *     - `before_load`       → `state_file`, `args`
 *     - `after_load`        → `state_file`, `work`, `fmt`
 *     - `before_dispatch`   → `work`, `delivery`, `set_name`
 *     - `after_dispatch`    → `work`, `delivery`, `final`, `halting`
 *     - `before_save`       → `work`, `delivery`, `fmt`
 *     - `after_save`        → `work`, `state_file`, `fmt`
 */

/** Arbitrary value, mirroring the Python `Any` fields. */
export type Any = unknown;

/** Per-event payload passed to every hook callback (matches the dataclass). */
export interface HookContextInit {
    // Dispatcher-layer refs.
    step_name?: string | null;
    delivery?: Any; // DeliveryState
    result?: Any; // StepResult
    exception?: Any; // BaseException

    // CLI-layer refs.
    work?: Any; // WorkState
    state_file?: string | null;
    fmt?: string | null;
    set_name?: string | null;
    final?: Any; // Outcome
    halting?: string | null;
    args?: Any; // argparse.Namespace

    // Escape hatch for hook-specific state.
    extra?: Record<string, Any>;
}

/**
 * Per-event payload passed to every hook callback.
 *
 * Fields are intentionally optional — the runner does not validate which
 * ones are populated for a given event. The contract is enforced by the
 * call sites, not by the class.
 *
 * `extra` exists as an escape hatch for hook-specific state that does not
 * warrant a dedicated field.
 */
export class HookContext {
    // Dispatcher-layer refs.
    step_name: string | null;
    delivery: Any;
    result: Any;
    exception: Any;

    // CLI-layer refs.
    work: Any;
    state_file: string | null;
    fmt: string | null;
    set_name: string | null;
    final: Any;
    halting: string | null;
    args: Any;

    // Escape hatch for hook-specific state.
    extra: Record<string, Any>;

    constructor(init: HookContextInit = {}) {
        this.step_name = init.step_name ?? null;
        this.delivery = init.delivery ?? null;
        this.result = init.result ?? null;
        this.exception = init.exception ?? null;
        this.work = init.work ?? null;
        this.state_file = init.state_file ?? null;
        this.fmt = init.fmt ?? null;
        this.set_name = init.set_name ?? null;
        this.final = init.final ?? null;
        this.halting = init.halting ?? null;
        this.args = init.args ?? null;
        this.extra = init.extra ?? {};
    }
}
