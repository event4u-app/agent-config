---
complexity: structural
---

# Roadmap: Ticket bundles — high-tier plans, lite-tier builds

> A roadmap materializes into self-contained, Linear-importable Markdown
> ticket bundles that a lite-tier agent (Haiku) can build one at a time
> without re-deriving the rest of the repo.

## Goal

A high-tier agent produces a ticket bundle under `agents/tickets/{slug}/`
(per-ticket Markdown contracts + durable assets + an explicit `manifest.yml`).
A lite-tier agent (or the `work_engine`) picks one ticket, reads only the
ticket + its SHA-pinned ADRs + assets, builds it, and verifies it against
runnable acceptance — with file-boundary enforcement and a staleness guard.
Tickets project idempotently into Linear via the GraphQL API (CSV is an
optional one-shot bootstrap; Jira deferred).

## Prerequisites

- [ ] Read `AGENTS.md`, [`roadmap-writing`](../../src/skills/roadmap-writing/SKILL.md), [`roadmap-management`](../../src/skills/roadmap-management/SKILL.md)
- [ ] Read the work-engine contract: `src/agent-src/templates/scripts/work_engine/` (`state.py`, `dispatcher.py`)
- [ ] Read the existing ticket chain: `refine-ticket`, `estimate-ticket`, `technical-specification`, `adr-create`, `implement-ticket`; and `src/scripts/build_linear_digest.py` (the only existing Linear surface)
- [ ] Read `model_tier` semantics (ADR-035) and `src/agent-src/contexts/model-recommendations.md`
- [ ] A Linear API token path exists (`~/.event4u/agent-config/linear.key` or env) before the Phase-1b spike and Phase 5

## Context

Today roadmaps are executable plans, but the unit of work (a roadmap step) is
deliberately terse, and the full spec is scattered across roadmap (what) + ADRs
(why) + code/AGENTS.md (how). A high-tier model holds that together; a lite-tier
model cannot. There is **no persistent ticket artifact**: `refine-ticket` /
`estimate-ticket` emit Markdown but persist nothing; Linear today is only an
AI-rules digest (`build_linear_digest.py`); assets are transient
(`agents/roadmap-assets/`, "consume then delete"). This roadmap closes the gap
with a durable, importable, build-contract ticket bundle, matching the proven
industry spec-driven-development shape (spec → plan → atomic, *isolation-testable*
tasks → agent builds).

- **Feature:** none (architecture-originated)
- **Jira:** none

## Gap-table (integrate, don't dump)

| Proposed item | Disposition | Note |
|---|---|---|
| `emit-tickets` skill (roadmap → bundle) | **KEEP** | No skill emits tickets from a roadmap today |
| `/roadmap:materialize` subcommand → delegates to `emit-tickets` | **KEEP** | Reuses the roadmap router (`create`/`ai-council`/`process-*`); unified UX + composable skill |
| `docs/contracts/ticket-bundle-format.md` + `tickets.md` template | **KEEP** | No ticket file format exists |
| `manifest.yml` (dep graph + `linear_state`) + machine-generated `_registry.yml` | **KEEP** | No bundle index exists; registry is the dashboard discovery surface |
| `lint_ticket_buildable.py` + `lint_manifest_graph` | **KEEP** | New gates |
| Linear GraphQL exporter (`build_ticket_export.py`) | **KEEP** | Only the AI-rules digest exists |
| `refine-ticket` / `estimate-ticket` / `technical-specification` / `adr-create` | **FOLD** | `emit-tickets` calls these; never rebuild |
| `implement-ticket` / `work_engine` | **FOLD** | Extend: input-path-5 (local bundle) + boundary guard + dependency-driven selection; no engine schema fork |
| `jira-integration` | **FOLD** | Jira export deferred to a follow-up (Linear-first) |
| `model_tier` (lite/medium/high) | **FOLD** | Reuse ADR-035 vocabulary; invent nothing |
| Git LFS for binary assets | **KEEP (decision required)** | LFS is NOT configured today — Phase 0 decides: configure `.gitattributes` LFS vs cap asset types/size |

## Council notes (2026-06-15, deep / 3 rounds × 2)

Members both rounds: `anthropic/claude-sonnet-4-5` + `openai/gpt-4o`.

**Round 1** (design, 7 decisions) locked: explicit `manifest.yml`; `/roadmap:materialize`
→ `emit-tickets`; GraphQL API over CSV; hard DoR gate; granularity floor
(≤ 5 files AND ≤ 200 lines, isolation-testable); MD-is-truth; and the
existential set (staleness, ADR SHA-pinning, empirical pilot, enforceable
boundaries, dependency-driven selection).

**Round 2** (reconcile vs a second, more concrete independent draft; reasoning
from established empirical facts) **revised** two things and added several:

- **R1 layout REVISED → separate `agents/tickets/{slug}/`** (not co-located).
  The flat-file dashboard/archival machinery is real and concrete; co-location's
  traceability gain is speculative. Discovery via a machine-generated
  `agents/tickets/_registry.yml` (one scan, no recursive glob, no circular
  dependency between roadmap and manifest).
- **R2 transport** = GraphQL API canonical; **CSV is non-idempotent** (the
  official Linear importer has an open "make imports idempotent" request and
  halts mid-run) → CSV demoted to an optional one-shot bootstrap. GraphQL
  **batch partial-failure** (e.g. 3 of 7 created then fail) must be resumable.
- **R3 manifest** must carry `linear_state` (per-ticket `linear_id`,
  `last_synced_sha`) — without it idempotent re-export is vaporware.
- **R4 risk-ordering** = Phase 1 runs **two independent probes**: 1a build-pilot
  (the premise; the gate) and 1b transport-spike (GraphQL partial-failure +
  image upload base64-vs-`attachmentCreate`). The build pilot needs no export.
- **R6 mutable-vs-immutable** (an unmade decision): **v1 = immutable** — a
  source change spawns a NEW bundle, no in-place issue update; this defers
  `last_synced_sha` update logic to a later mutable mode. `linear_id` mapping is
  still needed in v1 to make create idempotent (no duplicate on re-export).
- Defer **topological layering** (Phase 1 requires only an acyclic graph).
- Image upload is a **Phase-1 blocker** (Linear hosts assets behind auth; a
  `raw.githubusercontent.com` link only works for public repos) — resolved by
  the 1b spike, not deferred.

Empirical anchors: Linear CSV import is create-only (duplicates on re-run);
Linear GraphQL auto-uploads images passed as markdown URLs into auth-gated
storage; next ADR number is **101** (ADR-100 is taken); the industry SDD pattern
validates spec→plan→isolation-testable-tasks→build.

**Review pass (2026-06-15)** — an external review hardened four points, folded
above: (1) the Phase-1a gate is **qualitative**, not a hard % on n=3 (a single
random lite-failure must not condemn the format); (2) Linear has **no documented
external-key upsert** → the exporter is **query/map-first** via `linear_state`,
not a native dedup (Phase 5 Step 1); (3) the **public-repo** image case is
already solved (Linear auto-ingests the raw URL) — only the **private-repo**
case remains for the 1b spike; (4) staleness uses **split severity** —
`adr_refs` drift hard-blocks, `source_refs` drift only warns (else SHA-pinning
churns velocity and multiplies bundles).

## Phase 0: Foundation — format, schema, ADR-101, asset policy

- [x] **Step 1:** Author `docs/contracts/ticket-bundle-format.md` — bundle layout (`agents/tickets/{slug}/`: `T-NNN-{slug}.md`, `T-NNN-{slug}.assets/`, `manifest.yml`), ticket frontmatter schema, ticket body doctrine, Linear/Jira field mapping, asset-link rewrite rule, the self-containedness floor table per `model_tier`, and the bidirectional spine (`<!-- ticket: T-NNN -->` ↔ `roadmap:`/`adrs:`). <!-- ticket: T-002 -->
- [x] **Step 2:** Define `src/scripts/schemas/ticket.schema.json`. Required: `id, roadmap, phase, title, status, model_tier, estimate, priority, labels, parent, blocked_by[], acceptance[] (runnable + isolation-testable), boundaries{must_touch[], may_touch[], must_not_touch[]}, adr_refs[{path, sha}], source_refs[{path, sha}], assets[]`.
- [x] **Step 3:** Define `src/scripts/schemas/ticket-manifest.schema.json`: bundle status, `planner_tier`/`builder_tier`, `dependency_graph{id → {status, blocks[]}}` (acyclic; no topological layers in v1), and `linear_state{id → {linear_id, last_synced_sha}}`. Define the generated `_registry.yml` shape (bundle → manifest_path, source_roadmap, status).
- [x] **Step 4:** Author `src/agent-src/templates/tickets.md` (sibling of `templates/roadmaps.md`) — the copy-me skeleton + body doctrine: Context spine (exact paths) · Do / Do-NOT-touch · Acceptance (runnable, isolation-testable) · Quality gates (concrete commands) · Assets · self-containedness rule.
- [x] **Step 5:** Author **ADR-101** (next free number; NOT 100) via `adr-create`, recording the merged decisions (separate layout + registry, manifest + `linear_state`, GraphQL-canonical / CSV-bootstrap, v1-immutable tickets, staleness/SHA-pin/boundaries/pilot), citing the 2026-06-15 two-round council convergence inline. Run `scripts/adr/regenerate_index.py` (do not hand-edit the index).
- [x] **Step 6:** Decide + record the asset policy in the contract + ADR: configure Git LFS in `.gitattributes` for `agents/tickets/**/*.{png,jpg,jpeg,gif,webp,pdf}` OR cap asset types/size. LFS is not configured today — this is a real decision, not an assumption.

**Exit criteria:** contract + both JSON schemas + registry shape + template + ADR-101 exist; `validate_frontmatter.py` recognizes the ticket schema; ADR index regenerated; asset policy committed to `.gitattributes` or the contract.
**Rollback:** delete the contract/schemas/template/ADR; no runtime touched yet.

## Phase 1: Two independent probes (the build-pilot is the GATE)

> The premise — "a lite-tier model builds from one ticket alone" — is unproven,
> and so is the Linear transport's partial-failure behavior. Probe both before
> building machinery. They are independent: the build pilot needs no export.

- [x] **Step 1 (1a — build-pilot, GATE):** Hand-author ticket bundles in the Phase-0 format from an EXISTING roadmap (≥ 3; one lite-, one medium-, one UI/asset-shaped — raise n if signal is ambiguous). Run a build at each ticket's `model_tier` giving the subagent ONLY the ticket + SHA-pinned ADRs + assets. Score vs a high-tier full-context control: stayed inside `must_touch`/`may_touch`? passed acceptance? in scope? Record in `agents/evidence/ticket-bundle-pilot.md`. **Gate is qualitative, not a hard percentage** (a % on n=3 is meaningless): every failure must be root-caused to a *fixable format gap*; proceed only when no unresolved build-blocker class remains. A high clean-rate at larger n is corroborating signal, not the gate itself. <!-- ticket: T-008 -->
- [ ] **Step 2 (1b — transport-spike):** Against a scratch Linear team via GraphQL: (a) **idempotency mechanism** — confirm whether `issueCreate` exposes a settable external identifier; Linear has no documented external-key upsert, so the likely answer is that our `manifest.linear_state` map is the *sole* idempotency key (query/map-first; see Phase 5). (b) batch **partial-failure** — create 7, force a mid-batch error, confirm a resumable re-run completes without duplicates. (c) **image upload** — the *public-repo case is already solved* (Linear auto-ingests a markdown image URL into its private storage on create); the only open case is **private repos**, where a `raw.githubusercontent.com` URL is unreachable to Linear → resolve via a transient-reachable URL or `attachmentCreate`. (d) `parent` nesting. Record the idempotency key, the partial-failure protocol, and the private-repo asset rule in `agents/evidence/ticket-bundle-pilot.md`. <!-- ticket: T-001 -->

**Exit criteria:** pilot evidence file written; the ≥75% build gate passed (or format revised + re-piloted); the transport partial-failure + image-upload rules documented.
**Rollback:** the format is cheap to change here — this phase exists to fail cheap before machinery is built.

## Phase 2: Materialize — `emit-tickets` skill + `/roadmap:materialize`

- [x] **Step 1:** Author `src/skills/emit-tickets/SKILL.md` (`model_tier: high`, sibling of `roadmap-writing`): roadmap in → bundle out under `agents/tickets/{slug}/`; per ticket it delegates to `estimate-ticket`, `technical-specification`, `refine-ticket`, `adr-create`; sets `model_tier` per ticket and applies the granularity floor (≤ 5 files AND ≤ 200 lines, isolation-testable, else split or escalate to `medium`). <!-- ticket: T-006 -->
- [x] **Step 2:** Add `src/domains/product-basic/roadmap/materialize/command.md` as a thin wrapper routing to `emit-tickets` (mirrors `roadmap/create/command.md`).
- [x] **Step 3:** The skill computes `source_refs[].sha` + `adr_refs[].sha` at emission, writes `manifest.yml` (dep graph from `blocked_by`, empty `linear_state`), and (re)generates `agents/tickets/_registry.yml`. Writes `<!-- ticket: T-NNN -->` markers back into the roadmap.
- [x] **Step 4:** Materialize THIS roadmap as the first dogfood bundle (re-homing the reviewed T-001..T-007 set to the merged design) and inspect by hand. <!-- ticket: T-003 -->

**Exit criteria:** `/roadmap:materialize <slug>` produces a schema-valid bundle + registry entry for this roadmap; `validate_frontmatter.py` + manifest schema pass.
**Rollback:** delete the skill + command; roadmaps remain flat files (unmaterialized).

## Phase 3: Build-readiness gate + manifest validation

- [x] **Step 1:** Write `src/scripts/lint_ticket_buildable.py` (hard DoR gate): a ticket is build-ready only with runnable, isolation-testable acceptance (no "TBD"/"figure out"), exact `must_touch` paths, non-empty `boundaries`, resolved `adr_refs` (path + sha), linked assets for UI tickets (or explicit `assets: none`), and the granularity floor. A failing `lite` ticket blocks export or auto-escalates to `medium`. <!-- ticket: T-005 -->
- [x] **Step 2:** Write `lint_manifest_graph`: `dependency_graph` is **acyclic** (no topological layering in v1), every `blocked_by` resolves, every `adr_refs.path` exists, no orphaned assets, `_registry.yml` matches the bundles on disk.
- [x] **Step 3:** Write `lint_ticket_stale` with **split severity** (avoids stale-churn killing velocity): `adr_refs[].sha` drift = **hard** `not build-ready` (ADRs are semantic decisions, rare) → resolution = re-emit bundle; `source_refs[].sha` drift = **warn only** (source files churn constantly; a warning, not a block).
- [x] **Step 4:** Wire `task lint-tickets` (buildable + graph + stale) into the lint cadence.

**Exit criteria:** linters exist + wired; a deliberately-broken ticket fails each gate; a forced cycle fails; this roadmap's dogfood bundle passes all gates. <!-- carve-out: new-gate-verification -->
**Rollback:** disable the linters in the Taskfile; format unaffected.

## Phase 4: Builder consumption — `work_engine` reads bundles

- [x] **Step 1:** Add `implement-ticket` input-path-5: a local ticket-bundle path. Map bundle frontmatter+body to the existing work-state envelope `input.data = {id, title, body, acceptance_criteria}` — **no engine schema fork** (the envelope is already a subset). <!-- ticket: T-007 -->
- [x] **Step 2:** Add a boundary guard in the dispatcher's `apply-plan`/`review-changes` directives: validate the changeset against `boundaries`; any file outside `must_touch`∪`may_touch` halts with an escalation surface.
- [x] **Step 3:** Add dependency-driven selection: pick the next ticket whose `blocked_by` are all `done` in `manifest.yml`; never out-of-order.
- [x] **Step 4:** Pre-build staleness gate: refuse a ticket whose `adr_refs` sha drifted (semantic) with "re-emit bundle"; a `source_refs` drift only warns and proceeds (split severity, Phase 3 Step 3).

**Exit criteria:** `/implement-ticket <bundle-path>` drives one dogfood ticket end-to-end; an out-of-boundary edit is caught; an out-of-order pick is refused; golden work_engine fixtures still pass.
**Rollback:** revert the input-path + guard; `implement-ticket` keeps its 4 existing paths.

## Phase 5: Linear export (GraphQL, idempotent) — gated on token + the 1b spike

- [x] **Step 1:** Write `src/scripts/build_ticket_export.py`: bundle → Linear via GraphQL. Idempotency is **query/map-first**, NOT a native upsert (Linear has no documented external-key dedup): look up `linear_id` for `T-NNN` in `manifest.linear_state` → if present, skip/verify (v1 immutable: create-once, no content update); if absent, `issueCreate` and record the returned `linear_id`. Implement the resumable batch partial-failure protocol from the 1b spike. <!-- ticket: T-004 -->
- [x] **Step 2:** Map phases → parent issues, tickets → children; frontmatter → priority/estimate/labels; body → issue description (Markdown); images uploaded per the 1b-resolved rule (auth-gated storage, not raw URLs for private repos).
- [ ] **Step 3:** Add `agent-config tickets:export --target linear` (default) and an optional `--target csv` one-shot bootstrap clearly labeled non-idempotent.
- [ ] **Step 4:** Drift check: flag when a Linear issue and its MD ticket diverge (MD is truth); surface the delta.

**Exit criteria:** exporting this roadmap's bundle creates Linear issues; re-export is idempotent (zero duplicates, `linear_state` populated); a forced mid-batch failure resumes cleanly; the drift check reports a hand-made divergence.
**Rollback:** delete the exporter + CLI entry; bundles remain local-only and fully usable.

## Phase 6: Traceability spine + status sync + dashboard

- [ ] **Step 1:** Cross-link discipline: each ticket carries `roadmap` + `adr_refs`; each materialized roadmap step carries `<!-- ticket: T-NNN -->`. Add `lint-roadmap-materialized` (every materialized phase has ≥ 1 ticket; markers resolve both ways).
- [ ] **Step 2:** Status projection (MD is truth): a sync step projects ticket `status` onto the roadmap checkbox and (when exported) the Linear issue. Define the writeback direction explicitly so dashboard + tracker never become rival truths.
- [ ] **Step 3:** Teach `update_roadmap_progress.py` to read `agents/tickets/_registry.yml` (one scan) so co-existing bundles are counted without touching the flat-roadmap path.
- [x] **Step 4:** Document the per-ticket + per-bundle kill-switch/rollback (versioned snapshot of the bundle before export) in the format contract.

**Exit criteria:** flipping a ticket `status` updates the roadmap checkbox + dashboard via the registry; `lint-roadmap-materialized` passes; kill-switch documented.
**Rollback:** drop the sync step; tickets and roadmap stay independently usable.

## Acceptance criteria

- [ ] A high-tier agent runs `/roadmap:materialize <slug>` and produces a schema-valid `agents/tickets/{slug}/` bundle (tickets + assets + `manifest.yml`) plus a `_registry.yml` entry.
- [ ] A lite-tier agent builds a single ticket from the ticket + SHA-pinned ADRs + assets alone, stays inside `boundaries`, and passes the ticket's runnable acceptance — proven by the Phase-1a pilot (qualitative gate: every failure root-caused to a fixable format gap) and re-proven on a materialized ticket in Phase 4.
- [ ] `lint-tickets` hard-blocks a non-ready ticket and a cyclic manifest; staleness hard-blocks `adr_refs` drift and warns on `source_refs` drift.
- [ ] Exporting a bundle to Linear is idempotent (re-export updates `linear_state`, never duplicates; a forced mid-batch failure resumes), with MD as the source of truth and a working drift check.
- [ ] Every materialized phase has ≥ 1 ticket; ticket↔roadmap↔ADR cross-links resolve; status flips project to the dashboard via the registry.
- [ ] No new artefact duplicates an existing one (gap-table honored); `refine-ticket`/`estimate-ticket`/`technical-specification`/`adr-create`/`implement-ticket` are reused, not rebuilt.

## Notes

- **Mutable tickets** (in-place Linear update + `last_synced_sha` sync) are a deferred follow-up; v1 is immutable (source change → new bundle) to avoid the sync-diff complexity until issue bloat is proven a real problem.
- **Jira export** is a deferred follow-up: same bundle, a second exporter over the existing `jira-integration` client. Linear-first per the operator brief.
- **Dogfood:** the reviewed T-001..T-007 ticket set (a parallel draft) is re-homed to this merged design in Phase 2, not adopted verbatim — the layout/transport/manifest changed under it.
- File-ownership: Phase 0 owns `docs/contracts/` + `src/scripts/schemas/` + `src/agent-src/templates/` + `.gitattributes`; Phase 2 owns `src/skills/emit-tickets/` + `src/domains/product-basic/roadmap/materialize/`; Phases 3/5 own `src/scripts/`; Phase 4 owns `work_engine` + `implement-ticket`.
- The Phase-1a build gate is the cheapest place to discover the format is wrong; do not skip it to "save time" — the exact failure the council flagged.

<!-- ## Provenance
- Source: operator brief + two external LLM ideation threads (operator-supplied; links in agents/tmp/, neutral descriptor per source-confidentiality) + the public spec-driven-development (SDD) industry pattern.
- Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-15, deep, two rounds (design + reconciliation); convergence inlined in "Council notes" above. -->
