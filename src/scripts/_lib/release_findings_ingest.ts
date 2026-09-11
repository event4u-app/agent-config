/**
 * The release step that turns a self-review artifact into a committed ledger.
 *
 * WHY THIS EXISTS. The findings ledger is the durable record a release makes
 * about what its own review found, and `check_finding_dispositions` treats an
 * absent one for a SHIPPED version as a failure — repo-wide, because the same
 * check runs on every pull request. Producing it was documented and unowned:
 * the self-review workflow uploads an artifact and its own comment says a human
 * must run `--ingest`, and the release flow never mentions findings at all.
 * Nothing ran the step, so the ledger went missing once per release, six times
 * between 14.19.0 and 15.0.0 — and each time the red was cleared by whoever
 * happened to be pushing an unrelated change, under time pressure, on a record
 * that is supposed to be deliberate.
 *
 * WHERE THE STEP BELONGS, and it is not where it looks. The natural place is
 * "just before the tag", because the tag is what flips an absent ledger from a
 * normal in-flight state into a failure. That is too late: the ledger is read
 * off the release BRANCH by the `finding-dispositions` job, and after the merge
 * the branch is gone. So the step runs after the checks settle and before the
 * merge, while the branch that must carry the file still exists.
 *
 * WHAT IT DOES NOT DO. It never writes a disposition. Ingest produces findings
 * with empty dispositions on purpose, and filling them is an adjudication of
 * what the release is shipping — a human judgement with a rationale and a named
 * verifier per finding. This module's whole contribution is that the judgement
 * is demanded at the release, on the branch, before the tag, instead of being
 * discovered by a stranger three days later on someone else's pull request.
 */

/** Where a release's ledger lives, relative to the repository root. */
export function ledgerRelPath(version: string): string {
    return `agents/evidence/release-findings/${version}.json`;
}

/**
 * The workflow whose run carries the findings artifact, and the artifact's own
 * name. Both are literals in `.github/workflows/self-review-gate.yml`; a rename
 * there without one here is caught by `release_findings_ingest.test.ts`, which
 * reads the workflow rather than trusting these strings.
 */
export const FINDINGS_WORKFLOW = 'self-review-gate.yml';
export const FINDINGS_ARTIFACT = 'self-review-findings';

/** Argv for the run lookup — newest run of the findings workflow on `branch`. */
export function runLookupArgv(branch: string): string[] {
    return [
        'run',
        'list',
        '--workflow',
        FINDINGS_WORKFLOW,
        '--branch',
        branch,
        '--limit',
        '10',
        '--json',
        'databaseId,conclusion,createdAt',
    ];
}

/** Argv for the artifact download of `runId` into `dest`. */
export function downloadArgv(runId: number, dest: string): string[] {
    return ['run', 'download', String(runId), '--name', FINDINGS_ARTIFACT, '--dir', dest];
}

/**
 * Argv proving the ledger is committed on `branch`, not merely present on disk.
 *
 * `fs.existsSync` answers a different question, and the difference is reachable:
 * a push that failed after the ingest commit leaves the file local, and a later
 * resume would read "already on the branch" off its own working tree, skip the
 * retry, and merge a head with no ledger — restoring the failure under a line
 * asserting the opposite. A stray by-hand ingest produces the same false skip.
 */
export function ledgerOnBranchArgv(branch: string, rel: string): string[] {
    return ['cat-file', '-e', `${branch}:${rel}`];
}

export interface WorkflowRun {
    databaseId: number;
    conclusion: string | null;
    createdAt: string;
}

/**
 * The finished runs whose artifact is worth trying, newest first.
 *
 * A LIST, not a pick, and that is the correction: eligibility cannot be read
 * off a run's conclusion, because the artifact is CONDITIONAL. The workflow
 * uploads with `if-no-files-found: ignore`, and the review script returns 0
 * without writing the file on several paths — no API key, no reviewable files,
 * no chunk completed, an exception. Each of those is a finished run with
 * conclusion `success` and no artifact. Keying on conclusion made the designed
 * "no artifact anywhere" branch unreachable and turned the common case into a
 * raw download failure, so the caller walks this list and lets absence be the
 * answer.
 *
 * `conclusion: null` is dropped (in flight) and `cancelled` is dropped (a newer
 * push superseded it, so its artifact is partial at best). Everything else is
 * tried, `failure` included: a `failure` conclusion here means the dry-run job
 * failed, since the review job is `continue-on-error` and cannot redden the
 * run — so refusing it would skip a run whose artifact is perfectly good.
 */
export function eligibleRuns(runs: readonly WorkflowRun[]): WorkflowRun[] {
    return runs
        .filter((r) => r.conclusion !== null && r.conclusion !== 'cancelled')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type IngestOutcome =
    /** The ledger is already committed on the branch; nothing to fetch. */
    | { kind: 'present' }
    /** No finished run at all — distinct from finished-but-carrying-no-artifact. */
    | { kind: 'no-run'; branch: string }
    /** Try these runs newest-first; absence of an artifact is not an error here. */
    | { kind: 'ingest'; runIds: number[] };

/** What the release step should do, given the ledger state and the run list. */
export function planIngest(
    ledgerOnBranch: boolean,
    runs: readonly WorkflowRun[],
    branch: string,
): IngestOutcome {
    if (ledgerOnBranch) {
        return { kind: 'present' };
    }
    const usable = eligibleRuns(runs);
    return usable.length === 0
        ? { kind: 'no-run', branch }
        : { kind: 'ingest', runIds: usable.map((r) => r.databaseId) };
}

/**
 * Why the release refuses to continue without a ledger.
 *
 * Reached when no finished run carried an artifact. Continuing would merge and
 * tag with no ledger, which is the six-release failure this step exists to end —
 * so it is a stop, not a warning. The three ways to get here are named because
 * the operator has to pick one, and two of them are ordinary situations rather
 * than breakage.
 */
export function noArtifactMessage(version: string, branch: string, runsSeen: number): string {
    return (
        `no ${FINDINGS_ARTIFACT} artifact for ${version} on ${branch} ` +
        `(${runsSeen} finished ${FINDINGS_WORKFLOW} run(s) checked).\n` +
        '  The release stops rather than warns: continuing would merge and tag with no ledger, ' +
        'which is exactly the state this step exists to prevent, and an absent ledger becomes a ' +
        'repo-wide failure the moment the tag exists.\n' +
        '  Three ordinary causes: the review has not finished (do not use --no-wait for a ' +
        'release), no ANTHROPIC_API_KEY so the review was a no-op, or the run produced no ' +
        'findings file. Settle the review, or commit a ledger with a no_findings_reason by hand, ' +
        'then resume.'
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
        blocking > 0
            ? `  ${blocking} of them are blocking findings with no status yet.\n`
            : '';
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
