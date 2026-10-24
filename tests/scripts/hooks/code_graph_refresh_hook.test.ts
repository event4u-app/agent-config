import { execFileSync, type spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AUTO_REFRESH_REL, LOCK_REL, readRefreshRecords } from '../../../src/scripts/code_graph/refresh_lock.js';
import {
    CACHE_REL,
    REFRESH_ARGS,
    refreshFor,
    repoRoot,
    resolveCli,
} from '../../../src/scripts/hooks/code_graph_refresh_hook.js';

/**
 * A directory holding only `git`: the tests narrow PATH, the concern needs git to
 * check tracking, and the real git directory may also hold an installed agent-config.
 */
const GIT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-git-'));
fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf-8' }).trim(), path.join(GIT_DIR, 'git'));

let root: string;
let outside: string;
let savedPath: string | undefined;
let calls: { cmd: string; args: readonly string[]; opts: Record<string, unknown> }[];

/** Records the spawn instead of starting a process. */
const fakeSpawn = ((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
    calls.push({ cmd, args, opts });
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = () => {};
    return child;
}) as unknown as typeof spawn;

/** A CLI inside an installed-package layout; `capable` adds the file the single-flight refresh ships. */
function writeCli(dir: string, capable = true, version = '99.0.0'): string {
    const pkg = path.join(path.dirname(dir), 'pkg');
    fs.mkdirSync(path.join(pkg, 'dist', 'cli'), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version }));
    if (capable) {
        fs.mkdirSync(path.join(pkg, 'src', 'scripts', 'code_graph'), { recursive: true });
        fs.writeFileSync(path.join(pkg, 'src', 'scripts', 'code_graph', 'refresh_lock.ts'), '');
    }
    const real = path.join(pkg, 'dist', 'cli', 'agent-config.js');
    fs.writeFileSync(real, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    fs.mkdirSync(dir, { recursive: true });
    const cli = path.join(dir, 'agent-config');
    fs.symlinkSync(real, cli);
    return cli;
}

const git = (...a: string[]): void => {
    execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
};

/** An opted-in project with a locally built (untracked) cache and a trusted CLI on PATH. */
function optedIn(): string {
    fs.writeFileSync(path.join(root, CACHE_REL), '{}');
    fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
    const cli = writeCli(path.join(outside, 'bin'));
    process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
    return cli;
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-hook-')));
    outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-path-')));
    git('init', '-q');
    fs.writeFileSync(path.join(root, '.gitignore'), '/agents/runtime/\n');
    fs.mkdirSync(path.join(root, 'agents', 'runtime', 'state'), { recursive: true });
    calls = [];
    savedPath = process.env['PATH'];
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    process.env['PATH'] = savedPath;
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});

describe('which CLI may run, and what is recorded (PR #2604 review)', () => {
    it('refuses a global CLI too old for the single-flight refresh, and records why', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
        writeCli(path.join(outside, 'bin'), false, '17.0.0');
        process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
        expect(refreshFor(root, fakeSpawn)).toBe('cli-too-old');
        expect(calls).toEqual([]);
        const last = readRefreshRecords(root);
        expect(last['session-start']?.outcome).toBe('cli-too-old');
        expect(last['session-start']?.detail).toMatch(/agent-config$/);
    });

    it('records a spawn with the CLI and version it started', () => {
        optedIn();
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(readRefreshRecords(root)['session-start']?.detail).toMatch(/agent-config$/);
    });

    it('records no-cli instead of failing silently', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
        process.env['PATH'] = GIT_DIR;
        expect(refreshFor(root, fakeSpawn)).toBe('no-cli');
        expect(readRefreshRecords(root)['session-start']?.outcome).toBe('no-cli');
    });
});

describe('code-graph-refresh session concern', () => {
    it('spawns one detached single-flight refresh for an opted-in project', () => {
        const cli = optedIn();
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.cmd).toBe(cli);
        expect(calls[0]?.args).toEqual([...REFRESH_ARGS, '--root', root]);
        expect(calls[0]?.opts).toMatchObject({ cwd: root, detached: true, stdio: 'ignore' });
    });

    it('resolves the repository root from a subdirectory cwd', () => {
        optedIn();
        const sub = path.join(root, 'src', 'deep');
        fs.mkdirSync(sub, { recursive: true });
        expect(repoRoot(sub)).toBe(root);
        expect(refreshFor(sub, fakeSpawn)).toBe('spawned');
        expect(calls[0]?.opts['cwd']).toBe(root);
    });

    it('does nothing without the explicit opt-in, even with a cache', () => {
        optedIn();
        fs.rmSync(path.join(root, AUTO_REFRESH_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('not-opted-in');
        expect(calls).toHaveLength(0);
    });

    it('never builds a graph nobody asked for', () => {
        optedIn();
        fs.rmSync(path.join(root, CACHE_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('no-cache');
        expect(calls).toHaveLength(0);
    });

    it('refuses an opt-in and a cache the REPOSITORY committed', () => {
        optedIn();
        git('add', '-f', AUTO_REFRESH_REL, CACHE_REL);
        expect(refreshFor(root, fakeSpawn)).toBe('tracked');
        expect(calls).toHaveLength(0);
    });

    it('never executes an agent-config the repository ships', () => {
        optedIn();
        process.env['PATH'] = GIT_DIR;
        writeCli(root);
        writeCli(path.join(root, 'node_modules', '.bin'));
        expect(refreshFor(root, fakeSpawn)).toBe('no-cli');
        expect(calls).toHaveLength(0);
    });

    it('skips relative PATH entries and PATH dirs that resolve into the repository', () => {
        const repoBin = path.join(root, 'bin');
        writeCli(repoBin);
        const linkToRepoBin = path.join(outside, 'link');
        fs.symlinkSync(repoBin, linkToRepoBin);
        expect(resolveCli(root, ['bin', '.', linkToRepoBin, repoBin].join(path.delimiter))).toBeNull();
        const trusted = writeCli(path.join(outside, 'trusted'));
        expect(resolveCli(root, [repoBin, path.join(outside, 'trusted')].join(path.delimiter))).toBe(trusted);
    });

    it('refuses a PATH binary that is a symlink into the repository', () => {
        const planted = writeCli(path.join(root, 'tools'));
        const dir = path.join(outside, 'innocent');
        fs.mkdirSync(dir);
        fs.symlinkSync(planted, path.join(dir, 'agent-config'));
        expect(resolveCli(root, dir)).toBeNull();
    });

    it('never falls through an uninspectable level to an opted-in outer repository', () => {
        optedIn();
        // `inner` is a FILE, so inspecting `inner/.git` fails with ENOTDIR — an
        // error other than absence, and one that holds for root as well.
        const inner = path.join(root, 'vendor', 'inner');
        fs.mkdirSync(path.dirname(inner), { recursive: true });
        fs.writeFileSync(inner, '');
        expect(repoRoot(inner)).toBeNull();
        expect(refreshFor(inner, fakeSpawn)).toBe('not-opted-in');
        expect(calls).toHaveLength(0);
    });

    it('does not pile onto a refresh that already holds the lock', () => {
        optedIn();
        fs.mkdirSync(path.join(root, LOCK_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('locked');
        expect(calls).toHaveLength(0);
    });

    it('honours the kill switch', () => {
        optedIn();
        process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] = 'off';
        expect(refreshFor(root, fakeSpawn)).toBe('disabled');
        expect(calls).toHaveLength(0);
    });
});
