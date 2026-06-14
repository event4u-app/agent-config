/**
 * `MemoryVisibilityHook` — emit the visibility line on save.
 *
 * TypeScript twin of `work_engine/hooks/builtin/memory_visibility.py`
 * (ADR-094 py2ts — work_engine.hooks.builtin subpackage). Implements the
 * producer side of `docs/contracts/memory-visibility-v1.md`: derive
 * `asks/hits/ids` from `state.memory` and thread the rendered line into
 * `state.report`.
 *
 * Fires on `before_save`. Default-off; opt-in via `.agent-settings.yml`. The
 * hook is purely observational: failures surface as {@link HookError}
 * (non-fatal per the three-tier contract).
 */
import { summarise_memory, summarise_verify } from '../../scoring/decision_trace.js';
import {
    DEFAULT_ASKED_TYPES,
    compute_affected,
    format_changed_decisions_block,
    format_line,
    should_emit,
    summarise_visibility,
} from '../../scoring/memory_visibility.js';
import { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import { HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

/**
 * Thread the `🧠 Memory: <hits>/<asks> · ids=[…]` line into the report.
 *
 * `memory_cadence` is the `memory.cadence` cadence key. `visibility_off`
 * mirrors `memory.visibility: off`. `asked_types` overrides the list of
 * memory types treated as `asks` in the visibility line.
 */
export class MemoryVisibilityHook {
    private readonly _memory_cadence: string;
    private readonly _visibility_off: boolean;
    private readonly _asked_types: readonly string[];

    constructor(
        options: {
            memory_cadence?: string;
            visibility_off?: boolean;
            asked_types?: Iterable<string> | null;
        } = {},
    ) {
        this._memory_cadence = options.memory_cadence ?? 'always';
        this._visibility_off = options.visibility_off ?? false;
        this._asked_types =
            options.asked_types !== undefined && options.asked_types !== null
                ? [...options.asked_types]
                : DEFAULT_ASKED_TYPES;
    }

    /** Register the visibility-line emitter on `before_save`. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.BEFORE_SAVE, (ctx) => this._on_before_save(ctx));
    }

    private _on_before_save(ctx: HookContext): void {
        const work = ctx.work;
        if (work === null || work === undefined) {
            return;
        }
        const memory = _getattr(work, 'memory', null);
        const summary = summarise_visibility(memory, { asked_types: this._asked_types });
        if (
            !should_emit(summary, {
                memory_cadence: this._memory_cadence,
                visibility_off: this._visibility_off,
            })
        ) {
            return;
        }
        const affected = this._derive_affected(work, memory);
        const line = format_line(summary, { affected });
        if (!line) {
            return;
        }
        const block = format_changed_decisions_block(
            (summary['ids'] as string[]) || [],
            affected,
        );
        const existing = (_getattr(work, 'report', '') as string) || '';
        const rendered = block === null ? line : `${line}\n\n${block}`;
        if (existing.includes(line) && (block === null || existing.includes(block))) {
            return;
        }
        const sep = existing ? '\n\n' : '';
        try {
            (work as Record<string, Any>)['report'] = `${existing}${sep}${rendered}`;
        } catch (exc) {
            throw new HookError('memory-visibility: state.report not writable');
        }
    }

    /**
     * Compute the closed-list `affected` keys for this work step. Returns
     * `null` when memory was not consulted (hits == 0).
     */
    private _derive_affected(work: Any, memory: Any): string[] | null {
        const memory_summary = summarise_memory(memory);
        const verify_summary = summarise_verify(_getattr(work, 'verify', null));
        const ambiguity = _pyTruthy(_getattr(work, 'questions', null));
        return compute_affected({
            memory_hits: memory_summary['hits'] as number,
            verify_claims: verify_summary['claims'] as number,
            verify_first_try_passes: verify_summary['first_try_passes'] as number,
            ambiguity_flag: ambiguity,
            changes: _getattr(work, 'changes', null),
            applied_rules: _getattr(work, 'applied_rules', null) as string[] | null,
            test_plan: _getattr(work, 'test_plan', null) as string[] | null,
        });
    }
}

/**
 * Convenience helper: render the line directly from a memory list. Used by
 * external callers that have a `memory` list but no {@link HookContext}.
 * Returns `null` when `asks == 0`.
 */
export function derive_visibility(memory: Any): string | null {
    return format_line(summarise_visibility(memory));
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
