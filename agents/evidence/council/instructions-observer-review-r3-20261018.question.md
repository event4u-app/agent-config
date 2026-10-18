<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 3) for branch drain/road-to-a-setup-that-decides-itself-20261018, verbatim below this comment. -->

# Modification review, round 3 — the InstructionsLoaded observer after the round-2 refusal

You are one seat of a modification review of binding the host's asynchronous,
non-blocking `InstructionsLoaded` event to a capture-only observer on the
`claude` platform (owner-scheduled 2026-10-15; kill switch
`AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`, or removing the one manifest
binding and reinstalling). Round 2 agreed that per-session files and an
order-independent record are the right direction, and both seats refused on:
(1) a session id reaching `path.join` unsanitized; (2) prune versus append
able to delete live evidence and exceed the 50-file bound; (3) one failed file
read discarding every record; (4) per-file growth unbounded; (5) concurrency
tests that skip the prune paths; (6) the hook's event-name re-check removed.

What changed in commit `43e68f033` (the hook and the capture module are
shown in full below, then the reader's delta):

1. The hook now only CAPTURES: every string — session id, event name, load
   reason, the host's agent string, launch context, the file's basename — is
   kept only if it matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, so no
   separator and no leading dot can reach a filename; a missing id writes to
   `_.jsonl`. Classification (closed load-reason enum, event-name check,
   `.md` check) runs at read time in a separate module, so the event-name
   check is back, outside the bundle. Test: `../escape`, `..`, `/abs`, `a/b`,
   `.hidden` all land in `_.jsonl` and nothing appears outside the directory.
2. Each session file stops growing at 256 KiB (checked by `statSync` before
   the append). Test included.
3. `readObserverLines` reads each file in its own `try`; a directory entry
   that cannot be read is skipped and the others still count. Test included.
4. Prune keeps the newest 50 by mtime with ties broken by name. Remaining
   race, stated in the hook header rather than claimed away: an idle session
   older than fifty newer ones can have its file pruned; its next load starts
   a new file without the start-up loads, which the record reads as
   `unknown` (no `session_start` load) — the layer-form decision then keeps
   the machine full. Loss in the safe direction, never an invented arrival.
   The count can briefly exceed 50 by the number of such recreations.
5. Live probes through the built bundle: 40 parallel loads of one session →
   40 of 40 lines; 60 parallel NEW sessions → exactly 50 files left.
6. Bundle: 1,549,432 B of 1,550,000 B.

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

Say for each of the six round-2 points whether it is closed.

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
 * WHAT A RACE CAN AND CANNOT DO. Two processes pruning at once both succeed. A
 * prune can delete the file of an idle session that is older than fifty newer
 * ones; if that session later loads a file, it starts a new file without its
 * start-up loads, which the record reads as `unknown` — evidence is lost in the
 * direction that keeps the machine full, never invented. The count can sit one
 * or two above fifty until the next new session prunes again.
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
import { captureInstructionsLoaded } from '../_lib/instructions_loaded_event.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
export const KEEP_SESSIONS = 50;
/** A session file stops growing here, so retention is bounded in bytes as well as in sessions. */
export const MAX_SESSION_BYTES = 256 * 1024;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} session files; ties broken by name. */
function prune(dir: string): void {
    const files = fs
        .readdirSync(dir)
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
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
        let size = -1;
        try {
            size = fs.statSync(file).size;
        } catch {
            // First line of this session.
        }
        if (size > MAX_SESSION_BYTES) return EXIT_ALLOW;
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
        if (size < 0) prune(dir);
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
```

## The reader delta

```diff
commit 43e68f03382d6d42d562c7ecc73e0570e0855d15
Author: matze4u <171579628+matze4u@users.noreply.github.com>
Date:   Sun Oct 18 09:41:37 2026 +0200

    fix(hooks): the observer captures tokens only and caps each session file; reads tolerate a pruned file
    
    Round 2 of the modification review refused on four points; each is closed:
    
    - Session ids, event names, load reasons, the agent string and the file
      basename are kept only as tokens that start alphanumeric and carry no
      separator, so no session id can name a file outside the arrivals
      directory. Five hostile ids land in one placeholder file.
    - Each session file stops growing at 256 KiB, so retention is bounded in
      bytes as well as in sessions; prune ties are broken by name.
    - readObserverLines reads each session file on its own: a file pruned
      between the listing and the read no longer discards every other record.
    - The race a prune can still cause is stated in the hook header: an idle
      session older than fifty newer ones loses its start-up loads, which the
      record reads as unknown - lost toward full, never invented.
    
    Classification moves out of the hook into instructions_loaded_classify.ts,
    run at read time; the bundled half only captures. The bundle is 1,549,432 B
    of 1,550,000. Through the built bundle, 60 parallel new sessions left
    exactly 50 files and 40 parallel loads of one session wrote 40 lines.
    
    Consumer-Impact: automatic
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

diff --git a/src/scripts/_lib/arrival_record.ts b/src/scripts/_lib/arrival_record.ts
index 217381cbc..a1e1be42a 100644
--- a/src/scripts/_lib/arrival_record.ts
+++ b/src/scripts/_lib/arrival_record.ts
@@ -26,7 +26,14 @@ import * as path from 'node:path';
 
 import type { ActivationReceipt } from './activation_ladder.js';
 import type { ArrivalEvidence } from './layer_form_decision.js';
-import { LOAD_REASONS, type LoadReason, type LoadedLine, type ObserverLine } from './instructions_loaded_event.js';
+import type { CaptureLine } from './instructions_loaded_event.js';
+import {
+    LOAD_REASONS,
+    classifyCapture,
+    type LoadReason,
+    type LoadedLine,
+    type ObserverLine,
+} from './instructions_loaded_classify.js';
 
 export type ArrivalUnknownReason =
     | 'event-unavailable'
@@ -57,22 +64,29 @@ export interface ArrivalRecord {
 
 /** Parse every session file under the observer directory; lines that are not observer lines are dropped. */
 export function readObserverLines(dir: string): ObserverLine[] {
-    let text = '';
+    let names: string[] = [];
     try {
-        for (const f of fs.readdirSync(dir)) {
-            if (f.endsWith('.jsonl')) text += `${fs.readFileSync(path.join(dir, f), 'utf8')}\n`;
-        }
+        names = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
     } catch {
         return [];
     }
     const out: ObserverLine[] = [];
-    for (const raw of text.split('\n')) {
-        if (!raw.trim()) continue;
+    for (const f of names) {
+        let text = '';
         try {
-            const o = JSON.parse(raw) as ObserverLine;
-            if (o && o.v === 1 && (o.event === 'loaded' || o.event === 'unknown')) out.push(o);
+            text = fs.readFileSync(path.join(dir, f), 'utf8');
         } catch {
-            // A torn line is skipped; it carries no session to attribute it to.
+            // Pruned between the listing and the read; the other sessions still count.
+            continue;
+        }
+        for (const raw of text.split('\n')) {
+            if (!raw.trim()) continue;
+            try {
+                const o = JSON.parse(raw) as CaptureLine;
+                if (o && o.v === 2) out.push(classifyCapture(o));
+            } catch {
+                // A torn line is skipped; it carries no session to attribute it to.
+            }
         }
     }
     return out;
```
