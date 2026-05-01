---
name: existing-ui-audit
description: "Use BEFORE writing or editing any non-trivial UI — inventories components, design tokens, shadcn primitives, and reusable patterns into state.ui_audit. Hard gate for the ui directive set."
source: package
---

# existing-ui-audit

## When to use

Use this skill when:
- The dispatcher has routed work to `directive_set="ui"` (intent `ui-build` or `ui-improve`)
- A `mixed` flow is about to enter its UI phase
- The user asks "what UI do we already have for X?"

Do NOT use when:
- `directive_set="ui-trivial"` — the trivial path bypasses audit by precondition (≤1 file, ≤5 lines, no new component, no new state, no new dep)
- `directive_set="backend"` — no UI surface to inventory
- The audit findings already exist in `state.ui_audit` for this state-file (cached) — re-run only if `package.json` or `composer.json` mtime changed

## Procedure: Audit the existing UI surface

### 0. Inspect stack and input

1. Read `state.stack.frontend` — set by `scripts/work_engine/stack/detect.py` (one of `blade-livewire-flux`, `react-shadcn`, `vue`, `plain`).
2. Read `state.input` — the request being processed. The audit must answer: "what already exists that is similar to this request?"

### 1. Enumerate components and templates

| Stack | Where to look |
|---|---|
| `blade-livewire-flux` | `resources/views/components/`, `resources/views/livewire/`, `resources/views/partials/`, `resources/views/layouts/`, `app/View/Components/`, `app/Livewire/` |
| `react-shadcn` | `components/`, `app/components/`, `src/components/`, `src/app/(routes)/`, plus any `app/**/page.tsx` for Next.js |
| `vue` | `resources/js/components/`, `src/components/`, `pages/` |
| `plain` | `resources/views/`, plus any `*.html` under `public/` |

Capture each component/template as: `{path, name, kind: page|partial|component|layout, exports?: [props]}`.

### 2. Identify the design system

Detect markers, in order. **Stop at the first match** — projects rarely run more than one design system.

| Marker | Signal | Where |
|---|---|---|
| Flux | `livewire/flux` in `composer.json`, `<flux:*>` tags in views | `composer.json`, grep `resources/views` |
| shadcn/ui | `components.json` exists at repo root | `components.json` |
| Headless UI | `@headlessui/react` or `@headlessui/vue` in `package.json` | `package.json` |
| Radix | `@radix-ui/*` in `package.json` (without shadcn marker) | `package.json` |
| Material/Chakra/Mantine/Ant | their package names in `package.json` | `package.json` |
| Custom / none | none of the above match | — |

### 3. Detect design tokens

Write into `state.ui_audit.design_tokens` (object, never null — empty object is fine):

| Source | What to extract |
|---|---|
| `tailwind.config.{js,ts,cjs,mjs}` | `theme.colors`, `theme.spacing`, `theme.fontFamily`, `theme.extend.*` |
| `:root { --... }` blocks in `resources/css/`, `app/globals.css`, `src/app/globals.css` | every `--token-name: value` pair |
| `theme.json` / `tokens.json` (any depth) | flat or nested token tree |
| `app/css/variables.css`, `assets/scss/_tokens.scss` | SCSS `$var: value` and CSS custom properties |

Group output by category: `colors`, `spacing`, `radius`, `font`, `shadow`, `breakpoint`, `other`.

### 4. Detect shadcn inventory (only when `state.stack.frontend == "react-shadcn"`)

Read `components.json` for the registered style + base color, then read `package.json` for `@radix-ui/*` and any locally vendored `components/ui/*.tsx` files. Write into `state.ui_audit.shadcn_inventory`:

```
{
  version: <from package.json shadcn registry CLI version, or null>,
  style: "default" | "new-york" | <other>,
  base_color: "slate" | "zinc" | ...,
  primitives: ["Button", "Dialog", "Form", "Table", ...],   // names of files in components/ui/
  installed_radix: ["@radix-ui/react-dialog", ...]          // raw radix list
}
```

### 5. List reusable patterns

Categorize what already exists. Empty arrays are valid, never omit the keys.

```
state.ui_audit.patterns = {
  forms: [<component path:str>, ...],     // any component with <form>, useForm, <flux:input>, <Input> + <Button type=submit>
  tables: [...],                          // <table>, <flux:table>, DataTable, headless table primitives
  modals: [...],                          // <flux:modal>, <Dialog>, AlertDialog, Sheet
  empty_states: [...],                    // components matching grep "no results"|"empty"|"keine"|"nothing yet"
  navigation: [...],                      // sidebar, breadcrumb, tabs
  data_display: [...]                     // cards, lists, stat tiles
}
```

### 6. Match candidates for the current input

For each item in `state.ui_audit.components`, score similarity to `state.input.data` (fuzzy on filename + props/slots + co-occurring terms). Keep top 5 with `score >= 0.3`. Write into `state.ui_audit.candidates`:

```
[{path, name, score, reason: "matches 'settings' + 'toggle' in props"}, ...]
```

If `candidates` is empty, the user is building net-new. That is normal — record the empty list, do not halt.

### 7. Greenfield branch

If **all** are true:
- `state.ui_audit.components` is empty
- `state.ui_audit.design_system == "custom-or-none"`
- `state.ui_audit.design_tokens` is empty (no Tailwind config customizations, no `:root`)

then set `state.ui_audit.greenfield = true` and emit a halt:

```
> No existing UI surface detected — this looks like greenfield.
>
> 1. Scaffold a minimal token set + a base component primitive folder
>    before building (recommended for projects with >1 planned screen)
> 2. Proceed bare with Tailwind defaults (recommended for one-off prototypes)
> 3. Point me at an external design-system reference (URL or file)

**Recommendation: 1 — Scaffold tokens + primitives** — even one extra screen
benefits from a shared base; the scaffold cost is ~10 min and saves
re-doing every primitive on screen 2. Caveat: flip to 2 if this is a
demo or single-page prototype that will not grow.
```

Record the user's pick in `state.ui_audit.greenfield_decision` (`scaffold` | `bare` | `external_reference`). Re-running the skill on the same state-file with `greenfield_decision` set is a no-op for the halt (audit findings stay).

### 8. (Optional) Capture an a11y baseline

The R4 visual-review-loop contract reads `state.ui_audit.a11y_baseline`
when present; the review gate then filters incoming
`state.ui_review.a11y.violations` against it so pre-existing
violations stay informational and only NEW or CHANGED entries block
the polish loop. Without a baseline the gate sees every violation as
actionable — fine for greenfield, noisy for legacy surfaces.

Capture the baseline when:

- The audit covers components with known a11y debt the project does
  not intend to fix in this run (legacy templates, third-party
  embeds, vendor widgets).
- The user says "don't block on existing a11y issues" or similar.

Skip the baseline (omit the key, leave `state.ui_audit.a11y_baseline`
unset) when:

- The surface is greenfield — the review gate should treat every
  violation as new.
- The project's a11y posture is "zero known violations" and any
  finding is by definition actionable.

Shape (each entry must carry at least `rule` + `selector`; severity
is optional but recommended so the review gate's severity-floor
filter behaves the same on replay):

```
state.ui_audit.a11y_baseline = [
  {rule: "color-contrast", selector: ".legacy-tab", severity: "moderate"},
  {rule: "label",          selector: "form#search input[type=search]"},
  ...
]
```

Producer parity: the review skill that writes
`state.ui_review.a11y.violations` MUST use the same `(rule, selector)`
shape, otherwise the engine's de-dup will miss matches and pre-existing
violations will surface as new findings on every run.

### 9. Validate and write findings

1. Verify every key in the **Output format** below is present in `state.ui_audit` (empty arrays/objects allowed; `null` only for `shadcn_inventory` outside the react-shadcn stack).
2. Verify `state.ui_audit.greenfield == true` implies `state.ui_audit.greenfield_decision` is set.
3. Write the full object back into the state-file. Audit completes with outcome `done` — the dispatcher's audit gate now passes.

## Output format

1. **`state.ui_audit.components`** — array of component/template descriptors (path, name, kind, exports)
2. **`state.ui_audit.design_system`** — single string identifying the dominant system or `custom-or-none`
3. **`state.ui_audit.design_tokens`** — object grouped by category (colors, spacing, radius, font, shadow, breakpoint, other)
4. **`state.ui_audit.shadcn_inventory`** — object with version, style, base_color, primitives (only when stack is `react-shadcn`; `null` otherwise)
5. **`state.ui_audit.patterns`** — object with forms, tables, modals, empty_states, navigation, data_display arrays
6. **`state.ui_audit.candidates`** — top-5 similarity matches for the current input (may be empty)
7. **`state.ui_audit.greenfield`** — boolean; when true, `greenfield_decision` MUST also be set before the dispatcher advances
8. **`state.ui_audit.a11y_baseline`** *(optional)* — array of `{rule, selector, severity?}` entries documenting pre-existing a11y violations the review gate should treat as informational. Omit the key entirely when no baseline applies; do not write `[]` for "I checked and there are none" — that disables the gate's filter for every future run.

## Gotcha

- The model tends to skip the audit and start designing straight from the request — the dispatcher gate at `directives/ui/audit.py` enforces "no design without audit findings". Never treat this skill as optional for non-trivial UI.
- The model tends to misidentify a single Tailwind utility as a "design token" — tokens come from the config or `:root`, not from class strings in templates.
- Don't assume a Radix-only `package.json` means shadcn — shadcn requires `components.json` at repo root.
- `state.ui_audit.shadcn_inventory.version` is often missing; the shadcn CLI does not always pin itself in `package.json`. Record `null` rather than guessing.
- Greenfield is detected, not assumed — a project with one Blade layout and no components is still greenfield only if tokens AND design system markers AND components are all empty.
- Re-running the skill on a stale state-file: cache by `(composer.json mtime, package.json mtime)`; if either changed, re-audit and overwrite.

## Do NOT

- Do NOT advance to `directives/ui/design.py` or `apply.py` if `state.ui_audit` is empty.
- Do NOT advance to design or apply if `state.ui_audit.greenfield == true` and `state.ui_audit.greenfield_decision` is unset.
- Do NOT silently skip the greenfield halt because "Tailwind has defaults" — the user picks the path explicitly.
- Do NOT write paths outside the project root into the inventory.
- Do NOT rewrite `state.ui_audit` once it is populated unless re-detection is triggered by mtime change — design and apply read from it.
