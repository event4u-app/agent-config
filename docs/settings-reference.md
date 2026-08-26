# Settings reference — every key, its class, and its default

> **Generated** by `src/scripts/generate_settings_reference.ts` — do NOT
> hand-edit. Derived from the zod settings schema plus the A/B/C class
> table in [`settings-classes`](contracts/settings-classes.md).
> Drift-checked in CI (`--check`).

Your global settings file is **sparse**: it records the decisions you
actually made, not every key that exists. A key absent from the file
resolves to the default listed here. This page is where the long-form
explanation lives now that the file no longer carries it as comments.

**Class** answers one question — *who may write this key.*

- **A** — preference — the agent may set it; you are never asked
- **B** — consent — the agent asks once, then persists your answer
- **C** — guarded — only you (GUI or hand-edit) may change it

## (root)

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `agent_config_version` | C | string | `""` |  | Pin the package to an exact semver (e.g. "1.4.2") so all teammates load the same skill / rule set. Leave empty to track whatever is installed locally — useful for the maintainers of this package, risky for production projects. |
| `discipline_profile` | C | string |  | `auto` · `off` · `essential` · `full` | The ONE runtime knob for the discipline-rule tier (successor of rule_loading_tier; council 2026-07-07). off = kernel only (~1x tokens). essential = kernel + the measured lift-carrying rules (~3.3x, keeps the weak-host discipline lift). full = everything (~11.7x, EXPERIMENTAL — residual lift over essential not established). auto = resolve per session against the evidence-gated NULL-lift disable-list in src/config/host-capabilities.yml (measured-null host → off, otherwise → essential). Optional and opt-in until the P1/P2 evidence gates pass (agents/roadmaps/road-to-discipline-profile-tiering.md); absent = legacy rule_loading_tier applies. |
| `rule_loading_tier` | C | string | `"balanced"` | `minimal` · `balanced` · `full` · `custom` | Master switch for which rule tiers load and how cautiously the agent spends tokens. minimal = only the 9 kernel rules (cheapest, fewest guardrails). balanced = kernel + tier-1 (recommended default). full = kernel + tier-1 + tier-2 (most guardrails, highest token cost). custom = roll your own in agents/overrides/. LEGACY: superseded by discipline_profile — when that key is set it wins (mapping: minimal→off, balanced→essential, full→full). |

## ai_team

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `ai_team.allow_delegate` | C | boolean | `false` |  | Second opt-in for the only wrapper that delegates write access (/team:delegate). false (default) = delegate refuses even when /team itself is available. Availability (codex CLI installed + authenticated) is necessary but not sufficient — this key must ALSO be true before delegation is reachable. |
| `ai_team.max_calls_per_day` | C | integer | `50` |  | Per-day cap on team calls, read against the EXISTING cli_call_budget openai bucket (~/.event4u/agent-config/cli-calls.json, daily UTC reset) — one subscription, one counter, never a parallel count. 0 = block all team calls. |
| `ai_team.model` | C | string | `"auto"` |  | Model handed to the codex CLI. 'auto' (default) = pass no --model flag so the CLI's own default applies — tracks the subscription's current strongest model instead of pinning a stale ID. Any other value passes through verbatim as `--model <value>`. |
| `ai_team.review_gate.managed` | C | boolean | `false` |  | Managed governance of the codex plugin's Stop-hook Review Gate (road-to-team-mode Phase 4). false (default) = byte-identical pre-Phase-4 behavior: no counting, no circuit breaker. true = count consecutive BLOCK verdicts per session and trip the circuit breaker at max_consecutive_blocks. |
| `ai_team.review_gate.max_consecutive_blocks` | C | integer | `3` |  | Circuit-breaker bound: after this many CONSECUTIVE BLOCK verdicts in one session, a visible notice is injected exactly once and the managed layer stops re-blocking — the user decides, never an infinite Claude↔Codex loop. An ALLOW verdict resets the counter. Positive integer. |
| `ai_team.suppress_setup_hint` | A | boolean | `false` |  | Suppress the one-line wizard/init recommendation to set up the codex plugin on Claude-Code hosts. Cosmetic only — never changes behavior. |

## augment

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `augment.rules_use_symlinks` | A | boolean | `false` |  | When true, .augment/rules/*.md are symlinks into dist/agent-src/rules/ — edits flow back to source on save. When false (default), they are copies — safer on Windows and shared volumes, but rule edits in .augment/ are lost on the next `task sync`. |

## chat_history

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `chat_history.enabled` | C | boolean | `true` |  | Persist a structured log of every chat turn to .agent-config/chat-history/ so /chat-history:show, :import, and :learn can replay sessions. Turn off if you never want chat transcripts on disk. |
| `chat_history.frequency` | C | string | `"per_turn"` | `per_turn` · `per_phase` · `per_tool` | How often the chat-history writer flushes to disk. per_turn = after every user / agent exchange (default, lowest data loss on crash). per_phase = at phase boundaries (cheaper I/O). per_tool = after every tool call (highest fidelity, noisiest log). |
| `chat_history.text_limits.agent` | C | integer | `5000` |  | Per-message character cap for agent replies in the chat-history log. Truncates with an ellipsis past the cap. Lower to shrink history files, raise for long-reasoning replies. |
| `chat_history.text_limits.phase` | C | integer | `200` |  | Per-marker character cap for phase markers (Phase=Refine, Phase=Plan, …) in the chat-history log. Rarely needs tuning. |
| `chat_history.text_limits.tool` | C | integer | `200` |  | Per-call character cap for tool input / output blobs in the chat-history log. The default 200 keeps history files compact while preserving enough signal to replay a session. |
| `chat_history.text_limits.user` | C | integer | `0` |  | Per-message character cap for user inputs in the chat-history log. 0 = log verbatim (default). Raise above 0 only if your prompts contain large pasted artefacts you do not want stored. |

## code_style

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `code_style.docblocks` | A | string | `"minimal"` | `minimal` · `full` | Consumed by the code-comment-discipline rule. minimal (default) = no signature-mirroring docblocks; docblocks only for machine-relevant precision (generics, array shapes) or genuine why-context. full = the exported public surface of a library package may carry one-line summary docblocks; the redundancy ban still holds. |

## commands

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `commands.auto_detect` | C | string | `"enabled"` | `enabled` · `warn` · `disabled` | Global kill-switch for orchestrator auto-detection (6.1.0 non-interactive-contract). enabled (default) = /judge, /fix, /analytics, /tests, /override auto-detect their sub-command per a confidence-tiered table; warn = detect but always confirm before routing; disabled = never auto-detect (always show the menu interactively, require an explicit sub-command in CI). Per-orchestrator override: auto_detect:false in front-matter. Per-invocation: --no-auto-detect. |
| `commands.create_pr.api_examples` | A | boolean | `true` |  | JSON request/response examples for API-endpoint changes. true (default) = include a fenced example ONLY when grounded in a real source (response DTO/resource, OpenAPI/schema, test fixture, or an actual probe); no grounded source → a one-line pointer, never an invented example. false = never add API examples. |
| `commands.create_pr.api_paths` | C | array | `[]` |  | Optional glob list that makes API-endpoint detection explicit instead of heuristic (e.g. ["app/Http/Controllers/Api/**", "src/pages/api/**"]). Empty (default) = a light path/extension heuristic that fails open. |
| `commands.create_pr.detail_level` | A | string | `"min"` | `min` · `med` · `max` | Verbosity tier for the generated PR description body. min (default) = title + 2-3 sentence what/why/impact + linked ticket (token-frugal); med = min + grouped changes + tests note; max = med + how-to-test + edge cases + reviewer guidance. Critical info (breaking changes, migrations, security, rollback) is ALWAYS included at every tier — the tier governs explanatory depth, never whether a critical callout appears. |
| `commands.create_pr.preview_description` | C | boolean | `false` |  | When /create-pr runs, show the generated title and body and wait for confirmation before opening the PR. Off by default (zero-friction PR creation); turn on if you want a last-look gate. |
| `commands.create_pr.screenshots` | C | boolean | `false` |  | Screenshots for frontend changes. false (default) = never attempt. true = attempt when the host has browser/preview tooling and the diff touches a frontend surface; capability-gated (emits a one-line note and leaves the placeholder when tooling is absent, never fails or blocks the PR). Before/after + changed-region highlighting is best-effort. |
| `commands.create_pr.ui_paths` | C | array | `[]` |  | Optional glob list that makes frontend detection explicit instead of heuristic (e.g. ["resources/views/**", "src/pages/**"]). Empty (default) = a light path/extension heuristic that fails open (no false enrichment when the surface is ambiguous). |
| `commands.suggestion.blocklist` | C | array | `[]` |  | Slash-command names that should never be suggested, one per line (e.g. "commit", "create-pr"). Useful if a command misfires on your common phrasing. |
| `commands.suggestion.confidence_floor` | A | number | `0.6` |  | Minimum semantic-match score (0.0–1.0) before a command is offered as a suggestion. 0.6 (default) balances precision and recall. Raise toward 0.8 for fewer false positives, lower for broader hints. |
| `commands.suggestion.cooldown_seconds` | A | integer | `600` |  | How long (seconds) the suggester waits before offering the same command again after you ignored it. Default 600s (10 min) keeps the agent from nagging. Set 0 to disable the cooldown. |
| `commands.suggestion.enabled` | A | boolean | `true` |  | Master switch for the slash-command suggestion layer. When on, the agent offers numbered options ("did you mean /commit?") instead of guessing. Turn off if you prefer to type every command yourself. |
| `commands.suggestion.max_options` | A | integer | `4` |  | Maximum number of command suggestions shown in a single numbered-options block, before the "Proceed as-is" escape. Lower for terser prompts, raise if you regularly want broader fan-out. |

## consistency

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `consistency.cross_source` | C | string | `"on"` | `on` · `auto` · `off` | Consumed by the cross-source-consistency rule. When the agent works from multiple sources (ticket text, an attached image/mockup, the spec, the codebase) it checks them against each other and asks before proceeding on a discrepancy — instead of silently guessing. on (default) = surface every real cross-source contradiction / silent-scope-expansion as one question; auto = surface only high-confidence contradictions, state low-confidence as an assumption; off = no cross-source checking. |

## cost

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `cost.budgets.daily` | C | number | `0` |  | Daily USD ceiling across all model calls. The agent warns at 50% / 75% / 90% and either stops or warns at 100% depending on cost.enforcement. Set 0 to disable the daily budget entirely. |
| `cost.budgets.monthly` | C | number | `0` |  | Calendar-month USD ceiling. Pairs with cost.enforcement = hard-stop for a hard cap on agent spend before the next billing cycle. Set 0 to disable. |
| `cost.budgets.per_tier.cheap` | C | unknown | `null` |  | USD ceiling for the cheap model tier. Budget-aware delegation was ARCHIVED 2026-08-16 (docs/contracts/budget-routing.md), so no code routes on this today; the cap is still summed and reported by `budget.mjs tier`. null = no separate tier cap; global ceilings still apply. |
| `cost.budgets.per_tier.medium` | C | unknown | `null` |  | USD ceiling for the medium model tier. null = no separate tier cap. |
| `cost.budgets.per_tier.strong` | C | unknown | `null` |  | USD ceiling for the strong model tier. null = no separate tier cap. The never-block-to-save-money relation this used to describe went with the archived budget-routing layer (docs/contracts/budget-routing.md); nothing routes between tiers today. |
| `cost.budgets.weekly` | C | number | `0` |  | Rolling 7-day USD ceiling. Same alert ladder as cost.budgets.daily but useful when work bursts unevenly across the week. Set 0 to disable. |
| `cost.enforcement` | C | string | `"advisory"` | `advisory` · `hard-stop` | What happens when a budget hits 100%. advisory = show a banner, keep working (default — never blocks an active task). hard-stop = refuse further model calls until the budget resets or you raise the ceiling. |

## decision_engine

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `decision_engine.ask_timeout_seconds` | C | integer | `30` |  | Non-TTY timeout (seconds) for decision_engine.on_block = ask. After this elapses without input, decision_engine.on_block_fallback takes over. Default 30s; raise for slow human review, 0 = wait forever. |
| `decision_engine.block_on_risk` | C | string | `"off"` | `off` · `low` · `medium` · `high` | During Phase=Implement, refuse to act when the risk class meets or exceeds this band. off (default) = no gate. low / medium / high = stricter ceilings; pairs with decision_engine.on_block. |
| `decision_engine.min_confidence` | C | string | `"off"` | `off` · `low` · `medium` · `high` | During Phase=Plan, refuse to advance to Phase=Implement if confidence is below this band. off (default) = no gate. low / medium / high = raise the floor; on miss, decision_engine.on_block decides what happens. |
| `decision_engine.on_block` | C | string | `"stop"` | `stop` · `ask` · `warn` | What the decision engine does when a gate (min_confidence / block_on_risk / require_memory_hits) fires. stop (default) = halt and surface the reason. ask = present numbered options. warn = log and continue. |
| `decision_engine.on_block_fallback` | C | string | `"stop"` | `stop` · `warn` | Resolution when decision_engine.on_block = ask times out (see decision_engine.ask_timeout_seconds). stop (default) = halt the run. warn = log and continue with the agent's best guess. |
| `decision_engine.require_memory_hits` | C | boolean | `false` |  | During Phase=Refine, require at least one relevant memory hit (skill, ADR, past decision) before the agent proceeds. Off by default; turn on for highly conventional codebases where memory should always inform decisions. |
| `decision_engine.surface_traces` | C | boolean | `false` |  | Emit DecisionTraceHook events that surface why the agent picked one option over another. Useful when debugging unexpected choices; off by default to keep chat noise low. |

## design

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `design.fidelity_mode` | C | string | `"strict"` | `strict` · `structural` · `hard-floor` | How strictly the agent must follow a user-provided prototype / mockup / design system (consumed by the design-fidelity rule). strict = build 1:1, every visible deviation needs confirmation; structural = structure locked, silent gaps fillable with a stated assumption; hard-floor = any deviation is never autonomous. |

## eloquent

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `eloquent.access_style` | A | string | `"getters_setters"` | `getters_setters` · `get_attribute` · `magic_properties` | How the agent writes Laravel Eloquent property access. getters_setters = explicit getName() / setName() methods (most refactor-safe). get_attribute = $model->getAttribute("name") (verbose but explicit). magic_properties = $model->name (idiomatic but harder to grep). |

## emergency

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `emergency.orchestration_halt` | C | boolean | `false` |  | The one audited incident switch over the always-on orchestration stack (subagents, council, team). NOT an activation gate: false (default) = the stack runs normally. true = halted; arming requires no ceremony. Disarming (returning to false) requires orchestration_halt_justification to be a non-empty string. Both transitions emit one telemetry line. |
| `emergency.orchestration_halt_justification` | C | string | `""` |  | Required non-empty before orchestration_halt may return to false. Ignored while arming the halt. |

## explain

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `explain.enable_last` | A | boolean | `true` |  | Enable the `agent-config explain last` command, which prints the reasoning behind the agent's most recent decision (last tool call, last suggestion). Disable if you never use it and want a smaller CLI surface. |

## github

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `github.pr_reply_method` | A | string | `"create_review_comment"` | `replies_endpoint` · `create_review_comment` · `auto` | How the agent replies to PR review comments. create_review_comment = post a new review comment (works on every GitHub plan). replies_endpoint = thread the reply under the original comment (needs the newer REST endpoint). auto = detect at runtime, prefer threaded replies when available. |

## hooks

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `hooks.code_graph.enabled` | C | boolean | `false` |  | PreToolUse code-graph nudge (ADR-124 Phase 4). Default off. When on AND a native code-graph cache or a consumer-shipped graph.json/SCIP index is present, warns once per session (never blocks) as the agent is about to Grep/Glob or Read a source file — query the graph first for who-calls/where-used/impact questions (or rebuild if stale, build if absent). Source G’s strict block-first-read mode is deliberately un-ported. |
| `hooks.concern_budget.hard_fail` | C | boolean | `false` |  | When a hook exceeds hooks.concern_budget.max_per_event, fail the run (true) instead of warning and continuing (false, default). Turn on in CI when you want hook quality to gate merges. |
| `hooks.concern_budget.max_per_event` | C | integer | `8` |  | Maximum number of concerns (issues / warnings) a single hook may raise per (platform, event) pair before the hook is rate-limited. Default 8 prevents noisy hooks from drowning out high-signal ones. |
| `hooks.concern_budget.tier1_concerns` | C | array | `[]` |  | Concern IDs (one per line) that are allowed to block the run on failure rather than warn. Reserved for high-confidence guards — leave empty unless you maintain custom hooks. |
| `hooks.design_pass.enabled` | C | boolean | `false` |  | PostToolUse + stop design pass (road-to-frontend-power E1.1/E1.2/E1.3). Default off. One concern on two slots: on post_tool_use a write to a UI surface delivers the design findings as context and never blocks; on stop the same pass runs over every UI file touched this session, deduped against what the post pass surfaced, and a P0 objective floor (contrast, font size, heading skip, focus) blocks with a continuation. P1-P3 never block. post_tool_use rather than pre_tool_use for two measured reasons: pre_tool_use is declared by three hosts and honoured by one while post_tool_use is declared by six, and _lib/ui_surface.ts is a path predicate, so a pre-write gate cannot fire on the first write of a new surface. A pass that could not fully run reports verification: degraded with a reason rather than passing silently. Does not replace design_slop: two design keys is the honest state until the tiering experiment has a number. |
| `hooks.design_slop.enabled` | C | boolean | `false` |  | PreToolUse anti-slop nudge (road-to-anti-slop-detector Phase 3). Default off. When on, runs the lint_design_slop registry against about-to-be-written UI content and WARNS (never blocks) on P0/P1 aesthetic tells (side-stripe, gradient-text, magic z-index, …). Flags are rebuttable via DESIGN.md / design-slop-disable. Anti-loop: a file::rule signature surfaced 3x goes silent. Host-limited convenience layer; the universal gate is the lint_design_slop linter/CI. |
| `hooks.injection_scan.enabled` | C | boolean | `false` |  | PostToolUse prompt-injection scanner (road-to-security-pillar.md P3.2). Default off. When on, scans tool output (file reads, web fetches, MCP responses) for injection signatures and WARNS in context (never blocks). Runtime backstop on top of the always-on untrusted-input-defense rule; detection is probabilistic. |
| `hooks.rtk_wrap.enabled` | C | boolean | `false` |  | PreToolUse RTK-wrap nudge (token-saving Phase 3). Default off. When on AND the binary on PATH is verified as Rust Token Killer (a live two-stage identity probe — not a self-reported flag, and never a colliding same-name binary), warns (never blocks) "re-run wrapped with rtk" before a single verbose CLI command (git/npm/cargo/docker/…) — upstream reports 60–90% output-token savings (their estimate). Skips completeness-critical / piped / compound commands and git diff. No-op when rtk is absent, unverified, or a different tool. |
| `hooks.suggestion_capture.enabled` | C | boolean | `false` |  | Suggestion-block capture (road-to-suggestion-block-capture Phase 2). Default off. Two slots: `stop` reads `last_assistant_message` — a payload field, so no transcript file is read — and latches that the assistant turn carried a numbered-options block; `user_prompt_submit` CONSUMES that latch and classifies the answering turn as option_n / as_is / other / stale_block. Consume-once is the correctness guard: the latch is deleted on read, so a bare "1" three turns later meets no latch and classifies `other`, and a latch past its TTL or unparseable is `stale_block` rather than a guess. Writes COUNTS ONLY to agents/runtime/state/audit/suggestion-capture.jsonl — the record type has no field able to hold a prompt, an option label or a command name, and a test asserts the written key set against src/config/suggestion-capture.json. Off by default because this is an INSTRUMENT rather than a feature: it exists so a capture rate can be measured on a maintainer workspace over a fixed soak window, and there is nothing in it for a consumer to gain. |
| `hooks.ui_route_nudge.enabled` | C | boolean | `false` |  | PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4). Default off. When on, a Write/Edit to a UI surface with no design consultation latched this session WARNS (never blocks) naming the route — run existing-ui-audit, then the fe-design loop. A read or search touching fe-design / existing-ui-audit / design-review / design-intelligence latches consultation and silences it for the session. Anti-loop: at most 2 nudges per session. It does not read the rules: the UI-surface decision comes from _lib/ui_surface.ts and no code parses rule frontmatter, so this runs parallel to the two UI rules rather than consuming their triggers, and a test keeps the sets from drifting. It is a nudge, so their enforced_by: none stays accurate. |

## knowledge

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `knowledge.global_sharing.allowed_tiers` | C | array | `["public"]` |  | Origin tiers auto-eligible to cross a project boundary. proprietary is manual-only regardless (the gate hard-codes it), so an in-house schema never auto-shares. |
| `knowledge.global_sharing.auto_promote_threshold` | C | integer | `2` |  | Distinct-repo count at which a public/vendor card triggers a promotion suggestion (never a silent write). |
| `knowledge.global_sharing.enabled` | C | boolean | `true` |  | Master switch for the file-first global knowledge-card store (ADR-100; default-ON per ADR-119, the validated bounded-downside flip superseding ADR-103 — write-time redaction incl. hidden-unicode hardening, narrowest tier default, pre-registered demotion trigger). User-global setting — keep in ~/.event4u/agent-config/agent-settings.yml. false fully no-ops the layer (single-key revert); project-local cards (v1) are unaffected. |
| `knowledge.global_sharing.freshness.hypothesis_after_days` | A | integer | `90` |  | A global card older than this is lead-only (positive structure must be re-confirmed before use). |
| `knowledge.global_sharing.freshness.stale_after_days` | A | integer | `180` |  | A global card older than this is skipped until re-verified. |
| `knowledge.global_sharing.redaction.enabled` | C | boolean | `true` |  | Run the privacy-floor + source-confidentiality scan before any card goes global. |
| `knowledge.global_sharing.redaction.halt_on_trigger` | C | boolean | `true` |  | Halt-and-surface on a confidential-pattern hit; never silent-share, never auto-rewrite. |

## lean_projection

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `lean_projection.mode` | C | string | `"eager-all"` | `eager-all` · `thin` | How the per-tool projector emits the rule layer. eager-all = every rule body inlined into every projection (default, safe). thin = kernel rules full-bodied + non-kernel rules as router-resolved pointers (~45k GPT-tok lighter per session). EXPERIMENTAL: validate with the live A/B before flipping; one-flip revert to eager-all. |

## legal_review_prep

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `legal_review_prep.acknowledged` | C | boolean | `false` |  | I understand the legal-review-prep pack provides templates and general information ONLY — it is NOT legal advice, creates no attorney-client relationship, and never replaces a licensed lawyer. Individual cases require an attorney. The pack stays inactive until this is checked. |
| `legal_review_prep.require_council` | C | boolean | `true` |  | Gate legal work-product behind a multi-model AI-council / deep-research pass (defense-in-depth: documented multi-stage review + audit trail; fail-closed when no council is configured). Leave on for the safest posture. Turning it off lets single-model legal output through — not recommended for a high-risk pack. |

## memory

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `memory.cadence` | C | string | `"always"` | `auto` · `always` · `never` | Cadence of the 🧠 memory-visibility line after a memory-consulting step. always (default) = show whenever a memory type was asked; auto = show only when 3+ types were consulted (less noise); never = suppress. Distinct from rule_loading_tier — owns its own key since the 2026-06-01 untangle. |
| `memory.learn_on_session_end` | B | boolean | `false` |  | session_end learning-sidecar aggregation (road-to-reachable-code-memory P4). true = the session_end hook aggregates agents/memory/intake/*.jsonl through the learning sidecar into the gitignored .agent-learning.json + LESSONS.md (local-only, 2 s budget, fail-open; promotion stays human via /memory:propose). false (default, council 2026-07-27) = no-op; the flip is proposed only after the 30-day dogfood shows non-trivial signal AND session-end p95 < 2 s. |
| `memory.redact_patterns` | C | array | `[]` |  | Regex patterns (one per line) that scrub matches from chat-history transcripts and memory before they hit disk. Use for secrets, customer names, internal URLs. Patterns are anchored and case-insensitive. |
| `memory.review_threshold` | A | integer | `10` |  | Maximum number of memory entries /memory:load surfaces inline before falling back to a summary view. Default 10 keeps the chat readable. Raise to see more candidates, lower to keep the context tight. |
| `memory.session_index` | A | string | `"off"` | `on` · `off` | Opt-in compact memory index at session start (road-to-memory-retrieval-economy P5). on = inject a compact id + title + ~tokens index of curated entries (hard cap 30 rows, bodies never included) through the hot-context hook; the agent fetches full entries via memory_get on demand. off (default) = no injection — the ship-criterion (measured hit-rate gain) is unproven, so off unless proven. |

## model

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `model.auto_switch` | C | string | `"suggest"` | `auto` · `suggest` · `off` | Per-skill model auto-switch (ADR-035). Skills declare a vendor-neutral model_tier (lite/medium/high); the generator maps it to a native Claude model (high→opus, medium→sonnet, lite→haiku). suggest (default) = never emit a native Claude model: key; the model-recommendation rule names the tier as a one-question suggestion on every surface — your explicit /model choice is never silently overridden. auto = render a native Claude model: into lite/medium/high-tier skills so Claude Code switches automatically for that turn (reverts next prompt), and suggest on surfaces without a native override. off = inert, no native key and no suggestion. |

## onboarding

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `onboarding.onboarded` | C | boolean | `false` |  | Set to true once the developer has completed `agent-config setup`. The onboarding-gate rule blocks the first turn of every chat until this is true. Toggle back to false to re-trigger the wizard. |

## personal

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `personal.autonomy` | C | string | `"auto"` | `on` · `off` · `auto` | How aggressively the agent suppresses trivial workflow questions ("commit now?", "open PR?"). on = silently pick the sensible default. off = always ask. auto (default) = decide per project, on for solo / off when collaborators are involved. The Hard Floor (prod, deploys, bulk deletes) ignores this setting and always asks. |
| `personal.canary_name` | B | string | `""` |  | Session canary — the name the agent addresses you with at the start of every new task (e.g. "Alex"). When the greeting silently disappears, the context window is degrading: start a fresh conversation. Also keeps the reply-close markers (end-summary, PR URL as literal last line) alive. Empty = fall back to the user-global canary_name, then to identity.name from the setup wizard; no name anywhere = off. See rules/session-canary.md. |
| `personal.ide` | C | string | `""` |  | CLI binary your IDE registers (code, code-insiders, phpstorm, cursor, windsurf, idea, subl, …). Used by the file-editor skill to open edited files. Leave empty to disable IDE integration. |
| `personal.minimal_output` | A | boolean | `true` |  | Prefer short bullets and tables (true, default) vs verbose prose with rationale (false). Affects every chat reply; flip to false during debugging when you want the agent to think out loud. |
| `personal.open_edited_files` | B | boolean | `false` |  | After the agent edits a file, run `<ide> <path>` to surface it in your editor immediately. Off by default to avoid window-stealing during long agent runs. |
| `personal.play_by_play` | A | boolean | `false` |  | Narrate intermediate findings between tool calls ("Found it.", "Let me check Y."). Off by default — most users find it noisy. Turn on when you want to follow the agent's reasoning step by step. |
| `personal.pr_comment_bot_icon` | A | boolean | `false` |  | Prefix every PR review-comment reply with 🤖 so humans can tell agent-authored comments apart from teammate comments at a glance. Cosmetic only; the comment body itself never changes. |
| `personal.pr_progress_comments` | C | boolean | `false` |  | Permit the agent to post unsolicited progress / status comments on an open PR (e.g. "CI fix iteration #2", "still blocked on workflow scope"). Default off — most teammates find them noisy. User-invoked flows (/fix:pr-comments, /create-pr, /code-review, explicit "post a comment that …") are NOT gated by this setting. See rules/no-pr-progress-comments.md. |
| `personal.rtk_installed` | A | boolean | `false` |  | Does this machine have rtk (Rust Token Killer, a third-party Apache-2.0 tool: https://github.com/rtk-ai/rtk) on PATH — verified as the real Token Killer, not the unrelated Rust Type Kit that shares the binary name? When true the agent wraps verbose CLI output (git, tests, linters, docker, npm, composer) with rtk (upstream reports 60-90% token savings — their estimate). Leave false if rtk is missing — the agent falls back to tail / grep. The wizard overwrites this from a live two-stage probe (PATH presence + `rtk gain` identity check). |
| `personal.user_type` | C | string | `""` | `` · `consultant` · `creator` · `developer` · `finance` · `founder` · `gtm` · `ops` | Optional persona axis used by the skill-suggester to surface the relevant subset (consultant / creator / developer / finance / founder / gtm / ops). Empty = no filter, all skills available. You can change this any time without re-running setup. |

## pipelines

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `pipelines.skill_improvement` | A | boolean | `true` |  | After a meaningful task the agent proposes a learning-capture turn (new skill, rule tweak, guideline). Turn off if you find the prompts noisy — you can still run /memory:promote manually. |

## planning

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `planning.challenge_on_create` | C | boolean | `true` |  | Gate C — plan-confidence gate before authoring. true (default) = a plan-artifact ask (/roadmap:create, roadmap-writing, /feature:plan, /feature:roadmap) first checks the four 95%-confidence conditions from /challenge-me vision; any gap routes into the interview (or the inline degrade protocol) before authoring, and a confident pass emits exactly one marker line. false = inert, plan asks author directly. An explicit user bypass always wins for that turn and is counted. |
| `planning.completion_review` | C | boolean | `true` |  | Gate R2 — completion review at 100% roadmap completion / pre-PR. true (default) = a findings-before-fixes review by a fresh reviewer context must exist for the current diff hash (or an exact honest-null / skip declaration) before fix commits and PR creation, enforced by check_completion_review at pre-push + CI (CI authoritative; a crashed validator warns and allows). false = escape hatch, the validator skips. |
| `planning.risk_review` | C | boolean | `true` |  | Gate R1 — plan-risk review. true (default) = every ready (non-draft) plan must carry a schema-valid "## Risk Register" section (ranked risks, mitigation + anchor per row, freshness marker, exact honest-null grammar), enforced by lint_plan_risk_register at pre-push + CI. false = escape hatch, the validator skips. |

## profile

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `profile.id` | C | string | `"developer"` | `developer` · `content_creator` · `founder` · `agency` · `finance` · `ops` | Which experience you run — the audience identity that selects your default skill / command surface, README entry-path, and persona pre-selection (ADR-010, docs/contracts/profile-system.md). Six seed profiles: developer · content_creator · founder · agency · finance · ops. This is the first wizard question. In 6.0.0-A it records the choice only; pack-scoped surfacing (projection-time filtering, ADR-040) activates in 6.0.0-B behind a staged, opt-in rollout. Switch later with `agent-config use --profile=<id>`. |

## project

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `project.audience` | C | string | `"public"` | `self` · `internal` · `client` · `public` | Who this project is built for — read by the demand gate (§ 8-pre of docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md), whose L0-L4 ladder measures MARKET demand and is meaningless where no market is intended. self = a tool its maintainer builds for themselves; the gate is inert and work is classified L-self (build) instead of being deferred for lack of a user population nobody wants. internal = a team tool; only "what breaks without it?" survives. client = built for a named client, who is the requester rather than a market segment. public (default) = a product with an intended market; full three-question gate, behaviour unchanged from before this key existed. |
| `project.improvement_pr_branch_prefix` | A | string | `"improve/agent-"` |  | Branch-name prefix for improvement PRs the agent opens against project.upstream_repo (e.g. "improve/agent-add-react-skill"). Pick a prefix your repo conventions allow. |
| `project.pr_template` | C | string | `".github/pull_request_template.md"` |  | Path (relative to project root) to the PR-description template the agent fills in before opening a pull request. Override only if your repo keeps the template somewhere non-standard. |
| `project.upstream_repo` | C | string | `""` |  | GitHub slug (owner/repo) the upstream-contribute skill targets when you ask the agent to push a learning back to the shared agent-config package. Empty = improvement PRs are disabled. |

## projection

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `projection.mode` | C | string | `"legacy-all"` | `legacy-all` · `scoped` | Whether the per-tool projector writes EVERY artefact into the host-tool trees (.claude/ .cursor/ .windsurf/) or only the active profile + packs' artefacts (ADR-040, docs/contracts/capability-packs.md). legacy-all = (default, non-breaking) project the full surface exactly as 5.x did. scoped = project only the active profile's packs unioned with the runtime.active_packs overlay, expanded over the requires graph — opt in with `agent-config use --profile=<id>`. A failed scoped projection restores the full tree. |
| `projection.rule_packs` | C | unknown | `[]` |  | Optional second scoping axis for the RULE layer, per pack ids (src/config/discovery/packs.yml). When set, a non-kernel rule also needs a packs frontmatter intersection to ship — e.g. deselecting frontend-design drops ui-audit-gate + design-fidelity. Same opt-in / human-gate semantics as rule_workspaces. The literal "auto" derives the id list from the active-pack set (the same set the skill/command prune uses), so a domain safety floor stops shipping into installs that do not have the pack it guards; an explicit list stays supported and wins over the derivation. |
| `projection.rule_workspaces` | C | array | `[]` |  | Workspace scope for the RULE layer only (road-to-request-scoped-rule-load P1/P1b, opt-in). Absent or empty = legacy-all: every rule projects AND installs. Non-empty = only rules whose workspaces frontmatter intersects this list are projected (condense) and installed (install.sh + global wizard payload). Kernel rules always ship; untagged rules fail safe. The default flip to a scoped value is a HUMAN release gate — do not set this from automation. |

## quality

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `quality.local_auto_run` | C | boolean | `false` |  | Run quality tools (linters, type-checks, formatters) and the local test suite autonomously after edits. Off by default — the agent never runs quality tools proactively and does not ask; the user runs them manually (e.g. /quality-fix) and remote CI is the authoritative gate. The agent only runs a quality tool on an explicit ask, a concrete CI failure, or the new-gate carve-out. Turn on to restore autonomous pipeline runs. |

## reasoning

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `reasoning.auto_gate` | C | boolean | `true` |  | Engage the discipline only where it pays, using table-free signals (task triviality + agent-self-assessed host reasoning strength; no runtime model->band lookup, per ADR-035). false = gate on task-signal + the component toggles only. |
| `reasoning.components.complexity_first` | C | boolean | `true` |  | Risk-first: resolve the load-bearing unknown before the easy parts (RDP derivation, not a Fable-documented behavior). |
| `reasoning.components.decision_ledger` | C | boolean | `true` |  | Log decision + alternatives + reason + revisit-if; escalates to decision-record/ADR when durable. |
| `reasoning.components.grounding` | C | boolean | `true` |  | Explore the environment / close info-gaps before designing. |
| `reasoning.components.intent` | C | boolean | `true` |  | Infer the underlying goal before solving the literal ask (standard host only). |
| `reasoning.components.notes_first` | C | boolean | `true` |  | Keep hypotheses/predictions/decisions in session notes; the response carries conclusions + evidence only. |
| `reasoning.components.orchestrator` | C | boolean | `true` |  | Sequence the reasoning chain (ground->intent->notes->gather->audit->verify) as one system; the single coordination point. |
| `reasoning.components.prediction_tracking` | C | boolean | `true` |  | Log prediction + confidence + outcome + lesson (calibration loop). |
| `reasoning.components.uncertainty_budget` | C | boolean | `true` |  | Per-dimension uncertainty score that feeds adaptive effort. |
| `reasoning.components.verifier_default` | C | boolean | `true` |  | Run a fresh-context verifier on the structural-complexity gate (branching/constraints/stateful/irreversible + token floor). |
| `reasoning.enabled` | C | boolean | `true` |  | Master switch for the Reasoning Discipline Protocol (RDP). false = the whole layer is inert (zero overhead). |

## roadmap

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `roadmap.dashboard_regen_cadence` | A | string | `"every_5_steps"` | `per_step` · `every_5_steps` · `phase_boundary` | How often the agent regenerates agents/roadmaps/dashboard.md during a roadmap run. every_5_steps = batch the regen (default). per_step = after every step (freshest dashboard, highest subprocess overhead). phase_boundary = only at phase edges. A rename, phase add, or archive always regenerates immediately regardless. |
| `roadmap.gate_budget.max_cost_per_rolling_7d_usd` | C | number | `25` |  | Rolling 7-day USD ceiling for class-1 gate execution, summed from the append-only receipt ledger at agents/runtime/state/gate-budget-ledger.jsonl. A run whose estimate would cross it renders instead of running. A per-run cap alone bounds one mistake, not a week of them, which is why option (a) of b-gate-budget-preauth carries two numbers. |
| `roadmap.gate_budget.max_cost_per_run_usd` | C | number | `5` |  | Per-run USD ceiling for a CLASS-1 roadmap blocker executed via `agent-config gates --execute`. A class-1 entry whose **Budget:** field states a larger figure renders its consent line instead of running. Bounds the size of an authorised spend; never supplies the authorisation — `--confirm` is still required on every class-1 run. |
| `roadmap.horizon_weeks` | C | integer | `0` |  | Optional planning horizon (weeks) the agent shows in roadmap framing ("next 4 weeks"). Set 0 to omit the horizon — most teams prefer to ship without a hardcoded window. |
| `roadmap.quality_cadence` | C | string | `"end_of_roadmap"` | `end_of_roadmap` · `per_phase` · `per_step` | When the agent runs the full quality / test suite during /roadmap:process-* runs. end_of_roadmap = once, after the last step (fastest, default). per_phase = after each phase boundary. per_step = after every single step (slowest, highest confidence). |
| `roadmap.skip_pre_run_gate` | C | boolean | `true` |  | Skip the /roadmap:process-* pre-run confirmation gate. true (default) starts processing immediately and surfaces the resolved config inline; false shows the numbered-options gate and waits. A genuine "which roadmap?" ambiguity always prompts regardless. |

## screenshots

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `screenshots.data_bearing_gate` | C | string | `"on"` | `on` · `off` | Consumed by the doc-screenshot-hygiene rule. on (default) = a data-bearing screenshot embed is gated behind this-turn human confirmation; uncertain/unresolved regions redact-or-refuse, never ship-and-hope; illustrative/no-data screenshots may embed with a stated justification. off = no data-bearing gate (the anonymization taxonomy still applies). |
| `screenshots.forbid_terminal_capture` | C | boolean | `true` |  | Consumed by the doc-screenshot-hygiene rule. true (default) = terminal/CLI/IDE screenshots are forbidden (highest leak vector: absolute local paths, env tokens); use text code blocks with text redaction instead. false = allowed, still subject to the data-bearing human gate. |
| `screenshots.identity_allowlist` | C | array | `[]` |  | Consumed by the doc-screenshot-hygiene rule and screenshot-hygiene skill. Public identity tokens SAFE to show unredacted in a documentation screenshot — the maintainer's own public handles plus well-known fake-data tokens. Not a general fake-data dictionary and not identity-resolution: everything not listed is treated as sensitive by default, and a public handle co-located with a real name does not whitelist the real name. Default [] = nothing auto-allowed. |

## subagents

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `subagents.adversarial_council` | C | string | `"off"` | `off` · `ask` · `on` | Opt-in adversarial-verification-council mode (subagent-orchestration Mode 9, ADR-122). off (default) = never runs; ask = offer it on an explicit high-risk change; on = auto-run on high-risk changes. Advisory only — a panel of distinct-model skeptics red-teams a real change for defect FINDING coverage and NEVER auto-gates it (Hard Floor). Stays default-off until the adversarial-council-finding-coverage claim is backed. |
| `subagents.downshift` | C | boolean | `true` |  | Route delegable sub-tasks to the lowest-capable model tier (cost + speed via model downshift). false = every subagent runs on the session tier. |
| `subagents.implementer_model` | C | string | `""` |  | Override the model the orchestrator dispatches to subagents that write code (e.g. claude-sonnet-4, gpt-5). Empty (default) = inherit the session's primary model — cheapest and usually right. |
| `subagents.judge_model` | C | string | `""` |  | Override the model used for review / judge subagents that critique implementer output. Empty (default) = one tier above the implementer model — picks up nuance the implementer missed. |
| `subagents.max_parallel` | C | integer | `3` |  | Hard cap on subagents running in parallel during /do-in-parallel, /do-competitively, and /judge runs. Raise for faster fan-out, lower if you hit rate limits or want lower token spend. |
| `subagents.model_ceiling` | C | string | `""` |  | Session-wide model CEILING for subagents (spend cap). Empty (default) = no ceiling. When set, suite-owned CLI spawn wrappers export CLAUDE_CODE_SUBAGENT_MODEL to the sessions they launch. Class C: a human sets it; the agent never writes or infers one. |
| `subagents.model_map.high` | C | string | `""` |  | Model alias for high-tier sub-tasks. Empty = the tier runtime default. |
| `subagents.model_map.lite` | C | string | `""` |  | Model alias for lite-tier sub-tasks. Empty = the tier runtime default. |
| `subagents.model_map.medium` | C | string | `""` |  | Model alias for medium-tier sub-tasks. Empty = the tier runtime default. |
| `subagents.quota_arbitrage` | C | boolean | `true` |  | Prefer a separate quota-pool model for delegable sub-tasks where the host manifest reports one. Optional bonus only — identical behaviour (minus the quota win) where unsupported. Never load-bearing. |

## telegraph

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `telegraph.speak` | C | boolean | `false` |  | Whether the telegraph-speak rule ships at all. false (default) = DORMANT: compile_router omits the rule from dist/router.json entirely, so its body never reaches a host. This is the only lever that stops the cost. Set true only after an output-side bench clears the kill-criterion bar (docs/adrs/telegraph/0002). |

## tokens

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `tokens.rich_skills` | C | string | `"on"` | `on` · `ask` · `off` | Whether skills marked token_budget_class: rich may load in full (exempt from telegraph-speak + thin-projector trimming), consumed by the token-budget-discipline rule. on = allowed (default); off = fall back to standard condensed behavior; ask = surface an estimated token delta (tokens, not dollars) and ask once per session before loading. |

## update_check

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `update_check.enabled` | C | boolean | `true` |  | Once per day the agent checks the npm registry for a newer agent-config release and surfaces a one-line banner if one exists. Turn off in air-gapped environments or to silence the banner. |

## verbosity

| Key | Class | Type | Default | Allowed values | What it does |
|---|---|---|---|---|---|
| `verbosity.intent_announcements` | A | boolean | `false` |  | Intent narration before tool batches ("Let me check X…"). Only honored when personal.play_by_play is ALSO true (the direct-answers narration carve-out requires both). false (default) = act and emit the result. |
| `verbosity.offer_council_in_delivery` | A | boolean | `false` |  | Offer "run AI Council on this?" inside delivery commands (/feature-plan, /review-changes, /roadmap-create). Council commands themselves are unaffected. |
| `verbosity.post_action_reports` | A | string | `"minimal"` | `off` · `minimal` · `full` | Status blocks after a successful action. off = errors only; minimal (default) = one-line confirmation; full = bullet list. |
| `verbosity.preview_artifacts` | C | boolean | `false` |  | Show generated commit messages, PR titles/bodies, branch names before acting. false (default) = use generated content directly (/commit terse path). |
| `verbosity.routine_confirmations` | C | boolean | `false` |  | Confirmation prompts for routine workflow steps with one obvious answer. Iron-Law gates (commit-policy, scope-control git-ops, Hard Floor) ALWAYS ask regardless. |

## See also

- [`settings-classes`](contracts/settings-classes.md) — the class contract this page reads.
- [`settings-api`](contracts/settings-api.md) — the read/write surface.
