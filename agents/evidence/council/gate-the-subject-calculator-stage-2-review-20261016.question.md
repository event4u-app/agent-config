<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-the-subject-calculator-stage-2-20261016,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator-stage-2-20261016, round 1 — gate the subject calculator, retire its pin (stage 2 of 2)

Context, from the tree:

- #2379 (stage 1) added `_lib/adr_frontmatter.ts`, `_lib/gate_ledger.ts` and `_lib/scan_scope.ts` to `check_kernel_edit_ratified`'s `MECHANISM_IMPORT_PATHS`, and left `_lib/ratification_subject.ts` (which computes the record's `subject` digest) for a second change, because a change that gates a module and edits it at once is digested over different files by the base revision's gate and by its own. Until then the module was bound by `PENDING_MECHANISM_PINS` (a Git blob id), enforced by `pinViolations`.
- That pin deadlocked main on 2026-10-16 (CI judges with the base gate; the committed module drifted off the pin through a merge) and was recovered by #2383, which restored the module to the pinned blob `3842d915…`. Main now holds that blob.
- The owner directed that technical decisions about the ratification gate's modules go to the council.

This change:

- adds `src/scripts/_lib/ratification_subject.ts` to `MECHANISM_IMPORT_PATHS` without touching its bytes;
- removes `PENDING_MECHANISM_PINS`, `gitBlobId`, `pinViolations`, their call site in `evaluate`, and the now-unused `createHash` import — there is no pending module left;
- tests: the closure test now requires every module of the gate's import closure to be gated and digested (no exception list); the pin tests go with the pin; an unratified edit of `_lib/ratification_subject.ts` is refused end to end (parameterised beside the existing `adr_frontmatter` case); `ratification_subject.ts` is added to the `IMPORTED` list.

Measured at `5dd7b6e6e`: the gate's two suites pass (36 tests); `tsc --noEmit` passes. Sensitivity: removing the module from `MECHANISM_IMPORT_PATHS` turns four tests red, restored afterwards. The subject digest for this diff is `f71be78fb7a2a2b248e97d6667fa0b157d403359cb78e3aef4b0484e79ce7a4b` from BOTH the head's gate and the base revision's gate (main `73eb69439`, run from a detached worktree with `--root <head>`); both cover only `src/scripts/check_kernel_edit_ratified.ts`.

Not in this change: #2375's refactor of the module (declared fields instead of parameter properties, needed for the danger gate's node-only path), which returns in the next change under a ratification record now that the module is gated.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the module is now bound as strongly as it was by the pin, or more weakly anywhere; whether removing the pin machinery drops a protection something else relied on; whether the base gate and this head gate can disagree on this diff; and whether the tests would pass without the code they cover. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 589fde915..a6f95eae2 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -81,7 +81,6 @@
  * Exit codes: 0 = pass (or nothing gated) · 1 = fail · 3 = internal error.
  */
 
-import { createHash } from 'node:crypto';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
@@ -136,72 +135,24 @@ export const CLOSURE_READER_PATH = 'src/scripts/_lib/dispatch_import_closure.ts'
  *
  *   - `_lib/adr_frontmatter.ts` parses the record's header, verdict included;
  *   - `_lib/gate_ledger.ts` and `_lib/scan_scope.ts` run before the exit code is
- *     returned, so either could end the process first.
- *
- * `_lib/kernel_rules.ts` is already gated as plumbing. `_lib/ratification_subject.ts`,
- * which computes the digest, joins in a separate change: one that gates it and
- * edits it at once is digested over different files by the base revision's
- * gate and by its own, so no single record answers for both. The writer CLIs
- * `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts`
+ *     returned, so either could end the process first;
+ *   - `_lib/ratification_subject.ts` computes the digest a record must carry.
+ *
+ * `_lib/kernel_rules.ts` is already gated as plumbing. A change that gates a
+ * module and edits it at once is digested over different files by the base
+ * revision's gate and by its own, so no single record answers for both: a
+ * module joins this list in a change that leaves its bytes alone. The writer
+ * CLIs `src/scripts/ratification_subject.ts` and `src/scripts/ratification_header.ts`
  * and the contract stay outside by owner decision (2026-10-15): the gate does
  * not import them, recomputes the digest and reads only the record.
  */
 export const MECHANISM_IMPORT_PATHS: readonly string[] = [
     'src/scripts/_lib/adr_frontmatter.ts',
     'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/ratification_subject.ts',
     'src/scripts/_lib/scan_scope.ts',
 ];
 
-/**
- * Closure modules not gated yet, each pinned to the Git blob its review saw.
- *
- * `_lib/ratification_subject.ts` cannot be gated in the change that edits it
- * (see above), so until the change that gates it lands its bytes would be
- * bound by no record. The pin binds them through this gated file instead: a
- * diff that changes a pinned module is refused, and moving the pin edits this
- * file, which needs a record. The change that gates the module removes its pin.
- */
-export const PENDING_MECHANISM_PINS: Readonly<Record<string, string>> = {
-    'src/scripts/_lib/ratification_subject.ts': '3842d91528ec5229819dbd0da2f1a67a1f0eb06c',
-};
-
-/**
- * Git's SHA-1 blob id for `bytes` — what `git hash-object` prints in a SHA-1
- * repository, which this one is; a test compares the two.
- */
-export function gitBlobId(bytes: Buffer): string {
-    return createHash('sha1')
-        .update(`blob ${bytes.length}\u0000`)
-        .update(bytes)
-        .digest('hex');
-}
-
-/**
- * Pinned modules that differ from their pin at `commit`.
- *
- * A module PRESENT at the commit is compared whatever the diff lists, so a
- * caller that omits or misspells the path cannot skip it. An ABSENT one is a
- * deletion only when the diff names it — a tree that never had the module,
- * such as a fixture, is not a deletion — and the names are canonicalised
- * first. THROWS a {@link GatedSubjectRefusal} when the commit cannot be read.
- */
-export function pinViolations(files: readonly string[], root: string, commit: string): string[] {
-    const named = new Set(
-        files.map((f) => path.posix.normalize(f.replace(/\\/g, '/').trim()).replace(/^\.\//, '')),
-    );
-    const out: string[] = [];
-    for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
-        const bytes = fileAtRevision(root, commit, rel);
-        if (bytes === null) {
-            if (named.has(rel)) out.push(`${rel} is absent, pinned to ${blob}`);
-            continue;
-        }
-        const actual = gitBlobId(bytes);
-        if (actual !== blob) out.push(`${rel} is ${actual}, pinned to ${blob}`);
-    }
-    return out;
-}
-
 /** The in-repo quorum policy. Present on every runner; absent means refuse. */
 export const POLICY_PATH = 'src/config/ratification-policy.json';
 
@@ -589,11 +540,9 @@ export function evaluate(
     // read one head commit and one base.
     let derived: readonly string[];
     let headCommit: string;
-    let drifted: string[];
     try {
         headCommit = resolveRevision(root, revision);
         derived = derivedFor(root, baseRef, headCommit);
-        drifted = pinViolations(files, root, headCommit);
     } catch (err) {
         if (!(err instanceof GatedSubjectRefusal)) {
             throw err;
@@ -606,18 +555,6 @@ export function evaluate(
         lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
         return { exitCode: 1, lines, scanned };
     }
-    // Before any pass: a pinned module is ungated, so a diff touching only it
-    // would otherwise exit "nothing to ratify".
-    if (drifted.length > 0) {
-        lines.push('❌  a pinned ratification module changed — it is not gated yet, so its pin is what binds it:');
-        for (const d of drifted) lines.push(`  · ${d}`);
-        for (const target of ledger.unaccountedTargets()) {
-            ledger.fail(target, 'a pinned ratification module changed');
-        }
-        const tally = ledger.finalize();
-        lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
-        return { exitCode: 1, lines, scanned };
-    }
     const gated = classifyPaths(files, derived);
     const gatedSet = new Set<string>([
         ...gated.kernelRules,
diff --git a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
index 104824865..a1b943167 100644
--- a/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts
@@ -1,4 +1,3 @@
-import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
@@ -10,9 +9,7 @@ import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
 import {
     classifyPaths,
-    gitBlobId,
     MECHANISM_IMPORT_PATHS,
-    PENDING_MECHANISM_PINS,
     READER_PATH,
     requiresRatification,
     SELF_PATH,
@@ -28,17 +25,10 @@ import { commitAll } from './ratification_git_fixture.js';
 const IMPORTED = [
     'src/scripts/_lib/adr_frontmatter.ts',
     'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/ratification_subject.ts',
     'src/scripts/_lib/scan_scope.ts',
 ];
 
-/**
- * The one module of the closure not gated yet. It is edited in the change that
- * routes its digest through `isMechanismPath`, and a change that gates a file
- * while editing it is digested differently by the base gate and its own, so it
- * joins in the next change, which removes it from here.
- */
-const PENDING = ['src/scripts/_lib/ratification_subject.ts'];
-
 const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
 
 /**
@@ -126,13 +116,13 @@ describe('the gate watches the modules its verdict runs through', () => {
         }
     });
 
-    it('every module the gate imports is gated and digested, except the named pending one', () => {
+    it('every module the gate imports is gated and digested', () => {
         const closure = gateImportClosure();
         expect(closure).toContain(READER_PATH);
         for (const p of IMPORTED) expect(closure, p).toContain(p);
         const ungated = closure.filter((m) => !requiresRatification(classifyPaths([m], [])));
-        expect(ungated).toEqual(PENDING);
-        for (const m of closure.filter((x) => !PENDING.includes(x))) {
+        expect(ungated).toEqual([]);
+        for (const m of closure) {
             expect(gatedFilesOf([m], []), m).toEqual([m]);
         }
     });
@@ -144,64 +134,17 @@ describe('the gate watches the modules its verdict runs through', () => {
         expect(() => moduleSpecifiers('h.ts', 'const r = require;\nr("./x.js");\n')).toThrow();
     });
 
-    it('every pending module is pinned to its current blob', () => {
-        expect(gitBlobId(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
-        for (const rel of PENDING) {
-            const git = spawnSync('git', ['hash-object', '--', rel], { cwd: REPO, encoding: 'utf8' });
-            expect(git.status, git.stderr).toBe(0);
-            expect(gitBlobId(fs.readFileSync(path.join(REPO, rel))), rel).toBe(git.stdout.trim());
-        }
-        expect(Object.keys(PENDING_MECHANISM_PINS).sort()).toEqual([...PENDING].sort());
-        for (const [rel, blob] of Object.entries(PENDING_MECHANISM_PINS)) {
-            expect(gitBlobId(fs.readFileSync(path.join(REPO, rel))), rel).toBe(blob);
-        }
-    });
-
-    // CI judges every pull request with the base revision's gate, which reads the
-    // committed blob; a trunk whose committed module is off its pin refuses all of them.
-    it('the committed trunk satisfies its own pins', () => {
-        expect(gate.pinViolations([], REPO, 'HEAD')).toEqual([]);
-    });
-
-    it('refuses a diff that moves a pinned module off its pin, and passes it unchanged', () => {
-        const rel = PENDING[0] as string;
-        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
-        fs.writeFileSync(path.join(root, rel), fs.readFileSync(path.join(REPO, rel)));
-        commitAll(root);
-        const same = gate.evaluate([rel], root, 2);
-        expect(same.exitCode).toBe(0);
-
-        fs.appendFileSync(path.join(root, rel), '// drift\n');
-        commitAll(root);
-        // The path named exactly, spelled differently, and not named at all.
-        for (const files of [[rel], [`./${rel}`], ['README.md'], []]) {
-            const moved = gate.evaluate(files, root, 2);
-            expect(moved.exitCode, JSON.stringify(files)).toBe(1);
-            expect(moved.lines.join('\n')).toContain('a pinned ratification module changed');
-        }
-
-        fs.rmSync(path.join(root, rel));
-        commitAll(root);
-        const deleted = gate.evaluate([`./${rel}`], root, 2);
-        expect(deleted.exitCode).toBe(1);
-        expect(deleted.lines.join('\n')).toContain('is absent');
-    });
-
-    it('a tree that never had a pinned module is not a deletion', () => {
-        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
-        commitAll(root);
-        expect(gate.evaluate(['README.md'], root, 2).exitCode).toBe(0);
-    });
-
-    it('refuses an unratified edit of the record parser end to end', () => {
-        const rel = 'src/scripts/_lib/adr_frontmatter.ts';
-        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
-        fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
-        commitAll(root);
-        const r = gate.evaluate([rel], root, 2);
-        expect(r.exitCode).toBe(1);
-        expect(r.lines.join('\n')).toContain('no ratification artifact');
-    });
+    it.each(['src/scripts/_lib/adr_frontmatter.ts', 'src/scripts/_lib/ratification_subject.ts'])(
+        'refuses an unratified edit of %s end to end',
+        (rel) => {
+            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
+            fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
+            commitAll(root);
+            const r = gate.evaluate([rel], root, 2);
+            expect(r.exitCode).toBe(1);
+            expect(r.lines.join('\n')).toContain('no ratification artifact');
+        },
+    );
 
     it('the digest covers every mechanism file the gate classifies', () => {
         for (const p of [...IMPORTED, READER_PATH]) {
```
