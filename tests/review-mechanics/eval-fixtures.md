# Review-Mechanics Eval Fixtures

Behavioral baseline for the review-surface upgrades folded into
[`code-review`](../../src/skills/code-review/SKILL.md) and its
`checklists/` (`road-to-ecosystem-harvest-review-mechanics`). Decidable parts
are checkable output-contract patterns; rubric parts are judged in PR review,
never by a hidden LLM judge (same scoring model as
`tests/security-rigor/eval-fixtures.md` and
`tests/code-comments/eval-fixtures.md`).

## Decidable output-contract patterns

- **P1 two-tier output** — a review over a non-trivial diff emits a `Tier 1`
  (mechanical) and a `Tier 2` (alignment) heading, plus a `Verdict:` line whose
  value is one of `YES` / `NOT-SURE` / `NO`.
- **P2 dropped-FP section** — the review contains a `Dropped false positives`
  section (collapsible `<details>` allowed); presence is mandatory even when empty.
- **P3 coverage line** — a `Coverage:` line names deep-reviewed vs skimmed files
  + a confidence value.

## Fixtures

### rm-planted-false-positive (dropped section, with reason)

- **scenario:** Review a diff containing this Laravel controller line, where a
  bot/naive pass flags "SQL injection":

  ```php
  // $sort is validated to an enum by the FormRequest; not user-free-text
  $query->orderBy($request->validated()['sort'], 'asc');
  ```

  The `sort` value is whitelisted by the FormRequest rules to a fixed enum, so
  it cannot carry injection.

- **pass (decidable):** the finding appears under `Dropped false positives`
  with a traced reason (mentions the FormRequest/enum whitelist), NOT as a
  Tier-1 Blocker; P1+P2 hold.
- **pass (rubric):** the reason traces why the value is bounded (validated enum
  from the FormRequest), rather than asserting benignity by fiat.
- **fail:** an "SQL injection" Tier-1 Blocker for this line, or the dropped
  candidate omitted entirely (silent drop is not a traced rejection).

### rm-adr-conflict (Tier-2 flag naming the ADR)

- **scenario:** A repo ships `docs/decisions/ADR-050-workspace-vs-package-root-boundary.md`
  (accepted). A diff adds a new file under the package root that the ADR
  reserves for the workspace boundary.
- **pass (decidable):** the review emits a `Tier 2` flag whose text names
  `ADR-050` and states the conflict ("either the change or the ADR must move");
  it is NOT filed as a mechanical Tier-1 fix.
- **fail:** the ADR conflict is missed, or filed as a Tier-1 mechanical finding
  without naming the ADR.

### rm-dependency-expedited (change-type routing)

- **scenario:** A diff touches ONLY `composer.lock` (a patch bump).
- **pass (decidable):** the review loads the **dependency** checklist
  (expedited) — package-real / pinned+locked / CVE-delta / breaking-change —
  and does NOT run the full backend security+architecture tables.
- **fail:** the review applies the full backend checklist to a pure lockfile
  bump, or downgrades a mixed code+lockfile diff to dependency-only.
