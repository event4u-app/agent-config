<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/gates-read-written-20261020,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/gates-read-written-20261020, round 4 — the delta after round 3

Round 3 reviewed head `18bba1df1` of `src/scripts/hooks/block_speaking_inbox_dir.ts` (a blocking `pre_tool_use` guard refusing a new speaking-named directory under `agents/tmp/`). Both seats returned `confirmed-non-expanding` with two low findings: the deny message's hint said a shell command "reaches" an existing directory only by absolute path, which describes shell resolution rather than what the guard recognizes; and the new test suite left its temporary trees behind. Both seats proposed the same replacement wording.

The delta below (head `1418c8c8a`, subject `d75ce8f4134e59e296f1224cff1105d652473148fa716cdc85e21c488cafa427` over the gated file) is the whole change since round 3: the message line replaced with the seats' wording, an assertion pinning it, and an `afterAll` that removes the two trees. No logic line changed. `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92 pass.

The decision this round asks for: whether the ratification record for this branch may name head `1418c8c8a` rather than `18bba1df1` — i.e. whether the delta changes the guard's policy or its security posture in any direction.

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
index df05d0338..d2623590f 100644
--- a/tests/hooks/block_speaking_inbox_dir.test.ts
+++ b/tests/hooks/block_speaking_inbox_dir.test.ts
@@ -19,7 +19,7 @@ import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
 
-import { describe, expect, it } from 'vitest';
+import { afterAll, describe, expect, it } from 'vitest';
 
 import {
     creatableTokens,
@@ -528,6 +528,9 @@ describe('a mention is not a creation — the commands a real round was refused'
     fs.mkdirSync(path.join(tree, inbox, speaking), { recursive: true });
     const other = mk('other');
     const absRound = path.join(tree, inbox, speaking);
+    afterAll(() => {
+        for (const dir of [tree, other]) fs.rmSync(dir, { recursive: true, force: true });
+    });
 
     const run = (envelope: unknown): number => {
         setHookStdinOverride(JSON.stringify(envelope));
@@ -576,6 +579,7 @@ describe('a mention is not a creation — the commands a real round was refused'
         });
         it('the deny message tells the operator to encrypt the source, not a path', () => {
             expect(denyMessage(speaking)).toContain('never an agents/tmp path');
+            expect(denyMessage(speaking)).toContain('this guard recognizes it in shell commands');
         });
     });
 
```
