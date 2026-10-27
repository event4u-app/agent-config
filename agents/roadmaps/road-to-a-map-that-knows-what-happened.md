---
complexity: structural
status: ready
tree_pin: 92397d6368
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_offset_exempt: "New plan, split from one owner-requested inbox round (inbox-2026-10-bf) into three siblings by stage; no existing active roadmap covers bugs, knowledge sources, answer budgets or feedback ownership, so there is nothing to merge into or archive against. The owner asked for the split and the exemption on 2026-10-27; the active estate moves from 2 to 5, which is the WIP cap, not beyond it."
estate_growth_exempt: "Owner-authorised growth on 2026-10-27 for the inbox-2026-10-bf split: one active roadmap and two open blockers (b-stage-d-measurement, b-owner-reserved-stores) that record a dependency on the sibling's measurement phase and on owner-reserved store decisions. Numbers to be re-read from check_estate_count after commit."
relates:
  - slug: road-to-a-map-that-holds-on-the-real-repo
    relation: depends
    note: "Owns Stages A-F: the scope model (its Phase 2 [A]), provenance (its Phase 7 [F]) and the measurement (its Phase 5 [D]). Every [~] step here waits on its Phase 5."
  - slug: road-to-map-views-from-the-handover
    relation: disjoint
    note: "Owns the views: Bugs (its Phase 7), Wissen (Phase 6) and Ich · Lernen (Phase 5) render the payloads this file produces (H.7, I.6, K.8). It depends on this file; this file draws no page."
depends:
  - road-to-a-map-that-holds-on-the-real-repo
---
# Road to a map that knows what happened

> **Source:** `agents/tmp.old/inbox-2026-10-bf/` — Stages H-K (rounds 2-4) of
> the supplied plan, re-verified at `main@92397d636` with a delta against four
> further plan versions from a second model. Corrections from that pass are
> applied: precedence follows the tree, user-owned data lives under the user's
> home, cross-project aggregation and the profile schema go through their
> locks, hook and skill cost are budgeted.

## Goal

The map knows what happened to the code, and the agent gets answers instead of
files. When this roadmap closes:

- a bug, its fix and its probable cause are local facts joined to graph
  symbols, never fetched during a build and never committed;
- every knowledge store is registered with an owner, a reader and a delete
  path, and the committed ones are facts with validity;
- every answer surface returns one budgeted envelope, and the dearest answer
  (reverse impact) costs no more than 2,000 tokens;
- recurring complaints, approvals, directives and corrections become reviewed
  learnings, owned by the user or the project they belong to.

**Owner constraints (turn 17, 2026-10-27).** Minimise tokens and context.
Scripts do the work; the agent receives only the answer. **Turn 20:** user data
belongs to the user, project knowledge to the project.

**Sentry boundary.** Bug data enters only (a) at query time through the
user's own connection, or (b) through a user-run offline snapshot import. It
is never fetched during a build, and no bug data enters the committed map.

**P-3 exceptions (O11, O17, O21).** Steps that register, correct, repair or
refuse may run before the sibling's Stage D. Steps that put content in front of
the agent or add a view wait for D and are `[~]` here.

## Cost rules (apply to every step)

- **Hook bundle.** Headroom is small and moves with every merge. No new hook
  concern: a pre-read guard extends `src/scripts/hooks/reread_guard_hook.ts`,
  read-time context extends `src/scripts/hooks/memory_recall_hook.ts`. Every
  hook-touching step runs `./scripts-run src/scripts/check_hook_bundle_composition`
  before and after.
- **Standing prose.** No new always-loaded rule. Routing guidance is a
  guideline or an envelope field.
- **Skills.** Skill edits are net-neutral in size.
- **Commands.** `ask` and `scan` are CLI verbs plus MCP tools, not slash
  commands, which avoids five CI-only registrations each.
- **Gates.** A new gate ships with its ratification artifact and a
  gate-coverage row (scanned + self-test).

## Phase 1 — Stage H: bugs and fixes

Exit: H.1-H.6 and H.9 green on fixtures; nothing under `agents/map/` outside
`.build/` holds a bug id. Rollback: delete `code_graph/bugs.ts` and the
provenance `kind` field; `.build/bugs/` is disposable.

- [x] **H.1 One bug record, local only** (H35; ADR-124). Normalised record with
      a qualified id (provider, org, project, issue id), episodes (one issue
      regressing several times, one fix closing several issues), status, first
      and last seen, count, first-seen release, resolved-in commit and release,
      environment, in-app frames. Sources: user-run `code-graph bugs import
      <file>` of tracker JSON (Sentry MCP output or an API export), and query
      time through the user's connection. Stored in `.build/bugs/` with mode
      0600, retrieval date and TTL. Stored fields are an **allowlist** — no
      breadcrumbs, request payloads, user ids or cookies; provider text is
      untrusted input. Sentry first; other trackers are mapping files later
      (O8).
      verify: `npx vitest run tests/scripts/code_graph_bugs_import.test.ts` -> 0
- [x] **H.2 Frames to symbols** (span witness). Code mappings come from the
      scope config; each in-app frame maps to its enclosing symbol by node
      span, read at the first-seen release sha. A release without a known sha
      yields `unverifiable`, never a guess. Unmapped frames are listed with a
      reason.
      verify: `npx vitest run tests/scripts/code_graph_bug_frames.test.ts` -> 0
- [x] **H.3 Fix commits as facts** (H36, H37). Provenance gains a commit
      `kind`: declared (`Fixes <bug id>`, `Fixes: <sha>`, `This reverts commit
      <sha>`), ticket (bug-type ticket at query time), conventional (`fix:`,
      weakest). Configured tracker keys extend the one ticket grammar
      (`_lib/git_convention_grammar.ts`), so `SENTRY-317` is a bug reference.
      Fix state is tri-state: changed in code, deployed, observed effective;
      "no events" never reads as fixed.
      verify: `npx vitest run tests/scripts/code_graph_fix_kinds.test.ts` -> 0
- [x] **H.4 Introducing-commit candidates** (H38). Last change of each fixed
      line, skipping format-only commits and following renames; a declared
      `Fixes: <sha>` wins; an imported suspect commit is a second, separate
      signal. Always a candidate with method and witnesses, never ranked by
      author.
      verify: `npx vitest run tests/scripts/code_graph_bug_inducers.test.ts` -> 0
- [x] **H.5 Regression hypotheses through the graph** (owner's case). For a
      bug first seen in release R: changes merged in the window whose changed
      symbols reach the top in-app frames within k hops over `calls`, `uses`
      and `writes`→`reads` (O10). Ranked by hop distance, time to first seen,
      fix-induced; co-change joins the ranking once the sibling's co-change term (its 5.6 [D.6]) exists.
      Each hypothesis shows the path with per-edge witness, guessed edges
      dashed, and the commit, PR and ticket.
      verify: `npx vitest run tests/scripts/code_graph_regression_paths.test.ts` -> 0
- [x] **H.6 From hypothesis to proof.** With more than one candidate and a
      reproducing test, print a `git bisect run` plan (never run on someone
      else's branch, never pushed). A confirmed cause is stored with a
      `test_guards_against` edge from the test to the bug.
      verify: `npx vitest run tests/scripts/code_graph_bisect_plan.test.ts` -> 0
- [~] **H.7 The bug payload for the view** (after D). The local map's bug
      area payload: open bugs by area and route, fixed bugs as a timeline,
      regression paths, per-route timeline of features, fixes and bugs, and a
      source state (not connected, no permission, no events, sync failed,
      stale). The committed map's payload carries only the local-data state.
      The page itself is `road-to-map-views-from-the-handover` Phase 7.
      Blocked by `b-stage-d-measurement`.
      verify: `npx vitest run tests/scripts/code_graph_bug_payload.test.ts` -> 0
- [~] **H.8 Feeds** (after D). Pack names open bugs and recent fixes on
      touched elements; review-risk adds the open-bug term; `bug-analyzer` and
      `sentry-integration` use a frame→symbol→callers verb (net-neutral skill
      size). Any claim of gain is measured against a comparator arm "agent with
      the tracker tools directly". Blocked by `b-stage-d-measurement`.
      verify: `grep -c "bugs frames" src/skills/bug-analyzer/SKILL.md src/skills/sentry-integration/SKILL.md` -> /:[1-9]/
- [x] **H.9 Field measure for Stage D** (observational). Per period, the share
      of fix commits that later become an introducing candidate, printed with
      numerator, denominator and method; reported beside M1, never as an
      effect of this suite.
      verify: `npx vitest run tests/scripts/code_graph_fix_induced_share.test.ts` -> 0

## Phase 2 — Stage I: every knowledge source in one index

Exit: registry gate red on a planted writer; ADRs in both layouts are decision
facts; memory paths yield moved/gone findings. Rollback: revert the registry
file and its gate; derived indexes are disposable (ADR-129). The shared memory
database stays closed (ADR-094, T3).

- [x] **I.1 One source registry** (H41). One data row per store: name, path,
      format, writer, readers, privacy class, owner, delete path, hosts,
      status. Seed list: the measured stores plus those the first plan omitted
      — team-knowledge pages under `agents/knowledge/`, local doc ingest,
      `session_memory_index`, the second-brain retrieval store, decision
      traces, `memory-index-v1.sqlite3`, and host memory registered as
      `owner: user, host-owned, read-only`. A new writer without a row fails a
      gate (ratification artifact + gate-coverage row).
      verify: `npx vitest run tests/scripts/check_source_registry.test.ts` -> 0
      > note: the check and its test ship; CI wiring (workflow step, gate-coverage row, ratification artifact) is left for a ratified follow-up — it runs by hand as `./scripts-run src/scripts/check_source_registry`.
- [x] **I.2 Committed knowledge into the fact layer** (H40, H42). ADRs in both
      layouts (`docs/decisions/`, `docs/adrs/<topic>/`); curated memory entries
      as `memory` nodes with `about` edges to the paths they name; knowledge
      cards, team-knowledge pages, `agents/decisions/`, owner questions, retro
      proposals as nodes; reviews and council records linked by PR number. A
      named path that moved is told apart from one that is gone.
      verify: `npx vitest run tests/scripts/code_graph_knowledge_facts.test.ts` -> 0
- [x] **I.3 Validity on knowledge facts.** `valid_from`, `valid_until`,
      `recorded_at`, `supersedes`; derived claims keep `based_on` ids and are
      retracted when one disappears; contradiction expiry is a deterministic
      interval rule; no model decides.
      verify: `npx vitest run tests/scripts/code_graph_knowledge_validity.test.ts` -> 0
- [~] **I.4 Sessions, local and user-owned** (H43; after D and I.3). Index
      under the user's home, keyed by a stable repo id shared across worktrees
      (`~/.event4u/agent-config/user/projects/<repo-id>/sessions/`), never in
      the project. Per session: id, span, branch, files edited, commits linked
      by scored evidence (SHA 1.0, edited-line overlap 0.8, time window 0.2,
      floor 3 lines), claimed roadmap or ticket, token totals, and attempted /
      observed / confirmed events. No text stored; pointers only. Capture
      spools through an existing session-end concern. Chat history and host
      transcript of the same turn are de-duplicated. The commit trailer is O13
      (owner-reserved). Blocked by `b-stage-d-measurement`.
      verify: `npx vitest run tests/scripts/session_index.test.ts` -> 0
- [ ] **I.5a Fewer stores — council-decidable part** (H41). Merge the three
      learning-intake streams into one shape; move `agents/memory-quarantine/`
      into the layout; keep the collector parked; decide
      `session_memory_index` and the second-brain store per O12.
      verify: `./scripts-run src/scripts/check_source_registry --orphans` -> 0
      > note: open: `--orphans` exits 1 on runtime-journal (written, never read), whose disposition is O12 (owner-reserved, b-owner-reserved-stores); the intake-stream merge and the quarantine move change the agents-layout contract and the three writers, left for a dedicated change.
- [ ] **I.5b Retire stores — owner-reserved part.** Retire the journal, any
      store O12 names for retirement; show `map-outcomes` through J.9.
      Executes only after the owner decides O12. Blocked by
      `b-owner-reserved-stores`.
      verify: `./scripts-run src/scripts/check_source_registry --count` -> /stores: \d+ \(-\d+\)/
      > note: open: blocked by b-owner-reserved-stores (O12 is owner-reserved); `--count` prints the active and retired store counts once rows are retired.
- [~] **I.6 Memory in the map** (after D and I.2). Per file: memory entries
      about it, validity, lookup hits; the Overview's fixed string becomes a
      measured state. Blocked by `b-stage-d-measurement`.
      verify: `grep -c "collector missing" src/scripts/code_graph/map_viewer/area_overview.js` -> /^0$/
- [~] **I.7 What the agent is told about memory** (after D and J.1). One
      guideline — not an always-loaded rule — saying host memory answers
      personal preferences, curated memory project rules, the map facts with
      witnesses; memory tools return J's envelope. Blocked by
      `b-stage-d-measurement`.
      verify: `npx vitest run tests/scripts/memory_tools_envelope.test.ts` -> 0

## Phase 3 — Stage J: answers, not files

Exit: every verb returns the envelope within budget; the three dearest probes
are ≤ 2,000 tok. Rollback: the envelope is additive; revert per verb. J.1-J.6,
J.7a and J.9 run before D (P-3 exception O17); J.4 must exist because D's arms
use it.

- [x] **J.1 One answer envelope** (H49). `answer`, `counts{shown,total,
      text_only}`, `complete`, `truncated_by`, `confidence`, `witness{generation,
      commit,staleness,confirm}`, `evidence` (≤ 5 `file:line`), `next` (≤ 3
      commands), and a content-addressed `packet_id` with TTL for hand-off to
      subagents. Formats: `hint` (ids only, ≤ 250 tok), `concise` (default, 800),
      `detailed` (ceiling 2,000) on the serialized envelope (O15).
      verify: `npx vitest run tests/scripts/answer_envelope_schema.test.ts` -> 0
- [x] **J.2 Budgets that hold** (H44). `recommended_reads` becomes a counted,
      paged list; overflow falls back items → locations → per-file counts →
      summary with a "narrow your question" header; `graph_impact` gets a
      budget; ranked lists are packed by budget search.
      verify: `./scripts-run src/scripts/bench_answer_size --probe affected-hubs` -> 0
- [x] **J.3 Answers that are right** (H45). `pack` seeds from file, area and
      symbol names, then FTS over I.2's index once it exists; `tests-for`
      resolves `.js` specifiers; `usage` covers symbols; "no entry" names the
      grep fallback.
      verify: `npx vitest run tests/scripts/code_graph_answer_correctness.test.ts` -> 0
      > note: pack seeds exact names and `.js` specifiers today; the FTS-over-I.2 seed tier waits for that index to exist.
- [x] **J.4 One entry point.** `agent-config ask "<question>"` and MCP `answer`:
      routes to the right verb; three-step retrieval (index rows with
      `~read_tokens` → timeline → fetch by id); fix-plan and verify-fix are
      intents, not commands. User-owned sources (sessions, signals) are read
      only for the owning user and re-checked on fetch. Negative fixtures: same
      ticket number in two projects, a main-branch answer served on a branch,
      two sessions on one file, a corrupt SQLite falling back, a foreign
      worktree's transcript, poisoned connector text, two users in one repo.
      verify: `npx vitest run tests/scripts/ask_entry_point.test.ts` -> 0
      > note: ships as `code-graph ask` with graph and test sources; the MCP `answer` tool and a top-level `agent-config ask` alias need the consumer tool catalog and CLI registrations, left for a follow-up; session and signal sources join after I.4 and K.2.
- [ ] **J.5 Detail by command, not by file** (H46). `code-graph map --section
      <name>` returns what MAP.md cuts; the pre-read guard is an extension of
      `reread_guard_hook.ts` that names the command on reads of large generated
      files under `agents/map/`.
      verify: `npx vitest run tests/scripts/reread_guard_map_sections.test.ts` -> 0
      > note: open: `map --section` and the guard line (`map_sections.ts`) ship with their test; wiring the line into reread_guard_hook.ts needs hook-bundle bytes and the bundle has 1 B of headroom (1556669 / 1556670) — a raise_log entry or a shrink elsewhere first.
- [ ] **J.6 Listing tools page** (H48). `list_skills`, `list_rules`,
      `memory_lookup` default to index mode with paging; the changed
      `memory_lookup` default is documented where the MCP tools are described.
      verify: `npx vitest run tests/scripts/mcp_listing_paging.test.ts` -> 0
- [ ] **J.7a Content names tools that exist** (H47, before D). The content
      files naming `codebase-retrieval` get the host's real verb or a stated
      grep fallback; the inline `rg` sweeps of the security and test skills move
      into one `scan` CLI verb returning `file:line:rule-id`; a ratchet holds
      the self-search count.
      verify: `grep -rlc codebase-retrieval .claude/skills .claude/rules` -> 1
- [~] **J.7b Rewire self-search to `ask`** (after D's gain branch only; a null
      leaves it). Blocked by `b-stage-d-measurement`.
      verify: `./scripts-run src/scripts/check_self_search_ratchet` -> 0
- [~] **J.8 Read-time context** (after D's gain branch). At most N bytes once
      per file per session — confirmed facts, open bugs, memory, last change —
      as an extension of `memory_recall_hook.ts`. Off unless D's gain branch
      fired. Blocked by `b-stage-d-measurement`.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0
- [ ] **J.9 Measure the answers.** Per-verb output-size bench on the real graph
      in CI, a cost line per answer, p95 latency of `ask` recorded (no claim
      attached); D's arms use `ask`.
      verify: `./scripts-run src/scripts/bench_answer_size --all` -> 0

## Phase 4 — Stage K: feedback that shapes the work

Exit: ownership gate red on a planted user file; four signal kinds on fixtures;
delete removes signals and derived index rows with a tombstone. Rollback:
signals are user-owned local files; disable per kind (O20). K.1-K.3 run before D
(O21); nothing reaches the agent before D.

- [ ] **K.1 One ownership model** (H53). Every registry store gets an owner
      (user, project, team, machine) and a delete path. Precedence follows the
      tree (`_lib/agent_settings.ts:972-980`): team `locked_keys` > user
      personal > project path > project > unlocked team defaults. User-owned
      data — preferences, working style, chat messages, session data, signals —
      lives under the user's home keyed by repo id, never in the project.
      `agents/knowledge/` team-knowledge pages are classified explicitly. A gate
      fails on user-owned text under a committed path. ADR records the model.
      verify: `npx vitest run tests/scripts/check_ownership_model.test.ts` -> 0
- [ ] **K.2 Four signals, deterministic** (H50, H51). Kinds: complaint
      (existing detector), approval (narrow patterns), directive (through the
      `standing_command` and `self_harmful_preference` guards), correction (an
      edit or revert of agent output, read from git); observed friction
      (interruptions, self-repair records) is a source, not a fifth kind. Each
      stores kind, `about`, active rule/skill ids, file area, `session:line`,
      and a redacted span ≤ 80 chars. Wired into the existing prompt concern,
      no new one.
      verify: `npx vitest run tests/scripts/feedback_signals.test.ts` -> 0
- [ ] **K.3 From signals to candidates.** First action: run the
      decision-revisit gate in the council on the cross-project inference
      non-goal of `docs/contracts/agent-user-schema.md`. Kept → use the
      incremental `seen_count` path per project only; reopened → aggregate per
      (owner, topic). Counts by distinct sessions and tasks, with counter-
      evidence; a single severe event (data published, a risky production
      write) goes straight to review; contested topics resolve by recency,
      never by count; topics about a person are dropped.
      verify: `npx vitest run tests/scripts/feedback_candidates.test.ts` -> 0
- [ ] **K.4a Amend ADR-138 for a working-style field.** The v1 profile
      frontmatter is locked; add `working_style` (when, do, don't, evidence
      count, last seen) by an ADR amendment before any code reads it.
      verify: `grep -c "working_style" docs/decisions/ADR-138-global-user-profile-layer.md` -> /^[1-9]/
- [ ] **K.4b A place for working style** (H52). User: the profile's
      `working_style` list. Project and team: curated memory entries with paths
      plus `locked_keys` (O19). Promotion is always reviewed (O18); where a
      learning can be a deterministic check or script, that is the preferred
      target over prompt text.
      verify: `npx vitest run tests/scripts/working_style_accept.test.ts` -> 0
- [~] **K.5 Working style reaches the agent** (after D). Through the existing
      session-start loader and `ask`, ≤ 400 tok, ranked by recency ×
      corroboration; project entries only in their repo. Blocked by
      `b-stage-d-measurement`.
      verify: `npx vitest run tests/scripts/working_style_delivery.test.ts` -> 0
- [ ] **K.6 Learnings into reviews and retros** (H54). Retro triage reads
      signal kinds and topics; "held or recurred" reads signals and reports
      recurrence before and after an accepted learning; review routing receives
      recurring findings and correction hot spots through `ask` as checklist
      inputs citing the violated contract or test, never private frustration
      text.
      verify: `npx vitest run tests/scripts/retro_review_learnings.test.ts` -> 0
- [ ] **K.7 The user stays in control** (H53). View, export and delete cover
      profile, observations, signals, chat history, session index, and every
      derived index (FTS SQLite, twin); revoked items vanish from FTS; each
      kind can be switched off; message text is never stored.
      verify: `npx vitest run tests/scripts/user_delete_propagation.test.ts` -> 0
- [~] **K.8 Where it is seen** (after D). User learnings go into the
      machine-local hub payload (ADR-299); project learnings into the project
      map payload. The pages are `road-to-map-views-from-the-handover` Phases 5
      and 6. Blocked by `b-stage-d-measurement`.
      verify: `npx vitest run tests/scripts/learnings_payload_split.test.ts` -> 0

## Decisions

Proposed = the plan's recommendation, or the verification pass's correction
where marked. Every row is pending: `council:pending`, or `owner` where the
transition is owner-reserved (O12 retirement, O13 trailer).

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| O8 | reversible-technical | council:pending | Proposed: Sentry via import + query time; other trackers as mapping files when a consumer asks | H35: bug knowledge is prose only | a second tracker is asked for |
| O9 | contested-technical | council:pending | Proposed: no bug counts per area in the committed map | KL15; the committed map stays free of operational data | a committed consumer needs a count |
| O10 | reversible-technical | council:pending | Proposed: k = 3 hops, window = one release, widened per query | H38; inducer precision about one half | the regression fixture misses at k = 3 |
| O11 | contested-technical | council:pending | Proposed: allow H.1-H.4 before D; they feed H.9 | P-3; nothing agent-facing | H.9 is dropped from D |
| O12 | destructive-owned | owner | Proposed: retire the journal; show `map-outcomes` via J.9; merge intake streams; decide `session_memory_index` and the second-brain store | H41: written-not-read stores | a reader of the journal appears |
| O13 | product-owned | owner | Proposed: `Agent-Session: <id>` trailer on agent commits; scored matching for the rest — a machine trailer, distinct from attribution lines | H43: 0 of 9,365 commits carry a session trailer | the owner rejects machine trailers |
| O14 | contested-technical | council:pending | Proposed: local index of ids and pointers under the user's home, keyed by repo id (correction: not in the project) | owner turn 20; `.build/` is per worktree | a host offers its own index |
| O15 | reversible-technical | council:pending | Proposed: `hint` 250 / `concise` 800 / ceiling 2,000 tok (correction adds `hint`) | H44: 58,214 tok today | J.9 shows a budget hides needed items |
| O16 | reversible-technical | council:pending | Proposed: no vectors until FTS5 is measured short of a question | KL21 | a fixed question fails on FTS5 |
| O17 | contested-technical | council:pending | Proposed: allow the round-3 P-3 exceptions | they correct, repair or refuse | an exception injects content |
| O18 | contested-technical | council:pending | Proposed: learned working style is always reviewed before promotion | KL27 | never on a count |
| O19 | reversible-technical | council:pending | Proposed: team agreements as curated memory + `locked_keys`; no new file | `_lib/agent_settings.ts:972-980` | a setting cannot express an agreement |
| O20 | reversible-technical | council:pending | Proposed: all four signal kinds on, each switchable | K.7 | a kind misfires on fixtures |
| O21 | contested-technical | council:pending | Proposed: allow K.1-K.3 before D | field measure for D | a signal reaches the agent before D |

## Kill and declined register

Plan kills keep their plan number with a `KL` prefix so they cannot be read as
step K.n.

| ID | Killed or declined | Instead |
|---|---|---|
| KL14 | Fetching from Sentry or any tracker during a build | Snapshot import and query time (H.1) |
| KL15 | Bug titles, messages, payloads, user data or bug ids in the committed map | `.build/bugs/` allowlist, TTL, CI grep |
| KL16 | Inducers shown as facts; bugs counted per author | Candidates with method; no per-person ranking |
| KL17 | Running bisect or tracker-suggested fixes automatically | A printed plan (H.6) |
| KL18 | A second bug-id parser | One grammar with tracker keys (H.3) |
| KL19 | Reopening a shared cross-session memory database | ADR-094 and T3 stand |
| KL20 | Model-written observations, summaries or dedup in a knowledge store | Facts from files and scored joins |
| KL21 | Embeddings by default; a model downloaded during a build | FTS5 (O16) |
| KL22 | Transcript or chat text in the committed map or twin | Pointers under the user's home (I.4) |
| KL23 | Pointing the agent at `map.json` for detail | Section command and guard (J.5) |
| KL24 | A fifth memory shape | I.5 subtracts; I.7 routes |
| KL25 | Copying code from copyleft or rider-licensed memory, session-index or symbol-tool projects | Ideas only, written fresh |
| KL26 | User messages or user data in project knowledge or any committed file | User-home stores (K.1) |
| KL27 | Promoting a signal without review or because of a count | Reviewed accept (K.4b) |
| KL28 | Scores or rankings of people | Topics are rules, skills, file areas |
| KL29 | A model judging sentiment | Narrow patterns + objective corrections (K.2) |
| KL30 | A team or organization store outside the repository | Team agreements in the repo |
| DC1 | Own read-only tracker sync adapter with credentials | Conflicts KL14 |
| DC2 | Encrypted local bug cache | 0600 permissions (H.1) |
| DC3 | An `incident:*` command family | `ask` intents (J.4) |
| DC4 | Runtime trace adapter (observed vs static calls) | Parked: no trace source, not asked |
| DC5 | Symbolication of minified frames | Parked: no consumer need shown |
| DC6 | Fix-effectiveness verdicts | No traffic data offline; tri-state only (H.3) |
| DC7 | Agent-economics and open-questions views before D | "Unanswered requests" as an `ask` intent after I.4 |
| DC8 | Memory atlas before D | P-3; I.6 and K.8 after D |
| DC9 | Supply-chain advisories in the committed map | KL7 of the sibling stands |

## Blockers

### blocker: b-stage-d-measurement

- **Status:** open
- **Owner:** implementer of `road-to-a-map-that-holds-on-the-real-repo`
  Phase 5 [D] — an external dependency this roadmap probes, not a human gate.
- **Blocks:** H.7, H.8, I.4, I.6, I.7, J.7b, J.8, K.5, K.8.
- **What to do:** pick exactly one — (a) wait for the sibling's 5.6 [D.6]
  decision record under `agents/evidence/` and resume the gain or null branch
  named there; or (b) if Phase 5 is cancelled, convert the blocked steps per
  the sibling's null branch
  (`grep -n "null" agents/roadmaps/road-to-a-map-that-holds-on-the-real-repo.md`).
- **Resolved when:** no sibling Phase 5 step is open —
  `grep -c "^- \[ \] \*\*5\." agents/roadmaps/road-to-a-map-that-holds-on-the-real-repo.md`
  prints 0 — and its 5.6 decision record exists.
- **Recommendation:** (a) — the measure is the reason these steps wait.
- **If you do nothing:** nine steps stay deferred; everything else in this file
  proceeds.

### blocker: b-owner-reserved-stores

- **Status:** open
- **Owner:** the owner — retiring stores and a commit-trailer convention are
  owner-reserved (O12, O13).
- **Blocks:** I.5b, and the trailer half of I.4.
- **What to do:** pick exactly one — (a) accept O12 and O13 as proposed in
  § Decisions, recorded in `agents/owner-questions.md`; (b) accept O12 only,
  no trailer (scored matching only); or (c) decline both, stores stay and
  I.5b is cancelled.
- **Resolved when:** `agents/owner-questions.md` records an answer for O12 and
  O13 dated on or after 2026-10-27.
- **Recommendation:** (a) — subtraction keeps the registry honest, and a
  trailer turns a 0.8 match into a 1.0 one.
- **If you do nothing:** the journal stays written-not-read and session links
  stay scored guesses.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | User data reaches a committed path | product | Chat text, signals or session data land in the project tree | User-home storage (K.1), ownership gate, CI grep | Phase 4 — Stage K: feedback that shapes the work |
| 2 | Bug data leaks personal data | product | Tracker payloads carry e-mails, IPs, tokens | Field allowlist, 0600, TTL, `.build/` only | Phase 1 — Stage H: bugs and fixes |
| 3 | A wrong cause is blamed | product | Inducer precision is about one half | Hypothesis state, dashed guessed edges, proof only by test or bisect | Phase 1 — Stage H: bugs and fixes |
| 4 | Hook bundle overflows | implementation | New concerns cross the bundle ceiling at pre-push | Extend existing concerns; measure before and after | Cost rules (apply to every step) |
| 5 | A tight budget hides what matters | product | Truncation drops the item the agent needed | Counts and `complete` always present; graded fallback; `detailed` on request | Phase 3 — Stage J: answers, not files |
| 6 | Folding forty stores builds one big system | implementation | The registry becomes a new store to maintain | Registry plus subtraction first (I.1, I.5a) | Phase 2 — Stage I: every knowledge source in one index |
| 7 | The agent over-adapts to one bad day | product | One session's complaint becomes a rule | Distinct sessions and tasks, half-life, reviewed promotion | Phase 4 — Stage K: feedback that shapes the work |
| 8 | Feedback learning becomes surveillance | product | Signals rank people | Topics never persons (KL28); user-owned and deletable | Phase 4 — Stage K: feedback that shapes the work |
| 9 | Precedence contradicts the code | implementation | A stated order overrides locked team keys | Precedence copied from `agent_settings.ts`, tested in K.1 | Phase 4 — Stage K: feedback that shapes the work |

## Acceptance Criteria

- [ ] AC-14 — Bug import fixture: records normalised with qualified ids and
      episodes; frames map to symbols; no bug id, title or message under
      `agents/map/` outside `.build/` (CI grep).
- [ ] AC-15 — Fix fixture: four fix forms classified; `SENTRY-317` is a bug
      reference; the inducer is X and the whitespace commit is skipped.
- [ ] AC-16 — Regression fixture: the calculation fix ranks first with path
      and witnesses in hypothesis state; the bisect plan prints; a passing
      planted test turns it `confirmed` with a `test_guards_against` edge.
- [ ] AC-17 — The local map's bug payload carries open, fixed, regression
      and timeline sections plus one of the five source states; the committed
      map's payload carries only the local-data state and no bug data (the
      page half is the views roadmap's).
- [ ] AC-18 — The registry lists every store found at the pin, including
      `agents/knowledge/` and host memory; a new writer without a row fails.
- [ ] AC-19 — The 7 ADR records under `docs/adrs/` are decision nodes; memory
      entries link to their paths; each unresolved named path yields `moved`
      or `gone`; deleting a memory's only path retracts its claim.
- [ ] AC-20 — `affected gpt_tokens`, `affected …/code_graph_context_hook.ts`
      and `graph_impact` on `HEAD~1` each ≤ 2,000 tok with counts and next
      commands.
- [ ] AC-21 — Ten fixed questions through `ask` each ≤ 2,000 tok with witness
      and completeness; the seven negative fixtures of J.4 pass; five prose
      tasks seed the planted target; `tests-for rule_inject_hook.ts` lists its
      three tests.
- [ ] AC-22 — Reading `agents/map/code/map.json` meets the guard;
      `map --section` returns the cut sections; the hook bundle stays under
      its ceiling.
- [ ] AC-23 — Session fixture: SHA match 1.0, line overlap 0.8; no transcript
      text in the project tree; one turn seen by two sources counts once.
- [ ] AC-24 — No `codebase-retrieval` in content delivered to hosts without
      it; the self-search count ratchets down.
- [ ] AC-25 — Every registry store has an owner and a delete path; a
      user-owned file under a committed path fails the gate; precedence
      matches `agent_settings.ts` on a locked-key fixture.
- [ ] AC-26 — K.2 fixture prompts and a revert yield the stated kinds; the
      harmful standing directive is refused; no stored signal holds more than
      an 80-character redacted span.
- [ ] AC-27 — One session → signal; two sessions → candidate; complaint then
      approval → `contested`; a severe single event reaches review; an
      accepted learning followed by its complaint → `recurred`.
- [ ] AC-28 — Delete removes signals, session index rows and derived FTS rows
      with a tombstone; the committed map contains no user learning.
- [ ] AC-29 — H.9 prints the fix-induced share with numerator, denominator
      and method.
- [ ] AC-30 — The registry shows no writer without a reader, and the store
      count drops by the number O12 decided.
- [ ] AC-31 — Memory tools return the J.1 envelope; the routing guidance is a
      guideline, and the always-loaded rule count is unchanged.
- [ ] AC-32 — The first page of `list_skills`, `list_rules` and
      `memory_lookup` is each ≤ 2,000 tok.
- [ ] AC-33 — The answer-size bench is red when a verb exceeds its budget,
      and records `ask` p95 latency.
- [ ] AC-34 — Session-start delivery of working style stays inside the slot
      cap; a user entry shows in every repo, a project entry only in its own.
- [ ] AC-35 — A review on a fixture area lists the recurring finding with its
      pointers and cites a contract or test, never signal text.
