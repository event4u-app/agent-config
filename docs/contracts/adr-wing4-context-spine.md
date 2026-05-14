---
stability: beta
keep-beta-until: 2026-08-12
---

# ADR — Wing-4 context-spine: Money / Strategy / Ops slot extension

> **Status:** Decided · 2026-05-13
> **Builds on:** [`context-spine.md`](context-spine.md) — tri-slot cross-wing
> contract (`product`, `team`, `repo`) locked at 3 by council Q1
> (2026-05-05 KEEP-3, unified-senior-roles iter 1) plus the wing-scoped
> track established by [`adr-gtm-context-spine.md`](adr-gtm-context-spine.md).
> **Defers to:** [`cross-wing-handoff.md`](cross-wing-handoff.md) — typed
> handoff contract; orthogonal to slot membership.

## Decision

The context-spine adds **three Wing-4-specific slots** under
`agents/context-spine/`: `fiscal-period`, `org-stage`,
`regulatory-regime`. The schema enum in
[`scripts/schemas/skill.schema.json`](../../scripts/schemas/skill.schema.json)
extends from
`{product, team, repo, channel-stage, funnel-stage, customer-segment}`
to additionally include
`{fiscal-period, org-stage, regulatory-regime}`.

The KEEP-3 lock from council Q1 still applies to **cross-wing slots**.
The Wing-4 slots are **wing-scoped** under § 5 of the contract: they
exist for the Money / Strategy / Ops cluster (Block O–S, 18 skills)
and the Wing-4 personas (Block T, 4 personas). Engineering,
Foundation, and GTM wings do not opt into them.

| Slot | Path | Typical content |
|---|---|---|
| `fiscal-period` | `agents/context-spine/fiscal-period.md` | Reporting cadence (monthly · quarterly · annual · multi-year-plan), fiscal-year start, close-window timing. Read by O1 (`unit-economics`), O2 (`forecasting`), O3 (`runway-cognition`), O4 (`scenario-modeling`). |
| `org-stage` | `agents/context-spine/org-stage.md` | Stage label (seed · series-A · series-B · growth · public), funding posture, headcount band, governance posture. Read by P1 (`build-buy-partner`), P4 (`vision-articulation`), Q1 (`org-design`), Q2 (`comp-banding`), S2 (`hiring-loop-design`). |
| `regulatory-regime` | `agents/context-spine/regulatory-regime.md` | Active regimes (none · GDPR · HIPAA · SOC2 · PCI · CCPA), data-residency posture, breach-notification timer. Read by P5 (`contracts-cognition`), P6 (`privacy-review`), P7 (`data-handling-judgment`). |

## Why this was a real question

Three options were on the table:

1. **Force-fit into existing slots.** Stuff fiscal cadence into
   `team`, stage into `repo`, regulatory regime into `product`.
   Rejected: each slab is owned by a different wing and Wing-4 reads
   would mix tenant-of-record semantics (stage is not codebase
   shape, regulatory regime is not product scope).
2. **Wing-4-only frontmatter key.** Add `wing4_spine: [...]` parallel
   to `context_spine`. Rejected for the same reason as Wing-3 ADR:
   two spines duplicate the read-discipline mechanism, the lint
   gate, and the skill-author cognitive load.
3. **Extend the spine, scope the slots.** Accepted: same mechanism,
   same lint gate, same opt-in discipline; slot names carry the
   wing scope (`fiscal-period`, `org-stage`, `regulatory-regime`
   are visibly Money / Strategy / Ops shaped).

## Citation-evidence gating — prospective

Per § 5 wing-scoped track, the citation chain is **prospective**: the
roadmap (J1 → O / P / Q / S → T) ships citing skills in the same
iteration. The ADR is the gating artefact (not the citations); each
Block O / P / Q / S skill cites ≥ 1 of the three new slots in its
frontmatter or carries a one-line ADR-opt-out comment in the skill
body.

The J2 linter (council Q7 boundary tests) enforces stage-agnosticism,
which is orthogonal — a skill can cite `org-stage` for context
without prescribing stage-specific thresholds (e.g. `runway-cognition`
reads the stage to colour heuristics, but the procedure must remain
readable across seed and public).

## Migration plan for the existing senior catalog

- **No retrofitting required.** Existing senior skills keep their
  current `context_spine` declarations. Wing-3 skills MAY add a
  Wing-4 slot if their cognition genuinely reads it (e.g. a Growth
  PM reading `regulatory-regime` to scope activation experiments);
  they MUST NOT be retrofitted mechanically.
- **Opt-out for off-wing skills.** Engineering / Foundation senior
  skills do not need to mention the Wing-4 slots in any way. The
  schema accepts subsets — declaring only `[product, team]` remains
  valid.
- **Slot-file authoring is consumer-side.** The package ships the
  contract; consumer projects fill
  `agents/context-spine/fiscal-period.md` etc. when adopting Wing-4
  skills. Missing slot file is graceful per § 4 of the contract.

## Counter-evidence the agent should listen for

Three signals that this decision is wrong and the ADR needs revisiting:

1. **Off-wing skills start declaring Wing-4 slots.** If an
   Engineering skill cites `org-stage`, the slot is misnamed or the
   wing boundary is leaking. Re-scope the slot or rename it.
2. **Wing-4 skills consistently ignore the slot they declared.** If
   Block P privacy skills declare `regulatory-regime` but never
   quote it in their procedure, the slot is decorative and should be
   deleted.
3. **A fourth Wing-4 slot is proposed within the same iteration.**
   That is slot-sprawl on the same wing — Block J2 boundary tests
   should reject the addition until a follow-up ADR documents why
   three slots are insufficient.

## Distinction from Wing-3 ADR

`adr-gtm-context-spine.md` extends the spine with **flow-state slots**
(funnel stage, channel stage, customer segment) — slabs that change
*every quarter* as the GTM motion evolves. Wing-4 extends the spine
with **constraint slots** (fiscal cadence, org stage, regulatory
regime) — slabs that change *every fundraise / audit / boundary
expansion*. Both extensions follow § 5 wing-scoped track; their
combined accept means the spine schema now declares 9 slots (3
cross-wing + 3 Wing-3 + 3 Wing-4). Any fourth slot at any wing
re-opens the slot-sprawl risk and needs a separate ADR.

## See also

- [`context-spine.md`](context-spine.md) § 2 (slot table — extended),
  § 5 (slot-add policy — wing-scoped track).
- [`adr-gtm-context-spine.md`](adr-gtm-context-spine.md) — Wing-3
  reference ADR this one composes against.
- [`scripts/schemas/skill.schema.json`](../../scripts/schemas/skill.schema.json)
  — `context_spine.items.enum` extended in this ADR.
- [`.agent-src.uncompressed/rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md)
  § Senior-Tier Required Structure — the four blocks every senior
  skill ships independently of spine opt-in.
