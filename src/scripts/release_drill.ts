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
    _set_exec_override,
    execute,
    Plan,
    SystemExitError,
} from './release.js';

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
    private merge_races_once: boolean;
    private merge_fails_hard: boolean;
    private checks_fail: boolean;
    private readonly changelog: string;

    constructor(
        readonly branch: string,
        readonly target: string,
        cfg: WorldConfig,
    ) {
        this.push_rejections = cfg.push_rejections ?? 0;
        this.changelog = cfg.changelog ?? defaultChangelogFixture(target);
        this.behind_probes = cfg.behind_probes ?? 0;
        this.merge_races_once = cfg.merge_races_once ?? false;
        this.merge_fails_hard = cfg.merge_fails_hard ?? false;
        this.checks_fail = cfg.checks_fail ?? false;
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
    _set_exec_override((args) => world.exec(args));
    try {
        execute(plan, { wait_for_checks: true, dry_run: false, resume: true });
    } catch (err) {
        if (err instanceof SystemExitError) {
            error = `SystemExit(${err.code}): ${captured.join('')}`;
        } else {
            error = err instanceof Error ? err.message : String(err);
        }
    } finally {
        _set_exec_override(null);
        process.stdout.write = orig_out;
        process.stderr.write = orig_err;
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
