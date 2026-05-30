---
model_tier: medium
name: tailwind-engineer
description: "Use when writing or reviewing Tailwind CSS — utility-first, design-token discipline, no inline-style drift, responsive variants, dark mode — even on 'style this' or 'mach das hübsch'."
personas:
  - frontend-engineer
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# tailwind-engineer

> Apply utility-first discipline. Reach for design tokens before
> arbitrary values, compose with `@apply` only where it earns its
> keep, and reject inline `style=` drift. The skill is the **how**
> for any Tailwind-stack screen; pair with
> [`existing-ui-audit`](../existing-ui-audit/SKILL.md) for the **what
> already exists** and [`fe-design`](../fe-design/SKILL.md) for the
> **why**.

## When to use

- Writing or reviewing Tailwind classes in Blade, Livewire, or React
  components.
- A diff introduces inline `style=` for dynamic values, hex codes
  not in `tailwind.config`, or `!important`.
- Class lists balloon past ~12 utilities and the component is
  hard to read or duplicate.
- German triggers: "stile mit Tailwind", "design tokens nutzen",
  "warum nicht inline?".

Do NOT use when:

- The stack is not Tailwind (vanilla CSS, CSS-in-JS, MUI) — skip.
- The question is component shape, not styling — route to
  [`ui-component-architect`](../ui-component-architect/SKILL.md).
- An accessibility issue is the symptom (focus ring, contrast, hit
  area) — route to [`accessibility-auditor`](../accessibility-auditor/SKILL.md).

## Procedure

### 1. Resolve to design tokens first

Inspect `tailwind.config.{js,ts}` (or the equivalent `@theme` block)
and identify the configured tokens. Map every requested colour,
radius, spacing, shadow, font-size to a configured token. If the design hands you `#3B82F6`, use
`bg-blue-500` (or the project's named token). Arbitrary values
(`bg-[#3B82F6]`, `mt-[17px]`) are a smell — accept only with a
one-line comment naming the design source.

### 2. Compose, don't inline

Inline `style="..."` is allowed only for **runtime-computed values**
the build cannot know (server-pushed colour, animated transform
target). Static values inline are a regression — replace with a
utility, an arbitrary value, or a token extension.

### 3. Order classes for scan-ability

Group by axis: layout → box-model → typography → colour → state
→ responsive. Most projects pin this with `prettier-plugin-tailwindcss`;
if the plugin is configured, run it; if not, follow the order
manually. Reviewer should read intent in one pass.

### 4. Extract only when duplicated ≥ 3 times

The first two repetitions are noise; the third is a pattern.
Extract via:

| Mechanism | When |
|---|---|
| Component (Blade/Livewire/React) | Different content, same shell |
| Class string constant | Same shell, different consumers in same file |
| `@apply` in CSS | Cross-file shared visual primitive (button, badge) |
| Tailwind plugin | Tokens or variants, not classes |

`@apply` for a one-off is a regression — keep utilities inline
until the third use earns extraction.

### 5. Responsive + dark + state in that order

Class order within an axis: base → `sm:` → `md:` → `lg:` → `xl:` →
`dark:` → state (`hover:`, `focus:`, `disabled:`, `aria-*:`).
Mixing the order makes diffs noisy. State on top of dark on top
of responsive matches Tailwind's cascade and reads top-down.

## Output format

When reviewing or proposing styles, return:

1. Token map — every colour, spacing, radius, shadow, font-size mapped
   to its configured token; arbitrary values flagged with the design
   source they cite.
2. Class list — ordered (layout → box-model → typography → colour →
   state → responsive); inline-style use justified per element.
3. Extraction + risk call-out — component / constant / `@apply` / none
   with reason; risks named (arbitrary values, `!important`, dark-mode
   gaps, non-token references).

Concrete shape:

```
Element:        <selector or component name>
Token map:      <colour/spacing/etc → config token>
Class list:     <ordered classes>
Inline style:   <only if runtime-computed; else "none">
Extraction:     <component | constant | @apply | none — reason>
Risks:          <arbitrary values, !important, dark-mode gaps>
```

## Gotcha

- `space-x-*` / `space-y-*` collide with `flex-wrap` and RTL — use
  `gap-*` on the flex/grid parent unless the design demands otherwise.
- `dark:` variants need a token map in both modes; one-sided dark
  styling is half a feature.
- Arbitrary values (`mt-[17px]`) survive Tailwind upgrades but
  break the design system; they accumulate silently.
- `@apply` inside component CSS interacts with PurgeCSS — keep it
  in files Tailwind scans, not in vendor CSS.
- **Anti-AI-slop: gradients.** Unless audit-pinned or brief-explicit,
  avoid the default purple-to-blue / cyan-to-pink gradients on white —
  they read as auto-generated. Reach for a single accent from the
  token map, or a duotone built from configured tokens.
- **Anti-AI-slop: typography.** Unless audit-pinned, avoid surfacing
  the system stack (`font-sans` fallback to Arial / Helvetica / Inter
  via system defaults) as the *visible* body face. If `tailwind.config`
  pins a font family, use it; if not, treat the missing token as a
  gap to flag, not a license to ship the OS default.
- **Anti-AI-slop: layout.** Unless audit-pinned, the centered hero +
  3-column features + CTA stack is the AI-template tell. Break the
  grid intentionally (asymmetric column split, overlap, diagonal
  flow) when the brief allows; cite the design brief's `aesthetic:`
  line if `fe-design`'s aesthetic-direction section produced one.

## Do NOT

- Do NOT add `!important` to win a specificity fight; restructure
  the cascade or extract the conflicting style.
- Do NOT introduce a new colour outside `tailwind.config` without
  also adding the token; one-off hex codes drift the system.
- Do NOT use `@apply` to avoid utility verbosity inside a single
  component — extract the component instead.
- Do NOT ship `style=` for static values; that is a CSS regression
  the linter will not catch.
