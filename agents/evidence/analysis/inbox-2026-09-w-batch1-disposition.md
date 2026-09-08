<!-- evidence-type: analysis -->

# Round `inbox-2026-09-w`, batch 1 — disposition

**Drained:** 2026-09-08 · **Tree pin:** `main@399beecab` · **Proposals' own pin:** `e9d5202`
**Batch:** 1 of 2. Batch 2 (`roadmap-release-blocker`, 5 files, ~173 KB, ~700 anchors) is
**deferred and NOT consumed** — it stays under `agents/tmp/inbox-2026-09-w/` so the next run
finds the files rather than an empty folder and a memory.

## Round shape, and why it was batched

| Metric | Value |
|---|---:|
| Topic folders | 2 |
| Files | 24 |
| Bytes | ~440 KB |
| Anchors (headings · steps · separators · enumerations) | 1655 |
| Decision ids argued across the round | 190 distinct |

440 KB is over the ~400 KB batch threshold. The measured relationship the threshold rests on
is monotonic across five consecutive rounds: adoption rate falls as round size rises, and the
largest round measured produced the lowest rate and the fewest topic plans. One batch per run
is therefore the finding, not throughput management.

**Batch order was set by owner instruction on 2026-09-08**, mid-run: the autonomy roadmaps
take precedence and must be worked first in following runs. The order in this run was flipped
accordingly, and the precedence itself is recorded in ADR-268 § 11 — because an instruction
recorded only in a round-scoped artifact is the exact failure this round is about.

## Triage — batch 1, `better-autonom-agents`, 19 files

Genre, age and disposition. `lineage` from `lint_consolidation_lineage` plus the mtime
ordering, which is what separated three generations the census could not see.

| # | File | Genre | mtime | Generation | Lineage | Disposition |
|---|---|---|---|---|---|---|
| 1 | `chat.txt` | transcript | 11:53 | — | n/a | **primary demand source** |
| 2 | `chat-claude.md` | transcript | 10:30 | — | n/a | **interview record, 8 questions** |
| 3 | `chat-gpt.md` | transcript | 10:49 | — | n/a | **interview record, 15 questions** |
| 4 | `00-README-master-sequence.md` | consolidation | 10:31 | gen 1 | superseded | read, superseded |
| 5 | `01-road-to-run-scoped-grants.md` | supplied plan | 10:31 | gen 1 | superseded | read, superseded |
| 6 | `02-road-to-questions-before-execution.md` | supplied plan | 10:31 | gen 1 | superseded | read, superseded |
| 7 | `03-road-to-control-in-ci.md` | supplied plan | 10:31 | gen 1 | superseded | read, superseded |
| 8 | `00-autonomy-master-sequence-final-2026-09-08.md` | consolidation | 11:19 | gen 2 | superseded | read, superseded |
| 9 | `01-…-mission-authority-and-policy-convergence-final.md` | supplied plan | 11:19 | gen 2 | superseded | read, superseded |
| 10 | `02-…-decision-closure-and-challenge-me-final.md` | supplied plan | 11:19 | gen 2 | superseded | read, superseded |
| 11 | `03-…-independent-tdd-ci-and-long-run-execution-final.md` | supplied plan | 11:19 | gen 2 | superseded | read, superseded |
| 12 | `00-autonomy-master-consolidation.md` | consolidation | 11:41 | **gen 3** | **complete** | **operative — adopted** |
| 13 | `01-road-to-typed-grants-that-persist.md` | supplied plan | 11:41 | gen 3 | complete | **adopted, corrected** |
| 14 | `02-road-to-decision-closure.md` | supplied plan | 11:41 | gen 3 | complete | **adopted, corrected** |
| 15 | `03-road-to-adversarial-verification-and-long-runs.md` | supplied plan | 11:41 | gen 3 | complete | **adopted, corrected** |
| 16 | `README(1).md` | consolidation | 11:51 | gen 4 | **ghost** | read, discharged below |
| 17 | `road-to-mission-bound-autonomous-agent-config.md` | supplied plan | 11:51 | gen 4 | undeclared | read, folded |
| 18 | `road-to-mission-bound-autonomous-agent-config (1).md` | duplicate | 11:51 | gen 4 | — | **byte-identical to 17** (`md5 c77d365f…`), no separate read |
| 19 | `road-to-independent-tdd-recovery-green-to-merge.md` | supplied plan | 11:51 | gen 4 | undeclared | read, folded |

**The generations were invisible to the census** — four stem families, no shared version
marker — so `inbox_source_census` reported one revision set in the whole round and zero in
this folder. The mtime ordering is what recovered them, and it changes the reading
completely: gen 3 declares gens 1 and 2 as its complete parent set, and gen 4 arrived **ten
minutes after** gen 3 and is therefore not covered by that declaration.

### Lineage discharges

- **`README(1).md` — `ghost`.** It declares a three-file set and names
  `road-to-one-authority-policy-migration.md`, which is present in no form. Discharged as
  *read and adds nothing beyond its siblings*: its own summary of the missing file's scope
  ("Rules/ADRs/Gates/Commands/Skills migration") is the subject gen 3's § 3 corrections table
  and § 6 kill register already adjudicate row by row, and the two files that did arrive carry
  the same architecture. No content is lost by its absence; a name that resolves to nothing is
  recorded rather than chased.
- **Gen 4 vs gen 3 — undeclared, and it disagrees.** Gen 4's core claim is that the real
  problem is *policy replication* and the fix is a typed mission authority plus a
  **consequence engine** with a risk formula. Gen 3 killed exactly that formula (its K3) on
  the ground that ADR-260 § 2 forbids a natural-language authorization parser in enforcement,
  and replaced the score with **evidence fields on WARN ops**. Verified at HEAD: ADR-260's
  no-parser clause is real, at line 93. **Gen 3's resolution is adopted and gen 4's formula is
  declined** — not because gen 3 is newer, but because its decisive premise is the one that
  resolves in the tree. Gen 4's *policy replication* framing survives as the motivation behind
  `road-to-typed-grants-that-persist` Phase 6's generated disposition inventory.

## Verification — claims against the tree

The gen-3 consolidation is unusually accurate. Sixteen load-bearing claims were re-read at
`399beecab`; **thirteen hold verbatim, two hold with a corrected path, one is now stale.**

| Claim | Verdict | Note |
|---|---|---|
| ADR-260 § 2's eleven-op vocabulary and grant object | `still-true` | lines 83 and 88 |
| ADR-260's *no natural-language authorization parser* clause | `still-true` | line 93 |
| `autonomy: auto` in the settings template | `still-true` | line 342 |
| ADR-254 removed `block-unauthorized-git`; the classifier only measures | `still-true` | path corrected: `src/scripts/hooks/git_command_classifier.ts`, not `src/scripts/_lib/` |
| `check_no_automerge_key.ts` exists as a namespace ratchet | `still-true` | — |
| `produces_roadmap` does not exist | `still-true` | 0 hits |
| The command is `analyze:roadmap-repos`, not `analyze:repo-loop` | `still-true` | path corrected: `src/domains/analysis-workbench/analyze/roadmap-repos` |
| `src/skills/test-driven-development/` exists, unactivated by any rule | `still-true` | — |
| `staged_confirmation` is declaration-only, bound on no host | `still-true` | `command.schema.json:257` |
| ADR-255 § 4 refuses all four governance-self-amendment deletions | `still-true` | the ADR uses `### 4.`, not `### § 4` — the pointer resolves |
| `block_kernel_rule_writes.ts` exists; ≥ 24 h soak per kernel PR | `still-true` | — |
| Five of nine kernel rules are the ones the set rewrites | `still-true` | — |
| `process-full` *NEVER MERGES*; the `--merge` flag removed; policy *undecided, not rejected* | `still-true` | lines 155-176 |
| Six halt conditions, declared exhaustive | `still-true` | lines 218-247 |
| The census tools the generated inventory would read | `still-true` | all four present |
| **Next free ADR is 264** | **`already-fixed` / overtaken, four times** | 264 and 265 landed, then 266 (`explicit-pr-merge-invocation`, PR #1949) and 267 (`delivery-default-for-claude-code`, PR #1923) while this set sat uncommitted. Every `ADR-264` reference in the set was a collision; the record is **ADR-268**, verified free on `origin/main` and in the only open PR at renumber time |
| **Estate is 8 active** (gen 1 said 10) | **overtaken, twice** | HEAD: 8 counted by the gate, 9 files, floor 8 at `origin/main`, `open_blockers` floor 43 |

Delta between the proposals' pin and HEAD, over `src/rules`, the settings template,
`src/scripts/hooks`, the roadmap and git command trees and `docs/decisions`: two new ADRs, one
rule body, one hook. **No authority surface moved**, which is why the thirteen verbatim claims
hold at both commits.

## Reproduction — Phase 4b

Selected under criterion (a), *the file pairs the instruction with an asserted outcome*.
The set's steps are overwhelmingly future work rather than reproducible instructions, so the
selected set is small and stated rather than implied.

| # | Step (verbatim) | Author | How reproduced | Verdict |
|---|---|---|---|---|
| 1 | `ls docs/decisions \| tail -1` → ADR-263 taken | agent | ran the equivalent over `docs/decisions` at HEAD, then again after each of two `origin/main` merges | **`diverged`, and it kept diverging** — 265 was the tail at first read, 267 by the time this set was committed. Corrected step: read the tail from `origin/main` at commit time, never at drafting time; the number is **268**. The reading is not the defect — the frontier moving under an uncommitted branch is, and `stubs/road-to-adr-number-uniqueness.md` now carries it as four measured collisions |
| 2 | *Estate steht am Pin bei 8 aktiven Roadmaps* (`ls agents/roadmaps/*.md`) | agent | `./scripts-run src/scripts/check_estate_count` | **`diverged`** — the gate counts 8, `ls` returns 9. Corrected step: read the gate, never the glob; the two disagree by one and the gate is what CI reads |
| 3 | `grep -rn produces_roadmap src` → 0 | agent | ran it | `reproduced` |
| 4 | `grep -rn AskUserQuestion src` → 0 | agent | ran it | `reproduced` |
| 5 | *Council ist bereits CLI-first* (`ai_council/config.ts`) | agent | `agent-config council:status` plus the config path | `reproduced` — two enabled members, resolved user-global, project tree never searched |
| 6 | `git diff --stat afd0f7b..e9d5202` over the autonomy surfaces is empty | agent | ran the equivalent for `e9d5202..399beecab` | `reproduced` for the interval that matters — no authority surface moved |
| 7 | *Sign ADR-268* (Phase 0.1) | agent | — | **`out-of-bound`** — the record is owner-reserved and its own § 4 forbids self-ratification |
| 8 | Every Phase 1-11 step across the three stems | agent | — | **`not-attempted`** — outside the selection: they are future work with no asserted current outcome, not instructions with a reproducible claim |

Two `diverged` verdicts, both renumbering or re-measurement, both corrected in the emitted
roadmaps and tagged `corrected-from-reproduction` there. No ceiling fired: the selection was
6 executed steps against a bound of 12, and wall-clock was not reached.

## Recurrence — Phase 4c

**This is the fifth arrival of the same subject, and that is the round's largest finding.**

Scanned the consumed-inbox tree for `this turn` clauses, merge authority, run-scoped grants,
the autonomy premise and `personal.autonomy`. Matching rounds, oldest signal first:

| Round | What arrived |
|---|---|
| `auto-merge` | three revisions of a merge-authority roadmap plus its transcript |
| `inbox-2026-09-b` | an execution-authority kernel roadmap |
| `inbox-2026-09-m` | two autonomy-reset master roadmaps plus an autonomy-first roadmap |
| `inbox-2026-09-u` | the owner-rulings ADR draft that became ADR-260 |
| `inbox-2026-09-w` | this round |

Adjacent rounds on the same theme from a different angle — the Uncle-Bob / control-in-CI
framing — add two more. (The consumed-inbox tree is gitignored, so these are dated local
counts a clone cannot re-run; the ordering is the claim, not the figures.)

Each arrival was correct. None was durable, and the mechanism is identical every time: the
answer was recorded in a **round-scoped artifact** — an evidence file created by that round and
read by no later one — while the **held object** kept no counter and no posed question. The
held object here is `agents/roadmaps/stubs/road-to-owner-authority-decisions.md`, and until
this run its arrivals line read **4** and named `inbox-2026-09-m` as the latest.

Routed through `recurring-criticism`, the outcome is the **third** of its three: the
disposition was right, it was recorded, and it was **unreachable**. So the repair is
reachability, not a reversal:

1. The stub's arrivals line now reads **5** and names this round.
2. Decisions 2 and 3 carry an inline *answered in transcript, awaiting signature* note naming
   ADR-268 and, explicitly, **what the answer does not cover** — the competitive-run merge half
   of Decision 2 and the grade-derived-authority half of Decision 3 both stay open.
3. The answer itself is an ADR in `docs/decisions/`, not a line in this file.

## Owner decisions answered by this round

`stubs/road-to-owner-authority-decisions.md` carries twelve owner-reserved decisions. This
round's two interviews answer three of them, one partly:

| Decision | Status before | This round |
|---|---|---|
| 2 — may a delegation cover a merge? | open since 2026-08-22; ADR-239 § 3 *undecided, not rejected* | **answered** for the mission-delivery merge (ADR-268 § 3). The judge-ranked-candidate half stays open |
| 3 — governance self-amendment | ADR-255 § 4 refused all four deletions for one round | **answered** — self-amendment permitted, self-**ratification** forbidden (ADR-268 § 4). Grade-derived authority stays open |
| 11 — run-scoped grant vs the this-turn confirmation | answered by ADR-260 § 2 | **extended** — the *persistence* half ADR-260 does not address (ADR-268 § 2) |

Decisions 1, 4-8 are untouched. Decisions 9, 10, 12 were already answered by ADR-260.

## Point ledger

```
claims        16 extracted → 13 still-true · 3 already-fixed/overtaken · 0 never-true · 0 unverifiable
instructions   8 selected  →  4 reproduced ·  2 diverged · 0 unexecutable · 1 out-of-bound · 1 not-attempted
demands       27 extracted → 23 adopted · 2 already-satisfied · 1 declined · 1 owner-decision
```

Every column sums to its extracted figure.

**The demand column moved twice during the run, both times on owner instruction**, and the
figures above are the final state:

1. Mid-run the owner set the batch order and the execution precedence — demand 27, adopted as
   ADR-268 § 11 and a precedence clause in `/roadmap:next` § 3.
2. At the end the owner ruled on the one item this run had classified `owner-decision`:
   *the autonomy described in the roadmaps is what I want; no council, no ADR should break it;
   possibly narrow it slightly.* That moved **signing ADR-268** from `owner-decision` to
   `adopted`, and added ADR-268 **§ 0** — the outcome as `protected_dimensions: purpose`, with
   a narrowing-versus-break table so *possibly narrow slightly* is decidable rather than a
   mood. The single remaining `owner-decision` is the reasoning-architecture sequence, which
   is a different subject.

### Demand discharges that are not `adopted`

| Demand | Discharge | Why |
|---|---|---|
| *Der Council soll die CLI nutzen, nicht die API* — plan it in if it is not already the case <!-- md-language-check: ignore --> | `already-satisfied` | the transport resolves `auto` = cli → api → unavailable, and a mid-flight fallback exists; `agent-config council:status` reports two enabled members resolved user-global |
| *Alle Gates / ADRs / Commands / Skills / Rules hinterfragen* as a complete disposition matrix | `already-satisfied` in shape | the hand-authored 620-row matrix both providers proposed is declined; `road-to-typed-grants-that-persist` Phase 6.1 generates the same inventory from the four census tools that already exist, and ratchets its `legacy_human_gate` count |
| Gen 4's risk formula `irreversibility × uncertainty × foreign_active_work × blast_radius` | `declined` | ADR-260 § 2 line 93 forbids a natural-language authorization parser in enforcement. The signals survive as required **evidence fields on WARN ops**, which is a record rather than a score |
| The autonomy outcome must not be broken by a council or a later ADR; slight narrowing is permitted | `adopted` | ADR-268 **§ 0** — the outcome as `protected_dimensions: purpose`, plus the six-row narrowing-versus-break table whose discriminator is *does the change put a person back into the per-step loop for a reversible operation?* The measurement is ADR-260's existing *zero prompts on the reversible fixture set*, so the section is falsifiable rather than a declaration of intent |
| The reasoning-architecture sequence in the round's closing turn — eval corpus first, candidate gate, evidence discriminator, orchestrator before intent, commitment horizon, measure before more complexity | `owner-decision` | a **different subject** from this batch, and partly in flight already: `agents/roadmaps/road-to-limited-commitment-horizon.md` is active in the estate and owns the commitment-horizon half. Whether the rest becomes its own stem is the owner's call, not this batch's |

### Constraints, separated from wants

Two demands are boundary-shaped and discharge only as an acceptance criterion, never as a
phase step:

- *Eine feste Anzahl Fehlversuche darf niemals automatisch einen User-Blocker erzeugen.* →
  ADR-268 § 7, and `road-to-adversarial-verification-and-long-runs` AC-4, which requires
  `grep -rn 'N=3' src/rules` to return 0 **and** no escalation path to map a count to an ask.
- *AC soll nicht mergen, ohne dass der User es sagt.* <!-- md-language-check: ignore --> → ADR-268 § 3 keeps `delivery.merge`
  `off` at every level, and AC-2 of the grants roadmap requires that no remaining ask is a
  push, commit, CI-fix or conflict ask — the inverse constraint, so both directions are pinned.

## Coverage ledger

```
batch     this run covers topic [better-autonom-agents] of 2; deferred: [roadmap-release-blocker]
sources   19 files in 1 topic set — 4 undeclared generations (mtime-ordered), 1 exact duplicate,
          3 transcripts, 1 ghost parent
anchors   ~1000 counted in this topic → 26 demand rows + 16 claim rows + 8 instruction rows
          produced; the remainder are the four generations' restatements of the same rulings,
          accounted as no-demand because gen 3's R-register is their merged form
passes    pass 1: 42 rows · pass 2: +8 rows (the reasoning-architecture turn, the host-parity
          demand, the CLI-first parenthetical, the two intra-source repeats, the two
          constraints, the precedence instruction) · pass 3: 0 adopted-not-found
topics    1 topic in → 1 ADR + 3 roadmaps + 1 stub update + 1 command edit
```

`unaccounted` is **0**. Pass 2 added 8 rows against pass 1's 42, so the extraction had not
converged on the first read; a third extraction pass added nothing and the cap did not fire.

### Intra-source recurrence

The owner answered the same two questions twice — the money/ceiling question and the
test-first question — once per provider, saying so explicitly both times (*"Das habe ich schon
woanders beantwortet"*). That is not a complaint; it is two parallel sessions asking one person
the same thing, and it is recorded because the cost was the owner's time. Both answers are
identical and are cited once in ADR-268 §§ 8 and 9.

## What was emitted

| Artefact | Path |
|---|---|
| Owner-rulings record, `proposed` | `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md` |
| Stem 1 — authority model | `agents/roadmaps/road-to-typed-grants-that-persist.md` |
| Stem 2 — decision closure | `agents/roadmaps/road-to-decision-closure.md` |
| Stem 3 — replacement control | `agents/roadmaps/road-to-adversarial-verification-and-long-runs.md` |
| Arrivals counter + two answered-decision notes | `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` |
| Owner-recorded precedence in the pick order | `src/domains/product-basic/roadmap/next/command.md` § 3 |

## Honest limits of this disposition

- **ADR-268 is `accepted`, so the decisions are taken and the floors are not yet moved.** The
  record decides that several floors change; no rule file has been edited, so the tree at this
  commit still carries the Hard Floor's `git push` row, `commit-policy`'s one-shot fence and
  `autonomy: auto`. What remains is the work in Phases 1-11, plus the one open ordering
  constraint (`kernel-guard-first-crossing`) — not a permission.
- **The acceptance was owner-directed, in chat, and that is recorded rather than smoothed.**
  The drafting run wrote `proposed` and refused to self-accept per ADR-268 § 4. The owner then
  directed acceptance. ADR-268 § Status and its § Alternatives both carry the sequence, because
  a reader who only sees `status: accepted` cannot tell a ratification from a self-ratification.
- **The three roadmaps grow the estate by three and `open_blockers` by five.** Each carries an
  `estate_growth_exempt` reason read from the diff. The gate reports `+0` while the files are
  untracked; the claims bind at commit.
- **Batch 2 is unread.** Its 5 files and ~700 anchors are not represented in any ledger above,
  and its topic — declaring release-blocker windows inside roadmaps — has no overlap with this
  batch that would let one stand in for the other.
- **No council pass ran on the emitted set.** The council is configured with two enabled
  members and this was an authoring run; challenging the set before execution is
  `road-to-typed-grants-that-persist` Phase 0's own precondition, not a step this run skipped
  silently.
