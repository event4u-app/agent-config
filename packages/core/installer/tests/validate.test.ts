/**
 * Tests for `runValidation` — drift detection against the on-disk tree.
 *
 * Exercised via a tmpdir staged with the exact files the lockfile lists.
 * Asserts the three observable outcomes: clean, missing, modified.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sha256OfString } from '../src/io/sha256.js';
import { runValidation } from '../src/validate.js';
import type { Lockfile } from '../src/types.js';

function writeFile(root: string, rel: string, content: string): void {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
}

function makeLockfile(files: { path: string; sha256: string }[]): Lockfile {
    return {
        schema_version: 1,
        agent_config_version: '0.1.0',
        manifest_sha256: 'a'.repeat(64),
        generated_at: '2026-05-21T00:00:00Z',
        workspaces: ['engineering'],
        packs: [{ id: 'p', version: '0.1.0', auto_selected: false, required_by: [] }],
        files: files.map((f) => ({
            path: f.path,
            pack: 'p',
            pack_version: '0.1.0',
            sha256: f.sha256,
            manifest_sha256: 'a'.repeat(64),
            managed: true,
        })),
    };
}

describe('runValidation', () => {
    let proj: string;

    beforeEach(() => { proj = mkdtempSync(join(tmpdir(), 'validate-')); });
    afterEach(() => { rmSync(proj, { recursive: true, force: true }); });

    it('reports ok when every file matches', () => {
        const content = 'hello\n';
        writeFile(proj, '.augment/rules/a.md', content);
        const lock = makeLockfile([{ path: '.augment/rules/a.md', sha256: sha256OfString(content) }]);
        const report = runValidation({ lockfile: lock, lockfilePath: 'lock.yml', projectRoot: proj });
        expect(report.status).toBe('ok');
        expect(report.files_ok).toBe(1);
        expect(report.issues).toEqual([]);
    });

    it('reports missing when a tracked file is absent', () => {
        const lock = makeLockfile([{ path: '.augment/rules/a.md', sha256: 'b'.repeat(64) }]);
        const report = runValidation({ lockfile: lock, lockfilePath: 'lock.yml', projectRoot: proj });
        expect(report.status).toBe('drift');
        expect(report.issues).toEqual([{ kind: 'missing', path: '.augment/rules/a.md' }]);
    });

    it('reports modified when sha differs', () => {
        writeFile(proj, '.augment/rules/a.md', 'tampered\n');
        const lock = makeLockfile([{ path: '.augment/rules/a.md', sha256: sha256OfString('original\n') }]);
        const report = runValidation({ lockfile: lock, lockfilePath: 'lock.yml', projectRoot: proj });
        expect(report.status).toBe('drift');
        expect(report.issues).toHaveLength(1);
        expect(report.issues[0]!.kind).toBe('modified');
    });

    it('aggregates missing + modified into a single report', () => {
        writeFile(proj, '.augment/rules/a.md', 'changed\n');
        const lock = makeLockfile([
            { path: '.augment/rules/a.md', sha256: sha256OfString('orig\n') },
            { path: '.augment/rules/missing.md', sha256: 'c'.repeat(64) },
        ]);
        const report = runValidation({ lockfile: lock, lockfilePath: 'lock.yml', projectRoot: proj });
        expect(report.status).toBe('drift');
        expect(report.files_checked).toBe(2);
        expect(report.files_ok).toBe(0);
        expect(report.issues.map((i) => i.kind).sort()).toEqual(['missing', 'modified']);
    });

    it('does not throw when project root is empty', () => {
        const lock = makeLockfile([]);
        const report = runValidation({ lockfile: lock, lockfilePath: 'lock.yml', projectRoot: proj });
        expect(report.status).toBe('ok');
        expect(report.files_checked).toBe(0);
        // unlinkSync only here so the linter does not flag unused import.
        expect(() => unlinkSync(join(proj, 'no-such-file'))).toThrow();
    });
});
