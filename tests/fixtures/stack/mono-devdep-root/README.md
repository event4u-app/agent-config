# `mono-devdep-root` — shared test tooling at the root is not the app

The row Phase 1.1 calls for explicitly: a workspace root that lists `react` in
**`devDependencies`** (shared test tooling — a Testing-Library setup used by
every workspace) beside a `workspaces` declaration, with the actual app in
`apps/web` being Vue.

- **Pre-state, measured at `c7e82087e`:** `frontend: react` — and this one is
  wrong in a way `plain` is not. `_PKG_DEP_KEYS` includes `devDependencies`, so
  the root's test tooling matched the `react` label before any descent could
  run, and the repository was handed a React lane for a Vue application.
- **Post-state (Phase 1):** `frontend: vue`, `scope_root: apps/web`.

The fixture exists because the fix is not "descend when a workspace is
declared" — it is "descend when the workspace root is not itself an app", and
`devDependencies` is precisely where that distinction lives.
