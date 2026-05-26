/**
 * Gemini CLI bridge — `.gemini/settings.json` project-scope hooks.
 *
 * Gemini's hook payload is a nested
 * `{event: [{matcher, hooks: [{type, command}]}]}` structure. Lifecycle
 * matchers are empty strings; tool events use a regex matcher
 * (`AfterTool` matches all tools with `.*`).
 *
 * Native event names per geminicli.com/docs/hooks/reference/ (PascalCase).
 *
 * Mirror of `scripts/install.py:ensure_gemini_bridge` (lines 1428–1479).
 */

import { join } from 'node:path';

import type { JsonObject } from '../conflict.js';
import {
    type AcEvent,
    type BridgeBuilder,
    dispatchCommand,
    type JsonBridgeOutput,
} from './types.js';

export const GEMINI_BINDINGS: ReadonlyArray<readonly [AcEvent, string, string]> = [
    ['session_start',      'SessionStart', ''],
    ['session_end',        'SessionEnd',   ''],
    ['stop',               'AfterAgent',   ''],
    ['user_prompt_submit', 'BeforeAgent',  ''],
    ['post_tool_use',      'AfterTool',    '.*'],
];

/** Builder for the Gemini CLI project-scope bridge. */
export const buildGeminiBridge: BridgeBuilder = (ctx): JsonBridgeOutput => {
    const hooks: Record<string, JsonObject[]> = {};
    for (const [acEvent, native, matcher] of GEMINI_BINDINGS) {
        (hooks[native] ??= []).push({
            matcher,
            hooks: [{ type: 'command', command: dispatchCommand('gemini', acEvent, native) }],
        });
    }
    return {
        kind: 'json',
        toolId: 'gemini',
        target: join(ctx.projectRoot, '.gemini', 'settings.json'),
        payload: { hooks },
        label: '.gemini/settings.json',
    };
};
