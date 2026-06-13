---
complexity: lightweight
---

# Roadmap: North Star Restructure (meta · out-of-band · **breaking change**)

> Execute the deferred roadmap-tree restructure produced by the 2026-05-14 north-star audit + council synthesis **and** the user-issued Total Dominance mandate (2026-05-14): rename 6 existing roadmaps into a new sequence, draft new roadmaps (skill inventory rationalization, measurement + benchmark, schema rigor, plus two external-reference parity-plus tracks), and produce a parity verdict that makes the three external reference suites redundant for our use case. Breaking changes are permitted; v3.0.0 is the target tag.

**Measured-vs-claimed disclaimer:** This is a **meta-restructure roadmap** — it owns no measured outcome of its own. Every parity claim (two sunset external-reference parity roadmaps, internal/local-only) and rigor claim ([`step-5-schema-rigor.md`](step-5-schema-rigor.md)) belongs to the child roadmap that carries the disclaimer. G0–G5 gate verdicts here stay aspirational until each child roadmap closes its own acceptance gates with measured evidence.

## Closure decision (2026-05-16, maintainer override)

This meta-roadmap is **closed via partial-completion + sunset of the remaining G3 / G5 gates**:

- **Renames + draft Wave shipped.** Phases 1–3 (renames, new draft roadmaps, parity-table outlines) all landed in the original Restructure Wave PRs through May 2026. step-1, step-3, step-6, step-7, step-8, step-9, step-11, step-12 all reached closure or sunset on their own dashboards.
- **G3 (schema rigor) sunset** via [`step-5`](step-5-schema-rigor.md) closure — the full external-reference parity suite is dropped on contributor-base-not-materialised grounds.
- **G5 (parity verdict) sunset** via a sunset external-reference parity roadmap (internal, local-only) closure — the parity table chase against the external reference's 65 % average is dropped; the published `telegraph-speak` rule + `condense` mechanism is the actual delivered surface.
- **v3.0.0 tag deferred.** Tag is the maintainer's call, not autonomous. The Restructure Wave's breaking-change surface (introduction of `.agent-src.uncondensed/contexts/authority/` as the source-of-truth context bucket — with mirrored condensed copies under `.agent-src/contexts/authority/` — plus kernel-rule extraction and council/audit cross-cutting moves) is already shipped on `main`; a v3.0.0 cut belongs to a release decision, not this closure. Clarification (2026-05-16 archive-audit): the original wording said "rename of agents/settings/contexts/ to agents/settings/contexts/authority/" — that phrasing was misleading. The actual change was a new subdirectory under the canonical `.agent-src.uncondensed/contexts/` tree; `agents/settings/contexts/` is a separate project-local docs dir and was not renamed.

All remaining `[ ]` checkboxes flip `[-]`. The G5 acceptance row stays explicitly unsatisfied. Parent roadmap closure runs (step-12, step-13 sunset) cascade through this meta-tracker.

## Prerequisites

- [-] Read the internal (local-only) north-star NEXT-ACTIONS note — authoritative spec for renames + new drafts
- [-] Read the internal (local-only) council-synthesis note §§ 6, 7, 9 for the reasoning behind the new step ordering and the condensation kill-criterion
- [-] Read the internal (local-only) findings note §§ 1–3 for the full feature inventory of the three external reference suites — every row is in scope for Phase 6
- [-] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

This roadmap is **meta** — it restructures the other roadmaps. The `step-99-` prefix is a deliberate out-of-band marker so it sorts last in the dashboard and does not collide with the new step-1…step-N sequence it produces. After all phases close, this file and the internal (local-only) north-star NEXT-ACTIONS note both archive.

- **Source of truth:** an internal (local-only) north-star NEXT-ACTIONS note
- **Synthesis + verdicts:** an internal (local-only) council-synthesis note
- **External feature inventory:** an internal (local-only) findings note
- **Audit bundle:** the internal (local-only) north-star audit bundle

## Domination Mandate (user override · 2026-05-14)

The council synthesis recommended a **shrunk** scope for the schema rework (`model_tier` + `## Deep Reference` only, defer full schema parity) on solo-maintainer grounds. The maintainer has **superseded** that verdict with an explicit Total Dominance directive: the package must cover the full feature set of three external reference suites so that they become unnecessary for our use case.

| Reference | Role in directive |
|---|---|
| External token-economy reference | Token economy — measured, intensity-ladder, in-place condense, statusline |
| External cost-tracker reference | Cost tracker, smoke contracts, per-plugin ADRs, topology, MCP citations |
| External schema-registry reference | Schema-driven registry, migrations, `distinguishes_from`, runtime hooks, correlation IDs |

**Acceptance rule:** every row in the internal (local-only) findings note §§ 1–3 must end the project as either:

- `[x] covered` — we have an equivalent or stronger mechanism, cited file:line, OR
- `[~] superseded` — we have a different mechanism that solves the same user problem better, with one-line justification, OR
- `[!] gap` — explicitly accepted, time-boxed, with a follow-up issue.

Zero `[!]` rows at v3.0.0 tag = G5 green = redundancy achieved.

**Breaking changes are permitted.** Field renames, file moves, schema version bumps, default flips — all in scope. Migration registry (external-reference schema pattern) must carry the load.

## Phase 1: Renames (6 × `git mv`) — superseded 2026-05-16

All 5 source files were archived during prior step-12 / step-13 cleanup
cycles before this restructure executed. Verified 2026-05-16: the
target slots `step-2/3/4/5/6` under `agents/roadmaps/` are vacant, and
the source files now live at `agents/roadmaps/archive/step-{2,3,4,5,6}-*.md`.
Renames are no-ops; the new Phase 2 drafts land directly into the
freed slots. `step-1-v2-feedback-followup.md` is itself already
archived, so the "stays in slot 1" check is moot.

- [-] **Step 1 — `step-2-ai-council-consolidation.md` → `step-3-…`:** cancelled — source already archived.
- [-] **Step 2 — `step-3-agent-user-persona.md` → `step-7-…`:** cancelled — source already archived.
- [-] **Step 3 — `step-4-ghostwriter.md` → `step-8-…`:** cancelled — source already archived.
- [-] **Step 4 — `step-5-test-cleanup.md` → `step-6-…`:** cancelled — source already archived.
- [-] **Step 5 — `step-6-user-types-axis.md` → `step-9-…`:** cancelled — source already archived.
- [-] **Step 6 — Verify `step-1-v2-feedback-followup.md` stays in slot 1:** cancelled — `step-1` already archived; the slot-1 check no longer applies.

## Phase 2: New roadmap drafts (`roadmap-writing` skill)

Each draft uses the `roadmap-writing` skill. None of these touch existing roadmaps. Steps 1–3 land first as the v2.10 follow-up; Steps 4–5 are Domination Mandate additions for full external-repo parity.

- [x] **Step 1 — `step-2-skill-inventory-rationalization.md` (P0, NEW):** drafted 2026-05-16.
- [x] **Step 2 — `step-4-measurement-and-benchmark.md` (P1):** drafted 2026-05-16.
- [x] **Step 3 — `step-5-schema-rigor.md` (P3, **FULL SCOPE per Domination Mandate**):** drafted 2026-05-16 — full external-reference schema suite per Domination Mandate (overrides the council's two-field minimum).
- [x] **Step 4 — token-economy parity roadmap (NEW · Domination Mandate, internal/local-only):** drafted 2026-05-16 — covers every row of the internal (local-only) findings note § 1.
- [x] **Step 5 — cost-tracker parity roadmap (NEW · Domination Mandate, internal/local-only):** drafted 2026-05-16 — covers every row of the internal (local-only) findings note § 2.

## Phase 3: Verification

After Phases 1 + 2 land. Each gate is a runnable check.

- [x] **Step 1 — `task lint-skills` green:** 346 pass, 92 warn, 0 fail. Warns are pre-existing, not new regressions.
- [x] **Step 2 — `python3 scripts/check_roadmap_trackable.py` green:** 9 active roadmaps, all parseable, all phases carry checkboxes.
- [x] **Step 3 — `agents/roadmaps-progress.md` regenerated:** 9 roadmap(s) · 28/239 steps done; step-2 / step-4 / step-5 / step-10 / step-11 now present in the active set.
- [~] **Step 4 — `task ci` green:** Per-task checks all green (lint-skills, check-refs, check-roadmap-trackable, lint-roadmap-complexity). The `consistency` task's final `git diff --quiet` is structurally a pre-commit gate — it cannot pass during in-flight work and is re-run as part of the commit-chain that closes this restructure. Not a quality regression.

## Phase 4: Condensation decision (criterion-deferred, do NOT decide in this roadmap)

This phase exists only to keep the parked decision visible. **No action items execute here — the gate is owned by `step-4-measurement-and-benchmark.md` Phase closeout.**

- [x] **Step 1 — Park the kill-criterion in `docs/contracts/`:** drafted 2026-05-16 → [`condensation-default-kill-criterion.md`](../../docs/contracts/condensation-default-kill-criterion.md). Names the rule per an internal (local-only) council-synthesis note § 7.
- [x] **Step 2 — Cross-reference from `step-4-measurement-and-benchmark.md`:** Phase 6 Step 2 of `step-4` now cites [`condensation-default-kill-criterion.md`](../../docs/contracts/condensation-default-kill-criterion.md) and the decision table. The closeout in `step-4` owns the verdict; this roadmap does not.

## Phase 5: External Parity Coverage (Domination Mandate)

Produced after step-10 + step-11 + step-5 (full schema) ship their respective acceptance gates. **Output is verifiable, not narrative.** Each parity doc is a checkbox table cited row-by-row against `external-findings.md`.

- [-] **Step 1 — `docs/parity/token-economy.md`:** One row per the internal (local-only) findings note § 1 line. Each row: `[x] covered by <file:line>` · `[~] superseded by <approach>` · or `[!] gap` (+ follow-up issue number). Zero `[!]` rows required.
- [-] **Step 2 — `docs/parity/cost-tracker.md`:** Same shape, against the internal (local-only) findings note § 2. Zero `[!]` rows required.
- [-] **Step 3 — `docs/parity/schema-registry.md`:** Same shape, against the internal (local-only) findings note § 3. Zero `[!]` rows required.
- [-] **Step 4 — `docs/parity/README.md`:** Index over the three docs + composite scorecard refresh (replaces the internal (local-only) findings note § 5). Every "–" cell from the original scorecard must now be `+` or `=` with a cited mechanism.
- [-] **Step 5 — `task bench` redundancy verdict:** Benchmark run produces tokens-saved / cost / selection-accuracy / quality numbers that match or beat the external token-economy reference's published table (avg 65 %, 22–87 % range) on our 25-prompt corpus. Numbers checked into `docs/parity/bench.json`.

## Phase 6: Closeout

After Phases 1–5 all close. This roadmap and its source spec both retire.

- [-] **Step 1 — Confirm all new roadmaps + renames + parity docs are committed and on the default branch.**
- [-] **Step 2 — Archive `step-99-north-star-restructure.md`:** `git mv` into `agents/roadmaps/archive/` with a one-line completion note appended (date + commit chain + tag).
- [-] **Step 3 — Delete the internal (local-only) north-star NEXT-ACTIONS note:** Pending-surface is no longer needed. The rest of the internal (local-only) audit bundle stays as historical record.
- [-] **Step 4 — Regenerate `agents/roadmaps-progress.md`:** Dashboard should now show the post-restructure active set (step-1 → step-11 with step-2/4/5/10/11 newly created; step-99 archived).
- [-] **Step 5 — Tag v3.0.0 "Senior-Dev Bar reached":** Only after G0–G5 all green. Tag commit references the parity index and the bench JSON.

## Acceptance

Phase 1–6 all green. After closeout, the `step-1` → `step-11` sequence is the canonical roadmap tree, and the G0–G5 gates govern the v3.0.0 ship:

| Gate | Owner | Pass criterion |
|---|---|---|
| **G0 — sustainable surface** | step-2 | Skill count ≤ 160, usage data ≥ 30 days, archive notes per removed skill |
| **G1 — measured savings** | step-4 | `task bench` numeric table per release, drift gate in CI |
| **G2 — enforced laws** | step-3 + step-6 | `task ci:strict` blocks tag push on linter WARN > 0; runtime hooks behind measurement baseline |
| **G3 — schema rigor (full)** | step-5 | 100 % skills declare `model_tier`; ≥ 80 % skills > 80 lines use `## Deep Reference`; `schema_version` + migration registry live; `distinguishes_from` + `disambiguation` populated where overlaps detected; `domains:` filter active |
| **G4 — adoption ramp** | step-7 + step-8 + step-9 | Role bundles install; standalone-vs-supercharged table on every skill |
| **G5 — external redundancy (Domination Mandate)** | step-10 + step-11 + Phase 5 | `docs/parity/{token-economy,cost-tracker,schema-registry}.md` all zero `[!]` rows; `task bench` ≥ the external token-economy reference's published deltas; composite scorecard all `+` or `=` |

All six green = v3.0.0 tagged.

## Done

- [-] All six phases complete; G0–G5 green; v3.0.0 tagged; this file lives in `archive/`.
