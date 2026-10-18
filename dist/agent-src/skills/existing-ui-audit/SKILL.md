---
model_tier: high
name: existing-ui-audit
description: "Use BEFORE writing or editing any non-trivial UI — inventories components, design tokens, shadcn primitives, and reusable patterns into state.ui_audit. Hard gate for fe-design."
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
[design-artifact lifecycle](../../docs/contracts/design-artifact-lifecycle.md).
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

The order is held by [`procedure.yaml`](procedure.yaml). Open the steps one at a time, in order, and start a step only after the one before it has met its exit. A `judgement` exit is sequenced, not verified: state what you decided before moving on.

1. [0. Inspect stack and input](references/steps/00-inspect-stack-and-input.md) — exit: `judgement`
2. [1. Enumerate components and templates](references/steps/01-enumerate-components.md) — exit: `check: ui-audit-components-in-tree`
3. [1b. Detect the component-granularity taxonomy](references/steps/01b-detect-component-taxonomy.md) — exit: `check: ui-audit-taxonomy-root-in-tree`
4. [2. Identify the design system](references/steps/02-identify-design-system.md) — exit: `judgement`
5. [3. Detect design tokens](references/steps/03-detect-design-tokens.md) — exit: `judgement`
6. [4. Detect shadcn inventory (react-shadcn only)](references/steps/04-detect-shadcn-inventory.md) — exit: `judgement`
7. [4b. Prefer a live Storybook read when one is running](references/steps/04b-live-storybook-read.md) — exit: `judgement`
8. [5. List reusable patterns](references/steps/05-list-reusable-patterns.md) — exit: `check: ui-audit-patterns-in-tree`
9. [6. Match candidates for the current input (with the 6b conformance gate)](references/steps/06-match-candidates.md) — exit: `check: ui-audit-candidates-from-inventory`
10. [7. Greenfield branch](references/steps/07-greenfield-branch.md) — exit: `check: ui-audit-greenfield-consistent`
11. [8. (Optional) Capture an a11y baseline](references/steps/08-a11y-baseline.md) — exit: `judgement`
12. [9. Validate and write findings](references/steps/09-validate-and-write.md) — exit: `check: ui-audit-complete`

## Section index — load on demand

Load on demand once the audit needs the pitfall catalog:

- [`references/anti-slop-cross-reference.md`](references/anti-slop-cross-reference.md) — Anti-slop cross-reference
- [`references/component-taxonomy-detection.md`](references/component-taxonomy-detection.md) — Component-taxonomy detection rules

## Output format

1. **`state.ui_audit.components`** — array of component/template descriptors (path, name, kind, exports)
2. **`state.ui_audit.design_system`** — single string identifying the dominant system or `custom-or-none`
3. **`state.ui_audit.design_tokens`** — object grouped by category (colors, spacing, radius, font, shadow, breakpoint, other)
4. **`state.ui_audit.shadcn_inventory`** — object with version, style, base_color, primitives (only when stack is `react-shadcn`; `null` otherwise)
5. **`state.ui_audit.patterns`** — object with forms, tables, modals, empty_states, navigation, data_display arrays
6. **`state.ui_audit.candidates`** — top-5 similarity matches for the current input (may be empty)
7. **`state.ui_audit.greenfield`** — boolean; when true, `greenfield_decision` MUST also be set before the dispatcher advances
7b. **`state.ui_audit.component_taxonomy`** / **`component_root`** — the project's own granularity tiers joined with `/` (or `none`), and where the components live relative to the project root. Never a canonical tier list — a project with three tiers records three; `none` is the value that leaves every downstream step unchanged.
8. **`state.ui_audit.a11y_baseline`** *(optional)* — array of `{rule, selector, severity?}` entries documenting pre-existing a11y violations the review gate should treat as informational. Omit the key entirely when no baseline applies; do not write `[]` for "I checked and there are none" — that disables the gate's filter for every future run.

**Design-system export (current-repo source):** when the goal is to seed
`DESIGN.md` from *this* repo, emit the inventory as a `design-system.json`
artifact (the import contract in
`design-system-capture`)
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
