// road-to-feedback-9.2.0-followups 1.4 — ask-rate telemetry facet for the
// cross-source-consistency rule. Pure schema tests for the `cross_source`
// field on `EngagementEvent` (structural only: id + closed type enum + bool,
// no free-form fields — PII-exclusion-by-construction per
// `artifact-engagement-recording`).
import { expect, test } from 'vitest';

import {
    ALLOWED_CROSS_SOURCE_TYPES,
    EngagementEvent,
    EngagementSchemaError,
    parse_event,
} from '../../src/agent-src/templates/scripts/telemetry/engagement.js';

function ev(init: Partial<ConstructorParameters<typeof EngagementEvent>[0]>): EngagementEvent {
    return new EngagementEvent({
        ts: '2026-07-28T00:00:00Z',
        task_id: 't1',
        boundary_kind: 'task',
        ...init,
    });
}

test('cross_source is optional and omitted from serialization when absent', () => {
    const e = ev({ consulted: { skills: ['a'] } });
    expect(e.to_jsonl()).not.toContain('"cross_source"');
});

test('empty cross_source array is valid but omitted from serialization (a consistent-sources task)', () => {
    const e = ev({ cross_source: [] });
    expect(() => e.validate()).not.toThrow();
    expect(e.to_jsonl()).not.toContain('"cross_source"');
});

test('one real discrepancy round-trips as exactly one cross_source entry', () => {
    const e = ev({ cross_source: [{ id: 'd1', type: 'text-image', asked: true }] });
    const line = e.to_jsonl();
    expect(line).toContain('"cross_source":[{"asked":true,"id":"d1","type":"text-image"}]');
    const parsed = parse_event(line);
    expect(parsed.cross_source).toEqual([{ id: 'd1', type: 'text-image', asked: true }]);
});

test('a surfaced-but-not-asked (warn) discrepancy records asked:false', () => {
    const e = ev({ cross_source: [{ id: 'd2', type: 'silent-needed', asked: false }] });
    expect(e.to_jsonl()).toContain('"asked":false');
});

test('every allowed discrepancy type validates', () => {
    for (const type of ALLOWED_CROSS_SOURCE_TYPES) {
        expect(() => ev({ cross_source: [{ id: 'x', type, asked: true }] }).validate()).not.toThrow();
    }
});

test('unknown discrepancy type is rejected', () => {
    expect(() => ev({ cross_source: [{ id: 'd1', type: 'bogus-type', asked: true }] }).validate())
        .toThrow(EngagementSchemaError);
    expect(() => ev({ cross_source: [{ id: 'd1', type: 'bogus-type', asked: true }] }).validate())
        .toThrow('cross_source.type must be one of');
});

test('non-boolean asked is rejected', () => {
    expect(() => ev({ cross_source: [{ id: 'd1', type: 'text-image', asked: 'yes' as unknown as boolean }] }).validate())
        .toThrow('cross_source.asked must be a bool');
});

test('a free-form / path-like id is rejected by the redaction floor', () => {
    expect(() => ev({ cross_source: [{ id: 'a/b', type: 'text-image', asked: true }] }).validate())
        .toThrow('forbidden character');
    expect(() => ev({ cross_source: [{ id: 'notes.md', type: 'text-image', asked: true }] }).validate())
        .toThrow('file extension');
});

test('an entry with an extra key is rejected — no free-form fields', () => {
    const bad = { id: 'd1', type: 'text-image', asked: true, note: 'free text' };
    expect(() => ev({ cross_source: [bad as never] }).validate())
        .toThrow("cross_source entry has unexpected key(s): note");
});

test('an entry missing a required key is rejected', () => {
    const bad = { id: 'd1', type: 'text-image' };
    expect(() => ev({ cross_source: [bad as never] }).validate())
        .toThrow("cross_source entry missing required key 'asked'");
});

test('cross_source exceeding the per-event cap is rejected', () => {
    const many = Array.from({ length: 33 }, (_, i) => ({ id: `d${i}`, type: 'text-image', asked: true }));
    expect(() => ev({ cross_source: many }).validate())
        .toThrow('cross_source exceeds 32 entries');
});

test('cross_source must be an array', () => {
    expect(() => ev({ cross_source: { id: 'd1' } as never }).validate())
        .toThrow('cross_source must be a list of dict or None');
});
