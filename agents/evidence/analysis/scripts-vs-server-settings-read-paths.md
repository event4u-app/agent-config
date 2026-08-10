# Evidence Report — the scripts settings read path vs the server settings read path

> Phase 1 of `road-to-scripts-settings-defaults`. Every claim below cites a
> `file:line` read in this change; nothing here is asserted from memory.
> Tree state: `origin/main` at `e1db2bed6`.

## 1. The two chains, side by side

| | **Scripts family** — `load_agent_settings` | **Server family** — schema + template |
|---|---|---|
| Entry point | `src/scripts/_lib/agent_settings.ts:727` | `src/server/schemas/settings.ts` (mirror) + `src/config/agent-settings.template.yml` (source of truth) |
| Defaults layer | **none** — `const _DEFAULTS: SettingsDict = {}` (`agent_settings.ts:289`) | the template itself; every leaf carries its shipped value |
| Parity pinned by | *nothing* | `tests/server/schemas/parity.test.ts` — fails CI on any key/type drift between template and schema |
| Layer order | defaults < user-global (filtered) < project cascade root→cwd < `agents/settings/.agent-settings.yml` < `.agent-settings.local.yml` (`agent_settings.ts:711-715`, `:757-764`) | template is the base; the wizard writes a sparse file on top |
| User-global filtering | whitelist `MERGEABLE_KEYS` (`agent_settings.ts:255-287`); everything else silently dropped (`:747`) | not applicable |
| Governing ADR | ADR-219 (whitelist contents); `KNOWN_UNFIXED_BY_CARVE_OUT` (`src/shared/settingsCarveOut.ts:132`) records the `projection.*` interaction | — |

The asymmetry the roadmap names is confirmed at line level: `_DEFAULTS` is an
empty object, so on the scripts path an absent key resolves to `undefined` and
**every consumer supplies its own fallback at the read site**. That is not the
same guarantee as the server family's — it is 167 independent guarantees, none
of them pinned.

One seam already exists and is not wired in: `templateDefault(packageRoot, key)`
(`src/scripts/_cli/cmd_settings_get.ts:129`) reads the template and returns a
key's shipped default. It is used **for display only** — `runSettingsGet`
computes `effective` from `load_agent_settings` at `:187` and fetches the
template default separately at `:191` purely to print it as `template_default`
(`:206`). The probe can already *name* the default it never *applies*.

## 2. The read-site census

167 settings reads across 28 files, audited by three independent passes.

| Verdict | Count | Meaning |
|---|---|---|
| AGREE | 48 | read-site fallback === template default; a defaults layer changes nothing |
| NO-TEMPLATE-KEY | 102 | key is absent from the template (76 of them `ai_council.*`, configured via `.ai-council.yml`, not this file) — a defaults layer has nothing to inject |
| NO-FALLBACK | 9 | read site uses `undefined` deliberately (mostly "must be `=== true`" opt-ins) |
| **DIVERGE** | **8 rows / 5 distinct keys** | the live defects this roadmap exists to catch |

### The five diverging keys

| Key | Read site(s) | Fallback | Template | What absent does today |
|---|---|---|---|---|
| `projection.mode` | `condense.ts:1690` | `legacy-all` | `scoped` | projects the full skill/command set instead of the scoped subset |
| `projection.rule_workspaces` | `install/rule_scope_cli.ts:50`, `server/routes/install.ts:234`, `condense.ts:1015` | `null` → LEGACY_ALL | 9-workspace list | ships every rule, incl. maintainer-only ones |
| `chat_history.enabled` | `chat_history.ts:1030`, `work_engine/hooks/settings.ts:151` | `false` | `true` | feature is off-by-default in code, on-by-default on paper |
| `chat_history.frequency` | `chat_history.ts:1140` | `per_phase` | `__CHAT_HISTORY_FREQUENCY__` → `per_turn` | coarser, lossier trail than the template promises |
| `rule_loading_tier` | `_cli/explain_last/inputs.ts:127` | `balanced` | `__RULE_LOADING_TIER__` | an un-substituted placeholder renders as a healthy install |

**Four of the five are already recorded**, as `SETTINGS_CARVE_OUT` rows
(`src/shared/settingsCarveOut.ts:42-116`) — deliberate divergences kept
*because* fixing them at the reader would flip existing installs. The fifth
(`rule_loading_tier`) is a different shape: its template value is an installer
placeholder, not a default at all.

This is the load-bearing finding of Phase 1, and it inverts the naive design:

```
A TEMPLATE-DEFAULTS LAYER THAT INJECTED EVERY TEMPLATE LEAF WOULD BREAK THE
DOCUMENTED UPGRADE-SAFETY CONTRACT. `settingsCarveOut.ts:18-21` states it
outright: changing the projection readers "would flip existing 5.x installs
from legacy-all to scoped, which is the silent narrowing the contract exists
to prevent." The defaults layer must EXCLUDE exactly the carve-out set.
```

After excluding the eight carve-out keys and every placeholder-valued leaf,
**zero known diverging keys remain inside the defaults layer** — which is what
makes the change safe rather than merely small.

## 3. The second reader class — out of scope, named not hidden

The census above covers readers that go **through** `load_agent_settings`.
A mechanical sweep (`readFileSync` of a settings YAML in a file that never
imports the loader) finds **47 further files** that read `.agent-settings.yml`
directly. Three of the eight carve-out rows point into exactly that class:

- `quality.local_auto_run` → `src/scripts/lint_roadmap_ci_steps.ts:82`
- `onboarding.onboarded` → `src/scripts/onboarding_gate_hook.ts:108`
- `profile.id` → `src/scripts/config/profiles.ts:115`

Most of the 47 are hooks and linters that read the file directly to avoid the
loader's startup cost, plus writers and validators that touch the file as data
rather than as settings. **A defaults layer inside `load_agent_settings` does
not reach any of them**, and no honest reading of this change may claim it
does. The roadmap's Goal sentence — "the scripts read path" — is satisfied for
the cascade class only; the bypass class is a separate, larger change with its
own upgrade risk, and it is recorded here rather than absorbed silently.

## 4. What Phase 2 may therefore claim

- An absent key resolves to the template default on the `load_agent_settings`
  path, **except** for the recorded carve-out set and placeholder-valued leaves.
- No key present in any settings file changes its resolved value.
- No AGREE read site changes behaviour (the layer supplies the value the
  fallback already produced).
- `MERGEABLE_KEYS` and ADR-219 are untouched.

## 5. The read-site fallbacks — retired, kept, or explained

Phase 2 asks for redundant fallbacks to be retired and intentional divergences
to be kept with a reason. Inspecting the 48 AGREE sites rather than assuming:

**They are not redundant.** Every one inspected is a *type or enum guard with an
embedded default*, not a bare absence-fallback:

- `knowledge_global.ts:222` — `_deep_default_merge(DEFAULT_CONFIG, block)`, which
  also covers a read error (`:220`) and a non-dict block;
- `command_suggester/settings.ts:65-69` — `_coerce_bool` / `_coerce_floor` /
  `_coerce_nonneg_int`, i.e. coercion with a default, not a lookup;
- `condense.ts:1677` — validates against the `auto|suggest|off` enum before
  accepting, and reads a directly-parsed `data` object rather than the loader's
  dict.

Retiring these would delete input validation and would break the sites that
receive a settings dict from somewhere other than `load_agent_settings`
(the work-engine twin, tests injecting `{}`). They stay, and their role changes
rather than disappearing: they are no longer the *source* of the default —
the layer is — they are the guard against a malformed value. Recorded here so
the next reader does not mistake the duplication for drift.

**One real retirement:** `_DEFAULTS`, the empty defaults slot at
`agent_settings.ts:289` that gave this roadmap its name, is deleted. The
template is now the defaults source; an empty constant merged into every load
would be a misleading second answer to the same question.

**One unexplained divergence closed:** `rule_loading_tier` at
`_cli/explain_last/inputs.ts:127` is the only DIVERGE row without a
`settingsCarveOut` entry. It now carries the reason inline, including the honest
note that a literal placeholder in a settings file is reported as a healthy
`source: default`.

Exit condition met: zero *unexplained* divergences — not zero divergences, which
was never the goal.

## 6. Method

Read sites enumerated by `grep -rl load_agent_settings src/` (31 files, of which
`agent_settings.ts` is the definition and `settingsCarveOut.ts` a comment), then
audited file-by-file against `src/config/agent-settings.template.yml` in three
independent passes. The bypass class was enumerated by the complementary sweep
described in § 3.
