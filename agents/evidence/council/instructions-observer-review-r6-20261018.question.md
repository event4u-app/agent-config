<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 6) for branch drain/road-to-a-setup-that-decides-itself-20261018, verbatim below this comment. -->

# Modification review, round 6 — the InstructionsLoaded observer after round 5

You are one seat of a modification review of binding the host's asynchronous,
non-blocking `InstructionsLoaded` event to a capture-only observer on the
`claude` platform (owner-scheduled 2026-10-15; kill switch: the environment
variable named by the hook's `KILL_SWITCH_ENV` constant set to `off`, or
removing the one manifest binding and reinstalling). Its only consumer is a
pure decision function that returns `full` whenever evidence is missing or
doubtful.

Round 5: both seats refused. Their points and what commit `bf7da41d2` does:

1. TOCTOU between `lstat` and `appendFileSync` → the file is opened once with
   `O_WRONLY|O_APPEND|O_CREAT|O_NOFOLLOW` (mode 0600), the descriptor is
   `fstat`ed for a regular file under the cap, and the line is written
   through that descriptor. A symlink at the path makes the open fail
   (`ELOOP`). Test: a symlinked session file's target stays empty and the
   failure is recorded; seen red with `O_NOFOLLOW` removed.
2. `_.jsonl` counted in the 50 → excluded from the count; capped like any
   other file; never forms a record.
3. Prune treated names as file type and aborted on a vanished entry → it
   `lstat`s each entry in its own `try`, keeps only regular files, skips a
   vanished one, and never deletes a non-regular entry. Test: a directory
   named like a session file and the placeholder file both survive 53 new
   sessions while exactly 50 session files remain.
4. Silent failure → any thrown write records `<ISO date> <error code>` in
   `arrivals.last-error` beside the directory (written with
   `O_TRUNC|O_NOFOLLOW`); `arrival_report` prints it.
5. Directory ownership → the header states the directory is this observer's
   alone.
6. The classifier is unchanged since round 5 (it was shown in full there).

Live, through the built bundle: 40 parallel loads of one session → 40 lines;
60 parallel new sessions → exactly 50 files. Bundle 1,549,953 B of 1,550,000.

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

Say for each of points 1–5 whether it is closed.

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
 * path or a file's contents — and never leave the machine. The directory is
 * this observer's alone; nothing else in the package writes there.
 *
 * ONE FILE PER SESSION, BECAUSE THE HOST RUNS THIS EVENT ASYNCHRONOUSLY. A
 * session start fires one event per loaded file and the hooks run in parallel,
 * so append order is scheduler order and the reader treats each session as a
 * set. Retention is the newest {@link KEEP_SESSIONS} session files, each capped
 * at {@link MAX_SESSION_BYTES}; old files are deleted whole, never rotated.
 * Lines without a session id go to `_.jsonl`, which is capped the same way, is
 * outside the session count, and never forms a record.
 *
 * ONE DESCRIPTOR, NO PATH CHECK. The file is opened once with `O_NOFOLLOW`, the
 * opened descriptor is checked to be a regular file under the cap, and the line
 * is written through it — so no symlink swapped in between a check and a write
 * can redirect the line.
 *
 * THE BOUNDS, STATED AS WHAT THEY ARE. Every write prunes after it appends, so
 * the file count can exceed fifty by the writers between their append and their
 * own prune, and by any writer killed in that gap — until the next write, which
 * prunes again. The byte cap is checked on the descriptor before the write, so a
 * file can exceed it by one line (under 2 KiB, every field being a token of at
 * most 128 characters) per writer racing past the check at once. Neither bound
 * is a lock, and no lock is taken: a hook that can wait on another hook is a
 * hook that can stall a session.
 *
 * WHAT A RACE CAN AND CANNOT DO. Two processes pruning at once both succeed. A
 * prune can delete the file of an idle session older than fifty newer ones; if
 * that session loads a file later, it starts a new file without its start-up
 * loads, which the record reads as `unknown` — evidence is lost in the
 * direction that keeps the machine full, never invented.
 *
 * A FAILURE LEAVES A MARK. Whatever stops a write — permissions, a full disk,
 * a symlink refused — is recorded as its error code in `arrivals.last-error`
 * beside the directory, so an observer that has gone quiet can be told apart
 * from one that saw nothing.
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

const C = fs.constants;
/** `O_NOFOLLOW` is POSIX; where the platform has none the flag is simply absent. */
const NOFOLLOW = C.O_NOFOLLOW ?? 0;
const APPEND_NOFOLLOW = C.O_WRONLY | C.O_APPEND | C.O_CREAT | NOFOLLOW;
const TRUNC_NOFOLLOW = C.O_WRONLY | C.O_TRUNC | C.O_CREAT | NOFOLLOW;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} regular session files; ties broken by name. */
function prune(dir: string): void {
    const files: { f: string; t: number }[] = [];
    for (const f of fs.readdirSync(dir)) {
        if (f === '_.jsonl' || !isSessionFile(f)) continue;
        try {
            const st = fs.lstatSync(path.join(dir, f));
            if (st.isFile()) files.push({ f, t: st.mtimeMs });
        } catch {
            // Removed by a parallel prune since the listing.
        }
    }
    files.sort((a, b) => b.t - a.t || (a.f < b.f ? -1 : 1));
    for (const { f } of files.slice(KEEP_SESSIONS)) fs.rmSync(path.join(dir, f), { force: true });
}

export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
    if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
    const dir = arrivalsDir(env);
    try {
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
        fs.mkdirSync(dir, { recursive: true });
        const fd = fs.openSync(path.join(dir, `${line.session ?? '_'}.jsonl`), APPEND_NOFOLLOW, 0o600);
        try {
            const st = fs.fstatSync(fd);
            if (st.isFile() && st.size < MAX_SESSION_BYTES) fs.writeSync(fd, `${JSON.stringify(line)}\n`);
        } finally {
            fs.closeSync(fd);
        }
        prune(dir);
    } catch (e) {
        try {
            const code = String((e as NodeJS.ErrnoException).code ?? 'error');
            fs.writeFileSync(`${dir}.last-error`, `${new Date().toISOString()} ${code}\n`, { flag: TRUNC_NOFOLLOW });
        } catch {
            // Nowhere to record it either; the session is still never failed.
        }
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

## The observer tests, from `tests/scripts/arrival_record.test.ts`

```ts
describe('the observer concern', () => {
    let root: string;
    let env: NodeJS.ProcessEnv;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'arrivals-'));
        env = { ...ENV, HOME, EVENT4U_CONFIG_HOME: root };
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const envelope = (payload: Record<string, unknown>) =>
        JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event: 'instructions_loaded',
            payload: { hook_event_name: 'InstructionsLoaded', ...payload },
        });

    it('appends one line per event to its session file, and a record can be built from the directory', () => {
        expect(processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), env)).toBe(0);
        expect(processEnvelope('{not json', env)).toBe(0);
        expect(fs.readdirSync(arrivalsDir(env)).sort()).toEqual(['_.jsonl', 's9.jsonl']);
        const lines = readObserverLines(arrivalsDir(env));
        expect(lines).toHaveLength(2);
        expect(latestArrivalRecord(lines)?.status).toBe('visible');
    });

    it('keeps only the newest sessions when a new one starts', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < KEEP_SESSIONS + 5; i += 1) {
            const f = path.join(dir, `old-${String(i)}.jsonl`);
            fs.writeFileSync(f, '');
            fs.utimesSync(f, 1_000 + i, 1_000 + i);
        }
        processEnvelope(envelope({ session_id: 'new', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        const left = fs.readdirSync(dir);
        expect(left).toHaveLength(KEEP_SESSIONS);
        expect(left).toContain('new.jsonl');
        expect(left).not.toContain('old-0.jsonl');
    });

    it('the kill switch writes nothing', () => {
        processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), { ...env, [KILL_SWITCH_ENV]: 'off' });
        expect(fs.existsSync(arrivalsDir(env))).toBe(false);
    });

    it('an envelope carrying another event is classified, not trusted: an unknown line', () => {
        processEnvelope(JSON.stringify({ event: 'stop', payload: { session_id: 'x', hook_event_name: 'Stop' } }), env);
        expect(readObserverLines(arrivalsDir(env))).toMatchObject([{ event: 'unknown', why: 'event-mismatch' }]);
    });

    it('a hostile session id never names a file outside the directory', () => {
        for (const sid of ['../escape', '..', '/abs', 'a/b', '.hidden']) {
            processEnvelope(envelope({ session_id: sid, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        expect(fs.readdirSync(root).sort()).toEqual(['runtime']);
        expect(fs.readdirSync(arrivalsDir(env))).toEqual(['_.jsonl']);
    });

    it('a session file stops growing at its cap', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'big.jsonl'), 'x'.repeat(MAX_SESSION_BYTES + 1));
        processEnvelope(envelope({ session_id: 'big', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.statSync(path.join(dir, 'big.jsonl')).size).toBe(MAX_SESSION_BYTES + 1);
    });

    it('sixty sessions leave exactly the newest fifty, ties broken by name', () => {
        for (let i = 0; i < 60; i += 1) {
            processEnvelope(envelope({ session_id: `s${String(i).padStart(2, '0')}`, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        const dir = arrivalsDir(env);
        for (const f of fs.readdirSync(dir)) fs.utimesSync(path.join(dir, f), 5_000, 5_000);
        processEnvelope(envelope({ session_id: 'zz', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readdirSync(dir)).toHaveLength(KEEP_SESSIONS);
    });

    it('a write to an existing session prunes too, so a count above fifty does not survive', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < KEEP_SESSIONS + 1; i += 1) {
            const f = path.join(dir, `n${String(i).padStart(2, '0')}.jsonl`);
            fs.writeFileSync(f, '{}\n');
            fs.utimesSync(f, 5_000 + i, 5_000 + i);
        }
        processEnvelope(envelope({ session_id: 'n10', file_path: USER_RULE('a'), load_reason: 'compact' }), env);
        expect(fs.readdirSync(dir)).toHaveLength(KEEP_SESSIONS);
    });

    it('a file exactly at the cap takes no further line', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'cap.jsonl'), 'x'.repeat(MAX_SESSION_BYTES));
        processEnvelope(envelope({ session_id: 'cap', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.statSync(path.join(dir, 'cap.jsonl')).size).toBe(MAX_SESSION_BYTES);
    });

    it('a non-session entry in the directory is neither read nor pruned', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'README'), 'x');
        processEnvelope(envelope({ session_id: 'ok', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readdirSync(dir).sort()).toEqual(['README', 'ok.jsonl']);
    });

    it('a symlinked session file is never appended to', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(root, 'elsewhere.txt');
        fs.writeFileSync(target, '');
        fs.symlinkSync(target, path.join(dir, 'link.jsonl'));
        processEnvelope(envelope({ session_id: 'link', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readFileSync(target, 'utf8')).toBe('');
        expect(lastObserverError(dir), 'the refusal leaves a mark').toMatch(/ ELOOP$/);
    });

    it('the placeholder file is outside the fifty, and a non-regular entry is never pruned', () => {
        const dir = arrivalsDir(env);
        processEnvelope(envelope({ file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        fs.utimesSync(path.join(dir, '_.jsonl'), 1, 1);
        fs.mkdirSync(path.join(dir, 'adir.jsonl'));
        fs.utimesSync(path.join(dir, 'adir.jsonl'), 1, 1);
        for (let i = 0; i < KEEP_SESSIONS + 3; i += 1) {
            processEnvelope(envelope({ session_id: `s${String(i).padStart(2, '0')}`, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        const left = fs.readdirSync(dir);
        expect(left).toContain('_.jsonl');
        expect(left).toContain('adir.jsonl');
        expect(left.filter((f) => /^s\d\d\.jsonl$/.test(f))).toHaveLength(KEEP_SESSIONS);
    });

    it('lines without a session id never form a record, however many there are', () => {
        for (let i = 0; i < 3; i += 1) processEnvelope(envelope({ file_path: USER_RULE(`r${String(i)}`), load_reason: 'session_start' }), env);
        const lines = readObserverLines(arrivalsDir(env));
        expect(lines).toHaveLength(3);
        expect(latestArrivalRecord(lines)).toBeNull();
        expect(recordsIn(arrivalsDir(env), 10)).toEqual([]);
    });

    it('one unreadable session file does not discard the others', () => {
        processEnvelope(envelope({ session_id: 'ok', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        fs.mkdirSync(path.join(arrivalsDir(env), 'broken.jsonl'));
        expect(readObserverLines(arrivalsDir(env)).map((l) => l.session)).toEqual(['ok']);
    });
});

```
