// Tests for src/scripts/_lib/knowledge_events.ts (road-to-knowledge-system,
// Phase 5 — typed observation-event schema + intake append/read).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    appendEvent,
    intakeFiles,
    readAllEvents,
    validateEvent,
    type ApiShapeLearnedEvent,
    type ContextStaleEvent,
    type ConventionDetectedEvent,
    type MistakeMadeEvent,
} from '../../src/scripts/_lib/knowledge_events.ts';

const TS = '2026-07-05T12:00:00Z';

describe('validateEvent — convention_detected', () => {
    const valid: ConventionDetectedEvent = {
        type: 'convention_detected',
        ts: TS,
        pattern: 'camelCase API params',
        evidence: ['src/api/users.ts:42'],
        sampleSize: 4,
        scope: 'project',
    };

    it('accepts a well-formed event', () => {
        expect(validateEvent(valid)).toEqual({ valid: true, event: valid });
    });

    it('rejects missing pattern', () => {
        const result = validateEvent({ ...valid, pattern: '' });
        expect(result.valid).toBe(false);
    });

    it('rejects empty evidence array', () => {
        const result = validateEvent({ ...valid, evidence: [] });
        expect(result.valid).toBe(false);
    });

    it('rejects an invalid scope', () => {
        const result = validateEvent({ ...valid, scope: 'nonsense' });
        expect(result.valid).toBe(false);
    });

    it('rejects sampleSize <= 0', () => {
        expect(validateEvent({ ...valid, sampleSize: 0 }).valid).toBe(false);
    });
});

describe('validateEvent — mistake_made', () => {
    const valid: MistakeMadeEvent = {
        type: 'mistake_made',
        ts: TS,
        errorCategory: 'null-deref',
        contextSource: 'agents/knowledge/concepts/api-shape.md',
        correction: 'Guard against missing currency before formatting.',
        recurrenceKey: 'checkout-null-currency',
    };

    it('accepts a well-formed event', () => {
        expect(validateEvent(valid)).toEqual({ valid: true, event: valid });
    });

    it('accepts a null contextSource (no context page was followed)', () => {
        expect(validateEvent({ ...valid, contextSource: null }).valid).toBe(true);
    });

    it('rejects a non-string, non-null contextSource', () => {
        expect(validateEvent({ ...valid, contextSource: 42 }).valid).toBe(false);
    });

    it('rejects missing recurrenceKey', () => {
        expect(validateEvent({ ...valid, recurrenceKey: '' }).valid).toBe(false);
    });
});

describe('validateEvent — api_shape_learned', () => {
    const valid: ApiShapeLearnedEvent = {
        type: 'api_shape_learned',
        ts: TS,
        endpoint: '/v1/users/:id',
        method: 'GET',
        requestSchema: {},
        responseSchema: { id: 'string', name: 'string' },
    };

    it('accepts a well-formed event', () => {
        expect(validateEvent(valid)).toEqual({ valid: true, event: valid });
    });

    it('rejects missing endpoint', () => {
        expect(validateEvent({ ...valid, endpoint: '' }).valid).toBe(false);
    });
});

describe('validateEvent — context_stale', () => {
    const valid: ContextStaleEvent = {
        type: 'context_stale',
        ts: TS,
        pagePath: 'agents/knowledge/concepts/api-conventions.md',
        field: 'response_format',
        expected: '{status, data, error}',
        actual: '{success, payload}',
        evidence: 'profile.test.ts:45',
    };

    it('accepts a well-formed event', () => {
        expect(validateEvent(valid)).toEqual({ valid: true, event: valid });
    });

    it('rejects missing evidence', () => {
        expect(validateEvent({ ...valid, evidence: '' }).valid).toBe(false);
    });
});

describe('validateEvent — cross-cutting', () => {
    it('rejects a non-object', () => {
        expect(validateEvent('just a string').valid).toBe(false);
        expect(validateEvent(null).valid).toBe(false);
    });

    it('rejects a missing/malformed ts', () => {
        expect(validateEvent({ type: 'mistake_made', ts: 'not-a-date' }).valid).toBe(false);
    });

    it('rejects an unknown type', () => {
        const result = validateEvent({ type: 'bogus_type', ts: TS });
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.errors[0]).toContain('unknown type');
    });
});

describe('appendEvent / readAllEvents / intakeFiles', () => {
    function mkDir(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-events-'));
    }

    it('appends a valid event to the current month file and it round-trips via readAllEvents', () => {
        const dir = mkDir();
        const event: MistakeMadeEvent = {
            type: 'mistake_made',
            ts: TS,
            errorCategory: 'null-deref',
            contextSource: null,
            correction: 'fix it',
            recurrenceKey: 'x',
        };
        appendEvent(event, dir);
        expect(readAllEvents(dir)).toEqual([event]);
        expect(intakeFiles(dir)).toEqual([path.join(dir, 'events-2026-07.jsonl')]);
    });

    it('throws on an invalid event and does not write anything', () => {
        const dir = mkDir();
        expect(() => appendEvent({ type: 'mistake_made', ts: TS } as unknown as MistakeMadeEvent, dir)).toThrow(
            /invalid knowledge event/,
        );
        expect(intakeFiles(dir)).toEqual([]);
    });

    it('readAllEvents skips malformed JSON lines without throwing', () => {
        const dir = mkDir();
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'events-2026-07.jsonl'),
            'not json\n' + JSON.stringify({ type: 'mistake_made', ts: TS, errorCategory: 'x', contextSource: null, correction: 'y', recurrenceKey: 'z' }) + '\n',
            'utf8',
        );
        expect(readAllEvents(dir)).toHaveLength(1);
    });

    it('readAllEvents on a missing dir returns an empty array', () => {
        expect(readAllEvents('/nonexistent/xyz')).toEqual([]);
    });

    it('appendEvent routes different months into different files', () => {
        const dir = mkDir();
        appendEvent(
            { type: 'mistake_made', ts: '2026-06-01T00:00:00Z', errorCategory: 'a', contextSource: null, correction: 'b', recurrenceKey: 'c' },
            dir,
        );
        appendEvent(
            { type: 'mistake_made', ts: '2026-07-01T00:00:00Z', errorCategory: 'a', contextSource: null, correction: 'b', recurrenceKey: 'c' },
            dir,
        );
        expect(intakeFiles(dir)).toEqual([
            path.join(dir, 'events-2026-06.jsonl'),
            path.join(dir, 'events-2026-07.jsonl'),
        ]);
    });
});
