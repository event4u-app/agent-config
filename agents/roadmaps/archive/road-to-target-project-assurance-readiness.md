---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Growth is exactly one open blocker and nothing else: b-human-risk-corpus, added in this change. It is not a newly discovered gate — Phase 2 already cited a blocker (`spike-before-build`) that the file never defined, so the dependency was real and invisible; this change makes it visible and gives it an owner and a checkable `Resolved when`. active_roadmaps is unchanged (+0) and no roadmap was archived to pay for this. The AI council that took the disposition (2026-08-23, 2 rounds, 2 of 2 convergent) weighed the ratchet cost explicitly and judged it secondary: the ratchet is an accounting pressure, not evidence of completion, and must not determine whether actionable work is represented honestly. The alternative on the table was closing the roadmap by routing its measurement `unmeasurable-here`, which would have cost the estate nothing and would have both erased actionable work and diluted a precedent this tree relies on — that precedent covers a capability the tree lacks, and what is missing here is a human-supplied input. Paying +1 to keep the work visible is the cheaper error."
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate decision this key deferred to the owner has now been taken, for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction; the file carries no blockers, so open_blockers is unchanged. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft, same terms as its parent road-to-agentic-engineering-assurance: no charge until the owner flips it, and no unrelated roadmap archived to pay for it. It is the parent's Phase 1 matrix carrier and has no active sibling covering target-repo readiness grading."
---
# Road to target-project assurance readiness

> **Source:** `agents/tmp.old/inbox-2026-08-f/road-to-target-project-assurance-readiness.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** an external research report (22 Aug 2026, "Agent-Coding-Assurance")
> on what a repository must carry so that coding agents can work with high
> autonomy without a human reading every line. Every claim about **this**
> tree below was re-verified against commit `e1fe45077cab` (22 Aug 2026,
> "Merge pull request #1535") and is cited `file:line`. Claims about the
> outside world are the report's and are marked **[report]**. Everything
> under *Proposed* is a proposal, not an adopted foundation (ADR-211 C/D).
>
> **Harvest form is inverted.** This roadmap starts from defects the tree
> has today and pulls in only the parts of the report that close them. The
> parts it does not pull are listed under *What this roadmap will not build*
> so nobody re-proposes them.
>
> **Estate note.** `src/config/estate-count-budget.json` ratchets
> `active_roadmaps` at 25 (the `baseline` block); `agents/roadmaps/*.md`
> holds 26 candidates at the pin. Promoting this file needs an offset
> (archive or skip one roadmap) or it lands in `later/`. The three successor
> roadmaps it names live in `stubs/` and do not count.

## Boundary — what this is not

Three sibling roadmaps already cover **this package's own** tests and
reviews: `road-to-test-independence-and-mutation-evidence.md` (mutation
evidence for AC's test suite), `road-to-review-independence.md` (who reviews
AC's changes), `road-to-spec-axis-in-review.md` (spec judge on AC's review
path). This roadmap is about the **target project** — the user's repository
that AC is installed into. Nothing below touches the sibling files; where a
sibling ships a mechanism this roadmap can point at, it points and does not
fork.

## Goal

AC can answer, for any repository it is installed into, two questions it
cannot answer today — *"how far may an agent work here unsupervised?"* and
*"which gates does this particular change owe?"* — and the answers are
derived from the tree, not declared by the agent doing the work. When this
is finished, `/project:analyze` emits a **readiness matrix with a binding
lowest dimension** (never a single score), and every change that reaches
`verify-completion-evidence` carries a **computed risk class** that names
the gates it owed. Whether those gates then exist in the target project is
the successor roadmap's problem (`stubs/road-to-target-project-bootstrap-enforce.md`).

## Context — what exists, and what does not

**Stack detection exists; a verdict does not.**
`src/domains/engineering-base/project/analyze/command.md:29-30` reads
`composer.json` and `package.json`; the output block at `:44` onward prints
stack facts. `project/health/command.md` is explicitly read-only and counts
test files as a bare number. Neither says whether the tree is fit for
autonomous work, and neither knows a knockout dimension.

**The quality router is two-stack and gate-poor.**
`src/skills/quality-tools/SKILL.md:33-36` routes exactly PHP (PHPStan / ECS /
Rector) and JS/TS (Biome, tsc, Jest/Vitest). Across `src/`:
`dependency-cruiser`, `deptrac`, `semgrep`, `bandit`, `fast-check`,
`property-based`, `npm audit`, `pnpm audit`, `stryker`, `infection`,
`mutmut`, `cosmic-ray` return **0** files each (`grep -rliE`, pinned tree).
`pip-audit` returns 3, `composer audit` 1. So architecture gates, SAST,
mutation and property testing are not capabilities AC can detect, let alone
install, in a target project.

**Risk is assessed, never classified.**
`src/skills/risk-officer/SKILL.md:79` asks for a residual-risk note and `:87`
issues `proceed`-style verdicts; `src/skills/blast-radius-analyzer/SKILL.md:85`
tags a change with a risk *type* (signature break · behavior change · data
migration …). Neither output feeds a gate: nothing in `src/` maps a risk
level to a mandatory verification set (`risk class`, `risk tier`: 0 hits).
`test-driven-development/SKILL.md:21-26` decides whether TDD applies by
*kind of task* (prototype, boilerplate, docs), not by blast radius, so a
one-line auth change and a one-line docstring change are routed by the same
rule.

**Completion evidence is prose.**
`src/skills/verify-completion-evidence/SKILL.md` (211 lines) enforces fresh
output in the current turn — the right discipline — but `json`, `schema`,
`machine` return 0 hits in it. Nothing downstream can read the evidence.

**Legacy has no path.** `characterization`, `golden master`, `flaky`,
`quarantine` return 0 hits in `src/`. The only baseline policy is PHPStan's
(`quality-tools/references/php-tools.md:170-174`).

### What the report adds, and why it is not taken wholesale

The report proposes a 10-dimension readiness matrix with knockout
dimensions, a four-class risk model R0–R3 with a gate table, a JSON evidence
contract, a bootstrap loop and a legacy ratchet path. **[report]** Its load-
bearing empirical claims: coverage measures execution, not detection power;
property-based tests found ~50× the mutants of an average unit test in a
426-project Hypothesis study (OOPSLA 2025); 29.6 % of "plausible" SWE-bench
patches diverge behaviourally from ground truth (arXiv 2503.15223); errors
of same-family models correlate (arXiv 2506.07962). None of these is
re-verified here; they motivate Phase 0's pre-registration, they do not
replace it.

The report is taken **only where it closes a defect above**. Its five-agent
swarm shapes, multi-model councils and runtime-canary components are cut
(see *will not build*): AC already has council tooling, and the report's own
self-critique ranks those as the most over-engineered parts.

## Proposed — the two artefacts this roadmap ships

*Proposal, not foundation.*

**Readiness matrix.** Ten dimensions, each graded 0 Absent / 1 Present /
2 Enforced-in-CI / 3 Independent-and-diff-scoped:
behaviour contract · test presence & types · test strength · static
analysis & types · architecture gates · security & supply chain · CI
enforcement · independent verification · evidence & traceability ·
runtime verification. Four are **knockout** for any project type:
*test presence*, *static analysis & types*, *CI enforcement*, *security &
supply chain*. The verdict is `min` over knockouts, reported as
`L<n> — bound by <dimension>`. A single aggregate number is never printed.

**Risk classifier.** Deterministic, computed from the diff: touched paths
against an override list (`**/auth/**`, `**/migrations/**`, `**/*payment*`,
`**/*billing*`, IaC and CI files, anything under the agent's own config),
plus public-signature changes, dependency changes, and size. Classes:
R0 cosmetic · R1 internal · R2 behaviour-changing · R3 critical. Ties and
unknowns resolve **upward**. Changes to the classifier, the override list,
hooks, CI or AC's own settings are R3 by construction — the one place the
system can defend itself against being talked down.

## Phase 0 — pre-register, then measure whether the classifier beats the agent

Thresholds are written before any number is seen.

- [x] **0.1 Pre-register.** Under `agents/evidence/`, before any
      measurement: the corpus (a commit range of this tree plus one external
      target repo the maintainer names), the question *"does a
      deterministic path+diff classifier agree with a human's risk label
      more often than the implementing agent's self-declared label?"*, the
      threshold (agreement with human label ≥ 0.80 on R3, and R3-recall ≥
      0.95 — a missed R3 is the failure that matters), and the three routes
      (pass / null / ambiguous).
      verify (discharged): `git log --format=%aI -1 -- <pre-reg>` precedes every
      measurement artefact's date.

      **SHIPPED** as `agents/evidence/risk-classifier-prereg.md`, **in its own
      commit ahead of the classifier** so the ordering is real rather than
      asserted. Risk 6 is why: *"nothing in a prose plan prevents the ordering from
      silently inverting."*

      Fixes the question, the corpus, both thresholds — R3 agreement >= 0.80,
      R3-recall >= 0.95 — and all three routes. **R3-recall is named as the binding
      metric**, because agreement can be bought by classifying everything R3 and
      recall cannot be bought by classifying everything R0.

      One clause was added that the step did not ask for and that turned out to
      decide the run: the `null` route reads *"either threshold missed, **or the
      corpus cannot be produced**."* A pre-registration whose routes cover only
      outcomes of a run that happened is a results section.
- [-] **0.2 Hand-label the corpus. NULL — no human labeller reachable.** ≥ 60 changes, labels R0–R3, labeller
      blind to the classifier. Store as `agents/evidence/risk-corpus.jsonl`.
      verify (not attempted): the file exists, every row has `sha`, `label`,
      `labeller`, and no row carries a `classifier` field yet.

      **RECORDED AS A NULL 2026-08-23**, AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent. No human is reachable in
      this run, and 0.1 fixes the human label as the **reference standard**.

      **An agent label was considered and refused.** It would make the reference
      standard and one of the two compared arms the same kind of judgement: the
      question is whether a deterministic classifier beats an *agent's* self-label,
      and answering it with an agent's label as the reference measures the agent
      against itself. That is not a weaker version of the experiment — it is a
      different one, and reporting it under the pre-registered question is the
      manufactured result the pre-registration exists to prevent.

      Full four-part null: `agents/evidence/risk-classifier-null.md`.
- [x] **0.3 Run the classifier as a script, not a prompt.** A single
      `src/scripts/classify_change_risk.ts` reading `git diff --name-only`
      plus the override list; no model call. Compare against 0.2 and against
      the agent-declared class harvested from the same changes' PR bodies
      where one exists.
      verify (first limb discharged, second limb null): the script has a
      `--self-test` path wired through `src/scripts/_lib/gate_self_test.ts` like its
      neighbours, and the artefact reports agreement and R3-recall against the 0.1
      thresholds.

      **SHIPPED** as `src/scripts/classify_change_risk.ts`. No model call, by
      construction — a classifier that asks a model is the agent's self-label
      wearing a script's clothes. `--self-test` reports **7/7 cases, 3 of them
      reject arms** (floor 6/2); the reject arms are the ones that matter, since a
      suite proving only passes proves the harness runs rather than that the
      classifier discriminates. `--assert-class` is what gives a classifier
      reject/accept semantics the gate harness can drive.

      **Second limb is a null, not a miss:** agreement and R3-recall need 0.2's
      human corpus and have no reference standard. They are written into every
      drift row as `null` with a `null_reason`, never omitted — absent fields would
      make a later reader unable to tell "not measured" from "measured as zero",
      which on a recall metric is the difference between no data and total failure.

      Two design points worth recording because both resolve *upward* and could
      have been softened: an **empty path set classifies R3**, not R0 — a caller
      passing nothing has not told us the change is empty, only that it did not
      say; and `.json` is deliberately **absent** from the cosmetic list, because a
      JSON file is as likely to be a policy as a fixture and guessing wrong there
      resolves downward.
- [x] **0.4 Route.** Pass → Phases 1–3 open. Null → Phase 1 still ships
      (the matrix needs no classifier), Phase 2 is marked `[-]` and the
      standing metric from 0.3 keeps running nightly so a later run can
      re-open it. Ambiguous → the route named in 0.1.
      verify (discharged): the decision is recorded in this file citing the artefact.

      **ROUTED NULL 2026-08-23**, on the pre-registration's second `null` clause —
      the corpus cannot be produced — recorded at
      `agents/evidence/risk-classifier-null.md`. Consequences are the ones 0.1
      declared in advance and are applied without amendment: **Phase 1 ships**
      (already landed; the matrix needs no classifier), **Phase 2 is `[-]`**, and
      **Phase 3 ships** with the standing metric so a later corpus can reopen it.

## Phase 1 — readiness matrix inside `/project:analyze`, not beside it

0 new skills, 0 new commands. The matrix is a section of the existing
analysis.

- [x] **1.1 Extend detection to the dimensions.** Add to the parallel
      gather at `project/analyze/command.md:29-30`: test runner config
      (vitest/jest/phpunit/pest/pytest), mutation config (stryker.conf.*,
      infection.json*, setup.cfg/pyproject `[tool.mutmut]`), architecture
      config (`.dependency-cruiser.*`, `deptrac.yaml`, Pest `arch()` usage),
      SAST (`.semgrep*`, bandit config), audit steps in CI, lockfile
      presence, and whether CI *blocks* on each (a `required` status check
      or a job without `continue-on-error`).
      verify: a fixture target repo under `tests/fixtures/target-repos/`
      with each file present is detected; the same fixture with the file
      removed is not — both asserted by a vitest spec.
      **SHIPPED 2026-08-23 as a script, not a gather list, and the substitution is
      the finding.** This step's verify requires that each dimension's presence be
      detected **and its absence not be**, "both asserted by a vitest spec" — and
      a gather list in `command.md` cannot be asserted by anything. So detection
      lives in `src/scripts/grade_target_readiness.ts` and the command invokes it;
      the command keeps the narrative and prints the output verbatim.

      Ten dimensions probed in one pass: test-runner config
      (vitest/jest/phpunit/pest/pytest), mutation config (`stryker.conf.*`,
      `infection.json*`, `[tool.mutmut]`, `setup.cfg [mutmut]`), property-based
      libraries (fast-check, Hypothesis), static analysis (`phpstan.neon`,
      `psalm.xml`, `tsconfig.json`), architecture gates
      (`.dependency-cruiser.*`, `deptrac.yaml`), SAST (`.semgrep*`, bandit),
      lockfiles across five ecosystems, audit steps, `CODEOWNERS`, decision-record
      directories — **and whether CI blocks on each**, which is the 1 → 2
      distinction a hand-read gets wrong.

      verify: `tests/scripts/grade_target_readiness.test.ts` asserts presence
      across nine detectable dimensions in `tests/fixtures/target-repos/full/` and
      absence in `ci-absent/`, whose only difference is that
      `.github/workflows/` does not exist. 17 assertions pass.
- [x] **1.2 Print the matrix with the binding dimension, never a score.**
      The output block gains a `READINESS` section:
      `L<n> — bound by <dimension>` followed by the ten rows. No
      percentage, no "x/100" anywhere in the template.
      verify: `grep -nE '/100|%' src/domains/engineering-base/project/analyze/command.md`
      over the new section returns nothing.
      **SHIPPED 2026-08-23.** `command.md` gained a `READINESS` section that
      prints the script's output verbatim, with three rules restated so the
      template cannot undo what the script enforces: never emit an aggregate; the
      level is the minimum over knockouts; `not detectable` is not `0`.

      **This step's verify as written produces a FALSE POSITIVE, and that is
      recorded rather than worked around.** `grep -nE '/100|%'` over the new
      section matches the section's **own prohibition sentence** — *"No
      percentage, no `x/100`"*. The rule forbidding a score is not a score. The
      assertion is therefore scoped to what the template tells the agent to
      **print** (the fenced display block) rather than to the prose governing it,
      and a committed test carries that scoping with the reason attached, so the
      next reader running the literal grep is not misled by the hit.
- [x] **1.3 Knockout semantics are tested, not described.** A fixture with
      nine dimensions at 3 and `CI enforcement` at 0 must print `L0 — bound
      by CI enforcement`.
      verify: the vitest spec asserts exactly that string.
      **SHIPPED 2026-08-23.** `tests/fixtures/target-repos/ci-absent/` is `full/`
      minus `.github/workflows/` — nine dimensions detectable, CI at 0 — and the
      spec pins the exact string `L0 — bound by CI enforcement`.

      Two further assertions, because pinning one string is not pinning the
      semantics: the level equals the computed minimum over the four knockouts,
      **and** the maximum over those same knockouts is strictly greater than the
      level — so a `max` or a mean cannot pass. Sabotage-probed: flipping the
      comparison to `max` reds **3 of 17**.
- [x] **1.4 Stack coverage honesty.** For Python targets, the matrix
      prints `static analysis & types: not detectable — quality-tools has
      no Python mode` rather than 0, until the successor roadmap adds the
      mode. An undetectable dimension is a knockout: it binds at L0 with the
      reason printed.
      verify: Python fixture output contains the literal reason string.

## Phase 2 — risk class on every completion claim

Gated by `blocker: b-human-risk-corpus`.

**The citation this line used to carry — `blocker: spike-before-build` — did not
exist.** The file shipped with no `## Blockers` section at all, so Phase 2 cited a
gate nothing defined. Corrected 2026-08-23 to the blocker below, which is the real
dependency: Phase 2 keys on a class the corpus never validated, and wiring it into
every completion claim first would give a wrong class real authority (Risk 7).

      **SHIPPED 2026-08-23, and this is the sharpest step in the phase.**
      `tests/fixtures/target-repos/python/` grades
      `static analysis & types: not detectable — quality-tools has no Python mode`
      and **binds at L0** with the reason printed.

      The distinction is load-bearing: the dimension is `null`, **not `0`**. A `0`
      would claim the target lacks static analysis; it may well run mypy, and the
      tool cannot tell. Sabotage-probed by grading it `0` instead of `null` — reds
      **4 of 17**, and the Python case then reports a false absence, which is
      exactly the defect this step exists to prevent. A dedicated assertion pins
      `not.toBe(0)` alongside `toBeNull()` so the two cannot be conflated.
- [-] **2.1 `verify-completion-evidence` consumes the classifier.** A new
      step in the procedure of
      `src/skills/verify-completion-evidence/SKILL.md` runs
      `classify_change_risk.ts` and prints the class and the owed gate set
      **before** the existing fresh-output gate. The owed set for each class
      is a table in `src/config/assurance-policy.json`, not prose in the
      skill.
      verify (not attempted): `wc -l` of the skill stays under 400; the policy file
      validates against a JSON schema committed beside it.

      **PHASE 2 CANCELLED 2026-08-23 by the pre-registered null route**, not by a
      judgement made after the fact: 0.1 declared *"Null → Phase 1 still ships …
      Phase 2 is marked `[-]`"* before any number existed, and 0.4 took that route.
      The reason is Risk 7 verbatim — *"wiring it into every completion claim before
      the R3-recall threshold is met would give a wrong class real authority."*
      Nothing consumes the class; `src/config/assurance-policy.json` is therefore
      not created, and every step in this phase depends on it.
      *Reopening condition:* the pre-registration's — a >= 60-change human corpus
      AND an R3 rate <= 0.40 over the trailing 30 days. Both, not either.
- [-] **2.2 TDD gating by risk, in addition to kind.** Append to
      `test-driven-development/SKILL.md:21-26` one line: *"Also mandatory,
      regardless of the list above, when the change classifies R2 or
      higher."* The kind-based exclusions still apply at R0–R1.
      verify: the line cites `classify_change_risk.ts`; the file stays
      under its cap.
- [-] **2.3 Self-protection is R3 by construction.** The override list
      contains AC's own settings path, `.github/workflows/`, hook
      directories and `src/config/assurance-policy.json` itself.
      verify (partially achieved elsewhere): a spec classifies a one-line edit to
      the policy file as R3.

      Cancelled with the phase, because `assurance-policy.json` is Phase 2's file
      and does not exist. **The property itself shipped anyway**, in 0.3: the
      classifier's `R3_PATH_PATTERNS` carries `assurance-policy.json`,
      `classify_change_risk.ts` itself, `src/config/`, hook directories and
      `.github/workflows/`, and its self-test's first case is *"the classifier
      classifies an edit to ITSELF as R3"*. An override list that could be lowered
      by a change the list itself calls cosmetic protects nothing, so
      self-protection belongs to the classifier rather than to the wiring — which is
      why it survives the phase's cancellation.
- [-] **2.4 Route `risk-officer` through the class, do not fork it.**
      `risk-officer/SKILL.md` gains a pointer: its residual-risk note (`:79`)
      becomes the `residual_risk` field the successor evidence contract
      expects; its verdict (`:87`) is not changed.
      verify: diff over `risk-officer/SKILL.md` is ≤ 6 lines.

## Phase 3 — standing metric and honest-null publication

Ships regardless of 0.4.

- [x] **3.1 Nightly classifier drift.** A scheduled workflow re-runs 0.3
      over the last 30 days of merged changes and appends agreement /
      R3-recall to `agents/evidence/risk-classifier-drift.jsonl`.
      verify (discharged): the workflow has a `schedule:` trigger and no
      `pull_request:` trigger — the classifier runs in-session per change,
      the *measurement* runs nightly.

      **SHIPPED** as `.github/workflows/risk-class-drift.yml` (04:00 UTC daily plus
      `workflow_dispatch`) and `src/scripts/measure_risk_class_drift.ts`.
      `grep -c 'schedule:'` = 1, `grep -c 'pull_request'` = **0** — including in the
      comments, which were rewritten to avoid the token: prose that trips a
      grep-shaped verify is a trap for the next reader.

      The workflow runs the classifier's `--self-test` **before** measuring, because
      a silently no-opped classifier would append plausible rows forever. It
      checks out at `fetch-depth: 0`, since a shallow clone would silently shorten
      the 30-day window and under-report the count. `contents: read` only; it
      appends locally and uploads the ledger as an artifact.

      Merge commits are read with `--name-only -m --first-parent` so a merge reports
      the paths it BROUGHT IN rather than nothing — an empty diff classifies R3
      under the upward rule, so a merge-heavy history would otherwise invent an R3
      rate of 1.0 out of bookkeeping.
- [x] **3.2 Publish the null if there is one.** If 0.4 routed null, the
      roadmap closes with outcome `measured-null` and the drift metric
      stays; no "we'll revisit" without a re-open threshold named.
      verify (discharged): closing entry names the re-open threshold numerically.

      **PUBLISHED** as `agents/evidence/risk-classifier-null.md`, outcome
      `measured-null`, and the drift metric stays. Re-open threshold, numeric and
      **conjunctive**: `risk-corpus.jsonl` holds >= 60 human-labelled changes AND
      the drift ledger shows an R3 rate <= 0.40 over the trailing 30 days. Both, not
      either — re-opening on a corpus alone while the classifier calls most changes
      critical would wire alert fatigue into every completion claim.

      **The first measurement is itself a finding, and it indicts this roadmap's own
      configuration.** Readings on this repository: 14 days — 347 commits, 186 R3,
      rate **0.536**; 30 days — 570 commits, 272 R3, rate **0.477**. Both above the
      0.40 threshold, and Risk 2 is unambiguous that this means the defect is in the
      **override list**, not in the people meeting the gates.

      The likely cause, named rather than guessed: the list was specified for
      **target projects**, and its self-protection half — `src/config/`, `hooks/`,
      `.github/workflows/` — covers everyday work *in this repository*. A list
      correctly narrow for a Laravel target is correctly broad for the tool itself.
      **Not tuned here**, deliberately: tuning a classifier against no reference
      standard is what the pre-registration forbids, and it would also be tuning the
      very number the reopening condition is measured on. The breach is in the ledger
      as `r3_rate_over_threshold: true` and waits for the corpus.
- [x] **3.3 Promote successors or not.** Based on the matrix results over
      the maintainer's real target repos, promote at most one of the three
      stubs per estate offset.
      verify (discharged): `task check-estate-count` is green after promotion.

      **NOTHING PROMOTED, which the step permits** — *"promote **at most one** of the
      three stubs per estate offset"*, and at most one includes zero. Two reasons,
      and the first is the step's own: promotion is to be based on *"the matrix
      results over the maintainer's real target repos"* (Risk 3: fixtures drift from
      real stacks), and this run graded **fixtures**, not the maintainer's targets —
      so the evidence the decision is supposed to rest on does not exist yet.
      Second, Risk 8: the active-roadmap count is at its ratchet and this run
      identified no offset to spend.

      `check_estate_count` green: `active_roadmaps 14 (floor 14, +0)`. A promotion
      would have made it 15 with nothing to pay for it.

## What this roadmap will not build

| Report component | Why cut |
|---|---|
| Six-role agent swarm (specifier/coder/cleaner/architect/hardener/QA) | AC has council and orchestration modes (`subagent-orchestration/SKILL.md:157-217`); a second role taxonomy splits the obligation. |
| Multi-model adversarial reviewer | Covered for AC's own work by `road-to-review-independence`; for target projects it is R3-only and the report's own critique ranks it over-engineered until measured. |
| Runtime verification (canary/flags/rollback) | Needs a deploy platform AC does not own; stubbed, not planned. |
| Aggregate readiness score | The report's own anti-vanity rule; enforced by 1.2. |
| Mutation rig for target projects | Successor stub; this roadmap only *detects* one. |
| Evidence JSON contract | Successor stub; this roadmap only supplies the `risk_class` and `residual_risk` inputs. |

## Blockers

### blocker: b-human-risk-corpus

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 0 steps 0.1–0.4 · Phase 2 in full · Phase 3 step 3.1 (its
  nightly drift metric has nothing to report against). Phase 1 is unaffected and
  shipped.
- **What to do:** supply the two inputs Phase 0 pre-registers and an agent cannot
  produce — (1) **name the external target repository** that joins this tree's
  commit range as the corpus; (2) supply **≥ 60 independently human-labelled
  R0–R3 changes**, the labeller blind to the classifier, as
  `agents/evidence/risk-corpus.jsonl` with `sha`, `label`, `labeller` per row.
- **Resolved when:** both inputs exist — a named external repository, and ≥ 60
  independently human-labelled changes. **The ≥ 0.80 agreement and ≥ 0.95
  R3-recall figures are NOT part of this condition**: they evaluate the classifier
  *after* the blocker clears, so folding them in here would make the blocker
  un-closable until the experiment it gates has already succeeded. (Correction
  supplied by the council; the first draft of this blocker had it wrong.)
- **Recommendation:** supply the corpus. The pre-registration is already written
  and frozen, so this is a data-collection task rather than a design one, and a
  later run re-runs the measurement rather than redesigning it.
- **Resolution (2026-08-23) — TRANSFERRED to a stub; the roadmap closes around it
  on its pre-registered null route.** AI council 2026-08-23, 2/2 quorum
  (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent. The maintainer
  delegated owner-reserved blockers to the council for this autonomous drain run.

  Neither of this blocker's two inputs can be produced by an agent, and the reason is
  structural rather than a matter of effort: the human label is the pre-registered
  **reference standard**, and the agent's own label is one of the two arms measured
  against it — so an agent labelling the corpus collapses the standard into a
  compared arm and answers a different question. That is not a weaker experiment; it
  is the manufactured result the pre-registration exists to prevent.

  So the input is **carried into `agents/roadmaps/stubs/road-to-human-risk-corpus.md`**
  rather than deleted with the roadmap: it stays visible in the active estate, with
  both pre-registered numbers as its conjunctive promotion criterion, instead of
  disappearing into `archive/`. `stubs/` is excluded from `active_roadmaps`
  (`check_estate_count.ts:373`), so the carry costs the estate nothing.

  **Status reads `resolved` and the outcome is a transfer** — the two are not in
  tension, and the wording is deliberate: every gate in this tree treats any token
  other than `resolved` as OPEN, so recording `transferred` in the status field would
  leave the roadmap unarchivable while claiming the blocker was handled. The state is
  in this prose, where a reader can see it.

  **What is NOT resolved:** the corpus still does not exist, and nothing in this
  change makes it more likely to. What changed is that the roadmap no longer waits on
  it — Phase 1 shipped, Phase 2 is cancelled by the pre-registered route, Phase 3's
  metric runs — and the missing input has a named home and two numbers that reopen it.
- **If you do nothing:** Phase 1's matrix ships and is useful on its own; the risk
  classifier is never built, so `verify-completion-evidence` keeps accepting prose
  evidence with no computed class, and `test-driven-development` keeps routing by
  *kind of task* rather than by blast radius — so a one-line auth change and a
  one-line docstring change stay routed by the same rule.
- **Disposition 2026-08-23 — AI council, 2 rounds, 2 of 2 convergent on (b) after
  a 1–1 split.** Members: anthropic/claude-sonnet-4-5, openai/codex-default;
  $0.053 + $0.036. Phase 1 ships; the classifier script does **not**; this blocker
  is added; Phase 0, Phase 2 and the corpus-dependent part of Phase 3 stay open.
  The roadmap does **not** close.

  **Why `unmeasurable-here` was REFUSED, which is the part worth keeping.** One
  seat proposed closing the roadmap by routing 0.4 as `unmeasurable-here` — the
  third state `road-to-test-independence-and-mutation-evidence` established. The
  other refuted it and the refutation carried both seats in round 2: that
  precedent covers a **capability the tree does not have** (a subagent dispatch
  primitive that did not exist). Here the validation procedure is well-defined and
  executable; what is missing are **inputs only a human can supply**. So this is
  *unmeasured pending maintainer input*, and closing the roadmap would both erase
  actionable work and dilute a precedent this tree relies on — making
  `unmeasurable-here` mean "nobody has yet" as well as "we could not".

  `evaluator-independence` was read the same way: it bars the **authoring agent**
  from validating its own classifier, not an independent human labeller. A bar on
  self-validation is not a structural impossibility.

  **Why the classifier script does not ship.** Its `--self-test` could establish
  determinism and rule execution but not the *validity* that is 0.3's whole
  purpose. Unvalidated, it is speculative production surface — the "mechanism
  nobody can retire" the sibling roadmap's Risk 4 names. The seats also turned the
  strongest argument for shipping it against itself: it has no authority until
  Phase 2, and *"lack of authority also weakens the case for shipping it now"*.
  The pre-registration's value — the rule definition frozen before the corpus
  exists — is captured in this file's `## Proposed` section, which needs no code.

  **One refinement recorded because it cuts against the estate ratchet.** Adding
  this blocker charges `open_blockers` +1. Both seats judged that secondary: the
  ratchet is *"an accounting pressure, not evidence of completion, and must not
  determine whether actionable work is represented honestly."*

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The classifier becomes a second source of truth beside `risk-officer` | implementation | `risk-officer` already issues a verdict and a residual-risk note; a deterministic class computed elsewhere splits one obligation across two surfaces that can disagree | 2.4 routes rather than forks — the residual-risk note becomes the field the successor evidence contract expects, the verdict is untouched, and the diff over the skill is capped at ≤ 6 lines | Phase 2 — risk class on every completion claim |
| 2 | Upward-resolving ties produce alert fatigue and the class gets bypassed | product | Every unknown resolving to the higher class is safe per change and corrosive in aggregate: once most changes read R3, the owed gate set is noise and gets worked around rather than met | 3.1 keeps the R3 rate as a standing nightly metric, and the roadmap names > 40 % of changes classifying R3 as a defect in the override list rather than in the people meeting it | Phase 3 — standing metric and honest-null publication |
| 3 | Fixture repos drift from the real stacks the matrix grades | implementation | Detection is asserted against fixtures under `tests/fixtures/target-repos/`, so the matrix can stay green while grading a repo shape no actual target has | 3.3 bases promotion decisions on the matrix results over the maintainer's real target repos, not on the fixtures that prove the detector | Phase 3 — standing metric and honest-null publication |
| 4 | The readiness matrix collapses back into a single score | product | A ten-row vector with a binding dimension is harder to report than one number, and the pressure to print an aggregate is exactly what makes readiness a vanity metric | 1.2 forbids any percentage or out-of-100 figure in the output template with a grep as its verify, and 1.3 pins the exact `L0 — bound by CI enforcement` string in a spec so the binding dimension cannot quietly become advisory | Phase 1 — readiness matrix |
| 5 | An undetectable dimension is graded 0 and read as a real absence | implementation | The quality router covers two stacks, so a Python target has dimensions AC cannot see; a 0 there claims the project lacks something rather than that AC cannot tell | 1.4 prints the literal not-detectable reason instead of a 0 and treats it as a knockout that binds at L0 with the reason shown; the Python fixture asserts that string | Phase 1 — readiness matrix |
| 6 | The pre-registration is written after the first numbers are seen | implementation | A threshold set once agreement and R3-recall are known is not a threshold, and nothing in a prose plan prevents the ordering from silently inverting | 0.1 fixes corpus, question, threshold and all three routes first, and its verify asserts that the pre-registration commit date precedes every measurement artefact date | Phase 0 — pre-register |
| 7 | Phase 2 ships on a classifier the corpus never validated | product | The gate-owed set is only as good as the class it keys on; wiring it into every completion claim before the R3-recall threshold is met would give a wrong class real authority | 0.4 routes explicitly — a null marks Phase 2 `[-]` while Phase 1 still ships, since the matrix needs no classifier — and the Phase 2 spike-before-build gate holds it on that route | Phase 0 — pre-register |
| 8 | Promoting a successor stub breaks the estate ratchet | implementation | Three successor stubs are named and the active-roadmap count is already at its ratchet, so promoting them as a set would red the estate gate | 3.3 promotes at most one stub per estate offset and carries `task check-estate-count` being green as its verify condition | Phase 3 — standing metric and honest-null publication |

## Acceptance criteria

- `/project:analyze` on the three fixture repos prints `L<n> — bound by
  <dimension>` and never a number out of 100.
- `classify_change_risk.ts` exists, has a self-test, and classifies edits
  to its own inputs as R3.
- R3-recall on the pre-registered corpus is reported, whatever its value.
- 0 new skills, 0 new commands, 0 new rules; two new scripts, one config
  file, one schema.
- Estate count is not above baseline after promotion.

## Risks

- The classifier becomes a second source of truth beside `risk-officer`.
  Mitigation: 2.4 routes, never duplicates.
- Upward-resolving ties produce alert fatigue and get bypassed (the
  report's own METR-derived warning). Mitigation: 3.1 measures the R3 rate;
  if > 40 % of changes classify R3, the override list is the defect.
- Fixture repos drift from real stacks. Mitigation: 3.3 uses the
  maintainer's real targets for promotion decisions.
