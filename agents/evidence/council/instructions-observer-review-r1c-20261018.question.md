<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 1, third attempt: the first two timed out on both seats, so the diff is cut to the plumbing files and the concern) for branch drain/road-to-a-setup-that-decides-itself-20261018, verbatim below this comment. -->

# Modification review — binding the host's InstructionsLoaded event to a capture-only observer

You are one seat of a modification review. Review the change itself.

Scope: the gated hook-plumbing diff of branch
`drain/road-to-a-setup-that-decides-itself-20261018` against `origin/main` @
`324a230ad`, reproduced below for the plumbing sources and the concern only; not reproduced: `_lib/instructions_loaded_event.ts`, the pure payload classifier the concern calls, which keeps a file basename, a user/project scope enum and a closed load-reason enum and turns anything else into an `unknown` line (the compiled
`hook_manifest.json` / `host_lowering.json` are regenerated from the YAML by
`compile_hook_manifest`, and `hooks/hooks.json` gains one `InstructionsLoaded`
entry with the same command template every other event already uses). Not
reproduced but in the same change: `src/scripts/_lib/arrival_record.ts` (an
unbundled reader that builds a per-session record from the observer's lines;
any anomaly — no event, malformed payload, duplicate, reorder, mixed host
versions — makes the record `unknown`), `src/scripts/arrival_report.ts`
(report-only CLI), two vocabulary partitions extended by one member, and 20
test cases in `tests/scripts/arrival_record.test.ts`.

Context you need:

- The owner decided on 2026-10-15 to schedule this binding (option (a) of
  blocker `instruction-load-observer-has-no-scheduled-owner`), absorbing step
  3.0 of the stub `road-to-instructions-loaded-observer`, whose council
  disposition required a kill switch: independently removable or disabled,
  rolled back on hook failures, duplicate events, material session-start
  regression, or unexplained test breakage. An earlier council refusal of
  "execute the binding now" rested on it being a shipped-default change; the
  owner's (a) is the decision that answers that ground.
- The host documents `InstructionsLoaded` as: fires when a CLAUDE.md or
  `.claude/rules/*.md` file is loaded, at session start and on lazy loads;
  exit code ignored; no decision control; "It runs asynchronously for
  observability purposes"; input fields `file_path`, `memory_type`,
  `load_reason` (`session_start`, `nested_traversal`, `path_glob_match`,
  `include`, `compact`), `globs`, `trigger_file_path`, `parent_file_path`.
- Measured locally through the built bundle: 89 ms per dispatch, one line
  appended per event; the bundle is 1,549,865 B against a 1,550,000 B ceiling.
- Purpose: the line file is the only producer of the arrival record that a
  pure decision function (`decideLayerForm`, already on main) requires before
  it may ever return `thinned` for a machine's rule layer; today every
  machine reads `full`, and this change does not alter that.

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

Test-count edits in the same change, stated so question 3 can be answered: four
tests pinned the vocabulary or concern count (10 events, 62 concerns, the
claude slot order); each was raised by exactly the one added member. No
assertion was removed or loosened otherwise.

## The diff

```diff
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index d47cf9ee5..1b697cc05 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1337,6 +1337,22 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: telemetry
+  # road-to-a-setup-that-decides-itself step 1.1 — the host instruction-load
+  # observer, absorbing step 3.0 of stubs/road-to-instructions-loaded-observer.md
+  # (owner answer (a), 2026-10-15). CAPTURE ONLY: appends one classified line
+  # per host load event to `<machine root>/runtime/arrivals.jsonl` and emits
+  # nothing to the model, so it carries no hook-token-budget row. Bound on
+  # `claude` alone, the one host where the event was measured present.
+  # KILL SWITCH, required by the council and not optional:
+  # `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`, or delete the one
+  # `instructions_loaded:` binding below — on hook failures, duplicate events,
+  # a session-start regression or an unexplained test break. fail_closed: false.
+  instructions-observer:
+    script: src/scripts/hooks/instructions_observer_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: telemetry
   # road-to-inbox-harvest-2026-08-d-context-ledger Phase 1 Step 1.1 — the
   # tool-result byte counter. `hook-token-budget.json` registers the gap it
   # closes in its own words: bytes-into-context from tool RESULTS are
@@ -1589,6 +1605,8 @@ platforms:
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
     subagent_start:   [subagent-ledger, journal-record]
     subagent_stop:    [subagent-ledger, journal-record]
+    # road-to-a-setup-that-decides-itself step 1.1 — see the concern's entry.
+    instructions_loaded: [instructions-observer]
 
   # Cowork — the Claude desktop app's local-agent-mode runtime, built
   # on top of the Claude Code CLI. Same lifecycle vocabulary, same
@@ -1745,6 +1763,10 @@ native_event_aliases:
     # agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
     SubagentStart:     subagent_start
     SubagentStop:      subagent_stop
+    # Measured present on the installed binary (exact-token count 9, payload
+    # fields load_reason / trigger_file_path / parent_file_path) — see
+    # agents/evidence/investigations/standing-context-40k-host-and-machine-probes.md § 1.
+    InstructionsLoaded: instructions_loaded
   # Cowork shares Claude Code's PascalCase event vocabulary verbatim
   # (Cowork is Claude Code under the hood). Native names are duplicated
   # here rather than aliased so dispatcher logs / feedback carry the
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 5faf7f0e9..1a2861fc8 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -120,6 +120,7 @@ export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "agent_error",
   "subagent_start",
   "subagent_stop",
+  "instructions_loaded",
 ]);
 
 const _SEVERITY_BY_EXIT: Record<number, string> = {
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index 4e0495830..ee3f79833 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -111,6 +111,7 @@ hosts:
           pre_compact:        { native: PreCompact,        block_exit: null, answered_at: 2026-09-29 }
           subagent_start:     { native: SubagentStart,     block_exit: null, answered_at: 2026-09-29 }
           subagent_stop:      { native: SubagentStop,      block_exit: null, answered_at: 2026-09-29 }
+          instructions_loaded: { native: InstructionsLoaded, block_exit: null, answered_at: 2026-10-18 }
 
   augment:
     surfaces:
diff --git a/src/scripts/hooks/instructions_observer_hook.ts b/src/scripts/hooks/instructions_observer_hook.ts
new file mode 100644
index 000000000..14e7bf755
--- /dev/null
+++ b/src/scripts/hooks/instructions_observer_hook.ts
@@ -0,0 +1,75 @@
+#!/usr/bin/env tsx
+/**
+ * `InstructionsLoaded` observer — capture only.
+ *
+ * Appends one classified line per host load event to
+ * `<machine root>/runtime/arrivals.jsonl`, the input of the per-session arrival
+ * record. It emits nothing to the model and returns 0 on every path: an
+ * instrument that can fail a turn is a mechanism, and this is not one.
+ *
+ * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
+ * a reinstall; removing the one `instructions_loaded` binding in
+ * `hook_manifest.yaml` removes it entirely. Either is the response to hook
+ * failures, duplicate events, a session-start regression or an unexplained
+ * test break.
+ *
+ * Machine-level, not per project: the installed rule layer it observes belongs
+ * to the machine. The file is rotated once at {@link MAX_BYTES} so it cannot
+ * grow without bound.
+ */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { event4u_root } from '../_lib/user_global_paths.js';
+import { classifyInstructionsLoaded } from '../_lib/instructions_loaded_event.js';
+import { is_replay_mode } from './state_io.js';
+import { readHookStdin } from './hook_stdin.js';
+import { EXIT_ALLOW } from './exit_codes.js';
+
+export const ARRIVALS_FILE = path.join('runtime', 'arrivals.jsonl');
+export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
+export const MAX_BYTES = 512 * 1024;
+
+export function arrivalsPath(env: NodeJS.ProcessEnv = process.env): string {
+    return path.join(event4u_root(env), ARRIVALS_FILE);
+}
+
+export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
+    try {
+        if (env[KILL_SWITCH_ENV] === 'off') return EXIT_ALLOW;
+        if (is_replay_mode()) return EXIT_ALLOW;
+        let parsed: unknown = null;
+        try {
+            parsed = raw.trim() ? JSON.parse(raw) : null;
+        } catch {
+            parsed = null;
+        }
+        const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
+        if (envelope !== null && envelope['event'] !== undefined && envelope['event'] !== 'instructions_loaded') {
+            return EXIT_ALLOW;
+        }
+        const inner = envelope?.['payload'];
+        const payload = typeof inner === 'object' && inner !== null ? inner : envelope;
+        const line = classifyInstructionsLoaded(payload, {
+            ts: new Date().toISOString(),
+            home: env['HOME'] ?? os.homedir(),
+            env,
+        });
+        const file = arrivalsPath(env);
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        try {
+            if (fs.statSync(file).size >= MAX_BYTES) fs.renameSync(file, `${file}.1`);
+        } catch {
+            // No file yet.
+        }
+        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
+    } catch {
+        // An unwritable disk loses one line; it never fails the session.
+    }
+    return EXIT_ALLOW;
+}
+
+export function main(): number {
+    return processEnvelope(readHookStdin());
+}
```
