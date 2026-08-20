---
type: "auto"
tier: "1"
description: "Any roadmap touch (file move, checkbox flip, phase change) regens dashboard same response; archive at 0 open"
triggers:
  - path_prefix: "agents/roadmaps/"
  - command: "/roadmap:process-step"
  - command: "/roadmap:process-phase"
  - command: "/roadmap:process-full"
routes_to:
  - "guideline:agent-infra/roadmap-progress-mechanics"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
roles: [planner]
enforced_by:
  - "hook:roadmap-progress"
collision_ok:
  "agents/roadmaps/": "any roadmap touch regenerates the dashboard, same response"
# obligation: line 26
obligation_frequency: "per-edit"
---

# Roadmap Progress Sync

## Iron Law 1 — dashboard sync, same response

```
ANY ROADMAP TOUCH → REGENERATE THE DASHBOARD, SAME RESPONSE.
NO EXCEPTIONS. NO "I'LL DO IT AT THE END". NO BATCHING ACROSS TURNS.
```

Roadmap touch = create / rename / delete / move file, add/rename/remove a phase, OR flip any checkbox (`[ ]` ↔ `[x]` ↔ `[~]` ↔ `[-]`). Regen command: `./agent-config roadmap:progress` — it passes `--archive`, so a roadmap at `count_open == 0` with no deferred item and no open blocker is `git mv`'d to `archive/` by the same run, not reported for someone to do later. `--check` never archives, and the PostToolUse hook never archives (contract + the council's recorded dissent: the `--archive` block in `update_roadmap_progress.ts`).

## Iron Law 2 — real-time checkbox cadence (autonomous execution)

```
EVERY DONE STEP FLIPS [ ] → [x] IN THE SAME REPLY THAT LANDS THE WORK.
NO "I UPDATE THE ROADMAP AT THE END OF THE PHASE."
A REPLY THAT LANDS A VERIFIED STEP WITHOUT FLIPPING ITS CHECKBOX
IS A RULE VIOLATION, NOT AN OVERSIGHT.
```

`/roadmap:process-*` runs flip the box for step N **before** moving on to step N+1 — the markdown file is the source of truth, the dashboard a derived view. `[~]` means deferred, never in-progress. Glyph table, done-definition, command-trigger loading + flip-guard, regen-cadence batching, and the blockers cadence live in the guideline (routing below).

## Iron Law 3 — no silent archive with unresolved deferred items

```
A ROADMAP WITH `[~]` DEFERRED ITEMS NEVER AUTO-ARCHIVES SILENTLY.
SURFACE EVERY DEFERRED STEP. RESOLVE IT — VIA THE COUNCIL WHERE THE
DISPOSITION PRESERVES THE ITEM, VIA THE USER WHERE IT DOES NOT.
A SILENT ARCHIVE THAT BURIES PLANNED-FOR-LATER WORK
IS A RULE VIOLATION, NOT A CONVENIENCE.
```

Closure check fires (`count_open == 0` and `count_deferred > 0`) → enumerate every `[~]` step, present the numbered-options resolution menu (per [`user-interaction`](user-interaction.md)), and only after the deferrals are resolved does the `git mv` to `archive/` run. Full option menu + migration mechanics: guideline + [`roadmap-management`](../skills/roadmap-management/SKILL.md).

### Who resolves it — the preservation test

```
THE COUNCIL MAY RESOLVE A `[~]` ONLY WHERE THE CHOSEN DISPOSITION KEEPS THE
ITEM ALIVE IN THE ACTIVE ESTATE. ANYTHING THAT DROPS, WEAKENS, OR PERMANENTLY
ACCEPTS THE LOSS OF IT REACHES THE USER — ALWAYS, AND NO MANDATE LIFTS THAT.
IN DOUBT, IT IS A USER DECISION. THE COUNCIL ADVISES ON HOW AND WHEN;
THE OWNER DECIDES WHETHER.
```

One question decides the route, and it is answerable from the option itself
rather than from judgement: **does this disposition keep the criterion active
in the estate?**

| Disposition | Route |
|---|---|
| Fix the blocker now, in this change or its own PR | council |
| Carry item **and** blocker into a named follow-up roadmap created in the SAME change and estate-ratchet compliant | council |
| Merge the item into existing active work that already covers it | council |
| Restore to `[ ]` in this roadmap | council |
| Convert to `[-]` cancelled | **user** |
| Weaken the criterion, cut its scope, or accept the breakage permanently | **user** |
| Keep-in-archive (an intentional drop) | **user** |
| The item carries a `high_impact` / `user_required` classification | **user** |

- **"Immediately active" is not a promise.** A follow-up counts only if created
  in the same change and estate-ratchet compliant. A verdict naming a roadmap
  that does not exist yet **fails closed to the user**.
- **Recorded, or it did not happen.** At the item: criterion verbatim ·
  blocker id · every option · verdict + one-sentence rationale · dissent ·
  destination when carried · what closes it. A verdict with no record is a
  silent drop wearing a procedure.
- **The residual hole, stated not papered over.** Both authoring seats named
  it in their own strongest counter: a carried follow-up can still become an
  indefinite deferral, so this test bounds *who decides*, not *whether the work
  happens*. Only fix-now discharges it. A carried item untouched at the next
  task boundary is raised again per [`active-remediation`](active-remediation.md).
- **Why it changed.** Adopted 2026-08-19, unanimous 2/2 council (blind peer
  review). The prior text — *"Wait for the user"* — handed back a fully
  analysed choice with four costed options, the low-value interruption
  [`no-cheap-questions`](no-cheap-questions.md) forbids. The gate protects the
  item, not the maintainer's attention.

### `deferred_policy` — a declared contract removes the round, never the route

An accepted execution contract may declare `deferred_policy`
([`roadmap-execution-contract § 2b`](../contexts/execution/roadmap-execution-contract.md)).
It changes **when the round happens**, never **who decides**:

| Declared | Effect on the gate |
|---|---|
| absent / `wait` | Unchanged — the synchronous menu runs. |
| `spawn-follow-up-draft` | The council-routed carry disposition runs **automatically** at closure, with no options round. Legal only because the table above already routes it to the council and Accept pre-authorized the run. |
| `cancel-with-memo` | The run writes the memo and the recommendation; the `[-]` conversion stays **user**. A declared field never moves a row from user to council. |

Recorded-or-it-did-not-happen applies unchanged to an automatic spawn, and
fail-closed binds hardest here: a spawn naming a follow-up that does not exist
yet reaches the user, because a contract cannot pre-authorize a promise.
Reversible — `wait` is the default, so removing the field restores always-wait
(`decision 2026-08-20`, AI council 2/2; record
`agents/evidence/council/drain-blocker-dispositions-a.md`).

## Later disposition — blocked-for-later roadmaps are parked, never left active

```
A ROADMAP WHOSE OPEN WORK CANNOT PROCEED NOW (GATED ON AN EXTERNAL
TRIGGER OR A DECISION) BUT WILL RESUME → MOVE IT TO agents/roadmaps/later/.
NEVER LEAVE A BLOCKED-FOR-LATER ROADMAP IN THE ACTIVE TREE.
```

`later/` is the fourth disposition alongside `archive/` and `skipped/`; excluded from the dashboard and `/roadmap:process-*`. Procedure + the Active-vs-Later test: guideline + [`roadmap-management`](../skills/roadmap-management/SKILL.md).

## PR-gate — a completed roadmap archives in its own PR, never post-merge

```
COMPLETED ROADMAP → ARCHIVED IN THE PR THAT COMPLETES IT.
NEVER MERGED-BUT-UNARCHIVED INTO THE TRUNK.
/create-pr RUNS THE ARCHIVAL SWEEP BEFORE THE PR EXISTS.
NO merge-gated PLACEHOLDER ITEM. NO AGENT-SET ANNOTATION.
```

The sweep (`scripts/archive_completed_roadmaps.ts`, invoked by [`/create-pr` § 1c](../commands/pr/create.md)) archives deterministically before the PR exists; `./agent-config roadmap:progress-check` is the CI backstop. Rationale + sweep detail: guideline.

## Pre-send self-check — MANDATORY

Before sending any reply that landed roadmap work:

1. Did this reply land a step (code/doc saved + verification passed)?
2. Is its checkbox flipped to `[x]` / `[~]` / `[-]` in `agents/roadmaps/<file>.md`? If no → flip, then continue.
2b. Was a roadmap created or updated from an `agents/tmp/` inbox file this
   reply? If yes → `mv` that file to `agents/tmp.old/` NOW, same reply (per
   `agents-layout § User Inbox Workflow`), and point the roadmap's Source
   line at `agents/tmp.old/<name>`. A consumed inbox file left in
   `agents/tmp/` is a rule violation, not tidiness. Move ONLY the file(s)
   explicitly named as input — never sweep the rest of the inbox.
3. Is regen due now per `roadmap.dashboard_regen_cadence`?
   - `per_step` → yes, always.
   - `every_5_steps` → yes when this is the 5th, 10th, … closed step in the run, or the last step of the reply.
   - `phase_boundary` → only when this reply closes the phase or run.
   - Any file-shape touch (rename / phase add / archive) → yes, regardless of cadence.
   If yes and not run yet → run `./agent-config roadmap:progress`, then continue.
4. Did `count_open` reach 0?
   - **No (real open work remains)** → continue normally.
   - **Yes + `count_deferred == 0`** → the roadmap is **complete**. Archive it — `git mv` to `archive/` + migrate inbound refs + regen, same reply — or let the next `/create-pr` § 1c sweep do it deterministically. Either way it must never be pushed to the trunk unarchived (§ PR-gate; the `--check` backstop enforces it).
   - **Yes + `count_deferred > 0`** → STOP. Run the Iron Law 3 deferred-resolution flow: surface every item, apply the preservation test above, and resolve — council where the disposition keeps the item alive, user where it does not. Archive only after resolution, and only with the resolution recorded at the item.

Any "no" at step 2 → reply is incomplete. Do not send. A skipped step 3 regen is fine when cadence permits — checkbox truth lives in the markdown file. Skipping the deferred-resolution gate at step 4 is **never** acceptable; it is the canonical "lost-information" failure mode this rule exists to prevent. Note what the council path does and does not change here: it changes WHO resolves a preserving disposition, never whether the gate runs, never whether the resolution is recorded, and never the user's ownership of a drop.

Body migrated to `guideline:agent-infra/roadmap-progress-mechanics` (per P4 of `road-to-kernel-and-router.md`) — glyph semantics, regen cadence, deferred-resolution menu, later-disposition procedure, PR-gate prose, plus the long-form failure-mode catalog, Copilot fallback, and hook + CI defence-in-depth.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
