---
status: ready
complexity: structural
---

# Road to Per-Skill Model Auto-Switch

> Each skill carries a recommended model; on surfaces that support it (Claude Code skill `model:` frontmatter) the switch happens automatically, on surfaces that don't (Augment) the agent surfaces a one-question switch suggestion — cutting per-task token cost without losing quality on the work that genuinely needs Opus.

## Goal

Route every skill to the cheapest model that still does its job — `sonnet` for mechanical skills, `opus` for architecture / review / debugging — automatically where the runtime supports per-turn model override, and as a surfaced suggestion where it does not.

## Prerequisites

- [x] Confirm Claude Code skill `model:` frontmatter semantics still hold: override applies for the rest of the current turn, reverts to the session model on the next prompt, accepts `opus`/`sonnet`/`haiku`/full IDs/`inherit`.
- [x] Confirm no skill currently ships a `model:` or `recommended_model:` frontmatter field (greenfield — verified: zero hits under `packages/core/.agent-src.uncondensed/skills/`).
- [x] Read `contexts/model-recommendations.md` — the task→model mapping that will seed the backfill already exists and is unused at runtime.

## Context

Why now:

- `model-recommendation` (tier-2a, `core`, `install.removable: false`) is a **dead shell**. Its body says "migrated to `command:set-cost-profile`", but that command only flips `cost_profile` (which rule tiers/surfaces load) — it never selects a model. So the rule fires, routes to a command that cannot fulfil its Iron Law, and nothing switches.
- The intelligence to make the decision already exists: `contexts/model-recommendations.md` holds a full task→model table, detection heuristics, and a downgrade-reminder flow. It is loaded by the rule but has no mechanism to act on it.
- Claude Code now exposes a native, automatic lever: a skill's `model:` frontmatter switches the active model for that turn. Tagging cheap skills `sonnet` and expensive skills `opus` makes the cost optimisation structural rather than a per-conversation nudge the user must action manually.
- Token cost is the lever: the package already tracks a value/telemetry snapshot (`e7653a1b chore(value): refresh dashboard + telemetry snapshots`). Auto-downgrading the long tail of mechanical skills is a measurable per-request saving on top of the kernel cuts already shipped.

Surface reality (from `docs/contracts/multi-tool-projection-fidelity.md`):

| Tool | Native skill surface | Per-turn model override | Path in this roadmap |
|---|---|---|---|
| Claude Code / Desktop | yes (`.claude/skills/*/SKILL.md`) | yes (`model:` frontmatter) | **auto-switch** |
| Augment | yes (`.augment/skills/*/SKILL.md`) | no | **rule surfaces suggestion** |
| Cursor / Windsurf / Cline | no skill surface | n/a | not applicable |
| Gemini / Copilot | inline digest only | n/a | not applicable |

Because the generator symlinks the source `SKILL.md` verbatim into both `.claude` and `.augment`, the transport design is a genuine fork — resolved in Phase 1.

## Phase 1 — Decide field transport + Claude projection shape

The load-bearing decision the rest of the roadmap depends on. Resolve via a council pass before touching the schema.

The fork: how does a per-skill recommendation reach Claude Code's native `model:` field without leaking a Claude-specific frontmatter key into the portable source that Augment also consumes?

| Option | Mechanism | Cost | Verdict |
|---|---|---|---|
| **A — neutral source field, transformed on projection** | Source carries `recommended_model:` (tool-neutral). Claude generator rewrites it to native `model:`; Augment keeps the neutral field, consumed by the rule. | Claude skills can no longer be pure symlinks — need a frontmatter-injection / rendered-copy step. | **Recommended** — keeps source portable, lets each tool's generator decide consumption, matches the package's projection philosophy. |
| B — native `model:` directly in source | Put `model:` in source `SKILL.md`. | Leaks a Claude-only key into Augment's symlinked copy; couples source to one tool's vocabulary. | Rejected unless council overrules. |

- [x] Run an `ai-council` pass on the transport fork (members + date inline in this phase per `no-roadmap-references`); record convergence here.
- [x] Lock the source field name and its value enum. Proposed: `recommended_model` with values `opus | sonnet | gpt | inherit` — no `haiku`, the auto-downgrade floor is `sonnet` (quality guard on the cheapest tier). A complexity-tier alias layer stays deferred to a follow-up.
- [x] Decide the Claude projection shape: confirm whether `.claude/skills/*/SKILL.md` moves from symlink to rendered copy (frontmatter rewrite) or whether a lighter injection step is feasible. Document the chosen shape.
- [x] Scope is **skills and commands together** (commands project as Claude skills) — both tagged from Phase 2 onward, not a fast-follow.
- [x] Record the decision as an ADR via `adr-create` (touches the skill-schema contract + projection-fidelity contract).

Exit criteria: transport option chosen with council convergence recorded; field name + enum locked; Claude projection shape documented; ADR written.

Rollback: none — this phase produces only decisions + an ADR; no generated output changes yet.

## Phase 2 — Schema + frontmatter validation

- [x] Add the locked field to `scripts/schemas/skill.schema.json` (respect `additionalProperties: false` — explicit property, constrained enum, optional).
- [x] Mirror the field in the command schema (commands are in scope from the start).
- [x] Extend `scripts/validate_frontmatter.py` coverage so the new field validates against the enum and rejects unknown values (including `haiku`, which is deliberately out of the enum).
- [x] Add a schema fixture/test proving a skill with `recommended_model: sonnet` passes and `recommended_model: haiku` / `recommended_model: gpt5` fail.
- [x] Verify: run `python3 scripts/validate_frontmatter.py` against a sample tagged skill (clean exit).

Exit criteria: schema accepts the new optional field with a constrained enum; validator green on a tagged sample; invalid value rejected by test.

Rollback: revert the schema property + validator hunk; tagged skills fall back to "no recommendation" (inert).

## Phase 3 — Generator: project the recommendation per tool

- [x] In `scripts/condense.py` (`generate_claude_skills` / `generate_claude_commands`), implement the Phase-1 Claude shape: map source `recommended_model` → native `model:` in the Claude projection. Skip emission when the source value is `inherit` or absent.
- [x] Ensure Augment + other projections keep the neutral source field untouched (no native `model:` injected where unsupported).
- [x] Map `gpt` → no native Claude `model:` (Claude has no GPT tier) — emit nothing for Claude, leave the neutral field for the rule to surface as a suggestion.
- [x] Update `docs/contracts/multi-tool-projection-fidelity.md` to document the new field and its per-tool consumption (the table in Context above is the draft).
- [x] Verify: run `task generate-tools` (and `task sync` if required), then inspect a tagged skill's generated `.claude/skills/<name>/SKILL.md` for the expected `model:` value and the `.augment` copy for the neutral field. <!-- carve-out: new-gate-verification -->

Exit criteria: a skill tagged `recommended_model: sonnet` produces `model: sonnet` in its Claude projection and the neutral field in Augment; `gpt`-tagged and `inherit`/untagged skills emit no Claude `model:`; projection-fidelity contract updated.

Rollback: revert the generator hunk; Claude skills return to verbatim symlink/copy with no `model:` field — auto-switch silently disabled, no breakage.

## Phase 4 — Rewrite the `model-recommendation` rule so it acts

The rule must stop being a routing shell and become the surface-aware decision layer.

- [x] Rewrite `packages/core/.agent-src.uncondensed/rules/model-recommendation.md`: drop the dead `routes_to: command:set-cost-profile` framing for model selection; the rule now reasons over the per-skill `recommended_model`.
- [x] Encode surface awareness: on auto-switch-capable surfaces (Claude Code), the skill's `model:` frontmatter already performs the switch — the rule must NOT double-ask; on non-capable surfaces (Augment), the rule surfaces a single switch suggestion (one question per `ask-when-uncertain`) using the skill's recommendation.
- [x] Preserve the existing downgrade-reminder and Gemini-warning flows from `contexts/model-recommendations.md`; re-point them at the per-skill field as the source of truth.
- [x] Add an `.agent-settings.yml` toggle `model.auto_switch: auto | suggest | off`, **default `suggest`** (`auto` = let native override fire + suggest on non-capable surfaces; `suggest` = never rely on native, always surface the suggestion; `off` = inert). Document it in `templates/agent-settings.md`.
- [x] Surface the toggle in the onboarding wizard (`agent-config setup`, browser wizard at `/#/wizard`) so it is set during init — present `suggest` (default) / `auto` / `off` as an explicit, required step; persist the pick to `.agent-settings.yml` on Finish. Wire it into the wizard's settings schema + UI.
- [x] Keep the rule kernel-budget-honest: the surface decision and the toggle read live; the task→model heuristics stay in the context file (cite, don't restate) per the rule-vs-context split.
- [x] Confirm interaction with explicit user `/model` choice: native per-turn override reverts next prompt, so the rule never fights a standing user selection — note this explicitly.

Exit criteria: rule body describes a working mechanism (no dead command route); auto vs suggest split is surface-conditioned; toggle defaults to `suggest`, is documented, and is an explicit set-it step in the setup wizard; no double-ask on Claude Code.

Rollback: restore the prior rule shell; auto-switch via Phase 3 still functions independently (frontmatter is self-contained), only the Augment-side suggestion path is lost.

## Phase 5 — Backfill recommendations across the corpus

- [x] Derive a per-skill recommendation from the task→model table in `contexts/model-recommendations.md` (architecture / review / debugging / design → `opus`; tests / CRUD / quality / config / docs / trivial mechanical → `sonnet`; large-context analysis / planning → `gpt`, which surfaces as a suggestion on Claude). `sonnet` is the cheapest tier — no `haiku`.
- [x] Tag skills in batches by domain; mark genuinely model-agnostic skills `inherit` explicitly rather than leaving them blank (the error-level linter below requires a value).
- [x] Tag commands-as-skills as well — in scope from the start.
- [x] Add an **error-level** linter that fails when a skill or command lacks a `recommended_model` value (an explicit recommendation or `inherit` is mandatory). Wire it into the lint surface. <!-- carve-out: new-gate-verification -->
- [x] Verify: regenerate tools and spot-check that a cheap skill (e.g. a quality/docs skill) lands `model: sonnet` in its Claude projection and an architecture skill lands `model: opus`.

Exit criteria: every skill and command carries an explicit recommendation or `inherit`; the error-level coverage linter is green (zero untagged artifacts); spot-checks confirm correct projection.

Rollback: recommendations are additive frontmatter — drop the field per skill to revert any individual tag. Note: with the error-level linter active, fully reverting requires also relaxing the linter to warn, else untagged artifacts fail the gate.

## Phase 6 — Measure the saving

- [x] Define the before/after signal: per-task model distribution and token/cost proxy, reusing the existing value/telemetry snapshot machinery rather than inventing a new one.
- [x] Capture a baseline (pre-backfill) and a post-backfill reading on a representative skill mix.
- [x] Record the delta in the value dashboard refresh so the optimisation claim is evidenced, not asserted.
- [x] If the saving is below threshold or quality regresses on auto-downgraded skills, feed the finding back into the Phase 5 tags (this is the tuning loop, capped per `autonomous-execution` validation budget).

Exit criteria: a measured before/after token/cost delta is recorded with the model-distribution shift; any quality regression on downgraded skills is surfaced.

Rollback: measurement-only phase; nothing to revert.

## File-ownership matrix

| Surface | Owner phase | Notes |
|---|---|---|
| `scripts/schemas/skill.schema.json` (+ command schema) | P2 | contract — drives ADR in P1 |
| `scripts/validate_frontmatter.py` | P2 | enum enforcement |
| `scripts/condense.py` (`generate_claude_*`) | P3 | symlink→render decision lives here |
| `docs/contracts/multi-tool-projection-fidelity.md` | P3 | document new field consumption |
| `packages/core/.agent-src.uncondensed/rules/model-recommendation.md` | P4 | rule rewrite |
| `packages/core/.agent-src.uncondensed/contexts/model-recommendations.md` | P4/P5 | re-point to per-skill field; seed backfill |
| `templates/agent-settings.md` (+ template yml) | P4 | `model.auto_switch` toggle, default `suggest` |
| onboarding wizard (`agent-config setup` server + browser UI) | P4 | expose + require the toggle at init |
| `packages/core/.agent-src.uncondensed/skills/**/SKILL.md` + `commands/**` | P5 | backfill tags (skills + commands) |
| value/telemetry snapshot surface | P6 | measured delta |

## Acceptance criteria

- The `model-recommendation` rule describes and triggers a mechanism that actually switches or suggests a model — no dead command route.
- A skill tagged with a recommendation auto-switches the model on Claude Code (native `model:`) and surfaces a single switch suggestion on Augment.
- Source `SKILL.md` stays tool-neutral; the Claude-specific `model:` exists only in the Claude projection.
- Schema + validator accept the new field with a constrained enum (`opus | sonnet | gpt | inherit`) and reject unknown values, including `haiku`.
- Every skill and command carries an explicit recommendation or `inherit`; the error-level coverage linter is green.
- `model.auto_switch` defaults to `suggest` and is an explicit, required step in the setup wizard.
- A measured before/after token/cost delta is recorded in the value snapshot.
