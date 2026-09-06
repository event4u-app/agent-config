---
model_tier: medium
name: react-shadcn-ui
description: "Use when building React UI on shadcn/ui primitives + Tailwind — the apply/review/polish skill dispatched by `directives/ui/*` for the `react-shadcn` stack; utility idiom from tailwind-engineer."
domain: engineering
workspaces:
  - engineering
packs:
  - react
trust:
  level: professional
install:
  default: false
  removable: true
scope:
  write:
    - pattern: "components/ui/**"
      access: "create"
    - pattern: "components.json"
      access: "write"
  verification_command: "npx shadcn@latest add <component> --dry-run"
execution:
  type: assisted
  handler: shell
  safety_mode: strict
  allowed_tools:
    - Bash(npx:*)
---

# react-shadcn-ui

> **Grounded stack guidance:** pull idiomatic Do/Don't + docs URLs via
> `./scripts-run <skills-root>/corpus-grounding/scripts/ground search
> --manifest <skills-root>/design-intelligence/data/manifest.json
> --stack shadcn "<topic>"` (also `--stack react`, `--stack nextjs`). See
> [`design-intelligence`](../design-intelligence/SKILL.md).

## Component installer — `scripts/shadcn_add.ts` (gated, assisted)

Bundled installer (Apache-2.0-derived, see header + `design-intelligence/ATTRIBUTION.md`)
wraps `npx shadcn@latest add <components>` — **the only subprocess+network
surface in the adopted suite**. Per `runtime-safety` + the `execution`
block above:

1. **Propose, never silent-run** — always show the exact `npx` command +
   component list first (use `--dry-run`); the user confirms before any
   live run.
2. **Missing tool** → per `missing-tool-handling`: if `npx`/Node is
   absent, STOP and ask (install vs. manual component copy) — never
   silently work around.
3. **Verify after run** — confirm the component landed
   (`components/ui/<name>.tsx` exists, `components.json` unchanged or
   sanely updated) before reporting success.

## Compatibility

- **Tested against:** `shadcn@4`, Tailwind CSS `4.x`, React `19`, primitives from
  `@base-ui/react@1`, `components.json` style `base-nova` — every major read out
  of `tests/fixtures/stack/shadcn-current/package.json`, the verbatim output of
  `npx shadcn@latest init -d --template vite` on 2026-08-24. No version on this
  line may be stated from prose; move it only by re-running that scaffold and
  re-committing the fixture.
- Tailwind `3.x` and Radix primitives stay supported through the **v3 branch**
  under § Gotcha — the CLI moved on, existing projects did not.
- The audit step (`directives/ui/audit.ts`) reads the line above and
  compares it with `state.ui_audit.shadcn_inventory.version`; a major
  mismatch triggers a soft halt before this skill runs.

## When to use

Use when `state.stack.frontend == "react-shadcn"` and `directives/ui/apply.ts`,
`review.ts`, or `polish.ts` dispatches to this skill, or when a React project
clearly uses shadcn/ui (presence of `components.json`, a `@base-ui/react` or
`@radix-ui/*` dependency, a `components/ui/` folder of generated primitives).

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
- shadcn/ui composes a primitive vendor — `@base-ui/react` in a CLI-4 scaffold,
  `@radix-ui/*` in older projects. Accessibility is built in either way, but
  only when the wrapper components are used correctly (`asChild`,
  `<DialogTrigger>` instead of a bare `<button>`).
- **Tailwind tokens: branch on the `css` axis, never guess.** `detect_stack()`
  emits `axes.css` as `tailwind-v4` or `tailwind-v3`
  (`work_engine/stack/detect.ts:521-524`); `existing-ui-audit` reads tokens on
  the same key.
  - `tailwind-v4` — **no config file exists.** Tokens live in the `@theme` block
    of the entry CSS named by `components.json` → `tailwind.css`, and that file's
    `"tailwind": {"config": ""}` — an empty `config` string — IS the v4 marker.
    Never write `tailwind.config.{js,ts}` in a v4 project.
  - `tailwind-v3` — tokens come from `tailwind.config.{js,ts}`
    (`theme.extend.colors`).
  - Either branch — CSS custom properties on `:root` and `.dark`
    (`--background`, `--foreground`, `--primary`, `--ring`, …). Audit writes them
    into `state.ui_audit.design_tokens`. Use those tokens; never hardcode values.
- Dark mode is class-based (`<html class="dark">`). Every color must come
  from `bg-background`, `text-foreground`, etc. — never raw `bg-white`.
- Every interactive primitive must declare a focus-visible state via
  `focus-visible:ring-2 focus-visible:ring-ring`; that comes for free with
  the generated primitives but is easy to remove during a refactor.
- **Anti-AI-slop: shadcn-default look.** The out-of-the-box shadcn
  theme + `Inter`-as-system-fallback + neutral grays reads as
  template across projects (catalog T7/T8 + C5). Unless
  `state.ui_audit.design_tokens` pins the neutral palette as the
  project's identity, the polish step should match typography and color
  tokens to the design brief's `aesthetic:` line (from `fe-design`
  aesthetic-direction). Theme/font drift within a single audited project
  breaks consistency — variation lives between projects, not between
  components in the same surface.
- **Anti-AI-slop catalog + linter.** Pull
  [`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md)
  before the polish step (Visual V1–V8, Layout L1–L10 are the React-component
  slop tells); the objective quality floors (WCAG contrast, focus-visible,
  reduced-motion) are validated via `accessibility-auditor`'s checklist —
  cite its verdict rather than eyeballing.

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

## Registry & MCP awareness (opt-in)

The default path is the bundled `scripts/shadcn_add.ts` CLI wrapper + reading
`components.json` — it works on most shadcn projects and stays the default.
The modern registry model is an **opt-in enhancement**; do not add round-trips
to every component op. Full JSON-schema + namespace detail is lazy-loaded from
[`references/registry.md`](references/registry.md) — read it only on this path,
not on the vanilla `add`.

**`shadcn info --json` handshake** — run it as the grounding step **when** the
project declares custom/namespaced `registries` in `components.json`, OR when
theme-alignment is in scope. It returns framework, aliases, installed
components, icon lib, and base settings. Do NOT make it a forced first action
on every `add` (over-gating; low ROI on vanilla projects).

- **Precedence vs our own audit:** prefer a live `shadcn info --json` when
  available; fall back to `state.ui_audit.shadcn_inventory` (from
  `existing-ui-audit`) when the CLI/MCP is not reachable. They answer the same
  question (project context) — the live read wins.

**Namespaced installs** — `@ns/item` resolves via the `registries` map to a
`registry-item.json` URL (see the reference). Run `view @ns/item` to inspect
the JSON before `add`. Honour `registryDependencies` (install the graph,
including version-pinned GitHub refs like `acme/ui/button#v1.2.0`); keep
propose-never-silent-run + `--dry-run`.

**Token-aware scaffolding** — when a `registry-item.json` carries `cssVars`
(OKLCH, light/dark/theme), align additions to the project's existing tokens
(from `info --json` / `components.json` / `state.ui_audit.design_tokens`) —
**never inject the default shadcn neutral theme** (it is a flagged anti-slop
tell: default theme + Inter fallback + neutral grays).

**MCP path (opt-in)** — the shadcn MCP server exposes browse / search-across-
registries / install-with-natural-language over MCP; configure per the
[`mcp`](../mcp/SKILL.md) skill. It is an alternative to the CLI, never a hard
dependency. Decision note: **CLI path = default + universal; MCP path = opt-in
when the user has it configured; registry-JSON literacy underpins both.**

## Publish a registry — the library as a source others install from

The sections above **consume** a registry. This one **publishes** one: a component library in
this repository can expose its own components the same way, so a consumer installs them with
the tool they already use instead of copying files.

1. **Author `registry.json`** at the library root — the index — and one
   `registry-item.json` per exposed component, each naming its files, its
   `registryDependencies`, and its `cssVars` when it carries token requirements.
2. **Build** to `public/r` with the registry build command. **The installer gate applies
   here exactly as it does to `add`**: propose it, run `--dry-run` first, and let the user
   confirm. A build writes files, so nothing about it being "our own" registry lifts the
   gate.
3. **The consumer adds a `registries` map entry** pointing at the published index; from then
   on `@ns/item` resolves through it.

**Two registry item types are FORBIDDEN**, deprecated in v4: `registry:build` and
`registry:mcp`. Use **`registry:base`** and **`registry:font`** instead. Writing either
deprecated type produces an item the current CLI does not understand, and the failure surfaces
at the consumer rather than at authoring time.

**`dependencies` in a registry item never names `react` or `react-dom`.** They are peers of
the consuming app, and a registry item that installs its own copy reproduces the "invalid hook
call" failure one layer up — see
[`js-library-packaging`](../js-library-packaging/SKILL.md). `check_package_surface` enforces
this over a registry file.

> **Provenance.** The registry-publishing shape and the deprecated-type list come from an
> external plugin reference's component-CLI skill, read at a pinned revision. The source is
> deliberately not named here, per
> [`source-confidentiality`](../../rules/source-confidentiality.md): a shipped artifact does
> not carry derivation attribution to a named external project. The identifier and revision
> stay with the maintainer-side record.

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
   — in the `@theme` block on `tailwind-v4`, in `tailwind.config.{js,ts}` on
   `tailwind-v3`). Polish refactors hardcoded values when a token exists.
3. Dark mode: never branch on a `dark` prop; rely on the `.dark` class
   on the root and semantic tokens.
4. Every interactive primitive: keyboard trigger present (Enter/Space
   on buttons, Esc on dialogs — free from the primitive vendor), focus ring,
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

### Review pass — a11y findings + preview envelope

When this skill is dispatched by `directives/ui/review.ts` (test slot)
or `directives/ui/polish.ts` (verify slot) — i.e. a review/polish run,
not the initial apply — it also emits:

- `state.ui_review.a11y` — `{violations: [{rule, selector, severity}, ...],
  severity_floor?, accepted_violations?}`. Run an a11y tool against the
  rendered output (e.g. `axe-core` via Playwright, `@axe-core/react`,
  `jest-axe`) and translate hits into this shape. Use the same
  `(rule, selector)` shape as `state.ui_audit.a11y_baseline` so the
  engine's de-dup matches pre-existing entries on replay. Omit the
  envelope on apply passes; the engine's `_apply_a11y_gate` only fires
  when a baseline is present.
- `state.ui_review.preview` — `{render_ok: bool, screenshot_path?,
  dom_dump_path?, error?, skipped?, skip_reason?}`. **Render evidence is
  required, not optional** on a review/polish pass: you MUST drive the
  headless browser (Playwright + axe-core) against the rendered output and
  write `render_ok`. Omitting it now triggers the `preview_render_required`
  halt — a render-capable stack can no longer claim success without
  rendering. `render_ok: false` with `error` populated triggers the
  `preview_render_failed` halt; `render_ok: true` with `screenshot_path`
  threads the screenshot into the delivery report's `artifacts` list. The
  only no-render path is an **explicit, reasoned skip**: set `skipped: true`
  plus a `skip_reason` (e.g. no Playwright runner in this env). Browser
  tooling (Playwright/Cypress/…) is a consumer-project dependency — this
  package does not ship one.

Polish dispatch: when the dispatcher skips `review` because a previous
review pass already returned `SUCCESS`, this skill MUST itself
synthesise the updated `state.ui_review.findings` (including any
remaining `a11y_violation` entries) so the engine's gate sees the
current state on the next polish round.

## Taste Dials

When `DESIGN.md` declares `## Taste Dials`, honour them: Variance → layout-family spread + asymmetry tolerance; Motion → animation budget + reduced-motion posture; Density → spacing scale + information-per-viewport. Absent → follow the design brief's inferred dials.

## Component workshop (Storybook) — pointer

The workshop discipline (one concept per story, `@summary` on every export, stories run as
tests, the `!manifest` tag, the opt-in MCP channel) lives in
[`storybook-workshop`](../storybook-workshop/SKILL.md). It is stack-agnostic and was lifted
out of here rather than duplicated beside it.

What stays React-specific and therefore stays here: the state-coverage matrix in Step 3 that
the story set is derived from, the token discipline of Step 2 that stories render under, and
the `(rule, selector, severity)` a11y shape in § Review pass that the workshop's validate
step writes into.

## Security constraints

`scripts/shadcn_add.ts` is the only shipped script, and it is the single
subprocess-plus-network surface in this suite — treat it accordingly.

- **What it may touch** — the project rooted at `--project-root` (default
  `cwd`): it reads `components.json` there and lets the upstream CLI write
  the generated primitives under that root. Nothing outside it.
- **What it must never do** — run without the exact `npx` command and the
  component list having been shown to the user first, per the gate above.
  Never pass `--overwrite` unprompted; never treat a non-zero exit as
  success; never work around a missing `npx` silently
  ([`missing-tool-handling`](../../rules/missing-tool-handling.md)).
- **Default invocation** — mutating. A bare `shadcn_add <component>`
  spawns `npx shadcn@latest add <component>` and writes into the project.
  `--dry-run` is the read-only path and prints the command it would run;
  `--list` is read-only too. Use `--dry-run` for the proposal step.
- **Outbound** — yes, and this is the point of the gate: `npx` resolves
  `shadcn@latest` from the public npm registry on every live run, so both
  the code fetched and the components written are chosen upstream, at run
  time, not pinned here. That is the egress leg of the lethal trifecta
  ([`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md)); the
  human confirmation is what keeps it off an autonomous path.

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
