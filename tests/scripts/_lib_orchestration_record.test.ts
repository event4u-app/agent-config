import { describe, expect, it } from 'vitest';

import { buildOrchestrationLine, type RecordInput } from '../../src/scripts/_lib/orchestration_record.js';

const BASE: RecordInput = {
    spawn_count: 1,
    token_delta: -72000,
    ts: '2026-07-09T12:00:00.000Z',
    id: 'ABC123',
};

describe('buildOrchestrationLine', () => {
    it('builds a valid audit-log-v1 line with the orchestration object', () => {
        const { line, errors } = buildOrchestrationLine({
            ...BASE,
            token_delta_provenance: 'measured',
            tier_chosen: 'lite',
            tier_source: 'inferred',
            task_class: 'read-only-fanout',
            tiers: ['sonnet'],
        });
        expect(errors).toEqual([]);
        expect(line).not.toBeNull();
        expect(line).toMatchObject({
            schema_version: 1,
            id: 'ABC123',
            ts: BASE.ts,
            input_kind: 'orchestration',
            type: 'phase',
            outcome: 'success', // DONE → success
        });
        expect(line!.orchestration).toMatchObject({
            spawn_count: 1,
            token_delta: -72000,
            token_delta_provenance: 'measured',
            tier_chosen: 'lite',
            tier_source: 'inferred',
            task_class: 'read-only-fanout',
            tiers: ['sonnet'],
        });
    });

    it('applies safe defaults (provenance estimated, null tiers/class, envelope bands)', () => {
        const { line, errors } = buildOrchestrationLine(BASE);
        expect(errors).toEqual([]);
        const o = line!.orchestration as Record<string, unknown>;
        expect(o.token_delta_provenance).toBe('estimated');
        expect(o.tier_chosen).toBeNull();
        expect(o.task_class).toBeNull();
        expect(o.tiers).toEqual([]);
        expect(line).toMatchObject({ confidence_band: 'medium', risk_class: 'low', phase: 'implement' });
    });

    it('maps dispatch outcomes to envelope outcomes', () => {
        expect(buildOrchestrationLine({ ...BASE, dispatch_outcome: 'BLOCKED' }).line).toMatchObject({ outcome: 'blocked' });
        expect(buildOrchestrationLine({ ...BASE, dispatch_outcome: 'NEEDS_CONTEXT' }).line).toMatchObject({ outcome: 'skipped' });
        expect(buildOrchestrationLine({ ...BASE, dispatch_outcome: 'killed' }).line).toMatchObject({ outcome: 'error' });
        expect(buildOrchestrationLine({ ...BASE, dispatch_outcome: 'DONE_WITH_CONCERNS' }).line).toMatchObject({ outcome: 'success' });
    });

    it('rejects spawn_count < 1 (0 = in-session, not a dispatch)', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE, spawn_count: 0 });
        expect(line).toBeNull();
        expect(errors.join(' ')).toMatch(/spawn_count/);
    });

    it('rejects a non-integer token_delta and bad enums', () => {
        expect(buildOrchestrationLine({ ...BASE, token_delta: 1.5 }).errors.join(' ')).toMatch(/token_delta/);
        expect(buildOrchestrationLine({ ...BASE, tier_chosen: 'huge' as never }).errors.join(' ')).toMatch(/tier_chosen/);
        expect(buildOrchestrationLine({ ...BASE, token_delta_provenance: 'guessed' as never }).errors.join(' ')).toMatch(/provenance/);
    });

    it('requires ts and id', () => {
        expect(buildOrchestrationLine({ ...BASE, ts: '' }).errors.join(' ')).toMatch(/ts/);
        expect(buildOrchestrationLine({ ...BASE, id: '' }).errors.join(' ')).toMatch(/id/);
    });
});
