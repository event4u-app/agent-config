/**
 * Marker bridges — informational `.md` files for AI tools without a
 * programmatic hook surface (or with one we deliberately do not touch).
 *
 * Each builder drops a single UTF-8 marker pointing developers at the
 * canonical rule source under `.augment/`. Markers are static — no
 * dispatcher wiring, no JSON merge. Content lives next to the builder
 * so snapshot tests pin both shape and copy verbatim.
 *
 * Mirrors `scripts/install.py:ensure_{roocode,claude_desktop,aider,
 * codex,continue,kilocode,zed,jetbrains,kiro}_bridge` (lines 1555–1913).
 */

import { join } from 'node:path';

import type { BridgeBuilder, MarkerBridgeOutput } from './types.js';
import {
    AIDER_MARKER,
    CLAUDE_DESKTOP_MARKER,
    CODEX_MARKER,
    CONTINUE_MARKER,
    JETBRAINS_MARKER,
    KILOCODE_MARKER,
    KIRO_MARKER,
    ROOCODE_MARKER,
    ZED_MARKER,
} from './marker-content.js';

function marker(
    toolId: string,
    relPath: ReadonlyArray<string>,
    content: string,
): BridgeBuilder {
    return (ctx): MarkerBridgeOutput => ({
        kind: 'marker',
        toolId,
        target: join(ctx.projectRoot, ...relPath),
        content,
        label: relPath.join('/'),
    });
}

/** `.roo/rules/agent-config.md` — Roo Code marker. */
export const buildRoocodeBridge = marker(
    'roocode',
    ['.roo', 'rules', 'agent-config.md'],
    ROOCODE_MARKER,
);

/** `.claude-desktop/agent-config.md` — Claude Desktop informational marker. */
export const buildClaudeDesktopBridge = marker(
    'claude-desktop',
    ['.claude-desktop', 'agent-config.md'],
    CLAUDE_DESKTOP_MARKER,
);

/** `.aider/agent-config.md` — Aider marker (no `.aider.conf.yml` mutation). */
export const buildAiderBridge = marker(
    'aider',
    ['.aider', 'agent-config.md'],
    AIDER_MARKER,
);

/** `.codex/agent-config.md` — OpenAI Codex CLI marker (AGENTS.md is canonical). */
export const buildCodexBridge = marker(
    'codex',
    ['.codex', 'agent-config.md'],
    CODEX_MARKER,
);

/** `.continue/rules/agent-config.md` — Continue.dev marker. */
export const buildContinueBridge = marker(
    'continue',
    ['.continue', 'rules', 'agent-config.md'],
    CONTINUE_MARKER,
);

/** `.kilocode/rules/agent-config.md` — Kilo Code marker. */
export const buildKilocodeBridge = marker(
    'kilocode',
    ['.kilocode', 'rules', 'agent-config.md'],
    KILOCODE_MARKER,
);

/** `.zed/agent-config.md` — Zed informational marker. */
export const buildZedBridge = marker(
    'zed',
    ['.zed', 'agent-config.md'],
    ZED_MARKER,
);

/** `.jetbrains/agent-config.md` — JetBrains AI informational marker. */
export const buildJetbrainsBridge = marker(
    'jetbrains',
    ['.jetbrains', 'agent-config.md'],
    JETBRAINS_MARKER,
);

/** `.kiro/steering/agent-config.md` — Kiro marker. */
export const buildKiroBridge = marker(
    'kiro',
    ['.kiro', 'steering', 'agent-config.md'],
    KIRO_MARKER,
);
