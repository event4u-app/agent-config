# Findings: drain-delivery-for-every-host-4-4-close
<!-- completion-review: v1 | reviewed: 2026-09-10 | scope: 4b6338451a69dd8fe16370b57d81f1a7413a6c942a25ae8526f02ce0c92c502d | diff: c4658aa959c9b4f4b29f1afef26e15cbc18c2bcb | reviewer: r2-fresh-subagent-drain-delivery-for-every-host-4-4-close | prompt_hash: 536d48566fe4545b90c8be070fada56757ecec4ead1a9158cd68df5eb5e21ea8 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-delivery-for-every-host-4-4-close"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-10 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c4658aa959c9b4f4b29f1afef26e15cbc18c2bcb
  scope_hash: 4b6338451a69dd8fe16370b57d81f1a7413a6c942a25ae8526f02ce0c92c502d
  roadmap: agents/roadmaps/road-to-delivery-for-every-host.md
  roadmap_hash: f996407b4019d4f9e6d4b379df1d481b93e875d67bf31662b25133d35d1309b1
  ac_hash: 336cf5acce8b7138ae8feb08225583eb81d7918be2b99ee60f039864561202b0
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-10T06:19:39Z
-->
<!-- rebind: v1
rebound: 2026-09-10T06:41:43Z
  RE-BOUND IN PLACE per contract 2.7 path 1, after every one of the 9 rows
  reached a terminal status. scope 06569f65aa79 -> 4c2de56a7eb2, diff
  1d36c6ca56c5 -> fd54b3585493, roadmap_hash 5dcdd60b7a23 -> 98596f5cd244 (the
  roadmap gained the Risk 3 retraction for finding 1 and the fail-open
  qualification for finding 4). `ac_hash` is UNCHANGED at b163bc3793e2, so the
  acceptance criteria this round was reviewed against did not move -- which
  matters, because the remediation touched the roadmap and a moved ac_hash would
  mean the criteria themselves had been edited under the review.
  `reviewer` and `prompt_hash` are deliberately NOT updated. The package under
  `drain-delivery-for-every-host-4-4-close.review-input/` is the one that
  produced these 9 findings, and rewriting it would destroy the binding
  `check_review_prompt_binding` exists to keep. It therefore describes the
  as-dispatched scope, not this one, and that is stated rather than papered over.
  The scope hash quoted in the closing Scope-and-method section is likewise left
  at 06569f65aa79: it records what the reviewer actually read.
  Editing this artefact does not move the scope hash again --
  `agents/evidence/reviews` is excluded from the review scope
  (`dispatch_r2_reviewer.ts:115-118`), so this re-bind is a fixed point rather
  than a chase.
-->
<!-- rebind: v1
rebound: 2026-09-10T07:07:03Z
  SECOND re-bind, same contract 2.7 path 1, all 9 rows still terminal. scope
  4c2de56a7eb2 -> 96359926503, diff fd54b3585493 -> c4658aa959c9. `roadmap_hash`
  and `ac_hash` are both UNCHANGED (98596f5cd244 / b163bc3793e2): this move
  touched only `ADR-273` and its two derived files, not the roadmap and not the
  acceptance criteria.
  Why a second one was owed rather than avoidable: closing finding 6 lowered
  `evidence.strength` from E3 to E1, and the ADR index carries that grade in a
  column, so CI went red on `stale: docs/decisions/INDEX.md` — the derived-file
  half of the same finding. Regenerating the index and the census moved the
  reviewed content again, which is the normal consequence of remediating inside
  a reviewed scope and is why the contract has this path at all.
  No finding is re-opened by it. The scope hash converged after this re-bind:
  `agents/evidence/reviews` is excluded from the scope, so writing this block is
  not itself a further move.
-->
<!-- rebind: v1
rebound: 2026-09-10T08:19:04Z
  THIRD re-bind, contract 2.7 path 1, all 9 rows still terminal. scope
  96359926503 -> 4b6338451a69, roadmap_hash 98596f5cd244 -> f996407b4019,
  ac_hash b163bc3793e2 -> 336cf5acce8b.
  Cause: `origin/main` was merged in and it had taken ADR-273 for
  `pack-size-caps-reset-on-a-reconstructed-clean-baseline`, so THIS record
  renumbered to ADR-274. The scope is a merge-base diff, so a merge moves the
  hash on its own; the renumber then moved the reviewed text as well.
  Why this is a re-bind and not a fresh review, MEASURED rather than asserted.
  The scope file set changed by exactly one entry, and it is the same file under
  a new name -- ADR-273-the-grace-ceiling-... left, ADR-274-the-grace-ceiling-...
  entered, the eleven others unchanged. The content delta across those eleven,
  `git diff f7fb052ff HEAD` over the common set, is `ADR-273` -> `ADR-274` and
  nothing else, plus the two generated artefacts picking up main's own ADR-273
  row and its census counts. No bound, no assertion, no glyph, no acceptance
  criterion moved.
  `ac_hash` DID move this time, and it is the field that would have meant the
  criteria were edited under the review, so it was diffed rather than trusted:
  the acceptance-criteria snapshot differs at exactly two lines, both of the form
  "`ADR-273`" -> "`ADR-274`" in prose pointing at step 4.4. The criteria
  themselves are untouched, which is why the round is re-bound rather than
  re-dispatched.
  `diff_sha`, `reviewer` and `prompt_hash` are NOT updated -- `diff_sha` is
  provenance and `dispatch_r2_reviewer.ts:1061` never compares it, and the other
  two describe the as-dispatched scope, which is the binding
  `check_review_prompt_binding` exists to keep.
  The File:Line column still names `docs/decisions/ADR-273-the-grace-ceiling-...`
  on findings 3, 4, 6, 8 and 9. Those paths are left as the reviewer wrote them,
  for the same reason `prompt_hash` is: the column records what was read. Read
  them at `ADR-274-the-grace-ceiling-...`, same file, renumbered by this merge.
-->

<!--
  POST-MERGE PROSE CORRECTIONS, 2026-09-10. Not a re-bind and not a new block
  kind: `docs/contracts/evidence-artifact-types.md` reasons deliberately about
  which blocks this artefact class carries and why a re-bind carries no type, so
  this is a plain comment rather than an invented `correction: v1` grammar -- an
  earlier revision of this block used one, which was itself the kind of quiet
  addition the contract argues against.
  No finding is re-opened and no hash moves: `agents/evidence/reviews` is
  excluded from the review scope (`dispatch_r2_reviewer.ts:115-118`), so nothing
  written here is part of what any round measures. Verified after committing.

  1. THE THREE `rebound:` TIMESTAMPS WERE IMPOSSIBLE -- each POST-DATED the
     commit that wrote it, because local CEST was labelled `Z`. Each now carries
     the true UTC commit time of its own commit, read from
     `git log -1 --format=%cI`:
       6d7b8334a  2026-09-10T08:41:43+02:00  ->  06:41:43Z  (was 08:55:00Z)
       f7fb052ff  2026-09-10T09:07:03+02:00  ->  07:07:03Z  (was 09:20:00Z)
       431024d7e  2026-09-10T10:19:04+02:00  ->  08:19:04Z  (was 10:30:00Z)
     The size of the error depends on the frame and both are worth stating,
     because an earlier revision of this block gave one number in the frame the
     `Z` label rules out: read as the UTC the label declares, the old values sat
     133.3 / 132.9 / 130.9 minutes after their commits; read as local wall-clock,
     13.3 / 12.9 / 10.9. The impossibility holds either way.
     Read each value as the commit's own instant rather than as a moment before
     it: the block is written before its commit, and the commit time is the only
     instant that is a checkable fact afterwards.

  2. FINDING 6's REMEDIATION CELL WAS STALE, NOT CIRCULAR -- and the first
     attempt at this correction got that backwards. It claimed the cited
     corroboration "does not exist" and was "circular". Measured instead of
     asserted, `git show <commit>:agents/evidence/analysis/adr-evidence-census-2026-08.md`
     over the four commits that touched it:
       85666cbba 08:17:42  proposed E1  declared E3
       fd54b3585 08:39:26  proposed E1  declared E3
       6d7b8334a 08:41:43  proposed E1  declared E3   <- the cell was written here
       c4658aa95 09:06:25  proposed E2  declared E1
     So at the moment of writing, the census proposed `E1` while the record still
     declared `E3`. The proposal disagreed with the declared value, which is
     exactly what makes it independent -- it cannot have been a mirror of a value
     it contradicted. The defect is that `c4658aa95` invalidated it 25 minutes
     later, by adding the § that quotes the contract's E3 wording, which a
     keyword scan then matched (`prereg @ ...:200`).
     `ADR-274` § "The evidence grade, and why it came down" already had this
     right: "computed `E1 ...` WHEN IT WAS FIRST SCANNED. That corroboration then
     destroyed itself." The first revision of this block cited that sentence two
     paragraphs after denying the corroboration ever existed. A thing that never
     existed cannot destroy itself, and stating both was the same class of
     over-claim this artefact exists to remove -- committed while accusing an
     earlier reviewer of being partly wrong. Recorded rather than quietly fixed.

  3. WHAT IS NOT EDITED, stated completely this time. An earlier revision of this
     block presented a two-item list as the whole residual. It was not.
     (a) Finding 6's FINDING text carries the same census citation, in its MAIN
         CLAUSE ("row added in this same diff independently computes `E1` ...").
         Its closing parenthesis carries a different and correct caveat, so the
         earlier revision named the wrong span when it superseded "the
         parenthesis".
     (b) The File:Line column names the old `ADR-273-the-grace-ceiling-...md`
         path on rows 3, 4, 6, 8 and 9, with line suffixes `:9`, `:68`, `:17`,
         `:112` and `:118` -- the earlier revision generalised the first to all
         five. These resolve at `ADR-274-the-grace-ceiling-...`, same file.
     (c) BARE `ADR-273:NNN` references on rows 1, 2, 3, 4, 8 and 9 --
         `ADR-273:116`, `:83`, `:56`, `:118-121`, `:155-158`. These are WORSE
         than (b) and the earlier revision omitted them entirely.
         `docs/decisions/ADR-273-pack-size-caps-reset-on-a-reconstructed-clean-baseline.md`
         EXISTS, so a bare number now resolves silently into the wrong record:
         `sed -n '116p'` on it prints `| \`dist/agent-src\` | 2.6187 | 21.0 % |`.
         The "same file, renumbered" remedy in (b) does not cover a bare number
         that resolves to a different file. Read every bare `ADR-273:NNN` in this
         table as `ADR-274:NNN`.
     All three are the reviewer's own words, and this artefact does not rewrite
     them -- the same reason `prompt_hash` and `reviewer` are never updated on a
     re-bind. That reason is an inference from
     `docs/contracts/plan-review-gates.md:301-303`, where `scope:` is the only
     field staleness is decided on, rather than a rule stated in those terms.

  4. THE BASIS FOR "AN EARLIER REVIEW REPORTED THIS AS UNCORRECTED" DOES NOT
     RESOLVE IN A CLONE. Both reviews that produced these corrections ran as
     subagents in a session; neither is committed anywhere under `agents/`, and
     `gh pr view 1983` carries no review and no comment mentioning the census. So
     that sentence adjudicates an artefact a reader cannot open. Kept because it
     names where a claim came from, and flagged here because an unresolvable
     citation is a weaker thing than a resolvable one.

  ONE THING NO GATE CATCHES, and the mechanism corrected. The dead paths in (b)
  are invisible to `check_references`: `PATH_PATTERN`
  (`check_references.ts:160-161`) requires a delimiter from [`"\s,;)\]]
  immediately after `.md`, and a `:` is not in that class -- exercised on the
  real table lines, the regex returns 0 hits on rows 3, 4, 6, 8 and 9.
  `check_completion_review` DOES read the path cell -- `fileLine: cells[2]` at
  `check_completion_review.ts:630` -- but nothing ever consumes it; the field
  appears only at its declaration (`:126`) and that assignment. An earlier
  revision of this block said it "never reads the path cells", which was wrong
  about the mechanism and right about the consequence. Leaving these references
  is a decision, not a gate outcome.
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | agents/roadmaps/road-to-delivery-for-every-host.md:1061 | The replacement mitigation is itself an unenforced dated commitment - the exact defect this change removes. The corrected Risk 3 cell states the new mitigation is "the shrink-only ratchet ... plus `target_schedule.on_miss`, which requires the 2026-11-10 milestone miss to be PUBLISHED with its measured number - milestones are untouched here and that first miss will land on schedule". No code reads either key: `grep -rn "target_schedule" --include=*.ts --include=*.js --include=*.yml --include=*.yaml --include=*.sh .` (excluding `node_modules` and `dist/`) returns 0 hits, and `grep -rnw on_miss` the same. Nothing will publish anything on 2026-11-10. "requires" and "will land on schedule" describe a mechanism that does not exist, which is precisely what `grace_end_date` was found to be. ADR-273:116 contradicts the cell in the same commit, saying those milestones "were never the enforcement surface". | fixed | `fd54b3585` — Retracted in `road-to-delivery-for-every-host.md` Risk 3: the `target_schedule.on_miss` mitigation claim is removed and replaced with the 0-hit grep, an explicit retraction, and the statement that the only enforced mitigation bounds GROWTH and nothing converges the corpus. `ADR-273` § Consequences now names `on_miss` as an unenforced commitment rather than a forcing function. The finding was correct and this was the same defect one paragraph after removing it. |
| 2 | high | agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md:28 | The prose sweep ADR-273:83 commits to ("Correct every prose site that claimed the expiry") is incomplete, and the reproduction grep is why. The grep restricts to `--include=*.ts --include=*.yml --include=*.yaml --include=*.json`, so no `.md` consumer was ever visible; ADR-273:56 then states "the only consumers of `grace_end_date` in the tree" - true of code, asserted of the tree. Two LIVE parked roadmaps still carry the expiry as a Revisit-if wake trigger that can now never fire: `agents/roadmaps/later/road-to-database-erd-landing.md:468` ("The `grace_end_date` of 2026-11-10 is a second trigger: at that date the design ceiling of 107,646 applies") and `agents/roadmaps/later/road-to-database-relational-modeling.md:596` (same shape). This is the identical defect ADR-273:118-121 names for ADR-264's `review_trigger` - named there, missed here, and neither fixed nor tracked. Verified: `grep -rln 2026-11-10` shows these are the only two remaining live grace-expiry sites; the archive and dated-evidence hits are historical records. | fixed | `fd54b3585` — Both live wake triggers repaired: `later/road-to-database-erd-landing.md` and `later/road-to-database-relational-modeling.md` — the unfirable second trigger is deleted with the quoted original and the reason, leaving the enforced ceiling trigger as the only one. `ADR-273` § Context corrected from "the only consumers in the tree" to "in CODE" with the grep restriction named, and the evidence artifact gains a § "The grep above is CODE-scoped, and that mattered" carrying the `.md` sweep and the code-vs-prose-consumer distinction. `lint_roadmap_later_disposition` green, both wake ratchets hold. |
| 3 | medium | docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md:9 | The change acts in a dimension the same roadmap twice recorded as owner-reserved, on council authority, with no owner decision on that dimension. roadmap:801-806 records anthropic verbatim: "Owner-reserved for extending grace_end_date beyond 2026-11-10 - extending the date increases permitted exposure duration and is a substantive relaxation requiring owner authority", and roadmap:841-843 adds "a split council does not acquire authority a converged one was denied". Deleting the bound is an UNBOUNDED relaxation of permitted exposure duration - strictly larger than the extension that was reserved - and the register's own new text concedes the result is "an undated, shrink-only tolerance 30,767 tokens above the design ceiling". The no-enforcement argument answers the executable half only; the reservation was recorded against exposure DURATION, which is what was removed. Compounding: the new record self-assigns `reopen_policy: directional` (council-decidable) while declaring `protected_dimensions: governance`, so the venue for reopening it is set by the body that decided it. | fixed | `fd54b3585` — `reopen_policy` corrected `directional` -> `owner`, and `ADR-273` gains § "The authority question, recorded rather than glossed": the reservation was recorded against exposure DURATION, deleting the bound is larger in that dimension than the reserved extension, the delegation is what the decision rests on, and it does not make the reservation vanish retroactively. A council acting in an owner-reserved dimension may not also set the venue for revisiting it. |
| 4 | medium | docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md:68 | "a shrink-only ratchet enforced against the base ref by `assertBoundsDidNotRise`" (and roadmap:1061's "real and enforced per PR") overstates a guard that fails OPEN. `src/scripts/_lib/standing_bound_ratchet.ts:94-135` returns `ok: true` on four base-ref failure modes - no base ref resolved, the budget config unreadable at the base ref, unparseable, or no `ci_delivery.grace_ceiling` at the base ref - each with an honest `note` but a passing verdict. So the ratchet is conditional on base-ref resolution (shallow clone, absent `origin/main`, unresolvable merge base) rather than unconditional. The inconsistency is internal to one document: ADR-273:155-158 disqualifies the base-ref-derived ceiling proposal on exactly this property ("returns `null` on every failure, correct for a diagnostic and unacceptable for a ceiling") while relying on the same property unqualified 90 lines earlier. This matters more after the change than before, because the ratchet is now the only enforced mitigation named. | fixed | `fd54b3585` — Both claims qualified. `ADR-273` § Context gains the four fail-open modes at `standing_bound_ratchet.ts:94-135` and states that the same property disqualifies the rival proposal in § Alternatives, so one standard gets one answer. Risk 3 in the roadmap now says "conditional rather than absolute" and "fails open" with the modes enumerated, instead of "real and enforced per PR". |
| 5 | medium | taskfiles/ci-fast.yml:882 | Half-corrected string: the same `desc` clause that was edited to fix a stale ceiling figure still asserts "The tree measures 138,212". Verified by running the gate on this branch: measured total is 138,413 (`project-scope rules 122822 + preloaded skills catalog 14845 + CLAUDE.md 746`). The diff's own commit note says of the neighbouring clause "the figure was two raises stale as well", so the staleness class was known and the adjacent instance in the same string was left. Same pattern in `src/config/preamble-payload-budget.json:85`, which this diff also rewrites and which still opens "HEAD measures 138,212 ... nobody can reduce 30,566 tokens" (actual gap 30,767) - defensible as historical framing there, not defensible in a present-tense "The tree measures". | fixed | `fd54b3585` — `taskfiles/ci-fast.yml:882` now reads "measured 138,212 when this note was written and measures 138,413 on 2026-09-10". The budget file instance is left as historical framing, which the finding itself allows. |
| 6 | medium | docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md:17 | `evidence.strength: E3` is not supportable by the declared basis, and the grade is load-bearing. `docs/contracts/adr-layout.md:178-181` defines E1 as "One local observation - one incident, consumer, measurement, tree constraint" and reserves E3 for "pre-registered benchmark, production data, established community standard, applicable vendor guidance". The basis here is one dated inspection of one commit (`Measured 2026-09-10 in a worktree at origin/main 7bf325f3b`) - four greps and one gate run. `adr-layout.md:464` prices the reopen burden on the grade (E3/E4 requires "engaging the original evidence in kind"), so the overclaim raises the bar to reopen a governance record. Cross-check: sibling ADR-264, same subject and a stronger evidence resolution, declares E2. The `agents/evidence/analysis/adr-evidence-census-2026-08.md` row added in this same diff independently computes `E1 - one dated local observation` (that census is biased low by design, so it is corroboration rather than proof). | fixed | `fd54b3585` — `evidence.strength` corrected `E3` -> `E1`, with § "The evidence grade, and why it came down" citing `adr-layout.md:178-181` and `adr-layout.md:464` pricing the reopen burden on the grade. CORRECTED 2026-09-10, TWICE, and the second correction retracts the first (see the block above the table): this cell cites "the census row that independently computes E1". That was TRUE when written and is STALE now. At `6d7b8334a` the row proposed `E1` against a declared `E3`, so the proposal was independent of the declared value; `c4658aa95` re-ran the census and flipped the proposal to `E2` -- because this very section quotes the contract's E3 wording and the census is a keyword scan. Read the citation as of the commit that made it. An inflated grade would have raised the bar to reopen a record decided on one day of inspection. |
| 7 | low | tests/scripts/check_preamble_payload_budget.test.ts:205 | Two of the four added tests duplicate assertions already in this file. `:205-212` ("still ENFORCES the grace ceiling") asserts `main(['--ceiling', grace]) === 0` and `main([]) !== 0`, which is the entire `describe('the gate reds on growth past whichever ceiling applies')` block at `:265` and `:273`. `:215-219` asserts `evaluate(undefined, undefined, design - 1).ceiling === design`, verbatim the second expectation of `:237-243`, re-deriving a local `design` where a `design()` helper exists 18 lines below - and it sits in a describe about the date, not about override direction. Consequence beyond redundancy: the `main([]) !== 0` copy at `:211` drops the caveat carried at `:266-270` ("HEAD is over the design ceiling today ... when a reduction lands this flips and the assertion must be inverted"), so a future reduction reds two tests and only one carries the instruction. The roadmap's "37 tests ... including two new regression pins" is accurate for the two pins at `:187` and `:194`; the other two additions are not disclosed as duplicates. | fixed | `fd54b3585` — The two duplicates are gone. The block now asserts only what is not asserted elsewhere - that the ceiling exists and is above the design number - and its comment names the two describes that own the exit codes and the override direction, including that the surviving copy of the `main([]) !== 0` caveat lives there. 36 tests green; the two regression pins are untouched and remain the ones proven red under sabotage. |
| 8 | low | docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md:112 | "`status_2026_08_24.committed_reduction_mechanism` remains the string `NONE`" is not what the field holds. Its value is a multi-sentence paragraph beginning `"NONE. Stated explicitly because its absence is the finding: no mechanism in the tree is committed to closing 35,692 tokens by 2026-11-10 ..."`. The same overstatement appears at `.github/workflows/standing-payload-delta.yml:34` ("the budget file still records `committed_reduction_mechanism: NONE`") and in roadmap:1061 as "still recorded verbatim as `NONE`" - where "verbatim" is exactly wrong. Minor in itself; noted because the whole subject of this change is prose that claims more precision than the config supports. The embedded paragraph also still carries the 35,692/2026-11-10 pairing the change elsewhere corrects. | fixed | `fd54b3585` — Corrected in all three places: `ADR-273` § Consequences ("still opens with `NONE` - its value is a paragraph"), the workflow header comment, and the roadmap Risk 3 cell, which now names its own earlier use of "verbatim" as wrong. |
| 9 | low | docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md:118 | A known-dead `review_trigger` on an accepted owner-reserved governance record is left with no tracked carrier. ADR-273 correctly identifies that ADR-264's third `review_trigger` clause (verified verbatim at `docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md:26-27`) "cannot fire", and declines to edit ADR-264 on the defensible ground that its `reopen_policy` is `owner`. But nothing tracks the repair: no blocker, no stub, no roadmap step, and ADR-273's own `review_trigger` does not cover it. The only record that an accepted record carries an unfirable trigger is a prose bullet in a different ADR - the same discoverability failure that let the original fiction survive. | fixed | `fd54b3585` — `ADR-273`'s `review_trigger` now carries the repair explicitly - reopened when ADR-264's third trigger is repaired or that record superseded - so this record is the tracked carrier, and § Consequences says so. ADR-264 itself stays unedited: its `reopen_policy` is `owner`. |

## Scope and method

Reviewed the branch diff only (10 files, scope hash `06569f65aa79374490c45e8627ff2456f19573a7148b35708879f1f58d6ddd24`).
Claims were re-derived rather than accepted: the gate was run
(`check_preamble_payload_budget` -> measured total 138,413, matching the diff's
figure exactly), the "no date logic" grep over
`src/scripts/check_preamble_payload_budget.ts` was reproduced (0 matches), the
`grace_end_date` key deletion was confirmed against the parsed JSON, the cited
line range `check_preamble_payload_budget.ts:399-450` was read and matches its
description, and `check_references`, `check_adr_frontmatter`,
`check_new_adr_evidence` and `lint_evidence_artifacts` were run green.

The central factual claim of this change - that the expiry was never enforced -
is CORRECT and was verified independently. Every finding above is about what the
change asserts around that correction, not about the correction itself.

No vitest run was performed (the review is read-only and a suite run can touch
tracked files); the duplication in finding 7 was established by reading.
