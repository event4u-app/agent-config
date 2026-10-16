<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/subject-calculator-strippable-20261016,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/subject-calculator-strippable-20261016, round 1 — restore the strippable subject calculator

Context, from the tree:

- #2375 (council-reviewed, round 9 approved 2/2) refactored `src/scripts/_lib/ratification_subject.ts`: its three refusal classes declare their fields instead of using TypeScript parameter properties, because the danger gate's base classifier runs under `node --experimental-strip-types`, which cannot carry a parameter property. That blob is `176f6532…`.
- A merge carried that refactor past a pin that still named the earlier blob `3842d915…`; to unblock main, #2383 restored `3842d915…` (council Option A, 2/2). The danger gate's base classifier then fell back to `tsx`, and #2384 skipped one #2375 test — "where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change" — exactly while the module was blob `3842d915…`. The owner accepted that window.
- #2386 (council, four rounds, 2/2) gated the module and retired the pin.

This change, the last step:

- sets `src/scripts/_lib/ratification_subject.ts` to blob `176f6532…` — byte-identical to #2375's reviewed refactor; the diff is +12/−13 lines in three constructors;
- removes the blob-keyed skip from `tests/scripts/classify_merge_risk_base_revision.test.ts`, so that test runs again whenever node supports type stripping (its original `skipIf(!STRIP_TYPES)`).

Measured at `830b5b037`: `classify_merge_risk_base_revision` and the ratification-subject and gate suites pass (7 files, 129 tests), the restored strip-types test included. The subject digest is `a2bcf5e882e6a117c7e683a77b01855f8676c778964a1fac7b9e707f899bbd69` from BOTH the head's gate and the base revision's gate (current main), covering `src/scripts/_lib/ratification_subject.ts`.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the refactored classes behave identically for everything the gate and the digest read from them; whether removing the skip restores the test exactly; and whether anything else still depends on the parameter-property form. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 3842d9152..176f6532c 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -85,11 +85,11 @@ const MAX_BLOB_BYTES = 32 * 1024 * 1024;
  * repository.
  */
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
@@ -116,12 +116,11 @@ export class GatedPathEscapes extends GatedSubjectRefusal {
  * Raised when a gated path's tree entry is not absent and not a regular file.
  */
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
@@ -132,15 +131,15 @@ export class GatedPathUnsupported extends GatedSubjectRefusal {
  * would be read as an option.
  */
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
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index a518adfa3..7162e1051 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -265,19 +265,6 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
 const STRIP_TYPES =
     spawnSync('node', ['--experimental-strip-types', '--no-warnings', '-e', ''], { encoding: 'utf8' }).status === 0;
 
-/**
- * The one blob of `_lib/ratification_subject.ts` that type stripping cannot run: it
- * declares parameter properties. While the base carries it the block takes the
- * no-strip branch, which the residual tests below cover; any other blob runs the
- * strip-types test again, so the skip ends on its own when the module changes.
- */
-const UNSTRIPPABLE_SUBJECT_BLOB = '3842d91528ec5229819dbd0da2f1a67a1f0eb06c';
-const SUBJECT_UNSTRIPPABLE =
-    spawnSync('git', ['hash-object', '--', 'src/scripts/_lib/ratification_subject.ts'], {
-        cwd: REPO,
-        encoding: 'utf8',
-    }).stdout.trim() === UNSTRIPPABLE_SUBJECT_BLOB;
-
 /** A `node` on PATH that refuses type stripping, so the block must fall back to the checkout's runtime. */
 function nodeShimWithoutStripTypes(): string {
     const dir = path.join(work, 'node-shim');
@@ -348,10 +335,7 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
         expect(r.code).not.toBe(0);
     }, 60_000);
 
-    // While the base carries the unstrippable blob, a gated change bundled with a
-    // manifest change under a poisoned runtime reaches needs-council, not needs-owner —
-    // an accepted, temporary weakening that ends when the module changes.
-    it.skipIf(!STRIP_TYPES || SUBJECT_UNSTRIPPABLE)(
+    it.skipIf(!STRIP_TYPES)(
         'where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change',
         () => {
             const head = commitOn('dep-bump-and-kernel-rule', base, {
```
