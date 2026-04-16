# Road to 10/10

Source: External scoring review — current score 8.8/10, target 9.5+/10.
Goal: Close last structural quality gaps without adding complexity bloat.

## Score Context

| Area | Current | Target | Phase |
|---|---|---|---|
| Skill quality (pointer-only risk) | 8.7 | 9.5 | 1 |
| Merge safety | ~8.5 | 9.5 | 2 |
| Optimize command safety | ~7.5 | 9.0 | 3 |
| Compression quality | unmeasured | 9.0 | 4 |
| Quality visibility | none | 9.0 | 5 |

---

## Phase 1: Pointer-only Skill Detection ✅ (partially done)

Problem: Skills can be structurally valid but useless if they just point to guidelines.

- [x] Linter: `guideline_dependent_skill` error (≥3 delegations, ≤1 action, <3 steps)
- [x] Linter: `pointer_only_skill` warning (≥2 delegations, ≤2 actions, <3 steps)
- [x] Initial scan: 0 existing skills flagged
- [ ] Update `skill-writing` SKILL.md: add independence as quality criterion
- [ ] Update `skill-reviewer` SKILL.md: add "pointer-only" to Skill Killers checklist
- [ ] Update `skill-management`: verify independence on every refactor
- [ ] Align reviewer skill and linter on same definition
- [ ] Test: for 10 skills, remove all guideline references — is Procedure still executable?

Definition of done: Pointer-only skills are automatically flagged. Skills work without guidelines.

---

## Phase 2: Merge Preservation Rule

Problem: Merges can reduce file count but also reduce quality — losing best examples,
strongest validation, and sharpest anti-patterns.

- [ ] Add merge-preservation check to `skill-quality` rule (uncompressed)
- [ ] Require for every merge:
  - Best example preserved from each source
  - Strongest validation preserved from each source
  - Strongest anti-pattern preserved from each source
  - Result still has ONE clear job (not umbrella)
- [ ] Add to `skill-reviewer`: merge quality gate (warn if result broader than either source)
- [ ] Add to linter: detect skills with >3 "When to use" triggers (breadth signal)

Definition of done: Merges reduce files, not sharpness. No umbrella skills emerge.

---

## Phase 3: Refactor optimize-* Commands

Problem: `optimize-skills` and `optimize-agents` can operate on wrong source,
conflict with linter, or accidentally weaken the system.

- [ ] Verify both commands operate ONLY on `.augment.uncompressed/`
- [ ] Add explicit guard: if command detects `.augment/` edits, abort with error
- [ ] Ensure commands are advisory-only (suggest, never auto-apply)
- [ ] Remove any logic that auto-weakens constraints
- [ ] Add safety checks:
  - NEVER suggest always→auto for core behavior rules
  - NEVER suggest merging skills that would create umbrella docs
  - NEVER suggest removing anti-patterns to reduce size
- [ ] Add: reference `rule-type-governance` for always/auto decisions
- [ ] Add: reference `size-and-scope` guideline for all size judgments

Definition of done: Commands cannot introduce regressions. Pure audit/report tools.

---

## Phase 4: Compression Quality Preservation

Problem: Compression optimizes for size, but can silently remove validation,
examples, and decision logic — weakening skills.

### 4.1 Manual preservation checklist (immediate)
- [ ] Add to `/compress` command: after each file, verify:
  - [ ] Concrete validation steps preserved (not weakened to "verify it works")
  - [ ] Best example preserved (not removed for brevity)
  - [ ] Strongest anti-pattern preserved (not softened)
  - [ ] Decision hints preserved (not generalized)

### 4.2 Automated preservation checks (follow-up)
- [ ] Linter: compare validation keywords between uncompressed and compressed (partially done)
- [ ] Linter: compare anti-pattern count between uncompressed and compressed
- [ ] Linter: flag compression >60% reduction as "review for content loss"
- [ ] Linter: flag compression <10% as "compression not effective"
- [ ] Script: `task check-compression-quality` target

Definition of done: "Shorter" never means "weaker". Compression preserves meaning.

---

## Phase 5: Quality Score / Review Report

Problem: Quality is enforced but not visible. Hard to spot trends or weak areas.

- [ ] Generate per-skill quality report with dimensions:
  - Structure: pass/fail (required sections present)
  - Validation: strong/weak (concrete checks vs vague)
  - Guideline dependency: low/medium/high (delegation count)
  - Scope: focused/broad (trigger count)
  - Compression risk: low/medium/high (reduction %)
- [ ] Output as JSON (machine-readable) and markdown (human-readable)
- [ ] Add `task quality-report` Taskfile target
- [ ] Optional: CI artifact upload for trend tracking
- [ ] Optional: dashboard/summary in PR description

Definition of done: Weak skills visible immediately. Quality trends trackable.

---

## Execution Order (ROI-optimized)

| Order | Phase | Effort | Impact | Status |
|---|---|---|---|---|
| 1 | Pointer-only detection | Low | 🔴 High | ✅ Linter done, docs pending |
| 2 | Merge preservation | Low | 🔴 High | Not started |
| 3 | Optimize command refactor | Medium | 🟡 Medium | Not started |
| 4 | Compression preservation | Medium | 🟡 Medium | Partially done (linter) |
| 5 | Quality score/report | Medium | 🟢 Nice-to-have | Not started |

---

## Target State

After this roadmap:

- Skills always executable without guidelines
- Merges/compressions never silently weaken content
- Optimize commands cannot break system integrity
- Weak areas are visible and trackable
- System improves itself safely over time

> Strong structure + strong enforcement + safe evolution = self-optimizing system
