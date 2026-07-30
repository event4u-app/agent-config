/**
 * Tests for `src/scripts/_lib/agent_user_profile.ts` — the two-layer
 * (global profile.md / project .agent-user.md) cascade added by ADR-138.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir so the real
 * `~/.event4u/agent-config/` on the machine running this suite is never
 * touched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as aup from '../../src/scripts/_lib/agent_user_profile';
import * as ugo from '../../src/scripts/_lib/user_global_observations';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

/**
 * `user_global_paths.legacy_xdg_root()` reads `os.homedir()` directly and
 * is NOT parameterized by the `env` object this module's functions accept
 * — so every legacy-fallback probe would otherwise touch the REAL
 * `~/.config/agent-config/` on the machine running this suite. Pin `$HOME`
 * to an empty temp dir for the duration of each test so the legacy path
 * never resolves to a real file.
 */
function isolate_home(): void {
    const fake_home = make_tmp('aup-fakehome-');
    saved_env.push(['HOME', process.env.HOME]);
    process.env.HOME = fake_home;
}

beforeEach(() => {
    isolate_home();
});

afterEach(() => {
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function writeGlobalProfile(configHome: string, body: string): void {
    const target = path.join(configHome, aup.GLOBAL_PROFILE_RELATIVE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
}

function writeProjectFile(projectRoot: string, body: string): void {
    fs.writeFileSync(path.join(projectRoot, '.agent-user.md'), body, 'utf-8');
}

const GLOBAL_BODY = `---
version: 1
identity:
  name: "Matze"
language: "de"
role:
  - founder
  - engineer
style:
  pace: "pragmatic"
voice_sample: |
  Mach das einfach.
last_updated: "2026-05-15"
---

Pragmatic shipper, terse replies.
`;

const PROJECT_BODY_OVERRIDE = `---
version: 1
style:
  pace: "rapid"
---

This project needs rapid-fire status updates.
`;

// --- path resolution ---------------------------------------------------

describe('globalProfileWriteTarget / resolveGlobalProfilePath', () => {
    it('resolves the write target under the injected EVENT4U_CONFIG_HOME', () => {
        const home = make_tmp('aup-home-');
        const env = { EVENT4U_CONFIG_HOME: home };
        expect(aup.globalProfileWriteTarget(env)).toBe(path.join(home, 'user', 'profile.md'));
    });

    it('returns null when neither the new nor the legacy path exists', () => {
        const home = make_tmp('aup-home-');
        const env = { EVENT4U_CONFIG_HOME: home };
        expect(aup.resolveGlobalProfilePath(env)).toBeNull();
    });

    it('resolves the new-namespace path once the file exists', () => {
        const home = make_tmp('aup-home-');
        writeGlobalProfile(home, GLOBAL_BODY);
        const env = { EVENT4U_CONFIG_HOME: home };
        expect(aup.resolveGlobalProfilePath(env)).toBe(path.join(home, 'user', 'profile.md'));
    });
});

// --- the cascade: global-only / project-only / both / neither ----------

describe('loadEffectiveUserProfile — cascade', () => {
    it('global-only: merged profile is sourced entirely from the global layer', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(home, GLOBAL_BODY);
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile).toMatchObject({
            identity: { name: 'Matze' },
            language: 'de',
            role: ['founder', 'engineer'],
            style: { pace: 'pragmatic' },
            last_updated: '2026-05-15',
        });
        expect(result.sources['identity.name']).toBe('global');
        expect(result.sources['style.pace']).toBe('global');
        expect(result.profile.notes).toBe('Pragmatic shipper, terse replies.');
        expect(result.capWarnings).toEqual([]);
    });

    it('project-only: merged profile is sourced entirely from the project layer', () => {
        const home = make_tmp('aup-home-'); // no global file written
        const project = make_tmp('aup-proj-');
        writeProjectFile(project, GLOBAL_BODY.replace('"Matze"', '"ProjectOnly"'));
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect((result.profile.identity as { name?: string }).name).toBe('ProjectOnly');
        expect(result.sources['identity.name']).toBe('project');
        expect(result.sources['style.pace']).toBe('project');
    });

    it('both: primitive-level deepest-wins — project style.pace replaces global, but global identity.name survives untouched', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(home, GLOBAL_BODY);
        writeProjectFile(project, PROJECT_BODY_OVERRIDE);
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        // Project declared only style.pace — deepest wins for that ONE field.
        expect((result.profile.style as { pace?: string }).pace).toBe('rapid');
        expect(result.sources['style.pace']).toBe('project');

        // Global's identity/language/role/voice_sample/last_updated survive —
        // this is the "no object merging" guarantee: the project layer did
        // NOT declare identity, so it never overwrote it with an empty value.
        expect((result.profile.identity as { name?: string }).name).toBe('Matze');
        expect(result.sources['identity.name']).toBe('global');
        expect(result.profile.language).toBe('de');
        expect(result.profile.role).toEqual(['founder', 'engineer']);
    });

    it('neither: empty merged profile — the "generic address forms" fallback keeps working', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile).toEqual({});
        expect(result.sources).toEqual({});
        expect(result.capWarnings).toEqual([]);
        // Consumer-side contract: no identity means "use generic address forms".
        expect((result.profile as { identity?: unknown }).identity).toBeUndefined();
    });
});

// --- # Notes concatenation ----------------------------------------------

describe('loadEffectiveUserProfile — notes concatenation', () => {
    it('concatenates both layers under [global] / [project] markers when both carry notes', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(home, GLOBAL_BODY);
        writeProjectFile(project, PROJECT_BODY_OVERRIDE);
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile.notes).toBe(
            '[global]\nPragmatic shipper, terse replies.\n\n[project]\nThis project needs rapid-fire status updates.',
        );
    });

    it('does not add markers when only one layer carries notes (global-only)', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(home, GLOBAL_BODY);
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile.notes).toBe('Pragmatic shipper, terse replies.');
    });

    it('does not add markers when only one layer carries notes (project-only)', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeProjectFile(project, PROJECT_BODY_OVERRIDE);
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile.notes).toBe('This project needs rapid-fire status updates.');
    });

    it('omits notes entirely when neither layer has any', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(
            home,
            `---
version: 1
identity:
  name: "NoNotes"
language: "en"
style:
  pace: "pragmatic"
last_updated: "2026-05-15"
---
`,
        );
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.profile.notes).toBeUndefined();
    });
});

// --- per-layer cap enforcement -------------------------------------------

describe('per-layer 100-line cap', () => {
    function bodyWithLines(n: number): string {
        const filler = Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');
        return `---
version: 1
identity:
  name: "Long"
language: "en"
style:
  pace: "pragmatic"
last_updated: "2026-05-15"
---

# Notes
${filler}
`;
    }

    it('flags a layer that exceeds the cap without throwing', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        writeGlobalProfile(home, bodyWithLines(150));
        const env = { EVENT4U_CONFIG_HOME: home };

        const layer = aup.loadGlobalProfileLayer(env);
        expect(layer).not.toBeNull();
        expect(layer?.overCap).toBe(true);
        expect(layer?.lineCount).toBeGreaterThan(aup.USER_PROFILE_LINE_CAP);

        const result = aup.loadEffectiveUserProfile(project, env);
        expect(result.capWarnings).toHaveLength(1);
        expect(result.capWarnings[0]).toMatch(/global profile exceeds 100-line cap/);
    });

    it('does not flag a layer within the cap', () => {
        const home = make_tmp('aup-home-');
        writeGlobalProfile(home, bodyWithLines(5));
        const env = { EVENT4U_CONFIG_HOME: home };

        const layer = aup.loadGlobalProfileLayer(env);
        expect(layer?.overCap).toBe(false);
    });

    it('evaluates each layer independently — one over cap does not flag the other, and the cap is never a shared total', () => {
        const home = make_tmp('aup-home-');
        const project = make_tmp('aup-proj-');
        // Global is deliberately oversized; project is small. A shared-total
        // cap would force trimming the SMALL project file to compensate —
        // the per-layer cap must not do that.
        writeGlobalProfile(home, bodyWithLines(150));
        writeProjectFile(project, bodyWithLines(3));
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.loadEffectiveUserProfile(project, env);

        expect(result.capWarnings).toHaveLength(1);
        expect(result.capWarnings[0]).toMatch(/^global profile exceeds/);
    });
});

describe('applyObservationToGlobalProfile — the ONLY writer of profile.md (Phase 2)', () => {
    it('creates profile.md from nothing, sets the field, and bumps last_updated', () => {
        const home = make_tmp('aup-home-');
        const env = { EVENT4U_CONFIG_HOME: home };

        const result = aup.applyObservationToGlobalProfile('style.pace', 'rapid', {
            env,
            today: '2026-07-30',
        });

        expect(fs.existsSync(result.path)).toBe(true);
        const layer = aup.loadGlobalProfileLayer(env);
        expect(layer).not.toBeNull();
        expect((layer?.data.style as Record<string, unknown> | undefined)?.pace).toBe('rapid');
        expect(layer?.data.last_updated).toBe('2026-07-30');
    });

    it('preserves every other field byte-for-byte-equivalent when setting one field', () => {
        const home = make_tmp('aup-home-');
        writeGlobalProfile(home, GLOBAL_BODY);
        const env = { EVENT4U_CONFIG_HOME: home };

        aup.applyObservationToGlobalProfile('style.pace', 'thorough', { env, today: '2026-07-30' });

        const layer = aup.loadGlobalProfileLayer(env);
        expect((layer?.data.identity as Record<string, unknown> | undefined)?.name).toBe('Matze');
        expect((layer?.data.style as Record<string, unknown> | undefined)?.pace).toBe('thorough');
    });

    it('concatenates onto `notes` via setPath when field is "notes"', () => {
        const home = make_tmp('aup-home-');
        const env = { EVENT4U_CONFIG_HOME: home };

        aup.applyObservationToGlobalProfile('notes', 'user signs off as "— Matze"', {
            env,
            today: '2026-07-30',
        });

        const layer = aup.loadGlobalProfileLayer(env);
        expect(layer?.data.notes).toBe('user signs off as "— Matze"');
    });

    it('throws and leaves the file untouched when the write would exceed the per-layer cap', () => {
        const home = make_tmp('aup-home-');
        const overCapBody = `---
version: 1
identity:
  name: "Matze"
language: "en"
style:
  pace: "pragmatic"
last_updated: "2026-05-15"
---

# Notes
${Array.from({ length: 150 }, (_, i) => `line ${i}`).join('\n')}
`;
        writeGlobalProfile(home, overCapBody);
        const env = { EVENT4U_CONFIG_HOME: home };
        const target = path.join(home, aup.GLOBAL_PROFILE_RELATIVE);
        const before = fs.readFileSync(target, 'utf-8');

        expect(() =>
            aup.applyObservationToGlobalProfile('style.pace', 'rapid', { env, today: '2026-07-30' }),
        ).toThrow(/exceeding the 100-line-per-layer cap/);

        expect(fs.readFileSync(target, 'utf-8')).toBe(before);
    });

    it('is the ONLY function that writes profile.md — appendGlobalObservation never does', () => {
        const home = make_tmp('aup-home-');
        const env = { EVENT4U_CONFIG_HOME: home };
        const profileTarget = path.join(home, aup.GLOBAL_PROFILE_RELATIVE);

        // Route a candidate through the OTHER half of the learning channel
        // (the observation buffer) and confirm profile.md is untouched.
        ugo.appendGlobalObservation(
            {
                ts: '2026-07-30T10:00:00Z',
                field: 'style.pace',
                suggest: 'rapid',
                source: 'agent',
                evidence: 'user said "mach kürzer" 3x this session',
            },
            { env },
        );
        expect(fs.existsSync(profileTarget)).toBe(false);

        // Only the explicit accept-equivalent call writes profile.md.
        aup.applyObservationToGlobalProfile('style.pace', 'rapid', { env, today: '2026-07-30' });
        expect(fs.existsSync(profileTarget)).toBe(true);
    });
});
