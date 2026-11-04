/**
 * A `backed` quantitative claim resting on the ab-v2 benchmark page names the
 * scorer it was measured with (road-to-benchmark-claims-that-name-their-scorer 2.2).
 */
import { describe, expect, it } from 'vitest';

import { scorer_epoch_findings } from '../../src/scripts/_lib/claims_scorer_epoch.js';
import type { LedgerEntry } from '../../src/scripts/check_claims.js';

function entry(over: Partial<LedgerEntry>): LedgerEntry {
    return {
        id: 'x',
        claim: '',
        kind: 'quant',
        evidence: 'docs/benchmark.md#weak-host-specific',
        status: 'backed',
        last_verified: '',
        superseded_by: '',
        retired_by: '',
        measured_on: '',
        non_inference: '',
        retires_phrasings: '',
        promotion_evidence: '',
        retires_phrasings_present: false,
        review_by: '',
        ...over,
    };
}

function ids(entries: LedgerEntry[]): string[] {
    return scorer_epoch_findings(new Map(entries.map((e) => [e.id, e]))).map((f) => f.id);
}

describe('scorer_epoch_findings', () => {
    it('flags a backed quant benchmark claim with no measured_on', () => {
        expect(ids([entry({ id: 'bare' })])).toEqual(['bare']);
    });

    it('flags a measured_on that names no scorer', () => {
        expect(ids([entry({ id: 'vague', measured_on: 'maintainer machine, 2026-07' })])).toEqual(['vague']);
    });

    it('accepts a measured_on naming the scorer epoch', () => {
        expect(
            ids([entry({ id: 'ok', measured_on: 'ab-v2 scorer before the 2026-10-28 task-validity repair' })]),
        ).toEqual([]);
    });

    it('ignores claims outside its scope', () => {
        expect(
            ids([
                entry({ id: 'qual', kind: 'qual' }),
                entry({ id: 'unbacked', status: 'unbacked' }),
                entry({ id: 'elsewhere', evidence: 'docs/proof.md#x' }),
            ]),
        ).toEqual([]);
    });

    it('names the claim and the missing field in the finding', () => {
        const [f] = scorer_epoch_findings(new Map([['bare', entry({ id: 'bare' })]]));
        expect(f?.file).toBe('docs/CLAIMS.md');
        expect(f?.reason).toMatch(/scorer/);
    });
});
