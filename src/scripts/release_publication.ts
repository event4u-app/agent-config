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
import {
    DERIVED_MARKER,
    type MixObligation,
    previous_release_tag,
    publication_blockers,
    section_publication_blockers,
} from './_lib/release_highlights.js';
import { loadTaxonomy, measureRange } from './measure_release_mix.js';
import * as fs from 'node:fs';
import process from 'node:process';

import { gh_argv_label, gh_retry } from './_lib/gh_transient.js';
import {
    NEXT_SECTION_RE,
    extract_changelog_section,
    tag_message_from_section,
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
    read_changelog_text,
    reEscape,
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

/**
 * The pre-push local gate run, as an argv the caller hands to `run()`.
 *
 * Every release-PR assertion that can run locally, run BEFORE the branch leaves
 * the machine. `guard_release_branch_push` below covers the changelog-section
 * obligations; this covers the rest of `release-validation.yml` — PR shape,
 * template pin — from `src/config/release-gate-locality.yml`, the registry
 * `tests/scripts/release_gate_locality.test.ts` keeps in step with the
 * workflow. `--cheap` drops the one row that leaves the machine, so a registry
 * outage cannot read as a release defect.
 *
 * An argv rather than a call, so the pipeline issues it through `run()` and
 * `release_drill` intercepts it exactly as it intercepts `task
 * release-prepare`. A real subprocess inside the simulated world would run
 * gates against the live tree.
 *
 * Lives here rather than in `release.ts` for the reason
 * `_refuse_unpublishable` already states: that file is 2000+ lines and every
 * line above 1500 is charged by the source-size growth ratchet.
 */
export function local_release_gate_argv(): string[] {
    return ['task', 'release:verify', '--', '--cheap'];
}

/**
 * Measure the governance-versus-product level for the span under release.
 *
 * The push guard's fourth site reads the SAME obligation the release PR reads,
 * which until 2026-09-05 it did not: `publication_blockers` knew two sentinels
 * and not this one, so the earliest refusal was the pull request. That gap was
 * documented in `docs/contracts/CHANGELOG-conventions.md` and it is what turned
 * 14.17.0 red after a branch, a PR and a CI run had already been spent.
 *
 * Returns `null` on any measurement failure — a shallow clone or a missing tag
 * is an environment fact, and the contract is explicit that it degrades to a
 * warning rather than to a refusal. `null` produces no blocker downstream.
 */
export function measure_mix_obligation(
    version: string,
    fromRef?: string | null,
): MixObligation | null {
    try {
        const from = fromRef ?? previous_release_tag('HEAD', REPO_ROOT);
        if (!from) return null;
        const reading = measureRange(from, 'HEAD', loadTaxonomy(), version, REPO_ROOT);
        const o = reading.response_obligation;
        return {
            triggered: o.triggered,
            level:
                `governance-only ${String(o.governance_only)} vs consumer-only ` +
                `${String(o.consumer_only)} (taxonomy ${reading.taxonomy_version})`,
        };
    } catch (err) {
        // The CI side prints `⚠️  governance mix not measured`; swallowing it
        // here made a broken taxonomy file disable BOTH local guards in
        // silence while CI kept refusing — the exact asymmetry this change
        // exists to remove, restored one layer down.
        process.stderr.write(
            `⚠️   governance mix not measured for ${version}: ${(err as Error).message}\n` +
                '    Both local guards are inert for this obligation; the release PR still refuses.\n',
        );
        return null;
    }
}

/**
 * Refuse the FIRST remote state of a release whose section is not publishable.
 *
 * The fourth guard site, and the one the other three structurally cannot cover.
 * They sit at the irreversible transitions — annotated tag, resumed tag push,
 * GitHub Release body — and every one of them is DOWNSTREAM of `gh pr create`
 * and of `gh pr checks --watch`. `check_release_highlights` refuses the same
 * section from the other side, on the release PR, so a run whose head is still
 * the generator's draft pushed a branch, opened a PR, burned CI, waited on a
 * check that could not pass, and died there — leaving a half-open release to
 * clean up by hand.
 *
 * That is not a hypothetical: it is PR #1812 (14.14.0, 2026-09-02), and the
 * 2026-09-01 flip's own risk register pre-registered it as Risk 1 — *"the flip
 * reds the next release PR on its first run"*. Its stated mitigation was that
 * the releaser edits prose before merge; nothing in the pipeline asked, so
 * nothing did.
 *
 * The branch push is the first thing in the pipeline that leaves the machine,
 * so a refusal here costs one local edit and no remote state at all: no branch
 * on the remote, no pull request, no CI minutes, no tag. It sits at the push
 * CALL SITE rather than in a formatter for the reason the publication guards
 * already state — a formatter has no notion of whether it is publishing, and
 * the call site is the one that can still stop. Deriving the version from
 * `release/X.Y.Z` mirrors what `release-validation.yml` already does with
 * `head_ref`.
 *
 * Two states pass unguarded, deliberately: a branch that is not
 * `release/X.Y.Z` (nothing about a release to read), and a version with no
 * changelog section (the missing-section refusal belongs to the publication
 * sites, which need a section to publish; refusing here would break every
 * non-release push through this helper).
 */
export function guard_release_branch_push(branch: string): void {
    const prefix = 'release/';
    if (!branch.startsWith(prefix)) {
        return;
    }
    const version = branch.slice(prefix.length);
    const section = extract_changelog_section(read_changelog_text(), version);
    if (!section) {
        return;
    }
    const blockers = section_publication_blockers(
        section.body,
        version,
        `\`${branch}\``,
        measure_mix_obligation(version),
    );
    if (blockers.length === 0) {
        return;
    }
    die(
        `refusing to push ${branch} — the ${version} changelog section is not publishable ` +
            `(${String(blockers.length)} blocker(s)):\n` +
            blockers.map((b) => `    - ${b}`).join('\n') +
            `\n    Nothing has left this machine: no branch on ${REMOTE}, no pull request, no tag.\n` +
            '    Curate the `### Release highlights` head in CHANGELOG.md under ' +
            `\`## [${version}]\`, then re-run \`task release -- --resume\`.`,
    );
}

/**
 * Ask for the curation BEFORE the pipeline commits anything — the fifth guard
 * site, and the one that closes the gap the other four only narrowed.
 *
 * `guard_release_branch_push` already refuses before any REMOTE state exists,
 * which is why 14.14.1 cost nothing but a re-run. What it cannot do is refuse
 * before LOCAL state exists: by the time the push is attempted, step 2 has
 * bumped six files and regenerated the derived trees and step 3 has committed
 * all of it as `release: X.Y.Z`. The operator then edits prose on top of a
 * commit that already claims to be the release and continues with `--resume`.
 *
 * The sentence this fixes is in that guard's own docstring: the 2026-09-01
 * flip's risk register named *"the releaser edits prose before merge"* as the
 * mitigation, and *"nothing in the pipeline asked, so nothing did"*. Refusing
 * is not asking. This is the ask, placed where the answer is cheapest: the
 * changelog section has just been written, nothing is committed, and the fix is
 * an edit to a file already open in the working tree.
 *
 * It names the labels rather than only the marker, because the operator's next
 * action is to rewrite specific lines and hunting for them in a 30-line section
 * is the friction that made the refusal feel like a failure rather than a step.
 *
 * Deliberately silent when the section does not exist — same reasoning as the
 * push guard: a missing section is the publication sites' refusal to make, not
 * this one's.
 *
 * `prMerged` is a parameter rather than a check at the call site, and it is
 * load-bearing in both directions. On the merged path steps 2 and 3 do not run,
 * so there is no pre-commit moment to ask about; firing anyway PREEMPTS the
 * step-8 and step-9 guards, whose whole subject is the merged section. That is
 * measured, not anticipated — the unconditional form red three `release_drill`
 * scenarios that exist to pin exactly those later refusals. It lives here
 * rather than in an `if` at the call site because `release.ts` is 2000+ lines
 * and every line above 1500 is charged by the growth ratchet, while this module
 * is far below it.
 */
/**
 * Own the whole step-1 branch decision: reuse an existing release branch, and
 * make sure whatever we end up on carries current `main`.
 *
 * Three defects it closes, all measured on 14.15.0 (2026-09-03) in one sitting,
 * and all the same underlying mistake — a release branch that is not on current
 * `main`, discovered later than it could have been.
 *
 * 1. **Reuse was gated on `--resume`.** The two "branch exists" arms read
 *    `resume && _branch_exists_local(branch)`, so a PLAIN `task release` over an
 *    existing branch fell through to `git checkout -b` and died with exit 128.
 *    That is exactly the state `guard_release_curation` leaves behind — it stops
 *    before the commit, and the branch it stops on already exists — while its
 *    own message says to re-run `task release`. The message was right about
 *    what to do and the code refused to do it. Reuse no longer consults
 *    `resume`: an existing release branch is a fact about the repository, not
 *    about the flag.
 * 2. **A branch cut from an older `main` failed at the PUSH.** The pre-push
 *    preflight reported `branch is BEHIND origin/main` after steps 2 and 3 had
 *    already bumped and committed — the cheapest moment to integrate `main` is
 *    the moment we check the branch out, not eight steps later.
 * 3. **A fresh branch was cut from whatever local `main` happened to be.** The
 *    create arm never pulled, so a stale local `main` produced a stale release
 *    branch and defect 2 followed on the next run. Fixed on the same terms
 *    rather than left as the half that still bites: leaving it would reproduce
 *    the "fix that does not fix it" pattern the other two came from.
 *
 * `say` is a callback rather than a direct write because the `[N/total]` step
 * prefix belongs to the orchestrator, which knows the total; this module does
 * not. Keeping the printing there and the decision here is also what lets
 * `release.ts` shed twenty lines — it sits ~500 lines past the 1500-line cap,
 * where every line is charged by the growth ratchet, and this module is under
 * it.
 *
 * The merge is `git merge`, never a rebase and never a force: a release branch
 * can already carry a pushed commit and somebody else's merge, and neither is
 * ours to rewrite.
 */
export function checkout_release_branch(
    branch: string,
    prMerged: boolean,
    say: (msg: string) => void,
): void {
    if (prMerged) {
        say(`PR for ${branch} already merged — staying on ${MAIN_BRANCH}`);
        if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== MAIN_BRANCH) {
            run(['git', 'checkout', MAIN_BRANCH]);
        }
        run(['git', 'pull', '--ff-only', REMOTE, MAIN_BRANCH]);
        return;
    }
    if (_branch_exists_local(branch)) {
        say(`Branch ${branch} exists locally — checkout`);
        run(['git', 'checkout', branch]);
    } else if (_branch_exists_remote(branch)) {
        say(`Branch ${branch} exists on ${REMOTE} — fetch + checkout`);
        run(['git', 'fetch', REMOTE, branch]);
        run(['git', 'checkout', '-b', branch, `${REMOTE}/${branch}`]);
    } else {
        // Cut from CURRENT main, not from whatever the local ref happens to be.
        say(`Create branch ${branch} from current ${MAIN_BRANCH}`);
        if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) === MAIN_BRANCH) {
            run(['git', 'pull', '--ff-only', REMOTE, MAIN_BRANCH]);
        }
        run(['git', 'checkout', '-b', branch]);
        return;
    }
    integrate_main_if_behind(branch, say);
}

/**
 * Merge `origin/<default>` into the checked-out release branch when it is
 * behind, so the pre-push preflight is never the first place that surfaces.
 *
 * Silent when the branch is already current — a release run should not print a
 * merge it did not make. Counting with `rev-list --count` against the fetched
 * remote ref rather than the local one: the local `main` is exactly what went
 * stale in the case this exists for.
 */
export function integrate_main_if_behind(branch: string, say: (msg: string) => void): void {
    run(['git', 'fetch', REMOTE, MAIN_BRANCH], { check: false });
    const behind = git(['rev-list', '--count', `HEAD..${REMOTE}/${MAIN_BRANCH}`], {
        capture: true,
    }).trim();
    if (behind === '' || behind === '0') {
        return;
    }
    say(`Branch ${branch} is ${behind} commit(s) behind ${REMOTE}/${MAIN_BRANCH} — merging it in`);
    run(['git', 'merge', `${REMOTE}/${MAIN_BRANCH}`, '--no-edit']);
}

export function guard_release_curation(version: string, prMerged = false): void {
    if (prMerged) {
        return;
    }
    const section = extract_changelog_section(read_changelog_text(), version);
    if (!section) {
        return;
    }
    // The head-level blockers plus the mix obligation — deliberately NOT the
    // tests footer.
    //
    // This site runs BEFORE `prepend_changelog`'s output is committed, and
    // `--resume` skips the whole bump block once `package.json` already carries
    // the target version. So a refusal here for a missing footer is a trap: the
    // writer never gets a second chance to render it, the message forbids
    // hand-writing it, and the operator is left rolling `package.json` back by
    // hand. The footer is a MEASUREMENT the writer produces, not prose the
    // operator can supply, which is exactly why it does not belong at the site
    // that fires before the artefact exists in git.
    //
    // `guard_release_branch_push` carries it instead: by then the section is
    // committed and editable on the branch, and nothing has left the machine.
    const blockers = [
        ...publication_blockers(
            section.body,
            version,
            `\`release/${version}\``,
            measure_mix_obligation(version),
        ),
    ];
    if (blockers.length === 0) {
        return;
    }
    const marked = section.body
        .split('\n')
        .filter((l) => l.includes(DERIVED_MARKER))
        .map((l) => `      ${l.trim()}`);
    die(
        `the ${version} release highlights are still the generator's draft ` +
            `(${String(blockers.length)} blocker(s)):\n` +
            blockers.map((b) => `    - ${b}`).join('\n') +
            (marked.length > 0
                ? `\n    Lines to rewrite in \`CHANGELOG.md\` under \`## [${version}]\`:\n` +
                  marked.join('\n')
                : '') +
            '\n    Stopped BEFORE committing — no release commit, no branch on ' +
            `${REMOTE}, no pull request, no tag. Curate the ` +
            '`### Release highlights` head, then re-run `task release`.',
    );
}

function push_release_branch(branch: string): void {
    guard_release_branch_push(branch);
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

/**
 * Refuse an irreversible publication whose section is not publishable.
 *
 * Called at the THREE call sites that publish, never inside a formatter:
 * annotated-tag creation, the resumed push of a tag created but never pushed,
 * and the GitHub Release body. A pure formatter has no notion of whether it is
 * actually publishing, which is why an earlier attempt at that placement was
 * refused; the call site does, and it is the one that can still stop.
 *
 * **The resumed push is the bypass worth naming.** The changelog is read only
 * in the tag-CREATION branch, so a resume over a tag that was created but never
 * pushed reached `_push_tag` having read nothing. A guard covering creation
 * alone misses exactly that path, and pushing a tag is as irreversible as
 * creating it.
 *
 * `die` throws before the command runs, so nothing irreversible fires after a
 * refusal — an ordering asserted against the drill's recorded command list
 * rather than by reading this comment.
 *
 * Lives here rather than in `release.ts` because that file is 2000+ lines and
 * every line above 1500 is charged by the source-size growth ratchet, while
 * this module is far below it and already owns `die`. Behaviour unchanged.
 */
export function _refuse_unpublishable(sectionBody: string, version: string, surface: string): void {
    const blockers = publication_blockers(sectionBody, version);
    if (blockers.length === 0) {
        return;
    }
    die(
        `refusing to publish the ${surface} for ${version} — ` +
            `${String(blockers.length)} publication blocker(s):\n` +
            blockers.map((b) => `    - ${b}`).join('\n'),
    );
}

/**
 * Read the section under release and refuse if it is not publishable.
 *
 * One helper for all three publish sites so the read, the missing-section
 * refusal and the blocker refusal cannot drift apart between them — the
 * resumed-push path drifted exactly that way before this existed, reaching
 * `_push_tag` having read nothing.
 */
export function guard_publication(version: string, surface: string): void {
    const section = extract_changelog_section(read_changelog_text(), version);
    if (!section) {
        die(
            `CHANGELOG.md on ${MAIN_BRANCH} carries no section for ${version} — ` +
                `refusing to publish the ${surface}`,
        );
        return;
    }
    _refuse_unpublishable(section.body, version, surface);
}

/**
 * Derive the tag message from the MERGED changelog, refuse if unpublishable,
 * create the annotated tag and push it.
 *
 * The three steps are one function because they are one irreversible act with
 * one precondition, and splitting them across call sites is what let the
 * resumed-push path reach `_push_tag` having read nothing. Sequencing is
 * load-bearing (release-truth Phase 1, council 2026-08-03): merge FIRST, pull
 * main, THEN derive the message — tagging before the merge reads a section that
 * does not exist yet. The annotated tag replaces the previous lightweight one so
 * tag metadata is a fourth surface carrying the same single-source content.
 */
export function create_and_push_annotated_tag(version: string): void {
    const merged = extract_changelog_section(read_changelog_text(), version);
    if (!merged) {
        die(
            `CHANGELOG.md on ${MAIN_BRANCH} carries no section for ${version} — ` +
                'refusing to tag a release whose changelog entry is missing',
        );
        return;
    }
    _refuse_unpublishable(merged.body, version, 'annotated tag');
    run(['git', 'tag', '-a', version, '-m', tag_message_from_section(merged.body, version)]);
    _push_tag(version);
}

// Relocated from `release.ts` on 2026-09-05, for the reason
// `_refuse_unpublishable` above already states: that file is 2000+ lines and
// every line above 1500 is charged by the source-size growth ratchet. The move
// is not incidental to this change — the `Tests: N` footer became a
// section-level publication obligation in the same diff
// (`section_publication_blockers`), so the writer that emits it and the guard
// that refuses its absence now sit in one module. `release.ts` re-exports all
// four names, so every existing importer is unaffected.

const _TEST_COUNT_LINE_RE = /^Tests:\s+(\d+)/m;

/**
 * Buffer ceiling for the `vitest list` probe, in bytes.
 *
 * `spawnSync` buffers the child's whole stdout in memory and fails with
 * ENOBUFS past `maxBuffer`, whose default is 1 MiB. The probe emits one line
 * per test case, so its output grows with the suite: at 9470 cases the listing
 * is ~1.25 MB, i.e. already past the default. That is what silently dropped
 * the footer from the 9.10.0 notes and turned the `changelog-entry` gate red.
 * 64 MiB is ~50× the current listing — headroom for a suite many times this
 * size, at no cost when the output is small.
 */
export const _TEST_LIST_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Count test cases from a finished `vitest list` spawn result, or return null
 * when the probe did not produce a usable listing.
 *
 * Split out from `_count_tests_current` so the failure modes are testable
 * without spawning the real (~14s, >1 MB) collection. `warn` is injected for
 * the same reason; it defaults to stderr.
 */
export function _count_from_list_result(
    res: {
        error?: (Error & { code?: string }) | undefined;
        status: number | null;
        stdout: string | null;
    },
    warn: (msg: string) => void = (msg) => void process.stderr.write(msg),
): number | null {
    // The trend line is informational and never blocks a release — but a
    // SILENT drop is what shipped 9.8.0 and 9.10.0 without a footer, so every
    // degradation says why. The `changelog-entry` CI gate treats a missing
    // footer as fatal, so this warning is the difference between fixing the
    // probe now and finding out from a red release PR.
    if (res.error) {
        // ENOENT (no npx) · ETIMEDOUT · ENOBUFS (listing past maxBuffer).
        const code = res.error.code ?? res.error.message;
        warn(
            `⚠️  test-count probe failed (${code}) — the \`Tests:\` footer will ` +
                `be omitted from the release notes, which fails the ` +
                `\`CHANGELOG entry exists for head version\` gate.\n`,
        );
        return null;
    }
    if ((res.status ?? 1) !== 0) {
        warn(
            `⚠️  test-count probe exited ${res.status ?? '(null)'} — the ` +
                `\`Tests:\` footer will be omitted from the release notes.\n`,
        );
        return null;
    }
    const lines = (res.stdout ?? '').split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
        warn('⚠️  test-count probe listed 0 cases — the `Tests:` footer will be omitted.\n');
        return null;
    }
    return lines.length;
}

/**
 * Return the collected vitest test-case count on the current tree
 * (`npx vitest list`, one line per case; ~14s wall). Returns null when
 * collection fails — the trend line is informational, never a release
 * blocker, but every failure warns (see `_count_from_list_result`).
 * (Replaced the dead `pytest --collect-only` probe on 2026-07-08,
 * road-to-truth-and-reference-hygiene Phase 3: the Python suite was retired
 * with ADR-200, so the old probe always degraded to null and the `Tests:`
 * footer silently vanished from release notes.)
 */
export function _count_tests_current(): number | null {
    // Recursion/cost guard: `npx vitest list` inside a vitest-driven release
    // test would collect the whole suite from within the suite (the child
    // inherits VITEST=… from the runner) — the exact recursion the caller
    // comment warns about. Degrade to null there, same as any other
    // collection failure.
    if (process.env['VITEST'] !== undefined) {
        return null;
    }
    const res = spawnSync('npx', ['vitest', 'list'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180_000,
        maxBuffer: _TEST_LIST_MAX_BUFFER,
    });
    return _count_from_list_result(res);
}

/**
 * Read CHANGELOG.md and return the most recent `Tests: N` footer under the
 * `prev_tag` heading, or null when not found.
 */
export function _previous_test_count_from_changelog(prev_tag: string | null): number | null {
    if (!prev_tag || !fs.existsSync(CHANGELOG)) {
        return null;
    }
    const text = fs.readFileSync(CHANGELOG, 'utf-8');
    const heading_re = new RegExp(`^##\\s+\\[?${reEscape(prev_tag)}\\b`, 'm');
    const m = heading_re.exec(text);
    if (!m) {
        return null;
    }
    const headEnd = m.index + m[0].length;
    const rest = text.slice(headEnd);
    const next_heading = NEXT_SECTION_RE.exec(rest);
    const sectionEnd = headEnd + (next_heading ? next_heading.index : rest.length);
    const section = text.slice(headEnd, sectionEnd);
    const count_match = _TEST_COUNT_LINE_RE.exec(section);
    return count_match ? Number.parseInt(count_match[1] as string, 10) : null;
}

/**
 * Return the `Tests: N (+M since X.Y.Z)` footer line, or null when the current
 * count cannot be determined. Silent on collection errors.
 */
export function _render_test_trend_line(prev_tag: string | null): string | null {
    const current = _count_tests_current();
    if (current === null) {
        return null;
    }
    const previous = _previous_test_count_from_changelog(prev_tag);
    if (previous === null || !prev_tag) {
        return `Tests: ${current}`;
    }
    const delta = current - previous;
    const sign = delta >= 0 ? '+' : '';
    return `Tests: ${current} (${sign}${delta} since ${prev_tag})`;
}
