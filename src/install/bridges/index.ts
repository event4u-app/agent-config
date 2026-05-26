/**
 * Bridge registry — Phase A6 entrypoint.
 *
 * Maps stable tool IDs to pure builder functions. Callers pass a
 * {@link BridgeContext} plus a list of enabled tool IDs and receive a
 * flat list of {@link BridgeOutput}s ready for the apply layer.
 *
 * Order of `generateProjectBridges` output is **stable** — it follows
 * the registration order below, which mirrors the Python install order
 * (`scripts/install.py:_deploy_tool_content` dispatch table). Snapshot
 * tests rely on this ordering.
 *
 * To add a tool:
 *   1. Implement a `buildXxxBridge: BridgeBuilder` in `bridges/xxx.ts`.
 *   2. Register it under its stable tool ID in {@link BRIDGE_REGISTRY}.
 *   3. Add a snapshot fixture under `tests/install/bridges/__snapshots__/`.
 */

import { buildAugmentBridge } from './augment.js';
import { buildClaudeBridge } from './claude.js';
import { buildClineBridge } from './cline.js';
import { buildCopilotBridge } from './copilot.js';
import { buildCursorBridge } from './cursor.js';
import { buildGeminiBridge } from './gemini.js';
import {
    buildAiderBridge,
    buildClaudeDesktopBridge,
    buildCodexBridge,
    buildContinueBridge,
    buildJetbrainsBridge,
    buildKilocodeBridge,
    buildKiroBridge,
    buildRoocodeBridge,
    buildZedBridge,
} from './markers.js';
import type { BridgeBuilder, BridgeContext, BridgeOutput } from './types.js';
import { buildVscodeBridge } from './vscode.js';
import { buildWindsurfBridge } from './windsurf.js';

/**
 * Stable tool ID → builder map. Order matches Python install dispatch.
 *
 * Using a tuple list (not a plain object) keeps iteration order
 * deterministic across runtimes and survives accidental key reordering
 * by tooling.
 */
export const BRIDGE_REGISTRY: ReadonlyArray<readonly [string, BridgeBuilder]> = [
    // Substrate / plugin enablement.
    ['vscode',         buildVscodeBridge],
    ['augment',        buildAugmentBridge],
    // Hook dispatchers (JSON).
    ['claude',         buildClaudeBridge],
    ['cursor',         buildCursorBridge],
    ['windsurf',       buildWindsurfBridge],
    ['gemini',         buildGeminiBridge],
    // Multi-script.
    ['cline',          buildClineBridge],
    // Plugin registration.
    ['copilot',        buildCopilotBridge],
    // Informational markers.
    ['roocode',        buildRoocodeBridge],
    ['claude-desktop', buildClaudeDesktopBridge],
    ['aider',          buildAiderBridge],
    ['codex',          buildCodexBridge],
    ['continue',       buildContinueBridge],
    ['kilocode',       buildKilocodeBridge],
    ['zed',            buildZedBridge],
    ['jetbrains',      buildJetbrainsBridge],
    ['kiro',           buildKiroBridge],
];

/** Set of every registered tool ID (cached for fast membership tests). */
export const KNOWN_TOOL_IDS: ReadonlySet<string> = new Set(
    BRIDGE_REGISTRY.map(([id]) => id),
);

/**
 * Generate the full list of bridge outputs for a project.
 *
 * @param ctx        Project root + package type.
 * @param enabledIds Tool IDs to include. Unknown IDs are silently
 *                   ignored — the detect/plan layer is the gatekeeper
 *                   for enable/disable decisions, not the registry.
 * @returns          Flat list of outputs in registry order. Cline (and
 *                   any future multi-output builder) contributes
 *                   multiple entries; all others contribute one.
 */
export function generateProjectBridges(
    ctx: BridgeContext,
    enabledIds: ReadonlyArray<string> | ReadonlySet<string>,
): BridgeOutput[] {
    const enabled = enabledIds instanceof Set ? enabledIds : new Set(enabledIds);
    const out: BridgeOutput[] = [];
    for (const [toolId, builder] of BRIDGE_REGISTRY) {
        if (!enabled.has(toolId)) continue;
        const result = builder(ctx);
        if (Array.isArray(result)) {
            out.push(...result);
        } else {
            out.push(result as BridgeOutput);
        }
    }
    return out;
}

export type { BridgeBuilder, BridgeContext, BridgeOutput } from './types.js';
export {
    type AcEvent,
    dispatchCommand,
    type JsonBridgeOutput,
    type MarkerBridgeOutput,
    type ScriptBridgeOutput,
} from './types.js';
