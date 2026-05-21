/**
 * Tests for the `--profile` resolver. Covers built-in profiles, the
 * optional `profiles.json` override, and structured failures on
 * unknown ids or malformed files.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BUILTIN_PROFILES,
    ProfilesFileError,
    UnknownProfileError,
    findProfile,
    loadProfiles,
} from '../src/profiles.js';

describe('BUILTIN_PROFILES', () => {
    it('ships a non-empty list with unique ids', () => {
        expect(BUILTIN_PROFILES.length).toBeGreaterThan(0);
        const ids = BUILTIN_PROFILES.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every profile has at least one workspace and one pack', () => {
        for (const p of BUILTIN_PROFILES) {
            expect(p.workspaces.length).toBeGreaterThan(0);
            expect(p.packs.length).toBeGreaterThan(0);
        }
    });
});

describe('findProfile', () => {
    it('returns the matching profile by id', () => {
        const hit = findProfile(BUILTIN_PROFILES, 'engineering');
        expect(hit.id).toBe('engineering');
    });

    it('throws UnknownProfileError on miss with the available list', () => {
        expect(() => findProfile(BUILTIN_PROFILES, 'nope')).toThrow(UnknownProfileError);
    });
});

describe('loadProfiles', () => {
    let dir: string;
    let manifestPath: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'installer-profiles-'));
        mkdirSync(dir, { recursive: true });
        manifestPath = join(dir, 'discovery-manifest.json');
        writeFileSync(manifestPath, '{}');
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('returns built-ins when profiles.json is absent', () => {
        const result = loadProfiles(manifestPath);
        expect(result).toBe(BUILTIN_PROFILES);
    });

    it('returns parsed profiles when profiles.json exists', () => {
        writeFileSync(join(dir, 'profiles.json'), JSON.stringify({
            version: 1,
            profiles: [
                {
                    id: 'custom',
                    label: 'Custom',
                    description: 'd',
                    workspaces: ['engineering'],
                    packs: ['a', 'b'],
                },
            ],
        }));
        const result = loadProfiles(manifestPath);
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('custom');
        expect(result[0]?.packs).toEqual(['a', 'b']);
    });

    it('throws ProfilesFileError on malformed JSON', () => {
        writeFileSync(join(dir, 'profiles.json'), '{not json');
        expect(() => loadProfiles(manifestPath)).toThrow(ProfilesFileError);
    });

    it('throws on wrong version', () => {
        writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ version: 2, profiles: [] }));
        expect(() => loadProfiles(manifestPath)).toThrow(ProfilesFileError);
    });

    it('throws on missing required field', () => {
        writeFileSync(join(dir, 'profiles.json'), JSON.stringify({
            version: 1,
            profiles: [{ id: 'x', label: 'x', description: 'x', workspaces: ['e'] }],
        }));
        expect(() => loadProfiles(manifestPath)).toThrow(ProfilesFileError);
    });
});
