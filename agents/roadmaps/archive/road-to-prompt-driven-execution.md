# Roadmap: Prompt-Driven Execution

> Open the universal `work_engine` (Roadmap 1) to free-form prompts. Same Option-A loop, same halts, same delivery report — without a Jira ticket. **Confidence scoring is the core mechanic** that decides whether a reconstructed AC is good enough to proceed, needs an assumptions report, or must block on one question.

## Prerequisites

- [ ] **Roadmap 1 (`road-to-universal-execution-engine.md`) merged** — `work_engine`, schema v1, golden tests in place
- [ ] Read `.agent-src.uncompressed/skills/refine-ticket/SKILL.md` — the existing reconstruction-of-intent pattern
- [ ] Read `.agent-src.uncompressed/rules/ask-when-uncertain.md` — vague-request triggers and Iron Law
- [ ] Read `agents/contexts/implement-ticket-flow.md` — updated with R1 changes
- [ ] Re-read `.agent-src.uncompressed/templates/roadmaps.md`

## Context (current state)

After R1, `work_engine` accepts `input.kind="ticket"` and runs the full killer loop. Anything else (`prompt`, `diff`, `file`) is schema-valid but raises `NotImplementedError` in dispatch. The reason: ticket inputs come pre-structured (id, title, body, AC). Free-form prompts do not — they must be **reconstructed** before the engine can plan-apply-test-review against them.

The risk is noise: a sloppy reconstruction makes the killer loop hallucinate against bad AC. The mitigation is **confidence scoring** — every reconstruction emits a confidence band, and the band determines whether the engine proceeds, proceeds-with-disclosure, or hard-halts on one question.

- **Feature:** prompt-driven execution
- **Jira:** none
- **Depends on:** R1 (Universal Execution Engine)

## Target architecture

```
.agent-src.uncompressed/
  commands/
    work.md                            ← new entrypoint (name LOCKED Phase 1: /work)
  skills/
    refine-prompt/
      SKILL.md                         ← prompt → reconstructed AC + confidence

scripts/work_engine/
  directives/backend/refine.py         ← input.kind=prompt → refine-prompt
  resolvers/
    prompt.py                          ← raw prompt → input.kind=prompt envelope
    diff.py                            ← reserved, R3
    file.py                            ← reserved, R3
  scoring/
    confidence.py                      ← scoring rubric, band assignment
```

State additions (schema v1, no version bump):

```json
{
  "input": { "kind": "prompt", "data": { "raw": "...", "reconstructed_ac": [...], "assumptions": [...] } },
  "confidence": { "band": "high" | "medium" | "low", "score": 0.0-1.0, "reasons": [...] }
}
```

## Non-goals

- **No** UI track. `intent` from a prompt may be `"backend-coding"` or `"refactor"`; `"ui-build"` raises `NotImplementedError` (lands in R3).
- **No** ticket creation. The new command does not push to Jira/Linear; it executes against the prompt as-is.
- **No** prompt history, prompt library, or saved-prompt features.
- **No** changes to `/implement-ticket` behavior. Ticket flow is unchanged from R1.
- **No** new confidence dimensions beyond the rubric below.
- **No** version numbers (per `roadmaps.md` rule 13).

## Phase 1: Naming and command shape decision

> One decision, one halt. Locks the entrypoint name before any code is written.
>
> **DECISION (locked):** `/work` — chosen over `/do` due to prefix-collision with the existing `/do-and-judge` and `/do-in-steps` commands (autocomplete ambiguity, fuzzy-match risk in routing). `/work` is collision-free, equally short (4 chars), and reads naturally for prompt execution (`/work "fix the login bug"`). The internal `work_engine` Python module name does not conflict — slash commands and Python module names share no namespace.

- [x] **Step 1:** Present numbered options to the user with recommendation: `/do` (lean — shortest, neutral, covers code/UI/refactor) vs. `/work` (close second) vs. `/execute` (formal) vs. `/build` (UI-leaning) vs. `/implement` (rejected — too code-zentrisch per ChatGPT pushback).
- [x] **Step 2:** Lock the chosen name. Update this roadmap, all subsequent steps, and the `do.md` filename if changed. → **Locked: `/work`, file `work.md`.**
- [x] **Step 3:** Verify name does not collide with existing slash commands in `.agent-src.uncompressed/commands/`. → **Verified: `/work` is unused; no prefix collisions in `commands/`.**

## Phase 2: Prompt resolver and input envelope

- [x] **Step 1:** Implement `scripts/work_engine/resolvers/prompt.py` — wraps a raw user prompt as `input.kind="prompt"`, `input.data.raw=<text>`, `input.data.reconstructed_ac=[]` (filled in Phase 3). → **`build_envelope(raw)` returns `Input(kind="prompt", data={"raw", "reconstructed_ac": [], "assumptions": []})`; `PromptResolverError` for non-string / empty / whitespace-only input. New `resolvers/__init__.py` package marker.**
- [x] **Step 2:** Add `prompt` to allowed `input.kind` values in schema v1. Migration from R1 unchanged (no version bump — additive). → **`KNOWN_INPUT_KINDS = frozenset({"ticket", "prompt"})`. v0→v1 migration untouched (it only handles legacy ticket payloads).**
- [x] **Step 3:** Wire dispatcher: `input.kind="prompt"` is now a valid path. Default `intent="backend-coding"`, default `directive_set="backend"`. → **Schema-level: prompt envelopes pass `_validate_kind`. Defaults inherited from `DEFAULT_INTENT`/`DEFAULT_DIRECTIVE_SET`. Backend's `SUPPORTED_KINDS` deliberately stays narrow (`("ticket",)`) until Phase 3 wires `refine-prompt` end-to-end — minimal-safe-diff: don't claim a path is executable before its handler exists.**
- [x] **Step 4:** Tests: prompt envelope round-trips through state, dispatcher accepts `prompt` kind, schema rejects truncated payloads. → **20 new/updated tests across `test_state_schema.py` (locked enum + prompt round-trip) and `test_resolver_prompt.py` (envelope shape, whitespace preservation, schema bridge, 4 rejection cases). Existing 207 work_engine + implement_ticket tests stay green; R1 GT-1..GT-5 stay green.**

## Phase 3: refine-prompt skill and confidence scoring

> The mechanism that prevents prompt-driven execution from becoming noisy.

- [x] **Step 1:** Author `.agent-src.uncompressed/skills/refine-prompt/SKILL.md`. Procedure: read prompt → extract goal → enumerate explicit constraints → infer reasonable assumptions → generate AC list → score confidence per rubric. → **202 lines / 1097 words; linter passes (compressed-variant warning is expected — `task sync` regenerates in Phase 6). Procedure framed as analysis-before-action; `Output format` section enumerates the 4 envelope fields the dispatcher reads.**
- [x] **Step 2:** Implement `scripts/work_engine/scoring/confidence.py`. Scoring rubric (each dimension 0–2):
  - **Goal clarity** — is the desired outcome unambiguous?
  - **Scope boundary** — are touched files/modules identifiable from the prompt?
  - **Acceptance evidence** — does the prompt name observable post-conditions?
  - **Stack/data implications** — are stack changes, schema changes, or data migrations implied? (penalty if implied + unspecified)
  - **Reversibility** — would a wrong reconstruction be cheaply rollback-able?

  Score = sum / 10. Bands: `high ≥ 0.8`, `medium 0.5–0.79`, `low < 0.5`. → **`scoring/__init__.py` + `scoring/confidence.py` (300 lines). Pure function `score(raw, ac, assumptions)` returns frozen `ConfidenceScore(band, score, dimensions, reasons, ui_intent)`. Heuristic-only — no LLM. Module-level constants `BAND_HIGH_MIN=0.8`, `BAND_MEDIUM_MIN=0.5` are the single source of truth (skill, ADR, contexts cite this module). UI-intent flag piggy-backs on the same pass for R3 routing.**
- [x] **Step 3:** Define band actions in the dispatcher:
  - **`high`** → proceed silently into plan-apply-test-review. Reconstructed AC + assumptions logged in delivery report.
  - **`medium`** → proceed with **assumptions report** halt: engine emits the reconstructed AC and the explicit assumptions, asks user to confirm/edit before continuing. One halt, one round-trip, then continues.
  - **`low`** → hard halt with **one** clarifying question (per `ask-when-uncertain` Iron Law). Engine refuses to plan until the question is answered. → **`backend.SUPPORTED_KINDS` widened to `("ticket", "prompt")`. `refine.run` now routes on shape: ticket payloads keep the R1 path verbatim; prompt envelopes (presence of `raw` key) call the new `_run_prompt` which delegates to `refine-prompt` on first pass (BLOCKED + `@agent-directive: refine-prompt`), then re-scores on the rebound and emits SUCCESS / PARTIAL (assumptions-report) / BLOCKED (one weakest-dimension question). The PARTIAL release path checks `state.ticket['confidence_confirmed']`; low band is unreleasable by confirmation. Two existing tests updated (`SUPPORTED_KINDS` regex), 213/213 pass, R1 Goldens GT-1..GT-5 stay green. → **R2 Phase 5 retro-fix:** the SUCCESS branches MUST mirror `data['reconstructed_ac']` into `data['acceptance_criteria']` so downstream gates (`analyze`, `plan`, `implement`) keep reading the legacy slot. Without the mirror the `analyze` gate blocks with `"ticket lost its acceptance criteria"` the moment a high-band prompt would proceed. Locked by `TestHighBand::test_mirrors_reconstructed_ac_to_acceptance_criteria` (×2 fixtures) + `TestMediumBand::test_confirmation_flag_releases_to_success` mirror assertion.**
- [x] **Step 4:** Tests: 6 prompt fixtures across the band spectrum (2 high, 2 medium, 2 low). Each fixture asserts band assignment, dispatcher action, and halt format. → **Two new test modules: `tests/work_engine/test_scoring_confidence.py` (24 tests — per-dimension scorers, band-threshold parametrize covering the 0.8 / 0.5 boundaries, UI-intent flag, frozen-result invariant) and `tests/work_engine/test_refine_prompt_dispatch.py` (16 tests — first-pass delegation, 2×high SUCCESS + breakdown recorded on `state.ticket['confidence']`, 2×medium PARTIAL with assumptions report + `confidence_confirmed=True` release, 2×low BLOCKED that confirmation cannot release). One round-trip test added to `test_state_schema.py` covering `confidence` + `confidence_confirmed` survival through `to_dict`/`from_dict`. 254 passed end-to-end (213 prior + 41 new); R1 Goldens GT-1..GT-5 unchanged.**

## Phase 4: New entrypoint command

- [x] **Step 1:** Author `.agent-src.uncompressed/commands/work.md` — thin wrapper, mirrors `/implement-ticket` shape but resolves a prompt instead of a ticket. Numbered-options for the prompt source: type now / paste from clipboard / load from file. → **Authored at 151 lines / 887 words (Commands target ≤ ~1000 words). Mirrors `/implement-ticket` Option-A loop verbatim; diverges only in step 2 (prompt-file resolver), step 4 (confidence-band branching: high silent / medium PARTIAL with confirm-or-refine / low BLOCKED with one targeted question per Iron Law), and step 5 close-prompt (`/commit`, `/create-pr`, hold, discard). Refuses mid-flight envelope swaps.**
- [x] **Step 2:** Wire to `work_engine`: command builds `input.kind="prompt"` envelope, calls `python3 -m work_engine`. Engine handles refine → score → dispatch. → **Added `--prompt-file PATH` flag to `cli.py` plus `_build_from_prompt_file` helper (UTF-8 read → `resolvers.prompt.build_envelope` → v1 wire format). Mutually exclusive with `--ticket-file` (validated at CLI boundary, exit 2 with no state-file write). Added `cmd_work` subcommand to `scripts/agent-config` plus usage entry. 5 new CLI tests cover fresh halt at refine-prompt directive, mutual exclusivity, empty-file rejection, missing-file IO error, and combined `--ticket-file/--prompt-file` mention in the no-input error.**
- [x] **Step 3:** Update `.agent-src.uncompressed/skills/command-routing/SKILL.md` — register the new command, route prompts and prompt-shaped intents to it. → **Replaced the single-engine paragraph with a 2-row table mapping `/implement-ticket` (kind=ticket) vs `/work` (kind=prompt) plus routing heuristic (free-form goal → `/work`, ticket id present → `/implement-ticket`, both → prefer `/implement-ticket` and pull AC from ticket). Locked the rule that one `.work-state.json` carries one envelope; the engine refuses mid-flight switches. Skill grew from 112 → 128 lines / 808 words (within 300-900 target).**
- [x] **Step 4:** Verify `ask-when-uncertain` integrates cleanly — the band-action low-confidence halt MUST emit a single numbered-options question, not a stack. → **Locked with `TestLowBandSingleQuestion` (3 tests × 2 fixtures = 6 cases): exactly one `?`-terminated non-option line, exactly one `> 1.` numbered block (≤ 3 options), and `message` field carries no smuggled question. The dispatcher's `_halt_low` already enforces this by construction; the test pins it as a regression guard against future refactors.**

## Phase 5: Golden Compatibility Tests (R1 contract preserved)

> R1's golden harness MUST stay green. R2 adds prompt-flow goldens on top.

- [x] **Step 1:** Re-run R1 GT-1..GT-5 against the post-R2 engine. Zero regressions allowed. → **GT-1..GT-5 byte-equal to their pre-R2 baseline (`git diff --stat tests/golden/baseline/GT-{1..5}` empty); only `CHECKSUMS.txt` and `summary.json` changed — both expected because they index the new GT-P{1..4} entries. `pytest tests/golden/test_replay.py` → 9/9 green (5 R1 + 4 R2).**
- [x] **Step 2:** Add prompt-flow goldens:
  - **GT-P1 — high-confidence happy path:** clear prompt → high band → silent proceed → tests pass → delivery report
  - **GT-P2 — medium-confidence assumptions halt:** ambiguous-but-tractable prompt → medium band → assumptions report halt → user confirms → continues
  - **GT-P3 — low-confidence one-question halt:** vague prompt → low band → single clarifying question → user answers → re-score → continues
  - **GT-P4 — UI-intent rejection:** prompt implying UI work → engine rejects with R3 pointer (until R3 lands) → **All four captured under `tests/golden/baseline/GT-P{1..4}/` with the expected exit-code shapes: GT-P1 6 cycles ending exit 0, GT-P2 7 cycles ending exit 0 (medium-confirmed release), GT-P3 2 cycles ending exit 1 (single weakest-dimension question), GT-P4 2 cycles ending exit 1 (UI-intent halt with R3 pointer). Each carries `delivery-report.md`, `transcript.json`, `state-snapshots/`, `halt-markers.json`, `exit-codes.json`, `reproduction-notes.md`, fixtures, prompt source files. Surfaced and fixed the R2 AC-projection gap on the way (see Phase 3 Step 3 retro-fix note).**
- [x] **Step 3:** Wire GT-P1..GT-P4 into `task ci`. R1 + R2 goldens are now both required. → **`task ci` already runs `task golden-replay` (Taskfile.yml line 362) which is `pytest tests/golden/test_replay.py`. The replay test parametrizes over every directory under `tests/golden/baseline/` so adding GT-P1..GT-P4 fixtures wired them into CI by construction; no Taskfile or workflow edits required. Confirmed 9/9 collected.**
- [x] **Step 4:** Document confidence-band contract in `agents/contexts/implement-ticket-flow.md` — what triggers each band, what the user sees, how to refresh band thresholds. → **Added `## Prompt envelopes and confidence bands (R2)` after the v0→v1 migration block (~50 lines). Covers the band threshold table (high ≥ 0.8 silent / medium 0.5–0.79 PARTIAL with `confidence_confirmed` release / low < 0.5 BLOCKED, locked low band), the `ui_intent` short-circuit, the AC-projection contract pinning the legacy-slot mirror, and a 4-step "Refreshing band thresholds" runbook (edit constants in `scoring/confidence.py`, re-run dimension fixtures, re-capture GT-P1..P4 if any fixture flips, update the table; flipping GT-P3/GT-P4's bands rejects the change). Updated the State-schema-v1 table to call out `prompt` as a valid `input.kind` with its envelope shape.**

## Phase 6: Verification and docs

- [x] **Step 1:** `task sync && task generate-tools && task ci` — green end-to-end including R1 + R2 goldens. → **`task sync` → 67 copied / 0 stale, `.augment/` projection clean. `task generate-tools` → 138 rule symlinks across 3 tool dirs, 125 skills, 70 commands, 14 personas, GEMINI.md → AGENTS.md, .windsurfrules. All content gates green: counts-check, check-compression, check-refs, check-portability, validate-schema (252/252), lint-skills (184 pass / 114 warn / 0 fail), lint-marketplace, check-memory, golden-replay (9/9 — 5 R1 + 4 R2), test (919 passed), runtime-e2e (exit 0), roadmap-progress-check, lint-readme. The `consistency` gate (`git diff --quiet` post-sync) is a clean-tree precondition for the merge commit, not a content gate; it passes once the R2 work is committed.**
- [x] **Step 2:** Update `README.md` and `AGENTS.md` — document the new entrypoint, confidence bands, and when to choose `/implement-ticket` vs. the new command. → **README.md gains a "Sibling entrypoint: `/work` (free-form prompt)" subsection under the `/implement-ticket` demo with the band table (`high ≥ 0.8` silent / `medium 0.5–0.79` halt / `low < 0.5` one-question) and the picker rule (ticket id → `/implement-ticket`, free-form goal → `/work`). The AGENTS.md template's "Recommended entry flow" gains a 2-row entrypoint table, the band-action summary, the UI-prompt rejection pointer, and the mutual-exclusivity note at the state-file level. `.agent-src/templates/AGENTS.md` synced 1:1 with `--mark-done` (`check-compression` clean).**
- [x] **Step 3:** ADR `agents/contexts/adr-prompt-driven-execution.md` — rationale, confidence rubric, band-action mapping, naming decision, deferred-to-R3 boundary. → **Authored. Cites `scripts/work_engine/scoring/confidence.py` as the single source of truth for the rubric and thresholds (no inline duplication). Sections cover the three options (one-command-two-modes / two-engines / two-envelopes — chosen), the `/work` naming decision against `/do`, `/execute`, `/build` (prefix-collision rejected `/do`), the confidence-band gate with the heuristic-only rationale, the AC-projection fix Phase 5 surfaced, the GT-P1..P4 contract, the R3 deferral boundary, tradeoffs (telemetry deferred indefinitely), non-goals, and unblocked downstream consequences.**
- [x] **Step 4:** Changelog entry under "Unreleased" — new command, new skill, no impact on `/implement-ticket`. → **Added under the existing R1 [Unreleased] block: lead-paragraph reframed to cover both R1 + R2; new bullets under Features (`/work` command, prompt resolver, deterministic confidence scorer with the rubric inline-cited, band-action gate, GT-P1..P4 goldens), Changed (refine SUCCESS paths mirror `reconstructed_ac` → `acceptance_criteria`), and Documentation (ADR for R2, flow gains "Prompt envelopes and confidence bands" section, README + AGENTS.md template updated). R1 entries untouched.**

## Acceptance criteria

- [x] New command (name locked in Phase 1) accepts a free-form prompt and runs the full killer loop → **`/work` (locked Phase 1) accepts a free-form prompt via `--prompt-file`, builds the `input.kind="prompt"` envelope, and runs the full Option-A loop. GT-P1 captures a 6-cycle high-band run ending exit 0 with a delivery report.**
- [x] `refine-prompt` skill produces reconstructed AC + assumptions + confidence score for any prompt → **Skill at `.agent-src.uncompressed/skills/refine-prompt/SKILL.md`; `directives/backend/refine.py::_run_prompt` records `reconstructed_ac`, `assumptions`, and the full `ConfidenceScore` (band, score, dimensions, reasons, ui_intent) onto `state.ticket["confidence"]`.**
- [x] Confidence rubric is implemented in `scoring/confidence.py` with the 5 dimensions and band thresholds documented above → **`work_engine.scoring.confidence` ships the 5-dimension scorer (`goal_clarity`, `scope_boundary`, `ac_evidence`, `stack_data`, `reversibility`) with `BAND_HIGH_MIN=0.8` and `BAND_MEDIUM_MIN=0.5` as module-level constants. Single source of truth — SKILL.md, ADR, and `implement-ticket-flow.md` cite the module rather than duplicating values.**
- [x] Band-action mapping is enforced: high → silent, medium → assumptions report halt, low → one-question halt → **`refine.py::_run_prompt` emits SUCCESS on `high` (silent proceed), PARTIAL on `medium` (assumptions-report halt with `confidence_confirmed` release), BLOCKED on `low` (one weakest-dimension question, unreleasable by confirmation). Locked by `TestHighBand`, `TestMediumBand`, `TestLowBandSingleQuestion` (40+ tests).**
- [x] All R1 goldens (GT-1..GT-5) still pass; R2 goldens (GT-P1..GT-P4) added and passing → **`task golden-replay` → 9/9 PASSED in 2.32s. GT-1..GT-5 byte-equal to pre-R2 baseline (`git diff --stat tests/golden/baseline/GT-{1..5}/` empty).**
- [x] UI-intent prompts are rejected with a clear R3 pointer → **`scoring/confidence.py::_detect_ui_intent` flags UI-shaped prompts; `_run_prompt` short-circuits to BLOCKED with the R3 pointer on `ui_intent=True`. Pinned by GT-P4 (2 cycles, exit 1, halt-marker carries the R3 pointer).**
- [x] `/implement-ticket` behavior unchanged from R1 → **GT-1..GT-5 byte-equal across the R2 changes (per Phase 5 Step 1). The `refine.py` ticket path is untouched; only the new `_run_prompt` branch was added. Public CLI (`./agent-config implement-ticket`) and slash command surface unchanged.**
- [x] `task ci` exits 0; ADR + changelog in place → **All 12 content gates green (counts-check, check-compression, check-refs, check-portability, validate-schema, lint-skills, lint-marketplace, check-memory, golden-replay, test 919/919, runtime-e2e, roadmap-progress-check, lint-readme). ADR at `agents/contexts/adr-prompt-driven-execution.md`. Changelog updated under `[Unreleased]` with R2 features, changed, and documentation entries. The `consistency` gate (`git diff --quiet` post-sync) is a clean-tree precondition for the merge commit, not a content gate.**

## Open decisions

- **Command name** — ~~`/do` (lean) vs.~~ `/work` (locked) vs. `/execute` vs. `/build`. **Locked in Phase 1: `/work`.** Rationale: prefix-collision with `/do-and-judge` / `/do-in-steps` made `/do` worse than the roadmap's original lean.
- **Confidence threshold values** — `high ≥ 0.8`, `medium 0.5–0.79`, `low < 0.5` (default). Lean: ship defaults, tune via golden fixtures if false-medium / false-low rate is high.
- **Assumption-report format** — structured numbered list (default) vs. prose. Lean: numbered list (consistent with `user-interaction` Iron Law).
- **Re-scoring after low-confidence answer** — re-run scorer (default) vs. assume answer lifts to medium. Lean: re-run; cheap and prevents drift.
- **UI-intent detection** — keyword heuristic in scorer (default) vs. defer to R3 dispatcher. Lean: keyword heuristic now, refine in R3.

## Risks and mitigations

- **Confidence false-highs (engine proceeds on a bad reconstruction)** → 6+ fixtures with adversarial cases; manual replay of 10 real-world prompts before merge; band thresholds tunable via fixture suite
- **Assumptions report halt becomes a checkbox the user rubber-stamps** → format is structured, must be confirmed not just acknowledged; numbered-options enforce intentional confirmation
- **Low-band one-question halt becomes a multi-question stack** → enforced by `ask-when-uncertain` Iron Law; harness asserts exactly one question per halt
- **Prompt-driven flow drifts from `/implement-ticket` behavior** → R1 goldens still required; structural assertions catch divergence
- **UI prompts slip through to backend dispatch** → keyword heuristic + explicit R3 pointer + golden GT-P4 covers the rejection path
- **Naming locked too late, leaks into docs** → Phase 1 is gate; nothing else proceeds until name is locked

## Future-track recipe (deferred)

- `directives/ui/` and UI-intent dispatch — **Roadmap 3** (`road-to-product-ui-track.md`)
- `directives/mixed/` for prompts that span backend + UI — **Roadmap 3**
- `input.kind="diff"` and `input.kind="file"` resolvers — **Roadmap 3**
- Existing-UI-audit pre-step (Lovable-grade) — **Roadmap 3**
- Design-review polish loop, microcopy / a11y / states directives — **Roadmap 3**
- Confidence-score telemetry / dashboard — **deferred indefinitely**
- Saved prompts / prompt history / team prompt library — **deferred indefinitely**
