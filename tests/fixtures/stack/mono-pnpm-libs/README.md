# `mono-pnpm-libs` — workspaces declared only in YAML, under a non-conventional directory

`pnpm-workspace.yaml` globs `libs/*`, the root `package.json` has no
`workspaces` key. `libs` happens to be in `_WORKSPACE_DIRS`, so the fallback
directory scan can find it — but the fixture's job is Phase 1.2: the YAML
`packages:` list must be read as a **declarative** source, the same way
`package.json#workspaces` is.

- **Pre-state, measured at `c7e82087e`:** `frontend: plain`.
- **Post-state (Phase 1):** `frontend: react`, `scope_root: libs/ui`.
