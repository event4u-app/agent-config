---
status: later
complexity: lightweight
---

# Road to opt portfolio consolidation — merge, revive, park, and dedupe the roadmap estate

> **Parked in `later/` by maintainer decision (2026-07-12).**
> Blocked until: the pre-existing active roadmap portfolio (the
> roadmaps that were active before the 2026-07-11 `road-to-opt-*`
> cluster landed) is worked down, OR the maintainer explicitly and
> exclusively requests execution of this roadmap. Do NOT pick this
> file up as part of another task or an autonomous sweep.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). The portfolio is
> disciplined, not sprawling — but ADR-117 orphaned two active roadmaps'
> framing, one parked roadmap's revival trigger has plausibly fired, one
> skipped roadmap is obsolete rather than blocked, and two scopes are
> tracked twice.

## Goal

One consolidation pass over `agents/roadmaps/` so every file's disposition,
framing, and scope match the post-ADR-117 / post-py2ts package state — no
duplicate scopes, no stale premises, no parked file whose trigger already
fired.

## Prerequisites

- Sweep evidence (2026-07-11): per-roadmap verdicts verified against repo
  state (ADR-117 in template line 555; `agents/runtime/state/audit/2026-07.jsonl`
  exists but empty; `agents/recruit-sessions/` templates-only).
- PR #885 (golden-set consumer corpus, council-labelled) was OPEN at sweep
  time — re-verify live state before touching anything it owns.

## Phase 1 — merge the two ADR-117-orphaned roadmaps

`road-to-orchestration-scope-decision.md` (7 open / 6 done) and
`road-to-subagent-value-realization-followup.md` (6 open / 3 done) are one
parent/child telemetry-then-decide track, both still written against the
pre-flip `ask` default.

- [ ] Merge into a single `road-to-subagent-telemetry-decision.md`: absorb
      ADR-117 into the Context (the flip already happened on
      bounded-downside grounds), carry over all open steps verbatim, and
      narrow the decision scope to prove-or-drop-the-public-claim once the
      ≥20-real-orchestration-lines telemetry gate fills (it now fills
      passively with subagents on).
- [ ] Preserve both source files' done-history: archive the two originals
      (`git mv` → `archive/`) with a one-line successor pointer each, per
      the roadmap-lifecycle rules.
- [ ] Regenerate the dashboard in the same change.

**Exit criteria:** one merged roadmap active; both predecessors archived
with successor pointers; dashboard reflects the merge.

## Phase 2 — revive `later/road-to-tier-removal.md`

The most plausibly-fired parked trigger: the manifest-v2 deprecation signal
shipped (Phase 1 done), the soak clock started at publish, and reviving it
breaks the circular dependency with `later/road-to-contract-integrity.md`
(whose Phase 2 waits on tier-removal's pruning).

- [ ] Verify the soak evidence (released manifest carries the deprecation
      block; no breakage reports), then move the file back to
      `agents/roadmaps/` and drop its `status: later`.
- [ ] Record inside `later/road-to-contract-integrity.md` that its blocking
      dependency is active again (resume-condition note update only; it
      stays parked until tier-removal's pruning actually lands).

**Exit criteria:** tier-removal active with soak evidence cited;
contract-integrity's resume note updated.

## Phase 3 — dispositions that no longer match reality

- [ ] `road-to-install-path-convergence-followup.md` (1 open step, a
      maintainer delist-checkpoint gated on a ~4-week monitoring window):
      move to `later/` with `status: later` + the monitoring-window resume
      trigger — it is parked-shaped, not workable-now.
- [ ] `skipped/multi-package-architecture.md`: add an explicit supersede
      note — its value propositions (minimal install, per-user surface) are
      delivered by `discipline_profile`, workspace/pack scoping, and
      request-scoped rule projection; point to
      `domain-pack-extraction-when-triggered.md` as the live successor for
      the residual pack-extraction idea. The file stays in `skipped/`.
- [ ] `road-to-flow-learnings.md` (18/19 done): confirm the single
      remaining step (`org-fleet-run`, maintainer-owned) still stands;
      annotate it as the sole blocker so the near-archive state is visible.
- [ ] `later/road-to-discipline-profile-tiering-followup.md`: the council
      branch resolved 2026-07-10 (keep `full` experimental, opt-in); only
      the OSS-host graduation sweep remains, blocked on an absent adapter.
      Tighten its resume condition to exactly that adapter existing.

**Exit criteria:** every touched file's disposition folder, status
frontmatter, and resume condition agree; dashboard regenerated.

## Phase 4 — dedupe double-tracked scopes

- [ ] Connectors: `stubs/road-to-internal-connectors` vs
      `road-to-product-bets.md` Phase 3 track the same Jira/Confluence/
      GitHub/Drive surface. Keep ONE owner (recommendation: product-bets
      Phase 3, since it carries the demand gate) and reduce the stub to a
      pointer or delete it.
- [ ] Note the clean forward dependency for
      `stubs/road-to-council-visibility` on the merged Phase-1 roadmap
      (it is gated on the orchestration prove-or-drop decision) so the
      stub names its trigger file correctly after the merge.

**Exit criteria:** one owner per scope; no stub duplicates an active
roadmap's phase.

## Acceptance criteria

- Zero active roadmaps premised on `subagents.auto: ask`.
- `later/` contains only files whose resume conditions have NOT fired;
  everything with a fired trigger is active.
- Dashboard (`./agent-config roadmap:progress`) regenerated after every
  file-shape change, same change-set.
- No history lost: merges archive their sources with successor pointers,
  never delete them.

## Further candidates (not scheduled — carried from the sweep)

- `road-to-ci-native-release-first-run.md` Phase 1 is mechanically
  executable now (dry-run verification) — execution belongs to that
  roadmap, noted here for visibility.
- The `real-external-participant` gate blocks five surfaces (adoption,
  external-proof, mission-catalogue, bus-factor Phase 4, product-bets);
  it is a human-recruiting bottleneck no roadmap edit can fix.