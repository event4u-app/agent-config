# Design-Artifact Eval Fixtures

Phase 0 eval baseline for [`road-to-design-artifact-fidelity`](../../agents/roadmaps/road-to-design-artifact-fidelity.md).
Nine scenarios that pin the design-discipline behaviours **before** any skill or
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

## Notes

- These fixtures are the **baseline**, not a runtime gate — they ship as the
  eval substrate the staged rollout (`design-artifact-verification` § Staged
  rollout) measures against. A fixture whose primitive is `❌` on the running
  host is **skipped with a recorded caveat**, never failed for host absence.
- Phase 1 (`design-artifact-lifecycle`) references these `id`s from its
  lifecycle branches; do not renumber or rename an id without updating that
  link.
