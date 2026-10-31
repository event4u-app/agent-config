---
complexity: structural
status: done
tree_pin: 14012757df
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-agent-config-next
    relation: disjoint
    note: "That file parks an eleven-track ARCHITECTURE tournament program. This roadmap is a per-task solution bracket inside do-competitively — a different mechanism; nothing here reopens the parked program."
  - slug: road-to-seats-that-know-why-they-failed
    relation: disjoint
    note: "Owns free-seat failure vocabulary. Consumer-content free seats (E9) wait on attestation there and in the free-route line; this roadmap only reads what is admissible today."
---
# Road to a loss that can be appealed

> **Source:** `agents/tmp.old/inbox-2026-10-ca/` — one owner chat (three owner turns)
> and three supplied plans (two revisions of one plan, one tree-verified plan).

## Goal

`do-competitively` gains a resumable bracket route, `/judge bracket`, that AC sizes
itself (default 10 lines, 100 only for owner-reserved or explicitly "extremely
important" questions), in which a lost match can be appealed: an eliminated line may
re-enter at most twice, decided by a paid seat, with free seats admitted only where
the content class allows. The script computes every score; no judge prose decides.

## Owner constraints (from the transcript — acceptance criteria, not steps)

| # | Constraint (owner's words, condensed) | Discharged by |
|---|---|---|
| M1 | An elimination is checked; a council can play a "you go through" card, up to 2× per idea | 3.x, AC-3 |
| M2 | 100 agents are expensive: only for extremely important matters or when AC takes a user decision off the owner | 4.1, AC-4 |
| M3 | The re-admitting jury is partly free APIs when the content allows; the arena too | 2.1, AC-5 |
| M4 | AC sets the count dynamically: default 10, rising with importance | 4.1, 4.2, AC-4 |

**Acceptance criteria.** AC-1 every stub bracket for N ∈ {1,2,3,7,10,20,100} ends with
exactly one line; AC-2 a verdict carried by a `free-quota` seat is refused at collect;
AC-3 no line spends more than 2 cards, and a judging error is corrected without a card;
AC-4 the default tier is 10 lines, S4 (100) is reachable only from an owner-reserved
signal or the user, and an agent can never raise its own tier above S2; AC-5 free
seats are 0 for `project-content` without proven local weights, and the plan line says
so; AC-6 the simulated appeal (C2a) is measured and reported, pass or honest null.

## Verified against the tree (pin 14012757df)

| # | Finding | Evidence |
|---|---|---|
| F1 | `competitive` dispatch family absent from a month of production | `internal/bench/orchestration/backfill-2026-08-07.md:60` |
| F2 | Mode 5 is N candidates + one judge in one shot: no rounds, state, resume | `src/skills/subagent-orchestration/prompts/do-competitively.md` |
| F3 | `juryPairwise` (both orders, ≥ 2 families, ≤ 5 seats) has no production importer — and AC-9 of its roadmap pins it shadow-only | `src/scripts/ai_council/jury_aggregate.ts:160`; `tests/scripts/ai_council/jury_aggregate.test.ts:288-308` |
| F4 | `DEALBREAKER` is called "a veto" in the skill; the tally only counts it | `src/skills/ai-council/references/output-and-synthesis.md:99`; `src/scripts/ai_council/stance_tally.ts:193-194` |
| F5 | `/council default` contradicts itself on both caps `0`: table "No ask", Step 3 asks — ADR-279 says no ask | `src/domains/meta/council/default/command.md:165`, `:205-206` |
| F6 | Settings description names `/do-in-parallel` and `/do-competitively` — no such commands | `src/server/schemas/settings.ts:342` |
| F7 | ADR-257 (free seats propose and score, never decide) is `instruction-only`: no gate reads which seat carried a verdict | `docs/decisions/ADR-257-unpaid-route-may-propose-and-score-never-decide.md:98-100` |
| F8 | Free seats for consumer project content today: 0 (one attested route, maintainer-only; default class `project-content`) | `src/scripts/ai_council/free_route_catalog.ts:55-80`; `content_ceiling.ts:28` |

**Decision-revisit (F3).** The appeal jury would consume `juryPairwise`, which AC-9 pins
shadow-only until the shadow ledger accumulates. Mechanism-match: the lock covers a
production consumer of a jury score; that is exactly this. So this roadmap does **not**
import it: the bracket accepts an appeal-jury result as an optional, typed input that is
`null` until the AC-9 condition lifts (stub `road-to-an-appeal-jury-wired`). The card is
decided by the paid seat alone meanwhile — ADR-257 holds either way.

## Phase 0 — Truth surfaces (independent, small)

- [x] **0.1 (F4)** `DEALBREAKER` described as a blocking signal the tally counts, not a veto. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/server/schemas/settings.ts -->
- [x] **0.2 (F5)** `/council default` Step 3 aligned to ADR-279: both caps `0` → no gate. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/server/schemas/settings.ts -->
- [x] **0.3 (F6)** Settings description names `/judge bracket` and the real surfaces; a drift <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/server/schemas/settings.ts -->
      test asserts every `/slash` name in settings descriptions resolves to a command.

## Phase 1 — Bracket substrate

- [x] **1.1** One `bracket.json` per run under `agents/runtime/bracket/<run-id>/`, written <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      atomically; subcommands `plan | init | next | collect | advance | status | winner`.
- [x] **1.2** Completion by output-file presence; a missing output is re-requested once, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      then recorded `NO OUTPUT`. No waiting on the host.
- [x] **1.3** Briefs rendered by script; the task is byte-identical across lines (hash in state). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
- [x] **1.4** Scoring in the script: weighted rubric sum; an upheld FATAL loses <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      lexicographically; judge pick ≠ points → points win, with a note; unreadable verdict
      → re-request, never orchestrator choice.
- [x] **1.5 (F7)** Every verdict stores its seat's billing class; `collect` refuses a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      verdict carried by `free-quota`.
- [x] **1.6** Spawn dedupe: near-duplicate solutions (novelty threshold of the debate gate) <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      merge into one line, recorded `duplicate-of`.

## Phase 2 — Seats by content class (M3)

- [x] **2.1** `freeSeatAllowance(contentClass, localProven)`: `public-artifact` → up to 50 % <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      free competitor seats and up to 4 of 5 jury seats from ≥ 2 families; `project-content`
      with proven local weights → local seats only; otherwise 0, with the reason rendered
      in the plan line. A free route answering 402 becomes `NO OUTPUT`, never a silent paid
      fallback.

## Phase 3 — Appeal and the card (M1)

- [x] **3.1** Appealable when any holds: weighted gap ≤ 5/100; pick ≠ points; loser has <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      higher correctness; loser's only FATAL was rebutted; seeded audit sample.
- [x] **3.2** A judging error (misread check, unsupported FATAL) is a **correction**: the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      match is reversed and no card is spent.
- [x] **3.3** The card: at most 2 per lineage (paraphrase cannot reset — counted on the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      dedupe lineage); card 2 needs new evidence; the returnee faces a **new** opponent;
      the winner stays in (no overturn); no card while an upheld FATAL stands; the next
      judge never sees card state; the card is played only by a paid seat.
- [x] **3.4** Termination: each line is eliminated at most 3×, so ≤ 3N entries; the bracket <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      always ends with one line (property test).
- [x] **3.5** Simulation (C2a): noisy stub judge (15 % flip), known true ranking, 10 000 <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      runs — P(true #1 wins) with and without cards, plus mean extra calls. Reported in
      `agents/evidence/analysis/`, pass or honest null.

## Phase 4 — Size by importance (M2, M4)

- [x] **4.1** Tier table as data: S0 none · S1 10 (default) · S2 20 · S3 ≤ 64 · S4 100; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      calls `6N − 5` per tier in the plan line.
- [x] **4.2** `resolveTier`: raise above S2 only from deterministic signals (security-surface <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      path hit, owner-reserved transition flag) or the user; the agent may always lower;
      the plan names the signal. S4 prepares an owner decision, never signs it.
- [x] **4.3** Saturation stop: spawn in waves; two consecutive waves adding < 20 % new <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      lines after dedupe stop the spawn — N is a ceiling, not a quota.
- [x] **4.4** S3/S4 always ask once with the plan (paid vs. free calls separated). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->

## Phase 5 — Honest close and surface

- [x] **5.1** Final blind comparison winner vs. rejected baseline in **both** orders <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      (`judgeBothOrders`); `inconsistent` → "no clear winner"; never auto-applied.
- [x] **5.2** `/judge bracket` sub-command (cluster contract + dispatcher row); Mode 5 <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      points to it; the subagent-orchestration skill names it.
- [x] **5.3** Claims C1–C5 pre-registered in `docs/CLAIMS.md` before any live run. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->

## Deferred — stubs (need time, spend or an owner gate, not effort here)

- `road-to-an-appeal-jury-wired` — wire `juryPairwise` as the appeal input once AC-9's
  shadow-ledger condition lifts.
- `road-to-bracket-live-measurements` — C1 diversity, C2b live card yield, C3 bracket vs.
  single judge, C5 saturation savings: spend-bearing, owner-asked per run.
- `road-to-bracket-write-scope-hook` — `pre_tool_use` deny on writes outside the run dir
  (claude-only deny; model-carried elsewhere).
- `road-to-owner-reserved-table-as-data` — render the owner-reserved table of
  `decision-revisit-gate` from data (kernel-rule edit: own PR, 24 h soak).

## Kill list

Default 100 · a new standalone "arena" skill · calling a same-model fan-out a council ·
overturning a winner · cards on orchestrator say-so or > 2 per line · the judge seeing
card state, lineage or family · auto-applying the winner · persona cards · a free route
carrying a verdict or playing the card · project content to a free route without local
proof · self-raising above S2.

## Decisions

| # | Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|---|
| E1 | `/judge bracket` as a visible sub-command | hidden Mode-5 flag | F1: the hidden mode was never used | sub-command unused for 60 days |
| E2 | State under `agents/runtime/bracket/` | Work-State engine | no engine change; gitignored runtime | a resume consumer needs the engine cursor |
| E3 | No council, no local model, project content → the card is a paid seat one tier higher, reported as "second look", never "council" | skip appeals | `council-availability`: a fan-out is never a council | council configured |
| E4 | Card on by default | off until C2b | M1 is an owner directive | C2b honest null → narrow signals |
| E5 | S3 ceiling 64, saturation decides between 32 and 64 | fixed 32 / 64 | N is a ceiling | C5 null |
| E6 | Appeal jury not wired now | wire `juryPairwise` | AC-9 lock (F3) | AC-9 condition lifts |
