# Roadmap Priority Advisory — 2026-Q2

> **Status:** advisory · user-decided. Produced 2026-05-09 as P5.2 of
> `road-to-feedback-followups.md`. No "council-validated" gate; user
> is the final arbiter on sequencing.

## Inputs

- 13 open roadmaps (`agents/roadmaps-progress.md` 2026-05-09).
- Three ranking axes per roadmap: (a) external-adoption pull,
  (b) blocking-other-work, (c) effort-to-close.
- Source goal-lines read directly from each roadmap's preamble and
  Status block; no second-hand summary.

## Ranking summary

| # | Roadmap | Pull | Blocking | Effort | Verdict |
|---|---|---|---|---|---|
| 1 | road-to-feedback-followups | low | medium | **xs** — 1 phase open | **finish first** |
| 2 | road-to-proof-not-features | **high** | low | s — 3 phases, no new surface | **start next** |
| 3 | road-to-chat-history-cross-agent-hardening | low | **high** — 30/127 test failures | s — Phase 1 ~50-line patch | **parallel-OK** |
| 4 | road-to-deep-research-adoption (Ph 2) | medium | low | s — 5-unit cap | gated on Ph 1 evidence |
| 5 | road-to-event-driven-discipline | low | **high** — shrinks always-rule budget | m | infra leverage |
| 6 | road-to-mcp-server (Ph 1) | **high** — distinguishing feature | low | m — MVP spike | strategic differentiator |
| 7 | road-to-superpowers-harvest | medium | medium | s — bundled B+C+D | 5-unit cap, plate-fit |
| 8 | road-to-better-skills-and-profiles | medium | medium — Wing 1 foundation | l — 35 steps | re-scoped, large |
| 9 | road-to-distribution-and-adoption | **high** | low | l — 4 blocks | sibling of #2 |
| 10 | road-to-productization | medium | low | xl — master roadmap | **gated** on #2 + #8 |
| 11 | road-to-unified-senior-roles | medium | low | l — 19 steps | non-engineering wings |
| 12 | road-to-gtm-and-growth | medium | low | l — Wing 3 | joint with #11 |
| 13 | road-to-money-strategy-ops | low | low | xl — largest, Wing 4 | tail of queue |

Pull / Blocking / Effort scale: **low · medium · high · xs · s · m · l · xl**.

## The three-tier recommendation

### Tier 1 — close before starting anything new

1. **road-to-feedback-followups** — at Phase 5 (advisory + verification).
   Phase 4 (showcase + GitHub discussion) is user-action; this advisory
   closes Phase 5. Effort to close is the lowest in the queue.

### Tier 2 — pick exactly two for the next plate

The 6-week plate caps total adoption-unit count. Recommended pair:

2. **road-to-proof-not-features** — single-goal, three deliverables, no
   new contracts, no new surface. Both prior 2-AI critiques converged on
   "the next PR must be a proof PR, not a feature PR." Highest external
   leverage per unit-of-effort in the entire backlog.
3. **road-to-chat-history-cross-agent-hardening (Phase 1 only)** — fixes
   the v3→v4 CLI-surface dead refs that crash `chat-history:state`,
   `chat-history:adopt`, several `--first-user-msg` flags. ~50-line
   patch. Unblocks ~30 of 127 pre-existing test failures. Phase 2
   (test-debt clearance via bulk deletion) is Hard-Floor gated and must
   wait for explicit re-authorization.

Rationale for picking exactly two: Tier 1 is in flight; the plate-cap
of 5 adoption units per six-week window applies to harvest-style work
(Deep-Research Ph 2, Superpowers, Microck-style harvests). Proof and
chat-history are not harvests — they don't consume the cap, they
unblock work that does.

### Tier 3 — eligible to enter Tier 2 once one Tier-2 item ships

In recommended order:

4. **road-to-event-driven-discipline** — move agent-discipline rules
   from always-active to hook-dispatched. Shrinks the always-rule
   budget, which makes every consumer install cheaper. Pairs well with
   any Wing-N roadmap because it lowers the cost of adding new senior
   surfaces.
5. **road-to-deep-research-adoption Phase 2** — Phase 1 shipped at 43%
   completion (5 of 5 thinking-layer artifacts adopted). Phase 2
   thinking-layer skills (5w2h, six-hats, systems-thinking,
   first-principles) are the strongest remaining adoption candidates,
   gated on Phase 1 evidence (lint clean, integration confirmed).
6. **road-to-mcp-server Phase 1 (MVP spike)** — distinguishing feature
   vs `claude-skills` (no MCP server today). Single-source-of-truth
   architecture is the structural advantage; Phase 1 delivers a
   working stdio prompt fetch, nothing larger. High strategic-
   differentiation, low scope risk.
7. **road-to-superpowers-harvest** — workflow-chain discipline; B+C+D
   bundled into one adoption unit (council Round 1 finding). Counts
   against the 5-unit plate cap.

### Tier 4 — defer to next plate or beyond

The four senior-cognition / distribution roadmaps share two failure
modes if started early: (a) they expand surface area before proof
shipped (#2), and (b) they're large (35 / 27 / 26 / 31 steps).
Sequence them after Tier 2 closes:

8. **road-to-better-skills-and-profiles** (Wing 1, Thinking Layer).
9. **road-to-distribution-and-adoption** (Marketing, Multi-tool, etc).
10. **road-to-unified-senior-roles** (Wing 2, non-engineering seniors).
11. **road-to-gtm-and-growth** (Wing 3).
12. **road-to-money-strategy-ops** (Wing 4).

**road-to-productization** is a master roadmap with explicit close-
gates on `road-to-proof-not-features` 100% AND
`road-to-better-skills-and-profiles` Block A. Don't start its own
phases until both gates are green.

## Decision points for the user

1. Confirm Tier-2 pair (#2 + #3) — or substitute one.
2. Confirm Tier-3 ordering — Event-driven before Deep-Research Ph 2,
   or the reverse?
3. Confirm Wing roadmaps stay in Tier 4 — or escalate one (e.g. Wing 3
   if external GTM pull is currently the binding constraint)?

## Verdicts — council-synthesised 2026-05-09

Two-round council (anthropic claude-sonnet-4-5 + openai gpt-4o,
`/tmp/council-runs/close-feedback-followups.json`). Convergence on
all four questions; refinements added measurable triggers where
round 1 left qualitative judgments.

| # | Question | Verdict | Trigger / refinement |
|---|---|---|---|
| Q1 | Phase 4 close-out | **Option A — user-action-deferred.** Mark P4.1 + P4.2 deferred, leave checkboxes unticked, archive roadmap as "implementation-complete, adoption-signal pending — owner action." | Revisit when stars ≥ 5 OR ≥ 3 inbound showcase requests. |
| Q2 | Tier-2 pair | **Confirm pair as drafted** (`proof-not-features` + `chat-history-cross-agent-hardening` Phase 1). | Sequence: do `chat-history` Phase 1 FIRST as a low-effort confidence builder (~50-line patch unblocks ~30 test failures), then `proof-not-features`. |
| Q3 | Tier-3 ordering | **`event-driven-discipline` BEFORE `deep-research-adoption` Phase 2.** | Phase 2's 6-week stability gate cannot be earned without infrastructure hardening first; cognitive skills require predictable substrate. |
| Q4 | Wing roadmaps | **Stay in Tier 4** — content depth first, GTM second. | Escalate Wing 3 (`gtm-and-growth`) to Tier 3 if (a) star plateau persists past 8 weeks post-`proof-not-features` AND (b) ≥ 3 inbound requests explicitly ask for adoption / GTM tooling. |

Rationale (compressed):

- **Q1** — Option B (drop) conflates timing with validity; the work
  may be premature now but the commitment remains valid at 5–10 stars.
  Option C (separate checklist file) creates surface completeness at
  the cost of checklist proliferation. Option A preserves commitment
  with honest state labeling and near-zero carrying cost.
- **Q2** — 80/20 effort split favors `proof-not-features` for external
  leverage; `chat-history` Phase 1 first builds momentum because
  developer-facing wins (CLI no longer crashes, 30 test failures
  unblocked) are immediate and visible.
- **Q3** — Reviewer-B's preference to do Phase 2 first inverts the
  dependency graph: cognitive skills amplify platform instability
  when layered onto flaky substrate. Discipline first earns the
  stability the gate was designed to require.
- **Q4** — 2-star plateau signals verification failure (the
  `proof-not-features` thesis), not GTM-execution failure. Pivoting
  to distribution before the product provably works is the founder
  error at stake.

User-decided: 2026-05-09 — synthesised from council verdicts;
escalation triggers above are the re-entry conditions.
