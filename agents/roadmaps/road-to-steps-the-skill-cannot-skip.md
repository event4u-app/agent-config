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

- [x] **1.1 Resolve every relative link against its own file, test first.**
      Write the fixture before the change — a delivered skill whose
      `references/a.md` links `../b/SKILL.md` (one `../` short) and whose
      `SKILL.md` links `references/missing.md` — and record in the PR that
      today's gate passes it. Then `lint_skill_link_reach` reads `SKILL.md`
      **and** `references/*.md` of each delivered skill and resolves every
      relative markdown link against the file's own directory. Links into
      `docs/` are reported as their own class (not delivered —
      `measure_docs_dead_links` owns that question) and do not fail; a link in a
      fenced block or an angle-bracket placeholder is not a link.
      *Done 2026-10-16:* the fixture ran red against the old gate (exit 0);
      33 unresolved links surfaced on `origin/main`.
      verify: `npx vitest run tests/scripts/lint_skill_link_reach.test.ts -t reference-depth --reporter=verbose` -> /✓.*reference-depth/
- [x] **1.2 Repair the 28 short links and the three path errors.** Mechanical:
      add the missing `../`; fix the three named errors. Re-derive the list with
      the gate rather than copying this file's count — the tree moves.
      *Done 2026-10-16:* 29 short links; the path errors were two template
      paths and one link to an undelivered script.
      verify: `./scripts-run src/scripts/lint_skill_link_reach` -> 0
- [x] **1.3 Remove the stale link in `existing-ui-audit`.**
      *corrected-from-reproduction:* the supplied plans move `Output format` and
      `Gotcha` out to `references/output-and-pitfalls.md`; both are required
      in-body sections (`skill_linter.ts:98`) and were moved back by
      `b3cc0ada6` for that reason. The defect is the leftover link at
      `SKILL.md:350`, so delete that line and keep both sections in the body.
      *Done 2026-10-16.*
      verify: `grep -c 'output-and-pitfalls' src/skills/existing-ui-audit/SKILL.md` -> /^0$/
- [x] **1.4 A reference link into another pack declares it.** A link from one
      skill into another skill's `references/` across a pack boundary requires
      the target in `requires_skills`; the two cases in Context are resolved by
      the owner of each target file — add `requires_skills`, or move the shared
      file to where both packs ship it. `check_skill_requires` then holds the
      rest.
      *Done 2026-10-17:* `check_skill_requires` now collects every link into
      another skill's `references/` (from `SKILL.md` and `references/*.md`) and
      fails one whose target pack the linking pack does not reach unless it is
      a declared edge. `design-intelligence` → `fe-design` needs no edge:
      `frontend-design` requires `engineering-base`. `design-review` →
      `wireframe` could not take an edge (`engineering-base` does not reach
      `frontend-design`), so the ledger schema — linked from nothing inside
      `wireframe` — moved to `design-review/references/`, shipped by both packs.
      verify: `./scripts-run src/scripts/check_skill_requires` -> 0
- [x] **1.5 A table of contents is generated, not written.** A generator adds a
      heading index to every reference file over 100 lines and its `--check`
      mode is the drift check — zero author cost, warn-only.
      *Done 2026-10-17:* `task sync` runs the generator first; 22 of 45
      reference files got an index (three more over 100 lines carry fewer than
      two `##` headings and need none).
      <!-- harvest:reference-file-table-of-contents -->
      verify: `./scripts-run src/scripts/generate_reference_toc --check` -> 0

## Phase 2 — One canon for size, split and order

- [x] **2.1 Remove the contradiction.** `skill-writing/SKILL.md:104` and
      `:126-129` become one statement: split when material is genuinely
      consulted on demand or when a procedure needs to be handed out in order;
      never to hit a number. The `:121-122` sentence stays and gains its
      corollary: a split head keeps every heuristic that changes a write
      decision and all five required sections; only step execution moves.
      *Done 2026-10-16:* `skill-reviewer` Killer 5 repeated the trigger and
      now points at the one statement.
      verify: `grep -c 'Strongly consider split above 1500 words' src/skills/skill-writing/SKILL.md` -> /^0$/
- [x] **2.2 Four words, four meanings.** One section in `skill-writing` (no new
      document): a **reference** is context loaded on demand; `requires_skills`
      is co-availability; a **procedure** is the ordered steps of one skill with
      a sidecar; a **chain between skills** is not supported (skill-DAG lock,
      ADR-263). Prose such as "then invoke X" is a hint, not a chain link.
      *Done 2026-10-16:* section `Four words: reference, co-requirement,
      procedure, chain`.
      verify: `grep -cE '^### .*(reference|procedure)' src/skills/skill-writing/SKILL.md` -> /^[1-9]/
- [x] **2.3 Reference files stay one level deep.** The same section says a
      reference file links no sibling reference of its own skill; a ratchet in
      `lint_skill_link_reach` seeds at today's count and only shrinks.
      *Done 2026-10-16:* ceiling 7, pinned against the real tree by a test.
      verify: `npx vitest run tests/scripts/lint_skill_link_reach.test.ts -t sibling-ratchet --reporter=verbose` -> /✓.*sibling-ratchet/

## Phase 3 — A procedure as data, with no runtime

- [x] **3.1 The sidecar.** `src/skills/<skill>/procedure.yaml` beside `SKILL.md`
      (the skill schema stays `additionalProperties: false`):
      `schema_version`, `brief` (goal, inputs, done_when) and an ordered list of
      `steps`, each with `id`, `file` (under `references/steps/`) and `exit`.
      No field names another skill — a `skill:` key per step would be the chain
      the skill-DAG lock rejects.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t rejects-skill-field --reporter=verbose` -> /✓.*rejects-skill-field/
- [x] **3.2 Typed exits, never a command string.** `exit` is exactly one of
      `exists: <path>`, `schema: <path>#<schema-id>`, `check: <id>` or
      `judgement`. A `check:` id names a deterministic, read-only, offline
      TypeScript function registered in `src/scripts/_lib/procedure_checks.ts`;
      a manifest can name only ids that exist there. No string from a manifest
      is ever executed.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t rejects-command-string-exit --reporter=verbose` -> /✓.*rejects-command-string-exit/
- [x] **3.3 Skipping is a stated state.** An optional `when:` takes a predicate
      from a closed vocabulary; a step not taken is recorded as
      `skipped: <reason>`, never silently.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts -t unknown-when-predicate --reporter=verbose` -> /✓.*unknown-when-predicate/
- [x] **3.4 The lint.** `lint_skill_procedures`: every `file` exists under
      `references/steps/` and is linked from the head; ids are unique; exit
      types are valid; `when:` predicates are known; no path escapes the skill
      directory. It also reports — never fails on — the share of steps whose exit
      is `judgement`.
      *Done 2026-10-17:* `lint_skill_procedures` + `_lib/procedure_checks.ts`
      (registry starts empty; a check lands with the pilot step that needs it).
      `when:` vocabulary is `file-exists: <path>` and `file-absent: <path>`.
      Not yet a CI step: no sidecar exists before Phase 4, and registering a
      gate in `gate-coverage.yml` needs a ratification record — registration
      lands with the first sidecar.
      verify: `./scripts-run src/scripts/lint_skill_procedures` -> 0

## Phase 4 — Three pilots, split without losing a line

- [x] **4.0 Re-pick the pilots before splitting (D15).** F3 fired on
      2026-10-17: `design-review` (8 of 8 phases) and `memory-consolidation`
      (at least 3 of 4) are judgement on any honest typing. Keep
      `existing-ui-audit`, replace `memory-consolidation` with a skill whose
      steps end in independently identifiable outputs at stable locations, at
      least one of which step n+1 cannot do without, and decide whether
      `design-review` stays as a judgement-heavy control. Record each candidate
      against those properties before 4.1 runs; 4.1's three names follow this
      step, not the other way round.
      *Done 2026-10-18 (D16):* `existing-ui-audit` and `project-analyzer`;
      `design-review` dropped rather than kept as a control; `design-system-capture`
      failed the council's condition, so the set is two.
      verify: `test -f agents/evidence/analysis/procedure-pilot-selection.md` -> 0
- [x] **4.1 The pilots.** *Amended (D16):* `existing-ui-audit` (steps 0–9
      with 1b and 4b, 396 lines) and `project-analyzer` (phases 1–10, 367
      lines). Each gets a sidecar and `references/steps/`.
      *Done 2026-10-18:* 12 and 10 steps; seven `check:` exits registered in
      `_lib/procedure_checks.ts`, each corroborating its output against the tree.
      verify: `ls src/skills/existing-ui-audit/procedure.yaml src/skills/project-analyzer/procedure.yaml | wc -l` -> /^\s*2$/
- [x] **4.2 Conservation is a test, not a judgement.** Every non-blank line of
      the old body appears verbatim in head ∪ step files; only heading levels and
      link lines may change. The `Procedure` section of the head becomes the
      step table with links and the cursor sentence; the other four required
      sections stay in the head.
      verify: `npx vitest run tests/skills/procedure_conservation.test.ts --reporter=verbose` -> /✓/
      *Amended (D14):* "appears" means in order and exactly once; a relative
      link is compared by the path it resolves to from the skill root, and a
      fenced block byte for byte, so moving a line under another heading or
      dropping a duplicate is a failure, not a pass. The pre-split bodies are
      committed as test fixtures, which also preserves arm A for Phase 6.
      *Done 2026-10-18:* fixtures under `tests/skills/fixtures/procedure_conservation/`;
      seven self-cases prove the check fails a dropped duplicate, a reordered
      step, a moved line, a re-pointed link, a changed fence byte and a new line
      outside `## Procedure`.
- [x] **4.3 Ceilings follow the split.** `check_skill_body_budget --update`
      lowers the three head ceilings; step files get their own shrink-only
      ceilings in `src/config/skill-body-budget.json`.
      *Done 2026-10-18:* the check measures each `references/steps/*.md` under
      `<skill>/references/steps/<file>`; the two heads fell to 10,076 and 16,777
      bytes. Only the pilot rows were re-recorded, not the whole file.
      verify: `./scripts-run src/scripts/check_skill_body_budget` -> 0
- [x] **4.4 Report the head against the compaction tail.** Record each pilot
      head's size against the tail `road-to-skills-that-arrive-when-called`
      step 3.4 measures; this file reports the numbers and decides
      nothing about the tail. *Amended (D16):* two pilots, two rows.
      verify: `grep -cE '^\| (existing-ui-audit|project-analyzer) \|' agents/evidence/analysis/procedure-pilot-heads.md` -> /^2$/

- [x] **4.5 The package ships what the head links (D14).** Every sidecar and
      step file of a split pilot is in the published tarball and in each
      projected tree, so no head links to a file a consumer lacks.
      *Done 2026-10-18:* asserted for `dist/agent-src`, `files[]` and every
      host's skills deploy through the installer's own copy function.
      verify: `npx vitest run tests/skills/procedure_conservation.test.ts -t ships-step-files --reporter=verbose` -> /✓.*ships-step-files/

## Phase 5 — The cursor in the `/work` engine (default-off)

- [x] **5.1 An order per input kind.** `dispatch()` takes an optional step
      order; the default stays `STEP_ORDER`, so every existing directive set and
      the resume contract are untouched. This is the roadmap-level decision
      `dispatcher.ts:64-67` asks for.
      *Done 2026-10-17:* a fourth optional `order` parameter, refused when empty
      or repeated; the full `tests/scripts/work_engine` suite (92 files, 1,001
      tests) passes unchanged.
      verify: `npx vitest run tests/scripts/work_engine/dispatcher.test.ts --reporter=verbose` -> /✓/
- [x] **5.2 `input.kind: procedure`.** Added to `KNOWN_INPUT_KINDS`; its
      directive set is built from the sidecar. One call checks the exit of step
      n and, on success, emits step n+1 with the brief (goal, "step k of n",
      `remaining`, `failed_approaches` — the capsule field names that already
      exist). A failed exit returns `PARTIAL` with the reason; `judgement`
      returns `PARTIAL` with the question.
      *Done 2026-10-18:* `work_engine/procedure/run.ts` builds the step map from
      the sidecar and runs `dispatch` once over its order. A step is handed out
      the first time it is reached and its exit is checked on every later call;
      the brief carries goal, "step k of n", `remaining` and `failed_approaches`.
      The `check:` registry moved beside the engine (`procedure/checks.ts`);
      `src/scripts/_lib/procedure_checks.ts` re-exports it for the lint.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t one-call-per-step --reporter=verbose` -> /✓.*one-call-per-step/
- [x] **5.3 A resumed step is revalidated.** Each `SUCCESS` stores HEAD and the
      content hash of the step file and its exit inputs; on resume a mismatch
      marks the step `stale` and re-checks the exit only — the step is not run
      again.
      *Done 2026-10-18:* HEAD is read from the repository files, not a process.
      A met exit re-checked after a change is reported `revalidated`; an unmet one
      leaves the step `stale` and current. A confirmed judgement goes stale when
      its step file changes.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t stale-after-input-change --reporter=verbose` -> /✓.*stale-after-input-change/
- [x] **5.4 The position survives compaction without a new concern.**
      `handoff-context` already injects on `compact`; it adds one line read from
      `.work-state.json` on disk — `procedure <skill>@<commit> · step k of n
      (<id>) · last exit <ok|stale|partial>` — phrased as state, never as an
      instruction. No state file, no line.
      *Done 2026-10-18:* on `compact` only; the state file carries the step
      order so the line needs no sidecar read. Hook bundle 1,547,451 of
      1,550,000 bytes after the change.
      verify: `npx vitest run tests/scripts/handoff_context_hook.test.ts -t procedure-position-on-compact --reporter=verbose` -> /✓.*procedure-position-on-compact/
- [x] **5.5 Entry is a flag, and the pilots' commands use it.** `agent-config
      work --procedure <skill>` (a flag on an existing verb, ADR-041). The
      commands that invoke the three pilots start the cursor themselves instead
      of only pointing at it, so entry is not prose again. Undocumented in the
      public command reference until Phase 6 decides (D3).
      *Done 2026-10-18:* `--procedure`, `--procedure-confirm`, `--procedure-restart`;
      set only when passed, so every existing invocation parses as before. The
      ordinary path refuses a procedure state file. Not in the public command
      reference (D3).
      verify: `npx vitest run tests/scripts/work_engine/cli.test.ts -t procedure-flag --reporter=verbose` -> /✓.*procedure-flag/
      *Amended (D14):* the pilots' existing commands keep their current path;
      only the explicit `--procedure` flag creates or resumes procedure state.
      "Start the cursor themselves" would make the cursor default-on for those
      commands, which contradicts this phase's heading.
- [x] **5.6 Bounds.** Linear, finite, no repeat mode, no background run, no
      subagent start, no stop gate, no hook other than 5.4's line, no shell
      string from data. A single-question read of one step file stays allowed
      without the cursor.
      *Done 2026-10-18:* asserted on the module source (no process, thread,
      timer or eval) and on behaviour (a command-string exit is refused and never
      runs; one call hands out at most one step).
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t bounds-no-shell-no-subagent --reporter=verbose` -> /✓.*bounds-no-shell-no-subagent/
- [x] **5.7 A judgement exit has an adjudication protocol (D15), before 5.2.**
      The design names who answers a `judgement` PARTIAL, which answer clears
      it, what is recorded, and what happens when nobody answers. A judgement
      step is a sequenced step, not a verified one, and the brief says so.
      *Done 2026-10-18:* the operator answers with `--procedure-confirm <id>`;
      only that confirmation of the current judgement step clears it, recorded as
      `{answer: confirmed, by: operator, at, step_sha}`. Unanswered, the step stays
      current on every call and never times out.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t judgement-adjudication --reporter=verbose` -> /✓.*judgement-adjudication/
- [x] **5.8 Kill switch and state integrity (D14), before 5.2.** A switch
      independent of the flag refuses procedure activation; the sidecar and the
      state file are read as untrusted input (closed versioned schema, paths
      contained in the skill, no symlink escape, size limit, atomic write); a
      state file bound to another skill, commit or engine version fails closed
      and asks for an explicit restart.
      *Done 2026-10-18:* `AGENT_CONFIG_PROCEDURE_OFF=1` refuses before anything
      is read. The sidecar is capped at 64 KiB with closed keys and refuses
      symlinked or escaping step files; the state file is capped at 1 MiB, its
      procedure record has a closed versioned shape, and it is written through a
      temporary file and a rename. Another skill, sidecar or engine version fails
      closed until `--procedure-restart`; a state file of another kind is never
      overwritten.
      verify: `npx vitest run tests/scripts/work_engine/procedure_set.test.ts -t kill-switch-refuses --reporter=verbose` -> /✓.*kill-switch-refuses/

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
      *Amended (D15):* results are reported per pilot and per exit class
      (verified vs sequenced), never only pooled; the per-pilot count is
      revisited with 4.0's pick. *Amended (D16):* two pilots, so the fixed
      count is 20 and the workload 3 × 3 × 20; the verify above follows when
      6.1 is written.
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
      *Revisited 2026-10-18 (D17):* the authorisation is decided with the
      computed maximum in hand, not before; nothing here is authorised yet.
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
| D14 | reversible-technical | council:steps-2425-phase45 | Phase 4 and Phase 5 are council-decidable, not owner-reserved, and need not wait for Phase 6. "Consumer-visible" alone is no reserved category. Both carry pre-merge conditions: 4.2 tightened to ordered, exactly-once, link-resolved conservation; 4.5 package shipping; 5.5's pilot commands keep their path; 5.8 kill switch and state integrity | AI council 2026-10-17, anthropic + openai, 2/2, $0.00, both (a) for both phases; an earlier run had called both owner-reserved on its own judgement without routing it | an existing public compatibility promise is found that skills are a single self-contained `SKILL.md` |
| D15 | reversible-technical | council:steps-2425-d7 | D7's revisit-if fired: F3 is true for `design-review` and `memory-consolidation`. The pilot set is re-picked (4.0) before any split; `memory-consolidation` is replaced; a shape-only check (a key exists) does not count as a verified exit, only a check that corroborates the output against the repository; a judgement step is sequenced, not verified, and needs 5.7's adjudication protocol | AI council 2026-10-17, anthropic + openai, 2/2, $0.00, both reject keeping all three unchanged; one seat keeps `design-review` as a judgement control, the other asks to separate verified and sequenced step classes, and 4.0 decides between them | 4.0 finds no replacement that meets the properties |
| D16 | reversible-technical | council:steps-4-0-pilots | Pilots are `existing-ui-audit` and `project-analyzer`. `design-review` is dropped, not kept as a control: verified and sequenced exits are reported separately inside each pilot instead. `design-system-capture` was admitted only if a later step depends on an earlier artefact, an exit corroborates it against the repository, and its prerequisite run of another skill is resolved; its step 2 needs `existing-ui-audit` first (a skill-to-skill chain, K1) and a hard dependency means rewriting the procedure (K5), so the set is two | AI council 2026-10-18, anthropic + openai, 2/2, $0.00, both name the same two and condition the third identically (local council session `steps-4-0-pilots`); record `agents/evidence/analysis/procedure-pilot-selection.md` | a third skill meets P1–P3 without a content change |
| D17 | spend-exhaustion | council:agents/evidence/council/procedure-cursor-spend-d13-20261018.md | D13 revisited under the delegation: Phase 6 spend is **not** authorised yet. 6.1–6.4 are written first with the pinned model and settings, the exact invocation path and transport, retry policy, aggregation, and a token estimate translated to a worst-case USD figure; the authorisation is then put to the council with that figure before any measured run. A subscription-only authorisation was refused because the eval workload's transport is not established | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); `cost.budgets` is unset on every layer, so no delegated spend threshold is recorded | the pre-registration states its computed maximum |
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
<!-- risk-review: v1 | reviewed: 2026-10-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The split makes a pilot less followed, not more | product | A head that keeps less than it should is loaded and not applied (`skill-writing:121-122`). | 2.1 keeps every write heuristic and all required sections in the head; arm B isolates the split's own effect; F1 stops the rollout. | Phase 6 — Measure before anything becomes a default |
| 2 | The cursor costs more rounds than it saves | product | Each step adds at least one round; the gain may not cover it. | One call per step (5.2); rounds are a pre-registered metric; D8's bar includes them. | Phase 5 — The cursor in the `/work` engine (default-off) |
| 3 | The compaction line re-runs a finished step | implementation | A position line read as an instruction executes a `SUCCESS` step again. | State phrasing, disk-only source, provenance in the line; F5 removes the line on any occurrence. | Phase 5 — The cursor in the `/work` engine (default-off) |
| 4 | Widening the link gate reds unrelated skills | implementation | 1.1 surfaces 40 unresolved links at once. | 1.2 repairs them in the same change; `docs/` links are a reported class, not a failure. | Phase 1 — Links the gate can see |
| 5 | The measurement is spend-bearing | product | Three arms × three runs × 20 tasks (two pilots, D16) cost model calls. | Pre-registration fixes the size before the first run; the run is the operator's call and is not started by this roadmap's authoring. | Phase 6 — Measure before anything becomes a default |
| 6 | A new lint and a new test file trip size and gate ratchets | implementation | New gates are counted by coverage ratchets. | Register each gate with its scanned count and self-test in the change that adds it. | Phase 3 — A procedure as data, with no runtime |
| 7 | A shape check passes for work that was not done | implementation | A check that a state key exists proves the agent wrote something, not that the inventory is right, so the cursor would advance on a claim. | D15: only a check that corroborates the output against the repository counts as a verified exit; a judgement step is labelled sequenced and goes through 5.7's adjudication protocol. | Phase 4 — Three pilots, split without losing a line |

## Acceptance Criteria

- [ ] **AC-1** Every relative link in a delivered `SKILL.md` or
      `references/*.md` resolves, or is reported by a gate as a named
      non-delivered class; a link one `../` short fails CI.
- [x] **AC-2** The order of a pilot's procedure is held by code: with the
      cursor, step n+1 is not emitted until step n's exit is met, recorded
      `judgement`, or recorded `skipped: <reason>`.
- [x] **AC-3** Every non-blank line of each pilot's pre-split body is present
      in its head or step files, and each head still carries the five required
      sections.
- [x] **AC-4** A resumed procedure whose step file or exit inputs changed marks
      that step `stale` and re-checks its exit instead of trusting `SUCCESS`.
- [x] **AC-5** Every existing `/work` test passes unchanged, and no existing
      input kind changes behaviour. *Met 2026-10-18 with one stated exception:*
      the pin in `tests/scripts/work_engine/state.test.ts` that lists
      `KNOWN_INPUT_KINDS` gained `procedure`, the addition 5.2 itself requires;
      the other 1,019 tests in the directory pass untouched.
- [x] **AC-6** No string from a skill file is executed by the cursor or the
      lint.
- [ ] **AC-7** A pre-registered three-arm result is published, the verdict
      follows the frozen rule, and nothing is default-on before it — an honest
      null included.
- [x] **AC-8** `skill_count` and `concern_count` are unchanged by this roadmap.

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
