<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — consistency.yml large-PR diff source (verbatim, as sent 2026-11-01)

~~~text
Ratification review of one change to a CI workflow that belongs to this repository's ratification mechanism (.github/workflows/consistency.yml).

Context: under this repository's governance (ADR-268 § 4), a change to a governance surface needs a record from a party other than its author, with one closed verdict:
- ratified: the change expands what an agent may do, and that expansion is approved
- confirmed-non-expanding: the change does not expand any authority, weaken any gate, or make an enforcing step non-enforcing
- refused: the change must not land
- non-convergent: cannot be decided from the material

The diff (complete) follows. Both steps run on pull_request events. The first feeds a PR diff into a checker that blocks new references to a retired directory; the second collects changed workflow files and runs actionlint on them. `gh pr diff` fails with HTTP 406 on a pull request with more than 300 changed files.

Questions:
1. Your verdict, from the four above, with the reasoning.
2. Does either step, after the change, enforce less than before on any pull request (for example, a case where it now passes when it previously failed for a real violation)? Name the case if so.
3. Any defect in the shell or jq that would make a step pass wrongly or fail wrongly.

diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 5b9c57c4b7..0d6170022d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -513,8 +513,14 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: |
-          gh pr diff "${{ github.event.pull_request.number }}" \
-            | ./scripts-run src/scripts/check_no_new_legacy_path --stdin
+          # `gh pr diff` refuses a PR over 300 files (HTTP 406); fall back to the
+          # paginated files API, re-headed so the checker's `+++ b/` parser reads it.
+          # A file whose patch GitHub omits as too large contributes no lines.
+          {
+            gh pr diff "${{ github.event.pull_request.number }}" \
+              || gh api --paginate "repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/files" \
+                   --jq '.[] | "+++ b/\(.filename)\n\(.patch // "")"'
+          } | ./scripts-run src/scripts/check_no_new_legacy_path --stdin
 
       - name: Design-token drift — generated CSS matches the canonical source
         # road-to-shared-design-tokens Phase 2: src/ui/tokens.css and the
@@ -853,8 +859,10 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: |
-          mapfile -t WF < <(gh pr diff "${{ github.event.pull_request.number }}" \
-            --name-only | grep -E '^\.github/workflows/.*\.ya?ml$' || true)
+          # Files API, not `gh pr diff`: the latter refuses a PR over 300 files,
+          # and inside this substitution that failure would lint nothing silently.
+          changed=$(gh api --paginate "repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/files" --jq '.[].filename')
+          mapfile -t WF < <(grep -E '^\.github/workflows/.*\.ya?ml$' <<<"$changed" || true)
           if [ "${#WF[@]}" -eq 0 ]; then
             echo "No workflow files changed in this PR — nothing to lint."
             exit 0
~~~
