# Ratification review, round 2 — release without review gate

<!-- evidence-type: analysis -->

Round 2 of a ratification review (ADR-268 § 4). Round 1 split: one seat ratified, one refused on documentation drift and listed six sites. The commit below is the response to that round. Review it together with the context of round 1 and give your verdict as exactly one of: ratified, confirmed-non-expanding, refused, non-convergent — with reasons and any remaining defects (file, line, failure scenario).

Context, stated as facts:
- The repository owner decided on 2026-10-22, in session, that a release must not wait for a self-review: every commit on main is already reviewed and merged before a release is cut. The 17.0.0 release stopped for a day at release.ts step 7 on a findings ledger whose self-review never finished; 17.0.0 was then published without a ledger.
- The diff removes the release-time review gates: release.ts step 7 (ledger verification), the release-validation `finding-dispositions` job, the consistency.yml step that refused a shipped version without a ledger, and the two self-review-gate.yml jobs that built a ledger and pushed it onto the release branch with a PAT. check_finding_dispositions treats an absent ledger as empty. The self-review job itself remains, advisory.
- consistency.yml is the gated file because it also runs the ratification gate; this diff does not touch the ratification step.

Round-1 refusal sites: (1) allowEmpty evidence text in check_finding_dispositions.ts; (2) the --ingest message naming release validation; (3) docs/succession.md:65; (4) check_release_pr_shape.ts:44-46 comment; (5) the new test comment vs. the config notes; (6) assuranceOverrideLimitation's 'the one way' doc. resolve_release_status is NOT dead: it still serves the empty-unreviewed-ledger branch.

## The round-2 commit
```diff
diff --git a/docs/succession.md b/docs/succession.md
index 3970e0e09a..907befb778 100644
--- a/docs/succession.md
+++ b/docs/succession.md
@@ -63,5 +63,5 @@ bump + tag + GitHub Release); they gate the **downstream** publish/deploy legs.
 | Secret | Gates | Missing → |
 |---|---|---|
-| `RELEASE_PR_TOKEN` (PAT / App token, `contents:write` + `pull-requests:write`) | Unattended release PR checks in [`release.yml`](../.github/workflows/release.yml), **and** the findings-ledger commit in [`self-review-gate.yml`](../.github/workflows/self-review-gate.yml) | Two things. (a) Possibly one manual **"Approve workflows to run"** click per release — **but do not rely on it as a gate.** Measured on 14.0.0 (2026-08-18) with the secret absent: checks started immediately, no approval was asked, and the run would have merged, tagged and published unattended. Whether the safeguard applies is a repo/org Actions setting. (b) Since 2026-09-11 the `ingest-release-ledger` job refuses to push without it — a `GITHUB_TOKEN` push starts no run, and the checkless head it would create deadlocks the release's own check wait. The ledger then has to be written and pushed by hand, once per release, or the release stops at step 7. The secret was absent when this table was first written and is no longer only a convenience. |
+| `RELEASE_PR_TOKEN` (PAT / App token, `contents:write` + `pull-requests:write`) | Unattended release PR checks in [`release.yml`](../.github/workflows/release.yml) | Possibly one manual **"Approve workflows to run"** click per release — **but do not rely on it as a gate.** Measured on 14.0.0 (2026-08-18) with the secret absent: checks started immediately, no approval was asked, and the run would have merged, tagged and published unattended. Whether the safeguard applies is a repo/org Actions setting. The findings-ledger commit that also used it was removed on 2026-10-22, with every release review gate. |
 | — (none: **npm OIDC Trusted Publishing**) | `publish-npm.yml` — uses `id-token: write`, no stored npm token | If OIDC trust is misconfigured on npmjs, npm publish fails; fix the trusted-publisher config on the npm package, not a secret. |
 | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_WORKER_SUBDOMAIN`, `MCP_SMOKE_TOKEN` | `deploy-mcp-worker.yml` (MCP worker deploy + smoke) | MCP worker deploy skips/fails; core release unaffected. |
diff --git a/src/config/ci-local-parity.yml b/src/config/ci-local-parity.yml
index 1101e301fe..df780c4059 100644
--- a/src/config/ci-local-parity.yml
+++ b/src/config/ci-local-parity.yml
@@ -190,5 +190,5 @@ ci_only:
   - id: check_finding_dispositions
     class: release
-    reason: "adjudicates a self-review findings ledger by hand; no workflow runs it since 2026-10-22, when the owner removed every review gate from the release (main is already reviewed)"
+    reason: "adjudicates a self-review findings ledger by hand; no workflow runs it as a gate since 2026-10-22, when the owner removed every review gate from the release (main is already reviewed); the coverage guard still invokes it for its scan count"
   - id: report_skill_activation
     class: release
diff --git a/src/config/gate-coverage.yml b/src/config/gate-coverage.yml
index 077c1c238d..1e84536fff 100644
--- a/src/config/gate-coverage.yml
+++ b/src/config/gate-coverage.yml
@@ -928,7 +928,8 @@ gates:
       legitimately record zero, because their self-review never completed. What
       this row buys is a scan count for a tool, not a release gate: since
-      2026-10-22 no workflow calls it and no release waits for a ledger,
-      because everything on main is already reviewed and merged (owner). The
-      row keeps the bare invocation honest for whoever runs it by hand.
+      2026-10-22 no workflow runs it as a gate and no release waits for a
+      ledger, because everything on main is already reviewed and merged
+      (owner). This guard still invokes it bare, which keeps that invocation
+      green and honest for whoever runs it by hand.
 
   - id: check_review_schema
diff --git a/src/scripts/_lib/release_findings_ingest.ts b/src/scripts/_lib/release_findings_ingest.ts
index e4d2473bb6..9b5c19257f 100644
--- a/src/scripts/_lib/release_findings_ingest.ts
+++ b/src/scripts/_lib/release_findings_ingest.ts
@@ -21,9 +21,9 @@ export function ledgerRelPath(version: string): string {
  * The `Known limitations` line a cut taken on an override owes its readers.
  *
- * An override is the one way a release ships without having reviewed itself,
- * and it is recorded where only a releaser looks — inside the ledger JSON. A
- * consumer reading the published notes would see a release indistinguishable
- * from one that passed its self-review, which is the same silence-reads-as-
- * acceptance defect `assurance` was added to end one layer down.
+ * An override is a ledger's explicit statement that its release was not
+ * self-reviewed, recorded where only a releaser looks — inside the ledger JSON.
+ * Since 2026-10-22 a release needs no ledger at all, so this line appears only
+ * for a ledger that carries an override; a release with no ledger publishes no
+ * limitation, because main is reviewed before the cut.
  *
  * Returns null for every ordinary release: no ledger, a reviewed one, or one
diff --git a/src/scripts/check_finding_dispositions.ts b/src/scripts/check_finding_dispositions.ts
index 7fc6bba572..325178c874 100644
--- a/src/scripts/check_finding_dispositions.ts
+++ b/src/scripts/check_finding_dispositions.ts
@@ -839,5 +839,5 @@ function main(argv: readonly string[]): number {
         process.stdout.write(
             `📥  ingested ${added} new finding(s) into ${path.relative(REPO_ROOT, ledgerPath)} — ` +
-                'fill dispositions before the release validation goes green\n',
+                'fill dispositions by hand; no release waits for them\n',
         );
         if (carried.length > 0) {
@@ -922,13 +922,10 @@ function main(argv: readonly string[]): number {
             roots: [path.relative(REPO_ROOT, ledgerPath)],
             allowEmpty:
-                'EMPTY_VALID: zero recorded findings IS the pass state for a release whose '
-                + 'self-review reported none — the ledger file is created on first --ingest, so a '
-                + 'clean release legitimately has no <version>.json. NARROWED TWICE: it no longer '
-                + 'covers a RELEASED version with no ledger, which returns 1 above on the '
-                + 'released/unreleased split, and it no longer covers an empty ledger that does '
-                + 'not say why it is empty, which returns 1 above via empty_ledger_problem. What '
-                + 'remains is an EXPLAINED empty ledger and an unreleased version. Un-ingested '
-                + 'findings on an in-flight release are caught by --pr (unrecorded_findings), '
-                + 'never by this count.',
+                'EMPTY_VALID: zero recorded findings is a pass. A version with no ledger reads '
+                + 'as empty, shipped or not, because a release waits for no review ledger '
+                + '(owner, 2026-10-22). It does not cover an existing empty ledger that does not '
+                + 'say why it is empty, which returns 1 above via empty_ledger_problem. '
+                + 'Un-ingested findings are caught by --pr (unrecorded_findings), never by this '
+                + 'count.',
         });
     } catch (exc) {
diff --git a/src/scripts/check_release_pr_shape.ts b/src/scripts/check_release_pr_shape.ts
index fd86048125..c6e9b26156 100644
--- a/src/scripts/check_release_pr_shape.ts
+++ b/src/scripts/check_release_pr_shape.ts
@@ -42,7 +42,6 @@ const ALLOWLIST_GLOBS = [
     'src/domains/*/README.md',
     'docs/archive/CHANGELOG-pre-*.md',
-    // Finding-disposition ledger (release-truth Phase 3) — a release PR must
-    // be able to carry the dispositions of its own self-review findings; the
-    // finding-dispositions gate is red until blocking ones are recorded here.
+    // Finding-disposition ledger — optional, committed by hand; a release PR
+    // may carry one, and since 2026-10-22 no gate waits for it.
     'agents/evidence/release-findings/*.json',
     // Evidence-temperature census — `taskfiles/content.yml` § release-prepare
diff --git a/tests/scripts/check_finding_dispositions.test.ts b/tests/scripts/check_finding_dispositions.test.ts
index 8aa4d068fd..487ad4d4f4 100644
--- a/tests/scripts/check_finding_dispositions.test.ts
+++ b/tests/scripts/check_finding_dispositions.test.ts
@@ -453,6 +453,7 @@ describe('exit codes — a present-but-empty ledger is not the same state as an
         // 16.5.0 is tagged in this repository, so the released probe answers
         // from the local tag list and no network is touched. Since 2026-10-22
-        // a release needs no review ledger (owner): the gate runs in the
-        // coverage guard on every push, and a red here would red main.
+        // a release needs no review ledger (owner). No workflow runs this as a
+        // gate, but the coverage guard invokes it on every push for its scan
+        // count, so a red here would red main.
         const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfd-absent-'));
         const r = runGate(dir, '16.5.0');
diff --git a/tests/scripts/self_review_release_once.test.ts b/tests/scripts/self_review_release_once.test.ts
index 719d94679c..c90f024c21 100644
--- a/tests/scripts/self_review_release_once.test.ts
+++ b/tests/scripts/self_review_release_once.test.ts
@@ -6,7 +6,9 @@
  * `check_release_pr_shape` admits only the version-bump allowlist plus the
  * findings ledger. So a second review there re-reads an unchanged diff and
- * returns new opinions rather than new defects, and `ingest-release-ledger`
- * appends them. Dispositions can only be recorded by a commit; a commit is a
- * push; a push starts another review. There is no exit state.
+ * returns new opinions rather than new defects. Until 2026-10-22 a job
+ * appended them to the ledger, and dispositions could only be recorded by a
+ * commit; a commit is a push; a push starts another review. There was no exit
+ * state. That job is gone with every release review gate, and the skip stays
+ * because a second review of an unchanged diff still buys nothing.
  *
  * MEASURED on `release/16.0.0`, 2026-09-12: the cut's ingest carried 39
```

## The round-1 diff, unchanged, for reference
## Diff of every file except four large pure-removal files (-U1)
```diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index 3c8f11d96f..d858d25dc7 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -472,28 +472,2 @@ jobs:
 
-      # The shipped version carries a findings ledger — checked OUTSIDE the
-      # `release/*` pull-request condition.
-      #
-      # The gate's only other caller is release-validation.yml's
-      # `finding-dispositions` job, gated on
-      # `startsWith(github.head_ref, 'release/')`. That branch is deleted after
-      # the merge, so nothing on the trunk ever ran the gate — and 14.17.0 and
-      # 14.18.0 both shipped with no ledger at all, undetected, because the only
-      # surface that could have said so no longer existed.
-      #
-      # TIMING, stated because it is not the obvious reading: this does NOT
-      # redden the release merge itself. At that moment the version is bumped
-      # but the tag and GitHub Release do not exist yet, so the gate's
-      # released-vs-unreleased probe correctly answers `unreleased` and an absent
-      # ledger is the normal in-flight state. It reddens on the first push to
-      # main AFTER publication — which is the window this is for: a human seeing
-      # it after the tag rather than on a branch that is gone.
-      #
-      # GH_TOKEN mirrors the release-validation job: when the ledger is absent
-      # the gate asks whether the version shipped, and in a checkout without
-      # tags `gh release view` is the authoritative answer.
-      - name: Shipped version carries a findings ledger
-        env:
-          GH_TOKEN: ${{ github.token }}
-        run: ./scripts-run src/scripts/check_finding_dispositions
-
       # Both gates below were registered `enforced` and ran in NO workflow, so
diff --git a/.github/workflows/release-validation.yml b/.github/workflows/release-validation.yml
index 6e60ca7c58..63e17b2f5a 100644
--- a/.github/workflows/release-validation.yml
+++ b/.github/workflows/release-validation.yml
@@ -18,4 +18,4 @@ name: Release Validation
 #                               populated span category (release-truth Phase 2)
-#   6. finding-dispositions   — blocking self-review findings carry committed
-#                               dispositions (release-truth Phase 3)
+#   (finding-dispositions was removed on 2026-10-22: a release waits for no
+#   review ledger, because everything on main is already reviewed — owner.)
 #
@@ -69,3 +69,2 @@ on:
       - 'src/scripts/release.ts'
-      - 'agents/evidence/release-findings/**'  # `finding-dispositions` reads it
       - 'tests/test_release_install_e2e.sh'
@@ -369,37 +368,2 @@ jobs:
 
-  finding-dispositions:
-    # Release-truth Phase 3: the release is red while any blocking/high
-    # self-review finding lacks a machine-readable disposition in the
-    # committed ledger (agents/evidence/release-findings/<version>.json).
-    # Deterministic — no model call, never fail-open: the gate comment's
-    # machine block only TRIGGERS the demand; the committed file is the
-    # record (council 2026-08-03: a PR comment is mutable, not a record).
-    if: ${{ github.event_name == 'pull_request' && startsWith(github.head_ref, 'release/') }}
-    name: Blocking review findings dispositioned
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
-        with:
-          persist-credentials: false
-
-      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1  # v7.1.0
-        with:
-          node-version: '22'
-          cache: 'npm'
-
-      - name: Install Node deps
-        run: |
-          npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 \
-            || (sleep 10 && npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000)
-
-      - name: Check disposition ledger against recorded + reported findings
-        env:
-          GH_TOKEN: ${{ github.token }}
-          HEAD_REF: ${{ github.head_ref }}
-        run: |
-          set -euo pipefail
-          version="${HEAD_REF#release/}"
-          ./scripts-run src/scripts/check_finding_dispositions \
-            --release "$version" --pr "${{ github.event.pull_request.number }}"
-
   audit-gate:
diff --git a/agents/roadmaps/road-to-hook-guards-that-hold-17-findings.md b/agents/roadmaps/road-to-hook-guards-that-hold-17-findings.md
index 034e5e0702..18fdb7fb65 100644
--- a/agents/roadmaps/road-to-hook-guards-that-hold-17-findings.md
+++ b/agents/roadmaps/road-to-hook-guards-that-hold-17-findings.md
@@ -85,3 +85,3 @@ dispositioned in the ledger.
 
-- [ ] **6.1 Cut 17.0.0 and run a fresh self-review to completion.** The CI
+- [-] **6.1 Cut 17.0.0 and run a fresh self-review to completion.** — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. The CI
       review runs NEUTRAL without API credit, and the local run reached 6 of 71
@@ -90,3 +90,3 @@ dispositioned in the ledger.
       verify: the review log names no `UNREVIEWED` path for the span.
-- [ ] **6.2 Disposition every finding of that review.** `fixed` with its
+- [-] **6.2 Disposition every finding of that review.** — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. `fixed` with its
       commit, `false_positive` with the reason, `accepted_risk` only by the
@@ -113,3 +113,3 @@ dispositioned in the ledger.
 - [ ] AC-4 — The admin-token workflow can only deploy from `main`.
-- [ ] AC-5 — 17.0.0 ships with a completed self-review and no undispositioned
+- [-] AC-5 — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. Original criterion: 17.0.0 ships with a completed self-review and no undispositioned
       finding in its ledger.
diff --git a/docs/contracts/release-pr-gating.md b/docs/contracts/release-pr-gating.md
index f038bc262a..b0b1514fd9 100644
--- a/docs/contracts/release-pr-gating.md
+++ b/docs/contracts/release-pr-gating.md
@@ -87,5 +87,5 @@ hold:
      era-boundary release.
-   - `agents/evidence/release-findings/*.json` — the finding-disposition
-     ledger; the `finding-dispositions` gate is red until a release's own
-     blocking self-review findings are recorded there
+   - `agents/evidence/release-findings/*.json` — an optional
+     finding-disposition ledger, committed by hand; since 2026-10-22 no gate
+     waits for it (owner: main is already reviewed)
    - `agents/evidence/analysis/evidence-temperature-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md`
@@ -233,3 +233,2 @@ the feature-PR floor by adding:
 | `release-validation.yml` (release-truth) | `highlight-plausibility` | curated head cannot claim `_none_` against a populated span-derived category (security commits, behaviour/default changes, honest nulls, removed public surface). **Prose polish is not gated** — an un-rewritten generator-derived head line warns and exits 0, because curating the head is retro-curation and not a merge precondition; the decision and its rejected branch are recorded in [`CHANGELOG-conventions.md` § Curated-head cadence](CHANGELOG-conventions.md#curated-head-cadence--retro-curation-not-a-merge-precondition) |
-| `release-validation.yml` (release-truth) | `finding-dispositions` | every blocking/high self-review finding carries a committed disposition in `agents/evidence/release-findings/<version>.json` — ingest via `check_finding_dispositions --ingest`; the ledger (never the PR comment) is the record |
 | `consumer-matrix.yml` | `consumer-matrix` · `publish-dry-run` · `mcp-worker-dry-run` · `plugin-bootstrap` | pack-based consumer E2E + pre-tag dry-runs of the release-adjacent workflows — see the exemption note below |
diff --git a/docs/release-runbook.md b/docs/release-runbook.md
index 4acda189eb..e1d8f5f7fe 100644
--- a/docs/release-runbook.md
+++ b/docs/release-runbook.md
@@ -160,33 +160,9 @@ doing it, so a crash localises to a step.
 5. **Commit + push** — commit `release: X.Y.Z`, push the branch, open the PR.
-6. **Wait for CI** — `gh pr checks --watch`. `--no-wait` skips it, but on a
-   **first** run that only moves the stop to step 7: the ledger step 7 requires
-   is committed by the CI review, so skipping the wait guarantees the release
-   stops one step later. `--no-wait` is useful on a resume, once the ledger is
-   already on the branch.
-7. **Findings ledger — verify only.** Asserts that
-   `agents/evidence/release-findings/X.Y.Z.json` is on **`origin/release/X.Y.Z`**
-   and that the disposition gate passes (in `--pr` mode, the same one CI uses),
-   and **stops** otherwise. It produces nothing.
-   *The ledger is produced by CI:* the `ingest-release-ledger` job in
-   `self-review-gate.yml` commits it to the release branch as soon as it has
-   reviewed the head. That placement is deliberate — two review rounds showed
-   `release.ts` cannot produce the file at any point in its own sequence,
-   because `finding-dispositions` already reds the check step 6 waits on.
-   *That job needs `RELEASE_PR_TOKEN`.* Its commit lands inside step 6's check
-   wait by construction, and a push authenticated with `GITHUB_TOKEN` starts no
-   workflow run — so the new head would carry zero checks against a protection
-   requiring one, and the wait could never end. With the PAT the push produces
-   the checks the wait is waiting for. Without it the job refuses to push at all
-   (a warning in its run log) rather than deadlock the release, and step 7 then
-   stops here on the missing ledger.
-   *If it stops:* for an absent ledger, wait for the review to finish, `git pull`
-   the release branch, resume. In a repository with no `ANTHROPIC_API_KEY` no
-   review runs and no ledger ever appears — write one carrying a
-   `no_findings_reason` and push it, once per release; the same is true with no
-   `RELEASE_PR_TOKEN`. For a refusing gate, fill
-   each blocking finding's `{status, rationale, verified_by}` (and `commit`, when
-   the status is `fixed`), push, then `task release -- --resume --yes`. No
-   automation writes a disposition.
-   *Before the merge on purpose:* the ledger lives on the release branch and
-   step 8 deletes it, so this is the last moment the check means anything.
+6. **Wait for CI** — `gh pr checks --watch`. `--no-wait` skips it.
+7. **No review gate.** A release waits for no review ledger: every commit on
+   `main` is already reviewed and merged, so the cut does not stop for a
+   self-review (owner, 2026-10-22 — the 17.0.0 cut stopped for a day on a
+   ledger whose review never finished). The step stays numbered so the step
+   anchors do not move. The self-review on the release PR is advisory, and
+   `check_finding_dispositions` remains a tool to run by hand.
 8. **Merge** — `gh pr merge --merge --delete-branch`.
@@ -199,3 +175,3 @@ doing it, so a crash localises to a step.
     `release.ts` before this list mentioned it; it is written down here now
-    rather than left as the drift found while adding step 7.
+    rather than left as drift.
 
@@ -334,9 +310,5 @@ for wf in evaluator-umbrella consumer-matrix release-validation; do
 done
-# step 7 verifies, and the job that produces what it verifies still exists:
-grep -q "settle_findings_ledger" src/scripts/release.ts \
-  || { echo "stale: the findings-ledger step is gone from release.ts"; exit 1; }
-grep -q "ingest-release-ledger:" .github/workflows/self-review-gate.yml \
-  || { echo "stale: nothing produces the ledger step 7 requires"; exit 1; }
-grep -q "RELEASE_PR_TOKEN" .github/workflows/self-review-gate.yml \
-  || { echo "stale: the ledger job no longer pushes with the PAT this doc promises"; exit 1; }
+# step 7 gates nothing — a release never waits for a review ledger:
+! grep -q "settleFindingsLedger" src/scripts/release.ts \
+  || { echo "stale: release.ts waits for a findings ledger again"; exit 1; }
 ```
diff --git a/src/config/ci-local-parity.yml b/src/config/ci-local-parity.yml
index 8a96391c1e..1101e301fe 100644
--- a/src/config/ci-local-parity.yml
+++ b/src/config/ci-local-parity.yml
@@ -191,3 +191,3 @@ ci_only:
     class: release
-    reason: "adjudicates the release-PR self-review findings ledger, whose input JSON is produced by the self-review workflow job"
+    reason: "adjudicates a self-review findings ledger by hand; no workflow runs it since 2026-10-22, when the owner removed every review gate from the release (main is already reviewed)"
   - id: report_skill_activation
diff --git a/src/config/gate-coverage.yml b/src/config/gate-coverage.yml
index 02ea2b6580..077c1c238d 100644
--- a/src/config/gate-coverage.yml
+++ b/src/config/gate-coverage.yml
@@ -909,3 +909,2 @@ gates:
     argv: []
-    ci_invocation: .github/workflows/consistency.yml
     min_scanned: 0
@@ -929,8 +928,6 @@ gates:
       legitimately record zero, because their self-review never completed. What
-      this row buys is therefore not a floor: it is `ci_invocation`. Before it,
-      the gate had exactly one caller, on a `release/*` head branch that is
-      deleted after the merge, and its removal would have been noticed by
-      nothing — which is how two releases shipped with no ledger. The row now
-      fails if `.github/workflows/consistency.yml` stops calling the gate, or
-      calls it with arguments this manifest does not reproduce.
+      this row buys is a scan count for a tool, not a release gate: since
+      2026-10-22 no workflow calls it and no release waits for a ledger,
+      because everything on main is already reviewed and merged (owner). The
+      row keeps the bare invocation honest for whoever runs it by hand.
 
diff --git a/src/config/release-gate-locality.yml b/src/config/release-gate-locality.yml
index 20635db1cb..57cb27dc0e 100644
--- a/src/config/release-gate-locality.yml
+++ b/src/config/release-gate-locality.yml
@@ -108,9 +108,2 @@ jobs:
 
-  finding-dispositions:
-    local: './scripts-run src/scripts/check_finding_dispositions --release ${VERSION}'
-    verify: false
-    reason: 'NEEDS_PR: the unrecorded-findings half reads live PR review comments. The missing-dispositions half does run locally and is what the `local` command covers.'
-    script: src/scripts/check_finding_dispositions.ts
-    guard: ~
-
   audit-gate:
diff --git a/src/scripts/check_finding_dispositions.ts b/src/scripts/check_finding_dispositions.ts
index 9e81b58e50..7fc6bba572 100644
--- a/src/scripts/check_finding_dispositions.ts
+++ b/src/scripts/check_finding_dispositions.ts
@@ -13,3 +13,3 @@
  * `{status: fixed|false_positive|accepted_risk, commit (when fixed),
- * rationale, verified_by}`; the release workflow is red while one does not.
+ * rationale, verified_by}` when the gate is run.
  *
@@ -26,31 +26,10 @@
  *
- * ABSENCE IS NOT EVIDENCE OF ZERO. An absent ledger used to exit 0 for any
- * version, so a RELEASED version whose findings were never ingested read as
- * "no findings" — the failure this paragraph exists to stop. When the ledger
- * file is missing the gate now asks whether the version has SHIPPED:
+ * AN ABSENT LEDGER IS NOT A FAILURE (owner, 2026-10-22). A release waits for
+ * no review ledger, because every commit on main is already reviewed and
+ * merged; the 17.0.0 cut stopped for a day on a ledger whose self-review never
+ * finished. An absent file reads as an empty ledger, shipped or not, and no
+ * workflow runs this gate any more — it is an advisory tool.
  *
- *   released        a tag for the version exists locally, or the remote says
- *                   the release exists  ->  an absent ledger is a FAILURE (1)
- *   unreleased      the local tag list is COMPLETE and lacks it, or the remote
- *                   says so  ->  normal in-flight state, absent ledger is fine
- *   undeterminable  the tag list cannot settle it and no remote answered  ->
- *                   exit 2. Refusing beats passing: a silent green here is the
- *                   very inversion this split exists to remove
- *
- * THE SOURCE IS THE TAG / RELEASE, AND DELIBERATELY NOT `CHANGELOG.md`. The
- * changelog heading is written by the release PR itself — gh pr diff 1836 shows
- * "+## [14.16.0](...)" inside the release commit — so on branch release/X the
- * changelog claims X is released before X exists. Reading it would redden every
- * in-flight release branch over a file nobody could yet have written, which is
- * the exact behaviour this split is here to preserve. The tag is created at
- * publish, after merge, so it cannot make that mistake.
- *
- * A local tag MISS is not authoritative on its own: actions/checkout fetches
- * depth 1 and no tags by default, and the one workflow that runs this gate does
- * not override either, so in CI the local tag list is EMPTY. See releaseStatus
- * for the asymmetry and the remote fallback.
- *
- * AN EMPTY LEDGER MUST SAY WHY IT IS EMPTY. The released/unreleased split above
- * closed the missing-file half; it left the other half open, because
- * `findings: []` still passed while asserting nothing. A writer could satisfy
+ * AN EMPTY LEDGER MUST SAY WHY IT IS EMPTY. A ledger that exists is a record,
+ * and `findings: []` used to pass while asserting nothing. A writer could satisfy
  * the gate by creating an empty file, which is the same silence wearing the
@@ -61,11 +40,9 @@
  * A future reader changing allowEmpty below is the person this is addressed to:
- * the EMPTY_VALID waiver now covers only an EXPLAINED empty ledger and an
- * unreleased version. It covers neither a released version with no ledger nor an
- * empty ledger with no reason.
+ * the EMPTY_VALID waiver covers an absent ledger and an EXPLAINED empty one. It
+ * does not cover an empty ledger with no reason.
  *
- * Exit codes: 0 complete · 1 missing/incomplete dispositions (an absent ledger
- * for a RELEASED version and an unexplained empty ledger are both among them) ·
- * 2 usage error, schema error, or an
- * undeterminable release status. Deliberately NOT fail-open: this script never calls a model;
- * a broken ledger file is a hard error, not a neutral skip.
+ * Exit codes: 0 complete or no ledger · 1 missing/incomplete dispositions (an
+ * unexplained empty ledger among them) · 2 usage error or schema error.
+ * Deliberately NOT fail-open: this script never calls a model; a broken ledger
+ * file is a hard error, not a neutral skip.
  */
@@ -885,26 +862,5 @@ function main(argv: readonly string[]): number {
 
-    if (!fs.existsSync(ledgerPath)) {
-        const status = resolve_release_status(release);
-        if (status === 'released') {
-            process.stderr.write(
-                `❌  ${release} has shipped and carries no findings ledger at `
-                    + `${path.relative(REPO_ROOT, ledgerPath)}.\n`
-                    + '    Absence is not evidence of zero — the release PR\'s self-review may have\n'
-                    + '    reported findings that were never ingested. Recover the machine block and:\n'
-                    + `    ./scripts-run src/scripts/check_finding_dispositions --ingest <findings.json> --release ${release}\n`,
-            );
-            return 1;
-        }
-        if (status === 'undeterminable') {
-            process.stderr.write(
-                `❌  cannot determine whether ${release} has shipped: this checkout tag list is`
-                    + ' incomplete (shallow or tagless) and no remote answered.\n'
-                    + '    Refusing to pass on an absent ledger without knowing — that silent green is\n'
-                    + '    the defect this check replaces. Fetch tags (actions/checkout fetch-tags: true)\n'
-                    + '    or make the gh CLI available.\n',
-            );
-            return 2;
-        }
-    }
-
+    // An absent ledger is not a failure, shipped or not: a release waits for no
+    // review ledger, because everything on main is already reviewed and merged
+    // (owner, 2026-10-22). It reads as an empty ledger below.
     let ledger: Ledger = { schema_version: 1, release, findings: [] };
diff --git a/src/scripts/release.ts b/src/scripts/release.ts
index 8d837cdc9c..906474e72e 100644
--- a/src/scripts/release.ts
+++ b/src/scripts/release.ts
@@ -38,4 +38,5 @@
  *     6. Wait for CI       — `gh pr checks --watch` (skippable with --no-wait).
- *     7. Findings ledger   — VERIFY it is on the branch and dispositioned, and
- *                            STOP otherwise; `self-review-gate.yml` builds it.
+ *     7. No review gate    — a release waits for no review ledger: every commit
+ *                            on main is already reviewed and merged (owner,
+ *                            2026-10-22). The self-review stays advisory.
  *     8. Merge             — `gh pr merge --merge --delete-branch`.
@@ -130,3 +131,2 @@ import { COMMIT_LOG_FORMAT, NO_IMPACT_TRAILERS, is_breaking_commit, parse_commit
 import { preflightPosition } from './_lib/release_position.js';
-import { settleFindingsLedger } from './_lib/release_findings_ingest.js';
 import { TAG_TRIGGERED_WORKFLOWS, dispatchTagWorkflows } from './_lib/release_tag_dispatch.js';
@@ -1043,8 +1043,4 @@ function execute(
 
-    // Step 7 — the findings ledger: verify, never produce; the module says why.
-    settleFindingsLedger({
-        run, die, repoRoot: REPO_ROOT, remote: REMOTE, trunk: MAIN_BRANCH,
-        step: (m) => { _step(7, total, m); }, write: (s) => process.stdout.write(s),
-        resolvePr: () => Number((pr_info ?? _pr_for_branch(branch))?.['number'] ?? NaN) || null,
-    }, plan.target, branch, pr_merged);
+    // Step 7 — kept as a numbered line so the step anchors stay stable.
+    _step(7, total, 'No review gate — main is already reviewed and merged');
     // Step 8 — merge
diff --git a/src/scripts/release_publication.ts b/src/scripts/release_publication.ts
index 721da2d713..3e69cc7250 100644
--- a/src/scripts/release_publication.ts
+++ b/src/scripts/release_publication.ts
@@ -231,11 +231,2 @@ export function _failed_checks_report(names: readonly string[]): string {
     }
-    if (names.includes('Blocking review findings dispositioned')) {
-        lines.push(
-            '',
-            'Dispositions: a blocking/high self-review finding has no committed',
-            'disposition. Ingest + adjudicate it in',
-            'agents/evidence/release-findings/<version>.json (release-truth Phase 3):',
-            '  ./scripts-run src/scripts/check_finding_dispositions --ingest <findings.json>',
-        );
-    }
     lines.push('', 'After fixing, resume with: task release -- --resume --yes', '');
diff --git a/tests/scripts/check_finding_dispositions.test.ts b/tests/scripts/check_finding_dispositions.test.ts
index fa04f5b12f..8aa4d068fd 100644
--- a/tests/scripts/check_finding_dispositions.test.ts
+++ b/tests/scripts/check_finding_dispositions.test.ts
@@ -451,2 +451,13 @@ describe('exit codes — a present-but-empty ledger is not the same state as an
 
+    it('absent for a SHIPPED version exits 0 and still reports its scan — a release waits for no ledger', () => {
+        // 16.5.0 is tagged in this repository, so the released probe answers
+        // from the local tag list and no network is touched. Since 2026-10-22
+        // a release needs no review ledger (owner): the gate runs in the
+        // coverage guard on every push, and a red here would red main.
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfd-absent-'));
+        const r = runGate(dir, '16.5.0');
+        expect(r.code, r.out).toBe(0);
+        expect(r.out).toMatch(/^scanned: 0$/m);
+    });
+
     it('present + empty + NO reason exits 1 — red before this change, green after it regresses', () => {
```

## The four large files: line counts, then every ADDED line (removed lines are omitted for size)
```
 .github/workflows/self-review-gate.yml        | 284 +---------------------
 src/scripts/_lib/release_findings_ingest.ts   | 337 +-------------------------
 src/scripts/release_drill.ts                  | 176 +-------------
 tests/scripts/release_findings_ingest.test.ts | 337 +-------------------------
 4 files changed, 37 insertions(+), 1097 deletions(-)
```
### src/scripts/_lib/release_findings_ingest.ts — added lines
```
+ * What is left of the release's side of the findings ledger: where a ledger
+ * lives, and the `Known limitations` line a cut on an override owes.
+ * A release no longer reads the ledger. Every commit on main is already
+ * reviewed and merged, so the cut waits for no review (owner, 2026-10-22);
+ * the 17.0.0 cut stopped for a day on a ledger whose self-review never
+ * finished. The self-review and `check_finding_dispositions` stay available
+ * as advisory tools.
```
### .github/workflows/self-review-gate.yml — added lines
```
+# `contents: read` is the floor and no job raises it. The two jobs that built
+# and committed a findings ledger onto release branches were removed on
+# 2026-10-22: a release waits for no review ledger, because everything on main
+# is already reviewed and merged (owner). The review itself stays advisory.
+      # Findings carry stable ids, and the artifact is the record. Nothing
+      # ingests it automatically: a release waits for no review ledger since
+      # 2026-10-22 (owner), so this job is advisory on every branch.
+      - name: Upload findings artifact (input for a manual `check_finding_dispositions --ingest`)
```
### src/scripts/release_drill.ts — added lines
```
+     * resume-after-merge state, in which steps 1 through 7 skip and step 8
+    'no-findings-ledger-does-not-stop-the-release': {
+            'step 7: a release waits for no review ledger — everything on main is already reviewed and merged (owner, 2026-10-22)',
+        // The 17.0.0 cut stopped here for a day: a ledger the self-review never
+        // finished, on a branch whose every commit had been reviewed on main.
+        // The world scripts no ledger command, so reading one would throw;
+        // `resume: false` so a first run is covered, not only a resumed one.
+        config: { resume: false },
+                !w.calls.some((c) => c.includes('check_finding_dispositions') || c.startsWith('git cat-file -e ')),
+                'the release read the findings ledger',
+            _expect(w.tag_remote, 'the release never pushed its tag', f);
```
### tests/scripts/release_findings_ingest.test.ts — added lines
```
+import { assuranceOverrideLimitation, ledgerRelPath } from '../../src/scripts/_lib/release_findings_ingest.js';
+const FINDINGS_WORKFLOW = 'self-review-gate.yml';
+// A release waits for no review ledger since 2026-10-22 (owner): the jobs that
+// built one and pushed it onto the release branch mid-release are gone, and
+// nothing in the workflow may write to the repository.
+describe('the self-review workflow commits nothing', () => {
+    it('carries no ledger job and grants no write scope to the repository', () => {
+        expect(workflow).not.toMatch(/^  (ingest|commit)-release-ledger:/m);
+        expect(workflow).not.toMatch(/contents: write/);
+        expect(workflow).not.toContain('RELEASE_PR_TOKEN');
```
### Removed from self-review-gate.yml: the jobs `ingest-release-ledger` and `commit-release-ledger` in full (the only jobs with contents: write and RELEASE_PR_TOKEN). Removed from release_findings_ingest.ts: settleFindingsLedger, LedgerStepDeps, ledgerOnBranchArgv, ledgerAbsentMessage, ledgerAbsentAfterMergeMessage, dispositionStopMessage, blockingWithoutDisposition, FINDINGS_WORKFLOW — each had no caller left after release.ts step 7 was removed. Removed from release_drill.ts: four step-7 ledger scenarios and the FakeWorld ledger plumbing. Removed from the ingest test: the tests of those deleted functions and of the two deleted jobs.

### release_findings_ingest.ts after the change (whole file)
```ts
/**
 * What is left of the release's side of the findings ledger: where a ledger
 * lives, and the `Known limitations` line a cut on an override owes.
 *
 * A release no longer reads the ledger. Every commit on main is already
 * reviewed and merged, so the cut waits for no review (owner, 2026-10-22);
 * the 17.0.0 cut stopped for a day on a ledger whose self-review never
 * finished. The self-review and `check_finding_dispositions` stay available
 * as advisory tools.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';


/** Where a release's ledger lives, relative to the repository root. */
export function ledgerRelPath(version: string): string {
    return `agents/evidence/release-findings/${version}.json`;
}

/**
 * The `Known limitations` line a cut taken on an override owes its readers.
 *
 * An override is the one way a release ships without having reviewed itself,
 * and it is recorded where only a releaser looks — inside the ledger JSON. A
 * consumer reading the published notes would see a release indistinguishable
 * from one that passed its self-review, which is the same silence-reads-as-
 * acceptance defect `assurance` was added to end one layer down.
 *
 * Returns null for every ordinary release: no ledger, a reviewed one, or one
 * carrying no override. The caller appends; it never replaces a derived line.
 */
export function assuranceOverrideLimitation(version: string, repoRoot: string): string | null {
    const abs = path.join(repoRoot, ledgerRelPath(version));
    if (!fs.existsSync(abs)) {
        return null;
    }
    let ledger: { assurance?: unknown; assurance_override?: unknown };
    try {
        ledger = JSON.parse(fs.readFileSync(abs, 'utf-8')) as typeof ledger;
    } catch {
        // A malformed ledger is the disposition gate's finding, not this line's.
        return null;
    }
    // Printed into public release notes: one line, no markdown, bounded. Whether
    // it names a committed directive is check_finding_dispositions' to refuse.
    const override = typeof ledger.assurance_override === 'string'
        ? ledger.assurance_override.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[`*[\]<>|#!]/g, '').trim().slice(0, 200)
        : '';
    if (override === '' || String(ledger.assurance ?? '').trim() !== 'unreviewed') {
        return null;
    }
    return (
        `This release was cut without a self-review: nothing reviewed ${version}, and the cut `
        + `was taken on an owner directive recorded at ${override}.`
    );
}
```
