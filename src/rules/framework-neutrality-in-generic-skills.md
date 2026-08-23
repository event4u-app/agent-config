---
type: "auto"
tier: "2a"
description: "Editing a generic skill/rule/command — no single-stack mandates; carve-out pointers instead"
triggers:
  - path_prefix: "src/skills/"
  - path_prefix: "src/rules/"
  - path_prefix: "src/agent-src/commands/"
  - keyword: "FormRequest"
  - keyword: "PHPStan"
  - keyword: "php artisan"
  - keyword: "composer.json"
  - keyword: "Eloquent"
  - keyword: "Pest"
  - keyword: "Blade"
  - keyword: "vendor/bin"
  - keyword: "Artisan"
  - keyword: "Rector"
  - phrase: "every controller"
  - phrase: "all controllers"
  - phrase: "generic skill"
applies_to_user_types:
  - "maintainer"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule's subject is generic artifacts under .agent-src.uncondensed/; every body link points there by design."
  - type: "substring"
    pattern: "scripts/lint_framework_leakage"
    reason: "Rule cites the enforcing linter script by name in body and enforcement section."
routes_to:
  - "guideline:agent-infra/framework-neutrality-patterns"
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/lint_framework_leakage.ts"
collision_ok:
  "src/skills/": "generic skills must not mandate a stack — fires on skill edits"
  "src/rules/": "rule edits are checked for framework leakage"
  "src/agent-src/commands/": "command edits are checked for framework leakage"
  "artisan": "artisan named in a generic artifact is leakage — the lint surface"
  "eloquent": "eloquent named in a generic artifact is leakage — the lint surface"
  "formrequest": "FormRequest named in a generic artifact is leakage — the lint surface"
  "phpstan": "phpstan named in a generic artifact is leakage — the lint surface"
  "rector": "rector named in a generic artifact is leakage — the lint surface"
# obligation: line 65
obligation_frequency: "per-edit"
---

# framework-neutrality-in-generic-skills

## The Iron Law

```
NO GENERIC ARTIFACT MAY MANDATE A SPECIFIC FRAMEWORK.
SPECIFICS BELONG IN CARVE-OUT ARTIFACTS (laravel-*, symfony-*,
nextjs-*, pest-*, eloquent, quality-tools).
```

A generic skill, rule, or command names a *procedure* — what to do.
A carve-out artifact names a *stack* — how that procedure looks in
Laravel, Next.js, Pest, etc. Mixing the two leaks framework assumptions
into surfaces the agent must trigger on regardless of project stack.

## Scope

This rule fires on edits under `src/skills/`, `src/rules/`, and
`src/agent-src/commands/`.

**Exempt** (file or directory name matches — these are correctly
framework-specific): `laravel*`, `symfony*`, `nextjs*`, `react-*`,
`^php-*`, `^pest-*`, `^eloquent`, `^blade*`, `^livewire`, `^flux`,
`^artisan-*`, `^composer-*`, `^docker*`, `^aws-*`, `^grafana`,
`^openapi$`, `^quality-tools`, `^sql-writing`, `^tailwind*`,
`^terraform*`, `^terragrunt*`, `^traefik`, `^mobile-e2e`, `^monorepo-workspace$`, `^workspace-link$`,
`-routing$`, `project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)`.

## The discipline in one breath

Framework names in a generic artifact appear only as **multi-stack peers**
(≥ 2 ecosystems side-by-side — documentation, not leakage) or as a one-line
**carve-out pointer** to the framework-specific artifact — never as the
mandated procedure. `scripts/lint_framework_leakage.ts` is the deterministic
CI backstop (exit 1 on a non-allowlisted hit in a generic artifact).

Body migrated to [`guideline:agent-infra/framework-neutrality-patterns`](../docs/guidelines/agent-infra/framework-neutrality-patterns.md) (per P4 of `road-to-kernel-and-router.md`) — the 10-row forbidden-pattern table with fixes, the cross-stack documentation allowance + auto-detect heuristic, the carve-out pointer shape, and the linter exit-code contract.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`roadmap-ci-steps-policy`](roadmap-ci-steps-policy.md) — sibling
  Tier-2a rule that drove this pattern.
- [`skill-quality`](skill-quality.md) — every skill must remain
  executable; carve-outs must still pass skill-quality.
- [`scope-control`](scope-control.md) — neutralizing a skill is not
  a refactor pretext; only touch the leaking sentences.
