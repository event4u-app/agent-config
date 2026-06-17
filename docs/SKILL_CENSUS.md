# Skill-Family Census

> **Status: provisional.** First-pass family assignment; the Keep / Prune / Merge
> calls are description-overlap heuristics, not decisions. This document is input
> for the leanness track (`road-to-tier-removal` and the command-surface-leanness
> track), not a directive. Family assignments are derived from each skill's `name`
> + `description` frontmatter only — no skill body was read. Empty families after
> pruning are a merge signal, not a failure (per the Phase-0 council convergence
> in `road-to-contract-integrity`).

Produced as Phase-0 step F2 of `road-to-contract-integrity`. Covers all 237
skills under `src/skills/*/SKILL.md`.

## Families

Every skill is assigned to exactly one of the fixed family set:

`engineering`, `review`, `security`, `product`, `finance`, `content`, `video`,
`agent-admin`, `evidence`, `meta-config`.

Family semantics used for this pass:

- **engineering** — writing / editing / debugging / testing application code,
  framework carve-outs, infra/devops, code-level analysis, perf, DB, CI.
- **review** — reviewing or auditing *someone's change* (code, design, PR,
  decision, README) and the judge/critique lenses.
- **security** — threat modeling, authz, secrets, privacy, data-handling,
  security audit (the application-security surface, not agent-config security).
- **product** — product/PM, growth, GTM, customer/discovery, people/org,
  positioning, prioritisation, planning that is not code.
- **finance** — cash, valuation, forecasting, unit-economics, fundraising.
- **content** — prose/marketing/brand writing, docs co-authoring, editorial,
  prompt engineering for end-users, image-still generation.
- **video** — AI video / animation pipeline (scene, motion, character, song).
- **agent-admin** — authoring/maintaining the agent-config artifacts themselves
  (skills, rules, commands, personas, memory, roadmaps, the toolchain).
- **evidence** — codebase orientation / project-intelligence discovery surfaces
  whose output is an evidence write-up rather than a code change.
- **meta-config** — cross-cutting reasoning/orchestration/execution-discipline
  skills, plus the catch-all for skills that fit no other family.

## Per-family count summary

| Family | Count | Prune | Merge |
|---|---:|---:|---:|
| engineering | 83 | 0 | 7 |
| product | 37 | 0 | 2 |
| agent-admin | 32 | 1 | 5 |
| content | 20 | 0 | 2 |
| review | 18 | 0 | 2 |
| meta-config | 15 | 0 | 1 |
| security | 10 | 0 | 1 |
| evidence | 9 | 0 | 1 |
| finance | 7 | 0 | 0 |
| video | 6 | 0 | 0 |
| **Total** | **237** | **1** | **21** |

## Census table

| Skill | Family | Keep / Prune / Merge | Note |
|---|---|---|---|
| adr-create | agent-admin | Keep | |
| agent-docs-writing | agent-admin | Keep | |
| agents-md-thin-root | agent-admin | Keep | |
| ai-council | agent-admin | Keep | |
| check-refs | agent-admin | Keep | |
| command-routing | agent-admin | Keep | |
| command-writing | agent-admin | Keep | |
| condense-memory | agent-admin | Keep | |
| context-authoring | agent-admin | Merge → context-document | Two skills for filling/structuring context files; consider folding. |
| context-document | agent-admin | Merge ← context-authoring | Merge target for context-authoring. |
| conventional-commits-writing | agent-admin | Keep | commit-message conventions; borders engineering (git surface). |
| decision-record | agent-admin | Merge → adr-create | decision-record frames the trade-off; adr-create writes the ADR — overlap on ADR drafting. |
| description-assist | agent-admin | Keep | |
| emit-tickets | agent-admin | Keep | roadmap → ticket-bundle materialisation. |
| guideline-writing | agent-admin | Keep | |
| learning-to-rule-or-skill | agent-admin | Keep | |
| lint-skills | agent-admin | Keep | |
| md-language-check | agent-admin | Keep | |
| memory-consolidation | agent-admin | Keep | |
| override-management | agent-admin | Keep | |
| persona-writing | agent-admin | Keep | |
| project-docs | agent-admin | Keep | |
| roadmap-management | agent-admin | Merge ← roadmap-writing | Authoring vs. lifecycle-management of roadmaps — heavy surface overlap. |
| roadmap-writing | agent-admin | Merge → roadmap-management | Merge candidate with roadmap-management. |
| rule-refactor | agent-admin | Keep | |
| rule-writing | agent-admin | Keep | |
| script-writing | agent-admin | Keep | |
| skill-improvement-pipeline | agent-admin | Prune | Orchestrates capture/classify/create/validate/apply — thin wrapper over skill-management + learning-to-rule-or-skill. |
| skill-management | agent-admin | Keep | |
| skill-reviewer | agent-admin | Keep | overlaps with skill-management/skill-writing but is the review lens; keep for now. |
| skill-writing | agent-admin | Keep | |
| upstream-contribute | agent-admin | Keep | contribute a learning back to the shared package. |
| canvas-design | content | Keep | static visual / poster design. |
| content-funnel-design | content | Keep | |
| design-intelligence | content | Keep | grounded design brief (style/tokens/typography); borders engineering. |
| doc-coauthoring | content | Keep | |
| editorial-calendar | content | Keep | |
| image-analyser | content | Keep | character-image analysis; borders video but reusable for stills. |
| image-creator | content | Keep | character-image generation to spec. |
| markitdown | content | Keep | doc→markdown conversion for ingestion. |
| messaging-architecture | content | Keep | message stack from positioning. |
| prompt-engineering-patterns | content | Merge ← prompt-optimizer | production-LLM prompt patterns; overlaps the prompt-* cluster. |
| prompt-optimizer | content | Merge → prompt-engineering-patterns | end-user prompt rewriting; prompt-* cluster overlap. |
| readme-writing | content | Keep | |
| readme-writing-package | content | Keep | package-specific variant of readme-writing; distinct enough to keep this pass. |
| refine-prompt | content | Keep | engine-facing prompt reconstruction (distinct from end-user optimize). |
| release-comms | content | Keep | |
| repomix-packer | content | Keep | codebase→single-file packing for LLM ingestion. |
| technical-specification | content | Keep | spec/PRD/RFC authoring. |
| voc-extract | content | Keep | Voice-of-Customer theme extraction. |
| voice-and-tone-design | content | Keep | brand voice. |
| corpus-grounding | evidence | Keep | shared grounding engine; could also read as meta-config. |
| project-analysis-core | evidence | Keep | discovery primitives. |
| project-analysis-hypothesis-driven | evidence | Keep | |
| project-analysis-laravel | evidence | Keep | framework-specific deep analysis. |
| project-analysis-nextjs | evidence | Keep | |
| project-analysis-node-express | evidence | Keep | |
| project-analysis-react | evidence | Keep | |
| project-analysis-symfony | evidence | Keep | |
| project-analysis-zend-laminas | evidence | Merge → project-analysis-symfony | Legacy Zend/Laminas; low-traffic stack — fold into a generic PHP analysis pass if cull warrants. |
| accessibility-auditor | engineering | Keep | a11y review of UI code. |
| api-design | engineering | Keep | |
| api-endpoint | engineering | Merge → laravel-api-endpoint | api-endpoint is a stack-router that mostly dispatches to laravel-api-endpoint/nextjs-patterns. |
| api-testing | engineering | Keep | |
| artisan-commands | engineering | Keep | |
| async-python-patterns | engineering | Keep | |
| aws-infrastructure | engineering | Keep | |
| blade-ui | engineering | Keep | |
| code-refactoring | engineering | Keep | |
| complexity-first-planning | engineering | Keep | risk-first decomposition; borders meta-config. |
| composer-packages | engineering | Keep | |
| dashboard-design | engineering | Keep | monitoring-dashboard design; borders content (data storytelling). |
| database | engineering | Keep | |
| defense-in-depth | engineering | Keep | validation guard design; borders security. |
| dependency-upgrade | engineering | Keep | |
| design-tokens | engineering | Keep | DTCG token system; UI-engineering. |
| developer-like-execution | engineering | Keep | |
| docker | engineering | Keep | |
| eloquent | engineering | Merge → laravel | Eloquent is a Laravel subsurface; could fold into laravel. |
| error-handling-patterns | engineering | Keep | |
| existing-ui-audit | engineering | Keep | UI inventory gate before UI edits. |
| fe-design | engineering | Keep | frontend-design heuristics reference. |
| feature-planning | engineering | Keep | idea→plan→roadmap for code work. |
| finishing-a-development-branch | engineering | Keep | ship/merge/park routing. |
| flux | engineering | Keep | |
| form-handler | engineering | Keep | |
| git-workflow | engineering | Keep | |
| github-ci | engineering | Keep | |
| grafana | engineering | Keep | dashboards/log queries; borders content/observability. |
| jobs-events | engineering | Keep | |
| laravel | engineering | Keep | |
| laravel-api-endpoint | engineering | Keep | merge target for api-endpoint. |
| laravel-dto | engineering | Keep | |
| laravel-horizon | engineering | Keep | |
| laravel-mail | engineering | Keep | |
| laravel-middleware | engineering | Keep | |
| laravel-migration | engineering | Keep | |
| laravel-notifications | engineering | Keep | |
| laravel-pennant | engineering | Keep | |
| laravel-pulse | engineering | Keep | |
| laravel-reverb | engineering | Merge → laravel-websocket | Reverb is the WebSocket server; overlaps laravel-websocket's broadcasting surface. |
| laravel-scheduling | engineering | Keep | |
| laravel-validation | engineering | Keep | |
| laravel-websocket | engineering | Keep | merge target for laravel-reverb. |
| livewire | engineering | Keep | |
| livewire-architect | engineering | Keep | shaping vs. writing Livewire; distinct enough this pass. |
| logging-monitoring | engineering | Merge → grafana | logging/monitoring overlaps grafana + sentry-integration; consolidate observability. |
| merge-conflicts | engineering | Keep | |
| migration-architect | engineering | Keep | rollout/cutover shaping; hands off DDL to laravel-migration. |
| mobile-e2e-strategy | engineering | Keep | |
| module-detect-on-the-fly | engineering | Keep | |
| module-management | engineering | Keep | |
| multi-tenancy | engineering | Keep | borders security (tenant isolation). |
| nextjs-patterns | engineering | Keep | |
| openapi | engineering | Keep | |
| performance | engineering | Merge → performance-analysis | performance + performance-analysis cover the same optimization surface. |
| performance-analysis | engineering | Merge ← performance | merge target. |
| pest-testing | engineering | Keep | |
| php-coder | engineering | Keep | |
| php-debugging | engineering | Keep | |
| php-service | engineering | Keep | |
| playwright-architect | engineering | Keep | shaping vs. writing Playwright; distinct this pass. |
| playwright-testing | engineering | Keep | |
| project-analyzer | engineering | Keep | single-pass tech-stack detection; borders evidence. |
| quality-tools | engineering | Keep | PHPStan / Rector / ECS output handling. |
| react-native-setup | engineering | Keep | |
| react-shadcn-ui | engineering | Keep | |
| sentry-integration | engineering | Keep | error investigation; borders observability cluster. |
| sql-writing | engineering | Keep | |
| symfony-workflow | engineering | Keep | |
| systematic-debugging | engineering | Keep | |
| tailwind-engineer | engineering | Keep | |
| tech-debt-tracker | engineering | Keep | |
| terraform | engineering | Keep | |
| terragrunt | engineering | Merge → terraform | terragrunt wraps terraform multi-env; candidate fold if cull warrants. |
| test-driven-development | engineering | Keep | |
| test-performance | engineering | Keep | |
| testing-anti-patterns | engineering | Keep | |
| traefik | engineering | Keep | |
| ui-component-architect | engineering | Keep | |
| universal-project-analysis | engineering | Keep | multi-pass audit orchestrator; borders evidence. |
| using-git-worktrees | engineering | Keep | |
| source-discovery | engineering | Keep | read-the-real-source evidence gate before coding. |
| dcf-modeling | finance | Keep | |
| forecast-accuracy | finance | Keep | sales-forecast call construction. |
| forecasting | finance | Keep | finance-side forecast; distinct from forecast-accuracy (sales) this pass. |
| fundraising-narrative | finance | Keep | |
| runway-cognition | finance | Keep | |
| scenario-modeling | finance | Keep | |
| unit-economics-modeling | finance | Keep | |
| activation-design | product | Keep | |
| build-buy-partner | product | Keep | |
| churn-prevention | product | Keep | |
| comp-banding | product | Keep | people/comp. |
| competitive-moat-analysis | product | Keep | |
| competitive-positioning | product | Keep | NOTE: this is package-vs-peer comparison; borders agent-admin but reads as product strategy. |
| contracts-cognition | product | Keep | legal-contract reading for risk/constraint; fits no listed family cleanly — parked in product as a business-judgment lens. |
| customer-research | product | Keep | |
| deal-qualification-meddic | product | Keep | sales. |
| discovery-interview | product | Merge → customer-research | discovery-interview + customer-research both shape discovery interviews. |
| expansion-playbook | product | Keep | |
| funnel-analysis | product | Keep | |
| gtm-launch | product | Keep | |
| hiring-loop-design | product | Keep | people/org. |
| market-entry-analysis | product | Keep | |
| okr-tree-modeling | product | Keep | |
| onboarding-design | product | Keep | customer onboarding. |
| onboarding-program | product | Keep | employee onboarding; distinct audience from onboarding-design. |
| one-on-one-cadence | product | Keep | people/org. |
| org-design | product | Keep | |
| perf-feedback-craft | product | Keep | people/org. |
| pipeline-strategy | product | Keep | sales. |
| po-discovery | product | Merge → customer-research | ticket-shaping/problem-framing; overlaps discovery cluster but PM-facing — soft merge candidate. |
| positioning-strategy | product | Keep | |
| premortem | product | Keep | pre-commit failure imagination; borders review/meta-config. |
| rice-prioritization | product | Keep | |
| retention-loops | product | Keep | |
| stakeholder-tradeoff | product | Keep | |
| throughput-vs-morale-tradeoff | product | Keep | people/org. |
| vision-articulation | product | Keep | |
| estimate-ticket | product | Keep | ticket sizing; sibling of refine-ticket. |
| refine-ticket | product | Keep | ticket refinement before planning. |
| validate-feature-fit | product | Keep | feature-fit check; borders review. |
| blameless-post-mortem | product | Keep | incident facilitation; people-process. |
| incident-commander | product | Keep | incident framing/comms. |
| launch-readiness | product | Keep | pre-merge release checklist; borders engineering. |
| jira-integration | product | Keep | ticket tooling. |
| adversarial-review | review | Keep | |
| architecture-review-lens | review | Keep | judge dispatched by /review-changes. |
| bug-analyzer | review | Keep | root-cause analysis of reported bugs. |
| code-review | review | Keep | |
| decision-review | review | Keep | backward audit of a past decision. |
| design-review | review | Keep | UI/UX review. |
| judge-bug-hunter | review | Keep | |
| judge-code-quality | review | Keep | |
| judge-security-auditor | review | Keep | security judge lens (paired with security family). |
| judge-test-coverage | review | Keep | |
| readme-reviewer | review | Keep | |
| receiving-code-review | review | Keep | processing inbound review feedback. |
| requesting-code-review | review | Keep | self-review + PR framing. |
| review-routing | review | Keep | reviewer suggestion + risk flag. |
| risk-officer | review | Keep | pre-commit risk surfacing. |
| root-cause-frameworks | review | Merge → bug-analyzer | 5-whys/fishbone tracing; overlaps bug-analyzer + blameless-post-mortem on RCA. |
| verify-completion-evidence | review | Keep | completion-evidence gate. |
| verify-repair-loop | review | Merge ← verify-completion-evidence | iterate-to-green; pairs tightly with verify-completion-evidence (soft merge candidate). |
| agent-security-review | security | Keep | adversarial review of agent CONFIG (distinct surface from app security). |
| authz-review | security | Keep | |
| blast-radius-analyzer | security | Keep | enumerates dependencies before editing shared code; pre-edit pre-action gate (pairs with data-flow-mapper / threat-modeling). |
| data-flow-mapper | security | Keep | data-flow tracing before edits. |
| data-handling-judgment | security | Keep | classification/retention/transfer. |
| privacy-review | security | Keep | GDPR/CCPA/HIPAA. |
| secrets-management | security | Keep | |
| security | security | Merge → security-audit | generic "security best practices" overlaps the audit + judge-security surfaces. |
| security-audit | security | Keep | merge target; explicit audit request. |
| threat-modeling | security | Keep | |
| analysis-autonomous-mode | meta-config | Keep | autonomous deep-investigation orchestration. |
| analysis-skill-router | meta-config | Keep | routes to project-analysis-* skills. |
| copilot-agents-optimization | meta-config | Merge → copilot-config | both tune AGENTS.md / copilot-instructions surfaces. |
| copilot-config | meta-config | Keep | merge target. |
| devcontainer | meta-config | Keep | dev-environment wiring (not app code; not Copilot). |
| reasoning-orchestrator | meta-config | Keep | reasoning-chain coordination. |
| sequential-thinking | meta-config | Keep | structured decomposition. |
| subagent-orchestration | meta-config | Keep | implementer/judge subagent modes. |
| token-optimizer | meta-config | Keep | pre-action token-saving decision tree. |
| rtk-output-filtering | meta-config | Keep | rtk CLI output filtering. |
| file-editor | meta-config | Keep | opens edited files in the IDE. |
| prompt-validator | meta-config | Keep | pre-spend AI-video prompt contradiction gate; borders video. |
| character-consistency | video | Keep | |
| mcp | meta-config | Keep | MCP server usage reference. |
| mcp-builder | meta-config | Keep | building MCP servers; borders engineering. |
| motion-choreographer | video | Keep | |
| pixar-storyteller | video | Keep | |
| scene-expander | video | Keep | |
| song-to-script | video | Keep | |
| video-director | video | Keep | |
| deep-reading-analyst | content | Keep | long-form article analysis; borders product/review. |
| prediction-pool-optimizer | meta-config | Keep | NOTE: niche domain skill (sports-pool tip optimization) — fits no listed family cleanly; parked in meta-config as the catch-all per the brief. Prune candidate for the leanness track (off-mission for an agent-config suite). |

> **Catch-all note.** `prediction-pool-optimizer` is the one skill that fits no
> family on name+description (it optimizes sports-prediction-pool tips). Per the
> brief it is parked in `meta-config`; the leanness track should treat it as a
> prune/extract candidate (likely off-mission for a coding-agent suite).

## Token-budget reading

The 200k-token context budget (Karpathy peer-review `needs-verification` item:
*does a per-persona load approach practical token limits?*) is measured here
against the **engineering** family as the representative persona-scoped load — it
is the largest family (83 skills) and the most likely single-persona load for a
backend/full-stack engineer.

Method: sum the byte size of all 83 engineering-family `SKILL.md` files (as
assigned in the census table), then approximate tokens as `chars / 4`.

- engineering-family SKILL.md files: **83**
- total bytes: **568,799** (~556 KB)
- approximate tokens: **≈ 142,200** (`568,799 / 4`)
- share of the 200k budget: **≈ 70 %**

**Reading.** Loading *only* the engineering family's skill bodies consumes roughly
70 % of the entire 200k context budget — before any rules, AGENTS.md, conversation
history, tool definitions, or the file under work are added. A naive "load the
whole persona's skills" strategy is therefore **not** economically viable at the
current artifact count: the engineering persona alone would leave under ~60k tokens
for everything else, and a session that touches two families (e.g. engineering +
review) would blow the budget outright.

This confirms the peer-review concern: **artifact count is coupled to runtime
cost**, and F2/F5 are not hygiene — they govern whether persona-scoped context
loads stay viable. Two implications for the leanness and presentation tracks:

1. Per-persona loading must stay **lazy / on-demand** (load a skill body only when
   its trigger fires), not eager — the family grouping is a *navigation* aid, not a
   bulk-load unit.
2. The engineering family (83 of 237 skills) is the most over-represented and the
   highest-value pruning/merge target; the Merge candidates flagged above (the
   `laravel-*` carve-outs, the `performance`/`performance-analysis` pair, the
   observability cluster, `api-endpoint` → `laravel-api-endpoint`) are where the
   cull should start.

> Figures are approximate (`chars/4` token estimate, frontmatter-only family
> assignment) and provisional; they establish the cost baseline that Phase 2's
> presentation work and the leanness cull share.
