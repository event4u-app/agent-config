/**
 * Tests for the IO primitives: sha256 + atomic staging writes.
 *
 * Atomic-write asserts the stage → commit dance, the abort path, and
 * the `ensureWithinRoot` traversal guard (ADR-016 § 5).
 */

import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
    ensureWithinRoot,
    openStaging,
} from '../src/io/atomic-write.js';
import {
    sha256OfFile,
    sha256OfFileSync,
    sha256OfString,
} from '../src/io/sha256.js';

const KNOWN_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

describe('sha256 helpers', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'sha256-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('sha256OfString matches the documented hello hash', () => {
        expect(sha256OfString('hello')).toBe(KNOWN_HELLO);
    });

    it('sha256OfFileSync hashes the bytes on disk', () => {
        const path = join(root, 'hello.txt');
        writeFileSync(path, 'hello');
        expect(sha256OfFileSync(path)).toBe(KNOWN_HELLO);
    });

    it('sha256OfFile (streaming) matches the sync helper', async () => {
        const path = join(root, 'streaming.txt');
        writeFileSync(path, 'hello');
        await expect(sha256OfFile(path)).resolves.toBe(KNOWN_HELLO);
    });

    it('streaming hash rejects on missing files', async () => {
        await expect(sha256OfFile(join(root, 'does-not-exist'))).rejects.toBeTruthy();
    });
});

describe('atomic staging', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), 'staging-'));
        mkdirSync(join(projectRoot, '.augment'), { recursive: true });
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it('stages writes under .augment/.agent-config-staging/<uuid>/', () => {
        const session = openStaging({ projectRoot });
        const entry = session.stage('.augment/skills/x/SKILL.md', 'hello');

        expect(existsSync(entry.stagingPath)).toBe(true);
        expect(existsSync(entry.targetPath)).toBe(false);
        expect(entry.stagingPath).toContain('.agent-config-staging');
        session.abort();
    });

    it('commit renames every staged file into place and removes staging', () => {
        const session = openStaging({ projectRoot });
        session.stage('.augment/skills/x/SKILL.md', 'hello');
        session.stage('agents/agent-config.lock.yml', 'schema_version: 1\n');
        session.commit();

        expect(readFileSync(join(projectRoot, '.augment/skills/x/SKILL.md'), 'utf8')).toBe('hello');
        expect(readFileSync(join(projectRoot, 'agents/agent-config.lock.yml'), 'utf8')).toContain('schema_version');
        expect(existsSync(session.root)).toBe(false);
    });

    it('abort removes staging without touching the project', () => {
        const session = openStaging({ projectRoot });
        session.stage('.augment/skills/x/SKILL.md', 'hello');
        session.abort();

        expect(existsSync(session.root)).toBe(false);
        expect(existsSync(join(projectRoot, '.augment/skills/x/SKILL.md'))).toBe(false);
    });

    it('honours a custom stagingDir', () => {
        const customStaging = join(projectRoot, '.tmp-staging');
        const session = openStaging({ projectRoot, stagingDir: customStaging });
        expect(session.root.startsWith(customStaging)).toBe(true);
        session.abort();
    });
});

describe('ensureWithinRoot', () => {
    it('returns a relative path for in-tree targets', () => {
        const root = '/tmp/project';
        expect(ensureWithinRoot(root, '.augment/skills/x/SKILL.md')).toBe('.augment/skills/x/SKILL.md');
    });

    it('throws when target escapes via ..', () => {
        const root = '/tmp/project';
        expect(() => ensureWithinRoot(root, '../outside.txt')).toThrow(/refusing to write outside/);
    });
});
