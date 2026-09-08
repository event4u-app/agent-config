/**
 * The continuity-record slot — capacity policy and state machine.
 *
 * `road-to-continuity-writer-activation` step 1.1. Until this module existed
 * the slot had a producer (`session:recycle`), a consumer
 * (`handoff_context_hook`) and no documented conflict ownership: the write was
 * an unguarded `atomic_write_json`, so a second publish replaced whatever sat
 * there and nobody had decided whether that was correct. With a MANUAL producer
 * the question was theoretical — a human ran the verb once. Automatic
 * production makes it routine, which is why the policy is settled here BEFORE
 * any automatic writer exists.
 *
 * The full contract, including why the two rejected alternatives are rejected
 * on tree evidence rather than on preference, is
 * `docs/contracts/continuity-record-slot.md`. This module is that document in
 * code; neither is the source of truth for the other's reasoning, and both are
 * checked by `tests/scripts/_lib_continuity_slot.test.ts`.
 *
 * The policy in one line:
 *
 *   SUPERSEDE OWN · REFUSE FOREIGN · QUARANTINE UNUSABLE · NEVER GO BACKWARDS.
 *
 * Why not create-if-absent.
 *
 * Create-if-absent is the policy the roadmap's own Risk 2 describes as a silent
 * data loss: "the successor resumes from something plausible and older". It is
 * rejected. Within one session the resident and the incoming record share a
 * key, a workspace and a predecessor — the incoming one is the same lineage at
 * a later moment, so keeping the older is a pure loss with no compensating
 * safety.
 *
 * Why not a bounded multi-record queue.
 *
 * Because the reader forbids the resolution such a queue would need. Picking
 * one of several records requires recency, and `recycle_envelope_paths.ts`
 * carries a recorded decision against exactly that ("No `latest` index, by
 * decision" — a pointer to the newest "would restore the shared write target
 * one layer up"). `resolveContinuityRecord` implements it: several candidates
 * and no session id START CLEAN rather than pick. A queue would either
 * contradict that lock or be unreadable.
 *
 * Where `consuming` lives.
 *
 * Nowhere on disk, and that is the answer rather than a gap. Consumption is a
 * single `fs.renameSync` from the authoritative name to the consumed name
 * (`handoff_context_hook.ts:199`), and publication is a single `fs.renameSync`
 * from a pid-suffixed temp name to the authoritative name
 * (`state_io.ts:_publish_text_locked`). A rename within one directory is
 * atomic on every filesystem this package supports, so an interruption lands
 * strictly before or strictly after it: the authoritative name holds either the
 * previous complete record or the new complete record, never a partial one.
 * `consuming` is therefore a transition, not a state, and no reader has to
 * tolerate a half-written record.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    recycle_consumed_rel,
    recycle_envelope_rel,
    recycle_quarantine_rel,
    RECYCLE_ENVELOPE_MAX_BYTES,
    RECYCLE_MAX_AGE_HOURS,
} from './recycle_envelope_paths.js';
import { validateRecycleEnvelope } from './subagent_capsule.js';
import { update_json_under_lock } from '../hooks/state_io.js';

/**
 * The slot's states.
 *
 * Five are observable on disk. `consuming` is declared because the roadmap step
 * names it and a reader looking for it deserves to find the reason it is not a
 * disk state rather than to conclude it was forgotten — see the module header.
 */
export const SLOT_STATES = [
    'absent',
    'published',
    'consuming',
    'consumed',
    'quarantined',
    'conflicting',
] as const;
export type SlotState = (typeof SLOT_STATES)[number];

/** What a publish attempt did, and why. The reason is always present. */
export interface PublishOutcome {
    /** `published` on a write; otherwise the state that refused it. */
    state: SlotState;
    /** Did the authoritative record change as a result of this call? */
    wrote: boolean;
    /** One line, always present — emitted by callers, never dropped. */
    reason: string;
    /** Absolute path of the record moved aside, when one was. */
    quarantined?: string;
}

/** What {@link inspectSlot} found, without changing anything. */
export interface SlotInspection {
    state: SlotState;
    reason: string;
    /** The authoritative path this session's records live at. */
    target: string;
    /** Parsed resident record, when one is present AND parseable. */
    resident?: Record<string, unknown>;
}

/** Hours a record stays usable — the reader's own bound, not a second one. */
const MAX_AGE_MS = RECYCLE_MAX_AGE_HOURS * 3600 * 1000;

function _parse(file: string): Record<string, unknown> | null {
    try {
        const decoded: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
            return decoded as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

/** Milliseconds since a record's `written_at`, or `null` when it has none. */
function _ageMs(record: Record<string, unknown>, now: Date): number | null {
    const raw = record['written_at'];
    if (typeof raw !== 'string') return null;
    const at = Date.parse(raw);
    if (Number.isNaN(at)) return null;
    return now.getTime() - at;
}

/**
 * Read the slot for `session_id` without touching it.
 *
 * `conflicting` here is a statement about the RESIDENT relative to the caller's
 * identity, which is why the session id is required rather than optional: a
 * record is foreign only with respect to somebody.
 */
export function inspectSlot(
    workspace_root: string,
    session_id: string | null | undefined,
    now: Date = new Date(),
): SlotInspection {
    const target = path.join(workspace_root, recycle_envelope_rel(session_id));
    if (!fs.existsSync(target)) {
        const consumed = path.join(workspace_root, recycle_consumed_rel(session_id));
        if (fs.existsSync(consumed)) {
            return { state: 'consumed', reason: 'the record for this session was consumed', target };
        }
        const quarantined = path.join(workspace_root, recycle_quarantine_rel(session_id));
        if (fs.existsSync(quarantined)) {
            return {
                state: 'quarantined',
                reason: 'the slot is free; an unusable record sits in quarantine',
                target,
            };
        }
        return { state: 'absent', reason: 'no record in this slot', target };
    }
    const resident = _parse(target);
    if (resident === null) {
        return { state: 'quarantined', reason: 'the resident record does not parse as an object', target };
    }
    const violations = validateRecycleEnvelope(resident);
    if (violations.length > 0) {
        return {
            state: 'quarantined',
            reason: `the resident record fails validation (${violations.length} violation(s))`,
            target,
            resident,
        };
    }
    const age = _ageMs(resident, now);
    if (age === null || age > MAX_AGE_MS) {
        return {
            state: 'quarantined',
            reason:
                age === null
                    ? 'the resident record carries no parseable written_at'
                    : `the resident record is older than ${RECYCLE_MAX_AGE_HOURS} h`,
            target,
            resident,
        };
    }
    const owner = String(resident['session_id'] ?? '').trim();
    const mine = String(session_id ?? '').trim();
    if (owner !== '' && mine !== '' && owner !== mine) {
        return {
            state: 'conflicting',
            reason: `the slot holds an unconsumed record belonging to session ${owner}`,
            target,
            resident,
        };
    }
    return { state: 'published', reason: 'this session has an unconsumed record', target, resident };
}

/**
 * Publish `record` into this session's slot under the capacity policy.
 *
 * Never throws for a policy reason: a refusal is a return value, because this
 * runs on the Stop path where an exception is a worse outcome than a missed
 * record. A genuine I/O failure is reported as `wrote: false` with the reason,
 * for the same reason.
 *
 * The write itself goes through {@link update_json_under_lock} rather than
 * `atomic_write_json`, and the difference is the whole point: the locked form
 * gives a read-modify-write, so the resident is inspected and the decision
 * taken INSIDE the exclusion that stops a peer from publishing between the
 * inspection and the write. `atomic_write_json` — the path
 * `session:recycle` still uses — has no such window and cannot express a
 * refusal.
 */
export function publishContinuityRecord(
    workspace_root: string,
    session_id: string | null | undefined,
    record: Record<string, unknown>,
    now: Date = new Date(),
): PublishOutcome {
    const violations = validateRecycleEnvelope(record);
    if (violations.length > 0) {
        return {
            state: 'absent',
            wrote: false,
            reason: `refused — the record to publish fails validation: ${violations[0] as string}`,
        };
    }
    const bytes = Buffer.byteLength(JSON.stringify(record, null, 2), 'utf-8');
    if (bytes > RECYCLE_ENVELOPE_MAX_BYTES) {
        return {
            state: 'absent',
            wrote: false,
            reason: `refused — ${bytes} bytes exceeds the ${RECYCLE_ENVELOPE_MAX_BYTES} byte slot cap`,
        };
    }

    const target = path.join(workspace_root, recycle_envelope_rel(session_id));
    const before = inspectSlot(workspace_root, session_id, now);

    // A foreign, still-usable record is not this session's to move or replace.
    // Refusing costs this session's resume; superseding costs another session's,
    // and that one has no way to find out.
    if (before.state === 'conflicting') {
        return { state: 'conflicting', wrote: false, reason: `refused — ${before.reason}` };
    }

    // Monotonicity. A delayed or retried publisher must not roll the slot back
    // to an earlier moment of the same session.
    if (before.state === 'published' && before.resident !== undefined) {
        const residentAt = Date.parse(String(before.resident['written_at'] ?? ''));
        const incomingAt = Date.parse(String(record['written_at'] ?? ''));
        if (!Number.isNaN(residentAt) && !Number.isNaN(incomingAt) && incomingAt < residentAt) {
            return {
                state: 'published',
                wrote: false,
                reason: 'refused — the resident record is newer than the one offered',
            };
        }
    }

    let quarantined: string | undefined;
    if (before.state === 'quarantined' && fs.existsSync(target)) {
        // Move aside, never delete. See `recycle_quarantine_rel`.
        const dest = path.join(workspace_root, recycle_quarantine_rel(session_id));
        try {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.renameSync(target, dest);
            quarantined = dest;
        } catch (exc) {
            return {
                state: 'quarantined',
                wrote: false,
                reason: `refused — could not quarantine the unusable resident: ${String(exc)}`,
            };
        }
    }

    const result = update_json_under_lock<Record<string, unknown>>(target, () => record);
    if (result !== 'written') {
        return {
            state: before.state,
            wrote: false,
            reason: `refused — the slot write did not complete (${result})`,
            ...(quarantined !== undefined ? { quarantined } : {}),
        };
    }
    return {
        state: 'published',
        wrote: true,
        reason:
            before.state === 'published'
                ? 'superseded this session’s earlier record'
                : `published into a ${before.state} slot`,
        ...(quarantined !== undefined ? { quarantined } : {}),
    };
}
