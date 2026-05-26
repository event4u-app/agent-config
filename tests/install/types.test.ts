/**
 * Phase A1 type-only smoke tests for `src/install/types.ts`.
 *
 * These are compile-time checks dressed as runtime assertions: if the
 * type surface changes shape (a field is dropped, a literal is renamed,
 * a kind enum loses a member), the suite fails to compile and vitest
 * surfaces the error. The runtime assertions exist so vitest counts
 * them as executed tests and `--coverage` records the file.
 */

import { describe, expect, it } from 'vitest';

import type {
    ApplyResult,
    ConflictPolicy,
    ConflictStrategy,
    FileEntry,
    FileKind,
    InstallPlan,
    InstallTarget,
} from '../../src/install/types.js';
import { isEmptyPlan } from '../../src/install/plan.js';

describe('install/types — schema surface', () => {
    it('FileKind covers the three v2-manifest values', () => {
        const values: FileKind[] = ['deployed', 'marker', 'bridge'];
        expect(values).toHaveLength(3);
    });

    it('InstallTarget is global | project', () => {
        const values: InstallTarget[] = ['global', 'project'];
        expect(values).toEqual(['global', 'project']);
    });

    it('ConflictStrategy is skip | overwrite | surface-to-ui', () => {
        const values: ConflictStrategy[] = ['skip', 'overwrite', 'surface-to-ui'];
        expect(values).toHaveLength(3);
    });

    it('FileEntry round-trips a deployed entry with sha256', () => {
        const entry: FileEntry = {
            path: '/abs/path/file.md',
            kind: 'deployed',
            sha256: 'a'.repeat(64),
        };
        expect(entry.kind).toBe('deployed');
        expect(entry.sha256).toHaveLength(64);
    });

    it('FileEntry permits null sha256 for bridge entries', () => {
        const entry: FileEntry = {
            path: '/abs/path/bridge.json',
            kind: 'bridge',
            sha256: null,
        };
        expect(entry.sha256).toBeNull();
    });

    it('ConflictPolicy carries known paths + pointers + default strategy', () => {
        const policy: ConflictPolicy = {
            force: false,
            interactive: true,
            knownPaths: new Set(['/abs/known.md']),
            knownPointers: new Set(['claude/settings.json#/mcp']),
            defaultStrategy: 'skip',
        };
        expect(policy.knownPaths.has('/abs/known.md')).toBe(true);
        expect(policy.defaultStrategy).toBe('skip');
    });

    it('InstallPlan is version=2 and bundles per-tool files + policy', () => {
        const plan: InstallPlan = {
            version: 2,
            target: 'global',
            root: '/home/u/.event4u/agent-config',
            filesByTool: {},
            mergedKeysByTool: {},
            policy: {
                force: false,
                interactive: false,
                knownPaths: new Set(),
                knownPointers: new Set(),
                defaultStrategy: 'skip',
            },
        };
        expect(plan.version).toBe(2);
        expect(isEmptyPlan(plan)).toBe(true);
    });

    it('ApplyResult separates written / skipped / conflicts / errors', () => {
        const result: ApplyResult = {
            target: 'project',
            written: [],
            skipped: [],
            conflicts: [],
            errors: [],
        };
        expect(result.target).toBe('project');
    });
});

describe('install/plan — isEmptyPlan', () => {
    const basePolicy: ConflictPolicy = {
        force: false,
        interactive: false,
        knownPaths: new Set(),
        knownPointers: new Set(),
        defaultStrategy: 'skip',
    };

    it('returns true when no tool has files or merged keys', () => {
        const plan: InstallPlan = {
            version: 2,
            target: 'global',
            root: '/tmp/r',
            filesByTool: { claude: [] },
            mergedKeysByTool: {},
            policy: basePolicy,
        };
        expect(isEmptyPlan(plan)).toBe(true);
    });

    it('returns false when at least one tool has a file entry', () => {
        const plan: InstallPlan = {
            version: 2,
            target: 'global',
            root: '/tmp/r',
            filesByTool: {
                claude: [{ path: '/tmp/r/x.md', kind: 'deployed', sha256: null }],
            },
            mergedKeysByTool: {},
            policy: basePolicy,
        };
        expect(isEmptyPlan(plan)).toBe(false);
    });

    it('returns false when a tool has merged-key pointers', () => {
        const plan: InstallPlan = {
            version: 2,
            target: 'project',
            root: '/tmp/r',
            filesByTool: {},
            mergedKeysByTool: {
                claude: [{ file: 'settings.json', pointer: '/mcp' }],
            },
            policy: basePolicy,
        };
        expect(isEmptyPlan(plan)).toBe(false);
    });
});
