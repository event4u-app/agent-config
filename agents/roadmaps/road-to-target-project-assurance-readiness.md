---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Ships status: draft, same terms as its parent road-to-agentic-engineering-assurance: no charge until the owner flips it, and no unrelated roadmap archived to pay for it. It is the parent's Phase 1 matrix carrier and has no active sibling covering target-repo readiness grading."
---
# Road to target-project assurance readiness

> **Source:** `agents/tmp.old/robert-c-martin/road-to-target-project-assurance-readiness.md` — landed by `/analyze:inbox` on 2026-08-22.
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

- [ ] **0.1 Pre-register.** Under `agents/evidence/`, before any
      measurement: the corpus (a commit range of this tree plus one external
      target repo the maintainer names), the question *"does a
      deterministic path+diff classifier agree with a human's risk label
      more often than the implementing agent's self-declared label?"*, the
      threshold (agreement with human label ≥ 0.80 on R3, and R3-recall ≥
      0.95 — a missed R3 is the failure that matters), and the three routes
      (pass / null / ambiguous).
      verify: `git log --format=%aI -1 -- <pre-reg>` precedes every
      measurement artefact's date.
- [ ] **0.2 Hand-label the corpus.** ≥ 60 changes, labels R0–R3, labeller
      blind to the classifier. Store as `agents/evidence/risk-corpus.jsonl`.
      verify: the file exists, every row has `sha`, `label`, `labeller`,
      and no row carries a `classifier` field yet.
- [ ] **0.3 Run the classifier as a script, not a prompt.** A single
      `src/scripts/classify_change_risk.ts` reading `git diff --name-only`
      plus the override list; no model call. Compare against 0.2 and against
      the agent-declared class harvested from the same changes' PR bodies
      where one exists.
      verify: the script has a `--self-test` path wired through
      `src/scripts/_lib/gate_self_test.ts` like its neighbours, and the
      artefact reports agreement and R3-recall against the 0.1 thresholds.
- [ ] **0.4 Route.** Pass → Phases 1–3 open. Null → Phase 1 still ships
      (the matrix needs no classifier), Phase 2 is marked `[-]` and the
      standing metric from 0.3 keeps running nightly so a later run can
      re-open it. Ambiguous → the route named in 0.1.
      verify: the decision is recorded in this file citing the artefact.

## Phase 1 — readiness matrix inside `/project:analyze`, not beside it

0 new skills, 0 new commands. The matrix is a section of the existing
analysis.

- [ ] **1.1 Extend detection to the dimensions.** Add to the parallel
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
- [ ] **1.2 Print the matrix with the binding dimension, never a score.**
      The output block gains a `READINESS` section:
      `L<n> — bound by <dimension>` followed by the ten rows. No
      percentage, no "x/100" anywhere in the template.
      verify: `grep -nE '/100|%' src/domains/engineering-base/project/analyze/command.md`
      over the new section returns nothing.
- [ ] **1.3 Knockout semantics are tested, not described.** A fixture with
      nine dimensions at 3 and `CI enforcement` at 0 must print `L0 — bound
      by CI enforcement`.
      verify: the vitest spec asserts exactly that string.
- [ ] **1.4 Stack coverage honesty.** For Python targets, the matrix
      prints `static analysis & types: not detectable — quality-tools has
      no Python mode` rather than 0, until the successor roadmap adds the
      mode. An undetectable dimension is a knockout: it binds at L0 with the
      reason printed.
      verify: Python fixture output contains the literal reason string.

## Phase 2 — risk class on every completion claim

Gated by `blocker: spike-before-build` on 0.4.

- [ ] **2.1 `verify-completion-evidence` consumes the classifier.** A new
      step in the procedure of
      `src/skills/verify-completion-evidence/SKILL.md` runs
      `classify_change_risk.ts` and prints the class and the owed gate set
      **before** the existing fresh-output gate. The owed set for each class
      is a table in `src/config/assurance-policy.json`, not prose in the
      skill.
      verify: `wc -l` of the skill stays under 400; the policy file
      validates against a JSON schema committed beside it.
- [ ] **2.2 TDD gating by risk, in addition to kind.** Append to
      `test-driven-development/SKILL.md:21-26` one line: *"Also mandatory,
      regardless of the list above, when the change classifies R2 or
      higher."* The kind-based exclusions still apply at R0–R1.
      verify: the line cites `classify_change_risk.ts`; the file stays
      under its cap.
- [ ] **2.3 Self-protection is R3 by construction.** The override list
      contains AC's own settings path, `.github/workflows/`, hook
      directories and `src/config/assurance-policy.json` itself.
      verify: a spec classifies a one-line edit to the policy file as R3.
- [ ] **2.4 Route `risk-officer` through the class, do not fork it.**
      `risk-officer/SKILL.md` gains a pointer: its residual-risk note (`:79`)
      becomes the `residual_risk` field the successor evidence contract
      expects; its verdict (`:87`) is not changed.
      verify: diff over `risk-officer/SKILL.md` is ≤ 6 lines.

## Phase 3 — standing metric and honest-null publication

Ships regardless of 0.4.

- [ ] **3.1 Nightly classifier drift.** A scheduled workflow re-runs 0.3
      over the last 30 days of merged changes and appends agreement /
      R3-recall to `agents/evidence/risk-classifier-drift.jsonl`.
      verify: the workflow has a `schedule:` trigger and no
      `pull_request:` trigger — the classifier runs in-session per change,
      the *measurement* runs nightly.
- [ ] **3.2 Publish the null if there is one.** If 0.4 routed null, the
      roadmap closes with outcome `measured-null` and the drift metric
      stays; no "we'll revisit" without a re-open threshold named.
      verify: closing entry names the re-open threshold numerically.
- [ ] **3.3 Promote successors or not.** Based on the matrix results over
      the maintainer's real target repos, promote at most one of the three
      stubs per estate offset.
      verify: `task check-estate-count` is green after promotion.

## What this roadmap will not build

| Report component | Why cut |
|---|---|
| Six-role agent swarm (specifier/coder/cleaner/architect/hardener/QA) | AC has council and orchestration modes (`subagent-orchestration/SKILL.md:157-217`); a second role taxonomy splits the obligation. |
| Multi-model adversarial reviewer | Covered for AC's own work by `road-to-review-independence`; for target projects it is R3-only and the report's own critique ranks it over-engineered until measured. |
| Runtime verification (canary/flags/rollback) | Needs a deploy platform AC does not own; stubbed, not planned. |
| Aggregate readiness score | The report's own anti-vanity rule; enforced by 1.2. |
| Mutation rig for target projects | Successor stub; this roadmap only *detects* one. |
| Evidence JSON contract | Successor stub; this roadmap only supplies the `risk_class` and `residual_risk` inputs. |

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
