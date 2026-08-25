---
complexity: structural
status: draft
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

## Phase 0 — classify before deciding anything

- [ ] **0.1 Sort all 298 `agent-memory` references into the four conformance classes.**
      A — live external coupling · B — architectural assumption inherited from
      the agent-memory era · C — legitimate historical reference · D —
      stale or misleading. Read each file's header before classifying it; the
      review's own error was grepping without reading, and it is recorded there
      as the lesson.
      verify: a committed table under `agents/evidence/analysis/` with one row per
      file, 76 rows, each carrying a class letter and a one-line reason; the
      four class counts sum to 76 and are stated.

- [ ] **0.2 Establish whether any class-A coupling exists at all.**
      The two scripts the review cited as evidence of coupling say in their own
      headers that it was removed. Class A may be empty, and an empty class A is
      a real and valuable answer.
      verify: `npm ls @event4u/agent-memory` is empty, `package.json` carries no
      such dependency in any position, and the class-A row count from 0.1 is
      stated — zero included.

- [ ] **0.3 Separate class B from the runtime question before touching either.**
      Class B holds blanket prohibitions written when persistence was out of
      scope — the `vector` / `daemon` / `pgvector` guards. Whether those should
      stand is a runtime question, not an `ADR-094` question, and merging the two
      is how a conformance audit turns into an architecture decision nobody
      authorised.
      verify: every class-B row names the guard and the ADR that would own its
      reopening; no class-B row is actioned in this roadmap.

- [ ] **0.4 Extend the classification beyond `docs/decisions/` to archived roadmaps and harvest dispositions.**
      An ADR is not the only place a rejection is recorded. A capability
      refused in an archived roadmap *because* an ADR prohibited it stays
      refused when that ADR changes, and the refusal record keeps reading as a
      live veto. This is the one gap the ADR-scoped phases above genuinely have,
      and it is scoping, not a second mechanism.
      verify: the corpus for Phase 2's loop names `agents/roadmaps/archive/`
      and `agents/roadmaps/skipped/` alongside `docs/decisions/`, and a
      spot-check finds at least one archived refusal whose stated reason cites
      a decision record.

## Phase 1 — the four schema gaps

- [ ] **1.1 Add a machine-readable scope to supersession.**
      A `scope:` sub-field, or an equivalent the validator can read, so that
      *"engine-adoption interpretation only"* stops being prose. Twelve ADRs
      carry the parenthetical form; migrate all twelve, not `ADR-094` alone —
      one instance is a sample, not the population.
      verify: `grep -hoE 'superseded_by: .*' docs/decisions/*.md | grep -c '('`
      returns 0, and the frontmatter validator rejects a parenthetical scope.

- [ ] **1.2 Add the `challenged` status to the ADR contract, with its meaning stated.**
      It records "accepted, and under active question"; it does **not** name a
      successor, and it does not suspend the decision. An ADR that is
      `challenged` still binds until something replaces it — otherwise the status
      becomes a way to stop obeying a decision without reopening it.
      verify: `adr-layout.md`'s enum carries it, `adr_cite_check` reports it
      distinctly from `accepted` and from `superseded`, and a fixture ADR at
      `challenged` still reads as a live lock.

- [ ] **1.3 Decide whether `reopen_policy` becomes required, and for which ADRs.**
      8 of 185 is not a rollout. Either it is required going forward and the
      backlog is explicitly left at the `unclassified` default, or it is
      required everywhere and 177 files need a value — which is a real cost and
      the maintainer's call, not a lint's.
      verify: the choice is recorded in `adr-layout.md`; if "going forward", the
      validator requires it on new ADRs only, and a fixture proves an old ADR
      without it still passes.

- [ ] **1.4 Record the revisit doctrine as an ADR.**
      The doctrine currently lives only in a rule. That is where the obligation
      belongs, but a decision about how decisions work is itself a decision, and
      the review's point — that an ADR is a hypothesis with an expiry, not a
      monument — has nowhere to be recorded and later revisited.
      verify: the ADR exists, cites `decision-revisit-gate` as its enforcement
      surface rather than restating it, and carries its own `review_trigger`.

## Phase 2 — the conformance loop

- [ ] **2.1 Make `adr_cite_check` runnable across the corpus, not one ADR at a time.**
      verify: a corpus mode returns one row per ADR with status, successor state
      and `review_trigger` state, and completes over all 185 within the repo's
      gate-time budget.

- [ ] **2.2 Report the ADRs whose `review_trigger` has fired or cannot be evaluated.**
      This is the first thing the corpus mode is for. A fired trigger on an
      `accepted` ADR is the single highest-value signal the corpus can produce,
      and today nobody looks.
      verify: the report separates fired · not-fired · indeterminate, and the
      three counts sum to the number of ADRs carrying a trigger.

- [ ] **2.3 Answer the write-only question the source raised, with a number.**
      Of 185 accepted ADRs, how many are cited anywhere outside `docs/decisions/`?
      An ADR nobody references is not necessarily wrong — but the population that
      is decided, documented and never consulted is the measurement that decides
      whether anything further is worth building here.
      verify: a count plus the list, produced by a command in this file; the
      uncited fraction is stated as a percentage of 185.

- [ ] **2.4 Decide what, if anything, runs the loop — and do not build a gate on a guess.**
      A CI gate over 185 semantic conditions has an unmeasured false-positive
      rate, and this repository's own record on that is explicit. 2.3's number
      decides between a gate, a periodic report and nothing.
      verify: the decision is recorded with 2.3's number as its basis; if the
      answer is "nothing", that is written down rather than left as an
      unstarted step.

## Phase 3 — the runtime doctrine, status only

- [ ] **3.0 Enumerate the ADRs whose rejection rested on the runtime premise, before flipping any status.**
      Setting one ADR to `challenged` while its dependent rejections keep
      standing as architecture vetoes is the failure mode a second inbox
      artefact named on 2026-08-24, and it is right. Measured at HEAD
      `b15b63d38`: **20 ADRs** carry a no-runtime / no-daemon / no-persistence
      premise, and `docs/contracts/no-runtime-boundary.md` is the contract they
      lean on. That is the population 3.1 has to name, not a single record.
      verify: a committed list of the 20 with the premise clause quoted per row,
      and each row marked `premise-load-bearing` or `premise-incidental` — a
      rejection that merely mentions daemons is not one that rests on them.

- [ ] **3.1 Set the runtime-doctrine ADRs to `challenged`, naming the trigger and naming no successor.**
      This is a status change and a recorded question. It selects no
      architecture, authorises no prototype and reopens no budget. The source's
      own converged position is that a preference stated before the measurement
      is the failure the evidence culture exists to prevent — and it withdrew its
      own bet on a specific outcome for that reason.
      verify: the affected ADRs read `challenged`, each names the condition that
      would resolve it, and none names a successor ADR or a preferred variant.

- [ ] **3.1b Enumerate the surfaces a retirement would have to touch, and route the transition correctly.**
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

- [ ] **3.2 Record what a resolution would require, and where that already stands.**
      `agents/roadmaps/later/road-to-agent-config-next.md` already parks this
      program with two resume conditions, both measured unmet on 2026-08-24 —
      one of them falsified rather than merely pending. The status change does
      not alter that, and this step exists so the next reader does not
      re-derive it.
      verify: the `challenged` ADRs point at the parked roadmap's resume
      conditions; nothing in this roadmap flips them.

## Phase 4 — the same backward question, one layer out

- [ ] **4.1 Audit whether accepted learning proposals actually landed.**
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

- [ ] **4.2 Report presentation order only — never auto-drop a category.**
      A proposal class with a poor landing rate is a signal about the class, the
      reviewer, or the capture — and an audit that silently demotes one destroys
      the evidence for the other two.
      verify: the audit changes no proposal's status and deletes nothing; a
      fixture with a zero-landing category still lists that category.

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

- [ ] **AC-1** — all 298 `agent-memory` references are classified A/B/C/D across 76 rows, with the four counts stated and no blank reason.
- [ ] **AC-2** — the class-A count is stated, and if non-zero every entry is removed or carries a recorded reason to remain.
- [ ] **AC-3** — no `superseded_by` value in `docs/decisions/` carries a free-text parenthetical, and the validator rejects one.
- [ ] **AC-4** — `challenged` is in the ADR status enum with its binding semantics stated, and a fixture proves a `challenged` ADR still reads as a live lock.
- [ ] **AC-5** — a decision on `reopen_policy` coverage is recorded in `adr-layout.md`, whichever way it went.
- [ ] **AC-6** — `adr_cite_check` reports over the whole corpus and separates fired, not-fired and indeterminate triggers with the three counts summing correctly.
- [ ] **AC-7** — the fraction of accepted ADRs cited nowhere outside `docs/decisions/` is measured and stated, and the decision about what runs the loop names that number as its basis.
- [ ] **AC-9** — the four surfaces carrying the no-runtime claim are enumerated with their lines, and the transition is routed to the owner against a named owner-reserved row.
- [ ] **AC-10** — the landing audit reports landed / not-landed / indeterminate over the accepted-proposal record, with the counts summing, and it changes no status and deletes nothing.
- [ ] **AC-8a** — the 20 premise-carrying ADRs are listed with the premise clause quoted per row and each marked load-bearing or incidental, with no blank row.
- [ ] **AC-8** — the runtime-doctrine ADRs read `challenged`, name their resolving condition, and name no successor; the parked roadmap's two resume conditions are unchanged.
