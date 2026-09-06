# design-intelligence — context and registers

> Section-level entry point of the `design-intelligence` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Cross-task design memory — read DESIGN.md / PRODUCT.md first

Before running the corpus grounding or producing any design brief, check
the project root for `DESIGN.md` and/or `PRODUCT.md` (written by
`design-system-capture`). If they exist:

1. Read `DESIGN.md` — apply its captured visual decisions (radius, shadows,
   motion, spacing) as **project constraints** that take precedence over
   corpus suggestions. The corpus fills gaps; DESIGN.md overrides.
2. Read `PRODUCT.md` — note interaction patterns that affect the design
   (e.g., destructive-action policy, empty-state approach) so the brief
   is consistent with existing product conventions.
3. After generating the design brief: if a decision was made that isn't yet
   in DESIGN.md (e.g., chose a specific shadow for a new elevated surface),
   flag it for capture: *"Suggest adding to DESIGN.md: elevated surface shadow = …"*

Boundary vs `brand-to-tokens`/`.tokens.json`:
- `.tokens.json` = primitive definitions (gray-700 = #374151)
- `DESIGN.md` = usage decisions (elevated surfaces use the gray-700 shadow, 8px radius)
Both are consumed; DESIGN.md takes precedence for usage questions.

## Register — brand vs product

Determine the design register before grounding (see
[`docs/guidelines/design-modes.md`](../../../../docs/guidelines/design-modes.md)):
**brand mode** ("the impression IS the product" — marketing, landing, consumer
first-impression) prioritizes distinctive selection; **product mode** ("design
serves the task" — dashboard, admin, workflow) prioritizes earned familiarity
and accessibility. The register changes which corpus selections are appropriate
(distinctive palette/typography in brand mode; predictable, semantic in product
mode). State the register in the Design Read line below.

**Embedded vs standalone (a third discriminator).** UI **embedded inside a host
surface** — a widget in a slide, a card in a chat, a panel in someone else's
app — follows a **flatter charter** than a greenfield standalone page:
restrained weights, hairline borders, no atmospherics/gradients/shadows that
would fight the host. Select the register per surface (embedded → flat;
standalone → the brand/product register above) — it is a selector, not a fixed
token set (no values vendored; the host's tokens win).

## Design Read — articulate intent before generating

Before producing any design brief or making any style selection, emit one
line that declares the design read:

```
Reading this as: <page-kind> for <audience>, <vibe> language, leaning <design-system>.
```

Examples:
- `Reading this as: SaaS dashboard for internal ops teams, functional language, leaning Radix/shadcn.`
- `Reading this as: marketing landing for B2C consumer product, playful editorial, leaning custom tokens.`
- `Reading this as: admin panel for technical users, dense/utilitarian language, leaning data-grid primitives.`

**If context is incomplete:** state so and proceed exploratory — *"Design context incomplete: no audience defined; proposing exploratory direction, expect revision after audience is clarified."* Do NOT block on missing context; do NOT prompt the user with a gate; state the gap and continue.

### Taste Dials — quantify, infer, emit

If `DESIGN.md` declares `## Taste Dials`, use those values. Otherwise infer
three 1–10 dials from the brief and append them to the Design Read line
(`… · dials V/M/D = 6/3/4`) so the user can correct them; on confirmation,
suggest persisting to `DESIGN.md` (via `design-system-capture`). Dials are a
config, not a vibe — never re-infer when `DESIGN.md` already sets them
(no drift across sessions).

**Dial Inference Table** (brief signal → Variance / Motion / Density, 1–10):

| Brief signal | V | M | D |
|---|---|---|---|
| minimal / calm / editorial / clean | 3–5 | 2–4 | 2–4 |
| trust / regulated / public-sector / fintech | 3–4 | 2–3 | 4–6 |
| default / unstated | 5–6 | 3–4 | 4–5 |
| data-dense / dashboard / admin / cockpit | 4–6 | 2–3 | 7–9 |
| bold / playful / expressive / awards / Dribbble | 8–10 | 7–10 | 3–5 |
| **DISQUALIFIER** — brief `frequency: high` or `initiation: keyboard` | — | **cap 3** | — |

The Motion row is the one dial with a **disqualifier**, and it outranks the
brief signal above it rather than averaging with it. The two brief fields it
reads are `frequency` and `initiation` ([`fe-design`](../../fe-design/SKILL.md)
§ The loop, step 2): a surface used 100-plus times a day, or reached by
keyboard, does not get a high Motion dial however expressive the rest of the
brief reads. A keyboard-initiated surface is reached by someone who already
knows where they are going, so the animation is latency they pay on every
invocation — the decision tree in
[`design-patterns.md`](../../fe-design/references/design-patterns.md) § Motion
answers "should this animate at all" with *no* for exactly this case, and a
dial that could still reach 9 would contradict it.

A `bold / playful` brief on a command palette therefore resolves to `V 8–10 ·
M ≤ 3 · D 3–5`, and the cap is stated in the Design Read line so the user can
see it fired rather than wondering why the motion is flat.

**Dial → downstream levers** (how a dial value changes generation):

| Dial | Low (1–3) | High (8–10) |
|---|---|---|
| Variance | symmetric grids, one layout family | asymmetry, varied layout families, off-grid accents |
| Motion | static / `prefers-reduced-motion`-first, opacity-only | choreographed scroll/stagger (still GPU-only, still reduced-motion alt) |
| Density | generous whitespace, large spacing scale, few items/viewport | tight spacing scale, more information per viewport |

Dials persist in `DESIGN.md`; the stack executors (`tailwind-engineer`,
`react-shadcn-ui`, `blade-ui`, `flux`) read `DESIGN.md` and honour them.

**Anti-Default Discipline — first-impulse check:** Before committing to any
design direction, cross-check your first impulse against the current-generation
tells in [`design-antipatterns.md`](../../../../docs/guidelines/design-antipatterns.md)
(§ Current-generation tells — the warm-editorial C5+T2+T7 signature and the
previous-generation C1/C2 gradient) plus the L1/L2 layout defaults. If a tell
was your first reach, name a different direction or explicitly justify why this
brief genuinely calls for it. (The finalization cross-check against the full
catalog is under *Anti-slop discipline* below.)
