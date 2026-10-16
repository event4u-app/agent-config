<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/restore-pinned-subject-calculator-20261016,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/restore-pinned-subject-calculator-20261016, round 1 — move a pending-mechanism pin

Context, from the tree:

- `src/scripts/check_kernel_edit_ratified.ts` carries `PENDING_MECHANISM_PINS`, the Git blob each not-yet-gated mechanism module must still be. `pinViolations` compares a pinned module present at the head commit to its pin whatever the diff names, and refuses on a mismatch. It was introduced by #2379 (`a10aa16a1`, stage 1 of 2), which pinned `src/scripts/_lib/ratification_subject.ts` to blob `3842d91528ec5229819dbd0da2f1a67a1f0eb06c` — the blob that #2379's council round 5 reviewed at `4b1e3f15a`.
- Before #2379 merged, its branch merged `origin/main` (`c18297eeb`). Main then carried #2375 (`85d00e56a`), which changed the same module: three exception classes declare their fields (`readonly rel: string;` plus an assignment) instead of using TypeScript parameter properties, because the danger gate now runs the base classifier with `node --experimental-strip-types` and type stripping cannot carry a parameter property. #2375's council round 5 (`agents/evidence/council/danger-gate-review-r5-20261015.question.md`) had this module in scope; round 9 approved 2/2.
- After the merge the module on main is blob `176f6532cbb2a9c60492e9aceecf39021d691f69` while the pin still names `3842d915…`. The difference between the two blobs is exactly #2375's refactor (+12/−13 lines, no behavioural change claimed). Every run of the gate on any diff now refuses on the pin, which blocks every pre-push.
- The owner chose, 2026-10-16, to move the pin to the blob main holds rather than revert the module (a revert would reintroduce parameter properties and push the danger gate off its node-only path). Stage 2 of #2379's plan still gates the module and removes its pin.

The change (complete; one file):

```diff
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -162,7 +162,7 @@ export const MECHANISM_IMPORT_PATHS: readonly string[] = [
  * file, which needs a record. The change that gates the module removes its pin.
  */
 export const PENDING_MECHANISM_PINS: Readonly<Record<string, string>> = {
-    'src/scripts/_lib/ratification_subject.ts': '3842d91528ec5229819dbd0da2f1a67a1f0eb06c',
+    'src/scripts/_lib/ratification_subject.ts': '176f6532cbb2a9c60492e9aceecf39021d691f69',
 };
```

The diff between the old and the new pinned blob, for reference:

```diff
@@ -85,11 +85,11 @@
 export class GatedSubjectRefusal extends Error {
-    constructor(
-        readonly rel: string,
-        message: string,
-    ) {
+    readonly rel: string;
+
+    constructor(rel: string, message: string) {
         super(message);
+        this.rel = rel;
         this.name = 'GatedSubjectRefusal';
     }
 }
@@ -116,12 +116,11 @@
 export class GatedPathUnsupported extends GatedSubjectRefusal {
-    constructor(
-        rel: string,
-        readonly kind: string,
-        why: string,
-    ) {
+    readonly kind: string;
+
+    constructor(rel: string, kind: string, why: string) {
         super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than describing it`);
+        this.kind = kind;
         this.name = 'GatedPathUnsupported';
     }
 }
@@ -132,15 +131,15 @@
 export class GatedRevisionUnresolved extends GatedSubjectRefusal {
-    constructor(
-        readonly revision: string,
-        detail: string,
-    ) {
+    readonly revision: string;
+
+    constructor(revision: string, detail: string) {
         super(
             '',
             `revision \`${revision}\` does not resolve to a commit (${detail}) — the digest is ` +
                 'taken over a commit and refuses rather than guessing which one',
         );
+        this.revision = revision;
         this.name = 'GatedRevisionUnresolved';
     }
 }
```

Measured at `aea2db8be`: `git hash-object src/scripts/_lib/ratification_subject.ts` = `176f6532…`; `tests/scripts/check_kernel_edit_ratified.test.ts` and `…_mechanism_closure.test.ts` pass (38 tests). The gate's subject digest for this diff is `650802bc54cc6a001f44740d74c9efd53f138b0b293b2b2d4d96b86c75a30c37` (covers only `check_kernel_edit_ratified.ts`).

Review the change. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the new pinned content differs in behaviour from the reviewed one in any way the gate's verdict depends on; whether moving the pin rather than reverting weakens what the pin was introduced to guarantee; and whether anything else must change with it. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.
