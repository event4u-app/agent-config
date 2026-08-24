---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-10-01
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this addition carries no roadmap of its own to retire: the run archived only status: draft roadmaps, which were never counted and therefore cannot serve as an offset. The addition is sanctioned on its own terms -- its G0 gate passed against the live tree, so the defect it names is confirmed rather than hypothesised, and the estate decision it waits on is recorded as a blocker rather than assumed."
---
# Road to web launch readiness — a site-type-conditional pre-ship audit

> **Source:** agents/tmp.old/checklist/roadmap-web-launch-readiness.md

## Goal

One new skill, `web-launch-readiness`, audits the *web surface* of a consumer
project before it ships: indexability, custom error routes, per-route metadata,
image alternative text, canonical URLs, sitemap/robots coherence, required legal
pages, and analytics/consent wiring. Every check is **conditional on site type**,
carries a remediation and a verification step, and reports findings with evidence
rather than a todo list. Default-off until the pre-registered benchmark returns a
positive result.

## Context — what is verified in the tree

The source document shipped this as an unverified hypothesis behind its own
verification gate (its "Gate G0"). **That gate was run at landing and it
PASSED** — the defect is real and confirmed, not hypothesised. The measurement,
recorded verbatim so a later reader can re-run it:

1. **The web-surface vocabulary is absent from the estate.** Over
   `src/skills/ src/rules/ src/domains/`, case-insensitive, counting files:

   | Term | Files matching |
   |---|---|
   | `robots` | **0** |
   | `noindex` | **0** |
   | `meta description` | **0** |
   | `lighthouse` | **0** |
   | `alt text` | 7 |
   | `404` | 19 |

   The four zeroes are the finding. `alt text` and `404` match in unrelated
   contexts (accessibility prose and HTTP-status tables), not as launch checks.

2. **The nearest-named skill is a different domain.**
   `src/skills/launch-readiness/SKILL.md` is 220 lines and scores **0** on every
   one of `404 · robots · noindex · canonical · meta · alt text · analytics ·
   legal`. Its own description reads: "Use before merging a release-shaped PR —
   pre-merge checklist, rollout plan, rollback criteria, ops handoff." It is
   release engineering, not a web-surface audit.

3. **No sibling covers it either.** `gtm-launch` is launch waves;
   `operational-readiness` is go/no-go adjudication; `accessibility-auditor` is
   WCAG conformance. `frontend-render-security` covers XSS-shaped render risk.
   None audits indexability or per-route metadata.

4. **The repo already ships web-surface skills for consumer projects**, so the
   "this repo has no app runtime" objection does not hold: `accessibility-auditor`,
   `frontend-render-security`, `tailwind-engineer`, `react-shadcn-ui`, `blade-ui`,
   `iconography`, `design-review` all exist and all advise on a consumer's web
   surface. (The source's own objection also named `web-perf`; that skill does
   **not** exist in this tree — the objection was weaker than it claimed.)

**Verdict recorded at landing: CREATE `src/skills/web-launch-readiness/`, do not
extend `launch-readiness`.** Different domain, and folding a web audit into a
release-engineering checklist blurs a clean seam that currently reads correctly
from its description alone.

**Highest-value single item: the staging-leftover class** — a `noindex` meta tag
or a blocking `robots.txt` surviving into production. It has the highest damage
potential of anything in the checklist (a launched site invisible to search, with
no error surfaced anywhere) and the estate has literally zero coverage of it.
Phase 2 ships it first, alone, and it is the one check that must work before any
other lands.

## Design directive — conditional, not flat

Carried over from the source and binding on Phase 2: the checklist is
**conditional on site type**, never a flat list. A flat twenty-point list mixes
local-business items (team photo, map and directions, local business schema) with
app/SaaS items, and presents them at equal weight — which is the defect that
motivated the skill. Site type is inferred or asked as step 1, and every check
declares what it applies to.

Every rule carries three things or it does not ship: an **explanation** (why this
matters), a **remediation** (what to change), and a **verification step** (how to
confirm it is fixed). A rule with a finding and no remediation is a nag.

*(Design shape adapted from Source B, an external open-source checklist corpus
studied for its priority model and per-rule verifiability discipline. Its rule
corpus is **not** imported — see Phase 0.3.)*

## Phase 0 — Registration before any skill file exists

- [ ] **0.1 Record the G0 measurement as a dated evidence artefact** under
      `agents/evidence/analysis/`, with the per-term file counts above and the
      command that produced them.
      verify: the note exists, names the commit it was measured at, and its
      grep commands reproduce the same counts on a clean checkout.
- [ ] **0.2 Register the site-type axis** in
      `src/config/web-launch-readiness.json` (`schema_version`,
      `registered_at`, `owner`, `review_by`, per the budget-ownership pattern of
      `hook-latency-budget.json`). Enum: `local-business | marketing-site |
      saas-app | docs | internal-tool`. Every check declares an `applies_to`
      list and a `tier` of `critical | high | medium | situational`.
      verify: the config parses; every check entry has a non-empty `applies_to`,
      a `tier`, a `remediation` and a `verification` field, checked by a schema
      test rather than by review.
- [ ] **0.3 Record the no-import decision.** The external corpus is a study
      object and a per-defect harvest source only; its rule set is not imported.
      Rules enter one at a time, each against a named defect.
      verify: the decision is written in the skill's own body, and the shipped
      check count in Phase 2 is under 50.
- [ ] **0.4 Pre-register the benchmark and its null path** in `docs/CLAIMS.md`,
      status `unbacked`, BEFORE any skill code. Question: does the skill find
      more real launch defects than a bare "audit this site before launch"
      prompt on the same model? Design: three fixture sites of known defect
      state (one local-business-shaped static site, one SaaS-shaped app, one
      docs site), seeded with a staging `noindex`, a missing custom 404,
      missing metadata on two routes, three images without alternative text, a
      missing privacy-page link, and **one site-type-irrelevant decoy** (a
      missing team photo on the SaaS app, which must NOT be flagged). Metrics:
      precision and recall against ground truth, with the decoy false-positive
      as a **hard gate** — flagging it is a classification failure and DROPS the
      claim regardless of recall.
      verify: the entry exists, its threshold and its DROP consequence are fixed
      before data, and `check_claims` resolves its references.

**Exit:** evidence note, config, no-import decision and claim merged; zero skill
code written.
**Rollback:** delete three files; nothing consumes them yet.

## Phase 1 — The estate decision

- [ ] **1.1 Resolve `b-estate-decision-web-launch`** (below) before the skill
      file lands. This phase has no other step by design: the blocker is the
      phase.
      verify: the blocker carries a recorded disposition with a date and a
      named decider.

**Exit:** a recorded yes or no. A no parks this roadmap to `later/` with the
disposition as the reason, which is a publishable outcome and not a failure.

## Phase 2 — The skill, staging-leftover check first

- [ ] **2.1 Ship the indexability check alone.** `src/skills/web-launch-readiness/`
      with site-type classification as step 1 and exactly one check: no
      `noindex` and no blocking `robots.txt` on the production build.
      Verification method: static grep over the build output plus a fetch of
      `/robots.txt`. Tier `critical`, `applies_to` all site types.
      verify: on a fixture carrying a staging `noindex`, the skill reports a
      critical finding with the offending `file:line`; on a clean fixture it
      reports none. Both states demonstrated.
- [ ] **2.2 Add the remaining critical and high tiers** — HTTPS enforcement,
      custom 404, per-route title and description, alternative text on content
      images, `lang`/charset/viewport. Each with explanation, remediation and
      verification per the design directive.
      verify: each check has a fixture that fires it and a fixture that does
      not; `applies_to` is exercised by at least one skipped-with-reason case.
- [ ] **2.3 Add medium and situational tiers**, including the region axis for
      legal pages (DE: Impressum and Datenschutz as `critical` for
      DE-targeted sites).
      verify: a SaaS-app fixture reports the local-business items as
      `situational-skipped` **with the site type as the stated skip reason**,
      never as findings.
- [ ] **2.4 Tiered output shape.** Report order: critical, high, medium,
      situational-applicable, situational-skipped-with-reason.
      verify: a snapshot test pins the section order and the skip-reason text.
- [ ] **2.5 Default-off** until the Phase 3 benchmark returns positive.
      verify: with the flag absent, the skill does not activate on a
      would-fire prompt.

**Exit:** skill ships, flag off, under 50 checks, every check verifiable.
**Rollback:** delete the skill directory; the config and claim survive as a
recorded null.

## Phase 3 — Benchmark and verdict

- [ ] **3.1 Build the three fixture sites** to the Phase 0.4 ground-truth list,
      served locally in CI rather than deployed.
      verify: each fixture's seeded defect list is a checked-in manifest, and
      the decoy is present in exactly one fixture.
- [ ] **3.2 Run the comparator arm** — identical model, bare audit prompt, same
      site access.
      verify: both arms' raw outputs are archived with the run.
- [ ] **3.3 Resolve the claim** — PROVE, DROP, or UNDERPOWERED. The decoy gate
      is checked first: a decoy false positive is DROP regardless of the recall
      delta.
      verify: the verdict PR flips the claim status; on DROP the skill stays
      default-off and the null is recorded rather than noted.

**Exit:** a resolved verdict in either direction.

## Blockers

### blocker: b-estate-decision-web-launch
- **Status:** OPEN
- **Owner:** maintainer
- **Blocks:** Phase 1.1, and therefore every step from Phase 2.1 onward.
- **What it is:** whether the estate takes a new skill for this domain at all.
- **Why it is deliberately recorded as WEAK:** the source document deferred to
  an estate constraint of "~130 skills". That figure is **not registered
  anywhere in this tree** — it does not appear in
  `src/config/estate-count-budget.json`, which is the only estate-count budget
  config, and whose `target` block carries no skill number at all (only
  `active_roadmaps: 15` and `open_blockers: 12`, and its own `_comment` says
  those are "PROPOSALS, NOT REGISTERED … Nothing reads these values"). So the
  constraint this blocker exists to respect has no citable source. It is kept
  open anyway, because "the number is unregistered" is an argument about the
  *evidence* for a ceiling, not a licence to add skills without a decision.
- **What to do:**
  1. Read the G0 measurement in `## Context` above — the four zero-match terms
     are the whole evidential basis for a new skill.
  2. Decide whether this domain earns a skill slot, noting that the "~130
     skills" ceiling the source deferred to is not registered anywhere in the
     tree (see the WEAK note above).
  3. Record the decision, with a date, as this blocker's `Status`.
  4. On a yes, Phase 2 proceeds. On a no, move this file to `later/` with the
     disposition as the stated reason.
- **Recommendation:** record a yes. The G0 gate passed with four zero-coverage
  terms, the nearest-named skill scores zero on all eight web-surface checks,
  and the ceiling that would argue against it has no citable source. The risk
  of the addition is bounded by the Phase 3 benchmark, which is pre-registered
  with a hard DROP gate.
- **If you do nothing:** the roadmap stalls at Phase 1 indefinitely. No skill
  ships, the staging-`noindex` class stays at zero coverage, and the G0
  evidence note ages until someone re-runs it. Phase 1 is deliberately a
  single step so this stall is visible on the dashboard rather than buried
  mid-phase.
- **Resolved when:** a maintainer records a yes or a no, with a date, in this
  blocker. A yes unblocks Phase 2. A no moves this file to `later/`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Site-type misclassification flags irrelevant items | product | A SaaS app told to add a team photo teaches the developer to ignore the whole report — the exact defect that motivated the skill | Site type is step 1; every check declares `applies_to`; the benchmark's decoy false-positive is a hard DROP gate (0.4, 3.3) | Phase 0 — Registration before any skill file exists |
| 2 | Check corpus accretes toward the external rule set | implementation | A 385-rule corpus imported wholesale would duplicate existing coverage and blow the skill's scope | No-import decision recorded (0.3); per-defect entry only; shipped count capped under 50 and asserted in Phase 2 | Phase 0 — Registration before any skill file exists |
| 3 | Overlap with an existing skill emerges later | product | A future `accessibility-auditor` or `frontend-render-security` change could absorb part of this surface | G0 measurement is a dated, reproducible artefact (0.1) that can be re-run to detect the overlap appearing | Phase 0 — Registration before any skill file exists |
| 4 | Estate decision never arrives | implementation | The roadmap stalls at Phase 1 indefinitely with a blocker resting on an unregistered number | Phase 1 is a single step so the stall is visible rather than buried; a no is a defined outcome that parks the file | Phase 1 — The estate decision |
| 5 | Benchmark fixtures drift from real sites | implementation | Three synthetic fixtures may not represent real launch defects, making a PROVE verdict overfit | Ground truth is a checked-in manifest per fixture (3.1); both arms' raw output archived (3.2); UNDERPOWERED is a registered verdict | Phase 3 — Benchmark and verdict |

## Acceptance Criteria

- [ ] AC-1 — The G0 evidence note, the site-type config, the no-import decision
      and the benchmark claim all exist and predate the first skill commit in
      history.
- [ ] AC-2 — `b-estate-decision-web-launch` carries a recorded disposition with
      a date and a named decider.
- [ ] AC-3 — The indexability check reports a critical finding with a
      `file:line` on a staging-`noindex` fixture and reports none on a clean
      one — both states demonstrated in the PR.
- [ ] AC-4 — Every shipped check carries an explanation, a remediation, a
      verification step and a non-empty `applies_to`, asserted by a schema test
      rather than by review.
- [ ] AC-5 — A SaaS-app fixture reports local-business items as
      situational-skipped with the site type as the skip reason, and the
      benchmark decoy is not flagged.
- [ ] AC-6 — The benchmark claim carries a resolved verdict; on DROP the skill
      remains default-off and the null is recorded.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| File format | A bespoke YAML-in-fenced-block document with numbered prose sections (`## 1. Defect hypothesis`, `## 3. Proposal`) | Standard roadmap shape: real frontmatter, `## Goal`, `## Context`, phases with `- [ ]` steps each carrying `verify:`, Blockers, Risk Register, Acceptance Criteria | The source was a proposal memo, not a roadmap. Its `id:`/`type:`/`depends_on:` block was inside a ```yaml fence and so was not frontmatter at all — no gate would have read it, and `lint_roadmap_complexity` needs a real `complexity:` key. |
| Gate G0 | Unrun, with a blank SHA line to fill in, and every estate claim marked conditional on it | Run at landing; the measurement recorded verbatim in `## Context` with per-term file counts | The gate was the document's own precondition for existing. Landing it unrun would have shipped a roadmap whose entire premise was still a hypothesis. It passed. |
| Estate constraint | "estate targets (~130 skills, <=50 rules)" cited as a binding constraint | Recorded in `b-estate-decision-web-launch` as **unregistered**: the figure appears nowhere in the tree, and `estate-count-budget.json`'s `target` block carries no skill number | The constraint had no citable source. Stated as a weak blocker rather than dropped, since the absence of evidence for a ceiling is not a licence to skip the decision. |
| Scope objection | Implicitly conceded ("this repo has no app runtime") | Recorded as failing, with seven named counter-examples | The repo already ships seven skills advising on a consumer's web surface. The objection was self-refuting against the tree. |
| `web-perf` | Named as existing coverage | Recorded as **not present** in this tree | Checked at landing: `src/skills/web-perf` does not exist. The source's own objection cited a skill that is not there, which makes the objection weaker than it claimed rather than stronger. |
| Risk Register | Absent | Added, five rows, all `product` or `implementation` | `lint_plan_risk_register.ts:288-293` admits only those two values, and a roadmap without the section fails the register floor. |
| Blockers section | Absent; the estate decision sat in prose as "pending estate-budget decision" | One `### blocker:` record with owner, blocks-list and a resolution condition | A prose dependency is not a tracked one. |

**Verified at landing, not inherited.** Every count in `## Context` was measured
in this worktree: the four zero-match terms, the 220-line length and eight
zero-scores of `src/skills/launch-readiness/SKILL.md`, that skill's description
verbatim, the presence of the six sibling skills named, and the absence of both
`src/skills/web-launch-readiness` and `src/skills/web-perf`.
