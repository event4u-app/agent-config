# `mono-two-frontends` — two frontends that genuinely disagree

Root manifest declaring `workspaces: ["apps/*"]`, a React app and a Vue app.

- **Pre-state, measured at `c7e82087e`:** `frontend: plain` — the workspace
  branch is never reached because a root `package.json` exists (M1).
- **Post-state (Phase 1):** `frontend: unknown` with
  `ambiguity: ["workspace roots: admin + web"]`.

This is the fixture that must **not** resolve. React and Vue are both on the
exclusive-reactivity list, so the workspaces are two different stacks and the
detector's standing contract (`detect.ts` — refuse rather than guess) applies to
scope selection exactly as it does to a single manifest.
