---
adr: 109
status: accepted
date: 2026-07-04
decision: subagent-v1-contract
supersedes: —
superseded_by: —
phase: road-to-final-state-and-market-readiness
type: standing
---

# ADR-109 — The `subagent-v1` contract (new discovery category, default-off, static projection)

## Status

**Accepted** · 2026-07-04 · maintainer decision after an AI-council debate
(claude-sonnet-4-5 + gpt-4o, 2 rounds). Track A keystone (A1) of
`road-to-final-state-and-market-readiness.md`.

## Context

Track A adds a **capability** layer: named subagent units that a host can invoke
as distinct, tool-scoped execution contexts (Claude Code's `.claude/agents/`).
The wedge — `production-validator` — already ships hand-written in that native
format. A1 turns that one hand-written file into a governed, projected artifact
type without breaching the no-runtime identity floor (no daemon, no auto-write,
no in-process swarm, no dispatch we enforce).

The council was asked to converge the contract shape. Both members agreed on the
category and the schema completeness; the residual dissent was a documentation
nuance (don't over-claim cross-host equivalence), folded in below.

## Decision

### 1. A new discovery category `subagent` (not `agent`, not a persona subtype)

- **Name `subagent`.** `agent` is overloaded (the host is "the agent"; this
  package is "agent-config"). `subagent` = a subordinate, delegated, addressable
  execution context.
- **A distinct category, not a persona subtype.** Personas are reference lenses
  projected as *context* for a single session; a subagent is an *addressable
  execution context* with its own tool manifest and model. Folding subagents into
  personas would force every persona to grow a `tools` field it ignores, or add
  subtype-specific projection logic (a parallel schema inside one category). The
  categories today are `['skill', 'rule', 'command', 'template']`; `subagent`
  becomes the 5th.

### 2. Source schema `subagent-v1` (governance fields REQUIRED, not optional)

```yaml
schema_version: subagent-v1
name: <handle>                      # REQUIRED — matches filename stem, addressable
description: <one line>             # REQUIRED — user-facing summary
model_tier: high|medium|lite|inherit  # REQUIRED — reuses model_tier.ts; `inherit` is a
                                      #   documented passthrough sentinel (→ CC `model: inherit`),
                                      #   NOT a new tier→model mapping
tools: [Read, Grep, Glob, Bash, …]  # REQUIRED — enum-validated against the CC tool set
trust: {level, confidence, human_review_required}  # REQUIRED — mirrors the skill trust block (ADR-013)
lifecycle: active|deprecated|experimental|archived # REQUIRED — reuse the existing lifecycle enum
discovery:
  visible: false                    # REQUIRED — default-off; linter enforces `false`
  requires_capability: <cap>        # REQUIRED — host-capability gate (e.g. claude_subagents)
  categories: [<tag>, …]            # OPTIONAL — pack-include tags
```

Body: a free-form Markdown system prompt (like personas). Governance fields are
**required** — optional governance would create a two-tier system (governed
legacy artifacts vs. ungoverned subagents), which breaks trust filtering and the
"governed config layer" promise. The source carries governance metadata that
does **not** project to `.claude/agents/` (CC has no such fields) but does drive
discovery filtering, docs generation, and cross-host warnings.

**Banned fields (would imply runtime we do not have):** `auto_invoke_on`,
`max_iterations`, `timeout`, `cost_limit`, `memory_strategy`, `delegates_to`.

### 3. Native-Claude-Code translation

Projected file: `.claude/agents/<name>.md` with frontmatter `{name, description,
tools, model}` + the body. `model` is derived from `model_tier` by **reusing**
`src/scripts/_lib/model_tier.ts` (`TIER_TO_CLAUDE_MODEL`: high→opus, medium→sonnet,
lite→haiku); `model_tier: inherit` projects to `model: inherit` (passthrough).
No new mapping is invented (ADR-034/035 stands).

### 4. Cross-host degradation (host-agnostic, honestly limited)

Only Claude Code has native subagents. Elsewhere a subagent projects to a
**loadable context file**, gated by `requires_capability`:

| Host | Projection | Invocation |
|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | `@<name>` (host-native) |
| Cursor / Windsurf / Cline | context file the host can load on intent | manual — **no `@`-dispatch** |
| Copilot / Gemini | skipped (no context surface) | — |

**Honest limitation (published, per the package's own honesty floor):** on
non-Claude-Code hosts the artifact degrades to *passive reference* — the system
prompt is available, but there is no host-native dispatch. This is **governance
parity, not feature parity**: trust / lifecycle / model-tier apply uniformly; the
automation does not. We do not fake dispatch (that would need a runtime we refuse
to add).

### 5. Default-off + non-dispatch (mechanical)

- **Default-off** = `discovery.visible: false` (required; linter enforces the
  value is `false`). No glob pulls subagents; a pack opts in explicitly via
  `include: ["subagent:<name>"]` or `include: ["subagent:category:<tag>"]`.
- **Non-dispatch is free.** We have no runtime; we only project a file. The host
  (or the user via `@<name>`) decides invocation. No `auto_dispatch` flag exists
  (it would imply `true` is possible — it is not).

### 6. Determinism / lint guarantees (part of A1)

- `tools` validated against the CC tool enum — build-time failure, never a broken
  `.claude/agents/` YAML in the user's IDE.
- `model_tier` validated against `model_tier.ts` (+ the `inherit` sentinel).
- `name` globally unique within the `subagent` category (projection-path
  collision guard), matching the filename stem.
- `discovery.visible` must be present and `false`.

### 7. Explicitly cut from v1

Multi-subagent orchestration (`delegates_to`), custom tool definitions, and
per-artifact `supported_hosts` lists (use `requires_capability` + a central
capability matrix instead). Revisit only in a `subagent-v2` if evidence demands.

## Consequences

- A 5th discovery category, one new schema, one source location (`src/subagents/`),
  a translation step, and lint rules — all additive; existing categories untouched.
- `production-validator` becomes the first `src/` subagent unit and the single
  source of truth for the wedge (the hand-written `docs/wedge/` copy is superseded
  by projection).
- **Gate A still governs shipping:** a unit is default-off and ships as
  recommended-opt-in **only** if the A3 eval (on `internal/bench/orchestration/`)
  beats both baselines at acceptable token cost; otherwise it stays in `src/` as a
  documented honest-null. This ADR defines the *contract*, not a promotion.

## Alternatives considered

- **Persona subtype** — rejected: semantic dilution + schema creep (tools field on
  all personas, or subtype-specific projection).
- **Optional governance fields** — rejected: creates ungoverned-by-default
  artifacts, breaking the trust model (council round 2, decisive).
- **CC-only (no degradation)** — rejected: violates host-agnostic positioning; a
  CC-locked artifact is Claude Code config that wandered into the repo.
- **Faked dispatch on non-CC hosts** — rejected: runtime cosplay we cannot honor.

## Amendment 1 (2026-07-04) — discovery-manifest integration = Option B

The original decision left *how* subagents join the discovery manifest open. A
follow-up council (claude-sonnet-4-5 + gpt-4o, 2 rounds) surfaced the concrete
gap: the manifest's `_classify` requires `workspaces` / `packs` / `install`,
which this contract's minimal schema deliberately omits. Both members converged
on **Option B**:

- Add `subagent` to `_CATEGORY_VALUES` + `_CATEGORY_SCHEMA` + the `_iter_artefacts`
  glob (`src/subagents/*.md`), and give `_classify` a **subagent branch** that
  derives the manifest payload from the subagent-v1 fields:
  `install: {default: false, removable: true}` (default-off), `packs: []`,
  `workspaces: []`, plus `lifecycle` + `trust`.
- **`packs: []` is legitimate** — "recommended for no pack; included only via
  `include: ["subagent:<name>"]`". The "every artefact belongs to ≥1 pack"
  invariant becomes "every artefact **except subagents**". Verified safe: every
  manifest consumer of `.packs` already guards against empty
  (`check_condensation`, `install`, `condense`, `lint_trust_coherence`), and
  `lint_artefact_frontmatter` does not scan `src/subagents/`.
- The `discovery-manifest.schema.json` `category` enum + `by_category` gain
  `subagent`; the `workspaces`/`packs` `minItems: 1` is relaxed to a documented
  note (non-emptiness for real categories stays enforced by `_classify`).

**Rejected:** Option A (extend the schema with workspaces/packs/install →
duplicate visibility source, de-facto ADR reversal) and Option C (keep subagents
out of the manifest + a parallel name-resolver → duplicate load/parse/validate
pipeline; LSP/tooling would need two discovery paths). "5th discovery category"
is manifest terminology, so Option B satisfies A1 literally.

The manifest (`dist/discovery/discovery-manifest.json`) is a **gitignored** build
artifact — CI rebuilds it fresh, so this is a generator + schema change, not a
committed-data change.

## References

- Council debate 2026-07-04 (claude-sonnet-4-5 + gpt-4o, 2 rounds).
- Amendment-1 council 2026-07-04 (claude-sonnet-4-5 + gpt-4o, 2 rounds) — manifest integration = Option B.
- ADR-034 / ADR-035 — `model_tier` → native model mapping (reused, not replaced).
- `docs/contracts/subagent-boundary.md` — what a subagent owns vs. never owns.
- `src/skills/subagent-orchestration/SKILL.md` — the in-session orchestration modes.
- `road-to-final-state-and-market-readiness.md` — Track A (A1 keystone; A2 pipeline
  proof; A3 eval gate).
