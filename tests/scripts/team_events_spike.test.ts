// Tests for src/scripts/team_events_spike.ts (road-to-always-on-orchestration
// Phase 5.1). Behavioural spec only — every side effect (env, stdin, the
// tracked report file) is injected, so this suite never touches the real
// filesystem outside the OS temp dir and never depends on
// CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS actually being set.
import { describe, expect, it, vi } from 'vitest';

import * as spike from '../../src/scripts/team_events_spike.js';

describe('team_events_spike — constants', () => {
    it('names the three documented team events', () => {
        expect(spike.TEAM_EVENT_NAMES).toEqual(['TaskCreated', 'TaskCompleted', 'TeammateIdle']);
    });

    it('gates on the documented experimental flag name', () => {
        expect(spike.FLAG).toBe('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
    });
});

describe('extractShape — field names yes, values never', () => {
    it('records nested field names + JS types', () => {
        const payload = {
            hook_event_name: 'TaskCreated',
            session_id: 'sess-abc-123-super-secret-looking-string',
            task: { id: 42, title: 'do the thing', done: false, tags: ['a', 'b'] },
        };
        const entries = spike.extractShape(payload);
        const paths = entries.map((e) => e.path).sort();

        expect(paths).toContain('hook_event_name');
        expect(paths).toContain('session_id');
        expect(paths).toContain('task');
        expect(paths).toContain('task.id');
        expect(paths).toContain('task.title');
        expect(paths).toContain('task.done');
        expect(paths).toContain('task.tags');
        expect(paths).toContain('task.tags[]');

        const byPath = Object.fromEntries(entries.map((e) => [e.path, e.type]));
        expect(byPath['hook_event_name']).toBe('string');
        expect(byPath['task.id']).toBe('number');
        expect(byPath['task.done']).toBe('boolean');
        expect(byPath['task']).toBe('object');
        expect(byPath['task.tags']).toBe('array');
        expect(byPath['task.tags[]']).toBe('string');
    });

    it('never carries a value anywhere in the extracted entries', () => {
        const payload = { session_id: 'sess-abc-123-super-secret-looking-string', count: 42, ok: false };
        const entries = spike.extractShape(payload);
        const serialized = JSON.stringify(entries);

        expect(serialized).not.toContain('sess-abc-123-super-secret-looking-string');
        expect(serialized).not.toContain('42');
    });

    it('an empty object yields no fields to leak', () => {
        expect(spike.extractShape({})).toEqual([]);
    });
});

// m4 fix (independent-review finding): `inferEventName` used to return
// whatever string sat in the envelope's `hook_event_name`/`event`/`type`
// field verbatim — a payload-supplied VALUE copied into the recorded
// report, exactly what this script otherwise refuses to do. It now matches
// against the `TEAM_EVENT_NAMES` allowlist and returns `null` (→ the
// caller's `'unlabeled-event'` fallback) for anything else.
describe('inferEventName — allowlist match, never the raw payload string', () => {
    it('returns a recognised name found under `hook_event_name`', () => {
        expect(spike.inferEventName({ hook_event_name: 'TaskCreated' })).toBe('TaskCreated');
    });

    it('returns a recognised name found under `type` (last-checked key)', () => {
        expect(spike.inferEventName({ type: 'TeammateIdle' })).toBe('TeammateIdle');
    });

    it('an UNRECOGNISED string in the envelope field returns null, never the raw string', () => {
        // Regression: this used to return the literal string below —
        // copying an arbitrary payload-supplied value into the tracked
        // report under the guise of an "event name".
        expect(spike.inferEventName({ hook_event_name: 'super-secret-teammate-handle-as-event-name' })).toBeNull();
    });

    it('a non-string value in the envelope field is ignored, never coerced', () => {
        expect(spike.inferEventName({ hook_event_name: 12345 })).toBeNull();
    });

    it('a non-object payload returns null', () => {
        expect(spike.inferEventName('TaskCreated')).toBeNull();
        expect(spike.inferEventName(null)).toBeNull();
        expect(spike.inferEventName(['TaskCreated'])).toBeNull();
    });

    it('checks fields in the documented precedence order, preferring the first recognised match', () => {
        expect(
            spike.inferEventName({ hook_event_name: 'TaskCreated', event: 'TeammateIdle' }),
        ).toBe('TaskCreated');
    });
});

describe('renderShapeReport — the written artifact carries no values', () => {
    it('lists field names + types, and excludes every observed value', () => {
        const payload = {
            hook_event_name: 'TeammateIdle',
            teammate_id: 'super-secret-teammate-handle',
            idle_ms: 4200,
            blocked: true,
            history: [{ note: 'do not leak this either' }],
        };
        const entries = spike.extractShape(payload);
        const report = spike.renderShapeReport('TeammateIdle', entries, '2026-08-09T00:00:00.000Z');

        // Field names + types are present.
        expect(report).toContain('`hook_event_name`');
        expect(report).toContain('`teammate_id`');
        expect(report).toContain('`idle_ms`');
        expect(report).toContain('`blocked`');
        expect(report).toContain('`history[].note`');
        expect(report).toContain('string');
        expect(report).toContain('number');
        expect(report).toContain('boolean');
        expect(report).toContain('TeammateIdle');
        expect(report).toContain('2026-08-09T00:00:00.000Z');

        // No observed value ever appears.
        expect(report).not.toContain('super-secret-teammate-handle');
        expect(report).not.toContain('4200');
        expect(report).not.toContain('do not leak this either');
    });

    it('renders an explicit empty-payload marker instead of an empty table', () => {
        const report = spike.renderShapeReport('TaskCompleted', [], '2026-08-09T00:00:00.000Z');
        expect(report).toContain('empty payload');
        expect(report).not.toContain('| Field | Type |');
    });
});

describe('run — flag skip', () => {
    it('skips cleanly without touching stdin or the report file when the flag is absent', async () => {
        const readStdin = vi.fn(async () => '');
        const writeReport = vi.fn();

        const result = await spike.run({ env: {}, readStdin, writeReport });

        expect(result.skipped).toBe(true);
        expect(result.reason).toContain(spike.FLAG);
        expect(readStdin).not.toHaveBeenCalled();
        expect(writeReport).not.toHaveBeenCalled();
    });

    it('skips cleanly on empty stdin even when the flag is set', async () => {
        const writeReport = vi.fn();
        const result = await spike.run({
            env: { [spike.FLAG]: '1' },
            readStdin: async () => '   ',
            writeReport,
        });
        expect(result.skipped).toBe(true);
        expect(writeReport).not.toHaveBeenCalled();
    });

    it('records a shape when the flag is set and a payload arrives on stdin', async () => {
        const payload = JSON.stringify({ hook_event_name: 'TeammateIdle', teammate_id: 'abc-secret' });
        let written = '';

        const result = await spike.run({
            env: { [spike.FLAG]: '1' },
            readStdin: async () => payload,
            writeReport: (section) => {
                written += section;
            },
            now: () => '2026-08-09T00:00:00.000Z',
        });

        expect(result.skipped).toBe(false);
        expect(result.eventName).toBe('TeammateIdle');
        expect(written).toContain('teammate_id');
        expect(written).not.toContain('abc-secret');
    });

    it('falls back to an explicit CLI event-name argument over payload inference', async () => {
        const payload = JSON.stringify({ hook_event_name: 'TaskCreated' });
        let written = '';
        const result = await spike.run({
            argv: ['TaskCompleted'],
            env: { [spike.FLAG]: '1' },
            readStdin: async () => payload,
            writeReport: (section) => {
                written += section;
            },
        });
        expect(result.eventName).toBe('TaskCompleted');
        expect(written).toContain('## TaskCompleted');
    });
});
