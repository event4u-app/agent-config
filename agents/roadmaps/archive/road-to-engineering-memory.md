# Roadmap: Engineering Memory — project-specific facts as first-class input

> Extend the Memory layer beyond `ownership-map` and
> `historical-bug-patterns` so the agent can consult **domain
> invariants, architecture decisions, incident learnings, and product
> rules** — with a real adoption and maintenance story, not another
> unused schema.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted (layer 3 = Memory)
- [x] PR #17 shipped — `ownership-map.yml` and `historical-bug-patterns.yml` have working path-fallback (`.github/` + `agents/`)
- [x] [`review-routing-data-format.md`](../../docs/guidelines/agent-infra/review-routing-data-format.md) — template format exists; new schemas follow the same pattern
- [x] `augment-portability` rule active — schemas ship as templates, data stays in consumer projects

## Vision

A senior engineer reaches for memory first: "what did we decide about
tenant isolation?", "how does this module usually fail?", "which
invariant must never break?". Today the agent has two such sources.
This roadmap adds four more, each with a clear owner, entry point, and
expiry rule — so the memory layer grows without rotting.

## Non-goals (explicit)

- **No** project-specific data in `.agent-src.uncompressed/`. The
  package ships **schemas and templates**, consumers own the YAML.
- **No** "just add another file". Each new memory type must answer:
  who writes it, who consults it, how it stays current, when it
  retires.
- **No** LLM-generated memory without human sign-off. Incident-learnings
  are drafted from evidence; a human promotes them to the file.
- **No** replacement of existing contexts (`agents/contexts/*.md`).
  Memory is structured data; contexts stay prose.

## Existing memory (baseline)

| File | Layer use | Who writes | Who consults |
|---|---|---|---|
| `ownership-map.yml` | Path → owner + reviewer roles | Tech lead on module creation | `review-routing` skill, PR-risk workflow |
| `historical-bug-patterns.yml` | Path + symptom → reviewer role + context | Engineer after post-mortem | `review-routing` skill, `bug-analyzer` |

Both are opt-in today. Adoption is the real gap, not schema coverage.

## New memory (proposed)

Each is a **template** shipped from the package; consumers fill it.

### `domain-invariants.yml`

Non-negotiable rules the system must uphold (e.g., "tenant IDs never
cross-reference", "money stored as integer cents"). Agent consults
**before writing code** in matching paths.

- Writer: senior engineer / architect
- Reader: `developer-like-execution`, `php-coder`, `laravel` skills
- Expiry: reviewed at every major version bump

### `architecture-decisions.yml`

Indexed ADRs — each entry points to a long-form decision doc and
tags the paths it constrains. Replaces "why do we do it this way?"
discovery loops.

- Writer: decision author at ADR time
- Reader: `feature-plan`, `api-design`, `blast-radius-analyzer`
- Expiry: marked *superseded* on reversal; never deleted

### `incident-learnings.yml`

Post-incident rules: "on this path, the following class of bug has
occurred N times". Overlaps with `historical-bug-patterns` but
captures *incidents* (production impact), not code-review findings.

- Writer: incident commander after resolution
- Reader: `Incident` role mode (see [`road-to-role-modes.md`](road-to-role-modes.md)), `bug-investigate`
- Expiry: archived when the underlying class is structurally eliminated

### `product-rules.yml`

Product-side invariants that code must honour (e.g., "free plan users
cannot export", "weekends use SLA tier B"). Bridges PO intent and
developer execution.

- Writer: PO or tech lead after product decision
- Reader: `PO` role mode, `validate-feature-fit`, `laravel-validation`
- Expiry: version-stamped; old versions archived on rule change

## Redaction rules for sensitive memory types

`incident-learnings.yml` and `product-rules.yml` surface material that
is useful for future decisions **and** tempting to over-capture. The
curated files are committed to the repo and readable by anyone with
read access — including, in time, cross-project learning feeds. The
following rules apply to every entry and are enforced by
`scripts/check_memory.py`.

### Hard rules — must never appear in any entry

- **No secrets.** API keys, tokens, credentials, private URLs with
  embedded auth, DSNs. The check rejects anything matching known
  secret shapes.
- **No personally identifying data.** Customer names, user emails,
  full names of non-public employees, ticket IDs that link to
  customer data, invoice numbers.
- **No incident-specific detail that does not generalise.** A 500
  error on a single customer's account is not a learning; the
  **class** of error and the **guardrail** that prevents it is.
- **No internal URLs** other than public repo / docs.

### Shape rule — distil before storing

Every entry is a **pattern + consequence + guardrail**, not a
post-mortem excerpt. A good `incident-learnings` entry reads:

> *"When rate limit X is crossed on path Y, queue worker Z starves
> the primary DB connection pool. Guardrail: circuit-break at 80 % of
> X; alert on sustained latency in Z."*

A bad one reads:

> *"On 2026-03-14 at 02:41, customer ACME (account #9182) hit a rate
> limit spike and our Redis fell over; see Jira INC-1432."*

The second belongs in the incident ticket system, never in repo memory.

### Mechanism

- Each schema under `agents/memory/schemas/<type>.schema.yml` declares
  an optional `redaction_policy` block listing regex patterns that
  MUST NOT match any string field in the entry.
- `scripts/check_memory.py` runs the redaction policy on every
  commit that touches the curated files — locally (pre-commit hook
  shipped with the package) and in CI.
- Violations block the commit. There is no opt-out at entry level;
  the rule is structural.
- The check is additive with the schema check: an entry passes only
  when schema **and** redaction policy pass.

### Consumer override

Consumers may add project-specific patterns (e.g., "all IDs starting
with `CUST-`") via
`.agent-project-settings.memory.hygiene.redaction_extra` — extending,
never weakening, the built-in rules. The layered-settings mechanism
(see [`road-to-project-memory.md`](road-to-project-memory.md#two-layer-settings))
marks the base patterns `locked: true` so no consumer can disable them.

## Phases

### Phase 1 — schemas and templates

- [x] Four new YAML templates under `.agent-src.uncompressed/templates/agents/memory/` *(2026-04-22: [`domain-invariants`](../../.agent-src.uncompressed/templates/agents/memory/domain-invariants.example.yml), [`architecture-decisions`](../../.agent-src.uncompressed/templates/agents/memory/architecture-decisions.example.yml), [`incident-learnings`](../../.agent-src.uncompressed/templates/agents/memory/incident-learnings.example.yml), [`product-rules`](../../.agent-src.uncompressed/templates/agents/memory/product-rules.example.yml))*
- [x] ~~One guideline per schema~~ **Single consolidated guideline** matching the existing `review-routing-data-format` pattern: purpose, format, owner, consulting skills, retirement *(2026-04-22: [`engineering-memory-data-format.md`](../../docs/guidelines/agent-infra/engineering-memory-data-format.md))*
- [x] `check_references.py` validates references from YAML → skill / ADR path exist *(2026-04-22: [`scripts/check_references.py`](../../scripts/check_references.py) now walks `agents/memory/**/*.yml` — extracts local file paths (`enforcement: test:`, `source:` scalars) and `skill:`/`skills:` values, validates them against real files + `artifacts["skills"]`; URLs/ADR-pseudo-URIs/globs are skipped; 8 tests in [`tests/test_check_references_memory.py`](../../tests/test_check_references_memory.py))*

### Phase 2 — reader integration

- [x] `developer-like-execution` skill gains a "consult domain-invariants for touched paths" step *(2026-04-22: step 3 extended — read `agents/memory/domain-invariants.yml` for matching `scope:`, surface conflicts)*
- [x] `feature-plan` command reads `architecture-decisions.yml` before proposing structure *(2026-04-22: step 4 extended — active ADRs with `scope:` covering affected modules are binding; conflicts surface as decisions)*
- [x] `bug-investigate` command reads `incident-learnings.yml` for touched paths *(2026-04-22: step 4 gained sub-step 5 — cite matching `id:` in root-cause report)*
- [x] `validate-feature-fit` skill reads `product-rules.yml` *(2026-04-22: step 3 extended — product rules are intentional business constraints; feature must respect or explicitly propose to retire)*

### Phase 3 — writer ergonomics

- [x] `/memory-add <type>` command — guided YAML entry with validation against the schema *(2026-04-22: [`/memory-add`](../../.agent-src.uncompressed/commands/memory-add.md) — 6-step flow: pick type → duplicate check → collect required fields → show draft → write + gate → cross-link; runs `check_memory.py` as hard gate, reverts on failure)*
- [x] Incident-learnings entry is the final step of the `Incident` role mode *(2026-04-22: [`role-contracts.md` → Incident](../../docs/guidelines/agent-infra/role-contracts.md#incident) — contract gains an "Incident learning" field (signal id or `/memory-add` draft); header table updated; mode exits MUST emit the entry via [`memory-access`](../../docs/guidelines/agent-infra/memory-access.md) or `/memory-add incident-learnings`, else the absence is logged rather than silently skipped)*

### Phase 4 — hygiene and expiry

- [x] `scripts/check_memory.py` flags entries older than the type-specific expiry window *(2026-04-22: staleness reported as info-level finding when `(today − last_validated) > review_after_days`; active-status entries only)*
- [x] CI job `memory-hygiene` runs weekly (not per PR) to keep the signal fresh *(2026-04-22: [`templates/github-workflows/memory-hygiene.yml`](../../.agent-src.uncompressed/templates/github-workflows/memory-hygiene.yml) — weekly cron + `workflow_dispatch`; opens/updates/closes a single `memory-hygiene`-labelled issue; short-circuits when no memory files exist; [`templates/scripts/check_memory.py`](../../.agent-src.uncompressed/templates/scripts/check_memory.py) shipped alongside with installation docs)*

## Adoption story — the part that is usually missing

A new memory file without adoption is dead weight. Each phase ships a
**real reader** before a **real writer** lands, so the first entry the
consumer creates already pays off on the next PR.

- Phase 1: schemas land with example entries drawn from this package's
  own incidents — so the first consumer sees a filled template, not a blank one.
- Phase 2: readers are wired in *before* we ask consumers to write.
- Phase 3: `/memory-add` is the only endorsed write path — no hand-edited YAML.
- Phase 4: hygiene prevents silent rot.

## Open questions

- **Overlap with `agents/contexts/`?** Contexts stay prose for onboarding;
  memory is structured for agent consumption. A context may *cite* a memory entry.
- **Single source vs. many?** Four files is a ceiling. If a fifth candidate
  appears, it consolidates into `domain-invariants` first.
- **Large projects with sub-apps?** Schemas must support `scope:` key
  pointing at sub-paths, so monorepos can split per app.

## Acceptance criteria

Phase 1 is shipped when: four schemas exist as templates, four
guidelines document them, `check_references.py` validates cross-refs,
and each schema contains at least one populated example in this repo.

## How this connects to the memory infrastructure

This roadmap defines **what** each memory type captures and **who**
reads it. The matching **where, how, and when** lives in:

- [`road-to-project-memory.md`](road-to-project-memory.md) — settings
  layering, repo-shared curated files, hygiene. Agent-config's own
  baseline; works without any companion package.
- [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) —
  contract with the optional `@event4u/agent-memory` package:
  detection, retrieval backend, signal producers, promotion.
- [`agent-memory/`](agent-memory/) — specs for the memory package
  itself (decay calibration, promotion flow, cross-project learning).

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame, Memory layer
- [`road-to-role-modes.md`](road-to-role-modes.md) — roles that consume memory
- [`road-to-project-memory.md`](road-to-project-memory.md) — infrastructure counterpart (settings + files)
- [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) — optional operational layer
- [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) — learnings that flow upstream, distinct from project memory
- [`road-to-memory-self-consumption.md`](road-to-memory-self-consumption.md) — bidirectional use and the repo-vs-operational conflict rule that schemas assume
- [`review-routing-data-format.md`](../../docs/guidelines/agent-infra/review-routing-data-format.md) — existing format pattern the new schemas follow
