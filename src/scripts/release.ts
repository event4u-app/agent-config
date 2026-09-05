#!/usr/bin/env tsx
/**
 * End-to-end release automation for `event4u/agent-config` (TypeScript twin).
 *
 * Ported from the retired Python `src/scripts/release.py` (ADR-200).
 * The CLI contract pins the historical contract exactly — same flags, same
 * exit codes, same stdout/stderr split, byte-identical emitted output, same
 * subprocess argv/cwd/env. No behaviour changes — latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Invoked via `task release` (interactive, local) OR
 * `.github/workflows/release.yml` (unattended, triggered by merging a PR
 * labeled `release` / `release:major` / `release:minor` / `release:patch`
 * — pass `--ci`). Both entry points share this one pipeline; `--ci` only
 * changes the gh-auth probe (GITHUB_TOKEN, not a user token), adds a
 * nothing-to-release short-circuit (see `nothing_to_release_ci`) so firing
 * the label path twice is a clean no-op, and dispatch-chains
 * release-guard.yml + publish-npm.yml + cloud-release.yml after the
 * release (a bot-pushed tag does not trigger them — GitHub's GITHUB_TOKEN
 * recursion guard). The bump
 * level (major/minor/patch) is auto-detected from Conventional Commits
 * since the last tag; pass `--as {major,minor,patch}` to force, or
 * `--version X.Y.Z` to pin.
 *
 * Pipeline:
 *     1. Preflight         — on main, clean tree, origin in sync, gh available,
 *                            target tag doesn't exist yet.
 *     2. Plan              — compute new version, parse Conventional Commits
 *                            since the last tag, render CHANGELOG section.
 *     3. Confirm           — show preview, ask once (skippable with --yes;
 *                            `--ci` always needs --yes — CI has no terminal).
 *     4. Branch + bump     — create `release/X.Y.Z`, update package.json,
 *                            .claude-plugin/marketplace.json, CHANGELOG.md,
 *                            then run `task release-prepare` so pack
 *                            manifests and tool projections pick up the
 *                            new version (otherwise the PR's own consistency
 *                            check fails — see PR #226 post-mortem).
 *     5. Commit + push     — `release: X.Y.Z`, push branch, open PR.
 *     6. Wait for CI       — `gh pr checks --watch` (skippable with --no-wait).
 *     7. Merge             — `gh pr merge --merge --delete-branch`.
 *     8. Tag main          — fast-forward main, tag the merge commit, push
 *                            the tag (triggers publish-npm.yml — except
 *                            under `--ci`, see step 9).
 *     9. GitHub Release     — `gh release create X.Y.Z --notes <changelog>`;
 *                            under `--ci`, also dispatches
 *                            release-guard.yml + publish-npm.yml +
 *                            cloud-release.yml explicitly.
 *
 * Idempotency: pass `--resume` to recover from a partial failure. Each
 * step then probes existing state (branch, commit, PR, tag, GitHub
 * Release) and skips work that is already done, instead of erroring out.
 * Without `--resume` the pipeline still mutates git/network state, so
 * re-running on a dirty tree needs `--resume` (or a manual cleanup). The
 * two entry points guard against colliding with each other via these same
 * probes plus the CI workflow's concurrency group — whichever starts
 * second sees the other's in-progress state and skips or refuses cleanly.
 * Each step prints what it's about to do before doing it, so a crash
 * leaves a recoverable trail.
 *
 * Stdlib-only (Python 3.10+). No third-party runtime dependencies.
 *
 * See also:
 *     - docs/contracts/release-pr-gating.md — release-PR shape, cut surface,
 *       kept surface, fail-closed contract.
 *     - docs/contracts/branch-protection-policy.md — per-PR-shape
 *       required-check matrix; `task ci:required-checks` previews it.
 *     - docs/contracts/ci-cost-budget.md — measured baselines + quarterly
 *       review cadence.
 *     - .github/workflows/release-validation.yml — the tight release-PR
 *       validation jobs (release-shape, changelog-entry, version-consistency).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `die(msg, code=2)` mirrors Python's `print(error) + sys.exit(code)`: it
 *   prints `error: {msg}` to stderr then throws a `SystemExitError(code)`
 *   sentinel caught at the CLI entry guard, which sets `process.exitCode`. We
 *   never call `process.exit()` (per the migration contract).
 * - argparse usage errors (unknown flag, bad `--as` choice) throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)` after printing
 *   usage. The argparse `--help` BODY (per-flag descriptions) is a documented
 *   divergence — argparse re-wraps it to the live terminal width; the tests
 *   assert the `usage:` token + exit code, not the body prose.
 * - JSON byte-parity: `set_package_version` uses `json.dumps(data, indent=4)`,
 *   `set_marketplace_version` uses `json.dumps(data, indent=2)`, both `+ "\n"`.
 *   release.py does NOT pass `ensure_ascii`, so CPython defaults to True
 *   (ASCII-escaped non-ASCII). The reused `jsonDumpsIndent` helper (mirrored
 *   from install.ts) is the `ensure_ascii=False` variant. The package's
 *   package.json / marketplace.json are pure-ASCII, so the two are
 *   byte-identical in practice; if a non-ASCII string ever lands in those
 *   files this would diverge (release.py would `\uXXXX`-escape, this twin
 *   would emit the raw codepoint). Documented, not fixed.
 * - subprocess → `spawnSync` with identical argv/cwd/env. `run()` mirrors
 *   `subprocess.run(check, cwd=cwd or REPO_ROOT, text=True, capture_output)`.
 *   On `check && capture && non-zero` → `die("command failed (...)")`. On
 *   `check && !capture && non-zero` → throw `CalledProcessError` (NOT caught
 *   by the entry guard, so it propagates — matches Python letting it raise).
 *   `_count_tests_current` catches FileNotFoundError / TimeoutExpired →
 *   modelled via `res.error` (ENOENT) and the `timeout` option.
 * - `time.sleep(5)` in `watch_pr_checks` ports faithfully (blocking). It is
 *   never reached on any test path (tests never call execute()).
 * - `_date.today().isoformat()` → a `YYYY-MM-DD` local-date helper.
 * - `_lib.changelog_eras` imports resolve to the `.ts` twin, never a `.py`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
    SplitPlan} from './_lib/changelog_eras.js';
import {
    CURRENT_ERA_BODY_CAP,
    current_era_accumulated_body_size,
    current_era_body_size,
    current_era_insertion_point,
    perform_split,
    plan_split,
} from './_lib/changelog_eras.js';
import {
    HEAD_LABELS,
    type MixObligation,
    collect_span_commits,
    derive_category_hits,
    render_derived_head_values,
} from './_lib/release_highlights.js';
import {
    NEXT_SECTION_RE,
    RELEASE_HEAD_DEFAULT,
    extract_changelog_section,
    pr_body_from_section,
    release_notes_from_section,
    render_mix_response,
} from './_lib/release_material.js';

// `__doc__.splitlines()[0]` in `_parse_args` — the argparse description. Kept
// as a referenceable constant so the first docstring line is preserved exactly.
const MODULE_DOC_FIRST_LINE = 'End-to-end release automation for `event4u/agent-config`.';

const _HERE = fileURLToPath(import.meta.url);


import {
    ArgparseExit,
    AUGMENT_MARKETPLACE_JSON,
    AUGMENT_PLUGIN_JSON,
    CHANGELOG,
    _set_changelog_reader,
    read_changelog_text,
    CalledProcessError,
    GH_PR_BODY_LIMIT,
    GH_RELEASE_NOTES_LIMIT,
    MAIN_BRANCH,
    MARKETPLACE_JSON,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    PROJECT_TEMPLATE,
    REMOTE,
    REPO_ROOT,
    REPO_SLUG,
    SystemExitError,
    set_augment_manifest_version,
    set_marketplace_version,
    _rstrip,
    _splitlines,
} from './release_env.js';
import type { RunResult } from './release_publication.js';
// Re-export surface for the six names tests import from `release.js` and that
// moved into the publication unit. `export ... from` rather than a bare import,
// because these are not USED here — an unused import would be dropped and the
// test import path would break silently.
export {
    _TEST_LIST_MAX_BUFFER,
    _count_from_list_result,
    _count_tests_current,
    _previous_test_count_from_changelog,
    _render_test_trend_line,
    _failed_check_names,
    _failed_checks_report,
    _is_non_fast_forward,
    _is_tag_already_exists,
    _no_checks_action,
    _required_contexts_from_rules,
} from './release_publication.js';
import { _cap_body, jsonDumpsIndent, reEscape } from './release_env.js';
import {
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
    create_and_push_annotated_tag,
    guard_publication,
    checkout_release_branch,
    _render_test_trend_line,
    guard_release_curation,
    local_release_gate_argv,
    measure_mix_obligation,
    die,
    gh,
    git,
    have,
    merge_release_pr,
    push_release_branch,
    run,
    watch_pr_checks,
} from './release_publication.js';

// The pre-existing `export {...}` block at the end of this file already carries
// every moved public name, so re-exporting them here would be a duplicate
// identifier rather than a second surface — the import above is what makes the
// existing block resolve. This is the whole of step 1.1's "re-export shape that
// keeps callers unaffected": no caller and no test import path changes.


// ---------------------------------------------------------------------------
// Parity helpers — code-point length, comma grouping, regex escape, JSON
// ---------------------------------------------------------------------------


/** `_date.today().isoformat()` — local date as `YYYY-MM-DD`. */
function todayIso(now?: Date): string {
    const d = now ?? new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// _cap_body (release.py:87-101)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// SECTIONS + commit regexes (release.py:103-120)
// ---------------------------------------------------------------------------

// Conventional Commit types and how they map into CHANGELOG sections.
// Order in this tuple determines order in the rendered entry.
const SECTIONS: ReadonlyArray<readonly [string, string | null, readonly string[]]> = [
    ['Features', 'minor', ['feat']],
    ['Bug Fixes', 'patch', ['fix']],
    ['Performance', 'patch', ['perf']],
    ['Reverts', 'patch', ['revert']],
    ['Documentation', null, ['docs']],
    ['Refactoring', null, ['refactor']],
    ['Tests', null, ['test']],
    ['Build', null, ['build']],
    ['CI', null, ['ci']],
    ['Chores', null, ['chore']],
];

// ---------------------------------------------------------------------------
// Curated head (road-to-release-shape-honesty Phase 2)
// ---------------------------------------------------------------------------

/**
 * The five head lines, in the order an operator reads them.
 *
 * Reviewers of 9.9.0 and 9.10.0 repeatedly could not tell, from a generated
 * commit log, which entries change consumer behaviour, which need migration,
 * which are internal gate repairs, and which ended as nulls. The log is a
 * faithful record of *what was committed*; it is not a statement of *what
 * changed for you*. The head is that statement, and it sits above the log
 * rather than replacing it.
 *
 * Wording is taken from `docs/RELEASE_STORY_TEMPLATE.md` rather than invented,
 * so the package does not end up with two competing definitions of a curated
 * head.
 */
const RELEASE_HEAD_SECTIONS: ReadonlyArray<string> = HEAD_LABELS;

/**
 * Cap on the head, in rendered lines.
 *
 * Roughly ten operator-relevant lines: past that it stops being a summary and
 * becomes a second changelog. The era budget is also finite
 * (`_lib/changelog_eras.ts`, 250 lines per era), so an unbounded head would
 * quietly consume it.
 */
export { RELEASE_HEAD_CAP_LINES } from './_lib/release_material.js';

/**
 * Pre-fill values for the curated head from the release span.
 *
 * Best-effort by design, same stance as the test-trend footer: a git failure
 * degrades to the `_none_` skeleton rather than blocking a release. The gate
 * that reads the result runs later, on the branch head, and derives from the
 * same shared classifier — so a degraded run surfaces as the gate's ordinary
 * "fill the head" message instead of a crash mid-release.
 */
function _derive_head_prefill(prev: string | null): Record<string, string> {
    try {
        const span = collect_span_commits(prev, 'HEAD', REPO_ROOT);
        return render_derived_head_values(derive_category_hits(span));
    } catch (err) {
        process.stderr.write(
            `warning: could not derive release-head highlights (${(err as Error).message}); ` +
                'the head ships as the `_none_` skeleton\n',
        );
        return {};
    }
}

/**
 * Render the curated head. Emitted by the generator on every release so it
 * cannot be forgotten; edited by the maintainer before merge.
 *
 * **The authoring instruction is NOT emitted here** (2026-09-01, roadmap
 * `road-to-publication-integrity-hard-fail` § Phase 2, Option A). This writer
 * used to append `CURATED_HEAD_INSTRUCTION`, nothing removed it at release
 * time, and it published twice in `package/CHANGELOG.md`. The reminder now
 * rides in the release-PR body's PR-only region — never published — see
 * `pr_body_from_section` in `_lib/release_material.ts`.
 */
export function render_release_head(
    filled: Readonly<Record<string, string>> = {},
): string[] {
    const lines: string[] = ['### Release highlights', ''];
    for (const label of RELEASE_HEAD_SECTIONS) {
        const value = (filled[label] ?? '').trim();
        lines.push(`- **${label}:** ${value === '' ? RELEASE_HEAD_DEFAULT : value}`);
    }
    return lines;
}

/**
 * Drop commits whose rendered line would be identical.
 *
 * The generated log is keyed by SHA, but a reader is not: a cherry-pick, a
 * re-land, or one change split across branches produces the same
 * `scope: subject` twice with different SHAs, and the notes then say the same
 * thing twice with two links. Keyed on `type + scope + subject` — the parts
 * that reach the rendered line — keeping the first occurrence, so the earliest
 * SHA stays the citation.
 *
 * Breaking commits are never folded into a non-breaking twin: `!` changes what
 * the line *means*, and collapsing them would hide a breaking change behind a
 * routine one.
 */
export function dedupe_commit_lines(commits: readonly Commit[]): Commit[] {
    const seen = new Set<string>();
    const out: Commit[] = [];
    for (const c of commits) {
        const key = [c.breaking ? '!' : '', c.type, c.scope ?? '', c.subject].join('\x1f');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(c);
    }
    return out;
}

/** Rendered length of the head, for the cap assertion. */
export function release_head_line_count(head: readonly string[]): number {
    // The HTML comment is invisible to a reader, so it does not count against
    // an operator-facing cap.
    return head.filter((l) => !l.trimStart().startsWith('<!--')).length;
}

const BREAKING_RE = /^([a-z]+)(\([^)]+\))?!:/;
const CONVENTIONAL_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<subject>.+)$/;

// ─── dataclasses ──────────────────────────────────────────────────────────────

/** `@dataclass(frozen=True) class Commit`. */
class Commit {
    constructor(
        public readonly sha: string,
        public readonly type: string,
        public readonly scope: string | null,
        public readonly subject: string,
        public readonly breaking: boolean,
    ) {}
}

/** `@dataclass(frozen=True) class Plan`. */
class Plan {
    constructor(
        public readonly current: string,
        public readonly target: string,
        public readonly bump: string, // "major" | "minor" | "patch"
        public readonly commits: readonly Commit[],
        public readonly last_tag: string | null,
        public readonly changelog_body: string, // rendered body (without the heading)
        public readonly changelog_entry: string, // full entry including heading, for CHANGELOG.md
        // Populated only when the release crosses an era boundary AND the
        // current era body has grown past CURRENT_ERA_BODY_CAP. null for
        // patch releases and for minor/major bumps where the era still fits.
        public readonly split_plan: SplitPlan | null = null,
    ) {}
}

// ─── utilities ────────────────────────────────────────────────────────────────

// ─── version math ─────────────────────────────────────────────────────────────

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parse_version(s: string): [number, number, number] {
    const m = SEMVER_RE.exec(s.trim());
    if (!m) {
        // {s!r} → Python repr of a str (single-quoted).
        die(`not a bare semver (X.Y.Z): '${s}'`);
    }
    return [
        Number.parseInt(m[1] as string, 10),
        Number.parseInt(m[2] as string, 10),
        Number.parseInt(m[3] as string, 10),
    ];
}

function bump_version(current: string, kind: string): string {
    const [major, minor, patch] = parse_version(current);
    if (kind === 'major') {
        return `${major + 1}.0.0`;
    }
    if (kind === 'minor') {
        return `${major}.${minor + 1}.0`;
    }
    if (kind === 'patch') {
        return `${major}.${minor}.${patch + 1}`;
    }
    die(`unknown bump kind: ${kind}`);
    return ''; // unreachable
}

// ─── commit parsing + changelog rendering ────────────────────────────────────

/** Return non-merge commits after `tag` (or all of history if tag is null). */
function commits_since(tag: string | null): Commit[] {
    const rev = tag ? `${tag}..HEAD` : 'HEAD';
    const raw = git(['log', rev, '--no-merges', '--format=%H%x1f%s'], { capture: true });
    const out: Commit[] = [];
    for (const line of raw.split('\n')) {
        if (!line.includes('\x1f')) {
            continue;
        }
        // str.split("\x1f", 1) — maxsplit=1: head + remainder.
        const idx = line.indexOf('\x1f');
        const sha = line.slice(0, idx);
        const subject = line.slice(idx + 1);
        const m = CONVENTIONAL_RE.exec(subject);
        if (!m) {
            out.push(new Commit(sha, 'other', null, subject, false));
            continue;
        }
        const breaking = Boolean(m.groups!['bang']) || subject.includes('BREAKING CHANGE');
        out.push(
            new Commit(
                sha,
                m.groups!['type'] as string,
                (m.groups!['scope'] ?? null) as string | null,
                m.groups!['subject'] as string,
                breaking,
            ),
        );
    }
    return out;
}

/** Derive the semver bump from commit types (for preview only). */
function infer_bump(commits: readonly Commit[]): string {
    if (commits.some((c) => c.breaking)) {
        return 'major';
    }
    for (const [, level, types] of SECTIONS) {
        if (level === 'minor' && commits.some((c) => types.includes(c.type))) {
            return 'minor';
        }
    }
    return 'patch';
}

function latest_tag(): string | null {
    const r = run(
        [
            'git',
            'describe',
            '--tags',
            '--abbrev=0',
            '--match',
            '[0-9]*.[0-9]*.[0-9]*',
        ],
        { check: false, capture: true },
    );
    const tag = r.stdout.trim();
    return tag || null;
}

/**
 * Return [heading-aware full entry, body-only for GitHub Release notes].
 *
 * `test_trend_line` — optional pre-computed `Tests: N (+M …)` footer
 * (road-to-feedback-followups P3.2). Computed by the caller so tests don't
 * trigger a recursive vitest collection.
 */
function render_changelog_entry(
    version: string,
    prev: string | null,
    commits: readonly Commit[],
    today: string,
    opts: {
        test_trend_line?: string | null;
        head?: Readonly<Record<string, string>>;
        mix?: MixObligation | null;
    } = {},
): [string, string] {
    const test_trend_line = opts.test_trend_line ?? null;
    let heading: string;
    if (prev) {
        heading =
            `## [${version}](https://github.com/${REPO_SLUG}/compare/` +
            `${prev}...${version}) (${today})`;
    } else {
        heading = `## ${version} (${today})`;
    }

    // Group by section; commits of unknown type drop into "Other".
    const grouped: Record<string, Commit[]> = {};
    for (const [label] of SECTIONS) {
        grouped[label] = [];
    }
    grouped['BREAKING CHANGES'] = [];
    const other: Commit[] = [];
    for (const c of dedupe_commit_lines(commits)) {
        if (c.breaking) {
            grouped['BREAKING CHANGES']!.push(c);
            continue;
        }
        let placed = false;
        for (const [label, , types] of SECTIONS) {
            if (types.includes(c.type)) {
                grouped[label]!.push(c);
                placed = true;
                break;
            }
        }
        if (!placed) {
            other.push(c);
        }
    }

    // The curated head sits above the generated log, which stays unchanged.
    const body_lines: string[] = [...render_release_head(opts.head ?? {})];
    // Under the head and outside it — rationale on `MIX_RESPONSE_PLACEHOLDER`.
    if (opts.mix?.triggered) {
        body_lines.push('');
        body_lines.push(...render_mix_response(opts.mix.level));
    }
    const ordered_labels = ['BREAKING CHANGES', ...SECTIONS.map(([label]) => label)];
    for (const label of ordered_labels) {
        const bucket = grouped[label] ?? [];
        if (bucket.length === 0) {
            continue;
        }
        body_lines.push('');
        body_lines.push(`### ${label}`);
        body_lines.push('');
        for (const c of bucket) {
            body_lines.push(_changelog_line(c));
        }
    }
    if (other.length > 0) {
        body_lines.push('');
        body_lines.push('### Other');
        body_lines.push('');
        for (const c of other) {
            body_lines.push(_changelog_line(c));
        }
    }

    // Test-count trend footer (road-to-feedback-followups P3.2). Silent on
    // errors — never a release blocker.
    if (test_trend_line) {
        body_lines.push('');
        body_lines.push(test_trend_line);
    }

    // "\n".join(...).lstrip("\n") — strip only leading newlines.
    const body = body_lines.join('\n').replace(/^\n+/u, '');
    const full = heading + '\n\n' + body + '\n';
    return [full, body];
}

function _changelog_line(c: Commit): string {
    const scope = c.scope ? `**${c.scope}:** ` : '';
    const short = c.sha.slice(0, 7);
    const link = `https://github.com/${REPO_SLUG}/commit/${c.sha}`;
    return `* ${scope}${c.subject} ([${short}](${link}))`;
}

/**
 * Insert `entry` inside the current era block.
 *
 * Strategy delegates to `current_era_insertion_point` so a fresh era (no
 * version headings yet, just the intro blockquote) places the new entry after
 * the intro instead of appended at end-of-file. When no current era header
 * exists, falls back to the legacy "above the most recent ## [" heuristic for
 * safety.
 */
function prepend_changelog(p: string, entry: string): void {
    const text = fs.readFileSync(p, 'utf-8');
    const lines = _splitlines(text);
    const insert_at = current_era_insertion_point(lines);
    if (insert_at !== null) {
        const before = lines.slice(0, insert_at).join('\n');
        const after = lines.slice(insert_at).join('\n');
        const head = before + (before ? '\n' : '');
        fs.writeFileSync(p, head + entry + '\n' + after + '\n', 'utf-8');
        return;
    }

    // Legacy fallback — no era header present at all.
    const marker_re = /^## \[?\d+\.\d+\.\d+/m;
    const m = marker_re.exec(text);
    if (!m) {
        fs.writeFileSync(p, _rstrip(text) + '\n\n' + entry, 'utf-8');
        return;
    }
    const before = text.slice(0, m.index);
    const after = text.slice(m.index);
    fs.writeFileSync(p, before + entry + '\n' + after, 'utf-8');
}

/** Mirror of Python `str.splitlines()` (no trailing empty for a final newline). */
// ─── file mutations ───────────────────────────────────────────────────────────

/** Update the top-level `version` field; preserve 4-space indentation. */
function set_package_version(p: string, version: string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    data['version'] = version;
    fs.writeFileSync(p, jsonDumpsIndent(data, 4) + '\n', 'utf-8');
}

/**
 * Update BOTH version fields npm keeps in a lockfile — the top-level one and
 * the root package entry (`packages[""]`).
 *
 * The bump previously touched package.json and left the lock behind, so every
 * release shipped a `main` whose two files disagreed and every subsequent
 * local `npm install` produced a spurious modification (measured 2026-08-02:
 * package.json 9.13.0 vs package-lock.json 9.12.0). Rewriting the two fields
 * rather than shelling out to `npm install --package-lock-only` keeps the bump
 * offline and cannot re-resolve a dependency mid-release.
 * road-to-gates-that-can-fail Phase 5.
 */
function set_lockfile_version(p: string, version: string): void {
    if (!fs.existsSync(p)) {
        return;
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    data['version'] = version;
    const packages = data['packages'];
    if (typeof packages === 'object' && packages !== null && !Array.isArray(packages)) {
        const root = (packages as Record<string, unknown>)[''];
        if (typeof root === 'object' && root !== null && !Array.isArray(root)) {
            (root as Record<string, unknown>)['version'] = version;
        }
    }
    fs.writeFileSync(p, jsonDumpsIndent(data, 4) + '\n', 'utf-8');
}

function set_template_pin(p: string, version: string): void {
    // Rewrite the single `agent_config_version:` line in place, preserving the
    // rest of the YAML byte-for-byte. Quoted value to match the existing pin
    // style and check_template_pin_drift's tolerant parse.
    const text = fs.readFileSync(p, 'utf-8');
    const lines = text.split('\n');
    let found = false;
    for (let i = 0; i < lines.length; i += 1) {
        if (/^\s*agent_config_version\s*:/.test(lines[i]!)) {
            lines[i] = lines[i]!.replace(
                /^(\s*agent_config_version\s*:\s*).*/,
                `$1"${version}"`,
            );
            found = true;
            break;
        }
    }
    if (!found) {
        die(`set_template_pin: no \`agent_config_version:\` line in ${p}`);
    }
    fs.writeFileSync(p, lines.join('\n'), 'utf-8');
}

/**
 * Refuse a MAJOR cut that carries a scheduled deprecation due at or before it.
 *
 * **The trigger is the shape of the TARGET, not a comparison with the current
 * version.** A major target is `X.0.0` — and that one predicate covers every
 * path to a major: the `--as major` flag, an explicit `--version 13.0.0`,
 * auto-detection from a `feat!:` commit, AND `--resume`, where
 * `_detect_in_flight_target()` returns the already-bumped `package.json`
 * version so `target === current` and any current-vs-target comparison
 * silently returns. Resume was the fourth path an earlier version of this
 * guard missed while its own comment claimed three paths converged.
 *
 * Refusing a resumed release can strand a partially-completed one, and that is
 * the deliberate trade: a stranded release is recoverable by fixing the table
 * and resuming again, whereas a major shipped over a missed commitment is the
 * failure this whole surface exists to prevent.
 *
 * The target version is PASSED to the gate. Without it the gate falls back to
 * `package.json`, which at the cut to N still reads N-1 — so a row committed
 * to N reads as one major early and passes, and only rows already a major late
 * could ever be refused. That is the lateness being prevented, so measuring
 * against the shipped version would have made the refusal fire exactly one
 * major too late, forever.
 *
 * Runs under `--dry-run` too, unlike the rest of preflight: this check is one
 * subprocess reading two files, so the "keep a preview fast" rationale that
 * excludes the ~15s test-trend collection does not apply — and a preview that
 * reports green for the single condition that will refuse the real run is the
 * case an operator runs a preview to discover. It REPORTS there rather than
 * dying: `--dry-run` exiting 0 before `execute()` and before `preflight()` is a
 * contract this file's own tests assert, and an earlier revision of this guard
 * broke it by sitting above the dry-run branch with no preview mode.
 *
 * @param runner Seam for the gate invocation. Production passes nothing and
 * gets the real `run`; tests inject a stub, because the alternative — reaching
 * this branch only by mutating `docs/MIGRATION.md` — would make the refusal
 * path testable exclusively through a tracked-file edit.
 */
export function assert_scheduled_deprecations_clear(
    target: string,
    runner: (args: readonly string[]) => RunResult = (args) => run(args, { check: false, capture: true }),
    opts: { previewOnly?: boolean } = {},
): void {
    const [, minor, patch] = parse_version(target);
    if (minor !== 0 || patch !== 0) {
        return;
    }
    const res = runner([
        './scripts-run',
        'src/scripts/lint_scheduled_deprecations',
        '--cutting',
        target,
    ]);
    if (res.returncode === 0) {
        return;
    }
    process.stderr.write(res.stdout);
    process.stderr.write(res.stderr);
    if (res.returncode !== 1) {
        // The gate reserves 1 for a finding and 2 for a usage/environment
        // failure. Diagnosing the latter as "the table has an overdue row"
        // sends the releaser to edit a file that is not the problem.
        die(
            `refusing the ${target} cut: the scheduled-deprecations check could not run ` +
                `(exit ${String(res.returncode)}). That is an environment or usage failure, not a ` +
                'finding in docs/MIGRATION.md — fix the invocation or the checkout, then re-run.',
        );
    }
    if (opts.previewOnly === true) {
        // The preview's job is to SHOW what the real run will refuse. Dying
        // here would break the `--dry-run exits 0` contract asserted elsewhere
        // in this file's tests — trading a documented exit code for a message
        // that has already been printed above.
        process.stderr.write(
            `\n(dry-run) the ${target} cut WOULD BE REFUSED for the reason above. ` +
                'Previewing only; exit code unchanged.\n',
        );
        return;
    }
    die(
        `refusing the ${target} cut: the scheduled-deprecations table in docs/MIGRATION.md ` +
            'has a row due at or before this major, or one that cannot be resolved. Act on ' +
            "it — perform the removal in its own change, or revise the row's commitment and " +
            'record why the surface stays — then re-run.',
    );
}

// ─── preflight ────────────────────────────────────────────────────────────────

/**
 * Fail fast on conditions that would break the release mid-flight.
 *
 * In `--resume` mode two invariants are relaxed:
 *
 * - The starting branch may be `release/{target}` in addition to `main` —
 *   both are valid resume positions (mid-pipeline crash after step 1 leaves
 *   you on the release branch).
 * - The target-tag-exists check is dropped — execute() probes for existing
 *   tags/releases and skips them.
 *
 * Tree cleanliness, gh auth, and `main` in-sync with origin are still
 * enforced, so resuming has the same starting posture as a fresh run; only
 * step-level outcomes differ.
 *
 * `opts.ci` swaps the gh-auth probe (see below) for the CI-mode variant —
 * everything else is identical between the two entry points.
 */
function preflight(target: string, opts: { resume?: boolean; ci?: boolean } = {}): void {
    const resume = opts.resume ?? false;
    const ci = opts.ci ?? false;
    for (const b of ['git', 'gh']) {
        if (!have(b)) {
            die(`'${b}' not found on PATH`);
        }
    }

    // Probe the active token directly via an authenticated API call. `gh auth
    // status` returns non-zero if *any* account in the keyring is broken, even
    // when the active one is fine — so we'd rather ask "does the token the
    // release will actually use work?" than parse multi-account status output.
    //
    // `--ci` runs under the GitHub Actions default GITHUB_TOKEN, which is an
    // installation token, not a user token — `gh api user` returns 403
    // ("Resource not accessible by integration") for it even when the token
    // is perfectly valid for everything the release actually needs (repo
    // read/write). Probe repo access instead, which the token always has.
    const authCmd = ci
        ? ['gh', 'api', `repos/${REPO_SLUG}`, '--jq', '.id']
        : ['gh', 'api', 'user', '--jq', '.login'];
    const r = run(authCmd, { check: false, capture: true });
    if (r.returncode !== 0) {
        die(
            ci
                ? 'gh is not authenticated for this repo (GITHUB_TOKEN missing or invalid)'
                : 'gh is not authenticated; run `gh auth login` first',
        );
    }

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
    const release_branch = `release/${target}`;
    const allowed = resume ? new Set([MAIN_BRANCH, release_branch]) : new Set([MAIN_BRANCH]);
    if (!allowed.has(branch)) {
        if (resume) {
            die(
                `resume must run from '${MAIN_BRANCH}' or '${release_branch}', ` +
                    `currently on '${branch}'`,
            );
        }
        die(`release must run from '${MAIN_BRANCH}', currently on '${branch}'`);
    }

    const porcelain = git(['status', '--porcelain'], { capture: true });
    if (porcelain) {
        die('working tree is not clean; commit or stash first');
    }

    // --force lets the remote's tag positions win over stale local tags.
    // The release consumes the remote view as source of truth, and we're
    // about to create a new tag anyway — local drift (e.g. from renamed
    // release-please tags) should not block the fetch.
    run(['git', 'fetch', REMOTE, '--tags', '--prune', '--force'], { capture: true });

    // The local-in-sync-with-origin check only applies to main; if we're
    // already on the release branch in resume mode, the relevant invariant
    // is "main hasn't moved beyond what release/X.Y.Z branched off", which
    // `git pull --ff-only` enforces in step 8 anyway.
    if (branch === MAIN_BRANCH) {
        const local = git(['rev-parse', 'HEAD'], { capture: true });
        const remote = git(['rev-parse', `${REMOTE}/${MAIN_BRANCH}`], { capture: true });
        if (local !== remote) {
            die(
                `local ${MAIN_BRANCH} is not in sync with ` +
                    `${REMOTE}/${MAIN_BRANCH}; pull or push first`,
            );
        }
    }

    if (!resume) {
        const tags = git(['tag', '-l', target], { capture: true }).split('\n');
        if (tags.includes(target)) {
            die(`tag '${target}' already exists; nothing to release`);
        }
    }
}

// ─── plan ─────────────────────────────────────────────────────────────────────

function print_preview(plan: Plan): void {
    process.stdout.write('\n');
    process.stdout.write('═'.repeat(72) + '\n');
    process.stdout.write(`  Release preview — ${plan.current} → ${plan.target} (${plan.bump})\n`);
    process.stdout.write('═'.repeat(72) + '\n');
    process.stdout.write('\n');
    process.stdout.write(`Previous tag:   ${plan.last_tag || '(none)'}\n`);
    process.stdout.write(`New tag:        ${plan.target}\n`);
    process.stdout.write(`Commits:        ${plan.commits.length} since ${plan.last_tag || 'start'}\n`);
    const detected = plan.commits.length > 0 ? infer_bump(plan.commits) : 'patch';
    if (detected !== plan.bump) {
        process.stdout.write(
            `NOTE:           commits suggest a '${detected}' bump, ` +
                `you picked '${plan.bump}'\n`,
        );
    }
    process.stdout.write('\n');
    process.stdout.write('Files to change:\n');
    process.stdout.write(`  · ${path.relative(REPO_ROOT, PACKAGE_JSON)}\n`);
    process.stdout.write(`  · ${path.relative(REPO_ROOT, MARKETPLACE_JSON)}\n`);
    process.stdout.write(`  · ${path.relative(REPO_ROOT, PROJECT_TEMPLATE)}\n`);
    process.stdout.write(`  · ${path.relative(REPO_ROOT, CHANGELOG)}\n`);
    process.stdout.write('  · regenerated derived files via `task release-prepare`\n');
    process.stdout.write(
        '    (src/packs/*/pack.yaml + README.md, dist/agent-src/, tool projections)\n',
    );
    if (plan.split_plan !== null) {
        const sp = plan.split_plan;
        process.stdout.write('\n');
        process.stdout.write('Era split (separate commit, before release commit):\n');
        process.stdout.write(`  · archive   → ${path.relative(REPO_ROOT, sp.archive_path)}\n`);
        process.stdout.write(`  · old era   → pre-${sp.boundary} (archived pointer)\n`);
        process.stdout.write(`  · new era   → ${sp.new_era_label} — current (empty body)\n`);
        process.stdout.write(`  · subject   → ${sp.commit_subject}\n`);
    }
    process.stdout.write('\n');
    process.stdout.write('Changelog section:\n');
    process.stdout.write('─'.repeat(72) + '\n');
    process.stdout.write(_rstrip(plan.changelog_entry) + '\n');
    process.stdout.write('─'.repeat(72) + '\n');
    process.stdout.write('\n');
    process.stdout.write('Release-PR CI shape (docs/contracts/release-pr-gating.md):\n');
    process.stdout.write(
        '  will run: Consistency · Smoke Contracts · Migration Dry-Run · ' +
            'Release Validation · Release Guard (post-tag, ~30 s)\n',
    );
    process.stdout.write(
        '  will skip: Tests (install / aux / python / node / windows-lockfile-export) · ' +
            'Public Install Smoke — heavy install matrices cannot be regressed by a release-shape diff\n',
    );
    process.stdout.write('\n');
}

function confirm(prompt: string): boolean | null {
    const ans = _input(`${prompt} [y/N] `);
    if (ans === null) return null; // no usable controlling terminal
    const norm = ans.trim().toLowerCase();
    return norm === 'y' || norm === 'yes';
}

/** Can we prompt at all — is fd 0 a TTY, or is a controlling terminal openable? */
function _canPrompt(): boolean {
    if (process.env.CI) return false; // CI is non-interactive by contract → require --yes
    if (process.stdin.isTTY) return true;
    try {
        const fd = fs.openSync('/dev/tty', 'r');
        fs.closeSync(fd);
        return true;
    } catch {
        return false;
    }
}

/**
 * Mirror of Python `input(prompt)` — write the prompt, read one line from the
 * controlling terminal. Returns `null` when no terminal is reachable.
 *
 * The answer is ALWAYS read from a freshly opened, blocking `/dev/tty`
 * (`openSync(..., 'rs')`), NEVER from fd 0. `task release` / `./scripts-run`
 * run this under go-task's `interactive: true`, which leaves fd 0 a TTY
 * (`process.stdin.isTTY === true`) but one Node treats as NON-blocking — so a
 * bare `readSync(0)` throws `EAGAIN`, the catch swallows it, and the `[y/N]`
 * prompt "auto-aborts" without ever waiting (the exact failure this fixes;
 * reproduced with `isTTY === true`). A fresh blocking `/dev/tty` descriptor
 * blocks for real input regardless of how the script was invoked — the proven
 * synchronous-prompt pattern.
 */
function _input(prompt: string): string | null {
    process.stdout.write(prompt);
    let fd: number;
    try {
        // 'rs' → O_RDONLY | O_SYNC: a fresh, blocking descriptor on the
        // controlling terminal, unaffected by Node's non-blocking fd 0.
        fd = fs.openSync('/dev/tty', 'rs');
    } catch {
        return null; // no controlling terminal (true non-interactive)
    }
    try {
        const buf = Buffer.alloc(1);
        const chars: number[] = [];
        for (;;) {
            let bytesRead: number;
            try {
                bytesRead = fs.readSync(fd, buf, 0, 1, null);
            } catch (e) {
                const code = (e as NodeJS.ErrnoException).code;
                // A blocking /dev/tty should not yield these, but inherited
                // descriptor flags can — retry rather than abort the prompt.
                if (code === 'EAGAIN' || code === 'EINTR') continue;
                break; // EOF / EIO → EOFError analogue; return what we have.
            }
            if (bytesRead === 0) break;
            const b = buf[0] as number;
            if (b === 0x0a) break; // newline terminates the line (stripped, like input()).
            chars.push(b);
        }
        return Buffer.from(chars).toString('utf-8');
    } finally {
        fs.closeSync(fd);
    }
}

export interface ConfirmVerdict {
    proceed: boolean;
    /** Message to surface when not proceeding (no trailing newline). */
    message?: string;
    stream?: 'stdout' | 'stderr';
}

/**
 * Resolve the pre-execute confirmation as a pure verdict (no I/O, so it is
 * unit-testable). `--yes` proceeds unprompted; otherwise a terminal must be
 * available — when none is (CI, detached stdin) we surface actionable `--yes`
 * guidance instead of silently aborting; with a terminal, the user must answer
 * `y`. The caller performs the I/O + the `return 1`.
 */
export function confirmGate(target: string, yes: boolean): ConfirmVerdict {
    if (yes) return { proceed: true };
    const noTerminal: ConfirmVerdict = {
        proceed: false,
        stream: 'stderr',
        message:
            'No terminal available for the [y/N] confirmation (non-interactive shell). ' +
            'Re-run with --yes to confirm, e.g. `task release -- --yes`.',
    };
    if (!_canPrompt()) return noTerminal;
    const answer = confirm(`Proceed with release ${target}?`);
    // null = the controlling terminal vanished between the probe and the read;
    // surface the actionable --yes guidance, never a bare silent "aborted.".
    if (answer === null) return noTerminal;
    if (!answer) return { proceed: false, stream: 'stdout', message: 'aborted.' };
    return { proceed: true };
}

// ─── orchestration ────────────────────────────────────────────────────────────

function _step(n: number, total: number, msg: string): void {
    process.stdout.write(`[${n}/${total}] ${msg}\n`);
}

function execute(
    plan: Plan,
    opts: { wait_for_checks: boolean; dry_run: boolean; resume?: boolean; ci?: boolean },
): void {
    const wait_for_checks = opts.wait_for_checks;
    const dry_run = opts.dry_run;
    const resume = opts.resume ?? false;
    const ci = opts.ci ?? false;

    const branch = `release/${plan.target}`;
    const total = 10;

    if (dry_run) {
        process.stdout.write('(dry-run) no git/gh mutations will be performed.\n');
        return;
    }

    // Probe the world once at the top so each step skip-decision is cheap.
    const pr_info = resume ? _pr_for_branch(branch) : null;
    const pr_state = pr_info ? pr_info['state'] : undefined;
    const pr_merged = pr_state === 'MERGED';

    // ─── 1. branch ──────────────────────────────────────────────────────────
    checkout_release_branch(branch, pr_merged, (m) => {
        _step(1, total, m);
    });

    // ─── 1b. era split (optional, separate commit) ─────────────────────────
    // Lands as `chore(changelog): split era ...` BEFORE the release commit
    // so the split is reviewable on its own and the release commit only
    // touches the bump + new entry. Idempotent: archive already on disk
    // OR a prior split commit on the branch is treated as already done.
    if (plan.split_plan !== null && !pr_merged) {
        const sp = plan.split_plan;
        const split_already_committed = git(['log', `${MAIN_BRANCH}..HEAD`, '--format=%s'], {
            capture: true,
        })
            .split('\n')
            .includes(sp.commit_subject);
        if (fs.existsSync(sp.archive_path) && split_already_committed) {
            _step(1, total, `Era split for pre-${sp.boundary} already committed — skip`);
        } else if (fs.existsSync(sp.archive_path) && !split_already_committed) {
            die(
                `era archive ${path.relative(REPO_ROOT, sp.archive_path)} exists ` +
                    'but no matching split commit found on this branch — inspect ' +
                    'manually before resuming',
            );
        } else {
            _step(
                1,
                total,
                `Split era ${sp.old_era_label} → pre-${sp.boundary} ` +
                    `(new era ${sp.new_era_label})`,
            );
            perform_split(sp);
            run(['git', 'add', '-A']);
            run(['git', 'commit', '-m', sp.commit_subject]);
        }
    }

    // ─── 2. file mutations ──────────────────────────────────────────────────
    if (pr_merged) {
        _step(2, total, 'PR already merged — skip file bumps');
    } else {
        const current_pkg = (
            JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>
        )['version'];
        if (resume && current_pkg === plan.target) {
            _step(2, total, `Files already at ${plan.target} — skip bump`);
        } else {
            _step(
                2,
                total,
                'Bump package.json + package-lock.json + marketplace manifests + template pin, prepend CHANGELOG',
            );
            set_package_version(PACKAGE_JSON, plan.target);
            set_lockfile_version(PACKAGE_LOCK_JSON, plan.target);
            set_marketplace_version(MARKETPLACE_JSON, plan.target);
            set_augment_manifest_version(AUGMENT_PLUGIN_JSON, plan.target);
            set_augment_manifest_version(AUGMENT_MARKETPLACE_JSON, plan.target);
            set_template_pin(PROJECT_TEMPLATE, plan.target);
            prepend_changelog(CHANGELOG, plan.changelog_entry);
        }

        // Regenerate derived files (pack manifests, dist/agent-src/, tool
        // projections) so the PR's own consistency check passes. Without
        // this the bump only lands in package.json + marketplace.json and
        // the Sync + Generate Tools Consistency gate fails on the release
        // PR itself — exactly the failure mode PR #226 hit. `task
        // release-prepare` is idempotent, so resume runs are safe.
        _step(2, total, 'Regenerate derived files (`task release-prepare`)');
        run(['task', 'release-prepare']);
    }

    guard_release_curation(plan.target, pr_merged);

    // ─── 3. commit ──────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(3, total, 'PR already merged — skip commit');
    } else {
        const last_msg = git(['log', '-1', '--format=%s'], { capture: true });
        const porcelain = git(['status', '--porcelain'], { capture: true });
        if (resume && last_msg === `release: ${plan.target}` && !porcelain) {
            _step(3, total, `Last commit already \`release: ${plan.target}\` and tree clean — skip`);
        } else {
            // `git add -A` stages the three primary bump files AND every
            // regenerated derived file (src/packs/*/pack.yaml + README.md,
            // dist/agent-src/, .augment/, tool projections). Listing them
            // explicitly would silently drift the moment a new generated
            // tree is added.
            run(['git', 'add', '-A']);
            // On resume the bump + era-split may already be committed (the
            // era-split lands its own commit, so `last_msg` above no longer
            // equals "release: X" and the skip guard misses). If nothing is
            // staged, the release content is already in history — skipping
            // beats failing `git commit` on an empty index.
            if (git(['diff', '--cached', '--name-only'], { capture: true }).trim()) {
                _step(3, total, `Commit \`release: ${plan.target}\``);
                run(['git', 'commit', '-m', `release: ${plan.target}`]);
            } else {
                _step(3, total, 'Release content already committed — skip empty commit');
            }
        }
    }

    // ─── 4. push ────────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(4, total, 'PR already merged — skip push');
    } else {
        // `git push -u` is naturally idempotent — it prints "Everything
        // up-to-date" when remote already matches. push_release_branch
        // additionally absorbs a remote that moved under us.
        _step(4, total, 'Verify release gates locally (`task release:verify -- --cheap`)');
        run(local_release_gate_argv());

        _step(4, total, `Push ${branch} to ${REMOTE}`);
        push_release_branch(branch);
    }

    // ─── 5. PR ──────────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(5, total, `PR #${pr_info!['number']} already merged — skip`);
    } else if (resume && pr_state === 'OPEN') {
        // One final source: a resumed run re-derives the body from the
        // branch-head CHANGELOG instead of leaving the plan-time snapshot —
        // this was the 9.14.0 test-count desync (resume re-rendered from a
        // later HEAD while the changelog kept the branch's entry).
        _step(5, total, `PR already open: ${pr_info!['url']} — refresh body from branch head`);
        _refresh_pr_body_from_head(branch, plan.target);
    } else {
        _step(5, total, 'Open pull request');
        // Derive the PR body from the CHANGELOG section step 2 just wrote —
        // the file is the single source; the in-memory plan is only its
        // author (release-truth Phase 1).
        const section = extract_changelog_section(read_changelog_text(), plan.target);
        if (!section) {
            die(`CHANGELOG.md carries no section for ${plan.target} — cannot derive PR body`);
        }
        const pr_changelog = _cap_body(
            section!.body,
            GH_PR_BODY_LIMIT - 200, // leave room for the prefix + footer
            '`CHANGELOG.md` in this PR',
        );
        const pr_body = pr_body_from_section(pr_changelog, plan.target);
        gh(['pr', 'create', '--base', MAIN_BRANCH, '--head', branch,
            '--title', `release: ${plan.target}`, '--body', pr_body]);
    }

    // ─── 6. wait for checks ─────────────────────────────────────────────────
    if (pr_merged) {
        _step(6, total, 'PR already merged — skip checks wait');
    } else if (wait_for_checks) {
        _step(6, total, 'Wait for PR checks');
        watch_pr_checks(branch);
    } else {
        _step(6, total, 'Skip waiting for checks (--no-wait)');
    }

    // ─── 7. merge ───────────────────────────────────────────────────────────
    if (pr_merged) {
        _step(7, total, `PR #${pr_info!['number']} already merged — skip`);
    } else {
        _step(7, total, 'Merge pull request (merge commit) and delete branch');
        merge_release_pr(branch, wait_for_checks);
    }

    // ─── 8. tag main + push tag ─────────────────────────────────────────────
    // Always idempotent — even outside resume mode this prevents a mid-flight
    // crash on step 9 from leaving a half-tagged release that subsequent
    // `task release` invocations can't recover from without `--resume`.
    if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== MAIN_BRANCH) {
        run(['git', 'checkout', MAIN_BRANCH]);
    }
    run(['git', 'pull', '--ff-only', REMOTE, MAIN_BRANCH]);

    if (_tag_exists_local(plan.target)) {
        if (_tag_exists_remote(plan.target)) {
            _step(8, total, `Tag ${plan.target} already on ${REMOTE} — skip`);
        } else {
            _step(8, total, `Tag ${plan.target} exists locally — push only`);
            guard_publication(plan.target, 'tag push (resumed)');
            _push_tag(plan.target);
        }
    } else {
        // Sequencing is load-bearing (release-truth Phase 1, council
        // 2026-08-03): merge FIRST (step 7), pull main (above), THEN derive
        // the tag message from the MERGED changelog — tagging before the
        // merge would read a section that does not exist yet. The annotated
        // tag replaces the previous lightweight one so tag metadata is a
        // fourth surface carrying the same single-source content.
        _step(8, total, `Tag merge commit (annotated, from merged CHANGELOG) and push ${plan.target}`);
        create_and_push_annotated_tag(plan.target);
    }

    // ─── 9. GitHub Release ──────────────────────────────────────────────────
    if (_release_exists(plan.target)) {
        _step(9, total, `GitHub Release ${plan.target} already exists — skip`);
    } else {
        _step(
            9,
            total,
            ci
                ? 'Create GitHub Release (tag push under GITHUB_TOKEN triggers nothing — dispatching next)'
                : 'Create GitHub Release (triggers publish-npm on the tag)',
        );
        // One final source: the notes come from the CHANGELOG as recorded AT
        // THE TAG — never from the plan-time render (whose scope can differ
        // from the merged content; that was the 9.14.0 desync).
        const tagged_changelog = git(['show', `${plan.target}:CHANGELOG.md`], { capture: true });
        const tagged_section = extract_changelog_section(tagged_changelog, plan.target);
        if (!tagged_section) {
            die(
                `CHANGELOG.md at tag ${plan.target} carries no section for ${plan.target} — ` +
                    'refusing to publish release notes from a different source',
            );
        }
        const notes = _cap_body(
            release_notes_from_section(tagged_section!.body, plan.target),
            GH_RELEASE_NOTES_LIMIT,
            '`CHANGELOG.md`',
        );
        guard_publication(plan.target, 'GitHub Release notes');
        gh(['release', 'create', plan.target, '--title', plan.target, '--notes', notes]);

        // ─── 9b. dispatch-chain the tag-triggered workflows (--ci only) ──────
        // release-guard.yml, publish-npm.yml, and cloud-release.yml all
        // trigger on `push: tags: [0-9]+.[0-9]+.[0-9]+`, but a tag pushed
        // with the default GITHUB_TOKEN does NOT fire other workflows
        // (GitHub's recursion guard). All three already accept a `tag`
        // input for exactly this recovery case, so dispatch them
        // explicitly instead of relying on an event that will never
        // arrive. Only reached here (not in the `_release_exists` skip
        // branch above), so a --resume re-run never re-dispatches a
        // publish that already happened.
        if (ci) {
            _step(9, total, 'Dispatch release-guard.yml + publish-npm.yml + cloud-release.yml for the tag');
            // NON-FATAL by design. By this point the release is already complete
            // — the tag is pushed and the GitHub Release is created above, and
            // npm publish runs asynchronously. These explicit dispatches are a
            // FALLBACK for a tag pushed with the default GITHUB_TOKEN, which does
            // NOT fire tag-triggered workflows (GitHub's recursion guard). When
            // the tag was pushed with a PAT (RELEASE_PR_TOKEN), those three
            // workflows already fired on the push and this dispatch is redundant.
            // Dispatching via the API additionally needs the token's
            // `actions:write` scope; a 403 here (scope missing) must NOT mark an
            // already-shipped release as failed — warn and continue.
            for (const wf of ['release-guard.yml', 'publish-npm.yml', 'cloud-release.yml']) {
                const r = run(['gh', 'workflow', 'run', wf, '--ref', MAIN_BRANCH, '-f', `tag=${plan.target}`], {
                    check: false,
                });
                if (r.returncode !== 0) {
                    process.stderr.write(
                        `⚠️  Could not dispatch ${wf} (exit ${r.returncode}) — the release ${plan.target} is ` +
                            `already complete (tag + GitHub Release created; npm publishes async). If the tag was ` +
                            `pushed with a PAT, ${wf} already fired on the tag push. If you rely on the explicit ` +
                            `dispatch, grant RELEASE_PR_TOKEN the "Actions: read and write" scope (fine-grained PAT) ` +
                            `or the "workflow" scope (classic PAT).\n`,
                    );
                }
            }
        }
    }

    // ─── 10. delete the merged release branch (local + remote) ───────────────
    // Branch hygiene: a merged-but-undeleted release/X.Y.Z is what made
    // `--resume` mis-detect an old version. Delete it now so it can never
    // accumulate. Idempotent — skips whatever is already gone. Never touches
    // `main` or any tag.
    if (dry_run) {
        _step(10, total, `Would delete merged branch ${branch} (local + remote)`);
    } else {
        const deleted: string[] = [];
        if (
            _branch_exists_local(branch) &&
            git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }) !== branch
        ) {
            run(['git', 'branch', '-D', branch], { check: false });
            deleted.push('local');
        }
        if (_branch_exists_remote(branch)) {
            run(['git', 'push', REMOTE, '--delete', branch], { check: false });
            deleted.push('remote');
        }
        const where = deleted.length > 0 ? deleted.join(' + ') : 'already gone';
        _step(10, total, `Delete merged branch ${branch} (${where})`);
    }

    process.stdout.write('\n');
    process.stdout.write(`✅  Released ${plan.target}\n`);
    process.stdout.write(`   https://github.com/${REPO_SLUG}/releases/tag/${plan.target}\n`);
    process.stdout.write('   npm publish runs asynchronously via publish-npm.yml on the tag.\n');
}

// ─── entrypoint ───────────────────────────────────────────────────────────────

/** Mirror of `argparse.Namespace` for this CLI. */
interface Args {
    bump_override: string | null;
    explicit: string | null;
    yes: boolean;
    dry_run: boolean;
    no_wait: boolean;
    resume: boolean;
    check_confirm: boolean;
    ci: boolean;
}

const PROG = 'release.py';
// Verbatim argparse usage block (captured shape). The argparse `--help` BODY
// (per-flag descriptions) is a documented divergence — argparse re-wraps it to
// the live terminal width; the tests assert the `usage:` token + exit code,
// not the body prose.
//
// `--ci` (added for the label-triggered GitHub Actions release path, see
// `.github/workflows/release.yml`) is NOT part of the original argparse
// contract this file mirrors byte-for-byte — it postdates the py2ts
// migration (ADR-200) and has no Python counterpart. It is additive only:
// every existing flag/behaviour is unchanged when `--ci` is absent.
const USAGE =
    `usage: ${PROG} [-h] [--as {major,minor,patch}] [--version EXPLICIT] [--yes]\n` +
    '                  [--dry-run] [--no-wait] [--resume] [--check-confirm] [--ci]\n';

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse_args(argv: readonly string[]): Args {
    const args: Args = {
        bump_override: null,
        explicit: null,
        yes: false,
        dry_run: false,
        no_wait: false,
        resume: false,
        check_confirm: false,
        ci: false,
    };

    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            // argparse prints the full help to stdout; we emit the usage block
            // (the body is COLUMNS-dependent — documented divergence).
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }

        // --flag=value form.
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;

        if (flag === '--as') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) _argError('argument --as: expected one argument');
                value = argv[i + 1] as string;
                i += 1;
            }
            if (!['major', 'minor', 'patch'].includes(value)) {
                _argError(
                    `argument --as: invalid choice: '${value}' ` +
                        "(choose from 'major', 'minor', 'patch')",
                );
            }
            args.bump_override = value;
            i += 1;
            continue;
        }
        if (flag === '--version') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) _argError('argument --version: expected one argument');
                value = argv[i + 1] as string;
                i += 1;
            }
            args.explicit = value;
            i += 1;
            continue;
        }
        if (flag === '--yes' || a === '-y') {
            if (inlineVal !== null) _argError(`argument --yes/-y: ignored explicit argument '${inlineVal}'`);
            args.yes = true;
            i += 1;
            continue;
        }
        if (flag === '--dry-run') {
            if (inlineVal !== null) _argError(`argument --dry-run: ignored explicit argument '${inlineVal}'`);
            args.dry_run = true;
            i += 1;
            continue;
        }
        if (flag === '--no-wait') {
            if (inlineVal !== null) _argError(`argument --no-wait: ignored explicit argument '${inlineVal}'`);
            args.no_wait = true;
            i += 1;
            continue;
        }
        if (flag === '--resume') {
            if (inlineVal !== null) _argError(`argument --resume: ignored explicit argument '${inlineVal}'`);
            args.resume = true;
            i += 1;
            continue;
        }
        if (flag === '--check-confirm') {
            if (inlineVal !== null)
                _argError(`argument --check-confirm: ignored explicit argument '${inlineVal}'`);
            args.check_confirm = true;
            i += 1;
            continue;
        }
        if (flag === '--ci') {
            if (inlineVal !== null) _argError(`argument --ci: ignored explicit argument '${inlineVal}'`);
            args.ci = true;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        }
        positionals.push(a);
        i += 1;
    }
    if (positionals.length > 0) {
        _argError(`unrecognized arguments: ${positionals.join(' ')}`);
    }
    return args;
}

/** Override wins; otherwise auto-detect from commits (or 'patch' if empty). */
function resolve_bump(override: string | null, commits: readonly Commit[]): string {
    if (override) {
        return override;
    }
    return infer_bump(commits);
}

/**
 * Should a `--ci` run stop early with no release? Empty commits + no
 * explicit override + no bump override means `infer_bump` would fall back
 * to a hollow 'patch' bump — fine for a deliberate interactive `task
 * release`, but the label-triggered CI path (`.github/workflows/release.yml`)
 * can fire on a merged `release`-labeled PR whose commits were already
 * shipped by an earlier run in the same batch (the double-fire case). This
 * is the guard that makes firing the CI path twice a clean no-op instead of
 * a spurious empty release. The interactive path is unaffected — this only
 * ever returns true when `ci` is true.
 */
export function nothing_to_release_ci(
    ci: boolean,
    explicit: string | null,
    bump_override: string | null,
    commits: readonly Commit[],
): boolean {
    return ci && explicit === null && bump_override === null && commits.length === 0;
}

const _RELEASE_BRANCH_RE = /^release\/(\d+\.\d+\.\d+)$/;

/** `package.json`'s `version`, or null when unreadable, not JSON, or key-less. */
function _package_version_or_null(): string | null {
    try {
        const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
        return 'version' in data ? (data['version'] as string) : null;
    } catch {
        return null;
    }
}

/** Observations `_detect_in_flight_target` reads; injected by its tests. */
export interface InFlightProbes {
    head_branch?: () => string;
    package_version?: () => string | null;
    /** True when the tag is ON THE REMOTE — never merely local. */
    tag_published?: (tag: string) => boolean;
}

/**
 * In-flight release target: `package.json` claims `V` while no PUBLISHED tag
 * `V` exists, so the publish step never completed. HEAD on `release/X.Y.Z`
 * wins first; stale `release/*` branches are never consulted (a merged one
 * left undeleted can tag a downgrade). PUBLISHED means on the REMOTE, because
 * publish-npm.yml triggers on `push: tags:`. Why not a local tag, and the
 * 14.6.0 release that stranded on the old form: see
 * `tests/scripts/release.test.ts` § _detect_in_flight_target.
 */
function _detect_in_flight_target(probes: InFlightProbes = {}): string | null {
    const head_branch =
        probes.head_branch ?? (() => git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }));
    const package_version = probes.package_version ?? _package_version_or_null;
    const tag_published = probes.tag_published ?? _tag_exists_remote;

    const m = _RELEASE_BRANCH_RE.exec(head_branch());
    if (m) {
        return m[1] as string;
    }
    const version = package_version();
    if (version === null) {
        return null;
    }
    try {
        parse_version(version);
    } catch {
        return null;
    }
    // A PUBLISHED tag is a completed release; a local-only tag is not.
    if (tag_published(version)) {
        return null;
    }
    return version;
}

/** Outcome of the release-time era-split gate (pure, unit-testable). */
export interface SplitDecision {
    split: SplitPlan | null;
    die_message: string | null;
    warning: string | null;
}

/**
 * Decide whether releasing `target` must split the current era — measured
 * against the POST-release state the drift test will see (the era's raw
 * total today, because today's exempt newest section stops being exempt the
 * moment the new release section is prepended).
 *
 * - post-release body over the cap + minor/major target → split.
 * - post-release body over the cap + patch target:
 *   - accumulated (prior releases beyond the newest) ALSO over the cap →
 *     die — waiting cannot fix it; a minor release or manual split must
 *     come first (pre-fix behaviour, unchanged).
 *   - only the newest section busts the cap → proceed with a warning; a
 *     patch cannot cross an era boundary, and blocking it was the failure
 *     the newest-release exemption was introduced for. The drift gate will
 *     be red until the next minor/major performs the split.
 *
 * Reads the CHANGELOG via the changelog_eras lib — tests point it at a
 * fixture with `_set_changelog_path` (plan_split reads the same file).
 */
export function resolve_split_decision(target: string): SplitDecision {
    const post_release_body = current_era_body_size();
    if (post_release_body <= CURRENT_ERA_BODY_CAP) {
        return { split: null, die_message: null, warning: null };
    }
    const candidate = plan_split(target);
    if (candidate !== null) {
        return { split: candidate, die_message: null, warning: null };
    }
    const accumulated = current_era_accumulated_body_size();
    if (accumulated > CURRENT_ERA_BODY_CAP) {
        return {
            split: null,
            die_message:
                `current era body is ${accumulated} lines (cap ` +
                `${CURRENT_ERA_BODY_CAP}) but release ${target} is a patch ` +
                `within the same era — split needs a minor/major bump. ` +
                'Cut a minor release or split CHANGELOG.md manually first.',
            warning: null,
        };
    }
    return {
        split: null,
        die_message: null,
        warning:
            `after this release the current era's accumulated body will be ` +
            `${post_release_body} lines (cap ${CURRENT_ERA_BODY_CAP}); a patch ` +
            `cannot split the era, so the changelog drift gate will be RED ` +
            `until the next minor/major release performs the split.`,
    };
}

function main(argv: readonly string[] | null = null): number {
    const args = _parse_args(argv === null ? process.argv.slice(2) : argv);

    // Self-test the confirmation prompt without touching git/gh/npm. Run it the
    // same way a real release is invoked — `task release -- --check-confirm` —
    // to verify the `[y/N]` prompt can actually read your answer through the
    // go-task / scripts-run wrapper chain. Nothing is released either way.
    if (args.check_confirm) {
        process.stdout.write(
            'Confirm-gate self-test — answer the [y/N] prompt below.\n' +
                'Nothing is released; this only checks that the prompt can read your answer.\n',
        );
        const verdict = confirmGate('SELF-TEST (no release)', args.yes);
        if (verdict.proceed) {
            process.stdout.write(
                'result: OK — the prompt read your confirmation. ' +
                    '`task release` will work interactively.\n',
            );
            return 0;
        }
        const sink = verdict.stream === 'stderr' ? process.stderr : process.stdout;
        if (verdict.message) sink.write(`${verdict.message}\n`);
        process.stdout.write(
            `result: the prompt did not read a "y" (stdin.isTTY=${String(process.stdin.isTTY)}). ` +
                'If you typed y and still see this, paste this whole block back.\n',
        );
        return 1;
    }

    const current = (
        JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>
    )['version'] as string;
    parse_version(current);

    const prev = latest_tag();
    const commits = commits_since(prev);

    if (nothing_to_release_ci(args.ci, args.explicit, args.bump_override, commits)) {
        process.stdout.write(
            `nothing to release — no commits since ${prev ?? 'the start of history'}; exiting cleanly.\n`,
        );
        return 0;
    }

    const bump = resolve_bump(args.bump_override, commits);

    // Resume mode: prefer an existing `release/X.Y.Z` over computed bump,
    // so we don't accidentally start a 1.16.0 release while 1.15.0 is
    // still in flight. Explicit --version still wins.
    const in_flight = args.resume ? _detect_in_flight_target() : null;
    let target: string;
    if (args.explicit) {
        target = args.explicit;
    } else if (in_flight) {
        target = in_flight;
        process.stdout.write(
            `(resume) in-flight target ${in_flight} (package.json version with no tag yet)\n`,
        );
    } else {
        target = bump_version(current, bump);
    }
    parse_version(target);

    // Runs in dry-run too — a preview that hides the one condition which will
    // refuse the real run is the case previews are for — but REPORTS there
    // instead of dying: `--dry-run returns 0` is a contract this file's tests
    // assert, and breaking it to surface a warning would trade a documented
    // exit code for a message.
    assert_scheduled_deprecations_clear(target, undefined, { previewOnly: args.dry_run });

    if (!args.dry_run) {
        preflight(target, { resume: args.resume, ci: args.ci });
    }

    const today = todayIso();
    // Dry-run stays fast: the trend line costs a full vitest collection
    // (~15s+), which `--dry-run exits 0 without needing …` contracts (and
    // the release test) assume never runs. Real releases compute it.
    const test_trend_line = args.dry_run ? null : _render_test_trend_line(prev);
    // Derived unconditionally, dry-run included: it is one `git log` (~25 ms),
    // not the trend line's full vitest collection. Skipping it on `--dry-run`
    // made the preview print the `_none_` skeleton while the real run wrote
    // pre-filled lines — a preview that contradicts its own output, which is
    // the exact class of surface disagreement this pre-fill exists to end.
    // One `git log` over the span, like `_derive_head_prefill` — so the preview
    // and the real run cannot disagree. See `measure_mix_obligation`.
    const [full, body] = render_changelog_entry(target, prev, commits, today, {
        test_trend_line,
        head: _derive_head_prefill(prev),
        mix: measure_mix_obligation(target, prev),
    });

    // Era-split planning — gate on the POST-release view (2026-07-07 fix).
    // The drift test measures the era AFTER this release's section is
    // prepended: the new section becomes the exempt "newest", so everything
    // currently in the era — INCLUDING today's still-exempt newest section —
    // counts as accumulated the moment this release lands. That future
    // quantity equals today's raw era total (current_era_body_size). The old
    // gate measured current_era_accumulated_body_size (pre-release snapshot),
    // which is ~0 right after a big catch-up release — so the 8.0.0 and 8.1.0
    // releases each skipped the split and left main red on the drift gate
    // until a manual chore split. Same function as the drift test, wrong
    // moment in time.
    //
    // The newest-release exemption is still honoured where it matters: a
    // PATCH release cannot cross an era boundary, so when only the newest
    // section busts the cap (accumulated still under it) the patch proceeds
    // with a loud warning instead of dying — the split then fires on the
    // next minor/major. A patch on top of a genuinely over-cap accumulated
    // body still dies (unchanged), because that state is unfixable by
    // waiting and needs a minor release or a manual split.
    const decision = resolve_split_decision(target);
    if (decision.die_message !== null) {
        die(decision.die_message);
    }
    if (decision.warning !== null) {
        process.stderr.write(`warning: ${decision.warning}\n`);
    }
    const split: SplitPlan | null = decision.split;

    const plan = new Plan(current, target, bump, commits, prev, body, full, split);
    print_preview(plan);
    if (args.resume) {
        process.stdout.write('(resume) probing existing state — completed steps will be skipped.\n');
    }

    if (args.dry_run) {
        return 0;
    }

    const verdict = confirmGate(plan.target, args.yes);
    if (!verdict.proceed) {
        if (verdict.message) {
            const sink = verdict.stream === 'stderr' ? process.stderr : process.stdout;
            sink.write(`${verdict.message}\n`);
        }
        return 1;
    }

    execute(plan, {
        wait_for_checks: !args.no_wait,
        dry_run: false,
        resume: args.resume,
        ci: args.ci,
    });
    return 0;
}

// ─── CLI entry (release.py:1090-1091 `raise SystemExit(main())`) ──────────────

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        // main() can return an int directly OR throw SystemExitError via die();
        // both flow into process.exitCode. CalledProcessError is intentionally
        // NOT caught here, so it propagates (non-zero + traceback) — the historical
        // contract let subprocess errors raise.
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof SystemExitError || e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    main,
    _parse_args,
    parse_version,
    bump_version,
    commits_since,
    infer_bump,
    render_changelog_entry,
    _changelog_line,
    _cap_body,
    prepend_changelog,
    set_package_version,
    set_lockfile_version,
    set_marketplace_version,
    set_template_pin,
    resolve_bump,
    _detect_in_flight_target,
    print_preview,
    latest_tag,
    Commit,
    Plan,
    SystemExitError,
    ArgparseExit,
    CalledProcessError,
    die,
    BREAKING_RE,
    CONVENTIONAL_RE,
    SEMVER_RE,
    _RELEASE_BRANCH_RE,
    MODULE_DOC_FIRST_LINE,
    // Drill seam (release_drill.ts) — the step machinery under a simulated
    // git/gh world, so orchestration bugs surface in vitest, not mid-release.
    execute,
    _set_changelog_reader,
    _set_exec_override,
    push_release_branch,
    merge_release_pr,
    watch_pr_checks,
    _pr_merge_state,
    _MERGE_UPDATE_ROUNDS,
};
export type { Args };
