# roadmap-management — completing, archiving, skipping

> Mode body of the [`roadmap-management`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

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

0. **Completion review (Gate R2)** — last open item done → findings BEFORE
   fixes, before any archival decision:
   - `dispatch_r2_reviewer` builds the reviewer input; a **fresh subagent
     without the implementation context** writes
     `agents/evidence/reviews/<slug>.findings.md`.
   - Work findings in priority order — each ends `fixed` / `accepted-risk` /
     `deferred`. No code surface → explicit skip, never silent.
   - Grammar, scope-hash binding, escape hatch:
     [`plan-review-gates § 2`](../../../../docs/contracts/plan-review-gates.md).

1. **Scan the file** for all checkbox markers: `- [x]`, `- [ ]`, `- [~]`, `- [-]`.
2. **Classify:**
   - `[x]` = completed
   - `[ ]` = open (not done)
   - `[~]` = deferred (intentionally pushed out, may come back)
   - `[-]` = cancelled (individual item dropped)

3. **Decision rule — `count_open == 0` means the roadmap has no active
   work left. `[x]`, `[-]` are final states. `[~]` deferred items
   block silent closure — they carry plans the user has not consented
   to drop (enforced by [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
   Iron Law 3).**

   | count_x | count_open | count_deferred | count_cancelled | Action |
   |---|---|---|---|---|
   | ≥ 1 | 0 | 0 | 0 | **Auto-archive** (silent) — pure completion |
   | ≥ 1 | 0 | 0 | ≥ 1 | **Auto-archive** (silent) — done with explicit drops |
   | ≥ 1 | 0 | ≥ 1 | ≥ 0 | **STOP — Iron Law 3 flow.** Surface deferred items, present the options, resolve by the preservation test (council where the item survives, user where it does not). See step 4b. |
   | 0 | 0 | ≥ 1 | ≥ 0 | **STOP — Iron Law 3 flow.** Was this a scope-drop or deferred-to-later? Same options and same routing as 4b. |
   | 0 | 0 | 0 | ≥ 1 | **Auto-skip** (silent) — no work, all cancelled |
   | ≥ 0 | ≥ 1 | ≥ 0 | ≥ 0 | **Ask the user** — open work remains (step 4a) |

   Show on auto-move:

   - Archive: `✅  Roadmap archived → agents/roadmaps/archive/{filename}`
   - Skip:    `⏭️  Roadmap skipped → agents/roadmaps/skipped/{filename}`
   - Later:   `🕒  Roadmap parked for later → agents/roadmaps/later/{filename}`

   `[-]` cancelled items remain searchable inside the archived file —
   they were explicit drops. `[~]` deferred items, by contrast, may
   not silently follow the file into archive: they represent work the
   user planned and would lose track of. Step 4b is the gate.

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

   Option 4 is only appropriate when `count_x == 0` or the completed items were
   trivial (e.g. prerequisites only). If the user picks 4 despite meaningful work
   being done, confirm once — archive is usually the right choice. Picking option 3
   does NOT archive immediately — it converts open → deferred and re-enters the
   `count_deferred > 0` branch, which runs step 4b.

   **Option 5 (Later) is the right choice when the open items are real but
   cannot proceed now** — gated on an external trigger or a decision. Set the
   roadmap's frontmatter `status: later`, ensure it carries a `Blocked until` /
   `Trigger` resume line, `git mv` it to `agents/roadmaps/later/`, migrate any
   inbound references to the new path, and regenerate the dashboard. The open
   `[ ]` items stay open (they are not cancelled or deferred) — the roadmap is
   parked whole, ready to resume when the trigger fires. **Roadmaps with open
   tasks deferred for later are always moved to `later/`**, never left to rot in
   the active tree.

4b. **Deferred items present (`count_deferred ≥ 1`, `count_open == 0`)** — Iron Law 3 flow.
   Archive **blocked** until resolved. WHO resolves is the preservation test in
   [`roadmap-progress-sync § Who resolves it`](../../rules/roadmap-progress-sync.md),
   never the mode — same menu either way, only the resolver differs:

   - **1, 2, 4** keep the item alive → **council**, recorded at the item (2 only
     if the follow-up lands in the SAME change).
   - **3, 5** drop or weaken it → **user**, always. In doubt: user.

   ```
   📋 Roadmap closure check — deferred items must resolve before archive:

     ✅  Completed: {count_x}
     ⏭️  Deferred:  {count_deferred}
     {for each deferred item:}
       - Phase {N}: {step text}  {<!-- deferred: <annotation> --> if present}

   These items carry plans you would lose to a silent archive.

   > 1. Spawn follow-up roadmap as DRAFT
   >    → agents/roadmaps/road-to-{auto-slug}.md, status: draft,
   >      parent_roadmap: {this-slug}. Hidden from the dashboard until
   >      you flip status to "ready".
   > 2. Spawn follow-up roadmap as READY (with blocked-until note)
   >    → status: ready (default), parent_roadmap: {this-slug}, plus
   >      a `> Blocked until <condition>` line in the body. Visible
   >      in the dashboard; execution waits on the condition.
   > 3. Keep deferred items in this archive — confirm "no follow-up"
   >    is an intentional drop. Items stay searchable in archive/.
   > 4. Restore selected items to [ ] — finish them here before archive.
   > 5. Convert selected items to [-] cancelled — drop with rationale.
   ```

   Picks 1 or 2 → see "Spawn follow-up from deferred items" procedure below.
   Picks 3, 4, or 5 → apply the change in this roadmap; re-evaluate the
   decision table; archive when the gate clears.

### Spawn follow-up from deferred items (procedure)

When the user picks option 1 or 2 in step 4b:

1. **Derive the slug.** Default `<parent-slug>-followup` (e.g.
   `road-to-x.md` → `road-to-x-followup.md`). If a user-supplied
   slug was given in the picker, use that. Avoid collisions with
   `agents/roadmaps/` (active + `archive/` + `skipped/`).

2. **Write the new file** at `agents/roadmaps/<slug>.md`:

   ```markdown
   ---
   complexity: lightweight            # bump if the parent was structural
   status: draft                      # option 1; omit for option 2 (= ready)
   parent_roadmap: <parent-slug>      # back-link to source
   ---

   # Roadmap: Follow-up to <parent-title>

   > <One sentence stating the carried-over outcome.>

   ## Context

   This roadmap collects items deferred from
   [`agents/roadmaps/archive/<parent-slug>.md`](archive/<parent-slug>.md).
   See the parent's archive entry for the original rationale.

   ## Prerequisites

   - [ ] Read `AGENTS.md` and the parent archive entry.
   {parent prerequisites still relevant, copied verbatim}

   <!-- Option 2 only — body note, NOT a frontmatter key: -->
   > Blocked until <condition>. Execution starts when the condition clears.

   ## Phase 1: <name carried from parent>

   - [ ] {deferred step text, copied verbatim with parent-phase pointer}
   {repeat per deferred item, regrouped by parent phase}

   ## Acceptance Criteria

   - [ ] {restate or adjust per the deferred scope}
   - [ ] All quality gates pass — see `quality-tools`.
   ```

3. **In the parent roadmap** (still in the working tree), append a
   line at the bottom (above any final `---`):

   ```
   <!-- Deferred items migrated to agents/roadmaps/<followup-slug>.md on YYYY-MM-DD -->
   ```

   Do **not** delete the `[~]` lines — keep them visible in the
   archived parent so the trail stays grep-able. The follow-up
   carries forward the executable copy.

4. **Regenerate the dashboard.** The follow-up appears (draft hidden,
   ready visible) and the parent — once moved — drops off.

5. **Archive the parent** (`git mv` → `archive/`) and regen one
   more time per [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
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

