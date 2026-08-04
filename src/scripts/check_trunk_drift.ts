/**
 * Pre-PR trunk-drift check (road-to-product-clarity Phase 4b).
 *
 * Fails when the current branch is behind origin/main — i.e. origin/main is NOT
 * an ancestor of HEAD — so a PR is never opened on a stale base (the recurring
 * divergence this session hit). Advisory by default: run it in the /create-pr
 * pre-flight or wire into CI per your branch-protection policy.
 *
 *   git merge-base --is-ancestor origin/main HEAD   → exit 0 = up to date
 *
 * Pure core (`driftVerdict`) is unit-testable without git.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

export type DriftInput = {
    /** True when origin/main is an ancestor of HEAD (branch contains trunk tip). */
    trunkIsAncestor: boolean;
    /** Commits HEAD is behind origin/main (0 when up to date). */
    behind: number;
};

export type DriftVerdict = { ok: boolean; message: string };

/** Pure decision — no git. */
export function driftVerdict(i: DriftInput): DriftVerdict {
    if (i.trunkIsAncestor) {
        return { ok: true, message: '✅  branch is up to date with origin/main' };
    }
    return {
        ok: false,
        message: `❌  branch is ${i.behind} commit(s) behind origin/main — rebase/merge before opening a PR`,
    };
}

function _git(args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf-8' }).trim();
}

export function main(): number {
    let input: DriftInput;
    let trunkCommits = 0;
    try {
        _git(['fetch', 'origin', 'main', '--quiet']);
        // The comparison is only meaningful against a trunk that has history.
        // An origin/main pointing at an empty/orphan ref answers "0 behind" and
        // scores the branch up to date without ever having read a trunk commit.
        trunkCommits = Number(_git(['rev-list', '--count', 'origin/main']) || '0');
        let isAncestor = true;
        try {
            execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { stdio: 'ignore' });
        } catch {
            isAncestor = false;
        }
        const behind = Number(_git(['rev-list', '--count', 'HEAD..origin/main']) || '0');
        input = { trunkIsAncestor: isAncestor, behind };
    } catch (e) {
        process.stdout.write(`⚠️  trunk-drift check skipped (no origin/main or git error): ${String(e)}\n`);
        return 0; // advisory — never block on a missing remote
    }
    try {
        assertScanned({
            gate: 'check_trunk_drift',
            scanned: trunkCommits,
            units: 'trunk commit(s)',
            roots: ['origin/main'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 is the only failure code; 0 means pass/advisory-skip, so a dead
            // scope must not borrow it — a gate that read no trunk has not passed.
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const v = driftVerdict(input);
    process.stdout.write(`${v.message}\n`);
    return v.ok ? 0 : 1;
}

const _HERE = fileURLToPath(import.meta.url);
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

if (_isCliEntry()) {
    process.exit(main());
}
void _HERE;
