---
model_tier: high
name: roadmap-triage-parked
pack: product-basic
visibility: internal
cluster: roadmap
sub: triage-parked
skills: [roadmap-management, roadmap-writing, decision-review, agent-docs-writing]
description: Drain later/ and skipped/ — verify each parked roadmap against the current tree, run its resume condition, then promote, absorb, archive, or re-park it with a fresh reason.
argument-hint: "[<file> | later | skipped | all] [--batch <n>] [--triage-only]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /roadmap:triage-parked name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:triage-parked

Drain sub of the [`/roadmap`](../roadmap.md) cluster. `later/` and `skipped/`
are excluded from the dashboard and from every `/roadmap:process-*` run, so
nothing ever looks at them again unless asked. A parked roadmap is a **frozen
claim about a tree that has since moved**: its resume condition may have fired
weeks ago, its open steps may have shipped under another roadmap, its skip
reason may no longer hold. This command re-reads them against the current tree
and gives every file a decision, so the two folders shrink instead of rotting.

It is the [`/analyze:inbox`](../analyze/inbox.md) discipline applied to the
roadmap estate's own back room: verify every claim, prefer "already shipped" as
the most valuable finding, and never let a file leave the run without a named
disposition.

## The Iron Law

```
A PARKED ROADMAP IS A CLAIM, NOT A FACT. VERIFY ITS OPEN STEPS AND EXECUTE ITS
RESUME CONDITION AGAINST THE CURRENT TREE BEFORE DECIDING ANYTHING.
"ALREADY SHIPPED" IS THE MOST VALUABLE FINDING — MARK IT [x] WITH A file:line.
EVERY FILE IN SCOPE LEAVES THE RUN WITH EXACTLY ONE OF FIVE DISPOSITIONS.
RE-PARKING WITHOUT A REFRESHED, CHECKABLE REASON IS NOT A DISPOSITION.
NEVER DELETE A ROADMAP. NEVER DROP AN OPEN OR DEFERRED STEP SILENTLY.
NEVER WRITE [-] — CANCELLING A STEP IS OWNER-RESERVED. "OBSOLETE" IS A
FINDING THE OWNER RULES ON, NOT A CANCELLATION THE AGENT APPLIES.
AN OWNER-RESERVED BLOCKER STAYS OWNER-RESERVED — PROMOTION NEVER LIFTS IT.
REVIVING A skipped/ ROADMAP REOPENS A RECORDED DECISION — COUNCIL FIRST.
```

## Argument

| Given | Scope |
|---|---|
| a file path | that roadmap only |
| `later` | every roadmap in `agents/roadmaps/later/` |
| `skipped` | every roadmap in `agents/roadmaps/skipped/` |
| `all` or nothing | both folders |

`README.md` is never in scope. `--batch <n>` caps the deep pass (default **15**
files per run); the cheap inventory in Phase 1 always covers the whole scope.
`--triage-only` stops after Phase 2 — the table, no edits.

> The batch default of 15 is a **stated default, not a measured optimum**.
> *Revisit-if:* a run reports files past the cap that the inventory had already
> classified as trivial (too low), or a run's verification column filling with
> `unverifiable` towards its end (too high — reading degraded).

## Where the work happens

Runs in the checked-out branch, like `/analyze:inbox`. Its output is roadmap
edits and `git mv`s — no generated tree, nothing to isolate. A worktree, a
branch, a commit or a PR only on an explicit ask
([`scope-control`](../../rules/scope-control.md) § Git operations,
[`commit-policy`](../../rules/commit-policy.md)).

## Instructions

### 1. Live screen and inventory — cheap, every file in scope

Read live state first, never the dashboard or an earlier screen:

```bash
agent-config roadmap:context
```

Then one row per file, from commands, not from reading:

| file | folder | `[x]` | `[ ]` | `[~]` | `[-]` | parked since | resume condition | blockers | skip reason |

- **Checkbox counts** — `grep -cE '^\s*[-*] \[x\]'` and siblings, per marker.
  A grep also counts boxes inside fenced code blocks; where a count looks off,
  trust the dashboard parser (`collect()` in the progress generator) over it.
- **Parked since** — the date the file first appeared in its folder:
  `git log --diff-filter=A --format=%ad --date=short -- <path> | tail -1`.
  Age is a finding: a file parked eleven days ago and one parked two hundred
  days ago are not the same decision.
- **Resume condition** — the `entry_condition:` mapping (`what` / `when` /
  `who`) or a `Blocked until` / `Resume when` line, quoted verbatim. Absent on a
  `later/` file is itself a defect, recorded in the row.
- **Blockers** — every `### blocker: <slug>` with its `Status:` and
  `Resolved when`.
- **Skip reason** — for `skipped/`, the top-of-file reason or
  `> Superseded by …` pointer, quoted.

A table with fewer rows than the scope has files is the first finding of the run.

### 2. Triage — first-impression disposition, all files

Add a `candidate` column to the inventory. Most files settle here cheaply:

- **Zero open, zero deferred** (`[ ]` = 0, `[~]` = 0) → `archive` candidate. The
  file is finished or fully cancelled and only its folder is wrong.
- **Superseded pointer resolves** to a roadmap that exists in `archive/` or the
  active tree → `archive` candidate, with the pointer as its reason.
- **Resume condition names a PR, an ADR, a file, or a merged branch** → it is
  mechanically checkable; Phase 3 runs it first.
- **Resume condition names only an owner decision or a calendar date** → read
  the decision record (`agents/roadmaps/` `## Decisions` tables, ADRs) and the
  date; a past date with no recorded decision is a `re-park` or an escalation,
  never a silent pass.

Show the table before any edit. `--triage-only` ends the run here.

### 3. Verify — the load-bearing phase, up to `--batch` files

Order the deep pass: mechanically-checkable resume conditions first, then
`later/` by age (oldest first), then `skipped/`. Delegate when more than ~4 files
survive — one subagent per file, told to verify against the tree and **write no
repo files**; their return is a reading, re-checked against the file before any
edit ([`delegation-policy`](../../rules/delegation-policy.md)).

Per file, three checks:

**3a. Execute the resume condition and every blocker's `Resolved when` as a
check** — never trust a `Status:` word, which records the past:

```bash
gh pr view <n> --json state,mergedAt     # "PR X merged"
ls docs/decisions/ADR-NNN-*.md           # "the ADR exists"
git log --oneline origin/main -- <path>  # "<file> landed on main"
grep -n '<key>' <file>                   # "<key> exists"
```

Verdict per condition: `met` · `unmet` · `unverifiable` (with the one line why).

**3b. Verify every open `[ ]` and deferred `[~]` step against the current tree**,
with a `file:line` or command output for what was checked:

`already-shipped` · `still-needed` · `obsolete` (the target it acts on no longer
exists or was superseded) · `unverifiable`

Search wide: an open step in a parked roadmap was frequently shipped by a
*different* roadmap. `grep` the step's named file, flag, key or command across
`src/`, `docs/`, and `agents/roadmaps/archive/` before calling it `still-needed`.

**3c. Re-test the parking reason itself.** For `later/`: is the gate the file
names still the real gate, or has the blocking work moved (a dependency now
merged, a decision now recorded, a benchmark now runnable)? For `skipped/`: does
the skip reason still hold — is the superseding roadmap real, is the rejected
scope still rejected, or has a later inbox round or decision asked for this
again ([`recurring-criticism`](../../rules/recurring-criticism.md) owns a repeat)?

### 4. Decide — exactly one disposition per file

| Disposition | When | What it writes |
|---|---|---|
| **promote** | resume condition `met` or no longer a gate, and ≥ 1 step `still-needed` that an agent can execute now — for a `skipped/` file, only after the council ruled the rejection no longer holds (below) | `git mv` to `agents/roadmaps/`, steps adapted to the current tree (below), the active-tree shape (below), a `> Promoted from <folder>/ on YYYY-MM-DD: <condition met + evidence>` line under the title |
| **absorb** | the surviving steps belong to an active roadmap already covering the area | the steps copied into that roadmap as a new phase or step block, each tagged `<!-- from: <parked-slug> -->`; the target's Risk Register `reviewed:` re-stamped (a new phase is a substantial change); then the parked file is **archived** with a pointer to where its items went |
| **archive** | every open/deferred step is `already-shipped` or absorbed, and no blocker is still open — or the file is finished and only misfiled | shipped steps flipped to `[x]` with `<!-- shipped: <file:line or PR> -->`, `status: archived`, `git mv` to `archive/`, a `> Archived from <folder>/ on YYYY-MM-DD by /roadmap:triage-parked: <reason>` line |
| **re-park** | the gate is real and still `unmet` | stays in place; the resume condition rewritten as a **checkable** `entry_condition:` mapping (`what` / `when` / `who`), a `review_by: YYYY-MM-DD` in the frontmatter, a `> Last triaged: YYYY-MM-DD — <verdict of 3a>` line, shipped steps still flipped to `[x]` |
| **owner-decision** | the only thing between the file and a disposition is a decision an agent may not take — any step judged `obsolete` (cancelling it is `[-]`, owner-reserved), or a gate in the [`decision-revisit-gate`](../../rules/decision-revisit-gate.md) owner-reserved set | stays in place; the question written onto the file with the candidate dispositions, and the item put to the owner (Output 1) |

**Adapting a promoted or absorbed step to the current tree** is the point of the
command, not a nicety. Rewrite each `still-needed` step so it would execute
against today's tree — renamed paths, moved scripts, changed commands, current
gate names — and tag it `<!-- adapted: <what changed> -->` so a reader can tell
an update from a transcription. A step that cannot be made executable becomes a
`[ ]` investigation step stating what is unknown, never the stale wording.

**The active-tree shape a promoted file must have.** `later/` and `skipped/` are
exempt from the gates that read the active tree; a promoted file is not. Before
it lands at the top level it carries at least one `## Phase` heading with a
checkbox step under each (`check_roadmap_trackable`), a `## Risk Register` with a
current `reviewed:` date (`lint_plan_risk_register`), and it passes
`lint_roadmap_family_cap`, `lint_roadmap_complexity` and `lint_roadmap_ci_steps`.
Set `status: ready` only when all of that is written. A file whose plan needs
more rework than that is promoted as `status: draft` — off the dashboard and the
risk-register gate until the owner flips it.

**Constraints that come with the folder, not with the decision:**

- **Reviving a `skipped/` file reopens a recorded rejection.** It goes to the
  council first per [`decision-revisit-gate`](../../rules/decision-revisit-gate.md)
  (mechanism-match, then the five steps), and to the owner when the transition
  lands in the owner-reserved set. 3c's evidence is the input; the verdict is
  recorded on the file before the `git mv`.
- **`skipped/` → `archive/` is legitimate here** once 3c confirms the file holds
  nothing to resume. This widens `archive/` from "work happened" to "nothing left
  to do here", deliberately: the folder that must stay small is the one nobody
  reads, and the `> Archived from skipped/` line carries the original skip reason
  forward verbatim, so the rejection stays on record.
- **Deferred `[~]` steps never follow a file into `archive/` silently** —
  [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) Iron Law 3
  applies unchanged. Each one is `already-shipped` (flip to `[x]`), or absorbed /
  carried, and then annotated in the source step as
  `<!-- deferred-resolution: merged-into=<slug> -->` or
  `<!-- deferred-resolution: carried-to=<slug> -->` (a carried-to target also
  carries `parent_roadmap: <source-slug>`). A bare `[~]` in `archive/` reds
  `lint_deferral_integrity`.
- **Blockers resolve before their file moves.** A blocker whose `Resolved when`
  ran `met` in 3a gets `- **Status:** resolved` — the only closing token
  `lint_roadmap_blockers` and the estate count accept. A file with a blocker
  still open is not archived; it is promoted with the blocker, re-parked, or put
  to the owner.
- **Promotion never lifts a blocker.** A promoted roadmap keeps every blocker
  whose `Resolved when` is still `unmet`, and a blocker marked owner-reserved
  stays so; the file is active because *some* step is executable now, not
  because the gate went away.
- **Promote only what is executable now.** If every surviving step is gated,
  the answer is `re-park`, however old the file is — the
  [Active vs. Later test](../../skills/roadmap-management/references/archival.md)
  is unchanged.

### 5. Apply — the mechanics that red CI if skipped

In this order, after all decisions of the batch are taken:

1. `git mv` each moved file and fix its own outgoing relative links:
   `later/` or `skipped/` → top level removes exactly one `../` from each;
   `later/` or `skipped/` → `archive/` changes none. Migrate inbound references
   to the new path (`grep -rn '<slug>' agents/ docs/ src/`).
2. Frontmatter: a file leaving `later/` must not keep `status: later` —
   `lint_roadmap_later_disposition` reads the word, not the folder. Archived →
   `status: archived`; promoted → `status: ready` or `draft` (step 4).
3. **Estate ratchet — a promotion is an addition.** `check_estate_count` reads a
   `later/x.md` → `x.md` move as a new active roadmap on both halves, and only a
   move of an *active top-level* roadmap out of the tree offsets it — archiving
   a parked file lowers `later_roadmaps`, never `active_roadmaps`. So each
   promoted file needs its own `estate_offset_exempt: <reason>` written in this
   change; the reason must name the disposition rejected instead (archive, park,
   merge — `_lib/exemption_shape.ts`), e.g. *"promoted from later/: resume
   condition met (PR #N); not re-parked because …; not merged because …"*. Many
   parked files already carry an old `estate_offset_exempt` — **replace** it,
   never inherit a reason written for a different event. The gate reads
   `<base>...HEAD`, so it sees only committed changes: run it after the change is
   committed, and read its `this change +N active / -M disposed, K exempt` line,
   where `K` must equal `N`.

   ```bash
   ./scripts-run src/scripts/check_estate_count
   ```
4. Regenerate: `./agent-config roadmap:progress --no-archive` (dashboard — the
   flag keeps it from sweeping unrelated finished roadmaps into this change) and
   `./scripts-run src/scripts/build_archive_index` (archive index — nothing else
   in the archival path regenerates it).
5. Run the lints that read what moved: `lint_roadmap_later_disposition`,
   `lint_roadmap_blockers`, `lint_deferral_integrity`, `check_no_roadmap_refs`,
   `check_estate_count`, and — for every promoted or absorbing file —
   `check_roadmap_trackable`, `lint_plan_risk_register`,
   `lint_roadmap_family_cap`, `lint_roadmap_complexity`, `lint_roadmap_ci_steps`.
   Draining `later/` loosens ratchets: when `lint_roadmap_later_disposition`
   reports a baseline as loose, lower it in the same change. A drop below a
   `min_scanned` floor in `src/config/gate-coverage.yml` is the corpus shrinking,
   not a regression — lower the floor with the evidence in its note.

### 6. Close the run

Re-read every edited file once against the decision table (pass 3 of the
inbox discipline): each `[x]` flip carries its evidence, each promoted step its
`adapted` tag, each archived file its reason line. A disposition the file does
not carry is not applied.

## Output

1. **Owner decisions required**, if any — at the top: the list of every pending
   item (file, question, candidate dispositions), then **one** numbered-options
   question for the most blocking item; the rest are asked one per turn after
   it is answered ([`user-interaction`](../../rules/user-interaction.md),
   [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)). Each question is
   also written onto its file, so the next run finds it posed.
2. The inventory table (every file in scope) with the `candidate` column.
3. Per deep-checked file: resume-condition verdicts, the step verification table,
   the disposition and what was written.
4. **The disposition ledger — the run's completeness check:**

   ```
   scope     N files (later: L, skipped: S) · deep-checked: D · deferred to next batch: R
   promote   n → <paths>
   absorb    n → <parked> → <target roadmap>
   archive   n → <paths>
   re-park   n → <paths, with the refreshed condition>
   owner     n → <paths>
   steps     N verified → already-shipped / still-needed / obsolete / unverifiable
   folders   later/: before → after · skipped/: before → after
   ```

   Deep-checked files must sum to their dispositions. Files past the batch cap
   are named in `deferred to next batch`, never silently absent.
5. One closing summary: how many files left each folder, how many steps were
   prevented by `already-shipped`, and which gate the run is waiting on next.

## Honest enforcement — `instruction-only`

No gate checks that a resume condition was executed rather than read, or that an
`already-shipped` flip was verified. The ledger is the control: it carries
numbers and `file:line` evidence a reviewer can challenge after the fact. The
folder-placement and estate gates named in step 5 catch a malformed **move**;
they cannot see a wrong **decision**.

## Do NOT

- Promote a roadmap because it is old. Age is evidence that the parking reason
  went unchecked, not evidence that it stopped holding.
- Archive a file with `still-needed` steps that were neither absorbed nor
  carried into a follow-up.
- Write `[-]` to make a file archivable. An obsolete step is a finding put to
  the owner; the agent never cancels one.
- Re-park with the same prose condition. If it could not be checked this run, it
  will not be checked next run either — rewrite it as an `entry_condition:`.
- Execute a promoted roadmap in the same run — triage authorizes moving and
  rewriting plans, not doing their work
  ([`scope-control`](../../rules/scope-control.md) § Authoring vs. implementation).
  `/roadmap:next` or `/roadmap:process-full` picks it up afterwards.
- Resolve an owner-reserved gate into an accurate paragraph. Past the decision
  the agent cannot take, the output is the escalation block.
