// U1a — the `loaded` denominator (superset contract + fired_ratio wiring).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, test } from 'vitest';

import { aggregate } from '../../src/agent-src/templates/scripts/telemetry/aggregator.js';
import { EngagementEvent, EngagementSchemaError } from '../../src/agent-src/templates/scripts/telemetry/engagement.js';
import { render_json, render_markdown } from '../../src/agent-src/templates/scripts/telemetry/report_renderer.js';

function ev(init: Partial<ConstructorParameters<typeof EngagementEvent>[0]>): EngagementEvent {
    return new EngagementEvent({
        ts: '2026-07-13T00:00:00Z',
        task_id: 't1',
        boundary_kind: 'task',
        ...init,
    });
}

test('loaded is optional and omitted from serialization when absent', () => {
    const e = ev({ consulted: { skills: ['a'] } });
    expect(e.to_jsonl()).not.toContain('"loaded"');
});

test('superset contract: consulted ⊆ loaded enforced per kind', () => {
    expect(() => ev({ consulted: { skills: ['x'] }, loaded: { skills: ['y'] } }).validate())
        .toThrow(EngagementSchemaError);
    expect(() => ev({ consulted: { skills: ['x'] }, loaded: { skills: ['x', 'y'] } }).validate())
        .not.toThrow();
});

test('aggregator counts loaded + renderer emits fired/loaded only when present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u1a-'));
    const log = path.join(dir, 'log.jsonl');
    const withLoaded = ev({ consulted: { rules: ['fired-rule'] }, applied: { rules: ['fired-rule'] }, loaded: { rules: ['fired-rule', 'dead-rule'] } });
    fs.writeFileSync(log, withLoaded.to_jsonl());
    const agg = aggregate(log);
    expect(agg.loaded_events).toBe(1);
    const stats = new Map(agg.stats().map((s) => [s.artefact_id, s]));
    expect(stats.get('fired-rule')?.fired_ratio).toBe(1);
    expect(stats.get('dead-rule')?.loaded).toBe(1);
    expect(stats.get('dead-rule')?.fired_ratio).toBe(0);
    expect(render_markdown(agg)).toContain('fired/loaded');
    expect(render_json(agg)).toContain('"fired_ratio"');

    // pre-U1a log → no loaded column, no fired_ratio field (parity preserved)
    const legacy = ev({ consulted: { rules: ['fired-rule'] } });
    fs.writeFileSync(log, legacy.to_jsonl());
    const agg2 = aggregate(log);
    expect(render_markdown(agg2)).not.toContain('fired/loaded');
    expect(render_json(agg2)).not.toContain('"fired_ratio"');
});
