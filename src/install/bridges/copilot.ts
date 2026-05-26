/**
 * Copilot bridge — `.github/plugin/marketplace.json` plugin registration.
 *
 * Declares the agent-config plugin in GitHub's plugin marketplace
 * format so Copilot-aware tooling can resolve it from the repo.
 *
 * Mirror of `scripts/install.py:ensure_copilot_bridge` (lines 1532–1552).
 */

import { join } from 'node:path';

import type { BridgeBuilder, JsonBridgeOutput } from './types.js';

/** Builder for the Copilot project-scope bridge. */
export const buildCopilotBridge: BridgeBuilder = (ctx): JsonBridgeOutput => ({
    kind: 'json',
    toolId: 'copilot',
    target: join(ctx.projectRoot, '.github', 'plugin', 'marketplace.json'),
    payload: {
        marketplace: {
            name: 'event4u-agent-marketplace',
            plugins: [
                {
                    id: 'agent-config@event4u',
                    repository: 'https://github.com/event4u-app/agent-config',
                },
            ],
        },
    },
    label: '.github/plugin/marketplace.json',
});
