---
model_tier: medium
name: tailwind-engineer
description: "Writing or reviewing Tailwind CSS — utility-first, design tokens, no inline-style drift, responsive variants, dark mode — 'style this' or 'mach das hübsch'. Pairs with react-shadcn-ui."
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

**That paragraph is written for greenfield, and artifact-bound work inverts
it.** When a provided finished design is the spec
([`design-fidelity`](../../rules/design-fidelity.md)), `#3B82F6` is a decision
somebody already made and `bg-blue-500` is a guess about it. Three obligations
follow, and the third is the one this skill used to get wrong:

1. **Do not snap.** Replacing the artifact's value with the nearest configured
   token is the deviation the rule's Iron Law forbids — *"NEVER SWAP … SPACING,
   OR COLOUR"* without explicit confirmation. An artifact-derived exact value is
   not a smell here: it *is* the spec, and the source-naming comment the
   paragraph above asks for is what records it.
2. **Translate once, not per call site.** Where the artifact's literal genuinely
   needs to live in the project's system, add **one** named project token
   carrying that exact value and use it everywhere — one token the project owns
   beats N approximations of the same colour. That is a token duty, not a
   deviation: the value does not change.
3. **Reconcile as a proposal, never autonomously.** Report each value's
   distance to the nearest project token on the `Reconciled:` line below, and
   let the human decide. Writing a *different* project value because the
   difference looks small is exactly the unconfirmed swap (1) rules out — the
   mode table at `design-fidelity.md:117-121` grants no visibility exemption,
   and `structural` grants only the filling of a spec that is genuinely
   **silent**, which an artifact stating `#3B82F6` is not.

**Why not "just approximate within tolerance", which is the eventual intent:**
that needs a tolerance to exist. There is none — no `reconcile`, `tolerance`,
`approximat` or `nearest` in the rule or its guideline — and both the threshold
and whether approximation is autonomous by default are owner decisions, tracked
as `blocker: approximation-tolerance` and `blocker: fidelity-default-flip` on
`road-to-design-intent-conformance`. Until they land, a skill granting that
autonomy would be re-writing the rule from underneath it.

Structure, controls, grid and breakpoints are never this skill's to adjust;
those stay 1:1 with the artifact and belong to the rule, not to a
utility-class decision. **Icons are out of scope here as well, and this skill
asserts no obligation about them** — the icon system belongs to
[`icon-consistency`](../../rules/icon-consistency.md). An earlier revision of
this paragraph claimed icons "stay 1:1 with the artifact" with no citation of
any kind, while putting them outside its own scope in the same sentence; the
claim is withdrawn rather than defended, because a clause that reached the tree
first does not thereby earn an evidentiary bar for its own reversal.

Token authoring (DTCG 3-layer model, CSS-var/Tailwind generation) lives
in [`design-tokens`](../design-tokens/SKILL.md); its
`tokens.ts validate --dir <path>` is the **single token-discipline
linter** — the mechanical check behind this rule (no hardcoded hex / px /
rem outside the token files). Greenfield Tailwind config: bundled
`scripts/tailwind_config_gen.ts` (Apache-2.0-derived, pure templating)
scaffolds `tailwind.config.{js,ts}` per framework.

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

The first two repetitions of a **utility-class string** are noise; the third
is a pattern (the utility-class row of the per-class canon,
[`abstraction-thresholds`](../../guidelines/abstraction-thresholds.md)).
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
   source they cite. Artifact-bound work adds a **Reconciled** block here:
   one line per value, as `<artifact value> → <kept, or the token that
   carries it exactly> (<distance to the nearest project token>)`. This is
   the destination "report the distance" means; without it the obligation
   has nowhere to land and is unobservable in the deliverable.
2. Class list — ordered (layout → box-model → typography → colour →
   state → responsive); inline-style use justified per element.
3. Extraction + risk call-out — component / constant / `@apply` / none
   with reason; risks named (arbitrary values, `!important`, dark-mode
   gaps, non-token references).

Concrete shape:

```
Element:        <selector or component name>
Token map:      <colour/spacing/etc → config token>
Reconciled:     <artifact value → kept or exact-carrying token, + distance>
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
  break the design system; they accumulate silently. **Artifact-bound is the
  exception, not a loophole:** a value the provided design specifies is not
  accumulation, and step 1's three obligations decide it. An arbitrary value
  nobody can trace to a source is still the smell this bullet is about.
- **The carrier is CSS or a utility class; the value is the design's.** Static
  presentation belongs in CSS / tokens / classes — `style=` is for what only
  the runtime knows (a computed width, a live transform, a measured offset).
  Porting an artifact's inline `style=` into classes is therefore expected and
  is not a deviation, **as long as the resolved value comes out identical**.
  Changing the carrier is free; changing the number is not.
- `@apply` inside component CSS interacts with PurgeCSS — keep it
  in files Tailwind scans, not in vendor CSS.
- **Anti-AI-slop catalog.** The bullets below are the Tailwind-specific
  manifestations of the stack-agnostic patterns in
  [`docs/guidelines/design-antipatterns.md`](../../guidelines/design-antipatterns.md)
  (C1 gradients, T7 fonts, L1/L2 layout, V1 side-stripe). Pull the catalog
  for the full list; the objective subset (contrast, font-size floor,
  reduced-motion) is validated via `accessibility-auditor`'s checklist —
  cite its verdict rather than eyeballing.
- **Anti-AI-slop: gradients.** Unless audit-pinned or brief-explicit,
  avoid the default purple-to-blue / cyan-to-pink gradients on white —
  they read as auto-generated (catalog C1/C2). Reach for a single accent
  from the token map, or a duotone built from configured tokens.
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

## Taste Dials

When `DESIGN.md` declares `## Taste Dials`, honour them: Variance → layout-family spread + asymmetry tolerance; Motion → animation budget + reduced-motion posture; Density → spacing scale + information-per-viewport. Absent → follow the design brief's inferred dials.

## Security constraints

`scripts/tailwind_config_gen.ts` is the only shipped script.

- **What it may touch** — exactly one file: `--output PATH`, or
  `tailwind.config.ts` / `.js` in the current working directory when no
  `--output` is given. It reads nothing from the project.
- **What it must never do** — write anywhere other than that one path,
  reach the network, or spawn a subprocess. It does none of these.
- **Default invocation** — **mutating**, and stated here because it is a
  real exception rather than a comfortable one: a bare invocation writes
  `tailwind.config.ts` into `cwd`, overwriting an existing config without
  prompting. `--validate-only` is the read-only path — it prints the
  generated config to stdout and writes nothing. Run `--validate-only`
  first, and pass `--output` when the target is not the cwd default.
  This default contradicts `skill-writing`'s "never mutate on a bare
  invocation" line; it is recorded rather than silently tolerated, and
  changing the script's default is a caller-visible behaviour change that
  belongs in its own change, not here.
- **Outbound** — nothing. No network access.

## Do NOT

- Do NOT run `tailwind_config_gen` bare in a project that already has a
  `tailwind.config.*` — it overwrites without asking. Use
  `--validate-only` first, then `--output` at the intended path.
- Do NOT add `!important` to win a specificity fight; restructure
  the cascade or extract the conflicting style.
- Do NOT introduce a new colour outside `tailwind.config` without
  also adding the token; one-off hex codes drift the system.
- Do NOT use `@apply` to avoid utility verbosity inside a single
  component — extract the component instead.
- Do NOT ship `style=` for static values; that is a CSS regression
  the linter will not catch.
