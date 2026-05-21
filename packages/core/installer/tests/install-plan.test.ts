/**
 * Tests for install-plan computation and execution.
 *
 * `computeInstallPlan` is exercised purely from in-memory fixtures.
 * `executeInstallPlan` is exercised against a tmpdir staged with real
 * source files; the dry-run path is asserted to leave the project untouched.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computeInstallPlan, executeInstallPlan } from '../src/install-plan.js';
import { LOCKFILE_NAME } from '../src/lockfile.js';
import { resolvePacks } from '../src/resolver.js';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

const packageRoot = '/pkg';
const projectRoot = '/proj';

describe('computeInstallPlan', () => {
    it('returns empty plan for empty pack set', () => {
        const manifest = makeManifest();
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: [],
            packageRoot,
            projectRoot,
        });
        expect(plan.files).toEqual([]);
        expect(plan.workspaces).toEqual(['engineering']);
    });

    it('maps each artefact to a single pack and is deterministic', () => {
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' }), makePack({ id: 'b' })],
            artefacts: [
                makeArtefact({ path: '.agent-src.uncompressed/rules/z.md', packs: ['a'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/a.md', packs: ['a', 'b'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/m.md', packs: ['b'] }),
            ],
        });
        const resolved = resolvePacks(manifest, ['a', 'b']);
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: resolved.packs,
            packageRoot,
            projectRoot,
        });
        expect(plan.files.map((f) => f.destRelative)).toEqual([
            '.augment/rules/a.md',
            '.augment/rules/m.md',
            '.augment/rules/z.md',
        ]);
        const aMd = plan.files.find((f) => f.destRelative === '.augment/rules/a.md');
        expect(aMd?.pack).toBe('a');
    });

    it('skips artefacts whose packs are not in the selection', () => {
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' }), makePack({ id: 'b' })],
            artefacts: [
                makeArtefact({ path: '.agent-src.uncompressed/rules/a.md', packs: ['a'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/b.md', packs: ['b'] }),
            ],
        });
        const resolved = resolvePacks(manifest, ['a']);
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: resolved.packs,
            packageRoot,
            projectRoot,
        });
        expect(plan.files.map((f) => f.destRelative)).toEqual(['.augment/rules/a.md']);
    });
});

describe('executeInstallPlan', () => {
    let pkg: string;
    let proj: string;

    beforeEach(() => {
        pkg = mkdtempSync(join(tmpdir(), 'installer-pkg-'));
        proj = mkdtempSync(join(tmpdir(), 'installer-proj-'));
    });

    afterEach(() => {
        rmSync(pkg, { recursive: true, force: true });
        rmSync(proj, { recursive: true, force: true });
    });

    function writeSource(manifestPath: string, content: string): void {
        const abs = join(pkg, manifestPath);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content);
    }

    it('writes files + lockfile atomically and is deterministic', () => {
        writeSource('.agent-src.uncompressed/rules/foo.md', 'foo body\n');
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' })],
            artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
        });
        const resolved = resolvePacks(manifest, ['a']);
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: resolved.packs,
            packageRoot: pkg,
            projectRoot: proj,
        });
        const result = executeInstallPlan({
            plan,
            projectRoot: proj,
            manifestSha256: 'sha256:deadbeef',
            agentConfigVersion: '0.1.0',
            packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z',
        });
        expect(result.filesWritten).toBe(1);
        expect(existsSync(join(proj, '.augment/rules/foo.md'))).toBe(true);
        expect(readFileSync(join(proj, '.augment/rules/foo.md'), 'utf8')).toBe('foo body\n');
        expect(existsSync(join(proj, LOCKFILE_NAME))).toBe(true);
        expect(result.lockfile.files[0]?.path).toBe('.augment/rules/foo.md');
        expect(result.lockfile.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('dry-run leaves the project untouched', () => {
        writeSource('.agent-src.uncompressed/rules/foo.md', 'foo body\n');
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' })],
            artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
        });
        const resolved = resolvePacks(manifest, ['a']);
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: resolved.packs,
            packageRoot: pkg,
            projectRoot: proj,
        });
        const result = executeInstallPlan({
            plan,
            projectRoot: proj,
            manifestSha256: 'sha256:deadbeef',
            agentConfigVersion: '0.1.0',
            packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z',
            dryRun: true,
        });
        expect(result.lockfile.files.length).toBe(1);
        expect(existsSync(join(proj, '.augment/rules/foo.md'))).toBe(false);
        expect(existsSync(join(proj, LOCKFILE_NAME))).toBe(false);
    });
});
