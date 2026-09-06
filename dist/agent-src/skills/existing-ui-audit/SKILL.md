---
model_tier: high
name: existing-ui-audit
description: "Use BEFORE writing or editing any non-trivial UI — inventories components, design tokens, shadcn primitives, and reusable patterns into state.ui_audit. Hard gate for fe-design and the ui directives."
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

Capture each component/template as:
`{path, name, kind: component|view|style|page, exports?: [props]}`.

The `kind` set is the one `agent-config ui:audit` actually emits — its single
definition is `AUDIT_KINDS` in `src/cli/commands/uiAudit.ts`, and a test asserts
this line against that constant rather than restating it. It read
`page|partial|component|layout` until 2026-08-26; only two of those four values
existed in the code, so an artefact written by the command was being read here
against a contract it did not satisfy.

`partial` and `layout` are not in the set. Neither has an operational definition
that survives contact with a real tree, and adding a branch for a category
nobody can test is how the previous mismatch happened.

`view` is the **Blade** classification — `*.blade.php` and `resources/views/`.
It reads zero in a JavaScript tree by construction, which is not the same as
unused.

### 2. Identify the design system

Detect markers, in order. **Stop at the first match** — projects rarely run more than one design system.

| Marker | Signal | Where |
|---|---|---|
| Flux | `livewire/flux` in `composer.json`, `<flux:*>` tags in views | `composer.json`, grep `resources/views` |
| shadcn/ui | `components.json` exists at the **workspace** root — the package that owns it; in a monorepo this is never the repository root | `components.json` |
| Headless UI | `@headlessui/react` or `@headlessui/vue` in `package.json` | `package.json` |
| Radix | `@radix-ui/*` in `package.json` (without shadcn marker) | `package.json` |
| Material/Chakra/Mantine/Ant | their package names in `package.json` | `package.json` |
| Custom / none | none of the above match | — |

### 3. Detect design tokens

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
[`brand-source-of-truth`](../../rules/brand-source-of-truth.md)).

`motion` is new here: the block has existed in the `design-system.json` schema
since capture shipped and **nothing consumed it**. On the port branch it is
read, so easing and duration stop being values the brief silently regenerates.

### 4. Detect shadcn inventory (only when `state.stack.frontend == "react-shadcn"`)

Read `components.json` for the registered style + base color, then read the `package.json` **of the scope root** — `state.stack.scope_root`, relative to the project root, empty when the project root *is* the scope — for `@radix-ui/*` or the unified `radix-ui` package, plus any locally vendored `components/ui/*.tsx` files. In a monorepo the repository root carries neither the marker nor the dependency, so reading it finds nothing. Write into `state.ui_audit.shadcn_inventory`:

```
{
  version: <from package.json shadcn registry CLI version, or null>,
  style: "default" | "new-york" | <other>,
  base_color: "slate" | "zinc" | ...,
  primitives: ["Button", "Dialog", "Form", "Table", ...],   // names of files in components/ui/
  installed_radix: ["@radix-ui/react-dialog", ...]          // raw radix list
}
```

### 4b. Prefer a live Storybook read over the hand-read inventory — when one is running

When the project carries `@storybook/addon-mcp` **and** a Storybook is running, query it
instead of reading files: `list-all-documentation` for the inventory, then `get-documentation`
for the components that matter. **The live read wins; the hand-read inventory of step 4 is the
fallback and is never removed** — an agent that cannot reach a running Storybook must still be
able to inventory the library. The channel disappearing is normal, not an error.

**React-only while the toolset is in preview.** Storybook's own MCP FAQ (docs **10.5**,
`docs/ai/mcp/overview` § FAQ) states the documentation toolset supports React only during
preview, so Vue, Angular, and Web Components take the file-read path. Stated here rather than
discovered at runtime, because the failure otherwise looks like a broken MCP server.

Discipline for what the live read returns is [`storybook-workshop`](../storybook-workshop/SKILL.md)'s
— in particular: never use a prop the manifest does not document, and fetch the project's
story instructions before writing a story.

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

Load on demand once the audit needs the pitfall catalog:

- [`references/anti-slop-cross-reference.md`](references/anti-slop-cross-reference.md) — Anti-slop cross-reference

- [`references/output-and-pitfalls.md`](references/output-and-pitfalls.md) — Output format · Gotcha · Anti-slop cross-reference

## Output format

1. **`state.ui_audit.components`** — array of component/template descriptors (path, name, kind, exports)
2. **`state.ui_audit.design_system`** — single string identifying the dominant system or `custom-or-none`
3. **`state.ui_audit.design_tokens`** — object grouped by category (colors, spacing, radius, font, shadow, breakpoint, other)
4. **`state.ui_audit.shadcn_inventory`** — object with version, style, base_color, primitives (only when stack is `react-shadcn`; `null` otherwise)
5. **`state.ui_audit.patterns`** — object with forms, tables, modals, empty_states, navigation, data_display arrays
6. **`state.ui_audit.candidates`** — top-5 similarity matches for the current input (may be empty)
7. **`state.ui_audit.greenfield`** — boolean; when true, `greenfield_decision` MUST also be set before the dispatcher advances
8. **`state.ui_audit.a11y_baseline`** *(optional)* — array of `{rule, selector, severity?}` entries documenting pre-existing a11y violations the review gate should treat as informational. Omit the key entirely when no baseline applies; do not write `[]` for "I checked and there are none" — that disables the gate's filter for every future run.

**Design-system export (current-repo source):** when the goal is to seed
`DESIGN.md` from *this* repo, emit the inventory as a `design-system.json`
artifact (the import contract in
[`design-system-capture`](../design-system-capture/references/design-system-json.md))
and hand it to `design-system-capture` — the same shape an external extraction
tool produces, so the import path is uniform.

## Gotcha

- The model tends to skip the audit and start designing straight from the request — the dispatcher gate at `directives/ui/audit.ts` enforces "no design without audit findings". Never treat this skill as optional for non-trivial UI.
- The model tends to misidentify a single Tailwind utility as a "design token" — tokens come from the config or `:root`, not from class strings in templates.
- Don't assume a Radix-only `package.json` means shadcn — shadcn requires `components.json` at the workspace root that owns the components. Each workspace carries its own; the repository root carries none, which is the layout the shadcn CLI scaffolds.
- `state.ui_audit.shadcn_inventory.version` is often missing; the shadcn CLI does not always pin itself in `package.json`. Record `null` rather than guessing.
- Greenfield is detected, not assumed — a project with one Blade layout and no components is still greenfield only if tokens AND design system markers AND components are all empty.
- **There is no mtime cache.** An earlier revision told you to cache by
  `(composer.json mtime, package.json mtime)` and re-audit when either changed.
  No code implemented it, and the key was the wrong one anyway: `apply` adds
  components without touching a manifest, so a manifest-keyed cache never
  invalidates on the change that matters. What the engine does is simpler and
  stricter — `audit.ts` returns SUCCESS unconditionally once `audit_path` is
  `high_confidence` or `ambiguous`, so the inventory is computed **once per
  state-file** and never refreshed.
- **What that means in practice.** A single request is one pass, so the
  inventory is fresh where it matters. The bounded gap is a run that reuses one
  state-file across several component additions: components written earlier in
  that run are absent from the inventory the later ones are checked against.
  Adding a second component in the same run → re-read the component directories
  directly rather than trusting `state.ui_audit.components_found`.
## Do NOT

- Do NOT advance to `directives/ui/design.ts` or `apply.ts` if `state.ui_audit` is empty.
- Do NOT advance to design or apply if `state.ui_audit.greenfield == true` and `state.ui_audit.greenfield_decision` is unset.
- Do NOT silently skip the greenfield halt because "Tailwind has defaults" — the user picks the path explicitly.
- Do NOT write paths outside the project root into the inventory.
- Do NOT rewrite `state.ui_audit` once it is populated unless re-detection is triggered by mtime change — design and apply read from it.
