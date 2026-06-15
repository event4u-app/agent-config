/**
 * Boundary detection + concurrent-safe recording (Phase 2).
 *
 * TypeScript twin of `boundary.py` (ADR-096). Byte-for-byte parity on the
 * written JSONL and on the `BoundarySession` coalescing semantics.
 *
 * 1. `BoundarySession` — in-process coalescing. Multiple `add_*` calls
 *    within one boundary merge into a single emitted event (set-union on
 *    `consulted` / `applied`). Idempotent flush.
 * 2. `record_event` — durable append. The Python original takes a POSIX
 *    `fcntl.flock` when available and falls back to a best-effort append
 *    otherwise (`_HAS_FCNTL = False`). Node has no portable advisory lock
 *    in stdlib, so this twin is the documented best-effort-append branch:
 *    the bytes written are identical; only the cross-process interleave
 *    guarantee differs (the package ships on POSIX CI, single-writer in
 *    tests, so output parity is unaffected).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    ALLOWED_BOUNDARY_KINDS,
    ALLOWED_KINDS,
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
} from './engagement.js';

function _reprTuple(items: readonly string[]): string {
    const inner = items.map((s) => `'${s}'`).join(', ');
    return items.length === 1 ? `(${inner},)` : `(${inner})`;
}

function _reprScalar(v: unknown): string {
    if (typeof v === 'string') {
        return `'${v}'`;
    }
    return String(v);
}

/** Python `sorted()` on a list of str — lexicographic by code unit. */
function _sortedStrs(arr: Iterable<string>): string[] {
    return [...arr].sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
}

export class BoundarySession {
    task_id: string;
    boundary_kind: string;
    log_path: string;
    consulted: Map<string, Set<string>>;
    applied: Map<string, Set<string>>;
    private _flushed = false;
    private _has_data = false;

    constructor(init: { task_id: string; boundary_kind: string; log_path: string }) {
        this.task_id = init.task_id;
        this.boundary_kind = init.boundary_kind;
        this.log_path = init.log_path;
        this.consulted = new Map();
        this.applied = new Map();
        // __post_init__
        if (!(ALLOWED_BOUNDARY_KINDS as readonly string[]).includes(this.boundary_kind)) {
            throw new EngagementSchemaError(
                `boundary_kind must be one of ${_reprTuple(ALLOWED_BOUNDARY_KINDS)}`,
            );
        }
        if (typeof this.task_id !== 'string' || !this.task_id) {
            throw new EngagementSchemaError('task_id must be a non-empty string');
        }
    }

    add_consulted(kind: string, ids: Iterable<string>): void {
        this._merge(this.consulted, kind, ids);
    }

    add_applied(kind: string, ids: Iterable<string>): void {
        this._merge(this.applied, kind, ids);
    }

    private _merge(bucket: Map<string, Set<string>>, kind: string, ids: Iterable<string>): void {
        if (!(ALLOWED_KINDS as readonly string[]).includes(kind)) {
            throw new EngagementSchemaError(
                `${_reprScalar(kind)} is not an allowed artefact kind `
                + `(allowed: ${_reprTuple(ALLOWED_KINDS)})`,
            );
        }
        let target = bucket.get(kind);
        if (target === undefined) {
            target = new Set<string>();
            bucket.set(kind, target);
        }
        for (const art_id of ids) {
            if (typeof art_id !== 'string' || !art_id) {
                throw new EngagementSchemaError(`${kind} ids must be non-empty strings`);
            }
            target.add(art_id);
            this._has_data = true;
        }
    }

    to_event(): EngagementEvent {
        const consulted: Record<string, string[]> = {};
        for (const [k, v] of this.consulted) {
            if (v.size > 0) {
                consulted[k] = _sortedStrs(v);
            }
        }
        const applied: Record<string, string[]> = {};
        for (const [k, v] of this.applied) {
            if (v.size > 0) {
                applied[k] = _sortedStrs(v);
            }
        }
        return new EngagementEvent({
            ts: now_utc_iso(),
            task_id: this.task_id,
            boundary_kind: this.boundary_kind,
            consulted,
            applied,
        });
    }

    /** Write one merged event to the log. Returns true if written. */
    flush(): boolean {
        if (this._flushed || !this._has_data) {
            return false;
        }
        record_event(this.log_path, this.to_event());
        this._flushed = true;
        return true;
    }
}

/** Append one event. See module docstring for the lock-vs-bytes contract. */
export function record_event(log_path: string, event: EngagementEvent): void {
    event.validate();
    const payload = event.to_jsonl();
    fs.mkdirSync(path.dirname(log_path) || '.', { recursive: true });
    // O_WRONLY | O_CREAT | O_APPEND, 0o644 — best-effort append (no fcntl).
    const fd = fs.openSync(log_path, 'a', 0o644);
    try {
        fs.writeSync(fd, Buffer.from(payload, 'utf-8'));
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Convenience helper around `BoundarySession`. The Python `open_boundary`
 * is a context manager that flushes on clean exit and suppresses on
 * exception. The TS analogue takes a body callback for the same shape.
 */
export function open_boundary<T>(
    task_id: string,
    boundary_kind: string,
    log_path: string,
    body: (session: BoundarySession) => T,
): T {
    const session = new BoundarySession({ task_id, boundary_kind, log_path });
    const result = body(session);
    session.flush();
    return result;
}
