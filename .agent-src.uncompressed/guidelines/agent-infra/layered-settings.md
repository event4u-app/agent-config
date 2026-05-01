# Layered Settings

Two-file settings model: **team defaults** (committed) and
**developer overrides** (git-ignored). Lets a project pin decisions
without forcing every developer to work the same way.

Referenced by `road-to-project-memory.md` Phase 0. Consumed by the
settings loader, the `/onboard` command, and any agent that edits
`.agent-settings.yml` on user request.

## The two files

| File | Git | Scope | Owner | Example values |
|---|---|---|---|---|
| `.agent-project-settings.yml` | **committed** | team / repo | lead maintainer | `project.stack`, `quality.php.tools`, `memory.dogfood` |
| `.agent-settings.yml` | **gitignored** | developer workstation | individual | `personal.ide`, `personal.user_name`, `subagents.max_parallel` |

Both are YAML. Schema is documented in
[`agent-settings.md`](../../templates/agent-settings.md) (dev layer)
and [`agent-project-settings.example.yml`](../../templates/agents/agent-project-settings.example.yml)
(team layer).

## Merge order

Lowest priority → highest priority:

```
1. Package defaults       (shipped by event4u/agent-config)
2. .agent-project-settings.yml   (team file, committed)
3. .agent-settings.yml           (developer file, gitignored)
```

Keys from higher layers win unless the lower layer marks them
`locked`. Locked keys cannot be shadowed by a higher layer.

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

For each section in the template
([`agent-settings.md`](../../templates/agent-settings.md)), walked in
template order:

- Keep the section header and its comments verbatim from the template.
- For each key under the section:
  - **Key exists in user's file** → use the user's current value.
  - **Key missing** → use the template default.
- **Unknown sections/keys** the user has added → preserve at the end
  of the section (or in a trailing `_user:` block if no matching
  section exists).

Invariants:

- Template section **order** always wins — reorder existing keys to
  match.
- Existing scalar values are **never overwritten** unless the user
  asked for that specific change.
- New keys added to the template land with their default value.
- Comments from the template replace user comments in the same
  position — comments are documentation, not user data.
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
