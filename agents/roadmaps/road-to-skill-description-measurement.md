---
complexity: lightweight
status: ready
parent_roadmap: road-to-rule-delivery-integrity
---

# Roadmap: Measure the de-collided skill descriptions

> **Source:** the deferred half of P2.2 in
> `road-to-rule-delivery-integrity`, migrated here when that roadmap closed
> rather than archived as a loose `[~]`. The rewrite shipped; only the
> measurement is open, and it needs one human act that cannot be automated.

## Outcome (2026-08-20)

Closed against an explicit outcome state, per the framework of record in
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md)
(present in this tree; the link resolves). Every one of the four Phase 1 steps
took council disposition **B** and is **transferred** to
[`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md),
merged there with `skill-activation-window` from
[`road-to-cost-parity-1-rule-payload-diet.md`](road-to-cost-parity-1-rule-payload-diet.md)
as one gap under two names.

| Success criterion | Outcome | What was satisfied | What is transferred |
|---|---|---|---|
| A pre-rewrite baseline and a post-rewrite rate for the same fixture set and scorer | **transferred** | The instrument: `score_skill_selection` resolves 290 skills through `SKILLS_DIR = SRC_SKILLS()` (`src/scripts/score_skill_selection.ts:52`), the repoint this roadmap's Context describes, so a run can no longer emit silent zeros | Both readings. No predictions JSON exists in the tree; producing one needs a live model run behind a `/dev/tty` gate |
| The verdict cites all three pre-registered criteria and states which held | **transferred** | The pre-registration itself, unchanged and unrenegotiated — it is quoted verbatim in the stub and is the bar the sibling roadmap adopts rather than re-deriving | The verdict. Criterion (iii) is currently unsatisfiable: the corpus is **34** fixtures against a ≥ 100-request floor |
| No lift is claimed anywhere without both numbers present | **satisfied** | Held throughout, and re-checked this run: no lift claim exists in the tree. This is the one criterion a drain run can honestly close | — |
| If the outcome is `revert`, the 9 descriptions are restored | **transferred** | — | Contingent on a verdict that does not exist. The 9 rewrites stand, untouched and unmeasured |

**Archived does not mean achieved, and neither does the dashboard reading.**
Measured after regeneration rather than assumed: `roadmap:progress` renders this
roadmap as **`0 / 0 done (0%)`** with Phase 1 marked **⏭️ skipped** — 4 steps,
0 open, 0 done, 4 cancelled — and it does **not** appear in the sweep's
"completed roadmaps not yet archived" list. So the failure mode here is the
opposite of the 100 %-reads-as-success one: `[-]` renders as *cancelled*, and a
reader skimming the dashboard would conclude this work was dropped on a
judgement call. It was not. It is **transferred** — the criterion is unchanged,
unmet, and owed, with four failing probes standing behind it in the stub. Three
of four success criteria are `transferred`; only the no-unbacked-claim criterion
is `satisfied`, and it is satisfied by the absence of a claim rather than by the
presence of a measurement. **The description rewrite is still unmeasured and no
baseline exists.** Do not cite this roadmap as evidence that the rewrite worked,
and do not read `skipped` as decided-against.

**Nothing here was executable.** All four Phase 1 steps are measurement,
verdict, or publication of a verdict — none is instrument-building, so the drain
run had no buildable residue to land. The one buildable-looking item, growing the
fixture corpus to clear criterion (iii), is refused on purpose: it is "tuning the
fixtures instead of the descriptions", rank 2 in the register below, and an agent
that authored the corpus would then be grading its own paper.

**Two recorded facts moved under verification; neither changes the disposition.**
`0 skills declare a machine-matchable trigger` is **refuted** — four do
(`src/skills/merge-conflicts/SKILL.md:10`,
`src/skills/systematic-debugging/SKILL.md:11`,
`src/skills/threat-modeling/SKILL.md:13`,
`src/skills/authz-review/SKILL.md:14`); the claim was true when written, since
the schema field shipped "empty of adopters"
(`src/scripts/schemas/skill.schema.json:305`), and
`src/scripts/report_skill_activation.ts:27-28` still asserts the stale "0 of 288"
in its docstring. `6 of 288 ever invoked` is **window-dependent with a stale
denominator** — a live run today reads 5 distinct of **290** over 30 sessions,
against a 6-of-288 census over 59 sessions and a competing 4-of-288 census over
30. Host catalogue truncation is **confirmed on one host** (402 dropped,
descriptions all stripped) and single-session on the other. Full readings and
citations are in the stub.

## Context

P2.2 rewrote 9 skill descriptions discriminator-first — the census predicted 7,
the tree carried 9: `adversarial-review`, `analysis-autonomous-mode`,
`performance-analysis`, `persona-improvement`, `project-analyzer`,
`security-audit`, `sequential-thinking`, `skill-improvement-pipeline`,
`universal-project-analysis`. All are ≤ 200 chars, sibling-routing lines kept or
added, `validate_frontmatter` clean over 435 artefacts, and
`grep 'description: "ONLY '` over `src/skills` returns 0.

What is missing is the number. `score_skill_selection` is a **scorer**: it
consumes a predictions JSON (`{fixture_id: selected_skill}`) that only a live
model run produces. So no baseline can be computed locally, and the pre-rewrite
baseline is therefore **UNMEASURED** — no lift is claimed anywhere, deliberately.

**What changed since the deferral, and why the measurement is now possible at
all:** the scorer read the uncondensed legacy tree ADR-051 retired, which does
not exist. A glob over a missing directory yields nothing, so every fixture
would have scored against an empty skill set and the run would have emitted a
baseline of **silent zeros** — void, and indistinguishable from a real one. It
was repointed at the live tree via the shared resolver and now reads 289 skills
instead of 0. Until that landed, running this measurement would have produced a
confident wrong answer rather than an error.

## Goal

Produce the pre-rewrite baseline and the post-rewrite rate for the
`skill-selection-accuracy` instrument, then decide `proceed` / `iterate` /
`revert` against criteria that were fixed **before** the rewrite and are not
renegotiated by the outcome.

## Non-goals

- No new descriptions. The rewrite is done; this roadmap measures it.
- No re-derivation of the criteria. They are pre-registered below verbatim.
- No substitution of an AI rater for the human-gated run — that would break the
  pre-registration and would itself be the self-preference bias the parent
  roadmap was about.
- No use of the census's 1.4 % invocation share as the baseline. It is a
  different instrument; mixing the two is the error the parent roadmap named.

## Phase 1 — Run the instrument

- [-] <!-- blocked-by: human-gated-live-trigger-eval --> **1.1 Capture the pre-rewrite baseline.** Check out the tree state before
      the 9 descriptions were rewritten, run the live trigger-eval to produce a
      predictions JSON, and score it. This is the human-gated leg: the eval
      hard-aborts under automation by design.
      *Verify:* a baseline report exists with per-cluster hit rates (a) and (b),
      and names the tree state it was taken against.
      *Transferred 2026-08-20* — council disposition **B**, outcome `transferred`, to [`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md); merged with `skill-activation-window` as one live-trigger-eval gap.
- [-] <!-- blocked-by: human-gated-live-trigger-eval --> **1.2 Capture the post-rewrite rate** on the current tree, same fixture
      set, same protocol.
      *Verify:* both reports were produced by the same scorer version and the
      same fixture file; any difference in either is recorded, not averaged over.
      *Transferred 2026-08-20* — council disposition **B**, outcome `transferred`, to [`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md); merged with `skill-activation-window` as one live-trigger-eval gap.
- [-] <!-- blocked-by: human-gated-live-trigger-eval --> **1.3 Emit the verdict** against the three pre-registered criteria, all of
      which must hold:
      (i) the per-cluster hit rate improves by the factor pre-registered against
      **that instrument's own** measured baseline · (ii) no individual skill
      degrades by more than 20 % in isolation, so sibling-routing cannot make a
      previously-reachable skill invisible · (iii) measurement spans at least
      100 requests across at least three request shapes.
      *Verify:* the run emits baseline-vs-post rates per skill, per-skill change
      with any > 20 % degradation flagged, the overall rate with a confidence
      interval, and exactly one of `proceed` / `iterate` / `revert`.
      *Transferred 2026-08-20* — council disposition **B**, outcome `transferred`, to [`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md); merged with `skill-activation-window` as one live-trigger-eval gap.
- [-] <!-- blocked-by: human-gated-live-trigger-eval --> **1.4 Publish the outcome either way.** A null is a result: if the rewrite
      did not move the instrument, that is recorded as an honest null with the
      same prominence a win would get.
      *Verify:* the verdict is written where a reader looking for the
      description-rewrite decision will find it, and the roadmap states which of
      the three criteria failed if any did.
      *Transferred 2026-08-20* — council disposition **B**, outcome `transferred`, to [`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md); merged with `skill-activation-window` as one live-trigger-eval gap.

## Success criteria

- A pre-rewrite baseline and a post-rewrite rate exist for the same fixture set
  and the same scorer.
- The verdict cites all three pre-registered criteria and states which held.
- No lift is claimed anywhere without both numbers present.
- If the outcome is `revert`, the 9 descriptions are restored and that is
  recorded as the measurement working, not as a failure of the roadmap.

## Blockers

### blocker: human-gated-live-trigger-eval

- **Status:** resolved — transferred 2026-08-20 (council disposition **B**, outcome `transferred`). See the Resolution block at the end of this entry.
- **Owner:** user
- **Class:** 3 — human-only (hard-aborts under automation by design; simulating it breaks the prereg)
- **Blocks:** all of Phase 1 — 1.1 and 1.2 both need a live model run
- **What to do:** run the live trigger-eval to produce the predictions JSON for
  both tree states — `./scripts-run src/scripts/rule_trigger_eval` on the
  maintainer machine, once per tree state, same protocol both times. It
  hard-aborts under automation on purpose, so an agent cannot supply it and
  must not simulate it. Substituting an AI rater would break the
  pre-registration.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Run both tree states in ONE sitting
  under the same protocol, or park the roadmap in `later/` with exactly that as
  its resume condition. Two sittings is the failure mode to avoid: the entry's
  Resolved-when requires both JSONs to come from the *same* protocol, and a
  protocol that drifted between runs produces two files that look comparable
  and are not. This blocker also gates
  `road-to-cost-parity-1-rule-payload-diet`'s `skill-activation-window`, so one
  sitting discharges two entries — which is why it outranks its own step count.
- **If you do nothing:** all of Phase 1 stays open, and the description
  rewrite ships with no before/after activation reading — the claim it exists
  to test stays unmeasured while reading as ordinary open work.
- **Resolved when:** a predictions JSON exists for the pre-rewrite and the
  post-rewrite tree state, produced by the same protocol.
- **Resolution (2026-08-20, autonomous drain run):** **transferred**, not
  discharged — the criterion above is unchanged and unmet. Disposition **B** per
  [`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md),
  which **merged this entry with `skill-activation-window` from
  [`road-to-cost-parity-1-rule-payload-diet.md`](road-to-cost-parity-1-rule-payload-diet.md)**
  as one evidence gap under two names, served by **one** shared stub:
  [`stubs/road-to-live-trigger-eval.md`](stubs/road-to-live-trigger-eval.md).
  That stub carries both Resolved-when criteria verbatim, the complete dependent-step
  list from both parents, and four named producer/probe pairs each measured failing
  today. This is half of a merged pair: the sibling blocker stays open in its own
  roadmap until that roadmap is drained, and it closes against the stub as-is —
  nothing in the stub needs editing to accept it.
  **One correction the transfer surfaced:** the command named above
  (`rule_trigger_eval`) is the **rules-scope** harness — catalogue built from
  `dist/agent-src/rules/<id>.md` (`src/scripts/rule_trigger_eval.ts:14-17`) — and it
  does not hard-abort under automation; it is the CI-only live path gated on a key
  file (`:25-29`, `:315`). The interactive `/dev/tty` abort this entry describes is
  real and lives in the skill-scope sibling `src/scripts/skill_trigger_eval.ts:500-503`.
  The class-3 human-only classification is therefore correct on substance while
  naming the wrong binary; recorded here rather than silently substituted.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The baseline is taken against the wrong tree state | implementation | The pre-rewrite state must exclude the 9 rewrites but include the scorer repoint, or the two runs differ in more than the variable under test | **Revised 2026-08-20.** Unfired — neither run happened, so no wrong-state baseline exists. 1.1/1.2 are `[-]` and **transferred**; the stub keeps the parity obligation as probes P1/P2, which require both JSONs to share protocol metadata (same scorer version, same fixture file, same harness mode) rather than leaving parity to prose | Phase 1 |
| 2 | A single-number target invites Goodharting | implementation | A selector is probabilistic; one pre-registered floor would invite tuning the fixtures instead of the descriptions | **Revised 2026-08-20 — this risk now has teeth it lacked.** Verification found the corpus is **34** fixtures against criterion (iii)'s ≥ 100-request floor, so the pressure to widen the fixture set is real and immediate. The drain run refused it: growing the corpus is stub probe **P3**, explicitly a reviewed maintainer decision, because an agent that authored the fixtures would then be grading its own paper. The three-criteria structure is preserved verbatim in the stub and was not renegotiated by the transfer | Phase 1 |
| 3 | The null is quietly dropped | implementation | A rewrite that did not move the instrument is the least satisfying outcome and the easiest to leave unpublished | **Revised 2026-08-20 — this risk FIRED, in a form the mitigation did not cover.** 1.4 is `[-]` and no null was published — because there is no null to publish; the instrument never ran. The dashboard renders the roadmap `0 / 0 done (0%)` with Phase 1 `⏭️ skipped`, which mis-signals in the other direction: transferred work reads as cancelled. A step with a verify clause cannot mitigate the absence of the measurement it was going to verify. Replaced with the outcome-state mechanism: `## Outcome` records three `transferred` criteria against one `satisfied`, states in plain words that archived does not mean achieved, and the stub's four failing probes are the standing record that the reading is still owed | Phase 1 |
