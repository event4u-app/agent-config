<!-- evidence-type: analysis -->

<!-- Round-6 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 6 — the narrowed content binding

Round 6 of the modification review of the narrowed content binding (PR #2325).
Round 5 closed `refused` 2/2 on one shared finding. The owner directed that the
confirmed findings be addressed and the change come back for this round. The
code under review is commit `50d20d11e`.

## Round 5's shared finding

> anthropic: "the highest-leverage pre-merge change: refuse paths where any
> parent component is a symbolic link. Walk from root to leaf, `lstat` each
> parent, throw `GatedPathEscapes` if any `isSymbolicLink()`. [...] Correct the
> comment claiming symlinks are never dereferenced."

> openai: "the digest can bind content reached through an intermediate symlink
> rather than the reviewed Git path; the highest-leverage pre-merge change is to
> hash an explicit Git revision, or at minimum refuse every symlinked ancestor
> and add the regression test above."

## What changed, and why the approach changed rather than the patch

Rounds 3, 4 and 5 each refused the working-tree reader on a new filesystem
defect: errno handling and close ordering, non-regular files (FIFO, device),
and now a symlinked ancestor. The author judged that adding a fourth
per-class defence (an ancestor walk) would leave the same shape of question
open for the next round, and took the alternative openai named: the subject is
read from Git objects at an explicit revision. Commits since round 5:
`a80f2ce87` (code and tests), `1efd028cb` (contract), `f6733aa37` and
`50d20d11e` (roadmap, evidence).

In `src/scripts/_lib/ratification_subject.ts` (reproduced in full below):

- `subjectOf(root, files, derived?, revision = 'HEAD')` resolves the revision
  with `git rev-parse --verify --quiet <rev>^{commit}`, looks each gated path up
  with one `git ls-tree -z --full-tree <commit> -- <paths>` (exact-name match on
  the output, `GIT_LITERAL_PATHSPECS=1`), and reads a blob's bytes with
  `git cat-file blob <oid>`. The filesystem is not read for gated content.
- Tree entry handling: absent → deletion (mode slot `000000`, marker content);
  blob with mode `100644` / `100755` → hashed; **mode `120000` (symbolic link)
  → refused**; tree (directory), commit (submodule) or anything else → refused.
  The symlink decision: a link's effective content lives at the path it names,
  which the gate's classifier does not see, so neither the target string nor
  the followed content describes what a reviewer approves. The repository has
  two committed symlinks (`CLAUDE.md`, `agent-config`), neither gated.
- Serialisation per entry is now `path NUL mode NUL sha256hex(content) LF`; the
  mode is new, so an executable-bit change moves the digest and a file whose
  bytes equal the deletion marker no longer collides with a deletion.
- Typed refusals, all `GatedSubjectRefusal` subclasses: `GatedRevisionUnresolved`
  (unknown revision, a revision starting with `-`, a root that is not a
  repository, a root that is a SUBDIRECTORY of a repository — checked with
  `rev-parse --show-prefix`), `GitUnavailable` (spawn `ENOENT`), `GitReadFailed`
  (non-zero `ls-tree` / `cat-file`, spawn errors such as `ENOBUFS` over the
  32 MiB blob cap), plus the existing `GatedPathEscapes` and
  `GatedPathUnsupported`. git runs as `git -C <root>` with `GIT_DIR`,
  `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`,
  `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_COMMON_DIR` and `GIT_NAMESPACE`
  removed from its environment, so a hook's inherited `GIT_DIR` cannot point it
  elsewhere. Invalid argument types still throw from Node and are not caught.
- An empty gated set returns the empty digest without running git
  (`revision: null`).
- Removed: `readGatedFile`, `readGatedLink`, `asErrno`, `GatedFileUnreadable`,
  `SYMLINK_MARKER`, the `O_NOFOLLOW` / `O_NONBLOCK` flag handling and the
  `lstat` kind check. The module header no longer claims anything about
  following links; it states what is read and what is not covered.

In `src/scripts/check_kernel_edit_ratified.ts`: `--rev REV` (default `HEAD`);
`evaluate(files, root, providerCount, revision = 'HEAD')`; the changed-file
list from git is `git diff --name-only <base>...<rev>`; **the ratification
record is read at the same commit** (`fileAtRevision`), so an uncommitted
rewrite of the record cannot make the gate pass; a record absent at the
revision, or one that is not a regular file there, is a failure line, not an
exception. In `src/scripts/ratification_subject.ts` (the CLI): `--rev REV`, a
usage error when `--rev` has no value, and a `revision: <commit>` line beside
the digest.

What the pre-push run therefore compares: the changed-file list is
`git diff <base>...HEAD`, and the gated content and the record are read from
`HEAD`'s tree. What is still read from the checkout: which paths are gated is
decided by the gate's code and by an import closure (`derivedPlumbing`,
`closureArrivals`) read from disk — in CI that code is the base revision's, and
a local edit to the judging code is outside what a digest answers. The contract
says so.

## Tests, and what was removed

New: `tests/scripts/ratification_subject_revision.test.ts` (18 cases) and a
fixture helper that commits a temporary tree with hooks, signing and an
inherited `GIT_DIR` disabled. Every existing case that judged a tree now commits
its fixture first, through a local wrapper. Assertions changed in five places:
two expected refusal messages follow the new wording (`names nothing inside the
revision under review`; `listed in the diff but absent at \`HEAD\``); two
directory-at-a-gated-path fixtures now put a file inside the directory, because
Git stores no empty directory; and the deletion-marker case now compares with
an entry computed by hand from the serialisation and asserts that a file holding
the marker bytes is NOT a deletion (it previously asserted they were equal).

Removed with the reader: the whole of `ratification_subject_fs_faults.test.ts`
(close failures, flag presence, FIFO trapping, `fstat` kind), the `EACCES`
cases in three files, the `readGatedFile` / `readGatedLink` / `asErrno` cases,
and the three binding cases that pinned "a gated symlink is hashed as its
target string" — reversed by the refusal above. Each removal and what now pins
its property, if anything, is listed in
`agents/evidence/reviews/ratification-subject-git-revision-test-removals.md`
(not in this bundle). `check_test_weakening` against `origin/main` reports no
net weakening, because every removed case was added on this branch.

## Each new case, seen red

| How | Result |
|---|---|
| new revision suite run against the round-5 reader, before the change | 16 of 17 red, each on its assertion (dirty edit moved the digest; symlinked ancestor read the foreign bytes; dirty record passed the gate; no `revision`; no refusal for `120000`, unknown revision, option-shaped revision, non-repository, missing git; CLI exit 2 not 1). The 17th (a numeric root) passed and was replaced: Node accepts a number in a spawn argument, so it never reached the throw it meant to test |
| subdirectory-root refusal neutralised | 1 of 18 red |
| regular-mode check reduced to `type === 'blob'` | 2 of 18 red (mode-`120000` refusal through `subjectOf` and through `evaluate`) |
| non-string revision translated into a refusal | 1 of 18 red (the replacement programming-error case) |
| `--rev` without value treated as `HEAD` | 1 of 7 red in the CLI suite |
| the round-5 lib / CLI swapped back in | 4 red: revision line, unreadable directory, deletion entry by hand-computed serialisation, mode change |

After restoring: the 10 ratification / kernel-edit suites pass (148 tests);
`tsc --noEmit`, eslint on touched files, `lint_code_comments`,
`check_test_weakening`, `lint_evidence_artifacts` clean; `task sync` and
`task generate-tools` produce no drift.

## The digest

Over this branch's full changed-file list, `ratification_subject` prints
`subject: f6ac2f8c7d6820465b87618ec9adf6d880a3fca3cc90bd2af7ac3eb88b3c7805`,
`revision: 50d20d11e5beb718a7fe53289b4e6b451821b0a5`, over two gated files,
`src/scripts/_lib/ratification_artifact.ts` and
`src/scripts/check_kernel_edit_ratified.ts`. It moved from round 5's
`20a33577…` because the gate file changed and the serialisation now includes
the mode. `_lib/ratification_subject.ts` and the CLI are not in the gated set
in this revision (widening it is a separate staged step). `origin/main` has not
moved since round 4's merge (`d23dcec56`).

## What is in this bundle, and what is not

The bundle has a 50 KB hard ceiling. Included below:

1. **Delta 1 — the gated files, PR against `origin/main`**, no context lines:
   `src/scripts/_lib/ratification_artifact.ts` and
   `src/scripts/check_kernel_edit_ratified.ts`.
2. **Delta 2 — `src/scripts/_lib/ratification_subject.ts` in full** as of
   `50d20d11e`. Shown whole rather than as a diff since round 5 because it was
   rewritten; the round-5 version was in the round-5 bundle.
3. **Delta 3 — the CLI, `src/scripts/ratification_subject.ts`, since round 5**,
   no context lines.
4. **Delta 4 — the contract, `docs/contracts/ratification-artifact.md`, since
   round 5**, no context lines.

Not included, to fit the ceiling: every test file (the revision suite, the
fixture helper and the converted suites — about 55 KB of diff since round 5),
the CLI's and contract's changes from earlier rounds, the roadmap, the removal
account and the ratification record. If a question below cannot be answered
from what you can see, say which part you could not see rather than answering
around it.

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

Answer on the change in front of you. Do not weigh how many rounds this has
taken.

## Delta 1 — the gated files, PR against `origin/main`

```diff
diff --git a/src/scripts/_lib/ratification_artifact.ts b/src/scripts/_lib/ratification_artifact.ts
index 93f41d63e..46fd0fc16 100644
--- a/src/scripts/_lib/ratification_artifact.ts
+++ b/src/scripts/_lib/ratification_artifact.ts
@@ -86,0 +87,12 @@ export interface RatificationArtifact {
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
@@ -106 +118,4 @@ export interface RatificationProblem {
-        | 'header-not-derived';
+        | 'header-not-derived'
+        | 'subject-absent'
+        | 'subject-malformed'
+        | 'subject-mismatch';
@@ -324,0 +340,10 @@ export interface RatificationReading {
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
@@ -366,0 +392,7 @@ export function readProviders(fm: AdrFrontmatter): string[] {
+ *
+ * `expectedSubject` is the digest of the gated content the record is being
+ * read against, recomputed from the tree by the caller. Pass `null` to read a
+ * record's shape without binding it to any content — which is what a reader
+ * that is not judging a diff does. Pass a digest and the record must carry
+ * `subject`, and carry that one: a record whose `subject` is absent or
+ * different did not review this content, whatever its verdict says.
@@ -370,0 +403 @@ export function readRatification(
+    expectedSubject: string | null = null,
@@ -429,0 +463,29 @@ export function readRatification(
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
@@ -467,0 +530 @@ export function readRatification(
+            subject,
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 26d5a22f3..f8dbb10aa 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -63,0 +64,3 @@
+ *   --rev REV         the commit the gated content and the artifacts are read
+ *                     at (default HEAD) — Git objects, never the working tree,
+ *                     so an uncommitted edit can neither pass nor fail the gate
@@ -87,0 +91,7 @@ import {
+import {
+    DEFAULT_REVISION,
+    GatedSubjectRefusal,
+    fileAtRevision,
+    subjectOf,
+    type SubjectReading,
+} from './_lib/ratification_subject.js';
@@ -363,2 +373,2 @@ export function configuredProviderCount(policyRoot: string): number | null {
-function gitChangedFiles(baseRef: string, root: string): string[] | null {
-    const res = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
+function gitChangedFiles(baseRef: string, root: string, revision: string): string[] | null {
+    const res = spawnSync('git', ['diff', '--name-only', `${baseRef}...${revision}`], {
@@ -389,0 +400,41 @@ function resolveBaseRef(explicit: string | null, root: string): string {
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
+ * The `subject` digest a record must carry to answer for this diff, AND the
+ * gated files it covers — from one classification, never two.
+ *
+ * Exported so that whoever WRITES a record asks the gate for the digest rather
+ * than recomputing it from a second reading of the membership rule. A writer
+ * that derived its own list would be the second definition of "gated" that
+ * `ratification_subject`'s header exists to prevent — and it would fail only
+ * for the diffs where the two lists disagree, which are exactly the diffs that
+ * widen the gated set.
+ *
+ * RETURNS BOTH HALVES so that the coverage list printed beside a digest is the
+ * list that digest was taken over: a list classified separately, with a
+ * different `derived` input, could disagree with it — the false reassurance
+ * that list exists to prevent.
+ *
+ * The content is read at `revision` from Git objects, so the digest a writer
+ * prints and the digest this gate checks agree exactly when both name the
+ * same commit — the one the reviewers were shown.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when the revision does not resolve, git
+ * cannot run, or a gated path escapes the tree or is not absent or a regular
+ * file in that commit. Callers turn that into a refusal; none may continue.
+ */
+export function expectedSubjectFor(
+    files: readonly string[],
+    root: string,
+    revision: string = DEFAULT_REVISION,
+): SubjectReading {
+    return subjectOf(root, files, derivedFor(root), revision);
+}
+
@@ -400,0 +452 @@ export function evaluate(
+    revision: string = DEFAULT_REVISION,
@@ -406,3 +458,2 @@ export function evaluate(
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
@@ -450,0 +502,38 @@ export function evaluate(
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
+    let commit: string | null;
+    try {
+        ({ digest: expectedSubject, revision: commit } = expectedSubjectFor(files, root, revision));
+    } catch (err) {
+        // ONE boundary for EVERY failure of the subject computation: each is
+        // a subclass of `GatedSubjectRefusal`, so a gate that advertises a
+        // refusal cannot crash on one of its own refusal classes instead.
+        //
+        // Fail closed, and BEFORE the "nothing to ratify" exit: a revision
+        // that does not resolve, a git that cannot run, a gated path outside
+        // the tree or one that is not absent or a regular file in the commit
+        // is content the gate cannot describe, and a gate that cannot
+        // describe the content cannot say a record answers for it.
+        //
+        // NARROW AND TYPED, never a blanket catch: wrapping everything would
+        // report a defect in this gate as a property of the checkout. Anything
+        // that is not a refusal is a bug here and stays a crash.
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
+        }
+        lines.push(`❌  ${err.message}`);
+        close(false);
+        return { exitCode: 1, lines, scanned };
+    }
+
@@ -495 +584,3 @@ export function evaluate(
-        const abs = path.join(root, rel);
+        // The record is read at the same commit as the content it answers
+        // for: a record rewritten in the working tree and never committed is
+        // not what a push or a merge would land.
@@ -498,3 +589,11 @@ export function evaluate(
-            text = fs.readFileSync(abs, 'utf8');
-        } catch {
-            failures.push(`${rel}: listed in the diff but not readable on disk`);
+            const bytes = commit === null ? null : fileAtRevision(root, commit, rel);
+            if (bytes === null) {
+                failures.push(`${rel}: listed in the diff but absent at \`${revision}\``);
+                continue;
+            }
+            text = bytes.toString('utf8');
+        } catch (err) {
+            if (!(err instanceof GatedSubjectRefusal)) {
+                throw err;
+            }
+            failures.push(`${rel}: ${err.message}`);
@@ -503 +602 @@ export function evaluate(
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
@@ -510 +609,2 @@ export function evaluate(
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
@@ -545,0 +646 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    let revision = DEFAULT_REVISION;
@@ -570,0 +672,4 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+        } else if (a === '--rev') {
+            revision = argv[i + 1] ?? revision;
+            i += 1;
+            collectingFiles = false;
@@ -589 +694 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        const fromGit = gitChangedFiles(resolveBaseRef(baseRef, root), root);
+        const fromGit = gitChangedFiles(resolveBaseRef(baseRef, root), root, revision);
@@ -597 +702 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-    const result = evaluate(changed, root, configuredProviderCount(policyRoot));
+    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision);
```

## Delta 2 — `src/scripts/_lib/ratification_subject.ts` in full

```ts
/**
 * ratification_subject — the digest a ratification record carries over the
 * gated content it reviewed.
 *
 * The record says WHO reviewed; without a digest it does not say WHAT, so a
 * gated file edited after its review would still ship under a record that
 * approved something else.
 *
 * WHY IT RE-ASSEMBLES THE LIST RATHER THAN RE-DECIDING IT. The gate's
 * `classifyPaths` returns the kernel rules, hooks and plumbing by name but
 * reports the self surface as a BOOLEAN, so that part of the gated list cannot
 * be read back out of it. This module therefore imports the gate's own path
 * constants and re-assembles — it never restates the membership rule, because
 * a second definition of "gated" is a second thing to keep in step, and the
 * first time the two diverged a file would be reviewed by one and digested by
 * the other.
 *
 * WHAT IT READS: GIT OBJECTS AT A NAMED REVISION, NEVER THE WORKING TREE. The
 * revision is resolved to a commit, each gated path is looked up in that
 * commit's tree, and a blob's bytes come from the object store. The filesystem
 * is not consulted for gated content at all, so a dirty working tree, a
 * symbolic link at the path or at any ancestor directory, a FIFO, a device and
 * a file swapped between two system calls are outside what the digest can
 * observe — not defended against one by one, but unreachable by construction.
 * The digest therefore describes what a commit contains, which is what a push
 * or a merge would land.
 *
 * WHAT A TREE ENTRY MAY BE. Absent, or a blob with a regular-file mode
 * (`100644`, `100755`). A blob with mode `120000` — a symbolic link — is
 * REFUSED: its effective content lives at whatever path it names, which the
 * gate's classifier does not see, so neither hashing the target string nor
 * following it would describe what a reviewer approves. A tree (directory) or
 * a gitlink (submodule) at a gated path is refused for the same reason: it is
 * not a file whose bytes a review could have read.
 *
 * WHAT IT DOES NOT COVER. Which paths are gated is still decided by code and
 * by an import closure read from the running checkout — in CI that code is the
 * base revision's, locally it is the checkout's own, and a local edit to the
 * judging code is outside what any digest can answer.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';

import {
    ANCHOR_PATHS,
    CLOSURE_READER_PATH,
    POLICY_PATH,
    READER_PATH,
    SELF_PATH,
    WORKFLOW_PATH,
    classifyPaths,
} from '../check_kernel_edit_ratified.js';

/** The revision a digest is taken at when the caller names none. */
export const DEFAULT_REVISION = 'HEAD';

/**
 * Stands in for the content of a gated file the change deletes. A deleted file
 * is ENTERED, never skipped: skipping would make "this file was removed"
 * digest-identical to "this file was never gated", and removing a governance
 * hook is exactly the change the record most needs to be bound to.
 */
export const DELETED_MARKER = '\u0000deleted\u0000';

/**
 * The mode slot of a deleted entry — Git's own null mode, which no tree entry
 * carries, so a deletion cannot collide with a file whose bytes happen to be
 * {@link DELETED_MARKER}.
 */
export const DELETED_MODE = '000000';

/** The tree-entry modes this digest describes: a regular file, plain or executable. */
const REGULAR_MODES: ReadonlySet<string> = new Set(['100644', '100755']);

/**
 * Upper bound on one blob read. A gated file is a rule, a hook or a config;
 * one larger than this is not something a review read either, and exceeding it
 * is a refusal rather than a silent truncation.
 */
const MAX_BLOB_BYTES = 32 * 1024 * 1024;

/**
 * Every way the subject computation declines to describe a revision.
 *
 * The callers — the gate's `evaluate()` and the CLI — catch THIS class and
 * nothing broader, so a new refusal is one subclass rather than an edit to
 * every catch, and an error that is not a refusal (a defect in this code)
 * still escapes as a crash instead of being reported as a property of the
 * repository.
 */
export class GatedSubjectRefusal extends Error {
    constructor(
        readonly rel: string,
        message: string,
    ) {
        super(message);
        this.name = 'GatedSubjectRefusal';
    }
}

/**
 * Raised when a gated path is not a path inside a tree.
 *
 * Fails CLOSED rather than dropping the path — see {@link assertContained}
 * for why that direction is the safe one.
 */
export class GatedPathEscapes extends GatedSubjectRefusal {
    constructor(rel: string) {
        super(
            rel,
            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so it names nothing ` +
                'inside the revision under review — the digest refuses rather than describing ' +
                'content that is not in the change',
        );
        this.name = 'GatedPathEscapes';
    }
}

/**
 * Raised when a gated path's tree entry is not absent and not a regular file.
 */
export class GatedPathUnsupported extends GatedSubjectRefusal {
    constructor(
        rel: string,
        readonly kind: string,
        why: string,
    ) {
        super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than describing it`);
        this.name = 'GatedPathUnsupported';
    }
}

/**
 * Raised when the revision does not resolve to a commit in the repository at
 * the root — an unknown name, a root that is not a repository, or a string that
 * would be read as an option.
 */
export class GatedRevisionUnresolved extends GatedSubjectRefusal {
    constructor(
        readonly revision: string,
        detail: string,
    ) {
        super(
            '',
            `revision \`${revision}\` does not resolve to a commit (${detail}) — the digest is ` +
                'taken over a commit and refuses rather than guessing which one',
        );
        this.name = 'GatedRevisionUnresolved';
    }
}

/** Raised when no `git` executable can be started. */
export class GitUnavailable extends GatedSubjectRefusal {
    constructor(detail: string) {
        super(
            '',
            `git could not be started (${detail}) — the digest is read from Git objects and ` +
                'refuses rather than falling back to the working tree',
        );
        this.name = 'GitUnavailable';
    }
}

/** Raised when a git command over a resolved revision fails. */
export class GitReadFailed extends GatedSubjectRefusal {
    constructor(rel: string, what: string, detail: string) {
        super(
            rel,
            `git ${what} failed (${detail}) — the digest refuses to describe a revision it ` +
                'could not read',
        );
        this.name = 'GitReadFailed';
    }
}

/**
 * `..` as a whole segment, under either separator. The CLI and the gate
 * normalise `\` to `/` before classifying, but this bound is checked on the
 * string it is given so that it holds for any caller.
 */
const ESCAPING_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/u;

/**
 * POSIX-absolute, UNC (`\\server\share`, `//server/share`), rooted (`\x`) and
 * drive-qualified (`C:\x`, `C:x`) paths.
 */
const ABSOLUTE_SHAPE = /^(?:[\\/]|[A-Za-z]:)/u;

/**
 * Refuse a gated path that is not a path inside a tree.
 *
 * The gate's `KERNEL_RULE_PATH_RE` is not anchored at the start, so a path
 * such as `../../elsewhere/rules/commit-policy.md` classifies as a kernel rule.
 * No tree entry can carry that name, so looking it up would report it ABSENT
 * and enter it as a deletion — a gated path silently described as something
 * it is not. It FAILS CLOSED rather than dropping the path: dropping it would
 * make the digest cover less than the gate gated.
 */
export function assertContained(rel: string): void {
    if (ABSOLUTE_SHAPE.test(rel) || ESCAPING_SEGMENT.test(rel)) {
        throw new GatedPathEscapes(rel);
    }
}

/**
 * Environment variables that tell git which repository to use. Inherited from
 * a calling hook they would point every command below at that repository
 * instead of `root`, so they are dropped and `-C root` alone decides.
 */
const LOCATING_ENV = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
];

function gitEnv(): NodeJS.ProcessEnv {
    // Literal pathspecs: a gated path is a name, and a `*` in it must not
    // match a sibling.
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_LITERAL_PATHSPECS: '1' };
    for (const k of LOCATING_ENV) delete env[k];
    return env;
}

/**
 * Run git in `root`. A spawn that could not start is a typed refusal; a
 * non-zero exit is left to the caller, which knows what it means.
 *
 * Invalid arguments make `spawnSync` THROW rather than return an error, so a
 * programming defect here is never mistaken for a property of the repository.
 */
function runGit(root: string, args: readonly string[], rel: string): SpawnSyncReturns<Buffer> {
    const res = spawnSync('git', ['-C', root, ...args], {
        env: gitEnv(),
        maxBuffer: MAX_BLOB_BYTES,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.error !== undefined) {
        const code = (res.error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            throw new GitUnavailable(code);
        }
        throw new GitReadFailed(rel, args[0] ?? '', res.error.message);
    }
    return res;
}

function stderrOf(res: SpawnSyncReturns<Buffer>): string {
    const text = res.stderr.toString('utf8').trim().split('\n')[0] ?? '';
    return text === '' ? `exit ${String(res.status)}` : text;
}

/**
 * Resolve `revision` to a commit id in the repository whose top level is
 * `root`.
 *
 * A revision beginning with `-` is refused before git sees it, so it can never
 * be read as an option. A `root` that is a SUBDIRECTORY of a repository is
 * refused too: git would discover the enclosing repository and the gated
 * paths, which are relative to `root`, would be looked up at its top level.
 */
export function resolveRevision(root: string, revision: string): string {
    if (revision === '' || revision.startsWith('-')) {
        throw new GatedRevisionUnresolved(revision, 'empty, or shaped like an option');
    }
    const prefix = runGit(root, ['rev-parse', '--show-prefix'], '');
    if (prefix.status !== 0) {
        throw new GatedRevisionUnresolved(revision, stderrOf(prefix));
    }
    if (prefix.stdout.toString('utf8').trim() !== '') {
        throw new GatedRevisionUnresolved(
            revision,
            `\`${root}\` is inside a repository but is not its top level`,
        );
    }
    const res = runGit(root, ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], '');
    const oid = res.stdout.toString('utf8').trim();
    if (res.status !== 0 || !/^[0-9a-f]{40,64}$/u.test(oid)) {
        throw new GatedRevisionUnresolved(revision, stderrOf(res));
    }
    return oid;
}

/** One entry of a commit's tree, as `git ls-tree` reports it. */
interface TreeEntry {
    readonly mode: string;
    readonly type: string;
    readonly oid: string;
}

/**
 * The tree entries of `paths` in `commit`, keyed by exact path. A path with no
 * entry is absent from the map — including one reached through an ancestor
 * that is not a directory in that commit, which is the same statement.
 */
function treeEntriesAt(
    root: string,
    commit: string,
    paths: readonly string[],
): ReadonlyMap<string, TreeEntry> {
    const out = new Map<string, TreeEntry>();
    if (paths.length === 0) {
        return out;
    }
    const res = runGit(root, ['ls-tree', '-z', '--full-tree', commit, '--', ...paths], '');
    if (res.status !== 0) {
        throw new GitReadFailed('', 'ls-tree', stderrOf(res));
    }
    const wanted = new Set(paths);
    for (const record of res.stdout.toString('utf8').split('\u0000')) {
        const tab = record.indexOf('\t');
        if (tab < 0) continue;
        const name = record.slice(tab + 1);
        if (!wanted.has(name)) continue;
        const [mode, type, oid] = record.slice(0, tab).split(' ');
        if (mode === undefined || type === undefined || oid === undefined) {
            throw new GitReadFailed(name, 'ls-tree', `unparseable entry \`${record}\``);
        }
        out.set(name, { mode, type, oid });
    }
    return out;
}

/** The bytes of blob `oid`. */
function blobBytes(root: string, oid: string, rel: string): Buffer {
    const res = runGit(root, ['cat-file', 'blob', oid], rel);
    if (res.status !== 0) {
        throw new GitReadFailed(rel, 'cat-file', stderrOf(res));
    }
    return res.stdout;
}

/**
 * The content of `rel` in `commit`: `null` when absent, the bytes and mode when
 * a regular file, and a refusal for every other kind of entry.
 */
function regularFileAt(
    entry: TreeEntry | undefined,
    root: string,
    rel: string,
): { readonly mode: string; readonly bytes: Buffer } | null {
    if (entry === undefined) {
        return null;
    }
    if (entry.type === 'blob' && REGULAR_MODES.has(entry.mode)) {
        return { mode: entry.mode, bytes: blobBytes(root, entry.oid, rel) };
    }
    const kind =
        entry.mode === '120000'
            ? 'symbolic link'
            : entry.type === 'tree'
              ? 'directory'
              : entry.type === 'commit'
                ? 'submodule'
                : `${entry.type} with mode ${entry.mode}`;
    throw new GatedPathUnsupported(
        rel,
        kind,
        `is a ${kind} in the revision (mode ${entry.mode}), not an absent path or a regular file`,
    );
}

/**
 * The bytes of `rel` in `commit` when it is a regular file there, or `null`
 * when it is absent — read from the object store, never from the working tree.
 * Any other kind of entry is a {@link GatedPathUnsupported} refusal.
 */
export function fileAtRevision(root: string, commit: string, rel: string): Buffer | null {
    assertContained(rel);
    return regularFileAt(treeEntriesAt(root, commit, [rel]).get(rel), root, rel)?.bytes ?? null;
}

/**
 * The self surface, by the gate's own constants rather than a copy of them.
 *
 * READ ON FIRST CALL, NOT AT MODULE SCOPE, because of the import cycle: the
 * gate imports {@link subjectOf} and this module imports the gate's path
 * constants, so whichever of the two Node evaluates second sees the other
 * half-evaluated, and a module-scope `new Set([SELF_PATH, …])` would throw on
 * the temporal dead zone.
 */
let selfSetCache: ReadonlySet<string> | null = null;

function selfSet(): ReadonlySet<string> {
    if (selfSetCache === null) {
        selfSetCache = new Set<string>([
            SELF_PATH,
            READER_PATH,
            CLOSURE_READER_PATH,
            POLICY_PATH,
            WORKFLOW_PATH,
            ...ANCHOR_PATHS,
        ]);
    }
    return selfSetCache;
}

/**
 * The gated subset of a changed-file list: sorted, deduplicated, and stable
 * against the order the caller happened to collect the paths in.
 */
export function gatedFilesOf(
    files: readonly string[],
    derived?: readonly string[],
): readonly string[] {
    const normalized = files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== '');
    const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
    const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
    const self = selfSet();
    for (const f of normalized) {
        if (self.has(f)) out.add(f);
    }
    const sorted = [...out].sort();
    for (const rel of sorted) {
        assertContained(rel);
    }
    return sorted;
}

/** A digest and, from the SAME classification, exactly what it covers and where. */
export interface SubjectReading {
    /** The `subject` a record must carry to answer for this change. */
    readonly digest: string;
    /** The gated files that digest is taken over, sorted. */
    readonly gatedFiles: readonly string[];
    /**
     * The commit the digest was read from, or `null` when nothing is gated —
     * a digest over no files reads nothing, so it resolves nothing either.
     */
    readonly revision: string | null;
}

/**
 * One digest over the sorted paths, modes and contents of the gated files as
 * they are in the commit `revision` resolves to, together with the list it
 * covers and that commit.
 *
 * Each entry is serialised as `path NUL mode NUL sha256hex(content) LF`. NUL
 * cannot occur in a Git path, the mode is six octal digits and the content
 * slot is a fixed 64 hex characters, so the serialisation is unambiguous and
 * no crafted path can reproduce another entry's framing. The path is hashed
 * alongside its content, so two files with identical bytes do not collide and
 * a rename moves the digest; the mode is hashed so that a change of the
 * executable bit is a change.
 *
 * `derived` is the plumbing closure the caller already computed, passed through
 * to {@link gatedFilesOf} unchanged: a digest that classified without it would
 * cover fewer files than the gate gated.
 *
 * THROWS a {@link GatedSubjectRefusal} for every revision it declines to
 * describe.
 */
export function subjectOf(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
    revision: string = DEFAULT_REVISION,
): SubjectReading {
    const gatedFiles = gatedFilesOf(files, derived);
    const h = createHash('sha256');
    if (gatedFiles.length === 0) {
        return { digest: h.digest('hex'), gatedFiles, revision: null };
    }
    const commit = resolveRevision(root, revision);
    const entries = treeEntriesAt(root, commit, gatedFiles);
    for (const rel of gatedFiles) {
        const file = regularFileAt(entries.get(rel), root, rel);
        const mode = file === null ? DELETED_MODE : file.mode;
        const content = file === null ? Buffer.from(DELETED_MARKER) : file.bytes;
        h.update(rel);
        h.update('\u0000');
        h.update(mode);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return { digest: h.digest('hex'), gatedFiles, revision: commit };
}

/**
 * The digest alone, for a caller that has no use for the covered list.
 *
 * Delegates rather than re-implementing: there is ONE classification and ONE
 * hashing loop, and this is a projection of its result.
 */
export function subjectDigest(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
    revision: string = DEFAULT_REVISION,
): string {
    return subjectOf(root, files, derived, revision).digest;
}
```

## Delta 3 — the CLI since round 5

```diff
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
index 32889e00b..ac37c6b5f 100644
--- a/src/scripts/ratification_subject.ts
+++ b/src/scripts/ratification_subject.ts
@@ -15 +15 @@
- * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--quiet]
+ * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] [--quiet]
@@ -22,0 +23,5 @@
+ * `--rev` names the commit the digest is taken at (default `HEAD`). The content
+ * is read from Git objects at that commit, never from the working tree, so the
+ * digest is of what is committed — commit first, then print the digest, and
+ * name the same commit the reviewers were shown.
+ *
@@ -26,3 +31,3 @@
- * Exit codes: 0 = digest printed · 1 = refused, a gated path could not be read,
- * resolves outside the tree, or is not an absent path, a symbolic link or a
- * regular file (nothing on stdout) · 2 = usage error.
+ * Exit codes: 0 = digest printed · 1 = refused: the revision does not resolve,
+ * git cannot run or read it, or a gated path escapes the tree or is not absent
+ * or a regular file in that commit (nothing on stdout) · 2 = usage error.
@@ -35 +40 @@ import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
-import { GatedSubjectRefusal } from './_lib/ratification_subject.js';
+import { DEFAULT_REVISION, GatedSubjectRefusal } from './_lib/ratification_subject.js';
@@ -42,0 +48 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    let revision = DEFAULT_REVISION;
@@ -66,0 +73,11 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+        if (a === '--rev') {
+            const value = argv[i + 1];
+            if (value === undefined || value.startsWith('--')) {
+                process.stderr.write('error: --rev takes a revision\n');
+                return 2;
+            }
+            revision = value;
+            i += 1;
+            collecting = false;
+            continue;
+        }
@@ -85 +102,2 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-            'usage: ratification_subject --files <path> [<path> …] [--root DIR] [--quiet]\n' +
+            'usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] ' +
+                '[--quiet]\n' +
@@ -96,0 +115 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    let commit: string | null;
@@ -98 +117 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        ({ digest, gatedFiles: gated } = expectedSubjectFor(files, root));
+        ({ digest, gatedFiles: gated, revision: commit } = expectedSubjectFor(files, root, revision));
@@ -122,0 +142,3 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    process.stdout.write(
+        `revision: ${commit ?? '(none read — nothing in this change is gated)'}\n`,
+    );
```

## Delta 4 — the contract since round 5

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 69cc7f7ab..79c457a61 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -74,14 +74,32 @@ An eighth field, `subject:`, is a sha-256 hex digest over the **gated** files of
-the change: their sorted paths, each hashed alongside its content, with a
-deleted gated file entered rather than skipped. `./scripts-run
-src/scripts/ratification_subject --files <f> …` prints it, and
-`check_kernel_edit_ratified` recomputes it from the tree it is pointed at and
-refuses a record whose `subject` is absent (`subject-absent`), not a digest
-(`subject-malformed`) or a different one (`subject-mismatch`). A gated path it
-cannot read, or one that would resolve outside the tree, is a refusal too —
-an unreadable file is not a deleted one, and a digest that described either as
-the other would be the fail-open shape this mechanism exists to refuse. So is a
-gated path that is not absent, a symbolic link or a regular file — a FIFO,
-socket, device or directory is refused before it is opened, because opening a
-FIFO can block the gate — and a platform that cannot open without following a
-link (`O_NOFOLLOW`) or without blocking (`O_NONBLOCK`) refuses rather than
-reading with less protection.
+the change **as they are in one commit**: their sorted paths, each hashed with
+its Git mode and its content, with a deleted gated file entered rather than
+skipped. `./scripts-run src/scripts/ratification_subject --files <f> … [--rev
+REV]` prints it together with the commit it read, and
+`check_kernel_edit_ratified [--rev REV]` recomputes it and refuses a record
+whose `subject` is absent (`subject-absent`), not a digest
+(`subject-malformed`) or a different one (`subject-mismatch`). Both default to
+`HEAD`.
+
+**The digest is read from Git objects, never from the working tree.** The
+revision is resolved to a commit, each gated path is looked up in that commit's
+tree (`git ls-tree`) and a blob's bytes come from the object store
+(`git cat-file`). The gate reads the **record** at the same commit. So an
+uncommitted edit — to a gated file or to the record — can neither pass nor fail
+the gate, and a symbolic link, FIFO or device on disk, at the path or at any
+ancestor directory, is not something the digest can observe. What the pre-push
+run compares is therefore the `HEAD` commit: the changed-file list is
+`git diff <base>...HEAD`, the content and the record are read from `HEAD`'s
+tree. In CI the gate reads the checkout's own `HEAD`. Commit first, then
+print the digest, and show the reviewers that same commit.
+
+A gated path that is absent in the commit is a deletion. A gated path whose
+tree entry is a regular file (`100644`, `100755`) is hashed. **Every other entry
+is a refusal**, and the one that needs a decision is the symbolic link (mode
+`120000`): it is refused rather than hashed as its target string or followed,
+because its effective content lives at another path the gate's classifier does
+not see, so no digest of the link describes what a reviewer would approve. A
+directory or a submodule at a gated path is refused for the same reason. So is
+a revision that does not resolve to a commit, a `--root` that is not a
+repository's top level, a gated path that names nothing inside a tree (absolute,
+or with a `..` segment), and a git that cannot be started or fails — each a
+typed refusal (exit 1), never a fallback to reading the disk.
@@ -99 +117,4 @@ equivalent and is not:
-  to another gated path is a different change, not the same one.
+  to another gated path is a different change, not the same one. The **mode**
+  is hashed too, so flipping the executable bit is a change. Each entry is
+  `path NUL mode NUL sha256hex(content) LF`, unambiguous because NUL cannot
+  occur in a Git path and the other two slots are fixed-width.
@@ -103,2 +124,2 @@ equivalent and is not:
-- **No base diff.** The digest is over the tree as it stands, so it reads the
-  same on a branch and on the merged checkout CI judges — unless the base moved
+- **No base diff.** The digest is over the commit's tree as it stands, so it
+  reads the same on a branch and on the merged checkout CI judges — unless the base moved
@@ -672 +693 @@ that said it had not. A record now carries `subject`, and the gate recomputes
-that digest from the tree it is pointed at and refuses a record whose `subject`
+that digest from the commit it is pointed at and refuses a record whose `subject`
@@ -677,0 +699,5 @@ state. Steps 2.1 and 2.2 of
+**What the object-store read does NOT close.** Which paths are gated is still
+decided by the judging code and by an import closure it reads from the running
+checkout. In CI that code is the base revision's; locally it is the checkout's
+own, and a local edit to the judging code is outside what any digest answers.
+
```
