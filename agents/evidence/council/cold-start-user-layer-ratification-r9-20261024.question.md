<!-- evidence-type: analysis -->

# Ratification review — the user layer in `subagent-constraints`, re-bound after a merge of the base — round 9

You are an independent reviewer for a change in the `event4u/agent-config` repository. Round 8 (`agents/evidence/council/cold-start-user-layer-ratification-r8-20261024.question.md`) reviewed this change at revision `63bf410d65` and both seats answered `ratified`. The ratification gate binds that verdict to a digest of the gated files (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/config/hook-bundle-budget.json`, `src/config/hook-token-budget.json`) as they stand in the branch's tree. Since then the branch merged `origin/main`, which had changed two of those files in another, already merged change, so the digest moved and the gate asks for a review of the content that would now land.

## What the merge changed in the gated files

Below is `git diff 63bf410d65 HEAD` for the three source files (the compiled `hook_manifest.json` is regenerated from the YAML and omitted). One textual conflict arose in `hook-bundle-budget.json`: both sides appended a `raise_log` entry in the same place; it was resolved by keeping both entries, the base's first. `hook-token-budget.json` is unchanged by the merge. No line of this change's own concern code changed after round 8.

## What to answer

1. Does the merged content of the gated files keep this change as round 8 reviewed it — the `subagent-constraints` rows, the chunk ceiling 24,500 and its `raise_log` entry, the manifest comment — and the base's own change intact? Name file and line for any defect, including in the conflict resolution.
2. Do you approve the merged content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 8df2391bd1..3616ca173a 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1554000,
+    "max_bytes": 1554800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the last `raise_log` entry, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -65,6 +65,15 @@
             "why_it_could_not_be_avoided": "The 2026-10-18 derivation queued this rescan inside the 32,000 ceiling and the 2026-10-22 raise recorded it as not yet in the chunk. Room was taken first: `LATIN_TWIN` moved out of confusables.ts as a hex-encoded string pair so the chunk no longer carries that module's four script regexes, and the normaliser keeps one origin array instead of two (32,670 down to 31,907). The extent fix that a council seat found in round 1 of the ratification review adds about 400 bytes of mapping code no smaller form carries. The chunk loads only when a caller needs detection; the dispatch bundle is unchanged.",
             "what_would_have_caught_it": "Measuring the wired engine when 2.5 was first built rather than the unwired module, and a disguised-marker key block in the extent tests from the start."
         },
+        {
+            "date": "2026-10-24",
+            "from": 1554000,
+            "to": 1554800,
+            "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 54,058-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes. Re-measured on the merge with #2635 (`subagent-constraints`, +159 B on main without a raise): 1,554,582 B, still under this ceiling, so no further raise."
+        },
         {
             "date": "2026-10-24",
             "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
@@ -113,6 +122,12 @@
             "registered_at": "2026-10-24",
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
             "max_bytes": 24500,
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 5ef2d6dd10..80608b302e 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1397,6 +1397,21 @@ concerns:
     fail_closed: false
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
   # definition the host runs (project, then user `.claude/agents/<type>.md`)
@@ -1640,7 +1655,7 @@ platforms:
 
   claude:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote]
     # `rule-inject` is bound here for ONE source: `compact`
     # (road-to-a-rule-carrier-that-works-outside-the-repo step 1.6). The concern
     # returns before reading anything on `startup`, `resume`, `clear` and
```
