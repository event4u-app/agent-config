/**
 * Cursor bridge — `.cursor/hooks.json` project-scope hooks.
 *
 * Native event names per https://cursor.com/docs/reference/third-party-hooks
 * (camelCase). UserPromptSubmit lives at `beforeSubmitPrompt`. Project
 * hooks fire with the project as cwd, so no trampoline is needed at
 * this scope.
 *
 * Mirror of `scripts/install.py:ensure_cursor_bridge` (lines 1098–1118).
 */

import { join } from 'node:path';

import type { JsonObject } from '../conflict.js';
import {
    type AcEvent,
    type BridgeBuilder,
    dispatchCommand,
    type JsonBridgeOutput,
} from './types.js';

export const CURSOR_BINDINGS: ReadonlyArray<readonly [AcEvent, string]> = [
    ['session_start',      'sessionStart'],
    ['session_end',        'sessionEnd'],
    ['stop',               'stop'],
    ['user_prompt_submit', 'beforeSubmitPrompt'],
    ['post_tool_use',      'postToolUse'],
];

/** Builder for the Cursor project-scope bridge. */
export const buildCursorBridge: BridgeBuilder = (ctx): JsonBridgeOutput => {
    const hooks: Record<string, JsonObject[]> = {};
    for (const [acEvent, native] of CURSOR_BINDINGS) {
        (hooks[native] ??= []).push({ command: dispatchCommand('cursor', acEvent, native) });
    }
    return {
        kind: 'json',
        toolId: 'cursor',
        target: join(ctx.projectRoot, '.cursor', 'hooks.json'),
        payload: { version: 1, hooks },
        label: '.cursor/hooks.json',
    };
};
