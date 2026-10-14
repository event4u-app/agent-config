---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-q reproduced at 9a943f30c that 40 relative links inside delivered references/*.md and one skill-relative link in existing-ui-audit resolve to nothing while check_references and lint_skill_link_reach both report clean, and that no skill can have its procedure handed out one step at a time because the only enforced step runner iterates a fixed eight-step constant. No active roadmap owns either: a grep over agents/roadmaps/{*,later,stubs} for procedure.yaml, work --procedure and skill-relative returns nothing, later/road-to-guided-journeys owns the flow level that ADR-055 keeps a suggestion list, and road-to-skill-scripts-that-run-where-they-land owns script placeholders, not link depth. Archiving or parking costs more because Phase 1 is a shipped dead-link defect; merging into the flow-level plan would tie a skill-internal change to the schema-v2 event ADR-055 reserves."
relates:
  - slug: road-to-skills-that-arrive-when-called
    relation: extends
    note: "Active. Owns the compaction tail of a skill body (its step 3.4), the context-key rename (1.1) and the fork pilot (Phase 3). This file measures only its three pilot heads against that tail and plans none of those steps again; a forked step waits for its 1.1."
  - slug: road-to-a-retro-the-merge-runs
    relation: extends
    note: "Active. Its retro-v1 target vocabulary is closed. Handoff H1 offers one target value for skills that carry a procedure sidecar; nothing here edits that contract."
  - slug: road-to-what-was-built-and-never-ran
    relation: disjoint
    note: "Active. Its Phase 4 withdraws the run-continuation stop gate. This file builds on no stop gate and imports nothing from that hook file, so the withdrawal and this work cannot collide."
  - slug: later/road-to-guided-journeys
    relation: disjoint
    note: "Parked. Its plan A1 names the same engine for the flow level. That level stays parked here: ADR-055 keeps flows a curated command list, and widening them is a schema-v2 event this file does not open. Handoff H3 records the arrival."
---
# Road to steps the skill cannot skip

> **Source:** `agents/tmp.old/inbox-2026-10-q/` — one transcript of four owner
> turns, four supplied plans (two of them consolidations of the same five
> parents) and four parallel analyses, all pinned to `main@9a943f30c`. Verified
> against `main@9a943f30c` on 2026-10-14; every reproduction below ran there.

## Goal

A skill whose procedure has grown past what an agent follows reliably can be
split into step files without losing a line, and an engine that already exists
can hand those steps out one at a time, refusing step n+1 until step n has a
typed exit — so a skipped step is a recorded state rather than an unnoticed
omission. Done means: every relative link in a delivered skill and its
`references/` files resolves or is named by a gate; one written canon says what a
reference, a co-requirement and a procedure each are; three pilot skills carry a
procedure sidecar with a passing conservation test; `agent-config work
--procedure <skill>` hands out steps with a resumable, revalidated state; and a
pre-registered three-arm measurement has decided whether the cursor adds
anything the split alone does not — with an honest null as a first-class
outcome. Nothing becomes a default before that measurement.

The mechanism comes from the source's own account: a skill grown by per-run
retros is split into step files, a script holds the order and loads a step only
when it is due, and a learning lands in the step that failed.
<!-- harvest:script-enforced-skill-step-order -->

## Prerequisites

- None to start Phase 1–2; they are fix-sized and independent.
- Phase 5 reads `.work-state.json` through the existing reader
  (`src/agent-src/templates/scripts/work_engine/state.ts`); nothing upstream has
  to land first.

## Context — read at `main@9a943f30c`

- **The order of a skill's procedure is held by nothing but prose.** The only
  enforced step runner is the `/work` engine: `STEP_ORDER` is a fixed constant
  of eight names (`work_engine/dispatcher.ts:63-78`), `dispatch` iterates it
  (`:138`), and the file says changing that order is a roadmap-level decision
  (`:64-67`). Input kinds are closed to `ticket`, `prompt`, `diff`, `file`
  (`work_engine/state.ts:161-166`). Flows carry an ordered `default_path` that
  no command or skill reads (`grep -rn default_path src/domains src/skills` → 0),
  and ADR-055 keeps them a suggested list
  (`docs/decisions/ADR-055-flow-layer-data-model.md:57-59`, `:71`). The
  `/orchestrate` runtime is a stub whose descriptors "the agent dispatches one at
  a time" (`work_engine/orchestration.ts:1-12`). 60 of 205 commands list two or
  more skills in `skills:`, their order stated only in prose.
- **Skills grow toward the cap and the cap counts the wrong unit.** 14 skills
  sit at 380–400 lines under `MAX_HEAD_LINES = 400`
  (`src/scripts/lint_skill_router_head.ts:50`); `git-workflow` is 20,714 bytes
  against 7,421 at its first commit (`668ed88eb`). Commit `876b04557` cut
  `existing-ui-audit` from 435 to 398 lines (−8.5 %) but from 25,857 to 24,995
  bytes (−3.3 %).
- **The authoring canon contradicts itself.** `src/skills/skill-writing/SKILL.md:104`
  says "Strongly consider split above 1500 words"; `:126-129` says "a skill at
  1,500 words is ordinary, and moving prose out of the body to hit a number makes
  it worse"; `:121-122` says a body that is a map to its own content "is loaded
  and not applied". 79 skills exceed 1,500 words (`wc -w`).
- **A split body still owes five sections.** `REQUIRED_SKILL_SECTIONS` is
  `When to use`, `Gotcha`, `Procedure`, `Output format`, `Do NOT`
  (`src/scripts/skill_linter.ts:98`). Commit `b3cc0ada6` moved `Output format`
  and `Gotcha` of `existing-ui-audit` back in-body for exactly this reason and
  deleted `references/output-and-pitfalls.md` — but left the link to it at
  `src/skills/existing-ui-audit/SKILL.md:350`.
- **Links inside `references/` are checked by nothing.** `check_references`
  matches path-shaped strings only (`src/scripts/check_references.ts:160-161`)
  and reports "No broken references found"; `lint_skill_link_reach` reads only
  `SKILL.md` and only `](../<slug>/SKILL.md` (`src/scripts/lint_skill_link_reach.ts:21`,
  `:89`). Resolving every relative link of the delivered
  `dist/agent-src/skills/*/references/*.md` against its own file finds **40
  unresolved**: 28 are one `../` short (the file moved into `references/` and its
  links did not follow), 6 point into `docs/` which is not delivered, 2 are
  illustrative `<parent-slug>` placeholders, 1 is a regular expression the probe
  read as a link, and 3 are other path errors. Two reference links cross a pack
  boundary with no `requires_skills`: `design-review` (pack `engineering-base`) →
  `wireframe/references/story-beat-ledger.schema.json` (pack `frontend-design`)
  at `src/skills/design-review/references/verification-automation.md:45`, and
  `design-intelligence` (`frontend-design`) → `fe-design/references/design-patterns.md`
  (`engineering-base`) at `src/skills/design-intelligence/references/context-and-registers.md:91`.
- **25 of 25 reference files over 100 lines open without a table of contents**
  in their first 30 lines (44 reference markdown files in 17 skills).
- **Pieces a cursor needs already exist.** `verify_clause.ts` parses a `verify:`
  line but no code executes one (`check_verify_expectation_delta.ts:140` spawns
  only `git`); `handoff-context` already injects on the `compact` source
  (`src/scripts/handoff_context_hook.ts:377`) and is bound on `session_start`
  (`src/scripts/hook_manifest.yaml:1570`); `.work-state.json` carries no HEAD or
  content hash, so a resumed `SUCCESS` stays `SUCCESS` after its input changed
  (`work_engine/state_io.ts`, no `head`/`sha`/`hash` field).
- **Locks this file is shaped by.** The skill-DAG lock rejects per-skill metadata
  that chains skills to each other
  (`agents/roadmaps/archive/road-to-capability-discoverability.md:146-156`);
  ADR-263 makes skills explicitly invoked reference material (`:86-90`);
  `skill_count` and `concern_count` have a zero allowance
  (`src/config/estate-count-budget.json`, the `allowances` block); ADR-041 needs
  an ADR for a new verb; ADR-124 keeps an engine default-off until a
  pre-registered benchmark. 106 of 110 skill obligation lines need judgement to
  test (`src/scripts/report_skill_obligation_violations.ts:10-21`), and skill
  invocations are unmeasured (`agents/evidence/metrics/skill-activation-census.json`,
  `invocations: 0`).

## Phase 1 — Links the gate can see

A split multiplies links. The gate that checks them comes first.

- [ ] **1.1 Resolve every relative link against its own file, test first.**
      Write the fixture before the change — a delivered skill whose
      `references/a.md` links `../b/SKILL.md` (one `../` short) and whose
      `SKILL.md` links `references/missing.md` — and record in the PR that
      today's gate passes it. Then `lint_skill_link_reach` reads `SKILL.md`
      **and** `references/*.md` of each delivered skill and resolves every
      relative markdown link against the file's own directory. Links into
      `docs/` are reported as their own class (not delivered —
      `measure_docs_dead_links` owns that question) and do not fail; a link in a
      fenced block or an angle-bracket placeholder is not a link.
      verify: `npx vitest run tests/scripts/lint_skill_link_reach.test.ts -t reference-depth --reporter=verbose` -> /✓.*reference-depth/
- [ ] **1.2 Repair the 28 short links and the three path errors.** Mechanical:
      add the missing `../`; fix the three named errors. Re-derive the list with
      the gate rather than copying this file's count — the tree moves.
      verify: `./scripts-run src/scripts/lint_skill_link_reach` -> 0
- [ ] **1.3 Remove the stale link in `existing-ui-audit`.**
      *corrected-from-reproduction:* the supplied plans move `Output format` and
      `Gotcha` out to `references/output-and-pitfalls.md`; both are required
      in-body sections (`skill_linter.ts:98`) and were moved back by
      `b3cc0ada6` for that reason. The defect is the leftover link at
      `SKILL.md:350`, so delete that line and keep both sections in the body.
      verify: `grep -c 'output-and-pitfalls' src/skills/existing-ui-audit/SKILL.md` -> /^0$/
- [ ] **1.4 A reference link into another pack declares it.** A link from one
      skill into another skill's `references/` across a pack boundary requires
      the target in `requires_skills`; the two cases in Context are resolved by
      the owner of each target file — add `requires_skills`, or move the shared
      file to where both packs ship it. `check_skill_requires` then holds the
      rest.
      verify: `./scripts-run src/scripts/check_skill_requires` -> 0
- [ ] **1.5 A table of contents is generated, not written.** A generator adds a
      heading index to every reference file over 100 lines and its `--check`
      mode is the drift check — zero author cost, warn-only.
      <!-- harvest:reference-file-table-of-contents -->
      verify: `./scripts-run src/scripts/generate_reference_toc --check` -> 0

## Phase 2 — One canon for size, split and order

- [ ] **2.1 Remove the contradiction.** `skill-writing/SKILL.md:104` and
      `:126-129` become one statement: split when material is genuinely
      consulted on demand or when a procedure needs to be handed out in order;
      never to hit a number. The `:121-122` sentence stays and gains its
      corollary: a split head keeps every heuristic that changes a write
      decision and all five required sections; only step execution moves.
      verify: `grep -c 'Strongly consider split above 1500 words' src/skills/skill-writing/SKILL.md` -> /^0$/
- [ ] **2.2 Four words, four meanings.** One section in `skill-writing` (no new
      document): a **reference** is context loaded on demand; `requires_skills`
      is co-availability; a **procedure** is the ordered steps of one skill with
      a sidecar; a **chain between skills** is not supported (skill-DAG lock,
      ADR-263). Prose such as "then invoke X" is a hint, not a chain link.
      verify: `grep -cE '^### .*(reference|procedure)' src/skills/skill-writing/SKILL.md` -> /^[1-9]/
- [ ] **2.3 Reference files stay one level deep.** The same section says a
      reference file links no sibling reference of its own skill; a ratchet in
      `lint_skill_link_reach` seeds at today's count and only shrinks.
      verify: `npx vitest run tests/scripts/lint_skill_link_reach.test.ts -t sibling-ratchet --reporter=verbose` -> /✓.*sibling-ratchet/

## Phase 3 — A procedure as data, with no runtime

- [ ] **3.1 The sidecar.** `src/skills/<skill>/procedure.yaml` beside `SKILL.md`
      (the skill schema stays `additionalProperties: false`):
      `schema_version`, `brief` (goal, inputs, done_when) and an ordered list of
      `steps`, each with `id`, `file` (under `references/steps/`) and `exit`.
      No field names another skill — a `skill:` key per step would be the chain
      the skill-DAG lock rejects.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t rejects-skill-field --reporter=verbose` -> /✓.*rejects-skill-field/
- [ ] **3.2 Typed exits, never a command string.** `exit` is exactly one of
      `exists: <path>`, `schema: <path>#<schema-id>`, `check: <id>` or
      `judgement`. A `check:` id names a deterministic, read-only, offline
      TypeScript function registered in `src/scripts/_lib/procedure_checks.ts`;
      a manifest can name only ids that exist there. No string from a manifest
      is ever executed.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t rejects-command-string-exit --reporter=verbose` -> /✓.*rejects-command-string-exit/
- [ ] **3.3 Skipping is a stated state.** An optional `when:` takes a predicate
      from a closed vocabulary; a step not taken is recorded as
      `skipped: <reason>`, never silently.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t unknown-when-predicate --reporter=verbose` -> /✓.*unknown-when-predicate/
- [ ] **3.4 The lint.** `lint_skill_procedures`: every `file` exists under
      `references/steps/` and is linked from the head; ids are unique; exit
      types are valid; `when:` predicates are known; no path escapes the skill
      directory. It also reports — never fails on — the share of steps whose exit
      is `judgement`.
      verify: `./scripts-run src/scripts/lint_skill_procedures` -> 0

## Phase 4 — Three pilots, split without losing a line

- [ ] **4.1 The pilots.** `existing-ui-audit` (steps 0–9, 398 lines),
      `design-review` (phases 0–7, 399 lines) and `memory-consolidation`
      (phases 1–4, 400 lines). Each gets a sidecar and `references/steps/`.
      verify: `ls src/skills/existing-ui-audit/procedure.yaml src/skills/design-review/procedure.yaml src/skills/memory-consolidation/procedure.yaml | wc -l` -> /^\s*3$/
- [ ] **4.2 Conservation is a test, not a judgement.** Every non-blank line of
      the old body appears verbatim in head ∪ step files; only heading levels and
      link lines may change. The `Procedure` section of the head becomes the
      step table with links and the cursor sentence; the other four required
      sections stay in the head.
      verify: `npx vitest run tests/skills/procedure_conservation.test.ts --reporter=verbose` -> /✓/
- [ ] **4.3 Ceilings follow the split.** `check_skill_body_budget --update`
      lowers the three head ceilings; step files get their own shrink-only
      ceilings in `src/config/skill-body-budget.json`.
      verify: `./scripts-run src/scripts/check_skill_body_budget` -> 0
- [ ] **4.4 Report the head against the compaction tail.** Record each pilot
      head's size against the tail `road-to-skills-that-arrive-when-called`
      step 3.4 measures; this file reports the three numbers and decides
      nothing about the tail.
      verify: `grep -cE '^\| (existing-ui-audit|design-review|memory-consolidation) \|' agents/evidence/analysis/procedure-pilot-heads.md` -> /^3$/

## Phase 5 — The cursor in the `/work` engine (default-off)

- [ ] **5.1 An order per input kind.** `dispatch()` takes an optional step
      order; the default stays `STEP_ORDER`, so every existing directive set and
      the resume contract are untouched. This is the roadmap-level decision
      `dispatcher.ts:64-67` asks for.
      verify: `npx vitest run tests/scripts/work_engine/dispatcher.test.ts --reporter=verbose` -> /✓/
- [ ] **5.2 `input.kind: procedure`.** Added to `KNOWN_INPUT_KINDS`; its
      directive set is built from the sidecar. One call checks the exit of step
      n and, on success, emits step n+1 with the brief (goal, "step k of n",
      `remaining`, `failed_approaches` — the capsule field names that already
      exist). A failed exit returns `PARTIAL` with the reason; `judgement`
      returns `PARTIAL` with the question.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t one-call-per-step --reporter=verbose` -> /✓.*one-call-per-step/
- [ ] **5.3 A resumed step is revalidated.** Each `SUCCESS` stores HEAD and the
      content hash of the step file and its exit inputs; on resume a mismatch
      marks the step `stale` and re-checks the exit only — the step is not run
      again.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t stale-after-input-change --reporter=verbose` -> /✓.*stale-after-input-change/
- [ ] **5.4 The position survives compaction without a new concern.**
      `handoff-context` already injects on `compact`; it adds one line read from
      `.work-state.json` on disk — `procedure <skill>@<commit> · step k of n
      (<id>) · last exit <ok|stale|partial>` — phrased as state, never as an
      instruction. No state file, no line.
      verify: `npx vitest run tests/scripts/handoff_context_hook.test.ts -t procedure-position-on-compact --reporter=verbose` -> /✓.*procedure-position-on-compact/
- [ ] **5.5 Entry is a flag, and the pilots' commands use it.** `agent-config
      work --procedure <skill>` (a flag on an existing verb, ADR-041). The
      commands that invoke the three pilots start the cursor themselves instead
      of only pointing at it, so entry is not prose again. Undocumented in the
      public command reference until Phase 6 decides (D3).
      verify: `npx vitest run tests/scripts/work_engine/cli.test.ts -t procedure-flag --reporter=verbose` -> /✓.*procedure-flag/
- [ ] **5.6 Bounds.** Linear, finite, no repeat mode, no background run, no
      subagent start, no stop gate, no hook other than 5.4's line, no shell
      string from data. A single-question read of one step file stays allowed
      without the cursor.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t bounds-no-shell-no-subagent --reporter=verbose` -> /✓.*bounds-no-shell-no-subagent/

## Phase 6 — Measure before anything becomes a default

The three-arm design and its decision rules are own analysis of the parallel
plans this round carried; no external source is cited for them.

- [ ] **6.1 Pre-register** under `agents/evidence/preregistration/`: arm A the
      monolith (pilot before Phase 4), arm B the split without the cursor (the
      agent follows the head's step table itself), arm C the split with the
      cursor; the corpus, metrics and rules below are frozen before the first
      run.
      verify: `ls agents/evidence/preregistration/ | grep -c procedure-cursor` -> /^1$/
- [ ] **6.2 Corpus.** Exactly ten tasks per pilot (30 in all) on which arm A
      demonstrably fails today — the same condition the skill-DAG lock sets for
      its own reopen, so both decisions speak one language. A fixed count, not a
      floor: the workload is the spend ceiling's input (D13).
      verify: `grep -cE '^- \*\*task-' agents/evidence/preregistration/procedure-cursor.md` -> /^30$/
- [ ] **6.3 Metrics.** Primary: exits met and task success. Secondary: API
      rounds against `src/config/turnaround-budget.json`, tokens, wall time,
      steps skipped without a reason (target 0 in arm C) and the cursor entry
      rate.
      verify: `grep -cE '^\| (exits_met|task_success|rounds|tokens|wall_time|unreasoned_skips|entry_rate) \|' agents/evidence/preregistration/procedure-cursor.md` -> /^7$/
- [ ] **6.4 Instrument.** The host's plugin-eval command with a baseline arm and
      a tool-order grader, three runs per case, under the evaluator-independence
      rule; the tasks invoke the skill explicitly, so the unmeasured activation
      rate does not confound the result. The pre-registration also freezes a
      pinned model and settings, the failure and retry handling (no unplanned
      reruns), a token maximum and a monetary maximum for the whole
      3 × 3 × 30 workload, and the aggregation rule with its confidence
      treatment, so a nominal 20 % is not read off three noisy runs. No run
      starts until the owner has authorised that stated monetary maximum (D13).
      verify: `grep -cE '^(runs_per_case: 3|model_pin:|retry_policy:|max_tokens:|max_cost_usd:|aggregation:)' agents/evidence/preregistration/procedure-cursor.md` -> /^6$/
- [ ] **6.5 Decide by the pre-registered rule.** B beats A by the bar and C ≈ B →
      ship the split, cursor stays opt-in. C beats B by the bar → the cursor
      default for procedure skills is put to the council with the result. Neither
      → honest null; a pilot split stays only where its head shrank.
      verify: `grep -cE 'verdict: (split|cursor|null)' agents/evidence/preregistration/procedure-cursor*.md` -> /^1$/

## Handoffs — found here, owned elsewhere

- **H1 → `road-to-a-retro-the-merge-runs`.** One target value `procedure-step`
  in retro-v1, only for skills with a sidecar: one delta line in the step file's
  `## Known pitfalls`, never the head, never a rewrite; the existing brakes (two
  origins, durability test, human promotion, caps) apply unchanged, and a
  learning that lifts a step past its ceiling becomes a proposal, not an edit.
  Offered after Phase 4 lands a step carrier.
- **H2 → `road-to-skills-that-arrive-when-called`.** A step whose output is a
  report may run forked (`context: fork`) once that file's 1.1 frees the key;
  Phase 4.4 hands it three head measurements.
- **H3 → `later/road-to-guided-journeys` (Arrivals line).** The flow-level
  conductor this round asked for again; held by its own "resume when the
  maintainer spends a slot" note and by ADR-055's schema-v2 condition.
- **H4 → `later/road-to-corpus-knowledge-skills` (Arrivals line).** Working
  through a 100-page instruction set step by step with a checklist is that
  file's subject.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | The skill-DAG lock does not cover the ordered steps inside one skill | The lock rejects per-skill metadata that auto-chains skills (`archive/road-to-capability-discoverability.md:146-156`); a sidecar names only files of its own skill and no other skill (3.1). Different mechanism, so the lock does not apply | a sidecar ever needs a field naming another skill |
| D2 | reversible-technical | evidence | The cursor is the `/work` engine with a new input kind, not a stop gate and not a new runner | The engine is the only enforced, resumable step runner (`dispatcher.ts:138`); the stop gate's carrier is being withdrawn (`road-to-what-was-built-and-never-ran.md` Phase 4); the rejected "work engine as an LLM agent-loop" (`archive/road-to-capability-discoverability.md:160-164`) is an autonomous control loop, which 5.6 excludes | Phase 5 regresses an existing `/work` test |
| D3 | reversible-technical | agent | `work --procedure` stays out of the public command reference until Phase 6 decides | ADR-118 bars new consumer loop surfaces; the flag is linear and finite, but documenting it is the consumer-surface act and waits for the measured verdict | Phase 6 returns `cursor` |
| D4 | reversible-technical | evidence | Exits are typed (`exists`, `schema`, `check:<id>`, `judgement`); `verify:` stays the roadmap grammar | No code executes a `verify:` line today (`check_verify_expectation_delta.ts:140` spawns only `git`); a manifest command string would be the package's first shell executed from skill data | a pilot step needs a check no registered function can express |
| D5 | reversible-technical | evidence | The compaction position rides `handoff-context`; no new concern | `concern_count` allowance is 0; `handoff-context` already fires on `compact` (`handoff_context_hook.ts:377`) | the line causes a resumed `SUCCESS` step to be executed again (F5) |
| D6 | reversible-technical | evidence | A new stem, not a waking of `later/road-to-guided-journeys` | That plan is the flow level; ADR-055:57-59 and :71 keep flows a suggestion list until a schema-v2 decision | the flow level is reopened under ADR-055 |
| D7 | reversible-technical | agent | Pilots: `existing-ui-audit`, `design-review`, `memory-consolidation` | All three sit at 398–400 lines with numbered phases or steps | a pilot's steps turn out to be > 50 % `judgement` (F3) |
| D8 | reversible-technical | agent | Bar for Phase 6: ≥ 20 % task success and added rounds ≤ step count | 20 % is the skill-DAG lock's own reopen figure; a step costs at least one round | the corpus is too small for 20 % to be distinguishable from noise |
| D13 | spend-exhaustion | council:inbox-2026-10-pqr-residue | Phase 6's spend is not authorised as first written; the full three-arm design stays, rewritten as a fixed 3 × 3 × 30 workload with pinned model, retry policy, token and monetary maxima and an aggregation rule, and is put to the owner for authorisation of that stated maximum before any run. Arms A+B alone are declined: they cannot isolate the cursor | AI council 2026-10-14, anthropic + openai, 2/2, $0.00, both (c) on the open-ended version, both reject (b); not owner-reserved for refusing (`agents/runtime/council/responses/inbox-2026-10-pqr-residue`, local) | a delegated spend threshold is recorded and the stated maximum falls under it |
| D9 | reversible-technical | evidence | The stale `existing-ui-audit` link is deleted, not "fixed" by moving sections out | `skill_linter.ts:98`; `b3cc0ada6` | the linter stops requiring `Output format` or `Gotcha` in the body |
| D10 | reversible-technical | evidence | The canon contradiction named in Context is this file's work, not an open question | Phase 2.1 replaces `skill-writing:104` and `:126-129` with one statement; the closure scan's `contradictory` hit is that finding | — |
| D11 | reversible-technical | evidence | Closure-scan `typed-op` hits on the word "merge" are slug text, not an operation | Both hits are the slug `road-to-a-retro-the-merge-runs`; this file merges nothing | — |
| D12 | reversible-technical | evidence | Verify lines naming a test this step writes stay as written | `closure_scan` lists them as `unfalsifiable-verify` because the named test does not exist yet; each step writes that test first, and the listing is non-blocking by design (`closure_scan.ts:41`) | a step lands without its named test |

## What this roadmap deliberately does not do

- **K1** Chain skills to each other through metadata, a `next:`/`chain:` key, or
  a router choice (skill-DAG lock; ADR-263; foreign hosts reject unknown keys).
- **K2** Enforce order with a stop gate — the host overrides a stop block after
  repeated blocks, interactive procedures need stops, and the existing gate is
  being withdrawn.
- **K3** Execute any command string taken from a skill file.
- **K4** Make steps their own `src/skills/` entries (`skill_count` allowance 0).
- **K5** Condense or rewrite content while splitting (4.2 is a conservation
  test).
- **K6** Migrate the other procedure-shaped skills before Phase 6 decides, or
  turn anything default-on before then (ADR-124).
- **K7** Add a verb (`chain`, `skill:run`) — ADR-041.
- **K8** A shared agent memory store, a note vault as executor, a long-document
  import pipeline, or local-model workers — knowledge is not order, and the
  long-document case belongs to H4.
- **K9** Adopt the source's claimed effect ("far fewer errors") — unmeasured;
  Phase 6 measures its own.
- **K10** A typed stage contract on `src/flows` (ADR-055) or a host workflow
  script as the primary path.
- **K11** A word-count axis on the router-head cap. The line axis is gamed
  (Context), but the per-skill byte ceiling already measures the content the
  line cap misses (`src/scripts/check_skill_body_budget.ts:2-15`), and a third
  number is a third thing to write toward — the failure 2.1 removes from the
  canon.
- **K12** A moderator/implementer arm in Phase 6. Arm B already isolates the
  split's own effect; a two-role arm measures delegation, which no defect here
  names.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The split makes a pilot less followed, not more | product | A head that keeps less than it should is loaded and not applied (`skill-writing:121-122`). | 2.1 keeps every write heuristic and all required sections in the head; arm B isolates the split's own effect; F1 stops the rollout. | Phase 6 — Measure before anything becomes a default |
| 2 | The cursor costs more rounds than it saves | product | Each step adds at least one round; the gain may not cover it. | One call per step (5.2); rounds are a pre-registered metric; D8's bar includes them. | Phase 5 — The cursor in the `/work` engine (default-off) |
| 3 | The compaction line re-runs a finished step | implementation | A position line read as an instruction executes a `SUCCESS` step again. | State phrasing, disk-only source, provenance in the line; F5 removes the line on any occurrence. | Phase 5 — The cursor in the `/work` engine (default-off) |
| 4 | Widening the link gate reds unrelated skills | implementation | 1.1 surfaces 40 unresolved links at once. | 1.2 repairs them in the same change; `docs/` links are a reported class, not a failure. | Phase 1 — Links the gate can see |
| 5 | The measurement is spend-bearing | product | Three arms × three runs × ≥ 30 tasks cost model calls. | Pre-registration fixes the size before the first run; the run is the operator's call and is not started by this roadmap's authoring. | Phase 6 — Measure before anything becomes a default |
| 6 | A new lint and a new test file trip size and gate ratchets | implementation | New gates are counted by coverage ratchets. | Register each gate with its scanned count and self-test in the change that adds it. | Phase 3 — A procedure as data, with no runtime |

## Acceptance Criteria

- [ ] **AC-1** Every relative link in a delivered `SKILL.md` or
      `references/*.md` resolves, or is reported by a gate as a named
      non-delivered class; a link one `../` short fails CI.
- [ ] **AC-2** The order of a pilot's procedure is held by code: with the
      cursor, step n+1 is not emitted until step n's exit is met, recorded
      `judgement`, or recorded `skipped: <reason>`.
- [ ] **AC-3** Every non-blank line of each pilot's pre-split body is present
      in its head or step files, and each head still carries the five required
      sections.
- [ ] **AC-4** A resumed procedure whose step file or exit inputs changed marks
      that step `stale` and re-checks its exit instead of trusting `SUCCESS`.
- [ ] **AC-5** Every existing `/work` test passes unchanged, and no existing
      input kind changes behaviour.
- [ ] **AC-6** No string from a skill file is executed by the cursor or the
      lint.
- [ ] **AC-7** A pre-registered three-arm result is published, the verdict
      follows the frozen rule, and nothing is default-on before it — an honest
      null included.
- [ ] **AC-8** `skill_count` and `concern_count` are unchanged by this roadmap.

## Notes — how this file was derived

The owner's turns asked for an analysis of the current state, three challenge
loops, and a final plan; the governing sentence is the source author's reply
that a chain starts where the agent must run steps in a fixed order (AC-2).
Five parallel plans were consolidated twice, into two competing masters; this
file takes the skill-internal half of both and was verified line by line at the
pin. Changes against the supplied plans, each found by reproduction:

- **Never-true in a parent:** the dead reference "never existed in git history"
  — it was added in `709f0105a` and deleted in `b3cc0ada6`, both 2026-08-04.
- **Corrected from reproduction:** the parents' fix for that link would have
  removed two linter-required sections (1.3, D9).
- **Larger than claimed:** the gate's blindness covers 40 links in delivered
  reference files, not one (Context).
- **Declined by an accepted ADR:** journeys over flows (ADR-055, K10, D6).
- **Path corrected:** the dispatcher tests live in `tests/scripts/work_engine/`.
- **Taken from the parallel analyses:** typed exits instead of shell strings,
  resume revalidation, the small-task bypass (5.6), the split-only arm.
- **Taken from the consolidation neither master listed as a parent:** the
  conservation of required sections and the non-regression of `/work` (AC-5);
  its four-arm design, step-state machine and side-effect journal are declined —
  the pilots have no external effects, and arm B already isolates the split.
