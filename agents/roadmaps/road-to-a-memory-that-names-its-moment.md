---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search, 2026-10-25 at 3673d22e2e: `grep -rlF -e memory_recall_hook -e RECALL_RULES -e ADR-138 -e evaluateKillCriterion -e generate_knowledge_index -e recall_when -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs` over the whole roadmap tree returned nothing, and agents/roadmaps-owned.md rows no roadmap owning the memory substrate. The invocation asked for this round's roadmaps to be executed at once, which is the operator exception to the inbox WIP rule; with four active roadmaps this is the fifth slot. Two dated deadlines sit inside it: the ADR-138 90-day gate on 2026-10-28 and the learning-dogfood closing condition on 2026-10-31. Rejected: parking all of it in later/, because both dates fall before any active roadmap is expected to close; and appending to an existing roadmap, because none of the four active ones touches memory."
estate_growth_exempt: "+1 active_roadmaps, 4 to 5, inside the WIP cap of five: the invocation that authored this roadmap asked for it to be executed in the same run, and two of its steps carry dates (2026-10-28, 2026-10-31) that a parked roadmap would miss."
relates:
  - slug: road-to-a-memory-the-consumer-owns
    relation: disjoint
    note: "Parked follow-up from the same round. Owns the structural rest (one profile per layer, index drift, recall_when, focus/goals, temporal facts, second view, navigation counter, bench classes); nothing here re-plans it."
  - slug: road-to-typed-knowledge-graph-memory
    relation: disjoint
    note: "Stub owning a typed graph memory behind its own gates; the round's graph and vector proposals were recorded there as an arrival, not planned here."
---
# Road to a memory that names its moment

> **Source:** `agents/tmp.old/inbox-2026-10-aq/` — one owner chat with two external
> assistants, four drafted roadmaps (two revisions of one plan, two of another) and a
> sources annex, drafted against `a15a8bb` and re-verified here against `3673d22e2e`.
> Every defect below was checked at the newer SHA; none had been fixed in the 582
> commits between.

> **The owner's demand, turn 1:** "Ich will agent config noch weiter verbessern …
> was können wir lernen, nutzen und adaptieren?" — read through a short video on a
> folder-as-memory second brain. **Turn 2:** go deeper with everything known, three
> loops, to a final roadmap.

## Context — the second brain exists, the consumer cannot reach it

The video's three steps — a folder as memory, being interviewed instead of typing
notes, self-maintenance — already exist here: typed knowledge pages with a
generated `INDEX.md`, the ADR-138 global user profile with an observation buffer,
revocations and an audit render, a one-question-per-round persona interview, and an
FTS5 index derived from the files. What the drafts found, and this run re-verified,
is that the consumer meets almost none of it, and meets one piece of the maintainer's
own memory instead:

- `RECALL_RULES` (`src/scripts/hooks/memory_recall_hook.ts:168-210`) carries four
  rows seeded from the maintainer's host memory, bound on `pre_tool_use` for claude,
  augment and cowork (`src/scripts/hook_manifest.yaml:1667,1709,1761`). A consumer
  editing `docs/adr/ADR-*.md` is told "you have a memory for this" with a reason that
  is true only in this repository.
- The ADR-138 kill criterion (`docs/decisions/ADR-138-global-user-profile-layer.md:114-130`)
  fires 90 days after the layer went live at `fa7b8e0381` on 2026-07-30 — on
  **2026-10-28**. `evaluateKillCriterion` has no caller outside its test, and
  `renderGlobalMemoryAudit` shows none of the four counters.
- Every command that would let a consumer accept an observation — the whole
  `/agents user` family — and the only contested-entry resolver, `/team-knowledge`,
  are `visibility: internal` under the `agent-config-maintainer` workspace. The gate
  would measure a visibility setting, not a user.
- Three truth surfaces say more than the tree delivers: the session index "restored
  at `session_start` across all 7 platforms" (`knowledge-pages.md:94-95`) is opt-in;
  the profile template says it "loads into every reply" (`src/templates/agent-user.md:36`)
  and no hook loads it; `second-brain-recall-lift` stays `backed` with no note that
  its working-memory half retired. `memory:add` names five types, says "four", and
  offers three.
- The learning-dogfood closing condition measures `wall_ms` of read + aggregate
  (`agents/evidence/analysis/learning-dogfood-2026-Q4.md:40,61`) against a 2 s budget,
  while the host gives all SessionEnd hooks together 1.5 s. One draft measured the
  whole slot at p95 0.26–0.29 s on one machine: no blocker, but the criterion still
  measures the wrong quantity.

## Goal

A consumer install never receives a memory it does not have; the ADR-138 gate is
readable before it falls due and is evaluated on a window the council chose; the four
truth surfaces say what the tree does; the dogfood closing condition names the slot
time against the host budget; and the profile and knowledge commands are either
reachable by consumers or kept internal by a recorded decision.

## Phase 1 — Deadlines and truth

- [x] **1.1 Fire the maintainer's recall rows only in this package.** Each of the
      four `RECALL_RULES` rows gets a `requires` predicate that holds only when a
      candidate root's `package.json` names `@event4u/agent-config`. Rows a consumer
      authors later (the parked follow-up) are unaffected; the table stays committed.
      verify: `npx vitest run tests/scripts/memory_recall_hook.test.ts` — a new case
      with a consumer root (its own `package.json`, a `docs/adr/ADR-0007-x.md` edit, a
      `src/install/a.ts` edit) stays silent; the existing package-root replays still
      fire.
- [x] **1.2 Make the ADR-138 gate readable before 2026-10-28.** `renderGlobalMemoryAudit`
      adds a gate block: the four counters, the accept rate (or "no proposals yet"),
      live-since 2026-07-30, day N of 90 and the due date, from `readGateCounters`.
      verify: `npx vitest run tests/lib/user_global_memory_audit.test.ts` — a counter
      file with 3 proposed / 1 accepted renders 33 % and the day count; an absent file
      renders zeros without throwing.
- [x] **1.3 Decide how the gate counts (E1), before it falls due.** The council
      decides, in one batched question with E2: evaluate on 2026-10-28 as written, or
      restart the 90 days from the day consumers can reach `/agents user accept`.
      The verdict lands in § Decisions and, if the window moves, as a dated amendment
      under the kill criterion in ADR-138.
      verify: `grep -nE "^\| E1 .*\| council:" agents/roadmaps/road-to-a-memory-that-names-its-moment.md`
      returns one row naming the council record; if that row says the window moved,
      `grep -n "Amendment 2026-10" docs/decisions/ADR-138-global-user-profile-layer.md`
      returns one line.
- [x] **1.4 Make the four truth surfaces say what the tree does.**
      `knowledge-pages.md` says the session index is opt-in (`memory.session_index`);
      `src/templates/agent-user.md` says the profile is read on demand by the voice
      commands, not loaded into every reply; `second-brain-recall-lift` gains a
      `non_inference` naming the retired working-memory half; `memory:add` carries one
      type list and says why `ownership` and `historical-patterns` are not offered.
      verify: `./scripts-run src/scripts/check_claims` passes; `grep -n "every reply" src/templates/agent-user.md`
      returns nothing; `grep -c "four" src/domains/meta/memory/add/command.md` agrees
      with the menu.
- [ ] **1.5 Name the slot time in the dogfood closing condition (E8).** The closing
      condition gains a second measure: p95 of the whole `session_end` dispatch on
      claude against the 1.5 s shared host budget, measured with
      `bench_hook_latency`, beside the existing `wall_ms` line.
      verify: `grep -n "1.5 s" agents/evidence/analysis/learning-dogfood-2026-Q4.md`
      shows the measure inside § Closing condition, with the command that produces it.

## Phase 2 — Reachability

- [ ] **2.1 Apply the E2 verdict to the profile and knowledge commands.** If the
      council opens them: `/agents user` (init, show, review, accept, delete, update)
      and `/team-knowledge` (bootstrap, consolidate) move from `internal` to
      `advanced`, and their workspace lists gain the non-developer profiles whose
      wizard step already writes the profile. If it keeps them internal: the reason is
      recorded at each command and in ADR-138, and the E1 window stays as decided.
      verify: an installer test or a throwaway-HOME install lists the slash wrappers
      for claude when opened, and lists none when kept internal; `task sync` and
      `task generate-tools` leave no drift.

## Decisions

| ID | Question | Route | Verdict | Record |
|---|---|---|---|---|
| E1 | ADR-138 gate: evaluate on 2026-10-28, or restart the window at consumer reachability? | council (reopens an ADR; personal-data layer) | option 2: 2026-10-28 is a non-binding baseline and a recorded rollout failure; the binding window starts at tested consumer reachability, on a fresh cohort, read at ≥ 20 proposals, threshold unchanged | council: 2026-10-25, anthropic + openai 2/2 convergent; ADR-138 Amendment 2026-10-25 |
| E2 | `/agents user` + `/team-knowledge`: `advanced` or `internal`? | council (exposes a personal-profile capture path to consumers) | option 4: `show`, `review`, `accept`, `delete` advanced with a preview and confirmation before any deletion; `init`, `update` internal; of `/team-knowledge` only the contested-entry resolution, split out if `consolidate` mutates more; non-developer profiles added | council: 2026-10-25, same round as E1 |
| E8 | Add the slot p95 against 1.5 s to the dogfood closing condition? | run (strengthens a measurement, reversible) | yes | step 1.5 |
| E6 | Receiver? | run | this roadmap for the dated work; the structural rest parked as `later/road-to-a-memory-the-consumer-owns` | Source search in frontmatter |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Recall goes silent in the package itself | implementation | The package-self predicate misreads a worktree or a parent checkout, and the four incident memories stop firing where they were seeded | The predicate is offered every candidate root the hook already collects; the existing replays run in the package root and stay green | Phase 1 — Deadlines and truth |
| 2 | The gate falls due unread | product | 2026-10-28 passes with nobody looking, and the default outcome (deprecation-with-archive) is reached by silence | 1.2 and 1.3 land before the date; the audit names the due day | Phase 1 — Deadlines and truth |

## Acceptance Criteria

- [ ] AC-1 — A consumer root editing an ADR or an install source gets no recall
      line, and the package root still gets its four.
- [ ] AC-2 — The audit render shows the gate counters and the due date, and § Decisions
      carries the council's verdicts on E1 and E2.
- [ ] AC-3 — None of the four truth surfaces states a behaviour the default tree does
      not have, and the dogfood closing condition names the slot time against 1.5 s.
