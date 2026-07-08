// Golden smoke (road-to-claude-code-single-surface Phase 4): a fresh,
// hermetic `install --global --tools=claude-code` must produce the complete
// single surface in one run — content projection AND the managed hook block
// in ~/.claude/settings.json — with no marketplace plugin involved.
//
// Runs the real bash orchestrator against the freshly built install bundle
// when present (the consumer path), falling back to tsx (the dev path) —
// whichever `src/scripts/install` itself resolves.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    MANAGED_SIGNATURE,
    build_claude_hook_matrix,
} from '../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

describe('golden smoke — fresh global install is single-surface complete', () => {
    let home: string;

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-smoke-home-'));
    });
    afterEach(() => {
        fs.rmSync(home, { recursive: true, force: true });
    });

    it('deploys content AND registers the full managed hook matrix', () => {
        const r = spawnSync('bash', [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 180_000,
            env: {
                ...process.env,
                HOME: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                AGENT_CONFIG_NO_UI: '1',
                CI: '1',
            },
        });
        expect(r.status, `install failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

        // Content surface present.
        expect(fs.existsSync(path.join(home, '.claude', 'skills'))).toBe(true);
        expect(fs.existsSync(path.join(home, '.claude', 'commands'))).toBe(true);

        // Managed hook block complete — every manifest event, managed signature.
        const settingsPath = path.join(home, '.claude', 'settings.json');
        expect(fs.existsSync(settingsPath), 'settings.json with managed hooks missing').toBe(true);
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
            hooks?: Record<string, unknown[]>;
        };
        const matrix = build_claude_hook_matrix(MANIFEST);
        const hooks = settings.hooks ?? {};
        expect(Object.keys(hooks).sort()).toEqual(Object.keys(matrix).sort());
        for (const ev of Object.keys(matrix)) {
            expect(JSON.stringify(hooks[ev])).toContain(MANAGED_SIGNATURE);
        }

        // Shim invariant (road-to-install-path-convergence Phase 1): a direct
        // `claude plugin install` NEXT TO this projection cannot recreate the
        // duplicate content surface — the marketplace plugin lists exactly one
        // pointer skill, that pointer collides with nothing in the projection,
        // and every plugin hook command is byte-identical to a managed settings
        // entry (Claude Code dedupes identical commands, so nothing double-fires).
        const marketplace = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'),
        ) as { plugins: Array<{ skills: string[] }> };
        const pluginSkills = marketplace.plugins.flatMap((p) => p.skills ?? []);
        expect(pluginSkills).toEqual(['./.claude-plugin/skills/install-agent-config']);

        const projectedSkillNames = fs.readdirSync(path.join(home, '.claude', 'skills'));
        expect(projectedSkillNames).not.toContain('install-agent-config');

        const pluginHooks = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'),
        ) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
        for (const [ev, groups] of Object.entries(pluginHooks.hooks)) {
            const managed = JSON.stringify(hooks[ev] ?? []);
            for (const group of groups) {
                for (const h of group.hooks) {
                    expect(managed, `plugin hook for ${ev} not deduped by managed block`).toContain(
                        JSON.stringify(h.command).slice(1, -1),
                    );
                }
            }
        }
    }, 200_000);
});
