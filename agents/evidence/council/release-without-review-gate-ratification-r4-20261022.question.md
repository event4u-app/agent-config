# Ratification review, round 4 — release without review gate

<!-- evidence-type: analysis -->

Round 4 of a ratification review (ADR-268 § 4). Round 3: both seats refused on exactly two remaining sentences — docs/contracts/release-pr-gating.md ~89 and src/scripts/check_release_pr_shape.ts ~45, which said 'no gate waits for it' — and proposed 'No release workflow waits for it; the consistency coverage guard still requires any committed ledger to be valid.' The commit below applies it. The remaining phrase 'a release waits for no review ledger' elsewhere is release-scoped. Give your verdict as exactly one of: ratified, confirmed-non-expanding, refused, non-convergent — with reasons and any remaining defects (file, line, failure scenario).

Context, stated as facts:
- The repository owner decided on 2026-10-22, in session, that a release must not wait for a self-review: every commit on main is already reviewed and merged before a release is cut. The 17.0.0 release stopped for a day at release.ts step 7 on a findings ledger whose self-review never finished; 17.0.0 was then published without a ledger.
- The diff removes the release-time review gates: release.ts step 7 (ledger verification), the release-validation `finding-dispositions` job, the consistency.yml step that refused a shipped version without a ledger, and the two self-review-gate.yml jobs that built a ledger and pushed it onto the release branch with a PAT. check_finding_dispositions treats an absent ledger as empty. The self-review job itself remains, advisory.
- consistency.yml is the gated file because it also runs the ratification gate; this diff does not touch the ratification step.

## The round-4 commit
```diff
diff --git a/docs/contracts/release-pr-gating.md b/docs/contracts/release-pr-gating.md
index b0b1514fd9..badc0f0ce6 100644
--- a/docs/contracts/release-pr-gating.md
+++ b/docs/contracts/release-pr-gating.md
@@ -87,6 +87,7 @@ hold:
      era-boundary release.
    - `agents/evidence/release-findings/*.json` — an optional
-     finding-disposition ledger, committed by hand; since 2026-10-22 no gate
-     waits for it (owner: main is already reviewed)
+     finding-disposition ledger, committed by hand. No release workflow waits
+     for it (owner, 2026-10-22: main is already reviewed); the consistency
+     coverage guard still requires any committed ledger to be valid
    - `agents/evidence/analysis/evidence-temperature-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md`
      — the per-release evidence-temperature census written by
diff --git a/src/scripts/check_release_pr_shape.ts b/src/scripts/check_release_pr_shape.ts
index c6e9b26156..0f8d16a9f9 100644
--- a/src/scripts/check_release_pr_shape.ts
+++ b/src/scripts/check_release_pr_shape.ts
@@ -43,5 +43,6 @@ const ALLOWLIST_GLOBS = [
     'docs/archive/CHANGELOG-pre-*.md',
     // Finding-disposition ledger — optional, committed by hand; a release PR
-    // may carry one, and since 2026-10-22 no gate waits for it.
+    // may carry one. No release workflow waits for it (2026-10-22); the
+    // consistency coverage guard still requires any committed ledger to be valid.
     'agents/evidence/release-findings/*.json',
     // Evidence-temperature census — `taskfiles/content.yml` § release-prepare
```
## The full branch diff against main, -U0, added lines only per file, for re-verification
```diff
+++ b/.github/workflows/consistency.yml
+++ b/.github/workflows/release-validation.yml
+#   (finding-dispositions was removed on 2026-10-22: a release waits for no
+#   review ledger, because everything on main is already reviewed — owner.)
+++ b/.github/workflows/self-review-gate.yml
+# `contents: read` is the floor and no job raises it. The two jobs that built
+# and committed a findings ledger onto release branches were removed on
+# 2026-10-22: a release waits for no review ledger, because everything on main
+# is already reviewed and merged (owner). The review itself stays advisory.
+      # Findings carry stable ids, and the artifact is the record. Nothing
+      # ingests it automatically: a release waits for no review ledger since
+      # 2026-10-22 (owner), so this job is advisory on every branch.
+      - name: Upload findings artifact (input for a manual `check_finding_dispositions --ingest`)
+++ b/agents/roadmaps/road-to-hook-guards-that-hold-17-findings.md
+- [-] **6.1 Cut 17.0.0 and run a fresh self-review to completion.** — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. The CI
+- [-] **6.2 Disposition every finding of that review.** — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. `fixed` with its
+- [-] AC-5 — **cancelled by the owner, 2026-10-22:** a release waits for no review; everything on main is already reviewed and merged. The release gates were removed (`fix/release-without-review-gate`) and 17.0.0 shipped without a self-review. Original criterion: 17.0.0 ships with a completed self-review and no undispositioned
+++ b/docs/contracts/release-pr-gating.md
+   - `agents/evidence/release-findings/*.json` — an optional
+     finding-disposition ledger, committed by hand. No release workflow waits
+     for it (owner, 2026-10-22: main is already reviewed); the consistency
+     coverage guard still requires any committed ledger to be valid
+++ b/docs/release-runbook.md
+6. **Wait for CI** — `gh pr checks --watch`. `--no-wait` skips it.
+7. **No review gate.** A release waits for no review ledger: every commit on
+   `main` is already reviewed and merged, so the cut does not stop for a
+   self-review (owner, 2026-10-22 — the 17.0.0 cut stopped for a day on a
+   ledger whose review never finished). The step stays numbered so the step
+   anchors do not move. The self-review on the release PR is advisory. No
+   release workflow waits for `check_finding_dispositions`, and an absent
+   ledger passes; the consistency coverage guard still executes it, so any
+   committed ledger must remain valid.
+    rather than left as drift.
+# step 7 gates nothing — a release never waits for a review ledger:
+! grep -q "settleFindingsLedger" src/scripts/release.ts \
+  || { echo "stale: release.ts waits for a findings ledger again"; exit 1; }
+++ b/docs/succession.md
+| `RELEASE_PR_TOKEN` (PAT / App token, `contents:write` + `pull-requests:write`) | Unattended release PR checks in [`release.yml`](../.github/workflows/release.yml) | Possibly one manual **"Approve workflows to run"** click per release — **but do not rely on it as a gate.** Measured on 14.0.0 (2026-08-18) with the secret absent: checks started immediately, no approval was asked, and the run would have merged, tagged and published unattended. Whether the safeguard applies is a repo/org Actions setting. The findings-ledger commit that also used it was removed on 2026-10-22, with every release review gate. |
+++ b/src/config/ci-local-parity.yml
+    reason: "adjudicates a self-review findings ledger by hand; since 2026-10-22 no release workflow waits for this check and an absent ledger passes (owner: main is already reviewed); the consistency coverage guard still executes it, so any committed ledger must remain valid"
+++ b/src/config/gate-coverage.yml
+      this row buys is not a release gate: since 2026-10-22 no release
+      workflow waits for this check and an absent ledger passes, because
+      everything on main is already reviewed and merged (owner). This
+      consistency coverage guard still executes it and requires it to
+      succeed, so any committed ledger must remain valid.
+++ b/src/config/release-gate-locality.yml
+++ b/src/scripts/_lib/release_findings_ingest.ts
+ * What is left of the release's side of the findings ledger: where a ledger
+ * lives, and the `Known limitations` line a cut on an override owes.
+ * A release no longer reads the ledger. Every commit on main is already
+ * reviewed and merged, so the cut waits for no review (owner, 2026-10-22);
+ * the 17.0.0 cut stopped for a day on a ledger whose self-review never
+ * finished. The self-review on a release PR is advisory. No release workflow
+ * waits for `check_finding_dispositions`; the consistency coverage guard still
+ * executes it, so any committed ledger must remain valid.
+ * An override is a ledger's explicit statement that its release was not
+ * self-reviewed, recorded where only a releaser looks — inside the ledger JSON.
+ * Since 2026-10-22 a release needs no ledger at all, so this line appears only
+ * for a ledger that carries an override; a release with no ledger publishes no
+ * limitation, because main is reviewed before the cut.
+++ b/src/scripts/check_finding_dispositions.ts
+ * rationale, verified_by}` when the gate is run.
+ * AN ABSENT LEDGER IS NOT A FAILURE (owner, 2026-10-22). A release waits for
+ * no review ledger, because every commit on main is already reviewed and
+ * merged; the 17.0.0 cut stopped for a day on a ledger whose self-review never
+ * finished. No release workflow waits for this check, and an absent ledger
+ * passes, shipped or not. The consistency coverage guard still executes it,
+ * so any committed ledger must remain valid.
+ *
+ * AN EMPTY LEDGER MUST SAY WHY IT IS EMPTY. A ledger that exists is a record,
+ * and `findings: []` used to pass while asserting nothing. A writer could satisfy
+ * the EMPTY_VALID waiver covers an absent ledger and an EXPLAINED empty one. It
+ * does not cover an empty ledger with no reason.
+ *
+ * Exit codes: 0 complete or no ledger · 1 missing/incomplete dispositions (an
+ * unexplained empty ledger among them) · 2 usage error or schema error.
+ * Deliberately NOT fail-open: this script never calls a model; a broken ledger
+ * file is a hard error, not a neutral skip.
+                'fill dispositions by hand; no release waits for them\n',
+    // An absent ledger is not a failure, shipped or not: a release waits for no
+    // review ledger, because everything on main is already reviewed and merged
+    // (owner, 2026-10-22). It reads as an empty ledger below.
+                'EMPTY_VALID: zero recorded findings is a pass. A version with no ledger reads '
+                + 'as empty, shipped or not, because a release waits for no review ledger '
+                + '(owner, 2026-10-22). It does not cover an existing empty ledger that does not '
+                + 'say why it is empty, which returns 1 above via empty_ledger_problem. '
+                + 'Un-ingested findings are caught by --pr (unrecorded_findings), never by this '
+                + 'count.',
+++ b/src/scripts/check_release_pr_shape.ts
+    // Finding-disposition ledger — optional, committed by hand; a release PR
+    // may carry one. No release workflow waits for it (2026-10-22); the
+    // consistency coverage guard still requires any committed ledger to be valid.
+++ b/src/scripts/release.ts
+ *     7. No review gate    — a release waits for no review ledger: every commit
+ *                            on main is already reviewed and merged (owner,
+ *                            2026-10-22). The self-review stays advisory.
+    // Step 7 — kept as a numbered line so the step anchors stay stable.
+    _step(7, total, 'No review gate — main is already reviewed and merged');
+++ b/src/scripts/release_drill.ts
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
+++ b/src/scripts/release_publication.ts
+++ b/tests/scripts/check_finding_dispositions.test.ts
+    it('absent for a SHIPPED version exits 0 and still reports its scan — a release waits for no ledger', () => {
+        // 16.5.0 is tagged in this repository, so the released probe answers
+        // from the local tag list and no network is touched. Since 2026-10-22
+        // no release workflow waits for this check and an absent ledger passes
+        // (owner). The consistency coverage guard still executes it on every
+        // push, so a red here would red main.
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfd-absent-'));
+        const r = runGate(dir, '16.5.0');
+        expect(r.code, r.out).toBe(0);
+        expect(r.out).toMatch(/^scanned: 0$/m);
+    });
+++ b/tests/scripts/release_findings_ingest.test.ts
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
+++ b/tests/scripts/self_review_release_once.test.ts
+ * returns new opinions rather than new defects. Until 2026-10-22 a job
+ * appended them to the ledger, and dispositions could only be recorded by a
+ * commit; a commit is a push; a push starts another review. There was no exit
+ * state. That job is gone with every release review gate, and the skip stays
+ * because a second review of an unchanged diff still buys nothing.
```
