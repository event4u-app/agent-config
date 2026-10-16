<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 1 — the gate's header states which paths no hook denies

Step 4.3 of `road-to-self-modification-that-a-council-must-pass`. A comment-only change to `src/scripts/check_kernel_edit_ratified.ts`, which is gated, so it carries a record.

The header said that `src/scripts/hooks/dispatch_hook.ts` and `src/scripts/_lib/kernel_rules.ts` "are also denied at tool-call time" — `dispatch_hook.ts` through the plumbing guard's source set and `kernel_rules.ts` through the kernel-rule write guard. Checked at the base (`origin/main`):

- `src/scripts/hooks/block_plumbing_writes.ts` protects three generated build outputs — `hooks/hooks.json`, `src/scripts/hook_manifest.json`, `src/scripts/hooks/host_lowering.json` — and names `dispatch_hook` only in prose about what reads one of them (lines 34 and 120);
- `src/scripts/hooks/block_kernel_rule_writes.ts` imports `is_kernel_rule` from `_lib/kernel_rules.ts` (line 51) and does not list that file among what it protects.

The replacement states that neither path is denied at tool-call time and that for these two paths the record this gate demands is the only layer. No code changes; the gate's behaviour is unchanged. Step 4.3's verify, `grep -c 'also denied at tool-call time' src/scripts/check_kernel_edit_ratified.ts`, reads 0. The subject digest is `f1fd19eda6e97781495b00a6ce65609402607bd237342823f2ffe751d82e85d8` from both the base revision's gate and the head's.

Review the diff below. Report any defect with file:line, the failure scenario and a severity — in particular whether the new sentence is true of the two guards, and whether it misstates anything else. State your stance (APPROVE or REQUEST_CHANGES).

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 1c939fdd2..f1c4bcbd7 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -233,10 +233,11 @@ const GOVERNANCE_HOOK_RE = /^src\/scripts\/hooks\/block_[a-z0-9_]+\.ts$/;
  *     from that list removes a rule from this gate's own reach — the one edit
  *     that could quietly narrow the gate while every other path kept working.
  *
- * Both are also denied at tool-call time, `dispatch_hook.ts` through the
- * plumbing guard's source set and `kernel_rules.ts` through the kernel-rule
- * write guard, so the pairing of deny-plus-record matches what the YAML sources
- * already had.
+ * Neither is denied at tool-call time: the plumbing guard protects three
+ * generated build outputs and names `dispatch_hook.ts` only where it reads one,
+ * and the kernel-rule write guard imports `kernel_rules.ts` without protecting
+ * it. For these two paths the record this gate demands is the only layer, not a
+ * second one beside a deny.
  *
  * The compiled tables are REGENERATED, not hand-edited, by
  * `./scripts-run src/scripts/compile_hook_manifest --table manifest|host-lowering`,
```
