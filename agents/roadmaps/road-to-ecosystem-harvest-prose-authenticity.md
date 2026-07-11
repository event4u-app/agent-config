---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Prose Authenticity

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Source cited source-anonymously (**I** = a prose anti-slop humanizer skill);
full provenance in the index § Provenance.

**Priority: P2.** The suite's slop rules cover *code* and *UI*; nothing owns a
**prose-level** AI-ism taxonomy for chat / docs / ghostwriter output. Clean,
well-researched gap.

## Goal

Extend the existing `humanizer` skill with a **severity-tiered AI-ism ban list**
and the "subtract, don't add" principle — without importing the source's
detector-evasion mode, which conflicts with the suite's AI-disclosure floors.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Placeholder / slop in *generated code* | Shipped | `output-discipline` rule |
| UI slop-trope detection | Shipped | design anti-slop detector cluster |
| Prose humanizing skill (exists, thin taxonomy) | Shipped (extend) | `src/skills/humanizer/` |
| Prose-level AI-ism ban list with severity tiers | **Gap** | none |

- [x] Reality check complete — extend `humanizer`; do NOT create a new skill.

## Phase 1 — Adopt-now plate (≤ 3 units)

- [ ] **U1 — Severity-tiered AI-ism taxonomy.** Add a `references/anti-aiisms.md` (or inline table) to `humanizer` with three tiers: **High** = almost always a tell (name the specific constructions), **Medium** = a tell in combination, **Low** = only when over-used. *Source I.* Verify: the skill can classify a sample paragraph's tells by tier.
- [ ] **U2 — "Subtract, don't add" principle.** Encode the core insight: AI tone is a *residue* to remove, not warmth to add — "adding warmth adds sycophancy, the loudest AI tell". Wire it to the suite's existing anti-flattery stance (`direct-answers` Iron Law 1). *Source I.* Verify: the principle is stated + cross-linked to `direct-answers`.
- [ ] **U3 — Intensity levels, evasion excluded.** Support graded intensity (subtle / balanced / full / voice-match) BUT **explicitly exclude** any detector-evasion / anti-detector mode — it conflicts with the media/disclosure transparency floors. *Source I, de-scoped.* Verify: the skill documents the exclusion and why.

## Council convergence (2026-07-11)

Not separately debated (low-risk, high-clarity single-surface extension); the
index-level council pass endorsed adopting the taxonomy and dropping the
evasion mode.

## Acceptance criteria

- [ ] `humanizer` carries the three-tier taxonomy + "subtract don't add" principle.
- [ ] Detector-evasion mode explicitly excluded with rationale.
- [ ] No new skill created (extension only).
- [ ] Dashboard regenerated.
