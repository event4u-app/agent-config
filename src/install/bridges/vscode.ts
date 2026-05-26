/**
 * VSCode bridge — `.vscode/settings.json` plugin location wiring.
 *
 * Substrate bridge — declares the chat plugin location based on the
 * detected package type. NPM consumers resolve through node_modules;
 * other ecosystems use the bundled `./plugin/agent-config` directory.
 *
 * Mirror of `scripts/install.py:ensure_vscode_bridge` (lines 876–885).
 */

import { join } from 'node:path';

import type { BridgeBuilder, JsonBridgeOutput } from './types.js';

const PLUGIN_PATHS: Readonly<Record<string, string>> = {
    npm: './node_modules/@event4u/agent-config/plugin/agent-config',
};

const DEFAULT_PLUGIN_PATH = './plugin/agent-config';

/** Builder for the VSCode project-scope bridge. */
export const buildVscodeBridge: BridgeBuilder = (ctx): JsonBridgeOutput => {
    const pluginPath = PLUGIN_PATHS[ctx.packageType] ?? DEFAULT_PLUGIN_PATH;
    return {
        kind: 'json',
        toolId: 'vscode',
        target: join(ctx.projectRoot, '.vscode', 'settings.json'),
        payload: { 'chat.pluginLocations': { [pluginPath]: true } },
        label: '.vscode/settings.json',
    };
};
