import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SessionFacts } from '../../src/scripts/retro_facts.js';
import { planManualRetro, retroStatus, runDailySweep, type SweepSession } from '../../src/scripts/retro.js';
import { discoverSessions, retroDailyProbe } from '../../src/scripts/retro_sweep.js';
import { recordMergeMarker } from '../../src/scripts/hooks/push_settle_hook.js';
import { writeRetroPointer } from '../../src/scripts/hooks/session_eol_hook.js';
import { derive_session_tag } from '../../src/scripts/_lib/session_tag.js';
import {
    BACKLOG_PAUSE_AT,
    CATCH_UP_WINDOW_DAYS,
    DAILY_RETRO_BUDGET,
    TRIAGE_P50_LIMIT_MS,
    claimSweepDay,
    classifyUnit,
    enqueue,
    enqueueMerged,
    listMarkers,
    listQueue,
    localDay,
    markerForBranch,
    pendingUnits,
    queueDir,
    queueLine,
    readSweepState,
    recordDisposition,
    resolveMarkers,
    retroEnabled,
    sweepDays,
    writeMergeMarker,
    listSessionPointers,
    writeSessionPointer,
    writeSweepState,
    type PrState,
} from '../../src/scripts/retro_queue.js';

const tmpDirs: string[] = [];
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-queue-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function repoWithWorktree(): { main: string; wt: string } {
    const main = tmp();
    const run = (cwd: string, args: string[]) => {
        const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    };
    run(main, ['init', '-q', '-b', 'main']);
    run(main, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']);
    const wt = path.join(tmp(), 'wt');
    run(main, ['worktree', 'add', '-q', '-b', 'side', wt]);
    return { main, wt };
}

const BERLIN = 'Europe/Berlin';

describe('retro_queue — one queue', () => {
    it('two-worktrees-one-queue', () => {
        const { main, wt } = repoWithWorktree();

        const key = 'retro:acme/widget#pr7@abc/p1';
        expect(enqueue(main, { unit_key: key, kind: 'pr', pr: 7 }, '2026-10-17T08:00:00Z')).toBe('enqueued');
        expect(enqueue(wt, { unit_key: key, kind: 'pr', pr: 7 }, '2026-10-17T09:00:00Z')).toBe('exists');
        enqueue(wt, { unit_key: 'retro:acme/widget#session@t1/p1', kind: 'session', session: 't1' }, '2026-10-17T09:00:00Z');

        expect(fs.realpathSync(queueDir(main)!)).toBe(fs.realpathSync(queueDir(wt)!));
        const fromMain = listQueue(main).map((e) => e.unit_key).sort();
        const fromWt = listQueue(wt).map((e) => e.unit_key).sort();
        expect(fromMain).toEqual(fromWt);
        expect(fromMain).toHaveLength(2);
        expect(listQueue(main).find((e) => e.unit_key === key)!.enqueued_at).toBe('2026-10-17T08:00:00Z');
    });

    it('leaves no temp file behind', () => {
        const { main } = repoWithWorktree();
        enqueue(main, { unit_key: 'retro:x#pr1@a/p1', kind: 'pr', pr: 1 }, '2026-10-17T08:00:00Z');
        expect(fs.readdirSync(queueDir(main)!).every((n) => n.endsWith('.json'))).toBe(true);
    });

    it('outside a git repository there is no queue', () => {
        const dir = tmp();
        expect(queueDir(dir)).toBeNull();
        expect(enqueue(dir, { unit_key: 'k', kind: 'pr', pr: 1 }, '2026-10-17T08:00:00Z')).toBe('no-queue');
        expect(listQueue(dir)).toEqual([]);
    });
});

describe('retro_queue — window and dedupe', () => {
    it('dst-switch-neither-drops-nor-doubles', () => {
        // Berlin leaves summer time on 2026-10-25 at 03:00 local.
        const days = sweepDays('2026-10-23', '2026-10-27');
        expect(days).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
        // Spring forward, 2026-03-29.
        expect(sweepDays('2026-03-27', '2026-03-31')).toEqual([
            '2026-03-27',
            '2026-03-28',
            '2026-03-29',
            '2026-03-30',
        ]);
        // 23:30 local on the 24th is still the 24th, on either side of the switch.
        expect(localDay('2026-10-24T21:30:00Z', BERLIN)).toBe('2026-10-24');
        expect(localDay('2026-10-25T22:30:00Z', BERLIN)).toBe('2026-10-25');
    });

    it('a sweep driven by the clock across the switch sees each finished day once', () => {
        // First session of the day, an hour after local midnight, on each side of the fall-back night.
        const before = localDay('2026-10-24T22:00:00Z', BERLIN); // 25th, 00:00 CEST
        const after = localDay('2026-10-26T00:00:00Z', BERLIN); // 26th, 01:00 CET
        expect(before).toBe('2026-10-25');
        expect(after).toBe('2026-10-26');
        expect(sweepDays('2026-10-24', before)).toEqual(['2026-10-24']);
        expect(sweepDays(before, after)).toEqual(['2026-10-25']);
        const spring = localDay('2026-03-29T23:00:00Z', BERLIN); // 30th, 01:00 CEST
        expect(sweepDays('2026-03-29', spring)).toEqual(['2026-03-29']);
    });

    it('a malformed day is refused, never read as an empty sweep', () => {
        expect(() => sweepDays('yesterday', '2026-10-27')).toThrow(/not a calendar day/);
    });

    it('older than the window is expired, inside it is not', () => {
        const today = '2026-10-27';
        const edge = `2026-10-${27 - CATCH_UP_WINDOW_DAYS}`;
        expect(classifyUnit({ day: edge, today, covered: false, retroSession: false })).toBe('in-window');
        expect(classifyUnit({ day: `2026-10-${26 - CATCH_UP_WINDOW_DAYS}`, today, covered: false, retroSession: false })).toBe(
            'expired',
        );
    });

    it('a session whose PR has a retro, and a retro session, are covered', () => {
        const today = '2026-10-27';
        expect(classifyUnit({ day: today, today, covered: true, retroSession: false })).toBe('covered');
        expect(classifyUnit({ day: today, today, covered: false, retroSession: true })).toBe('covered');
    });

    it('today is not swept; only finished days are', () => {
        expect(sweepDays('2026-10-27', '2026-10-27')).toEqual([]);
        expect(sweepDays('2026-10-26', '2026-10-27')).toEqual(['2026-10-26']);
    });

    it('a high-water mark older than the window sweeps only the window', () => {
        const days = sweepDays('2026-09-01', '2026-10-27');
        expect(days).toHaveLength(CATCH_UP_WINDOW_DAYS);
        expect(days[days.length - 1]).toBe('2026-10-26');
    });
});

// ---------------------------------------------------------------------------
// The switch and the three paths
// ---------------------------------------------------------------------------

let savedHome: string | undefined;
beforeEach(() => {
    savedHome = process.env['EVENT4U_CONFIG_HOME'];
    // An empty user-global root, so the developer's own file never decides a case.
    process.env['EVENT4U_CONFIG_HOME'] = tmp();
});
afterEach(() => {
    if (savedHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedHome;
});

function userGlobal(body: string): void {
    const dir = path.join(process.env['EVENT4U_CONFIG_HOME']!, 'settings');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.agent-settings.yml'), body);
}

const NOW = '2026-10-21T07:00:00Z';
const m = <T>(value: T) => ({ status: 'measured' as const, value });
const miss = { status: 'missing' as const, reason: 'not read' };

function sessionFacts(tag: string, over: Partial<SessionFacts> = {}): SessionFacts {
    return {
        unit: 'session',
        tag,
        workspaces: m(['/w']),
        found_in: m('/w'),
        turns: m(4),
        assistant_records: m(4),
        tool_calls: m(2),
        compactions: m(0),
        final_context_tokens: m(1000),
        interruptions: m({ ask: 0, handback: 0, none: 1 }),
        self_repair_in_window: m(0),
        roadmap: miss,
        branch: miss,
        pr: miss,
        ...over,
    };
}

function session(tag: string, day: string, over: Partial<SessionFacts> = {}): SweepSession {
    return { tag, day, branch: null, facts: sessionFacts(tag, over) };
}

describe('retro_queue — the switch', () => {
    it('disabled-globally-means-no-probe', () => {
        const { main, wt } = repoWithWorktree();
        expect(retroEnabled(main)).toBe(true);

        userGlobal('retro:\n  enabled: false\n');
        for (const ws of [main, wt]) {
            expect(retroEnabled(ws)).toBe(false);
            expect(runDailySweep(ws, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: [session('t1', '2026-10-20', { self_repair_in_window: m(2) })] }).status).toBe('disabled');
            expect(writeMergeMarker(ws, { pr: 9, branch: 'side' }, NOW)).toBe('disabled');
            expect(enqueueMerged(ws, { repo: 'acme/widget', prs: [{ pr: 9 }] }, NOW).status).toBe('disabled');
            expect(writeSessionPointer(ws, { eol_key: 'k', tag: 't', branch: null, workspace: ws, ended_at: NOW })).toBe(false);
        }
        // Nothing was written: no queue entry, no marker, no sweep state.
        expect(listQueue(main)).toEqual([]);
        expect(listMarkers(main)).toEqual([]);
        expect(readSweepState(main).last_sweep).toBeNull();
    });

    it('disabled-globally-means-no-probe: a project false holds and a project true overrides the user-global false', () => {
        const { main } = repoWithWorktree();
        fs.writeFileSync(path.join(main, '.agent-settings.yml'), 'retro:\n  enabled: false\n');
        expect(retroEnabled(main)).toBe(false);
        userGlobal('retro:\n  enabled: false\n');
        fs.writeFileSync(path.join(main, '.agent-settings.yml'), 'retro:\n  enabled: true\n');
        expect(retroEnabled(main)).toBe(true);
    });

    it('a malformed settings layer disarms the automatic paths', () => {
        const { main } = repoWithWorktree();
        fs.writeFileSync(path.join(main, '.agent-settings.yml'), 'retro: [unclosed\n');
        expect(retroEnabled(main)).toBe(false);
    });
});

describe('retro_queue — path A, the merge', () => {
    it('drain-of-three-enqueues-once', () => {
        const { main } = repoWithWorktree();
        const prs = [{ pr: 1, merge_sha: 'a' }, { pr: 2, merge_sha: 'b' }, { pr: 3, merge_sha: 'c' }];
        const first = enqueueMerged(main, { repo: 'acme/widget', prs }, NOW);
        expect(first.status).toBe('enqueued');
        expect(first.units).toHaveLength(3);
        const line = queueLine(pendingUnits(main));
        expect(line).not.toBeNull();
        expect(line!.split('\n')).toHaveLength(1);
        expect(line).toContain('pending="3"');
        // The same drain reported twice adds nothing.
        expect(enqueueMerged(main, { repo: 'acme/widget', prs }, NOW).units).toEqual([]);
        expect(listQueue(main)).toHaveLength(3);
    });
});

describe('retro_queue — path B, forge merges', () => {
    it('web-merge-is-picked-up', () => {
        const { main, wt } = repoWithWorktree();
        expect(writeMergeMarker(wt, { pr: 11, branch: 'side' }, NOW)).toBe('written');
        expect(writeMergeMarker(main, { pr: 11, branch: 'side' }, NOW)).toBe('exists');
        writeMergeMarker(main, { pr: 12, branch: 'b12' }, NOW);
        writeMergeMarker(main, { pr: 13, branch: 'b13' }, NOW);
        expect(markerForBranch(main, 'side')).toBe(11);

        const states: Record<number, PrState> = {
            11: { state: 'MERGED', merge_sha: 'f'.repeat(40) },
            12: { state: 'unread' },
            13: { state: 'CLOSED' },
        };
        const r = resolveMarkers(main, 'acme/widget', (pr) => states[pr]!, NOW);
        expect(r).toEqual({ enqueued: [11], closed: [13], kept: [12] });
        expect(listQueue(main).map((e) => e.pr)).toEqual([11]);
        expect(listMarkers(main).map((mk) => mk.pr)).toEqual([12]);
    });

    it('a throwing forge read keeps the marker', () => {
        const { main } = repoWithWorktree();
        writeMergeMarker(main, { pr: 21, branch: null }, NOW);
        const r = resolveMarkers(main, 'acme/widget', () => {
            throw new Error('offline');
        }, NOW);
        expect(r.kept).toEqual([21]);
        expect(listQueue(main)).toEqual([]);
    });
});

describe('retro_queue — path C, the daily sweep', () => {
    it('zero-candidates-is-silent', () => {
        const { main } = repoWithWorktree();
        const empty = runDailySweep(main, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: [] });
        expect(empty.status).toBe('ran');
        expect(empty.line).toBeNull();

        const { main: other } = repoWithWorktree();
        const quiet = runDailySweep(other, {
            now: NOW,
            timeZone: BERLIN,
            repo: 'acme/widget',
            sessions: [session('t1', '2026-10-20'), session('t2', '2026-10-19')],
        });
        expect(quiet.line).toBeNull();
        expect(quiet.counts['skip:low-signal']).toBe(2);
        expect(listQueue(other)).toEqual([]);
    });

    it('analyses within the budget, defers the rest, and sweeps a day once', () => {
        const { main, wt } = repoWithWorktree();
        const busy = (tag: string, n: number) => session(tag, '2026-10-20', { self_repair_in_window: m(1), compactions: m(n) });
        const r = runDailySweep(main, {
            now: NOW,
            timeZone: BERLIN,
            repo: 'acme/widget',
            sessions: [busy('a', 0), busy('b', 2), busy('c', 1), busy('d', 2), session('today', '2026-10-21', { self_repair_in_window: m(1) })],
        });
        expect(r.counts.analyse).toBe(DAILY_RETRO_BUDGET);
        expect(r.counts.deferred).toBe(1);
        expect(r.line).toContain(`pending="${DAILY_RETRO_BUDGET}"`);
        // The lowest score is the one deferred, and today's session is not swept.
        expect(listQueue(main).map((e) => e.session).sort()).toEqual(['b', 'c', 'd']);
        // A second worktree on the same day does not sweep again.
        expect(runDailySweep(wt, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: [busy('e', 2)] }).status).toBe('already-swept');
    });

    it('backlog-pauses-sweep-not-manual', () => {
        const { main } = repoWithWorktree();
        for (let i = 0; i <= BACKLOG_PAUSE_AT; i++) recordDisposition(main, `retro:acme/widget#session@d${i}/p1`, 'deferred', NOW);
        const r = runDailySweep(main, {
            now: NOW,
            timeZone: BERLIN,
            repo: 'acme/widget',
            sessions: [session('x', '2026-10-20', { self_repair_in_window: m(1) })],
        });
        expect(r.status).toBe('paused');
        expect(r.line).toBeNull();
        expect(listQueue(main)).toEqual([]);
        expect(retroStatus(main).paused).toBe(true);
        // `/retro` by hand still triages a unit while the sweep is paused.
        const manual = planManualRetro(main, { repo: 'acme/widget', facts: [sessionFacts('x', { self_repair_in_window: m(1) })] });
        expect(manual).toHaveLength(1);
        expect(manual[0]!.triage.class).toBe('analyse');
    });

    it('zero-candidates-is-silent: the session-start probe sweeps once and stays quiet', () => {
        const { main } = repoWithWorktree();
        let stamped = 0;
        const deps = { ranToday: () => false, stamp: () => void (stamped += 1), now: new Date(NOW) };
        expect(retroDailyProbe(main, deps)).toBeNull();
        expect(stamped).toBe(1);
        expect(readSweepState(main).last_sweep).not.toBeNull();
        // Throttled: a probe that already ran today does nothing at all.
        expect(retroDailyProbe(main, { ...deps, ranToday: () => true })).toBeNull();
        expect(stamped).toBe(1);
        // Disabled: no stamp, no sweep.
        const { main: off } = repoWithWorktree();
        fs.writeFileSync(path.join(off, '.agent-settings.yml'), 'retro:\n  enabled: false\n');
        expect(retroDailyProbe(off, deps)).toBeNull();
        expect(stamped).toBe(1);
        expect(readSweepState(off).last_sweep).toBeNull();
    });

    it('web-merge-is-picked-up: a push that resolved a PR leaves the marker, one that did not leaves none', () => {
        const { main, wt } = repoWithWorktree();
        recordMergeMarker({ workspace_root: wt }, 31, 'side');
        recordMergeMarker({ workspace_root: wt }, null, 'other');
        expect(listMarkers(main).map((mk) => [mk.pr, mk.branch])).toEqual([[31, 'side']]);
    });

    it('worktree-session-is-seen-from-main: the session-end hook leaves a pointer with the branch', () => {
        const { main, wt } = repoWithWorktree();
        expect(writeRetroPointer(wt, 'k'.repeat(64), 'sid-1', NOW)).toBe(true);
        expect(writeRetroPointer(wt, 'k'.repeat(64), '', NOW)).toBe(false);
        const [p] = listSessionPointers(main);
        expect(p!.branch).toBe('side');
        expect(p!.tag).toBe(derive_session_tag('sid-1'));
        expect(fs.realpathSync(p!.workspace)).toBe(fs.realpathSync(wt));
    });

    it('two session starts racing for one day: exactly one sweeps', () => {
        const { main, wt } = repoWithWorktree();
        expect(claimSweepDay(main, '2026-10-21')).toBe(true);
        expect(claimSweepDay(wt, '2026-10-21')).toBe(false);
        // The loser of the claim reports already-swept even before any state was written.
        expect(runDailySweep(wt, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: [] }).status).toBe('already-swept');
        // A new day is a new claim, and the old one is pruned.
        expect(claimSweepDay(wt, '2026-10-22')).toBe(true);
    });

    it('backlog-pauses-sweep-not-manual: a stale backlog expires, so the pause ends by itself', () => {
        const { main } = repoWithWorktree();
        for (let i = 0; i <= BACKLOG_PAUSE_AT; i++) recordDisposition(main, `retro:acme/widget#session@d${i}/p1`, 'deferred', '2026-10-01T07:00:00Z');
        const r = runDailySweep(main, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: [] });
        expect(r.status).toBe('ran');
        expect(retroStatus(main).deferred_backlog).toBe(0);
    });

    it('a probe past its deadline reads no facts and leaves the sessions for the next sweep', () => {
        const { main } = repoWithWorktree();
        writeSessionPointer(main, { eol_key: 'a'.repeat(64), tag: 'late', branch: null, workspace: main, ended_at: '2026-10-20T10:00:00Z' }, { enabled: true });
        const sessions = discoverSessions(main, BERLIN, { git: () => null, today: '2026-10-21', deadlineAt: 0 });
        expect(sessions).toHaveLength(1);
        expect(sessions[0]!.facts).toBeNull();
        const r = runDailySweep(main, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions });
        expect(r.counts).toEqual({ analyse: 0, 'skip:low-signal': 0, covered: 0, deferred: 0, expired: 0 });
        expect(listSessionPointers(main)).toHaveLength(1);
        // An out-of-window session needs no facts, is expired, and its pointer is dropped.
        const { main: old } = repoWithWorktree();
        writeSessionPointer(old, { eol_key: 'b'.repeat(64), tag: 'old', branch: null, workspace: old, ended_at: '2026-10-01T10:00:00Z' }, { enabled: true });
        const oldSessions = discoverSessions(old, BERLIN, { git: () => null, today: '2026-10-21' });
        expect(oldSessions[0]!.facts).toBeNull();
        expect(runDailySweep(old, { now: NOW, timeZone: BERLIN, repo: 'acme/widget', sessions: oldSessions }).counts.expired).toBe(1);
        expect(listSessionPointers(old)).toEqual([]);
    });

    it('the queue line asks for the retro after the first task and grants nothing else', () => {
        const line = queueLine([{ unit_key: 'k', kind: 'pr', pr: 1, enqueued_at: NOW }])!;
        expect(line).toContain("after the user's first task");
        expect(line).not.toMatch(/subagent|delegate|spawn/i);
    });

    it('a slow triage is reported by status, not hidden', () => {
        const { main } = repoWithWorktree();
        writeSweepState(main, {
            high_water: '2026-10-21',
            last_sweep: {
                day: '2026-10-21',
                at: NOW,
                counts: { analyse: 0, 'skip:low-signal': 1, covered: 0, deferred: 0, expired: 0 },
                paused: false,
                triage_ms: [2500, 2600, 100],
                markers: { enqueued: [], closed: [], kept: [] },
            },
        });
        const s = retroStatus(main);
        expect(s.triage_p50_ms).toBe(2500);
        expect(s.latency_over_budget).toBe(true);
        expect(TRIAGE_P50_LIMIT_MS).toBe(2000);
    });
});
