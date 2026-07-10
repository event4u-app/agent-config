---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-frontier-quality-operating-system
---

# Road to design artifact fidelity — make visual work production-grade before it reaches the user

> Source-anonymous harvest per `source-confidentiality`. This roadmap focuses
> on Source B, the external design/artifact prompt, and cross-checks Source C's
> visualize/deck/document surfaces. The transferable lesson: design quality is
> a workflow with research, assets, constraints, variants, preservation, and
> verification, not a bag of styling tips.

## Goal

Raise the package's frontend/design/artifact behavior to a stricter floor:
understand the medium, inspect the existing design system or code, preserve
targeted edits, copy required assets, create appropriate variations, verify
render/load behavior, and hand off implementation intent cleanly. This roadmap
does not implement a new design runtime. It upgrades the rules, skills, and
eval gates that make agents produce better visual work in existing runtimes.

## Reverse-engineering findings

The design prompt is unusually concrete. It names the agent's role, asks for
domain embodiment (UX designer, animator, slide designer, prototyper), demands
resource exploration, uses todo lists, preserves prior versions on major
revisions, keeps small edits surgical, copies assets instead of hotlinking,
labels screens, preserves comment anchors, defines option canvases, and uses a
single verification call before finalizing.

Its most important quality pattern is "context before taste": read the design
system's full definition, inspect code over screenshots when available, copy
the visual vocabulary, and ask for context when none is attached. The second
pattern is "rendered artifact before claim": open the file, check errors, then
finish briefly.

## Council-driven hardening

The review pass flagged that a hard render gate is unsafe unless host
capabilities are known, and that design evals must exist before behavior is
made default. This roadmap therefore starts with a capability/degrade table,
adds design-specific evals before lifecycle rollout, and treats verification
as "prove or caveat" rather than a universal browser requirement.

## Current package fit

Already strong: `fe-design`, `existing-ui-audit`, `design-review`,
`ui-component-architect`, `playwright-testing`, `design-fidelity`,
`icon-consistency`, `brand-consistency`, visual-review-loop contracts, and
frontend guidance in host instructions.

Gaps:

- The existing design stack is broad but not consistently **artifact-first**:
  some skills describe taste, fewer enforce resource exploration, asset
  copying, variation strategy, and verification as one contract.
- There is no single "design artifact lifecycle" that applies to landing
  pages, dashboards, prototypes, decks, diagrams, and design handoff bundles.
- Verification is split between Playwright skills and UI contracts, but the
  default design-finish behavior is not a hard "open/render/check before
  claiming".
- Source B's targeted-edit discipline is sharper than current generic scope
  control: for small changes, preserve layout, spacing, colors, typography,
  and content exactly unless asked.
- Design-system extraction lacks a complete "visual foundations specimen"
  floor: typography, color, spacing, iconography, assets, component cards,
  and UI-kit screens as separate, scannable artifacts.

## Phase 0 — Host capability, eval baseline, and rollout guardrails

- [x] Add or reference a host-capability/degrade table for design verification:
      local browser, Playwright, screenshots, console inspection, canvas pixel
      checks, PDF render, deck export, document export, image decode, and
      hosts where only static inspection is available.
      <!-- done 2026-07-10: docs/contracts/design-artifact-verification.md — a
      per-host-class capability table (A local-with-tooling / B cloud-sandboxed
      / C CI-headless) across 10 verification primitives, with a probe-first
      resolution rule (⚠️ = only if the dep is present) and the honest-degrade
      default (unknown → static-inspect only). Sibling to the subagent
      host-capability-manifest; not a duplicate (that = subagent primitives). -->
- [x] Create design-artifact eval fixtures before changing behavior: targeted
      edit preservation, missing asset, inaccessible design system, no
      screenshot/code context, requested variations, unwanted variations,
      overlapping text, mobile fit, and export/readback failure.
      <!-- done 2026-07-10: tests/design-artifacts/eval-fixtures.md — all 9
      named cases with stable ids (daf-edit-preservation, daf-missing-asset,
      daf-inaccessible-design-system, daf-no-context, daf-requested-variations,
      daf-unwanted-variations, daf-overlapping-text, daf-mobile-fit,
      daf-export-readback-failure), each naming its required primitive (scored
      only when present, else skipped-with-caveat) + pass criterion. Phase 1
      links lifecycle branches to these ids. -->
- [x] Define staged rollout: advisory lifecycle docs first, then routed skill
      updates, then default verification gates only where capability exists.
      <!-- done 2026-07-10: § Staged rollout in design-artifact-verification.md —
      advisory → routed → default-gates-where-capable; a gate is never default-on
      for a class that can only static_inspect. -->
- [x] Define rollback language for any default-on verification gate so a host
      without render support can degrade honestly instead of blocking all
      design work.
      <!-- done 2026-07-10: § Rollback language in design-artifact-verification.md —
      the verbatim degrade block (names gate + primitive + host class + the
      unverified property + the fallback); a gate that cannot degrade this way
      is misconfigured. -->

**Exit:** capability table and eval baseline exist; maintainer accepts which
verification checks are hard gates per host.

## Phase 1 — Design artifact lifecycle contract

- [x] Add `docs/contracts/design-artifact-lifecycle.md` describing the common
      lifecycle: understand medium/audience/fidelity → inspect source assets
      and design system → define visual system/variation plan → build artifact
      → verify render/load/responsive states → brief handoff.
      <!-- done 2026-07-10: docs/contracts/design-artifact-lifecycle.md — the
      6-stage lifecycle table (Understand/Inspect/Plan/Build/Verify/Handoff),
      each stage citing the fixtures that exercise it. -->
- [x] Map existing skills to lifecycle stages: `existing-ui-audit`,
      `fe-design`, `design-review`, `ui-component-architect`,
      `playwright-testing`, `brand-audit`, `brand-to-tokens`,
      `presentations`, `PDF`, and document skills where applicable.
      <!-- done: § Skill → stage map. Conceptual "presentations"/"PDF"/document
      map to the real skills html-deck / markitdown / doc-coauthoring
      (design-system-capture added for Handoff). -->
- [x] Add explicit branch rules: new design vs targeted edit vs iteration vs
      design-system extraction vs handoff to production code.
      <!-- done: § Branch rules — 5 branches, each selecting the stages it runs
      + ≥1 gating fixture; targeted-edit stays surgical, iteration preserves the
      prior version on a major revision. -->
- [x] Add "do not invent filler" and "ask before adding material" as design
      constraints. Empty space is a composition problem, not permission to add
      fake sections, fake metrics, or stock-like decoration.
      <!-- done: § Design constraints (Iron-Law fence) — no invented filler,
      ask before adding material; cross-linked direct-answers IL2 +
      output-discipline. -->
- [x] Link lifecycle states to eval ids from Phase 0 so later skill edits can
      prove the contract is operational.
      <!-- done: each lifecycle stage + each branch names its gating fixture id
      from tests/design-artifacts/eval-fixtures.md; every branch has ≥1. -->

**Exit:** all design-related skills can point to one lifecycle without
duplicating it, and each lifecycle branch has at least one eval fixture.

## Phase 2 — Resource-first design context gate

- [x] Upgrade `existing-ui-audit` / `fe-design` triggers so any request to
      recreate, redesign, mock, prototype, or improve a UI first searches for:
      design tokens, global CSS, component library, screenshots, Figma/exported
      context when available, assets/logos/icons/fonts, and copy tone.
      <!-- done 2026-07-10: new "## Resource-first context gate" section in
      existing-ui-audit (search-first list, ties to procedure steps 1–5) + a
      pointer block in fe-design routing recreate/redesign/mock/prototype/improve
      through the gate before taste. -->
- [x] Add a hard stop when the user explicitly references an inaccessible
      design system, local folder, Figma, or codebase: ask for access rather
      than inventing a design from memory.
      <!-- done: gate bullet "Hard stop on a promised-but-inaccessible source" —
      STOP + ask (ask-when-uncertain), never invent from memory; fixture
      daf-inaccessible-design-system. -->
- [x] Add source-priority guidance: code/design-system context beats
      screenshots for exact values; screenshots help with gestalt but are not
      enough for component/token fidelity.
      <!-- done: gate bullet "Source priority — code beats screenshots". -->
- [x] Add tool-composition guidance: repository search and local files first
      for owned UI, connector/imported design data first when available,
      browser/image search only for public references or current product/place
      imagery, and generated imagery only when the user asks for synthetic
      assets or no real inspection is required.
      <!-- done: gate bullet "Tool composition — inspect before you generate"
      (owned→repo/local; connector next; browser/image public-refs only;
      generated only on request). -->
- [x] Add trigger evals for "redesign this app" with code present, screenshot
      only, no assets, and inaccessible referenced source.
      <!-- done: src/skills/existing-ui-audit/evals/triggers.json — 5
      should-trigger (the four Phase-2 cases + improve-existing) + 5
      should-not-trigger near-misses (backend/API, migration, general design
      knowledge, trivial README typo, CI explain). -->

**Exit:** design work no longer starts from generic aesthetic memory when
project-specific context exists or was promised.

## Phase 3 — Surgical edit preservation rule

- [ ] Add or extend a rule for small visual edits: if the user asks for a
      color/text/one-element change, change only that semantic target and
      preserve surrounding layout, spacing, typography, dimensions, content,
      animation, and interaction states.
- [ ] Add examples of legitimate broader redesign triggers: "new direction",
      "from scratch", "make it feel premium", "rework the flow", "give me
      variations".
- [ ] Add comment-anchor/screen-label preservation guidance for hosts that can
      expose DOM/comment metadata. Where host support is absent, preserve
      stable semantic anchors in source code comments/data attributes only if
      already present.
- [ ] Add regression tests or trigger evals where an agent must not rewrite an
      entire component for a one-line copy or color edit.

**Exit:** small-change design tasks get the same minimal-safe-diff discipline
as backend edits.

## Phase 4 — Variation and canvas planning

- [ ] Add a `design-variation-planning` skill or extend `fe-design`: for
      ambiguous creative work, decide whether to ask about variation count and
      axes (visual direction, UX flow, interaction, copy, density, brand
      strictness). For clear implementation tasks, proceed.
- [ ] Define variation floors: two to three meaningfully different options
      when the user asks for exploration; no decorative option spam when the
      user asks for one production answer.
- [ ] Add a canvas/exploration contract for side-by-side concepts: stable
      frame labels, no nested cards, generous spacing, and export-safe
      coordinates for tools that support canvases. Keep it host-neutral.
- [ ] Add cost/UX tie-breakers: ask only when the variation axis changes the
      work materially; otherwise choose a strong default and document the axis
      used in the handoff.
- [ ] Add trigger evals distinguishing "give me three directions" from
      "implement the selected direction".

**Exit:** agents stop producing one generic design when exploration was asked,
and stop producing unnecessary options when execution was asked.

## Phase 5 — Asset and iconography discipline

- [ ] Add a design asset rule: copy or reference project-owned assets through
      the target project's accepted asset path; do not hotlink design-system
      internals or bulk-copy huge folders; do not hand-roll icons when an icon
      library or brand asset exists.
- [ ] Add iconography floor: inspect existing icon system first; match stroke,
      fill, size, and metaphor; flag substitutions when exact assets are absent.
- [ ] Add image-use floor for visual pages/decks: use actual product/place/
      object/state imagery where inspection matters; avoid decorative
      atmosphere as the primary proof.
- [ ] Add tests/evals for known failure modes: emoji-as-icon in serious UI,
      fake SVG logo, hardcoded external asset URL, and invented product
      screenshot.

**Exit:** visual artifacts carry real assets or honest placeholders, not
fabricated brand evidence.

## Phase 6 — Render verification hard gate with honest degradation

- [ ] Create a design-specific verification checklist: open artifact, check
      console/load errors, inspect desktop and mobile viewport, verify text
      fit/no overlap, verify referenced assets decode, verify key interaction
      state, and capture evidence only when the host supports it.
- [ ] Wire the checklist into `playwright-testing` / `design-review` so design
      tasks cannot claim completion without render evidence when render
      capability exists. For static docs or decks, use the relevant
      presentation/PDF/document verification skill.
- [ ] Add failure language: if verification cannot run because no browser or
      renderer exists, report that plainly and keep the completion claim
      scoped to what was checked.
- [ ] Add at least six golden tasks covering nonblank canvas, responsive fit,
      missing image, overlapping text, broken interaction, and print/deck
      export readiness.

**Exit:** "looks good" is replaced by concrete render evidence or an explicit
verification limitation.

## Phase 7 — Design-system extraction floor

- [ ] Add a design-system extraction contract: root guide/manifest, token CSS
      or equivalent, typography/color/spacing/iconography foundations,
      component specimens, asset inventory, UI-kit screens, and starting
      points when appropriate.
- [ ] Require specimen granularity: many small foundation cards beat one dense
      dump; each specimen demonstrates a reusable sub-concept.
- [ ] Add a handoff bundle pattern for developers: high-fidelity reference,
      behavior notes, assets list, component mapping, responsive states, known
      caveats, and "prototype not production code" warning when applicable.

**Exit:** design systems become reusable package artifacts rather than a
single prose style guide.

## Acceptance criteria

- [ ] Host capability/degrade table exists before any hard verification gate.
- [ ] `design-artifact-lifecycle` contract exists and is cited by the relevant
      design/frontend/document skills.
- [ ] Small edit preservation, context gate, asset discipline, variation
      planning, and render verification have trigger evals.
- [ ] Design verification failures produce actionable, user-visible caveats.
- [ ] No generated projection is edited by hand.

## Blockers

### blocker: host-verification-capability-map
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 0 checkpoint only
- **What to do:** map which supported hosts can open local artifacts,
  screenshot, inspect console logs, or run Playwright. The rule must degrade
  honestly per host instead of requiring impossible checks.
- **Resolved when:** the design verification checklist has a per-host
  capability table or points to an existing host-capability manifest.
- **Resolution (2026-07-10, template rule 22 sweep):** not a human gate —
  mapping host capabilities is research + documentation the agent performs
  during Phase 0 (read host docs / existing capability manifests, emit the
  per-host table with honest degrade rows). Nothing to decide or authorize;
  the "Resolved when" is an agent-checkable artifact-exists signal and remains
  Phase 0's exit criterion.
