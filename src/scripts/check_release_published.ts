#!/usr/bin/env tsx
/**
 * Release-published drift gate.
 *
 * TypeScript twin of `src/scripts/check_release_published.py` (ADR-089,
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
 *   1. Tag invariant (always checkable, no network): the version in
 *      `package.json` MUST have a matching git tag (local or remote).
 *   2. npm invariant (`--check-npm`, network): `npm view <pkg>
 *      dist-tags.latest` MUST equal the `package.json` version.
 *
 * Exit codes: 0 = pass / no-op · 1 = drift detected · 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

function _tag_exists(tag: string): boolean {
    const [rc, out] = _git('tag', '-l', tag);
    if (rc === 0 && out.split('\n').includes(tag)) {
        return true;
    }
    const [rc2] = _git('ls-remote', '--exit-code', '--tags', 'origin', tag);
    return rc2 === 0;
}

function _on_main(): boolean {
    // Local checkout, CI push ref, or CI scheduled ref all map to main.
    const ref = process.env.GITHUB_REF ?? '';
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
        return true;
    }
    const [rc, head] = _git('rev-parse', '--abbrev-ref', 'HEAD');
    return rc === 0 && head === MAIN_BRANCH;
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
                `(local or origin) — the release was bumped/merged but never ` +
                `tagged. Complete it: tag the release-merge commit and push ` +
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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
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
