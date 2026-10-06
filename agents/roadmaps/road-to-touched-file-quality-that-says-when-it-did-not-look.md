---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The nearest object is later/road-to-touched-files-that-pass-their-own-tools-carried, whose blocker recommends fixing two soundness findings before the shipped default moves — and which holds no step for them. Folding them in would unpark an owner-gated roadmap to carry agent-executable work and blur its entry condition; archiving or parking anything else frees no owner for these findings. Adds no gate, no settings key and no skip reason by default."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the soundness fixes the carried blocker asks for first have no step anywhere else."
relates:
  - slug: road-to-touched-files-that-pass-their-own-tools-carried
    relation: extends
    note: "Its owner blocker decides the shadow -> warn flip and recommends fixing the two soundness findings first; this roadmap is those fixes plus a pre-registered bar. It edits none of that file's steps and leaves the flip to its blocker."
---
# Road to touched-file quality that says when it did not look

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main`
> @ `a75bb3210` on 2026-10-06. Class: external review corpus.

## Goal

A touched-file quality record never shows the shape of a pass for a file the
tool declined to look at, and never lets a green row read as type-safe when the
type checker did not run on that turn. The table that turns resolver commands
into scoped forms cannot drift from the resolver without a test going red. The
bar a `shadow → warn` flip would have to clear is written down before anyone
reads a number against it. The flip itself stays with the owner.

## Context

- `src/scripts/_lib/touched_file_quality.ts` (tfq) classifies each resolver
  command into a runnable form or one of four skip reasons —
  `'mutating' | 'unscoped' | 'absent' | 'no_files'` (`:69`). A run records
  `exit_code: null` for a skip, "never `0`, which is a real verdict" (`:87`).
- The scoped forms are a hand-kept table keyed on the exact command string the
  resolver emits: `SCOPED_FORMS` (`:126-142`) and the empty
  `MUTATING_WITHOUT_CHECK_FORM` (`:154`, documented at `:145-153`). The resolver
  is `resolve_toolchain()` in
  `src/agent-src/templates/scripts/work_engine/stack/runner.ts` — the quality
  commands at `:1110-1143`, plus `go vet ./...` (`:382`) and `cargo clippy`
  (`:388`). The module header names the resolver as the single authority
  (`touched_file_quality.ts:14-19`).
- The one test that ties them is
  `tests/scripts/touched_file_quality.test.ts:335-350`: it checks a
  **hand-copied list of five strings** for substring presence in the resolver's
  source. It does not read the table, so a row added to `SCOPED_FORMS` is not
  checked; it does not run the resolver, so a resolver command with no row and
  no recorded reason for having none is not seen. The table and the list are
  two copies of one fact.
- `npx tsc --noEmit` is absent from `SCOPED_FORMS` on purpose and therefore
  always `skipped: unscoped` (`touched_file_quality.ts:121-124`).
- The shadow reading,
  `agents/evidence/analysis/touched-file-quality-readings-2026-Q4.md` § 5
  (`:153-189`), found both soundness defects with probes:
  - § 5(a) (`:169-178`): this repository's ESLint config ignores `agents/**`
    (`eslint.config.js:28`). A file under it is recorded `exit_code: 0`,
    `skipped: null` — "the exact shape of a passing check" — while the tool's
    own output says "File ignored because of a matching ignore pattern". No
    skip reason covers "ran, but the tool declined to look".
  - § 5(b) (`:180-189`): a real type error in a linted path recorded
    `exit_code: 0`, because the only tool that catches it is never run.
- The default flip is the owner blocker
  `touched-file-quality-default-is-an-owner-call` in
  `agents/roadmaps/later/road-to-touched-files-that-pass-their-own-tools-carried.md:49-78`.
  Its recommendation (`:59-72`) is "keep it `off` for now and fix the two
  soundness findings first". That roadmap holds one step — the flip (`:32-45`)
  — and none for the findings.
- The shipped default is `touched_file_quality: "off"`
  (`src/config/agent-settings.template.yml:1520`).
- `docs/CLAIMS.md` carries no claim for touched-file quality; nothing
  pre-registers what a flip would have to show.

## Phase 1 — An ignored file is not a pass

- [ ] **1.1 A red fixture first.** A test runs the eslint row over one file
      under a path the fixture's own ESLint config ignores, with an injected
      spawn that returns exit 0 and the tool's ignored-file line in its output.
      It asserts the recorded row is NOT `exit_code: 0, skipped: null`. Shown
      red against the current module before 1.2 lands.
      verify: `npx vitest run tests/scripts/touched_file_quality_ignored.test.ts` -> 0
- [ ] **1.2 The ignored-file signal is read, per tool.** For each `SCOPED_FORMS`
      row whose tool reports ignored inputs in its output, the row's spec names
      that signal. A run whose matched files were all ignored is recorded as a
      verdict about nothing — `exit_code: null` with the ignored files listed —
      and a run where only some were ignored keeps its exit code and lists the
      ignored ones beside it. The representation reuses an existing field shape
      (D2): a fifth skip reason is added only if the 1.1 test cannot be made
      green without one, and the record says which was chosen and why.
      verify: `npx vitest run tests/scripts/touched_file_quality_ignored.test.ts tests/scripts/touched_file_quality.test.ts` -> 0
- [ ] **1.3 The advisory line says it.** `advisoryLine` names ignored files
      separately from verdicts, so a stop where every touched file was ignored
      emits no line that reads as clean.
      verify: `npx vitest run tests/scripts/touched_file_quality_ignored.test.ts` -> 0

## Phase 2 — A green row names what did not run

- [ ] **2.1 The record carries the unscoped type checker.** When the resolver
      emits a type-check command that has no scoped form, each record of that
      turn carries one field naming it as not run on this turn, so a reader of
      any single row sees that a `0` was a lint verdict and not a type verdict.
      The fixture is a resolver list of `npx tsc --noEmit` plus `npx eslint .`
      over one `.ts` file.
      verify: `npx vitest run tests/scripts/touched_file_quality_unscoped_typecheck.test.ts` -> 0
- [ ] **2.2 The evidence page points at the fix.** One dated line under § 5 of
      the 2026-Q4 readings page names the two fields and the commits that added
      them. The page's findings are not rewritten.
      verify: `grep -c 'road-to-touched-file-quality-that-says-when-it-did-not-look' agents/evidence/analysis/touched-file-quality-readings-2026-Q4.md` -> /^[1-9]/

## Phase 3 — The table and the resolver cannot drift apart

- [ ] **3.1 Parity, read from both sides.** The module exports the keys of
      `SCOPED_FORMS` and `MUTATING_WITHOUT_CHECK_FORM` and one named list of
      resolver commands that are unscoped on purpose. A test drives
      `resolve_toolchain()` over fixture roots that make it emit every command
      it can, and asserts: every table key is a command the resolver emitted;
      every emitted command is a table key, a mutating key, or on the
      unscoped-on-purpose list. The hand-copied five-string list at
      `touched_file_quality.test.ts:348` is deleted.
      verify: `npx vitest run tests/scripts/touched_file_quality_parity.test.ts` -> 0
- [ ] **3.2 Seen red in both directions.** Renaming one resolver command (for
      example `'npx eslint .'` at `runner.ts:1132`) in a scratch copy fails the
      test, and adding a resolver command with no row and no list entry fails
      it too. Both sabotages are recorded in the commit message and reverted by
      editing the file back, not by checking it out.
      verify: `npx vitest run tests/scripts/touched_file_quality_parity.test.ts` -> 0

## Phase 4 — The flip bar is written before it is read

- [ ] **4.1 Pre-register the `shadow → warn` bar.** One claim in
      `docs/CLAIMS.md` states, before any further reading: the corpus (live
      stops, not replayed merged commits), the minimum sample, the advisory
      rate and the latency ceiling a `warn` default must meet, and that Phases
      1–2 must have shipped first. It names the owner blocker as the only place
      the flip is decided. Then `./scripts-run src/scripts/build_proof` runs in
      the same change.
      verify: `grep -c '^### claim: touched-file-quality-shadow-to-warn-bar' docs/CLAIMS.md` -> /^1$/
- [ ] **4.2 The owner blocker is told, not answered.** One dated line under
      the carried roadmap's blocker names this roadmap and the claim id. Its
      `Status`, `Recommendation` and step are not edited.
      verify: `grep -c 'touched-file-quality-shadow-to-warn-bar' agents/roadmaps/later/road-to-touched-files-that-pass-their-own-tools-carried.md` -> /^[1-9]/

## What this roadmap deliberately does not do

- No default flip. `src/config/agent-settings.template.yml:1520` is not touched;
  the owner blocker in the carried roadmap decides it.
- No fifth skip reason unless 1.2 proves it necessary. A reviewer of this round
  asked that the taxonomy not be inflated, and four reasons plus an
  ignored-files field may be enough.
- No blocking. tfq stays a shadow instrument; nothing here makes a turn fail.
- No per-file type checking. The unscoped type checker is named, not scoped.

## Acceptance Criteria

- [ ] AC-1 — A file the tool ignored never produces a record with
      `exit_code: 0` and `skipped: null`.
- [ ] AC-2 — Every record of a turn on which an emitted type-check command did
      not run names that command.
- [ ] AC-3 — Changing a resolver command string, or adding one with no table
      row and no unscoped-on-purpose entry, fails a test.
- [ ] AC-4 — `docs/CLAIMS.md` carries the flip bar, dated before any reading
      against it, and the shipped default is unchanged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Detect "ignored" from the tool's own output signal, per row | § 5(a) of the readings page: the tool states it in words while exiting 0 | A tool emits no ignored-file signal at all |
| D2 | reversible-technical | agent | Prefer a field over a fifth skip reason | The module documents `no_files` as an additive fourth reason (`touched_file_quality.ts:61-68`); a reviewer constraint against taxonomy growth | 1.1 cannot go green without a new reason |
| D3 | deterministic | evidence | Parity is asserted by running the resolver, not by substring | The current test checks a copied list against source text (`touched_file_quality.test.ts:348`) | The resolver becomes a static table itself |
| D4 | product-owned | owner | The flip stays with the carried blocker; this file only pre-registers its bar | The carried blocker's own recommendation and Rule 3 it cites | The owner resolves that blocker |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Ignored-file signals are tool- and version-specific | implementation | A tool that rewords its message would silently fall back to the passing shape. | The signal is per-row in the spec, and the 1.1 fixture pins the exact line; an unmatched case keeps today's behaviour rather than inventing a verdict. | Phase 1 — An ignored file is not a pass |
| 2 | A new record field breaks a reader of `quality_runs[]` | implementation | The verification classifier and the advisory line read the record. | Fields are additive; the existing two-array separation test stays green in 1.2. | Phase 2 — A green row names what did not run |
| 3 | The parity fixture cannot make the resolver emit every command | implementation | Some commands depend on files or dependency names a fixture must fake. | 3.1 builds one fixture root per stack; a command no fixture reaches is listed in the test with its reason. | Phase 3 — The table and the resolver cannot drift apart |
| 4 | A pre-registered bar reads as a decision to flip | product | A written bar can be mistaken for a commitment. | 4.1 names the owner blocker as the only place the flip is decided, and 4.2 edits none of its fields. | Phase 4 — The flip bar is written before it is read |
