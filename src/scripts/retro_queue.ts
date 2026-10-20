/**
 * The retro queue and its calendar (`docs/contracts/retro-v1.md`).
 *
 * One file per unit in the git common directory, so every worktree of a
 * repository sees one queue and a unit enqueued from two of them is one unit.
 * Writes are temp-file-then-hard-link, and an existing entry is never rewritten:
 * the first enqueue's timestamp is the discovery time a later measurement reads.
 *
 * Days are local calendar days in an IANA zone, and all arithmetic is on the
 * calendar date, never on elapsed hours — a 23- or 25-hour day at a DST switch
 * is still exactly one day, so a switch can neither drop a day from a sweep nor
 * sweep one twice.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { load_agent_settings, settings_layer_states } from './_lib/agent_settings.js';
import { git_common_dir } from './_lib/git_common_dir.js';

/** Catch-up window in local days; stays below the 7-day session-state TTL. */
export const CATCH_UP_WINDOW_DAYS = 5;

export const QUEUE_DIRNAME = path.join('agent-config', 'retro-queue');

export interface QueueEntry {
    unit_key: string;
    kind: 'pr' | 'session';
    pr?: number;
    session?: string;
    /** The branch a PR unit was pushed from, when a marker recorded it. */
    branch?: string;
}

export interface StoredEntry extends QueueEntry {
    enqueued_at: string;
}

export function queueDir(workspaceRoot: string): string | null {
    const common = git_common_dir(workspaceRoot);
    return common === null ? null : path.join(common, QUEUE_DIRNAME);
}

function entryFile(dir: string, unitKey: string): string {
    return path.join(dir, `${createHash('sha256').update(unitKey).digest('hex').slice(0, 32)}.json`);
}

export type EnqueueResult = 'enqueued' | 'exists' | 'no-queue';

export function enqueue(workspaceRoot: string, entry: QueueEntry, nowIso: string): EnqueueResult {
    const dir = queueDir(workspaceRoot);
    if (dir === null) return 'no-queue';
    fs.mkdirSync(dir, { recursive: true });
    const file = entryFile(dir, entry.unit_key);
    if (fs.existsSync(file)) return 'exists';
    const stored: StoredEntry = { ...entry, enqueued_at: nowIso };
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(stored)}\n`, { flag: 'wx' });
    try {
        fs.linkSync(tmp, file);
        return 'enqueued';
    } catch (err) {
        // A concurrent enqueue of the same unit won; theirs stands. Any other
        // failure would lose the unit, so it is not reported as `exists`.
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
        throw err;
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}

export function listQueue(workspaceRoot: string): StoredEntry[] {
    const dir = queueDir(workspaceRoot);
    if (dir === null) return [];
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: StoredEntry[] = [];
    for (const n of names.sort()) {
        if (!n.endsWith('.json')) continue;
        try {
            const v = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')) as Partial<StoredEntry>;
            if (typeof v.unit_key === 'string' && (v.kind === 'pr' || v.kind === 'session')) {
                out.push(v as StoredEntry);
            }
        } catch {
            continue;
        }
    }
    return out;
}

/** The local calendar day (`YYYY-MM-DD`) of an instant in an IANA zone. */
export function localDay(iso: string, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

const DAY_MS = 86_400_000;
function dayNumber(day: string): number {
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN;
    if (!Number.isFinite(ms)) throw new Error(`retro_queue: not a calendar day: ${day}`);
    return Math.round(ms / DAY_MS);
}
const dayString = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

/**
 * The finished local days a sweep on `today` examines: from the high-water mark
 * (first day not yet swept, inclusive) up to yesterday, clipped to the window.
 */
export function sweepDays(highWater: string, today: string): string[] {
    const end = dayNumber(today);
    const start = Math.max(dayNumber(highWater), end - CATCH_UP_WINDOW_DAYS);
    const out: string[] = [];
    for (let d = start; d < end; d++) out.push(dayString(d));
    return out;
}

export type WindowClass = 'in-window' | 'covered' | 'expired';

export interface UnitDay {
    /** Local day the unit finished. */
    day: string;
    today: string;
    /** The session's PR already has a retro. */
    covered: boolean;
    /** The session was itself a retro (K5). */
    retroSession: boolean;
}

export function classifyUnit(u: UnitDay): WindowClass {
    if (u.covered || u.retroSession) return 'covered';
    return dayNumber(u.today) - dayNumber(u.day) > CATCH_UP_WINDOW_DAYS ? 'expired' : 'in-window';
}

// ---------------------------------------------------------------------------
// The switch (ADR-292)
// ---------------------------------------------------------------------------

export const RETRO_ENABLED_KEY = 'retro.enabled';

/**
 * Whether the AUTOMATIC paths may run — merge enqueue, forge-merge marker,
 * session pointer and daily sweep. An explicit `/retro` never reads this.
 *
 * One resolver for every caller (CLI, hook and GUI read the same cascade), so
 * the value a user wrote holds the same everywhere. Fail-closed: a settings
 * layer the user broke disarms the automatic paths rather than letting the
 * shipped default speak for a file the user meant to say something in — the
 * property `continuity.auto_record` carries for the same reason.
 */
export function retroEnabled(root: string, opts: { userGlobalPath?: string | null } = {}): boolean {
    const ug = opts.userGlobalPath ?? null;
    const scope = { cwd: root, ...(ug !== null ? { user_global_path: ug } : {}) };
    try {
        if (settings_layer_states(scope).some((l) => l.state === 'malformed')) return false;
        const section = load_agent_settings(scope)['retro'];
        if (section !== null && typeof section === 'object' && !Array.isArray(section)) {
            const v = (section as Record<string, unknown>)['enabled'];
            if (typeof v === 'boolean') return v;
        }
        return false;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Contract constants — pre-registered values; they change only by a
// documented contract revision, never by editing a number here
// ---------------------------------------------------------------------------

/** Model retros per local day (D7); the rest are `deferred`. */
export const DAILY_RETRO_BUDGET = 3;
/** More `deferred` units than this pauses the sweep; `/retro` keeps working (5.4). */
export const BACKLOG_PAUSE_AT = 15;
/** A triage p50 above this, measured in the probe, is reported by `/retro status` (5.4). */
export const TRIAGE_P50_LIMIT_MS = 2000;

// ---------------------------------------------------------------------------
// Small JSON stores beside the queue, all in the git common directory
// ---------------------------------------------------------------------------

function commonSub(workspaceRoot: string, name: string): string | null {
    const common = git_common_dir(workspaceRoot);
    return common === null ? null : path.join(common, 'agent-config', name);
}

function writeJsonAtomic(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`);
    fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
    } catch {
        return null;
    }
}

function readJsonDir<T>(dir: string | null): T[] {
    if (dir === null) return [];
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: T[] = [];
    for (const n of names.sort()) {
        if (!n.endsWith('.json')) continue;
        const v = readJson<T>(path.join(dir, n));
        if (v !== null) out.push(v);
    }
    return out;
}

const hashName = (s: string): string => `${createHash('sha256').update(s).digest('hex').slice(0, 32)}.json`;

// ---------------------------------------------------------------------------
// Dispositions — the durable result of triage, per unit
// ---------------------------------------------------------------------------

/** A triage class, or `analysed` once a retro ran on the unit. */
export type Disposition = 'analyse' | 'skip:low-signal' | 'covered' | 'expired' | 'deferred' | 'analysed';

export interface DispositionRecord {
    unit_key: string;
    class: Disposition;
    at: string;
}

/** `deferred` and `analyse` are NOT durable: a later sweep may reconsider them. */
export const DURABLE_DISPOSITIONS: readonly Disposition[] = ['skip:low-signal', 'covered', 'expired', 'analysed'];

export function recordDisposition(workspaceRoot: string, unitKey: string, cls: Disposition, nowIso: string): boolean {
    const dir = commonSub(workspaceRoot, 'retro-dispositions');
    if (dir === null) return false;
    writeJsonAtomic(path.join(dir, hashName(unitKey)), { unit_key: unitKey, class: cls, at: nowIso });
    return true;
}

export function readDispositions(workspaceRoot: string): Map<string, DispositionRecord> {
    const out = new Map<string, DispositionRecord>();
    for (const d of readJsonDir<DispositionRecord>(commonSub(workspaceRoot, 'retro-dispositions'))) {
        if (typeof d.unit_key === 'string' && typeof d.class === 'string') out.set(d.unit_key, d);
    }
    return out;
}

/** Queue entries no retro has examined yet. */
export function pendingUnits(workspaceRoot: string): StoredEntry[] {
    const disp = readDispositions(workspaceRoot);
    return listQueue(workspaceRoot).filter((e) => disp.get(e.unit_key)?.class !== 'analysed');
}

/** The one line the agent reads as work; `null` when nothing is pending. */
export function queueLine(pending: readonly StoredEntry[]): string | null {
    if (pending.length === 0) return null;
    const prs = pending.filter((e) => e.kind === 'pr').length;
    return (
        `<retro-queue pending="${pending.length}" prs="${prs}" sessions="${pending.length - prs}">` +
        'Finished work is waiting for a retro. Run `/retro` after the first user task, or delegate it to a ' +
        "subagent; never defer the user's task for it.</retro-queue>"
    );
}

// ---------------------------------------------------------------------------
// Path A — `/pr:merge`
// ---------------------------------------------------------------------------

export interface MergedPr {
    pr: number;
    merge_sha?: string | null;
}

export interface MergeEnqueueResult {
    status: 'disabled' | 'no-queue' | 'enqueued';
    /** Unit keys newly written; a unit already queued is not repeated. */
    units: string[];
}

/** The unit key of a merged PR; the same shape `retro.ts` `unitKey` builds. */
export function prUnitKey(repo: string, pr: number, mergeSha: string | null | undefined, policy = 1): string {
    return `retro:${repo}#pr${pr}@${mergeSha ?? 'unmerged'}/p${policy}`;
}

/**
 * Enqueue every PR one `/pr:merge` invocation merged, in ONE call after the
 * last merge — never between two merges of a drain (K3).
 */
export function enqueueMerged(
    workspaceRoot: string,
    input: { repo: string; prs: readonly MergedPr[] },
    nowIso: string,
    opts: { enabled?: boolean } = {},
): MergeEnqueueResult {
    if (!(opts.enabled ?? retroEnabled(workspaceRoot))) return { status: 'disabled', units: [] };
    if (queueDir(workspaceRoot) === null) return { status: 'no-queue', units: [] };
    const units: string[] = [];
    for (const p of input.prs) {
        const key = prUnitKey(input.repo, p.pr, p.merge_sha);
        if (enqueue(workspaceRoot, { unit_key: key, kind: 'pr', pr: p.pr }, nowIso) === 'enqueued') units.push(key);
    }
    return { status: 'enqueued', units };
}

// ---------------------------------------------------------------------------
// Path B — forge merges, through a marker written at push time
// ---------------------------------------------------------------------------

export interface MergeMarker {
    pr: number;
    branch: string | null;
    written_at: string;
}

export type MarkerResult = 'written' | 'exists' | 'disabled' | 'no-queue';

export function writeMergeMarker(
    workspaceRoot: string,
    marker: { pr: number; branch: string | null },
    nowIso: string,
    opts: { enabled?: boolean } = {},
): MarkerResult {
    if (!(opts.enabled ?? retroEnabled(workspaceRoot))) return 'disabled';
    const dir = commonSub(workspaceRoot, 'retro-markers');
    if (dir === null) return 'no-queue';
    const file = path.join(dir, `pr-${marker.pr}.json`);
    if (fs.existsSync(file)) return 'exists';
    writeJsonAtomic(file, { pr: marker.pr, branch: marker.branch, written_at: nowIso });
    return 'written';
}

export function listMarkers(workspaceRoot: string): MergeMarker[] {
    return readJsonDir<MergeMarker>(commonSub(workspaceRoot, 'retro-markers')).filter((m) =>
        Number.isInteger(m.pr),
    );
}

/**
 * The PR a branch was pushed for: an open marker, or the queue entry a resolved
 * marker became. `null` when no push of that branch was recorded.
 */
export function markerForBranch(workspaceRoot: string, branch: string): number | null {
    const open = listMarkers(workspaceRoot).find((m) => m.branch === branch)?.pr;
    if (open !== undefined) return open;
    return listQueue(workspaceRoot).find((e) => e.kind === 'pr' && e.branch === branch)?.pr ?? null;
}

/** What the forge says about one PR; `unread` on any failure. */
export type PrState =
    | { state: 'MERGED'; merge_sha: string | null }
    | { state: 'CLOSED' }
    | { state: 'OPEN' }
    | { state: 'unread' };

export interface MarkerResolution {
    enqueued: number[];
    closed: number[];
    kept: number[];
}

/**
 * Resolve every open marker. `MERGED` enqueues the PR and retires the marker,
 * `CLOSED` retires it, `OPEN` and `unread` keep it — an unreadable forge never
 * drops a merge it could not see.
 */
export function resolveMarkers(
    workspaceRoot: string,
    repo: string,
    read: (pr: number) => PrState,
    nowIso: string,
): MarkerResolution {
    const out: MarkerResolution = { enqueued: [], closed: [], kept: [] };
    const dir = commonSub(workspaceRoot, 'retro-markers');
    if (dir === null) return out;
    for (const m of listMarkers(workspaceRoot)) {
        let s: PrState;
        try {
            s = read(m.pr);
        } catch {
            s = { state: 'unread' };
        }
        const file = path.join(dir, `pr-${m.pr}.json`);
        if (s.state === 'MERGED') {
            enqueue(
                workspaceRoot,
                {
                    unit_key: prUnitKey(repo, m.pr, s.merge_sha),
                    kind: 'pr',
                    pr: m.pr,
                    ...(m.branch !== null ? { branch: m.branch } : {}),
                },
                nowIso,
            );
            fs.rmSync(file, { force: true });
            out.enqueued.push(m.pr);
        } else if (s.state === 'CLOSED') {
            fs.rmSync(file, { force: true });
            out.closed.push(m.pr);
        } else {
            out.kept.push(m.pr);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Session pointers — a finished session leaves its unit behind (1.3)
// ---------------------------------------------------------------------------

export interface SessionPointer {
    /** The end-of-life state key (a hash of the session id, never the id). */
    eol_key: string;
    tag: string;
    branch: string | null;
    /** The workspace the session ran in, so its state is found while the worktree exists. */
    workspace: string;
    ended_at: string;
}

/**
 * Write (or refresh) one session's pointer. Written on every Stop, so the
 * newest `ended_at` stands; a removed worktree leaves its unit behind here.
 */
export function writeSessionPointer(
    workspaceRoot: string,
    pointer: SessionPointer,
    opts: { enabled?: boolean } = {},
): boolean {
    if (!(opts.enabled ?? retroEnabled(workspaceRoot))) return false;
    const dir = commonSub(workspaceRoot, 'retro-sessions');
    if (dir === null) return false;
    writeJsonAtomic(path.join(dir, `${pointer.eol_key.slice(0, 32)}.json`), pointer);
    return true;
}

export function listSessionPointers(workspaceRoot: string): SessionPointer[] {
    return readJsonDir<SessionPointer>(commonSub(workspaceRoot, 'retro-sessions')).filter(
        (p) => typeof p.eol_key === 'string' && typeof p.tag === 'string',
    );
}

// ---------------------------------------------------------------------------
// Sessions a retro itself ran in (K5), and the sweep's own state
// ---------------------------------------------------------------------------

export function markRetroSession(workspaceRoot: string, tag: string, nowIso: string): void {
    const dir = commonSub(workspaceRoot, 'retro-ran');
    if (dir === null || tag === '') return;
    writeJsonAtomic(path.join(dir, hashName(tag)), { tag, at: nowIso });
}

export function retroSessionTags(workspaceRoot: string): Set<string> {
    return new Set(readJsonDir<{ tag: string }>(commonSub(workspaceRoot, 'retro-ran')).map((r) => r.tag));
}

export interface SweepCounts {
    analyse: number;
    'skip:low-signal': number;
    covered: number;
    deferred: number;
    expired: number;
}

export interface LastSweep {
    day: string;
    at: string;
    counts: SweepCounts;
    paused: boolean;
    /** Triage wall time per unit in ms, for the p50 report. */
    triage_ms: number[];
    markers: MarkerResolution;
}

export interface SweepState {
    /** First local day not yet swept. */
    high_water: string | null;
    last_sweep: LastSweep | null;
}

export function readSweepState(workspaceRoot: string): SweepState {
    const dir = commonSub(workspaceRoot, 'retro-sweep');
    const v = dir === null ? null : readJson<SweepState>(path.join(dir, 'state.json'));
    return v ?? { high_water: null, last_sweep: null };
}

export function writeSweepState(workspaceRoot: string, state: SweepState): void {
    const dir = commonSub(workspaceRoot, 'retro-sweep');
    if (dir === null) return;
    writeJsonAtomic(path.join(dir, 'state.json'), state);
}

/** Calendar-day arithmetic for callers that hold a day, not an instant. */
export function addDays(day: string, n: number): string {
    return dayString(dayNumber(day) + n);
}
