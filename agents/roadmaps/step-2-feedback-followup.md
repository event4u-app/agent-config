---
complexity: lightweight
---

# Roadmap: PR #148 Feedback Follow-Up (Command Surface + Doc Links)

> Two non-council follow-ups from the GPT + Claude reviews of PR #148 that do NOT belong in [`step-1-ai-council-cli-transport.md`](step-1-ai-council-cli-transport.md). **(1)** Cognitive-load reduction — GPT flagged "108 commands" as a warning signal; audit the surface, merge overlapping commands, retire weak ones. **(2)** Pre-existing `check-public-links` failures on `mcp-*` contracts in `docs/architecture.md` that Claude's review identified as living on `main`, not on the PR branch.

## Prerequisites

- [ ] Read GPT's PR #148 review section "Cognitive Load steigt" (the 108-command warning) — captured in the conversation transcript that produced this roadmap
- [ ] Read Claude's PR #148 review note on the 11 pre-existing `check-public-links` failures on `mcp-*` contracts
- [ ] Read [`.augment/rules/preservation-guard.md`](../../.augment/rules/preservation-guard.md) — merging / retiring commands must preserve quality, not just shrink count
- [ ] Read [`docs/contracts/multi-tool-projection-fidelity.md`](../../docs/contracts/multi-tool-projection-fidelity.md) — any command surface change must respect projection fidelity
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

The two follow-ups are independent and may interleave or run in either order. Neither touches the AI Council subsystem — that work lives entirely in step-1. This roadmap is intentionally minimal — it captures GPT's "consolidate aliases / merge overlaps / kill weak commands" prescription and Claude's pre-existing-failure cleanup, nothing more.

Out-of-scope explicitly: Council positioning as "advanced subsystem" (covered indirectly by step-1 Phase 6's necessity classifier — once the classifier teaches users when NOT to invoke, the positioning follows). Council cost visibility, confidence explanation, decision replay, memory-aware council — all in step-1 Phases 8–9 or out-of-scope per step-1's Part B context. Command consolidation here is about the overall surface (`/work`, `/refine-ticket`, `/judge`, etc.), not council-specific commands.

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Sibling roadmaps:** [`step-1-ai-council-cli-transport.md`](step-1-ai-council-cli-transport.md) · [`step-3-agent-user-persona.md`](step-3-agent-user-persona.md) · [`step-4-ghostwriter.md`](step-4-ghostwriter.md) · [`step-5-test-cleanup.md`](step-5-test-cleanup.md) · [`step-6-user-types-axis.md`](step-6-user-types-axis.md) — independent; can interleave with any.

## Phase 1: Command-surface audit

Empirical inventory before any retirement. GPT's "108 commands" claim needs verification, classification, and overlap detection — only then can the user make consolidation decisions on real data.

- [ ] **Step 1 — Inventory script:** New `scripts/audit_command_surface.py` walks `.agent-src.uncompressed/commands/**.md`, counts entries, groups by directory (`commands/`, `commands/fix/`, `commands/memory/`, `commands/council/`, etc.), and emits `agents/reports/command-surface.{json,md}`. Report columns: command path, declared description, frontmatter `aliases` if any, line count, last-modified-on-disk timestamp.
- [ ] **Step 2 — Overlap detection:** Extend the script to flag commands with ≥0.6 cosine similarity on their descriptions (token-overlap heuristic, no embedding API needed). Output a "Likely-overlapping pairs" table in the report. Do NOT auto-merge — surface candidates for human decision.
- [ ] **Step 3 — Usage signal:** Cross-reference each command against `scripts/score_skill_selection.py`-style telemetry (router invocation logs if present, or git-blame age as a proxy when telemetry is absent). Flag commands not invoked in 90+ days as "candidates for retirement."
- [ ] **Step 4 — Categorise into three buckets:** Manual sweep over the report — `keep` (load-bearing or unique), `merge` (overlap pair → consolidation candidate), `retire` (weak / unused / superseded). Write the categorisation back into the report as a fourth column. STOP here and ask the user to review the three lists before any retirement happens — per [`scope-control`](../../.augment/rules/scope-control.md), command retirement is an architectural change.

## Phase 2: Execute consolidation

Only after Phase 1's report has been reviewed and the three buckets approved by the user. Each retirement / merge is a discrete, reversible commit so a regression in the surface is easy to roll back.

- [ ] **Step 1 — Retire weak commands:** For each `retire` entry — move `.agent-src.uncompressed/commands/<path>.md` to `.agent-src.uncompressed/commands/_archive/` with a one-line `_archive/README.md` entry citing the report row. Run `task sync` + `task generate-tools` so the projection trees drop the entry cleanly. Verify `task ci` green.
- [ ] **Step 2 — Merge overlap pairs:** For each `merge` entry — designate the canonical command, rewrite its description to cover both jobs, add the retired one's name to the canonical command's `aliases:` frontmatter so existing user muscle-memory keeps working. Retire the duplicate via Step 1's pattern. One commit per merge.
- [ ] **Step 3 — Regenerate router:** `python3 .augment/scripts/build_router.py` (or the equivalent — confirm via `task sync`) so the runtime router sees the reduced surface. Verify the routing tests still pass — `task ci` covers this.
- [ ] **Step 4 — Update the auto-generated command index:** Any `docs/commands.md` or similar generated index regenerates from sync. Confirm the new count lands in the README's stats block if one exists.
- [ ] **Step 5 — Report the delta:** Append a "Post-consolidation" section to `agents/reports/command-surface.md` with before/after counts per directory, list of retired commands, list of merged pairs. Cite in the PR description when the work ships.

## Phase 3: Fix pre-existing `check-public-links` failures on mcp-* contracts

Claude's PR #148 review noted 11 pre-existing `check-public-links` failures on `mcp-*` contracts in `docs/architecture.md`. These are independent of the PR but were left as known-failures-on-`main`. Phase 3 closes them so future PRs don't carry the noise.

- [ ] **Step 1 — Reproduce the failures locally:** Run `python3 scripts/check_public_links.py docs/architecture.md` (or whatever the actual lint script is named — confirm via `Taskfile.yml`). Capture the exact 11 broken URLs with their line numbers.
- [ ] **Step 2 — Categorise each failure:** Per URL — `dead` (404, content gone) / `moved` (redirects to new location) / `temporary` (5xx, retry might succeed) / `private` (now behind auth). Group the 11 into these four buckets.
- [ ] **Step 3 — Fix per bucket:** `moved` → update the link to the canonical URL. `dead` → drop the link entirely if the surrounding sentence still reads, OR find a replacement reference. `temporary` → re-run after a delay; if still failing, treat as `dead`. `private` → drop or move to the "Internal references" footer pattern if one exists.
- [ ] **Step 4 — Verify on the changed file:** Re-run the linter on the file — exit 0. Run `task ci` — clean.
- [ ] **Step 5 — Document any policy gap:** If the link-check policy needs an "ignore list" for vendor URLs that ship 403 to unauthenticated linters, document it in [`docs/contracts/`](../../docs/contracts/) and wire the allowlist into the script. Do NOT add a blanket bypass — every entry on the allowlist needs a one-line reason.

## Acceptance Criteria

- [ ] Phase 1 — `agents/reports/command-surface.{json,md}` shipped with full inventory + overlap pairs + retirement candidates + three-bucket categorisation reviewed by the user
- [ ] Phase 2 — All approved retirements + merges landed, `task sync` + `task generate-tools` clean, router regenerated, delta report appended, `task ci` green
- [ ] Phase 3 — 11 pre-existing `check-public-links` failures on `mcp-*` contracts in `docs/architecture.md` resolved, linter exit-0 on the file, `task ci` green
- [ ] Quality gates pass at each phase boundary (`task ci` green; pytest green; skill-lint clean)
- [ ] Council session artefacts (if any council runs are invoked during this work) remain under `agents/council-sessions/`
