---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to release-review P0

> The three priority findings from the last release review that no existing roadmap owns: skill projection that reacts to measured host limits, evidence artifacts that declare what kind of evidence they are, and a provider qualification result the council actually consumes.

## Outcome — closed 2026-08-20, outcome state `transferred`

**Archived does not mean achieved here, and this section exists so the two are
never read as the same thing.** Two of the three P0 findings were closed by
building the thing; the third was closed by transferring it, unbuilt, to a stub
with named re-entry probes.

| P0 | Outcome | Where it stands |
|---|---|---|
| Evidence artifact typing (Phase 2) | **satisfied, narrowed** | Shipped, with one recorded deviation: four types are declared on the artifact and the fifth (re-bind) is derived from git rather than typed, because re-binding is an in-place edit with no separate object to carry a type. Narrowing is stated in `docs/contracts/evidence-artifact-types.md`. |
| Provider qualification (Phase 3) | **satisfied** | Four-value verdict consumed before dispatch; quorum reported against qualified seats only. |
| Host-aware skill projection (Phase 1) | **transferred** | Never started. Steps 1.1-1.4 and AC1 moved to `stubs/road-to-host-aware-skill-projection.md` with all three measured blockers and three named re-entry probes (P1-P3), each of which was measured FAILING at `206ab4f16`. |
| Rule estate reduction | **redirected at authoring time** | Cut to `road-to-cost-parity-1-rule-payload-diet` step 1.1; never in scope here. |
| Context loss accounting (P1) | **redirected at authoring time** | Folded into `road-to-context-fidelity` Phase 0. |

Criteria tally: 3 of 5 acceptance criteria satisfied, 1 transferred (AC1), and
the two traceability criteria closed on 2026-08-20 by naming the absorbing files
by slug — before that edit the estate pointer read "the estate-diet roadmap" and
no file carried that name.

**Framework of record:** `agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
(disposition B, outcome `transferred`). Recorded as instructed and **flagged
honestly**: that document is not present in this tree at `206ab4f16`
(`git log --all` over the path returns nothing), so it is cited as the framework
this run was given, not as an artifact anyone can currently read. Every
*technical* claim above is cited to this repository by `file:line` and does not
depend on it.

## Goal

Close the three unowned P0 findings from the release review with a measured trigger each — a host truncation measurement that gates projection, an artifact type recorded at write time, and a qualification verdict the council reads before it dispatches.

## Prerequisites

- [x] Read `src/scripts/hook_manifest.yaml` and the skill-projection path <!-- verified 2026-08-20: hook_manifest.yaml carries exactly one skill-facing concern, `skill-route` (`src/scripts/hook_manifest.yaml:594-601`, bound on `user_prompt_submit:902`, advisory, ranks the prompt over the installed catalogue and injects pointers only) — no concern touches projection. The projection path is `src/scripts/condense.ts`: `generate_claude_skills` (:1671) filters by an optional active-name set, which `_resolve_active_predicates` (:1638) supplies, gated on `_read_projection_mode` (:1594) reading `projection.mode` from settings (`legacy-all` | `scoped`, default `legacy-all`). There is no host input anywhere on that path. -->
- [x] Read `agents/evidence/` layout and the review-binding manifest format
- [x] Read the council dispatch path and its member-resolution step
- [x] Re-verify the Context table against branch HEAD before executing a phase

## Context

Source: an external release review of this package, 2026-08-15, pinned at `e3bd961`. That pin is 221 commits behind the branch base; every P0 was re-verified at `6d18f5bb2` and all three below are unbuilt. The review's fourth P0 and two of its P1 items were dropped in triage because existing work already owns them.

**Re-verified at `6d18f5bb2`:**

| P0 as reviewed | Status | Disposition |
|---|---|---|
| Host-aware skill projection — one host shows measurable catalogue truncation pressure | still true, unbuilt (no host-aware projection path exists) | **KEEP** — Phase 1 |
| Evidence artifact typing — historical input is indistinguishable from a current binding | still true, unbuilt (none of the proposed type markers exist) | **KEEP** — Phase 2 |
| Provider qualification matrix — one council seat was entirely dead while reporting as configured | still true, unbuilt (no qualification path exists) | **KEEP** — Phase 3 |
| Rule estate reduction from 116 toward roughly 90 | still true as a finding (the count is now 117, i.e. it grew) | **CUT** — fully owned by `road-to-cost-parity-1-rule-payload-diet`, which carries a census manifest (`agents/evidence/analysis/estate-census.md`, its step 1.1) with per-rule `keep` / `merge-into:<target>` / `pack:<name>` / `delete` verdicts across 50 open steps. Duplicating it here would fork the verdict list. |
| Context loss accounting (P1) | still true | **FOLD** — into `road-to-context-fidelity`, authored in the same pass, whose Phase 0 compaction-survival census measures exactly this (per-probe: still followed, present only as paraphrase, or gone). |
| Structured blocker contract (P1) | **overtaken** | The roadmap template's blocker rule now requires seven fields including a recommendation, a cost-of-inaction line, and an executable instruction set, with a linter probing for substance. |

**The review's own framing is worth carrying:** the scoping lever on the rule estate is largely exhausted, so the remaining move is deletion and merging rather than further scoping metadata — which is precisely why that item belongs to the estate-diet roadmap and not to a new one.

## Phase 1 — Host-aware skill projection

> **Not started 2026-08-17, on the data's own verdict — not on effort.** Step 3
> requires that "only hosts with an adequate measurement base project a reduced
> set". Read at `6a679cc19`, `agents/evidence/metrics/skill-catalogue.jsonl`
> holds five observations across two hosts, and **every one of the four `codex`
> rows carries `verdict: "insufficient-observation"`** while the single `claude`
> row carries `no-selector` (no truncation pressure — which is exactly the
> premise step 4 relies on).
>
> So the only host with measured truncation pressure declares its own
> measurement base inadequate, in the field built to say so. Implementing the
> sufficiency gate today means one of two things: inventing an adequacy bar the
> data fails, or shipping a gate that can never fire — and a gate that cannot
> fire is the shape `src/config/gate-coverage.yml` was written to reject.
>
> **Resolved when:** at least one host accumulates observations whose `verdict`
> is something other than `insufficient-observation`, at which point the
> adequacy bar is read off that distribution instead of guessed. The
> measurement half is already built (`_lib/skill_catalogue.ts` —
> `ObservationRecord`, `truncationModeOf`, `measureCatalogueVolume`); what is
> missing is the evidence, not the instrument.
>
> **Correction 2026-08-20 — the resume condition above is UNFALSIFIABLE as
> written, so waiting on it is waiting forever.** Re-read at `206ab4f16`:
> `buildBudgetEventRecord` writes `verdict: 'insufficient-observation'`
> **unconditionally** for every `budget-strip-and-drop` observation
> (`src/scripts/_lib/skill_catalogue.ts:595`), and its own comment two lines
> above says why — "there is nothing to separate: the host did not choose per
> entry, it stripped all of them". The field is a **selector** verdict, not a
> measurement-adequacy verdict. No accumulation of `codex` rows can ever move
> it, because nothing computes it from the data; and the only other host row
> (`claude`, `no-selector`) comes from `buildNoTruncationRecord`
> (`:643`), which is equally unconditional. The observation base did grow —
> 5 rows at `6a679cc19`, **7 rows** at `206ab4f16` — and the verdict
> distribution is byte-identical, which is the prediction this correction makes
> and the data already confirms.
>
> **Restated resume condition, on a field that can actually change:** the
> adequacy bar is read off `dropped_count` and `projected_skill_count` under a
> fixed `projection_mode`, not off `verdict`. The 2026-08-16 pair is the first
> evidence that those fields respond to a projection change at all —
> `legacy-all` measured 497 offered / 402 dropped, `scoped` measured 426 / 330
> on the same host one day apart. Two observations of one host is not a
> distribution; the bar needs repeated same-mode rows before a threshold read
> off them is anything but a guess.
>
> **A second blocker, independent of the evidence and not previously
> recorded:** step 2 must compose into a scoping mechanism that does not exist
> on the shipped generator path. `projection.mode` is a global setting with no
> host input (`src/scripts/condense.ts:1594`), and `_resolve_active_predicates`
> **throws** for `scoped` — "requires the config package (not ported in
> condense.ts)" (`:1646`). So the phase's premise is that host measurement
> composes with a scoped path, and the scoped path currently raises. Building
> the host input first would produce a profile with no consumer.
>
> **Step 1 has no home in the existing manifest either.**
> `HostCapabilityManifest` is all-boolean by contract with an all-`false` safe
> default (`src/scripts/_lib/host_capability.ts:43-81`); a measured catalogue
> count is neither a boolean nor safe-defaultable to `false`, so step 1 is a new
> profile surface rather than a field addition.
>
> **Steps stay `[ ]` rather than `[~]`, deliberately.** Nothing here is
> half-shipped and nothing is cancelled: open-and-blocked is what `[ ]` plus a
> recorded blocker already means. No `### blocker:` entry was added — this
> roadmap carries no `## Blockers` section, and adding one raises the estate
> blocker count that `road-to-cost-parity-1-rule-payload-diet` and the estate
> drawdown campaign are both working to lower. The block is recorded here, where
> the phase is.

- [-] Add a host capability profile that records measured catalogue behaviour per host — how many skills survive the host's own catalogue handling — rather than deriving the limit from the package's model of the host. <!-- verify: ./scripts-run src/scripts/routing_doctor --help --> <!-- [-] transferred to stubs/road-to-host-aware-skill-projection.md (council disposition B, outcome: transferred) — no home in the all-boolean HostCapabilityManifest; a new profile surface, blocker 3 -->
- [-] Compose the projected skill set from three inputs: the host capability profile, the measured catalogue behaviour, and the workspace profile. <!-- verify: ./scripts-run src/scripts/lint_featured_skills --> <!-- [-] transferred to stubs/road-to-host-aware-skill-projection.md (council disposition B, outcome: transferred) — no scoped path to compose into; condense.ts:1646 raises, blocker 2 -->
- [-] Gate the aggressive path on measurement sufficiency: only hosts with an adequate measurement base project a reduced set. An unknown host receives no aggressive scoping — the safe direction is the full catalogue, because under-projecting a skill is a worse failure than paying for one that is never used. <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage --> <!-- [-] transferred to stubs/road-to-host-aware-skill-projection.md (council disposition B, outcome: transferred) — no same-projection_mode observation pair exists to read a bar off, blocker 1 -->
- [-] Leave the primary host unchanged in this phase; it has no measured truncation pressure and changing it would move two variables at once. <!-- verify: ./scripts-run src/scripts/routing_doctor --> <!-- [-] transferred to stubs/road-to-host-aware-skill-projection.md (council disposition B, outcome: transferred) — a constraint on an implementation that was never started, not standalone work -->

**Exit criteria:** one host projects a measured-reduced set, another projects unchanged, and the difference traces to a recorded measurement rather than a constant.

**Rollback:** remove the profile input; projection falls back to the current uniform path.

**Kill criteria:** a projected-away skill turning out to be needed in a real session on that host reverts the host to full projection and publishes the case.

## Phase 2 — Evidence artifact typing

> **Shipped with one deliberate deviation from the step text below, recorded
> rather than silently absorbed (2026-08-17).** Step 1 names five kinds
> "including a re-bind event"; the contract ships **four** declared on the
> artifact and derives the fifth from git. `plan-review-gates.md` §2.7 makes
> re-binding an in-place edit, so there is no separate object to carry a type,
> and `probe_review_binding_drift.ts` already reconstructs those events from
> history (81 recovered). Typing a re-bind would mean having the artifact
> record its own edit history, which is what version control is.
>
> The rest of step 1 shipped as written. The split is stated in
> `docs/contracts/evidence-artifact-types.md` § "The re-bind event has no type"
> so a reader meets the reasoning at the contract, not only here.

- [x] Add an explicit type to every evidence artifact at write time, distinguishing an original review, a current binding, a declared skip, an honest null, and a re-bind event. The failure this closes is that a historical input currently reads the same as a live binding, so a reader cannot tell whether an artifact still asserts anything. <!-- verify: ./scripts-run src/scripts/lint_evidence_artifacts -->
- [x] Set the type at creation rather than inferring it later from filename or location; an inferred type reproduces the ambiguity it was meant to remove. <!-- verify: ./scripts-run src/scripts/lint_evidence_artifacts -->
- [x] Explicitly do not loosen the binding itself. The review's own measurement found that segment-aware currency would save roughly a tenth of re-binds while introducing integrity risk — so the decision is to clarify what stored evidence means, not to weaken when it must be re-bound. <!-- verify: grep -q "binding" docs/contracts/evidence-artifact-types.md -->
- [x] Record the type set as a contract document so consumers read one definition rather than inferring five. <!-- verify: test -f docs/contracts/evidence-artifact-types.md -->

**Exit criteria:** every newly written evidence artifact carries a type, and the check fails a typeless one.

**Rollback:** the type is an additive field; the check can be unregistered without migrating existing artifacts.

## Phase 3 — Provider qualification

- [x] Add a qualification pass that verifies, in order: the provider is installed, authentication is valid, the CLI or API semantics match what the caller assumes, the system-prompt path is valid, the model identifier is accepted, tools are isolated, and a minimal request succeeds. <!-- verify: ./scripts-run src/scripts/council_cli status -->
- [x] Produce one of four verdicts — available, degraded, unavailable, unknown — rather than a boolean, because the failure that motivated this was a seat reporting as configured while being entirely dead, which a boolean cannot express. <!-- verify: ./scripts-run src/scripts/council_cli status -->
- [x] Make the council consume the verdict before dispatch, so a degraded or unavailable seat is visible at the point of use rather than discovered by an empty result after the spend. <!-- verify: ./scripts-run src/scripts/test_council_qualification -->
- [x] Report a quorum against qualified seats only. A run that prints a quorum it never reached is worse than one that reports being short, because the first is silently trusted. <!-- verify: ./scripts-run src/scripts/test_council_qualification -->

**Exit criteria:** a deliberately broken seat yields unavailable rather than configured, and a council run against it reports short instead of printing a quorum.

**Rollback:** the qualification result is advisory until the consumption step lands; removing that step restores current behaviour.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Host-aware projection hides a skill the session needed | product | A measured-reduced set drops something the host would have used, and the loss is invisible because nothing reports a skill that was never offered. | Reduction requires an adequate measurement base per host; unknown hosts receive no scoping; a single real miss reverts that host and is published as a case. | Phase 1 |
| 2 | Qualification adds latency to every council run | implementation | Seven checks before dispatch turn a cheap call into a slow one. | The verdict is cached per session rather than probed per call; a free status probe already exists as the caching surface. | Phase 3 |
| 3 | Artifact typing becomes a field nobody reads | implementation | The type ships and consumers keep inferring from location. | The contract document defines one type set, and the check fails a typeless artifact at write time rather than warning after the fact. | Phase 2 |
| 4 | The estate finding is silently dropped | product | Cutting the rule-reduction P0 from this roadmap reads as deciding against it. | The cut names the owning file and step by slug — `road-to-cost-parity-1-rule-payload-diet` step 1.1 — and why duplication would fork the verdict list; the finding is redirected, not discarded. Re-reviewed 2026-08-20: the mitigation was a prose reference to "the estate-diet roadmap" and no file carries that name, so the redirect pointed nowhere. | Context |
| 5 | Degraded is treated as available | implementation | A four-value verdict collapses back to a boolean at the first consumer that does not handle the middle. | The quorum step reads qualified seats only, so a degraded seat cannot contribute to a quorum by default. | Phase 3 |
| 6 | The restated Phase 1 resume condition stalls the same way the first one did | implementation | The corrected condition needs repeated same-mode observations, and nothing in the tree schedules a capture — so the phase can sit blocked indefinitely while the block reads as resolved-in-principle. | The condition names the two fields and the fixed mode, so any reader can settle it with one pass over `agents/evidence/metrics/skill-catalogue.jsonl`; the phase note records the row count at correction time (7) so a later reader can measure whether the base grew at all rather than re-deriving it. | Phase 1 |

## Acceptance Criteria

- [-] A host with measured truncation pressure projects a reduced set and a host without one does not, with both traceable to a recorded measurement. <!-- [-] transferred to stubs/road-to-host-aware-skill-projection.md (council disposition B, outcome: transferred) — depends on Phase 1 steps 1.1-1.3, all transferred -->
- [x] A typeless evidence artifact fails its check.
- [x] A deliberately broken council seat reports unavailable, and a run against it reports short rather than printing a quorum.
- [x] No step in this roadmap duplicates a step in the estate-diet roadmap (`road-to-cost-parity-1-rule-payload-diet`). <!-- verified 2026-08-20: three greps over that file return 0 — `grep -icE "host-aware|host capability profile|skill projection|catalogue truncation"` = 0, `grep -icE "evidence artifact typ|artifact type"` = 0, `grep -icE "qualification|quorum|council seat"` = 0. Its six phases are census, skill-cluster consolidation, norm-lines, uncapped growth surfaces, the maintenance promise, and an explicit will-not-do list; none of the three subjects here appears in any of them. -->
- [x] The two folded findings are traceable to the roadmap that absorbed them. <!-- verified 2026-08-20: the Context table now names both absorbing files by slug and cites the owning step — `road-to-cost-parity-1-rule-payload-diet` step 1.1 for the estate finding, `road-to-context-fidelity` Phase 0 for context-loss accounting. Before this edit both rows said only "the estate-diet roadmap" and "the context-fidelity roadmap", and `grep -rl "estate-diet" agents/roadmaps/` matched only this file — so the estate pointer resolved to nothing a reader could follow. -->

## Provenance

- Source: an external release review of this package, 2026-08-15, pinned at `e3bd961` and re-verified at `6d18f5bb2` for this file. The Context table records the disposition of every P0 and the two P1 items that were folded or overtaken.
- Raw review material stays local and untracked at `agents/tmp.old/feedback-12.1.0.txt`.
- Council: not convened. The three carried items were unbuilt on tree evidence rather than contested.
