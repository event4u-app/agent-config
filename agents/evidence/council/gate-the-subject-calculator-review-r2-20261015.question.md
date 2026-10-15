<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/gate-the-subject-calculator,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator, round 2 — stage 1 of a staged widening of the ratification gate's mechanism set

`src/scripts/check_kernel_edit_ratified.ts` refuses a diff touching kernel rules, governance hooks, hook plumbing or the ratification mechanism itself unless a committed ratification record carries a `subject:` digest equal to the digest of the diff's gated content. CI runs the BASE revision's copy of the gate with `--root <head>`; the pre-push hook, `task ci` and the `ratification_subject` writer CLI run the head's copy.

Round 1 (prompt and both seats' texts: `agents/evidence/council/gate-the-subject-calculator-review*.md`) reviewed a one-PR version that added four imported modules to the mechanism set, including `_lib/ratification_subject.ts`, and edited that module in the same diff. Both seats requested changes: such a diff is digested over different files by the base gate (which does not watch the module) and the head gate (which does), so the module's content is not bound by the record CI checks; the proposed two-record bootstrap did not close that. One seat also asked for the writer CLIs and the contract document to be gated, citing docs/contracts/ratification-artifact.md § "When the user decides", condition 4.

Owner decision, 2026-10-15 (recorded under that condition 4): stage the change in two PRs; the writer CLIs (`src/scripts/ratification_subject.ts`, `src/scripts/ratification_header.ts`) and the contract stay OUT of the gated set. The target mechanism set after both stages adds `_lib/ratification_subject.ts`, `_lib/adr_frontmatter.ts`, `_lib/gate_ledger.ts`, `_lib/scan_scope.ts` to what is already gated.

This diff is stage 1:
- `MECHANISM_IMPORT_PATHS` = `_lib/adr_frontmatter.ts` (parses the record header, verdict included), `_lib/gate_ledger.ts` (called inside `evaluate`), `_lib/scan_scope.ts` (`reportScanned`, called in `main` before the exit code is returned). `_lib/ratification_subject.ts` is deliberately NOT in it yet.
- `isMechanismPath` is exported and is the single membership predicate. `_lib/ratification_subject.ts` stops re-assembling its own `selfSet` from the gate's constants and filters through `isMechanismPath` instead, so the digest covers exactly what the gate classifies as mechanism.
- The ledger counts every mechanism file in the diff as gated; before, only the gate file was, and the others were reported `out_of_scope`.
- One existing test used `_lib/gate_ledger.ts` as an example of a `_lib` module that is neither plumbing nor gated; it is replaced by `_lib/link_crypto.ts`, the assertion unchanged.

Stage 2, a separate later PR after stage 1 merges, edits only the gate and tests: it adds `_lib/ratification_subject.ts` to `MECHANISM_IMPORT_PATHS` and adds a test walking the gate's static import closure.

Measured on this branch (commit `6fbe358da`): the base gate (main at `f998ea3b5`, run from a detached worktree with `--root <head>`) and the head gate both digest exactly one file, `src/scripts/check_kernel_edit_ratified.ts`, and print the same subject `9f1bc100aa1f61d101332caaf06ed7a91371a387166dee010837f0263198377a`. The new suite failed 4 of 5 on the pre-change code (the three modules unclassified, `evaluate` exiting 0 on an `adr_frontmatter.ts`-only diff, the digest not covering them, the ledger reporting `out_of_scope 2`) and passes after; the eleven existing ratification, kernel-edit, platform-anchor and merge-risk suites pass.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether this stage-1 diff's own content is fully bound by the record CI checks, given that `_lib/ratification_subject.ts` is edited but not yet gated; whether replacing `selfSet` with `isMechanismPath` changes which files any existing diff digests (narrows or widens the digest relative to the base); whether the call-time use of `isMechanismPath` across the import cycle is safe; whether the ledger edit or the replaced test example weakens anything that judges the change; and whether any module whose change can alter this gate's verdict is left outside the target set after stage 2, other than the owner-excluded writers and contract. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: nothing of the changed source and test files is omitted — the diff below is complete (4 files, 12,010 bytes). Not shown: the round-1 evidence files committed beside it (prose, ungated), the unchanged remainder of the two source files, the CI workflow step (unchanged), and the test helper `tests/scripts/ratification_git_fixture.ts` (unchanged; it initialises and commits a fixture repository with hooks and signing disabled).

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 469316ae3..3842d9152 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -6,14 +6,17 @@
  * gated file edited after its review would still ship under a record that
  * approved something else.
  *
- * WHY IT RE-ASSEMBLES THE LIST RATHER THAN RE-DECIDING IT. The gate's
- * `classifyPaths` returns the kernel rules, hooks and plumbing by name but
- * reports the self surface as a BOOLEAN, so that part of the gated list cannot
- * be read back out of it. This module therefore imports the gate's own path
- * constants and re-assembles — it never restates the membership rule, because
- * a second definition of "gated" is a second thing to keep in step, and the
- * first time the two diverged a file would be reviewed by one and digested by
- * the other.
+ * WHY IT ASKS THE GATE RATHER THAN RE-DECIDING IT. The gate's `classifyPaths`
+ * returns the kernel rules, hooks and plumbing by name but reports the self
+ * surface as a BOOLEAN, so that part of the gated list cannot be read back out
+ * of it. This module therefore filters the changed files through the gate's own
+ * `isMechanismPath` — it never restates the membership rule, because a second
+ * definition of "gated" is a second thing to keep in step, and the first time
+ * the two diverged a file would be reviewed by one and digested by the other.
+ * Asking the predicate means a path the gate adds to its mechanism set is
+ * digested with no edit here. It is called per file, never at module scope,
+ * because the two modules import each other and the gate's constants are not
+ * initialised while this one evaluates.
  *
  * WHAT IT READS: GIT OBJECTS AT A NAMED REVISION, NEVER THE WORKING TREE. The
  * revision is resolved to a commit, each gated path is looked up in that
@@ -42,15 +45,7 @@
 import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
 import { createHash } from 'node:crypto';
 
-import {
-    ANCHOR_PATHS,
-    CLOSURE_READER_PATH,
-    POLICY_PATH,
-    READER_PATH,
-    SELF_PATH,
-    WORKFLOW_PATH,
-    classifyPaths,
-} from '../check_kernel_edit_ratified.js';
+import { classifyPaths, isMechanismPath } from '../check_kernel_edit_ratified.js';
 
 /** The revision a digest is taken at when the caller names none. */
 export const DEFAULT_REVISION = 'HEAD';
@@ -461,31 +456,6 @@ export function treeAtRevision(root: string, commit: string): { read(rel: string
     };
 }
 
-/**
- * The self surface, by the gate's own constants rather than a copy of them.
- *
- * READ ON FIRST CALL, NOT AT MODULE SCOPE, because of the import cycle: the
- * gate imports {@link subjectOf} and this module imports the gate's path
- * constants, so whichever of the two Node evaluates second sees the other
- * half-evaluated, and a module-scope `new Set([SELF_PATH, …])` would throw on
- * the temporal dead zone.
- */
-let selfSetCache: ReadonlySet<string> | null = null;
-
-function selfSet(): ReadonlySet<string> {
-    if (selfSetCache === null) {
-        selfSetCache = new Set<string>([
-            SELF_PATH,
-            READER_PATH,
-            CLOSURE_READER_PATH,
-            POLICY_PATH,
-            WORKFLOW_PATH,
-            ...ANCHOR_PATHS,
-        ]);
-    }
-    return selfSetCache;
-}
-
 /**
  * The gated subset of a changed-file list: sorted, deduplicated, and stable
  * against the order the caller happened to collect the paths in.
@@ -497,9 +467,8 @@ export function gatedFilesOf(
     const normalized = files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== '');
     const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
     const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
-    const self = selfSet();
     for (const f of normalized) {
-        if (self.has(f)) out.add(f);
+        if (isMechanismPath(f)) out.add(f);
     }
     const sorted = [...out].sort();
     for (const rel of sorted) {
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 3c4f22f72..bf0e6b37f 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -129,6 +129,27 @@ export const READER_PATH = 'src/scripts/_lib/ratification_artifact.ts';
  */
 export const CLOSURE_READER_PATH = 'src/scripts/_lib/dispatch_import_closure.ts';
 
+/**
+ * Modules of this gate's static import closure that run inside the verdict, so
+ * an edit to one is an edit to the gate:
+ *
+ *   - `_lib/adr_frontmatter.ts` parses the record's header, verdict included;
+ *   - `_lib/gate_ledger.ts` and `_lib/scan_scope.ts` run before the exit code is
+ *     returned, so either could end the process first.
+ *
+ * `_lib/kernel_rules.ts` is already gated as plumbing. `_lib/ratification_subject.ts`,
+ * which computes the digest, joins in a separate change: one that gates it and
+ * edits it at once is digested over different files by the base revision's
+ * gate and by its own, so no single record answers for both. The writer CLIs
+ * and the contract stay outside by owner decision (2026-10-15): the gate does
+ * not import them, recomputes the digest and reads only the record.
+ */
+export const MECHANISM_IMPORT_PATHS: readonly string[] = [
+    'src/scripts/_lib/adr_frontmatter.ts',
+    'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/scan_scope.ts',
+];
+
 /** The in-repo quorum policy. Present on every runner; absent means refuse. */
 export const POLICY_PATH = 'src/config/ratification-policy.json';
 
@@ -320,6 +341,22 @@ export interface GatedPaths {
     self: boolean;
 }
 
+/**
+ * True for a file of the ratification mechanism itself — the one list both the
+ * classification and the subject digest read.
+ */
+export function isMechanismPath(p: string): boolean {
+    return (
+        p === SELF_PATH ||
+        p === READER_PATH ||
+        p === CLOSURE_READER_PATH ||
+        p === POLICY_PATH ||
+        p === WORKFLOW_PATH ||
+        ANCHOR_PATHS.includes(p) ||
+        MECHANISM_IMPORT_PATHS.includes(p)
+    );
+}
+
 /** Partition a changed-file list into the surfaces this gate watches. */
 export function classifyPaths(
     files: readonly string[],
@@ -335,14 +372,7 @@ export function classifyPaths(
         if (p === '') {
             continue;
         }
-        if (
-            p === SELF_PATH ||
-            p === READER_PATH ||
-            p === CLOSURE_READER_PATH ||
-            p === POLICY_PATH ||
-            p === WORKFLOW_PATH ||
-            ANCHOR_PATHS.includes(p)
-        ) {
+        if (isMechanismPath(p)) {
             self = true;
             continue;
         }
@@ -527,7 +557,7 @@ export function evaluate(
         ...gated.kernelRules,
         ...gated.governanceHooks,
         ...gated.plumbing,
-        ...(gated.self ? [SELF_PATH] : []),
+        ...files.map((f) => f.replace(/\\/g, '/').trim()).filter(isMechanismPath),
     ]);
     const artifactSet = new Set(ratificationArtifactsIn(files));
     for (const target of ledger.unaccountedTargets()) {
@@ -609,7 +639,7 @@ export function evaluate(
         ...gated.kernelRules.map((p) => `kernel rule ${p}`),
         ...gated.governanceHooks.map((p) => `governance hook ${p}`),
         ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
-        ...(gated.self ? ['the ratification mechanism itself (gate, reader, policy or workflow)'] : []),
+        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
     ];
     lines.push(`Gated surfaces in this diff (${touched.length}):`);
     for (const t of touched) {
diff --git a/tests/scripts/check_kernel_edit_ratified.test.ts b/tests/scripts/check_kernel_edit_ratified.test.ts
index 7bfb4418d..6bd5f357c 100644
--- a/tests/scripts/check_kernel_edit_ratified.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified.test.ts
@@ -222,8 +222,11 @@ describe('classifyPaths', () => {
      * basenames outside the directories that make them plumbing.
      */
     it('does NOT match a neighbour of the served set', () => {
+        // `_lib/gate_ledger.ts` stood here until the gate's own imports joined
+        // the mechanism set; it is gated as the mechanism now, so another
+        // `_lib` module that is neither takes its place.
         for (const p of [
-            'src/scripts/_lib/gate_ledger.ts',
+            'src/scripts/_lib/link_crypto.ts',
             'src/scripts/_lib/host_capability.ts',
             'src/scripts/hooks/hook_stdin.ts',
             'src/scripts/hooks/table_fingerprint.ts',
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
new file mode 100644
index 000000000..70ffa2cc7
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -0,0 +1,81 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
+import {
+    classifyPaths,
+    MECHANISM_IMPORT_PATHS,
+    READER_PATH,
+    requiresRatification,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
+import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * The gate's verdict runs through the modules it imports: the record parser,
+ * the ledger and the scan report. An edit to one is an edit to the gate.
+ */
+
+const IMPORTED = [
+    'src/scripts/_lib/adr_frontmatter.ts',
+    'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/scan_scope.ts',
+];
+
+let root: string;
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-mech-'));
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('the gate watches the modules its verdict runs through', () => {
+    it('each imported module requires a ratification record', () => {
+        for (const p of IMPORTED) {
+            expect(MECHANISM_IMPORT_PATHS, p).toContain(p);
+            expect(classifyPaths([p], []).self, p).toBe(true);
+            expect(requiresRatification(classifyPaths([p], [])), p).toBe(true);
+        }
+    });
+
+    it('refuses an unratified edit of the record parser end to end', () => {
+        const rel = 'src/scripts/_lib/adr_frontmatter.ts';
+        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
+        fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
+        commitAll(root);
+        const r = gate.evaluate([rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('no ratification artifact');
+    });
+
+    it('the digest covers every mechanism file the gate classifies', () => {
+        for (const p of [...IMPORTED, READER_PATH]) {
+            expect(gatedFilesOf([p, 'README.md'], []), p).toEqual([p]);
+        }
+    });
+
+    it('the writer CLIs and the contract stay ungated', () => {
+        for (const p of [
+            'src/scripts/ratification_subject.ts',
+            'src/scripts/ratification_header.ts',
+            'docs/contracts/ratification-artifact.md',
+        ]) {
+            expect(requiresRatification(classifyPaths([p], [])), p).toBe(false);
+            expect(gatedFilesOf([p], []), p).toEqual([]);
+        }
+    });
+
+    it('the ledger counts a gated mechanism file as gated, not out of scope', () => {
+        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
+        commitAll(root);
+        const r = gate.evaluate([READER_PATH, 'README.md'], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('out_of_scope 1');
+    });
+});
```
