/**
 * Estate-level result handling — telling "found violations" from "broke".
 *
 * A gate exits non-zero for two structurally different reasons, and the exit
 * code alone cannot separate them:
 *
 * - **verdict** — it ran, inspected its corpus, and found violations. The
 *   estate is being measured correctly; something in the tree is wrong.
 * - **estate-invalidating** — it could not measure at all: the scan root is
 *   dead, planned targets went unaccounted, the ratchet's base ref is
 *   unreachable, the ledger was mis-used. Nothing was certified, and a report
 *   built from this run is not a report.
 *
 * Conflating them costs in both directions. Treated as a verdict, an
 * invalidated run sends a contributor hunting for a violation that does not
 * exist. Treated as a crash, a real violation gets triaged as flakiness. This
 * repository has recorded three traps of the second kind — estate invalidation
 * misreported as a per-gate red.
 *
 * The classification reads the failure's own error name, which the structural
 * errors already carry, rather than pattern-matching prose. A gate that throws
 * something else is `crashed`: unknown, non-green, and reported as itself.
 *
 * **Gaming risk.** Nothing here can be gamed by a passing gate — the module
 * only ever downgrades confidence. The real risk is the opposite: a future
 * error class that IS estate-invalidating but is not listed below reads as a
 * plain crash. Mitigated by keying on the shared `_lib` error names and by the
 * fixture that pins each one; the residual is that a new structural error must
 * be added here deliberately.
 */

/**
 * Error names that mean the measurement is void, not that the tree is dirty.
 *
 * Sourced from the shared gate primitives: `scan_scope`, `gate_ledger`, and
 * `ratchet_base_ref`.
 */
export const ESTATE_INVALIDATING_ERRORS: readonly string[] = [
    'DeadScopeError',
    'UnaccountedTargetsError',
    'LedgerUsageError',
    'BaseRefUnavailableError',
    'ProbeOverflowError',
];

export type GateOutcome = 'clean' | 'violations' | 'crashed' | 'estate_invalid';

export interface GateRunSignal {
    /** Process exit code, or `null` when the gate never produced one. */
    exitCode: number | null;
    /** Combined stdout + stderr, used only to spot a named structural error. */
    output: string;
    /** True when the runner itself could not execute the gate. */
    spawnFailed?: boolean;
}

/** True when `output` names one of the structural error classes. */
export function namesEstateInvalidatingError(output: string): boolean {
    return ESTATE_INVALIDATING_ERRORS.some((name) => output.includes(name));
}

/**
 * Classify one gate run.
 *
 * Fail-closed on a null exit code: a gate that produced no verdict was not run,
 * and a gate that was not run is not a passing gate.
 */
export function classifyGateRun(signal: GateRunSignal): GateOutcome {
    if (signal.spawnFailed === true || signal.exitCode === null) {
        return 'crashed';
    }
    if (namesEstateInvalidatingError(signal.output)) {
        return 'estate_invalid';
    }
    return signal.exitCode === 0 ? 'clean' : 'violations';
}

/** True when this outcome must never contribute to a green aggregate. */
export function blocksGreenAggregate(outcome: GateOutcome): boolean {
    return outcome !== 'clean';
}

/**
 * One-line explanation, so the estate report says WHICH kind of failure it is.
 */
export function describeOutcome(id: string, outcome: GateOutcome): string {
    switch (outcome) {
        case 'clean':
            return `${id}: clean`;
        case 'violations':
            return `${id}: found violations — the measurement is sound, the tree is not`;
        case 'estate_invalid':
            return (
                `${id}: ESTATE INVALID — it could not measure (dead scope, unaccounted targets, ` +
                'unreachable base ref, or ledger misuse). Nothing was certified by this run, so ' +
                'no report built on it is a report'
            );
        case 'crashed':
            return `${id}: crashed with no verdict — not run, therefore not passing`;
    }
}
