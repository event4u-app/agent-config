/**
 * The repeated-run evidence mode and the `flaky` outcome.
 *
 * `docs/contracts/evidence-artifact-types.md` § The second axis is the
 * contract; this is the executable half, so "a run that passes 4 of 5 times is
 * recorded as flaky rather than as passing" is a thing a test can assert rather
 * than a sentence in a document.
 *
 * Two rules carry the whole design, both from the AI council of 2026-09-04
 * (2/2 convergent):
 *
 *   1. **`n >= 2`.** `repeated:1` is `single-run` wearing extra syntax, and
 *      admitting it would let one run be presented as a repeat.
 *   2. **Unanimity, no threshold.** All pass → pass. All fail → fail. Anything
 *      else → flaky. A 4-of-5 pass is precisely the case this exists to stop
 *      being called a pass, so a majority rule would defeat the purpose.
 */

export type ExecutionMode = { kind: 'single-run' } | { kind: 'repeated'; n: number };

export type RepeatedOutcome = 'pass' | 'fail' | 'flaky';

/** The marker, when an artifact declares one. `single-run` is never written. */
export const EVIDENCE_MODE_RE = /<!--\s*evidence-mode:\s*(single-run|repeated:(\d+))\s*-->/;

/**
 * Read the mode an artifact declares.
 *
 * Absent → `single-run`, which is the default that keeps this axis from being
 * a migration. A malformed `repeated:<n>` with `n < 2` is rejected rather than
 * rounded to `single-run`: a declaration that does not parse must not read to
 * its author as accepted.
 */
export function parseExecutionMode(text: string): ExecutionMode | { kind: 'invalid'; reason: string } {
    const m = EVIDENCE_MODE_RE.exec(text);
    if (m === null) return { kind: 'single-run' };
    if (m[1] === 'single-run') return { kind: 'single-run' };
    const n = Number(m[2]);
    if (!Number.isInteger(n) || n < 2) {
        return {
            kind: 'invalid',
            reason: `repeated:${String(n)} declares fewer than 2 runs; repeated:1 is single-run with extra syntax`,
        };
    }
    return { kind: 'repeated', n };
}

/**
 * Aggregate `n` retained per-run verdicts.
 *
 * Takes the RUNS, never a summary count — an artifact that kept only
 * "3 of 5 passed" has recorded a number, not evidence, and this signature is
 * where that requirement is enforced rather than requested.
 */
export function aggregateRepeatedRuns(runs: readonly boolean[]): RepeatedOutcome {
    if (runs.length < 2) {
        throw new Error(
            `aggregateRepeatedRuns needs at least 2 retained runs, got ${String(runs.length)}; ` +
                'a single run is `single-run`, not a repeat',
        );
    }
    if (runs.every((r) => r)) return 'pass';
    if (runs.every((r) => !r)) return 'fail';
    return 'flaky';
}

/** One line for the artifact, so `flaky` is reported as itself. */
export function describeRepeatedRun(runs: readonly boolean[]): string {
    const outcome = aggregateRepeatedRuns(runs);
    const passed = runs.filter((r) => r).length;
    const line = `evidence-mode: repeated:${String(runs.length)} · outcome: ${outcome} · ${String(passed)}/${String(runs.length)} passed`;
    if (outcome !== 'flaky') return line;
    return (
        `${line} — the runs did not agree, so this is neither a pass nor a fail. ` +
        'Recording it as either would be the silent green or the silent red this outcome exists to prevent.'
    );
}
