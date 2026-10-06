---
adr: 088
status: accepted
date: 2026-06-11
decision: no-external-runtime-federation
supersedes: —
superseded_by: ADR-124
superseded_scope: engine-adoption interpretation only
phase: external-runtime-coexistence
type: structural
---

# ADR-088 — agent-config does not bridge to external tool runtimes; federation needs its own explicit decision

## Status

**Accepted** · 2026-06-11. Lands with the closure of PR #262
("external-runtime coexistence bridge") as superseded.

## Context

An external multi-agent runtime is a multi-agent
orchestration **runtime** (swarms, persistent memory / RAG, an MCP server,
a hooks system, background workers). It also writes `.claude/` lifecycle
hooks, so it shares a Claude Code project's `.claude/` directory with
`event4u/agent-config`.

PR #262 (authored 2026-05-27) proposed an "external-runtime coexistence bridge" with four
parts:

1. **Plugin-scope hook delivery** — ship agent-config's Claude hooks via the
   plugin (`hooks/hooks.json`) instead of the shared `.claude/settings.json`
   hooks array, to stop colliding with neighbour tools' hook arrays.
2. **`detect_external` + `coexist`/`skip` mode + dispatcher skip-gate** — detect
   the external runtime, offer a one-time choice, optionally skip agent-config's own
   dispatcher so the two tools' hooks don't double-fire.
3. **A detection-gated `external-runtime-bridge` pack** (`external-runtime-routing` rule +
   `external-runtime-orchestration` skill) documenting the external runtime's MCP-tool surface and a
   persona→agent-type map so the host agent can **drive the external runtime's swarm**.
4. **A coexistence contract + an 8-phase roadmap** (later phases: shared
   cross-tool memory, collision namespacing, git-layer enforcement of the external runtime's
   swarm commits, docs).

Two things happened on `main` after the PR was authored:

- **(A) Part 1 landed independently.** Plugin-scope hook delivery is on `main`
  (`hooks/hooks.json` generated from `src/scripts/hook_manifest.yaml`;
  `ensure_claude_bridge` writes only `enabledPlugins`, canonical id
  `agent-config@event4u`). agent-config no longer owns the `settings.json`
  hooks array, so it coexists with *any* neighbour tool's hooks generically —
  the external runtime included. The original hook-collision motivation is solved without
  anything external-runtime-specific.
- **(B) An "external-runtime adoption" decision was recorded** (cross-vendor council,
  claude-sonnet-4-5 + gpt-4o, 2026-05-06; see an internal parity record (local-only)).
  Verdict: harvest only **portable** patterns from the external runtime (ADR methodology,
  cost-tracker, HMAC signing) and **explicitly do not couple to the external runtime's
  runtime / swarm / MCP tools** — wording used: "out of suite identity".
  Candidates requiring the external runtime (`observe-trace`, `test-gaps`) were
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
   not a runtime coordinator. It ships no `external-runtime-orchestration`,
   `cursor-orchestration`, `aider-routing`, `windsurf-bridge`, or equivalent
   artifact that calls another tool's runtime / swarm / MCP surface. This is a
   **category** boundary, not an external-runtime-specific one. Consistent with the
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
   (a) should the suite take on that identity; (b) the generic design (an external runtime +
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
- Users who run both agent-config and the external runtime (or any neighbour) get hook
  coexistence for free via plugin scope; they do not get agent-config-driven
  external-runtime orchestration.
- Future "let's just add detection / a bridge for tool X" PRs have a recorded
  boundary to point at, preventing re-litigation. They are redirected to the
  generic, protocol-level, ADR-gated path in (2)–(3).

## Alternatives considered

- **Finish & merge PR #262 as-is** — rejected: reintroduces the runtime
  coupling decision (B) dropped, across an unvalidated trust boundary, and
  enacts a strategic pivot without an explicit decision.
- **Repurpose to the defensive sliver only** (`detect_external` + dispatcher
  skip-gate + a generalised neighbour-coexistence contract) — rejected as the
  default: the council found it wrong-layer (coordination belongs at the
  protocol layer, not in tool-specific detection code) and redundant given (A),
  with no documented user pain. The generic, protocol-level path in decision
  (2) remains available if real pain is later documented.
- **Keep PR #262 parked as a draft** — rejected: it had drifted structurally
  out of the tree and its premise was superseded; an open draft on a dead
  premise is maintenance debt, not optionality.

## References

- PR #262 — "feat: external-runtime coexistence bridge" (closed as superseded, 2026-06-11).
- An internal parity record (local-only) — external-runtime parity verdict
  (all patterns mechanism-covered; no runtime coupling).
- An internal parity record (local-only) — the 2026-05-06 cross-vendor council
  decision: harvest portable patterns, "out of suite identity" for the runtime.
- [`package-self-orientation`](../contracts/package-self-orientation.md) —
  "no app runtime" identity.

## Implementation-status note — 2026-10-06

This note is **append-only**. It changes no sentence of this record, and it
changes nothing about the decision.

**The statement it is about.** Premise (A) under § Context reads, in part:

> agent-config no longer owns the `settings.json` hooks array, so it coexists
> with *any* neighbour tool's hooks generically

**It was accurate when this ADR was accepted, and the mechanism changed
afterwards.** This record was accepted 2026-06-11. `ensure_managed_hooks` was
introduced on **2026-07-07** (`f1a7644b8`, "feat(install): managed Claude hook
registration in settings.json (Phase 1)", with `9c06cdba7` the same day for the
global-deploy path) — twenty-six days later. So the sentence is not a factual
error in the record; it is a statement whose subject moved under it. The
sentence stands as written, as the historical premise it was.

**The mechanism as of `6b79d06de` (2026-10-06).** `src/scripts/install.ts:3089`
calls `claude_settings_hooks.ensure_managed_hooks(path.join(anchor,
'settings.json'), matrix)`. That function
(`src/scripts/_lib/claude_settings_hooks.ts:214-244`) reads `settings['hooks']`
and, per native event, computes
`user_groups = existing.filter((g) => !_is_managed_group(g))`, then writes
`hooks[native] = [...user_groups, managed_group]` and persists the file. So the
package **does** write the `settings.json` hooks array today, as one
**signature-scoped** managed group per native event, and it preserves every
group it does not identify as managed. The phrasing is deliberate: the code
establishes preservation of groups failing the managed-signature test, which is
a narrower and checkable claim than "never touches other groups".

**The conclusion premise (A) supports is unchanged.** Generic coexistence with
any neighbour tool's hooks still holds; it is now achieved by signature-scoped
group management rather than by not writing the array at all. The original
hook-collision motivation remains solved without anything external-runtime-specific.

**What this note does not do**, stated so no later reader and no retrieval pass
can mistake its scope: it does not reopen or narrow the decision; §§ 1, 2, 3 and
4 stand exactly as written; § 3's reservation of runtime federation to a future
owner ADR is untouched and is **not** weakened, implied, or partially discharged
by anything here; `status: accepted`, `superseded_by: ADR-124` and
`superseded_scope: engine-adoption interpretation only` are unchanged; and no
authority, threshold or scope moves.

**Provenance.** Raised as blocker `b7-adr-088-premise` of
`agents/roadmaps/archive/road-to-leading-every-row.md`. That blocker proposed replacing
the sentence. Two AI-council passes on 2026-10-06 (anthropic
`claude-sonnet-4-5` + openai `codex-default`, 3 rounds and 2 rounds, subscription
transport, $0 billed) returned 3 of 4 seat-opinions for an append-only dated
erratum preserving the original wording rather than a replacement, and one seat
required the acceptance-date history check that produced the finding above. The
replacement option was therefore not taken.
