import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCK_REL, STALE_LOCK_MS, acquire, isStale } from '../../src/scripts/code_graph/refresh_lock.js';

let root: string;
let lock: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-lock-'));
    lock = path.join(root, LOCK_REL);
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** A pid that existed and has exited, so `kill(pid, 0)` reports ESRCH. */
function deadPid(): number {
    const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
    return Number(r.stdout);
}

describe('refresh lock — single flight', () => {
    it('admits one holder and refuses a second until released', () => {
        const release = acquire(root);
        expect(release).not.toBeNull();
        expect(acquire(root)).toBeNull();
        release?.();
        expect(fs.existsSync(lock)).toBe(false);
        expect(acquire(root)).not.toBeNull();
    });

    it('keeps its owner record OUTSIDE the lock directory, so the shell `rmdir` can still clear it', () => {
        const release = acquire(root);
        expect(fs.readdirSync(lock)).toEqual([]);
        expect(fs.existsSync(`${lock}.owner.json`)).toBe(true);
        release?.();
        expect(fs.existsSync(`${lock}.owner.json`)).toBe(false);
    });

    it('reclaims a lock whose owner process is gone', () => {
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: deadPid(), started_at: Date.now() }));
        expect(isStale(lock)).toBe(true);
        expect(acquire(root)).not.toBeNull();
    });

    it('respects a live owner', () => {
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: process.pid, started_at: Date.now() }));
        expect(acquire(root)).toBeNull();
    });

    it('treats an owner-less lock (the git-hook block) by age alone', () => {
        fs.mkdirSync(lock, { recursive: true });
        expect(acquire(root)).toBeNull();
        const old = (Date.now() - STALE_LOCK_MS - 1000) / 1000;
        fs.utimesSync(lock, old, old);
        expect(acquire(root)).not.toBeNull();
    });
});
