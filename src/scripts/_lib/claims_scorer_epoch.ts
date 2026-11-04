/**
 * A backed number from the ab-v2 page must say which scorer produced it: the
 * 2026-10-28 oracle repair split that page into before and after, and nothing
 * re-scored the pinned runs, so an unlabelled number reads as post-repair
 * (road-to-benchmark-claims-that-name-their-scorer 2.2).
 */
export interface EpochEntry {
    id: string;
    kind: string;
    status: string;
    evidence: string;
    measured_on: string;
}

export function scorer_epoch_findings(
    ledger: Map<string, EpochEntry>,
    ledgerRel = 'docs/CLAIMS.md',
): Array<{ id: string; file: string; reason: string }> {
    return [...ledger.values()]
        .filter((e) => e.status === 'backed' && e.kind === 'quant' && e.evidence.includes('docs/benchmark.md'))
        .filter((e) => !/\bscorer\b/i.test(e.measured_on))
        .map((e) => ({
            id: e.id,
            file: ledgerRel,
            reason: 'backed quant claim on docs/benchmark.md names no scorer in `measured_on` — say which side of the 2026-10-28 repair it was scored on',
        }));
}
