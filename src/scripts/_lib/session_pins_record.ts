/**
 * The session-pin restore record, read the same way everywhere: by the eager
 * `language-mirror` precheck (which decides whether to load the pin chunk at
 * all) and by the chunk's own locked transition. One reader, so the two cannot
 * drift apart — the bundle reaches this small module, not the chunk.
 *
 * loss_class: ephemeral-lossy
 *
 * Only bookkeeping is ever dropped, never a pin: a compaction stamp over
 * {@link STAMP_MAX_CHARS} characters is ignored (with a stderr line), and
 * stamps older than the {@link SEEN_MAX} window are forgotten. Pin text is
 * refused whole or kept whole elsewhere, never shortened.
 */
import fs from 'node:fs';

import { owns_session_state } from '../hooks/state_io.js';

export interface RestoreRecord {
    readonly delivered: boolean;
    readonly pending: boolean;
    readonly seen: readonly string[];
}

/**
 * Acknowledged stamps kept. The guarantee is narrowed to this window: a stamp
 * older than the session's last 512 acknowledged compactions is forgotten and
 * could reopen once. A stamp `pre_compact` writes is about 45 bytes, so a
 * record it produced stays under 25 KB; validation accepts at most 512 stamps of
 * {@link STAMP_MAX_CHARS} characters, so a hand-written one stays in the low
 * hundreds of kilobytes. A paused event outliving 512 compactions is not a
 * realistic case.
 */
export const SEEN_MAX = 512;
/** A stamp is about 45 characters; anything far longer was not written by `pre_compact`. */
export const STAMP_MAX_CHARS = 200;

/**
 * The one admission rule for a compaction stamp read from the boundary or the
 * pin-lost marker, applied before any transition opens or acknowledges it: an
 * oversized stamp is unknown (''), never recorded — the reader below would
 * refuse the record it ended up in, and the compaction would reopen forever.
 */
export function admitStamp(raw: string): string {
    const stamp = raw.trim();
    if (stamp.length <= STAMP_MAX_CHARS) return stamp;
    process.stderr.write(`session-pins: compaction stamp over ${STAMP_MAX_CHARS} characters ignored\n`);
    return '';
}

/**
 * The record, `null` when there is none, `'invalid'` when it cannot be accepted
 * as this session's — including a `seen` list over the window or holding
 * anything but stamps, which is refused whole rather than filtered into
 * apparent validity.
 */
export function readRestoreRecord(raw: string | null, session_id: string): RestoreRecord | null | 'invalid' {
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<RestoreRecord> & { session_id?: unknown };
        if (!owns_session_state(parsed, session_id) || typeof parsed.delivered !== 'boolean') return 'invalid';
        // Written as a boolean or not at all; anything else is corruption, not `false`.
        if (parsed.pending !== undefined && typeof parsed.pending !== 'boolean') return 'invalid';
        const seen: unknown = parsed.seen;
        if (
            seen !== undefined &&
            (!Array.isArray(seen) ||
                seen.length > SEEN_MAX ||
                !seen.every((x) => typeof x === 'string' && x.length <= STAMP_MAX_CHARS) ||
                new Set(seen).size !== seen.length)
        ) {
            return 'invalid';
        }
        return {
            delivered: parsed.delivered,
            pending: parsed.pending === true,
            seen: parsed.seen ?? [],
        };
    } catch {
        return 'invalid';
    }
}

/** Does this record, with this boundary stamp ('' when none), leave a delivery or restatement open? */
export function restoreOwed(record: RestoreRecord | null | 'invalid', stamp: string): boolean {
    if (record === 'invalid') return true;
    const opens = stamp !== '' && !(record?.seen ?? []).includes(stamp);
    return opens || (record !== null && (!record.delivered || record.pending));
}

/** Exists, but could not be read: never the same as absent. */
export function presentButUnread(file: string): boolean {
    try {
        fs.lstatSync(file);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code !== 'ENOENT';
    }
}
