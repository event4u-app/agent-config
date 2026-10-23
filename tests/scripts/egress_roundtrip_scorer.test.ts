import { describe, expect, it } from 'vitest';

import { loadW1, w1x } from '../../internal/bench/egress-roundtrip/corpus.js';
import {
    droppingRestore,
    nonIdempotentReplace,
    passesBar,
    realReplace,
    type RoundTripDoc,
    scoreRoundTrip,
} from '../../internal/bench/egress-roundtrip/scorer.js';

const DOCS: RoundTripDoc[] = [
    { type: 'IBAN', text: 'Refund to IBAN DE89 3704 0044 0532 0130 00 or DE89370400440532013000.', values: ['DE89 3704 0044 0532 0130 00', 'DE89370400440532013000'] },
    { type: 'EMAIL', text: 'Reply to jane.roe@shop-mail.de please.', values: ['jane.roe@shop-mail.de'] },
];

describe('egress round-trip scorer (PREREG c, identifier half)', () => {
    it('reads the real engine as byte-exact and idempotent on a small corpus', () => {
        const r = scoreRoundTrip(DOCS);
        expect(passesBar(r)).toBe(true);
        expect(r.get('IBAN')?.replaced).toBe(2);
    });

    it('rejects a restore that drops one byte per restored value', () => {
        const r = scoreRoundTrip(DOCS, realReplace, droppingRestore);
        expect(passesBar(r)).toBe(false);
        for (const row of r.values()) expect(row.exactRestore).toBe(0);
    });

    it('rejects a replacer whose second pass changes its own output', () => {
        const r = scoreRoundTrip(DOCS, nonIdempotentReplace);
        expect(passesBar(r)).toBe(false);
        for (const row of r.values()) {
            expect(row.idempotenceMismatches).toBe(1);
            // The first pass is the real one, so the restore half still reads exact.
            expect(row.exactRestore).toBe(1);
        }
    });

    it('counts a document whose value was never replaced as not fully replaced, without failing the bar', () => {
        const r = scoreRoundTrip([{ type: 'EMAIL', text: 'mail ops@example.com', values: ['ops@example.com'] }]);
        expect(r.get('EMAIL')?.fullyReplaced).toBe(0);
        expect(passesBar(r)).toBe(true);
    });

    it('the corpora are deterministic and synthetic-seeded', () => {
        expect(loadW1()).toHaveLength(1200);
        expect(w1x().map((d) => d.text)).toEqual(w1x().map((d) => d.text));
    });
});
