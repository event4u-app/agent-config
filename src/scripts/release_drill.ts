#!/usr/bin/env tsx
/**
 * Release-orchestration drill — execute() against a simulated git/gh world.
 *
 * `task release` step machinery (checkout → bump → commit → push → PR →
 * checks → merge → tag → GitHub Release → branch cleanup) historically ran
 * NOWHERE except live: `--dry-run` returns before execute(), and the unit
 * tests never call it. Every orchestration bug therefore fired mid-release —
 * three times in one week (2026-08-03: push rejected after a remote move,
 * merge dying on a BEHIND head, gh resolving the PR from the wrong HEAD).
 *
 * This drill closes that hole. It installs release.ts's exec seam
 * (`_set_exec_override`) so every external command is answered by a scripted
 * FakeWorld, then runs the REAL execute() through named scenarios — the happy
 * path plus each measured failure mode. run()'s check/die/CalledProcessError
 * semantics apply to the simulated results, so the drill exercises the real
 * error paths, not a parallel reimplementation.
 *
 * Surfaces:
 *   - vitest: tests/scripts/release_drill.test.ts runs every scenario in CI.
 *   - operator: `task release-drill` (or `./scripts-run src/scripts/release_drill`)
 *     runs them all and prints one ✅/❌ line per scenario.
 *
 * The drill never touches git, gh, npm, or the filesystem outside reading
 * package.json (execute()'s own resume-mode bump-skip probe).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    _MERGE_UPDATE_ROUNDS,
    _set_changelog_reader,
    _set_exec_override,
    execute,
    Plan,
    SystemExitError,
} from './release.js';
import { DERIVED_MARKER } from './_lib/release_highlights.js';
import {
    AUGMENT_MARKETPLACE_JSON,
    AUGMENT_PLUGIN_JSON,
    CHANGELOG,
    MARKETPLACE_JSON,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    PROJECT_TEMPLATE,
} from './release_env.js';

/**
 * The files step 2 mutates on disk, snapshotted around every scenario.
 *
 * The FakeWorld intercepts COMMANDS, not `fs` writes, and step 2's bump is
 * seven direct writes. Every scenario before 2026-09-03 passed `--resume` with
 * `package.json` already at the target, so step 2 short-circuited and nothing
 * was ever written — the drill looked side-effect-free because no scenario had
 * reached the writing arm. The first `resume: false` scenario appended twelve
 * `## 14.15.0` headings to the REAL `CHANGELOG.md`.
 *
 * Snapshot-and-restore rather than a writer seam: a seam means threading an
 * injection point through seven call sites in `release.ts`, which sits past the
 * 1500-line cap where every line is charged. This is contained to the runner
 * and covers any future scenario without further thought.
 */
const _MUTATED_BY_STEP_2: readonly string[] = [
    CHANGELOG,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    MARKETPLACE_JSON,
    AUGMENT_PLUGIN_JSON,
    AUGMENT_MARKETPLACE_JSON,
    PROJECT_TEMPLATE,
];

function _snapshot_step_2_files(): Map<string, string> {
    const snap = new Map<string, string>();
    for (const f of _MUTATED_BY_STEP_2) {
        if (fs.existsSync(f)) {
            snap.set(f, fs.readFileSync(f, 'utf-8'));
        }
    }
    return snap;
}

function _restore_step_2_files(snap: ReadonlyMap<string, string>): void {
    for (const [f, content] of snap) {
        if (fs.readFileSync(f, 'utf-8') !== content) {
            fs.writeFileSync(f, content);
        }
    }
}

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** execute()'s bump-skip probe reads the real package.json — mirror it. */
function current_version(): string {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    return String(pkg['version']);
}

interface ExecResult {
    status: number;
    stdout: string;
    stderr: string;
}

const OK: ExecResult = { status: 0, stdout: '', stderr: '' };

/** Knobs a scenario turns to inject the measured failure modes. */
interface WorldConfig {
    /** `git push -u` is rejected this many times before succeeding (9.15.0). */
    push_rejections?: number;
    /** mergeStateStatus reports BEHIND this many probes in a row (9.16.0). */
    behind_probes?: number;
    /**
     * Commits the release branch is behind `origin/main` at step 1.
     *
     * Distinct from `behind_probes`, which fakes the PR's own
     * `mergeStateStatus` at step 6. This one fakes `git rev-list --count
     * HEAD..origin/main`, the probe `integrate_main_if_behind` uses — the
     * defect it covers surfaced at the PUSH, six steps before that PR ever
     * existed.
     */
    branch_behind_main?: number;
    /**
     * Whether `execute()` is invoked with `--resume`. Defaults to TRUE so every
     * pre-existing scenario keeps the shape it was written against.
     *
     * Configurable since 2026-09-03 because the drill could not otherwise
     * reach the defect: branch reuse used to be gated on `resume`, so a plain
     * `task release` over an existing branch died at `git checkout -b` with
     * exit 128 — and every scenario here passed `resume: true`, which is
     * exactly the arm that worked.
     */
    resume?: boolean;
    /** `gh pr merge` fails once with the not-up-to-date error (the race). */
    merge_races_once?: boolean;
    /** `gh pr merge` fails hard with an unrelated error (must surface). */
    merge_fails_hard?: boolean;
    /** PR checks fail (watch exits non-zero) — the release must die. */
    checks_fail?: boolean;
    /**
     * Content `git show <target>:CHANGELOG.md` returns.
     *
     * Step 1.3 of `road-to-release-publication-integrity`, decided by AI council
     * 2026-08-23 (2/2 convergent) in favour of controlled fixtures over a scoped
     * policy exemption. The drill USED to return the live `CHANGELOG.md`, which
     * coupled every sequencing scenario to whatever the repository's changelog
     * happened to contain — and that coupling is what broke four scenarios in the
     * second refused attempt at the publication guard: a guard reading real
     * content refuses on real markers, so the drill failed for a reason that had
     * nothing to do with sequencing.
     *
     * A fixture is the right shape rather than an exemption because the council
     * had already rejected letting drills bypass policy universally: an exempt
     * drill proves the sequencing AND proves nothing about the policy, whereas a
     * fixture holding policy-valid content exercises the same parsing path with
     * content the test controls.
     *
     * Defaults to `defaultChangelogFixture(target)` — a minimal, policy-valid
     * section for the target. Pass the live file explicitly if a scenario really
     * needs it; nothing does today, and doing it silently is what this seam
     * removes.
     */
    changelog?: string;
    /**
     * Content the WORKING-TREE read returns — `read_changelog_text()`, used by
     * step 5 (PR body) and step 8 (annotated-tag message).
     *
     * Added 2026-09-01 with the publication guard (roadmap § 3.1). `changelog`
     * above only covers `git show <tag>:CHANGELOG.md`; the working tree was
     * still the REAL file, whose `14.13.0` section carries four
     * `_auto-derived, rewrite before merge:_` lines. A guard at the tag call
     * site therefore refused every scenario for a reason unrelated to what the
     * scenario tested — the same coupling `changelog` was introduced to
     * remove, on the other read.
     *
     * Defaults to `defaultChangelogFixture(target)`, which is policy-valid by
     * construction.
     */
    changelog_file?: string;
    /**
     * The tag already exists locally and was never pushed — the § 3.2 resume
     * state, which reached `_push_tag` having read no changelog at all.
     */
    tag_created_unpushed?: boolean;
    /**
     * The tag is already on the remote, so step 8 skips entirely and step 9 —
     * the GitHub Release body — is the FIRST irreversible transition the run
     * reaches. The only state in which the Release guard can be exercised on
     * its own, because a marker otherwise stops the run at step 8.
     */
    tag_already_remote?: boolean;
    /**
     * The release PR is ALREADY merged when the run starts — the real
     * resume-after-merge state, in which steps 1 through 7 skip and step 8 is
     * the first step that does work.
     *
     * Added 2026-09-02 with `guard_release_branch_push`. Before that guard, a
     * marker scenario could start from scratch and still reach step 8, because
     * nothing between the changelog write and the tag looked at the section.
     * The push guard now stops such a run at step 4 — correctly, and that is
     * the point of it — which makes this knob the only way left to exercise
     * the tag and Release guards on their own. It is not a bypass: the state
     * it fakes is one every resumed release actually passes through.
     */
    pr_already_merged?: boolean;
}

/**
 * The smallest changelog the pipeline accepts for `target`.
 *
 * Shape requirements, each load-bearing rather than decorative:
 * `extract_changelog_section` needs an `## [X.Y.Z]` heading to find the section
 * at all, `tag_message_from_section` and `pr_body_from_section` render its body,
 * and a SECOND section below it is what proves the extractor stops at the right
 * boundary instead of swallowing the rest of the file. Carries no placeholder
 * marker, deliberately: a fixture that trips the very guard the drill exists to
 * sequence would reproduce the failure this seam removes.
 */
export function defaultChangelogFixture(target: string): string {
    return [
        '# Changelog',
        '',
        `## [${target}]`,
        '',
        '### Features',
        '',
        '- fixture entry for the release drill',
        '',
        '## [0.0.0]',
        '',
        '- earlier release, present so the section boundary is exercised',
        '',
    ].join('\n');
}

/**
 * `defaultChangelogFixture` with one head line still carrying the generator's
 * draft marker — the exact state five released sections shipped in.
 *
 * Built from `DERIVED_MARKER` rather than from a literal string: a fixture
 * that hardcodes the marker text keeps passing after the marker is renamed,
 * which is a guard policing a population of zero.
 */
export function markedChangelogFixture(target: string): string {
    return defaultChangelogFixture(target).replace(
        '- fixture entry for the release drill',
        `### Release highlights\n\n- **Behaviour changes:** ${DERIVED_MARKER} rule/schema diffs in abc1234.\n\n- fixture entry for the release drill`,
    );
}

/**
 * A scriptable stand-in for every git/gh/task command execute() issues.
 * Stateful where the real world is: checkouts move HEAD, `git tag` makes the
 * tag exist, a successful merge flips the PR to MERGED and deletes the branch.
 */
class FakeWorld {
    readonly calls: string[] = [];
    head = 'main';
    tag_local = false;
    tag_remote = false;
    pr_merged = false;
    release_created = false;
    branch_exists_remote = true;
    /** Live PR body (release-truth Phase 1: refreshed from the changelog at head). */
    pr_body = '';

    private push_rejections: number;
    private behind_probes: number;
    private branch_behind_main: number;
    private merge_races_once: boolean;
    private merge_fails_hard: boolean;
    private checks_fail: boolean;
    private readonly changelog: string;
    /** Working-tree content; see `WorldConfig.changelog_file`. */
    readonly changelog_file: string;

    constructor(
        readonly branch: string,
        readonly target: string,
        cfg: WorldConfig,
    ) {
        this.push_rejections = cfg.push_rejections ?? 0;
        this.changelog = cfg.changelog ?? defaultChangelogFixture(target);
        this.changelog_file = cfg.changelog_file ?? defaultChangelogFixture(target);
        this.tag_local = (cfg.tag_created_unpushed ?? false) || (cfg.tag_already_remote ?? false);
        this.tag_remote = cfg.tag_already_remote ?? false;
        this.behind_probes = cfg.behind_probes ?? 0;
        this.branch_behind_main = cfg.branch_behind_main ?? 0;
        this.merge_races_once = cfg.merge_races_once ?? false;
        this.merge_fails_hard = cfg.merge_fails_hard ?? false;
        this.checks_fail = cfg.checks_fail ?? false;
        this.pr_merged = cfg.pr_already_merged ?? false;
    }

    exec(args: readonly string[]): ExecResult {
        const cmd = args.join(' ');
        this.calls.push(cmd);

        // ── git ──────────────────────────────────────────────────────────
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return { ...OK, stdout: `${this.head}\n` };
        }
        if (args[0] === 'git' && args[1] === 'checkout') {
            this.head = args[2] === '-b' ? (args[3] as string) : (args[2] as string);
            return OK;
        }
        if (cmd === 'git rev-list --count HEAD..origin/main') {
            return { ...OK, stdout: `${String(this.branch_behind_main)}\n` };
        }
        if (cmd === 'git merge origin/main --no-edit') {
            // A real merge closes the gap, so a second probe reads 0. Without
            // this the scenario could not tell one merge from a loop.
            this.branch_behind_main = 0;
            return OK;
        }
        if (cmd === `git rev-parse --verify --quiet refs/heads/${this.branch}`) {
            return this.pr_merged ? { ...OK, status: 1 } : OK;
        }
        if (cmd === `git ls-remote --exit-code --heads origin ${this.branch}`) {
            return this.branch_exists_remote ? OK : { ...OK, status: 1 };
        }
        if (cmd === `git ls-remote --exit-code --tags origin ${this.target}`) {
            return this.tag_remote ? OK : { ...OK, status: 1 };
        }
        if (cmd === `git tag -l ${this.target}`) {
            return { ...OK, stdout: this.tag_local ? `${this.target}\n` : '' };
        }
        if (cmd === `git tag ${this.target}` || (args[1] === 'tag' && args[2] === '-a' && args[3] === this.target)) {
            // release-truth Phase 1: the tag is annotated, message derived
            // from the merged changelog section.
            this.tag_local = true;
            return OK;
        }
        if (cmd === `git show ${this.target}:CHANGELOG.md`) {
            // A FIXTURE, not the live file. See `WorldConfig.changelog` for why:
            // returning the repository's own changelog made every sequencing
            // scenario depend on its current content, and that dependency is what
            // broke four of them in the second refused guard attempt.
            return { ...OK, stdout: this.changelog };
        }
        if (cmd === `git push origin ${this.target}`) {
            this.tag_remote = true;
            return OK;
        }
        if (cmd === `git push -u origin ${this.branch}`) {
            if (this.push_rejections > 0) {
                this.push_rejections -= 1;
                return {
                    status: 1,
                    stdout: '',
                    stderr: `! [rejected] ${this.branch} -> ${this.branch} (fetch first)`,
                };
            }
            return OK;
        }
        if (cmd === 'git log -1 --format=%s') {
            return { ...OK, stdout: `release: ${this.target}\n` };
        }
        if (cmd === 'git status --porcelain') {
            return OK; // clean tree — resume mode, everything committed
        }
        if (cmd === 'git diff --cached --name-only') {
            return OK;
        }
        if (args[0] === 'git' && ['fetch', 'merge', 'pull', 'add', 'branch', 'push'].includes(args[1] as string)) {
            return OK;
        }

        // ── task ─────────────────────────────────────────────────────────
        if (args[0] === 'task') {
            return OK; // release-prepare — regeneration is out of drill scope
        }

        // ── gh ───────────────────────────────────────────────────────────
        if (cmd.startsWith(`gh pr list --head ${this.branch}`)) {
            const state = this.pr_merged ? 'MERGED' : 'OPEN';
            return {
                ...OK,
                stdout: JSON.stringify([{ number: 999, state, url: 'https://example.invalid/pr/999' }]),
            };
        }
        if (cmd === `gh pr checks ${this.branch} --watch`) {
            return this.checks_fail
                ? { status: 1, stdout: 'some-required-check\tfail\t10s\n', stderr: '' }
                : { ...OK, stdout: 'all checks pass\n' };
        }
        if (cmd === `gh pr checks ${this.branch} --json name,bucket`) {
            return {
                ...OK,
                stdout: this.checks_fail
                    ? JSON.stringify([{ name: 'some-required-check', bucket: 'fail' }])
                    : '[]',
            };
        }
        if (cmd === `gh pr view ${this.branch} --json mergeStateStatus --jq .mergeStateStatus`) {
            if (this.behind_probes > 0) {
                this.behind_probes -= 1;
                return { ...OK, stdout: 'BEHIND\n' };
            }
            return { ...OK, stdout: 'CLEAN\n' };
        }
        if (cmd === `gh pr merge ${this.branch} --merge --delete-branch`) {
            if (this.merge_fails_hard) {
                return { status: 1, stdout: '', stderr: 'GraphQL: Base branch was modified (unexpected)' };
            }
            if (this.merge_races_once) {
                this.merge_races_once = false;
                // The race: main moved between the CLEAN probe and the merge.
                this.behind_probes += 1;
                return {
                    status: 1,
                    stdout: '',
                    stderr: 'X Pull request #999 is not mergeable: the head branch is not up to date with the base branch.',
                };
            }
            this.pr_merged = true;
            this.branch_exists_remote = false;
            this.head = 'main'; // gh checks out the default branch after deleting
            return OK;
        }
        if (cmd === `gh pr view ${this.branch} --json body -q .body`) {
            // release-truth Phase 1: _refresh_pr_body_from_head probes the
            // live body before deciding whether to edit.
            return { ...OK, stdout: this.pr_body };
        }
        if (args[0] === 'gh' && args[1] === 'pr' && args[2] === 'create') {
            // Only reachable on the NON-resume path: a resumed run refreshes an
            // existing PR body instead (step 5's other arm), which is why every
            // scenario before 2026-09-03 could leave this unscripted.
            const bodyIdx = args.indexOf('--body');
            this.pr_body = bodyIdx >= 0 ? String(args[bodyIdx + 1] ?? '') : '';
            this.branch_exists_remote = true;
            return { ...OK, stdout: `https://github.com/event4u-app/agent-config/pull/999\n` };
        }
        if (args[0] === 'gh' && args[1] === 'pr' && args[2] === 'edit' && args[3] === this.branch) {
            const bodyIdx = args.indexOf('--body');
            this.pr_body = bodyIdx >= 0 ? String(args[bodyIdx + 1] ?? '') : this.pr_body;
            return OK;
        }
        if (cmd === `gh release view ${this.target}`) {
            return this.release_created ? OK : { ...OK, status: 1 };
        }
        if (cmd.startsWith(`gh release create ${this.target}`)) {
            this.release_created = true;
            return OK;
        }

        throw new Error(`FakeWorld: unscripted command: ${cmd}`);
    }
}

interface ScenarioOutcome {
    ok: boolean;
    failures: string[];
    world: FakeWorld;
    error: string | null;
}

interface Scenario {
    /** What the scenario proves — printed by the CLI. */
    summary: string;
    config: WorldConfig;
    /** Whether execute() is expected to complete (vs die/throw). */
    expect_success: boolean;
    /** Extra assertions over the finished world; return failure strings. */
    verify: (world: FakeWorld, error: string | null) => string[];
}

function _expect(cond: boolean, msg: string, failures: string[]): void {
    if (!cond) {
        failures.push(msg);
    }
}

function _count(world: FakeWorld, needle: string): number {
    return world.calls.filter((c) => c === needle).length;
}

const SCENARIOS: Record<string, Scenario> = {
    'plain-run-reuses-an-existing-branch': {
        summary:
            'step 1: a PLAIN run (no --resume) over an existing release branch checks it out instead of dying at `git checkout -b`',
        // The defect, measured on 14.15.0: branch reuse read
        // `resume && _branch_exists_local(branch)`, so without --resume the
        // run fell through to the create arm and died with exit 128. That is
        // precisely the state `guard_release_curation` leaves behind — it stops
        // BEFORE the commit, on a branch step 1 already created — while its own
        // message says to re-run `task release`. The code refused the remedy its
        // own message prescribed.
        config: { resume: false },
        expect_success: true,
        verify: (w) => {
            const f: string[] = [];
            _expect(
                w.calls.includes(`git checkout ${w.branch}`),
                'the existing branch was not checked out',
                f,
            );
            _expect(
                !w.calls.includes(`git checkout -b ${w.branch}`),
                'took the create arm over an existing branch — this is the exit-128 path',
                f,
            );
            return f;
        },
    },
    'stale-branch-merges-main-at-step-1': {
        summary:
            'step 1: a branch behind origin/main merges it in there — NOT at the push, where the preflight used to be the first to notice',
        // Second half of the same defect. On 14.15.0 the branch had been cut
        // from an older main during an earlier aborted run; steps 2 and 3
        // bumped and committed, and only the pre-push preflight said `branch is
        // BEHIND origin/main`. The cheapest moment to integrate main is the
        // moment the branch is checked out.
        config: { resume: false, branch_behind_main: 3 },
        expect_success: true,
        verify: (w) => {
            const f: string[] = [];
            const merge = w.calls.indexOf('git merge origin/main --no-edit');
            const push = w.calls.indexOf(`git push -u origin ${w.branch}`);
            _expect(merge >= 0, 'main was never merged into the stale branch', f);
            _expect(push >= 0, 'the branch was never pushed', f);
            // Ordering is the whole point: a merge AFTER the push would mean the
            // preflight had already refused.
            _expect(
                merge >= 0 && push >= 0 && merge < push,
                'main was merged after the push, not before it',
                f,
            );
            _expect(
                _count(w, 'git merge origin/main --no-edit') === 1,
                'merged main more than once — the probe is not being re-read after the merge',
                f,
            );
            return f;
        },
    },
    'marker-refuses-before-commit': {
        summary:
            'step 3: a draft marker refuses BEFORE the release commit — no local release state, and therefore no remote state either',
        config: { changelog_file: markedChangelogFixture(current_version()) },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(
                (err ?? '').includes('release highlights are still the generator'),
                `died for the wrong reason: ${err ?? '(no error)'}`,
                f,
            );
            _expect(
                !w.calls.some((c) => c.startsWith('git commit')),
                'a release commit was made after the refusal',
                f,
            );
            // RENAMED from `marker-refuses-before-branch-push` when
            // `guard_release_curation` moved the refusal one step earlier.
            // Every negative assertion below is UNCHANGED and still
            // load-bearing — each is a remote side effect the 14.14.0 run
            // actually produced: a pushed branch, an open PR, a check watch on
            // a check that could not pass. They now hold more strongly, since
            // the run stops before the commit rather than after it, and the
            // no-commit assertion above is the property that is new.
            //
            // What this scenario no longer reaches, said plainly rather than
            // left for a reader to infer: `guard_release_branch_push`. On the
            // non-merged path it is now unreachable in ONE run, because a
            // section marked at step 4 was already marked at step 3. It stays
            // as defence-in-depth for a section that changes BETWEEN the two —
            // a hand edit mid-run, or a resume over an altered changelog — and
            // its own behaviour stays pinned by the unit tests in
            // `tests/scripts/release_push_failure_masking.test.ts`, which is
            // where that coverage moved to rather than being dropped.
            _expect(
                !w.calls.includes(`git push -u origin ${w.branch}`),
                'the branch was pushed after the refusal',
                f,
            );
            _expect(
                !w.calls.some((c) => c.startsWith('gh pr create')),
                'a pull request was opened after the refusal',
                f,
            );
            _expect(
                !w.calls.some((c) => c.includes('--watch')),
                'CI was waited on after the refusal',
                f,
            );
            _expect(!w.tag_local && !w.tag_remote, 'a tag exists after the refusal', f);
            _expect(!w.release_created, 'a GitHub Release was created after the refusal', f);
            return f;
        },
    },
    'marker-refuses-before-tag': {
        summary:
            'step 8: a draft marker in the merged section refuses BEFORE the annotated tag is created',
        config: {
            pr_already_merged: true,
            changelog_file: markedChangelogFixture(current_version()),
        },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(
                (err ?? '').includes('refusing to publish the annotated tag'),
                `died for the wrong reason: ${err ?? '(no error)'}`,
                f,
            );
            // The load-bearing assertion, and it is about ORDER, not about the
            // message: nothing irreversible may run after the refusal.
            _expect(
                !w.calls.some((c) => c.startsWith('git tag -a ')),
                'an annotated tag was created after the refusal',
                f,
            );
            _expect(!w.tag_local && !w.tag_remote, 'a tag exists after the refusal', f);
            _expect(!w.release_created, 'a GitHub Release was created after the refusal', f);
            return f;
        },
    },
    'marker-refuses-resumed-tag-push': {
        summary:
            'step 8 (§ 3.2): a tag created but never pushed is NOT pushed when its section carries the marker',
        config: {
            pr_already_merged: true,
            tag_created_unpushed: true,
            changelog_file: markedChangelogFixture(current_version()),
        },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(
                (err ?? '').includes('refusing to publish the tag push (resumed)'),
                `died for the wrong reason: ${err ?? '(no error)'}`,
                f,
            );
            // The recorded bypass: this path read no changelog at all, so the
            // push was the FIRST thing that happened. It must now be the thing
            // that does not happen.
            _expect(!w.tag_remote, 'the tag was pushed after the refusal', f);
            _expect(
                !w.calls.includes(`git push origin ${w.target}`),
                'a tag push ran after the refusal',
                f,
            );
            _expect(!w.release_created, 'a GitHub Release was created after the refusal', f);
            return f;
        },
    },
    'marker-refuses-github-release': {
        summary:
            'step 9: with the tag already pushed, a marker in the TAGGED section refuses before the Release is created',
        config: {
            pr_already_merged: true,
            tag_already_remote: true,
            changelog: markedChangelogFixture(current_version()),
            changelog_file: markedChangelogFixture(current_version()),
        },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(
                (err ?? '').includes('refusing to publish the GitHub Release notes'),
                `died for the wrong reason: ${err ?? '(no error)'}`,
                f,
            );
            _expect(!w.release_created, 'the GitHub Release was created after the refusal', f);
            _expect(
                !w.calls.some((c) => c.startsWith(`gh release create ${w.target}`)),
                'gh release create ran after the refusal',
                f,
            );
            return f;
        },
    },
    'clean-section-still-publishes': {
        summary:
            'the guard is scoped to a real defect: a policy-valid section tags and releases as before',
        config: {},
        expect_success: true,
        verify: (w, _err) => {
            const f: string[] = [];
            _expect(w.tag_remote, 'tag never pushed', f);
            _expect(w.release_created, 'GitHub Release never created', f);
            return f;
        },
    },
    'happy-resume': {
        summary: 'resume with everything green runs checkout → checks → merge → tag → release',
        config: {},
        expect_success: true,
        verify: (w, _err) => {
            const f: string[] = [];
            _expect(w.pr_merged, 'PR was never merged', f);
            _expect(w.tag_remote, 'tag never pushed', f);
            _expect(w.release_created, 'GitHub Release never created', f);
            const merge = w.calls.indexOf(`gh pr merge ${w.branch} --merge --delete-branch`);
            const watch = w.calls.indexOf(`gh pr checks ${w.branch} --watch`);
            _expect(watch >= 0 && merge > watch, 'merge did not wait for checks', f);
            return f;
        },
    },
    'push-rejected-then-recover': {
        summary: 'step 4: remote moved under the run — integrate + retry instead of dying (9.15.0)',
        config: { push_rejections: 1 },
        expect_success: true,
        verify: (w, _err) => {
            const f: string[] = [];
            _expect(
                _count(w, `git push -u origin ${w.branch}`) === 2,
                'push was not retried exactly once',
                f,
            );
            _expect(
                w.calls.includes(`git fetch origin ${w.branch}`) &&
                    w.calls.includes(`git merge --no-edit origin/${w.branch}`),
                'rejected push did not integrate the moved remote',
                f,
            );
            _expect(w.pr_merged && w.release_created, 'release did not complete after recovery', f);
            return f;
        },
    },
    'behind-then-merge': {
        summary: 'step 7: head BEHIND main — update branch, re-run checks, merge (9.16.0)',
        config: { behind_probes: 1 },
        expect_success: true,
        verify: (w, _err) => {
            const f: string[] = [];
            _expect(
                w.calls.includes('git merge --no-edit origin/main'),
                'BEHIND head was never updated with main',
                f,
            );
            _expect(
                _count(w, `gh pr checks ${w.branch} --watch`) >= 2,
                'checks were not re-run after the update',
                f,
            );
            _expect(w.pr_merged && w.release_created, 'release did not complete after the update', f);
            return f;
        },
    },
    'merge-race-recovers': {
        summary: 'step 7: main moves between the CLEAN probe and the merge — retry, not crash',
        config: { merge_races_once: true },
        expect_success: true,
        verify: (w, _err) => {
            const f: string[] = [];
            _expect(
                _count(w, `gh pr merge ${w.branch} --merge --delete-branch`) === 2,
                'raced merge was not retried exactly once',
                f,
            );
            _expect(w.pr_merged && w.release_created, 'release did not complete after the race', f);
            return f;
        },
    },
    'behind-forever-dies': {
        summary: `step 7: BEHIND persists past ${_MERGE_UPDATE_ROUNDS} update rounds — die with the resume command`,
        config: { behind_probes: 99 },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(err !== null && err.includes('task release -- --resume --yes'),
                'death message does not name the resume command', f);
            _expect(
                _count(w, 'git merge --no-edit origin/main') === _MERGE_UPDATE_ROUNDS,
                `expected exactly ${_MERGE_UPDATE_ROUNDS} update rounds`,
                f,
            );
            _expect(!w.pr_merged, 'PR must not be merged in this scenario', f);
            return f;
        },
    },
    'merge-fails-hard-surfaces': {
        summary: 'step 7: a non-BEHIND merge failure surfaces unchanged instead of looping',
        config: { merge_fails_hard: true },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(err !== null && err.includes('gh pr merge'), 'error does not name the merge command', f);
            _expect(
                _count(w, `gh pr merge ${w.branch} --merge --delete-branch`) === 1,
                'hard merge failure must not be retried',
                f,
            );
            return f;
        },
    },
    'checks-fail-dies': {
        summary: 'step 6: failing PR checks kill the run before any merge',
        config: { checks_fail: true },
        expect_success: false,
        verify: (w, err) => {
            const f: string[] = [];
            _expect(err !== null && err.includes('PR checks failed'), 'death does not name failing checks', f);
            _expect(
                !w.calls.some((c) => c.startsWith(`gh pr merge`)),
                'merge must never run after failing checks',
                f,
            );
            return f;
        },
    },
};

/** Run one scenario through the real execute(); never touches the world. */
function run_scenario(name: string): ScenarioOutcome {
    const scenario = SCENARIOS[name];
    if (scenario === undefined) {
        throw new Error(`unknown scenario: ${name}`);
    }
    const target = current_version();
    const branch = `release/${target}`;
    const world = new FakeWorld(branch, target, scenario.config);
    const plan = new Plan(target, target, 'patch', [], null, `Release ${target}.`, `## ${target}\n`, null);

    let error: string | null = null;
    // Capture the run's own output: die() writes its message to stderr before
    // throwing a bare SystemExitError, and the step lines on stdout are noise
    // when seven scenarios run back to back.
    const captured: string[] = [];
    const orig_out = process.stdout.write.bind(process.stdout);
    const orig_err = process.stderr.write.bind(process.stderr);
    (process.stdout as { write: unknown }).write = (s: string): boolean => {
        captured.push(String(s));
        return true;
    };
    (process.stderr as { write: unknown }).write = (s: string): boolean => {
        captured.push(String(s));
        return true;
    };
    const tree_snapshot = _snapshot_step_2_files();
    _set_exec_override((args) => world.exec(args));
    // The working-tree read, faked for the same reason the command layer is.
    // Without this the drill's step 8 reads the repository's real CHANGELOG.md.
    _set_changelog_reader(() => world.changelog_file);
    try {
        execute(plan, { wait_for_checks: true, dry_run: false, resume: scenario.config.resume ?? true });
    } catch (err) {
        if (err instanceof SystemExitError) {
            error = `SystemExit(${err.code}): ${captured.join('')}`;
        } else {
            error = err instanceof Error ? err.message : String(err);
        }
    } finally {
        _set_exec_override(null);
        _set_changelog_reader(null);
        process.stdout.write = orig_out;
        process.stderr.write = orig_err;
        _restore_step_2_files(tree_snapshot);
    }

    const failures: string[] = [];
    if (scenario.expect_success && error !== null) {
        failures.push(`expected success, got: ${error}`);
    }
    if (!scenario.expect_success && error === null) {
        failures.push('expected the run to die, but it completed');
    }
    failures.push(...scenario.verify(world, error));
    return { ok: failures.length === 0, failures, world, error };
}

function main(): number {
    let failed = 0;
    const names = Object.keys(SCENARIOS);
    process.stdout.write(`release drill — ${names.length} scenario(s), simulated git/gh world\n\n`);
    for (const name of names) {
        const outcome = run_scenario(name);
        if (outcome.ok) {
            process.stdout.write(`✅  ${name} — ${SCENARIOS[name]!.summary}\n`);
        } else {
            failed += 1;
            process.stdout.write(`❌  ${name} — ${SCENARIOS[name]!.summary}\n`);
            for (const f of outcome.failures) {
                process.stdout.write(`      ${f}\n`);
            }
        }
    }
    process.stdout.write(`\nscanned: ${names.length}\n`);
    process.stdout.write(
        failed === 0
            ? '✅  release drill green — the step machinery survives every measured failure mode.\n'
            : `❌  release drill: ${failed} scenario(s) failed.\n`,
    );
    return failed === 0 ? 0 : 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argvPath = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argvPath;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { FakeWorld, SCENARIOS, run_scenario };
export type { Scenario, WorldConfig };
