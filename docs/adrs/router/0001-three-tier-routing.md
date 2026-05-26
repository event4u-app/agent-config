# ADR 0001 — Three-tier rule router (kernel · tier-1 · tier-2)

> Area: `router` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: `agents/roadmaps/step-11-ruflo-parity.md` Phase 4 Step 3
> Supersedes: —

## Context

Every rule in `.agent-src.uncondensed/rules/` loads into a host
agent's system prompt. Loading them all is wasteful (the workspace
budget is finite) and noisy (irrelevant rules degrade attention).
The kernel-membership work
([`docs/contracts/kernel-membership.md`](../../contracts/kernel-membership.md))
proved 9 rules are unconditionally relevant; the rest are
situational.

The router question is: **how does a non-kernel rule declare when it
fires, what artefacts carry its body, and how does the host agent
look that up cheaply at session start**.

## Decision

**Three tiers, declared in rule frontmatter, compiled into a single
[`dist/router.json`](../../../dist/router.json), tracked in git.** Host
agents read `dist/router.json` once per session.

### Tier semantics

| Tier | Load behaviour | Workspace cost |
|---|---|---|
| `kernel` | Body injected verbatim every turn | High (capped per ADR-002 · ≤ 26k chars) |
| `tier-1` | Description stub injected; body loaded on trigger | Low (stub only) |
| `tier-2` | No injection; loaded only on explicit trigger match | Zero (until activated) |

The tier value sits in the rule's `tier:` frontmatter key; the
schema enforces the enum (`scripts/schemas/rule.schema.json`).

### Trigger vocabulary

Six match kinds, OR-combined across entries, AND-combined within an
entry's qualifier object (full grammar:
[`rule-router.md`](../../contracts/rule-router.md) § `triggers:` shape):

`keyword` · `phrase` · `intent` · `file_pattern` · `path_prefix` ·
`command`. Kernel rules **forbid** `triggers:` — they are
unconditional by definition.

### Compilation pipeline

1. `scripts/sync.py` projects `.agent-src.uncondensed/` → `.agent-src/`.
2. `scripts/compile_router.py` walks rule frontmatter, validates the
   `routes_to:` targets exist on disk, writes `dist/router.json`.
3. `scripts/skill_linter.py` runs the bidirectional check: every
   `routes_to:` target has a matching `triggered_by:` back-ref.

### `routes_to:` resolution

Plain `<kind>:<id>` strings; kinds are `skill`, `guideline`,
`command`, `contract`. Resolution paths are pinned in
[`rule-router.md`](../../contracts/rule-router.md) lines 73–77 and
enforced by the linter.

## Considered alternatives

### Alt 1 — Single flat list (rejected)

All rules `always`-load.

**Why rejected:** the rules tree is ~70 entries; even with telegraph
condensation the workspace budget blows past the kernel cap. Static
loading wastes attention on rules irrelevant to the current turn.

### Alt 2 — Pure-runtime semantic search (rejected)

Embed every rule, semantic-match the turn against the index, load
top-k.

**Why rejected:** introduces a runtime (this package is a governance
layer, not a runtime — see step-11 scope boundary); index drift adds
a non-trivial maintenance surface; first-turn cold-start is slow.

### Alt 3 — Two tiers (kernel + load-on-trigger, rejected)

Skip the `tier-1` description-stub layer.

**Why rejected:** the stub layer carries 70 % of the "does this turn
need this rule?" signal at < 5 % of the body cost. Removing it
forces the host agent to either over-load (cost spike) or
mis-trigger (correctness loss).

### Alt 4 — Three-tier with frontmatter declaration (accepted)

The chosen path. Kernel + tier-1 stubs (balanced + full profiles) +
tier-2 (full profile only). Cost stays bounded; trigger declarations
diff cleanly in PRs.

## Consequences

- **Positive:** every rule declares its activation cost; the kernel
  cap is enforceable; the host agent's session-start cost is one
  JSON read; the `routes_to:` link makes "where does this rule's
  body live?" answerable without grep.
- **Negative:** two layers of indirection (rule → stub → body)
  raise the bar for new contributors. Mitigated by
  [`rule-router.md`](../../contracts/rule-router.md) being the
  single citable contract and the linter catching shape errors.
- **Reversal cost:** flatten by removing tier-1 / tier-2 distinction
  in the compiler — `dist/router.json` becomes a list of all rules. The
  rule frontmatter stays valid (extra fields are tolerated by
  Draft-07 once `additionalProperties` is relaxed).

## References

- [`docs/contracts/rule-router.md`](../../contracts/rule-router.md) — frontmatter contract.
- [`docs/contracts/kernel-membership.md`](../../contracts/kernel-membership.md) — kernel cap.
- [`dist/router.json`](../../../dist/router.json) — compiled output.
- [`scripts/compile_router.py`](../../../scripts/compile_router.py) — compiler.
- [`scripts/schemas/rule.schema.json`](../../../scripts/schemas/rule.schema.json) — schema.
- [`agents/roadmaps/step-11-ruflo-parity.md`](../../../agents/roadmaps/step-11-ruflo-parity.md) Phase 4 Step 3 — origin.
