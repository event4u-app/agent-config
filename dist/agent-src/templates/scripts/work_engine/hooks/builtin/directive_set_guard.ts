/**
 * `DirectiveSetGuardHook` — catch CLI / state directive-set drift.
 *
 * TypeScript twin of `work_engine/hooks/builtin/directive_set_guard.py`
 * (ADR-200 py2ts — work_engine.hooks.builtin subpackage). Fires on
 * `HookEvent.BEFORE_DISPATCH`. Compares the resolved `set_name` against the
 * `directive_set` field on the persisted `WorkState`. Mismatch →
 * {@link HookError} (non-fatal: the runner warns), so a flow that silently
 * re-dispatches under a different set surfaces the drift before any step runs.
 *
 * The guard is read-only. It does not rewrite `state.directive_set`.
 */
import { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import { HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

/** Asserts `set_name` matches `state.directive_set` on dispatch. */
export class DirectiveSetGuardHook {
    /** Register on `HookEvent.BEFORE_DISPATCH`. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.BEFORE_DISPATCH, (ctx) => this._guard(ctx));
    }

    private _guard(ctx: HookContext): void {
        const set_name = ctx.set_name;
        const work = ctx.work;
        if (set_name === null || set_name === undefined || work === null || work === undefined) {
            // `before_dispatch` always carries both refs per the context
            // surface; missing means a hook-bug, not drift.
            throw new HookError(
                'directive-set guard: missing set_name or work on ' +
                    `before_dispatch (set_name=${_pyRepr(set_name)}, work=${_pyRepr(work)})`,
            );
        }

        const persisted = _getattr(work, 'directive_set', null);
        if (persisted === null || persisted === undefined) {
            // Legacy v0 envelopes have no `directive_set` field; the guard is
            // a no-op for those — nothing to compare.
            return;
        }

        if (persisted !== set_name) {
            throw new HookError(
                'directive-set drift: CLI resolved ' +
                    `${_pyRepr(set_name)} but state carries ${_pyRepr(persisted)}`,
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

/**
 * Python `repr(x)` for the scalar shapes the guard formats. `None` →
 * `None`; `str` → single-quoted (switching to double quotes only when the
 * string contains a single quote but no double quote, matching CPython).
 */
function _pyRepr(value: Any): string {
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
        return _reprStr(value);
    }
    return String(value);
}

function _reprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const useDouble = hasSingle && !hasDouble;
    const quote = useDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
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
