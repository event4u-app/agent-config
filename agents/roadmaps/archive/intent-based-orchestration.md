# Roadmap: Intent-based orchestration

> **Status: Superseded — 2026-04-27**
>
> This roadmap is the original architectural spike for intent-based orchestration. It is superseded by three focused, sequenced roadmaps that split the work along clean rollback boundaries:
>
> - [`road-to-universal-execution-engine.md`](road-to-universal-execution-engine.md) — engine generalization with golden-compatibility gate
> - [`road-to-prompt-driven-execution.md`](road-to-prompt-driven-execution.md) — prompt entrypoints with confidence scoring
> - [`road-to-product-ui-track.md`](road-to-product-ui-track.md) — UI track with mandatory existing-UI audit
>
> Kept for historical context only. **Do not edit. Do not pull steps from here.** The three successor roadmaps are the sole source of truth.

> Make `agent-config` orchestrate per-task instead of per-profile — UI work runs a product-first pipeline, backend work runs the engineering pipeline, mixed work splits — all driven by a single intent rule, with frontend universalised so Laravel/React/Blade/shadcn become composable specializations.

## Prerequisites

- [ ] Read `AGENTS.md` and `.agent-src.uncompressed/templates/agent-settings.md`
- [ ] Re-read `.agent-src.uncompressed/skills/fe-design/SKILL.md` (today: server-first / Blade-Livewire-Flux centric)
- [ ] Re-read `.agent-src.uncompressed/skills/design-review/SKILL.md` (existing 7-phase review)
- [ ] Re-read `.agent-src.uncompressed/skills/developer-like-execution/SKILL.md` (de-facto backend track)
- [ ] Read `.agent-src.uncompressed/rules/rule-type-governance.md` and `size-enforcement.md`

## Context (current state)

The package is a strong **governed engineering co-pilot** (124 skills, 46 rules, 73 commands, 46 guidelines). UI artefacts exist (`fe-design`, `design-review`, `playwright-testing`, `project-analysis-react`, `blade-ui`, `livewire`, `flux`) but:

- `fe-design` is **server-first / Blade-Livewire-Flux centric** — frontend defaults to Laravel-stack rather than being universal.
- UI tasks need explicit prompting; there is no automatic product/UX denkpfad (goal → layout → components → states → implement → review).
- `design-review` is strong but only runs on demand.
- There is no per-task **track routing** (UI vs backend vs mixed). Profiles (`minimal/balanced/full`) are session-wide and orthogonal.

The shift this roadmap implements:

> **Rule decides intent. Skills execute tracks. Settings steer orchestration. Roadmap documents migration.**

Frontend becomes a **universal first-class concern**; Blade/Livewire/Flux/React/shadcn become **implementation specializations** under it.

- **Feature:** none (architectural roadmap)
- **Jira:** none

## Target architecture

```
Rule: route-by-task-intent           ← always-on, classifies the request
   │
   ├── frontend-product-ui  →  product-ui-orchestrator  (new skill)
   │                            └── stack detection → react-shadcn-ui (new) | blade-ui+livewire+flux (existing) | ask
   │                            └── auto-runs design-review at the end
   │
   ├── backend-coding       →  developer-like-execution (existing skill, repositioned)
   │
   ├── mixed-fullstack      →  fullstack-feature-orchestrator (new skill)
   │                            └── splits into backend-contract + ui-experience tracks
   │
   ├── analysis-only        →  analysis-skill-router (existing)
   ├── review-only          →  judge-* / review-changes (existing)
   └── docs-config          →  agent-docs-writing / context-create (existing)
```

`fe-design` becomes the **universal frontend-design architecture skill** (planning, layout, component architecture, form/table patterns, responsive strategy, a11y) — framework-agnostic. The implementation skills (`blade-ui`, `livewire`, `flux`, `react-shadcn-ui`) sit underneath as specializations.

## Settings schema

`cost_profile` stays untouched. Orchestration is a new, orthogonal block. **`mixed` is a coordination mode, not a domain track** — it lives outside `tracks:`.

```yaml
orchestration:
  enabled: true
  strategy: intent-based

  tracks:
    product_ui:
      enabled: true
      mode: auto

    backend:
      enabled: true
      mode: auto

  mixed_tasks:
    split: true
```

Future tracks (`infrastructure`, `security`, `performance`, `qa`, `docs`, `devops`) plug into `tracks:` with the same shape and are explicitly **out of scope** for this roadmap (see Notes).

## Non-goals

- **No** static `profile: lovable` — orchestration is per-task, not per-session.
- **No** skill explosion. Microcopy, responsive-polish, accessibility-review, ui-state checks, visual-polish are **steps inside `product-ui-orchestrator`**, not new skills.
- **New skills allowed in this roadmap:** `product-ui-orchestrator`, `react-shadcn-ui`, `fullstack-feature-orchestrator`. Three. Nothing else.
- **No** removal of Blade/Livewire/Flux. They remain first-class — just relabeled as specializations.
- **No** Lovable-mimicry beyond what fits a **governed** agent. We keep `verify-before-complete`, `scope-control`, `downstream-changes`, `ask-when-uncertain`.
- **No** version numbers, release tags, or shipping plan in this roadmap (per `roadmaps.md` rule 13).
- **No** real `infrastructure` / `security` / `performance` track build-out — deferred.
- **No** over-orchestration. Backend-only tasks must not load `product-ui-orchestrator`. UI-only tasks must not require backend planning unless data/API changes are implied.
- **No** interruption-by-default. Low-risk ambiguity → reversible assumption + proceed (mentioned briefly in the response). Ask only when stack, data model, destructive behavior, or product direction would materially change the implementation.

## Architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Intent detection | **Rule** `route-by-task-intent` | Always-on detection fits the rule model; skills are triggered |
| UI workflow | **Skill** `product-ui-orchestrator` | Triggered on UI-intent, runs the product-first pipeline |
| Backend workflow | **Existing skill** `developer-like-execution`, repositioned | No rewrite — already enforces think → analyze → verify → execute |
| Mixed workflow | **New skill** `fullstack-feature-orchestrator` (slim coordinator only) | Coordinates `backend contract → ui experience → integration seam → verification`. **Does not duplicate** UI or backend rules. |
| `fe-design` scope | **Universal frontend-design architecture** | Removes Laravel-bias; implementation skills sit underneath |
| Microcopy / responsive / a11y / visual-polish / **ui states** | **Steps inside `product-ui-orchestrator`** | Avoid skill inflation past 124 |
| Auto-design-review | **Rule** `after-ui-change-run-design-review` (graded) | Meaningful UI changes → full review. Trivial text/class-only changes → lightweight checklist. |
| Project UI context | **Templates** under `.agent-src.uncompressed/templates/contexts/` | When absent, proceed with detected conventions; only scaffold on explicit user request |
| `mixed` placement in settings | **`mixed_tasks` outside `tracks:`** | `mixed` is a coordination mode, not a domain track |
| Settings block name | `orchestration:` (not `routing:`) | Describes the goal, not the mechanism |
| Roadmap split | **Single file** | Per template "one task per file"; split later if it grows past 1000 lines |

## Phase 1: Track architecture

The skeleton — router rule, three track entry points, settings, extension pattern. No UI-quality rules and no UI commands yet — those land in Phase 2.

- [ ] **Step 1:** Add `orchestration:` block to `.agent-src.uncompressed/templates/agent-settings.md` with the agreed shape. Update installer template `config/agent-settings.template.yml`.
- [ ] **Step 2:** Create rule `.agent-src.uncompressed/rules/route-by-task-intent.md` (always-on). Six intent classes: `backend-coding`, `frontend-product-ui`, `mixed-fullstack`, `analysis-only`, `review-only`, `docs-config`. Detection signals (verbs, nouns, paths, file extensions). One numbered-options question on ambiguity (per `ask-when-uncertain`).
- [ ] **Step 3:** Create skill `.agent-src.uncompressed/skills/product-ui-orchestrator/SKILL.md` — **skeleton only**: pipeline contract (goal → existing-UI discovery → layout → components → states → responsive → a11y → implement → design-review → polish), stack-detection placeholder, project-context-load placeholder. Body is fleshed out in Phase 2.
- [ ] **Step 4:** Create skill `.agent-src.uncompressed/skills/fullstack-feature-orchestrator/SKILL.md`. Splits a mixed task into backend-contract (data shape, API, errors) + UI-experience (screens, flows, states), runs them in order, validates integration at the seam.
- [ ] **Step 5:** Reposition `.agent-src.uncompressed/skills/developer-like-execution/SKILL.md` as the **canonical backend track entry point**. Update its description and "When to use" to mention orchestration. No procedural rewrite.
- [ ] **Step 6:** Create rule `backend-contract-before-impl.md` — when intent is `backend-coding`, design the request/response/error contract before implementation. Mirrors `layout-before-code` (Phase 2) for the backend track.
- [ ] **Step 7:** Create guideline `.agent-src.uncompressed/guidelines/agent-infra/orchestration-tracks.md`. Documents the track-extension recipe so future tracks plug in cleanly.
- [ ] **Step 8:** Update `.agent-src.uncompressed/templates/AGENTS.md` to mention orchestration in the entry-flow section.
- [ ] **Step 9:** Run `python3 scripts/skill_linter.py --all`, `python3 scripts/check_references.py`, `python3 scripts/check_portability.py`. Fix until clean.

## Phase 2: Product UI orchestration

Fleshes out the UI track end-to-end: full pipeline body, behavioural rules, commands, project context.

- [ ] **Step 1:** Flesh out the body of `product-ui-orchestrator` — concrete prompts and outputs for each pipeline stage; project-context auto-load when `agents/contexts/{product,design-system,ui-patterns,app-shell,copywriting,frontend-stack}.md` are present; auto-invocation of `design-review` at the end.
- [ ] **Step 2:** Create UI-quality rules:
  - `layout-before-code.md` — never implement UI directly; goal → layout → components → states → code, always.
  - `every-screen-needs-states.md` — loading / empty / error / success required before completion.
  - `reuse-before-new-ui.md` — inspect existing components before creating new UI; cite what was checked.
  - `mobile-first-required.md` — every layout works at 320px width first.
  - `visual-polish-before-complete.md` — UI work is incomplete until spacing / interaction / a11y / responsive review pass.
  - `after-ui-change-run-design-review.md` — **graded**: meaningful UI changes (new screens, layout, component structure, states, flows) → full `design-review`. Trivial changes (text-only, single class swap, color tweak) → lightweight checklist (spacing, a11y label, mobile, primary action).
  - `primary-action-must-be-obvious.md` — one obvious primary action per screen; destructive actions need confirmation; no placeholder copy in shipped UI.

  Each rule passes `rule-type-governance` (always vs auto) and `size-enforcement`.

- [ ] **Step 3 (wave A):** Create the four core UI commands under `.agent-src.uncompressed/commands/`. Each declares `disable-model-invocation: true` and references `product-ui-orchestrator`:
  - `/build-screen` — full pipeline end-to-end.
  - `/improve-ui` — hierarchy / spacing / clarity / actions / empty states / mobile.
  - `/refactor-ui` — extract components, remove one-offs, preserve behavior, graded design-review at the end.
  - `/add-ui-states` — loading / empty / error / success / disabled / validation.

- [ ] **Step 4 (wave B):** Create the four specialised UI commands. Same frontmatter contract as wave A:
  - `/match-design-system` — align with `agents/contexts/design-system.md` when present.
  - `/build-dashboard` — app-shell + KPI grid + activity feed + quick-actions, with realistic states.
  - `/build-form-flow` — multi-step or single-page form with validation, a11y, confirmation.
  - `/ship-ui-feature` — full product-first loop in one command. Resolves overlap with `/implement-ticket` per Open decision 7 before shipping.

- [ ] **Step 5:** Create project context templates under `.agent-src.uncompressed/templates/contexts/`:
  - `product.md` — users, goals, tone, constraints.
  - `design-system.md` — visual style, primitives, color/spacing tokens.
  - `ui-patterns.md` — recurring screen patterns, shared components.
  - `app-shell.md` — navigation, header, layout primitives, route conventions.
  - `copywriting.md` — voice, tone, microcopy patterns.
  - `frontend-stack.md` — stack-detection-fillable; documents chosen FE stack.

  All scaffolded empty with section structure. **Default behaviour when absent:** orchestrator proceeds with detected conventions and mentions in the response that context files would improve future output. **Scaffolding only happens on explicit user request** (e.g. `/context-create` or "yes, set up context"). Orchestrator auto-loads when present.

- [ ] **Step 6:** Document the context layer in `.agent-src.uncompressed/guidelines/agent-infra/project-context-layer.md`.
- [ ] **Step 7:** Run `skill_linter`, `check_references`, `check_portability`.

## Phase 3: Frontend skill migration

Universalises `fe-design` and adds the React stack as a peer of the Laravel stack.

- [ ] **Step 1:** Refactor `.agent-src.uncompressed/skills/fe-design/SKILL.md` so the body is **framework-agnostic frontend-design architecture** — component architecture, layout planning, form/table patterns, responsive strategy, a11y, **and the universal UI-state catalog (loading / empty / error / success / disabled / validation)**. No Blade/Livewire/Flux assumptions in the main flow. Move stack-specific guidance into a "Specializations" section that points to the right implementation skill based on detected stack.
- [ ] **Step 2:** Create skill `.agent-src.uncompressed/skills/react-shadcn-ui/SKILL.md`. React + TypeScript + Tailwind v4 + shadcn/ui. Next.js / Vite detection. App-shell / dashboard / form / table-filter-action / modal-sheet patterns. Composition over prop-heavy components.
- [ ] **Step 3:** Reposition `blade-ui`, `livewire`, `flux` as **Laravel-stack implementation specializations** under universal `fe-design`. Update each skill's description and "When to use" to clarify they are invoked when the detected stack is Laravel/Blade. No procedural rewrite.
- [ ] **Step 4:** Add a stack-detection step inside `product-ui-orchestrator` (Phase 2 step 1 reference). Inspect `package.json`, `composer.json`, `resources/views/`, `app/`, `pages/`, `components/ui/`. Choose `react-shadcn-ui` vs `blade-ui+livewire+flux` vs ask. Cache the result in conversation memory for the session.
- [ ] **Step 5:** Update `analysis-skill-router` so it knows about `product-ui-orchestrator`, `fullstack-feature-orchestrator`, and `react-shadcn-ui`.
- [ ] **Step 6:** Run `skill_linter`, `check_references`, `check_portability`.

## Phase 4: Verification and docs

Compress, sync, prove the system end-to-end.

- [ ] **Step 1:** Run `task sync` — compress `.agent-src.uncompressed/` → `.agent-src/` → `.augment/` projection.
- [ ] **Step 2:** Run `task generate-tools` — regenerate `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md`.
- [ ] **Step 3:** Run `task ci` (sync-check, consistency, check-compression, check-refs, check-portability, lint-skills, test, lint-readme). Must exit 0.
- [ ] **Step 4:** Manual end-to-end scenarios — capture transcripts as evidence:
  - "Build a customer detail page" (no stack hint) → router classifies `frontend-product-ui` → orchestrator runs full pipeline → stack detection picks the right specialization → design-review runs at the end.
  - "Add an API endpoint for invoice export" → router classifies `backend-coding` → `developer-like-execution` runs → `backend-contract-before-impl` enforces contract first.
  - "Build customer management with list, detail and API" → router classifies `mixed-fullstack` → `fullstack-feature-orchestrator` splits into backend-contract + ui-experience tracks.
  - "Build a settings page" on a Laravel-only repo → stack detection picks Blade/Livewire/Flux automatically.
  - "Build a settings page" on a Next.js-only repo → stack detection picks `react-shadcn-ui` automatically.
  - "Build a settings page" on an empty repo → orchestrator asks one numbered-options question.
- [ ] **Step 5:** Update root `README.md` and root `AGENTS.md` to mention intent-based orchestration as a first-class capability. Keep `README.md` user-facing and consumer-friendly; keep `AGENTS.md` project-agnostic.
- [ ] **Step 6:** Update consumer-facing template `.agent-src.uncompressed/templates/AGENTS.md` to document the `orchestration:` block and the track-extension pattern.
- [ ] **Step 7:** Add a changelog / release-notes draft entry — text only, no version number (per roadmap rule 13).

## Acceptance Criteria

- [ ] `.agent-settings.yml` template carries the `orchestration:` block with two tracks (`product_ui`, `backend`) plus a separate `mixed_tasks:` coordination block; installer writes it on first install.
- [ ] Rule `route-by-task-intent` is always-on and classifies any request into one of six intent classes before any other skill runs.
- [ ] Skill `product-ui-orchestrator` runs the full product-first pipeline (goal → layout → components → states → implement → design-review → polish) automatically on UI-intent **without** the user mentioning frontend, microcopy, responsive, or a11y.
- [ ] `fe-design` body is framework-agnostic and contains the universal UI-state catalog; `blade-ui`/`livewire`/`flux` are documented as Laravel-stack specializations; `react-shadcn-ui` exists as the React/Next/Vite specialization.
- [ ] Stack detection picks the correct specialization on a Laravel-only repo, a Next.js-only repo, and asks one question on an empty repo.
- [ ] `after-ui-change-run-design-review` enforces a **graded** review: meaningful UI changes → full `design-review`; trivial text/class-only changes → lightweight checklist.
- [ ] At least 7 UI-quality rules ship and pass `rule-type-governance` and `size-enforcement`.
- [ ] At least 8 UI commands ship (4 wave A core + 4 wave B specialised) and pass `command-writing` linting.
- [ ] Six context-template files ship under `.agent-src.uncompressed/templates/contexts/`. Orchestrator auto-loads when present; when absent it proceeds with detected conventions and only scaffolds on explicit user request.
- [ ] Backend-track parity: `developer-like-execution` is documented as the backend entry; `backend-contract-before-impl` mirrors `layout-before-code`.
- [ ] Mixed-task split: `fullstack-feature-orchestrator` is a **slim coordinator** running `backend contract → ui experience → integration seam → verification`. It does **not** duplicate UI- or backend-quality rules.
- [ ] **Over-orchestration guard:** backend-only tasks must not load `product-ui-orchestrator`. UI-only tasks must not require backend planning unless data/API changes are implied.
- [ ] **No** new skill beyond `product-ui-orchestrator`, `react-shadcn-ui`, `fullstack-feature-orchestrator` is added by this roadmap.
- [ ] `task ci` exits 0.
- [ ] All six end-to-end scenarios pass and are captured as evidence transcripts.

## Open decisions

These need user input before or during implementation. Ask one at a time, per `ask-when-uncertain`:

1. **Naming `fe-design` after the migration** — keep `fe-design` (universal architecture) or rename to `frontend-design` / `ui-architecture` for clarity? Default: keep `fe-design` (zero rename cost, description carries the new scope).
2. **Backend orchestrator skill** — keep `developer-like-execution` as the backend entry, or introduce a thin `backend-orchestrator` skill that wraps it for symmetry with `product-ui-orchestrator`? Default: keep existing, document the role.
3. **Graded design-review thresholds** — what exactly counts as "meaningful UI change" vs "trivial"? Default: meaningful = new screen / changed layout / new or removed component / new state / changed flow. Trivial = text-only, single class swap, color/icon-only tweak. Settings opt-out: **no** (rule stays always-on; the grading itself is the relief valve).
4. **Mixed orchestrator: skill or rule?** — skill that composes two tracks vs rule that delegates to both. Default: **skill** (`fullstack-feature-orchestrator`) — needs procedural body for the seam validation.
5. **Context templates location** — `.agent-src.uncompressed/templates/contexts/` (new dir) or extend existing `.agent-src.uncompressed/contexts/`? Default: new `templates/contexts/` because they are scaffolds for consumers, not shared package contexts.
6. **Stack-detection caching** — per-conversation only, or persisted to `.agent-settings.yml` on first detect? Default: per-conversation; persistence comes later if needed.
7. **`/ship-ui-feature` overlap with `/implement-ticket`** — does the existing `/implement-ticket` already cover ship-style flows for UI work? Decide whether `/ship-ui-feature` is needed or whether `/implement-ticket` should learn UI orchestration via the router. Default: ship `/ship-ui-feature` as the UI-only fast path; long-term reconsider. **Must be resolved before Phase 2 step 4.**

## Notes

### Sequencing rationale

Phase 1 must land **before** Phases 2–3 because every later artefact (orchestrator body, rules, commands, frontend skills) plugs into the router and the orchestrator skeleton. Phase 2 (UI behaviour) lands before Phase 3 (frontend skill migration) so the orchestrator has a concrete pipeline to specialize. Phase 4 is verification and docs only — no new artefacts.

### Out-of-scope (deferred to a follow-up roadmap)

- Real `infrastructure`, `security`, `performance`, `qa`, `docs`, `devops` track build-out (only the extension recipe lands here).
- Screenshot-to-code refinement.
- Figma-aware review.
- Multi-step UI refinement memory.
- Project-local design memory.
- UI quality scoring.
- A `backend-orchestrator` skill if open decision 2 is resolved in favour of one.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Skill inflation past 124 | Hard cap in Non-goals: only **three** new skills allowed by this roadmap (`product-ui-orchestrator`, `react-shadcn-ui`, `fullstack-feature-orchestrator`). |
| `route-by-task-intent` misclassifies → wrong pipeline runs | Rule asks one numbered-options question on **high-risk** ambiguity only (stack, data model, destructive behavior, product direction). Low-risk ambiguity → reversible assumption + proceed. Detection signals documented. |
| Consumer projects miss the new context files → orchestrator runs blind | Orchestrator detects absence, proceeds with detected conventions, mentions context files in the response. Scaffolds **only** on explicit user request. |
| Auto-design-review feels heavy on small changes | Rule is **graded**: trivial text/class-only changes → lightweight checklist, not full review. |
| Over-orchestration: backend task accidentally triggers UI pipeline | Acceptance criterion enforces the guard; intent rule documents negative signals. |
| Laravel users feel demoted by the migration | Blade/Livewire/Flux remain first-class specializations — only the entry framing of `fe-design` changes. Documented in Phase 3 step 3. |
| Token cost of always-on router rule | Rule kept under 60 lines; runs as cheap classification; never loads skill bodies. |
| Breaking changes in `fe-design` body | Phase 3 step 1 preserves all current procedural content under "Specializations"; only the framing becomes universal. |
| `/ship-ui-feature` and `/implement-ticket` collide | Open decision 7 must be resolved before Phase 2 step 4. |

### Future tracks (extension recipe — referenced from Phase 1 step 7)

```yaml
orchestration:
  tracks:
    product_ui: { enabled: true, mode: auto }
    backend:    { enabled: true, mode: auto }
    # Future, deferred:
    infrastructure: { enabled: false, mode: auto }
    security:       { enabled: false, mode: auto }
    performance:    { enabled: false, mode: auto }
    qa:             { enabled: false, mode: auto }
    docs:           { enabled: false, mode: auto }
    devops:         { enabled: false, mode: auto }

  mixed_tasks:
    split: true
```

Each future track adds: one orchestrator skill, one "X-before-implementation" rule, optional commands, optional context templates. The pattern is fixed by `orchestration-tracks.md` (Phase 1 step 7).
