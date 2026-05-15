# Evaluation 2.2.2 — Follow-ups (verbatim user brief)

> Captured from the user message that triggered the
> distribution-maturity roadmap (now archived under
> `agents/roadmaps/archive/`). Recorded verbatim, no editorialising.
> This is the source-of-truth for the roadmap's phases.

## Rating table

| Axis | Score |
|---|---|
| Overall | **9.4 / 10** |
| Product strategy | **9.7 / 10** |
| Architecture | **9.2 / 10** |
| Installer / distribution maturity | **9.5 / 10** |
| Operational complexity | **8.2 / 10** |
| UX for new users | **8.6 / 10** |

## Headline

DE (verbatim user brief):

> **2.2.2 ist ein grosser Produkt-Shift.**
> Nicht nur ein Release. Es ist aus einem installierten Paket ein
> `npx`-gesteuertes Agent-Config-System mit global/project scope,
> Version-Pinning, Sync/Validation geworden. Das ist gut — aber ab
> jetzt muessen Distribution, Migration, Auth und Offline/Enterprise
> ernsthaft wie Produktflaechen behandelt werden.

EN (translation, non-authoritative):

> **2.2.2 is a major product shift.**
> Not just a release. What used to be an installed package became an
> `npx`-driven agent-config system with global / project scope,
> version pinning, sync / validation. That is good — but from now on
> distribution, migration, auth, and offline / enterprise must be
> treated as serious product surfaces.

## Five priority follow-ups

The user brief surfaced these as the roadmap drivers (paraphrased
into checklist form for traceability; original framing preserved
above):

1. **MCP contract ↔ README auth-surface drift** — the README
   recommends Bearer Auth while the MCP Cloud contract still marks
   auth as MVP-2 / deferred. Pick one source of truth and align both.
2. **Enterprise / offline story is missing** — the npx-only runtime
   is fragile for locked-down environments. Decide whether a Composer
   fallback (or pinned-npx-via-internal-registry, or offline cache,
   or CI-safe install pattern) is the right minimal fallback. The AI
   Council decides whether Composer specifically still fits the
   current installer shape.
3. **Architecture docs conflate four pipelines** — compression,
   `.augment/` projection, multi-tool stubs, Claude.ai ZIP bundle.
   Split into discrete pages so each pipeline is grep-able and
   testable.
4. **Command surface unbounded** — 106 commands surfaced today.
   Tier (Tier-0 daily-driver, Tier-1 power-user, Tier-2
   maintenance / internal) so new users see only Tier-0 in
   `--help` by default.
5. **MCP Lite vs Full marking + changelog hygiene** — every MCP doc
   should mark `mcp_scope: lite|full|deferred`; the CHANGELOG should
   split into eras so the 2.2.x shift is not buried in pre-2.2.0
   noise.

## What is NOT in scope of this roadmap

- Revisiting the npx-only shift itself (2.2.2 is locked).
- Tag / version-bump policy (release-shape is the user's call).
- New always-active rules (kernel membership unchanged).
- New tier of tooling beyond what 2.2.2 already ships.

## Council mandate (token spend authorised)

The user explicitly authorised council token spend for two passes:

1. **Composer fallback feasibility** — gates Phase 2 Step 5 of the
   roadmap. Question file at
   `agents/council-questions/composer-fallback-feasibility.md`.
2. **Roadmap review** — gates Phase 1 start. Reviews the
   distribution-maturity roadmap itself (under `agents/roadmaps/archive/`).

Per `/council default` Step 3, the cost gate is still surfaced
per-call even with the standing authorisation — the user picks `1`
on the numbered-options block to release spend.
