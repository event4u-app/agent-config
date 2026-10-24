<!-- evidence-type: analysis -->

# Ratification review, round 6 — the merge of origin/main into the `layer-promote` binding

You are an independent reviewer for a change in the `event4u/agent-config` repository. Round 5 of 2026-10-24 ratified (anthropic + openai) the binding of the claude-only `session_start` concern `layer-promote`, with the dispatch bundle ceiling raised 1,554,000 → 1,554,800. Record: `agents/evidence/ratifications/layer-promote-binding-20261024.md`; prompts r1–r5 beside this file.

Since then `main` merged #2635, which binds a different claude-only concern, `subagent-constraints` on `subagent_start`, from its own lazy chunk, adding 159 B to the dispatch bundle without a raise. Merging `main` into this branch conflicted in three gated files, so the ratified subject no longer matches. This round reviews ONLY the merge resolution: decide whether it keeps the round-5 decision intact and leaves #2635's binding as main shipped it.

## The resolution

- `hook_manifest.yaml`: both concern rows kept, side by side; `layer-promote` stays in `platforms.claude.session_start`, `subagent-constraints` stays in `platforms.claude.subagent_start`. `hook_manifest.json` regenerated from the yaml by `compile_hook_manifest`.
- `hook-bundle-budget.json`: both chunk ceilings kept (`layer_promotion_hook.ts` 56,800; `subagent_constraints_hook.ts` 12,500). `max_bytes` unchanged at 1,554,800; one sentence appended to this branch's own raise_log entry recording the combined reading.
- Non-gated: both concern-admission rows kept; the manifest census test counts 69 concerns.

Combined tree: `check_hook_bundle_composition` reads 1,554,582 B of 1,554,800 (218 B left); chunks 54,058 B and 12,194 B. Tests: `lint_hook_manifest`, `layer_promotion`, the subagent-constraints suites and `tests/hooks` + `tests/scripts/hooks` — 94 files, 1,806 tests pass. `check_concern_admissions` and `check_kill_switch_table` pass.

## What to answer

1. Does the resolution drop, duplicate or alter anything either side shipped? Name file and line.
2. Does the combined ceiling still hold without a further raise, and is the appended raise_log sentence accurate?
3. Does the merge expand any agent's authority beyond what round 5 and #2635 each ratified?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## This branch's gated files against the merged main (`git diff origin/main HEAD`; `hook_manifest.json` omitted, one regenerated line)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 22a77faca9..938fd7cbb0 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -5,5 +5,5 @@
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1554000,
+    "max_bytes": 1554800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the last `raise_log` entry, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
@@ -65,4 +65,13 @@
             "why_it_could_not_be_avoided": "The 2026-10-18 derivation queued this rescan inside the 32,000 ceiling and the 2026-10-22 raise recorded it as not yet in the chunk. Room was taken first: `LATIN_TWIN` moved out of confusables.ts as a hex-encoded string pair so the chunk no longer carries that module's four script regexes, and the normaliser keeps one origin array instead of two (32,670 down to 31,907). The extent fix that a council seat found in round 1 of the ratification review adds about 400 bytes of mapping code no smaller form carries. The chunk loads only when a caller needs detection; the dispatch bundle is unchanged.",
             "what_would_have_caught_it": "Measuring the wired engine when 2.5 was first built rather than the unwired module, and a disguised-marker key block in the extent tests from the start."
+        },
+        {
+            "date": "2026-10-24",
+            "from": 1554000,
+            "to": 1554800,
+            "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 54,058-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes. Re-measured on the merge with #2635 (`subagent-constraints`, +159 B on main without a raise): 1,554,582 B, still under this ceiling, so no further raise."
         }
     ],
@@ -104,4 +113,10 @@
             "derivation": "Measured 32,812 bytes on 2026-10-24 (the concern, its decision library and the delivery-receipt reader) with `yaml` external (the concern reads one user-global settings file with it; inlined it would be a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps its body off every other dispatch parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the notice."
         },
+        {
+            "entry": "src/scripts/hooks/layer_promotion_hook.ts",
+            "max_bytes": 56800,
+            "registered_at": "2026-10-24",
+            "derivation": "Measured 54,058 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
+        },
         {
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 120823b216..97da7e3e3e 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1398,4 +1398,19 @@ concerns:
     severity: advisory
     effect: execution
+  # road-to-a-setup-that-decides-itself step 3.3 — promote the claude rule layer
+  # after proof, never at install. On session_start: demote a thinned layer the
+  # latest arrival record (taken after the promotion) shows missing a standing
+  # law, or — only while `src/config/layer-form-promotion.json` is enabled, which
+  # step 5.3 decides — thin a full one for the FOLLOWING sessions when the
+  # layer-form decision returns `thinned`. Silent, exit 0 on every path, no
+  # hook-token-budget row — it emits nothing. claude alone: the arrival record
+  # and the carrier describe the claude layer only. Loaded from its own chunk.
+  # Kill switch: `AGENT_CONFIG_LAYER_PROMOTE=off`.
+  layer-promote:
+    script: src/scripts/hooks/layer_promotion_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: execution
   # road-to-a-tick-the-shipped-path-earns 2.4 — the constraint carrier for a
   # subagent whose definition sets `omitClaudeMd`. On SubagentStart it reads the
@@ -1638,5 +1653,5 @@ platforms:
   claude:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote]
     # `rule-inject` is bound here for ONE source: `compact`
     # (road-to-a-rule-carrier-that-works-outside-the-repo step 1.6). The concern
```
