---
status: complete
complexity: lightweight
---

# Road to Rule Governance & Budget Discipline

**Status:** ✅ COMPLETE — landed 2026-05-19 on branch
`refactor/framework-neutrality-audit` across 8 atomic commits
(`c246a8cf` … `43191ae8`).
**Trigger:** Augment workspace-guidelines budget hit
**99.98 % utilisation (49,503 / 49,512 chars)** mid-way through the
`framework-neutrality-audit` roadmap. Phase 0 of that roadmap (new
Tier-2 rule + linter) could not begin without ≥ 1 kB of headroom.
The `framework-neutrality-audit.md` plan had no provision for budget
headroom recovery — this prerequisite intervention closed that gap.
**Mode:** Lightweight, out-of-band prerequisite. Sibling to the
in-flight `framework-neutrality-audit.md`. No PR coupling.

## Purpose

Recover Augment-budget headroom **structurally** (not by trimming
prose) so Phase 0 of the framework-neutrality audit can land its new
Tier-2 rule, and leave behind a **standing discipline gate** that
prevents regression to the same emergency.

Deliverables:

1. A `rule-refactor` skill that owns rule-audit, merge, demote, and
   promote workflows.
2. A **Budget-Discipline-Gate** wired into `rule-writing` and
   `scripts/measure_augment_budget.py`: any new rule above 95 %
   utilisation (47,036 / 49,512 chars) must demonstrate net-neutral
   or negative budget delta before landing.
3. **−4,690 chars** of headroom by merging 19 redundant /
   sector-specific rules into 5 high-density discipline rules.

## Out of scope

- No PHP/Laravel leakage cleanup — that is `framework-neutrality-audit.md`.
- No prose trimming on individual rules (`user-interrupt-priority.md`
  edits stayed unstaged).
- No relocation of misclassified carve-outs
  (`dto-creator`, `migration-creator`, `websocket` deliberately
  excluded from this branch).
- No new dependencies, scripts, or CI gates beyond the existing
  `measure_augment_budget.py` script.

## Phases

### Phase 1 — Tooling (1 commit)

- [x] **1.1** Add `rule-refactor` skill (audit pipeline:
      `task-completed-rule-promotion`, merge / delete / move-to-context
      / promote-to-skill verdict per rule).
- [x] **1.2** Document `BUDGET_FAIL_THRESHOLD = 0.95` and the
      Budget-Discipline-Gate in `rule-writing` skill + in
      `scripts/measure_augment_budget.py`.
- [x] **1.3** Commit `c246a8cf feat(skills): rule-refactor — Budget-Discipline-Gate workflow`.

### Phase 2 — Tier-A merges (3 commits)

> Consolidate routing-stub rules that all referenced the same target.

- [x] **2.1** Merge augment routing stubs → `augment-edit-discipline.md`.
      Commit `f0d1b3c0 refactor(rules): consolidate augment routing stubs into augment-edit-discipline`.
- [x] **2.2** Merge git-rewrite stubs → `git-history-discipline.md`.
      Commit `3633e0d9 refactor(rules): consolidate git rewrite rules into git-history-discipline`.
- [x] **2.3** Drop remaining routing stubs whose target consolidation
      made them redundant. Commit `906d99ab refactor(rules): drop redundant routing stubs`.

### Phase 3 — Tier-B merges (3 commits)

> Collapse vertical / sector-specific domain-safety rules into single
> high-density discipline rules.

- [x] **3.1** 4 × `domain-safety-disclaimer-*` → `domain-safety-disclaimer.md`.
      Commit `b0dc78fd refactor(rules): merge 4 domain-safety-disclaimer-* into one`.
- [x] **3.2** 6 × PII rules → `domain-safety-pii.md`.
      Commit `64f263a2 refactor(rules): merge 6 PII rules into one domain-safety-pii`.
- [x] **3.3** 2 × `domain-safety-retention-*` → `domain-safety-retention.md`.
      Commit `2c3f3af4 refactor(rules): merge 2 domain-safety-retention-* into one`.

### Phase 4 — Sync & verify (1 commit)

- [x] **4.1** Update all cross-refs across skills, commands, contexts,
      templates pointing at the merged targets.
- [x] **4.2** Regenerate `.agent-src/` projected layer + refresh
      `.compression-hashes.json`.
- [x] **4.3** Re-run `auto-rules-{audit,likelihood,overlap}.{json,md}`
      reports.
- [x] **4.4** Commit `43191ae8 chore(compress): update cross-refs and refresh projected layer`.

## Acceptance criteria

- [x] `python3 scripts/measure_augment_budget.py` ≤ 95 % utilisation
      (measured: **90.5 %, 44,813 / 49,512 chars**, 4,699 char headroom).
- [x] `python3 scripts/compress.py --check` → in sync.
- [x] `task lint-skills` green at marketplace.json sync.
- [x] Auto-stub count: 72 → **53** (−19).
- [x] No prose edit to any rule (changes are structural merges only).
- [x] No out-of-scope artefact touched
      (`user-interrupt-priority.md` left unstaged, Laravel skills
      `dto-creator` / `migration-creator` / `websocket` excluded).

## Outcomes & follow-ups

- **Headroom unlocked:** 4,690 chars (≈ 9.5 % of total budget) — ample
  room for the Phase 0 Tier-2 rule of `framework-neutrality-audit.md`.
- **Standing gate:** `rule-refactor` skill + Budget-Discipline-Gate
  remain as ongoing tooling; future rule additions touching ≥ 95 %
  utilisation route through the gate automatically.
- **No follow-up issues filed** — the intervention is self-contained.
  The decoupled `framework-neutrality-audit.md` roadmap resumes its
  own 0 / 207 progress without dependency on further governance work.

## References

- [`framework-neutrality-audit.md`](../framework-neutrality-audit.md) — sibling roadmap whose budget exhaustion triggered this intervention
- [`rules/architecture.md`](../../../.agent-src.uncompressed/rules/architecture.md) — package architecture, carve-out pattern
- [`skills/rule-refactor/SKILL.md`](../../../.agent-src.uncompressed/skills/rule-refactor/SKILL.md) — new audit pipeline
- [`skills/rule-writing/SKILL.md`](../../../.agent-src.uncompressed/skills/rule-writing/SKILL.md) — Budget-Discipline-Gate definition
- [`scripts/measure_augment_budget.py`](../../../scripts/measure_augment_budget.py) — budget measurement + threshold
