<!-- evidence-type: analysis -->

<!-- The prompt given to round 2 of the modification review on 2026-10-13,
     committed verbatim so the record beside it can be checked against what
     was actually asked (evaluator-independence: a recorded verdict whose
     prompt is not recoverable is not evidence). Not edited after the run. -->

# Modification review, round 2 — your four findings, each fixed with its test

This is round 2 of the modification review you answered on 2026-10-13. The
change under review is the same narrowed content binding; **round 1's diff is
unchanged except where your findings touched it**, and below is exactly what
changed in response, at full context. Answer the nine questions again, one at a
time, and close with a stance line.

Both seats closed round 1 on REQUEST_CHANGES / `refused`. Both answered
question 7 with "no — appropriately minimal after staging", so this round is
not about scope. It is about four implementation defects you named.

## What you found, and what was done about each

**1. The fail-open `lstat`, which both seats called the blocker.**

> "`catch { stat = null; }` ... treats a permission error or I/O failure
> identically to 'file doesn't exist'. A gated file that's unreadable would
> hash as deleted" — and: "an attacker who can trigger a permission error can
> force a digest to exclude that file's real content. This is fail-open on the
> enforcement primitive."

Fixed. Only `ENOENT` and `ENOTDIR` mean absent. Every other code raises
`GatedFileUnreadable`, and the gate turns it into a refusal before its own
"nothing to ratify" exit. Test: the parent directory is `chmod 000` (not the
file — `lstat` reads the parent's entry), the digest must throw, and it must
specifically not equal the deletion digest; skipped as root, where permission
bits mean nothing. Polarity partner: a genuinely absent file is still the
deletion marker, so failing closed on EACCES did not make ENOENT throw too.

**2. The CLI printed a coverage list it had classified separately.**

> "`ratification_subject` calls `gatedFilesOf(files)` while `expectedSubjectFor`
> calls `gatedFilesOf(files, derived)`. The displayed coverage list and the
> actual digest could classify differently." — and: "The safeguard can
> therefore emit the exact false reassurance it claims to prevent."

Fixed as you specified: one operation, `subjectOf(root, files, derived)`,
returning `{ digest, gatedFiles }` from one classification.
`expectedSubjectFor` returns that object, the gate takes `.digest`, the CLI
destructures both. `subjectDigest` survives as a projection of the same call,
not a second implementation. Test: every file the reading names moves the
digest, and nothing else does.

**3. The `UNGATED` fixture contradiction.**

> "the test comment says 'step 4.1 put the artifact contract on the reviewer
> list', past tense, yet the description says the gated path set is back to
> origin/main's ~15 paths. These directly contradict." — and: "Replacing the
> fixture keeps the test green while avoiding an explicit test of the disputed
> path. Add a direct classification assertion."

You were right, and the second reading is the correct one: the fixture was
moved on 2026-10-12 when step 4.1 gated the contract, 4.1 came off the branch
on 2026-10-13, and the fixture stayed. It is back to
`docs/contracts/ratification-artifact.md`, its comment records both moves and
why the second was a finding, and there is now a direct assertion —
`classifyPaths(['docs/contracts/ratification-artifact.md']).self === false`,
with a polarity partner so it is not green because the classifier says false to
everything.

**4. Path containment, which you asked to be made explicit and tested.**

> "The shown code does not itself demonstrate that absolute paths and `..`
> traversal are rejected before `path.join(root, rel)`."

Writing that test found a hole rather than confirming its absence. The gate's
`KERNEL_RULE_PATH_RE` is `(?:^|/)rules/([a-z0-9-]+)\.md$` — **not anchored at
the start** — so `../../elsewhere/rules/commit-policy.md` classifies as a
kernel rule. That was harmless while the gate read only path names, and stopped
being harmless the moment this change began joining those names to a root and
reading the bytes. So the containment is in the digest, with the read:
absolute paths and `..` segments raise `GatedPathEscapes`. It **refuses**
rather than dropping, because dropping would make the digest cover less than
the gate gated — the divergence finding 2 is about. Tightening the regex itself
is a change to the gate's classification and is left as a separate, gated
concern rather than folded in here.

**Also fixed, both named by a seat:** `--root` with no value silently resolved
`.` and is now a usage error; and the contract's "makes impossible" and "a
record carries one change" are corrected to what the binding does. It
**detects** a gated file edited after its review and a record reused for
content it does not match. It prevents neither: an author who edits and
recomputes produces a record the gate accepts, and the contract now says so in
those words.

**Not done, and why.** You raised the import-cycle test's cache sensitivity —
"a dynamic import is not necessarily 'deliberately FIRST' when other test
modules have populated Node's module cache". That is correct and the test's
prose overclaims. It is left for the step that owns the cycle rather than
edited here, because the cycle exists only while the digest module is ungated
(step 4.1) and the right repair is removing the cycle, not re-wording a test
about it. Say if you disagree and it comes into this change.

## Every new test was seen RED

Each fix was neutralised in turn and the suite re-run. Measured:
fail-closed `lstat` → red · path containment → red · one classification for
list and digest → red · the contract-is-ungated assertion → red. A test never
seen red has unknown sensitivity, so this is stated as a measurement rather
than as a claim that the tests are good.

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

Close with a stance line carrying `ratified`, `confirmed-non-expanding`,
`refused` or `non-convergent`. `confirmed-non-expanding` is for a change that
touches a governance surface without expanding anyone's authority: same bar as
`ratified`, a classification and not a weaker approval.

## The diff of the fixes — full context, nothing elided

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index eaf08867c..06e8ce6a4 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -76,12 +76,15 @@ deleted gated file entered rather than skipped. `./scripts-run
 src/scripts/ratification_subject --files <f> …` prints it, and
 `check_kernel_edit_ratified` recomputes it from the tree it is pointed at and
 refuses a record whose `subject` is absent (`subject-absent`), not a digest
-(`subject-malformed`) or a different one (`subject-mismatch`).
+(`subject-malformed`) or a different one (`subject-mismatch`). A gated path it
+cannot read, or one that would resolve outside the tree, is a refusal too —
+an unreadable file is not a deleted one, and a digest that described either as
+the other would be the fail-open shape this mechanism exists to refuse.
 
 | What it adds | Why the other seven did not |
 |---|---|
 | the record says WHAT it reviewed | the six required fields say only WHO; a gated file edited after its review still landed on that review's record |
-| a record carries one change | the gate passed when **any** artifact in the diff validated, so a record written for one review carried a second change it never saw |
+| a record is checked against the content it is read beside | the gate passed when **any** artifact in the diff validated, so a record written for one review carried a second change it never saw. It does not establish that a record covers one *logical* change: the digest is over the whole gated file set of the diff |
 
 Three properties of the digest, each chosen against an alternative that looks
 equivalent and is not:
@@ -671,9 +674,14 @@ state. Steps 2.1 and 2.2 of
 The digest is computed by the gate from the tree and typed into the record by
 whoever writes it, so a record still asserts rather than proves that a review
 happened over that content — § What a passing record does not prove is
-unchanged and is the paragraph that matters. What it now makes impossible is
-narrower and real: a gated file edited after its review landing under that
-review's record, and one record carrying a second change it never saw.
+unchanged and is the paragraph that matters. An author who edits gated content
+and recomputes the digest produces a record the gate accepts, and nothing here
+detects that; the word for what the binding adds is **detects**, never
+*prevents*. What it detects is narrow and real: a gated file edited after its
+review, still carrying the digest of what the reviewers saw, and a record
+reused for a change whose content it does not match. A 2026-10-13 council
+review asked for this sentence in these words, because the paragraph it
+replaces claimed to make those two things impossible.
 
 **One consequence worth stating because it will be met before it is read.** The
 workflow runs the BASE revision's copy of the gate, so a change that is open
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index b11fd508b..02143eaf7 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -67,6 +67,71 @@ export const DELETED_MARKER = '\u0000deleted\u0000';
  */
 export const SYMLINK_MARKER = '\u0000symlink\u0000';
 
+/**
+ * Raised when a gated path exists but cannot be read.
+ *
+ * A 2026-10-13 council review refused the change over the shape this
+ * replaces: every `lstat` failure became `null`, and `null` is the DELETION
+ * marker — so a permission error, an I/O error or a transient filesystem
+ * failure on a gated file produced the digest of a tree in which that file
+ * had been removed. Both seats named it, and one named the consequence that
+ * makes it more than untidy: anyone who can provoke such an error on a gated
+ * path can force its real content out of the digest.
+ *
+ * Only ENOENT and ENOTDIR mean ABSENT. Everything else is a checkout this
+ * code cannot describe, and describing it anyway is the fail-open move a
+ * previous round of this same review already refused once.
+ */
+export class GatedPathEscapes extends Error {
+    constructor(readonly rel: string) {
+        super(
+            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so joining it to ` +
+                'the tree root would read outside the revision under review — the digest refuses ' +
+                'rather than describing content that is not in the change',
+        );
+        this.name = 'GatedPathEscapes';
+    }
+}
+
+/**
+ * Refuse a gated path that would read outside `root`.
+ *
+ * FOUND BY THE TEST THAT PINS IT, on a 2026-10-13 council question: the gate's
+ * `KERNEL_RULE_PATH_RE` is `(?:^|\/)rules\/([a-z0-9-]+)\.md$`, which is NOT
+ * anchored at the start, so `../../elsewhere/rules/commit-policy.md` classifies
+ * as a kernel rule. That was harmless while the gate only read path NAMES. It
+ * stopped being harmless the moment this module began joining those names to a
+ * root and reading the bytes, which is what the content binding does — so the
+ * containment belongs here, with the read, and it FAILS CLOSED rather than
+ * dropping the path: dropping it would make the digest cover less than the gate
+ * gated, which is the divergence the same review refused elsewhere.
+ *
+ * Tightening the gate's own regex is a change to the gate's classification and
+ * therefore a separate, gated concern. This bound holds whatever that regex
+ * does.
+ */
+const ESCAPING_SEGMENT = /(?:^|\/)\.\.(?:\/|$)/u;
+
+function assertContained(rel: string): void {
+    if (rel.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(rel) || ESCAPING_SEGMENT.test(rel)) {
+        throw new GatedPathEscapes(rel);
+    }
+}
+
+export class GatedFileUnreadable extends Error {
+    constructor(
+        readonly rel: string,
+        readonly cause: NodeJS.ErrnoException,
+    ) {
+        super(
+            `gated path \`${rel}\` exists but could not be read ` +
+                `(${cause.code ?? cause.message}) — the digest refuses to describe a tree it ` +
+                'could not read, because an unreadable file is not a deleted one',
+        );
+        this.name = 'GatedFileUnreadable';
+    }
+}
+
 /**
  * The self surface, by the gate's own constants rather than a copy of them.
  *
@@ -109,30 +174,52 @@ export function gatedFilesOf(
     for (const f of normalized) {
         if (self.has(f)) out.add(f);
     }
-    return [...out].sort();
+    const sorted = [...out].sort();
+    for (const rel of sorted) {
+        assertContained(rel);
+    }
+    return sorted;
+}
+
+/** A digest and, from the SAME classification, exactly what it covers. */
+export interface SubjectReading {
+    /** The `subject` a record must carry to answer for this change. */
+    readonly digest: string;
+    /** The gated files that digest is taken over, sorted. */
+    readonly gatedFiles: readonly string[];
 }
 
 /**
  * One digest over the sorted paths AND contents of the gated files, read from
- * `root`.
+ * `root`, together with the list it covers.
  *
  * The path is hashed alongside its content, so two files with identical bytes
  * do not collide and a rename moves the digest — a gated file moved to another
- * gated path is a different change, not the same one.
+ * gated path is a different change, not the same one. The separator is NUL,
+ * which no path on any supported filesystem may contain, and the content slot
+ * is a fixed-width 64-character hex digest — so the serialisation is
+ * unambiguous and no crafted path can reproduce another file's framing.
  *
  * `derived` is the plumbing closure the caller already computed, passed through
  * to {@link gatedFilesOf} unchanged. The gate HAS that list and classifies with
  * it; a digest that classified without it would cover fewer files than the gate
  * gated, so a record could be bound to a subset of what was reviewed. One list,
  * handed down, rather than two computed independently.
+ *
+ * RETURNS THE LIST RATHER THAN LETTING A CALLER RE-DERIVE IT. The 2026-10-13
+ * review found the CLI printing `gatedFilesOf(files)` while the digest came
+ * from `gatedFilesOf(files, derivedFor(root))` — two classifications with
+ * different inputs, so the coverage a human copied alongside a digest could
+ * disagree with what that digest actually covered. One call, one answer.
  */
-export function subjectDigest(
+export function subjectOf(
     root: string,
     files: readonly string[],
     derived?: readonly string[],
-): string {
+): SubjectReading {
+    const gatedFiles = gatedFilesOf(files, derived);
     const h = createHash('sha256');
-    for (const rel of gatedFilesOf(files, derived)) {
+    for (const rel of gatedFiles) {
         const abs = path.join(root, rel);
         // `lstat` rather than `existsSync`: the latter follows the link and
         // reports a broken symlink as absent, which would digest a link as a
@@ -141,8 +228,19 @@ export function subjectDigest(
         let stat: fs.Stats | null = null;
         try {
             stat = fs.lstatSync(abs);
-        } catch {
-            stat = null;
+        } catch (err) {
+            const code = (err as NodeJS.ErrnoException).code;
+            // ABSENT is two codes and no more. ENOENT is the file not being
+            // there; ENOTDIR is a parent component not being a directory,
+            // which is the same statement about a path that does not resolve.
+            // EACCES, EPERM, EIO, ELOOP and everything else say the file may
+            // well be there and this process could not look — a different
+            // fact, and not one a deletion marker may stand in for.
+            if (code === 'ENOENT' || code === 'ENOTDIR') {
+                stat = null;
+            } else {
+                throw new GatedFileUnreadable(rel, err as NodeJS.ErrnoException);
+            }
         }
         if (stat === null) {
             content = Buffer.from(DELETED_MARKER);
@@ -156,5 +254,19 @@ export function subjectDigest(
         h.update(createHash('sha256').update(content).digest('hex'));
         h.update('\n');
     }
-    return h.digest('hex');
+    return { digest: h.digest('hex'), gatedFiles };
+}
+
+/**
+ * The digest alone, for a caller that has no use for the covered list.
+ *
+ * Delegates rather than re-implementing: there is ONE classification and ONE
+ * hashing loop, and this is a projection of its result.
+ */
+export function subjectDigest(
+    root: string,
+    files: readonly string[],
+    derived?: readonly string[],
+): string {
+    return subjectOf(root, files, derived).digest;
 }
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index e7a5e24a6..a5d08417b 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -85,7 +85,11 @@ import {
     readRequiredProviders,
     type RatificationProblem,
 } from './_lib/ratification_artifact.js';
-import { subjectDigest } from './_lib/ratification_subject.js';
+import {
+    GatedFileUnreadable,
+    subjectOf,
+    type SubjectReading,
+} from './_lib/ratification_subject.js';
 
 const _HERE = fileURLToPath(import.meta.url);
 const REPO = path.resolve(path.dirname(_HERE), '..', '..');
@@ -392,7 +396,8 @@ function derivedFor(root: string): readonly string[] {
 }
 
 /**
- * The `subject` digest a record must carry to answer for this diff.
+ * The `subject` digest a record must carry to answer for this diff, AND the
+ * gated files it covers — from one classification, never two.
  *
  * Exported so that whoever WRITES a record asks the gate for the digest rather
  * than recomputing it from a second reading of the membership rule. A writer
@@ -400,9 +405,18 @@ function derivedFor(root: string): readonly string[] {
  * `ratification_subject`'s header exists to prevent — and it would fail only
  * for the diffs where the two lists disagree, which are exactly the diffs that
  * widen the gated set.
+ *
+ * RETURNS BOTH HALVES because a 2026-10-13 council review found the CLI
+ * printing a coverage list it had classified separately, with a different
+ * `derived` input, beside a digest classified here. A list that can disagree
+ * with the digest it is printed next to is the exact false reassurance that
+ * list exists to prevent, so there is now one call and one answer.
+ *
+ * THROWS {@link GatedFileUnreadable} when a gated path exists and cannot be
+ * read. Callers turn that into a refusal; none of them may continue.
  */
-export function expectedSubjectFor(files: readonly string[], root: string): string {
-    return subjectDigest(root, files, derivedFor(root));
+export function expectedSubjectFor(files: readonly string[], root: string): SubjectReading {
+    return subjectOf(root, files, derivedFor(root));
 }
 
 export interface GateResult {
@@ -425,20 +439,6 @@ export function evaluate(
     const gated = classifyPaths(files, derived);
     const scanned = files.length;
 
-    /**
-     * The digest of this diff's gated content, recomputed from the tree rather
-     * than read from the record.
-     *
-     * WHICH FILES COUNT IS DECIDED BY THIS CODE, AND IN CI THIS CODE IS THE BASE
-     * REVISION'S. The workflow runs the base's copy of this gate with `--root
-     * <head>`, so the membership rule a candidate is judged by is one the
-     * candidate did not write — and the same holds for the digest, which uses
-     * this module's `classifyPaths` and the derived list computed just above.
-     * A change that widens the gated set is therefore judged, and written, by
-     * the same list.
-     */
-    const expectedSubject = expectedSubjectFor(files, root);
-
     // Every changed path is a planned target: the gate's denominator is the
     // whole diff, and a path it decided was out of scope is a decision worth
     // counting rather than a silence.
@@ -479,6 +479,34 @@ export function evaluate(
         );
     };
 
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
+    let expectedSubject: string;
+    try {
+        expectedSubject = expectedSubjectFor(files, root).digest;
+    } catch (err) {
+        // Fail closed, and before the "nothing to ratify" exit: a gated path
+        // this process could not read is a checkout the gate cannot describe,
+        // and a gate that cannot describe the content cannot say a record
+        // answers for it.
+        if (!(err instanceof GatedFileUnreadable)) {
+            throw err;
+        }
+        lines.push(`❌  ${err.message}`);
+        close(false);
+        return { exitCode: 1, lines, scanned };
+    }
+
     if (!requiresRatification(gated)) {
         lines.push(
             '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
index 3dcc5b90e..4e2227746 100644
--- a/src/scripts/ratification_subject.ts
+++ b/src/scripts/ratification_subject.ts
@@ -27,7 +27,6 @@ import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
-import { gatedFilesOf } from './_lib/ratification_subject.js';
 
 const _HERE = fileURLToPath(import.meta.url);
 const REPO = path.resolve(path.dirname(_HERE), '..', '..');
@@ -45,7 +44,16 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             continue;
         }
         if (a === '--root') {
-            root = path.resolve(argv[i + 1] ?? '.');
+            // A missing value used to resolve `.` silently. For a command whose
+            // output is copied into a governance record, "it quietly used the
+            // current directory" is the wrong failure: the digest would be
+            // taken over a tree the caller never named.
+            const value = argv[i + 1];
+            if (value === undefined || value.startsWith('--')) {
+                process.stderr.write('error: --root takes a directory\n');
+                return 2;
+            }
+            root = path.resolve(value);
             i += 1;
             collecting = false;
             continue;
@@ -74,8 +82,13 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
         return 2;
     }
 
-    const gated = gatedFilesOf(files);
-    const digest = expectedSubjectFor(files, root);
+    // ONE call for both halves. A 2026-10-13 council review found this
+    // function printing `gatedFilesOf(files)` — a second classification, with a
+    // different `derived` input — beside a digest classified by the gate. The
+    // list exists so nobody copies a confident-looking digest over no files;
+    // a list that can disagree with its own digest emits exactly that false
+    // reassurance instead of preventing it.
+    const { digest, gatedFiles: gated } = expectedSubjectFor(files, root);
 
     if (quiet) {
         process.stdout.write(`${digest}\n`);
diff --git a/tests/scripts/check_kernel_edit_ratified.test.ts b/tests/scripts/check_kernel_edit_ratified.test.ts
index 3e26a81f3..fad74d3b0 100644
--- a/tests/scripts/check_kernel_edit_ratified.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified.test.ts
@@ -50,7 +50,7 @@ function writeArtifact(
     for (const [k, v] of Object.entries(fields)) {
         lines.push(`${k}: ${v}`);
     }
-    lines.push(`subject: ${expectedSubjectFor(gated, root)}`);
+    lines.push(`subject: ${expectedSubjectFor(gated, root).digest}`);
     lines.push('providers:');
     for (const p of providers) {
         lines.push(`  - ${p}`);
diff --git a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
index 3de058943..1497ca3e9 100644
--- a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
@@ -41,7 +41,7 @@ function writeRecord(): string {
             // The content binding of 2026-10-12. Asked of the gate rather than
             // typed, so this fixture proves the shipped membership rule and not
             // a second reading of it.
-            `subject: ${expectedSubjectFor([POLICY], root)}`,
+            `subject: ${expectedSubjectFor([POLICY], root).digest}`,
             'verdict: ratified',
             'effective_after: merge',
             'providers:',
diff --git a/tests/scripts/check_kernel_edit_ratified_subject.test.ts b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
index 33c490efd..9030466a4 100644
--- a/tests/scripts/check_kernel_edit_ratified_subject.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
@@ -79,7 +79,7 @@ afterEach(() => {
 describe('a record carries only the diff it reviewed', () => {
     it('a record written for ANOTHER change does not carry this one', () => {
         // Valid in every respect — and bound to a different rule's content.
-        const foreign = expectedSubjectFor([OTHER_KERNEL], root);
+        const foreign = expectedSubjectFor([OTHER_KERNEL], root).digest;
         const rel = record('for-the-other-change.md', foreign);
 
         // It is a good record: read against the content it was written for it
@@ -94,12 +94,12 @@ describe('a record carries only the diff it reviewed', () => {
     it('a SECOND valid record for something else no longer carries the diff', () => {
         // The pre-binding shape: two artifacts in one diff, one of them good,
         // and "any one validates" let the other one through on its coat-tails.
-        const foreign = record('neighbour.md', expectedSubjectFor([OTHER_KERNEL], root));
+        const foreign = record('neighbour.md', expectedSubjectFor([OTHER_KERNEL], root).digest);
         const red = evaluate([KERNEL, foreign], root, 2);
         expect(red.exitCode).toBe(1);
 
         // Add the record that DID review this content and the same diff passes.
-        const mine = record('mine.md', expectedSubjectFor([KERNEL], root));
+        const mine = record('mine.md', expectedSubjectFor([KERNEL], root).digest);
         const green = evaluate([KERNEL, foreign, mine], root, 2);
         expect(green.exitCode, green.lines.join('\n')).toBe(0);
         // The one that did not answer is reported, not silently ignored.
@@ -109,7 +109,7 @@ describe('a record carries only the diff it reviewed', () => {
     it('a matching subject does not rescue a non-passing verdict', () => {
         // The binding is an ADDITIONAL condition, never a replacement for the
         // verdict rule — a record can review exactly this content and refuse it.
-        const rel = record('refused.md', expectedSubjectFor([KERNEL], root), 'refused');
+        const rel = record('refused.md', expectedSubjectFor([KERNEL], root).digest, 'refused');
         expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(1);
     });
 
@@ -117,7 +117,7 @@ describe('a record carries only the diff it reviewed', () => {
         const rel = path.join(RATIFICATION_DIR, 'self.md');
         write(
             rel,
-            recordText(expectedSubjectFor([KERNEL], root)).replace(
+            recordText(expectedSubjectFor([KERNEL], root).digest).replace(
                 'reviewed_by: council/anthropic+openai',
                 'reviewed_by: claude/session-a',
             ),
@@ -135,7 +135,7 @@ describe('records already on the trunk are not re-judged', () => {
         const onDisk = path.join(RATIFICATION_DIR, 'landed-long-ago.md');
         write(onDisk, '---\nnot even frontmatter the reader would accept\n');
 
-        const mine = record('mine.md', expectedSubjectFor([KERNEL], root));
+        const mine = record('mine.md', expectedSubjectFor([KERNEL], root).digest);
         const r = evaluate([KERNEL, mine], root, 2);
         expect(r.exitCode, r.lines.join('\n')).toBe(0);
         expect(r.lines.join('\n')).not.toContain('landed-long-ago');
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index a36fcadd0..496b01340 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -6,8 +6,15 @@ import * as path from 'node:path';
 import {
     gatedFilesOf,
     subjectDigest,
+    subjectOf,
     DELETED_MARKER,
+    GatedFileUnreadable,
+    GatedPathEscapes,
 } from '../../src/scripts/_lib/ratification_subject.js';
+import {
+    classifyPaths,
+    expectedSubjectFor,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
 
 function tmpTree(files: Readonly<Record<string, string>>): string {
     const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
@@ -21,15 +28,23 @@ function tmpTree(files: Readonly<Record<string, string>>): string {
 
 const KERNEL = 'src/rules/commit-policy.md';
 /**
- * A document the gate does not watch.
+ * A document the gate does not watch — the artifact contract itself.
+ *
+ * THIS FIXTURE MOVED AND MOVED BACK, and both moves are recorded because the
+ * second was a finding. On 2026-10-12 step 4.1 put the contract on the gate's
+ * reviewer list, these cases went red correctly, and the fixture was
+ * re-pointed at `docs/architecture.md`. On 2026-10-13 step 4.1 was staged off
+ * the branch on a council's `smaller-change` answer — and the re-pointed
+ * fixture stayed, with a comment still saying the contract was gated. Both
+ * seats of the next review caught it and said what it actually was: a fixture
+ * kept green across a revert, documenting a reach the gate no longer has.
  *
- * This was `docs/contracts/ratification-artifact.md` until 2026-10-12, when
- * step 4.1 put the artifact contract on the reviewer list and these two cases
- * went red — correctly, and the red is worth recording here rather than being
- * quietly edited away: a test naming a file as ungated is a claim about the
- * gate's reach, and the claim expired the moment the reach grew.
+ * So it is back, and the case below asserts the classification DIRECTLY rather
+ * than only through the digest, which is what the reviewers asked for: a test
+ * that says in one line whether this path is gated in THIS revision cannot
+ * survive the next move of that boundary silently.
  */
-const UNGATED = 'docs/architecture.md';
+const UNGATED = 'docs/contracts/ratification-artifact.md';
 
 describe('2.1 — the gated set, assembled from the gate’s own constants', () => {
     it('keeps a kernel rule and drops an ungated file', () => {
@@ -39,6 +54,18 @@ describe('2.1 — the gated set, assembled from the gate’s own constants', ()
         expect(g).not.toContain('README.md');
     });
 
+    it('the artifact contract is NOT gated in this revision, said directly', () => {
+        // The reach of the gate, asserted as a fact about this revision rather
+        // than inferred from a digest that happens not to move. Step 4.1 of
+        // `road-to-self-modification-that-a-council-must-pass` is what would
+        // make this red, and when it lands this case is the one that says so.
+        expect(classifyPaths(['docs/contracts/ratification-artifact.md']).self).toBe(false);
+        expect(gatedFilesOf(['docs/contracts/ratification-artifact.md'])).toEqual([]);
+        // The polarity partner, so the assertion above is not green because
+        // `classifyPaths` returns false for everything.
+        expect(classifyPaths(['src/scripts/check_kernel_edit_ratified.ts']).self).toBe(true);
+    });
+
     it('keeps a self path — which `classifyPaths` reports only as a boolean', () => {
         const g = gatedFilesOf(['src/scripts/check_kernel_edit_ratified.ts', 'README.md']);
         expect(g).toEqual(['src/scripts/check_kernel_edit_ratified.ts']);
@@ -104,6 +131,147 @@ describe('2.1 — the digest binds paths AND contents', () => {
     });
 });
 
+describe('a gated file that cannot be read is not a gated file that was deleted', () => {
+    /**
+     * The defect this pins, named by both seats of the 2026-10-13 review.
+     *
+     * `catch { stat = null; }` turned EVERY `lstat` failure into the deletion
+     * marker, so a permission error on a gated path produced the digest of a
+     * tree in which that path had been removed — and anyone able to provoke
+     * such an error could force a gated file's real content out of the digest.
+     * It is the same fail-open shape a previous round of this review already
+     * refused once, in a different function.
+     *
+     * The parent directory is what loses its mode, not the file: `lstat` reads
+     * the parent's entry, so a mode-000 FILE still stats fine. Root ignores
+     * permission bits entirely, so the case skips there rather than passing
+     * vacuously.
+     */
+    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
+
+    it.skipIf(asRoot)('throws rather than hashing it as absent', () => {
+        const root = tmpTree({ [KERNEL]: 'one\n' });
+        const dir = path.dirname(path.join(root, KERNEL));
+        const deletedDigest = subjectDigest(tmpTree({ 'README.md': 'x\n' }), [KERNEL]);
+        fs.chmodSync(dir, 0o000);
+        try {
+            expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
+            // And specifically NOT the deletion digest, which is the outcome
+            // the old shape produced silently.
+            let produced: string | null = null;
+            try {
+                produced = subjectDigest(root, [KERNEL]);
+            } catch {
+                produced = null;
+            }
+            expect(produced).not.toBe(deletedDigest);
+        } finally {
+            fs.chmodSync(dir, 0o755);
+        }
+    });
+
+    it('a genuinely absent gated file is still the deletion marker', () => {
+        // The polarity partner: failing closed on EACCES must not make ENOENT
+        // throw too, or every ordinary deletion would red the gate.
+        const absent = tmpTree({ 'README.md': 'x\n' });
+        expect(() => subjectDigest(absent, [KERNEL])).not.toThrow();
+        expect(DELETED_MARKER).toContain('deleted');
+    });
+});
+
+describe('the serialisation is unambiguous — a byte cannot move between path and content', () => {
+    /**
+     * Framing, asked for by both seats of the 2026-10-13 review.
+     *
+     * The encoding is `path NUL sha256hex(content) LF`. NUL cannot occur in a
+     * path on any supported filesystem and the content slot is a fixed 64 hex
+     * characters, so no (path, content) pair can be re-cut into another one.
+     * The two cases below demonstrate that on the shapes this gate can
+     * actually be handed: the slugs are a CLOSED set of nine, so a
+     * prefix-pair of gated paths cannot be constructed at all, and saying so
+     * is more honest than a contrived fixture that proves a different gate.
+     */
+    const OTHER = 'src/rules/scope-control.md';
+
+    it('content cannot be re-attributed from one gated path to another', () => {
+        const a = tmpTree({ [KERNEL]: 'x\n', [OTHER]: 'y\n' });
+        const b = tmpTree({ [KERNEL]: 'y\n', [OTHER]: 'x\n' });
+        expect(subjectDigest(a, [KERNEL, OTHER])).not.toBe(subjectDigest(b, [KERNEL, OTHER]));
+    });
+
+    it('two gated files are not the concatenation of one', () => {
+        const two = tmpTree({ [KERNEL]: 'x\n', [OTHER]: 'y\n' });
+        const one = tmpTree({ [KERNEL]: 'x\ny\n' });
+        expect(subjectDigest(two, [KERNEL, OTHER])).not.toBe(subjectDigest(one, [KERNEL]));
+    });
+});
+
+describe('a path the caller supplies cannot escape the tree', () => {
+    /**
+     * Question 9 of the modification review, answered by a measurement rather
+     * than by a claim — and the measurement found a hole rather than
+     * confirming its absence.
+     *
+     * The gate's `KERNEL_RULE_PATH_RE` is `(?:^|\/)rules\/([a-z0-9-]+)\.md$`,
+     * unanchored at the start, so `../../elsewhere/rules/commit-policy.md`
+     * classifies as a kernel rule. Harmless while the gate read only names;
+     * not harmless once the content binding joins those names to a root and
+     * reads the bytes. The digest now refuses such a path instead of reading
+     * it, and refuses rather than dropping it, so its coverage never falls
+     * short of what the gate gated.
+     */
+    it('a traversing gated path is refused, not read', () => {
+        expect(() => gatedFilesOf(['../../elsewhere/rules/commit-policy.md'])).toThrow(
+            GatedPathEscapes,
+        );
+        expect(() => gatedFilesOf(['/elsewhere/rules/commit-policy.md'])).toThrow(
+            GatedPathEscapes,
+        );
+        expect(() => gatedFilesOf(['src/rules/../rules/commit-policy.md'])).toThrow(
+            GatedPathEscapes,
+        );
+    });
+
+    it('a path that is not gated at all is simply dropped, not refused', () => {
+        // Polarity, in the direction that matters: the refusal above must fire
+        // on gated traversal only. A `..` in an ungated path is noise in the
+        // diff, and turning it into a red would red every PR that renames a
+        // file through a relative path.
+        expect(gatedFilesOf(['../../etc/passwd', '/etc/passwd', 'README.md'])).toEqual([]);
+        expect(gatedFilesOf([KERNEL])).toEqual([KERNEL]);
+    });
+});
+
+describe('the covered list and the digest come from one classification', () => {
+    it('every file the reading names moves the digest, and nothing else does', () => {
+        const root = tmpTree({ [KERNEL]: 'one\n', [UNGATED]: 'a\n', 'README.md': 'r\n' });
+        const reading = subjectOf(root, [KERNEL, UNGATED, 'README.md']);
+        expect(reading.gatedFiles).toEqual([KERNEL]);
+
+        for (const rel of reading.gatedFiles) {
+            const before = subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest;
+            fs.writeFileSync(path.join(root, rel), 'moved\n');
+            expect(subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest).not.toBe(before);
+        }
+        const steady = subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest;
+        fs.writeFileSync(path.join(root, UNGATED), 'b\n');
+        fs.writeFileSync(path.join(root, 'README.md'), 's\n');
+        expect(subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest).toBe(steady);
+    });
+
+    it('the gate hands the CLI the same two halves it judges with', () => {
+        // The divergence the review found was the CLI classifying a second
+        // time with a different `derived` input. There is one call now, and
+        // this is what pins it: the list and the digest are one object.
+        const reading = expectedSubjectFor(
+            ['src/scripts/check_kernel_edit_ratified.ts', 'README.md'],
+            process.cwd(),
+        );
+        expect(reading.gatedFiles).toEqual(['src/scripts/check_kernel_edit_ratified.ts']);
+        expect(reading.digest).toMatch(/^[0-9a-f]{64}$/);
+    });
+});
+
 describe('the import cycle stays survivable, and a regression reds here', () => {
     it('the gated set resolves when THIS module is the entry point', async () => {
         // A council reviewer named the cycle fragile: the gate imports
diff --git a/tests/scripts/ratification_subject_binding.test.ts b/tests/scripts/ratification_subject_binding.test.ts
index d8a3ef7c1..2614fd251 100644
--- a/tests/scripts/ratification_subject_binding.test.ts
+++ b/tests/scripts/ratification_subject_binding.test.ts
@@ -45,7 +45,7 @@ function record(name: string, gated: readonly string[], verdict = 'ratified'): s
             'proposed_by: claude/session-a',
             'implemented_by: claude/session-a',
             'reviewed_by: council/anthropic+openai',
-            `subject: ${expectedSubjectFor(gated, root)}`,
+            `subject: ${expectedSubjectFor(gated, root).digest}`,
             `verdict: ${verdict}`,
             'effective_after: merge',
             'providers:',
@@ -233,29 +233,29 @@ describe('a gated path that is a symlink is hashed as the link', () => {
         fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
         fs.symlinkSync(path.join(root, 'outside.txt'), path.join(root, KERNEL));
 
-        const before = expectedSubjectFor([KERNEL], root);
+        const before = expectedSubjectFor([KERNEL], root).digest;
 
         // The target changes. The committed object did not, so the digest must
         // not move -- this is the case that was broken.
         write('outside.txt', 'second, and quite different\n');
-        expect(expectedSubjectFor([KERNEL], root)).toBe(before);
+        expect(expectedSubjectFor([KERNEL], root).digest).toBe(before);
 
         // Re-pointing the link IS a change to the committed object.
         fs.unlinkSync(path.join(root, KERNEL));
         write('elsewhere.txt', 'first\n');
         fs.symlinkSync(path.join(root, 'elsewhere.txt'), path.join(root, KERNEL));
-        expect(expectedSubjectFor([KERNEL], root)).not.toBe(before);
+        expect(expectedSubjectFor([KERNEL], root).digest).not.toBe(before);
     });
 
     it('a BROKEN link is a link, not a deletion', () => {
         fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
         fs.symlinkSync(path.join(root, 'never-existed.txt'), path.join(root, KERNEL));
-        const asBrokenLink = expectedSubjectFor([KERNEL], root);
+        const asBrokenLink = expectedSubjectFor([KERNEL], root).digest;
 
         // `existsSync` reported a broken link as absent, which digested it as a
         // removal -- the one change the record most needs to be bound to.
         fs.unlinkSync(path.join(root, KERNEL));
-        const asDeleted = expectedSubjectFor([KERNEL], root);
+        const asDeleted = expectedSubjectFor([KERNEL], root).digest;
 
         expect(asBrokenLink).not.toBe(asDeleted);
     });
@@ -264,10 +264,10 @@ describe('a gated path that is a symlink is hashed as the link', () => {
         fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
         write('target.txt', 'x\n');
         fs.symlinkSync(path.join(root, 'target.txt'), path.join(root, KERNEL));
-        const asLink = expectedSubjectFor([KERNEL], root);
+        const asLink = expectedSubjectFor([KERNEL], root).digest;
 
         fs.unlinkSync(path.join(root, KERNEL));
         write(KERNEL, 'x\n');
-        expect(expectedSubjectFor([KERNEL], root)).not.toBe(asLink);
+        expect(expectedSubjectFor([KERNEL], root).digest).not.toBe(asLink);
     });
 });
```
