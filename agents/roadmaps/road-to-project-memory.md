# Roadmap: Project Memory — layered settings and curated knowledge

> Split dev-local from team-wide settings. Keep reviewed knowledge in
> the repo. Let `agent-memory` (optional) add the operational,
> trust-scored layer on top — but stay fully useful without it.

## Status

**Policy layer only.** Storage, decay, retrieval, and promotion
mechanics live in the companion package `agent-memory`; their specs
are under [`agent-memory/`](agent-memory/). This roadmap defines what
`agent-config` owns: settings layering, repo-shared curated files,
and the contract `agent-memory` plugs into when present.

This package **works without `agent-memory`**. The shared repo files
are agent-config's own minimal memory — static, reviewed, versioned.
`agent-memory` is the optional companion that turns them into a
dynamic, trust-scored substrate.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame — layer 3 (Memory) is the home of this work
- [x] [`road-to-engineering-memory.md`](road-to-engineering-memory.md) defines the six content types
- [x] `.agent-settings` mechanism exists — gitignored, per-developer; this roadmap adds a second layer
- [x] `preservation-guard`, `augment-portability`, `size-enforcement` rules active
- [x] [`agent-memory/`](agent-memory/) specs drafted — integration is optional, not required

## Vision

Two splits, one pattern:

- **Settings split.** Dev-local preferences (`.agent-settings`) vs.
  team conventions (`.agent-project-settings`).
- **Memory split.** Repo-committed curated files (ownership-map,
  historical-patterns, ADR summaries) vs. optional operational memory
  owned by `agent-memory`.

Both splits follow the same rule: **shared is curated and reviewed,
local is intake and ephemeral.** In both splits, the team-tracked side
is the source of truth; the dev-local or operational side augments it.

## Non-goals

- **No** storage engine, lifecycle state machine, or retrieval mechanics in this roadmap — that is `agent-memory`'s responsibility when present, or simple file-load when absent
- **No** autonomous writes into shared files — every shared change is a reviewed PR; the agent drafts, a human decides
- **No** auto-loading of all memory files into every session; retrieval is targeted
- **No** project-specific data shipped inside `.agent-src.uncompressed/` — templates and schemas only, consumers own the data
- **No** replacement of `.agent-settings` — the new file is added alongside
- **No** hard dependency on `agent-memory` — every memory-aware skill must degrade gracefully when it is absent

## Two-layer settings

| Layer | File | Tracked | Scope | Examples |
|---|---|---|---|---|
| **Dev-local** | `.agent-settings` (exists) | ❌ gitignored | Individual developer | `user_name`, `ide`, `minimal_output`, `play_by_play`, `rtk_installed`, `open_edited_files` |
| **Project-wide** | `.agent-project-settings` (new) | ✅ in repo | Entire team | `conventions.*`, `workflow.*`, `memory.*`, team defaults, `locked` keys |

**Merge order:** project settings load first, then dev settings layer
on top. A dev setting **cannot override** a key the project marks
`locked: true`. Unset keys fall through.

**`.gitignore`:** `.agent-settings` stays ignored;
`.agent-project-settings` is **not** ignored.

## Repo-shared curated files

Some knowledge belongs in the repo, not in `agent-memory`. It must be
visible at PR review time, versioned with the code, and readable
without extra infrastructure.

| Type | Shared file | Primary writer | Primary reader |
|---|---|---|---|
| Ownership | `ownership-map.yml` | Tech lead on module creation | `review-routing`, PR-risk workflow |
| Historical patterns | `historical-bug-patterns.yml` | Engineer post-fix | `review-routing`, `bug-analyzer` |
| Domain invariants | `domain-invariants.yml` | Architect | `developer-like-execution`, `php-coder` |
| Architecture decisions | `architecture-decisions.yml` | ADR author | `feature-plan`, `blast-radius-analyzer` |
| Incident learnings | `incident-learnings.yml` | Incident commander post-resolution | `bug-investigate`, Incident role mode |
| Product rules | `product-rules.yml` | PO / tech lead | PO role mode, `validate-feature-fit` |

Schemas live in `agents/memory/schemas/<type>.schema.yml`. A file
without a matching schema is rejected by the hygiene check. Every
entry carries the minimum metadata `id`, `status`, `confidence`,
`source[]`, `owner`, `last_validated` — enforced by
`scripts/check_memory.py`.

**These files are agent-config's baseline memory and work without
`agent-memory`.** When `agent-memory` is installed, it indexes them
alongside its operational store; when absent, skills load them
directly via the file-based lookup helper.

**Merge safety.** The mechanics that guarantee parallel branches can
write memory without producing git conflicts — append-only JSONL for
intake, content-addressed filenames for curated drop-ins, `merge=union`
driver — are defined in
[`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md).
Every write path covered by this roadmap MUST follow that contract.

## Minimum metadata on every entry

Every entry in every shared file carries six mandatory fields; the
hygiene check rejects any entry missing one.

| Field | Meaning |
|---|---|
| `id` | Stable, globally unique within the file |
| `status` | `active` / `deprecated` / `archived` (see below) |
| `confidence` | `low` / `medium` / `high` |
| `source[]` | Incident / PR / ADR refs supporting the entry — at least one |
| `owner` | Role or team responsible for keeping it current |
| `last_validated` | ISO date of the last human check |

Recommended extras: `review_after_days`, `superseded_by`, `scope` (for
monorepo sub-apps).

**Lifecycle for repo files is simple:** `active` → `deprecated` →
`archived`, every transition via PR. Deprecated entries stay readable
only with a `superseded_by` pointer. No agent-owned lifecycle states
live here — `proposed`, quarantine, trust-score transitions all live
inside `agent-memory`.

## What `agent-memory` adds (when present)

When the optional `agent-memory` package is installed, agent-config
does **not** change shape — the same repo files stay authoritative.
`agent-memory` layers on top:

- **Operational intake** — observations, hypotheses, draft patterns
  that are not ready for a repo PR go into `agent-memory` with a
  trust score; see [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md)
- **Trust-scored retrieval** — entries below threshold are not served
  to the agent; entries above are merged with repo-file results
- **Decay and hygiene** — per-type half-lives, promotion triggers,
  pruning; see [`agent-memory/road-to-decay-calibration.md`](agent-memory/road-to-decay-calibration.md)
- **Promotion to repo files** — a draft PR against the consumer repo
  is the only way an operational entry becomes a shared-file entry;
  the gate is still human review

When `agent-memory` is **absent**, skills fall back to plain file
loading. No operational memory, no trust scoring, no decay — just the
reviewed repo files. This path is a first-class supported mode.

See [`agent-memory/road-to-consumer-integration-guide.md`](agent-memory/road-to-consumer-integration-guide.md)
for the detection contract (`memory_status: present | absent | misconfigured`).

## Retrieval — targeted, not blanket

The agent does **not** auto-load the full memory on every session.
Retrieval is scoped by the active role mode
([`road-to-role-modes.md`](road-to-role-modes.md)):

- Each role mode declares which types it wants auto-loaded
- All other types are opt-in via explicit `/memory-full <type>`
- A per-task cap (`memory.retrieval.max_entries_per_task`) bounds the
  load

The retrieval implementation is shared: when `agent-memory` is present
it is the retrieval backend; when absent, a simple file-based lookup
helper (`scripts/memory_lookup.py`) performs key-based filtering over
the repo files only.

## `.agent-project-settings` schema

Ships as a template `templates/agents/agent-project-settings.example`.
Consumers copy it to repo root and commit.

```yaml
# Team-wide agent configuration. Committed to the repo.
# Individual developer preferences live in .agent-settings (gitignored).

schema_version: 1

# --- Coding conventions (team-wide) ---
conventions:
  eloquent_access_style: getters_setters
  php_strict_types: required
  test_framework: pest

# --- Agent behaviour (team defaults; dev may override non-locked) ---
agent_defaults:
  skill_improvement_pipeline: true
  runtime_enabled: false
  observability_reports: false
  locked: [skill_improvement_pipeline]

# --- PR / workflow policy ---
workflow:
  pr_template: .github/pull_request_template.md
  github_pr_reply_method: replies_endpoint
  improvement_pr_branch_prefix: improve/agent-
  upstream_repo: event4u-app/agent-config

# --- Memory subsystem ---
# Everything here is policy agent-config owns. The operational backend
# (agent-memory) reads these values when installed; when absent, the
# file-based fallback reads the shared/retrieval/hygiene blocks only.
memory:
  shared:
    path: agents/memory
    require_reviewed_only: true
  retrieval:
    mode: targeted                   # targeted | eager
    max_entries_per_task: 20
    auto_load_shared_types:
      developer: [domain-invariants, ownership]
      reviewer:  [ownership, historical-patterns, incident-learnings]
      tester:    [historical-patterns, incident-learnings]
      po:        [product-rules, architecture-decisions]
      incident:  [incident-learnings, ownership]
      planner:   [architecture-decisions, ownership]
  hygiene:
    require_all_mandatory_fields: true
    fail_on_unknown_schema: true
    max_entries_per_file: 500
    warn_stale_after_days: 180
  # Optional: only read when @event4u/agent-memory is installed.
  # Full schema in agent-memory/road-to-consumer-integration-guide.md
  agent_memory:
    enabled: auto                    # auto | true | false
    connection_env: AGENT_MEMORY_DATABASE_URL
    trust_threshold: 0.6
    promotion:
      allow_proposals: true
      allowed_target_types: [historical-patterns, domain-invariants, incident-learnings, product-rules]
```

## Settings migration heuristic

For every key currently in `.agent-settings`, apply this checklist:

| Question | If YES → goes to |
|---|---|
| Does the value differ between developers on the same project? | `.agent-settings` (dev) |
| Is the value a machine- or IDE-specific flag? | `.agent-settings` (dev) |
| Would a new team member need to guess this value? | `.agent-project-settings` (team) |
| Does it encode a coding convention or workflow policy? | `.agent-project-settings` (team) |
| Is it a subsystem-wide policy (memory, runtime, observability)? | `.agent-project-settings` (team) |

Applied to today's `.agent-settings`:

| Key | Today | Target | Rationale |
|---|---|---|---|
| `ide`, `user_name`, `open_edited_files`, `rtk_installed`, `minimal_output`, `play_by_play` | dev | **dev** (unchanged) | per-developer preference |
| `eloquent_access_style` | dev | **project** | coding convention |
| `pr_template`, `github_pr_reply_method` | dev | **project** | workflow policy |
| `skill_improvement_pipeline`, `improvement_pr_branch_prefix`, `upstream_repo` | dev | **project** | team-level improvement policy |
| `cost_profile`, `runtime_enabled`, `observability_reports`, `pr_comment_bot_icon` | dev | **project default** + dev override | team default, dev may tune within policy |

Migration is one-shot and reversible: if the team decides a key
belongs back on dev level, the project-settings entry is removed and
dev-settings fall through.

## Phases

### Phase 0 — settings layering (unblocks everything else)

- [ ] New template `templates/agents/agent-project-settings.example`
- [ ] New guideline `guidelines/agent-infra/layered-settings` documenting dev vs. project
- [ ] `config-agent-settings` command extended to also read/write `.agent-project-settings`
- [ ] Merge order + `locked` enforcement implemented in the settings loader
- [ ] `.gitignore` template updated: `.agent-project-settings` **not** ignored
- [ ] Migration heuristic runs as a one-shot check against existing `.agent-settings`

### Phase 1 — repo-shared curated files (works without agent-memory)

- [ ] Six YAML schemas under `templates/agents/memory/schemas/`
- [ ] `scripts/check_memory.py` validates mandatory fields, schema conformance, duplicate ids, stale `last_validated`
- [ ] `task check-memory` wired into `task ci`
- [ ] Each schema ships with one worked example drawn from this repo's history

### Phase 2 — file-based retrieval (works without agent-memory)

- [ ] `scripts/memory_lookup.py` — key-based filter over shared repo files
- [ ] Role-mode integration ([`road-to-role-modes.md`](road-to-role-modes.md)): mode-specific `auto_load_shared_types`
- [ ] `/memory-full <type>` command for opt-in full load
- [ ] Retrieved entries carry visible `status` and `confidence` so the agent weights them

### Phase 3 — agent-memory wiring (requires agent-memory)

Details in [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md).

- [ ] `memory_status` detection helper (`present | absent | misconfigured`)
- [ ] Memory-aware skills detect the status and branch; all must have a clean `absent` path
- [ ] Retrieval backend abstraction — file lookup when absent, `agent-memory` API when present
- [ ] `.agent-project-settings.memory.agent_memory.*` schema + example

### Phase 4 — promotion into repo files

- [ ] `/memory-promote <id>` command — drafts a PR moving a qualified entry into a shared repo file
- [ ] `scripts/check_memory_proposal.py` — gate with metadata + 3-future-decisions check (from GPT review)
- [ ] When `agent-memory` is present, promotion source = operational store; when absent, source = `/propose-memory` explicit entries
- [ ] `preservation-guard` invoked by the gate to block proposals that would silently retire existing entries

### Phase 5 — hygiene + reporting

- [ ] Weekly hygiene CI job: flag stale entries, missing reviews, overlong files
- [ ] `scripts/memory_report.py` emits a per-quarter report: accepted proposals, retired entries, staleness rate
- [ ] Report feeds the Q2 outcome measurement in [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md)

## Integration with existing artefacts

- **[`road-to-engineering-memory.md`](road-to-engineering-memory.md)** — defines *what* is remembered. This roadmap defines *where it lives and how policy is applied*. Phase 1 here unblocks engineering-memory Phase 1.
- **[`road-to-role-modes.md`](road-to-role-modes.md)** — `auto_load_shared_types` is mode-keyed; retrieval is the main contract between the two.
- **[`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md)** — the five-stage pipeline handles memory entries alongside skills/rules; `/memory-promote` is its Stage-3 adapter for memory.
- **[`road-to-trigger-evals.md`](road-to-trigger-evals.md)** — D-class failures feed promotion signals (via `agent-memory` when present, via explicit `/propose-memory` when absent).
- **[`agent-memory/`](agent-memory/)** — specs for the companion package; read alongside this roadmap when scoping Phase 3+.
- **`preservation-guard`** — invoked by the gate script on every promotion.
- **`augment-portability`** — schemas live in the package; data lives in the consumer; enforced by `check-portability`.

## Open questions

- **`.agent-project-settings` format:** YAML (matches memory schemas) vs. `key=value` like `.agent-settings`. **Leaning YAML**; decision belongs in Phase 0.
- **Locked keys:** per-key list (shown above) vs. per-section block? Per-key list is simpler; decision in Phase 0.
- **Retrieval performance (file-based fallback):** YAML parsed per task is fine up to ~500 entries; beyond, an index file regenerated by hygiene may be needed. Deferred until a consumer hits the limit.
- **Promotion trigger rate limit:** how to prevent "every bug fix proposes a pattern"? Per-user + per-path cap in the gate script; final shape lives in [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md).
- **Monorepo scoping:** one `agents/memory/` at repo root vs. per sub-app? Repo root for now, `scope:` field on each entry for sub-app isolation; revisit with real monorepo usage.

## Acceptance criteria

- **Phase 0** ships when: template exists, loader merges both files with `locked` enforcement, migration heuristic runs clean on this repo's own `.agent-settings`, guideline documents the split.
- **Phase 1** ships when: six schemas exist with one worked example each, `check_memory.py` passes on examples, `task ci` includes `check-memory`, a deliberately broken example fails CI.
- **Phase 2** ships when: `memory_lookup.py` serves role-mode-scoped results against committed repo files, with no dependency on `agent-memory`.
- **Phase 3** ships when: detection helper returns correct state in all three cases, at least one memory-aware skill degrades gracefully to the file-based path, and the agent-memory integration path has an end-to-end walkthrough.
- **Phases 4–5** ship when: each respective command exists, the wiring passes the package's own tests, and at least one end-to-end fixture (observation → proposal → gate → shared repo file) is committed.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame (Memory layer)
- [`road-to-engineering-memory.md`](road-to-engineering-memory.md) — content counterpart
- [`road-to-role-modes.md`](road-to-role-modes.md) — retrieval consumers
- [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) — pipeline host
- [`road-to-trigger-evals.md`](road-to-trigger-evals.md) — promotion signal source
- [`agent-memory/README.md`](agent-memory/README.md) — companion specs index
- [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) — the agent-config side of the integration (next roadmap)
- [`road-to-memory-merge-safety.md`](road-to-memory-merge-safety.md) — no-conflict contract for every memory write path
- [`road-to-memory-self-consumption.md`](road-to-memory-self-consumption.md) — bidirectional-use, no-circular-dep, repo-vs-operational conflict rule
- [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md) — versioned cross-repo contract for retrieval
