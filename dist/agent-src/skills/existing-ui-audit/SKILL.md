---
model_tier: high
name: existing-ui-audit
description: "Use BEFORE writing or editing any non-trivial UI — inventories components, design tokens, shadcn primitives, and reusable patterns into state.ui_audit. Hard gate for the ui directive set."
personas:
  - frontend-engineer
domain: discovery
workspaces:
  - engineering
packs:
  - engineering-base
---

# existing-ui-audit

> **Interplay:** this audit answers *what exists* (components, tokens,
> primitives → `state.ui_audit`);
> [`design-intelligence`](../design-intelligence/SKILL.md) answers *what to
> build* (corpus-grounded style/token/typography/pattern selection for the
> brief). Audit runs first, and its reuse findings outrank corpus
> suggestions — never let a grounded recommendation introduce a new
> component the inventory already covers.

## When to use

Use this skill when:
- The dispatcher has routed work to `directive_set="ui"` (intent `ui-build` or `ui-improve`)
- A `mixed` flow is about to enter its UI phase
- The user asks "what UI do we already have for X?"

Do NOT use when:
- `directive_set="ui-trivial"` — the trivial path bypasses audit by precondition (≤1 file, ≤5 lines, no new component, no new state, no new dep)
- `directive_set="backend"` — no UI surface to inventory
- The audit findings already exist in `state.ui_audit` for this state-file — the gate round-trips through SUCCESS once `audit_path` is set, and does **not** re-run for the life of that state-file (see Gotchas for what that does and does not cover)

## Resource-first context gate (design fidelity)

Any request to **recreate, redesign, mock, prototype, or improve** a UI runs
this gate BEFORE styling — the Inspect stage of the
[design-artifact lifecycle](../../../docs/contracts/design-artifact-lifecycle.md).
Design starts from project truth, not generic aesthetic memory.

- **Search first (owned UI).** Before proposing anything, search the project
  for: design tokens, global CSS, the component library / design system (§ 2),
  supplied screenshots or exported design context, Figma/exported context when
  connected, assets (logos, icons, fonts), and copy tone. Procedure steps 1–5
  produce this inventory — do not skip them for a "quick" redesign.
- **Hard stop on a promised-but-inaccessible source.** When the user explicitly
  references a design system, local folder, Figma file, or codebase you cannot
  read, STOP and ask for access — never invent a design from memory to paper
  over the missing source. A promised source that can't be reached is a blocking
  question ([`ask-when-uncertain`](../../rules/ask-when-uncertain.md)), not a
  licence to improvise. (fixture: `daf-inaccessible-design-system`.)
- **Source priority — code beats screenshots.** For exact values (tokens,
  spacing, component props) the design-system/code context is authoritative; a
  screenshot conveys gestalt but is not enough for component/token fidelity.
  Never read pixel values off a screenshot when the source is available.
- **Tool composition — inspect before you generate.** Owned UI → repository
  search + local files FIRST. Connected/imported design data (Figma, tokens
  export) → that connector next, when available. Browser / image search → only
  for public references or current product/place imagery, never a substitute
  for inspecting owned code. Generated imagery → only when the user asks for
  synthetic assets, or no real inspection is required. (fixtures:
  `daf-no-context`, `daf-missing-asset`.)

## Procedure: Audit the existing UI surface

### 0. Inspect stack and input

1. Read `state.stack.frontend` — set by `scripts/work_engine/stack/detect.ts` (one of `blade-livewire-flux`, `react-shadcn`, `vue`, `plain`).
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
| **A supplied `design-system.json`** (handed over with a provided artifact) | `colors`, `typography`, `spacing`, `radius`, `shadow`, **and `motion`** (`durations`, `easings`) — read as the answer, never re-derived |
| **A supplied artifact's own `:root { --… }` / inline `<style>`** (the handover file itself, e.g. `design.html`) | every `--token-name: value` pair, when no `design-system.json` accompanies it |

Group output by category: `colors`, `spacing`, `radius`, `font`, `shadow`, `breakpoint`, `other`.

**Artifact-sourced tokens stay distinguishable from project tokens.** Every
group carries a `source` — `project` for the first four rows, `artifact` for the
last two — because the mapping between them is the thing a port has to keep
visible. Collapsing them loses the answer to "did this value come from what the
user handed me, or from what the repo already had?", and that is exactly the
question the apply coverage report has to answer per item. The two sets may
disagree; when they do, surface the conflict rather than merging it (a supplied
spec outranks house taste, but not a registered brand token — see
[`brand-source-of-truth`](../../rules/brand-source-of-truth.md)).

`motion` is new here: the block has existed in the `design-system.json` schema
since capture shipped and **nothing consumed it**. On the port branch it is
read, so easing and duration stop being values the brief silently regenerates.

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

## Section index — load on demand

Load on demand once the audit procedure needs the output template or the pitfall catalog:

- [`references/output-and-pitfalls.md`](references/output-and-pitfalls.md) — Output format · Gotcha · Anti-slop cross-reference

## Do NOT

- Do NOT advance to `directives/ui/design.ts` or `apply.ts` if `state.ui_audit` is empty.
- Do NOT advance to design or apply if `state.ui_audit.greenfield == true` and `state.ui_audit.greenfield_decision` is unset.
- Do NOT silently skip the greenfield halt because "Tailwind has defaults" — the user picks the path explicitly.
- Do NOT write paths outside the project root into the inventory.
- Do NOT rewrite `state.ui_audit` once it is populated unless re-detection is triggered by mtime change — design and apply read from it.
