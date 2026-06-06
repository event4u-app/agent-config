---
stability: beta
keep-beta-until: 2026-09-04
---

# Evidence-based pruning contract

> 6.0.0-C Phase 3 Step 7. The **rule by which a later, data-bearing roadmap
> cuts** personas, skills, and rules — replacing the part1 feedback's arbitrary
> targets (4 personas, halve rules, 223→120 skills) with measured thresholds.
> **No artefact is cut by this contract or by 6.0.0-C.** This phase ships the
> thresholds; a future roadmap, holding ≥ 30 days of telemetry, applies them.

## Why thresholds, not targets

The external review demanded fixed reduction numbers. The council
(claude-sonnet-4-5 + gpt-4o, 2026-06-02) rejected them as guesses:

> "Both the plan ('223 is fine') and the reviewer ('223 is too many') argue
> maintenance burden in the absence of data. Add telemetry; decide on usage."

A target says "cut to N". A threshold says "an artefact below this measured bar
is a *candidate*, surfaced for a human merge/deprecate decision." The cut is
always defensible because it traces to a number, and the option-value artefacts
(rarely-loaded but load-bearing when they fire) survive unless the data says
otherwise.

## The data source

The thresholds read the local-analytics events added in Step 6
([`local-analytics.md` § Event vocabulary](local-analytics.md)):
`rule.tier2_loaded`, `persona.cited`, `skill.activated`, plus the existing
git-history and citation signals. Local, anonymized, opt-out, 90-day retention —
never POSTed. A pruning pass requires **≥ 30 days** of telemetry before any
candidate list is trustworthy; a shorter window is surfaced as "insufficient
data", never as "unused".

## Thresholds

### Personas — deprecation candidate

A specialist persona is a **deprecation candidate** when **both** hold:

- **< 5 skill citations** — counted by `lint_persona_governance.py`'s
  `citations_for()` (the `personas: [<id>]` frontmatter references), and
- **< 3 commits in the trailing 12 months** — from `git log --follow` on the
  persona file.

Both, not either: a persona cited by 4 skills but actively maintained is not
dead; a persona with 6 stale citations is not dead either. Core personas
(`developer`, `senior-engineer`, `product-owner`, `stakeholder`,
`critical-challenger`, `ai-agent`) are **exempt** — they are always-loaded
cross-cutting lenses, not domain specialists (per `persona-governance`).

### Skills — merge candidate

A pair of skills is a **merge candidate** when **both** hold:

- **> 70% content overlap** — content similarity (not name-prefix), measured by
  the Phase 4 overlap analysis (Step 8), and
- **same domain** — both map to the same content domain.

Merge candidate ≠ merge order: the pair is surfaced for a human merge decision
that preserves the stronger skill's triggers, examples, and anti-patterns (per
`preservation-guard`). Scope ladders, union dispatchers, and tier-gated
specialists that *look* similar but are intentionally distinct are kept.

### Rules — prune candidate

A tier-2 (router-gated) rule is a **prune candidate** when:

- **< 5% load rate over 30 days** — `rule.tier2_loaded` events for the rule
  divided by sessions in the window, below 5%.

Kernel (always-on) rules are **exempt** — they are not router-gated and carry no
load signal. A tier-2 rule that fires rarely but is load-bearing when it does
(a safety floor, a destructive-op gate) is surfaced with its load contexts so
the human decision sees *why* it fired, not just *how often*.

## The decision is always human

Every threshold produces a **candidate list**, never an automatic deletion. The
pruning roadmap that consumes this contract:

1. Runs the measurement (telemetry window ≥ 30 days + overlap analysis).
2. Produces the candidate lists under `agents/reports/`.
3. Surfaces each candidate with its evidence (citation count, commit count, load
   rate, overlap pair + similarity score).
4. A maintainer decides merge / deprecate / keep per candidate, recording the
   rationale (ADR for structural cuts, commit message for routine ones).

No artefact is deleted by a number alone. The number qualifies it as a
candidate; the human, seeing the evidence, makes the call.

## See also

- [`local-analytics.md`](local-analytics.md) — the measurement events + privacy floor.
- [`capability-packs.md`](capability-packs.md) — sibling per-pack budget governance.
- [`ADR-041`](../decisions/ADR-041-controlled-command-verbs.md) — sibling command-surface governance.
- `lint_persona_governance.py` — persona citation counting.
- `scripts/audit_skill_overlap.py` — skill-family overlap analysis (Step 8).
