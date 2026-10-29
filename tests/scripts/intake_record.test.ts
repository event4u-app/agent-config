/**
 * I.5a — one shape for the three learning-intake streams; legacy lines still read.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KNOWLEDGE_EVENT_ORIGIN, intakeKind, knowledgeEventRecord } from '../../src/scripts/_lib/intake_record.js';
import { type KnowledgeEvent, appendEvent, readAllEvents } from '../../src/scripts/_lib/knowledge_events.js';

const event: KnowledgeEvent = { type: 'convention_detected', ts: '2026-10-01T00:00:00Z', pattern: 'barrel exports per folder', evidence: ['src/a/index.ts:1', 'src/b/index.ts:1'], sampleSize: 2, scope: 'project' };

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('the shared intake shape', () => {
    it('a knowledge event is written as the same record memory_signal and the retro write', () => {
        appendEvent(event, dir);
        const line = JSON.parse(fs.readFileSync(path.join(dir, 'events-2026-10.jsonl'), 'utf-8').trim()) as Record<string, unknown>;
        expect(Object.keys(line).sort()).toEqual(['body', 'entry_type', 'event', 'id', 'origin', 'path', 'source', 'subject', 'ts']);
        expect(line).toMatchObject({ origin: KNOWLEDGE_EVENT_ORIGIN, entry_type: 'convention_detected', path: 'src/a/index.ts', body: 'barrel exports per folder', subject: 'project' });
        expect(intakeKind(line)).toBe('convention_detected');
    });

    it('typed consumers get the event back, and a legacy typed line still reads', () => {
        appendEvent(event, dir);
        fs.appendFileSync(path.join(dir, 'events-2026-10.jsonl'), `${JSON.stringify({ ...event, pattern: 'legacy line' })}\n`);
        expect(readAllEvents(dir).map((e) => (e as { pattern: string }).pattern)).toEqual(['barrel exports per folder', 'legacy line']);
        expect(intakeKind({ type: 'mistake_made' })).toBe('mistake_made');
    });

    it('the id is content-addressed', () => {
        expect(knowledgeEventRecord(event).id).toBe(knowledgeEventRecord({ ...event }).id);
        expect(knowledgeEventRecord(event).id).not.toBe(knowledgeEventRecord({ ...event, pattern: 'other' }).id);
    });
});
