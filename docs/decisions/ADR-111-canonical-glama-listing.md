---
adr: 111
status: accepted
date: 2026-07-07
decision: canonical-glama-listing
supersedes: —
superseded_by: —
phase: road-to-mcp-full-power
type: standing
---

# ADR-111 — the kernel stdio server is the canonical Glama listing; the turnkey server stays unlisted

## Status

**Accepted** · 2026-07-07 · maintainer decision, Phase 2 of
`road-to-mcp-full-power.md`.

## Context

The package now ships two distinct stdio MCP servers with different
audiences and capability shapes:

1. **Kernel stdio server** (`src/scripts/mcp_server/`, started via
   `agent-config mcp:run`) — requires a repo checkout (or the glama build
   step), exposes 430 prompts / 232 resources / 27 catalogued tools (9
   implemented as of Phase 1/4 of this roadmap). This is the server glama.ai
   currently indexes and lists at
   `glama.ai/mcp/servers/event4u-app/agent-config`.
2. **Turnkey stdio-lite server** (`src/cli/mcp/`, started via
   `agent-config mcp-server`) — zero-setup, reads the bundled
   `dist/agent-src/` + `docs/guidelines/` directly from the installed npm
   package, no repo clone required. Read-only by design (ADR-085): zero
   tools, prompts/resources only.

`road-to-glama-registry-listing.md` (archived) already converged on listing
only the stdio server for a contributor/agent-developer audience, before the
turnkey server existed in its current form. This ADR re-confirms that choice
now that both servers are live, and records why a second listing is not
added.

## Decision

1. **Glama lists the kernel server only.** `glama.json` and the committed
   `internal/glama/{build,run}` scripts continue to target
   `src/scripts/mcp_server/__main__.ts`. No change to the glama admin
   configuration.
2. **The turnkey server is not submitted to glama.** Rationale:
   - Glama's value proposition (repo-aware introspection, contributor
     discovery) matches the kernel server's audience — people extending or
     debugging the package itself.
   - The turnkey server's audience (end users who `npx @event4u/agent-config
     mcp-server` for zero-setup client config) is served better by direct
     per-IDE config snippets (`docs/setup/mcp-client-config.md`,
     `docs/getting-started-local-stdio.md`) than by a registry listing that
     would advertise a read-only, tool-less server next to the fuller
     kernel listing under the same package name — a likely source of
     consumer confusion ("why does the glama listing show tools I don't
     get?").
   - Glama's schema (`glama.ai/mcp/schemas/server.json`) supports exactly one
     manifest field (`maintainers`); there is no per-listing scoping
     mechanism to distinguish two servers from the same repo without a
     second, separately-hosted manifest — not worth the maintenance surface
     for a zero-tool server.
3. **Revisit trigger.** Reopen this decision if either: (a) the turnkey
   server gains tools (Phase 6 of this roadmap may bundle the kernel tool
   surface into the npm package, per the ADR-085 revisit), making its
   capability shape worth discovering separately; or (b) a named consumer
   asks to discover the turnkey server via a registry specifically (not
   just via npm/README).

## Consequences

- No glama configuration change required by this roadmap.
- `docs/mcp-registries.md` and `docs/setup/mcp-client-config.md` document
  both entry points, but only one (the kernel server) appears in the glama
  registry — this asymmetry is intentional, not an oversight.
- Official MCP-registry submission (Phase 2 Step 5 of this roadmap) is
  free to list either or both servers, since that registry's schema is not
  glama's single-manifest-per-repo constraint — evaluated separately.

## Alternatives

- **List both as separate glama entries.** Rejected — no such thing as
  "the second manifest field" in glama's schema for this repo; would need a
  second cloned/forked registration, disproportionate for a read-only
  zero-tool server.
- **Drop the kernel listing, list only turnkey.** Rejected — the kernel
  server's tool surface is the entire reason glama's introspection is
  valuable here; a tool-less listing loses that value.

## References

- `road-to-glama-registry-listing.md` (archived) — original listing decision.
- `road-to-mcp-stdio-end-user-packaging.md` (archived) — turnkey server origin, ADR-085.
- `agents/settings/contexts/mcp-tool-tier-map.md` — capability-shape evidence for both servers.
- `internal/glama/README.md` — the build/run scripts this decision keeps unchanged.
