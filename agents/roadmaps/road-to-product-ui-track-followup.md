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
| Stack-dispatch fixture mechanism | `directives/ui/apply.py` reads `state.stack.frontend` via `STACK_DIRECTIVES` map (`blade-livewire-flux` / `react-shadcn` / `vue` / `plain`); detector at `stack/detect.py` reads `composer.json` + `package.json` from fixture root. Fixture diff = manifest swap; harness already supports per-scenario fixture roots | `templates/scripts/work_engine/directives/ui/apply.py:41-56`, `:101-108`; `templates/scripts/work_engine/stack/detect.py:1-50` |
| Trivial-path halt count | `ui_trivial/apply.py` emits exactly 1 halt on first pass (`@agent-directive: trivial-apply`), succeeds on rebound when envelope passes preconditions (≤ 1 file, ≤ 5 lines, no new component/state/dep) | `templates/scripts/work_engine/directives/ui_trivial/apply.py:36-70` |
| Reclassification primitive | `ui_trivial/apply.py:_halt_reclassify` emits `@agent-directive: reclassify-to-ui-improve` when any precondition is violated; orchestrator promotes `state.directive_set='ui-improve'` and re-enters audit gate | `templates/scripts/work_engine/directives/ui_trivial/apply.py:14-18`, `:65-67` |

## Phase 1: Recipe scaffolding and shared helpers

- [ ] **Trivial-edit fixture variant** — extend `tests/golden/sandbox/recipes/_helpers.py` to expose a `seed_trivial_envelope(state, *, files, lines_changed, ...)` builder mirroring the audit / design helpers used by GT-U2. Keeps GT-U7 / GT-U8 recipes deterministic (no fs probing inside the recipe)
- [ ] **Stack manifest fixtures** — add two minimal fixture roots under `tests/golden/sandbox/fixtures/`: `stack-blade/` (`composer.json` with `livewire/livewire`+`livewire/flux`) and `stack-react/` (`package.json` with `react`+`@radix-ui/*`+`components.json`). Each ≤ 200 bytes per manifest; no source files
- [ ] **Mixed contract seed** — extend helpers with `seed_contract(state, *, data_model, api_surface, confirmed=False)` so GT-U5 can pin both pre- and post-confirmation halts in one recipe via cycle progression

## Phase 2: GT-U5 — mixed orchestration golden

- [ ] **Prompt** — `prompts/gt-u5-mixed-flow.txt`: "Add a customer feedback form: POST /api/feedback persists to a `feedbacks` table, render the form on `/feedback` with a success state." Triggers `directive_set='mixed'` (backend signal: `POST /api`, `table` · UI signal: `render the form`, `success state`)
- [ ] **Recipe** — `gt_u5_mixed_flow.py`: cycle progression (a) `contract-plan` halt → seed `data_model`+`api_surface` (b) `contract sign-off` halt → seed `contract_confirmed=True` (c) ui sub-track: `existing-ui-audit` → `ui-design-brief` → `ui-apply-<stack>` → `ui-review` → `ui-polish` (d) `integration-test` halt → seed `state.stitch.verdict='success'` (e) verify → SUCCESS
- [ ] **Halt budget pinned:** 7 halts (2 contract + 5 ui+stitch) for `plain` stack baseline; 8 cycles total. Replay assertion checks each cycle's directive matches the recipe table in order
- [ ] **Baseline directory** — `tests/golden/baseline/GT-U5/` with `transcript.json` · `halt-markers.json` · `exit-codes.json` · `state-snapshots/` · `delivery-report.md` · `fixture/` (manifest only)
- [ ] **summary.json entry** — `{ "gt_id": "GT-U5", "subcommand": "work", "prompt_file": "prompts/gt-u5-mixed-flow.txt", "persona": null, "final_outcome": "success", "final_exit_code": 0, "cycles": [...] }`

## Phase 3: GT-U6 — stack dispatch golden

- [ ] **Prompt** — `prompts/gt-u6-stack-dispatch.txt` (shared across both fixtures): "Add an empty-state component to the dashboard sidebar." Stack-agnostic phrasing; only the manifest tells the engine which apply skill to dispatch
- [ ] **Two recipes** — `gt_u6a_stack_blade.py` (fixture `stack-blade/`, expects `ui-apply-blade-livewire-flux` directive) and `gt_u6b_stack_react.py` (fixture `stack-react/`, expects `ui-apply-react-shadcn` directive). Both halt at apply on cycle 1; recipes seed minimal apply envelopes on cycle 2 to land on SUCCESS without exercising the stack-specific skills (the *dispatch decision* is what we pin, not the implementation output)
- [ ] **Two baselines** — `GT-U6-blade/` and `GT-U6-react/`. Replay test parametrizes over both
- [ ] **Replay assertion** — compares the `directive` field on cycle 1 of each baseline. The `ui-apply-<stack>` directive must differ between the two; everything else (audit, design, review, polish) is identical → diff is small and load-bearing
- [ ] **summary.json entries** — two rows; `gt_id` carries the suffix (`GT-U6-blade` · `GT-U6-react`)

## Phase 4: GT-U7 — trivial happy path golden

- [ ] **Prompt** — `prompts/gt-u7-trivial-happy.txt`: "Change the primary button color from blue to brand-red in `resources/views/components/button.blade.php`." Single-file, single-line edit; refine-prompt scores high; classifier returns `directive_set='ui-trivial'`
- [ ] **Recipe** — `gt_u7_trivial_happy.py`: cycle 1 emits `@agent-directive: trivial-apply` (BLOCKED); cycle 2 seeds `state.ticket['trivial_edit'] = {files: ['resources/views/components/button.blade.php'], lines_changed: 1, new_components: [], new_state: [], new_deps: []}` → preconditions pass → SUCCESS
- [ ] **Halt budget pinned:** 1 halt, 2 cycles total. No audit, no design, no review, no polish
- [ ] **Baseline directory** — `tests/golden/baseline/GT-U7/` (standard layout)
- [ ] **summary.json entry** — `final_outcome: "success"`, 2 cycles

## Phase 5: GT-U8 — trivial reclassification golden

- [ ] **Prompt** — `prompts/gt-u8-trivial-reclassification.txt`: "Make the Save button red." Refine-prompt scores high → classifier picks `ui-trivial` (looks like a 1-line color tweak), but the apply envelope reveals a 2-file edit
- [ ] **Recipe** — `gt_u8_trivial_reclassification.py`: cycle 1 `trivial-apply` halt → cycle 2 seeds envelope with `files: ['button.blade.php', 'theme.css'], lines_changed: 2` (violates `MAX_FILES`) → `_halt_reclassify` emits `@agent-directive: reclassify-to-ui-improve` (BLOCKED) → cycle 3 orchestrator promotes `state.directive_set='ui-improve'` and re-enters at audit → cycles 4–7 run the full ui-improve sub-track (audit, design, apply, review) → cycle 8 SUCCESS
- [ ] **Halt budget pinned:** 1 trivial-apply + 1 reclassification + 4 ui-improve halts = 6 halts, 7 cycles. The reclassification halt is the load-bearing observation; ui-improve halts are already pinned by R3 GT-U1
- [ ] **Baseline directory** — `tests/golden/baseline/GT-U8/`
- [ ] **summary.json entry** — `final_outcome: "success"`, 7 cycles

## Phase 6: Capture, wire-up, and verification

- [ ] **Capture all four** — `python3 -m tests.golden.capture --scenarios GT-U5,GT-U6-blade,GT-U6-react,GT-U7,GT-U8` produces 5 baseline directories (GT-U6 splits into two)
- [ ] **Update `summary.json`** — five new entries; total goes from 17 → 22 baselines (or 21 if GT-U6 is treated as one parametrized entry)
- [ ] **CHECKSUMS** — `tests/golden/capture.py:_write_checksums` regenerates the manifest; commit the file alongside the baselines
- [ ] **Replay green** — `pytest tests/golden/test_replay.py` exits 0 with all five new baselines included; no diff against the captured transcripts
- [ ] **`task ci` green** — full pipeline (sync, sync-hashes, counts, refs, lint-skills, lint-readme, test, check-portability) exits 0
- [ ] **Drop the "deferred" note from `agents/contexts/ui-track-flow.md`** — the four contracts are now pinned; remove the parenthetical pointing at this roadmap and replace with the GT-U5..U8 list

## Acceptance criteria

- [ ] **AC #1 — Mixed flow pinned:** GT-U5 captures contract → ui sub-track → stitch in 8 cycles, replay byte-equal
- [ ] **AC #2 — Stack dispatch pinned:** GT-U6-blade and GT-U6-react share prompt, differ only on the cycle-1 `ui-apply-<stack>` directive, replay byte-equal for both
- [ ] **AC #3 — Trivial happy pinned:** GT-U7 captures the 2-cycle short-circuit (trivial-apply → SUCCESS), no audit/design/review/polish in transcript
- [ ] **AC #4 — Trivial reclassification pinned:** GT-U8 captures the 1+1+4 halt sequence with `state.directive_set` flipping from `ui-trivial` to `ui-improve` on cycle 3
- [ ] **AC #5 — `task ci` green** with all five new baselines wired into the harness and CHECKSUMS regenerated
- [ ] **AC #6 — Context updated:** `ui-track-flow.md` no longer points at this roadmap as "deferred"; the four contracts are listed as pinned with their GT-id

## Risks

- **Refine-prompt classifier drift on GT-U8** — the prompt "Make the Save button red" must score high-confidence and route to `ui-trivial`. If `refine-prompt` returns medium-confidence and adds an assumptions halt, the recipe budget changes by 1. Mitigation: recipe seeds `state.refine.confidence='high'` deterministically (same pattern as GT-U11)
- **Stack detector mtime caching** — the detector caches the result on `state.stack` keyed by manifest mtime. Capture in CI may have constant mtime and replay may differ; if so, the `mtime` field is excluded from `state-snapshots/` like other volatile fields. Verify on first capture; add to harness ignore-list if needed
- **GT-U6 baseline naming convention** — `summary.json` schema validator may not accept hyphenated suffixes (`GT-U6-blade`). Fallback: rename to `GT-U6A` / `GT-U6B`. Decide on first capture run

## Notes

R3 Phase 6 deliberately scoped these out as "verify-then-pin"; archaeology has shown the engine is already correct. Capture is mechanical from here.
