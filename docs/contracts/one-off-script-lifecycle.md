---
stability: beta
---

# One-off-script lifecycle

**Purpose.** Pin the naming, location, age, and purge policy for
**one-off scripts** so the package does not accumulate a graveyard
under `scripts/`. One-off here means: a script written for a
specific migration, retrofit, audit, or council run, with no ongoing
caller and no place in the durable Taskfile.

**Scope.** Defines the file pattern, the directory, the maximum age,
the TTL extension mechanism, and the CI purge gate. Does **not**
specify the content of any specific one-off — that belongs to the
script itself or the cleanup-mechanics context.

Last refreshed: 2026-05-04.

## Naming

One-off scripts MUST match this regex:

```
^_one_off_[a-z0-9-]+\.py$
```

The `_one_off_` prefix is the load-bearing signal. Files outside
this prefix are treated as durable scripts and MUST be referenced by
the Taskfile or by another script.

## Location

```
scripts/_one_off/<YYYY-MM>/_one_off_<slug>.py
```

`<YYYY-MM>` is the UTC month the script was first committed. The
month directory groups one-offs for archival sweeps. Scripts MUST
NOT live at `scripts/_one_off/_one_off_*.py` (no month) or under
`scripts/` directly (no `_one_off/`).

## TTL

| State | Action |
|---|---|
| Age ≤ 60 days from month-directory date | active, no warning |
| 60 < Age ≤ 90 days | warning emitted by `lint_one_off_age.py`, no failure |
| Age > 90 days | `lint_one_off_age.py` fails CI; the script is purged in the next housekeeping pass |

Age = `today − first-of-month(<YYYY-MM>)` in UTC days. The 60-day
soft floor and 30-day grace window are intentional — they cover one
release cycle plus a sprint of grace.

## TTL extension

A one-off MAY extend its TTL exactly once, by adding a frontmatter
block at the top of the script:

```python
"""
---
ttl_extended_until: 2026-08-31
ttl_reason: blocked on PROJ-123 — re-runs after cutover
---
"""
```

The linter respects `ttl_extended_until` if it is ≤ 180 days from
the file's `<YYYY-MM>` directory date. Beyond 180 days, the linter
hard-fails — no second extension. The intent is: if a "one-off" is
still live at six months, it is a durable concern and belongs in
`scripts/` or a Taskfile group.

## Purge mechanism

`lint_one_off_age.py` runs in `task ci`. On a clean working tree, it
prints purge candidates as a list. Purge itself is a separate human-
or-CI action — `task purge-one-offs` removes flagged files. The
linter does not auto-delete.

## Allowed exceptions

Two patterns are exempt from the prefix requirement:

- **Bundler / orchestrator helpers** under `scripts/ai_council/`
  that exist to support the council CLI — they are not one-offs even
  though council *runs* are one-offs.
- **`scripts/_one_off/<YYYY-MM>/README.md`** — a free-form readme is
  allowed in each month directory documenting why the scripts exist.

Council run scripts that wrap a question and write the response file
DO live under `scripts/_one_off/<YYYY-MM>/` and DO follow the prefix
rule.

## Cross-references

- The contract that defines council CLI surface (and so what gets
  archived as a one-off): the council CLI section of the package's
  command catalog.
- The cleanup-mechanics context for housekeeping passes:
  `agents/contexts/cleanup-mechanics.md`.
- Linter implementation: `scripts/lint_one_off_age.py`.

## Stability

Beta. Breaking changes (e.g. raising the age cap, changing the
prefix, or removing TTL extensions) require a minor-version bump and
a `### Breaking` entry in `CHANGELOG.md`.
