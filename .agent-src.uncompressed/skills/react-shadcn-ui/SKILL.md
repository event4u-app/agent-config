---
name: react-shadcn-ui
description: "Use when building React UI on shadcn/ui primitives + Tailwind — the apply/review/polish skill dispatched by `directives/ui/*` for the `react-shadcn` stack."
source: package
---

# react-shadcn-ui

## Compatibility

- **Tested against:** `shadcn@2.1`, Tailwind CSS `3.x`, React `18+`.
- The audit step (`directives/ui/audit.py`) reads the line above and
  compares it with `state.ui_audit.shadcn_inventory.version`; a major
  mismatch triggers a soft halt before this skill runs.

## When to use

Use when `state.stack.frontend == "react-shadcn"` and `directives/ui/apply.py`,
`review.py`, or `polish.py` dispatches to this skill, or when a React project
clearly uses shadcn/ui (presence of `components.json`, `@radix-ui/*`
dependencies, a `components/ui/` folder of generated primitives).

Do NOT use when:
- Project is Blade + Livewire + Flux (use `flux` / `livewire` / `blade-ui`).
- Project is Vue (use the Vue stack skills).
- Plain React without shadcn/ui — fall back to manual composition; this skill
  assumes the primitive set exists.

## Gotcha

- shadcn/ui is **not** an npm package. Primitives are copied into
  `components/ui/` and edited in-place. Do not `npm install shadcn-ui`.
  Run `npx shadcn@latest add <primitive>` to scaffold; then edit.
- Major-version drift between this skill's `## Compatibility` line and
  the project's installed primitives is a real risk. The audit step
  writes `state.ui_audit.shadcn_inventory` with the detected version —
  when it diverges by a major, audit emits a soft halt before this
  skill runs.
- shadcn/ui composes Radix primitives. Accessibility is built in via Radix
  but only when you use the wrapper components correctly (`asChild`,
  `<DialogTrigger>` instead of a bare `<button>`).
- Tailwind tokens come from `tailwind.config.{js,ts}` (`theme.extend.colors`)
  and CSS custom properties on `:root` and `.dark` (`--background`,
  `--foreground`, `--primary`, `--ring`, …). Audit writes them into
  `state.ui_audit.design_tokens`. Use those tokens; do not hardcode values.
- Dark mode is class-based (`<html class="dark">`). Every color must come
  from `bg-background`, `text-foreground`, etc. — never raw `bg-white`.
- Every interactive primitive must declare a focus-visible state via
  `focus-visible:ring-2 focus-visible:ring-ring`; that comes for free with
  the generated primitives but is easy to remove during a refactor.

## Covered primitives

This skill is validated against the following shadcn primitives at the
declared version:

- **Form / inputs:** `Button`, `Input`, `Textarea`, `Checkbox`,
  `RadioGroup`, `Select`, `Switch`, `Label`, `Form` (react-hook-form
  wrapper + `zodResolver`).
- **Overlay:** `Dialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`,
  `AlertDialog`.
- **Layout:** `Card`, `Separator`, `Tabs`, `Accordion`, `ScrollArea`.
- **Data display:** `Table` (with `@tanstack/react-table`), `Badge`,
  `Avatar`, `Skeleton`, `Progress`.
- **Feedback:** `Toast` (sonner), `Alert`.

## Not covered — fall back to manual composition

- Marketing-only components (Hero, Pricing, Features) — outside shadcn/ui.
- `Calendar` / `DatePicker` — composition skill required, not generated.
- `Combobox` — built from `Command` + `Popover`; case-by-case.
- Streaming / partial-prerender boundaries — use the project's framework
  patterns (Next.js / Remix), not shadcn/ui.

## Procedure: render a shadcn/ui component for the design brief

### Step 0: Inspect

1. Read `state.ui_audit.shadcn_inventory.version` and confirm it matches
   the version in `## Compatibility` within the same major. If audit
   flagged a mismatch, the user already chose to proceed — note that
   in `state.changes`.
2. Read `state.ui_audit.design_tokens` — every color, spacing, and radius
   in the rendered output must reference a token from this map.
3. Read `state.ui_design`:
   - `components` → the primitive list to compose.
   - `microcopy` → button labels, empty-state text, validation messages.
     **Lock — render verbatim.**
   - `states` → empty / loading / error / success / disabled coverage.
   - `a11y` → ARIA labels, keyboard nav, focus order.

### Step 1: Compose primitives

1. Import primitives from the project's `components/ui/` path
   (`@/components/ui/button`, …) — never from `shadcn` or `radix-ui`.
2. Compose Radix-style: `<Dialog>` → `<DialogTrigger asChild>` →
   `<DialogContent>` → `<DialogHeader>` → `<DialogTitle>`. Never wrap
   `DialogTrigger` around a pre-styled `<button>`; pass `asChild`.
3. Use the variant API of `Button` (`variant="default" | "destructive" |
   "outline" | "secondary" | "ghost" | "link"`); do not override with
   raw Tailwind for the variant set.
4. Forms: `useForm` (react-hook-form) + `zodResolver(schema)` →
   `<Form>` → `<FormField>` → `<FormItem>` → `<FormLabel>` →
   `<FormControl>` → `<FormMessage>`. Validation messages come from
   the zod schema, mirrored to the design-brief microcopy.

### Step 2: Apply tokens, dark mode, a11y

1. Colors via semantic classes: `bg-background`, `text-foreground`,
   `bg-primary text-primary-foreground`, `text-muted-foreground`. No
   `bg-white` / `text-black` / hardcoded `#fff`.
2. Spacing / radius from theme tokens (`rounded-lg` mapped to `--radius`
   in `tailwind.config.{js,ts}`). Polish refactors hardcoded values
   when a token equivalent exists.
3. Dark mode: never branch on a `dark` prop; rely on the `.dark` class
   on the root and semantic tokens.
4. Every interactive primitive: keyboard trigger present (Enter/Space
   on buttons, Esc on dialogs — Radix free), visible focus ring,
   `aria-label` from `state.ui_design.a11y` when icon-only.

### Step 3: State coverage

1. Empty: render the design-brief empty-state copy in a `Card` or
   inline placeholder; never `null`.
2. Loading: `Skeleton` rows for tables; `Button` `disabled` +
   `Loader2` icon for submit-in-flight.
3. Error: `Alert variant="destructive"` with the design-brief message;
   `FormMessage` for field-level errors.
4. Success: `toast.success(...)` from `sonner` with the design-brief
   confirmation copy.
5. Disabled: `disabled` prop on the trigger plus the design-brief
   reason as `aria-describedby` text.

### Step 4: Validate

1. No raw `<input>` / `<button>` / `<select>` outside the primitive set.
2. No hardcoded colors / spacing — every value is a token.
3. Microcopy matches `state.ui_design.microcopy` byte-for-byte.
4. Dark mode: toggle `.dark` on `<html>`, render the component, every
   surface still legible (no `text-white on bg-white`).
5. Keyboard: Tab through every focusable element; focus ring visible.

## Output format

1. React component file(s) under the project's `components/` (or `app/`)
   tree, importing primitives from `@/components/ui/*`.
2. Per file, one entry recorded in `state.changes` with `kind="ui"`,
   `stack="react-shadcn"`, and the design-brief summary.

## Do NOT

- Do NOT install `shadcn-ui` from npm — primitives are scaffolded.
- Do NOT hardcode colors / spacing / radii — use the token map.
- Do NOT branch on a `dark` prop — use semantic tokens + the `.dark` class.
- Do NOT rewrite microcopy — it is locked by `state.ui_design`.
- Do NOT skip `asChild` on `DialogTrigger` / `SheetTrigger` / similar
  Radix wrappers — it breaks the accessibility contract.
- Do NOT introduce a non-shadcn UI library (MUI, Chakra) into the same
  surface — pick one system per surface.

## Auto-trigger keywords

- shadcn / shadcn ui / shadcn/ui
- React component (when the project uses shadcn)
- Radix primitive
- Tailwind dark mode
- React Hook Form + zod
