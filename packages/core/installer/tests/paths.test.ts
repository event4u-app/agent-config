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

describe('manifestToConsumerRelative', () => {
    it('swaps the manifest prefix to the consumer prefix', () => {
        const manifestPath = `${MANIFEST_SOURCE_PREFIX}rules/foo.md`;
        expect(manifestToConsumerRelative(manifestPath)).toBe(`${CONSUMER_DEST_PREFIX}rules/foo.md`);
    });

    it('throws on a path missing the manifest prefix', () => {
        expect(() => manifestToConsumerRelative('rules/foo.md')).toThrow(UnknownManifestPathError);
    });
});

describe('manifestToConsumerAbsolute', () => {
    it('joins the project root with the swapped path', () => {
        const out = manifestToConsumerAbsolute('/proj', `${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
        expect(out).toBe('/proj/.augment/rules/foo.md');
    });
});

describe('manifestToPackageSource', () => {
    it('joins the package root with the original manifest path', () => {
        const out = manifestToPackageSource('/pkg', `${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
        expect(out).toBe(`/pkg/${MANIFEST_SOURCE_PREFIX}rules/foo.md`);
    });

    it('throws on missing prefix', () => {
        expect(() => manifestToPackageSource('/pkg', 'rules/foo.md')).toThrow(UnknownManifestPathError);
    });
});

describe('resolveArtefactPaths', () => {
    it('returns all four anchors with the same input path', () => {
        const manifestPath = `${MANIFEST_SOURCE_PREFIX}skills/x/SKILL.md`;
        const r = resolveArtefactPaths('/pkg', '/proj', manifestPath);
        expect(r.manifestPath).toBe(manifestPath);
        expect(r.sourceAbsolute).toBe(`/pkg/${MANIFEST_SOURCE_PREFIX}skills/x/SKILL.md`);
        expect(r.destAbsolute).toBe('/proj/.augment/skills/x/SKILL.md');
        expect(r.destRelative).toBe('.augment/skills/x/SKILL.md');
    });
});
