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
runtime token cost): a pattern-detectable subset of these entries now has a
deterministic rule that `design-review` cites instead of re-deriving — `V1`,
`V3`, `V6`, `C2`, `C5`, `T4`, `T6`, `T7`, `L4`, `L8`, `M2`, `M4`, `CP1`, `CP2`
(rule ids `slop-<id>-*`, registry in `src/scripts/design_slop_rules.ts`). These
are **flags / rebuttable presumptions**, never hard blocks — a consumer
`DESIGN.md` that declares the pattern as intentional suppresses the flag. The
entries needing structural or aesthetic judgment (e.g. `T3` icon-tile stack,
`L2` three-identical-card grid, `V2` glassmorphism intent) stay
agent-judgment-only and are deliberately **not** in the detector.

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
| T7 | Overused fonts without a brand reason: Inter, Roboto, DM Sans, Geist, Space Grotesk, Instrument Serif | These are the default AI-coding-tool font picks; every generated UI uses one of them | Brand has explicitly adopted one of these AND there is a documented reason (e.g., Inter for its variable metrics in a data-dense dashboard) |
| T8 | Single typeface for everything | Missed typographic contrast opportunity; all-Inter reads as "I did not think about fonts" | Intentional mono-typeface aesthetic (e.g., terminal-inspired); must be stated in the brief |
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
