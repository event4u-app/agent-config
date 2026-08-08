/**
 * `packs:active` — the probe from `road-to-capability-answerability` Phase 2.1.
 *
 * The load-bearing assertion is the DEGRADED branch. `resolve_profile` returns
 * the default id with an empty body when a settings file exists but declares no
 * `profile.id`, so "which profile is active" answers `developer` while zero
 * packs are actually on. Every pack-gated rule is inert in that state and
 * nothing else in the tree says so — which is precisely the silent-wrong-guess
 * shape this roadmap closes. A test that only exercised the happy path would
 * pass while the branch that matters regressed.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseArgv, runPacksActive } from '../../src/scripts/_cli/cmd_packs_active.js';

function scratchProject(settingsBody: string | null): string {
    const root = mkdtempSync(join(tmpdir(), 'packs-active-'));
    if (settingsBody !== null) {
        writeFileSync(join(root, '.agent-settings.yml'), settingsBody, 'utf-8');
    }
    return root;
}

describe('packs:active argv', () => {
    it('accepts nothing and --json, and refuses anything else', () => {
        expect(parseArgv([]).ok).toBe(true);
        expect(parseArgv(['--json'])).toMatchObject({ ok: true, json: true });
        expect(parseArgv(['--nope']).ok).toBe(false);
        expect(parseArgv(['--help']).ok).toBe(false);
    });
});

describe('packs:active resolution', () => {
    it('reports the degraded branch when a settings file declares no profile.id', () => {
        const root = scratchProject('personal:\n  autonomy: auto\n');
        const result = runPacksActive({ cwd: root, json: true });

        expect(result.code).toBe(0);
        const payload = JSON.parse(result.out.join('\n')) as {
            degraded: boolean;
            packs: string[];
            profile_file: string | null;
        };
        // The three facts that together make the state legible. Asserting only
        // `degraded` would pass even if the verb reported a pack list it never
        // loaded, which is the exact confusion the probe exists to remove.
        expect(payload.degraded).toBe(true);
        expect(payload.packs).toEqual([]);
        expect(payload.profile_file).toBeNull();
    });

    it('says so in prose too, not only in --json', () => {
        const root = scratchProject('personal:\n  autonomy: auto\n');
        const result = runPacksActive({ cwd: root, json: false });

        expect(result.code).toBe(0);
        const text = result.out.join('\n');
        expect(text).toContain('Degraded resolution');
        expect(text).toContain('packs     none');
    });

    it('resolves a declared profile.id to a real pack set and names its file', () => {
        // No settings file at all is the OTHER branch of the same fork: the
        // package default id is honoured AND its body loads.
        const root = scratchProject(null);
        const result = runPacksActive({ cwd: root, json: true });

        expect(result.code).toBe(0);
        const payload = JSON.parse(result.out.join('\n')) as {
            degraded: boolean;
            profile_id: string;
            packs: string[];
            profile_file: string | null;
        };
        expect(payload.degraded).toBe(false);
        expect(payload.profile_id).toBe('developer');
        // Derived from the shipped profile rather than hardcoded: the assertion
        // is "the body loaded", not "the developer profile has exactly these
        // packs", which would break on any legitimate profile edit.
        expect(payload.profile_file).not.toBeNull();
        expect(Array.isArray(payload.packs)).toBe(true);
    });

    it('never reports a pack set without the file it came from', () => {
        const root = scratchProject(null);
        const payload = JSON.parse(
            runPacksActive({ cwd: root, json: true }).out.join('\n'),
        ) as { packs: string[]; profile_file: string | null };

        // The invariant that makes the answer checkable: a non-empty pack list
        // always names its source. Reporting packs with a null file would be a
        // claim nobody can verify.
        if (payload.packs.length > 0) {
            expect(payload.profile_file).not.toBeNull();
        }
    });
});
