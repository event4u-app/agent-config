<!-- evidence-type: analysis -->
# What the tree itself emits — apply-skill and grounding-corpus sweep

<!-- generated-by: hand, road-to-tell-currency step 4.1 · verified against 7211a4274 + this branch -->

Step 4.1's record. It asks whether this repository hands an agent a default the
anti-pattern catalog then flags, and requires every finding to be **fixed or
stated as intentional with a reason**. The council widened the scope on a 2/2
verdict: the four apply skills the step names, **plus `design-intelligence`**,
which is the one place in the tree that recommends three of the four tells this
roadmap added.

## 1. The four named apply skills — three clean, one gap

| Skill | Anti-slop section | Forbids its own ecosystem default, with a catalog citation? |
|---|---|---|
| `react-shadcn-ui` | `SKILL.md:114-128`, restated `:181-183` | **Yes.** The shadcn out-of-the-box neutral theme + Inter fallback, cited as `T7/T8 + C5`, with a concrete override hook (`state.ui_audit.design_tokens`). The strongest of the four. |
| `tailwind-engineer` | `SKILL.md:134-155` | **Yes, partially.** Tailwind's default gradient reach is cited inline (`C1/C2`, `:143`). The typography and layout bullets (`:145-155`) carry the ban without an inline id — `T7` and `L1/L2` appear only in the roll-up at `:137`. |
| `blade-ui` | `SKILL.md:141-148` | **No.** It cites `V1`, `T3`, `L1/L2` correctly, but none of those is a *Laravel* ecosystem default. Breeze / Jetstream scaffold markup and the default `x-` component look are never named (`grep -ni "breeze\|jetstream\|scaffold"` returns only a frontmatter key and a Blade-escaping line). It delegates concrete bans to `tailwind-engineer`, which bans **Tailwind's** defaults, not Laravel's. The clearest gap of the four. |
| `fe-design` | `SKILL.md:247-253` | **No — correctly.** It is the stack-agnostic heuristic layer and owns no ecosystem default; the catalog's own ownership table assigns stack manifestation to `tailwind-engineer` and `react-shadcn-ui`. |

So the step's literal scope was satisfiable with no edit for three of four skills.
The findings are elsewhere.

## 2. Fixed in this change

| Finding | Where | What it was | Disposition |
|---|---|---|---|
| **M4 handed over as the good example** | `src/skills/design-intelligence/data/ux-guidelines.csv:9` | The column literally named `Code Example Good` carried `transition-all duration-200`. `transition-all` is Tailwind's compilation of `transition-property: all`, i.e. M4's exact defect — and M4 is `backed`. | **FIXED** → `transition-colors duration-200`, which is what the row's own `Do` cell ("Use 150-300ms for micro-interactions") and M4's override ("enumerate only the properties that should animate") both ask for. The old value moved to `Code Example Bad`, where it now demonstrates two defects at once. |
| **Two stale catalog id ranges** | `src/skills/react-shadcn-ui/SKILL.md:125`, `src/skills/fe-design/SKILL.md:249` | Both cited `Visual V1–V7, Layout L1–L8`. Literally correct as *table* extents and materially wrong as *category* coverage: `V8` (shape lock), `L9` (section monotony) and `L10` (zigzag) live in the Consistency-Locks table, and all three are `backed`. A shadcn tree with four `rounded-*` tiers is V8 and was unreachable through either citation. | **FIXED** → `V1–V8` / `L1–L10`, with the table topology stated in the `react-shadcn-ui` line so the next reader does not re-narrow it. `fe-design` also gains `Motion (M1–M8)`. |
| **A register-scoping overclaim** | `src/skills/fe-design/SKILL.md:252` | "every entry has one, and they are register-scoped" — only **two** entries are register-scoped. `grep -c 'egister-scoped'` over the catalog returns 2: T7 and T8, both of which say so in their own override text. | **FIXED** → the override-condition claim is kept (it is true of every entry) and the register-scoping narrowed to T7/T8, with the undeclared-pick clause preserved. |

**Why the M4 row mattered even though no gate could see it:** `.csv` has no
engine in `lint_design_slop`'s `enginesForExt`, so the file is not scanned at
all — and the M4 detector matches `transition\s*:\s*all`, which the Tailwind
class form does not contain. The row was invisible to the exact rule it
contradicted, in two independent ways. That is the shape of every remaining
finding below, and it is why this sweep had to be a read rather than a lint.

## 3. Two catalog gaps this roadmap closed by accident

The sweep found two tells with corpus sites and **no catalog id**:

| Gap | Corpus sites | Status after this roadmap |
|---|---|---|
| Pointer-tracked spotlight lighting | `references/design-languages.md:21` ("cursor-tracking spotlight" as a Modern-Dark ingredient) | **CLOSED** — this roadmap added **M7**. The sweep was run against the pre-change tree, so it reported the gap; the entry now exists and a reviewer has an id to cite. |
| Noise / film-grain / paper-texture overlay | `data/styles.csv:14,56,59,61,67,68,70`, `data/design-languages/modern-dark.txt:12`, `monochrome.txt:86-90`, `sketch.txt:12`, `neo-brutalism.txt:57`, `cyberpunk.txt:11` — ten-plus sites | **PARTIALLY CLOSED** — **V9** covers grain *over a gradient*, which is the composition the tell names. Grain over a flat ground (`monochrome.txt:86`, with a stated reason) is outside V9 and stays uncatalogued, correctly. |

V6 covers neither: it is scoped to "repeating diagonal stripes" and its detector
matches only `repeating-linear-gradient`.

## 4. Recorded, not fixed — carried to a named receiver

The remaining findings are **41 prescriptive collisions** across a curated
grounding corpus. They are not fixed here, and "stated as intentional" would be
false for most of them: they are defects, not decisions. So they carry to
`agents/roadmaps/later/road-to-grounding-corpus-catalog-parity.md`, which is the
third disposition — a named receiver with a resume condition — rather than a
shrug in a summary.

Ordered by consequence, with the cluster each represents:

| # | Cluster | Sites | Catalog id | Why it is not a one-line fix |
|---|---|---|---|---|
| 1 | `data/motion.csv` has **zero** `prefers-reduced-motion` coverage across 16 animation recipes (`grep -c` = 0) | whole file | **M5** ("Never acceptable") + CI-enforced floor **Q4** | Compounded by `gsap` being absent from the `ground` plan, so the mitigations that DO exist in sibling files are never co-retrieved with a motion recipe. Fixing it means either 16 row edits or a plan change, and the plan change has its own blast radius. |
| 2 | Glassmorphism as the **primary** default for 15 generic product types, plus 15 `Style_Priority` rows and 4 literal `Backdrop blur (10-20px)` recipes | `data/products.csv` (15 rows), `data/ui-reasoning.csv:2,92,97,100,155` | **V2** | Routed into the winning style pick by the decision engine's priority bias, and self-contradicted by the corpus's own `references/design-rules-checklist.md:107` ("use blur to indicate background dismissal, not as decoration"). The fix is a policy decision about what `Primary Style Recommendation` may contain, not an edit. |
| 3 | Violet-on-dark palettes keyed on bare product types; two rows state the C1 triad **verbatim in their own `Notes`** | `data/colors.csv:127,129` (exact), `:13,15,20,130,143` (violet-on-dark), 17 further rows (violet on light) — 24 of 161 colour rows | **C1** | C1 is `judgment-only` because "which colours are primary is a judgment" — and these rows *declare* them primary in a column named `Primary`, removing the judgment the status note relies on. |
| 4 | Four `letter-spacing: -0.05em` / `tracking-tighter` defaults on display text | `data/styles.csv:48,70`, `data/design-languages/monochrome.txt:65`, `bauhaus.txt:39` | **T6** (`backed`) + floor **Q7** (≥ −0.04em) | Two are in retrieval-served columns. The value is below a CI-enforced floor, so these are not stylistic preferences. |
| 5 | T7/T8 blind spot: at least 8 `styles.csv` rows and 6 `design-languages` specs pin a T7 family as a token with no flag and no stated reason | `data/styles.csv:70,71,74,77,78,82`, `design-languages/modern-dark.txt:51`, `neo-brutalism.txt:24`, `neumorphism.txt:26`, `saas.txt:32,68`, `kinetic.txt:47` | **T7**, **T8** | The `AI-Default Flag` mitigation exists and works — but only in `font-pairings-reference.csv`, which has the column. `styles.csv` has no such column, so the same Nunito + DM Sans pairing is flagged in one file and unflagged in the other. |
| 6 | Radius tokens above the 16px cap on sub-200px surfaces | `data/styles.csv:10,40,41,54,55,81,82,85` | **V4** + floor **Q9** | Excludes the `--radius-pill: 999` rows, which V4's own override sanctions. |
| 7 | Two elastic/overshoot easing curves as the default for a hover micro-interaction and a card-grid entrance | `data/motion.csv:4,9` | **M1** (`backed`) | One row carries a partial self-authored mitigation ("don't use `back.out` on dense data tables") that stops short of M1's principle. |
| 8 | Side-stripe status indicators offered as the mechanism | `data/styles.csv:31,44` | **V1** (`backed`, and widened by this roadmap) | Both are product-shape rows (dashboard, AI-native UI), so the stripe arrives as a default for exactly the surfaces V1 names. |
| 9 | `background-clip: text` + `linear-gradient` shipped as a **token** (`--gradient-text`) | `data/styles.csv:49`, `design-languages/cyberpunk.txt:150` | **C2** (`backed`) | Both halves of the deterministic rule co-occur in served columns. |
| 10 | An italic serif pinned as `--font-display` alongside a 48–72px hero range | `data/styles.csv:78` | **T2** | T2 is `judgment-only` because it "requires knowing which element is the hero"; the row names the hero size in the same cell, removing that ambiguity. |
| 11 | "Add 2–3 absolute animated 'blob' views" with counts and blur radii; a `--hud-color` glow token | `data/styles.csv:37,52,71,82` | **CP6**, **C3** | CP6 governs render subject, and two of these are UI-style specs rather than image briefs — a register mismatch that has to be decided, not assumed. |

**14 further rows were checked and are NOT defects**, recorded so a later sweep
does not re-flag them: the Glassmorphism style row *defining* glassmorphism, film
grain in a row whose `Era/Origin` is "1970s-90s Analog Revival" and whose
`Do Not Use For` fences off modern SaaS, uppercase headlines under T9's own
brutalist override, spring-squish motion under M1's playful-affordance override,
Roboto in the Material-Design spec (where Material *is* the documented reason),
and two layout rows that name a metrics or feature section without the count,
size or gradient their catalog entries require.

**Nine catalog ids have no corpus recommendation at all** and are clean by
measurement rather than by assumption: T4, T5, CP2, CP5, L4, plus V3, V5, V7,
L5–L7, M2, M3, C4, CP1, CP3, CP4, V8, C6, C7, L9, L10, T1, T3. Two corpus rows
actively **agree** with the catalog — `data/ux-guidelines.csv:16` and
`data/stacks/html-tailwind.csv:6` both put `z-[9999]` in `Code Example Bad`,
which is L8's position.

## 5. What the sweep says about the method

Every one of the 41 findings sits in a file the detector cannot read. The
grounding corpus is `.csv`, `.txt` and `.json`; `lint_design_slop` classifies an
engine for `.css`, `.html`-family, `.jsx`/`.tsx` and `.md` only. So the corpus
that motivates the catalog is structurally outside the catalog's enforcement,
and no amount of detector work reaches it. That is the finding behind the
findings, and it is why the receiver's first step is a scope decision rather
than an edit.
