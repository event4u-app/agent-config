---
proposed_by: claude-code session recording the owner's merge-queue rejection (2026-11-07)
implemented_by: same session — see § Independence
reviewed_by: ai-council 2026-11-07 (round 1) — anthropic (cli) + openai (cli)
subject: f9bc4be2e635053f8d0fd98c6056acec9b9fceb06589b45497448ffab2556683
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `docs/no-merge-queue`

Named for the branch, because the gate reads this file on the first push.

## What was proposed

`.github/workflows/consistency.yml` is gated (it carries the ratification
gate's workflow). The only change to it is a YAML comment above the
`merge_group` trigger: it said the trigger was inert until an admin enables a
queue, and now says the owner rejected the queue, citing
`agents/evidence/owner-directives/2026-11-07-no-merge-queue.md`. No trigger,
job, step or condition changed.

## Round

One invocation, 2026-11-07, subscription CLI, $0. Both seats
`confirmed-non-expanding`. The openai seat suggested making the conditional
meaning of "Inert" explicit — a clarity point it named as not blocking; not
adopted, so the reviewed bytes are the merged bytes.

## Independence

`proposed_by` and `implemented_by` are the same session; `reviewed_by` is the
two-provider council.

## Prompt (verbatim)

~~~~markdown
# Ratification review — comment-only edit to .github/workflows/consistency.yml

The owner enabled a GitHub merge queue on ruleset 17749383 on 2026-11-07 and removed it the same day by explicit order ("schalte es ab und vermerke das, damit es nicht mehr passiert. Das bringt keinen Vorteil. WEg damit"); recorded in agents/evidence/owner-directives/2026-11-07-no-merge-queue.md.

consistency.yml is on the ratification gate's gated list (it carries the gate's workflow). The diff below changes only a YAML comment above the merge_group trigger: it used to say the trigger is inert until an admin turns a queue on, pointing at a stub that planned enabling it; it now says the owner rejected the queue and points at the directive. No trigger, job, step or condition changes; merge_group stays declared.

~~~diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 67762d3465..db12c9d2ac 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -1,8 +1,8 @@
 name: Consistency
 
 on:
-  # Merge-queue ready, not merge-queue enabled: inert until an admin turns a
-  # queue on (stubs/road-to-main-protection-ruleset-changes). PR-only steps are
+  # Inert: the owner rejected a merge queue on 2026-11-07 — do not enable one
+  # (agents/evidence/owner-directives/2026-11-07-no-merge-queue.md). PR-only steps are
   # already guarded by `github.event_name == 'pull_request'` or an empty
   # `github.base_ref`, the same path workflow_dispatch takes.
   merge_group:
~~~

## Question

Does this diff change any behaviour or expand authority? Is the comment accurate? Any defect? Return findings, then one final verdict from exactly: `ratified` · `confirmed-non-expanding` · `refused` · `non-convergent`.
~~~~
