---
complexity: structural
parent_roadmap: image-brand-typography
---

# Roadmap: greenfield scaffold + render-verified review (the Lovable lever)

> **Complexity:** structural (work-engine directive-set contract: new step, new
> state slice, a tightened review gate). Council-reviewed; the five trade-offs
> are resolved inline (*Locked decisions* + *Council notes*).
>
> Sibling of [`road-to-image-brand-typography.md`](road-to-image-brand-typography.md)
> — spawned per its council decision 2 (greenfield scaffold ships separately;
> brand-token + `mixed`-routing interface stubs land there, this roadmap
> consumes them, degrading gracefully if absent — acyclic, not circular).
> Frames against the work-engine UI directive pipeline
> ([`src/agent-src/templates/scripts/work_engine/directives/`](../../src/agent-src/templates/scripts/work_engine/directives/))
> and ADR-061's "real orchestration" principle.

## Goal

Add the Zero-to-One greenfield path the work-engine lacks — a first-stage
`scaffold` directive step and a render-verified `review` gate — so the package
produces Lovable-quality *new* apps inside a real repo under gates, without
crossing into hosting/preview/deploy (that stays in the IDE plugin, not a config
package).

## The boundary (do not cross)

Lovable is a hosted product (preview server, managed DB/auth, one-click deploy,
visual canvas). agent-config is a governance layer that makes a coding agent
produce that quality **in a real repo, under gates**. The "see-it-live" half
belongs to the IDE plugin / Claude Design — **not** this package. This roadmap
adds only what fits the package nature: a scaffold *step* and a *verification*
gate. No preview server, no managed DB, no deploy, no canvas. (Playwright runs
**headless in CI**, writes a screenshot artifact + `render_ok`, and exits — it
is a *testing tool*, never a user-facing preview surface.)

## Governing contract (carried from the work-engine)

```
THE ENGINE NEVER RENDERS, NEVER SCAFFOLDS, NEVER WRITES APP FILES.
THE ENGINE ORCHESTRATES + GATES. STACK-SPECIFIC SKILLS EXECUTE.
```

`review.py` already states "the engine never renders" — stack review skills
(Playwright + axe for `react-shadcn`, equivalent elsewhere) render and write
`state.ui_review.preview.render_ok`. The new `scaffold` step follows the same
contract: it produces a **stack-agnostic scaffold plan** + gates on a state
slice; the stack-specific scaffold skill creates the files.

## The three verified gaps (grounded in code)

1. **Greenfield has a decision but no execution step.**
   [`directives/ui/audit.py`](../../src/agent-src/templates/scripts/work_engine/directives/ui/audit.py)
   records `greenfield_decision ∈ {scaffold, bare, external_reference}` and sets
   `audit_path = "greenfield"`, but there is **no `scaffold.py`** — the decision
   only *colours* `apply`. The `ui/` step set is audit/design/apply/review/polish.
2. **The review loop is open.**
   [`directives/ui/review.py`](../../src/agent-src/templates/scripts/work_engine/directives/ui/review.py)
   gates on `state.ui_review.preview.render_ok`, but **missing `render_ok` is a
   no-op** (`review.py:411`) — a stack skill that never renders and just claims
   success passes the gate silently. Render evidence is not enforced.
3. **`mixed` is under-routed.** The `mixed` set
   ([`directives/mixed/`](../../src/agent-src/templates/scripts/work_engine/directives/mixed/)
   = contract/stitch/ui) does real full-stack-from-prompt, but routing into it is
   intent-driven; "build me a feature" prompts tend to land in `backend`.

## Locked decisions (council-resolved — do not relitigate)

1. **Render-gate is conditional, not absolute.** Missing `render_ok` halts
   **only** when the resolved stack is render-capable (has a rendering review
   skill) *and* a runner (Playwright) is available; non-rendering stacks/envs
   write an **explicit** `preview.skipped = true` + reason. The only behaviour
   that changes is *silent* no-op on absence — that is forbidden.
2. **`scaffold.py` is plan-only.** It emits a **stack-agnostic declarative slice**
   (e.g. `{pages, routes, layout_strategy, component_manifest, token_seed}`) into
   `state.ui_scaffold`; the stack skill transforms that into JSX/Blade/Vue files.
   The engine never writes app files. It is a *separate step* (not duplicate of
   `apply`) because today `apply.py` **inlines** the greenfield branch
   conditionally — factoring it out gives an explicit, **recoverable** state
   ("scaffolded but not designed"), so a failed scaffold is re-runnable without
   re-running feature application.
3. **App-spec is a lightweight confirm halt with an explicit bypass.** Not BDUF:
   it disambiguates the derived page-set/entity-model in one numbered-options
   halt (seconds), and the user can bypass it ("just scaffold") via the engine's
   existing fence idiom. Default = confirm; agility preserved by the bypass.
4. **One roadmap.** The render-gate is the independently-shippable Phase 1
   (small quick win); the scaffold step is Phases 2–3. Phase granularity gives
   the "quick win first" benefit without splitting the file.
5. **Brand dependency degrades gracefully.** Scaffold ships with **default
   tokens first**; it brand-seeds from `pack-brand`'s `.tokens.json` + voice
   profile **when present** (sibling roadmap Phase B). No hard gate on the
   sibling — acyclic dependency.

---

## Phase 1 — render-verified review gate (smallest; closes the open loop)

The "see-it → fix-it" loop made enforceable. Keep the engine-never-renders
contract; tighten only the gate (decision 1).

- [x] In `review.py`, change the `render_ok` *missing* branch: when the resolved
      stack is render-capable **and** a runner is available, missing `render_ok`
      becomes a **halt** (`preview_render_required`), not a no-op.
- [x] Add an explicit `Skip` path: a stack/env that cannot render writes
      `state.ui_review.preview.skipped = true` + reason; the gate honours an
      *explicit* skip but never an *implicit* absence.
- [x] Require stack review skills (`react-shadcn-ui`, `blade-ui`, …) to drive
      Playwright + axe, write `render_ok`, `screenshot_path`, `dom_dump_path`, and
      surface them as `report.run` delivery artifacts.
- [x] Tests: directive-engine test that missing `render_ok` on a render-capable
      stack halts; explicit `skipped` passes; `render_ok: false` halts (existing);
      non-render-capable stack with absent `render_ok` no-ops as before.
      <!-- carve-out: new-gate-verification -->

**Exit criteria:** `review` cannot pass on an unrendered claim for a
render-capable stack; render evidence is a delivery artifact or an explicit,
reasoned skip. Independently shippable.

---

## Phase 2 — app-spec grounding stage (prompt → spec, lightweight confirm)

The "real orchestration" before any scaffolding: derive the app shape and
confirm it fast before files are created (decision 3 — disambiguation, not BDUF).

- [x] New step/skill `app-spec` (Grounding + Method): prompt → derived page-set +
      entity model + flow-map. Records to a new state slice `state.app_spec`.
      Realised as the UI set's `memory` slot (was a no-op pass-through) +
      `directives/ui/app_spec.py`; delegates via `@agent-directive: app-spec`
      (a directive verb, no new SKILL.md — mirrors `ui-design-brief`).
- [x] Lightweight human-confirm halt (`app_spec_unconfirmed`) before scaffold —
      the user confirms/edits the derived page-set + entity model in one
      numbered-options halt. **Explicit bypass** ("just scaffold" →
      `app_spec.bypassed = true`) honoured per the engine's existing escape idiom.
- [x] Feeds the scaffold plan in Phase 3 (page-set → routes/layout shell; entity
      model → data-layer stubs). Gate is a no-op `SUCCESS` for every
      non-greenfield-scaffold flow, so existing UI / improve flows stay
      byte-identical (golden GT-U6A/U6B unaffected).

**Exit criteria:** greenfield runs derive and confirm (or explicitly bypass) an
app spec before any scaffold plan is produced.

---

## Phase 3 — `scaffold` directive step (the Zero-to-One core)

- [ ] New `directives/ui/scaffold.py`, gated on `audit.greenfield_decision ==
      "scaffold"`, sequenced **before** `design → apply`. Per decision 2 it
      produces a **stack-agnostic scaffold plan** into `state.ui_scaffold`
      (`{pages, routes, layout_strategy, component_manifest, token_seed}`); the
      engine writes no files.
- [ ] Register the step in the `ui` directive set ordering; greenfield
      `audit_path` flows audit → app-spec → scaffold → design → apply → review →
      polish. `bare` / `external_reference` decisions keep the current
      (no-scaffold) flow, unchanged.
- [ ] Stack scaffold skills (or extend `react-shadcn-ui` / `blade-ui` /
      `tailwind-engineer`): consume `state.ui_scaffold`, create the skeleton, write
      `state.ui_scaffold.scaffolded = true` + artifact paths. Recoverable: a failed
      scaffold re-runs from the scaffold step alone.
- [ ] Tests: greenfield+scaffold decision routes through `scaffold.py`;
      non-scaffold decisions skip it; engine writes no files itself; scaffold is
      re-runnable independent of `apply`. <!-- carve-out: new-gate-verification -->

**Exit criteria:** a greenfield `scaffold` decision raises a real skeleton via a
stack skill, gated by a confirmed (or bypassed) app-spec, before `design/apply`;
the state has an explicit "scaffolded but not designed" stage.

---

## Phase 4 — mixed-set routing + brand-coherence integration

- [ ] Bias the intent classifier so "build me a feature" / full-stack prompts
      route into the `mixed` set (contract-lock → UI → stitch → verify) more
      often; consume the `mixed`-routing interface stub from the sibling roadmap.
- [ ] Brand-seed the scaffold token slice (decision 5): default tokens ship now;
      when `pack-brand` is present, `scaffold.py`'s `token_seed` consumes the
      brand-token-consumption contract (`.tokens.json` + voice profile) — the
      anti-generic moat that makes a generated multi-page app coherent, not
      default-shadcn. Degrades gracefully without `pack-brand`.
- [ ] Cross-link: scaffolded UI runs through the render-verified `review` gate
      (Phase 1) — Zero-to-One output is verified, not asserted.

**Exit criteria:** feature prompts route to `mixed` appropriately; scaffolded
apps consume brand tokens when `pack-brand` is present and use sane defaults
otherwise; every greenfield output passes the render gate.

---

## Acceptance criteria

- [ ] `review` enforces render evidence (or explicit reasoned skip) for
      render-capable stacks; no silent no-op pass; non-render-capable stacks
      unaffected.
- [ ] A greenfield `scaffold` decision produces a stack-agnostic plan consumed by
      a stack skill; the engine writes no files; scaffold is re-runnable alone.
- [ ] `bare` / `external_reference` greenfield decisions are unaffected.
- [ ] App-spec confirm halt is lightweight and bypassable.
- [ ] Brand-token seeding is wired but degrades gracefully without `pack-brand`
      (acyclic dependency on the sibling roadmap).
- [ ] No preview server / managed DB / deploy / canvas added (boundary held).
- [ ] All new steps have directive-engine tests; quality pipeline green before
      archival (per `verify-before-complete`).

## Council notes

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-13, 2-round debate, design lens)
converged on: (1) the render-gate is **conditional** (render-capable stack +
runner) with an **explicit skip** path — only silent no-op on absence is fixed,
not an unconditional hard halt; (2) `scaffold.py` is **plan-only** (stack-agnostic
declarative slice → stack skill executes), justified as factoring `apply.py`'s
*inlined* greenfield branch into an explicit, **recoverable** state, not a
duplicate of `apply`; (5) brand dependency **degrades gracefully** (default
tokens first), keeping the cross-roadmap dependency acyclic. On the one genuine
split — app-spec mandatory (claude: lightweight disambiguation halt) vs optional
(gpt: preserve agility) — the synthesis is a **lightweight confirm halt with an
explicit bypass** (decision 3). The Playwright-is-a-preview challenge was rebutted
by both (headless CI testing tool ≠ user-facing preview surface), holding the
hosting boundary. Kept as one roadmap with the render-gate as an independently
shippable Phase 1.

**Implementation resolution (Phases 2–4 council, claude-sonnet-4-5 + gpt-4o,
2026-06-16, 2-round design debate).** The engine's `STEP_ORDER` is a fixed,
global 8-tuple (`refine memory analyze plan implement test verify report`)
shared by every directive set; the `ui` set has exactly two free pass-through
slots — `memory` (before `analyze`/design) and `plan` (after design, before
`implement`/apply). The locked Phase-3 wording ("scaffold before design") could
not be honoured literally without a cross-cutting `STEP_ORDER` change. The
council **converged on Option A** after the rebuttal round flipped: map
`app-spec → memory` and `scaffold → plan`, giving greenfield order audit →
app-spec → **design → scaffold** → apply. The decisive, code-grounded argument
— `design` produces an **abstract** brief (visual language: tokens, component
strategy, layout principles), *not* page-specific artifacts; `scaffold` then
**consumes** that brief to map it onto concrete structure
(`{pages, routes, layout_strategy, component_manifest, token_seed}`); `apply`
renders. The recoverable-state *substance* of locked decision 2 is preserved
(scaffold is plan-only and writes zero files, so a failed scaffold re-runs
alone) — only the recoverable label flips to "designed but not scaffolded".
Zero `STEP_ORDER` change, minimal-safe-diff, `bare` / `external_reference`
paths byte-unchanged. Option B (fold app-spec into `audit`) was rejected for
responsibility-creep + a dual-interactive-gate UX in one step.
