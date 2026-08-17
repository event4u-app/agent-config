/**
 * `turn-end-gate` refusal accounting — the number a blocking gate owes.
 *
 * `road-to-stop-gate-honesty` § D-2: per-session ordinal state exists, but
 * nothing aggregates refusals into a rate anyone reviews. Every advisory in this
 * estate carries a registered kill standard; the one BLOCKING concern carries
 * none, and a gate that blocks unobserved is the shape that discipline exists to
 * prevent.
 *
 * This module is the reader. It owns three things and deliberately not a fourth:
 *
 *   1. the on-disk record shape, extended so a session's refusals are COUNTED
 *      rather than overwritten (§ Phase 1 step 1.1);
 *   2. a TTL prune, which the gate's own header admits is missing (step 1.2);
 *   3. the split by recorded package version, so claim 10's prediction — that
 *      refusals correlate with the local 12.1 install — is TESTED rather than
 *      assumed (step 1.3).
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
 * The four detectors, in the order the gate runs them.
 *
 * The roadmap's § 0 names three (A promissory, B language, C verification).
 * That was true of the draft and is not true of the tree: detector D
 * (`completion`) landed under round 7 § Phase 1 and is in the same
 * unconditional list as the other three. Counting three would silently drop a
 * detector's refusals, so the set is read off `DetectorId` in the gate rather
 * than off the prose.
 */
export const DETECTOR_IDS = [
    'promissory',
    'language',
    'verification',
    'completion',
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
}

export function emptyCounts(): DetectorCounts {
    return { promissory: 0, language: 0, verification: 0, completion: 0 };
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
 * *Revisit-if:* a rollup window longer than 90 days is needed to read a rate, or
 * the directory's file count becomes a measured cost rather than a projected one.
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
