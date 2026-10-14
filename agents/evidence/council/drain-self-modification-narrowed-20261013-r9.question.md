<!-- evidence-type: analysis -->

<!-- Round-9 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 9 — the narrowed content binding

Round 9 of the modification review of the narrowed content binding (PR #2325).
Round 8 was answered by both seats; both `refused`. The owner directed that
confirmed findings be fixed and the change come back for this round. The code
under review is commit `c2e96c418`.

## Round 8's findings

> openai: "REQUEST_CHANGES — the implementation is credible, but the test does
> not cover the base-revision compatibility mechanism that authoritatively
> judges this PR; before merge, add a stable regression that runs legacy diff
> behavior with workflow-derived `GIT_CONFIG_*` values and proves red without
> the override and green with it."

> anthropic: "The test would remain **green** if: Environment variables were
> misspelled; Git ignored them; Base gate didn't inherit them. That's the
> decisive production path, untested."

> anthropic: "**Single highest-leverage change before merge**: Add an automated
> test verifying the environment-variable mechanism."

Also raised in round 8, not stated as blocking: the workflow comment's
"round 7, step 2.8" reference should point to a contract or ADR (both seats);
the council CLI `maxBuffer` change should be split out (openai: "split Delta 5
if it is not required for this review"; anthropic: not a blocker); the
kernel-rule bundle step reads the same rename-blind `gh pr view` list
(openai: "pre-existing, non-blocking for this diff" but "a credible follow-up
risk").

## What changed since round 8

Commits after round 8's record: `b8f24c942` (bundle step and script, new
test), `c63c9e086` (workflow comment), `1fc8fc4a0` (revert of the council
`maxBuffer` commit), `ad7bb27ad` (test: the legacy diff runs from an
inheriting Node process), `6467b01ff` (contract), `c2e96c418` (roadmap).

- **New test** `tests/scripts/ci_changed_files_rename_compat.test.ts`
  (Delta 3, in full). Its first case parses `.github/workflows/consistency.yml`,
  takes the ratification step's `env`, keeps every `GIT_CONFIG_*` entry
  stringified, and runs the diff call of a base gate that predates
  `--no-renames` — `spawnSync('git', ['diff', '--name-only', '<base>...HEAD'])`
  with no `env` option, inside a child Node process — on a fixture that renames
  a kernel rule to an ungated path. The child's environment strips every
  `GIT_*` variable and sets `GIT_CONFIG_GLOBAL=/dev/null` and
  `GIT_CONFIG_NOSYSTEM=1`, so rename detection is git's default (on) unless the
  step's values turn it off. Without the values it asserts only the
  destination is listed; with them it asserts exit 0, empty stderr and both
  paths.
- **Kernel-rule bundle step**: no longer calls `gh pr view`. It passes
  `--base-ref "$BASE_SHA"`; `check_kernel_rule_bundle.ts` diffs
  `<base>...HEAD` with `--no-renames`, and a failed diff now exits 3 instead of
  passing on an empty list. That script's header said its git-diff invocation
  was pinned to the retired Python port; the header now names these two
  departures. The bundle script is not in the ratification gate's gated set.
  The test's second and third cases read the step's invocation from the
  workflow and run it as a subprocess against a fixture.
- **Workflow comments**: the ratification step cites
  `docs/contracts/ratification-artifact.md` § `subject:` instead of the round
  number. Two other comments that pointed at the bundle step's fetch
  workaround now quote the observed error instead.
- **Contract**: one sentence names the new test.
- **Council CLI**: commit `f4b5ee9f4` (`maxBuffer` on the member spawn, and its
  test) is reverted by a new commit; the net diff of
  `src/scripts/ai_council/clients.ts` against `origin/main` is empty and the
  test file is gone. That change is proposed separately as PR #2348. This
  round's council run used a local checkout of the review tool at the round-8
  commit, which still carries it.

## Tests, and each new case seen red

Each case was seen red with the fix or the input neutralised in place, then
restored from a scratch copy.

| Case | Neutralised | Result |
|---|---|---|
| legacy diff under step env | `GIT_CONFIG_KEY_0: diff.renmes` | red: only the destination listed |
| legacy diff under step env | `GIT_CONFIG_VALUE_0: 'flase'` | red: `fatal: bad boolean config value` |
| legacy diff under step env | `GIT_CONFIG_COUNT: '0'` | red: only the destination listed |
| legacy diff under step env | `GIT_CONFIG_KEY0:` (variable misnamed) | red: `missing config key` |
| bundle counts a renamed-away kernel rule | test against the `gh pr view --files` step | red: "1 rule touched" |
| bundle counts a renamed-away kernel rule | step on `--base-ref`, `--no-renames` removed from the script | red: "1 rule touched" |
| bundle refuses on an unreadable diff | exit-3 return replaced by `return 0` | red: exit 0 |

Restored: all three cases green.

By hand, once, not in the suite: `origin/main`'s own `check_kernel_edit_ratified.ts`
(at `b75aaeb39`), run from a detached worktree against a one-rename fixture with
`--root <fixture> --base-ref <base>`: without the variables `scanned: 1`,
"nothing to ratify", exit 0; with `GIT_CONFIG_COUNT=1`,
`GIT_CONFIG_KEY_0=diff.renames`, `GIT_CONFIG_VALUE_0=false` it printed
`scanned: 2`, the kernel rule as a gated surface, no artifact, exit 1. The
suite does not run the merge-base gate, because that would make it depend on
history; it runs the same diff call instead.

After the changes, the 11 ratification / kernel-edit suites plus the bundle
suite and the new one pass, run one at a time; `tsc --noEmit`, eslint on the
touched files, `lint_code_comments`, `check_test_weakening`,
`lint_evidence_artifacts`, `lint_workflow_security`, `lint_workflow_paths` and
the roadmap lints are clean; `task sync` and `task generate-tools` produce no
drift. `actionlint` was not run locally. No existing assertion was changed
this round; one test file (`cli_spawn_buffer.test.ts`) was removed by the
revert, together with the code it tested.

## The digest

Over this branch's full changed-file list, `ratification_subject` prints
`subject: 659b9eeed23124a739c0f500e88e73b919f0be78f09566a50e1ba4b9e17eab00`,
`revision: c2e96c418dabbdf927be7e42dd33edc62850d135`, over three gated files:
`.github/workflows/consistency.yml`, `src/scripts/_lib/ratification_artifact.ts`
and `src/scripts/check_kernel_edit_ratified.ts`. `origin/main` has moved two
commits since the merge base `d23dcec56`; neither touches a file in this
bundle. The branch has not been merged with it yet.

## What is in this bundle, and what is not

Included below:

1. **Delta 1 — the gated files, PR against the merge base with `origin/main`**,
   no context lines.
2. **Delta 2 — everything outside the evidence and roadmap files since round
   8**, six context lines: the workflow, `check_kernel_rule_bundle.ts`, the
   contract, and the revert of the council CLI change.
3. **Delta 3 — `tests/scripts/ci_changed_files_rename_compat.test.ts`, in
   full.**

Not included: `main()` and `evaluate()` of the ratification gate in full
(unchanged since round 7); `_lib/ratification_subject.ts` and the subject CLI
(unchanged since round 7); the rest of the contract and of the workflow; the
rest of `check_kernel_rule_bundle.ts` and its existing unit suite; the
step-2.8 CI-path test (unchanged since round 8); the fixture helper; the
roadmap; the test-removal account; the ratification record; earlier round
prompts. If a question below cannot be answered from what you can see, say
which part you could not see rather than answering around it.

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
index 5c5d3c769..3de7b45c4 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -515 +515 @@ jobs:
-        # auth extraheader (same failure the kernel-rule-bundle step sidesteps).
+        # auth extraheader (observed: "could not read Username for github.com").
@@ -617,2 +617,2 @@ jobs:
-        # configured auth extraheader on some runners (this workflow documents
-        # it at the kernel-rule-bundle step), and swallowing the failure with
+        # configured auth extraheader on some runners (observed: "could not
+        # read Username for github.com"), and swallowing the failure with
@@ -885,6 +885,6 @@ jobs:
-        # actions/checkout@v7 uses a shallow PR-merge fetch, so `git fetch
-        # origin <base>` can race with the configured auth extraheader on
-        # some runners (observed: "could not read Username for github.com").
-        # Sidestep the fetch entirely by pulling the PR's changed-file list
-        # from the GitHub API via `gh pr view` and feeding it to the script
-        # through its `--files` override.
+        # The changed paths come from git, not from `gh pr view --json files`:
+        # that list names a rename by its destination only, so a kernel rule
+        # renamed away was not counted. The script diffs `base...HEAD` with
+        # `--no-renames` and exits 3 when the diff cannot be read. The job
+        # checks out with `fetch-depth: 0`, so the base commit is present and
+        # no `git fetch` (and no auth-extraheader race) is involved.
@@ -893 +893 @@ jobs:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
@@ -895,11 +895,17 @@ jobs:
-          mapfile -t CHANGED < <(gh pr view "${{ github.event.pull_request.number }}" \
-            --json files --jq '.files[].path')
-          if [ "${#CHANGED[@]}" -eq 0 ]; then
-            echo "No changed files reported by gh pr view; nothing to gate."
-            exit 0
-          fi
-          ./scripts-run src/scripts/check_kernel_rule_bundle --files "${CHANGED[@]}"
-
-      # ADR-268 § 4. Same `gh pr view` file list and the same reason for it —
-      # the shallow PR-merge checkout makes `git fetch origin <base>` race with
-      # the auth extraheader on some runners.
+          ./scripts-run src/scripts/check_kernel_rule_bundle --base-ref "$BASE_SHA"
+
+      # ADR-268 § 4. The changed paths come from git, NOT from `gh pr view
+      # --json files`: that list names a rename by its destination only (no
+      # previous path), so a kernel rule moved to an ungated name never reached
+      # the gate (docs/contracts/ratification-artifact.md § `subject:`). The
+      # job checks out with `fetch-depth: 0`,
+      # so the base commit is already present and no `git fetch` is needed —
+      # the auth-extraheader race a `git fetch` hits on some runners does not
+      # arise.
+      # `--base-ref` hands the gate the base commit id; the gate resolves HEAD
+      # once and diffs `base...head` with `--no-renames`, so the list, the
+      # digest and the record are one reading of one commit.
+      #
+      # `diff.renames=false` through the environment covers a base copy that
+      # predates `--no-renames` in its own diff call — the copy that judges the
+      # PR introducing it.
@@ -924 +929,0 @@ jobs:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
@@ -925,0 +931,3 @@ jobs:
+          GIT_CONFIG_COUNT: '1'
+          GIT_CONFIG_KEY_0: diff.renames
+          GIT_CONFIG_VALUE_0: 'false'
@@ -927,6 +934,0 @@ jobs:
-          mapfile -t CHANGED < <(gh pr view "${{ github.event.pull_request.number }}" \
-            --json files --jq '.files[].path')
-          if [ "${#CHANGED[@]}" -eq 0 ]; then
-            echo "No changed files reported by gh pr view; nothing to gate."
-            exit 0
-          fi
@@ -938 +940 @@ jobs:
-            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --files "${CHANGED[@]}"
+            npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"
@@ -947 +949 @@ jobs:
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

## Delta 2 — since round 8: workflow, bundle script, contract, council CLI revert

```diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index bd8dfe19f..3de7b45c4 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -509,13 +509,13 @@ jobs:
       - name: No leftover conflict markers / unmerged paths
         run: ./scripts-run src/scripts/check_no_conflict_markers
 
       - name: Guard — no new legacy path under src/ (ADR-051)
         # PR-scoped: pull the diff via the GitHub API (gh) instead of
         # `git fetch <base>` — the shallow PR-merge checkout races with the
-        # auth extraheader (same failure the kernel-rule-bundle step sidesteps).
+        # auth extraheader (observed: "could not read Username for github.com").
         # NOTE: no --patch — that emits a per-commit format-patch series, so a
         # line added by one commit and fixed by a later commit in the same PR
         # would fail forever. The guard's contract is the NET diff of the PR.
         if: github.event_name == 'pull_request'
         env:
           GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
@@ -611,14 +611,14 @@ jobs:
       - name: Gate R2 — completion review (Stage-A advisory window, plan-review-gates §2)
         # --advisory until the Stage-B threshold is committed to CLAIMS.md:
         # violations report as warnings, exit 0. CI is the authoritative
         # layer once enforced; exit 2 stays degraded-advisory either way.
         #
         # NO `git fetch origin main` HERE — that fetch races with the
-        # configured auth extraheader on some runners (this workflow documents
-        # it at the kernel-rule-bundle step), and swallowing the failure with
+        # configured auth extraheader on some runners (observed: "could not
+        # read Username for github.com"), and swallowing the failure with
         # `|| true` leaves `--base` unresolvable → exit 2 → "degraded
         # advisory, allowing", i.e. the layer the contract calls authoritative
         # silently never runs. The base sha is a parent of the merge commit and
         # is present because this job checks out with `fetch-depth: 0` (see the
         # checkout step — at the default depth 1 the parents are NOT fetched,
         # which is precisely how this step self-disabled before).
@@ -879,36 +879,32 @@ jobs:
         # verdicts. It merges with the narrowing, never before it.
         run: task lint-rule-budget
 
       - name: Check kernel-rule bundle (one rule per PR; label override)
         # Phase 4.2 of road-to-always-budget-relief — slow-rollout guarantee.
         # Override: PR label `bundled-always-rules-acknowledged`.
-        # actions/checkout@v7 uses a shallow PR-merge fetch, so `git fetch
-        # origin <base>` can race with the configured auth extraheader on
-        # some runners (observed: "could not read Username for github.com").
-        # Sidestep the fetch entirely by pulling the PR's changed-file list
-        # from the GitHub API via `gh pr view` and feeding it to the script
-        # through its `--files` override.
+        # The changed paths come from git, not from `gh pr view --json files`:
+        # that list names a rename by its destination only, so a kernel rule
+        # renamed away was not counted. The script diffs `base...HEAD` with
+        # `--no-renames` and exits 3 when the diff cannot be read. The job
+        # checks out with `fetch-depth: 0`, so the base commit is present and
+        # no `git fetch` (and no auth-extraheader race) is involved.
         if: github.event_name == 'pull_request'
         env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
         run: |
-          mapfile -t CHANGED < <(gh pr view "${{ github.event.pull_request.number }}" \
-            --json files --jq '.files[].path')
-          if [ "${#CHANGED[@]}" -eq 0 ]; then
-            echo "No changed files reported by gh pr view; nothing to gate."
-            exit 0
-          fi
-          ./scripts-run src/scripts/check_kernel_rule_bundle --files "${CHANGED[@]}"
+          ./scripts-run src/scripts/check_kernel_rule_bundle --base-ref "$BASE_SHA"
 
       # ADR-268 § 4. The changed paths come from git, NOT from `gh pr view
       # --json files`: that list names a rename by its destination only (no
       # previous path), so a kernel rule moved to an ungated name never reached
-      # the gate (round 7, step 2.8). The job checks out with `fetch-depth: 0`,
+      # the gate (docs/contracts/ratification-artifact.md § `subject:`). The
+      # job checks out with `fetch-depth: 0`,
       # so the base commit is already present and no `git fetch` is needed —
-      # the auth-extraheader race the step above sidesteps does not arise.
+      # the auth-extraheader race a `git fetch` hits on some runners does not
+      # arise.
       # `--base-ref` hands the gate the base commit id; the gate resolves HEAD
       # once and diffs `base...head` with `--no-renames`, so the list, the
       # digest and the record are one reading of one commit.
       #
       # `diff.renames=false` through the environment covers a base copy that
       # predates `--no-renames` in its own diff call — the copy that judges the
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 4ea968294..f0b361e26 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -103,13 +103,15 @@ come from the same repository, and with rename detection off, so a gated file
 moved to an ungated path is listed under its old path as a deletion rather than
 only under its new one. The CI path builds its list the same way: it passes
 `--base-ref <base commit id>` and no `--files`. It used to pass `gh pr view
 --json files`, which names a rename by its destination only, so a gated file
 renamed away never reached the gate there. The CI step also sets
 `diff.renames=false` through `GIT_CONFIG_*`, which covers a base copy of the
-gate that predates `--no-renames` in its own diff. An option that takes a value — `--rev`,
+gate that predates `--no-renames` in its own diff;
+`tests/scripts/ci_changed_files_rename_compat.test.ts` reads those variables
+from the step and runs that older diff call under them. An option that takes a value — `--rev`,
 `--root`, `--base-ref`, `--policy-root` — and is given none is a refusal
 (exit 1), as in the subject CLI, never a fall-back to the default.
 
 **The one exception: an empty gated set reads no commit.** When no changed path
 is gated, the digest is the digest of nothing and no record is owed, so neither
 `ratification_subject` nor the gate under `--files` resolves the revision, and
diff --git a/src/scripts/ai_council/clients.ts b/src/scripts/ai_council/clients.ts
index d7aa1e161..29f2dc010 100644
--- a/src/scripts/ai_council/clients.ts
+++ b/src/scripts/ai_council/clients.ts
@@ -1341,17 +1341,12 @@ export abstract class CliClient extends ExternalAIClient {
      */
     protected _runSubprocess(cmd: string[], stdinPayload: string | null): SubprocessResult {
         const argv0 = cmd[0] ?? '';
         const spawnOpts: Parameters<typeof spawnSync>[2] = {
             encoding: 'utf-8',
             timeout: Math.round(this.timeout_seconds * 1000),
-            // Node's default is 1 MiB, and a member CLI that prints its working
-            // log next to the answer exceeds it: the spawn then dies with
-            // ENOBUFS and the probe record skips the seat on every later run.
-            // Same ceiling as the API transport.
-            maxBuffer: 64 * 1024 * 1024,
             // Neutral cwd, and this one is load-bearing rather than tidy.
             //
             // The spawn used to inherit the caller's directory, so a council
             // invoked from inside a repository launched the vendor CLI THERE —
             // and a vendor CLI in a project runs that project's hook chain.
             // Measured 2026-08-12, three of three runs from a worktree with
diff --git a/src/scripts/check_kernel_rule_bundle.ts b/src/scripts/check_kernel_rule_bundle.ts
index 90c931b37..4f903ca48 100644
--- a/src/scripts/check_kernel_rule_bundle.ts
+++ b/src/scripts/check_kernel_rule_bundle.ts
@@ -3,15 +3,17 @@
  * check_kernel_rule_bundle — Phase 4.2 of road-to-always-budget-relief.
  *
  * Ported from the retired Python `src/scripts/check_kernel_rule_bundle.py` (ADR-200,
  * Phase 4 / Wave 4c). The CLI contract is pinned — `--base-ref`
  * / `--label` / `--event-path` / `--files` flags, exit codes (0 pass,
  * 1 fail, 3 internal error), stdout/stderr split, byte-identical finding
- * messages, the same git-diff invocation, base-ref candidate order, and
- * PR-label parsing from the GitHub event JSON. No behaviour changes —
- * historical quirks preserved (consumers pin the exact behaviour).
+ * messages, base-ref candidate order, and PR-label parsing from the GitHub
+ * event JSON. Two deliberate departures, both because CI reads the changed
+ * files from git through this script: the diff runs with `--no-renames`, so a
+ * kernel rule renamed away is listed under its old path too, and a failed
+ * diff exits 3 instead of passing on an empty list.
  *
  * Fails when a single PR (or commit range) modifies more than one
  * kernel rule under `src/rules/`. Override via the
  * PR label `bundled-always-rules-acknowledged`.
  *
  * Kernel set is the locked 9-rule list in
@@ -56,23 +58,21 @@ const KERNEL_RULES: ReadonlySet<string> = KERNEL_RULE_FILENAMES;
  */
 const KERNEL_DIR = 'src/rules';
 const DEFAULT_LABEL = 'bundled-always-rules-acknowledged';
 // src/scripts/check_kernel_rule_bundle.ts → two levels up is the repo root.
 const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
 
-function _git_changed_files(base_ref: string): string[] {
+function _git_changed_files(base_ref: string): string[] | null {
     // Bounded read: a truncated diff would shrink the change set and let the
-    // bundle guard pass on files it never saw.
-    const res = runCountedProbe('git', ['diff', '--name-only', `${base_ref}...HEAD`]);
-    // Python uses check_output(stderr=STDOUT, text=True): on non-zero it raises
-    // CalledProcessError and the handler prints the combined output. spawnSync
-    // does not raise; mirror by checking status and combining stdout+stderr.
+    // bundle guard pass on files it never saw. Rename detection off: a rename
+    // reported under its destination alone hides the kernel rule it moved.
+    const res = runCountedProbe('git', ['diff', '--no-renames', '--name-only', `${base_ref}...HEAD`]);
     if (!res.ok) {
         const combined = `${res.stdout ?? ''}${res.stderr ?? ''}`;
         process.stderr.write(`❌  git diff failed: ${combined.trim()}\n`);
-        return [];
+        return null;
     }
     return (res.stdout ?? '').split('\n').filter((line) => line.trim() !== '');
 }
 
 function _resolve_base_ref(explicit: string | null): string {
     if (explicit) {
@@ -214,12 +214,16 @@ export function main(argv?: readonly string[]): number {
     // Python: args.files or _git_changed_files(...). An empty list from
     // `--files` (no values) is falsy in Python → falls through to git diff.
     const files =
         args.files && args.files.length > 0
             ? args.files
             : _git_changed_files(_resolve_base_ref(args.base_ref));
+    if (files === null) {
+        // An unreadable change set is not an empty one.
+        return 3;
+    }
     const hits = _kernel_changes(files);
 
     if (hits.length <= 1) {
         if (hits.length) {
             process.stdout.write(`✅  OK  kernel-rule bundle: 1 rule touched (${hits[0]})\n`);
         } else {
diff --git a/tests/scripts/ai_council/cli_spawn_buffer.test.ts b/tests/scripts/ai_council/cli_spawn_buffer.test.ts
deleted file mode 100644
index 202a1a852..000000000
--- a/tests/scripts/ai_council/cli_spawn_buffer.test.ts
+++ /dev/null
@@ -1,25 +0,0 @@
-// A council member CLI that prints more than Node's default `spawnSync`
-// buffer (1 MiB) must still be read. Without an explicit `maxBuffer` the
-// spawn fails with ENOBUFS, which the probe record stores as an outcome that
-// skips the seat on every later run — measured on the openai seat, whose CLI
-// prints its working log next to the answer.
-import { describe, expect, it } from 'vitest';
-
-import { AnthropicCliClient, type SubprocessResult } from '../../../src/scripts/ai_council/clients.js';
-
-describe('CliClient._runSubprocess — output larger than the default spawn buffer', () => {
-    it('returns 2 MiB of child output instead of failing with ENOBUFS', () => {
-        const client = new AnthropicCliClient({ binary: '/bin/sh' });
-        const run = (
-            client as unknown as {
-                _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
-            }
-        )._runSubprocess.bind(client);
-
-        const bytes = 2 * 1024 * 1024;
-        const result = run(['/bin/sh', '-c', `head -c ${bytes} /dev/zero | tr '\\000' a`], null);
-
-        expect(result.returncode).toBe(0);
-        expect(result.stdout.length).toBe(bytes);
-    });
-});
```

## Delta 3 — `tests/scripts/ci_changed_files_rename_compat.test.ts`, in full

```ts
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 2.9 — the two CI steps that list changed files see both sides of a
 * rename, tested against the workflow text rather than a paraphrase of it.
 *
 * The ratification step judges with the BASE revision's gate. A base copy that
 * predates `--no-renames` runs a plain `git diff --name-only base...head`, and
 * only the step's `GIT_CONFIG_*` environment turns rename detection off for
 * it. So the first test takes those variables from the step itself and runs
 * that legacy diff call under them, from a Node process that inherits them. A misspelled key is ignored by
 * git, which leaves the old path missing; a misspelled value is a fatal git
 * error. Both fail here.
 *
 * The kernel-rule bundle step runs the head's own script, so its invocation is
 * read from the step and executed against a fixture repository.
 */

const REPO = process.cwd();
const WORKFLOW = path.join(REPO, '.github/workflows/consistency.yml');
const RATIFICATION_STEP = 'Kernel / governance-hook edits carry a ratification artifact';
const BUNDLE_STEP = 'Check kernel-rule bundle (one rule per PR; label override)';
const KERNEL_A = 'src/rules/commit-policy.md';
const KERNEL_B = 'src/rules/scope-control.md';
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface WorkflowStep {
    name?: string;
    run?: string;
    env?: Record<string, unknown>;
}

function step(name: string): WorkflowStep {
    const doc = parseYaml(fs.readFileSync(WORKFLOW, 'utf8')) as {
        jobs: Record<string, { steps?: WorkflowStep[] }>;
    };
    const found = Object.values(doc.jobs)
        .flatMap((j) => j.steps ?? [])
        .filter((s) => s.name === name);
    expect(found).toHaveLength(1);
    return found[0] as WorkflowStep;
}

/** The step's `GIT_CONFIG_*` variables, stringified the way Actions exports them. */
function gitConfigEnv(s: WorkflowStep): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.env ?? {})) {
        if (k.startsWith('GIT_CONFIG_')) out[k] = String(v);
    }
    return out;
}

/**
 * An environment that cannot see the developer's git configuration or a
 * locating variable inherited from a hook, so rename detection is git's own
 * default (on) unless the step's variables switch it off.
 */
function isolatedEnv(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(env)) {
        if (k.startsWith('GIT_')) delete env[k];
    }
    env['GIT_CONFIG_GLOBAL'] = '/dev/null';
    env['GIT_CONFIG_NOSYSTEM'] = '1';
    return { ...env, ...extra };
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-rename-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function move(from: string, to: string): void {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
}

const BODY = 'a kernel rule long enough to be detected as renamed\n'.repeat(4);

/**
 * The diff call of a base gate that predates `--no-renames`, made the way that
 * gate makes it: a Node process spawning git with no `env` option, so git sees
 * only what the step's environment handed down to the Node process.
 */
const LEGACY_GATE_DIFF = [
    "const r = require('node:child_process').spawnSync('git',",
    "  ['diff', '--name-only', `${process.argv[1]}...HEAD`], { cwd: process.cwd(), encoding: 'utf8' });",
    'process.stdout.write(r.stdout ?? "");',
    'process.stderr.write(r.stderr ?? "");',
    'process.exit(r.status ?? 9);',
].join('\n');

function legacyDiff(base: string, env: NodeJS.ProcessEnv): { status: number | null; files: string[]; err: string } {
    const res = spawnSync(process.execPath, ['-e', LEGACY_GATE_DIFF, base], { cwd: root, encoding: 'utf8', env });
    return {
        status: res.status,
        files: res.stdout.split('\n').filter((l) => l !== ''),
        err: res.stderr,
    };
}

describe('the ratification step turns rename detection off for a legacy base gate', () => {
    it('the step env makes a plain git diff list both sides of a kernel rule renamed away', () => {
        write(KERNEL_A, BODY);
        const base = commitAll(root);
        move(KERNEL_A, 'docs/moved.md');
        commitAll(root);

        const without = legacyDiff(base, isolatedEnv());
        expect(without.status).toBe(0);
        // Rename detection is on in the legacy call: the old side is absent.
        expect(without.files).toEqual(['docs/moved.md']);

        const vars = gitConfigEnv(step(RATIFICATION_STEP));
        expect(Object.keys(vars).length).toBeGreaterThan(0);
        const withEnv = legacyDiff(base, isolatedEnv(vars));
        expect(withEnv.err).toBe('');
        expect(withEnv.status).toBe(0);
        expect([...withEnv.files].sort()).toEqual(['docs/moved.md', KERNEL_A]);
    });
});

/** Every line of the step that runs the bundle script, as shell words. */
function bundleInvocation(script: string): string[] {
    const lines = script
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !l.startsWith('#') && l.includes('check_kernel_rule_bundle'));
    expect(lines).toHaveLength(1);
    return (lines[0] as string).split(/\s+/u);
}

/** The PR file list as GitHub reports it: a rename appears under its destination only. */
function githubFileList(base: string): string[] {
    return legacyDiff(base, isolatedEnv()).files;
}

function runBundleStep(base: string): { code: number | null; out: string } {
    const s = step(BUNDLE_STEP);
    const words = bundleInvocation(s.run ?? '');
    const at = words.findIndex((w) => w.includes('check_kernel_rule_bundle'));
    const vars: Record<string, string[]> = { BASE_SHA: [base], CHANGED: githubFileList(base) };
    const args: string[] = [];
    for (const raw of words.slice(at + 1)) {
        const w = raw.replace(/^"(.*)"$/u, '$1');
        const m = /^\$\{?([A-Z_]+)(\[@\])?\}?$/u.exec(w);
        if (m === null) {
            args.push(w);
            continue;
        }
        const value = vars[m[1] as string];
        if (value === undefined) throw new Error(`the test does not know the workflow variable ${w}`);
        args.push(...value);
    }
    const script = path.join(REPO, 'src/scripts/check_kernel_rule_bundle.ts');
    const res = spawnSync(TSX, [script, ...args, '--event-path', path.join(root, 'no-event.json')], {
        cwd: root,
        encoding: 'utf8',
        env: isolatedEnv(gitConfigEnv(s)),
    });
    return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('the kernel-rule bundle step sees a kernel rule renamed away', () => {
    it('counts the old side of a rename as a touched kernel rule', () => {
        write(KERNEL_A, BODY);
        write(KERNEL_B, `${BODY}second\n`);
        const base = commitAll(root);
        fs.appendFileSync(path.join(root, KERNEL_A), 'edited\n');
        move(KERNEL_B, 'docs/moved.md');
        commitAll(root);

        const r = runBundleStep(base);
        expect(r.out).toContain(KERNEL_A);
        expect(r.out).toContain(KERNEL_B);
        expect(r.code).toBe(1);
    });

    it('refuses rather than passes when the changed-file list cannot be read', () => {
        write(KERNEL_A, BODY);
        commitAll(root);
        const r = runBundleStep('0000000000000000000000000000000000000000');
        expect(r.code).toBe(3);
    });
});
```
