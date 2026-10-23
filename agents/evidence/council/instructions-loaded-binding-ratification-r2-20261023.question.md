<!-- evidence-type: analysis -->

# Ratification review, round 2 — binding the InstructionsLoaded observer (road-to-a-setup-that-decides-itself step 1.1)

You are an independent reviewer for a change in the `event4u/agent-config` repository. It edits files on the ratification gate's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`, `src/config/hook-bundle-budget.json`, `src/config/hook-token-budget.json`), so it needs a two-provider verdict under ADR-268 § 4.

## What the change does

Adds `instructions_loaded` to the dispatcher's event vocabulary and its three mirrors, aliases the host's native `InstructionsLoaded` to it on `claude` only, and binds the existing observe-only concern `instructions-observer` to it (one classified line per loaded instruction file under `<machine root>/runtime/arrivals/`, exit 0 on every path, kill switch `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`). The concern loads from its own chunk via `LAZY_CONCERNS`, with a spawn fallback. The dispatch bundle ceiling is raised 1,550,000 → 1,550,500 with a `raise_log` entry: the binding adds 237 bytes against 51 of headroom; the measured room-making alternative (moving `session-eol` into a chunk) frees 29,948 bytes but produces a 259,330-byte chunk loaded on every `stop`. Generated `hooks/hooks.json` and `hook_manifest.json` are omitted below.

## Round 1 (both seats refused) and what changed since

Both seats found the binding and the raise sound in substance and refused on evidence. Each point and its disposition:

1. `max_bytes_derivation` still described 1,550,000 → a sentence now records the raise and points to the `raise_log` entry.
2. The chunk entry said it "leaves `max_bytes` untouched" → rewritten: the body ships in the chunk; the 237-byte binding is the recorded raise.
3. The observer header said it "adds nothing" to the bundle → rewritten to name the 237 bytes.
4. No test of the built path → `tests/scripts/hooks/instructions_observer_binding.test.ts` now builds `dispatch.js` and the chunk fresh into a temporary install and runs the built dispatcher: (a) chunk present, observer source absent → one capture line (so the chunk answered, since the spawn path had nothing to run); (b) neither present → no line (control); (c) chunk absent, source present → one line via the spawn fallback.
5. Writing test (c) exposed a real defect: the observer had no CLI entry, so the spawn fallback ran it as a script and it silently did nothing. Test (c) was red; the file now carries the same `_isCliEntry` guard as its sibling hooks (never fires inside a bundle or chunk), and (c) is green. The chunk grew to 11,097 bytes; its ceiling stays 12,000.
6. Why `instructions_loaded` is in `RECORDED_EVENTS` without a `journal-record` binding → stated in `runtime_journal.ts`: "recorded" means the journal accepts it when `journal-record` runs, not that the manifest binds it.

Verification run on this revision: 86 affected test files, 1,486 tests passed; `tsc` clean; eslint clean on changed files; the bundle composition gate reads 1,550,186 B / 1,550,500 B and every chunk under its ceiling.

## What to answer

1. Does the diff contain a defect — binding, lazy path, entry guard, vocabularies, tests, budget records? Name file and line for each.
2. Are the round-1 points resolved?
3. Does the change expand any agent's authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff` against the branch base `eaa32c0865`, generated files excluded)

```diff
diff --git a/docs/contracts/hook-architecture-v1.md b/docs/contracts/hook-architecture-v1.md
index e19c66ad0b..de4417e085 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -57,7 +57,7 @@ zero times.
 |---|---|
 | **Platform** | Host agent surface — one of `augment`, `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`. The `claude` value covers both Claude Code (CLI) and Claude.ai Web; `cowork` covers the Claude desktop app's local-agent-mode runtime separately so chat-history entries can attribute events to Cowork vs CLI Claude Code via the `agent` field. Cowork shares Claude Code's lifecycle vocabulary and payload shape but is upstream-blocked from reading any settings source as of writing (anthropics/claude-code#40495, #27398). The canonical platform identifier is `claude` for the CLI/IDE surface and `cowork` for the desktop sandbox (both match `chat_history.PLATFORM_EVENT_MAP`). |
 | **Concern** | A single agent-config behaviour wired to one or more lifecycle events — e.g. `chat-history`, `roadmap-progress`, `verify-before-complete`. Lives as a Python script under `scripts/hooks/concerns/<name>.py`. |
-| **Event** | The agent-config-internal event vocabulary the dispatcher exposes — `session_start`, `session_end`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`, `stop`, `pre_compact`, `agent_error`, `subagent_start`, `subagent_stop`. Per-platform native names map to these. `agent_error` is synthetic — fired by the agent (or wrapper) when the host crashes outside a concern, so chat-history can checkpoint partial sessions on abnormal exit. (Added in Round 2 — 2026-05-04.) `subagent_start` / `subagent_stop` bracket **one subagent dispatch**, not one session — the only pair in this vocabulary whose scope is narrower than a session. They are aliased on `claude` and `cowork` only; a platform that never sends them has no alias row, which is how the table expresses absence rather than a per-platform flag. (Added 2026-08-13 — `road-to-subagent-lifecycle-integrity` Phase 1.) |
+| **Event** | The agent-config-internal event vocabulary the dispatcher exposes — `session_start`, `session_end`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`, `stop`, `pre_compact`, `agent_error`, `subagent_start`, `subagent_stop`, `instructions_loaded`. Per-platform native names map to these. `agent_error` is synthetic — fired by the agent (or wrapper) when the host crashes outside a concern, so chat-history can checkpoint partial sessions on abnormal exit. (Added in Round 2 — 2026-05-04.) `subagent_start` / `subagent_stop` bracket **one subagent dispatch**, not one session — the only pair in this vocabulary whose scope is narrower than a session. They are aliased on `claude` and `cowork` only; a platform that never sends them has no alias row, which is how the table expresses absence rather than a per-platform flag. (Added 2026-08-13 — `road-to-subagent-lifecycle-integrity` Phase 1.) `instructions_loaded` fires once per instruction file the host loads, asynchronously; aliased on `claude` only, observe-only. (Added 2026-10-23 — `road-to-a-setup-that-decides-itself` step 1.1.) |
 | **Trampoline** | A 5–10 line per-platform shell script that reads the platform's native payload, calls the dispatcher with `--platform <name>`, and forwards the platform's exit-code semantics. |
 | **Dispatcher** | `src/scripts/hooks/dispatch_hook.ts` — single Python entrypoint that reads the manifest, resolves which concerns fire on `(platform, event)`, runs each one with the contract envelope below, and reduces their exit codes. |
 
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 11d0914137..34cfb1b43c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,8 +4,8 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1550000,
-    "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it.",
+    "max_bytes": 1550500,
+    "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the last `raise_log` entry, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
     "raise_log": [
@@ -27,6 +27,15 @@
             "what_was_added": "The queued engine work the 28,000 ceiling was sized for, landed together: the validated identifier rows of one-detector 2.3 (IBAN, card, e-mail with a keyed-digest allowlist, three phone shapes, German tax id, US SSN), and three free-tier credential rows (Hugging Face, NVIDIA, Replicate) of free-hands 1.2. The invisible-character normalisation of one-detector 2.5 (`egress_normalize.ts`) is not in this chunk: the engine does not import it (corrected 2026-10-23, road-to-a-tick-the-shipped-path-earns 1.4). Measured 30,445 bytes when the raise landed; 30,493 bytes at the ratified revision, after the round-6 IBAN rows.",
             "why_it_could_not_be_avoided": "Each addition is an identifier or credential detection row; the 2026-10-18 derivation already counted them as the chunk's planned growth and underestimated their sum by about 2.4 KB. The chunk is loaded only when a caller needs detection, so no dispatch pays these bytes; the dispatch bundle itself is unchanged.",
             "what_would_have_caught_it": "Re-measuring the queued items' sum when the ceiling was set, rather than estimating each."
+        },
+        {
+            "date": "2026-10-23",
+            "from": 1550000,
+            "to": 1550500,
+            "by": "agent, feat/instructions-loaded-binding (road-to-a-setup-that-decides-itself 1.1)",
+            "what_was_added": "The `InstructionsLoaded` binding: one `LAZY_CONCERNS` row for the observer (its 11,097-byte body ships in its own chunk, never in this bundle) and the event name in the three vocabularies the bundle carries (dispatcher, collector, journal). Measured 1,550,186 bytes with the binding by the gate; the same esbuild invocation on the base and on this branch differs by 237 bytes, so the base sat at 1,549,949 — 51 bytes of headroom.",
+            "why_it_could_not_be_avoided": "D8 (council, 2026-10-18) asked for room before a raise. Room was tried and measured: moving `session-eol` (27,708 B in-bundle, `stop` alone) into a chunk freed 29,948 B (same esbuild invocation, with and without the move) but produced a 259,330-byte chunk (`yaml` external) required on every `stop` — about 8.5 times the bytes that event parses today, to buy 186. The observer itself was already moved out. What remains in the bundle is the row and three event-name strings, which no chunk can carry.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat 51 bytes under the ceiling, so any new event in the vocabulary would have tripped it. Sized to this binding plus about 300 bytes; step 3.3's promotion is sized when it is built."
         }
     ],
     "chunks": [
@@ -47,6 +56,12 @@
             "max_bytes": 232000,
             "registered_at": "2026-10-20",
             "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 \u2014 a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow.\n\nWHY IT WAS MOVED \u2014 AND THE REASON FIRST GIVEN WAS FALSE, which is recorded here rather than corrected silently. This entry said `chat-history` is bound on `session_start` and on no other event, and called it the largest narrow-event module the metafile ranks. An independent provider review of 2026-10-20 checked the manifest and refused the change on it: `chat-history` is bound on FIVE events \u2014 `session_start`, `session_end`, `stop`, `post_tool_use` and `user_prompt_submit` \u2014 across seven hosts. It is close to the widest-bound concern in the tree, not the narrowest. The claim came from reading the `session_start:` rows of the manifest and never the others.\n\nWHAT SURVIVES THE CORRECTION, stated as narrowly as the evidence allows: the move takes 120,586 bytes out of a bundle every hook event parses (1,549,961 -> 1,429,414 B) and pays for them with one `require` of a 209,890-byte CJS file on the events that actually need the concern. Whether that is a latency WIN is UNMEASURED, and the 2026-10-18 council that chose this mechanism asked for exactly that proof inside `src/config/hook-latency-budget.json`. Until it exists this chunk is a byte-budget move with an unproven wall-clock effect, and the honest narrow-event candidates the same metafile ranks are recorded for whoever re-does it: `turn-end-gate` 71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone, `skill-route` 31,183 B and `git-authorization` 30,761 B on `user_prompt_submit` alone, `session-eol` 27,708 B on `stop` alone, `handoff-context` 25,220 B on `session_start` alone.\n\nUNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect \u2014 which the same review confirmed, noting it holds because `src/scripts/` ships in the package."
+        },
+        {
+            "entry": "src/scripts/hooks/instructions_observer_hook.ts",
+            "max_bytes": 12000,
+            "registered_at": "2026-10-23",
+            "derivation": "Measured 11,097 bytes on 2026-10-23 (the observe-only `InstructionsLoaded` capture, its classifier, and the CLI entry the spawn fallback needs). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `instructions_loaded` alone, so a chunk keeps it off every other dispatch's parse; the observer body ships here, never in the dispatch bundle. The binding that reaches it (one registry row and the event name in three vocabularies, 237 bytes) does sit in the bundle and is the 2026-10-23 raise of `max_bytes` recorded in `raise_log`. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the capture."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 91a65edbbf..6f4103b105 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -44,7 +44,7 @@
   "_comment": "Cross-concern per-fire sum per slot (roadmap 3.1). session_start is one-time and may carry the restore payloads; per-turn slots stay tight.",
   "session_start": 16384,
   "user_prompt_submit": 16384,
-  "user_prompt_submit_reason": "RAISED 4096 -> 16384 on 2026-09-07 by road-to-delivery-for-every-host 3.2, under owner ruling E2, which assigns this move to the run that flips `lean_projection.mode: delivery` and is the activation charge the `rule-inject` row below defers to it. THE NUMBER IS MEASURED, NOT CHOSEN: 16,384 is the p90 gate-open fire size of the delivery concern over the frozen `tests/eval/routing-matrix` corpus rounded UP to 512 bytes, exactly as E2 specifies. Distribution over 318 gate-open fires: p50 6,674 B, p90 16,188 B, max 20,406 B. Reproduce it from `_lib/rule_injection.ts::matchTierRules` + `selectForInjection` at `hooks/rule_inject_hook.ts::CAP_BYTES` over that corpus. NOT config weakening, and the guard agrees by its own classification: `hooks/block_config_weakening.ts:96-98` classifies `*-budget.json` as `advisory`, so its decide() path returns `warn` and never a block — treat that warning as expected and documented. `pre_tool_use` is deliberately NOT raised alongside it: the concern's binding on that slot was REMOVED in the same change, so nothing new emits there and its 2,048 stands.",
+  "user_prompt_submit_reason": "RAISED 4096 -> 16384 on 2026-09-07 by road-to-delivery-for-every-host 3.2, under owner ruling E2, which assigns this move to the run that flipped the rule layer to its delivery form (then a settings key, removed by road-to-a-setup-that-decides-itself 4.4) and is the activation charge the `rule-inject` row below defers to it. THE NUMBER IS MEASURED, NOT CHOSEN: 16,384 is the p90 gate-open fire size of the delivery concern over the frozen `tests/eval/routing-matrix` corpus rounded UP to 512 bytes, exactly as E2 specifies. Distribution over 318 gate-open fires: p50 6,674 B, p90 16,188 B, max 20,406 B. Reproduce it from `_lib/rule_injection.ts::matchTierRules` + `selectForInjection` at `hooks/rule_inject_hook.ts::CAP_BYTES` over that corpus. NOT config weakening, and the guard agrees by its own classification: `hooks/block_config_weakening.ts:96-98` classifies `*-budget.json` as `advisory`, so its decide() path returns `warn` and never a block — treat that warning as expected and documented. `pre_tool_use` is deliberately NOT raised alongside it: the concern's binding on that slot was REMOVED in the same change, so nothing new emits there and its 2,048 stands.",
   "pre_tool_use": 2048,
   "post_tool_use": 2048,
   "stop": 2048,
diff --git a/src/scripts/_lib/collector_record.ts b/src/scripts/_lib/collector_record.ts
index 14df0f54c8..2469f9ce00 100644
--- a/src/scripts/_lib/collector_record.ts
+++ b/src/scripts/_lib/collector_record.ts
@@ -49,6 +49,7 @@ export const COLLECTOR_EVENTS = [
     'agent_error',
     'subagent_start',
     'subagent_stop',
+    'instructions_loaded',
 ] as const;
 export type CollectorEvent = (typeof COLLECTOR_EVENTS)[number];
 
diff --git a/src/scripts/_lib/runtime_journal.ts b/src/scripts/_lib/runtime_journal.ts
index 62c5d563d1..fc86bcfe67 100644
--- a/src/scripts/_lib/runtime_journal.ts
+++ b/src/scripts/_lib/runtime_journal.ts
@@ -250,16 +250,23 @@ export const RECORDED_EVENTS: ReadonlySet<string> = new Set([
     'agent_error',
     'subagent_start',
     'subagent_stop',
+    'instructions_loaded',
 ]);
 
 /**
  * Members deliberately NOT recorded, each with the reason — silence about an
  * event is not coverage.
  *
- * **Currently empty, and the emptiness is the finding.** All ten members of the
- * vocabulary are recordable: the journal stores what the dispatcher hands it
+ * "Recorded" means the journal accepts the event when `journal-record` runs on
+ * it, not that the manifest binds it there. `instructions_loaded` is the case in
+ * point: it is recordable, and the manifest binds only its own observer to it,
+ * because the host fires it once per loaded file and that capture lives under
+ * `runtime/arrivals/`.
+ *
+ * **Currently empty, and the emptiness is the finding.** All eleven members of
+ * the vocabulary are recordable: the journal stores what the dispatcher hands it
  * and has no per-event exclusion. The value of the partition is therefore not
- * what it excludes today but that an eleventh member cannot arrive without a
+ * what it excludes today but that a twelfth member cannot arrive without a
  * decision — the coverage test fails until it is placed in one set or the
  * other, with a reason if it lands here.
  */
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 6654a12246..004d173f4c 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -38,6 +38,13 @@ export const HOOK_CHUNKS = Object.freeze([
         outfile: 'dist/hooks/chat_history.chunk.cjs',
         external: Object.freeze(['yaml']),
     }),
+    // Bound on `instructions_loaded` alone, which the host fires once per
+    // loaded file — a chunk keeps that one narrow event off every other
+    // dispatch's parse.
+    Object.freeze({
+        entry: 'src/scripts/hooks/instructions_observer_hook.ts',
+        outfile: 'dist/hooks/instructions_observer.chunk.cjs',
+    }),
 ]);
 
 /**
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 3c3dd42dfa..1d2fe47710 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1364,6 +1364,19 @@ concerns:
   #
   # Never blocks, never warns: exit 0 on every path including a malformed
   # payload or an unwritable disk. fail_closed: false.
+  # road-to-a-setup-that-decides-itself step 1.1 — the instructions-loaded
+  # observer. CAPTURE ONLY: one classified line per loaded file into
+  # `<machine root>/runtime/arrivals/<session>.jsonl`, the input of the arrival
+  # record the computed layer form reads. Emits nothing to the model; exit 0 on
+  # every path. Loaded from its own conditional chunk, never inlined.
+  # Kill switch: `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`, or remove the
+  # `instructions_loaded` row under `platforms.claude` and reinstall.
+  instructions-observer:
+    script: src/scripts/hooks/instructions_observer_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: telemetry
   subagent-ledger:
     script: src/scripts/hooks/subagent_ledger_hook.ts
     args: []
@@ -1640,6 +1653,8 @@ platforms:
     subagent_start:   [subagent-ledger, journal-record]
     subagent_stop:    [subagent-ledger, journal-record]
     agent_error:      [host-rate-marker]
+    # Observe-only; the host runs this event asynchronously, once per loaded file.
+    instructions_loaded: [instructions-observer]
 
   # Cowork — the Claude desktop app's local-agent-mode runtime, built
   # on top of the Claude Code CLI. Same lifecycle vocabulary, same
@@ -1796,6 +1811,9 @@ native_event_aliases:
     # agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
     SubagentStart:     subagent_start
     SubagentStop:      subagent_stop
+    # Present on the installed binary (exact-token count 9):
+    # agents/evidence/investigations/standing-context-40k-host-and-machine-probes.md § 1.
+    InstructionsLoaded: instructions_loaded
     # StopFailure fires on an API failure and carries its class in `error`
     # (observed on 2.1.308 with `server_error`; `rate_limit` is the host's
     # documented value for the plan limit and has not been observed live, so a
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 805f0478ed..482ae4a34d 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -109,6 +109,10 @@ const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml
 // spike — see agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
 // Only `claude` and `cowork` alias them today; every other platform simply
 // never sends them, which the alias table already expresses by omission.
+//
+// `instructions_loaded` (road-to-a-setup-that-decides-itself step 1.1) fires
+// once per instruction file the host loads, asynchronously. Only `claude`
+// aliases it; its one concern is the observe-only arrival capture.
 export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "session_start",
   "session_end",
@@ -120,6 +124,7 @@ export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "agent_error",
   "subagent_start",
   "subagent_stop",
+  "instructions_loaded",
 ]);
 
 const _SEVERITY_BY_EXIT: Record<number, string> = {
diff --git a/src/scripts/hooks/instructions_observer_hook.ts b/src/scripts/hooks/instructions_observer_hook.ts
index 1028c60fdb..105ba82f91 100644
--- a/src/scripts/hooks/instructions_observer_hook.ts
+++ b/src/scripts/hooks/instructions_observer_hook.ts
@@ -46,19 +46,20 @@
  * the observer has written since. A failure that also prevents writing the mark
  * — the machine root itself unwritable — leaves none.
  *
- * NOT YET BOUND. No manifest row runs this concern, and it is not in the
- * dispatcher's concern registry, so it adds nothing to the hook bundle until
- * its binding lands; the binding needs bundle headroom it does not have today.
+ * BOUND ON `claude` ALONE, FROM ITS OWN CHUNK. The manifest runs it on
+ * `instructions_loaded`; the dispatcher loads it through `LAZY_CONCERNS`, so its
+ * body is not inlined into the dispatch bundle. The binding itself is: one
+ * registry row and the event name, 237 bytes (`hook-bundle-budget.json`).
  *
  * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
- * a reinstall; once the binding above lands, removing that one
- * `instructions_loaded` row from `hook_manifest.yaml` and reinstalling removes
- * it entirely. Either is the
+ * a reinstall; removing the one `instructions_loaded` row from
+ * `hook_manifest.yaml` and reinstalling removes it entirely. Either is the
  * response to hook failures, duplicate events, a session-start regression or an
  * unexplained test break.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { event4u_root } from '../_lib/user_global_paths.js';
 import { captureInstructionsLoaded, isSessionFile } from '../_lib/instructions_loaded_event.js';
@@ -168,3 +169,21 @@ export function main(): number {
         return EXIT_ALLOW;
     }
 }
+
+// The spawn fallback runs this file as a script, so it needs an entry; inside a
+// bundle or chunk every module shares one `import.meta.url`, so it must never fire there.
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function _isCliEntry(): boolean {
+    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
+        return false;
+    }
+    if (process.argv[1] === undefined) return false;
+    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
+    if (import.meta.url === argvUrl) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+if (_isCliEntry()) process.exit(main());
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 84f543bb27..9ac67e777c 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -68,6 +68,10 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
             chunk: 'chat_history.chunk.cjs',
             source: path.join('..', 'chat_history'),
         }),
+        'src/scripts/hooks/instructions_observer_hook.ts': Object.freeze({
+            chunk: 'instructions_observer.chunk.cjs',
+            source: 'instructions_observer_hook',
+        }),
     });
 
 declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index e6b8940f2c..db1857b9b3 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -93,6 +93,7 @@ const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "agent_error",
   "subagent_start",
   "subagent_stop",
+  "instructions_loaded",
 ]);
 
 // Known platform identifiers.
diff --git a/tests/scripts/collector_record.test.ts b/tests/scripts/collector_record.test.ts
index bdc55e92fa..ff746b2b98 100644
--- a/tests/scripts/collector_record.test.ts
+++ b/tests/scripts/collector_record.test.ts
@@ -194,7 +194,7 @@ describe('collector_record — closed enums carry no payload', () => {
     });
 
     it('the three enums are non-empty and closed', () => {
-        expect(COLLECTOR_EVENTS.length).toBe(10);
+        expect(COLLECTOR_EVENTS.length).toBe(11);
         expect(COLLECTOR_OUTCOMES.length).toBe(3);
         expect(COLLECTOR_PLATFORMS.length).toBeGreaterThan(0);
     });
diff --git a/tests/scripts/hooks/instructions_observer_binding.test.ts b/tests/scripts/hooks/instructions_observer_binding.test.ts
new file mode 100644
index 0000000000..6928824bc4
--- /dev/null
+++ b/tests/scripts/hooks/instructions_observer_binding.test.ts
@@ -0,0 +1,249 @@
+/**
+ * The `InstructionsLoaded` binding (road-to-a-setup-that-decides-itself 1.1).
+ *
+ * The observer existed before this binding and was unit-tested on its own; what
+ * these cases hold is the WIRING: the manifest runs it on `claude` alone, the
+ * dispatcher reaches it from its own chunk rather than the bundle, and a real
+ * dispatch of the native event leaves one capture line — while the kill switch
+ * leaves none.
+ */
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { parse as parseYaml } from 'yaml';
+
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+
+import { CONCERN_REGISTRY, isInProcessConcern } from '../../../src/scripts/hooks/concern_registry.js';
+import { EVENT_VOCABULARY } from '../../../src/scripts/hooks/dispatch_hook.js';
+import { LAZY_CONCERNS, _resetLazyConcernCache, loadLazyConcernUncached } from '../../../src/scripts/hooks/lazy_concern.js';
+import { KILL_SWITCH_ENV } from '../../../src/scripts/hooks/instructions_observer_hook.js';
+
+const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
+const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
+const OBSERVER = 'src/scripts/hooks/instructions_observer_hook.ts';
+const SESSION = 'sess-binding-probe';
+
+interface Manifest {
+    concerns: Record<string, { script: string }>;
+    platforms: Record<string, Record<string, unknown>>;
+    native_event_aliases: Record<string, Record<string, string>>;
+}
+
+const manifest = parseYaml(fs.readFileSync(path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8')) as Manifest;
+
+describe('manifest binding', () => {
+    it('declares the event and the concern', () => {
+        expect(EVENT_VOCABULARY.has('instructions_loaded')).toBe(true);
+        expect(manifest.concerns['instructions-observer']?.script).toBe(OBSERVER);
+    });
+
+    it('runs the observer on claude, and on no other platform', () => {
+        const bound = Object.entries(manifest.platforms)
+            .filter(([, events]) => Object.prototype.hasOwnProperty.call(events, 'instructions_loaded'))
+            .map(([platform]) => platform);
+        expect(bound).toEqual(['claude']);
+        expect(manifest.platforms['claude']!['instructions_loaded']).toEqual(['instructions-observer']);
+    });
+
+    it('aliases the native event on claude alone', () => {
+        const aliased = Object.entries(manifest.native_event_aliases)
+            .filter(([, aliases]) => aliases['InstructionsLoaded'] !== undefined)
+            .map(([platform, aliases]) => [platform, aliases['InstructionsLoaded']]);
+        expect(aliased).toEqual([['claude', 'instructions_loaded']]);
+    });
+});
+
+describe('in-process reach', () => {
+    it('is lazy, not inlined, and still in-process', () => {
+        expect(CONCERN_REGISTRY[OBSERVER]).toBeUndefined();
+        expect(LAZY_CONCERNS[OBSERVER]?.chunk).toBe('instructions_observer.chunk.cjs');
+        expect(isInProcessConcern(OBSERVER)).toBe(true);
+    });
+
+    it('loads a callable main from the source tree', () => {
+        _resetLazyConcernCache();
+        expect(typeof loadLazyConcernUncached(OBSERVER)).toBe('function');
+    });
+});
+
+function dispatch(machineRoot: string, projectDir: string, extraEnv: Record<string, string> = {}): number {
+    const r = spawnSync(
+        'npx',
+        ['tsx', DISPATCH, '--platform', 'claude', '--event', 'instructions_loaded', '--native-event', 'InstructionsLoaded', '--project-dir', projectDir],
+        {
+            input: JSON.stringify({
+                session_id: SESSION,
+                hook_event_name: 'InstructionsLoaded',
+                load_reason: 'session_start',
+                file_path: path.join(os.homedir(), '.claude', 'rules', 'probe-rule.md'),
+            }),
+            encoding: 'utf-8',
+            cwd: REPO,
+            timeout: 180_000,
+            env: { ...process.env, EVENT4U_CONFIG_HOME: machineRoot, ...extraEnv },
+        },
+    );
+    return r.status ?? -1;
+}
+
+describe('a real dispatch of InstructionsLoaded', () => {
+    it('writes one capture line under runtime/arrivals and exits 0', () => {
+        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-binding-'));
+        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'il-project-'));
+        try {
+            expect(dispatch(root, project)).toBe(0);
+            const file = path.join(root, 'runtime', 'arrivals', `${SESSION}.jsonl`);
+            const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
+            expect(lines).toHaveLength(1);
+            const line = JSON.parse(lines[0]!) as Record<string, unknown>;
+            expect(line['session']).toBe(SESSION);
+            expect(line['name']).toBe('InstructionsLoaded');
+            expect(line['file']).toBe('probe-rule.md');
+            expect(line['rules']).toBe(true);
+        } finally {
+            fs.rmSync(root, { recursive: true, force: true });
+            fs.rmSync(project, { recursive: true, force: true });
+        }
+    }, 200_000);
+
+    it('writes nothing with the kill switch set (source mode)', () => {
+        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-binding-off-'));
+        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'il-project-off-'));
+        try {
+            expect(dispatch(root, project, { [KILL_SWITCH_ENV]: 'off' })).toBe(0);
+            expect(fs.existsSync(path.join(root, 'runtime', 'arrivals'))).toBe(false);
+        } finally {
+            fs.rmSync(root, { recursive: true, force: true });
+            fs.rmSync(project, { recursive: true, force: true });
+        }
+    }, 200_000);
+});
+
+/**
+ * The shipped path: the built `dist/hooks/dispatch.js` loading the built chunk.
+ * Bundle and chunk are built fresh into a throwaway directory (a developer's own
+ * `dist/` may be stale), then laid out as an install. Which path answered is
+ * decided by what the layout leaves reachable: with no observer source on disk
+ * the spawn fallback has nothing to run, so a capture line proves the chunk.
+ */
+describe('the built bundle', () => {
+    let build = '';
+    const SH = process.platform === 'win32' ? null : '/bin/sh';
+
+    beforeAll(async () => {
+        build = fs.mkdtempSync(path.join(os.tmpdir(), 'il-build-'));
+        const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
+        // Cut at the digest step, not at the first `&&`: the banner holds `&&` of its own.
+        const esbuild = pkg.scripts['build:hooks']!.split(' && node src/scripts/write_bundle_digest.mjs')[0]!.replace(
+            '--outfile=dist/hooks/dispatch.js',
+            `--outfile=${path.join(build, 'dispatch.js')}`,
+        );
+        const env = { ...process.env, PATH: `${path.join(REPO, 'node_modules', '.bin')}${path.delimiter}${process.env['PATH'] ?? ''}` };
+        const b = spawnSync(SH!, ['-c', esbuild], { cwd: REPO, encoding: 'utf-8', env });
+        expect(b.status, b.stderr).toBe(0);
+        const { buildChunk } = (await import('../../../src/scripts/hook_chunks.mjs')) as {
+            buildChunk: (root: string, entry: string, outfile: string) => void;
+        };
+        buildChunk(REPO, OBSERVER, path.join(build, 'instructions_observer.chunk.cjs'));
+        for (const f of ['dispatch.js', 'instructions_observer.chunk.cjs']) {
+            const d = spawnSync(process.execPath, [path.join(REPO, 'src', 'scripts', 'write_bundle_digest.mjs'), path.join(build, f)], { encoding: 'utf-8' });
+            expect(d.status, d.stderr).toBe(0);
+        }
+    }, 180_000);
+
+    afterAll(() => {
+        if (build) fs.rmSync(build, { recursive: true, force: true });
+    });
+
+    /**
+     * Mirror `from` into `to` as symlinks, except along the path to `omit`, where
+     * real directories are made so the one file can be left out. The bundle reads
+     * data files from `src/` at runtime, so the tree must be there; only the
+     * observer source must not be.
+     */
+    function mirrorWithout(from: string, to: string, omit: string): void {
+        fs.mkdirSync(to, { recursive: true });
+        const [head, ...rest] = omit.split('/');
+        for (const entry of fs.readdirSync(from)) {
+            if (entry !== head) {
+                fs.symlinkSync(path.join(from, entry), path.join(to, entry));
+            } else if (rest.length > 0) {
+                mirrorWithout(path.join(from, entry), path.join(to, entry), rest.join('/'));
+            }
+        }
+    }
+
+    /** An install root: the built bundle, optionally its chunk, optionally the observer source the spawn path needs. */
+    function install(opts: { chunk: boolean; source: boolean }): string {
+        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-install-'));
+        const hooks = path.join(root, 'dist', 'hooks');
+        fs.mkdirSync(hooks, { recursive: true });
+        for (const f of fs.readdirSync(build)) {
+            if (!opts.chunk && f.startsWith('instructions_observer.chunk.cjs')) continue;
+            fs.copyFileSync(path.join(build, f), path.join(hooks, f));
+        }
+        fs.copyFileSync(path.join(REPO, 'package.json'), path.join(root, 'package.json'));
+        fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
+        if (opts.source) {
+            fs.symlinkSync(path.join(REPO, 'src'), path.join(root, 'src'));
+        } else {
+            mirrorWithout(path.join(REPO, 'src'), path.join(root, 'src'), OBSERVER.replace(/^src\//, ''));
+        }
+        return root;
+    }
+
+    function runBuilt(root: string): { code: number; lines: string[] } {
+        const machine = path.join(root, 'machine');
+        const project = path.join(root, 'project');
+        fs.mkdirSync(project);
+        const r = spawnSync(
+            process.execPath,
+            [path.join(root, 'dist', 'hooks', 'dispatch.js'), '--platform', 'claude', '--event', 'instructions_loaded', '--native-event', 'InstructionsLoaded', '--project-dir', project],
+            {
+                input: JSON.stringify({ session_id: SESSION, hook_event_name: 'InstructionsLoaded', file_path: '/x/.claude/rules/r.md' }),
+                encoding: 'utf-8',
+                cwd: project,
+                timeout: 120_000,
+                env: { ...process.env, EVENT4U_CONFIG_HOME: machine },
+            },
+        );
+        const file = path.join(machine, 'runtime', 'arrivals', `${SESSION}.jsonl`);
+        return { code: r.status ?? -1, lines: fs.existsSync(file) ? fs.readFileSync(file, 'utf-8').trim().split('\n') : [] };
+    }
+
+    it.skipIf(SH === null)('captures through the chunk when no source is on disk', () => {
+        const root = install({ chunk: true, source: false });
+        try {
+            const { code, lines } = runBuilt(root);
+            expect(code).toBe(0);
+            expect(lines).toHaveLength(1);
+        } finally {
+            fs.rmSync(root, { recursive: true, force: true });
+        }
+    }, 150_000);
+
+    it.skipIf(SH === null)('captures nothing with neither the chunk nor the source — the control for the case above', () => {
+        const root = install({ chunk: false, source: false });
+        try {
+            const { code, lines } = runBuilt(root);
+            expect(code).toBe(0);
+            expect(lines).toHaveLength(0);
+        } finally {
+            fs.rmSync(root, { recursive: true, force: true });
+        }
+    }, 150_000);
+
+    it.skipIf(SH === null)('falls back to the spawn path when the chunk is missing and still captures', () => {
+        const root = install({ chunk: false, source: true });
+        try {
+            const { code, lines } = runBuilt(root);
+            expect(code).toBe(0);
+            expect(lines).toHaveLength(1);
+        } finally {
+            fs.rmSync(root, { recursive: true, force: true });
+        }
+    }, 150_000);
+});
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index eb5a907ad3..cda3c0f216 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -364,8 +364,9 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     // declared, which is the failure this case exists for.
     // So 62 after that withdrawal, and 63 again since `block-credential-reads`
     // (road-to-one-detector-and-the-senders-we-own 1.1), and 64 since `host-rate-marker`
-    // (road-to-a-cold-start-paid-once 4.3).
-    expect(names.length).toBe(64);
+    // (road-to-a-cold-start-paid-once 4.3), and 65 since `instructions-observer`
+    // (road-to-a-setup-that-decides-itself 1.1).
+    expect(names.length).toBe(65);
     const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
     expect(missing).toStrictEqual([]);
     const mismatched = names.filter(
diff --git a/tests/scripts/runtime_journal.test.ts b/tests/scripts/runtime_journal.test.ts
index 9950be3371..1633bd4d92 100644
--- a/tests/scripts/runtime_journal.test.ts
+++ b/tests/scripts/runtime_journal.test.ts
@@ -88,10 +88,11 @@ afterEach(() => {
 // ---------------------------------------------------------------------------
 
 describe('event vocabulary coverage (AC-1)', () => {
-    it('the vocabulary still has exactly ten members', () => {
+    it('the vocabulary still has exactly eleven members', () => {
         // Pinned because the roadmap corrects a source claim of nine. A journal
-        // sized to the wrong number drops an event on day one.
-        expect(EVENT_VOCABULARY.size).toBe(10);
+        // sized to the wrong number drops an event on day one. Eleven since
+        // `instructions_loaded` (road-to-a-setup-that-decides-itself 1.1).
+        expect(EVENT_VOCABULARY.size).toBe(11);
     });
 
     it('every member is either recorded or explicitly not-recorded with a reason', () => {
```
