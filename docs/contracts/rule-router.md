---
stability: beta
keep-beta-until: 2026-08-12
---


# Rule Router — Frontmatter Schema and Compiled Output

Status: locked for Phase 3 of `road-to-kernel-and-router.md`.
Owners: this contract; `src/scripts/compile_router.ts` (Phase 3.2);
`src/scripts/skill_linter.ts` extension (Phase 3.3). <!-- .py owners retired
by the ADR-200 py2ts migration; paths updated 2026-08-03. -->

## Why a router

The kernel (9 rules, ≤ 26k chars per ADR-002) loads on every session.
Every other rule must declare **when it activates** and **which
artifacts (skills / guidelines) carry the body**. The router compiles
those declarations into a deterministic lookup table.

Kernel rules never appear in the router — they are unconditional.

### What reads `router.json` — and what does not

```
THE ROUTER IS A COMPILE-TIME SOURCE FOR HOST-NATIVE EMISSION AND LINT TOOLING.
NO HOST AGENT PERFORMS A RUNTIME LOOKUP AGAINST IT.
```

This paragraph replaced a sentence that said host agents *"read [the table]
once at session start"* (retired 2026-08-08, P3.3 of
`road-to-rule-delivery-integrity`). No host does that.

**Corrected 2026-08-26 — the zero is no longer zero.** This paragraph read
*"`dist/router.json` has 20 consumers across lint, eval, telemetry and prepack
scripts, and **zero** under `src/scripts/hooks/` — no hook slot loads it, and no
slot injects trigger-matched rule bodies."* Both clauses are now false. The
`rule-inject` concern (`src/scripts/hooks/rule_inject_hook.ts:61,196`) calls
`loadRouter` (`src/scripts/_lib/rule_injection.ts:76-79`), and it is bound on
**three** slots — `user_prompt_submit`, `pre_tool_use` and `pre_compact`
(`src/scripts/hook_manifest.yaml:1067,1068,1086`). Injecting trigger-matched
rule bodies is that concern's entire purpose.

**What is still true, and it is the load-bearing half:** the concern is
**DEFAULT-OFF and off means zero bytes.** It returns before reading the router
unless `lean_projection.mode: delivery` is set, and the shipped default is
`eager-all` (`src/scripts/_lib/lean_projection_mode.ts:21`, with anything
unrecognised normalising to it). So under every shipped default nothing loads
`dist/router.json` at runtime — but that is now a **statement about a setting**,
not about the absence of a mechanism, and the two are not interchangeable.

**Unmeasured, stated because the correction invites the question:** the
concern's own header records that its budget row *"is registered against the
per-prompt cap rather than a measured emission: there is no measured emission to
register yet."* Built, bound, default-off, unmeasured. Describing a lookup nobody performs is the posture
ADR-127 rejects: a promised check that does not run is decoration, and a
documented mechanism that does not exist is the same defect one layer up.

The router earns its place as a **compile-time** artifact: it is what the
per-host emitters and the lint / eval / telemetry surfaces read. Activation
itself is per-host, and the mechanism differs per host:

| Host | How a non-kernel rule activates | Emitter |
|---|---|---|
| Cursor | `globs:` + `alwaysApply:` in the emitted `.mdc` | `_emit_cursor_mdc` (`condense.ts`) |
| Windsurf | `trigger: glob \| model_decision` | `_emit_windsurf_rule` (`condense.ts`) |
| Claude Code | `paths:` frontmatter on the file in `.claude/rules/`; a rule **without** `paths:` loads unconditionally at launch | `_emit_claude_rule` (`condense.ts`), planned by `_claude_paths_plan` under `CLAUDE_PATHS_PATTERN_BUDGET`; shipped in PR #1231; contract fixture: `agents/evidence/analysis/claude-code-rules-dir-contract.md` |
| Everything else | the projected file set is the activation surface; no per-host scoping key is known | — |

The Claude Code row **was** the load-bearing gap and is now a narrower one: the
emitter ships, so a rule that declares `paths:` is scoped on that host, while a
rule that declares none still loads unconditionally. The residual gap is
therefore per-rule coverage, not a missing mechanism — and the authority for any
single rule is that rule's emitted frontmatter, never a count written into this
contract. Anything that reads this contract to decide whether a trigger "works"
must read the row for the host in question, not the router.

## Frontmatter schema

All keys live in the rule's existing YAML frontmatter. Existing fields
(`type`, `tier`, `description`, `alwaysApply`, `source`, `load_context`)
are preserved. New / formalized fields:

| Key | Required | Values | Purpose |
|---|---|---|---|
| `type` | yes | `always` \| `auto` | Existing. Kernel = `always`; everything else = `auto`. |
| `tier` | yes | `kernel` \| `tier-1` \| `tier-2` | New names. Kernel = always-loaded; tier-1 / tier-2 = trigger-routed on demand, in every discipline profile (ADR-040 / ADR-110). |
| `triggers` | yes for non-kernel | list of objects | When the rule activates. **Forbidden** on kernel rules. |
| `routes_to` | yes for non-kernel, unless `self_contained: true` | list of strings | Skills / guidelines whose body fulfils the rule. **Forbidden** on kernel rules. |
| `self_contained` | the routes_to carve-out (ADR-210) | `true` | Certifies a rule whose body IS the constraint — a prohibition, gate, or output-format law with no procedure to delegate. Such a rule may offload detail via `load_context:` but declares no `routes_to`. Per-rule certification rationale: ADR-210 appendix. |
| `profile` | no | `minimal` \| `essential` \| `full` | Override the tier-derived default profile. Rare; currently unused by any shipped rule. |
| `triggered_by` | **not implemented** | — | A bidirectional back-ref check was promised by P3.3 but never built; no skill/guideline carries the key and no linter reads it. Recorded honestly per ADR-127 (a promised check that does not run is decoration). Reintroduce only together with its linter. |

### `triggers:` shape

Each item is an object with exactly one match key plus an optional
`reason:` for the linter / docs. Match keys (any of):

```yaml
triggers:
  - keyword: "commit"          # case-insensitive substring of user prompt
  - phrase: "should I commit"  # case-insensitive substring, multi-word
  - file_pattern: "*.tf"       # glob over edited / opened paths
  - path_prefix: "agents/"     # directory prefix over edited / opened paths
  - command: "/commit"         # literal slash-command invocation
```

Multiple `triggers:` entries are OR-combined — any match activates the rule.
Within one entry, only one match key is allowed.

There were once six match keys. `intent:` was **removed** (2026-08-02): it
never auto-matched at runtime, so declaring one gave the author a false
activation path while the rule actually relied on description matching. The
schema's `additionalProperties: false` now rejects it outright. The
`docs/contracts/router-intents.md` vocabulary this section used to cite was
never written.

**`keyword` and `phrase` genuinely differ since 2026-08-03
(road-to-tested-routing Phase 3).** `keyword` is **word-boundary anchored**
via `router_telemetry.ts::keyword_matches_anchored` — an occurrence counts
only when its word-character edges sit on word boundaries (`ac` no longer
fires inside "black"), with two documented reliefs: a punctuation edge
(`__()`, `/image:`, `trans(`) carries no boundary requirement on that side,
and the right boundary accepts one optional plural `s` ("icons" fires
`icon`). Richer inflection (German verb endings: "implementiere",
"committen") is an accepted recall cost — the coverage matrices carry
standalone-token phrasings for inflected languages. `phrase` stays
case-insensitive unanchored substring, so "promote a noisy keyword to a
phrase" is no longer a no-op: it OPTS OUT of anchoring.
`trigger_coverage.ts` consumes the same helper — one matcher source of
truth. Before/after over the 302-prompt matrix-derived corpus:
unintended-activation census 495 → 433, zero intended positives lost
(`internal/bench/reports/router-telemetry/`, 2026-08-03 pair).

**Precision budget — short keywords are ratcheted.** Because the match is an
UNANCHORED substring, a short keyword claims every word that contains it: `AC`
activated `cross-source-consistency` on "black" and "contact"; `CAC` activated
the finance floor on "cache". `src/scripts/lint_trigger_precision.ts` counts
ASCII `keyword` triggers of ≤ 3 characters and fails when the count RISES above
its seeded budget (22, seeded 2026-08-02 after removing those two as provably
redundant). Non-ASCII short keywords are excluded by construction — the eight
emoji triggers on `no-decorative-emojis-in-git-surfaces` are one code point
each and cannot collide with prose. Lowering the budget is a normal commit;
raising it is not the fix. The durable repair — anchoring `keyword` on word
boundaries, which would fix all 316 single-token keywords at once — changes
shipped activation semantics and is deliberately NOT taken by that gate; its
reopen terms live in `internal/bench/layer1-resolver-PREREG.md`.

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
model-compliance dependency. Keyword/phrase-only rules — and rules with no
triggers at all — keep description-based activation (Agent-Requested /
`model_decision`).

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

**Read this first: under every shipped default, nothing loads
`dist/router.json` at runtime.** Corrected 2026-08-26 — this line read
*"nothing loads `dist/router.json` at runtime"* without the qualifier, and a
default-off runtime consumer now exists (see the correction above). The
qualifier is the whole difference: no mechanism versus a mechanism nobody has
turned on. This section
used to describe a per-turn loader — "the host agent reads `dist/router.json`
once per session … active rules are loaded inline" — while § Schema v2 thirty
lines above said, correctly, *"per ADR-040 the filtering happens at projection
time; there is no runtime resolver."* Both could not be true. Reconciled
2026-08-02 (road-to-renewal-foundation Phase 3 step 5) in favour of the tree:
no code implements the loader, and building one is blocked on a transport that
does not exist (`internal/bench/layer1-resolver-PREREG.md` § P1).

What actually happens:

1. **Projection time.** The rule bodies that survive the workspace/pack/role
   scope land as files in the host's own config tree. That set is fixed until
   the next projection — it is the whole mechanism, per ADR-040.
2. **Session time.** The host loads those files the way it loads any
   instruction file. Kernel rules are unconditional by construction: they are
   projected always and carry no scoping fields.
3. **Turn time.** A non-kernel rule "activates" by the MODEL's judgment over
   its description and body, which are already in context. No lookup runs, and
   `triggers:` is not consulted by any host.

So `triggers:` is **declarative metadata, not an execution path**. It exists
for tooling that reasons ABOUT activation — `trigger_coverage` (the
falsifiability floor: can this rule fire on a substring a real prompt
contains?), `router_telemetry` (replay: which rules WOULD a resolver select),
and the trigger-precision ratchet — plus host-native glob attach (§ below),
which is the one place a trigger-shaped field does drive real behaviour, and it
is the host doing it, not this package.

The practical consequence for rule authors: a trigger is a testable claim about
when a rule is relevant, and a wrong one shows up in the coverage and telemetry
reports — but adding a trigger does not make a rule load, and removing one does
not stop it loading. Only the projection scope does that.

This is the same honesty the `intent:` removal applied one level down (§
below): a field that never matched at runtime was giving authors a false
activation path. Here it is the whole per-turn walk that was fictional.

### Intent-trigger semantics — superseded by removal (2026-08-02)

The 2026-07-07 reconciliation locked a deliberate divergence: `trigger_coverage`
matched `intent:` by word-set inclusion as a **falsifiability floor**, while
`router_telemetry` treated the same key as informational-only, because real
hosts resolve intents by model judgment and a word-set proxy would fabricate
activation counts.

That lock is **superseded, not overridden**: it justified a *coexistence*, and
the removal leaves only one party. `intent:` is gone from the schema, from all
44 rules that declared it, and from both matchers. What replaced it:

- `trigger_coverage` now matches `keyword` **and `phrase`** (plain
  case-insensitive substring, the same semantics every other tool already used
  for `phrase`). It never implemented `phrase` before — that gap is why the
  falsifiability floor needed a second, looser matcher at all.
- A rule now proves it can fire on a substring a prompt actually contains,
  rather than on a bag of words. This is a *stricter* floor, and it was
  measured before landing: 25 of 26 coverage cases already passed on `keyword`
  alone; the one that did not (`think-before-action`) had its three intents
  converted to `phrase:` — each is a literal substring of the corpus prompt,
  not an invented phrasing.
- Three rules (`communication-through-line`, `size-enforcement`,
  `telegraph-speak`) declared *only* intents and now carry no triggers. That is
  the honest end state, not a regression: because `intent` never matched at
  runtime, those rules were already description-activated. Removing the
  declaration changed nothing about how they fire — it stopped the file
  claiming an activation path that did not exist.

**Replay still undercounts**, for a different and narrower reason: rules with
no lexical trigger are resolved by model judgment, which static replay cannot
see. The `replay_opaque_triggers` escape hatch in the benchmark corpora
therefore survives the removal — its justification shifts from "intent is
invisible to replay" to "description-activation is invisible to replay".

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

- `task check-router` (`compile_router.ts --check`) — `dist/router.json`
  must equal a fresh compile from frontmatter `triggers:`/`routes_to:`.
- `task check-artefact-checksums` — every artefact's committed checksum
  must match its current source bytes.
- `task lint-projection-fidelity` — the per-tool projections must match
  what the projector would emit from source.

The thin projector inherits all three: a thin projection whose recorded
source hash ≠ current source fails CI before it can ship a stale pointer.

## Linter contract (Phase 3.3)

`src/scripts/skill_linter.ts` (`lint_router_frontmatter`) enforces:

- Every kernel rule has **no** `triggers:` and **no** `routes_to:`.
- Every non-kernel rule has ≥ 1 `triggers:` entry, and either ≥ 1
  `routes_to:` entry **or** `self_contained: true` (the ADR-210 carve-out
  for constraint-only rules) — neither declared is an `error`.
- Every `routes_to:` target exists on disk (`kind:id`, kind ∈ skill /
  guideline / command / contract).
- `tier` and `profile` are in the allowed value sets.

Dropped from the original P3.3 promise: the bidirectional `triggered_by:`
back-ref check was never implemented (no frontmatter carries the key, no
linter reads it) — removed from the contract instead of left as a false
promise; see the frontmatter table above.

## Backward compatibility

- The legacy `tier: "1" | "2" | "2a" | "2b" | "3" | "mechanical-already"`
  values remain readable; the compiler maps them to `kernel` / `tier-1` /
  `tier-2` as locked in `kernel-membership.md` § 4 (status-quo bucket model).
  `2b` → `tier-2` is a recorded decision (2026-08-04): the 21 rules tagged
  `2b` are tier-2 deliberately — before the explicit map entry they reached
  tier-2 only through a silent fallthrough.
- An **unknown tier value fails compilation** (hardened 2026-08-04;
  previously a silent `tier-2` downgrade, so a typo'd tier produced a
  zero-injection failure nobody saw). `tier: "safety-floor"` is
  documentation-only on the `type: always` trio (`commit-policy`,
  `non-destructive-by-default`, `scope-control` short-circuit to `kernel`
  before the map is consulted); on any non-`always` rule it fails
  compilation.
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
