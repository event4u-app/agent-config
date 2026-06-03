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

> Totals (recommendation): **125 KEEP · 25 SKILL/fold** of 150.


### pack: `engineering-base`

- [x] `analyze-reference-repo` (analyze-reference-repo) — Analyze an external reference repository (competitor, inspiration, peer) an
- [x] `bug-fix` (bug-fix) — Plan and implement a bug fix — based on investigation, with quality checks 
- [x] `bug-investigate` (bug-investigate) — Investigate a bug — auto-detect ticket from branch, gather Jira/Sentry/desc
- [x] `git-commit` (commit) — Stage + commit; ABSORBS commit-in-chunks — chunking into logical commits is the DEFAULT behavior, not a separate command
- [-] `git-commit-in-chunks` (commit:in-chunks) — INFO: git-commit should do what commit in chunks has done
- [x] `git-pr-create` (create-pr) — Create a GitHub PR with structured description from Jira ticket and code ch
- [x] `git-pr-describe` (create-pr:description-only) — Generate a PR description as a copyable markdown block — used standalone or
- [x] `e2e-test-heal` (e2e-heal) — Find, debug, and fix failing Playwright E2E tests
- [x] `e2e-test-plan` (e2e-plan) — Explore the application and create a structured E2E test plan in Markdown
- [-] `feature` (feature) — Feature orchestrator — routes to explore, plan, refactor, roadmap, dev — _orchestrator head → folds into hyphenated subs_
- [x] `feature-dev` (feature:dev) — Full 7-phase feature development workflow for complex features.
- [-] `feature-explore` (feature:explore) — _MERGE → `feature-plan` (explore is plan's first step)_
- [x] `feature-plan` (feature:plan) — ABSORBS explore + roadmap-decision: runs explore→plan, then asks "roadmap or just a pitch?" (challenge-me style); challenge-me interview available as a mode
- [-] `feature-roadmap` (feature:roadmap) — _MERGE → `feature-plan` (the "make it a roadmap" branch of the plan flow)_
- [x] `feature-refactor` (feature:refactor) — Refine an existing feature plan — KEEP separate (edits an existing plan, not greenfield); challenge-me mode available here too
- [-] `fix` (fix) — Fix orchestrator — routes to ci, references, portability, seeder, pr-commen — _orchestrator head → folds into hyphenated subs_
- [x] `fix-ci` (fix:ci) — Fetch CI errors from GitHub Actions and fix them
- [x] `fix-portability` (fix:portability) — Find and fix project-specific references in shared .augment/ package files
- [-] `fix-pr-bot-comments` (fix:pr-bot-comments) — _MERGE → `fix-pr-comments` (becomes the "bots" answer to its prompt)_
- [x] `fix-pr-comments` (fix:pr-comments) — ABSORBS bot + developer variants: detects NEW/UNANSWERED comments, asks "fix bot / human / both?"; improved detection — dedupe by comment id + reply marker so already-answered comments are never retried
- [-] `fix-pr-developer-comments` (fix:pr-developer-comments) — _MERGE → `fix-pr-comments` (becomes the "human" answer to its prompt)_
- [x] `fix-refs` (fix:refs) — Find and fix broken cross-references in .augment/ and agents/ files
- [x] `fix-seeder` (fix:seeder) — Scan seeder data files for broken foreign key references — find constants u
- [x] `ticket-implement` (implement-ticket) — Drive a ticket end-to-end through refine → memory → analyze → plan → implem
- [-] `judge` (judge) — Judge orchestrator — routes to solo, steps, on-diff — _orchestrator head → folds into hyphenated subs_
- [x] `judge-on-diff` (judge:on-diff) — Run a single change through an implementer→judge loop with a two-revision c
- [x] `judge-solo` (judge:solo) — Run a standalone judge on an existing diff or code change — no implementer,
- [x] `judge-steps` (judge:steps) — Execute an ordered plan step by step with a judge gate between steps — stop
- [-] `module` (module) — Module orchestrator — routes to create, explore — _orchestrator head → folds into hyphenated subs_
- [x] `module-create` (module:create) — Create a new module from .module-template with interactive setup
- [x] `module-explore` (module:explore) — Explore a module — load its structure, docs, and context into the current c
- [x] `package-test` (package-test) — /package-test
- [x] `prepare-for-review` (prepare-for-review) — Prepare a PR branch for local review — updates main and merges the full bra
- [x] `project-analyze` (project-analyze) — Full project analysis — detect stack, inventory modules, audit docs, create
- [x] `project-health` (project-health) — Quick project health check — show status of docs, modules, contexts, and ro
- [x] `fix-quality` (quality-fix) — Run quality pipeline (PHP and/or JS/TS) and fix all errors — auto-detects l
- [x] `review-changes` (review-changes) — Self-review local changes before creating a PR — dispatches to five special
- [-] `sync-gitignore` (sync-gitignore) — Sync the `event4u/agent-config` block in the consumer project's .gitignore  — _orchestrator head → folds into hyphenated subs_
- [-] `sync-gitignore-fix` (sync-gitignore:fix) — Scrub legacy pre-`/agents/` patterns from the consumer's .gitignore (inside — _internal/mechanical, agent-invoked inline_
- [-] `tests` (tests) — Tests orchestrator — routes to create, execute — _orchestrator head → folds into hyphenated subs_
- [x] `test-create` (tests:create) — Write meaningful tests for current-branch changes — STACK-ADAPTIVE (composes the consumer's per-stack test skills: PHP, JS/TS, etc.), not PHP-only
- [x] `test-run` (tests:execute) — Run the consumer project's tests — STACK-ADAPTIVE: runs ALL test types it finds (frontend, scripts, PHP, …); `--php` (or a prompt) narrows to one stack. NOT PHP/Docker-locked. Composes per-stack run skills
- [x] `threat-model` (threat-model) — Run a pre-implementation threat model on a proposed change — enumerates abu
- [x] `update-form-request-messages` (update-form-request-messages) — Sync the messages() method of a FormRequest class — add missing entries, li
- [x] `work` (work) — Drive a free-form prompt end-to-end through refine → score → plan → impleme

### pack: `meta`

- [x] `session-handoff` (agent-handoff) — Generate a context summary for continuing work in a fresh chat. Replaces th
- [x] `session-status` (agent-status) — Show current conversation stats — message count, token costs, task progress
- [-] `agents` (agents) — Agent-layer orchestrator — routes to init, optimize, audit. Covers AGENTS.m — _orchestrator head → folds into hyphenated subs_
- [x] `agents-audit` (agents:audit) — Audit agent infrastructure — token overhead, rule triggers, AGENTS.md healt
- [x] `agents-init` (agents:init) — Initialize the agent layer for a consumer project — creates AGENTS.md and .
- [x] `agents-optimize` (agents:optimize) — Refactor AGENTS.md to the Thin-Root contract (caps, pointer ratio, capabili
- [x] `agents-user` (agents:user) — User-persona file (.agent-user.md) — interview, render, and maintain who th
- [x] `agents-user-accept` (agents:user-accept) — Apply a buffered observation to .agent-user.md after explicit user confirma
- [x] `agents-user-init` (agents:user-init) — Interactive interview that creates the project-root .agent-user.md from the
- [x] `agents-user-review` (agents:user-review) — List buffered observations from .agent-user.observations.jsonl with numbere
- [x] `agents-user-show` (agents:user-show) — Read-only render of .agent-user.md — prints the persona summary the host ag
- [x] `agents-user-update` (agents:user-update) — Open .agent-user.md in the user's IDE for manual edit; validates schema and
- [-] `analytics` (analytics) — Analytics orchestrator — routes to show, prune. Local-only workspace event  — _orchestrator head → folds into hyphenated subs_
- [x] `analytics-prune` (analytics:prune) — Drop events older than the 90-day retention window from the local analytics
- [x] `analytics-show` (analytics:show) — Render top prompts, launcher → completion rate per role, average session le
- [-] `challenge-me` (challenge-me) — Challenge-me orchestrator — routes to vision, with-docs — _orchestrator head → folds into hyphenated subs_
- [x] `challenge-me-vision` (challenge-me:vision) — Stress-test a plan or idea by one-question-at-a-time interview until 95% co
- [x] `challenge-me-with-docs` (challenge-me:with-docs) — Doc-aware /challenge-me — 95%-confidence interview with session glossary vs
- [-] `chat-history` (chat-history) — Chat-history orchestrator — routes to show, import, learn — _orchestrator head → folds into hyphenated subs_
- [x] `chat-history-import` (chat-history:import) — Surface prior chat-history sessions as a numbered table, let the user pick 
- [x] `chat-history-learn` (chat-history:learn) — Pick a prior chat-history session and mine it for project-improving learnin
- [x] `chat-history-show` (chat-history:show) — Show the status of the persistent chat-history log — file size, entry count
- [x] `check-current-md` (check-current-md) — Check the open .md file (or a passed path) for German outside DE:/EN: ancho
- [x] `docs-condense` (condense) — Condense .md files from .agent-src.uncondensed/ into telegraph format and w
- [-] `context` (context) — Context orchestrator — routes to create, refactor — _orchestrator head → folds into hyphenated subs_
- [x] `context-create` (context:create) — Analyze a codebase area and create a structured context document
- [x] `context-refactor` (context:refactor) — Analyze, update, and extend an existing context document
- [x] `cost-report` (cost-report) — Capture token cost from the active Claude Code session, append to the local
- [-] `council` (council) — Council orchestrator — routes to default, pr, design, optimize, analysis, d — _orchestrator head → folds into hyphenated subs_
- [x] `council-analysis` (council:analysis) — Run the council on a local analysis output (project-analyze, audit script, 
- [x] `council-debate` (council:debate) — Multi-round council debate with progressive cost disclosure — each member p
- [x] `council-default` (council:default) — Default council lens — neutral framing, redacted context, advisory output o
- [x] `council-design` (council:design) — Run the council on a design document, ADR, or architecture proposal — surfa
- [x] `council-optimize` (council:optimize) — Run the council on an optimization target — perf hot path, memory pattern, 
- [x] `council-pr` (council:pr) — Pull a GitHub PR via gh CLI and run the council on the diff with a PR-speci
- [x] `grill-me` (grill-me) — Alias for /challenge-me — interactive grill-style interview that sharpens a
- [-] `memory` (memory) — Memory orchestrator — routes to add, load, mine-session, promote, propose — _orchestrator head → folds into hyphenated subs_
- [x] `memory-add` (memory:add) — Interactively add a validated entry to an engineering-memory file (domain-i
- [x] `memory-learn-low-impact` (memory:learn-low-impact) — Preview validated low-impact entries that would be upstreamed to the packag
- [x] `memory-load` (memory:load) — Load ALL curated entries of a given memory type into the current context — 
- [x] `memory-mine-session` (memory:mine-session) — Mine the active session transcript for memory signals (corrections, prefere
- [x] `memory-promote` (memory:promote) — Promote an intake signal (or provisional proposal) into a curated memory en
- [x] `memory-propose` (memory:propose) — Append a provisional memory signal to the intake stream — the universal fal
- [x] `role-mode` (mode) — Set the active role mode — prints the contract, lists default skills, and r
- [-] `optimize` (optimize) — Optimize orchestrator — routes to skills, agents-dir, augmentignore, rtk-fi — _orchestrator head → folds into hyphenated subs_
- [x] `optimize-prompt` (optimize-prompt) — Optimize a raw prompt for ChatGPT, Claude, Gemini, or another AI via the 4-
- [x] `optimize-agents-dir` (optimize:agents-dir) — Manage the agents/ directory — scaffold, folder-audit, fix. Single command 
- [x] `optimize-augmentignore` (optimize:augmentignore) — Creates or updates .augmentignore based on the project's actual tech stack,
- [x] `optimize-rtk` (optimize:rtk) — Create or optimize project-local rtk filters based on the actual toolchain
- [x] `optimize-skills` (optimize:skills) — Audits skills — measures baseline, finds duplicates/merge candidates, runs 
- [x] `orchestrate` (orchestrate) — Run a YAML pipeline defined under `.agent-config/orchestrations/` — chains 
- [-] `override` (override) — Override orchestrator — routes to create, manage — _orchestrator head → folds into hyphenated subs_
- [x] `override-create` (override:create) — Creates a project-level override for a shared skill, rule, or command.
- [x] `override-manage` (override:manage) — Reviews, updates, and refactors existing project-level overrides.
- [x] `package-reset` (package-reset) — /package-reset
- [-] `profile` (profile) — Session-profile orchestrator — activate / deactivate / show the active pack — _orchestrator head → folds into hyphenated subs_
- [x] `profile-activate` (profile:activate) — Activate a session profile — surface only the named profile/pack closure pl
- [x] `profile-deactivate` (profile:deactivate) — Deactivate the session profile — clear the overlay (or drop named packs) so
- [x] `profile-show` (profile:show) — Show the active session profile — active packs and surfaced/hidden command+
- [x] `review-routing` (review-routing) — Compute reviewer roles and matched historical bug patterns for the current — _future_state: skill (system-introspection, agent-inline; not a user workflow)_
- [x] `rule-compliance-audit` (rule-compliance-audit) — Audit rule trigger quality, simulate activation, detect overlaps, and find — _future_state: skill behind agent-admin (introspection)_
- [x] `set-cost-profile` (set-cost-profile) — Change the rule_loading_tier in .agent-settings.yml — shows each profile's 
- [x] `skill` (skill) — Single-skill orchestrator — routes to preview. Non-destructive "what will t
- [x] `skill-preview` (skill:preview) — Non-destructive preview of a skill — its declared steps, execution type, al — _future_state: skill behind agent-admin (introspection)_
- [-] `skills` (skills) — Skill discovery orchestrator — routes to discover. Local, explained skill r — _orchestrator head → folds into hyphenated subs_
- [x] `skills-discover` (skills:discover) — Recommend skills for a role — ranked by four explained classes (most-useful — _future_state: skill behind agent-admin (introspection)_
- [x] `sync-agent-settings` (sync-agent-settings) — Sync `.agent-settings.yml` against the current template + profile — adds ne
- [x] `upstream-contribute` (upstream-contribute) — Contribute a learning, skill, rule, or fix from a consumer project back to 

### pack: `product-basic`

- [x] `ticket-estimate` (estimate-ticket) — Estimate a Jira/Linear ticket before sprint planning — size + risk + split 
- [x] `ticket-jira` (jira-ticket) — Read Jira ticket from branch name, analyze linked Sentry issues, implement 
- [x] `ticket-refine` (refine-ticket) — Refine a Jira/Linear ticket before planning — rewritten ticket + Top-5 risk
- [-] `roadmap` (roadmap) — Roadmap orchestrator — routes to create (authoring) and process-step / proc — _orchestrator head → folds into hyphenated subs_
- [x] `roadmap-ai-council` (roadmap:ai-council) — Challenge a roadmap with the AI council (deep tier) and refactor from conve
- [x] `roadmap-create` (roadmap:create) — Interactively create a new roadmap file in agents/roadmaps/
- [x] `roadmap-process-full` (roadmap:process-full) — Autonomously process every open step across every phase of a roadmap until 
- [x] `roadmap-process-phase` (roadmap:process-phase) — Autonomously process every open step in the next or current phase of a road
- [x] `roadmap-process-step` (roadmap:process-step) — Autonomously process the single next open step of a roadmap and stop. Small

### pack: `product-discovery`

- [-] `knowledge` (knowledge) — Knowledge orchestrator — routes to ingest, list, forget. Local-only file in — _orchestrator head → folds into hyphenated subs_
- [x] `knowledge-cross-repo` (knowledge:cross-repo) — Targeted, read-only retrieval over opted-in linked-project siblings (ADR-03
- [x] `knowledge-forget` (knowledge:forget) — Drop a knowledge ingest from `agents/memory/knowledge/` by id prefix. Atomi
- [x] `knowledge-ingest` (knowledge:ingest) — Walk a local path (folder, .zip, single file), redact PII + secrets, chunk 
- [x] `knowledge-list` (knowledge:list) — List existing knowledge ingests in `agents/memory/knowledge/` (table or JSO
- [-] `research` (research) — Preliminary research scaffolder — pick objects, define fields, emit `outlin — _orchestrator head → folds into hyphenated subs_
- [x] `research-deep` (research:deep) — Read `outline.yaml`, research each item in batches, write per-item JSON val
- [x] `research-report` (research:report) — Summarise per-item JSON results from `/research:deep` into `report.md`. Age

### pack: `gtm-marketing`

- [-] `ghostwriter` (ghostwriter) — Ghostwriter cluster — fetch, write, list, show, and delete public-figure vo — _orchestrator head → folds into hyphenated subs_
- [x] `ghostwriter-delete` (ghostwriter:delete) — Hard-delete a ghostwriter profile at agents/reference/ghostwriter/<slug>.md
- [x] `ghostwriter-fetch` (ghostwriter:fetch) — Build or refresh a public-figure voice profile under agents/reference/ghost
- [x] `ghostwriter-list` (ghostwriter:list) — List captured ghostwriter profiles under agents/reference/ghostwriter/ as a
- [x] `ghostwriter-show` (ghostwriter:show) — Render a single ghostwriter profile in full — identity, style fingerprint, 
- [x] `ghostwriter-write` (ghostwriter:write) — Draft a markdown post in the voice of a captured public-figure ghostwriter 
- [-] `post-as` (post-as) — Consumer-facing write entry points — :me drafts in the maintainer's own voi — _orchestrator head → folds into hyphenated subs_
- [x] `post-as-ghostwriter` (post-as:ghostwriter) — Thin alias for /ghostwriter:write — drafts a copyable markdown post in a ca
- [x] `post-as-me` (post-as:me) — Draft a copyable markdown post in the maintainer's own voice (style source 

### pack: `ai-video`

- [-] `image` (image) — Character-image fidelity orchestrator — analyse, create, and verify a chara — _orchestrator head → folds into hyphenated subs_
- [x] `image-analyse` (image:analyse) — Analyse a character image down to the smallest mole and diff it against a c
- [x] `image-create` (image:create) — Generate a character image to spec — assemble a max-fidelity, anchors-first
- [x] `image-verify` (image:verify) — Verify a candidate render against its canon — run the analyser in loop mode
- [-] `video` (video) — Video-creation orchestrator — Hollywood-level AI video pipeline. Routes to  — _orchestrator head → folds into hyphenated subs_
- [x] `video-from-script` (video:from-script) — Drive a script end-to-end through the AI video pipeline — scenes → blueprin
- [x] `video-from-song` (video:from-song) — Music-video from a song + reference images — accept or derive a timed scene
- [x] `video-scene` (video:scene) — Render a single scene from a one-line idea — scene-expander → blueprint → i
- [x] `video-stitch` (video:stitch) — Re-stitch existing clips in `<project>/scenes/*/` after operator edits — no
- [x] `video-storyboard` (video:storyboard) — Image-only storyboard — script → scenes → blueprint → image render → contac

### pack: `fun`

- [x] `prediction-pool` (prediction-pool) — Fill a prediction pool (kicktipp, football/basketball WM): optimize expecte
