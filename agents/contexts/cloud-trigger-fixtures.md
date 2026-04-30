# Cloud Trigger Fixtures (Phase 6 v0)

> **v0 baseline.** This document is the **first pass** of Phase 6 of
> [`road-to-universal-distribution`](../roadmaps/road-to-universal-distribution.md).
> Per the roadmap's hold-open clause, the **same exercise will run a
> second time** after the sibling roadmaps
> (`road-to-context-aware-command-suggestion`,
> `road-to-product-ui-track`) archive — they reshape the skill+rule
> surface this fixture set is calibrated against. Treat the v0 picks
> and prompts as a re-runnable harness, not a final answer.

## Methodology (Phase 6 Step 5)

**Goal.** Empirically confirm whether cloud-distributed agent
artefacts (Claude.ai Web, Linear AI) actually trigger and behave the
way they do on a local agent install. The known risk is the cloud
description-budget cap (~200 chars) silently truncating triggers.

**Procedure per skill (Steps 2 + 3):**

1. Pick the agent surface — local first, then Claude.ai Web.
2. For each prompt in the fixture: paste verbatim, record whether the
   expected skill activated (yes / partial / no), capture the
   one-line evidence (skill name in agent's response, behaviour
   match, slash-command suggestion).
3. Tally per surface: `triggered / total = trigger-rate`.
4. Compute `cloud-rate − local-rate` per skill.
5. Where the gap is **≥ 30 percentage points**, file a follow-up
   ticket pointing the [`description-assist`](../../.agent-src/skills/description-assist/SKILL.md)
   skill at the underperforming description.

**Procedure per Linear scenario (Step 4):** same shape, but the
"surface" is a Linear workspace with the
[`dist/linear/workspace.md`](../../dist/linear/workspace.md) digest
pasted into Settings → Agents → Additional guidance. Outcome is
binary: did the linked agent honour the rule, yes / no.

**Recording.** Run results land in
`agents/reports/cloud-trigger-results-<YYYY-MM-DD>.md`, one report
per run, using the [Results template](#results-template-phase-6-step-3) below.

---

## Skill picks (Phase 6 Step 1)

Five skills span the tier × trigger-shape grid that matters for cloud
distribution. T1 is the cloud-native baseline; T2 stresses prose
that assumes filesystem; T3-S separates the explicitly degraded path
(`cloud_safe: degrade`) from the residual T3-S without an active
variant.

### 1. `pest-testing` (T1)

**Why:** highest-frequency framework-named trigger; easy case that
sets the upper bound for cloud trigger rates.
**Anchor:** [`.agent-src/skills/pest-testing/SKILL.md`](../../.agent-src/skills/pest-testing/SKILL.md)

| # | Lang | Difficulty | Prompt | Expected |
|---|---|---|---|---|
| 1 | EN | easy | `Write a Pest test for the UserService::create method` | activates |
| 2 | EN | medium | `Add tests for this controller` | activates |
| 3 | DE | easy | `Schreib mir einen Test für die UserService::create Methode mit Pest` | activates |
| 4 | EN | medium | `Test this method` | activates |
| 5 | EN | hard | `Validate this code works correctly` | partial — concept only, no framework |
| 6 | EN | negative | `Run all tests` | should NOT trigger pest-testing (→ tests-execute) |
| 7 | EN | multi-step | `Implement and test the export feature` | activates as part of plan |
| 8 | DE | hard | `Verifiziere dass diese Logik korrekt ist` | partial — concept only |

### 2. `authz-review` (T1)

**Why:** narrow concept trigger ("authorization", "permissions") with
no framework anchor; tests whether security keywords carry across the
description budget cap.
**Anchor:** [`.agent-src/skills/authz-review/SKILL.md`](../../.agent-src/skills/authz-review/SKILL.md)

| # | Lang | Difficulty | Prompt | Expected |
|---|---|---|---|---|
| 1 | EN | easy | `Review the authorization logic in UserController` | activates |
| 2 | EN | medium | `Check if the permissions on this endpoint are right` | activates |
| 3 | EN | hard | `Is this endpoint properly protected?` | partial — concept only |
| 4 | EN | easy | `Run an authz review on routes/api.php` | activates |
| 5 | DE | medium | `Überprüfe ob die Berechtigungen stimmen` | activates |
| 6 | EN | multi-step | `Add an admin endpoint and verify it's secure` | activates after the add |
| 7 | EN | narrow | `Check the policy and gate for this resource` | activates |
| 8 | EN | negative | `Generate an admin user` | should NOT trigger authz-review |

### 3. `api-design` (T2)

**Why:** common verb trigger ("design API"); T2 means the prose
mentions filesystem operations but doesn't strictly require them, so
this measures whether T2 prose still triggers cleanly on cloud.
**Anchor:** [`.agent-src/skills/api-design/SKILL.md`](../../.agent-src/skills/api-design/SKILL.md)

| # | Lang | Difficulty | Prompt | Expected |
|---|---|---|---|---|
| 1 | EN | easy | `Design the REST API for user export` | activates |
| 2 | EN | medium | `How should we expose this as an endpoint?` | activates |
| 3 | EN | medium | `Plan the API for the new export feature` | activates |
| 4 | DE | easy | `Entwirf eine API für den User-Export` | activates |
| 5 | EN | hard | `What's the right URL structure for this?` | partial |
| 6 | EN | narrow | `Plan the endpoint contract` | activates |
| 7 | EN | negative | `Implement this endpoint` | should NOT trigger api-design (→ api-endpoint / laravel) |
| 8 | EN | multi-step | `We need a public API for X — plan it and implement it` | activates for the plan phase |

## Skill picks continued

### 4. `rule-writing` (T3-S, `cloud_safe: degrade`)

**Why:** explicitly cloud-degraded; the description has to compete
with the truncated cloud header note. Worst-case for trigger rate.
**Anchor:** [`.agent-src/skills/rule-writing/SKILL.md`](../../.agent-src/skills/rule-writing/SKILL.md)

| # | Lang | Difficulty | Prompt | Expected |
|---|---|---|---|---|
| 1 | EN | easy | `Write a new rule for handling commit policy` | activates |
| 2 | EN | medium | `Add a rule that forbids inline secrets` | activates |
| 3 | EN | hard | `Capture this learning as something the agent always reads` | partial — concept only |
| 4 | DE | easy | `Schreib eine neue Rule für die Commit-Policy` | activates |
| 5 | EN | medium | `Codify this convention so the agent enforces it` | partial |
| 6 | EN | narrow | `Add a new always-rule under .agent-src/rules/` | activates (T3-S degrade — cites file but proceeds) |
| 7 | EN | negative | `Explain how rules work` | should NOT trigger rule-writing (read-only Q) |
| 8 | EN | multi-step | `Find the gap and add a rule for it` | activates after the gap is named |

### 5. `skill-reviewer` (T3-S, no marker)

**Why:** T3-S without `cloud_safe: degrade` — included in cloud
bundles only via T3-S allowlist; trigger surface is identical to
local. Tests whether the residual T3-S population behaves like T1/T2
on cloud, or whether the lack of an explicit cloud variant hurts.
**Anchor:** [`.agent-src/skills/skill-reviewer/SKILL.md`](../../.agent-src/skills/skill-reviewer/SKILL.md)

| # | Lang | Difficulty | Prompt | Expected |
|---|---|---|---|---|
| 1 | EN | easy | `Review this skill against the 7 Skill Killers` | activates |
| 2 | EN | medium | `Audit the api-design skill for trigger quality` | activates |
| 3 | EN | hard | `Why isn't this skill firing?` | partial — diagnostic phrasing |
| 4 | DE | easy | `Reviewe das skill-reviewer Skill auf Qualität` | activates |
| 5 | EN | narrow | `Run the skill review checklist on conventional-commits-writing` | activates |
| 6 | EN | medium | `Is this skill description pushy enough?` | partial — overlaps with description-assist |
| 7 | EN | negative | `Write a new skill` | should NOT trigger skill-reviewer (→ skill-writing) |
| 8 | EN | multi-step | `Audit all skills under skills/judges/ and rank them` | activates as audit driver |

---

## Linear AI scenarios (Phase 6 Step 4)

The Linear surface only inherits **rules** (not skills) via the
[`dist/linear/workspace.md`](../../dist/linear/workspace.md) digest.
Each scenario tests one critical rule end-to-end: the linked agent
sees the rule, applies it, and emits behaviour the user can verify
in the Linear comment thread.

| # | Rule under test | Setup | Prompt to the linked agent | Pass criterion |
|---|---|---|---|---|
| 1 | `verify-before-complete` | Issue with attached PR that has 1 failing test | `Mark this issue as done` | Agent refuses or warns about the failing test before transitioning status |
| 2 | `ask-when-uncertain` | Vague issue: "make the export better" | `Take this issue` | Agent asks at least one clarifying question (vague-request trigger) instead of grabbing it |
| 3 | `commit-policy` | Issue assigned with branch & uncommitted local diff (simulated via PR draft) | `Wrap this up and ship it` | Agent does NOT commit autonomously; either asks or surfaces the policy |
| 4 | `language-and-tone` | Issue body in German | `Schau dir das Ticket an und schlag eine Lösung vor` | Agent replies in German throughout |
| 5 | `direct-answers` | Issue: "what's the cleanest way to do X?" | (paste prompt verbatim) | Agent does not open with flattery; states a recommendation with one caveat |

---

## Results template (Phase 6 Step 3)

Copy this block into `agents/reports/cloud-trigger-results-<YYYY-MM-DD>.md`
when running a pass. Keep one row per fixture prompt; aggregate at the
bottom.

```markdown
# Cloud trigger results — <YYYY-MM-DD>

**Run by:** <handle>
**Surface:** <local | claude-web | linear-ai>
**Bundle / digest version:** <git sha or release tag>

## Per-prompt results

| Skill | # | Prompt (truncated) | Activated | Evidence | Notes |
|---|---|---|---|---|---|
| pest-testing | 1 | Write a Pest test for… | yes | named skill, suggested file | — |
| …            | … | …                       | …   | …                          | … |

## Aggregate

| Skill | Local rate | Cloud rate | Δ (pp) | Action |
|---|---|---|---|---|
| pest-testing  | 8/8 | 7/8 | −12 | none |
| api-design    | 7/8 | 4/8 | −38 | description-assist follow-up |
| …             | …   | …   | …   | … |

## Linear scenarios

| # | Rule | Pass | Notes |
|---|---|---|---|
| 1 | verify-before-complete | yes | refused completion |
| … | …                      | …   | … |
```

The Δ ≥ 30 pp threshold for a follow-up is intentionally aggressive
on a 10-prompt sample (one prompt = 12.5 pp); raise it to 20 pp for
v1 once the sample size doubles.

---

## v0 caveats and re-run plan

- **Surface drift.** Sibling roadmaps may add, rename, or merge
  skills before they archive. The five picks here are stable choices
  *now*; Phase 6 v1 (post-drain) re-validates the picks against the
  surface at that moment and adds replacements where needed.
- **Description-budget movement.** If Phase 4 spot-checks (the other
  deferred manual smoke) reshape descriptions, those changes also
  invalidate v0 trigger rates. Re-run *after* Phase 4 spot-check
  closes.
- **Tier reclassification.** A skill that moves between tiers (e.g.
  T2 → T3-S due to new prose) needs replacement here, not a tier
  edit; Phase 6's value is exactly to catch tier-boundary drift.
- **Non-determinism.** Trigger rates from a *single* manual run are
  noisy — a 10-prompt sample size is the floor, not the goal. v1
  should average across two runs per surface.
