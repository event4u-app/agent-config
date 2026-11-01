/**
 * MCP tool-behavior hints. Absent hints fall back to the spec's pessimistic
 * defaults, so every implemented tool carries all four, derived here.
 */
import type { ToolSideEffect } from './tools.js';

/**
 * What a non-`ro` tool does to the state it touches. Required for every
 * implemented `fs-write` / `shell` tool, because the MCP defaults for an absent
 * hint are the pessimistic ones (`destructiveHint: true`, `openWorldHint: true`):
 * leaving it out would advertise an append-only tool as destructive.
 * `additive` adds without removing or rewriting; `idempotent` rewrites to the
 * same result on every call; `destructive` moves, rewrites or removes existing
 * state.
 */
export type ToolEffectShape = 'additive' | 'idempotent' | 'destructive';

/** The four MCP tool-behavior hints, always all present on an implemented tool. */
export interface ToolAnnotations {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
}

/** The fields of a registered tool the hints are derived from. */
export interface AnnotatedTool {
    readonly name: string;
    readonly side_effect: ToolSideEffect;
    readonly effect_shape?: ToolEffectShape;
    readonly open_world?: boolean;
    readonly effect_reason?: string;
}

/**
 * Derive all four MCP hints for an implemented tool. Throws when a non-`ro`
 * tool declares no `effect_shape`, when an `ro` tool declares one, or when a
 * declared shape or open world carries no reason — so the catalog generator and
 * `tools/list` cannot emit a tool whose hints fall back to the spec defaults.
 */
export function tool_annotations(tool: AnnotatedTool): ToolAnnotations {
    const openWorld = tool.open_world === true;
    const reasoned = typeof tool.effect_reason === 'string' && tool.effect_reason.trim() !== '';
    if ((tool.effect_shape !== undefined || openWorld) && !reasoned) {
        throw new Error(`tool '${tool.name}' sets effect_shape/open_world without an effect_reason`);
    }
    if (tool.side_effect === 'ro') {
        if (tool.effect_shape !== undefined) {
            throw new Error(`tool '${tool.name}' is side_effect 'ro' but declares effect_shape '${tool.effect_shape}'`);
        }
        return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: openWorld };
    }
    if (tool.effect_shape === undefined) {
        throw new Error(`tool '${tool.name}' is side_effect '${tool.side_effect}' but declares no effect_shape`);
    }
    return {
        readOnlyHint: false,
        destructiveHint: tool.effect_shape === 'destructive',
        idempotentHint: tool.effect_shape === 'idempotent',
        openWorldHint: openWorld,
    };
}
