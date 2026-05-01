# Roadmap: Visual Review Loop + A11y

> **Status: complete `2026-05-01`.** All phases done, 25/25 golden replays green, 1667 unit tests pass, skill linter / refs / portability clean. R3 archived (`agents/roadmaps/archive/road-to-product-ui-track.md`), R3.1 archived (`agents/roadmaps/archive/road-to-product-ui-track-followup.md`), tooling decisions locked — see [§ Open decisions resolved](#open-decisions-resolved).

## Mission

Add objective, machine-checkable polish to the UI track. R3's polish loop terminates after 2 rounds based on subjective findings; R4 introduces **visual preview** (headless-browser screenshots) and **accessibility tooling** (axe-core, pa11y) as the only objective signals in the engine, and **rewrites part of R3's polish-termination contract** so that no run ships with unresolved a11y violations regardless of the round counter.

A11y is the lever, not the screenshot. Code-review and visual-review are subjective; axe/pa11y findings are not. R4's identity is *"objective polish anchoring"*, not *"prettier UI"*.

## Prerequisites

- [x] **Roadmap 3 archived** — `agents/roadmaps/archive/road-to-product-ui-track.md` (`2026-05-01`); R4 modifies R3's polish contract, so R3 must be locked first
- [x] **Roadmap 3.1 archived** — `agents/roadmaps/archive/road-to-product-ui-track-followup.md` (`2026-05-01`); GT-U5..U8 pinned, mixed and stack contracts locked
- [x] R1, R2, R3, R3.1 goldens green — `tests/golden/test_replay.py` covers 22 baselines (`2026-05-01`)
- [x] **A11y tooling decision locked** — see [§ Open decisions resolved](#open-decisions-resolved)

## Context

After R3, the UI track produces components that match a design brief and respect existing tokens, but the polish loop's termination is a hard 2-round ceiling — it stops because we ran out of rounds, not because the UI is objectively done. Lovable solves this with screenshots + iteration; we want something stronger and more disciplined: **objective findings drive the loop, not subjective rounds**.

R4's two pillars:

- **Visual preview** — headless-browser render of the changed component(s), screenshot capture, baseline diff. Not pixel-perfect regression; presence + sanity check that nothing renders broken.
- **A11y tooling** — axe-core or pa11y wired into `directives/ui/review.py` and `polish.py`. Findings become first-class polish targets with automatic refactor (missing aria, contrast violations, keyboard-trap detection).

- **Feature:** objective polish anchoring for the UI track
- **Jira:** none
- **Depends on:** R3

## Non-goals

- **No** pixel-perfect visual-regression testing (deferred indefinitely per R3)
- **No** screenshot-to-code, Figma import (deferred indefinitely per R3)
- **No** UI-quality scoring / dashboard
- **No** removal of R3's 2-round ceiling — the ceiling stays as a *time* limit; a11y findings add a separate *correctness* limit that overrides termination

## Open decisions resolved

Locked `2026-05-01` from the leans declared in the original stub. The package itself ships no UI and no Playwright dependency — these decisions describe what the **engine contract** assumes consumer-project skills produce, not what this package installs.

| Decision | Resolution | Rationale |
|---|---|---|
| **Tooling choice** | **axe-core via Playwright** is the canonical producer; pa11y CLI is documented as the fallback for stacks where Playwright is not viable (e.g. server-only Blade with no JS bundle). The engine consumes a normalized findings shape; it does not shell out to either. | Both leans confirmed in the stub. axe-core has the richer rule set and integrates with Playwright (already a documented E2E skill). pa11y stays in the docs so consumers without a JS runtime are not stranded. |
| **Severity threshold** | **`moderate+` blocks polish termination**; `minor` violations land in findings as informational. Threshold lives in `state.ui_review.a11y.severity_floor` (default `"moderate"`, override per-project via `.agent-settings.yml`). | Original lean. Objective discipline only works if the bar is meaningful; minor a11y issues (e.g. landmark naming) are noise without context. |
| **Render target** | **Playwright** is the documented render target for the preview envelope. Puppeteer / native browser are out of scope. | Original lean. Playwright is already a documented E2E skill, the team has tooling, and axe-core integrates natively. |
| **Findings producer** | The stack-specific review skills (`ui-design-review-blade-livewire-flux`, `ui-design-review-react-shadcn`, …) extend their output schema with an `a11y` block. The engine reads `state.ui_review.a11y.violations` and `state.ui_review.preview` — no new directive type is added. | Reuses the existing dispatcher slot. New directives mean new validation paths, new goldens, more drift surface. |
| **Pre-existing violation handling** | Audit-time baseline: `state.ui_audit.a11y_baseline` records pre-existing violations on touched components. Polish gate compares findings against the baseline; only NEW or CHANGED violations block. | Without this, retrofitting axe-core onto a project with debt halts every UI run. The baseline is an opt-in field — absence means the gate sees all findings. |

## Phase 0: State-shape extension (engine layer)

- [x] **Extend `state.ui_review`** schema: optional `a11y` envelope (`violations`, `severity_floor`, `accepted_violations`) and `preview` envelope (`render_ok`, `screenshot_path`, `dom_dump_path`, `error`) — `_validate_ui_review` in `state.py:463-509`
- [x] **Extend `state.ui_audit`** schema: optional `a11y_baseline` list — `_validate_ui_audit` in `state.py:404-409`
- [x] **Extend `state.ui_polish`** schema: optional `extension_used` bool for the one-shot extension flag — `_validate_ui_polish` in `state.py:540-545`
- [x] **Validators are shape-only** — severity floor restricted to `{minor, moderate, serious, critical}`; content validation deferred to handlers
- [x] **`DeliveryState` round-trip** — `_to_delivery` / `_sync_back` already pass the three envelopes by reference; new sub-keys flow through transparently (no code change needed)
- [x] **Tests** — 12 new tests in `TestUiAuditA11yBaseline`, `TestUiReviewA11yEnvelope`, `TestUiReviewPreviewEnvelope`, `TestUiPolishExtensionUsed` — `tests/work_engine/test_state_schema.py`

## Phase 1: Review step — a11y gate integration

- [x] **Read** `state.ui_review.a11y.violations` after the existing `findings`/`review_clean` gates pass — `_apply_a11y_gate` in `directives/ui/review.py:251` filters against `state.ui_audit.a11y_baseline` when present
- [x] **Severity floor** — violations below `severity_floor` (default `moderate`) drop out via `_at_or_above_floor`; unknown severities default to `moderate` so a malformed envelope cannot weaken the gate
- [x] **Outcome** — actionable violations are synthesised as `{kind: "a11y_violation", rule, selector, severity}` findings via `_synthesize_a11y_findings` (deduped by `(rule, selector)`) and `review_clean` is forced to `False` engine-side
- [x] **New ambiguity** `review_a11y_pending` — declared in `AMBIGUITIES`; fires when `state.ui_audit.a11y_baseline` exists but `state.ui_review.a11y` is missing (opt-in via baseline; pre-R4 envelopes bypass)
- [x] **Tests** — 12 new tests in `tests/work_engine/test_step_review.py` covering pending-halt, baseline filter, severity floor, accepted-violations filter, synthesis, idempotency, and ordering with basic gates

## Phase 2: Polish termination contract amendment

- [x] **`POLISH_CEILING` stays at 2** — round count is the *time* limit. Effective ceiling becomes `POLISH_CEILING + 1` once `state.ui_polish.extension_used` is set; schema validator widens the upper bound from `[0, 2]` to `[0, 3]` only when the flag is `True` (`state.py:539-545`).
- [x] **New gate**: at `rounds == effective_ceiling` AND `findings` still contains `a11y_violation` entries → halt with `polish_a11y_blocking` ambiguity (`directives/ui/polish.py:_halt_a11y_blocking`). User picks: extend ceiling by one round (engine sets `extension_used=True`), accept-with-known-violations (engine appends to `state.ui_review.a11y.accepted_violations`), or abort. Once the extension is spent, the Extend option disappears.
- [x] **`polish_ceiling_reached` semantics narrow** — only fires when remaining findings are non-a11y (subjective polish); a11y blocks take precedence via the explicit branch in `polish.run()`.
- [x] **Idempotent re-entry**: a `state.ui_review.a11y.accepted_violations` list with rule ids matching the remaining a11y findings round-trips through `SUCCESS` because the review gate's `_apply_a11y_gate` filters accepted entries before synthesising `a11y_violation` findings (`directives/ui/review.py:263-271`).
- [x] **Tests** — 6 new tests in `tests/work_engine/test_step_polish.py` (a11y-blocking, precedence, subjective-only, extension grants round 3, exhausted extension drops Extend option, halt body lists findings) plus 3 schema tests in `tests/work_engine/test_state_schema.py` (rejects rounds=3 without extension, accepts rounds=3 with extension, rejects rounds=4 even with extension).

## Phase 3: Preview envelope — render contract (no engine render)

- [x] **Engine never renders** — Playwright integration lives in the stack-specific review skills. The engine reads `state.ui_review.preview` and validates shape only.
- [x] **`render_ok: False`** with `error` populated → halt with `preview_render_failed` ambiguity. User picks: retry, skip-preview-this-run (writes `state.ui_review.preview.skipped: true`), or abort.
- [x] **`render_ok: True`** with `screenshot_path` set → preview is captured as a delivery-report artifact (writes the path into the delivery report's `artifacts` list).
- [x] **Trivial path skips preview** — `directive_set == "ui-trivial"` does not consult `state.ui_review.preview` at all (matches the existing trivial fast-path: no audit, no design, no review, no polish).

## Phase 4: Goldens — pin the new contract

- [x] **GT-U13** — A11y findings drive polish loop: 1 actionable serious-severity violation, polish round 1 fixes it, review re-runs clean, ships at round 1. Recipe: `tests/golden/sandbox/recipes/gt_u13_a11y_polish.py`.
- [x] **GT-U14** — A11y blocks at ceiling: 2 actionable moderate-severity violations, polish round 1 fixes one, round 2 still has one → `polish_a11y_blocking` halt; user picks accept-with-known-violations → ships with `accepted_violations`. Recipe synthesises the leftover `a11y_violation` finding in the polish step (the dispatcher skips `review` after its first SUCCESS, so the polish skill carries the contract). Recipe: `tests/golden/sandbox/recipes/gt_u14_a11y_ceiling.py`.
- [x] **GT-U15** — Preview render failure: `state.ui_review.preview.render_ok = False` → `preview_render_failed` halt; user picks skip-preview → run completes without a screenshot artifact. The halt re-uses the review directive (skill retries the render); the recipe discriminates first-call vs Skip on `state.ui_review.preview`. Recipe: `tests/golden/sandbox/recipes/gt_u15_preview_fail.py`.
- [x] **GT-U4 (existing) extension** — implicit regression guard: byte-equal replay of GT-U4's existing transcript proves the narrowed `polish_ceiling_reached` semantics still fire on subjective (non-a11y) findings, so no recipe change is needed.
- [x] **Replay harness** — three recipes registered in `tests/golden/sandbox/runner.py::RECIPE_MODULES`; baseline count 22 → 25 (`task golden-tests` exits 0).

## Phase 5: Documentation + R3 contract amendments

- [x] **Update `agents/contexts/ui-track-flow.md`** — review/polish sections gain the a11y gate and preview envelope shapes; ambiguity catalog adds `review_a11y_pending`, `polish_a11y_blocking`, `preview_render_failed`.
- [x] **Update `agents/contexts/adr-product-ui-track.md`** — append an R4 amendment block citing the polish-termination rewrite (verbatim from this roadmap's Acceptance Criteria).
- [x] **Skill scaffolding hint** — `existing-ui-audit` SKILL.md gains an "a11y baseline" section pointing at `state.ui_audit.a11y_baseline`. Stack review skills (`react-shadcn-ui`, `blade-ui`, `flux`, `livewire`) gain an "a11y findings" output-shape section.
- [x] **No package-level Playwright dependency** — this package stays Python + Bash; Playwright is a consumer-project requirement when they wire the review skills.

## Phase 6: Capture, wire-up, and verification

- [x] **Capture** — `python3 -m tests.golden.capture --scenarios GT-U13 GT-U14 GT-U15` produces 3 baseline directories
- [x] **GT-U4 re-capture** — only if Phase 4 step 4 changes the existing transcript; else baseline stays byte-equal (baseline stayed byte-equal; no re-capture needed)
- [x] **Update `summary.json`** — three new entries; 22 → 25 baselines
- [x] **CHECKSUMS** regenerated; manifest committed
- [x] **Replay green** — `pytest tests/golden/test_replay.py` exits 0 with 25 baselines passing
- [x] **`task ci` green** — replay, lint-skills, check-refs, check-portability, lint-readme all pass; consistency check pending commit of WIP

## Acceptance criteria

- [x] **AC #1 — Objective polish anchoring:** Polish loop terminates when (a) `findings` is empty OR (b) `rounds == POLISH_CEILING` AND no `a11y_violation` entries remain at severity ≥ floor. Round 2 with remaining a11y findings halts via `polish_a11y_blocking`, not via `polish_ceiling_reached`.
- [x] **AC #2 — Preview envelope:** `state.ui_review.preview` shape validated by engine; `render_ok: False` halts via `preview_render_failed`; trivial path bypasses the envelope entirely.
- [x] **AC #3 — A11y baseline:** `state.ui_audit.a11y_baseline` is read by the review gate; only NEW/CHANGED violations are actionable. Pre-existing violations stay in findings as informational, never block polish.
- [x] **AC #4 — Goldens pinned:** GT-U13, GT-U14, GT-U15 captured and replay-byte-equal. GT-U4 still passes (regression guard).
- [x] **AC #5 — `task ci` green** with all three new baselines wired into the harness and CHECKSUMS regenerated.
- [x] **AC #6 — Contracts updated:** `ui-track-flow.md` and `adr-product-ui-track.md` reflect the new gates and the polish-termination rewrite.

## Risks

- **A11y tooling produces noise on existing components** — mitigated by `a11y_baseline`. If `existing-ui-audit` skills do not populate it, the gate sees all findings; Phase 5 step 3 documents this as a hard expectation for stack review skills.
- **Severity-floor disagreement** — projects on `serious+`-only mode lose the discipline R4 promises. Mitigation: the floor is a per-project setting, not a per-run flag; switching is a deliberate `.agent-settings.yml` edit, not a one-off override.
- **Polish loop infinite-extension drift** — the new "extend by one round" pick at `polish_a11y_blocking` is a one-shot per run, not a slider. State carries `state.ui_polish.extension_used: bool`; second extension halt offers only accept-or-abort.
- **Engine-rendered preview vs. skill-rendered preview** — the contract is engine reads, skill writes. Phase 3 step 1 is non-negotiable; engine never spawns a browser. Documented in `ui-track-flow.md`.
- **Trivial-path scope creep** — `directive_set == "ui-trivial"` MUST keep skipping the a11y gate. Phase 3 step 4 + GT-U13/14/15 explicitly do not run on trivial; existing GT-U7 covers the trivial happy path.

## Future-track recipe (deferred indefinitely)

- Visual-regression baselining with pixel diffs
- Screenshot-to-code generation
- Figma import / design-system sync
- UI-quality numeric scoring
- A11y rule customization beyond axe-core defaults (custom rule packs)
