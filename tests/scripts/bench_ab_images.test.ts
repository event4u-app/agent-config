import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { build_images, parse_cli_version, read_images, type Exec } from '../../src/scripts/bench_ab_images.js';

interface Call {
    cmd: string;
    args: readonly string[];
}

/** A fake Docker/npm/git: answers each call by its first argument, writes the packed tarball. */
function fakeExec(cliOut: string, calls: Call[]): Exec {
    return (cmd, args) => {
        calls.push({ cmd, args });
        if (cmd === 'git') return { status: 0, stdout: args[0] === 'status' ? ' M src/x.ts\n' : 'abc1234def\n', stderr: '' };
        if (cmd === 'npm') {
            const dest = args[args.indexOf('--pack-destination') + 1] as string;
            fs.writeFileSync(path.join(dest, 'event4u-agent-config-9.9.9.tgz'), 'tgz');
            return { status: 0, stdout: 'event4u-agent-config-9.9.9.tgz\n', stderr: '' };
        }
        if (args[0] === 'image') {
            const tag = args[args.length - 1];
            return { status: 0, stdout: `sha256:${tag === 'bench-base' ? 'b'.repeat(64) : 'a'.repeat(64)}\n`, stderr: '' };
        }
        if (args[0] === 'run') return { status: 0, stdout: cliOut, stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
    };
}

describe('parse_cli_version', () => {
    it('reads the semver out of the CLI banner', () => {
        expect(parse_cli_version('2.1.316 (Claude Code)\n')).toBe('2.1.316');
    });
    it('returns null when no version is printed', () => {
        expect(parse_cli_version('command not found')).toBeNull();
    });
});

describe('build_images', () => {
    it('records both image ids, the CLI and the tree, and builds ac on top of base', () => {
        const calls: Call[] = [];
        const rec = build_images({ exec: fakeExec('2.1.316 (Claude Code)', calls), cli_version: '2.1.316', now: () => new Date('2026-11-05T00:00:00Z') });

        expect(rec.tree_sha).toBe('abc1234def');
        expect(rec.tree_dirty).toBe(true);
        expect(rec.cli_version).toBe('2.1.316');
        expect(rec.base.id).toBe(`sha256:${'b'.repeat(64)}`);
        expect(rec.ac.id).toBe(`sha256:${'a'.repeat(64)}`);
        const builds = calls.filter((c) => c.cmd === 'docker' && c.args[0] === 'build');
        expect(builds.map((b) => b.args[b.args.indexOf('-t') + 1])).toEqual(['bench-base', 'bench-ac']);
        expect(builds[0]?.args).toContain('CLAUDE_CLI_VERSION=2.1.316');
        expect(builds[1]?.args).toContain('BASE_IMAGE=bench-base');
    });

    it('refuses an image whose CLI is not the pinned version', () => {
        expect(() => build_images({ exec: fakeExec('2.1.318 (Claude Code)', []), cli_version: '2.1.316' })).toThrow(/runs CLI 2\.1\.318, expected 2\.1\.316/);
    });

    it('stops at the first failing step and names it', () => {
        const exec: Exec = (cmd) => (cmd === 'git' ? { status: 0, stdout: 'x', stderr: '' } : { status: 1, stdout: '', stderr: 'no space left' });
        expect(() => build_images({ exec })).toThrow(/npm pack .* failed \(exit 1\): no space left/);
    });
});

describe('read_images', () => {
    const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'images-'));

    it('names the build command when the file is missing', () => {
        expect(() => read_images(path.join(tmp(), 'images.json'))).toThrow(/bench_ab_images/);
    });

    it('rejects a record whose id is a tag rather than an image id', () => {
        const f = path.join(tmp(), 'images.json');
        fs.writeFileSync(f, JSON.stringify({ tree_sha: 'x', cli_version: '1', package_version: '1', base: { id: 'bench-base' }, ac: { id: `sha256:${'a'.repeat(64)}` } }));
        expect(() => read_images(f)).toThrow(/base\.id is not an image id/);
    });
});
