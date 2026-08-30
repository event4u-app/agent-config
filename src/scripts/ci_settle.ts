#!/usr/bin/env tsx
/**
 * Wait for a PR's checks to settle, and never report a verdict it did not read.
 *
 * WHY THIS EXISTS. Agents write this loop by hand, and the exit condition is
 * the part that is easy to get wrong. Measured 2026-08-20:
 *
 *     until ! gh pr checks 1459 | grep -q "pending"; do sleep 60; done
 *
 * The API then failed. Its error text — `error connecting to api.github.com` —
 * contains no `pending`, so the loop exited, the run reported a settle that had
 * not happened, and the claim had to be retracted to the user in the next
 * reply. The bug is not the sleep or the grep: it is that **absence of the word
 * `pending` was treated as evidence of completion**, and an error is neither
 * settled nor pending.
 *
 * The rule this encodes, and the reason it belongs in one place rather than in
 * every agent's head: `not settled` and `settled` are different from `could not
 * read`, and only the first two may end a wait.
 *
 * Exit codes: 0 = settled, every check succeeded (or was skipped) ·
 *             1 = settled, at least one check failed ·
 *             2 = did not settle within the budget, or the API could not be
 *                 read — NEVER a verdict, and the reason is printed.
 *
 * Usage: ./scripts-run src/scripts/ci_settle <pr> [--timeout-min N] [--interval-sec N]
 *
 * THE DEFAULT DEADLINE IS UNDER THE TOOL CEILING, deliberately (9 min, see
 * {@link FOREGROUND_CEILING_MIN}). It used to be 45, and a `Bash` tool call is
 * capped at 600 s: measured over ten sessions
 * (`agents/evidence/analysis/agent-turnaround-2026-08-30.md` F2), ten of the
 * twelve slowest calls in the corpus were this script KILLED at 592-603 s and
 * re-invoked, for 2.7 h of a 14.2 h tool budget. A wait that is killed reports
 * nothing — the exit-code contract below is exactly what the truncation
 * destroys, which makes a deadline past the ceiling worse than a shorter one.
 *
 * A longer wait is still available and is a BACKGROUND job, not a bigger
 * number: run this with the host's background-execution primitive, or
 * `--timeout-min N` explicitly. Passing a value above the ceiling prints a
 * warning naming the truncation rather than silently accepting it.
 */

import { spawnSync } from 'node:child_process';

/**
 * The largest default deadline that fits inside one foreground `Bash` call.
 *
 * The tool caps at 600 s. 9 min = 540 s leaves one 60 s poll interval of
 * headroom, so the loop reaches its own `DID NOT SETTLE` branch and RETURNS a
 * stated non-verdict instead of being killed mid-poll.
 */
export const FOREGROUND_CEILING_MIN = 9;

/** What one poll told us. `unreadable` is deliberately not a verdict. */
export type PollState =
    | { kind: 'unreadable'; reason: string }
    | { kind: 'pending'; total: number; done: number }
    | { kind: 'settled'; failing: string[]; total: number };

/** Markers that mean the API did not answer — not that nothing is pending. */
const _UNREADABLE_MARKERS = [
    'error connecting to',
    'could not resolve host',
    'connection refused',
    'timeout',
    'timed out',
    'bad gateway',
    'service unavailable',
    'rate limit',
    'gh auth login',
    'not logged into',
    'HTTP 5',
];

/**
 * Classify one `gh pr view --json statusCheckRollup` result.
 *
 * Pure, so the failure this file exists to prevent is testable without a
 * network: feed it an API error and it must answer `unreadable`, never
 * `settled`.
 */
export function classifyPoll(stdout: string, stderr: string, status: number | null): PollState {
    const combined = `${stdout}\n${stderr}`.toLowerCase();
    for (const marker of _UNREADABLE_MARKERS) {
        if (combined.includes(marker.toLowerCase())) {
            return { kind: 'unreadable', reason: marker };
        }
    }
    if (status !== 0) {
        return { kind: 'unreadable', reason: `gh exited ${String(status)}` };
    }
    let rows: { name?: string; conclusion?: string | null; status?: string | null }[];
    try {
        const parsed = JSON.parse(stdout) as { statusCheckRollup?: unknown };
        const roll = parsed.statusCheckRollup;
        if (!Array.isArray(roll)) {
            return { kind: 'unreadable', reason: 'no statusCheckRollup in response' };
        }
        rows = roll as typeof rows;
    } catch {
        return { kind: 'unreadable', reason: 'unparseable JSON' };
    }
    if (rows.length === 0) {
        // Zero checks is not "settled green" — a run that has not registered
        // its checks yet looks exactly like this.
        return { kind: 'pending', total: 0, done: 0 };
    }
    const terminal = (r: (typeof rows)[number]): boolean =>
        typeof r.conclusion === 'string' && r.conclusion.length > 0;
    const done = rows.filter(terminal).length;
    if (done < rows.length) {
        return { kind: 'pending', total: rows.length, done };
    }
    const bad = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
    const failing = rows
        .filter((r) => bad.has(String(r.conclusion).toUpperCase()))
        .map((r) => String(r.name ?? '?'));
    return { kind: 'settled', failing, total: rows.length };
}

function poll(pr: string): PollState {
    const r = spawnSync('gh', ['pr', 'view', pr, '--json', 'statusCheckRollup'], {
        encoding: 'utf-8',
        timeout: 60_000,
    });
    return classifyPoll(r.stdout ?? '', r.stderr ?? '', r.status);
}

function sleepSync(seconds: number): void {
    // Deliberately synchronous: this is a CLI whose whole job is to block.
    spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${String(seconds * 1000)})`], {
        timeout: (seconds + 5) * 1000,
    });
}

export function main(argv: readonly string[]): number {
    const positional = argv.filter((a) => !a.startsWith('--'));
    const pr = positional[0];
    if (pr === undefined) {
        process.stderr.write(
            'usage: ci_settle <pr> [--timeout-min N] [--interval-sec N]\n' +
                `  default --timeout-min is ${String(FOREGROUND_CEILING_MIN)}, which fits inside one foreground Bash call (600 s cap).\n` +
                '  a longer wait is a BACKGROUND job, not a bigger number — a foreground call past the cap is killed and reports nothing.\n',
        );
        return 2;
    }
    const num = (flag: string, dflt: number): number => {
        const i = argv.indexOf(flag);
        if (i === -1) return dflt;
        const v = argv[i + 1];
        const n = v === undefined ? NaN : parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : dflt;
    };
    const timeoutMin = num('--timeout-min', FOREGROUND_CEILING_MIN);
    if (timeoutMin > FOREGROUND_CEILING_MIN) {
        // Said once, up front, rather than discovered when the call is killed:
        // a truncated wait produces no line at all, so the warning has to come
        // before the wait rather than at its expiry.
        process.stdout.write(
            `ci_settle: --timeout-min ${String(timeoutMin)} exceeds the ${String(FOREGROUND_CEILING_MIN)} min that fits ` +
                'inside one foreground Bash call (600 s cap). In the foreground this call will be KILLED before ' +
                'the deadline and will report nothing — run it as a background job for a wait this long.\n',
        );
    }
    const intervalSec = num('--interval-sec', 60);

    const deadline = Date.now() + timeoutMin * 60_000;
    let unreadableStreak = 0;

    for (;;) {
        const state = poll(pr);
        if (state.kind === 'settled') {
            if (state.failing.length === 0) {
                process.stdout.write(`ci_settle: SETTLED GREEN — ${String(state.total)} check(s)\n`);
                return 0;
            }
            process.stdout.write(
                `ci_settle: SETTLED RED — ${String(state.failing.length)} of ${String(state.total)} failing:\n` +
                    state.failing.map((f) => `  ${f}\n`).join(''),
            );
            return 1;
        }
        if (state.kind === 'unreadable') {
            unreadableStreak += 1;
            process.stdout.write(
                `ci_settle: could not read the API (${state.reason}) — NOT a verdict, still waiting ` +
                    `[${String(unreadableStreak)}]\n`,
            );
        } else {
            unreadableStreak = 0;
            process.stdout.write(
                `ci_settle: pending — ${String(state.done)}/${String(state.total)} settled\n`,
            );
        }
        if (Date.now() >= deadline) {
            process.stdout.write(
                `ci_settle: DID NOT SETTLE within ${String(timeoutMin)} min — no verdict is claimed.\n`,
            );
            return 2;
        }
        sleepSync(intervalSec);
    }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('ci_settle.ts')) {
    process.exitCode = main(process.argv.slice(2));
}
