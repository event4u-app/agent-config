/**
 * analysis_exchange.ts — the exchange that deepens instead of agreeing. Each
 * analyst receives the others' finals relabelled A/B/C and runs three
 * reconcile loops: Inventory (every foreign claim checked at the pin),
 * Cross-exam (the disputed claims, quoted verbatim) and Converge (a
 * disagreement ledger over its own claims).
 *
 * Facts are settled by the tree: only `executed` and `read` evidence settles a
 * claim, so three `claimed` votes against it leave it unsettled. The synthesis
 * must give every minority finding a reasoned disposition — the existing
 * `auditMinorityRetention` is the judge, and a minority it cannot find is a
 * silent drop.
 */
import {
    buildCrossExamPrompt,
    crossExamNamesClaim,
    selectCrossExamTarget,
    type DisputedClaim,
} from './ai_council/cross_exam.js';
import { auditMinorityRetention, type RetentionFailure } from './ai_council/minority_retention.js';
import { TOP_TIERS, type EvidenceTier } from './analysis_ledger.js';

export const EXCHANGE_LOOPS = ['inventory', 'cross-exam', 'converge'] as const;

export type InventoryVerdict = 'still-true' | 'never-true' | 'unverifiable';
export type Settlement = 'still-true' | 'never-true' | 'contested' | 'unsettled';

export interface Claim {
    id: string;
    analyst_id: string;
    /** Verbatim, as the analyst wrote it. */
    text: string;
}

export interface InventoryRow {
    claim_id: string;
    verdict: InventoryVerdict;
    tier: EvidenceTier;
    /** The reader's own position, verbatim; quoted as the counter-claim in a cross-exam. */
    position: string;
}

export interface LedgerEntry {
    claim_id: string;
    foreign: InventoryVerdict;
    settled: Settlement;
    label: string;
}

export class ExchangeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExchangeError';
    }
}

export function relabel(analysts: readonly string[]): Map<string, string> {
    return new Map(analysts.map((id, i) => [id, String.fromCharCode(65 + i)]));
}

export function inventoryGaps(reader: string, claims: readonly Claim[], rows: readonly InventoryRow[]): string[] {
    const checked = new Set(rows.map((r) => r.claim_id));
    return claims.filter((c) => c.analyst_id !== reader && !checked.has(c.id)).map((c) => `${reader} did not check ${c.id}`);
}

export function settleClaim(rows: readonly InventoryRow[]): Settlement {
    const top = rows.filter((r) => TOP_TIERS.includes(r.tier));
    const holds = top.some((r) => r.verdict === 'still-true');
    const fails = top.some((r) => r.verdict === 'never-true');
    if (holds && fails) return 'contested';
    if (fails) return 'never-true';
    if (holds) return 'still-true';
    return 'unsettled';
}

function rowsFor(claimId: string, inventories: Readonly<Record<string, readonly InventoryRow[]>>): Array<[string, InventoryRow]> {
    const out: Array<[string, InventoryRow]> = [];
    for (const [reader, rows] of Object.entries(inventories)) {
        for (const r of rows) if (r.claim_id === claimId) out.push([reader, r]);
    }
    return out;
}

export function crossExamCandidates(
    claims: readonly Claim[],
    inventories: Readonly<Record<string, readonly InventoryRow[]>>,
    labels: ReadonlyMap<string, string>,
): DisputedClaim[] {
    const out: DisputedClaim[] = [];
    for (const claim of claims) {
        const dissent = rowsFor(claim.id, inventories).find(([, r]) => r.verdict !== 'still-true');
        if (dissent === undefined) continue;
        const [reader, r] = dissent;
        const base = {
            id: claim.id,
            kind: r.verdict === 'never-true' ? ('conflicting-pair' as const) : ('disputed-finding' as const),
            assertedBy: labels.get(claim.analyst_id) ?? '?',
            claim: claim.text,
            disputedBy: labels.get(reader) ?? '?',
        };
        out.push(r.position.length > 0 ? { ...base, counterClaim: r.position } : base);
    }
    return out;
}

export interface MinorityFinding {
    claim_id: string;
    /** Distinctive phrases; a synthesis naming none of them did not engage the finding. */
    anchors: string[];
}

export interface MinorityAudit {
    silent_drops: string[];
    unresolved: Array<{ claim_id: string; failures: RetentionFailure[] }>;
}

export function auditSynthesis(synthesis: string, minorities: readonly MinorityFinding[]): MinorityAudit {
    const audit: MinorityAudit = { silent_drops: [], unresolved: [] };
    for (const m of minorities) {
        const verdict = auditMinorityRetention(synthesis, {
            id: m.claim_id,
            permanent: false,
            question: m.claim_id,
            // The audit reads only the anchors; which side is right is what the exchange is deciding.
            ground_truth: 'minority',
            minority: { member: m.claim_id, answer: '', anchors: m.anchors },
            majority: [],
        });
        if (verdict.failures.includes('minority-silently-dropped')) audit.silent_drops.push(m.claim_id);
        else if (!verdict.passed) audit.unresolved.push({ claim_id: m.claim_id, failures: [...verdict.failures] });
    }
    return audit;
}

export interface ExchangeRecord {
    labels: Record<string, string>;
    loops: typeof EXCHANGE_LOOPS;
    targets: Array<{ target: DisputedClaim; prompt: string }>;
    ledgers: Record<string, LedgerEntry[]>;
    minority_audit: MinorityAudit;
}

export function buildExchange(input: {
    analysts: readonly string[];
    claims: readonly Claim[];
    inventories: Readonly<Record<string, readonly InventoryRow[]>>;
    maxTargets: number;
    synthesis: string;
    minorities: readonly MinorityFinding[];
}): ExchangeRecord {
    const gaps = input.analysts.flatMap((a) => inventoryGaps(a, input.claims, input.inventories[a] ?? []));
    if (gaps.length > 0) throw new ExchangeError(`inventory incomplete: ${gaps.join('; ')}`);
    const labels = relabel(input.analysts);

    const pool = crossExamCandidates(input.claims, input.inventories, labels);
    const targets: Array<{ target: DisputedClaim; prompt: string }> = [];
    while (targets.length < input.maxTargets) {
        const target = selectCrossExamTarget(pool);
        if (target === null) break;
        pool.splice(pool.indexOf(target), 1);
        const prompt = buildCrossExamPrompt(target);
        if (!crossExamNamesClaim(prompt, target)) throw new ExchangeError(`cross-exam prompt for ${target.id} lost the claim`);
        targets.push({ target, prompt });
    }

    const ledgers: Record<string, LedgerEntry[]> = {};
    for (const analyst of input.analysts) {
        ledgers[analyst] = input.claims
            .filter((c) => c.analyst_id === analyst)
            .flatMap((c) => {
                const rows = rowsFor(c.id, input.inventories);
                const settled = settleClaim(rows.map(([, r]) => r));
                return rows
                    .filter(([, r]) => r.verdict !== 'still-true')
                    .map(([reader, r]) => ({ claim_id: c.id, foreign: r.verdict, settled, label: labels.get(reader) ?? '?' }));
            });
    }

    return {
        labels: Object.fromEntries(labels),
        loops: EXCHANGE_LOOPS,
        targets,
        ledgers,
        minority_audit: auditSynthesis(input.synthesis, input.minorities),
    };
}
