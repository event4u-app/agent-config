<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/gate-the-subject-calculator,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator — the ratification gate's own imports join its watched set

`src/scripts/check_kernel_edit_ratified.ts` refuses a diff touching kernel rules, governance hooks, hook plumbing or the ratification mechanism itself unless a committed ratification record carries a `subject:` digest equal to the digest of the diff's gated content. CI runs the BASE revision's copy of the gate with `--root <head>`; the pre-push hook, `task ci` and the `ratification_subject` writer CLI run the head's copy.

Before this change the mechanism set was: the gate file, `_lib/ratification_artifact.ts` (record reader), `_lib/dispatch_import_closure.ts`, `src/config/ratification-policy.json`, `.github/workflows/consistency.yml`, and the three platform-anchor files. `_lib/kernel_rules.ts` is gated as plumbing.

The gate's full static relative-import closure is: `_lib/gate_ledger.ts`, `_lib/dispatch_import_closure.ts`, `_lib/kernel_rules.ts`, `_lib/scan_scope.ts`, `_lib/ratification_artifact.ts`, `_lib/adr_frontmatter.ts` (imported by the reader), `_lib/ratification_subject.ts`. Four of these were not gated: `_lib/ratification_subject.ts` (computes the digest, decides which files it covers via `gatedFilesOf`/`selfSet`, lists the diff, reads the record blob), `_lib/adr_frontmatter.ts` (parses the record header, including `verdict`, `providers`, `subject`), `_lib/gate_ledger.ts` (called inside `evaluate`), `_lib/scan_scope.ts` (`reportScanned`, called in `main` before the exit code is returned). This change adds those four as `MECHANISM_IMPORT_PATHS`, classifies them as the mechanism, adds them to the digest's self set, and adds a test that walks the gate's imports from the checkout and fails when any reached module is not gated or not covered by the digest.

Considered and NOT added, with the reason: the writer CLIs `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts` (the gate does not import them; it recomputes the digest and reads only the record, so a wrong writer yields a record the gate refuses); `docs/contracts/ratification-artifact.md` (prose, not read at run time); `taskfiles/ci-fast.yml` and `scripts-run` (local invocation only, CI runs the base copy through `npx tsx`); `node_modules` / `tsx` (third-party). `gate_ledger.ts` and `scan_scope.ts` are shared by many other gates (2 commits each in the last three months); `adr_frontmatter.ts` is the shared ADR reader (4 commits in that window). After this change an edit to any of them carries a ratification record.

Two further edits in the diff: the ledger previously counted only the gate file as gated and reported the other mechanism files as `out_of_scope`; it now counts every mechanism file in the diff as gated. One existing test used `_lib/gate_ledger.ts` as an example of a `_lib` module that is neither plumbing nor gated; that example is replaced by `_lib/link_crypto.ts`, the assertion itself unchanged.

Red before the change, green after: the new suite failed 4 of 5 on the pre-change code (a diff of only `_lib/ratification_subject.ts` was classified ungated and `evaluate` exited 0 "nothing to ratify"; the closure walk failed first on `_lib/adr_frontmatter.ts`; the ledger reported `out_of_scope 2`), and passes after. The ten existing ratification and kernel-edit suites and `classify_merge_risk` pass.

Bootstrap fact: this diff edits `_lib/ratification_subject.ts`, which the base gate does not gate and the head gate does. The base gate's digest covers one file (`check_kernel_edit_ratified.ts`, subject `1daf72f9…`), the head gate's covers two (subject `1cfcac36…`). No single record satisfies both; the plan is to commit two records from this one review, each naming which gate's digest it carries, since the gate passes when any record in the diff validates.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any module whose change can alter this gate's verdict is still outside the watched set, or whether anything was added that cannot; whether the import-walk test can miss an import (dynamic `import()`, a re-export, a non-relative specifier); whether the ledger edit or the replaced test example weakens anything that judges the change; whether the two-record bootstrap lets anything through that one record would not; and whether this change falls under docs/contracts/ratification-artifact.md § "When the user decides", condition 4 ("the change is to the reviewer itself — the modules that compute the record's subject, write the record, ask the questions and derive the verdict, and this contract"). State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: nothing of the changed files is omitted — the diff below is complete (4 files, 9,843 bytes). Not shown: the unchanged remainder of the two source files, the CI workflow step (unchanged), and the test helper `tests/scripts/ratification_git_fixture.ts` (unchanged; it initialises and commits a fixture repository with hooks and signing disabled).

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 469316ae3..a00ffc99b 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -45,6 +45,7 @@ import { createHash } from 'node:crypto';
 import {
     ANCHOR_PATHS,
     CLOSURE_READER_PATH,
+    MECHANISM_IMPORT_PATHS,
     POLICY_PATH,
     READER_PATH,
     SELF_PATH,
@@ -481,6 +482,7 @@ function selfSet(): ReadonlySet<string> {
             POLICY_PATH,
             WORKFLOW_PATH,
             ...ANCHOR_PATHS,
+            ...MECHANISM_IMPORT_PATHS,
         ]);
     }
     return selfSetCache;
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 3c4f22f72..a3887ebee 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -129,6 +129,29 @@ export const READER_PATH = 'src/scripts/_lib/ratification_artifact.ts';
  */
 export const CLOSURE_READER_PATH = 'src/scripts/_lib/dispatch_import_closure.ts';
 
+/**
+ * The rest of this gate's static import closure. Every module here runs inside
+ * the verdict, so an edit to one is an edit to the gate:
+ *
+ *   - `_lib/ratification_subject.ts` computes the digest a record must carry,
+ *     decides which files that digest covers, and reads the diff and the record;
+ *   - `_lib/adr_frontmatter.ts` parses the record's header, verdict included;
+ *   - `_lib/gate_ledger.ts` and `_lib/scan_scope.ts` run before the exit code is
+ *     returned, so either could end the process first.
+ *
+ * `_lib/kernel_rules.ts`, the last import, is already gated as plumbing. The
+ * writer CLIs (`ratification_subject.ts`, `ratification_header.ts`) and the
+ * contract are not imported: the gate recomputes the digest and reads only the
+ * record, so editing them cannot change what it accepts. A test walks the
+ * imports and fails when a new one is missing from this list.
+ */
+export const MECHANISM_IMPORT_PATHS: readonly string[] = [
+    'src/scripts/_lib/ratification_subject.ts',
+    'src/scripts/_lib/adr_frontmatter.ts',
+    'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/scan_scope.ts',
+];
+
 /** The in-repo quorum policy. Present on every runner; absent means refuse. */
 export const POLICY_PATH = 'src/config/ratification-policy.json';
 
@@ -320,6 +343,19 @@ export interface GatedPaths {
     self: boolean;
 }
 
+/** True for a file of the ratification mechanism itself. */
+function isMechanismPath(p: string): boolean {
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
@@ -335,14 +371,7 @@ export function classifyPaths(
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
@@ -527,7 +556,7 @@ export function evaluate(
         ...gated.kernelRules,
         ...gated.governanceHooks,
         ...gated.plumbing,
-        ...(gated.self ? [SELF_PATH] : []),
+        ...files.map((f) => f.replace(/\\/g, '/').trim()).filter(isMechanismPath),
     ]);
     const artifactSet = new Set(ratificationArtifactsIn(files));
     for (const target of ledger.unaccountedTargets()) {
@@ -609,7 +638,7 @@ export function evaluate(
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
index 000000000..b5897bbf7
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -0,0 +1,102 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
+import {
+    classifyPaths,
+    READER_PATH,
+    requiresRatification,
+    SELF_PATH,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
+import { relativeSpecifiers } from '../../src/scripts/_lib/dispatch_import_closure.js';
+import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * The gate's verdict runs through every module it statically imports. A module
+ * in that closure can change the verdict — the digest it compares, the record
+ * it parses, or the exit itself — so editing one is editing the gate.
+ */
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
+const SUBJECT_LIB = 'src/scripts/_lib/ratification_subject.ts';
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
+describe('the gate watches its own import closure', () => {
+    it('a diff touching only the subject calculator requires a ratification record', () => {
+        expect(classifyPaths([SUBJECT_LIB], []).self).toBe(true);
+        expect(requiresRatification(classifyPaths([SUBJECT_LIB], []))).toBe(true);
+    });
+
+    it('refuses an unratified edit of the subject calculator end to end', () => {
+        fs.mkdirSync(path.join(root, path.dirname(SUBJECT_LIB)), { recursive: true });
+        fs.writeFileSync(path.join(root, SUBJECT_LIB), 'export const x = 1;\n');
+        commitAll(root);
+        const r = gate.evaluate([SUBJECT_LIB], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('no ratification artifact');
+    });
+
+    it('every module the gate imports is gated, and the digest covers it', () => {
+        const closure = gateImportClosure();
+        // The closure is not trivially small: a walker that resolved nothing
+        // would make the assertions below vacuous.
+        expect(closure).toContain(SUBJECT_LIB);
+        expect(closure).toContain(READER_PATH);
+        for (const m of closure) {
+            expect(requiresRatification(classifyPaths([m], [])), m).toBe(true);
+            expect(gatedFilesOf([m], []), m).toContain(m);
+        }
+    });
+
+    it('a module outside the closure stays ungated', () => {
+        // The writer CLI prints a digest the gate recomputes; editing it
+        // cannot change what the gate accepts.
+        expect(gateImportClosure()).not.toContain('src/scripts/ratification_subject.ts');
+        expect(requiresRatification(classifyPaths(['src/scripts/ratification_subject.ts'], []))).toBe(
+            false,
+        );
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
