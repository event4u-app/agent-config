/**
 * The materialisation lock, and removal from it — the half of
 * `road-to-skills-that-arrive-when-called` 4.3/4.5 that the `session_start`
 * collect needs.
 *
 * WHY THIS IS ITS OWN FILE. 4.4 puts collection in the `session_start` read,
 * which runs inside the hook dispatcher bundle — a bundle with a measured
 * ceiling that every hook event on every host pays for. The materialiser
 * reaches the staged runtime and the host built-in table, so importing it from
 * a hook would carry both into that bundle. Splitting the lock out keeps ONE
 * reader of the lock format (a second reader written "just for the hook" is how
 * two formats drift apart) while the writer-side machinery — payload
 * inspection, hashing, placement — stays out of the bundle entirely.
 *
 * Imports are `node:fs`, `node:path` and the atomic write, all of which the
 * bundle already carries.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile } from '../../install/atomic.js';

export const LOCK_BASENAME = 'materialised-skills.json';
export const STORE_DIRNAME = 'materialised';

export interface LockEntry {
    host: string;
    name: string;
    /** The host skills root the symlink was placed under. */
    root: string;
    /** Content hash of the projected folder. */
    sha256: string;
}

export interface Lock {
    schema_version: 1;
    entries: LockEntry[];
}

export function sortEntries(entries: readonly LockEntry[]): LockEntry[] {
    return [...entries].sort((a, b) =>
        a.root === b.root ? (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : a.root < b.root ? -1 : 1,
    );
}

export function loadLock(file: string): Lock {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<Lock>;
        if (!data || !Array.isArray(data.entries)) return { schema_version: 1, entries: [] };
        const entries = data.entries.filter(
            (e): e is LockEntry =>
                !!e && typeof e.host === 'string' && typeof e.name === 'string' &&
                typeof e.root === 'string' && typeof e.sha256 === 'string',
        );
        return { schema_version: 1, entries: sortEntries(entries) };
    } catch {
        return { schema_version: 1, entries: [] };
    }
}

export function saveLock(file: string, lock: Lock): void {
    if (lock.entries.length === 0) {
        fs.rmSync(file, { force: true });
        return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    atomicWriteFile(file, `${JSON.stringify({ schema_version: 1, entries: sortEntries(lock.entries) }, null, 2)}\n`);
}

/** Names this lock holds for one host root. */
export function materialisedNames(lockFile: string, hostSkillsRoot: string): string[] {
    const want = path.resolve(hostSkillsRoot);
    return loadLock(lockFile)
        .entries.filter((e) => path.resolve(e.root) === want)
        .map((e) => e.name)
        .sort();
}

export interface ReleaseResult {
    removed: string[];
    /** Entries the lock names whose host side is not our link — left in place. */
    kept_foreign: string[];
}

/**
 * Remove exactly the named entries, and only when the lock claims them.
 *
 * The host link goes first and the store second, which is the order 0.2 (b)
 * makes safe: a live session that already resolved the skill keeps working
 * while its target exists, so a collection that loses a race degrades to a
 * listing change rather than to a broken session.
 */
export function release(
    lockFile: string,
    hostSkillsRoot: string,
    names: Iterable<string>,
    storeDir: string = path.join(path.dirname(lockFile), STORE_DIRNAME),
): ReleaseResult {
    const lock = loadLock(lockFile);
    const want = new Set(names);
    const root = path.resolve(hostSkillsRoot);
    const result: ReleaseResult = { removed: [], kept_foreign: [] };
    const keep: LockEntry[] = [];
    for (const e of lock.entries) {
        if (path.resolve(e.root) !== root || !want.has(e.name)) {
            keep.push(e);
            continue;
        }
        const dest = path.join(e.root, e.name);
        let ours = true;
        try {
            // Only a symlink this package placed is ours to remove. A real
            // directory under the same name is somebody else's, and the lock
            // being stale does not make it ours.
            ours = fs.lstatSync(dest).isSymbolicLink();
        } catch {
            ours = true; // already gone; dropping the row is the repair
        }
        if (!ours) {
            result.kept_foreign.push(e.name);
            keep.push(e);
            continue;
        }
        try {
            fs.rmSync(dest, { force: true });
            fs.rmSync(path.join(storeDir, e.host, e.name), { recursive: true, force: true });
        } catch {
            /* a vanished entry is the state we wanted */
        }
        result.removed.push(e.name);
    }
    saveLock(lockFile, { schema_version: 1, entries: keep });
    result.removed.sort();
    result.kept_foreign.sort();
    return result;
}
