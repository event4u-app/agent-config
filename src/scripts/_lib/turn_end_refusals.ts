/**
 * `turn-end-gate` refusal accounting — the number a blocking gate owes.
 *
 * `road-to-stop-gate-honesty` § D-2: per-session ordinal state exists, but
 * nothing aggregates refusals into a rate anyone reviews. Every advisory in this
 * estate carries a registered kill standard; the one BLOCKING concern carries
 * none, and a gate that blocks unobserved is the shape that discipline exists to
 * prevent.
 *
 * This module is the reader. It owns five things and deliberately not a sixth:
 *
 *   1. the on-disk record shape, extended so a session's refusals are COUNTED
 *      rather than overwritten (§ Phase 1 step 1.1);
 *   2. a TTL prune, which the gate's own header admits is missing (step 1.2);
 *   3. the split by recorded package version, so claim 10's prediction — that
 *      refusals correlate with the local 12.1 install — is TESTED rather than
 *      assumed (step 1.3);
 *   4. the SHADOW record — what a retry would have been refused for, written on
 *      an allow path (`road-to-a-stop-that-holds` step 2.1);
 *   5. the rollup over those records (step 2.2). Read `ShadowLayerStats` before
 *      quoting anything it produces: the share it computes is NOT the Q1 the
 *      demotion contract registers bars against, and the difference is named
 *      there rather than left to a reader of the number.
 *
 * (This list read "three things and deliberately not a fourth" until 2026-10-01.
 * It was accurate when written and silently false for the two steps after it —
 * an independent review caught it. Items 4 and 5 are the two that landed.)
 *
 * The fourth thing it does not own is a **rate over all sessions**, and the
 * reason is structural rather than an omission. A record is written only when a
 * turn is refused, so a session that was never refused leaves no file at all.
 * The denominator this module can honestly report is *sessions that had at least
 * one refusal*; refusals-per-session-overall would need a per-session marker
 * written on every session, which is a write on the hot Stop path that step 1.1
 * explicitly refuses ("adds no spawn"). `sessionsWithRefusals` is named for what
 * it is so a reader cannot mistake it for the wider denominator.
 *
 * ## Backward compatibility is not optional here
 *
 * The field already holds records in the pre-count shape — 36 of them on the
 * maintainer machine at the time of writing, spanning 2026-08-12 (the day the
 * settings switch was removed) to 2026-08-17. Discarding them would throw away
 * the only field evidence this roadmap has. A legacy record carries one detector
 * and one timestamp, so it counts as exactly ONE refusal of that detector, and
 * `legacyRecords` reports how much of the total came from that weaker shape.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { read_lockfile } from './installed_lock.js';

/**
 * The five detectors, in the order the gate runs them.
 *
 * The roadmap's § 0 names three (A promissory, B language, C verification).
 * That was true of the draft and is not true of the tree: detector D
 * (`completion`) landed under round 7 § Phase 1, detector E
 * (`pending-decision`) under road-to-a-question-that-survives-the-turn, and
 * detector F (`untested`) on 2026-09-11 — all of which run in the same detector
 * list as the first three. Counting three would silently drop a detector's
 * refusals, so the set is read off `DetectorId` in the gate rather than off the
 * prose.
 *
 * F is the one that asks whether a change is TESTED rather than whether
 * something ran: C is satisfied by `eslint`, which is how a feature with zero
 * test lines passed every guard in that file.
 *
 * This said "the same UNCONDITIONAL list" until 2026-08-18, which was wrong and
 * is worth naming rather than quietly rewording: `main()` runs A and D only when
 * no subagent dispatch is open. It does not change this set — every detector
 * that CAN fire needs a counter — but it does change what a reader may conclude
 * from a zero here: A's and D's counts are censored by that third allow path,
 * and `docs/contracts/turn-end-detector-demotion.md` is where that consequence
 * is carried.
 */
export const DETECTOR_IDS = [
    'promissory',
    'language',
    'verification',
    'completion',
    'pending-decision',
    'untested',
] as const;

export type RefusalDetectorId = (typeof DETECTOR_IDS)[number];

export type DetectorCounts = Record<RefusalDetectorId, number>;

/** State directory, relative to a workspace root. Shared with the gate. */
export const REFUSAL_STATE_REL = path.join('agents', 'runtime', 'state', 'turn-end-gate');

export function refusalStateDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, REFUSAL_STATE_REL);
}

/**
 * The filename stem for a session's refusal record.
 *
 * Defined here rather than in the gate because two modules now need it — the
 * gate writes the file and the session register reads its own session's counts
 * back for live per-session visibility (D-2's "no per-session visibility into
 * how often it happens"). A second sha256 spelled out in the reader is how a
 * reader and a writer end up disagreeing about which file they mean.
 */
export function deriveSessionKey(sessionId: string): string {
    return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 32);
}

export function sessionRefusalFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(refusalStateDir(workspaceRoot), `${sessionKey}.json`);
}

/**
 * This session's own refusal counts, or `null` when it has never been refused.
 *
 * Cheap by construction: one `readFileSync` of a record that is a few hundred
 * bytes, on a path the caller already touches. Step 1.1 requires the counter to
 * ride the existing session-register write and add no spawn, and this is what
 * makes that possible.
 */
export function readSessionCounts(
    workspaceRoot: string,
    sessionId: string,
): DetectorCounts | null {
    try {
        const raw = fs.readFileSync(
            sessionRefusalFile(workspaceRoot, deriveSessionKey(sessionId)),
            'utf-8',
        );
        const rec = parseRecord(raw);
        return rec === null ? null : countsOf(rec);
    } catch {
        return null;
    }
}

/**
 * One session's refusal record.
 *
 * `refused_turn` and `detector` keep their original meaning exactly — the
 * re-entrancy guard reads `refused_turn` and nothing else, so extending this
 * record cannot change whether a turn is refused twice. Everything below them
 * is additive.
 */
export interface RefusalRecord {
    /** ISO stamp of the MOST RECENT refusal in this session. */
    refused_at: string;
    /** Turn ordinal of the most recent refusal — the re-entrancy marker. */
    refused_turn: number;
    /** First detector of the most recent refusal. Kept for compatibility. */
    detector: RefusalDetectorId;
    /** ISO stamp of the FIRST refusal in this session. Added 2026-08-17. */
    first_refused_at?: string;
    /** Cumulative per-detector refusal counts for this session. */
    counts?: Partial<DetectorCounts>;
    /** Package version recorded at the most recent refusal, when readable. */
    agent_config_version?: string;
    /**
     * The host's own id for the prompt being processed at the most recent
     * refusal, when the payload carries one.
     *
     * Recorded BESIDE `refused_turn`, never instead of it. The ordinal stays the
     * re-entrancy key — its drift history is why both guard layers exist, and
     * swapping the key of a wedge-critical guard on an axis nothing measures is
     * a behaviour change dressed as a correction. What the pair buys is the
     * measurement: two refusals carrying the same `refused_prompt_id` and
     * different `refused_turn` are one prompt whose ordinal drifted, which is
     * the failure this file's own header describes and which the ordinal alone
     * cannot distinguish from two genuine turns.
     */
    refused_prompt_id?: string;
}

/**
 * A zeroed counter per detector, DERIVED from `DETECTOR_IDS` rather than
 * written out.
 *
 * It was an object literal of four keys until detector E landed, and the
 * literal is what made adding a detector a silent arithmetic defect rather than
 * a type error: `DetectorCounts` is `Record<RefusalDetectorId, number>`, the
 * literal satisfied it for the union of the day, and a fifth id then read back
 * as `undefined` — so every `+=` over it produced `NaN` and the whole rollup
 * went quiet. The sibling test asserts that the id list and the gate's union
 * agree; nothing asserted that the COUNTER covered the list, which is the half
 * this construction removes the need to assert.
 */
export function emptyCounts(): DetectorCounts {
    const out = {} as DetectorCounts;
    for (const id of DETECTOR_IDS) out[id] = 0;
    return out;
}

function isDetector(v: unknown): v is RefusalDetectorId {
    return typeof v === 'string' && (DETECTOR_IDS as readonly string[]).includes(v);
}

/**
 * Parse one record. Returns `null` for anything unreadable — a malformed state
 * file must never become an exception on the Stop path, which is the same
 * fail-open contract the gate itself keeps.
 */
export function parseRecord(raw: string): RefusalRecord | null {
    let decoded: unknown;
    try {
        decoded = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
    const o = decoded as Record<string, unknown>;
    if (typeof o['refused_at'] !== 'string') return null;
    if (typeof o['refused_turn'] !== 'number') return null;
    if (!isDetector(o['detector'])) return null;
    const rec: RefusalRecord = {
        refused_at: o['refused_at'],
        refused_turn: o['refused_turn'],
        detector: o['detector'],
    };
    if (typeof o['first_refused_at'] === 'string') rec.first_refused_at = o['first_refused_at'];
    if (typeof o['agent_config_version'] === 'string') {
        rec.agent_config_version = o['agent_config_version'];
    }
    if (typeof o['refused_prompt_id'] === 'string') {
        rec.refused_prompt_id = o['refused_prompt_id'];
    }
    const counts = o['counts'];
    if (typeof counts === 'object' && counts !== null && !Array.isArray(counts)) {
        const parsed: Partial<DetectorCounts> = {};
        for (const id of DETECTOR_IDS) {
            const n = (counts as Record<string, unknown>)[id];
            if (typeof n === 'number' && Number.isFinite(n) && n >= 0) parsed[id] = n;
        }
        rec.counts = parsed;
    }
    return rec;
}

/**
 * The per-detector counts a record contributes.
 *
 * A record written before counts existed contributes one refusal of its single
 * recorded detector — the honest floor, since the old shape overwrote itself and
 * cannot say how many times that session was refused.
 */
export function countsOf(rec: RefusalRecord): DetectorCounts {
    const out = emptyCounts();
    if (rec.counts === undefined) {
        out[rec.detector] = 1;
        return out;
    }
    let any = false;
    for (const id of DETECTOR_IDS) {
        const n = rec.counts[id];
        if (typeof n === 'number' && n > 0) {
            out[id] = n;
            any = true;
        }
    }
    // A counts block that is present but all-zero is a record whose writer knew
    // about counts and recorded none — treat it like the legacy shape rather
    // than reporting a refusal that left no trace of which detector fired.
    if (!any) out[rec.detector] = 1;
    return out;
}

/**
 * Fold one refusal into a record. Pure — the caller writes.
 *
 * `detectors` is every finding of THIS refusal, not just the first. The gate
 * stores `findings[0].detector` in `detector` for compatibility, but a turn that
 * trips B and C at once is two detector observations and counting it as one
 * would understate whichever detector lost the tie — precisely the pooling the
 * roadmap's step 1.1 forbids ("per detector separately ... a pooled rate would
 * hide which one is firing").
 */
export function foldRefusal(
    prev: RefusalRecord | null,
    input: {
        detectors: readonly RefusalDetectorId[];
        turnOrdinal: number;
        at: string;
        version?: string | undefined;
        promptId?: string | undefined;
    },
): RefusalRecord {
    const counts = prev === null ? emptyCounts() : countsOf(prev);
    for (const d of input.detectors) counts[d] += 1;
    const primary = input.detectors[0] ?? prev?.detector ?? 'verification';
    const rec: RefusalRecord = {
        refused_at: input.at,
        refused_turn: input.turnOrdinal,
        detector: primary,
        first_refused_at: prev?.first_refused_at ?? prev?.refused_at ?? input.at,
        counts,
    };
    if (input.version !== undefined) rec.agent_config_version = input.version;
    else if (prev?.agent_config_version !== undefined) {
        rec.agent_config_version = prev.agent_config_version;
    }
    // Not inherited from `prev` when this refusal carries none: the field
    // describes THIS refusal's prompt, and carrying a previous one forward would
    // read as an identity the payload never supplied.
    if (input.promptId !== undefined && input.promptId !== '') {
        rec.refused_prompt_id = input.promptId;
    }
    return rec;
}

// ---------------------------------------------------------------------------
// The install boundary — step 1.3
// ---------------------------------------------------------------------------

export interface InstallBoundary {
    version: string | null;
    installed_at: string | null;
}

/**
 * The machine's own install stamp, read from `~/.event4u/agent-config/installed.lock`.
 *
 * **What this can and cannot answer, because the difference decides whether
 * step 1.3 tests claim 10 or merely looks like it does.** The lockfile records
 * the version that performed the MOST RECENT install and when — not the date any
 * particular version arrived. On a machine that has since upgraded past the
 * version under suspicion, `installed_at` is the newer install's date and a
 * before/after split on it says nothing about 12.1.
 *
 * That is why the record carries `agent_config_version` at refusal time and why
 * `collectRefusalStats` splits by RECORDED VERSION as its primary axis: a
 * version stamped on the refusal itself is evidence, a date compared against a
 * moving lockfile is an inference. The boundary is still reported, because it is
 * the only thing that dates the corpus written before versions were recorded.
 */
export function readInstallBoundary(): InstallBoundary {
    try {
        const lock = read_lockfile();
        if (lock === null) return { version: null, installed_at: null };
        return {
            version: lock.agent_config_version ?? null,
            installed_at: lock.installed_at ?? null,
        };
    } catch {
        return { version: null, installed_at: null };
    }
}

// ---------------------------------------------------------------------------
// The shadow read — road-to-a-stop-that-holds step 2.1
// ---------------------------------------------------------------------------

/**
 * One observation of "this retry would still have been refused".
 *
 * `turn-end-detector-demotion.md` § Q1 asks what share of the turns the gate
 * allows on a re-entrancy layer would have been refused again. Both layers
 * return `EXIT_ALLOW` unconditionally, so that share is not derivable from the
 * refusal record: a retry leaves no trace at all, and a detector that fired
 * twice is indistinguishable from one that was satisfied on the second pass.
 * This row is that trace.
 *
 * `layer` is which allow path produced it, because the two are not the same
 * measurement. `stop_hook_active` is the HOST's answer and is set on any stop
 * hook's block, including another concern's; `refused_turn` is this gate's own
 * marker and therefore always follows a refusal by this gate. Pooling them
 * would let another concern's retries inflate Q1's numerator against a
 * denominator that only counts this gate's refusals.
 */
/**
 * Who set the `stop_hook_active` flag this row was recorded under.
 *
 * `layer` already says WHICH allow path produced the row, and the doc above
 * says the host sets `stop_hook_active` on ANY stop hook's block — including a
 * neighbour's. What it could not say is which: a `stop_hook_active` row and a
 * `refused_turn` row were the only two things the record distinguished, so a
 * retry caused by a foreign concern and a retry caused by this gate were
 * indistinguishable once the layer was `stop_hook_active`.
 *
 *  - `ours`    — this session's refusal record exists and parses, so this gate
 *                refused at some point before this stop.
 *  - `foreign` — the record is ABSENT. This gate never refused in this session,
 *                and the host set the flag anyway, so something else did.
 *  - `unknown` — the record exists and could not be read. The distinction from
 *                `foreign` is the whole point: "we did not refuse" and "we
 *                cannot tell whether we refused" are different findings, and
 *                collapsing them would let an unreadable state directory read
 *                as evidence of a neighbour.
 *
 * On the `refused_turn` layer the answer is `ours` by construction — that
 * marker is this gate's own and no other writer sets it.
 */
export type ShadowSetBy = 'ours' | 'foreign' | 'unknown';

export interface WouldRefuseAgainRow {
    detector: RefusalDetectorId;
    /** The turn ordinal the shadow ran on — joins to `refused_turn`. */
    turn: number;
    at: string;
    layer: ShadowLayer;
    /**
     * Absent on rows written before this field existed, which parse as
     * `unknown` rather than being dropped — an old row is still a real
     * observation of a retry, and discarding it would silently lower Q1's
     * numerator.
     */
    set_by: ShadowSetBy;
}

/**
 * The two allow paths a shadow read can run on, in the order `main()` reaches
 * them.
 *
 * A LIST rather than a bare union, and the counter below is derived from it,
 * for the reason `emptyCounts` gives one screen up: a hand-written counter
 * object satisfied `Record<Union, number>` on the day it was typed and read
 * back `undefined` the moment a member was added, so every `+=` over it
 * produced `NaN` and the whole rollup went quiet. Adding a third layer here
 * cannot repeat that.
 */
export const SHADOW_LAYERS = ['stop_hook_active', 'refused_turn'] as const;

export type ShadowLayer = (typeof SHADOW_LAYERS)[number];

/** A zeroed retry counter per layer, DERIVED from `SHADOW_LAYERS`. */
export function emptyRetryCounts(): Record<ShadowLayer, number> {
    const out = {} as Record<ShadowLayer, number>;
    for (const l of SHADOW_LAYERS) out[l] = 0;
    return out;
}

/**
 * Per-session shadow state, in its own file beside the refusal record.
 *
 * SEPARATE FILE, deliberately, and this is the one design decision in the step
 * worth defending. The plan says "into the session state" and the refusal
 * record is the obvious place — but `refused_turn` in that record is the
 * re-entrancy wedge guard, `parseRecord` rejects any record lacking it, and a
 * Layer-1 retry can occur with no refusal by this gate at all (another stop
 * concern blocked). Writing a shadow row there would mean either synthesising
 * a `refused_turn` this gate never wrote — corrupting the one field a wedge
 * depends on — or loosening the parser that protects it. A sibling file costs
 * one more path and touches neither.
 *
 * It lives in this module rather than in the gate for the reason the header
 * already gives about the pruner: a directory with two writers each holding
 * their own idea of where the files are is how a reader and a writer end up
 * disagreeing.
 *
 * Two limits bound what a reading of this record may claim.
 *
 * **It counts retries with a READABLE TRANSCRIPT, not all retries.** A retry
 * whose transcript is absent, over `TRANSCRIPT_READ_MAX_BYTES`, or carries no
 * assistant text records nothing at all — the gate's input assembly returns
 * null and there is no detector verdict to shadow. The numerator is unaffected
 * and the denominator shrinks, so the bias is UPWARD: a Q1 read off this
 * record is an upper bound, never a point estimate.
 *
 * **On a host that sends no `session_id` it pools across sessions.** The key
 * is `deriveSessionKey(rawSessionId || 'unknown-session')`, so every such
 * session shares one file and one counter. The gate documents the same
 * collision for the re-entrancy marker and argues it degrades safely, toward
 * under-refusing. That argument does NOT transfer here: a merged measurement
 * does not under-report, it reports one number for several sessions and a
 * reader takes it for one. Named rather than inherited, because the two
 * failures are opposite in kind.
 */
export interface ShadowRecord {
    /** Newest last. Bounded by `SHADOW_MAX_ROWS`. */
    would_refuse_again: WouldRefuseAgainRow[];
    /**
     * Retries observed on an allow path in this session, refusing or NOT,
     * SPLIT BY LAYER.
     *
     * Kept because a shadow row array alone cannot distinguish "no retry
     * happened" from "every retry came back clean", and those are opposite
     * readings of the same empty list.
     *
     * Split because pooling it made a per-layer Q1 uncomputable, which the
     * first version shipped and an independent review caught before any row
     * accumulated. `layer` is on every ROW for a stated reason — a
     * `stop_hook_active` retry follows ANY stop concern's block, not only this
     * gate's — so a pooled numerator would read another concern's retries
     * against this gate's refusals. A pooled DENOMINATOR has the same defect
     * one level down, and worse: a CLEAN retry adds no row at all, so it left
     * no layer trace anywhere. The numerator could be split and the
     * denominator could not, which is not a sanity check on anything.
     *
     * Keyed rather than two fields so a third layer, if one is ever added,
     * cannot silently land in neither bucket.
     */
    retries_observed: Record<ShadowLayer, number>;
    /** Rows dropped to the cap. A non-zero value makes the array a sample. */
    dropped: number;
    first_at: string;
    last_at: string;
}

/**
 * Row cap per session.
 *
 * A stated bound, not a measured optimum. A row is ~90 bytes and a session
 * with 200 retries is already pathological, so the cap exists to keep an
 * unbounded write off the Stop path rather than to fit a distribution. Oldest
 * rows are dropped first: Q1 is a rate, and the most recent observations are
 * the ones a reader is deciding on. A non-zero `dropped` on a real session is
 * the signal that the number was chosen too low.
 */
export const SHADOW_MAX_ROWS = 200;

/**
 * The shadow file's suffix, named rather than inlined because TWO readers need
 * to agree on it: the writer below and `pruneAgedRefusalState`, which scans the
 * same directory for `*.json` and would otherwise keep every shadow record
 * forever.
 */
export const SHADOW_SUFFIX = '.shadow.json';

export function sessionShadowFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(refusalStateDir(workspaceRoot), `${sessionKey}${SHADOW_SUFFIX}`);
}

/**
 * Parse one shadow record. `null` for anything unreadable — same fail-open
 * contract as `parseRecord`, and for the same reason: this is the Stop path.
 */
export function parseShadowRecord(raw: string): ShadowRecord | null {
    let decoded: unknown;
    try {
        decoded = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
    const o = decoded as Record<string, unknown>;
    const rowsRaw = o['would_refuse_again'];
    if (!Array.isArray(rowsRaw)) return null;
    const rows: WouldRefuseAgainRow[] = [];
    for (const r of rowsRaw) {
        if (typeof r !== 'object' || r === null || Array.isArray(r)) continue;
        const ro = r as Record<string, unknown>;
        const det = ro['detector'];
        const turn = ro['turn'];
        const at = ro['at'];
        const layer = ro['layer'];
        if (!isDetector(det)) continue;
        if (typeof turn !== 'number' || !Number.isFinite(turn)) continue;
        if (typeof at !== 'string') continue;
        if (layer !== 'stop_hook_active' && layer !== 'refused_turn') continue;
        const setByRaw = ro['set_by'];
        const set_by: ShadowSetBy =
            setByRaw === 'ours' || setByRaw === 'foreign' || setByRaw === 'unknown'
                ? setByRaw
                : 'unknown';
        rows.push({ detector: det, turn, at, layer, set_by });
    }
    const num = (v: unknown): number =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
    const observed = o['retries_observed'];
    const byLayer = emptyRetryCounts();
    if (typeof observed === 'object' && observed !== null && !Array.isArray(observed)) {
        for (const l of SHADOW_LAYERS) {
            byLayer[l] = num((observed as Record<string, unknown>)[l]);
        }
    }
    return {
        would_refuse_again: rows,
        retries_observed: byLayer,
        dropped: num(o['dropped']),
        first_at: typeof o['first_at'] === 'string' ? o['first_at'] : '',
        last_at: typeof o['last_at'] === 'string' ? o['last_at'] : '',
    };
}

/**
 * Fold one retry observation into a shadow record. Pure — the caller writes.
 *
 * `detectors` EMPTY is a real and load-bearing input: a retry whose detectors
 * all came back silent raises `retries_observed` for its layer and adds no
 * row, which is the only way Q1 can ever read below 1.
 */
export function foldShadow(
    prev: ShadowRecord | null,
    input: {
        detectors: readonly RefusalDetectorId[];
        turnOrdinal: number;
        at: string;
        layer: ShadowLayer;
        /**
         * Omitted by a caller that cannot establish it, which is `unknown` —
         * never `foreign`, because a missing answer is not evidence of a
         * neighbour.
         */
        setBy?: ShadowSetBy;
    },
): ShadowRecord {
    const rows = [...(prev?.would_refuse_again ?? [])];
    const set_by: ShadowSetBy = input.setBy ?? 'unknown';
    for (const d of input.detectors) {
        rows.push({
            detector: d,
            turn: input.turnOrdinal,
            at: input.at,
            layer: input.layer,
            set_by,
        });
    }
    let dropped = prev?.dropped ?? 0;
    if (rows.length > SHADOW_MAX_ROWS) {
        dropped += rows.length - SHADOW_MAX_ROWS;
        rows.splice(0, rows.length - SHADOW_MAX_ROWS);
    }
    const retries = emptyRetryCounts();
    for (const l of SHADOW_LAYERS) retries[l] = prev?.retries_observed[l] ?? 0;
    retries[input.layer] += 1;
    return {
        would_refuse_again: rows,
        retries_observed: retries,
        dropped,
        first_at: prev?.first_at !== undefined && prev.first_at !== '' ? prev.first_at : input.at,
        last_at: input.at,
    };
}

/**
 * Who set `stop_hook_active`, decided from this gate's OWN refusal record.
 *
 * Three states, and the third is not a hedge. `ENOENT` means this gate never
 * refused in this session, so a flag the host set anyway came from somewhere
 * else — `foreign`. Any OTHER read failure means the answer is unavailable, and
 * reporting that as `foreign` would turn a broken state directory into evidence
 * that a neighbour acted. The lane's own framing is the reason: what this suite
 * can say about a neighbour is only what it observes, and an unreadable file is
 * not an observation.
 *
 * `parseRecord` returning `null` on a present file is also `unknown`: the file
 * exists, so something wrote it, and we cannot say what.
 */
export function shadowSetBy(workspaceRoot: string, sessionKey: string): ShadowSetBy {
    let raw: string;
    try {
        raw = fs.readFileSync(sessionRefusalFile(workspaceRoot, sessionKey), 'utf-8');
    } catch (err) {
        const code = (err as NodeJS.ErrnoException | undefined)?.code;
        return code === 'ENOENT' ? 'foreign' : 'unknown';
    }
    return parseRecord(raw) === null ? 'unknown' : 'ours';
}

/** This session's shadow record, or `null` when it has never retried. */
export function readShadowRecord(workspaceRoot: string, sessionKey: string): ShadowRecord | null {
    try {
        return parseShadowRecord(
            fs.readFileSync(sessionShadowFile(workspaceRoot, sessionKey), 'utf-8'),
        );
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// TTL — step 1.2
// ---------------------------------------------------------------------------

/**
 * Default retention for refusal state.
 *
 * **A stated default, not a measured optimum.** 90 days is long enough that a
 * per-detector rate can be read over a window rather than an anecdote (AC-1's
 * own requirement) and short enough that a long-lived workspace does not
 * accumulate indefinitely, which is the defect the gate's header admits. It is
 * deliberately far longer than the session-register TTLs, because those bound
 * LIVENESS and this bounds EVIDENCE — pruning evidence on a liveness clock would
 * delete the corpus this roadmap exists to read.
 *
 * Two things would show 90 is the wrong number: a rollup window longer than it
 * being needed to read a rate, or the directory's file count becoming a
 * measured cost rather than a projected one.
 */
export const REFUSAL_STATE_MAX_AGE_DAYS = 90;

export interface PruneResult {
    scanned: number;
    pruned: number;
    kept: number;
}

/**
 * Remove refusal records whose most recent refusal is older than `maxAgeDays`.
 *
 * Age is read from the record's own `refused_at`, never from the filesystem
 * mtime: a `git checkout` or an rsync rewrites mtimes and would prune a live
 * corpus or preserve a dead one at random. A record that cannot be parsed is
 * KEPT — deleting a file this reader cannot understand is the one irreversible
 * move available here, and an unparseable record costs a few bytes.
 */
export function pruneAgedRefusalState(
    workspaceRoot: string,
    opts: { maxAgeDays?: number; now?: Date } = {},
): PruneResult {
    const maxAgeDays = opts.maxAgeDays ?? REFUSAL_STATE_MAX_AGE_DAYS;
    const now = opts.now ?? new Date();
    const dir = refusalStateDir(workspaceRoot);
    const result: PruneResult = { scanned: 0, pruned: 0, kept: 0 };
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return result; // no directory yet — nothing to prune, not an error
    }
    const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
    for (const name of entries) {
        if (!name.endsWith('.json')) continue;
        result.scanned += 1;
        const file = path.join(dir, name);
        // A shadow record is a sibling in the same directory whose name also
        // ends `.json`, and `parseRecord` rejects it for lacking `refused_at`.
        // Left to the branch below it would land in `kept` FOREVER — the
        // unbounded growth this pruner exists to stop, reintroduced by the
        // instrument step 2.1 added. Its own clock is `last_at`.
        if (name.endsWith(SHADOW_SUFFIX)) {
            let shadow: ShadowRecord | null = null;
            try {
                shadow = parseShadowRecord(fs.readFileSync(file, 'utf-8'));
            } catch {
                shadow = null;
            }
            const shadowAt = shadow === null ? NaN : Date.parse(shadow.last_at);
            // KEEP-ON-UNPARSEABLE IS NOT INHERITED, and the asymmetry with the
            // branch below is the point. A refusal record that will not parse
            // may still carry the wedge marker, so deleting it is the one
            // irreversible move available and it is refused. A shadow record
            // is pure measurement with nothing to protect — keeping one whose
            // `last_at` cannot be read means it never ages out at all, which
            // is the unbounded growth this pruner exists to stop, surviving
            // for exactly the subset nobody can read. An unreadable one is
            // pruned on the filesystem mtime, which is the weaker clock this
            // function refuses for refusal records precisely because they are
            // evidence; for a corrupt measurement it is the only clock left.
            if (!Number.isFinite(shadowAt)) {
                let mtime = NaN;
                try {
                    mtime = fs.statSync(file).mtimeMs;
                } catch {
                    mtime = NaN;
                }
                if (!Number.isFinite(mtime) || mtime >= cutoffMs) {
                    result.kept += 1;
                    continue;
                }
            } else if (shadowAt >= cutoffMs) {
                result.kept += 1;
                continue;
            }
            try {
                fs.unlinkSync(file);
                result.pruned += 1;
            } catch {
                result.kept += 1;
            }
            continue;
        }
        let rec: RefusalRecord | null = null;
        try {
            rec = parseRecord(fs.readFileSync(file, 'utf-8'));
        } catch {
            rec = null;
        }
        if (rec === null) {
            result.kept += 1;
            continue;
        }
        const at = Date.parse(rec.refused_at);
        if (!Number.isFinite(at) || at >= cutoffMs) {
            result.kept += 1;
            continue;
        }
        try {
            fs.unlinkSync(file);
            result.pruned += 1;
        } catch {
            result.kept += 1;
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Aggregation — steps 1.1 and 1.3
// ---------------------------------------------------------------------------

export interface PeriodBucket {
    /** `YYYY-MM-DD`, in UTC. */
    period: string;
    sessions: number;
    total: number;
    byDetector: DetectorCounts;
}

export interface VersionBucket {
    version: string;
    sessions: number;
    total: number;
    byDetector: DetectorCounts;
}

export interface RefusalStats {
    /** Sessions that had AT LEAST ONE refusal — never "all sessions". */
    sessionsWithRefusals: number;
    total: number;
    byDetector: DetectorCounts;
    /** Newest first. */
    byPeriod: PeriodBucket[];
    /** Records still in the pre-count shape; their contribution is a floor. */
    legacyRecords: number;
    /** Records carrying no readable package version. */
    unversionedRecords: number;
    byVersion: VersionBucket[];
    earliest: string | null;
    latest: string | null;
}

function addInto(target: DetectorCounts, source: DetectorCounts): void {
    for (const id of DETECTOR_IDS) target[id] += source[id];
}

function sumOf(counts: DetectorCounts): number {
    let n = 0;
    for (const id of DETECTOR_IDS) n += counts[id];
    return n;
}

/**
 * Aggregate every refusal record under a workspace.
 *
 * Period attribution uses the record's `refused_at` — the session's LAST
 * refusal — for the whole session's counts. A session that straddles midnight
 * therefore lands entirely in the later day. This is an approximation and is
 * named as one: the alternative is a per-refusal timestamp list, which grows
 * without bound inside a file whose whole point is to stay one small record per
 * session.
 */
export function collectRefusalStats(workspaceRoot: string): RefusalStats {
    const dir = refusalStateDir(workspaceRoot);
    const stats: RefusalStats = {
        sessionsWithRefusals: 0,
        total: 0,
        byDetector: emptyCounts(),
        byPeriod: [],
        legacyRecords: 0,
        unversionedRecords: 0,
        byVersion: [],
        earliest: null,
        latest: null,
    };
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return stats;
    }
    const periods = new Map<string, PeriodBucket>();
    const versions = new Map<string, VersionBucket>();
    for (const name of entries) {
        if (!name.endsWith('.json')) continue;
        // Shadow records share the directory and the extension. `parseRecord`
        // would reject each one anyway, so this line changes no number — it is
        // here because relying on another function's strictness for a
        // correctness property is how the property disappears when that
        // function is loosened.
        if (name.endsWith(SHADOW_SUFFIX)) continue;
        let rec: RefusalRecord | null = null;
        try {
            rec = parseRecord(fs.readFileSync(path.join(dir, name), 'utf-8'));
        } catch {
            rec = null;
        }
        if (rec === null) continue;
        const counts = countsOf(rec);
        stats.sessionsWithRefusals += 1;
        if (rec.counts === undefined) stats.legacyRecords += 1;
        addInto(stats.byDetector, counts);

        const period = rec.refused_at.slice(0, 10);
        let bucket = periods.get(period);
        if (bucket === undefined) {
            bucket = { period, sessions: 0, total: 0, byDetector: emptyCounts() };
            periods.set(period, bucket);
        }
        bucket.sessions += 1;
        addInto(bucket.byDetector, counts);

        const version = rec.agent_config_version;
        if (version === undefined) stats.unversionedRecords += 1;
        const vkey = version ?? '(unrecorded)';
        let vbucket = versions.get(vkey);
        if (vbucket === undefined) {
            vbucket = { version: vkey, sessions: 0, total: 0, byDetector: emptyCounts() };
            versions.set(vkey, vbucket);
        }
        vbucket.sessions += 1;
        addInto(vbucket.byDetector, counts);

        const first = rec.first_refused_at ?? rec.refused_at;
        if (stats.earliest === null || first < stats.earliest) stats.earliest = first;
        if (stats.latest === null || rec.refused_at > stats.latest) stats.latest = rec.refused_at;
    }
    stats.total = sumOf(stats.byDetector);
    for (const b of periods.values()) b.total = sumOf(b.byDetector);
    for (const b of versions.values()) b.total = sumOf(b.byDetector);
    stats.byPeriod = [...periods.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
    stats.byVersion = [...versions.values()].sort((a, b) => (a.version < b.version ? 1 : -1));
    return stats;
}

// ---------------------------------------------------------------------------
// Q1 — the shadow rollup (step 2.2)
// ---------------------------------------------------------------------------

/**
 * One layer's Q1 inputs, kept as counts so the ratio is computed where it is
 * read rather than stored.
 *
 * SPLIT BY LAYER BEFORE DETECTOR, and that order is the shape's whole point
 * rather than a presentation choice. A `stop_hook_active` retry follows ANY
 * stop concern's block — not only this gate's — so pooling the two layers
 * divides another concern's retries into this gate's refusals and calls the
 * result a re-refusal share. `ShadowRecord.retries_observed` is keyed the same
 * way so the denominator splits with the numerator; an independent review
 * found the first version pooling the denominator, which left the per-layer
 * ratio uncomputable even though every row already carried its `layer`.
 */
export interface ShadowLayerStats {
    layer: ShadowLayer;
    /**
     * Retries observed on this layer across every readable record — the
     * denominator, counting retries that came back CLEAN as well as refusing
     * ones. A clean retry writes no row, so without this a zero numerator and
     * "no retry happened" are the same empty list.
     */
    retries: number;
    /** Shadow rows on this layer, by detector — the numerators. */
    byDetector: DetectorCounts;
    /**
     * Rows on this layer, summed.
     *
     * MAY EXCEED `retries`, legitimately: one retry that would have been
     * refused by two detectors writes two rows, and the demotion contract's
     * attribution rule counts it once for each. A per-detector ratio stays
     * within [0, 1]; this total is not a share and is printed as a count.
     */
    rows: number;
}

/**
 * Rollup over every session's shadow record under a workspace.
 *
 * Two bounds travel with every number this carries. Both are properties of the
 * instrument rather than of a particular reading, both are stated on
 * `ShadowRecord`, and both are repeated here because a consumer reads this
 * type and not that comment:
 *
 *   - A retry whose transcript is unreadable or oversized records NOTHING —
 *     no row and no retry. The denominator shrinks with the numerator, so a
 *     Q1 read off this is an UPPER bound rather than a point estimate.
 *   - On a host that sends no `session_id`, every session shares one record
 *     and one counter. `files` below then counts FILES and not sessions, and
 *     a reader taking one for the other over-states the sample.
 */
export interface ShadowStats {
    /**
     * Shadow FILES parsed. Deliberately not named `sessions`: one file is one
     * session only on a host that sends a `session_id`.
     */
    files: number;
    /** Files present but unparseable. A non-zero value makes every rate a floor. */
    unreadable: number;
    /**
     * Rows dropped to `SHADOW_MAX_ROWS`, summed. Non-zero means the row arrays
     * are samples of their own sessions and every numerator is a floor.
     */
    dropped: number;
    byLayer: ShadowLayerStats[];
    earliest: string | null;
    latest: string | null;
}

/** A zeroed rollup, DERIVED from `SHADOW_LAYERS` for the reason `emptyCounts` gives. */
export function emptyShadowStats(): ShadowStats {
    return {
        files: 0,
        unreadable: 0,
        dropped: 0,
        byLayer: SHADOW_LAYERS.map((layer) => ({
            layer,
            retries: 0,
            byDetector: emptyCounts(),
            rows: 0,
        })),
        earliest: null,
        latest: null,
    };
}

/**
 * Aggregate every shadow record under a workspace.
 *
 * Reads through `parseShadowRecord`, never by hand: the gate writes these
 * files, and a reader carrying its own idea of their shape is how a producer
 * and a consumer drift apart — the exact seam the 2026-09-30 review round
 * found uncrossed between the verification recorder and its classifier.
 */
export function collectShadowStats(workspaceRoot: string): ShadowStats {
    const dir = refusalStateDir(workspaceRoot);
    const stats = emptyShadowStats();
    const byLayer = new Map(stats.byLayer.map((b) => [b.layer, b]));
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return stats;
    }
    for (const name of entries) {
        if (!name.endsWith(SHADOW_SUFFIX)) continue;
        let rec: ShadowRecord | null = null;
        try {
            rec = parseShadowRecord(fs.readFileSync(path.join(dir, name), 'utf-8'));
        } catch {
            rec = null;
        }
        if (rec === null) {
            stats.unreadable += 1;
            continue;
        }
        stats.files += 1;
        stats.dropped += rec.dropped;
        for (const layer of SHADOW_LAYERS) {
            const bucket = byLayer.get(layer);
            if (bucket !== undefined) bucket.retries += rec.retries_observed[layer] ?? 0;
        }
        for (const row of rec.would_refuse_again) {
            const bucket = byLayer.get(row.layer);
            if (bucket === undefined) continue;
            bucket.byDetector[row.detector] += 1;
            bucket.rows += 1;
        }
        // EMPTY STRINGS ARE SKIPPED, NOT COMPARED. `parseShadowRecord` coerces a
        // missing `first_at` to `''`, and `'' < <any ISO stamp>` is true, so a
        // record lacking the field would win the earliest comparison and the
        // report would print an empty window start beside a real end. An absent
        // timestamp is not an earlier one.
        if (rec.first_at !== '' && (stats.earliest === null || rec.first_at < stats.earliest)) {
            stats.earliest = rec.first_at;
        }
        if (rec.last_at !== '' && (stats.latest === null || rec.last_at > stats.latest)) {
            stats.latest = rec.last_at;
        }
    }
    return stats;
}

/**
 * Detectors whose share may NOT be reported off a shadow rollup, because the
 * record cannot tell a dispatch-suppressed retry from a clean one.
 *
 * `runDetectors` in `turn_end_gate_hook.ts` skips A, D and F when a subagent
 * dispatch is open — they did not run, so the turn is not an observation of
 * them staying silent. `recordShadow` then increments `retries_observed`
 * unconditionally and writes no dispatch flag, so every dispatch-suppressed
 * retry lands in those three denominators as a "would not have refused" that
 * nobody observed. In a suite whose delegation policy dispatches by default
 * that is not a rare branch.
 *
 * The demotion contract already forbids publishing it: *"A rollup that cannot
 * tell a dispatch-suppressed turn from a clean one may not report Q2 for A or
 * D at all."* This set is that clause applied to the shadow rollup, extended to
 * F — the contract's attribution paragraph names only A and D because it
 * predates F, while its own § The six detectors table and the gate both gate
 * all three. The wider set is the safe reading of a censoring rule.
 *
 * Closing this needs a `dispatch_open` flag on the shadow row, which is a
 * PRODUCER change. Until then these three are censored rather than estimated.
 */
export const DISPATCH_CENSORED_DETECTORS: ReadonlySet<RefusalDetectorId> =
    new Set<RefusalDetectorId>(['promissory', 'completion', 'untested']);

/**
 * The **retry-conditioned re-refusal share** for one detector on one layer, or
 * `null` when the layer observed no retry.
 *
 * ```
 * THIS IS NOT THE Q1 `turn-end-detector-demotion.md` REGISTERS BARS AGAINST.
 * NEVER COMPARE IT TO A BAR IN THAT TABLE.
 * ```
 *
 * The contract defines Q1 as *"of **a detector's** eligible initial refusals,
 * the share whose immediate retry is refused again by the same detector"*. Both
 * halves of that are conditioned on the detector. This function conditions
 * NEITHER: the denominator is every retry observed on the layer, whatever
 * refusal produced it, and the numerator is every row where this detector would
 * have fired, whatever refusal produced the retry.
 *
 * **They disagree in direction, so this is not a bound either.** Take ten
 * retries on a layer, nine following `verification` refusals and one following
 * a `language` refusal, with one `language` row. The contract's Q1 for B is
 * 1/1 = 100 % — bar crossed, a demotion study authorised. This function returns
 * 1/10 = 10 % — bar not crossed. Opposite verdicts on identical evidence. The
 * numerator can also run the other way, since a `language` row on a retry that
 * followed a `verification` refusal counts here and does not count there.
 *
 * **Why it is shaped this way, which is a producer limit rather than a choice.**
 * `ShadowRecord` carries no originating detector: `retries_observed` is keyed by
 * layer alone and a row records only what WOULD fire, never what did. The
 * session's `RefusalRecord` holds per-detector COUNTS for the whole session and
 * `refused_turn` for the last refused turn, so the per-turn origin needed to
 * condition this denominator is not on disk anywhere. Computing the registered
 * Q1 needs the producer to record it; that is named as the open residue on
 * `road-to-a-stop-that-holds` step 2.2 rather than papered over here.
 *
 * `null` RATHER THAN ZERO on an empty denominator, and that distinction is why
 * `retries_observed` exists at all: zero means "retries happened and this
 * detector would not have refused any of them", a finding about the detector,
 * while null means "nothing was observed", a finding about the sample.
 * Collapsing them publishes the second as the first.
 */
export function retryConditionedShare(
    stats: ShadowStats,
    layer: ShadowLayer,
    detector: RefusalDetectorId,
): number | null {
    const bucket = stats.byLayer.find((b) => b.layer === layer);
    if (bucket === undefined || bucket.retries === 0) return null;
    return bucket.byDetector[detector] / bucket.retries;
}
