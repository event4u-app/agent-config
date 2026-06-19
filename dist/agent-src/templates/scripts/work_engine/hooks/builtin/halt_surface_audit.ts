/**
 * `HaltSurfaceAuditHook` — defense-in-depth around halt surfaces.
 *
 * TypeScript twin of `work_engine/hooks/builtin/halt_surface_audit.py`
 * (ADR-200 py2ts — work_engine.hooks.builtin subpackage). Fires on `on_halt`
 * and re-asserts that every halt carries a non-empty user-facing surface,
 * mirroring the dispatcher's `_validate_step_result`.
 *
 * Pure observability: emits {@link HookError} (non-fatal) when the surface is
 * empty. The runner converts it to a warning so the violation is visible.
 */
import type { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import type { HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

/** Asserts that every halt carries a non-empty user-facing surface. */
export class HaltSurfaceAuditHook {
    /** Register on `HookEvent.ON_HALT` only. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.ON_HALT, (ctx) => this._audit(ctx));
    }

    private _audit(ctx: HookContext): void {
        const result = ctx.result;
        if (result === null || result === undefined) {
            // Hook-driven halts go through `_hook_halt_blocked` and may not
            // carry a `StepResult` — the surface lives on `state.questions`
            // instead. Audit that fallback too.
            const questions = _getattr(ctx.delivery, 'questions', null);
            if (!_pyTruthy(questions)) {
                throw new HookError(
                    `halt at step ${_pyRepr(ctx.step_name)} surfaced no questions ` +
                        '(hook-driven halt with empty state.questions)',
                );
            }
            return;
        }

        const questions = _getattr(result, 'questions', null);
        if (!_pyTruthy(questions)) {
            throw new HookError(
                `halt at step ${_pyRepr(ctx.step_name)} surfaced no questions ` +
                    '(StepResult.questions empty); the user has nothing to act on',
            );
        }
    }
}

/** Python `getattr(obj, name, default)`. */
function _getattr(obj: Any, name: string, dflt: Any): Any {
    if (obj !== null && typeof obj === 'object' && name in (obj as object)) {
        return (obj as Record<string, Any>)[name];
    }
    return dflt;
}

/** Python `bool(x)` truthiness for the `questions` shapes seen here. */
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

/** Python `repr(x)` for `step_name` (a string or `None`). */
function _pyRepr(value: Any): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'string') {
        const hasSingle = value.includes("'");
        const hasDouble = value.includes('"');
        const quote = hasSingle && !hasDouble ? '"' : "'";
        let out = quote;
        for (const ch of value) {
            const code = ch.codePointAt(0) as number;
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === quote) {
                out += `\\${quote}`;
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else if (code < 0x20 || code === 0x7f) {
                out += `\\x${code.toString(16).padStart(2, '0')}`;
            } else {
                out += ch;
            }
        }
        return out + quote;
    }
    return String(value);
}
