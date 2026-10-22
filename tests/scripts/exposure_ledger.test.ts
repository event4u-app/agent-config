import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askHand } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { resetCouncilEgress } from '../../src/scripts/ai_council/council_egress.js';
import {
    EXPOSURE_SHARE_CAP,
    ExposureLedger,
    exposureShareFn,
} from '../../src/scripts/ai_council/exposure_ledger.js';
import { chooseRoute, type RouteCandidate } from '../../src/scripts/ai_council/route_chooser.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function free(name: string): RouteCandidate {
    return { name, billing: 'free-quota', ceiling: 'public-artifact', remainingQuota: null, live: true };
}
const PAID: RouteCandidate = { name: 'paid', billing: 'subscription', ceiling: 'project-content', remainingQuota: null, live: true };

describe('the exposure ledger', () => {
    it('counts distinct files and symbols per route, persists, and keeps no path in clear', () => {
        const file = path.join(tmp, 'state', 'hand-exposure.json');
        const a = ExposureLedger.load(file);
        a.record('r1', { files: ['src/a.ts', 'src/b.ts'], symbols: ['parse'] });
        a.record('r1', { files: ['src/a.ts'], symbols: ['parse', 'format'] });
        const b = ExposureLedger.load(file);
        expect(b.seen('r1')).toEqual({ files: 2, symbols: 2 });
        expect(b.seen('r2')).toEqual({ files: 0, symbols: 0 });
        expect(fs.readFileSync(file, 'utf8')).not.toContain('src/a.ts');
    });

    it('the cap is a constant of 20 %', () => {
        expect(EXPOSURE_SHARE_CAP).toBe(0.2);
    });
});

describe('the chooser reads exposure', () => {
    it('prefers the least-exposed admissible route', () => {
        const share = (n: string): number => ({ r1: 0.15, r2: 0.05, r3: 0.1 })[n] ?? 0;
        const c = chooseRoute({ kind: 'classify', contentClass: 'public-artifact', candidates: [free('r1'), free('r2'), free('r3')], exposureShare: share });
        expect(c.route?.name).toBe('r2');
    });

    it('refuses a route this call would push past the cap', () => {
        const c = chooseRoute({
            kind: 'classify',
            contentClass: 'public-artifact',
            candidates: [free('r1'), PAID],
            exposureShare: (n) => (n === 'r1' ? 0.21 : 0),
        });
        expect(c.route?.name).toBe('paid');
        expect(c.refused).toContainEqual({ name: 'r1', reason: 'exposure-cap' });
    });

    it('an unknown denominator refuses unpaid routes and leaves a paid route usable', () => {
        const c = chooseRoute({ kind: 'classify', contentClass: 'public-artifact', candidates: [free('r1'), PAID], exposureShare: () => null });
        expect(c.route?.name).toBe('paid');
        expect(c.refused).toContainEqual({ name: 'r1', reason: 'exposure-unknown' });
    });
});

describe('a seeded multi-route run', () => {
    it('leaves no route above the cap', async () => {
        const tracked = 100;
        const ledger = new ExposureLedger(null);
        const members = ['r1', 'r2', 'r3'].map(
            (name) =>
                ({
                    name,
                    billing_class: 'free-quota',
                    ask: () => new CouncilResponse({ provider: name, model: 'm', text: '{"label":"x","confidence":0.5}', input_tokens: 1, output_tokens: 1 }),
                }) as unknown as ExternalAIClient,
        );
        let served = 0;
        for (let i = 0; i < 90; i++) {
            const r = await askHand(
                { kind: 'classify', spec: `label slice ${i}` },
                {
                    members,
                    contentClass: 'public-artifact',
                    auditDir: null,
                    flips: () => true,
                    egress: resetCouncilEgress({ identifiers: true }),
                    exposure: { ledger, exposes: { files: [`src/f${i}.ts`], symbols: [`fn${i}`] }, trackedFiles: tracked },
                },
            );
            if (r !== null) served++;
        }
        for (const name of ['r1', 'r2', 'r3']) {
            expect(ledger.seen(name).files / tracked).toBeLessThanOrEqual(EXPOSURE_SHARE_CAP);
        }
        expect(served).toBe(60);
        expect(exposureShareFn(ledger, { files: ['src/new.ts'], symbols: [] }, tracked)('r1')).toBeGreaterThan(EXPOSURE_SHARE_CAP);
    });
});
