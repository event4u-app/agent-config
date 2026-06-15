/**
 * `DecisionGateHook` — refuse to advance when an opt-in gate fires.
 *
 * TypeScript twin of `work_engine/hooks/builtin/decision_gate.py` (ADR-200
 * py2ts — work_engine.hooks.builtin subpackage). Bridges
 * `work_engine/scoring/decision_engine` into the dispatcher hook bus. Reads
 * the gate config from {@link DecisionEngineSettings} and fires on
 * `AFTER_STEP` only for the phase each gate owns.
 *
 * Three actions, mapped 1:1 from `evaluate_gates`:
 *
 * - `stop`        → throw {@link HookHalt} with a numbered-option surface.
 * - `warn`        → throw {@link HookError} so the runner logs the reason.
 * - `ask_timeout` → non-interactive context; apply `on_block_fallback` and
 *                   re-resolve to `stop` or `warn`.
 * - `ask`         → interactive context; collapses to `stop` with the prompt
 *                   surface for the CLI integration.
 *
 * Default-off: when `settings.decision_engine` is `null` or every gate is
 * `off` the hook short-circuits without examining state.
 */
import {
    DecisionEngineSettings,
    GateDecision,
    evaluate_gates,
} from '../../scoring/decision_engine.js';
import {
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
} from '../../scoring/decision_trace.js';
import { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError, HookHalt } from '../exceptions.js';
import { HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

const _BLOCK_REASON_PREFIX = 'decision_gate';

/**
 * Evaluate decision-engine gates on every `AFTER_STEP`.
 *
 * The hook stores `settings` as a frozen reference; tests pass a fresh
 * instance per scenario.
 */
export class DecisionGateHook {
    private readonly _settings: DecisionEngineSettings;

    constructor(settings: DecisionEngineSettings) {
        this._settings = settings;
    }

    /** Register the gate callback on `AFTER_STEP`. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.AFTER_STEP, (ctx) => this._evaluate(ctx));
    }

    // -- lifecycle callback ------------------------------------------

    private _evaluate(ctx: HookContext): void {
        if (!this._settings.any_gate_active) {
            return;
        }
        const phase = ctx.step_name;
        if (!phase) {
            return;
        }
        const delivery = ctx.delivery;
        const memory = summarise_memory(_getattr(delivery, 'memory', null));
        const verify = summarise_verify(_getattr(delivery, 'verify', null));
        const ambiguity = _pyTruthy(_getattr(delivery, 'questions', null));
        const decision = evaluate_gates(this._settings, {
            phase,
            confidence_band: derive_confidence_band({
                memory_hits: memory['hits'] as number,
                verify_claims: verify['claims'] as number,
                verify_first_try_passes: verify['first_try_passes'] as number,
                ambiguity_flag: ambiguity,
            }),
            risk_class: derive_risk_class(_getattr(delivery, 'changes', null)),
            memory_hits: memory['hits'] as number,
        });
        if (decision === null) {
            return;
        }
        this._apply(decision);
    }

    // -- action dispatch ----------------------------------------------

    private _apply(decision: GateDecision): void {
        const action = decision.action;
        if (action === 'warn') {
            throw new HookError(DecisionGateHook._format_reason(decision));
        }
        if (action === 'ask_timeout') {
            const fallback = this._settings.on_block_fallback;
            if (fallback === 'warn') {
                throw new HookError(
                    DecisionGateHook._format_reason(decision, 'ask_timeout'),
                );
            }
            throw new HookHalt(
                `${_BLOCK_REASON_PREFIX}:${decision.gate_id}:ask_timeout`,
                DecisionGateHook._surface(decision, 'ask_timeout'),
            );
        }
        throw new HookHalt(
            `${_BLOCK_REASON_PREFIX}:${decision.gate_id}`,
            DecisionGateHook._surface(decision),
        );
    }

    // -- formatting helpers -------------------------------------------

    private static _format_reason(decision: GateDecision, suffix = ''): string {
        let tag = `${_BLOCK_REASON_PREFIX}:${decision.gate_id}`;
        if (suffix) {
            tag = `${tag}:${suffix}`;
        }
        return `${tag} — ${decision.reason}`;
    }

    private static _surface(decision: GateDecision, suffix = ''): string[] {
        let header = `Decision-engine gate fired: ${decision.gate_id} (phase=${decision.phase})`;
        if (suffix) {
            header = `${header} [${suffix}]`;
        }
        return [
            header,
            `Reason: ${decision.reason}`,
            '1) Address the gate condition and resume.',
            '2) Lower the gate in `.agent-settings.yml` ' + '(`decision_engine` block) and resume.',
            '3) Abort the run.',
        ];
    }
}

/**
 * Construct the hook from a {@link DecisionEngineSettings}-like object.
 * Returns `null` when the config is absent or every gate is `off`; the
 * bootstrap layer then skips registration entirely.
 */
export function build_decision_gate_hook(settings: Any): DecisionGateHook | null {
    if (settings === null || settings === undefined) {
        return null;
    }
    if (!(settings instanceof DecisionEngineSettings)) {
        return null;
    }
    if (!settings.any_gate_active) {
        return null;
    }
    return new DecisionGateHook(settings);
}

/** Python `getattr(obj, name, default)`. */
function _getattr(obj: Any, name: string, dflt: Any): Any {
    if (obj !== null && typeof obj === 'object' && name in (obj as object)) {
        return (obj as Record<string, Any>)[name];
    }
    return dflt;
}

/** Python `bool(x)` truthiness for the shapes `questions` can take. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value instanceof Map || value instanceof Set) {
        return value.size > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}
