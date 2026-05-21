/**
 * Tests for `runPrune` — orphan detection inside the managed roots.
 *
 * Asserts: only `.augment/` and `.agent-src/` are scanned, the staging
 * dir is excluded, lockfile entries are never reported, and the result
 * is sorted deterministically.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPrune, MANAGED_ROOTS, PRUNE_EXCLUDES } from '../src/prune.js';
import type { Lockfile } from '../src/types.js';

function writeFile(root: string, rel: string): void {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, 'x');
}

function makeLockfile(paths: string[]): Lockfile {
    return {
        schema_version: 1,
        agent_config_version: '0.1.0',
        manifest_sha256: 'a'.repeat(64),
        generated_at: '2026-05-21T00:00:00Z',
        workspaces: ['engineering'],
        packs: [{ id: 'p', version: '0.1.0', auto_selected: false, required_by: [] }],
        files: paths.map((p) => ({
            path: p,
            pack: 'p',
            pack_version: '0.1.0',
            sha256: 'b'.repeat(64),
            manifest_sha256: 'a'.repeat(64),
            managed: true,
        })),
    };
}

describe('runPrune', () => {
    let proj: string;

    beforeEach(() => { proj = mkdtempSync(join(tmpdir(), 'prune-')); });
    afterEach(() => { rmSync(proj, { recursive: true, force: true }); });

    it('exposes the managed roots and excludes contract', () => {
        expect(MANAGED_ROOTS).toEqual(['.augment', '.agent-src']);
        expect(PRUNE_EXCLUDES).toContain('.augment/.agent-config-staging');
    });

    it('returns empty when managed roots do not exist', () => {
        const report = runPrune({ lockfile: makeLockfile([]), projectRoot: proj });
        expect(report.orphans).toEqual([]);
        expect(report.scanned).toBe(0);
    });

    it('flags files in .augment/ that are not in the lockfile', () => {
        writeFile(proj, '.augment/rules/tracked.md');
        writeFile(proj, '.augment/rules/orphan.md');
        const report = runPrune({
            lockfile: makeLockfile(['.augment/rules/tracked.md']),
            projectRoot: proj,
        });
        expect(report.orphans.map((o) => o.path)).toEqual(['.augment/rules/orphan.md']);
        expect(report.scanned).toBe(2);
        expect(report.managed).toBe(1);
    });

    it('scans .agent-src/ alongside .augment/', () => {
        writeFile(proj, '.agent-src/skills/a/SKILL.md');
        const report = runPrune({ lockfile: makeLockfile([]), projectRoot: proj });
        expect(report.orphans.map((o) => o.path)).toEqual(['.agent-src/skills/a/SKILL.md']);
    });

    it('never returns files under .augment/.agent-config-staging', () => {
        writeFile(proj, '.augment/.agent-config-staging/abc/x.tmp');
        writeFile(proj, '.augment/rules/orphan.md');
        const report = runPrune({ lockfile: makeLockfile([]), projectRoot: proj });
        expect(report.orphans.map((o) => o.path)).toEqual(['.augment/rules/orphan.md']);
    });

    it('returns orphans sorted by path for deterministic preview', () => {
        writeFile(proj, '.augment/rules/z.md');
        writeFile(proj, '.augment/rules/a.md');
        writeFile(proj, '.augment/rules/m.md');
        const report = runPrune({ lockfile: makeLockfile([]), projectRoot: proj });
        expect(report.orphans.map((o) => o.path)).toEqual([
            '.augment/rules/a.md',
            '.augment/rules/m.md',
            '.augment/rules/z.md',
        ]);
    });

    it('does not enumerate files outside the managed roots', () => {
        writeFile(proj, 'src/foo.ts');
        writeFile(proj, 'agents/overrides/x.md');
        const report = runPrune({ lockfile: makeLockfile([]), projectRoot: proj });
        expect(report.orphans).toEqual([]);
        expect(report.scanned).toBe(0);
    });
});
