# Roadmap Progress Sync

> Any touch to agents/roadmaps/ — create/rename/delete/move, edit checkboxes ([x]/[~]/[-]), add/rename/remove phases — must regenerate dashboard and archive if 0 open items, same response

_Origin: migrated from `.agent-src.uncondensed/rules/roadmap-progress-sync.md` per P4.2 of `road-to-kernel-and-router.md`._

<!-- cloud_safe: degrade -->
<!-- Authoring discipline applies in cloud; local script + regen are no-ops there. -->

# Roadmap Progress Sync

> **Enforced by (defence in depth):**
> 1. [`scripts/roadmap_progress_hook.ts`](../../../src/scripts/roadmap_progress_hook.ts)
>    on Augment + Claude Code (`PostToolUse`) — auto-regen on write.
> 2. `.git/hooks/pre-commit` (installed by `scripts/install-hooks.sh`) —
>    blocks any commit whose staged set touches `agents/roadmaps/` or
>    `agents/roadmaps-progress.md` while the dashboard is stale.
> 3. `task ci` runs `roadmap-progress-check` so a PR cannot land with a
>    stale dashboard even if local hooks were bypassed.
>
> Hook is primary; the prose below is the specification the hook
> implements and the fallback where no hook is bound on the platform.

## Iron Law — dashboard sync

```
ANY ROADMAP TOUCH → REGENERATE THE DASHBOARD, SAME RESPONSE.
NO EXCEPTIONS. NO "I'LL DO IT AT THE END". NO BATCHING ACROSS TURNS.
A ROADMAP NOT IN THE DASHBOARD IS A RULE VIOLATION, NOT AN OVERSIGHT.
```

**Roadmap touch =** create the file, rename it, delete it, move it
between `roadmaps/` ↔ `archive/` ↔ `skipped/`, add/rename/remove a
phase, **OR** flip any checkbox (`[ ]` ↔ `[x]` ↔ `[~]` ↔ `[-]`).

`agents/roadmaps-progress.md` is the read-only dashboard. Every
unsynced edit makes it lie to the next reader. Created a roadmap
without regenerating? The dashboard claims it does not exist. Marked
8 steps `[x]` and forgot the regen? The dashboard says 0 done.

## Iron Law — every active roadmap is trackable

```
EVERY ACTIVE ROADMAP MUST CONTAIN AT LEAST ONE TRACKABLE CHECKBOX
(`- [ ]`) PER NON-INTRO PHASE. ROADMAPS WITHOUT EXECUTABLE STEPS
EITHER GET A CHECKLIST OR THE `status: draft` FLAG.
CI-ENFORCED: `scripts/check_roadmap_trackable.ts` (CANNOT BE DEFERRED).
```

**Active roadmap =** any file in `agents/roadmaps/` (root, not
`archive/` or `skipped/`) without `status: draft` frontmatter.

**Trackable checkbox =** an actionable `- [ ]` line under a `## Phase N`
or `### Phase N` heading (numeric `Phase 1`, roman `Phase II`, or
letter-track `Phase A1` — matched by the dashboard's `PHASE_RE`).
Tables of decisions, ICE matrices, ADR captures, and "block
sequencing" tables are valid **rationale**, but they do not satisfy
this rule on their own — they must be paired with at least one
`## Phase N` section whose checkboxes execute the decision.
Headings such as `## Phase steps`, `### Sequencing — Phase 1 …`,
`### P0 #1 — …`, or `## Block A` do **not** count — only the
canonical `Phase <id>` form parsed by the dashboard.

**CI backstop.** `scripts/check_roadmap_trackable.ts` (package-shipped,
wire into the consumer's pre-commit / pre-push / Actions gate) fails
when an active roadmap has zero canonical `Phase` headings or when
any parsed phase has zero checkboxes. Last line of defence — real-time
authoring still flips checkboxes and regenerates the dashboard the
same response.

## Status — binary `ready` (default) vs `draft`

```yaml
---
status: draft          # hidden from the dashboard until flipped
---
```

Two values, no synonyms. Anything else — no frontmatter at all,
`status: ready`, an unknown value — counts as **ready** and lands
in the dashboard.

- **Ready** is the implicit default. New roadmaps are created
  ready unless the user explicitly says draft. Ready roadmaps are
  listed in the dashboard, count towards open/done totals, and
  trip the "completed but not archived" warning when they close.
- **Draft** hides the file from the dashboard entirely (not
  counted, not listed). Use it while the roadmap is still being
  authored, while waiting for upstream decisions, or as a
  capture-only synthesis that has not yet been promoted to
  executable phases. Flip to ready (or remove the field) the
  moment the roadmap is ready to track.

**Completion = archival, same response.** When the edit takes a
roadmap to `count_open == 0` (every item is `[x]`, `[~]`, or `[-]`),
`git mv` it into `agents/roadmaps/archive/` (or `skipped/` if no `[x]`
at all) **before** regenerating the dashboard. A 100%-complete
roadmap left under `agents/roadmaps/` is a rule violation, not an
optional cleanup. See `roadmap-management` skill for the archive vs
skipped decision table.

## Agent-authored roadmaps — placement is mandatory

```
A FILE THE AGENT DROPS INTO agents/roadmaps/ MUST EITHER
(a) PASS check_roadmap_trackable.ts AND LAND IN THE DASHBOARD, OR
(b) NOT BE IN agents/roadmaps/ AT ALL.
NO "DECISION MATRIX" / "DESIGN NOTE" SHORTCUT.
```

When the agent autonomously creates a roadmap, it owns the placement
in the **same response**:

- **Phase plan** (checkboxes, multi-turn execution) → `agents/roadmaps/<name>.md`, `status: ready` (default), regen dashboard.
- **Decision matrix / ADR / pattern / lookup** (no `Phase N`, durable rationale) → `agents/settings/contexts/<name>.md`.
- **Completed work snapshot** → `agents/roadmaps/archive/<name>.md`.

A non-trackable file in `agents/roadmaps/` is a rule violation — the
trackable CI fails it, the dashboard hides it. The agent that
created it moves it the same response. If the autonomous run also
**finishes** the roadmap within the session (every box `[x]`/`[~]`/`[-]`),
the completion-archival rule above fires too — same response.

## Autonomous execution — checkbox cadence

When executing a roadmap autonomously (multi-turn, no per-step user
prompt), the user loses progress visibility unless checkboxes flip
**as work lands**, not in a batch at the end. Iron Law:

```
EVERY DONE STEP FLIPS [ ] → [x] IN NEXT REPLY THAT ACKNOWLEDGES IT.
NO "I UPDATE ROADMAP AT END OF PHASE."
NO "FOUR STEPS DONE, ONE COMMIT, ONE REGEN."
```

Step counts as completed when:

- Code / docs change for that step has been **written and saved** AND
- Verification cited in the step (project CI command, targeted test, lint) has
  **passed in this response or an earlier one** — fresh output, not memory.

Then in the **same reply**: flip the checkbox, regenerate the
dashboard, commit if commit policy allows.

**Forbidden:** four turns of step work, dashboard flat, single regen at the end.
**Required:** each turn — implement step, flip `[x]`, regen, commit (if policy allows).
A reply that lands a verified step without flipping its checkbox is a rule violation.

**Deterministic flip-guard.** The autonomous loop carries a per-step
guard at [`roadmap-process-loop § 5b`](../../../src/agent-src/contexts/execution/roadmap-process-loop.md#5b-flip-guard--deterministic):
after the atomic flip, the loop runs
`git diff --name-only -- agents/roadmaps/<file>.md` and halts loudly
when the diff is empty. The `command:` triggers on
`roadmap-progress-sync` keep the rule loaded for the entire
`/roadmap:process-*` run; the guard is the deterministic backstop
that catches a forgotten flip per step rather than at run end.

**`[~]` semantics — superseded note:** `[~]` is **not** an "in-progress"
indicator (the earlier in-progress-marker guidance here is superseded by
the glyph table in § Glyph semantics below — kept as the stronger, current
source of truth). Mid-reply work-in-flight has no checkbox change until
the step lands; that's a normal `[ ] → [x]` transition.

## Mechanics — triggers, regen command, self-check, failures

The triggers table, the regen command (`./agent-config roadmap:progress`),
the pre-send self-check, the failure-mode catalog and the `Do NOT` list are
**in this file**; the rule
[`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md) is the
obligation surface.

> **Corrected 2026-08-26.** This pointed at a `rules-auto` mechanics file that
> exists nowhere — a split that never happened, while the content was here.

## Copilot fallback

GitHub Copilot has no `PostToolUse` hook surface, so
`scripts/roadmap_progress_hook.ts` cannot detect roadmap-file writes
structurally. The dashboard at `agents/roadmaps-progress.md` will
not regenerate on its own.

The cooperative path: every time a roadmap touch fires (per the
trigger list in the mechanics context above), the agent regenerates
the dashboard in the same response — which is the same Iron Law the
hook enforces, just executed manually:

```bash
./agent-config roadmap:progress
```

The hook implementation is the specification; on Copilot the agent
runs the regenerator itself after the same triggers fire. Skipping
it is a rule violation, not a hook gap — the Iron Law on dashboard
sync survives the missing hook surface.

## Migrated depth from the `roadmap-progress-sync` rule (per P4)

The sections below carry the long-form body of the
`roadmap-progress-sync` rule; the Iron-Law fences and the mandatory
pre-send self-check stay in the rule itself.

### Iron Law 2 — cadence detail

`/roadmap:process-step`, `/roadmap:process-phase`, `/roadmap:process-full`, and any other multi-step autonomous run flip the box for step N **before** moving on to step N+1. The checkbox itself is the real-time monitor — the markdown file is the source of truth, the dashboard is a derived view.

The `command:` triggers in the rule's frontmatter ensure it loads the moment one of the `/roadmap:process-*` commands is invoked and stays loaded for the whole run — independent of whether the agent is currently editing files under `agents/roadmaps/`. The loop carries its own deterministic flip-guard at `roadmap-process-loop § 5b` — defense-in-depth, not a substitute for the inline flip. (Merged with § Autonomous execution → "Deterministic flip-guard" above, which carries the concrete guard command.)

**Step counts as done** when its code/doc change is written and saved AND the verification cited in the step has passed (fresh output in this reply or an earlier one). (Merged with § Autonomous execution → "Step counts as completed" above — same contract.)

### Glyph semantics — single source of truth

Keep aligned with the dashboard counter in `scripts/update_roadmap_progress.ts` (regenerated via `./agent-config roadmap:progress`) and the closure-table in the `roadmap-management` skill:

| Glyph | Meaning | Counts towards |
|---|---|---|
| `[ ]` | open — planned, not yet done | `count_open` |
| `[x]` | done — work landed + verified | `count_done` |
| `[~]` | deferred — planned but not happening **this** run; resolution required before archive (Iron Law 3) | `count_deferred` |
| `[-]` | cancelled — scope dropped, won't happen at all | `count_cancelled` |

`[~]` is **not** an "in-progress" indicator. Mid-reply work-in-flight has no checkbox change until the step lands; that's a normal `[ ] → [x]` transition.

#### `guarded-baseline` — a sub-state of `[ ]`, never a fifth glyph

See [`guarded-baseline`](guarded-baseline.md).

**Dashboard regen cadence — opt-in batching.** The checkbox flip is non-batchable. The **subprocess regen** (`./agent-config roadmap:progress`) is batchable per `roadmap.dashboard_regen_cadence` in `.agent-settings.yml` (`every_5_steps` default · `per_step` · `phase_boundary`). Run end, phase boundary, and any file-shape touch (rename / phase add / archive — Iron Law 1) always force an immediate regen regardless of cadence.

**Blockers follow the same cadence as checkboxes.** Clearing a `## Blockers` entry (per `templates/roadmaps.md` rule 20) flips its `Status: resolved` and regenerates the dashboard in the same reply — Iron Law 1's "same response" obligation applies to blocker resolution exactly as it applies to a checkbox flip.

### Iron Law 3 — deferred-resolution flow

When the closure check fires (`count_open == 0` and `count_deferred > 0`), the agent MUST:

1. Enumerate every `[~]` step in the roadmap (phase + step text + any inline `<!-- deferred: ... -->` annotation).
2. Present numbered options (per the `user-interaction` rule) — at minimum:
   1. **Follow-up roadmap (draft)** — spawn `agents/roadmaps/road-to-<slug>.md` with `status: draft` frontmatter, `parent_roadmap: <this-slug>`, and the deferred steps lifted verbatim into phases. Draft stays hidden from the dashboard until the user flips it to `ready`.
   2. **Follow-up roadmap (ready, blocked)** — spawn the file with `status: ready` (default), frontmatter `parent_roadmap: <this-slug>` plus a body note (`> Blocked until <condition>`) so the dashboard surfaces it but execution waits.
   3. **Keep in this archive** — confirm the deferred items stay searchable in the archived file; no follow-up roadmap. Choosing this records an explicit decision-to-drop in the same reply.
   4. **Restore selected items to `[ ]`** — finish them in this roadmap before archive.
   5. **Convert selected items to `[-]` cancelled** — drop them with rationale recorded inline.
3. Route by the **preservation test** — full table, recording contract and residual limit in [`roadmap-progress-sync § Who resolves it`](../../../src/rules/roadmap-progress-sync.md). In one line: options 1, 2, 4 keep the item alive → council; 3 and 5 drop or weaken it → user, always; in doubt, user.
4. Only after the deferrals are resolved does the `git mv` to `archive/` run. The dashboard regen happens after the resolution, not before.

The migration mechanics (file naming, frontmatter pattern, body shape, parent-back-link) live in `roadmap-management § Spawn follow-up from deferred items`. The rule owns the obligation; the skill owns the procedure.

### Later disposition — detail

`later/` is the fourth disposition alongside `archive/` (done, none planned) and `skipped/` (won't pursue): open work remains but is blocked-for-later. Set frontmatter `status: later` + a `Blocked until` / `Trigger` resume line, `git mv` to `agents/roadmaps/later/`, migrate inbound `agents/roadmaps/<x>.md` refs to the new path, regen. Open `[ ]` items stay open — the roadmap is parked whole, not cancelled or deferred-item-by-item. `later/` is excluded from the dashboard and `/roadmap:process-*` (same as `archive/`/`skipped/`); the `lint_roadmap_later_disposition` guard enforces the `status: later` ⇔ `later/` placement contract and that every parked roadmap records a resume condition. Procedure + the Active-vs-Later test live in the `roadmap-management` skill.

### PR-gate — detail

A roadmap that reaches `count_open == 0 && count_deferred == 0` is **complete**
and is archived **in the same PR that completes it** — deterministically, by a
script, before the PR exists. There is no "hold the last item open + archive
manually after merge" step (that step got forgotten and left finished roadmaps
rotting unarchived in the trunk — the exact failure this gate makes impossible).

The sweep — `scripts/archive_completed_roadmaps.ts`, invoked by
`/create-pr` § 1c — archives every roadmap that is
complete **and** touched in this branch (`git log origin/main..HEAD`), `git mv`s
it to `archive/`, migrates inbound `agents/roadmaps/<x>.md` references to the
archive path in the **same branch** (so links never break — this was the only
real reason the old design deferred archival), regenerates the dashboard, and
stages it. Completion is read from the checkbox counts; no marker is required.

**Backstop:** `./agent-config roadmap:progress-check` (wrapping `update_roadmap_progress.ts --check`) hard-fails when a roadmap
hits `count_open == 0` while still under `agents/roadmaps/`. Because
`/create-pr` archives before the push, the PR branch is green; a push that
bypasses the sweep red-flags in CI — the forcing function that makes
"finished roadmap left unarchived in the trunk" structurally impossible. Legacy
`merge-gated` annotations are archived by the next `/create-pr` like any other
completed roadmap; the dashboard still surfaces any stranded
complete-but-unarchived roadmap so it can never hide inside a partial progress bar.
