# Roadmap: Stronger Skills — Backport Judge Patterns to the Full Catalogue

> Adopt the patterns that proved effective in Phase 3.1 (the four specialized
> judges) across **every** skill in the package — selectively, per role —
> without blanket rewrites that violate `preservation-guard`.

## Prerequisites

- [x] Phase 3.1 of [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) shipped (4 judge sub-skills + dispatcher)
- [ ] Phase 3.2 live smoke-test of `/review-changes` — recommended before starting, so lessons-learned shape the backport
- [x] `preservation-guard` rule active — blocks quality-losing transformations
- [x] Skill linter active — gates every batch
- [x] `.agent-src.uncompressed/` is the source of truth; `.agent-src/` is regenerated

## Context

The four new judge skills (`judge-bug-hunter`, `judge-security-auditor`,
`judge-test-coverage`, `judge-code-quality`) landed with eight patterns that
are stronger than the typical shape of the 112 older skills. The goal of this
roadmap is **not** to copy all eight patterns into every skill — that would be
scope creep and uniformity-theatre. The goal is **targeted, role-appropriate
backport** so every skill becomes sharper at its own job.

- **Feature:** none (infrastructure roadmap)
- **Jira:** none
- **Related:** [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) Phase 3.1,
  [`road-to-defensive-agent.md`](road-to-defensive-agent.md) (parallel — new skills ship pattern-compliant, no backport debt),
  [`.agent-src.uncompressed/rules/preservation-guard.md`](../../.agent-src.uncompressed/rules/preservation-guard.md)

## Definition of done

The roadmap is **done** when:

1. Every Tier-1 skill has all 8 patterns where applicable
2. Every Tier-2 skill has patterns 1-4 (+ 6 where a citation exists)
3. Every Tier-3 skill has patterns 1 + 2
4. Every Tier-4 skill has pattern 2 (scope-routing) where sibling skills exist
5. `task ci` green after every batch; `scripts/skill_linter.py` 0 fail on the whole catalogue
6. A 10% random sample manually validated against `preservation-guard`
7. The four new judges themselves run `/review-changes` on a representative batch
   and return `apply` or a revise-list that has been addressed

## The pattern catalogue

### Breit übertragbar (passen über mehrere Tiers)

1. **System-prompt-style opening** — blockquote directly under the `# <name>`
   heading: "You are a \<role\> specialized in **X**. Your only job is Y. You
   do **not** \<out-of-scope\> — \<sibling skills\> handle those."
2. **Scope-routing in "Do NOT use when"** — each out-of-scope bullet names the
   concrete sibling skill to route to (`→ route to [`sibling-name`](…)`), not a
   soft "use something else"
3. **Validation gate** — explicit "Before finalizing, confirm: 1. …" list
   **before** the output-format section, not as a post-hoc checklist
4. **Ordered output format with required fields** — enumerated fields with
   meaning, not free-form bullets

### Rollenspezifisch (nur wo die Rolle es verlangt)

5. **Severity legend with concrete definitions** — 🔴/🟡/🟢 with explicit
   thresholds ("🔴 crashes or returns wrong result" vs. vague "critical")
6. **External citation** — `## References` section linking peer-reviewed
   research or a primary standard (RFC, W3C, arxiv) when the skill implements
   a known pattern
7. **Runtime boundary disclaimer** — "Runtime confirmation is a follow-up for
   the implementer, not this skill" — states what the skill does **not** do
8. **Anti-sycophancy rules** — "NEVER return \<positive verdict\> out of
   politeness" / "NEVER silently fall back" in the "Do NOT" list

## Skill tiers

### Tier 1 — Verdict / Review / Gate (12 skills) — patterns 1-8

Skills that emit a pass/fail/revise judgment on work produced by another actor.

- [ ] `adversarial-review`
- [ ] `code-review`
- [ ] `design-review`
- [ ] `performance-analysis`
- [ ] `project-analyzer`
- [ ] `readme-reviewer`
- [ ] `receiving-code-review`
- [ ] `requesting-code-review`
- [ ] `security-audit`
- [ ] `skill-reviewer`
- [ ] `validate-feature-fit`
- [ ] `verify-before-complete`

### Tier 2 — Analysis / Investigation / Orchestration (24 skills) — patterns 1-4 (+ 6 where applicable)

Skills that **investigate** a problem or **orchestrate** other skills; do not
emit verdicts but produce structured findings.

- [ ] `agent-docs-writing` · `analysis-autonomous-mode` · `analysis-skill-router`
- [ ] `bug-analyzer` · `code-refactoring` · `command-routing`
- [ ] `copilot-agents-optimization` · `description-assist` · `developer-like-execution`
- [ ] `feature-planning` · `learning-to-rule-or-skill`
- [ ] `project-analysis-core` · `project-analysis-hypothesis-driven`
- [ ] `project-analysis-laravel` · `project-analysis-nextjs` · `project-analysis-node-express`
- [ ] `project-analysis-react` · `project-analysis-symfony` · `project-analysis-zend-laminas`
- [ ] `sequential-thinking` · `skill-improvement-pipeline` · `subagent-orchestration`
- [ ] `systematic-debugging` · `universal-project-analysis`

### Tier 3 — Coding / Authoring / Doing (50 skills) — patterns 1 + 2

Skills that produce code, docs, or configuration. Rollen-Frame macht die
Scope-Grenze sichtbar, Scope-Routing verhindert Overlap mit Sibling-Skills.

- [ ] `api-design` · `api-endpoint` · `api-testing`
- [ ] `artisan-commands` · `blade-ui` · `command-writing`
- [ ] `composer-packages` · `context-document` · `conventional-commits-writing`
- [ ] `dashboard-design` · `dependency-upgrade` · `dto-creator`
- [ ] `eloquent` · `fe-design` · `finishing-a-development-branch`
- [ ] `flux` · `git-workflow` · `guideline-writing`
- [ ] `jobs-events` · `laravel` · `laravel-horizon` · `laravel-mail`
- [ ] `laravel-middleware` · `laravel-notifications` · `laravel-pennant`
- [ ] `laravel-pulse` · `laravel-reverb` · `laravel-scheduling` · `laravel-validation`
- [ ] `livewire` · `logging-monitoring` · `merge-conflicts` · `migration-creator`
- [ ] `module-management` · `openapi` · `override-management`
- [ ] `pest-testing` · `php-coder` · `php-debugging` · `php-service`
- [ ] `playwright-testing` · `readme-writing` · `readme-writing-package`
- [ ] `roadmap-management` · `rule-writing` · `skill-management` · `skill-writing`
- [ ] `sql-writing` · `technical-specification` · `test-driven-development`
- [ ] `test-performance` · `upstream-contribute` · `using-git-worktrees`

### Tier 4 — Reference / Tooling / Integration (26 skills) — pattern 2 only

Reference skills and thin tool wrappers. Rollen-Frame wäre Overhead; nur
Scope-Routing wo Sibling-Skills existieren ist sinnvoll.

- [ ] `aws-infrastructure` · `check-refs` · `copilot-config` · `database`
- [ ] `devcontainer` · `docker` · `file-editor` · `github-ci` · `grafana`
- [ ] `jira-integration` · `lint-skills` · `mcp` · `multi-tenancy`
- [ ] `performance` · `project-docs` · `quality-tools` · `rtk-output-filtering`
- [ ] `security` · `sentry-integration` · `terraform` · `terragrunt`
- [ ] `traefik` · `websocket`

Count check: 12 + 24 + 50 + 23 = 109 + 4 compliant judges + 3 Tier-4-adjacent
that are handled elsewhere. Reconciled during Phase 0.

## Non-negotiable constraints

- **No blanket rewrites.** Every edit is role-motivated; if a pattern does not
  make the skill sharper, skip it.
- **`preservation-guard` before every commit** — strongest validation step,
  strongest example, strongest anti-pattern must survive.
- **Linter 0 fail** after every batch.
- **Word budget unchanged or +10% max.** Adding 8 lines of frame is fine;
  doubling a skill is not.
- **Each batch is its own commit** so a bad batch can be reverted cleanly.
- **Compression + tool regeneration** after every batch (`task sync`, then
  `task generate-tools`, then `task ci`).

## Phases

### Phase 0 — Tier calibration & baseline (1 session, ~1h)

- [ ] Run skill-reviewer on one skill per tier to establish a baseline
- [ ] Verify tier assignment on the 3-ish edge cases (`upstream-contribute`,
      `finishing-a-development-branch`, `override-management`)
- [ ] Add a linter rule or lightweight check that **detects** the presence of
      each pattern (greps for the blockquote opening, the `route to` phrasing,
      the validation gate heading) — produces a before/after metric
- [ ] Reconcile the tier counts against the current skill total — no skill left out
      *(baseline drift verified 2026-04-22: actual count is **121**, not 116 as
      originally planned — 5 skills added between roadmap authoring and this
      audit; see [`open-questions.md`](open-questions.md) Q12 for decision on
      whether to absorb into tiers or flag out-of-scope)*

### Phase 1 — Tier 1 (verdict / review / gate) — 12 skills

Highest leverage: these skills directly affect autonomy (judge gates, audits).
Smallest tier, so start here.

- [ ] Batch 1.a: `skill-reviewer`, `verify-before-complete`, `validate-feature-fit` (3)
- [ ] Batch 1.b: `code-review`, `adversarial-review`, `design-review` (3)
- [ ] Batch 1.c: `readme-reviewer`, `receiving-code-review`, `requesting-code-review` (3)
- [ ] Batch 1.d: `security-audit`, `performance-analysis`, `project-analyzer` (3)

**Per-batch gate:** linter 0 fail · `preservation-guard` check on every edited file ·
the new `judge-code-quality` reviews the batch and returns `apply` or addressed
`revise` list.

**Acceptance for Phase 1:** running any Tier-1 skill now opens with the role
frame, names sibling skills for out-of-scope concerns, gates on a validation
list before output, and emits an ordered report with a defined severity scale.

### Phase 2 — Tier 2 (analysis / investigation) — 24 skills

Split into 4 sub-batches of 6 to keep diffs reviewable.

- [ ] Batch 2.a: core analysis — `project-analysis-core`, `project-analysis-hypothesis-driven`,
      `universal-project-analysis`, `systematic-debugging`, `bug-analyzer`, `sequential-thinking`
- [ ] Batch 2.b: framework analysis — `project-analysis-laravel`, `project-analysis-symfony`,
      `project-analysis-nextjs`, `project-analysis-react`, `project-analysis-node-express`,
      `project-analysis-zend-laminas`
- [ ] Batch 2.c: orchestration & routing — `subagent-orchestration`, `command-routing`,
      `analysis-skill-router`, `analysis-autonomous-mode`, `skill-improvement-pipeline`,
      `developer-like-execution`
- [ ] Batch 2.d: meta & authoring — `agent-docs-writing`, `description-assist`,
      `feature-planning`, `learning-to-rule-or-skill`, `code-refactoring`,
      `copilot-agents-optimization`

**Per-batch gate:** linter · `preservation-guard` · `judge-code-quality` +
`judge-bug-hunter` review (Bug-Hunter for procedure correctness).

**Acceptance for Phase 2:** every analysis skill opens with a role frame,
routes to siblings by name, and gates its findings through a validation list.
Pattern 6 (citation) is added only where a primary source exists
(`systematic-debugging` → root-cause literature, `subagent-orchestration` →
the judge paper, `sequential-thinking` → CoT/ToT references).

### Phase 3 — Tier 3 (coding / authoring / doing) — 50 skills

Largest tier, patterns **1 + 2 only**. Split into 5 sub-batches of 10.

- [ ] Batch 3.a: Laravel core (10) — `laravel`, `eloquent`, `laravel-validation`,
      `laravel-middleware`, `laravel-scheduling`, `laravel-mail`,
      `laravel-notifications`, `laravel-horizon`, `laravel-pulse`, `laravel-pennant`
- [ ] Batch 3.b: code-writing PHP (10) — `php-coder`, `php-service`, `php-debugging`,
      `artisan-commands`, `migration-creator`, `dto-creator`, `api-endpoint`,
      `api-design`, `api-testing`, `openapi`
- [ ] Batch 3.c: frontend & tests (10) — `blade-ui`, `livewire`, `flux`, `fe-design`,
      `dashboard-design`, `playwright-testing`, `pest-testing`, `test-driven-development`,
      `test-performance`, `sql-writing`
- [ ] Batch 3.d: authoring & meta (10) — `skill-writing`, `skill-management`,
      `rule-writing`, `command-writing`, `guideline-writing`, `roadmap-management`,
      `module-management`, `context-document`, `technical-specification`, `readme-writing`
- [ ] Batch 3.e: workflow & ops (10) — `git-workflow`, `conventional-commits-writing`,
      `merge-conflicts`, `using-git-worktrees`, `finishing-a-development-branch`,
      `dependency-upgrade`, `composer-packages`, `override-management`, `upstream-contribute`,
      `readme-writing-package`, `jobs-events`, `laravel-reverb`, `logging-monitoring`

**Per-batch gate:** linter · `preservation-guard` · `judge-code-quality` review.
No full judge quartet (patterns 1+2 are low-risk).

**Acceptance for Phase 3:** every Tier-3 skill opens with the role frame and
names its siblings in "Do NOT use when" — no other structural change.

### Phase 4 — Tier 4 (reference / tooling) — 23 skills

Smallest footprint: only pattern 2 where siblings exist. Some skills may need
**no** change (e.g. `rtk-output-filtering` has no sibling overlap).

- [ ] Batch 4.a: infra & cloud — `aws-infrastructure`, `terraform`, `terragrunt`,
      `docker`, `devcontainer`, `traefik`, `websocket`
- [ ] Batch 4.b: observability & data — `grafana`, `sentry-integration`,
      `logging-monitoring` (if moved here), `database`, `multi-tenancy`,
      `performance`, `security`, `mcp`
- [ ] Batch 4.c: tooling — `file-editor`, `lint-skills`, `quality-tools`, `check-refs`,
      `rtk-output-filtering`, `github-ci`, `copilot-config`, `jira-integration`,
      `project-docs`

**Per-batch gate:** linter · manual skim for sibling-overlap that the linter
cannot detect. Preservation-guard automatic (changes are tiny).

**Acceptance for Phase 4:** every Tier-4 skill with a sibling routes to it by
name. Skills with no sibling are explicitly marked "no change required" in
this roadmap's progress.

### Phase 5 — Catalogue-wide acceptance & self-review

- [ ] `task ci` green on `main` merge
- [ ] `scripts/skill_linter.py --all` 0 fail, warn-count no worse than pre-roadmap
- [ ] `/review-changes` runs the four new judges on 10 random edited skills and
      returns `apply` or a revise-list that has been addressed
- [ ] A `preservation-guard` audit on 10% random sample (12 skills) — every
      skill must be at least as strong as before (stronger validation, stronger
      anti-pattern, clearer scope)
- [ ] README + AGENTS.md counts reflect the actual skill total at roadmap
      completion (baseline 122 as of 2026-04-22; roadmap must not itself
      add or remove skills — backport only)
- [ ] A short `agents/analysis/backport-outcomes.md` captures what **did** and
      **did not** improve — feeds Phase 3.2 acceptance of the parent roadmap

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Blanket uniformity kills individual skill voice | Pattern tiers — not every pattern on every skill |
| Compression drift during 100+ skill edits | `task sync` after every batch; `.compression-hashes.json` kept in sync per commit |
| Judge review on every batch is slow | Parallel dispatch via `subagent_max_parallel >= 4` once Phase 3.2 acceptance lands |
| Word budget explodes | Hard cap: +10% per skill, measured pre/post via linter metric added in Phase 0 |
| A pattern turns out to be wrong in practice | Phase 3.2 smoke-test runs BEFORE this roadmap starts Phase 1 — lessons-learned fold in |

## Rollback plan

Every batch is a single commit referencing this roadmap and its phase/batch
identifier (e.g. `refactor(skills): phase-1.a — add role frame to 3 verdict
skills`). A bad batch is revertable with one `git revert`; the linter and CI
pipeline catch cascading effects before they ship.

## Out of scope

- Rewriting the 4 judge skills (already compliant)
- Merging, splitting, or deleting existing skills (that is `skill-management`'s
  job, not this roadmap's)
- Changing the pattern catalogue itself — patterns are inherited from Phase
  3.1 and must not be negotiated down during backport
- Rule/command/guideline backport — separate roadmap if needed, but patterns
  are skill-specific

## References

- [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) — parent roadmap, Phase 3.1
- [`.agent-src.uncompressed/rules/preservation-guard.md`](../../.agent-src.uncompressed/rules/preservation-guard.md) — quality gate
- [`.agent-src.uncompressed/rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md) — minimum sharpness
- [`.agent-src.uncompressed/guidelines/agent-infra/size-and-scope.md`](../../.agent-src.uncompressed/guidelines/agent-infra/size-and-scope.md) — word budgets
- [`.agent-src.uncompressed/skills/judge-bug-hunter/SKILL.md`](../../.agent-src.uncompressed/skills/judge-bug-hunter/SKILL.md) — reference implementation of patterns 1-8
