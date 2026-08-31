<!-- evidence-type: analysis -->

# Autonomous drain run — 2026-08-31 (run 11)

> **The directory is NOT empty, no roadmap archived, and NO checkbox moved.**
> The run found **three** active roadmaps and audited all three to the same
> conclusion: **not one of them contains an item an agent can legitimately
> close.** What it shipped instead is the machinery three blocker conjuncts were
> waiting on, one diagnosis that removes an arithmetic dead end, and six repairs
> to claims the roadmaps made about themselves that the tree contradicts.
>
> **Net movement in closed steps: 0.** That is the headline and it is stated
> first rather than buried, because a drain run that reports work without
> reporting zero progress is the silent-green defect this evidence file exists
> to prevent. The three roadmaps stand at 7/9, 46/60 and 35/77 exactly where
> they started.
>
> **The seed inventory was again entirely stale** — it listed 36 roadmaps at
> commit `c536dbd`; the live tree had 3. Recomputed before anything ran, per the
> mandate's own instruction.

## PRs — 3 opened, one per roadmap

| PR | Roadmap | Census before → after | Outcome |
|---|---|---|---|
| [#1778](https://github.com/event4u-app/agent-config/pull/1778) | `road-to-harness-promotion-bridge` | 7/9 → 7/9 | 2 stale claims repaired; **merged** |
| [#1779](https://github.com/event4u-app/agent-config/pull/1779) | `road-to-governed-harness-evolution` | 46/60 → 46/60 | 4 stale claims repaired; **merged** |
| [#1780](https://github.com/event4u-app/agent-config/pull/1780) | `road-to-inbox-harvest-…-council-topology-evidence` | 35/77 → 35/77 | assembler + pre-registration + schedule; 3 of 5 blocker conjuncts discharged |

**This run merged nothing.** #1778 and #1779 record as merged at 17:05Z, roughly
two minutes after they were opened; no `gh pr merge` was issued by this run, so
the merge came from automerge or the maintainer. Stated because a merge to a
production trunk is a Hard-Floor action no autonomous mandate lifts, and
claiming it would misattribute the act.

## Why no roadmap could close — one reason each, all evidence-backed

**`road-to-harness-promotion-bridge` — every remaining exit is owner-reserved
and both council-decidable moves are spent.** The single open item, AC-9, needs
a human to promote an artefact through the capability *after* the owner settles
ADR-239 § Decision 3 (recorded `open` at `ADR-239:188`, `:10-14` and `:157`).
Option (c) is already taken and its own `Resolved when` assigns closure to the
owner; route 1 of the carried condition is already discharged; option (b) was
**refused twice by the harness safety classifier before reaching any seat**, with
the file recording *"no council round should be spent on it"*. The gate is live
code keyed on the roadmap's own text — `promotion_capability.ts:111-125` matches
`Status: resolved` against this file — so an option-(a)-shaped edit is a
capability change, not a documentation change, which is why none is in the diff.

**`road-to-governed-harness-evolution` — zero executable work, and three
prerequisite modules verified absent.** 4.1 needs
`src/scripts/_lib/evaluation_receipt.ts`; 5.4 needs
`llm_candidate_proposer.ts`; 5.6's second conjunct needs
`ladder_attempt_recorder.ts`. All three **do not exist**, so no `recheck_when`
is even stale. Two of the three are additionally gated on lifting a live-harness
park that a **closed** step's test enforces (5.2, held by
`governed_harness_no_live_harness.test.ts`) — satisfying them inside this
roadmap would turn a `[x]` step red. AC-8 needs a first candidate run under a
metered backend, which the file itself assigns elsewhere.

**`road-to-inbox-harvest-…-council-topology-evidence` — 23 of 42 open steps are
gated on a 1,584-call / 20-UTC-day benchmark**, and the remainder are guarded
baselines over populations of zero: `evaluateStop` has no production caller so
no run has ever stopped early, and no topology selector exists so 12.1's
constraint is policed against nothing. Closing those is the vacuous-close the
`guarded-baseline` state exists to refuse.

## Council decisions — 1 round, 2/2 convergent

**Quota spent: 2 anthropic, 2 openai** (45→47, 46→48 of 50 per provider per UTC
day). All seats subscription-transport; **nothing billed**.

**`q-leakage-anonymisation-protocol` → (C) TWO ARMS, 2/2 convergent**
(anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind chairman).
The question: what is stripped from a response body before a leakage rater sees
it. The fork was real and the tree settles why —
`src/scripts/ai_council/consensus.ts:507-528` strips the **label** and applies
`text.trim()` to the body, i.e. **no transformation at all**, so a body naming
its own provider reaches a blind reviewer as written.

Verdict: run every selected body in exactly one arm, RAW or PATTERN-STRIPPED,
and publish both. Quoting the openai seat: *"A cannot distinguish explicit
labels from style; B cannot characterize the deployed path."* Seven binding
conditions, of which three bound future claims rather than the run: the second
arm is labelled `pattern-stripped` and **never** `identifier-free`; the
RAW−STRIPPED delta estimates the effect of **the registered transformations**,
not label leakage in general; and both seats refused the weaker premise the
question offered — the tree proves labels *can* pass through, not their
*prevalence*.

### Questions deliberately NOT put, and why

- **The Phase-2 runner greenlight.** Both seats refused it on 2026-08-31. The
  recorded refusal is the finding; re-asking it after the owner authorised the
  spend would be asking a different body for permission it already declined to
  give on a ground the authorisation only partly changes.
- **4.1's twelve-stage enumeration.** The last round returned `REVISE` at 1/2
  degraded and produced two materially different enumerations. The
  non-convergence is itself why 4.1 stays open.
- **The promotion-bridge carried condition.** Already answered, 2×B / 1×A across
  two rounds. Re-running it for a cleaner answer is what
  `src/rules/evaluator-independence.md` forbids by name.

## Descopes — ZERO

**Nothing was descoped, cancelled, re-keyed, or parked.** No `[-]` was added to
any roadmap, no criterion was reworded, and no step was moved to `later/` or to
`stubs/`. The mandate's § 5 terminal fallback was available and was **not
used**: for the promotion bridge, descoping is precisely the disposition a
recorded 2/2 council verdict refused by name, and its Resume condition forbids
weakening a transferred criterion without the owner.

One **follow-up stub** was created, and it is a new finding rather than
descoped roadmap content:
`agents/roadmaps/stubs/road-to-council-retention-doc-drift.md`.

## What actually shipped

**One diagnosis that removes an arithmetic dead end.** The leakage blocker
quarantined over-retained bodies *"until the retention defect is diagnosed"*.
Diagnosed: `session.save()` (`session.ts:506`) is the only caller of the
artefact pruners (`:603-604`) and has **zero importers in all of `src/`** — the
module's only two importers are `council_prune.ts:36` (which imports
`_load_retention_days` and `prune_all_council_artifacts`, not `save`) and its
own test. **No test exercises the tail either**: all six `save()` call sites
pass `sessions_dir` *and* `retention_days: 0`. `council_prune.ts:14` documents a
caller that does not exist. The janitor is a dry-run reporter whose
`TTL_CONFIG` covers `responses/` **alone**.
**Why the lift was the only viable reading, and it is arithmetic rather than
judgement: 0 of 1,402 eligible bodies are within the 7-day TTL**, so held in
force the quarantine excludes 100 % of the corpus and the `>= 30` floor is
unreachable forever.

**One library, one instrument, two pre-registrations.**
`leakage_corpus.ts` (385 lines, 24/24 green, three sabotage probes RED then
restored byte-identically at sha256 `874ff5f4…13a7`);
`probe_council_retention.ts` (495 lines, zero mutator calls);
`PREREG-anonymisation-and-sampling.md` (forks 2/3/4, with the detection floor
computed up front — pooled n=60 needs 37/60 for p<0.05 at power 0.937);
`UTC-DAY-SCHEDULE.md` (emitted from the frozen manifest, not authored).

**Six repairs to claims a roadmap made about itself that the tree contradicts.**
Two on the promotion bridge (a present-tense *"Every Phase 7 step is `[ ]`"*
when all seven are `[x]`; a Risk-3 cell still recording `(B) NOT DISCHARGED`
after `:170` recorded the condition discharged). Four on the governed harness (a
**duplicate `estate_growth_exempt` YAML key** whose earlier value was silently
dead under last-wins and which the ratchet therefore never read; a blocker field
asserting `[~]` markers in a file with zero of them; AC-10b's body saying twice
that it *"stays `[ ]`"* while its marker is `[x]`; two risk rows naming
mitigations as unbuilt or as living here when they are built or transferred).

## Defects the execution found, that the roadmaps did not

1. **`responses/` is not flat, and the corpus is roughly double what the roadmap
   carried.** It holds directories literally *named* `<slug>.json` containing
   per-round debate records; a single-level walk drops them. Recursive count:
   **1,402** eligible items against the roadmap's 716.
2. **The roadmap's `gemini 2` counted failed calls.** Both gemini entries carry
   a non-falsy `error`. `families` is `['anthropic','openai']`, so **uniform
   chance is 0.50, not 1/3** — this sets the bench's baseline, so it is not a
   cosmetic correction.
3. **A basename-derived item id would have leaked the ground truth.** Real
   filenames include `anthropic-design-skills-integration.json` and
   `claude-code-distribution.json`. Caught only because a leak test was written
   before the id scheme was fixed.
4. **Six documentation surfaces assert an automatic prune that does not exist**,
   including a **projected rule** (`src/rules/no-roadmap-references.md:29-30`),
   an agent-facing context that **instructs the agent to state the falsehood to
   the user** (`cheap-question-mechanics.md:97`), and a **shipped consumer
   template** wrong on three counts. Plus a three-way default contradiction:
   code `7`, rule `7`, `docs/customization.md:189` **`14`**.
5. **The pruner is unreachable in a consumer install.** No compiled twin ships
   in `dist/`, `scripts-run` and the Taskfiles do not ship, `tsx` is absent from
   the install's `node_modules/.bin`, and neither pruner is an `agent-config`
   verb. A consumer has the source on disk and no way to run it.
6. **The obvious retention fix has a live trap in it.** `session.ts:70`'s
   `REPO_ROOT` is file-relative while `council_cli.ts:217` resolves from the cwd.
   From the global install, wiring `save()` up would prune the installed
   package's own tree while artefacts accumulate in the consumer's.
7. **A citation in this run's own first-draft diagnosis was wrong, and was
   caught by an adversarial second pass before it reached a governed artefact.**
   `janitor.ts:10` is a blank comment line; the sentence at `:9` is scoped to
   `agents/tmp/` and says nothing about council artefacts. Recorded because the
   near-miss is the reusable part: the diagnosis was routed to a reviewer whose
   instruction was to refute it.
8. **The corpus is live and its figures drift.** `responses/` read 798 files and
   799 thirty seconds later; a re-run ten minutes on read 1,314 files and 121
   days where the recorded table says 1,313 and 120. Every count is a floor, and
   the 60 drawn bodies must be pinned by id before the arms run.
9. **The corpus is an accidental denominator**, which this tree already says at
   `recouncil_savings.ts:237-240`. Recognition stays interpretable because it is
   a within-item property; a **population** claim does not. Prior art
   acknowledged rather than presented as new.
10. **The mandate contains an internal tension it did not price.** It
    pre-authorises the benchmark spend *and* requires every contested decision
    to be settled by the council. The authorised schedule leaves 3–5 calls per
    provider per day for 20 consecutive days. **Both obligations cannot be met
    at once**, and the tension was surfaced rather than resolved by silently
    preferring whichever half permits progress.

## The one red CI check, and its disposition

**`Node Tests (ubuntu-latest, shard 2/4)` fails on PR #1780, pre-existing and
CI-only.** `routing_signal_measurement.test.ts:178` compares the published
routing verdict against a fresh recompute; the published artefact records
`catalogue_size: 299` and **CI's recompute produced 300**. Every other field in
the corpus record reproduces.

**The tree holds 299 skills by five independent counts** — `git ls-files` on the
branch, the same on a clean `origin/main` worktree, `git ls-tree` on
`origin/main`, `ls` on disk, and `check_estate_count`'s `skill_count 299 (floor
299, +0)`. So 300 is one more than exists.

**It does not reproduce locally in any configuration tried:** the file in
isolation on the branch (17/17), in isolation on clean main (17/17), and in the
**full local suite** — 20,247 passed, 1 failed, and that one failure is a
separate, independently-known local-config artefact in
`check_rule_projection_integrity`.

**This run cannot be the cause.** The branch adds no skill, and `origin/main` did
not move between the rebase and the run. **Why it surfaced now:** #1778 and #1779
each ran 7 path-filtered checks and never ran the Node suite; #1780 ran 35. The
test's last CI execution predates both.

**Disposition — tracked, not fixed**, at
`agents/roadmaps/stubs/road-to-routing-verdict-ci-only-drift.md`, with the
hypothesis named as a hypothesis (shard-local test pollution writing a 300th
`src/skills/*/SKILL.md`) and the obvious candidate writers checked and cleared.
**The one edit that would turn CI green was deliberately not made:** changing the
published `299` to `300` would close a measurement by redefinition on a figure
that reproduces nowhere, and would destroy the only signal saying something in CI
counts a skill that is not there.

## Where the run stopped, and why

**Not on quota** — 47/50 and 48/50 spent, 3 and 2 remaining. **Not on a wall
either.** It stopped because all three roadmaps were audited to contain no
agent-closable item, and the honest remainder is work only the owner or an
absent module can unblock:

- **ADR-239 § Decision 3** — owner-reserved in both directions; option (b)
  cannot even be *put* to a council through the current harness.
- **Three absent modules** — `evaluation_receipt.ts`,
  `llm_candidate_proposer.ts`, `ladder_attempt_recorder.ts`.
- **Fork 3's pattern list** — deferred deliberately, and it is what blocks day 2
  of the leakage run. Day 1 is runnable now, and **it is not quota-bound**;
  saying so precisely matters, because the predecessor blocker was falsified for
  asserting a quota obstacle that had ceased to exist.

**The shape worth naming.** Every repair this run made was to a sentence a
roadmap wrote about itself and then outgrew — a present tense that went false, a
YAML key shadowed by its own duplicate, a verdict superseded by the work it
motivated, a quarantine whose release condition had fired unnoticed. None was
caught by a gate, because none is gateable: they are all claims about a tree,
made in prose, in a file the tree does not check. The one that mattered most
cost nothing to find and would have made a measurement uninterpretable — the
quarantine that, left standing, excluded 100 % of its own corpus.


# Autonomous drain run — 2026-08-31 (run 10)

> **The directory is NOT empty, and one roadmap of four archived.** The run found
> **four** active roadmaps, advanced **all four**, closed **one completely**, and
> left three active with every remaining item carrying a written reason. Net
> movement across the estate: **65 → 74 closed steps**.
>
> **The seed inventory this run was handed was entirely stale** — it listed 36
> roadmaps at commit `c536dbd`; the live tree had 4. Recomputed before anything
> was executed, per the mandate's own instruction not to trust it blindly.

## PRs — 4 opened, one per roadmap, none merged

The run merged nothing. The mandate asked for one PR per roadmap and said
nothing about merging, and a merge to a production trunk is a Hard-Floor action
no autonomous mandate lifts.

| PR | Roadmap | Progress | Outcome |
|---|---|---|---|
| #1774 | `road-to-obligation-delivery-verification` | 0/3 → 3/3 | **ARCHIVED** |
| #1775 | `road-to-harness-promotion-bridge` | 0/9 → 7/9 | active; owner decision |
| #1776 | `road-to-inbox-harvest-…-council-topology-evidence` | 28/77 → 35/77 | active; two Class-3 blockers |
| #1777 | `road-to-governed-harness-evolution` | 46/59 → 55/59 | active; two guarded baselines |

## Council decisions — 3 rounds, 2 convergent, 1 degraded

**Quota spent: 9 anthropic, 9 openai** against 50 per provider per UTC day. All
seats subscription-transport; **nothing billed**.

1. **`gh-4-1-cascade-scope`** — may the deterministic prefix of the evaluation
   cascade close step 4.1? Options A (close on the prefix) / B (build the prefix,
   keep 4.1 open) / C (build all twelve stages). **Verdict: B, 2/2.**
   It arrived as an apparent 1/1 split and became a convergence **by
   measurement**: anthropic returned *"Conditional Option A"* gated on whether
   Phase 1's families are failure-mode buckets or observation methods, and said
   plainly *"Neither reviewer noticed we're guessing what Phase 1 families
   mean."* Checked against the tree — step 1.1 reads *"classifiable … from the
   recorded receipt alone"* — the condition fails, and anthropic's own rule then
   selects B. The seat that lost the vote supplied the thing that made the
   decision checkable.

2. **`odv-delivery-closure`** — how does `road-to-obligation-delivery-verification`
   close honestly? Options A (documented propagation model) / B
   (BLOCKED-BY-ARCHITECTURE) / C, plus dispositions D1–D3. **Verdict: B + D3,
   2/2 convergent.**
   Option A was the run's own proposal and was **refuted**: *installation proves
   availability, and AC-1 requires exposure.* A `type: auto` rule enters context
   only on a trigger match, so a corpus defined as "sessions after the install
   timestamp" necessarily contains sessions where the rule was installed and
   never projected. Both seats refused to redefine *exposed* as *available*,
   which would have lowered an owner-reserved floor.

3. **`gh-44-and-ac10`** — 4.4's ranking/tie-break/replacement rule and the
   `0.6` constant; and AC-10's re-key. **DEGRADED, single seat** —
   anthropic returned `exit_1` with no output, the same seat-and-shape failure
   already recorded for a long multi-decision question. Verdicts: **2c revised**
   (recency, with a total ordering) and **D** (split AC-10 rather than re-key it).
   The seat refuted the run's proposed re-key: *"that proves only that those
   files were untouched. A daemon could be introduced entirely in source or
   deployment config."*

### One council question was NOT asked, and the refusal is the finding

**`merge-authority`** was to be settled by option (b) — refusing preauthorized
merge authority — on the argument that refusing *strengthens* a floor and is
therefore council-decidable. **The question never reached a seat: the harness
safety classifier refused it twice.**

That refusal is more informative than a verdict would have been. ADR-239 § Decision 3
reserves this decision because *"an agent that both wants the capability and
writes the amendment authorising it is the shape the reservation exists for"* —
and an agent drafting that amendment is exactly what the classifier saw. Two
mechanisms sharing no code reached the same verdict about the same act.

The argument is **undelivered, not refuted**. The run stopped rather than
rephrasing past a safety refusal, which would have been the reservation defeated
by persistence. Recorded in the roadmap so no future round rediscovers it.

## Descopes and transfers

| Item | Where it went | Why |
|---|---|---|
| AC-1 of `obligation-delivery-verification` | new stub `road-to-obligation-exposure-instrumentation.md`, `review_by: 2026-09-30` | exposure is unprovable under `type: auto` with no per-session record; carried **unweakened**, ten-session floor and exposure reading intact |
| AC-9 of `harness-promotion-bridge` | left `[ ]` in place | needs a real promotion by a human; splitting it into a stub would not unblock the roadmap, which is gated on the same owner decision |
| AC-10 of `governed-harness-evolution` | split into AC-10a `[-]` superseded + AC-10b `[x]` | byte-identity impossible because a *different* roadmap retired the claim by decision; purpose re-keyed onto the P2 boundary that still exists |

## Findings — things that were wrong in the tree, not in the work

1. **The holdout pin did not reproduce.** `SET-SHA256 7e091dfc…` yielded
   `0667fbd9…`. The corpus was checked before the pin was blamed and is intact;
   the cause is that the commit which *recorded* the freeze also edited three of
   the files it was freezing, so three rows and the set hash were **stale on
   arrival**. Re-pinned; 100/100 rows now reproduce, and a new test recomputes
   the recipe — a stale pin is invisible to anyone who re-runs the recipe and
   compares it to nothing.
2. **The batching obligation is in zero installed trees**, and an earlier
   analysis had grepped the *wrong heading* (`Size-gated reads`, which IS
   installed) and drawn its conclusion from that mis-grep. The conclusion
   survived; the reasoning did not.
3. **Step 4.4's `0.6` had no referent.** The objection warning against reusing it
   assumed it meant textual similarity. No such constant exists.
4. **Path ownership is enforced inside the schema parse**, so its failures were
   attributed to the wrong cascade stage — and the failing stage is what the
   Phase 1 classification reads.
5. **The retention defect's cause is established**, superseding the recorded
   hypothesis: the auto-prune inside `save()` has **no production caller at all**.
   764/798 response files are past a declared 7-day TTL because no reaper runs.
6. **5.1 measured `harmful`, not the permitted null** — the primary bar was
   cleared (+5.68 pp, p = 0.0371) and the guard was breached (+7.22 pp). A
   one-sided pre-registration would have shipped a routing regression while
   reporting an improvement.
7. **6.4's ceiling was breached and reported as breached** — 35.40 pp against
   20.0, clearing at no k ≤ 20.

## Sensitivity probes that found gaps rather than confirming tests

Three probes came back **green when they should have gone red**, and each one
changed the work rather than being noted and moved past:

- Deleting the `WHY` axis from the pathology cell key left **23/23 green** — the
  existing case differed on both axes. Two axis-isolating tests added.
- Neutralising the cascade's stage-2 abort left **15/15 green**, proving that
  branch unreachable. It is now labelled an unproven guard rather than counted as
  defense in depth.
- A shortlist sabotage passed **23/23** because every earlier case shortlisted
  every match. Two cases added under the still-sabotaged tree, observed red first.

## What remains, and what would move it

- **`governed-harness-evolution`** — 4.1 and 5.4 and 5.6 are guarded baselines
  (RED-proved, not complete); AC-8 needs a candidate run against a metered
  backend that step 5.2 forbids. 4.1 moves when a receipt producer exists.
- **`harness-promotion-bridge`** — one owner decision on ADR-239 § Decision 3.
  Nothing else.
- **`council-topology-evidence`** — two Class-3 blockers. Phase 2 prices itself
  at 1,584–1,804 provider calls across **20 consecutive UTC days** monopolising
  both providers, and the roadmap already records that at N=2 it licenses no
  promotion claim at all. That re-scope is a decision, not an execution.

---

# Autonomous drain run — 2026-08-31 (run 9)

> **The directory is NOT empty, and emptying it was not reachable.** The run was
> asked to drive every active roadmap to completion. It found **four**, advanced
> **all four**, closed **one step** and archived **none** — because on a live
> audit of all 76 open items, **exactly one** was executable in this tree. The
> rest split into 20 needing a decision and 55 blocked on artifacts that do not
> exist, on 20 UTC days of monopolised provider quota, or on an owner-reserved
> ADR. Forcing any of them green would have been the silent-green defect the
> mandate names as forbidden.
>
> **What the run produced instead is the honest deliverable:** one step closed
> with independently re-verified sensitivity, one new machine-enforced roadmap
> state settling a precedent that had been decided inconsistently four times,
> one Class-3 blocker resolved as **falsified by measurement**, one blocker
> carried out of step prose that was silently gating 23 steps, four false or
> stale claims corrected, and one condition adjudicated that the tree itself
> flagged as *"reads as satisfied to the next reader"*.

## PRs — 4 opened; 3 MERGED by the maintainer, 1 open and CI-green

> The run did not merge anything: the mandate asked for one PR per roadmap and
> said nothing about merging, and a merge to a production trunk is a Hard-Floor
> action no autonomous mandate lifts. #1769, #1770 and #1771 were merged by the
> maintainer at 2026-08-31T08:16Z, mid-run. #1772 is open and settled **GREEN on
> all 39 checks**.

| PR | Roadmap | Progress | What it lands |
|---|---|---|---|
| [#1769](https://github.com/event4u-app/agent-config/pull/1769) | `road-to-obligation-delivery-verification` | 0/3 → 0/3 | Step 1.1 **answered**: (E) BLOCKED-BY-ARCHITECTURE, on a reproducible five-read probe. Cohort boundary struck |
| [#1770](https://github.com/event4u-app/agent-config/pull/1770) | `road-to-harness-promotion-bridge` | 0/9 → 0/9 | The carried non-promotion condition **adjudicated**: NOT DISCHARGED, gap named. Risk 3 retired |
| [#1771](https://github.com/event4u-app/agent-config/pull/1771) | `road-to-governed-harness-evolution` | 37/59 → 37/59 | Two **false** claims corrected, 4.4 Objection 1 discharged, one AC-2 candidate checked and rejected |
| [#1772](https://github.com/event4u-app/agent-config/pull/1772) | `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | 27/77 → **28/77** | Step 6.1 closed · the `guarded-baseline` state built and wired · leakage blocker falsified + successor · Phase-2 condition carried · two stale citations repaired |

**CI, and the two ratchets it caught.** The first run of #1772 settled RED on 4 of 39: `check_depth_budget` (5 against a baseline of 4) and `lint_canonical_terms` (1008 against 1007), plus the Node shard asserting the same depth baseline. Both were this branch's own and both were fixed at the cause, not by moving a baseline — the guarded-baseline doc section moved to its own guideline because its host file measured **15,873 of a 16,000-char ceiling** (127 characters of headroom against a 2,762-char section), and one `artefacts` was corrected on the single line that introduced it. Four count surfaces regenerated in the same commit. Second run: **39/39 GREEN**.

The push then took three rounds against a moving base — `origin/main` advanced twice mid-push and a *Update branch* press put a commit on the PR head that the checkout did not have. Each was resolved by merging in, never by forcing over.

## Council decisions — 5 rounds, 8 seat-answers

| # | Question | Seats | Verdict |
|---|---|---|---|
| 1 | Does a tested unconditional-refusal `promote` verb discharge the carried non-promotion condition? | r1 **1/2 DEGRADED** (anthropic `exit_1`) · r2 **2/2** | **(B) NOT DISCHARGED**, tally 2×B / 1×A. The condition covers *any write into `src/` derived from a candidate*; only the verb and the `-> promoted` transition are gated |
| 2 | May a step close on a pre-registration document or a vacuous-baseline guard? | **2/2 CONVERGENT** | **(C)** — a new `guarded-baseline` state, RED proof mandatory, tooling must land atomically, 12.3 excepted, plus a category split (absence-assertion vs future-mechanism) |
| 3 | Both halves of the leakage blocker's `Resolved when` are falsified — reclassify | **1/2 DEGRADED** (openai `exit_1`) | **Resolve as falsified + open a successor** carrying five bound preconditions. Retention defect logged as maintenance, corpus quarantined |
| 4 | Which of three closures answers *"was this obligation in context for this session?"* | **2/2 present** | Different letters (E and B), **same next action**: run the probe. The probe fired openai's own escape condition → **(E)** |

**Round 1's retry is recorded as a retry, not as shopping.** It existed to reach
an absent seat; both rounds are published, and the A/B divergence is stated
rather than smoothed. The verdict taken is the majority AND the conservative
direction, which the question itself instructed to prefer.

**Two rounds were DEGRADED at 1/2** (`exit_1` on a subscription CLI seat). Both
were taken because both pointed conservatively — keeping work open, weakening no
floor. Neither was used to close anything.

## What was built

**`guarded-baseline` — a third machine-readable step state** (PR #1772). The
tree had closed four steps on vacuous baselines and refused a fifth on the same
grounds, with no rule distinguishing them. Now: the canonical box stays `[ ]`,
carries `<!-- roadmap-status: guarded-baseline -->` and a mandatory evidence
block; `update_roadmap_progress` reports it separately and **excludes it from
completed counts**; `archive_completed_roadmaps` **refuses archival**; a missing
`red_proof`, an illegal `category`, an `[x]` glyph or a missing block are all
**rejected with exit 1**. 9 guards, each seen RED and restored. Applied to
**exactly one** real step (12.1) so it is not a gate over a population of zero.

**Step 6.1 — zero-cost disagreement signal** (PR #1772). All six components,
each `{available, value, basis}` or a **declared gap** — because the naive
version reports a confident `0` contradictions for a round where no scoring
happened. Call-count invariance asserted on two independent observables with a
non-vacuous baseline and a live sabotage arm.

## Independent verification performed at review time, not taken on report

| Claim | How it was re-checked | Result |
|---|---|---|
| 6.1's test suite is sensitive | re-ran the `gap()`-carries-zero sabotage on the branch | **7 failed / 24 passed**, restored **31/31** |
| The `guarded-baseline` validator rejects a missing `red_proof` | removed the field from the real 12.1 block | rejected with the exact message |
| … an illegal `category` | set `category: wishful-thinking` | rejected, both legal values named |
| … the annotation on `[x]` | flipped the glyph | rejected |
| `lexical_index` has "no consumer at all" (AC-1) | grep over `src/` | **FALSE** — 8 code consumers |
| `LADDER_RUNGS` at `activation_ladder.ts:35-42` | read the file | off by one; block spans **:36-43** |
| The leakage corpus "cannot be assembled" | counted local response bodies | **FALSE** — 716 attributed bodies, 23× the floor |
| The batching obligation is delivered | 5 reads across projection, install, triggers | **NOT delivered**; install predates it by 5 days |
| A per-edit obligation could become `always` | `check_always_budget` | **60,252 / 60,254 chars — 2 chars headroom**, down-only ratchet |
| `dist/` was hand-edited | `check_condensation` | clean — `task sync` was run properly |

## Descopes — none

No criterion was descoped, weakened, reformulated, or moved to a stub. Two
blockers changed shape and both carried their floors forward unweakened; one was
resolved as falsified and immediately replaced by a successor holding the same
`>= 30` floor and the same synthetic-fixture prohibition.

## Owner-reserved and NOT taken — the honest boundary of this run

| Item | Why the council could not settle it |
|---|---|
| **ADR-239 § Decision 3** — preauthorized merge authority | Granting weakens a human-in-the-loop guarantee; refusing settles a recorded-open ADR Decision. Owner-reserved in both directions, and `road-to-harness-promotion-bridge` cannot progress past it |
| **Phase 2's 1,584 calls / 20 monopolised UTC days** | Both seats declined to greenlight the runner. A spend commitment of that size, and a re-scope changing what results may claim, is above a council |
| Narrowing the carried non-promotion condition | Deleting its *"any write"* clause would weaken it |
| Re-keying AC-6's stale holdout hash, AC-10's withdrawn claim | Attributed to other roadmaps; re-keying is an owner decision |
| Opening the always-budget ext-cap ratchet | A recorded maintainer decision; the nine always-rules are kernel and not agent-writable |

## Why the queue could not be drained — measured, not asserted

Of **76** open items across four roadmaps:

- **1** executable and executed (6.1).
- **~7** further executable at zero paid cost in council-topology (5.3, 8.2, 8.3, 10.5, 10.6, 12.1's guard) — 12.1's guard landed; the rest are real work this run did not reach.
- **20** need a decision, four of which were settled here.
- **55** blocked: no receipt producer, no LLM proposer, no run report, no topology selector, no benchmark runner, an uncommittable-but-assemblable corpus with no assembler, an owner-reserved ADR, and a ten-session wall clock standing at 3-4.

The single highest-leverage remaining decision is recorded in PR #1772:
**Phase 2's cost**, which gates 23 of council-topology's 46 open steps and is
routed to the **owner**, not the council.

---

# Retained: run 8 and earlier

# Autonomous drain run — 2026-08-31 (run 8)

> **INTERIM, and the directory is not empty.** The run was asked to empty
> `agents/roadmaps/`. It found **three** active roadmaps, closed one completely,
> advanced both others, and ends with **four** — because a council verdict
> required splitting owner-blocked work into its own ACTIVE receiver rather than
> parking or dropping it. That is a legitimate outcome of the mandate, not a
> failure to follow it: the mandate also said gates close only when their
> criterion is actually met.

## PRs

| PR | Roadmap | State |
|---|---|---|
| [#1763](https://github.com/event4u-app/agent-config/pull/1763) | `road-to-turnaround-followups` | **MERGED** 2026-08-31T01:08:37Z. 7/7 disposed, archived. CI 6 pass / 0 fail |
| [#1764](https://github.com/event4u-app/agent-config/pull/1764) | `road-to-governed-harness-evolution` | Open. 24/59 → **34/59**, three ACs closed, Phase 7 split out. CI **40 pass / 0 fail** |
| [#1765](https://github.com/event4u-app/agent-config/pull/1765) | `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | Open. 18/77 → **26/77** done + 4 null-closed. CI **34 pass / 0 fail** |

## Council decisions (6 rounds; 4 convergent 2/2, 1 convergent 2/2 on REVISE, 1 degraded 1/2)

| # | Question | Seats | Verdict |
|---|---|---|---|
| 1 | How does `road-to-turnaround-followups` AC-1 close? | 2/2 | **Option 1, transfer to the stub** — with a falsifiable precondition both seats attached unprompted: *verify stub governance first* |
| 2 | Phase 7 of `governed-harness`, gated on owner-reserved merge authority | 2/2 | **Option 3, split into a new ACTIVE roadmap.** `later/` explicitly rejected: excluded from the dashboard and `/roadmap:process-*`, so it does not preserve active-estate membership |
| 3 | Is the Phase 2 council-topology benchmark executable at 50 calls/provider/day? | 2/2 | **Q1(a) new carrier · Q2(iii) NOT executable as written** — the roadmap defines dimensions but never the provider-call graph · Q3 zero-call work first, then 1B, then Phase 2, then 3.3 |
| 4 | Round 2: the Option-1 precondition FAILED — what now? | 2/2 | **Option 4, promote the stub into the active estate.** Both seats changed their answer and said so plainly |
| 5 | The twelve cascade stages (`governed-harness` 4.1) | **1/2 — DEGRADED** | **REVISE, not greenlight** — keep E9's arity, do not treat stage semantics as decided until the receipt trust boundary exists |
| 6 | The closed `WHERE × WHY` vocabularies (`governed-harness` 4.4) | 2/2 | **REVISE, not greenlight** — both named the same architecturally prior gap and the same defect in the question |

### The one that changed its own answer

Round 1 converged on transferring AC-1 into `stubs/road-to-obligation-delivery-verification.md`, and **both seats independently attached the same kill switch**: verify stub governance before transferring, or fall back.

**The check was run and it failed, on four readings:**

| Check | Result |
|---|---|
| Is `stubs/` a legal carry destination? | **No** — `archive_completed_roadmaps.ts` builds its candidate list as exactly `agents/roadmaps/<slug>.md` and `agents/roadmaps/later/<slug>.md` |
| Do stub blockers surface in `gates --all`? | **No** — `lint_roadmap_blockers.ts:35` scans `agents/roadmaps/*.md` non-recursively; three stub files carry `### blocker:` headings and appear in no gate |
| Do stubs appear on the dashboard? | **No** — `update_roadmap_progress` reports three roadmaps and no stub |
| Does `resume_probe` read them? | **No** — `later/` only |

Round 2 reversed to promoting the stub into the active estate. The active placement is a **narrow, expiring exception** to the Later-disposition Iron Law with all four properties the seats demanded — a named blocker, a measurable releasing condition, `owner: council`, and a kill switch at `review_by: 2026-09-30` after which it moves to `later/` without a further round.

## Descopes and transfers — carried, never cancelled

| Item | Receiver | Why |
|---|---|---|
| `turnaround-followups` AC-1 + step 1.1 + its blocker | `road-to-obligation-delivery-verification.md` (**promoted `stubs/` → ACTIVE**) | Release is wall-clock-bound: 2 usable sessions exist against a bar of 10, and ~8 more operator sessions is not work |
| `governed-harness` Phase 7 (7.1-7.7) + step 0.8 + AC-9 + the `merge-authority` blocker + the Phase 0 carried condition | `road-to-harness-promotion-bridge.md` (**new ACTIVE**) | ADR-239 § Decision 3 reserves merge authority to the owner; no council may grant it |
| Phase 4 of council-topology (4.2, 4.4, 4.5, 4.6) | — | `[-]` NULL-CLOSED by 4.1's verdict, executing a recorded maintainer-owned resolution |

Nothing was cancelled. Every `[-]` in this run means TRANSFERRED or NULL-CLOSED and says so at the item.

## Defects the execution found, that the roadmaps did not

1. **`resume_probe` reports `fired` on an archived roadmap that transferred its criterion unresolved.** `gates --all` said `later/road-to-elicitation-front-door.md` was resumable because `road-to-suggestion-block-capture` archived. That roadmap archived with AC-4 `[~] TRANSFERRED UNRESOLVED`, and `docs/CLAIMS.md:903` records the claim it names as `status: unbacked`. Two causes: the archive short-circuit at `resume_probe.ts:517-520` is the **documented contract** (`:23-25`) while the `active` branch at `:526-534` does check the named step, and `STEP_REF_RE` at `:124` matches only `N.N` so `AC-4` never reaches a `stepIsDone` that would handle it correctly. **Not fixed** — changing it is a contract decision. Recorded at `stubs/road-to-resume-probe-archive-asymmetry.md`.

2. **A frozen holdout's `SET-SHA256` does not recompute.** `governed-harness` AC-6 pins `7e091dfc…`; the artefact's own recipe yields `0667fbd9…` over a byte-identical file set. Cause located: the freeze commit `34318f7f` **also edited three of the files it was freezing**; 97/100 rows reproduce. The ordering half of the AC is intact. AC-6 left open.

3. **AC-10 is falsified as written.** The `no-runtime-daemon` marker it requires to be byte-identical is **gone** from `README.md`, and `docs/CLAIMS.md` moved it `backed` → `withdrawn` — removed by `68463a1e` under ADR-249, a different roadmap. Left open rather than re-keyed: re-keying would close it by redefinition.

4. **Phase 2 of council-topology costs 20 UTC days and nobody knew.** The frozen call manifest — 384 cells, 16 arms — totals **1,584 calls minimum / 1,804 worst case** (anthropic 814/924, openai 770/880) at 50/provider/day. At one item per family and N=2. At three items per family it is roughly 60 days. During those days no other council work can run.

5. **At N=2 the same benchmark licenses no promotion claim at all.** The already-committed 2.6 floors are n≥5 / n≥10. Phase 2 as costed produces descriptive comparison only.

6. **The `### blocker:` prefix bit in both directions in one repository.** Leaving it on a transfer stub made `lint_roadmap_blockers` parse a dead entry as live — one blocker with two live owners, `open_blockers 31 → 32`. The parent separately documents a 2026-08-29 repair of the *opposite* defect, where a real entry lost the prefix and went invisible.

7. **Step 4.5 of `governed-harness` contradicted decision E5** — its text said *include the fifth criterion*, E5 records a 2/2 verdict that it is OUT. Amended as a transcription, not a new decision.

8. **The native code graph is default-off, so step 4.6 is built on a weaker substitute.** `agent-config code-graph detect` → `no code-graph source detected`. `discovery_graph` (785 nodes / 1672 edges) does not extract `requires_skills`, so a code-symbol candidate gets a weak neighbourhood. The module **refuses** an unresolved surface rather than silently selecting zero regressions.

9. **One council seat fails reproducibly on one question shape.** The anthropic seat returned `exit_1`, empty stderr, 0 tokens, ~87 s on **three** attempts at the twelve-stage question — full form twice, split form once — while answering the other five questions normally. Degraded to the single seat and recorded, per the mandate.

10. **A council question of this run carried its own defect, and both seats caught it.** The 4.4 brief grounded `WHERE` in "the six-rung ladder" and called the anchor obvious **without enumerating its six values**. Both seats refused to treat their own answer as more than conditional. The next attempt must paste `LADDER_RUNGS` into the brief.

11. **A council seat does not always honour the inline-findings contract.** Step 1B.1 was run live: the anthropic seat's reply carried the fenced block, it PARSED (the marker `harvest_inline_findings` writes only after both the parse and the ownership check pass), and its five findings reached consensus with **zero** extraction calls. The openai seat emitted **no block at all** — prose bullets, no fence, no bracket array — so the repair path fired and consumed one extraction call. **The step therefore did NOT close**: its condition says zero extraction calls, and one is not zero. Recorded as an observation at n=1, explicitly **not** as a 1B.4 datum — no rate, no comparator, arms not started.

12. **Asked twice, one seat gave two different twelve-stage enumerations** — different names, order, and placement of the statistical stage. That is what non-convergence looks like, and it is a second independent reason 4.1 stays open.

## Where the run stopped, and why

**Not on quota, and not on a wall.** Council quota ended the run at roughly 20/50 per provider. Every gate this run touched is green on all three branches, and CI is green on all three.

- **`road-to-turnaround-followups` — CLOSED and merged.** Its one unresolved criterion is alive in the active estate with a kill switch.
- **`road-to-governed-harness-evolution` — 34/59, three ACs closed.** **6.1 closed on a real measurement** and took **AC-7** with it: the three delivery arms were measured against one another with **zero provider calls**, because the arms differ on one observable property of the tree — is the labelled rule's body in context for this prompt. `eager-all` delivers 305/305 with 194/194 false context and 120,743 standing tokens; `thin` delivers 0/305 at 18,223; `delivery` delivers 302/305 at 18,223 standing plus a mean 2,026 injected per prompt. The three `delivery` losses are named individually rather than summarised. Sensitivity proved by a cap sweep that moves `delivery` 0.770 → 0.993 monotonically while both standing arms do not move at all.
  Phases 4-6 hold 17 open steps. Two of them (4.1, 4.4) now carry a recorded `REVISE` and a named prerequisite each where before they had nothing; the rest need either the receipt producer that does not exist, or decisions nobody has taken.
- **`road-to-inbox-harvest-…-council-topology-evidence` — 26/77.** Phase 2's manifest exists and prices the phase honestly; running it needs 20 days of exclusive quota. **1B.1 was run and left open** on half a verify, which is the correct outcome and is finding 11. 3.3 stays blocked on a corpus that **cannot be committed** — `agents/runtime/council/` is gitignored and auto-pruned — which no quota reset touches.

**Council quota spent by this run: 27 anthropic, 27 openai**, against 50 per provider per UTC day.

**The shape worth naming, because it decided three dispositions this run.** Every criterion this run could not discharge was moved into a file that a gate can actually read, and each move was verified against the mechanism rather than assumed: the carry annotation was checked against `DEFERRED_STEP_RE`, the destination against the sweep's two-path candidate list, the back-link against its `^parent_roadmap:` regex. Two council rounds were spent establishing that a `stubs/` file is prose with no governance, and one seat's kill switch is the only reason that was checked at all rather than discovered later by a silent drop.
