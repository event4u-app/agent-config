---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to regulatory radar

> **Parked in `later/` (2026-08-22), authored but not started.** The central
> question — whether this package carries regulatory parameters at all — is
> **owner-reserved**, not agent-decidable and not council-decidable, because
> answering it creates a regulatory and liability commitment. It is parked
> because of who decides, never because the work is bad: Phase 0 is cheap,
> evidence-producing and structurally consequence-free, and it produces exactly
> the number the decision needs.
>
> **Resume when** an owner is named with a stated refresh cadence
> (`b-regulatory-owner-and-cadence`) **and** the carry-vs-route decision has
> been taken against `docs/decisions/ADR-238-security-content-routes-to-external-authority.md`.

> **Source:** agents/tmp.old/eu-e-evidence

> ⚠️ Attorney review required on material use. This is a draft for a licensed
> attorney, not legal advice and not a legal conclusion.

**Jurisdiction:** EU / DE.

## Goal

Answer one question with a number instead of an intuition: when someone asks
"what do I have to do as an operator", does an agent working from this package
today produce a materially wrong, undated or overbroad answer often enough to
justify carrying a maintained regulatory dataset — with everything that
carrying implies. Phase 0 measures that. Phase 1 turns the measurement into a
decision paper against the record that already governs this shape. Nothing
beyond Phase 1 is planned here, deliberately: the phases the source draft wrote
(a knowledge domain, a `/compliance-brief` command, an applicability engine,
background watchers) all presuppose an answer nobody has taken yet.

## Context — what was verified, and what was falsified

**No coverage exists.** No skill, rule, command or ADR covers a regulatory
calendar or a set of operator obligations. `grep -rl compliance-brief` over the
tree returns **zero files**. The gap the source names is real.

**A reusable staleness instrument exists.** `src/scripts/check_memory.ts`
already requires `last_validated` and `review_after_days` on every entry
(`REQUIRED_KEYS`, `:60-68`), evaluates staleness against them (`:377-382`), and
carries a harder 90-day SLA for `priority: critical` entries (`:387-397`,
`CRITICAL_STALE_DAYS` at `:83`). If a dataset is ever carried, this is the
mechanism it reuses rather than reinvents.

**The proposed home is never-true.** The source draft wanted the dataset under
`agents/knowledge/`. That directory's own contract forbids it:
`agents/knowledge/README.md:6` — "A card is **never a source of truth and never
a build input.**" A regulatory dataset a brief renders from is precisely a
source of truth and a build input. Note also that the global promotion store
described at `:37` is **unversioned and not in git**, so it is not an
alternative home either. Where such a dataset would live is genuinely
unanswered — blocker `b-regulatory-knowledge-home`.

**The draft's own justification is falsified.** It argued its way past the
estate constraint with "290 dirs in `src/skills` vs ~130 estate-drawdown
target". The 290 is correct (`ls src/skills | wc -l` → 290). The ~130 is not: a
`grep -n "130"` over `agents/roadmaps/archive/road-to-estate-drawdown.md`
returns **nothing**, and `src/config/estate-count-budget.json` gates
`active_roadmaps`, `later_roadmaps` and `open_blockers` — there is no skill
count in its metric or its baseline at all. The estate constraint on a new
skill is real and comes from elsewhere; the specific figure the draft leaned on
does not exist. Recorded because a premise that dissolves on one grep is the
kind that gets re-quoted.

**The governing lock.**
`docs/decisions/ADR-238-security-content-routes-to-external-authority.md`
(accepted 2026-08-21, `reopen_policy: directional`) draws this exact line for
the security domain: "This package does not carry security-domain parameters.
It routes to the maintained authority" (`:67`), on the grounds that "A class is
stable; a parameter is not" (`:90`), and with the cost stated plainly — "the
alternative on offer was not 'a maintained local answer' but 'an unmaintained
one', because no owner was available to name" (`:107-108`). Deadlines, penalty
tiers, notification addressees and applicability dates are pure parameters, and
they decay faster than cipher suites. The ratio carries.

**But mechanism-match is not complete, so this is a proposal and not an
auto-reject.** ADR-238 weighed carrying against routing. The source draft puts a
third mechanism on the table that record did not consider: **pull-verification
at generation time plus a fail-visible freshness invariant** — every rendered
claim is re-checked against its authoritative locator on the run that renders
it, and a failed check downgrades the wording to "as of `<date>`" rather than
silently presenting a stored claim as current. Whether that actually defeats the
staleness argument or merely relocates it is the question Phase 1 puts to the
decision. Refusing it on ADR-238's letter without weighing the new mechanism
would be exactly the mechanism-match failure `decision-revisit-gate` names.

**The legal floor is unwired in the draft, on four counts.** It satisfies
neither the consent gate (`src/rules/legal-safety-floor.md:60-63`), the council
gate (`:72`), the attorney-review work-product line (`:108`), nor the
`Jurisdiction:` tag (`:122`). Worth noting alongside: the legal pack's own
freshness check runs empty today — `src/scripts/lint_legal_pack.ts:15-17`
checks a `last_verified` / `freshness_window` shape **only if declared**, and a
grep across `contract-review`, `nda-triage`, `dpa-review`,
`legal-intake-triage` and `legal-practice-profile` finds **no skill that
declares one**. So "the freshness mechanism exists" is true and "the freshness
mechanism is exercised" is not.

**Every legal fact in the source is `status: seed`.** The draft's dates,
penalty branches, notification duties and transposition deadlines were not
verified offline in this pass and are **not restated here as fact**. They are
input to Phase 0's scoring, nothing more. Phase 0 does not need them to be
true — it needs them to be checkable.

## Phase 0 — Baseline hallucination census

Cheap, evidence-producing, and structurally consequence-free: it ships no
skill, no command, no dataset and no claim. It exists so the decision in
Phase 1 has a number instead of an intuition.

- [ ] **0.1 Build the prompt set.** At least 12 operator-shaped prompts across
      the regimes the source names, plus an adversarial scope subset designed
      to invite an overbroad answer — a brochure-only site, an ordinary SaaS
      holding account data, a SaaS holding customer files, an in-app chat, a
      marketplace, a DNS registrar, a non-EU provider serving DE. The
      adversarial subset is the load-bearing half: a system that answers
      correctly and answers *too much* fails differently from one that answers
      wrong, and only the scope set separates them.
      verify: `test -f agents/evidence/eval-findings/regulatory-radar-prompts.md`
      and the file lists ≥ 12 prompts with the scope subset marked.
- [ ] **0.2 Score every material claim into five classes.** `correct_current` /
      `correct_undated` / `stale` / `overbroad` / `fabricated`. A claim that is
      right but carries no date is NOT `correct_current` — the undated class
      exists because an undated legal claim is the failure this whole idea is
      about. Score per claim, not per answer.
      verify: `test -f agents/evidence/eval-findings/regulatory-radar-census.md`
      and the file reports per-class counts and a denominator.
- [ ] **0.3 Pre-register the closing threshold before scoring, not after.**
      **≥ 90 % `correct_current` closes this roadmap as an honest null** — the
      gap is real, the defect is not, and the honest outcome is a recorded "we
      measured, it was fine". Write the threshold into the findings file before
      the first prompt is scored.
      verify: `git log --diff-filter=A --format=%H -1 --
      agents/evidence/eval-findings/regulatory-radar-census.md` resolves, and
      the threshold text is present in that first added revision.
- [ ] **0.4 Do not ship a fact.** Phase 0 writes findings, never a dataset,
      never a skill, never a command. Every legal proposition it quotes stays
      marked `status: seed` and is scored, not asserted.
      verify: `grep -rc "status: seed"
      agents/evidence/eval-findings/regulatory-radar-census.md` returns ≥ 1,
      and no file under `agents/knowledge/regulatory/` exists.

**Exit:** per-class numbers with a denominator, and the pre-registered
threshold recorded before scoring began.
**Rollback:** findings are evidence files; nothing shipped, nothing to revert.

## Phase 1 — Carry-vs-route decision paper

- [ ] **1.1 Write the paper against ADR-238, with the Phase-0 delta as its only
      argument.** State the measured defect rate, state the mechanism ADR-238
      did not weigh (pull-verification plus fail-visible freshness), and state
      honestly whether that mechanism defeats the staleness objection or
      relocates it into "the check silently stopped running". Do not argue from
      the source draft's enthusiasm; argue from 0.2's numbers or do not argue.
      verify: `test -f agents/evidence/analysis/regulatory-carry-vs-route.md`
      and it cites the Phase-0 per-class counts by file path.
- [ ] **1.2 Route it correctly, and do not decide it here.** The carry
      direction creates a regulatory and liability commitment, which is
      owner-reserved by `decision-revisit-gate`'s reserved set — it is not a
      council call and not an agent call. The paper is input to that decision,
      never the decision.
      verify: blocked — see `b-regulatory-owner-and-cadence`. The paper may be
      written; the decision may not be taken without a named owner.
- [ ] **1.3 Stop here.** Nothing past this phase is planned. A knowledge
      domain, a `/compliance-brief` command, an applicability engine and
      background watchers all presuppose a carry decision, and planning them
      now would build the momentum that makes an owner-reserved question feel
      already answered.
      verify: this roadmap contains no phase numbered above 1.

**Exit:** a decision paper exists and is in front of the owner, or the
Phase-0 threshold fired and this roadmap closed as an honest null.
**Rollback:** the paper is analysis; nothing shipped.

## Blockers

### blocker: b-regulatory-owner-and-cadence
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 step 1.2 and everything a carry decision would unlock.
  Phase 0 and step 1.1 proceed without it — measuring and writing the paper are
  what the decision needs, and neither commits anything.
- **What to do:** pick exactly one — (a) name a single maintainer who accepts
  ownership of the regulatory dataset with a stated refresh cadence, per
  `docs/guidelines/agent-infra/domain-adoption-gates.md:24-37` (Gate 2 requires
  a single named maintainer, not "the team" and not "TBD", plus a committed
  cadence); note that the source draft demands `review_after_days ≤ 30` for
  legislatively moving dates, which would be the hardest standing maintenance
  duty anywhere in this tree; or (b) decline to carry, which routes the domain
  to the maintained external authority exactly as
  `ADR-238` does for the security domain, and closes this roadmap with the
  Phase-0 number recorded as the evidence for the choice.
- **Recommendation:** **run Phase 0 first, then decide — and if Phase 0 has not
  run, option (b).** Without the census both options are guesses. With it, (a)
  is defensible only if the measured defect rate is high AND someone actually
  volunteers; ADR-238's own accepted cost — that the real alternative to a
  maintained answer is an unmaintained one — is the sentence to re-read before
  saying yes. An unowned regulatory dataset is worse than no dataset, because
  a stale legal deadline reads authoritative and its staleness is invisible.
- **If you do nothing:** the roadmap stays parked, which is the correct resting
  state — but the gap stays unmeasured too, so the next draft proposing the
  same thing arrives with the same unfalsified premises and gets the same
  stall. Running Phase 0 costs little and makes the next arrival decidable.
- **Resolved when:** one option is recorded at this blocker, and for (a) the
  maintainer's name and the cadence are written into this file.

### blocker: b-regulatory-knowledge-home
- **Status:** open
- **Owner:** maintainer
- **Blocks:** any dataset work. It does not block Phase 0, which writes
  findings under `agents/evidence/eval-findings/`, a directory with no such
  contract problem.
- **What to do:** pick exactly one — (a) name a home that is contractually
  allowed to be a source of truth and a build input, and record why it is
  allowed; `agents/knowledge/` is excluded by its own README (`:6`), and the
  promotion store at `:37` is excluded for being unversioned and outside git;
  or (b) decide the dataset has no home in this tree, which is itself an
  argument for the route direction of `b-regulatory-owner-and-cadence` and
  should be recorded as such rather than treated as a separate problem.
- **Recommendation:** **option (b), unless (a) produces a home in one sitting.**
  The absence of a legal home is evidence about the decision, not an obstacle
  in front of it — a dataset that has to invent its own directory contract to
  exist is a dataset this tree was not built to carry.
- **If you do nothing:** a future implementer puts the dataset under
  `agents/knowledge/` because it is the obvious-looking directory, and the
  contract violation is discovered after the content exists, when moving it is
  expensive.
- **Resolved when:** one option is recorded at this blocker, and for (a) the
  named directory exists with a README stating it may be a build input.

### blocker: b-legal-floor-wiring
- **Status:** open
- **Owner:** implementer
- **Blocks:** any skill or command this roadmap would ship. It does not block
  Phase 0 or step 1.1 — a findings file and an analysis paper are not legal
  work-product, though this roadmap carries the attorney-review line and the
  `Jurisdiction:` tag above anyway.
- **What to do:** pick exactly one — (a) wire all four floor requirements into
  whatever ships: the consent gate
  (`src/rules/legal-safety-floor.md:60-63` — no legal-pack skill runs until
  `legal_review_prep.acknowledged: true`), the council gate (`:72` — legal
  work-product is multi-model or it is not produced), the attorney-review
  work-product line (`:108`), and the `Jurisdiction:` tag (`:122`, machine-
  checked); or (b) scope the deliverable so it is explicitly not legal
  work-product — an orientation pointer that names regimes and routes to
  counsel without rendering any obligation — and record that scoping decision,
  noting that the RDG line (`legal-safety-floor.md`, § the individual-case STOP)
  binds regardless of scope.
- **Recommendation:** **option (b), if anything ships at all.** A rendered
  obligation is individual-case examination the moment it is scoped to a
  concrete operator, which is the hard STOP the legal floor draws; an
  orientation pointer is the largest deliverable that stays clearly on the safe
  side. Option (a) is not wrong, it is just a much bigger commitment wearing a
  checklist.
- **If you do nothing:** a deliverable ships carrying legal propositions with
  none of the four floor mechanisms, which is the failure mode
  `legal-safety-floor` exists to prevent and which no gate would catch, because
  `lint_legal_pack` only checks skills that opt into declaring freshness and
  none currently do.
- **Resolved when:** one option is recorded at this blocker, and for (a) each
  of the four requirements is present in the shipped artefact.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A seed legal fact gets quoted as verified | product | Every legal proposition inherited from the source is unverified. The moment one appears in a findings file without its `status: seed` marker it starts reading as a repo fact, and a wrong regulatory deadline reads authoritative in a way a wrong config default never does | Step 0.4 pins the marker and makes it verifiable by grep; the attorney-review line and the `Jurisdiction:` tag ride at the top of this file so nothing here reads as counsel | Phase 0 — Baseline hallucination census |
| 2 | The census scores a defect rate that argues for carrying, and nobody owns it | product | A high defect rate is the strongest argument for a dataset and says nothing about who maintains it. ADR-238 records the same trap: the real alternative to a maintained answer was an unmaintained one, because no owner was available | `b-regulatory-owner-and-cadence` is owner-reserved and gates the decision, not the measurement; step 1.2 forbids taking the decision without a named owner even when the number is compelling | Phase 1 — Carry-vs-route decision paper |
| 3 | Phase 0 grows into Phase 2 by momentum | implementation | The source draft has seven more phases already written. Once a census exists and a schema is sketched, building the dataset feels like the next step rather than a separate owner-reserved decision | Step 1.3 states there is no phase above 1 and makes it verifiable against this file; the parked disposition keeps the roadmap out of `/roadmap:process-*` entirely | Phase 1 — Carry-vs-route decision paper |
| 4 | The threshold moves after the numbers are in | implementation | 90 % is only a real gate if it is written down before scoring. Registered afterwards it becomes a description of whatever happened | Step 0.3 requires the threshold to be present in the first added revision of the findings file, which git makes checkable | Phase 0 — Baseline hallucination census |
| 5 | The pull-verification mechanism is credited without being tested | implementation | It is the one argument that distinguishes this proposal from what ADR-238 already refused. Asserting it works is not the same as showing a live check correctly classifies a current law, a recently amended one and a dead locator | Step 1.1 requires the paper to state whether the mechanism defeats the staleness objection or relocates it, in those terms — an unfalsifiable "it verifies itself" does not satisfy the step | Phase 1 — Carry-vs-route decision paper |

## Acceptance Criteria

- [ ] AC-1 — A findings file under `agents/evidence/eval-findings/` reports
      per-class counts (`correct_current` / `correct_undated` / `stale` /
      `overbroad` / `fabricated`) over ≥ 12 operator prompts including the
      adversarial scope subset, with a stated denominator.
- [ ] AC-2 — The 90 % `correct_current` closing threshold is present in the
      first added git revision of that findings file, so it cannot have been
      fitted to the result.
- [ ] AC-3 — Either the threshold fired and this roadmap is closed as a
      recorded honest null, or a decision paper exists at
      `agents/evidence/analysis/regulatory-carry-vs-route.md` citing those
      counts.
- [ ] AC-4 — No file exists under `agents/knowledge/regulatory/`, and no legal
      proposition inherited from the source appears anywhere without its
      `status: seed` marker.
- [ ] AC-5 — This file contains no phase numbered above 1, and all three
      blockers carry either a recorded option or an explicit `Status: open` —
      an owner-reserved question left visibly open is the correct terminal
      state for a parked roadmap; one quietly resolved by an agent is not.
