/**
 * Tests for the Phase 3 additions to
 * `src/scripts/_lib/user_global_observations.ts` — project attribution and
 * the generalisation promotion (road-to-global-user-memory Phase 3, per
 * `road-to-global-user-memory.md` and the council cut at
 * `agents/settings/contexts/global-user-memory-cut.md`).
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir and pins `$HOME` to
 * an empty temp dir (mirrors `tests/lib/user_global_observations.test.ts`)
 * so the real `~/.event4u/agent-config/` and `~/.config/agent-config/` on
 * the machine running this suite are never touched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ugo from '../../src/scripts/_lib/user_global_observations';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('ugo-p3-fakehome-');
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

function fakeConfigHome(): { home: string } {
    return { home: make_tmp('ugo-p3-config-') };
}

function bufferPath(home: string): string {
    return path.join(home, 'user', 'observations.jsonl');
}

/** A `.git`-only project — `detect_managed_agents_folder` resolves `unmanaged`. */
function makeUnmanagedProject(name: string): string {
    const parent = make_tmp('ugo-p3-projects-');
    const dir = path.join(parent, name);
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    return dir;
}

/** A project with the `agents/overrides/` marker — resolves `managed`. */
function makeManagedProject(name: string): string {
    const parent = make_tmp('ugo-p3-projects-');
    const dir = path.join(parent, name);
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'agents', 'overrides'), { recursive: true });
    return dir;
}

function input(overrides: Partial<ugo.ProjectObservationInput> = {}): ugo.ProjectObservationInput {
    return {
        ts: '2026-07-30T10:00:00Z',
        suggest: 'this project always runs its migrations via a custom wrapper script',
        source: 'agent',
        evidence: 'user said "always use scripts/migrate.sh, never artisan migrate directly"',
        ...overrides,
    };
}

describe('routeProjectObservation — the Phase 0 predicate as router', () => {
    it("managed → route 'local', writes nothing to the global buffer", () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const project = makeManagedProject('managed-proj');

        const result = ugo.routeProjectObservation(input(), project, { env });

        expect(result.route).toBe('local');
        expect(result.written).toBe(false);
        expect(fs.existsSync(bufferPath(home))).toBe(false);
    });

    it("unmanaged → route 'global', writes with context attached", () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const project = makeUnmanagedProject('unmanaged-proj');

        const result = ugo.routeProjectObservation(input(), project, { env });

        expect(result.route).toBe('global');
        expect(result.written).toBe(true);
        expect(result.context).toEqual({
            project_path: project,
            project_name: 'unmanaged-proj',
            first_seen: '2026-07-30T10:00:00Z',
        });
        expect(result.seen_count).toBe(1);
        expect(result.seen_in).toEqual(['unmanaged-proj']);

        const raw = fs.readFileSync(bufferPath(home), 'utf-8');
        const line = JSON.parse(raw.trim());
        expect(line.field).toBe('notes');
        expect(line.context.project_name).toBe('unmanaged-proj');
        expect(line.seen_count).toBe(1);
        expect(line.seen_in).toEqual(['unmanaged-proj']);
    });

    it("not-a-project → route 'global', same as unmanaged", () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const bareDir = make_tmp('ugo-p3-bare-'); // no .git at all

        const result = ugo.routeProjectObservation(input(), bareDir, { env });

        expect(result.route).toBe('global');
        expect(result.written).toBe(true);
        expect(result.context?.project_path).toBe(bareDir);
    });

    it('still refuses via the standard capture-time guards for suggest/evidence (guard pipeline is shared, not bypassed)', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const project = makeUnmanagedProject('secret-proj');

        const result = ugo.routeProjectObservation(
            input({
                suggest: 'api_key: sk-abcdefghijklmnopqrstuvwx',
                evidence: 'api_key: sk-abcdefghijklmnopqrstuvwx',
            }),
            project,
            { env },
        );

        expect(result.route).toBe('global');
        expect(result.written).toBe(false);
        expect(result.category).toBe('exclusion_list');
        expect(fs.existsSync(bufferPath(home))).toBe(false);
    });

    it('refuses a project_name carrying hidden-unicode identifier smuggling', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const parent = make_tmp('ugo-p3-projects-');
        // U+200B ZERO WIDTH SPACE inside the directory basename.
        const smuggledName = 'proj​name';
        const project = path.join(parent, smuggledName);
        fs.mkdirSync(path.join(project, '.git'), { recursive: true });

        const result = ugo.routeProjectObservation(input(), project, { env });

        expect(result.route).toBe('global');
        expect(result.written).toBe(false);
        expect(result.category).toBe('hidden_unicode');
        expect(fs.existsSync(bufferPath(home))).toBe(false);
    });

    it('does NOT refuse a legitimate absolute project_path even though it structurally matches the generic path-leak pattern', () => {
        // This is the guard against the false-positive this phase's redaction
        // extension could otherwise introduce: `redaction_scan`'s generic
        // `project_path` category exists to catch a path LEAKED into
        // free-form text and would flag `/Users/...` unconditionally — but a
        // project_path field is SUPPOSED to look exactly like that. Build the
        // context directly (rather than relying on the test runner's own tmp
        // prefix, which may not start with `/Users/`) so this exercises the
        // real path-regex-trips-but-must-still-pass case deterministically.
        const ctx = ugo.buildObservationContext('/Users/matze/projects/acme-web', '2026-07-30T10:00:00Z');
        expect(ugo.evaluateContextCaptureGuards(ctx)).toEqual({ allowed: true });
    });
});

describe('computeRecurrence — cross-project seen_count / seen_in via the shared dedup primitive', () => {
    it('first sighting: seen_count 1, seen_in = [this project]', () => {
        const ctx = ugo.buildObservationContext('/tmp/proj-a', '2026-07-30T10:00:00Z');
        const recurrence = ugo.computeRecurrence(ctx, 'always use pnpm not npm', []);
        expect(recurrence).toEqual({ seen_count: 1, seen_in: ['proj-a'] });
    });

    it('a similar observation from a DIFFERENT project increments seen_count and appends to seen_in', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };

        ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            makeUnmanagedProject('proj-a'),
            { env },
        );
        const result = ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            makeUnmanagedProject('proj-b'),
            { env },
        );

        expect(result.seen_count).toBe(2);
        expect(result.seen_in).toEqual(['proj-a', 'proj-b']);
    });

    it('the SAME project recurring does not double-count', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const project = makeUnmanagedProject('proj-repeat');

        ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            project,
            { env },
        );
        const second = ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            project,
            { env },
        );

        expect(second.seen_count).toBe(1);
        expect(second.seen_in).toEqual(['proj-repeat']);
    });

    it('an unrelated observation does not merge — its own seen_count starts at 1', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };

        ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            makeUnmanagedProject('proj-a'),
            { env },
        );
        const result = ugo.routeProjectObservation(
            input({ suggest: 'the deploy pipeline requires a manual approval step' }),
            makeUnmanagedProject('proj-b'),
            { env },
        );

        expect(result.seen_count).toBe(1);
        expect(result.seen_in).toEqual(['proj-b']);
    });
});

describe('findPromotionCandidates — surfaces at seen_count >= 3, never auto-promotes', () => {
    it('an observation seen in only 2 projects is NOT a promotion candidate', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };

        ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            makeUnmanagedProject('proj-a'),
            { env },
        );
        ugo.routeProjectObservation(
            input({ suggest: 'always use pnpm instead of npm for installs' }),
            makeUnmanagedProject('proj-b'),
            { env },
        );

        const entries = ugo.readGlobalObservations({ env }).entries;
        expect(ugo.findPromotionCandidates(entries)).toEqual([]);
    });

    it('an observation seen in 3 different projects IS a promotion candidate, with the project list attached', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const suggest = 'always use pnpm instead of npm for installs';

        ugo.routeProjectObservation(input({ suggest }), makeUnmanagedProject('proj-a'), { env });
        ugo.routeProjectObservation(input({ suggest }), makeUnmanagedProject('proj-b'), { env });
        ugo.routeProjectObservation(input({ suggest }), makeUnmanagedProject('proj-c'), { env });

        const entries = ugo.readGlobalObservations({ env }).entries;
        const candidates = ugo.findPromotionCandidates(entries);

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.seenCount).toBe(3);
        expect(candidates[0]?.projects).toEqual(['proj-a', 'proj-b', 'proj-c']);
    });

    it('a pure user-attribute observation (no context) is never a promotion candidate, however high its own seen_count-shaped field might be forged', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        // Bypass the router entirely — append directly, as Phase 2's channel does.
        ugo.appendGlobalObservation(
            {
                ts: '2026-07-30T10:00:00Z',
                field: 'style.pace',
                suggest: 'rapid',
                source: 'agent',
                evidence: 'user said "mach kürzer" repeatedly',
            },
            { env },
        );
        const entries = ugo.readGlobalObservations({ env }).entries;
        expect(ugo.findPromotionCandidates(entries)).toEqual([]);
    });

    it('promotionValueFor returns ONLY the fact text — never context or seen_in', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const suggest = 'always use pnpm instead of npm for installs';
        ugo.routeProjectObservation(input({ suggest }), makeUnmanagedProject('proj-only'), { env });

        const entries = ugo.readGlobalObservations({ env }).entries;
        const [entry] = entries;
        expect(entry).toBeDefined();
        const value = ugo.promotionValueFor(entry as ugo.ObservationCandidate);

        expect(value).toBe(suggest);
        expect(value).not.toContain('proj-only');
    });
});

describe('no project-indexed directory is EVER created under the global root', () => {
    it('routing observations from many distinct projects never creates a per-project subdirectory', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };

        for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
            ugo.routeProjectObservation(
                input({ suggest: `observation unique to ${name} project` }),
                makeUnmanagedProject(name),
                { env },
            );
        }

        const userDir = path.join(home, 'user');
        expect(fs.existsSync(userDir)).toBe(true);
        const entries = fs.readdirSync(userDir, { withFileTypes: true });
        // The council's round-2 refusal, made mechanical. Asserted as the
        // INVARIANT, not as an exact file list: a flat sibling file (the
        // Phase-5 gate counters) is legitimate, a per-project directory or a
        // project-named entry never is. An exact-list assertion would break on
        // any unrelated flat file and would tempt the next reader to loosen the
        // guard rather than tighten it.
        for (const entry of entries) {
            expect(entry.isDirectory()).toBe(false);
        }
        for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
            expect(entries.some((e) => e.name.includes(name))).toBe(false);
        }
        expect(entries.some((e) => e.name === 'observations.jsonl')).toBe(true);
    });
});

describe('profile.md holds zero project references after a promotion', () => {
    it('applying a promoted observation to the global profile leaves no project-name or project-path trace', async () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const suggest = 'always use pnpm instead of npm for installs';
        const projectNames = ['acme-web', 'acme-api', 'acme-mobile'];

        for (const name of projectNames) {
            ugo.routeProjectObservation(input({ suggest }), makeUnmanagedProject(name), { env });
        }

        const entries = ugo.readGlobalObservations({ env }).entries;
        const candidates = ugo.findPromotionCandidates(entries);
        expect(candidates).toHaveLength(1);
        const candidate = candidates[0] as ugo.PromotionCandidate;
        expect(candidate.projects).toEqual(projectNames);

        const aup = await import('../../src/scripts/_lib/agent_user_profile');
        aup.applyObservationToGlobalProfile('notes', ugo.promotionValueFor(candidate.observation), {
            env,
            today: '2026-07-30',
        });

        const profilePath = path.join(home, 'user', 'profile.md');
        const profileText = fs.readFileSync(profilePath, 'utf-8');

        expect(profileText).toContain(suggest);
        for (const name of projectNames) {
            expect(profileText).not.toContain(name);
        }
        expect(profileText).not.toMatch(/seen_in/);
        expect(profileText).not.toMatch(/\/tmp\/|\/Users\/|\/private\//);
    });
});
