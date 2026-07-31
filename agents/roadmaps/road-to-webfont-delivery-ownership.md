---
complexity: contained
status: ready
execution:
  mode: phase-checkpoints
---

# Road to webfont delivery ownership — one skill prescribes the hotlink another skill's data forbids

> Small, self-contained, and separable from the two UI-track roadmaps: this
> touches corpus data and rule ownership, not the state machine. It is broken out
> because it carries a legal exposure the other two do not, and because "which
> artifact owns webfont delivery" is currently answered by nobody.
>
> Source: `agents/tmp.old/frontend-fix.txt` (external analysis, re-verified).
> Council cut: [`frontend-fidelity-cut`](../settings/contexts/frontend-fidelity-cut.md).

## Goal

Give third-party webfont delivery exactly one owner, and stop the typography path
from emitting a hotlink that the package's own guidance calls an anti-pattern and
that is legally exposed for German consumers.

## Context (verified in-tree 2026-07-31, do not relitigate)

- **73 of 73 corpus rows prescribe a Google-Fonts hotlink.**
  `src/skills/design-intelligence/data/font-pairings-reference.csv` — every data
  row carries both a `fonts.google.com` share URL and a
  `@import url('https://fonts.googleapis.com/…')` CSS import. Rows offering a
  self-hosted route: **0**. `grep -rni fontsource` across `src/` and `docs/`:
  **0 hits**.
- **The same skill's sibling corpus says the opposite.**
  `src/skills/design-intelligence/data/stacks/nextjs.csv:23` lists
  `<link href="fonts.googleapis.com"/>` in its **avoid** column, recommending
  `next/font` for "self-hosted fonts with zero layout shift". Two corpora, one
  skill, one data directory, opposite advice, no arbitration.
- **The consuming skill hard-wires the hotlink as a required output.**
  `src/skills/typography-system/SKILL.md:103-105` instructs the agent to emit
  "the `@import url(…)` from the CSV's `CSS Import` column" as a deliverable, and
  `:55-56` verifies font choices against the CSV's Google-Fonts column. There is
  no hosting-mode branch. The skill already documents the fragility this creates
  (`:108-113` — a stale CSV URL 404s at build time and silently falls back to a
  system font).
- **Nobody owns the gap.** Three artifacts each assume another covers it:
  `docs/guidelines/design-fidelity-mechanics.md:34-37` forbids hotlinking but
  scopes itself to *project-owned* assets and design-system-internal URLs;
  `design-system-capture/reference/design-system-json.md:42-44` declares font
  bundling explicitly out of scope ("the package **never downloads or bundles
  fonts**"); `typography-system` actively produces the hotlink. A third-party
  webfont — the single most common asset in a handed-over standalone HTML — has
  no rule forbidding it, no ingestion route, and one skill emitting it.
- **The fixture that looks adjacent does not cover it.**
  `tests/design-artifacts/eval-fixtures.md:127` — `daf-external-asset-url` is
  scoped to "An **image** … at a design-system's internal / CDN location".
- **Legal exposure is real for this package's own consumers.** A German court
  (LG München I) held that embedding Google Fonts by hotlink transmits the
  visitor's IP to a third party without consent. The package's own users build
  German SaaS; a corpus that prescribes the hotlink in 73/73 rows is shipping
  that exposure as a default.
- **The corpus also leads with fonts the package's own catalog flags — partly.**
  `docs/guidelines/design-antipatterns.md:109` (T7) names Inter, Roboto, DM Sans,
  Geist, Space Grotesk, Instrument Serif as overused AI defaults. Corpus row 1
  pairs Playfair Display + **Inter**; row 3 is **Space Grotesk + DM Sans** (both
  T7); row 5 is Inter + Inter (T7 and T8). **Correction to the original report:**
  its headline example, Poppins + Open Sans (row 2), appears in **no**
  anti-pattern entry — that half is refuted. A downstream cross-check does exist
  (`design-intelligence/SKILL.md:330-337`), but it is model-carried prose while
  the corpus ordering is what the model reads first, and no CSV column encodes
  the conflict.

## Design constraints

- **The lock stands.** `design-system-json.md:64-65` — the package ships no
  font-bundler. This roadmap changes what the package *recommends and emits*, not
  what it *downloads*. Emitting a self-hosted route means naming the target
  project's own pipeline, not fetching a font file.
- **Framework-neutral.** The self-hosting route differs per stack
  (`next/font`, `@fontsource/*`, a Vite/asset-pipeline copy, a plain
  `@font-face`). The fix must not mandate one ecosystem's answer as the general
  one.
- **Corpus is reference data, not a ranking.** Reordering rows to hide T7 fonts
  is theatre. If a conflict matters, encode it as data the consumer can filter
  on.

## Phase 0 — Establish the ownership decision (blocking, no data edits)

- [ ] Decide and record which artifact owns third-party webfont delivery. The
      candidates are `typography-system` (it emits the import),
      `design-fidelity-mechanics` (it already forbids hotlinking, but scopes
      itself to owned assets), or a new line in the asset-discipline guideline.
      One owner, named in writing — the current three-way assumption is the
      defect.
- [ ] Fixture `daf-webfont-delivery`: a design specifies a Google-hosted font;
      assert the emitted output does not hotlink and instead names the target
      project's own font route. Run it against the current tree and record the
      baseline (expected: fails — the hotlink is emitted).
- [ ] Confirm the legal framing with the maintainer's own consumer profile in
      view (German SaaS), and record it in the ownership note so the constraint
      is not re-litigated as a style preference.

**Exit:** one named owner; a failing fixture that defines "fixed".

## Phase 1 — Stop emitting the hotlink

- [ ] `typography-system/SKILL.md:103-105`: replace the unconditional
      `@import` deliverable with a hosting-mode branch — self-hosted route by
      default, hotlink only on an explicit consumer opt-in. Keep `:55-56`'s
      availability check (does this font exist?) separate from the delivery
      decision (how does it get to the page?); conflating them is what produced
      the single hard-wired route.
- [ ] Give each supported stack a self-hosting answer, framework-neutrally:
      `next/font` where Next is detected, `@fontsource/*` for bundler stacks, an
      asset-pipeline copy for Laravel/Vite, plain `@font-face` as the floor.
      Cite the per-stack corpus rows that already say this rather than inventing
      a second source of truth.
- [ ] Extend the asset-discipline rule so a **third-party** webfont is covered,
      not only project-owned assets — this is the gap
      `design-fidelity-mechanics.md:34-37` leaves open by scoping to owned assets.
- [ ] `daf-webfont-delivery` flips to green.

**Exit:** no path in the package emits a third-party font hotlink by default.

## Phase 2 — Make the corpus consistent with itself

- [ ] Add a delivery column to `font-pairings-reference.csv` so the self-hosted
      route travels with the row instead of being reconstructed downstream. The
      Google-Fonts URL stays — it is how you find the font — but it stops being
      the only shipped answer for how you deliver it.
- [ ] Resolve the direct contradiction with `stacks/nextjs.csv:23`, which lists
      the hotlink in its avoid column. Two files in one data directory must not
      give opposite instructions on the same decision.
- [ ] Encode the T7 conflict as data: rows whose heading or body font appears in
      `design-antipatterns.md:109` carry a flag, so the cross-check at
      `design-intelligence/SKILL.md:330-337` reads a field instead of relying on
      the model remembering a catalog. Do **not** reorder or delete rows — the
      corpus is reference data, and the fix is making the conflict visible, not
      hiding it.
- [ ] Correct the record while editing: Poppins + Open Sans is **not** a flagged
      pairing; only rows carrying an actual T7 font get the flag.
- [ ] Address the stale-URL fragility the skill already documents
      (`typography-system/SKILL.md:108-113`) — a self-hosted default removes the
      404-at-build-time failure mode for the default path, so state whether the
      remaining opt-in hotlink path keeps the caveat.

**Exit:** the corpus answers "which font" and "how delivered" consistently, and
its own anti-pattern conflicts are machine-readable.

## Non-goals (decided, with reasons)

- **No font-bundler in the package.** Standing lock
  (`design-system-json.md:64-65`). Naming a project's own route is not bundling.
- **No mandated font stack.** The T7 flag makes a conflict visible; it does not
  ban a font. A brand that deliberately chose Inter keeps Inter.
- **No corpus reordering or row deletion.** Reference data stays reference data.
- **Not a general GDPR/asset audit.** Scope is webfont delivery; other
  third-party asset classes are out until one is evidenced.

## Acceptance criteria

- Exactly one artifact is named as the owner of third-party webfont delivery,
  and the other two point at it instead of assuming it.
- No default path in the package emits a Google-Fonts hotlink; the self-hosted
  route is per-stack and framework-neutral.
- `font-pairings-reference.csv` and `stacks/nextjs.csv` no longer contradict each
  other on delivery.
- A corpus row carrying a T7-flagged font is identifiable from the data, not only
  from prose the model must remember.
- `daf-webfont-delivery` is green.
