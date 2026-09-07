/**
 * Where a release may START — the branch it may run from, and whether a dirty
 * working tree is tolerated there.
 *
 * Its own module because `release.ts` sits 456 lines over the 1500-line source
 * ratchet, so growing it is a gate failure by construction. `_lib/` is where
 * `release_highlights.ts` and `release_material.ts` already put the predicates
 * the pipeline and its gates share.
 */

export interface PositionVerdict {
    proceed: boolean;
    /** Printed before the run continues. Never a refusal. */
    notice?: string;
    /** Printed on refusal (no trailing newline). */
    message?: string;
}

/**
 * Where a release may START, resolved as a pure verdict (no I/O, so it is
 * unit-testable — same shape as `confirmGate`).
 *
 * THE DEADLOCK THIS REMOVES.
 *
 * `guard_release_curation` refuses BETWEEN step 2 and step 3: step 1 has
 * already created and checked out `release/{target}`, step 2 has already
 * written the bump, the changelog section and every regenerated derived file,
 * and nothing is committed yet. Its message says to curate the head and re-run
 * `task release`. Measured on 14.19.0, neither re-run reached step 1:
 *
 *   - `task release`            → `release must run from 'main'` (this check)
 *   - `task release --resume`   → `working tree is not clean` (this check)
 *
 * So the guard prescribed a remedy the preflight refused, in both spellings,
 * and the only way through was to hand-craft the `release: X.Y.Z` commit the
 * pipeline makes for itself one step later.
 *
 * `docs/release-runbook.md` already claimed this was closed on 2026-09-03 and
 * the drill pins `plain-run-reuses-an-existing-branch` for it. Both were true
 * of the fix that landed — in `checkout_release_branch`, which is STEP 1. The
 * preflight runs before step 1, so from the release branch the run never
 * arrived at the code that had been repaired. The claim was not wrong about
 * step 1; it was wrong that step 1 was reachable from that position.
 *
 * Why `release/{target}` is a legitimate start, with or without `--resume`:
 *
 * It is the position the pipeline itself leaves behind. `--resume` remains
 * meaningful for what it was always for — skipping a COMMIT, a PR, a tag or a
 * Release that already exists — and the `!resume` tag-exists check in
 * `preflight` still refuses a plain re-run of an already-tagged version.
 *
 * Why a dirty tree is accepted THERE and nowhere else:
 *
 * On `release/{target}` the dirt is this pipeline's own step-2 output, and
 * step 3 sweeps it with `git add -A` regardless. Refusing it can therefore
 * only ever fire against the tool's own state. On `main` the same tree is an
 * operator's unrelated work about to be swept into a release commit, so the
 * refusal stays exactly as it was. The accepted files are PRINTED rather than
 * absorbed silently, and `check_release_pr_shape` still refuses anything
 * outside the version-bump allowlist on the resulting PR — two nets under the
 * one place this relaxes.
 */
export function preflightPosition(opts: {
    branch: string;
    mainBranch: string;
    releaseBranch: string;
    porcelain: string;
}): PositionVerdict {
    const { branch, mainBranch, releaseBranch, porcelain } = opts;
    if (branch !== mainBranch && branch !== releaseBranch) {
        return {
            proceed: false,
            message:
                `release must run from '${mainBranch}' or '${releaseBranch}', ` +
                `currently on '${branch}'`,
        };
    }
    if (!porcelain.trim()) {
        return { proceed: true };
    }
    if (branch === mainBranch) {
        return { proceed: false, message: 'working tree is not clean; commit or stash first' };
    }
    return {
        proceed: true,
        notice:
            `working tree is not clean, and on '${releaseBranch}' that is this pipeline's own ` +
            'step-2 output — step 3 commits it with `git add -A`. Files that will be swept ' +
            'into the release commit:\n' +
            porcelain
                .split('\n')
                .filter((l) => l.trim())
                .map((l) => `      ${l}`)
                .join('\n'),
    };
}
