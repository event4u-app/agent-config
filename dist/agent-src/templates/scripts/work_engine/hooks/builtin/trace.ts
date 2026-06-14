/**
 * `TraceHook` — emit one stderr line per hook event.
 *
 * TypeScript twin of `work_engine/hooks/builtin/trace.py` (ADR-096 py2ts —
 * work_engine.hooks.builtin subpackage). Registers on every `HookEvent`;
 * output goes to a configurable stream (default `process.stderr`) so tests can
 * capture it.
 *
 * Pure observability — never mutates context, never halts. A misbehaving sink
 * raises {@link HookError}, which the runner swallows with a warning.
 */
import { HOOK_EVENTS, HookEvent } from '../events.js';
import { HookContext } from '../context.js';
import { HookError } from '../exceptions.js';
import { HookCallback, HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

/**
 * Minimal write+flush sink, mirroring Python's `IO[str]`. `process.stderr`
 * satisfies it; tests pass a string-collector.
 */
export interface TextStream {
    write(s: string): unknown;
    flush?(): void;
}

/** Stderr-trace hook for every lifecycle event. */
export class TraceHook {
    private readonly _stream: TextStream;
    private readonly _prefix: string;

    constructor(stream: TextStream | null = null, prefix = '[hook]') {
        this._stream = stream !== null ? stream : process.stderr;
        this._prefix = prefix;
    }

    /** Register the trace callback for every `HookEvent`. */
    register(registry: HookRegistry): void {
        for (const event of HOOK_EVENTS) {
            registry.register(event, this._make_callback(event));
        }
    }

    private _make_callback(event: HookEvent): HookCallback {
        const _cb = (ctx: HookContext): void => {
            try {
                const line = this._format(event, ctx);
                this._stream.write(line + '\n');
                if (typeof this._stream.flush === 'function') {
                    this._stream.flush();
                }
            } catch (exc) {
                if (exc instanceof HookError) {
                    throw exc;
                }
                // Mirror Python `except (OSError, ValueError)`: wrap stream
                // failures as a non-fatal HookError; re-raise anything else.
                throw new HookError(`trace stream unavailable: ${_errStr(exc)}`);
            }
        };
        return _cb;
    }

    /**
     * Build a one-line trace record.
     *
     * Format: `[hook] event=<name> step=<step> set=<set> outcome=<o>`.
     * Missing fields are skipped so the line stays short on events that only
     * carry a subset of the context.
     */
    private _format(event: HookEvent, ctx: HookContext): string {
        const parts: string[] = [this._prefix, `event=${event}`];
        if (ctx.step_name) {
            parts.push(`step=${ctx.step_name}`);
        }
        if (ctx.set_name) {
            parts.push(`set=${ctx.set_name}`);
        }
        if (ctx.result !== null && ctx.result !== undefined) {
            const outcome = _getattr(ctx.result, 'outcome', null);
            if (outcome !== null && outcome !== undefined) {
                parts.push(`outcome=${_valueOf(outcome)}`);
            }
        }
        if (ctx.final !== null && ctx.final !== undefined) {
            parts.push(`final=${_valueOf(ctx.final)}`);
        }
        if (ctx.halting) {
            parts.push(`halting=${ctx.halting}`);
        }
        if (ctx.exception !== null && ctx.exception !== undefined) {
            parts.push(`exception=${_typeName(ctx.exception)}`);
        }
        return parts.join(' ');
    }
}

/** Python `getattr(obj, name, default)`. */
function _getattr(obj: Any, name: string, dflt: Any): Any {
    if (obj !== null && typeof obj === 'object' && name in (obj as object)) {
        return (obj as Record<string, Any>)[name];
    }
    return dflt;
}

/** Python `getattr(x, "value", x)` — enum value if present, else the value. */
function _valueOf(x: Any): string {
    if (x !== null && typeof x === 'object' && 'value' in (x as object)) {
        return String((x as Record<string, Any>)['value']);
    }
    return String(x);
}

/** Python `type(exc).__name__`. */
function _typeName(exc: Any): string {
    if (exc instanceof Error) {
        return exc.constructor.name;
    }
    if (exc !== null && exc !== undefined && typeof exc === 'object') {
        return (exc as { constructor?: { name?: string } }).constructor?.name ?? 'object';
    }
    return typeof exc;
}

/** `str(exc)` for the wrapped-sink-failure message. */
function _errStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}
