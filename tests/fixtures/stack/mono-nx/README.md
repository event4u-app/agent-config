# `mono-nx` — a workspace root that declares nothing in `package.json`

Nx keeps its workspace configuration in `nx.json` and its per-project
configuration in `project.json`; the root `package.json` carries no
`workspaces` key at all. Before Phase 1 no marker file was read
(`grep -n "pnpm-workspace\|turbo.json\|nx.json" detect.ts` returned nothing),
so this shape was invisible twice over.

- **Pre-state, measured at `c7e82087e`:** `frontend: plain`.
- **Post-state (Phase 1):** `frontend: react`, `scope_root: packages/ui`.
