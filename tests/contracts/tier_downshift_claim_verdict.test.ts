// The two tier-downshift claims in docs/CLAIMS.md cite the paired run pinned at
// fe4fa4bcd7. Their status must follow the verdict the module computes from
// those recorded rows, so a claim cannot read `backed` on a run the code calls
// underpowered — and a change to the bound cannot silently re-back it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePriceRows } from '../../src/scripts/_lib/price_freshness.js';
import { tierDownshiftVerdict, type LegResult } from '../../src/scripts/_lib/tier_downshift_verdict.js';

const ROOT = resolve(__dirname, '..', '..');
const BENCH = 'internal/bench/tier-downshift';
const VERDICT_DATE = new Date('2026-10-23T23:59:59Z');

function recordedRows(): LegResult[] {
    return readFileSync(resolve(ROOT, BENCH, 'results-fe4fa4bcd7.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as LegResult & { error?: string })
        .filter((r) => r.error === undefined);
}

function claimStatus(id: string): string {
    const text = readFileSync(resolve(ROOT, 'docs/CLAIMS.md'), 'utf8');
    const block = text.split(`### claim: ${id}\n`)[1];
    if (block === undefined) throw new Error(`no claim ${id} in docs/CLAIMS.md`);
    const status = /^- status: (\S+)/m.exec(block.split('\n### ')[0] ?? '');
    if (status === null) throw new Error(`claim ${id} has no status line`);
    return status[1] as string;
}

describe('tier-downshift claims follow the verdict of their recorded run', () => {
    const verdict = tierDownshiftVerdict(
        recordedRows(),
        parsePriceRows(readFileSync(resolve(ROOT, 'internal/bench/pricing.yaml'), 'utf8')),
        VERDICT_DATE,
    );
    const recorded = JSON.parse(readFileSync(resolve(ROOT, BENCH, 'verdict-2026-10-23.json'), 'utf8')) as {
        pairs: number;
        quality: string;
        cost: string;
    };

    it('recomputes the recorded verdict from the recorded rows', () => {
        expect(verdict.pairs).toBe(recorded.pairs);
        expect(verdict.quality).toBe(recorded.quality);
        expect(verdict.cost).toBe(recorded.cost);
    });

    it('backs a claim only when the code verdict holds it', () => {
        const qualityBacked = verdict.quality === 'held';
        expect(claimStatus('tier-downshift-quality-held') === 'backed').toBe(qualityBacked);
        expect(claimStatus('tier-downshift-limit-relief') === 'backed').toBe(qualityBacked && verdict.cost === 'relief');
    });
});
