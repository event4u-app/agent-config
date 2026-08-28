---
adr: 109
status: accepted
date: 2026-07-04
decision: subagent-v1-contract
supersedes: —
superseded_by: ADR-249
superseded_scope: >-
  The "no daemon" clause of the no-runtime identity floor (`:28`) only,
  superseded by ADR-249. The rest of that floor — no auto-write, no in-process
  swarm, no dispatch we enforce — and the whole subagent-v1 contract stand.
phase: road-to-final-state-and-market-readiness
type: standing
review_trigger: >-
  When a host ships a spawn primitive whose memory-inheritance semantics are documented, OR when a dispatched subagent is observed taking an action the floor forbids
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

> **Amended 2026-08-27 — the "no daemon" clause of that floor is superseded by
> [ADR-249](ADR-249-supervised-resident-process-permitted-under-governance.md).**
> A supervised resident process is permitted in core under the four governance
> conditions ADR-249 states. **The other three clauses of the floor are
> untouched**: no auto-write, no in-process swarm, no dispatch we enforce. The
> sentence above is left standing rather than rewritten, so that a reader who
> cited the floor finds the transition instead of a silent change.

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

**Implementation (`generate_subagent_host_contexts`, condense.ts).** The non-CC
projection emits a passive-reference context file carrying the honest no-dispatch
banner + a governance block (trust level / lifecycle / model tier / tools) + the
body verbatim, reaper-safe per host:

- Cursor → `.cursor/subagents/<name>.md`; Windsurf → `.windsurf/subagents/<name>.md`
  (dedicated subdir with its own reaper — no collision with the aggressive
  `_clean_modern_dir` rule reapers).
- Cline → `.clinerules/<name>.subagent.md` (a real file; that dir's reaper only
  unlinks symlinks, so it survives).
- Copilot / Gemini → skipped (no per-file context surface).

Council (claude-sonnet-4-5 + gpt-4o, 2026-07-05) converged on *project the file*
over honest-null: the body is ~95% reusable review discipline and ~5% dispatch
syntax, so an advanced user loads it on intent and applies the discipline
manually. No ADR amendment was needed — this realises the §4 table as written.

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

## Amendment 2 (2026-07-05) — consumer distribution = wedge-only (A2)

How subagents reach **consumers** (as opposed to the in-repo `.claude/agents/`
projection): a fresh council (**claude-fable-5 + gpt-4o**, 2 rounds) converged on
**wedge-only distribution**, reversing an earlier "synthesis" lean once the
implementation blast-radius evidence was in hand.

- **Decision:** subagents reach consumers ONLY via the wedge
  (`docs/wedge/<name>/<name>.md`, shipped in npm `files[]` via `docs/`, installed
  by a 30-second `curl` into `.claude/agents/`). They are **not** condensed to
  `dist/`, **not** in the install bundle, and **not** in the shared source
  enumeration (`_root_specs()` / `iter_all_sources` / `resolve_logical`).
- **Why not ship in dist (the rejected synthesis):** `condense.cleanup_stale()`
  deletes any `dist/agent-src/` file that does not round-trip through
  `resolve_logical()`, so shipping subagents in dist requires teaching the shared
  `_root_specs()` about them — a cross-cutting change to ~10 consumers
  (`build_discovery_manifest`, three frontmatter/pack linters, namespace checks,
  …). Exclusion-based containment would produce a **shipped-but-ungoverned**
  executable-prompt class — for a *governed* config layer, worse than the blast
  radius it hides. Marginal consumer value at n=1 unit ≈ one fewer curl for an
  opt-in, high-trust artifact — not worth it. Revisit only at n≥3 units **and** a
  documented curl-distribution failure signal.
- **The wedge doc is now a projection of `src/subagents/`** (superseding the
  hand-written copy), regenerated from `generate_claude_subagents()` so the two
  channels cannot drift.

**A2 install-completeness gate** (`tests/scripts/subagent_distribution.test.ts`):
wedge↔src projection fidelity (no drift); coverage (every unit has a wedge doc);
and negative-wiring locks — `resolve_logical('subagents/…')` is null, no
`subagents/` path in `iter_all_sources`, the installer references no
`dist/agent-src/subagents`, and `dist/agent-src/subagents/` does not exist. No
byte-budget check (an arbitrary threshold on a system prompt is cargo-cult).

*(Council side-fix: `AnthropicClient` extracted only `content[0].text`, dropping
extended-thinking models' output — claude-fable-5 returned 3191 output tokens as
empty text. Fixed to join all text-type blocks.)*

## Amendment 3 (2026-08-09) — teammate execution gap (docs-verified)

Teammate execution gap (docs-verified 2026-08-09): a definition run as a
teammate honours `tools` + `model` but NOT `skills`/`mcpServers`; definitions
whose correctness depends on a skill surface must not be team-dispatched until
upstream closes the gap.

- **Consequence for this contract:** §4's cross-host degradation table and §2's
  banned-fields list already assume no in-process skill loading for a
  dispatched unit; this gap extends the same restriction to Claude Code's own
  native team-dispatch path (agent teams, behind
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), not just to the non-CC degraded
  projection.
- **Not a status change.** This amendment records a verified host limitation
  found by re-checking current host documentation; it does not reopen the
  contract or alter `status: accepted`.

## Amendment 4 (2026-08-11) — `tools` admits a scoped grant (additive)

§2's `tools` field was enum-validated against the bare Claude Code tool set, so
`Bash(npm test:*)` was **inexpressible** while
[`tool-safety`](../../src/rules/tool-safety.md) § Scoped grants prescribes the
opposite ("Prefer scoped-grant syntax over bare tool names"). The schema now
validates `tools` with a pattern that keeps the base name closed — a typo still
fails CI — and admits an optional `(...)` suffix.

- **Additive, not a contract change.** Every value the old enum accepted still
  validates; the pattern only widens what a governed definition may express. The
  field stays REQUIRED and stays enum-closed on the base token, which is the
  property the enum was there for. No `status: accepted` change.
- **Expressible is not the same as mandatory.** The one shipped unit
  (`src/subagents/production-validator.md`) keeps an **unscoped** `Bash`
  deliberately, reasoned in its own frontmatter and disposed by a committed
  `security-lint: allow` pragma: its audit must run whatever runner a *consumer*
  project uses, so a portable suite cannot enumerate the command families, and a
  scope that guesses wrong makes the validator report a missing run it was merely
  forbidden to attempt. Least Agency is the narrowest grant that still satisfies
  the task — not the narrowest grant.
- **The detector that reads it.** `lint_skill_frontmatter_safety` scans
  `src/subagents` and reads the top-level `tools:` key, so a bare shell grant on a
  subagent is a HIGH finding that must be narrowed or disposed in the file. Its
  clean-path note names the corpus actually walked, so "is this root scanned?" is
  answerable by running the gate.

## Amendment 5 (2026-08-14) — staged-confirmation semantics on a degraded host

The `requires_confirmation` staging primitive shipped **unbound** because two
questions were open: what a host **without** a `pre_tool_use` slot gets when an
action is staged, and whether the primitive is default-on where the slot does
exist. Both are answered here, so the flag stops meaning "undecided".

- **Degraded host → carry the obligation, and say plainly that it is
  model-carried. Never refuse to stage.** Five of eight hosts have no
  `pre_tool_use` slot (`hook_manifest.yaml:531,539,578`), so there the staging
  record is prose and nothing can refuse the action. That is stated, not
  papered over — the same honesty boundary
  [`security-sensitive-stop`](../../src/rules/security-sensitive-stop.md),
  [`ui-audit-gate`](../../src/rules/ui-audit-gate.md) and
  [`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md) already
  ship as `enforced_by: none`. **Refusing to stage was rejected**, and the
  reason is recorded rather than assumed: it would withdraw the primitive
  exactly where the least protection exists, and it reproduces the defect
  `ui-audit-gate` names in its own text — "a gate whose sole compliant path is
  inaction is not a gate". A staged record a human can read is strictly more
  than no record.
- **Where the slot exists → default-OFF, soak before it binds.** This is the
  package's standing posture for a new concern, not a fresh judgement:
  `docs/contracts/concern-activation-policy.md` governs the flip, the hook
  manifest ships concerns `fail_closed: false`, and the sibling turn-end
  detector in the same roadmap "leaves the master switch off, so a mistake
  soaks before it binds". A confirmation guard that binds on the day it lands
  can only be discovered to be wrong by blocking something real.
- **What this does NOT decide.** Which channel confirms is still open by
  design; the surface names no confirming command, and a test asserts
  `--confirm` does not appear by default. Promotion from default-off to bound
  runs through the activation policy's economic trigger, never through a
  roadmap step.
- **Additive.** No `status: accepted` change; no field added or removed.

## References

- Council debate 2026-07-04 (claude-sonnet-4-5 + gpt-4o, 2 rounds).
- Amendment-2 council 2026-07-05 (claude-fable-5 + gpt-4o, 2 rounds) — consumer distribution = wedge-only.

- Council debate 2026-07-04 (claude-sonnet-4-5 + gpt-4o, 2 rounds).
- Amendment-1 council 2026-07-04 (claude-sonnet-4-5 + gpt-4o, 2 rounds) — manifest integration = Option B.
- ADR-034 / ADR-035 — `model_tier` → native model mapping (reused, not replaced).
- `docs/contracts/subagent-boundary.md` — what a subagent owns vs. never owns.
- `src/skills/subagent-orchestration/SKILL.md` — the in-session orchestration modes.
- `road-to-final-state-and-market-readiness.md` — Track A (A1 keystone; A2 pipeline
  proof; A3 eval gate).
