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
    do.md                              ← new entrypoint (name decision below)
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

- [ ] **Step 1:** Present numbered options to the user with recommendation: `/do` (lean — shortest, neutral, covers code/UI/refactor) vs. `/work` (close second) vs. `/execute` (formal) vs. `/build` (UI-leaning) vs. `/implement` (rejected — too code-zentrisch per ChatGPT pushback).
- [ ] **Step 2:** Lock the chosen name. Update this roadmap, all subsequent steps, and the `do.md` filename if changed.
- [ ] **Step 3:** Verify name does not collide with existing slash commands in `.agent-src.uncompressed/commands/`.

## Phase 2: Prompt resolver and input envelope

- [ ] **Step 1:** Implement `scripts/work_engine/resolvers/prompt.py` — wraps a raw user prompt as `input.kind="prompt"`, `input.data.raw=<text>`, `input.data.reconstructed_ac=[]` (filled in Phase 3).
- [ ] **Step 2:** Add `prompt` to allowed `input.kind` values in schema v1. Migration from R1 unchanged (no version bump — additive).
- [ ] **Step 3:** Wire dispatcher: `input.kind="prompt"` is now a valid path. Default `intent="backend-coding"`, default `directive_set="backend"`.
- [ ] **Step 4:** Tests: prompt envelope round-trips through state, dispatcher accepts `prompt` kind, schema rejects truncated payloads.

## Phase 3: `refine-prompt` skill and confidence scoring

> The mechanism that prevents prompt-driven execution from becoming noisy.

- [ ] **Step 1:** Author `.agent-src.uncompressed/skills/refine-prompt/SKILL.md`. Procedure: read prompt → extract goal → enumerate explicit constraints → infer reasonable assumptions → generate AC list → score confidence per rubric.
- [ ] **Step 2:** Implement `scripts/work_engine/scoring/confidence.py`. Scoring rubric (each dimension 0–2):
  - **Goal clarity** — is the desired outcome unambiguous?
  - **Scope boundary** — are touched files/modules identifiable from the prompt?
  - **Acceptance evidence** — does the prompt name observable post-conditions?
  - **Stack/data implications** — are stack changes, schema changes, or data migrations implied? (penalty if implied + unspecified)
  - **Reversibility** — would a wrong reconstruction be cheaply rollback-able?

  Score = sum / 10. Bands: `high ≥ 0.8`, `medium 0.5–0.79`, `low < 0.5`.
- [ ] **Step 3:** Define band actions in the dispatcher:
  - **`high`** → proceed silently into plan-apply-test-review. Reconstructed AC + assumptions logged in delivery report.
  - **`medium`** → proceed with **assumptions report** halt: engine emits the reconstructed AC and the explicit assumptions, asks user to confirm/edit before continuing. One halt, one round-trip, then continues.
  - **`low`** → hard halt with **one** clarifying question (per `ask-when-uncertain` Iron Law). Engine refuses to plan until the question is answered.
- [ ] **Step 4:** Tests: 6 prompt fixtures across the band spectrum (2 high, 2 medium, 2 low). Each fixture asserts band assignment, dispatcher action, and halt format.

## Phase 4: New entrypoint command

- [ ] **Step 1:** Author `.agent-src.uncompressed/commands/do.md` (or chosen name) — thin wrapper, mirrors `/implement-ticket` shape but resolves a prompt instead of a ticket. Numbered-options for the prompt source: type now / paste from clipboard / load from file.
- [ ] **Step 2:** Wire to `work_engine`: command builds `input.kind="prompt"` envelope, calls `python3 -m work_engine`. Engine handles refine → score → dispatch.
- [ ] **Step 3:** Update `.agent-src.uncompressed/skills/command-routing/SKILL.md` — register the new command, route prompts and prompt-shaped intents to it.
- [ ] **Step 4:** Verify `ask-when-uncertain` integrates cleanly — the band-action low-confidence halt MUST emit a single numbered-options question, not a stack.

## Phase 5: Golden Compatibility Tests (R1 contract preserved)

> R1's golden harness MUST stay green. R2 adds prompt-flow goldens on top.

- [ ] **Step 1:** Re-run R1 GT-1..GT-5 against the post-R2 engine. Zero regressions allowed.
- [ ] **Step 2:** Add prompt-flow goldens:
  - **GT-P1 — high-confidence happy path:** clear prompt → high band → silent proceed → tests pass → delivery report
  - **GT-P2 — medium-confidence assumptions halt:** ambiguous-but-tractable prompt → medium band → assumptions report halt → user confirms → continues
  - **GT-P3 — low-confidence one-question halt:** vague prompt → low band → single clarifying question → user answers → re-score → continues
  - **GT-P4 — UI-intent rejection:** prompt implying UI work → engine rejects with R3 pointer (until R3 lands)
- [ ] **Step 3:** Wire GT-P1..GT-P4 into `task ci`. R1 + R2 goldens are now both required.
- [ ] **Step 4:** Document confidence-band contract in `agents/contexts/implement-ticket-flow.md` — what triggers each band, what the user sees, how to refresh band thresholds.

## Phase 6: Verification and docs

- [ ] **Step 1:** `task sync && task generate-tools && task ci` — green end-to-end including R1 + R2 goldens.
- [ ] **Step 2:** Update `README.md` and `AGENTS.md` — document the new entrypoint, confidence bands, and when to choose `/implement-ticket` vs. the new command.
- [ ] **Step 3:** ADR `agents/contexts/adr-prompt-driven-execution.md` — rationale, confidence rubric, band-action mapping, naming decision, deferred-to-R3 boundary.
- [ ] **Step 4:** Changelog entry under "Unreleased" — new command, new skill, no impact on `/implement-ticket`.

## Acceptance criteria

- [ ] New command (name locked in Phase 1) accepts a free-form prompt and runs the full killer loop
- [ ] `refine-prompt` skill produces reconstructed AC + assumptions + confidence score for any prompt
- [ ] Confidence rubric is implemented in `scoring/confidence.py` with the 5 dimensions and band thresholds documented above
- [ ] Band-action mapping is enforced: high → silent, medium → assumptions report halt, low → one-question halt
- [ ] All R1 goldens (GT-1..GT-5) still pass; R2 goldens (GT-P1..GT-P4) added and passing
- [ ] UI-intent prompts are rejected with a clear R3 pointer
- [ ] `/implement-ticket` behavior unchanged from R1
- [ ] `task ci` exits 0; ADR + changelog in place

## Open decisions

- **Command name** — `/do` (lean) vs. `/work` vs. `/execute` vs. `/build`. Locked in Phase 1.
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
