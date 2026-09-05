---
stability: beta
keep-beta-until: 2026-08-12
---

# Command-cluster contract

> **Status:** beta — Phase 1 locked for `1.15.0` (top-3 clusters);
> Phase 2 locked for `1.17.0` (the remaining 12 clusters);
> Phase 3 locked for `1.17.0` (`council` cluster).

The agent-config command surface collapses related atomic commands
into **verb clusters**. A cluster is a single top-level command
(e.g. `/fix`) that dispatches to sub-commands (e.g. `/fix ci`,
`/fix pr-comments`). Old atomic commands stay one release as deprecation
shims, then disappear.

This file is the **locked source of truth** for which clusters
exist and which sub-commands belong to each. The atomic-command
linter (`src/scripts/lint_no_new_atomic_commands.ts`) reads this file;
new atomic commands without a `cluster:` field pointing to an
entry below fail CI.

## Locked clusters

The full set, both phases. Linter parses every backticked name in
column 1 of this table.

| Cluster | Phase | Sub-commands | Replaces |
|---|:-:|---|---|
| `fix` | 1 | `ci` · `pr-comments` · `pr-comments-loop` · `pr-bot-comments` · `pr-developer-comments` · `portability` · `refs` · `seeder` · `comments` · `commit-messages` · `quality` · `route` | `fix-ci` · `fix-pr-comments` · `fix-pr-bot-comments` · `fix-pr-developer-comments` · `fix-portability` · `fix-references` · `fix-seeder`; `comments` added 2026-06-22 — audits the **code comments** in the current branch's diff (simplify / shorten / remove), distinct from the PR-review-thread `pr-comments` sub; `quality` added 2026-07-08 — replaces `quality-fix` (slug reorder, `replaces:` alias); `route` added 2026-07-15 (ecosystem-harvest ergonomics U1) — the classify-and-dispatch entry (adapted from the source's `/smart-fix`; folded into the `fix` verb family to satisfy the ADR-041 controlled-verb vocabulary without a new verb); `pr-comments-loop` added 2026-07-22 — autonomous wrapper that loops `pr-comments` (auto mode) → commit+push → re-request Copilot review → wait, until Copilot returns no new comments (requires a PR URL) ; `commit-messages` added 2026-09-04 — retro-fits past commit **subjects** to one convention: it runs the house-convention consensus pass from [`conventional-commits-writing`](../../src/skills/conventional-commits-writing/SKILL.md), offers the measured family / Conventional / plain-imperative **and always a user-supplied custom pattern**, asks how far back (default: all history) and whose commits (default: the invoking user's own), then rewrites with `git filter-repo` behind a backup tag, a content-diff check and separate rewrite / force-push authorisations. Placed in the `fix` verb family rather than under `git-commit` because it repairs existing artifacts rather than creating one — the `fix` verb's own criterion |
| `optimize` | 1 | `agents-dir` · `augmentignore` · `rtk` · `skills` · `project` · `prompt` · `deep` | `optimize-augmentignore` · `optimize-rtk-filters` · `optimize-skills` · former `/optimize agents` and `/optimize agents-md` moved to the `/agents` file-family cluster 2026-05-09; `/agents prepare/audit/cleanup` collapsed into the single `/optimize agents-dir` (flags or wizard) per the agent-doc consolidation; `project` (slug-neutral nest of `optimize-project`, pack move engineering-base → meta) + `prompt` (slug-neutral nest of `optimize-prompt`) added 2026-07-08 — the head now spans agent-layer / project-wide / prompt scopes with a disambiguating menu; `deep` (slug-neutral nest of `optimize-deep`) added 2026-08-02 — the autonomous deep-refactoring loop (subagent analysis → council → central + sub-roadmaps → PR → N refinement loops, default 3) |
| `feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` · `dev` | `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` · `feature-dev` |
| `chat-history` | 2 | `show` · `import` · `learn` | `chat-history` (legacy status) — `resume` / `clear` / `checkpoint` removed in `road-to-chat-history-hook-only` (auto-adopt + structural hooks); `import` (verbatim cross-session render) and `learn` (project-improving learning extraction) added in the v4 stateless schema |
| `agents` | 2 | `init` · `optimize` · `audit` · `user` | AGENTS.md file family (high-frequency) — repurposed 2026-05-09: `init` (was `/copilot-agents init`) · `optimize` (merger of `/optimize agents-md` + `/copilot-agents optimize`) · `audit` (was `/optimize agents`, collapses old `audit` + `check` verbs); legacy folder ops (`prepare` / `cleanup` / folder-`audit`) moved to `/optimize agents-dir`; `user` sub-cluster added 2026-05-15 — manages the project-root `.agent-user.md` persona file (sub-sub-commands: `init` · `show` · `review` · `accept` · `update` · `delete`); `delete` added 2026-07-30 (road-to-global-user-memory Phase 4) — the tombstone-writing delete/revoke counterpart of `accept` for the global layer — per [`agent-user-schema`](agent-user-schema.md) |
| `memory` | 2 | `add` · `load` · `promote` · `propose` · `mine-session` · `learn-low-impact` | `memory-add` · `memory-full` · `memory-promote` · `propose-memory`; `mine-session` added 2026-05-10 — manual transcript-mining sub-command from an internal roadmap (local-only), opt-in via `--confirm-transcript-access` per invocation; `learn-low-impact` added 2026-05-15 — upstreams `## Validated` entries from `agents/decisions/low-impact-decisions.md` to the package seed via a DRAFT PR (re-runs the privacy-floor redactor as a second gate per `low-impact-corpus-privacy-floor`) |
| `roadmap` | 2 | `create` · `ai-council` · `materialize` · `process-step` · `process-phase` · `process-full` · `next` | `roadmap-create` · `roadmap-execute` (replaced — autonomous, no per-step gate; `process-phase` is the default execution scope); `ai-council` added 2026-05-07 — wraps `/council default` with `--input-mode roadmap --depth deep`; `next` added 2026-08-06 — the only sub that **selects** across roadmaps (live remote screen + five-disqualifier feasibility pass + council on a genuine tie), then pins scope to `process-full` and carries the run to a review-ready PR. Bare-noun sibling alongside the bare-verb `create` / `materialize` and the `process-*` composites — the mixed shape is pre-existing in this cluster and the name is the operator's |
| `module` | 2 | `create` · `explore` | `module-create` · `module-explore` |
| `tests` | 2 | `create` · `execute` · `e2e-plan` · `e2e-heal` | `tests-create` · `tests-execute`; `e2e-plan` / `e2e-heal` added 2026-07-08 — replace the flat `e2e-plan` / `e2e-heal` (slug reorders, `replaces:` aliases; composite sub-names per ADR-003 §2) |
| `tdd` | 2 | `red` · `green` · `refactor` | new cluster 2026-07-15 (ecosystem-harvest ergonomics U2) — thin per-phase ergonomic split over the `test-driven-development` skill; each sub drives one TDD phase, no logic duplication. Internal visibility. Bare `/tdd` shows the menu. |
| `context` | 2 | `create` · `refactor` | `context-create` · `context-refactor` |
| `override` | 2 | `create` · `manage` | `override-create` · `override-manage` |
| `judge` | 2 | `solo` · `on-diff` · `steps` | `judge` (legacy standalone) · `do-and-judge` · `do-in-steps` |
| `git-commit` | 2 | `in-chunks` | `commit-in-chunks` · former cluster name `commit` — renamed 2026-06-09 to the path-derived pack-prefixed slug (`src/domains/git/commit/`, ADR-044 amendment; issue #380) |
| `git-pr-create` | 2 | `description-only` | `create-pr-description` · former cluster `create-pr` — physically merged into the `pr` verb family at `src/domains/git/pr/create/` and renamed 2026-06-09 to the path-derived pack-prefixed slug (ADR-044 amendment; issue #380) |
| `git-pr-merge` | 2 | none — the three invocation shapes are arguments, not subs | new 2026-08-21. Sibling of `git-pr-create` in the `pr` verb family at `src/domains/git/pr/merge/`, path-derived per ADR-044. Its `all` form was proposed as a second command and rejected by council review under this table's own rule that sibling variants become a flag: `all` changes cardinality, not lifecycle, so it is an argument. `pr/` remains a bare path segment rather than a cluster head, so this is a new cluster next to `git-pr-create` and not a sub of it |
| `council` | 3 | `default` · `pr` · `design` · `optimize` · `analysis` | `council` (legacy default lens) · `council-pr` · `council-design` · `council-optimize`; `analysis` added 2026-05-14 — wrapper for local analysis outputs with a Top-N consensus tail block consumed by `/roadmap create` |
| `challenge-me` | — | `vision` · `with-docs` | new — Pocock-inspired one-question-at-a-time interview; `vision` is the standard 95%-confidence variant, `with-docs` adds doc/glossary awareness with a session-scoped glossary and load-bearing claim-vs-code verification |
| `research` | 2 | `deep` · `report` | preliminary-research scaffolder ported from `Weizhena/Deep-Research-skills` (cluster head emits `outline.yaml` + `fields.yaml` against the `research-schema` contract). `:deep` populates per-item JSON in batches with native web-search + JSON-Schema self-validation (no Python runtime); `:report` renders `report.md` directly + optionally emits a `jq` template for deterministic regeneration. `add-items` / `add-fields` intentionally **not** ported — re-run `/research <topic>` to extend the field framework. |
| `team` | 2 | `review` · `adversarial` · `delegate` · `status` | new 2026-07-12 (road-to-team-mode Phase 2) — cross-model depth review: thin fail-closed delegations to the official codex plugin on Claude-Code hosts under `ai_team` governance ([`ai-team-config`](ai-team-config.md)); availability is a codex-CLI/auth fact, not a setting (`ai_team.enabled` removed, road-to-always-on-orchestration Phase 1 Step 1.3), `delegate` behind the second opt-in `allow_delegate`; internal visibility until the ADR promotion gate |
| `orchestrate` | — | _(none yet — cluster head only)_ | new — runtime executor for YAML pipelines under `.agent-config/orchestrations/` per the [`orchestration-dsl-v1`](orchestration-dsl-v1.md) contract; chains personas / skills / commands / subagents deterministically. Single cluster head; sub-commands deferred until a second verb is needed. |
| `sync` | 4 | `agent-settings` · `gitignore` · `gitignore-fix` | new cluster 2026-07-08 — absorbs the former single-sub `sync-gitignore` cluster (slug-neutral nests: `sync-agent-settings`, `sync-gitignore`, `sync-gitignore-fix` keep their slugs; the gitignore node keeps its own `fix` sub-dir, mirroring the `agents/user` deep-nest precedent). Bare `/sync` shows the menu. |
| `ghostwriter` | — | `fetch` · `write` · `list` · `show` · `delete` | new cluster 2026-05-15 — third voice primitive for AI-assisted writing in the public voice of a public figure. Hybrid storage: real-person profiles live consumer-side under `agents/reference/ghostwriter/<slug>.md` (gitignored by default); package source ships only `fictional: true` fixtures. Zero network code in the package — `:fetch` delegates web-fetch / web-search to the host agent. Mandatory disclosure footer on every `:write` output (no opt-out). Schema: [`ghostwriter-schema`](ghostwriter-schema.md). |
| `humanize` | — | _(none yet — cluster head only)_ | new cluster 2026-07-11 (`road-to-humanized-writing` Phase 3) — on-demand AI-tell removal for deliverable prose (pasted text or file path) via the [`humanizer`](../../src/skills/humanizer/SKILL.md) skill's draft→audit→final loop + the `detect_ai_tells.ts` detector; `--voice=<slug\|me>` reuses the write-engine style-source resolution (no second voice mechanism). Counterpart to the engine-internal step 4b in [`write-engine`](write-engine.md). Single cluster head; sub-commands deferred until a second verb is needed. |
| `post-as` | — | `me` · `ghostwriter` | new cluster 2026-05-15 — consumer-facing write entry points. `:me` reads `.agent-user.md.voice_sample` and drafts in the maintainer's own voice (no disclosure footer — the user is the author); `:ghostwriter` is a thin alias for `/ghostwriter:write` with the mandatory disclosure footer. Both share the procedural [`write-engine`](write-engine.md) contract — style source and footer are the only axes of variation. |
| `video` | — | `from-script` · `from-song` · `scene` · `storyboard` · `stitch` | new cluster 2026-05-17 — AI video generation pipeline. Cluster head orchestrates the full flow; `:scene` runs a single scene end-to-end (script → blueprint → still → motion → clip); `:storyboard` expands a script into per-scene blueprints + reference stills with character-lock JSON; `:from-script` walks a multi-scene script through storyboard + per-scene generation; `:from-song` builds a music-video from a song + reference images — derived/briefed timed script (via the `song-to-script` skill + `probe-audio.sh` hybrid segmentation), optional character-lock, then stitch with the song muxed as the master track and a mandatory AI-generation disclosure; `:stitch` concatenates scene clips with `ffmpeg` against a scene manifest. Provider-agnostic via the adapter contract under `scripts/media/lib/adapter-contract.md`; cost-gated with mandatory `AIV_DRYRUN=true` default and explicit confirmation before live provider calls. |
| `knowledge` | — | `ingest` · `list` · `forget` · `cross-repo` | local-knowledge namespace (employee-product Phase 7); `:cross-repo` added 2026-05-30 (`road-to-leaner-core-and-discovery` Phase 4) — read-only targeted retrieval over opted-in `linked_projects` siblings (ADR-032 Option A), per [`cross-repo-retrieval`](cross-repo-retrieval.md). The pre-existing `ingest`/`list`/`forget` sub-commands are recorded in the registry here for the first time. |
| `skills` | — | `discover` | new cluster 2026-05-30 (`road-to-leaner-core-and-discovery` Phase 3) — local, explained skill-recommendation surface over the catalog + role shortlists + optional local analytics, per [`skill-discovery`](skill-discovery.md). Every result carries a non-empty `why`; no network, honours the analytics opt-out. |
| `skill` | — | `preview` | new cluster 2026-05-30 (`road-to-leaner-core-and-discovery` Phase 5) — non-destructive skill/command preview: surfaces the declared steps + files/commands a skill would touch before it runs, per [`skill-dry-run`](skill-dry-run.md). Singular `skill` (one target) vs plural `skills` (the catalog) by design. |
| `image` | — | `analyse` · `create` · `verify` | new cluster 2026-05-31 (`road-to-character-image-fidelity` Phase 4) — character-image fidelity surface mirroring `/video:*`. `:analyse` extracts a per-feature spec from an image and diffs it against a Canon Spec down to the smallest mole (OCR for lettered tattoos, per-section severity scores, canon-breaking hard gate); `:create` assembles a max-fidelity anchors-first generation prompt from the Canon Spec, governance- + provider-gated, `AIV_DRYRUN=true` default; `:verify` runs the analyser in loop mode against a candidate and reports the gate verdict + remaining diff with plateau/oscillation/budget stop conditions. Skills: [`image-analyser`](../../skills/image-analyser/SKILL.md) + [`image-creator`](../../skills/image-creator/SKILL.md); schema/rubric/loop in [`canon-spec.md`](../../skills/image-analyser/canon-spec.md). |
| `brand` | — | `strategy` · `identity` · `tokens` · `review` · `voice` | new cluster 2026-06-17 (`road-to-image-brand-followups` Phase 3) — brand-as-first-class-UX surface for `pack-brand`, consulted before `design-intelligence` so brand bounds style. `:strategy` (positioning/archetype/voice/messaging over the brand corpus), `:identity` (logo/colour/type/imagery direction — defines the tokens downstream generation consumes), `:tokens` (derive a DTCG `.tokens.json` source of truth → CSS/Tailwind, no Node), `:review` (audit emitted UI/copy/assets against active brand tokens + voice per the `brand-consistency` gate), `:voice` (voice-and-tone profile). Skills: [`brand-strategy`](../../skills/brand-strategy/SKILL.md) · [`brand-identity`](../../skills/brand-identity/SKILL.md) · [`brand-to-tokens`](../../skills/brand-to-tokens/SKILL.md) · [`brand-audit`](../../skills/brand-audit/SKILL.md) · [`voice-and-tone-design`](../../skills/voice-and-tone-design/SKILL.md). The companion `/imagegen:*` generation cluster (pack-ai-image) is deferred until its adapters' live submit/poll/fetch is wired. |

| `team-knowledge` | — | `consolidate` · `bootstrap` | new cluster 2026-07-05 (`road-to-knowledge-system` Phases 5-6) — the repo-tracked team-knowledge layer under `agents/knowledge/{sessions,concepts,procedures,decisions}/`. Distinct from the pre-existing [`knowledge`](#locked-clusters) cluster (arbitrary local-file ingestion into `agents/memory/knowledge/`) — different namespace, different concern. `:consolidate` reads pending typed-observation events (`consolidate_knowledge_events.ts`), finds the nearest existing page per topic (mechanical similarity), and presents a NEW/EXTEND/CONFIRM/CONFLICT batch for human approval — never writes a page automatically. `:bootstrap` (`bootstrap_knowledge.ts`) stages a one-shot deterministic seed (detected package manifest, top-level directories, known config filenames — never file content, never an LLM-invented claim) to a gitignored staging dir for review-then-commit. |
| `profile` | — | `activate` · `deactivate` · `show` | new cluster 2026-06-02 (`road-to-session-profile-activation`) — session-profile activation: an ephemeral `runtime.active_packs` overlay that biases the surfaced command/skill set to the active pack closure, with no persistence and no execution-gating (recommendation-bias MVP). `:activate <name…>` resolves an alias (`src/config/discovery/session-profiles.yml`) or a raw pack id, fails fast on a not-installed pack, expands the `requires_hint` closure, and writes the overlay atomically to `agents/settings/.agent-settings.local.yml`; `:deactivate [name…]` clears it (or drops named packs, keeping deps a still-active pack needs); `:show` is the observability surface (active packs + surfaced/hidden counts). Overlay = runtime modulation of the existing `pack` axis, not a fifth axis (ADR-010 addendum). Library: `src/scripts/config/session_profiles.ts`; schema in [`session-profile-overlay`](session-profile-overlay.md). |
| `analyze` | 4 | `postmortem` · `premortem` · `decision` · `near-miss` · `incident` · `reference-repo` | analysis-workbench cluster, registered in this table 2026-07-08 (pre-existing head + five framework subs); `reference-repo` added 2026-07-08 — slug-neutral nest + pack move of `analyze-reference-repo` (engineering-base → analysis-workbench, co-locating with its head) |
| `bug` | 4 | `fix` · `investigate` | new cluster 2026-07-08 — slug-neutral nests of `bug-fix` + `bug-investigate`; triage entry point (investigate = root cause, fix = plan + implement). Bare `/bug` shows the menu. |
| `project` | 4 | `analyze` · `health` | new cluster 2026-07-08 — slug-neutral nests of `project-analyze` + `project-health`; project-wide inspection (analyze = full audit, health = read-only). Bare `/project` shows the menu. |
| `review` | 4 | `changes` · `routing` | new cluster 2026-07-08 — slug-neutral nests of `review-changes` (tier moved to the head: sub is internal, head is the advanced surface) + `review-routing` (pack move meta → engineering-base). `prepare-for-review` deliberately stays flat (council-rejected slug change). Bare `/review` shows the menu. |
| `package` | 4 | `test` · `reset` | new cluster 2026-07-08 — slug-neutral nests of `package-test` (pack move engineering-base → meta) + `package-reset`; package-install maintenance. Bare `/package` shows the menu. |
| `cost` | 4 | `report` · `profile` | new cluster 2026-07-08 — slug-neutral nest of `cost-report` + `profile` replacing `set-cost-profile` (slug reorder, `replaces:` alias). Bare `/cost` shows the menu. |
| `design-system` | — | `generate` · `import` · `capture` | new cluster 2026-08-13 (`road-to-design-system-onramp` Phase 2) — **reachability, not a new subsystem**: the grounded generator, its `MASTER.md` persistence, the `design-system.json` import contract and the current-repo inventory all shipped before this cluster and nothing could reach any of them. `:generate` grounds a system in the curated corpus and offers `--persist` (`MASTER.md` + page overrides) and/or a `DESIGN.md` seed; `:import` runs an extractor's output through the three-lane adapter (`src/scripts/design_system_import.ts` — native / DTCG / extraction, offline and pure) and hands the result to the per-field confirmation import; `:capture` emits *this* repo's inventory in the same shape, so the import path is uniform either way. Optionality is **invocation, not configuration** — zero new settings keys, no always-on rule, no auto-trigger; the head is suggestion-eligible only on an explicit design-system question. The 2026-06-28 lock holds: no crawler, browser runtime, or font-bundler ships; extraction tools are user-installed and user-connected. Skills: [`design-system-capture`](../../src/skills/design-system-capture/SKILL.md) · [`corpus-grounding`](../../src/skills/corpus-grounding/SKILL.md) · [`design-intelligence`](../../src/skills/design-intelligence/SKILL.md) · [`existing-ui-audit`](../../src/skills/existing-ui-audit/SKILL.md). |

**Net change:** Phase 1 collapsed 15 atomics → 3 clusters; Phase 2
collapses 26 atomics → 11 sub-command clusters. Phase 4 (2026-07-08,
`road-to-command-structure-optimization`) nests 19 more flat commands
into 6 new + 4 extended clusters — 15 of them slug-neutral (path
hyphen-joining keeps the invoked name), 4 slug reorders carried by
`replaces:` aliases (`fix-quality`, `tests-e2e-plan`, `tests-e2e-heal`,
`cost-profile`). The five-judge self-review formerly at
`review-changes` is now the `changes` sub of the `review` cluster.

## Bare invocation — deterministic, never guessed

Locked with Phase 4 (2026-07-08). Every cluster head defines what a
bare `/<cluster>` (no sub-command, no auto-detect signal) does:

1. **Multi-sub head → numbered menu.** Print the sub-command menu and
   ask; never guess a sub-command. Heads with `auto_detect: true` run
   their detection table first, but LOW confidence still ends in the
   menu (interactive) or `ambiguous_routing` (CI) — never a guess.
2. **Single-sub head → default-route.** Route to the only sub and say
   so (e.g. `/chat-history` → `import`).
3. **Documented default-flow exceptions.** A head whose bare
   invocation runs a real default flow declares it in its `## Dispatch`
   section (e.g. `/council` → `default` lens, `/sync gitignore` bare →
   its own `## Default flow`). The exception lives in the head file —
   not in tribal knowledge.

`scripts/check_cluster_patterns.ts` enforces the structural side:
every phase-numbered cluster head carries `## Sub-commands` (with the
locked table header), `## Dispatch`, and `## Rules`, and every
`routes_to:` entry must resolve to a real command.

## Reserved host names — Claude Code never gets a shadowing `/name`

Locked 2026-07-10 (observed: a user-scope `mcp` skill shadowed Claude
Code's built-in `/mcp` auth dialog). A cluster head or skill whose name
equals a Claude Code built-in command or bundled skill (`review`,
`agents`, `memory`, `mcp`, `code-review`, `bug`, `context`, `cost`,
`skills`, … — canonical set in `src/scripts/_lib/claude_builtin_names.ts`)
is **withheld from Claude-facing `/name` projections**: the
`.claude/skills/` command entry is skipped by `condense.ts`, and the
user-scope installer deploys neither a skill wrapper nor a flat command
file. Nested `/cluster:sub` commands are unaffected (hyphen/colon-joined
slugs cannot collide). Skills that keep a reserved name opt out of slash
registration with `user-invocable: false` (model-invocation only);
`lint_agent_skill_names.ts` fails CI otherwise. The suite complements
the host — it never overlays or degrades a built-in. On such names the
bare-invocation contract above applies to every tool **except** Claude
Code, where the built-in owns `/name`.

## Cluster depth and sub-command naming

Locked by [ADR-003](../decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md)
(2026-05-07). The shape is the default for **every** new cluster and
every new sub-command added to an existing cluster.

1. **Flat only.** A cluster has exactly one level of sub-commands.
   No sub-sub-commands. A dispatcher routes `/cluster <sub>` to a
   single sub-file; sub-files do not dispatch further. Two-level
   dispatch is a deliberate contract change requiring a new ADR
   superseding ADR-003.

2. **Composite sub-names for verb+scope.** When a cluster carries
   multiple verbs (e.g. authoring + execution), encode the verb in
   the sub-name, joined with `-`:

   - ✅ `/roadmap:create` · `/roadmap:process-step` ·
     `/roadmap:process-phase` · `/roadmap:process-full`
   - ❌ `/roadmap:process:phase` (sub-sub — forbidden)
   - ❌ `/roadmap:step` · `/roadmap:phase` · `/roadmap:full`
     (verb hidden — breaks symmetry with `create`)
   - ❌ separate `/roadmap-process` cluster (domain split — forbidden
     when one cluster can carry both verbs flat)

   Sibling sub-names stay in the same shape: either all bare verbs,
   all bare nouns/scopes, or all composite. Mixing bare and composite
   in the same cluster is allowed only when the bare sibling is the
   cluster's primary verb (e.g. `/roadmap:create` + `process-*`
   composites).

3. **Sub-name format.** kebab-case (`pr-bot-comments`, `process-phase`),
   ≤ 24 chars, no leading verb that duplicates the cluster name
   (use `/fix:ci`, not `/fix:fix-ci`).

4. **Colon-canonical invocation.**
   `/<cluster>:<sub>` is the canonical form everywhere — catalog,
   docs, examples, deprecation warnings. The space-separated form
   `/<cluster> <sub>` is a first-class equivalent and routes to the
   same dispatcher; it must keep working. Autocompletion-aware UIs
   surface the colon form because it stays a single token. Full
   semantics: [`slash-command-routing-policy-mechanics.md`](../../.agent-src.uncondensed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md)
   § Routing semantics.

## Command justification — a command must earn a top-level slot

```
A NEW COMMAND ONLY EARNS A TOP-LEVEL SLOT IN THREE CASES.
EVERYTHING ELSE IS A SKILL — THE AGENT TRIGGERS IT BY TASK.
```

Before adding a command, answer: which of these is it?

1. **Flow-entry** — a daily starting point of a flow the user TYPES to begin
   work (`work`, `git-commit`, `git-pr-create`, `ticket-implement`,
   `feature-plan`, `review-changes`, `fix-ci`, `test-run`).
2. **State-query** — a read-only check typed many times a day (`agent-status`,
   `project-health`, `profile-show`).
3. **Product-surface** — a FEATURE the user starts deliberately (not daily, but
   consciously): `council`, `challenge-me`, `research`, `roadmap`,
   `video-storyboard`. These are products, not implementation helpers — burying
   them as skills destroys discoverability.

If none of the three, it is a **skill**. Skills already trigger automatically by
task, so a sub-action, a one-off/setup-once op, a pipeline stage, a destructive
op (skill + mandatory confirmation gate — destructive ≠ command), or a system /
admin op (the `agent-admin` platform surface, NOT a flow) does NOT need a
top-level command. Sibling variants become a flag, never a second command
(`commit`, not `commit-in-chunks`; `roadmap --step`, not a separate
`roadmap-process-step` — and `roadmap` with no scope defaults to processing the
WHOLE roadmap, because that is why you write one). A new verb still needs an ADR
per [`ADR-041`](../decisions/ADR-041-controlled-command-verbs.md). A genuine
skill is `code-review` / `git-workflow` / `testing` — never `council` /
`challenge-me` / `research`.

> The rule that ends "should X be a command?" — a proposed `jira-comment`: not
> flow-entry, not state-query, not a product-surface feature → skill. Done. The
> sweet spot is ~40–50 visible commands (workflow + status + product features),
> not 125 (overwhelms) and not ~29 (buries features). Converged across the
> 6.0.0-D council passes + feedback (2026-06-03); the dedicated ADR is authored
> during the 6.0.0-D structural rollout.

## Frontmatter contract

A new command file under `.agent-src.uncondensed/commands/` MUST
declare `cluster:` in its frontmatter, pointing to one of the locked
clusters above:

```yaml
---
name: fix-ci          # legacy slug retained for the shim
cluster: fix          # required: locked cluster name
sub: ci               # required: sub-command identifier (kebab-case)
description: Fetch CI errors from GitHub Actions and fix them
---
```

The linter only flags **newly-added** files under `commands/`
(git status `A`). Pre-existing commands without `cluster:` are
grandfathered indefinitely; modifying them does NOT require adding
the field. The goal is to stop the atomic surface from growing,
not to retro-fit every legacy command into a cluster.

## Master / wrapper sub-command shape (`council` cluster)

The `council` cluster uses a **master / wrapper** shape within the flat
ADR-003 dispatch — the only cluster currently shaped this way. It does
not break ADR-003 (still one level of sub-commands) and is documented
here so future lens additions follow the same shape.

- **Master:** `/council default` owns the full orchestration — Step 1
  (resolve target + capture `original_ask`), Step 2 (configure check +
  price-table freshness), Step 3 (cost confirmation), Step 4 (run CLI),
  Step 5 / 5a / 5b (render → critical-evaluation lens → user options),
  Step 6 (hard floor). See [`commands/council.md` → `## Architecture`](../../.agent-src.uncondensed/commands/council.md).
- **Wrappers:** `/council pr` · `/council design` · `/council optimize`
  resolve lens-specific input (PR target / design artefact / optimization
  target + metric), capture a wrapper-specific `original_ask`, then
  delegate to `/council default` with `mode_override=<lens>`. They MUST
  NOT re-implement cost-gate, CLI invocation, render, or host-verdict;
  those flow through the master verbatim. Wrapper step references anchor
  to the master (e.g. "cost gate from `/council default` Step 3",
  "render via Step 5/5a/5b of `/council default`"), not the wrapper.
- **Single source of lens addendums:** lens-specific neutrality
  addendums live in [`scripts/ai_council/prompts.py:_MODE_TABLE`](../../src/scripts/ai_council/prompts.ts)
  and are selected by `mode_override`. A new lens = a new `_MODE_TABLE`
  entry **plus** a new wrapper file mirroring the `pr.md` / `design.md` /
  `optimize.md` shape (~100–130 lines). No new master.
- **Behavioural changes** to the orchestration (e.g. a new render step)
  land in `default.md` + `_MODE_TABLE` only; wrappers inherit
  automatically. This invariant is what makes the shape safe under the
  flat ADR-003 contract — the wrapper is text-only delegation.

Cluster-table names are unchanged: `/council default` is the master,
the other wrappers (`pr`, `design`, `optimize`, `analysis`) follow the
same shape. The deprecation shims for the four legacy slugs (`/council`,
`/council-pr`, `/council-design`, `/council-optimize`) continue to
follow the standard shim contract below.

### Wrapper output shapes (consumer contract)

Each wrapper renders the standard stacked + Convergence/Divergence
layout from `/council default` Step 5/5a/5b. Wrappers MAY append a
**lens-specific tail block** when their output is the input to a
downstream command — locking the tail shape avoids brittle scraping.

| Wrapper | Tail block | Downstream consumer |
|---|---|---|
| `pr` | (optional) one-line PR header at top; no structured tail | `gh pr comment` (opt-in single comment) |
| `design` | (none — open-ended prose) | Human reader; `/feature plan` / `/feature refactor` |
| `optimize` | (none — open-ended prose) | Human reader |
| `analysis` | `## Top-N consensus findings (roadmap-ready first)` — numbered list, each finding with `evidence-grade` (confirmed / inferred / speculative), `roadmap-ready` (yes / needs-discovery), `cited by`, `supporting citation` | `/roadmap create` |

The `analysis` Top-N block is the only structured tail shipped today.
Its fields are normative — `/roadmap create` parses them to draft a
roadmap; renaming or reordering them is a breaking change for the
council → roadmap pipeline. Cap at N=10 unless the upstream analysis
has fewer findings.

## Deprecation shim contract

A shim is a one-file stub that:

1. Keeps the old command slug in `.agent-src.uncondensed/commands/`.
2. Declares `superseded_by:` in frontmatter pointing to the new
   cluster command (e.g. `superseded_by: fix ci`).
3. Declares `deprecated_in:` with the release version (e.g.
   `deprecated_in: 1.15.0`).
4. Body contains exactly one warning line in the format:
   ```
   ⚠️  /<old-name> is deprecated; use /<cluster> <sub> instead.
   ```
5. Otherwise forwards verbatim to the cluster command (no logic).

`scripts/skill_linter.py` enforces the warning-line shape on any
file with `superseded_by:` set.

## Removal cycle

| State | Phase 1 | Phase 2 |
|---|---|---|
| Cluster command shipped, shim active | `1.15.0` | `1.17.0` |
| Shim emits warning, both work | `1.15.x` / `1.16.x` (≥ one minor cycle) | `1.17.x` (one minor cycle) |
| Shim removed, only cluster works | `1.17.0` (Phase 1 atomics removed alongside Phase 2 lock-in) | next minor after `1.17.x` |

No permanent aliases. Consumers who pin a 1.17 minor get a full
release window of warnings; the next-minor release notes call out
the removal explicitly. The 1.17.0 release ships Phase 2 cluster
locks **and** drops the seven Phase 1 atomic shims at the end of
their deprecation cycle.

## Agent-doc consolidation (2026-05-09)

Single-release breaking change folding seven scattered agent-doc
commands into the `/agents` (file-family) and `/optimize agents-dir`
surfaces. Frequency-weighted: high-use AGENTS.md operations get the
short `/agents` namespace; low-use folder ops nest under `/optimize`.

| Old command | New command | Note |
|---|---|---|
| `/optimize agents-md` | `/agents optimize` | Thin-Root refactor folded into `/agents` |
| `/optimize agents` | `/agents audit` | read-only audit folded into `/agents`; `audit` + `check` collapsed |
| `/agents prepare` | `/optimize agents-dir` | `--scaffold` flag or wizard mode |
| `/agents audit` (folder) | `/optimize agents-dir` | `--audit` flag |
| `/agents cleanup` | `/optimize agents-dir` | `--fix` flag |

Cluster `/copilot-agents` is retired; the file-family operations now
live under `/agents` (`init`, `optimize`).

## Linter behavior

`src/scripts/lint_no_new_atomic_commands.ts`:

- Reads the locked cluster names from this file (parsed from the
  "Locked clusters" table above — column 1 backticks).
- Finds every command file **added** since `--baseline`
  (default: `main`) — modifications to existing files are ignored.
- For each new file, requires `cluster:` to be set to one of the
  locked names — OR `superseded_by:` (the file is a shim).
- Exits non-zero on the first violation; lists every violator.

`--all` mode (manual audit only, not in CI) lints every command
file and surfaces grandfathered ones — useful when planning a
future cluster expansion.

`scripts/check_cluster_patterns.py` (Phase 2 onward):

- Compares each cluster dispatcher's structure against the Phase 1
  reference patterns (`commands/fix.md`, `commands/optimize.md`,
  `commands/feature.md`).
- Required sections: top-of-file `# /<cluster>`, `## Sub-commands`
  table with `Sub-command | Routes to | Purpose` columns, `## Dispatch`
  steps, `## Migration` notice, `## Rules` block.
- Fails CI if a new cluster invents a different dispatch shape.

## Tier-usage signal contract

Empirical retiering needs evidence; evidence needs a signal. The minimum signal the package collects to validate command tiering, with **zero new external surface** and the same privacy floor as artefact-engagement telemetry.

> **Unbuilt as of 2026-08-14 — stated plainly rather than left to be discovered.** Nothing in this tree appends to `.agent-tier-usage.jsonl`: there is a reader (`tier_usage_report`), a settings reader, and a `doctor` readiness check, but no dispatcher writer. So the shape below is a design, not an observed format, and the retiering rule under it has never run on real data. This note exists because road-to-tier-removal Phase 4 had to decide whether this contract was a live consumer of the integer `tier` key — it is not, which is why the removal did not have to rebuild it.

| Field | Type | Source | Notes |
|---|---|---|---|
| `ts_bucket` | str (ISO-8601 UTC, hour-resolution) | clock at invocation | hour-bucket, not raw timestamp — limits re-identification |
| `command` | str | dispatcher | the cluster + sub-command (`fix:ci`, `commit`, `work`) — never argv |
| `tier` | str (`visible` / `advanced` / `internal`) | `command-surface-tiers.md` lookup at invocation | the visibility the command had **at the time of the call**. Was an int (0/1/2/3) until road-to-tier-removal Phase 4 deleted the integer alias; the field name is kept because the settings namespace, the log filename, and the report script all key on it — only the recorded value changed. |
| `outcome` | str | dispatcher exit shape | one of `success` / `error` / `blocked` — no message bodies |
| `user_hash` | str (sha256 first 16 hex chars) | hash of `$USER` + machine-id salt | distinct-user counting **without** identity recovery — never raw login |

**Forbidden — never recorded, enforced at the four privacy layers:**

- argv, flags, file paths, file contents.
- error messages, stdout, stderr.
- tickets, branch names, repo slugs.
- exact timestamps (only hour-buckets), exact env-var values.
- the user's name, email, or IP.

**Storage.** Append to `.agent-tier-usage.jsonl` (consumer-project root; configurable via `telemetry.tier_usage.output.path`). Separate file from `.agent-engagement.jsonl` — orthogonal signals, separate retention defaults, separate opt-in.

**Settings gate.** `telemetry.tier_usage.enabled` (default `false`, same opt-in posture as artefact-engagement). When disabled, the dispatcher records nothing and incurs zero file IO — the default-off doctrine carries over.

**Aggregation.** Local-only, hour-bucketed counts: `(command, tier) → invocation_count` and `(command, tier) → distinct_user_count`. No remote upload anywhere in scope.

## Empirical retiering rule

A command **stays at Tier-0** at the next minor release only if **both** floors clear:

- **Frequency floor.** ≥ N invocations across the trailing W-day window — defaults `N = 20`, `W = 30` (tunable via `.agent-settings.yml` `telemetry.tier_usage.retier`).
- **Distinct-user floor.** ≥ K distinct `user_hash` values across the same window — default `K = 3`.

A command that fails either floor drops to **Tier-1** at the next minor release; the release notes cite the floor that failed. Promotion the other way (Tier-1 → Tier-0) follows the same rule symmetrically and additionally requires explicit listing in `command-surface-tiers.md`.

**Authority.** This is a maintainer decision aid, not an autonomous rule — the dispatcher records, `scripts/telemetry/tier_usage_report.py` reports, the maintainer files the move in the next minor release. No runtime tier-flipping.

**Floor governance.** N / W / K live in `.agent-settings.yml`; bumping them is a contract change (this file), not a settings change.

## See also

- [`docs/migrations/commands-1.15.0.md`](../migrations/commands-1.15.0.md) — user-facing migration notes.
- [`docs/contracts/STABILITY.md`](STABILITY.md) — `beta` level rules apply.
- [`docs/contracts/command-surface-tiers.md`](command-surface-tiers.md) — what each tier means and what `--help` surfaces.
- [`docs/contracts/command-taxonomy.md`](command-taxonomy.md) — profile axis (discoverability) layered on top of this verb axis (invocation).
- [`.agent-src.uncondensed/contexts/contracts/artifact-engagement-flow.md`](../../.agent-src.uncondensed/contexts/contracts/artifact-engagement-flow.md) — sibling telemetry surface; same privacy floor and four-layer enforcement model.
