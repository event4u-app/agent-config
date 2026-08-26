---
complexity: lightweight
review_by: 2027-02-18
---

# Road to target-project bootstrap and enforcement — stub

> **Source:** `agents/tmp.old/robert-c-martin/road-to-target-project-bootstrap-enforce.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Class:** demand-gated successor of
> `road-to-target-project-assurance-readiness.md`. Promote only after that
> roadmap's Phase 1 matrix has run on the maintainer's real target repos and
> shows which dimensions are most often `Absent`. Verified against
> `e1fe45077cab`; proposals are marked.

## Defect this closes

AC can tell a user *"mutation testing is missing"* only once the parent
lands, and cannot help set it up at all: `stryker`, `infection`, `mutmut`,
`cosmic-ray`, `dependency-cruiser`, `deptrac`, `semgrep`, `bandit`,
`fast-check` return 0 files in `src/` at the pin. `quality-tools/SKILL.md:33-36`
has PHP and JS/TS mode bodies only — no Python body exists.

## Proposed loop — `detect → recommend → bootstrap → verify → enforce`

*Proposal.* Lives as mode bodies under `quality-tools/references/`, one per
stack, **not** as new skills (estate ratchet). `enforce` is planned before
`bootstrap` runs: a tool that does not block CI does not exist for an agent.

| Stack | Candidate set (to be re-verified for maintenance and diff-scope support at promotion time) |
|---|---|
| TS/React | Vitest or Jest · Playwright · StrykerJS `--incremental` + `coverageAnalysis: perTest` · `strict` · ESLint/Biome · dependency-cruiser · Semgrep · `pnpm audit` + lockfile · fast-check |
| PHP/Laravel | Pest/PHPUnit · Infection `--git-diff-lines` · PHPStan/Psalm max + baseline · Rector · Pest `arch()` or deptrac · `composer audit` |
| Python | pytest · Hypothesis · mutmut or cosmic-ray · pyright/mypy strict · ruff · bandit · pip-audit + lockfile |

Rules of the loop:
1. `verify` runs the generated config once and fails the bootstrap if the
   tool does not execute — a written config is not a capability.
2. Every gate lands as a **baseline ratchet** (existing violations frozen,
   growth blocks), never big-bang; this generalises the PHPStan policy at
   `quality-tools/references/php-tools.md:170-174` to every tool.
3. Mutation is **diff-scoped per PR** with a latency budget (R2 < 5 min),
   global mutation nightly only — consistent with the sibling roadmap's
   1.3 for AC's own suite.
4. `enforce` = CI job without `continue-on-error` + required status check;
   the parent's matrix must move the dimension from 1 to 2 after the run,
   and that movement is the acceptance test.

## Prerequisites for promotion

- Parent Phase 1 merged; matrix output over ≥ 3 real target repos archived
  under `agents/evidence/`.
- Estate offset available (`task check-estate-count` green with this file
  moved up).
- Tool maintenance status re-checked at promotion date; no tool adopted
  from this stub's table without a fresh check.

## Not in scope

Runtime/canary verification; multi-model review; any new skill.
