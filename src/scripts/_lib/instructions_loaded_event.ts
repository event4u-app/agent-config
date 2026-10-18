/**
 * One `InstructionsLoaded` host event, classified into a line the arrival
 * record can be built from.
 *
 * The host fires the event once per loaded `CLAUDE.md` / `.claude/rules/*.md`,
 * carrying `load_reason`, `trigger_file_path` and `parent_file_path`. Anything
 * this function cannot read with certainty becomes an `unknown`
 * line — never an arrival — so a host that changes the payload degrades the
 * record to "not observed" instead of to a false "loaded".
 *
 * NAMES, COUNTS AND ENUMS ONLY. The line keeps the file's basename and an enum
 * for where it lives; the path itself, which carries a user's home directory
 * and project names, is never written.
 */

/** The `load_reason` values the host documents. Any other value is `unknown`. */
export const LOAD_REASONS = ['session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact'] as const;
export type LoadReason = (typeof LOAD_REASONS)[number];

export type UnknownWhy = 'malformed' | 'event-mismatch' | 'no-file-path' | 'unknown-load-reason';

export interface LoadedLine {
    readonly v: 1;
    readonly ts: string;
    readonly session: string | null;
    readonly host_version: string | null;
    readonly launch: string | null;
    readonly event: 'loaded';
    readonly file: string;
    readonly kind: 'rule' | 'memory' | 'other';
    readonly scope: 'user' | 'project';
    readonly reason: LoadReason;
}

export interface UnknownLine {
    readonly v: 1;
    readonly ts: string;
    readonly session: string | null;
    readonly host_version: string | null;
    readonly launch: string | null;
    readonly event: 'unknown';
    readonly why: UnknownWhy;
}

export type ObserverLine = LoadedLine | UnknownLine;

const ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

function idOrNull(v: unknown): string | null {
    return typeof v === 'string' && ID_RE.test(v) ? v : null;
}

/** `claude-code_2-1-299_agent` → `2.1.299`; anything else → null. */
export function hostVersionFromEnv(env: NodeJS.ProcessEnv): string | null {
    const m = /^claude-code_(\d+)-(\d+)-(\d+)(?:_|$)/.exec(env['AI_AGENT'] ?? '');
    return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export function launchFromEnv(env: NodeJS.ProcessEnv): string | null {
    const v = env['CLAUDE_CODE_ENTRYPOINT'] ?? '';
    return /^[a-z][a-z0-9-]{0,31}$/.test(v) ? v : null;
}

/** Classify one host payload. Pure apart from the clock and env it is handed. */
export function classifyInstructionsLoaded(
    payload: unknown,
    ctx: { readonly ts: string; readonly home: string; readonly env: NodeJS.ProcessEnv },
): ObserverLine {
    const p = (typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : null) as Record<string, unknown> | null;
    const base = { v: 1 as const, ts: ctx.ts, host_version: hostVersionFromEnv(ctx.env), launch: launchFromEnv(ctx.env), session: idOrNull(p?.['session_id']) };
    const unknown = (why: UnknownWhy): UnknownLine => ({ ...base, event: 'unknown', why });
    if (p === null) return unknown('malformed');
    const name = p['hook_event_name'];
    if (name !== undefined && name !== 'InstructionsLoaded') return unknown('event-mismatch');
    const norm = String(p['file_path'] ?? '').replace(/\\/g, '/');
    const file = norm.slice(norm.lastIndexOf('/') + 1);
    if (!file.endsWith('.md') || !ID_RE.test(file)) return unknown('no-file-path');
    const reason = p['load_reason'];
    if (!(LOAD_REASONS as readonly unknown[]).includes(reason)) return unknown('unknown-load-reason');
    const kind = norm.includes('/.claude/rules/') ? 'rule' : file === 'CLAUDE.md' ? 'memory' : 'other';
    const home = ctx.home.replace(/\\/g, '/').replace(/\/+$/, '');
    const scope = home !== '' && norm.startsWith(`${home}/.claude/`) ? 'user' : 'project';
    return { ...base, event: 'loaded', file, kind, scope, reason: reason as LoadReason };
}
