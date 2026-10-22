/**
 * One lock file per roadmap slug — the exclusive half of a roadmap claim.
 *
 * The per-session claim file (`sessions:claim`) holds ONE slug per session and
 * reaches peers only when the next heartbeat lifts it into the register. Both
 * properties let two sessions build one roadmap on 2026-10-20 (#2533 / #2534,
 * ten conflicting files): an orchestrator running two lanes overwrote its first
 * claim with its second, and a claim written mid-turn was invisible to a peer
 * screening in that same turn.
 *
 * A lock fixes both without changing the claim file:
 *
 * - **Keyed by slug, not by session**, so one session can hold one lock per lane.
 * - **Created with `wx`**, so two sessions racing on one slug get one winner — an
 *   exclusive create, not an advisory read-then-write.
 * - **Read directly** from `<git-common-dir>/agent-claims/by-slug/`, shared by
 *   every worktree of the repo, so a peer sees it the moment it is written.
 * - **Carries the worktree and branch** the work happens in, so a killed holder —
 *   a session or a lane stopped by the spend limit — leaves the place its
 *   commits and uncommitted edits sit, and the next run continues there.
 *
 * Liveness is the holder's register record, never the lock's age: a live record
 * keeps the lock, an expired record frees it. A holder with no record at all (a
 * host without hooks, or a record pruned a day after expiry) holds the lock for
 * {@link UNRECORDED_HOLDER_MS} from its last write.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { git_common_dir } from './git_common_dir.js';
import { read_live_records, register_dir, safe_stem } from './session_register.js';

export const LOCK_DIRNAME = path.join('agent-claims', 'by-slug');

/** How long a lock whose holder never registered stays held. */
export const UNRECORDED_HOLDER_MS = 6 * 60 * 60 * 1000;

export interface SlugLock {
    slug: string;
    session_id: string | null;
    /** A lane lock is held for a subagent; its own session does not dispatch onto it. */
    lane: boolean;
    worktree: string;
    branch: string | null;
    written_at: string;
}

/** Liveness inputs, read once from the register by the caller. */
export interface HolderView {
    /** Session ids (as `safe_stem`) with a live register record. */
    live: ReadonlySet<string>;
    /** Session ids (as `safe_stem`) with any register record, live or expired. */
    known: ReadonlySet<string>;
}

/** Who is live and who is known, from the session register. */
export function read_holders(workspace_root: string, now: Date = new Date()): HolderView {
    const dir = register_dir(workspace_root);
    if (dir === null) return { live: new Set(), known: new Set() };
    const live = new Set(read_live_records(dir, { now }).map((r) => safe_stem(r.session_id)));
    let known = new Set<string>(live);
    try {
        known = new Set([
            ...live,
            ...fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)),
        ]);
    } catch {
        /* no register yet — nobody is known */
    }
    return { live, known };
}

export function lock_dir(workspace_root: string): string | null {
    const common = git_common_dir(workspace_root);
    return common === null ? null : path.join(common, LOCK_DIRNAME);
}

function lock_path(dir: string, slug: string): string {
    return path.join(dir, `${safe_stem(slug)}.json`);
}

function parse_lock(raw: string): SlugLock | null {
    try {
        const o = JSON.parse(raw) as Record<string, unknown>;
        if (typeof o['slug'] !== 'string' || typeof o['worktree'] !== 'string') return null;
        const sid = o['session_id'];
        const branch = o['branch'];
        return {
            slug: o['slug'],
            session_id: typeof sid === 'string' && sid !== '' ? sid : null,
            lane: o['lane'] === true,
            worktree: o['worktree'],
            branch: typeof branch === 'string' && branch !== '' ? branch : null,
            written_at: typeof o['written_at'] === 'string' ? o['written_at'] : '',
        };
    } catch {
        return null;
    }
}

export function read_locks(workspace_root: string): SlugLock[] {
    const dir = lock_dir(workspace_root);
    if (dir === null) return [];
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return [];
    }
    const out: SlugLock[] = [];
    for (const n of names.sort()) {
        try {
            const lock = parse_lock(fs.readFileSync(path.join(dir, n), 'utf-8'));
            if (lock !== null) out.push(lock);
        } catch {
            /* removed between readdir and read — not held */
        }
    }
    return out;
}

export function holder_is_live(lock: SlugLock, holders: HolderView, now: Date = new Date()): boolean {
    if (lock.session_id !== null) {
        const stem = safe_stem(lock.session_id);
        if (holders.live.has(stem)) return true;
        if (holders.known.has(stem)) return false;
    }
    const written = Date.parse(lock.written_at);
    return Number.isFinite(written) && now.getTime() - written < UNRECORDED_HOLDER_MS;
}

function same_holder(a: string | null, b: string | null, a_wt: string, b_wt: string): boolean {
    if (a !== null && b !== null) return safe_stem(a) === safe_stem(b);
    // No session id on either side: the worktree is the only identity there is.
    return a === null && b === null && path.resolve(a_wt) === path.resolve(b_wt);
}

export type AcquireResult =
    | { ok: true; lock: SlugLock; took_over: SlugLock | null }
    | { ok: false; holder: SlugLock };

/**
 * Take the lock for `lock.slug`. Refuses when a live different holder has it;
 * takes it over from a dead one and reports who that was. `force` takes it from
 * a live holder too.
 */
export function acquire_lock(
    workspace_root: string,
    lock: SlugLock,
    holders: HolderView,
    options: { force?: boolean; now?: Date } = {},
): AcquireResult {
    const dir = lock_dir(workspace_root);
    if (dir === null) return { ok: true, lock, took_over: null };
    fs.mkdirSync(dir, { recursive: true });
    const file = lock_path(dir, lock.slug);
    const body = `${JSON.stringify(lock, null, 2)}\n`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(file, body, { flag: 'wx' });
            return { ok: true, lock, took_over: null };
        } catch (exc) {
            if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') throw exc;
        }
        let existing: SlugLock | null = null;
        try {
            existing = parse_lock(fs.readFileSync(file, 'utf-8'));
        } catch {
            continue; // released between our create and our read — try the create again
        }
        if (
            existing === null ||
            same_holder(existing.session_id, lock.session_id, existing.worktree, lock.worktree)
        ) {
            write_atomic(file, body);
            return { ok: true, lock, took_over: null };
        }
        if (!options.force && holder_is_live(existing, holders, options.now)) {
            return { ok: false, holder: existing };
        }
        // Dead (or forced) holder. Move the file aside instead of unlinking it:
        // a rename is atomic, so of two takers only one moves it, and the mover
        // can check it moved the dead lock it read. If it moved a fresh lock a
        // faster taker had just created, that lock is put back with link(),
        // which never overwrites, and the fresh holder wins.
        const aside = `${file}.${process.pid}.${Date.now()}.taken`;
        try {
            fs.renameSync(file, aside);
        } catch {
            continue; // another taker moved it first: race for the create again
        }
        let moved: SlugLock | null = null;
        try {
            moved = parse_lock(fs.readFileSync(aside, 'utf-8'));
        } catch {
            moved = null;
        }
        if (moved !== null && JSON.stringify(moved) !== JSON.stringify(existing)) {
            try {
                fs.linkSync(aside, file);
            } catch {
                /* a third lock already stands there; it wins either way */
            }
            fs.rmSync(aside, { force: true });
            return { ok: false, holder: moved };
        }
        fs.rmSync(aside, { force: true });
        try {
            fs.writeFileSync(file, body, { flag: 'wx' });
            return { ok: true, lock, took_over: existing };
        } catch (exc) {
            if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') throw exc;
        }
    }
    let raw: string | null;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        raw = null; // released in the meantime: nobody holds it now, but this taker has not either
    }
    const winner = raw === null ? null : parse_lock(raw);
    if (winner !== null) return { ok: false, holder: winner };
    try {
        fs.writeFileSync(file, body, { flag: 'wx' });
        return { ok: true, lock, took_over: null };
    } catch {
        const now = parse_lock(fs.readFileSync(file, 'utf-8'));
        return now === null ? { ok: true, lock, took_over: null } : { ok: false, holder: now };
    }
}

/** Remove this holder's locks — one slug, or all of them. Returns the slugs released. */
export function release_locks(
    workspace_root: string,
    session_id: string | null,
    slug: string | null = null,
): string[] {
    const released: string[] = [];
    for (const l of read_locks(workspace_root)) {
        if (slug !== null && l.slug !== slug) continue;
        if (!same_holder(l.session_id, session_id, l.worktree, workspace_root)) continue;
        const dir = lock_dir(workspace_root);
        if (dir === null) break;
        try {
            fs.unlinkSync(lock_path(dir, l.slug));
            released.push(l.slug);
        } catch {
            /* already gone */
        }
    }
    return released;
}
