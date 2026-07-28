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
| `tier` | yes | `kernel` \| `tier-1` \| `tier-2` | New names. Kernel = always-loaded; tier-1 / tier-2 = trigger-routed on demand, in every discipline profile (ADR-040 / ADR-110). |
| `triggers` | yes for non-kernel | list of objects | When the rule activates. **Forbidden** on kernel rules. |
| `routes_to` | yes for non-kernel | list of strings | Skills / guidelines whose body fulfils the rule. **Forbidden** on kernel rules. |
| `profile` | no | `minimal` \| `essential` \| `full` | Override the tier-derived default profile. Rare; currently unused by any shipped rule. |
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

`src/scripts/compile_router.ts` reads every rule frontmatter and emits
`dist/router.json` (tracked in git), used by host agents at session
start. Deterministic key order, sorted lists, stable across runs.

```json
{
  "schema_version": 2,
  "kernel": ["agent-authority", "ask-when-uncertain", "commit-policy",
             "direct-answers", "language-and-tone", "no-cheap-questions",
             "non-destructive-by-default", "scope-control",
             "verify-before-complete"],
  "tier_1": [{"id": "source-of-truth",
              "triggers": [{"path_prefix": "agents/"},
                           {"path_prefix": "dist/agent-src/"}],
              "routes_to": ["skill:agent-docs-writing"],
              "workspaces": ["agent-config-maintainer"],
              "packs": ["meta"]}],
  "tier_2": [/* same shape as tier_1 */],
  "profiles": {
    "minimal":   ["__kernel__"],
    "essential": ["__kernel__", "downstream-changes"],
    "full":      ["__kernel__", "__tier_1__", "__tier_2__"]
  }
}
```

Generated alongside `marketplace.json` during `task generate-tools`.

### Schema v2 — installation-scoping fields (2026-07-07)

Every **non-kernel** entry carries `workspaces:` and `packs:`, copied
verbatim (sorted) from the rule's frontmatter. They let projection- and
install-time tooling filter rule bodies AND thin-projection pointer lines
by the installed workspace/pack set (`road-to-request-scoped-rule-load`
Phase 1) — per ADR-040 the filtering happens at projection time; there is
no runtime resolver.

- **Additive only.** v1 readers ignore unknown keys; nothing else in the
  shape changed. Readers MUST NOT hard-fail on `schema_version: 2`.
- **Kernel entries stay bare id strings.** The kernel is unconditional
  and workspace-independent by definition — it never carries scoping
  fields and is never filtered by installation.
- **Source of the values:** `src/rules/*.md` frontmatter.
  `lint_artefact_frontmatter` (wired into `task ci`) enforces that every
  rule declares non-empty `workspaces:` + `packs:` lists whose ids exist
  in `src/config/discovery/{workspaces,packs}.yml` — unknown ids fail
  lint before they can reach the router.

### `roles:` — subagent role-scoping axis (road-to-lean-agent-init Phase 4)

A third, additive, optional frontmatter list — `roles:` — parallel to
`workspaces:`/`packs:` but consumed by a different mechanism: `rule_in_scope`
(`src/scripts/condense.ts`) and `RuleScope`/`ruleFileArrives`
(`src/install/rule_scope.ts`), not the `router.json` entry shape above (it
is not currently mirrored into router entries — router.json governs
trigger-based activation, `roles:` governs which rules project into a
given subagent's rule set).

- **Vocabulary:** the six `RoleMode` ids from
  `src/scripts/_lib/subagent_spawn.ts` — `developer`, `reviewer`, `tester`,
  `po`, `incident`, `planner`. Closed vocabulary enforced by the JSON
  Schema `enum` in `src/scripts/schemas/rule.schema.json` (not a
  `src/config/discovery/*.yml` file — see the schema's `roles` property
  description for why).
- **Fail-safe:** an untagged rule (no `roles:` key, or an empty list)
  projects to every role, exactly like an untagged `workspaces:`/`packs:`.
  Kernel rules (`type: always`) always project regardless of `roles:`.
- **Consumer knob:** `projection.rule_roles` in `.agent-settings.yml` (a
  string list), read by `ruleScopeFromSettings` the same way as
  `projection.rule_workspaces` / `projection.rule_packs` — absent/empty =
  no role filtering (today's behaviour, unchanged). `condense.ts`'s
  maintainer-side projection (`generate_rule_symlinks` and friends) does
  not read this key — role scoping is a subagent-spawn-time concern, not
  a package-projection concern; `rule_in_scope`'s new `role_scope`
  parameter is additive and defaults to `null` there.

## Host-native glob activation (Cursor / Windsurf)

Since 2026-07-07 (`road-to-request-scoped-rule-load` Phase 2) the
Cursor/Windsurf projectors derive `globs:` from the rule's path-shaped
triggers: `file_pattern` maps verbatim, `path_prefix` maps as
`<prefix>**`. Rules with ≥1 path-shaped trigger auto-attach host-natively
(Cursor auto-attach / Windsurf `trigger: glob`) — deterministic, no
model-compliance dependency. Keyword/phrase/intent-only rules keep
description-based activation (Agent-Requested / `model_decision`).

**No-double-fire invariant:** when thin projection lands on those hosts, a
glob-attached rule must NOT also ship an eager inline body there — the
host-native attach IS its conditional load. The thin projector treats
glob-capable rules on glob-capable hosts as already-conditional; the
pointer mechanism is for hosts without a native equivalent (Claude Code).

### Profiles — the always-honoured surface (ADR-110)

Profiles name the **always-honoured** rule surface per discipline tier;
entries without the `__` wrapper are individual rule ids. Trigger routing of
tier-1/tier-2 stays active under **every** profile — trigger semantics are
configuration-independent (ADR-040). The runtime knob is
`discipline_profile: auto | off | essential | full` (`off` → `minimal`
surface); resolution semantics (including the legacy `rule_loading_tier`
mapping and the `auto` host-capability check against
`src/config/host-capabilities.yml`) live in `resolve_discipline_profile()`
in the work-engine settings lib.

**`balanced` was retired 2026-07-07** (deleted, not renamed): the size cut
(kernel + tier_1) measured a NULL discipline lift (p=0.81, n=24 —
`docs/benchmark.md § Cost-factor sweep`) because it missed the lift-carrying
`downstream-changes`. Its successor `essential` is cut by measured content
(kernel + the lift-carrying rules; +0.458 lift at ~3.3x tokens, p=0.0135).
Legacy `rule_loading_tier: balanced` values map to `essential`.

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

### Intent-trigger semantics — two gates, two purposes (reconciled 2026-07-07)

Two tools consume `intent:` triggers with deliberately different semantics.
This divergence is **justified and locked**, not drift
(`road-to-token-proof-and-story` Phase 2):

| Tool | Intent semantics | Purpose |
|---|---|---|
| `trigger_coverage.ts` + the golden-set fires-check | word-set inclusion (every alpha word >2 chars of the intent appears in the prompt) | **Falsifiability floor** — a deliberately generous mechanical proxy proving a rule CAN fire on a phrasing; gates coverage claims. |
| `router_telemetry.ts` (replay / field evidence) | informational-only — never auto-matches | **Field estimation** — real hosts resolve intents by model judgment, which cannot be replayed deterministically; pretending the word-set proxy models host behaviour would fabricate activation counts. |

Consequence: **replay UNDERCOUNTS intent-triggered rule loads.** Every
replay-derived figure (field-token-evidence report, benchmark refresh,
release story) MUST state the chosen semantics and carry this caveat. Rules
relying on intent triggers alone have no mechanical signal at all — hence
the intent-only backstop audit (Phase 0 of
`road-to-request-scoped-rule-load`: every intent-only rule gained
keyword/phrase backstops or a written disposition).

## Activation end-state — one runtime knob (token program, 2026-07-07)

Locked by the token-program integration council
(`agents/settings/contexts/token-program-integration-verdict.md`) so no
track ships a competing setting:

- **Runtime:** ONE knob — `discipline_profile: auto | off | essential |
  full` (shipped default `auto` = ON once its evidence gates pass; owned by
  `road-to-discipline-profile-tiering`). Thin projection, when un-deferred,
  folds under `essential` as an implementation detail; `lean_projection.mode`
  is then absorbed/retired. No new runtime toggles for this layer.
- **Install-time (not a runtime setting):** consumer scoping via
  `projection.rule_workspaces` / `projection.rule_packs` — default flips
  `legacy-all` → scoped as a reviewed release decision after the
  misclassification audit (done 2026-07-07) + measured before/after.
- **Host-native (no setting):** Cursor/Windsurf glob auto-attach (§ above)
  is always on — deterministic, no compliance risk.

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
