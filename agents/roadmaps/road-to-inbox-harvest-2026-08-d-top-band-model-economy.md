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

- [x] 1.1 Make an unmapped band visible in `orchestration_record`. **The defect
      was narrower and sharper than the step assumed**: the hook already reads
      the host's `resolvedModel`, but reduced it to `tiers: [family]` via
      `extractModelFamily`, which returns null both for a band outside the
      three-tier vocabulary *and* for a host that reported nothing — so the two
      produced byte-identical records and the reopen question was
      unanswerable. The fix fills `model_served`, a field the schema already
      reserved for exactly this, leaving the discriminator: unmapped ⇒
      `model_served` set with `tiers` absent; unreported ⇒ both absent. No band
      above `high` is named and no mapping is invented — the id is stored
      verbatim as an opaque host string.
      <!-- verify: grep -c 'model_served' src/scripts/hooks/orchestration_record_hook.ts -->
- [x] 1.2 Publish the same-band spawn distribution from the stamped records —
      how often a dispatch runs at the session's own band rather than below it,
      and via which path (`inherit`, undeclared slice, judge escalation). This
      is the denominator every later claim in this roadmap rests on.
      <!-- verify: test -f agents/evidence/analysis/same-band-spawn-distribution.md -->

## Phase 2 — The band, if the reopen condition holds

- [x] 2.1 **Reopened and shipped.** Phase 1 answered the gate: `MODEL_FAMILIES`
      enumerates four families while `TIER_TO_CLAUDE_MODEL` named three, and 2
      of 40 model-reporting dispatches ran on the fourth — so ADR-035's own
      reopen condition ("a vendor ships a band the three tiers cannot express")
      is satisfiable from the tree rather than from a cost impression. The
      maintainer reopened it on that reading.
      **ADR-232** amends ADR-035 § Decision 1 and leaves § Decision 3 intact:
      the band is `frontier` (the name ADR-035 itself used for what it
      rejected, so the reversal is legible), the resolution is ONE new row in
      the generator-owned map, and no second per-vendor table is created. Three
      frontmatter schemas accept the value; no existing artefact declares it.
      The vendor-name rejections in the schema test are untouched — `fable`
      joined `opus` and `sonnet` on the rejected list, because a band being
      declarable must never make its vendor resolution declarable.
      <!-- verify: grep -c 'frontier' src/scripts/_lib/model_tier.ts -->

## Phase 3 — One top-band context per task

- [x] 3.1 Commit the invariant. **The step's own rung name went stale between
      authoring and execution, and the tree already half-stated the fix.** It
      says "at most the top *mapped* tier"; ADR-232 (step 2.1, this roadmap)
      then mapped `frontier`, so the top mapped rung became the new band and
      clamping there would clamp nothing. The clamp shipped is **`high`** — the
      top *generally-recommended* band — which is what
      `model-recommendations.md` already asserted from the other side, its
      `frontier` row reading "Never the resolution of `inherit`". The invariant
      is now written where the resolution happens, with the declaration path
      kept open so a genuine `frontier` need is authored rather than removed.
      <!-- verify: grep -c 'at most' src/agent-src/contexts/execution/subagent-routing.md -->
- [x] 3.2 Cap the judge ladder at `high` and name the council as the saturation
      escalation. The step's premise held on inspection: the council path exists
      and is genuinely cross-vendor (Anthropic + OpenAI, outside the host
      session), so it is independent of the implementer's framing in a way a
      second same-vendor agent is not. **One thing the step did not ask for was
      unavoidable to do it correctly:** the ladder was written in vendor model
      names (`haiku → sonnet → opus`), i.e. a second per-vendor table beside the
      one ADR-035 § 3 permits — exactly the two-clocks drift ADR-232 avoided. It
      is now band vocabulary, and the file names zero vendor models, which moves
      acceptance criterion 6 rather than merely not breaking it.
      <!-- verify: grep -c 'saturat' src/agent-src/contexts/subagent-configuration.md -->
- [x] 3.3 State the non-escalation floor. **The step's premise is false and the
      corpus falsifies it precisely: 1.2's distribution cannot make the floor a
      number.** The modelled reduction needs `dispatch_tokens`, `session_tier`
      and `tier_chosen` on one dispatch; over the full 327-record corpus the
      non-null counts are 40, **0** and 1, so the usable intersection is empty —
      not small, empty. `orchestration_savings_report.ts` already prints that
      conclusion verbatim, and `token_delta` cannot substitute because the hook
      writes it as a constant `0` (provenance `estimated`) for want of an
      in-session counterfactual. The floor therefore ships as a judgement with a
      named direction plus a falsifiable *revisit-if*: one record carrying all
      three fields makes it computable, and filling `session_tier` — present in
      the schema and on the manual CLI path, never set by the hook — is the
      blocking gap.
      <!-- verify: grep -c 'in-session' src/agent-src/contexts/execution/subagent-routing.md -->

## Phase 4 — Close the documented-but-unwired exposure

- [ ] 4.1 Wire or archive `pickTier`. **Blocked on `picktier-wire-or-archive`
      below — a maintainer call, not a withheld agent decision.** The evidence
      is gathered and one live defect in the same surface is already repaired
      (see below); what remains is a reversal of a council-locked v1 contract,
      and the council could not reach quorum on it (1/2, `openai` absent with
      `model_unsupported_on_transport`). Escalating rather than acting on a
      non-converged single opinion is what `decision-revisit-gate` and
      `evaluator-independence` prescribe.
      **Repaired here regardless, because it needed no decision:**
      `routing_doctor` rendered a per-tier `COOLING` marker whose only writer
      (`tripCooldown`) has zero production callers, so the marker could only
      ever be absent and its absence read as a measured "not cooling". It now
      reports cool-down state as *unavailable, no producer* — mirroring the
      unavailable-vs-false distinction the capability-provenance line two lines
      above it already makes.
      <!-- verify: grep -rln 'pickTier' src/ --include=*.ts | grep -vc test -->
- [x] 4.2 Published: `agents/evidence/analysis/downshift-vs-cache.md`, measured
      over 611 subagent legs / 16,612 calls via the existing
      `cache_realization_report` — no new instrument. **It falls against the
      concern as written.** The first half ("a downshifted leg forfeits its
      model-scoped cache reads") is false at the dispatch boundary: a leg's
      first call realizes **2.8 %** cache read, i.e. it starts cold and never
      inherited the session's cache, so a downshift forfeits a cache the leg
      did not have — the cache moves rather than disappearing, and is then read
      across a median 18 further calls at ~96.9 %. The second half (prefix
      splitting) holds but is write-side, and writes are **3.1 %** of subagent
      billable input — about an order of magnitude below the read surface the
      saving applies to. Limit stated on the page: this is the cache mechanics
      a downshift would meet, **not** realized savings, which stay unmeasurable
      for 3.3's reason. `subagent-routing.md`'s open paragraph is closed and
      now cites the reading.
      <!-- verify: test -f agents/evidence/analysis/downshift-vs-cache.md -->

## Acceptance criteria

- [x] The session band is stamped in the dispatch record, or recorded as
      unestablishable with the reason. **It is the second branch, with the
      count:** `session_tier` is non-null in **0 of 327** records — the field
      exists in the schema and on the manual `orchestration_record --session-tier`
      CLI path, and the hook that produced every record never sets it. Recorded
      in `subagent-routing.md` § non-escalation floor and in
      `downshift-vs-cache.md` § Limits, both with the blocking gap named.
- [x] The same-band spawn distribution is published before any invariant is
      argued from it. Published by 1.2 on 2026-08-15; independently reproduced
      today from the raw corpus (40 model-reporting records; opus 35 / haiku 2 /
      fable 2 / sonnet 1) before Phase 3 argued from it.
- [x] `inherit` under a top-band session resolves to at most the top mapped
      tier, and the judge ladder is capped at the same rung. **Shipped at
      `high`, not at the top mapped rung — see 3.1:** ADR-232 mapped `frontier`
      mid-roadmap, so the literal wording would clamp nothing. Both clauses use
      the same rung, which is what the criterion is actually protecting.
- [ ] `pickTier` has either a named production caller or a removal note.
      Blocked — see `picktier-wire-or-archive`.
- [x] The downshift-versus-cache reading is published, in either direction.
- [~] No `.md` in the tree names a vendor model as the resolution of a band.
      **Unsatisfiable as literally written, and the contradiction is with
      ADR-035 itself.** ADR-035 § 3 mandates exactly one tier→model mapping,
      and `model-recommendations.md` is it; 10+ further `.md` files carry the
      resolution, several of them ADRs, which are historical records and are not
      rewritten. Under the reading the criterion can actually mean — *no
      **second** vendor mapping beyond the ADR-035 § 3 one* — it holds, and 3.2
      **moved** it: `subagent-configuration.md` carried a second ladder in
      vendor names (`haiku → sonnet → opus`) and now names zero vendor models.

## Blockers

### blocker: picktier-wire-or-archive

- **Status:** open
- **Owner:** user
- **Blocks:** Step 4.1 only. Phase 3 and Step 4.2 are closed and independent.
- **Question:** `pickTier` and the permit lifecycle around it have no
  production caller. Wire them, or archive them with a migration note?

**Why this is not the agent's call.** Archiving reverses a v1 contract an AI
council locked on 2026-08-03 and deletes its pre-registered acceptance criteria
AC1–AC5. The council was asked and **could not reach quorum: 1 of 2 present**,
`openai` absent with `model_unsupported_on_transport` — a known infra defect,
not a considered abstention. One non-converged opinion is not the basis for a
reversal of a converged one.

**Verified facts, so the decision needs no re-derivation:**

- `pickTier`, `acquireBudgetPermit`, `settlePermit`, `tripCooldown`: zero
  production callers. The only non-test importer of the module is
  `routing_doctor.ts`, and it imports `TIER_ORDER` and `readCooldowns` only.
- `pickTier` requires a `routing_switch` input whose sole source — the
  `subagents.budget_routing` settings key — was **deleted** by always-on
  orchestration. Wiring therefore requires inventing a source for a category
  that was removed on purpose.
- The state is **already disclosed and monitored**, which is the fact that most
  weakens the urgency: `docs/CLAIMS.md § budget-routing-relation` states in its
  own text *"no code caller dispatches through pickTier at runtime"*, and
  `check_budget_delivery` in `routing_doctor.ts` is live and adapted to the
  deleted key. Nothing in the tree misrepresents this.
- Realized savings are unmeasurable: `session_tier` 0 / `tier_chosen` 1 of 327
  records.

**The single present member voted (c)** — archive the unwired decision layer,
keep `TIER_ORDER` / `readCooldowns` which have a live consumer, and repair the
misleading cool-down display. It also corrected a premise in the question put
to it: the contract says the council-side `cli_call_budget` / `cost_budget`
caps *replace* the deleted switch, but they gate total council spend rather
than per-tier selection — **complementary mechanisms, not replacements**. That
correction belongs in any migration note.

The third part of (c) — the cool-down repair — **is already done** (Step 4.1
note), because it carried no decision content: a marker that can only ever be
absent was reporting absence as measurement.

- **What to do:** pick exactly one —
  (a) **wire** it, naming where `routing_switch` now comes from;
  (b) **archive** the decision layer and permit lifecycle with a migration note
  carrying the 0/327 reading and the complementary-not-replacement correction,
  keeping `TIER_ORDER` / `readCooldowns`;
  (c) **carry it deliberately**, on the ground that the state is disclosed and
  monitored — which the step as written excludes, so choosing this amends the
  step rather than satisfying it.
- **Resolved when:** the user states which of (a), (b) or (c) holds.

### blocker: adr-035-reopen-question

- **Status:** resolved

- **Resolution:** 2026-08-15 — reopened, ADR-232 accepted. Kept here
  rather than deleted so the path from question to evidence to decision stays
  readable: the maintainer first declined to answer in the abstract and gated it
  on Phase 1; Phase 1 then found the four-vs-three vocabulary asymmetry in two
  shipped constants; the reopen followed from that reading. Step 2.1 is closed.
- **Owner:** user
- **Blocks:** Step 2.1 only
- **Question:** ADR-035 rejected a fourth band and named its own reopen
  condition — a vendor shipping a band the three tiers cannot express. Does that
  condition now hold?
- **Decision taken (2026-08-15): measure first.** The maintainer declined to
  answer the band question in the abstract and gated it on Phase 1's reading.
  The reasoning is recorded because it is the reusable part: a fourth band pulls
  in generator, rule and documentation surface, and the only evidence available
  today for whether it is needed is a cost observation rather than a
  measurement. Phase 1 does not depend on this blocker, and it produces exactly
  the missing number — how often `inherit` and undeclared slices actually
  resolve to the session's own band, and by which path.
- **What to do:** after Phase 1 publishes the same-band spawn distribution, pick
  exactly one — (a) reopen ADR-035 on the stated condition and authorise a
  fourth vendor-neutral band; or (b) leave the three-band vocabulary closed, in
  which case Step 2.1 records the null and the economy rests on the Phase 3
  invariant alone.
- **Resolved when:** Phase 1 Step 1.2 has published the distribution AND the
  user states which of (a) or (b) holds against it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The invariant clamps a slice that genuinely needed the higher band, and quality drops where nobody is looking | product | Resolving `inherit` downward changes the default for every undeclared slice at once, and verification failures from an under-powered worker are not always visible in the return | 3.1 keeps an explicit declaration path open so the need is stated rather than removed, and 1.2's distribution lands first so the clamp is argued against measured paths rather than assumed ones | Phase 3 — One top-band context per task |
| 2 | The roadmap answers ADR-035's reopen condition on its own authority | implementation | The proposal framed the fourth band as an extension, which reads as settled when the ADR reserved exactly this question | The reopen is a blocker with two mutually exclusive outcomes, Phase 2 is the only step gated on it, and the not-reopened branch has a defined result rather than an abandonment | The decision this roadmap must not take quietly |
| 3 | The band cannot be established from the transcript and Phase 1 produces nothing usable | implementation | Band detection depends on what the host records, which is outside this package's control | 1.1 fails open to `unknown` and records it as unseen, so a null is a published reading rather than a silent default; the invariant in Phase 3 does not require the stamp to be complete | Phase 1 — Measure the leak before naming a band for it |
| 4 | Archiving `pickTier` removes a relation a later phase wanted | implementation | Wire-or-archive forecloses an option, and the budget-routing idea has been carried precisely because it seemed useful | 4.1 requires a migration note either way, and 4.2's measurement lands beside it so the decision is made with the trade-off reading rather than before it | Phase 4 — Close the documented-but-unwired exposure |
| 5 | A vendor model name leaks into a `.md` while naming the new band | implementation | The band has to be described somewhere, and the nearest existing prose names concrete models | The acceptance criteria pin the neutrality constraint as a checkable condition, and 2.1 places the resolution in the per-host generator by construction | Phase 2 — The band, if the reopen condition holds |
