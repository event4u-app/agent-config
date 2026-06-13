---
complexity: structural
status: ready
parent_roadmap: metadata-and-command-surface-leanness
---

# Roadmap: Command `tier:` Alias Removal

> **Blocked** until the re-open mechanism in Phase 1 exists. Spawned from
> `road-to-metadata-and-command-surface-leanness` (Phase 3) per the
> 2026-06-13 AI-council decision recorded in
> [`ADR-092`](../../docs/decisions/ADR-092-defer-command-tier-alias-removal.md):
> dropping the command `tier:` alias is **deferred** because the published
> discovery manifest dual-emits the integer `tier` and external npm consumers
> are unknown. This roadmap institutionalises the trigger so the defer stays
> visible in planning rather than becoming folklore — it does not execute
> until Phase 1 clears the unknown-consumer hard stop.

## Goal

Drop the command `tier:` back-compat alias (ADR-090 "Option B" / ADR-092
deferred), leaving `visibility:` as the sole command classifier — but only
after the published-manifest unknown-consumer risk is evidenced away.

## Re-open trigger (Phase 1 must clear one)

- **Versioned manifest** — `discovery-manifest` v2 without `tier` ships
  alongside v1; v1 header carries `deprecated: true` + a maintainer-set
  sunset; soak window passes with no breakage reported.
- **Zero-external-read evidence** — manifest-fetch telemetry (or an explicit
  "tier key deprecated" notice + soak) shows no external integer-`tier`
  reads.

Re-evaluate at the next minor-release planning (maintainer-set review
window), escalating with pre-committed options: build the v2 mechanism ·
proceed with removal · keep deferred.

## Phase 1 — Evidence mechanism build-out [blocked-gate]

- [ ] Pick the mechanism (versioned manifest v2 **or** fetch telemetry).
- [ ] Implement it; ship the deprecation signal on the integer `tier` key.
- [ ] Run the soak window; confirm no external breakage / zero reads.

## Phase 2 — Internal dependency audit (just-in-time)

- [ ] Re-grep integer-`tier` readers immediately before removal (audit is
      stale if run during the defer): `commands.ts`, `audit_command_surface.py`,
      `build_discovery_manifest.py`, plus any added since. Classify each as
      Runtime Risk (branches/registers on the integer) vs Discovery Risk
      (display/fallback only).

## Phase 3 — External soak confirmation

- [ ] Confirm the Phase-1 deprecation signal has soaked; record the
      zero-consumer evidence that closes the unknown-consumer hard stop.

## Phase 4 — Removal execution (blocked on Phases 1–3)

- [ ] Scripted backfill: drop `tier:` from the command sources, remove the
      `tier` property + the tier↔visibility consistency clause from
      `command.schema.json` / `lint_command_tiers.py`, drop the `tier`-fallback
      branches in the three readers, stop dual-emitting `tier` in the manifest.
      One reviewable diff; `lint_command_tiers.py` then enforces `visibility`
      alone.
- [ ] Reversibility note: restoring `tier` is a manifest schema patch
      (< 1h to publish) if a regression surfaces post-removal.

## Acceptance criteria

- The unknown-external-consumer hard stop is cleared by Phase-1 evidence
  before any removal lands.
- Command frontmatter + schema carry `visibility:` only; no tier↔visibility
  consistency check remains; the manifest no longer dual-emits `tier`.
- A superseding ADR records the proceed decision (ADR-092 → superseded).
