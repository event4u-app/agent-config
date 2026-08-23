---
adr: 245
status: accepted
date: 2026-08-23
decision: frontend-design-pack-reach
supersedes: —
superseded_by: —
phase: —
type: structural
reopen_policy: owner
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - src/config/discovery/packs.yml
    - internal/bench/frontend-power/BASELINE-2026-08-23.md
    - agents/runtime/council/questions/frontend-power-pack-reach.md
review_trigger: >-
  Reopen on an intervention-arm measurement — not on an argument. Specifically:
  a measured frontend-enforcement benefit across `laravel` and `react` installs,
  paired with the measured always-loaded context cost of carrying
  `frontend-design`, where the benefit-times-reach product exceeds that cost and
  the total stays inside the standing-context budget. A second, independent
  trigger: evidence that UI-writing is NOT minority behaviour inside those packs
  — both council seats flagged that premise as asserted rather than measured, and
  if it inverts, the cost/benefit changes shape rather than degree. Explicitly
  NOT a reopen trigger: a preference for wider default reach with no number
  behind it, which is the argument this record already weighed.
---

# ADR-245 — `frontend-design` keeps `suggests:`, and every enforcement number is scoped to it

## Status

**accepted** — 2026-08-23. AI council, 2 of 2 seats, convergent on option (c).
Record: `agents/runtime/council/questions/frontend-power-pack-reach.md` and its
response. Resolves `b-pack-reach-weight` on
`agents/roadmaps/archive/road-to-frontend-power.md`.

## Context

`road-to-frontend-power` builds the intervention arm the 0.0 % UI-write
measurement never had. Every enforcement number it produces is conditional on a
pack the default install does not carry, and that condition was undocumented.

Verified at HEAD:

- `src/config/discovery/packs.yml:69` — the `laravel` pack lists
  `frontend-design` under `suggests:`, with an inline comment recording that a
  `requires:` "would force the weight on every install".
- `:107` — the `react` pack does the same.
- `:123-131` — the `frontend-design` pack declares no `default_install`.
- Consequence: an `engineering-base`-only install receives **neither**
  `ui-audit-gate` **nor** `design-review-after-ui-write`.
- `lint_rule_skill_pack_reach` constrains rule→skill reach. It does **not**
  constrain whether the pack carrying the rule is installed at all.
- The extended always-rule budget stands at **60,252 / 60,254 chars**
  (`check_always_budget`, measured this session) on a ratchet that may only move
  **down**. Two characters of headroom.

## Decision

**Keep `suggests:`. Scope the claim.**

1. `src/config/discovery/packs.yml` is **not changed** by this record, and not
   by the commit that lands it.
2. Every enforcement number this roadmap publishes states whether it holds for
   an `engineering-base`-only install. Where it does not, it says so.
3. Phase Z reports **coverage and effectiveness separately**. A strong
   effectiveness figure among opted-in installs must not be presented as
   suite-wide enforcement — that conflation is the specific failure this
   decision's disclosure obligation exists to prevent.

### Standing-context cost of the chosen option

**Zero new characters.** No config changes, so no rule is added to any install
that did not already carry it. The budget stays at 60,252 / 60,254.

The cost is therefore not in tokens; it is the **unmeasured reach gap**, and
naming it as the real cost is the point of recording the decision at all.

### The trade-off, stated rather than implied

This chooses **accurate measurement on opted-in installs** over **partial
measurement on all installs**. The alternative — forcing `frontend-design` via
`requires:` or `default_install: true` — would buy wider reach at a permanent
standing-context cost against a ratchet with two characters of headroom, on the
strength of no intervention-arm data at all.

The counter-argument is real and is not dismissed: the roadmap's own premise is
that frontend enforcement measured 0.0 % because nothing was ever switched on,
and choosing (c) guarantees that for an `engineering-base`-only install nothing
still is. "Scope the claim" can be read as documenting the failure rather than
fixing it. Both seats weighed that and still chose (c), because the fix costs
every install and the evidence that it would work does not yet exist.

### One premise is asserted, not measured

Both seats flagged it independently: the claim that **UI-writing is minority
behaviour inside `laravel` and `react` installs** is plausible and unverified.
No frequency data exists for it. It is recorded here as an assumption, and its
inversion is a named reopen trigger, so a later reader is not left believing it
was established.

### Bounding the gap is possible and was not done here

The 0.0 % baseline recorded **275 UI-write turns across 16 sessions**. How many
of those sessions carried `frontend-design` is answerable, and it would turn
"unmeasured reach gap" into a number. It is not answered in this change: the
session store is per-machine and gitignored, so the query is a maintainer action
on their own transcripts rather than a repository one. Stated as available work,
not as a finding.

## Alternatives

| Option | Why not |
|---|---|
| **(a)** `requires: [frontend-design]` on `laravel` and `react` | Forces the standing-context weight on every install of either pack, against a monotonically-shrinking budget at 100.0 %, with no intervention-arm evidence that it buys anything. Also a shipped-default flip: owner-reserved under Rule 3 of the drain-disposition framework, so a council may record a preference but not execute it. |
| **(b)** `default_install: true` on `frontend-design` | The same objection, everywhere rather than in two packs. |
| **Do nothing** | The reach gap becomes an unstated precondition of every headline number — the failure mode the blocker names. |

## Consequences

- `AC-11` of `road-to-frontend-power` is met verbatim; no criterion is weakened.
  The openai seat's verdict on this was explicit: "None required. AC-11 remains
  fully meetable verbatim."
- Phase Z must carry a per-install-shape column. A number without it is
  incomplete under this record.
- Options (a) and (b) remain open to the **owner**, not to the council, and
  `reopen_policy: owner` records that.

## Evidence

| Claim | Basis |
|---|---|
| `frontend-design` is `suggests:` from both packs and has no `default_install` | `src/config/discovery/packs.yml:69` (`laravel`), `:107` (`react`), `:123-131` (the pack); read this session |
| The weight reasoning is already recorded by the maintainer, not invented here | The inline comment at `packs.yml:69` — a `requires:` "would force the weight on every install". `owner_intent` provenance, surfaced rather than overruled |
| An `engineering-base`-only install receives neither UI rule | Both rules declare `packs: [frontend-design]`; `lint_rule_skill_pack_reach` constrains rule→skill reach and not pack installation, so nothing else closes the gap |
| The standing-context budget has two characters of headroom on a down-only ratchet | `check_always_budget`, run this session: extended 60,252 / 60,254 chars (100.0 %), "may only move DOWN" |
| Choosing (c) costs zero standing-context characters | The same command, run after the change: 60,252 / 60,254, unchanged. No config touched |
| There is no intervention-arm evidence for (a) or (b) | The 0.0 % baseline (`road-to-frontend-skill-application.md:23`) was taken with `design_slop.enabled: false` and `ui_route_nudge.enabled: false` in every measured store — a control arm with nothing to compare against |
| The shipped detector produces no actionable finding on a 20-case frontend population today | `lint_design_slop --dir tests/eval/frontend-corpus --json`: 0 P0, 0 P1, 2 P2, `overThreshold: 0` (`internal/bench/frontend-power/BASELINE-2026-08-23.md`) |
| (a) and (b) are owner-reserved rather than council-decidable | `agents/evidence/council/drain-blocker-dispositions-a.md` § Framework rule 3 — a shipped-default flip takes `B`, never `D` |

The grade is **E2 — repeated and comparative**, and deliberately not higher.
Every number above is a live measurement of *this* tree, taken twice where the
claim is a delta (before and after, for the budget), and the reach consequence
is read off two independent files rather than one. It is not E3: there is no
external authority and no pre-registered benchmark behind the *choice* — the
prereg in `internal/bench/frontend-power-PREREG.md` governs the enforcement
metrics, not this weight decision.

**What the evidence does NOT establish, stated so the grade is not read as more
than it is.** It does not show that forcing `frontend-design` would fail. It
shows that nothing here measures whether it would succeed, that the cost of
finding out the expensive way is permanent against a ratchet at 100.0 %, and
that the party who recorded the original weight reasoning is the owner. On that
basis the reversible option wins; it does not win on being demonstrated better.

## References

- `src/config/discovery/packs.yml:69`, `:107`, `:123-131`
- `internal/bench/frontend-power/BASELINE-2026-08-23.md` § Cost
- `src/rules/ui-audit-gate.md`, `src/rules/design-review-after-ui-write.md`
- `agents/evidence/council/drain-blocker-dispositions-a.md` § Rule 3
