---
stability: beta
keep-beta-until: 2026-08-12
---


# Rule Router — Frontmatter Schema and Compiled Output

Status: locked for Phase 3 of `road-to-kernel-and-router.md`.
Owners: this contract; `scripts/compile_router.py` (Phase 3.2);
`scripts/skill_linter.py` extension (Phase 3.3).

## Why a router

The kernel (9 rules, ≤ 26k chars per ADR-002) loads on every session.
Every other rule must declare **when it activates** and **which
artifacts (skills / guidelines) carry the body**. The router compiles
those declarations into a deterministic lookup table that host agents
read once at session start.

Kernel rules never appear in the router — they are unconditional.

## Frontmatter schema

All keys live in the rule's existing YAML frontmatter. Existing fields
(`type`, `tier`, `description`, `alwaysApply`, `source`, `load_context`)
are preserved. New / formalized fields:

| Key | Required | Values | Purpose |
|---|---|---|---|
| `type` | yes | `always` \| `auto` | Existing. Kernel = `always`; everything else = `auto`. |
| `tier` | yes | `kernel` \| `tier-1` \| `tier-2` | New names. Kernel = always-loaded; tier-1 = balanced + full; tier-2 = full only. |
| `triggers` | yes for non-kernel | list of objects | When the rule activates. **Forbidden** on kernel rules. |
| `routes_to` | yes for non-kernel | list of strings | Skills / guidelines whose body fulfils the rule. **Forbidden** on kernel rules. |
| `profile` | no | `minimal` \| `balanced` \| `full` | Override the tier-derived default profile. Rare; used only when a tier-2 rule must ship in `balanced`. |
| `triggered_by` | back-ref, on routed artifact | list of strings | Skill / guideline frontmatter declares which rule(s) route to it. Bidirectional check (P3.3). |

### `triggers:` shape

Each item is an object with exactly one match key plus an optional
`reason:` for the linter / docs. Match keys (any of):

```yaml
triggers:
  - keyword: "commit"          # case-insensitive substring of user prompt
  - phrase: "should I commit"  # case-insensitive substring, multi-word
  - intent: "git-write"        # named intent token (router-defined vocabulary)
  - file_pattern: "*.tf"       # glob over edited / opened paths
  - path_prefix: "agents/"     # directory prefix over edited / opened paths
  - command: "/commit"         # literal slash-command invocation
```

Multiple `triggers:` entries are OR-combined — any match activates the rule.
Within one entry, only one match key is allowed. The router-defined
intent vocabulary lives in `docs/contracts/router-intents.md` (Phase 3.2).

### `routes_to:` shape

Plain string list. Each entry is `<kind>:<id>`:

```yaml
routes_to:
  - skill:php-coder
  - guideline:agent-infra/asking-and-brevity-examples
  - command:onboard
  - contract:command-suggestion-flow
```

`kind` is one of `skill`, `guideline`, `command`, `contract`. `id`
resolves to the target file under:

| kind | path |
|---|---|
| `skill` | `.agent-src.uncondensed/skills/<id>/SKILL.md` |
| `guideline` | `docs/guidelines/<id>.md` |
| `command` | `.agent-src.uncondensed/commands/<id>.md` |
| `contract` | `docs/contracts/<id>.md` |

Linter checks each target exists. `command` is for procedural rules
that route to a slash-command's source file. `contract` is for rules
whose body is fully covered by an existing architectural contract.

## Compiled output — `router.json`

`scripts/compile_router.py` reads every rule frontmatter and emits
`dist/router.json` (tracked in git), used by host agents at session
start. Deterministic key order, sorted lists, stable across runs.

```json
{
  "schema_version": 1,
  "kernel": ["agent-authority", "ask-when-uncertain", "commit-policy",
             "direct-answers", "language-and-tone", "no-cheap-questions",
             "non-destructive-by-default", "scope-control",
             "verify-before-complete"],
  "tier_1": [{"id": "augment-source-of-truth",
              "triggers": [{"path_prefix": "agents/"},
                           {"path_prefix": "dist/agent-src/"}],
              "routes_to": ["skill:agent-docs-writing"]}],
  "tier_2": [/* same shape as tier_1 */],
  "profiles": {
    "minimal":  ["__kernel__"],
    "balanced": ["__kernel__", "__tier_1__"],
    "full":     ["__kernel__", "__tier_1__", "__tier_2__"]
  }
}
```

Generated alongside `marketplace.json` during `task generate-tools`.

## Activation semantics

The host agent reads `dist/router.json` once per session. Per turn:

1. Always evaluate kernel rules.
2. If `profile = minimal` → stop after kernel.
3. Otherwise, walk tier_1 (and tier_2 if `profile = full`); a rule
   activates when **any** of its `triggers:` matches the current
   prompt + open files + invoked command.
4. Active rules are loaded inline; their routed artifacts (`skill:`
   or `guideline:`) are surfaced to the agent for that turn.

No runtime profile resolution — the profile is fixed at session
start, the router lookup is keyword/phrase/path/intent matching only.

## Kill-switch — thin-projection rollback (lean-initial-context Phase 2.3)

Phase 3 of the lean-initial-context migration makes the per-tool projector
emit the kernel full-bodied and every non-kernel rule as a one-line
router-resolved pointer. That is the suite's biggest behavioural change, so
it ships behind a **single documented flip** that restores today's
full-eager projection:

```yaml
# .agent-settings.yml
lean_projection:
  # thin     = kernel full-bodied + non-kernel rules as router pointers (Phase 3)
  # eager-all = every rule body inlined into every projection (today's behaviour)
  mode: eager-all   # DEFAULT until Phase 3.1 ships + its benchmark gate is green
```

Revert procedure (one flip, no code change): set `lean_projection.mode:
eager-all`, run `task generate-tools` (regenerates `.claude/`, `.cursor/`,
`.clinerules/`, `.windsurfrules`) + `task sync` (`dist/agent-src/`, `.augment/`).
The thin projector (Phase 3.1) MUST honour this key; with it absent or
`eager-all` the projector behaves exactly as today. Default stays
`eager-all` so the migration is opt-in and reversible by one line.

### Staleness guard — `src → dist`

A projection or router that drifts from source silently re-introduces the
eager bytes (or a missing pointer target). Three CI gates enforce
`src == dist`, all already wired into `task ci`:

- `task check-router` (`compile_router.py --check`) — `dist/router.json`
  must equal a fresh compile from frontmatter `triggers:`/`routes_to:`.
- `task check-artefact-checksums` — every artefact's committed checksum
  must match its current source bytes.
- `task lint-projection-fidelity` — the per-tool projections must match
  what the projector would emit from source.

The thin projector inherits all three: a thin projection whose recorded
source hash ≠ current source fails CI before it can ship a stale pointer.

## Linter contract (Phase 3.3)

`scripts/skill_linter.py` extension enforces:

- Every kernel rule has **no** `triggers:` and **no** `routes_to:`.
- Every non-kernel rule has ≥ 1 `triggers:` entry and ≥ 1 `routes_to:` entry.
- Every `routes_to:` target exists on disk.
- Every routed skill / guideline declares `triggered_by:` listing the rule(s)
  that route to it (bidirectional check; mirrors the existing back-ref
  pattern in `scripts/check_references.py`).
- `tier` and `profile` are in the allowed value sets.

## Backward compatibility

- The legacy `tier: "1" | "2" | "2a" | "3" | "mechanical-already"` values
  remain readable; the compiler maps them to `kernel` / `tier-1` / `tier-2`
  as locked in `kernel-membership.md` § 4 (status-quo bucket model).
- Rules without `triggers:` keep firing under their current `description`-
  matching behaviour until P4.x migrations land — the linter only enforces
  presence; activation falls back to `description` for unmigrated rules.
- The router is **additive** to the existing always/auto split; no
  existing rule changes behaviour until its frontmatter is migrated.

## Source-of-truth

- This file: schema specification.
- `kernel-membership.md` § 4: kernel locked count + SHAs.
- `rule-classification.md`: per-rule tier + disposition pre-Phase-4.
- `dist/router.json` (generated): runtime artifact, never hand-edited.
