---
adr: 104
status: accepted
date: 2026-06-22
decision: ai-council-config-global-only
supersedes: 093
superseded_by: —
phase: ai-council-config-relocation
type: structural
---

# ADR-104 — The AI-council config is global-only (drop the project-local override)

## Status

**Accepted** · 2026-06-22. Maintainer directive (standing, restated and
sharpened): the council is configured **once, globally** — and the agent
must never search a project for council config, never infer "council not
configured" from a project's missing files.

Supersedes the project-local override that
[ADR-093](ADR-093-ai-council-config-user-global.md) deliberately kept.

## Context

ADR-093 relocated the council config to the user-global namespace
(`~/.event4u/agent-config/settings/.ai-council.yml`) but **kept** a
project-local override as precedence rule 2:
`<project_root>/agents/settings/.ai-council.yml` would win over the
user-global file when present. ADR-093 also rejected the "global always
wins" alternative, reasoning it would break a consumer team's
deliberately-checked-in shared council config.

In practice that hedge produced a recurring, infuriating failure mode that
the loader's own correctness did *not* prevent — because the failure was
in the **agent's mental model**, not the resolver:

> *"Council war in diesem Projekt nicht konfiguriert (kein <!-- md-language-check: ignore -->
> `.agent-settings.yml`/`scripts/ai_council`), daher habe ich die eine <!-- md-language-check: ignore -->
> Architektur-Gabel selbst entschieden."* <!-- md-language-check: ignore -->

An agent working in a consumer project, asked to consult the council on an
architecture fork, looked **in the project** for council artefacts — the
package-internal `scripts/ai_council` directory and the long-removed
`.agent-settings.yml` `ai_council` block — found neither (they only exist
inside the agent-config package), and concluded the council was
unconfigured. It then decided a structural fork solo. The user's council
*was* configured — globally — and would have answered from any project.

The project-local override is the root of this confusion: as long as "the
project might carry its own council config" is a documented truth, the
agent treats the project tree as a place to look, and absence-in-project
reads as not-configured. The override's intended beneficiary (a consumer
team pinning a shared config in their repo) has never materialised and is
not worth the recurring solo-decision failure on real work.

## Decision

**The council config is global-only.** `resolve_config_path` (in
`scripts/ai_council/config.ts`) resolves with this precedence, first match
wins:

1. **`$AI_COUNCIL_CONFIG`** — an explicit absolute path (tests / power
   users). Honoured even when absent. This is an explicit path, not a
   project search.
2. **User-global** `~/.event4u/agent-config/settings/.ai-council.yml`
   (legacy `~/.config/agent-config/` read-fallback).

The project-local branch is **removed**. The loader never builds or stats
`<project_root>/agents/settings/.ai-council.yml`. `project_root` stays in
the signature for caller stability but is not consulted for resolution.

The corollary, binding on every agent-facing surface (the `ai-council`
skill, the `/council` command family, the config contract): **the absence
of a council file in a project says nothing about whether the council is
configured.** An agent must never claim "council not configured" from
missing project files (`.agent-settings.yml`, `scripts/ai_council`, a
project `.ai-council.yml`). The CLI/resolver is the single authority — it
reads the global file and works from every project, worktree, and CWD.

## Consequences

- A user-global `.ai-council.yml` with `enabled: true` works from **every**
  project, including consumer repos and fresh worktrees, with zero
  per-project setup — exactly the "configure once" intent of ADR-093, now
  without the hedge that undermined it.
- The "council not configured in this project" solo-decision failure mode
  is structurally impossible: there is no project location to be absent.
- `council_cli.ts` and `cmd_doctor.ts` (`doctor council-cli`) inherit the
  change automatically — both already route through `resolve_config_path`.
- A consumer team that genuinely wants a repo-pinned shared council config
  uses `$AI_COUNCIL_CONFIG` (e.g. exported in their dev shell / CI) — an
  explicit opt-in, never an implicit project-tree search.
- `check_council_config_location.ts` keeps guarding against
  `.agent-settings.yml` council references; its docstring is updated to
  drop the "project-local first" description.

## Alternatives

- **Keep ADR-093 as-is (project-local override stays).** Rejected — this is
  the exact configuration that produced the recurring failure; the loader
  being correct did not save the agent's mental model.
- **Fix only the agent-facing docs, leave the override in the loader.**
  Rejected — as long as a project-local lookup exists, "look in the
  project" remains a documented truth and the absence-reads-as-unconfigured
  confusion recurs. Removing the lookup makes the instruction unambiguous.
- **Add a project-local override behind an explicit opt-in flag.** Rejected
  as unneeded complexity — `$AI_COUNCIL_CONFIG` already covers the rare
  repo-pinned case explicitly.

## References

- [ADR-093](ADR-093-ai-council-config-user-global.md) — the user-global
  relocation this ADR sharpens to global-only.
- `docs/contracts/ai-council-config.md` § File location — precedence rules.
- `src/scripts/ai_council/config.ts` — `resolve_config_path`.
- `src/skills/ai-council/SKILL.md`, `src/domains/meta/council/default/command.md`
  — agent-facing surfaces carrying the "never infer not-configured from
  missing project files" corollary.
