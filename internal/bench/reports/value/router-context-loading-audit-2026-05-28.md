# `dist/router.json` context-loading audit

**Generated:** 2026-05-28 · Phase 2 Step 1 of `road-to-value-dashboard-netto-cuts.md`.

## Question

Does `dist/router.json` land in the agent's per-request prompt
context on any host (Claude Code, Augment, Cursor, Cline, Windsurf,
Copilot)? If yes → minifying it saves measurable per-request input
tokens. If no → minify is a future-proofing optimisation, not a
measured Panel-A saving.

## Method

1. Grep every projected surface (`.claude/`, `.augment/`,
   `.cursor/`, `.clinerules/`, `.windsurfrules`) for `router.json`
   string occurrences. **Direct file projection** (e.g. a symlink
   from `.claude/router.json` to `dist/router.json`) would mean the
   host loads it.
2. Grep rule bodies under `.agent-src/rules/` for `router.json`
   string occurrences. Rule-text mentions are NOT context inclusions;
   they are documentation pointers.
3. Inspect `taskfiles/` for synthesis steps that copy `router.json`
   into any tool's context-loaded directory.
4. Inspect projection scripts (`scripts/sync_*`, `scripts/generate_*`,
   `scripts/install*`) for `router.json` copy targets.

## Findings

| Surface | router.json present? | Always-loaded? |
|---|---|---|
| `.claude/` projection | **no** (no symlink, no copy) | n/a |
| `.augment/` projection | **no** (no symlink, no copy) | n/a |
| `.cursor/rules/` | no | n/a |
| `.clinerules/` | no | n/a |
| `.windsurf/rules/` | no | n/a |
| `.windsurfrules` (single file) | no | n/a |
| Tool projection scripts | mentions only inside generated rule text (telegraph-speak, git-history-discipline) — no copy/symlink step targets `router.json` | n/a |
| Skill / rule bodies | 2 rules mention the path in prose (`telegraph-speak`, `git-history-discipline`); 1 context contract (`emergency-triage-block`); 1 template (`AGENTS.md`). These are documentation pointers, not context inclusions. | no |

## Verdict

**`dist/router.json` does NOT land in any host's per-request prompt
context as an always-loaded artefact.** It is a build-artifact /
maintainer-side CI input (used by `scripts/lint_rule_budget.py`,
`scripts/check_router.py`, kernel-budget verification). Consumers
that need its data fetch it on demand via the tool's read-file
primitive — never automatically.

## Decision

The Phase 2 minification ships anyway as future-proofing + clean-diff
hygiene (any future projection that pulls `router.json` into context
will benefit immediately) — but the saving is **not** booked to
Panel A. The `value-v1` `cost_ladder` already excludes router.json
(its load rung counts kernel rule bodies + charter only — see Phase
1 correction). No dashboard re-render is needed for this finding;
the rung was always honest about the artefact it measures.

## Source paths verified

- `grep -rln router.json .claude/ .augment/ .cursor/ .clinerules/ .windsurfrules` → 0 hits in projection-target directories (matches under `.claude/worktrees/` are nested git worktrees, not active context).
- `grep -rln router.json .agent-src/rules/` → 2 mentions (prose).
