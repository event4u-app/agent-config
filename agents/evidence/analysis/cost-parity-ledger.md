# Cost-parity ledger — the family's execution order, its non-ownership list, and one running measurement trail

> **What this file is for.** The `road-to-cost-parity-*` family has four
> members and a deliberate split between active and parked. This is the one
> place a later reader can open to learn *which unit is next*, *what the family
> explicitly does not own*, and *what each landed phase actually moved* —
> without re-deriving any of it from four roadmap files, two of which are
> parked and one of which is already archived.
>
> Registered by part 0 (the program roadmap) § 2.1–2.3. The measurement rows
> append against the pinned baseline in
> [`src/config/cost-parity-budget.json`](../../../src/config/cost-parity-budget.json),
> never against a fresh measurement — a ledger that compares against a moving
> baseline measures drift.

## 1. Execution order (§ 2.1)

The council converged on the active/parked split and the maintainer applied it.
Only **two** members of this family are active at any time.

| Order | Member | Status | What it is |
| --- | --- | --- | --- |
| **(a)** | part 3 — handoff envelope | **archived** (PR #1255, merged 2026-08-10) | A located one-module defect with fixtures; the cheapest real win in the family, so it went first. |
| **(b)** | part 0 — this program: Phase 1 (target registration) + Phase 3 (triage corrections) | **active** | Both unblocked. Its two blockers block zero of its own steps — one belongs to a parked member, one to a step class this program does not plan. |
| **(c)** | part 1 — rule-payload diet · part 2 — state-aware dispatch | **parked** in `agents/roadmaps/later/`, `status: later` | Neither is backlog the dashboard will try to execute, and neither rots: each names the condition that brings it back. |

**Resume conditions, so the parked pair is not re-derived:**

- **part 1** resumes on any of: the surface-consolidation utilization sweep
  landing, the live trigger eval, or a standalone-pilot authorization. Carries
  three of its own blockers (`skill-activation-window`,
  `consolidation-breaking-change-permission`, `utilization-sweep-window`).
- **part 2** resumes on either: the orchestration claim queue being free, or a
  Phase-1-only authorization. Carries two of its own blockers
  (`orchestration-claim-queue`, `per-role-floor-scope-decision`).

## 2. What this family does NOT own (§ 2.2)

Named with the owner, so no member absorbs, closes, or re-plans them:

| Concern | Owner | State at registration |
| --- | --- | --- |
| Command-surface consolidation | `road-to-surface-consolidation` | active, 1 open step, time-gated (2026-08-26) |
| `tier:` field removal | `road-to-tier-removal` | active, 2 open steps, blocked on `trigger-set-amendment` |
| Rule cut-line from the `rules_used` window | `later/road-to-token-economy-dispatch-followup` | parked |
| Injection dedup | `later/road-to-token-economy-cache-followup` | parked |

A fifth entry earned by measurement rather than by triage: the **delivered-rule
ceiling** is owned by `src/config/budgets.yml § standing_rule_delivery`
(`total_cap_tokens: 110000`). The per-host payload rows in the cost-parity
budget file therefore carry **no competing byte-denominated target** — a metric
with two owners is a metric with none.

## 3. Standing recommendation before part 1 executes (§ 2.4)

A **council pass on part 1's lock conflicts is the recommended first action**
before part 1's Phase 2 runs. Its three collisions are decisions, not
measurements, and a measurement pass cannot settle them:

1. `preservation-guard` versus norm rewriting,
2. the kernel write-deny,
3. the spend-blocked adherence bench.

Recorded here rather than executed now: part 1 is parked, and running a council
on a roadmap nobody is about to execute spends tokens on a verdict that will be
stale when it resumes.

## 4. Measurement rows

Every landed phase in any family member appends one row, measured against the
pinned Phase-1 baseline. **The first row is the baseline itself.**

| Date | Commit | Member / phase | Metric | Baseline | Measured | Delta | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-10 | `c073d5732` | part 0 / Phase 1 | *(pinned baseline — see the budget file for all eleven rows)* | — | — | — | Registration only; no behaviour changed, so no delta exists to record. Session-cost baselines: median final context **519,349**, p90 **807,937**, auto-compact incidence **11.2 %**, late/early per-call ratio **2.1×**. Payload baselines: `.claude/rules` 339,035 B · `.augment/rules` 420,051 B · `dist/agent-src/rules` 420,051 B · `.clinerules` 417,703 B · `.windsurfrules` 338,160 B · `src/rules` 424,896 B · `GEMINI.md` 2,982 B. |

**Two rules every future row inherits**, both fields on the baseline row in the
budget file rather than prose here, because a rule that lives only in a
paragraph is a rule the next author does not inherit:

1. **A projection count is only valid after a regeneration** — and, as of this
   registration, only when the **emitter generation** is stated too. The
   92-versus-110 file-count spread on `.claude/rules/` at one commit is not
   staleness alone: an older emitter symlinked those entries into `dist/` so
   each inherited dist's full frontmatter, while the current emitter writes
   real, frontmatter-less files. A projection figure is a fact about *which
   emitter last wrote the tree*, on top of how stale that tree is.
2. **A figure comparing two carrier trees measures their relative staleness,
   not the source.** `report_carrier_divergence` compares a globally installed
   carrier against the project projection on disk, and either can be stale
   independently. It may diagnose a behind-the-times install; it may never gate
   a phase, and no row in the budget file is derived from it.

## 5. Open questions the family carries past part 0's archival

Part 0 closes with two blockers open, neither of which blocked any of its own
steps. Both are recorded **here** rather than left in an archived roadmap,
because that is the failure this family already met once: part 3 closed with a
question open, and the only reason it survived was that part 0 explicitly
inherited it. An open question no live artefact names again is one nobody will
ever answer. The ledger is not archived, so it is the right home.

### `adherence-bench-spend` — owner: user

Blocks part 1's adherence-eval phase. **Do not open a third bench:** two
existing roadmaps already own an A/B bench of this shape — the
solution-minimalism roadmap's Phase 3 (blocked on a $150–250 floor) and the
rule-coherence-followup roadmap's F2.1 (blocked on `bench-spend-and-methodology`).
The size-versus-adherence question is theirs; part 1 consumes their result.
**Resolved when** one of the two benches is authorized and run, or the question
is recorded as a null.

### `background-continuation-probe` — owner: maintainer

Blocks any continuation-offload step; none is planned in any active member.
Past the recycle threshold, the flow *may* hand remaining work to a fresh
background session seeded with the handoff envelope instead of asking the user
to clear in place. Whether a background spawn reliably receives and acts on a
seeded envelope is **host semantics and unverified** — it needs a bounded
two-arm probe on a live host before any step is written anywhere.
**Resolved when** a probe note records the observed seeding behaviour per host,
and either a step is added citing it or the idea is recorded as a null.

## 6. Correction carried from the Phase-1 re-measure

The program's own triage table recorded `.clinerules` / `.windsurfrules` as
**"~3 KB / ~0 KB"** and therefore as already-lean hosts needing no target.
Re-measured post-regeneration at `c073d5732`, they are **408 KB** and **330 KB**
— a full payload each. Both carriers are untracked and written only by
`task generate-tools`, so a checkout that has not run it reads them as
near-empty. The earlier figure is a stale-projection artefact of exactly the
class rule 1 above warns about — found by applying that rule to the table that
states it. `GEMINI.md` (2,982 B) is the only genuinely lean host in the set.
