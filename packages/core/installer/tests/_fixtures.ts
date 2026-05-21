/**
 * Shared fixtures for installer unit tests. Pure data factories — every
 * test can mutate a returned manifest without leaking into siblings.
 */

import type {
    DiscoveryManifest,
    ManifestArtefact,
    ManifestPack,
    ManifestWorkspace,
} from '../src/types.js';

export function makeWorkspace(overrides: Partial<ManifestWorkspace> = {}): ManifestWorkspace {
    return {
        id: 'engineering',
        label: 'Engineering',
        description: 'Core engineering workspace',
        default_packs: ['engineering-base'],
        ...overrides,
    };
}

export function makePack(overrides: Partial<ManifestPack> = {}): ManifestPack {
    return {
        id: 'engineering-base',
        label: 'Engineering base',
        description: 'baseline rules',
        workspaces: ['engineering'],
        trust_level_default: 'core',
        artefact_count: 0,
        ...overrides,
    };
}

export function makeArtefact(overrides: Partial<ManifestArtefact> = {}): ManifestArtefact {
    return {
        path: '.agent-src.uncompressed/rules/example.md',
        category: 'rule',
        workspaces: ['engineering'],
        packs: ['engineering-base'],
        lifecycle: 'active',
        trust: { level: 'core', confidence: 'high', human_review_required: false },
        install: { default: true, removable: true },
        checksum: `sha256:${'b'.repeat(64)}`,
        ...overrides,
    };
}

export function makeManifest(overrides: Partial<DiscoveryManifest> = {}): DiscoveryManifest {
    return {
        version: 1,
        generated_at: '2026-05-21T00:00:00Z',
        scanner_version: '0123456789ab',
        checksum: `sha256:${'a'.repeat(64)}`,
        workspaces: [makeWorkspace()],
        packs: [makePack()],
        artefacts: [],
        unassigned: [],
        ...overrides,
    };
}
