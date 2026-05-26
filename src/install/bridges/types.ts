/**
 * Bridge builder contract — Phase A6.
 *
 * Each AI tool (Claude Code, Cursor, Cline, Windsurf, Copilot, …) gets
 * one builder function that takes a {@link BridgeContext} and returns a
 * {@link BridgeOutput}. Output is **declarative** — the apply layer
 * decides between byte-merge (`mergeJsonContent`) and overwrite based
 * on the {@link BridgeOutput.kind} discriminator.
 *
 * Pure functions:
 *   - No filesystem reads inside builders.
 *   - No string interpolation against env-vars or `Date.now()` — the
 *     snapshot tests rely on deterministic output.
 *   - Path resolution uses `bridges/paths.ts` helpers, not `path.join`
 *     scattered across bridges.
 *
 * Mirrors `scripts/install.py:749-1913` (the `# --- Bridge generators ---`
 * block). Side effects from the Python `merge_json_file` / `write_file`
 * calls move into the apply layer (Phase A4 + A5).
 */

import type { JsonObject } from '../conflict.js';

/** Inputs every bridge builder accepts. */
export interface BridgeContext {
    /** Absolute project root (where `.augment/`, `.claude/`, etc. land). */
    readonly projectRoot: string;
    /** Package type — `npm` / `composer` / `cargo` / etc. — for VSCode plugin paths. */
    readonly packageType: string;
}

/** JSON bridge — payload deep-merged into the target. */
export interface JsonBridgeOutput {
    readonly kind: 'json';
    /** Stable identifier — e.g. `claude`, `cursor`. Used as the file key in registry tests. */
    readonly toolId: string;
    /** Absolute target path. */
    readonly target: string;
    /** Payload to deep-merge with the existing target (or write fresh if absent). */
    readonly payload: JsonObject;
    /** Human-readable label for log lines / surfaces. */
    readonly label: string;
}

/** Marker bridge — plain-text file written verbatim, no merge. */
export interface MarkerBridgeOutput {
    readonly kind: 'marker';
    readonly toolId: string;
    readonly target: string;
    /** UTF-8 text content. Trailing newline is the builder's responsibility. */
    readonly content: string;
    readonly label: string;
}

/**
 * Script bridge — executable shell file written verbatim with 0755 mode.
 *
 * Used by Cline's `.clinerules/hooks/<HookName>` per-event script
 * pattern (one file per native event). The apply layer chmods after
 * write; builders only carry the body.
 */
export interface ScriptBridgeOutput {
    readonly kind: 'script';
    readonly toolId: string;
    readonly target: string;
    /** UTF-8 shell-script body. Trailing newline is the builder's responsibility. */
    readonly content: string;
    /** Unix file mode (apply layer chmods). */
    readonly mode: number;
    readonly label: string;
}

/** Union of every supported bridge output. */
export type BridgeOutput = JsonBridgeOutput | MarkerBridgeOutput | ScriptBridgeOutput;

/**
 * A builder is a pure function from context → one or more outputs.
 *
 * Most bridges produce a single output; Cline produces one script per
 * native event. Returning an array keeps the registry signature uniform.
 */
export type BridgeBuilder = (ctx: BridgeContext) => BridgeOutput | readonly BridgeOutput[];

/**
 * Stable lifecycle-event vocabulary the dispatcher understands.
 *
 * Mirrors the `(ac_event, native)` tuples in `scripts/install.py:
 * AUGMENT_DISPATCHER_BINDINGS` & friends. Per-platform mappings live
 * in each bridge's own constant; this enum is purely the universe of
 * agent-config events.
 */
export type AcEvent =
    | 'session_start'
    | 'session_end'
    | 'stop'
    | 'user_prompt_submit'
    | 'post_tool_use';

/**
 * Shape of the `./agent-config dispatch:hook` invocation embedded in
 * every hook-dispatcher bridge.
 *
 * Single source of truth so the snapshot tests can assert the command
 * string contract without re-implementing the formatter per bridge.
 */
export function dispatchCommand(platform: string, acEvent: AcEvent, native: string): string {
    return `./agent-config dispatch:hook --platform ${platform} --event ${acEvent} --native-event ${native}`;
}
