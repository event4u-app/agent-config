---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-mixed-trigger-activation-cost
    relation: disjoint
    note: >
      The roadmap whose blocker was being cited for a question it does not gate.
      This one splits the misrouted finding and leaves that roadmap's
      `b-behavioural-bench-spend` attached to the always-on-tier question it
      actually asks. Phase 4.1 verifies that blocker is unmodified.
estate_offset_exempt: "Cannot be offset. The roadmap it corrects, road-to-mixed-trigger-activation-cost, is in later/ and blocked by two blockers an agent may not lift, so it is not available as an offset; and archiving an active sibling to pay for a routing correction would be the accounting move that let this finding arrive ten times."
estate_growth_exempt: "Adds one active roadmap against a floor of 1. It exists because a 2/2 AI-council round found the tree is citing the wrong lock for its most-repeated external finding — ten arrivals answered by a spend blocker that gates a different question — and the correction is a split into three owners, which needs a file rather than a note. The three sibling roadmaps in this change touch the authorization parser, the findings ledger and three defect sweeps; none of them can carry a routing correction about delivery mode. Parking it means the eleventh arrival meets the same wrong lock."
---
# Road to the tenth arrival

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0, where three independent reviewers raised the same
> finding again. The routing correction below was put to the AI council
> (2026-09-04, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds,
> quorum 2/2) rather than to the maintainer, because it is a mechanism question
> the tree's own evidence settles.

## Goal

The recurring activation/delivery finding is three items with three owners
instead of one item behind one lock, the two that need no owner decision are
done, and the third reaches the owner as a decision packet rather than as a
tenth restatement.

## The routing error

`agents/evidence/analysis/inbox-2026-09-d-disposition.md:78-102` records the
finding's ninth arrival, names the eight prior rounds by directory, and routes
the whole thing to `road-to-mixed-trigger-activation-cost.md`, held by
`b-behavioural-bench-spend` — *"spend-bearing and therefore owner-reserved; no
agent lifts it."*

That blocker gates a different question. Its own text
(`road-to-mixed-trigger-activation-cost.md:516-536`) asks whether the **remaining
15 always-on rules** cost measurable behaviour rather than only tokens, via a
paired A/B run billing model tokens across 5-8 tasks.

The `lean_projection.mode` flip's recorded holds are three, and none of them is
that bench:

| hold | where it is written | what it actually asks for |
|---|---|---|
| activation charge | `src/config/hook-token-budget.json`, `rule-inject_reason` | move the `user_prompt_submit` (4,096 B) and `pre_tool_use` (2,048 B) slot-sum rows, which the 20,480 B concern row sits above on purpose. The row says so itself: *"The run that flips `lean_projection.mode: delivery` is the run that must move those two slot rows"* |
| host scope | `docs/CLAIMS.md:357` | the flip is Claude-only |
| authority | council 2026-08-23, quoted in `archive/road-to-trigger-delivered-rule-bodies.md:498` | *"flag to owner for post-roadmap review given the authority question is genuinely close"* |

The council's finding, both seats: *"the disposition uses a spend lock from an
adjacent workstream to halt the delivery-mode workstream. That is a routing
error."* Neither seat found any hold that prevents **preparation**; only the
shipped-default decision and actual spend are owner-reserved.

The third sub-item bundled into the same finding — the trigger corpus at 100 of
299 skills — is held by nothing at all. It inherited a blocker by association.

## Phase 1 — Correct the record

- [x] **1.1 Amend the disposition rather than writing a new verdict over it.**
      The ninth-arrival section stays; it gains the mechanism check it was
      missing — that `b-behavioural-bench-spend` does not gate the flip, which
      three holds do, and which of those permit preparation. A recurrence
      answered by a corrected lock is a different answer from a recurrence
      answered again.
      verify: the disposition names all three real holds with their sources and
      states that the bench gates the always-on-tier question only.
      **Done** — `inbox-2026-09-d-disposition.md:105-138`, an amendment under the
      ninth-arrival section rather than a rewrite of it. All three holds are
      named with sources; `b-behavioural-bench-spend`'s own scope is quoted from
      `road-to-mixed-trigger-activation-cost.md:516-536`. A **fourth** hold the
      table above does not list was found while checking: the settings schema
      (`src/scripts/schemas/agent-settings.schema.json:36-45`) declares
      `"enum": ["eager-all", "thin"]`, so `delivery` is not a value the setting
      can take at all. Carried into the decision packet and into the guard test.
- [x] **1.2 Record the split with owners.** Three sub-items, each with its own
      owner and its own blocker, so the eleventh arrival meets three states
      rather than one bundle.
      verify: the record names sub-items, owners and blockers, and the council
      round is cited with its date, members and quorum.
      **Done** — `inbox-2026-09-d-disposition.md:140-157`, a three-row table:
      trigger corpus (agent, no blocker), delivery flip (owner for the default,
      agent for preparation, three-plus-one holds), behavioural bench (owner,
      `b-behavioural-bench-spend`, unchanged). Council cited inline as
      2026-09-04, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds,
      quorum 2/2, $0.00 (both seats subscription-authed).

## Phase 2 — Trigger corpus (unblocked, agent-doable)

Held by nothing. Both council seats agreed, and codex added the constraint that
makes it real work rather than a phrase-adding exercise.

- [x] **2.1 Measure the current coverage from the tree, not from the review.**
      The "100 of 299" figure comes from the disposition file. Re-derive it,
      name the instrument, and state what the denominator counts — the review's
      figure and a `grep -l 'triggers:' src/skills/*/SKILL.md` disagree, and a
      coverage number nobody can reproduce cannot show movement later.
      verify: the count is reproduced by a named command whose output is quoted,
      and any divergence from 100/299 is explained rather than silently adopted.
      **Done** — `agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md`.
      **The review's figure reproduces exactly**: `check_routing_coverage` prints
      `skills 100 / 299 = 0.3344`, and the declared measurement in
      `src/config/routing-coverage-seed.json` is
      `src/skills/*/evals/triggers.json` over `src/skills/*/SKILL.md`. The
      divergence the step anticipated is real and is a different population, not
      a wrong count: `grep -l 'triggers:'` reads FRONTMATTER declarations (13
      line-anchored, 12 once restricted to the frontmatter fence, 27 unanchored)
      while the finding's figure reads the EVAL CORPUS. The 13→12 step is one
      file — `src/skills/rule-writing/SKILL.md:195` carries `triggers:` in the
      body as an authoring example. That "trigger" names two unrelated surfaces
      is what makes 2.3's null readable.
- [x] **2.2 Expand coverage with collision and ambiguity validation.** Adding
      199 trigger sets carelessly raises false activation, which is the failure
      mode that would make the whole finding worse. Each addition carries a
      positive fixture and a near-miss that must stay silent — the discipline
      `design-fidelity`'s routing matrix already applies to rules.
      verify: every new trigger set has both fixtures, and the near-miss rows
      fail if the trigger is widened by one word.
      **Done, with one clause reported rather than claimed.** 14 corpus files
      authored, 100 → 114 of 299; ratchet raised to 0.3813 with its history
      entry; 14 stale entries removed from the shrink-only grandfather
      allowlist. Scope and selection went to the AI council 2026-09-04 (2/2):
      a bounded, individually reviewable wave over closing the 199-file gap,
      selected by a **declared** rule rather than alphabetically — the skills
      carrying a deterministic MUST/NEVER/ALWAYS obligation (16 of the 34
      `report_skill_activation` names) that had no corpus. Two of the 16 were
      not reached (`motion-choreographer`, `upstream-contribute`) and **185
      skills still carry no corpus**; the council explicitly required that
      remainder to be stated rather than implied closed. Every file passes
      `lint_skill_trigger_corpus` (≥3 positives, ≥2 near-misses, a declared
      German positive, a declared case class per query).
      **The one-word-widening clause is not machine-decidable on this surface**
      and is not claimed to be: the skill harness is advisory only, never gating
      (`src/scripts/rule_trigger_eval.ts:4`), and skill selection is model
      judgement over prose rather than a matcher a fixture can widen. It is
      discharged in the reviewable form instead — every negative declares
      `near-miss` vs `counterexample` and carries a `note` naming the neighbour
      skill it must route to — and the limit is written down in the evidence
      file rather than implied away.
- [x] **2.3 Publish activation at the new coverage.** `docs/CLAIMS.md:240` says
      activation is "separately measured and is near zero". That measurement is
      the denominator the authority question lacks. Surface it, then re-read it
      after 2.2.
      verify: the measurement's instrument and its reading are named, before and
      after, and a null — activation stays near zero at 299 — is published as
      the finding it is rather than treated as a failed step.
      **Done, and the null is sharper than the claim it tests.** Instrument:
      `report_skill_activation` (advisory, gates on nothing;
      `taskfiles/ci-fast.yml:1015`). Reading over the project's transcript
      store, same command before and after the wave: 30 sessions, 11,013 →
      11,049 assistant turns, **0 Skill invocations and 0 of 299 distinct
      skills in both** — zero, not near zero. Published as its own ledger row,
      `docs/CLAIMS.md § skill-activation-census-zero`, and
      `published-artifact-counts`'s `non_inference` now points at it instead of
      asserting "near zero" with nothing behind it.
      The reading did not move, and the reason is structural rather than
      disappointing: `evals/triggers.json` is a test fixture read by three
      gates and by no host at routing time. Expecting activation to follow it
      would be the same two-surfaces error 2.1 exposes.

## Phase 3 — Delivery-mode preparation (agent prepares, owner ships)

Sequenced after Phase 2 deliberately. Sizing the budget rows before knowing the
load at 299 skills sizes them against the wrong corpus — the council's own
correction to a shorter plan.

- [x] **3.1 Size the two slot-sum rows against the measured delivery load.**
      The `rule-inject` row is 20,480 B against slot sums of 4,096 and 2,048.
      Produce the moved rows with their derivation, not a guess.
      verify: the derivation cites the measured emission at the post-2.2 corpus,
      and `bench_hook_injection` reads the concern within the proposed rows.
      **First clause done; the second is not satisfiable by that instrument and
      that is the finding.** Re-run today,
      `model_rule_injection --corpus tests/eval/routing-matrix` measures p50
      1,764 / p90 5,042 / p99 8,510 / max 13,290 exact-BPE tokens against the
      4,804 p90 the row was registered on — so the p90 rounds up to 5,500 tok,
      not 5,000, and **the registered 20,480 B row had fallen BELOW its own
      stated derivation** (22,528 B at 4.096 B/tok). The concern's own comment
      demands exactly this re-run
      (`src/scripts/hooks/rule_inject_hook.ts:89-90`). Two slot rows move, each
      by the concern's full ceiling: `user_prompt_submit` 4,096 → 26,624,
      `pre_tool_use` 2,048 → 24,576, with `per_turn_aggregate_bytes.ceiling_bytes`
      47,104 → 294,912 as the arithmetic consequence its own
      `ceiling_derivation` says it must be. `pre_compact` is BOUND but stays at
      2,048 — the concern clears its latch and returns before injecting there
      (`src/scripts/hooks/rule_inject_hook.ts:258-261`), so the recorded
      two-row charge is right; checked rather than assumed, and the packet's
      first draft had it wrong.
      **Note on the sequencing premise.** Phase 3 was sequenced after Phase 2 so
      the rows would be sized against the post-2.2 corpus. The two corpora are
      disjoint: 2.2 moved the SKILL eval corpus, while `rule-inject` delivers
      RULE bodies over `tests/eval/routing-matrix`, whose coverage
      (`rules 94/105`) this branch does not touch. The sequencing therefore
      changed nothing about the number — stated rather than presented as though
      it had.
      **Why the bench cannot read the concern.** `bench_hook_injection` drives
      each concern against a committed fixture, and
      `tests/fixtures/hooks/user_prompt_submit.json` carries the prompt
      `"echo hello"`, which matches no rule trigger. Probed with a
      `mode: delivery` settings file present (gitignored, created and deleted):
      `rule-inject` still reads 0 B. It reads 0 B inside the proposed rows and
      inside the current ones, which is a vacuous green. A trigger-matching
      fixture is the concrete follow-up, recorded in the packet's § 6.
- [x] **3.2 Prepare the flip as a held change set.** Claude-scoped, with the
      unsupported hosts named and verified unchanged, a rollback, and the tests.
      Nothing in this phase changes a shipped default.
      verify: `lean_projection.mode` still resolves to `eager-all` on every host
      after this phase, and a test asserts it.
      **Done** — `tests/scripts/_lib/lean_projection_shipped_default.test.ts`,
      5 assertions: the shipped template says `eager-all`, this repo's own
      settings resolve to it, `DEFAULT_LEAN_PROJECTION_MODE` is unmoved, the
      schema still does not admit `delivery`, and every generated host tree
      still carries full rule bodies rather than pointer stubs. Sensitivity
      proven rather than assumed: with the template flipped to `delivery` the
      suite goes 1 failed / 4 passed, and the tree was restored from a copy
      (never `git checkout`). The test is designed to go RED when the owner
      lands the flip — that is the tripwire that routes whoever lands it to the
      decision packet.
      The change set itself is held in that packet and applied nowhere:
      `git diff origin/main` touches neither `hook-token-budget.json`, nor the
      settings schema, nor the settings template.
- [x] **3.3 Hand the owner a decision packet, not a summary.** The exact diff,
      the before/after cost with its method, the residual risk, the rollback, and
      the one policy question the 2026-08-23 council flagged as genuinely close.
      Landing the budget-policy rows may itself need maintainer review — the
      council's seats split on this and the split is recorded rather than
      resolved.
      verify: the packet exists, names the unresolved authority question in the
      owner's words, and states which of its parts a maintainer must approve
      before landing versus after.
      **Done** — `agents/evidence/analysis/tenth-arrival-delivery-decision-packet.md`.
      It carries the exact four-file diff as applyable hunks rather than a
      description of them, the before/after cost with its method
      ($4.0417 → $0.7167 per 50-turn × 5-spawn session, 82.3 %, re-measured
      today rather than quoted from 2026-08-23, with the drift against those
      published figures recorded), the residual risk in both directions, the
      one-flip rollback, and a before/after approval table. The authority
      question is quoted verbatim from
      `agents/roadmaps/archive/road-to-trigger-delivered-rule-bodies.md:497-498`
      — including that the 2026-08-23 round was 2 configured / 1 answering, a
      degraded reading rather than convergence.
      **Nothing lands.** AI council 2026-09-04, 2/2: keep
      `hook-token-budget.json` byte-unchanged and carry the diff in the packet,
      because configuration must describe the shipped `eager-all` mode until the
      flip and its dependent rows can land atomically. Both seats also required
      a validity window on the measurements, which the packet's header carries:
      re-run `model_rule_injection` before applying, because the p90 has already
      moved once.

## Phase 4 — What stays where it is

- [x] **4.1 Leave the behavioural bench attached to its own question.**
      `b-behavioural-bench-spend` keeps gating the always-on-tier question on
      `road-to-mixed-trigger-activation-cost`. It is not a sub-item of this
      finding, and folding it in would rebuild the bundle this roadmap unpicks.
      verify: that roadmap's blocker text is unchanged, and this roadmap does not
      claim to unblock it.
      **Verified, not asserted.** `git diff origin/main -- agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md`
      is empty, and the blocker section hashes byte-identically on this branch
      and on `origin/main`
      (`sha256 b949aaa9658f51d12f3d224de2aa4f89dd1d4c260f04800a693e440ddd0df3ba`).
      The disposition's new split table records it as owner-reserved and
      unchanged, and the packet's § 1 states explicitly that this roadmap does
      not answer the flip's authority question.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The split is read as authorization to flip | product | Correcting the lock removes the reason the flip was refused, and a prepared change set one approval away is exactly the state where an autonomous run talks itself into shipping | 3.2 requires `eager-all` to still resolve on every host after the phase, with a test; 3.3 makes the owner's decision the deliverable rather than the flip | Phase 3 — Delivery-mode preparation |
| 2 | Trigger expansion raises false activation | product | 199 new trigger sets against a corpus tuned for 100 is the one way this work makes the product worse rather than better, and the failure is invisible until a wrong skill fires | 2.2 requires a near-miss fixture per addition that fails on a one-word widening — the same discipline the routing matrix already enforces for rules | Phase 2 — Trigger corpus |
| 3 | Phase 2 produces no movement and the finding is called closed | implementation | If activation stays near zero at 299, the temptation is to report the sub-item done and let the flip question lapse back into the bundle | 2.3 requires a null to be published as a finding, and Phase 1's record keeps the three sub-items separately stated so an unmoved one stays visibly open | Phase 2 — Trigger corpus |
| 4 | The budget rows land dormant and mislead a later reader | implementation | Moving slot sums for a mode nobody has enabled leaves the file asserting headroom the shipped configuration does not use | 3.1 ties the derivation to the measured emission, and 3.3 states explicitly which parts need approval before landing rather than after | Phase 3 — Delivery-mode preparation |

## Acceptance Criteria

- [x] AC-1 — The disposition record names the three real holds on the flip, states
      that `b-behavioural-bench-spend` gates a different question, and cites the
      council round that established it.
- [x] AC-2 — The finding exists as three sub-items with three named owners and
      three separate blocker states.
- [x] AC-3 — Trigger coverage is re-derived by a reproducible command, expanded
      with a positive and a near-miss fixture per addition, and activation is
      published at the new coverage — including if it did not move.
- [x] AC-4 — A held change set and a decision packet exist for the flip, and
      `lean_projection.mode` still resolves to `eager-all` on every host.
- [x] AC-5 — `b-behavioural-bench-spend` remains attached only to the always-on-tier
      question, unmodified by this roadmap.
