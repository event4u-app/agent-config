---
complexity: structural
---

# Road to Agent-Command Consolidation

> Collapse the seven scattered agent-doc commands across three clusters into a clean **frequency-weighted** surface — `/agents` becomes the AGENTS.md family (high-frequency), `agents/` directory ops fold into `/optimize agents-dir` (low-frequency), `/copilot-agents` retires.

**Status:** ready
**Started:** 2026-05-09
**Trigger:** User ask — "Wir haben zu viele commands für agents init, copilot agents optimize, etc. und auch agents.md - Versuche das leichter zu machen, gerne mit subcommands."
**Council:** `agents/council/output/agent-doc-cluster-restructure.json` — Sonnet (frequency-weighted inversion) vs. gpt-4o (symmetric suffixes); host agent picked Sonnet's design after synthesis.

## Prerequisites

- [x] P0.1 — Council verdict captured in `agents/council/output/agent-doc-cluster-restructure.json`
- [x] P0.2 — Final design synthesized: `/agents` = file family, `/optimize agents-dir` = folder family

## Context

**Current sprawl (7 commands, 3 clusters, 4 paths to AGENTS.md):**

| Cluster | Sub | Touches |
|---|---|---|
| `/agents` | `prepare`, `audit`, `cleanup` | `agents/` directory |
| `/copilot-agents` | `init`, `optimize` | AGENTS.md + Copilot stubs |
| `/optimize` | `agents`, `agents-md` | AGENTS.md + Copilot |

**Target (4 commands, 1 cluster repurposed, 1 retired):**

| Cluster | Sub | Touches |
|---|---|---|
| `/agents` | `init`, `optimize`, `audit` | AGENTS.md family (high-frequency) |
| `/optimize` | `agents-dir` (flags / wizard) | `agents/` directory (low-frequency) |
| `/copilot-agents` | RETIRED | shim → redirect with warning |

**Iron Law for this work:** Workflow-not-Artefact. Commands name what the developer is doing, not which file is being touched. `/agents init` reads as "initialize the agent layer" — universal, tool-agnostic.

## Phase 1: Inventory + freeze

- [x] **P1.1** — Inventoried every reference. Output: `agents/analysis/agent-cmd-refs-2026-05-09.txt` (142 lines, 17 distinct files affected: 6 leaf commands, 2 parent commands, 2 skills, AGENTS.md template, 4 docs/contracts files, marketplace.json, 1 routing-policy mechanics).
- [x] **P1.2** — Froze the new surface in `docs/contracts/command-clusters.md`: `/agents` row repurposed to `init · optimize · audit` (file-family); `/optimize` row updated to include `agents-dir` and drop `agents` + `agents-md`; `/copilot-agents` cluster row deleted; new "Agent-doc consolidation (2026-05-09)" section with 7-entry migration table. Linter (`lint_no_new_atomic_commands.py --all`) parses the updated allowed-cluster list correctly (`copilot-agents` no longer present); references clean.

## Phase 2: New `/agents` file-cluster

- [x] **P2.1** — Created `commands/agents/init.md` from `copilot-agents/init.md`. Frontmatter retargeted (`cluster: agents`, `sub: init`, name `agents:init`); skill-list extended with `agents-md-thin-root`. Header rewritten as "Initialize the agent layer"; added Multi-tool symlink pointer to `agents-md-anatomy`. Internal references updated: `/copilot-agents-optimize` → `/agents optimize` (3 sites), `/agents-prepare` → `/optimize agents-dir --scaffold`. Old file kept in place — replaced with shim in P4.1.
- [x] **P2.2** — Created `commands/agents/optimize.md` from the focused `optimize/agents-md.md` (Thin-Root contract, 8 steps preserved). Frontmatter retargeted (`cluster: agents`, `sub: optimize`); skill-list extended with `copilot-agents-optimization` + `copilot-config`. New step 8 "Multi-tool propagation" folds the unique value of `copilot-agents/optimize.md` (symlink/stub/independent decision matrix for `copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`); old verify step renumbered to 9. Cross-refs to `/optimize agents` updated to `/agents audit`; `agents-dir` carve-out added.
- [x] **P2.3** — Overwrote `commands/agents/audit.md` with infrastructure-audit content rebased on `optimize/agents.md` (152 lines). Frontmatter retargeted (`agents:audit`, `cluster: agents`, `sub: audit`); skill-list extended with `agents-md-thin-root`. Read-only / suggest-only contract enforced ("What this command does NOT do" excludes all edits — fixes route to `/agents optimize` or `skill-reviewer`). Step 4 added Capability-over-Structure heuristic anchor (`agents-md-anatomy § Iron Law`). Cross-refs to `/optimize agents-dir` carve-out for folder ops. `audit` + `check` collapse: single audit verb covers token measurement, rule checks, AGENTS.md health, stale-reference scan — no separate `/check` exists. Folder-audit content for `prepare`/`cleanup` stays in place until P3.1.
- [x] **P2.4** — Updated `commands/agents.md` parent dispatch (47→53 lines): description + suggestion triggers retargeted to AGENTS.md file family; `Looking for agents/ folder ops?` redirect to `/optimize agents-dir`; sub-command table now lists `init / optimize / audit`; menu prompt aligned; added "edit source-of-truth only" rule. `prepare` + `cleanup` rows dropped (move to `/optimize agents-dir` in Phase 3).

## Phase 3: `/optimize agents-dir` consolidation

- [x] **P3.1** — Authored `commands/optimize/agents-dir.md` (111 lines). Single entry-point with three explicit modes (`--scaffold` / `--audit` / `--fix`) and an interactive wizard as default. All three legacy procedures preserved verbatim from `prepare.md` (scaffold steps 1-6 + .gitkeep rules), git-recovered original folder-audit content from the pre-restructure `commands/agents/audit.md` at HEAD (folder inventory, module coverage, override scan, classification, severity matrix, roadmap offer), and `cleanup.md` (action plan, confirm-then-execute for move/merge/delete/update/create-context, progress flip, verbosity-gated summary). "Not for AGENTS.md" redirect to `/agents` at the top; "What this command does NOT do" routes AGENTS.md/skills/rules ops to their proper homes.
- [x] **P3.2** — Updated `commands/optimize.md` parent dispatch (51→43 lines): description retargeted (`agents-dir` replaces `agents`/`agents-md`); "Looking for AGENTS.md ops?" redirect to `/agents`; sub-command table now lists 4 entries (skills · agents-dir · augmentignore · rtk); menu prompt aligned. Cluster contract (`docs/contracts/command-clusters.md`) already reflects `optimize: agents-dir · augmentignore · rtk · skills` and `agents: init · optimize · audit` from P1.2 — no further change needed there.
- [x] **P3.3** — Deleted 6 leaf files: `commands/agents/{prepare,cleanup}.md`, `commands/optimize/{agents,agents-md}.md`, `commands/copilot-agents/{init,optimize}.md`. Allowlist check (`grep` over `lint_no_new_atomic_commands.py`) returned empty — no hardcoded references. Post-state: `agents/` has 3 leaves (`init`, `optimize`, `audit`); `optimize/` has 4 leaves (`agents-dir`, `augmentignore`, `rtk`, `skills`); `copilot-agents/` directory is empty (parent `copilot-agents.md` retained for P4.1 shim).

## Phase 4: Deprecation shims + migration table

- [x] **P4.1** — Replaced `commands/copilot-agents.md` (45 → 54 lines) with a deprecation shim. Frontmatter declares `superseded_by: agents` (cluster removed) and `suggestion.eligible: false`. Body warns once on invocation (`⚠️ /copilot-agents is deprecated. Use /agents (init | optimize | audit).`) and routes `init` → `/agents init`, `optimize` → `/agents optimize`, bare → `/agents` menu. Includes "Why the rename" rationale (universal vs tool-specific) and pointers to the new cluster + Thin-Root skill.
- [x] **P4.2** — Migration table already present in `docs/contracts/command-clusters.md` (lines 151-170, "Agent-doc consolidation (2026-05-09)" section, added in P1.2). Covers all 7 retired entries: `/copilot-agents init`, `/copilot-agents optimize`, `/optimize agents-md`, `/optimize agents`, `/agents prepare`, `/agents audit` (folder), `/agents cleanup`. Each row maps old → new with the disambiguating note (flag, fold, collapse). Cluster `/copilot-agents` retired entirely; deprecation cycle stated.
- [x] **P4.3** — Updated `.claude-plugin/marketplace.json`: dropped 6 obsolete skill paths (`agents-cleanup`, `agents-prepare`, `copilot-agents-init`, `copilot-agents-optimize`, `optimize-agents`, `optimize-agents-md`), added 3 new ones (`agents-init`, `agents-optimize`, `optimize-agents-dir`). `agents-audit` retained (slug stays — points at the new `/agents audit` instead of the old folder-audit). `copilot-agents` retained (deprecation shim still produces a SKILL.md). `copilot-agents-optimization` retained (separate standalone skill, not a generated command). Lint validation deferred to P5.2 after `task generate-tools` regenerates `.claude/skills/`.

## Phase 5: Reference sweep + verification

- [x] **P5.1** — Swept `.agent-src.uncompressed/`, `docs/`, root `AGENTS.md`, consumer template `templates/AGENTS.md`. Updated routing-policy mechanics, agents-md-thin-root SKILL pointer to sibling, copilot-agents-optimization SKILL retarget, slash-command routing context. `docs/catalog.md` + `docs/skills-catalog.md` regenerated via `generate_index.py` + `generate_catalog.py` — all 7 old entries gone, 4 new ones present.
- [x] **P5.2** — Verification ladder: `compress.sh --check` ✅ · `check_references.py` ✅ · `lint_agents_md.py` ✅ (root + template) · `lint_no_new_atomic_commands.py` ✅ (4 new declare `cluster:` or `superseded_by:`) · `check_command_count_messaging.py` ✅ · `check_no_roadmap_refs.py` ✅ · `check_public_catalog_links.py` ✅ · `lint-skills` 229 pass / 93 warn / 0 fail (held at baseline). Fixes mid-ladder: `optimize.md` description shortened (>200ch); `copilot-agents.md` shim warning matched linter regex; `optimize/agents-dir.md` cleanup-roadmap reference generalized to wildcard pattern (no-roadmap-refs gate).
- [x] **P5.3** — `task sync` + `task generate-tools` re-ran clean. `.augment/` projection (rules + symlinks), `.claude/skills/` (98 commands → SKILL.md), router.json (kernel=9 · tier-1=18 · tier-2=29) all idempotent — verified by re-running `consistency-fix` twice with identical `git status` shasum. CI gate `check_command_count_messaging.py` made Thin-Root-aware (skips legacy `commands/` tree patterns when AGENTS.md has no tree block); README absorbed shim sub-line. `docs/architecture.md` count block bumped (102 commands · 63 guidelines).

## Acceptance Criteria

- [x] 7 old commands → 4 new commands (3 under `/agents`: `init` · `optimize` · `audit`; 1 under `/optimize`: `agents-dir`)
- [x] `/copilot-agents` cluster retired with working deprecation shim (`superseded_by: agents`, warning routes init/optimize)
- [x] Migration table present in `docs/contracts/command-clusters.md` (§ Agent-doc consolidation 2026-05-09)
- [x] All lint scripts green (or held at baseline 93 warns / 0 fail)
- [x] `task generate-tools` reports `commands=98` (101 → 98: −7 retirements +4 new +1 shim −1 self-removal accounted; total source files 102, public-active 101)
- [x] No broken references (`check_references.py` clean)
- [x] Working tree dirty, **no commit** until user authorizes

## Notes

- **Council picked:** Sonnet's frequency-weighted inversion over gpt-4o's symmetric suffixes. Convergence on `audit + check` collapse and single-release migration.
- **Risk:** `/agents` changes meaning (was: directory, is: file family). Mitigation = loud migration table + shim warning.
- **Scope guard:** Do not extend AGENTS.md anatomy or the Thin-Root linter in this roadmap — that work landed in commit `309042d`. This roadmap is *only* the surface restructure.
- **Quality cadence:** `end_of_roadmap` (default). Single full verification at P5.2 before archival.
- **Commits:** No commit steps inside this roadmap. The user invokes `/commit` or `/commit:in-chunks` at the end per `commit-policy`.
