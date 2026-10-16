<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 3 — delta after round 2

Round 2 (prompt `agents/evidence/council/gate-header-matches-hooks-review-r2-20261016.question.md`, reviewed `7a66dd1ac`) approved 2/2; both seats named a follow-up: a regression test turning the probes into an automated check.

Why there is a delta at all: CI's `check_test_delta` refused the pull request — a code path changed with no test path — and the alternative, the `test-delta-acknowledged` label, is the owner's. So the follow-up both seats named was written now.

What the delta does (`394511192`):

- New `tests/scripts/check_kernel_edit_ratified_header_claims.test.ts`: for `Write`, `Edit` and a `Bash` redirect, `block_plumbing_writes.check_envelope` and `block_kernel_rule_writes.check_envelope` do NOT deny `src/scripts/hooks/dispatch_hook.ts` or `src/scripts/_lib/kernel_rules.ts`, while the same three envelope shapes ARE denied on `hooks/hooks.json` (plumbing guard) and `src/rules/non-destructive-by-default.md` (kernel-rule guard). Sensitivity: adding `src/scripts/hooks/dispatch_hook.ts` to `PLUMBING_BUILD_OUTPUTS` turned the first case red; reverted.
- A factual correction found while writing it: `PLUMBING_BUILD_OUTPUTS` holds FOUR entries — `dist/hooks/dispatch.js`, `hooks/hooks.json`, `src/scripts/hook_manifest.json`, `src/scripts/hooks/host_lowering.json` — and the header said "three". It now says four. (Rounds 1 and 2 were told three; that was wrong.)
- Scope of the test, stated: it exercises the two guards the header names directly. The broader statement — no bound `pre_tool_use` concern denies either path — rests on the round-2 dispatcher probe and is not automated here.

The subject digest is now `611276120fee1278c9d819d284d1a3872ba2c106571b6e1bf085198cb05c2bc4` from both the base revision's gate and the head's.

Review the delta below. Report any defect with file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES).

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 5b8325ed7..47df197dc 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -234,7 +234,7 @@ const GOVERNANCE_HOOK_RE = /^src\/scripts\/hooks\/block_[a-z0-9_]+\.ts$/;
  *     that could quietly narrow the gate while every other path kept working.
  *
  * No `pre_tool_use` concern bound in `hook_manifest.yaml` denies an edit to
- * either: the plumbing guard protects three generated build outputs and names
+ * either: the plumbing guard protects four generated build outputs and names
  * `dispatch_hook.ts` only where it reads one, and the kernel-rule write guard
  * imports `kernel_rules.ts` without protecting it. For these two paths the
  * record this gate demands is the only layer, not a second one beside a deny.
diff --git a/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
new file mode 100644
index 000000000..58db5f3ff
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
@@ -0,0 +1,42 @@
+import { describe, expect, it } from 'vitest';
+
+import { check_envelope as kernelRuleGuard } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
+import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_plumbing_writes.js';
+
+/**
+ * `check_kernel_edit_ratified`'s header says no tool-call guard denies an edit
+ * of the dispatcher source or the kernel-rule list, so the record is their only
+ * layer. These cases keep that sentence true: if a guard starts denying either
+ * path, the header has to change with it.
+ */
+
+const UNGUARDED = ['src/scripts/hooks/dispatch_hook.ts', 'src/scripts/_lib/kernel_rules.ts'];
+
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type Envelope = any;
+
+function envelopes(filePath: string): Envelope[] {
+    return [
+        { tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } },
+        { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' } },
+        { tool_name: 'Bash', tool_input: { command: `printf x > ${filePath}` } },
+    ];
+}
+
+describe("the gate header's claim about tool-call guards", () => {
+    it.each(UNGUARDED)('neither write guard denies an edit of %s', (rel) => {
+        for (const env of envelopes(rel)) {
+            expect(plumbingGuard(env)[0], `plumbing guard, ${env.tool_name}`).toBe(false);
+            expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(false);
+        }
+    });
+
+    it('the same envelopes do reach a deny on what each guard protects', () => {
+        for (const env of envelopes('hooks/hooks.json')) {
+            expect(plumbingGuard(env)[0], `plumbing guard, ${env.tool_name}`).toBe(true);
+        }
+        for (const env of envelopes('src/rules/non-destructive-by-default.md')) {
+            expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(true);
+        }
+    });
+});
```
