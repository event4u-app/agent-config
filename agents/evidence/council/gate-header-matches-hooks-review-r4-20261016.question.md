<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 4 — delta after round 3

Round 3 (prompt `agents/evidence/council/gate-header-matches-hooks-review-r3-20261016.question.md`, reviewed `394511192`): both seats REQUEST_CHANGES on one finding — `tests/scripts/check_kernel_edit_ratified_header_claims.test.ts` advertised the header's manifest-wide sentence while exercising only the two guards the header names; requested either a dispatcher-level test or wording narrowed to exactly the two guards.

Disposition (`8aeec4558`): the narrowing, test-only. The comment now says the cases check exactly the plumbing and kernel-rule guards and nothing wider, and that the header's broader sentence rests on the one-off dispatcher probe recorded in round 2; the `describe` and `it` names say the same. No assertion changed. `src/scripts/check_kernel_edit_ratified.ts` is unchanged since round 3, so the subject digest is still `611276120fee1278c9d819d284d1a3872ba2c106571b6e1bf085198cb05c2bc4`. The three cases pass.

Not taken: a dispatcher-level test. It needs the esbuild hook bundle built inside the test run; the round-2 probe did exactly that once, by hand.

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
index 58db5f3ff..e4e00f32e 100644
--- a/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
@@ -4,10 +4,11 @@ import { check_envelope as kernelRuleGuard } from '../../src/scripts/hooks/block
 import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_plumbing_writes.js';
 
 /**
- * `check_kernel_edit_ratified`'s header says no tool-call guard denies an edit
- * of the dispatcher source or the kernel-rule list, so the record is their only
- * layer. These cases keep that sentence true: if a guard starts denying either
- * path, the header has to change with it.
+ * `check_kernel_edit_ratified`'s header names two guards and says neither
+ * protects the dispatcher source or the kernel-rule list. These cases check
+ * exactly those two guards, and nothing wider: the header's broader sentence,
+ * that no bound `pre_tool_use` concern denies either path, was verified once by
+ * sending both edits through the built dispatcher and is not automated here.
  */
 
 const UNGUARDED = ['src/scripts/hooks/dispatch_hook.ts', 'src/scripts/_lib/kernel_rules.ts'];
@@ -23,8 +24,8 @@ function envelopes(filePath: string): Envelope[] {
     ];
 }
 
-describe("the gate header's claim about tool-call guards", () => {
-    it.each(UNGUARDED)('neither write guard denies an edit of %s', (rel) => {
+describe('the two guards the gate header names', () => {
+    it.each(UNGUARDED)('neither the plumbing nor the kernel-rule guard denies an edit of %s', (rel) => {
         for (const env of envelopes(rel)) {
             expect(plumbingGuard(env)[0], `plumbing guard, ${env.tool_name}`).toBe(false);
             expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(false);
```

Review the delta. Report any remaining defect with file:line, scenario and severity. State your stance (APPROVE or REQUEST_CHANGES).
