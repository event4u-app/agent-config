---
complexity: lightweight
status: later
estate_growth_exempt: "Replaces the road-to-host-aware-skill-projection stub (path omitted deliberately: it is deleted in this same change, so a path to it is a dead reference check_references refuses) on an AI council's 2/2 instruction to ABSORB that stub rather than defer to it: its step 1.4 asserted the primary host has no measured truncation pressure, which the host's own budget event refutes (agents/evidence/analysis/scoped-projection-host-delivery.md:19-20). The automatic later/ allowance is keyed on parking an ACTIVE roadmap and deliberately does not cover a later/ file arriving from elsewhere, which is exactly this case: a stub relocating, not new estate. Net roadmap count across the change is unchanged, one stub out and one later/ file in, and the active side falls by one because the roadmap that decided it archived here too. Owner maintainer, review_by 2027-02-22."
execution:
  mode: phase-checkpoints
---
# Road to a build-pinned host catalogue contract

> **Parked, not abandoned.** Every step below needs one thing this tree cannot
> produce on its own: a catalogue observation taken against a **named host
> build**. Owner: maintainer. Review by: **2027-02-22**.
>
> **Provenance.** Absorbed from the `road-to-host-aware-skill-projection` stub,
> which this same change DELETES — so it is named and not linked: a path to a
> file the change removes is a dead reference by construction, and
> `check_references` refuses it.
> (deleted in the same change) by the Phase 3.1 disposition of
> `road-to-catalog-and-projection-economy`, decided by AI council on 2026-08-22
> — **2/2 convergent** on ABSORB, with the instruction to eliminate the stub as
> a separate authority rather than defer to it. The stub carried a **refuted**
> premise and its own originating framework document was absent from the tree,
> so there was no authority left to defer to.

## Goal

State, from a measurement rather than from this package's model of a host, what
projection rule satisfies **both**: total payload under the host's budget
ceiling, **and** retained-set quality at least as good as the full-catalogue
baseline. The second half is the half the previous attempt did not have.

## The correction that made this file necessary

The stub's step 1.4 read: *"Leave the primary host unchanged in this phase; it
has no measured truncation pressure."*

**That premise is refuted by the host's own budget event.**
`agents/evidence/analysis/scoped-projection-host-delivery.md:19-20`: a
`legacy-all` projection dropped **402** entries and stripped every description;
a `scoped` projection dropped **330** and still stripped every description.
Corrected, and this is the sentence that replaces it:

> The primary host has **measured** truncation pressure. Preserve current
> behaviour until a build-pinned profile demonstrates a safe alternative.

## Three measurements the council separated, because conflating them is the trap

Both seats independently rejected treating the existing observation as
satisfying the measurement. The distinction is not pedantry: recording it as
"measurement obtained" would authorise a projection change that nothing
supports.

1. **Truncation-pressure observation — ALREADY HELD.** The host truncates. Done,
   cited above.
2. **Build-pinned catalogue profile — MISSING.** What was offered, what was
   retained, in what order, under what budget model, against a named host
   build. A projection *mode* name is not a host/build identifier.
3. **Retained-set quality — MISSING, and the one nobody was measuring.** A
   smaller projection that reduces the drop count can still be worse if it drops
   the most useful entries. `402 → 330` establishes that scoping changes the
   magnitude; it establishes **nothing** about whether the surviving set is
   better. "Changed the magnitude" is the only defensible claim.

## Phase 1 — the absorbed steps, corrected

- [ ] **1.1 Record a measured per-host catalogue profile**, pinned to a named
      host build — not derived from this package's model of the host.
      verify: the profile names the host build string it was taken against, and `./scripts-run src/scripts/routing_doctor --help` resolves.
- [ ] **1.2 Compose the projected set from the profile**, the measured
      catalogue behaviour and the workspace profile — three inputs, not one.
      verify: `./scripts-run src/scripts/lint_featured_skills` exits green.
- [ ] **1.3 Gate the aggressive path on measurement sufficiency.** An unmeasured
      host receives the **full** catalogue: under-projecting a skill is a worse
      failure than paying for one that is never used.
      verify: `./scripts-run src/scripts/check_enforcement_coverage` exits green and no default changes for a host with no measurement.
- [ ] **1.4 Preserve current primary-host behaviour until a build-pinned profile
      demonstrates a safe alternative.** (Replaces the refuted original.)
      verify: `./scripts-run src/scripts/routing_doctor` reports the primary host unchanged.
- [ ] **1.5 Measure retained-set QUALITY, not drop count.** The council's
      addition, and the reason a follow-up experiment is not simply "scope
      harder": the next experiment must show the surviving set is at least as
      useful as the full catalogue, or it has measured nothing.
      verify: the experiment's report names both the drop count and a retained-set quality figure, and states which of the two its conclusion rests on.

## What this file explicitly does NOT propose

**Shortening descriptions further.** Measured 2026-08-22: the most aggressive
cap available (120 chars, all 290 rewritten) returns ~4,144 tok against an
overage of ~27,761. Both council seats went past "insufficient" to
**structurally wrong** — the stub treated a total-payload problem as a
per-skill-description problem. Recorded here so the lever is not re-proposed:
`agents/evidence/analysis/skill-description-ceiling-2026-08.md`.

## Blockers

### blocker: b-host-catalogue-build-pin
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once (a host-contract observation, not a repo edit)
- **Blocks:** every step in Phase 1.
- **What to do:** obtain a catalogue observation against a named host build,
  recording all three measurements above separately — pressure, profile,
  retained-set quality.
- **Resolved when:** an observation exists under `agents/evidence/analysis/`
  naming the host build it was taken against, and reporting retained-set
  quality rather than drop count alone.
- **If you do nothing:** the primary host keeps its current behaviour, which is
  the safe direction and the reason this parks rather than blocks a release.

## Acceptance Criteria

- [ ] AC-1 — a catalogue profile exists, pinned to a named host build.
- [ ] AC-2 — retained-set quality is measured, not inferred from the drop count.
- [ ] AC-3 — no projection default changes for a host with no measurement behind it.
