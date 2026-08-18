#!/usr/bin/env tsx
/**
 * Is the open PR's CI verdict about the code that is actually on the branch?
 *
 * "Fix the CI" names a remote state, and three different things can make a
 * locally-verified fix look delivered when it is not. All three were measured on
 * one run (2026-08-17, PR #1391) and none of them is visible from a green local
 * gate:
 *
 *   1. **Unpushed work.** The fix is committed locally, the PR still carries the
 *      failure. A pre-push hook refusing is enough to produce this silently.
 *   2. **Stale green.** `gh pr checks` reports the last run it has, which may
 *      have run against the pre-fix commit. Reading that green as a verdict on
 *      the current head is the sharpest of the three, because the output says
 *      SUCCESS.
 *   3. **A foreign head.** Someone pressed *Update branch* on the PR, so the
 *      branch is behind its OWN remote counterpart and the PR head is a commit
 *      this session never saw.
 *
 * Prose cannot enforce any of that — hence a gate. It answers one question:
 * does a settled, successful check set exist whose head SHA is the PR head, and
 * is that PR head what the local branch says it is?
 *
 * NOT a merge-readiness check and deliberately not a base-freshness check —
 * `check_branch_freshness` owns "is the branch behind its base" and duplicating
 * it here would mean two gates owning one verdict.
 *
 * Degrades rather than blocks on anything it cannot observe: no `gh`, no auth,
 * an unresponsive endpoint, or no open PR all exit 0 with the reason named. A
 * gate that blocks a push because the network is down is a gate that gets
 * switched off. What it BLOCKS is the case where the remote answered and the
 * answer is "your fix is not in this PR" or "this green is not about your code".
 *
 * Exit codes (contract §6): 0 = current, or unobservable-and-said-so ·
 * 1 = the remote answered and the verdict is not about the branch head ·
 * 2 = internal error. `scanned:` is emitted on EVERY exit path.
 *
 * ## The per-target ledger, and the exemption that was withdrawn
 *
 * This gate first shipped with a `// ledger-exempt:` marker arguing it had "no
 * target population to account for — a short-circuiting chain of 0-3 remote
 * facts". Its completion review refuted that from the file itself: the check
 * rows ARE a population, and the parse below **drops** every row whose `state`
 * is not a string. A dropped row could be the failing one, so the gate could
 * print *"green on its own head"* over a check it never read — the precise
 * "absence of scanning looks like absence of findings" shape the ledger exists
 * to count.
 *
 * The exemption's secondary claim was accurate — every `main()` exit already
 * self-reports through `scanReport` with an explicit `allowEmpty` reason — and
 * that is exactly why the first argument was easy to believe. It was still
 * resting on the false half.
 */

import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';

const NETWORK_TIMEOUT_MS = 8_000;

/**
 * Emit the count through the shared helper, so the published number is by
 * construction the one the scope assertion just accepted.
 *
 * `allowEmpty` is the load-bearing parameter, and it is also why this gate does
 * NOT carry a `min_scanned` floor in `src/config/gate-coverage.yml`. The number
 * of facts compared here is 0–3 depending on remote state, and zero is a
 * legitimate pass on two paths (no open PR, nothing observable). A floor cannot
 * express that, and the manifest's own header says padding it to raise a
 * coverage figure is the opposite of gaming. Same reasoning, same shape, as the
 * sibling network probe `check_branch_freshness` — which is likewise unregistered
 * for exactly this reason. "There was nothing to check" and "I checked and it was
 * fine" must not print the same thing, which `allowEmpty` is what enforces.
 */
function scanReport(scanned: number, allowEmpty?: string): void {
    reportScanned({
        gate: 'check_pr_ci_current',
        scanned,
        units: 'remote fact(s) compared',
        roots: ['origin'],
        ...(allowEmpty === undefined ? {} : { allowEmpty }),
    });
}

export interface Probe {
    ok: boolean;
    stdout: string;
    reason?: string;
}

function run(cmd: string, args: readonly string[], cwd: string): Probe {
    // Bounds `git` as well as `gh`: the sibling gate records that an unresponsive
    // SSH remote reached through an UNTIMED git call is how a stated worst case
    // stops being one.
    const res = spawnSync(cmd, [...args], {
        cwd,
        encoding: 'utf-8',
        timeout: NETWORK_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
    });
    if (res.error !== undefined || res.status === null) {
        return { ok: false, stdout: '', reason: `${cmd} did not answer within ${String(NETWORK_TIMEOUT_MS / 1000)}s` };
    }
    if (res.status !== 0) {
        return { ok: false, stdout: res.stdout ?? '', reason: (res.stderr ?? '').trim().split('\n')[0] ?? 'non-zero exit' };
    }
    return { ok: true, stdout: res.stdout ?? '' };
}

export interface CheckRow {
    state: string;
    name: string;
}

export interface Verdict {
    /** 0 = current or unobservable · 1 = the remote answered and it is stale. */
    exit: 0 | 1;
    /** One line, always printed — the reason is the whole product of this gate. */
    message: string;
    /** How many facts the gate actually compared. */
    scanned: number;
}

export interface Facts {
    /** null when there is no open PR for this branch — nothing to verify. */
    pr: number | null;
    /** The PR head SHA the FORGE reports. */
    prHead: string | null;
    /** Local branch tip. */
    localHead: string | null;
    /** The head SHA the reported checks ran against. */
    checksHead: string | null;
    rows: readonly CheckRow[];
    /**
     * Names of check rows the parse DROPPED because their `state` was not a
     * string. Carried out rather than swallowed: a dropped row could be the
     * failing one, so it is a skip the ledger must count, not a non-event.
     */
    droppedRows?: readonly string[];
    /** Set when something could not be observed; forces the degrade path. */
    unobservable: string | null;
    /**
     * How the local tip relates to the PR head — ancestry, not equality, because
     * the two disagreements mean opposite things.
     *
     * `ahead`  local is a descendant: normal state before a push, and the
     *          "fix never pushed" defect after one.
     * `behind` local is an ancestor: the PR head is a commit this session never
     *          made — someone pressed Update branch. NEVER ok, in either mode:
     *          a push would be rejected, and forcing over it is what
     *          git-history-discipline gates.
     * `diverged` neither contains the other. Never ok either.
     */
    relation: 'equal' | 'ahead' | 'behind' | 'diverged' | 'unknown';
}

export interface DecideOptions {
    /**
     * True when the gate runs BEFORE a push (the pre-push chain).
     *
     * Load-bearing, and the reason this flag exists at all: before a push, local
     * being ahead of the PR head is the normal state of every branch with work on
     * it. A gate that treated it as a defect would refuse every push there is —
     * which is the chicken-and-egg this flag resolves rather than papers over.
     * `behind` and `diverged` still block in both modes.
     */
    prePush?: boolean;
}

/**
 * Pure decision over already-gathered facts, so the whole verdict table is
 * testable without a network or a forge.
 */
export function decide(f: Facts, opts: DecideOptions = {}): Verdict {
    if (f.unobservable !== null) {
        return { exit: 0, message: `unverified — ${f.unobservable}. Not a pass; nothing was observed.`, scanned: 0 };
    }
    if (f.pr === null) {
        return { exit: 0, message: 'no open PR for this branch — no remote verdict to be current with.', scanned: 0 };
    }
    if (f.relation === 'behind' || f.relation === 'diverged') {
        return {
            exit: 1,
            message:
                `PR #${String(f.pr)} head ${f.prHead?.slice(0, 9) ?? '?'} is not reachable from the local ` +
                `branch (${f.relation}) — the PR carries a commit this checkout does not have, which is what ` +
                'a GitHub *Update branch* press looks like. Merge it in; never force over it.',
            scanned: 2,
        };
    }
    if (f.relation === 'ahead') {
        if (opts.prePush === true) {
            return {
                exit: 0,
                message:
                    `PR #${String(f.pr)} is behind the local branch, which is the normal state before a ` +
                    'push. Re-run after pushing to verify the remote verdict.',
                scanned: 2,
            };
        }
        return {
            exit: 1,
            message:
                `PR #${String(f.pr)} head is ${f.prHead?.slice(0, 9) ?? '?'} but the local branch is at ` +
                `${f.localHead?.slice(0, 9) ?? '?'} — the PR does NOT contain what is committed here. ` +
                'A local green says nothing about a fix that was never pushed.',
            scanned: 2,
        };
    }
    if (f.rows.length === 0) {
        return {
            exit: 1,
            message:
                `PR #${String(f.pr)} reports no checks at all. Absence of a red is not a green — ` +
                'either the run never registered, or the workflow paths do not match this diff.',
            scanned: 2,
        };
    }
    if (f.checksHead !== null && f.prHead !== null && f.checksHead !== f.prHead) {
        return {
            exit: 1,
            message:
                `STALE VERDICT — PR #${String(f.pr)} checks ran against ${f.checksHead.slice(0, 9)}, ` +
                `head is ${f.prHead.slice(0, 9)}. Whatever those checks say, they do not say it about ` +
                'the current code. This is the failure mode that reads as SUCCESS.',
            scanned: 3,
        };
    }
    const unsettled = f.rows.filter((r) => ['PENDING', 'QUEUED', 'IN_PROGRESS'].includes(r.state));
    if (unsettled.length > 0) {
        return {
            exit: 1,
            message:
                `PR #${String(f.pr)} has ${String(unsettled.length)} check(s) still running on ` +
                `${f.prHead?.slice(0, 9) ?? 'head'} — pending is a reason to WAIT, never a verdict.`,
            scanned: f.rows.length,
        };
    }
    const bad = f.rows.filter((r) => !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(r.state));
    if (bad.length > 0) {
        return {
            exit: 1,
            message:
                `PR #${String(f.pr)} is RED on its current head: ` +
                bad.map((r) => `${r.state} ${r.name}`).join(', '),
            scanned: f.rows.length,
        };
    }
    return {
        exit: 0,
        message:
            `PR #${String(f.pr)} is green on its own head ${f.prHead?.slice(0, 9) ?? '?'}, ` +
            'and the local branch matches it.',
        scanned: f.rows.length,
    };
}

/**
 * Whether {@link decide} reached the check rows at all.
 *
 * Every branch above the row logic — unobservable, no open PR, behind/diverged,
 * ahead — settles the verdict WITHOUT reading a single row state. Recording
 * those rows as `complete` would publish `scanned=N` for a run that inspected
 * none of them: the absence-of-scanning-reads-as-absence-of-findings inflation
 * the ledger exists to count, in the gate that adopted it. Under `--pre-push`,
 * `ahead` is the NORMAL state, so this is the common path, not the exotic one.
 */
export function rowsWereEvaluated(f: Facts): boolean {
    if (f.unobservable !== null) return false;
    if (f.pr === null) return false;
    return f.relation !== 'behind' && f.relation !== 'diverged' && f.relation !== 'ahead';
}

/**
 * Publish the row-level accounting for one run.
 *
 * Three populations, three outcomes: rows the parse dropped are skips (a dropped
 * row could be the failing one), rows a row-reading verdict covered are
 * completions, and rows the verdict never reached are out of scope for THIS run.
 *
 * The line is emitted even under `--quiet` — {@link GateLedger.report} writes
 * unconditionally by design, so a `--quiet` run of this gate is one line louder
 * than before. Stated here because it is a change to this gate's own contract.
 */
function reportRowLedger(f: Facts): void {
    const ledger = new GateLedger('check_pr_ci_current');
    const dropped = new Set(f.droppedRows ?? []);
    // Duplicate check names are a normal remote condition — a cancelled re-run
    // beside a live one, two workflows sharing a job name, or a dropped row
    // whose name equals a kept row's. `plan` throws on a repeat, and this gate
    // promises to degrade rather than block, so the plan is deduplicated.
    const planned = [...new Set([...f.rows.map((r) => r.name), ...dropped])];
    ledger.plan(planned);
    const evaluated = rowsWereEvaluated(f);
    for (const name of planned) {
        if (dropped.has(name)) ledger.skip(name, 'not_applicable_kind');
        else if (evaluated) ledger.complete(name);
        else ledger.outOfScope(name, 'precondition_unmet');
    }
    ledger.report();
}

/**
 * Ancestry between the local tip and the PR head.
 *
 * Equality is not enough: "local is ahead" and "local is behind" are opposite
 * situations with opposite correct actions (push vs merge), and an equality test
 * collapses them into one indistinguishable mismatch. A SHA the checkout does not
 * have is `unknown` rather than a guess — the fetch is the caller's business.
 */
export function relate(
    repo: string,
    local: string | null,
    pr: string | null,
): Facts['relation'] {
    if (local === null || pr === null) return 'unknown';
    if (local === pr) return 'equal';
    if (!run('git', ['cat-file', '-e', `${pr}^{commit}`], repo).ok) return 'unknown';
    const prReachable = run('git', ['merge-base', '--is-ancestor', pr, local], repo).ok;
    const localReachable = run('git', ['merge-base', '--is-ancestor', local, pr], repo).ok;
    if (prReachable) return 'ahead';
    if (localReachable) return 'behind';
    return 'diverged';
}

/** Gather the facts `decide` consumes. Every failure becomes `unobservable`. */
export function gather(repo: string): Facts {
    const empty: Facts = {
        pr: null, prHead: null, localHead: null, checksHead: null, rows: [], droppedRows: [], unobservable: null, relation: 'unknown',
    };

    const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo);
    if (!branch.ok) return { ...empty, unobservable: `cannot read the current branch (${branch.reason ?? '?'})` };
    const branchName = branch.stdout.trim();
    if (branchName === 'HEAD' || branchName === '') {
        return { ...empty, unobservable: 'detached HEAD — no branch to resolve a PR for' };
    }

    const local = run('git', ['rev-parse', 'HEAD'], repo);
    if (!local.ok) return { ...empty, unobservable: `cannot read the local head (${local.reason ?? '?'})` };

    const pr = run(
        'gh',
        ['pr', 'list', '--head', branchName, '--state', 'open', '--json', 'number,headRefOid', '--limit', '1'],
        repo,
    );
    if (!pr.ok) return { ...empty, unobservable: `gh could not be reached (${pr.reason ?? '?'})` };
    let parsed: Array<{ number?: number; headRefOid?: string }>;
    try {
        parsed = JSON.parse(pr.stdout || '[]') as Array<{ number?: number; headRefOid?: string }>;
    } catch {
        return { ...empty, unobservable: 'gh returned output this gate could not parse' };
    }
    const first = parsed[0];
    if (first?.number === undefined) {
        return { ...empty, localHead: local.stdout.trim(), unobservable: null };
    }

    const checks = run('gh', ['pr', 'checks', String(first.number), '--json', 'state,name'], repo);
    // `gh pr checks` exits non-zero when any check is failing, so a non-zero exit
    // with parseable stdout is DATA, not an error. Treating it as unobservable
    // would make the gate blind in exactly the red case it exists for.
    let rows: CheckRow[] = [];
    // A row whose `state` is not a string is DROPPED, and that drop is the one
    // thing in this gate worth counting: a dropped row could be the failing one,
    // and without accounting the gate prints "green on its own head" over a
    // check it never read. `dropped` is surfaced by the caller through the
    // ledger rather than swallowed here.
    let dropped: string[] = [];
    if (checks.stdout.trim() !== '') {
        try {
            const parsed = JSON.parse(checks.stdout) as CheckRow[];
            rows = parsed.filter((r) => typeof r.state === 'string');
            dropped = parsed
                .filter((r) => typeof r.state !== 'string')
                .map((r, i) => (typeof r.name === 'string' ? r.name : `row-${String(i)}`));
        } catch {
            rows = [];
        }
    } else if (!checks.ok) {
        return {
            ...empty,
            pr: first.number,
            prHead: first.headRefOid ?? null,
            localHead: local.stdout.trim(),
            unobservable: `gh pr checks gave no readable output (${checks.reason ?? '?'})`,
        };
    }

    // The SHA the checks ran against. `gh pr checks` does not expose it, so it
    // comes from the check runs on the PR head — if the forge reports runs for a
    // different SHA, that is the stale-green case.
    const runsHead = run(
        'gh',
        ['api', `repos/{owner}/{repo}/commits/${first.headRefOid ?? 'HEAD'}/check-runs`, '--jq', '.check_runs[0].head_sha'],
        repo,
    );

    const localSha = local.stdout.trim();
    const prSha = first.headRefOid ?? null;
    return {
        pr: first.number,
        prHead: prSha,
        localHead: localSha,
        checksHead: runsHead.ok && runsHead.stdout.trim() !== '' ? runsHead.stdout.trim() : null,
        rows,
        droppedRows: dropped,
        unobservable: null,
        relation: relate(repo, localSha, prSha),
    };
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let repo = process.cwd();
    let quiet = false;
    let prePush = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--pre-push') {
            prePush = true;
        } else if (a === '--repo') {
            const v = args[++i];
            if (v === undefined || v.startsWith('--')) {
                process.stderr.write('❌  check_pr_ci_current: --repo requires a value\n');
                scanReport(0, 'argument error — nothing was compared');
                return 1;
            }
            repo = v;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_pr_ci_current [--repo PATH] [--pre-push] [--quiet]\n' +
                    '  --pre-push tolerates the PR being behind the local branch, which is\n' +
                    '  the normal state before a push; it still blocks a PR head the local\n' +
                    '  branch cannot reach.\n' +
                    '  Verifies the open PR carries the local commits AND that its check\n' +
                    '  verdict ran against the PR head. Degrades to exit 0 when the remote\n' +
                    '  cannot be observed, naming what is unverified.\n',
            );
            scanReport(0, 'help output — nothing was compared');
            return 0;
        } else {
            process.stderr.write(`❌  check_pr_ci_current: unknown argument \`${a}\`\n`);
            scanReport(0, 'argument error — nothing was compared');
            return 1;
        }
    }

    let verdict: Verdict;
    try {
        const facts = gather(repo);
        // The verdict comes FIRST: whether the rows were inspected at all is a
        // property of the verdict's path, not of the parse (see reportRowLedger).
        verdict = decide(facts, { prePush });
        reportRowLedger(facts);
    } catch (exc) {
        scanReport(0, 'internal error — nothing was compared');
        process.stderr.write(
            `❌  check_pr_ci_current: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    // The degrade path stays LOUD even under --quiet: "unverified" reported
    // silently is indistinguishable from "verified", which is the whole defect.
    if (verdict.exit === 1) {
        process.stdout.write(`❌  ${verdict.message}\n`);
    } else if (verdict.message.startsWith('unverified')) {
        process.stdout.write(`⚠️  check_pr_ci_current: ${verdict.message}\n`);
    } else if (!quiet) {
        process.stdout.write(`✅  ${verdict.message}\n`);
    }
    scanReport(
        verdict.scanned,
        verdict.scanned === 0 ? 'no open PR, or the remote could not be observed — stated above' : undefined,
    );
    return verdict.exit;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}
