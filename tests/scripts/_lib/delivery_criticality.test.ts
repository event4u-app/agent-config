import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_CRITICALITY,
    DELIVERY_CRITICALITY,
    droppedObligations,
    isDeliveryCriticality,
    resolveDelivery,
    resolveDeliveryManifest,
    type DeliveryEntry,
} from '../../../src/scripts/_lib/delivery_criticality.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('delivery ladder — the three rungs', () => {
    it('critical-A never migrates, so carrier availability cannot reach it', () => {
        for (const available of [true, false]) {
            const d = resolveDelivery({ id: 'hard-floor', criticality: 'critical-A' }, available);
            expect(d.outcome).toBe('standing');
        }
    });

    it('critical-B falls back to EAGER delivery, never to silence', () => {
        const d = resolveDelivery({ id: 'x', criticality: 'critical-B', carrier: 'hook' }, false);
        expect(d.outcome).toBe('eager-fallback');
        expect(d.reason).toContain('rather than dropped');
    });

    it('standard may fail open', () => {
        expect(resolveDelivery({ id: 'x', criticality: 'standard' }, false).outcome).toBe('fail-open');
    });

    it('every rung is reachable and the enum has no fourth value', () => {
        expect([...DELIVERY_CRITICALITY]).toEqual(['critical-A', 'critical-B', 'standard']);
    });
});

describe('delivery ladder — fail-closed on an undeclared class', () => {
    it('an omitted class defaults to critical-B, not to standard', () => {
        expect(DEFAULT_CRITICALITY).toBe('critical-B');
        const d = resolveDelivery({ id: 'x', carrier: 'hook' }, false);
        expect(d.criticality).toBe('critical-B');
        expect(d.defaulted).toBe(true);
        expect(d.outcome).toBe('eager-fallback');
    });

    it('a typo cannot buy a weaker rung than the default', () => {
        const d = resolveDelivery({ id: 'x', criticality: 'standrad' as never }, false);
        expect(d.criticality).toBe('critical-B');
        expect(d.outcome).toBe('eager-fallback');
    });

    it('rejects non-members', () => {
        expect(isDeliveryCriticality('critical-C')).toBe(false);
        expect(isDeliveryCriticality(undefined)).toBe(false);
    });
});

describe("AC-4 — the roadmap's own verify, as a fixture carrier failure", () => {
    const manifest: DeliveryEntry[] = [
        { id: 'non-destructive-by-default', criticality: 'critical-A' },
        { id: 'design-review-after-ui-write', criticality: 'critical-B', carrier: 'ui-route-nudge' },
        { id: 'undeclared-obligation', carrier: 'ui-route-nudge' },
        { id: 'cosmetic-hint', criticality: 'standard', carrier: 'ui-route-nudge' },
    ];

    it('a critical-B obligation arrives eagerly when its carrier is down; none is dropped', () => {
        const decisions = resolveDeliveryManifest(manifest, false);
        const byId = Object.fromEntries(decisions.map((d) => [d.id, d]));

        expect(byId['design-review-after-ui-write']?.outcome).toBe('eager-fallback');
        expect(byId['undeclared-obligation']?.outcome).toBe('eager-fallback');
        expect(byId['non-destructive-by-default']?.outcome).toBe('standing');

        // Exactly one entry may fail open, and it is the one explicitly declared
        // `standard`. Anything else appearing here is a silent drop.
        expect(droppedObligations(decisions).map((d) => d.id)).toEqual(['cosmetic-hint']);
    });

    it('with the carrier up, everything migratable rides it', () => {
        const decisions = resolveDeliveryManifest(manifest, true);
        expect(decisions.filter((d) => d.outcome === 'carrier')).toHaveLength(3);
        expect(droppedObligations(decisions)).toEqual([]);
    });
});

describe('delivery-manifest schema', () => {
    interface EntrySchema {
        required: string[];
        properties: { criticality: { enum: string[] } };
    }
    const schema = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'delivery-manifest.schema.json'), 'utf-8'),
    ) as { definitions: { entry: EntrySchema } };

    it('requires the classification field on every entry', () => {
        expect(schema.definitions.entry.required).toContain('criticality');
    });

    it("the schema enum and the resolver's enum cannot drift", () => {
        expect(schema.definitions.entry.properties.criticality.enum).toEqual([...DELIVERY_CRITICALITY]);
    });
});
