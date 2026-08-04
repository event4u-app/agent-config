# Plan-Confidence Gate (Gate C)

Shared definition of the plan-confidence gate. Loaded by the gated
plan-authoring surfaces — [`/roadmap:create`](../../commands/roadmap/create.md),
the [`roadmap-writing`](../../skills/roadmap-writing/SKILL.md) skill,
[`/feature:plan`](../../commands/feature/plan.md), and
[`/feature:roadmap`](../../commands/feature/roadmap.md) — each of which links
here instead of restating the gate. Machine-checked grammars (the C→R1 state
schema, marker lines) are owned by
[`docs/contracts/plan-review-gates.md`](../../../docs/contracts/plan-review-gates.md);
this context carries the agent-side procedure.

## Activation

Read `planning.challenge_on_create` from `.agent-settings.yml` once per task
and cache it. `true` or **missing key** → the gate is active. `false` → the
gate is inert: proceed with the surface's normal flow, no marker line, no
interview.

**Explicit user bypass wins for that turn** — bypass phrasings and their
equivalents drop the gate immediately
(`DE: "einfach schreiben", "Interview überspringen" · EN: "just write it", "skip the interview"`).
A bypass is **counted**, never punished: append a `gate_c_bypass` event to
`agents/evidence/metrics/gate-metrics.jsonl` (see
[`plan-review-gates § metrics`](../../../docs/contracts/plan-review-gates.md))
so gate erosion stays visible.

## When it fires — and when NOT

**Fires** on a plan-artifact **authoring** ask reaching a gated surface: a new
roadmap, feature plan, or feature roadmap, or a from-scratch rewrite of one.

**Does NOT fire on:**

- checkbox flips, dashboard regens, archival moves, inbound-ref rewrites;
- prose-only or typo edits to an existing plan;
- `/roadmap:process-*` execution runs (execution is not authoring);
- artifacts that are not plans (ADRs, tickets, skills, rules).

## Procedure

### 1. Codebase first (challenge-me Step 0)

Before assessing confidence, run the lookup: existing routes, conventions,
prior similar features, the seed's cited files. **Never ask what `grep`,
`view`, or `codebase-retrieval` answers in seconds** — repo findings resolve
branches silently.

### 2. Seed-time confidence assessment

The measure is the four 95%-conditions from
[`/challenge-me vision`](../../commands/challenge-me/vision.md) § "The four
95% conditions". At seed time (before any interview turn) the check degrades
to: **does the ask already pin (a) the goal, (b) the scope boundary
(in/out), (c) the hard constraints, and (d) observable acceptance criteria —
without guessing?** Any gap → below 95%.

### 3a. Confident path

All four hold → emit **exactly one** marker line, then proceed with the
surface's normal flow:

```
> Confidence ≥ 95% — creating directly (planning.challenge_on_create)
```

No second marker, no summary of the assessment — one line, then the work.

### 3b. Uncertain path

Any gap → route into the [`/challenge-me vision`](../../commands/challenge-me/vision.md)
interview with the plan ask as seed. On reaching 95% (or the user firing
`!pitch`), the pitch feeds the surface's normal authoring flow — the same
mechanic as the existing `!roadmap` routing. The interview replaces the
surface's own clarification questions; it does not stack on top of them.

### 3c. Inline degrade protocol (hosts without `/challenge-me`)

`/challenge-me` ships in the `product-reasoning` pack; the gate never
hard-depends on it. When the command is unavailable, run the interview
inline with the same stop conditions:

1. **Resolve first** — derive goal / scope / constraints / AC from the ask
   plus the codebase lookup (step 1); only genuinely open, load-bearing
   branches survive.
2. **One question per turn** — surface one load-bearing branch with a
   recommended option (numbered options per `user-interaction`;
   one-question-per-turn per `ask-when-uncertain`).
3. **Repeat until** every surfaced branch is resolved AND no new
   load-bearing branch appeared after the last answer AND the cached draft
   summary (goal + in/out + constraints + AC) is stable for two turns.
4. **Then author** via the surface's normal flow.

### 4. C→R1 handoff — write the state file

On completing the gate (either path that ran an interview), write
`agents/runtime/state/gate-c-<plan-slug>.json` so the R1 risk pass never
re-asks resolved branches — the user is never interviewed twice for one
plan. Schema (canonical:
[`plan-review-gates § C→R1 handoff`](../../../docs/contracts/plan-review-gates.md)):
resolved branches, plan hash, timestamp, and a mandatory `transcript_ref`
(path + content hash of the interview transcript artifact).

**Write-path rule:** only the Gate C flow writes
`agents/runtime/state/gate-c-*.json`. This binds the **agent**; there is no
lint and no hook entry behind it, and the state file is gitignored so CI never
sees it — a human reading the diff is what catches a violation (stated
`enforced_by: none` in
[`plan-review-gates § 4.1`](../../../docs/contracts/plan-review-gates.md)).
The rule defends against silent agent shortcuts, not against the local human
(who holds the settings escape hatch anyway).
Confident-path runs (no interview) write no state file; R1 then runs its
risk pass fresh.

## Non-goals

- **No execution authorization.** The gate ends where authoring ends — the
  post-artifact hard stop (`scope-control § Authoring vs. implementation`)
  is unchanged; no gate outcome licenses implementation.
- **No safety-floor changes.** Hard Floor, commit policy, and git-ops gates
  are untouched by any gate path.
- **No firing on maintenance touches** (see "When it fires" above).

## See also

- [`/challenge-me vision`](../../commands/challenge-me/vision.md) — the four
  95%-conditions and the interview this gate routes into.
- [`plan-review-gates`](../../../docs/contracts/plan-review-gates.md) — machine
  grammars: C→R1 state schema, Risk Register, completion review.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — the
  one-question-per-turn floor the degrade protocol runs under.
- [`scope-control`](../../rules/scope-control.md) — the post-artifact hard
  stop this gate never softens.
