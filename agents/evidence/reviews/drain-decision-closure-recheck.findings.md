# Completion review — re-read of road-to-decision-closure, 2026-10-04

**Skipped:** no code surface for this completion — the diff is one roadmap file under `agents/roadmaps/` plus this artifact, and the gate itself measures zero code paths in it, scope 6db1e2582c677af905fc3fb4dca181e0c3e63d13078ab85ce89467e5fa861d1e, declared 2026-10-04

## Why a skip rather than a review

`git diff --stat origin/main` on this branch is one roadmap file. No script, no
hook, no schema, no fixture, no test, no contract under `docs/`, and no file
under `src/` — so no `task sync` / `task generate-tools` pass was owed either,
and none was run. `check_completion_review` agrees and says so in its own
refusal text: *"diff has 0 code path(s) of 1 changed file(s)"*. The skip phrase
is a measurement here, not a claim about one.

## What was verified instead, and how

A roadmap re-read's evidence is the re-execution of the conditions the file
asserts. Every one below was executed on this tree at `30481f660`, which is this
day's head of `origin/main`; none was taken from the file's own previous note.

### The four blockers, each by its own `Resolved when:`

- **`adr-266-acceptance-closure` — resolved, holds.**
  `grep -m1 '^status:' docs/decisions/ADR-268-*.md` → `status: accepted`.
- **`kernel-write-deny-ask-when-uncertain` — open, holds, clause 1.** An `Edit`
  envelope naming `src/rules/ask-when-uncertain.md` piped to
  `src/scripts/hooks/block_kernel_rule_writes` exits **1** with
  `block-kernel-rule-writes: BLOCKED — kernel rule ask-when-uncertain is
  immutable — tighten-only via the override exception registry`, followed by
  *"Legitimate change requires a human action outside the agent session."*
  Fifth reproduction.
- **`kernel-write-deny-ask-when-uncertain` — open, holds, clause 2.**
  `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md`
  exits 1 with no output. Both clauses negative.
- **`grant-object-undelivered` — open, holds.** `grep -rln granted_by src tests`
  exits 1 with no output. Fifth reproduction. The sweep was widened once to
  check the narrow scope is not hiding a delivery: `granted_by` occurs in this
  roadmap, in `road-to-typed-grants-that-persist`, under
  `agents/evidence/reviews/`, and in ADR-260, ADR-266 and ADR-268 — plans and
  records only, nothing under `src` or `tests`.
- **`interrupt-classes-owned-by-sibling` — resolved, holds, clause 2.**
  `grep -n 'DC-1' agents/roadmaps/road-to-decision-closure.md` returns the
  `## Decisions` row. Clause 1 does not hold and has **changed in fact**: the
  sibling's step 3.2 read `[ ]` on every prior run and reads `[~]` today.

### The two readings that moved

- **Census.** `./scripts-run src/scripts/ask_block_census` reads **633** files
  under `src/domains`, `src/skills` and `src/agent-src/contexts` — six more than
  the 627 of 2026-10-01 — and reports *zero technical owner asks in execution*
  **MET**, *zero commit/push/CI/conflict asks* **MET**, *zero repeats of an
  answered question* **NOT MEASURED (transcript axis)**. Breakdown: 184 single,
  74 batch, 0 count-only, 0 file-parked, 21 bypass.
- **Sibling 3.2 is `[~]`, and `DC-1`'s revisit condition was evaluated against
  that rather than assumed past.** `DC-1` reopens on *withdrawal or retargeting
  away from `user-interrupt-priority.md`*. A deferral is neither: the step still
  names that file, still carries the three interrupt classes, and its own
  evidence block gives the refusal ground (it removes the ASK in that rule's
  Iron Law, and is unverifiable until the sibling's 3.1 ledger exists). The row
  further says in terms that sibling slowness is not a trigger. Does not fire;
  the allocation stands.

### AC-6's second clause, re-counted

`grep -c '^\s*ask:' src/scripts/hook_manifest.yaml` returns **8**; listing the
matches shows exactly one `native` and seven `text`, the same split as
2026-09-30 and 2026-10-01. `agent-config hooks:status` prints the shape per host,
so the row reaches its reader and does not merely sit in the manifest.

### The new measurement, and the probe that was NOT run

`./scripts-run src/scripts/check_preamble_payload_budget --as-of 2026-10-04T00:00:00Z`
reports `project-scope rules 121426 tok`, `measured total 137017 tok (baseline
102520, +34497; ceiling 137017)` and the verdict `ceiling 137017 tok = base
137017 — zero net growth, design 107646`. The ceiling is
`max(design, payload at base ref)` and is measured at the base ref, so there is
no per-PR headroom and any net addition to a project-scope rule reds the gate.
This is why step 3.1's hand-over now records the kernel paragraph as needing an
offset or a deliberate ceiling move on top of a lifted deny.

**The sensitivity probe for that reading was not run, and that is recorded
rather than implied.** The probe would have inflated a non-kernel project-scope
rule, watched the gate go red, restored from a scratchpad backup and confirmed
green. It was refused at tool-call time: editing a rule file is itself denied in
this session, which is the same class of refusal as the kernel deny and was not
worked around. The budget reading above is therefore taken from the gate's own
printed verdict. The independent empirical point of comparison is the
2026-09-13 rejection of a four-line version of this same paragraph at
+219 tok/spawn, recorded on step 3.1 by the run that hit it; it agrees.

## Parity against the base file — checked, and one finding was self-inflicted

- **`closure_scan`** reports **8 open decisions and 2 owner questions** on the
  base file and the same 8 and 2 on the edited one.
  An intermediate draft read **8 and 1**: the hand-over sentence *"must either
  offset it ... or move the ceiling"* matched `closure_scan`'s
  `unpicked-alternative` pattern `/\beither\b[^.]{3,80}\bor\b/i`, which
  reclassified step 3.1 from `product-semantics` / `product-owned` to
  `contested-technical` and so dropped the owner-question count. That is the
  Risk-Register-1 shape pointed inward — prose drifting a finding rather than a
  detector being weakened — so the **sentence** was reworded and the detector
  was not touched. Re-run after the reword: 8 and 2, parity restored.
- **`scanOpenSteps`** returns `open=0, blocked=3, next=null` on both the base
  and the edited file, so the fenced hand-over block truncates no phase span and
  the continuation ladder's terminal reading is unchanged.
- **Gates re-run green on the edited file:** `lint_decision_classes`
  (17 roadmaps, 0 violations), `lint_roadmap_producers` (8 producers, all ending
  in closure), `check_no_roadmap_refs` (1014 scanned), `lint_roadmap_ci_steps`,
  `check_md_language` on the edited file, and
  `update_roadmap_progress --check --untracked-mode`.

## Closed steps re-verified by their own `verify:` line

- **0.2** — `grep -c 'suppress when personal.autonomy' src/domains/product-basic/roadmap/create/command.md`
  returns **0**, as the step requires; `agent-config council:status` reports
  `CONFIGURED`, resolved user-global.
- **1.2** — `grep -rl 'produces_roadmap: true' src/domains | wc -l` returns **8**,
  matching the step's corrected count.
- **1.1 / AC-5 static half** — `closure_scan.test.ts` green: `F1` yields twelve
  seeded ambiguities and zero owner questions.
- **AC-3** — `council_record_shape.test.ts` green, 23 tests.
- **AC-4** — `ai_council/config.test.ts` green, 110 tests.
- **3.2** — `agent-config hooks:status` prints the ask shape per host.

## What stayed open, and why

All five. Steps 3.1, 4.1 and 5.1 and criteria AC-5 and AC-6 are unchanged, each
on a cause that was re-executed above rather than re-read. 3.1 is a kernel-rule
write the guard denies and a maintainer act outside any agent session; 4.1 and
5.1 wait on a grant object that is another roadmap's deliverable and whose
builder steps moved to `[~]` this interval; AC-5 and AC-6's first clause are
transcript claims that would additionally need a harness and a reader other than
the runner, per `evaluator-independence`. `blocked` is the correct terminal
state for this file and was already its recorded one.

## Pre-existing reds observed and NOT fixed here

Both carried over from the 2026-10-01 artifact, both re-observed, both still
outside this diff and still local-only rather than CI-blocking:
`lint_roadmap_complexity` on `road-to-a-stop-that-holds.md`, and
`task roadmap-progress-check` on `road-to-host-claims-the-tree-contradicts.md`.
CI runs the narrow `task roadmap-dashboard-untracked-check` instead, which
passes here.
