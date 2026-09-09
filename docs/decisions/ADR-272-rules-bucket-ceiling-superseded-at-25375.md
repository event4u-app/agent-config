---
adr: 272
status: accepted
date: 2026-09-09
decision: rules-bucket-ceiling-superseded-once-upward-from-20000-to-25375
supersedes: —
superseded_by: —
type: structural
reopen_policy: directional
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E3
  basis:
    - agents/roadmaps/road-to-delivery-for-every-host.md
    - src/scripts/check_preamble_payload_budget.ts
    - src/config/preamble-payload-budget.json
    - src/scripts/_lib/lean_projection_mode.ts
review_trigger: >-
  A conditional-loading mechanism is TESTED that applies full rule content before
  the matched tool executes while the governed hook surface stays at or under
  2,048 bytes. That mechanism makes the three full-bodied rules cheap and this
  supersession unnecessary, so the ceiling returns toward 20,000 rather than the
  record standing indefinitely. Also reopened if the aggregate 40,000 ceiling is
  ever breached, since the whole argument here rests on it holding.
---

# ADR-272 — the rules-bucket ceiling is superseded once, upward, from 20,000 to 25,375

## Status

Accepted 2026-09-09. Decided by an AI council convened under a written owner
delegation covering an autonomous roadmap-drain run. **2 of 2 seats
(anthropic/claude-sonnet-4-5, openai/codex-default) chose the same option**,
across two runs — the first lost the openai seat to a transport error
(`ENOBUFS`), not to a refusal, and the retry recovered it.

This is the question both seats **declined** on 2026-09-09 in an earlier round,
and each declination named the same missing thing. anthropic: *"the escape does
NOT authorize the council to rewrite the criterion"*, adding that its
recommendation was *"conditional on you delegating at all"*. openai: *"Option 2A
is valid only as an explicit repository-owner waiver or amendment of the
K9-protected 20,000-token invariant."* The owner supplied that waiver. Nothing
about the substance changed; the authority did.

## Context

`road-to-delivery-for-every-host` step 4.2 flips this repository to `delivery`
projection for `claude-code`. Measured on a clean consumer-shaped root — no
user-scope layer, because a maintainer checkout deduplicates 101 of 114 rules
against `~/.claude` and reads 4,115 tok for a reason that has nothing to do with
the flip:

| Limb | Measured | Criterion | Verdict |
|---|---:|---:|---|
| total standing payload | 39,758 tok | ≤ 40,000 | **passes**, 242 tok of room |
| `.claude/rules` bucket | 24,166 tok | ≤ 20,000 | **misses by 4,166** |

The whole 4,166 is one disposition: `design-review-after-ui-write`,
`source-of-truth` and `ui-audit-gate` stay eagerly projected full-bodied
(≈ 5,850 tok), because the alternative keeps the `pre_tool_use` binding and
breaches the 2,048-byte governed-hook cap that Phase 3 installs.

**Both options violate an explicit E2 clause.** That is the shape of the
decision: not a choice between a rule and a shortcut, but between two clauses
that cannot both hold.

## Decision

Supersede the 20,000-token rules-bucket criterion at **25,375 tokens**, computed
as `ceil(24,166 × 1.05)` under the project's 5 % headroom policy. The binding
40,000-token aggregate ceiling is **unchanged**.

**This is a one-time UPWARD supersession, and it is recorded as one.** An earlier
draft of this decision described `20,000 → 25,375` as a "downward-only ratchet",
which openai refused: *"It is plainly an upward change. Owner authorization may
make that amendment legitimate, but it does not make the direction downward."*
25,375 becomes the new downward-only ratchet from here.

The original criterion stays **visible and marked superseded**, never rewritten
as though it had not existed — openai's condition, and the one this record exists
to honour.

### What is not being done

- `design_ceiling` is not raised (K4).
- Rule prose is not cut to make a number (K5).
- Material is not relocated to escape the criterion (K9) — openai named that
  *"accounting theater"* in an earlier round and it stays rejected.
- The three rules are not projected as stubs. That was option (b); it buys the
  number and pays in capability.
- The hook cap is not breached. That was option (c).

## A correction the council's own answer needed

Both seats proposed writing the new ceiling into
`src/config/preamble-payload-budget.json` as a `rules_bucket_ceiling` key. **That
key does not exist and no gate reads one.** Grepped at HEAD:
`check_preamble_payload_budget.ts` contains neither `20000` nor any
rules-bucket field, and the 20,000 figure appears only in
`agents/roadmaps/road-to-delivery-for-every-host.md` — in the Goal and in step
4.2's `verify:` line.

Both seats flagged this risk themselves without being able to resolve it from the
material they were given. openai: *"The artefact does not establish the real
command path or configuration key, so neither reviewer's invented JSON property
names or shell commands should be adopted without repository inspection."* The
inspection was done and the answer is that the criterion is prose, not config.

So the execution is an amendment to those two roadmap lines plus this record —
not a config edit. Writing an unread key would have created a governance surface
that looks enforced and is not, which is a worse outcome than the overage.

## Consequences

- Step 4.2's `verify:` limb becomes `rules ≤ 25,375`, which the measured 24,166
  satisfies with 1,209 tok of headroom.
- The rules bucket now carries a ceiling **nothing enforces deterministically**.
  It was in the same state at 20,000 — this record does not create that gap, and
  does not close it either. Closing it means giving
  `check_preamble_payload_budget` a rules-bucket limb, which is not in this
  change's scope and is named here so the next reader does not assume otherwise.
- The three full-bodied rules keep their capability on the one host where the
  delivery mode is live.
- A future conditional-loading mechanism makes this supersession unnecessary; the
  `review_trigger` above says so rather than leaving the ceiling to stand by
  inertia.

## Alternatives

**(b) Project the three rules as stubs.** Meets the limb, loses the capability
those three rules carry on every `pre_tool_use`-shaped trigger. Rejected: the
number is not worth the affordance, and the aggregate ceiling — the one that
describes what a session actually pays — already passes.

**(c) Restore the `pre_tool_use` binding and breach the 2,048-byte cap.** Meets
the limb by violating the cap Phase 3 installs for a different and independently
argued reason. Rejected on the same grounds as (b), with the added cost that a
breached hook cap degrades every tool call rather than one bucket's arithmetic.

**(d) Hold the step open pending a tested conditional-loading mechanism.**
Rejected as the decision, retained as the `review_trigger`. openai's objection to
(d) as a *decision* stands: *"its dispatcher-loads-and-returns-full-bodies assumes
a synchronous host capability not established in the evidence."* Holding a step
open against an unbuilt mechanism is deferral wearing a plan's clothes.

## Evidence

**E3 — the numbers are measured, and the one claim that would have made this
record wrong was checked against the tree rather than taken from the council.**

| Claim | Evidence |
|---|---|
| The rules bucket measures 24,166 tok under `delivery` on a clean consumer-shaped root, against 99,598 under `eager-all` | `agents/roadmaps/road-to-delivery-for-every-host.md` § Phase 4 step 4.2, measurement table of 2026-09-07 |
| The total limb passes at 39,758 ≤ 40,000 (24,166 rules + 14,846 skills + 746 CLAUDE.md) | same table |
| `ceil(24,166 × 1.05) = 25,375` | arithmetic, stated so the number is reproducible rather than asserted |
| **No `rules_bucket_ceiling` key exists and no gate reads one** | `grep -n "20000\|rules_bucket" src/scripts/check_preamble_payload_budget.ts` returns nothing; `grep -rn "20,000\|20000" agents/roadmaps/road-to-delivery-for-every-host.md` returns the Goal and step 4.2's verify line, and nothing else in the tree |
| `check_preamble_payload_budget` routes by surface and never consults a rules-bucket limb | `src/scripts/check_preamble_payload_budget.ts` — the budget entry it reads is `packed`/total, with no per-bucket branch |
| Both seats chose (a); the earlier declinations were conditional on delegation, not on substance | AI council 2026-09-09, anthropic/claude-sonnet-4-5 + openai/codex-default, subscription transport, `$0.0000`, deep depth with peer review. Run 1 concluded 1/2 (anthropic answering (a)); run 2 concluded 2/2 with openai answering (a) independently. |
| The first run's missing seat was a transport failure, not a refusal | that run recorded the seat as `error: os_error: ENOBUFS`, `reason: unavailable`, empty text — a transport code, not a declination, which is why the retry was legitimate rather than verdict shopping |

**What this evidence does NOT establish**, named rather than implied:

- **That 24,166 reproduces on this checkout.** It does not and cannot: a
  maintainer tree deduplicates 101 of 114 rules against `~/.claude` and reads
  ~4,115 tok for reasons unrelated to the flip. The figure is the roadmap's
  clean consumer-shaped measurement, and `--project-rules-dir` exists so a reader
  can reproduce it against such a root.
- **That anything now enforces 25,375.** Nothing does, and nothing enforced
  20,000 either. This record moves a prose criterion; it does not add a gate, and
  § Consequences says so.

## References

- `agents/roadmaps/road-to-delivery-for-every-host.md` § Goal, § Phase 4 step 4.2
- ADR-270 — the host-aware measurement that closed 4.2's *other* half
- ADR-264 — the standing-payload grace ceiling, untouched by this record
