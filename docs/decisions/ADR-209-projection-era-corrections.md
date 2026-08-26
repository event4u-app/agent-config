---
adr: 209
status: accepted
date: 2026-08-03
decision: projection-era-corrections
supersedes: ADR-089, ADR-030
supersedes_scope: >-
  ADR-030 partially only — Decision 2, the keep-the-skills-list-projection-for-now
  carve-out. ADR-089 is superseded in full.
superseded_by: —
phase: road-to-renewal-adr-hygiene
type: structural
review_trigger: >-
  Reopen when the Claude Code flat-command discovery defect is fixed upstream
  (the 47 flat-command skill wrappers — the ADR-044 mitigation — would then be
  removable, closing the last .claude/skills command channel), OR when the
  plugin shim stops being the marketplace bootstrap (ADR-089's replacement
  shape would then need its own record)
---

# ADR-209 — Projection-era corrections: ADR-030's dual-projection carve-out is retired; ADR-089's worktree rationale is superseded

## Status

**Accepted** · 2026-08-03. Per `road-to-renewal-adr-hygiene` Phase 3 with
AI-council convergence (claude-sonnet-4-5 + gpt-4o, design mode,
2026-08-03). Documentary record — no code or consumer-surface change ships
with it; the code changes it describes already landed (plugin shim
2026-07-08; command de-dup in PR #1117, 2026-08-02).

## Context

Two accepted records still describe a projection world that no longer
exists:

**ADR-030** (2026-05-28) decided Option B — native slash-command routing —
and carved out at Decision 2: keep the `.claude/skills/` skills-list
projection "for now" as backwards compat, retirement "deferred to a
separate roadmap", guarded by a 14-day kill-switch window. That window
closed 2026-06-11 without Option B failing; the `review_date: 2026-06-11`
sat expired for ~8 weeks. The Foundation command de-dup (PR #1117) then
narrowed the command projection: clustered commands project only as
`.claude/commands/<cluster>/<sub>.md` symlinks; what remains in
`.claude/skills/` is 47 flat-command wrappers — and those are NOT the
ADR-030 legacy projection but the ADR-044 mitigation for a Claude Code
flat-command discovery defect, governed by ADR-044/090/092.

**ADR-089** (2026-06-12) rejected restructuring the plugin source on a
quantified rationale: 373 layout-spread plugin skills, of which 146
command-as-skill symlinks would dangle. Every number is now false: the
2026-07-08 plugin-shim change stripped `.claude-plugin/` to
`marketplace.json` + ONE pointer skill (`install-agent-config`), marked
the plugin "DEPRECATED as a content channel", and the generator
(`generate_plugin_command_skills`) now actively prunes any other skill
dir on every run. The restructure ADR-089 rejected has effectively
happened by another route.

## Decision

1. **ADR-030 Decision 2 is retired** (partial supersede — carried
   machine-readably in this record's `supersedes:` paren annotation, the
   ADR-124 pattern the index generator already parses). The dual
   projection as a *compat carve-out* no longer exists: the sole command
   channel is native slash routing (`~/.claude/commands/` via
   `CLAUDE_SKILL_BUNDLE`), and the 47 flat-command wrappers that still
   live under `.claude/skills/` are the ADR-044 discovery-defect
   mitigation, removable only when the upstream defect is fixed — not an
   ADR-030 obligation. **ADR-030's Decision 1 (Option B, native
   slash-only) still stands and governs**; ADR-030 keeps
   `status: accepted` with a scoped partial-supersede note in its Status
   prose (house pattern: ADR-093/049/098).
2. **ADR-089 is fully superseded.** Its decision output (use `git
   worktree` for lean local plugin installs) is harmless but its entire
   rationale — the 146 symlinks, the 373-skill spread, the 1.5 GB
   worktree bloat — describes a tree the generator now deletes on sight.
   The lean-plugin shape it rejected is the shipped reality (the shim).
3. **No code changes.** The consumer surface is written by
   `wizard-plan.ts` / `install.ts` and is untouched; both generators
   involved gate on `src/domains/` presence (maintainer-repo-only).

## Consequences

- Positive: the last two projection-era records whose premises collapsed
  stop being citable as accepted authority; the "temporary" carve-out
  that outlived its kill-switch window by 8 weeks is formally closed.
- Negative / accepted: ADR-030 remains `accepted` with a superseded
  Decision 2 inside — the scoped-supersede prose plus this record's
  paren-annotated `supersedes:` line are the two places that make the
  split machine- and human-readable.

## Alternatives considered

- **Flip ADR-030 fully to `superseded`** — rejected: Decision 1 (native
  slash routing) is live, load-bearing, and correct; a full flip would
  misreport the governing decision of the command channel.
- **Two separate records** — rejected: one causal story (plugin shim +
  command de-dup), chip-mode budget, and the two corrections cross-cite
  each other.
- **Amend both in place without a superseding record** — rejected: the
  council's D5 review required the partial supersession to be
  machine-readable on the superseding side, not prose-only.

## References

- [ADR-030](ADR-030-claude-code-command-projection.md) — Decision 2 retired; Decision 1 stands.
- [ADR-089](ADR-089-lean-local-plugin-install.md) — fully superseded.
- [ADR-044](ADR-044-command-naming-scheme-hyphenated.md) — governs the 47 flat-command wrappers.
- [ADR-090](ADR-090-visibility-command-frontmatter-field.md) · [ADR-092](ADR-092-defer-command-tier-alias-removal.md) — the discovery contract behind the wrapper visibility.
- `src/scripts/condense.ts` (`generate_claude_project_commands`, `generate_plugin_command_skills`) — the shipped mechanics.
- PR #1117 (command de-dup) · plugin-shim change 2026-07-08 — the causal events.
