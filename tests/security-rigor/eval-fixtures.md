# Security-Rigor Eval Fixtures — False-Positive Gate

Behavioral baseline for the false-positive / over-reporting gate folded into
[`security-audit`](../../src/skills/security-audit/SKILL.md) § 0,
[`bug-analyzer`](../../src/skills/bug-analyzer/SKILL.md) § Proactive mode 4, and
[`judge-bug-hunter`](../../src/skills/judge-bug-hunter/SKILL.md) § 4
(`road-to-ecosystem-harvest-bug-security-rigor` U1). Each fixture carries a
stable `id`, a scenario, and a pass criterion. Decidable parts are written as
checkable output-contract patterns; rubric parts are judged in PR review,
never by a hidden LLM judge (same scoring model as
`tests/design-artifacts/eval-fixtures.md` and
`tests/code-comments/eval-fixtures.md`).

## Decidable output-contract patterns

- **P1 rejected-candidates section** — a security-audit / proactive
  bug-analyzer report over code containing a negative fixture MUST include a
  `Rejected candidates` section.
- **P2 no-finding-for-benign** — the benign fixture below MUST NOT appear as
  a numbered/blocked finding (no Severity, no Fix entry for it); it appears
  only under `Rejected candidates`.
- **P3 traced reason** — the rejection line names the concrete reason the
  pattern is benign (the traced data-flow fact), not a bare "false positive".

## Fixtures

### fpg-static-sql-concat (negative — looks vulnerable, is benign)

- **scenario:** Audit a module containing this migration helper:

  ```php
  final class TenantTableSeeder
  {
      private const REGIONS = ['emea', 'apac', 'amer'];

      public function seedAll(Connection $db): void
      {
          foreach (self::REGIONS as $region) {
              // Table-per-region layout predates the ORM; names are compile-time constants.
              $db->statement('INSERT INTO stats_' . $region . ' (day, total) SELECT day, total FROM stats_staging');
          }
      }
  }
  ```

  String-concatenated SQL matches the SQL-injection pattern in
  `security-audit` § 3 — but every concatenated value is a compile-time
  class constant; no user input can reach the statement.

- **pass (decidable):** P1 + P2 + P3 hold — the report contains a
  `Rejected candidates` line for this pattern citing the constant-only data
  flow, and NO finding block (no Severity/Exploitability/Fix) for it.
- **pass (rubric):** the rejection reason traces the flow ("`$region` is
  drawn from `self::REGIONS`, a private compile-time constant; no external
  input reaches the statement") rather than asserting benignity by fiat.
- **fail:** the report emits an "SQL Injection" finding for this helper at
  any severity, or omits the pattern entirely (silent skip is not a traced
  rejection).

### sma-evidence-per-rating (decidable — scorecard rows must cite evidence)

- **scenario:** Run
  [`security-maturity-assessment`](../../src/skills/security-maturity-assessment/SKILL.md)
  on any sample module (e.g. a Laravel module with FormRequests, policies,
  and a seeder).
- **pass (decidable):** every scorecard row matches
  `\|\s*(Missing|Weak|Moderate|Satisfactory|Strong|N/A)\s*\|` AND carries in
  its Evidence cell either a `\S+:\d+` file:line citation or a named empty
  search ("grep `hardcoded|password=` — 0 hits"); the Overall line shows the
  roll-up (`median=`, `lowest critical=`) rather than a bare verdict.
- **fail:** any rated row with an empty/prose-only Evidence cell, or an
  Overall rating that exceeds one step above the lowest critical category.

### fpg-severity-devil-advocate (rubric — severity must survive refutation)

- **scenario:** A diff adds `$user->update($request->validated())` in a
  controller whose FormRequest whitelists exactly three profile fields. A
  naive pass flags "mass assignment — Critical".
- **pass (rubric):** the finding is either rejected (validated() output is
  bounded by the FormRequest rules — trace it) or downgraded with the
  devil's-advocate pass documented; a surviving Critical must name the
  concrete unvalidated path.
- **fail:** a Critical mass-assignment finding with no refutation attempt
  documented.
