---
stability: beta
---

# ADR — GTM context-spine: Wing-3 slot extension

> **Status:** Decided · 2026-05-13
> **Roadmap:** [`agents/roadmaps/road-to-gtm-and-growth.md`](../../agents/roadmaps/road-to-gtm-and-growth.md) § Block G — G1
> **Builds on:** [`context-spine.md`](context-spine.md) — tri-slot
> contract (`product`, `team`, `repo`) locked at 3 by council Q1
> (2026-05-05 KEEP-3, unified-senior-roles iter 1).
> **Defers to:** [`cross-wing-handoff.md`](cross-wing-handoff.md) — typed
> handoff contract; orthogonal to slot membership.

## Decision

The context-spine adds **three Wing-3-specific slots** under
`agents/context-spine/`: `channel-stage`, `funnel-stage`,
`customer-segment`. The schema enum in
[`scripts/schemas/skill.schema.json`](../../scripts/schemas/skill.schema.json)
extends from `{product, team, repo}` to
`{product, team, repo, channel-stage, funnel-stage, customer-segment}`.

The KEEP-3 lock from council Q1 applies to **cross-wing slots** —
slabs every senior wing might read. The Wing-3 slots are
**wing-scoped**: they exist for the GTM cluster (Block H, 16 skills)
and the GTM personas (Block I, 7 personas). Engineering, Foundation,
and Money / Strategy / Ops wings do not opt into them.

| Slot | Path | Typical content |
|---|---|---|
| `channel-stage` | `agents/context-spine/channel-stage.md` | Which channels the GTM motion uses (awareness · consideration · decision · retention · expansion), per-channel maturity, channel-cost band. Read by H1 (`positioning`), H2 (`messaging-architecture`), H3 (`gtm-launch`), H6 (`editorial-calendar`). |
| `funnel-stage` | `agents/context-spine/funnel-stage.md` | Funnel topology (top / mid / bottom / activation / retention), per-stage definition, exit-criteria for each. Read by H8 (`pipeline-strategy`), R1 (`funnel-analysis`), R2 (`activation-design`), R3 (`onboarding-design`). |
| `customer-segment` | `agents/context-spine/customer-segment.md` | ICP, persona-by-segment, ARR-band-by-segment. Read by H7 (`ICP`), H8 (`pipeline-strategy`), H9 (`MEDDIC`), R4 (`retention-loops`). |

## Why this was a real question

Three options were on the table:

1. **Force-fit into existing slots.** Stuff GTM context into the
   `product` slab. Rejected: `product` is owned by the discovery wing
   and a Wing-3 reader gets fuzzy semantics (channel maturity is not
   product scope), Council Q1 explicitly fences `product` against
   sprawl.
2. **Wing-3-only frontmatter key.** Add `gtm_spine: [...]` as a
   parallel field. Rejected: duplicates the read-discipline
   mechanism, the lint gate, and the skill-author cognitive load.
   Two spines is the slot-sprawl failure mode at a different layer.
3. **Extend the spine, scope the slots.** Accepted: same mechanism,
   same lint gate, same opt-in discipline; slot names carry the wing
   scope (`channel-stage`, `funnel-stage`, `customer-segment` are
   visibly GTM-shaped).

## Citation-evidence gating — prospective

The existing § 5 policy requires ≥ 2 shipped skills citing the new
slot **before** the slot is added. For Wing-3 the citation chain is
**prospective**: the roadmap (G1 → H → I) ships citing skills in the
same iteration, ordered so G1 lands first to unblock H authoring.

The ADR is the gating artefact (not the citations). The Block-H
authoring procedure MUST cite ≥ 1 of the three new slots per skill
or carry a one-line ADR-opt-out comment in the skill body. The G2
linter (council Q7 boundary tests) enforces channel-agnosticism,
which is orthogonal — a skill can cite `channel-stage` for context
without prescribing channel-specific tactics.

This relaxation is **wing-bounded**: future wings adding their own
slots must either accumulate ≥ 2 citations from already-shipped
skills, **or** write a per-wing ADR that names the citing-skill
chain in the same iteration (the pattern this ADR establishes).

## Migration plan for the existing senior catalog

- **No retrofitting required.** Existing senior skills
  (`customer-research`, `funnel-analysis`, `po-discovery`,
  `refine-ticket`, `rice-prioritization`, etc.) keep their current
  `context_spine` declarations. They MAY add a Wing-3 slot if their
  cognition genuinely reads it; they MUST NOT be retrofitted
  mechanically.
- **Opt-out for off-wing skills.** Engineering / Foundation / Ops
  senior skills do not need to mention the Wing-3 slots in any way.
  The schema accepts subsets — declaring only `[product, team]`
  remains valid.
- **Slot-file authoring is consumer-side.** The package ships the
  contract; consumer projects fill `agents/context-spine/channel-stage.md`
  etc. when adopting Wing-3 skills. Missing slot file is graceful
  per § 4 of the contract.

## Counter-evidence the agent should listen for

Three signals that this decision is wrong and the ADR needs revisiting:

1. **Off-wing skills start declaring Wing-3 slots.** If an
   Engineering skill cites `channel-stage`, the slot is misnamed or
   the wing boundary is leaking. Re-scope the slot or rename it.
2. **Wing-3 skills consistently ignore the slot they declared.** If
   Block H skills declare `funnel-stage` but never quote it in their
   procedure, the slot is decorative and should be deleted.
3. **A fourth Wing-3 slot is proposed within the same iteration.**
   That is slot-sprawl on the same wing — Block G2 boundary tests
   should reject the addition until a follow-up ADR documents why
   three slots are insufficient.

## See also

- [`context-spine.md`](context-spine.md) § 2 (slot table — extended),
  § 5 (slot-add policy — wing-bounded extension clause).
- [`scripts/schemas/skill.schema.json`](../../scripts/schemas/skill.schema.json)
  — `context_spine.items.enum` extended in this ADR.
- [`agents/roadmaps/road-to-gtm-and-growth.md`](../../agents/roadmaps/road-to-gtm-and-growth.md)
  § Block G — the authorising roadmap.
- [`.agent-src.uncompressed/rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md)
  § Senior-Tier Required Structure — the four blocks every senior
  skill ships independently of spine opt-in.
