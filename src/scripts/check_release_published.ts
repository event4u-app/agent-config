#!/usr/bin/env tsx
/**
 * Release-published drift gate.
 *
 * Ported from the retired Python `src/scripts/check_release_published.py` (ADR-200,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--strict`,
 * `--check-npm`, `--require-main` flags, exit codes (0 pass/no-op,
 * 1 drift, 3 internal error), byte-identical messages, stdout/stderr split,
 * git + npm subprocess shape.
 *
 * Catches the "release merged to main but never tagged/published" failure
 * mode — where `main`'s `package.json` claims a version that has no
 * matching git tag, and npm's `latest` therefore lags behind main.
 *
 * Two independent invariants:
 *   1. Tag invariant: the version in `package.json` MUST have a matching git
 *      tag ON THE REMOTE. A local-only tag published nothing — `publish-npm.yml`
 *      triggers on `push: tags:` — so the probe asks `origin` (one `ls-remote`).
 *   2. npm invariant (`--check-npm`, network): `npm view <pkg>
 *      dist-tags.latest` MUST equal the `package.json` version.
 *
 * Exit codes: 0 = pass / no-op · 1 = drift detected · 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { workspaceIdentity } from './_lib/git_common_dir.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const MAIN_BRANCH = 'main';

function _git(...args: string[]): [number, string] {
    const proc = spawnSync('git', args, { encoding: 'utf8' });
    const rc = typeof proc.status === 'number' ? proc.status : 1;
    return [rc, (proc.stdout ?? '').trim()];
}

function _package_version(): string {
    const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
    return String(data['version']);
}

function _package_name(): string {
    const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
    return String(data['name']);
}

/**
 * True when the tag is PUBLISHED — present on `origin`, never merely local.
 *
 * This probe used to answer local-OR-remote, and that made the gate reply
 * "tagged, therefore published" to the exact state it exists to detect. A tag
 * created by `release.ts` step 8 whose push then failed sits in the local
 * repository while nothing has shipped: `publish-npm.yml` triggers on
 * `push: tags:`, so a tag that never reached the remote published nothing.
 * Measured 2026-08-20 on 14.6.0 — main carried `package.json` 14.6.0, the tag
 * existed only in the maintainer's checkout, and npm still served 14.5.0.
 *
 * In CI the old form happened to be harmless: `actions/checkout` brings no
 * unpushed local tag, so the remote arm decided. The hole was LOCAL — a
 * maintainer running `task check-release-published` (or `task preflight`) on
 * the machine that minted the tag got a green for an unpublished release, on
 * the one machine where the stuck state is visible. The sibling defect in
 * `release.ts::_detect_in_flight_target` is the same construct.
 *
 * @param git Seam for the probe. Production passes nothing and gets the real
 * `_git`; tests inject a stub, because the alternative — reaching the branches
 * only by creating and deleting tags in the checkout — is why neither arm of
 * this function had a test while both were wrong.
 */
function _tag_exists(tag: string, git: (...args: string[]) => [number, string] = _git): boolean {
    const [rc] = git('ls-remote', '--exit-code', '--tags', 'origin', tag);
    return rc === 0;
}

function _on_main(): boolean {
    // Local checkout, CI push ref, or CI scheduled ref all map to main.
    const ref = process.env.GITHUB_REF ?? '';
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
        return true;
    }
    // Census row B5. Behaviour-identical: a detached HEAD used to compare the
    // literal `HEAD` against MAIN_BRANCH and fail; unresolved fails the same
    // way, without a subprocess an inherited `GIT_DIR` could redirect.
    const branch = workspaceIdentity().branch;
    return branch.resolved && branch.value === MAIN_BRANCH;
}

function _npm_latest(pkg: string): string | null {
    const proc = spawnSync('npm', ['view', pkg, 'dist-tags.latest'], { encoding: 'utf8' });
    if ((typeof proc.status === 'number' ? proc.status : 1) !== 0) {
        return null;
    }
    return (proc.stdout ?? '').trim() || null;
}

interface ParsedArgs {
    strict: boolean;
    check_npm: boolean;
    require_main: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_release_published: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let strict = false;
    let check_npm = false;
    let require_main = false;
    for (const arg of argv) {
        if (arg === '--strict') {
            strict = true;
        } else if (arg === '--check-npm') {
            check_npm = true;
        } else if (arg === '--require-main') {
            require_main = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_release_published [-h] [--strict] [--check-npm] [--require-main]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { strict, check_npm, require_main };
}

// Injectable hooks mirror the Python module-level functions that the test
// suite monkeypatches (_package_version, _package_name, _tag_exists,
// _on_main, _npm_latest).
interface Hooks {
    _package_version: () => string;
    _package_name: () => string;
    _tag_exists: (tag: string) => boolean;
    _on_main: () => boolean;
    _npm_latest: (pkg: string) => string | null;
}

const _hooks: Hooks = {
    _package_version,
    _package_name,
    _tag_exists,
    _on_main,
    _npm_latest,
};

function main(argv: readonly string[] = [], hooks: Hooks = _hooks): number {
    const args = parse_args(argv);

    // This gate walks no tree: one named file supplies BOTH sides of every
    // invariant — the version the git tag must match and the package name npm
    // is queried for. A repointed PACKAGE_JSON constant is the whole failure
    // surface, so the watch list is the scope assertion. Exit 3 (internal
    // error — the gate could not run), never 1, which asserts real drift.
    try {
        assertWatchlistResolves({
            gate: 'check_release_published',
            candidates: [path.relative(REPO_ROOT, PACKAGE_JSON)],
            repoRoot: REPO_ROOT,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 3;
        }
        throw exc;
    }

    let version: string;
    try {
        version = hooks._package_version();
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  cannot read package.json version: ${msg}\n`);
        return 3;
    }
    if (!SEMVER_RE.test(version)) {
        process.stderr.write(`❌  package.json version is not semver: ${_pyRepr(version)}\n`);
        return 3;
    }

    if (args.require_main && !hooks._on_main()) {
        process.stdout.write(`ℹ️  not on ${MAIN_BRANCH} — release-published gate skipped.\n`);
        return 0;
    }

    const problems: string[] = [];

    if (!hooks._tag_exists(version)) {
        problems.push(
            `package.json is ${version} but no git tag ${version} exists ` +
                `on origin — the release was bumped/merged but never tagged, ` +
                `or the tag push never landed. Complete it: tag the ` +
                `release-merge commit and push ` +
                `(triggers publish-npm.yml), e.g. \`git tag ${version} && git ` +
                `push origin ${version}\`.`,
        );
    }

    if (args.check_npm) {
        const pkg = hooks._package_name();
        const latest = hooks._npm_latest(pkg);
        if (latest === null) {
            process.stderr.write(
                `⚠️  could not read npm dist-tags.latest for ${pkg} ` +
                    `(network/registry) — npm invariant not checked.\n`,
            );
        } else if (latest !== version) {
            problems.push(
                `npm ${pkg}@latest is ${latest} but package.json is ${version} ` +
                    `— the published release lags main. Check publish-npm.yml ` +
                    `for tag ${version}, or re-dispatch it.`,
            );
        }
    }

    if (problems.length === 0) {
        const suffix = args.check_npm ? ' + npm' : '';
        process.stdout.write(`✅  release-published: ${version} is tagged${suffix} and in sync.\n`);
        return 0;
    }

    const header = args.strict
        ? '❌  Release-published drift:'
        : '⚠️  Release-published drift (warn-only):';
    process.stderr.write(`${header}\n`);
    for (const p of problems) {
        process.stderr.write(`  - ${p}\n`);
    }
    return args.strict ? 1 : 0;
}

/** Python `repr()` of a single string (for the non-semver error message). */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + ch;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ch;
    }
    return out + quote;
}

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
    process.exit(main(process.argv.slice(2)));
}

export {
    type Hooks,
    SEMVER_RE,
    REPO_ROOT,
    PACKAGE_JSON,
    MAIN_BRANCH,
    _package_version,
    _package_name,
    _tag_exists,
    _on_main,
    _npm_latest,
    _hooks,
    parse_args,
    main,
};
