---
class: B
trust: medium
kind: silent-convention
domain: roadmap-authoring
convention_id: roadmap-phase-heading
sources:
  - { artifact: "agents/roadmaps/road-to-mission-catalogue.md", date: "2026-06-16", note: "authored with package active; used `## Deferred-with-trigger work` → silently dropped from the dashboard" }
confirm_against: "dist/agent-src/scripts/update_roadmap_progress.py :: parse_roadmap / PHASE_RE"
---

# Silent convention — roadmap section headings must be `## Phase N — …`

> **The v2-accumulated context card** for the `roadmap-phase-heading` task. The
> `no-context` and `v1` arms do NOT receive this card; the `v2-accumulated` arm
> does. The eval measures whether carrying it lowers the violation rate vs `v1`.

## The convention

`update_roadmap_progress.py::parse_roadmap` only counts a roadmap's checkboxes
when they sit under a `## Phase N — …` heading (`PHASE_RE`). A roadmap whose
work lives under any other heading (`## Deferred-with-trigger work`,
`## Tasks`, `## Backlog`, …) returns `None` from the parser and is **dropped
from the dashboard entirely** — even when `status: ready` with open checkboxes.

## The silent consequence

No error at author time. No linter fails (the roadmap linters —
`lint_roadmap_complexity`, `check_roadmap_trackable`, `lint_roadmap_ci_steps`,
`lint_roadmap_later_disposition` — all pass on a non-`## Phase` roadmap). The
roadmap simply never appears in `agents/roadmaps-progress.md`; the work is
invisible to anyone reading the dashboard. `road-to-mission-catalogue.md` sat
`ready` and invisible until the heading was renamed (2026-06-16).

## Discrimination pre-check

1. **No linter / CI gate** — PASS. Grep `## Phase` / `PHASE_RE` across
   `src/scripts/lint_*` / `check_*`: the matches are *complexity* and
   *trackability* checks, none fail on heading **absence**. mission-catalogue
   passed every roadmap linter while invisible.
2. **Not in an always-loaded rule** — PASS. `roadmap-progress-sync` (always-on)
   governs checkbox cadence, glyphs, archival — it never states the
   `## Phase N` heading requirement or the dashboard-invisibility consequence.
3. **Not in an auto-loaded skill** — **SOFT pass.** `roadmap-writing` /
   `roadmap-management` reference *phases*, so v1 may produce `## Phase`
   headings sometimes. BUT neither states the **consequence** (silent
   dashboard-drop) — and the wild violation below proves v1 does not reliably
   apply it. The discriminating, un-encoded bit is the *consequence knowledge*,
   not the word "phase". The run settles the v1↔v2 gap empirically.
4. **Evidence of violation** — PASS. `road-to-mission-catalogue.md`, authored
   2026-06-16 **with the package active**, used `## Deferred-with-trigger work`
   and was invisible. A real, dated, package-active violation.

## Task (given to every arm)

> Add a new section of three trigger-gated work items to the existing roadmap
> `agents/roadmaps/road-to-mission-catalogue.md` (the items below). Keep the
> roadmap consistent with how this repo's roadmaps are structured.
>
> Items: `/mission:rector-upgrade`, `/mission:enum-migration`,
> `/mission:config-cache-audit` — each with a one-line trigger.

(The task wording deliberately invites a descriptive heading — "a new section"
— without naming `## Phase`, mirroring the mission-catalogue failure.)

## Ground-truth compliant output

The new section heading matches `## Phase N — …` (next free N), so the items are
counted by the dashboard. **Violation** = any other heading (`## New missions`,
`## Deferred …`, `## Additional work`, …), which silently drops the items.

## Scoring

Binary per run: `compliant` if the authored section heading matches
`^## Phase \d+`, else `violation`. Run `update_roadmap_progress.py --json` on the
edited file as the deterministic oracle — the new items appear in the count iff
compliant. Report per-arm violation rate + `pass^k` + the mandatory `cost` block.
