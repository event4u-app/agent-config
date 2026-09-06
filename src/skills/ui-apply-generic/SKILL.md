---
model_tier: medium
name: ui-apply-generic
description: "Use when implementing a UI brief on a stack with no framework executor — Svelte, Astro, Angular, plain HTML. Stack-independent sibling of react-shadcn-ui; idiom from the stack corpus."
personas:
  - frontend-engineer
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# ui-apply-generic

> The `plain` lane used to be a name with nothing behind it. This skill is the
> lane: it carries the implementation discipline that previously lived **only**
> inside the framework executors, and it gets framework idiom from the 16-stack
> corpus instead of from prose written here.
>
> That split is the whole point. One skill plus a corpus serves Svelte, Astro,
> Angular, Alpine, htmx and everything future at once. Sixteen framework skills
> would serve the same set and cost a single maintainer sixteen surfaces to keep
> current — the enumeration this package refuses.

## When to use

- `state.stack.frontend` resolves to `plain`, or to a label with no
  framework-specific overlay.
- A stack whose `axes.reactivity` or `axes.meta` is recognised but has no
  executor skill (`svelte`, `angular`, `astro`, `solid`, `qwik`, `htmx`).
- As the base of a composition: an overlay skill (`livewire`, `flux`,
  `blade-ui`, `react-shadcn-ui`) adds framework specifics **on top** of this
  contract, it does not replace it.

Do NOT use when a framework executor already covers the whole job — then this
skill is the base and the executor is the overlay, dispatched together.

## Procedure

### Step 1 — Query the stack corpus (mandatory)

Read `state.stack.axes` and query per resolved axis value, most specific first:
`meta` → `reactivity` → `component_lib`.

```bash
<skills-root>/corpus-grounding/scripts/ground search \
  --manifest <skills-root>/design-intelligence/data/manifest.json \
  --stack <axis-value> "<the concrete question>"
```

`axes.meta: nuxt` with `axes.reactivity: vue` means **two** queries —
`--stack nuxtjs` and `--stack vue`. A meta-framework does not replace the layer
it wraps; that conflation is the defect the axes exist to fix.

**Cite what you used.** The result names the corpus rows the implementation
followed. An uncited pick is indistinguishable from the model's memory, and
memory is exactly what the corpus exists to replace.

**No corpus domain for the detected stack** → say so, in the result:

> No stack corpus for `<stack>` — proceeding on the generic contract. Framework
> idiom below is not grounded and should be reviewed by someone who knows this
> stack.

Silence is the failure mode. An unstated gap reads as grounded output.

### Step 2 — Apply the stack-independent contract

Every item is a hard requirement, and none of them is framework-specific:

1. **Verbatim floor.** Microcopy comes from `state.ui_design.microcopy` exactly
   as written — every label, empty-state line, and validation message. No
   paraphrase, no improvement. Where a source artifact was provided, it beats
   the brief (see `design-fidelity`).
2. **Token discipline.** Colour, spacing, radius and shadow values come from the
   project's tokens. A raw hex or arbitrary px that no token backs is a finding,
   not a choice. Validate with `design-tokens`' `tokens validate`.
3. **Component reuse.** Check `state.ui_audit.components_found` before creating
   anything. In a run that has already added components, re-read the component
   directories — the audit inventory is computed once per state-file and does
   not refresh (see `existing-ui-audit` § Gotchas).
4. **a11y floor.** Semantic elements over `div` + role; every interactive
   element reachable and labelled; focus visible; contrast meets the project's
   stated level, AA when unstated.
5. **All five states.** `empty`, `loading`, `error`, `success`, `disabled` per
   the brief. An explicit `n/a` is legitimate for a surface that genuinely has
   no such state — declaring that is the opposite of inventing filler.
6. **Asset discipline.** Copy referenced assets into the project's asset path.
   Never hotlink; never fabricate a logo or a screenshot.
7. **No placeholders.** `<placeholder>`, `lorem`, `todo:`, `tbd`, `xxx` are
   rejected at the boundary — including inside arrays.

### Step 3 — Verify, with honest degrade

Exercise the result with whatever the host actually has, and name which:

| Available | Do |
|---|---|
| Browser / Playwright | Render, check the states, exercise one interaction |
| Screenshot only | Capture and inspect layout at 375 / 768 / 1280 |
| Neither | Static inspection only, and **say** the render is unverified |

Never claim a state or interaction works without having exercised it. A caveat
is a finding; a silent claim is a defect.

## Output format

Four requirements, in order — each is checkable by a reader of the result:

1. **Name the corpora queried**, or state that none exists for this stack.
2. **Cite the rows that changed a decision** — not every row read.
3. **State the verification method and its caveats**, never an unqualified
   "works".
4. **List components reused before components added**, so a duplicate is
   visible rather than buried.

Write `state.ticket["ui_apply"]`:

```yaml
ui_apply:
  files: ["resources/js/UserCard.svelte"]
  rendered:
    "resources/js/UserCard.svelte": |
      <full text, microcopy-locked>
  components_added: ["UserCard"]
  components_reused: ["Button"]
  microcopy_lock: true
  stack_corpus:                 # which corpora answered, or the degrade note
    queried: ["svelte"]
    cited: ["svelte.csv:12 — prefer stores over prop drilling"]
  verify:
    method: static_inspect      # or playwright / screenshot
    caveats: ["render not verified — no browser available"]
```

## Gotchas

- **Do not write framework prose into this skill.** The moment it explains how
  Svelte stores work, it stops being one maintainable surface and starts being
  sixteen. Framework knowledge belongs in the corpus.
- **`axes.reactivity: unknown` is not `none`.** `unknown` means a project has
  manifests and no recognised reactivity layer — proceed, and say the stack was
  not recognised. `none` means there genuinely is no reactivity layer, which is
  the normal shape for a static page.
- **A meta-framework needs its own query.** Querying only `--stack vue` for a
  Nuxt project silently drops the routing, data-fetching and SSR idioms that
  are the whole reason Nuxt exists.
- **The generic contract is a floor, not a ceiling.** Where an overlay skill is
  dispatched with this one, its framework rules win on their subject.
- **The floor now lives in exactly one place, and that is the point.** Overlay
  composition applies this contract to every lane, so a future change to any of
  its seven items is a one-point edit here rather than four lane patches that
  drift apart. Concretely: the five-states requirement reaches every lane
  through this skill. That requirement is deliberately unconditional — an
  explicit `n/a` is the escape for a surface that genuinely has no such state
  (asserted in `ui_lane_matrix.test.ts`), so this is not a defect being
  broadened. But if the decision is ever revisited, revisit it here.

## Do NOT

- Emit framework code from memory and present it as grounded.
- Skip the corpus query because the stack "looks obvious".
- Claim a render or an interaction was verified when no primitive was available.
- Invent states, sections, or copy the brief does not carry.
- Treat a missing corpus as an evidence gap — it is a missing pack, and the two
  must not be recorded the same way.

## See also

- [`design-intelligence`](../design-intelligence/SKILL.md) — the `--stack`
  corpus this skill queries (16 stacks).
- [`existing-ui-audit`](../existing-ui-audit/SKILL.md) — the inventory Step 2
  checks, and its once-per-state-file limit.
- [`design-tokens`](../design-tokens/SKILL.md) — `tokens validate`.
- [`fe-design`](../fe-design/SKILL.md) — where the brief's selection decisions
  come from, and what it does when the corpus is not installed.
- [`ui-component-architect`](../ui-component-architect/SKILL.md),
  [`tailwind-engineer`](../tailwind-engineer/SKILL.md) — stack-neutral
  companions this skill composes with.
