---
complexity: lightweight
status: ready
parent_roadmap: road-to-internet-reach
---

# Roadmap: Reach — test the cost thesis properly (the signal the capability bench was not built to decide)

> Decide, with a pre-registration whose PRIMARY metric is token cost, whether
> prescription-based reach is worth shipping for cost alone — the claim the first
> reach benchmark measured but was explicitly not authorised to make.

## Why this is parked, not open

The first reach benchmark asked a **capability** question and answered it:
native 12/12, reach 0 outright wins, `band: stop`
(`internal/bench/reach-vs-native/VERDICT.md`, 2026-07-24). On the 8 tasks both
arms solved it also recorded, as an explicitly **unregistered observation**:

| surface | reach ÷ native tokens |
|---|---|
| repository metadata | 0.26× |
| discussion search | 0.31× |
| feeds | 0.93× |
| web read | 0.80× |
| aggregate | **0.46×** (3,070 vs 6,730) |

The mechanism is legible: the native arm pays **discovery overhead** — it
repeatedly has to find the machine-readable endpoint a prescription already
knows (e.g. one `gh api` call vs a rendered page plus a second fetch for an ISO
timestamp; one keyless API call vs a failed search, an empty SPA shell and a 429).

That signal was deliberately left OUTSIDE the decision. The token threshold in
the parent was authored as a `≤1.5×` **guardrail**, never a win condition, and
promoting a guardrail to a win condition after seeing the data is exactly the
post-hoc adjustment the verdict bands exist to forbid. ADR-126 records this as an
accepted cost. This file is where the claim can be earned instead of assumed.

## Resume trigger — any ONE of these, then move this file to `agents/roadmaps/`

- **Cost becomes a stated problem**: a maintainer or consumer names research
  token spend as a felt cost worth engineering against.
- The **maintenance bar is cleared in the other direction**: someone is willing
  to own the registry's upkeep regardless of the capability null, so the cost win
  would not be paying rent on an otherwise-unjustified surface.
- A **model/pricing generation change** makes discovery overhead materially more
  expensive than it was on 2026-07-24.

Absent a trigger this stays parked. A 0.46× ratio on 8 tasks is a hypothesis with
a plausible mechanism, not a shipped claim.

## Non-goals

- NO reuse of the parent's task set or thresholds. That set was built to answer a
  capability question; reusing it would let a capability-shaped corpus decide a
  cost question.
- NO re-opening of `band: stop` on capability grounds. If this roadmap wins, what
  it earns is a **cost** claim, worded as such.
- NO comparison-table row until the pointer resolver passes on real report data.

## Phase 1 — Pre-registration (nothing else starts first)

- [ ] **Step 1:** `internal/bench/reach-cost/README.md` — an **equal-evidence**
  task set: every task must be solvable by BOTH arms (a task only one arm can do
  is a capability question and belongs in the sibling roadmap). ≥ 12 tasks,
  weighted toward the surfaces where the parent measured the biggest gaps
  (repository metadata, discussion search) AND at least 3 where it measured
  near-parity (feeds at 0.93×), so the set cannot only sample the favourable end.
- [ ] **Step 2:** Commit the **primary metric and the minimum effect** before any
  run: token cost per task, and a stated floor — e.g. "aggregate ≤ 0.70× native
  across ≥ 10/12 tasks" — plus what counts as a null. A ratio with no
  pre-declared floor is a number, not a verdict.
- [ ] **Step 3:** Commit the **maintenance-cost side of the ledger**: what a
  shipped reach layer costs per year in upkeep (channel breakage, pin refreshes,
  registry review), and the minimum saving that would justify it. A cost win that
  ignores the cost of the thing winning is not a cost analysis.
- [ ] **Step 4:** Commit the measurement method — how tokens are counted per arm
  (whose counter, what it includes), because a self-estimated token figure is the
  weakest link in the parent's data and must be replaced by a measured one.
- [ ] **Step 5:** Record the host-capability baseline per the parent's run
  protocol; a host-side improvement to native discovery is the single most likely
  way this thesis dies, and it must be detectable as a re-baseline rather than a
  result.

## Phase 2 — Run and verdict

- [ ] **Step 1:** Execute all tasks × both arms with the committed counter.
- [ ] **Step 2:** `internal/bench/reach-cost/VERDICT.md` — per-surface and
  aggregate ratio, the pre-declared floor, the verdict, and the maintenance
  ledger applied.
- [ ] **Step 3:** Publish in `docs/benchmark.md`, win or null. If it nulls, say
  so and close the thesis — a second null on reach is a more valuable artefact
  than a third attempt.
- [ ] **Step 4:** Only if the floor is cleared: register ONE cost claim in
  `docs/CLAIMS.md` with a resolvable pointer, and add at most one
  `checkable: true` comparison row. The claim is about **cost**, and it may not
  imply a capability advantage the evidence does not carry.

## Acceptance criteria

- [ ] The primary metric, the minimum effect, the maintenance ledger and the
  counting method were all committed before the first run.
- [ ] Token counts are measured, not self-estimated.
- [ ] The verdict is published whether it wins or nulls.
- [ ] No claim shipped that outruns the measurement.

## Provenance

- Parent: `agents/roadmaps/archive/road-to-internet-reach.md`; the unregistered
  observation and the reason it stayed unregistered are in
  `internal/bench/reach-vs-native/VERDICT.md` § Unregistered observation and
  `docs/decisions/ADR-126-internet-reach-operator-tooling.md` § Consequences.
