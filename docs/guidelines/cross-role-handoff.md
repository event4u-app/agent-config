# Cross-Role Handoff

Wing-specific prose for senior-tier skills handing off across role
boundaries. The mechanical contract — initiator → delegated(input) →
output, lint rules, worktree boundary — lives in
[`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md).
This guideline covers **when a role hands off to another role**,
**how to phrase the routing**, and the **L4 / C8 boundary**.

## Wings at a glance

The senior catalog spans four wings. Each wing owns a cognition
cluster and emits artifacts the other wings can consume.

| Wing | Cluster | Senior skills (anchor examples) |
|---|---|---|
| **1. Engineering** | Code, architecture, debugging, review | `architecture-review-lens`, `bug-analyzer`, `judge-bug-hunter`, `blast-radius-analyzer` |
| **2. Product + Foundation** | Discovery, refinement, decisions | `po-discovery`, `refine-ticket`, `decision-record`, `rice-prioritization` |
| **3. GTM + Growth** | Customers, comms, funnel, channels | `customer-research` (L1), `release-comms` (L2), `funnel-analysis` |
| **4. Money + Strategy + Ops** | Unit economics, OKRs, capacity, risk | `unit-economics-modeling`, `okr-tree-modeling`, `dcf-modeling`, `risk-officer` |

A handoff is **cross-role** when the initiator and the delegate live
in different wings (or in different cognition clusters within the
same wing). Same-cluster delegation is normal composition and does
not need this guideline.

## When to hand off

A senior skill SHOULD hand off — not absorb — when any of the four
fires:

1. **Different cognition cluster.** The downstream step needs a
   different mode of thinking (numbers vs. narrative; user vs.
   system; risk vs. design). Absorbing it dilutes the skill.
2. **Different artifact owner.** The output naturally lives under a
   different role's catalog (e.g. `forecast-band.json` belongs to
   Wing-4, not Wing-2).
3. **Tier-mismatch risk.** Inlining the step would require
   downgrading to a non-senior delegate; the cross-wing-handoff
   linter blocks tier mismatches.
4. **Re-use evidence.** The step is already cited by ≥ 2 other
   senior skills; absorbing it duplicates cognition.

If none fire, keep the step inline. Cross-role plumbing is not free.

## How to phrase the handoff

Two surfaces in the senior-skill template carry routing:

- **`## Related Skills` § *WHEN NOT to use this*** — the routing
  list. One bullet per peer that owns the cognition the user might
  expect from this skill but is wrong to ask here. Format:
  *"X is the actual question — route to [`<peer>`](../<peer>/SKILL.md)"*.
- **`## Procedure` Composes line** — when the skill **does** call
  another skill mid-procedure, declare it on a line beginning with
  `Composes [`<peer>`](...)` so the linter can match the call site
  to the delegate's `## Input` block.

The delegated skill's `## Input` block names the fields the initiator
must pass. Drift between the two is the failure the contract catches.

## Decision tree

```
Need a downstream cognition step?
├── Same wing + same cluster? → keep inline (normal composition).
├── Different cluster, but no shipped senior peer?
│   └── Implement inline; flag for next plate's audit (the cluster
│       might need its own senior).
├── Different cluster + shipped senior peer + ≥ 2 reuse citations?
│   └── HAND OFF: declare in WHEN NOT block + Composes line.
└── Cross-wing chain (≥ 3 senior steps, ≥ 30 min each)?
    └── Use `subagent-orchestration` mode 6 (worktrees) per
        cross-wing-handoff.md § 3.
```

## L4 / C8 composition boundary

Council Q3 (2026-05-05) locks the disambiguation between L4
`stakeholder-tradeoff` and the sibling C8 `code-review-multi-lens`:

- **L4 fires** when a request crosses two stakeholder lenses
  (engineering ↔ PO, PO ↔ ops, ops ↔ infra) and the trade-off is
  **not yet code**. Output is a trade-off matrix + recommendation +
  dissent log; the artifact is consumable by a roadmap or PR
  description, not by a diff.
- **C8 fires** when the request **is already code** — PR open, draft
  branch under review, or a diff supplied as input. Output is a
  multi-lens code review (security · architecture · tests · quality)
  bound to file:line spans.
- **C8 → L4 escalation.** A C8 verdict that surfaces a stakeholder
  conflict — e.g. test-coverage judge fails but PO insists on
  shipping — becomes **input to L4**. The escalation is one-way:
  L4 produces the dissent log that decides whether C8's verdict
  is overridden, with the override recorded in
  [`decision-record`](../../.agent-src.uncondensed/skills/decision-record/SKILL.md).

The boundary keeps the two skills sharp — neither absorbs the other —
and gives the agent a deterministic rule for which one to load when
both look applicable.

## Worked example

A PO refining a ticket (Wing-2) hits a sentence like *"the cheapest
acquisition channel is paid search, but only if CAC payback < 6 months"*:

1. Wing-2 is the initiator (`refine-ticket`).
2. The CAC question is Wing-4 cognition — `unit-economics-modeling`.
3. `refine-ticket` hands off via:
   - WHEN NOT entry: *"CAC / payback questions — route to
     [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md)"*.
   - Composes line in the procedure step that needs the answer.
4. The delegate's `## Input` block lists the fields (channel,
   cohort, time horizon); `refine-ticket` passes them.
5. The output (`payback-band.md`) feeds the AC of the original ticket.

No cluster collision, no tier mismatch, no untyped drift.

## See also

- [`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md)
  — the mechanical contract this guideline cites.
- [`docs/contracts/context-spine.md`](../contracts/context-spine.md)
  — orthogonal context-slot mechanism, often used together with a
  handoff (e.g. delegate reads `team` slot the initiator opted in to).
- `.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md` § mode 6
  — when the chain runs in fresh worktrees.
