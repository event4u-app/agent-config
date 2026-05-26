/**
 * Windsurf bridge — `.windsurf/hooks.json` project-scope hooks.
 *
 * Cascade fires project hooks with the workspace as cwd, so no
 * trampoline is needed. `show_output: false` keeps post hooks silent
 * (per Windsurf docs); concerns stream their own output via
 * `agents/runtime/state/.dispatcher/`.
 *
 * Mirror of `scripts/install.py:ensure_windsurf_bridge` (lines 1331–1356).
 */

import { join } from 'node:path';

import type { JsonObject } from '../conflict.js';
import {
    type AcEvent,
    type BridgeBuilder,
    dispatchCommand,
    type JsonBridgeOutput,
} from './types.js';

export const WINDSURF_BINDINGS: ReadonlyArray<readonly [AcEvent, string]> = [
    ['session_start',      'post_setup_worktree'],
    ['user_prompt_submit', 'pre_user_prompt'],
    ['stop',               'post_cascade_response'],
];

/** Builder for the Windsurf project-scope bridge. */
export const buildWindsurfBridge: BridgeBuilder = (ctx): JsonBridgeOutput => {
    const hooks: Record<string, JsonObject[]> = {};
    for (const [acEvent, native] of WINDSURF_BINDINGS) {
        (hooks[native] ??= []).push({
            command: dispatchCommand('windsurf', acEvent, native),
            show_output: false,
        });
    }
    return {
        kind: 'json',
        toolId: 'windsurf',
        target: join(ctx.projectRoot, '.windsurf', 'hooks.json'),
        payload: { hooks },
        label: '.windsurf/hooks.json',
    };
};
