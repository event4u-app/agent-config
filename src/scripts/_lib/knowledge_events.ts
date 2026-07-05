/**
 * Typed observation-event schema — road-to-knowledge-system Phase 5
 * (living-context capture). During normal task work, an agent that
 * observes one of these four conditions appends an event to the
 * gitignored `agents/knowledge/intake/events-YYYY-MM.jsonl` stream —
 * never a tracked page mid-task. Consolidation (`/team-knowledge
 * consolidate`) reads this stream and proposes tracked-page
 * creates/updates as a reviewable batch.
 *
 * Four event types, one per capture trigger:
 *   - convention_detected — a coding standard/pattern observed with evidence
 *   - mistake_made        — an error traced to a followed (possibly stale) context
 *   - api_shape_learned   — a request/response shape observed on a real call
 *   - context_stale       — observed reality contradicts a documented page
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ConventionDetectedEvent {
    type: 'convention_detected';
    ts: string; // ISO-8601
    pattern: string;
    evidence: string[]; // file:line references
    sampleSize: number;
    scope: 'project' | 'global';
}

export interface MistakeMadeEvent {
    type: 'mistake_made';
    ts: string;
    errorCategory: string;
    contextSource: string | null; // which knowledge page (if any) was followed
    correction: string;
    recurrenceKey: string;
}

export interface ApiShapeLearnedEvent {
    type: 'api_shape_learned';
    ts: string;
    endpoint: string;
    method: string;
    requestSchema: unknown;
    responseSchema: unknown;
}

export interface ContextStaleEvent {
    type: 'context_stale';
    ts: string;
    pagePath: string;
    field: string;
    expected: unknown;
    actual: unknown;
    evidence: string;
}

export type KnowledgeEvent = ConventionDetectedEvent | MistakeMadeEvent | ApiShapeLearnedEvent | ContextStaleEvent;

export type ValidationResult = { valid: true; event: KnowledgeEvent } | { valid: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Validates the shape for the declared `type`. Does not require the event to be well-formed JSON — call after JSON.parse. */
export function validateEvent(raw: unknown): ValidationResult {
    const errors: string[] = [];
    if (!isPlainObject(raw)) {
        return { valid: false, errors: ['event must be a JSON object'] };
    }
    if (!isNonEmptyString(raw.ts) || !ISO_RE.test(raw.ts)) {
        errors.push('ts must be an ISO-8601 timestamp string');
    }

    switch (raw.type) {
        case 'convention_detected': {
            if (!isNonEmptyString(raw.pattern)) errors.push('pattern is required');
            if (!Array.isArray(raw.evidence) || raw.evidence.length === 0 || !raw.evidence.every((e) => typeof e === 'string')) {
                errors.push('evidence must be a non-empty string array');
            }
            if (typeof raw.sampleSize !== 'number' || raw.sampleSize < 1) errors.push('sampleSize must be a positive number');
            if (raw.scope !== 'project' && raw.scope !== 'global') errors.push('scope must be "project" or "global"');
            break;
        }
        case 'mistake_made': {
            if (!isNonEmptyString(raw.errorCategory)) errors.push('errorCategory is required');
            if (raw.contextSource !== null && !isNonEmptyString(raw.contextSource)) {
                errors.push('contextSource must be a string or null');
            }
            if (!isNonEmptyString(raw.correction)) errors.push('correction is required');
            if (!isNonEmptyString(raw.recurrenceKey)) errors.push('recurrenceKey is required');
            break;
        }
        case 'api_shape_learned': {
            if (!isNonEmptyString(raw.endpoint)) errors.push('endpoint is required');
            if (!isNonEmptyString(raw.method)) errors.push('method is required');
            if (!('requestSchema' in raw)) errors.push('requestSchema is required');
            if (!('responseSchema' in raw)) errors.push('responseSchema is required');
            break;
        }
        case 'context_stale': {
            if (!isNonEmptyString(raw.pagePath)) errors.push('pagePath is required');
            if (!isNonEmptyString(raw.field)) errors.push('field is required');
            if (!('expected' in raw)) errors.push('expected is required');
            if (!('actual' in raw)) errors.push('actual is required');
            if (!isNonEmptyString(raw.evidence)) errors.push('evidence is required');
            break;
        }
        default:
            errors.push(
                `unknown type "${String(raw.type)}" (expected one of convention_detected|mistake_made|api_shape_learned|context_stale)`,
            );
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }
    return { valid: true, event: raw as unknown as KnowledgeEvent };
}

const INTAKE_DIR = path.join('agents', 'knowledge', 'intake');

/** sorted(events-*.jsonl) under the intake dir — absolute-or-relative per `dir`. */
export function intakeFiles(dir: string = INTAKE_DIR): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith('events-') && n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(dir, n));
}

function monthlyFile(dir: string, ts: string): string {
    const ym = ts.slice(0, 7); // "YYYY-MM"
    return path.join(dir, `events-${ym}.jsonl`);
}

/** Appends a validated event as one JSONL line to the current month's intake file. Throws if the event fails validation. */
export function appendEvent(event: KnowledgeEvent, dir: string = INTAKE_DIR): void {
    const result = validateEvent(event);
    if (!result.valid) {
        throw new Error(`invalid knowledge event: ${result.errors.join('; ')}`);
    }
    fs.mkdirSync(dir, { recursive: true });
    const file = monthlyFile(dir, event.ts);
    fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
}

/** Deletes every `events-*.jsonl` file under `dir` — called by `/team-knowledge consolidate` once a batch has been proposed and approved. All-or-nothing by design: consolidation processes the FULL pending backlog in one pass, so there is no partial-consumption state to track. No-op (never throws) if the dir does not exist or is already empty. */
export function clearAllEvents(dir: string = INTAKE_DIR): void {
    for (const file of intakeFiles(dir)) {
        try {
            fs.unlinkSync(file);
        } catch {
            // Already gone — fine.
        }
    }
}

/** Reads and validates every line across all intake files under `dir`. Malformed JSON lines are skipped (not thrown), matching the tolerant-reader convention used by memory_signal.ts's own intake scan. */
export function readAllEvents(dir: string = INTAKE_DIR): KnowledgeEvent[] {
    const out: KnowledgeEvent[] = [];
    for (const file of intakeFiles(dir)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();
            if (!line) continue;
            let parsed: unknown;
            try {
                parsed = JSON.parse(line);
            } catch {
                continue;
            }
            const result = validateEvent(parsed);
            if (result.valid) out.push(result.event);
        }
    }
    return out;
}
