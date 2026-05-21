---
name: ghostwriter:list
tier: 2
cluster: ghostwriter
sub: list
description: List captured ghostwriter profiles under agents/reference/ghostwriter/ as a numbered table with confidence, last-fetched, and stale-warning flags. Read-only.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "list ghostwriter profiles, show available public-figure voices, which ghostwriters do I have, ghostwriter inventory"
  trigger_context: "user wants to see which ghostwriter profiles exist locally and which are stale"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /ghostwriter:list

Read-only listing of every consumer-side ghostwriter profile under
`agents/reference/ghostwriter/`. Numbered, with the fields needed to pick one
for `/ghostwriter:write` or to spot stale profiles that need a
re-fetch.

## Steps

### 1. Scan

Enumerate `agents/reference/ghostwriter/*.md`, excluding:

- `README.md` (directory anchor, not a profile).
- Any file whose frontmatter carries `fictional: true` (package-side
  fixtures are not consumer profiles; they should never appear in
  `agents/reference/ghostwriter/` — surface a warning if one is found).

For each remaining file, read the frontmatter and extract:

| Field | Source |
|---|---|
| Slug | filename without `.md` |
| Name | `identity.name` |
| Role | `identity.role_or_title` |
| Category | `identity.public_figure_category` |
| Confidence | `identity.confidence` (`low` / `med` / `high`) |
| Verification | `source_provenance.verification` (`fetched` / `user-asserted`) |
| Last fetched | `source_provenance.last_fetched_at` (ISO date) |
| Stale | `last_fetched_at` older than 90 days → `⚠️` |
| User-asserted | `verification == user-asserted` → `⚠️` |

### 2. Render

Empty result → print and exit:

```
No ghostwriter profiles found under agents/reference/ghostwriter/.
Run /ghostwriter:fetch <url-or-name> to capture one.
```

Otherwise, print a numbered table sorted by slug:

```
# Ghostwriters (N profiles)

  #  Slug                       Name              Confidence  Last fetched  Flags
  1  alice-walker               Alice Walker      high        2026-04-12
  2  jane-doe-author            Jane Doe          med         2025-11-03    ⚠️ stale
  3  bob-smith                  Bob Smith         low         2026-05-01    ⚠️ user-asserted

Next: /ghostwriter:show <slug>  ·  /ghostwriter:write --as=<slug>
      /ghostwriter:fetch <slug> --force-refresh   # for stale profiles
```

Column widths are illustrative — pick the widest entry per column.

### 3. Fixture leak warning (defensive)

If Step 1 encountered a `fictional: true` file under
`agents/reference/ghostwriter/`, print **after** the table:

```
⚠️  agents/reference/ghostwriter/<file>.md carries `fictional: true` — fixtures
    belong in the package source, not in consumer ghostwriter/. Move
    or delete this file.
```

This should not normally happen — `scripts/lint_ghostwriter_source.py`
guards the package side (run via the package's CI), and consumer-side
`fetch` always writes `fictional: false`.

## Rules

- **Read-only.** Do not modify or move any file.
- **Do NOT commit, push, or open a PR.** No git ops.
- **Do NOT inline voice samples.** Use `/ghostwriter:show <slug>` for
  the full profile body — this command is an index, not a renderer.
- **Do NOT include `fictional: true` profiles in the main table** —
  they are package-side schema examples, not consumable styles. Surface
  any leak as a separate warning (Step 3).

## See also

- [`/ghostwriter`](../ghostwriter.md) — parent cluster.
- [`/ghostwriter:show`](show.md) — render a single profile in full.
- [`/ghostwriter:fetch`](fetch.md) — refresh stale profiles with `--force-refresh`.
- [`/ghostwriter:write`](write.md) — consume side; reuses the slugs listed here via `--as=<slug>`.
- [`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md) — field definitions used in the table.
