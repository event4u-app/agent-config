---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to a measured pointer gate and true records

> **Source:** `agents/tmp.old/inbox-2026-10-an/` — a transcript and four plans
> from two parallel three-loop analyses of `main` at `601abd83d` (2026-10-23)
> against an external skills-and-evals reference, re-verified at `ac73481341`
> on 2026-10-25. Most of the round is owned by parked roadmaps and stubs whose
> arrival counters this round raised, or is an owner question. This file
> carries what was still true, owned by nobody, and needs no spend.

## Goal

The per-prompt skill pointer has a measured precision at its own gate,
including how often it fires on prompts that should get no skill; the records
that describe the user-type axis and the two profile trees say what the code
does; the live trigger harness has no fallback into a directory that does not
exist; and "is this path a test" means the same thing in every generic
detector that asks it.

## Phase 1 — Records that say what runs

- [x] **1.1 The live trigger harness falls back into the source tree.**
      `skill_trigger_eval.ts` resolves a skill's `triggers.json` through
      `resolve_logical`, but its fallback joins `.agent-src.uncondensed/skills`,
      which no longer exists, so an unknown skill reports a path nobody can
      open. The fallback names `src/skills`.
      verify: a test asserts the reported path for an unknown skill sits under
      `src/skills/`, seen red before the fix.
      <!-- verify: npm run test:ts -- tests/scripts/skill_trigger_eval.test.ts -->
      <!-- Sibling sweep: 10 more `.agent-src.uncondensed` joins in 7 files; the install.ts
      hits detect a legacy layout on purpose, the rest are pre-existing and not this step. -->

- [x] **1.2 The user-type axis names its real writer and reader.** The settings
      template says `bash scripts/install --user-type=<id>` sets the key and
      `user-types/README.md` says `scripts/install.sh` writes it and "the
      runtime" filters skills by it. The writers are the setup wizard and
      `src/scripts/install.ts --user-type`; the only runtime reader is the MCP
      prompt list's ordering (`src/scripts/mcp_server/prompts.ts`), not skill
      selection.
      verify: neither file names `scripts/install.sh` or `bash scripts/install`,
      and both name the wizard, `install.ts` and the MCP ordering. The README
      also stopped promising an `agent-config install --user-type` flag the CLI
      does not have and a `default_skill_priority` auto-load nothing reads.
- [x] **1.3 The two profile trees say what each is.** `src/profiles/*.yaml`
      (command views, read by `agent-config commands ls --profile`) and
      `src/agent-src/profiles/*.yml` (seed identity profiles) share six ids but
      use different `packs` vocabularies, and neither README names the other.
      Which tree owns the "who" axis is OQ-9 in `agents/owner-questions.md`;
      until it is answered, each README states the split.
      verify: each README links the other tree and says its `packs` list is a
      different vocabulary. The projected seed README names the open decision
      without pointing at the maintainer-only register.

## Phase 2 — The pointer hook's gate, measured

- [x] **2.1 A hook-gate arm in the ranker baseline.**
      `measure_skill_ranker_baseline` measures `keyword-v1` without the gate
      (top-1 0.208 on 390 labelled matrix rows). The `skill-route` hook speaks
      only past `MIN_TASK_TERMS` and `MIN_TOP_SCORE` through `routeDecision`,
      and nothing measured what that gate lets through. `--arm hook-gate`
      reports, with Wilson intervals: fire rate on the labelled rows,
      precision@1 and @3 among fires, recall@3 over all labelled rows, and the
      false-fire rate on the 198 deliberate `expected_skills: []` rows.
      verify: unit tests over a fixture matrix pin each count, and an unknown
      `--arm` value exits 2. Replacing `routeDecision` with the bare ranker
      turns the fire and false-fire tests red.
      <!-- verify: npm run test:ts -- tests/scripts/measure_skill_ranker_baseline.test.ts -->
- [x] **2.2 The reading, recorded where the routing roadmaps read it.** Run the
      arm at this commit and write the numbers into
      `agents/evidence/analysis/skill-routing-precision-2026-09.md` as a dated
      section, because `later/road-to-a-menu-whose-precision-is-measured` and
      `later/road-to-routing-assurance-live-floors` cite that file.
      verify: the section names the commit, the command and every figure the
      arm printed. At `69deff1c56`: fires 59/390, precision@1 0.424 among
      fires against an ungated top-1 of 0.213, false fires 8/203.

## Phase 3 — One answer to "is this a test path"

- [x] **3.1 A shared predicate for the generic detectors.** Four predicates
      answer the question differently: `turn_end_gate_hook.ts` (and its mirror
      in `measure_turn_end_gate.ts`), `adherence_detectors.ts` and
      `detect_verification_tampering.ts`. `app/Modules/X/Tests/FooTest.php` is
      a test to two of them, and `spec/foo_spec.rb` to a different two. One
      predicate in `src/scripts/_lib/test_path.ts`, the union of the three
      (the safe direction for each caller: more files scanned for tampering,
      more files credited as tests), is imported by all four.
      `_lib/test_delta.ts` keeps its own repo-scoped predicate, which its
      header now says, and `code_graph/map_model.ts` keeps its role classifier.
      verify: a fixture table over PHP, JS/TS, Python, Go, Ruby and Gherkin
      paths passes against the shared predicate, every existing suite of the
      four callers passes, and `check_hook_bundle_composition` stays green.
      Landed: 19 fixture cases; 370 tests across the callers' suites; the
      tampering self-test 18/18; the bundle grew 33 B to 1,554,955 B of a
      1,554,977 B ceiling.
      <!-- verify: npm run test:ts -- tests/scripts/test_path.test.ts -->

## Declined or owned elsewhere, with the reason

- **Host-run skill evals, listing snapshot, plugin and hook arms, release arm,
  control fixtures, ADR-263 reopen (plan W1, M1, M2, M4, M8).**
  `later/road-to-routing-assurance-live-floors` and
  `stubs/road-to-live-trigger-eval`, whose arrival counters this round raised
  and whose posed question is unchanged. Not un-parked here: the active estate
  is at its five-roadmap cap (owner directive 2026-10-24).
- **A behavioural executor, pressure cases, rationalization tables (W7, M6,
  S1).** `stubs/road-to-skill-uplift-against-a-no-skill-arm`, counter raised;
  tables stay evidence-gated, as both plans concluded.
- **A consumer floor against test weakening and code suppressions, and a
  project quality contract (W3, W4, F1, F3–F5, F7, F8).** Carried as a new
  section of `later/road-to-adversarial-verification-and-long-runs`, which owns
  the package-side gates and the long-run continuity the second plan's
  autonomous-continuation wave asks for.
- **A spec artefact read by `/work`, a plan stage in the developer view, flows
  with a runtime reader (W6, P5, P6).** `later/road-to-guided-journeys`, which
  docks journeys onto the flow layer; counter raised.
- **A second census column for `Read` of a `SKILL.md` (M3).** Held beside
  `stubs/road-to-a-census-that-refuses-a-partial-store`; the published zero is
  bound to ADR-263 and a second store, and a column measured on the same
  single store changes neither.
- **One owner of the "who" axis, renaming "profile" and "pack" (P1, P2, P4,
  plan E3, E8).** Public surface — OQ-9 in `agents/owner-questions.md`.
- **The plans' fact P3, "no writer and no runtime reader".** Never true at
  either commit: `install.ts:3677` writes the key and the MCP prompt list reads
  it. Only the stale `scripts/install.sh` wording was true; that is 1.2.
- **`test-first` naming the package-side gates as enforcement (F2).** Already
  satisfied: the rule says `instruction-only` and that both gates "catch an
  absence, never an order".
- **The stale default model in the live harness.** The model is pinned by the
  run protocol when the harness is un-parked; changing a default nobody runs
  measures nothing.
- **A Core Web Vitals skill (S3).** The preamble budget leaves no room for a
  catalogue entry, and no performance failure is recorded; the reference's
  coverage is a gap in breadth, not a defect.
- **Persona composition lint, in-flight doubt review, revalidating fetch cache,
  observability and migration deltas (S4, W8.2–W8.5).** No recorded failure in
  this tree for any of them.
- **A fact ledger per finding, adaptive ceremony by risk, five evidence axes,
  learning governance, a code/docs graph, adaptive orchestration (second plan
  loops A–C, F11–F14).** The verification table of this round is the fact
  ledger; risk-proportional depth, `src/code_graph`, delegation policy and the
  learning loop exist; the axes are already the shape of
  `docs/contracts/routing-assurance-metrics.md`.

## Decisions

| ID | Decision | Rung | Record |
|---|---|---|---|
| C1 | 1.3 states the split between the two trees and decides nothing about which owns the axis | not a decision | OQ-9 holds the decision |
| C2 | 3.1 takes the union of the generic predicates; `test_delta` stays repo-scoped | agent | the direction is safe for each caller, stated in the step |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A wider test predicate changes a gate verdict | implementation | The turn-end gate treats a file the old predicate called production source as a test, so a turn it refused now passes. | The union only adds test-shaped names (`-test.js`, `_spec.rb`); every turn-end and adherence suite runs unchanged, and the gate's own comment chooses the generous direction. | Phase 3 — One answer to "is this a test path" |
| 2 | The gate reading is read as a live host number | product | A reader takes the arm's precision for what Claude Code's own router does. | The section names the arm, the ranker and that no host ran; the host reading stays with the parked live-floors roadmap. | Phase 2 — The pointer hook's gate, measured |

## Acceptance Criteria

- [x] AC-1 — the `skill-route` gate's fire rate, precision among fires and
      false-fire rate on no-skill prompts are recorded with intervals at a
      named commit.
- [x] AC-2 — no record touched here names a writer, reader or path the tree
      does not have.
- [x] AC-3 — every generic detector answers "is this a test path" through one
      predicate.
