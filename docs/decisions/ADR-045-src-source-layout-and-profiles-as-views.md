---
adr: 045
status: accepted
date: 2026-06-03
decision: src-source-layout-and-profiles-as-views
supersedes: ADR-028
superseded_by: —
phase: v6.0.0 · D structural restructure
type: structural
---

# ADR-045 — `src/`-rooted source layout, profiles-as-views, and the hard-break decision

## Status

**Accepted** · 2026-06-03. Authored as Phase 7 / Step 20 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md).
**Supersedes [`ADR-028`](ADR-028-root-layout.md)** (the "src/ is occupied, defer
the root→src move" verdict). Composes with
[`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) (packages→src/domains),
[`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md) (naming),
[`ADR-046`](ADR-046-thin-command-principle.md) (thin commands), and
[`ADR-047`](ADR-047-framework-neutral-stack-adaptive-commands.md) (stack-adaptive).
Routed through the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
three deep design rounds, 2026-06-03).

## Context

ADR-028 rejected "move everything not needed at root into `./src/`" on the
ground that `./src/` was **occupied** by the TypeScript application (CLI · Server
· UI · shared) per ADR-012/016. That objection is resolved here: the TS app moves
to `src/app/`, freeing `src/` to be the single source-root for the whole package.

This is the **deliberate hard break** of the 6.0.0 line. The package has
few/team-internal users; the maintainer's explicit mandate is to optimise for the
cleanest end-state in one clean major rather than spread a path-invasive cut over
many versions. The AI council flagged consumer risk on root→src and did **not**
rubber-stamp the design; the maintainer's hard-break mandate overrides that, and
the value kept from the council is the **sequencing safeguards**, not "don't break".

## Decision

1. **`src/` is the single source-root.** The end-state tree:
   - `src/app/` — the TypeScript runtime (today's `src/{cli,server,install,shared,ui}`).
   - `src/domains/<pack>/<verb>/command.md` — the command surface (ADR-043/044).
   - `src/skills/` + `src/rules/` — flat, shared, single-namespace.
   - `src/flows/` — first-class USER-WORK flow artefacts (scaffolded 6.0.0-D, schema 6.1).
   - `src/profiles/` — profiles-as-views.
   - `src/config/`, `src/schemas/`, `src/templates/`, `src/docs/`, `src/internal/`.
   - Root keeps only tooling/agent-host essentials + `src/` + `tests/` + `taskfiles/`.

2. **Profiles are VIEWS, never file holders.** A `src/profiles/<id>.yaml` declares
   the **command set it surfaces** (by logical command name); the curated tree is
   rendered, not stored. Built-in profiles are **opinionated templates, immutable
   in 6.0** (user customisation of built-ins is deferred to 6.1; a custom profile
   uses a different name). Profiles reference commands by logical name, so they
   are decoupled from install-time filesystem paths.

3. **Profiles are INTERNAL, not a day-one concept.** The wizard/CLI never says
   "choose a profile". It asks "What are you doing?" (Software Development /
   Product & Roadmaps / Content Creation / Finance & Planning) and maps the answer
   to a profile id, with a Simple (default) vs Advanced toggle.

4. **Hard break, with a migration path.** There is no backward compatibility for
   the old paths. A first-class `migrate` command (`--dry-run` / `--from 4|5` /
   `--check`) plus `MIGRATION.md` (linked from the README) carries existing
   installs across.

5. **Staged execution per the scope-line rule (council sequencing safeguard).**
   The decision is locked here; the *execution* is staged so failure stays
   localisable:
   - **Structural/interface moves** (commands, skills/rules already flat, ADRs,
     flows, profiles-as-views schema) land in the 6.0.0 break PRs.
   - **The `scripts/` Python-package move under `src/` is the kill-switch risk**
     (imported repo-wide as `scripts.*`). It ships in its **own PR** with an
     import-compatibility shim (install shim → rewrite imports → remove shim),
     never bundled with unrelated changes. The install-contract rewrite
     (`package.json` `files`/`bin`/prepack, installer + manifest paths) follows
     the filesystem move, not before it.

## Consequences

- **Positive.** The repository layout reads as the product: `src/` is the whole
  package, structured; root is essentials only. ADR-028's "src is occupied"
  blocker is gone.
- **Positive.** Profiles-as-views means zero file duplication per profile and a
  single rendered curated surface; the "choose your workflow" UX hides the
  profile machinery.
- **Negative / accepted.** The hard break invalidates every old consumer path.
  This is intentional and mediated by `migrate` + `MIGRATION.md`.
- **Negative / accepted.** The root→src move (especially `scripts/`) is high-risk
  and is therefore staged across PRs with a compat shim, slowing the cut but
  keeping each PR reviewable and CI-localisable.

## Alternatives considered

- **Keep ADR-028 (defer root→src indefinitely).** Rejected: the maintainer's
  hard-break mandate + the `src/app/` resolution remove the original blocker.
- **Big-bang move (everything, one PR).** Rejected per the council: bundling the
  `scripts/` package move with 11 other changes makes failure localisation
  impossible. Staged-with-shim is the safeguard.
- **Profiles as directories of files.** Rejected: duplicates commands per profile
  and couples profiles to filesystem paths; views over a logical command registry
  are leaner and path-independent.

## References

- [`ADR-028`](ADR-028-root-layout.md) — superseded root-layout verdict.
- [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) — packages→src/domains.
- [`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md) · [`ADR-046`](ADR-046-thin-command-principle.md) · [`ADR-047`](ADR-047-framework-neutral-stack-adaptive-commands.md).
- [`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md) — target structure + scope-line rule.
