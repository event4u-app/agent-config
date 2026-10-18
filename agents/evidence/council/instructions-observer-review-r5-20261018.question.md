<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 5) for branch drain/road-to-a-setup-that-decides-itself-20261018, verbatim below this comment. -->

# Modification review, round 5 — the InstructionsLoaded observer after round 4

You are one seat of a modification review of binding the host's asynchronous,
non-blocking `InstructionsLoaded` event to a capture-only observer on the
`claude` platform (owner-scheduled 2026-10-15; kill switch: the environment
variable named by the hook's `KILL_SWITCH_ENV` constant set to `off`, or
removing the one manifest binding and reinstalling). Its only consumer is a
pure decision function that returns `full` whenever evidence is missing or
doubtful; nothing thins a machine's rule layer before a later, separately
pre-registered and council-reviewed comparison.

Round 4: anthropic `confirmed-non-expanding` (dealbreaker on three points),
openai `refused`. Their points and what commit `abc48378b` does:

1. A null event name was accepted → the classifier now requires
   `name === 'InstructionsLoaded'`; a missing name is `event-mismatch`.
2. Lexical path classification → the capture keeps the path only when it is
   absolute (`/` or a drive letter) with no `.` or `..` segment and no doubled
   separator; otherwise the line is `unknown` (`no-file-path`). Tests for a
   relative, a `..`, a `.` and a `//` path.
3. `isSessionFile` too broad / symlink append → only `_.jsonl` or an
   id-shaped stem counts; the hook checks the session file with `lstatSync`
   and never appends to a symlink or non-regular entry; prune uses `lstat`
   for mtimes. Test: a symlinked session file's target stays empty.
4. Retention after a crash between append and prune → the header now says
   the count can exceed 50 by writers killed in that gap until the next
   write, which prunes again.
5. Line-size bound unproven → test: every field at its 128-character maximum
   serialises under 2 KiB; the header cites that bound for the cap overshoot.
6. Lines without a session id merging → they go to `_.jsonl` with
   `session: null`; the record builder ignores null sessions. Test: three
   such lines produce no record and nothing in the report.
7. A redacted line in round 4 → the transport redacted an assignment whose
   identifier contained the word for an auth credential; the helper is now
   `idShaped`. Nothing else was or is hidden.

Live, through the built bundle: 40 parallel loads of one session → 40 lines;
60 parallel new sessions → exactly 50 files. Bundle 1,549,401 B of 1,550,000.

Answer each question below, numbered 1 to 9 in this order, each on its own
numbered top-level line, then close with exactly one stance line in the form
`STANCE: <label> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>` where
<label> is one of `ratified`, `confirmed-non-expanding`, `refused`.

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Say for each of points 1–7 whether it is closed.

## `src/scripts/hooks/instructions_observer_hook.ts`

```ts
#!/usr/bin/env tsx
/**
 * `InstructionsLoaded` observer — capture only.
 *
 * Appends one classified line per host load event to
 * `<machine root>/runtime/arrivals/<session>.jsonl`, the input of that
 * session's arrival record. It emits nothing to the model and returns 0 on
 * every path: an instrument that can fail a turn is a mechanism, and this is not
 * one. Lines carry a file basename, two enums and the host version — never a
 * path or a file's contents — and never leave the machine.
 *
 * ONE FILE PER SESSION, BECAUSE THE HOST RUNS THIS EVENT ASYNCHRONOUSLY. A
 * session start fires one event per loaded file and the hooks run in parallel,
 * so append order is scheduler order and the reader treats each session as a
 * set. Retention is the newest {@link KEEP_SESSIONS} session files, each capped
 * at {@link MAX_SESSION_BYTES}; old files are deleted whole, never rotated.
 *
 * THE BOUNDS, STATED AS WHAT THEY ARE. Every write prunes after it appends, so
 * the file count can exceed fifty by the writers between their append and their
 * own prune, and by any writer killed in that gap — until the next write, which
 * prunes again. The byte cap is checked before the append, so a file can exceed
 * it by one line (under 2 KiB, every field being a token of at most 128
 * characters) per writer racing past the check at once. Neither bound is
 * a lock, and no lock is taken: a hook that can wait on another hook is a hook
 * that can stall a session.
 *
 * WHAT A RACE CAN AND CANNOT DO. Two processes pruning at once both succeed. A
 * prune can delete the file of an idle session older than fifty newer ones; if
 * that session loads a file later, it starts a new file without its start-up
 * loads, which the record reads as `unknown` — evidence is lost in the
 * direction that keeps the machine full, never invented.
 *
 * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
 * a reinstall; removing the one `instructions_loaded` binding in
 * `hook_manifest.yaml` and reinstalling removes it entirely. Either is the
 * response to hook failures, duplicate events, a session-start regression or an
 * unexplained test break.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { event4u_root } from '../_lib/user_global_paths.js';
import { captureInstructionsLoaded, isSessionFile } from '../_lib/instructions_loaded_event.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
export const KEEP_SESSIONS = 50;
/** A session file stops growing here (see the header for the overshoot under racing writers). */
export const MAX_SESSION_BYTES = 256 * 1024;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} session files; ties broken by name. */
function prune(dir: string): void {
    const files = fs
        .readdirSync(dir)
        .filter(isSessionFile)
        .map((f) => ({ f, t: fs.lstatSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t || (a.f < b.f ? -1 : 1));
    for (const { f } of files.slice(KEEP_SESSIONS)) fs.rmSync(path.join(dir, f), { force: true });
}

export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
    try {
        if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
        let parsed: unknown = null;
        try {
            parsed = raw.trim() ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
        const inner = envelope?.['payload'];
        const payload = typeof inner === 'object' && inner !== null ? inner : envelope;
        const line = captureInstructionsLoaded(payload, new Date().toISOString(), env['HOME'] ?? os.homedir(), env);
        const dir = arrivalsDir(env);
        const file = path.join(dir, `${line.session ?? '_'}.jsonl`);
        let st: fs.Stats | null = null;
        try {
            st = fs.lstatSync(file);
        } catch {
            // First line of this session.
        }
        // A symlink or anything but a regular file is never appended to.
        if (st !== null && (!st.isFile() || st.size >= MAX_SESSION_BYTES)) return EXIT_ALLOW;
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
        prune(dir);
    } catch {
        // An unwritable disk, or a file a parallel prune removed, loses one line; it never fails the session.
    }
    return EXIT_ALLOW;
}

export function main(): number {
    return processEnvelope(readHookStdin());
}
```

## `src/scripts/_lib/instructions_loaded_event.ts`

```ts
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
export const ID_SHAPE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** The one rule for which directory entries are session files — the reader and the prune share it. */
export const isSessionFile = (f: string): boolean => f.endsWith('.jsonl') && (f === '_.jsonl' || ID_SHAPE_RE.test(f.slice(0, -6)));

const idShaped = (v: unknown): string | null => (typeof v === 'string' && ID_SHAPE_RE.test(v) ? v : null);

export function captureInstructionsLoaded(payload: unknown, ts: string, home: string, env: NodeJS.ProcessEnv): CaptureLine {
    const ok = typeof payload === 'object' && payload !== null && !Array.isArray(payload);
    const p = (ok ? payload : {}) as Record<string, unknown>;
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
        ok,
    };
}
```

## `src/scripts/_lib/instructions_loaded_classify.ts`

```ts
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
    if (c.name !== 'InstructionsLoaded') return unknown('event-mismatch');
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
```

## Test cases in `tests/scripts/arrival_record.test.ts`

- keeps the basename and a scope enum, never the path
- reads a project rule and a CLAUDE.md
- records every payload it cannot read as unknown
- fails closed on a missing event name and on a path that is not absolute and canonical
- a line with every field at its maximum length stays under 2 KiB
- parses the host version only from the documented agent string
- one clean session yields one visible record
- ${name} → unknown, never an arrival
- events reordered → the same record as in order; order can neither create nor remove an arrival
- a session mixing host versions is unknown
- lines of another session do not leak in
- rejects a body or a prompt field anywhere
- reports the standing-law set as loaded only when every member loaded at session start
- a project-scope load is not evidence about the installed layer
- reached, not-reached, and unknown for an unknown record
- appends one line per event to its session file, and a record can be built from the directory
- keeps only the newest sessions when a new one starts
- the kill switch writes nothing
- an envelope carrying another event is classified, not trusted: an unknown line
- a hostile session id never names a file outside the directory
- a session file stops growing at its cap
- sixty sessions leave exactly the newest fifty, ties broken by name
- a write to an existing session prunes too, so a count above fifty does not survive
- a file exactly at the cap takes no further line
- a non-session entry in the directory is neither read nor pruned
- a symlinked session file is never appended to
- lines without a session id never form a record, however many there are
- one unreadable session file does not discard the others
- prints one block per session, newest first, and nothing for an empty directory
