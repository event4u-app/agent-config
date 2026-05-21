/**
 * Tests for `computeSyncPlan` + `executeSyncPlan` — the ADR-016 § 3
 * merge decision matrix.
 *
 * Each test maps to one row of the matrix:
 *   clean + identical            → noop
 *   clean + upstream changed     → update
 *   missing on disk + still upstream → recreate
 *   missing on disk + dropped    → remove
 *   on disk + not in upstream    → remove
 *   not in lockfile + upstream   → add
 *   drift + upstream identical   → drift-warn (non-blocking)
 *   drift + upstream changed     → conflict (blocks without --force)
 *   shadowed + upstream changed  → shadowed-update
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sha256OfString } from '../src/io/sha256.js';
import { resolvePacks } from '../src/resolver.js';
import {
    SyncConflictError,
    computeSyncPlan,
    executeSyncPlan,
} from '../src/sync.js';
import type { Lockfile, OverridesFile } from '../src/types.js';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

function writeSource(pkg: string, rel: string, content: string): void {
    const abs = join(pkg, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
}
function writeDest(proj: string, rel: string, content: string): void {
    const abs = join(proj, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
}

function makeLockfile(entries: { path: string; sha256: string }[]): Lockfile {
    return {
        schema_version: 1,
        agent_config_version: '0.1.0',
        manifest_sha256: 'a'.repeat(64),
        generated_at: '2026-05-21T00:00:00Z',
        workspaces: ['engineering'],
        packs: [{ id: 'a', version: '0.1.0', auto_selected: false, required_by: [] }],
        files: entries.map((e) => ({
            path: e.path,
            pack: 'a',
            pack_version: '0.1.0',
            sha256: e.sha256,
            manifest_sha256: 'a'.repeat(64),
            managed: true,
        })),
    };
}

const emptyOverrides: OverridesFile = { schema_version: 1, overrides: [] };

describe('computeSyncPlan', () => {
    let pkg: string;
    let proj: string;

    beforeEach(() => {
        pkg = mkdtempSync(join(tmpdir(), 'sync-pkg-'));
        proj = mkdtempSync(join(tmpdir(), 'sync-proj-'));
    });
    afterEach(() => {
        rmSync(pkg, { recursive: true, force: true });
        rmSync(proj, { recursive: true, force: true });
    });

    function setup(opts: { src: string; disk?: string; locked?: string }): {
        manifest: ReturnType<typeof makeManifest>;
        lock: Lockfile;
    } {
        writeSource(pkg, '.agent-src.uncompressed/rules/foo.md', opts.src);
        if (opts.disk !== undefined) writeDest(proj, '.augment/rules/foo.md', opts.disk);
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' })],
            artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
        });
        const lock = opts.locked === undefined
            ? makeLockfile([])
            : makeLockfile([{ path: '.augment/rules/foo.md', sha256: sha256OfString(opts.locked) }]);
        return { manifest, lock };
    }

    it('noop when disk + upstream both match the lockfile', () => {
        const body = 'hello\n';
        const { manifest, lock } = setup({ src: body, disk: body, locked: body });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions.map((a) => a.kind)).toEqual(['noop']);
        expect(plan.hasConflicts).toBe(false);
    });

    it('update when upstream changed and disk is clean', () => {
        const { manifest, lock } = setup({ src: 'new\n', disk: 'old\n', locked: 'old\n' });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions[0]!.kind).toBe('update');
    });

    it('add when upstream has a new file not in the lockfile', () => {
        const { manifest, lock } = setup({ src: 'new\n' });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions[0]!.kind).toBe('add');
    });

    it('recreate when locked file was deleted on disk but still upstream', () => {
        const { manifest, lock } = setup({ src: 'body\n', locked: 'body\n' });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions[0]!.kind).toBe('recreate');
    });

    it('drift-warn when disk diverged but upstream matches the lockfile', () => {
        const { manifest, lock } = setup({ src: 'body\n', disk: 'edited\n', locked: 'body\n' });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions[0]!.kind).toBe('drift-warn');
        expect(plan.hasConflicts).toBe(false);
        expect(plan.hasDrift).toBe(true);
    });

    it('conflict when disk diverged AND upstream changed', () => {
        const { manifest, lock } = setup({ src: 'new\n', disk: 'edited\n', locked: 'orig\n' });
        const plan = computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
        expect(plan.actions[0]!.kind).toBe('conflict');
        expect(plan.hasConflicts).toBe(true);
    });
});

describe('executeSyncPlan', () => {
    let pkg: string;
    let proj: string;

    beforeEach(() => {
        pkg = mkdtempSync(join(tmpdir(), 'sync-pkg-'));
        proj = mkdtempSync(join(tmpdir(), 'sync-proj-'));
    });
    afterEach(() => {
        rmSync(pkg, { recursive: true, force: true });
        rmSync(proj, { recursive: true, force: true });
    });

    function buildPlan(opts: { src: string; disk?: string; locked?: string }) {
        writeSource(pkg, '.agent-src.uncompressed/rules/foo.md', opts.src);
        if (opts.disk !== undefined) writeDest(proj, '.augment/rules/foo.md', opts.disk);
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' })],
            artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
        });
        const lock = opts.locked === undefined
            ? makeLockfile([])
            : makeLockfile([{ path: '.augment/rules/foo.md', sha256: sha256OfString(opts.locked) }]);
        return computeSyncPlan({
            manifest, manifestSha256: 'sha256:m', workspaces: ['engineering'],
            packs: resolvePacks(manifest, ['a']).packs, packageRoot: pkg, projectRoot: proj,
            lockfile: lock, overrides: emptyOverrides,
        });
    }

    it('writes update atomically and rewrites the lockfile', () => {
        const plan = buildPlan({ src: 'new\n', disk: 'old\n', locked: 'old\n' });
        const result = executeSyncPlan({
            plan, projectRoot: proj, manifestSha256: 'sha256:m',
            agentConfigVersion: '0.1.0', packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z',
        });
        expect(result.filesUpdated).toBe(1);
        expect(readFileSync(join(proj, '.augment/rules/foo.md'), 'utf8')).toBe('new\n');
        expect(existsSync(join(proj, 'agents/agent-config.lock.yml'))).toBe(true);
    });

    it('refuses to commit conflicts without --force', () => {
        const plan = buildPlan({ src: 'new\n', disk: 'edited\n', locked: 'orig\n' });
        expect(() => executeSyncPlan({
            plan, projectRoot: proj, manifestSha256: 'sha256:m',
            agentConfigVersion: '0.1.0', packVersion: '0.1.0',
        })).toThrow(SyncConflictError);
    });

    it('overwrites conflicts when --force is set', () => {
        const plan = buildPlan({ src: 'new\n', disk: 'edited\n', locked: 'orig\n' });
        const result = executeSyncPlan({
            plan, projectRoot: proj, manifestSha256: 'sha256:m',
            agentConfigVersion: '0.1.0', packVersion: '0.1.0', force: true,
            now: () => '2026-05-21T00:00:00Z',
        });
        expect(result.conflicts).toBe(1);
        expect(readFileSync(join(proj, '.augment/rules/foo.md'), 'utf8')).toBe('new\n');
    });

    it('dry-run leaves the project untouched', () => {
        const plan = buildPlan({ src: 'new\n', disk: 'old\n', locked: 'old\n' });
        executeSyncPlan({
            plan, projectRoot: proj, manifestSha256: 'sha256:m',
            agentConfigVersion: '0.1.0', packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z', dryRun: true,
        });
        expect(readFileSync(join(proj, '.augment/rules/foo.md'), 'utf8')).toBe('old\n');
        expect(existsSync(join(proj, 'agents/agent-config.lock.yml'))).toBe(false);
    });
});
