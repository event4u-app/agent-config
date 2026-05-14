# North Star Plan — `event4u/agent-config` → Senior-Dev Bar

**Date:** 2026-05-14
**Inputs:**
[`external-findings.md`](external-findings.md) (4 repos surveyed) +
[`internal-audit.md`](internal-audit.md) (5 role passes) +
[`../council-sessions/2026-05-14-v2-analysis/feedback/`](../council-sessions/2026-05-14-v2-analysis/feedback/)
(13 verified findings).

**Goal:** Lift the package from "best-in-class governance, unmeasured
everything else" to a senior-dev-grade kit where every claim has a
fixture, every Iron Law has a hook, every skill declares its cost class,
and every persona has an adoption path.

---

## 1. The four pillars

| Pillar | Closes | Headline metric |
|---|---|---|
| **P1 — Measurement** | 6 audit gaps + F2/F5/F6/U1/U2/U3/U5 | `task bench` → output-token-saving %, selection-accuracy %, $/task, projection-fidelity % — published per release |
| **P2 — Mechanical enforcement** | 5 audit gaps + F1/U2 | `AGENT: <slug>` marker contract + stop-hook gate + `task ci:strict` (zero linter WARN allowed) |
| **P3 — Schema rigor** | 5 audit gaps | Schema v2 with `schema_version`, `model_tier`, `distinguishes_from`, `disambiguation`, `## Deep Reference` cut-point; migration registry |
| **P4 — Adoption ramp** | 4 audit gaps + S5 | Role bundles (engineer / PO / designer / strategist) + standalone-vs-supercharged table per skill + 30-second day-1 path |

These four pillars subsume the 13 council findings and all 32 audit
pain points (D1–D6, T1–T6, P1–P6, S1–S6, A1–A8) without remainder.

---

## 2. Roadmap mapping — what exists, what changes, what is new

Current state (numbered prefix order):

| Slot | File | Pillar fit |
|---|---|---|
| step-1 | `step-1-v2-feedback-followup.md` | Mostly **P2** (linter gate, archive dead scripts) + **P1** (rename "compression") |
| step-2 | `step-2-ai-council-consolidation.md` | **P2** (Master/Wrapper enforcement) |
| step-3 | `step-3-public-personas.md` | **P4** (role-bundle on-ramp) |
| step-4 | `step-4-ghostwriter.md` | **P4** (LinkedIn-derived persona injection) |
| step-5 | `step-5-test-cleanup.md` | **P2** (test hygiene) |
| step-6 | `step-6-user-types-axis.md` | **P4** (domain filter, harmonist-style) |

Gaps: **P1 (Measurement)** has no dedicated roadmap. **P3 (Schema
rigor)** has no dedicated roadmap. The North Star adds two and
re-numbers the existing ones to keep the strictest dependency order.

---

## 3. Proposed new order (after North Star adoption)

Strict dependency chain — each step unblocks the next. Pillar tag in
brackets.

| New slot | File | Pillar | Why this position |
|---|---|---|---|
| **step-1** | `step-1-v2-feedback-followup.md` (unchanged content) | P1 + P2 | Cheap hygiene + linter gate. Closes 6 of 13 council findings. Momentum + outside credibility. |
| **step-2** | `step-2-schema-v2-migration.md` (**NEW**) | P3 | Schema v2 + migration registry + `model_tier` + `distinguishes_from` + `## Deep Reference`. Everything else after this benefits from it. |
| **step-3** | `step-3-ai-council-consolidation.md` (renamed from old step-2) | P2 | Master/Wrapper contract + Iron Law `AGENT: <slug>` marker. Builds on schema v2. |
| **step-4** | `step-4-measurement-and-benchmark.md` (**NEW**) | P1 | `task bench`, golden corpus, selection-accuracy %, cost surface, projection fidelity. Requires schema (step-2) for `model_tier` + council (step-3) for review-gate fixtures. |
| **step-5** | `step-5-test-cleanup.md` (unchanged) | P2 | Test hygiene. Strict CI follow-on. Position keeps the prefix stable. |
| **step-6** | `step-6-public-personas.md` (renamed from old step-3) | P4 | Role bundles. Now declarable via schema v2 + measurable via step-4. |
| **step-7** | `step-7-ghostwriter.md` (renamed from old step-4) | P4 | LinkedIn enrichment. Layered on top of personas. |
| **step-8** | `step-8-user-types-axis.md` (renamed from old step-6) | P4 | Domain filter. Final layer on the adoption-ramp stack. |

Two **new** files, six **renames**, zero deletions.

---

## 4. New roadmap shapes (one-paragraph briefs)

### step-2 — Schema v2 migration *(NEW)*

Define `schemas/skill.v2.schema.json` adding `schema_version` (required,
constant `"2"`), `model_tier` (`fast` / `inherit` / `reasoning`),
`distinguishes_from` (array of skill slugs), `disambiguation`
(one-liner), and a body convention requiring a `## Deep Reference`
cut-point for any skill > 80 lines essentials. Ship
`scripts/migrate_schema.py` with a versioned registry that rolls v1 → v2
without touching skill semantics. `task lint-skills` learns the new
fields; existing 208 skills migrated by script + spot-review. ADR at
`docs/contracts/adr-schema-v2.md`. Estimated 6 phases / ~30 steps.

### step-4 — Measurement & benchmark suite *(NEW)*

Define a 50-prompt golden corpus at
`tests/golden/bench/corpus.yml` with expected skill / rule fires per
prompt. Ship `task bench` (output-token saving %, selection-accuracy %,
cost / task auto-captured from session jsonl à la ruflo, projection
fidelity %). Publish `BENCH.md` with the per-release table. Cost surface
exposed via `cost-report` skill (50/75/90/100 ladder, hard stop at 100).
Per-tool projection fidelity test (closes U5). Estimated 7 phases /
~40 steps.

---

## 5. Existing roadmaps — required deltas

Renames only (no content change in this round):

| Old name | New name |
|---|---|
| `step-2-ai-council-consolidation.md` | `step-3-ai-council-consolidation.md` |
| `step-3-public-personas.md` | `step-6-public-personas.md` |
| `step-4-ghostwriter.md` | `step-7-ghostwriter.md` |
| `step-6-user-types-axis.md` | `step-8-user-types-axis.md` |

step-1 and step-5 keep their slots.

After renames: regenerate `agents/roadmaps-progress.md`. Verify with
`task check-roadmap-trackable`.

---

## 6. Open questions for next council round

The North Star plan above answers nothing about three deliberate
choices. Park for a council round before locking:

1. **Default-on caveman**? Caveman ships `speak_scope` default on for
   output tokens. We ship default off (carve-outs for security /
   destructive / multi-step). The senior-dev bar wants telemetry
   first, then a data-driven default flip. **Decision needed in
   step-4 closeout, not now.**
2. **Runtime stop-hook for Iron Laws.** Harmonist uses Cursor hooks.
   Augment / Windsurf / Cline lack equivalents. We can ship a CLI
   `check-stop` script that the user wires into their tool — but that
   shifts enforcement responsibility back to the user. **Decision in
   step-3 (council consolidation).**
3. **`AGENT: <slug>` marker** is harmonist-specific. For agent-config,
   the closest equivalent is the `mode-marker` already enforced by
   `role-mode-adherence`. Council should rule: extend `mode-marker` to
   include `subagent-marker`, or introduce a separate marker?
   **Decision in step-3.**

These are intentionally **not** in the new roadmaps; they need a council
round on the consolidated findings first.

---

## 7. Acceptance — what "Senior Dev bar reached" looks like

The four pillars converted into release-gate language:

| Gate | Pillar | Pass criterion |
|---|---|---|
| G1 — measured savings | P1 | `task bench` produces a numeric table per release; output-token saving claimed = measured, not vibes |
| G2 — enforced laws | P2 | `task ci:strict` runs in release flow and blocks tag push on linter WARN > 0; `AGENT: <slug>` marker required in every subagent invocation; missing marker = test fail |
| G3 — typed schema | P3 | 100 % of skills declare `schema_version=2`, `model_tier`, and (where applicable) `distinguishes_from`; CI rejects v1 |
| G4 — adoption ramp | P4 | Role bundles (engineer / PO / designer / strategist) install via `npx event4u/agent-config install --bundle=engineer`; standalone-vs-supercharged table on every skill |

When G1–G4 all green on the same tag, we mark v3.0.0 and call the North
Star reached.

---

## 8. Immediate next actions (post-audit, pre-roadmap-edit)

In order:

1. Run `/council:default` on this plan + audits as inputs, ask the
   council to challenge pillar selection and pillar-to-roadmap mapping.
2. Lock the rename plan (section 5) only after council closeout.
3. Draft `step-2-schema-v2-migration.md` and
   `step-4-measurement-and-benchmark.md` files using `roadmap-writing`
   skill.
4. Execute renames via `git mv` once new files exist; regenerate
   progress dashboard; verify `task ci` green.
5. Commit in two chunks: (a) audit deliverables + plan, (b) roadmap
   restructure + new files.

**Stopping here** — per request "Leg los, mach das alles eigenständig",
the analytical and synthesis pass is complete. The roadmap-rename +
new-roadmap-draft phase is the next user-visible work block; awaiting
your green light before touching the `agents/roadmaps/` tree.
