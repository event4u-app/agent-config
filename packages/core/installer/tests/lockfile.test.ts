/**
 * Tests for lockfile / overrides YAML round-trip (ADR-016 § 1, § 2).
 *
 * Asserts the schema_version: 1 gate, type-checked field validation,
 * and that absent files return undefined / empty rather than throwing.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
    lockfileFromYaml,
    lockfileToYaml,
    readLockfile,
    readOverrides,
    LockfileParseError,
    OverridesParseError,
} from '../src/lockfile.js';
import type { Lockfile } from '../src/types.js';

const sampleLockfile: Lockfile = {
    schema_version: 1,
    agent_config_version: '2.0.0',
    manifest_sha256: 'a'.repeat(64),
    generated_at: '2026-05-21T00:00:00Z',
    workspaces: ['engineering'],
    packs: [
        {
            id: 'engineering-base',
            version: '2.0.0',
            auto_selected: false,
            required_by: [],
        },
    ],
    files: [
        {
            path: '.augment/skills/laravel/SKILL.md',
            pack: 'laravel',
            pack_version: '2.0.0',
            sha256: 'b'.repeat(64),
            manifest_sha256: 'a'.repeat(64),
            managed: true,
        },
    ],
};

describe('lockfile YAML round-trip', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'lockfile-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('serializes and parses back without loss', () => {
        const yaml = lockfileToYaml(sampleLockfile);
        const round = lockfileFromYaml(yaml);

        expect(round.schema_version).toBe(1);
        expect(round.agent_config_version).toBe('2.0.0');
        expect(round.packs).toHaveLength(1);
        expect(round.files[0]!.path).toBe('.augment/skills/laravel/SKILL.md');
        expect(round.files[0]!.managed).toBe(true);
    });

    it('readLockfile returns undefined when file does not exist', () => {
        const result = readLockfile(join(root, 'missing.yml'));
        expect(result).toBeUndefined();
    });

    it('readLockfile parses a file on disk', () => {
        const path = join(root, 'lock.yml');
        writeFileSync(path, lockfileToYaml(sampleLockfile));

        const loaded = readLockfile(path);
        expect(loaded).toBeDefined();
        expect(loaded?.agent_config_version).toBe('2.0.0');
    });

    it('rejects unknown schema_version', () => {
        const broken = { ...sampleLockfile, schema_version: 99 };
        const yaml = lockfileToYaml(broken as unknown as Lockfile);
        expect(() => lockfileFromYaml(yaml)).toThrow(LockfileParseError);
    });

    it('rejects non-string agent_config_version', () => {
        const yaml = lockfileToYaml({
            ...sampleLockfile,
            agent_config_version: 123 as unknown as string,
        });
        expect(() => lockfileFromYaml(yaml)).toThrow(LockfileParseError);
    });

    it('rejects when files field is not an array', () => {
        const yaml =
            'schema_version: 1\n' +
            'agent_config_version: "2.0.0"\n' +
            'manifest_sha256: "aaa"\n' +
            'generated_at: "2026-05-21T00:00:00Z"\n' +
            'workspaces: []\n' +
            'packs: []\n' +
            'files: "not-an-array"\n';
        expect(() => lockfileFromYaml(yaml)).toThrow(LockfileParseError);
    });

    it('rejects malformed YAML', () => {
        expect(() => lockfileFromYaml(': : :\n  - bad indent\n :')).toThrow(LockfileParseError);
    });
});

describe('overrides file', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'overrides-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('readOverrides returns empty structure when file is absent', () => {
        const result = readOverrides(join(root, 'missing.yml'));
        expect(result.schema_version).toBe(1);
        expect(result.overrides).toEqual([]);
    });

    it('readOverrides parses a populated overrides file', () => {
        const yaml =
            'schema_version: 1\n' +
            'overrides:\n' +
            '  - path: agents/overrides/skills/laravel/SKILL.md\n' +
            '    shadows: .augment/skills/laravel/SKILL.md\n' +
            '    reason: "team-specific guidance"\n';
        const path = join(root, 'overrides.yml');
        writeFileSync(path, yaml);

        const result = readOverrides(path);
        expect(result.overrides).toHaveLength(1);
        expect(result.overrides[0]!.shadows).toBe('.augment/skills/laravel/SKILL.md');
    });

    it('rejects overrides with wrong schema_version', () => {
        const yaml = 'schema_version: 9\noverrides: []\n';
        const path = join(root, 'overrides.yml');
        writeFileSync(path, yaml);
        expect(() => readOverrides(path)).toThrow(OverridesParseError);
    });

    it('rejects overrides where overrides field is not array', () => {
        const yaml = 'schema_version: 1\noverrides: "nope"\n';
        const path = join(root, 'overrides.yml');
        writeFileSync(path, yaml);
        expect(() => readOverrides(path)).toThrow(OverridesParseError);
    });
});
