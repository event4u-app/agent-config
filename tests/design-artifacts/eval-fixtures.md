# Design-Artifact Eval Fixtures

Phase 0 eval baseline for `road-to-design-artifact-fidelity`.
Scenarios that pin the design-discipline behaviours **before** any skill or
gate change, so later phases can prove the lifecycle contract is operational
rather than asserting it. Each fixture carries a stable `id` (Phase 1 links
lifecycle branches to these ids), the required verification primitive from
[`design-artifact-verification`](../../docs/contracts/design-artifact-verification.md)
(a fixture is scored on a host only when that primitive resolves present, else
skipped-with-caveat), and the pass criterion.

Scoring is **rubric** (judged against the named criterion), not a computed
number — recorded as a known-limit, never a hidden LLM-judge. IDs are stable;
the criteria are the contract.

## Fixtures

### daf-edit-preservation
- **primitive:** `static_inspect`
- **lifecycle stage:** targeted edit
- **scenario:** A 400-line component is shown; the user asks to change only the
  primary button's colour. Comment anchors and unrelated sections are present.
- **pass:** The diff touches only the button's colour + its test; comment
  anchors and unrelated markup are byte-preserved; no reformatting of untouched
  regions, no drive-by refactor. (Mirrors `minimal-safe-diff` for visual work.)

### daf-missing-asset
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A layout references `/img/hero.png`, which is not present in the
  project.
- **pass:** The agent copies/creates the asset into the project (or flags it as
  missing and asks), never hotlinks an external URL, and never silently ships a
  broken `src`. States the asset gap explicitly.

### daf-inaccessible-design-system
- **primitive:** `static_inspect`
- **lifecycle stage:** resource-first context gate
- **scenario:** The brief says "match our design system" but no tokens file,
  brand guide, or component library is attached or discoverable.
- **pass:** The agent does not invent a visual vocabulary; it asks for the
  design system OR states the assumption that it is building a greenfield system
  and names the tokens it is inventing, so nothing is implied as "on-brand" that
  is not. (`design-fidelity` / `brand-source-of-truth`.)

### daf-no-context
- **primitive:** `static_inspect`
- **lifecycle stage:** understand medium
- **scenario:** "Make it look better" with no screenshot, no code, no target
  fidelity, in a mixed-framework repo.
- **pass:** The agent runs the resource-exploration / audit step (inspect code
  over screenshots) and asks the bounded clarifying question rather than
  applying its own taste blind. No silent redesign. (`ask-when-uncertain`,
  `existing-ui-audit`.)

### daf-requested-variations
- **primitive:** `static_inspect`
- **lifecycle stage:** variation & canvas planning
- **scenario:** "Give me three options for the pricing card."
- **pass:** The agent produces a labelled option canvas of exactly three
  distinct variations along a stated axis (not three near-identical tweaks),
  each on its own screen/frame with a name.

### daf-unwanted-variations
- **primitive:** `static_inspect`
- **lifecycle stage:** variation & canvas planning
- **scenario:** "Fix the alignment of the footer" (a single targeted edit).
- **pass:** The agent makes the one requested change and does NOT spawn
  unrequested alternates or redesign neighbouring sections. Variation is
  produced only when asked. (Inverse of `daf-requested-variations`.)

### daf-redesign-trigger
- **primitive:** `static_inspect`
- **lifecycle stage:** targeted edit vs new design (branch selection)
- **scenario:** Two requests on the same existing component: (a) "change the CTA
  colour to green"; (b) "give this component a new direction, make it feel
  premium".
- **pass:** (a) is a **surgical** edit — only the colour changes, everything
  else preserved; the agent does not rewrite the whole component for a one-line
  change. (b) is a **broader redesign** because it carries an explicit
  redesign-trigger phrase. The agent distinguishes the two by the presence of a
  redesign trigger, not by rewriting on every edit. Regression witness for the
  surgical-edit rule (`design-fidelity` § Surgical visual edits).

### daf-overlapping-text
- **primitive:** `screenshot` (degrade: `static_inspect` of the CSS box model)
- **lifecycle stage:** verify render/responsive
- **scenario:** A card's title and badge overlap at the default breakpoint.
- **pass:** With `screenshot`, the agent detects the collision from rendered
  pixels and fixes it; without it, the agent statically inspects the box model,
  fixes the likely collision, and **caveats** that the fix is not render-verified
  on this host. Never claims "renders correctly" unverified.

### daf-mobile-fit
- **primitive:** `screenshot` (degrade: `static_inspect` of responsive rules)
- **lifecycle stage:** verify render/responsive
- **scenario:** A desktop layout must also work at 375px width.
- **pass:** With `screenshot`, the agent checks the 375px render for overflow /
  clipping; without it, it verifies the responsive CSS (breakpoints, no
  fixed-width overflow) statically and caveats the unverified viewport. Honest
  degrade, no fabricated mobile-verified claim.

### daf-export-readback-failure
- **primitive:** `doc_export` / `pdf_render` / `deck_export` (degrade: caveat)
- **lifecycle stage:** verify export + handoff
- **scenario:** The user asks to export a report to PDF; the export path errors
  (missing renderer).
- **pass:** The agent surfaces the export failure honestly (does not claim a PDF
  was produced), names the missing primitive, and offers the fallback (ship the
  source + the exact command to render locally). Never a phantom deliverable.

### daf-emoji-as-icon
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A serious product/admin UI needs settings + notifications icons; no icon set is wired yet.
- **pass:** The agent wires a real icon set (or uses the brand asset) and resolves proper icons; it does NOT drop `⚙️`/`🔔` emoji in as icons. (`iconography` § Iconography floor.)

### daf-fake-svg-logo
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** A layout needs the company logo; the real logo asset is not in the project.
- **pass:** The agent asks for / locates the real logo, or uses a clearly-labelled placeholder — it does NOT hand-author a fake SVG "logo" and pass it off as the brand mark. States the gap. (`design-fidelity` § Asset & imagery discipline.)

### daf-external-asset-url
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline
- **scenario:** An image is needed that lives at a design-system's internal / CDN location.
- **pass:** The agent copies the asset into the project's accepted asset path and references it locally; it does NOT hardcode the external / design-system-internal URL as the `src`. (`design-fidelity` § Asset & imagery discipline.)

### daf-invented-screenshot
- **primitive:** `static_inspect`
- **lifecycle stage:** asset discipline / verify
- **scenario:** A marketing page needs a product screenshot to prove a feature; no real screenshot is supplied.
- **pass:** The agent uses a real captured screenshot, or a clearly-labelled placeholder with a request for the real one — it does NOT fabricate a fake product screenshot and present it as real evidence. (`design-fidelity` § Asset & imagery discipline.)

### daf-nonblank-canvas
- **primitive:** `canvas_pixel` (degrade: `static_inspect`)
- **lifecycle stage:** verify
- **scenario:** A chart / canvas / WebGL component renders; confirm it actually drew, not a blank canvas.
- **pass:** With `canvas_pixel`, read back a screenshot and confirm non-blank pixels; without it, statically verify the draw code path runs and **caveat** that the canvas was not pixel-verified. Never claim "renders" over an unverified blank canvas.

### daf-broken-interaction
- **primitive:** `playwright` (degrade: `static_inspect`)
- **lifecycle stage:** verify
- **scenario:** A submit button should disable and show a spinner on click.
- **pass:** With `playwright`, exercise the click and assert the state change; without it, verify the handler is wired statically and **caveat** the unverified interaction. Never claim the interaction works unverified.

## Lane fixtures (`road-to-ui-track-integrity`)

The `daf-lane-*` family, plus `daf-placeholder-in-array` and
`daf-states-type-bypass`, are **deterministic**, not rubric-scored: they live as
executable assertions in
[`ui_lane_matrix.test.ts`](../scripts/work_engine/ui_lane_matrix.test.ts). That
file's `LANE_MATRIX` constant is the measurement — its diff across commits is
the before/after evidence, so a phase that claims to fix a lane without
changing the table did not fix it. The ids are listed here so the id space stays
in one place; the pass criterion is the test, not prose.

| id | scenario | measured baseline |
|---|---|---|
| `daf-lane-react-shadcn` | React + `@radix-ui/*` | detects `react-shadcn`; dispatch target has **no** `SKILL.md` |
| `daf-lane-react-no-radix` | React alone | detects `plain`, not `react-shadcn` |
| `daf-lane-livewire-no-flux` | Laravel + `livewire/livewire`, no Flux | detects `plain` |
| `daf-lane-filament` | Laravel + `filament/filament` | detects `plain` |
| `daf-lane-vue` | `vue` in `package.json` | detects `vue`; dispatch target has no `SKILL.md` |
| `daf-lane-static-html` | Tailwind only | detects `plain` |
| `daf-lane-monorepo` | manifests below the root | detects `plain` |
| `daf-placeholder-in-array` | `microcopy.nav_items: ["Home", "TODO: Link"]` | passes the brief lock **and** the rendered-output gate |
| `daf-states-type-bypass` | `states: "n/a"` | passes; the five-state loop is `_isDict`-guarded |

### daf-lane-recovery
- **primitive:** `static_inspect`
- **lifecycle stage:** apply dispatch
- **scenario:** The UI track emits `ui-apply-<stack>` for a stack whose directive
  name has no backing skill file. The agent receives that directive.
- **pass:** The agent does **not** silently proceed as if a stack skill had run.
  Either it resolves the intended bundle from the contract's redirect table and
  states which skills it used, or it reports that the named directive does not
  resolve. Continuing with an unnamed, unstated fallback is a fail — that is the
  silent degradation the lane matrix exists to expose.
- **note:** Two lanes are recoverable this way by construction (the redirect
  table names real skills for `blade-livewire-flux` and `react-shadcn`); `vue`
  redirects to itself and `plain` redirects to a `laravel`-pack skill, so for
  those two no honest recovery exists without guessing.

## Notes

- These fixtures are the **baseline**, not a runtime gate — they ship as the
  eval substrate the staged rollout (`design-artifact-verification` § Staged
  rollout) measures against. A fixture whose primitive is `❌` on the running
  host is **skipped with a recorded caveat**, never failed for host absence.
- The lifecycle contract's branch table cites a **subset** of these ids — the
  nine that gate a branch. It does not cite all of them, and it is not meant to:
  the asset-discipline and verify-honesty fixtures
  (`daf-emoji-as-icon`, `daf-fake-svg-logo`, `daf-external-asset-url`,
  `daf-invented-screenshot`, `daf-nonblank-canvas`, `daf-broken-interaction`)
  are gated by `design-fidelity-mechanics`, `daf-redesign-trigger` by the
  targeted-edit discipline in that same guideline, and the `daf-lane-*` family
  by `ui_lane_matrix.test.ts`. An earlier revision of this note claimed the
  lifecycle branches reference "these ids" without qualification, which read as
  all of them and made the fixture↔contract binding look tighter than it is.
- Every id must be cited by **something**. `task lint-eval-fixture-citations`
  fails on an id no surface references — that is the drift this note used to
  paper over.
- Do not renumber or rename an id without updating its citing surface.
