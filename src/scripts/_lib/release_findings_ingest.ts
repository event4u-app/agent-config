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

export interface WorkflowRun {
    databaseId: number;
    conclusion: string | null;
    createdAt: string;
}

/**
 * The run whose artifact to ingest: the newest one that actually finished.
 *
 * `conclusion` is null while a run is in flight and `cancelled` when a newer
 * push superseded it; neither has a complete artifact, and taking the newest
 * row unconditionally would download a partial review on a branch that was
 * pushed twice. A `failure` run IS eligible — the review job is
 * `continue-on-error` and uploads its artifact on `always()`, so a red run can
 * still carry the findings, and refusing it would reintroduce the gap on
 * exactly the releases most likely to have findings.
 */
export function pickRun(runs: readonly WorkflowRun[]): WorkflowRun | null {
    const usable = runs
        .filter((r) => r.conclusion === 'success' || r.conclusion === 'failure')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return usable[0] ?? null;
}

export type IngestOutcome =
    /** The ledger already exists on the branch; nothing to fetch. */
    | { kind: 'present' }
    /** No finished run carries an artifact — the reason is the operator's to read. */
    | { kind: 'no-run'; branch: string }
    /** An artifact was found and should be ingested from `runId`. */
    | { kind: 'ingest'; runId: number };

/** What the release step should do, given the ledger state and the run list. */
export function planIngest(
    ledgerExists: boolean,
    runs: readonly WorkflowRun[],
    branch: string,
): IngestOutcome {
    if (ledgerExists) {
        return { kind: 'present' };
    }
    const run = pickRun(runs);
    return run === null ? { kind: 'no-run', branch } : { kind: 'ingest', runId: run.databaseId };
}

/**
 * The message a release stops with when findings are ingested and undecided.
 *
 * It names the file, the count and the resume command, because the operator
 * reading it has a merged-or-unmerged release branch in front of them and the
 * next action is not guessable from the failure alone.
 */
export function undispositionedMessage(
    version: string,
    blocking: number,
    resumeCmd: string,
): string {
    return (
        `${blocking} blocking self-review finding(s) for ${version} carry no disposition.\n` +
        `  The ledger is committed at ${ledgerRelPath(version)} and the release stops here ` +
        'by design: a disposition is an adjudication of what this release ships, with a ' +
        'rationale and a named verifier, and no automation may write one.\n' +
        `  Fill each {status, rationale, verified_by} (and commit, when status is fixed), ` +
        `push the release branch, then: ${resumeCmd}`
    );
}
