/**
 * One evidence-basis vocabulary (`road-to-delivered-cost-truth` step 4.1).
 *
 * Every number this suite reports rests on something, and until now the tree
 * said what on at least three incompatible partial scales:
 *
 *   `_lib/orchestration_record.ts`  `'measured' | 'estimated'`
 *   `preamble_byte_census.ts`       `'measured_local_file' | 'residual'`
 *   `_lib/value_ladder.ts`          `'measured' | 'estimated' | 'vendor-claim' | 'pending' | 'available'`
 *
 * They overlap, disagree on naming for the same idea, and none of them can
 * express "a model judged this" — which several surfaces in this tree do report.
 * This module is the reconciliation, and it is deliberately NOT a fourth
 * vocabulary sitting beside the three: the migration of the first two ships in
 * the same change, and the third is documented as an unmigrated variant with the
 * reason, rather than left looking like an oversight.
 *
 * WHAT EACH VALUE RESTS ON — one sentence, which is the whole contract:
 *
 *   measured           an instrument in this repository produced it from real input
 *   estimated          derived by arithmetic from measured values, not itself observed
 *   inferred           concluded from structure or convention, with no measurement behind it
 *   provider-reported  a third party stated it and we recorded it unverified
 *   model-judged       a language model's assessment, reproducible only in distribution
 *   unknown            nothing establishes it, and that is the honest answer
 *
 * `unknown` is a first-class value, not a failure code. A surface that cannot
 * establish a basis says `unknown`; it does not pick the nearest optimistic one.
 */

export const EVIDENCE_BASES = [
    'measured',
    'estimated',
    'inferred',
    'provider-reported',
    'model-judged',
    'unknown',
] as const;
export type EvidenceBasis = (typeof EVIDENCE_BASES)[number];

/** What each value rests on. Printed verbatim by surfaces that explain themselves. */
export const EVIDENCE_BASIS_MEANING: Record<EvidenceBasis, string> = {
    measured: 'an instrument in this repository produced it from real input',
    estimated: 'derived by arithmetic from measured values, not itself observed',
    inferred: 'concluded from structure or convention, with no measurement behind it',
    'provider-reported': 'a third party stated it and we recorded it unverified',
    'model-judged': "a language model's assessment, reproducible only in distribution",
    unknown: 'nothing establishes it, and that is the honest answer',
};

export function isEvidenceBasis(v: unknown): v is EvidenceBasis {
    return typeof v === 'string' && (EVIDENCE_BASES as readonly string[]).includes(v);
}

/**
 * Ordering by how much a reader may lean on the value.
 *
 * Used for reporting, never for arithmetic: two figures on different bases do
 * not become comparable by being ranked, and nothing here should be read as
 * licence to average them.
 */
export const EVIDENCE_BASIS_STRENGTH: Record<EvidenceBasis, number> = {
    measured: 5,
    estimated: 4,
    'provider-reported': 3,
    inferred: 2,
    'model-judged': 1,
    unknown: 0,
};

/** The weakest basis in a set — what a derived figure may honestly claim. */
export function weakestBasis(bases: readonly EvidenceBasis[]): EvidenceBasis {
    if (bases.length === 0) return 'unknown';
    return bases.reduce((a, b) => (EVIDENCE_BASIS_STRENGTH[b] < EVIDENCE_BASIS_STRENGTH[a] ? b : a));
}
