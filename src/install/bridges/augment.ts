/**
 * Augment bridge — `.augment/settings.json` plugin enablement.
 *
 * Augment lifecycle hooks live at user scope (~/.augment/settings.json,
 * see https://docs.augmentcode.com/cli/hooks). Project-scope settings
 * carry plugin enablement only — the bridge writes a minimal JSON
 * payload deep-merged with any existing user content.
 *
 * Mirror of `scripts/install.py:ensure_augment_bridge` (lines 888–892).
 */

import { join } from 'node:path';

import type { BridgeBuilder, JsonBridgeOutput } from './types.js';

/** Builder for the Augment project-scope bridge. */
export const buildAugmentBridge: BridgeBuilder = (ctx): JsonBridgeOutput => ({
    kind: 'json',
    toolId: 'augment',
    target: join(ctx.projectRoot, '.augment', 'settings.json'),
    payload: { enabledPlugins: { 'agent-config@event4u': true } },
    label: '.augment/settings.json',
});
