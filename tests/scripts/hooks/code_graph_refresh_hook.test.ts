import type { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCK_REL } from '../../../src/scripts/code_graph/refresh_lock.js';
import {
    CACHE_REL,
    REFRESH_ARGS,
    refreshFor,
    repoRoot,
    resolveCli,
} from '../../../src/scripts/hooks/code_graph_refresh_hook.js';

let root: string;
let calls: { cmd: string; args: readonly string[]; opts: Record<string, unknown> }[];

/** Records the spawn instead of starting a process. */
const fakeSpawn = ((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
    calls.push({ cmd, args, opts });
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = () => {};
    return child;
}) as unknown as typeof spawn;

function writeCli(dir: string): string {
    const cli = path.join(dir, 'agent-config');
    fs.writeFileSync(cli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    return cli;
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-hook-')));
    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, 'agents', 'runtime', 'state'), { recursive: true });
    calls = [];
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});

describe.skipIf(process.platform === 'win32')('code-graph-refresh session concern', () => {
    it('spawns one detached single-flight refresh when a cache exists', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        const cli = writeCli(root);
        expect(refreshFor(path.join(root), fakeSpawn)).toBe('spawned');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.cmd).toBe(cli);
        expect(calls[0]?.args).toEqual([...REFRESH_ARGS, '--root', root]);
        expect(calls[0]?.opts).toMatchObject({ cwd: root, detached: true, stdio: 'ignore' });
    });

    it('resolves the repository root from a subdirectory cwd', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        writeCli(root);
        const sub = path.join(root, 'src', 'deep');
        fs.mkdirSync(sub, { recursive: true });
        expect(repoRoot(sub)).toBe(root);
        expect(refreshFor(sub, fakeSpawn)).toBe('spawned');
        expect(calls[0]?.opts['cwd']).toBe(root);
    });

    it('never builds a graph nobody asked for', () => {
        writeCli(root);
        expect(refreshFor(root, fakeSpawn)).toBe('no-cache');
        expect(calls).toHaveLength(0);
    });

    it('does not pile onto a refresh that already holds the lock', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        writeCli(root);
        fs.mkdirSync(path.join(root, LOCK_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('locked');
        expect(calls).toHaveLength(0);
    });

    it('honours the kill switch', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        writeCli(root);
        process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] = 'off';
        expect(refreshFor(root, fakeSpawn)).toBe('disabled');
        expect(calls).toHaveLength(0);
    });

    it('does nothing when no CLI can be found', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        expect(resolveCli(root, '')).toBeNull();
    });

    it('prefers the project CLI, then node_modules/.bin, then PATH', () => {
        const bin = path.join(root, 'bin');
        fs.mkdirSync(bin);
        const onPath = writeCli(bin);
        expect(resolveCli(root, bin)).toBe(onPath);
        const nm = path.join(root, 'node_modules', '.bin');
        fs.mkdirSync(nm, { recursive: true });
        const local = writeCli(nm);
        expect(resolveCli(root, bin)).toBe(local);
        const own = writeCli(root);
        expect(resolveCli(root, bin)).toBe(own);
    });
});
