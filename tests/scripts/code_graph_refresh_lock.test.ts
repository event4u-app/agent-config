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
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: deadPid(), started_at: Date.now(), nonce: 't' }));
        expect(isStale(lock)).toBe(true);
        expect(acquire(root)).not.toBeNull();
    });

    it('never reclaims a live owner, however old its lock', () => {
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(
            `${lock}.owner.json`,
            JSON.stringify({ pid: process.pid, started_at: Date.now() - 10 * STALE_LOCK_MS, nonce: 't' }),
        );
        expect(isStale(lock)).toBe(false);
        expect(acquire(root)).toBeNull();
    });

    it('a reclaimer overtaken after its stale check never deletes the successor’s lock', () => {
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: deadPid(), started_at: 0, nonce: 'stale' }));
        let releaseA: (() => void) | null = null;
        // B judges the lock stale; before it acts, A reclaims it and holds a live successor.
        const releaseB = acquire(root, () => {
            releaseA = acquire(root);
        });
        expect(releaseA).not.toBeNull();
        expect(releaseB).toBeNull();
        expect(fs.existsSync(lock)).toBe(true);
        expect(JSON.parse(fs.readFileSync(`${lock}.owner.json`, 'utf-8')).pid).toBe(process.pid);
        expect(fs.existsSync(`${lock}.reclaim`)).toBe(false);
        (releaseA as unknown as () => void)();
        expect(fs.existsSync(lock)).toBe(false);
    });

    it('a reclaimed holder releasing late does not delete its successor', () => {
        const releaseOld = acquire(root);
        // The old holder is presumed dead and its lock reclaimed by a successor.
        fs.writeFileSync(
            `${lock}.owner.json`,
            JSON.stringify({ pid: deadPid(), started_at: Date.now(), nonce: 'old-nonce-rewritten' }),
        );
        const releaseNew = acquire(root);
        expect(releaseNew).not.toBeNull();
        releaseOld?.();
        expect(fs.existsSync(lock)).toBe(true);
        expect(acquire(root)).toBeNull();
        releaseNew?.();
        expect(fs.existsSync(lock)).toBe(false);
    });

    it.skipIf(process.getuid?.() === 0)('never reclaims a lock whose owner record cannot be read', () => {
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: deadPid(), started_at: 0, nonce: 't' }));
        fs.chmodSync(`${lock}.owner.json`, 0o000);
        const old = (Date.now() - STALE_LOCK_MS - 1000) / 1000;
        fs.utimesSync(lock, old, old);
        try {
            expect(isStale(lock)).toBe(false);
            expect(acquire(root)).toBeNull();
            expect(fs.existsSync(lock)).toBe(true);
        } finally {
            fs.chmodSync(`${lock}.owner.json`, 0o644);
        }
    });

    it.skipIf(process.getuid?.() === 0)('never reclaims a lock that cannot be inspected', () => {
        fs.mkdirSync(lock, { recursive: true });
        const parent = path.dirname(lock);
        // Without search permission on its parent, the lock cannot be stat-ed (EACCES).
        fs.chmodSync(parent, 0o600);
        try {
            expect(isStale(lock)).toBe(false);
        } finally {
            fs.chmodSync(parent, 0o755);
        }
    });

    it('treats an owner-less lock (the git-hook block) by age alone', () => {
        fs.mkdirSync(lock, { recursive: true });
        expect(acquire(root)).toBeNull();
        const old = (Date.now() - STALE_LOCK_MS - 1000) / 1000;
        fs.utimesSync(lock, old, old);
        expect(acquire(root)).not.toBeNull();
    });
});
