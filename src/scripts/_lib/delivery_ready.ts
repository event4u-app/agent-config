/**
 * Is a PR delivery-ready? — `road-to-adversarial-verification-and-long-runs` 3.1.
 *
 * The step's acceptance clause is that *a fixture PR with a disabled required
 * check cannot reach delivery-ready*, and that is the one case a naive reader
 * gets wrong: a PR whose required context was SKIPPED has a green rollup. GitHub
 * reports `SKIPPED` as a non-failure, so a predicate that asks "did anything
 * fail" answers no, and the gate the context was supposed to enforce did not run.
 *
 * So this asks two questions rather than one: did every required context report,
 * and did each of those reports actually pass. A context that is missing from
 * the rollup entirely fails the first; a context present but skipped, cancelled
 * or neutral fails the second.
 *
 * Pure — the caller supplies the rollup and the required set, so both polarities
 * are testable without a forge.
 */

/** One check as a forge rollup reports it. */
export interface CheckRun {
    readonly name: string;
    /** `SUCCESS` · `FAILURE` · `SKIPPED` · `CANCELLED` · `NEUTRAL` · `null` while running. */
    readonly conclusion: string | null;
    /** `COMPLETED` · `IN_PROGRESS` · `QUEUED`. */
    readonly status: string;
}

/** Why a PR is not delivery-ready. Empty means it is. */
export type DeliveryBlock =
    | { readonly kind: 'required-context-absent'; readonly context: string }
    | { readonly kind: 'required-context-not-passing'; readonly context: string; readonly conclusion: string }
    | { readonly kind: 'still-running'; readonly context: string }
    | { readonly kind: 'stale-head'; readonly observed: string; readonly head: string };

/**
 * The only conclusion that counts as a required check having done its job.
 *
 * `SKIPPED` is deliberately NOT here, and it is the reason this module exists:
 * a skipped required check is an unenforced gate wearing a green rollup.
 * `NEUTRAL` and `CANCELLED` are excluded on the same ground — a check that
 * reached no verdict enforced nothing, whatever colour it rendered.
 */
const PASSING = 'SUCCESS';

export interface DeliveryInput {
    /** Contexts the forge requires, from `forge_protection`'s ruleset read. */
    readonly requiredContexts: readonly string[];
    /** The rollup on the head under test. */
    readonly checks: readonly CheckRun[];
    /** The head CI actually observed. */
    readonly observedHead: string;
    /** The branch head right now. */
    readonly head: string;
}

/**
 * Every reason this PR is not delivery-ready, in report order.
 *
 * Returns ALL blocks rather than the first: a run that fixes one and re-pushes
 * to discover the next has spent a CI cycle per block, which is the cost layer 1
 * of the delivery contract exists to avoid paying at layer 4.
 */
export function deliveryBlocks(input: DeliveryInput): DeliveryBlock[] {
    const out: DeliveryBlock[] = [];
    const byName = new Map(input.checks.map((c) => [c.name, c]));

    for (const context of input.requiredContexts) {
        const run = byName.get(context);
        if (run === undefined) {
            out.push({ kind: 'required-context-absent', context });
            continue;
        }
        if (run.status !== 'COMPLETED') {
            out.push({ kind: 'still-running', context });
            continue;
        }
        if (run.conclusion !== PASSING) {
            out.push({
                kind: 'required-context-not-passing',
                context,
                conclusion: run.conclusion ?? 'null',
            });
        }
    }

    // Checked LAST and always: a green rollup on a head that is no longer the
    // branch head is a verdict about a different tree. `ci_settle` names the head
    // its verdict is about precisely so this comparison is possible.
    if (input.observedHead !== input.head) {
        out.push({ kind: 'stale-head', observed: input.observedHead, head: input.head });
    }
    return out;
}

/** True only when nothing blocks. */
export function isDeliveryReady(input: DeliveryInput): boolean {
    return deliveryBlocks(input).length === 0;
}

/** One human-readable line per block. */
export function renderBlock(b: DeliveryBlock): string {
    switch (b.kind) {
        case 'required-context-absent':
            return `required check "${b.context}" did not report at all`;
        case 'required-context-not-passing':
            return `required check "${b.context}" concluded ${b.conclusion}, not SUCCESS — a skipped or cancelled required check is an unenforced gate, not a pass`;
        case 'still-running':
            return `required check "${b.context}" has not completed`;
        case 'stale-head':
            return `CI was observed on ${b.observed} but the branch head is ${b.head} — the verdict describes a different tree`;
    }
}
