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
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

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
    try {
        _git(['fetch', 'origin', 'main', '--quiet']);
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
    const v = driftVerdict(input);
    process.stdout.write(`${v.message}\n`);
    return v.ok ? 0 : 1;
}

const _HERE = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
void _HERE;
