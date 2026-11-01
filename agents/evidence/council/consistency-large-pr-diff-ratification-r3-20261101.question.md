<!-- evidence-type: original-review -->

# Ratification prompt, round 3 — consistency.yml large-PR diff source (verbatim, as sent 2026-11-01)

~~~text
Ratification review of one change to a CI workflow that belongs to this repository's ratification mechanism (.github/workflows/consistency.yml).

Context: under this repository's governance (ADR-268 § 4), a change to a governance surface needs a record from a party other than its author, with one closed verdict:
- ratified: the change expands what an agent may do, and that expansion is approved
- confirmed-non-expanding: the change does not expand any authority, weaken any gate, or make an enforcing step non-enforcing
- refused: the change must not land
- non-convergent: cannot be decided from the material

The diff (complete) follows. Both steps run on pull_request events. The job checks out with `actions/checkout` and `fetch-depth: 0`; other steps in the same job already diff `base.sha...HEAD` from that checkout. The first step feeds the PR diff into a checker that blocks new references to a retired directory; the second collects changed workflow files and runs actionlint on them. Before the change both used `gh pr diff`, which fails with HTTP 406 on a pull request with more than 300 changed files. The default `run` shell here is `bash -e {0}` (no pipefail unless set).

A scratch-repository run was made for the case where base and PR head add an identical line independently: `git diff base...merge` does not show the line as added; `git diff base...<PR head>` does.

Questions:
1. Your verdict, from the four above, with the reasoning.
2. Does either step, after the change, enforce less than before on any pull request (for example, a case where it now passes when it previously failed for a real violation)? Name the case if so.
3. Any defect in the shell or git invocation that would make a step pass wrongly or fail wrongly.

diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 5b9c57c4b7..d67de97d94 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -503,17 +503,23 @@ jobs:
         run: ./scripts-run src/scripts/check_no_conflict_markers
 
       - name: Guard — no new legacy path under src/ (ADR-051)
-        # PR-scoped: pull the diff via the GitHub API (gh) instead of
-        # `git fetch <base>` — the shallow PR-merge checkout races with the
-        # auth extraheader (observed: "could not read Username for github.com").
-        # NOTE: no --patch — that emits a per-commit format-patch series, so a
-        # line added by one commit and fixed by a later commit in the same PR
-        # would fail forever. The guard's contract is the NET diff of the PR.
+        # PR-scoped, and the NET diff of the PR (base...PR head), never a per-commit
+        # series: a line added by one commit and fixed by a later one must not
+        # fail forever. Read from git, not from the GitHub API: `gh pr diff`
+        # refuses a PR over 300 files (HTTP 406), and the files API omits the
+        # patch of a large file and stops at 3000 files, so either turns
+        # "could not read" into "nothing found". The job checks out with
+        # `fetch-depth: 0`, so base and PR head (the two parents of the merge
+        # commit) are present without a `git fetch`. The PR head, not HEAD: HEAD
+        # is the synthetic merge commit, and a line the base added independently
+        # would vanish from a base...merge diff.
         if: github.event_name == 'pull_request'
         env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
         run: |
-          gh pr diff "${{ github.event.pull_request.number }}" \
+          set -o pipefail
+          git diff --no-renames "$BASE_SHA...$HEAD_SHA" \
             | ./scripts-run src/scripts/check_no_new_legacy_path --stdin
 
       - name: Design-token drift — generated CSS matches the canonical source
@@ -851,10 +857,15 @@ jobs:
         # #1059 class, which is the reason this step exists.
         if: github.event_name == 'pull_request'
         env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
         run: |
-          mapfile -t WF < <(gh pr diff "${{ github.event.pull_request.number }}" \
-            --name-only | grep -E '^\.github/workflows/.*\.ya?ml$' || true)
+          # From git, not `gh pr diff`: that refuses a PR over 300 files, and
+          # inside a process substitution the failure linted nothing silently.
+          # A failing `git diff` here stops the step (errexit). Deleted files
+          # are left out: there is nothing left to lint.
+          changed=$(git diff --no-renames --name-only --diff-filter=d "$BASE_SHA...$HEAD_SHA")
+          mapfile -t WF < <(grep -E '^\.github/workflows/.*\.ya?ml$' <<<"$changed" || true)
           if [ "${#WF[@]}" -eq 0 ]; then
             echo "No workflow files changed in this PR — nothing to lint."
             exit 0
~~~
