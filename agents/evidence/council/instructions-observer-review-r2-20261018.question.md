<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 2) for branch drain/road-to-a-setup-that-decides-itself-20261018, verbatim below this comment. -->

# Modification review, round 2 — the InstructionsLoaded observer after the round-1 refusal

You are one seat of a modification review. Round 1 reviewed binding the host's
`InstructionsLoaded` event (asynchronous, no decision control, exit code
ignored) to a capture-only observer `instructions-observer` on the `claude`
platform, with kill switch `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` or removal
of the one manifest binding. The owner scheduled this binding on 2026-10-15.

Round-1 stances:

- anthropic: `confirmed-non-expanding`, med. Asked for the collection to be
  disclosed (what is recorded, that it is local), flagged the 135 B bundle
  headroom.
- openai: `refused`, high, dealbreaker. Because the host runs the hooks
  asynchronously, append order is scheduler order, and the reader's rule
  "reordered events → unknown" would turn valid sessions into unknowns;
  `statSync → renameSync → appendFileSync` rotation of one shared file was
  racy across processes and could lose evidence. Asked for a serialized or
  atomic writer plus concurrency and rotation tests.

What changed (commit `3847b4ae2`, diff below):

1. One file per session: `<machine root>/runtime/arrivals/<session>.jsonl`.
   No shared rotation; growth is bounded by deleting all but the newest 50
   session files when a new session's first line is written. Two processes
   pruning at once both succeed (`rmSync` with `force`). Single-line
   `appendFileSync` (O_APPEND) per event.
2. The record is a set: a shuffled sequence yields the in-order record; the
   only order-adjacent anomaly left is "no `session_start` load at all" →
   `unknown`. Duplicate calls, malformed payloads, mixed host versions and no
   events stay `unknown`.
3. Tests: prune keeps exactly 50 including the new session; reorder fixture
   asserts equality with the in-order record. Live probe: 40 parallel
   dispatches through the built bundle for one session wrote 40 of 40 lines
   with 40 distinct files and a `visible` record.
4. Disclosure: the hook contract's Event row now states what is kept (file
   basename, user/project scope, load reason, host version), that no path or
   file content is kept, the 50-session bound, and that nothing is sent.
5. Bundle: 1,549,923 B of 1,550,000 (77 B headroom); the observer dropped an
   envelope-event re-check (it is bound to one event, and a foreign payload
   still classifies as an `unknown` line).

Not changed, stated so you can judge it: no `lstat`/`O_NOFOLLOW` on the
session file — a same-user attacker who can plant a symlink under the user's
own `~/.event4u` already controls that user's files.

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

Question 3 applies to this round's own edit too: the round-1 reorder fixture
asserted `unknown`; it now asserts equality with the in-order record, because
that expectation is what the host's asynchronous delivery makes correct. Judge
whether that is a justified correction or a fixture fitted to the code.

## The diff

```diff
commit 3847b4ae2c5026c649b0642690259af374703726
Author: matze4u <171579628+matze4u@users.noreply.github.com>
Date:   Sun Oct 18 09:30:10 2026 +0200

    fix(hooks): one arrivals file per session, and the record no longer reads order
    
    The host runs InstructionsLoaded hooks asynchronously and in parallel, so
    the order lines reach disk is the scheduler's. Two consequences, both found
    by the council's openai seat in the modification review:
    
    - A shared, size-rotated arrivals.jsonl let two processes each rename the
      other's fresh data away. Lines now go to runtime/arrivals/<session>.jsonl;
      growth is bounded by deleting all but the newest 50 session files, which
      is safe when two processes prune at once. 40 parallel dispatches through
      the built bundle wrote 40 of 40 lines.
    - The record treated reordering as unknown, which would have turned most
      real sessions into unknowns. It is now a set per session: a shuffled
      sequence yields the in-order record, and only lost start-up events
      (no session_start load) make it unknown.
    
    The observer no longer re-checks the envelope's event name; it is bound to
    one event and a foreign payload still classifies as an unknown line.
    
    Consumer-Impact: automatic
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

diff --git a/src/scripts/_lib/arrival_record.ts b/src/scripts/_lib/arrival_record.ts
index 44f8205c5..217381cbc 100644
--- a/src/scripts/_lib/arrival_record.ts
+++ b/src/scripts/_lib/arrival_record.ts
@@ -12,9 +12,14 @@
  *   · no line for the session — the host did not send the event;
  *   · a line the observer could not classify — a malformed payload;
  *   · the same file loaded twice for the same reason — a duplicate call;
- *   · a `session_start` load after a later-reason load, or no `session_start`
- *     load at all — events reordered or lost;
+ *   · no `session_start` load at all — the start-up events were lost;
  *   · more than one host version within one session.
+ *
+ * ORDER IS NOT EVIDENCE, IN EITHER DIRECTION. The host runs these hooks
+ * asynchronously and in parallel, so the order lines reach disk is the
+ * scheduler's, not the host's. The record is therefore built as a set: a
+ * reordered sequence yields exactly the record the ordered one does, and no
+ * ordering can create an arrival the set does not contain.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
@@ -27,7 +32,7 @@ export type ArrivalUnknownReason =
     | 'event-unavailable'
     | 'malformed'
     | 'duplicate-events'
-    | 'reordered'
+    | 'no-session-start'
     | 'host-version-mixed';
 
 export interface ArrivalFile {
@@ -50,11 +55,13 @@ export interface ArrivalRecord {
     readonly counts: { readonly loaded: number; readonly unknown: number; readonly duplicates: number };
 }
 
-/** Parse the observer file; lines that are not observer lines are dropped. */
-export function readObserverLines(file: string): ObserverLine[] {
+/** Parse every session file under the observer directory; lines that are not observer lines are dropped. */
+export function readObserverLines(dir: string): ObserverLine[] {
     let text = '';
     try {
-        text = fs.readFileSync(file, 'utf8');
+        for (const f of fs.readdirSync(dir)) {
+            if (f.endsWith('.jsonl')) text += `${fs.readFileSync(path.join(dir, f), 'utf8')}\n`;
+        }
     } catch {
         return [];
     }
@@ -94,11 +101,7 @@ export function buildArrivalRecord(lines: readonly ObserverLine[], session: stri
     else if (unknownCount > 0) reason = 'malformed';
     else if (duplicates > 0) reason = 'duplicate-events';
     else if (versions.size > 1) reason = 'host-version-mixed';
-    else {
-        const firstLater = loaded.findIndex((l) => l.reason !== 'session_start');
-        const lastStart = loaded.map((l) => l.reason).lastIndexOf('session_start');
-        if (lastStart === -1 || (firstLater !== -1 && lastStart > firstLater)) reason = 'reordered';
-    }
+    else if (!loaded.some((l) => l.reason === 'session_start')) reason = 'no-session-start';
     return {
         v: 1,
         session,
@@ -195,6 +198,6 @@ export function arrivalReceipts(record: ArrivalRecord, expected: readonly string
     }));
 }
 
-export function arrivalsFileUnder(runtimeRoot: string): string {
-    return path.join(runtimeRoot, 'arrivals.jsonl');
+export function arrivalsDirUnder(runtimeRoot: string): string {
+    return path.join(runtimeRoot, 'arrivals');
 }
diff --git a/src/scripts/hooks/instructions_observer_hook.ts b/src/scripts/hooks/instructions_observer_hook.ts
index 14e7bf755..18330ff2c 100644
--- a/src/scripts/hooks/instructions_observer_hook.ts
+++ b/src/scripts/hooks/instructions_observer_hook.ts
@@ -3,19 +3,24 @@
  * `InstructionsLoaded` observer — capture only.
  *
  * Appends one classified line per host load event to
- * `<machine root>/runtime/arrivals.jsonl`, the input of the per-session arrival
- * record. It emits nothing to the model and returns 0 on every path: an
- * instrument that can fail a turn is a mechanism, and this is not one.
+ * `<machine root>/runtime/arrivals/<session>.jsonl`, the input of that
+ * session's arrival record. It emits nothing to the model and returns 0 on
+ * every path: an instrument that can fail a turn is a mechanism, and this is not
+ * one. Lines carry a file basename, two enums and the host version — never a
+ * path or a file's contents — and never leave the machine.
+ *
+ * ONE FILE PER SESSION, BECAUSE THE HOST RUNS THIS EVENT ASYNCHRONOUSLY. A
+ * session start fires one event per loaded file and the hooks run in parallel,
+ * so append order is scheduler order and the reader treats each session as a
+ * set. Bounding growth by deleting whole old session files needs no lock: two
+ * processes pruning the same file both succeed, where two rotating one shared
+ * file could each rename the other's fresh data away.
  *
  * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
  * a reinstall; removing the one `instructions_loaded` binding in
- * `hook_manifest.yaml` removes it entirely. Either is the response to hook
- * failures, duplicate events, a session-start regression or an unexplained
- * test break.
- *
- * Machine-level, not per project: the installed rule layer it observes belongs
- * to the machine. The file is rotated once at {@link MAX_BYTES} so it cannot
- * grow without bound.
+ * `hook_manifest.yaml` and reinstalling removes it entirely. Either is the
+ * response to hook failures, duplicate events, a session-start regression or an
+ * unexplained test break.
  */
 import * as fs from 'node:fs';
 import * as os from 'node:os';
@@ -27,45 +32,48 @@ import { is_replay_mode } from './state_io.js';
 import { readHookStdin } from './hook_stdin.js';
 import { EXIT_ALLOW } from './exit_codes.js';
 
-export const ARRIVALS_FILE = path.join('runtime', 'arrivals.jsonl');
 export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
-export const MAX_BYTES = 512 * 1024;
+export const KEEP_SESSIONS = 50;
+
+export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
+    return path.join(event4u_root(env), 'runtime', 'arrivals');
+}
 
-export function arrivalsPath(env: NodeJS.ProcessEnv = process.env): string {
-    return path.join(event4u_root(env), ARRIVALS_FILE);
+/** Delete all but the newest {@link KEEP_SESSIONS} session files. */
+function prune(dir: string): void {
+    const files = fs
+        .readdirSync(dir)
+        .filter((f) => f.endsWith('.jsonl'))
+        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
+        .sort((a, b) => b.t - a.t);
+    for (const { f } of files.slice(KEEP_SESSIONS)) fs.rmSync(path.join(dir, f), { force: true });
 }
 
 export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
     try {
-        if (env[KILL_SWITCH_ENV] === 'off') return EXIT_ALLOW;
-        if (is_replay_mode()) return EXIT_ALLOW;
+        if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
         let parsed: unknown = null;
         try {
             parsed = raw.trim() ? JSON.parse(raw) : null;
         } catch {
             parsed = null;
         }
+        // Bound to `instructions_loaded` alone, so the envelope's event is not re-checked here.
         const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
-        if (envelope !== null && envelope['event'] !== undefined && envelope['event'] !== 'instructions_loaded') {
-            return EXIT_ALLOW;
-        }
         const inner = envelope?.['payload'];
-        const payload = typeof inner === 'object' && inner !== null ? inner : envelope;
-        const line = classifyInstructionsLoaded(payload, {
+        const line = classifyInstructionsLoaded(typeof inner === 'object' && inner !== null ? inner : envelope, {
             ts: new Date().toISOString(),
             home: env['HOME'] ?? os.homedir(),
             env,
         });
-        const file = arrivalsPath(env);
-        fs.mkdirSync(path.dirname(file), { recursive: true });
-        try {
-            if (fs.statSync(file).size >= MAX_BYTES) fs.renameSync(file, `${file}.1`);
-        } catch {
-            // No file yet.
-        }
+        const dir = arrivalsDir(env);
+        const file = path.join(dir, `${line.session ?? '_no-session'}.jsonl`);
+        const fresh = !fs.existsSync(file);
+        fs.mkdirSync(dir, { recursive: true });
         fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
+        if (fresh) prune(dir);
     } catch {
-        // An unwritable disk loses one line; it never fails the session.
+        // An unwritable disk, or a file a parallel prune removed, loses one line; it never fails the session.
     }
     return EXIT_ALLOW;
 }
```
