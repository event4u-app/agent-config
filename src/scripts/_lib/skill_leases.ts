/**
 * Leases over materialised skills — `road-to-skills-that-arrive-when-called` 4.4.
 *
 * THE FAILURE THIS PREVENTS. The host's skill directory is machine-wide, so an
 * entry one session materialised is visible to every other session on the box.
 * 0.2 (b) measured what a removal does: a session that stayed live keeps
 * launching a skill whose symlink was removed, and stops the moment the TARGET
 * goes. So removing a materialised skill while another session is using it is a
 * real way to break that session, and K2 ("reset at session start") is killed
 * for exactly this reason.
 *
 * WHY A SECOND ROOT. `session_register` already keeps one record per session
 * with a heartbeat and a TTL — but its root is the git common dir, so it is
 * keyed by REPOSITORY. A materialised skill is not: it sits in a host config
 * root shared by every repository on the machine. A lease therefore lives under
 * the machine root, in a directory keyed by the host config root, so two host
 * profiles never collect each other's entries.
 *
 * WHAT IS REUSED RATHER THAN REBUILT. Liveness. `ttl_seconds_for` and
 * `is_expired` come from `session_register` unchanged, so a lease expires on the
 * same clock a session record does and a platform's measured TTL is stated in
 * one place. This file adds the keying and the collection, nothing about time.
 *
 * NOT ON `stop`. K3: `stop` fires every turn. Collection runs where the session
 * register is already read — see `session_register_hook`.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { is_expired, type SessionRecord } from './session_register.js';
import { LOCK_BASENAME, STORE_DIRNAME, materialisedNames, release } from './skill_materialisation_lock.js';
import { event4u_root, type EnvMap } from './user_global_paths.js';

export const LEASES_DIRNAME = 'skill-leases';

/** A lease: a session record plus the entries it holds open. */
export interface SkillLease extends SessionRecord {
    /** Host config root this lease is keyed under, for diagnosis. */
    host_root: string;
    /** Materialised skill names this session is holding. */
    names: string[];
}

/**
 * The lease directory for one host config root.
 *
 * Keyed by a digest of the resolved root rather than by its text, so a path with
 * a separator, a space or a non-ASCII character cannot become a second
 * directory level or collide with another root's name.
 */
export function leaseDir(hostRoot: string, env?: EnvMap | null): string {
    const key = createHash('sha256').update(path.resolve(hostRoot)).digest('hex').slice(0, 16);
    return path.join(event4u_root(env), LEASES_DIRNAME, key);
}

function leaseFile(dir: string, sessionId: string): string {
    return path.join(dir, `${createHash('sha256').update(sessionId).digest('hex').slice(0, 32)}.json`);
}

/** Write or refresh this session's lease. Returns false on any write failure. */
export function holdLease(dir: string, lease: SkillLease): boolean {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${leaseFile(dir, lease.session_id)}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify({ ...lease, names: [...lease.names].sort() }, null, 2)}\n`);
        fs.renameSync(tmp, leaseFile(dir, lease.session_id));
        return true;
    } catch {
        return false;
    }
}

/** Drop this session's lease. Returns false when there was nothing to drop. */
export function releaseLease(dir: string, sessionId: string): boolean {
    try {
        fs.rmSync(leaseFile(dir, sessionId), { force: true });
        return true;
    } catch {
        return false;
    }
}

export interface CollectResult {
    /** Lease files removed because their session's TTL had passed. */
    expired: string[];
    /** Names no live lease holds any more — the entries a caller may now remove. */
    releasable: string[];
    /** Names at least one live lease still holds. */
    held: string[];
}

/**
 * Read every lease under `dir`, drop the expired ones, and report which names
 * are still held.
 *
 * `known` is the set of materialised entries the caller owns. A name held by a
 * live lease is never releasable; a name in `known` that no live lease mentions
 * is. A name a lease mentions that the caller does not own is ignored — 4.5:
 * only its own entries.
 */
export function collectLeases(
    dir: string,
    known: Iterable<string>,
    now: Date = new Date(),
): CollectResult {
    const heldSet = new Set<string>();
    const expired: string[] = [];
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        names = [];
    }
    for (const file of names) {
        const full = path.join(dir, file);
        let rec: SkillLease | null = null;
        try {
            rec = JSON.parse(fs.readFileSync(full, 'utf-8')) as SkillLease;
        } catch {
            rec = null;
        }
        // An unreadable lease is an expired lease: `is_expired` treats an
        // unparseable stamp the same way, and a file nobody can read cannot
        // prove a session is alive.
        if (rec === null || typeof rec.last_seen !== 'string' || is_expired(rec, now)) {
            expired.push(file);
            try {
                fs.rmSync(full, { force: true });
            } catch {
                /* another session may have collected it first */
            }
            continue;
        }
        for (const n of Array.isArray(rec.names) ? rec.names : []) heldSet.add(n);
    }
    const releasable: string[] = [];
    const held: string[] = [];
    for (const n of new Set(known)) (heldSet.has(n) ? held : releasable).push(n);
    expired.sort();
    releasable.sort();
    held.sort();
    return { expired, releasable, held };
}

/**
 * The user-scope skills root per hook platform id.
 *
 * Only hosts whose pickup and removal behaviour 0.2 observed appear here, and
 * the gate checks the probe rows again before anything is placed — this map is
 * "where would it be", never "may it happen".
 */
export const PLATFORM_SKILLS_ROOT: Readonly<Record<string, string>> = {
    claude: path.join('.claude', 'skills'),
};

export interface CollectMaterialisedResult {
    released: string[];
    held: string[];
}

/**
 * The `session_start` collect — 4.4.
 *
 * Reads the lock for this host root, asks the leases which of those entries
 * nobody holds any more, and releases exactly those. Never removes an entry the
 * lock does not name (4.5), never runs on `stop` (K3), and needs no daemon (K9):
 * the slot it rides fires once per session and is already reading the session
 * register, so the whole cost is one directory scan.
 *
 * Returns `null` for a platform with no materialisation root, which is every
 * platform but the first host today.
 */
export function collectMaterialisedSkills(
    platform: string,
    opts: { home?: string; env?: EnvMap | null; now?: Date } = {},
): CollectMaterialisedResult | null {
    const rel = PLATFORM_SKILLS_ROOT[platform];
    if (rel === undefined) return null;
    const hostSkillsRoot = path.join(opts.home ?? os.homedir(), rel);
    const root = event4u_root(opts.env);
    const lockFile = path.join(root, LOCK_BASENAME);
    const known = materialisedNames(lockFile, hostSkillsRoot);
    if (known.length === 0) return { released: [], held: [] };
    const { releasable, held } = collectLeases(leaseDir(hostSkillsRoot, opts.env), known, opts.now ?? new Date());
    if (releasable.length === 0) return { released: [], held };
    const res = release(lockFile, hostSkillsRoot, releasable, path.join(root, STORE_DIRNAME));
    return { released: res.removed, held };
}

/** The names one session's lease currently holds, or null when it holds none. */
export function readLeaseNames(dir: string, sessionId: string): string[] | null {
    try {
        const rec = JSON.parse(fs.readFileSync(leaseFile(dir, sessionId), 'utf-8')) as SkillLease;
        return Array.isArray(rec.names) ? rec.names : null;
    } catch {
        return null;
    }
}
