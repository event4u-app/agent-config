# `mono-pnpm-turbo` — the shape M1 was written for and never reached

A pnpm + Turborepo monorepo as the tooling actually scaffolds one: a private
root manifest that installs `turbo`, workspace globs declared in
`pnpm-workspace.yaml`, and two workspaces — a Next app and a shadcn design
system that carries its **own** `components.json` (per ui.shadcn.com/docs/monorepo,
the root carries none).

- **Pre-state, measured at `c7e82087e`:** `frontend: plain`, every axis
  `none`, `ambiguity: []`.
- **Post-state (Phase 1 + 2):** `frontend: react-shadcn`,
  `axes.component_lib: shadcn`, `scope_root: packages/ui`.

Why `packages/ui` and not `apps/web`: both workspaces are React, so there is no
reactivity conflict to refuse on; the scope is then the **most specific**
frontend workspace, and `components.json` makes `packages/ui` a `react-shadcn`
root while `apps/web` is a plain `react` root. Scope selection picks the
workspace the UI lane authors components in.
