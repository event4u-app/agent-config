/**
 * analysis_run.ts — the persisted run core of the analysis doors: one record
 * per round under the gitignored `agents/runtime/analysis/<round-id>/`, legal
 * transitions only, atomic writes, resume that re-validates every pin, one
 * idempotency key per publication and a token budget whose cap ends the run
 * in `handed-back`.
 *
 * The state lives in code rather than in a prompt because a prompt cannot
 * guarantee resume or idempotency; a door re-invoked after a kill calls the
 * same stages again and every stage already passed is skipped.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const RUN_SCHEMA_VERSION = '1.0';
export const RUN_STATE_FILE = 'run-state.json';
export const RUNS_REL = 'agents/runtime/analysis';

export const RUN_STATES = [
    'initialized',
    'pinned',
    'seeded',
    'deepened',
    'exchanged',
    'judged',
    'awaiting-decision',
    'emitted',
    'validated',
    'committed',
    'pushed',
    'pr-open',
    'ci-settled',
    'done',
] as const;

export type ForwardState = (typeof RUN_STATES)[number];
export type RunState = ForwardState | 'handed-back';

export interface Transition {
    from: RunState;
    to: RunState;
    at: string;
    reason: string | null;
}

export interface RunRecord {
    schema_version: string;
    run_id: string;
    state: RunState;
    pins: Record<string, string>;
    budget: { cap_tokens: number; spent_tokens: number };
    publications: string[];
    handed_back_reason: string | null;
    history: Transition[];
}

export interface PinMove {
    pin: string;
    recorded: string;
    current: string | null;
}

export class RunError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RunError';
    }
}

export function isTerminal(state: RunState): boolean {
    return state === 'done' || state === 'handed-back';
}

export function legalNext(state: RunState): RunState[] {
    if (isTerminal(state)) return [];
    const idx = RUN_STATES.indexOf(state as ForwardState);
    return [RUN_STATES[idx + 1] as ForwardState, 'handed-back'];
}

export function runsDir(projectRoot: string): string {
    return path.join(projectRoot, RUNS_REL);
}

export function newRunId(now: Date = new Date()): string {
    const day = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `run-${day}-${randomBytes(3).toString('hex')}`;
}

function writeAtomic(file: string, body: string): void {
    const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, file);
}

function save(runDir: string, record: RunRecord): void {
    fs.mkdirSync(runDir, { recursive: true });
    writeAtomic(path.join(runDir, RUN_STATE_FILE), `${JSON.stringify(record, null, 2)}\n`);
}

/** Refuses a record whose major schema version this code does not know. */
export function assertKnownSchema(version: unknown, what: string): void {
    const major = typeof version === 'string' ? version.split('.')[0] : undefined;
    if (major !== RUN_SCHEMA_VERSION.split('.')[0]) {
        throw new RunError(`${what}: unknown schema_version ${JSON.stringify(version)} (this code reads ${RUN_SCHEMA_VERSION})`);
    }
}

export function createRun(
    projectRoot: string,
    options: { runId?: string; pins: Record<string, string>; tokenCap: number },
): { runDir: string; record: RunRecord } {
    if (!Number.isFinite(options.tokenCap) || options.tokenCap <= 0) {
        throw new RunError('tokenCap must be a positive number');
    }
    const runId = options.runId ?? newRunId();
    const runDir = path.join(runsDir(projectRoot), runId);
    if (fs.existsSync(path.join(runDir, RUN_STATE_FILE))) {
        throw new RunError(`run ${runId} already exists`);
    }
    const record: RunRecord = {
        schema_version: RUN_SCHEMA_VERSION,
        run_id: runId,
        state: 'initialized',
        pins: { ...options.pins },
        budget: { cap_tokens: options.tokenCap, spent_tokens: 0 },
        publications: [],
        handed_back_reason: null,
        history: [],
    };
    save(runDir, record);
    return { runDir, record };
}

export function loadRun(runDir: string): RunRecord {
    const file = path.join(runDir, RUN_STATE_FILE);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord;
    assertKnownSchema(raw.schema_version, file);
    return raw;
}

export function transition(runDir: string, record: RunRecord, to: RunState, reason: string | null = null): RunRecord {
    if (!legalNext(record.state).includes(to)) {
        throw new RunError(`illegal transition ${record.state} → ${to}`);
    }
    const next: RunRecord = {
        ...record,
        state: to,
        handed_back_reason: to === 'handed-back' ? (reason ?? 'unspecified') : record.handed_back_reason,
        history: [...record.history, { from: record.state, to, at: new Date().toISOString(), reason }],
    };
    save(runDir, next);
    return next;
}

export function handBack(runDir: string, record: RunRecord, reason: string): RunRecord {
    return transition(runDir, record, 'handed-back', reason);
}

/** True when `record` has already passed `target` on the forward path. */
export function reached(record: RunRecord, target: ForwardState): boolean {
    if (record.state === 'handed-back') return false;
    return RUN_STATES.indexOf(record.state as ForwardState) >= RUN_STATES.indexOf(target);
}

/**
 * Runs `effect` and moves to `target` — unless the record already reached it,
 * in which case nothing runs. This is what makes a re-invocation after a kill
 * resume instead of repeating a stage.
 */
export function runStage(
    runDir: string,
    record: RunRecord,
    target: ForwardState,
    effect: () => void,
): { record: RunRecord; performed: boolean } {
    if (reached(record, target)) return { record, performed: false };
    if (!legalNext(record.state).includes(target)) {
        throw new RunError(`illegal transition ${record.state} → ${target}`);
    }
    effect();
    return { record: transition(runDir, record, target), performed: true };
}

/**
 * Re-validates every recorded pin. A moved or missing pin is reported and the
 * record is returned unchanged — the caller decides, the run never continues
 * silently on a different head.
 */
export function resumeRun(
    runDir: string,
    currentPins: Record<string, string | null>,
): { record: RunRecord; moved: PinMove[] } {
    const record = loadRun(runDir);
    const moved: PinMove[] = [];
    for (const [pin, recorded] of Object.entries(record.pins)) {
        const current = currentPins[pin] ?? null;
        if (current !== recorded) moved.push({ pin, recorded, current });
    }
    return { record, moved };
}

export function publicationKey(runId: string, paths: readonly string[], baseSha: string): string {
    const body = JSON.stringify({ runId, paths: [...paths].sort(), baseSha });
    return createHash('sha256').update(body).digest('hex');
}

/** Performs a publication at most once per key across kills and re-runs. */
export function publishOnce(
    runDir: string,
    record: RunRecord,
    key: string,
    effect: () => void,
): { record: RunRecord; performed: boolean } {
    if (record.publications.includes(key)) return { record, performed: false };
    effect();
    const next: RunRecord = { ...record, publications: [...record.publications, key] };
    save(runDir, next);
    return { record: next, performed: true };
}

/** Adds spend; crossing the cap hands the run back rather than raising the cap. */
export function spendTokens(runDir: string, record: RunRecord, tokens: number): RunRecord {
    if (isTerminal(record.state)) {
        throw new RunError(`cannot spend on a run in ${record.state}`);
    }
    const spent = record.budget.spent_tokens + tokens;
    const next: RunRecord = { ...record, budget: { ...record.budget, spent_tokens: spent } };
    if (spent > record.budget.cap_tokens) {
        save(runDir, next);
        return handBack(runDir, next, `budget: ${spent} of ${record.budget.cap_tokens} tokens`);
    }
    save(runDir, next);
    return next;
}
