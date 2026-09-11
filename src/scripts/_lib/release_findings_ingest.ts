/**
 * The release's side of the findings-ledger contract: verification, not
 * production.
 *
 * WHY THE CONTRACT EXISTS. The findings ledger is the durable record a release
 * makes about what its own review found, and `check_finding_dispositions`
 * treats an absent one for a SHIPPED version as a failure — repo-wide, because
 * the same check runs on every pull request. Producing it was documented and
 * unowned: the self-review workflow uploaded an artifact and its own comment
 * said a human should run `--ingest`. Nobody did, so the ledger went missing
 * once per release, six times between 14.19.0 and 15.0.0, and each absence was
 * cleared by whoever happened to be pushing an unrelated change.
 *
 * WHY THE INGEST IS NOT HERE. Two review rounds established that no placement
 * inside `release.ts` works. `finding-dispositions` runs on the release PR and
 * reds while the ledger lacks a finding the review reported, so a step that
 * produced the ledger after the check wait could never run — the wait had
 * already died on that red check — and a step that produced it before the wait
 * pushed a commit the wait then had to redo, on a head whose checks had not
 * started. The owner's decision on 2026-09-11 was to move the ingest into the
 * workflow that already holds the artifact, which is the one place where the
 * ledger can exist before any gate looks for it.
 *
 * WHY THE PUSH NEEDS A PAT. A third review round found that the move alone did
 * not fix the ordering, it relocated it: the ingest job is a check run of the
 * same `pull_request` event, so its push lands inside the release's own check
 * wait — and a push authenticated with GITHUB_TOKEN creates no run, leaving a
 * head with zero checks against a protection that requires one. The job pushes
 * with `RELEASE_PR_TOKEN` instead, the pattern `release.yml` already uses, so
 * the push produces the checks the wait is waiting for. Without that secret the
 * job declines to push at all rather than produce the deadlock, and the absence
 * arrives here as a missing ledger with the cause named.
 *
 * WHAT IS LEFT HERE. Two questions and a stop for each: is the ledger on the
 * REMOTE branch, and does the disposition gate pass. Neither is repaired by
 * the release — filling a disposition states what the release ships, with a
 * rationale and a named verifier, and no automation writes one.
 */

/** Where a release's ledger lives, relative to the repository root. */
export function ledgerRelPath(version: string): string {
    return `agents/evidence/release-findings/${version}.json`;
}

/**
 * The workflow that produces and commits the ledger, named so a message can
 * point the operator at the right run log.
 *
 * A rename there without one here is caught by
 * `release_findings_ingest.test.ts`, which reads the workflow file rather than
 * trusting this string.
 */
export const FINDINGS_WORKFLOW = 'self-review-gate.yml';

/**
 * Argv proving the ledger is on the REMOTE branch — the only ref that answers
 * the question the release is asking.
 *
 * Three refs give three different answers and only one is right. The working
 * tree says "a file exists here", which a by-hand ingest also satisfies. The
 * LOCAL branch ref says "a commit here carries it", which a commit that failed
 * to push has already made true — so probing it answers identically to the
 * filesystem in exactly the case the probe exists for, which is the defect a
 * second review round caught in the first attempt at this fix. The
 * remote-tracking ref is the one that goes false when a push fails, and the
 * merge reads the remote.
 *
 * `remote` is a parameter rather than a constant so a fork or a mirror is not
 * silently assumed to be `origin`.
 */
export function ledgerOnBranchArgv(remote: string, branch: string, rel: string): string[] {
    return ['cat-file', '-e', `${remote}/${branch}:${rel}`];
}

/**
 * Why the release refuses to continue without a ledger on the branch.
 *
 * Continuing would merge and tag with no ledger, and an absent ledger becomes a
 * repo-wide failure the moment the tag exists — that is the six-release failure
 * this mechanism ends, so it is a stop rather than a warning.
 *
 * The causes are named because the operator has to pick one and most of them
 * are ordinary. With the ingest in CI, "it has not happened yet" is the common
 * case and waiting is the answer; a repository without the review secret never
 * gets one at all and needs the ledger by hand, once per release, which is a
 * real cost and is stated here rather than discovered.
 */
export function ledgerAbsentMessage(version: string, branch: string, remote: string): string {
    return (
        `${ledgerRelPath(version)} is not on ${remote}/${branch}.\n` +
        '  The release stops: continuing would merge and tag with no findings ledger, and an ' +
        'absent ledger for a shipped version reds every pull request in the repository.\n' +
        `  The ${FINDINGS_WORKFLOW} workflow commits it to the release branch once it has ` +
        'reviewed the head. Ordinary causes, in the order to check them: the review has not ' +
        'finished yet (wait, then resume); the review found nothing and its commit is still in ' +
        'flight (same); no ANTHROPIC_API_KEY, so no review ran and no ledger will appear — write ' +
        `one with a no_findings_reason and push it to ${branch}; no RELEASE_PR_TOKEN, in which ` +
        'case the job refuses to push rather than deadlock this wait and says so as a warning in ' +
        'its run log — configure the PAT, or write the ledger by hand; or the workflow could not ' +
        'push, which its run log will say.\n' +
        '  Then: `git pull` on the release branch, and resume.'
    );
}

/**
 * Why the release refuses to continue when the PR is already merged and the
 * ledger is not on the trunk either.
 *
 * This is the state the whole mechanism exists to prevent, reached the one way
 * that survives every guard before it: the ingest produced nothing, step 7
 * stopped, and the PR was merged by hand anyway. A resumed run then finds
 * `state === 'MERGED'` and — until this check existed — printed "the ledger
 * rode in with it" without reading anything, tagged, and published. The absent
 * ledger for a shipped version is what reds every pull request in the
 * repository, so the assertion had to become a question.
 *
 * The release branch is gone by now, so there is no workflow run left to wait
 * for: the remaining path is a ledger written onto the trunk by hand.
 */
export function ledgerAbsentAfterMergeMessage(
    version: string,
    trunk: string,
    remote: string,
): string {
    return (
        `${ledgerRelPath(version)} is on neither the release branch nor ${remote}/${trunk}, and ` +
        'the release pull request is already merged.\n' +
        '  The release stops: tagging now ships a version whose findings ledger does not exist, ' +
        'and an absent ledger for a shipped version reds every pull request in the repository.\n' +
        `  The release branch is gone, so the ${FINDINGS_WORKFLOW} run that would have committed ` +
        'the ledger cannot be waited for. Write the ledger on the trunk instead — the review for ' +
        'this version is in its own workflow run, or record a no_findings_reason if none ran — ' +
        'push it, and resume.'
    );
}

/**
 * The message a release stops with when the disposition gate refuses.
 *
 * `blocking` is what the release could count itself: findings that are blocking
 * and carry no `status`. It is deliberately NOT presented as the reason — the
 * gate refuses for more shapes than that (an unknown status, an empty rationale
 * or verifier, a `fixed` with no commit, a malformed ledger, an undeterminable
 * release status), and an earlier version of this message asserted "N blocking
 * … carry no disposition" for every one of them. At N = 0 that produced an
 * instruction nobody could follow.
 *
 * So the gate's own output is the reason, passed in and printed, and this text
 * only says where the file is, why the release stopped, and how to resume.
 */
export function dispositionStopMessage(
    version: string,
    gateOutput: string,
    blocking: number,
    resumeCmd: string,
): string {
    const count =
        blocking > 0 ? `  ${blocking} of them are blocking findings with no status yet.\n` : '';
    return (
        `the disposition gate refuses ${version}. Its own report:\n` +
        `${gateOutput.trim() || '  (the gate printed nothing — run it directly to see why)'}\n` +
        count +
        `  The ledger is at ${ledgerRelPath(version)} and the release stops here by design: a ` +
        'disposition is an adjudication of what this release ships, with a rationale and a ' +
        'named verifier, and no automation may write one.\n' +
        `  Resolve what the report names, push the release branch, then: ${resumeCmd}`
    );
}
