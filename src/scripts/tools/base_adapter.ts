/**
 * Base Tool Adapter — abstract contract for tool integrations.
 *
 * All tool adapters must:
 * 1. Extend BaseToolAdapter
 * 2. Define supported_actions
 * 3. Implement execute_action
 * 4. Implement check_auth
 *
 * No real API calls are made by the base — adapters return structured results.
 *
 * TypeScript twin of `src/scripts/tools/base_adapter.py` (ADR-096 — Python→TS
 * migration, Phase 1 / tools adapter cluster). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom):
 * the `ToolAction` / `ToolResult` value shapes, `ToolResult.to_dict()` with
 * Python-truthiness key omission (empty `data` / `error` dropped), and the
 * `validate_action` / `safe_execute` flow on the abstract base. No behaviour
 * changes.
 */

/** Arbitrary JSON-ish param / data map (mirrors `Dict[str, Any]`). */
export type ParamDict = Record<string, unknown>;

/** Plain-object shape returned by `ToolResult.to_dict()`. */
export type ToolResultDict = {
    tool: string;
    action: string;
    success: boolean;
    data?: ParamDict;
    error?: string;
};

/**
 * Python truthiness for the values `to_dict` gates on (dict / str).
 * `null`/`undefined`, `false`, `0`, empty string, empty array, and empty
 * object are falsy; everything else truthy — exactly like Python `if value`.
 */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** Structured representation of a tool action request (mirrors `ToolAction`). */
export class ToolAction {
    tool_name: string;
    action: string;
    params: ParamDict;

    constructor(args: { tool_name: string; action: string; params: ParamDict }) {
        this.tool_name = args.tool_name;
        this.action = args.action;
        this.params = args.params;
    }
}

/** Structured result from a tool action (mirrors the `ToolResult` dataclass). */
export class ToolResult {
    tool_name: string;
    action: string;
    success: boolean;
    data: ParamDict | null;
    error: string | null;

    constructor(args: {
        tool_name: string;
        action: string;
        success: boolean;
        data?: ParamDict | null;
        error?: string | null;
    }) {
        this.tool_name = args.tool_name;
        this.action = args.action;
        this.success = args.success;
        this.data = args.data ?? null;
        this.error = args.error ?? null;
    }

    to_dict(): ToolResultDict {
        const result: ToolResultDict = {
            tool: this.tool_name,
            action: this.action,
            success: this.success,
        };
        if (_pyTruthy(this.data)) {
            result.data = this.data as ParamDict;
        }
        if (_pyTruthy(this.error)) {
            result.error = this.error as string;
        }
        return result;
    }
}

/**
 * Python `sorted(set[str])` — ascending codepoint order, like the .py default.
 */
function _sorted(values: Iterable<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Abstract base for tool adapters (mirrors the `BaseToolAdapter` ABC). */
export abstract class BaseToolAdapter {
    /** Tool name (must match registry entry). */
    abstract get name(): string;

    /** Set of supported action names. */
    abstract get supported_actions(): ReadonlySet<string>;

    /** Check if authentication is available. Does NOT make API calls. */
    abstract check_auth(): boolean;

    /** Execute a tool action. Returns structured result. */
    abstract execute_action(action: ToolAction): ToolResult;

    /** Validate an action before execution. Returns error message or null. */
    validate_action(action: ToolAction): string | null {
        if (action.tool_name !== this.name) {
            return `Action tool '${action.tool_name}' does not match adapter '${this.name}'`;
        }
        if (!this.supported_actions.has(action.action)) {
            return (
                `Action '${action.action}' not supported by '${this.name}'; ` +
                `valid: ${_sorted(this.supported_actions).join(', ')}`
            );
        }
        return null;
    }

    /** Validate and execute an action safely. */
    safe_execute(action: ToolAction): ToolResult {
        const error = this.validate_action(action);
        if (error) {
            return new ToolResult({
                tool_name: this.name,
                action: action.action,
                success: false,
                error,
            });
        }
        return this.execute_action(action);
    }
}
