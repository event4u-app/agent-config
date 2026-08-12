---
reported: 2026-08-12
reporter: colleague-of-maintainer
host: claude-code (version not stated by the reporter)
symptoms:
  - The agent takes screenshots although it has the design artifact's code and scripts
  - Resulting design is inconsistent
  - Resulting design is simply different from the artifact
  - The artifact's HTML is not adopted; worse markup is written from scratch
  - JavaScript from the artifact is missing
---

# Frontend rebuilt from screenshots while the source code was available

Reported verbally, via chat, the same day as
[`2026-08-12-subagent-runs-and-returns.md`](2026-08-12-subagent-runs-and-returns.md)
and describing that report's first symptom in detail. When implementing a
frontend from a provided design artifact that included HTML and scripts, the
agent worked from screenshots and rebuilt from pixels instead of reading the code
it already had.

The reporter also stated the principle they expected, which the roadmap adopted
as its title claim: whenever source is reachable — as an archive, as provided
files, or through the browser — the source is the data basis; screenshots are for
validation and for genuinely dynamic content. Analysing the source for defects
and improving it stays explicitly fine; working *only* from a screenshot does not.

## confirmed:

- **Defect:** the source-over-pixels principle exists as prose in one skill with
  no deterministic carrier — `src/skills/existing-ui-audit/SKILL.md:54`; no hook,
  concern, or tool matcher enforces it anywhere in `src/scripts`
- **Defect:** a shipped reference actively teaches the screenshot-first workflow
  with no branch for a code artifact — `src/skills/design-review/references/verification-automation.md:34`
- **Defect:** every provided-artifact honesty guarantee is keyed on engine state
  an ad-hoc run never sets — `src/skills/design-review/SKILL.md:219`
  (`state.ui_design.provided_artifact`); the coverage report's sole production
  consumer is the engine apply step
- **Defect:** no adopt-the-code duty exists — re-deriving markup from scratch
  instead of adapting the artifact's own is currently not a rule violation at all
- **Defect:** the URL / live-page handover class is uncovered by the fidelity
  rule's triggers — `src/rules/design-fidelity.md:5-28`
- **Pinned at:** `ed76d224` (claims), re-verified at `1432c7a45` (adoption)
- **Roadmap:** [`road-to-source-first-frontend`](../../roadmaps/road-to-source-first-frontend.md)

**Open premise, deliberately not closed here.** Whether the symptom still
reproduces ad-hoc on current main is unmeasured — that measurement is the
roadmap's own Phase 1, and its pre-registered outcome on a green result is to
publish the null and hand this report back with the number. The defects above are
confirmed as *present in the tree*; the causal chain to the reported behaviour is
not yet confirmed by reproduction.
