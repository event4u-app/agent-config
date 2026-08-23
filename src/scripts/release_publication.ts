/**
 * Publication orchestration extracted from `release.ts`.
 *
 * Step 1.1 of `road-to-release-publication-integrity`. The first refused
 * implementation attempt died on `check_source_size_budget`: `release.ts` is
 * 2,818 lines against a 1,500-line ceiling, so ANY net growth in it is refused —
 * including a four-line version of the guard. This is the unit that makes room.
 *
 * The unit is chosen by dependency shape rather than by tidiness: the process and
 * `gh` primitives plus everything that reaches GitHub — `die`, `run`, `git`,
 * `gh`, the check-watch loop, the branch/tag/PR/release existence probes, the
 * pushes and the merge. Taking the orchestration WITHOUT the primitives would
 * make `release.ts` import them back and close a cycle.
 *
 * `release.ts` re-exports every public name that moved, so no caller and no test
 * import path changes.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import process from 'node:process';

import { gh_argv_label, gh_retry } from './_lib/gh_transient.js';
import {
    extract_changelog_section,
    pr_body_from_section,
} from './_lib/release_material.js';

import {
    CHANGELOG,
    CalledProcessError,
    GH_PR_BODY_LIMIT,
    MAIN_BRANCH,
    REMOTE,
    REPO_ROOT,
    SystemExitError,
    _cap_body,
} from './release_env.js';

function die(msg: string, code = 2): never {
    process.stderr.write(`error: ${msg}\n`);
    throw new SystemExitError(code);
}

export interface RunResult {
    returncode: number;
    stdout: string;
    stderr: string;
}

/**
 * Thin subprocess wrapper with sane defaults.
 *
 * When `check` and `capture` are both True and the command fails, Python's
 * default behaviour swallows stderr — callers only see a CalledProcessError
 * with no hint of what went wrong. We catch that path and die with the actual
 * stderr so release preflight failures are diagnosable without re-running with
 * a debugger.
 */
/**
 * Drill/test seam — when set, every external command run() would spawn is
 * answered by this function instead. The check/die/CalledProcessError
 * semantics of run() still apply to the simulated result, so the drill
 * exercises the REAL error paths of the orchestration (release_drill.ts).
 */
type ExecOverride = (args: readonly string[]) => {
    status: number;
    stdout: string;
    stderr: string;
};
let _exec_override: ExecOverride | null = null;
function _set_exec_override(fn: ExecOverride | null): void {
    _exec_override = fn;
}

function run(
    args: readonly string[],
    opts: { check?: boolean; capture?: boolean; cwd?: string | null } = {},
): RunResult {
    const check = opts.check ?? true;
    const capture = opts.capture ?? false;
    const cwd = opts.cwd ?? REPO_ROOT;

    const [cmd, ...rest] = args;
    const res = _exec_override
        ? { ..._exec_override(args), error: undefined as Error | undefined }
        : spawnSync(cmd as string, rest, {
              cwd,
              encoding: 'utf-8',
              // capture_output=True → pipe; else inherit so child writes straight to
              // this process's stdout/stderr (text mode, matching subprocess text=True).
              stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
          });

    if (res.error) {
        // FileNotFoundError analogue (ENOENT) and other spawn failures — Python
        // would raise here; only the explicit catchers (have / _count_tests_current)
        // handle it. Surface as a thrown error.
        throw res.error;
    }

    const returncode = res.status ?? 0;
    const stdout = capture ? res.stdout ?? '' : '';
    const stderr = capture ? res.stderr ?? '' : '';

    if (check && returncode !== 0) {
        if (capture) {
            const cmdStr = args.join(' ');
            const out = (stderr || stdout || '').trim();
            die(`command failed (${returncode}): ${cmdStr}\n${out}`);
        }
        // check && !capture → Python re-raises CalledProcessError; replicate.
        throw new CalledProcessError(returncode, args);
    }

    return { returncode, stdout, stderr };
}

function git(args: readonly string[], opts: { capture?: boolean } = {}): string {
    const capture = opts.capture ?? false;
    const r = run(['git', ...args], { capture });
    return capture ? r.stdout.trim() : '';
}

function _sleep_ms(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * `gh` with transient-failure retry and a readable death. Always captures, so
 * the classifier can see stderr; `check: false` keeps the caller's fallback.
 */
function gh(args: readonly string[], opts: { check?: boolean } = {}): RunResult {
    const check = opts.check ?? true;
    const r = gh_retry(args, (argv) => run(argv, { check: false, capture: true }), {
        sleep: (ms) => (_exec_override ? undefined : _sleep_ms(ms)),
        notify: (m) => process.stdout.write(`${m}\n`),
    });
    if (check && r.returncode !== 0) {
        die(`${gh_argv_label(args)} failed (${r.returncode}):\n${(r.stderr || r.stdout).trim()}`);
    }
    // Mutating calls used to inherit stdio — echo, or the PR / release URL
    // vanishes. Probes (`check: false`) stay quiet; their stdout is JSON.
    if (check && r.stdout.trim()) {
        process.stdout.write(`${r.stdout.trim()}\n`);
    }
    return r;
}

/**
 * One name per failing check, from `gh pr checks --json name,bucket` output.
 *
 * Pure over the JSON text so the shape is testable without gh. Returns []
 * when the payload is unparseable or nothing sits in the `fail` bucket —
 * the caller then falls back to the raw watch output alone.
 */
export function _failed_check_names(jsonText: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const names: string[] = [];
    for (const entry of parsed) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        if (e['bucket'] === 'fail' && typeof e['name'] === 'string') {
            names.push(e['name']);
        }
    }
    return names;
}

/**
 * Remediation lines for a set of failing check names.
 *
 * The watch table scrolls failures out of view on a busy PR, so the operator
 * repeatedly saw only `pass`/`skipping` rows plus "PR checks failed" — the
 * 9.14.0 failure mode, twice. Name the red checks explicitly and, for the
 * shape detector, say where the fix belongs (main, never the release branch).
 */
export function _failed_checks_report(names: readonly string[]): string {
    if (names.length === 0) {
        return '';
    }
    const lines: string[] = ['', 'Failing check(s):'];
    for (const name of names) {
        lines.push(`  ❌ ${name}`);
    }
    if (names.includes('Release-PR shape detector')) {
        lines.push(
            '',
            'Release-PR shape: a release PR may only contain the version-bump',
            'allowlist. Land the out-of-shape files on main via their own PR, then',
            'merge main into the release branch — their release-PR diff becomes',
            'empty (docs/contracts/release-pr-gating.md § Mid-release fixes).',
        );
    }
    if (names.includes('PR body equals CHANGELOG entry')) {
        lines.push(
            '',
            'Surface equality: the PR body drifted from the CHANGELOG entry. A',
            'resume run refreshes it from the branch head (release-truth Phase 1);',
            'never hand-edit the PR body away from the changelog section.',
        );
    }
    if (names.includes('Curated highlights plausible against the span')) {
        lines.push(
            '',
            'Highlights: a curated `_none_` field contradicts the release span.',
            'Fill the curated head in CHANGELOG.md on the release branch — the',
            'gate output lists the deriving commits (release-truth Phase 2).',
        );
    }
    if (names.includes('Blocking review findings dispositioned')) {
        lines.push(
            '',
            'Dispositions: a blocking/high self-review finding has no committed',
            'disposition. Ingest + adjudicate it in',
            'agents/evidence/release-findings/<version>.json (release-truth Phase 3):',
            '  ./scripts-run src/scripts/check_finding_dispositions --ingest <findings.json>',
        );
    }
    lines.push('', 'After fixing, resume with: task release -- --resume --yes', '');
    return lines.join('\n');
}

/** Rounds of re-watching before an absent required check is called absent. */
const _NO_CHECKS_ROUNDS = 10;
/** Delay between those rounds — 10 × 60 s ≈ 10 minutes of tolerance. */
const _NO_CHECKS_DELAY_MS = 60_000;

/**
 * Required status-check contexts for a branch, parsed from
 * `gh api repos/{owner}/{repo}/rules/branches/{branch}`.
 *
 * That endpoint is the one that answers the question here: this repo protects
 * `main` with a RULESET, and the classic `/branches/main/protection` API
 * answers "Branch not protected" for it — so a check built on the classic
 * endpoint would conclude "no required checks" and wave everything through.
 *
 * Any parse or shape surprise yields [] — the caller then behaves exactly as
 * it did before this function existed.
 */
export function _required_contexts_from_rules(json: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const rule of parsed) {
        const r = rule as { type?: unknown; parameters?: { required_status_checks?: unknown } };
        if (r.type !== 'required_status_checks') continue;
        const checks = r.parameters?.required_status_checks;
        if (!Array.isArray(checks)) continue;
        for (const c of checks) {
            const ctx = (c as { context?: unknown }).context;
            if (typeof ctx === 'string' && ctx !== '') out.push(ctx);
        }
    }
    return out;
}

export type NoChecksAction = 'retry' | 'accept' | 'die';

/**
 * What to do when `gh pr checks` reports no checks at all.
 *
 * The old code had one answer — accept — for two situations it could not tell
 * apart: a repo that configures no required checks (nothing will ever arrive,
 * accepting is correct) and a repo whose checks have simply not been
 * dispatched yet (accepting merges, tags and publishes unvalidated).
 *
 * The branch's own protection rules separate them. Required contexts declared
 * ⇒ something IS expected, so absence means not-yet, and the answer is to wait
 * and finally to refuse. None declared ⇒ the pre-existing tolerance stands.
 */
export function _no_checks_action(
    required: readonly string[],
    round: number,
    maxRounds: number = _NO_CHECKS_ROUNDS,
): NoChecksAction {
    if (required.length === 0) return 'accept';
    return round < maxRounds ? 'retry' : 'die';
}

/**
 * Watch PR checks and tolerate the 'no checks' case ONLY where it is tolerable.
 *
 * `gh pr checks --watch` exits 1 both on real failures and when no checks are
 * reported at all. Real failures still die.
 *
 * Measured 2026-08-06/07: during a critical GitHub Actions incident
 * (15:22–02:04 UTC, webhook triggers throttled from 20:34) `pull_request`
 * events were delivered 15–30 minutes late. The five-second grace period below
 * expires long before that, so the old unconditional accept would have tagged
 * `main` and published to npm without a single check having run. It did not
 * only because `main` happened to be independently green.
 *
 * So the tolerance is now conditional on the branch declaring no required
 * checks. Where it declares some, absence is treated as latency: re-watch, and
 * refuse rather than release blind.
 *
 * A short grace period gives GitHub time to register workflow runs on a
 * freshly-pushed branch.
 */
function watch_pr_checks(branch: string): void {
    if (_exec_override === null) {
        // time.sleep(5) — blocking grace period for GitHub to register runs
        // on a freshly-pushed branch. Skipped under the drill seam: there is
        // no GitHub to wait for, and 5s per simulated wait adds up.
        const until = Date.now() + 5000;
        while (Date.now() < until) {
            // busy-wait stand-in for time.sleep(5) without an event-loop yield.
        }
    }
    // Rounds exist only for the no-checks-yet case below; every other outcome
    // returns or dies on the first pass, exactly as before.
    for (let round = 0; ; round++) {
        // The branch is passed explicitly — `gh` inferring the PR from HEAD
        // resolved to `main` mid-run once (2026-08-03, 9.16.0 resume) and the
        // whole release died on "no pull requests found for branch main".
        const proc = run(['gh', 'pr', 'checks', branch, '--watch'], {
            check: false,
            capture: true,
        });
        const output = ((proc.stdout || '') + (proc.stderr || '')).trim();
        const returncode = proc.returncode;
        if (returncode === 0) {
            if (output) {
                process.stdout.write(output + '\n');
            }
            return;
        }
        if (output.toLowerCase().includes('no checks reported')) {
            const rules = run(
                ['gh', 'api', `repos/{owner}/{repo}/rules/branches/${MAIN_BRANCH}`],
                { check: false, capture: true },
            );
            const required = _required_contexts_from_rules(rules.stdout ?? '');
            const action = _no_checks_action(required, round, _NO_CHECKS_ROUNDS);

            if (action === 'accept') {
                process.stdout.write(`⚠️  ${output}\n`);
                process.stdout.write(
                    '   Continuing without check validation — configure required ' +
                        'checks in branch protection to enforce this gate.\n',
                );
                return;
            }
            if (action === 'retry') {
                process.stdout.write(
                    `⏳  no checks reported yet, but ${MAIN_BRANCH} requires ` +
                        `${String(required.length)} (${required.join(', ')}) — ` +
                        `waiting (${String(round + 1)}/${String(_NO_CHECKS_ROUNDS)})\n`,
                );
                if (_exec_override === null) {
                    const until = Date.now() + _NO_CHECKS_DELAY_MS;
                    while (Date.now() < until) {
                        // blocking wait, same shape as the grace period above
                    }
                }
                continue;
            }
            die(
                `no checks reported for ${branch} after ` +
                    `${String(_NO_CHECKS_ROUNDS)} rounds, but ${MAIN_BRANCH} requires ` +
                    `${required.join(', ')}. Refusing to merge, tag and publish ` +
                    'unvalidated — GitHub may be delaying event delivery (check ' +
                    'githubstatus.com). Re-run with `task release -- --resume --yes` ' +
                    'once the checks appear.',
            );
        }
        if (output) {
            process.stderr.write(output + '\n');
        }
        const summary = run(['gh', 'pr', 'checks', branch, '--json', 'name,bucket'], {
            check: false,
            capture: true,
        });
        const report = _failed_checks_report(_failed_check_names(summary.stdout ?? ''));
        if (report) {
            process.stderr.write(report + '\n');
        }
        die(`PR checks failed (exit ${returncode})`);
    }
}

/**
 * Push the release branch, integrating a remote that moved under us.
 *
 * A GitHub-side "Update branch" click (or a concurrent resume run) advances
 * `origin/<branch>` while the local ref stays behind; a bare `git push` is
 * then rejected with "fetch first" and the whole release run dies (measured
 * 2026-08-03, 9.15.0). Same-branch commits are never ours to drop, so the
 * recovery is merge-and-retry, never force-push.
 */
/**
 * True when git rejected the push because the remote ref moved ahead — the
 * ONLY failure the merge-and-retry recovery below can repair.
 *
 * git's wording for this is stable across versions: the hint is `fetch first`
 * / `Updates were rejected`, and the ref line carries `[rejected]` with
 * `non-fast-forward` or `fetch first`. A stale lease is a SECOND wording —
 * `[remote rejected]` + `cannot lock ref … but expected`; pinned in the tests.
 */
export function _is_non_fast_forward(stderr: string, stdout: string): boolean {
    const text = `${stderr}\n${stdout}`;
    if (!/\[(?:remote )?rejected\]/i.test(text)) return false;
    if (/cannot lock ref[^\n]*but expected/i.test(text)) return true;
    return /(non-fast-forward|fetch first|behind its remote counterpart)/i.test(text);
}

function push_release_branch(branch: string): void {
    const first = run(['git', 'push', '-u', REMOTE, branch], { check: false, capture: true });
    if (first.returncode === 0) {
        process.stdout.write(first.stdout);
        process.stderr.write(first.stderr);
        return;
    }

    // A push can fail for many reasons — a pre-push hook refusing the commit,
    // no credentials, a protected branch. Only ONE of them is repaired by
    // fetch+merge+retry, and the recovery's first step (`git fetch <branch>`)
    // exits 128 for a branch that was never pushed. Taking that path
    // unconditionally replaced every real error with
    // `couldn't find remote ref <branch>` — measured 2026-08-06 on 9.26.0,
    // where a pre-push gate rejection surfaced as a git-fetch crash and cost
    // an hour of diagnosis pointed at the wrong layer.
    if (!_is_non_fast_forward(first.stderr, first.stdout)) {
        process.stdout.write(first.stdout);
        process.stderr.write(first.stderr);
        die(
            `push of ${branch} failed (exit ${first.returncode}) and the remote ref did not move — ` +
                'this is not the fetch-and-retry case. The push output above is the real error ' +
                '(a pre-push gate, credentials, or branch protection); fix that and re-run.',
        );
    }

    process.stdout.write(`↻  ${REMOTE}/${branch} moved — integrating and retrying push\n`);
    run(['git', 'fetch', REMOTE, branch]);
    run(['git', 'merge', '--no-edit', `${REMOTE}/${branch}`]);
    run(['git', 'push', '-u', REMOTE, branch]);
}

/** mergeStateStatus of the branch's PR ('' when the probe fails). */
function _pr_merge_state(branch: string): string {
    const r = gh(['pr', 'view', branch, '--json', 'mergeStateStatus', '--jq', '.mergeStateStatus'], {
        check: false,
    });
    return r.returncode === 0 ? r.stdout.trim() : '';
}

/**
 * Bound on update-and-retry rounds in merge_release_pr. Three is deliberate:
 * main receiving unrelated merges three times inside one checks-wait window
 * means the queue is hot and a human should decide, not a loop.
 */
const _MERGE_UPDATE_ROUNDS = 3;

/**
 * Merge the release PR, absorbing a moving base branch.
 *
 * Branch protection requires the head to be up to date with `main`, and
 * `main` moves constantly (dependabot, unrelated merges) — so between the
 * checks-wait and the merge the PR routinely flips to BEHIND and a bare
 * `gh pr merge` dies with "the head branch is not up to date with the base
 * branch" (measured 2026-08-03, 9.16.0). Recovery is mechanical and safe by
 * construction: merging `origin/main` into `release/X.Y.Z` makes the fix
 * files identical on both sides, so the release-PR diff stays inside the
 * version-bump allowlist (docs/contracts/release-pr-gating.md § Mid-release
 * fixes) — do it here instead of aborting the run.
 */
/**
 * Re-derive the release-PR body from the CHANGELOG section at the current
 * release-branch head and push it to the PR (release-truth Phase 1: one
 * final source — late commits and maintainer edits on the branch must reach
 * the PR body instead of leaving it frozen at plan time). Best-effort sync
 * of the local branch first; a no-op when the derived body is unchanged.
 */
function _target_from_branch(branch: string): string {
    return branch.replace(/^release\//u, '');
}

function _refresh_pr_body_from_head(branch: string, target: string): void {
    run(['git', 'pull', '--ff-only', REMOTE, branch], { check: false });
    const changelog = fs.readFileSync(CHANGELOG, 'utf-8');
    const section = extract_changelog_section(changelog, target);
    if (!section) {
        die(`CHANGELOG.md at ${branch} head carries no section for ${target} — cannot derive PR body`);
    }
    const capped = _cap_body(section!.body, GH_PR_BODY_LIMIT - 200, '`CHANGELOG.md` in this PR');
    const body = pr_body_from_section(capped, target);
    const live = gh(['pr', 'view', branch, '--json', 'body', '-q', '.body'], { check: false });
    if (live.returncode === 0 && live.stdout.replace(/\r\n/gu, '\n').trim() === body.trim()) {
        return;
    }
    gh(['pr', 'edit', branch, '--body', body]);
}

function merge_release_pr(branch: string, wait_for_checks: boolean): void {
    if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== branch) {
        run(['git', 'checkout', branch]);
    }
    for (let round = 0; round <= _MERGE_UPDATE_ROUNDS; round++) {
        // One final generation step at the final head: every merge attempt
        // first re-derives the PR body from the branch-head CHANGELOG, so
        // update rounds and maintainer edits can never desynchronize it.
        _refresh_pr_body_from_head(branch, _target_from_branch(branch));
        if (_pr_merge_state(branch) !== 'BEHIND') {
            const merged = run(['gh', 'pr', 'merge', branch, '--merge', '--delete-branch'], {
                check: false,
            });
            if (merged.returncode === 0) {
                return;
            }
            if (_pr_merge_state(branch) !== 'BEHIND') {
                // Not the moving-base failure — surface it unchanged.
                throw new CalledProcessError(merged.returncode, [
                    'gh',
                    'pr',
                    'merge',
                    branch,
                    '--merge',
                    '--delete-branch',
                ]);
            }
            // BEHIND appeared between the probe and the merge — fall through
            // to the update below.
        }
        if (round === _MERGE_UPDATE_ROUNDS) {
            break;
        }
        process.stdout.write(
            `↻  head behind ${MAIN_BRANCH} (update round ${round + 1}/${_MERGE_UPDATE_ROUNDS}) — ` +
                `merging ${REMOTE}/${MAIN_BRANCH} into ${branch} and re-running checks\n`,
        );
        run(['git', 'fetch', REMOTE, MAIN_BRANCH]);
        run(['git', 'merge', '--no-edit', `${REMOTE}/${MAIN_BRANCH}`]);
        push_release_branch(branch);
        if (wait_for_checks) {
            watch_pr_checks(branch);
        }
    }
    die(
        `release PR is still behind ${MAIN_BRANCH} after ${_MERGE_UPDATE_ROUNDS} update round(s) — ` +
            `${MAIN_BRANCH} is moving faster than the checks complete. ` +
            'Re-run when the queue quiets down: task release -- --resume --yes',
    );
}

function have(bin: string): boolean {
    const res = spawnSync('which', [bin], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (res.error) {
        // FileNotFoundError on `which` itself → treat as not found (returncode != 0).
        return false;
    }
    return (res.status ?? 1) === 0;
}

// ─── resume-mode state probes ────────────────────────────────────────────────

function _branch_exists_local(branch: string): boolean {
    const r = run(['git', 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

function _branch_exists_remote(branch: string): boolean {
    const r = run(['git', 'ls-remote', '--exit-code', '--heads', REMOTE, branch], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

function _tag_exists_local(tag: string): boolean {
    return git(['tag', '-l', tag], { capture: true }).split('\n').includes(tag);
}

function _tag_exists_remote(tag: string): boolean {
    const r = run(['git', 'ls-remote', '--exit-code', '--tags', REMOTE, tag], {
        check: false,
        capture: true,
    });
    return r.returncode === 0;
}

/**
 * True when git rejected a tag push because the ref already exists on the
 * remote. Wording pinned from the real failure (2026-08-09, 9.28.0 — two
 * concurrent resume runs, the loser crashed):
 *
 *     ! [remote rejected]  9.28.0 -> 9.28.0 (cannot lock ref 'refs/tags/9.28.0': reference already exists)
 *
 * plus the `[rejected] … (already exists)` variant git emits when the local
 * and remote tag objects differ.
 */
export function _is_tag_already_exists(stderr: string, stdout: string): boolean {
    const text = `${stderr}\n${stdout}`;
    return /\[(?:remote )?rejected\]/i.test(text) && /already exists/i.test(text);
}

/** Peeled commit the remote tag points at, or null when the tag is absent. */
function _remote_tag_commit(tag: string): string | null {
    const r = run(['git', 'ls-remote', REMOTE, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
        check: false,
        capture: true,
    });
    if (r.returncode !== 0) return null;
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    // An annotated tag lists the tag object AND the peeled `^{}` commit — the
    // peeled line wins so the comparison is commit-vs-commit regardless of
    // whether the two runs minted distinct tag objects for the same commit.
    const peeled = lines.find((l) => l.trimEnd().endsWith('^{}'));
    return (peeled ?? (lines[0] as string)).split('\t')[0] ?? null;
}

/**
 * Push a tag, tolerating exactly ONE failure: the concurrent-release race.
 * `_tag_exists_remote` in step 8 is a live check, but between it and this
 * push a parallel `task release` run can land the same tag (measured
 * 2026-08-09, 9.28.0). When the remote tag already points at the same commit
 * as the local one, the repository IS in the desired state — continue. Any
 * other rejection, and a same-name tag on a DIFFERENT commit, stays fatal
 * with the push output as the error.
 */
function _push_tag(tag: string): void {
    const first = run(['git', 'push', REMOTE, tag], { check: false, capture: true });
    if (first.returncode === 0) {
        process.stdout.write(first.stdout);
        process.stderr.write(first.stderr);
        return;
    }
    if (_is_tag_already_exists(first.stderr, first.stdout)) {
        const remote = _remote_tag_commit(tag);
        const local = git(['rev-list', '-n', '1', tag], { capture: true });
        if (remote !== null && remote === local) {
            process.stdout.write(
                `↻  tag ${tag} already on ${REMOTE} at the same commit — a parallel run pushed it; continuing\n`,
            );
            return;
        }
        process.stdout.write(first.stdout);
        process.stderr.write(first.stderr);
        die(
            `tag ${tag} exists on ${REMOTE} pointing at ${remote ?? '<unreadable>'} while the local tag ` +
                `points at ${local} — refusing to overwrite a published tag; ` +
                'delete the wrong one deliberately and re-run',
        );
    }
    process.stdout.write(first.stdout);
    process.stderr.write(first.stderr);
    die(
        `push of tag ${tag} failed (exit ${first.returncode}) — ` +
            'the push output above is the real error (a pre-push gate, credentials, or protection)',
    );
}

/** Most recent PR (any state) with `release/X.Y.Z` as head, or null. */
function _pr_for_branch(branch: string): Record<string, unknown> | null {
    const argv = ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,url'];
    const r = gh([...argv, '--limit', '1'], { check: false });
    if (r.returncode !== 0) {
        return null;
    }
    let items: unknown;
    try {
        items = JSON.parse(r.stdout || '[]');
    } catch {
        return null;
    }
    return Array.isArray(items) && items.length > 0 ? (items[0] as Record<string, unknown>) : null;
}

function _release_exists(tag: string): boolean {
    const r = run(['gh', 'release', 'view', tag], { check: false, capture: true });
    return r.returncode === 0;
}


// ─── re-export surface ────────────────────────────────────────────────────────
// Named individually rather than by marking each declaration `export`, so the
// boundary this module presents is one readable list rather than a property of
// 30 scattered keywords.
export {
    _MERGE_UPDATE_ROUNDS,
    _branch_exists_local,
    _branch_exists_remote,
    _pr_for_branch,
    _pr_merge_state,
    _push_tag,
    _refresh_pr_body_from_head,
    _release_exists,
    _remote_tag_commit,
    _set_exec_override,
    _sleep_ms,
    _tag_exists_local,
    _tag_exists_remote,
    _target_from_branch,
    die,
    gh,
    git,
    have,
    merge_release_pr,
    push_release_branch,
    run,
    watch_pr_checks,
};
