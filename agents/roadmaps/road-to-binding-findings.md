---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-merge-op-split-and-negation-guard
    relation: extends
    note: "carries that roadmap forward: it closed the negation defect for the phrases its source named, and four further shapes leak at 022c0d240 because its corpus asserted a phrase list where the property was the thing to assert"
estate_offset_exempt: "Adds one active roadmap against a floor of 1. No existing roadmap can absorb it: the single active roadmap is a council-topology carrier and the two candidates in later/ are unrelated. Parking it would defer a proven fail-open authority defect on the merge path, and archiving anything to pay for it would dispose of work that is not finished."
---
# Road to binding findings

> **Source:** `agents/tmp.old/inbox-2026-09-c/set-1/` and `set-2/` — an external
> release review of 14.14.1 + 14.15.0 and its consolidation. Every defect below
> was re-verified against `main@022c0d240` in this repository before it was
> written down; two of the review's own claims did not survive that check and
> are recorded as corrections in Phase 0.

## Goal

Two things are true when this is finished. First, `classifyAuthorization` no
longer reads a refusal as an authorization: the five prompts recorded in
Phase 0 return the polarity the sentence carries, and a committed corpus keeps
both directions asserted. Second, a release pull request carrying a
high-severity security or claim finding cannot reach a green
`finding-dispositions` check without that finding sitting in
`agents/evidence/release-findings/<version>.json` with a filled disposition —
which is not true today for a reason that has nothing to do with the gate being
advisory.

## Phase 0 — Anchor: what was reproduced, and what the review got wrong

- [ ] **0.1 Commit the five authorization probes as failing fixtures.** Four
      fail open and one fails closed; all five were run against
      `src/scripts/git_authorization_hook.ts` at `022c0d240` and returned the
      wrong polarity. Rows, with the observed result:
      `"Merge PR #12 auf keinen Fall."` -> authorized (must deny);
      `"Merge #12 under no circumstances."` -> authorized (must deny);
      `"Du sollst nicht z.B. den PR #12 mergen."` -> authorized (must deny);
      `"Bitte unter keinen Umstaenden diesen Pull Request jetzt mergen"` ->
      authorized (must deny); `"Do not push. Merge PR #12."` -> not authorized
      (must allow, per the pr-merge docblock's own stated intent).
      verify: `npx vitest run tests/scripts/git_auth_negation_corpus.test.ts`
      exits non-zero with exactly five failures before Phase 2 runs.
- [ ] **0.2 Record the correction to the review's first High finding.** The
      reported leak — "stage-2 impact scan exposes diff content in hook stderr
      without sanitization" — does not reproduce. `describeImpact`
      (`src/scripts/hooks/merge_impact.ts:184-207`) emits only fixed marker
      labels from a closed table, a file count, two digit capture groups and
      three fixed `reason` strings; `fetchPatch` runs its subprocesses with
      `stdio: ["ignore", "pipe", "ignore"]`, so neither git's nor gh's stderr is
      captured at all. The residue is real but different: nothing in the tree
      asserts that property, so a later edit can interpolate patch text into a
      refusal without a gate noticing. That becomes Phase 3, not a fix.
      verify: the correction is written into the ledger entry Phase 1 creates,
      naming file and line range.
- [ ] **0.3 Record the correction to the stated root cause of the ledger gap.**
      The consolidation attributes the missing `14.15.0.json` to an
      `enforce: false` gate never posting a machine block. That is wrong on the
      evidence: the comment on PR #1828 does carry
      `<!-- release-findings-json: … -->`, because `renderReview`
      (`src/scripts/self_review_gate.ts:335-367`) appends it whenever
      `findings.length > 0`, independent of `enforce`. The actual cause is an
      ordering race, measured: the `finding-dispositions` job completed at
      `12:51:54Z`, the self-review comment was created at `12:53:25Z`, the pull
      request merged at `12:58:10Z`. The trigger read the comment list ninety-one
      seconds before the comment existed, went green, and nothing re-ran it.
      verify: `gh pr view 1828 --json comments,mergedAt` and
      `gh api repos/event4u-app/agent-config/actions/runs/33757633537/jobs`
      reproduce all three timestamps.

## Phase 0b — This is the second round on the negation defect

- [ ] **0b.1 Record what the earlier disposition missed, in the corpus file
      itself.** `agents/roadmaps/archive/road-to-merge-op-split-and-negation-guard.md`
      closed its AC-3 — "a prompt saying `do not merge`, `nicht mergen` or
      `never auto-merge` no longer authorizes" — with a positive-control corpus
      and a sabotage probe, and its own § notes already observed that "the
      negation defect is not merge-only". Four of the five prompts in 0.1 leak
      anyway. The disposition was not wrong; it was under-specified — the corpus
      enumerated the phrases the source named instead of asserting the polarity
      property, so every shape nobody thought to type stayed open. The corpus
      header states that, so the next author extends by property rather than by
      example.
      verify: the corpus file names the archived roadmap and the reason its
      coverage did not generalise.

## Phase 1 — Close the race, and pay off 14.15.0

- [ ] **1.1 Make the disposition trigger unable to run before its input.** The
      `finding-dispositions` job must not read the pull request's comment list
      at a moment when the self-review job has not posted. Pick the mechanism
      that keeps the check deterministic: either the disposition job consumes
      the `self-review-findings` artifact the review job already uploads
      (`.github/workflows/self-review-gate.yml:81-90`) rather than the comment,
      or it declares a dependency on that job and re-reads afterwards. The
      comment stays transport; the artifact and the committed ledger stay the
      record.
      verify: a synthetic release branch whose review reports one planted
      high-severity security finding produces a red `finding-dispositions`
      check, with the run's job timings showing the read happened after the
      finding existed.
- [ ] **1.2 Ingest the nine findings reported on PR #1828 into the ledger.**
      `agents/evidence/release-findings/` holds only `9.14.0.json`; the release
      that merged with two blocking findings recorded nothing. Create
      `14.15.0.json` via `check_finding_dispositions --ingest`, then fill each
      disposition. Two dispositions are already determined by Phase 0: the
      stderr finding is `false_positive` with 0.2's evidence, the negation
      finding is `fixed` pointing at the Phase 2 commit. The remaining seven
      need an owner verdict and stay empty until they have one.
      verify: `./scripts-run src/scripts/check_finding_dispositions --release
      14.15.0` is red on the seven, and green once each carries
      `{status, commit, rationale, verified_by}`.
- [ ] **1.3 Write the root cause into the ledger entry, not only into this
      file.** The disposition record carries why the seam stayed open — the race
      of 0.3 — so a reader of `14.15.0.json` learns the lesson from the record
      rather than from a roadmap that will be archived.
      verify: the ledger's root-cause field names the three timestamps.

## Phase 2 — Negation scope, in both directions

- [ ] **2.1 Suppress on a negation that trails the match.** `negatedBefore`
      (`src/scripts/git_authorization_hook.ts:728-743`) inspects only the window
      before and inside the matched span, so a sentence that ends in its refusal
      authorizes. Extend the check to the remainder of the same sentence, with
      direction-tagged cues rather than a second blind window.
      verify: the two trailing-negation fixtures of 0.1 turn green; no other
      corpus row changes polarity.
- [ ] **2.2 Stop treating an abbreviation's dot as a sentence boundary.** The
      boundary scan takes any of `.!?\n` as a sentence start, so `z.B.` amputates
      the window and the preceding negation falls out of scope. Skip the known
      abbreviation shapes and a dot between digits.
      verify: the `z.B.` fixture turns green, and `"Nach Release 1.5 bitte nicht
      mergen."` still denies.
- [ ] **2.3 Widen the window, or replace it with a clause scan.** Thirty
      characters is inherited from the pr-merge lookbehind and is the whole
      reason `"Bitte unter keinen Umstaenden diesen Pull Request jetzt mergen"`
      authorizes: the negation sits forty-one characters upstream. Termination
      cues (`aber`, `sondern`, `but`) must end a negation's reach so the fix
      cannot regress into over-suppression.
      verify: that fixture turns green, and a constructed
      `"nicht pushen, aber mergen"` row still authorizes the merge.
- [ ] **2.4 Stop one leading word from suppressing a whole prompt.**
      `isInterrogative` (`:448-465`) tests the entire prose block, so any prompt
      opening with `do`, `does`, `is`, `can` or `should` authorizes nothing —
      `"Do the release now. Merge PR #12."` and `"Is everything green. Merge PR
      #12."` both return an empty operation set. That, not the negation
      lookbehind, is why `"Do not push. Merge PR #12."` fails the polarity its
      own docblock demands. Scope the interrogative test to the sentence that
      carries the matched operation.
      verify: the 0.1 must-allow fixture turns green; a genuine question —
      `"was macht npm publish eigentlich genau?"` — still authorizes nothing.

## Phase 3 — Lock the properties that are currently only true by accident

- [ ] **3.1 Assert the closed-vocabulary property of hook refusals.** A property
      test feeds `describeImpact` a patch containing credential-shaped and
      path-shaped strings and asserts none of them appears in the returned
      message. This turns Phase 0.2's correction from an observation into a
      contract.
      verify: the test fails when a line interpolating patch text into the
      refusal is added, and passes on the current implementation.
- [ ] **3.2 Emit a diagnostic when a grant consumption write fails.**
      `consumeGrantTarget` (`:841-877`) swallows a failed durable write behind a
      comment reading "Observability only" while emitting nothing. The failure
      direction is defensible and stays; the silence does not.
      verify: a test with an unwritable ledger path observes a diagnostic on
      stderr and an unchanged authorization outcome.
- [ ] **3.3 Take the pull-request number bound from the API contract.**
      `mergeTargetOf` (`src/scripts/hooks/block_unauthorized_git.ts:628-638`)
      matches `\d{1,7}`; GitHub's identifier is a signed 32-bit integer. An
      eight-digit target parses as no target, which falls back to the
      clock-bound path — fail-closed, and still wrong.
      verify: a fixture with an eight-digit number resolves to that number.
- [ ] **3.4 Read a rename as a rename.** The destructive markers of
      `classifyDiff` match added lines only, so a rename that deletes and re-adds
      the same `dropTable` call scores additive. Consume git's rename metadata,
      or match the deleted side for the removal markers.
      verify: a fixture patch carrying `rename from`/`rename to` around a schema
      drop classifies destructive.

## Not in scope

Arming `self_review_gate --enforce` is an owner act under the maintainer-owned
blocker `self-review-gate-cost` and is deliberately not a step here. Phase 1
reaches bindingness without it: the deterministic `finding-dispositions` job is
already a required check, and fixing its race makes the advisory gate's output
land in a record that gate cannot merge past. No model call becomes blocking.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Negation hardening over-suppresses | implementation | Widening the window or adding trailing cues starts denying merges the user did order, which fails silently — nothing happens and nothing says why, the failure the pr-merge docblock calls worse than the defect | The corpus asserts the must-allow rows as hard as the must-deny rows, and 2.3 ships termination cues in the same step as the widening | Phase 2 — Negation scope, in both directions |
| 2 | The race is closed for the comment path only | implementation | Consuming the artifact fixes the ordering but leaves a second read path that can still see an empty comment list on a re-run | 1.1 requires the synthetic red to be produced through the path actually wired in CI, not through a local invocation | Phase 1 — Close the race, and pay off 14.15.0 |
| 3 | The ledger fills with empty dispositions | product | Seven findings with no owner verdict make `14.15.0.json` a permanently red gate, and the pressure is then to weaken the gate rather than decide | 1.2 splits the two determined dispositions from the seven undetermined ones, so the red set is small and named | Phase 1 — Close the race, and pay off 14.15.0 |
| 4 | Rename-aware classification widens the marker set | implementation | Matching deleted lines for removal markers can score an ordinary refactor destructive, and a refusal that fires on everything is read past | 3.4 scopes the change to patches carrying rename metadata rather than to every deleted line | Phase 3 — Lock the properties that are currently only true by accident |

## Acceptance Criteria

- [ ] AC-1 — The five prompts of Phase 0.1 return the polarity their sentence
      carries, and the corpus that asserts them is committed and referenced by
      id from the fixture file.
- [ ] AC-2 — A release pull request whose self-review reports a high-severity
      security or claim finding cannot show a green `finding-dispositions` check
      while that finding is absent from the ledger, demonstrated once end to end
      on a synthetic branch.
- [ ] AC-3 — `agents/evidence/release-findings/14.15.0.json` exists and every
      blocking finding in it carries a complete disposition.
- [ ] AC-4 — A test fails if patch-derived text is interpolated into a hook
      refusal message.
- [ ] AC-5 — A failed grant-consumption write is observable on stderr, and the
      authorization outcome it produces is unchanged.
