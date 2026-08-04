#!/usr/bin/env tsx
/**
 * BREAKING_CHANGES.md ↔ CHANGELOG sync linter (road-to-feedback-9.0 P1.4).
 *
 * `BREAKING_CHANGES.md` is the discoverable index of consumer-facing breaking
 * changes, one per major (`X.0.0`). When a diff ships a NEW breaking entry in a
 * RELEASED CHANGELOG section it must also touch the index in the same change,
 * or the index silently rots behind the changelog.
 *
 * TRIGGER: a git diff (working tree vs `origin/main` — staged + unstaged) that
 * ADDS a `### BREAKING` / `### BREAKING CHANGES` subheading under a RELEASED
 * major section (`## [N.0.0]`) in `CHANGELOG.md`, where the same major had no
 * such subheading at the base ref (a wholly-new released section counts). A
 * breaking note under `## [Unreleased]` is WIP and never trips the gate.
 *
 * REQUIREMENT: when triggered, the same diff must also modify
 * `BREAKING_CHANGES.md`.
 *
 * Escape hatch (mirrors `check_structural_breaking.ts`'s `ci-override` trailer):
 * an own-line trailer `ci-override: breaking-index-override` (the bare token
 * `breaking-index-override` on its own line is also accepted) in any commit
 * body in the range, or the env var `BREAKING_INDEX_OVERRIDE=1`, clears the
 * gate for an intentional index-deferred change.
 *
 * CLI: exit 0 clean/cleared, 1 violation (or selftest failure), 2 usage error.
 * `--selftest` proves the rule on inline string fixtures (no git needed).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_breaking_changes_index.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const BASE_REF = 'origin/main';
const CHANGELOG_REL = 'CHANGELOG.md';
const INDEX_REL = 'BREAKING_CHANGES.md';

// A RELEASED major section heading: `## [N.0.0]…` (minor + patch both 0).
// `## [Unreleased]` never matches, so WIP breaking notes are out of scope.
const RELEASED_MAJOR_HEADING_RE = /^## \[(?<version>\d+\.0\.0)\]/;
// Any other level-1/2 heading closes the current section.
const SECTION_BOUNDARY_RE = /^##? /;
// A breaking subheading as emitted by release-please: `### BREAKING` or
// `### BREAKING CHANGES` (all-caps). Mixed-case `### Breaking changes` under
// Unreleased is intentionally NOT matched.
const BREAKING_SUBHEADING_RE = /^### BREAKING\b/;
// Override trailer — same shape as check_structural_breaking's `ci-override:`
// mechanism (own line, not an inline mention); the bare token is also accepted.
const OVERRIDE_RE = /^(?:ci-override:\s*)?breaking-index-override\s*$/m;

/**
 * Return the set of RELEASED major versions whose CHANGELOG section contains a
 * `### BREAKING` subheading.
 */
export function released_breaking_majors(lines: readonly string[]): Set<string> {
    const found = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        const m = RELEASED_MAJOR_HEADING_RE.exec(lines[i]!);
        if (!m) {
            continue;
        }
        const version = m.groups!['version']!;
        // Section body: heading line down to (exclusive) the next boundary.
        let end = lines.length;
        for (let j = i + 1; j < lines.length; j++) {
            if (SECTION_BOUNDARY_RE.test(lines[j]!)) {
                end = j;
                break;
            }
        }
        if (lines.slice(i + 1, end).some((ln) => BREAKING_SUBHEADING_RE.test(ln))) {
            found.add(version);
        }
    }
    return found;
}

/**
 * Core check. Returns the sorted list of RELEASED major versions that GAINED a
 * `### BREAKING` subheading between `oldLines` and `newLines` — the versions
 * that should be reflected in `BREAKING_CHANGES.md`.
 */
export function added_released_breaking_majors(
    oldLines: readonly string[],
    newLines: readonly string[],
): string[] {
    const before = released_breaking_majors(oldLines);
    const after = released_breaking_majors(newLines);
    const added = [...after].filter((v) => !before.has(v));
    added.sort();
    return added;
}

export interface CheckResult {
    readonly addedMajors: readonly string[];
    readonly indexChanged: boolean;
    readonly overridden: boolean;
    readonly violation: boolean;
}

/** Pure decision: violation iff a released BREAKING was added, the index was not touched, and no override cleared it. */
export function evaluate(
    oldLines: readonly string[],
    newLines: readonly string[],
    indexChanged: boolean,
    overridden: boolean,
): CheckResult {
    const addedMajors = added_released_breaking_majors(oldLines, newLines);
    const violation = addedMajors.length > 0 && !indexChanged && !overridden;
    return { addedMajors, indexChanged, overridden, violation };
}

// ─── git helpers (CLI only) ──────────────────────────────────────────────────

function _git(...args: string[]): string {
    const proc = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
    return (proc.stdout as string | null) ?? '';
}

function _base(): string {
    const mb = _git('merge-base', BASE_REF, 'HEAD').trim();
    return mb || BASE_REF;
}

function _splitlines(s: string): string[] {
    return s.split(/\r\n|\r|\n/);
}

/** File contents at a ref, or '' when the path did not exist there. */
function _blob_at(ref: string, rel: string): string {
    return _git('show', `${ref}:${rel}`);
}

// ─── selftest fixtures ─────────────────────────────────────────────────────────

function _changelog(sections: string): string[] {
    return ('# Changelog\n\n## [Unreleased]\n\n' + sections).split('\n');
}

const _RELEASED_WITH_BREAKING =
    '## [9.0.0](https://example/compare/8.13.0...9.0.0) (2026-07-13)\n\n' +
    '### BREAKING CHANGES\n\n* installer path changed ([abc1234](https://example))\n\n';
const _RELEASED_NO_BREAKING =
    '## [9.0.0](https://example/compare/8.13.0...9.0.0) (2026-07-13)\n\n' +
    '### Features\n\n* a feature ([abc1234](https://example))\n\n';

function run_selftest(): number {
    let failed = 0;
    const assert = (label: string, ok: boolean): void => {
        process.stdout.write(`${ok ? '✅' : '❌'}  selftest: ${label}\n`);
        if (!ok) failed += 1;
    };

    const oldNoBreaking = _changelog(_RELEASED_NO_BREAKING);
    const newWithBreaking = _changelog(_RELEASED_WITH_BREAKING);

    // 1. Released BREAKING added, index NOT changed, no override → VIOLATION.
    const red = evaluate(oldNoBreaking, newWithBreaking, false, false);
    assert(
        'released BREAKING added without index change FAILS',
        red.violation && red.addedMajors.length === 1 && red.addedMajors[0] === '9.0.0',
    );

    // 2. Same, but the index WAS changed → passes.
    const greenIdx = evaluate(oldNoBreaking, newWithBreaking, true, false);
    assert('index change clears the gate', !greenIdx.violation && greenIdx.addedMajors.length === 1);

    // 3. Same, index untouched, but override present → passes.
    const greenOverride = evaluate(oldNoBreaking, newWithBreaking, false, true);
    assert('override clears the gate', !greenOverride.violation);

    // 4. BREAKING only under [Unreleased] (WIP) → never trips.
    const oldEmpty = _changelog('');
    const newUnreleasedBreaking = (
        '# Changelog\n\n## [Unreleased]\n\n### BREAKING CHANGES\n\n* wip break ([abc1234](https://example))\n\n'
    ).split('\n');
    const wip = evaluate(oldEmpty, newUnreleasedBreaking, false, false);
    assert('Unreleased BREAKING does not trip the gate', !wip.violation && wip.addedMajors.length === 0);

    // 5. A released BREAKING already present at base (no new addition) → clean.
    const noop = evaluate(newWithBreaking, newWithBreaking, false, false);
    assert('pre-existing released BREAKING is not re-flagged', !noop.violation);

    if (failed > 0) {
        process.stderr.write(`❌  selftest: ${failed} fixture(s) failed.\n`);
        return 1;
    }
    process.stdout.write('✅  selftest: all fixtures behave as specified.\n');
    return 0;
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

interface ParsedArgs {
    selftest: boolean;
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_breaking_changes_index: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { selftest: false, quiet: false };
    for (const arg of argv) {
        if (arg === '--selftest') {
            args.selftest = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_breaking_changes_index [-h] [--selftest] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return args;
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.selftest) {
        return run_selftest();
    }

    const base = _base();
    if (!base) {
        return 0; // no trunk to diff against (e.g. shallow CI) → no-op
    }

    const oldLines = _splitlines(_blob_at(base, CHANGELOG_REL));
    const changelogPath = path.join(REPO_ROOT, CHANGELOG_REL);
    const newLines = fs.existsSync(changelogPath)
        ? _splitlines(fs.readFileSync(changelogPath, 'utf-8'))
        : [];

    // The diff is between two blobs, but the corpus is the working-tree
    // CHANGELOG: an absent one yields no lines, hence no added majors, hence the
    // green "no new released BREAKING entries vs trunk" — a clean bill of health
    // for a file that was never read. The base blob is legitimately empty for a
    // newly added CHANGELOG, so only this side is asserted.
    try {
        assertScanned({
            gate: 'lint_breaking_changes_index',
            scanned: newLines.length,
            units: `${CHANGELOG_REL} line(s)`,
            roots: [CHANGELOG_REL],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 = the gate's violation code; 2 is reserved for the pinned
            // argparse usage contract, so it cannot carry "could not run".
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    // Was BREAKING_CHANGES.md touched (staged or unstaged) vs the base?
    const indexChanged = _git('diff', '--name-only', base, '--', INDEX_REL).trim() !== '';

    const log = _git('log', '--format=%B', `${base}..HEAD`);
    const overridden = OVERRIDE_RE.test(log) || process.env['BREAKING_INDEX_OVERRIDE'] === '1';

    const result = evaluate(oldLines, newLines, indexChanged, overridden);

    if (!result.violation) {
        if (!args.quiet) {
            if (result.addedMajors.length > 0) {
                const why = result.overridden ? 'override' : `${INDEX_REL} updated`;
                process.stdout.write(
                    `✅ lint-breaking-changes-index: ${result.addedMajors.length} released ` +
                        `BREAKING addition(s), cleared by ${why}\n`,
                );
            } else {
                process.stdout.write(
                    '✅ lint-breaking-changes-index: no new released BREAKING entries vs trunk\n',
                );
            }
        }
        return 0;
    }

    process.stderr.write(
        `❌ lint-breaking-changes-index: released BREAKING entr(y/ies) added to ${CHANGELOG_REL} ` +
            `without a matching ${INDEX_REL} change:\n`,
    );
    for (const v of result.addedMajors) {
        process.stderr.write(`   - ## [${v}] gained a ### BREAKING section\n`);
    }
    process.stderr.write(
        `\nWhen a released major ships a breaking change, ${INDEX_REL} — the discoverable\n` +
            `index (one entry per major) — must be updated in the same change. Resolve by:\n` +
            `  • adding the matching entry to ${INDEX_REL}, or\n` +
            '  • adding an own-line `ci-override: breaking-index-override` trailer to a commit\n' +
            '    body (or setting BREAKING_INDEX_OVERRIDE=1) for an intentionally deferred index.\n',
    );
    return 1;
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
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main, run_selftest, RELEASED_MAJOR_HEADING_RE, BREAKING_SUBHEADING_RE, OVERRIDE_RE };
