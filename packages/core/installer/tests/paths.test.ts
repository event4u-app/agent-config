/**
 * Tests for manifest → source/dest path mapping.
 */

import { describe, expect, it } from 'vitest';

import {
    CONSUMER_DEST_PREFIX,
    MANIFEST_SOURCE_PREFIX,
    UnknownManifestPathError,
    manifestToConsumerAbsolute,
    manifestToConsumerRelative,
    manifestToPackageSource,
    resolveArtefactPaths,
} from '../src/paths.js';

const MONOREPO_PREFIX = `packages/core/${MANIFEST_SOURCE_PREFIX}`;

describe('manifestToConsumerRelative', () => {
    it('swaps the manifest prefix to the consumer prefix (root layout)', () => {
        const manifestPath = `${MANIFEST_SOURCE_PREFIX}rules/foo.md`;
        expect(manifestToConsumerRelative(manifestPath)).toBe(`${CONSUMER_DEST_PREFIX}rules/foo.md`);
    });

    it('handles monorepo layout with packages/<pack>/ prefix', () => {
        const manifestPath = `${MONOREPO_PREFIX}rules/foo.md`;
        expect(manifestToConsumerRelative(manifestPath)).toBe(`${CONSUMER_DEST_PREFIX}rules/foo.md`);
    });

    it('throws on a path missing the source marker entirely', () => {
        expect(() => manifestToConsumerRelative('rules/foo.md')).toThrow(UnknownManifestPathError);
    });

    it('rejects mid-segment matches that are not real prefixes', () => {
        // Marker preceded by something other than '/' is a substring hit, not a prefix.
        expect(() =>
            manifestToConsumerRelative(`weird-.agent-src.uncompressed/rules/foo.md`),
        ).toThrow(UnknownManifestPathError);
    });
});

describe('manifestToConsumerAbsolute', () => {
    it('joins the project root with the swapped path (root layout)', () => {
        const out = manifestToConsumerAbsolute('/proj', `${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
        expect(out).toBe('/proj/.augment/rules/foo.md');
    });

    it('joins the project root with the swapped path (monorepo layout)', () => {
        const out = manifestToConsumerAbsolute('/proj', `${MONOREPO_PREFIX}rules/foo.md`);
        expect(out).toBe('/proj/.augment/rules/foo.md');
    });
});

describe('manifestToPackageSource', () => {
    it('joins the package root with the original manifest path (root layout)', () => {
        const out = manifestToPackageSource('/pkg', `${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
        expect(out).toBe(`/pkg/${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
    });

    it('preserves the packages/<pack>/ segment so monorepo source resolves', () => {
        const out = manifestToPackageSource('/repo', `${MONOREPO_PREFIX}rules/foo.md`);
        expect(out).toBe(`/repo/${MONOREPO_PREFIX}rules/foo.md`);
    });

    it('throws on missing marker', () => {
        expect(() => manifestToPackageSource('/pkg', 'rules/foo.md')).toThrow(UnknownManifestPathError);
    });
});

describe('resolveArtefactPaths', () => {
    it('returns all four anchors with the same input path (root layout)', () => {
        const manifestPath = `${MANIFEST_SOURCE_PREFIX}skills/x/SKILL.md`;
        const r = resolveArtefactPaths('/pkg', '/proj', manifestPath);
        expect(r.manifestPath).toBe(manifestPath);
        expect(r.sourceAbsolute).toBe(`/pkg/${MANIFEST_SOURCE_PREFIX}skills/x/SKILL.md`);
        expect(r.destAbsolute).toBe('/proj/.augment/skills/x/SKILL.md');
        expect(r.destRelative).toBe('.augment/skills/x/SKILL.md');
    });

    it('returns all four anchors with the same input path (monorepo layout)', () => {
        const manifestPath = `${MONOREPO_PREFIX}skills/x/SKILL.md`;
        const r = resolveArtefactPaths('/repo', '/proj', manifestPath);
        expect(r.manifestPath).toBe(manifestPath);
        expect(r.sourceAbsolute).toBe(`/repo/${MONOREPO_PREFIX}skills/x/SKILL.md`);
        expect(r.destAbsolute).toBe('/proj/.augment/skills/x/SKILL.md');
        expect(r.destRelative).toBe('.augment/skills/x/SKILL.md');
    });
});
