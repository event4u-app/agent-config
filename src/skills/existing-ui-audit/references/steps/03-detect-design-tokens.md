# 3. Detect design tokens

Write into `state.ui_audit.design_tokens` (object, never null — empty object is fine):

| Source | What to extract |
|---|---|
| **`tailwind-v3`** (`axes.css`) — `tailwind.config.{js,ts,cjs,mjs}` | `theme.colors`, `theme.spacing`, `theme.fontFamily`, `theme.extend.*` |
| **`tailwind-v4`** (`axes.css`) — the `@theme` block in the entry CSS; **no config file exists**, and `components.json` `"tailwind": {"config": ""}` is the marker | every `--token: value` declared inside `@theme` / `@theme inline` |
| `:root { --... }` blocks in `resources/css/`, `app/globals.css`, `src/app/globals.css` | every `--token-name: value` pair |
| `theme.json` / `tokens.json` (any depth) | flat or nested token tree |
| `app/css/variables.css`, `assets/scss/_tokens.scss` | SCSS `$var: value` and CSS custom properties |
| **A supplied `design-system.json`** (handed over with a provided artifact) | `colors`, `typography`, `spacing`, `radius`, `shadow`, **and `motion`** (`durations`, `easings`) — read as the answer, never re-derived |
| **A supplied artifact's own `:root { --… }` / inline `<style>`** (the handover file itself, e.g. `design.html`) | every `--token-name: value` pair, when no `design-system.json` accompanies it |

Group output by category: `colors`, `spacing`, `radius`, `font`, `shadow`, `breakpoint`, `other`.

**Branch on the axis, do not probe for a config file.** `detect_stack()` emits
`axes.css` as `tailwind-v3` or `tailwind-v4`
(`work_engine/stack/detect.ts:521-524`); reading it is how this step and
`react-shadcn-ui` § Gotcha stay on the same key. Absence of
`tailwind.config.*` is v4's normal state, never a missing file.

**Artifact-sourced tokens stay distinguishable from project tokens.** Every
group carries a `source` — `project` for the first four rows, `artifact` for the
last two — because the mapping between them is the thing a port has to keep
visible. Collapsing them loses the answer to "did this value come from what the
user handed me, or from what the repo already had?", and that is exactly the
question the apply coverage report has to answer per item. The two sets may
disagree; when they do, surface the conflict rather than merging it (a supplied
spec outranks house taste, but not a registered brand token — see
[`brand-source-of-truth`](../../../../rules/brand-source-of-truth.md)).

`motion` is new here: the block has existed in the `design-system.json` schema
since capture shipped and **nothing consumed it**. On the port branch it is
read, so easing and duration stop being values the brief silently regenerates.
