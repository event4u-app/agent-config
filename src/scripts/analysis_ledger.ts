/**
 * analysis_ledger.ts — the loop ledger of one analyst: seed plus three lens
 * loops (Coverage, Adversary, Overbuild & sequencing), each appending a row
 * whose every item carries an evidence object.
 *
 * Only `executed` and `read` evidence counts. A loop that changed no
 * conclusion on such evidence is `no-external-signal`: it ran, it is recorded,
 * and it does not count — re-reading one's own draft is not depth. All three
 * lenses always run; loops 4–5 run only while the loop before added a
 * top-tier item.
 */

export const LENSES = ['coverage', 'adversary', 'overbuild-sequencing'] as const;
export type Lens = (typeof LENSES)[number];

export const EVIDENCE_TIERS = ['executed', 'read', 'claimed', 'inferred'] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];
export const TOP_TIERS: readonly EvidenceTier[] = ['executed', 'read'];

export const MANDATORY_LOOPS = LENSES.length;
export const MAX_LOOPS = 5;

export interface Evidence {
    source_identity: string;
    digest: string;
    method: string;
    claim: 'supported' | 'refuted';
    tier: EvidenceTier;
}

/** `retained` is an item the lens tested and left standing — legal, but no changed conclusion. */
export type ItemChange = 'added' | 'changed' | 'killed' | 'retained';

export interface LedgerItem {
    id: string;
    change: ItemChange;
    evidence: Evidence[];
}

export interface LoopRowInput {
    lens: Lens;
    items: LedgerItem[];
}

export interface LoopRow extends LoopRowInput {
    loop: number;
    status: 'counted' | 'no-external-signal';
}

export type NextLoop = { action: 'run'; loop: number; lens: Lens } | { action: 'stop'; reason: 'loop-cap' | 'plateau' };

export class LedgerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LedgerError';
    }
}

export function lensForLoop(loop: number): Lens {
    return LENSES[(loop - 1) % LENSES.length] as Lens;
}

function isTopTier(evidence: Evidence): boolean {
    return TOP_TIERS.includes(evidence.tier);
}

function changesConclusion(item: LedgerItem): boolean {
    return item.change !== 'retained' && item.evidence.some(isTopTier);
}

export function addedTopTier(row: LoopRow): boolean {
    return row.status === 'counted' && row.items.some((i) => i.change === 'added' && i.evidence.some(isTopTier));
}

export function assertLoopsSetting(loops: number): void {
    if (!Number.isInteger(loops) || loops < MANDATORY_LOOPS || loops > MAX_LOOPS) {
        throw new LedgerError(`--loops must be an integer from ${MANDATORY_LOOPS} to ${MAX_LOOPS}, got ${loops}`);
    }
}

export function appendLoop(ledger: readonly LoopRow[], input: LoopRowInput): LoopRow[] {
    const loop = ledger.length + 1;
    if (loop > MAX_LOOPS) {
        throw new LedgerError(`loop ${loop} exceeds the cap of ${MAX_LOOPS}`);
    }
    const expected = lensForLoop(loop);
    if (input.lens !== expected) {
        throw new LedgerError(`loop ${loop} must run the ${expected} lens, got ${input.lens}`);
    }
    for (const item of input.items) {
        if (item.evidence.length === 0) {
            throw new LedgerError(`loop ${loop}: item ${item.id} carries no evidence object`);
        }
        for (const ev of item.evidence) {
            if (!EVIDENCE_TIERS.includes(ev.tier)) {
                throw new LedgerError(`loop ${loop}: item ${item.id} has unknown tier ${String(ev.tier)}`);
            }
        }
    }
    const status = input.items.some(changesConclusion) ? 'counted' : 'no-external-signal';
    return [...ledger, { loop, lens: input.lens, items: input.items, status }];
}

export function nextLoop(ledger: readonly LoopRow[], loops = MANDATORY_LOOPS): NextLoop {
    assertLoopsSetting(loops);
    const done = ledger.length;
    if (done < MANDATORY_LOOPS) {
        return { action: 'run', loop: done + 1, lens: lensForLoop(done + 1) };
    }
    if (done >= loops) return { action: 'stop', reason: 'loop-cap' };
    const previous = ledger[done - 1] as LoopRow;
    if (!addedTopTier(previous)) return { action: 'stop', reason: 'plateau' };
    return { action: 'run', loop: done + 1, lens: lensForLoop(done + 1) };
}

export function ledgerSummary(ledger: readonly LoopRow[]): string {
    const counted = ledger.filter((r) => r.status === 'counted').length;
    return `Loops: ${ledger.length} run, ${counted} counted, ${ledger.length - counted} no-external-signal`;
}
