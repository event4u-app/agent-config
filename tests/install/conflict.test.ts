import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONFLICT_BATCH_THRESHOLD,
    computeConflicts,
    deepMerge,
    expandBatchChoice,
    isJsonTarget,
    mergeJsonContent,
    parseJsonLenient,
    resolveFileConflict,
} from '../../src/install/conflict.js';
import type {
    ConflictEntry,
    ConflictPolicy,
    FileEntry,
    InstallPlan,
} from '../../src/install/types.js';

function policy(overrides: Partial<ConflictPolicy> = {}): ConflictPolicy {
    return {
        force: false,
        interactive: false,
        knownPaths: new Set(),
        knownPointers: new Set(),
        defaultStrategy: 'skip',
        ...overrides,
    };
}

function hex(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function plan(
    filesByTool: Record<string, ReadonlyArray<FileEntry>>,
    policyOverrides: Partial<ConflictPolicy> = {},
    root = '/tmp',
): InstallPlan {
    return {
        version: 2,
        target: 'global',
        root,
        filesByTool,
        mergedKeysByTool: {},
        policy: policy(policyOverrides),
    };
}

describe('conflict — resolveFileConflict', () => {
    it('returns write when target does not exist', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: false,
            exists: false,
            policy: policy(),
        });
        expect(r).toBe('write');
    });

    it('returns skip when target is idempotent', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: true,
            exists: true,
            policy: policy(),
        });
        expect(r).toBe('skip');
    });

    it('returns skip when known path collides without force', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: false,
            exists: true,
            policy: policy({ knownPaths: new Set(['/x/a']) }),
        });
        expect(r).toBe('skip');
    });

    it('returns write when known path collides with force', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: false,
            exists: true,
            policy: policy({ knownPaths: new Set(['/x/a']), force: true }),
        });
        expect(r).toBe('write');
    });

    it('returns write when foreign path with force', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: false,
            exists: true,
            policy: policy({ force: true }),
        });
        expect(r).toBe('write');
    });

    it('returns surface when foreign path without force', () => {
        const r = resolveFileConflict({
            targetPath: '/x/a',
            idempotent: false,
            exists: true,
            policy: policy(),
        });
        expect(r).toBe('surface');
    });
});

describe('conflict — deepMerge', () => {
    it('overlay wins at leaves', () => {
        expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
    });

    it('recurses into nested objects', () => {
        expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 9, z: 3 } })).toEqual({
            a: { x: 1, y: 9, z: 3 },
        });
    });

    it('replaces arrays instead of concatenating (idempotency)', () => {
        expect(deepMerge({ hooks: [1, 2] }, { hooks: [3] })).toEqual({ hooks: [3] });
    });

    it('does not mutate inputs', () => {
        const base = { a: { x: 1 } };
        const overlay = { a: { y: 2 } };
        deepMerge(base, overlay);
        expect(base).toEqual({ a: { x: 1 } });
        expect(overlay).toEqual({ a: { y: 2 } });
    });

    it('handles null and primitive overlays', () => {
        expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null });
        expect(deepMerge({ a: { x: 1 } }, { a: 'replaced' })).toEqual({ a: 'replaced' });
    });
});

describe('conflict — mergeJsonContent / parseJsonLenient', () => {
    it('mergeJsonContent emits 4-space indented JSON with trailing newline', () => {
        const out = mergeJsonContent({ a: 1 }, { b: 2 });
        expect(out).toBe('{\n    "a": 1,\n    "b": 2\n}\n');
    });

    it('parseJsonLenient returns {} on invalid JSON', () => {
        expect(parseJsonLenient('not-json')).toEqual({});
    });

    it('parseJsonLenient returns {} on array root', () => {
        expect(parseJsonLenient('[1,2]')).toEqual({});
    });

    it('parseJsonLenient round-trips valid objects', () => {
        expect(parseJsonLenient('{"a":1}')).toEqual({ a: 1 });
    });
});

describe('conflict — isJsonTarget', () => {
    function entry(path: string, kind: FileEntry['kind'] = 'deployed'): FileEntry {
        return { path, kind, sha256: 'x' };
    }

    it('true for deployed .json', () => {
        expect(isJsonTarget(entry('/x/settings.json'))).toBe(true);
    });

    it('false for deployed .md', () => {
        expect(isJsonTarget(entry('/x/a.md'))).toBe(false);
    });

    it('false for bridge .json', () => {
        expect(isJsonTarget(entry('/x/b.json', 'bridge'))).toBe(false);
    });
});

describe('conflict — computeConflicts', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'conflict-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    function entry(
        relPath: string,
        plannedContent: string,
        kind: FileEntry['kind'] = 'deployed',
    ): FileEntry {
        return {
            path: join(root, relPath),
            kind,
            sha256: hex(plannedContent),
        };
    }

    it('returns empty when policy.force is true', () => {
        const e = entry('a.md', 'planned');
        writeFileSync(e.path, 'on-disk');
        const p = plan({ claude: [e] }, { force: true });
        expect(computeConflicts(p)).toEqual([]);
    });

    it('returns empty when target does not exist', () => {
        const e = entry('a.md', 'planned');
        const p = plan({ claude: [e] });
        expect(computeConflicts(p)).toEqual([]);
    });

    it('returns empty when on-disk bytes match planned sha', () => {
        const e = entry('a.md', 'planned');
        writeFileSync(e.path, 'planned');
        const p = plan({ claude: [e] });
        expect(computeConflicts(p)).toEqual([]);
    });

    it('returns empty when path is in policy.knownPaths', () => {
        const e = entry('a.md', 'planned');
        writeFileSync(e.path, 'on-disk');
        const p = plan(
            { claude: [e] },
            { knownPaths: new Set([e.path]) },
        );
        expect(computeConflicts(p)).toEqual([]);
    });

    it('skips bridges (sha is null, never own bytes)', () => {
        const bridgePath = join(root, '.cursorrules');
        writeFileSync(bridgePath, 'foreign');
        const e: FileEntry = { path: bridgePath, kind: 'bridge', sha256: null };
        const p = plan({ cursor: [e] });
        expect(computeConflicts(p)).toEqual([]);
    });

    it('surfaces foreign collision with byte mismatch', () => {
        const e = entry('a.md', 'planned');
        writeFileSync(e.path, 'on-disk');
        const p = plan({ claude: [e] });
        const conflicts = computeConflicts(p);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toEqual({
            path: e.path,
            kind: 'deployed',
            plannedSha256: hex('planned'),
            existingSha256: hex('on-disk'),
            mergeable: false,
        });
    });

    it('marks .json deployed targets as mergeable', () => {
        const e = entry('settings.json', '{"a":1}');
        writeFileSync(e.path, '{"b":2}');
        const p = plan({ claude: [e] });
        const conflicts = computeConflicts(p);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]?.mergeable).toBe(true);
    });

    it('collects conflicts across multiple tools', () => {
        const a = entry('a.md', 'p-a');
        const b = entry('b.md', 'p-b');
        writeFileSync(a.path, 'd-a');
        writeFileSync(b.path, 'd-b');
        const p = plan({ claude: [a], cursor: [b] });
        const paths = computeConflicts(p).map((c) => c.path).sort();
        expect(paths).toEqual([a.path, b.path].sort());
    });
});

describe('conflict — expandBatchChoice', () => {
    function ce(path: string, mergeable: boolean): ConflictEntry {
        return {
            path,
            kind: 'deployed',
            plannedSha256: 'p',
            existingSha256: 'e',
            mergeable,
        };
    }

    it('skip-all maps every entry to skip', () => {
        const out = expandBatchChoice([ce('/x/a', false), ce('/x/b.json', true)], 'skip-all');
        expect(out).toEqual({ '/x/a': 'skip', '/x/b.json': 'skip' });
    });

    it('overwrite-all maps every entry to overwrite', () => {
        const out = expandBatchChoice([ce('/x/a', false), ce('/x/b.json', true)], 'overwrite-all');
        expect(out).toEqual({ '/x/a': 'overwrite', '/x/b.json': 'overwrite' });
    });

    it('merge-json maps mergeable to merge and non-mergeable to skip', () => {
        const out = expandBatchChoice([ce('/x/a.md', false), ce('/x/b.json', true)], 'merge-json');
        expect(out).toEqual({ '/x/a.md': 'skip', '/x/b.json': 'merge' });
    });

    it('returns empty map for empty conflict list', () => {
        expect(expandBatchChoice([], 'skip-all')).toEqual({});
    });
});

describe('conflict — CONFLICT_BATCH_THRESHOLD', () => {
    it('exports the council Finding #19 threshold of 5', () => {
        expect(CONFLICT_BATCH_THRESHOLD).toBe(5);
    });
});

