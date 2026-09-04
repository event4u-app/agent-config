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

- [x] **0.1 Commit the five authorization probes as failing fixtures.** Four
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
      **Done, and the corpus is a TYPED corpus with stable ids** rather than a
      list of test descriptions — council 2/2, on the ground that AC-1 asks for
      cases "referenced by id" and a test name is neither stable across a
      refactor nor referenceable from outside the file. Rows live in
      `tests/scripts/fixtures/git_auth_negation_corpus.ts`, ids read
      `<class>.<lang>.<op>.<shape>-<nn>`, and each carries a `why` the test
      asserts is not a restatement of its prompt. The red baseline was measured
      before any edit, not asserted: all five reproduced. The verify's literal
      "exactly five failures" could not be produced, because a corpus committed
      in the same change as its fix is green on arrival — what was measured
      instead is the five polarities at HEAD, recorded in the evidence note.
      A **sixth** leak surfaced from the same probe and is in the corpus:
      `"Nach Release 1.5 bitte nicht mergen."` authorized `release`, which the
      source review did not name.
- [x] **0.2 Record the correction to the review's first High finding.** The
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
      **Done** — finding `7aee57d1e98e`, `false_positive`, in
      `agents/evidence/release-findings/14.15.0.json`. Two corrections to this
      step's own wording, both measured: `describeImpact` is at `:185-207`, not
      `:184-207` (`184` is the docblock's closing line), and there are **four**
      fixed `reason` strings, not three — the fourth is `"empty diff"` in
      `classifyDiff`. All four are literals, so the property is unaffected. The
      ledger entry also names the one residual the finding is right about: the
      `filesChanged` count IS patch-derived. It is a scalar, not content.
- [x] **0.3 Record the correction to the stated root cause of the ledger gap.**
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
      **Done — all three reproduce, re-run in this change**, and the root cause
      is written into the ledger entry for `13713a1a9ae6` rather than only here.
      `renderReview` is at `:335-367` and appends the machine block at
      `:363-365` unconditionally on the findings-present path; `enforce` is
      consumed only for the verdict line. So the gap is an ORDERING defect
      between two workflow files, which is why arming enforcement would not have
      caught it.

## Phase 0b — This is the second round on the negation defect

- [x] **0b.1 Record what the earlier disposition missed, in the corpus file
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
      **Done in the corpus header** — council 2/2 on where: the authoritative
      historical account stays in `tests/scripts/git_auth_merge_ops.test.ts`,
      where the merge-op split was reasoned, and the new corpus references it
      rather than duplicating a narrative that would drift. One addition the
      step did not know: that archived roadmap had **already recorded** the
      `"Do "`-as-question shape as pre-existing, so step 2.4 below is a
      re-discovery rather than a new finding — which strengthens this step's own
      point about under-specification rather than weakening it.

## Phase 1 — Close the race, and pay off 14.15.0

- [~] **1.1 Make the disposition trigger unable to run before its input.** The
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
      <!-- deferred-resolution: carried-to=road-to-release-finding-ordering -->
      **Deferred, and one of the two mechanisms this step names is
      impossible.** The producer and the consumer live in DIFFERENT workflow
      files — `.github/workflows/self-review-gate.yml` and
      `.github/workflows/release-validation.yml` — and `needs:` is
      intra-workflow only, so "declares a dependency on that job" cannot be
      written. Four candidates and their costs are carried to the receiver;
      both council seats chose the cross-workflow artifact download, and both
      added a half this step did not have: the wait must be
      terminal-state-aware, because a missing artifact has three causes that
      `allowEmpty` cannot tell apart (still running, finished with no findings,
      legitimately skipped on a keyless run) and treating all three alike
      rebuilds the fail-open path one level down.
      **The demonstration is Hard-Floor gated, which is why this is deferred
      rather than merely unfinished.** It needs a synthetic `release/*` pull
      request, and `release/*` is named in `non-destructive-by-default`'s
      Hard-Floor table, which no autonomy setting, roadmap step or standing
      instruction lifts. It also needs a finding-injection path that does not
      exist: findings come from a live model call, so there is no way to plant
      one deterministically today.
- [x] **1.2 Ingest the nine findings reported on PR #1828 into the ledger.**
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
      **Done — and the verify as written expects a red that cannot happen.**
      `missing_dispositions` skips every non-blocking finding, where blocking is
      `{security, claim} x {critical, high}`. The remaining seven are one
      medium/security, three medium/correctness, one medium/claim, one
      low/correctness and one low/style — none blocking — so once the two
      high/security entries are filled the gate goes GREEN with the seven empty.
      It never went red on them. Corrected here rather than left as a false
      expectation, and **Risk 3 of this roadmap's own register described the
      same impossible state and has been removed.**
      All nine are dispositioned anyway, which is more than the gate requires:
      **five `fixed`** by this branch's Phase 2 and Phase 3 commits, **two
      `false_positive`** with the measurement that refutes them, **three
      `accepted_risk`** each carried to a named receiver rather than left to
      expire. `--ingest` takes a mandatory FILE PATH — there is no bare
      `--ingest`, which this step's wording implies — and the input was the
      ORIGINAL artifact from run `33757633620`, sha256
      `826c002033733060932dd3113199c462079597f563aac4d01a0c61203134ff07`,
      downloaded rather than hand-reconstructed, per council F4(a).
- [x] **1.3 Write the root cause into the ledger entry, not only into this
      file.** The disposition record carries why the seam stayed open — the race
      of 0.3 — so a reader of `14.15.0.json` learns the lesson from the record
      rather than from a roadmap that will be archived.
      verify: the ledger's root-cause field names the three timestamps.
      **Done, in `rationale` — there is no `root_cause` field, and adding one
      was rejected 2/2.** `LedgerFinding` carries `finding_id, severity, kind,
      title, file?, status?, commit?, rationale?, verified_by?, date?` and no
      root-cause key at either level. An unvalidated top-level key would supply
      no enforceable value, and a schema change would re-open the existing
      `9.14.0.json`'s completeness for one incident's worth of prose. So the
      three timestamps — `12:51:54Z`, `12:53:25Z`, `12:58:10Z` — and the 91-second
      gap are in the `rationale` of `13713a1a9ae6`, and this step's wording is
      corrected from "root-cause field" to `rationale`.

## Phase 2 — Negation scope, in both directions

- [x] **2.1 Suppress on a negation that trails the match.** `negatedBefore`
      (`src/scripts/git_authorization_hook.ts:728-743`) inspects only the window
      before and inside the matched span, so a sentence that ends in its refusal
      authorizes. Extend the check to the remainder of the same sentence, with
      direction-tagged cues rather than a second blind window.
      verify: the two trailing-negation fixtures of 0.1 turn green; no other
      corpus row changes polarity.
      **Done as ONE edit with 2.3** — both rewrite `negatedBefore`, so splitting
      them would have meant landing a half-written function. `negatedBefore` is
      at `:728-743` as stated. 228 existing authorization tests are unchanged
      and passing, which is the "no other row changes polarity" half.
- [x] **2.2 Stop treating an abbreviation's dot as a sentence boundary.** The
      boundary scan takes any of `.!?\n` as a sentence start, so `z.B.` amputates
      the window and the preceding negation falls out of scope. Skip the known
      abbreviation shapes and a dot between digits.
      verify: the `z.B.` fixture turns green, and `"Nach Release 1.5 bitte nicht
      mergen."` still denies.
      **Done — and the control in this verify was HALF FALSE, measured.**
      `"Nach Release 1.5 bitte nicht mergen."` denied the merge and
      **authorized `release`** at `022c0d240`. The decimal point ended the
      sentence before the negation, and nothing scanned forward. So it was not a
      control at all; it was a sixth undetected leak wearing a control's
      clothes. It is now a corpus row asserting the empty set, and the digit-dot
      rule this step adds is one of the two fixes that closes it — 2.1's forward
      scan is the other.
- [x] **2.3 Widen the window, or replace it with a clause scan.** Thirty
      characters is inherited from the pr-merge lookbehind and is the whole
      reason `"Bitte unter keinen Umstaenden diesen Pull Request jetzt mergen"`
      authorizes: the negation sits forty-one characters upstream. Termination
      cues (`aber`, `sondern`, `but`) must end a negation's reach so the fix
      cannot regress into over-suppression.
      verify: that fixture turns green, and a constructed
      `"nicht pushen, aber mergen"` row still authorizes the merge.
      **Done, clause scan rather than a wider window** — council 2/2, on the
      ground that a distance count embedded in a specification is fragile. Two
      corrections to this step's own text. The distance is **38** characters to
      the negation's end and **44** to its start, not forty-one. And
      `"nicht pushen, aber mergen"` did **not** authorize the merge at HEAD — it
      returned the empty set, so the word "still" was false and the row was not
      a control. The archived sibling roadmap states the rule that disqualifies
      it: a positive case that only passes after the change is a description of
      the new behaviour. It is labelled as such in the corpus, and the genuine
      controls used instead were verified green at HEAD first:
      `"Merge PR #123, but do not push to production."`,
      `"Nicht pushen. Merge PR #12."` and `"merge PR #123"`.
      The reason it returned empty turned out not to be the window at all: the
      `pr-merge` pattern carried its **own** inline 30-character negative
      lookbehind, a second negation vocabulary whose own comment warned that
      "two negation vocabularies in one tree drift, and the drift is invisible
      until a prompt lands in the gap between them". They had drifted, and this
      prompt is the one that landed in the gap. It is removed; every phrase
      match already passes through `negatedBefore`.
- [x] **2.4 Stop one leading word from suppressing a whole prompt.**
      `isInterrogative` (`:448-465`) tests the entire prose block, so any prompt
      opening with `do`, `does`, `is`, `can` or `should` authorizes nothing —
      `"Do the release now. Merge PR #12."` and `"Is everything green. Merge PR
      #12."` both return an empty operation set. That, not the negation
      lookbehind, is why `"Do not push. Merge PR #12."` fails the polarity its
      own docblock demands. Scope the interrogative test to the sentence that
      carries the matched operation.
      verify: the 0.1 must-allow fixture turns green; a genuine question —
      `"was macht npm publish eigentlich genau?"` — still authorizes nothing.
      **Done. `isInterrogative` is at `:448-466`, not `:448-465`.** Scoping it
      per sentence surfaced a defect underneath: its imperative-escape list
      carried `jetzt` and not `now`, so `"Do the release jetzt."` authorized
      `release` and `"Do the release now."` authorized nothing — a
      German/English parity gap, measured as a pair. Closing it is only safe
      because an explicit trailing `?` now outranks the escape, which is a
      NARROWING; without that ordering, adding `now` would have made
      `"Can you do the release now?"` authorize a release. Both are asserted in
      the corpus.
      **One known limit is recorded rather than hidden:**
      `"do not push, but merge PR #7"` is a single sentence opening with `do`,
      so the per-sentence scope cannot reach it and it still authorizes nothing.
      The same prompt prefixed with `"Please"` is green. Carried to the
      receiver.

## Phase 3 — Lock the properties that are currently only true by accident

- [x] **3.1 Assert the closed-vocabulary property of hook refusals.** A property
      test feeds `describeImpact` a patch containing credential-shaped and
      path-shaped strings and asserts none of them appears in the returned
      message. This turns Phase 0.2's correction from an observation into a
      contract.
      verify: the test fails when a line interpolating patch text into the
      refusal is added, and passes on the current implementation.
      **Done, and scoped to the PIPELINE rather than to `describeImpact`.**
      That function takes a `MergeImpact` whose `markers` is a caller-supplied
      `string[]`, so a test handing it a hand-built impact can inject anything
      and would be asserting nothing about the code. The property only exists
      over `classifyDiff(patch)` then `describeImpact`, because `classifyDiff`
      is the boundary that maps patch bytes onto the closed label set. The
      sabotage half of the verify is a real case in the file, not a manual
      exercise: it runs the checker over a message that DOES interpolate the
      patch and requires it to fail, and a second case asserts the token list is
      actually present in the fixture — so a vacuous pass is excluded from both
      directions.
- [x] **3.2 Emit a diagnostic when a grant consumption write fails.**
      `consumeGrantTarget` (`:841-877`) swallows a failed durable write behind a
      comment reading "Observability only" while emitting nothing. The failure
      direction is defensible and stays; the silence does not.
      verify: a test with an unwritable ledger path observes a diagnostic on
      stderr and an unchanged authorization outcome.
      **Done at BOTH sites.** This step named `consumeGrantTarget` (`:841-877`,
      correct); there is an identical silent swallow around the session-ledger
      write about 130 lines below it, with the same "Observability only"
      comment. AC-5 describes a behavioural class, so fixing one would have made
      the acceptance claim half true — council 2/2. The test makes the WRITE
      fail rather than the read (the read side already returns silently on a bad
      path, so a read failure never reaches the write), and a structural
      assertion requires that no `atomic_write_json` catch in the file binds
      nothing.
- [x] **3.3 Take the pull-request number bound from the API contract.**
      `mergeTargetOf` (`src/scripts/hooks/block_unauthorized_git.ts:628-638`)
      matches `\d{1,7}`; GitHub's identifier is a signed 32-bit integer. An
      eight-digit target parses as no target, which falls back to the
      clock-bound path — fail-closed, and still wrong.
      verify: a fixture with an eight-digit number resolves to that number.
      **Done at BOTH sites, and at only one it would have been inert.** This
      step names the consume site; the underlying review finding
      (`220223cedd5e`) names the MINT site, `extractMergeTargets`, which carries
      the same `\d{1,7}` and is where a grant's target set is frozen. Widening
      only the consumer means an eight-digit target resolves but was never
      mintable, so no grant can match it and the clock path still applies —
      the fix changes nothing. Both now accept ten digits and range-check
      against one exported `PR_NUMBER_MAX = 2147483647`; the mint site's
      required `#`/`PR ` prefix is unchanged, per its own docblock's
      over-matching warning. A `git show` probe in the test asserts the
      seven-digit bound really was present at `022c0d240`, so the fix is not
      claimed from memory.
- [x] **3.4 Read a rename as a rename.** The destructive markers of
      `classifyDiff` match added lines only, so a rename that deletes and re-adds
      the same `dropTable` call scores additive. Consume git's rename metadata,
      or match the deleted side for the removal markers.
      verify: a fixture patch carrying `rename from`/`rename to` around a schema
      drop classifies destructive.
      **Done — and this step's stated mechanism is wrong for half the table.**
      "The destructive markers match added lines only" is false for four of the
      eight: removed export, removed public symbol, removed route and
      `deleted file mode` all match DELETED lines. And the diff this step
      describes — one that "deletes and re-adds the same `dropTable` call" —
      already scored destructive, because the re-added line trips the
      added-side anchor. Measured. The real leak is adjacent and was measured
      too: a rename whose hunk drops schema on the **deleted side only**
      (`similarity index 88%`, `-Schema::dropTable(...)`, `+Schema::create(...)`)
      classified additive with no markers.
      The fix is the second option this step offers, scoped as its own Risk 4
      requires: a deleted-side schema scan CONDITIONAL on git's rename
      metadata, never applied to every deleted line — which would have scored
      the pinned "removing a dropColumn call is not destructive" counter-case
      destructive. That counter-case is asserted unchanged beside the new one so
      the pair must be read together.
      **Residual, asserted rather than left as a gap:** a `similarity index
      100%` rename carries no content lines and stays additive, so a moved
      migration is invisible to this scan.

## Not in scope

Arming `self_review_gate --enforce` is an owner act and is deliberately not a
step here. The blocker this section cited by name, `self-review-gate-cost`, is
recorded `Status: resolved` on its own archived roadmap — while the
`Resolved when:` clause it carries is unmet, since the workflow still runs
`continue-on-error: true` with no `--enforce`. Citing it as a live
maintainer-owned blocker was therefore wrong in both directions, and the
citation is dropped rather than repaired: the owner-act argument stands on its
own and does not need it. Phase 1
reaches bindingness without it: the deterministic `finding-dispositions` job is
already a required check, and fixing its race makes the advisory gate's output
land in a record that gate cannot merge past. No model call becomes blocking.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Negation hardening over-suppresses | implementation | Widening the window or adding trailing cues starts denying merges the user did order, which fails silently — nothing happens and nothing says why, the failure the pr-merge docblock calls worse than the defect | The corpus asserts the must-allow rows as hard as the must-deny rows, and 2.3 ships termination cues in the same step as the widening | Phase 2 — Negation scope, in both directions |
| 2 | The race is closed for the comment path only | implementation | Consuming the artifact fixes the ordering but leaves a second read path that can still see an empty comment list on a re-run | 1.1 requires the synthetic red to be produced through the path actually wired in CI, not through a local invocation | Phase 1 — Close the race, and pay off 14.15.0 |
| 3 | The ledger fills with empty dispositions — **WITHDRAWN 2026-09-03, the state is unreachable** | product | Withdrawn rather than deleted, so the register carries its own correction. The row claimed seven findings with no owner verdict would make `14.15.0.json` "a permanently red gate". They cannot: `missing_dispositions` skips every non-blocking finding, and all seven are medium or low, so the gate goes GREEN with them empty. The mitigation answered a risk that does not exist. What replaced it in practice is stronger than the mitigation was — all nine carry a disposition, and the three that are neither fixed nor refuted are `accepted_risk` with a named receiver | The residual risk, which is real and is the one this row should have named: a non-blocking finding can sit dispositioned-as-accepted indefinitely with nothing re-raising it. Phase 3 of the receiver holds the three, so each has a place to be closed | Phase 1 — Close the race, and pay off 14.15.0 |
| 4 | Rename-aware classification widens the marker set | implementation | Matching deleted lines for removal markers can score an ordinary refactor destructive, and a refusal that fires on everything is read past | 3.4 scopes the change to patches carrying rename metadata rather than to every deleted line | Phase 3 — Lock the properties that are currently only true by accident |

## Acceptance Criteria

- [x] AC-1 — The five prompts of Phase 0.1 return the polarity their sentence
      carries, and the corpus that asserts them is committed and referenced by
      id from the fixture file.
      Met, and a sixth prompt with it. Rows live in
      `tests/scripts/fixtures/git_auth_negation_corpus.ts` as typed records with
      stable ids (`negation.de.pr-merge.trailing-01` and so on) — not test
      descriptions, which are neither stable across a refactor nor referenceable
      from outside the file, and so cannot satisfy "referenced by id". 25 cases
      green; 228 pre-existing authorization tests unchanged.
- [~] AC-2 — A release pull request whose self-review reports a high-severity
      security or claim finding cannot show a green `finding-dispositions` check
      while that finding is absent from the ledger, demonstrated once end to end
      on a synthetic branch.
      <!-- deferred-resolution: carried-to=road-to-release-finding-ordering -->
      **Deferred with 1.1, and the reason is a rule rather than a difficulty.**
      The demonstration needs a synthetic `release/*` pull request, and
      `release/*` is named in `non-destructive-by-default`'s Hard-Floor table,
      which no autonomy setting, roadmap step or standing instruction lifts. It
      additionally needs a finding-injection path that does not exist today —
      findings come from a live model call — so even with the branch there is
      nothing deterministic to plant. Council 2/2 chose to PARTITION rather than
      weaken this criterion: the four authorization defects and the ledger are
      independently verified and close here, and holding them behind an
      administrative and Hard-Floor dependency would be the worse trade. The
      criterion travels intact to the receiver as its own AC-2, alongside a
      fail-closed fixture flag it needs first.
- [x] AC-3 — `agents/evidence/release-findings/14.15.0.json` exists and every
      blocking finding in it carries a complete disposition.
      Met, and exceeded: all NINE carry a disposition, not only the two blocking
      ones. Five `fixed` with their commit, two `false_positive` with the
      measurement that refutes them, three `accepted_risk` each carried to a
      named receiver. Ingested from the original artifact rather than
      hand-reconstructed — run `33757633620`, sha256
      `826c0020…34ff07`. `check_finding_dispositions --release 14.15.0` green.
- [x] AC-4 — A test fails if patch-derived text is interpolated into a hook
      refusal message.
      Met, with the sensitivity asserted in the file rather than described: one
      case runs the checker over a message that DOES interpolate the patch and
      requires it to fail, and another asserts the token list is present in the
      fixture, so a vacuous pass is excluded from both directions. Scoped over
      the `classifyDiff` → `describeImpact` pipeline, because `describeImpact`
      alone takes a caller-supplied markers array and would assert nothing.
- [x] AC-5 — A failed grant-consumption write is observable on stderr, and the
      authorization outcome it produces is unchanged.
      Met at BOTH sites. The step named one; an identical silent swallow sat
      about 130 lines below it. AC-5 describes a behavioural class, so fixing
      one would have made this claim half true. The test makes the write fail
      rather than the read, asserts the diagnostic names the failure direction,
      and asserts `consumeGrantTarget` does not throw — which is the
      "outcome unchanged" half.
