/**
 * Materialise a skill the install did not write — `road-to-skills-that-arrive-
 * when-called` 4.3 and 4.5.
 *
 * WHERE THE BYTES COME FROM. The staged runtime under
 * `~/.event4u/agent-config/runtime/current/dist/agent-src/skills/<name>` — the
 * payload the carrier roadmap already stages for this exact version, on this
 * machine, offline. Never the network and never a package-manager cache: K4,
 * and an `npx` install runs out of a directory the package manager may clear at
 * any moment.
 *
 * HOW AN ENTRY IS PLACED, AND WHY IT IS TWO STEPS. The folder is copied into a
 * package-owned store, written to a temporary name and renamed into place, so a
 * half-written entry is never visible under its real name. The HOST then sees a
 * symlink from its skills root into that store. Two steps rather than one
 * because the two halves answer different questions: the copy is what makes the
 * entry checkable and tamper-evident, and the symlink is the only placement 0.2
 * observed the host pick up — a copy into the skills root is `unobserved` there
 * and no step is allowed to assume it. It also buys the removal shape 0.2 (b)
 * measured: dropping the symlink leaves a live session working, because its
 * target still exists, and only collecting the target ends it.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE IS A REAL FAILURE SHAPE AND NOT A GUESS.
 * Public issue reports against an external skills CLI describe removal of
 * unmanaged directories and stale lock entries (K4). The refusals below are
 * those shapes, each with a fixture:
 *
 *   `not-in-payload`    the name is not in the staged payload of this version
 *   `path-escape`       an entry path resolves outside the payload root
 *   `symlink-escape`    a symlink inside the payload points outside it
 *   `hash-mismatch`     the payload folder's content hash is not what was recorded
 *   `partial-write`     a staging directory survived a previous interrupted write
 *   `would-shadow`      the name already exists at the host root, or is a host built-in
 *   `project-tree`      the target root is not the host's user-scope root (K8, ADR-020)
 *   `host-not-enabled`  the host's probe rows do not support materialisation
 *
 * THE LOCK. `materialised-skills.json` beside the deploy inventory: sorted,
 * timestamp-free, one row per entry with the content hash of the projected
 * folder. Timestamp-free so two runs at one payload produce a byte-identical
 * file — a lock that changed every run could not be diffed, and a diff is the
 * only way to see an entry nobody meant to add. K7: this is the install log's
 * `sha256` idea applied to a folder, not a new content-addressed store.
 *
 * ONLY ITS OWN ENTRIES (4.5). Removal reads the lock, never the directory. An
 * entry the lock does not name is left alone whatever it looks like, so a
 * user's own skill, a host built-in and another tool's directory all survive a
 * full collect. The lock also pins the root each entry was written under, so a
 * lock from another machine or another profile removes nothing here.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { currentRuntimeDir, runtimeRootFor } from '../../install/stagedRuntime.js';
import { is_claude_builtin_name } from './claude_builtin_names.js';
import { collectLeases, holdLease, readLeaseNames } from './skill_leases.js';
import { PLACEMENT, materialisationEnabled } from './skill_materialisation_gate.js';
import {
    LOCK_BASENAME,
    STORE_DIRNAME,
    loadLock,
    materialisedNames,
    release,
    saveLock,
    type Lock,
    type LockEntry,
    type ReleaseResult,
} from './skill_materialisation_lock.js';
import { event4u_root, type EnvMap } from './user_global_paths.js';

// Re-exported so a caller that does the whole job — inspect, place, release —
// has one import. The lock itself lives next door because the `session_start`
// collect needs it inside the hook bundle and must not drag this file in.
export {
    LOCK_BASENAME,
    STORE_DIRNAME,
    loadLock,
    materialisedNames,
    release,
    saveLock,
    type Lock,
    type LockEntry,
    type ReleaseResult,
};

export const STAGING_SUFFIX = '.staging';
export const EMPTY_LOCK: Lock = { schema_version: 1, entries: [] };

export type RefusalCode =
    | 'not-in-payload'
    | 'path-escape'
    | 'symlink-escape'
    | 'hash-mismatch'
    | 'partial-write'
    | 'would-shadow'
    | 'project-tree'
    | 'host-not-enabled';

export interface Refusal {
    code: RefusalCode;
    name: string;
    detail: string;
}

export function lockPath(env?: EnvMap | null): string {
    return path.join(event4u_root(env), LOCK_BASENAME);
}

export function storeRoot(env?: EnvMap | null): string {
    return path.join(event4u_root(env), STORE_DIRNAME);
}

/** The staged payload's skills directory for the running version. */
export function payloadSkillsDir(env?: NodeJS.ProcessEnv): string {
    return path.join(currentRuntimeDir(runtimeRootFor(env)), 'dist', 'agent-src', 'skills');
}

/**
 * Content hash of a folder: sha256 over `relpath\0<file sha256>\n` lines in
 * sorted relative-path order.
 *
 * Sorted so the hash does not depend on readdir order, and relative so it does
 * not depend on where the folder sits. A symlink inside the folder is hashed by
 * its TARGET TEXT, not by what it points at — a link is content, and following
 * it would make the hash depend on something outside the folder.
 */
export function hashFolder(dir: string): string {
    const lines: string[] = [];
    const walk = (abs: string, rel: string): void => {
        const entries = fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
        for (const e of entries) {
            const childAbs = path.join(abs, e.name);
            const childRel = rel === '' ? e.name : `${rel}/${e.name}`;
            if (e.isSymbolicLink()) {
                lines.push(`${childRel}\u0000link:${fs.readlinkSync(childAbs)}\n`);
            } else if (e.isDirectory()) {
                walk(childAbs, childRel);
            } else if (e.isFile()) {
                lines.push(`${childRel}\u0000${createHash('sha256').update(fs.readFileSync(childAbs)).digest('hex')}\n`);
            }
        }
    };
    walk(dir, '');
    return createHash('sha256').update(lines.join('')).digest('hex');
}

/** True when `child` resolves inside `root`. Both are resolved first. */
export function contains(root: string, child: string): boolean {
    const r = path.resolve(root);
    const c = path.resolve(child);
    return c === r || c.startsWith(r + path.sep);
}

/**
 * Walk a payload folder and refuse anything that leaves it.
 *
 * Two different escapes, because they fail differently: a path that resolves
 * out (`..` in a name, an absolute component) and a symlink whose target is
 * outside. The first is caught before anything is read, the second before
 * anything is copied.
 */
export function inspectPayload(root: string, name: string): Refusal | null {
    const dir = path.join(root, name);
    if (!contains(root, dir)) {
        return { code: 'path-escape', name, detail: `${name} resolves outside the payload root` };
    }
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) {
        return { code: 'not-in-payload', name, detail: `no SKILL.md under ${dir}` };
    }
    const stack = [dir];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch (e) {
            return { code: 'not-in-payload', name, detail: `unreadable: ${String(e)}` };
        }
        for (const e of entries) {
            const abs = path.join(cur, e.name);
            if (!contains(dir, abs)) {
                return { code: 'path-escape', name, detail: `${abs} resolves outside ${dir}` };
            }
            if (e.isSymbolicLink()) {
                const target = path.resolve(cur, fs.readlinkSync(abs));
                if (!contains(dir, target)) {
                    return { code: 'symlink-escape', name, detail: `${abs} -> ${target}` };
                }
                continue;
            }
            if (e.isDirectory()) stack.push(abs);
        }
    }
    return null;
}

/** Copy a tree, refusing a symlink that leaves `boundary`. */
function copyTree(src: string, dest: string, boundary: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, e.name);
        const to = path.join(dest, e.name);
        if (e.isSymbolicLink()) {
            const target = path.resolve(src, fs.readlinkSync(from));
            if (!contains(boundary, target)) throw new Error(`symlink escapes payload: ${from}`);
            fs.copyFileSync(target, to);
        } else if (e.isDirectory()) {
            copyTree(from, to, boundary);
        } else if (e.isFile()) {
            fs.copyFileSync(from, to);
        }
    }
}

export interface MaterialiseOptions {
    host: string;
    /** The host's user-scope skills root, e.g. `~/.claude/skills`. */
    hostSkillsRoot: string;
    /** The host's user-scope anchor, e.g. `~/.claude`. The root must sit inside it. */
    hostAnchor: string;
    payloadDir: string;
    storeDir: string;
    lockFile: string;
    packageRoot: string;
    now?: Date;
    /** Skip the probe-row gate. Only a test that is testing something else does this. */
    skipGate?: boolean;
}

export interface MaterialiseResult {
    placed: boolean;
    refusal: Refusal | null;
    /** The store path the host entry points at, when placed. */
    target: string | null;
}

/**
 * Bring one skill into the host's skills root, or refuse and say why.
 *
 * Idempotent: a second call for an entry already in the lock, whose payload
 * hash still matches and whose symlink is still in place, changes nothing.
 */
export function materialise(name: string, opts: MaterialiseOptions): MaterialiseResult {
    const refuse = (code: RefusalCode, detail: string): MaterialiseResult => ({
        placed: false,
        refusal: { code, name, detail },
        target: null,
    });

    if (opts.skipGate !== true) {
        const gate = materialisationEnabled(opts.host, opts.packageRoot, opts.now);
        if (!gate.enabled) return refuse('host-not-enabled', gate.reasons.join('; '));
    }
    if (PLACEMENT[opts.host] !== 'symlink') {
        return refuse('host-not-enabled', `no observed placement mechanism for ${opts.host}`);
    }
    // K8 / ADR-020: never into a project tree. The skills root must sit inside
    // the host's own user-scope anchor, which is the only place this package
    // deploys global content.
    if (!contains(opts.hostAnchor, opts.hostSkillsRoot)) {
        return refuse('project-tree', `${opts.hostSkillsRoot} is not inside ${opts.hostAnchor}`);
    }

    const bad = inspectPayload(opts.payloadDir, name);
    if (bad !== null) return { placed: false, refusal: bad, target: null };

    const lock = loadLock(opts.lockFile);
    const recorded = lock.entries.find((e) => e.name === name && e.root === opts.hostSkillsRoot);
    const dest = path.join(opts.hostSkillsRoot, name);
    const store = path.join(opts.storeDir, opts.host, name);

    // `would-shadow` covers the host built-ins by name AND anything already on
    // disk under that name that this lock does not claim — a user's own skill
    // and a bundled one are indistinguishable from here, and neither is ours.
    if (is_claude_builtin_name(name)) {
        return refuse('would-shadow', `${name} is a host built-in`);
    }
    if (recorded === undefined && fs.existsSync(dest)) {
        return refuse('would-shadow', `${dest} already exists and the lock does not claim it`);
    }

    const staging = `${store}${STAGING_SUFFIX}`;
    if (fs.existsSync(staging)) {
        // A staging directory that outlived its run is the interrupted-write
        // shape. Report it rather than silently reusing or deleting it: the
        // caller decides, and a silent delete is the unmanaged-directory
        // removal K4 names.
        return refuse('partial-write', `staging directory survived a previous run: ${staging}`);
    }

    const payloadHash = hashFolder(path.join(opts.payloadDir, name));
    if (recorded !== undefined && recorded.sha256 !== payloadHash) {
        return refuse(
            'hash-mismatch',
            `payload hash ${payloadHash} does not match the locked ${recorded.sha256}`,
        );
    }
    if (recorded !== undefined && fs.existsSync(store) && hashFolder(store) !== payloadHash) {
        return refuse('hash-mismatch', `materialised copy at ${store} no longer matches the payload`);
    }

    try {
        if (!fs.existsSync(store)) {
            fs.mkdirSync(path.dirname(store), { recursive: true });
            copyTree(path.join(opts.payloadDir, name), staging, path.join(opts.payloadDir, name));
            if (hashFolder(staging) !== payloadHash) {
                fs.rmSync(staging, { recursive: true, force: true });
                return refuse('hash-mismatch', 'the staged copy does not match the payload it was copied from');
            }
            fs.renameSync(staging, store);
        }
        fs.mkdirSync(opts.hostSkillsRoot, { recursive: true });
        if (!fs.existsSync(dest)) fs.symlinkSync(store, dest);
    } catch (e) {
        fs.rmSync(staging, { recursive: true, force: true });
        return refuse('partial-write', String(e));
    }

    if (recorded === undefined) {
        lock.entries.push({ host: opts.host, name, root: opts.hostSkillsRoot, sha256: payloadHash });
        saveLock(opts.lockFile, lock);
    }
    return { placed: true, refusal: null, target: store };
}

/**
 * Materialise under a lease — the 4.4 lifetime, applied at the one moment the
 * package is already doing this work.
 *
 * WHERE THE COLLECT RUNS, AND WHY NOT WHERE 4.4 SAID. The step names the
 * `session_start` read, chosen against a daemon (K9) and against `stop` (K3) as
 * "the cheapest existing periodic moment". Measured on 2026-10-20 it is not
 * cheap here: `session_start` for this package runs inside the hook dispatcher
 * bundle, which had 454 bytes of headroom, and wiring the collector in measured
 * 5,595 bytes over the ceiling — a standing cost on every hook event on every
 * host, for a collect that finds an empty lock on every install today.
 *
 * So the collect runs at the START OF EVERY MATERIALISATION REQUEST instead,
 * plus on uninstall. The mechanism is untouched: the lease, its TTL, the keying
 * by host config root and the never-remove-under-a-live-lease rule are exactly
 * as 4.4 specifies. Only the slot moved, and it moved to another existing
 * moment — still no daemon, still nothing on `stop`.
 *
 * WHAT THIS ACCEPTS. An entry whose last holder died lingers until the next
 * materialisation on that machine, rather than until the next session start. A
 * lingering entry is an installed skill: the host lists it and it works. The
 * harm 4.4 exists to prevent is removal UNDER a live lease, and that is
 * enforced by the lease check wherever the check runs — a LATE collect cannot
 * cause it, only an eager one could.
 */
export function materialiseUnderLease(
    name: string,
    opts: MaterialiseOptions & {
        session: { session_id: string; platform: string; worktree: string };
        leaseDirectory: string;
        now?: Date;
    },
): MaterialiseResult & { collected: string[] } {
    const now = opts.now ?? new Date();
    const known = materialisedNames(opts.lockFile, opts.hostSkillsRoot);
    const { releasable } = collectLeases(opts.leaseDirectory, known, now);
    const collected = releasable.length
        ? release(opts.lockFile, opts.hostSkillsRoot, releasable, opts.storeDir).removed
        : [];

    const res = materialise(name, opts);
    if (!res.placed) return { ...res, collected };

    const held = new Set(
        (readLeaseNames(opts.leaseDirectory, opts.session.session_id) ?? []).filter(
            (n) => !collected.includes(n),
        ),
    );
    held.add(name);
    holdLease(opts.leaseDirectory, {
        session_id: opts.session.session_id,
        platform: opts.session.platform,
        worktree: opts.session.worktree,
        branch: null,
        roadmap_slug: null,
        started_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        last_seen: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        host_root: opts.hostSkillsRoot,
        names: [...held],
    });
    return { ...res, collected };
}
