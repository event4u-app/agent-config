---
adr: 058
status: accepted
date: 2026-06-06
decision: condensed-output-relocation-to-dist
supersedes: —
superseded_by: —
phase: v6.2.x · workspace structural cleanup follow-up
type: structural
---

# ADR-058 — Relocate the condensed output tree to `dist/agent-src/`

## Status

**Accepted** · 2026-06-06. Follow-up to [`ADR-051`](ADR-051-uncondensed-source-container-relocation.md)
(uncondensed source container → `src/agent-src/`) and refines the root inventory
of [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md). Routed through the
AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, 2026-06-06,
2 rounds).

## Context

After the 6.0.x cleanup, two similarly named trees coexisted:

- `src/agent-src/` — the **uncondensed source container** (ADR-051).
- `.agent-src/` at the repo root — the **condensed output** (729 tracked
  files), written by `condense.py`, shipped via npm `files[]`, consumed by the
  `.augment/` projection, the Claude plugin marketplace, and the IDE-tool
  symlink projections.

The namespace collision made the root tree read as a migration leftover, and
the maintainer asked for the root to be cleaned. ADR-051 had deliberately left
the condensed output path untouched (its correctness gate was a byte-identical
output snapshot), so the relocation needed its own decision.

## Decision

Relocate the condensed output from `.agent-src/` (repo root) to
**`dist/agent-src/`**, tracked in git (carve-out `!/dist/agent-src/` next to the
existing `!/dist/router.json`). Rationale, per the council convergence:

- `dist/` is the established home for generated artifacts (compiled TS,
  `router.json`, discovery manifests) and is already shipped via npm `files[]`.
- Placing generated output under `src/` (Option C) was unanimously rejected —
  it violates ADR-050's hand-authored-source trust boundary.
- Keeping the tree tracked (vs. generate-on-publish, Option D) preserves the
  git-consumed surfaces: the Claude plugin marketplace resolves
  `./dist/agent-src/skills/<name>` from the cloned repo, and CI hash gates
  keep verifying source↔output sync.
- `package.json` `files[]` drops the `.agent-src/` entry; `dist/` already
  ships, so the npm tarball keeps carrying the condensed tree.

The council's named #1 failure mode — external consumers with hard-coded
`.agent-src/` paths breaking on the cutover — is accepted: consumers are
internal projects, the path change ships as a breaking change in
`BREAKING_CHANGES.md`, and `condense.py` keeps stripping the legacy
`.agent-src/` prefix defensively in `load_context` values.

## Consequences

- The repo root no longer carries a generated dot-tree; `src/agent-src/`
  (source) and `dist/agent-src/` (output) are now visually and semantically
  paired.
- ~123 code/config files and ~143 live docs were repointed mechanically;
  historical ADRs, archived roadmaps, and evidence snapshots keep the old
  paths (they record past states).
- Anything that wipes `dist/` wholesale would now delete a tracked tree —
  guarded by the `.gitignore` carve-out structure (`/dist/*` with explicit
  re-includes) and by CI's condensation/sync gates failing on a missing tree.
- The `.augment/`, `.claude/`, `.cursor/` projections and the plugin
  marketplace regenerate against the new location via `task sync` /
  `task generate-tools`.

## Alternatives considered

- **Keep at root, document (Option A).** Rejected: the maintainer explicitly
  wants the root cleaned; documentation alone does not remove the recurring
  source-vs-output confusion.
- **Move under `src/` (Option C).** Unanimously rejected by the council —
  generated output inside the hand-authored source tier.
- **Untrack + generate on publish (Option D / D-hybrid).** Rejected for now:
  breaks git-consumed surfaces (plugin marketplace, clone-based installs) and
  removes review diffs of condensed rules. Can be revisited once all consumer
  paths run through the npm tarball.
- **Rename in place, e.g. `.agent-dist/` (council Option E).** Solves the
  namespace collision but keeps a generated dot-tree at the root — the
  maintainer's stated complaint.

## References

- [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md) — workspace-vs-package trust boundary.
- [`ADR-051`](ADR-051-uncondensed-source-container-relocation.md) — uncondensed source container move.
- AI council, design mode, 2026-06-06 (anthropic/claude-sonnet-4-5 + openai/gpt-4o) — converged on Option B (`dist/agent-src/`) with tracked carve-out and breaking-change disclosure.
