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

## Goal

The three authorities an agent consults while writing SVG say what SVG needs.
The motion authority names the SVG mechanisms and the two that silently fail;
the ARIA corpus answers "meaningful standalone graphic" with the right pattern
instead of the icon-button one; the render-security skill names the SVG sinks
and the delivery mode that neutralises them. No value, band or curve moves.

## Context — reproduced at `main@9a4dbb753`

- **The motion authority is SVG-blind, and one line misleads on SVG.**
  `src/skills/fe-design/references/design-patterns.md:212-245` (§ Motion step
  6, "Which mechanism carries it?") names CSS transitions, `@starting-style`,
  WAAPI and view transitions — no SVG mechanism; `transform-box` and
  `pathLength` have 0 hits under `src/` and `docs/`. Its `transform-origin`
  line (`:235-239`) is correct for HTML boxes and wrong for an SVG child,
  whose reference box defaults to the viewBox: a 40×40 rect at (20,20) scaled
  0.5 with `transform-origin: center` lands at (60,60); with
  `transform-box: fill-box` its twin lands where intended. Three more readings,
  all reproduced: `keySplines="0.34 1.56 0.64 1"` leaves the element at its
  start value after 1.5 s while the in-range twin finishes; under emulated
  `reduce`, a page-level `svg * { animation: none !important }` leaves an SMIL
  `<animate>` moving (20.2 → 76.8 in 700 ms), so `:181`'s requirement is
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

## Phase 1 — The motion authority learns SVG

- [ ] **1.1 SVG lines inside § Motion step 6.** In
      `design-patterns.md:212-245`, the sole carrier. Mechanism, not values:
      `transform-box: fill-box` with any CSS transform or `transform-origin` on
      an SVG child, and the `transform-origin` line at `:235-239` gains that
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
- [ ] **1.2 Record the drift verdicts.** Any new line the drift gate reads as
      a motion value gets a `PROSE_ALLOWLIST` verdict
      (`src/scripts/lint_motion_authority_drift.ts:328`) stating it is a
      mechanism, not a value; no band, curve or duration changes.
      verify: `git diff -U0 src/skills/fe-design/references/design-patterns.md | grep -cE '[0-9]+ ?ms'` -> /^0$/

## Phase 2 — The ARIA corpus answers "graphic"

- [ ] **2.1 Two `aria-patterns.csv` rows.** A meaningful standalone graphic:
      `role="img"` on the `<svg>`, a direct `<title>` (and optional `<desc>`)
      referenced by namespaced ids, never `aria-label` plus `<title>`, and host
      alt text when delivered through `<img>`. A decorative graphic:
      `aria-hidden="true"` and an empty host `alt`. Anti-patterns name the
      generic `id="title"` collision. Same seven columns, WCAG 1.1.1 / 4.1.2
      refs, APG or WAI docs URL.
      verify: `./scripts-run src/skills/corpus-grounding/scripts/ground search --manifest src/skills/accessibility-auditor/data/manifest.json "meaningful standalone svg chart graphic accessible name"` -> /Result\s1\n-\s\*\*Component:\*\*\s(?!Icon-only)/
- [ ] **2.2 Keep the icon-button query where it is.** The existing row must
      still win its own query, and the manifest records the re-derivation.
      verify: `./scripts-run src/skills/corpus-grounding/scripts/ground search --manifest src/skills/accessibility-auditor/data/manifest.json "icon only close button"` -> /Icon-only\sbutton/
      and `./scripts-run src/scripts/check_corpus_staleness` -> 0

## Phase 3 — The render-security skill names the SVG sinks

- [ ] **3.1 One patterns-table row.** In
      `frontend-render-security/SKILL.md` § The patterns AI ships by default:
      untrusted SVG markup into `innerHTML` / `v-html` /
      `dangerouslySetInnerHTML` or inlined server-side — event attributes,
      `<script>`, `foreignObject`, a `javascript:` href, external references,
      a DOCTYPE with entities (CWE-79, CWE-611). Do instead: sanitise with an
      SVG profile chosen for the delivery context, or deliver through `<img>`
      (scripts do not run in an image document), with CSP as the second line.
      Point at `threats.csv:9` as the authority for uploads instead of
      restating it.
      verify: `grep -ci 'foreignObject' src/skills/frontend-render-security/SKILL.md` -> /^[1-9]/
- [ ] **3.2 One backstop grep.** Extend § Backstop greps with a pattern that
      locates SVG active content in source (`foreignObject`, an `on*`
      attribute inside `<svg`, a `javascript:` href).
      verify: a scratch fixture under agents/runtime/tmp/ with three planted
      SVGs (an onload attribute, a foreignObject, a javascript href) and one
      clean twin — the grep hits all three and not the twin.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | evidence | SVG motion lines go into § Motion, never into a new owner or skill | archived `road-to-one-motion-authority`: § Motion is the sole carrier with a drift gate | the drift gate is retired |
| A2 | reversible-technical | evidence | No "prefer SMIL for a self-contained SVG" default; internal CSS under `no-preference` is the default and SMIL is the exception | the CSS kill switch does not stop SMIL; an `img`-delivered SVG kept animating under emulated `reduce` | a reduced-motion route for SMIL is shown to work without a host route |
| A3 | reversible-technical | evidence | No CSS `d`-morph line | its cross-engine support was measured in one engine only | a second engine is measured |

## Non-goals

No new skill, rule, command or hook concern. No easing table, duration or
curve. No recipe or text copied from any external skill. No sanitiser library
named as the required one — the row states the property, the consumer picks
the implementation.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A mechanism line reads as a value | implementation | The drift gate parses a new SVG line as a motion value and reds, or a value slips in beside the mechanism | 1.2 records a verdict per line and greps the diff for durations | Phase 1 — The motion authority learns SVG |
| 2 | Retrieval dilution in the ARIA corpus | implementation | The new graphic row steals the icon-button query, or the reverse | 2.1 and 2.2 run both queries before and after | Phase 2 — The ARIA corpus answers "graphic" |
| 3 | The security row is read as "sanitise everything" | product | A consumer inlining its own trusted icons gets a sanitiser demand it does not need | The row is scoped to untrusted markup and names `<img>` delivery as the neutral route | Phase 3 — The render-security skill names the SVG sinks |

## Acceptance Criteria

- [ ] AC-1 — § Motion names `transform-box`, `pathLength`, the `keySplines`
      range and the SMIL reduced-motion route, and `lint_motion_authority_drift`
      is green with no band, curve or duration changed.
- [ ] AC-2 — A "meaningful standalone graphic" query grounds to a graphic row,
      not to the icon-button row, and the icon-button query still grounds to
      its own row.
- [ ] AC-3 — `frontend-render-security` names the SVG active-content sinks and
      the `<img>` delivery route, and its backstop greps locate them.
