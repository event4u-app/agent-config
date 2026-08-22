/**
 * The `council:{grant-billing,revoke-billing}` verbs, and the round's closing
 * Human Gate line.
 *
 * Lives here rather than in `council_cli.ts` for the reason that file's other
 * extractions give: it is ~2,500 lines over the source ceiling and the
 * documented remedy is extraction, not a raised baseline
 * (`gate-violation-baselines.json` § check_source_size_budget).
 *
 * IO is injected rather than imported so this module stays testable without a
 * process: `council_cli.ts` owns the repo root and the stdout/stderr pair.
 */

import {
    BILLING_GRANT_ENV,
    currentRunId,
    hasBillingGrant,
    issueBillingGrant,
    revokeBillingGrant,
} from './billing_grant.js';
import { renderBillingGateLines } from './council_fallback_posture.js';
import { writeQuotaParked } from './quota_parked.js';

export interface BillingCliDeps {
    readonly repoRoot: string;
    readonly stdout: (s: string) => void;
    readonly stderr: (s: string) => void;
}

/** The verbs this module owns, spread into `council_cli`'s subcommand list. */
export const BILLING_SUBCOMMANDS = ['grant-billing', 'revoke-billing'] as const;

/**
 * The arg spec for a billing verb, or `null` when `cmd` is not one.
 *
 * Consulted from `council_cli`'s `default:` arm rather than added as two more
 * `case` labels there: the verb list already lives in this module, and a
 * second copy of it in a switch is a copy that can drift.
 */
export function billingArgSpec(
    cmd: string,
): { positionals: string[]; opts: never[]; requiredOpts: never[] } | null {
    return (BILLING_SUBCOMMANDS as readonly string[]).includes(cmd)
        ? { positionals: ['run_id'], opts: [], requiredOpts: [] }
        : null;
}

/**
 * Dispatch a billing verb, or return `null` when `cmd` is not one.
 *
 * A `null` return rather than a thrown or a boolean out-param: the caller's
 * dispatch chain is a run of `if (cmd === x) return f()`, and this has to slot
 * into it as two lines without teaching the caller which verbs exist.
 */
export function handleBillingCommand(
    cmd: string,
    runId: unknown,
    d: BillingCliDeps,
): number | null {
    if (cmd === 'grant-billing') return grantBilling(String(runId ?? ''), d);
    if (cmd === 'revoke-billing') return revokeBilling(String(runId ?? ''), d);
    return null;
}

/**
 * Record the human's yes for one run.
 *
 * Writes the grant file and then prints the export line, because the file
 * alone is not the grant: a grant is in force only when `AC_BILLING_GRANT`
 * NAMES the run whose file exists (see `isBillingGrantActive`), and that AND
 * is what stops a previous run's grant from authorising this one. Printing the
 * export rather than setting it is not a limitation being apologised for — a
 * process cannot set its parent's environment, and a command claiming to would
 * be lying.
 */
export function grantBilling(runId: string, d: BillingCliDeps): number {
    if (runId.trim() === '') {
        d.stderr('❌  council:grant-billing: a run id is required.\n');
        return 2;
    }
    const g = issueBillingGrant(d.repoRoot, runId.trim());
    d.stdout(`✅  billing grant recorded for run ${g.run_id} (issued ${g.issued_at})\n`);
    d.stdout(`    export ${BILLING_GRANT_ENV}=${g.run_id}\n`);
    const live = hasBillingGrant(d.repoRoot) ? 'yes' : 'not until the export above is set';
    d.stdout(`    in force: ${live}\n`);
    return 0;
}

/**
 * End the grant. Exit 0 on an absent one: "there is no grant for this run" is
 * the state the caller asked for, and failing on it would make the run-end
 * cleanup path noisy on exactly the runs that never needed a grant.
 */
export function revokeBilling(runId: string, d: BillingCliDeps): number {
    if (runId.trim() === '') {
        d.stderr('❌  council:revoke-billing: a run id is required.\n');
        return 2;
    }
    revokeBillingGrant(d.repoRoot, runId.trim());
    d.stdout(`✅  billing grant revoked for run ${runId.trim()}\n`);
    return 0;
}

/**
 * Print the round's closing question when `api_on_quota: 'ask'` parked seats.
 * Silent when nothing parked, so the caller needs no branch.
 */
export function printBillingGate(parked: readonly string[], d: BillingCliDeps): void {
    const runId = currentRunId();
    // Record before rendering. A parked round is the one moment this repository
    // KNOWS plan quota is exhausted without needing a host signal, and the
    // printed line reaches whoever is watching the terminal — which for an
    // autonomous drain is nobody. The marker is what survives to the next
    // `run:supervise` report. Skipped when no run id resolves: a marker with a
    // fabricated key is worse than none, because nothing would ever match it.
    if (parked.length > 0 && runId !== null) writeQuotaParked(d.repoRoot, runId, parked);
    for (const line of renderBillingGateLines(parked, {
        runId: runId ?? '<run-id>',
        estimatedUsd: null,
    })) {
        d.stdout(`${line}\n`);
    }
}
