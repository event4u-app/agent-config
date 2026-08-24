---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-01
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added roadmap file whatever its status, and this addition carries no roadmap of its own to retire: the run archived only status: draft roadmaps, which were never counted and therefore cannot serve as an offset."
estate_growth_exempt: "Charges +1 later_roadmaps and +0 open_blockers. The later_roadmaps parking allowance covers only a roadmap moved from the active top level into later/ in the same change, and this file appears from nowhere, so it takes the claim path. Warranted because it is the measurement-gated successor of a draft rejected in senior review: its verdict metrics are unresolvable-by-construction until road-to-suggestion-block-capture AC-4 is citable, so the honest disposition is a parked file with a named resume condition rather than an active roadmap that cannot be executed. It adds no blocker: the live-evaluation dependency rides the EXISTING b-behavioural-bench-spend family, which this roadmap neither creates nor resolves."
---
# Road to elicitation front door — complexity-triggered challenge-me suggestion

> **Source:** agents/tmp.old/5-steps/road-to-elicitation-front-door.md

> **Parked on arrival. Resume when `claim:suggestion-capture-rate` carries a
> resolved non-DROP verdict with a citable figure**
> (`road-to-suggestion-block-capture.md` AC-4). Without that instrument every
> verdict metric below is unresolvable-by-construction.
>
> **This is now a single resume condition, not two.** The source carried a
> second conjunct — that `road-to-trigger-delivered-rule-bodies` reach a
> delivery decision. **That conjunct is DISCHARGED.** The roadmap is at
> `agents/roadmaps/archive/road-to-trigger-delivered-rule-bodies.md`, 34 of 34
> boxes done, `status: ready`, and its frontmatter records the outcome verbatim:
> "all four endpoints held and **the run declined it**". The delivery decision
> is therefore **dropped**, and the consequence for this roadmap is stated in
> the next section — it makes the work harder, not easier.

## What the discharged conjunct costs this roadmap

The conjunct existed because hook-injected rule bodies and standing contract
text are different placements with different prices, and building one before
the decision meant rebuilding it after. The decision came back **dropped**, so:

1. **Phase 2.1 collapses to a single placement: standing contract text.** The
   source's "hook-injected body **or** standing contract text" is no longer a
   choice. There is one option.
2. **Criterion 1.2(3) — zero net standing-token delta, paid in the same PR —
   moves from CONDITIONAL to MANDATORY.** In the source it applied only "in the
   latter case". The latter case is now the only case, so the payment is
   unavoidable and is the hardest single requirement in this file.

This is a strictly worse position than the source recorded, and it is written
here rather than absorbed because a reader comparing the two would otherwise
conclude a dependency had been cleared in this roadmap's favour.

## Goal

When a free-form user turn — one that will never reach a roadmap-execution
contract — is plan-shaped and carries deterministic ambiguity signals, the
shipped suggestion layer emits a MEDIUM-tier numbered-options block offering
`/challenge-me`, **proceed as-is**, and **abort**; the block's emission and the
user's choice are hook-captured; and a pre-registered three-criterion claim
(uptake, over-fire, token cost) resolves to PROVE, DROP, or UNDERPOWERED. Direct
routing stays confined to the shipped deterministic HIGH tier. Default-off.

## Context — what is verified in the tree

1. **Population correction.** For autonomous runs, intake elicitation is already
   shipped: `src/agent-src/contexts/execution/contract-decision-sheet.md`
   collects every pre-scan question onto one sheet with defaults plus an
   accept-all path, and its Iron Law makes an askable-but-unasked mid-run
   question a defect. In-run ambiguity halts are logged per run
   (`src/scripts/interruption_report.ts:93`). This roadmap therefore claims
   **nothing** about that population. Its population is free-form turns, which
   produce no halt telemetry — which is why the benefit metric below is
   uptake-shaped rather than halt-shaped.
2. **The runtime is model-carried.** `src/rules/command-suggestion-policy.md`
   (`type: auto`, `obligation_frequency: "per-turn"`) loads
   `contexts/contracts/command-suggestion-flow.md`; the TS engine
   (`match.ts:232`, `rank.ts:144`) is the reference implementation and golden
   harness, with `build_rule_trigger_matrix.ts` as its only build-time consumer.
   Behavioural change means text change in a per-turn corpus that both standing
   gates read red.
3. **Both payload gates are red, and no active roadmap is shrinking them.**
   `agents/roadmaps/archive/road-to-standing-payload-diet.md` is archived at
   `status: ready`, 18 done and 1 cancelled, and its own closure note states
   plainly: "**Neither gate reads green.** The preamble ratchet is +28,702 over
   its ceiling after the diet." Its AC-5 is recorded as DESCOPED rather than
   met, because `check_standing_rule_delivery` cannot observe a rule-body diet
   without a global reinstall. The diet was a deliberate three-rules-of-120
   pilot, so the residual stands.
4. **HIGH stays deterministic.** The tier matrix's own rationale
   (`command-suggestion-flow.md` § Tier matrix): a threshold on a fuzzy score
   "is exactly what would turn 'unique match' into 'usually right'". Inherited,
   not re-litigated.
5. **Kernel boundary, checked.** `ask-when-uncertain` is kernel-locked —
   `src/scripts/_lib/kernel_rules.ts:17-27` lists it at `:19` inside
   `KERNEL_RULE_IDS`, enforced by `block_kernel_rule_writes`.
   `command-suggestion-policy` appears nowhere in that file. Nothing here edits
   kernel text; one options block is one elicitation under the one-question law.
6. **Live behavioural evaluation is spend-gated.** Goldens test the spec, not
   live model behaviour; live trigger evaluation sits behind the EXISTING
   `b-behavioural-bench-spend` blocker family (which also parks
   `later/road-to-mixed-trigger-activation-cost.md`). Every "enforced" below
   therefore reads **spec-enforced**. Phase 4.3 is an explicitly optional
   extension and **creates no new blocker**.

## What this deliberately is NOT

- **Not auto-routing.** No ambiguity feature may ever contribute to HIGH; Phase
  3 makes that machine-checked and red-green demonstrable.
- **Not the kernel carve-out.** The `ask-when-uncertain` batch text edit remains
  `stubs/road-to-batch-elicitation-kernel-delta.md` — own PR plus soak,
  maintainer-signed. No dependency on it may grow here.
- **Not a coordination doctrine.** One narrow instance is registered and
  measured; nothing generalises from it without its own claim.

## Phase 1 — Features and the three-criterion claim, before any text ships

- [ ] **1.1 Define deterministic ambiguity features** in
      `src/config/elicitation-front-door.json` (`schema_version`,
      `registered_at`, `owner`, `review_by`). Boolean, turn-derivable facts
      only; candidates to cull, not extend: plan-shaped prompt with no derivable
      verification criterion; at least N distinct subsystems or paths named;
      explicit open-question markers; goal named without artifact.
      verify: every entry has `definition` and `detectable_from: turn_text`;
      `grep -ciE 'score|weight|confidence'` over the file returns 0.
- [ ] **1.2 Register `claim:elicitation-front-door-net-win` in `docs/CLAIMS.md`,
      status `unbacked`.** Three criteria, all fixed before data, all read
      through the capture instrument's audit lines:
      (1) **uptake** — share of `/challenge-me` entries arriving via an emitted
      block (`turn_classification: option_n`) rises above the registered floor;
      (2) **over-fire** — `as_is`-plus-`other` share of classified turns above
      the registered ceiling DROPS the claim regardless of (1);
      (3) **cost — MANDATORY, not conditional** — the exact-BPE token delta of
      every standing rule and contract text this roadmap adds, measured with the
      per-rule before/after machinery the archived diet roadmap published, stays
      at or below **zero net**, paid by an equal-or-larger body reduction in the
      same corpus and the same PR. Because the delivery decision came back
      dropped, standing text is the only placement, so this criterion always
      applies. **And the payment is strictly self-funded:** the diet roadmap is
      archived, so no active roadmap is shrinking the corpus on this roadmap's
      behalf. A verdict passing (1) and (2) but not (3) is DROP, not PROVE.
      UNDERPOWERED handling and the DROP consequence (demotion to
      phrase-triggers, flag stays off, null recorded) are registered with the
      same force.
      verify: the entry exists; its figures resolve under `check_claims`;
      criterion (3) names the diet machinery it reads from and states the
      self-funded condition.

**Exit:** claim and config merged; no engine, rule, or contract text touched.

## Phase 2 — Standing-text placement, MEDIUM-only, default-off

- [ ] **2.1 Add the ambiguity feature class as MEDIUM-only evidence in standing
      contract text.** Single placement — the hook-injected-body alternative is
      gone with the discharged delivery decision. The 1.2(3) zero-net payment
      lands in the same PR, unconditionally. Opt-in per command frontmatter,
      initially the `challenge-me` cluster only.
      verify: reference-implementation test — a turn matching every ambiguity
      feature and no unique-name signal tiers MEDIUM, never HIGH; and the PR's
      measured standing-token delta is at or below zero.
- [ ] **2.2 Rendered block carries both escape hatches** — *proceed as-is*
      (always last, per the shipped Iron Law) and *abort*.
      verify: snapshot on the rendered block; both strings present; the existing
      `Recommendation:` signature is unchanged, so the capture hook's detector
      needs no edit.
- [ ] **2.3 Flag `elicitation_front_door: false` in suggester settings;
      cooldown inherited unchanged.**
      verify: with the flag absent, a would-fire golden stays silent.

**Exit:** flag off, all pre-existing GT-CS goldens byte-identical and green, net
standing-token delta at or below zero in the same PR.

## Phase 3 — Spec goldens and the machine-checked non-escalation guarantee

- [ ] **3.1 Extend GT-CS goldens:** at least 2 plan-shaped positives (block with
      both hatches) and at least 2 negative controls — simple imperative
      instructions that must yield empty output, as a pass condition, following
      the `pv-02-negative-control` pattern (`docs/proof.md:413`).
      verify: the negative controls fail the suite if they produce any output.
- [ ] **3.2 Non-escalation invariant:** a check that fails the build if any path
      lets ambiguity evidence satisfy a HIGH condition.
      verify: a deliberately broken fixture turns it red; reverting turns it
      green — both states demonstrated in the PR.

## Phase 4 — Window and verdict

- [ ] **4.1 Enable the flag on the maintainer workspace** for the window length
      fixed in 1.2 before the window starts; power context (single
      self-selected workspace) recorded at registration and on the verdict line.
      verify: the window start and length are recorded before the first data
      point.
- [ ] **4.2 Resolve the claim** — PROVE, DROP, or UNDERPOWERED, from the
      instrument's audit lines only. Indeterminate is not a pass; on DROP the
      pre-registered demotion is executed in the verdict PR, not noted.
      verify: `check_claims` resolves the verdict figures; on DROP the demotion
      appears as a diff, not as prose.
- [ ] **4.3 (optional, spend-gated) Live behavioural window** — only under the
      EXISTING `b-behavioural-bench-spend` family's own resolution. This
      roadmap neither creates nor resolves that blocker.
      verify: the step is skipped with a stated reason while that family is
      open.

## Blockers

None created by this roadmap. Its live-evaluation dependency rides the existing
`b-behavioural-bench-spend` family, which is owned elsewhere and is neither
created nor resolved here. Its resume condition is a claim verdict in another
roadmap, not a blocker record.

## Risk Register
<!-- risk-review: v2 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Standing-payload regression, now strictly self-funded | implementation | The per-turn corpus grows while BOTH gates read red and, since the diet roadmap archived, **no active roadmap is shrinking it** — so every token this roadmap adds must be paid for by its own reduction | Claim criterion (3) is mandatory rather than conditional: zero-net delta paid in the same PR, read from the diet's own before/after machinery; the payment is a Phase 2.1 verify condition, not a review note | Phase 1 — Features and the three-criterion claim, before any text ships |
| 2 | Over-fire trains dismissal | product | Blocks on simple tasks teach ignoring the layer (the preamble-ratchet lesson) | Negative controls as pass conditions (3.1); cooldown inherited (2.3); over-fire is a registered DROP criterion read from real classifications, not self-report | Phase 3 — Spec goldens and the machine-checked non-escalation guarantee |
| 3 | Feature list accretes into a fuzzy score | implementation | Booleans grow weights and become the confidence threshold the shipped contract rejects | 1.1 grep-guard; 3.2 non-escalation invariant; features cullable, never extendable, without a new claim | Phase 1 — Features and the three-criterion claim, before any text ships |
| 4 | Verdict rests on spec, not behaviour | implementation | Goldens prove the reference implementation; live behaviour may diverge | Every AC says spec-enforced; the live window is optional and sits behind the existing spend blocker (4.3); uptake and over-fire read live audit lines, which ARE behaviour | Phase 4 — Window and verdict |
| 5 | The single resume condition never resolves | product | The whole file waits on one claim verdict in another roadmap; a DROP there leaves this permanently unresumable | The DROP case is defined rather than open-ended: it parks this roadmap's metrics as unsatisfiable-by-that-instrument, which is a recordable outcome and a reason to close rather than to wait | Phase 1 — Features and the three-criterion claim, before any text ships |

## Acceptance Criteria

- [ ] AC-1 — Config and claim exist with owner, review date, power floor, all
      three criteria and the DROP consequence — and predate the first Phase-2
      commit in history.
- [ ] AC-2 — With the flag on, plan-shaped ambiguous turns yield a MEDIUM block
      with both escape hatches and negative-control turns yield nothing —
      spec-enforced via goldens, with the pre-existing golden set
      byte-identical.
- [ ] AC-3 — The non-escalation guarantee is red-green demonstrable: no code
      path tiers ambiguity evidence HIGH.
- [ ] AC-4 — The claim carries a resolved verdict whose figures resolve under
      `check_claims`, read from the capture instrument's audit lines; on DROP the
      demotion is executed in the verdict PR; and the net standing-token delta
      of everything this roadmap shipped is at or below zero against the
      merge-base, measured by the diet machinery.
- [ ] AC-5 — The single placement is standing contract text, and no
      hook-injected-body variant was built.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| Resume condition | Two conjuncts: (a) a citable capture rate, **and** (b) `road-to-trigger-delivered-rule-bodies` reaching a delivery decision | One conjunct: (a) only | (b) is **discharged**. That roadmap is at `archive/road-to-trigger-delivered-rule-bodies.md`, 34/34, `status: ready`, and its frontmatter records "all four endpoints held and the run declined it". The decision is **dropped**. |
| Phase 2.1 placement | "hook-injected body **or** standing contract text" | Standing contract text only, single-placement | The dropped decision removes the alternative. There is no longer a choice to defer. |
| Criterion 1.2(3) | Zero-net token delta applied "in the latter case" — conditional | **Mandatory**, unconditional | Standing text is now the only placement, so the payment always applies. This makes the roadmap harder than the source recorded, not easier. |
| Risk 1 | "Per-turn corpus grows while an active roadmap shrinks it" | "…while **no active roadmap is shrinking it**" | `archive/road-to-standing-payload-diet.md` is archived (18 done, 1 cancelled). Nothing is shrinking the corpus, so the zero-net payment is strictly self-funded. |
| Risk type, row 4 | `measurement` | `implementation` | `lint_plan_risk_register.ts:288-293` admits **only** `product` or `implementation`. `status: later` is **not** draft-exempt — `DRAFT_VALUES` is the single literal `'draft'` — so the file could not have landed green as written. |
| `pv-02-negative-control` anchor | `docs/proof.md:386` | `docs/proof.md:413` | Line drift. The pattern still exists, now inside the `orchestration-dispatch-net-win` claims row. |
| Claim citation | `docs/CLAIMS.md:259` | `docs/CLAIMS.md:276` | Line drift only. The 0.27% model-carried capture figure is real and verified at HEAD; only the anchor moved. |
| Payload-gate figures | Absolute token counts quoted inline (135,436 / 107,646 and 120,857 / 110,000) | The archived diet roadmap's own closure figure, "+28,702 over its ceiling after the diet", plus its "Neither gate reads green" sentence | The source's absolute numbers were **not** re-verified at HEAD and their arithmetic does not reproduce the diet roadmap's published residual. Citing the archived roadmap's own statement is the anchor that resolves. |
| `estate_growth_exempt` | A YAML folded block (`>-`) | A single-line double-quoted string naming `+1 later_roadmaps` and `+0 open_blockers` | `growthClaims()` in `check_estate_count.ts:473` matches ONE patch line, so a folded block records the literal reason `>-` and the sentence never reaches the gate — functionally the silent exception the key exists to replace. |
| Frontmatter | No `owner`, no `review_by` | Both added | Required by the budget-ownership pattern. |
| Blockers section | Absent | Added, stating explicitly that none is created | A roadmap riding an existing blocker family should say so where a reader looks for blockers. |

**Verified at landing, not inherited:** the archived state and box counts of
`road-to-trigger-delivered-rule-bodies` (34/34, `status: ready`) and its
declined-endpoint sentence; the archived state of `road-to-standing-payload-diet`
(18 done, 1 cancelled) and its "Neither gate reads green" / "+28,702" closure
text; `kernel_rules.ts:17-27` with `ask-when-uncertain` at `:19` and
`command-suggestion-policy` absent from the file; `docs/CLAIMS.md:276`;
`docs/proof.md:413`; and `lint_plan_risk_register.ts:288-293`.
