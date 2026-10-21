<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/gates-that-read-20261021,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/gates-that-read-20261021 — the deny-message wording of the speaking-inbox guard

`src/scripts/hooks/block_speaking_inbox_dir.ts` is a blocking `pre_tool_use` guard that refuses creating a speaking-named directory under `agents/tmp/`. Its current logic on `main` was reviewed on 2026-10-20 (round 3, head `18bba1df1`, both seats `confirmed-non-expanding`). That round raised a low finding: the deny message's hint said a shell command "reaches" an existing directory only by absolute path, which describes shell resolution rather than what the guard recognizes. A follow-up round on 2026-10-20 did not reach quorum, so the change was not landed.

The diff below is the whole change on this branch against `origin/main` (head `ae1133533`; `ratification_subject` over the gated file: `d75ce8f4134e59e296f1224cff1105d652473148fa716cdc85e21c488cafa427`). It replaces two lines of the deny message and adds test assertions. `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92 pass; the new assertion was observed failing before the message change.

The decision this round asks for: whether this change alters what the guard allows or refuses, or its security posture, in any direction — i.e. which ratification verdict applies to the branch.

Review the delta. Report any defect with file:line, scenario and severity; say whether it changes what the guard allows or refuses; and give a final verdict from exactly one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`.

```diff
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index a53ce909c..7fbd616b1 100644
--- a/src/scripts/hooks/block_speaking_inbox_dir.ts
+++ b/src/scripts/hooks/block_speaking_inbox_dir.ts
@@ -368,8 +368,9 @@ export function denyMessage(dir: string): string {
         'itself (its URL or name), never an agents/tmp path, which this guard judges:\n' +
         "  printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt\n" +
         '\n' +
-        'Already created? Rename it. Until then a shell command reaches it only by its\n' +
-        'absolute path: a relative one may land anywhere, so it is judged as new.\n' +
+        'Already created? Rename it. Until then, this guard recognizes it in shell commands\n' +
+        'only when referenced by absolute path; relative arguments may resolve elsewhere\n' +
+        'and are judged as new.\n' +
         '\n' +
         'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n' +
         `Maintainer kill switch: ${KILL_SWITCH}=1.\n`
diff --git a/tests/hooks/block_speaking_inbox_dir.test.ts b/tests/hooks/block_speaking_inbox_dir.test.ts
index 591202641..5ac9eac12 100644
--- a/tests/hooks/block_speaking_inbox_dir.test.ts
+++ b/tests/hooks/block_speaking_inbox_dir.test.ts
@@ -579,6 +579,10 @@ describe('a mention is not a creation — the commands a real round was refused'
         });
         it('the deny message tells the operator to encrypt the source, not a path', () => {
             expect(denyMessage(speaking)).toContain('never an agents/tmp path');
+            expect(denyMessage(speaking)).toContain(
+                'this guard recognizes it in shell commands\nonly when referenced by absolute path',
+            );
+            expect(denyMessage(speaking)).not.toContain('reaches it only by its');
         });
     });
 
```
