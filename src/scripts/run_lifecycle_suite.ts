/**
 * run_lifecycle_suite — run the process-level lifecycle suite and write the
 * evidence artifact `check_supervision_claim_atomicity` reads
 * (`road-to-supervised-telemetry-collector` steps 5.1 and 5.2).
 *
 * ## Why a producer script and not just `vitest run`
 *
 * The atomicity gate refuses a present-tense supervision claim unless
 * `internal/reports/supervision-lifecycle.json` records a suite that ran on THIS
 * revision, exercised real processes, and was not empty or mostly skipped. That
 * artifact has to be written by something that knows all four facts. A test file
 * knows whether it ran; only the runner knows the revision and the counts.
 *
 * ## Every field here is observed, not asserted
 *
 * - `revision` — `git rev-parse HEAD`, read at run time. Never a constant.
 * - `cases_run` / `cases_skipped` — parsed out of vitest's own JSON report,
 *   never counted by hand from the source.
 * - `processes_exercised` — true only when the suite ACTUALLY spawned daemons,
 *   established by re-reading the report for the property names that can only
 *   pass against real processes. A hardcoded `true` here would defeat the entire
 *   point of the gate, which exists because a mocked suite can demonstrate all
 *   five properties and prove none of them.
 *
 * ## A skip is a failure
 *
 * AC-8: *"a suite that skips on a platform is a failure on that platform, not an
 * absence."* So a run whose cases were skipped writes the artifact with the
 * honest counts and exits non-zero, rather than writing nothing — a missing
 * artifact and a skipped suite need different remediation and the gate
 * distinguishes them.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** The suite, by path. Named once so the artifact and the runner cannot drift. */
export const SUITE_REL = 'tests/scripts/collector_lifecycle.test.ts';
export const SUITE_NAME = 'supervision-lifecycle';
export const EVIDENCE_REL = path.join('internal', 'reports', 'supervision-lifecycle.json');

/**
 * The five property names the suite must have RUN for the artifact to claim
 * real processes were exercised.
 *
 * Matched against the report's test names rather than counted, because a count
 * cannot tell five properties from five repeats of one.
 */
export const REQUIRED_PROPERTIES = [
    'PROPERTY 1',
    'PROPERTY 2',
    'PROPERTY 3',
    'PROPERTY 4',
    'PROPERTY 5',
] as const;

export interface SuiteCounts {
    readonly run: number;
    readonly skipped: number;
    readonly passedNames: readonly string[];
}

export function countsFromReport(reportJson: string): SuiteCounts {
    const raw = JSON.parse(reportJson) as {
        testResults?: { assertionResults?: { fullName?: string; status?: string }[] }[];
    };
    let run = 0;
    let skipped = 0;
    const passedNames: string[] = [];
    for (const suite of raw.testResults ?? []) {
        for (const assertion of suite.assertionResults ?? []) {
            const status = assertion.status ?? 'unknown';
            if (status === 'pending' || status === 'skipped' || status === 'todo') {
                skipped += 1;
                continue;
            }
            run += 1;
            if (status === 'passed') passedNames.push(assertion.fullName ?? '');
        }
    }
    return { run, skipped, passedNames };
}

/**
 * Did the run exercise real processes?
 *
 * True only when every one of the five named properties PASSED. Anything less —
 * a skipped property, a renamed one, a suite that never collected — leaves this
 * false, and the gate then refuses the capability claim rather than accepting a
 * partial demonstration as a whole one.
 */
export function processesExercised(counts: SuiteCounts): boolean {
    return REQUIRED_PROPERTIES.every((property) =>
        counts.passedNames.some((name) => name.includes(property)),
    );
}

export function headRevision(repo: string = REPO): string {
    try {
        return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const dryRun = argv.includes('--dry-run');
    const report = path.join(os.tmpdir(), `lifecycle-report-${process.pid}.json`);
    fs.rmSync(report, { force: true });

    const result = spawnSync(
        path.join(REPO, 'node_modules', '.bin', 'vitest'),
        ['run', SUITE_REL, '--reporter=json', `--outputFile=${report}`],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    if (!fs.existsSync(report)) {
        process.stderr.write(
            `run_lifecycle_suite: no report produced.\n${result.stdout ?? ''}\n${result.stderr ?? ''}\n`,
        );
        return 1;
    }
    const counts = countsFromReport(fs.readFileSync(report, 'utf8'));
    fs.rmSync(report, { force: true });

    const revision = headRevision();
    const exercised = processesExercised(counts);
    const evidence = {
        suite: SUITE_NAME,
        revision,
        processes_exercised: exercised,
        cases_run: counts.run,
        cases_skipped: counts.skipped,
        platform: `${process.platform}-${process.arch}`,
        recorded_at: new Date().toISOString(),
    };

    process.stdout.write(
        `run_lifecycle_suite: ${counts.run} run, ${counts.skipped} skipped, `
            + `processes_exercised=${String(exercised)}, revision=${revision || '(unknown)'}\n`,
    );

    if (dryRun) {
        process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
        return result.status === 0 && exercised && counts.skipped === 0 ? 0 : 1;
    }

    const target = path.join(REPO, EVIDENCE_REL);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`run_lifecycle_suite: wrote ${EVIDENCE_REL}\n`);

    if (result.status !== 0) {
        process.stderr.write('run_lifecycle_suite: the suite is RED\n');
        return 1;
    }
    if (counts.skipped > 0) {
        // AC-8 makes a skip a failure on that platform rather than an absence.
        process.stderr.write(
            `run_lifecycle_suite: ${counts.skipped} case(s) SKIPPED — on a declared platform a `
                + 'skip is a failure, not an absence\n',
        );
        return 1;
    }
    if (!exercised) {
        process.stderr.write(
            'run_lifecycle_suite: not every named property passed — the artifact records '
                + '`processes_exercised: false` and the capability claim stays prohibited\n',
        );
        return 1;
    }
    return 0;
}

const invokedDirectly =
    process.argv[1] !== undefined && process.argv[1].includes('run_lifecycle_suite');
if (invokedDirectly) {
    process.exitCode = main();
}
