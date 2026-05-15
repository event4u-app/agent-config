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
linter (`scripts/lint_no_new_atomic_commands.py`) reads this file;
new atomic commands without a `cluster:` field pointing to an
entry below fail CI.

## Locked clusters

The full set, both phases. Linter parses every backticked name in
column 1 of this table.

| Cluster | Phase | Sub-commands | Replaces |
|---|:-:|---|---|
| `fix` | 1 | `ci` · `pr-comments` · `pr-bot-comments` · `pr-developer-comments` · `portability` · `refs` · `seeder` | `fix-ci` · `fix-pr-comments` · `fix-pr-bot-comments` · `fix-pr-developer-comments` · `fix-portability` · `fix-references` · `fix-seeder` |
| `optimize` | 1 | `agents-dir` · `augmentignore` · `rtk` · `skills` | `optimize-augmentignore` · `optimize-rtk-filters` · `optimize-skills` · former `/optimize agents` and `/optimize agents-md` moved to the `/agents` file-family cluster 2026-05-09; `/agents prepare/audit/cleanup` collapsed into the single `/optimize agents-dir` (flags or wizard) per the agent-doc consolidation |
| `feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` · `dev` | `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` · `feature-dev` |
| `chat-history` | 2 | `show` · `import` · `learn` | `chat-history` (legacy status) — `resume` / `clear` / `checkpoint` removed in `road-to-chat-history-hook-only` (auto-adopt + structural hooks); `import` (verbatim cross-session render) and `learn` (project-improving learning extraction) added in the v4 stateless schema |
| `agents` | 2 | `init` · `optimize` · `audit` · `user` | AGENTS.md file family (high-frequency) — repurposed 2026-05-09: `init` (was `/copilot-agents init`) · `optimize` (merger of `/optimize agents-md` + `/copilot-agents optimize`) · `audit` (was `/optimize agents`, collapses old `audit` + `check` verbs); legacy folder ops (`prepare` / `cleanup` / folder-`audit`) moved to `/optimize agents-dir`; `user` sub-cluster added 2026-05-15 — manages the project-root `.agent-user.md` persona file (sub-sub-commands: `init` · `show` · `review` · `accept` · `update`) per [`agent-user-schema`](agent-user-schema.md) |
| `memory` | 2 | `add` · `load` · `promote` · `propose` · `mine-session` · `learn-low-impact` | `memory-add` · `memory-full` · `memory-promote` · `propose-memory`; `mine-session` added 2026-05-10 — manual transcript-mining sub-command from `road-to-dream-skill-adoption.md`, opt-in via `--confirm-transcript-access` per invocation; `learn-low-impact` added 2026-05-15 — upstreams `## Validated` entries from `agents/low-impact-decisions.md` to the package seed via a DRAFT PR (re-runs the privacy-floor redactor as a second gate per `low-impact-corpus-privacy-floor`) |
| `roadmap` | 2 | `create` · `ai-council` · `process-step` · `process-phase` · `process-full` | `roadmap-create` · `roadmap-execute` (replaced — autonomous, no per-step gate; `process-phase` is the default execution scope); `ai-council` added 2026-05-07 — wraps `/council default` with `--input-mode roadmap --depth deep` |
| `module` | 2 | `create` · `explore` | `module-create` · `module-explore` |
| `tests` | 2 | `create` · `execute` | `tests-create` · `tests-execute` |
| `context` | 2 | `create` · `refactor` | `context-create` · `context-refactor` |
| `override` | 2 | `create` · `manage` | `override-create` · `override-manage` |
| `judge` | 2 | `solo` · `on-diff` · `steps` | `judge` (legacy standalone) · `do-and-judge` · `do-in-steps` |
| `commit` | 2 | `in-chunks` | `commit-in-chunks` |
| `create-pr` | 2 | `description-only` | `create-pr-description` |
| `council` | 3 | `default` · `pr` · `design` · `optimize` · `analysis` | `council` (legacy default lens) · `council-pr` · `council-design` · `council-optimize`; `analysis` added 2026-05-14 — wrapper for local analysis outputs with a Top-N consensus tail block consumed by `/roadmap create` |
| `challenge-me` | — | `vision` · `with-docs` | new — Pocock-inspired one-question-at-a-time interview; `vision` is the standard 95%-confidence variant, `with-docs` adds doc/glossary awareness with a session-scoped glossary and load-bearing claim-vs-code verification |
| `research` | 2 | `deep` · `report` | preliminary-research scaffolder ported from `Weizhena/Deep-Research-skills` (cluster head emits `outline.yaml` + `fields.yaml` against the `research-schema` contract). `:deep` populates per-item JSON in batches with native web-search + JSON-Schema self-validation (no Python runtime); `:report` renders `report.md` directly + optionally emits a `jq` template for deterministic regeneration. `add-items` / `add-fields` intentionally **not** ported — re-run `/research <topic>` to extend the field framework. |
| `orchestrate` | — | _(none yet — cluster head only)_ | new — runtime executor for YAML pipelines under `.agent-config/orchestrations/` per the [`orchestration-dsl-v1`](orchestration-dsl-v1.md) contract; chains personas / skills / commands / sub-agents deterministically. Single cluster head; sub-commands deferred until a second verb is needed. |
| `sync-gitignore` | — | `fix` | new sub-command 2026-05-11 — cluster head retains the existing append-only sync as its default flow; `:fix` adds `--cleanup-legacy` semantics, scrubbing pre-`/agents/` runtime patterns wherever they appear in the consumer's `.gitignore` (inside or outside the managed block) and re-syncing the canonical entries. |
| `ghostwriter` | — | `fetch` · `write` · `list` · `show` · `delete` | new cluster 2026-05-15 — third voice primitive for AI-assisted writing in the public voice of a public figure. Hybrid storage: real-person profiles live consumer-side under `agents/ghostwriter/<slug>.md` (gitignored by default); package source ships only `fictional: true` fixtures. Zero network code in the package — `:fetch` delegates web-fetch / web-search to the host agent. Mandatory disclosure footer on every `:write` output (no opt-out). Schema: [`ghostwriter-schema`](ghostwriter-schema.md). |

**Net change:** Phase 1 collapsed 15 atomics → 3 clusters; Phase 2
collapses 26 atomics → 11 sub-command clusters. Sub-commands use
colon syntax (`/cluster:sub`) so Claude Code's command palette can
autocomplete them. The standalone `/review` surface that mirrors
`judge solo` lives at
[`commands/review-changes.md`](../../.agent-src.uncompressed/commands/review-changes.md).

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
   semantics: [`slash-command-routing-policy-mechanics.md`](../../.agent-src.uncompressed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md)
   § Routing semantics.

## Frontmatter contract

A new command file under `.agent-src.uncompressed/commands/` MUST
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
  Step 6 (hard floor). See [`commands/council.md` → `## Architecture`](../../.agent-src.uncompressed/commands/council.md).
- **Wrappers:** `/council pr` · `/council design` · `/council optimize`
  resolve lens-specific input (PR target / design artefact / optimization
  target + metric), capture a wrapper-specific `original_ask`, then
  delegate to `/council default` with `mode_override=<lens>`. They MUST
  NOT re-implement cost-gate, CLI invocation, render, or host-verdict;
  those flow through the master verbatim. Wrapper step references anchor
  to the master (e.g. "cost gate from `/council default` Step 3",
  "render via Step 5/5a/5b of `/council default`"), not the wrapper.
- **Single source of lens addendums:** lens-specific neutrality
  addendums live in [`scripts/ai_council/prompts.py:_MODE_TABLE`](../../scripts/ai_council/prompts.py)
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

1. Keeps the old command slug in `.agent-src.uncompressed/commands/`.
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

`scripts/lint_no_new_atomic_commands.py`:

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

Empirical retiering needs evidence; evidence needs a signal. The minimum signal the package collects to validate command tiering, with **zero new external surface** and the same privacy floor as artefact-engagement telemetry:

| Field | Type | Source | Notes |
|---|---|---|---|
| `ts_bucket` | str (ISO-8601 UTC, hour-resolution) | clock at invocation | hour-bucket, not raw timestamp — limits re-identification |
| `command` | str | dispatcher | the cluster + sub-command (`fix:ci`, `commit`, `work`) — never argv |
| `tier` | int (0/1/2/3) | `command-surface-tiers.md` lookup at invocation | the tier the command had **at the time of the call** |
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
- [`.agent-src.uncompressed/contexts/contracts/artifact-engagement-flow.md`](../../.agent-src.uncompressed/contexts/contracts/artifact-engagement-flow.md) — sibling telemetry surface; same privacy floor and four-layer enforcement model.
