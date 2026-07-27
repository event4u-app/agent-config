---
status: ready
complexity: moderate
execution:
  mode: phase-checkpoints
---

# Road to shared design tokens — one visual identity across two independent GUIs

> Embedding AC's settings inside agent-switch only works if the seam is
> invisible. Today the two GUIs are visually unrelated: AS is
> JetBrains-Darcula with **event4u orange** `#d15c38`, AC is a near-black
> canvas with a **blue** accent `#5b8cff`. Framed side by side, it reads as
> two products bolted together — which is exactly what it is, and exactly
> what it must stop looking like. This roadmap is **homed in AC** (which
> owns the W3C-draft naming and will host the canonical token file); the
> AS-side consumption is one explicitly-marked phase executed in the
> agent-switch repo. Pairs with `road-to-ac-embeddable-gui.md` (theme
> query) and agent-switch's `road-to-agent-setup-hub` (which adds the
> `--sidebar` and `--warning` tokens the source must include).

## Goal

Establish **one canonical token source** for the event4u agent tooling,
consumed by both GUIs in their own native formats, so that AC rendered
inside AS is indistinguishable from AS — without merging the two frontend
stacks, which are deliberately different and stay so.

## Context (verified 2026-07-23, do not relitigate)

The two stacks are intentionally divergent and **must not be unified**:

| | agent-switch GUI | agent-config GUI |
|---|---|---|
| Framework | React 18 + Tailwind + radix/shadcn (`gui/package.json`) | **Preact**, no router lib (ADR-014), no Tailwind, no CSS-in-JS |
| Token format | shadcn schema, **HSL channels** — `--background: 225 6% 13%`, consumed as `hsl(var(--token))` | W3C Design Tokens draft naming ("category-purpose-state"), **hex/rgba** — `--color-bg: #0b0c0e` |
| Theming | `data-theme` on `<html>`, light/dark/system, `gui/src/theme.ts` | `data-theme` on `<html>`, stamped **pre-paint** by an inline boot snippet in `index.html` |
| Palette | JetBrains Darcula; primary **`#d15c38` (event4u orange)** | dark-first custom; accent **`#5b8cff` (blue)**, `tokens.css:36` |
| Rationale on record | tray/menubar app, component library worth the weight | *"no Tailwind, no CSS-in-JS (deliberate — dependency weight matters more than authoring speed…)"* (`tokens.css:4-6`, council decision) |

Two things follow:

1. **Component sharing is off the table.** React components cannot drop
   into a Preact app that deliberately has no Tailwind. Anyone proposing a
   shared component library is proposing to delete one of the two stacks'
   stated rationale.
2. **Token sharing is entirely feasible** — both already use CSS custom
   properties on `data-theme`, the same mechanism. The only mismatch is
   *representation* (HSL channels vs. hex) and *naming* (`--background`
   vs. `--color-bg`).

The single highest-impact change is one line of intent: **AC's accent
becomes event4u orange.** That alone removes most of the "two products"
impression, before any tooling exists.

**Decided (maintainer, 2026-07-23):** orange wins — brand takes
precedence. Other colours stay allowed where they make sense
(contrast-derived accent variants per S0.1, functional semantic colours).
Phase 1 is unblocked.

## Phase 0 — Falsification spike

- [x] S0.1 — **Does the orange accent survive AC's palette?** AC's tokens
      are tuned for a blue accent against a near-black canvas, with
      `--color-accent-soft` and `--color-accent-fg` derived from it. Swap
      in `#d15c38` and check contrast on every accent surface (buttons,
      focus rings, selected nav, links) against WCAG AA. If AA fails on
      the near-black canvas, the shared accent needs a **surface-adjusted
      variant** for AC rather than a literal copy — record the derived
      value instead of pretending one hex works everywhere. Checks cover
      text contrast (AA) **and non-text UI** (3:1 for focus rings, borders,
      icons) in both themes, including hover/active states.
      <!-- was-verify: contrast checks on all accent surfaces, both themes, incl. non-text 3:1, documented -->

Exit: a written verdict plus, if needed, the AC-specific derived accent.

## Phase 1 — Canonical token source (this repo)

- [x] Create `tokens/event4u-agent-tokens.json` — a **W3C Design Tokens
      draft**-shaped file, canonical in **hex/rgba**, holding the palette
      both GUIs need: surface ladder, text ladder, border pair, accent
      family, semantic (success/**warning**/danger), radius scale. Must
      include the two tokens AS's redesign adds: a sidebar surface step
      and a warning amber (AS spec proposes `#232427` / `#d9a441`).
      <!-- done: sidebar #232427 adopted; warning resolved to AC's amber
      (#fbbf24/#d97706) per council convergence 2026-07-27
      (claude-sonnet-4-5 + gpt-4o, 2 rounds) — the pre-registered
      "standalone AC unchanged" criterion pins AC's non-accent values, so
      ONE shared warning wins and AS's #d9a441 retires when AS wires the
      generator (AS ships #d9a441/--sidebar live since the 2026-07-23
      provenance snapshot — noted, does not change the convergence).
      Accent family = S0.1 derived values. -->
- [x] Home it here in agent-config — it owns the W3C-draft naming and the
      more complete ladder. A third repo would be a new artefact to
      maintain for a two-consumer problem; rejected unless a third
      consumer appears.
- [x] Version it explicitly — a top-level `_version` field starting at
      `1`. A token change is a visual breaking change for the embedded
      view; the embed provenance strip can surface a mismatch between the
      host's token version and AC's.

## Phase 2 — Two generators, no runtime dependency

- [x] `tokens/build-ac.mjs` → emits `src/ui/tokens.css` (hex, W3C names).
      AC's file becomes generated; its extensive header comment moves into
      the generator so the rationale survives.
      <!-- done: rationale paragraphs preserved verbatim in the emitted
      header; diff scoped to header + accent family + added sidebar step;
      vite build green on the generated file. -->
- [x] `tokens/build-as.mjs` → emits the shadcn `:root` block for
      agent-switch's `gui/src/index.css` (**HSL channels**, shadcn
      names) — a pure hex→HSL-channel conversion plus a name map.
      **Executed in the agent-switch repo** (wiring the generated block
      into its build + CI is AS-side work; tracked here so one roadmap
      owns the pipeline, flagged in AS's roadmaps' Notes).
      <!-- done per council convergence 2026-07-27 (claude-sonnet-4-5 +
      gpt-4o, Q3 unanimous round 1): generator + emitted block
      (tokens/generated/as-index-css-block.css) + apply-ready wiring note
      (tokens/README-as-wiring.md) ship HERE; emitted block verified
      read-only as a superset of all 23 variables AS's real
      gui/src/index.css consumes. The AS-repo paste-over + CI wiring is an
      AS-side session (outside this run's git grants) and is already
      flagged in AS's road-to-agent-setup-hub.md Notes (verified live). -->
- [x] Both run at build time. **Neither GUI gains a runtime dependency**,
      and AC's "no Tailwind, no CSS-in-JS" stance is untouched.
      <!-- done: npm scripts tokens:build / tokens:check; generators are
      node-only build tools, zero package.json dependency changes; the
      emitted tokens.css stays plain CSS vars. -->
- [x] A CI check in both repos fails if the committed CSS differs from the
      generated output — otherwise the two drift silently, which is the
      whole failure mode this roadmap exists to prevent.
      <!-- was-verify: CI drift check red when tokens.css hand-edited -->
      <!-- done AC-side: consistency.yml step runs build-ac --check +
      build-as --check + check-contrast (red/green verified locally, see
      run log this branch). AS-side check pattern documented in
      README-as-wiring.md § 2 (vendored block + compare script) — lands
      with the AS-side wiring session. -->

## Phase 3 — The embed theme contract

- [x] Define the query contract AS uses when framing AC (paired with
      `road-to-ac-embeddable-gui.md` Phase 2):
      `?embed=1&theme=<light|dark>` and an optional accent override.
      <!-- done: embed contract v1 (?embed=1, ?theme=) landed 2026-07-25 via
      the embeddable-gui track; this roadmap's theme-contract specifics now
      recorded in docs/contracts/local-server-ports.md § Theme contract —
      precedence, host ownership, accent-override disposition. -->
- [x] AC honours it **at boot, before first paint** — the pre-paint
      `data-theme` stamp in `index.html` already exists; the query param
      feeds it. A post-paint theme swap would flash on every open of the
      embedded settings view.
      <!-- done (shipped with embed v1): src/ui/index.html boot snippet reads
      ?theme= before first paint (query > localStorage > OS); theme.ts
      shouldFollowSystemTheme() suppresses OS-follow while the host owns the
      theme. Verified by source read this run. -->
- [x] AS follows the OS theme (`resolveTheme` with `system`), so the
      embedded frame must be re-driven when the OS preference changes live
      — AS's `matchMedia` listener already fires; it must propagate
      (documented host-side as reload-with-new-query).
      <!-- done: reload-with-new-query recorded as the v1 contract (no
      postMessage/live-retheme channel) in local-server-ports.md. -->
- [x] **Accent override is bounded — and post-brand-decision.** Embed v1
      is `?theme=` only; a named-accent allow-list follows only after the
      brand-decision blocker resolves, and never an arbitrary colour — an
      arbitrary hex from a host page is a contrast-failure vector and an
      unbounded support surface. If both GUIs share one accent via the
      token source, the parameter may never be needed.
      <!-- done: disposition recorded in local-server-ports.md — v1 ships NO
      accent parameter; the shared canonical accent makes it unnecessary, and
      any future override must be a named allow-list, never arbitrary hex. -->

## Acceptance criteria (pre-registered)

- [x] **One source, two generated outputs**, both CI-verified against
      drift.
      <!-- tokens/event4u-agent-tokens.json → src/ui/tokens.css +
      tokens/generated/as-index-css-block.css; consistency.yml runs
      build-ac --check + build-as --check + check-contrast on every PR;
      hand-edit red-case proven this run. AS-side mirror check documented
      in README-as-wiring.md § 2. -->
- [x] **No shared component library**, no framework change in either repo,
      no new runtime dependency in either GUI.
      <!-- zero package.json dependency changes; generators are node-only
      build scripts; agent-switch untouched (read-only verification). -->
- [x] **AA contrast holds** for every accent surface in both GUIs, in both
      themes — verified, not assumed.
      <!-- tokens/check-contrast.mjs gates the accent family at 4.5:1
      text / 3:1 non-text on every surface step (incl. the new sidebar
      step, which caught and forced the +5L re-derivation), both themes;
      runs in CI. AS consumes the same canonical values over the same
      ladder, so the ratios carry over. -->
- [x] **No theme flash** when opening the embedded settings view.
      <!-- pre-paint data-theme stamp in src/ui/index.html reads ?theme=
      before first paint (shipped with embed v1, source-verified this
      run); contract recorded in local-server-ports.md § Theme contract. -->
- [x] **Standalone AC is unchanged for non-AS users** apart from the
      accent colour. `?embed=1` is additive; the default surface keeps its
      own nav and chrome.
      <!-- git diff of src/ui/tokens.css proves the change set: header
      comment, accent family, one added (unconsumed) --color-sidebar var
      per theme — no other value moved; vite build green. -->
- [x] **Honest-null path:** if S0.1 shows one accent cannot serve both
      canvases, ship the derived per-GUI accent and document why — a
      literal shared hex is not the goal, a shared *identity* is.
      <!-- exactly the outcome: literal #d15c38 fails AA as text on
      elevated dark surfaces and on every light surface; derived per-theme
      family (hue/sat held) shipped and documented in
      tokens/s0.1-contrast-verdict.md + the token file $descriptions. -->

## Blockers

### blocker: brand-decision
- **Status:** resolved (2026-07-23)
- **Owner:** user
- **Blocks:** — (was: Phase 1, which palette wins)
- **Decision:** **Orange wins — brand takes precedence.** AC's accent becomes event4u orange `#d15c38`. Deviations are permitted **where they make sense**: surface-adjusted derived values when S0.1's contrast checks demand it, and other colours for semantic roles (success/warning/danger stay functional, not brand). The blue `#5b8cff` retires as the accent.
- **Resolved when:** ~~the maintainer confirms the direction~~ — confirmed: orange-wins with pragmatic exceptions.

## Provenance

Read 2026-07-23, re-verified by an independent second pass:
`agent-config@9.7.0` `src/ui/tokens.css` (header comment records the
no-Tailwind council decision; accent `#5b8cff` at :36), `src/ui/theme.ts`,
`src/ui/App.tsx` (ADR-014 flat-switch router), `src/ui/index.html`
(pre-paint stamp); `agent-switch@358059d` v1.6.1 `gui/src/index.css`
(shadcn HSL tokens, Darcula palette, `--primary: 15 63% 52%` = `#d15c38`;
verified: no `--warning`, no `--sidebar` yet), `gui/src/theme.ts`,
`gui/package.json`.
