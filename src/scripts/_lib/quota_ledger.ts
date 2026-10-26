/**
 * quota_ledger — the machine-wide record of what the host says about plan quota.
 *
 * Five parallel sessions on one machine draw on one plan, so the ledger lives
 * under the user-global root, never in a repository. Its writer is the
 * status-line tap: Claude Code hands every status-line command a JSON payload
 * carrying `rate_limits.five_hour` / `seven_day` (`used_percentage`,
 * `resets_at`) and `context_window` — the only official source of plan-window
 * fill, and absent on hosts or logins that do not report it.
 *
 * PII-exclusion-by-construction: a snapshot holds numbers, a timestamp, a model
 * id and a hashed session id. No field can carry a prompt, a path or a
 * credential, so there is no scrubbing pass here that could fail.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { write_target, type EnvMap } from './user_global_paths.js';

/** One plan window as the host reported it: fill in percent, reset as epoch seconds. */
export interface QuotaWindow {
    readonly pct: number;
    readonly resets_at: number | null;
}

export interface QuotaSnapshot {
    /** Epoch milliseconds. */
    readonly ts: number;
    /** First 12 hex chars of sha256(session id); `''` when the payload had none. */
    readonly session: string;
    readonly five_hour?: QuotaWindow;
    readonly seven_day?: QuotaWindow;
    readonly context_used_pct?: number;
    readonly context_size?: number;
    readonly model?: string;
}

/** Snapshots older than this are dropped on the next prune: a five-hour window is the longest one read for a rate. */
export const QUOTA_LEDGER_RETENTION_MS = 8 * 60 * 60 * 1000;

/** A ledger above this size is rewritten without its expired lines. */
const PRUNE_AT_BYTES = 256 * 1024;

export function quotaStateDir(env?: EnvMap | null): string {
    return write_target(path.join('state', 'quota'), { env: env ?? null });
}

export function quotaLedgerPath(env?: EnvMap | null): string {
    return path.join(quotaStateDir(env), 'snapshots.jsonl');
}

export function hashSessionId(id: unknown): string {
    return typeof id === 'string' && id !== ''
        ? crypto.createHash('sha256').update(id).digest('hex').slice(0, 12)
        : '';
}

function finiteNumber(x: unknown): number | undefined {
    return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

function readWindow(raw: unknown): QuotaWindow | undefined {
    if (raw === null || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const pct = finiteNumber(o['used_percentage']);
    if (pct === undefined) return undefined;
    const reset = o['resets_at'];
    let resets_at: number | null = null;
    if (typeof reset === 'number' && Number.isFinite(reset)) {
        // The host documents epoch seconds; a millisecond value is normalised.
        resets_at = reset > 1e12 ? Math.trunc(reset / 1000) : Math.trunc(reset);
    } else if (typeof reset === 'string' && reset !== '') {
        const parsed = Date.parse(reset);
        if (Number.isFinite(parsed)) resets_at = Math.trunc(parsed / 1000);
    }
    return { pct, resets_at };
}

/**
 * Turn the host's status-line payload into a snapshot, or `null` when it
 * carries nothing quota-relevant. Every field is optional: `rate_limits` is
 * subscriber-only and appears after the first response, and each window may be
 * absent on its own.
 */
export function snapshotFromStatusPayload(payload: unknown, now: number = Date.now()): QuotaSnapshot | null {
    if (payload === null || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    const limits = (p['rate_limits'] ?? null) as Record<string, unknown> | null;
    const five_hour = limits && typeof limits === 'object' ? readWindow(limits['five_hour']) : undefined;
    const seven_day = limits && typeof limits === 'object' ? readWindow(limits['seven_day']) : undefined;
    const ctx = (p['context_window'] ?? null) as Record<string, unknown> | null;
    const context_used_pct = ctx && typeof ctx === 'object' ? finiteNumber(ctx['used_percentage']) : undefined;
    const context_size = ctx && typeof ctx === 'object' ? finiteNumber(ctx['context_window_size']) : undefined;
    const modelRaw = (p['model'] ?? null) as Record<string, unknown> | null;
    const modelId = modelRaw && typeof modelRaw === 'object' ? modelRaw['id'] : undefined;
    if (five_hour === undefined && seven_day === undefined && context_used_pct === undefined) return null;
    return {
        ts: now,
        session: hashSessionId(p['session_id']),
        ...(five_hour ? { five_hour } : {}),
        ...(seven_day ? { seven_day } : {}),
        ...(context_used_pct !== undefined ? { context_used_pct } : {}),
        ...(context_size !== undefined ? { context_size } : {}),
        ...(typeof modelId === 'string' && modelId.length <= 80 ? { model: modelId } : {}),
    };
}

function parseLine(line: string): QuotaSnapshot | null {
    try {
        const o = JSON.parse(line) as Record<string, unknown>;
        return typeof o['ts'] === 'number' && typeof o['session'] === 'string' ? (o as unknown as QuotaSnapshot) : null;
    } catch {
        return null;
    }
}

/** Read every snapshot newer than the retention window, oldest first. A missing or unreadable ledger is empty. */
export function readQuotaLedger(env?: EnvMap | null, now: number = Date.now()): QuotaSnapshot[] {
    let text: string;
    try {
        text = fs.readFileSync(quotaLedgerPath(env), 'utf-8');
    } catch {
        return [];
    }
    const out: QuotaSnapshot[] = [];
    for (const line of text.split('\n')) {
        if (line === '') continue;
        const s = parseLine(line);
        if (s !== null && now - s.ts <= QUOTA_LEDGER_RETENTION_MS) out.push(s);
    }
    return out.sort((a, b) => a.ts - b.ts);
}

/**
 * Append one snapshot. One short line per append, so concurrent sessions
 * interleave whole lines; past the size bound the ledger is rewritten
 * atomically without its expired lines.
 */
export function appendQuotaSnapshot(snapshot: QuotaSnapshot, env?: EnvMap | null): void {
    const target = quotaLedgerPath(env);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, `${JSON.stringify(snapshot)}\n`, 'utf-8');
    let size = 0;
    try {
        size = fs.statSync(target).size;
    } catch {
        return;
    }
    if (size > PRUNE_AT_BYTES) {
        const kept = readQuotaLedger(env, snapshot.ts);
        write_atomic(target, kept.map((s) => JSON.stringify(s)).join('\n') + (kept.length > 0 ? '\n' : ''));
    }
}
