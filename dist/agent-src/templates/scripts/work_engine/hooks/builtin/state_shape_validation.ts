/**
 * `StateShapeValidationHook` — round-trip the v1 envelope on load and save.
 *
 * TypeScript twin of `work_engine/hooks/builtin/state_shape_validation.py`
 * (ADR-200 py2ts — work_engine.hooks.builtin subpackage). Fires on
 * `AFTER_LOAD` and `BEFORE_SAVE`. For each event, serialises the live
 * `WorkState` through `state.to_dict` and re-validates via `state.from_dict`.
 * A `SchemaError` from either side is reported as a {@link HookError} so the
 * runner warns and continues — observability, not a gate.
 */
import { SchemaError, type WorkState, from_dict, to_dict } from '../../state.js';
import { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import { HookRegistry } from '../registry.js';

/** Round-trips the loaded `WorkState` against the v1 schema. */
export class StateShapeValidationHook {
    /** Register on AFTER_LOAD and BEFORE_SAVE. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.AFTER_LOAD, (ctx) => this._validate(ctx));
        registry.register(HookEvent.BEFORE_SAVE, (ctx) => this._validate(ctx));
    }

    private _validate(ctx: HookContext): void {
        const work = ctx.work;
        if (work === null || work === undefined) {
            // Should not happen on AFTER_LOAD/BEFORE_SAVE; treat as a
            // hook-side bug rather than swallow silently.
            throw new HookError(
                'state-shape validation: HookContext.work is None at ' +
                    `event for state_file=${ctx.state_file === null ? 'None' : ctx.state_file}`,
            );
        }

        try {
            from_dict(to_dict(work as WorkState));
        } catch (exc) {
            if (exc instanceof SchemaError) {
                throw new HookError(`state-shape validation failed: ${exc.message}`);
            }
            throw exc;
        }
    }
}
