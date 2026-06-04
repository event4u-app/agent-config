# Layered Settings

Three-file settings model: **team defaults** (committed),
**user-global DX-comfort defaults** (per-developer, cross-project), and
**developer overrides** (per-project, git-ignored). Lets a project pin
decisions, a developer carry DX preferences across every project, and
project-local choices always win.

Referenced by `road-to-project-memory.md` Phase 0 and
`road-to-portable-dev-preferences.md`. Consumed by the centralized
settings loader at
[`scripts/_lib/agent_settings.py`](../../../src/scripts/_lib/agent_settings.py),
the `/onboard` command, and any agent that edits `.agent-settings.yml`
on user request.

## The three files

| File | Git | Scope | Owner | Example values |
|---|---|---|---|---|
| `.agent-project-settings.yml` | **committed** | team / repo | lead maintainer | `project.stack`, `quality.php.tools`, `memory.dogfood` |
| `~/.event4u/agent-config/agent-settings.yml` | **n/a** (outside repo) | individual developer · cross-project | individual | `name`, `ide`, `rule_loading_tier`, `personal.bot_icon`, `personal.autonomy`, `telegraph.speak_scope` (legacy `~/.config/agent-config/agent-settings.yml` read as fallback) |
| `agents/settings/.agent-settings.yml` | **gitignored** | individual developer · this project | individual | `personal.ide`, `personal.user_name`, `subagents.max_parallel`, `onboarding.onboarded` |

> **Canonical location (ADR-038):** the developer file lives in the settings
> layer at `agents/settings/.agent-settings.yml` (alongside
> `.agent-settings.local.yml`, `contexts/`, `policies/`). A repo-root
> `.agent-settings.yml` is read as a **back-compat fallback** and is migrated
> into the canonical location by `install` on the next run.

All three are YAML. Schemas:

- Developer (project-local): [`agent-settings.md`](../../templates/agent-settings.md).
- Team: [`agent-project-settings.example.yml`](../../templates/agents/agent-project-settings.example.yml).
- User-global: six exact dotted paths — whitelist in
  [`scripts/_lib/agent_settings.py`](../../../src/scripts/_lib/agent_settings.py).

## Merge order

Lowest priority → highest priority:

```
1. Package defaults                                   (shipped by event4u/agent-config)
2. ~/.event4u/agent-config/agent-settings.yml         (user-global · whitelist-filtered · legacy ~/.config/agent-config/ read as fallback)
3. .agent-project-settings.yml                        (team file, committed)
4. agents/settings/.agent-settings.yml                (developer file, gitignored; legacy repo-root .agent-settings.yml read as fallback — ADR-038)
```

Keys from higher layers win unless a lower layer marks them
`locked` (team file only). The user-global file does **not** support
`locked` — its purpose is cross-project comfort, never policy.

## User-global whitelist

Only these exact dotted paths are mergeable from the user-global file;
every other key is silently dropped by the loader. The whitelist is
intentionally tiny — adding a key requires an ADR.

```
name
ide
rule_loading_tier
personal.bot_icon
personal.autonomy
telegraph.speak_scope
```

Loader contract:

- **Read-only.** The loader never creates, modifies, or deletes the
  user-global file. Writes are the exclusive responsibility of the
  `/onboard` command on explicit user opt-in.
- **Tolerant.** Missing file, malformed YAML, empty file — all fall
  back to the next tier without raising.
- **Silent on out-of-whitelist keys.** `verbose=True` logs which keys
  were dropped for debugging; default mode is silent.
- **Never auto-creates `~/.event4u/agent-config/`** (nor the legacy
  `~/.config/agent-config/`). The new directory is created by the
  migration shim or by `/onboard` on opt-in; key installation also
  `mkdir -p`s as needed.

## Lock semantics

`.agent-project-settings.yml` has a top-level `locked_keys` list.
Any key listed there cannot be overridden from `.agent-settings.yml`:

```yaml
# .agent-project-settings.yml
quality:
  php:
    tools: [phpstan, rector, ecs]

locked_keys:
  - quality.php.tools
```

Even if a developer's `.agent-settings.yml` sets
`quality.php.tools: [pint]`, the resolved value stays
`[phpstan, rector, ecs]`. The loader emits a one-line warning
when it ignores a locked override.

### When to lock

- **Correctness** — test framework, database driver, seeder ordering.
- **Compliance** — code style enforced by CI.
- **Team-wide rituals** — mandatory pre-commit checks.

### When NOT to lock

- Personal preferences — IDE, output verbosity, name.
- Performance knobs the developer should tune to their hardware.
- Anything that slows down onboarding without a correctness payoff.

Err on the side of **not** locking. Every locked key reduces
autonomy. Unlock by removing the entry from `locked_keys` — no
migration needed.

## Migration from a single file

Repos that currently ship only `.agent-settings.yml` (often
mistakenly committed) migrate by:

1. Create `.agent-project-settings.yml` from the example template.
2. Move team-wide keys (`project.*`, `quality.*`, `memory.*`,
   `review_routing.*`, `roles.*`) into the new file.
3. Leave personal keys (`personal.*`, `subagents.*`, `github.*`)
   in `.agent-settings.yml`.
4. Commit `.agent-project-settings.yml`.
5. Confirm `.agent-settings.yml` is in `.gitignore`; add it if not.
6. Remove any previously-committed `.agent-settings.yml` from the
   repo history only if it leaked personal tokens. Otherwise leave
   it — future commits supersede.

The `/onboard` command and any agent that edits settings on user
request should walk steps 1–3 and 5 automatically when it detects
a one-file setup.

## .gitignore expectations

```
# .gitignore
.agent-settings.yml              # developer-local, NEVER committed
.agent-settings.backup.*         # migration backups
!.agent-project-settings.yml     # explicitly NOT ignored
```

The final negated entry protects the team file if a broader
pattern (e.g. `*.yml` in a nested folder) would otherwise match.

## Consumption

- **Skills** read settings via the loader, never by parsing YAML
  directly. The loader returns the merged view already.
- **Commands** that mutate settings must state which layer they
  write to. Writing to the wrong layer is a spec bug.
- Writes to either file MUST follow the [section-aware merge
  rules](#section-aware-merge-rules) — preserve existing values,
  template order, and comments. No ad-hoc YAML rewrites.

## Module discovery

Module-aware skills and commands (`module-management`, `/module
explore`, `/module create`, roadmap-writing) consult the `modules:`
block on the **team** layer
([`agent-project-settings.example.yml`](../../templates/agents/agent-project-settings.example.yml))
to find module roots, namespace conventions, and per-module
`agents/` folders. Lives next to `project.stack` because it
describes the same thing — repo layout.

| Key | Default | Purpose |
|---|---|---|
| `modules.enabled` | `false` | Master switch; when off, every module-aware surface treats the repo as flat |
| `modules.root_paths` | `[]` | Repo-relative directories whose direct children are modules |
| `modules.namespace_template` | `""` | Substitution template (`{ModuleName}`) for stacks with a PHP-style namespace |
| `modules.agent_folder` | `"agents"` | Per-module folder the agent auto-loads on `/module explore <Name>` |
| `modules.skip_dirs` | `[".module-template", ".example"]` | Directory names skipped during enumeration |

Stack-by-stack starting points (manual setup; the installer fills
these on opt-in when it detects a known shape):

```yaml
# Laravel HMVC
modules:
  enabled: true
  root_paths: [app/Modules]
  namespace_template: "App\\Modules\\{ModuleName}\\App"

# Symfony DDD-lite (or PHP with a single src tree)
modules:
  enabled: true
  root_paths: [src]
  namespace_template: "App\\{ModuleName}"

# Node monorepo
modules:
  enabled: true
  root_paths: [packages]
  namespace_template: ""

# Go internal layout
modules:
  enabled: true
  root_paths: [internal]
  namespace_template: ""
```

Multi-root repos list each root once; enumeration walks every
listed root and merges results.

Lock via `locked_keys: [modules.root_paths]` when the layout must
not drift between developers — typical for compliance-critical or
multi-team repos.

## Persona-list merge semantics

Persona configuration does **not** follow the simple "higher layer
wins" rule — lists merge with explicit override and ignore hooks.

| Key | Layer | Role |
|---|---|---|
| `personas.default` | project | Team default cast (list of ids) |
| `personas.specialists.auto_include` | project | Specialists auto-added on every multi-lens run |
| `personas.override` | developer | Full replacement of `personas.default` for this developer (empty = inherit) |
| `personas.ignore` | developer | Ids dropped from the effective cast |
| `.augmentignore` | workstation | Persona files physically hidden from the agent |

**Resolution order** for the effective cast of a multi-lens skill:

1. Start with `personas.default` from the project file.
2. If `personas.override` is non-empty, **replace** the list (not merge).
3. Add every id from `personas.specialists.auto_include`.
4. Remove every id from `personas.ignore`.
5. Remove every id whose file is matched by `.augmentignore`.
6. If the skill's own frontmatter pins `personas: [...]`, that wins
   over all of the above — the skill is the authority for its own
   cast.

An id removed in step 4 or 5 stays **invokable** via explicit
`--personas=<id>` on the skill invocation. Ignore hides the id from
the default cast; it does not blacklist it.

If the project locks `personas.default` via `locked_keys`, steps 2
and 4 are ignored with a one-line warning — the developer cannot
narrow a team-locked cast.

## Section-aware merge rules

Any agent that writes `.agent-settings.yml` or
`.agent-project-settings.yml` on the user's behalf (including
`/onboard`, `/set-cost-profile`, and ad-hoc "change value X" requests)
MUST follow these rules. Initial file creation and legacy migration
are owned by `scripts/install.py`; these rules govern every edit
after that.

The contract is **additive merge with user-line preservation** —
the user's file is the ground truth, the template only contributes
keys the user is missing. Round-trip parser and merger live in
[`scripts/sync_yaml_rt.py`](../../src/scripts/sync_yaml_rt.py); the
supported YAML subset (block-mappings, scalars, lists, comments,
CRLF/LF) is documented in its module docstring. The stdlib-only
choice (vs. `ruamel.yaml`) and its revisit triggers are recorded in
[`docs/contracts/adr-settings-sync-engine.md`](../../contracts/adr-settings-sync-engine.md).

For each section in the template
([`agent-settings.md`](../../templates/agent-settings.md)):

- For each key under the section:
  - **Key exists in user's file** → keep the user's line **verbatim**
    (value, quoting, inline comment, indent — all preserved).
  - **Key missing** → insert the template's line at the position
    after the user's last preceding sibling that is also in the
    template (max-index insertion).
- **Unknown sections/keys** the user has added → preserved verbatim
  at their existing position. They are not moved to a trailing
  `_user:` block, not re-prefixed, not flattened.

Invariants:

- **User order wins.** Template order is only consulted to decide
  where to insert missing keys; existing user keys are never
  reordered.
- Existing scalar values are **never overwritten** unless the user
  asked for that specific change.
- New keys added to the template land with their default value and
  the template's leading comments.
- **User comments are preserved verbatim** on every existing key.
  Template comments only land with keys the merger inserts; once a
  key is in the user's file, its surrounding comments are owned by
  the user.
- Legacy `_user._user.foo` corruption (accumulated by older buggy
  syncs) heals on the next sync — the leading `_user.` chain is
  stripped and the leaf is re-homed at its template path, or kept
  as a single-level orphan under `_user:` if no template home
  exists.
- Write with 2-space indent, no tabs, no trailing whitespace.
- Never commit — `.agent-settings.yml` is git-ignored.
- If a legacy flat `.agent-settings` (key=value) is still present,
  stop and tell the user to run `scripts/install` — migration is the
  installer's job, never the agent's.

Template drift (new keys shipped by a package update) is resolved by
re-running `scripts/install` or by the agent walking these rules on
the next explicit settings edit.

## Anti-patterns

- **Do NOT** commit `.agent-settings.yml`. It contains developer
  identity and potentially secrets.
- **Do NOT** put personal preferences in `.agent-project-settings.yml`.
  The team file is not a place to publish your IDE choice.
- **Do NOT** lock every key "just to be safe". Locking is an
  intervention, not a default.
- **Do NOT** merge settings in skill code. The loader owns the
  merge; duplicating it creates drift.

## See also

- [`agent-settings.md`](../../templates/agent-settings.md) — dev-layer schema
- [`agent-project-settings.example.yml`](../../templates/agents/agent-project-settings.example.yml) — team-layer template
