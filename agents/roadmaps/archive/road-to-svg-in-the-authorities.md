---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-svg-with-a-witness
    relation: disjoint
    note: "Same source set. That roadmap builds the fixture, the static and engine witnesses and the owner skill; this one writes the SVG mechanism into the three authorities the owner points at, and depends on nothing there."
  - slug: road-to-one-motion-authority
    relation: extends
    note: "Archived. § Motion stays the sole carrier with its drift gate; Phase 1 adds mechanism lines inside it and records any drift verdicts, and changes no band, curve or duration."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: none of the twenty top-level roadmaps owns the motion authority, the ARIA corpus or the render-security skill. It is split from its sibling on purpose — these three prose edits need no fixture and no new code, so binding them to that roadmap's Phase 0 would hold three reproduced defects behind a test harness they do not use."
---
# Road to SVG in the authorities

> **Source:** `agents/tmp.old/inbox-2026-10-l/` — a maintainer transcript asking
> for an in-depth look at four external SVG-skill sources and a challenged
> roadmap, plus the two three-loop plans it produced on two hosts. Re-verified
> at `main@9a4dbb753`; engine readings re-run offline on Chromium 151 through
> the repo's own Playwright devDependency (`file://` only).
>
> **Second source:** an external review of PR #2297 (it asked for the
> verify-parser defect below as a separate small fix, pulled forward), a second
> review of the same PR (line references and two verify clauses, each
> re-checked against the tree), and a maintainer session converting a raster
> logo to SVG (2026-10-11), whose delivered file carries no accessible name and
> generic ids — the two things Phase 2 writes into the ARIA corpus.

## Goal

A verify clause whose regex expectation contains a space stops silently
losing its expectation. Then the three authorities an agent consults while
writing SVG say what SVG needs.
The motion authority names the SVG mechanisms and the two that silently fail;
the ARIA corpus answers "meaningful standalone graphic" with the right pattern
instead of the icon-button one; the render-security skill names the SVG sinks
and the delivery mode that neutralises them. No value, band or curve moves.

## Context — reproduced at `main@9a4dbb753`

- **A space in a backticked verify expectation erases it.**
  `src/scripts/_lib/verify_clause.ts:147` caps the backticked form's tail at
  one non-space token, so a backticked clause ending in the expectation
  `-> /Icon-only button/` parses as a clause with no expectation, and the step reads as unfalsifiable without any
  report. The annotation form keeps the same regex. The cap is documented
  (`:129-145`) and pinned as a limit by
  `tests/scripts/_lib/verify_clause.test.ts:309-312`, which expects `null`;
  this roadmap's own 2.1 and 2.2 work around it with `\s`.

- **The motion authority is SVG-blind, and one line misleads on SVG.**
  `src/skills/fe-design/references/design-patterns.md:212-245` (§ Motion step
  6, "Which mechanism carries it?") names CSS transitions, `@starting-style`,
  WAAPI and view transitions — no SVG mechanism; `transform-box` and
  `pathLength` have 0 hits under `src/` and `docs/`. Its `transform-origin`
  line (`:235-238`) is correct for HTML boxes and wrong for an SVG child,
  whose reference box defaults to the viewBox: a 40×40 rect at (20,20) scaled
  0.5 with `transform-origin: center` lands at (60,60); with
  `transform-box: fill-box` its twin lands where intended. Three more readings,
  all reproduced: `keySplines="0.34 1.56 0.64 1"` leaves the element at its
  start value after 1.5 s while the in-range twin finishes; under emulated
  `reduce`, a page-level `svg * { animation: none !important }` leaves an SMIL
  `<animate>` moving (20.2 → 76.8 in 700 ms), so `:182`'s requirement is
  unmeetable that way for SMIL; a dash of 300 on a 214.65-unit path draws
  nothing for the first ~28 % of its duration.
- **The ARIA corpus answers the wrong pattern.**
  `src/skills/accessibility-auditor/data/aria-patterns.csv` holds 12 patterns;
  the only SVG row (`:13`) is the icon inside a button. `ground search` for
  "meaningful standalone svg chart graphic accessible name" returns that row
  — `aria-hidden=true` — at confidence 0.748. Two inline graphics both using
  `<title id="title">` with `aria-labelledby="title"` are announced as the
  first one's name twice.
- **The render-security skill has no SVG row.**
  `src/skills/frontend-render-security/SKILL.md:43` covers `innerHTML` /
  `v-html` generally; the skill has 0 hits for `svg`. SVG-specific vectors —
  event attributes, `<script>`, `foreignObject`, a `javascript:` href, external
  references — and the `img` delivery that does not run scripts are absent.
  `src/skills/threat-modeling/data/threats.csv:9` covers only the upload path.

## Phase 0 — A space no longer erases a verify expectation

- [x] **0.1 Flip the pinned limit, red first.** Rename the case at
      `verify_clause.test.ts:309` to
      `backticked-form-keeps-a-space-bearing-regex` and assert
      `{ kind: 'regex', source: 'a b' }` for a backticked clause ending in
      `-> /a b/`, plus `Icon-only button` for the shape that surfaced it. Run it against today's parser and record the failure
      before 0.2 touches the parser.
      verify: `npx vitest run tests/scripts/_lib/verify_clause.test.ts --reporter=verbose` -> /✓.*backticked-form-keeps-a-space-bearing-regex/
- [x] **0.2 Close the gap in the one parser.** The backticked tail accepts a
      slash-delimited regex up to the first UNESCAPED closing `/` — one not
      preceded by an odd number of backslashes — that is followed by
      whitespace or the end of the text, so `-> /a b/` keeps its source and a
      step that continues after `-> /[1-9]/` still keeps `[1-9]` (the case at
      `:70`). Bare words stay refused. The module comment at `:129-145` and
      the "both forms agree" case at `:314` are updated in the same change, so
      the two forms agree on every expectation, not only the space-free ones.
      Nothing else parses the arrow (`:193` pins that).
      verify: `npx vitest run tests/scripts/_lib/verify_clause.test.ts tests/scripts/check_verify_expectation_delta.test.ts` -> 0

## Phase 1 — The motion authority learns SVG

- [x] **1.1 SVG lines inside § Motion step 6.** In
      `design-patterns.md:212-245`, the sole carrier. Mechanism, not values:
      `transform-box: fill-box` with any CSS transform or `transform-origin` on
      an SVG child, and the `transform-origin` line at `:235-238` gains that
      caveat; `pathLength="1"` for a draw-on, so the dash never depends on a
      guessed length; `keySplines` values stay within [0,1] — an overshoot is
      not expressible there, and the bounce prohibition at `:177` already
      rules it out; a path morph needs equal command count, type and order.
      Delivery mode picks the mechanism: internal CSS keyframes inside
      `@media (prefers-reduced-motion: no-preference)` for a self-contained
      asset; SMIL only for what CSS cannot carry, and then its reduced-motion
      route cannot be a CSS rule — a static twin selected by the media query,
      or `pauseAnimations()` under `matchMedia`; an `img` or background
      delivery of an animated SVG needs a host static route
      (`<picture><source media="(prefers-reduced-motion: reduce)">`), which
      was selected correctly under emulation. No statement about animating
      the CSS `d` property — its cross-engine support is unmeasured.
      verify: `npx tsx src/scripts/lint_motion_authority_drift.ts` -> 0
- [x] **1.2 Record the drift verdicts.** Any new line the drift gate reads as
      a motion value gets a `PROSE_ALLOWLIST` verdict
      (`src/scripts/lint_motion_authority_drift.ts:328`) stating it is a
      mechanism, not a value; no band, curve or duration changes.
      verify: `git diff -U0 origin/main...HEAD -- src/skills/fe-design/references/design-patterns.md | grep -cE '^[+].*[0-9]+\s?ms'` -> /^0$/

## Phase 2 — The ARIA corpus answers "graphic"

- [x] **2.1 Two `aria-patterns.csv` rows.** A meaningful standalone graphic:
      `role="img"` on the `<svg>`, a direct `<title>` (and optional `<desc>`)
      referenced by namespaced ids, never `aria-label` plus `<title>`, and host
      alt text when delivered through `<img>`. A decorative graphic:
      `aria-hidden="true"` and an empty host `alt`. Anti-patterns name the
      generic `id="title"` collision. Same seven columns, WCAG 1.1.1 / 4.1.2
      refs, APG or WAI docs URL.
      verify: `./scripts-run src/skills/corpus-grounding/scripts/ground search --manifest src/skills/accessibility-auditor/data/manifest.json "meaningful standalone svg chart graphic accessible name"` -> /Result\s1\n-\s\*\*Component:\*\*\s(?!Icon-only)/
- [x] **2.2 Keep the icon-button query where it is.** The existing row must
      still win its own query, and the manifest records the re-derivation.
      verify: `./scripts-run src/skills/corpus-grounding/scripts/ground search --manifest src/skills/accessibility-auditor/data/manifest.json "icon only close button"` -> /Icon-only\sbutton/
      and `./scripts-run src/scripts/check_corpus_staleness` -> 0

## Phase 3 — The render-security skill names the SVG sinks

- [x] **3.1 One patterns-table row.** In
      `frontend-render-security/SKILL.md` § The patterns AI ships by default:
      untrusted SVG markup into `innerHTML` / `v-html` /
      `dangerouslySetInnerHTML` or inlined server-side — event attributes,
      `<script>`, `foreignObject`, a `javascript:` href, external references,
      a DOCTYPE with entities (CWE-79, CWE-611). Do instead: sanitise with an
      SVG profile chosen for the delivery context — three contexts, three
      risks: inline DOM runs scripts and event handlers in the host origin; a
      standalone document opened directly runs them in its own; `<img>` and
      CSS backgrounds run no script and load no external reference — or
      deliver through `<img>`, with CSP as the second line.
      Point at `threats.csv:9` as the authority for uploads instead of
      restating it.
      verify: `grep -ci 'foreignObject' src/skills/frontend-render-security/SKILL.md` -> /^[1-9]/
- [x] **3.2 One backstop grep.** Extend § Backstop greps with a pattern that
      locates SVG active content in source (`foreignObject`, an `on*`
      attribute inside `<svg`, a `javascript:` href).
      The fixture lives in the tree: three planted SVGs (an `onload`
      attribute, a `foreignObject`, a `javascript:` href) and one clean twin
      under `tests/fixtures/svg-active-content/` <!-- ref-ignore -->; the test
      runs the documented grep over it.
      verify: `npx vitest run tests/skills/frontend_render_security_svg_grep.test.ts --reporter=verbose` -> /✓.*grep-hits-three-planted-and-not-the-twin/ <!-- ref-ignore -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | evidence | SVG motion lines go into § Motion, never into a new owner or skill | archived `road-to-one-motion-authority`: § Motion is the sole carrier with a drift gate | the drift gate is retired |
| A2 | reversible-technical | evidence | No "prefer SMIL for a self-contained SVG" default; internal CSS under `no-preference` is the default and SMIL is the exception | the CSS kill switch does not stop SMIL; an `img`-delivered SVG kept animating under emulated `reduce` | a reduced-motion route for SMIL is shown to work without a host route |
| A3 | reversible-technical | evidence | No CSS `d`-morph line | its cross-engine support was measured in one engine only | a second engine is measured |
| A4 | reversible-technical | evidence | The verify-parser fix is Phase 0 here, not its own roadmap | it is one parser and one test file; the external review asked for it pulled forward as a small separate fix, and this roadmap's own verify clauses are where the workaround shows | the fix needs more than `verify_clause.ts` and its two test files |
| A5 | reversible-technical | evidence | The security row names three delivery contexts, not one sanitiser rule | the external review's per-embedding-mode profiles; the witness roadmap's 1.5 grades by the same three modes | a fourth delivery context (email, PDF) is in scope |

## Non-goals

No new skill, rule, command or hook concern. No second verify grammar —
Phase 0 widens the one parser. No easing table, duration or
curve. No recipe or text copied from any external skill. No sanitiser library
named as the required one — the row states the property, the consumer picks
the implementation.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Widening the tail swallows prose | implementation | A step whose prose after the clause contains a `/` followed by a space is read as part of the regex | 0.2 ends the regex at the first UNESCAPED `/` followed by whitespace or end, and the `:70` continuation case stays green | Phase 0 — A space no longer erases a verify expectation |
| 2 | A mechanism line reads as a value | implementation | The drift gate parses a new SVG line as a motion value and reds, or a value slips in beside the mechanism | 1.2 records a verdict per line and greps the diff for durations | Phase 1 — The motion authority learns SVG |
| 3 | Retrieval dilution in the ARIA corpus | implementation | The new graphic row steals the icon-button query, or the reverse | 2.1 and 2.2 run both queries before and after | Phase 2 — The ARIA corpus answers "graphic" |
| 4 | The security row is read as "sanitise everything" | product | A consumer inlining its own trusted icons gets a sanitiser demand it does not need | The row is scoped to untrusted markup and names `<img>` delivery as the neutral route | Phase 3 — The render-security skill names the SVG sinks |

## Acceptance Criteria

- [x] AC-0 — A backticked verify clause keeps a space-bearing regex
      expectation, the step-continuation case keeps its expectation, and the
      test that pinned the old limit was seen red before the parser changed.
- [x] AC-1 — § Motion names `transform-box`, `pathLength`, the `keySplines`
      range and the SMIL reduced-motion route, and `lint_motion_authority_drift`
      is green with no band, curve or duration changed.
- [x] AC-2 — A "meaningful standalone graphic" query grounds to a graphic row,
      not to the icon-button row, and the icon-button query still grounds to
      its own row.
- [x] AC-3 — `frontend-render-security` names the SVG active-content sinks
      for inline, standalone-document and `<img>` delivery, and its backstop
      grep finds all three planted files in the committed fixture and not
      the twin.
