---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to release-review P0

> The three priority findings from the last release review that no existing roadmap owns: skill projection that reacts to measured host limits, evidence artifacts that declare what kind of evidence they are, and a provider qualification result the council actually consumes.

## Goal

Close the three unowned P0 findings from the release review with a measured trigger each — a host truncation measurement that gates projection, an artifact type recorded at write time, and a qualification verdict the council reads before it dispatches.

## Prerequisites

- [ ] Read `src/scripts/hook_manifest.yaml` and the skill-projection path
- [ ] Read `agents/evidence/` layout and the review-binding manifest format
- [ ] Read the council dispatch path and its member-resolution step
- [ ] Re-verify the Context table against branch HEAD before executing a phase

## Context

Source: an external release review of this package, 2026-08-15, pinned at `e3bd961`. That pin is 221 commits behind the branch base; every P0 was re-verified at `6d18f5bb2` and all three below are unbuilt. The review's fourth P0 and two of its P1 items were dropped in triage because existing work already owns them.

**Re-verified at `6d18f5bb2`:**

| P0 as reviewed | Status | Disposition |
|---|---|---|
| Host-aware skill projection — one host shows measurable catalogue truncation pressure | still true, unbuilt (no host-aware projection path exists) | **KEEP** — Phase 1 |
| Evidence artifact typing — historical input is indistinguishable from a current binding | still true, unbuilt (none of the proposed type markers exist) | **KEEP** — Phase 2 |
| Provider qualification matrix — one council seat was entirely dead while reporting as configured | still true, unbuilt (no qualification path exists) | **KEEP** — Phase 3 |
| Rule estate reduction from 116 toward roughly 90 | still true as a finding (the count is now 117, i.e. it grew) | **CUT** — fully owned by the estate-diet roadmap, which carries a census manifest with per-rule keep, merge, pack, and delete verdicts across 50 open steps. Duplicating it here would fork the verdict list. |
| Context loss accounting (P1) | still true | **FOLD** — into the context-fidelity roadmap authored in the same pass, whose Phase 0 census measures exactly this. |
| Structured blocker contract (P1) | **overtaken** | The roadmap template's blocker rule now requires seven fields including a recommendation, a cost-of-inaction line, and an executable instruction set, with a linter probing for substance. |

**The review's own framing is worth carrying:** the scoping lever on the rule estate is largely exhausted, so the remaining move is deletion and merging rather than further scoping metadata — which is precisely why that item belongs to the estate-diet roadmap and not to a new one.

## Phase 1 — Host-aware skill projection

- [ ] Add a host capability profile that records measured catalogue behaviour per host — how many skills survive the host's own catalogue handling — rather than deriving the limit from the package's model of the host. <!-- verify: ./scripts-run src/scripts/routing_doctor --help -->
- [ ] Compose the projected skill set from three inputs: the host capability profile, the measured catalogue behaviour, and the workspace profile. <!-- verify: ./scripts-run src/scripts/lint_featured_skills -->
- [ ] Gate the aggressive path on measurement sufficiency: only hosts with an adequate measurement base project a reduced set. An unknown host receives no aggressive scoping — the safe direction is the full catalogue, because under-projecting a skill is a worse failure than paying for one that is never used. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage -->
- [ ] Leave the primary host unchanged in this phase; it has no measured truncation pressure and changing it would move two variables at once. <!-- verify: ./scripts-run src/scripts/routing_doctor -->

**Exit criteria:** one host projects a measured-reduced set, another projects unchanged, and the difference traces to a recorded measurement rather than a constant.

**Rollback:** remove the profile input; projection falls back to the current uniform path.

**Kill criteria:** a projected-away skill turning out to be needed in a real session on that host reverts the host to full projection and publishes the case.

## Phase 2 — Evidence artifact typing

- [ ] Add an explicit type to every evidence artifact at write time, distinguishing an original review, a current binding, a declared skip, an honest null, and a re-bind event. The failure this closes is that a historical input currently reads the same as a live binding, so a reader cannot tell whether an artifact still asserts anything. <!-- verify: ./scripts-run src/scripts/lint_evidence_artifacts -->
- [ ] Set the type at creation rather than inferring it later from filename or location; an inferred type reproduces the ambiguity it was meant to remove. <!-- verify: ./scripts-run src/scripts/lint_evidence_artifacts -->
- [ ] Explicitly do not loosen the binding itself. The review's own measurement found that segment-aware currency would save roughly a tenth of re-binds while introducing integrity risk — so the decision is to clarify what stored evidence means, not to weaken when it must be re-bound. <!-- verify: grep -q "binding" docs/contracts/evidence-artifact-types.md -->
- [ ] Record the type set as a contract document so consumers read one definition rather than inferring five. <!-- verify: test -f docs/contracts/evidence-artifact-types.md -->

**Exit criteria:** every newly written evidence artifact carries a type, and the check fails a typeless one.

**Rollback:** the type is an additive field; the check can be unregistered without migrating existing artifacts.

## Phase 3 — Provider qualification

- [ ] Add a qualification pass that verifies, in order: the provider is installed, authentication is valid, the CLI or API semantics match what the caller assumes, the system-prompt path is valid, the model identifier is accepted, tools are isolated, and a minimal request succeeds. <!-- verify: ./scripts-run src/scripts/council_cli status -->
- [ ] Produce one of four verdicts — available, degraded, unavailable, unknown — rather than a boolean, because the failure that motivated this was a seat reporting as configured while being entirely dead, which a boolean cannot express. <!-- verify: ./scripts-run src/scripts/council_cli status -->
- [ ] Make the council consume the verdict before dispatch, so a degraded or unavailable seat is visible at the point of use rather than discovered by an empty result after the spend. <!-- verify: ./scripts-run src/scripts/test_council_qualification -->
- [ ] Report a quorum against qualified seats only. A run that prints a quorum it never reached is worse than one that reports being short, because the first is silently trusted. <!-- verify: ./scripts-run src/scripts/test_council_qualification -->

**Exit criteria:** a deliberately broken seat yields unavailable rather than configured, and a council run against it reports short instead of printing a quorum.

**Rollback:** the qualification result is advisory until the consumption step lands; removing that step restores current behaviour.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Host-aware projection hides a skill the session needed | product | A measured-reduced set drops something the host would have used, and the loss is invisible because nothing reports a skill that was never offered. | Reduction requires an adequate measurement base per host; unknown hosts receive no scoping; a single real miss reverts that host and is published as a case. | Phase 1 |
| 2 | Qualification adds latency to every council run | implementation | Seven checks before dispatch turn a cheap call into a slow one. | The verdict is cached per session rather than probed per call; a free status probe already exists as the caching surface. | Phase 3 |
| 3 | Artifact typing becomes a field nobody reads | implementation | The type ships and consumers keep inferring from location. | The contract document defines one type set, and the check fails a typeless artifact at write time rather than warning after the fact. | Phase 2 |
| 4 | The estate finding is silently dropped | product | Cutting the rule-reduction P0 from this roadmap reads as deciding against it. | The cut names the roadmap that owns it and why duplication would fork the verdict list; the finding is redirected, not discarded. | Context |
| 5 | Degraded is treated as available | implementation | A four-value verdict collapses back to a boolean at the first consumer that does not handle the middle. | The quorum step reads qualified seats only, so a degraded seat cannot contribute to a quorum by default. | Phase 3 |

## Acceptance Criteria

- [ ] A host with measured truncation pressure projects a reduced set and a host without one does not, with both traceable to a recorded measurement.
- [ ] A typeless evidence artifact fails its check.
- [ ] A deliberately broken council seat reports unavailable, and a run against it reports short rather than printing a quorum.
- [ ] No step in this roadmap duplicates a step in the estate-diet roadmap.
- [ ] The two folded findings are traceable to the roadmap that absorbed them.

## Provenance

- Source: an external release review of this package, 2026-08-15, pinned at `e3bd961` and re-verified at `6d18f5bb2` for this file. The Context table records the disposition of every P0 and the two P1 items that were folded or overtaken.
- Raw review material stays local and untracked at `agents/tmp.old/feedback-12.1.0.txt`.
- Council: not convened. The three carried items were unbuilt on tree evidence rather than contested.
