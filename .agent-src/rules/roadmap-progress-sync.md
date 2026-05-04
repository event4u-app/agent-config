---
type: "auto"
tier: "1"
description: "Any touch to agents/roadmaps/ — create/rename/delete/move, edit checkboxes ([x]/[~]/[-]), add/rename/remove phases — must regenerate dashboard and archive if 0 open items, same response"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/roadmap-progress-sync-mechanics.md
---

<!-- cloud_safe: degrade -->
<!-- Authoring discipline applies in cloud; local script + regen are no-ops there. -->

# Roadmap Progress Sync

> **Enforced by:** [`scripts/roadmap_progress_hook.py`](../../scripts/roadmap_progress_hook.py)
> on Augment + Claude Code (`PostToolUse`). Hook is primary; the prose
> below is the specification the hook implements and the fallback when
> the platform has no hook surface.

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
CI-ENFORCED: `scripts/check_roadmap_trackable.py` (CANNOT BE DEFERRED).
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

**CI backstop.** `scripts/check_roadmap_trackable.py` (package-shipped,
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
(a) PASS check_roadmap_trackable.py AND LAND IN THE DASHBOARD, OR
(b) NOT BE IN agents/roadmaps/ AT ALL.
NO "DECISION MATRIX" / "DESIGN NOTE" SHORTCUT.
```

When the agent autonomously creates a roadmap, it owns the placement
in the **same response**:

- **Phase plan** (checkboxes, multi-turn execution) → `agents/roadmaps/<name>.md`, `status: ready` (default), regen dashboard.
- **Decision matrix / ADR / pattern / lookup** (no `Phase N`, durable rationale) → `agents/contexts/<name>.md`.
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

**In-progress marker:** when a step takes more than one reply,
mark it `[~]` the moment work starts on it and regenerate. The
user sees one row move from `[ ]` to `[~]` to `[x]` instead of
silent rows. `[~]` is treated as open for `count_open` but moves
the phase percentage forward in the dashboard.

## Mechanics — triggers, regen command, self-check, failures

The triggers table, the regen command (`./agent-config roadmap:progress`),
the mandatory pre-send self-check, the failure-mode catalog, and the
`Do NOT` list live in
[`contexts/communication/rules-auto/roadmap-progress-sync-mechanics.md`](../contexts/communication/rules-auto/roadmap-progress-sync-mechanics.md).
Pull it whenever a trigger fires — the rule above is the obligation
surface; the mechanics file is the lookup material.

## Copilot fallback

GitHub Copilot has no `PostToolUse` hook surface, so
`scripts/roadmap_progress_hook.py` cannot detect roadmap-file writes
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
