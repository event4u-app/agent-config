# Pipeline B — Augment projection

> **Scope:** project the shipped `.agent-src/` payload into the
> `.augment/` tree that Augment Code (CLI + IDE) reads on startup.

## Input → Transform → Output

```
.agent-src/**                      ← Condensed payload (shipped in @event4u/agent-config)
    ↓ scripts/condense.py:project_to_augment()
.augment/**                        ← Local projection (gitignored on consumer side)
    rules/                         ← copies (Augment historically does not load symlinked rules)
    skills/ commands/ contexts/
    personas/ templates/           ← symlinks into .agent-src/<dir>/
    docs/guidelines/               ← symlink → docs/guidelines/ (only docs/ subdir exposed)
```

The default mode is **copy-rules-symlink-everything-else**. The toggle
`augment.rules_use_symlinks: true` in `.agent-settings.yml` flips
rules to symlinks once the host supports it. The toggle is honored by
both [`scripts/install.sh`](../../scripts/install.sh) on the consumer
side and `project_to_augment()` in the package's own self-projection.

Cross-references inside `.agent-src/rules/*.md` use **relative paths
from `.agent-src/rules/`** (e.g. `../contexts/execution/foo.md`).
After projection, those paths resolve through the symlinks in
`.augment/`. The host agent reads `.augment/`, follows the symlink to
`.agent-src/`, and lands on the payload.

## Entry points

| Surface | Command |
|---|---|
| Project self-projection | `task sync` (`project_to_augment()` step) — [`taskfiles/content.yml:4`](../../taskfiles/content.yml) |
| Standalone project-augment | `task project-augment` — [`taskfiles/content.yml:23`](../../taskfiles/content.yml) |
| Consumer install | `scripts/install.sh` (delegates to `scripts/install.py`) |
| Direct script | `python3 scripts/condense.py --project-augment` |

## Invariants

1. **`.augment/rules/` are real files** by default — symlinks break
   Augment's rule loader on current versions.
2. **Symlink targets exist** — `task sync-check` verifies every
   `.augment/` symlink resolves into `.agent-src/`.
3. **Single docs subtree** — only `docs/guidelines/` is exposed; the
   `docs/contracts/` and `docs/decisions/` trees stay package-internal
   (rules inline 2–3 line excerpts instead of linking out).
4. **Idempotent** — re-running projection on a clean tree must
   produce no diff. Enforced by CI.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Rule not loading in Augment | rule was symlinked instead of copied | unset `augment.rules_use_symlinks` or re-run `task project-augment` |
| Broken `load_context:` path | symlink target missing in `.agent-src/` | run `task sync` first (Pipeline A must succeed) |
| `task sync-check` fails on clean tree | source edited but `.augment/` not regenerated | `task sync` |
| Stale skill / command in `.augment/` after rename in source | projection didn't clean orphans | `task project-augment` re-runs cleanup |

## Proving the pipeline

- [`tests/test_condense.py`](../../tests/test_condense.py) §
  `test_project_to_augment_rules_mode_toggle` and surrounding cases
  — exercises both copy-mode and symlink-mode for rules; verifies
  symlink targets for skills / commands / contexts.
- [`scripts/smoke_path_resolution.py`](../../scripts/smoke_path_resolution.py)
  — walks `.augment/rules/*.md` and resolves every `load_context:`
  entry; non-zero exit means a consumer would see the same break.

← [Architecture overview](../architecture.md)
