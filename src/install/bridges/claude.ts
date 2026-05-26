/**
 * Claude Code bridge — `.claude/settings.json` plugin + hooks.
 *
 * Each Claude Code lifecycle event is wired to a single
 * `./agent-config dispatch:hook` invocation. The dispatcher reads
 * `scripts/hook_manifest.yaml` at runtime and runs the resolved concern
 * chain. Idempotent: deep-merge replaces hook arrays rather than
 * appending duplicates on rerun.
 *
 * Mirror of `scripts/install.py:ensure_claude_bridge` (lines 1042–1066).
 */

import { join } from 'node:path';

import type { JsonObject } from '../conflict.js';
import {
    type AcEvent,
    type BridgeBuilder,
    dispatchCommand,
    type JsonBridgeOutput,
} from './types.js';

/** Native event names per https://docs.claude.com/en/docs/claude-code/hooks. */
export const CLAUDE_BINDINGS: ReadonlyArray<readonly [AcEvent, string]> = [
    ['session_start',      'SessionStart'],
    ['session_end',        'SessionEnd'],
    ['stop',               'Stop'],
    ['user_prompt_submit', 'UserPromptSubmit'],
    ['post_tool_use',      'PostToolUse'],
];

function dispatchBlock(acEvent: AcEvent, native: string): JsonObject {
    return {
        hooks: [{ type: 'command', command: dispatchCommand('claude', acEvent, native) }],
    };
}

/** Builder for the Claude Code project-scope bridge. */
export const buildClaudeBridge: BridgeBuilder = (ctx): JsonBridgeOutput => {
    const perEvent: Record<string, JsonObject[]> = {};
    for (const [acEvent, native] of CLAUDE_BINDINGS) {
        (perEvent[native] ??= []).push(dispatchBlock(acEvent, native));
    }
    return {
        kind: 'json',
        toolId: 'claude',
        target: join(ctx.projectRoot, '.claude', 'settings.json'),
        payload: {
            enabledPlugins: { 'agent-conf@event4u': true },
            hooks: perEvent,
        },
        label: '.claude/settings.json',
    };
};
