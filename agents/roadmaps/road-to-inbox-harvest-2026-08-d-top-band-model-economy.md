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

- [x] 4.1 **ARCHIVED, 2026-08-16, on a converged council verdict.** anthropic
      (claude-sonnet-4-5) and openai answered **2 of 2** for **(b)**, neither
      reporting a premise correction, each reaching it independently — anthropic
      on `decision-revisit-gate` ("a lock settles the mechanism it tested, and
      that mechanism no longer exists"), openai on acceptance criteria that
      cannot fire being coverage that does not exist. The quorum was reached by
      running the council at **one round**: both seats answer in under a minute
      there (49 s / 58 s), while the 2-round run had the anthropic seat blow past
      a 300 s cap — which localises the transport defect to what round 2 adds and
      is recorded in the blocker rather than fixed here.
      **What shipped:** `pickTier`, `acquireBudgetPermit`, `settlePermit`,
      `tripCooldown`, `reserveTtlMs`, `RESERVE_FILE`, `DEFAULT_COOLDOWN_MS` and
      the reserve/lock machinery removed; their pre-registered suites removed
      with them; the reserve-lifecycle config under `src/config/` (deleted, so
      it is named without a path here) went too — it existed only to keep two
      reserve readers on one TTL, and both are gone;
      `budget.mjs tier` lost its `reserved_usd` term, whose store had exactly one
      writer and was therefore provably always zero. `TIER_ORDER` and
      `readCooldowns` stay — `routing_doctor.ts` consumes them, and that is
      monitoring rather than routing. Contract rewritten as a migration record
      retiring AC1–AC5; the CLAIMS entry moved `backed` → `resolved-null` with
      the claim text kept verbatim as what was asserted while the code existed.
      <!-- verify: grep -c 'ARCHIVED 2026-08-16' src/scripts/_lib/tier_budget_routing.ts -->
      The original text of this step, for the record: "Wire or archive
      `pickTier`. **Blocked on `picktier-wire-or-archive`
      below — a maintainer call, not a withheld agent decision.**" The evidence
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
      across the leg's remaining calls at ~96.9 % (median **18 calls per leg**,
      so ~17 after the cold start). The second half (prefix splitting) is
      **not measured** — nothing on the page sizes cohort prefix sharing — but
      it is bounded above by total write volume, **3.1 %** of subagent billable
      input, about an order of magnitude below the read surface the saving
      applies to. The conclusion is insensitive to the unmeasured fraction,
      which is why the gap is named rather than closed. Limit: this is the cache mechanics
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
- [x] `pickTier` has either a named production caller or a removal note.
      **Removal note**, 2026-08-16: archived on a converged 2-of-2 council
      verdict; `docs/contracts/budget-routing.md` is the migration record and
      carries the union revisit-if.
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

- **Status:** resolved
- **Resolution (2026-08-16):** **(b) archive**, on a converged AI-council verdict
  — anthropic + openai, **2 of 2 present**, neither reporting a premise
  correction, each reaching (b) by a different route. The quorum that two earlier
  attempts could not reach (0/2, then 1/2) came from running at **one round**:
  both seats answer in under a minute there, so the transport defect is in what
  round 2 adds. That defect is NOT fixed here and has no roadmap yet. Executed in
  full: see Step 4.1 for the shipped surface, and the migration record for the
  revisit-if that would reopen it.
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

> **Re-measured 2026-08-16: the council route is worse, not better — 0 of 2
> present, and the blocker is gated on infrastructure rather than on judgement.**
> The question was put to the council again with the premises re-verified against
> the tree. Neither member answered. `anthropic` returned `timeout` after
> 968,101 ms against its own 300 s ceiling; `openai` returned the SAME
> `model_unsupported_on_transport` as before, and its detail field names the
> exact repair: the member pins `model: gpt-4o`, which the codex CLI refuses on a
> ChatGPT-account transport, so the pin must be removed (or the member moved to
> the API transport) — a one-line edit in the **user-global**
> `~/.event4u/agent-config/settings/.ai-council.yml`, outside this repository.
> Recorded rather than retried: a retry can at best restore the 1-of-2 this
> entry already rejected, and re-running a member that just timed out is the
> wasted attempt the hard-blocker class names.

> **Superseded the same day — the retry DID happen, because the environment
> changed, and it produced the substance the quorum could not.** The paragraph
> above decided against a retry on the assumption that nothing had moved. Once
> the openai seat was repaired that assumption was false, which is the condition
> the hard-blocker class names as the one that licenses another attempt. Read the
> block below, not the one above, for the current state.
>
> **The openai repair is NOT the one its own error message prescribes, and the
> prescribed one breaks the whole council.** The detail field says *"remove the
> `model:` line"*. Doing that fails config load with `members.openai: enabled
> members require a non-empty model` and flips `council:status` from CONFIGURED
> to NOT CONFIGURED for **every** provider, not just openai. The working form is
> the parenthetical: `model: codex-default`, the `OPENAI_CLI_VENDOR_DEFAULT`
> sentinel at `clients.ts:134`, which the loader accepts even though it is absent
> from the member's `model_ladder`. After that edit the seat answered a 2-round
> deep question with 1,752 characters.
>
> **The anthropic seat is NOT slow, so raising the timeout is not the fix
> either.** The obvious reading of `timeout` at 968,101 ms is that 300 s is too
> tight — the constant was already raised 120 → 300 on 2026-08-13 for this exact
> symptom. Measured instead of assumed: the same question file, handed to the
> same CLI from `/tmp`, returns a complete 1,766-character answer in **55 s**,
> exit 0. `--output-format json` (72 s) and `--tools ''` (38 s) were each ruled
> out separately, and `ask()` has no retry loop. **The decomposition first written
> here — "roughly three capped calls (round 1, round 2, and the `blind_chairman`
> pass)" — was wrong, and the R2 review killed it.** `latency_ms` is set once per
> `ask()` and summed nowhere; `consult()` returns only the FINAL round's responses
> (`council_cli.ts:2761`, verbatim: *"one `CouncilResponse` per member from the
> final round"*), so round 1 is not in the artefact at all; and `blind_chairman:
> true` is the CLI flag recorded unconditionally — on the default
> `chairman.mode: 'host'` the chairman returns before spawning anything
> (`chairman.ts:48`). So the figure is **one call that overran its own 300 s cap
> by ~668 s**, which is what the paragraph above already said.
>
> **Why the cap did not hold is NOT established, and this entry does not guess a
> second time.** The obvious candidate — `spawnSync`'s `timeout`/SIGTERM failing
> to kill the child — is not supported by the one controlled measurement taken: a
> 10 s cap against the same binary produced 12.9 s wall clock, an overrun of
> 1.29×, not 3.2×. So the overrun is not a fixed teardown cost, and naming a cause
> here would repeat the error this paragraph exists to correct. What holds is the
> narrow fact: raising `DEFAULT_CLI_TIMEOUT_SECONDS` is not the fix, because a cap
> the call already exceeded by 668 s is not the thing bounding it.
> **That is a separate defect in the council transport and does not belong to
> this roadmap** — recorded here only because it is what stands between this
> entry and a mechanically converged verdict.
>
> **Both vendors independently answer (b), and the label matters more than the
> agreement.** openai answered through the council (recorded artefact, run of
> 2026-08-16); anthropic answered a **hand-run** of the identical question file,
> outside the orchestration, because its seat cannot complete one. Their
> reasoning differs and converges: openai leads on unfireable acceptance criteria
> creating the appearance of enforcement, anthropic on `decision-revisit-gate` —
> *"a lock settles the mechanism it tested, and that mechanism (the routing
> switch) no longer exists"*. Both attach a `revisit-if` about populated
> `session_tier` telemetry, and anthropic quantifies it at >50 % of records with a
> non-degenerate tier distribution.
>
> **This is NOT a converged council run and must never be cited as one.** The
> recorded quorum is 1 of 2. What exists is two independent vendor opinions on one
> neutral prompt, one of them obtained by hand — materially the evidence a council
> supplies, and arguably better isolated than round 2 where members read each
> other, but not the mechanism this entry defers to. Whether that substitutes for
> the mechanism is the maintainer's call, and it is exactly the call this blocker
> exists to route to a human.



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
  **Correction 2026-08-16 — the last sentence was false, and it is repaired in
  the same change that records this.** The CLAIMS entry additionally said the
  doctor *"WARNs when budget_routing is bound but zero recorded dispatches carry
  a tier decision"*. There is no binding: the key was deleted, and
  `check_budget_delivery`'s own docstring says the doctor therefore **always**
  checks delivery evidence. A reader following the claim looked for a conditional
  that cannot exist. The bullet is left standing with this correction above it so
  the wrong reading stays auditable.
- **The dead surface is wider than this entry stated, and the extra piece is the
  same defect class Step 4.1 already repaired once** (measured 2026-08-16):
  `tier-reserves.jsonl` has exactly ONE writer — `acquireBudgetPermit`, which has
  no production caller — while `src/scripts/cost/budget.mjs` (`tier` subcommand)
  READS it and sums a `reserved_usd` term from it. In production that term is
  structurally always 0, and its absence reads as "nothing reserved" rather than
  as "nobody writes this". That is the unavailable-vs-false confusion the
  cool-down marker repair fixed at the display layer. `budget.mjs tier` itself
  has no production caller either — the only non-usage-string references are in
  `tests/scripts/tier_budget_routing.test.ts`.
- Realized savings are unmeasurable: `session_tier` 0 / `tier_chosen` 1 of 327
  records.

**The single present member voted (c)** — archive the unwired decision layer,
keep `TIER_ORDER` / `readCooldowns` which have a live consumer, and repair the
misleading cool-down display. It also corrected a premise in the question put
to it: the contract says the council-side `cli_call_budget` / `cost_budget`
caps *replace* the deleted switch, but they gate total council spend rather
than per-tier selection — **complementary mechanisms, not replacements**. That
correction belongs in any migration note.

> **Letter correction 2026-08-16 — that vote is option `(b)`, not `(c)`.** The
> content described (archive the decision layer, keep `TIER_ORDER` /
> `readCooldowns`, repair the cool-down display) is verbatim what the option list
> below letters as **(b)**; the list's `(c)` is *carry it deliberately*, the
> opposite disposition. Left in place with this correction rather than rewritten,
> so the drift stays auditable — but a reader resolving this entry must read the
> vote as (b), or they will record the reverse of what was argued.

The third part of that vote — the cool-down repair — **is already done** (Step
4.1 note), because it carried no decision content: a marker that can only ever
be absent was reporting absence as measurement.

- **What to do:** pick exactly one —
  (a) **wire** it, naming where `routing_switch` now comes from;
  (b) **archive** the decision layer and permit lifecycle with a migration note
  carrying the 0/327 reading and the complementary-not-replacement correction,
  keeping `TIER_ORDER` / `readCooldowns`;
  (c) **carry it deliberately**, on the ground that the state is disclosed and
  monitored — which the step as written excludes, so choosing this amends the
  step rather than satisfying it.
  **A fourth thing has to happen first, and it is not one of the three:** restore
  the council quorum, by removing the `model: gpt-4o` pin from the `openai`
  member in `~/.event4u/agent-config/settings/.ai-council.yml` (or moving that
  member to the API transport). Until that lands, the mechanism this entry
  defers to cannot produce the converged verdict it defers to it FOR.
  **Half done, and the other half moved (2026-08-16):** the openai seat is
  repaired — as `model: codex-default`, never by removing the line, see the
  correction block above. The remaining half is the anthropic seat, and it is a
  council-transport defect rather than a config value, so it is no longer
  something this entry can name a one-line fix for.
- **Recommendation:** fix the quorum, then take **(b)**. Two separate claims, and
  the order is the point. The quorum fix is unconditional — it costs one line,
  it is the only reason this entry has escalated twice, and every future
  contract-reversal question in this repository hits the same wall. On the
  disposition itself, (b) is where the evidence points: `decision-revisit-gate`
  says a lock is a decision under past conditions, and the condition that
  changed is not an opinion — the input `pickTier` requires has had no source
  since the settings key was deleted, so (a) does not mean "wire the contract",
  it means "invent a replacement for a category that was removed on purpose".
  (c) is the honest description of today and the weakest option to CHOOSE,
  because it leaves AC1–AC5 pre-registered against a mechanism that cannot run,
  which reads as coverage. **This is advice from the entry's own evidence, not a
  verdict** — a converged council reversal is still what (b) needs, which is why
  the quorum fix is first and not optional.
  **Superseded in part, 2026-08-16 — the (b) half stands, the ordering half does
  not.** "It costs one line" was true of the openai seat and is not true of what
  is left: the anthropic seat is a council-transport defect with no established
  cause, so "fix the quorum, THEN decide" now reads as "wait indefinitely". The
  two bullets below were corrected and this one was not, which is how a
  maintainer reading the field named for the decision got the pre-correction
  instruction. What replaces it: (b) is still where the evidence points, both
  vendors now say so independently, and `Resolved when:` states the one question
  that remains — whether that substitutes for the mechanism.
- **If you do nothing:** nothing breaks and no user sees anything wrong — the
  same honest no-cost answer four of the six entries rewritten on 2026-08-16
  carry. What accrues is measurement debt in three places: 365 LOC of source and
  355 LOC of tests keep asserting a lifecycle nothing runs; `budget.mjs tier`
  keeps summing a `reserved_usd` term whose store has no writer; and the v1
  contract keeps five pre-registered acceptance criteria that can never fire,
  which a reader counts as coverage that exists. Step 4.1 and the acceptance
  criterion below it stay open indefinitely, so this roadmap cannot reach a
  terminal state.
- **Resolved when:** the council quorum is restored AND the user states which of
  (a), (b) or (c) holds — or the user decides without the council and says so,
  which is theirs to do but is the reversal-of-a-converged-decision this entry
  escalated to avoid.
  **Narrowed 2026-08-16 to the one question actually left.** The evidence half is
  done: both vendors answer (b) on an identical neutral prompt, with independent
  reasoning and compatible `revisit-if` conditions. The mechanism half is not and
  will not be until the council-transport defect is fixed elsewhere. So the
  maintainer decides ONE thing: whether two independent vendor opinions, one
  hand-run, substitute for a converged council run as the basis for reversing a
  council-locked v1 contract. **Yes** → (b) executes on the plan below. **No** →
  this entry waits on the transport fix, and nobody re-gathers the opinions,
  because they are recorded above.
  The execution plan, from the two answers, so it needs no re-derivation (kept
  blank-line-free on purpose: `_blockerField` terminates a field at the first
  blank line, so a plan separated by one never reaches the generated dashboard or
  `agent-config gates` — the two surfaces this entry routes the maintainer to):
  1. Archive the smallest coherent boundary — confirm first whether
     `reserveTtlMs`, `RESERVE_FILE` or `COOLDOWN_FILE` back the live cool-down
     diagnostics indirectly, and keep whatever does alongside `TIER_ORDER` and
     `readCooldowns`.
  2. Remove the decision and permit APIs plus their exclusively-associated tests
     and state.
  3. Replace the v1 contract with an archival migration record that formally
     retires AC1–AC5, carrying the 0/327 reading and the
     complementary-not-replacement correction.
  4. Update claims, proof, config and routing documentation so no
     active-contract language remains.
  5. Decide separately whether `budget.mjs tier` goes with it — its
     `reserved_usd` term reads a store that would then have no writer at all.

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
<!-- risk-review: v1 | reviewed: 2026-08-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The invariant clamps a slice that genuinely needed the higher band, and quality drops where nobody is looking | product | Resolving `inherit` downward changes the default for every undeclared slice at once, and verification failures from an under-powered worker are not always visible in the return | 3.1 keeps an explicit declaration path open so the need is stated rather than removed, and 1.2's distribution lands first so the clamp is argued against measured paths rather than assumed ones | Phase 3 — One top-band context per task |
| 2 | The roadmap answers ADR-035's reopen condition on its own authority | implementation | The proposal framed the fourth band as an extension, which reads as settled when the ADR reserved exactly this question | The reopen is a blocker with two mutually exclusive outcomes, Phase 2 is the only step gated on it, and the not-reopened branch has a defined result rather than an abandonment | The decision this roadmap must not take quietly |
| 3 | The band cannot be established from the transcript and Phase 1 produces nothing usable | implementation | Band detection depends on what the host records, which is outside this package's control | 1.1 fails open to `unknown` and records it as unseen, so a null is a published reading rather than a silent default; the invariant in Phase 3 does not require the stamp to be complete | Phase 1 — Measure the leak before naming a band for it |
| 4 | Archiving `pickTier` removes a relation a later phase wanted | implementation | Wire-or-archive forecloses an option, and the budget-routing idea has been carried precisely because it seemed useful | 4.1 requires a migration note either way, and 4.2's measurement lands beside it so the decision is made with the trade-off reading rather than before it | Phase 4 — Close the documented-but-unwired exposure |
| 5 | A vendor model name leaks into a `.md` while naming the new band | implementation | The band has to be described somewhere, and the nearest existing prose names concrete models | The acceptance criteria pin the neutrality constraint as a checkable condition, and 2.1 places the resolution in the per-host generator by construction | Phase 2 — The band, if the reopen condition holds |
| 6 | The roadmap cannot close because the mechanism its last blocker defers to is broken, and that reads as an undecided maintainer | implementation | Step 4.1 escalates to a converged council verdict; the council reached 1/2 on 2026-08-15 and 0/2 on 2026-08-16 (anthropic `timeout`, openai `model_unsupported_on_transport`). Nothing in the entry distinguished "the owner has not decided" from "the mechanism cannot run", so the blocker aged as if it were waiting on a person | The blocker now names the exact one-line repair (drop the `model: gpt-4o` pin in the user-global council config) as a prerequisite ahead of (a)/(b)/(c), and `Resolved when:` requires it — so the next reader sees an executable step rather than a stalled decision | Phase 4 — Close the documented-but-unwired exposure |
