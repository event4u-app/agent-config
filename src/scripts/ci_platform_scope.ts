#!/usr/bin/env tsx
/**
 * Does this pull request need every macOS leg of tests.yml, or only the
 * platform tier?
 *
 * GitHub-hosted macOS is capped at 5 concurrent jobs and tests.yml requests 13
 * per run, so most of a PR's wait is a macOS queue (PR #2569: 5.7-33 min). The
 * per-OS attribution over 520 runs (agents/evidence/analysis/ci-os-attribution-2026-10.md)
 * found macOS-only reds in 10 of 5365 twin pairs, all in node-tests. So a PR
 * whose diff cannot reach platform behaviour runs the macOS tier only; one that
 * can, and any diff this script cannot read, runs everything. `push: main`
 * always runs everything — this script is only consulted on pull requests.
 *
 * Reads `git diff --name-only <merge-base>...HEAD` in-repo; no third-party
 * changed-files action (CVE-2025-30066).
 *
 * Usage: ./scripts-run src/scripts/ci_platform_scope [--base origin/main]
 * Prints `macos=full` or `macos=tier`, and appends the same to $GITHUB_OUTPUT
 * when that is set.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export type MacosScope = 'full' | 'tier';

/** A changed path matching any of these can change behaviour that differs by platform. */
export const PLATFORM_SENSITIVE: readonly RegExp[] = [
    /^src\/install\//,
    /^dist\/install\//,
    /^setup\.sh$/,
    /^scripts\/install/,
    /^tests\/test_install\.sh$/,
    /^src\/scripts\/hooks\//,
    /^hooks\//,
    /^src\/scripts\/collector_/,
    /^src\/scripts\/_lib\/collector_/,
    /^\.github\/workflows\/tests\.yml$/,
    /^package(-lock)?\.json$/,
    /^vitest\.config\.ts$/,
];

/** `null` means the diff could not be read — never guessed as narrow. */
export function scopeFor(changed: readonly string[] | null): MacosScope {
    if (changed === null || changed.length === 0) return 'full';
    return changed.some((p) => PLATFORM_SENSITIVE.some((re) => re.test(p))) ? 'full' : 'tier';
}

function changedPaths(base: string): string[] | null {
    const mb = spawnSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf-8' });
    if (mb.status !== 0 || mb.stdout.trim() === '') return null;
    const diff = spawnSync('git', ['diff', '--name-only', `${mb.stdout.trim()}...HEAD`], { encoding: 'utf-8' });
    if (diff.status !== 0) return null;
    return diff.stdout.split('\n').filter((l) => l.trim() !== '');
}

export function main(argv: readonly string[]): number {
    const i = argv.indexOf('--base');
    const base = i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : 'origin/main';
    const line = `macos=${scopeFor(changedPaths(base))}`;
    process.stdout.write(`${line}\n`);
    const out = process.env['GITHUB_OUTPUT'];
    if (out !== undefined && out !== '') fs.appendFileSync(out, `${line}\n`);
    return 0;
}

if (process.argv[1] !== undefined && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url) {
    process.exit(main(process.argv.slice(2)));
}
