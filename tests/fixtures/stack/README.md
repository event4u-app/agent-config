# Stack-detection fixtures

Real repository shapes for `work_engine/stack/detect.ts`, authored by
`road-to-monorepo-scope-and-detection` Phase 0 **before** the detector changed,
so the pre-state is recorded rather than remembered.

Every `README.md` in a sibling directory carries two verdicts:

- **Pre-state** — what `detect_stack()` returned at `c7e82087e` (main before the
  Phase 1 fix), measured with a live run, not predicted.
- **Post-state** — what it must return once Phase 1 / Phase 2 land.

The point of the split is the M2 defect these fixtures replace: the two
temp-dir monorepos in `ui_lane_matrix.test.ts` built a shape with **no root
`package.json`**, which is not what a monorepo looks like, so they passed both
before and after the defect and were never a regression witness for it.

Measure the pre-state of every fixture:

```bash
npx tsx -e "import {detect_stack} from './src/agent-src/templates/scripts/work_engine/stack/detect.ts';
console.log(detect_stack('tests/fixtures/stack/mono-pnpm-turbo').frontend)"
```

| Fixture | Shape | Pre-state | Post-state |
|---|---|---|---|
| `mono-pnpm-turbo` | root manifest + `pnpm-workspace.yaml` + `turbo.json`; `apps/web` react+next, `packages/ui` react+`radix-ui`+`components.json` | `plain` | `react-shadcn`, `component_lib: shadcn`, `scope_root: packages/ui` |
| `mono-two-frontends` | root manifest with `workspaces`; `apps/web` react, `apps/admin` vue | `plain` | `unknown`, both roots named |
| `mono-nx` | root manifest without `workspaces`; `nx.json`; `packages/ui` react + `project.json` | `plain` | `react`, `scope_root: packages/ui` |
| `mono-devdep-root` | root `workspaces` + react in **devDependencies**; `apps/web` vue | `react` (wrong — root test tooling read as the app) | `vue`, `scope_root: apps/web` |
| `mono-pnpm-libs` | `pnpm-workspace.yaml` globbing `libs/*`, no `workspaces` key | `plain` | `react`, `scope_root: libs/ui` |
| `tailwind-v3` | react + `tailwindcss@3` + `tailwind.config.ts` | `css: tailwind` | `css: tailwind-v3` |
| `tailwind-v4` | react + `tailwindcss@4` + `@tailwindcss/vite` | `css: tailwind` | `css: tailwind-v4` |
| `shadcn-current` | verbatim `npx shadcn@latest init -d --template vite` output (CLI 4.19.0, 2026-08-24) + its `components.json` | n/a — version-pin fixture, not a detector input | n/a; it is the only source any skill may quote shadcn / Tailwind majors from |
| `storybook-current` | verbatim `npx storybook@latest init --yes` output (Storybook 10.5.10, 2026-08-24) | n/a — version-pin fixture | n/a; the only source for Storybook majors and the default addon set |

Two of the rows above are **version-pin fixtures rather than detector
fixtures**: `shadcn-current` and `storybook-current` are the unedited output
of a real scaffold, committed so that a skill's stated versions are traceable
to a command someone ran on a date rather than to prose someone read. They
have no pre/post detector verdict because `detect_stack()` is not what reads
them — `check_stated_versions` is
(`road-to-component-library-lifecycle` Phase 5).

These directories carry `package.json` files that are **fixtures, never
installed**: the repository root declares no `workspaces`, so no package
manager walks into them. The precedent is
`tests/fixtures/license-detect/workspaces-homogeneous/` and
`tests/fixtures/playbooks/mono-with-generator/`, which do the same.
