#!/usr/bin/env tsx
/**
 * CHANGELOG `Rollback:` linter.
 *
 * Normative source: `docs/contracts/release-sizing.md § Rollback path`.
 * Every NEW minor / major section in `CHANGELOG.md` — a heading matching
 * the repo's `## [X.Y.0](compare-link) (date)` shape (patch component 0)
 * — must contain at least one `Rollback:` line anywhere in its section,
 * naming how a consumer undoes the subsystem the release introduced or
 * substantially reworked.
 *
 * Cutoff — decidable, no retro-fail: the gate only fires for section
 * versions **strictly greater** than the current `package.json` version
 * at lint time. Historical sections are grandfathered by construction.
 * `--cutoff X.Y.Z` overrides the cutoff (e.g. the release pipeline can
 * pass the PREVIOUS released version so the section it is about to cut
 * is itself in scope).
 *
 * Shares the heading / era regexes with the drift gate via
 * `src/scripts/_lib/changelog_eras.ts` — no parallel copies.
 *
 * CLI: exit 0 clean, 1 violations (or selftest failure), 2 usage error.
 * `--selftest` proves the rule on inline fixtures: a minor section
 * without `Rollback:` fails; one with it passes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    CHANGELOG,
    REPO_ROOT,
    VERSION_HEADING_RE,
} from './_lib/changelog_eras.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

const ROLLBACK_LINE_RE = /\bRollback:/;
// Section ends at the next version heading, the next era header, or any
// other level-1/2 heading (`## [Unreleased]`, `# Era: …`). `###` sub-
// headings stay inside the section.
const SECTION_BOUNDARY_RE = /^##? /;

export interface Violation {
    readonly version: string;
    readonly line: number; // 1-based heading line
}

function parse_semver(v: string): [number, number, number] | null {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    if (!m) {
        return null;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semver_gt(a: [number, number, number], b: [number, number, number]): boolean {
    if (a[0] !== b[0]) return a[0] > b[0];
    if (a[1] !== b[1]) return a[1] > b[1];
    return a[2] > b[2];
}

/** Read the cutoff version from package.json at the repo root. */
function package_json_version(): string {
    const pkg_path = path.join(REPO_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkg_path, 'utf-8')) as { version?: string };
    if (typeof pkg.version !== 'string' || parse_semver(pkg.version) === null) {
        throw new Error(`package.json version is not bare semver: '${String(pkg.version)}'`);
    }
    return pkg.version;
}

/**
 * Core check: return one Violation per minor/major section (`## [X.Y.0]`)
 * whose version is strictly greater than `cutoff` and whose body carries
 * no `Rollback:` line.
 */
export function check_rollback_lines(lines: readonly string[], cutoff: string): Violation[] {
    const cut = parse_semver(cutoff);
    if (cut === null) {
        throw new Error(`cutoff is not bare semver (X.Y.Z): '${cutoff}'`);
    }
    const violations: Violation[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = VERSION_HEADING_RE.exec(lines[i]!);
        if (!m) {
            continue;
        }
        const version = m.groups!['version']!;
        const parsed = parse_semver(version);
        if (parsed === null || parsed[2] !== 0) {
            continue; // patch release — not a minor/major section
        }
        if (!semver_gt(parsed, cut)) {
            continue; // at or below the cutoff — grandfathered
        }
        // Section body: heading line down to (exclusive) the next boundary.
        let end = lines.length;
        for (let j = i + 1; j < lines.length; j++) {
            if (SECTION_BOUNDARY_RE.test(lines[j]!)) {
                end = j;
                break;
            }
        }
        const has_rollback = lines.slice(i, end).some((ln) => ROLLBACK_LINE_RE.test(ln));
        if (!has_rollback) {
            violations.push({ version, line: i + 1 });
        }
    }
    return violations;
}

// ─── selftest fixtures ─────────────────────────────────────────────────────────

function _fixture(section_body: string): string[] {
    return (
        '# Changelog\n\n' +
        '## [Unreleased]\n\n' +
        '# Era: 9.1.x — current\n\n' +
        '> Started at `9.1.0`.\n\n' +
        section_body +
        '# Era: pre-9.0.0 — archived\n'
    ).split('\n');
}

function run_selftest(): number {
    const cutoff = '9.0.0';
    let failed = 0;
    const assert = (label: string, ok: boolean): void => {
        process.stdout.write(`${ok ? '✅' : '❌'}  selftest: ${label}\n`);
        if (!ok) failed += 1;
    };

    // 1. New minor section WITHOUT Rollback: → exactly one violation.
    const red = check_rollback_lines(
        _fixture(
            '## [9.1.0](https://example/compare/9.0.0...9.1.0) (2026-07-10)\n\n' +
                '### Features\n\n* **workspace:** new subsystem ([abc1234](https://example))\n\n',
        ),
        cutoff,
    );
    assert('minor section without Rollback: FAILS', red.length === 1 && red[0]!.version === '9.1.0');

    // 2. Same section WITH a Rollback: line → clean.
    const green = check_rollback_lines(
        _fixture(
            '## [9.1.0](https://example/compare/9.0.0...9.1.0) (2026-07-10)\n\n' +
                '### Features\n\n* **workspace:** new subsystem ([abc1234](https://example))\n' +
                '  Rollback: set `workspace.enabled: false` in `.agent-settings.yml`.\n\n',
        ),
        cutoff,
    );
    assert('minor section with Rollback: passes', green.length === 0);

    // 3. Historical minor section at/below the cutoff → grandfathered.
    const old = check_rollback_lines(
        _fixture('## [9.0.0](https://example/compare/8.9.0...9.0.0) (2026-06-01)\n\n* old entry\n\n'),
        cutoff,
    );
    assert('section at cutoff is grandfathered', old.length === 0);

    // 4. New PATCH section without Rollback: → out of scope.
    const patch = check_rollback_lines(
        _fixture('## [9.1.1](https://example/compare/9.1.0...9.1.1) (2026-07-11)\n\n* a fix\n\n'),
        cutoff,
    );
    assert('patch section is out of scope', patch.length === 0);

    // 5. Rollback: in a FOLLOWING section must not satisfy the earlier one.
    const bleed = check_rollback_lines(
        _fixture(
            '## [9.2.0](https://example/compare/9.1.0...9.2.0) (2026-08-01)\n\n* no rollback here\n\n' +
                '## [9.1.0](https://example/compare/9.0.0...9.1.0) (2026-07-10)\n\n' +
                'Rollback: only covers 9.1.0.\n\n',
        ),
        cutoff,
    );
    assert('Rollback: does not bleed across sections', bleed.length === 1 && bleed[0]!.version === '9.2.0');

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
    cutoff: string | null;
    changelog: string | null;
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_changelog_rollback: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { selftest: false, cutoff: null, changelog: null, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--selftest') {
            args.selftest = true;
        } else if (arg === '--cutoff') {
            const v = argv[++i];
            if (v === undefined) _argparse_error('argument --cutoff: expected one argument');
            args.cutoff = v;
        } else if (arg.startsWith('--cutoff=')) {
            args.cutoff = arg.slice('--cutoff='.length);
        } else if (arg === '--changelog') {
            const v = argv[++i];
            if (v === undefined) _argparse_error('argument --changelog: expected one argument');
            args.changelog = v;
        } else if (arg.startsWith('--changelog=')) {
            args.changelog = arg.slice('--changelog='.length);
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_changelog_rollback [-h] [--selftest] [--cutoff X.Y.Z] [--changelog PATH] [--quiet]\n',
            );
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

    const changelog_path = args.changelog ?? CHANGELOG;
    const cutoff = args.cutoff ?? package_json_version();
    const text = fs.readFileSync(changelog_path, 'utf-8');
    const lines = text.split(/\r\n|\r|\n/);

    // Scope is the version sections the heading regex actually recognises, not
    // the line count: a CHANGELOG whose heading shape drifts away from
    // VERSION_HEADING_RE still reads as a big file while presenting zero
    // sections to check, and the gate reports clean. Counted before the cutoff
    // and patch filters — those are judgement, this is reach.
    const sections = lines.filter((ln) => VERSION_HEADING_RE.test(ln)).length;
    try {
        assertScanned({
            gate: 'lint_changelog_rollback',
            scanned: sections,
            units: 'version section(s)',
            roots: [path.relative(REPO_ROOT, changelog_path)],
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

    const violations = check_rollback_lines(lines, cutoff);
    if (violations.length > 0) {
        process.stderr.write(
            `❌  ${violations.length} minor/major CHANGELOG section(s) above ` +
                `cutoff ${cutoff} without a Rollback: line:\n`,
        );
        for (const v of violations) {
            process.stderr.write(`   - ## [${v.version}] (line ${v.line})\n`);
        }
        process.stderr.write(
            '\nEvery new minor/major section must name a rollback path for each ' +
                'introduced or substantially reworked subsystem via a `Rollback:` ' +
                'line — see docs/contracts/release-sizing.md § Rollback path.\n',
        );
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅  CHANGELOG Rollback: gate clean (cutoff ${cutoff}, ` +
                `${path.relative(REPO_ROOT, changelog_path)}).\n`,
        );
    }
    return 0;
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

export { main, run_selftest, parse_semver, semver_gt, package_json_version };
