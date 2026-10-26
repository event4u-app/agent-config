---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: >
    `road-to-a-memory-that-names-its-moment` is archived, so the recall table is
    package-scoped, the ADR-138 gate window and the E2 visibility verdict are
    recorded, and a WIP slot is free under the cap of five.
  when: >
    The run that closes that roadmap; both were authored in round inbox-2026-10-aq.
  who: >
    none — the maintainer moves this file to `agents/roadmaps/` when the
    condition holds.
review_by: 2026-12-15
estate_growth_exempt: "+1 later_roadmaps: a new parked roadmap from round inbox-2026-10-aq, not a move into later/. It carries the structural half of four drafted roadmaps whose dated half is the active road-to-a-memory-that-names-its-moment."
estate_offset_exempt: "Parked, not active. Owner search, 2026-10-25 at 3673d22e2e: `grep -rlF -e memory_recall_hook -e RECALL_RULES -e ADR-138 -e evaluateKillCriterion -e generate_knowledge_index -e recall_when -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs` over the whole roadmap tree returned nothing; the nearest neighbours own a typed graph memory (stubs/road-to-typed-knowledge-graph-memory) and memory visualisation (later/road-to-a-knowledge-atlas), neither the consumer-facing substrate."
relates:
  - slug: road-to-a-memory-that-names-its-moment
    relation: disjoint
    note: "Active parent from the same round: recall scoping, the ADR-138 gate, truth surfaces, dogfood criterion, command visibility. Nothing here re-plans those."
  - slug: road-to-a-knowledge-atlas
    relation: disjoint
    note: "Owns visualising memory and knowledge. Phase 6 here only adds the edges (related:, backlinks) a view needs."
  - slug: road-to-typed-knowledge-graph-memory
    relation: disjoint
    note: "Owns a typed graph store behind four gates. Phase 8 here only records which bench classes would feed its retrieval-failure gate."
---
# Road to a memory the consumer owns

> **Source:** `agents/tmp.old/inbox-2026-10-aq/` — the structural half of the same
> round as `road-to-a-memory-that-names-its-moment`. Defect ids D2, D10–D13, D17
> are the drafts' own numbering, re-verified at `3673d22e2e`.

## Goal

A consumer's own memories and knowledge pages decide when they are recalled, the
profile lives in one file per layer that every reader and writer shares, the index
cannot go stale unnoticed, a planned change ("new job from March") lands as a
scheduled supersession rather than a contradiction, and the person layer can hold
what the user is working on and wants to reach.

## Phase 1 — One profile per layer (D13)

- [ ] **1.1 Prove or refute the split before fixing it.** Wizard and GUI write
      `settings/.agent-user.yml` (`src/server/routes/userMd.ts:42,70`); the ADR-138
      cascade and `post-as/me` read `user/profile.md` plus `.agent-user.md`
      (`src/scripts/_lib/agent_user_profile.ts:8-12,123-125`). Check whether any
      migration path already joins them.
      verify: a fixture sets a name in the wizard route and reads it back through
      `loadGlobalProfileLayer`; the result is recorded either way.
- [ ] **1.2 One canonical file per layer.** If 1.1 confirms the split: the wizard and
      GUI write into the cascade the canary, council and voice commands read; the YAML
      file is migrated through the existing settings-migration path and read only as
      legacy. No new settings key.
      verify: name set in the wizard shows in `/agents user show` and in the canary;
      an accepted observation shows in the GUI panel.

## Phase 2 — An index that survives foreign edits (D2)

- [ ] **2.1 Mark knowledge edits, regenerate once.** `post_tool_use` marks edits under
      `agents/knowledge/**` in the flush-ledger pattern `roadmap-progress` already uses;
      `stop` regenerates once. Measure the hook-bundle headroom before adding a concern.
      verify: an Edit under `agents/knowledge/` followed by a stop leaves
      `generate_knowledge_index --check` at exit 0.
- [ ] **2.2 Detect drift at session start.** `session_start` runs `--check` lazily,
      regenerates on drift and reports one line naming the changed pages. Index drift
      is metadata drift, not a contradiction: a contested entry is only opened when two
      sourced statements collide.
      verify: edit a page with `sed` outside the agent; the next session start reports
      that page and the INDEX is byte-identical to a fresh regeneration.
- [ ] **2.3 Reopen the 2026-07-07 Obsidian/vault verdict.** Its load-bearing premise
      (unguardable drift) is guarded after 2.1/2.2; its counter premise is already
      obsolete (`consolidate_knowledge_events.ts:2-9`). Read-only view first; a sync
      engine is never built.
      verify: § Decisions carries the reopened verdict with its record.

## Phase 3 — A memory that names its moment (D1 structural, D11)

- [ ] **3.1 `recall_when:` on memory entries and knowledge pages.** Closed vocabulary:
      `edit_path` (glob, repo-relative), `command` (anchored regex, length-capped),
      `tool` (allowlisted names). Predicate floor, one memory per fire, 768 B and the
      per-session latch stay.
      verify: a consumer page with `recall_when: {edit_path: "migrations/**"}` yields
      exactly one recall on the first edit and none on the second.
- [ ] **3.2 Compile the table from the consumer's stores.** The hook reads rows from
      the consumer's own stores plus the package-scoped rows; a row whose pointer does
      not resolve to a readable file emits nothing ("you have a memory" only after a
      successful read). Every row needs a generated replay case.
      verify: a stale pointer, a missing file and a revoked scope each stay silent; a
      row without a replay fails the lint.
- [ ] **3.3 Dogfood.** The four maintainer rows become `agents/knowledge/procedures/`
      pages in this package, after a check that they carry nothing personal; this gives
      the package its own INDEX.
      verify: `agents/knowledge/INDEX.md` exists and lists the four pages.

## Phase 4 — Being interviewed, in the right places (D10, D17)

- [ ] **4.1 `focus` and `goals` in the person layer.** Two profile fields with
      `valid_from` and a supersession history, learnable through the existing
      observation channel and every capture guard. Needs an ADR-138 amendment.
      verify: `grep -A9 ALLOWED_OBSERVATION_FIELDS src/scripts/_lib/user_global_observations.ts` -> /goals/ and carries `focus` too; a health-flavoured goal is
      refused by the existing exclusions.
- [ ] **4.2 Gap-only project interview.** `/team-knowledge bootstrap` asks only for
      `[HUMAN: verify]` gaps after the static pass, at most five questions, one per
      round, by page type — for non-developer profiles that means business context
      (offer, customers, running work, decisions), never private life; answers land in staging with `source: owner-interview <date>` and the
      verbatim quote, and every number or date on the page must appear in the quote.
      verify: fresh TS and Laravel fixtures with canned answers produce no page with a
      number absent from quote or manifest.
- [ ] **4.3 Filing by proposal.** `memory:add` and `/memory:propose` show one reasoned
      placement (store, type, target page) and ask once; never written silently.
      verify: five sample facts with expected placements; the hit rate is reported, no
      threshold invented.

## Phase 5 — Facts with time (D12)

- [ ] **5.1 `valid_from`, `valid_until`, `supersedes`** on pages, memory entries and
      the Phase 4 fields; the lint tells *contested*, *superseded*, *scheduled* and
      *retracted* apart. A retraction leaves a tombstone and clears derived indexes.
      verify: `npx vitest run tests/scripts/check_knowledge_pages.test.ts` -> 0 — a fixture
      pair "release branch is main" / "from 03-01 `release/*`" is classified
      *scheduled* before the date and *current* after it, never *contested*.
- [ ] **5.2 Warn on undated present-tense facts** on `concepts/` only, warn-only while
      `check_knowledge_pages` is.
      verify: a fixture page with an undated "currently" sentence raises one warning.

## Phase 6 — A second view: read, check, never sync

- [ ] **6.1 Edges for a graph view.** Document `INDEX.md` as the hub; optional
      `related:` front matter and generated backlinks. Rendering stays with
      `road-to-a-knowledge-atlas`.
      verify: a page with `related:` gets a backlink line on the target after
      regeneration.
- [ ] **6.2 The settings GUI shows the effective profile.** After Phase 1, the user
      panel (`src/ui/pages/UserMdPanel.tsx`) renders the merged cascade, the
      observation buffer and the audit text from `renderGlobalMemoryAudit`.
      verify: a UI test with a fixture HOME shows one accepted observation and the
      gate block.

## Phase 7 — Navigation demand, counted (deferred N layer)

- [ ] **7.1 Count "where is my X project" asks.** The council's `revisit-if` for the
      deferred navigation layer gets a counts-only counter in the gate-counter shape.
      The owner's statement of 2026-10-24 (not always inside a project, projects
      without an `agents/` folder) is recorded as demand evidence; any design avoids
      plain-text project paths.
      verify: the counter file holds integers only; `readGateCounters`-style reads drop
      anything else.

## Phase 8 — Bench classes (hypotheses, not a gate)

- [ ] **8.1 Extend the `second_brain_score` corpus** with consumer false-recall,
      stale index, scheduled-vs-contested and person recall; the drafts' target numbers
      go into the corpus header as hypotheses.
      verify: the corpus dry-run lists the four new classes.
- [ ] **8.2 A recall log that carries no prompt.** Arrived in `inbox-2026-10-ay`
      (2026-10-26): `memory-recall` leaves no trace of what it fired, so recall quality
      cannot be read offline and `session_index` / `learn_on_session_end` can never be
      flipped on a measurement. Append one line per fire — rule id, slug, hit or
      unreadable, a digest of the payload, never its text — under `agents/runtime/`,
      capped by lines and bytes. Measurement precondition only; no flip rides on it.
      verify: a fixture fire appends exactly one line with no payload substring, and
      the cap holds on the 1,001st fire.

## Decisions

| ID | Question | Route | Verdict |
|---|---|---|---|
| E3 | Reopen the Obsidian/vault verdict after Phase 2? | council (reopens a council verdict) | open, at 2.3 |
| E4 | Trigger the deferred navigation layer? | council | open, after 7.1 has data |
| E5 | Encrypt the global layer at rest? | council (security) | open; threat model first, reuse `link_crypto`, no new crypto stack |
| E7 | ADR-138 amendment for `focus`/`goals`? | council (amends an ADR on personal data) | open, at 4.1 |
| E9 | New canonical store (SQLite, vector, graph DB)? | run | no — files stay canonical, FTS5 stays derived (ADR-129); a graph store lives behind its own stub's gates |
| E10 | Flip `memory.session_index` on, with a demotion trigger in the ADR-103 shape? | council (consumer-facing default) | open, after Phase 3 gives the index pages worth loading |
| E11 | Transaction envelope for knowledge writes (hash precondition, staging, recovery journal)? | run | not now — knowledge writes are human-promoted and git-revisioned, and no lost update has been observed; revisit if Phase 2's ledger or a concurrent session records one |

## Declined from the drafts

- **New verbs** (`memory:capture/review/forget/why/vault/graph/timeline`) — ADR-041;
  each maps onto `memory:add/propose/promote`, `knowledge:forget`, `/agents user …`
  or `agent-config explain`.
- **A global project registry** keyed by remote, worktree and UUID — the council's
  2026-07-29 cut rejected any global project namespace on the enumeration argument.
- **Vault sync, team sync, device sync** — the files are the vault, and the global
  layer is never synchronised by council lock.
- **An intent router** classifying prompts — the predicate floor stays; Phase 7
  counts the demand instead.
- **Outcome-aware routing policy learning** — the learning-dogfood window reads out on
  2026-10-31; a second learning line before that reading would duplicate it.
- **A generated store-map contract** — ADR-130's subject axis and
  `lint_store_boundary.ts` already map the stores.
- **A context-fill warning** — already shipped as the `session-eol` concern.
- **A session-start profile pointer** — optional in the master draft; nothing asks
  for it until Phase 1 settles which file it would point at.
- **Health, legal, therapy, finance and third parties in any store** — already
  excluded by the schema, even with consent (`agent-user-schema.md`).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A consumer-compiled recall table leaks one scope into another | implementation | Rows from a global store fire inside a project that must not see them, or a private pointer reaches a shared surface | Rows carry their scope; a row resolves only inside its own scope; replay cases include a cross-scope negative | Phase 3 — A memory that names its moment |
| 2 | The hook bundle has no headroom for a new concern | implementation | Phase 2 adds code to a bundle with a few hundred bytes of headroom and reds the bundle gate | Measure the bundle before writing; extend `roadmap-progress` as the ledger carrier before adding a concern | Phase 2 — An index that survives foreign edits |

## Acceptance Criteria

- [ ] AC-1 — A consumer's page with `recall_when` is recalled at its moment, and no
      recall fires without a readable source.
- [ ] AC-2 — The wizard, the canary and the learning loop read and write the same
      profile file per layer.
- [ ] AC-3 — A foreign edit to a knowledge page is caught at the next session start,
      and a planned change lands as *scheduled*, never as *contested*.
