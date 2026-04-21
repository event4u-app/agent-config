# Roadmap: Engineering Memory — project-specific facts as first-class input

> Extend the Memory layer beyond `ownership-map` and
> `historical-bug-patterns` so the agent can consult **domain
> invariants, architecture decisions, incident learnings, and product
> rules** — with a real adoption and maintenance story, not another
> unused schema.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted (layer 3 = Memory)
- [x] PR #17 shipped — `ownership-map.yml` and `historical-bug-patterns.yml` have working path-fallback (`.github/` + `agents/`)
- [x] [`review-routing-data-format.md`](../../.agent-src.uncompressed/guidelines/agent-infra/review-routing-data-format.md) — template format exists; new schemas follow the same pattern
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

## Phases

### Phase 1 — schemas and templates

- [ ] Four new YAML templates under `.agent-src.uncompressed/templates/agents/`
- [ ] One guideline per schema: purpose, format, owner, consulting skills, retirement
- [ ] `check_references.py` validates references from YAML → skill / ADR path exist

### Phase 2 — reader integration

- [ ] `developer-like-execution` skill gains a "consult domain-invariants for touched paths" step
- [ ] `feature-plan` command reads `architecture-decisions.yml` before proposing structure
- [ ] `bug-investigate` command reads `incident-learnings.yml` for touched paths
- [ ] `validate-feature-fit` skill reads `product-rules.yml`

### Phase 3 — writer ergonomics

- [ ] `/memory-add <type>` command — guided YAML entry with validation against the schema
- [ ] Incident-learnings entry is the final step of the `Incident` role mode

### Phase 4 — hygiene and expiry

- [ ] `scripts/check_memory.py` flags entries older than the type-specific expiry window
- [ ] CI job `memory-hygiene` runs weekly (not per PR) to keep the signal fresh

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

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame, Memory layer
- [`road-to-role-modes.md`](road-to-role-modes.md) — roles that consume memory
- [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) — learnings that flow upstream, distinct from project memory
- [`review-routing-data-format.md`](../../.agent-src.uncompressed/guidelines/agent-infra/review-routing-data-format.md) — existing format pattern the new schemas follow
