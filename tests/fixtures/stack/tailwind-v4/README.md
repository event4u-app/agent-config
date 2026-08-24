# `tailwind-v4` — Tailwind v4 identified by its Vite plugin

v4 drops `tailwind.config.*` in favour of CSS-first configuration, so the
detectable marker is the `@tailwindcss/vite` dependency (or `@import
"tailwindcss"` in the entry CSS).

- **Pre-state, measured at `c7e82087e`:** `axes.css: tailwind`.
- **Post-state (Phase 2.3):** `axes.css: tailwind-v4`.
