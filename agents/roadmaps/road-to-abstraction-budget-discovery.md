---
complexity: lightweight
---

# Roadmap: Abstraction-budget discovery — measure before you cut

> External feedback rounds 9, 11, and 12 all flagged the same worry: the system is getting complex ("packs, roles, directives, councils, trust, flows, commands… for normal employees potentially a lot", "scope-creep / build-everything energy", "keep frontmatter lean"). Three independent mentions is a real signal. **But** the source is an external AI scraping Glama/Packagist metadata — it could not read the tree and named **no specific abstraction** as removable. Council (claude-sonnet-4-5 + gpt-4o, 2026-05-27, analysis lens) downgraded the finding to **speculative** and was explicit: do **not** charter a reduction roadmap on a vibe. Run a discovery pass first, gate any reduction on hard usage data. This roadmap **is** that discovery pass — and nothing more.

## Context

- **The trap this roadmap avoids.** A "simplicity audit" that spawns new process, new contracts, or a speculative multi-phase reduction backlog **is itself the scope-creep the feedback warns against**. The deliverable here is an inventory + a single go/no-go gate, not a reduction commitment.
- **Why discovery, not action.** Without usage counts, "is abstraction X dead weight?" is unanswerable. The package already values this discipline (`size-enforcement`, kernel-budget contracts) — discovery makes the complexity claim falsifiable instead of rhetorical.
- **Gates.** `minimal-safe-diff` (the inventory script is read-only/analysis, touches no abstraction), `scope-control` (no removals without the gate passing + a follow-up roadmap), `roadmap-progress-sync`.

## Phase 1: Inventory — count, don't judge

- [ ] **Step 1:** Build (or extend an existing discovery script into) a read-only inventory of every abstraction class: packs, roles, directives, councils, trust-fields, flows, commands. For each instance emit: name, class, invocation/reference count across the tree, last-modified date, and a mechanical `bloat-candidate` flag (Y if usage-count == 0 OR purpose overlaps another instance). Output to `agents/evidence/analysis/abstraction-budget-inventory.{md,csv}`.
- [ ] **Step 2:** Frontmatter field-bloat sub-audit (feedback 11): tabulate which frontmatter fields actually vary across artefacts vs. which are near-constant boilerplate. A field that is identical in >95% of artefacts is a lean-contract candidate. Append to the inventory output.
- [ ] **Step 3:** Exit gate — inventory committed as evidence; numbers are real counts (grep/AST-backed), not estimates.

## Phase 2: The go/no-go gate

The single decision this roadmap exists to produce. No reduction work happens inside this roadmap.

- [ ] **Step 1:** Apply the gate against the Phase 1 data:
  - **GO** (charter a separate `road-to-abstraction-reduction.md`) only if the inventory shows **≥ 3 abstractions with usage-count == 0** OR **≥ 2 abstractions that demonstrably overlap in purpose**, OR a frontmatter field that is pure boilerplate in >95% of artefacts.
  - **NO-GO** (reject Cluster 1 as noise) otherwise — record the rejection with the supporting counts so feedback rounds 14+ that re-raise "it's too complex" are answered by data, not relitigated.
- [ ] **Step 2:** Write the verdict into this roadmap's Notes + the inventory file. If GO, the reduction roadmap is authored separately (its own scope, its own `minimal-safe-diff` discipline); this roadmap does not perform removals.
- [ ] **Step 3:** Exit gate — verdict recorded with citations; if NO-GO, this roadmap is archived as a completed discovery with a reusable inventory script for the next round.

## Acceptance criteria

- [ ] Phase 1: abstraction inventory + frontmatter field-bloat table shipped under `agents/evidence/analysis/`, backed by real counts.
- [ ] Phase 2: explicit GO / NO-GO verdict recorded with supporting counts; on GO, a separate reduction roadmap is chartered (not executed here); on NO-GO, the rejection is documented.

## Notes

- **Meta-roadmap risk acknowledged.** This roadmap is deliberately two phases and discovery-only precisely because the feedback warns against "more meta-roadmaps". If even the inventory feels like overhead, the honest alternative is to reject Cluster 1 outright on the source-quality grounds (speculative, no file:line) — that is a legitimate outcome the gate makes available.
- **Roadmap plans work, not a release.** No version/tag/commit step implied.
- **Cross-reference.** Independent of `road-to-wizard-sse-hardening` and `road-to-distribution-identity`. A future `road-to-abstraction-reduction.md` is chartered only on a Phase 2 GO.
