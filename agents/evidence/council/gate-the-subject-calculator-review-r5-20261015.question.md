<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/gate-the-subject-calculator,
     round 5, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator, round 5 — delta after round 4 on stage 1

Round 4 (prompt `agents/evidence/council/gate-the-subject-calculator-review-r4-20261015.question.md`, reviewed commit `5a2c68fb7`; both seats' texts in `agents/evidence/council/gate-the-subject-calculator-review.md`) requested changes. This round shows the delta since and the disposition of each finding.

The owner decision of 2026-10-15 (the staged approach, writer CLIs and contract outside the gated set) is unchanged.

Findings and dispositions:

1. HIGH (both seats) — `pinViolations` only examined pinned paths the caller listed, so an omitted, `./`-prefixed or otherwise differently spelled path, or a move reported by destination only, skipped the pin.
   - Disposition: a pinned module PRESENT at the resolved head commit is now compared to its pin whatever `files` contains. A module ABSENT at the commit is reported as a deletion when the diff names it; names are canonicalised first (`path.posix.normalize`, backslashes, a leading `./`). Absent and unnamed is not refused, because a tree that never had the module (every fixture repository of the gate's suites) is not a deletion. A move reported by destination only leaves the source path absent at head and unnamed; note that `main` builds the list with `git diff --no-renames`, which reports a move as deletion plus addition, and that deleting or moving this module also removes a file the gate itself imports.
   - New end-to-end cases on a committed fixture: drifted content refused with the path named exactly, as `./…`, with only `README.md` named, and with an empty list; deletion refused with the `./` spelling; a tree that never had the module passes. Sensitivity: reinstating "skip unless named" turns the `['README.md']` case red, restored afterwards.
2. MEDIUM (both) — the closure walk missed `import x = require("./x.js")`, and an aliased `require` escaped it. Disposition: import-equals declarations with an external module reference are read; any `require` identifier that is not the callee of a direct call stops the walk (a local function named `require` is therefore refused too, which errs closed). New cases for import-equals and the alias were added.
3. MEDIUM (openai) — `gitBlobId` hardcodes SHA-1. Disposition: comment narrowed to "SHA-1 repository, which this one is"; the pin test now compares `gitBlobId` with `git hash-object` on the pinned file, so a repository with a different hash algorithm is refused by that test instead of silently drifting.
4. LOW (openai) — on a pin refusal with an empty file list the ledger prints `planned 0 · failed 0`. Not changed: the ledger accounts for the diff's targets, the refusal line names the drifted module and its blob, and the exit code is 1.

Measured at commit `4b1e3f15a` (the delta below, which includes a two-line comment rewording after `6be4123f7`): the twelve related suites, `tsc --noEmit`, eslint and `lint_code_comments` pass. The digest set is unchanged (base and head gate both cover only `src/scripts/check_kernel_edit_ratified.ts`).

Review the delta below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the pin can still be bypassed or can refuse a diff it should not; whether the absent-and-unnamed carve-out opens a path that matters given how the gate builds its file list; whether the closure walk can still miss a module the verdict runs through; and whether anything in the delta weakens what judges the change. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: the delta below is complete for source and tests (2 files, 7,305 bytes). Not shown: the evidence files committed on the branch (prose, ungated) and the parts of the stage-1 diff unchanged since round 4.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 857ffb2e7..589fde915 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -165,7 +165,10 @@ export const PENDING_MECHANISM_PINS: Readonly<Record<string, string>> = {
     'src/scripts/_lib/ratification_subject.ts': '3842d91528ec5229819dbd0da2f1a67a1f0eb06c',
 };
 
-/** Git's blob id for `bytes` — what `git hash-object` prints. */
+/**
+ * Git's SHA-1 blob id for `bytes` — what `git hash-object` prints in a SHA-1
+ * repository, which this one is; a test compares the two.
+ */
 export function gitBlobId(bytes: Buffer): string {
     return createHash('sha1')
         .update(`blob ${bytes.length}\u0000`)
@@ -174,17 +177,26 @@ export function gitBlobId(bytes: Buffer): string {
 }
 
 /**
- * Pinned modules this diff changes away from their pin at `commit`. A deleted
- * module counts as changed. THROWS a {@link GatedSubjectRefusal} when the commit
- * cannot be read.
+ * Pinned modules that differ from their pin at `commit`.
+ *
+ * A module PRESENT at the commit is compared whatever the diff lists, so a
+ * caller that omits or misspells the path cannot skip it. An ABSENT one is a
+ * deletion only when the diff names it — a tree that never had the module,
+ * such as a fixture, is not a deletion — and the names are canonicalised
+ * first. THROWS a {@link GatedSubjectRefusal} when the commit cannot be read.
  */
 export function pinViolations(files: readonly string[], root: string, commit: string): string[] {
-    const changed = new Set(files.map((f) => f.replace(/\\/g, '/').trim()));
+    const named = new Set(
+        files.map((f) => path.posix.normalize(f.replace(/\\/g, '/').trim()).replace(/^\.\//, '')),
+    );
     const out: string[] = [];
     for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
-        if (!changed.has(rel)) continue;
         const bytes = fileAtRevision(root, commit, rel);
-        const actual = bytes === null ? 'absent' : gitBlobId(bytes);
+        if (bytes === null) {
+            if (named.has(rel)) out.push(`${rel} is absent, pinned to ${blob}`);
+            continue;
+        }
+        const actual = gitBlobId(bytes);
         if (actual !== blob) out.push(`${rel} is ${actual}, pinned to ${blob}`);
     }
     return out;
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
index f8703c11f..f09118082 100644
--- a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -1,3 +1,4 @@
+import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
@@ -42,8 +43,10 @@ const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.
 
 /**
  * Every module specifier `source` loads, read from the TypeScript syntax tree:
- * import and export-from declarations, `import(…)` and `require(…)`. A call
- * whose argument is not a string literal cannot be resolved, so it fails.
+ * import and export-from declarations, `import x = require(…)`, `import(…)`
+ * and `require(…)`. A load whose argument is not a string literal, or a
+ * `require` used other than as a direct call, cannot be resolved and is refused —
+ * a local function named `require` is refused too, which errs closed.
  */
 function moduleSpecifiers(rel: string, source: string): string[] {
     const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true);
@@ -55,6 +58,19 @@ function moduleSpecifiers(rel: string, source: string): string[] {
             ts.isStringLiteral(node.moduleSpecifier)
         ) {
             out.push(node.moduleSpecifier.text);
+        } else if (
+            ts.isImportEqualsDeclaration(node) &&
+            ts.isExternalModuleReference(node.moduleReference)
+        ) {
+            const ref = node.moduleReference.expression;
+            expect(ts.isStringLiteralLike(ref), `${rel}: unresolvable import-equals`).toBe(true);
+            out.push((ref as ts.StringLiteralLike).text);
+        } else if (
+            ts.isIdentifier(node) &&
+            node.text === 'require' &&
+            !(ts.isCallExpression(node.parent) && node.parent.expression === node)
+        ) {
+            expect.fail(`${rel}: \`require\` used other than as a direct call`);
         } else if (
             ts.isCallExpression(node) &&
             (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
@@ -124,10 +140,17 @@ describe('the gate watches the modules its verdict runs through', () => {
     it('the walk sees dynamic imports and re-exports a lexical scan could hide', () => {
         const src = 'const a = "/*";\nimport("./x.js");\nconst b = "*/";\nexport * from "./y.js";\n';
         expect(moduleSpecifiers('f.ts', src)).toEqual(['./x.js', './y.js']);
+        expect(moduleSpecifiers('g.ts', 'import d = require("./d.js");\n')).toEqual(['./d.js']);
+        expect(() => moduleSpecifiers('h.ts', 'const r = require;\nr("./x.js");\n')).toThrow();
     });
 
     it('every pending module is pinned to its current blob', () => {
         expect(gitBlobId(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
+        for (const rel of PENDING) {
+            const git = spawnSync('git', ['hash-object', '--', rel], { cwd: REPO, encoding: 'utf8' });
+            expect(git.status, git.stderr).toBe(0);
+            expect(gitBlobId(fs.readFileSync(path.join(REPO, rel))), rel).toBe(git.stdout.trim());
+        }
         expect(Object.keys(PENDING_MECHANISM_PINS).sort()).toEqual([...PENDING].sort());
         for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
             expect(gitBlobId(fs.readFileSync(path.join(REPO, rel))), rel).toBe(blob);
@@ -144,9 +167,24 @@ describe('the gate watches the modules its verdict runs through', () => {
 
         fs.appendFileSync(path.join(root, rel), '// drift\n');
         commitAll(root);
-        const moved = gate.evaluate([rel], root, 2);
-        expect(moved.exitCode).toBe(1);
-        expect(moved.lines.join('\n')).toContain('a pinned ratification module changed');
+        // The path named exactly, spelled differently, and not named at all.
+        for (const files of [[rel], [`./${rel}`], ['README.md'], []]) {
+            const moved = gate.evaluate(files, root, 2);
+            expect(moved.exitCode, JSON.stringify(files)).toBe(1);
+            expect(moved.lines.join('\n')).toContain('a pinned ratification module changed');
+        }
+
+        fs.rmSync(path.join(root, rel));
+        commitAll(root);
+        const deleted = gate.evaluate([`./${rel}`], root, 2);
+        expect(deleted.exitCode).toBe(1);
+        expect(deleted.lines.join('\n')).toContain('is absent');
+    });
+
+    it('a tree that never had a pinned module is not a deletion', () => {
+        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
+        commitAll(root);
+        expect(gate.evaluate(['README.md'], root, 2).exitCode).toBe(0);
     });
 
     it('refuses an unratified edit of the record parser end to end', () => {
```
