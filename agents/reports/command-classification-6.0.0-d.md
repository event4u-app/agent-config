# Command rename & classification worksheet (6.0.0-D)

> Companion to `agents/roadmaps/road-to-6.0.0-d-structural-restructure.md` Phase 4b. Lives under `agents/reports/` (not `agents/roadmaps/`) so the 150 worksheet checkboxes do NOT pollute the roadmap progress dashboard.

> **Council-converged scheme (claude-sonnet-4-5 + gpt-4o, 2026-06-03):** `<pack>-<verb>`, **hyphenated**. Claude shadows bare colon cluster-heads and does NOT support two-colon multi-level (`git:pr:create` ✗) — confirmed via claude-code-guide. So cluster heads fold away and each sub becomes a flat hyphenated command (`feature:plan` → `feature-plan`). Sub-actions are a separate command only if a distinct workflow, else a flag. KEEP vs SKILL weighs state-mutation + user verification, not just who invokes it.

> **How to curate:** every row is pre-marked with the council recommendation — `[x]` = stays a command (renamed), `[-]` = convert to skill / fold away. **Flip any you disagree with.** Names are proposals — edit freely. This worksheet drives a follow-up implementation pass; it is NOT a phase gate.

> **`future_state` axis (feedback-3) — prepares 6.1.** Beyond `[x]`/`[-]`, each
> row can carry an intended end-state so 6.1 consolidation is pre-planned:
> `command` (stays a visible command) · `skill` (becomes a skill / agent-inline)
> · `alias` (kept only as a deprecation alias to a survivor) · `remove` (delete
> outright). Annotated inline as `_future_state: …_` where decided; the rest are
> for the maintainer to fill.
>
> **Council challenge verdict (2026-06-03):** the system was challenged, not just
> refactored. Stack-adaptive commands are correct but `--all` is a monorepo
> footgun (default = fast tests, `--include-slow` opt-in); every interactive
> command MUST work non-interactively (CI has no TTY → `--yes`/`--json`/defaults);
> the 4-layer model is heavy for day-one; KILL candidates: separate
> security/performance review commands, stack-variant commands, low-usage
> system-introspection. These are 6.1 execution; recorded here + in the roadmap's
> "Future architecture & consolidation" section.

> **Read this as FLOWS, not 125 commands** (GPT feedback). Every row carries a
> `·_flow:<x>_` tag so 6.1 is discussed at the flow level. The flow map today:
>
> | Flow | ~count | what it is |
> |---|--:|---|
> | **discovery** | 16 | explore / plan / estimate / refine / investigate before building |
> | **implementation** | 9 | build it (work · ticket-implement · feature-dev · bug-fix) |
> | **review** | 8 | check it (review-changes · judge · quality · threat-model) |
> | **delivery** | 10 | ship it (git-commit · git-pr · pr-comments · prepare-for-review) |
> | **agent-admin** | ~56 | **NOT a flow — it is the PLATFORM / SYSTEM surface** (feedback-6). The other flows describe user *work* (discovery/implementation/review/delivery); agent-admin is system *administration* (memory · analytics · governance · config). It does not belong in `src/flows/`; it is the admin/platform layer, almost all skills + a couple of state-queries. The real 6.1 question was never "which of these become skills" but "is agent-admin a flow at all?" — answer: no. |
> | domain flows | ~36 | media · marketing · sales · product · finance · strategy · people · content · fun |
> | session | 3 | handoff / status / mode |
> | (untagged) | ~22 | mostly agent-admin / setup-once internals — skill-candidates; the maintainer assigns a flow only to the ones that stay commands |
>
> The user-facing developer story is **discovery → implementation → review →
> delivery** (~43 commands behind ~4 flows). agent-admin is the admin surface,
> not a daily flow. **These `·_flow:` tags are the SEED for first-class flow
> artefacts** (feedback-5): 6.0-D scaffolds `src/flows/<flow>.yaml` stubs
> (Step 15b), 6.1 fills the schema — `entry_points` / `default_path` / `skills`
> per flow (`road-to-6.1.0` Step 8b/9). Flows stop being tags and become the
> primary view: `Profile → Pack → Flow → Command → Skill → Rule`.

> **Governing rule — a COMMAND only earns a top-level slot in 3 cases; everything
> else is a SKILL** (deep council + feedback-7, 2026-06-03 — 29 was too
> aggressive: user *features* were being buried as skills):
>
> 1. **Flow-entry** — a daily starting point of a flow (`work`, `git-commit`,
>    `git-pr-create`, `ticket-implement`, `feature-plan`, `review-changes`,
>    `fix-ci`, `bug-fix`, `test-run`).
> 2. **State-query** — read-only, typed many times/day (`agent-status`,
>    `project-health`, `profile-show`, `analytics-show`).
> 3. **Product-surface** — a FEATURE the user starts deliberately (not daily, but
>    consciously): `council`, `challenge-me`, `research`, `roadmap`,
>    `video-storyboard`. These are not implementation helpers — burying them as
>    skills destroys discoverability. A skill is `code-review` / `git-workflow` /
>    `testing`; it is NOT `council` / `challenge-me` / `research`.
>
> Sweet spot ≈ **40–50 commands** (≈15 workflow + ≈10 status/admin + ≈15–20
> product features), NOT 29 (too few, features vanish) and NOT 125 (too many).
>
> **Destructive ops are NOT a command category** (maintainer line, overruling the
> council's "precision-admin" exception): a destructive action (`knowledge-forget`,
> `ghostwriter-delete`, prune, …) becomes a **skill with a mandatory confirmation
> gate** — the confirm covers the mis-parse risk, so it does not need to occupy a
> top-level command slot. Destructive ≠ command.
>
> Plus: polysemous verbs (`show`/`fix`/`sync`/`update`/`manage`/`describe`) →
> SKILL unless daily AND unambiguous-when-scoped (`fix-ci` is fine). Sibling
> variants → a flag, never a second command. Orchestrator heads without a default
> action → SKILL. Council target: **~33 commands survive, ~117 → skills.**
> Caveat: aggressive demotion needs reliable task→skill routing — handled at
> CONVERSION time (6.1) via a confirmation gate on each new skill, NOT a telemetry
> wait. Nothing is lost: a demoted command's behavior stays reachable as a
> task-triggered skill.

> Totals (recommendation): **30 KEEP · 120 SKILL/fold** of 150 right now. The
> 3-category rule above is the contract; the maintainer re-promotes the remaining
> **product-surface** features (e.g. `ghostwriter`, and other deliberately-started
> features) toward the **40–50 sweet spot**. council / challenge-me / research /
> roadmap are already re-promoted (feedback-7 + user). See "§ Surviving command
> set" at the bottom.


### pack: `engineering-base`

- [-] `analyze-reference-repo` (analyze-reference-repo) — Analyze an external reference repository (competitor, inspiration, peer) an  ·_flow:discovery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `bug-fix` (bug-fix) — Plan and implement a bug fix — based on investigation, with quality checks  ·_flow:implementation_
- [x] `bug-investigate` (bug-investigate) — Investigate a bug — auto-detect ticket from branch, gather Jira/Sentry/desc  ·_flow:discovery_
- [x] `git-commit` (commit) — Stage + commit; ABSORBS commit-in-chunks — chunking into logical commits is the DEFAULT behavior, not a separate command  ·_flow:delivery_
- [-] `git-commit-in-chunks` (commit:in-chunks) — INFO: git-commit should do what commit in chunks has done
- [x] `git-pr-create` (create-pr) — Create a GitHub PR with structured description from Jira ticket and code ch  ·_flow:delivery_
- [-] `git-pr-describe` (create-pr:description-only) — Generate a PR description as a copyable markdown block — used standalone or — _future_state: alias → folds into `git-pr-create --describe` (feedback-4: sub-function, not top-level)_  ·_flow:delivery_  — _SKILL — PR description is part of making the PR, not a daily command_
- [x] `e2e-test-heal` (e2e-heal) — Find, debug, and fix failing Playwright E2E tests  ·_flow:implementation_
- [x] `e2e-test-plan` (e2e-plan) — Explore the application and create a structured E2E test plan in Markdown  ·_flow:implementation_
- [-] `feature` (feature) — Feature orchestrator — routes to explore, plan, refactor, roadmap, dev — _orchestrator head → folds into hyphenated subs_
- [x] `feature-dev` (feature:dev) — Full 7-phase feature development workflow for complex features.  ·_flow:implementation_
- [-] `feature-explore` (feature:explore) — _MERGE → `feature-plan` (explore is plan's first step)_  ·_flow:discovery_
- [x] `feature-plan` (feature:plan) — ABSORBS explore + roadmap-decision: runs explore→plan, then asks "roadmap or just a pitch?" (challenge-me style); challenge-me interview available as a mode  ·_flow:discovery_
- [-] `feature-roadmap` (feature:roadmap) — _MERGE → `feature-plan` (the "make it a roadmap" branch of the plan flow)_  ·_flow:discovery_
- [-] `feature-refactor` (feature:refactor) — Refine an existing feature plan — KEEP separate (edits an existing plan, not greenfield); challenge-me mode available here too  ·_flow:discovery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `fix` (fix) — Fix orchestrator — routes to ci, references, portability, seeder, pr-commen — _orchestrator head → folds into hyphenated subs_
- [x] `fix-ci` (fix:ci) — Fetch CI errors from GitHub Actions and fix them  ·_flow:review_
- [-] `fix-portability` (fix:portability) — Find and fix project-specific references in shared .augment/ package files  ·_flow:delivery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `fix-pr-bot-comments` (fix:pr-bot-comments) — _MERGE → `fix-pr-comments` (becomes the "bots" answer to its prompt)_  ·_flow:delivery_
- [-] `fix-pr-comments` (fix:pr-comments) — ABSORBS bot + developer variants: detects NEW/UNANSWERED comments, asks "fix bot / human / both?"; improved detection — dedupe by comment id + reply marker so already-answered comments are never retried  ·_flow:delivery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `fix-pr-developer-comments` (fix:pr-developer-comments) — _MERGE → `fix-pr-comments` (becomes the "human" answer to its prompt)_  ·_flow:delivery_
- [-] `fix-refs` (fix:refs) — Find and fix broken cross-references in .augment/ and agents/ files  ·_flow:delivery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `fix-seeder` (fix:seeder) — Scan seeder data files for broken foreign key references — find constants u  ·_flow:delivery_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `ticket-implement` (implement-ticket) — Drive a ticket end-to-end through refine → memory → analyze → plan → implem  ·_flow:implementation_
- [-] `judge` (judge) — Judge orchestrator — routes to solo, steps, on-diff — _orchestrator head → folds into hyphenated subs_  ·_flow:review_
- [-] `judge-on-diff` (judge:on-diff) — Run a single change through an implementer→judge loop with a two-revision c  ·_flow:review_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `judge-solo` (judge:solo) — Run a standalone judge on an existing diff or code change — no implementer,  ·_flow:review_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `judge-steps` (judge:steps) — Execute an ordered plan step by step with a judge gate between steps — stop  ·_flow:review_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `module` (module) — Module orchestrator — routes to create, explore — _orchestrator head → folds into hyphenated subs_
- [-] `module-create` (module:create) — Create a new module from .module-template with interactive setup  ·_flow:implementation_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `module-explore` (module:explore) — Explore a module — load its structure, docs, and context into the current c  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `package-test` (package-test) — /package-test  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `prepare-for-review` (prepare-for-review) — Prepare a PR branch for local review — updates main and merges the full bra  ·_flow:delivery_
- [x] `project-analyze` (project-analyze) — Full project analysis — detect stack, inventory modules, audit docs, create  ·_flow:discovery_
- [x] `project-health` (project-health) — Quick project health check — show status of docs, modules, contexts, and ro  ·_flow:discovery_
- [x] `fix-quality` (quality-fix) — Run quality pipeline (PHP and/or JS/TS) and fix all errors — auto-detects l  ·_flow:review_
- [x] `review-changes` (review-changes) — Self-review local changes before creating a PR — dispatches to five special  ·_flow:review_
- [-] `sync-gitignore` (sync-gitignore) — Sync the `event4u/agent-config` block in the consumer project's .gitignore  — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `sync-gitignore-fix` (sync-gitignore:fix) — Scrub legacy pre-`/agents/` patterns from the consumer's .gitignore (inside — _internal/mechanical, agent-invoked inline_  ·_flow:agent-admin_
- [-] `tests` (tests) — Tests orchestrator — routes to create, execute — _orchestrator head → folds into hyphenated subs_
- [x] `test-create` (tests:create) — Write meaningful tests for current-branch changes — STACK-ADAPTIVE (composes the consumer's per-stack test skills: PHP, JS/TS, etc.), not PHP-only
- [x] `test-run` (tests:execute) — Run the consumer project's tests — STACK-ADAPTIVE: runs ALL test types it finds (frontend, scripts, PHP, …); `--php` (or a prompt) narrows to one stack. NOT PHP/Docker-locked. Composes per-stack run skills
- [x] `threat-model` (threat-model) — Run a pre-implementation threat model on a proposed change — enumerates abu  ·_flow:review_
- [-] `update-form-request-messages` (update-form-request-messages) — Sync the messages() method of a FormRequest class — add missing entries, li  ·_flow:implementation_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `work` (work) — Drive a free-form prompt end-to-end through refine → score → plan → impleme  ·_flow:implementation_

### pack: `meta`

- [x] `session-handoff` (agent-handoff) — Generate a context summary for continuing work in a fresh chat. Replaces th  ·_flow:session_
- [x] `session-status` (agent-status) — Show current conversation stats — message count, token costs, task progress  ·_flow:session_
- [-] `agents` (agents) — Agent-layer orchestrator — routes to init, optimize, audit. Covers AGENTS.m — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `agents-audit` (agents:audit) — Audit agent infrastructure — token overhead, rule triggers, AGENTS.md healt  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-init` (agents:init) — Initialize the agent layer for a consumer project — creates AGENTS.md and .  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-optimize` (agents:optimize) — Refactor AGENTS.md to the Thin-Root contract (caps, pointer ratio, capabili  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-user` (agents:user) — User-persona file (.agent-user.md) — interview, render, and maintain who th  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-user-accept` (agents:user-accept) — Apply a buffered observation to .agent-user.md after explicit user confirma  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-user-init` (agents:user-init) — Interactive interview that creates the project-root .agent-user.md from the  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-user-review` (agents:user-review) — List buffered observations from .agent-user.observations.jsonl with numbere  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `agents-user-show` (agents:user-show) — Read-only render of .agent-user.md — prints the persona summary the host ag  ·_flow:agent-admin_  — _SKILL — persona is set once; agent loads it silently at session start_
- [-] `agents-user-update` (agents:user-update) — Open .agent-user.md in the user's IDE for manual edit; validates schema and  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `analytics` (analytics) — Analytics orchestrator — routes to show, prune. Local-only workspace event  — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `analytics-prune` (analytics:prune) — Drop events older than the 90-day retention window from the local analytics — _future_state: skill behind agent-admin (janitor op; explicit confirm, never default)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `analytics-show` (analytics:show) — Render top prompts, launcher → completion rate per role, average session le — _future_state: skill/sub of agent-admin (viewer)_  ·_flow:agent-admin_
- [-] `challenge-me` (challenge-me) — Challenge-me orchestrator — routes to vision, with-docs — _orchestrator head → folds into hyphenated subs_  ·_flow:discovery_
- [-] `challenge-me-vision` (challenge-me:vision) — Stress-test a plan or idea by one-question-at-a-time interview until 95% co  ·_flow:discovery_  — _SKILL — route through one `challenge-me` (asks vision vs with-docs); no sibling commands_
- [-] `challenge-me-with-docs` (challenge-me:with-docs) — Doc-aware /challenge-me — 95%-confidence interview with session glossary vs  ·_flow:discovery_  — _SKILL — route through one `challenge-me`_
- [-] `chat-history` (chat-history) — Chat-history orchestrator — routes to show, import, learn — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `chat-history-import` (chat-history:import) — Surface prior chat-history sessions as a numbered table, let the user pick — _future_state: skill (sub-function, not a top-level workflow)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `chat-history-learn` (chat-history:learn) — Pick a prior chat-history session and mine it for project-improving learnin — _future_state: skill (sub-function)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `chat-history-show` (chat-history:show) — Show the status of the persistent chat-history log — file size, entry count — _future_state: skill (sub-function)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `check-current-md` (check-current-md) — Check the open .md file (or a passed path) for German outside DE:/EN: ancho  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `docs-condense` (condense) — Condense .md files from .agent-src.uncondensed/ into telegraph format and w  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `context` (context) — Context orchestrator — routes to create, refactor — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `context-create` (context:create) — Analyze a codebase area and create a structured context document  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `context-refactor` (context:refactor) — Analyze, update, and extend an existing context document  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `cost-report` (cost-report) — Capture token cost from the active Claude Code session, append to the local  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `council` (council) — Council orchestrator — routes to default, pr, design, optimize, analysis, d  — _COMMAND (product-surface) — `/council` runs the default lens; pr/design/optimize/analysis/debate are modes (flags), not separate commands_
- [-] `council-analysis` (council:analysis) — Run the council on a local analysis output (project-analyze, audit script,  — _→ `council --analysis` mode_
- [-] `council-debate` (council:debate) — Multi-round council debate with progressive cost disclosure — each member p  — _→ `council --debate` mode_
- [-] `council-default` (council:default) — Default council lens — neutral framing, redacted context, advisory output o  — _→ default mode of `council` (folds into it)_
- [-] `council-design` (council:design) — Run the council on a design document, ADR, or architecture proposal — surfa  — _→ `council --design` mode_
- [-] `council-optimize` (council:optimize) — Run the council on an optimization target — perf hot path, memory pattern,  — _→ `council --optimize` mode_
- [-] `council-pr` (council:pr) — Pull a GitHub PR via gh CLI and run the council on the diff with a PR-speci  — _→ `council --pr` mode_
- [-] `grill-me` (grill-me) — Alias for /challenge-me — interactive grill-style interview that sharpens a  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory` (memory) — Memory orchestrator — routes to add, load, mine-session, promote, propose — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `memory-add` (memory:add) — Interactively add a validated entry to an engineering-memory file (domain-i  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory-learn-low-impact` (memory:learn-low-impact) — Preview validated low-impact entries that would be upstreamed to the packag  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory-load` (memory:load) — Load ALL curated entries of a given memory type into the current context —  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory-mine-session` (memory:mine-session) — Mine the active session transcript for memory signals (corrections, prefere  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory-promote` (memory:promote) — Promote an intake signal (or provisional proposal) into a curated memory en  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `memory-propose` (memory:propose) — Append a provisional memory signal to the intake stream — the universal fal  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `role-mode` (mode) — Set the active role mode — prints the contract, lists default skills, and r  ·_flow:session_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `optimize` (optimize) — Optimize orchestrator — routes to skills, agents-dir, augmentignore, rtk-fi — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `optimize-prompt` (optimize-prompt) — Optimize a raw prompt for ChatGPT, Claude, Gemini, or another AI via the 4-  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `optimize-agents-dir` (optimize:agents-dir) — Manage the agents/ directory — scaffold, folder-audit, fix. Single command  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `optimize-augmentignore` (optimize:augmentignore) — Creates or updates .augmentignore based on the project's actual tech stack,  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `optimize-rtk` (optimize:rtk) — Create or optimize project-local rtk filters based on the actual toolchain  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `optimize-skills` (optimize:skills) — Audits skills — measures baseline, finds duplicates/merge candidates, runs  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `orchestrate` (orchestrate) — Run a YAML pipeline defined under `.agent-config/orchestrations/` — chains  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `override` (override) — Override orchestrator — routes to create, manage — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `override-create` (override:create) — Creates a project-level override for a shared skill, rule, or command.  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `override-manage` (override:manage) — Reviews, updates, and refactors existing project-level overrides.  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `package-reset` (package-reset) — /package-reset  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `profile` (profile) — Session-profile orchestrator — activate / deactivate / show the active pack — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `profile-activate` (profile:activate) — Activate a session profile — surface only the named profile/pack closure pl  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `profile-deactivate` (profile:deactivate) — Deactivate the session profile — clear the overlay (or drop named packs) so  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `profile-show` (profile:show) — Show the active session profile — active packs and surfaced/hidden command+  ·_flow:agent-admin_
- [-] `review-routing` (review-routing) — Compute reviewer roles and matched historical bug patterns for the current — _future_state: skill (system-introspection, agent-inline; not a user workflow)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `rule-compliance-audit` (rule-compliance-audit) — Audit rule trigger quality, simulate activation, detect overlaps, and find — _future_state: skill behind agent-admin (introspection)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `set-cost-profile` (set-cost-profile) — Change the rule_loading_tier in .agent-settings.yml — shows each profile's  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `skill` (skill) — Single-skill orchestrator — routes to preview. Non-destructive "what will t  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `skill-preview` (skill:preview) — Non-destructive preview of a skill — its declared steps, execution type, al — _future_state: skill behind agent-admin (introspection)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `skills` (skills) — Skill discovery orchestrator — routes to discover. Local, explained skill r — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `skills-discover` (skills:discover) — Recommend skills for a role — ranked by four explained classes (most-useful — _future_state: skill behind agent-admin (introspection)_  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `sync-agent-settings` (sync-agent-settings) — Sync `.agent-settings.yml` against the current template + profile — adds ne  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `upstream-contribute` (upstream-contribute) — Contribute a learning, skill, rule, or fix from a consumer project back to  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_

### pack: `product-basic`

- [x] `ticket-estimate` (estimate-ticket) — Estimate a Jira/Linear ticket before sprint planning — size + risk + split  ·_flow:discovery_
- [x] `ticket-jira` (jira-ticket) — Read Jira ticket from branch name, analyze linked Sentry issues, implement  ·_flow:implementation_
- [x] `ticket-refine` (refine-ticket) — Refine a Jira/Linear ticket before planning — rewritten ticket + Top-5 risk  ·_flow:discovery_
- [x] `roadmap` (roadmap) — Roadmap orchestrator — routes to create (authoring) and process-step / proc — _orchestrator head → folds into hyphenated subs_  ·_flow:product_  — _COMMAND (product-surface) — DEFAULT action = process the WHOLE roadmap (no scope given → full, because that is why you write roadmaps); `--step`/`--phase` narrow explicitly; `--create` authors. Has a default action, so the bare command is not shadowed_
- [-] `roadmap-ai-council` (roadmap:ai-council) — Challenge a roadmap with the AI council (deep tier) and refactor from conve  ·_flow:product_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `roadmap-create` (roadmap:create) — Interactively create a new roadmap file in agents/roadmaps/  ·_flow:product_  — _→ `roadmap --create` mode (rest of roadmap-* are not separate top-level commands; the user authors via the one roadmap command or a skill)_
- [-] `roadmap-process-full` (roadmap:process-full) — Autonomously process every open step across every phase of a roadmap until  ·_flow:product_  — _→ folds into `roadmap` — it IS the default action (full)_
- [-] `roadmap-process-phase` (roadmap:process-phase) — Autonomously process every open step in the next or current phase of a road  ·_flow:product_  — _→ explicit flag `roadmap --phase`_
- [-] `roadmap-process-step` (roadmap:process-step) — Autonomously process the single next open step of a roadmap and stop. Small  ·_flow:product_  — _→ explicit flag `roadmap --step` (deliberate single-step control mode, kept reachable as a flag, not a separate command)_

### pack: `product-discovery`

- [-] `knowledge` (knowledge) — Knowledge orchestrator — routes to ingest, list, forget. Local-only file in — _orchestrator head → folds into hyphenated subs_  ·_flow:agent-admin_
- [-] `knowledge-cross-repo` (knowledge:cross-repo) — Targeted, read-only retrieval over opted-in linked-project siblings (ADR-03  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `knowledge-forget` (knowledge:forget) — Drop a knowledge ingest from `agents/memory/knowledge/` by id prefix. Atomi  ·_flow:agent-admin_  — _SKILL — destructive → skill + mandatory confirmation gate (maintainer line: destructive ≠ command)_
- [-] `knowledge-ingest` (knowledge:ingest) — Walk a local path (folder, .zip, single file), redact PII + secrets, chunk  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [-] `knowledge-list` (knowledge:list) — List existing knowledge ingests in `agents/memory/knowledge/` (table or JSO  ·_flow:agent-admin_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_
- [x] `research` (research) — Preliminary research scaffolder — pick objects, define fields, emit `outlin — _orchestrator head → folds into hyphenated subs_  ·_flow:discovery_  — _COMMAND (product-surface) — `/research <topic>` is the entry; deep/report are stages (flags/skills)_
- [-] `research-deep` (research:deep) — Read `outline.yaml`, research each item in batches, write per-item JSON val  ·_flow:discovery_  — _→ `research --deep` stage_
- [-] `research-report` (research:report) — Summarise per-item JSON results from `/research:deep` into `report.md`. Age  ·_flow:discovery_  — _→ `research --report` stage_

### pack: `gtm-marketing`

- [-] `ghostwriter` (ghostwriter) — Ghostwriter cluster — fetch, write, list, show, and delete public-figure vo — _orchestrator head → folds into hyphenated subs_  ·_flow:marketing_
- [-] `ghostwriter-delete` (ghostwriter:delete) — Hard-delete a ghostwriter profile at agents/reference/ghostwriter/<slug>.md  ·_flow:marketing_  — _SKILL — destructive ≠ command: a mandatory confirmation gate on the skill covers the mis-parse risk (maintainer overrules the council's precision-admin exception)_
- [-] `ghostwriter-fetch` (ghostwriter:fetch) — Build or refresh a public-figure voice profile under agents/reference/ghost  ·_flow:marketing_  — _SKILL — rare profile op, agent-inline_
- [-] `ghostwriter-list` (ghostwriter:list) — List captured ghostwriter profiles under agents/reference/ghostwriter/ as a  ·_flow:marketing_  — _SKILL — rare profile op, agent-inline_
- [-] `ghostwriter-show` (ghostwriter:show) — Render a single ghostwriter profile in full — identity, style fingerprint,  ·_flow:marketing_  — _SKILL — rare profile op, agent-inline_
- [-] `ghostwriter-write` (ghostwriter:write) — Draft a markdown post in the voice of a captured public-figure ghostwriter  ·_flow:marketing_  — _SKILL — same action as post-as-ghostwriter (draft in a public-figure voice + disclosure); task-triggered, one underlying write-in-voice skill_
- [-] `post-as` (post-as) — Consumer-facing write entry points — :me drafts in the maintainer's own voi — _orchestrator head → folds into hyphenated subs_  ·_flow:marketing_
- [-] `post-as-ghostwriter` (post-as:ghostwriter) — Thin alias for /ghostwriter:write — drafts a copyable markdown post in a ca  ·_flow:marketing_  — _SKILL/alias — literally a thin alias for ghostwriter:write; same skill, do not double the surface_
- [-] `post-as-me` (post-as:me) — Draft a copyable markdown post in the maintainer's own voice (style source  ·_flow:marketing_  — _SKILL — drafting in a voice is task-triggered (write-in-my-voice), not a daily command_

### pack: `ai-video`

- [-] `image` (image) — Character-image fidelity orchestrator — analyse, create, and verify a chara — _orchestrator head → folds into hyphenated subs_  ·_flow:media_
- [-] `image-analyse` (image:analyse) — Analyse a character image down to the smallest mole and diff it against a c  ·_flow:media_  — _SKILL — character-image pipeline op, task-triggered (like video-*)_
- [-] `image-create` (image:create) — Generate a character image to spec — assemble a max-fidelity, anchors-first  ·_flow:media_  — _SKILL — character-image pipeline op, task-triggered (like video-*)_
- [-] `image-verify` (image:verify) — Verify a candidate render against its canon — run the analyser in loop mode  ·_flow:media_  — _SKILL — character-image pipeline op, task-triggered (like video-*)_
- [-] `video` (video) — Video-creation orchestrator — Hollywood-level AI video pipeline. Routes to  — _orchestrator head → folds into hyphenated subs_  ·_flow:media_
- [-] `video-from-script` (video:from-script) — Drive a script end-to-end through the AI video pipeline — scenes → blueprin  ·_flow:media_  — _SKILL — pipeline internal, task-triggered_
- [-] `video-from-song` (video:from-song) — Music-video from a song + reference images — accept or derive a timed scene  ·_flow:media_  — _SKILL — pipeline internal, task-triggered_
- [-] `video-scene` (video:scene) — Render a single scene from a one-line idea — scene-expander → blueprint → i  ·_flow:media_  — _SKILL — pipeline stage, task-triggered_
- [-] `video-stitch` (video:stitch) — Re-stitch existing clips in `<project>/scenes/*/` after operator edits — no  ·_flow:media_  — _SKILL — pipeline stage, task-triggered_
- [x] `video-storyboard` (video:storyboard) — Image-only storyboard — script → scenes → blueprint → image render → contac  ·_flow:media_

### pack: `fun`

- [-] `prediction-pool` (prediction-pool) — Fill a prediction pool (kicktipp, football/basketball WM): optimize expecte  ·_flow:fun_  — _SKILL — not flow-entry / state-query (2-category rule); task-triggered_

---

## § Surviving command set (30 marked → ~40–50 sweet spot)

> 3-category rule (flow-entry · state-query · product-surface). agent-admin is the
> platform surface, NOT in this set. The maintainer re-promotes the remaining
> product features toward the 40–50 sweet spot.

**Flow-entry / workflow (daily starting points)**
- discovery: `bug-investigate` · `ticket-refine` · `ticket-estimate` · `feature-plan` · `project-analyze`
- implementation: `work` · `ticket-implement` · `feature-dev` · `bug-fix` · `e2e-test-plan` · `e2e-test-heal`
- review: `review-changes` · `fix-ci` · `fix-quality` · `threat-model`
- delivery: `git-commit` · `git-pr-create` · `prepare-for-review`
- test: `test-run` · `test-create` · ticket: `ticket-jira`

**Product-surface (deliberately started features)**
- `council` (default lens; pr/design/optimize/analysis/debate = modes)
- `challenge-me` (vision/with-docs = modes)
- `research` (deep/report = stages)
- `roadmap` — **default = process the whole roadmap (full)**; `--step`/`--phase`
  narrow explicitly; `--create` authors. (No scope given → full, because that is
  why you write roadmaps; this eases the work.)
- `video-storyboard` (triggers the media flow)

**State-query (read-only, typed daily)**
- `agent-status` · `session-status` · `session-handoff` · `project-health` · `profile-show` · `analytics-show`

The point: ~40–50 commands behind clear flows + features, not 125, and not 29
(which buried real features). Anything reached "sometimes" as an implementation
detail is a skill the agent triggers by task.
