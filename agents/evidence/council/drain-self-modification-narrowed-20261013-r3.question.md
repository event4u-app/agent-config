<!-- evidence-type: analysis -->

<!-- The prompt given to round 3 of the modification review on 2026-10-13,
     committed verbatim so the record beside it can be checked against what
     was actually asked (evaluator-independence: a recorded verdict whose
     prompt is not recoverable is not evidence). Not edited after the run. -->

# Modification review, round 3 — the one defect round 2 named, fixed with its tests

This is round 3 of the modification review you answered twice on 2026-10-13.
The change under review is the same narrowed content binding. **Round 2's diff
is unchanged except where your round-2 findings touched it**, and the complete
delta is below at full context.

Round 2 closed REQUEST_CHANGES / `refused` on both seats. Both of you said the
core design is sound and the scope appropriately narrow — question 7 came back
"no, appropriately minimal after staging" in both rounds. The refusal named
**one implementation defect**, plus three smaller findings. All four are
addressed below.

## What you found, and what was done about it

### The dealbreaker — an error model that was three-quarters built

> "`GatedFileUnreadable` gets the full treatment (defined → thrown → caught →
> structured refusal). `GatedPathEscapes` gets only the first half (defined →
> thrown), then escapes. The subsequent-read failures get zero coverage. A
> complete fix needs one catch boundary in `evaluate()` that handles all three
> failure classes."

> "the `readFileSync(abs)` and `readlinkSync(abs)` calls ... are not wrapped,
> so a permission change or I/O error after the stat escapes as a raw Node
> error — exactly the TOCTOU window the fail-closed lstat was meant to close."

Both correct, and the second is the sharper of the two: round 1's fix closed
the `lstat` and left the window open one line later.

**Fixed, in the shape your blind peer-review stage asked for.** `evaluate()`
now catches `GatedFileUnreadable` **and** `GatedPathEscapes` at one boundary
and returns `exitCode 1` with a named line. Both post-`lstat` reads go through
`readGatedFile` / `readGatedLink`, which translate an errno failure into
`GatedFileUnreadable`.

The translation is **narrow and typed, never a blanket catch** — your peer
reviewer's bound, and it is honoured rather than nodded at: `asErrno` admits
only a value carrying an errno `code`, so a `TypeError` from a future edit of
that loop stays a crash rather than surfacing as "the tree could not be read";
and the catch enumerates two classes rather than catching everything. A
blanket `catch` would "conceal programming defects as ordinary refusals",
which is the fail-open shape round 1 already refused once.

**One thing was done that the finding did not ask for, and it is flagged
rather than slipped in.** The CLI (`src/scripts/ratification_subject.ts`, an
ungated file) carries the same two-class catch. The step's own title is "every
failure of the subject computation is ONE structured refusal", and a second
caller that prints a Node stack trace instead is a place where that sentence
is not true. It is 12 lines. Say if you consider it out of scope for this
round and it comes out.

### The symlink-swap question — answered by measurement, not assumed

Your peer-review stage named a path-substitution race between the stat and the
read and said explicitly that whether resisting it is inside this gate's threat
model is part of the step rather than something to assume. Here is the answer,
in three parts, and the third part is the one that matters most.

**1. The dangerous direction is closed.** A path that is a regular file at the
`lstat` and a **symlink** at the read is the only ordering in which
out-of-revision CONTENT can enter the digest, because `readFileSync`
dereferences. `readGatedFile` opens with `O_NOFOLLOW`, so that swap raises
`ELOOP` and becomes a refusal.

**2. The direction you named by name is not a leak at all.** A symlink whose
TARGET is swapped between classification and read: the digest records the
target STRING (`SYMLINK_MARKER + readlink`) and never dereferences it, so the
worst such a swap can do is move the digest — which reds the gate. A link
replaced by a regular file makes `readlinkSync` fail with `EINVAL`, also a
refusal. Three of three race outcomes fail closed.

**3. What is NOT closed, stated rather than left to be discovered.**
Intermediate directory components are still resolved, so a symlinked parent
committed into the tree redirects the read — that is a property of the
checkout, visible in the revision, not a race. And an adversary with concurrent
write access to the checkout during a gate run can edit the gated bytes BEFORE
the stat, forge the record, or patch the gate itself; no ordering of stat and
read answers that, and claiming otherwise would be the false assurance this
module exists to prevent. `O_NOFOLLOW` is undefined on Windows and falls back
to `0`; this gate runs on `ubuntu-latest` and its suites on ubuntu and macOS,
so the fallback is written in the header rather than silently losing the
property.

Tell us if you read the threat-model boundary differently — that `O_NOFOLLOW`
buys nothing worth 2 lines, or that the intermediate-component case belongs in
this change rather than noted.

### The three smaller findings

**1. The ENOENT polarity case proved nothing about the encoding.** You were
right: it asserted only that nothing threw and that the constant contains the
word "deleted". It now compares the absent tree's digest against a tree whose
gated file holds exactly `DELETED_MARKER`'s bytes, and against one holding a
different marker. Seen red by encoding the absent branch with another marker —
and under that same neutralisation the two **old** assertions stay green,
which is the finding, measured rather than asserted.

**2. The one-classification case used a self-gated fixture.** Also right: the
gate's own script is gated through the SELF set whether or not `derived`
reaches the classifier, so the case would have survived the regression it
exists to catch. It now uses `src/scripts/hooks/host_semantics.ts`, which is
gated only through the derived closure, plus a direct assertion that an empty
derived list un-gates it. Measured counterfactual: with `gatedFilesOf`
ignoring `derived`, the new fixture reds and the old self-gated one stays
green.

**3. `expectedSubjectFor` changing from `string` to `SubjectReading` is not a
type break**, and this is a measurement rather than a judgement:
`git show origin/main:src/scripts/check_kernel_edit_ratified.ts | grep -c
expectedSubjectFor` prints **0**. The function is new on this branch and has
never shipped, so both shapes have only ever existed inside this unmerged
change and no caller outside the tree can exist to break. Every in-tree caller
moved with it. No code change; recorded in the roadmap so the next reader does
not re-derive it. Say if you think the measurement is the wrong one.

### One repair neither of you asked for

`GatedPathEscapes` carried `GatedFileUnreadable`'s doc block verbatim — an
`lstat` / ENOENT argument standing above a class that is about path
containment. The block is back where it belongs. It is doc-only, in an ungated
file, and does not move the `subject`.

## Every new case was seen RED before the fix

Each mechanism was neutralised in turn and the suites re-run. Measured, not
claimed — a test never seen red has unknown sensitivity:

| Neutralisation | Result |
|---|---|
| drop `GatedPathEscapes` from the gate's catch | 2 of 9 red, 7 stay green |
| unwrap both post-`lstat` reads (raw `fs` calls back) | 2 of 33 red |
| drop `O_NOFOLLOW` from the gated read | 1 of 24 red |
| encode an absent file with a marker other than `DELETED_MARKER` | 1 of 24 red |
| make `gatedFilesOf` ignore its `derived` argument | 1 of 24 red |

33 tests across the two suites, all green with the mechanisms in place.
`tsc --noEmit` and ESLint clean on the diff.

## What is in this bundle, and what is not

The delta below is the **complete** round-2 → round-3 change: 27 KB, nothing
elided. The whole branch against `origin/main` is 299 KB and does not fit your
51 KB ceiling — the same constraint both of you named in rounds 1 and 2. What
stands unchanged from round 2 is the narrowed content binding you have already
read twice: the `subject` digest over the gated file set (step 2.1), and the
gate refusing a record whose `subject` is absent, malformed or different (step
2.2). Governed-surface expansion, proposal validation, the worked example and
its Iron Law, the record writer and the escalation shape remain staged off this
branch on your round-2 `smaller-change` answer.

If a question below cannot be answered from what you can see, say which part
you could not see rather than answering around it.

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

Answer on the change in front of you. A refusal is a legitimate answer and
costs nothing to give; so is passing it. Do not weigh how many rounds this has
taken.

## The delta — full context, nothing elided

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index b699fc695..26b691b7a 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -68,19 +68,17 @@ export const DELETED_MARKER = '\u0000deleted\u0000';
 export const SYMLINK_MARKER = '\u0000symlink\u0000';
 
 /**
- * Raised when a gated path exists but cannot be read.
+ * Raised when a gated path would resolve outside the tree under review.
  *
- * A 2026-10-13 council review refused the change over the shape this
- * replaces: every `lstat` failure became `null`, and `null` is the DELETION
- * marker — so a permission error, an I/O error or a transient filesystem
- * failure on a gated file produced the digest of a tree in which that file
- * had been removed. Both seats named it, and one named the consequence that
- * makes it more than untidy: anyone who can provoke such an error on a gated
- * path can force its real content out of the digest.
+ * THIS DOC BLOCK USED TO DESCRIBE A DIFFERENT CLASS. It carried
+ * {@link GatedFileUnreadable}'s `lstat` / ENOENT argument verbatim, which says
+ * nothing about path containment and is now where it belongs. A comment that
+ * describes the wrong mechanism is worse than none on a governance surface: it
+ * answers a reader's question with another class's reasoning, and the reader
+ * has no way to know.
  *
- * Only ENOENT and ENOTDIR mean ABSENT. Everything else is a checkout this
- * code cannot describe, and describing it anyway is the fail-open move a
- * previous round of this same review already refused once.
+ * The containment itself fails CLOSED rather than dropping the path —
+ * see {@link assertContained} for why that direction is the safe one.
  */
 export class GatedPathEscapes extends Error {
     constructor(readonly rel: string) {
@@ -118,6 +116,25 @@ function assertContained(rel: string): void {
     }
 }
 
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
+ *
+ * Round 2 of the same review found the other half: this class was raised
+ * only from the `lstat`, and the reads AFTER it were unwrapped. Both reads
+ * now raise it too, through {@link readGatedFile} and {@link readGatedLink}.
+ */
 export class GatedFileUnreadable extends Error {
     constructor(
         readonly rel: string,
@@ -132,6 +149,106 @@ export class GatedFileUnreadable extends Error {
     }
 }
 
+/**
+ * An errno failure, or `null` for anything else.
+ *
+ * THE TRANSLATION IS NARROW ON PURPOSE. The blind peer-review stage of the
+ * 2026-10-13 round named the opposite shape as its own defect: a blanket
+ * `catch` around the read would "conceal programming defects as ordinary
+ * refusals", so a `TypeError` from a future edit of this loop would surface as
+ * "the tree could not be read" and nobody would look for the bug. Only a value
+ * carrying an errno `code` is a statement about the filesystem; everything else
+ * is rethrown and stays a crash.
+ */
+function asErrno(err: unknown): NodeJS.ErrnoException | null {
+    if (err instanceof Error && typeof (err as NodeJS.ErrnoException).code === 'string') {
+        return err as NodeJS.ErrnoException;
+    }
+    return null;
+}
+
+/**
+ * `O_NOFOLLOW`, or 0 where the platform has no such flag.
+ *
+ * Defined on Linux and macOS, which is where this gate runs — `consistency.yml`
+ * is `ubuntu-latest` and the suites are ubuntu plus macOS. The `0` fallback is
+ * honest rather than silent: on a platform without the flag the open below
+ * degrades to an ordinary one and {@link readGatedFile} loses the containment
+ * property its own case asserts. That is stated here because a reader
+ * otherwise has to infer it from a bitmask.
+ */
+const O_NOFOLLOW: number =
+    typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
+
+/**
+ * Read a gated path that {@link fs.lstatSync} has just called a regular file,
+ * WITHOUT following a symbolic link at its final component.
+ *
+ * THE SYMLINK-SWAP QUESTION, ANSWERED RATHER THAN ASSUMED. One seat of the
+ * 2026-10-13 round named a path-substitution race between the stat and the
+ * read and asked whether resisting it is inside this gate's threat model. It
+ * is, for exactly one direction and for a reason that is cheap to state: a
+ * path that is a regular file at `lstat` and a SYMLINK at the read is the only
+ * ordering in which out-of-revision CONTENT can enter the digest, because a
+ * plain `readFileSync` dereferences. `O_NOFOLLOW` makes that open fail with
+ * `ELOOP`, which becomes a refusal — so the race reds the gate instead of
+ * digesting a stranger's bytes.
+ *
+ * WHAT IS NOT CLOSED, SAID PLAINLY. Intermediate directory components are
+ * still resolved, so a symlinked parent directory committed into the tree
+ * redirects the read; that is a property of the checkout rather than a race,
+ * and it is visible in the revision. And an adversary with concurrent write
+ * access to the checkout during a gate run can edit the gated bytes BEFORE the
+ * stat, forge the record, or patch this file — no ordering of stat and read
+ * answers that, and claiming otherwise would be the false assurance this
+ * module exists to prevent.
+ *
+ * Exported because a comment claiming a containment property is not a control.
+ * Its case opens a symlink directly and expects the refusal; neutralising the
+ * flag turns that case red.
+ */
+export function readGatedFile(rel: string, abs: string): Buffer {
+    let fd: number | null = null;
+    try {
+        fd = fs.openSync(abs, fs.constants.O_RDONLY | O_NOFOLLOW);
+        return fs.readFileSync(fd);
+    } catch (err) {
+        const errno = asErrno(err);
+        if (errno === null) {
+            throw err;
+        }
+        throw new GatedFileUnreadable(rel, errno);
+    } finally {
+        if (fd !== null) {
+            fs.closeSync(fd);
+        }
+    }
+}
+
+/**
+ * Read the TARGET STRING of a gated path that `lstat` has just called a
+ * symbolic link.
+ *
+ * The other half of the swap answer, and the measurable one: a link replaced
+ * by a regular file between the stat and this call makes `readlinkSync` fail
+ * with `EINVAL`, which becomes a refusal rather than a raw Node error escaping
+ * `evaluate()`. A swap of the link's TARGET is not a leak at all — the digest
+ * records the target STRING and never dereferences it, so the worst a swap can
+ * do is move the digest, which reds the gate. Both directions therefore fail
+ * closed, and the case below proves the `EINVAL` one rather than asserting it.
+ */
+export function readGatedLink(rel: string, abs: string): string {
+    try {
+        return fs.readlinkSync(abs);
+    } catch (err) {
+        const errno = asErrno(err);
+        if (errno === null) {
+            throw err;
+        }
+        throw new GatedFileUnreadable(rel, errno);
+    }
+}
+
 /**
  * The self surface, by the gate's own constants rather than a copy of them.
  *
@@ -245,9 +362,13 @@ export function subjectOf(
         if (stat === null) {
             content = Buffer.from(DELETED_MARKER);
         } else if (stat.isSymbolicLink()) {
-            content = Buffer.from(SYMLINK_MARKER + fs.readlinkSync(abs));
+            // Both reads are wrapped. Before the 2026-10-13 round they were
+            // not, and an I/O or permission failure AFTER the stat escaped as
+            // a raw Node error — the exact TOCTOU window the fail-closed
+            // `lstat` above was added to close, left open one line later.
+            content = Buffer.from(SYMLINK_MARKER + readGatedLink(rel, abs));
         } else {
-            content = fs.readFileSync(abs);
+            content = readGatedFile(rel, abs);
         }
         h.update(rel);
         h.update('\u0000');
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index a5d08417b..33de360b8 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -87,6 +87,7 @@ import {
 } from './_lib/ratification_artifact.js';
 import {
     GatedFileUnreadable,
+    GatedPathEscapes,
     subjectOf,
     type SubjectReading,
 } from './_lib/ratification_subject.js';
@@ -495,11 +496,27 @@ export function evaluate(
     try {
         expectedSubject = expectedSubjectFor(files, root).digest;
     } catch (err) {
-        // Fail closed, and before the "nothing to ratify" exit: a gated path
-        // this process could not read is a checkout the gate cannot describe,
-        // and a gate that cannot describe the content cannot say a record
-        // answers for it.
-        if (!(err instanceof GatedFileUnreadable)) {
+        // ONE boundary for EVERY failure of the subject computation, and the
+        // enumeration is the point. Round 2 of the 2026-10-13 modification
+        // review refused the change because this catch knew only one of the
+        // two error classes the same diff had introduced: "`GatedFileUnreadable`
+        // gets the full treatment (defined → thrown → caught → structured
+        // refusal). `GatedPathEscapes` gets only the first half (defined →
+        // thrown), then escapes." A gate that advertises a refusal and crashes
+        // instead has no refusal.
+        //
+        // Fail closed, and BEFORE the "nothing to ratify" exit: a gated path
+        // this process could not read, or one that points outside the
+        // revision, is a checkout the gate cannot describe, and a gate that
+        // cannot describe the content cannot say a record answers for it.
+        //
+        // NARROW AND TYPED, never a blanket catch. The blind peer-review stage
+        // of the same round named the alternative as its own defect — wrapping
+        // everything would "conceal programming defects as ordinary refusals",
+        // which is the fail-open shape round 1 already refused once. Anything
+        // that is not one of these two classes is a bug in this gate and stays
+        // a crash.
+        if (!(err instanceof GatedFileUnreadable) && !(err instanceof GatedPathEscapes)) {
             throw err;
         }
         lines.push(`❌  ${err.message}`);
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
index 4e2227746..3d2638ad1 100644
--- a/src/scripts/ratification_subject.ts
+++ b/src/scripts/ratification_subject.ts
@@ -27,6 +27,10 @@ import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
+import {
+    GatedFileUnreadable,
+    GatedPathEscapes,
+} from './_lib/ratification_subject.js';
 
 const _HERE = fileURLToPath(import.meta.url);
 const REPO = path.resolve(path.dirname(_HERE), '..', '..');
@@ -88,7 +92,24 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
     // list exists so nobody copies a confident-looking digest over no files;
     // a list that can disagree with its own digest emits exactly that false
     // reassurance instead of preventing it.
-    const { digest, gatedFiles: gated } = expectedSubjectFor(files, root);
+    //
+    // The SECOND caller of the subject computation, and it is caught here for
+    // the same reason the gate catches it: step 2.3's title says every failure
+    // of that computation is one structured refusal, and a caller that prints
+    // a Node stack trace instead is a place where that sentence is not true.
+    // The two classes are enumerated, never blanket-caught — a defect in this
+    // file stays a crash.
+    let digest: string;
+    let gated: readonly string[];
+    try {
+        ({ digest, gatedFiles: gated } = expectedSubjectFor(files, root));
+    } catch (err) {
+        if (!(err instanceof GatedFileUnreadable) && !(err instanceof GatedPathEscapes)) {
+            throw err;
+        }
+        process.stderr.write(`error: ${err.message}\n`);
+        return 1;
+    }
 
     if (quiet) {
         process.stdout.write(`${digest}\n`);
diff --git a/tests/scripts/check_kernel_edit_ratified_subject.test.ts b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
index 9030466a4..117e0e3e4 100644
--- a/tests/scripts/check_kernel_edit_ratified_subject.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
@@ -141,3 +141,70 @@ describe('records already on the trunk are not re-judged', () => {
         expect(r.lines.join('\n')).not.toContain('landed-long-ago');
     });
 });
+
+describe('2.3 — every failure of the subject computation leaves the gate as a refusal', () => {
+    /**
+     * Round 2 of the 2026-10-13 modification review refused the change over
+     * exactly this, and the seats' words are the specification:
+     *
+     * > "`GatedFileUnreadable` gets the full treatment (defined → thrown →
+     * > caught → structured refusal). `GatedPathEscapes` gets only the first
+     * > half (defined → thrown), then escapes. The subsequent-read failures
+     * > get zero coverage. A complete fix needs one catch boundary in
+     * > `evaluate()` that handles all three failure classes."
+     *
+     * These cases go through the REAL gate rather than the digest module,
+     * because the defect was not in the module: the module threw correctly
+     * and `evaluate()` let two of the three classes through as exceptions.
+     * A gate that advertises a refusal and crashes instead has no refusal.
+     */
+    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
+
+    it('a traversing gated path is a refusal, not an exception', () => {
+        // `KERNEL_RULE_PATH_RE` is unanchored, so this classifies as a kernel
+        // rule and the digest refuses to join it to a root. Before the fix
+        // that refusal left `evaluate()` as a `GatedPathEscapes`.
+        let r: ReturnType<typeof evaluate> | null = null;
+        expect(() => {
+            r = evaluate(['../../elsewhere/rules/commit-policy.md'], root, 2);
+        }).not.toThrow();
+        expect(r).not.toBeNull();
+        expect(r!.exitCode).toBe(1);
+        expect(r!.lines.join('\n')).toContain('would read outside the revision under review');
+    });
+
+    it.skipIf(asRoot)('a read that fails AFTER the stat is a refusal, not an exception', () => {
+        // The file loses its mode, so `lstat` succeeds and the read is what
+        // fails — the post-stat window the seats named. Before the fix this
+        // surfaced as a raw Node `EACCES` out of `evaluate()`.
+        const abs = path.join(root, KERNEL);
+        fs.chmodSync(abs, 0o000);
+        try {
+            let r: ReturnType<typeof evaluate> | null = null;
+            expect(() => {
+                r = evaluate([KERNEL], root, 2);
+            }).not.toThrow();
+            expect(r).not.toBeNull();
+            expect(r!.exitCode).toBe(1);
+            expect(r!.lines.join('\n')).toContain('could not be read');
+        } finally {
+            fs.chmodSync(abs, 0o644);
+        }
+    });
+
+    it('a refusal still closes the ledger rather than leaving targets unaccounted', () => {
+        // Polarity on the SHAPE of the refusal, not only its exit code: the
+        // early return runs `close(false)`, and `finalize()` throws on an
+        // unaccounted target. An exit code alone would stay green if the
+        // boundary returned before the ledger was closed.
+        const r = evaluate(['../../elsewhere/rules/commit-policy.md'], root, 2);
+        expect(r.lines.join('\n')).toMatch(/ledger: planned 1 .*failed 1/);
+    });
+
+    it('a readable gated file with its record still passes — the boundary is not a blanket red', () => {
+        // The last polarity partner: a catch that turned every run into a
+        // refusal would satisfy all three cases above.
+        const mine = record('mine.md', expectedSubjectFor([KERNEL], root).digest);
+        expect(evaluate([KERNEL, mine], root, 2).exitCode).toBe(0);
+    });
+});
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index 496b01340..81ab0edaf 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -5,6 +5,8 @@ import * as path from 'node:path';
 
 import {
     gatedFilesOf,
+    readGatedFile,
+    readGatedLink,
     subjectDigest,
     subjectOf,
     DELETED_MARKER,
@@ -46,6 +48,17 @@ const KERNEL = 'src/rules/commit-policy.md';
  */
 const UNGATED = 'docs/contracts/ratification-artifact.md';
 
+/**
+ * A path gated ONLY through the derived plumbing closure.
+ *
+ * It matches no kernel-rule, governance-hook or plumbing-source name rule and
+ * is not in the self set, so `classifyPaths(p, [])` returns it ungated and
+ * `classifyPaths(p, derived)` returns it as plumbing. That asymmetry is what
+ * makes it usable as evidence that a `derived` list actually reached the
+ * classifier — which a self-gated path cannot show.
+ */
+const DERIVED_ONLY = 'src/scripts/hooks/host_semantics.ts';
+
 describe('2.1 — the gated set, assembled from the gate’s own constants', () => {
     it('keeps a kernel rule and drops an ungated file', () => {
         const g = gatedFilesOf([KERNEL, UNGATED, 'README.md']);
@@ -170,12 +183,28 @@ describe('a gated file that cannot be read is not a gated file that was deleted'
         }
     });
 
-    it('a genuinely absent gated file is still the deletion marker', () => {
+    it('a genuinely absent gated file is encoded AS the deletion marker', () => {
         // The polarity partner: failing closed on EACCES must not make ENOENT
         // throw too, or every ordinary deletion would red the gate.
+        //
+        // STRENGTHENED on a 2026-10-13 finding. This case used to assert only
+        // that nothing threw and that the constant contains the word
+        // "deleted" — neither of which says the absent file was entered with
+        // `DELETED_MARKER` rather than skipped, which is the property step 2.1
+        // actually claims. It is provable without reaching inside the hash: a
+        // tree whose gated file CONTAINS exactly those bytes must produce the
+        // same digest as a tree where the file is missing, because the loop
+        // hashes `Buffer.from(DELETED_MARKER)` in the absent case.
         const absent = tmpTree({ 'README.md': 'x\n' });
         expect(() => subjectDigest(absent, [KERNEL])).not.toThrow();
-        expect(DELETED_MARKER).toContain('deleted');
+
+        const literal = tmpTree({ [KERNEL]: DELETED_MARKER });
+        expect(subjectDigest(absent, [KERNEL])).toBe(subjectDigest(literal, [KERNEL]));
+
+        // And it is that marker specifically, not any placeholder: a file
+        // holding a different string digests differently.
+        const other = tmpTree({ [KERNEL]: '\u0000removed\u0000' });
+        expect(subjectDigest(absent, [KERNEL])).not.toBe(subjectDigest(other, [KERNEL]));
     });
 });
 
@@ -263,12 +292,21 @@ describe('the covered list and the digest come from one classification', () => {
         // The divergence the review found was the CLI classifying a second
         // time with a different `derived` input. There is one call now, and
         // this is what pins it: the list and the digest are one object.
-        const reading = expectedSubjectFor(
-            ['src/scripts/check_kernel_edit_ratified.ts', 'README.md'],
-            process.cwd(),
-        );
-        expect(reading.gatedFiles).toEqual(['src/scripts/check_kernel_edit_ratified.ts']);
+        //
+        // THE FIXTURE IS DERIVED-ONLY, on a 2026-10-13 finding. This case used
+        // to name the gate's own script, which is gated through the SELF set
+        // and would therefore stay green even if `derived` were dropped from
+        // the call again — the exact regression the case exists to catch.
+        // `host_semantics.ts` is in the plumbing closure and matches no
+        // name-based rule, so it is gated if and only if the derived list
+        // reached the classifier.
+        const reading = expectedSubjectFor([DERIVED_ONLY, 'README.md'], process.cwd());
+        expect(reading.gatedFiles).toEqual([DERIVED_ONLY]);
         expect(reading.digest).toMatch(/^[0-9a-f]{64}$/);
+
+        // The half that makes the fixture load-bearing: with no derived list
+        // the same path is not gated at all.
+        expect(gatedFilesOf([DERIVED_ONLY], [])).toEqual([]);
     });
 });
 
@@ -295,3 +333,107 @@ describe('the import cycle stays survivable, and a regression reds here', () =>
         );
     });
 });
+
+describe('a failure AFTER the stat is a refusal, not a raw Node error', () => {
+    /**
+     * Step 2.3, and the half round 2 of the 2026-10-13 review named:
+     *
+     * > "the `readFileSync(abs)` and `readlinkSync(abs)` calls ... are not
+     * > wrapped, so a permission change or I/O error after the stat escapes as
+     * > a raw Node error — exactly the TOCTOU window the fail-closed lstat was
+     * > meant to close."
+     *
+     * The `lstat` above decides which of three things a gated path is. Every
+     * one of those three branches then touches the filesystem a SECOND time,
+     * and until this change the second touch had no translation at all.
+     */
+    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
+
+    it.skipIf(asRoot)('an unreadable FILE whose stat succeeded is a typed refusal', () => {
+        // The file loses its mode, not the directory — so `lstat` succeeds
+        // (it reads the parent's entry) and the READ is what fails. That is
+        // the post-stat window, reached deterministically.
+        const root = tmpTree({ [KERNEL]: 'one\n' });
+        const abs = path.join(root, KERNEL);
+        fs.chmodSync(abs, 0o000);
+        try {
+            expect(() => fs.lstatSync(abs)).not.toThrow();
+            expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
+            // And it carries the errno rather than flattening it, so the
+            // refusal says WHICH filesystem fact stopped it.
+            try {
+                subjectDigest(root, [KERNEL]);
+                expect.unreachable('the digest must refuse an unreadable gated file');
+            } catch (err) {
+                expect(err).toBeInstanceOf(GatedFileUnreadable);
+                expect((err as GatedFileUnreadable).errno.code).toBe('EACCES');
+            }
+        } finally {
+            fs.chmodSync(abs, 0o644);
+        }
+    });
+
+    it('the happy path still returns the bytes — the wrapper swallows nothing', () => {
+        // Polarity for the two clauses above: a translation that also ate
+        // successful reads would make every case in this file green for the
+        // wrong reason.
+        const root = tmpTree({ [KERNEL]: 'one\n' });
+        expect(readGatedFile(KERNEL, path.join(root, KERNEL)).toString()).toBe('one\n');
+    });
+});
+
+describe('the symlink-swap question, answered by measurement', () => {
+    /**
+     * One seat of the 2026-10-13 round named a path-substitution race between
+     * the stat and the read and asked whether resisting it is inside this
+     * gate's threat model. These two cases are the answer, each measured
+     * rather than asserted in a comment.
+     *
+     * The race cannot be staged single-threaded, so what is measured is the
+     * MECHANISM each branch relies on — which is the only honest thing a
+     * deterministic suite can prove about a race, and strictly more than the
+     * comment it replaces.
+     */
+    it('a read refuses a symlink rather than following it — the O_NOFOLLOW half', () => {
+        // The dangerous direction: a path that `lstat` called a regular file
+        // and that is a SYMLINK by the time the read happens. A plain
+        // `readFileSync` dereferences and pulls bytes from outside the
+        // revision into the digest. `readGatedFile` opens with `O_NOFOLLOW`,
+        // so the swap becomes ELOOP and then a refusal.
+        const root = tmpTree({ 'outside.txt': 'bytes from elsewhere\n' });
+        const link = path.join(root, 'src/rules/linked.md');
+        fs.mkdirSync(path.dirname(link), { recursive: true });
+        fs.symlinkSync(path.join(root, 'outside.txt'), link);
+
+        expect(() => readGatedFile('src/rules/linked.md', link)).toThrow(GatedFileUnreadable);
+        // Specifically: it did NOT return the target's bytes. Asserting the
+        // throw alone would stay green if the refusal came from somewhere else.
+        let produced: string | null = null;
+        try {
+            produced = readGatedFile('src/rules/linked.md', link).toString();
+        } catch {
+            produced = null;
+        }
+        expect(produced).not.toBe('bytes from elsewhere\n');
+    });
+
+    it('a link replaced by a regular file is EINVAL, and EINVAL is a refusal', () => {
+        // The other direction, and the one the seat asked about by name: the
+        // path was a symlink at the stat, so the loop calls `readlinkSync` —
+        // and a swap to a regular file makes that call fail. It is a typed
+        // refusal now rather than a raw Node error out of `evaluate()`.
+        //
+        // A swap of the link's TARGET is not a leak at all: the digest records
+        // the target STRING and never dereferences it, so the worst such a
+        // swap can do is move the digest, which reds the gate. Both directions
+        // therefore fail closed.
+        const root = tmpTree({ [KERNEL]: 'one\n' });
+        expect(() => readGatedLink(KERNEL, path.join(root, KERNEL))).toThrow(GatedFileUnreadable);
+
+        // Polarity: on an actual link it returns the target string, so the
+        // clause above is not green because the helper always throws.
+        const link = path.join(root, 'src/rules/linked.md');
+        fs.symlinkSync('../../elsewhere', link);
+        expect(readGatedLink('src/rules/linked.md', link)).toBe('../../elsewhere');
+    });
+});
```
