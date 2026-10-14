<!-- evidence-type: analysis -->

<!-- Round-8 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 8 — the narrowed content binding

Round 8 of the modification review of the narrowed content binding (PR #2325).
Round 7 was answered by one seat: anthropic `refused`; openai gave no verdict
(the local spawn failed with `ENOBUFS`). The owner directed that confirmed
findings be fixed and the change come back for this round. The code under
review is commit `2f393127f`.

## Round 7's finding

> anthropic: "The local race and rename fixes are credible and well-tested. But
> the **authoritative CI projection** can still miss the old side of a rename,
> and no end-to-end test covers it. The highest-leverage change: make CI derive
> paths through the same `--no-renames` Git implementation—or verify inclusion
> and add CI regression test—before merge."

> anthropic: "If GitHub's file projection reports renamed files only by
> destination, moving `src/rules/kernel-rule.md` to `src/guidelines/moved.md`
> would produce an empty gated set and pass without ratification—the exact
> bypass the local rename test prevents."

anthropic also wrote that it agreed with "Reviewer B's core finding" in its
second pass; Reviewer B's first-pass text is not persisted and is not
reconstructed here.

## The fact the finding was conditional on

Observed against this repository's PR 2344, which archives a roadmap by moving
it:

- `gh pr view 2344 --json files` lists the file once, as
  `{"additions":5,"changeType":"RENAMED","deletions":4,"path":"agents/roadmaps/archive/road-to-a-release-that-reads-its-settings-delta.md"}`.
  The object's keys are `additions`, `changeType`, `deletions`, `path` — there
  is no previous path.
- REST `GET repos/{owner}/{repo}/pulls/2344/files` carries the same entry with
  `"status":"renamed"` and
  `"previous_filename":"agents/roadmaps/road-to-a-release-that-reads-its-settings-delta.md"`.

So the list the workflow passed under `--files` did miss the old side of a
rename. The finding is confirmed, not conditional.

## What changed since round 7

Commits: `441e2e73b` (workflow, gate usage comment, CI-path test),
`38bd51fc3` (contract), `f4b5ee9f4` (council CLI spawn buffer — not part of the
gated set, see below), `2f393127f` (roadmap).

- **The workflow step** that runs the ratification gate no longer builds a
  file list. It passes `--base-ref "$BASE_SHA"` and no `--files`, to the base
  revision's gate and, in the bootstrap branch, to the head's. The gate then
  resolves `HEAD` once and lists paths with `changedFilesBetween()` —
  `git diff --no-renames --name-only -z <base>...<commit>` through the scrubbed
  runner — so CI and pre-push take the list from one implementation. The job
  checks out with `fetch-depth: 0` (unchanged), so the base commit is present
  and no fetch is added; the fetch race the old comment cited does not arise.
  The `gh pr view` call, its empty-list early exit and the now-unused
  `GH_TOKEN` were removed from this step. An empty diff is handled by the gate
  itself (`scanned: 0`, nothing to ratify), as on the pre-push path.
- **`diff.renames=false` through `GIT_CONFIG_COUNT/KEY_0/VALUE_0`** on that
  step. The judging copy is the BASE revision's gate. For this PR that is
  `origin/main`'s copy, whose own diff is `git diff --name-only
  <base>...HEAD` with rename detection on and no subject binding at all. The
  environment turns rename detection off for that call too. Checked: in a
  fixture with one rename, plain `git diff --name-only` printed only the
  destination; with the three variables set it printed both paths.
- **Not changed**: the kernel-rule bundle step just above still reads the
  `gh pr view` list under `--files`, so it shares the rename blindness. It is a
  different gate (one kernel rule per PR) and is not in this change.
- **Contract**: the "One run, one commit" paragraph no longer says the CI path
  is unchanged; it says the CI path passes `--base-ref` and why, and names the
  environment override.
- **Gate**: only the usage comment for `--files` changed ("testing"; CI derives
  the list from git). `main()` and `evaluate()` are as in round 7.
- **Council CLI** (`src/scripts/ai_council/clients.ts`, not gated): the member
  spawn had no `maxBuffer`, so Node's 1 MiB default applied; a member CLI that
  prints its working log next to the answer exceeded it. `maxBuffer` is now
  64 MiB, the API transport's value. The openai seat's stale probe entry, which
  skipped it after round 7, was removed before this run.

## Tests, and each new case seen red

New: `tests/scripts/check_kernel_edit_ratified_ci_path.test.ts` (Delta 4, in
full). It parses `.github/workflows/consistency.yml`, takes the one step named
"Kernel / governance-hook edits carry a ratification artifact", extracts every
line of its `run` script that invokes the gate (two: the base-copy run and the
bootstrap run), and runs each line's arguments through the head's `main()` on a
fixture in which a kernel rule is renamed to an ungated path. Workflow
variables are substituted: `$PWD` by the fixture root, `$BASE_SHA` by the base
commit, and `"${CHANGED[@]}"` by `git diff -M --name-only base...HEAD`, i.e.
destinations only — an emulation of the GitHub list, backed by the PR 2344
observation above, not a call to GitHub. It runs the head's gate, not
`origin/main`'s; the base-copy behaviour for this PR rests on the environment
check above.

| How | Result |
|---|---|
| test written against the `--files` step | red: `scanned: 1`, "nothing to ratify", the kernel path not in the output |
| step switched to `--base-ref` | green |
| `--no-renames` removed from `changedFilesBetween` in place | red, same output |
| restored from a scratch copy (no diff) | green |

New: `tests/scripts/ai_council/cli_spawn_buffer.test.ts` — the real
`_runSubprocess` reads 2 MiB from a child: red before `maxBuffer` (the overflow
killed the child with `SIGTERM`, which that code path reports as `timeout`),
green after.

After the changes the 10 ratification / kernel-edit suites plus the new one
pass (153 tests, run one at a time); `tsc --noEmit`, eslint on the touched
files, `lint_code_comments`, `check_test_weakening`, `lint_evidence_artifacts`,
`lint_workflow_security`, `lint_workflow_paths`, the workflow-parsing suites
and the roadmap lints are clean; `task sync` and `task generate-tools` produce
no drift. `actionlint` was not run locally (not installed); CI runs it on
changed workflow files. No existing assertion was changed this round.

## The digest

Over this branch's full changed-file list, `ratification_subject` prints
`subject: 4174f49a0b16ed8a4d55fec7c4892149f5e2f802e5cab6c8c4a0d8299d0e997e`,
`revision: 2f393127f931fd93b341f1051c82c27eee83f30f`, over three gated files:
`.github/workflows/consistency.yml`, `src/scripts/_lib/ratification_artifact.ts`
and `src/scripts/check_kernel_edit_ratified.ts`. The workflow joins the gated
set this round because it changed. `origin/main` has moved one commit
(`af9501519`) since the merge base `d23dcec56`; it touches none of the files in
this bundle. The branch has not been merged with it yet.

## What is in this bundle, and what is not

Included below:

1. **Delta 1 — the gated files, PR against the merge base with `origin/main`**,
   no context lines: the three files above.
2. **Delta 2 — the workflow since round 7**, with six context lines, because
   the step reads as a whole.
3. **Delta 3 — the contract, `docs/contracts/ratification-artifact.md`, since
   round 7.**
4. **Delta 4 — `tests/scripts/check_kernel_edit_ratified_ci_path.test.ts`, in
   full.**
5. **Delta 5 — the council CLI change and its test.**

Not included: `main()` in full (unchanged since round 7, where it was shown in
full); `_lib/ratification_subject.ts`, the subject CLI and the rest of the
contract (unchanged since round 7); every other test file and the fixture
helper; the rest of the workflow; the roadmap; the test-removal account; the
ratification record; earlier round prompts. If a question below cannot be
answered from what you can see, say which part you could not see rather than
answering around it.

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
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 5c5d3c769..bd8dfe19f 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -903,3 +903,13 @@ jobs:
-      # ADR-268 § 4. Same `gh pr view` file list and the same reason for it —
-      # the shallow PR-merge checkout makes `git fetch origin <base>` race with
-      # the auth extraheader on some runners.
+      # ADR-268 § 4. The changed paths come from git, NOT from `gh pr view
+      # --json files`: that list names a rename by its destination only (no
+      # previous path), so a kernel rule moved to an ungated name never reached
+      # the gate (round 7, step 2.8). The job checks out with `fetch-depth: 0`,
+      # so the base commit is already present and no `git fetch` is needed —
+      # the auth-extraheader race the step above sidesteps does not arise.
+      # `--base-ref` hands the gate the base commit id; the gate resolves HEAD
+      # once and diffs `base...head` with `--no-renames`, so the list, the
+      # digest and the record are one reading of one commit.
+      #
+      # `diff.renames=false` through the environment covers a base copy that
+      # predates `--no-renames` in its own diff call — the copy that judges the
+      # PR introducing it.
@@ -924 +933,0 @@ jobs:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
@@ -925,0 +935,3 @@ jobs:
+          GIT_CONFIG_COUNT: '1'
+          GIT_CONFIG_KEY_0: diff.renames
+          GIT_CONFIG_VALUE_0: 'false'
@@ -927,6 +938,0 @@ jobs:
-          mapfile -t CHANGED < <(gh pr view "${{ github.event.pull_request.number }}" \
-            --json files --jq '.files[].path')
-          if [ "${#CHANGED[@]}" -eq 0 ]; then
-            echo "No changed files reported by gh pr view; nothing to gate."
-            exit 0
-          fi
@@ -938 +944 @@ jobs:
-            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --files "${CHANGED[@]}"
+            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"
@@ -947 +953 @@ jobs:
-            ./scripts-run src/scripts/check_kernel_edit_ratified --files "${CHANGED[@]}"
+            ./scripts-run src/scripts/check_kernel_edit_ratified --base-ref "$BASE_SHA"
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
index 26d5a22f3..65ffb8836 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -62 +62,3 @@
- *   --files F [F …]   override the changed-file list (testing and CI)
+ *   --files F [F …]   override the changed-file list (testing); CI derives
+ *                     the list from git with --base-ref, because a hosted
+ *                     PR file list names a rename by its destination only
@@ -63,0 +66,7 @@
+ *   --rev REV         the commit the gated content and the artifacts are read
+ *                     at (default HEAD) — Git objects, never the working tree,
+ *                     so an uncommitted edit can neither pass nor fail the gate.
+ *                     Without --files it is resolved ONCE to a commit id, and
+ *                     that id — not the name — feeds the diff, the digest and
+ *                     the record read, so a ref that moves mid-run cannot pair
+ *                     one commit's file list with another commit's content
@@ -68,0 +78,3 @@
+ * An option that takes a value and is given none is a refusal (exit 1), never
+ * a silent default.
+ *
@@ -72 +83,0 @@
-import { spawnSync } from 'node:child_process';
@@ -87,0 +99,11 @@ import {
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
@@ -363,11 +384,0 @@ export function configuredProviderCount(policyRoot: string): number | null {
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
@@ -379,5 +390 @@ function resolveBaseRef(explicit: string | null, root: string): string {
-        const res = spawnSync('git', ['rev-parse', '--verify', candidate], {
-            cwd: root,
-            stdio: ['ignore', 'ignore', 'ignore'],
-        });
-        if (res.status === 0) {
+        if (refExists(root, candidate)) {
@@ -389,0 +397,41 @@ function resolveBaseRef(explicit: string | null, root: string): string {
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
@@ -400,0 +449 @@ export function evaluate(
+    revision: string = DEFAULT_REVISION,
@@ -406,3 +455,2 @@ export function evaluate(
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
@@ -450,0 +499,38 @@ export function evaluate(
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
@@ -495 +581,3 @@ export function evaluate(
-        const abs = path.join(root, rel);
+        // The record is read at the same commit as the content it answers
+        // for: a record rewritten in the working tree and never committed is
+        // not what a push or a merge would land.
@@ -498,3 +586,11 @@ export function evaluate(
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
@@ -503 +599 @@ export function evaluate(
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
@@ -510 +606,2 @@ export function evaluate(
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
@@ -545,0 +643 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    let revision = DEFAULT_REVISION;
@@ -560,0 +659 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    const valueOptions = new Set(['--base-ref', '--root', '--rev', '--policy-root']);
@@ -563,10 +662,15 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
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
@@ -589,3 +693,21 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
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
@@ -594 +716 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-        changed = fromGit;
+        revision = commit;
@@ -597 +719 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
-    const result = evaluate(changed, root, configuredProviderCount(policyRoot));
+    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision);
```

## Delta 2 — the workflow since round 7

```diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 5c5d3c769..bd8dfe19f 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -897,15 +897,25 @@ jobs:
           if [ "${#CHANGED[@]}" -eq 0 ]; then
             echo "No changed files reported by gh pr view; nothing to gate."
             exit 0
           fi
           ./scripts-run src/scripts/check_kernel_rule_bundle --files "${CHANGED[@]}"
 
-      # ADR-268 § 4. Same `gh pr view` file list and the same reason for it —
-      # the shallow PR-merge checkout makes `git fetch origin <base>` race with
-      # the auth extraheader on some runners.
+      # ADR-268 § 4. The changed paths come from git, NOT from `gh pr view
+      # --json files`: that list names a rename by its destination only (no
+      # previous path), so a kernel rule moved to an ungated name never reached
+      # the gate (round 7, step 2.8). The job checks out with `fetch-depth: 0`,
+      # so the base commit is already present and no `git fetch` is needed —
+      # the auth-extraheader race the step above sidesteps does not arise.
+      # `--base-ref` hands the gate the base commit id; the gate resolves HEAD
+      # once and diffs `base...head` with `--no-renames`, so the list, the
+      # digest and the record are one reading of one commit.
+      #
+      # `diff.renames=false` through the environment covers a base copy that
+      # predates `--no-renames` in its own diff call — the copy that judges the
+      # PR introducing it.
       #
       # THE JUDGING CODE COMES FROM THE BASE, THE DATA FROM THE HEAD. The
       # round-1 ratification review refused an earlier version of this step for
       # running the gate out of the PR head: a candidate diff then supplied the
       # code that judged it, and self-inclusion in the gated set bought nothing
       # because the modified gate could simply exclude itself. So the step
@@ -918,36 +928,32 @@ jobs:
       # `node_modules` stays the head's (tsx lives there); only the SCRIPT and
       # its `_lib` imports resolve from the base worktree, because ESM resolves
       # relative imports against the importing file.
       - name: Kernel / governance-hook edits carry a ratification artifact
         if: github.event_name == 'pull_request'
         env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          GIT_CONFIG_COUNT: '1'
+          GIT_CONFIG_KEY_0: diff.renames
+          GIT_CONFIG_VALUE_0: 'false'
         run: |
-          mapfile -t CHANGED < <(gh pr view "${{ github.event.pull_request.number }}" \
-            --json files --jq '.files[].path')
-          if [ "${#CHANGED[@]}" -eq 0 ]; then
-            echo "No changed files reported by gh pr view; nothing to gate."
-            exit 0
-          fi
           GATE=src/scripts/check_kernel_edit_ratified.ts
           BASE_DIR="$RUNNER_TEMP/ratification-base"
           if git cat-file -e "$BASE_SHA:$GATE" 2>/dev/null; then
             git worktree add --detach "$BASE_DIR" "$BASE_SHA" >/dev/null
             echo "Judging with the BASE revision's gate ($BASE_SHA)."
-            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --files "${CHANGED[@]}"
+            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"
           else
             # The bootstrap PR — the one that INTRODUCES the gate. There is no
             # base copy to judge with, so the head's own gate runs and the
             # independence of that run rests entirely on the ratification
             # artifact and on human review of this PR. Stated loudly rather
             # than hidden: this branch is sound exactly once.
             echo "::warning::BOOTSTRAP — no gate at the base revision; running the head's copy."
             echo "The independence of this run rests on the ratification artifact and human review."
-            ./scripts-run src/scripts/check_kernel_edit_ratified --files "${CHANGED[@]}"
+            ./scripts-run src/scripts/check_kernel_edit_ratified --base-ref "$BASE_SHA"
           fi
 
       - name: Lint marketplace.json
         run: task lint-marketplace
 
       - name: Lint AGENTS.md (Thin-Root contract)
```

## Delta 3 — the contract since round 7

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 92e59ff41..4ea968294 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -102,6 +102,10 @@ environment (`GIT_DIR` and its siblings) removed, so the list and the content
 come from the same repository, and with rename detection off, so a gated file
 moved to an ungated path is listed under its old path as a deletion rather than
-only under its new one. The CI path takes its list from `gh pr view --json
-files` instead and is not changed by this. An option that takes a value — `--rev`,
+only under its new one. The CI path builds its list the same way: it passes
+`--base-ref <base commit id>` and no `--files`. It used to pass `gh pr view
+--json files`, which names a rename by its destination only, so a gated file
+renamed away never reached the gate there. The CI step also sets
+`diff.renames=false` through `GIT_CONFIG_*`, which covers a base copy of the
+gate that predates `--no-renames` in its own diff. An option that takes a value — `--rev`,
 `--root`, `--base-ref`, `--policy-root` — and is given none is a refusal
 (exit 1), as in the subject CLI, never a fall-back to the default.
```

## Delta 4 — `tests/scripts/check_kernel_edit_ratified_ci_path.test.ts`, in full

```ts
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { main as gateMain } from '../../src/scripts/check_kernel_edit_ratified.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 2.8 — the authoritative CI path lists a gated file renamed away.
 *
 * Round 7's finding: the workflow fed the gate `gh pr view --json files`
 * through `--files`. That list carries only the destination of a rename
 * (`path` plus `changeType: RENAMED`, no previous path), so `--no-renames` in
 * the gate's own git diff never applied on the path CI actually runs, and a
 * kernel rule moved to an ungated name passed unratified.
 *
 * The test reads the gate invocations out of the workflow step itself and runs
 * them against a fixture, so it fails on the workflow, not on a paraphrase of
 * it. A `"${CHANGED[@]}"` argument is expanded the way the GitHub file list
 * expands it: destinations only, which is what `git diff -M` reports.
 */

const WORKFLOW = path.join(process.cwd(), '.github/workflows/consistency.yml');
const STEP = 'Kernel / governance-hook edits carry a ratification artifact';
const KERNEL = 'src/rules/commit-policy.md';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-path-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

interface WorkflowStep {
    name?: string;
    run?: string;
}

function stepScript(): string {
    const doc = parseYaml(fs.readFileSync(WORKFLOW, 'utf8')) as {
        jobs: Record<string, { steps?: WorkflowStep[] }>;
    };
    const steps = Object.values(doc.jobs).flatMap((j) => j.steps ?? []);
    const found = steps.filter((s) => s.name === STEP);
    expect(found).toHaveLength(1);
    const run = found[0]?.run;
    expect(typeof run).toBe('string');
    return run as string;
}

/** Each line of the step that invokes the gate, as shell words. */
function gateInvocations(script: string): string[][] {
    const lines = script
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !l.startsWith('#') && /check_kernel_edit_ratified|\$GATE/u.test(l))
        .filter((l) => !l.startsWith('GATE=') && !l.startsWith('if '));
    return lines.map((l) => l.split(/\s+/u));
}

/** A shell word with the double quotes this workflow uses removed. */
function unquote(word: string): string {
    return word.replace(/^"(.*)"$/u, '$1');
}

/** The gate's own arguments: everything after the word naming the gate. */
function gateArgs(words: readonly string[], vars: Readonly<Record<string, string[]>>): string[] {
    const at = words.findIndex((w) => /check_kernel_edit_ratified|\$GATE/u.test(w));
    expect(at).toBeGreaterThanOrEqual(0);
    const out: string[] = [];
    for (const raw of words.slice(at + 1)) {
        const w = unquote(raw);
        const m = /^\$\{?([A-Z_]+)(\[@\])?\}?$/u.exec(w);
        if (m === null) {
            out.push(w);
            continue;
        }
        const value = vars[m[1] as string];
        if (value === undefined) {
            throw new Error(`the test does not know the workflow variable ${w}`);
        }
        out.push(...value);
    }
    return out;
}

function runGate(argv: readonly string[]): { code: number; out: string } {
    let out = '';
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
        out += String(c);
        return true;
    });
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
        out += String(c);
        return true;
    });
    try {
        return { code: gateMain(argv), out };
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
}

/** The PR file list as GitHub reports it: a rename appears under its destination only. */
function githubFileList(base: string): string[] {
    const res = spawnSync('git', ['-C', root, 'diff', '-M', '--name-only', `${base}...HEAD`], {
        encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    return res.stdout.split('\n').filter((l) => l !== '');
}

describe('the CI step lists a gated file renamed away (step 2.8)', () => {
    it('every gate invocation in the step catches a kernel rule renamed to an ungated path', () => {
        write('README.md', 'base\n');
        write(KERNEL, 'a kernel rule long enough to be detected as renamed\n'.repeat(4));
        const base = commitAll(root);
        fs.renameSync(path.join(root, KERNEL), path.join(root, 'src/moved.md'));
        commitAll(root);

        const invocations = gateInvocations(stepScript());
        // The base-revision run and the bootstrap run.
        expect(invocations).toHaveLength(2);
        for (const words of invocations) {
            const argv = gateArgs(words, {
                PWD: [root],
                BASE_SHA: [base],
                CHANGED: githubFileList(base),
            });
            const r = runGate([...argv, '--root', root, '--policy-root', process.cwd()]);
            expect(r.out).toContain(KERNEL);
            expect(r.code).toBe(1);
        }
    });
});
```

## Delta 5 — the council CLI spawn buffer and its test

```diff
diff --git a/src/scripts/ai_council/clients.ts b/src/scripts/ai_council/clients.ts
index 29f2dc010..d7aa1e161 100644
--- a/src/scripts/ai_council/clients.ts
+++ b/src/scripts/ai_council/clients.ts
@@ -1344,6 +1344,11 @@ export abstract class CliClient extends ExternalAIClient {
         const spawnOpts: Parameters<typeof spawnSync>[2] = {
             encoding: 'utf-8',
             timeout: Math.round(this.timeout_seconds * 1000),
+            // Node's default is 1 MiB, and a member CLI that prints its working
+            // log next to the answer exceeds it: the spawn then dies with
+            // ENOBUFS and the probe record skips the seat on every later run.
+            // Same ceiling as the API transport.
+            maxBuffer: 64 * 1024 * 1024,
             // Neutral cwd, and this one is load-bearing rather than tidy.
             //
             // The spawn used to inherit the caller's directory, so a council
```

```ts
// A council member CLI that prints more than Node's default `spawnSync`
// buffer (1 MiB) must still be read. Without an explicit `maxBuffer` the
// spawn fails with ENOBUFS, which the probe record stores as an outcome that
// skips the seat on every later run — measured on the openai seat, whose CLI
// prints its working log next to the answer.
import { describe, expect, it } from 'vitest';

import { AnthropicCliClient, type SubprocessResult } from '../../../src/scripts/ai_council/clients.js';

describe('CliClient._runSubprocess — output larger than the default spawn buffer', () => {
    it('returns 2 MiB of child output instead of failing with ENOBUFS', () => {
        const client = new AnthropicCliClient({ binary: '/bin/sh' });
        const run = (
            client as unknown as {
                _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
            }
        )._runSubprocess.bind(client);

        const bytes = 2 * 1024 * 1024;
        const result = run(['/bin/sh', '-c', `head -c ${bytes} /dev/zero | tr '\\000' a`], null);

        expect(result.returncode).toBe(0);
        expect(result.stdout.length).toBe(bytes);
    });
});
```
