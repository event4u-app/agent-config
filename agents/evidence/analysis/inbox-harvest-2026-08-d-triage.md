# Inbox harvest 2026-08-d — triage, verification, and the not-adopted register

> **Produced by:** an `analyze:inbox` run over `agents/tmp/context-custodian/`
> on 2026-08-15, in an isolated worktree, against `main` @ `e3bd96158`.
> **Inputs:** nine dropped files — seven proposal roadmaps and two chat
> transcripts — from **two independent runs of the same five-step analysis
> prompt** against this repository.
> **Method:** three parallel verification agents, each required to label every
> repo claim against the current tree with a `file:line` or a command output,
> plus a direct screen of the active roadmap tree for axis ownership.

This document exists so the rejections and the corrections survive. Five
roadmaps came out of this harvest, one was parked, and a series of specific
claims were found wrong in ways that would have shaped work if they had been
carried forward unchecked.

## 1. Triage table

| file | genre | lines | drafted-against | disposition |
|---|---|---:|---|---|
| `chat-1.txt` | transcript, run A | 146 | `e44e87865` (self-declared) | provenance for run A; not a plan |
| `chat-2.txt` | transcript, run B | 69 | `e3bd96158` (self-declared, = HEAD) | provenance for run B; not a plan |
| `road-to-context-custodian.md` | proposal roadmap, run A | 161 | `e44e87865` | **merged** into the context roadmap |
| `road-to-context-ledger-discipline.md` | proposal roadmap, run B | 145 | `e3bd96158` | **adopted**, merged with run A's unique items |
| `road-to-runtime-skill-routing.md` | proposal roadmap, run B | 152 | `e3bd96158` | **adopted**, three corrections folded in |
| `road-to-top-band-model-economy.md` | proposal roadmap, run B | 151 | `e3bd96158` | **adopted**, reopen question made a blocker |
| `road-to-scheduled-deprecation-execution.md` | proposal roadmap, run A | 122 | `e44e87865` | **adopted narrowed** — the removal is a blocker, not a step |
| `road-to-archive-sweep-economy.md` | proposal roadmap, run A | 94 | `e44e87865` | **adopted**, file count corrected |
| `road-to-llm-distillation-comparison.md` | proposal roadmap, run A | 96 | `e44e87865` | **parked** in `later/` |

Both runs declared their drafting revision, which made the staleness question
mechanical rather than a matter of reading. Run A's pin sits 17 commits behind
HEAD, and `git diff` over every configuration and hook surface those four
roadmaps cite returns **empty** across that window — so **zero** of run A's
claims could have been overtaken. Run B was pinned at HEAD itself. The
`already-fixed` column is therefore empty for all seven files, which is a hard
result rather than an absence of checking.

Two roadmaps that run A's transcript says it produced — a skill-activation and a
frontier-tier plan — never reached the inbox. Run B's `runtime-skill-routing`
and `top-band-model-economy` cover the same two axes and are the versions
adopted.

## 2. What the verification changed

The claims held up well. What did not survive is worth recording precisely,
because each one would have shaped work:

- **An arithmetic error in a headline.** The deprecation proposal's defect list
  says the code-graph removal is overdue by **two** majors; its own body
  correctly derives **one** (`docs/MIGRATION.md:20` commits to 11.0,
  `package.json:4` reads 12.0.0). The corrected figure is used in the adopted
  roadmap.
- **A retracted measurement carried forward as current.** The routing proposal
  cites "667 dropped, ~31 of ~498 survive" for the codex catalogue. The current
  row in `agents/evidence/metrics/skill-catalogue.jsonl` reads `entries_total:
  497`, `dropped_count: 393`, observed from a host event on 2026-08-15 — and
  the investigation page for that surface explicitly retracts both the
  double-count reading and the `entries_total − dropped_count` subtraction as
  describing neither host. The adopted roadmap computes no survivor count.
- **A schema that does not exist.** The routing proposal frames trigger seeding
  as reusing a capability "the schema supports". `src/scripts/schemas/
  skill.schema.json` has **no** `triggers` property, and `trigger_coverage.ts`
  validates rule triggers only. The single `^triggers:` hit under `src/skills/`
  is a code example teaching rule authors. The adopted roadmap adds a schema
  phase and a validator phase that the proposal treated as already paid for.
- **A window signal treated as derivable.** The context proposal from run B
  proceeds to a window-aware threshold as if the window follows from the
  transcript's model field. `cc_transcript.ts` does parse `message.model`, but
  nothing maps a model string to a context window, and the config file's own
  `known_limitation` says the transcript carries no explicit window marker. The
  adopted roadmap restores run A's spike as the gate on that phase.
- **A quantifier that is 4 of 6.** Run A's fifth defect says *every* adoption
  metric in `hook-token-budget.json` carries the baseline-first phrase. Four do;
  two carry different wording with the same intent.
- **A file count off by three.** The archive holds **494** top-level roadmaps,
  not 497. No drift — a plain miscount.
- **An existing sweeper neither run credited.** `src/scripts/janitor.ts` is a
  working TTL sweeper (`task janitor` / `task janitor-apply`) whose
  `TTL_CONFIG` covers three directories and not `agents/runtime/state/*`. Run A
  proposed a new `agent-config state:gc` CLI for exactly that job. The adopted
  roadmap extends the config instead of adding a surface.

## 3. Ownership screen — what was already spoken for

- **The scoped-projection default and its migration notice** belong to
  `road-to-skill-catalogue-budget` and to the decision recorded for it on
  2026-08-15 (owner ruling plus a 2/2 council). That work was open when the
  harvest ran and **merged before this branch was pushed**; the roadmap has
  since archived, so the decision is closed rather than pending — re-checked
  live rather than carried from the earlier reading. That decision also
  **falsified the
  comparison basis** the routing proposal assumed: a controlled probe moved the
  measured host's dropped count by 0 for +60 command files and by 53 for +60
  skills. The adopted roadmap compares skill counts only, never artefact totals,
  and never extrapolates one host's limit to another.
- **The `paths:` coverage axis is unowned.** `road-to-cost-parity-1-rule-payload-diet`
  ratchets the CLI-verb registry and the hook-chain cap; it does not touch
  per-rule `paths:` coverage or the preamble-payload destination. Coverage is
  **0 of 115** rules, so the census is a ranking exercise rather than a
  discovery one.
- **Trigger *seeding* is unowned.** `road-to-skill-description-measurement` owns
  the trigger *measurement* and is itself blocked on a human-gated live
  evaluation; `road-to-skill-catalogue-budget` names triggers a non-goal and an
  "independent track". That track did not exist until this harvest.
- **Distillation follow-ups** already have an owner in
  `road-to-distillation-followups`, which is why the distillation proposal was
  parked rather than opened as a competing track.

## 4. The not-adopted register

Recorded so none of these returns from zero in the next review cycle.

| # | Proposal | Why it was not adopted |
|---|---|---|
| 1 | A new in-run context-diet advisory | Round 5 measured that both blocking carriers reached zero violations and neither advisory carrier did. Four of six adoption metrics still carry "no threshold before data" with `review_by: 2026-11-10`. An eleventh advisory before the tenth's baseline is read is the pattern both proposals were written to stop — it is a candidate for the review date, not for a roadmap. |
| 2 | A standalone "adoption readout" phase | It is a date, not work. Nothing can execute it before 2026-11-10 and nothing needs a plan to execute it after. Carried instead as the stated precondition on any future advisory. |
| 3 | A task key for `turns_per_task` | Registered as per-session "until a task key ships"; no task envelope exists to key against, and neither proposal names one. Blocked on infrastructure that does not exist, with no urgency signal behind it. |
| 4 | A hot-context 400-word-cap self-check | Instrumentation for a cap with no evidence of being wrong. Revisit if a real overflow complaint appears. |
| 5 | A new `agent-config state:gc` CLI | `janitor.ts` already is that mechanism. The work is a `TTL_CONFIG` entry, and adding a second sweeper would be the surface growth both proposals argue against. |
| 6 | Executing the code-graph removal as a roadmap step | Removing a CLI leaf, a skill arm and a rule route is a public-surface change gated by two separate rules and a major-version window. Carried as a blocker with a named owner so the overdue surface is tracked without the check being held hostage to a release. |
| 7 | Deleting `allowlist_backup.json` from the repo root | Both transcripts raise it; both also conclude it is ticket-sized. A roadmap for a single-file deletion would itself be the over-build the same transcripts warn about. Left as a note for the maintainer. |
| 8 | Retiring `edit-shape`, `reread-guard` and the recycle advisory | Their kill criteria are pre-registered with `review_by: 2026-11-10`. Cutting before the date breaks the measurement discipline that justified registering them. Same verdict the previous harvest reached on concern retirement: measure, then retire. |
| 9 | A fourth model band, as an "extension" of ADR-035 | ADR-035 rejected exactly this and named its own reopen condition. Whether that condition now holds is the ADR's reserved question, not a roadmap's. Adopted as a blocker rather than as a step. |
| 10 | LLM-based mid-run summarisation | The deterministic cache is a locked council verdict; the alternative enters only through a pre-registered comparison whose two gates are both unmet. Parked in `later/`. |

## 5. What was produced

Five roadmaps in `agents/roadmaps/`:
`-context-ledger`, `-runtime-skill-routing`, `-top-band-model-economy`,
`-scheduled-deprecation`, `-archive-index`; one parked in
`agents/roadmaps/later/`: `-llm-distillation-comparison`. All carry the
`road-to-inbox-harvest-2026-08-d-` prefix.

Four blockers were opened, all `owner: user`, each blocking one named step: the
`paths:` scoping consumer flip, the skill-trigger precision-gate source, the
ADR-035 reopen question, and the code-graph removal authorisation. None of them
blocks a phase that can proceed without the answer.
