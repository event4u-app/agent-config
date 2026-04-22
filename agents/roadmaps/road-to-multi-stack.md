# Roadmap: Multi-Stack — from Laravel-complete to Laravel-complete-plus

> The package's **authoring** surface is Laravel-dense. The
> **analysis** surface already covers Symfony, Next.js, React,
> Node/Express, Zend/Laminas. This roadmap closes the asymmetry
> by growing authoring coverage for the non-Laravel stacks —
> parallel tracks, shared-by-default architecture, portability-strict.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted
- [x] `project-analysis-{laravel,symfony,nextjs,react,node-express,zend-laminas}` skills shipped — analysis covers all target stacks
- [x] `augment-portability` rule + `scripts/check_portability.py` enforce strict shared-skill hygiene (no project / domain / stack names leaking into shared skills)
- [x] `artifact-drafting-protocol` rule active — mandatory for every new stack-specific skill
- [x] [`road-to-stronger-skills.md`](road-to-stronger-skills.md) pattern catalogue exists — new stack skills ship pattern-compliant from day one, no backport debt

## Context — why this is a parallel-tracks roadmap

Decided in Q18 (2026-04-22): the maintainer wants broad coverage,
not a single-next-stack commitment. This is **the backlog** for
all non-Laravel stacks. Prioritization inside the roadmap follows:

1. Maintainer bandwidth.
2. External demand signals (consumer reports, adoption feedback).
3. Code-sharing wins (Symfony + plain PHP reuse the most existing
   `php-coder`, `composer-packages`, `quality-tools` infrastructure).

**Laravel is not frozen.** Laravel authoring skills continue to
evolve; this roadmap is additive.

## Vision

A user who types "build me an X" in a Symfony, Next.js, or Zend
repo gets the **same quality of agent support** as a Laravel user
does today — matching skill density, matching pattern compliance,
matching portability.

Coverage target per stack, in priority order:

1. **Authoring skill parity** — a stack-specific counterpart for
   every Laravel-* skill that has a stack equivalent (controllers,
   services, validation, queues, notifications, mail, scheduling,
   middleware, UI layer).
2. **Framework idioms** — stack-specific patterns that have no
   Laravel equivalent (Symfony Messenger, Next.js RSC boundaries,
   React Server Components, Zend service manager, Laminas hydrators).
3. **Tooling integrations** — stack-native test runners, linters,
   type-checkers (PHPStan for PHP stacks, ESLint/TypeScript/Vitest
   for JS stacks).

## Non-goals (explicit)

- **No** Laravel de-prioritization — this roadmap does not
  remove or demote any Laravel skill.
- **No** mega-skills like `symfony-everything` — one skill per
  responsibility, same as Laravel decomposition.
- **No** project-specific content in any stack-specific skill —
  `check_portability` stays strict.
- **No** dropping shared skills in favour of stack-specific clones.
  If `php-coder` covers it, `symfony-php-coder` is not created.
- **No** framework-version chasing — skills target the actively
  supported major (e.g. Symfony 7.x, Next.js 14+), plus-minus one
  major at most. Version-specific branches belong in guidelines,
  not in separate skills.

## Shared-by-default architecture (locked)

| Category | Policy | Example |
|---|---|---|
| Language-level | Shared | `php-coder`, `sql-writing`, `security`, `performance` |
| Tooling | Shared | `composer-packages`, `github-ci`, `git-workflow`, `quality-tools`, `docker` |
| Framework-specific | Stack-namespaced | `laravel-validation`, `symfony-messenger`, `nextjs-server-actions`, `zend-service-manager` |
| Cross-stack pattern | Shared with stack notes | `api-design`, `api-testing`, `logging-monitoring`, `websocket` |
| Project-specific | Never shipped | belongs in consumer `agents/contexts/` |

A skill is stack-namespaced only when its guidance is false or
misleading on other stacks. Default bias: shared.

## Tracks

Three parallel tracks. Track ownership per maintainer bandwidth.
Each track ships in **waves**, smallest useful slice first.

### Track A — Symfony + plain PHP (highest code-sharing)

Rationale: shares `php-coder`, `composer-packages`, `quality-tools`
infrastructure. Biggest coverage win per unit of drafting effort.

- [ ] **Wave A.1 — core authoring**: `symfony` (framework idioms),
  `symfony-controllers`, `symfony-services` (DI container),
  `symfony-validation` (constraints, validator component),
  `symfony-forms`.
- [ ] **Wave A.2 — async + jobs**: `symfony-messenger`,
  `symfony-scheduler`, `symfony-mailer`, `symfony-notifier`.
- [ ] **Wave A.3 — data + persistence**: `doctrine-orm`,
  `doctrine-migrations`, `doctrine-dbal` (parallels `eloquent` +
  `database` + `sql-writing`).
- [ ] **Wave A.4 — plain PHP**: verify `php-coder`,
  `composer-packages`, `security`, `api-design` fire cleanly on
  plain-PHP repos without Laravel context leakage. Fix gaps via
  guidance in existing skills — no new skills if not needed.

### Track B — Frontend (Next.js + React, TypeScript-first)

Rationale: expands audience beyond PHP world; distinct authoring
stack; largest new-user demographic.

- [ ] **Wave B.1 — React core**: `react-components`,
  `react-hooks`, `react-state-management`, `react-testing`.
- [ ] **Wave B.2 — Next.js**: `nextjs-app-router`,
  `nextjs-server-actions`, `nextjs-data-fetching`,
  `nextjs-rendering-modes` (SSG/SSR/ISR/streaming).
- [ ] **Wave B.3 — tooling**: `typescript` (if not shared),
  `eslint`, `vitest` / `jest`, `playwright-testing` already
  covers E2E.
- [ ] **Wave B.4 — UI primitives**: `tailwind`, `shadcn-ui`,
  `radix-ui` — opt-in where the consumer stack uses them.

### Track C — Zend / Laminas (legacy migration audience)

Rationale: covers the legacy migration audience; lower urgency but
underserved elsewhere, creates a niche competitive edge.

- [ ] **Wave C.1 — analysis-only deepening**: extend
  `project-analysis-zend-laminas` with migration-path guidance
  (Zend 1 → 2 → 3, Zend → Laminas, Laminas → Symfony/Laravel).
- [ ] **Wave C.2 — authoring**: `laminas-mvc`,
  `laminas-service-manager`, `laminas-hydrators`,
  `laminas-input-filter` — only if adoption signals justify.
- [ ] **Wave C.3 — migration skills**: `legacy-to-modern-php` —
  pattern for gradual modernization (shared across all PHP tracks).

## README + AGENTS.md framing (feeds Q19)

The Q19 hero table is the externally visible output of this
roadmap. State per track:

| Stack | Current | Target |
|---|---|---|
| Laravel | ✅ complete | maintain |
| Plain PHP | 🟡 partial (via shared) | ✅ verified end-to-end |
| Symfony | 🚧 analysis-only | ✅ Wave A.2 shipped |
| Next.js | 🚧 analysis-only | ✅ Wave B.2 shipped |
| React | 🚧 analysis-only | ✅ Wave B.1 shipped |
| Node/Express | 🚧 analysis-only | 🚧 scheduling TBD |
| Zend/Laminas | 🚧 analysis-only | 🟡 analysis-plus |

Every coverage promotion updates the Q19 table. Honest state in
the README is the acceptance test for each wave.

## Phases

### Phase 0 — baseline + policy freeze

- [ ] Inventory: each existing `laravel-*` skill mapped to its
  Symfony / Next.js / React / Zend equivalent (or "no equivalent,
  shared skill covers it").
- [ ] `check_portability.py` updated with any new stack-keyword
  blocklists required.
- [ ] Skill-namespace convention locked: `<stack>-<capability>`
  (lowercase, hyphenated). Documented in
  `guidelines/agent-infra/size-and-scope.md` or adjacent.

### Phase 1+ — waves per track

Each wave = one or more PRs. Per-wave discipline:

1. Draft via `artifact-drafting-protocol` per skill.
2. Pattern compliance per `road-to-stronger-skills.md` tier from
   first commit — no backport debt.
3. Cross-links: new skill cited from relevant shared skills
   (`api-design` cites `symfony-controllers` in its "stack-specific
   routing" section).
4. README / AGENTS.md counts bumped via `scripts/update_counts.py`.
5. Q19 coverage table updated.

## Open questions

- **Ownership** — does each track need a dedicated maintainer, or
  can the package maintainer run all three? Default: single
  maintainer, community contributions welcomed per track.
- **Stack-defaults in `.augmentignore`** — should a Symfony project
  auto-ignore Laravel-specific skills? Default: no — the package
  targets *senior* engineers who can pick. Revisit if first-run
  feedback contradicts this.
- **Test-runner parity** — do we ship `vitest` and `jest` or pick
  one? Default: `vitest` as primary (modern default), `jest` as
  guidance-only in the skill.
- **Framework-version policy** — explicit support matrix in each
  stack skill's frontmatter, or shared policy doc? Default: shared
  policy doc, skills reference it.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Waves start, never finish (half-covered stack worse than zero) | Every wave ships a coherent slice; the README table reflects state honestly |
| Portability drift as stack count grows | `check_portability.py` strict; pre-commit hook; CI gate |
| Maintainer burnout on parallel tracks | Explicit wave-by-wave scope; pause any track without guilt |
| Skill duplication (e.g. shared `api-design` + stack-specific `symfony-routing`) | Inventory in Phase 0 catches overlap; cross-links are mandatory |
| JS-stack ecosystem moves faster than PHP | Narrower version policy for Track B; shorter skill descriptions, more guideline-delegation |

## Acceptance criteria

The roadmap is **never fully done** — it's the multi-stack
backlog. Per-wave acceptance:

- Every new skill passes the linter, is pattern-compliant to its
  tier, has at least one cross-link from a shared skill.
- README + AGENTS.md + Q19 coverage table reflect the new state.
- `check_portability.py` passes; `task ci` green.

## See also

- [`open-questions.md`](open-questions.md) — Q18, Q19 (source)
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — pattern compliance baseline new skills inherit
- [`road-to-personas.md`](road-to-personas.md) — personas cited by stack-specific review skills
- [`.agent-src.uncompressed/rules/augment-portability.md`](../../.agent-src.uncompressed/rules/augment-portability.md) — portability gate
- [`.agent-src.uncompressed/rules/artifact-drafting-protocol.md`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md) — mandatory per new stack skill
- [`scripts/check_portability.py`](../../scripts/check_portability.py) — enforcement
