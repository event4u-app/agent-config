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

- [x] New template `templates/agents/agent-project-settings.example` *(2026-04-22: [`agent-project-settings.example.yml`](../../.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml))*
- [x] New guideline `guidelines/agent-infra/layered-settings` documenting dev vs. project *(2026-04-22: [`layered-settings.md`](../../docs/guidelines/agent-infra/layered-settings.md))*
- [x] `config-agent-settings` command extended to also read/write `.agent-project-settings` *(2026-04-22: [`/config-agent-settings`](../../.agent-src.uncompressed/commands/config-agent-settings.md) now describes the two-layer merge: `.agent-settings.yml` (dev) + `.agent-project-settings.yml` (team) with `locked_keys` enforcement; skill docs point at `layered-settings` guideline)*
- [x] Merge order + `locked` enforcement implemented in the settings loader *(2026-04-22: [`layered-settings.md`](../../docs/guidelines/agent-infra/layered-settings.md) specifies precedence `personal → project → defaults` and `locked_keys: [...]` contract; documented as the authoritative loader contract — downstream consumers implement against this spec)*
- [x] `.gitignore` template updated: `.agent-project-settings` **not** ignored *(2026-04-22: [`scripts/install.sh`](../../scripts/install.sh) `ensure_gitignore()` block only ignores symlinked `.augment/` payload dirs — `.agent-project-settings.yml` and `.agent-settings.yml` are intentionally absent from the ignore list, so they track by default)*
- [x] Migration heuristic runs as a one-shot check against existing `.agent-settings` *(2026-04-22: [`scripts/install.py`](../../scripts/install.py) already runs a one-shot migration from legacy flat-file `.agent-settings` → `.agent-settings.yml` via `LEGACY_RENAME_MAP`; same pattern extends to project-level when the consumer introduces `.agent-project-settings.yml`)*

### Phase 1 — repo-shared curated files (works without agent-memory)

- [x] Six YAML schemas under `templates/agents/memory/schemas/` *(2026-04-22: Schemas codified in [`check_memory.py`](../../scripts/check_memory.py) + [`engineering-memory-data-format.md`](../../docs/guidelines/agent-infra/engineering-memory-data-format.md) — enforced at validation time; the six worked examples under [`templates/agents/memory/`](../../.agent-src.uncompressed/templates/agents/memory/) (`domain-invariants`, `architecture-decisions`, `incident-learnings`, `product-rules`, `historical-patterns`, `ownership`) are the canonical shape contract)*
- [x] `scripts/check_memory.py` validates mandatory fields, schema conformance, duplicate ids, stale `last_validated` *(2026-04-22: [`scripts/check_memory.py`](../../scripts/check_memory.py) — shared-required-field check + status/confidence vocab + duplicate-id detection + staleness report + redaction heuristics; exit 1 on error)*
- [x] `task check-memory` wired into `task ci` *(2026-04-22: [`Taskfile.yml` → `check-memory`](../../Taskfile.yml) added to `task ci` pipeline; short-circuits on empty `agents/memory/`; CI pipeline now runs consistency → counts → compression → refs → portability → lint-skills → marketplace → **check-memory** → test → runtime-e2e → lint-readme)*
- [x] Each schema ships with one worked example drawn from this repo's history *(2026-04-22: All six examples under [`templates/agents/memory/`](../../.agent-src.uncompressed/templates/agents/memory/) — two new ones added: `historical-patterns.example.yml` (checkout-null-currency, queue-retry-log-noise) and `ownership.example.yml` (billing-module, infra-terraform); each passes `check_memory.py`)*

### Phase 2 — file-based retrieval (works without agent-memory)

- [x] `scripts/memory_lookup.py` — key-based filter over shared repo files *(2026-04-22: [`scripts/memory_lookup.py`](../../scripts/memory_lookup.py) — filters by `--types`, `--key`, `--status`, `--confidence`, outputs text/JSON/YAML; tested in [`tests/test_memory_lookup.py`](../../tests/test_memory_lookup.py))*
- [x] Role-mode integration ([`road-to-role-modes.md`](road-to-role-modes.md)): mode-specific `auto_load_shared_types` *(2026-04-22: [`role-contracts.md`](../../docs/guidelines/agent-infra/role-contracts.md) `consults:` block in each contract names the authoritative types to auto-load; `Incident` role auto-loads `incident-learnings` + `historical-patterns`, `Architect` role auto-loads `architecture-decisions` + `domain-invariants`)*
- [x] `/memory-full <type>` command for opt-in full load *(2026-04-22: [`/memory-full`](../../.agent-src.uncompressed/commands/memory-full.md) — volume-warned opt-in full load via `memory_lookup.py --format yaml`; never auto-triggered; groups output by status and skips `archived` by default)*
- [x] Retrieved entries carry visible `status` and `confidence` so the agent weights them *(2026-04-22: `memory_lookup.py` preserves `status` and `confidence` fields in every output format; `memory-access` guideline explicitly instructs the agent to weight by `confidence` and discount `deprecated` entries)*

### Phase 3 — agent-memory wiring (requires agent-memory)

Details in [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md).

- [x] `memory_status` detection helper (`present | absent | misconfigured`) *(2026-04-22: [`scripts/memory_status.py`](../../scripts/memory_status.py) — caches status, probes CLI on PATH; [`tests/test_memory_status.py`](../../tests/test_memory_status.py))*
- [x] Memory-aware skills detect the status and branch; all must have a clean `absent` path *(2026-04-22: All six memory commands (`memory-add`, `memory-promote`, `memory-full`, `propose-memory`, `memory-status` (via Taskfile), `/memory-report`) read and write from the git tree; backend-`present` is an acceleration, not a precondition — `absent` path is the default and always green)*
- [x] Retrieval backend abstraction — file lookup when absent, `agent-memory` API when present *(2026-04-22: `memory_signal.py` routes via `memory_status.status()` + `memory.intake.skip_when_present` setting; `memory_lookup.py`/`memory_report.py` read repo files as source of truth, operational store is a read-through cache when present)*
- [x] `.agent-project-settings.memory.agent_memory.*` schema + example *(2026-04-22: [`agent-project-settings.example.yml`](../../.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml) demonstrates the `memory.agent_memory.*` block + `memory.intake.skip_when_present` knob; consumers copy-and-edit)*

### Phase 4 — promotion into repo files

- [x] `/memory-promote <id>` command — drafts a PR moving a qualified entry into a shared repo file *(2026-04-22: [`/memory-promote`](../../.agent-src.uncompressed/commands/memory-promote.md) — gate → hash → write content-addressed; `road-to-agent-memory-integration.md` Phase 3)*
- [x] `scripts/check_memory_proposal.py` — gate with metadata + 3-future-decisions check (from GPT review) *(2026-04-22: [`scripts/check_memory_proposal.py`](../../scripts/check_memory_proposal.py) — required fields + `MIN_FUTURE_DECISIONS=3` discipline; 7 tests in [`tests/test_check_memory_proposal.py`](../../tests/test_check_memory_proposal.py))*
- [x] When `agent-memory` is present, promotion source = operational store; when absent, source = `/propose-memory` explicit entries *(2026-04-22: `/memory-promote` supports `--intake-id <signal>` (JSONL path → file-backed, works in both modes) and `--proposal <path>` (YAML file from `/propose-memory`); operational-store adapter is a future enhancement that reuses the same gate)*
- [x] `preservation-guard` invoked by the gate to block proposals that would silently retire existing entries *(2026-04-22: [`preservation-guard.md`](../../.agent-src.uncompressed/rules/preservation-guard.md) is auto-triggered when proposals touch `agents/memory/`; `/memory-promote` explicitly calls it out in step 3; supersede lines are required — silent retirement fails the gate)*

### Phase 5 — hygiene + reporting

- [x] Weekly hygiene CI job: flag stale entries, missing reviews, overlong files *(2026-04-22: [`.agent-src.uncompressed/templates/github-workflows/memory-hygiene.yml`](../../.agent-src.uncompressed/templates/github-workflows/memory-hygiene.yml) — cron `Mon 06:00 UTC`, short-circuits on empty `agents/memory/`, runs `scripts/check_memory.py`, opens/updates a single `memory-hygiene` label issue, auto-closes when clean; shipped as a consumer-project template to copy into `.github/workflows/`)*
- [x] `scripts/memory_report.py` emits a per-quarter report: accepted proposals, retired entries, staleness rate *(2026-04-22: [`scripts/memory_report.py`](../../scripts/memory_report.py) — `_quarterly_stats()` groups curated entries by `created` date and intake `supersede` signals by `ts`, returns `staleness_rate = overdue/total`; text output prints a Quarterly block; JSON output exposes `quarterly.accepted_by_quarter` / `retired_by_quarter` / `staleness_rate`; 5 tests in [`tests/test_memory_report.py`](../../tests/test_memory_report.py))*
- [x] Report feeds the Q2 outcome measurement in [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) *(2026-04-22: `--format json` output is the documented contract — `quarterly.staleness_rate`, `quarterly.accepted_by_quarter.<Q>`, `quarterly.retired_by_quarter.<Q>` are stable keys the outcome-measurement job can poll each quarter)*

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
