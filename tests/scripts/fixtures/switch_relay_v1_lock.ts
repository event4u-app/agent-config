// The record lock of the version before tickets, kept verbatim from
// src/scripts/_lib/switch_relay.ts at d2475e82f8 (lines 35-37 and 254-292), so
// a test can run that version's whole acquire loop, stale break included,
// against a holder of this version. Do not edit it to match the current lock.
import * as fs from 'node:fs';
import * as path from 'node:path';

const LOCK_STALE_MS = 2000;
const LOCK_TRIES = 50;
const LOCK_WAIT_MS = 5;

function pause(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
 * had. The lock file carries a token of this holder, and only a holder whose
 * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
 * to have died and its lock is broken, and if it was only slow, its release
 * must not delete the lock its successor now holds.
 */
export function locked<T>(file: string, fn: () => T): { value: T } | null {
    const held = `${file}.lock`;
    const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < LOCK_TRIES; i++) {
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(held, token, { flag: 'wx', mode: 0o600 });
        } catch {
            try {
                if (Date.now() - fs.statSync(held).mtimeMs > LOCK_STALE_MS) fs.rmSync(held, { force: true });
            } catch {
                // released meanwhile
            }
            pause(LOCK_WAIT_MS);
            continue;
        }
        try {
            return { value: fn() };
        } finally {
            try {
                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
            } catch {
                // already gone
            }
        }
    }
    return null;
}
