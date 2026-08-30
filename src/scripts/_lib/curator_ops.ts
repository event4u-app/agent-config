/**
 * The curator's operation set — SEVEN ops per decision E6 — and the
 * deterministic near-duplicate pre-stage that runs before any model judgment.
 *
 * `road-to-governed-harness-evolution` Phase 5, step 5.5.
 *
 * > *Curator operation set per E6. Candidates only, never promotions. Run
 * > `src/scripts/_lib/shingle_similarity.ts` as a deterministic pre-stage
 * > before any model judgment.*
 * > verify: **a near-duplicate candidate is caught by the similarity stage with
 * > zero model calls.**
 *
 * ## Seven, and why the middle answer was rejected
 *
 * E6 (decided 2026-08-30, AI council, anthropic + openai, 2/2) settled this on
 * a contradiction rather than a preference: step 7.6 of the same roadmap
 * already specifies the verdict set `KEEP / REVISE / MERGE / SPLIT / RETIRE`,
 * so a four-op curator would emit verdicts it cannot execute. The six-op middle
 * — deferring `SPLIT` — was rejected explicitly: it still contradicts 7.6, so
 * it buys nothing the four-op answer does not also cost. The algebra argument
 * is the one worth carrying: `MERGE` is n→1 and `SPLIT` is 1→n, and without
 * `SPLIT` an overgrown rule becoming two must be written as
 * `RETIRE + 2 x ADD`, which loses the semantic link and makes the intent
 * unreadable in the audit log. {@link validateOp} encodes exactly that arity.
 *
 * ## Candidates only — carried by the type, not by a promise
 *
 * Every screened proposal carries `lifecycle: 'candidate'` as a LITERAL type,
 * so there is no value a curator can construct that names any other lifecycle.
 * Phase 7 is gated on the OPEN `merge-authority` blocker; a curator that could
 * express a promotion would be one edit from performing one.
 *
 * ## Zero model calls, and how that is established rather than asserted
 *
 * {@link screenNearDuplicates} is synchronous, imports only
 * `shingle_similarity`, and returns `model_calls: 0` as a literal-typed field.
 * `tests/scripts/curator_ops.test.ts` proves the property two ways: it scans
 * this module and its one dependency for network and model-client constructs in
 * both polarities, and it runs the screen with `globalThis.fetch` replaced by a
 * throwing stub, so a call would surface as a thrown error rather than as an
 * unchecked assumption. An assertion by inspection would be worth nothing here
 * — the whole point of a deterministic pre-stage is that it is cheaper than the
 * judgment it precedes.
 */
import { shingleOverlap } from './shingle_similarity.js';

/** E6, option B. The exact set — arity and membership are both pinned by the test. */
export const CURATOR_OPS = [
    'KEEP',
    'ADD',
    'MERGE',
    'REPLACE',
    'SPLIT',
    'RETIRE',
    'SKIP',
] as const;

export type CuratorOp = (typeof CURATOR_OPS)[number];

export interface CuratorProposal {
    id: string;
    op: CuratorOp;
    /** Existing artifact ids the op reads or consumes. */
    targets: readonly string[];
    /** Artifact ids the op would produce. Empty for read-only ops. */
    produces: readonly string[];
    /** The proposed text, which is what the similarity stage compares. */
    text: string;
}

/** Arity per op. `null` means the op places no constraint on that side. */
const OP_ARITY: Record<CuratorOp, { targets: [number, number | null]; produces: [number, number | null] }> = {
    KEEP: { targets: [1, 1], produces: [0, 0] },
    ADD: { targets: [0, 0], produces: [1, 1] },
    MERGE: { targets: [2, null], produces: [1, 1] },
    REPLACE: { targets: [1, 1], produces: [1, 1] },
    SPLIT: { targets: [1, 1], produces: [2, null] },
    RETIRE: { targets: [1, 1], produces: [0, 0] },
    SKIP: { targets: [0, null], produces: [0, 0] },
};

function arityError(label: string, n: number, [lo, hi]: [number, number | null]): string | null {
    if (n < lo) return `${label}: expected at least ${String(lo)}, got ${String(n)}`;
    if (hi !== null && n > hi) return `${label}: expected at most ${String(hi)}, got ${String(n)}`;
    return null;
}

/** `null` when the proposal's arity matches its op, otherwise the reason it does not. */
export function validateOp(p: CuratorProposal): string | null {
    const spec = OP_ARITY[p.op];
    return (
        arityError(`${p.op} targets`, p.targets.length, spec.targets) ??
        arityError(`${p.op} produces`, p.produces.length, spec.produces)
    );
}

/**
 * Containment-overlap percent at which a proposal is a near-duplicate.
 *
 * A STATED default, not a measured optimum: `lint_originality`'s own gate uses
 * shingle containment on the same primitive, and 70 % is the conservative end
 * of the range a reskin scores there. `revisit-if` a screening run rejects a
 * proposal a curator then has to re-add by hand, or admits one a human calls a
 * duplicate.
 */
export const NEAR_DUPLICATE_THRESHOLD = 70;

export interface CorpusEntry {
    id: string;
    text: string;
}

export interface NearDuplicateFinding {
    proposal_id: string;
    /** The corpus entry it duplicates. */
    against: string;
    overlap_percent: number;
}

export interface ScreenedProposal {
    proposal: CuratorProposal;
    /** Literal. There is no other value this field can hold. */
    lifecycle: 'candidate';
}

export interface ScreenResult {
    admitted: readonly ScreenedProposal[];
    near_duplicates: readonly NearDuplicateFinding[];
    malformed: readonly { proposal_id: string; reason: string }[];
    /** Literal 0. The stage is deterministic; a model call here would be a defect. */
    model_calls: 0;
}

/**
 * The deterministic pre-stage: reject malformed ops and near-duplicates before
 * anything expensive runs.
 *
 * Synchronous on purpose — a synchronous function cannot await a network call,
 * so the zero-model-call property is a consequence of the signature rather than
 * a claim the body has to keep.
 */
export function screenNearDuplicates(
    proposals: readonly CuratorProposal[],
    corpus: readonly CorpusEntry[],
    threshold: number = NEAR_DUPLICATE_THRESHOLD,
): ScreenResult {
    const admitted: ScreenedProposal[] = [];
    const nearDuplicates: NearDuplicateFinding[] = [];
    const malformed: { proposal_id: string; reason: string }[] = [];

    for (const p of proposals) {
        const shapeError = validateOp(p);
        if (shapeError !== null) {
            malformed.push({ proposal_id: p.id, reason: shapeError });
            continue;
        }
        let worst: NearDuplicateFinding | null = null;
        for (const entry of corpus) {
            const overlap = shingleOverlap(p.text, entry.text);
            if (overlap >= threshold && (worst === null || overlap > worst.overlap_percent)) {
                worst = { proposal_id: p.id, against: entry.id, overlap_percent: overlap };
            }
        }
        if (worst !== null) {
            nearDuplicates.push(worst);
            continue;
        }
        admitted.push({ proposal: p, lifecycle: 'candidate' });
    }

    return { admitted, near_duplicates: nearDuplicates, malformed, model_calls: 0 };
}
