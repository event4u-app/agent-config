---
stability: beta
keep-beta-until: 2026-11-24
keep-beta-reason: >-
  Beta review 2026-09-05. Its own § 14-16 makes its status conditional on
  `design-artifact-verification.md` § Staged rollout, and that contract is beta
  and extended to 2026-11-24 in this same change; the two are one review, not
  two, and re-dating them separately would recreate the mismatch in 90 days.
  Stage 2 is also overstated in the tree: of the five skills the sibling contract
  names, only `existing-ui-audit` and `iconography` cite this contract —
  `fe-design`, `ui-component-architect` and `design-review` carry zero
  references. Before the window ends: either stage 2 is completed for the three
  missing skills or § 14's stage claim is corrected to the measured state, and
  the two `directives/ui/*.ts` short-form paths at §§ 81 and 87 are anchored at
  `src/agent-src/templates/scripts/work_engine/`.
---

# Design-Artifact Lifecycle Contract

Phase 1 of `road-to-design-artifact-fidelity`.
One lifecycle every design/artifact skill points at, so "context before taste"
and "rendered artifact before claim" are a shared workflow, not per-skill folklore.
Design work is a **pipeline** — understand, inspect, plan, build, verify, hand
off — not a bag of styling tips.

This contract is advisory (staged-rollout stage 1 per
[`design-artifact-verification` § Staged rollout](design-artifact-verification.md#staged-rollout)):
skills reference these stages; nothing here is a default gate yet.

## The lifecycle

Six stages. Every design task runs the stages its branch (below) selects — never
skips straight to "build".

| # | Stage | What it does | Exercised by fixtures |
|---|---|---|---|
| 1 | **Understand** | Medium, audience, fidelity, target host. What *kind* of artifact (screen, deck, doc, component, prototype), for whom, at what polish, verifiable how (per the capability table). | `daf-no-context` |
| 2 | **Inspect** | Read the existing design system + code **before** styling — code over screenshots when available; copy the visual vocabulary; confirm assets exist. Ask when no context is attached. | `daf-inaccessible-design-system`, `daf-missing-asset` |
| 3 | **Plan** | Define the visual system + the variation plan: which axis varies, how many options, labelled. No unrequested variations. | `daf-requested-variations`, `daf-unwanted-variations` |
| 4 | **Build** | Produce the artifact against the system. Surgical on edits; no invented filler (§ Design constraints). | `daf-edit-preservation` |
| 5 | **Verify** | Prove the rendered artifact — render / load / responsive / export — via a primitive the host has, else caveat honestly (never fake). | `daf-overlapping-text`, `daf-mobile-fit`, `daf-export-readback-failure` |
| 6 | **Handoff** | Brief, honest handoff: what was built, what is verified vs caveated, implementation intent, preserved comment anchors. | `daf-export-readback-failure` |

Fixtures are defined in [`tests/design-artifacts/eval-fixtures.md`](../../tests/design-artifacts/eval-fixtures.md);
the ids are stable so skill edits in later phases can prove the stage is operational.

## Skill → stage map

Skills own the *depth* at each stage; the lifecycle owns the *order*. A skill
cites the stage(s) it serves instead of re-describing the workflow.

| Stage | Primary skills |
|---|---|
| Understand | [`fe-design`](../../src/skills/fe-design/SKILL.md), [`design-review`](../../src/skills/design-review/SKILL.md) |
| Inspect | [`existing-ui-audit`](../../src/skills/existing-ui-audit/SKILL.md), [`brand-audit`](../../src/skills/brand-audit/SKILL.md), [`brand-to-tokens`](../../src/skills/brand-to-tokens/SKILL.md) |
| Plan | [`fe-design`](../../src/skills/fe-design/SKILL.md), [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md) |
| Build | [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md), [`html-deck`](../../src/skills/html-deck/SKILL.md) (decks), [`doc-coauthoring`](../../src/skills/doc-coauthoring/SKILL.md) (documents) |
| Verify | [`playwright-testing`](../../src/skills/playwright-testing/SKILL.md), [`design-review`](../../src/skills/design-review/SKILL.md), [`markitdown`](../../src/skills/markitdown/SKILL.md) (export readback) |
| Handoff | [`design-review`](../../src/skills/design-review/SKILL.md), [`design-system-capture`](../../src/skills/design-system-capture/SKILL.md) |

(The roadmap's conceptual "presentations" / "PDF / document" skills map to the
real `html-deck`, `markitdown`, and `doc-coauthoring` skills above.)

## Branch rules

The lifecycle is not linear for every task. Pick the branch first; it selects
which stages run and which fixtures gate it (each branch has ≥1 fixture).

| Branch | Trigger | Stages run | Gating fixtures |
|---|---|---|---|
| **New design** | Greenfield artifact, no prior version | 1→2→3→4→5→6 (full) | `daf-no-context`, `daf-inaccessible-design-system`, `daf-requested-variations` |
| **Targeted edit** | Change one named thing in an existing artifact | 2 (light) → 4 → 5 | `daf-edit-preservation`, `daf-unwanted-variations` |
| **Iteration** | Refine an existing artifact across a version bump | 1 (delta) → 3 → 4 → 5; **preserve the prior version** on a major revision | `daf-requested-variations` |
| **Design-system extraction** | Derive tokens/components from existing artifacts | 2 (deep) → 6 | `daf-inaccessible-design-system` |
| **Handoff to production code** | Turn a design into implementation intent | 5 → 6 | `daf-overlapping-text`, `daf-mobile-fit`, `daf-export-readback-failure` |
| **Port a provided artifact** | A finished artifact (HTML export, prototype, design system) is handed over **as the spec**, to be reproduced | 1 (delta) → 2 (deep, on the artifact) → 4 → 5 → 6. **Stage 3 is excluded by definition** — a port has no variation axis; producing options for a spec the user already approved is the failure this branch exists to prevent | `daf-port-baseline`, `daf-port-trigger-de`, `daf-port-interactions`, `daf-slop-vs-provided` |

**A port is honoured or refused, never silently regenerated.** This branch was
missing, and its absence was not neutral: with no branch naming it, a handover
fell to **New design** by elimination — the only other branch containing Build —
which mandates the variation planning a port must not do. What the package
actually does on this branch:

- **A supplied `design-system.json` is honoured, not re-derived.** Its token
  values — including the `motion` block (`durations`, `easings`), which nothing
  consumed before — are read as the answer. Accepting such a contract is on the
  allowed side of the 2026-06-28 lock; *producing* one is not, so the package
  reads the file and never extracts it.
- **Without that contract, the loss is stated before any work happens.** The
  design brief carries five keys and cannot hold exact spacing, easing curves,
  hover behaviour, event handlers, or an asset manifest. The `design` gate names
  that list and asks; it does not quietly rebuild them from taste
  (`directives/ui/design.ts`, `UNCARRIED_BY_THE_BRIEF`).
- **The port reports its own coverage.** `apply` requires
  `ui_apply.coverage = {honoured, translated, flagged}` accounting for every
  declared interaction, keyframe, and asset exactly once. A handler the port
  could not carry belongs in `flagged` with its reason. This is the difference
  between a faithful port and a lucky one, and it is a gate rather than a
  convention (`directives/ui/apply.ts`, `coverage_gaps`).
- **Anti-slop findings the artifact covers are informational.** See
  [`design-fidelity-mechanics`](../guidelines/design-fidelity-mechanics.md)
  § Provided-artifact precedence.

**Targeted edit stays surgical** — no redesign of neighbours, no reformatting of
untouched regions, comment anchors preserved (the `daf-edit-preservation`
contract; mirrors [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) for
visual work). **Iteration preserves the prior version** on a major revision so a
regression is recoverable.

## Design constraints — do not invent filler

```
EMPTY SPACE IS A COMPOSITION PROBLEM, NOT PERMISSION TO ADD MATERIAL.
NEVER INVENT FAKE SECTIONS, FAKE METRICS, LOREM-STYLE COPY, OR STOCK
DECORATION TO FILL A LAYOUT. ASK BEFORE ADDING MATERIAL THAT ISN'T IN THE BRIEF.
```

- **Do not invent filler.** A sparse layout is solved with composition
  (spacing, scale, hierarchy), not with fabricated content. Fake KPIs, invented
  testimonials, placeholder charts with made-up numbers, and decorative
  stock-like imagery are content the user did not ask for and cannot trust.
- **Ask before adding material.** If the artifact genuinely needs content that
  isn't supplied (a section the brief implies but doesn't provide), surface the
  gap and ask — do not silently manufacture it. Realistic placeholder clearly
  labelled as placeholder is acceptable when the user asked for a mock; passing
  invented data off as real is not.

This is the design-surface instance of the no-invented-facts discipline
([`direct-answers`](../../src/rules/direct-answers.md) Iron Law 2) and the
no-placeholder-slop rule ([`output-discipline`](../../src/rules/output-discipline.md)).

## Related

- [`design-artifact-verification`](design-artifact-verification.md) — the Phase-0 host-capability & degrade contract this lifecycle's Verify stage runs against.
- [`tests/design-artifacts/eval-fixtures.md`](../../tests/design-artifacts/eval-fixtures.md) — the nine fixtures the stages + branches below gate on. The file carries more than nine; the others are gated by their own surfaces (`design-fidelity-mechanics`, `ui_lane_matrix.test.ts`), and `lint-eval-fixture-citations` fails on any id no surface cites.
- [`design-fidelity`](../../src/rules/design-fidelity.md) — the provided-design-is-the-spec rule the Inspect stage enforces.
- [`fe-design`](../../src/skills/fe-design/SKILL.md), [`existing-ui-audit`](../../src/skills/existing-ui-audit/SKILL.md), [`design-review`](../../src/skills/design-review/SKILL.md), [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md) — the design skills that cite these stages.
