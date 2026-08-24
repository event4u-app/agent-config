# Design Anti-Patterns — AI-Slop Catalog

> Lazy-loaded reference guideline. Pull this before proposing, generating, or
> reviewing any UI. Used by `design-intelligence`, `fe-design`, `design-review`,
> `existing-ui-audit`.

This catalog enumerates patterns that make AI-generated UI **recognizably
AI-generated**. Every entry carries a concrete override condition — the goal is
not prohibition but deliberateness. A pattern on this list used *knowingly* for
a specific brief is a design decision; used *reflexively* from a default, it is
slop.

**How to use:** Before generating UI, scan the applicable category. Flag any
pattern you were about to reach for. Either (a) choose a different approach, or
(b) invoke the override condition and state the reason explicitly in the brief.

**Agent self-check principle:** These are guidance rules, not linter rules. The
agent reads the brief, checks its first impulse against this catalog, and adjusts
or overrides. The enforceable subset (contrast ratio, font-size, heading
hierarchy, reduced-motion, focus indicator) is in `lint_design_quality`
(Phase 5).

**Who owns what (boundary — avoid drift):**

| Layer | Owns | Artifact |
|---|---|---|
| **Guidance** | Subjective taste — Visual / Typography / Color / Layout / Copy patterns, override judgment, the originality self-test | this catalog |
| **Enforcement** | Objective floors — Q1–Q6 (WCAG contrast, font-size, line-length, reduced-motion, heading hierarchy, focus indicator) as exit-code-2 CI | `lint_design_quality` |
| **Detection** | Deterministic *aesthetic-tell* flags (P0–P3, rebuttable via DESIGN.md) — the pattern-detectable subset of the entries below | `lint_design_slop` |
| **Audit method** | HOW to test WCAG (keyboard nav, ARIA, screen-reader procedures) | `accessibility-auditor` |
| **Stack manifestation** | Concrete Tailwind class / hex bans, shadcn defaults | `tailwind-engineer`, `react-shadcn-ui` (per `framework-neutrality-in-generic-skills`) |
| **Register** | Brand mode vs product mode — which patterns apply | `docs/guidelines/design-modes.md` |

This catalog is the canonical *index*; it states the pattern stack-agnostically.
The stack-specific bans live in the apply skills and link back here by entry ID.
The objective floors are cited from the linter, never re-eyeballed by an agent.

**Deterministic detector backing** (`lint_design_slop`, dependency-free, zero
runtime token cost): a pattern-detectable subset of these entries has a
deterministic rule that `design-review` cites instead of re-deriving (rule ids
`slop-<id>-*`, registry in `src/scripts/design_slop_rules.ts`). These are
**flags / rebuttable presumptions**, never hard blocks — a consumer `DESIGN.md`
that declares the pattern as intentional suppresses the flag.

Which entries those are is **not** enumerated here. The enumeration lives in
[§ Detector status](#detector-status) below, where every entry carries exactly
one status and `lint_design_antipattern_parity` checks the `backed` rows against
the registry on every run. A second hand-maintained list in this paragraph is
precisely the drift the gate exists to prevent, so there is only one.

## Current-generation tells (generation-dated — review 2026-Q4)

Default-template signatures rotate as model defaults rotate; naming the
*current* one is more actionable than a timeless list. The entries below stay
in their own categories — this section only tracks which combination reads as
*this year's* generated default, so the first-impulse check has one dated
pointer instead of a scattered mental list. As of **2026-07**:

- **This generation — "warm editorial":** cream/sand background + serif display
  + brass/clay/terracotta accent (catalog **C5** + **T2** + **T7** Instrument
  Serif). This is now the reflexive "sophisticated / premium" reach — exactly
  the role the purple/cyan gradient played for the previous generation.
- **Previous generation — "gradient dark":** purple/violet + cyan-on-dark with
  gradient text (**C1** + **C2**). Still a tell, now dated rather than current.

**Review trigger:** re-confirm this section whenever a new frontier-model
generation ships a visibly different default aesthetic. It is a *when-does-it-
rotate* note, not a new pattern — never add a tell here that lacks a catalog
entry in the sections below.

### Consistency Locks & layout caps (taste-dials roadmap)

Within-project invariants + repetition caps. Override = declare the value in
`DESIGN.md` (`## Consistency Locks` / a brutalist or uniform-grid style note).

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| V8 | Shape Lock — ≥ 4 distinct corner-radius scales in one surface | A fragmented radius system reads as no shape decision | Declare the radius scale in `DESIGN.md`; a genuine multi-tier scale documents each tier |
| C6 | Colour Lock — ≥ 3 distinct saturated accent hue families | No single accent identity; reads as default-palette sprawl | Brand genuinely uses a multi-accent system, declared in `DESIGN.md` / `brand-to-tokens` |
| C7 | Theme inversion — a light island mid-dark surface (or vice versa) not driven by the theme system | Mid-surface inversion breaks the theme rhythm | Intentional inverted callout with a documented reason — **judgment-only**, design-review calls it (deterministic detection is unreliable) |
| L9 | Section monotony — ≥ 8 sections, < 4 distinct layout families | Uniform section rhythm collapses scannability | Deliberately uniform grid (e.g. a gallery), declared as such |
| L10 | Zigzag — > 2 consecutive image-left/text-right two-column sections | The alternating-zigzag landing-page tell | A genuinely sequenced walkthrough where alternation aids comprehension |

---

## Visual

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| V1 | Side-stripe `border-left` or `border-right` > 1px as a colored accent | The single most recognizable AI-UI signature; every scaffold-default card uses it | Brand token explicitly defines a stripe; document the decision in the design brief |
| V2 | Glassmorphism as decoration (`backdrop-blur` + `bg-white/10`) with no functional depth hierarchy | Model defaults to it for "premium feel"; result looks like 2021 Material You clip-art | Element genuinely sits above a complex, blurred background layer; use sparingly and only for top-level floating surfaces |
| V3 | Ghost card: `border: 1px solid` + box-shadow ≥ 16px spread together | The combination creates visual noise — the ghost card signals no confident decision about depth | Choose either border OR shadow to indicate depth; never both on the same surface |
| V4 | Over-rounded small cards or badges: `border-radius` > 16px on elements < 200px wide | Excessive rounding on small surfaces looks toy-ish; standard cap is 12–16px | Pill shape (`border-radius: 9999px`) is intentional on single-line tags/chips only |
| V5 | Hand-drawn or illustrated SVG icons mixed with crisp icon-system icons | Visual register collision; instantly reads as "generated asset" | Intentional illustrative section (hero illustration, empty-state art); isolate from the icon system |
| V6 | Repeating diagonal stripes as a background texture | A cliché background default; reads as generated CSS art | Brand explicitly uses pattern backgrounds (e.g., a textile brand); document the stripe definition |
| V7 | Nested cards: a card inside a card inside a card | Depth hierarchy collapses; user cannot parse elevation intent | A truly three-level hierarchy (e.g., project → board → card); ensure each level has distinct visual weight |

---

## Typography

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| T1 | Flat type hierarchy: body and headings use the same optical weight and nearly the same size | Type hierarchy is invisible; user cannot scan the page | Deliberately minimal aesthetic where all text is body-weight; must be an explicit brand decision |
| T2 | Oversized italic serif as the primary hero headline | The "AI startup landing page" template; seen on ~60% of AI-generated marketing pages | Brand adopts editorial-magazine aesthetic with a documented italic serif rationale |
| T3 | Icon tile (small rounded-square container) above heading | The universal AI feature-card template; reads as scaffold | Listed features genuinely benefit from visual-icon-then-title affordance AND the icons are custom, not library defaults |
| T4 | Eyebrow / ALL-CAPS label above every section heading | Overuse collapses the emphasis; maximum is 1 eyebrow per 3 sections (countable: grep tracking classes) | Used for genuine section-type differentiation with meaningful vocabulary (not just "FEATURES", "PRICING") |
| T5 | Repeated section kickers ("Our mission", "What we offer", "Why choose us") | Filler vocabulary; every AI-generated page has the same three section titles | Every kicker is substantive and uses brand-specific vocabulary, not generic marketing speak |
| T6 | Crushed letter-spacing on display text (`letter-spacing` < −0.04em) | Below −0.04em glyphs collide optically; reads as "designer-ish effect" with no grounding | Intentional tight display treatment with a documented minimum floor; verify at the actual render size |
| T7 | Overused fonts without a stated reason: Inter, Roboto, DM Sans, Geist, Space Grotesk, Instrument Serif | These are the default AI-coding-tool font picks; every generated UI uses one of them | **Register-scoped.** In the **brand** register: the brand has explicitly adopted one of these AND there is a documented reason. In the **product** register: a single reliable family is the sanctioned strategy ([`design-modes`](design-modes.md) § The two registers), so one of these is legitimate on a **stated** product-register choice — the register itself is the reason, and it must be stated (DESIGN.md, the surface brief, or `design-slop-disable`). Neither register admits an *undeclared* pick. |
| T8 | Single typeface for everything | Missed typographic contrast opportunity; in the **brand** register an unexamined single family reads as "I did not think about fonts" | **Register-scoped like T7.** Intentional mono-typeface aesthetic (e.g., terminal-inspired), stated in the brief — *or* the **product** register, where one reliable family is the sanctioned strategy ([`design-modes`](design-modes.md) § The two registers) and contrast is carried by weight and scale rather than by a second family. |
| T9 | All-caps body paragraphs or field labels | Reduces legibility below WCAG AA for sustained reading; reads as flair over function | Short UI labels (e.g., button text in a brutalist layout); never for body paragraphs |
| T10 | Wide letter-spacing on body text (`letter-spacing` > 0.05em) | Reduces readability for sustained reading; reserved for display use | Display text (headlines, pull quotes) where intentional tracking is a brand element |

---

## Color

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| C1 | Purple/violet + cyan-on-dark palette as the primary scheme | The most recognizable AI-UI color combination in 2024–2026; instantly signals "generated" | Brand color system genuinely defines a violet primary; must come from `brand-to-tokens`, not from model defaults |
| C2 | Gradient text via `background-clip: text` as a primary accent | Overused to the point of invisibility; also has rendering edge cases on some platforms | Headline treatment in a brand that explicitly uses gradient identity (e.g., a product whose logo is a gradient) |
| C3 | Glowing colored accents on dark mode (bright neon `box-shadow` or `text-shadow`) | Looks like a 2020 gaming UI; reads as an AI attempt at "moody" | Brand explicitly defines neon accents with a documented usage rule (e.g., error or alert states in a security product) |
| C4 | Gray text on colored background without WCAG AA check | Muted gray chosen for "elegance" often fails 4.5:1 contrast; the failure is invisible until audited | Any use — always verify the contrast ratio; if it fails, either darken the text or lighten/darken the background |
| C5 | Cream/sand body background (OKLCH L 0.84–0.97, C < 0.06) with brass/clay/oxblood accents | The 2025 "premium-consumer" AI palette; every generated "sophisticated" product uses this exact combination | Brand has an explicit warm-neutral design language documented in `brand-to-tokens`; the palette is first-party, not a default reach |

---

## Layout

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| L1 | Hero metric template: giant number, small label, 3–4 stats in a row, gradient | The default SaaS dashboard hero; appears on ~70% of AI-generated dashboard screens | Data storytelling genuinely requires a primary metric with supporting context; must vary the arrangement |
| L2 | Three identical feature cards in a grid with the same visual weight | The scaffold-default; no visual rhythm, no hierarchy among features | Product genuinely has three equally weighted features; must still vary padding, or use a different composition |
| L3 | Monotonous spacing: one spacing value (usually 24px) used for everything | Spacing is rhythm; uniform spacing collapses the hierarchy of proximity | Intentional grid where every element has equal weight; must document the grid definition |
| L4 | Numbered section markers (01 / 02 / 03) as a primary section-order device | Universal AI-generated marketing page tell; seen on virtually every generated landing page | A genuinely numbered process or sequenced guide where the step number carries meaning beyond decoration |
| L5 | Line length > 80ch in body copy without column constraint | Reduces readability; WCAG recommends 45–75 characters; beyond 80 the eye struggles to track | Data-dense dashboards where column width is driven by tabular data, not narrative text |
| L6 | `position: absolute` dropdown inside `overflow: hidden` container | Dropdown clips; a common AI-generated layout bug | Refactor: use `<dialog>`, the Popover API, or `position: fixed` / portal to escape the stacking context |
| L7 | Content that overflows its container | Text truncation or reflow failures at non-default viewport widths; reads as untested | Never acceptable in production output; test at 320px, 768px, 1280px minimally |
| L8 | Z-index values of 99, 999, 9999 without a semantic z-index scale | Magic numbers; the first time two elements compete, the scale breaks | Establish a named semantic z-index scale (`--z-modal: 400`, `--z-toast: 500`, etc.) and use it |

---

## Motion

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| M1 | Bounce or elastic easing curves on UI elements | Bounce draws attention to the animation itself; UI motion should serve the action, not perform | Intentional playful affordance (game UI, onboarding celebration state); must be brief and non-repeating |
| M2 | Animating layout properties (width, height, top, left, padding) | Triggers browser layout recalculation; janky on mid-range devices; always solvable with `transform` | Never — use `transform: scaleX()` for width-like effects, `transform: translateY()` for position |
| M3 | Animating `<img>` element on hover (scale, filter, transform) | Triggers composite + image decode; often causes content shift | Animate the card's background, border, or shadow instead; leave the image static |
| M4 | `transition: all` shorthand | Animates every property including layout, color, opacity simultaneously; unpredictable and expensive | Enumerate only the properties that should animate: `transition: transform 200ms ease-out, opacity 200ms` |
| M5 | Missing `@media (prefers-reduced-motion: reduce)` alternative for any animation | Accessibility violation; vestibular disorders make animated UI unusable | Never acceptable; always add a `prefers-reduced-motion` variant — gentler animation (reduced distance/opacity) is preferred over `display: none` |

---

## Copy

| # | Pattern | Why it reads as AI-generated | Override condition |
|---|---|---|---|
| CP1 | Em-dash (`—`) overuse | The #1 syntactic LLM signature; appears in AI copy at 3–5× the frequency of human editorial copy; maximum 2 per 500 words | Specific editorial voice that uses em-dashes deliberately; count them before shipping |
| CP2 | Marketing buzzwords: streamline, empower, supercharge, world-class, enterprise-grade, seamlessly, robust, leverage | These words carry no information; an AI-slop test: replace each with nothing — the sentence still communicates the same thing | No override; if a word can be deleted without loss, delete it |
| CP3 | Aphoristic manufactured contrast ("We don't do X. We do Y." / "Not just A, but B.") | A generated sentence rhythm that sounds like brand writing but carries no specificity | Aphoristic copy is legitimate when the contrast reveals a genuine product distinction; test by asking whether the Y side says something concrete |
| CP4 | "Theater" framing — copy that announces what the product does without saying how or why | "The platform for modern teams." communicates nothing; it is content-shaped noise | Every tagline must pass the "so what" test: can a skeptic follow it with "but how?" and get a concrete answer? |
| CP5 | Emoji-decoration in UI markup — 🚀/✅/🎉 prepending headings, buttons, list items, or CTAs (`🚀 Get Started`) | Performative-enthusiasm coating; the default-startup-template tell. No emoji is better than decorative emoji | Brand/`DESIGN.md` declares a systematic emoji strategy, or the emoji is functional (status indicator, category marker tied to real meaning) |
| CP6 | Stock render subject named instead of the product's own subject matter — "floating abstract shapes", "gradient mesh", "glowing orb", "particle field", "futuristic HUD" | These name the default thing a render becomes when nobody decided what it is about; same delete-test as CP2, applied to art direction — swap the phrase for what the product actually shows and the brief says more | The subject IS abstract by decision (a generative-art surface, a data-driven field whose data is named), and the brief says which decision and why |

---

## Quality floors — measurable thresholds

These are not stylistic — they are objective quality failures detectable without
aesthetic judgment. The `lint_design_quality` CI linter enforces a subset of
these. The rest are agent self-checks.

| # | Threshold | Measurement | CI-enforced? |
|---|---|---|---|
| Q1 | Text contrast ≥ 4.5:1 normal / ≥ 3:1 large text (WCAG AA) | `contrastRatio(text, bg) < threshold` | Yes (`lint_design_quality`) |
| Q2 | Body `font-size` ≥ 14px (floor); ≥ 16px strongly preferred | Computed `font-size` on `p`, `li`, `td` | Yes |
| Q3 | Line length ≤ 75 characters (prose) | Character count before soft wrap | Yes |
| Q4 | All `@keyframes` / `animation` have a `prefers-reduced-motion` alternative | CSS `@media` check | Yes |
| Q5 | Heading levels not skipped (h1→h3 direct, not h1→h4) | DOM heading sequence | Yes |
| Q6 | All interactive elements have a `:focus-visible` indicator | CSS rule check | Yes |
| Q7 | Display `letter-spacing` floor: ≥ −0.04em (tighter reads cramped) | Computed tracking | Agent self-check |
| Q8 | `line-height` ≥ 1.3 on body text | Computed `line-height` | Agent self-check |
| Q9 | Small-card `border-radius` cap: 12–16px (not 24px+) | Computed `border-radius` on elements < 200px | Agent self-check |
| Q10 | Body background: avoid OKLCH L 0.84–0.97, C < 0.06 (cream/sand) unless brand-defined | Color space calculation | Agent self-check |
| Q11 | Padding floors: ≥ 8px (inline elements), ≥ 16px (card/panel bodies) | Computed padding | Agent self-check |
| Q12 | Justified text only with CSS hyphenation (`hyphens: auto`) | Presence of `text-align: justify` without `hyphens` | Agent self-check |
| Q13 | Outward-artifact hygiene: no system internals — absolute workspace paths, skill/tool names, generator traces, config keys — in comments, metadata, or EXIF of deliverables that leave the workspace (HTML decks, prototypes, exports), unless the user asks for build provenance | Comment/metadata scan of the emitted artifact | Agent self-check |

Q13 is **output hygiene only** — it never restricts chat-side transparency to
the operator (what skills/tools ran stays fully answerable in conversation).
Converged via council (claude-sonnet-4-5 + gpt-4o, 2026-07-06): shared floor
here, referenced by artifact-producing skills, deliberately not a PII-rule
extension. Deterministic detection in `lint_design_slop` (path/trace grep) is
possible but deferred until a real incident.

---

## Detector status

Every catalog entry above carries exactly one status. This table is the single
enumeration of what the deterministic detector covers, and
`src/scripts/lint_design_antipattern_parity.ts` checks it on every CI run: a
`backed` row whose id is not in the registry fails, a registry rule whose
`catalogId` is not `backed` here fails, and an entry missing from this table
fails. `Q*` floors are excluded — they are owned by `lint_design_quality` and
are listed in § Quality floors.

| Status | Meaning |
|---|---|
| `backed` | a deterministic rule exists in `design_slop_rules.ts` |
| `floor` | measurable and enforced, but as a `Q*` objective floor in `lint_design_quality`, not as an aesthetic tell |
| `judgment-only` | needs structural or aesthetic judgment a text pass cannot make; `design-review` decides it |
| `deferred` | pattern-detectable but a design-system opinion rather than a floor; deliberately not shipped |
| `candidate` | a numeric threshold stated in the entry, not yet detected — a status that must resolve to `backed` or `judgment-only`, never persist |

| Entry | Status | Note |
|---|---|---|
| V1 | backed | |
| V2 | judgment-only | decoration-vs-intent is the tell; a text pass cannot read intent |
| V3 | backed | |
| V4 | backed | |
| V5 | judgment-only | icon register collision is a visual-style comparison |
| V6 | backed | |
| V7 | judgment-only | DOM-structure nesting depth, measured too false-positive-prone |
| V8 | backed | |
| C1 | judgment-only | the tell is the combination *as the primary scheme*; which colours are primary is a judgment |
| C2 | backed | |
| C3 | backed | |
| C4 | floor | WCAG contrast, Q1 |
| C5 | backed | |
| C6 | judgment-only | demoted 2026-08-13 at M1 = 4 of 32 clean files; the rule counted every saturated hue, so one accent plus a semantic danger colour reached its threshold — which is correct design, not the tell this entry describes |
| C7 | judgment-only | theme inversion may be deliberate emphasis |
| T1 | judgment-only | requires comparing optical weight across the document |
| T2 | judgment-only | requires knowing which element is the hero |
| T3 | judgment-only | icon-tile stack; DOM-structure analysis, too false-positive-prone |
| T4 | backed | |
| T5 | judgment-only | copy phrase-list; that mechanism is council-rejected |
| T6 | backed | |
| T7 | backed | |
| T8 | deferred | typeface count is a design-system opinion, not a floor |
| T9 | backed | |
| T10 | backed | |
| L1 | judgment-only | composite structural template |
| L2 | judgment-only | three-identical-card grid; DOM-structure analysis |
| L3 | deferred | spacing-multiple uniformity is a design-system opinion |
| L4 | backed | |
| L5 | floor | line length, Q3 |
| L6 | judgment-only | requires an ancestor relation a flat text pass cannot establish |
| L7 | judgment-only | requires a render |
| L8 | backed | |
| L9 | backed | |
| L10 | backed | |
| M1 | backed | |
| M2 | backed | |
| M3 | backed | |
| M4 | backed | |
| M5 | floor | reduced-motion alternative, Q4 |
| CP1 | backed | |
| CP2 | backed | |
| CP3 | judgment-only | copy phrase-list; that mechanism is council-rejected |
| CP4 | judgment-only | copy phrase-list; that mechanism is council-rejected |
| CP5 | backed | |
| CP6 | backed | copy-engine phrase list, same mechanism as CP2; a CSS engine cannot see subject matter |

---

## The AI-slop originality self-test

Before finalizing any UI design, run this two-tier check:

1. **Category test:** Could someone guess the aesthetic from the product
   category alone? (e.g., "SaaS → dark mode + purple gradient" /
   "fintech → navy + gold" / "health → teal + rounded sans"). If yes,
   rework the concept.

2. **Anti-reference test:** Could someone still guess it after knowing the
   category AND having seen 3 references you explicitly avoided? If yes,
   dig deeper. A direction that is merely "not the worst cliché" is still
   a cliché.

The bar: a visitor should ask "how was this made?", not "which AI made this?"

---

## See also

- `design-intelligence` — corpus-grounded style/color/typography selection
- `fe-design` — stack-agnostic heuristics (form, table, responsive, a11y)
- `design-review` — structured UI/UX review methodology
- `existing-ui-audit` — mandatory pre-step: inventory before designing
- `motion-choreographer` — animation heuristics (should-it, which-easing, how-much)
- `typography-system` — modular-scale construction and pairing
- `accessibility-auditor` — WCAG audit method
- `brand-to-tokens` — first-party brand token extraction (the legitimate override source for most anti-patterns above)
