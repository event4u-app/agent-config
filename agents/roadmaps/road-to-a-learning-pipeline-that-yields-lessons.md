---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
review_by: 2026-12-21
estate_growth_exempt: "Created on 2026-11-21 at the owner's request to plan and execute every measure of the session retro of the same day ('Lass uns alle Learnings einplanen und abarbeiten'); measure 13 has no owner in the active estate (search in Context)."
estate_offset_exempt: "No active roadmap owns the learning pipeline's intake, lesson target or consumer reach; the four neighbours are parked under later/ and each keeps its own scope (relates: block), so nothing is archived to offset this one. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
relates:
  - slug: later/road-to-a-retro-the-merge-runs
    relation: extends
    note: "Owns the retro queue, triage, three paths, sidecar aggregation and the 30-day dogfood (its 5.2/5.3/AC-6). This file adds the delta the retro does not cover: a repeated-error signal, distinct-origin intake, a generated context target, consumer reach of /retro. It changes no retro path, threshold or switch."
  - slug: later/road-to-learning-you-can-see-carried
    relation: disjoint
    note: "Owns the default flip of memory.learn_on_session_end (owner amendment, blocker learning-window-and-owner-amendment). This file never touches that key; 1.2 produces the distinct-origin reading that blocker's step 2 asks for."
  - slug: later/road-to-a-memory-the-consumer-owns
    relation: disjoint
    note: "Owns recall quality and the prompt-free recall log (8.2, Phase 9). 1.4 here only classifies the 2-in-1,227 recall figure from data already on disk; every recall fix stays there."
  - slug: later/road-to-a-learner-the-measurements-gate
    relation: disjoint
    note: "Learns dispatch-policy rows from spawn outcomes. Same word, different object: no lesson, retro or memory store is read or written there."
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: "Extends memory_recall_hook.ts for code-graph answers. Nothing here adds a recall rule or touches that hook."
  - slug: road-to-repo-knowledge-generated-not-written
    relation: depends
    note: "Same retro round (measure 7). Owns the generated, path-triggered knowledge store: renderer with machine header (2.2), layer ranking (3.4), file location and host projection (council 4.1, its D5), subagent probe and spawn-brief fallback (4.3, 4.4). Phase 3 here only feeds retro-minted lessons into that store as one more layer; it builds no renderer, store or subagent carrier of its own."
depends:
  - road-to-repo-knowledge-generated-not-written
---
# Road to a learning pipeline that yields lessons

> **Source:** the owner's session retrospective of 2026-11-21 over roughly 380
> Claude Code sessions across all profiles (measure 13, pattern G: "the learning
> pipeline produces nothing"), and the AI council round of the same day (members:
> anthropic, openai). Council convergence, inlined: anthropic proposed giving up
> automatic learning; openai asked to first locate where the pipeline stops —
> intake, curation or recall — and called frustration text alone a weak signal.
> The retro adopted the compromise: diagnose first, route lessons into contexts
> and commands instead of personal memory, lift the workspace gate.
>
> **Owner constraint, 2026-11-21 (binding):** no hand-maintained or
> owner-written context files. Every lesson this roadmap makes durable is
> GENERATED or refreshed by a command or hook from the repo, the sessions or
> telemetry — never authored by a person. This replaces the retro's "manual
> record path for lessons".

## Goal

A fault that recurs across sessions becomes a lesson without anyone writing it:
the intake sees repeated errors and owner corrections with distinct origins, the
existing sidecar mints a lesson from them, the retro routes it into the
generated, path-triggered project knowledge store that subagents receive, and one
diagnostic command reports per stage (intake, curation, recall, render) how many
items passed, so "774 in, 0 out" can never again hide which stage stopped.

## Context

Every figure below was re-read on 2026-11-21. *(executed)* marks a reading re-run
in this authoring pass; the rest is cited from the retro's audits.

| # | Finding | Evidence |
|---|---|---|
| G1 | **"774 signals" is three signals counted 258 times.** The dogfood ledger has 259 runs; 258 report `signals_in: 3`, one reports 0; sum 774, `lessons_out: 0` on every line. The intake file holds 3 lines, all `"origin": "claude"`. One origin can never clear `MIN_CORROBORATIONS = 2`. The pipeline is **intake-starved**, not curation-broken. | *(executed)* main checkout `agents/runtime/state/learning-dogfood.jsonl` (259 lines), `agents/memory/intake/signals-2026-10.jsonl` (3 lines, 1 origin); `src/scripts/learning_sidecar.ts:47`, `:231` |
| G2 | **The complaint detector exists but left no record.** `detectUserReport` matches `COMPLAINT_PATTERNS` on `user_prompt_submit` (`src/scripts/_lib/self_repair.ts:616-633`; hook slot gate `src/scripts/self_repair_hook.ts:191-193`). The main checkout has no `agents/runtime/self-repair/` directory at all, while the retro counted 88 owner-frustration incidents. Whether the hook is not wired in the owner's profile or the patterns miss is unmeasured. | *(executed)* `ls agents/runtime/self-repair` → no such directory |
| G3 | **The retro triage reads corrections only through self-repair records.** `triageSession` scores self-repair records (+4), compactions, interruptions, ≥ 20 turns; `ANALYSE_AT = 3` (`src/scripts/retro_triage.ts:104-124`, `:37`). With G2 empty, a correction-heavy short session scores `skip:low-signal`. | read |
| G4 | **No detector sees a repeated visible error.** `DefectClass` has five members, none for a failing tool result (`src/scripts/_lib/self_repair.ts:70-90`); `TurnSnapshot` carries tool commands, not results (`:241-253`). Transcript parsing of `is_error` exists in `src/scripts/_lib/cc_transcript.ts`. Fingerprint recurrence is already counted per record (`src/scripts/_lib/self_repair_store.ts:1-9`, `:343-372`). | read |
| G5 | **No retro target writes anything an agent reads.** `TARGETS` = `intake-signal`, `override-proposal`, `contract-no-go-proposal`, `package-record`, `none` (`src/scripts/retro_triage.ts:19-25`). Lessons that exist live in personal host memory, loaded into the main session only, never into subagents. | read; retro synthesis § 6 |
| G6 | **The generated store and its subagent delivery are already planned.** `road-to-repo-knowledge-generated-not-written` (same retro round) renders path-triggered topic files with a machine header (its 2.2), ranks layers by recurrence (3.4), decides location by council (4.1) and measures subagent delivery (4.3, fallback via `composeSpawnBrief` 4.4). Its session layer (3.2) mines transcripts at generation time behind blocker `b-transcript-consent`; it does not feed the self-repair → intake → sidecar → retro chain. | read, that roadmap |
| G10 | **The stop hook already reads the turn's transcript.** `readTurn` (`src/scripts/self_repair_hook.ts:68`) runs on every `stop` for the existing detectors, so a repeated-error detector adds a field read from an input already consumed, not a new transcript access. | read |
| G7 | **`/retro` and `/knowledge:*` are maintainer-only, while the retro sweep runs everywhere.** `workspaces: [agent-config-maintainer]` on `src/domains/meta/retro/command.md:17-18` and on every `src/domains/product-discovery/knowledge/*/command.md` and `src/domains/meta/team-knowledge/*/command.md`. The daily probe runs in every repo from `src/scripts/session_register_hook.ts:943-948` with `retro.enabled: true` (`src/config/agent-settings.template.yml:1119`), so consumers receive queue lines for a command they do not have. | read |
| G8 | **`learn_on_session_end: false`, `session_index: "off"`** (`src/config/agent-settings.template.yml:1155`, `:1144`). The flip is an owner amendment owned by `later/road-to-learning-you-can-see-carried`; this file does not touch it. | read |
| G9 | **Recall: 2 hits in 1,227 `memory-recall` fires; the store was opened in 0 of 90 bench runs; `agents/memory/` is empty in five consumer repos.** The ledger behind the 1,227 figure was not re-located in this pass *(unverified)*. | retro audits § 2 |

**Scope — only the delta.** The retro roadmap owns triage, queue, paths,
sidecar aggregation and the 30-day dogfood; the consumer-memory roadmap owns
recall quality; the carried learning roadmap owns the `learn_on_session_end`
flip; the repo-knowledge roadmap owns the generated store, its location and
its delivery to subagents. This file adds: per-stage diagnosis (Phase 1), intake
that produces distinct-origin signals from repeated errors and corrections
(Phase 2), a retro `context` target whose lessons enter that generated store as
one more layer (Phase 3), consumer reach (Phase 4),
an end-to-end proof (Phase 5), and a staleness check of personal memory facts
against the tree (Phase 6). A learning that would change a package rule,
skill or command still travels as a package proposal under ADR-281 (council
record plus owner authorization bound to the digest) — that floor fires at run
time and is not authored here.

## Phase 1 — Locate the stop: one diagnostic per stage

- [ ] **1.1 Write the failing test for `learning_diagnose`.** New
      `tests/scripts/learning_diagnose.test.ts`: a fixture store with 258 ledger
      lines of the same 3 signals from one origin must report
      `intake: distinct=3 origins=1`, `curation: blocked-by MIN_CORROBORATIONS`,
      `verdict: intake-starved`; a fixture with 2 origins on one claim must report
      `verdict: curation-ok`. The test runs red because the script does not exist.
      verify: `npx vitest run tests/scripts/learning_diagnose.test.ts` -> /fail/
- [ ] **1.2 Implement `src/scripts/learning_diagnose.ts`.** Reads, never writes:
      the dogfood ledger (runs, sum vs distinct signals), the intake files
      (lines, distinct origins), the sidecar's `lessons`, the self-repair store
      (records per class, max occurrences), the retro dispositions (count per
      class), the recall ledger when one exists (else prints
      `recall: unmeasured`). Output is a fixed-order text block plus `--json`.
      Run it in this repository and in each sibling checkout under the
      workspace root that has `agents/`.
      verify: `npx vitest run tests/scripts/learning_diagnose.test.ts` -> 0
- [ ] **1.3 Measure the complaint detector's recall.** Build
      `tests/fixtures/self-repair/owner-corrections.jsonl` from the retro's
      correction and frustration incidents, paraphrased and stripped of names,
      paths and customer terms (one line per turn, ≥ 30 lines, plus ≥ 30
      neutral turns as the negative set). Add a corpus case to
      `tests/scripts/self_repair_detector_corpus.test.ts` that prints recall and
      false-positive rate, and record both numbers in the test name's snapshot.
      This fixes the baseline 2.1 must beat.
      verify: `npx vitest run tests/scripts/self_repair_detector_corpus.test.ts -t owner-corrections` -> 0
- [ ] **1.4 Establish why G2's store is empty.** Run
      `./scripts-run src/scripts/learning_diagnose --json` and
      `./agent-config hooks:status` for the `claude` host; classify the empty store as `not-wired`,
      `patterns-miss` (1.3 recall < 50 %) or `both`, and classify G9 as
      `empty-store`, `ranking` or `unmeasured` from the counts alone. Write the
      two classifications as Decisions rows D1, D2.
      verify: `grep -cE '^\| D[12] ' agents/roadmaps/road-to-a-learning-pipeline-that-yields-lessons.md` -> /^2$/

## Phase 2 — Intake with distinct origins: corrections and repeated errors

- [ ] **2.1 Raise complaint recall above the 1.3 baseline.** If D1 says
      `not-wired`: add `self-repair` to the `claude` bundle's
      `user_prompt_submit` list in `src/scripts/hook_manifest.yaml` where it is
      missing, test-first with a bundle-composition assertion. If D1 says
      `patterns-miss`: extend `COMPLAINT_PATTERNS` for the missed shapes in the
      1.3 fixture (repeated-instruction, "no, I said", "again" forms in DE and
      EN), test-first — the missed fixture lines go red before the edit.
      verify: `npx vitest run tests/scripts/self_repair_detector_corpus.test.ts -t owner-corrections` -> 0 — recall ≥ baseline + 25 pp, false-positive rate ≤ baseline + 2 pp
- [ ] **2.2 Write the failing test for a `repeated-error` detector.** In
      `tests/scripts/self_repair.test.ts`: three stop-slot transcripts from
      three sessions with the same failing tool result (e.g. `tsx: No such file
      or directory` under different absolute paths) yield ONE record with
      `occurrences: 3`; two different errors yield two records with one
      occurrence each; an error line carrying a planted `sk-` token or
      `password=` value is stored masked.
      verify: `npx vitest run tests/scripts/self_repair.test.ts -t repeated-error` -> /fail/
- [ ] **2.3 Implement the detector.** Add `'repeated-error'` to `DefectClass`
      and `DEFECT_CLASSES` (`src/scripts/_lib/self_repair.ts:70-90`) and to the
      issue form `.github/ISSUE_TEMPLATE/self_repair_report.yml` (pinned by
      test). In `self_repair_hook.ts` the `stop` slot reads the turn's
      `is_error` tool results through `_lib/cc_transcript.ts`, normalises the
      first error line (home paths, digits, hex ids, temp dirs replaced by
      placeholders), runs it through `sanitizeEvidence` plus the secret masker,
      and records it with `source: 'self-detected'`. Only the normalised line
      is stored — no surrounding transcript text.
      verify: `npx vitest run tests/scripts/self_repair.test.ts -t repeated-error` -> 0
- [ ] **2.4 A recurring record emits intake with one origin per session.**
      Test-first: when a `repeated-error` or `user-reported` record reaches its
      third occurrence, `memory_signal.ts` receives one signal per contributing
      session with `origin` = the session tag (not the host name), so the
      sidecar sees ≥ 2 origins (G1). Two sessions on one host count as two
      origins; one session firing twice counts as one.
      verify: `npx vitest run tests/scripts/self_repair.test.ts -t session-origin` -> 0
- [ ] **2.5 The dogfood ledger records distinct counts.** Test-first: the
      ledger writer in `src/scripts/memory_learn_hook.ts` adds
      `signals_distinct` and `origins` beside `signals_in`; a fixture of three
      identical re-reads writes `signals_distinct: 3` on every line.
      verify: `npx vitest run tests/scripts/memory_learn_hook.test.ts -t distinct` -> 0

## Phase 3 — Lessons land in the generated store every agent reads

Runs after the repo-knowledge roadmap's 2.2 (renderer) and 3.4 (layer ranking)
are on main; location, host projection and subagent delivery follow that
roadmap's council verdict (its D5) and probe (its 4.3/4.4) unchanged.

- [ ] **3.1 Add the `context` target to the retro, test-first.** Extend
      `TARGETS` in `src/scripts/retro_triage.ts:19-25` with `'context'`. A
      lesson routed there is stored as a machine record — lesson text ≤ 400
      characters, trigger paths, source unit keys, origins, minted-at — under
      `agents/runtime/lessons/` (gitignored with the rest of `agents/runtime/`).
      `docs/contracts/retro-v1.md` lists the target. A record whose unit has
      fewer than 2 distinct origins is refused (C2).
      verify: `npx vitest run tests/scripts/retro.test.ts -t context-target` -> 0
- [ ] **3.2 Lesson records become a layer of the generated store, test-first.**
      Add a lesson reader to the repo-knowledge layer ranking (its 3.4) that maps each
      record to a `known-traps` entry with evidence `lesson:<unit-key>` and the
      record's paths as `paths:` input, ranked by the same recurrence × recency
      rule. No second renderer: the topic file, its machine header and its
      hand-edit detection stay the repo-knowledge roadmap's.
      verify: `npx vitest run tests/scripts/repo_knowledge_merge.test.ts -t lesson-layer` -> 0
- [ ] **3.3 A minted lesson triggers a refresh.** At the end of a retro run
      that minted a `context` lesson (`src/scripts/retro.ts`), mark the
      generated store stale so its own refresh (the repo-knowledge roadmap's
      5.1 slot) regenerates on the next session start. Test-first: a fixture
      retro run writes the stale mark; a run that minted nothing writes none.
      verify: `npx vitest run tests/scripts/retro.test.ts -t context-refresh-mark` -> 0
- [ ] **3.4 Personal memory is not a lesson target.** Test-first: a retro unit
      whose synthesis names the host memory directory as its target is routed
      to `context` or `none`, never written to host memory; `retro-v1.md`
      states it.
      verify: `npx vitest run tests/scripts/retro.test.ts -t no-host-memory-target` -> 0

## Phase 4 — Consumer reach and one health line

- [ ] **4.1 Put the workspace gate to the council, then apply it.** First
      action: run the council on lifting `workspaces: [agent-config-maintainer]`
      from `/retro` and `/knowledge:list` (generated or read-only surfaces)
      while keeping it on `/knowledge:ingest`, `/team-knowledge:bootstrap` and
      `/team-knowledge:consolidate`, which take human-written input and so
      conflict with the owner constraint. First command:
      `./agent-config council:status`. Record the verdict as D3 with date and
      members inline; an `ESCALATE` becomes a `## Blockers` entry with
      `Routed:` filled. On `DECIDE`: remove the two `workspaces:` blocks in
      `src/`, then run `task sync` and `task generate-tools`.
      verify: `./scripts-run src/scripts/validate_frontmatter` -> 0
- [ ] **4.2 The retro queue line names a command the consumer has.** Test-first:
      a consumer-workspace fixture in a new `tests/scripts/retro_sweep.test.ts`
      that receives a retro queue line also lists `/retro` in its projected
      command set; on a D3 `ESCALATE`, the queue line instead names
      `./agent-config retro` as the CLI form.
      verify: `npx vitest run tests/scripts/retro_sweep.test.ts -t consumer-command` -> 0
- [ ] **4.3 One health line per stage.** `/project:health`
      (`src/domains/engineering-base/project/health/command.md`) gathers
      `./scripts-run src/scripts/learning_diagnose --json` and shows
      intake distinct/origins, self-repair records, lessons minted, lessons
      present in the generated store, retro queue length, recall state.
      verify: `grep -c 'learning_diagnose' src/domains/engineering-base/project/health/command.md` -> /^[1-9]/

## Phase 5 — End-to-end proof

- [ ] **5.1 One fixture walks the whole pipeline.** New
      `tests/scripts/learning_pipeline_e2e.test.ts`: three sessions with the
      same failing tool result → one `repeated-error` record at 3 occurrences
      → three intake signals with three origins → the sidecar mints one lesson
      → a retro unit routes it to `context` → the repo-knowledge ranking places
      it in the `known-traps` topic with `lesson:<unit-key>` evidence and the
      lesson's paths in `paths:` → a non-matching path's topic file does not
      carry it. `learning_diagnose` on the fixture prints `verdict: flowing`.
      Subagent receipt is the repo-knowledge roadmap's 4.3 probe, re-run here
      with the lesson fixture as its canary.
      verify: `npx vitest run tests/scripts/learning_pipeline_e2e.test.ts` -> 0
- [ ] **5.1a The subagent probe sees a lesson.** Re-run the repo-knowledge
      subagent probe with the 5.1 lesson as canary.
      verify: `./scripts-run src/scripts/repo_knowledge/subagent_probe --json` -> /"subagent":"present"/
- [ ] **5.2 Run the diagnostic on this repository after the change.** Record
      the `learning_diagnose` text block in the PR description of the change
      that lands Phase 5, so the per-stage counts at landing are on record. The
      30-day live reading stays with `later/road-to-a-retro-the-merge-runs`
      step 5.2.
      verify: `./scripts-run src/scripts/learning_diagnose` -> 0

## Phase 6 — Personal memory facts are checked against the tree

The retro found a personal memory that recorded a bundle headroom of "303 B"
when the measured headroom was about 50 KB. The agent acted on the old number.
G5 and G9 cover memory that does not reach an agent; this phase covers memory
that reaches it with a wrong fact. The reader `src/scripts/_lib/host_memory_reader.ts`
is read-only by council decision of 2026-11-04 and opens only the current
project's memory directory. That boundary holds here: the package flags a stale
fact, and the host session that owns the memory refreshes it (C7).

- [ ] **6.1 Write the failing staleness test.** New
      `tests/scripts/memory_staleness.test.ts` over a fixture memory directory
      and a fixture repository:
      - (a) a cited repo path or `./scripts-run` script that is gone →
        `dead-path`;
      - (b) the retro's shape: `headroom 303 B` next to a cited budget file
        that changed in a commit after the memory's mtime and no longer
        contains `303` → `stale`, with that commit's date;
      - (c) the same claim, file unchanged since the memory → `current`;
      - (d) a number with no cited path → `unverifiable`, with the memory's
        age in days;
      - (e) output names file, class and matched number only, never a memory
        body line;
      - (f) the directory's listing and mtimes are identical after the run.

      verify: `npx vitest run tests/scripts/memory_staleness.test.ts` -> /fail/
- [ ] **6.2 Implement `src/scripts/memory_staleness.ts`.** Add a
      `readHostMemories(dir)` export to `host_memory_reader.ts` (all types,
      same caps and symlink refusals as `readHostFeedback`), test-first in
      `tests/scripts/host_memory_reader.test.ts`. The script extracts
      (number, unit, cited path) claims and dates each cited path by its last
      commit (`%cI`). It prints a fixed-order text block plus `--json`. It is a
      measurement: exit 0, and exit 2 only on an unreadable tree.
      verify: `npx vitest run tests/scripts/memory_staleness.test.ts tests/scripts/host_memory_reader.test.ts` -> 0
- [ ] **6.3 Surface the flags where the host session reads them.**
      `learning_diagnose` (1.2) gains one line,
      `memory: stale=N dead-path=M unverifiable=K`, test-first in
      `tests/scripts/learning_diagnose.test.ts`. The session-start beat in
      `src/scripts/session_register_hook.ts` emits one line naming the flagged
      memory files only when `stale + dead-path > 0`. That line tells the
      session to re-measure and update its own memory. The beat emits nothing
      at zero, and its failing case goes in `tests/scripts/session_register.test.ts`.
      verify: `npx vitest run tests/scripts/learning_diagnose.test.ts tests/scripts/session_register.test.ts` -> 0
- [ ] **6.4 Run it on this repository's host memory.** Run
      `./scripts-run src/scripts/memory_staleness` and put its counts (not its
      file list) in the PR description of the change that lands Phase 6.
      Memory content is personal, so no tracked artefact holds it.
      verify: `./scripts-run src/scripts/memory_staleness --json` -> 0

<!-- Release holds — none. Template rule 28 considered.

     resequenced: a retro writing `context` records no reader consumes, and a
     new DefectClass without its issue-form entry; Phase 3 starts only after the
     repo-knowledge ranking is on main and 2.3 carries the form edit in the same
     step, so no window was ever needed.
-->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | reversible-technical | agent | The "manual record path for lessons" from the retro is replaced by generated intake (Phase 2) and a generated target (Phase 3) | owner constraint 2026-11-21 (Source block) | the owner withdraws the constraint |
| C2 | reversible-technical | agent | Frustration wording alone never mints a lesson: a correction counts only as a self-repair record, and minting still needs ≥ 2 distinct origins | council 2026-11-21, openai seat: frustration text is a weak signal; `learning_sidecar.ts:47` | 1.3 shows the detector's false-positive rate above 10 % |
| C3 | reversible-technical | agent | `memory.learn_on_session_end` is not touched here | G8; owned by `later/road-to-learning-you-can-see-carried` | that roadmap's blocker resolves |
| C4 | deterministic | agent | Every `vitest -t <name>` verify names a test title the same step creates, so `closure_scan` reads it as unmatched until the step runs; each such step is test-first and its red run precedes the green one | closure_scan unfalsifiable-verify on 1.3, 2.1–2.5, 3.1, 3.3, 3.4 (non-blocking family) | a step flips with the title still absent from its test file |
| C5 | reversible-technical | agent | Read as a false positive of the `typed-op` scan: both remaining matches (relates block, step 5.2) are the slug `road-to-a-retro-the-merge-runs`; no step merges, pushes, deploys or publishes anything | closure_scan typed-op on line 11 and step 5.2 | a step gains an action on a remote |
| C6 | deterministic | agent | AC-5's two outcomes are the two D3 verdicts, not an open alternative | closure_scan unpicked-alternative on AC-5 | — |
| C7 | reversible-technical | agent | The staleness check flags and never writes host memory; the host session refreshes its own memory from the 6.3 line | `host_memory_reader.ts` header: read-only, current project only (council 2026-11-04); 3.4 keeps host memory out of the lesson targets | the host exposes a supported memory-update API the package may call |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Error lines leak secrets into records and the generated store | implementation | A failing command's first error line can carry a token, DSN or customer path, and Phase 3 feeds lessons into files a subagent reads and that may be committed (repo-knowledge D5). | 2.2 plants a token and a password value and asserts masking; only the normalised line is stored; 3.2 maps lesson text, never raw evidence. | Phase 2 — Intake with distinct origins: corrections and repeated errors |
| 2 | Lessons become noise that costs context | product | A recurring-but-harmless error (flaky network) mints lessons that every agent touching the path pays for. | Third-occurrence threshold, ≥ 2 origins (3.1), the repo-knowledge 2,048 B topic cap and recurrence × recency ranking, and the retro's held/recurred reading. | Phase 3 — Lessons land in the generated store every agent reads |
| 3 | The dependency stalls Phase 3 | implementation | The repo-knowledge roadmap's ranking or probe does not land, so lessons have no destination. | Phases 1, 2, 4 run independently; Phase 3 records stay in `agents/runtime/lessons/` and `learning_diagnose` reports them as `minted, undelivered`. | Phase 3 — Lessons land in the generated store every agent reads |
| 4 | The diagnosis contradicts the plan | implementation | 1.4 may find the stop is in recall, not intake, making Phase 2 lower-value. | Phase 1 runs first and writes D1/D2; Phase 2 steps branch on D1, recall fixes stay in `later/road-to-a-memory-the-consumer-owns`. | Phase 1 — Locate the stop: one diagnostic per stage |
| 5 | Lifting the workspace gate surfaces half-wired commands to consumers | product | `/retro` in a consumer may reference maintainer-only stores. | Council first (4.1); 4.2 tests the consumer projection; human-input commands keep the gate. | Phase 4 — Consumer reach and one health line |
| 6 | The staleness check flags correct memories | implementation | A number that is still true but sits next to a file that changed for an unrelated reason is flagged `stale`, and the session-start line becomes noise | `stale` needs both a later commit and the number missing from the file (6.1 b against c); `unverifiable` never reaches the session-start line; the line is silent at zero | Phase 6 — Personal memory facts are checked against the tree |

## Acceptance Criteria

- [ ] AC-1 — `learning_diagnose` reports intake, curation, self-repair, retro,
      render and recall counts per stage, and on the G1 fixture names the stage
      that stopped (`intake-starved`).
- [ ] AC-2 — A visible error recurring in three sessions produces one
      self-repair record and intake signals with three distinct origins, with
      any secret in the error line masked.
- [ ] AC-3 — A minted lesson exists only as a machine record plus an entry in
      the generated `known-traps` topic with `lesson:<unit-key>` evidence; no
      lesson is written to host memory or to any hand-edited file.
- [ ] AC-4 — The repo-knowledge subagent probe reports `present` for a lesson
      canary on a matching path.
- [ ] AC-5 — Decisions D1–D3 are recorded; a consumer that receives a retro
      queue line can run what the line names (`/retro` after a D3 `DECIDE`, the
      CLI form after a D3 `ESCALATE`).
- [ ] AC-6 — `memory_staleness` flags the retro's "303 B" shape as `stale` and
      a vanished path as `dead-path`, writes nothing under the host memory
      directory, and `learning_diagnose` prints its `memory:` line (6.1-6.3
      tests green).
- [ ] AC-7 — `task ci` is green on the change that closes Phase 6.
