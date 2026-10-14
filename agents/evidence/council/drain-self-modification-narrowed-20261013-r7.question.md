<!-- evidence-type: analysis -->

<!-- Round-7 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 7 — the narrowed content binding

Round 7 of the modification review of the narrowed content binding (PR #2325).
Round 6 closed `refused` 2/2 on one shared finding. The owner directed that the
confirmed findings be fixed and the change come back for this round. The code
under review is commit `820a4eda1`.

## Round 6's shared finding

> anthropic: "The implementation resolves `revision` independently for: 1.
> Changed-file discovery (`git diff <base>...<revision>`) 2. Content hashing
> (`resolveRevision(root, revision)`) 3. Record reading (same call). A mutable
> revision (HEAD, branch, tag) may therefore identify **different commits**
> during one run [...] Resolve `--rev` exactly once in `main()` to an immutable
> commit OID [...] Pass that OID through all operations."

> openai: "the gate does not yet ensure that changed-file discovery, hashing,
> and record reading use one immutable commit; the highest-leverage pre-merge
> change is to resolve `--rev` once before the diff and pass that OID through
> every subsequent operation, with shared strict option parsing."

Also raised in round 6: state the empty-gated-set exception in the contract
(openai); run the diff through the same git runner as the subject (openai);
validate a valueless `--rev` in the gate as the CLI does (anthropic); a test in
which the ref moves between operations (anthropic); the mutual import between
the gate and the subject module (openai, not stated as blocking).

## What changed since round 6

Commits: `4d8b8e2b2` (fix and tests), `1448d3b02` (contract), `419f076bd`
(rename detection, below), `0e207508b` (contract), `820a4eda1` (roadmap).

- `check_kernel_edit_ratified.main()`: when the gate builds the changed-file
  list itself (no `--files`), it calls `resolveRevision(root, revision)` once,
  before the diff. The resulting commit id is passed to the diff and then, as
  `revision`, to `evaluate()`, which hands it to `subjectOf` (which resolves the
  id again — `rev-parse --verify <oid>^{commit}` returns the same id) and uses
  the commit returned by `subjectOf` for the record read. A resolution refusal
  is exit 1 on stderr; a diff failure is exit 3, as before.
- The diff is `changedFilesBetween(root, base, commit)` in
  `_lib/ratification_subject.ts`, through the same `runGit` as the subject
  (locating `GIT_*` variables removed), as `git diff --no-renames --name-only
  -z <base>...<commit>`, NUL-split. A base ref that is empty or starts with `-`
  is refused. The default-base probe (`origin/main`, `origin/master`, `main`,
  `master`, else `HEAD~1`) now uses `refExists`, the same runner.
- `--no-renames` was not raised by a seat. Writing the new call, the author
  found that rename detection listed a gated file moved to an ungated path only
  under its destination, so the removal of a kernel rule passed unratified on
  the pre-push path. It was reproduced red before the flag was added. The CI
  path takes its list from `gh pr view --json files` in the workflow, which this
  change does not touch; whether that list reports a renamed file's old path
  was not established.
- Option parsing: `optionValue(argv, i)` in the lib returns `null` when the
  next argument is missing or starts with `--`. The gate uses it for `--rev`,
  `--root`, `--base-ref` and `--policy-root` and refuses a missing value with
  exit 1; the subject CLI uses it for `--root` and `--rev` (exit 2, unchanged).
  The gate's `--root`, `--base-ref` and `--policy-root` previously fell back to
  their defaults when the value was missing; they now refuse as well.
- Contract: a "One run, one commit" paragraph, and "The one exception: an
  empty gated set reads no commit" — with no gated path, neither the subject
  CLI nor the gate under `--files` resolves the revision, so an invalid `--rev`
  passes; without `--files` the gate still resolves it because the diff needs a
  commit.
- Not changed: the mutual import between `check_kernel_edit_ratified.ts` and
  `_lib/ratification_subject.ts`.

## Tests, and each new case seen red

Four cases added to `tests/scripts/ratification_subject_revision.test.ts`
(22 cases now). The moving-ref case puts a `git` wrapper first on `PATH` that
runs the real git and, right after the first git invocation whose arguments
name the branch `feature` (`feature`, `feature^…` or `…...feature`), advances
`refs/heads/feature` from the reviewed commit to a later commit that edits the
kernel rule. The record in the reviewed commit carries that commit's subject.
The test asserts the wrapper did move the branch, and that the gate exits 0
and prints `ratified by`.

| How | Result |
|---|---|
| fix neutralised in place: diff given the revision NAME, `revision = commit` removed, the gate's valueless-option refusal replaced by `continue` | 3 of 21 red: the moving-ref case (output carried the subject mismatch, not `ratified by`), `--rev` with no value, `--rev` followed by `--files` |
| restored from a scratch copy | 21 of 21 green |
| rename case written before `--no-renames` | red: `scanned: 1`, "nothing to ratify", exit 0 |
| `--no-renames` added | 22 of 22 green |

After the changes: the 10 ratification / kernel-edit suites pass (152 tests);
`tsc --noEmit`, eslint on the touched files, `lint_code_comments`,
`check_test_weakening`, `lint_evidence_artifacts` and the roadmap lints are
clean; `task sync` and `task generate-tools` produce no drift. No existing
assertion was changed this round.

## The digest

Over this branch's full changed-file list, `ratification_subject` prints
`subject: 6eea14ee9ab10fccf6ddfaeda6d57e545ebecc779617fcfe688ea028611bcff3`,
`revision: 820a4eda1384764693553a8091cafd36056dea50`, over two gated files,
`src/scripts/_lib/ratification_artifact.ts` and
`src/scripts/check_kernel_edit_ratified.ts`. It moved from round 6's
`f6ac2f8c…` because the gate file changed. `_lib/ratification_subject.ts` and
the CLI are not in the gated set at this revision. `origin/main` has moved one
commit since this branch's merge base `d23dcec56`; that commit touches none of
the files in this bundle. The branch has not been merged with it yet.

## What is in this bundle, and what is not

Included below:

1. **Delta 1 — the gated files, PR against the merge base with `origin/main`**,
   no context lines: `src/scripts/_lib/ratification_artifact.ts` and
   `src/scripts/check_kernel_edit_ratified.ts`.
2. **`check_kernel_edit_ratified.main()` in full** as of `820a4eda1`, because
   Delta 1 has no context lines and this round's change is concentrated there.
3. **Delta 2 — `src/scripts/_lib/ratification_subject.ts` since round 6**
   (`50d20d11e`), no context lines. The full file was in the round-6 bundle; it
   is not repeated.
4. **Delta 3 — the CLI, `src/scripts/ratification_subject.ts`, since round 6.**
5. **Delta 4 — the contract, `docs/contracts/ratification-artifact.md`, since
   round 6.**
6. **Delta 5 — `tests/scripts/ratification_subject_revision.test.ts` since
   round 6.**

Not included: the rest of `_lib/ratification_subject.ts`, the CLI and the
contract as they stood before round 6; every other test file and the fixture
helper; the workflow that invokes the gate in CI; the roadmap; the test-removal
account; the ratification record; earlier round prompts. If a question below
cannot be answered from what you can see, say which part you could not see
rather than answering around it.

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

## Delta 1 — the gated files, PR against the merge base with `origin/main`

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
index 26d5a22f3..f56e4555c 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -63,0 +64,7 @@
+ *   --rev REV         the commit the gated content and the artifacts are read
+ *                     at (default HEAD) — Git objects, never the working tree,
+ *                     so an uncommitted edit can neither pass nor fail the gate.
+ *                     Without --files it is resolved ONCE to a commit id, and
+ *                     that id — not the name — feeds the diff, the digest and
+ *                     the record read, so a ref that moves mid-run cannot pair
+ *                     one commit's file list with another commit's content
@@ -68,0 +76,3 @@
+ * An option that takes a value and is given none is a refusal (exit 1), never
+ * a silent default.
+ *
@@ -72 +81,0 @@
-import { spawnSync } from 'node:child_process';
@@ -87,0 +97,11 @@ import {
+import {
+    DEFAULT_REVISION,
+    GatedSubjectRefusal,
+    changedFilesBetween,
+    fileAtRevision,
+    optionValue,
+    refExists,
+    resolveRevision,
+    subjectOf,
+    type SubjectReading,
+} from './_lib/ratification_subject.js';
@@ -363,11 +382,0 @@ export function configuredProviderCount(policyRoot: string): number | null {
-function gitChangedFiles(baseRef: string, root: string): string[] | null {
-    const res = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
-        cwd: root,
-        encoding: 'utf8',
-    });
-    if (res.status !== 0) {
-        return null;
-    }
-    return (res.stdout ?? '').split('\n').filter((l) => l.trim() !== '');
-}
-
@@ -379,5 +388 @@ function resolveBaseRef(explicit: string | null, root: string): string {
-        const res = spawnSync('git', ['rev-parse', '--verify', candidate], {
-            cwd: root,
-            stdio: ['ignore', 'ignore', 'ignore'],
-        });
-        if (res.status === 0) {
+        if (refExists(root, candidate)) {
@@ -389,0 +395,41 @@ function resolveBaseRef(explicit: string | null, root: string): string {
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
@@ -400,0 +447 @@ export function evaluate(
+    revision: string = DEFAULT_REVISION,
@@ -406,3 +453,2 @@ export function evaluate(
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
@@ -450,0 +497,38 @@ export function evaluate(
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
@@ -495 +579,3 @@ export function evaluate(
-        const abs = path.join(root, rel);
+        // The record is read at the same commit as the content it answers
+        // for: a record rewritten in the working tree and never committed is
+        // not what a push or a merge would land.
@@ -498,3 +584,11 @@ export function evaluate(
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
@@ -503 +597 @@ export function evaluate(
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
@@ -510 +604,2 @@ export function evaluate(
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
@@ -545,0 +641 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    let revision = DEFAULT_REVISION;
@@ -560,0 +657 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    const valueOptions = new Set(['--base-ref', '--root', '--rev', '--policy-root']);
@@ -563,10 +660,15 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        if (a === '--base-ref') {
-            baseRef = argv[i + 1] ?? null;
-            i += 1;
-            collectingFiles = false;
-        } else if (a === '--root') {
-            root = path.resolve(argv[i + 1] ?? root);
-            i += 1;
-            collectingFiles = false;
-        } else if (a === '--policy-root') {
-            policyRoot = path.resolve(argv[i + 1] ?? policyRoot);
+        if (a !== undefined && valueOptions.has(a)) {
+            const value = optionValue(argv, i);
+            if (value === null) {
+                process.stderr.write(`❌  check_kernel_edit_ratified: ${a} takes a value\n`);
+                return 1;
+            }
+            if (a === '--base-ref') {
+                baseRef = value;
+            } else if (a === '--root') {
+                root = path.resolve(value);
+            } else if (a === '--rev') {
+                revision = value;
+            } else {
+                policyRoot = path.resolve(value);
+            }
@@ -589,3 +691,21 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        const fromGit = gitChangedFiles(resolveBaseRef(baseRef, root), root);
-        if (fromGit === null) {
-            process.stderr.write('❌  check_kernel_edit_ratified: git diff failed\n');
+        // ONE resolution for the whole run. The diff, the digest and the
+        // record read all receive this id; passing the name to each would let
+        // a ref that moves between them yield a file list from one commit and
+        // a digest and record from another.
+        let commit: string;
+        try {
+            commit = resolveRevision(root, revision);
+        } catch (err) {
+            if (!(err instanceof GatedSubjectRefusal)) {
+                throw err;
+            }
+            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
+            return 1;
+        }
+        try {
+            changed = changedFilesBetween(root, resolveBaseRef(baseRef, root), commit);
+        } catch (err) {
+            if (!(err instanceof GatedSubjectRefusal)) {
+                throw err;
+            }
+            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
@@ -594 +714 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        changed = fromGit;
+        revision = commit;
@@ -597 +717 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-    const result = evaluate(changed, root, configuredProviderCount(policyRoot));
+    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision);
```

## `check_kernel_edit_ratified.main()` in full

```ts
export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let baseRef: string | null = null;
    let revision = DEFAULT_REVISION;
    let root = REPO;
    // The policy is read relative to THIS SCRIPT's tree, never to `--root`.
    //
    // Round 1 refused the previous shape for a bootstrap reason: CI ran the
    // gate from the PR head, so a candidate diff supplied the code that judged
    // it. The workflow now runs the BASE revision's copy of this script with
    // `--root <head>`, so the judging code is one the PR did not write — and
    // that only holds if the quorum policy comes from the base too. Reading it
    // from `--root` would let the same PR lower `required_providers` and have
    // the base gate honour the lowered number.
    let policyRoot = REPO;
    let quiet = false;
    const files: string[] = [];
    let collectingFiles = false;

    const valueOptions = new Set(['--base-ref', '--root', '--rev', '--policy-root']);
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a !== undefined && valueOptions.has(a)) {
            const value = optionValue(argv, i);
            if (value === null) {
                process.stderr.write(`❌  check_kernel_edit_ratified: ${a} takes a value\n`);
                return 1;
            }
            if (a === '--base-ref') {
                baseRef = value;
            } else if (a === '--root') {
                root = path.resolve(value);
            } else if (a === '--rev') {
                revision = value;
            } else {
                policyRoot = path.resolve(value);
            }
            i += 1;
            collectingFiles = false;
        } else if (a === '--quiet') {
            quiet = true;
            collectingFiles = false;
        } else if (a === '--files') {
            collectingFiles = true;
        } else if (collectingFiles && a !== undefined) {
            files.push(a);
        }
    }

    let changed: string[];
    if (files.length > 0) {
        changed = files;
    } else {
        // ONE resolution for the whole run. The diff, the digest and the
        // record read all receive this id; passing the name to each would let
        // a ref that moves between them yield a file list from one commit and
        // a digest and record from another.
        let commit: string;
        try {
            commit = resolveRevision(root, revision);
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
            return 1;
        }
        try {
            changed = changedFilesBetween(root, resolveBaseRef(baseRef, root), commit);
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            process.stderr.write(`❌  check_kernel_edit_ratified: ${err.message}\n`);
            return 3;
        }
        revision = commit;
    }

    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision);

    // OUTSIDE the quiet guard: CI passes --quiet, and a coverage guard that
    // sees no count reports the gate silent.
    //
    // Through `reportScanned` rather than a bare write, which is what makes the
    // gate HARDENED — `check_gate_coverage`'s predicate is "routes through
    // _lib/scan_scope OR emits the line AND is registered with a floor", and a
    // diff-scoped gate can carry no honest floor (an empty diff scans zero by
    // construction). A bare write put it in the unhardened population and made
    // it owe a `gate-coverage.yml` row it cannot fill.
    reportScanned({
        gate: 'check_kernel_edit_ratified',
        scanned: result.scanned,
        units: 'changed path(s)',
        roots: ['<the diff against the base ref>'],
        allowEmpty:
            'EMPTY_VALID: the corpus is one diff. A commit range that changed nothing is a ' +
            'real state, and there is then no kernel rule, governance hook, plumbing source or ' +
            'mechanism file to ratify — the gate has read everything there was.',
    });
    if (!quiet || result.exitCode !== 0) {
        for (const l of result.lines) {
            process.stdout.write(`${l}\n`);
        }
    }
    return result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
```

## Delta 2 — `src/scripts/_lib/ratification_subject.ts` since round 6

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index dacbf53fb..4ffffe347 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -287,0 +288,52 @@ export function resolveRevision(root: string, revision: string): string {
+/**
+ * Whether `ref` names a commit in the repository at `root`, through the
+ * scrubbed runner — the gate's default-base probe, which must look in the same
+ * repository the diff and the digest read.
+ */
+export function refExists(root: string, ref: string): boolean {
+    return runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], '').status === 0;
+}
+
+/**
+ * The paths changed between `base` and `commit`, through the same scrubbed
+ * runner as the subject, so an inherited `GIT_DIR` cannot point the list at a
+ * different repository from the one the digest reads.
+ *
+ * `commit` must already be a commit id from {@link resolveRevision}: the list,
+ * the digest and the record are only one reading of one commit if the name was
+ * resolved once, before any of them.
+ */
+export function changedFilesBetween(root: string, base: string, commit: string): string[] {
+    if (base === '' || base.startsWith('-')) {
+        throw new GitReadFailed(
+            '',
+            'diff',
+            `base ref \`${base}\` is empty or shaped like an option`,
+        );
+    }
+    // `--no-renames`: rename detection reports only the destination, so a
+    // gated file moved to an ungated path would vanish from the list.
+    const args = ['diff', '--no-renames', '--name-only', '-z', `${base}...${commit}`];
+    const res = runGit(root, args, '');
+    if (res.status !== 0) {
+        throw new GitReadFailed('', 'diff', stderrOf(res));
+    }
+    return res.stdout
+        .toString('utf8')
+        .split('\u0000')
+        .filter((l) => l.trim() !== '');
+}
+
+/**
+ * The value following option `argv[i]`, or `null` when there is none — the end
+ * of the arguments, or another `--option` in its place.
+ *
+ * Shared by the gate and the subject CLI so the two refuse the same shapes: a
+ * `--rev` with no value used to fall back to `HEAD` in the gate while the CLI
+ * refused it.
+ */
+export function optionValue(argv: readonly string[], i: number): string | null {
+    const value = argv[i + 1];
+    return value === undefined || value.startsWith('--') ? null : value;
+}
+
```

## Delta 3 — the CLI since round 6

```diff
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
index ac37c6b5f..448c08532 100644
--- a/src/scripts/ratification_subject.ts
+++ b/src/scripts/ratification_subject.ts
@@ -40 +40 @@ import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
-import { DEFAULT_REVISION, GatedSubjectRefusal } from './_lib/ratification_subject.js';
+import { DEFAULT_REVISION, GatedSubjectRefusal, optionValue } from './_lib/ratification_subject.js';
@@ -63,2 +63,2 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-            const value = argv[i + 1];
-            if (value === undefined || value.startsWith('--')) {
+            const value = optionValue(argv, i);
+            if (value === null) {
@@ -74,2 +74,2 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-            const value = argv[i + 1];
-            if (value === undefined || value.startsWith('--')) {
+            const value = optionValue(argv, i);
+            if (value === null) {
```

## Delta 4 — the contract since round 6

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 79c457a61..92e59ff41 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -94,0 +95,21 @@ print the digest, and show the reviewers that same commit.
+**One run, one commit.** When the gate builds the changed-file list itself (no
+`--files`), it resolves `--rev` **once**, to a commit id, before anything else,
+and hands that id — never the name — to the diff, the digest and the record
+read. A `HEAD`, branch or tag that moves during the run therefore cannot pair
+one commit's file list with another commit's content or record. The diff runs
+through the same git invocation as the digest, with the repository-locating
+environment (`GIT_DIR` and its siblings) removed, so the list and the content
+come from the same repository, and with rename detection off, so a gated file
+moved to an ungated path is listed under its old path as a deletion rather than
+only under its new one. The CI path takes its list from `gh pr view --json
+files` instead and is not changed by this. An option that takes a value — `--rev`,
+`--root`, `--base-ref`, `--policy-root` — and is given none is a refusal
+(exit 1), as in the subject CLI, never a fall-back to the default.
+
+**The one exception: an empty gated set reads no commit.** When no changed path
+is gated, the digest is the digest of nothing and no record is owed, so neither
+`ratification_subject` nor the gate under `--files` resolves the revision, and
+an invalid `--rev` then passes rather than refusing. Without `--files` the gate
+still resolves it, because the diff needs a commit. The exception is
+deliberate: there is no content whose reading the revision could change.
+
```

## Delta 5 — the revision test suite since round 6

```diff
diff --git a/tests/scripts/ratification_subject_revision.test.ts b/tests/scripts/ratification_subject_revision.test.ts
index eb264a176..80b7ef7be 100644
--- a/tests/scripts/ratification_subject_revision.test.ts
+++ b/tests/scripts/ratification_subject_revision.test.ts
@@ -7 +7,7 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { evaluate, expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';
+import { spawnSync } from 'node:child_process';
+
+import {
+    evaluate,
+    expectedSubjectFor,
+    main as gateMain,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
@@ -288,0 +295,130 @@ describe('git failures are typed refusals', () => {
+
+/** Run the gate's `main()` with stdout and stderr captured. */
+function runGate(argv: readonly string[]): { code: number; out: string; err: string } {
+    let out = '';
+    let err = '';
+    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
+        out += String(c);
+        return true;
+    });
+    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
+        err += String(c);
+        return true;
+    });
+    try {
+        return { code: gateMain(argv), out, err };
+    } finally {
+        o.mockRestore();
+        e.mockRestore();
+    }
+}
+
+describe('one gate run reads one commit (step 2.7)', () => {
+    /**
+     * Round 6's finding: the changed-file list was taken from the revision
+     * NAME and the digest and record resolved the name again, so a ref that
+     * moved between the two paired one commit's list with another commit's
+     * content. A `git` wrapper on PATH advances the branch right after the
+     * first git call that names it — whichever call that is — so the case is
+     * red for every shape that resolves the name more than once.
+     */
+    it('a branch that moves after the first read does not change what the gate judges', () => {
+        const realGit = spawnSync('sh', ['-c', 'command -v git'], {
+            encoding: 'utf8',
+        }).stdout.trim();
+        write('README.md', 'base\n');
+        const base = commitAll(root);
+        write(KERNEL, 'reviewed\n');
+        const rel = path.join(RATIFICATION_DIR, 'r.md');
+        write(rel, recordText('0'.repeat(64), 'ratified'));
+        commitAll(root);
+        // The record answers for the reviewed commit's content.
+        write(rel, recordText(expectedSubjectFor([KERNEL, rel], root, 'HEAD').digest, 'ratified'));
+        const reviewed = commitAll(root);
+        write(KERNEL, 'edited after the review\n');
+        const later = commitAll(root);
+        spawnSync(realGit, ['-C', root, 'branch', 'feature', reviewed]);
+
+        const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-git-'));
+        const mark = path.join(bin, 'moved');
+        fs.writeFileSync(
+            path.join(bin, 'git'),
+            [
+                '#!/bin/sh',
+                '"$REAL_GIT" "$@"',
+                'status=$?',
+                'if [ ! -e "$MOVE_MARK" ]; then',
+                '  for a in "$@"; do',
+                '    case "$a" in',
+                '      feature|feature^*|*...feature)',
+                '        : > "$MOVE_MARK"',
+                '        "$REAL_GIT" -C "$MOVE_REPO" update-ref refs/heads/feature "$MOVE_TO"',
+                '        break;;',
+                '    esac',
+                '  done',
+                'fi',
+                'exit $status',
+                '',
+            ].join('\n'),
+            { mode: 0o755 },
+        );
+        vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH ?? ''}`);
+        vi.stubEnv('REAL_GIT', realGit);
+        vi.stubEnv('MOVE_MARK', mark);
+        vi.stubEnv('MOVE_REPO', root);
+        vi.stubEnv('MOVE_TO', later);
+
+        try {
+            const r = runGate([
+                '--root',
+                root,
+                '--base-ref',
+                base,
+                '--rev',
+                'feature',
+                '--policy-root',
+                process.cwd(),
+            ]);
+            // The move happened mid-run, so the green below is not a run in
+            // which nothing moved.
+            expect(fs.existsSync(mark)).toBe(true);
+            const moved = spawnSync(realGit, ['-C', root, 'rev-parse', 'feature'], {
+                encoding: 'utf8',
+            });
+            expect(moved.stdout.trim()).toBe(later);
+            expect(r.out).toContain('ratified by');
+            expect(r.code).toBe(0);
+        } finally {
+            fs.rmSync(bin, { recursive: true, force: true });
+        }
+    });
+
+    it('a gated file renamed away is listed under its old path, so the gate still sees it', () => {
+        // Rename detection would report only the destination, which is not
+        // gated, and the removal of the kernel rule would pass unratified.
+        write('README.md', 'base\n');
+        write(KERNEL, 'a kernel rule long enough to be detected as renamed\n'.repeat(4));
+        const base = commitAll(root);
+        fs.renameSync(path.join(root, KERNEL), path.join(root, 'src/moved.md'));
+        commitAll(root);
+        const r = runGate(['--root', root, '--base-ref', base, '--policy-root', process.cwd()]);
+        expect(r.out).toContain(KERNEL);
+        expect(r.code).toBe(1);
+    });
+
+    it('`--rev` with no value is refused by the gate, not defaulted to HEAD', () => {
+        write(KERNEL, 'x\n');
+        commitAll(root);
+        const r = runGate(['--root', root, '--files', KERNEL, '--rev']);
+        expect(r.code).toBe(1);
+        expect(r.err).toContain('--rev takes a value');
+    });
+
+    it('`--rev` followed by another option is refused as having no value', () => {
+        write(KERNEL, 'x\n');
+        commitAll(root);
+        const r = runGate(['--root', root, '--rev', '--files', KERNEL]);
+        expect(r.code).toBe(1);
+        expect(r.err).toContain('--rev takes a value');
+    });
+});
```
