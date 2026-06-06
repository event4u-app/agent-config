---
status: ready
complexity: structural
parent_roadmap: road-to-6.1.0-product-consolidation
---

# Road to 6.2.0 — Consolidation evidence-gates (the council-deferred remainder)

> Spawned from [`road-to-6.1.0`](archive/road-to-6.1.0-product-consolidation.md) (PR4)
> per the AI-council design/deep review (claude-sonnet-4-5 + gpt-4o, 2026-06-06,
> session `agents/runtime/council/responses/6.1.0-consolidation.json`). 6.1.0
> shipped the safe, low-risk consolidation slice (Flows primary view + recorded
> decisions); this roadmap holds the four items the council gated on **real
> capability/safety proof or usage evidence**, NOT on a telemetry wait-window.
>
> **Each item is its own rollback unit → its own PR** (the council's strongest
> structural call: do not re-bundle independent rollback units). The roadmap
> premise from 6.1.0 still holds — the maintainer's knowledge is the evidence,
> telemetry only corroborates — but the council named gates here that are about
> *capability existence* and *grep-verifiable safety*, which the maintainer
> resolves by **running the check**, not by waiting.

## Goal

Land the consolidation work that 6.1.0 deliberately deferred, each behind its
named gate, each as an independent PR with a stated rollback path.

## Phase 1: Step 7 — physical command → skill conversion (the platform leaves)

> 6.1.0 already DEMOTED these four leaves to the `agent-admin` platform surface
> in `src/flows/surface-map.yaml` (they no longer count as user-work flow
> commands). This phase does the physical migration: command source → skill.

- [ ] **Step 7a:** Convert `skill/preview` and `skills/discover` to skills —
  delete the command source under `src/domains/meta/`, author `src/skills/<slug>/SKILL.md`,
  regenerate projections, keep a deprecation pointer. **Gate:** prove the
  inline-invoke path (a skill is reachable by description-match without command
  ceremony) with a test, before deletion. Lowest-risk leaves first.
  <!-- blocked: inline-invoke PROOF shipped (tests/test_inline_invoke_reachability.py); CONVERSION deferred per AI-council (2026-06-06, ADR-057) — slug-collision projection-suppression + untested cross-provider description-match. Reopens with cross-provider validation. -->
- [ ] **Step 7b:** Convert `review-routing` (command form; skill form already
  exists at `src/skills/review-routing`) and `rule-compliance-audit`. **Gate
  (council, hard):** a guaranteed debug-bypass path that does NOT depend on the
  agent's task-routing pipeline — these are the tools used to debug auto-detection
  itself, so converting them must not remove the debug escape hatch. Ships only
  after 7a proves the inline path.
  <!-- cancelled: AI-council (2026-06-06, ADR-057) DECLINED the conversion — the command form IS the debug-bypass; a skill reached only by description-match cannot debug a broken description-matcher (circular dependency). Both command files now carry the intentional command-only note. -->

> **AI-council outcome on Phase 1 (claude-sonnet-4-5 + gpt-4o, 2026-06-06, 2 rounds + peer-review):**
> 7a — inline-invoke proof delivered, physical conversion **deferred**. 7b —
> conversion **declined**, command-only retained as the debug-bypass. See
> [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md).

## Phase 2: Step 8 — hard alias-drop (the 6.0.0-D deprecation aliases)

- [x] **Step 8a:** Drop the grace-elapsed 6.0.0-D deprecation aliases (the
  real `replaces:` set — `commit`, `commit-in-chunks`/`commit:in-chunks`,
  `create-pr`, `create-pr-description-only`/`create-pr:description-only`).
  **Gate (council, hard):** `grep`-zero-usage across the maintainer's repos for
  every alias before removal; any hit → keep the alias as a permanent stub
  instead. Rollback: re-add the alias as a stub (one commit). Deprecate-now /
  delete-later — never a silent drop (internal CI scripts + muscle memory).
  <!-- done: grep-zero FAILS (non-zero: commit-in-chunks 17 files, commit:in-chunks 22, create-pr:description-only 17, …) → gate outcome KEEP all aliases as permanent stubs. Evidence + alias-lifecycle policy recorded in ADR-057. The original named examples (fix/pr-bot-comments, fix/pr-developer-comments) never existed as aliases — corrected here. -->

> **AI-council outcome on Step 8a:** grep strongly non-zero → keep stubs (the
> gate's own "any hit → keep" branch). Recorded with the literal grep command +
> alias-lifecycle policy in [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md).

## Phase 3: Step 5b — feature-plan mode-flags (only if usage demands)

- [x] **Step 5b:** Revisit folding `feature/explore` + `feature/roadmap` into
  `feature-plan --explore` / `--roadmap` modes. **Gate (council):** evidence that
  users treat explore/plan/roadmap as *modes of one goal*, not *distinct goals*
  (the git-log-vs-reflog test). 6.1.0 decided to KEEP them separate; this only
  reopens if the usage signal flips. The relationship is already documented in
  the discovery flow + `docs/command-flows.md`.
  <!-- done: revisited — no usage signal exists (no analytics JSONL). Signal has not flipped → KEEP separate (6.1.0 decision stands, not reopened). Recorded in ADR-057. -->

> **AI-council outcome on Step 5b:** KEEP-CURRENT (separate). Usage signal
> absent → not reopened. See [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md).

## Phase 4: Step 9b — Flows runtime navigation (after the doc proves itself)

- [ ] **Step 9b:** Make the Flows view the *runtime* primary surface (CLI/help
  navigation, profile-surfaced command grouping), beyond the generated
  `docs/command-flows.md` doc shipped in 6.1.0. **Gate (council):** signal that
  users actually navigate by the flow-organized doc (reference it in
  issues/questions) before changing the runtime surface — the doc is the
  low-risk observation vehicle; the runtime change is the high-risk one.
  <!-- blocked: gate checked — zero external references to docs/command-flows.md (only its own generator + Taskfile + roadmaps); no telemetry. Usage signal absent → runtime change DEFERRED per AI-council (2026-06-06, ADR-057). Reopens when a flow-doc usage signal exists. -->

> **AI-council outcome on Step 9b:** DEFER the runtime change — usage signal
> absent; doc stays the observation vehicle. Council-suggested follow-up: passive
> flow-navigation telemetry (own roadmap, not this cycle). See
> [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md).

## Acceptance Criteria

- [x] Each phase shipped with a stated rollback path.
  <!-- superseded: per-phase-PR collapsed to ONE PR (AI-council-endorsed, 2026-06-06) — the gate-checks resolved to record-only / deferred outcomes, so there is no independent rollback unit to isolate. Per-step rollback notes live in ADR-057. -->
- [x] No capability lost — every command/alias in scope still resolves (7a/7b
  keep their command form; 8a keeps every alias; 5b/9b unchanged).
- [x] Each gate's check (inline-invoke proof, debug-bypass proof, grep-zero-usage,
  usage signal) recorded in the PR before the change lands — see
  [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md).
