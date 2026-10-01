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
import {
    _resetHostLoweringCache,
    parseHostLowering,
} from '../../src/scripts/hooks/host_lowering.js';
import { smokeProbeEvents } from '../../src/scripts/install.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const LOWERING = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml');

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

// road-to-hooks-on-every-host Phase 3.1 / AC-4 — the smoke probe reaches every
// host the lowering table actually binds.
//
// WHY THIS IS NOT COVERED BY THE EXISTING PROBE TESTS. `install_snapshot.test.ts`
// already asserts that every event `smokeProbeEvents()` names IS bound — it
// checks the probe does not invent events. That is the SOUNDNESS half. The
// COMPLETENESS half is the one that was never checked, and it is the half the
// defect lives in: a host added to `host_lowering.yaml` with five bound slots
// and never added to `SMOKE_PROBE_SLOTS` passes every existing test, because
// nothing enumerates the table and asks what is missing from the list. The
// probe list would be correct about everything it mentions and silent about a
// whole host — which reads as green.
//
// A note, recorded rather than fixed here: being in the probe list is only half
// of being probed. `_smoke_test_hooks` resolves a bridge path per platform and
// counts a platform with no entry as `skipped`, so a platform could be listed
// and still never exercised. That constant is not exported, and exporting it
// would red two committed-build-output freshness gates for a latent hole with
// no live instance (all six listed platforms have a bridge path today). It is
// named here so the next reader sees it rather than rediscovering it.
describe('install smoke probe covers every bound host', () => {
    afterEach(() => {
        _resetHostLoweringCache();
    });

    /** Hosts the table binds at least one slot for. */
    function boundHosts(text: string): string[] {
        const out: string[] = [];
        for (const [host, surfaces] of parseHostLowering(text)) {
            for (const row of surfaces.values()) {
                if (row.slots.size > 0) {
                    out.push(host);
                    break;
                }
            }
        }
        return out;
    }

    it('probes every host with slots > 0', () => {
        const probed = new Set(smokeProbeEvents().map(([platform]) => platform));
        const missing = boundHosts(fs.readFileSync(LOWERING, 'utf8')).filter((h) => !probed.has(h));
        expect(
            missing,
            `host_lowering.yaml binds slots for ${missing.join(', ')} but the install smoke probe ` +
                'never exercises them — add them to SMOKE_PROBE_SLOTS in src/scripts/install.ts.',
        ).toEqual([]);
    });

    it('does not probe a host the table binds nothing for', () => {
        // The converse, so the assertion above cannot be satisfied by probing
        // everything: `cowork`, `copilot` and `codex` carry `slots: {}`, and a
        // probe of a host with no bridge would report a skip forever.
        const bound = new Set(boundHosts(fs.readFileSync(LOWERING, 'utf8')));
        for (const [platform] of smokeProbeEvents()) {
            expect(bound.has(platform), `${platform} is probed but binds no slot`).toBe(true);
        }
    });

    it('fails when a bound host is added to the table and not to the probe', () => {
        // The negative control. Without it the assertion above is satisfied by
        // today's table and proves nothing about the next host added.
        const raw = fs.readFileSync(LOWERING, 'utf8');
        const table = parseHostLowering(raw);
        // `codex` is modelled with an empty `slots:` map. Give it one and it
        // becomes exactly the case the gate exists to catch.
        const claudeSlots = table.get('claude')!.get('any')!.slots;
        const codex = table.get('codex')!.get('any')!;
        codex.slots.set('session_start', { ...claudeSlots.get('session_start')! });
        _resetHostLoweringCache(table);

        const probed = new Set(smokeProbeEvents().map(([platform]) => platform));
        const bound: string[] = [];
        for (const [host, surfaces] of table) {
            for (const row of surfaces.values()) {
                if (row.slots.size > 0) {
                    bound.push(host);
                    break;
                }
            }
        }
        expect(bound).toContain('codex');
        expect(bound.filter((h) => !probed.has(h))).toEqual(['codex']);
    });
});
