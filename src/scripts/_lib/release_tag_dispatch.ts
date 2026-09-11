/**
 * The `--ci` fallback dispatch of the three tag-triggered workflows.
 *
 * Extracted from `release.ts` as a lowering commit under
 * `check_source_size_budget`, whose own contract names splitting an
 * over-ceiling file as the improvement it exists to force. The block is
 * self-contained — three workflow names, one loop, one warning — and nothing
 * else in step 10 reads it.
 *
 * WHY IT EXISTS. A tag pushed with the default `GITHUB_TOKEN` fires no
 * tag-triggered workflow: GitHub's recursion guard suppresses the event. All
 * three workflows accept a `tag` input for exactly this recovery, so under
 * `--ci` the release dispatches them rather than waiting for an event that will
 * never arrive. When the tag was pushed with a PAT they already fired and this
 * is redundant.
 *
 * WHY IT NEVER FAILS THE RELEASE. By the time it runs the release is complete —
 * the tag is pushed, the GitHub Release is created, npm publishes
 * asynchronously. Dispatching through the API additionally needs the token's
 * `actions:write` scope, and a 403 for a missing scope must not mark an
 * already-shipped release as failed. So it warns and continues.
 */

/** The tag-triggered workflows, in the order the release dispatches them. */
export const TAG_TRIGGERED_WORKFLOWS = [
    'release-guard.yml',
    'publish-npm.yml',
    'cloud-release.yml',
] as const;

interface DispatchRunResult {
    returncode: number;
}

export interface TagDispatchDeps {
    run: (argv: string[], opts: { check: boolean }) => DispatchRunResult;
    /** Where a non-fatal dispatch failure is reported. */
    warn: (s: string) => void;
    /** The ref the dispatch runs against — the trunk. */
    trunk: string;
}

/** Why one failed dispatch is a warning and not a stop, said to the operator. */
export function dispatchWarning(workflow: string, code: number, version: string): string {
    return (
        `⚠️  Could not dispatch ${workflow} (exit ${code}) — the release ${version} is ` +
        `already complete (tag + GitHub Release created; npm publishes async). If the tag was ` +
        `pushed with a PAT, ${workflow} already fired on the tag push. If you rely on the explicit ` +
        `dispatch, grant RELEASE_PR_TOKEN the "Actions: read and write" scope (fine-grained PAT) ` +
        `or the "workflow" scope (classic PAT).\n`
    );
}

export function dispatchTagWorkflows(deps: TagDispatchDeps, version: string): void {
    for (const wf of TAG_TRIGGERED_WORKFLOWS) {
        const r = deps.run(['gh', 'workflow', 'run', wf, '--ref', deps.trunk, '-f', `tag=${version}`], {
            check: false,
        });
        if (r.returncode !== 0) {
            deps.warn(dispatchWarning(wf, r.returncode, version));
        }
    }
}
