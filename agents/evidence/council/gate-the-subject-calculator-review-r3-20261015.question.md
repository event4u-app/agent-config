<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/gate-the-subject-calculator,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator, round 3 — delta after round 2 on stage 1

Round 2 (prompt `agents/evidence/council/gate-the-subject-calculator-review-r2-20261015.question.md`, reviewed commit `59f504d8d`) asked both seats to review stage 1 of a staged widening of `check_kernel_edit_ratified`'s mechanism set. Both requested changes. This round shows what changed since and how each finding was disposed; the stage-1 diff reviewed in round 2 is otherwise unchanged.

Findings and dispositions:

1. HIGH (both seats) — `_lib/ratification_subject.ts` is edited in this diff (its `selfSet` replaced by the gate's `isMechanismPath`) and is gated by neither the base nor the head gate, so the record CI checks does not commit to its bytes.
   - Disposition: NOT changed in code. Facts: every earlier edit of this module was equally unbound (PR #2376's record names it as an open gap); no ordering of the remaining edits binds it inside the existing mechanism, because the base calculator's own self list does not contain that path, so whichever PR first gates it is digested without its bytes by the base gate. The owner decided (2026-10-15, under docs/contracts/ratification-artifact.md § "When the user decides", condition 4) to stage the change and accept this. The record for this PR will carry, in its body, an attestation of the exact blob reviewed: `src/scripts/_lib/ratification_subject.ts` at the reviewed commit is git blob `3842d91528ec5229819dbd0da2f1a67a1f0eb06c` (at the base `e789a13f8` it is `469316ae3d94642db560531413567bd06c467425`). The stage-2 record is to state, verified with `git rev-parse <stage-2 base>:src/scripts/_lib/ratification_subject.ts`, that the blob it builds on is this attested one. This attestation is checked by people, not by CI.
2. MEDIUM/HIGH (both) — the member test repeated the production list and could not prove closure completeness. Disposition: the suite now walks the gate's static relative imports from the checkout (comments stripped, a dynamic `import(` anywhere in the closure fails the test), and requires every reached module to be gated and covered by the digest, except an explicitly named `PENDING` list holding exactly `_lib/ratification_subject.ts`; the ungated remainder must EQUAL that list, so stage 2 has to empty it. Sensitivity checked: commenting `_lib/scan_scope.ts` out of `MECHANISM_IMPORT_PATHS` fails 3 of 6 tests, restored afterwards.
3. MEDIUM (both) — the ledger test used `READER_PATH`, already a mechanism file. Note: on the pre-change code that test did fail (`out_of_scope 2`, because the old ledger only counted the gate file). Disposition: it now also runs on `_lib/gate_ledger.ts` and asserts the full ledger line `planned 2 · completed 0 · failed 1 · out_of_scope 1`.
4. LOW — the gate comment could be read as the writer CLI joining in stage 2. Disposition: it now names `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts` as the writer CLIs that stay outside.
5. Cycle-safety comment: unchanged; the `_lib/ratification_subject.ts` header already states the predicate is called per file, never at module scope.

Measured at the new head (`7afc062c3`): base gate and head gate both still digest exactly `src/scripts/check_kernel_edit_ratified.ts`; the eleven related suites, `tsc --noEmit`, eslint and `lint_code_comments` pass.

Review the delta below together with the disposition of finding 1. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the closure walk can still miss a module the verdict runs through; whether the `PENDING` equality can pass while a module is ungated; whether the blob attestation, given it is not CI-enforced, leaves a gap that a different change inside the owner's decision would close; and whether anything in the delta weakens what judges the change. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: the delta below is complete for source and tests (2 files, 5,038 bytes). Not shown: the round-1 evidence files committed on the branch (prose, ungated), and the stage-1 diff reviewed in round 2, which is unchanged apart from this delta.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index bf0e6b37f..45235e0fa 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -141,6 +141,7 @@ export const CLOSURE_READER_PATH = 'src/scripts/_lib/dispatch_import_closure.ts'
  * which computes the digest, joins in a separate change: one that gates it and
  * edits it at once is digested over different files by the base revision's
  * gate and by its own, so no single record answers for both. The writer CLIs
+ * `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts`
  * and the contract stay outside by owner decision (2026-10-15): the gate does
  * not import them, recomputes the digest and reads only the record.
  */
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
index 70ffa2cc7..37fce61d6 100644
--- a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -1,6 +1,7 @@
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
 
 import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 
@@ -10,7 +11,9 @@ import {
     MECHANISM_IMPORT_PATHS,
     READER_PATH,
     requiresRatification,
+    SELF_PATH,
 } from '../../src/scripts/check_kernel_edit_ratified.js';
+import { relativeSpecifiers } from '../../src/scripts/_lib/dispatch_import_closure.js';
 import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
 import { commitAll } from './ratification_git_fixture.js';
 
@@ -25,6 +28,38 @@ const IMPORTED = [
     'src/scripts/_lib/scan_scope.ts',
 ];
 
+/**
+ * The one module of the closure not gated yet. It is edited in the change that
+ * routes its digest through `isMechanismPath`, and a change that gates a file
+ * while editing it is digested differently by the base gate and its own, so it
+ * joins in the next change, which removes it from here.
+ */
+const PENDING = ['src/scripts/_lib/ratification_subject.ts'];
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+
+/** Repo-relative paths of every module reachable from the gate by relative static imports. */
+function gateImportClosure(): string[] {
+    const seen = new Set<string>();
+    const queue = [SELF_PATH];
+    while (queue.length > 0) {
+        const rel = queue.shift() as string;
+        if (seen.has(rel)) continue;
+        seen.add(rel);
+        const source = fs.readFileSync(path.join(REPO, rel), 'utf8');
+        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
+        expect(code, `${rel} uses a dynamic import the walk cannot follow`).not.toMatch(/\bimport\s*\(/);
+        for (const spec of relativeSpecifiers(source)) {
+            const target = path.posix.normalize(
+                path.posix.join(path.posix.dirname(rel), spec).replace(/\.js$/, '.ts'),
+            );
+            expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec}`).toBe(true);
+            queue.push(target);
+        }
+    }
+    return [...seen].sort();
+}
+
 let root: string;
 
 beforeEach(() => {
@@ -44,6 +79,17 @@ describe('the gate watches the modules its verdict runs through', () => {
         }
     });
 
+    it('every module the gate imports is gated and digested, except the named pending one', () => {
+        const closure = gateImportClosure();
+        expect(closure).toContain(READER_PATH);
+        for (const p of IMPORTED) expect(closure, p).toContain(p);
+        const ungated = closure.filter((m) => !requiresRatification(classifyPaths([m], [])));
+        expect(ungated).toEqual(PENDING);
+        for (const m of closure.filter((x) => !PENDING.includes(x))) {
+            expect(gatedFilesOf([m], []), m).toEqual([m]);
+        }
+    });
+
     it('refuses an unratified edit of the record parser end to end', () => {
         const rel = 'src/scripts/_lib/adr_frontmatter.ts';
         fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
@@ -74,8 +120,10 @@ describe('the gate watches the modules its verdict runs through', () => {
     it('the ledger counts a gated mechanism file as gated, not out of scope', () => {
         fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
         commitAll(root);
-        const r = gate.evaluate([READER_PATH, 'README.md'], root, 2);
-        expect(r.exitCode).toBe(1);
-        expect(r.lines.join('\n')).toContain('out_of_scope 1');
+        for (const p of [READER_PATH, 'src/scripts/_lib/gate_ledger.ts']) {
+            const r = gate.evaluate([p, 'README.md'], root, 2);
+            expect(r.exitCode, p).toBe(1);
+            expect(r.lines.join('\n'), p).toContain('planned 2 · completed 0 · failed 1 · out_of_scope 1');
+        }
     });
 });
```
