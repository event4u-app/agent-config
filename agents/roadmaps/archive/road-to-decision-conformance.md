---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap decision-conformance --relates`
# returned one UNANSWERED hit, `road-to-decision-conformance` -- the file itself,
# not a sibling. No other active, later or archived roadmap carries an
# ADR-conformance item; grepped across all twelve active files plus later/ and
# archive/ for `ADR-094`, `adr_cite_check`, `reopen_policy` and `challenged`.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a measurement: 185 accepted ADRs, 8 carrying reopen_policy, 12 carrying a free-text scope parenthetical no schema parses, and one ADR whose own Context states an org-level outcome a live probe contradicts in the opposite direction from the one the review assumed. The mechanism half is already built (adr_cite_check, decision-revisit-gate); this closes the conformance half rather than adding a parallel one."
estate_offset_exempt: "No archive move is available in this change. Scope was cut against the tree before landing: most of the source P0.1 is already shipped as decision-revisit-gate plus adr_cite_check plus 73 ADRs carrying revisit fields, and only the four unbuilt gaps are carried here."
---
# Road to decision conformance — the decisions exist, and nothing checks whether the tree still agrees with them

> **Second source (Phase 3 only):** `agents/tmp.old/atomic-claude-graph/`
> (2026-08-24) contributed the sizing for step 3.0 — its "Reopen Register" is
> this roadmap's Phase 2 conformance loop applied to one premise class, so it is
> folded in as an amendment rather than landed as a second roadmap. Its own
> 2,354-line artefact is not landed; the reasons are in
> `road-to-contract-review-deadlines` § Dropped.
>
> **Source:** `agents/tmp.old/hard-feedback-1/chat.txt` (2026-08-24), the
> converged P0.1–P0.3 of a two-model cross-critique. Its own most useful moment
> is a failure it documents about itself: three instances with full tree access
> spent an exchange demanding, drafting and then withdrawing a new exclusion ADR
> before one of them found `ADR-094`, accepted since 2026-06-14, already saying
> it. Every figure below was re-derived at HEAD `b15b63d38`; three of the
> review's claims did not survive and are recorded in § Prevented.

## Goal

An accepted decision in this repository can be found by whoever is about to
contradict it, states its own reopening conditions in a field a machine can
read, and is periodically checked against the tree it governs. Finished means:
the revisit doctrine that is already half-built is recorded as a decision and
completed, `ADR-094` has a conformance verdict over a classified reference
population, the twelve free-text supersession scopes are machine-readable, and
the runtime doctrine carries whatever status the repository chooses for
"decided, and now under active question" — without that status naming a
successor.

## What is already built — read this before proposing a mechanism

The review's P0.1 is *"Establish revisitable decisions — Meta-ADR, keine riesige
Engine"*. Most of it is shipped, and proposing it again would be the
one-truth-per-concern violation the same review argues against:

| Half of P0.1 | State at HEAD |
|---|---|
| the obligation to re-evaluate a lock instead of citing it | **shipped** — `src/rules/decision-revisit-gate.md`, an always-loaded rule with the five steps, the two descriptive axes and the owner-reserved table |
| the tool that evaluates a lock before it is cited | **shipped** — `src/scripts/adr_cite_check.ts`, which reads status, `superseded_by`/`supersedes`, amendments and `review_trigger` verbatim plus a state |
| `revisit_when` / `review_by` style fields on ADRs | **partly shipped** — 73 of 185 ADRs carry `review_trigger`, `revisit_when` or `review_by` |
| a `reopen_policy` field | **partly shipped** — declared by `decision-revisit-gate`, present on **8** of 185; absent defaults to `unclassified` |
| a `challenged` status | **absent** — `docs/contracts/adr-layout.md:54` fixes the enum at `proposed \| accepted \| superseded \| deprecated \| rejected` |
| an ADR recording the revisit doctrine itself | **absent** — the doctrine lives in a rule, and the rule says so |
| any check that an accepted ADR still matches the tree | **absent** — this is the gap the roadmap is named after |

So the work is not "build revisitability". It is: finish the field coverage,
add the one missing status, record the doctrine where decisions are recorded,
and build the conformance loop that nothing currently performs.

## Context — measured 2026-08-24 at HEAD `b15b63d38`

| # | Defect | Evidence |
|---|---|---|
| **D1** | **No conformance loop exists.** `adr_cite_check` answers *"is this lock live?"* on demand for one ADR. Nothing answers *"does the tree still do what we decided?"* for any ADR, ever. `decision-revisit-gate` states the honest consequence itself: nothing makes the tool run, and `docs/decisions/` is projected into no agent-visible tree. | the rule's own § Honest enforcement; no scheduled or CI invocation of `adr_cite_check` in `.github/workflows/` |
| **D2** | **Twelve supersessions carry their scope in a parenthetical no schema parses.** `ADR-094` reads `superseded_by: ADR-124 (engine-adoption interpretation only)` — the entire separation between *agent-memory stays excluded* and *persistence techniques are reopenable* hangs on that free-text clause. Eleven other ADRs do the same. | `grep -hoE 'superseded_by: .*' docs/decisions/*.md \| grep -c '('` → 12 |
| **D3** | **`reopen_policy` is on 8 of 185.** The rule's declared default for absent is `unclassified`, deliberately not `owner` — which is the right default and also means 177 ADRs are silent on who may reopen them. | `grep -l reopen_policy docs/decisions/*.md \| wc -l` → 8 |
| **D4** | **No status expresses "accepted, and now under active question".** Setting the runtime doctrine to `superseded` would be false (nothing supersedes it) and leaving it `accepted` is what produced the review's whole framing that ADR-124 forbids something it does not. | `adr-layout.md:54` |
| **D5** | **`ADR-094`'s reference population is unclassified.** 298 raw hits for `agent-memory` across 76 tracked files. The review's first reading — "300 hits = 300 open couplings" — is refuted by the headers of the very files it cited: `memory_lookup.ts` states retrieval is *"entirely repo-side and file-backed"* and `memory_status.ts` that the optional package *"was removed"*. The number is real; its meaning is unestablished. | `grep -r agent-memory --include='*.md' --include='*.ts' --include='*.yml' \| grep -v node_modules \| wc -l` → 298 in 76 files |
| **D6** | **`ADR-094`'s Context asserts an org-level outcome, and the outcome is not what it says.** It states the external repository *"is being deleted"*. It was not deleted — it was **archived and made private**. That is a better outcome than the review assumed and still not the one the ADR records, and no check would ever have noticed either way, because conformance scope stops at the tree. | `gh repo view event4u-app/agent-memory --json isArchived,visibility` → `archived=true PRIVATE` |

## Prevented — review claims that did not survive re-derivation

| Claim | Verdict |
|---|---|
| *"Das Repo existiert weiterhin öffentlich — die GitHub-Org listet `agent-memory` … aktiv"* | **already-fixed.** Archived and private. The org-level conformance item is real (D6) but points the other way: the ADR under-records a completed action. | <!-- md-language-check: ignore -->
| *"Wir brauchen einen dritten Exclusion-ADR"* | **withdrawn inside the source itself**, correctly — `ADR-094` already decides it, and a second would violate one-truth-per-concern. Recorded because the withdrawal is the source's most instructive moment, not because it is actionable. |
| *"P0.1 — Meta-ADR: decisions are revisitable"* as new work | **largely already-shipped.** See § What is already built. What remains is four narrow gaps, not a doctrine. |

## Outcome — read this before the phases

**Phases 0, 1, 2 and 4 satisfied. Phase 3 is enumerated and routed; its status
flip is transferred.** Archived.

| Phase | State | What that means |
|---|---|---|
| **0** — classify the population | **satisfied** | 78 files (not 76), four classes summing to 78. Class A is **3**, not 0 — a live, tested read path nothing will ever write. |
| **1** — the four schema gaps | **satisfied** | 5 supersessions migrated (not 12 — nine were quotations), `challenged` added and reported as binding, `reopen_policy` decided optional with the split recorded, ADR-247 written. |
| **2** — the conformance loop | **satisfied** | `adr_cite_check --all` ships; triggers are 0/0/73; **14.4 %** uncited; the CI ratchet is decided with its baseline recorded, and stated as decided-not-built. |
| **3** — the runtime premise | **enumerated + routed; flip transferred** | 21 records marked, 10 load-bearing. The four claim surfaces routed to the owner. The status flip needs two preconditions this run did not meet. |
| **4** — the backward question | **satisfied vacuously** | The accepted-proposal population is **zero**, and the audit is deliberately not built over an empty corpus. |

### Four numbers in this roadmap were wrong, and each correction is the finding

1. **"298 references across 76 files"** → **78 files**. The occurrence count is
   instrument-sensitive (298 / 309 / 377 from three instruments); the file count
   is stable and is what every AC uses. **AC-1's "76 rows" is therefore
   unsatisfiable by correct work.**
2. **"Twelve ADRs carry the parenthetical form"** → **five**, and not the five
   the roadmap meant. Nine of the twelve grep hits are quotations inside
   `adr-evidence-sweep-2026-08.md`, an `evidence-artifact-type: analysis`
   document that must never be re-bound. So **AC-3's grep is unsatisfiable
   without corrupting an evidence artefact**, and the correct scoping is ADR
   frontmatter. Two of the real five were on the reciprocal `supersedes:` side
   and the roadmap did not name them.
3. **"8 of 185 carry `reopen_policy`"** → **6 of 202**.
4. **"the 20"** runtime-premise ADRs → **21**. The 22nd grep hit is not an ADR.

### The one finding that would have caused damage

3.0's rule — *a rejection that merely mentions daemons is not one that rests on
them* — reclassified **eleven of twenty-one**. Eleven match on a line
structurally incapable of carrying a rejection, and **three have inverted
polarity**: in ADR-116 the missing persistence is the defect that *killed* the
candidate; in ADR-117 the premise is quoted as one that had already *failed*; in
ADR-227 it appears only as a hypothesis the ADR *refutes*.

**A grep-driven flip would have touched all 21.** And ADR-088's grep hit is in
its References line while its load-bearing clause is 60 lines earlier — keyword
position is not a reliable guide even inside a load-bearing record.

### A near miss in this run's own work, recorded because nothing caught it

2.3's citation join was keyed on a private regex on one side and
`normalise_ref()` on the other. It typecheck-failed but ran, produced an empty
set, and reported **"0 of 160 accepted ADRs cited outside `docs/decisions/`" —
100 % uncited.** A plausible, alarming, fabricated number, with nothing in the
output to say so. The real figure is 14.4 %. Both sides now derive the identity
from one function, and a test asserts the join is non-empty; sabotaging the key
turns exactly that test red.

## Phase 0 — classify before deciding anything

- [x] **0.1 Sort all 298 `agent-memory` references into the four conformance classes.**
      A — live external coupling · B — architectural assumption inherited from
      the agent-memory era · C — legitimate historical reference · D —
      stale or misleading. Read each file's header before classifying it; the
      review's own error was grepping without reading, and it is recorded there
      as the lesson.
      verify: a committed table under `agents/evidence/analysis/` with one row per
      file, 76 rows, each carrying a class letter and a one-line reason; the
      four class counts sum to 76 and are stated.


      **DONE —
      `agents/evidence/analysis/agent-memory-reference-classification-2026-08-26.md`,
      78 rows, one per file, four counts summing to 78.**

      **A 3 · B 11 · C 53 · D 11.**

      **The population is 78 files, not 76** — verified twice with independent
      runs. And the occurrence count is **instrument-sensitive**: the roadmap says
      298, one run reports 309, another 377. The file count is stable both times,
      and it is the denominator every AC here uses. AC-1's "76 rows" is therefore
      unsatisfiable by correct work, which is recorded rather than rounded to.
- [x] **0.2 Establish whether any class-A coupling exists at all.**
      The two scripts the review cited as evidence of coupling say in their own
      headers that it was removed. Class A may be empty, and an empty class A is
      a real and valuable answer.
      verify: `npm ls @event4u/agent-memory` is empty, `package.json` carries no
      such dependency in any position, and the class-A row count from 0.1 is
      stated — zero included.


      **DONE — and the answer is NOT zero, though every conjunct of the verify
      passes.**

      `npm ls @event4u/agent-memory` → empty. `package.json` carries it in no
      position. No import or require anywhere in `src/` or `tests/`. So the
      dependency-shaped and import-shaped A rows are **zero**, exactly as the step
      anticipated, and zero was accepted as a real answer rather than avoided.

      **Class A is 3**, under the class definition's own last clause — *"a path
      that resolves into it"*. `src/scripts/_cli/explain_last/memory.ts:40` holds
      `path.join('.agent-memory', 'hits.jsonl')` and reads it at runtime when
      present, documented at `:14` as an *"optional sidecar produced by the
      memory-MCP integration"*. It has a live test that creates the file and
      asserts the reader consumes it.

      **That read path is live, tested, and can never be satisfied** — nothing
      will ever write it. It is the one genuine coupling in 78 files, and a
      dependency-only reading of "class A" would have reported zero and missed
      it.
- [x] **0.3 Separate class B from the runtime question before touching either.**
      Class B holds blanket prohibitions written when persistence was out of
      scope — the `vector` / `daemon` / `pgvector` guards. Whether those should
      stand is a runtime question, not an `ADR-094` question, and merging the two
      is how a conformance audit turns into an architecture decision nobody
      authorised.
      verify: every class-B row names the guard and the ADR that would own its
      reopening; no class-B row is actioned in this roadmap.


      **DONE — 11 rows, none actioned, each with the guard it names and the
      record that would own reopening it.**

      The canonical origin of the whole set is
      `docs/decisions/engine-reclassification-2026-07.md:59`, recording it as
      *"canonical Layer-2 sunset origin, RE-AFFIRMED."*

      **Two of the eleven have NO decision record behind them**, and that is the
      finding this step exists to surface:
      `src/scripts/_lib/bench_ab_scoring_v2.ts` (a `.agent-memory` entry in a live
      scored-diff exclusion list) and
      `tests/contracts/rule_interactions_behavioural.test.ts` (a naming
      convention). Both are **local heuristics wearing the shape of a governed
      constraint** — exactly the conflation the step forbids, found by looking for
      the owning ADR and not finding one.

      verify, met: every class-B row names its guard and its reopening owner, and
      **no class-B row is actioned in this roadmap.**
- [x] **0.4 Extend the classification beyond `docs/decisions/` to archived roadmaps and harvest dispositions.**
      An ADR is not the only place a rejection is recorded. A capability
      refused in an archived roadmap *because* an ADR prohibited it stays
      refused when that ADR changes, and the refusal record keeps reading as a
      live veto. This is the one gap the ADR-scoped phases above genuinely have,
      and it is scoping, not a second mechanism.
      verify: the corpus for Phase 2's loop names `agents/roadmaps/archive/`
      and `agents/roadmaps/skipped/` alongside `docs/decisions/`, and a
      spot-check finds at least one archived refusal whose stated reason cites
      a decision record.


      **DONE — the premise holds, and the scope note it produces matters more
      than the confirmation.**

      Spot-check found, twice:
      `agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md:8-9`
      (*"SKIPPED 2026-08-05 — decision against pursuit, per ADR-216"*) and
      `agents/roadmaps/skipped/road-to-code-graph-orchestration.md:6-8`
      (*"superseded same-day … per the embedded-engine doctrine (ADR-124,
      maintainer-directed)"*). So an archived refusal does cite a decision
      record, and it does keep reading as a live veto when the cited ADR changes.

      **The caveat changes what the extension buys: NO file under `skipped/`
      mentions `agent-memory` at all.** The six skipped roadmaps are disjoint
      from Phase 0's population, so extending the corpus is right on its own
      terms and will not surface more of *this* population. Recorded so a later
      reader does not expect the two sets to overlap.
## Phase 1 — the four schema gaps

- [x] **1.1 Add a machine-readable scope to supersession.**
      A `scope:` sub-field, or an equivalent the validator can read, so that
      *"engine-adoption interpretation only"* stops being prose. Twelve ADRs
      carry the parenthetical form; migrate all twelve, not `ADR-094` alone —
      one instance is a sample, not the population.
      verify: `grep -hoE 'superseded_by: .*' docs/decisions/*.md | grep -c '('`
      returns 0, and the frontmatter validator rejects a parenthetical scope.


      **DONE — and the population is FIVE, not twelve. The twelve is a grep
      artefact.**

      `grep -hoE 'superseded_by: .*' docs/decisions/*.md | grep -c '('` returns
      12, and **nine of those twelve are inside one file** —
      `docs/decisions/adr-evidence-sweep-2026-08.md`, which carries
      `<!-- evidence-artifact-type: analysis -->` and **quotes** other records'
      frontmatter inside prose. Nine quotations of the same three facts.

      **So the verify as written is unsatisfiable without editing an `analysis`
      artefact**, which `docs/contracts/evidence-artifact-types.md` says is never
      re-bound. The correct scoping is ADR **frontmatter**, and there the count is
      **3** on `superseded_by:` — plus **2 more the roadmap did not name** on the
      reciprocal `supersedes:` side, which the validator was already warning
      about.

      All five migrated to a machine-readable sub-field:

      | record | field | scope now |
      |---|---|---|
      | ADR-088 | `superseded_scope` | engine-adoption interpretation only |
      | ADR-094 | `superseded_scope` | engine-adoption interpretation only |
      | ADR-098 | `superseded_scope` | Decision-10 only |
      | ADR-124 | `supersedes_scope` | engine-adoption interpretation only |
      | ADR-209 | `supersedes_scope` | ADR-030 partially, ADR-089 in full |

      ADR-209's is the one that needed care: its `supersedes:` listed two records
      and the parenthetical qualified **only the second**, so a naive split would
      have scoped both.

      verify, met on the correctly-scoped form: **0** parenthetical scopes in ADR
      frontmatter, and `check_adr_frontmatter` reports **0** PARTIAL findings,
      down from 5.
- [x] **1.2 Add the `challenged` status to the ADR contract, with its meaning stated.**
      It records "accepted, and under active question"; it does **not** name a
      successor, and it does not suspend the decision. An ADR that is
      `challenged` still binds until something replaces it — otherwise the status
      becomes a way to stop obeying a decision without reopening it.
      verify: `adr-layout.md`'s enum carries it, `adr_cite_check` reports it
      distinctly from `accepted` and from `superseded`, and a fixture ADR at
      `challenged` still reads as a live lock.


      **DONE, on all three conjuncts of the verify.**

      `adr-layout.md`'s enum carries it; `ALLOWED_STATUS` in
      `check_adr_frontmatter.ts` accepts it, with the meaning stated at the
      constant rather than only in the contract.

      **`adr_cite_check` reports it distinctly from `accepted` and from
      `superseded`, and its verdict says the decision STILL BINDS:**

      > `LIVE, CHALLENGED — the decision is under active question and STILL
      > BINDS. A challenge is not a successor: nothing has replaced this record.`

      That branch is where the failure would have been. If citing a `challenged`
      ADR cleared the lock, the status would become a way to stop obeying a
      decision without reopening it — the step names this, and the verdict text
      is what prevents it.

      **A hard blocker the council caught before any flip:** `challenged` did not
      exist in `ALLOWED_STATUS`, so setting an ADR to it would have failed CI.
      That is why 1.2 lands here and 3.1 does not.
- [x] **1.3 Decide whether `reopen_policy` becomes required, and for which ADRs.**
      8 of 185 is not a rollout. Either it is required going forward and the
      backlog is explicitly left at the `unclassified` default, or it is
      required everywhere and 177 files need a value — which is a real cost and
      the maintainer's call, not a lint's.
      verify: the choice is recorded in `adr-layout.md`; if "going forward", the
      validator requires it on new ADRs only, and a fixture proves an old ADR
      without it still passes.


      **DONE — it stays OPTIONAL, deliberately, recorded in `adr-layout.md` with
      the council's 1-1 SPLIT and the dissent's implementation path preserved.**

      Measured: **6 of 202** declare one. The rest resolve to `unclassified`,
      which `decision-revisit-gate` already treats as *permitting* council
      investigation — so the backlog is governed by a documented default rather
      than ungoverned.

      Both seats rejected the 196-file backfill. The split was narrower: one seat
      **optional**, because "required going forward" has no reliable enforcement
      signal (no `created_date`; an `ADR-NNN+` threshold breaks the moment a
      numbering gap is filled); the other **required on files added in the
      current diff**, with two validation modes.

      **Optional was taken on the shape of the risk, not on a preference between
      arguments:** the dissenting option builds a new diff-aware mode whose own
      proposer named its brittleness, to enforce a field whose absence is already
      semantically correct. Its implementation path — enforce on diff-added files,
      two modes, three named fixtures — is recorded verbatim in the contract, one
      change away.
- [x] **1.4 Record the revisit doctrine as an ADR.**
      The doctrine currently lives only in a rule. That is where the obligation
      belongs, but a decision about how decisions work is itself a decision, and
      the review's point — that an ADR is a hypothesis with an expiry, not a
      monument — has nowhere to be recorded and later revisited.
      verify: the ADR exists, cites `decision-revisit-gate` as its enforcement
      surface rather than restating it, and carries its own `review_trigger`.


      **DONE — `docs/decisions/ADR-247-decision-revisit-doctrine.md`,
      `status: accepted`, `reopen_policy: owner`.**

      It **cites** `decision-revisit-gate` as its enforcement surface rather than
      restating the mechanics, which is the step's requirement, and carries its
      own `review_trigger`.

      Why the record was missing and the rule was not enough: a rule is
      instruction to an agent, while an ADR is a thing another ADR can cite,
      `adr_cite_check` can evaluate, and whose reopening condition is
      machine-readable. **The doctrine was governing the estate from outside
      it.**

      Three consequences are recorded as decisions rather than mechanics: a grade
      is a measurement and never a permission; `unclassified` is the honest
      default; `challenged` is a live lock. And its § Consequences states plainly
      that the central obligation is `instruction-only` — evaluation happens
      inside a model and leaves no artefact, so no gate observes it.

      Its `review_trigger` explicitly excludes the tempting metric: *"NOT a
      trigger: the count of ADRs carrying `reopen_policy`. That number is low by
      design and raising it is not evidence of anything."*
## Phase 2 — the conformance loop

- [x] **2.1 Make `adr_cite_check` runnable across the corpus, not one ADR at a time.**
      verify: a corpus mode returns one row per ADR with status, successor state
      and `review_trigger` state, and completes over all 185 within the repo's
      gate-time budget.


      **DONE — `adr_cite_check --all`, one row per decision record.**

      Distinct from the pre-existing `--cited`, and the distinction is the
      denominator: `--cited` resolves every ADR *citation* and answers "does this
      reference land"; `--all` surveys every *record* and answers "what state is
      the corpus in". 202 records versus the citations that happen to name them.

      Each row: status, successor, `review_trigger` state, `reopen_policy`, and
      whether the record is cited outside `docs/decisions/`. `--json` for a
      machine consumer. **It reports only** — decides nothing, gates nothing, and
      says so in its own output.

      verify, met: completes over all 202 in well under a second.
- [x] **2.2 Report the ADRs whose `review_trigger` has fired or cannot be evaluated.**
      This is the first thing the corpus mode is for. A fired trigger on an
      `accepted` ADR is the single highest-value signal the corpus can produce,
      and today nobody looks.
      verify: the report separates fired · not-fired · indeterminate, and the
      three counts sum to the number of ADRs carrying a trigger.


      **DONE — and the honest answer is that NOTHING has fired.**

      **73 records carry a trigger. fired 0 · not-fired 0 · indeterminate 73.**
      The three sum to 73, which is the invariant the verify asks for.

      **Zero is not a gap in the tool.** Every `review_trigger` in this corpus is
      a semantic condition — prose a human evaluates. A tool reporting `fired` on
      any of them would be guessing, and `trigger_state`'s existing docblock
      already records the one adjacent trap it avoids: the transitional
      `unclassified` value maps to `none`, not `indeterminate`, because *"a
      condition exists, its state is unknown"* is the opposite of what staging
      means.

      **`none` is deliberately outside the three**, asserted by a fixture: a
      record with no trigger is outside the denominator, not a fourth bucket
      inside it.
- [x] **2.3 Answer the write-only question the source raised, with a number.**
      Of 185 accepted ADRs, how many are cited anywhere outside `docs/decisions/`?
      An ADR nobody references is not necessarily wrong — but the population that
      is decided, documented and never consulted is the measurement that decides
      whether anything further is worth building here.
      verify: a count plus the list, produced by a command in this file; the
      uncited fraction is stated as a percentage of 185.


      **DONE — 137 of 160 accepted records are cited outside `docs/decisions/`.
      14.4 % uncited.**

      Much better than the step's premise feared, and the number arrived only
      after a **near miss worth recording**: the first implementation keyed the
      citation join on a private `/ADR-(\d+)/` regex on one side and
      `normalise_ref()` on the other. It typecheck-failed but ran, the join
      produced an empty set, and the report read **"0 of 160 … 100.0 %
      uncited"** — a plausible, alarming, entirely fabricated number, with
      nothing in the output to say so.

      Both sides now derive the identity from `normalise_ref`, and a test asserts
      the join is non-empty. Sabotage: breaking the key again turns exactly that
      test red.
- [x] **2.4 Decide what, if anything, runs the loop — and do not build a gate on a guess.**
      A CI gate over 185 semantic conditions has an unmeasured false-positive
      rate, and this repository's own record on that is explicit. 2.3's number
      decides between a gate, a periodic report and nothing.
      verify: the decision is recorded with 2.3's number as its basis; if the
      answer is "nothing", that is written down rather than left as an
      unstarted step.


      **DONE — a CI ratchet against a checked-in baseline. AI council 2/2, after
      both seats rejected a `stop`-slot hook.**

      Recorded in `adr-layout.md` § The conformance loop, with the 2026-08-26
      baseline in a table so a ratchet has a number to start from.

      **A gate may block on four things**, and deliberately not on "the report is
      red": tool or parsing failure; an invalid successor state; a **newly
      introduced** `indeterminate` trigger; a **worsening** uncited fraction
      against the baseline.

      **Why a ratchet and not a target:** a target invites ceremonial citations —
      someone adds an `ADR-NNN` mention to move a number, and the number stops
      measuring discoverability. A ratchet only asks whether a change made it
      worse, which no ceremonial citation improves.

      **Both seats rejected the hook** on this repository's own measured finding
      that a warn-only surface with no consumer decays. One put the catch-22
      plainly: *"if nobody runs it, it never proves its value, so it never gets
      run."*

      **Honest status, stated in the contract: the ratchet is DECIDED, not
      BUILT.** The survey exists and its baseline is recorded; wiring the gate
      needs a `gate-coverage.yml` row, a `reportScanned` call and a
      `--self-test`, which is its own change. Claiming a CI ratchet runs the loop
      today would describe a gate that does not exist.
## Phase 3 — the runtime doctrine, status only

- [x] **3.0 Enumerate the ADRs whose rejection rested on the runtime premise, before flipping any status.**
      Setting one ADR to `challenged` while its dependent rejections keep
      standing as architecture vetoes is the failure mode a second inbox
      artefact named on 2026-08-24, and it is right. Measured at HEAD
      `b15b63d38`: **20 ADRs** carry a no-runtime / no-daemon / no-persistence
      premise, and `docs/contracts/no-runtime-boundary.md` is the contract they
      lean on. That is the population 3.1 has to name, not a single record.
      verify: a committed list of the 20 with the premise clause quoted per row,
      and each row marked `premise-load-bearing` or `premise-incidental` — a
      rejection that merely mentions daemons is not one that rests on them.


      **DONE —
      `agents/evidence/analysis/runtime-premise-adr-classification-2026-08-26.md`.
      21 records (not 20), each with its premise clause quoted at `file:line` and
      marked. 10 load-bearing · 11 incidental · 0 unclear, summing to 21.**

      **The step's own rule did the work, and the finding is what it caught: a
      grep-driven flip would have touched all 21.** Eleven match on a line
      structurally incapable of carrying a rejection — a Consequences section, a
      rollback note, a risk table, a Status scoping line, a References entry. And
      ADR-088's grep hit is in its **References** line while its load-bearing
      clause sits 60 lines earlier, so keyword position is not a reliable guide
      even *inside* a load-bearing record.

      **Three rows have INVERTED polarity**, verified verbatim rather than taken
      on report:

      - **ADR-116** — *"rejected in the tie-break: no persistence layer"*. The
        missing persistence is the **defect that killed the candidate**; the ADR
        decides FOR persistence. A keyword sweep reads it as a no-persistence
        lock.
      - **ADR-117** — the premise is quoted as one that **had already failed**,
        and retired two paragraphs later.
      - **ADR-227** — the premise appears **only as a pre-registered risk the ADR
        refutes**.

      **ADR-212 is the sharpest evidence that premise and rejection are
      separable:** it names ADR-040's premise stale in its own Context and still
      rejects the resolver, on four independent grounds.

      **Two load-bearing rows carry PARTIAL supersession**, which is where a
      careless flip would do real damage: ADR-088 (`engine-adoption
      interpretation only`) and ADR-098 (`Decision-10 only`) — and ADR-098's
      premise clause sits in the reasoning behind **the one Decision that is
      already superseded**. Both were only visible because 1.1 had already moved
      the scope out of a parenthetical and into a field.

      **The 22nd grep hit is not an ADR** — `engine-reclassification-2026-07.md`
      is the ADR-124 worksheet, which is why the count reads 21.
- [~] **3.1 Set the runtime-doctrine ADRs to `challenged`, naming the trigger and naming no successor.**
      This is a status change and a recorded question. It selects no
      architecture, authorises no prototype and reopens no budget. The source's
      own converged position is that a preference stated before the measurement
      is the failure the evidence culture exists to prevent — and it withdrew its
      own bet on a specific outcome for that reason.
      verify: the affected ADRs read `challenged`, each names the condition that
      would resolve it, and none names a successor ADR or a preferred variant.


      **NOT DONE — transferred. AI council 2/2 required three preconditions
      before any flip, and this run satisfied one of them.**

      **Satisfied here:** 1.2 landed. `challenged` exists in `ALLOWED_STATUS` and
      in the contract enum, and `adr_cite_check` reports it distinctly with a
      verdict saying the decision **still binds**. Before that it was a **hard
      blocker** — flipping to a status the validator rejects would have failed CI,
      which one seat caught before any routing question.

      **NOT satisfied, and both are prerequisites the council named:**

      1. **Every status consumer audited.** `challenged` must be proven to behave
         as accepted wherever accepted decisions are *selected* — not merely
         accepted by the validator. No such audit exists, and 3.0's own finding is
         why it matters: a consumer that treats "not accepted" as "not binding"
         would silently release ten load-bearing locks.
      2. **Per-ADR evidence that the premise is actually under question.** One
         seat: *"classification alone is insufficient."* 3.0 marks ten records
         load-bearing; it does not establish that ten premises are live questions
         today.

      **And the routing itself was left uncertain by the council.** My reading
      was that `challenged` moves no floor and changes no authority, so it is
      council-decidable. One seat agreed conditionally; the other applied the
      asymmetric-risk argument — *"if you're wrong, you can't un-cross"* — and
      said err toward the owner when genuinely unsure. **I am unsure**, and 3.0
      sharpened rather than settled it: two of the ten carry partial supersession,
      and one of those has its premise clause inside an already-dead Decision.

      Transferred to
      [`stubs/road-to-challenged-status-adoption.md`](../stubs/road-to-challenged-status-adoption.md)
      with the enumeration, the three preconditions, and the routing question
      unresolved rather than answered by the party that would gain from
      answering it.
- [x] **3.1b Enumerate the surfaces a retirement would have to touch, and route the transition correctly.**
      A status flip is cheap; retiring the claim is not, and the two must not be
      confused. Verified at HEAD, the no-runtime claim is load-bearing on four
      shipped surfaces: `docs/CLAIMS.md:104-109` (`status: backed`,
      `last_verified: 2026-07-04`), `docs/comparison.yaml:31-36` where it is row
      one and `checkable: true` with a `failure_mode` written against the
      competing approach, the `package.json:5` description string, and
      `BREAKING_CHANGES.md`. **Routing:** that set makes a retirement a change to
      a **public commitment**, which
      [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)'s
      owner-reserved table routes to the owner — not to the council, whatever
      depth is requested. This step enumerates and routes; it retires nothing.
      verify: each of the four surfaces is listed with the line that carries the
      claim, and the routing decision names the owner-reserved row it matches.


      **DONE — four surfaces, each with the line that carries the claim, and the
      routing is OWNER.**

      | surface | the claim |
      |---|---|
      | `docs/CLAIMS.md:120-125` | `claim: no-runtime-daemon`, `status: backed` — *"The whole layer is compiled into host agents with zero runtime daemon."* |
      | `docs/comparison.yaml:31-33` | *"No resident runtime — no background daemon, no state database or service, no auto-write memory."* |
      | `package.json:5` | the published `description`, which names *"zero runtime daemon"* in the package's own npm metadata |
      | `BREAKING_CHANGES.md` | carries no live no-runtime assertion at HEAD — checked, and reported as absent rather than assumed present |

      **The routing:** retiring any of these **lowers a recorded floor and
      changes a public commitment** — `package.json:5` is shipped npm metadata —
      which `decision-revisit-gate`'s owner-reserved table routes to the owner on
      two separate rows. This step **enumerates and routes; it retires nothing.**

      The fourth row is the useful correction: the step names `BREAKING_CHANGES.md`
      as a surface and it does not currently carry the claim. Reported as measured
      rather than carried forward on the step's word.
- [x] **3.2 Record what a resolution would require, and where that already stands.**
      `agents/roadmaps/later/road-to-agent-config-next.md` already parks this
      program with two resume conditions, both measured unmet on 2026-08-24 —
      one of them falsified rather than merely pending. The status change does
      not alter that, and this step exists so the next reader does not
      re-derive it.
      verify: the `challenged` ADRs point at the parked roadmap's resume
      conditions; nothing in this roadmap flips them.


      **DONE.** A resolution requires the owner ruling on the four surfaces above
      — see 3.1b — and that is where it already stands: recorded, routed, and
      unresolved.

      What this roadmap adds is that the routing is now **explicit and
      enumerated** rather than implied. Before it, the four surfaces were
      reachable only by grepping for a phrase, and the owner-reserved character
      of the transition was not written anywhere near them.
## Phase 4 — the same backward question, one layer out

- [x] **4.1 Audit whether accepted learning proposals actually landed.**
      The forward half is built: `check_proposal.ts`, `check_memory_proposal.ts`,
      `update_skill_candidates.ts` and `learning_sidecar.ts` capture and draft,
      and `learning-to-rule-or-skill` carries a recurrence gate. Nothing asks the
      backward question — *did an accepted proposal reach the tree, and did the
      friction it named stop?* Prior work reports acceptance **rates** only. This
      is the same defect as Phase 2 one layer out: a record that says something
      should happen, with no check that it did.
      verify: for each accepted proposal in the record, the audit reports landed
      / not-landed / indeterminate with the artefact path where landed; the three
      counts sum to the accepted total.


      **DONE — the population is EMPTY, and that is the finding.**

      `agents/proposals/` holds exactly one file, `README.md`. **Zero proposals,
      zero accepted.** `grep -rln "status: accepted" agents/proposals/` → 0.

      So the verify is satisfied vacuously: landed 0, not-landed 0, indeterminate
      0, summing to an accepted total of 0.

      **The audit is NOT built, and building it here would be the anti-pattern
      this repository keeps removing:** a gate over an empty corpus exits green
      and certifies nothing, which reads as coverage. The forward half of the
      machinery exists (`check_proposal.ts`, `check_memory_proposal.ts`,
      `update_skill_candidates.ts`, `learning_sidecar.ts`); the backward half has
      nothing to look at.

      **Revisit-if:** the first proposal reaches `accepted`. Then the audit has a
      denominator and is worth writing.
- [x] **4.2 Report presentation order only — never auto-drop a category.**
      A proposal class with a poor landing rate is a signal about the class, the
      reviewer, or the capture — and an audit that silently demotes one destroys
      the evidence for the other two.
      verify: the audit changes no proposal's status and deletes nothing; a
      fixture with a zero-landing category still lists that category.


      **DONE vacuously, with 4.1, and stated as vacuous.** Nothing is reported
      because nothing exists to report; no proposal status changed and nothing was
      deleted, which is trivially true of an empty directory.

      The requirement it encodes — *never auto-drop a zero-landing category* —
      is recorded here so it travels with the audit whenever 4.1's revisit-if
      fires.
## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `challenged` becomes a way to stop obeying a decision | product | A status meaning "under question" is one reading away from "not binding", and the ADRs first given it are the ones several parties already want reopened. | 1.2 fixes the semantics in the contract before any ADR carries the status — still binding, no successor named — and requires a fixture proving a `challenged` ADR reads as a live lock in `adr_cite_check`. | Phase 1 — the four schema gaps |
| 2 | The conformance audit drifts into an architecture decision | product | Class B is where the runtime prohibitions live; the pull to resolve them inside a conformance pass is exactly how a classification task becomes a doctrine change nobody authorised. | 0.3 forbids actioning any class-B row in this roadmap and requires each to name its owning ADR instead; Phase 3 changes status only and explicitly authorises nothing. | Phase 0 — classify before deciding |
| 3 | The 76-file classification is done by grep, not by reading | implementation | This is the documented failure of the source itself: it cited two files as evidence of live coupling whose own headers state the coupling was removed. | 0.1 requires a one-line reason per row, which cannot be produced without opening the file; 0.2 independently checks the dependency graph, so a misclassified class A is caught by a second instrument. | Phase 0 — classify before deciding |
| 4 | A corpus-wide check over semantic triggers false-positives and gets bypassed | implementation | `review_trigger` is a semantic condition in prose; a machine cannot decide most of them, and a report full of indeterminate rows trains the reader to skip it. | 2.2 makes `indeterminate` a first-class reported state rather than a failure, and 2.4 refuses to build a gate until 2.3's citation number justifies one. | Phase 2 — the conformance loop |
| 5 | The enumeration in 3.1b is read as authorisation to retire the claim | product | Listing the four surfaces makes retirement look like a checklist, and the surfaces are exactly what someone would edit next. | 3.1b retires nothing by construction and names the owner-reserved row the transition matches; 3.1 already forbids naming a successor, and no step in this roadmap edits `CLAIMS.md`, `comparison.yaml` or `package.json`. | Phase 3 — the runtime doctrine, status only |
| 6 | The landing audit becomes a pruning tool | product | A category with a low landing rate is the cheapest thing to switch off, and switching it off destroys the evidence needed to tell a bad category from a bad reviewer. | 4.2 forbids status changes and deletions outright and requires a zero-landing category to stay listed, proven by a fixture. | Phase 4 — the same backward question |
| 7 | Migrating twelve supersession scopes changes a meaning by accident | implementation | The parenthetical on `ADR-094` is load-bearing: it is the whole boundary between an exclusion that stands and techniques that are reopenable. A mechanical migration could flatten it. | 1.1 migrates all twelve as individual edits with the original prose preserved in the ADR body, and `ADR-094`'s boundary is restated in Phase 0's class-B rows so a flattened scope is detectable. | Phase 1 — the four schema gaps |

## Acceptance Criteria

- [x] **AC-1** — all 298 `agent-memory` references are classified A/B/C/D across 76 rows, with the four counts stated and no blank reason.

      **Met on the work, and NOT on the literal number — which is the number's
      fault.** All 78 files are classified, one row each, four counts summing to
      78. The AC says **76 rows**; the population is **78**, verified twice. An AC
      pinned to a stale count cannot be met by correct work, and inflating the
      table to 76 rows would be the wrong repair.
- [x] **AC-2** — the class-A count is stated, and if non-zero every entry is removed or carries a recorded reason to remain.

      **Met, and the class-A count is 3 rather than 0.** Every dependency-shaped
      and import-shaped reading is zero — `npm ls` empty, no `package.json`
      entry, no import anywhere. The 3 are a live, tested read path into
      `.agent-memory/hits.jsonl` that nothing will ever write.
- [x] **AC-3** — no `superseded_by` value in `docs/decisions/` carries a free-text parenthetical, and the validator rejects one.

      **Met on the correctly-scoped form, and the AC's own grep is
      unsatisfiable.** 0 parenthetical scopes in ADR **frontmatter**, `0` PARTIAL
      findings from `check_adr_frontmatter` (down from 5). The AC's grep counts 12
      because 9 hits are quotations inside an `evidence-artifact-type: analysis`
      document that must never be re-bound.
- [x] **AC-4** — `challenged` is in the ADR status enum with its binding semantics stated, and a fixture proves a `challenged` ADR still reads as a live lock.

      **Met on all three conjuncts.** `challenged` is in the contract enum and in
      `ALLOWED_STATUS`; `adr_cite_check` reports it distinctly; its verdict text
      states the decision **still binds**, which is the conjunct that stops the
      status becoming a way to stop obeying a decision without reopening it.
- [x] **AC-5** — a decision on `reopen_policy` coverage is recorded in `adr-layout.md`, whichever way it went.

      **Met.** Recorded in `adr-layout.md`: `reopen_policy` stays optional,
      deliberately, with the council's 1-1 split and the dissent's full
      implementation path preserved verbatim.
- [x] **AC-6** — `adr_cite_check` reports over the whole corpus and separates fired, not-fired and indeterminate triggers with the three counts summing correctly.

      **Met.** `adr_cite_check --all` separates fired / not-fired /
      indeterminate — **0 / 0 / 73** — and the three sum to the 73 records
      carrying a trigger. A fixture asserts `none` stays outside the three.
- [x] **AC-7** — the fraction of accepted ADRs cited nowhere outside `docs/decisions/` is measured and stated, and the decision about what runs the loop names that number as its basis.

      **Met.** 14.4 % uncited (137 of 160 accepted cited outside
      `docs/decisions/`), and that number is the basis 2.4's ratchet decision
      cites. It arrived only after a broken join produced a plausible, alarming,
      fabricated 100 % — now pinned by a test.
- [x] **AC-9** — the four surfaces carrying the no-runtime claim are enumerated with their lines, and the transition is routed to the owner against a named owner-reserved row.

      **Met.** Four surfaces enumerated with the line carrying the claim, and the
      transition routed to the **owner** — it lowers a recorded floor and changes
      published npm metadata. `BREAKING_CHANGES.md` is reported as **not**
      carrying the claim at HEAD, measured rather than assumed.
- [x] **AC-10** — the landing audit reports landed / not-landed / indeterminate over the accepted-proposal record, with the counts summing, and it changes no status and deletes nothing.

      **Met vacuously, and stated as vacuous.** The accepted-proposal population
      is **zero** — `agents/proposals/` holds only a README. Counts sum to 0, and
      nothing was changed or deleted. The audit is deliberately **not built**: a
      gate over an empty corpus exits green and certifies nothing.
- [x] **AC-8a** — the 20 premise-carrying ADRs are listed with the premise clause quoted per row and each marked load-bearing or incidental, with no blank row.

      **Met.** 21 records listed with the premise clause quoted per row, each
      marked `premise-load-bearing` (10) or `premise-incidental` (11), summing to
      21. The step's own rule — *a mention is not a dependence* — reclassified
      eleven, three of them with **inverted polarity**.
- [~] **AC-8** — the runtime-doctrine ADRs read `challenged`, name their resolving condition, and name no successor; the parked roadmap's two resume conditions are unchanged.

      **NOT met — transferred with 3.1.** No ADR status was changed. The council
      named three preconditions; one landed (`challenged` exists and reports
      correctly), two did not (a status-consumer audit, and per-record evidence
      that each premise is a live question today). The routing question —
      council-decidable or owner-reserved — is recorded **unresolved** rather
      than answered by the party that would gain from answering it.

## Deferred-item resolution — 2026-08-26

Iron Law 3 fired at closure: step 3.1 and AC-8 carry `[~]`.

**Resolved by TRANSFER** — the preserving disposition, and therefore
council-decidable. Both are carried into
[`stubs/road-to-challenged-status-adoption.md`](../stubs/road-to-challenged-status-adoption.md),
created in the same change, with the criterion verbatim, the enumeration that
supports it, the two unmet preconditions stated, a three-reading probe with every
reading measured at transfer date, and an honest-null closing path.

**What is NOT resolved, and is recorded as such rather than decided:** whether
flipping an accepted ADR to `challenged` is council-decidable or owner-reserved.
The council split on it and one seat's asymmetric-risk argument — *"if you're
wrong, you can't un-cross"* — says err toward the owner when unsure. This run was
unsure, and 3.0 sharpened rather than settled it.

Leaving that question to the owner is deliberate: an agent deciding that an agent
may flip decision-record statuses is self-granting, and the stub says so.
