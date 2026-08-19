/**
 * interruption_report — road-to-user-out-of-the-loop Phase 0 Step 2.
 *
 * What these tests are really pinning is HONESTY, not arithmetic. The report
 * feeds two pre-registered claims, so the failure that matters is not a wrong
 * median — it is a median that looks authoritative while resting on five
 * sessions labelled thirty, or a zero-contacts reading produced by a ledger
 * that was simply empty.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_WINDOW,
    buildReport,
    isSyntheticUserText,
    main,
    median,
    readLedger,
    renderText,
    waitGaps,
    type HistoryTurn,
} from '../../src/scripts/interruption_report.js';

let root: string;

function writeHistory(lines: readonly object[]): void {
    const dir = path.join(root, 'agents', 'runtime');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, '.agent-chat-history'),
        lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
        'utf8',
    );
}

function writeLedger(lines: readonly object[]): void {
    const dir = path.join(root, 'agents', 'runtime', 'state');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'interruptions.jsonl'),
        lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
        'utf8',
    );
}

function turn(session: string, role: 'user' | 'agent', ts: string, text = 'x'): object {
    return { t: role, s: session, ts, text };
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'interruption-report-'));
    delete process.env['AGENT_CHAT_HISTORY_FILE'];
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('median', () => {
    it('is null on an empty set rather than 0 — no observations is not a value', () => {
        expect(median([])).toBeNull();
    });

    it('takes the middle of an odd set and the mean of the middle two of an even set', () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
    });
});

describe('isSyntheticUserText', () => {
    it('recognises the harness-produced user entries', () => {
        expect(isSyntheticUserText('<task-notification>\nfoo')).toBe(true);
        expect(isSyntheticUserText('a <system-reminder> inside')).toBe(true);
    });

    it('leaves a real user reply alone', () => {
        expect(isSyntheticUserText('ja, mach das')).toBe(false);
    });
});

describe('waitGaps', () => {
    const t = (role: 'user' | 'agent', ts: string, synthetic = false): HistoryTurn => ({
        session: 's',
        role,
        ts,
        synthetic,
    });

    it('measures agent → real-user as one wait', () => {
        const gaps = waitGaps([t('agent', '2026-08-17T10:00:00Z'), t('user', '2026-08-17T10:05:00Z')]);
        expect(gaps).toEqual([5]);
    });

    it('does NOT treat a synthetic user entry as a reply — the collapse-to-zero failure', () => {
        const gaps = waitGaps([
            t('agent', '2026-08-17T10:00:00Z'),
            t('user', '2026-08-17T10:00:30Z', true),
            t('user', '2026-08-17T10:20:00Z'),
        ]);
        expect(gaps).toEqual([20]);
    });

    it('counts one wait per agent turn, not one per user line', () => {
        const gaps = waitGaps([
            t('agent', '2026-08-17T10:00:00Z'),
            t('user', '2026-08-17T10:02:00Z'),
            t('user', '2026-08-17T10:09:00Z'),
        ]);
        expect(gaps).toEqual([2]);
    });

    it('ignores a user turn with no preceding agent turn', () => {
        expect(waitGaps([t('user', '2026-08-17T10:00:00Z')])).toEqual([]);
    });
});

describe('readLedger', () => {
    it('is empty rather than throwing when the ledger is absent', () => {
        expect(readLedger(root)).toEqual([]);
    });

    it('skips a corrupt line and keeps the rest', () => {
        const dir = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'interruptions.jsonl'),
            '{ broken\n' + JSON.stringify({ run_id: 'r1', turn: 1, kind: 'ask' }) + '\n',
        );
        expect(readLedger(root).map((r) => r.run_id)).toEqual(['r1']);
    });
});

describe('buildReport — the short-window honesty requirement', () => {
    it('flags a window shorter than requested and reports the real count', () => {
        writeHistory([
            turn('s1', 'user', '2026-08-17T10:00:00Z'),
            turn('s1', 'agent', '2026-08-17T10:01:00Z'),
        ]);
        const report = buildReport(root, 30);
        expect(report.window_requested).toBe(30);
        expect(report.sessions_found).toBe(1);
        expect(report.window_short).toBe(true);
        expect(renderText(report)).toContain('SHORT WINDOW');
    });

    it('does not flag a window that is satisfied', () => {
        writeHistory([
            turn('s1', 'user', '2026-08-17T10:00:00Z'),
            turn('s1', 'agent', '2026-08-17T10:01:00Z'),
        ]);
        expect(buildReport(root, 1).window_short).toBe(false);
    });

    it('reports a null median rather than 0 when the ledger has no observations', () => {
        writeHistory([
            turn('s1', 'user', '2026-08-17T10:00:00Z'),
            turn('s1', 'agent', '2026-08-17T10:01:00Z'),
        ]);
        const report = buildReport(root, 30);
        expect(report.median_contacts_per_run).toBeNull();
        expect(report.notes.join(' ')).toContain('interruptions.jsonl is empty or absent');
    });
});

describe('buildReport — the two axes', () => {
    beforeEach(() => {
        writeHistory([
            turn('aaa', 'user', '2026-08-17T10:00:00Z'),
            turn('aaa', 'agent', '2026-08-17T10:10:00Z'),
            turn('aaa', 'user', '2026-08-17T10:30:00Z'),
            turn('aaa', 'agent', '2026-08-17T10:40:00Z'),
        ]);
        writeLedger([
            { run_id: 'aaa', turn: 1, kind: 'ask', class: 'open-question', roadmap: 'road-to-x' },
            { run_id: 'aaa', turn: 2, kind: 'none', class: 'none', roadmap: 'road-to-x' },
            { run_id: 'aaa', turn: 3, kind: 'handback', class: 'handback', roadmap: 'road-to-x' },
        ]);
    });

    it('separates asks from hand-backs and sums both into contacts', () => {
        const run = buildReport(root, 30).runs.find((r) => r.run_id === 'aaa');
        expect(run).toBeDefined();
        expect(run!.asks).toBe(1);
        expect(run!.handbacks).toBe(1);
        expect(run!.contacts).toBe(2);
    });

    it('counts only the contact on the run\'s last turn as a halt', () => {
        const run = buildReport(root, 30).runs.find((r) => r.run_id === 'aaa');
        expect(run!.halts).toBe(1);
    });

    it('attributes the run to its claimed roadmap', () => {
        const run = buildReport(root, 30).runs.find((r) => r.run_id === 'aaa');
        expect(run!.roadmap).toBe('road-to-x');
    });

    it('splits elapsed into waiting and working', () => {
        const run = buildReport(root, 30).runs.find((r) => r.run_id === 'aaa');
        // 10:00 → 10:40 elapsed; one real wait 10:10 → 10:30.
        expect(run!.elapsed_minutes).toBe(40);
        expect(run!.waiting_minutes).toBe(20);
        expect(run!.working_minutes).toBe(20);
    });
});

describe('buildReport — a run in one source only is reported, never dropped', () => {
    it('keeps a ledger run that has no chat history, with a null wall clock', () => {
        writeHistory([
            turn('withhist', 'user', '2026-08-17T10:00:00Z'),
            turn('withhist', 'agent', '2026-08-17T10:01:00Z'),
        ]);
        writeLedger([{ run_id: 'noHist', turn: 1, kind: 'ask', class: 'open-question', roadmap: null }]);
        const report = buildReport(root, 30);
        const run = report.runs.find((r) => r.run_id === 'noHist');
        expect(run).toBeDefined();
        expect(run!.contacts).toBe(1);
        expect(run!.elapsed_minutes).toBeNull();
    });

    it('keeps a history run that has no ledger entry, and says so in the notes', () => {
        writeHistory([
            turn('onlyhist', 'user', '2026-08-17T10:00:00Z'),
            turn('onlyhist', 'agent', '2026-08-17T10:01:00Z'),
        ]);
        writeLedger([{ run_id: 'other', turn: 1, kind: 'ask', class: 'open-question', roadmap: null }]);
        const report = buildReport(root, 30);
        expect(report.runs.some((r) => r.run_id === 'onlyhist')).toBe(true);
        expect(report.notes.join(' ')).toContain('timing but no ledger entry');
    });

    it('excludes a history-only run from the contact median rather than scoring it 0', () => {
        writeHistory([
            turn('onlyhist', 'user', '2026-08-17T10:00:00Z'),
            turn('onlyhist', 'agent', '2026-08-17T10:01:00Z'),
            turn('withled', 'user', '2026-08-17T11:00:00Z'),
            turn('withled', 'agent', '2026-08-17T11:01:00Z'),
        ]);
        writeLedger([
            { run_id: 'withled', turn: 1, kind: 'ask', class: 'open-question', roadmap: null },
            { run_id: 'withled', turn: 2, kind: 'ask', class: 'open-question', roadmap: null },
        ]);
        // Two contacts on the only measured run. A history-only run scored as 0
        // would drag this to 1 and understate the baseline by half.
        expect(buildReport(root, 30).median_contacts_per_run).toBe(2);
    });
});

describe('buildReport — windowing', () => {
    it('keeps the newest sessions by their last turn, not their first', () => {
        writeHistory([
            // Starts earliest but is still running — must survive a window of 1.
            turn('long', 'user', '2026-08-17T08:00:00Z'),
            turn('short', 'user', '2026-08-17T09:00:00Z'),
            turn('short', 'agent', '2026-08-17T09:05:00Z'),
            turn('long', 'agent', '2026-08-17T12:00:00Z'),
        ]);
        const report = buildReport(root, 1);
        expect(report.runs.map((r) => r.run_id)).toEqual(['long']);
    });
});

describe('main — the CLI contract', () => {
    it('exits 0 on --help, which is the roadmap verify probe', () => {
        expect(main(['--help'])).toBe(0);
    });

    it('rejects a non-numeric window rather than silently defaulting', () => {
        expect(main(['--window', 'abc'])).toBe(2);
        expect(main(['--window', '0'])).toBe(2);
    });

    it('rejects an unknown argument', () => {
        expect(main(['--nope'])).toBe(2);
    });

    it('defaults the window to the conformance window', () => {
        expect(DEFAULT_WINDOW).toBe(30);
    });

    it('runs to 0 against an empty root and emits both axis headings', () => {
        expect(main(['--root', root])).toBe(0);
        const rendered = renderText(buildReport(root, DEFAULT_WINDOW));
        expect(rendered).toContain('CONTACT AXIS');
        expect(rendered).toContain('WALL-CLOCK AXIS');
    });
});

// ── the autonomy axis (Phase 5.0) ───────────────────────────────────────────
//
// Three of the five metrics the roadmap names have a real source; two do not.
// The distinction between "measured, and it is zero" and "there is no
// instrument" is the whole reason these cases exist — printing 0 for an
// unmeasurable axis is the confusion between an absent RECORD and an absent
// EVENT that this repository has recorded costing a published false finding.

function writeContinuation(lines: readonly object[]): void {
    const dir = path.join(root, 'agents', 'runtime', 'state');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'run-continuation.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
        'utf8',
    );
}

describe('buildReport — the autonomy axis', () => {
    it('counts engage and halt-stall events per run', () => {
        writeLedger([{ run_id: 'r1', turn: 1, kind: 'none', class: 'none', roadmap: null }]);
        writeContinuation([
            { run_id: 'r1', event: 'engage' },
            { run_id: 'r1', event: 'engage' },
            { run_id: 'r1', event: 'halt-stall' },
            { run_id: 'r1', event: 'complete' },
        ]);
        const r = buildReport(root, DEFAULT_WINDOW);
        const run = r.runs.find((x) => x.run_id === 'r1');
        expect(run?.reengagements).toBe(2);
        expect(run?.stall_halts).toBe(1);
    });

    it('the stall figure is a RATE over runs, not a count of events', () => {
        // A raw count rises with the window and would read as a regression
        // when nothing changed.
        writeLedger([
            { run_id: 'r1', turn: 1, kind: 'none', class: 'none', roadmap: null },
            { run_id: 'r2', turn: 1, kind: 'none', class: 'none', roadmap: null },
        ]);
        writeContinuation([
            { run_id: 'r1', event: 'halt-stall' },
            { run_id: 'r1', event: 'halt-stall' },
        ]);
        // One of two runs stalled — 50%, whatever the event count.
        expect(buildReport(root, DEFAULT_WINDOW).stall_halt_rate).toBe(0.5);
    });

    it('relaunches and memos join on the same run id', () => {
        writeLedger([{ run_id: 'r1', turn: 1, kind: 'none', class: 'none', roadmap: null }]);
        const state = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(path.join(state, 'decisions', 'r1'), { recursive: true });
        fs.writeFileSync(path.join(state, 'decisions', 'r1', '001.md'), 'x', 'utf8');
        fs.writeFileSync(path.join(state, 'decisions', 'r1', '002.md'), 'x', 'utf8');
        fs.writeFileSync(
            path.join(state, 'supervise-relaunches.json'),
            JSON.stringify({ r1: 2 }),
            'utf8',
        );
        const run = buildReport(root, DEFAULT_WINDOW).runs.find((x) => x.run_id === 'r1');
        expect(run?.relaunches).toBe(2);
        expect(run?.memos).toBe(2);
    });

    it('absent sources yield zeros, not an error — a run predating the mechanism had zero', () => {
        writeLedger([{ run_id: 'r1', turn: 1, kind: 'none', class: 'none', roadmap: null }]);
        const run = buildReport(root, DEFAULT_WINDOW).runs.find((x) => x.run_id === 'r1');
        expect(run).toMatchObject({ reengagements: 0, stall_halts: 0, relaunches: 0, memos: 0 });
    });

    it('a malformed continuation line is skipped rather than fatal', () => {
        writeLedger([{ run_id: 'r1', turn: 1, kind: 'none', class: 'none', roadmap: null }]);
        const dir = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'run-continuation.jsonl'),
            `not json\n${JSON.stringify({ run_id: 'r1', event: 'engage' })}\n`,
            'utf8',
        );
        expect(buildReport(root, DEFAULT_WINDOW).runs[0]?.reengagements).toBe(1);
    });

    it('renders the two unmeasurable axes as NO INSTRUMENT, never as 0', () => {
        const out = renderText(buildReport(root, DEFAULT_WINDOW));
        expect(out).toContain('AUTONOMY AXIS');
        expect(out).toContain('unattended-vs-attended rework: NO INSTRUMENT');
        expect(out).toContain('memo revisit rate:            NO INSTRUMENT');
    });

    it('the stall rate is n/a with no runs, not 0%', () => {
        expect(buildReport(root, DEFAULT_WINDOW).stall_halt_rate).toBeNull();
        expect(renderText(buildReport(root, DEFAULT_WINDOW))).toContain('stall-halt rate:           n/a');
    });
});
