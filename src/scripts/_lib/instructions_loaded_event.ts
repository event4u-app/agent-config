/**
 * What the `InstructionsLoaded` observer writes for one host event — the
 * capture, not the verdict. It runs inside the dispatcher bundle on every
 * instruction load, so it does the least that keeps the line private: every
 * string is kept only when it is a short id-shaped token, and the file path is
 * reduced to its basename plus two booleans before anything is written. Whether
 * the event is a valid load is decided later, outside the bundle, by
 * `instructions_loaded_classify.ts`.
 */

export interface CaptureLine {
    readonly v: 2;
    readonly ts: string;
    /** The host's own agent string, e.g. `claude-code_2-1-299_agent`. */
    readonly agent: string | null;
    readonly launch: string | null;
    readonly session: string | null;
    readonly name: string | null;
    readonly reason: string | null;
    readonly file: string | null;
    /** The path ran through a `.claude/rules/` directory. */
    readonly rules: boolean;
    /** The path sat under the user's own `~/.claude/`. */
    readonly user: boolean;
    /** The payload was an object at all. */
    readonly ok: boolean;
}

/** A token that is safe as a filename and carries no path: starts alphanumeric, no separators. */
export const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const token = (v: unknown): string | null => (typeof v === 'string' && TOKEN_RE.test(v) ? v : null);

export function captureInstructionsLoaded(payload: unknown, ts: string, home: string, env: NodeJS.ProcessEnv): CaptureLine {
    const ok = typeof payload === 'object' && payload !== null && !Array.isArray(payload);
    const p = (ok ? payload : {}) as Record<string, unknown>;
    const norm = String(p['file_path'] ?? '').replace(/\\/g, '/');
    const h = home.replace(/\\/g, '/').replace(/\/+$/, '');
    return {
        v: 2,
        ts,
        agent: token(env['AI_AGENT']),
        launch: token(env['CLAUDE_CODE_ENTRYPOINT']),
        session: token(p['session_id']),
        name: token(p['hook_event_name']),
        reason: token(p['load_reason']),
        file: token(norm.slice(norm.lastIndexOf('/') + 1)),
        rules: norm.includes('/.claude/rules/'),
        user: h !== '' && norm.startsWith(`${h}/.claude/`),
        ok,
    };
}
