---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to cost parity — 1: the maintained estate shrinks where nothing else owns it

> 290 skills and 119 rules must all stay true, reviewed and non-contradictory
> (re-measured 2026-08-20; the file was authored against 289 / 116 — see
> [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) § 2)
> regardless of what any session loads. This roadmap takes the part of that
> problem no existing roadmap owns: skill-cluster consolidation, an authored
> norm-line per surviving rule, and two small caps — and explicitly leaves
> the command surface, the `tier:` field and the adherence bench to their
> existing owners.

> **REOPENED 2026-08-13 — maintainer pick, resume condition (c).** Moved back
> out of `later/` into the active tree. The authorisation is the standalone
> tranche the council itself flagged as available: the bundling of the
> consolidation pilot with the norm-line work "is a choice, not a structural
> necessity", so the observed-counts-only basis can proceed without waiting on
> the two gates that are still shut. Conditions (a) and (b) remain UNMET and are
> not claimed — `road-to-surface-consolidation` Phase 3 is still time-gated to
> ~2026-08-26 and the live trigger eval has not run — so the phases that depend
> on them stay blocked; what reopens is the census and the consolidation tranche.
> The paragraph below is the parking record it supersedes, kept because the
> reasoning it carries is still the reason the other phases wait.
>
> **Parked in `later/` (2026-08-10 — AI-council convergence, maintainer pick).**
> Both council members independently recommended opening only the unblocked
> parts of this family first, so the queue is shown to move before blocked
> scope is added. Every phase below beyond the census is gated on something
> outside agent control: the utilization sweep this roadmap's census reuses is
> time-gated, the trigger-accuracy instrument is blocked on a user-owned live
> eval, the adherence question is owned by two spend-blocked benches, and the
> deletion cut-line belongs to a `later/` sibling.
> **Resume when ANY of:** (a) `road-to-surface-consolidation.md` Phase 3's
> utilization sweep has run and its verdict vocabulary is available to reuse;
> (b) `road-to-skill-description-measurement.md`'s live trigger eval has run,
> unblocking the Phase 2 accuracy bar; or (c) the maintainer authorizes the
> skill-consolidation pilot as a standalone tranche on its observed-counts-only
> basis (the council noted the bundling is a choice, not a structural
> necessity — consolidation can ship without the norm-line work).

## Outcome — closed 2026-08-20 (archived does NOT mean achieved)

**Archived at 0 open steps. One phase of six was carried to a real result, and
that result was a STOP.** Of 50 open lines: **13 satisfied**, **16 transferred**,
**20 abandoned**, and **1 standing constraint** that is neither (2.1b, which the
shared stub forbids closing). Counted off the markers themselves, not asserted —
an earlier draft of this paragraph said 14 / 23 and was wrong, which is the same
unverified-number failure the corrections below are about. Nothing in this
roadmap's Goal paragraph was delivered — the
maintained skill count did not drop, no rule gained a `norm:` line, and neither
growth surface gained a cap. Read the per-step `**→**` notes for the reason on
each line; the readings behind all of them are in
[`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md).

| Phase | Outcome | Why, in one line |
|---|---|---|
| Prerequisites | `transferred` (1/1) | The sweep this roadmap's census reuses is time-gated; blocker `utilization-sweep-window`. Its producer roadmap is itself parked in `later/` — see that blocker's resolution. |
| 1 — census | `transferred` (5/5) | The census reuses another roadmap's verdict vocabulary, which does not exist yet. Its two non-gated evidence columns were measured anyway and are on record. |
| 2 — consolidation | `transferred` (7/8) + 1 standing | Permission was granted in 2026-08-14; an instrument and a clock still gate it. The bar-bearing steps move to the shared live-trigger-eval stub. |
| 3 — norm-lines | **`abandoned`** (7/8), 3.5c **`satisfied`** | 3.5c is the one step that closes as done, and it closes by **stopping its own phase**: the Claude rule emitter carries `paths:` and nothing else, so a `norm:` frontmatter field is never delivered to the host this family measures against, while 3.4's section markers would add 5,610 bytes of body carrying none of the norm. Net positive on every carrier → the step's stop-condition fires as written. |
| 4 — two caps | `abandoned` (6/6) | 4.1a's end-rule needs ≥ 51 of 101 verbs observed; the proxy shows 11 over 127 sessions, so the census self-predicts inconclusive. 4.3's transcribed baseline went stale on 7 of 8 hosts in two days, which is an argument for a *computed* cap rather than for this step. |
| 5 — promise + contexts | `abandoned` (3/4), `satisfied` (1/4) | 5.4's exclusion statement is verified and recorded; 5.1–5.3 are unblocked, unstarted, and stated as unstarted rather than dressed as anything else. |
| 6 — non-goals | `satisfied` (8/8) | Every non-goal held, verified against the branch diff: `src/rules/` and `src/skills/` untouched, no rule deleted, **zero** new lints against a ceiling of four. |
| Acceptance criteria | `satisfied` (3/10), `transferred` (3/10), `abandoned` (4/10) | The three that hold are the negative ones — `dist == rewrite(src)` (trivially: Phase 3 never ran), the new-lint ceiling (zero introduced), and the no-file-owned-by-a-sibling criterion. Not one of the seven substantive criteria was met. |

### What a successor should inherit, and what it should not

**Inherit the 3.5c finding — it is the durable output of this roadmap.** The
design question it hands forward is real and is not a variant of Phase 3: a norm
that must reach a Claude session has to live in the rule **body** (where
`preservation-guard` governs it) or the Claude emitter has to carry the field.
Two of this roadmap's own load-bearing statements do not survive the reading and
should not be re-proposed unchanged — Risk 2 assumes the norm is delivered, and
6.8 infers a frontmatter field is in the payload because the rule is.

**Do not inherit the figures.** Five of six cited baselines had drifted upward
between authoring and this close, and two of the three facts the trigger-accuracy
blocker rested on are refuted outright. Every number in this file is now dated
and sourced; re-measure before relying on any of them.

**Do not re-derive the transferred arm.** One shared stub covers the live
trigger-eval for this roadmap and its sibling. A parallel window would produce a
second number nobody can reconcile with the first, which is the reason the
council merged them.

## Goal

The maintained skill count drops by cluster arithmetic with trigger accuracy
held, every surviving rule carries an authored one-line normative core under
a drift lint, and the two uncapped growth surfaces (CLI verbs, hook chain
length) gain a census and a cap — with the write-denied kernel rules excluded
via a contract-derived list and no shipped artefact deleted without its
migration note.

## Prerequisites

- [x] `road-to-cost-parity-0-program.md` target table registered — this
      roadmap's before/after numbers are measured against its pinned
      baseline, not against a fresh measurement.
- [-] `road-to-surface-consolidation.md` Phase 3 utilization sweep has run
      (time-gated, ~2026-08-26). Its KEEP/MERGE/DEMOTE/REMOVE mechanic over
      commands is the instrument Phase 1's census reuses for skills — this
      roadmap does not build a second one.
      **→** transferred — blocker `utilization-sweep-window`, council disposition **B**, outcome `transferred`; the producer is that roadmap's Phase 3 owner.

## Context (verified against the tree 2026-08-10, do not relitigate)

The scope below is what survived a claim-by-claim verification of the source
draft. What was cut, and why, is enumerated in
[`road-to-cost-parity-0-program.md`](../archive/road-to-cost-parity-0-program.md)
§ Context. Three cuts matter enough to restate here because they would
otherwise be re-proposed:

- **The `109 divergent deliveries` prerequisite is dropped, because the figure
  measures cache staleness rather than the source.**
  `report_carrier_divergence` compares a globally installed carrier against
  the project projection on disk, and either can be stale independently — at
  `3deb55443` a checkout with a stale 92-file projection reports 91 shared /
  90 stamp-only / 1 body, and a freshly generated 110-file one reports 109 / 0
  stamp-only / 109 body. "109 differ in body" therefore says the global install
  is behind, not that the source diverged. Any before/after this roadmap
  measures must be taken **in one checkout, post-regeneration, and stated with
  which** — never used as a blocking bar. It also relitigated
  `dedup-reachability-refusal.md`, whose five reopen conditions are unmet.
  There is no established delivery corruption to fix before measuring; if one
  is ever established it needs a carrier-independent instrument first.
- **The `201 KB` ownership matrix is already generated** — the file carries a
  *"Do not edit — regenerated"* header and `generate_ownership_matrix.ts`
  exists.
- **The core/pack split is ~85 % built.** All 290 skills already declare
  `workspaces:`, `packs:` and `install.default`. Only the maintenance-promise
  marker is missing, and that is one frontmatter field (Phase 5).

Two facts shape how the rule work must be done:

- **Nine kernel rules deny agent writes outright**
  (`agent-authority`, `ask-when-uncertain`, `commit-policy`,
  `direct-answers`, `language-and-tone`, `no-cheap-questions`,
  `non-destructive-by-default`, `scope-control`, `verify-before-complete`),
  and `scope-control § Kernel-rule edits` requires an own PR with ≥ 24 h
  between merges. They are not dietable at tranche pace and are excluded via a
  list DERIVED from the kernel contract at run time (§ 3.5), never hardcoded.
- **`preservation-guard` forbids stripping negation clauses.** The source
  draft proposed restating `NEVER X` prohibitions as positive targets. That
  is precisely what that rule's reject criteria name. Phase 3 therefore
  writes norm-lines *alongside* rule bodies and never rewrites a prohibition.

And one fact explains why the payload is worth attacking at all:
`dist/router.json` has **no runtime host consumer**, so `type: auto` does not
gate delivery — 110 of 116 rules reached a Claude session and all 115 reached an
Augment session, regardless of the type field. The per-host numbers are in
part 0's table.

## Phase 1 — census with decided verdicts

- [-] 1.1 One census manifest at `agents/evidence/analysis/estate-census.md`
      plus a machine-readable sibling: every skill and every non-kernel rule
      gets a verdict — `keep` / `merge-into:<target>` / `pack:<name>` /
      `delete` — with a one-line reason. A verdict is `pending` until
      actually decided; `pending` is never silently read as `keep`.
      **→** transferred — `utilization-sweep-window` (**B**, `transferred`): the manifest reuses the sweep's verdict vocabulary, which does not exist yet.
- [-] 1.2 The census reuses `road-to-surface-consolidation.md` Phase 3's
      verdict vocabulary and sweep mechanic rather than defining a second
      one, and records in its header that commands are out of scope because
      that roadmap owns them.
      **→** transferred — `utilization-sweep-window` (**B**, `transferred`); this step *is* the dependency on that sweep.
- [-] 1.3 Evidence columns cite real instruments and mark their own gaps:
      `report_skill_activation` for skill usage (with its window depth
      stated — see the blocker), `check_enforcement_coverage` for backstop
      status (**re-measured 2026-08-20: 12.6 %, 15 of 119, 34 declared /
      85 undeclared** — the roadmap was authored against 12.9 %, 15 of 116,
      32 / 84), and
      git churn for staleness. A column with no data reads `absent`, never a
      default.
      <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage --quiet -->
      **→** transferred — `utilization-sweep-window` (**B**, `transferred`) for the manifest, and the skill-usage column additionally to the shared live-trigger-eval stub. The two non-gated columns were measured anyway and are on record: enforcement coverage **12.6 % (15/119)** and activation **5 of 290** — [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) §§ 1–2.
- [-] 1.4 A cheap-tier pass may draft verdicts and cluster mappings as
      PR-reviewable proposals. Nothing model-drafted reaches a carrier
      without a decided verdict in the census PR — drafting is an authoring
      aid, and the anti-paraphrase doctrine holds for delivery.
      **→** transferred — `utilization-sweep-window` (**B**, `transferred`); a drafting policy with no census to draft into.
- [-] 1.5 The nine kernel rules appear in the census with verdict
      `keep (kernel, write-denied)` and no further processing — so a reader
      sees they were considered, not skipped.
      **→** transferred — `utilization-sweep-window` (**B**, `transferred`). The derivation it depends on is verified feasible: the nine are readable from `kernel-membership.md` § 4 (artefact § 5).

**Exit:** every skill and non-kernel rule carries a decided, reasoned verdict with its evidence columns populated or explicitly `absent`.
**Rollback:** the census is evidence; nothing has moved.

## Phase 2 — skill-cluster consolidation, pilot first

- [-] 2.1 Pilot: the Laravel/PHP cluster, 25 skills → 1 skill + per-topic
      reference files. Bodies move **byte-preserving** except for routing
      glue; the merged `SKILL.md` routes by topic. Measured on the tranche:
      frontmatter bytes delta and lint pass.
      <!-- verify: task lint-skills -->
      **→** transferred — both blockers (**B**, `transferred`): the verdict vocabulary via `utilization-sweep-window`, the activation baseline via the shared live-trigger-eval stub.
- [-] 2.1b **No trigger-accuracy bar is asserted until its instrument is
      verified.** A bar needs a before, and there is no verified before.
      **Two of the three facts this step was authored on are refuted, and the
      conclusion survives both corrections** (re-measured 2026-08-20, see
      [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) § 1):
      the activation figure is **5 distinct of 290 over 30 sessions**, not 6 of
      288, and it is window-dependent — two other censuses of the same
      instrument record 6 of 288 over 59 sessions and 4 of 288 over 30; and
      **four skills DO declare a machine-matchable trigger**, not zero
      (`merge-conflicts` SKILL.md:10, `systematic-debugging` :11,
      `threat-modeling` :13, `authz-review` :14). What holds unchanged is the
      reason no bar may be asserted: the integer is not stable enough to anchor
      one, single-digit distinct skills against a ~290 catalogue is the finding
      in every reading, the host
      truncates the injected catalogue, and
      `road-to-skill-description-measurement.md` — which owns the live eval
      that would produce the baseline — is blocked on
      `human-gated-live-trigger-eval` with the user as owner. Until that eval
      runs, the pilot records activation **as an observation, not a gate**:
      the tranche PR publishes the pre- and post-merge activation counts it
      actually observed, with the window and its depth stated, and draws no
      pass/fail conclusion from them. A bar over an unverified instrument
      would be the unbacked-claim failure this repo has been burned by, in a
      place where it also silently authorises capability loss.
      **→** NOT transferred and NOT satisfied. This is a standing prohibition, and the shared live-trigger-eval stub carries it verbatim with the instruction that it "does not transfer and must not be closed". Cancelled here as a *tracked step* only — the constraint stands for as long as that stub does.
- [-] 2.1c Once that eval has run, the bar adopts **its** pre-registration
      rather than a fresh number — ≥ 100 requests, ≥ 3 shapes, no skill
      degrading more than 20 % — because a second bar on the same question
      would be a competing instrument. The adoption is one line in the
      tranche template citing that roadmap.
      **→** transferred — named explicitly in the shared live-trigger-eval stub (`skill-activation-window`, **B**, `transferred`).
- [-] 2.2 Consolidation is movement, not rewriting. Content edits are
      separate PRs *after* the move, so the diff proves no norm was softened
      in transit — `preservation-guard`'s own standard applied to skills.
      **→** transferred — both blockers (**B**, `transferred`); a discipline for a move that has not happened.
- [-] 2.3 Each tranche ships with its migration note: merging 25 skills
      deletes 24 published skill names, which breaks `packs/*.yml` entries
      and every `requires_skills:` reference. The note enumerates the
      renames and the tranche updates every reference in the same change.
      <!-- verify: task check-refs -->
      **→** transferred — both blockers (**B**, `transferred`). The permission half is separately discharged; the note rides a tranche that cannot land yet.
- [-] 2.3b The reference update is bound to a **gate, not to the note.**
      `check-refs` proves no link is broken; it does not prove that a
      *removed skill name* has no surviving referent, because a bare name in
      `packs/*.yml` or a `requires_skills:` list is not a link. Add a check
      that takes the tranche's removed-name set and fails on any surviving
      occurrence across `src/`, `packs/`, the pack manifests and the
      generated projections — red on a fixture that removes a skill and
      leaves one `requires_skills:` entry behind. Without it the migration
      note is a promise reviewed under fatigue.
      <!-- verify: task test -- --filter=skill_rename -->
      **→** transferred — both blockers (**B**, `transferred`); no tranche exists for a removed-name gate to guard.
- [-] 2.4 Then, each with the same measurement discipline and its own revert:
      `project-analysis-*` (10 → 1 + refs), `judge-*` (7 → 1 parameterised),
      `brand*` (6 → 1), the image family (7 → 2), `readme*` (3 → 1).
      Independent PRs; one bad merge reverts alone.
      **→** transferred — both blockers (**B**, `transferred`).
- [-] 2.5 Once 2.1c's bar exists, a tranche that misses its margin reverts as
      a tranche and the miss is published — a consolidation that breaks
      activation converts frontmatter savings into silent capability loss,
      and that trade is refused, not absorbed. Before the bar exists, the
      revert trigger is a **reported regression in the observed activation
      counts** plus the maintainer's call, stated as such rather than dressed
      as a threshold.
      **→** transferred — the bar-gated half is named in the shared live-trigger-eval stub. The interim rule in the same step (a reported regression plus the maintainer's call) is already live and does **not** transfer.

**Exit:** maintained skill count drops by cluster arithmetic; every tranche has its observed activation counts on record (or its bar comparison once 2.1c applies), the rename gate is green, and its references are updated.
**Rollback:** per tranche, independently.

## Phase 3 — authored norm-lines and sectioning, kernel carved out

- [-] 3.1 Every surviving **non-kernel** rule gains a frontmatter `norm:`
      field: one authored line stating the rule's normative core,
      lint-checked for presence and length, reviewed in the rule's own PR
      like any other content. Explicitly not model-generated summarisation.
      **→** abandoned — 3.5c's stop-condition fired on measurement: the Claude rule emitter carries `paths:` and nothing else, so a `norm:` frontmatter field is never delivered to the host this family measures against (artefact § 3).
- [-] 3.2 A drift lint fails CI when a rule body changes without its `norm:`
      being touched — the same shape as source-pointer freshness. Without it
      an index line silently delivers a stale norm to every session.
      <!-- verify: task test -- --filter=norm -->
      **→** abandoned — 3.5c fired; this lint would guard an undelivered field.
- [-] 3.3 Prohibitions are preserved verbatim. Where a positive target
      exists it is added as the `norm:` line; the `NEVER X` clause in the
      body stays. `preservation-guard § Reject criteria` names stripping
      negation clauses as a rejection, and this roadmap does not argue with
      it.
      **→** abandoned — 3.5c fired. The constraint was never at risk: `src/rules/` is untouched by this branch, so no prohibition was rewritten.
- [-] 3.4 Marker-delimited `norm` / `rationale` / `examples` sections in
      surviving non-kernel rules, lint-enforced. Any section-cut projection
      lands in a separate output tree — never in `dist/agent-src/`, whose
      byte-exactness invariant (`dist == rewrite(src)`) is asserted by
      `check_condensation` and is not reopened here.
      <!-- verify: task check-condensation -->
      **→** abandoned — 3.5c fired, and this is the step that made it fire hardest: markers are **body** content, so they are the +5,610 bytes that *do* reach a Claude session while carrying none of the norm.
- [-] 3.5 The kernel rules are excluded from 3.1–3.4 by a list **derived at
      run time, never hardcoded**: the sweep reads the kernel set from
      `docs/contracts/kernel-membership.md` (the same source
      `check_static_layer_stability` derives it from) and refuses to run if
      that read fails. A hardcoded nine-name list is a second source of truth
      that silently goes wrong the day the kernel changes — and it would go
      wrong in the most expensive direction, sweeping a rule whose byte-prefix
      is asserted. The count is nine today; the sweep must not depend on that
      staying true.
      <!-- verify: task check-kernel-prefix-stability -->
      **→** abandoned — 3.5c fired, so there is no sweep to exclude from. The derivation is verified feasible exactly as specified (artefact § 5): unbuilt, not unbuildable.
- [-] 3.5b A fixture pins the derivation: adding a tenth rule to the kernel
      source excludes it from the sweep without any edit to the sweep, and an
      unreadable kernel source makes the sweep refuse rather than proceed with
      an empty exclusion set.
      <!-- verify: task test -- --filter=kernel_exclusion -->
      **→** abandoned — 3.5c fired; there is no derivation to pin.
- [x] 3.5c **Measure the payload delta before Phase 3 commits, because
      norm-lines can make it worse.** 3.3 adds the norm-line *alongside* the
      body rather than replacing it (preservation-guard forbids the
      replacement), so this phase's arithmetic is additive on a surface the
      programme exists to shrink. The first tranche publishes bytes-before and
      bytes-after against part 0's registered per-host rows; if the net is
      positive, Phase 3 stops and the design is reconsidered rather than
      continued on the assumption that the index/detail split will recover it
      later.
      <!-- verify: task check-token-regression -->
      **→** **satisfied** — measured and published: **+18,260 B** on the three frontmatter-carrying carriers, and on Claude **+0 delivered / +5,610 B of markers**. Net positive on every carrier, so this step's own stop-condition fires and Phase 3 stops (artefact § 3). This is the one Phase 3 box that closes as done, and it closes by stopping the phase.
- [-] 3.6 Report the norm inventory in CI — the MUST/NEVER/ALWAYS total
      across survivors (**re-measured 2026-08-20: 194 across 119 rules**;
      authored against 171 across 116). Report
      only; a cap on this layer already exists as a pre-registered target in
      `road-to-rule-coherence-followup.md` and a second cap on the same
      surface is refused.
      **→** abandoned — 3.5c fired, so there are no norms to inventory. The underlying figure was re-measured for the record: **194** MUST/NEVER/ALWAYS across 119 rules.

**Exit:** every non-kernel rule carries a lint-checked `norm:` line and section markers; the drift lint is red on a fixture editing a body without its norm; the kernel exclusion list is pinned by a test.
**Rollback:** per rule; the fields are additive frontmatter and the projections are a separate tree.

## Phase 4 — the two uncapped growth surfaces

- [-] 4.1 CLI verb census: no per-verb invocation telemetry exists (the
      registry knows definitions, not calls). Add one record-only counter in
      the CLI entry — additive, gitignored state — then publish the census.
      **The window is committed here, not left open:** ≥ 4 weeks, i.e. double
      the ≥ 2-week floor the `rules_used` window already uses
      (`later/road-to-token-economy-dispatch-followup.md`), because a verb is
      invoked far more rarely than a rule is carried and the shorter floor
      would under-sample by construction.
      **→** abandoned — the counter was never landed, and landing it would open a window whose own end-rule predicts inconclusive (4.1a).
- [-] 4.1a The window has a **start condition and an end rule**, not just a
      length: it starts on the commit that lands the counter (recorded in the
      census header, so "when did this start" is answerable), and it ends at
      the later of ≥ 4 weeks elapsed **and** ≥ 1 recorded invocation for at
      least half the registry — because four weeks of an idle machine is not a
      window, it is an absence. If the second condition is unmet at 8 weeks,
      the census publishes as inconclusive and no verb is sunset.
      **→** abandoned on measured self-refutation: the end-rule needs ≥ 51 of 101 verbs observed; the transcript proxy shows **11 distinct over 127 session files** — more elapsed time than the window allows, at a fifth of the required reach (artefact § 4b).
- [-] 4.1b The rule that keeps the window from being load-bearing, committed
      with it: **zero invocations in the window is `no-data`, never `dead`.**
      A verb reaching the census with no observations is reported as
      unobserved and stays; only a verb with observations *below* the
      committed floor is a sunset candidate. One maintainer's four weeks is
      not evidence of a verb's uselessness, and a census that cannot
      distinguish the two would sunset the rarest-but-load-bearing verbs
      first.
      **→** abandoned with 4.1 — and the rule is **correct**, which is precisely why this ends in no action rather than a cut: unobserved is `no-data`, never `dead`.
- [-] 4.2 The registry budget ratchets **down** after the census, using the
      existing `check_cli_registry_budget_sync` machinery pointed the other
      direction. **Re-measured 2026-08-20: 101 verbs** — authored against 97,
      and the movement is upward while the census that was to precede the
      ratchet has not been built. The gate is green because registry and
      budget agree; agreement at a higher number is not what this step was
      written to produce.
      <!-- verify: ./scripts-run src/scripts/check_cli_registry_budget_sync --quiet -->
      **→** abandoned — it ratchets down "after the census", and the census is transferred. Meanwhile the registry moved **97 → 101**, upward, which is the opposite of this step.
- [-] 4.3 Hook chain-length cap as a manifest lint: a new concern on a
      capped slot must name the concern it replaces or merges into. Measured
      baseline: **refreshed 2026-08-18** by `road-to-per-turn-hook-economy` step
      4.3, read straight off `src/scripts/hook_manifest.yaml`. The prior line
      here said "9 concerns on `user_prompt_submit` for claude, 7–8 on other
      hosts"; both halves had drifted, and a cap anchored on a stale census ages
      in the one direction that matters — upward, so the cap admits growth it was
      written to refuse.

      | host | `user_prompt_submit` | `pre_tool_use` | `post_tool_use` | `stop` | `session_start` | `session_end` |
      |---|---:|---:|---:|---:|---:|---:|
      | augment | — | 11 | 11 | 6 | 14 | 4 |
      | claude | **10** | **13** | **12** | **12** | 14 | 4 |
      | cowork | 8 | 13 | 11 | 6 | 14 | 4 |
      | cursor | 8 | — | 11 | 6 | 14 | 4 |
      | cline | 8 | — | 11 | 6 | 14 | 4 |
      | windsurf | 7 | — | — | 5 | 13 | — |
      | gemini | 8 | — | 11 | 6 | 14 | 4 |
      | copilot | — | — | — | — | — | — |

      **Re-measured 2026-08-20 and stale AGAIN — this is the finding, not the
      table.** The row above replaces the 2026-08-18 refresh, which had drifted
      on **7 of the 8 hosts in two days**, every movement upward (augment
      `post_tool_use` 10→11 and `session_start` 13→14; claude `pre_tool_use`
      12→13, `post_tool_use` 11→12, `stop` 11→12, `session_start` 13→14; the
      same `session_start` +1 on every other bound host). Full diff in
      [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) § 4.

      The 2026-08-18 note already said a stale census "ages in the one
      direction that matters — upward, so the cap admits growth it was written
      to refuse." Two refreshes and two stalings inside one drain run is
      evidence about the **mechanism**: a cap whose baseline decays faster than
      the cap can be authored is not a cap, it is a number that gets raised to
      admit whatever landed since. What 4.3 needs is a **computed** cap — a gate
      reading `hook_manifest.yaml` at run time, exactly as 3.5 requires for the
      kernel set — not a transcribed table. That is different work from the step
      as written, which is why this step closes `abandoned` rather than open.

      **Re-measured AFTER the flush bindings in the same PR, which the first pass
      got wrong.** The table originally read `stop` 5/10 and `session_end` 3 — a
      census taken before `road-to-per-turn-hook-economy` step 3.1 added
      `roadmap-progress` to those two slots on six hosts, i.e. a baseline stale by
      the very change the same PR made. `windsurf` keeps 5 and no `session_end`
      because it has no `post_tool_use` surface, so it never marks the ledger and
      received no flush binding. Caught by the R2 review; the lesson is the
      cheap half — re-read the manifest AFTER your own edit, not before it.

      A dash is **no binding on that slot for that host**, not a zero-length
      chain — copilot is `fallback_only` and carries no hook surface at all,
      while cursor / cline / windsurf / gemini alias a native pre-tool event that
      nothing binds (the four states are tabulated in
      [`hook-architecture-v1`](../../../docs/contracts/hook-architecture-v1.md)).
      The cap must not read a dash as headroom.
      **claude is the binding host on every slot**, so a per-host cap set from
      any other row is set from the wrong row.
      <!-- verify: task test -- --filter=hook_manifest -->
      **→** abandoned — the transcribed baseline went stale on **7 of 8 hosts in two days** (artefact § 4). What this needs is a **computed** cap reading `hook_manifest.yaml` at run time, as 3.5 requires for the kernel set; that is different work from the step as written.
- [-] 4.4 Each of the two caps names the mechanism it removes or replaces,
      per `surface-consolidation-restraint.md`'s load-bearing rule that
      growth of the mental surface is paid for by removal: 4.2 replaces
      manual registry review, 4.3 replaces the manual chain audit.
      **→** abandoned with 4.2 and 4.3 — neither cap landed, so there is no manual review to name as removed.

**Exit:** the verb census is published with per-verb counts, the registry budget is a downward ratchet, and the chain cap is red on a fixture adding an unpaired concern.
**Rollback:** the counter is additive and gitignored; each cap is one config number.

## Phase 5 — the maintenance promise and the contexts surface

- [-] 5.1 The `maintained:` frontmatter marker — the 15 % of the core/pack
      split that is not already built. A pack marked `maintained: false` is
      best-effort: no review dates, excluded from estate caps. Content is
      preserved either way; what changes is the promise attached to it.
      **→** abandoned — unblocked but unstarted, and stated as such. It belongs with the core/pack split it completes rather than with a payload diet whose premise collapsed at 3.5c.
- [-] 5.2 Declare the maintained core as the engineering and
      agent-governance workspaces, and record which packs take the
      best-effort marker. Release notes list every move, because moving a
      skill to `default: false` changes what an existing install receives.
      **→** abandoned with 5.1 — it declares the marker 5.1 does not add.
- [-] 5.3 Contexts species separation, on the **shipped** surface:
      `src/agent-src/contexts/` (measured 57 files / 381 KB) holds only
      files with a live consumer; one-off harvest and cut notes relocate to
      `agents/evidence/` with links updated.
      <!-- verify: task check-refs -->
      **→** abandoned — unblocked but unstarted. Re-measured for whoever picks it up: `src/agent-src/contexts/` holds **58** files today, not the 57 recorded.
- [x] 5.4 State plainly in the census header that
      `agents/settings/contexts/` (78 files / 725 KB) is **not** in
      `package.json` `files[]` and ships to nobody — it is a maintainer
      working directory. Tidying it is maintenance, not surface reduction,
      and is not counted toward any payload target.
      **→** **satisfied, venue moved** — no census exists, so the statement is recorded in the drain readings artefact § 5 with its command output: `package.json` `files[]` has 26 entries, **none** matching `/context/`, and `agents/templates/` is its only `agents/` path. The directory ships to nobody. Its size has *grown* since measurement (88 files vs the 78 recorded), which strengthens the exclusion rather than weakening it.

**Exit:** the marker exists and is populated per pack; the shipped contexts directory contains only consumer-backed files; the non-shipped directory is documented as such.
**Rollback:** the marker is one field; relocations are moves.

## Phase 6 — what this roadmap will not do

- [x] 6.1 No command-surface work — `road-to-surface-consolidation.md` owns
      it, is 92 % done, and has two live blockers this roadmap must not
      close by absorption.
      **→** **satisfied** — verified by the branch diff: no file that roadmap owns was touched.
- [x] 6.2 No `tier:` field removal — `road-to-tier-removal.md` owns it and
      is blocked on `trigger-set-amendment`, an act this roadmap does not
      perform.
      **→** **satisfied** — verified: `src/rules/` and `src/skills/` are untouched by this branch, so no `tier:` field moved.
- [x] 6.3 No rule **deletion** — the cut-line from the `rules_used` window
      belongs to `later/road-to-token-economy-dispatch-followup.md`. This
      roadmap merges and annotates; it does not delete rules.
      **→** **satisfied** — verified: `git diff --diff-filter=D origin/main..HEAD -- src/rules/` is empty.
- [x] 6.4 No rule→skill migration. `road-to-solution-minimalism.md` F1
      measured **zero** description-triggered skill self-activation across
      ten sessions, which is why the ladder shipped as rule text. Moving
      norms toward an instrument measured as inert needs that null rebutted
      first, and rebutting it is not this roadmap's work.
      **→** **satisfied** — none attempted; the measured null it defers to stands unrebutted.
- [x] 6.5 No adherence eval and no A/B bench — two existing roadmaps own
      that question and both are spend-blocked (see part 0's blocker). This
      roadmap consumes their result; it does not open a third bench.
      **→** **satisfied** — no third bench was opened.
- [x] 6.6 No frontmatter field deletion — `routes_to:` (62 rules),
      `collision_ok:` (46), `self_contained:` (44) each need their readers
      proven absent first, and `routes_to:` feeds the router that
      `check_static_layer_stability` reads. A consumer audit is a
      prerequisite for a future roadmap, not a step here.
      **→** **satisfied** — verified: no frontmatter field was deleted from any rule.
- [x] 6.7 No new lint beyond the enumerated set (norm presence, norm drift,
      section markers, chain-length cap, removed-name gate, kernel-exclusion
      derivation) plus the two ratchet repoints. A maintenance roadmap that
      grows the meta-estate refutes itself, and the count is an acceptance
      criterion.
      **→** **satisfied** — verified: **zero** new lints introduced against a ceiling of four. The meta-estate did not grow, because the diet did not happen.
- [x] 6.8 **No payload growth from this roadmap's own governance — stated as a
      byte ceiling, not as a rule-type claim.** "No new always-loaded prose" is
      ambiguous here: only 9 of 119 rules are `type: always`, yet 110 reach a
      Claude session, so a norm-line is in the payload whatever its type says.
      The checkable form is part 0's registered per-host row: any norm-line or
      section-marker addition that would push `.claude/rules/` past its
      registered interim target must subtract equivalent bytes elsewhere or
      red the phase (3.5c is the measurement).
      **→** **satisfied** — and 3.5c is the measurement it names. It also **corrects 6.8's own inference**: the rule *body* reaches a Claude session, the *frontmatter* does not, so a `norm:` line is not in that payload whatever its type says (artefact § 3).

## Blockers

### blocker: skill-activation-window

- **Status:** resolved
- **Outcome state:** `transferred` — **MERGED** with
  `human-gated-live-trigger-eval` from
  [`road-to-skill-description-measurement.md`](../road-to-skill-description-measurement.md)
  into ONE shared stub. `Status:` reads `resolved` because that is the only token
  `lint_roadmap_blockers` accepts as closed; the honest state is *transferred*,
  and it is recorded on this line rather than in the status token.
- **Owner:** user
- **Class:** 3 — human-only (a pointer to a class-3 entry under another name)
- **Blocks:** Phase 1.3's skill-usage evidence column; Phase 2's
  trigger-accuracy bars
- **What to do:** `road-to-skill-description-measurement.md` is blocked on
  `human-gated-live-trigger-eval` with the same gap under a different name —
  its pre-registration (≥ 100 requests, ≥ 3 shapes, no skill degrading
  > 20 %) is the bar Phase 2 needs. Recorded independently and **corrected
  2026-08-20**: 5 distinct of 290 skills invoked over 30 sessions (not 6 of
  288, and the figure is window-dependent), and **four** skills declare a
  machine-matchable trigger (not zero) — see
  [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) § 1.
  The host truncates the
  injected catalogue, which is not measurable from transcripts. So the
  activation instrument's depth on this store is unverified until that eval
  runs.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Do NOT commission a second eval.
  This entry is a pointer, and its own text says the sibling's
  pre-registration IS the bar Phase 2 needs — so adopt that pre-registration
  as this roadmap's window and resume when the sibling's predictions JSON
  exists. One human sitting then discharges two blockers instead of one, and
  a parallel window would produce a second number nobody can reconcile with
  the first.
- **If you do nothing:** 49 steps stay open behind an instrument whose depth
  on this store is unverified, and Phase 1.3's evidence column stays a column
  with no evidence in it. Of the three facts originally recorded here, the
  first two are refuted and re-measured (5 of 290; four triggers, not zero);
  the third — a host that truncates the catalogue — stays true and stays
  unmeasurable from transcripts.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**.
  Option (a) of `road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`
  accepts rendered defaults, but the council framework that option inherits
  ([drain-blocker-dispositions-a](../../evidence/council/drain-blocker-dispositions-a.md),
  Rule 3) is categorical: a host-controlled, human-gated evaluation cannot be recorded
  as agent-completed. Batch A already dispositioned this entry `B | transferred`, merged
  with `human-gated-live-trigger-eval` into ONE live-trigger-eval stub, and its
  three-point check is recorded there verbatim — original criterion, the dependent steps
  moved (Phase 1.1-1.2, Phase 1.3's skill-usage column, Phase 2's trigger-accuracy
  bars), and a named re-entry producer with a probe. The rendered default (do not
  commission a second eval) stands as the PREFERRED CHOICE inside that transfer, not as
  an accepted-and-done answer. The stub belongs to this roadmap's own closure, not to
  the decision-sheet run.
- **Resolved when:** the pilot tranche PR cites its activation baseline and
  the window it was measured over.
- **Resolution (2026-08-20) — transferred, merged with its twin.** The AI-council
  drain-run disposition framework
  ([`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md))
  gives this entry disposition **B**, outcome `transferred`, and orders **one**
  stub shared with `human-gated-live-trigger-eval`: *"Create one
  live-trigger-eval stub shared with human-gated-live-trigger-eval"* and
  *"Merge into skill-activation-window's single live-trigger-eval stub"*. The
  council's own recorded dissent asked which roadmap owns a merged stub; the
  answer is the pre-registration owner, i.e. the sibling.

  **The shared stub already exists and was written to accept this transfer
  as-is:** [`agents/roadmaps/stubs/road-to-live-trigger-eval.md`](../stubs/road-to-live-trigger-eval.md) <!-- ref-ignore -->. It carries both
  `Resolved when:` criteria verbatim, enumerates the three places this roadmap
  transfers (1.3's skill-usage column, 2.1c in full, 2.5's bar-gated half), and
  states in terms that *"the cost-parity roadmap has not been drained yet; when
  it is, its blocker closes against this file as-is"*. **No second stub was
  written**, which is the whole point of the merge.

  *The link carries `<!-- ref-ignore -->` because the stub is still on the
  sibling's branch (`origin/drain/road-to-skill-description-measurement`) and not
  yet on `main`. It is a deliberate forward reference: the marker keeps
  `check_references` green without pretending the file is already on the trunk,
  and it can be dropped the moment that branch merges.*

  **Two of the three facts this blocker rested on are refuted**, and the
  transfer is correct anyway — which is why the correction sits here rather than
  changing the disposition. Activation is 5 distinct of 290 over 30 sessions,
  not 6 of 288, and the figure is window-dependent across three competing
  censuses of the same instrument; and **four** skills declare a
  machine-matchable trigger, not zero. What survives untouched is the reason the
  eval is human-gated and the reason no bar may be anchored on the integer.
  Readings: [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) § 1.

  **Step 2.1b did NOT transfer and is not closed as done.** The stub instructs
  that it "must not be closed" while the instrument is unverified. It is marked
  `[-]` here as a *tracked step* only; the prohibition it states stands for as
  long as that stub does.

### blocker: consolidation-breaking-change-permission

- **Status:** resolved
- **Owner:** user
- **Blocks:** Phase 2 tranches landing
- **What to do:** merging a cluster deletes published skill names from
  consumer trees — a consumer-facing breaking change under
  `downstream-changes § Breaking changes`. Each tranche needs explicit
  permission plus its migration note; the pilot's note is the template for
  the rest. **The permission half is discharged — see the resolution below;
  the migration note is not, and rides each tranche as its deliverable.**
- **Resolution (2026-08-14):** **ALL tranches authorized in-session**, not only
  the pilot — the maintainer's blanket grant names this blocker explicitly and
  says so in terms. The permission half is permanently discharged and needs no
  re-asking, per tranche or in aggregate.

  **The migration note survives the grant as a deliverable, not as a gate.**
  The grant states this directly: each tranche still ships its note per
  `downstream-changes § Breaking changes`. What was released is the *asking*,
  not the *documenting* — a tranche that deletes 24 published skill names
  without enumerating the renames is still an incomplete change, and no
  authorization makes it complete.

  **What this does NOT unblock, stated plainly so the 49-step figure is not
  misread.** `agent-config gates` renders this blocker as "unblocks: 49 steps"
  because it counts the roadmap, not the critical path. Two independent
  conditions still gate Phase 2, and neither is a decision:

  - **`utilization-sweep-window`** (below) — Phase 1's census reuses
    `road-to-surface-consolidation` Phase 3's verdict vocabulary, and that
    sweep is time-gated to ~2026-08-26. A prerequisite at line 58 of this file
    is unmet.
  - **`skill-activation-window`** (below) — steps 2.1b/2.1c bind the
    trigger-accuracy bar to an instrument that is not yet verified. 2.1b is
    explicit that no bar is asserted until it is.

  So the honest post-grant state is: **permission granted, tranches still
  blocked on an instrument and a clock.** Recorded this way rather than
  flipping steps, because a tranche landed today would publish an activation
  comparison against a baseline that does not exist — the exact
  silent-capability-loss trade Risk 1 refuses.
- **Resolved when:** ~~the pilot tranche is authorized with its migration note
  reviewed~~ — authorized 2026-08-14; the note requirement moves into 2.3 as
  the tranche deliverable it always was.

### blocker: utilization-sweep-window

- **Status:** resolved
- **Outcome state:** `transferred` — the census moves behind the scheduled
  surface-consolidation sweep. `Status:` reads `resolved` because that is the
  only token `lint_roadmap_blockers` accepts as closed; the honest state is
  *transferred*, recorded here rather than in the status token.
- **Owner:** maintainer
- **Class:** 3 — human-only (time- and dependency-gated; no command and no decision)
- **Blocks:** Phase 1 census starting with real utilization data
- **What to do:** `road-to-surface-consolidation.md` Phase 3's sweep is
  time-gated to ~2026-08-26 and carries its own `repo-admin-and-usage`
  blocker. The census reuses its mechanic, so it waits rather than building
  a parallel one.
- **Resolved when:** that sweep has run and its vocabulary is available to
  reuse.
- **Resolution (2026-08-20) — transferred.** Disposition **B**, outcome
  `transferred`, per
  [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md):
  *"Move the utilization-dependent census behind the scheduled
  surface-consolidation sweep."* The council's rationale is that the census
  depends on a time-gated sweep carrying its own repo-admin dependency, and that
  duplicating the collector would create competing vocabularies.

  - **Original criterion, verbatim:** *"that sweep has run and its vocabulary is
    available to reuse."*
  - **Dependent steps moved:** the whole of Phase 1 (1.1–1.5) plus the
    vocabulary-dependent half of Phase 2's pilot (2.1). Each carries a `[-]` and
    a per-step reason naming this blocker.
  - **Re-entry producer:** the owner of
    [`road-to-surface-consolidation.md`](../later/road-to-surface-consolidation.md)
    Phase 3 — a named producer, not "when some subsystem exists". **Qualified
    2026-08-20 at close: that roadmap is itself PARKED in `later/`** (`status:
    later`, parked 2026-08-19 on a conjunctive resume condition), so the producer
    is named but not currently active. The probe below is unaffected — it tests
    for sweep evidence, not for the producer's mood — but a reader should not
    infer from "named producer" that anyone is working on it. This is a
    two-hop wait: the sweep resumes when that roadmap does.
  - **Detection probe:** dated sweep evidence exists **and** exports the
    reusable KEEP / MERGE / DEMOTE / REMOVE vocabulary.

  **No stub file of its own.** The re-entry producer is an active roadmap in the
  tree with the criterion already stated in its Phase 3, so a stub would be a
  third copy of a live dependency rather than a home for orphaned work. The
  transferred steps stay readable in this archived file, which the probe above
  points back to.

  **What was measured anyway, so the transfer costs no evidence.** Phase 1.3's
  two non-gated evidence columns did not need the sweep and were taken:
  enforcement coverage **12.6 % (15 of 119)** and skill activation **5 of 290**.
  Both are recorded with their commands in
  [`cost-parity-1-drain-readings`](../../evidence/analysis/cost-parity-1-drain-readings.md) §§ 1–2.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A merged cluster stops triggering where its parts did | product | Consolidation that breaks activation converts frontmatter savings into silent capability loss — the single most expensive way this roadmap can fail, and the instrument that would detect it is not yet verified | Sequenced honestly rather than papered over: no bar is asserted before its instrument exists (2.1b), tranches publish observed activation counts with their window depth instead, and the bar adopts the description-measurement roadmap's own pre-registration once that eval runs (2.1c); revert stays available per tranche throughout (2.5), and until the bar exists the revert trigger is a reported regression plus the maintainer's call rather than a fabricated threshold | Phase 2 |
| 2 | The norm-line drifts from the body it fronts | product | A stale index line delivers a wrong norm to every session — authored compression fails exactly like paraphrase if unmaintained | The drift lint (3.2) fails CI on a body edit without a norm touch; the norm is PR-reviewed content, not metadata; full text stays one load away | Phase 3 |
| 3 | A kernel rule is caught in a batch sweep | implementation | `check_kernel_prefix_stability` asserts the nine rules' byte prefix; a sweep including them reds CI and the fix looks like the sweep was wrong | The exclusion list is explicit and named in 3.5, pinned by a test, and the nine appear in the census with a `write-denied` verdict so they are visibly considered rather than forgotten | Phase 3 |
| 4 | Consolidation breaks a reference nobody grepped | implementation | `packs/*.yml`, `requires_skills:`, `.claude/skills/`, `.augment/` and `dist/` all carry skill names | 2.3 makes reference updates part of the tranche, `check-refs` is bound as its verification, and each tranche is an independent revert | Phase 2 |
| 5 | The census stalls at `pending` and the roadmap reads as active | product | 400+ verdicts reviewed under fatigue either approve themselves or never finish | `pending` is a legal recorded state, so stalled and paced are distinguishable; verdicts land in reviewable batches with evidence columns; the pacing line lives in the census header | Phase 1 |
| 6 | This roadmap grows the meta-estate it exists to shrink | implementation | Four new lints and two ratchet repoints are governance surface | 6.7 caps the count and makes it an acceptance criterion; 4.4 names the manual review each cap replaces, per the restraint lock | Phase 6 |
| 7 | Tidying the non-shipped contexts directory is counted as a win | product | 725 KB is the larger number and the more tempting target, and it ships to nobody | 5.4 states the exclusion in the census header itself, and part 0's payload table separates shipped from project-local | Phase 5 |

## Acceptance criteria

- [-] The census manifest exists with a decided verdict and reasoned
      evidence columns for every skill and every non-kernel rule, the nine
      kernel rules recorded as `write-denied`, and its header naming both
      out-of-scope surfaces (commands, non-shipped contexts).
      **→** NOT met — transferred with Phase 1 (`utilization-sweep-window`, **B**, `transferred`).
- [-] The Laravel pilot merged with its migration note and its **observed**
      activation counts on record — window and depth stated, no pass/fail
      claim unless 2.1c's instrument had already run — plus at least three
      further clusters, each with its own revert unexercised or
      exercised-and-published.
      **→** NOT met — transferred with Phase 2 (both blockers, **B**, `transferred`).
- [-] The removed-name gate from 2.3b exists and is provably red on a fixture
      that deletes a skill and leaves one `requires_skills:` entry behind.
      **→** NOT met — transferred with Phase 2.
- [-] Every non-kernel rule carries a lint-checked `norm:` line and section
      markers; the drift lint is provably red on a fixture editing a body
      without its norm; the kernel exclusion is provably enforced.
      **→** NOT met — abandoned: 3.5c's stop-condition fired before Phase 3 could commit.
- [x] `dist/agent-src/rules/` still satisfies `dist == rewrite(src)`
      byte-for-byte after Phase 3 — the section-cut projection lives
      elsewhere.
      **→** **satisfied**, trivially and verifiably: Phase 3 never ran and `src/rules/` is untouched. `check_condensation` green, 451 files scanned.
- [-] The CLI verb census is published with per-verb counts from real
      invocation data over the committed ≥ 4-week window, every unobserved
      verb reported as `no-data` rather than as a sunset candidate, and the
      registry budget is a downward ratchet.
      **→** NOT met — abandoned: the window's own end-rule predicts inconclusive (artefact § 4b).
- [-] The chain-length cap is red on a fixture adding an unpaired concern to
      a capped slot, per host.
      **→** NOT met — abandoned: the baseline decays faster than the cap can be authored (artefact § 4).
- [-] The `maintained:` marker is populated per pack with the moves listed
      in release notes.
      **→** NOT met — abandoned unstarted with 5.1.
- [x] The count of new lints introduced equals the four enumerated in 6.7 —
      no more — and each names the manual review it replaces.
      **→** **satisfied as a ceiling** — zero introduced, so "no more" holds. Not satisfied as an equality: none of the four was built.
- [x] No file owned by `road-to-surface-consolidation.md`,
      `road-to-tier-removal.md`,
      `later/road-to-token-economy-dispatch-followup.md` or
      `road-to-skill-description-measurement.md` was edited by this roadmap.
      **→** **satisfied** — verified by the branch diff. The only files this branch changes are this roadmap, the drain readings artefact, the stubs README row, the estate budget and the regenerated dashboard.

## Provenance

<!-- Source-derived per templates/roadmaps.md rule 19. -->

- Source: maintainer analysis thread, 2026-08-10 (external LLM ideation),
  consumed inbox `agents/tmp.old/median-tokenusage.txt`; anonymized per
  [`source-confidentiality`](../../../src/rules/source-confidentiality.md).
  Link via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:Lbi3WHnpd3ev5lRuiUUn+k5gOvOKcewkScdjaTgsn73kA1j8QvnyXDJH2Is2M7smNnrhHAAAYHy+FO3kpJcOaQ==
- Gap-table: see
  [`road-to-cost-parity-0-program.md`](../archive/road-to-cost-parity-0-program.md)
  § Context — this file is the `KEEP` column of the estate draft, whose other
  phases verified as already-built (matrix generation, pack split),
  already-owned (commands, `tier:`, rule deletion, description sharpening,
  adherence bench) or lock-conflicted (negation rewriting, kernel writes).
- Council: **anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-08-10, 2 rounds**
  (`--prompt-mode pr`). Convergence is inlined once, in
  [`road-to-cost-parity-0-program.md`](../archive/road-to-cost-parity-0-program.md)
  § Provenance, rather than restated per sibling. What it changed here is marked
  in the phases above; what it recorded and did **not** apply is the
  family-scope question (open parts 0 and 3 now, defer 1 and 2), which is the
  maintainer's decision.
