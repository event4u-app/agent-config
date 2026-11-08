<!-- evidence-type: analysis -->

<!-- Round-16 prompt given to the council on 2026-11-08 for branch
     feat/compact-checkpoint-phase-1, committed verbatim beside the record. -->

# Ratification review, round 16 — the same change on a moved base

Round 15 ratified this change (anthropic: ratified, openai: approve, no
blockers). Since then `main` advanced by two merged pull requests; one of them
(#2926, "observe act-time reference duties at bound shell acts") added its own
rows to `src/config/hook-bundle-budget.json`. After merging `main` into this
branch the gated files' content differs, so the round-15 record's digest no
longer matches. No code of this branch changed.

Below is this branch's diff of the gated files against the new `main`. Judge
the same question as before — does it expand any authority beyond what round
15 accepted, and is it acceptable? Answer with exactly one verdict:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it should not merge, or the material does not let you tell.

Then list any defect that blocks the merge.

## This branch's diff of the gated files against the new main

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index ce8d654b20..b511904652 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -295,6 +295,12 @@
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
         },
+        {
+            "entry": "src/scripts/hooks/compact_checkpoint_hook.ts",
+            "max_bytes": 20200,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 18,296 bytes on 2026-11-08 (the compact-checkpoint concern: a keys-only marker in the user-global runtime directory with an inspection-bounded, complete sweep of abandoned markers, its bounded non-following reader, and the containment check and runtime-path helpers it reuses), `yaml` external. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `pre_compact` and `session_start` on claude only; the dispatch bundle carries only its LAZY_CONCERNS row."
+        },
         {
             "entry": "src/scripts/hooks/web_launch_rows.ts",
             "max_bytes": 14000,
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6631126372..0139517c76 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1662,6 +1662,17 @@ concerns:
   # has happened. The journal's own RECORDED_EVENTS / NOT_RECORDED partition is
   # unchanged — it governs the vocabulary, not the bindings — so the capture
   # evidence states the unbound slot instead of the partition implying coverage.
+  # road-to-state-and-pins-across-compaction 1.2: writes a keys-only marker
+  # at `pre_compact` under the user-global runtime directory and classifies it
+  # at `session_start(compact)`. Injects nothing (council 2026-11-08: the keys
+  # name the session, not the compaction attempt). Claude only — the one host whose compaction records
+  # were measured. Kill switch: `AGENT_CONFIG_NO_COMPACT_CHECKPOINT=1`.
+  compact-checkpoint:
+    script: src/scripts/hooks/compact_checkpoint_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: telemetry
   journal-record:
     script: src/scripts/hooks/journal_record_hook.ts
     args: []
@@ -1744,7 +1755,7 @@ platforms:
 
   claude:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, star-ask, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, star-ask, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote, compact-checkpoint]
     # `rule-inject` is bound here for ONE source: `compact`
     # (road-to-a-rule-carrier-that-works-outside-the-repo step 1.6). The concern
     # returns before reading anything on `startup`, `resume`, `clear` and
@@ -1791,7 +1802,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard, compact-checkpoint]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
~~~

## What #2926 changed in the budget file (already on main)

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..ce8d654b20 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -200,6 +200,26 @@
             "what_was_added": "The switch question near a plan limit: `_lib/switch_relay.ts` (raise a request for this session over `agent-switch switch request --session … --by ac --json`, read it back with `switch show`, parse the version-1 request, the per-session record of what was told, the user's line and the model's `additional_context` naming the id and that only the user decides) and the link discovery it gates on (`_lib/agent_switch_link.ts` with the hardened spawn environment of `_lib/spawn_env.ts`). Measured 38,720 B against 22,772 B on origin/main d783496af2, both readings by this gate; ceiling 41,000 B leaves 2,280 B, about 6 % of the reading; any growth past it is caught by this gate.",
             "why_it_could_not_be_avoided": "The feature is this concern's: the raise follows the same hot-window reading the notice already makes, on the same prompt, and the relay has to run on every prompt while a request is open. The cheaper paths were taken first. The MCP client (`agent_switch_client.ts`) stays out: its lazy SDK import would inline the SDK into the chunk, so the hook reaches agent-switch over the synchronous CLI verbs the contract already defines. The checkpoint before a move, which needs the settings cascade and the run-claim reader (measured at about 466 KB with them, the yaml parser among them), lives in the `session-eol` Stop path that already carries both, not here. A second lazily-required chunk for the relay alone was considered and refused: it would load on every prompt that has a request open and every prompt with a hot window, which is when this code runs anyway, and it would add a loader and a second budget entry for no byte this concern does not need.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/_lib/reference_duty.ts",
+            "from": 18200,
+            "to": 20600,
+            "by": "agent, feat/act-references (road-to-a-reference-that-arrives-before-the-act), ratification rounds 4-6",
+            "what_was_added": "Shell syntax the act recogniser had to honour to agree with bash, each found by a ratification seat or by the generated bash differential test: one quote reader shared by words and heredoc terminators (escaped and empty terminators), assignment words carrying their quoting and position (`'X=1' git push`, `nohup X=1 git push`), backslash-newline joins in terminators and in unquoted heredoc bodies, here-strings, `time` as the keyword only unquoted at the start of a pipeline, the `time -p` / `command --` / `nohup --` / `command -v` forms, and in round 7 every redirection dropped with its operand wherever it stands. Measured 17,148 B before round 4, 18,774 B after round 6, 20,566 B after round 7.",
+            "why_it_could_not_be_avoided": "Every addition closes a false observation or a swallowed act that real bash disagrees with; the alternative is a recogniser whose stated syntax contract is false. The chunk loads only on a file write or a Bash command carrying a bound act word, so no other dispatch pays these bytes; the dispatch bundle is unchanged at 1,582,782 B.",
+            "what_would_have_caught_it": "The generated differential test that now ships with the recogniser (`tests/scripts/shell_acts_bash_fuzz.test.ts`), had it existed before the 18,200 ceiling was set: it found the pipeline-`time` class on its first run. Sized to the round-6 reading plus about 10 %."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/_lib/reference_duty.ts",
+            "from": 20600,
+            "to": 22000,
+            "by": "agent, feat/act-references (road-to-a-reference-that-arrives-before-the-act), ratification rounds 8-15",
+            "what_was_added": "Shell syntax the recogniser needed to agree with bash after the 20,600 raise, each found by a ratification seat or by the generated bash test and pinned in the oracle: redirections dropped with their operands at any position (fd numbers, here-strings, a pending operand outranking a digit word, no fd before `&>`), operators and heredoc terminators read across backslash-newline, leading reserved words opening a command only before any redirection, `time` as keyword per bash 5 after every opener, and the lookup context that makes `exec` after `exec` / `nohup` / `sudo` / time(1) a program name. Measured 18,774 B at the 20,600 raise, 20,607 B after round 15.",
+            "why_it_could_not_be_avoided": "Each addition closes a false or missed candidate that bash 3.2 and 5.2 disagree with; trimming code to fit would reopen one of them. The chunk loads only on a file write or a Bash command carrying a bound act word; the dispatch bundle is unchanged at 1,582,782 B.",
+            "what_would_have_caught_it": "Sizing the ceiling to the parser's eventual scope rather than to one round's reading: a hand-written bash lexer kept growing for eight rounds after the first raise. Sized to the round-15 reading plus about 7 %, so the next fix does not need a raise of its own."
         }
     ],
     "chunks": [
@@ -286,6 +306,12 @@
             "max_bytes": 61600,
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
+        },
+        {
+            "entry": "src/scripts/_lib/reference_duty.ts",
+            "max_bytes": 22000,
+            "registered_at": "2026-11-08",
+            "derivation": "Registered at 16,523 bytes on 2026-11-08 (15,080 before ratification round 1 replaced the segmenter with a quote-, escape-, comment- and heredoc-aware lexer); raised to 20,600 after ratification round 6 measured 18,774 bytes, and to 22,000 after round 15 measured 20,607 bytes; both raises and what was added are the raise_log entries naming this chunk; the raise and what was added are the raise_log entry naming this chunk for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling was the registered reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
~~~
