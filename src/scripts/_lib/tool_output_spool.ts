/**
 * The tool-result store of `road-to-tool-results-that-leave-a-handle.md`
 * Phase 2: the bytes a model received, kept on this machine under their sha256,
 * and a handle that returns them.
 *
 * Its own conditional chunk, `tool_output_spool.chunk.cjs`, loaded by
 * `tool_output_spool_loader.ts` in the egress engine only when a class is
 * selected, so the dispatch bundle pays one call and the shipped mode `off`
 * loads none of it. The egress stage is the only caller (ADR-285): this module
 * writes nothing a concern asked for.
 *
 * Contracts, settled by the council on 2026-10-20 (rows D16, D17):
 * - A result is stored only from `protect` upward, only for a selected class,
 *   and only when the bytes stored equal the bytes delivered (D13). Until the
 *   stage emits a replacement, the delivered bytes are the received ones, so
 *   any replaced or withheld value means nothing is stored.
 * - Any credential-class detection in the result, at any confidence, refuses
 *   storage; so does a refusal the stage recorded for the result.
 * - `observe` stores no body; it records class, length and a keyed digest.
 * - A handle is `<address>.<expiry seconds>.<mac>`, both keyed by a
 *   workspace-local secret, so an expired handle is told from an unknown one
 *   after its entry is gone without keeping any metadata past retention.
 *
 * Added after the council refused ratification on 2026-10-20 (conditions 3, 4):
 * - The handle is bound to the session that stored it: the MAC covers the
 *   session id and a read must name the same session. Possession alone grants
 *   nothing outside that session, and nothing after the expiry.
 * - The address is `HMAC(key, session, sha256(bytes))`, not the bare digest, so
 *   equal outputs are not linkable across sessions or by anyone without the
 *   key, and a file name says nothing about its content. Within one session
 *   equal outputs still share one entry. The sha256 of the delivered bytes is
 *   still what a read verifies (D13): the address is recomputed from it.
 * - Retention is enforced on every use of the store — a store, and a read —
 *   so an entry past its age is deleted the next time the workspace touches
 *   the store, and a read never serves one even before that (the expiry is in
 *   the MAC). An untouched store is not cleaned; its entries are unreadable.
 * - Integrity of the CHUNK (its sha256 sidecar, `tool_output_spool_loader.ts`)
 *   says this code is the shipped code. It says nothing about the STORED DATA,
 *   whose protections are the ones above plus a 0700 directory and 0600 files
 *   under a gitignored path. Two threat models, two claims.
 * - Ranges are zero-based, half-open byte ranges; out of bounds is refused,
 *   never clamped. A read verifies the digest over the bytes it serves.
 * - Writes publish by an exclusive temp file and an atomic rename; cleanup runs
 *   at every store (D18 amends D17's once-per-session), each deletion a rename claim.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { classifyResult, type ContentClass } from './content_class.js';
import { SPOOL_SELECTED_CLASSES } from './tool_output_selection.js';

export { SPOOL_SELECTED_CLASSES };
/** The handshake with `tool_output_spool_loader.ts`; bump it whenever an export below changes shape. */
export const SPOOL_SCHEMA = 2;

export const SPOOL_DIR = path.join('agents', 'runtime', 'spool');
export const SPOOL_OBSERVATION_FILE = path.join('agents', 'runtime', 'state', 'spool-observations.jsonl');
/** D2: seven days and 500 MB, whichever comes first. */
export const SPOOL_RETENTION_MS = 7 * 24 * 3600 * 1000;
export const SPOOL_MAX_BYTES = 500 * 1024 * 1024;

const KEY_FILE = '.key';
const LOCK_FILE = '.cleanup.lock';
const STALE_LOCK_MS = 10 * 60 * 1000;
const STALE_TMP_MS = 60 * 60 * 1000;
const ADDRESS = /^[0-9a-f]{64}$/;
/** A session id this store binds to: host ids are UUID-like, and anything else is refused. */
const SESSION = /^[A-Za-z0-9._-]{1,128}$/;
const HANDLE = /^([0-9a-f]{64})\.(\d{1,12})\.([0-9a-f]{32})$/;

export type HandleState = 'ok' | 'expired' | 'missing' | 'corrupted' | 'invalid' | 'range';

export interface HandleRead {
    readonly state: HandleState;
    readonly bytes?: Buffer;
}

export interface StoredEntry {
    /** The keyed address the entry is filed under — not the content digest. */
    readonly address: string;
    readonly handle: string;
    readonly bytes: number;
}

function spoolDir(root: string): string {
    return path.join(root, SPOOL_DIR);
}

function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** Create the store's directory, or tighten an existing one, to 0700. */
function ensureSpoolDir(root: string): void {
    fs.mkdirSync(spoolDir(root), { recursive: true, mode: 0o700 });
    fs.chmodSync(spoolDir(root), 0o700);
}

function spoolKey(root: string, create: boolean): Buffer | null {
    const file = path.join(spoolDir(root), KEY_FILE);
    try {
        return fs.readFileSync(file);
    } catch {
        if (!create) return null;
    }
    ensureSpoolDir(root);
    try {
        fs.writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (exc) {
        if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') throw exc;
    }
    return fs.readFileSync(file);
}

function address(key: Buffer, session: string, digest: string): string {
    return createHmac('sha256', key).update(`addr:v2:${session}:${digest}`).digest('hex');
}

function mac(key: Buffer, addr: string, expiry: number, session: string): string {
    return createHmac('sha256', key).update(`v2:${addr}:${String(expiry)}:${session}`).digest('hex').slice(0, 32);
}

/** Write every byte or throw: a single `writeSync` may write fewer than asked. */
export function writeAll(fd: number, bytes: Buffer, write: (fd: number, b: Buffer, off: number, len: number) => number = fs.writeSync): void {
    for (let off = 0; off < bytes.length; ) {
        const n = write(fd, bytes, off, bytes.length - off);
        if (!(n > 0)) throw new Error('short write');
        off += n;
    }
}

/** Store `bytes` for `session` and mint a handle bound to it that expires with the retention age. */
export function storeBytes(root: string, bytes: Buffer, session: string, now: number = Date.now()): StoredEntry {
    if (!SESSION.test(session)) throw new Error('bad session');
    ensureSpoolDir(root);
    const key = spoolKey(root, true) as Buffer;
    const addr = address(key, session, sha256(bytes));
    const target = path.join(spoolDir(root), addr);
    const tmp = `${target}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`;
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try {
        writeAll(fd, bytes);
        fs.fsyncSync(fd);
    } catch (exc) {
        fs.closeSync(fd);
        fs.rmSync(tmp, { force: true });
        throw exc;
    }
    fs.closeSync(fd);
    // An existing entry has the same bytes by construction; the rename refreshes its age.
    fs.renameSync(tmp, target);
    const expiry = Math.floor((now + SPOOL_RETENTION_MS) / 1000);
    return { address: addr, handle: `${addr}.${String(expiry)}.${mac(key, addr, expiry, session)}`, bytes: bytes.length };
}

/**
 * The stored bytes behind a handle, whole or `[start, end)`, or the state that
 * stops them. `session` must be the session the handle was minted for; any
 * other session — or none — reads `invalid`, the same answer as a forgery.
 */
export function readHandle(
    root: string,
    handle: string,
    session: string,
    range?: readonly [number, number],
    now: number = Date.now(),
): HandleRead {
    const m = HANDLE.exec(handle.trim());
    if (m === null || !SESSION.test(session)) return { state: 'invalid' };
    const key = spoolKey(root, false);
    if (key === null) return { state: 'invalid' };
    const [, addr, exp, tag] = m as unknown as [string, string, string, string];
    const expected = Buffer.from(mac(key, addr, Number(exp), session), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(tag, 'hex'))) return { state: 'invalid' };
    if (now >= Number(exp) * 1000) return { state: 'expired' };
    // Only a handle that passed every check above reaches cleanup or an entry; the key read above is the one file a failing handle touches.
    try {
        cleanupSpool(root, now);
    } catch {
        // a failed cleanup does not change what this read may serve
    }
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(path.join(spoolDir(root), addr));
    } catch {
        return { state: 'missing' };
    }
    if (address(key, session, sha256(bytes)) !== addr) return { state: 'corrupted' };
    if (range === undefined) return { state: 'ok', bytes };
    const [start, end] = range;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > bytes.length) {
        return { state: 'range' };
    }
    return { state: 'ok', bytes: bytes.subarray(start, end) };
}

/** Test seams and the one entry a cleanup must leave: the store that just triggered it. */
export interface CleanupHooks {
    readonly beforeClaim?: (file: string) => void;
    readonly keep?: string;
}

/** The cap and the cleanup seams a store runs with; production passes neither. */
export interface SpoolLimits {
    readonly maxBytes?: number;
    readonly hooks?: CleanupHooks;
}

/**
 * Remove entries past the retention age, then the oldest until the store fits
 * its cap, and abandoned temp files.
 *
 * Correctness does not rest on the lock. Every deletion goes through
 * `claimAndDelete`, which renames the entry to a name only this cleaner uses and
 * inspects what it took: two cleaners cannot both delete one entry, and an entry
 * a writer replaced after it was measured is put back. The lock only stops two
 * cleaners doing the same work; if one is displaced (it held the lock past ten
 * minutes), the cost is redundant eviction, never a deleted fresh entry.
 */
export function cleanupSpool(
    root: string,
    now: number = Date.now(),
    maxBytes: number = SPOOL_MAX_BYTES,
    hooks: CleanupHooks = {},
): { removed: number } {
    const dir = spoolDir(root);
    if (!fs.existsSync(dir)) return { removed: 0 };
    const owner = acquireCleanupLock(dir, now);
    if (owner === null) return { removed: 0 };
    let removed = 0;
    try {
        const live: { name: string; seen: fs.Stats }[] = [];
        for (const name of fs.readdirSync(dir)) {
            let st: fs.Stats;
            try {
                st = fs.statSync(path.join(dir, name));
            } catch {
                continue;
            }
            const old = now - st.mtimeMs;
            const expired = name.endsWith('.tmp') || name.endsWith('.claimed') ? old > STALE_TMP_MS : ADDRESS.test(name) && old >= SPOOL_RETENTION_MS;
            if (expired) {
                if (claimAndDelete(dir, name, st, owner, hooks)) removed += 1;
            } else if (ADDRESS.test(name) && name !== hooks.keep) {
                live.push({ name, seen: st });
            }
        }
        live.sort((a, b) => a.seen.mtimeMs - b.seen.mtimeMs);
        let total = live.reduce((n, e) => n + e.seen.size, 0) + keptSize(dir, hooks.keep);
        for (const e of live) {
            if (total <= maxBytes) break;
            if (claimAndDelete(dir, e.name, e.seen, owner, hooks)) {
                total -= e.seen.size;
                removed += 1;
            }
        }
    } finally {
        releaseCleanupLock(dir, owner);
    }
    return { removed };
}

function keptSize(dir: string, keep: string | undefined): number {
    if (keep === undefined) return 0;
    try {
        return fs.statSync(path.join(dir, keep)).size;
    } catch {
        return 0;
    }
}

/**
 * Delete `name` only if it is still the file cleanup measured. The rename is the
 * claim: whatever it moved is this cleaner's to inspect, and no other process
 * can reach it under the claimed name. A different file (inode, mtime or size)
 * means a writer replaced it; it is linked back unless a newer copy already
 * sits at the name. While claimed, a read of that entry answers `missing`.
 */
export function claimAndDelete(dir: string, name: string, seen: fs.Stats, owner: string, hooks: CleanupHooks = {}): boolean {
    const file = path.join(dir, name);
    const claimed = path.join(dir, `.${name}.${owner}.claimed`);
    hooks.beforeClaim?.(file);
    try {
        fs.renameSync(file, claimed);
    } catch {
        return false;
    }
    try {
        const got = fs.statSync(claimed);
        if (got.ino === seen.ino && got.mtimeMs === seen.mtimeMs && got.size === seen.size) return true;
        try {
            fs.linkSync(claimed, file);
        } catch {
            // a newer copy took the name; it wins
        }
        return false;
    } catch {
        return false;
    } finally {
        fs.rmSync(claimed, { force: true });
    }
}

/**
 * Take the cleanup lock, or null when a live cleaner holds it. The lock holds a
 * random token; a stale lock is taken over by renaming it aside, which only one
 * taker can do, then creating a fresh one.
 */
export function acquireCleanupLock(dir: string, now: number = Date.now()): string | null {
    const lock = path.join(dir, LOCK_FILE);
    const owner = randomBytes(16).toString('hex');
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(lock, owner, { flag: 'wx' });
            return owner;
        } catch {
            try {
                if (attempt > 0 || now - fs.statSync(lock).mtimeMs < STALE_LOCK_MS) return null;
                const aside = `${lock}.${owner}.stale`;
                fs.renameSync(lock, aside);
                fs.rmSync(aside, { force: true });
            } catch {
                return null;
            }
        }
    }
    return null;
}

/**
 * Release the lock if it still holds this cleaner's token. A successor that
 * replaced it between the read and the removal can lose its lock; that admits a
 * second cleaner, which `claimAndDelete` makes harmless.
 */
export function releaseCleanupLock(dir: string, owner: string): void {
    const lock = path.join(dir, LOCK_FILE);
    try {
        if (fs.readFileSync(lock, 'utf8') === owner) fs.rmSync(lock, { force: true });
    } catch {
        // already released or taken over
    }
}

/** The stage's view of one dispatch, as much of it as the store reads. */
export interface SpoolStageView {
    readonly mode: string;
    readonly placeholder: Record<string, unknown> | undefined;
    readonly counts: readonly { readonly field: string; readonly class: string }[];
    readonly refused: readonly { readonly field: string }[];
}

export type SpoolOutcome =
    | { readonly action: 'skip'; readonly reason: 'unselected' | 'no-result' | 'image' | 'credential' | 'view-differs' | 'mode' | 'replay' | 'no-session' | 'too-large' | 'store-error' | 'store-unavailable' }
    | { readonly action: 'observed'; readonly class: ContentClass; readonly bytes: number; readonly digest: string }
    | ({ readonly action: 'stored'; readonly class: ContentClass } & StoredEntry);

function payloadOf(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function serialize(v: unknown): string {
    return typeof v === 'string' ? v : JSON.stringify(v);
}

function isImage(v: unknown): boolean {
    const o = payloadOf(v);
    return o !== null && (o['type'] === 'image' || payloadOf(o['file'])?.['type'] === 'image');
}

function observe(root: string, line: Record<string, unknown>): void {
    try {
        const file = path.join(root, SPOOL_OBSERVATION_FILE);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    } catch {
        // observability never breaks the hook
    }
}

/**
 * One dispatch's result into the store. Called by the egress stage after its
 * views exist; never throws, because a store failure must not withhold a body.
 */
export function spoolResult(
    envelope: Record<string, unknown>,
    view: SpoolStageView,
    resultKeys: readonly string[],
    root: string,
    selected: ReadonlySet<ContentClass> = SPOOL_SELECTED_CLASSES,
    now: number = Date.now(),
    limits: SpoolLimits = {},
): SpoolOutcome {
    try {
        if (view.mode !== 'observe' && view.mode !== 'protect' && view.mode !== 'strict') return { action: 'skip', reason: 'mode' };
        if ((process.env['AGENT_CONFIG_REPLAY'] ?? '').trim() === '1') return { action: 'skip', reason: 'replay' };
        const payload = payloadOf(envelope['payload']);
        const key = resultKeys[0];
        if (payload === null || key === undefined || payload[key] === undefined) return { action: 'skip', reason: 'no-result' };
        const tool = typeof payload['tool_name'] === 'string' ? payload['tool_name'] : '';
        const command = payloadOf(payload['tool_input'])?.['command'];
        const cls = classifyResult(tool, typeof command === 'string' ? command : null);
        if (!selected.has(cls)) return { action: 'skip', reason: 'unselected' };
        if (isImage(payload[key])) return { action: 'skip', reason: 'image' };
        const credential = view.counts.some((c) => c.field === 'result' && c.class === 'credential');
        if (credential || view.refused.some((r) => r.field === 'result')) return { action: 'skip', reason: 'credential' };
        const raw = Buffer.from(serialize(payload[key]), 'utf8');
        if (view.mode === 'observe') {
            // Keyed under the empty session no stored entry uses: a repeat stays countable, equal content is not linkable without the key.
            const digest = address(spoolKey(root, true) as Buffer, '', sha256(raw));
            observe(root, { ts: new Date(now).toISOString(), tool, class: cls, bytes: raw.length, digest });
            return { action: 'observed', class: cls, bytes: raw.length, digest };
        }
        const shown = payloadOf(view.placeholder?.['payload'])?.[key];
        if (shown === undefined || serialize(shown) !== raw.toString('utf8')) return { action: 'skip', reason: 'view-differs' };
        const session = String(payload['session_id'] ?? envelope['session_id'] ?? '').trim();
        if (!SESSION.test(session)) return { action: 'skip', reason: 'no-session' };
        const cap = limits.maxBytes ?? SPOOL_MAX_BYTES;
        // Admission: an entry the cap could never hold is not written at all.
        if (raw.length > cap) return { action: 'skip', reason: 'too-large' };
        const entry = storeBytes(root, raw, session, now);
        try {
            cleanupSpool(root, now, cap, { ...limits.hooks, keep: entry.address });
        } catch {
            // A store that cannot enforce its bounds does not keep the write.
            fs.rmSync(path.join(spoolDir(root), entry.address), { force: true });
            return { action: 'skip', reason: 'store-error' };
        }
        return { action: 'stored', class: cls, ...entry };
    } catch {
        return { action: 'skip', reason: 'store-error' };
    }
}
