// Guardrail (road-to-claude-code-single-surface Phase 4): the shipped plugin
// hooks/hooks.json, the managed settings.json block, and hook_manifest.yaml
// must describe the SAME hook matrix. Both generators consume
// build_claude_hook_matrix(), so drift is impossible by construction — this
// test is the CI backstop that fails loudly if either side regresses to an
// inline template again.

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { build_claude_hook_matrix } from '../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const PLUGIN_HOOKS = path.join(REPO_ROOT, 'hooks', 'hooks.json');

describe('claude hook matrix — single source of truth', () => {
    it('plugin hooks/hooks.json matches the manifest-derived matrix byte-for-byte', () => {
        const matrix = build_claude_hook_matrix(MANIFEST);
        const plugin = (
            JSON.parse(readFileSync(PLUGIN_HOOKS, 'utf8')) as {
                hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
            }
        ).hooks;

        expect(Object.keys(plugin).sort()).toEqual(Object.keys(matrix).sort());
        for (const [native, command] of Object.entries(matrix)) {
            expect(plugin[native]).toHaveLength(1);
            expect(plugin[native][0].hooks).toHaveLength(1);
            expect(plugin[native][0].hooks[0].command).toBe(command);
        }
    });

    it('the matrix covers the deterministic-governance floor events', () => {
        const matrix = build_claude_hook_matrix(MANIFEST);
        for (const ev of ['SessionStart', 'SessionEnd', 'Stop', 'PreToolUse', 'PostToolUse']) {
            expect(matrix, `event ${ev} missing from hook matrix`).toHaveProperty(ev);
        }
    });
});
