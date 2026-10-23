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
import { canonicalPath } from '../../src/install/loggedWrites.js';
import { sidecarPathFor } from '../../src/install/preserve.js';
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
            ownership: 'unknown',
            // Not ledger-listed, so not a migration candidate. Asserted
            // rather than omitted: a `toEqual` over the whole entry is the
            // thing that notices a field being added, and softening it to
            // `objectContaining` would trade that away.
            migration: false,
        });
    });

    // Phase 5.1 — three-state ownership instead of path membership.
    describe('recorded ownership', () => {
        it('drops a recorded-unchanged file even when the plan carries new bytes', () => {
            // A package upgrade: the planned bytes differ from the bytes we
            // recorded, and the file on disk still matches what we recorded.
            // Path membership could not see that; a digest can.
            const e = entry('a.md', 'planned-v2');
            writeFileSync(e.path, 'installed-v1');
            const p = plan({ claude: [e] });
            const recorded = new Map([[e.path, hex('installed-v1')]]);
            expect(computeConflicts(p, recorded)).toEqual([]);
        });

        it('REPORTS a managed file the user edited, which membership dropped', () => {
            const e = entry('a.md', 'planned');
            writeFileSync(e.path, 'user-edited');
            const p = plan({ claude: [e] }, { knownPaths: new Set([e.path]) });
            // Pre-hash answer for exactly this tree: silence.
            expect(computeConflicts(p, new Map())).toEqual([]);
            const recorded = new Map([[e.path, hex('installed-v1')]]);
            const conflicts = computeConflicts(p, recorded);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0]?.ownership).toBe('recorded-modified');
            expect(conflicts[0]?.existingSha256).toBe(hex('user-edited'));
        });

        it('does not over-fire: no recorded digest reproduces the membership answer', () => {
            const e = entry('a.md', 'planned');
            writeFileSync(e.path, 'on-disk');
            const known = plan({ claude: [e] }, { knownPaths: new Set([e.path]) });
            expect(computeConflicts(known, new Map())).toEqual([]);
            const foreign = plan({ claude: [e] });
            expect(computeConflicts(foreign, new Map())).toHaveLength(1);
            expect(computeConflicts(foreign, new Map())[0]?.ownership).toBe('unknown');
        });

        it('drops an unchanged file from an EMPTY-knownPaths caller — the live shape', () => {
            // `cmd_preflight` builds `knownPaths: new Set()`, so before the
            // digest every managed file whose planned bytes differed was a
            // finding, including a routine package upgrade. This is a
            // deliberate REDUCTION for a manifest-carrying tree; the
            // docstring's "reports exactly what it reported before" holds
            // only where no digest is recorded, and this pins both halves.
            const e = entry('a.md', 'planned-v2');
            writeFileSync(e.path, 'installed-v1');
            const p = plan({ claude: [e] });
            expect(computeConflicts(p, new Map())).toHaveLength(1);
            const recorded = new Map([[e.path, hex('installed-v1')]]);
            expect(computeConflicts(p, recorded)).toEqual([]);
        });

        it('drops a file recorded under its STAGED digest whose bytes the log records us writing', () => {
            // A preserving run records the target under the digest staged
            // beside it, so an untouched file reads as recorded-modified. The
            // log proves the bytes on disk are ours; anything else stays reported.
            const e = entry('a.md', 'planned-v2');
            writeFileSync(e.path, 'installed-v1');
            const p = plan({ claude: [e] });
            const recorded = new Map([
                [e.path, hex('planned-v2')],
                [sidecarPathFor(e.path), hex('planned-v2')],
            ]);
            const ours = new Map([[canonicalPath(e.path), new Set([hex('installed-v1')])]]);
            expect(computeConflicts(p, recorded, ours)).toEqual([]);
            const other = new Map([[canonicalPath(e.path), new Set([hex('installed-v0')])]]);
            expect(computeConflicts(p, recorded, other)[0]?.ownership).toBe('recorded-modified');
            const elsewhere = new Map([[canonicalPath(join(root, 'b.md')), new Set([hex('installed-v1')])]]);
            expect(computeConflicts(p, recorded, elsewhere)).toHaveLength(1);
        });

        it('keeps reporting a genuine edit even when the log matches its bytes', () => {
            // Recorded under bytes we WROTE (no staged sidecar): a user who
            // restored an older shipped version made an edit, logged or not.
            const e = entry('a.md', 'planned-v2');
            writeFileSync(e.path, 'installed-v1');
            const p = plan({ claude: [e] });
            const recorded = new Map([[e.path, hex('installed-v2')]]);
            const ours = new Map([[canonicalPath(e.path), new Set([hex('installed-v1')])]]);
            expect(computeConflicts(p, recorded, ours)[0]?.ownership).toBe('recorded-modified');
        });

        it('never opens the log for a file the record alone decides', () => {
            const unknown = entry('a.md', 'planned');
            writeFileSync(unknown.path, 'on-disk');
            const unchanged = entry('b.md', 'planned-v2');
            writeFileSync(unchanged.path, 'installed-v1');
            const p = plan({ claude: [unknown, unchanged] });
            const recorded = new Map([[unchanged.path, hex('installed-v1')]]);
            const untouchable = {
                get: () => {
                    throw new Error('log read');
                },
            } as unknown as Map<string, Set<string>>;
            expect(computeConflicts(p, recorded, untouchable).map((c) => c.path)).toEqual([unknown.path]);
        });

        it('does not over-fire: a bridge-shaped null digest stays unknown, not modified', () => {
            const e = entry('a.md', 'planned');
            writeFileSync(e.path, 'on-disk');
            const p = plan({ claude: [e] }, { knownPaths: new Set([e.path]) });
            const recorded = new Map<string, string | null>([[e.path, null]]);
            expect(computeConflicts(p, recorded)).toEqual([]);
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
            ownership: 'unknown',
            migration: false,
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

