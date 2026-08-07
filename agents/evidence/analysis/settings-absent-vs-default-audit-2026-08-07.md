# Settings audit — where "absent" does not mean "the template default"

> Blocker deliverable for `road-to-zero-ceremony-settings`
> § `absent-is-not-default-for-projection-mode`, item 1:
> *"Audit every key for absent-vs-default semantics … before, not after."*
>
> Date: 2026-08-07 · Method: three parallel readers over `src/`, one mapping the
> reader topology and two walking the 140 classified keys of
> [`settings-classes`](../../../docs/contracts/settings-classes.md).

## Why the audit was needed

Phase 3 makes the user's global settings file **sparse**. That is safe only
while *key absent* resolves exactly like *key set to the template default*. The
blocker recorded one confirmed counter-example. The audit found **seven**.

## The structural fact that makes divergence possible

`src/scripts/_lib/agent_settings.ts:228` — the canonical loader has **no
defaults layer**:

```ts
const _DEFAULTS: SettingsDict = {};
```

`load_agent_settings` never merges the template. Exactly two places in the tree
do: `src/scripts/install.ts:2057` (`_load_default_settings`) and
`src/server/routes/settings.ts:232` (`loadDefaultSettings`). Every other reader
supplies its own inline fallback at the read site — so a per-key divergence is
possible by construction, and only an audit can tell you which keys have one.

A second, independent gate: `load_agent_settings` **whitelist-filters** the
user-global file to the 12 dotted paths in `MERGEABLE_KEYS`
(`agent_settings.ts:208-226`, applied at `:682`). Its own comment says *"Adding
a key requires an ADR."*

A third, found while auditing: the **zod schema's defaults disagree with the
template** for `projection.mode` (`legacy-all` vs `scoped`,
`src/server/schemas/settings.ts:48`) and `projection.rule_workspaces` (`[]` vs 9
workspaces, `:53`). The schema encodes the *absent-resolution*, not the template
default — so the generated reference page renders `legacy-all` where the template
says `scoped`. Recorded, not repaired: reconciling them changes what the GUI
offers as a default, which is outside this roadmap.

## Findings — nine keys where absent ≠ default

| # | Key | Reader | absent resolves to | template default |
|---|---|---|---|---|
| 1 | `projection.mode` | `install.ts:3409`, `condense.ts:1501` | `legacy-all` | `scoped` |
| 2 | `projection.rule_workspaces` | `rule_scope.ts:94` (`_list`, `:57-63`) | `null` = LEGACY_ALL — every rule ships, incl. 16 maintainer-only ones | 9-workspace list |
| 3 | `profile.id` | `config/profiles.ts:221` | id `developer` but a **degraded** profile: `packs: []`, `personas: []`, `hints: []` | `developer`, loading `profiles/developer.yml` |
| 4 | `quality.local_auto_run` | `lint_roadmap_ci_steps.ts:106` | `true` — which **disables** the CI-step gate | `false` — which **arms** it |
| 5 | `onboarding.onboarded` | `onboarding_gate_hook.ts:99` | gate skipped, as if already onboarded | `false` — gate fires |
| 6 | `subagents.auto` | `routing_doctor.ts:206` | `ask` | `on` |
| 7 | `chat_history.enabled` | `chat_history.ts:1025` | `false` | `true` |
| 8 | `discipline_profile` | `work_engine/_lib/agent_settings.ts:1263` | `essential`, unconditionally | `auto` → `off` on a measured-null host |
| 9 | `chat_history.frequency` | `chat_history.ts:1140` | `per_phase` | `per_turn` |

Row 4 is the sharpest: the polarity is **inverted**, so omitting the key
silently disarms a quality gate while every doc says it is on.

Rows 1 and 2 are **documented on purpose**
(`agent-settings.template.yml:50-53`): *"a missing key also still means
legacy-all, so only fresh installs get the scoped default."* That is the
upgrade-safety contract — it guarantees an upgrade never silently narrows what
an existing install projects.

### Conditional, recorded rather than carved out

`rule_loading_tier` (`work_engine/_lib/agent_settings.ts:1263`) resolves absent →
`essential`, while the default preset (`profiles/minimal.ini`) writes `minimal`
→ `off`. It is inert in any rendered install because `discipline_profile` wins
at `:1239-1249` — and both are preset-filled keys that the installer writes
explicitly, so the sparse file keeps them either way.

## The decision, per key

The blocker allows two branches: **carve out** (keep writing the key) or **fix
at its reader** (make absent resolve to the template default).

**All nine are carved out.** The set and the per-key reason are code, not
prose: [`src/shared/settingsCarveOut.ts`](../../../src/shared/settingsCarveOut.ts).
The values are read out of the template at emit time, so the carve-out list
cannot drift from the defaults it protects.

Fixing at the reader was rejected for rows 1–2 because it would invert the
documented upgrade contract — flipping existing 5.x installs from `legacy-all`
to `scoped`, the exact silent change the contract prevents. For rows 3–7 it was
rejected for a simpler reason: the readers are spread across five modules with
different fallback idioms, and changing seven fallbacks is a wider blast radius
than writing seven keys.

### Departure from the AI council, and why

An AI council (2026-08-07, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds, $0.04)
converged 2/2 on a third option: an `_meta.upgraded_from_5x` marker written once
by the installer, with readers branching on it. Its stated cost was *"~10 lines,
zero schema touch, `_meta` is already a freeform sidecar namespace"*.

**Both load-bearing premises are false in this tree**, checked before adopting:

- There is no `_meta` namespace in `agent-settings.template.yml` or in
  `src/server/schemas/settings.ts`. Provenance lives in a separate **file**,
  `settings/.agent-settings.provenance.json`. A new settings key needs a
  template entry, a schema entry and a class-table row — the parity gate and
  `lint_settings_classes` both fail otherwise. Not zero.
- The marker's own follow-up ("add `projection.*` to `MERGEABLE_KEYS`, or remove
  the whitelist") is ADR-gated by that list's own comment.

The council also cited two files that do not exist
(`docs/decisions/002-settings-as-rules.md`,
`agents/roadmaps/road-to-prod-validation.md`); the argument that survived
without them is the in-tree precedent, recorded below.

Recorded per `decision-revisit-gate`: the marker is a better answer *if* someone
later wants existing installs to migrate to `scoped`. Nothing here forecloses
it.

## Two findings outside this roadmap's scope

Reported, not repaired.

1. **`src/server/routes/install.ts:234` `_globalRuleScope` is already broken**,
   independent of sparseness: it reads `projection.*` through
   `load_agent_settings`, whose whitelist strips it, so it resolves LEGACY_ALL
   even when the user set the key explicitly. Fixing it means widening
   `MERGEABLE_KEYS`, which needs an ADR.
2. **`screenshots.data_bearing_gate` has no reader at all.** It is C-class in
   the contract and present in the template, but
   `skills/screenshot-hygiene/SKILL.md` implements the data-bearing human gate
   unconditionally. Setting the key to `off` does nothing.

## Sibling search — the defect class behind the reference page

While generating the reference page, `subagents.host_capabilities` was missing
from the schema surface: `flattenSurface` recursed on `properties !== undefined`,
and `z.object({}).passthrough()` emits `properties: {}` — defined but empty — so
a free-form map walked zero children and emitted nothing. Its own doc comment
says free-form maps are leaves, so the code contradicted its stated contract.

Exact wrong construct: `node.properties !== undefined` used as a recursion guard
without a non-empty check. **Grepped the tree: 3 sites.** One was
`settingsSurface.ts` (fixed, with a paired positive/contrast test). The other
two are `src/ui/forms/schemaTypes.ts:103` and `:106` — **not fixed, and not a
live defect**: `SettingsHubPage.tsx:239` filters `kind === 'unsupported'` fields
anyway, so fixing them would change which layer drops the field, not whether the
user sees it.
