# Roadmap: Product UI Track — Follow-up Goldens (R3.1)

> **Status: stub — not started.** Follow-up to R3 (`road-to-product-ui-track.md`) covering the four UI goldens deliberately deferred from R3 Phase 6 because their engine primitives need verification before goldens can pin them. Anchored on the dashboard so the gap is visible.

## Mission

Lock the four orthogonal UI-track contracts that R3 Phase 6 deliberately scoped out:

- **Mixed orchestration** (backend + UI in one prompt → contract → ui → stitch)
- **Stack dispatch** (same prompt → blade-livewire-flux vs. react-shadcn → different apply skills)
- **Trivial path** (`ui-trivial` directive set, single-file ≤5-line micro-edits)
- **Trivial reclassification** (apply detects the edit is bigger than declared, escalates to `ui-improve`)

Each scenario was deferred from R3 because it touches a contract whose engine implementation has not been verified end-to-end. Capturing goldens before the contract is real risks pinning behavior that is not the intended behavior.

## Prerequisites

- [x] **Roadmap 3 (`road-to-product-ui-track.md`) GT-U1..U4 + GT-U9..U12 landed** — the foundation goldens are green and the `seed_state` runner hook is available
- [ ] **Roadmap 3 merged** — this roadmap extends R3's golden suite; merging R3 first keeps the arc clean
- [ ] R1, R2, R3 goldens green
- [ ] Engine primitives verified (see Open decisions)

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

## Phase 0: Stub — build trigger and contract

> Single placeholder phase so this roadmap appears on the dashboard arc. Expand into full phase breakdown only when R3 merges and the engine primitives below are verified.

- [ ] **Build trigger:** R3 merged AND each Open decision below resolved with a code-citation file:line confirming the primitive exists. Do not start capture before both hold.

## Acceptance preview (authoritative shape, not full list)

- [ ] **GT-U5 (mixed flow):** prompt implying backend + UI → `directive_set` resolves to `mixed` → contract halt → ui track → stitch halt → delivery report. Halt budget: 2 (contract + stitch); design/audit halts inside the ui sub-track count separately and are pinned via R3 GT-U1 already.
- [ ] **GT-U6 (stack dispatch):** identical prompt against (a) blade-livewire-flux fixture and (b) react-shadcn fixture → dispatcher routes to different apply skills. Two baseline directories: `GT-U6-blade/` and `GT-U6-react/`; replay assertion compares dispatch decision, not full transcript.
- [ ] **GT-U7 (trivial happy):** prompt "make the Save button red" → `directive_set` resolves to `ui-trivial` → single apply halt → one-line delivery. Halt budget: 1 (apply confirmation, if any) or 0 (auto-apply); resolved on build-start by reading `directives/ui-trivial/apply.py`.
- [ ] **GT-U8 (trivial reclassification):** prompt that *looks* trivial but apply detects 2-file edit → reclassification halt → user accepts → engine restarts as `ui-improve` → audit gate engages. Halt budget: 1 reclassification halt + the standard `ui-improve` budget (audit + design = 2).

## Open decisions (resolved at build-start)

- **Mixed-flow contract halt shape** — read `directives/mixed/contract.py` end-to-end; cite file:line for the halt emit-point. If contract halt is missing, GT-U5 escalates from "capture golden" to "implement contract halt then capture".
- **Stack-dispatch fixture mechanism** — current capture harness is single-fixture per scenario. GT-U6 needs either (a) two scenarios with different fixtures, or (b) parametrized fixtures inside one scenario. Lean: (a), simpler diff against existing harness.
- **Trivial-path halt count** — does `directives/ui-trivial/apply.py` halt for confirmation, or auto-apply? Read source, decide GT-U7 budget.
- **Reclassification primitive existence** — does `apply.py` (any directive set) detect "edit larger than declared" and emit a reclassification halt? If no, GT-U8 escalates to "implement reclassification primitive then capture".

## Risks

- **Engine primitive missing** — for any scenario whose Open decision resolves to "primitive does not exist", the scenario splits into a 2-step item: implement primitive (with its own ADR if it's load-bearing), then capture. R3.1 phase budget grows accordingly.
- **Stack-dispatch fixture explosion** — adding a second stack fixture per scenario doubles capture time and CHECKSUMS surface. Mitigation: single shared prompt, two minimal fixture diffs.
- **Reclassification corner-cases** — GT-U8 must not flake on edit-detection heuristics that are timing- or fs-dependent. Recipe must seed the apply detector deterministically (same pattern as GT-U11/U12 use `seed_state`).

## Notes for the builder

This stub exists to anchor the dashboard arc and lock the *identity* of R3.1 (verify-then-pin the four orthogonal contracts that R3 Phase 6 scoped out). The actual phase breakdown lands at build-start. Do not expand this file until R3 ships — premature expansion is the failure mode this stub explicitly guards against, mirroring R4's stub policy.
