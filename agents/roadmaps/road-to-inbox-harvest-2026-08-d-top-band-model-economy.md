---
complexity: structural
status: ready
---

# Road to at most one top-band context per task

**Goal.** The tier ladder stops being blind above its own top rung: the band a
session actually runs on gets stamped so the leak can be measured, the
one-top-band-context-per-task invariant gets committed, and the budget-routing
relation that has never had a production caller gets wired or archived.

**Source:** a proposal roadmap that arrived in the inbox, pinned at `e3bd96158`,
archived local-only at `agents/tmp.old/context-custodian/`. Triage and claim
verification: `agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

## Context

Re-verified against the tree at `e3bd96158`.

- **The tier vocabulary is three bands deep and has no rung above its top one.**
  `src/agent-src/contexts/model-recommendations.md:7,9-15` maps `high`,
  `medium` and `lite`; `:16` resolves `inherit` to the session model. A session
  running on a band above the top mapping is therefore just "the session tier",
  and every `inherit` slice inherits it.
- **The judge ladder saturates, and the tree says so in as many words.**
  `subagent-configuration.md:24-25`: *"If the session runs on opus, judge stays
  on opus (no higher tier available)."* The one-tier-above rule has nowhere to
  go once the implementer is at the top rung.
- **The cap that would bound this is opt-in and absent by default.**
  `delegation-policy.md` records `subagents.model_ceiling` as *uncapped* when
  absent, which means top-band discipline rests entirely on a setting nobody has
  to write.
- **The measurement does not exist yet, and the carrier for it does.**
  `hook_manifest.yaml:414-419` binds `orchestration-record` on `post_tool_use`
  for `Agent` and `Task`, but nothing stamps the band the session is running on,
  so a same-band spawn is indistinguishable from a downshift in the record.
  The value of having that carrier at all is already established: before it
  existed, 1 dispatch of 370 was captured (`delegation-policy.md:94`,
  `orchestration-telemetry.md:166`).
- **`pickTier` is the ADR-127 shape this package refuses elsewhere.** Defined at
  `src/scripts/_lib/tier_budget_routing.ts:88`; every call site outside the
  definition is in its own test file. A documented mechanism with no production
  caller is either wired or archived, not carried as design prose.
- **The downshift trade-off is honestly unmeasured.** `subagent-routing.md:60-63`
  states that downshifting discards a model-scoped cache and that "which wins is
  a measured question, not a default this policy resolves".

## The decision this roadmap must not take quietly

ADR-035 **explicitly rejected** a fourth vendor-neutral band above the top rung,
as too sparse to map. It also ships its own reopen condition: *reopen if a
vendor ships a band the three tiers cannot express without a fourth, which is
the frontier tier this ADR rejected as too sparse to map.*

The proposal framed Phase 2 as "extending ADR-035". That is the wrong framing
and it is the reason this roadmap carries a blocker: whether a band now exists
that three tiers cannot express is exactly the question the ADR reserved, and a
roadmap does not get to answer its own reopen condition. Per
`decision-revisit-gate`, the lock is surfaced with the benefit it blocks, and
the decision goes to the human. Everything outside Phase 2 stands on its own and
is not gated on the answer.

## Phase 1 — Measure the leak before naming a band for it

- [ ] 1.1 Stamp the session's model band into `orchestration_record`, read from
      the transcript rather than from a setting, and fail open to `unknown` when
      it cannot be established. A band the record cannot see is recorded as
      unseen, never as the default.
      <!-- verify: grep -c 'band' src/scripts/hooks/orchestration_record_hook.ts -->
- [ ] 1.2 Publish the same-band spawn distribution from the stamped records —
      how often a dispatch runs at the session's own band rather than below it,
      and via which path (`inherit`, undeclared slice, judge escalation). This
      is the denominator every later claim in this roadmap rests on.
      <!-- verify: test -f agents/evidence/analysis/same-band-spawn-distribution.md -->

## Phase 2 — The band, if the reopen condition holds

- [ ] 2.1 **Blocked on the ADR-035 reopen question.** If reopened: add the band
      vendor-neutrally, with the resolution living only in the per-host
      generator and never in a `.md` — the neutrality constraint ADR-035 itself
      sets. If not reopened: record the null and close this phase, leaving the
      invariant in Phase 3 to carry the economy on its own.
      <!-- verify: git show HEAD:docs/decisions/ADR-035-model-capability-tiers.md | grep -c review_trigger -->

## Phase 3 — One top-band context per task

- [ ] 3.1 Commit the invariant: under a top-band session, `inherit` resolves to
      at most the top *mapped* tier. A slice that genuinely needs the session's
      own band declares it, which makes the cost visible rather than default.
      <!-- verify: grep -c 'at most' src/agent-src/contexts/execution/subagent-routing.md -->
- [ ] 3.2 Cap the judge ladder at the top mapped tier, and route the saturation
      case cross-vendor through the council rather than into a second same-vendor
      top-band agent. The council path already exists; this names it as the
      escalation instead of a second context.
      <!-- verify: grep -c 'saturat' src/agent-src/contexts/subagent-configuration.md -->
- [ ] 3.3 State the non-escalation floor: a slice whose dispatch overhead exceeds
      the saving from downshifting stays in-session. Splitting work whose
      overhead eats its own saving is the anti-goal, and 1.2's distribution is
      what makes the floor a number rather than a preference.
      <!-- verify: grep -c 'in-session' src/agent-src/contexts/execution/subagent-routing.md -->

## Phase 4 — Close the documented-but-unwired exposure

- [ ] 4.1 Wire or archive `pickTier`. Wiring means a named production caller in
      the dispatch path; archiving means the relation and its prose leave
      together, with a migration note. Carrying it undecided is the third
      option and it is the one this step exists to remove.
      <!-- verify: grep -rln 'pickTier' src/ --include=*.ts | grep -vc test -->
- [ ] 4.2 Run the pre-registered downshift-versus-cache measurement and publish
      the result whichever way it falls, so the trade-off `subagent-routing.md`
      declines to resolve stops being open indefinitely.
      <!-- verify: test -f agents/evidence/analysis/downshift-vs-cache.md -->

## Acceptance criteria

- [ ] The session band is stamped in the dispatch record, or recorded as
      unestablishable with the reason.
- [ ] The same-band spawn distribution is published before any invariant is
      argued from it.
- [ ] `inherit` under a top-band session resolves to at most the top mapped
      tier, and the judge ladder is capped at the same rung.
- [ ] `pickTier` has either a named production caller or a removal note.
- [ ] The downshift-versus-cache reading is published, in either direction.
- [ ] No `.md` in the tree names a vendor model as the resolution of a band.

## Blockers

### blocker: adr-035-reopen-question

- **Status:** open
- **Owner:** user
- **Blocks:** Step 2.1
- **Question:** ADR-035 rejected a fourth band and named its own reopen
  condition — a vendor shipping a band the three tiers cannot express. Does that
  condition now hold?
- **What to do:** pick exactly one — (a) reopen ADR-035 on the stated condition
  and authorise a fourth vendor-neutral band, or (b) leave the three-band
  vocabulary closed, in which case Phase 2 records the null and the economy
  rests on the Phase 3 invariant alone.
- **Resolved when:** the user states which of (a) or (b) holds.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The invariant clamps a slice that genuinely needed the higher band, and quality drops where nobody is looking | product | Resolving `inherit` downward changes the default for every undeclared slice at once, and verification failures from an under-powered worker are not always visible in the return | 3.1 keeps an explicit declaration path open so the need is stated rather than removed, and 1.2's distribution lands first so the clamp is argued against measured paths rather than assumed ones | Phase 3 — One top-band context per task |
| 2 | The roadmap answers ADR-035's reopen condition on its own authority | implementation | The proposal framed the fourth band as an extension, which reads as settled when the ADR reserved exactly this question | The reopen is a blocker with two mutually exclusive outcomes, Phase 2 is the only step gated on it, and the not-reopened branch has a defined result rather than an abandonment | The decision this roadmap must not take quietly |
| 3 | The band cannot be established from the transcript and Phase 1 produces nothing usable | implementation | Band detection depends on what the host records, which is outside this package's control | 1.1 fails open to `unknown` and records it as unseen, so a null is a published reading rather than a silent default; the invariant in Phase 3 does not require the stamp to be complete | Phase 1 — Measure the leak before naming a band for it |
| 4 | Archiving `pickTier` removes a relation a later phase wanted | implementation | Wire-or-archive forecloses an option, and the budget-routing idea has been carried precisely because it seemed useful | 4.1 requires a migration note either way, and 4.2's measurement lands beside it so the decision is made with the trade-off reading rather than before it | Phase 4 — Close the documented-but-unwired exposure |
| 5 | A vendor model name leaks into a `.md` while naming the new band | implementation | The band has to be described somewhere, and the nearest existing prose names concrete models | The acceptance criteria pin the neutrality constraint as a checkable condition, and 2.1 places the resolution in the per-host generator by construction | Phase 2 — The band, if the reopen condition holds |
