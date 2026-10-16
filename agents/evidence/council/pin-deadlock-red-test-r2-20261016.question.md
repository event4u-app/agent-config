<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for PR #2383 (fix/pin-deadlock-recovery-20261016),
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# PR #2383, round 2 — the red danger-gate test: evidence asked for, and a concrete delta

Round 1 (`agents/evidence/council/pin-deadlock-red-test-20261016.question.md`): both seats asked for revision — an exact, self-expiring skip rather than a red or loosely skipped test, a separate assertion of the fallback path, and proof that the `tsx` fallback cannot be head-poisoned into a weaker verdict and fails closed. This round supplies the evidence from the tree and CI, and the delta.

## Evidence

1. **What the red test actually received.** CI on `266f01b63`: `expected 'verdict: needs-council (runtime-uncertain…' to match /^verdict: needs-owner \(/`. The scenario is a head that bumps `package.json` AND edits a kernel rule, run with a poisoned head-installed runtime. With the restored module the base copy cannot run under type stripping, so the block takes its fallback branch. The verdict was `needs-council`, not `routine`.
2. **That branch is #2375's reviewed residual, already under test, and those tests still run.** `tests/scripts/classify_merge_risk_base_revision.test.ts`, describe "without type stripping and with a head-installed tsx — the stated residual, and its bounds" (lines ~363–450), forces the no-strip branch with a node shim and asserts: a forged `routine` on a gated change plus a bump is `needs-council`, never `routine` (the stated residual); a fallback that crashes on a manifest change is `needs-owner`; a fallback that exits 0 with a malformed verdict is `needs-owner`; a listing read without its end marker is `needs-owner`; an unreadable changed-file list is `needs-owner`; a nested `package.json` counts. Separately: without type stripping a manifest-only change is `needs-council (runtime-uncertain)` and a gated change WITHOUT a manifest change still reaches `needs-owner`. All pass locally on the #2383 head with the delta below (30 passed, 1 skipped).
3. **Where the fallback's trust boundary sits.** Per #2375's block: the base classifier runs from a detached worktree of the base; the fallback uses the checkout's `tsx`; a head that tracks `node_modules` is `needs-owner`; a head that changes any dependency manifest (package.json, npm/yarn/pnpm/bun lockfiles, `.npmrc`, `.yarnrc.yml`, at any depth) has its fallback verdict floored — nothing below `needs-council`, and a crash or malformed answer is `needs-owner`. A head WITHOUT a manifest change cannot change the installed runtime under that branch, so its fallback verdict is the base classifier's own. The one weakening during the window is therefore exactly the residual: a gated change bundled with a manifest change and a poisoned runtime reaches the council instead of the owner.
4. **Duration and expiry.** The window closes when #2375's refactor is re-applied (step 3), two PRs after #2383, in the same autonomous run that is processing this now. The skip below is keyed to the exact module blob, so it ends by construction when step 3 changes the module — no date to forget. Merges in the window go through `/pr:merge`, whose danger gate would itself route the stage-2 and step-3 PRs (gated surface) away from `routine`.

## Delta (test only)

```diff
+const UNSTRIPPABLE_SUBJECT_BLOB = '3842d91528ec5229819dbd0da2f1a67a1f0eb06c';
+const SUBJECT_UNSTRIPPABLE =
+    spawnSync('git', ['hash-object', '--', 'src/scripts/_lib/ratification_subject.ts'], {
+        cwd: REPO,
+        encoding: 'utf8',
+    }).stdout.trim() === UNSTRIPPABLE_SUBJECT_BLOB;
 ...
-    it.skipIf(!STRIP_TYPES)(
+    it.skipIf(!STRIP_TYPES || SUBJECT_UNSTRIPPABLE)(
         'where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change',
```

with a comment stating that the blob declares parameter properties, that the no-strip branch it forces is covered by the residual tests, and that any other blob runs the test again.

## Question

Given this evidence: does the delta meet round 1's conditions, or what concrete, still-missing change would you require before #2383 merges? Report defects with file:line, scenario and severity. State APPROVE or REQUEST_CHANGES.
