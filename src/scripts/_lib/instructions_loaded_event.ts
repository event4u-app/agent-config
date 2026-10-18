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
}

/** A token that is safe as a filename and carries no path: starts alphanumeric, no separators. */
export const ID_SHAPE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** The one rule for which directory entries are session files — the reader and the prune share it. */
export const isSessionFile = (f: string): boolean => f.endsWith('.jsonl') && ID_SHAPE_RE.test(f.slice(0, -6));

const idShaped = (v: unknown): string | null => (typeof v === 'string' && ID_SHAPE_RE.test(v) ? v : null);

export function captureInstructionsLoaded(payload: unknown, ts: string, home: string, env: NodeJS.ProcessEnv): CaptureLine {
    const p = (typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : {}) as Record<string, unknown>;
    const raw = String(p['file_path'] ?? '').replace(/\\/g, '/');
    // Only an absolute path with no `.`/`..` segment and no doubled separator is read at all.
    const norm = /^([A-Za-z]:)?\//.test(raw) && !/\/\.{0,2}\//.test(raw) ? raw : '';
    const h = home.replace(/\\/g, '/').replace(/\/+$/, '');
    return {
        v: 2,
        ts,
        agent: idShaped(env['AI_AGENT']),
        launch: idShaped(env['CLAUDE_CODE_ENTRYPOINT']),
        session: idShaped(p['session_id']),
        name: idShaped(p['hook_event_name']),
        reason: idShaped(p['load_reason']),
        file: idShaped(norm.slice(norm.lastIndexOf('/') + 1)),
        rules: norm.includes('/.claude/rules/'),
        user: h !== '' && norm.startsWith(`${h}/.claude/`),
    };
}
