# Catalog-router paper prototype — initial-context measurement

> Phase 2.1 of `road-to-persona-library-harvest.md`. Hand-computed token counts
> (chars/4), no runtime. Decides whether the lazy catalog router clears the
> pre-declared **≥ 20 % initial-context reduction** gate before any code ships.
> Measured 2026-07-19 against the shipped surface at HEAD.

## What loads at init today (baseline)

Under the current build-time projection (`discipline_profile: auto`, thin
projection disabled per the 2026-07-11 null), a Claude-Code host receives the
**full artifact catalog** — every skill/command/persona `name + description` —
in its initial context, so it knows what it can reach. Measured from the
projected surface:

| Catalog | Files | name+description tokens (≈ chars/4) |
|---|--:|--:|
| Skills (`dist/agent-src/skills/*/SKILL.md`) | 276 | 13,477 |
| Commands (`dist/agent-src/commands/**/*.md`) | 189 | 6,720 |
| Personas (`src/agent-src/personas/*.md`) | 29 | 1,115 |
| **Total catalog in init** | **494** | **≈ 21,312** |

Bodies do **not** load at init — a skill/persona body loads only when invoked.
So the baseline **fixed** initial cost is the catalog (~21,312 tok); per task a
body loads on demand.

## Router path

Replace the catalog-in-init with three MCP tools (`catalog_search`,
`catalog_inspect`, `catalog_load`) over an on-disk index. The host no longer
carries 494 descriptions; it searches.

| Component | tokens |
|---|--:|
| 3 tool schemas at init (fixed) | ≈ 450 |
| per task: 1 `catalog_search` result (limit 8 summaries) | ≈ 320 |
| per task: 1 `catalog_load` body | = baseline body (cancels) |

## Five representative tasks (bodies cancel — same shape each)

Each task needs 1 skill + 1 persona; the body loads are identical in both
models, so only the **discovery** cost differs.

| # | Task | Skill / persona | Baseline init | Router init + search |
|---|---|---|--:|--:|
| 1 | Add an API endpoint | `api-endpoint` / `backend-architect` | 21,312 | 450 + 320 = 770 |
| 2 | Incident rollback | `blast-radius-analyzer` / `production-validator` | 21,312 | 770 |
| 3 | Review a contract | `contract-review` / (legal lens) | 21,312 | 770 |
| 4 | Design a dashboard | `dashboard-design` / (design lens) | 21,312 | 770 |
| 5 | Write a Playwright spec | `playwright-testing` / `qa` | 21,312 | 770 |

**Session of 5 tasks:** baseline fixed catalog = 21,312 tok (paid once);
router = 450 + 5×320 = 2,050 tok. **Initial-context reduction ≈ 90.4 %.**
Break-even is ≈ 65 skill-selection tasks in one session before the accumulated
search cost equals the one-time catalog load — far beyond a normal session.

Scoped to skills only (13,477 baseline) the reduction is still ≈ 84 %.

## Gate verdict

**GREEN — proceed to 2.2.** Median initial-context reduction ≈ 90 % ≫ the 20 %
gate. The token case for the router is overwhelming.

## The caveat the token gate does NOT capture (load-bearing)

Initial-context tokens are not the whole story. Removing the 494-description
catalog from init removes the host's **upfront awareness** of what it can do —
it must now *know to search*. The 2026-07-11 thin-projection null
(win-rate 36.2 % < 48 % → thin DISABLED) is direct evidence that shrinking the
in-context skill surface **harms task quality**, even when it saves tokens.

Mechanism-match (per `decision-revisit-gate`): that null tested **body
trimming** (shorter rule bodies), not **search-based discovery** (full content
kept, discovery deferred) — a different mechanism, so the null does not
automatically transfer. But the risk is the same shape and must gate
**activation**, not just token math.

## Real-tool confirmation (Phase 2.4)

The tools were built and the 5-task set re-run against the **real**
`catalog_search` handler over the built index: mean **≈ 638 tok/search** (8 hits
each) — the paper estimate of 320 undercounted the per-summary description size.
Recomputed: router for 5 tasks = 450 + 5×638 = **3,640 tok** vs baseline 21,312
→ **≈ 82.9 % reduction** (paper said ≈ 90 %; the real number is lower but still
**4× above the 20 % gate**). Gate holds under real measurement. The
stub→ALLOWLIST activation remains deferred per the caveat below.

## Consequence for Phase 2

**Consequence for Phase 2:** the index + scoring + tools are built and
registered as **discovery stubs** (present, inert — no behavior change). The
stub→ALLOWLIST flip that actually removes the catalog from init is **explicitly
deferred to a follow-up** behind a real-world A/B on task quality (win-rate vs
the current full-catalog baseline), never shipped on token savings alone. No
public token-savings claim until that A/B lands (see the roadmap's No-claims
note).
