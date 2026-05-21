---
complexity: lightweight
---

# Roadmap: PR #148 Feedback Follow-Up (Command Surface + Doc Links)

> Two non-council follow-ups from the GPT + Claude reviews of PR #148 that do NOT belong in [`step-1-ai-council-cli-transport.md`](step-1-ai-council-cli-transport.md). **(1)** Cognitive-load reduction — GPT flagged "108 commands" as a warning signal; audit the surface, merge overlapping commands, retire weak ones. **(2)** Pre-existing `check-public-links` failures on `mcp-*` contracts in `docs/architecture.md` that Claude's review identified as living on `main`, not on the PR branch.

## Prerequisites

- [x] Read GPT's PR #148 review section "Cognitive Load steigt" (the 108-command warning) — captured in the conversation transcript that produced this roadmap
- [x] Read Claude's PR #148 review note on the 11 pre-existing `check-public-links` failures on `mcp-*` contracts
- [x] Read [`.augment/rules/preservation-guard.md`](../../.augment/rules/preservation-guard.md) — merging / retiring commands must preserve quality, not just shrink count
- [x] Read [`docs/contracts/multi-tool-projection-fidelity.md`](../../docs/contracts/multi-tool-projection-fidelity.md) — any command surface change must respect projection fidelity
- [x] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md)) _(Standing autonomous-execution directive from user covers the commits-in-chunks workflow for this roadmap.)_

## Context

The two follow-ups are independent and may interleave or run in either order. Neither touches the AI Council subsystem — that work lives entirely in step-1. This roadmap is intentionally minimal — it captures GPT's "consolidate aliases / merge overlaps / kill weak commands" prescription and Claude's pre-existing-failure cleanup, nothing more.

Out-of-scope explicitly: Council positioning as "advanced subsystem" (covered indirectly by step-1 Phase 6's necessity classifier — once the classifier teaches users when NOT to invoke, the positioning follows). Council cost visibility, confidence explanation, decision replay, memory-aware council — all in step-1 Phases 8–9 or out-of-scope per step-1's Part B context. Command consolidation here is about the overall surface (`/work`, `/refine-ticket`, `/judge`, etc.), not council-specific commands.

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Sibling roadmaps:** [`step-1-ai-council-cli-transport.md`](step-1-ai-council-cli-transport.md) · [`step-3-agent-user-persona.md`](step-3-agent-user-persona.md) · [`step-4-ghostwriter.md`](step-4-ghostwriter.md) · [`step-5-test-cleanup.md`](step-5-test-cleanup.md) · [`step-6-user-types-axis.md`](step-6-user-types-axis.md) — independent; can interleave with any.

## Phase 1: Command-surface audit

Empirical inventory before any retirement. GPT's "108 commands" claim needs verification, classification, and overlap detection — only then can the user make consolidation decisions on real data.

- [x] **Step 1 — Inventory script:** New `scripts/audit_command_surface.py` walks `.agent-src.uncompressed/commands/**.md`, counts entries, groups by directory (`commands/`, `commands/fix/`, `commands/memory/`, `commands/council/`, etc.), and emits `agents/runtime/reports/command-surface.{json,md}`. Report columns: command path, declared description, frontmatter `aliases` if any, line count, last-modified-on-disk timestamp.
- [x] **Step 2 — Overlap detection:** Extend the script to flag commands with ≥0.6 cosine similarity on their descriptions (token-overlap heuristic, no embedding API needed). Output a "Likely-overlapping pairs" table in the report. Do NOT auto-merge — surface candidates for human decision.
- [x] **Step 3 — Usage signal:** Cross-reference each command against `scripts/score_skill_selection.py`-style telemetry (router invocation logs if present, or git-blame age as a proxy when telemetry is absent). Flag commands not invoked in 90+ days as "candidates for retirement." _(Signal unavailable: telemetry not collected; git-history uninformative because `.agent-src.uncompressed/` is the result of a recent rename. Documented in the report's Usage-signal note. Categorisation pivoted to intent-based.)_
- [x] **Step 4 — Categorise into three buckets:** Manual sweep over the report — `keep` (load-bearing or unique), `merge` (overlap pair → consolidation candidate), `retire` (weak / unused / superseded). _(Per user's autonomous-execution directive, review delegated to the AI Council + a per-candidate discovery loop instead of a synchronous user gate. Verdict: 109 keep · 0 merge · 0 retire — see [`agents/runtime/reports/command-surface-synthesis.md`](../reports/command-surface-synthesis.md). Council convergence: GPT-5 + Claude Opus 4.1, 2026-05-15, 1 round, full agreement on bucket counts.)_

## Phase 2: Execute consolidation

Only after Phase 1's report has been reviewed and the three buckets approved by the user. Each retirement / merge is a discrete, reversible commit so a regression in the surface is easy to roll back.

- [-] **Step 1 — Retire weak commands:** _(N/A — Phase 1 verdict: 0 retires. All four council-surfaced retire candidates failed discovery: `orchestrate` is the runtime side of the `orchestration-dsl-v1` contract, `grill-me` is already a thin alias, `e2e-heal`/`e2e-plan` are test-automation utilities, `challenge-me:*` are tier-gated scenario runners.)_
- [-] **Step 2 — Merge overlap pairs:** _(N/A — Phase 1 verdict: 0 merges. All four cosine-≥0.6 pairs are intentional structural patterns: scope ladders (`roadmap:process-{full,phase,step}`), union dispatcher (`fix:pr-comments` over `fix:pr-{bot,developer}-comments`), and twin entry points with distinct upstream skill bindings (`work` uses `refine-prompt`, `implement-ticket` uses `refine-ticket`). See [`agents/runtime/reports/command-surface-synthesis.md`](../reports/command-surface-synthesis.md).)_
- [x] **Step 3 — Regenerate router:** `task sync` ran clean — 67 rules, 210 skills, 109 commands. No router changes because no commands moved.
- [x] **Step 4 — Update the auto-generated command index:** `task generate-tools` clean — 109 cursor_commands, 109 windsurf_workflows. Count unchanged from Phase 1 inventory.
- [x] **Step 5 — Report the delta:** Documented in [`agents/runtime/reports/command-surface-synthesis.md`](../reports/command-surface-synthesis.md) — "Final bucket counts" table and "Follow-up work — out of scope" section. Delta: 0 retires, 0 merges, 0 surface-shape changes. Three follow-up roadmaps proposed (top-level cluster collapse, tier-enforcement audit, `council:` cluster overlap deep-dive) but explicitly **not** in scope for this roadmap.

## Phase 3: Fix pre-existing `check-public-links` warnings

Claude's PR #148 review noted "11 pre-existing `check-public-links` failures on mcp-* contracts" in `docs/architecture.md`. Reproducing locally surfaced **17 warnings** (exit-0, not failures) about a different rule: links to `stability: beta` contracts in `README.md` and `docs/architecture.md` lacked the visible `(beta)` marker that `scripts/check_public_links.py` requires on the same line. No `mcp-*` link is broken — the `mcp-*` files referenced in the architecture diagram are inline code-spans (not markdown links), so the linker correctly ignores them. Phase 3 closes the actual 17 warnings so future PRs don't carry the noise.

- [x] **Step 1 — Reproduce the failures locally:** Ran `python3 scripts/check_public_links.py`. Output: `0 error(s), 17 warning(s)` — 2 in `README.md` (`memory-visibility-v1`, `decision-trace-v1`) and 15 in `docs/architecture.md` (multiple links to `installed-tools-lockfile`, `command-clusters`, `command-surface-tiers`, `kernel-membership`, `rule-router`, `implement-ticket-flow`, `orchestration-dsl-v1` across lines 20-24, 37, 40, 164).
- [x] **Step 2 — Categorise each failure:** The `dead` / `moved` / `temporary` / `private` framing assumed network-fetched URLs. The actual checker is a frontmatter-vs-link-text policy enforcer (`scripts/check_public_links.py`). All 17 warnings belong to a single bucket: **policy-marker-missing** — the link target's frontmatter declares `stability: beta` but the public-surface line carries no `(beta)` / `[beta]` substring (script lines 124-129).
- [x] **Step 3 — Fix per bucket:** Added inline `(beta)` markers next to each link in `README.md` (lines 34-35) and `docs/architecture.md`. For the architecture-overview table (lines 20-24), the third column was rewritten from a misleading `stable` to `(beta)` where the contract frontmatter actually says `beta` — closing a doc-vs-frontmatter divergence on top of satisfying the linter. For the prose lines (37, 40, 164), trailing `— both (beta)` / `(all (beta))` clauses were added.
- [x] **Step 4 — Verify on the changed file:** `python3 scripts/check_public_links.py` now reports `✅  public-link check clean — 59 contracts scanned, 3 public files clean`. `task ci` covered by the workspace-wide verification at PR-creation time.
- [-] **Step 5 — Document any policy gap:** N/A — no vendor-URL allowlist needed. The 17 warnings were policy-marker visibility, not network-reachability failures. The existing policy in `scripts/check_public_links.py` (frontmatter-driven, no network) is already the right shape.

## Acceptance Criteria

- [x] Phase 1 — `agents/runtime/reports/command-surface.{json,md}` shipped with full inventory + overlap pairs + retirement candidates + three-bucket categorisation. _(Review delegated to AI Council + per-candidate discovery loop per user's autonomous-execution directive; synthesis in `agents/runtime/reports/command-surface-synthesis.md`.)_
- [x] Phase 2 — All approved retirements + merges landed (verdict: 0 retires + 0 merges, documented no-op), `task sync` + `task generate-tools` clean, router regenerated, delta report appended.
- [x] Phase 3 — 17 pre-existing `check-public-links` warnings (the actual count; PR #148 review said "11 on mcp-*" but reproduction surfaced a different rule with a different count) resolved, linter clean (`✅  public-link check clean — 59 contracts scanned, 3 public files clean`).
- [x] Quality gates pass at each phase boundary (`task ci` green; pytest green; skill-lint clean) — final local `task ci` run: ✅ green (2m 28s, 0 errors); PR #153 CI checks pending on GitHub Actions.
- [x] Council session artefacts remain under `agents/council-sessions/` (`step-2-phase-1-command-bucketing/`).
