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

    it('carries the L6 rule-usage pair; rules_used may never exceed rules_carried', () => {
        const ok = buildOrchestrationLine({ ...BASE, rules_carried: 32, rules_used: 5 });
        expect(ok.errors).toEqual([]);
        expect(ok.line!.orchestration).toMatchObject({ rules_carried: 32, rules_used: 5 });
        expect(buildOrchestrationLine({ ...BASE, rules_carried: 5, rules_used: 6 }).errors.join(' ')).toMatch(/rules_used cannot exceed/);
        expect(buildOrchestrationLine({ ...BASE, rules_carried: -1 }).errors.join(' ')).toMatch(/rules_carried/);
    });

    it('origin cleanly segregates the lean-init sample from the scope-decision sample (council Q5)', () => {
        const lean = buildOrchestrationLine({ ...BASE, origin: 'lean-init-2026' }).line!.orchestration as Record<string, unknown>;
        const scope = buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>;
        expect(lean.origin).toBe('lean-init-2026');
        expect(scope.origin).toBeNull();
    });
});

describe('dispatch-economy additive fields (road-to-token-economy-dispatch Phase 1.1, schema_version stays 1)', () => {
    it('carries work_tokens + floor_provenance and validates both', () => {
        const ok = buildOrchestrationLine({
            ...BASE,
            init_tokens: 235500,
            work_tokens: 41000,
            floor_provenance: 'measured',
        });
        expect(ok.errors).toEqual([]);
        expect(ok.line!.orchestration).toMatchObject({
            init_tokens: 235500,
            work_tokens: 41000,
            floor_provenance: 'measured',
        });
        expect(buildOrchestrationLine({ ...BASE, work_tokens: -5 }).errors.join(' ')).toMatch(/work_tokens/);
        expect(buildOrchestrationLine({ ...BASE, work_tokens: 1.5 }).errors.join(' ')).toMatch(/work_tokens/);
        expect(
            buildOrchestrationLine({ ...BASE, floor_provenance: 'guessed' as never }).errors.join(' '),
        ).toMatch(/floor_provenance/);
    });

    it('defaults floor_provenance to estimated when either half of the pair is present untagged', () => {
        const initOnly = buildOrchestrationLine({ ...BASE, init_tokens: 1200 }).line!.orchestration as Record<string, unknown>;
        expect(initOnly.floor_provenance).toBe('estimated');
        const workOnly = buildOrchestrationLine({ ...BASE, work_tokens: 900 }).line!.orchestration as Record<string, unknown>;
        expect(workOnly.floor_provenance).toBe('estimated');
        const neither = buildOrchestrationLine(BASE).line!.orchestration as Record<string, unknown>;
        expect(neither.floor_provenance).toBeNull();
        expect(neither.work_tokens).toBeNull();
    });
});

// ── served-model divergence (inbox-harvest-2026-08-b-ledger-truth 1.4) ──
//
// `tier_chosen`, `tier_source`, `session_tier` and the downshift cost-% are
// all derived from the REQUESTED model. On an alias or provider substitution
// every one of them attributes the saving to a model that never ran, and
// nothing on the line said so. `model_divergent` is the signal — derived, and
// deliberately three-valued: `null` is "not decidable", never "checked, and
// they matched".
describe('buildOrchestrationLine — served-model divergence', () => {
    it('records true when both ids are present and differ', () => {
        const { line, errors } = buildOrchestrationLine({
            ...BASE,
            model_requested: 'claude-sonnet-4-5',
            model_served: 'claude-sonnet-4-5-20260101',
        });
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject({
            model_requested: 'claude-sonnet-4-5',
            model_served: 'claude-sonnet-4-5-20260101',
            model_divergent: true,
        });
    });

    it('records false when both ids are present and match', () => {
        const { line } = buildOrchestrationLine({
            ...BASE,
            model_requested: 'gpt-4o',
            model_served: 'gpt-4o',
        });
        expect((line!.orchestration as Record<string, unknown>)['model_divergent']).toBe(false);
    });

    it('stays null when the transport reports no served id — absent is not agreement', () => {
        for (const served of ['', null, undefined]) {
            const { line } = buildOrchestrationLine({
                ...BASE,
                model_requested: 'claude-sonnet-4-5',
                model_served: served,
            });
            expect((line!.orchestration as Record<string, unknown>)['model_divergent']).toBeNull();
        }
    });

    it('stays null when neither id was recorded (a pre-extension line)', () => {
        const { line, errors } = buildOrchestrationLine(BASE);
        expect(errors).toEqual([]);
        expect(line!.orchestration).toMatchObject({
            model_requested: null,
            model_served: null,
            model_divergent: null,
        });
    });

    it('collects a non-string id into errors rather than throwing', () => {
        const { line, errors } = buildOrchestrationLine({
            ...BASE,
            model_served: 42 as unknown as string,
        });
        expect(errors).toContain('model_served must be a string or omitted');
        expect(line).toBeNull();
    });
});

describe('skills_applied — absent, empty and populated are three observations', () => {
    // audit-log-v1 gained `skills_applied` on 2026-08-30
    // (road-to-experience-loop-broadening step 1.2). The contract states that an
    // OMITTED key means "not recorded" while `[]` means "recorded, none
    // applied". These are asserted separately because folding them together is
    // silent: every existing producer omits the field, so a builder that
    // defaulted it to `[]` would report a negative signal for every caller that
    // simply has nothing to say — and a per-asset report could then never
    // distinguish no-signal from no-skills.

    it('omits the key entirely when the producer offered nothing', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE });
        expect(errors).toEqual([]);
        expect(line).not.toBeNull();
        expect(Object.prototype.hasOwnProperty.call(line!, 'skills_applied')).toBe(false);
    });

    it('emits an empty array when the producer recorded "none applied"', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE, skills_applied: [] });
        expect(errors).toEqual([]);
        expect(Object.prototype.hasOwnProperty.call(line!, 'skills_applied')).toBe(true);
        expect(line!.skills_applied).toEqual([]);
    });

    it('emits the ids when the producer recorded some', () => {
        const { line, errors } = buildOrchestrationLine({
            ...BASE,
            skills_applied: ['code-review', 'git-workflow'],
        });
        expect(errors).toEqual([]);
        expect(line!.skills_applied).toEqual(['code-review', 'git-workflow']);
    });

    it('bounds the array at 32, mirroring the rules_applied bound in the contract', () => {
        const many = Array.from({ length: 40 }, (_, i) => `skill-${i}`);
        const { line, errors } = buildOrchestrationLine({ ...BASE, skills_applied: many });
        expect(errors).toEqual([]);
        expect((line!.skills_applied as string[]).length).toBe(32);
    });

    it('rejects a non-id-shaped entry, so a body can never reach the line', () => {
        const { errors } = buildOrchestrationLine({
            ...BASE,
            skills_applied: ['this is a sentence, not an id'],
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.join(' ')).toMatch(/skills_applied/);
    });
});

describe('skills_applied — the committed fixture is a REAL emission', () => {
    // The step's verify line rejects a "collector exists" proxy explicitly: the
    // tree's own 0-of-89 finding is what that mistake cost. This fixture is the
    // literal stdout of `src/scripts/orchestration_record` writing to a temp
    // audit dir -- not a hand-written object -- so the assertion below proves
    // the field survives the real CLI path, not just the builder.
    it('carries skills_applied through the real CLI write path', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const url = await import('node:url');
        const here = path.dirname(url.fileURLToPath(import.meta.url));
        const fixture = path.join(here, '..', 'fixtures', 'audit-log', 'skills-applied-real-emission.jsonl');
        const lines = fs.readFileSync(fixture, 'utf-8').trim().split('\n');
        expect(lines.length).toBeGreaterThan(0);
        const rec = JSON.parse(lines[0]!) as Record<string, unknown>;
        expect(rec.schema_version).toBe(1);
        expect(rec.skills_applied).toEqual(['code-review', 'git-workflow']);
    });
});

describe('privacy_class — mandatory, and it says what the line carries', () => {
    // Step 1.4. The compile-time NoFreeForm guard is what STOPS a body reaching
    // the line; this field is what lets a consumer decide whether the stream is
    // safe to aggregate or export without re-deriving the answer from each
    // producer's source. Two mechanisms, not one restated twice -- the guard
    // without the declaration leaves every reader inferring the class, and the
    // declaration without the guard is a label with nothing behind it.

    it('is present on every built line, never optional', () => {
        const { line, errors } = buildOrchestrationLine({ ...BASE });
        expect(errors).toEqual([]);
        expect(line!.privacy_class).toBe('ids-only');
    });

    it('declares ids-only rather than counts-only, because the line carries id arrays', () => {
        // Not a style preference: `rules_applied` is always emitted and
        // `skills_applied` may be, so a `counts-only` declaration would be
        // false about this producer's own output.
        const { line } = buildOrchestrationLine({ ...BASE, skills_applied: ['code-review'] });
        expect(line!.rules_applied).toBeDefined();
        expect(line!.privacy_class).toBe('ids-only');
    });

    it('the committed real-emission fixture carries it too', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const url = await import('node:url');
        const here = path.dirname(url.fileURLToPath(import.meta.url));
        const fixture = path.join(here, '..', 'fixtures', 'audit-log', 'skills-applied-real-emission.jsonl');
        const rec = JSON.parse(fs.readFileSync(fixture, 'utf-8').trim().split('\n')[0]!) as Record<string, unknown>;
        expect(rec.privacy_class).toBe('ids-only');
    });
});
