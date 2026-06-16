---
complexity: lightweight
status: ready
---

# Roadmap: Competitive-harvest orchestration — execution order for the harvest set

**Trigger:** The Source-E competitive-harvest produced four sibling roadmaps
([`road-to-security-hardening`](road-to-security-hardening.md),
[`road-to-mission-mode`](road-to-mission-mode.md),
[`road-to-autonomous-verify-loop`](road-to-autonomous-verify-loop.md),
[`road-to-harvest-small-enhancements`](road-to-harvest-small-enhancements.md))
with hard dependencies and a conditional branch between them. This roadmap is the
**coordination layer**: it defines the optimal order to work them for a single
maintainer, with the two decision gates that branch the path.

## Goal

Sequence the four harvest roadmaps (and their phases) so that every hard
dependency is satisfied before its dependent starts, the conditional verify-loop
work is only done if its gate fires, and a single maintainer never runs two
heavy roadmaps in parallel. Each referenced roadmap stays the source of truth
for its own phase checkboxes; this file tracks only **cross-roadmap readiness**
and the gate decisions.

## Dependency graph

```
security-hardening ──(hard dep: trust boundaries)──▶ mission-mode
mission-mode Phase 0 (no-runtime-boundary doc) ─────▶ verify-loop (needs the boundary def)
mission-mode Phase 1 PoC ──(GATE G1)──▶ decides mission-mode Phase 2 shape
                                    └─▶ decides whether verify-loop is needed at all
harvest-small Phase 6 (agent-memory README removal) ── independent, no deps
harvest-small Phases 1–5 ── after security + mission-mode (capped, last)
```

Rationale (council, 2026-06-15): you cannot define a mission's trust boundaries
without the threat model + git-discipline enforcement, so **security ships
first**. The verify-loop is only needed if the mission PoC chooses
gated-autonomous execution with auto-repair — so it sits behind a gate, not in
the critical path. The small enhancements expand to fill available time
(Parkinson) if started early, so they go **last** with capped milestones.

---

## Phase 1 — Foundation (policy + boundary + independent quick win)

Serial security work + the prerequisite boundary artifact. The agent-memory
removal is the one sanctioned parallel item (no dependencies, user-flagged).

- [x] `road-to-security-hardening` Phase 1 — threat-model + `SECURITY.md` (the
      policy layer every mission trust boundary depends on). <!-- road-to-security-hardening archived (14/14 done); SECURITY.md + docs/threat-model.md present -->
- [x] `road-to-security-hardening` Phase 2 — workflow-security CI linter. <!-- archived -->
- [x] `road-to-security-hardening` Phase 3 — `block-no-verify` git-discipline hook. <!-- src/scripts/hooks/block_no_verify.py present -->
- [x] `road-to-mission-mode` Phase 0 — `no-runtime-boundary` contract +
      mission-manifest stub + trusted-mission/user-recipe ADR. May start once the
      threat-model exists (it informs the boundary); blocks both mission-mode
      Phase 1 and the verify-loop PoC. <!-- docs/contracts/no-runtime-boundary.md + mission.schema.json + ADR-097 present; mission-mode archived (17/17) -->
- [x] `road-to-harvest-small-enhancements` Phase 6 — agent-memory README removal.
      **Independent** — may be done any time in this stage as a quick win; does
      not block anything. <!-- harvest-small archived; README block removed, refs green -->

## Phase 2 — Mission validation gate (G1)

- [x] `road-to-mission-mode` Phase 1 — the ~2-day validation PoC
      (Laravel 10→11 on `/work`, git-as-rollback). <!-- gate doc: agents/evidence/analysis/mission-mode-phase1-gate.md -->
- [x] **GATE G1 — record the decision** (in the mission-mode Phase 1 decision
      doc): (a) can a mission be expressed with ≤ ~200 LoC calling only existing
      skills + `/work`? (b) do missions need control-flow beyond a linear gated
      sequence? **G1 outcome routes Phase 3:**
      - *plan-first / linear sufficient* → mission-mode Phase 2 ships minimal;
        **verify-loop stays deferred** (skip its Phase 3 entry below).
      - *gated-autonomous / control-flow needed* → mission-mode Phase 2 + the
        verify-loop PoC both become required.
      <!-- G1 VERDICT (2026-06-15, council): APPROVE / linear sufficient — missions are thin recipes on /work, control-flow DSL deferred. Per this branch the verify-loop was NOT gate-mandated; it was nonetheless built + archived independently (see Phase 3/4 notes). -->

## Phase 3 — Flagship mission (+ conditional verify-loop)

Gated on G1. Ship the one proven mission before any expansion.

- [x] `road-to-mission-mode` Phase 2 — flagship `/mission:upgrade` (single-step,
      breaking-change catalog YAML, size-tier surfaced, provisional-branch,
      gated, never auto-PR). <!-- shipped: src/domains/engineering-base/mission/upgrade/ (command + manifest + 5-entry proof catalog); 2A infra. Full catalog (2B) deferred to road-to-mission-catalogue -->
- [x] *(only if G1 = gated-autonomous)* `road-to-autonomous-verify-loop` Phase 1
      — runtime-free PoC → **GATE G2**: is the judge→revise→re-judge loop
      expressible with no daemon / no cross-session state? If no → stop + rescope;
      if yes → its Phase 2 is unblocked in Phase 4. <!-- G1 was linear (not gate-mandated), but verify-loop was built independently: road-to-autonomous-verify-loop archived (9/9). G2 PASSED (runtime-free judge loop). -->.

## Phase 4 — Expansion + enhancements (last)

Only after the flagship is proven. Single-maintainer: serial, capped, no parallel
heavy work.

- [~] `road-to-mission-mode` Phase 3 — mission catalogue (phpstan-raise,
      n-plus-one-audit, pest-migrate, fat-controller-cleanup, dead-code-removal).
      <!-- deferred: carved out of mission-mode (per G1: "ship ONE mission's infra, validate, then the catalogue") into road-to-mission-catalogue.md (status: ready, trigger-gated on a live Laravel repo validating the 2A infra). Owned + tracked there; not executed in this orchestration window. -->
- [x] *(only if G2 passed)* `road-to-autonomous-verify-loop` Phase 2 — productize
      the `verify-repair-loop` skill (opt-in, never auto-on). <!-- src/skills/verify-repair-loop/SKILL.md shipped; one live-app item spun to road-to-live-app-verdict (draft, trigger-gated) -->
- [x] `road-to-harvest-small-enhancements` Phases 1–5 — file-first pattern library
      + project-analysis freshness + MCP-token accounting (folds into
      [`road-to-capability-discoverability`](road-to-capability-discoverability.md)'s
      `context-load-budget` item) + systematic-debugging failure table +
      cross-project surfacing + bench head-to-head/pass^k + launch-readiness
      canary fragments. Each its own capped milestone; do NOT batch.

---

## Cross-cutting constraints

- **Single maintainer → serialize.** The only sanctioned parallelism is the
  Phase 1 agent-memory quick win. Never run two heavy roadmap phases at once.
- **Boundary-first.** `no-runtime-boundary` (mission-mode Phase 0) must exist
  before any mission Phase 1 or verify-loop work — it is the definition every
  REJECT/ADOPT call references.
- **Source of truth split.** Each referenced roadmap owns its own phase
  checkboxes; flipping a box here means "that roadmap's phase is complete and the
  next cross-roadmap dependency is unblocked", not a duplicate of its internal
  steps.
- **No date/version pins** (scope-control) — stages gate on completion +
  decisions, never on a calendar.

## Anti-patterns

- Starting `road-to-mission-mode` before `road-to-security-hardening` completes
  (undefined trust boundaries — the council's #1 risk).
- Building `road-to-autonomous-verify-loop` before GATE G1 decides it is needed
  (it is conditional, not critical-path).
- Pulling `road-to-harvest-small-enhancements` Phases 1–5 forward "while waiting"
  — they metastasize and starve the flagship (council scope-creep warning).
- Treating this file as the work surface — the work happens in the four sibling
  roadmaps; this only coordinates order + gates.

## Acceptance criteria

- [x] Phase 1 complete: security-hardening done + `no-runtime-boundary` landed +
      agent-memory removed from README.
- [x] GATE G1 decision recorded in the mission-mode Phase 1 decision doc; the
      verify-loop branch is explicitly taken or skipped. <!-- G1 = linear/APPROVE; verify-loop nonetheless built independently -->
- [x] Flagship `/mission:upgrade` shipped before any Phase 4 expansion.
- [x] GATE G2 recorded (if reached); verify-loop Phase 2 only after a green G2.
- [x] Harvest-small Phases 1–5 land last, each as a discrete capped milestone.
      <!-- harvest-small archived (Phases 1–5 done; 2 items [-] re-homed to children: bench→road-to-bench-headtohead-metrics, MCP-token-accounting→capability-discoverability) -->

## Provenance

- Coordinates the four sibling roadmaps produced by the Source-E
  competitive-harvest (code-audit + two live council rounds, 2026-06-15;
  see each sibling roadmap's § Provenance for the anonymized source + evidence).
- Sequencing rationale: council convergence (claude-sonnet-4-5 + gpt-4o, deep,
  peer-review) — security first (hard dependency), mission PoC gate, verify-loop
  conditional, enhancements last.
