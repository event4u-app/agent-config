---
complexity: lightweight
---

# Roadmap: North Star Restructure (meta · out-of-band · **breaking change**)

> Execute the deferred roadmap-tree restructure produced by the 2026-05-14 north-star audit + council synthesis **and** the user-issued Total Dominance mandate (2026-05-14): rename 6 existing roadmaps into a new sequence, draft new roadmaps (skill inventory rationalization, measurement + benchmark, schema rigor, caveman parity-plus, ruflo parity-plus), and produce a parity verdict that makes `caveman`, `ruflo`, and `harmonist` redundant for our use case. Breaking changes are permitted; v3.0.0 is the target tag.

## Prerequisites

- [ ] Read [`../audit-2026-05-14-north-star/NEXT-ACTIONS.md`](../audit-2026-05-14-north-star/NEXT-ACTIONS.md) — authoritative spec for renames + new drafts
- [ ] Read [`../audit-2026-05-14-north-star/council-synthesis.md`](../audit-2026-05-14-north-star/council-synthesis.md) §§ 6, 7, 9 for the reasoning behind the new step ordering and the compression kill-criterion
- [ ] Read [`../audit-2026-05-14-north-star/external-findings.md`](../audit-2026-05-14-north-star/external-findings.md) §§ 1–3 for the full feature inventory of caveman, ruflo, and harmonist — every row is in scope for Phase 6
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

This roadmap is **meta** — it restructures the other roadmaps. The `step-99-` prefix is a deliberate out-of-band marker so it sorts last in the dashboard and does not collide with the new step-1…step-N sequence it produces. After all phases close, this file and `NEXT-ACTIONS.md` both archive.

- **Source of truth:** [`../audit-2026-05-14-north-star/NEXT-ACTIONS.md`](../audit-2026-05-14-north-star/NEXT-ACTIONS.md)
- **Synthesis + verdicts:** [`../audit-2026-05-14-north-star/council-synthesis.md`](../audit-2026-05-14-north-star/council-synthesis.md)
- **External feature inventory:** [`../audit-2026-05-14-north-star/external-findings.md`](../audit-2026-05-14-north-star/external-findings.md)
- **Audit bundle:** [`../audit-2026-05-14-north-star/`](../audit-2026-05-14-north-star/)

## Domination Mandate (user override · 2026-05-14)

The council synthesis recommended a **shrunk** scope for the schema rework (`model_tier` + `## Deep Reference` only, defer harmonist-full) on solo-maintainer grounds. The maintainer has **superseded** that verdict with an explicit Total Dominance directive: the package must cover the full feature set of three external repos so that they become unnecessary for our use case.

| Repo | Role in directive |
|---|---|
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | Token economy — measured, intensity-ladder, in-place compress, statusline |
| [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) | Cost tracker, smoke contracts, per-plugin ADRs, topology, MCP citations |
| [`GammaLabTechnologies/harmonist`](https://github.com/GammaLabTechnologies/harmonist) | Schema-driven registry, migrations, `distinguishes_from`, runtime hooks, correlation IDs |

**Acceptance rule:** every row in [`external-findings.md`](../audit-2026-05-14-north-star/external-findings.md) §§ 1–3 must end the project as either:

- `[x] covered` — we have an equivalent or stronger mechanism, cited file:line, OR
- `[~] superseded` — we have a different mechanism that solves the same user problem better, with one-line justification, OR
- `[!] gap` — explicitly accepted, time-boxed, with a follow-up issue.

Zero `[!]` rows at v3.0.0 tag = G5 green = redundancy achieved.

**Breaking changes are permitted.** Field renames, file moves, schema version bumps, default flips — all in scope. Migration registry (harmonist pattern) must carry the load.

## Phase 1: Renames (6 × `git mv`)

Move existing roadmaps into the new slots. Pure history-preserving renames — no content edits in this phase.

- [ ] **Step 1 — `step-2-ai-council-consolidation.md` → `step-3-ai-council-consolidation.md`:** Pillar P2; was step-2, slot freed for the new P0 roadmap.
- [ ] **Step 2 — `step-3-agent-user-persona.md` → `step-7-agent-user-persona.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 3 — `step-4-ghostwriter.md` → `step-8-ghostwriter.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 4 — `step-5-test-cleanup.md` → `step-6-test-cleanup.md`:** Pillar P2 (mechanical enforcement, post-measurement).
- [ ] **Step 5 — `step-6-user-types-axis.md` → `step-9-user-types-axis.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 6 — Verify `step-1-v2-feedback-followup.md` stays in slot 1:** No rename. Confirm in `roadmaps-progress.md` after the regen.

## Phase 2: New roadmap drafts (`roadmap-writing` skill)

Each draft uses the `roadmap-writing` skill. None of these touch existing roadmaps. Steps 1–3 land first as the v2.10 follow-up; Steps 4–5 are Domination Mandate additions for full external-repo parity.

- [ ] **Step 1 — `step-2-skill-inventory-rationalization.md` (P0, NEW):** Council Opus #5 + o1 "skill usage stats collector". Target: 208 → ≤ 160 skills. Phases: usage telemetry → merge candidates → archive plan → execute. No deletions without an archive-notes file per removed skill.
- [ ] **Step 2 — `step-4-measurement-and-benchmark.md` (P1):** 25-prompt corpus, selection-accuracy + token usage + cost tracking (session jsonl reader), 60-day baseline gate, per-tool projection-fidelity check. This roadmap blocks every P2 enforcement step until its baseline is in.
- [ ] **Step 3 — `step-5-schema-rigor.md` (P3, **FULL SCOPE per Domination Mandate**):** Slug renamed from `step-5-minimal-schema.md`; scope expanded from the council's two-field minimum to the full Harmonist suite. Cover: `model_tier`, `## Deep Reference` cut-point on every skill > 80 lines, `schema_version` + `MIGRATIONS` registry (`_upgrade_v1_to_v2` and forward), `distinguishes_from`, `disambiguation`, `domains:` controlled list with routing intersection, generated `index.json` + `router.json` from frontmatter (hand-curation deprecated), correlation IDs (`<session_id>-<task_seq>`), memory CLI parity with MCP. Breaking-change cadence allowed via the migration registry.
- [ ] **Step 4 — `step-10-caveman-parity.md` (NEW · Domination Mandate):** Cover every row of [`external-findings.md` § 1](../audit-2026-05-14-north-star/external-findings.md): 6-level intensity ladder (`lite`/`full`/`ultra`/`wenyan-{lite,full,ultra}`), `caveman-compress` in-place rewrite with `<file>.original.md` backup, auto-clarity carve-outs (security / destructive / multi-step), statusline integration (lifetime tokens saved from session jsonl), per-prompt token-delta in `task bench`, honest output-only disclaimer surface. Blocks the compression default-flip in Phase 4.
- [ ] **Step 5 — `step-11-ruflo-parity.md` (NEW · Domination Mandate):** Cover every row of [`external-findings.md` § 2](../audit-2026-05-14-north-star/external-findings.md): cost-tracker plugin reading Claude Code session jsonl (Haiku / Sonnet / Opus per-1M, input / output / cache-read / cache-write split), 50 / 75 / 90 / 100 % budget ladder with hard stop at 100 %, per-tier smoke contract (`scripts/smoke.sh` per kernel / router / schema / skills with declared baselines), per-plugin ADR directory (`docs/adrs/<area>/0001-*.md`), enforced namespace contract (`<stem>-<intent>` kebab-case + reserved-names list), topology hints for `subagent-orchestration` (hierarchical / mesh / ring / star / adaptive), MCP-tool count with source file:line citations, measured-vs-claimed disclaimer on every roadmap header.

## Phase 3: Verification

After Phases 1 + 2 land. Each gate is a runnable check.

- [ ] **Step 1 — `task lint-skills` green:** No new linter regressions from the renames or the new drafts.
- [ ] **Step 2 — `python3 scripts/check_roadmap_trackable.py` green:** All active roadmaps parseable, all phases have checkboxes.
- [ ] **Step 3 — `agents/roadmaps-progress.md` regenerated:** Dashboard shows step-1 → step-11 in order plus this step-99. Step counts add up to the new total.
- [ ] **Step 4 — `task ci` green:** Full pipeline passes before any commit chain starts.

## Phase 4: Compression decision (criterion-deferred, do NOT decide in this roadmap)

This phase exists only to keep the parked decision visible. **No action items execute here — the gate is owned by `step-4-measurement-and-benchmark.md` Phase closeout.**

- [ ] **Step 1 — Park the kill-criterion in `docs/contracts/`:** Single-paragraph doc that names the rule per [`council-synthesis.md` § 7](../audit-2026-05-14-north-star/council-synthesis.md): until `task bench` produces a number, `caveman.speak_scope` stays default `off`. After 60-day baseline: < 30 % measured saving → deprecate; ≥ 30 % saving + < 5 % quality regression → flip default on with carve-outs.
- [ ] **Step 2 — Cross-reference from `step-4-measurement-and-benchmark.md`:** That roadmap's closeout phase reads the kill-criterion and decides. This roadmap does not.

## Phase 5: External Parity Coverage (Domination Mandate)

Produced after step-10 + step-11 + step-5 (full schema) ship their respective acceptance gates. **Output is verifiable, not narrative.** Each parity doc is a checkbox table cited row-by-row against `external-findings.md`.

- [ ] **Step 1 — `docs/parity/caveman.md`:** One row per [`external-findings.md` § 1](../audit-2026-05-14-north-star/external-findings.md) line. Each row: `[x] covered by <file:line>` · `[~] superseded by <approach>` · or `[!] gap` (+ follow-up issue number). Zero `[!]` rows required.
- [ ] **Step 2 — `docs/parity/ruflo.md`:** Same shape, against [`external-findings.md` § 2](../audit-2026-05-14-north-star/external-findings.md). Zero `[!]` rows required.
- [ ] **Step 3 — `docs/parity/harmonist.md`:** Same shape, against [`external-findings.md` § 3](../audit-2026-05-14-north-star/external-findings.md). Zero `[!]` rows required.
- [ ] **Step 4 — `docs/parity/README.md`:** Index over the three docs + composite scorecard refresh (replaces [`external-findings.md` § 5](../audit-2026-05-14-north-star/external-findings.md)). Every "–" cell from the original scorecard must now be `+` or `=` with a cited mechanism.
- [ ] **Step 5 — `task bench` redundancy verdict:** Benchmark run produces tokens-saved / cost / selection-accuracy / quality numbers that match or beat caveman's published table (avg 65 %, 22–87 % range) on our 25-prompt corpus. Numbers checked into `docs/parity/bench.json`.

## Phase 6: Closeout

After Phases 1–5 all close. This roadmap and its source spec both retire.

- [ ] **Step 1 — Confirm all new roadmaps + renames + parity docs are committed and on the default branch.**
- [ ] **Step 2 — Archive `step-99-north-star-restructure.md`:** `git mv` into `agents/roadmaps/archive/` with a one-line completion note appended (date + commit chain + tag).
- [ ] **Step 3 — Delete `agents/audit-2026-05-14-north-star/NEXT-ACTIONS.md`:** Pending-surface is no longer needed. The rest of the audit bundle (`external-findings.md`, `internal-audit.md`, `council-*.md`, `north-star-plan.md`) stays as historical record.
- [ ] **Step 4 — Regenerate `agents/roadmaps-progress.md`:** Dashboard should now show the post-restructure active set (step-1 → step-11 with step-2/4/5/10/11 newly created; step-99 archived).
- [ ] **Step 5 — Tag v3.0.0 "Senior-Dev Bar reached":** Only after G0–G5 all green. Tag commit references the parity index and the bench JSON.

## Acceptance

Phase 1–6 all green. After closeout, the `step-1` → `step-11` sequence is the canonical roadmap tree, and the G0–G5 gates govern the v3.0.0 ship:

| Gate | Owner | Pass criterion |
|---|---|---|
| **G0 — sustainable surface** | step-2 | Skill count ≤ 160, usage data ≥ 30 days, archive notes per removed skill |
| **G1 — measured savings** | step-4 | `task bench` numeric table per release, drift gate in CI |
| **G2 — enforced laws** | step-3 + step-6 | `task ci:strict` blocks tag push on linter WARN > 0; runtime hooks behind measurement baseline |
| **G3 — schema rigor (full)** | step-5 | 100 % skills declare `model_tier`; ≥ 80 % skills > 80 lines use `## Deep Reference`; `schema_version` + migration registry live; `distinguishes_from` + `disambiguation` populated where overlaps detected; `domains:` filter active |
| **G4 — adoption ramp** | step-7 + step-8 + step-9 | Role bundles install; standalone-vs-supercharged table on every skill |
| **G5 — external redundancy (Domination Mandate)** | step-10 + step-11 + Phase 5 | `docs/parity/{caveman,ruflo,harmonist}.md` all zero `[!]` rows; `task bench` ≥ caveman's published deltas; composite scorecard all `+` or `=` |

All six green = v3.0.0 tagged.

## Done

- [ ] All six phases complete; G0–G5 green; v3.0.0 tagged; this file lives in `archive/`.
