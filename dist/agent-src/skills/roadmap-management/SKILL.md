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

Robust path: `archive_completed_roadmaps --all` — detects complete
(`count_open == 0`, `count_deferred == 0`), moves to `agents/roadmaps/archive/`
(`git mv` tracked, plain `mv` untracked / no-commit), rewrites inbound refs,
regens dashboard. PR-independent.

**Manual fallback (script not vendored)** — same response, never leave a
100 %-complete roadmap active because `git mv` failed:

1. `mkdir -p agents/roadmaps/archive`.
2. `git mv agents/roadmaps/<x>.md agents/roadmaps/archive/<x>.md` (tracked); plain
   `mv` if untracked / no commits.
3. Rewrite inbound `agents/roadmaps/<x>.md` → `agents/roadmaps/archive/<x>.md`
   across the tree (working tree, not just index, when untracked).
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

Use `scripts/_lib/agent_settings.py::enumerate_modules()` to discover the
actual paths in the current project; never assume `app/Modules/`.

The file `.augment/templates/roadmaps.md` defines the canonical structure.
**Always read it first** before creating or modifying roadmaps.

## Roadmap structure

Every roadmap follows this structure:

```markdown
# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets.}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass — the project's type-checker, auto-fixer, linter, and full test suite (see the `quality-tools` skill for stack-specific invocations)

## Notes

{Edge cases, decisions, links}
```

## Key rules for roadmaps

### Checkboxes — mandatory, not decorative

- **Every active roadmap MUST contain at least one `- [ ]` per non-intro phase.** Decision tables, ICE matrices, and block-sequencing tables are valid rationale, but they do not satisfy this rule on their own — pair them with a `## Phase N` or `## Implementation Checklist` section whose checkboxes execute the decision. A roadmap without checkboxes is invisible to `agents/roadmaps-progress.md` and violates [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) Iron Law #2.
- Every actionable step uses `- [ ]` (unchecked) or `- [x]` (completed).
- Mark steps as `[x]` immediately after completing them.
- Never remove completed steps — they serve as history.
- **Status is binary: `ready` (default, implicit) or `draft`.** New roadmaps are created **ready** unless the user explicitly says otherwise — `ready` is implicit and need not be written. A roadmap that is still being authored, awaiting upstream decisions, or capturing options without a worked plan declares `status: draft` in YAML frontmatter at the top of the file. Drafts are hidden from `agents/roadmaps-progress.md` until the flag is removed or flipped to `ready`. There are no other status values; legacy banners (`**Status: directional**`, `Status: capture-only`, `mode: feedback`) are removed.

### Phases

- Group related steps into phases (e.g. "Preparation", "Migration", "Cleanup").
- Complete one phase before starting the next (unless steps are independent).
- After completing a phase, summarize what was done.

### Quality gates

Every roadmap implicitly includes the project's quality pipeline
(static analysis, autofixes, tests). What's configurable is **when**
the pipeline runs during `/roadmap:process-step|phase|full`,
controlled by `roadmap.quality_cadence` in `.agent-settings.yml`:

| Cadence | Pipeline runs | Trade-off |
|---|---|---|
| `end_of_roadmap` (default) | Once before archiving | Fastest, fewest tokens; errors compound across phases |
| `per_phase` | After every completed phase + final | Balanced; catches drift at phase boundaries |
| `per_step` | After every completed step + final | Legacy verbose; highest token cost |

The default is `end_of_roadmap` because most steps are checkbox-only
content edits and a final pipeline run is the cheapest way to satisfy
`verify-before-complete`. Switch to `per_phase` for risky migrations or
unfamiliar codebases.

**Always-on, regardless of cadence:**

- Step checkboxes flip `[ ] → [x]` and the dashboard regenerates **same
  response** (enforced by `roadmap-progress-sync`).
- Before any "roadmap complete" claim or archival, the pipeline runs
  fresh (enforced by `verify-before-complete`).

### Step granularity

- Each step should be completable in one session (< 1 hour of work).
- If a step is too large, break it down into sub-steps.
- Steps should reference specific files/classes when possible.

### Language

- Roadmap files are written in **English** (per project convention).
- Step descriptions should be precise and actionable, not vague.

## Working with roadmaps

### Creating a roadmap

1. Ask the user for goal, context-create, and phases.
2. Use the template structure from `.augment/templates/roadmaps.md`.
3. Review with the user iteratively until approved.
4. **Branch & release questions — at most once, only if genuinely useful.**
   Default: stay on the current branch, no version numbers in the
   roadmap. Only propose a separate branch when there is concrete,
   evidence-based reason (e.g. risky migration benefits from a spike).
   Never include release versions, deprecation dates, or git tags in
   the roadmap text. If the user declines, do **not** re-propose during
   `/roadmap:process-*`. Decline = silence. See [`scope-control`](../../rules/scope-control.md#decline--silence--no-re-asking-on-the-same-task).
5. Save with a kebab-case filename (e.g. `optimize-webhook-jobs.md`).
   **Before writing**, scan the entire roadmap namespace for a
   collision — active, `archive/`, `skipped/`, and nested subdirs —
   with `find agents/roadmaps -type f -iname "<name>.md"`. If any
   hit comes back, stop and ask the user to rename, open the
   existing file, or abort. Never silently overwrite an archived
   or skipped roadmap. Detailed prompt in
   [`commands/roadmap/create.md`](../../commands/roadmap/create.md)
   step 6.
6. Regenerate the dashboard so the new roadmap is included.

### Executing a roadmap

1. Read the full roadmap.
2. Find the next unchecked step (`- [ ]`).
3. Summarize what needs to be done.
4. Ask the user before implementing (numbered options: implement / adjust / skip).
5. After implementation: mark `[x]`, run quality gates, then regenerate the dashboard.
6. Move to the next step.

### Resuming a roadmap

When picking up a roadmap in a new session:
1. Read the roadmap to understand the full context.
2. Check which steps are already completed (`[x]`).
3. Summarize progress to the user.
4. Continue from the next open step.

### Completing, archiving & skipping a roadmap

Every roadmap ends in exactly one of four states:

| State | Folder | Trigger |
|---|---|---|
| **Active** | `agents/roadmaps/` | Work in progress or planned **and workable now** |
| **Archived** | `agents/roadmaps/archive/` | Work was done (fully or partially) and no more work is planned |
| **Skipped** | `agents/roadmaps/skipped/` | Decision against pursuit — superseded, scope rejected, wrong direction. Typically **0 items `[x]`** |
| **Later** | `agents/roadmaps/later/` | Open work remains but is **blocked-for-later** — gated on an external trigger or a decision, **will resume** when unblocked. Set frontmatter `status: later` + a `Blocked until` / `Trigger` resume line. Excluded from the dashboard and `/roadmap:process-*` (parked, not abandoned). |

**Active vs. Later — the test:** can the agent make progress on this roadmap *now*, autonomously? If every open item is gated on something outside this roadmap (a real consumer repo, a benchmark re-open, host-model access, a kernel soak, a pruning track, a human decision), it is **not** active — move it to `later/` with its resume condition. A blocked roadmap left in the active tree silently lies to the dashboard and to `/roadmap:process-*`, which will keep trying to execute it. The `lint_roadmap_later_disposition` guard enforces the placement↔`status: later` contract.

After the last step of a roadmap is done, check completion status:

1. **Scan the file** for all checkbox markers: `- [x]`, `- [ ]`, `- [~]`, `- [-]`.
2. **Classify:**
   - `[x]` = completed
   - `[ ]` = open (not done)
   - `[~]` = deferred (intentionally pushed out, may come back)
   - `[-]` = cancelled (individual item dropped)

3. **Decision rule — `count_open == 0` means the roadmap has no active
   work left. `[x]`, `[-]` are final states. `[~]` deferred items
   block silent closure — they carry plans user has not consented to drop
   (enforced by [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
   Iron Law 3).**

   | count_x | count_open | count_deferred | count_cancelled | Action |
   |---|---|---|---|---|
   | ≥ 1 | 0 | 0 | 0 | **Auto-archive** (silent) — pure completion |
   | ≥ 1 | 0 | 0 | ≥ 1 | **Auto-archive** (silent) — done with explicit drops |
   | ≥ 1 | 0 | ≥ 1 | ≥ 0 | **STOP — Iron Law 3 flow.** Surface deferred items, present follow-up options, wait. Step 4b. |
   | 0 | 0 | ≥ 1 | ≥ 0 | **STOP — Iron Law 3 flow.** Scope-drop or deferred-to-later? Same options as 4b. |
   | 0 | 0 | 0 | ≥ 1 | **Auto-skip** (silent) — no work, all cancelled |
   | ≥ 0 | ≥ 1 | ≥ 0 | ≥ 0 | **Ask the user** — open work remains (step 4a) |

   Show on auto-move:

   - Archive: `✅  Roadmap archived → agents/roadmaps/archive/{filename}`
   - Skip:    `⏭️  Roadmap skipped → agents/roadmaps/skipped/{filename}`
   - Later:   `🕒  Roadmap parked for later → agents/roadmaps/later/{filename}`

   `[-]` cancelled items remain searchable in archived file — they were
   explicit drops. `[~]` deferred items, by contrast, may not silently
   follow file into archive: they represent work user planned and would
   lose track of. Step 4b is the gate.

4a. **Open items remain (`count_open ≥ 1`)** → **Ask the user.** Show what's incomplete:

   ```
   📋 Roadmap completion check:

     ✅  Completed: {count_x}
     ⬜  Open:      {count_open}  — {list of open items, 1 line each}
     ⏭️  Deferred:  {count_deferred}  — {list of deferred items, 1 line each}
     ❌  Cancelled: {count_cancelled} — {list of cancelled items, 1 line each}

   > 1. Archive — mark open items as cancelled [-] and archive now
   > 2. Keep active — I want to finish the open items
   > 3. Mark open items as deferred [~] and archive (triggers Iron Law 3 flow)
   > 4. Skip — move to skipped/ (no meaningful work done, not pursuing)
   > 5. Later — park in later/ (open work is blocked on an external trigger / decision but will resume)
   ```

   Option 4 only appropriate when `count_x == 0` or completed items were
   trivial (e.g. prerequisites). If user picks 4 despite meaningful work
   done, confirm once — archive usually right. Picking option 3 does
   NOT archive immediately — converts open → deferred, re-enters the
   `count_deferred > 0` branch, which runs step 4b.

   **Option 5 (Later) — right when open items are real but cannot proceed
   now** (gated on an external trigger or a decision). Set frontmatter
   `status: later`, ensure a `Blocked until` / `Trigger` resume line, `git mv`
   to `agents/roadmaps/later/`, migrate inbound refs to the new path, regen.
   Open `[ ]` items stay open (not cancelled/deferred) — parked whole, ready to
   resume when the trigger fires. **Roadmaps with open tasks deferred for later
   are always moved to `later/`**, never left to rot in the active tree.

4b. **Deferred items present (`count_deferred ≥ 1`, `count_open == 0`)** — Iron Law 3 flow.
   Archive **blocked** until user resolves deferrals. Surface plan and ask:

   ```
   📋 Roadmap closure check — deferred items must resolve before archive:

     ✅  Completed: {count_x}
     ⏭️  Deferred:  {count_deferred}
     {for each deferred item:}
       - Phase {N}: {step text}  {<!-- deferred: <annotation> --> if present}

   These items carry plans you would lose to a silent archive.

   > 1. Spawn follow-up roadmap as DRAFT
   >    → agents/roadmaps/road-to-{auto-slug}.md, status: draft,
   >      parent_roadmap: {this-slug}. Hidden from dashboard until you
   >      flip status to "ready".
   > 2. Spawn follow-up roadmap as READY (with blocked-until note)
   >    → status: ready (default), parent_roadmap: {this-slug}, plus
   >      `> Blocked until <condition>` line in body. Visible in
   >      dashboard; execution waits on condition.
   > 3. Keep deferred items in this archive — confirm "no follow-up"
   >    intentional drop. Items stay searchable in archive/.
   > 4. Restore selected items to [ ] — finish them here before archive.
   > 5. Convert selected items to [-] cancelled — drop with rationale.
   ```

   Picks 1 or 2 → see "Spawn follow-up from deferred items" below.
   Picks 3, 4, or 5 → apply the change in this roadmap; re-evaluate
   the decision table; archive when gate clears.

### Spawn follow-up from deferred items (procedure)

When user picks option 1 or 2 in step 4b:

1. **Derive slug.** Default `<parent-slug>-followup` (e.g. `road-to-x.md`
   → `road-to-x-followup.md`). User-supplied slug in picker → use that.
   Avoid collisions with `agents/roadmaps/` (active + `archive/` + `skipped/`).

2. **Write new file** at `agents/roadmaps/<slug>.md`:

   ```markdown
   ---
   complexity: lightweight            # bump if parent was structural
   status: draft                      # option 1; omit for option 2 (= ready)
   parent_roadmap: <parent-slug>      # back-link to source
   ---

   # Roadmap: Follow-up to <parent-title>

   > <One sentence stating carried-over outcome.>

   ## Context

   This roadmap collects items deferred from
   [`agents/roadmaps/archive/<parent-slug>.md`](archive/<parent-slug>.md).
   See parent's archive entry for original rationale.

   ## Prerequisites

   - [ ] Read `AGENTS.md` and parent archive entry.
   {parent prerequisites still relevant, copied verbatim}

   <!-- Option 2 only — body note, NOT a frontmatter key: -->
   > Blocked until <condition>. Execution starts when condition clears.

   ## Phase 1: <name carried from parent>

   - [ ] {deferred step text, copied verbatim with parent-phase pointer}
   {repeat per deferred item, regrouped by parent phase}

   ## Acceptance Criteria

   - [ ] {restate or adjust per deferred scope}
   - [ ] All quality gates pass — see `quality-tools`.
   ```

3. **In parent roadmap** (still in working tree), append a line at
   bottom (above any final `---`):

   ```
   <!-- Deferred items migrated to agents/roadmaps/<followup-slug>.md on YYYY-MM-DD -->
   ```

   Do **not** delete `[~]` lines — keep visible in archived parent so
   trail stays grep-able. Follow-up carries forward executable copy.

4. **Regenerate dashboard.** Follow-up appears (draft hidden, ready
   visible) and parent — once moved — drops off.

5. **Archive parent** (`git mv` → `archive/`) and regen one more time
   per [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
   Iron Laws 1 + 3.

5. **Move the file** with `git mv` so history is preserved:

   ```bash
   # Archive (work was done)
   git mv agents/roadmaps/{file} agents/roadmaps/archive/{file}

   # Skipped (not pursuing)
   git mv agents/roadmaps/{file} agents/roadmaps/skipped/{file}
   ```

6. **Regenerate the dashboard** (see "Command" below). The moved roadmap is
   excluded from the active set once it sits in `archive/` or `skipped/`.

### When to use `skipped/` vs `archive/`

| Situation | Destination |
|---|---|
| Finished all phases | `archive/` |
| Finished some phases, rest deferred/cancelled on purpose | `archive/` |
| Whole roadmap deferred or cancelled (no `[x]` at all) | `skipped/` |
| Never started, scope decision reversed | `skipped/` |
| Superseded by another roadmap | `skipped/` — add a pointer line at the top: `> Superseded by agents/roadmaps/{other}.md` |
| Research proved the direction wrong | `skipped/` — add a 1-line reason at the top |

If in doubt: archive beats skipped. `skipped/` is reserved for roadmaps where
no meaningful work was invested and the scope itself was rejected.

## Progress dashboard — `agents/roadmaps-progress.md`

A generated dashboard aggregates progress across every open roadmap. It sits at
`agents/roadmaps-progress.md` (outside `roadmaps/` to keep the folder clean) and
is rewritten by `.augment/scripts/update_roadmap_progress.ts`.

**Always regenerate in the SAME response** after any of the following
(enforced by [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)):

- Creating a new roadmap (`/roadmap:create`)
- Marking a step `[x]`, `[~]`, or `[-]` during `/roadmap:process-*`
- Archiving or moving a roadmap to `skipped/`
- Adding, renaming, or removing a phase

Command:

```bash
./agent-config roadmap:progress           # rewrite the dashboard
./agent-config roadmap:progress-check     # CI: fail if stale
```

The `./agent-config` wrapper lives in the project root (written by the
package installer, gitignored) and delegates to the master CLI inside
`node_modules/@event4u/agent-config/` or `vendor/event4u/agent-config/`.
No global tooling required.

The dashboard is a **read-only snapshot**. Do not edit it by hand — regenerate it.

## Rubric pass (optional, surfacing-only)

After producing roadmap, run [`judge-artifact-completeness`](../judge-artifact-completeness/SKILL.md) with rubric `roadmap-score` to surface missing dimensions (risk, tests, migration, maintainability). Score is a recommendation; never blocks shipping. Invoke only when user wants completeness check — not by default.

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
