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
 * - `observe` stores no body; it records class, length and digest.
 * - A handle is `<sha256>.<expiry seconds>.<mac>`, the MAC keyed by a
 *   workspace-local secret, so an expired handle is told from an unknown one
 *   after its entry is gone without keeping any metadata past retention.
 * - Ranges are zero-based, half-open byte ranges; out of bounds is refused,
 *   never clamped. A read verifies the digest over the bytes it serves.
 * - Writes publish by an exclusive temp file and an atomic rename; cleanup runs
 *   under an exclusive lock, at the first store of each session.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { classifyResult, type ContentClass } from './content_class.js';
import { SPOOL_SELECTED_CLASSES } from './tool_output_selection.js';

export { SPOOL_SELECTED_CLASSES };
/** The handshake with `tool_output_spool_loader.ts`; bump it whenever an export below changes shape. */
export const SPOOL_SCHEMA = 1;

export const SPOOL_DIR = path.join('agents', 'runtime', 'spool');
export const SPOOL_OBSERVATION_FILE = path.join('agents', 'runtime', 'state', 'spool-observations.jsonl');
/** D2: seven days and 500 MB, whichever comes first. */
export const SPOOL_RETENTION_MS = 7 * 24 * 3600 * 1000;
export const SPOOL_MAX_BYTES = 500 * 1024 * 1024;

const KEY_FILE = '.key';
const LOCK_FILE = '.cleanup.lock';
const SESSION_FILE = '.last-cleanup-session';
const STALE_LOCK_MS = 10 * 60 * 1000;
const STALE_TMP_MS = 60 * 60 * 1000;
const DIGEST = /^[0-9a-f]{64}$/;
const HANDLE = /^([0-9a-f]{64})\.(\d{1,12})\.([0-9a-f]{32})$/;

export type HandleState = 'ok' | 'expired' | 'missing' | 'corrupted' | 'invalid' | 'range';

export interface HandleRead {
    readonly state: HandleState;
    readonly bytes?: Buffer;
}

export interface StoredEntry {
    readonly digest: string;
    readonly handle: string;
    readonly bytes: number;
}

function spoolDir(root: string): string {
    return path.join(root, SPOOL_DIR);
}

function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function spoolKey(root: string, create: boolean): Buffer | null {
    const file = path.join(spoolDir(root), KEY_FILE);
    try {
        return fs.readFileSync(file);
    } catch {
        if (!create) return null;
    }
    fs.mkdirSync(spoolDir(root), { recursive: true, mode: 0o700 });
    try {
        fs.writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (exc) {
        if ((exc as NodeJS.ErrnoException).code !== 'EEXIST') throw exc;
    }
    return fs.readFileSync(file);
}

function mac(key: Buffer, digest: string, expiry: number): string {
    return createHmac('sha256', key).update(`v1:${digest}:${String(expiry)}`).digest('hex').slice(0, 32);
}

/** Store `bytes` under their digest and mint a handle that expires with the retention age. */
export function storeBytes(root: string, bytes: Buffer, now: number = Date.now()): StoredEntry {
    const key = spoolKey(root, true) as Buffer;
    const digest = sha256(bytes);
    const target = path.join(spoolDir(root), digest);
    const tmp = `${target}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`;
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try {
        fs.writeSync(fd, bytes);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    // An existing entry has the same bytes by construction; the rename refreshes its age.
    fs.renameSync(tmp, target);
    const expiry = Math.floor((now + SPOOL_RETENTION_MS) / 1000);
    return { digest, handle: `${digest}.${String(expiry)}.${mac(key, digest, expiry)}`, bytes: bytes.length };
}

/** The stored bytes behind a handle, whole or `[start, end)`, or the state that stops them. */
export function readHandle(root: string, handle: string, range?: readonly [number, number], now: number = Date.now()): HandleRead {
    const m = HANDLE.exec(handle.trim());
    const key = spoolKey(root, false);
    if (m === null || key === null) return { state: 'invalid' };
    const [, digest, exp, tag] = m as unknown as [string, string, string, string];
    const expected = Buffer.from(mac(key, digest, Number(exp)), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(tag, 'hex'))) return { state: 'invalid' };
    if (now >= Number(exp) * 1000) return { state: 'expired' };
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(path.join(spoolDir(root), digest));
    } catch {
        return { state: 'missing' };
    }
    if (sha256(bytes) !== digest) return { state: 'corrupted' };
    if (range === undefined) return { state: 'ok', bytes };
    const [start, end] = range;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > bytes.length) {
        return { state: 'range' };
    }
    return { state: 'ok', bytes: bytes.subarray(start, end) };
}

/**
 * Remove entries past the retention age, then the oldest until the store fits
 * its cap, and abandoned temp files. Runs under an exclusive lock; a held lock
 * younger than ten minutes means another process is cleaning, and this one skips.
 */
export function cleanupSpool(root: string, now: number = Date.now(), maxBytes: number = SPOOL_MAX_BYTES): { removed: number } {
    const dir = spoolDir(root);
    if (!fs.existsSync(dir)) return { removed: 0 };
    const lock = path.join(dir, LOCK_FILE);
    try {
        fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
    } catch {
        try {
            if (now - fs.statSync(lock).mtimeMs < STALE_LOCK_MS) return { removed: 0 };
            fs.rmSync(lock, { force: true });
            fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
        } catch {
            return { removed: 0 };
        }
    }
    let removed = 0;
    try {
        const live: { file: string; mtime: number; size: number }[] = [];
        for (const name of fs.readdirSync(dir)) {
            const file = path.join(dir, name);
            let st: fs.Stats;
            try {
                st = fs.statSync(file);
            } catch {
                continue;
            }
            const old = now - st.mtimeMs;
            if (name.endsWith('.tmp') ? old > STALE_TMP_MS : DIGEST.test(name) && old >= SPOOL_RETENTION_MS) {
                fs.rmSync(file, { force: true });
                removed += 1;
            } else if (DIGEST.test(name)) {
                live.push({ file, mtime: st.mtimeMs, size: st.size });
            }
        }
        live.sort((a, b) => a.mtime - b.mtime);
        let total = live.reduce((n, e) => n + e.size, 0);
        for (const e of live) {
            if (total <= maxBytes) break;
            fs.rmSync(e.file, { force: true });
            total -= e.size;
            removed += 1;
        }
    } finally {
        fs.rmSync(lock, { force: true });
    }
    return { removed };
}

/** The stage's view of one dispatch, as much of it as the store reads. */
export interface SpoolStageView {
    readonly mode: string;
    readonly placeholder: Record<string, unknown> | undefined;
    readonly counts: readonly { readonly field: string; readonly class: string }[];
    readonly refused: readonly { readonly field: string }[];
}

export type SpoolOutcome =
    | { readonly action: 'skip'; readonly reason: 'unselected' | 'no-result' | 'image' | 'credential' | 'view-differs' | 'mode' | 'replay' | 'store-error' | 'store-unavailable' }
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

function cleanupOncePerSession(root: string, session: string, now: number): void {
    const marker = path.join(spoolDir(root), SESSION_FILE);
    try {
        if (fs.readFileSync(marker, 'utf8') === session) return;
    } catch {
        // first cleanup in this workspace
    }
    cleanupSpool(root, now);
    fs.mkdirSync(spoolDir(root), { recursive: true, mode: 0o700 });
    fs.writeFileSync(marker, session, 'utf8');
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
            const digest = sha256(raw);
            observe(root, { ts: new Date(now).toISOString(), tool, class: cls, bytes: raw.length, digest });
            return { action: 'observed', class: cls, bytes: raw.length, digest };
        }
        const shown = payloadOf(view.placeholder?.['payload'])?.[key];
        if (shown === undefined || serialize(shown) !== raw.toString('utf8')) return { action: 'skip', reason: 'view-differs' };
        cleanupOncePerSession(root, String(payload['session_id'] ?? envelope['session_id'] ?? ''), now);
        return { action: 'stored', class: cls, ...storeBytes(root, raw, now) };
    } catch {
        return { action: 'skip', reason: 'store-error' };
    }
}
