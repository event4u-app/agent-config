<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-the-subject-calculator-stage-2-20261016,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator-stage-2-20261016, round 4 — delta after round 3

Round 3 (prompt `agents/evidence/council/gate-the-subject-calculator-stage-2-review-r3-20261016.question.md`, reviewed `72ec820a2`): both seats REQUEST_CHANGES on one finding — the `catch` that fell back to the `--files` list alone when `base..head` did not resolve failed open (a list omitting the calculator plus an unresolvable base skipped it). Requested: remove the fallback, refuse an unresolved range, add the regression.

Disposition (`05856985b`):

- `main()` now has ONE resolution path for every run, with or without `--files`: resolve the head once (a revision that does not resolve → exit 1, as before), resolve the base once and read `changedFilesBetween(base, head)` (a base or range that cannot be read → exit 3, as the no-list path already did), and judge the union of the list and the range. The separate `--files` branch and its fallback are gone.
- Regression: an unresolvable `--base-ref` with `--files README.md` over a fixture whose only change is the calculator exits 3.
- A collateral test fix, disclosed: `tests/scripts/classify_merge_risk_needs_owner.test.ts` "every owner trigger fires on a path of its own and alone makes the verdict needs-owner" used `_lib/ratification_subject.ts` as the witness for `reviewer-trust-chain`. Now that the module is gated, that path also fires `governance-surface`, so the "alone" assertion failed. The witness moves to `_lib/merge_clearance_record.ts`, another member of the classifier's `TRUST_CHAIN_PATHS`. The separate case "the subject binding is needs-owner" still asserts the calculator itself is `needs-owner`. No assertion is weakened; one fixture path changes.
- Verification: the 13 suites that touch the ratification gate or the classifier pass (289 tests); `tsc --noEmit` passes. All earlier sensitivity probes still hold (ungating the module turns the closure and CLI tests red).

Review the delta below. For each remaining defect report file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index b2437eff7..1c939fdd2 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -781,53 +781,36 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
         }
     }
 
-    let changed: string[];
-    if (files.length > 0) {
-        // A caller's list may add paths, never hide one: where the range resolves,
-        // every path it changed is judged as well, so omitting a gated file from
-        // `--files` does not take it out of the verdict. A range that does not
-        // resolve (a fixture with no base) leaves the list as given.
-        changed = files;
-        try {
-            const commit = resolveRevision(root, revision);
-            const base = resolveRevision(root, resolveBaseRef(baseRef, root));
-            changed = [...new Set([...files, ...changedFilesBetween(root, base, commit)])];
-            revision = commit;
-            baseRef = base;
-        } catch (err) {
-            if (!(err instanceof GatedSubjectRefusal)) {
-                throw err;
-            }
-        }
-    } else {
-        // ONE resolution for the whole run. The diff, the digest and the
-        // record read all receive this id; passing the name to each would let
-        // a ref that moves between them yield a file list from one commit and
-        // a digest and record from another.
-        let commit: string;
-        try {
-            commit = resolveRevision(root, revision);
-        } catch (err) {
-            if (!(err instanceof GatedSubjectRefusal)) {
-                throw err;
-            }
-            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
-            return 1;
+    // ONE resolution for the whole run. The diff, the digest and the record read
+    // all receive this id; passing the name to each would let a ref that moves
+    // between them yield a file list from one commit and a digest and record
+    // from another.
+    let commit: string;
+    try {
+        commit = resolveRevision(root, revision);
+    } catch (err) {
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
         }
-        try {
-            // The base, too, is resolved once: the diff and the closure's base
-            // side read the same commit.
-            baseRef = resolveRevision(root, resolveBaseRef(baseRef, root));
-            changed = changedFilesBetween(root, baseRef, commit);
-        } catch (err) {
-            if (!(err instanceof GatedSubjectRefusal)) {
-                throw err;
-            }
-            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
-            return 3;
+        process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
+        return 1;
+    }
+    let changed: string[];
+    try {
+        // The base, too, is resolved once: the diff and the closure's base side
+        // read the same commit. A `--files` list may add paths to the range,
+        // never hide one, so a range that cannot be read refuses rather than
+        // falling back to the list alone.
+        baseRef = resolveRevision(root, resolveBaseRef(baseRef, root));
+        changed = [...new Set([...files, ...changedFilesBetween(root, baseRef, commit)])];
+    } catch (err) {
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
         }
-        revision = commit;
+        process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
+        return 3;
     }
+    revision = commit;
 
     const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision, baseRef);
 
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
index ed2a931e0..070563531 100644
--- a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -159,6 +159,10 @@ describe('the gate watches the modules its verdict runs through', () => {
         expect(gate.main(['--root', root, '--base-ref', base, '--quiet'])).toBe(1);
         // A list that leaves the calculator out cannot hide it either.
         expect(gate.main(['--root', root, '--base-ref', base, '--quiet', '--files', 'README.md'])).toBe(1);
+        // Nor can a base that does not resolve, which refuses instead of reading the list alone.
+        expect(
+            gate.main(['--root', root, '--base-ref', 'no-such-base', '--quiet', '--files', 'README.md']),
+        ).toBe(3);
     });
 
     it('the digest covers every mechanism file the gate classifies', () => {
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
index 29c260af1..3b5faba0e 100644
--- a/tests/scripts/classify_merge_risk_needs_owner.test.ts
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -130,7 +130,7 @@ describe('precedence of the three verdicts', () => {
         const witness: Record<string, string> = {
             'governance-surface': 'src/rules/non-destructive-by-default.md',
             'merge-authority-surface': 'src/scripts/classify_merge_risk.ts',
-            'reviewer-trust-chain': 'src/scripts/_lib/ratification_subject.ts',
+            'reviewer-trust-chain': 'src/scripts/_lib/merge_clearance_record.ts',
             'council-surface': 'src/scripts/council_cli.ts',
             'ratification-contract': 'docs/contracts/ratification-artifact.md',
             'owner-reserved-decision': 'docs/decisions/ADR-281-x.md',
```
