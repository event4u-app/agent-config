---
stability: beta
keep-beta-until: 2026-10-06
---

# Surface Matrix — per-tool canonical-surface contract

> Machine-checked inventory of which install surface is canonical per tool,
> which alternates are legitimate, what counts as a duplicate surface, and
> how a duplicate converges. One data file replaces 23 hand-maintained
> special cases (council Q3, 2026-07-07 — see
> `agents/settings/contexts/claude-code-single-surface-decision.md` for the
> parent decision).

## The file

`src/config/surface-matrix.yml` — ships in the npm package, resolved at
runtime relative to the package root (works from both the tsx dev path and
the bundled CLI).

```yaml
schema_version: 1
tools:
  <tool-id>:                # must exist in install.ts::USER_SCOPE_PATHS
    surface: projection | plugin | bundles | export-only
    scope_path: "~/..."     # must equal USER_SCOPE_PATHS[tool-id]
    hooks: managed-settings-block | settings-hooks-opt-in | plugin | none
    alternates:             # optional — legitimate secondary surfaces
      - id: <slug>
        role: <why it is legitimate>
        detail: <prose>
    duplicate:              # optional — the duplicate-surface class
      description: <prose>
      detect:
        all_of: [<path>, …] # ~/ = user scope, ./ = package-relative;
                            # ALL present ⇒ duplicate surface exists
      # OR, when suspected but unverified:
      pending_evidence: <prose + pointer to the evidence gate>
    converge:               # required when detect is defined
      action: <slug>
      command: "<copy-paste fix>"
      reaps: [<path>, …]    # package-tagged locations converge may remove
    notes: <provenance>
```

## Semantics

- **`surface`** — `projection` (installer writes content into the user
  scope path; that projection is canonical), `plugin` (the tool's own
  plugin channel is canonical — e.g. Copilot, where no user-scope
  projection exists), `bundles` (manual import artifacts, e.g.
  Claude Desktop ZIPs), `export-only` (config/marker export, no content
  tree).
- **`duplicate.detect.all_of`** — existence checks only, never content
  reads. All paths present ⇒ the duplicate class is live. Tools without a
  `detect` block are never flagged.
- **`pending_evidence`** — documents a *suspected* class that MUST NOT be
  acted on (doctor ignores it, converge refuses it) until an evidence gate
  defines real detect paths. Current example: Augment
  (`agents/settings/contexts/augment-surface-parity.md`).
- **`converge`** — the consented cleanup. `converge.reaps` is the
  exhaustive allowlist of what `agent-config converge` may remove for this
  tool; anything outside it is refused (hard floor: never user-authored
  files).

## Consumers

| Consumer | What it reads | Behavior |
|---|---|---|
| `agent-config doctor` (`surface-state` check) | `duplicate.detect.all_of` | Existence-checks every declared duplicate class; `fail` names the tool + the `converge.command` as copy-paste remedy. The legacy `claude-plugin` check stays as the named first consumer with richer version diagnostics. |
| `agent-config converge` (+ `upgrade --converge`) | `converge.*` | Performs the per-tool cleanup, only on matrix-declared, package-tagged paths (`converge.reaps`), after consent (`install.auto_converge` or interactive y/N). |
| `dispatch:hook` `surface-probe` concern | `duplicate.detect.all_of` | Once-per-day SessionStart existence probe; one-line nudge naming the duplicate + the converge command. Fail-open, never blocking. |
| CI (`task lint-surface-matrix` → `src/scripts/lint_surface_matrix.ts`) | whole file | Set equality with `USER_SCOPE_PATHS`, scope-path drift, enum validity, detect-path resolution, converge-command presence, plugin-id drift guard. |

## Onboarding a new tool

1. Add the tool to `install.ts::USER_SCOPE_PATHS` (and `SCOPE_SUPPORT`,
   deploy sources) as usual.
2. Add the matrix entry in the same commit — `lint-surface-matrix` fails
   the build on a missing entry (that is the point: no tool ships without
   a declared canonical surface).
3. Default shape for a plain projection with no plugin channel:
   `surface: projection`, `hooks: none`, no `duplicate` block.
4. Only add a `duplicate` block when a second install channel actually
   exists for the tool — and only add `detect.all_of` once the class has
   been reproduced on a real setup (evidence gate; until then use
   `pending_evidence`).

## Consent model (converge)

- First `agent-config converge` run persists `install.auto_converge: true`
  into the **global** settings file
  (`~/.event4u/agent-config/agent-settings.yml`). The key is read directly
  by the CLI (converge/upgrade); it is intentionally NOT part of the
  `MERGEABLE_KEYS` whitelist — it never merges into project-level agent
  settings and never reaches session context.
- Plain `upgrade` without the key keeps the print-only prompt (no silent
  mutation of a user-owned surface — council Q2, 2026-07-07).
- `converge --dry-run` prints the exact actions without touching anything.

## See also

- `agents/settings/contexts/claude-code-single-surface-decision.md` —
  parent decision (single surface for Claude Code).
- `agents/settings/contexts/augment-surface-parity.md` — the Augment
  evidence gate that keeps its duplicate class `pending_evidence`.
- `docs/contracts/skill-distribution-channels.md` — canonical-channel
  contract the matrix operationalizes.
