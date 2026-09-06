/**
 * Recycle-envelope filesystem contract (road-to-token-economy-recycling
 * Phase 2.2/2.3) — the ONE place the producer (`session:recycle`) and the
 * consumer (`handoff_context_hook`) agree on where the envelope lives and
 * when it is stale. A second copy of any of these values is the drift seam
 * Risk 6 warns about.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { safe_stem } from './session_register.js';

/** Where `session:recycle` writes the pending envelope (gitignored runtime state). */
export const RECYCLE_ENVELOPE_REL = path.join('agents', 'runtime', 'state', 'recycle-envelope.json');

/**
 * Where the consumer MOVES the envelope on consumption — moved, not copied,
 * so a consumed or rejected envelope can never leak into a later session,
 * while the last one stays inspectable for debugging.
 */
export const RECYCLE_CONSUMED_REL = path.join(
    'agents',
    'runtime',
    'state',
    'recycle-envelope.consumed.json',
);

/** Staleness guard — mirrors the handoff file's 48 h discipline. */
export const RECYCLE_MAX_AGE_HOURS = 48;

/**
 * Producer-side size cap on the serialized envelope. The schema's per-field
 * caps make a transcript-shaped envelope invalid; this cap keeps even a
 * legal envelope inside the `handoff-context` injection budget
 * (`src/config/hook-token-budget.json`: 8192 B for the concern) with room
 * for the wrapper block and a co-pending handoff.
 */
export const RECYCLE_ENVELOPE_MAX_BYTES = 6144;

// ---------------------------------------------------------------------
// Per-SESSION keying (road-to-one-continuity-record Phase 2.1)
// ---------------------------------------------------------------------

/** State directory the two constants above live in. */
const _STATE_REL = path.join('agents', 'runtime', 'state');

/**
 * Per-SESSION record path. The two constants above name **one file per
 * workspace**, and the session register in the same tree models concurrent
 * sessions per checkout — so the continuity artifact and the identity model
 * disagreed, and the artifact lost. Two sessions in one checkout overwrite
 * each other's record and each resumes from whichever wrote last.
 *
 * This is the same defect `roadmap_claim_rel` (`session_register_hook.ts:105`)
 * was repaired for, and it is deliberately repaired the same way rather than a
 * better way: one shape for "state keyed by session", so a reader who has seen
 * one recognises the other. `safe_stem` is imported from the register rather
 * than re-implemented — a second sanitiser is a second traversal guard to keep
 * correct.
 *
 * **No `latest` index, by decision.** A pointer file naming the newest record
 * would restore the shared write target one layer up and re-create the same
 * race with an extra indirection. Resolution is by register identity,
 * workspace and branch — never by recency.
 *
 * When no session id is resolvable the legacy shared path is returned, so an
 * older record keeps working and the fallback degrades to the previous
 * behaviour instead of losing the record. The reader's ambiguity rule
 * (`resolveContinuityRecord`) is what keeps that fallback from becoming a
 * cross-session read.
 */
export function recycle_envelope_rel(session_id: string | null | undefined): string {
    return _sessionKeyed(session_id, RECYCLE_ENVELOPE_REL, 'recycle-envelope', '.json');
}

/** Consumed sibling of {@link recycle_envelope_rel}, same keying. */
export function recycle_consumed_rel(session_id: string | null | undefined): string {
    return _sessionKeyed(session_id, RECYCLE_CONSUMED_REL, 'recycle-envelope', '.consumed.json');
}

/**
 * Shared builder. Containment is asserted locally rather than trusted from
 * `safe_stem`: a guarantee living in another module's implementation is one
 * refactor away from being untrue here, and the failure mode of being wrong is
 * a write outside the state directory.
 */
function _sessionKeyed(
    session_id: string | null | undefined,
    legacy: string,
    stem: string,
    suffix: string,
): string {
    const id = String(session_id ?? '').trim();
    if (id === '') {
        return legacy;
    }
    const rel = path.join(_STATE_REL, `${stem}-${safe_stem(id)}${suffix}`);
    const norm = path.normalize(rel);
    if (!norm.startsWith(`${_STATE_REL}${path.sep}`) || norm.includes('..')) {
        return legacy;
    }
    return norm;
}

/** Every session-keyed record present in a workspace, plus the legacy file. */
export function listContinuityRecords(workspace_root: string): string[] {
    const dir = path.join(workspace_root, _STATE_REL);
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter(
            (n) =>
                n.startsWith('recycle-envelope') &&
                n.endsWith('.json') &&
                !n.endsWith('.consumed.json'),
        )
        .sort()
        .map((n) => path.join(dir, n));
}

/** What {@link resolveContinuityRecord} decided, and why — the reason is emitted, never dropped. */
export interface ContinuityResolution {
    /** Absolute path to read, or `null` when the reader must start clean. */
    file: string | null;
    /** One line, always present. On `file === null` this is what the reader says out loud. */
    reason: string;
}

/**
 * Which record THIS session may read.
 *
 * Three cases, and the third is the one the per-session key exists for:
 *
 * 1. **Own id resolves.** Read the record keyed to it, and nothing else. A peer
 *    session's record is not a candidate at any point, so "neither observes the
 *    other's" holds by construction rather than by a comparison that could be
 *    skipped.
 * 2. **No id, one candidate.** Read it. A single record in a checkout with no
 *    resolvable identity is the pre-key situation and is unchanged.
 * 3. **No id, several candidates.** START CLEAN and say so. Picking the newest
 *    is precisely the recency resolution the no-index rule forbids: it would
 *    hand this session a stranger's state and look like a successful resume.
 */
export function resolveContinuityRecord(
    workspace_root: string,
    session_id: string | null | undefined,
): ContinuityResolution {
    const id = String(session_id ?? '').trim();
    if (id !== '') {
        const own = path.join(workspace_root, recycle_envelope_rel(id));
        return fs.existsSync(own)
            ? { file: own, reason: `continuity record for this session (${safe_stem(id)})` }
            : { file: null, reason: `no continuity record for this session (${safe_stem(id)})` };
    }
    const candidates = listContinuityRecords(workspace_root);
    if (candidates.length === 0) {
        return { file: null, reason: 'no continuity record present' };
    }
    if (candidates.length === 1) {
        return { file: candidates[0] as string, reason: 'one continuity record, no session id to key on' };
    }
    return {
        file: null,
        reason:
            `starting clean: ${candidates.length} continuity records in this workspace and no session id ` +
            'to tell them apart — resuming from the newest would resume a peer session, not this one',
    };
}

/**
 * Is there any trace in this workspace of the session a record names as its
 * predecessor?
 *
 * The normal case resolves through the consumed sibling: when this session
 * started, its reader consumed the predecessor's record and moved it to this
 * session's consumed path, so that file carries `session_id === predecessor`.
 * A live record under the predecessor's own key also counts — that is the
 * shape when the chain has not been walked yet.
 *
 * **A `false` here is a refusal, not a repair.** The reader discards the record
 * and says why. The alternative — injecting a record whose stated lineage
 * cannot be corroborated — is the guess this check exists to prevent, and it is
 * the expensive direction: a refused resume costs one session's context, a
 * wrong resume costs a session working from a stranger's state without knowing
 * it.
 *
 * **Known false-refusal, stated rather than hidden:** the janitor prunes old
 * state, so a long-idle chain can lose its consumed sibling and be refused
 * although it was genuine. That is the same cost as the record having expired,
 * which at {@link RECYCLE_MAX_AGE_HOURS} it very likely has.
 */
export function predecessorTracePresent(workspace_root: string, predecessor: string): boolean {
    const id = String(predecessor ?? '').trim();
    if (id === '' || id === 'none') {
        return true;
    }
    if (fs.existsSync(path.join(workspace_root, recycle_envelope_rel(id)))) {
        return true;
    }
    const dir = path.join(workspace_root, _STATE_REL);
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return false;
    }
    for (const n of names) {
        if (!n.startsWith('recycle-envelope') || !n.endsWith('.json')) continue;
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')) as {
                session_id?: unknown;
            };
            if (String(raw.session_id ?? '').trim() === id) {
                return true;
            }
        } catch {
            // unreadable file proves nothing in either direction
        }
    }
    return false;
}
