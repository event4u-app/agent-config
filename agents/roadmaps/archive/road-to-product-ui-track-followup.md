# Roadmap: Product UI Track — Follow-up Goldens (R3.1)

> **Status: phase-planned `2026-05-01` after build-start trigger satisfied.** Follow-up to R3 (`road-to-product-ui-track.md`) covering the four UI goldens deliberately deferred from R3 Phase 6 because their engine primitives needed verification before goldens could pin them. Engine archaeology pass `2026-05-01` confirmed all four primitives exist — see [§ Open decisions resolved](#open-decisions-resolved). Capture work is mechanical from here; no engine implementation needed.

## Mission

Lock the four orthogonal UI-track contracts that R3 Phase 6 deliberately scoped out:

- **Mixed orchestration** (backend + UI in one prompt → contract → ui → stitch)
- **Stack dispatch** (same prompt → blade-livewire-flux vs. react-shadcn → different apply skills)
- **Trivial path** (`ui-trivial` directive set, single-file ≤5-line micro-edits)
- **Trivial reclassification** (apply detects the edit is bigger than declared, escalates to `ui-improve`)

Each scenario was deferred from R3 because it touches a contract whose engine implementation has not been verified end-to-end. Capturing goldens before the contract is real risks pinning behavior that is not the intended behavior.

## Prerequisites

- [x] **Roadmap 3 (`road-to-product-ui-track.md`) GT-U1..U4 + GT-U9..U12 landed** — the foundation goldens are green and the `seed_state` runner hook is available
- [x] **Roadmap 3 archived** — `agents/roadmaps/archive/road-to-product-ui-track.md` (`2026-05-01`); this roadmap extends R3's golden suite, the arc is clean
- [x] R1, R2, R3 goldens green — `task test` `2026-05-01` = 1637 passed in 12.95s; `tests/golden/test_replay.py` covers all 17 baselines
- [x] Engine primitives verified — file:line citations in [§ Open decisions resolved](#open-decisions-resolved)

## Context

R3 Phase 6 was meant to lock the **existing** UI-track contract via 12 golden transcripts. 8 of 12 captured cleanly (GT-U1..U4, GT-U9..U12). The remaining 4 (GT-U5..U8) cover contracts whose runtime behavior I have not verified by reading the engine end-to-end:

- `directives/mixed/contract.py` and `directives/mixed/stitch.py` — exist as files; goldens for GT-U5 require a fixture that exercises a backend+UI prompt and pins the contract→stitch halts. I have not traced this path.
- `directives/ui/apply.py` stack-detection — used in `apply.py` to dispatch to `blade-ui` / `livewire` / `flux` / `react-shadcn-ui`. GT-U6 needs two parallel fixtures with different stack signals; current capture pipeline is single-fixture.
- `directives/ui-trivial/apply.py` — exists as a directive set; GT-U7 needs to verify the dispatcher routes `ui-trivial` to a single apply step (no audit, no design, no review, no polish) and produces a one-line delivery report.
- Trivial reclassification — GT-U8 requires apply to *detect* a >5-line / >1-file edit and emit a reclassification halt. Whether `apply.py` actually does this today (vs. just refusing or proceeding) is unknown.

R3.1 is the place to verify each primitive, then capture the goldens. Trying to do both inside R3 Phase 6 would have either blocked R3's merge or pinned wrong behavior.

- **Feature:** complete the UI-track golden coverage
- **Jira:** none
- **Depends on:** R3

## Non-goals

- **No** new UI directive sets — R3.1 only verifies and pins what R3 declared
- **No** stack additions (Vue, Svelte, etc.) beyond what R3 ships — that lives in `agents/contexts/ui-stack-extension.md` (R3 Phase 7)
- **No** rewrite of trivial-path semantics — only verification + golden capture

## Open decisions resolved

Engine archaeology pass `2026-05-01` confirmed every primitive these goldens depend on is already implemented. No engine implementation work in R3.1 — pure capture.

| Decision | Resolution | Evidence |
|---|---|---|
| Mixed-flow contract halt shape | Contract step emits up to 3 halts: `contract-plan` (first pass), missing-keys halt, sign-off halt with `contract_confirmed` sentinel | `templates/scripts/work_engine/directives/mixed/contract.py:1-31`, `:43-54` (`REQUIRED_CONTRACT_KEYS`) |
| Mixed stitch halt shape | After mixed.ui success, stitch emits `integration-test` directive on first pass; verdict `blocked`/`partial` halts with 3 options unless `integration_confirmed=True` | `templates/scripts/work_engine/directives/mixed/stitch.py:1-34`, `:47-50` |
| Stack-dispatch fixture mechanism | `directives/ui/apply.py` reads `state.stack.frontend`; detector at `stack/detect.py` reads `composer.json` + `package.json` from workspace, but the toy repo (`tests/golden/sandbox/repo/`) has neither so detector returns `plain`. Recipes inject `state.stack` via `seed_state` — same pattern GT-U11 uses. No physical fixture diff required | `templates/scripts/work_engine/directives/ui/apply.py:41-56`; `tests/golden/sandbox/runner.py:113-123`; `tests/golden/sandbox/recipes/gt_u11_high_confidence.py:53-138` |
| Trivial-path halt count | `ui_trivial/apply.py` emits 1 halt (`trivial-apply` directive) on first pass; `ui_trivial/test.py` emits a second halt (`run-tests scope=smoke`) on its first pass. Total: **2 halts, 3 cycles** for the happy path | `templates/scripts/work_engine/directives/ui_trivial/apply.py:113-126`; `templates/scripts/work_engine/directives/ui_trivial/test.py:113-128` |
| Reclassification primitive | `ui_trivial/apply.py:_halt_reclassify` emits `@agent-directive: reclassify-to-ui-improve` on precondition violation, sets `state.ticket["__reclassify_to__"]="ui-improve"`, and pops `trivial_edit`. Recipe handler reads the sentinel and promotes `state.directive_set` for the next cycle | `templates/scripts/work_engine/directives/ui_trivial/apply.py:129-148` |

## Phase 1: Recipe scaffolding and shared helpers

- [x] **Prompt files** — create `tests/golden/sandbox/prompts/gt-u5-mixed-flow.txt`, `gt-u6-stack-dispatch.txt` (shared across both stack recipes), `gt-u7-trivial-happy.txt`, `gt-u8-trivial-reclassification.txt`. Stack-agnostic phrasing for GT-U6; only the recipe's `seed_state` distinguishes blade vs. react
- [x] **Trivial-envelope helper** — extend `tests/golden/sandbox/recipes/_helpers.py` with `trivial_envelope(*, files, lines_changed, summary, new_component=False, new_state=False, new_dependency=False)` returning the envelope shape `ui_trivial/apply.py` reads. Singular keys (`new_component` etc.) match `apply.py:103-108`
- [x] **Stack-seed helper** — extend helpers with `stack_state(*, frontend, php_framework=None)` returning a minimal `state.stack` dict: `{"frontend": "blade-livewire-flux", "php_framework": "laravel"}` or `{"frontend": "react-shadcn", "php_framework": null}`. GT-U6 recipes inject this directly via `seed_state`
- [x] **Mixed-contract seed helper** — extend helpers with `mixed_contract(*, data_model, api_surface, confirmed=False)` so GT-U5 can pin both pre- and post-confirmation halts in one recipe

## Phase 2: GT-U5 — mixed orchestration golden

- [x] **Prompt** — `prompts/gt-u5-mixed-flow.txt`: "Add a customer feedback form: POST /api/feedback persists to a `feedbacks` table, render the form on `/feedback` with a success state." Triggers `directive_set='mixed'` (backend signal: `POST /api`, `table` · UI signal: `render the form`, `success state`)
- [x] **Recipe** — `gt_u5_mixed_flow.py`: 6-cycle sequence (`contract-plan` → `_no_directive` sign-off → `ui-track` → `integration-test` → `review-changes` → `report`). Seeds `data_model`+`api_surface`, then `contract_confirmed=True`, then `ui_review.review_clean=True`, then `stitch.integration_confirmed=True`
- [x] **Halt budget pinned:** 5 halts, 6 cycles, `final_outcome=success`. Replay assertion validates each cycle's directive matches the recipe in order
- [x] **Baseline directory** — `tests/golden/baseline/GT-U5/` with `transcript.json` · `halt-markers.json` · `exit-codes.json` · `state-snapshots/` · `delivery-report.md` · `fixture/` (manifest only)
- [x] **summary.json entry** — locked via `tests/golden/CHECKSUMS.txt`

## Phase 3: GT-U6 — stack dispatch golden

- [x] **Prompt** — `prompts/gt-u6-stack-dispatch.txt` (shared across both recipes): "Add an empty-state component to the dashboard sidebar." Stack-agnostic phrasing; recipes inject the stack via `seed_state` (no manifest fixtures needed — toy repo has none, detector returns `plain` by default)
- [x] **Two recipes** — `gt_u6a_stack_blade.py` (frontend=blade-livewire-flux, dispatches `ui-apply-blade-livewire-flux`) and `gt_u6b_stack_react.py` (frontend=react-shadcn, dispatches `ui-apply-react-shadcn`). Both seed audit (`audit_path=high_confidence`) + complete design (layout, components, states, microcopy, a11y) so cycle 1 lands directly at the stack-specific apply halt; cycle 2 SUCCESS
- [x] **Two baselines** — `GT-U6A/` and `GT-U6B/`
- [x] **Replay assertion** — apply-halt directive differs between baselines: `ui-apply-blade-livewire-flux` vs. `ui-apply-react-shadcn`. Verified via halt-markers.json
- [x] **summary.json entries** — `GT-U6A` (blade) and `GT-U6B` (react) both point at `prompts/gt-u6-stack-dispatch.txt`

## Phase 4: GT-U7 — trivial happy path golden

- [x] **Prompt** — `prompts/gt-u7-trivial-happy.txt`: "Change the primary button color from blue to brand-red in `resources/views/components/button.blade.php`." Single-file, single-line edit; recipe pre-seeds `state.directive_set='ui-trivial'` + `state.intent='ui-trivial'` to bypass classifier
- [x] **Recipe** — `gt_u7_trivial_happy.py`: cycle 1 `trivial-apply` BLOCKED → seed `trivial_edit` envelope; cycle 2 apply rebound succeeds, `run-tests scope=smoke` BLOCKED → seed smoke verdict; cycle 3 SUCCESS via report
- [x] **Halt budget pinned:** 2 halts (`trivial-apply`, `run-tests`), 3 cycles total
- [x] **Baseline directory** — `tests/golden/baseline/GT-U7/` (standard layout)
- [x] **summary.json entry** — `final_outcome: "success"`, 3 cycles, 2 halts

## Phase 5: GT-U8 — trivial reclassification golden

- [x] **Prompt** — `prompts/gt-u8-trivial-reclassification.txt`: "Make the Save button red across the app." Recipe pre-seeds `state.directive_set='ui-trivial'`; envelope reveals a multi-file edit that violates `MAX_FILES=1`
- [x] **Recipe** — `gt_u8_trivial_reclassification.py`: cycle 1 `trivial-apply` BLOCKED → seed multi-file envelope → cycle 2 apply emits `@agent-directive: reclassify-to-ui-improve` BLOCKED → recipe handler promotes `state.directive_set='ui-improve'` → cycles 3+ run ui-improve sub-track to SUCCESS
- [x] **Halt budget pinned:** trivial-apply + reclassification + ui-improve halts; locked on first capture
- [x] **Baseline directory** — `tests/golden/baseline/GT-U8/`
- [x] **summary.json entry** — `final_outcome: "success"`, cycle count locked

## Phase 6: Capture, wire-up, and verification

- [x] **Capture all four** — `python3 -m tests.golden.capture --scenarios GT-U5 GT-U6A GT-U6B GT-U7 GT-U8` produces 5 baseline directories
- [x] **Update `summary.json`** — five new entries; total 17 → 22 baselines (verified by replay run count)
- [x] **CHECKSUMS** — `tests/golden/capture.py:_write_checksums` regenerated; manifest committed
- [x] **Replay green** — `pytest tests/golden/test_replay.py` exits 0 with 22 baselines passing
- [x] **`task ci` green** — full pipeline passes including consistency, replay, lint-skills, check-refs, check-portability
- [x] **Drop the "deferred" note from `agents/contexts/ui-track-flow.md`** — replaced with the GT-U5..U8 pinned list

## Acceptance criteria

- [x] **AC #1 — Mixed flow pinned:** GT-U5 captures contract → ui-track → stitch in 6 cycles, replay byte-equal
- [x] **AC #2 — Stack dispatch pinned:** GT-U6A (blade) and GT-U6B (react) share prompt, differ only on the apply-halt `ui-apply-<stack>` directive, replay byte-equal for both
- [x] **AC #3 — Trivial happy pinned:** GT-U7 captures the 3-cycle short-circuit (trivial-apply → smoke-tests → SUCCESS), no audit/design/review/polish in transcript
- [x] **AC #4 — Trivial reclassification pinned:** GT-U8 captures the trivial-apply → reclassify halt sequence with `state.directive_set` flipping from `ui-trivial` to `ui-improve`, then completes via the ui-improve sub-track
- [x] **AC #5 — `task ci` green** with all five new baselines wired into the harness and CHECKSUMS regenerated
- [x] **AC #6 — Context updated:** `ui-track-flow.md` no longer points at this roadmap as "deferred"; the four contracts are listed as pinned with their GT-id

## Risks

- **Classifier drift bypassed** — recipes pre-seed `state.directive_set` and `state.intent` (matches GT-U11's pattern). Classifier behaviour is pinned by unit tests in `tests/work_engine/test_intent_classifier.py`; this golden suite pins **dispatch behaviour given a directive_set**, not classification
- **Reclassification cycle-count drift on GT-U8** — the exact ui-improve halt count after reclassification depends on whether dispatcher re-enters at audit or skips to the first un-completed step. Mitigation: capture-first, then lock the count in the AC. If unstable across runs, recipe pre-seeds the audit + design state to fast-forward to apply (same approach R3 used)
- **Reclassify sentinel routing** — `__reclassify_to__` is read by `ui_trivial/apply.py:_halt_reclassify` but the orchestrator's promotion of `state.directive_set` happens via the recipe handler in the sandbox runner (no dispatcher hook). Verify on first GT-U8 capture; if the dispatcher needs a hook, that's an engine change scoped to a separate ticket — the recipe handles it explicitly meanwhile

## Notes

R3 Phase 6 deliberately scoped these out as "verify-then-pin"; archaeology has shown the engine is already correct. Capture is mechanical from here.
