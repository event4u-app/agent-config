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
        byCommand.set(cmd, [...(byCommand.get(cmd) ?? []), id]);
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
export function resolve_version(argv: readonly string[], cwd = REPO_ROOT): string | null {
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

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const version = resolve_version(argv);
    if (!version) {
        process.stderr.write('release_verify: could not resolve a version to check.\n');
        return 2;
    }
    const reg = parseYaml(fs.readFileSync(REGISTRY, 'utf-8')) as { jobs: Record<string, Row> };
    const cheap = argv.includes('--cheap');
    const rows = Object.entries(reg.jobs)
        .filter(([, r]) => r.verify && r.local)
        .filter(([, r]) => !(cheap && r.network));
    const steps = plan(rows, version);

    process.stdout.write(
        `release_verify: ${version} — ${String(steps.length)} local gate command(s)` +
            `${cheap ? ' (cheap set — network rows skipped)' : ''}\n\n`,
    );

    if (argv.includes('--list')) {
        for (const [id, cmd] of steps) {
            process.stdout.write(`  ${id}\n    ${cmd}\n`);
        }
        const skipped = Object.entries(reg.jobs).filter(([, r]) => !r.verify || !r.local);
        for (const [id, r] of skipped) {
            process.stdout.write(`  ${id} — not run locally\n    ${r.reason ?? 'cheap-gate opt-out'}\n`);
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
    // omitted three jobs would read as a clearance it is not.
    const uncovered = Object.entries(reg.jobs).filter(([, r]) => !r.verify || !r.local);
    process.stdout.write(
        `✅  ${String(rows.length)} local release gate(s) pass for ${version}.\n` +
            `    Not covered locally (${String(uncovered.length)}): ` +
            `${uncovered.map(([id]) => id).join(', ')} — see release-gate-locality.yml.\n`,
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
