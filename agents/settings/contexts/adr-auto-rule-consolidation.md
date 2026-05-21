---
status: locked
locked_at: 2026-05-08
supersedes: none
supersededBy: none
---

# ADR — Auto-Rule Consolidation (review-routing + transient-references pairs)

## Status

**Locked, 2026-05-08.** Executed as part of `road-to-augment-limit-fit.md`
Phase 3 (Lever D — auto-rule consolidation).

## Context

The Augment workspace-guidelines budget (49,512 chars) is consumed by
three components: `AGENTS.md`, full kernel always-rule bodies, and
auto-rule **registry stubs** (`If the user prompt matches the
description "<desc>", read the file located in <path>`). Each
auto-rule contributes one stub (~250 chars) regardless of body size.

After Phase 1 (description cap = 150 chars) and Phase 2 (AGENTS.md
outboarding), utilisation sat at **47,389 / 49,512 chars (95.7 %)** —
above the 95 % CI failure threshold and the 5 % headroom hard
constraint. Phase 3 was authorised to consolidate near-duplicate
auto-rules to reclaim the remaining headroom.

After Pair 1 (review-routing) was executed, utilisation only dropped
to **47,130 / 49,512 chars (95.2 %)** — still above the 95 %
threshold. Pair 2 (transient-references) was therefore also executed
to clear the threshold with the headroom buffer the council
convergence flagged as the minimum-acceptable target.

## Decision — what was merged

### Pair 1: `review-routing-awareness` + `reviewer-awareness` → `reviewer-awareness`

Both rules are auto-rules, tier 2a, route to the same skill
(`skill:review-routing`), and have **near-identical body content**
(each is a 2-line redirector — Iron-Law sentence + "Body migrated to
skill:review-routing" note). Trigger sets overlap on the keyword
`reviewer`.

- **Survivor:** `reviewer-awareness.md` (more cross-references, broader
  scope — "anchor reviewer choice in paths and risk").
- **Dropped:** `review-routing-awareness.md`.
- **Preserved:** both Iron Laws remain in the merged body (one for
  reviewer choice, one for routing/risk-hotspot consultation); all
  triggers from both rules merged into the survivor's frontmatter
  (`keyword: reviewer`, `phrase: suggest reviewers`, `phrase: risk
  hotspot`, `phrase: ownership map`).
- **Routing:** unchanged — `routes_to: skill:review-routing`.

### Pair 2: `no-council-references` + `no-roadmap-references` → `no-roadmap-references`

Both rules are auto-rules, tier 2a (mechanical-already), and target
the same agent behaviour: "do not link to a transient artefact from a
stable artefact." Trigger sets are disjoint by `path_prefix` but
share the **`intent`** keyword `link from stable artifact` /
`link to council artefact`. The bodies have distinct
Forbidden-Patterns sections (one per transient layer) — the merged
rule preserves both verbatim.

- **Survivor:** `no-roadmap-references.md` (broader trigger set,
  more cross-references in the repo, has companion linter
  `scripts/check_no_roadmap_refs.py`).
- **Dropped:** `no-council-references.md`.
- **Preserved:** both Iron Laws (the merged rule expresses both as
  one law with two clauses), all Forbidden-Patterns, all "What to do
  instead" guidance.
- **Renamed in body only:** title "No Transient References from
  Stable Artifacts" — filename retained for low-churn refs.
- **Companion linters unchanged:** both
  `scripts/check_no_roadmap_refs.py` and
  `scripts/check_council_references.py` keep their separate
  enforcement scopes; the latter now cites the merged rule.

The council convergence (Sonnet-4.5 + GPT-4o, 2026-05-08) called
Lever D "use only after A and B if headroom target not met." Headroom
target was not met after Pair 1, so Pair 2 was executed. Phase 3.5
of the roadmap ("halt at narrowest merge set") was honoured: only
the two pairs explicitly listed in Phase 3.1 were merged.

## Consequences

### Positive

- **Budget headroom restored** — Pair 1 + Pair 2 consolidation
  reclaimed two full registry stubs (~500 chars) and lifted
  utilisation below the 95 % failure threshold with the headroom
  buffer required by the parent roadmap acceptance criteria.
- **No behavioural change** for the agent — every Iron Law is still
  injected as an auto-rule routing hint; every keyword set still
  matches; routes are unchanged (`skill:review-routing`,
  `skill:ai-council`).
- **No silent feature loss** — Iron Laws and Forbidden-Patterns
  sections preserved verbatim in the merged bodies.

### Negative / risks

- **Cross-references** in `commands/review-routing.md`,
  `skills/{review-routing,ai-council,adr-create}/SKILL.md`,
  `templates/scripts/`, `docs/contracts/`, `tests/`, and
  `taskfiles/ci-fast.yml` need updating to drop
  `review-routing-awareness` and `no-council-references` links;
  verified via `task check-refs` + the two companion linters.
- **Auto-generated artefacts** (`agents/index.md`,
  `agents/settings/contexts/structural/file-ownership-matrix.md`,
  `agents/settings/contexts/rule-trigger-matrix.md`,
  `docs/contracts/file-ownership-matrix.json`, `docs/catalog.md`,
  `router.json`) need regeneration via `task sync`.

## Alternatives considered

- **Merge under a new name (`review-governance.md`,
  `no-transient-references.md`)** — rejected; it would force every
  cross-reference in the repo to be re-pointed, multiplying churn
  for zero additional savings vs. keeping the broader sibling as
  the survivor.
- **Demote `review-routing-awareness` to a guideline-only reference**
  — rejected; the trigger keywords (`risk hotspot`, `ownership map`)
  are needed at the auto-rule registry level for Augment's matcher.
- **Skip Pair 2** — initial plan; rejected when the post-Pair 1
  budget measurement (95.2 %) showed Pair 1 alone did not clear the
  95 % CI failure threshold.

## Reactivation triggers

Re-open this ADR if:

1. `scripts/measure_augment_budget.py` reports utilisation ≥ 90 %
   sustained for two CI runs (per parent roadmap reactivation
   trigger).
2. Either merged rule's body grows beyond 1 kB and the two concerns
   become editorially distinct again.

## See also

- [`road-to-augment-limit-fit`](../roadmaps/archive/road-to-augment-limit-fit.md)
  — parent roadmap (Phase 3).
- [`adr-always-budget-relief-strategy`](adr-always-budget-relief-strategy.md)
  — superseded sibling roadmap; this ADR closes Phase 3.
- [`reviewer-awareness`](../../.agent-src.uncompressed/rules/reviewer-awareness.md)
  — Pair 1 merged rule.
- [`no-roadmap-references`](../../.agent-src.uncompressed/rules/no-roadmap-references.md)
  — Pair 2 merged rule (covers both transient layers).
