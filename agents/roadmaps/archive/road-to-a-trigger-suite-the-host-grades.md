---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Builds the instrument two held objects lack, without deciding either. Merging into stubs/road-to-live-trigger-eval or later/road-to-routing-assurance-live-floors was rejected because both hold owner or council questions this file must not pre-empt, and editing them would mix a tool with a pending decision; parking in later/ was rejected because the compiler needs no run, no spend and no decision to land."
relates:
  - slug: road-to-routing-assurance-live-floors
    relation: disjoint
    note: "Parked. Its un-park condition — an execution protocol frozen by a session that did not author the corpus — governs the first scored run; this file builds the cases and never runs them."
  - slug: road-to-live-trigger-eval
    relation: disjoint
    note: "Stub with a posed owner question. One of its stated obstacles is an interactive terminal gate; the host runner has a non-interactive flag. The question stays the owner's."
  - slug: road-to-a-menu-whose-precision-is-measured
    relation: disjoint
    note: "Parked. Grows the trigger corpus; this file compiles whatever corpus exists and adds no case of its own."
---
# Road to a trigger suite the host grades

> **Source:** `agents/tmp.old/inbox-2026-10-i/` — a three-loop host-surface audit
> whose core finding was that the host now ships its own skill evaluator, the
> independent grader a parked routing roadmap asked for. Re-verified against
> `origin/main` @ `d41121927` (v16.4.0) and the host binary on the maintainer
> machine (Claude Code 2.1.296) on 2026-10-11. Steps marked
> `corrected-from-reproduction` carry the wording the reproduction forced.

## Goal

Every labelled query in the trigger corpus exists as a case the host's own
evaluator can run, tagged train or holdout by the frozen partition, and the
command that would run them is printed with its cost cap, run count and
the flag that keeps the report local — but never run by this roadmap. When the owner or the council
decides a scored run, the instrument is ready and its protocol cannot be chosen
by the session that authored the corpus.

## Context

- **The host runner, reproduced.** `claude plugin eval --help` on 2.1.296: cases
  live at `<eval dir>/**/case.yaml` or `prompt.md` plus `graders/*.md`; a
  no-plugin baseline arm runs by default whenever a plugin resolves
  (`--ablation with-without`), and a `tool_used: Skill` grader counts as a
  plugin-fired indicator under it; `--runs` defaults to the case's own value
  or 3; `--max-cost-usd` is a hard ceiling; `--trust-plugin` answers the
  first-run prompt for CI; and the HTML report is **published to the account
  by default** unless `--no-publish` is passed. <!-- closure: ignore --> `init --bare <name>` writes a
  blank single-case template. `corrected-from-reproduction`: the supplied plan
  named graders and flags from a changelog; the help text is the source here.
- **The tree has nothing for it.** `grep -rln "plugin eval" src docs
  agents/roadmaps` returns nothing. There is no `evals/` directory at the
  package root.
- **The corpus, measured.** 124 `src/skills/*/evals/triggers.json` files hold
  1,186 labelled queries — 603 that should trigger the skill and 583 that
  should not. Two shapes coexist: 122 files use `queries[]` with `trigger` and
  `class`, two use `should_trigger` / `should_not_trigger`.
  `corrected-from-reproduction`: the supplied plan counted 101 files and one
  shape.
- **The holdout is frozen by a rule, not a list.**
  `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` fixes
  `holdout iff sha256(<skill-directory-name>).digest()[0] < 51` and a set hash.
- **Why it is not run here.** `later/road-to-routing-assurance-live-floors.md`
  is parked on evaluator independence: the session that authored a corpus may
  not choose the protocol that measures it. A host-written grader does not
  lift that — the protocol choice is the point — so the first run belongs to
  that file's un-park condition, and a run is spend.

## Phase 1 — The case shape comes from the host

- [x] **1.1 Pin the host's blank case.** Run `claude plugin eval init --bare
      pin-shape` in a temporary directory, copy the produced case file into
      `tests/fixtures/plugin-eval/` with the host version in its header, and
      delete the temporary directory. If the command makes a model call or
      asks for one, stop and record that instead — this step spends nothing.
      verify: `ls tests/fixtures/plugin-eval/ | grep -c case` -> /^[1-9]/

      **Closed 2026-10-12, with two corrections the reproduction forced.**
      `claude plugin eval init --bare pin-shape` writes **two** files, not one:
      `evals/<name>/prompt.md` and `evals/<name>/graders/criteria.md`. One case,
      two files — the `case.yaml` form the host also accepts is not what the
      scaffold emits. And in a bare temporary directory the command REFUSES
      ("… is not a plugin or skill folder — run `claude plugin eval init` from
      the plugin's root folder, or pass `--eval-dir` to scaffold here on
      purpose"), so the step's temporary-directory instruction needs that flag.
      Both files are pinned byte-identical as `case-prompt.md` and
      `case-grader.md`; the host version (2.1.296) lives in a `README.md` beside
      them rather than in their headers, because a pinned shape whose bytes were
      edited is not a pin. The temporary directory was deleted. Nothing was run:
      `init` makes no model call, so the step's stop condition did not fire.

## Phase 2 — One case per labelled query

- [x] **2.1 The compiler, test first.** `compile_trigger_evals` reads both
      corpus shapes and emits one case per query in the pinned shape: the
      prompt is the query; the grader asserts the named skill was used for a
      positive query and not used for a negative one; tags carry the skill,
      the query class, and `holdout` or `train` from the frozen rule. It
      writes only under a gitignored output directory and nothing else. A test
      over a fixture corpus with both shapes asserts the case count, the
      grader polarity per class, and the partition tag, and is seen red before
      the compiler exists.
      verify: `npx vitest run tests/scripts/compile_trigger_evals.test.ts` -> 0
- [x] **2.2 Parity with the live corpus.** A second test compiles the live
      corpus into a temporary directory and asserts the case count equals the
      labelled-query count and the holdout tags reproduce the frozen set hash.
      verify: `npx vitest run tests/scripts/compile_trigger_evals.test.ts -t parity` -> 0

      **Closed 2026-10-12. The corpus has grown since this file was written**
      — 125 files and **1,203** labelled queries (612 positive, 591 negative),
      against the 124 / 1,186 / 603 / 583 the Context records from 2026-10-11.
      The parity test asserts the live count rather than a pinned one, so the
      growth is not a failure and the figure here is dated rather than frozen.
      Compiled: **1,203 cases, 261 holdout, 942 train.**

      **What the parity test asserts about the frozen set, exactly.** The
      published `SET-SHA256` hashes each corpus file's CONTENT alongside its
      partition, so it moves whenever any corpus file is edited —
      `trigger_corpus_holdout_pin.test.ts` is what keeps that value true, and
      duplicating it here would mean two places to re-pin. What this test owns
      is the half the compiler is responsible for: every emitted partition tag
      reproduces the frozen rule, every case of one skill lands on one side,
      and the whole partition column equals the recipe recomputed over the live
      tree. The claim is the partition, not the content hash, and the test says
      so in its own comment.

## Phase 3 — The run is printed, never performed

- [x] **3.1 A print-only runner.** `compile_trigger_evals --print-run` prints
      the exact host command for a requested tag set, and refuses to print one
      that lacks the keep-local flag named in Context, an explicit `--runs`, a
      `--max-cost-usd`, and a path to a protocol file. It executes nothing. The protocol file is
      written by whoever runs it, under the parked roadmap's un-park condition.
      verify: `npx vitest run tests/scripts/compile_trigger_evals.test.ts -t print-run` -> 0

      **Closed 2026-10-12.** `--print-run` returns a string and executes
      nothing; a function that returns a command cannot have run one. It
      refuses a request missing an explicit `--runs`, a `--max-cost-usd` or a
      protocol path, and `--no-publish` is not a parameter at all — it is
      always in the printed command, because D3's reason is that the host
      publishes its report by default and an optional flag is the one somebody
      drops under time pressure.

## What this roadmap deliberately does not do

- **No scored run, no claim, no unlock.** Registering a delta claim, running
  the suite, or un-parking `later/road-to-routing-assurance-live-floors` is a
  council or owner decision recorded on those objects, not here.
- **No grader of this package's own beside the host's** — the independence is
  the point.
- **No per-PR run in CI.** The lexical description checks stay the PR-time
  ratchet; a host run is billed per case.
- **No consumer-visible effect, and it does not claim one.** This is a
  maintainer-side instrument; the supplied plan's rule that every wave names a
  consumer effect (its D17) is declined for this file for exactly that reason.
- **No new cases.** The corpus grows under its own roadmaps; this file compiles
  whatever exists.

## Acceptance Criteria

- [x] AC-1 — Every labelled query in the trigger corpus compiles to exactly one
      host-shaped case, tagged train or holdout by the frozen rule.
- [x] AC-2 — The only way the tool emits a run command is with the keep-local
      flag, an explicit run count, a cost cap and a protocol path, and it runs
      nothing.
- [x] AC-3 — No compiled case is committed to the tree.
      **MET 2026-10-12 by a refusal, not a convention.** `compileCorpus`
      refuses an output directory inside the repository that `git check-ignore`
      does not cover, and the test asserts both directions: a tracked path
      throws and creates nothing, a gitignored one compiles. ~1,200 generated
      directories swept in by one `git add -A` only has to happen once, and git
      decides what counts as tracked so the check cannot drift from
      `.gitignore`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | evidence | Print, never run | The parked roadmap's council record (2/2, 2026-08-25) refuses an authoring session choosing a protocol; a run is spend | The owner or council records a run decision on the parked roadmap |
| D2 | reversible-technical | agent | Holdout cases are tagged, not excluded | Excluding them would make the compiled set a second corpus; tagging lets a protocol select either side | — |
| D3 | reversible-technical | agent | No-publish is mandatory in the printed command | The host publishes the report by default; a report carries prompts and grader verdicts off the machine | The host's default changes |
| D4 | reversible-technical | agent | The case shape is pinned from the host's own template, not from documentation | Documentation and changelog wording disagreed with the help text on this machine | The pinned fixture's host version is older than the installed host by a minor |
| D5 | deterministic | evidence | The Context line naming the host's report flag carries a closure-ignore marker | `closure_scan`'s typed-op pattern matches the word inside the flag's literal name; no step here uploads, deploys or merges anything | The flag is renamed |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A run publishes the corpus off the machine | product | The host publishes its report by default; a careless run ships prompts and verdicts to an account page | D3: the printed command always carries the no-publish flag, and 3.1's test refuses one without it | Phase 3 — The run is printed, never performed |
| 2 | The host's case format moves | implementation | A host update changes the case schema and every compiled case is silently ignored | 1.1 pins the shape with its host version; 2.2's parity test fails on a shape the fixture no longer matches | Phase 1 — The case shape comes from the host |
| 3 | A negative case punishes a correct neighbour | product | A query that should not trigger skill A may rightly trigger skill B; a grader on "no skill used" would read that as a miss | The grader asserts only the named skill's absence, never "no skill at all" | Phase 2 — One case per labelled query |
| 4 | The tool is read as a decision | product | A ready compiler reads as pressure to run it before the parked roadmap's condition holds | The non-goals and D1 say who decides; the tool prints and stops | Phase 3 — The run is printed, never performed |
| 5 | The corpus outgrows the figures beside it | implementation | This file's Context pins 124 files and 1,186 queries from 2026-10-11; two days later the live tree held 125 and 1,203, and a test asserting the pinned number would have failed on growth that is not a defect. | The parity test asserts the LIVE count against the live corpus and never a frozen one; the figures in 2.2's closing note carry their date. The content-hash pin stays where it already is, in `trigger_corpus_holdout_pin.test.ts`. | Phase 2 — One case per labelled query |

## Provenance

Source ids from the supplied plan, by disposition: W2.1 → Phases 1–2
(`corrected-from-reproduction`); W2.2 → Phase 3 prints its run, the claim and
the unlock stay with the parked roadmap (E2 recorded there, not here); W2.3 →
declined here, its subject belongs to `stubs/road-to-skill-retirement-signal`;
W2.4 → declined (depends on a scored run); E7 → adopted as the no-per-PR
non-goal; K2 (no second corpus) and K9 (no own grader) → carried as non-goals.
