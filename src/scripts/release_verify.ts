#!/usr/bin/env tsx
/**
 * Run every release-PR assertion that CAN run locally, before anything is
 * pushed.
 *
 * `release-validation.yml` is the last gate a release passes and the most
 * expensive one to fail: it runs after `gh pr create`, so a branch, a pull
 * request and a CI run are already spent by the time it speaks. Twice in three
 * releases it refused something reproducible locally in under two seconds —
 * 14.14.0 (PR #1812) on the curated head, 14.17.0 (PR #1856) on the
 * governance-mix response. In both cases the check existed, was runnable, and
 * nothing ran it.
 *
 * This is the command that runs it. It is DERIVED from
 * `src/config/release-gate-locality.yml` rather than from a hand-kept list, so
 * a new release-validation job cannot be added without either giving this
 * runner a command or declaring, with a classified reason, that it has none —
 * `tests/scripts/release_gate_locality.test.ts` enforces that half.
 *
 * Deliberately NOT a gate script: it runs commands rather than inspecting a
 * corpus, so it has no `scanned:` count to report and no place in
 * `gate-coverage.yml`. Same shape as `release_drill`, which is also a runner
 * with a task and a test and no coverage row.
 *
 * Usage:
 *     task release:verify                 # version from the branch, else package.json
 *     task release:verify -- --version 14.17.0
 *     task release:verify -- --list       # print the plan, run nothing
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'config', 'release-gate-locality.yml');

interface Row {
    local: string | null;
    reason?: string;
    verify: boolean;
    network?: boolean;
    partial?: string;
    release_branch_only?: boolean;
    script: string | null;
    guard?: string | null;
}

/**
 * Collapse rows that reproduce to the SAME command.
 *
 * Two jobs legitimately share one local reproduction — `changelog-entry` and
 * `highlight-plausibility` are both answered by `check_release_highlights` —
 * and running it twice would double the cost while reporting a coverage the
 * second run did not add. The ids stay joined so the output still names every
 * job the command answers for.
 */
function plan(rows: ReadonlyArray<readonly [string, Row]>, version: string): Array<[string, string]> {
    const byCommand = new Map<string, string[]>();
    for (const [id, r] of rows) {
        const cmd = r.local!.replace('${VERSION}', version);
        const label = r.partial ? `${id} (partial: ${r.partial})` : id;
        byCommand.set(cmd, [...(byCommand.get(cmd) ?? []), label]);
    }
    return [...byCommand.entries()].map(([cmd, ids]) => [ids.join(' + '), cmd]);
}

/**
 * The version under release.
 *
 * The branch name first, because that is what `release-validation.yml` itself
 * reads (`head_ref`) — running the gates against a different version than CI
 * will read would be a green run that proves nothing. `package.json` is the
 * fallback for a maintainer probing before the branch exists.
 */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

export function resolve_version(argv: readonly string[], cwd = REPO_ROOT): string | null {
    const v = resolve_version_raw(argv, cwd);
    // Every row's command is interpolated into `bash -c`, and two of the three
    // sources here are strings git and npm hand back rather than values this
    // file chose. `on_release_branch` already applies exactly this shape check;
    // not applying it on the path that reaches a shell was the asymmetry.
    return v !== null && SEMVER_RE.test(v) ? v : null;
}

function resolve_version_raw(argv: readonly string[], cwd = REPO_ROOT): string | null {
    const i = argv.indexOf('--version');
    if (i !== -1 && argv[i + 1]) return argv[i + 1]!;
    const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
        encoding: 'utf-8',
    });
    const name = (branch.stdout ?? '').trim();
    if (name.startsWith('release/')) return name.slice('release/'.length);
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8')) as {
            version?: string;
        };
        return pkg.version ?? null;
    } catch {
        return null;
    }
}

/** Whether HEAD is a `release/X.Y.Z` branch — decides the `release_branch_only` rows. */
export function on_release_branch(cwd = REPO_ROOT): boolean {
    const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf-8' });
    return /^release\/\d+\.\d+\.\d+$/u.test((r.stdout ?? '').trim());
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const version = resolve_version(argv);
    if (!version) {
        process.stderr.write('release_verify: could not resolve a version to check.\n');
        return 2;
    }
    const reg = parseYaml(fs.readFileSync(REGISTRY, 'utf-8')) as { jobs: Record<string, Row> };
    const cheap = argv.includes('--cheap');
    const releaseHead = on_release_branch();
    // Every job lands in exactly one bucket, and the buckets are built from one
    // pass so they cannot fail to partition. The first version filtered `rows`
    // and then derived `uncovered` from a DIFFERENT predicate, so `audit-gate`
    // under `--cheap` satisfied neither and vanished from the report: the run
    // printed "3 pass" and "4 not covered" over eight jobs and read as a
    // clearance for a job nobody ran. `--cheap` is the variant `task release`
    // fires unattended, so that was the report nobody would be reading.
    const runnable: Array<[string, Row]> = [];
    const skipped: Array<[string, string]> = [];
    for (const [id, r] of Object.entries(reg.jobs)) {
        if (!r.verify || !r.local) {
            skipped.push([id, r.reason ?? 'not part of the verify set']);
        } else if (cheap && r.network) {
            skipped.push([id, 'skipped by --cheap — leaves the machine']);
        } else if (r.release_branch_only && !releaseHead) {
            skipped.push([id, 'asserts a release-PR diff, and HEAD is not a release/X.Y.Z branch']);
        } else {
            runnable.push([id, r]);
        }
    }
    if (runnable.length + skipped.length !== Object.keys(reg.jobs).length) {
        process.stderr.write('release_verify: internal accounting error — jobs lost.\n');
        return 2;
    }
    const rows = runnable;
    const steps = plan(rows, version);

    // Where the version came from, because off a release branch it falls back
    // to `package.json` — which is the version already RELEASED, not the one
    // being cut. A green run against it says nothing about the next release,
    // and `task release:verify` with no arguments is exactly the pre-probe the
    // task description invites.
    const provenance = argv.includes('--version')
        ? 'from --version'
        : releaseHead
          ? 'from the release branch'
          : 'from package.json — NOT a release branch, so this is the version already released';
    process.stdout.write(
        `release_verify: ${version} (${provenance}) — ${String(steps.length)} local gate command(s)` +
            `${cheap ? ' (cheap set — network rows skipped)' : ''}\n\n`,
    );

    if (argv.includes('--list')) {
        for (const [id, cmd] of steps) {
            process.stdout.write(`  ${id}\n    ${cmd}\n`);
        }
        for (const [id, why] of skipped) {
            process.stdout.write(`  ${id} — not run\n    ${why}\n`);
        }
        return 0;
    }

    const failed: string[] = [];
    for (const [id, cmd] of steps) {
        process.stdout.write(`─── ${id}\n    ${cmd}\n`);
        const res = spawnSync('bash', ['-c', cmd], { cwd: REPO_ROOT, stdio: 'inherit' });
        if (res.status !== 0) {
            failed.push(id);
            process.stdout.write(`    ❌  ${id} (exit ${String(res.status ?? -1)})\n\n`);
        } else {
            process.stdout.write(`    ✅  ${id}\n\n`);
        }
    }

    if (failed.length > 0) {
        process.stderr.write(
            `❌  ${String(failed.length)} release gate(s) would fail the release PR: ${failed.join(', ')}.\n` +
                '    Nothing has left this machine yet. Fix them, then re-run.\n',
        );
        return 1;
    }
    // The runner names what it did NOT cover — a green run that silently
    // omitted a job would read as a clearance it is not.
    process.stdout.write(
        `✅  ${String(rows.length)} of ${String(Object.keys(reg.jobs).length)} ` +
            `release-validation job(s) pass for ${version} (${String(steps.length)} command(s)).\n` +
            `    Not covered by this run (${String(skipped.length)}):\n` +
            skipped.map(([id, why]) => `      ${id} — ${why}\n`).join('') +
            '    See src/config/release-gate-locality.yml.\n',
    );
    return 0;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    process.exit(main());
}
