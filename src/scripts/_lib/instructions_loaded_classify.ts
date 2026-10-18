/**
 * One captured `InstructionsLoaded` line, classified into what the arrival
 * record is built from. Runs at read time, never in the hook.
 *
 * The host fires the event once per loaded `CLAUDE.md` / `.claude/rules/*.md`,
 * with `file_path`, `memory_type`, `load_reason` and, for lazy loads, the
 * triggering path. Anything this cannot read with certainty becomes an
 * `unknown` line — never an arrival — so a host that changes the payload
 * degrades the record to "not observed" instead of to a false "loaded".
 */
import { captureInstructionsLoaded, type CaptureLine } from './instructions_loaded_event.js';

/** The `load_reason` values the host documents. Any other value is `unknown`. */
export const LOAD_REASONS = ['session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact'] as const;
export type LoadReason = (typeof LOAD_REASONS)[number];

export type UnknownWhy = 'malformed' | 'event-mismatch' | 'no-file-path' | 'unknown-load-reason';

interface LineBase {
    readonly v: 1;
    readonly ts: string;
    readonly session: string | null;
    readonly host_version: string | null;
    readonly launch: string | null;
}

export interface LoadedLine extends LineBase {
    readonly event: 'loaded';
    readonly file: string;
    readonly kind: 'rule' | 'memory' | 'other';
    readonly scope: 'user' | 'project';
    readonly reason: LoadReason;
}

export interface UnknownLine extends LineBase {
    readonly event: 'unknown';
    readonly why: UnknownWhy;
}

export type ObserverLine = LoadedLine | UnknownLine;

/** `claude-code_2-1-299_agent` → `2.1.299`; anything else → null. */
export function hostVersionFromAgent(agent: string | null | undefined): string | null {
    const m = /^claude-code_(\d+)-(\d+)-(\d+)(?:_|$)/.exec(agent ?? '');
    return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export function hostVersionFromEnv(env: NodeJS.ProcessEnv): string | null {
    return hostVersionFromAgent(env['AI_AGENT']);
}

export function classifyCapture(c: CaptureLine): ObserverLine {
    const base: LineBase = {
        v: 1,
        ts: c.ts,
        session: c.session,
        host_version: hostVersionFromAgent(c.agent),
        launch: c.launch !== null && /^[a-z][a-z0-9-]{0,31}$/.test(c.launch) ? c.launch : null,
    };
    const unknown = (why: UnknownWhy): UnknownLine => ({ ...base, event: 'unknown', why });
    if (!c.ok) return unknown('malformed');
    if (c.name !== null && c.name !== 'InstructionsLoaded') return unknown('event-mismatch');
    if (c.file === null || !c.file.endsWith('.md')) return unknown('no-file-path');
    if (!(LOAD_REASONS as readonly (string | null)[]).includes(c.reason)) return unknown('unknown-load-reason');
    const kind = c.rules ? 'rule' : c.file === 'CLAUDE.md' ? 'memory' : 'other';
    return { ...base, event: 'loaded', file: c.file, kind, scope: c.user ? 'user' : 'project', reason: c.reason as LoadReason };
}

/** Capture and classify in one step — the path a fixture takes. */
export function classifyInstructionsLoaded(
    payload: unknown,
    ctx: { readonly ts: string; readonly home: string; readonly env: NodeJS.ProcessEnv },
): ObserverLine {
    return classifyCapture(captureInstructionsLoaded(payload, ctx.ts, ctx.home, ctx.env));
}
