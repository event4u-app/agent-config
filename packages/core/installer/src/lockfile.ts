/**
 * Lockfile read/write for `agents/agent-config.lock.yml` and overrides
 * read for `agents/agent-config.overrides.yml`.
 *
 * Schema locked by ADR-016 § 1 (lockfile) and § 2 (split overrides).
 * The installer never writes the overrides file — it is user-managed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dump, load } from 'js-yaml';
import type { Lockfile, OverridesFile } from './types.js';

export const LOCKFILE_NAME = 'agents/agent-config.lock.yml';
export const OVERRIDES_NAME = 'agents/agent-config.overrides.yml';

export class LockfileParseError extends Error {
    public constructor(path: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`lockfile at ${path} is not valid YAML or schema: ${reason}`);
        this.name = 'LockfileParseError';
    }
}

export class OverridesParseError extends Error {
    public constructor(path: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`overrides file at ${path} is not valid YAML or schema: ${reason}`);
        this.name = 'OverridesParseError';
    }
}

/** Serialize a Lockfile to YAML. Deterministic key order. */
export function lockfileToYaml(lock: Lockfile): string {
    return dump(lock, {
        noRefs: true,
        sortKeys: false,
        lineWidth: 100,
        quotingType: '"',
    });
}

/** Parse a Lockfile from YAML text. Throws LockfileParseError on schema mismatch. */
export function lockfileFromYaml(text: string, path = LOCKFILE_NAME): Lockfile {
    let parsed: unknown;
    try {
        parsed = load(text);
    } catch (err) {
        throw new LockfileParseError(path, err);
    }
    return validateLockfile(parsed, path);
}

/** Read lockfile from disk; returns undefined if absent. */
export function readLockfile(path: string): Lockfile | undefined {
    if (!existsSync(path)) return undefined;
    const raw = readFileSync(path, 'utf8');
    return lockfileFromYaml(raw, path);
}

/** Read overrides file from disk; returns empty overrides if absent. */
export function readOverrides(path: string): OverridesFile {
    if (!existsSync(path)) {
        return { schema_version: 1, overrides: [] };
    }
    const raw = readFileSync(path, 'utf8');
    let parsed: unknown;
    try {
        parsed = load(raw);
    } catch (err) {
        throw new OverridesParseError(path, err);
    }
    return validateOverrides(parsed, path);
}

function validateLockfile(parsed: unknown, path: string): Lockfile {
    if (parsed === null || typeof parsed !== 'object') {
        throw new LockfileParseError(path, 'root must be an object');
    }
    const root = parsed as Record<string, unknown>;
    if (root.schema_version !== 1) {
        throw new LockfileParseError(path, `expected schema_version: 1, got ${String(root.schema_version)}`);
    }
    for (const key of ['agent_config_version', 'manifest_sha256', 'generated_at'] as const) {
        if (typeof root[key] !== 'string') {
            throw new LockfileParseError(path, `field '${key}' must be a string`);
        }
    }
    for (const key of ['workspaces', 'packs', 'files'] as const) {
        if (!Array.isArray(root[key])) {
            throw new LockfileParseError(path, `field '${key}' must be an array`);
        }
    }
    return root as unknown as Lockfile;
}

function validateOverrides(parsed: unknown, path: string): OverridesFile {
    if (parsed === null || typeof parsed !== 'object') {
        throw new OverridesParseError(path, 'root must be an object');
    }
    const root = parsed as Record<string, unknown>;
    if (root.schema_version !== 1) {
        throw new OverridesParseError(path, `expected schema_version: 1, got ${String(root.schema_version)}`);
    }
    if (!Array.isArray(root.overrides)) {
        throw new OverridesParseError(path, `field 'overrides' must be an array`);
    }
    return root as unknown as OverridesFile;
}
