# Roadmap: Defensive Agent — Senior-Engineer Security & Analysis

> **Status — archived 2026-04-23.** Wave 1 shipped (6 skills + 5 context
> templates). Waves 2 + 3 and post-wave dispatch integration remain
> **deferred, not cancelled** — they were parked with the roadmap rather
> than kept in the active queue. If Wave 2 is taken up again, re-open
> this roadmap from the archive (or spawn a focused successor roadmap
> per Q33 in [`../open-questions-2.md`](../open-questions-2.md)).

> Make the agent behave like a **skeptical, security-minded staff engineer
> + reviewer** — deeper context, stricter decision rules, reliable
> defense-side security checks — **without** drifting into offensive
> cyber capability.

## Prerequisites

- [x] Phase 3.1 of [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) shipped (four specialized judges)
- [x] [`road-to-stronger-skills.md`](road-to-stronger-skills.md) exists — defines the 8-pattern tier system this roadmap consumes
- [x] `preservation-guard`, `skill-quality`, `augment-portability` rules active
- [x] `scripts/measure_patterns.py` baseline captured — new skills must score ≥ tier target on first commit
- [-] `/review-changes` live smoke-test (Phase 3.2 of autonomous-agent) — recommended before wiring new skills as dispatch targets
  *(2026-04-22: deferred — depends on a real diff to self-review.
  Tracked alongside Q33 in
  [`open-questions-2.md`](open-questions-2.md).)*

## Vision

The defensive-agent stack adds **analysis depth + security discipline** on top
of the existing skill catalogue. Target behaviours, in order of leverage:

1. **Read-before-write**, always (enforced by existing rules + new skill gates)
2. **Threat-model before implementing** on security-sensitive areas
3. **Map data flow and blast radius** before touching cross-cutting code
4. **Review authorization, data exposure, dependencies, migrations, queues**
   as distinct checks, not as a single "security pass"
5. **Refuse** to help build offensive cyber capability — hard rule

## Non-goals (explicit)

This roadmap does **not**:

- Produce exploit chains, payloads, bypass techniques, or red-team tooling
- Teach vulnerability exploitation, only detection + remediation
- Replace `security` / `security-audit` / `bug-analyzer` — it **complements** them
- Rewrite existing skills (that is [`road-to-stronger-skills.md`](road-to-stronger-skills.md))
- Add project-specific knowledge into `.agent-src.uncompressed/` — knowledge
  belongs in consumer `agents/contexts/` (templates ship from the package)

## Offensive-capability guardrail

A new `always`-rule `never-help-build-offensive-cyber-capability` lands in
**Wave 1**. It forbids:

- Producing working exploits, payloads, shellcode, or evasion tooling
- Authoring phishing material, credential-harvesting flows, or malware
- Bypassing authentication, authorization, rate limits, or WAFs in systems
  the user does **not** own and has **not** explicitly authorized

It explicitly permits:

- Detection rules, hardening, remediation, post-incident analysis
- Red-team/penetration-testing questions answered at the conceptual level
  only when the user states authorization and scope

## Relationship to other roadmaps

```
road-to-autonomous-agent.md (parent)
  ├── Phase 3.1 ── four specialized judges ✅
  ├── Phase 3.2 ── /review-changes smoke-test ⏳
  ├── road-to-stronger-skills.md ── backport 8 patterns to all 116 existing skills
  └── road-to-defensive-agent.md ── THIS ── 13 new skills + 3 rules + templates
```

**Parallel execution**: new skills are authored **pattern-compliant from day 1**
(no backport debt). They register in `road-to-stronger-skills.md` already in
the "compliant" tier.

## Portability strategy

Every new skill must be **framework-neutral at the top level** and name
stack-specific examples in parentheses.

| Skill | Top-level wording | Stack examples (parens) |
|---|---|---|
| `authz-review` | "the authorization layer" | Laravel Policies/Gates · Symfony Voters · Express middleware · FastAPI `Depends` · Spring `@PreAuthorize` · Rails Pundit/CanCan |
| `queue-safety` | "the background job runtime" | Laravel Horizon · Celery · BullMQ · Sidekiq · Resque · SQS consumers |
| `migration-safety` | "the schema-change mechanism" | Laravel migrations · Alembic · Flyway · Goose · Django migrations · Rails migrations |
| `multi-tenant-boundary-review` | "the tenant-scoping mechanism" | `BelongsToTenant` trait · `tenant_id` global scope · row-level security · schema-per-tenant |
| `secure-laravel-architecture` | **stack-gated** — frontmatter `stacks: [laravel]` | — (only activates in Laravel projects) |

Knowledge-layer content stays **out** of `.agent-src.uncompressed/`. It ships
as **templates** under the future `templates/contexts/` directory (files such
as *auth-model*, *tenant-boundaries*, *data-sensitivity*) that consumers fill
in their own `agents/contexts/` — created in Wave 3, not yet on disk.

## Overlap resolutions (pre-flight)

| Proposed artifact | Overlaps with | Resolution |
|---|---|---|
| **prove-dont-claim** (proposed rule) | `verify-before-complete` rule + skill, `think-before-action` rule | **Drop.** Fully covered. |
| **risk-scored-pr-review** (proposed skill) | `/review-changes` command + four judges | **Drop as skill.** Extend command output with a Risk-Scorecard block (Wave 2 sub-task). |
| **incident-triage** (proposed skill) | `bug-analyzer` skill (Sentry/Jira/stacktrace aware) | **Extend** `bug-analyzer` in Wave 3 with an incident-mode section. No new skill. |
| **read-before-write** (proposed rule) | `think-before-action` rule ("read it first, trace the flow, then change it") | **Light extension** — add a mandatory "minimum read set" checklist to the existing rule instead of a new file. |
| **secure-laravel-architecture** (planned) | `laravel` skill | **Stack-gated.** Only activates when Laravel detected; references (not duplicates) the `laravel` skill. |
| **data-exposure-review** (planned) | `security-audit` (full audit) + `security` (impl) | **Complements.** Review-layer only: runs on diffs, not full codebase. |
| **input-validation-review** (planned) | `laravel-validation` skill (impl) | **Complements.** Review-layer, framework-neutral; routes to `laravel-validation` for fix-implementation. |

## Definition of done

The roadmap is **done** when:

1. All 13 new skills + 3 new rules exist in `.agent-src.uncompressed/`
2. Each new skill scores ≥ tier target on `scripts/measure_patterns.py` on first commit
   (Tier-1 review skills → 8/8; Tier-2 analysis skills → 4/4)
3. `security`, `security-audit`, `bug-analyzer` have updated `## Do NOT use when` sections routing to the new siblings
4. `/review-changes` includes a Risk-Scorecard block in its output (sub-task of Wave 2)
5. `task ci` green after every wave; skill linter 0 fail
6. Knowledge-layer templates validated by installing the package into a test consumer repo
7. Offensive-capability guardrail rule proven by red-team prompt regression tests (manual 10-prompt set)


## Wave 1 — Sofort (Foundation)

**Goal:** the agent can threat-model, map data flow, review authorization,
and refuse offensive work. Unblocks every later wave.

### 1.1 — Skills

- [x] `threat-modeling` — abuse cases, trust boundaries, mapped to files (Tier 1, 8/8)
- [x] `authz-review` — end-to-end authz from route → policy → query → response (Tier 1, 8/8)
- [x] `data-flow-mapper` — request → storage → response, before editing (Tier 2, 7/8)
- [x] `blast-radius-analyzer` — what a change touches: jobs, events, APIs, migrations (Tier 2, 7/8)

### 1.2 — Rules

- [-] `never-help-build-offensive-cyber-capability` — `always`, ~40 lines, hard refusal rubric *(deferred to Wave 2 with its regression set)*
  *(2026-04-22: Wave 2 scoped but not shipped — Q33.)*
- [x] `security-sensitive-stop` — `auto`, triggers on auth/billing/tenant/secrets/upload/external
- [x] `read-before-write` — extension of `think-before-action` (minimum read set checklist)
- [x] `minimal-safe-diff` — `always`, smallest-safe-change principle

### 1.3 — Commands

- [x] `/threat-model` — dispatches `threat-modeling` + `authz-review`, consolidates into a single report
- [-] `/secure-review` — deferred to Wave 2 (depends on `dependency-risk-review` + `data-exposure-review`) *(Q33)*

### 1.4 — Acceptance criteria

- [x] Every new skill scores ≥ tier target on `measure_patterns.py` (commit gate)
- [-] `never-help-…` rule passes a 10-prompt red-team regression set *(with Wave 2)* *(Q33)*
- [x] `systematic-debugging` + `bug-analyzer` have `route to data-flow-mapper` / `blast-radius-analyzer` links
- [x] `security` + `security-audit` have `route to threat-modeling` / `route to authz-review` links

## Boosts — incremental reinforcements between waves

These ship **between Wave phases** when a real gap shows up before the next wave is due. Each boost is scoped to 3–10 artefacts, auditable in one PR, and never introduces new review surfaces that a later wave will rebuild.

### Level-2 Boost — PR Risk Review (shipped in `bc602f6`)

- [x] `templates/github-workflows/pr-risk-review.yml` — labels PRs by risk based on path globs
- [x] `templates/scripts/pr_risk_review.py` + `pr-risk-config.example.yml` — consumer-configurable rules
- [x] Confidence gating section in `rules/verify-before-complete.md`

### Level-3 Boost — Review Routing + Break-Glass

**Goal:** make PR review **owner-aware** and **history-aware**, and allow controlled emergency deviation from the minimal-safe-diff / verify-before-complete rules without silently dropping accountability.

- [x] `rules/reviewer-awareness.md` — role-based reviewer selection, primary + secondary for medium/high risk
- [x] `rules/review-routing-awareness.md` — consult ownership-map + historical-bug-patterns before claiming a change is safe
- [x] `skills/review-routing/SKILL.md` + `commands/review-routing.md` — apply routing to a diff
- [x] `guidelines/agent-infra/review-routing-data-format.md` — YAML schema for `agents/ownership-map.yml` + `agents/historical-bug-patterns.yml`
- [x] `guidelines/agent-infra/break-glass-usage.md` — emergency-mode contract + follow-up requirement
- [x] Break-glass exception folded into `rules/minimal-safe-diff.md` + `rules/verify-before-complete.md` (no new standalone rule)
- [x] `templates/scripts/pr_review_routing.py` + `ownership-map.example.yml` + `historical-bug-patterns.example.yml` — CI integration
- [x] `templates/github-workflows/pr-risk-review.yml` extended to invoke the routing script after risk labelling
- [x] `scripts/check_references.py` — exempts consumer-project routing data files from broken-reference detection

**Acceptance criteria:**

- Ownership-map + historical-bug-patterns YAML files are optional — missing files produce a neutral report, not an error
- Break-glass never auto-activates — requires explicit user flag (`break-glass: true`, "hotfix") and a documented follow-up commitment
- `task ci` green after integration (sync · compression · refs · portability · skill-lint · tests · readme)

## Wave 2 — Sehr wertvoll (Review Depth)

**Goal:** cover the remaining high-leverage review surfaces.

### 2.1 — Skills (all Tier 1)

- [-] `dependency-risk-review` — new packages, install hooks, transitive risk, supply-chain *(Q33)*
- [-] `data-exposure-review` — API resources, logs, exceptions, admin leakage *(Q33)*
- [-] `migration-safety` — lock-prone, backfill, rollback realism, staged rollout *(Q33)*
- [-] `queue-safety` — idempotency, retries, duplicate dispatch, failure handling *(Q33)*
- [-] `secrets-and-config-review` — hardcoded secrets, `.env` reach, debug flags, unsafe logging *(Q33)*

### 2.2 — Command extension

- [-] `/review-changes` emits a **Risk-Scorecard** block (security · data · regression · operational, each 🔴/🟡/🟢), aggregated from the four judges' verdicts + a new internal routine — **no new skill**, ~30-line extension of the command
  *(2026-04-22: depends on the five Wave-2 review skills existing — Q33.)*

### 2.3 — Acceptance criteria

- New skills on 8/8 at commit time
- `/review-changes` output includes Scorecard on a representative PR
- `bug-analyzer` + `jobs-events` + `laravel-validation` get `route to` links to the new review skills

## Wave 3 — Domänenspezifisch + Knowledge Layer

**Goal:** stack- and project-specific depth, without leaking project content
into the shared package.

### 3.1 — Skills

- [-] `input-validation-review` — Tier 1, framework-neutral *(Q33)*
- [-] `multi-tenant-boundary-review` — Tier 1, framework-neutral with tenant-detection heuristics *(Q33)*
- [-] `secure-laravel-architecture` — Tier 1, frontmatter `stacks: [laravel]` *(Q33)*
- [-] `regression-hunter` — Tier 2, pairs with `bug-analyzer` *(Q33)*
- [-] `bug-analyzer` **extension** — new "incident mode" section (no new skill; `incident-triage` merged here) *(Q33)*

### 3.2 — Knowledge-layer templates

Ship in `.agent-src.uncompressed/templates/contexts/`:

- [x] `auth-model.md` — roles, permissions, override/impersonation rules *(2026-04-22: [`templates/contexts/auth-model.md`](../../.agent-src.uncompressed/templates/contexts/auth-model.md))*
- [x] `tenant-boundaries.md` — tenancy type, scope propagation, known exceptions *(2026-04-22: [`templates/contexts/tenant-boundaries.md`](../../.agent-src.uncompressed/templates/contexts/tenant-boundaries.md))*
- [x] `data-sensitivity.md` — field classification, masking rules, log-safe types *(2026-04-22: [`templates/contexts/data-sensitivity.md`](../../.agent-src.uncompressed/templates/contexts/data-sensitivity.md))*
- [x] `deployment-order.md` — migration/deploy staging, rollback plan, feature flags *(2026-04-22: [`templates/contexts/deployment-order.md`](../../.agent-src.uncompressed/templates/contexts/deployment-order.md))*
- [x] `observability.md` — Sentry scopes, log channels, known alerts *(2026-04-22: [`templates/contexts/observability.md`](../../.agent-src.uncompressed/templates/contexts/observability.md))*

Plus a new skill:

- [x] `context-authoring` — Tier 3, walks the user through filling in the above templates *(2026-04-22: [`skills/context-authoring/SKILL.md`](../../.agent-src.uncompressed/skills/context-authoring/SKILL.md) — harvest-first walkthrough, preserves template contract, emits `<!-- TBD: ... -->` markers instead of fabricating)*

### 3.3 — Acceptance criteria

- All new skills on tier target; `context-authoring` at Tier 3 (patterns 1 + 2)
- Templates validated by installing into a fresh Laravel + Next.js test consumer
- No consumer-specific content in any shipped file — `check-portability` green

## Post-waves — Integration & dispatch

- [-] `/review-changes` dispatches to `authz-review`, `data-exposure-review`,
      `dependency-risk-review`, `migration-safety`, `queue-safety` when the
      diff matches file globs (auth/policy, resources/logs, composer/package-lock,
      migrations, jobs) *(Q33 — needs Wave 2 skills first)*
- [-] `/feature-plan` calls `threat-modeling` + `data-flow-mapper` for features
      touching Wave-1 trigger areas
      *(2026-04-22: `threat-modeling` and `data-flow-mapper` shipped; the
      `/feature-plan` wiring is a ~15-line command edit deferred until
      Wave 2 integration lands — Q33.)*
- [-] `finishing-a-development-branch` cross-links `secrets-and-config-review`
      as a pre-merge check *(Q33 — waits on secrets-and-config-review)*

## Final status — 2026-04-22

| Item set | Status |
|---|---|
| Wave 1 — core security skills (`threat-modeling`, `authz-review`, `data-flow-mapper`, `blast-radius-analyzer`) | ✅ done |
| Wave 1 — knowledge-layer templates (auth/tenant/data/deployment/observability) + `context-authoring` | ✅ done |
| Sequencing (Q33 resolved 2026-04-22) | ✅ Wave 2 before Wave 3 · one PR per skill · synthetic fixture diff for smoke test |
| Wave 1 — `/review-changes` live smoke-test | 🟡 unblocked — scaffold synthetic fixture diff in this repo as the first Wave-2 PR |
| **Wave 2 — 5 review skills + Risk-Scorecard extension** | 🟡 unblocked — awaiting per-skill drafting sessions |
| Wave 2 — `never-help-…` rule + red-team regression | 🟡 unblocked — rides with `secrets-and-config-review` PR |
| Wave 3 — 4 stack-specific review skills + `bug-analyzer` incident-mode | ⏸ deferred (ships after Wave 2 completes) |
| Post-waves — dispatch wiring in `/review-changes`, `/feature-plan`, `finishing-a-development-branch` | ⏸ deferred (ships after Wave 3 completes) |

Wave 1 shipped the foundation (6 skills + 5 templates). Waves 2/3
and post-wave integration require their own artifact-drafting
sessions per-skill; Q33 (resolved 2026-04-22) fixed sequencing
(Wave 2 first), PR granularity (one skill per PR), and the
smoke-test approach (synthetic fixture in-repo, not a past PR
from elsewhere). Roadmap stays open; **next action** is the
fixture-diff PR.

## Measurement

Track weekly against `scripts/measure_patterns.py --diff-baseline baseline.json`:

- Tier-1 Review compliance: **100 %** on new skills at commit time
- Net new skills should **raise** the package-wide average, not dilute it
- No existing skill regresses (preservation-guard)

## References

- OWASP ASVS — Authorization, Input Validation, Cryptography, Error Handling chapters
- STRIDE threat model (Microsoft) — for `threat-modeling` framing
- NIST SP 800-53 AC family — for `authz-review` rubric
- OWASP Top 10 A01/A03/A05/A08/A09 — cross-referenced per skill
- Google SRE Book — "Postmortem Culture" for incident-mode in `bug-analyzer`

Exact citations land in each skill's `## References` section (Pattern 6).
