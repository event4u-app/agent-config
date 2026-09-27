/**
 * Pre-flight validation stage — road-to-flow-learnings Phase 0.
 *
 * One negative fixture per probe: every check must go red when its
 * failure condition is seeded, and stay green on a clean fixture.
 */

import { createHash } from 'node:crypto';
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
import { SIDECAR_SUFFIX } from '../../src/install/preserve.js';
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

    // Findings 1-2 of the completion review: this branch shipped a remedy
    // saying "a default install leaves it alone", which the writer of the day
    // (src/scripts/install.ts::_resolve_file_conflict, unconditional `write`
    // for deployed files) contradicted.
    //
    // The owner ruling of 2026-09-21 inverted the premise: a `recorded-modified`
    // file IS now preserved and the package content staged as
    // `<path>.agent-config.new`. So the guard is inverted with it rather than
    // deleted — the defect class is "the remedy disagrees with the writer", and
    // that class is live in both directions. This arm must now STATE the
    // preservation; the `unknown` arm, where nothing is recorded and the writer
    // still overwrites, must still not claim it.
    it('the recorded-modified remedy states the preservation the writer performs', () => {
        const srcDir = join(tmp, 'src');
        const destDir = join(tmp, 'dest');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(destDir, { recursive: true });
        writeFileSync(join(srcDir, 'a.md'), 'planned content');
        const edited = 'the user edited this';
        writeFileSync(join(destDir, 'a.md'), edited);
        // A manifest recording a DIFFERENT digest for that path is what makes
        // the row `recorded-modified` — the branch whose remedy is under test.
        // Without it ownership is `unknown` and this fixture exercises the
        // wrong string, which is how the first version of this test passed a
        // sabotage probe.
        mkdirSync(join(destDir, 'agents'), { recursive: true });
        writeFileSync(
            join(destDir, 'agents', 'installed-tools.lock'),
            'schema_version: 2\ntools:\n  - name: claude\n    files:\n' +
                `      - path: a.md\n        kind: deployed\n        sha256: "${createHash('sha256').update('what we wrote').digest('hex')}"\n`,
        );
        const findings = checkConflicts(
            inputs({
                root: destDir,
                sources: [{ toolId: 'claude-code', srcDir, destDir, kind: 'deployed' }],
            }),
        );
        expect(findings.some((f) => /edited since we wrote it/.test(f.message))).toBe(true);
        const modified = findings.filter((f) => /edited since we wrote it/.test(f.message));
        for (const f of modified) {
            expect(f.remedy).toMatch(/preserv/i);
            // Naming the sidecar is what makes the remedy actionable: without
            // it the operator is told their edit survived and not where the
            // package content went.
            expect(f.remedy).toContain(SIDECAR_SUFFIX);
            expect(f.remedy).toContain('--force');
        }
    });

    it('the unknown-ownership remedy still does not claim an install preserves the file', () => {
        // No manifest at all, so every row is `unknown` — the writer overwrites
        // there exactly as before, and a remedy promising otherwise would be
        // the original defect with the polarity flipped.
        const srcDir = join(tmp, 'src');
        const destDir = join(tmp, 'dest');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(destDir, { recursive: true });
        writeFileSync(join(srcDir, 'a.md'), 'planned content');
        writeFileSync(join(destDir, 'a.md'), 'the user edited this');
        const findings = checkConflicts(
            inputs({
                root: destDir,
                sources: [{ toolId: 'claude-code', srcDir, destDir, kind: 'deployed' }],
            }),
        );
        expect(findings.length).toBeGreaterThan(0);
        for (const f of findings) {
            expect(f.remedy).not.toMatch(/leaves? it alone|survives?|untouched|is safe|preserv/i);
        }
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
