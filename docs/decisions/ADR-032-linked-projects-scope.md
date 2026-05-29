---
adr: 032
status: accepted
date: 2026-05-29
decision: linked-projects-scope-go-option-a
supersedes: —
superseded_by: —
phase: v3.x · multi-project-scope evaluation
type: structural
review_date: 2027-05-29
---

# ADR-032 — Linked-projects scope: GO on opt-in auto-detection (Option A, passive awareness)

## Status

**Accepted** · 2026-05-29. Approves an opt-in auto-detection feature for
IDE-attached sibling repositories, scoped to **passive awareness** (Option A).
A same-day earlier draft recorded NO-GO; that verdict was reversed after the
proactivity-gap argument (below). Time-boxed: review on **2027-05-29** or
earlier if a kill-switch trigger fires.

Not to be confused with [`ADR-029`](ADR-029-multi-workspace-deferred.md): that
defers a restructure of the **package's own root layout**. This ADR is about
the **agent's working scope over a sibling project repository**.

## Context

Developers routinely check out sibling repos that change together (e.g.
`galawork-api` + `galawork-web`) and attach them in the IDE. Detection is
deterministic from on-disk config (`.idea/modules.xml` + `vcs.xml`,
`*.code-workspace`).

A Phase-0 spike found Claude Code can already read/write a sibling outside its
working directory **unconditionally** — no rule needed. An initial reading
concluded the feature was therefore only an "awareness signal" a doc could
deliver, and drafted NO-GO.

## The reversal — proactivity gap

That NO-GO mis-framed the value. The point is **not** capability (the agent can
write everywhere); it is **proactivity**: the agent does **not** consider a
sibling unless explicitly told, so cross-repo dependencies — an API change that
breaks the frontend, a shared type that drifts — are missed by default. A
manual doc/snippet presupposes the very awareness the target user lacks: the
developer who needs this most is exactly the one who won't think to write the
note. **Auto-detection is zero-knowledge** — it reads the relationship the
developer already encoded by attaching the repo in their IDE.

AI Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 3 rounds + Karpathy
peer-review, 2026-05-29) flipped to **GO** on this reasoning.

## Decision — GO, scoped to Option A (passive awareness)

Build an **opt-in** auto-detection feature:

1. **Detect** IDE-attached siblings from on-disk config (config-driven only;
   never arbitrary adjacent directories).
2. **Opt-in once** per sibling; persist the choice **local-only** in
   `.agent-settings.local.yml` (gitignored, per-machine — sibling paths differ
   per developer and must never be committed).
3. **Behavioral directive** for in-scope siblings: proactively check cross-repo
   impact on relevant changes (API contract, shared types) and **warn**.
   **Do NOT bulk-include** the sibling's files (interpretation C — token
   blowup — stays **out of scope**). Out-of-root writes still pass the host
   agent's own permission gate.

### A/B/C scoping

- **A — passive awareness (CHOSEN):** know + warn, no bulk inclusion. Cheap, low risk.
- **B — proactive dependency scanning:** auto-scan on every change. Deferred (needs heuristics).
- **C — implicit inclusion of all sibling files:** **rejected** — token blowup, context pollution.

### Fork resolutions

- **Fork A** — `.agent-settings.local.yml`, deepest cascade layer reusing `_deep_merge` (not a bespoke override).
- **Fork B** — key `linked_projects` (avoids ADR-007 "scope"/"workspace", ADR-029 "multi-workspace").
- **Fork C** — cross-cwd writes documented, never auto-configured; host permission gate applies.

## Consequences

- New: detector (`scripts/_lib/linked_projects.py`), the
  `.agent-settings.local.yml` cascade layer, a committed-local lint, and the
  `linked-projects-onboarding-gate` rule (tier-2b, **experimental**, **removable**).
- The intra-repo module system (`enumerate_modules()`) is untouched.
- Size never excludes a sibling — a real frontend (galawork-web ≈ 38k files)
  must surface; it is flagged `large` (awareness only). The council's literal
  "skip >20k files" guardrail was corrected: it conflated Option C's
  file-inclusion cost with Option A, under which repo size is cost-irrelevant.
- Per install decision **D2**, the installer does not touch the consumer
  `.gitignore`; consumers gitignore `.agent-settings.local.yml` themselves
  (documented in the guide).

## Kill-switch

Experimental + removable by construction. If opt-in is consistently declined or
siblings are never cited in practice, remove the rule. Signal stays local — no
telemetry.

## Open follow-ups

- **Consumer detector reachability:** the detector lives in `scripts/_lib/`;
  exposing it as an `agent-config` CLI subcommand for consumer installs is a
  follow-up. Import-reachable in this repo / co-located maintainer setups today.
- **Multi-agent verification:** only Claude Code was empirically validated.
  Cursor / Augment / Copilot are unverified — the guide's manual snippet covers
  them until an interactive per-IDE test is run.

## Alternatives considered

- **NO-GO + docs only** — rejected: a manual note fails the target user who lacks the awareness to write it.
- **Build Option C** — rejected: token blowup.

## References

- [`docs/guides/cross-repo-linked-projects.md`](../guides/cross-repo-linked-projects.md)
- [`ADR-007`](ADR-007-agent-discovery-scopes.md) — owns "scope"/"workspace".
- [`ADR-029`](ADR-029-multi-workspace-deferred.md) — unrelated package-root multi-workspace defer.
