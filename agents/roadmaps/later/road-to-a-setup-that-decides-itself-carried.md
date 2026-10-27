---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-setup-that-decides-itself
entry_condition:
  what: row claude of src/config/host-injection-effect.json reads observed-true (blocker phase5-run-waits-on-an-observed-effect-row)
  when: after road-to-delivery-on-hook-hosts records an observed effect verdict for the first host; the row reads unobserved today
  who: road-to-delivery-on-hook-hosts produces the observation; then an implementer runs 5.2 as the frozen pre-registration fixes it, and 5.3 on its result
review_by: 2027-01-25
estate_growth_exempt: >-
  Parked carry of road-to-a-setup-that-decides-itself, archived in the same
  change by orchestrator decision D-carry (D16 in the parent, 2026-10-27):
  steps 5.2 and 5.3 and AC-3 wait on an observed effect row that another
  roadmap produces, which no run of this file can. The active count drops by
  one while the later count rises by one; the open blocker moved with the
  steps and was closed in the parent, so open_blockers is unchanged.
---
# Road to a setup that decides itself — carried

> **Source:** carried by the archival sweep on 2026-10-27 from
> [`road-to-a-setup-that-decides-itself`](../archive/road-to-a-setup-that-decides-itself.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-setup-that-decides-itself deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Context carried with the steps

- **D16** (2026-10-27, orchestrator decision D-carry): 5.2, 5.3 and AC-3 are
  carried here with `phase5-run-waits-on-an-observed-effect-row`. Row `claude`
  of `src/config/host-injection-effect.json` read `"state": "unobserved"`, so
  no machine can return `thinned`. The parent's AC-4 was met on the archiving
  branch (`check_host_tree_parity` exit 0); re-run it at 5.2 and at 5.3.

The parent's full Decisions table (D1-D16) and the frozen pre-registration
(`agents/evidence/analysis/setup-phase5-preregistration.md`) stay where they are.

## Phase 1 — Deferred steps carried from road-to-a-setup-that-decides-itself

- [ ] **5.2 Run under the existing spend and independence rules.** <!-- blocked-by: phase5-run-waits-on-an-observed-effect-row -->
  verify: the result carries the claims gate's honesty label.
  Open 2026-10-25, held by blocker `phase5-run-waits-on-an-observed-effect-row`: the frozen pre-registration states the run cannot start until the first host's row in `src/config/host-injection-effect.json` reads `observed-true`, and row `claude` still reads `unobserved`. No machine can produce a `thinned` decision, so the computed arm cannot be built; a run now would report every host as "no computed arm", which is a non-result, not a non-inferior one.
- [ ] **5.3 Enable on the record.** 3.3's promotion is enabled for consumers only <!-- blocked-by: phase5-run-waits-on-an-observed-effect-row -->
  on a non-inferior 5.2; otherwise every machine stays full. Phase 4 ships either
  way: full is today's behaviour, now without its keys.
  verify: the enabling commit cites 5.2's result file.
  Open 2026-10-25, held by the same blocker through 5.2: nothing to enable on until 5.2 has a result file. Every machine stays full meanwhile, which is the state Phase 4 shipped.

## Blockers

### blocker: phase5-run-waits-on-an-observed-effect-row

<!-- asked: 2026-10-25 | record: agents/evidence/analysis/setup-phase5-preregistration.md -->

- **Status:** open — raised 2026-10-25 by the process-full run that closed 4.10; it records a stop that already existed in the frozen pre-registration, so the next run does not re-derive it.
- **Class:** 1 — no decision is owed; the condition is an observation another file produces.
- **Owner:** `road-to-delivery-on-hook-hosts` (parked in `agents/roadmaps/later/`, `review_by: 2026-12-08`), which owns the effect verdicts.
- **Run:** `grep -A1 '"claude"' src/config/host-injection-effect.json` — the blocker clears when `state` reads `observed-true`.
- **Blocks:** steps 5.2 and 5.3, and through them AC-3. Nothing else in this file.
- **What to do:** nothing in this file until the effect row moves. Check it with `grep -A1 '"claude"' src/config/host-injection-effect.json`; when `state` reads `observed-true`, (1) confirm `./scripts-run src/scripts/arrival_report` shows a session on the current host version, (2) run 5.2 exactly as `agents/evidence/analysis/setup-phase5-preregistration.md` freezes it (hash in step 5.1), (3) then 5.3 on its result.
- **Resolved when:** row `claude` of `src/config/host-injection-effect.json` reads `observed-true` and `agent-config doctor --check layer-form` prints a decision other than `delivery-unobserved` for that host.
- **Recommendation:** leave it. The council found the measurement confounded in this environment (`road-to-delivery-on-hook-hosts`, 2026-09-11); forcing an `observed-true` would void the pre-registration's premise.
- **If you do nothing:** every machine stays on the full layer, which is today's behaviour and a valid end state (the parent's Goal, last sentence); 5.2, 5.3 and AC-3 stay open naming this entry.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-setup-that-decides-itself |

## Acceptance Criteria

- [ ] AC-3 — 5.2 reads non-inferior under D2, or consumers stay full and the <!-- blocked-by: phase5-run-waits-on-an-observed-effect-row -->
  record says why.
