---
model_tier: inherit
name: roadmap-management
description: "Use when the user says \"create roadmap\", \"show roadmap\", or \"execute roadmap\". Creates, reads, and manages roadmap files with phase tracking."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# roadmap-manager

## When to use

Use this skill when:
- Creating a new roadmap (`/roadmap:create` command)
- Executing a roadmap (`/roadmap:process-step|phase|full` commands)
- Checking roadmap progress
- Updating roadmap status after completing work


Do NOT use when:
- Small tasks that don't span multiple steps
- One-off questions or fixes

## ⚠ Dashboard sync — non-negotiable

`agents/roadmaps-progress.md` is auto-generated and must reflect the
live state in real time. After **any** checkbox edit (`[x]`, `[~]`,
`[-]`, `[ ]`) or phase add/rename/remove in a roadmap file, regenerate
the dashboard **in the same response**.

**Completion = archival.** If an edit takes a roadmap to
`count_open == 0` (pure `[x]`, or `[x]` + `[~]`/`[-]`), `git mv`
it into `agents/roadmaps/archive/` **before** regenerating — see
the auto-archive decision table under "Check completion status"
below. A 100%-complete roadmap left in `agents/roadmaps/` makes the
next reader think work is still open.

This is enforced by the [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
rule. Batching multiple edits in one response is fine — one final
regeneration before replying is enough. But the response must not end
without it.

### Archival — preferred sweep, untracked-safe manual fallback

The robust path is the `archive_completed_roadmaps --all` sweep: it detects a
completed roadmap (`count_open == 0`, `count_deferred == 0`), moves it to
`agents/roadmaps/archive/` — `git mv` in a tracked repo, a plain `mv` in a
pre-first-commit / untracked one — rewrites inbound refs, and regenerates the
dashboard. It is **PR-independent**: it does not need `/create-pr` to have run.

**Manual fallback — script-less consumer** (the sweep is not vendored). Do it by
hand, in the same response, and never leave a 100 %-complete roadmap in the
active tree because `git mv` failed:

1. `mkdir -p agents/roadmaps/archive`.
2. Move the file — `git mv agents/roadmaps/<x>.md agents/roadmaps/archive/<x>.md`
   in a tracked repo; a plain `mv` if the file is untracked or the repo has no
   commits (`git mv` errors there).
3. Rewrite inbound full-path references `agents/roadmaps/<x>.md` →
   `agents/roadmaps/archive/<x>.md` across the tree — on the working tree, not
   just the git index, when untracked.
4. Regenerate `agents/roadmaps-progress.md`.

## Procedure: Manage a roadmap

1. **Identify need** — Is this a multi-step change that spans sessions or agents?
2. **Create or locate** — Create new roadmap in `agents/roadmaps/` or find existing one.
3. **Update progress** — Mark completed steps with `[x]`, add notes for blockers, then regenerate the dashboard in the same response (enforced by `roadmap-progress-sync`).
4. **Verify** — Confirm all steps reflect current state, no stale information.

A roadmap is a structured `.md` file in `agents/roadmaps/` that describes a multi-step change
(refactoring, feature, migration). It ensures work can be picked up across sessions and by
different agents.

## Roadmap locations

| Location | Scope |
|---|---|
| `agents/roadmaps/` | Project-wide roadmaps |
| `{module_root}/{Module}/{agent_folder}/roadmaps/` | Module-specific roadmaps (see note) |
| `{package-root}/agents/roadmaps/` | Package-specific roadmaps |

**Module path resolution.** `{module_root}` and `{agent_folder}` come from
`modules.root_paths` and `modules.agent_folder` in
`.agent-project-settings.yml` — see [`layered-settings`](../../../../../docs/guidelines/agent-infra/layered-settings.md).
Common shapes:

- Laravel — `app/Modules/{Module}/agents/roadmaps/`
- Symfony bundles — `src/Bundle/{Bundle}/agents/roadmaps/`
- Node / Python / Go monorepo packages — `packages/{Pkg}/agents/roadmaps/`

Use `scripts/_lib/agent_settings.ts::enumerate_modules()` to discover the
actual paths in the current project; never assume `app/Modules/`.

The file `.augment/templates/roadmaps.md` defines the canonical structure.
**Always read it first** before creating or modifying roadmaps.


## Modes

This skill is a router head. The dashboard-sync obligation above, the procedure
skeleton, and the location table are true in every mode and stay here. The
per-mode procedure bodies live in `references/`; load the one the task calls
for, not the set.

| Task | Mode body | Covers |
|---|---|---|
| Author a roadmap — structure and the rules it must satisfy | [`references/authoring.md`](references/authoring.md) | The canonical structure block, checkbox semantics, awaiting-evidence as a blocker entry, phases, quality gates, step granularity, language |
| Create, execute, or resume a roadmap | [`references/lifecycle.md`](references/lifecycle.md) | Creating a roadmap, executing one step by step, resuming a partially-done one |
| Complete, archive, or skip a roadmap | [`references/archival.md`](references/archival.md) | The four end states, the archival sweep and its manual fallback, spawning a follow-up from deferred items, `skipped/` versus `archive/` |
| Regenerate or read the progress dashboard | [`references/dashboard.md`](references/dashboard.md) | The generated dashboard, its regeneration cadence, blockers on the dashboard |

Archival is the mode with the sharpest failure: an archive that buries deferred
work or open blockers is the thing the sweep refuses to do, so load
[`references/archival.md`](references/archival.md) before archiving anything
rather than working from memory of it.

## Rubric pass (optional, surfacing-only)

After producing a roadmap, run
[`judge-artifact-completeness`](../judge-artifact-completeness/SKILL.md)
with rubric `roadmap-score` to surface missing dimensions (risk, tests per
step, migration, maintainability). The score is a recommendation; it never
blocks the roadmap from shipping. Invoke only when the user wants a
completeness check — not on every roadmap creation by default.

## Output format

1. Roadmap file in agents/roadmaps/ with ordered phases and tasks
2. Progress tracking with checkbox status
3. `agents/roadmaps-progress.md` regenerated on every change

## Auto-trigger keywords

- roadmap
- roadmap creation
- phase tracking
- step completion

## Gotcha

- Roadmap files go in `agents/roadmaps/` — don't create them in other directories.
- Don't mark phases complete without running verification (tests, quality checks) — the verify-before-complete rule applies.
- The model tends to skip phases it deems "simple" — every phase must be explicitly completed.
- Auto-archive is allowed when `count_open == 0` AND `count_deferred == 0`. `[-]` cancelled items archive silently (explicit drops). `[~]` deferred items **block** silent archive — they trigger the Iron Law 3 flow (see step 4b).
- `archive/` and `skipped/` are distinct — `archive/` = work happened, `skipped/` = no meaningful work, not pursuing. Create either directory if it doesn't exist.
- Use `git mv` (not `mv`) so history follows the file.

## Do NOT

- Do NOT skip quality gates between steps.
- Do NOT mark steps as done without actually completing them.
- Do NOT modify completed steps (only add notes if needed).
- Do NOT create roadmaps for trivial changes (single-file fixes don't need a roadmap).
- Do NOT commit or push — only local changes.
- Do NOT archive roadmaps with open `[ ]` items without asking the user.
- Do NOT delete roadmaps — always move to `archive/` or `skipped/`.
- Do NOT use `skipped/` as a dumping ground for partially-finished work — that is what `archive/` with deferred items is for.
- Do NOT assign version numbers, git tags, deprecation dates, or release identifiers to phases. Roadmaps plan work; releases and tags are decided by the user separately. Hard rule — see [`scope-control`](../../rules/scope-control.md#git-operations--permission-gated).
- Do NOT propose a branch switch while executing a roadmap. The branch question is settled at creation time; if the user already declined (or you never asked because it wasn't sensible), stay silent. See [`scope-control`](../../rules/scope-control.md#decline--silence--no-re-asking-on-the-same-task).
