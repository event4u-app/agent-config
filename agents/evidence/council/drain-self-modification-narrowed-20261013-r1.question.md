<!-- evidence-type: analysis -->

<!-- The prompt given to the modification review on 2026-10-13, committed
     verbatim so the record beside it can be checked against what was actually
     asked (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Modification review — the content binding, narrowed on your own advice

A modification review under `docs/contracts/ratification-artifact.md`: this
change edits the ratification gate and its reader. Answer the nine questions
one at a time, in order, then close with a stance line carrying `ratified`,
`confirmed-non-expanding`, `refused` or `non-convergent`.
`confirmed-non-expanding` is for a change that touches a governance surface
without expanding anyone's authority: same bar as `ratified`, a classification
and not a weaker approval.

## Why this is smaller than what you saw on 2026-10-12

You refused the larger branch 2/2 over three rounds. Round 2's dealbreaker —
`consequenceRuleSlugs` returning an empty set on a read failure, so a gate
advertising 28 high-consequence rules enforced none when one file failed to
parse — was corrected and you accepted the correction. Round 3 refused anyway,
on `smaller-change`:

> "This change bundles at least four independently reversible concerns —
> digest binding, governed-surface expansion, proposal validation, and a new
> standing Iron Law... Landing the binding first would close replay risk while
> letting the broader self-governance design be evaluated with a smaller blast
> radius."

It is now staged. Each concern is reverted to `origin/main`, and each revert
verified as an empty net diff per file rather than by a command's exit code:
**governed-surface expansion** (`REVIEWER_PATHS`, `CONSEQUENCE_CLASS_PATHS`,
`SELF_SURFACE`, `consequenceRuleSlugs` and its fail-closed exit — the gated path
set is back to `origin/main`'s ~15 paths, not ~49, and the 28 high-consequence
rules beyond the kernel are **not** gated here); **proposal validation**;
**the new standing Iron Law** (`testing-anti-patterns` law 8 — this change adds
**no** standing instruction weight); and **the record writer and the escalation
message**, two further independently reversible concerns that rode the same
branch. All five are reopened as `[ ]` roadmap steps carrying your words:
staged, not cancelled.

Your second reason was that the 177 KB diff exceeded this council's 50 KiB
ceiling, so no seat saw the whole change. Below is the complete diff of code,
contract and tests — nothing withheld from what you judge, at `-U1` context for
source and contract and `-U0` for tests, to fit this ceiling. Not below: the roadmap (39 KB of planning prose) and the previous review's
record; neither is code and neither is read by the gate.

## Known limits, stated rather than left for you to find

1. **The digest reads the WORKING TREE, not Git objects.** Both seats asked for
   revision-based hashing; that is the stronger shape and is still not what
   ships. Against a dirty tree it describes the dirty bytes, and the module
   header says so. The symlink case WAS fixed on your round-3 finding, because
   a dereferenced link made the digest depend on content outside the revision.
2. **The modules this change adds are not themselves gated.**
   `_lib/ratification_subject.ts`, `ratification_subject.ts` and the contract
   are not on the watch list, because putting them there IS staged step 4.1.
   The reviewer is not yet inside what it reviews — the gap that existed before
   2026-10-12, deliberately restored on your advice. The gated files this diff
   touches are two: `check_kernel_edit_ratified.ts` and
   `_lib/ratification_artifact.ts`.
3. **The 23 records on the trunk carry no `subject` and are not migrated**, and
   **a record still asserts rather than proves a review happened** — the digest
   is computed by the gate and typed in by whoever writes the record. What
   becomes impossible is narrower: a gated file edited after its review landing
   under that review's record, and one record carrying a second change.

## The nine questions

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

## The diff — `origin/main...HEAD`, code, contract and tests, complete

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 865b7756a..eaf08867c 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -70,2 +70,40 @@ against.
 
+## `subject:` — the digest of the content the record reviewed
+
+An eighth field, `subject:`, is a sha-256 hex digest over the **gated** files of
+the change: their sorted paths, each hashed alongside its content, with a
+deleted gated file entered rather than skipped. `./scripts-run
+src/scripts/ratification_subject --files <f> …` prints it, and
+`check_kernel_edit_ratified` recomputes it from the tree it is pointed at and
+refuses a record whose `subject` is absent (`subject-absent`), not a digest
+(`subject-malformed`) or a different one (`subject-mismatch`).
+
+| What it adds | Why the other seven did not |
+|---|---|
+| the record says WHAT it reviewed | the six required fields say only WHO; a gated file edited after its review still landed on that review's record |
+| a record carries one change | the gate passed when **any** artifact in the diff validated, so a record written for one review carried a second change it never saw |
+
+Three properties of the digest, each chosen against an alternative that looks
+equivalent and is not:
+
+- **The path is hashed with the content**, so two gated files with identical
+  bytes do not collide and a rename moves the digest — a governance hook moved
+  to another gated path is a different change, not the same one.
+- **A deleted gated file is entered**, via a marker, rather than omitted.
+  Omitting it would make *this hook was removed* digest-identical to *this hook
+  was never gated*, which is the change a record most needs to be bound to.
+- **No base diff.** The digest is over the tree as it stands, so it reads the
+  same on a branch and on the merged checkout CI judges — unless the base moved
+  a gated file the change also touches, and then the content that would land is
+  not the content that was reviewed, which is exactly what should move it. The
+  review-scope hash of `dispatch_r2_reviewer` was considered for this and
+  rejected: it is taken over diff text against a base, and this gate is handed a
+  file list and no base.
+
+Which files count as gated is decided by the gate's own classifier, and in CI
+that classifier is the **base revision's** — so a change that widens the gated
+set and edits a newly gated file is judged, and written, by one list. The 23
+records on the trunk carry no `subject` and are not migrated: the gate reads
+only the artifacts the diff names, so a landed record is never re-judged.
+
 `ratified` and `confirmed-non-expanding` let a diff land; `refused` and
@@ -623,11 +661,25 @@ that silently does not fire because the file it needed was somewhere else.
 
-At this pin — 2026-10-12 — **a record is not bound to the content it
-reviewed.** ADR-281 § Consequences states the gate binds each record to what it
-reviewed; that sentence describes the intended end state and not today's gate,
-which reads the artifact's shape and the diff's paths and never compares a
-digest. So a record written against one revision of a gated file still reads as
-valid after that file changes, and nothing here detects it. The binding is
-steps 2.1 and 2.2 of
-`road-to-self-modification-that-a-council-must-pass`; this paragraph is dated
-so a reader can tell whether it still describes the gate they are running.
+**The binding landed on 2026-10-12**, and this paragraph replaces the dated one
+that said it had not. A record now carries `subject`, and the gate recomputes
+that digest from the tree it is pointed at and refuses a record whose `subject`
+is absent or different — so ADR-281 § Consequences ("the gate binds each record
+to the content it reviewed") now describes the gate rather than an intended end
+state. Steps 2.1 and 2.2 of
+`road-to-self-modification-that-a-council-must-pass` are what closed it.
+
+**What the binding does NOT close, said as plainly as the gap it replaces.**
+The digest is computed by the gate from the tree and typed into the record by
+whoever writes it, so a record still asserts rather than proves that a review
+happened over that content — § What a passing record does not prove is
+unchanged and is the paragraph that matters. What it now makes impossible is
+narrower and real: a gated file edited after its review landing under that
+review's record, and one record carrying a second change it never saw.
+
+**One consequence worth stating because it will be met before it is read.** The
+workflow runs the BASE revision's copy of the gate, so a change that is open
+when this lands is judged by the old gate and needs a `subject` only once its
+base carries the new one. The digest is also recomputed from the merged
+checkout, so a base that moves a gated file the change also touches moves the
+digest and reds the record — deliberately: the content that would land is then
+not the content that was reviewed. A base that moves anything else does not.
 
diff --git a/src/scripts/_lib/ratification_artifact.ts b/src/scripts/_lib/ratification_artifact.ts
index 93f41d63e..46fd0fc16 100644
--- a/src/scripts/_lib/ratification_artifact.ts
+++ b/src/scripts/_lib/ratification_artifact.ts
@@ -86,2 +86,14 @@ export interface RatificationArtifact {
     effective_after: string;
+    /**
+     * The digest of the gated content this record reviewed, or `null` on a
+     * record that carries none.
+     *
+     * Not in {@link RATIFICATION_FIELDS}: those six are required of every
+     * record, and the 23 records on the trunk predate this field. What makes
+     * it required in practice is the CALLER — `check_kernel_edit_ratified`
+     * passes an expected digest on every run, and a record with no `subject`
+     * then fails `subject-absent`. A record is only ever read as part of the
+     * diff it ships in, so nothing on the trunk is re-judged.
+     */
+    subject: string | null;
 }
@@ -105,3 +117,6 @@ export interface RatificationProblem {
         | 'providers-exceed-seats'
-        | 'header-not-derived';
+        | 'header-not-derived'
+        | 'subject-absent'
+        | 'subject-malformed'
+        | 'subject-mismatch';
     message: string;
@@ -324,2 +339,12 @@ export interface RatificationReading {
 
+/**
+ * A `subject` digest: the lower-case hex sha-256 `subjectDigest` produces.
+ *
+ * Shape is checked apart from equality on purpose. A typo'd digest and a
+ * digest that moved because a gated file was edited after the review are
+ * different failures, and a reader that reported both as "mismatch" would
+ * send an author looking for an edit that never happened.
+ */
+export const SUBJECT_RE = /^[0-9a-f]{64}$/u;
+
 /** `merge`, or an ISO-8601 instant with a timezone. */
@@ -366,2 +391,9 @@ export function readProviders(fm: AdrFrontmatter): string[] {
  * evidence that diversity was unavailable.
+ *
+ * `expectedSubject` is the digest of the gated content the record is being
+ * read against, recomputed from the tree by the caller. Pass `null` to read a
+ * record's shape without binding it to any content — which is what a reader
+ * that is not judging a diff does. Pass a digest and the record must carry
+ * `subject`, and carry that one: a record whose `subject` is absent or
+ * different did not review this content, whatever its verdict says.
  */
@@ -370,2 +402,3 @@ export function readRatification(
     configuredProviders: number | null,
+    expectedSubject: string | null = null,
 ): RatificationReading {
@@ -429,2 +462,31 @@ export function readRatification(
 
+    // The content binding. Shape first, then equality, so a malformed digest is
+    // never reported as content that moved.
+    const subject = scalarOf(fm, 'subject');
+    if (subject !== null && !SUBJECT_RE.test(subject)) {
+        problems.push({
+            code: 'subject-malformed',
+            message:
+                `subject \`${subject}\` is not a sha-256 hex digest (${String(SUBJECT_RE)}) — ` +
+                'print it with `ratification_subject`',
+        });
+    } else if (expectedSubject !== null) {
+        if (subject === null) {
+            problems.push({
+                code: 'subject-absent',
+                message:
+                    'missing `subject:` — a record names who reviewed; without a digest it does not ' +
+                    `name WHAT, so the gated content may have changed since. Expected \`${expectedSubject}\``,
+            });
+        } else if (subject !== expectedSubject) {
+            problems.push({
+                code: 'subject-mismatch',
+                message:
+                    `subject \`${subject}\` is not the digest of this diff's gated content ` +
+                    `(\`${expectedSubject}\`) — the record reviewed different content, so it does not ` +
+                    'answer for this change',
+            });
+        }
+    }
+
     // Diversity, against the REQUIRED count.
@@ -467,2 +529,3 @@ export function readRatification(
             effective_after: effective as string,
+            subject,
         },
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 2a81823ed..b11fd508b 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -11,7 +11,8 @@
  * `classifyPaths` returns the kernel rules, hooks and plumbing by name but
- * reports the self surface as a BOOLEAN, so the gated list cannot be read back
- * out of it. This module therefore imports the gate's own path constants and
- * re-assembles — it never restates the membership rule, because a second
- * definition of "gated" is a second thing to keep in step, and the first time
- * the two diverged a file would be reviewed by one and digested by the other.
+ * reports the self surface as a BOOLEAN, so that part of the gated list cannot
+ * be read back out of it. This module therefore imports the gate's own path
+ * constants and re-assembles — it never restates the membership rule, because
+ * a second definition of "gated" is a second thing to keep in step, and the
+ * first time the two diverged a file would be reviewed by one and digested by
+ * the other.
  *
@@ -21,2 +22,11 @@
  * not the content that was reviewed, which is precisely what should move it.
+ *
+ * WHAT IT READS, AND WHAT IT THEREFORE DOES NOT PROVE. It reads the WORKING
+ * TREE, not Git objects. A reviewer of this mechanism asked for revision-based
+ * hashing instead; that remains the stronger shape and is not what ships here,
+ * so against a dirty tree the digest describes the dirty bytes. What the same
+ * review DID change is the symlink case below — a dereferenced link made the
+ * digest depend on content outside the revision entirely, which is a different
+ * and worse defect than depending on an uncommitted edit, because no amount of
+ * cleanliness in the checkout removes it.
  */
@@ -45,11 +55,42 @@ export const DELETED_MARKER = '\u0000deleted\u0000';
 
-/** The self surface, by the gate's own constants rather than a copy of them. */
-const SELF_SET: ReadonlySet<string> = new Set<string>([
-    SELF_PATH,
-    READER_PATH,
-    CLOSURE_READER_PATH,
-    POLICY_PATH,
-    WORKFLOW_PATH,
-    ...ANCHOR_PATHS,
-]);
+/**
+ * Prefixes the target of a gated path that is a SYMLINK, so the digest records
+ * the link rather than whatever it currently points at.
+ *
+ * A council review of this mechanism found the gap: `readFileSync`
+ * dereferences, so a gated path committed as a symlink was hashed as its
+ * target's bytes — which live outside the reviewed revision and can differ
+ * between two clean checkouts of the same commit. Git stores a symlink as a
+ * blob containing its target string, and that is what is hashed here, so the
+ * digest describes the committed object. A broken link is a link, not a
+ * deletion, and is recorded as one.
+ */
+export const SYMLINK_MARKER = '\u0000symlink\u0000';
+
+/**
+ * The self surface, by the gate's own constants rather than a copy of them.
+ *
+ * READ ON FIRST CALL, NOT AT MODULE SCOPE, and the reason is the import cycle
+ * the binding introduced. The gate now imports {@link subjectDigest} and this
+ * module imports the gate's path constants, so whichever of the two Node
+ * evaluates second sees the other half-evaluated; a module-scope
+ * `new Set([SELF_PATH, …])` reads those `const` bindings inside the window and
+ * throws on the temporal dead zone. Deferring to call time moves the read past
+ * both modules' evaluation, where the live bindings are initialised.
+ */
+let selfSetCache: ReadonlySet<string> | null = null;
+
+function selfSet(): ReadonlySet<string> {
+    if (selfSetCache === null) {
+        selfSetCache = new Set<string>([
+            SELF_PATH,
+            READER_PATH,
+            CLOSURE_READER_PATH,
+            POLICY_PATH,
+            WORKFLOW_PATH,
+            ...ANCHOR_PATHS,
+        ]);
+    }
+    return selfSetCache;
+}
 
@@ -66,4 +107,5 @@ export function gatedFilesOf(
     const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
+    const self = selfSet();
     for (const f of normalized) {
-        if (SELF_SET.has(f)) out.add(f);
+        if (self.has(f)) out.add(f);
     }
@@ -79,8 +121,34 @@ export function gatedFilesOf(
  * gated path is a different change, not the same one.
+ *
+ * `derived` is the plumbing closure the caller already computed, passed through
+ * to {@link gatedFilesOf} unchanged. The gate HAS that list and classifies with
+ * it; a digest that classified without it would cover fewer files than the gate
+ * gated, so a record could be bound to a subset of what was reviewed. One list,
+ * handed down, rather than two computed independently.
  */
-export function subjectDigest(root: string, files: readonly string[]): string {
+export function subjectDigest(
+    root: string,
+    files: readonly string[],
+    derived?: readonly string[],
+): string {
     const h = createHash('sha256');
-    for (const rel of gatedFilesOf(files)) {
+    for (const rel of gatedFilesOf(files, derived)) {
         const abs = path.join(root, rel);
-        const content = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(DELETED_MARKER);
+        // `lstat` rather than `existsSync`: the latter follows the link and
+        // reports a broken symlink as absent, which would digest a link as a
+        // deletion. One stat, and the three cases are told apart by it.
+        let content: Buffer;
+        let stat: fs.Stats | null = null;
+        try {
+            stat = fs.lstatSync(abs);
+        } catch {
+            stat = null;
+        }
+        if (stat === null) {
+            content = Buffer.from(DELETED_MARKER);
+        } else if (stat.isSymbolicLink()) {
+            content = Buffer.from(SYMLINK_MARKER + fs.readlinkSync(abs));
+        } else {
+            content = fs.readFileSync(abs);
+        }
         h.update(rel);
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 377eaad37..e7a5e24a6 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -87,2 +87,3 @@ import {
 } from './_lib/ratification_artifact.js';
+import { subjectDigest } from './_lib/ratification_subject.js';
 
@@ -383,2 +384,25 @@ function resolveBaseRef(explicit: string | null, root: string): string {
 
+/**
+ * The plumbing closure this gate classifies with: the union of the list read
+ * from the tree under review and from this script's own tree, so a module
+ * present on either side is watched.
+ */
+function derivedFor(root: string): readonly string[] {
+    return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
+}
+
+/**
+ * The `subject` digest a record must carry to answer for this diff.
+ *
+ * Exported so that whoever WRITES a record asks the gate for the digest rather
+ * than recomputing it from a second reading of the membership rule. A writer
+ * that derived its own list would be the second definition of "gated" that
+ * `ratification_subject`'s header exists to prevent — and it would fail only
+ * for the diffs where the two lists disagree, which are exactly the diffs that
+ * widen the gated set.
+ */
+export function expectedSubjectFor(files: readonly string[], root: string): string {
+    return subjectDigest(root, files, derivedFor(root));
+}
+
 export interface GateResult {
@@ -399,7 +423,20 @@ export function evaluate(
     // `root` is the head, so a module present on either side is watched.
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
     const scanned = files.length;
 
+    /**
+     * The digest of this diff's gated content, recomputed from the tree rather
+     * than read from the record.
+     *
+     * WHICH FILES COUNT IS DECIDED BY THIS CODE, AND IN CI THIS CODE IS THE BASE
+     * REVISION'S. The workflow runs the base's copy of this gate with `--root
+     * <head>`, so the membership rule a candidate is judged by is one the
+     * candidate did not write — and the same holds for the digest, which uses
+     * this module's `classifyPaths` and the derived list computed just above.
+     * A change that widens the gated set is therefore judged, and written, by
+     * the same list.
+     */
+    const expectedSubject = expectedSubjectFor(files, root);
+
     // Every changed path is a planned target: the gate's denominator is the
@@ -496,3 +533,3 @@ export function evaluate(
         }
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
         if (isRatified(reading)) {
@@ -503,3 +540,4 @@ export function evaluate(
                     `(providers: ${reading.artifact?.providers.join(', ')}; ` +
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
             );
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
new file mode 100644
index 000000000..3dcc5b90e
--- /dev/null
+++ b/src/scripts/ratification_subject.ts
@@ -0,0 +1,104 @@
+#!/usr/bin/env tsx
+/**
+ * ratification_subject — print the `subject:` digest a ratification record must
+ * carry to answer for a given change.
+ *
+ * The record's six original fields say WHO reviewed and never WHAT, so a gated
+ * file edited after its review still landed under that review's record. The
+ * `subject` digest is what closes that, and it has to be the SAME digest the
+ * gate recomputes — which is why this prints it by calling
+ * `check_kernel_edit_ratified.expectedSubjectFor` rather than by re-deriving a
+ * second reading of which files are gated. A writer with its own list would
+ * disagree with the gate exactly on the changes that widen the gated set, which
+ * are the changes a record most needs to be right about.
+ *
+ * Usage: ratification_subject --files <path> [<path> …] [--root DIR]
+ *
+ * `--files` takes the change's WHOLE changed-file list, not its gated subset:
+ * which of them are gated is the gate's decision, not the caller's, and passing
+ * a pre-filtered list is how a caller silently substitutes its own classifier.
+ * Ungated paths are ignored, so `git diff --name-only <base>...HEAD` is the
+ * intended input.
+ *
+ * Exit codes: 0 = digest printed · 2 = usage error.
+ */
+
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
+import { gatedFilesOf } from './_lib/ratification_subject.js';
+
+const _HERE = fileURLToPath(import.meta.url);
+const REPO = path.resolve(path.dirname(_HERE), '..', '..');
+
+export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    const files: string[] = [];
+    let root = REPO;
+    let collecting = false;
+    let quiet = false;
+
+    for (let i = 0; i < argv.length; i += 1) {
+        const a = argv[i] ?? '';
+        if (a === '--files') {
+            collecting = true;
+            continue;
+        }
+        if (a === '--root') {
+            root = path.resolve(argv[i + 1] ?? '.');
+            i += 1;
+            collecting = false;
+            continue;
+        }
+        if (a === '--quiet') {
+            quiet = true;
+            collecting = false;
+            continue;
+        }
+        if (a.startsWith('--')) {
+            process.stderr.write(`error: unknown argument ${a}\n`);
+            return 2;
+        }
+        if (!collecting) {
+            process.stderr.write(`error: stray argument ${a} — paths follow --files\n`);
+            return 2;
+        }
+        files.push(a);
+    }
+
+    if (files.length === 0) {
+        process.stderr.write(
+            'usage: ratification_subject --files <path> [<path> …] [--root DIR]\n' +
+                '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
+        );
+        return 2;
+    }
+
+    const gated = gatedFilesOf(files);
+    const digest = expectedSubjectFor(files, root);
+
+    if (quiet) {
+        process.stdout.write(`${digest}\n`);
+        return 0;
+    }
+
+    // The gated list is printed with the digest on purpose: a digest over an
+    // empty list is a well-formed 64 hex characters and says nothing, so a
+    // caller who mistyped a path would otherwise copy a confident-looking
+    // answer about no files at all.
+    process.stdout.write(`subject: ${digest}\n`);
+    process.stdout.write(`\ngated files covered (${String(gated.length)}):\n`);
+    if (gated.length === 0) {
+        process.stdout.write(
+            '  (none — nothing in this change is gated, so no record is owed)\n',
+        );
+    }
+    for (const g of gated) {
+        process.stdout.write(`  · ${g}\n`);
+    }
+    return 0;
+}
+
+if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
+    process.exit(main());
+}
diff --git a/tests/scripts/check_kernel_edit_ratified.test.ts b/tests/scripts/check_kernel_edit_ratified.test.ts
index e4e133bf2..3e26a81f3 100644
--- a/tests/scripts/check_kernel_edit_ratified.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified.test.ts
@@ -10,0 +11 @@ import {
+    expectedSubjectFor,
@@ -32 +33,13 @@ let root: string;
-function writeArtifact(name: string, fields: Record<string, string>, providers: string[]): string {
+/**
+ * `gated` is the gated half of the diff this record is meant to answer for, and
+ * the record's `subject` is asked of the GATE rather than hand-written — a
+ * fixture that typed its own digest would prove a second implementation of the
+ * membership rule rather than the shipped one. The default is the kernel rule
+ * most of these cases edit; the two cases that edit something else pass theirs.
+ */
+function writeArtifact(
+    name: string,
+    fields: Record<string, string>,
+    providers: string[],
+    gated: readonly string[] = ['src/rules/commit-policy.md'],
+): string {
@@ -39,0 +53 @@ function writeArtifact(name: string, fields: Record<string, string>, providers:
+    lines.push(`subject: ${expectedSubjectFor(gated, root)}`);
@@ -244 +258 @@ describe('evaluate — G15', () => {
-        const rel = writeArtifact('plumbing.md', GOOD, ['anthropic', 'openai']);
+        const rel = writeArtifact('plumbing.md', GOOD, ['anthropic', 'openai'], diff);
@@ -264,0 +279 @@ describe('evaluate — G15', () => {
+            diff,
@@ -268 +283 @@ describe('evaluate — G15', () => {
-        const ratified = writeArtifact('ratified.md', GOOD, ['anthropic', 'openai']);
+        const ratified = writeArtifact('ratified.md', GOOD, ['anthropic', 'openai'], diff);
diff --git a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
index 0c4597afa..3de058943 100644
--- a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
@@ -18 +18,6 @@ import { afterEach, beforeEach, describe, expect, it } from 'vitest';
-import { classifyPaths, closureArrivals, evaluate } from '../../src/scripts/check_kernel_edit_ratified.js';
+import {
+    classifyPaths,
+    closureArrivals,
+    evaluate,
+    expectedSubjectFor,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
@@ -35,0 +41,4 @@ function writeRecord(): string {
+            // The content binding of 2026-10-12. Asked of the gate rather than
+            // typed, so this fixture proves the shipped membership rule and not
+            // a second reading of it.
+            `subject: ${expectedSubjectFor([POLICY], root)}`,
diff --git a/tests/scripts/check_kernel_edit_ratified_subject.test.ts b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
new file mode 100644
index 000000000..33c490efd
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
@@ -0,0 +1,143 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import { evaluate, expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';
+import {
+    RATIFICATION_DIR,
+    readRatification,
+} from '../../src/scripts/_lib/ratification_artifact.js';
+
+/**
+ * Step 2.2 — each record answers for its OWN change.
+ *
+ * Before the binding the gate passed when ANY one artifact in the changed-file
+ * list validated (`check_kernel_edit_ratified.ts`, the `anyRatified` loop), so
+ * a record written for one review carried a second change it never saw. The
+ * property these cases pin is therefore not "an invalid record is refused" —
+ * that was already true — but that a record which is valid IN EVERY OTHER
+ * RESPECT no longer carries a diff it did not review.
+ *
+ * That distinction is why each case here proves the foreign record is good:
+ * read against the content it was written for, it passes. If it were rejected
+ * for some unrelated defect the suite would be green for the wrong reason.
+ */
+
+let root: string;
+
+const KERNEL = 'src/rules/commit-policy.md';
+const OTHER_KERNEL = 'src/rules/non-destructive-by-default.md';
+
+function write(rel: string, body: string): void {
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    fs.writeFileSync(abs, body);
+}
+
+function recordText(subject: string, verdict = 'ratified'): string {
+    return [
+        '---',
+        'proposed_by: claude/session-a',
+        'implemented_by: claude/session-a',
+        'reviewed_by: council/anthropic+openai',
+        `subject: ${subject}`,
+        `verdict: ${verdict}`,
+        'effective_after: merge',
+        'providers:',
+        '  - anthropic',
+        '  - openai',
+        'seats:',
+        `  anthropic: ${verdict}`,
+        `  openai: ${verdict}`,
+        '---',
+        '',
+        '<!-- evidence-type: ratification -->',
+        '',
+        'Review body.',
+        '',
+    ].join('\n');
+}
+
+function record(name: string, subject: string, verdict = 'ratified'): string {
+    const rel = path.join(RATIFICATION_DIR, name);
+    write(rel, recordText(subject, verdict));
+    return rel;
+}
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kersub-'));
+    write(KERNEL, 'the content under review\n');
+    write(OTHER_KERNEL, 'a different rule entirely\n');
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('a record carries only the diff it reviewed', () => {
+    it('a record written for ANOTHER change does not carry this one', () => {
+        // Valid in every respect — and bound to a different rule's content.
+        const foreign = expectedSubjectFor([OTHER_KERNEL], root);
+        const rel = record('for-the-other-change.md', foreign);
+
+        // It is a good record: read against the content it was written for it
+        // validates completely. The gate still refuses it for THIS diff.
+        expect(readRatification(recordText(foreign), 2, foreign).problems).toEqual([]);
+
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('does not answer for this change');
+    });
+
+    it('a SECOND valid record for something else no longer carries the diff', () => {
+        // The pre-binding shape: two artifacts in one diff, one of them good,
+        // and "any one validates" let the other one through on its coat-tails.
+        const foreign = record('neighbour.md', expectedSubjectFor([OTHER_KERNEL], root));
+        const red = evaluate([KERNEL, foreign], root, 2);
+        expect(red.exitCode).toBe(1);
+
+        // Add the record that DID review this content and the same diff passes.
+        const mine = record('mine.md', expectedSubjectFor([KERNEL], root));
+        const green = evaluate([KERNEL, foreign, mine], root, 2);
+        expect(green.exitCode, green.lines.join('\n')).toBe(0);
+        // The one that did not answer is reported, not silently ignored.
+        expect(green.lines.join('\n')).toContain('did not validate');
+    });
+
+    it('a matching subject does not rescue a non-passing verdict', () => {
+        // The binding is an ADDITIONAL condition, never a replacement for the
+        // verdict rule — a record can review exactly this content and refuse it.
+        const rel = record('refused.md', expectedSubjectFor([KERNEL], root), 'refused');
+        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(1);
+    });
+
+    it('a matching subject does not rescue a self-ratified record', () => {
+        const rel = path.join(RATIFICATION_DIR, 'self.md');
+        write(
+            rel,
+            recordText(expectedSubjectFor([KERNEL], root)).replace(
+                'reviewed_by: council/anthropic+openai',
+                'reviewed_by: claude/session-a',
+            ),
+        );
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('may not record the ratification');
+    });
+});
+
+describe('records already on the trunk are not re-judged', () => {
+    it('a record on disk but NOT in the diff is never read', () => {
+        // The 23 records on the trunk carry no `subject` and need no migration:
+        // the gate reads only the artifacts the changed-file list names.
+        const onDisk = path.join(RATIFICATION_DIR, 'landed-long-ago.md');
+        write(onDisk, '---\nnot even frontmatter the reader would accept\n');
+
+        const mine = record('mine.md', expectedSubjectFor([KERNEL], root));
+        const r = evaluate([KERNEL, mine], root, 2);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+        expect(r.lines.join('\n')).not.toContain('landed-long-ago');
+    });
+});
diff --git a/tests/scripts/ratification_artifact.test.ts b/tests/scripts/ratification_artifact.test.ts
index 6e32ab28d..e5fb8674f 100644
--- a/tests/scripts/ratification_artifact.test.ts
+++ b/tests/scripts/ratification_artifact.test.ts
@@ -25,0 +26,4 @@ function artifact(overrides: Record<string, string> = {}, providers = ['anthropi
+        // A real record carries the digest of the content it reviewed. The
+        // fixture carries one too, so these cases exercise the shape an author
+        // actually writes rather than the pre-binding shape no new record has.
+        subject: 'a'.repeat(64),
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index c7479ecc2..a36fcadd0 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -23 +23,10 @@ const KERNEL = 'src/rules/commit-policy.md';
-const UNGATED = 'docs/contracts/ratification-artifact.md';
+/**
+ * A document the gate does not watch.
+ *
+ * This was `docs/contracts/ratification-artifact.md` until 2026-10-12, when
+ * step 4.1 put the artifact contract on the reviewer list and these two cases
+ * went red — correctly, and the red is worth recording here rather than being
+ * quietly edited away: a test naming a file as ungated is a claim about the
+ * gate's reach, and the claim expired the moment the reach grew.
+ */
+const UNGATED = 'docs/architecture.md';
@@ -96,0 +106,24 @@ describe('2.1 — the digest binds paths AND contents', () => {
+
+describe('the import cycle stays survivable, and a regression reds here', () => {
+    it('the gated set resolves when THIS module is the entry point', async () => {
+        // A council reviewer named the cycle fragile: the gate imports
+        // `subjectDigest` and this module imports the gate's path constants, so
+        // whichever Node evaluates second sees the other half-evaluated, and a
+        // module-scope read of those `const`s throws on the temporal dead zone.
+        // The mitigation is a read deferred to call time, and "a comment
+        // explains why" is not a control — this case is.
+        //
+        // The import below is deliberately dynamic and deliberately FIRST: it
+        // makes this module the entry point of the cycle, which is the order
+        // that breaks if the deferral is ever removed.
+        const mod = await import('../../src/scripts/_lib/ratification_subject.js');
+        expect(() => mod.gatedFilesOf([KERNEL])).not.toThrow();
+        expect([...mod.gatedFilesOf([KERNEL])]).toContain(KERNEL);
+
+        // And the self surface resolves through it, which is the half that
+        // reads the gate's binding rather than its own constants.
+        expect([...mod.gatedFilesOf(['src/scripts/check_kernel_edit_ratified.ts'])]).toContain(
+            'src/scripts/check_kernel_edit_ratified.ts',
+        );
+    });
+});
diff --git a/tests/scripts/ratification_subject_binding.test.ts b/tests/scripts/ratification_subject_binding.test.ts
new file mode 100644
index 000000000..d8a3ef7c1
--- /dev/null
+++ b/tests/scripts/ratification_subject_binding.test.ts
@@ -0,0 +1,273 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import { evaluate, expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';
+import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
+import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
+
+/**
+ * Step 2.1 — the record carries a digest of the gated content it reviewed.
+ *
+ * The defect this pins is the one the roadmap's Context names: the six required
+ * fields say WHO reviewed and never WHAT, so a gated file edited after its
+ * review still ships under a record that approved different content. Every case
+ * below makes its edit AFTER the record was written, which is the only shape in
+ * which that defect is visible — a test that wrote the record last could never
+ * see it.
+ *
+ * The expected digest is asked of the gate (`expectedSubjectFor`), never
+ * hand-written: a fixture carrying its own digest would prove a second
+ * implementation of the membership rule rather than the shipped one.
+ */
+
+let root: string;
+
+const KERNEL = 'src/rules/commit-policy.md';
+const OTHER_KERNEL = 'src/rules/non-destructive-by-default.md';
+const NEW_HOOK = 'src/scripts/hooks/block_new_surface.ts';
+
+function write(rel: string, body: string): void {
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    fs.writeFileSync(abs, body);
+}
+
+/** A valid record, bound to `gated` as the gate computes it at this instant. */
+function record(name: string, gated: readonly string[], verdict = 'ratified'): string {
+    const rel = path.join(RATIFICATION_DIR, name);
+    write(
+        rel,
+        [
+            '---',
+            'proposed_by: claude/session-a',
+            'implemented_by: claude/session-a',
+            'reviewed_by: council/anthropic+openai',
+            `subject: ${expectedSubjectFor(gated, root)}`,
+            `verdict: ${verdict}`,
+            'effective_after: merge',
+            'providers:',
+            '  - anthropic',
+            '  - openai',
+            'seats:',
+            `  anthropic: ${verdict}`,
+            `  openai: ${verdict}`,
+            '---',
+            '',
+            '<!-- evidence-type: ratification -->',
+            '',
+            'Review body.',
+            '',
+        ].join('\n'),
+    );
+    return rel;
+}
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('a record is bound to the gated content it reviewed', () => {
+    it('passes while the reviewed content is unchanged', () => {
+        write(KERNEL, 'reviewed content\n');
+        const rel = record('ok.md', [KERNEL]);
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+    });
+
+    it('ONE BYTE of a gated file changed after the review turns it red', () => {
+        write(KERNEL, 'reviewed content\n');
+        const rel = record('stale.md', [KERNEL]);
+
+        // The edit the record cannot have seen: one byte, after the fact.
+        write(KERNEL, 'reviewed contenu\n');
+
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('the record reviewed different content');
+    });
+
+    it('a record with NO subject is refused, and names what it is missing', () => {
+        write(KERNEL, 'reviewed content\n');
+        const rel = path.join(RATIFICATION_DIR, 'nosubject.md');
+        write(
+            rel,
+            [
+                '---',
+                'proposed_by: claude/session-a',
+                'implemented_by: claude/session-a',
+                'reviewed_by: council/anthropic+openai',
+                'verdict: ratified',
+                'effective_after: merge',
+                'providers:',
+                '  - anthropic',
+                '  - openai',
+                'seats:',
+                '  anthropic: ratified',
+                '  openai: ratified',
+                '---',
+                '',
+                'Body.',
+                '',
+            ].join('\n'),
+        );
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('missing `subject:`');
+    });
+
+    it('a malformed digest is reported as malformed, not as content that moved', () => {
+        write(KERNEL, 'reviewed content\n');
+        const rel = path.join(RATIFICATION_DIR, 'typo.md');
+        write(
+            rel,
+            [
+                '---',
+                'proposed_by: claude/session-a',
+                'implemented_by: claude/session-a',
+                'reviewed_by: council/anthropic+openai',
+                'subject: not-a-digest',
+                'verdict: ratified',
+                'effective_after: merge',
+                'providers:',
+                '  - anthropic',
+                '  - openai',
+                'seats:',
+                '  anthropic: ratified',
+                '  openai: ratified',
+                '---',
+                '',
+                'Body.',
+                '',
+            ].join('\n'),
+        );
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('is not a sha-256 hex digest');
+        expect(r.lines.join('\n')).not.toContain('the record reviewed different content');
+    });
+});
+
+describe('a moved base moves the digest only where it moved gated content', () => {
+    it('a base that moved on an UNGATED file leaves the record valid', () => {
+        write(KERNEL, 'reviewed content\n');
+        write('README.md', 'before\n');
+        const rel = record('base-ungated.md', [KERNEL]);
+
+        // The base advances on files the digest does not cover.
+        write('README.md', 'after, and quite different\n');
+        write('docs/architecture.md', 'new\n');
+
+        const r = evaluate([KERNEL, rel], root, 2);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+    });
+
+    it('a base that moved on a GATED file the change also touches turns it red', () => {
+        write(KERNEL, 'reviewed content\n');
+        const rel = record('base-gated.md', [KERNEL]);
+
+        // The content that would land is not the content that was reviewed —
+        // which is precisely what should move the digest.
+        write(KERNEL, 'reviewed content, plus a line the base added\n');
+
+        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(1);
+    });
+
+    it('a gated file OUTSIDE this diff does not enter this diff’s digest', () => {
+        write(KERNEL, 'reviewed content\n');
+        write(OTHER_KERNEL, 'before\n');
+        const rel = record('neighbour.md', [KERNEL]);
+
+        // Another kernel rule changes, but it is not in this change's file list.
+        write(OTHER_KERNEL, 'after\n');
+
+        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(0);
+    });
+});
+
+describe('a change that widens the gated set is judged and written by one list', () => {
+    it('a newly added governance hook is inside the digest it is written with', () => {
+        write(KERNEL, 'reviewed content\n');
+        write(NEW_HOOK, 'export function main(): number {\n    return 0;\n}\n');
+        const files = [KERNEL, NEW_HOOK];
+
+        // The writer's list and the gate's list are the same list.
+        expect([...gatedFilesOf(files)]).toEqual([KERNEL, NEW_HOOK].sort());
+
+        const rel = record('widening.md', files);
+        expect(evaluate([...files, rel], root, 2).exitCode).toBe(0);
+
+        // And the newly gated file is genuinely covered: editing it after the
+        // review reds, which is what "widens the gated set" has to mean.
+        write(NEW_HOOK, 'export function main(): number {\n    return 1;\n}\n');
+        expect(evaluate([...files, rel], root, 2).exitCode).toBe(1);
+    });
+
+    it('a deleted gated file is entered, not skipped', () => {
+        write(KERNEL, 'reviewed content\n');
+        write(NEW_HOOK, 'export function main(): number {\n    return 0;\n}\n');
+        const files = [KERNEL, NEW_HOOK];
+        const rel = record('deletion.md', files);
+
+        // Removing a governance hook is the change a record most needs to be
+        // bound to; if deletion were skipped this would stay green.
+        fs.rmSync(path.join(root, NEW_HOOK));
+        expect(evaluate([...files, rel], root, 2).exitCode).toBe(1);
+    });
+});
+
+describe('a gated path that is a symlink is hashed as the link', () => {
+    it('the digest follows the LINK, not what it currently points at', () => {
+        // `readFileSync` dereferences, so a gated path committed as a symlink
+        // was hashed as its target's bytes -- content that lives outside the
+        // reviewed revision and can differ between two clean checkouts of the
+        // same commit. Git stores a symlink as a blob holding its target
+        // string; that is what the digest now describes.
+        write('outside.txt', 'first\n');
+        fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
+        fs.symlinkSync(path.join(root, 'outside.txt'), path.join(root, KERNEL));
+
+        const before = expectedSubjectFor([KERNEL], root);
+
+        // The target changes. The committed object did not, so the digest must
+        // not move -- this is the case that was broken.
+        write('outside.txt', 'second, and quite different\n');
+        expect(expectedSubjectFor([KERNEL], root)).toBe(before);
+
+        // Re-pointing the link IS a change to the committed object.
+        fs.unlinkSync(path.join(root, KERNEL));
+        write('elsewhere.txt', 'first\n');
+        fs.symlinkSync(path.join(root, 'elsewhere.txt'), path.join(root, KERNEL));
+        expect(expectedSubjectFor([KERNEL], root)).not.toBe(before);
+    });
+
+    it('a BROKEN link is a link, not a deletion', () => {
+        fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
+        fs.symlinkSync(path.join(root, 'never-existed.txt'), path.join(root, KERNEL));
+        const asBrokenLink = expectedSubjectFor([KERNEL], root);
+
+        // `existsSync` reported a broken link as absent, which digested it as a
+        // removal -- the one change the record most needs to be bound to.
+        fs.unlinkSync(path.join(root, KERNEL));
+        const asDeleted = expectedSubjectFor([KERNEL], root);
+
+        expect(asBrokenLink).not.toBe(asDeleted);
+    });
+
+    it('a regular file whose bytes equal a link target does not collide with it', () => {
+        fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
+        write('target.txt', 'x\n');
+        fs.symlinkSync(path.join(root, 'target.txt'), path.join(root, KERNEL));
+        const asLink = expectedSubjectFor([KERNEL], root);
+
+        fs.unlinkSync(path.join(root, KERNEL));
+        write(KERNEL, 'x\n');
+        expect(expectedSubjectFor([KERNEL], root)).not.toBe(asLink);
+    });
+});
```
