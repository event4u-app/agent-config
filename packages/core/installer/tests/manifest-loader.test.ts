/**
 * Tests for the discovery-manifest loader (ADR-015 contract).
 *
 * Asserts the schema_version gate, the structural shape check, and
 * the search-up-the-tree fallback used when the installer runs from
 * a subdirectory of the consumer project.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { loadManifest, ManifestNotFoundError, ManifestSchemaError } from '../src/manifest-loader.js';

const validManifest = {
    version: 1,
    generated_at: '2026-05-21T00:00:00Z',
    scanner_version: '0123456789ab',
    checksum: `sha256:${'a'.repeat(64)}`,
    workspaces: [
        { id: 'engineering', label: 'Engineering', description: 'eng', default_packs: ['engineering-base'] },
    ],
    packs: [
        {
            id: 'engineering-base',
            label: 'Engineering base',
            description: 'base',
            workspaces: ['engineering'],
            trust_level_default: 'core',
            artefact_count: 0,
        },
    ],
    artefacts: [],
    unassigned: [],
    stats: {
        total_artefacts: 0,
        by_category: { skill: 0, rule: 0, command: 0, template: 0 },
        by_lifecycle: { active: 0, experimental: 0, deprecated: 0, archived: 0 },
        by_trust_level: { core: 0, professional: 0, experimental: 0, advisory: 0, restricted: 0 },
    },
};

describe('loadManifest', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'manifest-loader-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('loads a valid manifest from the default search path', () => {
        const dir = join(root, 'dist', 'discovery');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'discovery-manifest.json'), JSON.stringify(validManifest));

        const result = loadManifest({ searchFrom: root });

        expect(result.manifest.version).toBe(1);
        expect(result.manifest.workspaces).toHaveLength(1);
        expect(result.path).toBe(join(dir, 'discovery-manifest.json'));
        expect(result.sha256).toHaveLength(64);
    });

    it('walks upward to find dist/discovery/discovery-manifest.json', () => {
        const distDir = join(root, 'dist', 'discovery');
        mkdirSync(distDir, { recursive: true });
        writeFileSync(join(distDir, 'discovery-manifest.json'), JSON.stringify(validManifest));

        const nested = join(root, 'a', 'b', 'c');
        mkdirSync(nested, { recursive: true });

        const result = loadManifest({ searchFrom: nested });
        expect(result.manifest.version).toBe(1);
    });

    it('throws ManifestNotFoundError when no manifest is anywhere', () => {
        expect(() => loadManifest({ searchFrom: root })).toThrow(ManifestNotFoundError);
    });

    it('throws ManifestSchemaError on unknown version', () => {
        const dir = join(root, 'dist', 'discovery');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'discovery-manifest.json'),
            JSON.stringify({ ...validManifest, version: 99 }),
        );

        expect(() => loadManifest({ searchFrom: root })).toThrow(ManifestSchemaError);
    });

    it('throws ManifestSchemaError when workspaces is missing', () => {
        const dir = join(root, 'dist', 'discovery');
        mkdirSync(dir, { recursive: true });
        const broken: Record<string, unknown> = { ...validManifest };
        delete broken.workspaces;
        writeFileSync(join(dir, 'discovery-manifest.json'), JSON.stringify(broken));

        expect(() => loadManifest({ searchFrom: root })).toThrow(ManifestSchemaError);
    });

    it('loads from an explicit path that bypasses the search', () => {
        const explicit = join(root, 'custom-manifest.json');
        writeFileSync(explicit, JSON.stringify(validManifest));

        const result = loadManifest({ searchFrom: root, path: explicit });
        expect(result.path).toBe(explicit);
    });
});
