#!/usr/bin/env tsx
/**
 * Release-trunk-sync CI gate (road-to-productization P1.3).
 *
 * TypeScript twin of `src/scripts/check_release_trunk_sync.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags,
 * exit codes (0 pass/no-op, 1 main too far behind, 3 internal error),
 * stdout, byte-identical `::warning::` / `::error::` messages, the same
 * git plumbing and the same env-var override. No behaviour changes —
 * latent bugs replicated.
 *
 * Fails if `main` is more than one tagged release behind the current
 * release-prep branch's target version. No-ops on every other branch
 * class. Owner contract: `docs/contracts/release-trunk-sync.md`.
 *
 * Exit codes: 0 = pass / no-op, 1 = main is too far behind, 3 = internal
 * error (git unavailable, malformed tag, etc.).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE_BRANCH_RE = /^release\/(\d+)\.(\d+)\.(\d+)$/;
const SEMVER_TAG_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const BOOTSTRAP_FILE = 'docs/contracts/release-trunk-sync.bootstrap';

type SemVer = [number, number, number];

function _git(...args: string[]): string {
    const proc = spawnSync('git', args, { encoding: 'utf-8' });
    if (proc.status !== 0) {
        return '';
    }
    return (proc.stdout ?? '').trim();
}

function _current_branch(): string {
    return _git('rev-parse', '--abbrev-ref', 'HEAD');
}

function _parse_semver(text: string): SemVer | null {
    const m = SEMVER_TAG_RE.exec(text);
    if (!m) {
        return null;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function _cmp(a: SemVer, b: SemVer): number {
    for (let i = 0; i < 3; i++) {
        if (a[i]! !== b[i]!) {
            return a[i]! - b[i]!;
        }
    }
    return 0;
}

function _all_tags(): SemVer[] {
    const raw = _git('tag', '--list');
    const tags: SemVer[] = [];
    for (const line of raw.split('\n')) {
        const parsed = _parse_semver(line.trim());
        if (parsed !== null) {
            tags.push(parsed);
        }
    }
    tags.sort(_cmp);
    return tags;
}

/** Highest semver tag whose commit is reachable from main. */
function _main_tag(): SemVer | null {
    let head = '';
    for (const ref of ['refs/heads/main', 'refs/remotes/origin/main']) {
        head = _git('rev-parse', '--verify', ref);
        if (head) {
            break;
        }
    }
    if (!head) {
        return null;
    }
    const raw = _git('tag', '--merged', head);
    const reachable: SemVer[] = [];
    for (const line of raw.split('\n')) {
        const parsed = _parse_semver(line.trim());
        if (parsed !== null) {
            reachable.push(parsed);
        }
    }
    if (reachable.length === 0) {
        return null;
    }
    return reachable.reduce((acc, t) => (_cmp(t, acc) > 0 ? t : acc));
}

function _prior_release(target: SemVer, tags: SemVer[]): SemVer | null {
    const earlier = tags.filter((t) => _cmp(t, target) < 0);
    if (earlier.length === 0) {
        return null;
    }
    return earlier.reduce((acc, t) => (_cmp(t, acc) > 0 ? t : acc));
}

function _fmt(v: SemVer): string {
    return `${v[0]}.${v[1]}.${v[2]}`;
}

function _bootstrap_ok(target: SemVer): boolean {
    if (!fs.existsSync(BOOTSTRAP_FILE)) {
        return false;
    }
    const targetS = _fmt(target);
    for (let line of fs.readFileSync(BOOTSTRAP_FILE, 'utf-8').split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        if (line === targetS) {
            return true;
        }
    }
    return false;
}

function main(): number {
    let branch = _current_branch();
    if (branch === 'HEAD' || !branch) {
        process.stdout.write('::warning::detached HEAD — release-trunk-sync gate skipped\n');
        return 0;
    }
    // CI override: GitHub Actions sometimes runs on the merge ref.
    const ciRef = process.env['GITHUB_HEAD_REF'] || process.env['GITHUB_REF_NAME'];
    if (ciRef) {
        branch = ciRef;
    }
    const m = RELEASE_BRANCH_RE.exec(branch);
    if (!m) {
        return 0; // non-release branch class — gate is a no-op
    }
    const target: SemVer = [Number(m[1]), Number(m[2]), Number(m[3])];
    const tags = _all_tags();
    if (tags.length === 0) {
        process.stdout.write(
            '::warning::no semver tags found — release-trunk-sync gate skipped\n',
        );
        return 0;
    }
    const mainTag = _main_tag();
    if (mainTag === null) {
        process.stdout.write('::warning::no semver tag reachable from main — gate skipped\n');
        return 0;
    }
    if (_cmp(mainTag, target) >= 0) {
        return 0; // main already at or ahead of release target
    }
    const prior = _prior_release(target, tags);
    if (prior !== null && _cmp(mainTag, prior) >= 0) {
        return 0; // within the one-release tolerance
    }
    if (_bootstrap_ok(target)) {
        const targetS = _fmt(target);
        process.stdout.write(
            `::warning::release-trunk-sync gate suppressed for ${targetS} via bootstrap file\n`,
        );
        return 0;
    }
    const mainS = _fmt(mainTag);
    const targetS = _fmt(target);
    process.stdout.write(
        `::error::main is at ${mainS}; release-prep branch targets ${targetS}. ` +
            'Main must be no more than one tagged release behind. ' +
            'See docs/contracts/release-trunk-sync.md.\n',
    );
    return 1;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stdout.write(`::error::release-trunk-sync gate internal error: ${msg}\n`);
        process.exit(3);
    }
}

export {
    RELEASE_BRANCH_RE,
    SEMVER_TAG_RE,
    BOOTSTRAP_FILE,
    _parse_semver,
    _all_tags,
    _main_tag,
    _prior_release,
    _bootstrap_ok,
    main,
};
