---
complexity: lightweight
---

# Roadmap: North Star Restructure (meta · out-of-band)

> Execute the deferred roadmap-tree restructure produced by the 2026-05-14 north-star audit + council synthesis: rename 6 existing roadmaps into a new sequence, draft 3 new roadmaps (skill inventory rationalization, measurement + benchmark, minimal schema), park the compression decision with an explicit kill-criterion.

## Prerequisites

- [ ] Read [`../audit-2026-05-14-north-star/NEXT-ACTIONS.md`](../audit-2026-05-14-north-star/NEXT-ACTIONS.md) — authoritative spec for renames + new drafts
- [ ] Read [`../audit-2026-05-14-north-star/council-synthesis.md`](../audit-2026-05-14-north-star/council-synthesis.md) §§ 6, 7, 9 for the reasoning behind the new step ordering and the compression kill-criterion
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

This roadmap is **meta** — it restructures the other roadmaps. The `step-99-` prefix is a deliberate out-of-band marker so it sorts last in the dashboard and does not collide with the new step-1…step-9 sequence it produces. After all phases close, this file and `NEXT-ACTIONS.md` both archive.

- **Source of truth:** [`../audit-2026-05-14-north-star/NEXT-ACTIONS.md`](../audit-2026-05-14-north-star/NEXT-ACTIONS.md)
- **Synthesis + verdicts:** [`../audit-2026-05-14-north-star/council-synthesis.md`](../audit-2026-05-14-north-star/council-synthesis.md)
- **Audit bundle:** [`../audit-2026-05-14-north-star/`](../audit-2026-05-14-north-star/)

## Phase 1: Renames (6 × `git mv`)

Move existing roadmaps into the new slots. Pure history-preserving renames — no content edits in this phase.

- [ ] **Step 1 — `step-2-ai-council-consolidation.md` → `step-3-ai-council-consolidation.md`:** Pillar P2; was step-2, slot freed for the new P0 roadmap.
- [ ] **Step 2 — `step-3-agent-user-persona.md` → `step-7-agent-user-persona.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 3 — `step-4-ghostwriter.md` → `step-8-ghostwriter.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 4 — `step-5-test-cleanup.md` → `step-6-test-cleanup.md`:** Pillar P2 (mechanical enforcement, post-measurement).
- [ ] **Step 5 — `step-6-user-types-axis.md` → `step-9-user-types-axis.md`:** Pillar P4 (adoption ramp).
- [ ] **Step 6 — Verify `step-1-v2-feedback-followup.md` stays in slot 1:** No rename. Confirm in `roadmaps-progress.md` after the regen.

## Phase 2: New roadmap drafts (3 × `roadmap-writing` skill)

Each draft uses the `roadmap-writing` skill against the spec lines in `NEXT-ACTIONS.md`. None of these touch existing roadmaps.

- [ ] **Step 1 — `step-2-skill-inventory-rationalization.md` (P0, NEW):** Council Opus #5 + o1 "skill usage stats collector". Target: 208 → ≤ 160 skills. Phases: usage telemetry → merge candidates → archive plan → execute. No deletions without an archive-notes file per removed skill.
- [ ] **Step 2 — `step-4-measurement-and-benchmark.md` (P1):** 25-prompt corpus, selection-accuracy + token usage + cost tracking (session jsonl reader), 60-day baseline gate, per-tool projection-fidelity check. This roadmap blocks every P2 enforcement step until its baseline is in.
- [ ] **Step 3 — `step-5-minimal-schema.md` (P3, SHRUNK):** Only `model_tier` + `## Deep Reference` cut-point. **No** `schema_version`, **no** `distinguishes_from`, **no** `disambiguation`, **no** migration registry — council shrunk the full Harmonist suite to two fields.

## Phase 3: Verification

After Phases 1 + 2 land. Each gate is a runnable check.

- [ ] **Step 1 — `task lint-skills` green:** No new linter regressions from the renames or the new drafts.
- [ ] **Step 2 — `python3 scripts/check_roadmap_trackable.py` green:** All 9 active roadmaps parseable, all phases have checkboxes.
- [ ] **Step 3 — `agents/roadmaps-progress.md` regenerated:** Dashboard shows step-1 → step-9 in order plus this step-99. Step counts add up to the new total.
- [ ] **Step 4 — `task ci` green:** Full pipeline passes before any commit chain starts.

## Phase 4: Compression decision (criterion-deferred, do NOT decide in this roadmap)

This phase exists only to keep the parked decision visible. **No action items execute here — the gate is owned by `step-4-measurement-and-benchmark.md` Phase closeout.**

- [ ] **Step 1 — Park the kill-criterion in `docs/contracts/`:** Single-paragraph doc that names the rule per [`council-synthesis.md` § 7](../audit-2026-05-14-north-star/council-synthesis.md): until `task bench` produces a number, `caveman.speak_scope` stays default `off`. After 60-day baseline: < 30 % measured saving → deprecate; ≥ 30 % saving + < 5 % quality regression → flip default on with carve-outs.
- [ ] **Step 2 — Cross-reference from `step-4-measurement-and-benchmark.md`:** That roadmap's closeout phase reads the kill-criterion and decides. This roadmap does not.

## Phase 5: Closeout

After Phases 1–4 close. This roadmap and its source spec both retire.

- [ ] **Step 1 — Confirm all 3 new roadmaps + 5 renames are committed and on the default branch.**
- [ ] **Step 2 — Archive `step-99-north-star-restructure.md`:** `git mv` into `agents/roadmaps/archive/` with a one-line completion note appended (date + commit chain).
- [ ] **Step 3 — Delete `agents/audit-2026-05-14-north-star/NEXT-ACTIONS.md`:** Pending-surface is no longer needed. The rest of the audit bundle (`external-findings.md`, `internal-audit.md`, `council-*.md`, `north-star-plan.md`) stays as historical record.
- [ ] **Step 4 — Regenerate `agents/roadmaps-progress.md`:** Dashboard should now show 8 active roadmaps (step-1 → step-9 with step-2/4/5 newly created; step-99 archived).

## Acceptance

Phase 1–5 all green. After closeout, the `step-1` → `step-9` sequence from [`council-synthesis.md` § 6](../audit-2026-05-14-north-star/council-synthesis.md) is the canonical roadmap tree, and the G0–G4 gates from [`council-synthesis.md` § 8](../audit-2026-05-14-north-star/council-synthesis.md) govern the v3.0.0 ship.

## Done

- [ ] All five phases complete; this file lives in `archive/`.
