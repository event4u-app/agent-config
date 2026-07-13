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

- [x] **U1 — Severity-tiered AI-ism taxonomy.** Add a `references/anti-aiisms.md` (or inline table) to `humanizer` with three tiers: **High** = almost always a tell (name the specific constructions), **Medium** = a tell in combination, **Low** = only when over-used. *Source I.* Verify: the skill can classify a sample paragraph's tells by tier.
- [x] **U2 — "Subtract, don't add" + style/stance separation.** Encode two principles: (a) AI tone is a *residue* to remove, not warmth to add — "adding warmth adds sycophancy, the loudest AI tell" (wire to `direct-answers` Iron Law 1); (b) **style and stance are separate** — a request for a humanized voice is not a request for agreement, so preserve disagreement, uncertainty, and refusals regardless of style level (wire to the challenge-to-improve stance). *Source I.* Verify: both principles stated + cross-linked; a fixture where humanizing would soften a refusal keeps the refusal.
- [x] **U3 — Intensity levels, evasion + ML-detector excluded.** Support graded intensity (subtle / balanced / full / voice-match) BUT **explicitly exclude** any detector-evasion / anti-detector mode and any shipped ML-detector dependency — both conflict with the media/disclosure transparency floors and the no-runtime-dependency constraint. Keep only the *loop shape* (score → rewrite → re-score with an audit trail + graceful degradation) as an **optional bring-your-own-checker** paragraph — never ship a detector. *Source I, de-scoped.* Verify: the skill documents the exclusions and the BYO-only stance + why.
- [x] **U4 — Deterministic self-validation + factual-integrity guard.** After a rewrite, run a deterministic self-check pass with concrete checkable bounds (e.g. em-dash cap per paragraph, per-paragraph short/long sentence spread, merge uniform-shape bullets, hedging-stack + stock-vocab scans) — did the rewrite clear the flagged tells without introducing new ones? Move the lexical lists + thresholds to an **on-demand `references/` file** (token discipline; SKILL body stays lean), each threshold carrying its source citation and marked **default, not a suite measurement**. Where the rewrite touched factual content, emit a `[VERIFY: original → rewritten]` flag (a humanizing pass must never silently alter a number/date/name/claim). Add a long-context **drift re-anchor** step (re-state the active style ruleset before finishing a long rewrite; evaluate whether `context-hygiene` is the better owner). *Source I (defensive only).* Verify: a fixture with seeded violations is cleared and listed in the audit; a rewrite that would drop a fact emits `[VERIFY:]`; a re-run over clean prose is a no-op.
- [ ] **U6 — Linter fold (repo prose artefacts only).** BLOCKED (decision-revisit-gate) — awaiting maintainer decision. The mandated rule-ownership dedupe finds BOTH proposed checks are already-owned by a deliberate lock over `docs/**`: (a) **em-dash density** is the council-locked house style (2026-07-11, recorded on `detect_ai_tells.ts` § SCOPE + `road-to-humanized-writing`) — wiring it over docs re-litigates that lock; (b) **uniform-bullet shape** measures **4371 `- **X:** …` lines across 115 docs files** — a gate there is a noise machine + the >20-entry allowlist antipattern (`autonomous-execution`). The deterministic prose-tell surface already exists correctly scoped to **deliverables** (`detect_ai_tells.ts`), not repo docs. Neither check is a genuine net-positive over `docs/**` without re-opening the lock. Surfaced for the maintainer: re-evaluate the lock in council, permanently close U6, or scope a narrower non-conflicting check. *Source I.* <!-- blocked: decision-revisit-gate — em-dash lock (council 2026-07-11) + uniform-bullet is house style (4371 lines); detect_ai_tells owns the deliverable surface -->
- [x] **U5 — Six-signal voice-match.** When matching a supplied voice sample, extract a small fixed signal set (sentence-length rhythm, vocabulary register, punctuation habits, hedging density, structural cadence, idiom) and match against it — not a vibe. *Source I.* Verify: two distinct voice samples produce measurably different match targets.

## Council convergence (2026-07-11)

Not separately debated (low-risk, high-clarity single-surface extension); the
index-level council pass endorsed adopting the taxonomy and dropping the
evasion mode.

## Acceptance criteria

- [x] `humanizer` carries the three-tier taxonomy + "subtract don't add" principle.
- [x] Detector-evasion mode explicitly excluded with rationale.
- [x] No new skill created (extension only).
- [x] Dashboard regenerated.
