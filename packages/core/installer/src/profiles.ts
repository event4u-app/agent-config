/**
 * Profile resolution for `init --profile=<id>`.
 *
 * A "profile" is a named bundle of workspaces + packs the user can
 * select with one flag instead of typing each id. The roadmap names
 * `dist/discovery/profiles.json` as the canonical source (planned for
 * a future manifest phase). Until that ships, the installer falls back
 * to a small set of built-in starter profiles so `--profile` is usable
 * in CI today; if a `profiles.json` is found beside the manifest it
 * takes precedence.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ProfileDef {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly workspaces: readonly string[];
    readonly packs: readonly string[];
}

export interface ProfilesFile {
    readonly version: 1;
    readonly profiles: readonly ProfileDef[];
}

export class UnknownProfileError extends Error {
    public readonly id: string;
    public constructor(id: string, available: readonly string[]) {
        super(`unknown profile id: ${id} (available: ${available.join(', ') || '<none>'})`);
        this.name = 'UnknownProfileError';
        this.id = id;
    }
}

export class ProfilesFileError extends Error {
    public constructor(path: string, reason: string) {
        super(`profiles file at ${path} is invalid: ${reason}`);
        this.name = 'ProfilesFileError';
    }
}

export const BUILTIN_PROFILES: readonly ProfileDef[] = [
    {
        id: 'engineering',
        label: 'Engineering baseline',
        description: 'Engineering workspace with the baseline pack only.',
        workspaces: ['engineering'],
        packs: ['engineering-base'],
    },
    {
        id: 'php-laravel',
        label: 'PHP + Laravel',
        description: 'Engineering + Laravel + PHP packs for a Laravel project.',
        workspaces: ['engineering'],
        packs: ['engineering-base', 'php', 'laravel'],
    },
    {
        id: 'php-symfony',
        label: 'PHP + Symfony',
        description: 'Engineering + Symfony + PHP packs for a Symfony project.',
        workspaces: ['engineering'],
        packs: ['engineering-base', 'php', 'symfony'],
    },
    {
        id: 'js-react',
        label: 'JavaScript + React',
        description: 'Engineering + JS + React packs for a React app.',
        workspaces: ['engineering'],
        packs: ['engineering-base', 'javascript', 'typescript', 'react'],
    },
    {
        id: 'js-nextjs',
        label: 'JavaScript + Next.js',
        description: 'Engineering + JS + React + Next.js packs.',
        workspaces: ['engineering'],
        packs: ['engineering-base', 'javascript', 'typescript', 'react', 'nextjs'],
    },
];

/**
 * Load profiles from disk if present, else fall back to built-ins.
 * `manifestPath` is the absolute path to discovery-manifest.json; the
 * profiles file is expected at `<manifest dir>/profiles.json`.
 */
export function loadProfiles(manifestPath: string): readonly ProfileDef[] {
    const candidate = join(dirname(manifestPath), 'profiles.json');
    if (!existsSync(candidate)) return BUILTIN_PROFILES;
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(candidate, 'utf8'));
    } catch (err) {
        throw new ProfilesFileError(candidate, err instanceof Error ? err.message : String(err));
    }
    return parseProfilesFile(parsed, candidate);
}

function parseProfilesFile(parsed: unknown, path: string): readonly ProfileDef[] {
    if (parsed === null || typeof parsed !== 'object') {
        throw new ProfilesFileError(path, 'root must be an object');
    }
    const root = parsed as Record<string, unknown>;
    if (root.version !== 1) {
        throw new ProfilesFileError(path, `expected version: 1, got ${String(root.version)}`);
    }
    if (!Array.isArray(root.profiles)) {
        throw new ProfilesFileError(path, `field 'profiles' must be an array`);
    }
    return root.profiles.map((entry, idx) => parseProfile(entry, path, idx));
}

function parseProfile(entry: unknown, path: string, idx: number): ProfileDef {
    if (entry === null || typeof entry !== 'object') {
        throw new ProfilesFileError(path, `profiles[${idx}] must be an object`);
    }
    const p = entry as Record<string, unknown>;
    const stringField = (name: string): string => {
        const v = p[name];
        if (typeof v !== 'string' || v.length === 0) {
            throw new ProfilesFileError(path, `profiles[${idx}].${name} must be a non-empty string`);
        }
        return v;
    };
    const stringArray = (name: string): readonly string[] => {
        const v = p[name];
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
            throw new ProfilesFileError(path, `profiles[${idx}].${name} must be a string array`);
        }
        return v as readonly string[];
    };
    return {
        id: stringField('id'),
        label: stringField('label'),
        description: stringField('description'),
        workspaces: stringArray('workspaces'),
        packs: stringArray('packs'),
    };
}

/** Pick a profile by id from a profile list; throws on miss. */
export function findProfile(profiles: readonly ProfileDef[], id: string): ProfileDef {
    const hit = profiles.find((p) => p.id === id);
    if (hit === undefined) throw new UnknownProfileError(id, profiles.map((p) => p.id));
    return hit;
}
