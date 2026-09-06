/**
 * Shared per-session register — so a starting session can see that another
 * session is already live on this repo, on which branch, and on which roadmap.
 *
 * ## Where it lives, and why that needs no new machinery
 *
 * `<git-common-dir>/agent-sessions/<session_id>.json`. The common git directory
 * resolves to the **same** directory from every worktree of a repo, so the
 * register is shared by construction: no new directory to create, no sync step,
 * no generator, and never tracked by git. Resolution is
 * `_lib/git_common_dir.ts` — reused, not re-implemented, because a repo with two
 * different answers to "where is the common dir" is a bug waiting for a
 * symlinked parent.
 *
 * Runtime state under `agents/runtime/state/` cannot serve this purpose:
 * concerns run with `CWD = envelope.workspace_root`, so in a worktree that path
 * is the worktree's own. Measured 2026-08-07 — the main checkout's state
 * directory was populated and a fresh worktree's did not exist at all. Two
 * sessions in two worktrees share nothing there.
 *
 * ## One file per session — one writer each
 *
 * Each session owns exactly one file and is its only writer, so there is no
 * concurrent-write case to solve: atomicity comes from write-temp + rename
 * (`_lib/fs_atomic.ts`), the file never grows, compaction does not exist, the
 * reader does a `readdir` plus N small reads, and cleanup is an `unlink` of
 * expired files during the `session_start` read.
 *
 * The append-only JSONL alternative buys concurrency safety this layout does not
 * need and pays for it with unbounded growth (one record per turn per session
 * once heartbeating), a rotation problem (rotating under live appenders loses
 * heartbeats to the unlinked inode — the classic logrotate defect), and
 * fold-the-whole-file reads.
 *
 * ## Liveness is a heartbeat inside the record — never file mtime
 *
 * `last_seen` is rewritten every turn by a hook, and expiry compares that field.
 * File mtime is explicitly ruled out: `worktree_cleanup_check.ts:65-68` records
 * the failure — plain `git status` refreshes the on-disk index and bumps the very
 * mtime being read as liveness, which moved 10 worktrees from safe to live
 * between two consecutive runs. A field only this concern writes has no such
 * coupling.
 *
 * ## Two accepted limits — declared, not hidden
 *
 * 1. **Idle is indistinguishable from crashed.** A session left open over lunch
 *    stops heartbeating, expires, and releases its claim although the user
 *    returns. No hook-based heartbeat can tell that apart from a crash. This is
 *    accepted, and it belongs in user-facing documentation: walking away for
 *    longer than the TTL means another session may claim your branch.
 * 2. **This is advisory, not a mutex.** Two sessions can claim in the same
 *    millisecond. Nothing here provides exclusion, and no later feature may be
 *    built on it as if it did. `sessions:claim` refusing to WRITE a claim a peer
 *    holds is a consistency check on its own write, not exclusion: it protects
 *    the record from being false, never the peer from being duplicated.
 * 3. **The claim is per SESSION, and the bridge file has to be too.** The
 *    paragraph above rules `agents/runtime/state/` out for the register and the
 *    same argument applies to the claim that feeds it: one shared file per
 *    checkout means a second session in the same directory reads the first one's
 *    claim as its own. Measured — four live records carrying one identical,
 *    already-archived slug. The file is keyed on the host session id where one
 *    exists, and degrades to the shared path where none does.
 *
 * ## Failure is always open
 *
 * Every function here swallows its errors and degrades to "no register": a
 * session that cannot read or write it still starts, and behaves exactly as
 * sessions did before this existed.
 */

import fs from 'node:fs';
import path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { git_common_dir } from './git_common_dir.js';

/** Directory name under the common git dir. Never tracked; git ignores unknown
 *  directories inside `.git` by construction. */
export const REGISTER_DIRNAME = 'agent-sessions';

/**
 * Per-host TTL in seconds — how long a record may go without a heartbeat before
 * a reader treats the session as gone.
 *
 * **Derived from data for exactly one host, and honest about the rest.** The
 * chat-history corpus in this repo holds 71 records across 5 sessions over 24.5
 * hours, and every one of them is `claude`; 77 % of the gaps come from a single
 * session. The per-host split the design asked for is **not measurable** from
 * that, so no interpolated values are shipped for hosts nobody observed. Full
 * measurement record: `agents/evidence/analysis/parallel-session-register-phase1.md`.
 *
 * `claude` is taken from the **raw, unfiltered** p99 (13 705 s) and the raw
 * user→user max (14 199 s), rounded up to the next hour. Deliberately *not* the
 * idle-filtered p95: filtering gaps > 30 min characterises turn cadence
 * correctly and is wrong as an expiry basis, because those gaps occur **inside**
 * live sessions — 35 % of user→user gaps exceed 30 minutes while the session is
 * demonstrably still working. A TTL from the filtered p95 would expire a live
 * claim on roughly a third of turns, which is the collision this register exists
 * to prevent, re-created by its own mitigation.
 */
export const TTL_MEASURED_SECONDS: Readonly<Record<string, number>> = Object.freeze({
    claude: 14_400, // 4 h — raw p99 13 705 s / raw user→user max 14 199 s, rounded up
});

/**
 * TTL for a host with **no** measurements: `3 ×` the one measured p99.
 *
 * The name says `MEASURED` above and `DEFAULT` here on purpose (council
 * 2026-08-07, both members): a map holding one real entry plus a fallback is
 * honest only if it is *named* as that, rather than presented as a populated
 * per-host table. Six empty slots would be speculation wearing a data structure.
 *
 * The council also moved this number down from a proposed 24 h. The argument
 * against 24 h: the evidence for a wide spread is that the same host's raw p99
 * in another project corpus is 53 903 s, i.e. a 4× range — which does not
 * justify a 6× extrapolation, and a full day makes the register useless on an
 * unmeasured host, since a crashed session blocks a roadmap claim until
 * tomorrow. 12 h stays comfortably above every observed live-session gap while
 * keeping the claim recoverable within a working day.
 */
export const TTL_DEFAULT_SECONDS = 43_200; // 12 h

/**
 * Resolve the TTL for a record, from **the record's own platform** — never the
 * reader's. Session B on one host reading session A's record must apply A's
 * cadence, because the TTL describes how often A heartbeats.
 */
export function ttl_seconds_for(platform: string | null | undefined): number {
    const key = String(platform ?? '').trim().toLowerCase();
    return TTL_MEASURED_SECONDS[key] ?? TTL_DEFAULT_SECONDS;
}

/** True when this platform's TTL is a measured value rather than the fallback. */
export function ttl_is_measured(platform: string | null | undefined): boolean {
    const key = String(platform ?? '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(TTL_MEASURED_SECONDS, key);
}

/**
 * Platforms whose `stop` slot means **the task really ended**, so the register
 * entry is deleted there instead of merely refreshed.
 *
 * The general rule is the opposite and stays the default: `stop` is a *second
 * heartbeat carrier*, never a deregistration trigger, because on Claude Code the
 * native `Stop` fires after **every assistant reply** — deregistering there
 * would kill a live session's own record after its first reply.
 *
 * Cline is the one host where that reading is wrong. Its `stop` is mapped from
 * `TaskCancel` (`hook_manifest.yaml:473`) and is typed `per-event` rather than
 * `per-turn` (`_lib/obligation_frequency.ts:269-271`), while its `session_end`
 * is mapped from `TaskComplete` (`:472`). A **cancelled** Cline task therefore
 * reaches neither deregistration path and leaks its claim until the TTL — and
 * cancel-and-restart is a routine Cline workflow, not an edge case.
 *
 * **This is an explicit allow-list, not a computed condition** (council
 * 2026-08-07, both members). Deriving it from `slot_frequency(...) ===
 * 'per-event'` would mean a future platform silently acquires deregistration
 * behaviour the moment someone types it that way, in a code path where the
 * failure mode is "a live session deleted its own claim". A human adds a line
 * here, deliberately, or the platform keeps the safe default.
 *
 * The safety model is unchanged either way: TTL remains the correctness basis on
 * every platform including Cline. This only frees the claim sooner.
 */
export const DEREGISTER_ON_STOP_PLATFORMS: ReadonlySet<string> = new Set(['cline']);

/** True when `stop` on this platform means the task ended, not "a reply landed". */
export function stop_means_session_end(platform: string | null | undefined): boolean {
    return DEREGISTER_ON_STOP_PLATFORMS.has(String(platform ?? '').trim().toLowerCase());
}

/**
 * Platforms where a per-turn heartbeat actually fires today.
 *
 * Deliberately **not** derived from the frequency lattice. That instrument
 * models *slot presence*, and two hosts have a slot that never fires:
 *
 * - `cursor` — excluded because reachability there is UNESTABLISHED, not
 *   because it is known absent. The earlier wording asserted the CLI fires only
 *   shell-execution hooks, sourced to a 2026-01 reading that carried no expiry
 *   and could not be re-verified in either direction. The safe direction is the
 *   one taken: an unverified slot must not read as covered. The lattice has no
 *   IDE/CLI dimension of its own, so it would report cursor covered; the
 *   envelope now carries a `surface` field (`_lib/surface.ts`) that records
 *   which surface a dispatch came from, and it answers `unknown` on cursor
 *   because no marker distinguishes the two.
 * - `cowork` — slots are structurally wired but lifecycle events do not fire
 *   (`hook_manifest.yaml:346-351`).
 * - `copilot` — nothing bound by this package (`fallback_only: true` in the
 *   manifest), excluded from the join by declaration.
 *
 * A session on an excluded host still *registers* if a `session_start` reaches
 * it, and simply stops being visible after its TTL. It is never reported as
 * covered.
 */
export const HEARTBEAT_REACHABLE_PLATFORMS: ReadonlySet<string> = new Set([
    'claude',
    'augment', // post-reply `stop` only — sufficient for a liveness stamp
    'cline', // pre-reply `user_prompt_submit` only
    'windsurf',
    'gemini',
]);

/** One live session, as seen by every other session on the repo. */
export interface SessionRecord {
    /** Host-provided session id; also the filename stem. */
    session_id: string;
    /** Host platform — decides which TTL applies to THIS record. */
    platform: string;
    /** Absolute path of the worktree this session is working in. */
    worktree: string;
    /** Branch at the last heartbeat. Re-read every beat; sessions check out. */
    branch: string | null;
    /** Roadmap slug this session claims, or null when it has not picked one. */
    roadmap_slug: string | null;
    /** ISO-8601 UTC, set once at registration. */
    started_at: string;
    /** ISO-8601 UTC, rewritten every heartbeat. The liveness signal. */
    last_seen: string;
    /**
     * Per-detector turn-end refusals THIS session has taken, or absent when it
     * has taken none.
     *
     * `road-to-stop-gate-honesty` § D-2: the gate refuses turn-ends with "no
     * per-session visibility into how often it happens", and a refused turn-end
     * costs the user at least one extra model turn. The counts ride this
     * existing write — the reader is one small `readFileSync` of a record the
     * gate already maintains, so the heartbeat gains no spawn.
     *
     * Optional on purpose: a record written before this field existed, or by a
     * session that was never refused, is still a valid record.
     */
    turn_end_refusals?: Record<string, number>;
    /**
     * Repo-relative paths this session has declared it owns, or absent when it
     * has declared none.
     *
     * `road-to-roadmap-situational-awareness` § 3.1. The register compared slugs
     * and branch names and nothing else, so two sessions on two different
     * roadmaps that happen to edit the same file were invisible to each other —
     * the axis that actually predicts a merge conflict was the one axis nobody
     * carried.
     *
     * Additive on exactly the terms `turn_end_refusals` established: a session
     * that declared no paths leaves the record **byte-identical** to what it was
     * before this field existed, so a reader that does not know the field is
     * unaffected and a diff of two records still shows only what changed.
     */
    owned_paths?: string[];
}

/**
 * Filename-safe stem for a session id. Path separators and `..` collapse to `_`
 * so a hostile or merely odd id cannot escape the register directory — the same
 * traversal guard the dispatcher applies to its feedback directory.
 *
 * The fallback fires when the sanitised stem carries **no alphanumeric
 * character**, not merely when it is empty. `'///'` sanitises to `'___'`, which
 * is a legal filename and a useless one: it distinguishes nothing, so two
 * different odd session ids would silently share a record. Requiring one
 * alphanumeric makes the degenerate case land on the explicit marker instead.
 */
export function safe_stem(session_id: string): string {
    const collapsed = String(session_id ?? '')
        .replace(/\.\./g, '_')
        .replace(/[/\\]/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .slice(0, 128);
    return /[A-Za-z0-9]/.test(collapsed) ? collapsed : 'unknown-session';
}

/**
 * The register directory for a workspace, or `null` when there is no git common
 * dir to anchor it to. Does **not** create the directory — writers do.
 */
export function register_dir(workspace_root: string): string | null {
    const common = git_common_dir(workspace_root);
    return common === null ? null : path.join(common, REGISTER_DIRNAME);
}

/** ISO-8601 UTC at seconds precision, matching the chat-history stamp format. */
export function iso_now(now: Date = new Date()): string {
    return now.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/** Parse an ISO stamp to epoch ms; `null` when unparseable. */
function epoch_ms(stamp: string | null | undefined): number | null {
    if (typeof stamp !== 'string' || stamp.length === 0) return null;
    const ms = Date.parse(stamp);
    return Number.isFinite(ms) ? ms : null;
}

/** True when `rec` has not been heard from within its own platform's TTL. */
export function is_expired(rec: SessionRecord, now: Date = new Date()): boolean {
    const seen = epoch_ms(rec.last_seen);
    if (seen === null) return true; // unreadable stamp → not evidence of life
    const age_s = (now.getTime() - seen) / 1000;
    return age_s > ttl_seconds_for(rec.platform);
}

function is_record(v: unknown): v is SessionRecord {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o['session_id'] === 'string' && typeof o['last_seen'] === 'string';
}

/**
 * Write (or overwrite) this session's own record. Returns `true` on success.
 * Never throws — a session that cannot write the register still starts.
 */
export function write_record(dir: string, rec: SessionRecord): boolean {
    try {
        const target = path.join(dir, `${safe_stem(rec.session_id)}.json`);
        write_atomic(target, `${JSON.stringify(rec, null, 2)}\n`);
        return true;
    } catch {
        return false;
    }
}

/** Read this session's own record back, or `null` when it is absent/unreadable. */
export function read_own_record(dir: string, session_id: string): SessionRecord | null {
    try {
        const target = path.join(dir, `${safe_stem(session_id)}.json`);
        const parsed: unknown = JSON.parse(fs.readFileSync(target, 'utf-8'));
        return is_record(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Remove this session's own record. Best-effort; a failure is not an error. */
export function delete_record(dir: string, session_id: string): boolean {
    try {
        fs.unlinkSync(path.join(dir, `${safe_stem(session_id)}.json`));
        return true;
    } catch {
        return false;
    }
}

export interface ReadLiveOptions {
    /** Unlink expired records as they are encountered. Default `false`. */
    prune?: boolean;
    /**
     * How long an EXPIRED record survives the prune. Default 24 h.
     *
     * R2 round 4, finding 5. The register has two consumers with opposite
     * needs and only one of them knew: `sessions:list` and the session-start
     * hook both read with `prune: true`, while `run:supervise` exists
     * ENTIRELY to classify expired records — the runs whose session died. So
     * the watcher's whole input was deleted by two routine read paths, the
     * hook one of them, which fires on every session start. The digest could
     * then report nothing, and round 3's `clearCompleted` release could never
     * fire because no completed candidate ever reached it.
     *
     * The 24 h is derived, not picked: `digest` is documented as the MORNING
     * report, so a once-a-day reader must be able to see a full day of deaths.
     * A shorter grace loses runs that died overnight, which is precisely the
     * population the watcher was built for.
     *
     * `0` restores the old delete-on-sight behaviour for a caller that really
     * wants it. Nothing in the tree passes it today.
     */
    prune_grace_ms?: number;
    /** Clock injection for tests. */
    now?: Date;
}

/**
 * How long an expired record outlives its expiry before a prune may remove it.
 * See {@link ReadLiveOptions.prune_grace_ms} for why this is a day.
 */
export const PRUNE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Every live record in the register, optionally pruning expired ones as it goes.
 *
 * Expiry is evaluated per record against **its own** platform's TTL. A file that
 * does not parse as a record is treated as expired: it carries no evidence of
 * life, and leaving it would make the register grow without bound on a host that
 * writes garbage.
 *
 * Returns `[]` on any failure — including "the directory does not exist", which
 * is the normal state before the first session registers.
 */
export function read_live_records(dir: string, options: ReadLiveOptions = {}): SessionRecord[] {
    const now = options.now ?? new Date();
    const prune = options.prune === true;
    const grace = options.prune_grace_ms ?? PRUNE_GRACE_MS;
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return [];
    }
    const live: SessionRecord[] = [];
    for (const name of names) {
        const full = path.join(dir, name);
        let rec: SessionRecord | null = null;
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(full, 'utf-8'));
            rec = is_record(parsed) ? parsed : null;
        } catch {
            rec = null;
        }
        if (rec === null || is_expired(rec, now)) {
            // A record is dropped from the LIVE set the moment it expires, and
            // deleted from disk only after the grace window — the watcher
            // reads the register directly and needs the expired ones.
            if (prune && (rec === null || is_expired(rec, new Date(now.getTime() - grace)))) {
                try {
                    fs.unlinkSync(full);
                } catch {
                    /* another session may have pruned it first — fine */
                }
            }
            continue;
        }
        live.push(rec);
    }
    return live;
}

/**
 * Live records belonging to sessions other than `session_id` — the set a
 * starting session actually cares about.
 */
export function foreign_live_records(
    dir: string,
    session_id: string,
    options: ReadLiveOptions = {},
): SessionRecord[] {
    const own = safe_stem(session_id);
    return read_live_records(dir, options).filter((r) => safe_stem(r.session_id) !== own);
}

// ---------------------------------------------------------------------------
// Collisions — and why `branch` alone was the wrong axis
// ---------------------------------------------------------------------------

/**
 * What two live sessions are colliding over.
 *
 * `branch` was the only axis this register checked, and it is the CHEAP one: two
 * sessions on one branch see each other immediately, and coordinating is a
 * `git worktree add`. `roadmap` is the expensive one and went unchecked —
 * measured twice (PR #1277/#1280, PR #1280/#1281), both times two sessions built
 * the SAME roadmap phase under DIFFERENT branch names
 * (`feat/dispatch-safety-confirmation` vs `feat/dispatch-safety-confirmed-execution`),
 * so the branch comparison was silent by construction while a whole
 * implementation was duplicated. One of the two PRs is thrown away either way.
 */
/**
 * `path` is the third axis, added last and cheapest to be wrong about: two
 * sessions can be on different roadmaps and different branches and still be
 * editing one file. It is reported SEPARATELY rather than folded into either of
 * the two above, because the response differs — a roadmap collision means stop,
 * a branch collision means coordinate, a path collision means take the disjoint
 * steps first and say so.
 */
export type CollisionKind = 'roadmap' | 'branch' | 'path';

export interface Collision {
    kind: CollisionKind;
    record: SessionRecord;
    /** For `kind: 'path'`, the shared paths. Absent on the other two kinds. */
    paths?: string[];
}

/**
 * Classify what this session collides with, roadmap-first.
 *
 * Ordering is the finding, not a preference: a roadmap collision means the work
 * is being done twice and one branch is already wasted, while a branch collision
 * means two sessions can see each other's commits. Reporting the cheap one first
 * is what let the expensive one pass unremarked.
 *
 * A `null` slug never collides — "no roadmap claimed" is the state of every
 * session before it picks one, and treating absence as a match would make the
 * warning fire on every pair of fresh sessions and be switched off.
 */
export function classify_collisions(
    others: readonly SessionRecord[],
    here: {
        branch: string | null;
        roadmap_slug: string | null;
        owned_paths?: readonly string[];
    },
): Collision[] {
    const out: Collision[] = [];
    for (const r of others) {
        if (
            here.roadmap_slug !== null &&
            r.roadmap_slug !== null &&
            r.roadmap_slug === here.roadmap_slug
        ) {
            out.push({ kind: 'roadmap', record: r });
        }
    }
    for (const r of others) {
        if (here.branch !== null && r.branch === here.branch) {
            out.push({ kind: 'branch', record: r });
        }
    }
    // Last, and last on purpose: the two axes above are unchanged in meaning and
    // in order, so a consumer that filters on `roadmap` or `branch` sees exactly
    // what it saw before this axis existed.
    const mine = new Set(here.owned_paths ?? []);
    if (mine.size > 0) {
        for (const r of others) {
            const shared = (r.owned_paths ?? []).filter((p) => mine.has(p)).sort();
            if (shared.length > 0) {
                out.push({ kind: 'path', record: r, paths: shared });
            }
        }
    }
    return out;
}
