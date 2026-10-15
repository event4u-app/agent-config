<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/gate-the-subject-calculator,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator, round 4 — delta after round 3 on stage 1

Round 3 (prompt `agents/evidence/council/gate-the-subject-calculator-review-r3-20261015.question.md`, reviewed commit `7afc062c3`; both seats' texts in `agents/evidence/council/gate-the-subject-calculator-review.md`) requested changes. This round shows the delta since and the disposition of each finding; everything else on the branch is as reviewed in rounds 2 and 3.

Findings and dispositions:

1. HIGH (both seats) — `_lib/ratification_subject.ts`, edited here and gated only in stage 2, could change after review with no record committing to its bytes; the prose blob attestation could go stale.
   - Disposition: a machine-enforced content pin in the already-gated gate file. `PENDING_MECHANISM_PINS` maps `src/scripts/_lib/ratification_subject.ts` to Git blob `3842d91528ec5229819dbd0da2f1a67a1f0eb06c` (its content at this branch's head). `evaluate` computes `pinViolations` right after resolving the head commit — reading the blob from Git objects at that commit — and, when the diff contains a pinned path whose blob differs (a deletion counts), refuses before the "nothing to ratify" exit. Moving the pin edits the gate, which needs a record. Stage 2 removes the pin in the same change that gates the module.
   - For THIS PR, CI runs the base gate, which has no pin; the pin constant sits in `check_kernel_edit_ratified.ts`, whose bytes the record's subject commits to, and the test `every pending module is pinned to its current blob` (run by CI's test job on the head) fails if the module's checkout content differs from the pin. From the merge of this PR on, the base gate enforces the pin on every later PR.
2. MEDIUM (both) — the closure walk's lexical comment strip could hide a dynamic import placed between string-literal comment delimiters. Disposition: the walk now reads the TypeScript syntax tree: import and export-from declarations, `import(…)` and `require(…)` calls; a call whose argument is not a string literal fails the test. A new test feeds the round-3 example (`const a = "/*"; import("./x.js"); const b = "*/"; export * from "./y.js";`) and requires both specifiers.
3. LOW (anthropic) — assert that `PENDING` files are ungated. Not added: `expect(ungated).toEqual(PENDING)` already requires every `PENDING` entry to be both in the closure and ungated; an early-gated entry would drop out of `ungated` and fail the equality.
4. LOW (anthropic) — the existence assertion's message now names the resolved target path.

Sensitivity: replacing the `pinViolations` call with an empty list fails the pin-drift test (1 of 9), restored afterwards. Measured at the new head (`5a2c68fb7`): base gate (main `f998ea3b5`) and head gate both digest exactly `src/scripts/check_kernel_edit_ratified.ts`, subject `dcb45eef22687089755aecc1a53a777f11bd1b086d01f7f87f26ab101f320087`. The twelve related suites, `tsc --noEmit`, eslint and `lint_code_comments` pass.

Review the delta below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the pin can be bypassed (path spelling, rename, a diff that changes the module and then restores it, the base-gate window of this PR itself); whether the pin check can refuse a diff it should not; whether the syntax-tree walk can still miss a module the verdict runs through; and whether anything in the delta weakens what judges the change. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: the delta below is complete for source and tests (2 files, 9,566 bytes). Not shown: the evidence files committed on the branch (prose, ungated) and the parts of the stage-1 diff unchanged since round 3.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 45235e0fa..857ffb2e7 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -81,6 +81,7 @@
  * Exit codes: 0 = pass (or nothing gated) · 1 = fail · 3 = internal error.
  */
 
+import { createHash } from 'node:crypto';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
@@ -151,6 +152,44 @@ export const MECHANISM_IMPORT_PATHS: readonly string[] = [
     'src/scripts/_lib/scan_scope.ts',
 ];
 
+/**
+ * Closure modules not gated yet, each pinned to the Git blob its review saw.
+ *
+ * `_lib/ratification_subject.ts` cannot be gated in the change that edits it
+ * (see above), so until the change that gates it lands its bytes would be
+ * bound by no record. The pin binds them through this gated file instead: a
+ * diff that changes a pinned module is refused, and moving the pin edits this
+ * file, which needs a record. The change that gates the module removes its pin.
+ */
+export const PENDING_MECHANISM_PINS: Readonly<Record<string, string>> = {
+    'src/scripts/_lib/ratification_subject.ts': '3842d91528ec5229819dbd0da2f1a67a1f0eb06c',
+};
+
+/** Git's blob id for `bytes` — what `git hash-object` prints. */
+export function gitBlobId(bytes: Buffer): string {
+    return createHash('sha1')
+        .update(`blob ${bytes.length}\u0000`)
+        .update(bytes)
+        .digest('hex');
+}
+
+/**
+ * Pinned modules this diff changes away from their pin at `commit`. A deleted
+ * module counts as changed. THROWS a {@link GatedSubjectRefusal} when the commit
+ * cannot be read.
+ */
+export function pinViolations(files: readonly string[], root: string, commit: string): string[] {
+    const changed = new Set(files.map((f) => f.replace(/\\/g, '/').trim()));
+    const out: string[] = [];
+    for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
+        if (!changed.has(rel)) continue;
+        const bytes = fileAtRevision(root, commit, rel);
+        const actual = bytes === null ? 'absent' : gitBlobId(bytes);
+        if (actual !== blob) out.push(`${rel} is ${actual}, pinned to ${blob}`);
+    }
+    return out;
+}
+
 /** The in-repo quorum policy. Present on every runner; absent means refuse. */
 export const POLICY_PATH = 'src/config/ratification-policy.json';
 
@@ -538,9 +577,11 @@ export function evaluate(
     // read one head commit and one base.
     let derived: readonly string[];
     let headCommit: string;
+    let drifted: string[];
     try {
         headCommit = resolveRevision(root, revision);
         derived = derivedFor(root, baseRef, headCommit);
+        drifted = pinViolations(files, root, headCommit);
     } catch (err) {
         if (!(err instanceof GatedSubjectRefusal)) {
             throw err;
@@ -553,6 +594,18 @@ export function evaluate(
         lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
         return { exitCode: 1, lines, scanned };
     }
+    // Before any pass: a pinned module is ungated, so a diff touching only it
+    // would otherwise exit "nothing to ratify".
+    if (drifted.length > 0) {
+        lines.push('❌  a pinned ratification module changed — it is not gated yet, so its pin is what binds it:');
+        for (const d of drifted) lines.push(`  · ${d}`);
+        for (const target of ledger.unaccountedTargets()) {
+            ledger.fail(target, 'a pinned ratification module changed');
+        }
+        const tally = ledger.finalize();
+        lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
+        return { exitCode: 1, lines, scanned };
+    }
     const gated = classifyPaths(files, derived);
     const gatedSet = new Set<string>([
         ...gated.kernelRules,
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
index 37fce61d6..f8703c11f 100644
--- a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -3,17 +3,19 @@ import * as os from 'node:os';
 import * as path from 'node:path';
 import { fileURLToPath } from 'node:url';
 
+import ts from 'typescript';
 import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 
 import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
 import {
     classifyPaths,
+    gitBlobId,
     MECHANISM_IMPORT_PATHS,
+    PENDING_MECHANISM_PINS,
     READER_PATH,
     requiresRatification,
     SELF_PATH,
 } from '../../src/scripts/check_kernel_edit_ratified.js';
-import { relativeSpecifiers } from '../../src/scripts/_lib/dispatch_import_closure.js';
 import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
 import { commitAll } from './ratification_git_fixture.js';
 
@@ -38,7 +40,37 @@ const PENDING = ['src/scripts/_lib/ratification_subject.ts'];
 
 const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
 
-/** Repo-relative paths of every module reachable from the gate by relative static imports. */
+/**
+ * Every module specifier `source` loads, read from the TypeScript syntax tree:
+ * import and export-from declarations, `import(…)` and `require(…)`. A call
+ * whose argument is not a string literal cannot be resolved, so it fails.
+ */
+function moduleSpecifiers(rel: string, source: string): string[] {
+    const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true);
+    const out: string[] = [];
+    const visit = (node: ts.Node): void => {
+        if (
+            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
+            node.moduleSpecifier !== undefined &&
+            ts.isStringLiteral(node.moduleSpecifier)
+        ) {
+            out.push(node.moduleSpecifier.text);
+        } else if (
+            ts.isCallExpression(node) &&
+            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
+                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
+        ) {
+            const arg = node.arguments[0];
+            expect(arg !== undefined && ts.isStringLiteralLike(arg), `${rel}: unresolvable dynamic load`).toBe(true);
+            out.push((arg as ts.StringLiteralLike).text);
+        }
+        ts.forEachChild(node, visit);
+    };
+    visit(file);
+    return out;
+}
+
+/** Repo-relative paths of every repository module the gate loads, transitively. */
 function gateImportClosure(): string[] {
     const seen = new Set<string>();
     const queue = [SELF_PATH];
@@ -47,13 +79,12 @@ function gateImportClosure(): string[] {
         if (seen.has(rel)) continue;
         seen.add(rel);
         const source = fs.readFileSync(path.join(REPO, rel), 'utf8');
-        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
-        expect(code, `${rel} uses a dynamic import the walk cannot follow`).not.toMatch(/\bimport\s*\(/);
-        for (const spec of relativeSpecifiers(source)) {
+        for (const spec of moduleSpecifiers(rel, source)) {
+            if (!spec.startsWith('.')) continue;
             const target = path.posix.normalize(
                 path.posix.join(path.posix.dirname(rel), spec).replace(/\.js$/, '.ts'),
             );
-            expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec}`).toBe(true);
+            expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec} → ${target}`).toBe(true);
             queue.push(target);
         }
     }
@@ -90,6 +121,34 @@ describe('the gate watches the modules its verdict runs through', () => {
         }
     });
 
+    it('the walk sees dynamic imports and re-exports a lexical scan could hide', () => {
+        const src = 'const a = "/*";\nimport("./x.js");\nconst b = "*/";\nexport * from "./y.js";\n';
+        expect(moduleSpecifiers('f.ts', src)).toEqual(['./x.js', './y.js']);
+    });
+
+    it('every pending module is pinned to its current blob', () => {
+        expect(gitBlobId(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
+        expect(Object.keys(PENDING_MECHANISM_PINS).sort()).toEqual([...PENDING].sort());
+        for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
+            expect(gitBlobId(fs.readFileSync(path.join(REPO, rel))), rel).toBe(blob);
+        }
+    });
+
+    it('refuses a diff that moves a pinned module off its pin, and passes it unchanged', () => {
+        const rel = PENDING[0] as string;
+        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
+        fs.writeFileSync(path.join(root, rel), fs.readFileSync(path.join(REPO, rel)));
+        commitAll(root);
+        const same = gate.evaluate([rel], root, 2);
+        expect(same.exitCode).toBe(0);
+
+        fs.appendFileSync(path.join(root, rel), '// drift\n');
+        commitAll(root);
+        const moved = gate.evaluate([rel], root, 2);
+        expect(moved.exitCode).toBe(1);
+        expect(moved.lines.join('\n')).toContain('a pinned ratification module changed');
+    });
+
     it('refuses an unratified edit of the record parser end to end', () => {
         const rel = 'src/scripts/_lib/adr_frontmatter.ts';
         fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
```
