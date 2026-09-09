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
 * A verdict also has to be ABOUT SOMETHING, which is the second half of the
 * same rule and was missing until 2026-09-08: the rollup answers about the head
 * the PR *record* carries, and that head stops tracking the branch when the PR
 * is merged or when the record lags a push. Both then look like a healthy
 * green. {@link classifyTarget} refuses those, before the wait and again at
 * verdict time. Measured cost of not having it: a `SETTLED GREEN — 40 check(s)`
 * for a head with literally zero check runs.
 *
 * Exit codes: 0 = settled green, and the head it is about is named ·
 *             1 = settled, at least one check failed ·
 *             2 = did not settle within the budget, the API could not be read,
 *                 or the target is not a PR a verdict can be about (merged,
 *                 closed, or head-diverged) — NEVER a verdict, and the reason
 *                 is printed.
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

/**
 * What `git ls-remote` said about the PR branch's tip.
 *
 * `absent` and `unreadable` are different answers and must not collapse: a
 * cross-repo fork PR legitimately has no ref under this `origin`, while a
 * transport failure means nobody knows. Collapsing them either disables the
 * divergence check for forks silently, or blocks every fork PR forever.
 */
export type RemoteTip =
    | { kind: 'found'; sha: string }
    | { kind: 'absent' }
    | { kind: 'unreadable'; reason: string };

/**
 * Whether the PR this wait is about still decides anything.
 *
 * `refuse` is NOT a verdict — it exits 2 like every other non-verdict, because
 * the wait produced no readable statement about the head that matters.
 */
export type TargetState =
    | { kind: 'open'; head: string; ref: string; divergenceChecked: boolean }
    | { kind: 'unreadable'; reason: string }
    | { kind: 'refuse'; reason: string };

/**
 * Decide whether a green from {@link classifyPoll} may be reported at all.
 *
 * WHY THIS EXISTS, measured 2026-09-08 on PR #1949 and paid for twice in one
 * session. `gh pr view --json statusCheckRollup` answers about the head the PR
 * *record* carries, and that head stops tracking the branch in two situations
 * this script previously could not tell apart from a healthy wait:
 *
 * 1. **The PR is already merged or closed.** A push to its branch fires no
 *    `pull_request` event, so no checks are created for the new commits and the
 *    rollup keeps returning the merge-time head's checks. The script reported
 *    `SETTLED GREEN — 40 check(s)` for a head that had stopped mattering, and
 *    the only thing that exposed it was a hand-written
 *    `/commits/<sha>/check-runs` query answering `0`. Reported at face value
 *    that green authorises a merge of content nobody checked.
 * 2. **The PR record lags the branch ref.** Same shape, different cause
 *    (recorded on PR #710): `git ls-remote` shows the new SHA while the record
 *    keeps the old one, and merging then lands the PR WITHOUT the newer
 *    commits — silently, which is what makes it worse than a red.
 *
 * Both are answered by the same two facts, which is why one function decides
 * them: the PR's `state`, and whether its head equals the branch tip. Pure, so
 * the failure is testable without a network — feed it a merged PR and it must
 * answer `refuse`, never `open`.
 */
export function classifyTarget(
    stdout: string,
    stderr: string,
    status: number | null,
    tip: RemoteTip,
): TargetState {
    const combined = `${stdout}\n${stderr}`.toLowerCase();
    for (const marker of _UNREADABLE_MARKERS) {
        if (combined.includes(marker.toLowerCase())) {
            return { kind: 'unreadable', reason: marker };
        }
    }
    if (status !== 0) {
        return { kind: 'unreadable', reason: `gh exited ${String(status)}` };
    }
    let state: string;
    let head: string;
    let ref: string;
    try {
        const parsed = JSON.parse(stdout) as {
            state?: unknown;
            headRefOid?: unknown;
            headRefName?: unknown;
        };
        if (
            typeof parsed.state !== 'string' ||
            typeof parsed.headRefOid !== 'string' ||
            typeof parsed.headRefName !== 'string'
        ) {
            return { kind: 'unreadable', reason: 'no state / headRefOid / headRefName in response' };
        }
        state = parsed.state.toUpperCase();
        head = parsed.headRefOid;
        ref = parsed.headRefName;
    } catch {
        return { kind: 'unreadable', reason: 'unparseable JSON' };
    }
    if (state !== 'OPEN') {
        return {
            kind: 'refuse',
            reason:
                `the PR is ${state}, not OPEN. Its rollup describes head ${head.slice(0, 9)} as of ` +
                'that transition; pushes after it create no checks, so a green here would be about ' +
                'a head that no longer decides anything',
        };
    }
    if (tip.kind === 'unreadable') {
        return { kind: 'unreadable', reason: `branch tip: ${tip.reason}` };
    }
    if (tip.kind === 'absent') {
        // A fork PR's ref is not under this origin. Say the check did not apply
        // rather than pretending it passed.
        return { kind: 'open', head, ref, divergenceChecked: false };
    }
    if (tip.sha !== head) {
        return {
            kind: 'refuse',
            reason:
                `the PR record is at head ${head.slice(0, 9)} but origin/${ref} is at ` +
                `${tip.sha.slice(0, 9)}. Merging in this state lands the PR WITHOUT the newer ` +
                'commits (recorded on PR #710), and any verdict here is about the wrong head',
        };
    }
    return { kind: 'open', head, ref, divergenceChecked: true };
}

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

/**
 * Read the branch tip from the remote, not from a local ref.
 *
 * A local `origin/<ref>` is only as fresh as the last fetch, and the divergence
 * this guards against is created by somebody else's push — so a stale local ref
 * would report agreement exactly when it matters most.
 */
function readTip(ref: string): RemoteTip {
    const r = spawnSync('git', ['ls-remote', 'origin', `refs/heads/${ref}`], {
        encoding: 'utf-8',
        timeout: 60_000,
    });
    if (r.status !== 0) {
        const why = (r.stderr ?? '').trim().split('\n')[0] ?? `git exited ${String(r.status)}`;
        return { kind: 'unreadable', reason: why };
    }
    const line = (r.stdout ?? '').trim();
    if (line === '') return { kind: 'absent' };
    const sha = line.split(/\s+/)[0] ?? '';
    return sha === '' ? { kind: 'unreadable', reason: 'empty sha in ls-remote output' } : { kind: 'found', sha };
}

function readTarget(pr: string): TargetState {
    const r = spawnSync('gh', ['pr', 'view', pr, '--json', 'state,headRefOid,headRefName'], {
        encoding: 'utf-8',
        timeout: 60_000,
    });
    // The ref name comes from the same read, so the tip lookup needs it first;
    // classifyTarget is called twice rather than plumbing a callback through a
    // pure function.
    const shape = classifyTarget(r.stdout ?? '', r.stderr ?? '', r.status, { kind: 'absent' });
    if (shape.kind !== 'open') return shape;
    return classifyTarget(r.stdout ?? '', r.stderr ?? '', r.status, readTip(shape.ref));
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

    // Up front, because waiting nine minutes to learn the PR was merged before
    // the wait began is the expensive way to find out.
    const before = readTarget(pr);
    if (before.kind === 'refuse') {
        process.stdout.write(`ci_settle: REFUSING TO WAIT — ${before.reason}. No verdict is claimed.\n`);
        return 2;
    }
    if (before.kind === 'unreadable') {
        process.stdout.write(
            `ci_settle: could not read the PR's target state (${before.reason}) — NOT a verdict, waiting anyway; ` +
                'the pre-verdict re-check below still applies.\n',
        );
    } else if (!before.divergenceChecked) {
        process.stdout.write(
            `ci_settle: origin carries no refs/heads/${before.ref} (a fork PR) — the head-divergence check does not apply here.\n`,
        );
    }

    const deadline = Date.now() + timeoutMin * 60_000;
    let unreadableStreak = 0;

    for (;;) {
        const state = poll(pr);
        if (state.kind === 'settled') {
            // The rollup is about the record's head. Re-read that head at
            // VERDICT time, not only at start: a push or a merge during the
            // wait makes the rollup describe something the caller is not about
            // to act on, and this is the last moment a wrong verdict is still
            // preventable.
            const at = readTarget(pr);
            if (at.kind === 'refuse') {
                process.stdout.write(
                    `ci_settle: WITHHOLDING A VERDICT — ${at.reason}. The checks that settled are not about ` +
                        'the head that matters now.\n',
                );
                return 2;
            }
            if (at.kind === 'unreadable') {
                process.stdout.write(
                    `ci_settle: WITHHOLDING A VERDICT — could not confirm the target head (${at.reason}). ` +
                        'A verdict needs to name the head it is about.\n',
                );
                return 2;
            }
            if (state.failing.length === 0) {
                process.stdout.write(
                    `ci_settle: SETTLED GREEN — ${String(state.total)} check(s) on ${at.head.slice(0, 9)}\n`,
                );
                return 0;
            }
            process.stdout.write(
                `ci_settle: SETTLED RED — ${String(state.failing.length)} of ${String(state.total)} failing on ${at.head.slice(0, 9)}:\n` +
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
