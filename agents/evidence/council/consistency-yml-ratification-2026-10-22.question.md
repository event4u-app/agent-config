# Ratification review — `.github/workflows/consistency.yml` on branch `ci/green-in-minutes`

<!-- evidence-type: analysis -->

`check_kernel_edit_ratified` classifies this file as part of the ratification
mechanism because it hosts the ratification gate step
("Kernel / governance-hook edits carry a ratification artifact", `if: github.event_name == 'pull_request'`).
ADR-268 § 4: an agent may modify its constitution and may not ratify its own
increase in power. You are the independent reviewer of the change below; the
author and implementer is the session that wrote it.

Return exactly one verdict from `ratified` · `confirmed-non-expanding` · `refused` ·
`non-convergent`, with the reasons and any condition. `confirmed-non-expanding`
means: the file is a governance surface, and this change does not expand any
party's authority or weaken any gate. Judge the diff, not this description.

Repository context you may need: `check_gate_coverage` (the "Gate coverage floors"
step) now runs its gates on a bounded concurrent pool and skips executing a row
whose `floor_asserted_in` workflow carries a same-job
`check_gate_coverage --from-output … --only <id>` assertion (currently one row,
`check_static_parity`, asserted in `tests.yml` collector-lifecycle); if that
assertion is absent it executes the gate as before. That logic is in
`src/scripts/check_gate_coverage.ts`, not in this file.

## The complete diff of the gated file (`git diff origin/main...HEAD -- .github/workflows/consistency.yml`)

```diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index c5fe6897a..3c8f11d96 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -1,6 +1,12 @@
 name: Consistency
 
 on:
+  # Merge-queue ready, not merge-queue enabled: inert until an admin turns a
+  # queue on (stubs/road-to-main-protection-ruleset-changes). PR-only steps are
+  # already guarded by `github.event_name == 'pull_request'` or an empty
+  # `github.base_ref`, the same path workflow_dispatch takes.
+  merge_group:
+    types: [checks_requested]
   pull_request:
     # `labeled`/`unlabeled` are here for the kernel-rule bundle override.
     # `check_kernel_rule_bundle` reads the override label from the event
@@ -111,6 +117,10 @@ jobs:
   consistency:
     name: Sync + Generate Tools Consistency
     runs-on: ubuntu-latest
+    # A fence, not a budget: twice the slowest run measured before the gate
+    # census went parallel (12m26s, PR #2568), so a healthy run never meets it
+    # while a hang stops costing the queue a runner for GitHub's 6-hour default.
+    timeout-minutes: 25
 
     steps:
       - name: Check out repository
@@ -492,14 +502,17 @@ jobs:
       # gate that reads every other gate's floor — was referenced by nothing at
       # all, not even `task ci`. Its reds were visible only to someone running
       # the script by hand. Wired here rather than into rule-backstops.yml
-      # because this job is the only required status check
+      # because this job is a required status check
       # (docs/contracts/branch-protection-policy.md), which is what makes a red
-      # actually block a merge. Cost, both steps measured rather than the
-      # cheaper one: check_ci_local_parity 0.53 s, check_gate_coverage 18.6 s —
-      # together ~19 s, about 26% on top of this job's recorded 75 s average,
-      # against a 300 s per-job ceiling (docs/contracts/ci-cost-budget.md).
-      # Comfortable, but not the "negligible" this comment first claimed: the
-      # coverage gate spawns every registered gate to read its scanned: line.
+      # actually block a merge. Cost: this comment first recorded the coverage
+      # step at under 20 s; by PR #2569 (job 39644704428, 2026-10-21) it
+      # measured 443 s of a 613 s job, because it ran all 118 gates one after
+      # another through two tsx boots each, including check_static_parity's two
+      # whole vitest runs. It now runs them on a bounded pool, through a
+      # single-boot `scripts-run`, and leaves check_static_parity to the
+      # tests.yml job that already runs it and asserts its floor there
+      # (`floor_asserted_in`). Its output ends with the ten slowest gates, so
+      # the next drift is visible in the log rather than in a comment.
       - name: CI ↔ local gate parity
         run: ./scripts-run src/scripts/check_ci_local_parity --quiet
 
```
