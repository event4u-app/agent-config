---
complexity: lightweight
---

# Road to opt portfolio consolidation — merge, revive, park, and dedupe the roadmap estate

> **Un-parked 2026-07-12:** the `later/` resume trigger fired — the
> maintainer explicitly and exclusively requested this roadmap's
> execution (`/roadmap:process-full`). The other eight `road-to-opt-*`
> roadmaps remain parked.

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

- [-] Merge into a single `road-to-subagent-telemetry-decision.md`: absorb
      ADR-117 into the Context (the flip already happened on
      bounded-downside grounds), carry over all open steps verbatim, and
      narrow the decision scope to prove-or-drop-the-public-claim once the
      ≥20-real-orchestration-lines telemetry gate fills (it now fills
      passively with subagents on).
      <!-- cancelled 2026-07-12: the merge contradicts a recorded council
      lock — road-to-orchestration-scope-decision.md header, council
      claude-sonnet-4-5 + gpt-4o 2026-07-08, "Standalone by council
      decision … merging would bury the prove-or-drop decision". The
      mechanism-match check (decision-revisit-gate §1) holds: the lock is
      about the adoption-claim vs internal-telemetry SEPARATION, which
      ADR-117 (a default change) does not touch — the lock applies, no new
      evidence. The step's real substance — absorb ADR-117 into both
      roadmaps' prose — WAS executed instead: both files reconciled
      (default described as `on` since ADR-117, Phase-3/Phase-2 verdict
      paths rewritten as confirm-or-demote via the retained demotion
      gate). The 2026-07-11 sweep missed the lock because the two files
      were judged on staleness signals without reading the header. -->
- [-] Preserve both source files' done-history: archive the two originals
      (`git mv` → `archive/`) with a one-line successor pointer each, per
      the roadmap-lifecycle rules.
      <!-- cancelled 2026-07-12: consequence of the cancelled merge above —
      both roadmaps stay active and separate per the council lock. -->
- [x] Regenerate the dashboard in the same change.
      <!-- done 2026-07-12: regen after the reconciliation edits. -->

**Exit criteria (as executed):** merge cancelled per council lock; both
roadmaps reconciled with ADR-117 and still standalone; dashboard current.

## Phase 2 — revive `later/road-to-tier-removal.md`

The most plausibly-fired parked trigger: the manifest-v2 deprecation signal
shipped (Phase 1 done), the soak clock started at publish, and reviving it
breaks the circular dependency with `later/road-to-contract-integrity.md`
(whose Phase 2 waits on tier-removal's pruning).

- [x] Verify the soak evidence (released manifest carries the deprecation
      block; no breakage reports), then move the file back to
      `agents/roadmaps/` and drop its `status: later`.
      <!-- done 2026-07-12: verified LIVE against the released artifact —
      npm 8.10.0 (published 2026-07-10) ships
      dist/discovery/discovery-manifest.json with deprecations[0] =
      {key: tier, replacement: visibility, since: ADR-092, sunset: null};
      gh issue list --search tier = zero breakage reports. Roadmap
      un-parked with the evidence cited in its banner. -->
- [x] Record inside `later/road-to-contract-integrity.md` that its blocking
      dependency is active again (resume-condition note update only; it
      stays parked until tier-removal's pruning actually lands).
      <!-- done 2026-07-12: dependency-status paragraph appended to its
      parked banner; resume condition itself unchanged. -->

**Exit criteria:** tier-removal active with soak evidence cited;
contract-integrity's resume note updated.

## Phase 3 — dispositions that no longer match reality

- [x] `road-to-install-path-convergence-followup.md` (1 open step, a
      maintainer delist-checkpoint gated on a ~4-week monitoring window):
      move to `later/` with `status: later` + the monitoring-window resume
      trigger — it is parked-shaped, not workable-now.
      <!-- done 2026-07-12: status: later + resume paragraph added, git mv
      to later/; later-disposition lint green. -->
- [x] `skipped/multi-package-architecture.md`: add an explicit supersede
      note — its value propositions (minimal install, per-user surface) are
      delivered by `discipline_profile`, workspace/pack scoping, and
      request-scoped rule projection; point to
      `domain-pack-extraction-when-triggered.md` as the live successor for
      the residual pack-extraction idea. The file stays in `skipped/`.
      <!-- done 2026-07-12: supersede blockquote added under the H1. -->
- [x] `road-to-flow-learnings.md` (18/19 done): confirm the single
      remaining step (`org-fleet-run`, maintainer-owned) still stands;
      annotate it as the sole blocker so the near-archive state is visible.
      <!-- done 2026-07-12: confirmed 1 open step (grep: exactly one
      `- [ ]`, line 179, blocked-by org-fleet-run); near-archive banner
      added under the H1. -->
- [x] `later/road-to-discipline-profile-tiering-followup.md`: the council
      branch resolved 2026-07-10 (keep `full` experimental, opt-in); only
      the OSS-host graduation sweep remains, blocked on an absent adapter.
      Tighten its resume condition to exactly that adapter existing.
      <!-- done 2026-07-12, no change needed: verified the file already
      carries exactly this resume condition ("Resume when: an
      open-source-host adapter exists AND the maintainer wants the
      graduation answer (or the recorded revisit-if drop-condition
      fires)"), tightened on 2026-07-10 when the council branch fired. -->

**Exit criteria:** every touched file's disposition folder, status
frontmatter, and resume condition agree; dashboard regenerated.

## Phase 4 — dedupe double-tracked scopes

- [x] Connectors: `stubs/road-to-internal-connectors` vs
      `road-to-product-bets.md` Phase 3 track the same Jira/Confluence/
      GitHub/Drive surface. Keep ONE owner (recommendation: product-bets
      Phase 3, since it carries the demand gate) and reduce the stub to a
      pointer or delete it.
      <!-- done 2026-07-12: product-bets Phase 3 recorded as the single
      tracking owner; stub reduced to a pointer that keeps only its
      workspace-OAuth-specific promotion gates (org customer per
      connector, SSO-first, funded audit) — those are additive criteria,
      not duplicate tracking. -->
- [x] Note the clean forward dependency for
      `stubs/road-to-council-visibility` on the merged Phase-1 roadmap
      (it is gated on the orchestration prove-or-drop decision) so the
      stub names its trigger file correctly after the merge.
      <!-- done 2026-07-12, no change needed: the Phase-1 merge was
      cancelled (council lock — the two roadmaps stay standalone), and the
      stub already names the correct trigger file
      (road-to-orchestration-scope-decision.md, intro + promotion gate 1).
      Verified both references. -->

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