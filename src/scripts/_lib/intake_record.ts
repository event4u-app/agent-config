/**
 * One shape for the three learning-intake streams. `memory_signal` and the
 * retro already write it — `id`, `ts`, `origin`, `entry_type`, `path`, `body`,
 * plus the provenance fields `subject` and `source`. Knowledge events now write
 * it too, carrying the typed event unchanged under `event`, so one reader can
 * list every intake line and the typed consumers still get their event back.
 */
import { createHash } from 'node:crypto';

import type { KnowledgeEvent } from './knowledge_events.js';

export interface IntakeRecord {
    [key: string]: unknown;
    id: string;
    ts: string;
    origin: string;
    entry_type: string;
    path: string;
    body: string;
    subject: 'project';
    source: string;
}

export const KNOWLEDGE_EVENT_ORIGIN = 'knowledge-event';

function eventPath(e: KnowledgeEvent): string {
    switch (e.type) {
        case 'convention_detected':
            return (e.evidence[0] ?? '').replace(/:\d+$/, '');
        case 'context_stale':
            return e.pagePath;
        case 'api_shape_learned':
            return e.endpoint;
        case 'mistake_made':
            return e.contextSource ?? '';
    }
}

function eventBody(e: KnowledgeEvent): string {
    switch (e.type) {
        case 'convention_detected':
            return e.pattern;
        case 'mistake_made':
            return e.correction;
        case 'api_shape_learned':
            return `${e.method} ${e.endpoint}`;
        case 'context_stale':
            return `${e.field}: ${e.evidence}`;
    }
}

export function knowledgeEventRecord(e: KnowledgeEvent): IntakeRecord {
    const id = `ke_${createHash('sha256').update(JSON.stringify(e)).digest('hex').slice(0, 12)}`;
    return { id, ts: e.ts, origin: KNOWLEDGE_EVENT_ORIGIN, entry_type: e.type, path: eventPath(e), body: eventBody(e), subject: 'project', source: KNOWLEDGE_EVENT_ORIGIN, event: e };
}

/** The typed event inside a unified line, or the line itself when it predates the shape. */
export function eventOf(line: unknown): unknown {
    if (line !== null && typeof line === 'object' && (line as Record<string, unknown>)['origin'] === KNOWLEDGE_EVENT_ORIGIN) return (line as Record<string, unknown>)['event'];
    return line;
}

/** The kind of any intake line, old or new: `entry_type`, else a legacy `type`. */
export function intakeKind(line: Record<string, unknown>): string {
    return typeof line['entry_type'] === 'string' ? (line['entry_type'] as string) : typeof line['type'] === 'string' ? (line['type'] as string) : 'event';
}
