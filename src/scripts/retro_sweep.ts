/**
 * The retro's daily sweep, its probe and `/retro status`
 * (`docs/contracts/retro-v1.md`, path C).
 *
 * The probe runs at session start inside the hook bundle, so this module
 * imports only the queue, the triage and the session-fact reader — never the
 * PR reader's forge client or the composition code. `retro.ts` re-exports it.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { liveGit, readSessionFacts, type GitRun, type SessionFacts } from './retro_session_facts.js';
import { triageSession, unitKey } from './retro_triage.js';
import {
    BACKLOG_PAUSE_AT,
    DAILY_RETRO_BUDGET,
    TRIAGE_P50_LIMIT_MS,
    claimSweepDay,
    classifyUnit,
    enqueue,
    expireStaleDeferred,
    listQueue,
    listSessionPointers,
    localDay,
    markerForBranch,
    pendingUnits,
    queueLine,
    readDispositions,
    readSweepState,
    pruneStalePointers,
    recordDisposition,
    releaseSweepDay,
    removeSessionPointer,
    resolveMarkers,
    retroEnabled,
    retroSessionTags,
    writeSweepState,
    type MarkerResolution,
    type PrState,
    type StoredEntry,
    type SweepCounts,
    type SweepState,
} from './retro_queue.js';
import type { ForgeApi } from './_lib/forge_reader.js';
import { git_common_dir } from './_lib/git_common_dir.js';

// ---------------------------------------------------------------------------
// Path C — the daily sweep. Deterministic, no model, no spawn.
// ---------------------------------------------------------------------------

export interface SweepSession {
    tag: string;
    /** Local day the session ended. */
    day: string;
    branch: string | null;
    /**
     * `null` when the probe did not read them: the session is out of the window
     * (and needs none), or the probe's deadline passed first (and it is left,
     * undisposed, for the next sweep).
     */
    facts: SessionFacts | null;
    /** The pointer's state key, so a durably disposed session's pointer can be dropped. */
    eol_key?: string;
}

export interface SweepInput {
    now: string;
    timeZone: string;
    repo: string;
    sessions: readonly SweepSession[];
    /** Forge read for open merge markers; without one, markers are left for the next sweep. */
    readPr?: (pr: number) => PrState;
    /** Overrides the switch; production callers leave it to the resolver. */
    enabled?: boolean;
    /** Monotonic clock in ms, injectable for the latency figure. */
    clock?: () => number;
}

export interface SweepResult {
    status: 'disabled' | 'already-swept' | 'paused' | 'ran';
    /** The `<retro-queue>` line, or `null` — zero candidates is silence. */
    line: string | null;
    counts: SweepCounts;
}

const zeroCounts = (): SweepCounts => ({ analyse: 0, 'skip:low-signal': 0, covered: 0, deferred: 0, expired: 0 });
const noMarkers = (): MarkerResolution => ({ enqueued: [], closed: [], kept: [] });

function deferredBacklog(root: string): number {
    return [...readDispositions(root).values()].filter((d) => d.class === 'deferred').length;
}

/** A session is covered when the PR its branch was pushed for is already queued. */
function prCovered(root: string, repo: string, branch: string | null): boolean {
    if (branch === null) return false;
    const pr = markerForBranch(root, branch);
    if (pr === null) return false;
    const prefix = `retro:${repo}#pr${pr}@`;
    return listQueue(root).some((e) => e.unit_key.startsWith(prefix));
}

/**
 * The first-session-of-the-day sweep. Swept once per local day across every
 * worktree (the state lives in the git common directory); finished days only;
 * at most {@link DAILY_RETRO_BUDGET} sessions enqueued, highest score first,
 * ties newest first, the rest `deferred`.
 */
export function runDailySweep(root: string, input: SweepInput): SweepResult {
    const counts = zeroCounts();
    if (!(input.enabled ?? retroEnabled(root))) return { status: 'disabled', line: null, counts };
    const today = localDay(input.now, input.timeZone);
    const state = readSweepState(root);
    if (state.last_sweep?.day === today) return { status: 'already-swept', line: null, counts };
    // One sweep per repository and day, even when two worktrees start sessions at
    // the same moment. A sweep that throws gives the claim back; one that crashes
    // leaves it to expire after the lease.
    const token = claimSweepDay(root, today);
    if (token === null) return { status: 'already-swept', line: null, counts };
    try {
        return sweepClaimed(root, input, today, state, counts);
    } catch (err) {
        releaseSweepDay(root, today, token);
        throw err;
    }
}

function sweepClaimed(root: string, input: SweepInput, today: string, state: SweepState, counts: SweepCounts): SweepResult {
    counts.expired += expireStaleDeferred(root, today, input.timeZone, input.now);
    pruneStalePointers(root, today, input.timeZone);
    if (deferredBacklog(root) > BACKLOG_PAUSE_AT) {
        writeSweepState(root, {
            high_water: state.high_water,
            last_sweep: { day: today, at: input.now, counts, paused: true, triage_ms: [], markers: noMarkers() },
        });
        return { status: 'paused', line: null, counts };
    }

    const markers = input.readPr !== undefined ? resolveMarkers(root, input.repo, input.readPr, input.now) : noMarkers();
    const disp = readDispositions(root);
    const ran = retroSessionTags(root);
    const clock = input.clock ?? ((): number => performance.now());
    const triageMs: number[] = [];
    const candidates: { key: string; tag: string; day: string; score: number }[] = [];

    for (const s of input.sessions) {
        if (s.day >= today) continue;
        const key = unitKey({ repo: input.repo, session: s.tag });
        const prev = disp.get(key);
        // Only a deferred unit competes again; a queued (`analyse`) or durably
        // disposed one is not triaged twice.
        if (prev !== undefined && prev.class !== 'deferred') continue;
        const window = classifyUnit({
            day: s.day,
            today,
            covered: prCovered(root, input.repo, s.branch),
            retroSession: ran.has(s.tag),
        });
        if (window !== 'in-window') {
            counts[window] += 1;
            recordDisposition(root, key, window, input.now);
            if (s.eol_key !== undefined) removeSessionPointer(root, s.eol_key);
            continue;
        }
        if (s.facts === null) continue;
        const t0 = clock();
        const t = triageSession(s.facts);
        triageMs.push(Math.max(0, clock() - t0));
        if (t.class !== 'analyse') {
            counts['skip:low-signal'] += 1;
            recordDisposition(root, key, 'skip:low-signal', input.now);
            if (s.eol_key !== undefined) removeSessionPointer(root, s.eol_key);
            continue;
        }
        candidates.push({ key, tag: s.tag, day: s.day, score: t.score });
    }

    candidates.sort((a, b) => b.score - a.score || (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    candidates.forEach((c, i) => {
        if (i < DAILY_RETRO_BUDGET) {
            counts.analyse += 1;
            enqueue(root, { unit_key: c.key, kind: 'session', session: c.tag }, input.now);
            recordDisposition(root, c.key, 'analyse', input.now);
        } else {
            counts.deferred += 1;
            recordDisposition(root, c.key, 'deferred', input.now);
        }
    });

    writeSweepState(root, {
        high_water: today,
        last_sweep: { day: today, at: input.now, counts, paused: false, triage_ms: triageMs, markers },
    });
    return { status: 'ran', line: queueLine(pendingUnits(root)), counts };
}

// ---------------------------------------------------------------------------
// `/retro status`
// ---------------------------------------------------------------------------

export interface RetroStatus {
    enabled: boolean;
    pending: StoredEntry[];
    last_sweep: SweepState['last_sweep'];
    deferred_backlog: number;
    paused: boolean;
    triage_p50_ms: number | null;
    latency_over_budget: boolean;
}

export function retroStatus(root: string): RetroStatus {
    const state = readSweepState(root);
    const ms = [...(state.last_sweep?.triage_ms ?? [])].sort((a, b) => a - b);
    const p50 = ms.length === 0 ? null : ms[Math.floor((ms.length - 1) / 2)]!;
    const backlog = deferredBacklog(root);
    return {
        enabled: retroEnabled(root),
        pending: pendingUnits(root),
        last_sweep: state.last_sweep,
        deferred_backlog: backlog,
        paused: backlog > BACKLOG_PAUSE_AT,
        triage_p50_ms: p50,
        latency_over_budget: p50 !== null && p50 > TRIAGE_P50_LIMIT_MS,
    };
}

// ---------------------------------------------------------------------------
// Live readers — the forge and the session pointers
// ---------------------------------------------------------------------------

/** One PR's merge state through the forge reader; `unread` on any failure. */
export function forgePrState(api: ForgeApi, slug: string): (pr: number) => PrState {
    return (pr) => {
        const body = api.get(`repos/${slug}/pulls/${pr}`);
        if (body === null || typeof body !== 'object' || Array.isArray(body)) return { state: 'unread' };
        const b = body as Record<string, unknown>;
        if (typeof b['merged_at'] === 'string' && b['merged_at'] !== '') {
            return { state: 'MERGED', merge_sha: typeof b['merge_commit_sha'] === 'string' ? b['merge_commit_sha'] : null };
        }
        if (b['state'] === 'closed') return { state: 'CLOSED' };
        if (b['state'] === 'open') return { state: 'OPEN' };
        return { state: 'unread' };
    };
}

/** The most pointers one sweep reads facts for, newest first. */
export const MAX_SESSIONS_PER_SWEEP = 50;

/**
 * The sweep's input: every session that left a pointer, newest first. Facts are
 * read only for sessions inside the window, at most {@link MAX_SESSIONS_PER_SWEEP},
 * and only until `deadlineAt` (epoch ms) — a session not read stays undisposed
 * for the next sweep. `git worktree list` runs once for the whole sweep, not
 * once per session.
 */
export function discoverSessions(
    root: string,
    timeZone: string,
    opts: { git?: GitRun; today?: string; deadlineAt?: number; now?: () => number } = {},
): SweepSession[] {
    const now = opts.now ?? Date.now;
    const live = opts.git ?? liveGit(root);
    const memo = new Map<string, string | null>();
    const git: GitRun = (args) => {
        const k = args.join('\0');
        if (!memo.has(k)) memo.set(k, live(args));
        return memo.get(k)!;
    };
    const today = opts.today ?? localDay(new Date(now()).toISOString(), timeZone);
    // A session already queued or durably disposed is skipped by the sweep, so
    // its facts are not read and it takes none of the read cap.
    const disposed = new Set<string>();
    for (const d of readDispositions(root).values()) {
        const tag = /#session@([^/]+)\//.exec(d.unit_key)?.[1];
        if (tag !== undefined && d.class !== 'deferred') disposed.add(tag);
    }
    let read = 0;
    return listSessionPointers(root)
        .sort((a, b) => (a.ended_at < b.ended_at ? 1 : a.ended_at > b.ended_at ? -1 : 0))
        .map((p) => {
            const day = localDay(p.ended_at, timeZone);
            const inWindow =
                day < today && classifyUnit({ day, today, covered: false, retroSession: false }) === 'in-window';
            const canRead =
                inWindow &&
                !disposed.has(p.tag) &&
                read < MAX_SESSIONS_PER_SWEEP && (opts.deadlineAt === undefined || now() < opts.deadlineAt);
            if (canRead) read += 1;
            return {
                tag: p.tag,
                day,
                branch: p.branch,
                eol_key: p.eol_key,
                facts: canRead ? readSessionFacts({ tag: p.tag, root, git }) : null,
            };
        });
}

/**
 * The probe's deadline, shared by discovery and forge reads. It is checked
 * between units: a `gh` call gets only the time left, and no session's facts are
 * read once it has passed, but one synchronous fact read already started runs to
 * its end. The pointer directory it lists stays bounded by the catch-up window.
 */
export const PROBE_BUDGET_MS = 3000;

/**
 * The first-session-of-the-day probe (path C, K1/K7): no model, no spawn. It is
 * throttled per workspace by `probe_throttle` and per repository by the sweep
 * state, reads the forge for open markers inside a fixed budget — an unread
 * marker is kept, never dropped — and returns the `<retro-queue>` line or
 * `null`. A failure returns `null` and is not stamped, so the next session start
 * tries again (after the claim lease when the sweep itself crashed). The cost a
 * session start can pay is bounded by {@link PROBE_BUDGET_MS} plus at most one
 * fact read in flight.
 */
export function retroDailyProbe(
    root: string,
    deps: { now?: Date; ranToday?: (root: string) => boolean; stamp?: (root: string) => void } = {},
): string | null {
    try {
        if (!retroEnabled(root)) return null;
        if (deps.ranToday?.(root) === true) return null;
        const deadlineAt = Date.now() + PROBE_BUDGET_MS;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const slug = originSlug(root);
        const nowIso = (deps.now ?? new Date()).toISOString();
        const today = localDay(nowIso, tz);
        // Another worktree already swept today: no discovery work at all.
        if (readSweepState(root).last_sweep?.day === today) {
            deps.stamp?.(root);
            return null;
        }
        const sessions = discoverSessions(root, tz, { today, deadlineAt });
        const r = runDailySweep(root, {
            now: nowIso,
            timeZone: tz,
            repo: slug ?? path.basename(root),
            sessions,
            ...(slug !== null ? { readPr: budgetedGhPrState(root, Math.max(0, deadlineAt - Date.now())) } : {}),
        });
        // Stamped only after the sweep returned; a throw skips the stamp.
        deps.stamp?.(root);
        return r.line;
    } catch {
        return null;
    }
}

/**
 * `owner/repo` of the `origin` remote, read from the git config file rather
 * than a `git` call (hooks export `GIT_DIR`, which would redirect one).
 * `null` when there is no GitHub origin.
 */
export function originSlug(root: string): string | null {
    const common = git_common_dir(root);
    if (common === null) return null;
    let text: string;
    try {
        text = fs.readFileSync(path.join(common, 'config'), 'utf-8');
    } catch {
        return null;
    }
    const section = /\[remote "origin"\]([^[]*)/.exec(text)?.[1] ?? '';
    const url = /^\s*url\s*=\s*(\S+)/m.exec(section)?.[1];
    const m = url === undefined ? null : /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url);
    return m === null ? null : m[1]!;
}

/**
 * Merge state through `gh pr view`, with a total budget across all calls: once
 * it is spent every further marker reads `unread` and is kept for tomorrow.
 */
export function budgetedGhPrState(
    root: string,
    budgetMs: number,
    run: (args: string[], timeoutMs: number) => string = (args, timeoutMs) =>
        execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs }),
): (pr: number) => PrState {
    const started = Date.now();
    return (pr) => {
        const left = budgetMs - (Date.now() - started);
        if (left <= 0) return { state: 'unread' };
        try {
            const body = JSON.parse(run(['pr', 'view', String(pr), '--json', 'state,mergeCommit'], left)) as {
                state?: string;
                mergeCommit?: { oid?: string } | null;
            };
            if (body.state === 'MERGED') return { state: 'MERGED', merge_sha: body.mergeCommit?.oid ?? null };
            if (body.state === 'CLOSED') return { state: 'CLOSED' };
            if (body.state === 'OPEN') return { state: 'OPEN' };
            return { state: 'unread' };
        } catch {
            return { state: 'unread' };
        }
    };
}

export function renderStatus(s: RetroStatus): string {
    const lines = [
        `retro: automatic paths ${s.enabled ? 'on' : 'off'} (retro.enabled)`,
        `queue: ${s.pending.length} unit(s) waiting`,
        ...s.pending.map((e) => `  - ${e.kind} ${e.kind === 'pr' ? `#${e.pr}` : e.session} (since ${e.enqueued_at})`),
    ];
    if (s.last_sweep === null) {
        lines.push('last sweep: none yet');
    } else {
        const c = s.last_sweep.counts;
        lines.push(
            `last sweep: ${s.last_sweep.day}${s.last_sweep.paused ? ' (paused)' : ''}`,
            `  analysed: ${c.analyse}`,
            `  skipped (low-signal): ${c['skip:low-signal']}`,
            `  covered: ${c.covered}`,
            `  deferred: ${c.deferred}`,
            `  expired: ${c.expired}`,
            `  merge markers: ${s.last_sweep.markers.enqueued.length} merged, ${s.last_sweep.markers.closed.length} closed, ${s.last_sweep.markers.kept.length} open or unread`,
        );
    }
    lines.push(`deferred backlog: ${s.deferred_backlog} (sweep pauses above ${BACKLOG_PAUSE_AT})`);
    if (s.paused) lines.push('the daily sweep is PAUSED by the backlog; /retro by hand still runs');
    if (s.triage_p50_ms !== null) {
        lines.push(
            `triage p50: ${Math.round(s.triage_p50_ms)} ms${s.latency_over_budget ? ` — over the ${TRIAGE_P50_LIMIT_MS} ms budget` : ''}`,
        );
    }
    return lines.join('\n');
}

