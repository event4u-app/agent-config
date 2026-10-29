/**
 * reconstruction_ledger.ts — the closing check of an `adapt` or `rebuild`
 * transfer (docs/contracts/reconstruction-obligations.md).
 *
 * Pure: takes obligation rows, returns a verdict. A row counts as verified only
 * when every required case carries evidence and its verifier is not analyst
 * inference; `visible-only` never counts, because a screen proves the screen,
 * not the behaviour behind it. No rows is `unknown`, never `closed`.
 */
import type { EvidenceAuthority } from '../analysis_ledger.js';

export const EQUIVALENCE_TIERS = ['inspired-by', 'ux', 'behaviour', 'protocol', 'byte'] as const;
export type EquivalenceTier = (typeof EQUIVALENCE_TIERS)[number];

export const OBLIGATION_STATUSES = ['open', 'visible-only', 'verified', 'waived'] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export interface Obligation {
    id: string;
    behaviour: string;
    tier: EquivalenceTier;
    required_cases: string[];
    /** Per required case, the evidence ids that show it in the destination. */
    evidence: Record<string, string[]>;
    verifier: string;
    verifier_authority: EvidenceAuthority;
    status: ObligationStatus;
    waiver_reason?: string;
}

export interface LedgerVerdict {
    state: 'unknown' | 'open' | 'closed' | 'invalid';
    verified: number;
    /** Rows in the parity denominator: every row except `waived`. */
    counted: number;
    parity: number | null;
    errors: string[];
}

function missingCases(o: Obligation): string[] {
    return o.required_cases.filter((c) => (o.evidence[c] ?? []).length === 0);
}

export function canVerify(o: Obligation): boolean {
    return o.required_cases.length > 0 && missingCases(o).length === 0 && o.verifier_authority !== 'analyst-inference';
}

export function validateObligation(o: Obligation): string[] {
    const errors: string[] = [];
    if (!EQUIVALENCE_TIERS.includes(o.tier)) errors.push(`${o.id}: unknown equivalence tier ${String(o.tier)}`);
    if (!OBLIGATION_STATUSES.includes(o.status)) errors.push(`${o.id}: unknown status ${String(o.status)}`);
    if (o.status === 'verified') {
        if (o.required_cases.length === 0) errors.push(`${o.id}: verified without any required case`);
        const missing = missingCases(o);
        if (missing.length > 0) errors.push(`${o.id}: verified without evidence for ${missing.join(', ')}`);
        if (o.verifier_authority === 'analyst-inference') errors.push(`${o.id}: verified on analyst-inference alone`);
    }
    if (o.status === 'waived' && (o.waiver_reason ?? '').trim() === '') errors.push(`${o.id}: waived without a waiver_reason`);
    return errors;
}

export function evaluateLedger(rows: readonly Obligation[]): LedgerVerdict {
    if (rows.length === 0) return { state: 'unknown', verified: 0, counted: 0, parity: null, errors: [] };
    const errors = rows.flatMap(validateObligation);
    const verified = rows.filter((o) => o.status === 'verified' && canVerify(o)).length;
    const counted = rows.filter((o) => o.status !== 'waived').length;
    const parity = counted === 0 ? null : verified / counted;
    let state: LedgerVerdict['state'];
    if (errors.length > 0) state = 'invalid';
    else if (rows.some((o) => o.status === 'open' || o.status === 'visible-only')) state = 'open';
    else state = 'closed';
    return { state, verified, counted, parity, errors };
}
