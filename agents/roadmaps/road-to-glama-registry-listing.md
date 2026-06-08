---
status: ready
complexity: lightweight
---

# Road to a Glama registry listing — the one genuinely-useful Glama move, and nothing more

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-08, design mode,
> 2 rounds + peer-review):** Of four candidate Glama moves, exactly **one**
> survives a "no-bullshit" bar: list the **local stdio** MCP server in the Glama
> registry for discovery (free, no technical lock-in). The other three are
> dropped with reasons (see `## Dropped — do not relitigate`). The single hard
> gate both members raised: a registry listing **implies support and a target
> audience**, so the listing must be honestly scoped before it goes up. Reviews
> are **trigger-based, never calendar-based** (60/90-day windows were called out
> as cargo-cult for an OSS infra repo).

## Goal

Get the stdio MCP server discoverable in the Glama MCP registry as a low-touch,
one-way-door experiment — honestly labelled, cross-listed so Glama is not the
only channel, with explicit kill-switches — without taking on hosting,
CI-coupling, or any third party in the trust path.

## Phase 0 — Audience gate (RESOLVED)

Maintainer decision (2026-06-08): the **listing** targets **agent developers /
contributors** (option 1). End-user turnkey use is real but is a **separate
follow-up roadmap**, not a caveat baked into this listing — keeping the listing
honest and unblocked now.

- [x] Audience decided: agent developers / contributors. The listing is plain
  developers-first; `src/scripts/mcp_server/README.md` + `tests/test_mcp_server.py`
  examples are sufficient documentation for that audience — no retrofitted
  "Getting Started" needed.
- [x] End-user turnkey packaging spun out to its own roadmap (does not gate this
  one). <!-- road-to-mcp-stdio-end-user-packaging.md (status: draft) -->
- [x] Gate cleared → Phase 1 unblocked.

## Phase 1 — List the stdio server (the actual move)

- [x] Submit the **stdio** MCP server to the Glama registry (repo URL +
  description + tags). List the stdio server **only** — never the Cloudflare
  Worker, whose `experimental` / not-README-linked status would make a public
  listing an incoherent support promise. <!-- done: Glama auto-indexed the repo — live at https://glama.ai/mcp/servers/event4u-app/agent-config (no manual form needed); recorded in ADR-067 § Listing URL -->
- [x] Write the listing description with an **honest scope label**: "for agent
  developers / contributors / forks; not a turnkey package." If a hosted preview
  is mentioned at all, frame the experimental Worker as a roadmap-preview, "use
  at your own risk," not as a product. <!-- done: full copy-paste listing description in ADR-067 § Listing description; developer-first scope, explicit "Not a turnkey package" clause, experimental Worker framed as roadmap-preview -->
- [x] Add a single discreet README line/badge pointing at the listing. This badge
  is the only reputational signal and is removable in one commit — it is the
  Phase-3 kill-switch surface. <!-- done: plain link added to README.md MCP section (Glama exposes no embeddable badge for this listing); removable in one commit per ADR-067 § README badge -->
- [x] Capture the listing process in a short ADR (one-time manual web form). Do
  **not** build "auto-sync" or "release-reminder" tooling — the linked repo +
  GitHub releases are the source of truth; if Glama needs manual version bumps,
  that is a kill-switch criterion, not a maintenance project to absorb. <!-- done: ADR-067-glama-registry-listing.md — submission steps, listing description, badge markup, kill-switches, review trigger, discovery channels, Awesome MCP path -->

## Phase 2 — Avoid single-channel lock-in

- [x] Cross-list in at least one other surface (the GitHub `Awesome MCP` list
  and/or relevant GitHub topics) so discovery does not depend on Glama alone.
  Rationale: MCP registries have winner-take-all network-effect dynamics; "no
  lock-in" only holds while the directory space stays fragmented. <!-- done: added GitHub topics `model-context-protocol` + `mcp-server` to event4u-app/agent-config via gh api (additive, preserves all existing topics); surfaces repo at github.com/topics/model-context-protocol. Awesome MCP PR path documented in ADR-067 as optional next step if needed -->

## Phase 3 — Trigger-based review + kill-switches (no calendar)

- [x] Define the review **trigger**, not a date: the first inbound GitHub
  issue/PR/star that references Glama. On that signal, assess whether the user
  hit friction (could they actually run the server?) and fix docs or sharpen the
  audience label accordingly. <!-- done: trigger defined in ADR-067 § Review trigger — first inbound issue/PR/star mentioning Glama; 12-month timeout kill-switch -->
- [x] Record the kill-switches in the ADR from Phase 1:
  (a) Glama makes a registry listing **conditional on using their hosting** →
  delist (we will not migrate infra — see Option D below);
  (b) the registry degrades into a spam farm (low-quality servers dominate
  search) → remove the README badge, let the listing rot harmlessly;
  (c) per-release maintenance for the listing exceeds ~5 min → reconsider.
  A bare listing fee is **not** an auto-delist trigger — weigh the amount. <!-- done: all three kill-switches + fee nuance recorded in ADR-067 § Kill-switches -->

## Phase 4 — Archival (merge-gated)

All substantive work is complete and verified; this item holds the roadmap open
only until its closing PR merges, so the ADR-067 back-link and other inbound
references keep resolving until the move.

- [ ] Archive this roadmap to `agents/roadmaps/archive/` + migrate inbound refs
  (ADR-067 back-link, dashboard) the moment the closing PR merges.
  <!-- merge-gated: pr=403 — archives + ref-migrates on merge; substantive work done + verified (ADR index clean, check_references green) -->

## Dropped — do not relitigate

Recorded so a future session does not re-open settled ground. All three were
DROP across both council members + peer-review.

- **Glama Inspector as a manual pre-release smoke (Option B).** Redundant theatre
  — zero marginal signal over the existing `mcp_parity_smoke.py` + official
  inspector. Adds latency and human error, catches nothing CI does not.
- **Glama Inspector wired into CI (Option C).** Wrong shape: browser/interactive,
  no pass/fail API, needs a public endpoint. The deeper blocker is **auth**, not
  flakiness — the hosted Worker uses bearer-auth + egress allowlist; a Glama
  sandbox would either leak our token to their backend, or test an
  unauthenticated path (security theatre), or depend on undocumented runner IPs.
  Even a future Glama `--headless` mode should not be adopted unless it accepts a
  client-provided `Authorization: Bearer` header against our real endpoint — at
  which point it is merely equivalent to `mcp_parity_smoke.py`, so why switch.
- **Migrate hosting to Glama Gateway (Option D).** Breaks the A0-cloud contract
  on both sides: server-side it drops version-pinned immutable URLs, the prebaked
  `skillSetSignature`, and bearer-token control we own; client-side it removes
  per-version pinning, blue/green parallel testing, URL-level rollback, and the
  content-hash integrity check. A non-starter the moment ≥ 1 external client
  needs stability.

## Out of scope

- Listing or promoting the experimental Cloudflare Worker.
- Any Glama Gateway / hosting adoption.
- Any CI dependency on a Glama-hosted surface.
- Building sync/automation tooling around the manual listing.
- Packaging the stdio server as a turnkey `npx`/`pip` distributable (separate
  decision; only relevant if Phase 0 resolves to `end-users`).

## Acceptance criteria

- Phase 0 resolved and recorded in the README; if it resolved to `end-users`,
  this roadmap is parked behind a packaging follow-up rather than executed.
- The stdio server (and only the stdio server) is listed, honestly scoped, with
  a one-line removable README badge.
- At least one non-Glama discovery channel exists.
- The kill-switches and the trigger-based review condition are written into the
  Phase-1 ADR.
- No CI step, no hosting change, no Worker listing was introduced.
