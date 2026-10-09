---
model_tier: high
name: roadmap-resolve-blockers
pack: product-basic
visibility: internal
cluster: roadmap
sub: resolve-blockers
skills: [roadmap-management, ai-council, decision-review, roadmap-writing]
description: Check every open roadmap blocker, close what the tree already settled, decide the rest in the AI council, and ask the owner only for real residue — one question at a time.
argument-hint: "[<roadmap> | <blocker-id> | all] [--no-council] [--check-only]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /roadmap:resolve-blockers name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:resolve-blockers

Blocker sub of the [`/roadmap`](../roadmap.md) cluster. A `### blocker:` entry
records the world at the moment it was written, and nothing re-reads it: its
`Status:` word goes stale while the condition it waits on comes true, and a
decision an agent or the council could take sits in a file waiting for the one
reader whose attention does not scale. This command walks every open blocker,
closes the ones the tree already settled, decides the ones the council owns, and
reaches the owner only for what genuinely needs them — one question per turn,
with a recommendation, so answering costs one keystroke.

## The Iron Law

```
A BLOCKER'S STATUS IS A CLAIM ABOUT THE PAST. EXECUTE ITS `Resolved when`
AS A CHECK BEFORE TREATING IT AS OPEN.
RESOLVE AT THE LOWEST RUNG THAT OWNS THE DECISION: EVIDENCE → RECORDED RULE →
EXECUTION → AGENT → INDEPENDENT SESSION → COUNCIL → OWNER.
THE OWNER IS THE LAST RUNG, NEVER THE FIRST, AND NEVER FOR A TECHNICAL DECISION.
NO OWNER QUESTION IS PUT BEFORE ONE BATCHED COUNCIL PASS HAS RUN OVER EVERY
UNDECIDED BLOCKER OF THE RUN — OWNER-LABELLED ONES INCLUDED. A BLOCKER'S
`Owner:`, `Ownership:` OR "YOURS TO SET" IS ITS AUTHOR'S GUESS; THE COUNCIL'S
OWNER-RESERVED TEST DECIDES WHO MUST ANSWER.
NEVER PASS `--confirm` OR BUY METERED COUNCIL SPEND WITHOUT THE OWNER'S YES.
THE OWNER IS ASKED ONE QUESTION PER TURN, WITH OPTIONS AND ONE RECOMMENDATION,
AND THE ANSWER IS WRITTEN DOWN BEFORE THE NEXT QUESTION IS PUT.
NEVER HAND BACK A FILED QUESTION OR A COUNT OF OPEN QUESTIONS.
A BLOCKER IS CLOSED ONLY BY `- **Status:** resolved` — AND ONLY WITH EVIDENCE.
NO RUNG LIFTS A HARD FLOOR OR AN OWNER-RESERVED INVARIANT.
```

## Argument

| Given | Scope |
|---|---|
| a roadmap path | that roadmap's open blockers |
| a blocker id | that one blocker |
| `all` or nothing | every open blocker in the active roadmaps |
| `stubs` | the open blockers in `agents/roadmaps/stubs/` |

`--check-only` stops after Phase 2 — conditions executed and reported, nothing
written. `--no-council` stops each decision at the agent rung and presents the
council-owned ones as proposals instead of running the council.

The dashboard parser skips `stubs/`, so `stubs` is read by grep instead
(`grep -n '^### blocker:' agents/roadmaps/stubs/*.md`, then each entry's five
fields) — and only on request, because a stub records a decision still to take,
not a plan in flight. `later/`, `archive/` and `skipped/` are out of scope — their blockers are history
or are re-checked by [`/roadmap:triage-parked`](triage-parked.md).

## Where the work happens

The checked-out branch, like every `/roadmap` sub. A worktree, a branch, a commit
or a PR only on an explicit ask ([`scope-control`](../../rules/scope-control.md)
§ Git operations, [`commit-policy`](../../rules/commit-policy.md)).

## Instructions

### 1. Inventory — from the parser, never by reading files

```bash
agent-config gates --all --json
```

It is the dashboard's own parser (`collect()`), so the set is exactly what the
dashboard counts. Per blocker it gives `id`, `roadmap`, `owner`, `class`,
`blocks`, `unblocksSteps`, `todo` and `resolvedWhen`. The class says who may act:
`0` deterministic and free (a `Run:` command) · `1` billable but reversible (a
`Run:` command inside the gate budget) · `2` council-decidable · `3` human-only —
and `3` is also the **absent-field default**, so most `3`s were never classified
at all. Re-classifying a technical `3` to `2` is a legitimate outcome of this
run, recorded on the entry (`Class: 2 — council-decidable. Corrected from 3 on
YYYY-MM-DD`), written as the bold field `- **Class:** 2 — …` the lint reads.
Read each entry's `- **Ownership:**` too: `product-owned`, `business-owned` and
`destructive-owned` are the author's routing claim, written when nobody had run
the test. They mark a candidate for the owner, never a destination: the
blocker still goes into the council batch, whose owner-reserved test (§ Running
the council) decides whether it reaches the owner.

`unblocksSteps` is the open-step count of the whole roadmap the blocker sits in,
the same number for every blocker of that roadmap. Order by the steps a blocker
actually holds — `grep -c '<!-- blocked-by: <id>' <roadmap>` — and break ties by
`unblocksSteps`.

Show the inventory as one table before any write:

| # | blocker | roadmap | owner | class | unblocks | rung expected |

### 2. Check — execute every `Resolved when`, cheapest limb first

A status word records the past; the condition records what would end the wait.
Run it as a command:

```bash
gh pr view <n> --json state,mergedAt       # "PR X merged"
git log --oneline origin/main -- <path>    # "<file> landed on main"
ls docs/decisions/ADR-NNN-*.md             # "the ADR exists / names (a) or (b)"
grep -n '<key>' <file>                     # "<key> is present"
```

Verdict per blocker: `met` · `unmet` · `undecidable` (the condition names no
check — itself a finding, fixed in Phase 4 by rewriting `Resolved when` into one).

**A spend or quota blocker is checked against the live meter**, never the text:
`agent-config council:status` and `council_cli quota` show what is actually left.
A blocker that cites an exhausted budget the meter does not show is `met`.

**Read what the condition measures, not only whether it returns.** A condition
that keys on a value that never occurs is `met` never, whatever the world does;
that is a defect in the blocker and becomes a decision (Phase 3), not a wait.

`--check-only` ends here: the table with a verdict column.

### 3. Resolve — one rung at a time, stopping at the first that can

The ladder is the one [`/challenge-me:closure`](../challenge-me/closure.md)
uses, with one blocker-specific rung added (execution):

1. **Evidence** — the condition is `met`. Close it (Phase 4). No question exists.
2. **A recorded rule** — an ADR, contract, `## Decisions` row or earlier council
   verdict already answers the question the blocker asks. An ADR is evaluated
   before it is cited — `./scripts-run src/scripts/adr_cite_check <ADR-NNN>`
   (status, supersession, review trigger) — and a superseded or triggered one
   closes nothing ([`decision-revisit-gate`](../../rules/decision-revisit-gate.md)).
3. **Execution** — a class-0 blocker is a command whose output is the unblock.
   `agent-config gates --execute <id>` echoes the exact string; the run needs
   `--confirm`, and **`--confirm` is the owner's consent, not the agent's** — the
   `Run:` field is shell read out of a file. Collect every class-0 and in-budget
   class-1 command of the run and put them to the owner as **one** question
   (§ Asking the owner): the literal commands, *run all* · *run selected* ·
   *leave them*. Only on that answer does the agent pass `--confirm`. Class 1
   outside the gate budget is a spend question for the owner.
4. **The agent** — `deterministic` and `reversible-technical` choices inside
   stated conventions. Pick it, write why.
5. **An independent session** — the first rung for `contested-technical`: a
   second instance with no stake in the first answer.
6. **The council** — `critical-technical` decisions, process decisions the agent
   should not take alone, and every reopening of a recorded decision
   (`decision-revisit-gate` sends those council-first). See § Running the
   council. Where no council is available, the **team** rung (`ai_team`) takes
   its place.
7. **The owner** — **only** what the council's batch pass marked
   owner-reserved (either seat), or split on with the split surviving a
   measurement: `product-owned`, `business-owned` and `destructive-owned`
   decisions, and the transitions `decision-revisit-gate` reserves (lowering a
   safety floor, an irreversible or external commitment, spend above a
   delegated threshold, governance self-amendment). A technical decision never
   reaches here by being hard, and an owner-labelled one never reaches here
   without the council's pass. One exception, from the ownership contract: a
   `critical-technical` question with a single provider present degrades to
   **owner-confirm of the agent's proposal**, never to one model reviewing
   itself. See § Asking the owner.

`spend-exhaustion` leaves the ladder: it **pauses and reports** (§ Running the
council), it is not a question.

`Owner: user` on a blocker is **not** a reason to skip rungs 1–5. It records who
was expected to answer when the blocker was written; the ladder decides who
actually must. A blocker whose question the council can settle is settled there,
and its owner is told the outcome, not asked.

Things a blocker can wait on that **no rung can buy** — a real external party, a
calendar soak, a measurement campaign that needs sessions that have not happened,
a published release — stay open. For those the work is to make the wait
checkable: rewrite `Resolved when` into a command and, where it helps, add a
date. Never invent a decision to make one go away.

### Running the council

Council availability is the resolver's answer, never the project tree's:

```bash
agent-config council:status
```

1. **Batch the questions — all of them, before any owner question.** Every
   blocker rungs 1–4 did not close goes into **one** question file under
   `agents/runtime/council/questions/`, including those labelled `Owner: user`,
   `product-owned`, `business-owned` or `destructive-owned` — one numbered
   section per blocker, each carrying the blocker's five fields, the Phase-2
   evidence and the candidate options. One run, not one per blocker. The file
   opens with the owner-reserved test, quoted from `decision-revisit-gate`'s
   owner-reserved table: the chosen option would change the project's purpose
   or a declared non-negotiable outcome; **lower** or remove a recorded
   security / privacy / safety / data-handling floor; be irreversible or
   materially destructive; spend or carry liability above a delegated
   threshold; create, remove or weaken a legal, contractual, licensing,
   compatibility or public commitment; or amend governance itself (reopening
   authority, quorum, escalation, the owner-reserved set). Strengthening a
   floor, or anything reversible inside these bounds, is council-decidable.
   Each section then asks for three answers, in this order:
   1. **Owner-reserved?** — yes / no, naming the clause, per option where the
      options differ (one option can be reserved while another is not);
   2. **Choice** — the option the seat takes if it is council-decidable, and
      the option it would recommend to the owner if it is not;
   3. **The fact that would change the answer.**
   A recorded decision that reserved the question to the owner (a `## Decisions`
   row, an ADR) is put to the same test, as a reopening per
   `decision-revisit-gate` — the council says whether the reservation still
   holds; it never lifts one on its own authority.
2. **Write the question neutrally** — scope, evidence, options. No
   recommendation and no expected verdict, in either direction: the council is
   judging a decision the agent would otherwise take, so the agent's lean stays
   out of the prompt ([`evaluator-independence`](../../rules/evaluator-independence.md)),
   and the prompt is kept with the verdict.
3. **Estimate, then run.** The positional is a **file path**, never the question
   text:

   ```bash
   ./scripts-run src/scripts/council_cli estimate <q.md>
   ./scripts-run src/scripts/council_cli run <q.md> \
       --output agents/runtime/council/responses/<name> \
       --confirm --invocation agent
   ```

   In a fresh worktree, copy `agents/runtime/state/council-probes.json` from a
   checkout that has run a council first — without it every seat reads as
   unavailable. `--output` must sit under `agents/runtime/council/responses/`;
   any other directory is refused. A failed run still spends quota, so never
   re-run an unchanged question — with one exception: a seat that is absent
   for a **transport** reason (the response's `absent_members[].detail` names
   an OS, network or process error, not a refusal or a verdict) allows **one**
   transport retry of the unchanged file under a new `--output` name. The
   retry is recorded as such, and if a seat that answered both times changed
   its answer, both readings are reported. A second retry, or a retry after an
   unwelcome verdict, is verdict shopping.

   **Exhausted quota is `spend-exhaustion`: pause and report** — which questions
   needed the council, the quota reading, `estimate --mode-override api`'s cost,
   and what proceeds without it. Turning plan quota into metered spend is the
   operator's decision, never one this command infers
   (`docs/contracts/ai-council-config.md` § `fallback.api_on_quota`). Where the
   owner has said yes to the metered rung, `agent-config council:grant-billing
   <run_id>` records that yes for one run, and only then does
   `--mode-override api` run.
4. **Read the verdict honestly.** Route first: a blocker both seats call **not**
   owner-reserved is decided by the council's choice and never reaches the
   owner; one that either seat calls owner-reserved goes to the owner, carrying
   the seats' recommended option. Then the choice: 2/2 agreeing → decided. 1/2 present is a
   single-seat reading (`DEGRADED`), never a convergence: accept it for a
   `reversible-technical` or `contested-technical` question and say so; for a
   `critical-technical` one it degrades to owner-confirm of the proposal.
   A split usually names a disputed **fact** — measure it. A second council
   round is legitimate only when its input changed (the measurement, or a
   proposal narrowed to what a refusal named); it is recorded as a new round,
   and both verdicts are reported. Re-asking an unchanged question with a
   different wording, or dropping scope until the answer turns, is verdict
   shopping (`evaluator-independence` items 2 and 4). A split that survives the
   measurement goes to the owner, with both positions as the options.
5. **Record it inline.** `agents/runtime/council/` is gitignored and pruned, so a
   roadmap never cites that path (`check_council_references`). The record is a
   `## Decisions` row plus the blocker's status line carrying date, members,
   verdict and cost.

### Asking the owner — one question, one keystroke

```
ONE QUESTION PER TURN. THE MOST UNBLOCKING ONE FIRST.
EVERY QUESTION IS ANSWERABLE WITH ONE NUMBER.
THE ANSWER IS RECORDED AND APPLIED BEFORE THE NEXT QUESTION IS PUT.
```

The queue holds only what the council's batch pass routed here (§ Running the
council, step 4) — never a blocker the pass did not see, and never one both
seats called council-decidable. With `--no-council`, or when no seat is
available, say so in the queue line: the routing is then the agent's, unchecked.

Before the first question, one short line says how many owner questions the run
has left after the council (`3 decisions need you — here is the first`), so the
owner knows the length of the queue. Then, per question:

- **Context in two sentences** — what is blocked and what it unblocks.
- **What the council said** — why it is owner-reserved (the clause each seat
  named), and the option each seat would recommend, or the split.
- **What exactly you do**, if the answer needs an act only the owner can
  perform — a repository setting, a ruleset toggle, a credential, a tag: the
  literal step (the page, the field, the command), so nothing has to be looked
  up or asked back.
- **Numbered options**, each naming what changes if picked — the blocker's own
  options where it has them, the council's otherwise; the last option is always
  *leave it open*.
- **One recommendation line** directly under the options
  ([`user-interaction`](../../rules/user-interaction.md)).

The answer is written into the roadmap (Phase 4) and the dependent step
unblocked **before** the next question appears. A *later* or *skip* answer moves
to the next question; the blocker stays open and is not re-asked in this run
([`scope-control`](../../rules/scope-control.md) § Decline = silence).

`agent-config gates --reply` gives the `Blocked:` / `Do:` / `Done when:` lines
of the top user-owned blocker across the whole tree — raw material for a
question, not the question: it carries no options, no recommendation and no
council verdict, and it may name a blocker this run already classified
differently.

### 4. Write — close, record, unblock

Per resolved blocker:

1. **Status line** — already written by `gates --execute --confirm` for an
   executed blocker (leave it, add only the Decisions row); otherwise
   `- **Status:** resolved YYYY-MM-DD — <decision, one line>
   (<rung>: <evidence | ADR-NNN | council YYYY-MM-DD, <members>, <verdict>, $<cost> | owner>)`.
   `resolved` must be the first word: it is the only closing token
   `lint_roadmap_blockers`, the dashboard and the estate count accept.
2. **`## Decisions` row** in the same roadmap —
   `| ID | ownership | resolved by | decision | evidence | revisit if |` —
   `ownership` one of the eight classes (`deterministic`,
   `reversible-technical`, `contested-technical`, `critical-technical`,
   `product-owned`, `business-owned`, `destructive-owned`, `spend-exhaustion`),
   `resolved by` one of `evidence` (also the recorded-rule and execution rungs),
   `agent`, `independent:<session or model>`, `council:<date-slug>`,
   `team:<record>`, `owner`;
   then `./scripts-run src/scripts/lint_decision_classes`.
3. **Unblock the steps** — remove each `<!-- blocked-by: <id> -->` annotation the
   blocker held. The work itself is not started here.
4. **A blocker that stays open** gets its `Resolved when` rewritten into a check
   when Phase 2 found it `undecidable`, its `What to do` updated with what this
   run learned, and a `- **Recommendation:**` and an `- **If you do nothing:**`
   line where it lacks them. An owner question that was asked this run flips its
   `blocked-by:` annotations from `asked: no — …` to `asked: yes`.

Then regenerate and lint what changed:

```bash
./agent-config roadmap:progress --no-archive
./scripts-run src/scripts/lint_roadmap_blockers
./scripts-run src/scripts/check_estate_count
```

A run that closes blockers lowers `open_blockers`; that is the drawdown the
estate gate wants and needs no claim; when `lint_roadmap_blockers` then reports
its decidability baseline as loose, lower it in the same change. A roadmap whose last blocker closed while
it has no open step is now archivable — name it in the output;
`./agent-config roadmap:progress` without the flag sweeps it. A decision whose
**implementation** touches governance surfaces (`src/config/gate-coverage.yml`,
workflows, kernel rules) needs its ratification artifact in that later change;
deciding it here does not. A run that **adds** a blocker (splitting
one, or recording a newly found external wait) grows it and needs an
`estate_growth_exempt: <reason>` line added to that roadmap's frontmatter in the
same change.

## Output

1. The inventory table with the Phase-2 verdict and the rung that closed each.
2. Per closed blocker: one line — what decided it and where it is recorded.
3. The council run(s): question count, members present, verdict per question,
   cost.
4. **The ledger** — the run's completeness check:

   ```
   blockers   N in scope
   closed     by evidence n · by recorded rule n · by execution n · by agent n · by council n · by owner n
   open       waiting on external n · owner said later n · undecidable → rewritten n
   steps      N unblocked across M roadmaps
   ```

   Every blocker in scope appears in exactly one bucket.
5. Roadmaps that became archivable because their last blocker closed.
6. If owner questions remain: the queue length and the **first question** — never
   the list.

## Honest enforcement — `instruction-only`

`lint_roadmap_blockers` checks a blocker's shape and the closing token; nothing
checks that a `Resolved when` was executed rather than read, that a council
verdict was reported at its real quorum, or that an owner question was the
council's to answer. The ledger and the inline council record are the control.

## Do NOT

- Mark a blocker resolved because its status is old, or because a sibling PR
  looks related. The condition, executed, is the only evidence.
- Ask the owner what the tree, a recorded decision or the council can answer —
  *"Owner: user"*, `Ownership: product-owned` or *"yours to set"* in the file
  is not a reason.
- Put the first owner question before the council's batch pass has run over
  every undecided blocker, or classify a blocker as owner-reserved yourself
  when a council seat is available to run the test.
- Ask more than one question per turn, or hand back *"four decisions are open in
  file X"*.
- Run the council once per blocker, or re-run an unchanged question after a
  failure — beyond the single transport retry § Running the council allows.
- Pass `--confirm` or switch to metered council spend without the owner's yes.
- Cite `agents/runtime/council/` from a roadmap.
- Execute the work a resolved blocker unblocks — this command authorizes
  deciding and recording, not doing ([`scope-control`](../../rules/scope-control.md)
  § Authoring vs. implementation). `/roadmap:next` or `/roadmap:process-full`
  picks the work up.
- Lift a Hard Floor ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md))
  through any rung — a council verdict authorizes no deploy, push, deletion or
  spend beyond the standing budget.
