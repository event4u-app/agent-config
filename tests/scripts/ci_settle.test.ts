// Tests for src/scripts/ci_settle.ts.
//
// The failure this file exists to prevent, measured 2026-08-20: a hand-written
// waiter exited on `error connecting to api.github.com` because the error text
// contained no "pending", and the session reported a settle that had not
// happened. So the load-bearing assertion is the negative one — an API error
// must never classify as settled.
import { describe, expect, it } from 'vitest';

import {
    classifyPoll,
    classifyTarget,
    parseArgs,
    renderNoSettle,
    FOREGROUND_CEILING_MIN,
    type RemoteTip,
} from '../../src/scripts/ci_settle.js';

const roll = (rows: unknown[]): string => JSON.stringify({ statusCheckRollup: rows });

describe('classifyPoll', () => {
    it('reads an API error as unreadable, never as settled', () => {
        const s = classifyPoll('', 'error connecting to api.github.com\ncheck your internet connection', 1);
        expect(s.kind).toBe('unreadable');
    });

    it('reads every transport failure shape as unreadable', () => {
        const shapes = [
            'could not resolve host: api.github.com',
            'connection refused',
            'request timed out',
            'HTTP 502 Bad Gateway',
            'API rate limit exceeded',
            'gh auth login required',
        ];
        for (const text of shapes) {
            expect(classifyPoll('', text, 1).kind, text).toBe('unreadable');
        }
    });

    it('reads a non-zero exit with no marker as unreadable', () => {
        expect(classifyPoll('', 'something unexpected', 3).kind).toBe('unreadable');
    });

    it('reads unparseable output as unreadable', () => {
        expect(classifyPoll('not json at all', '', 0).kind).toBe('unreadable');
    });

    it('reads zero registered checks as pending, not as settled green', () => {
        // A run that has not registered its checks yet looks identical to a
        // finished one with nothing to report. Calling that green is the same
        // class of error as the API-failure exit.
        const s = classifyPoll(roll([]), '', 0);
        expect(s.kind).toBe('pending');
    });

    it('reads a mixed set as pending while any check has no conclusion', () => {
        const s = classifyPoll(
            roll([
                { name: 'a', conclusion: 'SUCCESS' },
                { name: 'b', conclusion: null, status: 'IN_PROGRESS' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('pending');
        if (s.kind === 'pending') {
            expect(s.done).toBe(1);
            expect(s.total).toBe(2);
        }
    });

    it('reads an all-successful set as settled green', () => {
        const s = classifyPoll(roll([{ name: 'a', conclusion: 'SUCCESS' }, { name: 'b', conclusion: 'SKIPPED' }]), '', 0);
        expect(s.kind).toBe('settled');
        if (s.kind === 'settled') {
            expect(s.failing).toEqual([]);
        }
    });

    it('reads a failing set as settled red and names the checks', () => {
        const s = classifyPoll(
            roll([
                { name: 'Node Tests', conclusion: 'FAILURE' },
                { name: 'Static Checks', conclusion: 'SUCCESS' },
                { name: 'Golden', conclusion: 'TIMED_OUT' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('settled');
        if (s.kind === 'settled') {
            expect(s.failing).toEqual(['Node Tests', 'Golden']);
        }
    });

    it('never reports settled for any input that is not a complete rollup', () => {
        // The property, stated as one assertion: nothing outside a fully
        // concluded rollup may end a wait.
        const notSettled = [
            classifyPoll('', 'error connecting to api.github.com', 1),
            classifyPoll('', '', 1),
            classifyPoll('garbage', '', 0),
            classifyPoll(roll([]), '', 0),
            classifyPoll(roll([{ name: 'a', conclusion: null }]), '', 0),
        ];
        for (const s of notSettled) {
            expect(s.kind).not.toBe('settled');
        }
    });
});

// road-to-agent-turnaround 3.1. The measured defect was not a wrong verdict, it
// was NO verdict: a 45-minute default deadline against a 600 s `Bash` ceiling
// meant ten of the twelve slowest calls in a ten-session corpus were this script
// killed at 592-603 s and re-invoked. A killed wait prints nothing, so the
// carefully separated exit codes above never reach the caller at all.
describe('foreground deadline', () => {
    it('fits inside one Bash call with at least one poll interval to spare', () => {
        // 600 s is the tool ceiling; 60 s is the default poll interval. The
        // deadline must leave room for the loop to REACH its own DID-NOT-SETTLE
        // branch, not merely to be under the cap.
        expect(FOREGROUND_CEILING_MIN * 60).toBeLessThanOrEqual(600 - 60);
    });

    it('is a number, not a comment — a documented ceiling nobody reads is the old state', () => {
        expect(Number.isInteger(FOREGROUND_CEILING_MIN)).toBe(true);
        expect(FOREGROUND_CEILING_MIN).toBeGreaterThan(0);
    });
});

// The second half of "never report a verdict it did not read": a verdict has to
// be ABOUT something. Measured 2026-09-08 on PR #1949 — the PR had been merged
// at 18:29, pushes to its branch created no checks, and the rollup kept
// answering with the merge-time head's 40 green checks while
// `/commits/<sha>/check-runs` for the actual branch tip answered 0. Read at face
// value that green authorises merging content nobody checked.
//
// The load-bearing assertions are the two negatives: a merged PR and a diverged
// head must classify `refuse`, never `open`.
describe('classifyTarget', () => {
    const pr = (state: string, head: string, ref = 'feat/x'): string =>
        JSON.stringify({ state, headRefOid: head, headRefName: ref });
    const found = (sha: string): RemoteTip => ({ kind: 'found', sha });
    const sha = 'a'.repeat(40);

    it('refuses a MERGED PR instead of letting its stale rollup through', () => {
        const t = classifyTarget(pr('MERGED', sha), '', 0, found(sha));
        expect(t.kind).toBe('refuse');
        if (t.kind === 'refuse') expect(t.reason).toContain('MERGED');
    });

    it('refuses a CLOSED PR for the same reason', () => {
        expect(classifyTarget(pr('CLOSED', sha), '', 0, found(sha)).kind).toBe('refuse');
    });

    it('refuses when the record head and the branch tip disagree', () => {
        const t = classifyTarget(pr('OPEN', sha), '', 0, found('b'.repeat(40)));
        expect(t.kind).toBe('refuse');
        // The message must name BOTH heads — a refusal the reader cannot act on
        // is the same dead end as no refusal.
        if (t.kind === 'refuse') {
            expect(t.reason).toContain(sha.slice(0, 9));
            expect(t.reason).toContain('b'.repeat(9));
        }
    });

    it('accepts an OPEN PR whose head equals the tip, and says the check ran', () => {
        const t = classifyTarget(pr('OPEN', sha), '', 0, found(sha));
        expect(t.kind).toBe('open');
        if (t.kind === 'open') {
            expect(t.head).toBe(sha);
            expect(t.divergenceChecked).toBe(true);
        }
    });

    it('does not collapse an absent ref into agreement — a fork PR passes, flagged', () => {
        const t = classifyTarget(pr('OPEN', sha), '', 0, { kind: 'absent' });
        expect(t.kind).toBe('open');
        // Not silently "checked": a fork's ref is not under this origin, and
        // claiming the check applied would be the coverage inflation the whole
        // exit-code contract exists to avoid.
        if (t.kind === 'open') expect(t.divergenceChecked).toBe(false);
    });

    it('reads an unreadable tip as unreadable, never as agreement', () => {
        const t = classifyTarget(pr('OPEN', sha), '', 0, { kind: 'unreadable', reason: 'connection refused' });
        expect(t.kind).toBe('unreadable');
    });

    it('reads a transport failure on the PR read as unreadable, never as open', () => {
        for (const text of ['error connecting to api.github.com', 'HTTP 502 Bad Gateway']) {
            expect(classifyTarget('', text, 1, found(sha)).kind, text).toBe('unreadable');
        }
    });

    it('reads a response missing any of the three fields as unreadable', () => {
        const partials = [
            JSON.stringify({ state: 'OPEN', headRefOid: sha }),
            JSON.stringify({ state: 'OPEN', headRefName: 'feat/x' }),
            JSON.stringify({ headRefOid: sha, headRefName: 'feat/x' }),
            'not json at all',
        ];
        for (const body of partials) {
            expect(classifyTarget(body, '', 0, found(sha)).kind, body).toBe('unreadable');
        }
    });

    it('is case-insensitive on state, so a lowercase `open` is not refused', () => {
        expect(classifyTarget(pr('open', sha), '', 0, found(sha)).kind).toBe('open');
    });
});

// The failure this block exists to prevent, measured 2026-10-01 on PR #2130:
// the call was written `ci_settle 2130 --timeout 1700`. Every other waiting
// tool spells that flag `--timeout`, this one spells it `--timeout-min`, and
// the old parser did two silent things with the mistake rather than one. It
// ignored the unknown flag, so the wait fell back to the 9-minute default; and
// because `1700` carries no leading dashes it survived the positional filter,
// so the stray value became `positional[1]` and vanished. The caller believed
// they had asked for 28 minutes, got 9, and read the resulting
// `DID NOT SETTLE` as a slow CI rather than as their own typo. A waiter whose
// whole product is a trustworthy verdict must not accept an argument it does
// not honour.
describe('parseArgs', () => {
    it('accepts the documented form', () => {
        const r = parseArgs(['2130', '--timeout-min', '20', '--interval-sec', '30']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.pr).toBe('2130');
        expect(r.timeoutMin).toBe(20);
        expect(r.intervalSec).toBe(30);
    });

    it('defaults both knobs when neither is given', () => {
        const r = parseArgs(['2130']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.timeoutMin).toBe(FOREGROUND_CEILING_MIN);
        expect(r.intervalSec).toBe(60);
    });

    it('REFUSES an unknown flag instead of ignoring it — the measured case', () => {
        const r = parseArgs(['2130', '--timeout', '1700']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('--timeout');
        expect(r.message).toContain('--timeout-min');
    });

    it('refuses any other unknown flag, not just the one that was measured', () => {
        for (const flag of ['--wait', '--max-min', '--poll', '--timeoutmin']) {
            const r = parseArgs(['2130', flag, '5']);
            expect(r.kind, flag).toBe('usage');
        }
    });

    it('refuses a second positional rather than swallowing it', () => {
        const r = parseArgs(['2130', '1700']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('1700');
    });

    it('refuses a flag value it cannot parse, rather than falling back to the default', () => {
        for (const bad of ['abc', '', '-5', '0', '1.5min']) {
            const r = parseArgs(['2130', '--timeout-min', bad]);
            expect(r.kind, bad).toBe('usage');
        }
    });

    it('refuses a flag given with no value at all', () => {
        expect(parseArgs(['2130', '--timeout-min']).kind).toBe('usage');
        expect(parseArgs(['2130', '--interval-sec']).kind).toBe('usage');
    });

    it('still refuses a missing PR, and says so', () => {
        const r = parseArgs([]);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('usage: ci_settle');
    });

    it('accepts `--flag=value` as well, since that is the other spelling a caller reaches for', () => {
        const r = parseArgs(['2130', '--timeout-min=20']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.timeoutMin).toBe(20);
    });

    it('keeps a timeout above the foreground ceiling — it warns, it does not refuse', () => {
        const r = parseArgs(['2130', '--timeout-min', '30']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.timeoutMin).toBe(30);
    });
});

// R2 completion review, 2026-10-01 (drain-ci-settle-arg-guard, findings 1-4).
// The first guard validated every flag and left the one MANDATORY argument
// unchecked, so the shape it was written to remove stayed reachable through
// the front door: `ci_settle PR-2130` parsed as ok, every poll came back
// unreadable because `gh pr view PR-2130` exits non-zero, and the run spent
// its whole budget to end at `DID NOT SETTLE` — verbatim the outcome a caller
// reads as slow CI rather than as their own typo. A guard that refuses the
// optional arguments and waves the required one through is not a guard.
describe('parseArgs — the PR argument itself', () => {
    it('accepts a plain number', () => {
        const r = parseArgs(['2130']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.pr).toBe('2130');
    });

    it('accepts a #-prefixed number and hands on the bare digits', () => {
        const r = parseArgs(['#2130']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.pr).toBe('2130');
    });

    it('accepts a PR URL and hands on the number', () => {
        const r = parseArgs(['https://github.com/event4u-app/agent-config/pull/2130']);
        expect(r.kind).toBe('ok');
        if (r.kind !== 'ok') return;
        expect(r.pr).toBe('2130');
    });

    it('REFUSES a PR argument that is not a number — the reachable failure shape', () => {
        for (const bad of ['PR-2130', 'pr2130', '2130x', 'drain/archive-host-claims', '', '-1', '0', '2130.0']) {
            const r = parseArgs([bad]);
            expect(r.kind, bad).toBe('usage');
        }
    });

    it('names the PR argument in its refusal, not a flag', () => {
        const r = parseArgs(['PR-2130']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('PR-2130');
        expect(r.message.toLowerCase()).toContain('pr number');
    });
});

describe('parseArgs — the branches the first round left untested', () => {
    it('refuses a repeated flag', () => {
        const r = parseArgs(['2130', '--timeout-min', '10', '--timeout-min', '20']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('twice');
    });

    it('refuses a flag whose value is the NEXT flag, not just a missing tail', () => {
        const r = parseArgs(['2130', '--timeout-min', '--interval-sec', '5']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('--timeout-min');
    });

    it('refuses a bad --interval-sec value and says SECONDS, not minutes', () => {
        const r = parseArgs(['2130', '--interval-sec', 'abc']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('seconds');
    });

    it('refuses a digits-only value that parses to Infinity — the finiteness guard the rewrite dropped', () => {
        const huge = '9'.repeat(400);
        const r = parseArgs(['2130', '--timeout-min', huge]);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message.toLowerCase()).toContain('too large');
    });

    it('names the real constraint on an extra positional, never a guessed flag', () => {
        const r = parseArgs(['2130', 'notes.txt']);
        expect(r.kind).toBe('usage');
        if (r.kind !== 'usage') return;
        expect(r.message).toContain('notes.txt');
        // The old message interpolated the stray value into `--timeout-min <it>`,
        // which for a non-numeric stray is advice parseArgs would itself refuse.
        expect(r.message).not.toContain('--timeout-min notes.txt');
    });
});

// Measured 2026-10-01 on PR #2135, whose rollup carried TWO rows named
// `lint commit subjects` — one CANCELLED, one SUCCESS. A concurrency group had
// superseded its own earlier run. `gh pr checks` reports that check SUCCESS;
// this classifier reported the PR RED, because CANCELLED sat in the bad set
// unconditionally and nothing looked at the twin.
//
// A false RED is the same defect class as a silently-shortened wait: a verdict
// the caller cannot act on. It is the more expensive direction here, because a
// red verdict sends an agent hunting a failure that does not exist — which is
// exactly what it did, costing that run a diagnosis it did not owe.
//
// The narrow reading is the only safe one. A CANCELLED row is superseded ONLY
// when another row of the SAME NAME concluded SUCCESS. A genuine cancellation —
// a human stopping a run, a timeout killing one — has no successful twin and
// must stay failing, or this fix trades a false red for a false green.
describe('classifyPoll — a superseded duplicate is not a failure', () => {
    it('does not fail on a CANCELLED row whose same-named twin succeeded', () => {
        const s = classifyPoll(
            roll([
                { name: 'lint commit subjects', conclusion: 'CANCELLED' },
                { name: 'lint commit subjects', conclusion: 'SUCCESS' },
                { name: 'other', conclusion: 'SUCCESS' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('settled');
        if (s.kind !== 'settled') return;
        expect(s.failing).toEqual([]);
    });

    it('STILL fails a CANCELLED row with no successful twin — the false-green direction', () => {
        const s = classifyPoll(
            roll([
                { name: 'cancelled alone', conclusion: 'CANCELLED' },
                { name: 'other', conclusion: 'SUCCESS' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('settled');
        if (s.kind !== 'settled') return;
        expect(s.failing).toEqual(['cancelled alone']);
    });

    it('still fails a CANCELLED row whose twin also did not succeed', () => {
        const s = classifyPoll(
            roll([
                { name: 'twice bad', conclusion: 'CANCELLED' },
                { name: 'twice bad', conclusion: 'FAILURE' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('settled');
        if (s.kind !== 'settled') return;
        expect(s.failing).toContain('twice bad');
    });

    it('does not extend the reprieve to any other bad conclusion', () => {
        for (const bad of ['FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']) {
            const s = classifyPoll(
                roll([
                    { name: 'dup', conclusion: bad },
                    { name: 'dup', conclusion: 'SUCCESS' },
                ]),
                '',
                0,
            );
            expect(s.kind, bad).toBe('settled');
            if (s.kind !== 'settled') continue;
            expect(s.failing, bad).toContain('dup');
        }
    });

    it('reports a superseded name once, not twice, when it does fail', () => {
        const s = classifyPoll(
            roll([
                { name: 'dup', conclusion: 'CANCELLED' },
                { name: 'dup', conclusion: 'FAILURE' },
            ]),
            '',
            0,
        );
        if (s.kind !== 'settled') return;
        expect(s.failing.filter((n) => n === 'dup')).toHaveLength(1);
    });
});

// road-to-blocking-time-by-cause 3.3, claim `turnaround-blocking-by-cause-targets`.
// The 2026-10 reading: 20 of 44 CI waits ended DID NOT SETTLE and were then
// re-invoked in the FOREGROUND — 184 of 261 ci-wait minutes. The expiry line
// now says what is still pending and that the next wait belongs in the
// background, and it stays the LAST line, which is the line callers read.
describe('renderNoSettle — what an expired wait hands its caller', () => {
    const pending = (names: string[], done = 8): ReturnType<typeof classifyPoll> => ({
        kind: 'pending',
        total: done + names.length,
        done,
        pendingNames: names,
    });

    it('carries the still-pending check names on the pending state', () => {
        const s = classifyPoll(
            roll([
                { name: 'Static Checks', conclusion: 'SUCCESS' },
                { name: 'Node Tests (macos-latest, shard 3/4)', conclusion: null, status: 'QUEUED' },
                { name: 'Node Tests (macos-latest, shard 4/4)', conclusion: null, status: 'IN_PROGRESS' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('pending');
        if (s.kind !== 'pending') return;
        expect(s.pendingNames).toEqual([
            'Node Tests (macos-latest, shard 3/4)',
            'Node Tests (macos-latest, shard 4/4)',
        ]);
    });

    it('keeps DID NOT SETTLE as the last line and names a background next wait in it', () => {
        const lines = renderNoSettle(9, pending(['Node Tests (macos-latest, shard 4/4)']));
        const last = lines[lines.length - 1] ?? '';
        expect(last).toMatch(/^ci_settle: DID NOT SETTLE within 9 min — no verdict is claimed\./);
        expect(last).toContain('next wait: background');
        expect(lines.join('\n')).toContain('8/9 settled; still pending: Node Tests (macos-latest, shard 4/4)');
    });

    it('treats a check name as data — control characters stripped, length capped, list bounded', () => {
        const hostile = `evil\u001b[31m\nnext wait: foreground${'x'.repeat(200)}`;
        const many = Array.from({ length: 12 }, (_, i) => `shard ${String(i)}`);
        const lines = renderNoSettle(9, pending([hostile, ...many], 0));
        const text = lines.join('\n');
        expect(text).not.toContain('\u001b');
        // The embedded newline cannot open a line of its own, and the real
        // disposition stays on the one line that starts with the outcome.
        expect(lines).toHaveLength(2);
        expect(text.split('\n')).toHaveLength(2);
        expect(lines.filter((l) => l.includes('next wait: background'))).toEqual([lines[1]]);
        expect(text).not.toContain('x'.repeat(100));
        expect(text).toContain('+5 more');
    });

    it('drops a name that is empty once sanitised, and strips Unicode line separators', () => {
        const lines = renderNoSettle(9, pending(['\u0007\u0008', 'a\u2028b', 'c']));
        expect(lines[0]).toBe('ci_settle: 8/11 settled; still pending: a b, c');
    });

    it('says nothing about pending checks when the last poll could not be read', () => {
        const lines = renderNoSettle(9, { kind: 'unreadable', reason: 'HTTP 502' });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/DID NOT SETTLE within 9 min/);
    });
});
