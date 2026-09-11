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
import * as fs from 'node:fs';
import * as path from 'node:path';

import { isBlocking, parse_ledger } from '../check_finding_dispositions.js';


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

/** The release's own subprocess result shape, mirrored so this module stays free of it. */
interface StepRunResult {
    returncode: number;
    stdout: string;
    stderr: string;
}

/**
 * What the step needs from the release script, injected rather than imported.
 *
 * `release.ts` sits past the source-size cap where every line is charged, and
 * this step is the release's side of the contract this module already owns — so
 * it lives here. Injection rather than an import of `release_publication.ts`
 * keeps `_lib` free of a dependency on its own caller.
 */
export interface LedgerStepDeps {
    run: (argv: string[], opts: { check: boolean; capture: boolean }) => StepRunResult;
    die: (msg: string) => never;
    /** Prints the step banner, so the caller keeps the step number. */
    step: (msg: string) => void;
    /** Where the step reports the ref it read. */
    write: (s: string) => void;
    /** Absolute repository root, for resolving the ledger on disk. */
    repoRoot: string;
    /** Remote name, never assumed to be `origin`. */
    remote: string;
    /** The trunk the release merges into — the ref to ask once the branch is gone. */
    trunk: string;
    /**
     * The PR number for `--pr`, resolved late.
     *
     * Late because the release probes its PR once at the top and only on a
     * resumed run, so on a first run the number was null here and `--pr` was
     * silently dropped — and the release then passed a strictly weaker check
     * than `finding-dispositions`, learning about an un-ingested finding from
     * CI instead. By the time this step runs the PR exists either way.
     */
    resolvePr: () => number | null;
}

/**
 * Verify the release carries its own findings ledger, or stop.
 *
 * VERIFIES, NEVER PRODUCES — the why is the module docstring above. Placed
 * between the check wait and the merge: the ledger lives on the release branch
 * and the merge deletes it, so this is the last moment the question means
 * anything, and after the wait so a red `finding-dispositions` has already
 * stopped the release with the check's own name rather than a duplicate of it.
 *
 * Two questions, each answered with a stop:
 *
 *   1. Is the ledger on the ref the merge will read? On an open PR that is the
 *      remote release branch; once the PR is merged the branch is deleted and
 *      the ledger, if it was ever produced, rode into the trunk. The merged
 *      path used to ask nothing and assert the good case.
 *   2. Does the disposition gate pass, in `--pr` mode — the same mode CI uses,
 *      so the release cannot pass a weaker check than the one it is trying to
 *      pre-satisfy.
 *
 * Neither answer is repaired here. Filling a disposition states what the release
 * ships, with a rationale and a named verifier; no automation writes one.
 */
export function settleFindingsLedger(
    deps: LedgerStepDeps,
    version: string,
    branch: string,
    merged: boolean,
): void {
    deps.step(
        merged
            ? 'Verify the findings ledger rode in with the merge'
            : 'Verify the self-review findings ledger',
    );
    const rel = ledgerRelPath(version);
    const ref = merged ? deps.trunk : branch;

    // REFRESH BEFORE READING, AND FAST-FORWARD BEFORE ASKING THE GATE. Both
    // halves are a defect a fourth review measured, and they are the same
    // defect seen from two sides. `cat-file -e <remote>/<ref>:<path>` reads
    // `.git`, not GitHub — and nothing in a first run refreshes that
    // remote-tracking ref after CI commits the ledger: preflight fetches before
    // the branch exists, and step 4's push sets the ref to the pushed commit,
    // which is strictly older than the ledger commit. So the probe answered
    // "absent" on every first release. The disposition gate then reads the
    // WORKING TREE, which the same push left equally stale, so a fetch alone
    // would fix the probe and hand the gate an empty ledger instead.
    //
    // `--ff-only` on purpose: the release pushed this ref itself, so the only
    // commit ahead of it should be CI's. Anything else means the branch moved
    // under the run, and stopping is better than merging a tree nobody read.
    // Both are `check: false` — a fetch that fails leaves the probe to report
    // the absence with a message that says what to do.
    deps.run(['git', 'fetch', deps.remote, ref], { check: false, capture: true });
    deps.run(['git', 'pull', '--ff-only', deps.remote, ref], { check: false, capture: true });

    const onBranch =
        deps.run(['git', ...ledgerOnBranchArgv(deps.remote, ref, rel)], {
            check: false,
            capture: true,
        }).returncode === 0;
    if (!onBranch) {
        deps.die(
            merged
                ? ledgerAbsentAfterMergeMessage(version, deps.trunk, deps.remote)
                : ledgerAbsentMessage(version, branch, deps.remote),
        );
    }
    deps.write(`    ledger on ${deps.remote}/${ref}: ${rel}\n`);

    const argv = ['./scripts-run', 'src/scripts/check_finding_dispositions', '--release', version];
    const pr = deps.resolvePr();
    if (pr !== null) {
        argv.push('--pr', String(pr));
    }
    const verdict = deps.run(argv, { check: false, capture: true });
    if (verdict.returncode !== 0) {
        deps.die(
            dispositionStopMessage(
                version,
                // BOTH streams. The gate writes its scan line to stdout and its
                // per-finding diagnosis to stderr, so preferring stdout showed
                // the operator `scanned: N` and discarded the entire reason the
                // release stopped.
                [verdict.stdout, verdict.stderr].map((s) => s.trim()).filter(Boolean).join('\n'),
                blockingWithoutDisposition(path.join(deps.repoRoot, rel)),
                'task release -- --resume --yes',
            ),
        );
    }
}

/**
 * How many blocking findings carry no status — a figure for the stop message,
 * never the reason for it.
 *
 * The gate refuses for more shapes than this counts (an unknown status, an
 * empty rationale or verifier, a `fixed` with no commit, a malformed ledger),
 * which is why the gate's own output is what the operator is shown.
 */
function blockingWithoutDisposition(ledgerAbs: string): number {
    if (!fs.existsSync(ledgerAbs)) {
        return 0;
    }
    try {
        const ledger = parse_ledger(fs.readFileSync(ledgerAbs, 'utf-8'), ledgerAbs);
        return ledger.findings.filter((f) => isBlocking(f) && !f.status).length;
    } catch {
        return 0;
    }
}
