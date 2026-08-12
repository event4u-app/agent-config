---
adr: 205
status: accepted
date: 2026-07-31
decision: webfont-delivery-ownership
supersedes: —
superseded_by: —
phase: webfont-delivery-ownership Phase 0
type: structural
review_trigger: >-
  Reopen when (a) a second emitter of a third-party asset URL appears that the
  asset-discipline section does not reach — the dissent's central prediction, and
  the falsifier this record is measured against; (b) the package ever gains a
  font-bundling or asset-fetching capability, which would move the delivery
  decision from "name the target project's route" to "we ship the file" and make
  a skill-local owner defensible again; or (c) a consumer reports that the
  self-hosted default produced a worse outcome than the hotlink it replaced (a
  font the target pipeline could not resolve), which would reopen the
  default-direction, not the ownership.
---

# ADR-205 — The asset-discipline guideline section owns third-party webfont delivery

## Status

**Accepted.** Executed in the same change: the guideline section is extended,
the emitting skill branches on hosting mode, the corpus carries the delivery
route, and the reach gap is closed through an existing always-fires surface.

## Context

Three artifacts each assumed another covered third-party webfont delivery, and a
fourth emitted the thing the others call an anti-pattern:

- `docs/guidelines/design-fidelity-mechanics.md` § Asset & imagery discipline
  forbade hotlinking, but scoped itself to **project-owned** assets and
  **design-system-internal** URLs.
- `src/skills/design-system-capture/references/design-system-json.md` declared
  font bundling explicitly out of scope ("the package never downloads or bundles
  fonts") — a standing lock, not revisited here.
- `src/skills/typography-system/SKILL.md` required the
  `@import url('https://fonts.googleapis.com/…')` from the corpus as a
  deliverable, unconditionally, with no hosting-mode branch.
- `src/skills/design-intelligence/data/font-pairings-reference.csv` carried that
  import in **73 of 73** rows, with zero self-hosted alternatives, while its
  sibling `data/stacks/nextjs.csv` row 22 listed
  `<link href="fonts.googleapis.com"/>` in its **Don't** column.

The consequence is not stylistic. A German court (LG München I) held that <!-- md-language-check: ignore -->
embedding Google Fonts by hotlink transmits the visitor's IP address to a third
party without consent. This package's consumers build German SaaS, so a corpus
that prescribes the hotlink in every row shipped that exposure as the default.

## Decision

**Owner: `docs/guidelines/design-fidelity-mechanics.md` § Asset & imagery
discipline.** Its asset sentence is widened from *project-owned* assets to
**any** asset whose delivery path crosses a third party. One section, named in
writing, is the policy; everything else is a consumer or a pointer.

| Artifact | Role after this decision |
|---|---|
| `design-fidelity-mechanics` § Asset & imagery discipline | **Owns** the policy: self-hosted through the target project's own pipeline by default; a third-party hotlink only on an explicit consumer opt-in, stated. |
| `rule: design-fidelity` | No change. Its trigger scope (a provided design artifact exists) stays correct for its own job. |
| `skill: typography-system` | Declared **consumer**. Emits the per-stack self-hosted route; the hotlink becomes an opt-in branch, not the deliverable. Points at the owner instead of restating the policy. |
| `skill: ai-code-blindspots` (surface→controls table) | Carries the **reach pointer** — see § The reach problem. |
| `font-pairings-reference.csv` | Carries the delivery route as data (`Self-Hosted Route`), so the answer travels with the row. The Google-Fonts share URL stays: it is how you *find* a font, not how you *deliver* it. |
| `stacks/nextjs.csv` row 22 | No change — it was already right. The contradiction is resolved by the other three, not by weakening this row. |
| `daf-webfont-delivery` (new fixture) | Defines "fixed" for the policy; cited by the owning section. |

## The reach problem — and why it does not need a new rule

The strongest objection to a guideline-owned policy is real and was raised
directly: `design-fidelity` only fires when a **provided design artifact**
exists, so a greenfield *"pick fonts for my new SaaS"* request — precisely the
`typography-system` path that emitted the hotlink — may never load the guideline
at all. A policy nobody loads is not a policy.

Fixing that inside the emitting skill (make the skill the owner) closes the
greenfield case but re-opens the original defect one layer down: the next
emitter of a third-party asset URL inherits nothing, and the three-way
assumption this ADR exists to end simply reappears with different participants.

Neither does it require a new always-loaded rule. An always-fires surface
already exists: `senior-engineering-discipline` fires on **any** turn that
writes code and routes to the `ai-code-blindspots` surface→controls table. A
third-party-asset-delivery entry in that table reaches every code-writing path,
greenfield included, at the cost of one table cell and **no new artifact** — so
the remove-don't-add budget is respected. The table entry is a *pointer to the
owner*, never a second copy of the policy; two copies of one policy is the
defect class this record closes.

## Consequences

- The default emitted deliverable changes: a self-hosted route replaces an
  `@import` hotlink. This is a **behaviour change on a documented skill output**
  and is the intended one.
- The documented 404-at-build-time failure mode narrows rather than vanishes.
  For a package route (`next/font`, `@fontsource/*`) resolution moves to install
  time, where it fails loudly. The remaining risk moves to a **family-name
  mismatch** (the CSS asks for a family the installed package does not provide),
  which fails silently at runtime exactly as the old 404 did. The hotlink
  opt-in keeps the original caveat verbatim; the self-hosted default carries
  the mismatch caveat instead.
- The corpus gains one column and loses nothing. No row is reordered, removed,
  or re-ranked — the corpus stays reference data.
- A T7 anti-pattern flag becomes machine-readable, so the cross-check in
  `design-intelligence` reads a field instead of relying on the model
  remembering a catalog. **15 of 73** rows carry a T7 font. The original report's
  headline example (row 2, Poppins + Open Sans) carries **none** — that half of
  the report is refuted and the correction is recorded here so it is not
  re-inherited.

## Alternatives considered

- **A — `typography-system` owns it** (dissent, claude-sonnet-4-5, round 2):
  the emitter fixes the emission, and it is the only artifact that loads in the
  greenfield case. Rejected because a skill is a consumer of policy by this
  package's own artifact-layer model; a second emitter inherits nothing.
  The dissent's substantive point — that documentation is not enforcement — is
  **accepted** and is why the reach pointer and the fixture exist rather than a
  procedure step that merely says "consult the guideline".
- **C — a new always-loaded asset-delivery rule** (dissent, gpt-4o, round 2):
  strongest enforcement, and correct that a compliance-relevant control should
  not rest on voluntary procedural adherence. Rejected on the remove-don't-add
  budget: it names nothing it replaces, and the enforcement it seeks is
  available through an existing always-fires surface at a fraction of the
  standing token cost.
- **Do nothing / treat as style.** Rejected: the exposure is a third-party data
  transmission a court has already ruled on, shipped as a default in 73 of 73
  corpus rows.

## Council

2 members, 2 rounds (`anthropic/claude-sonnet-4-5`, `openai/gpt-4o`), 2026-07-31,
actual cost $0.0931. Round 1: both converged on the guideline as owner. Round 2
(adversarial): the members split — one to the skill (A), one to a new rule (C),
for opposite reasons that share one premise, that a guideline cannot be reached
where it is needed. That premise is what the reach pointer answers, so the
round-1 convergence stands with the round-2 objection built in rather than
overruled. **No convergence in round 2** — this record is the arbitration, and
the dissent is preserved above rather than dropped.

## References

- `docs/guidelines/design-fidelity-mechanics.md` § Asset & imagery discipline — the owner.
- `src/skills/typography-system/SKILL.md` — the consumer whose output contract changed.
- `src/skills/ai-code-blindspots/SKILL.md` § Surface → invisible controls — the reach pointer.
- `src/skills/design-intelligence/data/font-pairings-reference.csv`, `data/stacks/nextjs.csv` — the corpus.
- `tests/design-artifacts/eval-fixtures.md` § `daf-webfont-delivery` — the definition of fixed.
- `docs/guidelines/design-antipatterns.md` § Typography T7 — the flagged-font catalog.
- `src/skills/design-system-capture/references/design-system-json.md` — the no-bundler lock this decision stays inside.
