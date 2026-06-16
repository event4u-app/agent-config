---
complexity: structural
status: later
parent_roadmap: metadata-and-command-surface-leanness
---

# Roadmap: Command `tier:` Alias Removal

> **Parked in `later/` — Phase 1 (evidence mechanism) shipped; remaining work
> is soak-gated.** The re-open mechanism the roadmap was blocked on now exists:
> the discovery manifest is **v2** with a machine-readable `deprecations`
> signal on the integer `tier` key (Option B — chosen by AI council, telemetry
> ruled out as infeasible in a no-runtime package; see § Council notes). `tier`
> is still emitted (non-breaking) — the signal only starts the soak.
>
> **Blocked until:** the manifest-v2 `tier` deprecation signal has soaked (no
> external breakage reported) **and** the maintainer reviews at the next
> minor-release planning window (ADR-092). Until then the just-in-time audit
> (Phase 2), soak confirmation (Phase 3), and removal (Phase 4) cannot proceed
> — all gated on the external soak + a maintainer decision, so the roadmap is
> parked here rather than left in the active tree.
>
> Spawned from `road-to-metadata-and-command-surface-leanness` (Phase 3) per the
> 2026-06-13 AI-council decision recorded in
> [`ADR-092`](../../docs/decisions/ADR-092-defer-command-tier-alias-removal.md):
> dropping the command `tier:` alias is **deferred** because the published
> discovery manifest dual-emits the integer `tier` and external npm consumers
> are unknown. This roadmap institutionalises the trigger so the defer stays
> visible in planning rather than becoming folklore.

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

## Phase 1 — Evidence mechanism build-out

- [x] Pick the mechanism (versioned manifest v2 **or** fetch telemetry).
      <!-- AI council (claude-sonnet-4-5 + gpt-4o, 2-round peer-review design debate, 2026-06-16): fetch-telemetry is infeasible in a no-runtime / file-first package (no server, no fetch endpoint) → versioned-manifest family only. Council split A (dual-publish) vs B (single manifest + deprecations block); host consolidation = Option B — both members debated "soak observability" as if telemetry were possible (it isn't under no-runtime), which collapsed A's main edge for the signal-only Phase-1 scope. B = minimal-safe-diff + non-breaking; the Phase-4 removal is itself the forcing function (cheaply reversible, ADR-092). -->
- [x] Implement it; ship the deprecation signal on the integer `tier` key.
      <!-- manifest version 1→2 + top-level machine-readable `deprecations` block (src/scripts/build_discovery_manifest.py); discovery-manifest.schema.json extended (version const→2, `deprecation` $def, tier desc); 2 new tests in test_build_discovery_manifest.py (v2 + deprecation signal; non-breaking dual-emit of tier+visibility); docs/contracts/command-surface-tiers.md note. tier STILL emitted (non-breaking). lint_discovery_manifest + determinism + lint_command_tiers all green. -->
- [ ] Run the soak window; confirm no external breakage / zero reads.
      <!-- the soak STARTS when the manifest-v2 deprecation signal publishes; external + time-gated → cannot be completed by autonomous authoring. Resume per the top-of-file Blocked-until. -->

## Phase 2 — Internal dependency audit (just-in-time)

- [ ] Re-grep integer-`tier` readers immediately before removal (audit is
      stale if run during the defer): `commands.ts`, `audit_command_surface.py`,
      `build_discovery_manifest.py`, plus any added since. Classify each as
      Runtime Risk (branches/registers on the integer) vs Discovery Risk
      (display/fallback only).
      <!-- PRELIMINARY inventory (2026-06-16, NON-BINDING — must be re-run just-in-time at removal): commands.ts `tierOf`/`visibilityOf`/`explain` = Discovery Risk (visibility-preferred; tier is fallback/alias-label only); audit_command_surface.py `_is_visible` = Discovery Risk (fallback), `_tier_at_ref` reads tier from HISTORICAL git revisions = correct, must NOT change, VISIBLE_TIERS = dead once visibility is always present; build_discovery_manifest.py = the emitter. No internal Runtime Risk reader found; the open risk is unknown EXTERNAL manifest consumers — exactly what the soak addresses. -->


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

## Council notes

Phase-1 mechanism choice — AI council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2-round peer-review design debate, 2026-06-16). The roadmap/ADR-092
offered two re-open mechanisms: a **versioned manifest** or **fetch telemetry**.
Telemetry is **infeasible** in this no-runtime / file-first package (no server,
no fetch endpoint — `audit_command_surface.py` states per-command telemetry is
unavailable), so the viable family is the versioned manifest only. Within that,
the council split between **A** (publish a second `discovery-manifest-v2.json`
without `tier` alongside v1) and **B** (single manifest, bump `version 1→2`, add
a machine-readable top-level `deprecations` block, keep emitting `tier`). Host
consolidation chose **B**: both members argued "soak observability", but a
no-runtime package cannot observe external reads under *either* shape, which
collapses A's main advantage for the **signal-only, non-breaking** Phase-1 scope.
B is the minimal-safe-diff path; the eventual Phase-4 removal is itself the
forcing function (and is cheaply reversible per ADR-092). Shipped under Phase 1.
