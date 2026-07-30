/**
 * Tests for `src/scripts/_lib/user_global_memory_audit.ts` — the Phase 4
 * ("delete, revoke, audit") read surface that renders what the global
 * layer currently holds, per
 * `agents/roadmaps/road-to-global-user-memory.md` Phase 4.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir and pins `$HOME`
 * to an empty temp dir (mirrors the sibling Phase 2/3/4 suites) so the real
 * `~/.event4u/agent-config/` and `~/.config/agent-config/` on the machine
 * running this suite are never touched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as aup from '../../src/scripts/_lib/agent_user_profile';
import type { ObservationCandidate } from '../../src/scripts/_lib/user_global_observations';
import * as ugr from '../../src/scripts/_lib/user_global_revocations';
import { renderGlobalMemoryAudit } from '../../src/scripts/_lib/user_global_memory_audit';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('ugma-fakehome-');
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

function fakeConfigHome(): { home: string; env: { EVENT4U_CONFIG_HOME: string } } {
    const home = make_tmp('ugma-config-');
    return { home, env: { EVENT4U_CONFIG_HOME: home } };
}

function writeGlobalProfile(home: string, body: string): void {
    const target = path.join(home, aup.GLOBAL_PROFILE_RELATIVE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
}

function bufferPath(home: string): string {
    return path.join(home, 'user', 'observations.jsonl');
}

function seedBuffer(home: string, entries: readonly ObservationCandidate[]): void {
    const target = bufferPath(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}

describe('renderGlobalMemoryAudit — empty state', () => {
    it('reports no profile, no buffer, zero counts, and says so in the text', () => {
        const { env } = fakeConfigHome();
        const render = renderGlobalMemoryAudit({ env });

        expect(render.profileExists).toBe(false);
        expect(render.profilePath).toBeNull();
        expect(render.bufferEntryCount).toBe(0);
        expect(render.revocationCount).toBe(0);
        expect(render.text).toContain('none — no observation has been accepted yet');
        expect(render.text).toContain('none — no observation has been buffered yet');
    });
});

describe('renderGlobalMemoryAudit — profile + buffer content', () => {
    const PROFILE_BODY = `---
version: 1
identity:
  name: "Matze"
language: "de"
last_updated: "2026-08-01"
---
`;

    it('lists profile fields with their sources and the buffer field counts', () => {
        const { home, env } = fakeConfigHome();
        writeGlobalProfile(home, PROFILE_BODY);
        seedBuffer(home, [
            {
                ts: '2026-08-02T10:00:00Z',
                field: 'style.pace',
                suggest: 'rapid',
                source: 'chat',
                evidence: 'user said mach kürzer',
            },
            {
                ts: '2026-08-02T11:00:00Z',
                field: 'style.pace',
                suggest: 'rapid',
                source: 'chat',
                evidence: 'again',
            },
        ]);

        const render = renderGlobalMemoryAudit({ env });

        expect(render.profileExists).toBe(true);
        expect(render.profileFields).toEqual(
            expect.arrayContaining([
                { path: 'identity.name', value: 'Matze' },
                { path: 'language', value: 'de' },
            ]),
        );
        expect(render.bufferEntryCount).toBe(2);
        expect(render.bufferFieldCounts).toEqual([{ field: 'style.pace', count: 2 }]);
    });

    it('counts the revocation ledger', () => {
        const { env } = fakeConfigHome();
        ugr.appendTombstone('obs-x', 'forgotten', { today: '2026-08-03', env });
        ugr.appendTombstone('profile:identity.name', 'forgotten too', { today: '2026-08-04', env });

        const render = renderGlobalMemoryAudit({ env });
        expect(render.revocationCount).toBe(2);
        expect(render.text).toContain('Revocation ledger: 2 tombstone(s)');
    });

    it('surfaces a promotion candidate by project NAME, never by project path', () => {
        const { home, env } = fakeConfigHome();
        const context = (project: string) => ({
            project_path: `/Users/matze/projects/${project}`,
            project_name: project,
            first_seen: '2026-08-01T10:00:00Z',
        });
        seedBuffer(home, [
            {
                ts: '2026-08-01T10:00:00Z',
                field: 'notes',
                suggest: 'always use pnpm instead of npm',
                source: 'agent',
                evidence: '…',
                context: context('acme-web'),
                seen_count: 3,
                seen_in: ['acme-web', 'acme-api', 'acme-mobile'],
            },
        ]);

        const render = renderGlobalMemoryAudit({ env });
        expect(render.promotionCandidates).toEqual([
            { suggest: 'always use pnpm instead of npm', seenCount: 3, projects: ['acme-web', 'acme-api', 'acme-mobile'] },
        ]);
        expect(render.text).not.toContain('/Users/matze/projects');
    });
});

describe('renderGlobalMemoryAudit — privacy floor (no secret, no path outside the allowlist)', () => {
    it('redacts a profile field value that fails the write-path redaction gate', () => {
        const { home, env } = fakeConfigHome();
        // Bypasses the capture-time guard on purpose — this is the render-time
        // defense-in-depth the roadmap phase requires, exercised against a
        // value that should never have been written in the first place.
        writeGlobalProfile(
            home,
            `---\nversion: 1\nvoice_sample: |\n  my api key is sk-live-abcdef1234567890\nlast_updated: "2026-08-01"\n---\n`,
        );

        const render = renderGlobalMemoryAudit({ env });
        const voiceField = render.profileFields.find((f) => f.path === 'voice_sample');
        expect(voiceField?.value).toBe('[redacted]');
        expect(render.text).not.toContain('sk-live-abcdef1234567890');
    });

    it('redacts a buffered evidence/suggest string carrying an absolute project path', () => {
        const { home, env } = fakeConfigHome();
        seedBuffer(home, [
            {
                ts: '2026-08-01T10:00:00Z',
                field: 'notes',
                suggest: 'the config lives at /Users/matze/secret-client-project/config.php',
                source: 'agent',
                evidence: 'saw it in chat',
            },
        ]);

        const render = renderGlobalMemoryAudit({ env });
        expect(render.text).not.toContain('/Users/matze/secret-client-project');
    });

    it('redacts a tombstone reason that fails the redaction gate, wherever it is rendered', () => {
        const { env } = fakeConfigHome();
        ugr.appendTombstone('obs-y', 'because api_key=sk-live-abcdef1234567890 leaked', {
            today: '2026-08-05',
            env,
        });

        const render = renderGlobalMemoryAudit({ env });
        expect(render.text).not.toContain('sk-live-abcdef1234567890');
    });

    it('never emits context.project_path verbatim, even though the buffer entry carries it', () => {
        const { home, env } = fakeConfigHome();
        seedBuffer(home, [
            {
                ts: '2026-08-01T10:00:00Z',
                field: 'notes',
                suggest: 'fact',
                source: 'agent',
                evidence: 'e',
                context: {
                    project_path: '/Users/matze/projects/only-in-context',
                    project_name: 'only-in-context',
                    first_seen: '2026-08-01T10:00:00Z',
                },
            },
        ]);

        const render = renderGlobalMemoryAudit({ env });
        expect(render.text).not.toContain('/Users/matze/projects/only-in-context');
    });

    it('every path-shaped string in the text is one of the two allowlisted storage locations', () => {
        const { home, env } = fakeConfigHome();
        writeGlobalProfile(
            home,
            `---\nversion: 1\nidentity:\n  name: "Matze"\nlast_updated: "2026-08-01"\n---\n`,
        );
        seedBuffer(home, [
            {
                ts: '2026-08-01T10:00:00Z',
                field: 'notes',
                suggest: 'unremarkable fact with no path',
                source: 'agent',
                evidence: 'e',
            },
        ]);

        const render = renderGlobalMemoryAudit({ env });
        const pathLike = render.text.match(/\/[^\s"]+/g) ?? [];
        const allowlist = [render.profilePath, render.bufferPath].filter(
            (p): p is string => p !== null,
        );
        for (const hit of pathLike) {
            expect(allowlist.some((allowed) => allowed.includes(hit) || hit.includes(allowed))).toBe(true);
        }
    });
});
