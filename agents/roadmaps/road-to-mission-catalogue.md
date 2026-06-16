---
complexity: lightweight
status: ready
parent_roadmap: road-to-mission-mode
---

# Roadmap: Mission catalogue — content + catalogue expansion (mission-mode follow-up)

**Trigger:** Spun out of `road-to-mission-mode` at its Phase 1 council gate
(2026-06-15). That roadmap shipped the flagship **infrastructure** (Phase 0/1/2A:
no-runtime boundary, manifest + catalog schemas, `/mission:upgrade` command, a
minimal 5-entry proof catalog, `lint_missions.py`). The council deferred the
**content + catalogue** until the infrastructure is validated against a real
consumer Laravel repo. This roadmap carries that deferred work, each item
trigger-gated.

> **Blocked until:** the `/mission:upgrade` infrastructure is operationally
> validated on a live Laravel repo (the Phase 2B trigger). Until each trigger fires, items stay planned-but-blocked. This
> roadmap is `ready`; each item carries its own trigger.

## Phase 1 — Deferred-with-trigger content + catalogue (each item trigger-gated)

- [ ] **Phase 2B — full Laravel 10→11 breaking-change catalog.** Expand
      `src/missions/upgrade/laravel-10-to-11.yaml` from the 5-entry proof catalog
      to the complete set. **Trigger:** a consumer Laravel repo validates the 2A
      infrastructure end-to-end (the desk-checked schema proved expressive).
- [ ] **`/mission:phpstan-raise`** — raise Larastan/PHPStan level with fixes (not
      a baseline dump), reusing `quality-tools` + the PHP skills. **Trigger:**
      flagship `/mission:upgrade` proven on a real repo.
- [ ] **`/mission:n-plus-one-audit`** — Eloquent N+1 detection + eager-load fixes
      (reuse `eloquent`, `performance-analysis`). **Trigger:** as above.
- [ ] **`/mission:pest-migrate`** — PHPUnit → Pest incremental (reuse
      `pest-testing`). **Trigger:** as above.
- [ ] **`/mission:fat-controller-cleanup`** — extract controller logic to
      actions/services/requests (reuse `php-service`, `architecture-review-lens`).
      **Trigger:** as above.
- [ ] **`/mission:dead-code-removal`** — ADOPT Source-E's `refactor-clean`
      tiered/test-verified deletion loop (reuse `tech-debt-tracker`,
      `code-refactoring`); never deletes without test-green proof. **Trigger:** as above.
- [ ] **Stack-generic missions** (PHP-version upgrade, Symfony-component upgrade,
      Next.js/React contract audit). **Trigger:** the Laravel missions land + ≥ 2
      consumer requests for a non-Laravel mission.
- [ ] **Control-flow DSL for missions.** **Trigger:** ≥ 3 missions need
      branching/loops a linear manifest cannot express. Until then missions stay
      linear (the `/work` engine owns loop/retry within a phase).

## Acceptance criteria

- [ ] Each catalogue mission lands only after the flagship is operationally
      proven; each reuses existing skills (no new per-language agents —
      `persona-governance` + `framework-neutrality` hold).
- [ ] No daemon / cross-session persistent state introduced (the
      `no-runtime-boundary` contract holds for every mission).

## Provenance

- Parent: `road-to-mission-mode` (archived on completion of Phase 0/1/2A). Gate
  decision: `agents/evidence/analysis/mission-mode-phase1-gate.md` (council
  claude-sonnet-4-5 + gpt-4o, deep, peer-review, 2026-06-15 — ship 2A
  infrastructure, defer 2B + catalogue).
