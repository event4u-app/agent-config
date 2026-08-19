/**
 * run_supervise — the watcher's classification, and the two things it must
 * never do.
 *
 * The classification order IS the logic, and each rung exists against a
 * specific wrong answer:
 *
 *   · a LIVE session is never a candidate, however far behind it is;
 *   · a FINISHED roadmap is never a candidate, however dead its session is;
 *   · a run that already burned its relaunch budget is never a candidate,
 *     because a run dying four times has a problem a fourth session will not
 *     fix.
 *
 * And two negatives with teeth: the reader must include EXPIRED records (the
 * live ones are exactly the sessions needing no supervision), and it must
 * never prune them (deleting the evidence would make the first scan the last
 * one that could see anything).
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { iso_now, type SessionRecord } from '../../src/scripts/_lib/session_register.js';
import {
    MAX_RELAUNCHES_PER_RUN,
    SUPERVISE_STATE_REL,
    classify,
    clearCompleted,
    digest,
    readAllRecords,
    readLedger,
    render,
    resumePlans,
    scan,
    writeLedger,
    type Candidate,
} from '../../src/scripts/run_supervise.js';

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function root(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'run-supervise-'));
    dirs.push(d);
    return d;
}

const NOW = new Date('2026-08-19T12:00:00.000Z');
const LONG_AGO = new Date('2026-08-01T00:00:00.000Z');

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
    return {
        session_id: 'sess-1',
        platform: 'claude',
        worktree: '/tmp/wt',
        branch: 'feat/x',
        roadmap_slug: 'road-to-x',
        started_at: iso_now(LONG_AGO),
        last_seen: iso_now(LONG_AGO),
        ...over,
    };
}

function writeRoadmap(repoRoot: string, slug: string, lines: string[]): void {
    const dir = path.join(repoRoot, 'agents', 'roadmaps');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.md`), `${lines.join('\n')}\n`, 'utf-8');
}

describe('classify — order is the logic', () => {
    it('a beating session is ALIVE even with open steps', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] open']);
        const c = classify(r, rec({ last_seen: iso_now(NOW) }), {}, NOW);
        expect(c.disposition).toBe('alive');
    });

    it('a dead session holding no claim has nothing to resume', () => {
        const c = classify(root(), rec({ roadmap_slug: null }), {}, NOW);
        expect(c.disposition).toBe('no-roadmap');
    });

    it('a dead session whose roadmap was archived reports a stale CLAIM, not lost work', () => {
        // The distinction matters: "roadmap-unreadable" tells an operator the
        // register is behind, while treating it as relaunchable would start a
        // session against a file that is not there.
        const c = classify(root(), rec(), {}, NOW);
        expect(c.disposition).toBe('roadmap-unreadable');
        expect(c.reason).toContain('archived');
    });

    it('a dead session on a FINISHED roadmap is complete, not relaunchable', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [x] done', '- [~] parked']);
        const c = classify(r, rec(), {}, NOW);
        expect(c.disposition).toBe('complete');
        expect(c.open_steps).toBe(0);
    });

    it('parked steps do not keep a run relaunchable', () => {
        // `[~]`/`[-]` are decisions, not work. A watcher that re-engaged into
        // them would restart a session to do what a human declined.
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [x] done', '- [~] deferred', '- [-] cancelled']);
        expect(classify(r, rec(), {}, NOW).disposition).toBe('complete');
    });

    it('a dead session with open steps is RELAUNCHABLE', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [x] done', '- [ ] a', '- [ ] b']);
        const c = classify(r, rec(), {}, NOW);
        expect(c.disposition).toBe('relaunchable');
        expect(c.open_steps).toBe(2);
    });

    it('the relaunch budget caps at three per run', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        expect(
            classify(r, rec(), { 'road-to-x': MAX_RELAUNCHES_PER_RUN - 1 }, NOW).disposition,
        ).toBe('relaunchable');
        const spent = classify(r, rec(), { 'road-to-x': MAX_RELAUNCHES_PER_RUN }, NOW);
        expect(spent.disposition).toBe('budget-exhausted');
        expect(spent.relaunches).toBe(MAX_RELAUNCHES_PER_RUN);
    });

    it('the cap binds ACROSS generations — a new session id does not reset it', () => {
        // R2 round 2, finding 9, and the reason the tests above had to move to
        // the roadmap key: relaunching produces a new session id, so a
        // session-keyed ledger handed every generation a fresh budget of three
        // and the "three per RUN" cap could never bind. This test is the whole
        // point of the key change — a second-generation session, spent budget.
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const secondGeneration = rec({ session_id: 'sess-2-relaunched' });
        const c = classify(r, secondGeneration, { 'road-to-x': MAX_RELAUNCHES_PER_RUN }, NOW);
        expect(c.disposition).toBe('budget-exhausted');
    });

    it('a session-keyed ledger no longer grants a budget — the old shape is inert', () => {
        // Pins the direction: the pre-fix key reads as "never relaunched".
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const c = classify(r, rec(), { 'sess-1': MAX_RELAUNCHES_PER_RUN }, NOW);
        expect(c.disposition).toBe('relaunchable');
        expect(c.relaunches).toBe(0);
    });

    it('liveness is checked BEFORE the budget — a live session is never budget-exhausted', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const c = classify(r, rec({ last_seen: iso_now(NOW) }), { 'road-to-x': 99 }, NOW);
        expect(c.disposition).toBe('alive');
    });
});

describe('readAllRecords — expired records are the point', () => {
    it('returns expired records, which read_live_records filters out by design', () => {
        const dir = root();
        fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(rec({ session_id: 'a' })), 'utf-8');
        expect(readAllRecords(dir).map((r) => r.session_id)).toEqual(['a']);
    });

    it('never deletes what it reads', () => {
        const dir = root();
        const file = path.join(dir, 'a.json');
        fs.writeFileSync(file, JSON.stringify(rec({ session_id: 'a' })), 'utf-8');
        readAllRecords(dir);
        readAllRecords(dir);
        expect(fs.existsSync(file)).toBe(true);
    });

    it('an unparseable file is skipped, not fatal', () => {
        const dir = root();
        fs.writeFileSync(path.join(dir, 'bad.json'), 'not json', 'utf-8');
        fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(rec({ session_id: 'a' })), 'utf-8');
        expect(readAllRecords(dir).map((r) => r.session_id)).toEqual(['a']);
    });

    it('a missing register directory is empty, not an error', () => {
        expect(readAllRecords(path.join(root(), 'nope'))).toEqual([]);
    });
});

describe('the relaunch ledger', () => {
    it('round-trips and lands under runtime state', () => {
        const r = root();
        writeLedger(r, { 'road-to-x': 2 });
        expect(fs.existsSync(path.join(r, SUPERVISE_STATE_REL))).toBe(true);
        expect(readLedger(r)).toEqual({ 'road-to-x': 2 });
    });

    it('a malformed or absent ledger reads as empty rather than throwing', () => {
        const r = root();
        expect(readLedger(r)).toEqual({});
        const f = path.join(r, SUPERVISE_STATE_REL);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '[1,2,3]', 'utf-8');
        expect(readLedger(r)).toEqual({});
    });

    it('non-numeric and negative counts are dropped — a bad entry must not UNBOUND the cap', () => {
        const r = root();
        const f = path.join(r, SUPERVISE_STATE_REL);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, JSON.stringify({ a: 'lots', b: -1, c: 2 }), 'utf-8');
        expect(readLedger(r)).toEqual({ c: 2 });
    });
});

describe('render', () => {
    it('states the no-merge boundary whenever it reports something relaunchable', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const out = render([classify(r, rec(), {}, NOW)]);
        expect(out).toContain('RELAUNCHABLE');
        expect(out).toContain('NEVER merges, pushes, or closes');
    });

    it('an empty register says so instead of printing an empty list', () => {
        expect(render([])).toContain('no sessions registered');
    });
});

describe('digest — the morning report (UOTL 7.2)', () => {
    const NOW_D = new Date('2026-08-19T07:00:00.000Z');

    it('reports the three axes even when everything is empty', () => {
        // A digest over an empty tree is the honest output of a lane that has
        // not run yet — much better than a scheduler that schedules something
        // nothing can execute.
        const out = digest(root(), [], NOW_D);
        expect(out).toContain('2026-08-19');
        expect(out).toContain('sessions: 0 registered');
        expect(out).toContain('decisions: 0 memo(s)');
        expect(out).toContain('schedules nothing and starts nothing');
    });

    it('an absent budget reports DISABLED, never a blank ceiling', () => {
        expect(digest(root(), [], NOW_D)).toContain('unattended runs DISABLED');
    });

    it('a configured budget reports spend against the ceiling', () => {
        const r = root();
        const f = path.join(r, 'agents', 'runtime', 'state', 'unattended-budget.json');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(
            f,
            JSON.stringify({
                max_usd: 10,
                max_tokens: 1000,
                spent_usd: 2,
                spent_tokens: 50,
                window_opened: '2026-08-19',
            }),
            'utf-8',
        );
        expect(digest(r, [], NOW_D)).toContain('$2/10');
    });

    it('counts decision memos across runs', () => {
        const r = root();
        for (const [run, n] of [['runA', 2], ['runB', 1]] as const) {
            const d = path.join(r, 'agents', 'runtime', 'state', 'decisions', run);
            fs.mkdirSync(d, { recursive: true });
            for (let i = 1; i <= n; i++) {
                fs.writeFileSync(path.join(d, `${String(i).padStart(3, '0')}.md`), 'x', 'utf-8');
            }
        }
        expect(digest(r, [], NOW_D)).toContain('3 memo(s) across 2 run(s)');
    });

    it('lists what needs attention only when something does', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        expect(digest(r, [], NOW_D)).not.toContain('needs attention');
        const out = digest(r, [classify(r, rec(), {}, NOW)], NOW_D);
        expect(out).toContain('needs attention');
        expect(out).toContain('sess-1');
    });
});

describe('scan — wiring against a real register directory', () => {
    it('reads the register under the git common dir', () => {
        const r = root();
        // `register_dir` resolves through the git common dir, so the fixture
        // has to be a real repository — that resolution is exactly what this
        // case exists to exercise.
        spawnSync('git', ['init', '-q'], { cwd: r });
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const dir = path.join(r, '.git', 'agent-sessions');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'sess-1.json'), JSON.stringify(rec()), 'utf-8');
        const found = scan(r, { now: NOW });
        expect(found).toHaveLength(1);
        expect(found[0]?.disposition).toBe('relaunchable');
    });

    it('a non-repository yields no candidates rather than an error', () => {
        expect(scan(root(), { now: NOW })).toEqual([]);
    });
});

describe('clearCompleted — the cap bounds a RUN, not a roadmap lifetime', () => {
    // R2 round 3, finding 6. Round 2 moved the key from session to roadmap so
    // the cap could bind at all; without a reset that swapped a cap that never
    // binds for one that never releases — three deaths in March refusing a
    // relaunch in September for an unrelated run.
    const cand = (over: Partial<Candidate>): Candidate =>
        ({
            session_id: 's',
            roadmap: 'road-to-x',
            worktree: null,
            relaunches: 0,
            disposition: 'relaunchable',
            open_steps: 1,
            reason: '',
            ...over,
        }) as Candidate;

    it('drops the counter of a completed roadmap', () => {
        const out = clearCompleted({ 'road-to-x': 3 }, [cand({ disposition: 'complete' })]);
        expect(out).toEqual({});
    });

    it('keeps the counter of a roadmap still running', () => {
        const out = clearCompleted({ 'road-to-x': 2 }, [cand({ disposition: 'relaunchable' })]);
        expect(out).toEqual({ 'road-to-x': 2 });
    });

    it('touches only the completed roadmap, never its neighbours', () => {
        const out = clearCompleted({ 'road-to-x': 3, 'road-to-y': 1 }, [
            cand({ disposition: 'complete' }),
            cand({ roadmap: 'road-to-y', disposition: 'relaunchable' }),
        ]);
        expect(out).toEqual({ 'road-to-y': 1 });
    });

    it('a completed candidate with no roadmap clears nothing', () => {
        const out = clearCompleted({ 'road-to-x': 3 }, [
            cand({ roadmap: null, disposition: 'complete' }),
        ]);
        expect(out).toEqual({ 'road-to-x': 3 });
    });

    it('a spent budget becomes relaunchable again after the run completes', () => {
        // The end-to-end statement of the fix: same roadmap, budget spent,
        // then a completion — and the next run starts from zero.
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] a']);
        const spent = classify(r, rec(), { 'road-to-x': MAX_RELAUNCHES_PER_RUN }, NOW);
        expect(spent.disposition).toBe('budget-exhausted');

        const afterCompletion = clearCompleted({ 'road-to-x': MAX_RELAUNCHES_PER_RUN }, [
            cand({ disposition: 'complete' }),
        ]);
        expect(classify(r, rec(), afterCompletion, NOW).disposition).toBe('relaunchable');
    });
});

describe('writeLedger — a failed write is never swallowed', () => {
    // The swallow this replaces carried a comment asserting "there is NO
    // CALLER", which was false in the same file: `digest` calls it. The two
    // comments contradicted each other fourteen lines apart, and the
    // consequence was a digest reporting a release that had not happened.
    it('throws rather than reporting success it did not achieve', () => {
        const r = root();
        // A FILE where the state directory must be: mkdirSync then fails.
        fs.mkdirSync(path.join(r, 'agents', 'runtime'), { recursive: true });
        fs.writeFileSync(path.join(r, 'agents', 'runtime', 'state'), 'not a directory', 'utf-8');
        expect(() => writeLedger(r, { 'road-to-x': 1 })).toThrow();
    });

    it('round-trips through readLedger on a healthy tree', () => {
        const r = root();
        writeLedger(r, { 'road-to-x': 2 });
        expect(readLedger(r)).toEqual({ 'road-to-x': 2 });
        expect(fs.existsSync(path.join(r, SUPERVISE_STATE_REL))).toBe(true);
    });
});

describe('digest — the release line follows the WRITE, not the intent', () => {
    const done = (over: Partial<Candidate> = {}): Candidate =>
        ({
            session_id: 's',
            roadmap: 'road-to-x',
            worktree: '/tmp/wt',
            platform: 'claude',
            relaunches: 0,
            disposition: 'complete',
            open_steps: 0,
            reason: '',
            ...over,
        }) as Candidate;

    it('reports a reset when the ledger write succeeded', () => {
        const r = root();
        writeLedger(r, { 'road-to-x': 2 });
        const out = digest(r, [done()], NOW);
        expect(out).toContain('relaunch budget reset');
        expect(readLedger(r)).toEqual({});
    });

    it('a completed roadmap that never had a counter reports NOTHING and writes nothing', () => {
        // R2 round 2, finding 7. Counting completed CANDIDATES rather than the
        // ledger delta reported a release for a roadmap with no counter — and
        // with no relaunch mechanism shipping, the ledger is always empty, so
        // every such line was false. It also made a read-report create the
        // state file holding `{}`.
        const r = root();
        const out = digest(r, [done()], NOW);
        expect(out).not.toContain('released:');
        expect(fs.existsSync(path.join(r, SUPERVISE_STATE_REL))).toBe(false);
    });

    it('counts what the ledger lost, not how many candidates completed', () => {
        const r = root();
        writeLedger(r, { 'road-to-x': 2 });
        // Two completed candidates, ONE of which has a counter.
        const out = digest(r, [done(), done({ roadmap: 'road-to-y' })], NOW);
        expect(out).toContain('released:  1 completed roadmap(s)');
    });

    it('reports NOT RESET when the ledger write failed', () => {
        // The direction that matters: a stale-high counter refuses the next
        // relaunch, and the digest had just told the operator it would not.
        //
        // The failure has to be a WRITE failure specifically — the read must
        // still succeed, or the delta is 0 and the branch never runs (which is
        // itself correct, and is the case above). So: a readable ledger inside
        // a directory that refuses new writes.
        const r = root();
        writeLedger(r, { 'road-to-x': 2 });
        const stateDir = path.dirname(path.join(r, SUPERVISE_STATE_REL));
        fs.chmodSync(path.join(r, SUPERVISE_STATE_REL), 0o444);
        fs.chmodSync(stateDir, 0o555);
        try {
            const out = digest(r, [done()], NOW);
            expect(out).toContain('NOT RESET');
            expect(out).not.toContain('relaunch budget reset');
        } finally {
            // Restore before afterEach, or the tmpdir cleanup fails.
            fs.chmodSync(stateDir, 0o755);
            fs.chmodSync(path.join(r, SUPERVISE_STATE_REL), 0o644);
        }
    });
});

describe('resumePlans — only what the scan classified as relaunchable', () => {
    const cand = (over: Partial<Candidate>): Candidate =>
        ({
            session_id: 's',
            roadmap: 'road-to-x',
            worktree: '/tmp/wt',
            platform: 'claude',
            relaunches: 0,
            disposition: 'relaunchable',
            open_steps: 1,
            reason: '',
            ...over,
        }) as Candidate;

    it('skips alive, complete and budget-exhausted runs', () => {
        // Printing a command for those would hand the operator a line that
        // undoes the classification the scan just made.
        const plans = resumePlans(
            root(),
            [
                cand({ disposition: 'alive' }),
                cand({ disposition: 'complete' }),
                cand({ disposition: 'budget-exhausted' }),
                cand({ disposition: 'relaunchable' }),
            ],
            NOW,
        );
        expect(plans).toHaveLength(1);
        expect(plans[0]?.target.roadmapSlug).toBe('road-to-x');
    });

    it('a relaunchable candidate with no roadmap yields no plan', () => {
        expect(resumePlans(root(), [cand({ roadmap: null })], NOW)).toHaveLength(0);
    });

    it('carries the DEAD session platform, never the current process host', () => {
        const plans = resumePlans(root(), [cand({ platform: 'gemini' })], NOW);
        expect(plans[0]?.command).toContain('gemini');
        expect(plans[0]?.command).not.toContain('claude');
    });
});
