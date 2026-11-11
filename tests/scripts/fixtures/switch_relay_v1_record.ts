// The record reader of 20.2.0, kept verbatim from src/scripts/_lib/switch_relay.ts
// at tag 20.2.0 (lines 26, 28, 38, 67-69, 71-73, 82-84, 188-197, 205-218), so a
// test can read with that version what this one writes. Do not edit it to match
// the current reader; only the `export` keyword is added to `parseRecord`.
const HOUR_MS = 3_600_000;
const RECORD_MAX_MS = 7 * 24 * HOUR_MS;
const ID_RE = /^[0-9a-f]{16}$/;

function obj(x: unknown): Record<string, unknown> | null {
    return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}
function str(x: unknown): string | null {
    return typeof x === 'string' && x !== '' ? x : null;
}
function num(x: unknown): number | null {
    return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export interface SwitchRecord {
    readonly id: string;
    readonly decision_told: boolean;
    /** Set by the Stop path once the run checkpoint for an approved move was written. */
    readonly checkpointed: boolean;
    /** Set once a terminal outcome was shown; a `done` record outlives that until the Stop path checkpointed it. */
    readonly outcome_told: boolean;
    /** Epoch ms after which the record is dropped unread, so an orphaned one stops polling. */
    readonly expires_at: number;
}

export function parseRecord(raw: string, mtimeMs: number): SwitchRecord | null {
    const o = obj(JSON.parse(raw));
    const id = str(o?.['id']);
    if (o === null || id === null || !ID_RE.test(id)) return null;
    // A record written before records carried an expiry lasts as long as the ceiling from its last write.
    const expires = num(o['expires_at']) ?? mtimeMs + RECORD_MAX_MS;
    return {
        id,
        decision_told: o['decision_told'] === true,
        checkpointed: o['checkpointed'] === true,
        outcome_told: o['outcome_told'] === true,
        expires_at: expires,
    };
}
