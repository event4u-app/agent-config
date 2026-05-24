/**
 * Safe task-execution layer for the browser-wizard.
 *
 * Phase 1 of road-to-ai-os-product-ui. The GUI exposes a small,
 * hard-coded allowlist of read-only / idempotent Taskfile targets so
 * maintainers can drive the workspace from the browser without leaving
 * the wizard.  The allowlist is closed by construction — there is no
 * code path through which a caller can spawn an arbitrary command.
 *
 *   • spawn without shell  (no shell-meta interpolation)
 *   • per-run wall-clock cap (TIMEOUT_MS)
 *   • single-flight: only one task runs at a time per server
 *   • streamed stdout/stderr via async iterator → SSE
 *   • in-memory ring buffer of the last HISTORY_MAX runs
 */

import { spawn } from 'node:child_process';

/** Catalog entry surfaced via `/api/v1/task/catalog`. */
export interface TaskCatalogEntry {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly command: readonly string[];
}

/** Streamed line emitted from a running task. */
export type TaskRunEvent =
    | { readonly type: 'start'; readonly id: string; readonly command: readonly string[]; readonly ts: string }
    | { readonly type: 'stdout'; readonly line: string }
    | { readonly type: 'stderr'; readonly line: string }
    | { readonly type: 'exit'; readonly code: number; readonly durationMs: number; readonly ts: string }
    | { readonly type: 'error'; readonly message: string };

/** Single completed entry in the in-memory history ring. */
export interface TaskHistoryEntry {
    readonly id: string;
    readonly command: readonly string[];
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly exitCode: number;
    readonly durationMs: number;
    readonly stdoutTail: readonly string[];
    readonly stderrTail: readonly string[];
}

const TIMEOUT_MS = 60_000;
const HISTORY_MAX = 20;
const TAIL_LINES = 50;

/** Closed allowlist. Anything not in here is rejected with `unknown_task`. */
export const TASK_CATALOG: readonly TaskCatalogEntry[] = Object.freeze([
    { id: 'lint-skills', label: 'Lint skills', description: 'Validate every SKILL.md against the skill schema.', command: ['task', 'lint-skills'] },
    { id: 'test', label: 'Run tests', description: 'Run the full Vitest + pytest matrix.', command: ['task', 'test'] },
    { id: 'sync', label: 'Sync agent-src', description: 'Regenerate .agent-src/ + .augment/ from .agent-src.uncompressed/.', command: ['task', 'sync'] },
    { id: 'generate-tools', label: 'Generate tool projections', description: 'Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules.', command: ['task', 'generate-tools'] },
    { id: 'check-refs', label: 'Check cross-references', description: 'Validate every cross-reference between artefacts.', command: ['task', 'check-refs'] },
]);

const history: TaskHistoryEntry[] = [];
let inFlight: { id: string; startedAt: string } | undefined;

/** Read-only snapshot of the in-memory history (newest first). */
export function getTaskHistory(): readonly TaskHistoryEntry[] {
    return history.slice().reverse();
}

/** Resolve a task id against the closed catalog. */
export function resolveTask(id: string): TaskCatalogEntry | undefined {
    return TASK_CATALOG.find((t) => t.id === id);
}

/** True iff a task is currently executing on this server. */
export function isTaskRunning(): boolean {
    return inFlight !== undefined;
}

/**
 * Execute `entry.command` against `cwd`. Yields events suitable for SSE
 * framing. Caller is responsible for converting events to `data: …\n\n`.
 *
 * Single-flight: if a run is already active, yields a single `error`
 * event with `task_busy` and returns.
 */
export async function* runTask(entry: TaskCatalogEntry, cwd: string): AsyncGenerator<TaskRunEvent> {
    if (inFlight !== undefined) {
        yield { type: 'error', message: `task_busy:${inFlight.id}` };
        return;
    }
    const startedAt = new Date().toISOString();
    inFlight = { id: entry.id, startedAt };
    const t0 = Date.now();
    yield { type: 'start', id: entry.id, command: entry.command, ts: startedAt };

    const [bin, ...args] = entry.command;
    if (bin === undefined) {
        inFlight = undefined;
        yield { type: 'error', message: 'empty_command' };
        return;
    }
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], shell: false });

    const stdoutTail: string[] = [];
    const stderrTail: string[] = [];
    const events: TaskRunEvent[] = [];
    let resolveWait: (() => void) | undefined;
    const push = (e: TaskRunEvent): void => { events.push(e); resolveWait?.(); resolveWait = undefined; };

    const buffer = (stream: NodeJS.ReadableStream, type: 'stdout' | 'stderr', tail: string[]): void => {
        let partial = '';
        stream.on('data', (c: Buffer) => {
            partial += c.toString('utf8');
            let nl: number;
            while ((nl = partial.indexOf('\n')) >= 0) {
                const line = partial.slice(0, nl);
                partial = partial.slice(nl + 1);
                tail.push(line);
                if (tail.length > TAIL_LINES) tail.shift();
                push({ type, line });
            }
        });
        stream.on('end', () => { if (partial.length > 0) { tail.push(partial); push({ type, line: partial }); } });
    };
    buffer(child.stdout, 'stdout', stdoutTail);
    buffer(child.stderr, 'stderr', stderrTail);

    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch { /* ignore */ } push({ type: 'error', message: 'timeout' }); }, TIMEOUT_MS);

    const done: Promise<{ code: number; signal: NodeJS.Signals | null }> = new Promise((resolve) => {
        child.on('close', (code, signal) => resolve({ code: code ?? -1, signal }));
        child.on('error', (err) => { push({ type: 'error', message: err.message }); resolve({ code: -1, signal: null }); });
    });

    while (true) {
        while (events.length > 0) yield events.shift()!;
        const settled = await Promise.race([done, new Promise<undefined>((r) => { resolveWait = (): void => r(undefined); })]);
        if (settled !== undefined) break;
    }
    while (events.length > 0) yield events.shift()!;
    clearTimeout(timer);

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;
    const result = await done;
    const exitCode = result.signal !== null ? -1 : result.code;
    yield { type: 'exit', code: exitCode, durationMs, ts: finishedAt };

    history.push({ id: entry.id, command: entry.command, startedAt, finishedAt, exitCode, durationMs, stdoutTail: stdoutTail.slice(), stderrTail: stderrTail.slice() });
    while (history.length > HISTORY_MAX) history.shift();
    inFlight = undefined;
}

/** Test helper — reset module state between runs. */
export function __resetTaskState(): void {
    history.length = 0;
    inFlight = undefined;
}
