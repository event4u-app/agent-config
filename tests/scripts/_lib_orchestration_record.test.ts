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

    it('carries dispatch_tokens + session_tier into the orchestration object (for the cost-%)', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE, dispatch_tokens: 84000, session_tier: 'high', tier_chosen: 'lite' });
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject({ dispatch_tokens: 84000, session_tier: 'high', tier_chosen: 'lite' });
    });

    it('defaults dispatch_tokens/session_tier to null and rejects a negative dispatch_tokens', () => {
        expect((buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>).dispatch_tokens).toBeNull();
        expect(buildOrchestrationLine({ ...BASE, dispatch_tokens: -5 }).errors.join(' ')).toMatch(/dispatch_tokens/);
    });

    it('carries the quality pair (first_pass_success / escalated) into the orchestration object', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE, first_pass_success: true, escalated: false });
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject({ first_pass_success: true, escalated: false });
    });

    it('defaults the quality pair to null when omitted (old callers stay valid)', () => {
        const o = buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>;
        expect(o.first_pass_success).toBeNull();
        expect(o.escalated).toBeNull();
    });

    it('rejects non-boolean quality values', () => {
        expect(buildOrchestrationLine({ ...BASE, first_pass_success: 'yes' as never }).errors.join(' ')).toMatch(/first_pass_success/);
        expect(buildOrchestrationLine({ ...BASE, escalated: 1 as never }).errors.join(' ')).toMatch(/escalated/);
    });
});

describe('lean-init additive fields (road-to-lean-agent-init Phase 3, schema_version stays 1)', () => {
    const LEAN = {
        init_tokens: 1_200,
        payload_hash: 'a1b2c3d4e5f6',
        lookup_class: 'references',
        route_taken: 'primitive',
        budget_hit: false,
        correctness_match: true,
        cache_hit: true,
        origin: 'lean-init-2026',
    } as const;

    it('carries all lean-init fields into the orchestration object', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE, ...LEAN });
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject(LEAN);
        expect(line).toMatchObject({ schema_version: 1 });
    });

    it('defaults every lean-init field to null when omitted (old callers stay valid)', () => {
        const o = buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>;
        for (const k of ['init_tokens', 'payload_hash', 'lookup_class', 'route_taken', 'budget_hit', 'correctness_match', 'cache_hit', 'origin']) {
            expect(o[k]).toBeNull();
        }
    });

    it('rejects malformed lean-init values with named errors', () => {
        expect(buildOrchestrationLine({ ...BASE, init_tokens: -1 }).errors.join(' ')).toMatch(/init_tokens/);
        expect(buildOrchestrationLine({ ...BASE, payload_hash: 'not hex!' }).errors.join(' ')).toMatch(/payload_hash/);
        expect(buildOrchestrationLine({ ...BASE, lookup_class: 'vibes' as never }).errors.join(' ')).toMatch(/lookup_class/);
        expect(buildOrchestrationLine({ ...BASE, route_taken: 'sideways' as never }).errors.join(' ')).toMatch(/route_taken/);
        expect(buildOrchestrationLine({ ...BASE, budget_hit: 'maybe' as never }).errors.join(' ')).toMatch(/budget_hit/);
        expect(buildOrchestrationLine({ ...BASE, origin: 'Free form prose!' }).errors.join(' ')).toMatch(/origin/);
    });

    it('a primitive lookup route records with spawn_count 0 (the one zero-spawn exception)', () => {
        const { line, errors } = buildOrchestrationLine({
            ...BASE,
            spawn_count: 0,
            route_taken: 'primitive',
            lookup_class: 'definition',
            origin: 'lean-init-2026',
        });
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject({ spawn_count: 0, route_taken: 'primitive' });
    });

    it('zero spawns WITHOUT a primitive route stays unrecordable (in-session work)', () => {
        expect(buildOrchestrationLine({ ...BASE, spawn_count: 0 }).errors.join(' ')).toMatch(/spawn_count/);
        expect(buildOrchestrationLine({ ...BASE, spawn_count: 0, route_taken: 'subagent' }).errors.join(' ')).toMatch(/spawn_count/);
    });

    it('origin cleanly segregates the lean-init sample from the scope-decision sample (council Q5)', () => {
        const lean = buildOrchestrationLine({ ...BASE, origin: 'lean-init-2026' }).line!.orchestration as Record<string, unknown>;
        const scope = buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>;
        expect(lean.origin).toBe('lean-init-2026');
        expect(scope.origin).toBeNull();
    });
});
