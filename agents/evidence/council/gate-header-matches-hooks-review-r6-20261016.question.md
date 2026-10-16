<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 6, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 6 — delta after round 5

Round 5 (prompt `agents/evidence/council/gate-header-matches-hooks-review-r5-20261016.question.md`, reviewed `9eaa755d0`): anthropic APPROVE; openai REQUEST_CHANGES — a comment is not a trigger a maintainer reliably meets; requested that adding a `pre_tool_use` concern fail a check until it is reconciled with the header's claim.

Disposition (`85d209961`), test-only, in `tests/scripts/check_kernel_edit_ratified_header_claims.test.ts`:

- New case "a pre_tool_use concern nobody checked against the two paths fails here": it walks `src/scripts/hook_manifest.yaml` (parsed with `yaml`) and collects every concern bound to `pre_tool_use` in any profile — 17 today — and requires that set to equal `REVIEWED_PRE_TOOL_USE`. A new binding therefore fails CI until someone has checked it against an edit of `dispatch_hook.ts` and `kernel_rules.ts` and added it. Sensitivity: dropping `ui-route-nudge` from the list turned the case red; restored, all four cases pass.
- The list's comment says how the 17 were checked, from the manifest's own fields read today: the six `block-*`/guard concerns and `evidence-independence` (the only other `permission`/`blocking` concern in the default profile) let both edits through the built dispatcher in the round-2 probe; `one-question-per-ask` is `permission`/`blocking` but reads only the question tool (`AskUserQuestion`), so an edit never reaches its deny; the remaining nine are `advisory` (notification, context, verification, memory, formatting, telemetry) and cannot deny.
- `src/scripts/check_kernel_edit_ratified.ts` is unchanged since round 3; the subject digest is still `611276120fee1278c9d819d284d1a3872ba2c106571b6e1bf085198cb05c2bc4`. `tsc --noEmit` passes.

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
index 7a30f6789..ab23c0de8 100644
--- a/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_header_claims.test.ts
@@ -1,4 +1,9 @@
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
 import { describe, expect, it } from 'vitest';
+import { parse as parseYaml } from 'yaml';
 
 import { check_envelope as kernelRuleGuard } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
 import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_plumbing_writes.js';
@@ -9,9 +14,56 @@ import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_p
  * exactly those two guards, and nothing wider: the header's broader sentence,
  * that no bound `pre_tool_use` concern denies either path, was verified once by
  * sending both edits through the built dispatcher and is not automated here.
- * A new `pre_tool_use` concern therefore has to be checked against these two
- * paths by hand, and the header changed if it denies either.
+ * The last case is its trigger: the concerns bound to `pre_tool_use` in any
+ * profile are pinned, so a new one fails here until it has been checked against
+ * these two paths and added — and the header changed if it denies either.
+ */
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+
+/**
+ * Every concern bound to `pre_tool_use`, checked on 2026-10-16 against an edit of
+ * both paths. The two that can deny besides the guards are `evidence-independence`,
+ * which let both edits through the built dispatcher with the guards, and
+ * `one-question-per-ask`, which reads only the question tool. The rest are
+ * advisory in the manifest and cannot deny.
  */
+const REVIEWED_PRE_TOOL_USE = [
+    'block-config-weakening',
+    'block-kernel-rule-writes',
+    'block-no-verify',
+    'block-plumbing-writes',
+    'block-speaking-inbox-dir',
+    'chain-nudge',
+    'code-graph-context',
+    'design-slop',
+    'evidence-independence',
+    'memory-recall',
+    'one-question-per-ask',
+    'reread-guard',
+    'rtk-wrap',
+    'ship-diff-volume',
+    'source-first-gate',
+    'spawn-guard-shadow',
+    'ui-route-nudge',
+];
+
+function boundPreToolUse(): string[] {
+    const manifest: unknown = parseYaml(fs.readFileSync(path.join(REPO, 'src/scripts/hook_manifest.yaml'), 'utf8'));
+    const found = new Set<string>();
+    const walk = (node: unknown): void => {
+        if (node === null || typeof node !== 'object') return;
+        for (const [key, value] of Object.entries(node)) {
+            if (key === 'pre_tool_use' && Array.isArray(value)) {
+                for (const id of value) found.add(String(id));
+            } else {
+                walk(value);
+            }
+        }
+    };
+    walk(manifest);
+    return [...found].sort();
+}
 
 const UNGUARDED = ['src/scripts/hooks/dispatch_hook.ts', 'src/scripts/_lib/kernel_rules.ts'];
 
@@ -42,4 +94,8 @@ describe('the two guards the gate header names', () => {
             expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(true);
         }
     });
+
+    it('a pre_tool_use concern nobody checked against the two paths fails here', () => {
+        expect(boundPreToolUse()).toEqual(REVIEWED_PRE_TOOL_USE);
+    });
 });
```

Review the delta. Report any remaining defect with file:line, scenario and severity. State your stance (APPROVE or REQUEST_CHANGES).
