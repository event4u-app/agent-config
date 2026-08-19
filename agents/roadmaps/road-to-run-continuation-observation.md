---
complexity: lightweight
execution:
  mode: autonomous
parent_roadmap: road-to-long-horizon-execution
estate_offset_exempt: >-
  Offset in the same change by archiving road-to-long-horizon-execution, whose sole deferred item
  this roadmap carries. Net estate change is zero; the field is present because the ratchet reads
  the addition before it reads the archival.
---

# Road to a run-continuation engagement anybody can point at

> **Source:** the sole deferred acceptance criterion of
> `road-to-long-horizon-execution`, carried here under the preservation
> test in `roadmap-progress-sync § Who resolves it` rather than dropped
> at that roadmap's archival. AI council 2026-08-19, unanimous 2/2
> (anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer
> review): fix the blocker now, carry the criterion, close it only on a
> recorded run.

## Context

`run-continuation` is the stop-slot concern that re-engages a run while
its claimed roadmap still has open steps. It shipped, it is unit-tested
(21 cases), it is integration-tested against the real dispatcher (7
cases) — and it had **never fired once** outside a test.

The cause was a defect, not a missing step, and it is fixed: the run
contract had two halves resolving different roots. `sessions:claim`
wrote the claim under `process.cwd()` (the operator's worktree) while
the concern read it under `--project-dir` (the parent checkout). In a
worktree those are different trees, so the concern found no contract,
took its `contract absent → no-op` rung, and wrote **no event** — an
empty ledger that looks exactly like a healthy idle run. The claim now
lives in the git common dir beside the session register.

What remains is not work. It is an **observation**, and it is the one
thing the fix cannot supply: a real run, started from a worktree, that
engages and leaves the event behind.

## Phases

### Phase 0 — Observe one engagement

- [x] **0.0** A `process-full` run started from a worktree, under a
      `sessions:claim`, writes at least one `engage` line to
      `agents/runtime/state/run-continuation.jsonl`. Record the run id,
      the roadmap, and the iteration count the ladder reached.
      The event is the evidence; a green test is not, and the reason is
      the whole point of this roadmap — the integration test passes the
      SAME root to writer and reader, which is the one arrangement in
      which the defect was invisible. Only a real two-tree run proves
      it.
      `verify:` `cat agents/runtime/state/run-continuation.jsonl`

  **OBSERVED 2026-08-19T14:24:20Z.** The mechanism fired for the first
  time outside a test.

  | Field | Value |
  |---|---|
  | run id | `12653f90d7cb4243821392afd5d8c4db` |
  | roadmap | `road-to-run-continuation-observation` |
  | iteration reached | 1 of 25 (`engage`, not a halt rung) |
  | turn / open / blocked | 2 / 2 / 0 |
  | claim written from | the worktree `<repo>/.claude/worktrees/long-horizon`, by `agent-config sessions:claim` at 14:23:21Z |
  | claim file | `<repo>/.git/agent-claims/roadmap-claim-fc48c551-….json` — the SHARED common dir |
  | concern read under | `--project-dir <repo>` — the parent checkout |
  | `git_dir` vs `git_common_dir` | `<repo>/.git/worktrees/long-horizon` vs `<repo>/.git` — different, i.e. a genuine linked worktree |

  `<repo>` stands for the absolute checkout path, redacted on purpose: the real
  prefix carries the maintainer's name, which `domain-safety-pii` keeps out of a
  tracked file. The *relations* above are what the audit needs and they survive
  the substitution intact — every path shares the one prefix, so the
  inequalities and the containment still read off the table.

  **Why this is the two-tree case and not a same-root one.** The writer
  ran in the worktree and the reader ran in the parent checkout — the
  exact asymmetry that produced no event before the fix. It is also
  sharper than the roadmap anticipated: `CLAUDE_PROJECT_DIR` resolves to
  the **parent checkout** even in a worktree session, so the ledger and
  the step's own `verify:` path both live in the parent tree, not in the
  worktree the run was started from. The roadmap's `verify:` line is
  therefore correct only when run with the parent checkout as cwd.

  **Two limits, recorded rather than smoothed over** (AI council
  2026-08-19, 2/2 convergent, blind peer review — anthropic +
  openai seats):

  1. *Self-referential.* The claimed roadmap IS this roadmap, so the
     open checkbox that caused the engagement is the one the engagement
     discharges. Both seats accepted it for 0.0 — the property under
     test is two-tree claim discovery, which does not care which roadmap
     is claimed — and both bounded it: this proves claim discovery
     across distinct roots, and **nothing** about sustained
     re-engagement, timing, or diverse-work detection. Ecological
     validity is that of a production smoke probe, not of ordinary
     autonomous work.
  2. *The provenance fields are test-verified, not self-verified.* The
     same change adds `workspace_root` / `session_root` / `git_dir` /
     `git_common_dir` / `claim_path` to every event, so a future line
     carries the two-tree fact itself instead of needing this table.
     `session_root` is the field R2 finding 1 added after the fact: the
     first version derived both git fields from the READER's root, where
     they are equal in exactly the arrangement documented above, so the
     enrichment could not express the property it was built for. This event does not
     carry them: the live hook is the parent checkout's `dist/` build,
     and the enrichment was built in the worktree. Verified by
     `tests/hooks/run_continuation_dispatch.test.ts` over a real
     `git worktree add` fixture — which reds against the un-enriched
     event while the other eight cases stay green.

     **Superseded 2026-08-19 by a live event, and the live event refuted
     the fields.** The enrichment merged, `dist/` was rebuilt, and the
     concern fired again from a worktree session at
     `2026-08-19T17:18:12.843Z` (run `e9bcaa908c103495bd817f4217a03316`).
     That line carries the four fields — and reads:

     | Field | Value |
     |---|---|
     | `workspace_root` | `<parent checkout>` |
     | `git_dir` | `<parent checkout>/.git` |
     | `git_common_dir` | `<parent checkout>/.git` |
     | `claim_path` | `<parent checkout>/.git/agent-claims/roadmap-claim-<session>.json` |

     The two git paths are **identical**, on a run that genuinely started
     from `.claude/worktrees/long-horizon`. So the discriminator this note
     promised — `git_dir !== git_common_dir` → linked worktree — reads
     FALSE for exactly the case it was built to detect, and
     `claim_path ⊂ git_common_dir` holds in a plain checkout too and
     cannot disambiguate. The two-tree fact is not recoverable from the
     line at all.

     R2 finding 1 predicted this from the code before the line existed;
     the line is the production confirmation, not a second opinion. The
     fix derives both git fields from `session_root` — the session's own
     checkout, resolved through the register's `session_checkout` guard —
     and ships `session_root` as a fifth field so writer-vs-reader
     divergence is itself readable per event. On the line above,
     `session_root` would have been the worktree and `workspace_root` the
     parent: different, which is the fact.

- [ ] **0.1** The parent criterion closes on that evidence: *"a
      `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the
      PR."* Half of it was observed on 2026-08-19 — the zero-contact
      property — but it came from the operator's standing mandate, not
      from the mechanism, and attributing it to the mechanism is the
      attribution error the parent roadmap's own falsification criteria
      are written against. Step 0.0 supplies the missing half.
      `verify:` `./scripts-run src/scripts/interruption_report --root <main-checkout>`
      <!-- blocked-by: three-phase-contract-run -->
      **Stays open on the council's explicit scope boundary, not on
      effort.** Step 0.0's engagement discharges 0.0 and no more: this
      roadmap has ONE phase, so "finishes a 3-phase roadmap" cannot be
      read off this run however the rest of it went. Closing 0.1 here
      would be exactly the attribution error its own text warns about,
      one layer up. See `### blocker: three-phase-contract-run`.

## Acceptance criteria

- [x] `run-continuation.jsonl` holds at least one `engage` event from a
      worktree-started run, with the run id recorded here.
      Run id `12653f90d7cb4243821392afd5d8c4db`, recorded in step 0.0.
- [~] The AUTONOMY AXIS in `interruption_report` reports a non-zero
      median re-engagement count for at least one run.
      **Satisfied on the per-run reading, unsatisfiable on the aggregate
      one, and therefore DEFERRED rather than closed.** A median is taken
      *across* runs, so "median … for at least one run" cannot be
      satisfied as literally written by any number of runs. The per-run
      breakdown is what the qualifier points at, and it reports
      `12653f90d7cb4243  … re=1` — non-zero for exactly one run, as
      asked. The aggregate `median re-engagements:` stays **0**, and will
      until a majority of the window's runs engage (13 of 24 today); that
      is a property of the statistic, not a gap in the evidence.

      **Reopened 2026-08-19 on R2 finding 5, and the glyph is the whole
      point.** The previous revision ended "anyone reading the criterion
      the aggregate way should reopen this box" — and then marked the box
      `[x]`, which is the one glyph that makes that instruction
      unreachable. `[x]` counts as done, so once step 0.1 closes the
      archival sweep would have seen `count_open == 0` **and**
      `count_deferred == 0` and archived this roadmap over a criterion the
      roadmap itself flags as unresolved: the silent-archive-of-open-work
      case Iron Law 3 of `roadmap-progress-sync` exists to catch, routed
      around by glyph choice rather than by argument. `[~]` routes it
      through the deferred-resolution gate instead, where the two readings
      are decided by someone rather than left "settled" by a checkbox.

      **What closes it:** either a window in which a majority of runs
      engage, so the aggregate median is non-zero on the criterion's
      literal wording — or a deliberate re-wording of the criterion to the
      per-run reading, which is a decision about what was being measured
      and not a re-measurement.

## Blockers

### blocker: three-phase-contract-run
- **Status:** open
- **Owner:** any autonomous `process-full` run, no dedicated effort
- **Class:** 3 — human-only, and deliberately not 0. An agent executes the
  *work* that discharges this, but it cannot authorize the trigger: picking
  which roadmap gets worked next is the operator's call
  (`scope-control § Authoring vs. implementation`), so there is no `Run:`
  command that produces a qualifying run. Declaring 0 and pointing `Run:` at
  the *check* command would label a verification as a discharge, which is the
  gate-that-cannot-fire shape this repo already rejects once.
- **Blocks:** step 0.1 only. Step 0.0 is closed on its own evidence and does
  not wait for this.
- **What to do:** claim a roadmap that (a) carries `execution.mode: autonomous`
  in its frontmatter, (b) has **three or more `## Phase` sections with open
  steps**, and (c) is not this roadmap — then run it to completion from a
  worktree and open its PR. Check candidates with
  `./agent-config roadmap:progress` for the phase count and
  `grep -A2 '^execution:' agents/roadmaps/<slug>.md` for the mode; a roadmap in
  `phase-checkpoints` mode makes the concern a no-op and produces no event at
  all. Then read the run back with
  `./scripts-run src/scripts/interruption_report --root <main-checkout>` and
  confirm `asks=0 handbacks=0` alongside a non-zero `re=` on that run id.
- **Recommendation:** **do not schedule this.** Wait for the first qualifying
  run and close 0.1 off it, because the criterion is about what the mechanism
  does during ordinary work — manufacturing a three-phase run to satisfy it
  reproduces the ecological-validity problem the council already flagged
  against the self-referential observation, one size larger. The estate has
  several three-phase autonomous candidates already; the next one to be worked
  discharges this for free.
- **If you do nothing:** step 0.1 stays open and this roadmap stays in the
  active estate at 3 of 4 items. Nothing regresses and no evidence decays —
  the ledger line from 0.0 is durable. The cost is one open roadmap carrying
  one criterion, which is the shape its own risk 3 accepts by design.
- **Resolved when:** `interruption_report` shows one run id with `re=` non-zero,
  `asks=0`, `handbacks=0`, whose claimed roadmap had ≥ 3 phases and reached a
  PR — and that run id is recorded at step 0.1.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The observation is claimed from a green test rather than a real run | product | The defect survived a release precisely because a passing integration test looked like proof; accepting a test as the evidence here would repeat that exactly. | Step 0.0 names the `.jsonl` line as the artifact and says in its own text why a test cannot substitute. | Phase 0 |
| 2 | The engagement fires but the ladder halts on the wrong rung | implementation | An `engage` event proves the contract was found, not that the termination ladder behaves; a stall-halt on the first iteration would satisfy the letter of 0.0. | 0.0 records the iteration count reached, so a degenerate single-iteration engagement is visible in the evidence rather than hidden by it. | Phase 0 |
| 3 | This roadmap becomes the indefinite deferral it was created to avoid | product | Carrying an item into a follow-up is exactly the shape both council seats named in their strongest counter — a named destination is not a schedule. | The criterion closes on the FIRST qualifying run rather than on a dedicated effort, so any future `process-full` in a worktree discharges it as a side effect. If none has by the next task boundary it is raised again per `active-remediation`, not aged out. | Phase 0 |
