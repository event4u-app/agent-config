/**
 * Pre-flight validation stage — road-to-flow-learnings Phase 0.
 *
 * One negative fixture per probe: every check must go red when its
 * failure condition is seeded, and stay green on a clean fixture.
 */

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_DISK_FLOOR_BYTES,
    checkConflicts,
    checkDiskSpace,
    checkHostDetection,
    checkPermissions,
    hasBlockingFinding,
    runPreflight,
} from '../../src/install/preflight.js';
import type { PlanInputs } from '../../src/install/plan.js';
import type { ConflictPolicy } from '../../src/install/types.js';

const POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set<string>(),
    knownPointers: new Set<string>(),
    defaultStrategy: 'skip',
};

let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'preflight-'));
});

afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

function inputs(overrides: Partial<PlanInputs> = {}): PlanInputs {
    return {
        target: 'global',
        root: join(tmp, 'root'),
        sources: [],
        policy: POLICY,
        ...overrides,
    };
}

describe('checkPermissions', () => {
    it('is green when the target root is creatable under a writable parent', () => {
        expect(checkPermissions(inputs())).toEqual([]);
    });

    it('goes blocking when the nearest existing ancestor is not writable', () => {
        const locked = join(tmp, 'locked');
        mkdirSync(locked);
        chmodSync(locked, 0o555);
        try {
            const findings = checkPermissions(inputs({ root: join(locked, 'sub', 'root') }));
            expect(findings.some((f) => f.id === 'permissions' && f.severity === 'blocking')).toBe(
                true,
            );
        } finally {
            chmodSync(locked, 0o755);
        }
    });

    it('goes blocking when the target root exists as a file', () => {
        const asFile = join(tmp, 'root-as-file');
        writeFileSync(asFile, 'not a directory');
        const findings = checkPermissions(inputs({ root: asFile }));
        expect(findings.some((f) => f.severity === 'blocking')).toBe(true);
    });
});

describe('checkDiskSpace', () => {
    it('is green under the default floor on a normal tmpdir', () => {
        expect(checkDiskSpace(inputs())).toEqual([]);
    });

    it('goes blocking when the floor exceeds the volume size', () => {
        const findings = checkDiskSpace(inputs(), {
            diskFloorBytes: Number.MAX_SAFE_INTEGER,
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.id).toBe('disk-space');
        expect(findings[0]?.severity).toBe('blocking');
    });

    it('exports a sane default floor', () => {
        expect(DEFAULT_DISK_FLOOR_BYTES).toBe(50 * 1024 * 1024);
    });
});

describe('checkConflicts', () => {
    it('surfaces an existing divergent file as a warning finding', () => {
        const srcDir = join(tmp, 'src');
        const destDir = join(tmp, 'dest');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(destDir, { recursive: true });
        writeFileSync(join(srcDir, 'a.md'), 'planned content');
        writeFileSync(join(destDir, 'a.md'), 'pre-existing different content');
        const findings = checkConflicts(
            inputs({
                root: destDir,
                sources: [{ toolId: 'claude-code', srcDir, destDir, kind: 'deployed' }],
            }),
        );
        expect(findings.some((f) => f.id === 'conflicts' && f.severity === 'warning')).toBe(true);
    });

    it('is green when destination is empty', () => {
        const srcDir = join(tmp, 'src');
        mkdirSync(srcDir, { recursive: true });
        writeFileSync(join(srcDir, 'a.md'), 'planned content');
        const findings = checkConflicts(
            inputs({
                sources: [
                    { toolId: 'claude-code', srcDir, destDir: join(tmp, 'empty-dest'), kind: 'deployed' },
                ],
            }),
        );
        expect(findings).toEqual([]);
    });
});

describe('checkHostDetection', () => {
    it('reports detected surfaces as info', () => {
        const root = join(tmp, 'proj');
        mkdirSync(join(root, '.claude'), { recursive: true });
        const findings = checkHostDetection(inputs({ root }));
        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe('info');
        expect(findings[0]?.message).toContain('claude');
    });

    it('never blocks on an empty target (first install is legitimate)', () => {
        const findings = checkHostDetection(inputs({ root: join(tmp, 'nothing-here') }));
        expect(findings.every((f) => f.severity === 'info')).toBe(true);
    });
});

describe('runPreflight + hasBlockingFinding', () => {
    it('aggregates probes in stable order and exposes the blocking contract', () => {
        const findings = runPreflight(inputs());
        // Clean fixture: only the host-detection info line survives.
        expect(findings.filter((f) => f.severity === 'blocking')).toEqual([]);
        expect(hasBlockingFinding(findings)).toBe(false);
    });

    it('flags blocking on a seeded permission conflict (the --validate-only contract)', () => {
        const locked = join(tmp, 'locked');
        mkdirSync(locked);
        chmodSync(locked, 0o555);
        try {
            const findings = runPreflight(inputs({ root: join(locked, 'root') }));
            expect(hasBlockingFinding(findings)).toBe(true);
        } finally {
            chmodSync(locked, 0o755);
        }
    });
});
