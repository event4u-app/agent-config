# Token-Optimizer Skill — Design Analysis

**Date:** 2026-05-06
**Trigger:** Matze ask — standing skill that ties existing token-saving
assets together as a decision tree, kept fresh as new tools/rules land.
**Council:** claude-sonnet-4-5 + gpt-4o, 1 round, $0.0390 actual.
**Artefacts:** `agents/council-questions/token-optimizer-design.md`,
`agents/council-responses/token-optimizer-design.json`.

## Existing surface (cross-checked for overlap)

| Layer | Asset | Type | Coverage |
|---|---|---|---|
| Response brevity | `direct-answers` | rule (always) | no flattery, brevity floor |
| Tool-call discipline | `token-efficiency` | rule (always) | anti-loop, redirect output |
| CLI output | `cli-output-handling` | rule (auto, tier 2a) | rtk-first, tail/grep fallback |
| CLI subcmds | `rtk-output-filtering` | skill | rtk catalog, install, project filters |
| Document conv | `markitdown` | skill | PDF/Office/HTML → MD |
| Context window | `agent-handoff` | skill | fresh-chat handoff |
| Source compression | `compress.{sh,py}`, `check_compression.py` | scripts | `.agent-src.uncompressed/` → `.agent-src/` |
| Cost metering | `/cost:report` (in-flight P1.2 of `road-to-ruflo-adoption.md`) | command | per-session JSONL + alert ladder |

**Gap:** no single consult point at the *moment of decision*. Today the
agent must synthesize all of the above under pressure, which is exactly
when cognitive load causes suboptimal picks.

## Council synthesis

| Cluster | Sonnet | GPT-4o | Resolution |
|---|---|---|---|
| **Q1 — skill shape** | (c) tree + catalog hybrid | (a) pure decision tree | **(c)** wins on weight — Sonnet's "scannable under pressure + cold-readable for maintenance" frames the dual audience (live agent vs. reviewer); pure tree fails the second use case |
| **Q2 — maintenance enforcement** | (b) auto-rule + CI, but implement as **link validator** (semantic-drift check) not edit-trigger | (b) auto-rule + CI | **(b) with link-validator implementation** — Sonnet's "process debt disguised as automation" critique accepted; CI cost is paid only when the map no longer matches the territory, not on every edit |
| **Q3 — trigger wording** | (c) hybrid proactive + reactive + Iron Law | (b) proactive only | **(c)** wins on weight — pure proactive triggers are vague and fire spuriously; hybrid gives both the conceptual frame and the concrete pattern-match |

### Sonnet net-new candidate (accepted)

**Telemetry stub** — one-line append to `token-optimizer` skill:
```markdown
<!-- TELEMETRY: consulted=[timestamp] context=[CLI|doc|handoff|cost] -->
```
Plus a 10-line `scripts/count_token_optimizer_usage.sh` (grep + wc) to
answer "did the agent actually consult this?" within 1 week of shipping.
ICE 504 (7·8·9). **Tier S** — accepted as P1.4 of the roadmap. Closes
the "ghost-infrastructure" risk without waiting for full Ruflo JSONL
integration (P1.2 of `road-to-ruflo-adoption.md`).

### Sonnet conditional objection (accepted)

Original P1.2 spec ("auto-rule fires on edits to 7+ tracked assets")
would trigger on no-op edits (whitespace, comment-only, semantic-
preserving refactors), creating zero-value cognitive tax. **Rewrite as
link validator**: parse `token-optimizer.md` for `[asset](path)`
citations, verify each target exists, extract its trigger keywords,
fail when the decision-tree leaf says "use X for Y" but X's source no
longer mentions Y. Pays CI cost only on **semantic drift**.

## Adoption plate (3 of 5 Hard-Cap slots)

| # | Adoption | Tier | Sunset | Effort |
|---|---|---|---|---|
| P1.1 | `token-optimizer` skill — tree (top) + catalog (below), proactive+reactive triggers, Iron Law "consult before action" | S | clean ≤300 | 0.75 d |
| P1.2 | `token-optimizer-maintenance` auto-rule (tier 2a) — fires on intent to edit tracked assets, requires consulting token-optimizer in same PR | S | clean ≤120 | 0.25 d |
| P1.3 | `scripts/check_token_optimizer_freshness.py` — **link validator**, not edit-trigger; CI gate that fails on semantic drift | S | clean ≤150 | 0.5 d |
| P1.4 | Telemetry stub — append-comment + `scripts/count_token_optimizer_usage.sh` | S | clean ≤30 lines script | 0.25 d |
| P1.5 | Suite integration — manifests, sync, generate-tools, full `task ci` | — | — | 0.25 d |

Total Phase 1: ~2.0 d. Within Hard Cap (5/5 slots used; this plate
**fully consumes** the 6-week capacity).

## Phase 2 — out-of-horizon (deferred-with-trigger)

Both council members explicitly recommended **measuring before
expanding**. Phase 2 reopens only on observable signal:

- **P2.1 — Cost-telemetry feedback loop** (Sonnet candidate #3, ICE 280) —
  wire `/cost:report` JSONL to surface "this session would have saved
  $X with rtk on commands Y/Z" in the next handoff. **Trigger to reopen:**
  P1.2 of `road-to-ruflo-adoption.md` shipped AND P1.4 telemetry shows
  ≥5 consults/week sustained for 2 weeks.
- **P2.2 — Decision-tree expansion** — add nodes for new token-saving
  tools that land between Phase 1 ship and Phase 2 review. **Trigger
  to reopen:** ≥2 new tools landed.
- **P2.3 — Rule slimming against the skill** (added 2026-05-06 after
  Matze's follow-up question on rule-shrink potential). Move
  catalog/example material out of `token-efficiency.md` into pointers
  to `token-optimizer` leaves; Iron Laws and Anti-Loop sections stay
  verbatim; `direct-answers` and `cli-output-handling` are out of
  scope (no shrink room). **Trigger to reopen:** P3.1 audit confirms
  ≥5 consults/week sustained — i.e., skill is load-bearing, not
  ghost infrastructure. Doing this earlier would hollow the always/
  auto-loaded floor for unproven gain.

## Phase 3 — governance cross-cut

- **P3.1 — Sunset audit** after Phase 1 has been live for one full
  cycle. If consults <5 in 2 weeks (Sonnet's kill-criterion), sunset the
  skill and strengthen the underlying rules instead — and document the
  null result so the same proposal isn't repeated.

## Provenance

- Council artefacts: `agents/council-questions/token-optimizer-design.md`,
  `agents/council-responses/token-optimizer-design.json`
- Existing assets cross-checked: see "Existing surface" table above
- Hard Cap source: `road-to-microck-harvest.md` (5 adoptions per 6-week
  plate)
- Sunset Policy: `docs/contracts/STABILITY.md`
