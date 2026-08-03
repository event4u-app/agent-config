/**
 * Release-surface equality gate (release-truth Phase 1).
 *
 * Asserts `normalized(release-PR body) == normalized(CHANGELOG entry)` for
 * the version a release PR carries — whitespace/anchor normalization only,
 * never "similar". The recorded failure this closes: at 9.14.0 the PR body
 * and the merged changelog disagreed on scope and test count because the
 * surfaces were rendered at different times; with `release.ts` deriving every
 * surface from the changelog section this gate proves the derivation held at
 * the head CI actually sees.
 *
 * Usage:
 *   check_release_surface_equality --pr <number>            # fetch body via gh
 *   check_release_surface_equality --body-file <path>       # fixture / local
 *       [--changelog <path>] [--version <X.Y.Z>]
 *
 * `--version` defaults to package.json's version (the release PR has already
 * bumped it). Exit codes: 0 equal · 1 divergence · 2 usage/extraction error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    extract_changelog_section,
    strip_pr_wrapper,
    surface_divergence,
} from './_lib/release_material.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface EqualityInput {
    prBody: string;
    changelogText: string;
    version: string;
}

export interface EqualityResult {
    ok: boolean;
    reason: string | null;
}

/** Pure core — the CLI and the release-validation job both run exactly this. */
export function check_surface_equality(input: EqualityInput): EqualityResult {
    const section = extract_changelog_section(input.changelogText, input.version);
    if (!section) {
        return {
            ok: false,
            reason: `CHANGELOG carries no section for ${input.version}`,
        };
    }
    const middle = strip_pr_wrapper(input.prBody, input.version);
    if (middle === null) {
        return {
            ok: false,
            reason:
                `PR body does not carry the canonical "Release ${input.version}." prefix — ` +
                'it was not generated from the changelog section',
        };
    }
    const divergence = surface_divergence(middle, section.body);
    return divergence === null ? { ok: true, reason: null } : { ok: false, reason: divergence };
}

function _pr_body(prNumber: string): string {
    const r = spawnSync('gh', ['pr', 'view', prNumber, '--json', 'body', '-q', '.body'], {
        encoding: 'utf-8',
    });
    if (r.status !== 0) {
        process.stderr.write(`gh pr view ${prNumber} failed: ${r.stderr}\n`);
        process.exit(2);
    }
    return r.stdout;
}

function main(argv: readonly string[]): number {
    let pr: string | null = null;
    let bodyFile: string | null = null;
    let changelogPath = path.join(REPO_ROOT, 'CHANGELOG.md');
    let version: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--pr') pr = argv[++i] ?? null;
        else if (a === '--body-file') bodyFile = argv[++i] ?? null;
        else if (a === '--changelog') changelogPath = argv[++i] ?? changelogPath;
        else if (a === '--version') version = argv[++i] ?? null;
        else {
            process.stderr.write(`unknown argument: ${a}\n`);
            return 2;
        }
    }
    if ((pr === null) === (bodyFile === null)) {
        process.stderr.write('exactly one of --pr / --body-file is required\n');
        return 2;
    }
    if (version === null) {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
        ) as Record<string, unknown>;
        version = String(pkg['version']);
    }
    const prBody = pr !== null ? _pr_body(pr) : fs.readFileSync(bodyFile!, 'utf-8');
    const changelogText = fs.readFileSync(changelogPath, 'utf-8');
    const result = check_surface_equality({ prBody, changelogText, version });
    if (result.ok) {
        process.stdout.write(`✅  release surfaces equal for ${version}\n`);
        return 0;
    }
    process.stderr.write(
        `❌  release-surface divergence for ${version}: ${result.reason}\n` +
            '    The PR body must equal the CHANGELOG entry (whitespace-normalized). ' +
            'Regenerate it: task release -- --resume --yes (or gh pr edit with the section body).\n',
    );
    return 1;
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
    process.exit(main(process.argv.slice(2)));
}
