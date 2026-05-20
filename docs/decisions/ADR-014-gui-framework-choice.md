---
adr: 014
status: accepted
date: 2026-05-20
decision: gui-framework-choice
supersedes: —
superseded_by: —
phase: v2.x · unified-setup-and-settings-gui Phase 0
type: prospective
---

# ADR-014 — GUI Framework Choice (Preact + Signals)

## Status

**Accepted** · 2026-05-20 · in-session council recommendation folded.
External AI Council pass on the implementing roadmap
(`agents/roadmaps/unified-setup-and-settings-gui.md`) did not contest
the framework choice; it focused on data integrity (atomic writes,
optimistic locking) which is orthogonal to the rendering layer.

## Context

`unified-setup-and-settings-gui.md` introduces the first browser-facing
surface of `@event4u/agent-config` — a local UI that doubles as a
first-run wizard and a settings editor. The package is distributed via
`npx`, so every byte of UI ships in the npm tarball and re-downloads on
every fresh install. The wizard has **at most 8 screens**; the settings
editor renders **one zod-derived form tree**. There is no router-driven
deep navigation, no SSR, no SEO surface, no offline-first concern.

Picking a heavyweight framework here would inflate the tarball with no
proportional benefit and would make hand-off audits (a maintainer
opening `src/ui/` cold) substantially harder. The choice is locked
**now**, in this ADR, because Phase 2 onwards depends on the form
primitives being written against a stable rendering API.

## Decision

**Preact 10 + `@preact/signals` for state.** Vite as the build tool
(already in `package.json`). No router beyond a 1 KB hash-route
helper. Plain CSS files with design tokens, no CSS-in-JS, no UI kit.

### Decision matrix

| Framework | Hello-world + 5 fields + wizard (gzip) | Forms ecosystem | TS support | Mental model | Verdict |
|---|---|---|---|---|---|
| **Preact + signals** | **~6 KB** | Manual primitives, ergonomic | Excellent | React-compatible | **Chosen** |
| Svelte 5 (runes) | ~10 KB | Built-in form bindings | Good | Single-file components | Rejected: compiler magic harder to audit; smaller community for form libs vs Preact |
| lit-html / Lit | ~7 KB | None — manual | Good | Web Components, shadow DOM | Rejected: shadow DOM complicates token-driven styling and a11y |
| Vanilla + uhtml + mfsv | ~3 KB | None — bring your own | Manual | Tagged-template HTML | Rejected: 8 screens + multi-step form is the threshold where "bring your own" costs more than the saved KB |
| React 18 + RSC-disabled | ~45 KB | Best-in-class | Excellent | Industry default | Rejected: 7× the bundle for the same JSX surface; over-spec for an `npx`-shipped UI |

### Forbidden adds

- **Routers heavier than `wouter-preact` / `preact-router`** (≤ 1 KB
  gzipped). The UI has ≤ 8 screens; a 40 KB router is over-spec.
- **CSS frameworks** — Tailwind, MUI, Chakra, Mantine, shadcn-ui.
  Shipping 50 KB+ of CSS into an `npx`-installed binary is poor
  stewardship. We ship hand-written CSS using design tokens (see
  `src/ui/tokens.css`).
- **State libraries beyond signals** — no Redux, no Zustand, no Jotai.
  Signals are a built-in reactive primitive; the wizard's partial
  state lives server-side in `wizard-state.json` anyway.
- **SSR / streaming frameworks** — Next.js, Remix, SolidStart, Astro.
  The server is local Fastify; the UI is a static bundle mounted
  under `/`. No SSR concern exists.

### Reactive state pattern

```ts
import { signal, computed } from '@preact/signals';

const settings = signal<SettingsValues | null>(null);
const isDirty = computed(() => /* compare against load-time snapshot */ false);
```

- **`signal`** holds the editable form values; component subtrees
  re-render only on the signals they read.
- **`computed`** derives the dirty flag, the diff preview, and the
  per-field error map without prop-drilling.
- No `useState` for cross-component shared state; only for local
  ephemera (open/closed of a single modal, focus rings).

### Build target

- **ES2022**, native modules, no transpilation to ES5. The UI runs
  in the developer's browser, which is always evergreen.
- Vite builds emit `dist/ui/assets/*.js` + `*.css`; the Fastify
  static handler serves them under `/`.
- Bundle budget: **≤ 35 KB gzip** total (the wizard + the settings
  editor combined). Enforced by `tests/ui/bundle-budget.test.ts` in
  Phase 2. Breach is a CI fail, not a warning.

### Testing stack

- **Vitest 2.x** (already in `package.json`) + **happy-dom** for UI
  unit tests. No Jest. No React Testing Library (Preact has
  `@testing-library/preact` but we keep the primitives small enough
  that direct DOM assertions suffice).

## Consequences

### Positive

- Tarball stays under control: the entire GUI ships in < 50 KB gzip
  of `dist/ui/` regardless of how many screens accumulate.
- React-shaped JSX means contributors familiar with React onboard in
  hours, not weeks.
- Signals eliminate the prop-drilling overhead Form state would
  otherwise require.
- Zero CSS-in-JS keeps Vite's output predictable and lets a maintainer
  grep `.css` files for token usage at audit time.

### Negative

- Preact's smaller ecosystem means **some** React-only libraries
  (e.g. `react-hook-form`) cannot be reused without a shim. Mitigation:
  we hand-write form primitives anyway per the "no UI kit" rule, so
  the gap is theoretical for this scope.
- Contributors who only know Vue or Svelte must learn Preact's
  JSX-flavoured API. Mitigation: documented in `docs/architecture.md`
  alongside the existing TS-CLI onboarding notes.

### Risks accepted

- **No React migration path is preserved**. If a future roadmap needs
  RSC, streaming, or React-only libraries, the UI is rewritten end-to-
  end. Acceptable because the UI is feature-bounded (wizard + settings)
  and any RSC-shaped future is a different product.

## Cross-references

- [Implementing roadmap](../../agents/roadmaps/unified-setup-and-settings-gui.md).
- [ADR-012 — TypeScript CLI Shell](ADR-012-typescript-cli-shell.md): the host server that mounts this UI.
- [ADR-013 — Discovery Frontmatter Contract](ADR-013-discovery-frontmatter-contract.md): the discovery manifest the GUI reads to render workspace / pack pickers in a future phase.
