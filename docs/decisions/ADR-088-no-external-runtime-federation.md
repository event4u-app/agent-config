---
adr: 088
status: accepted
date: 2026-06-11
decision: no-external-runtime-federation
supersedes: —
superseded_by: —
phase: ruflo-coexistence
type: structural
---

# ADR-088 — agent-config does not bridge to external tool runtimes; federation needs its own explicit decision

## Status

**Accepted** · 2026-06-11. Lands with the closure of PR #262
("ruflo coexistence bridge") as superseded.

## Context

[`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) is a multi-agent
orchestration **runtime** (swarms, persistent memory / RAG, an MCP server,
a hooks system, background workers). It also writes `.claude/` lifecycle
hooks, so it shares a Claude Code project's `.claude/` directory with
`event4u/agent-config`.

PR #262 (authored 2026-05-27) proposed a "ruflo coexistence bridge" with four
parts:

1. **Plugin-scope hook delivery** — ship agent-config's Claude hooks via the
   plugin (`hooks/hooks.json`) instead of the shared `.claude/settings.json`
   hooks array, to stop colliding with neighbour tools' hook arrays.
2. **`detect_ruflo` + `coexist`/`skip` mode + dispatcher skip-gate** — detect
   ruflo, offer a one-time choice, optionally skip agent-config's own
   dispatcher so the two tools' hooks don't double-fire.
3. **A detection-gated `ruflo-bridge` pack** (`ruflo-routing` rule +
   `ruflo-orchestration` skill) documenting ruflo's MCP-tool surface and a
   persona→agent-type map so the host agent can **drive ruflo's swarm**.
4. **A coexistence contract + an 8-phase roadmap** (later phases: shared
   cross-tool memory, collision namespacing, git-layer enforcement of ruflo
   swarm commits, docs).

Two things happened on `main` after the PR was authored:

- **(A) Part 1 landed independently.** Plugin-scope hook delivery is on `main`
  (`hooks/hooks.json` generated from `src/scripts/hook_manifest.yaml`;
  `ensure_claude_bridge` writes only `enabledPlugins`, canonical id
  `agent-config@event4u`). agent-config no longer owns the `settings.json`
  hooks array, so it coexists with *any* neighbour tool's hooks generically —
  ruflo included. The original hook-collision motivation is solved without
  anything ruflo-specific.
- **(B) A "ruflo adoption" decision was recorded** (cross-vendor council,
  claude-sonnet-4-5 + gpt-4o, 2026-05-06; see archived
  `road-to-ruflo-adoption` and [`docs/parity/ruflo.md`](../parity/ruflo.md)).
  Verdict: harvest only **portable** patterns from ruflo (ADR methodology,
  cost-tracker, HMAC signing) and **explicitly do not couple to ruflo's
  runtime / swarm / MCP tools** — wording used: "out of suite identity".
  Candidates requiring ruflo's runtime (`observe-trace`, `test-gaps`) were
  dropped for that reason; an MCP/HTTP-bridge was only "deferred-with-trigger".

PR #262's parts 2–4 are precisely the runtime coupling decision (B) rejected.
They also drifted structurally out of the tree (`packages/core/` removed,
`scripts/` → `src/scripts/`, `.agent-src.uncondensed/` → `src/`), so a 1:1
finish was no longer viable regardless.

The "finish & merge" question was re-routed through the AI council
(design lens, deep). Cross-vendor transport was degraded to anthropic-only by a
local CLI-adapter incompatibility (the `codex` and `gemini` CLI adapters pass
flags the installed CLI versions reject), but the verdict converges with the
2026-05-06 cross-vendor decision: close as superseded, and record the boundary
so it is not re-litigated. The council's sharpest framing: PR #262 is an
**unsanctioned strategic pivot** from "skill suite for AI coding tools" to
"federation platform that orchestrates orchestrators" — a strategic decision,
not a feature, smuggled in via an incremental PR.

## Decision

1. **agent-config does not bridge to, or drive, external tool runtimes.**
   It is a **content suite** (skills, rules, commands) for AI coding tools —
   not a runtime coordinator. It ships no `ruflo-orchestration`,
   `cursor-orchestration`, `aider-routing`, `windsurf-bridge`, or equivalent
   artifact that calls another tool's runtime / swarm / MCP surface. This is a
   **category** boundary, not a ruflo-specific one. Consistent with the
   "no app runtime" identity in
   [`package-self-orientation`](../contracts/package-self-orientation.md).

2. **Cross-tool coexistence is handled generically at the plugin / protocol
   layer, never via tool-specific content.** Plugin-scope hook delivery (A)
   already lets agent-config coexist with any neighbour's `settings.json`
   hooks. Any future cross-tool coordination need must be solved the same way —
   protocol-level (e.g. metadata in `hooks.json`), generic (any neighbour, not
   one named vendor), opt-in, and demand-driven (a documented user pain), not
   as a skill / rule / pack.

3. **Federation is a separate, explicit decision.** If agent-config should ever
   expand from skill-suite to a "federation platform" that orchestrates
   external orchestrators, that requires its **own** ADR answering, at minimum:
   (a) should the suite take on that identity; (b) the generic design (ruflo +
   Cursor + Copilot + Windsurf, not one vendor); (c) the maintenance model for
   N external bridges; (d) the trust contract — who validates an external
   runtime's output, and how agent-config's safety floors
   (`non-destructive-by-default`, `commit-policy`, `verify-before-complete`)
   are enforced across the boundary. Until such an ADR is accepted, runtime
   coupling is **out of scope**.

4. **PR #262 is closed as superseded** under this boundary. Reopen only if the
   federation decision in (3) is made.

## Consequences

- agent-config's identity stays clean: portable content, no dependence on any
  neighbour tool's installation, version, or MCP-tool stability.
- The maintenance surface does not grow by one bridge per orchestrator, and
  behaviour does not vary by which neighbours are installed.
- Users who run both agent-config and ruflo (or any neighbour) get hook
  coexistence for free via plugin scope; they do not get agent-config-driven
  ruflo orchestration.
- Future "let's just add detection / a bridge for tool X" PRs have a recorded
  boundary to point at, preventing re-litigation. They are redirected to the
  generic, protocol-level, ADR-gated path in (2)–(3).

## Alternatives considered

- **Finish & merge PR #262 as-is** — rejected: reintroduces the runtime
  coupling decision (B) dropped, across an unvalidated trust boundary, and
  enacts a strategic pivot without an explicit decision.
- **Repurpose to the defensive sliver only** (`detect_ruflo` + dispatcher
  skip-gate + a generalised neighbour-coexistence contract) — rejected as the
  default: the council found it wrong-layer (coordination belongs at the
  protocol layer, not in tool-specific detection code) and redundant given (A),
  with no documented user pain. The generic, protocol-level path in decision
  (2) remains available if real pain is later documented.
- **Keep PR #262 parked as a draft** — rejected: it had drifted structurally
  out of the tree and its premise was superseded; an open draft on a dead
  premise is maintenance debt, not optionality.

## References

- PR #262 — "feat: ruflo coexistence bridge" (closed as superseded, 2026-06-11).
- [`docs/parity/ruflo.md`](../parity/ruflo.md) — ruflo parity verdict
  (all patterns mechanism-covered; no runtime coupling).
- Archived `road-to-ruflo-adoption` — the 2026-05-06 cross-vendor council
  decision: harvest portable patterns, "out of suite identity" for the runtime.
- [`package-self-orientation`](../contracts/package-self-orientation.md) —
  "no app runtime" identity.
