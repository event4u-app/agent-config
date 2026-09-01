---
complexity: bounded
review_by: 2027-03-31
---

# Stub: road to running the provider-recognition leakage bench

> **Stub — not active work.** Created 2026-09-01 (drain run 12) from the AI
> council's verdict on
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
> `blocker: leakage-bench-needs-assembler-and-design-forks`. Steps 3.3 and 3.4
> are `[~]` in that roadmap and point here. `[~]` means **DEFERRED — planned,
> carried, and not satisfied.**
>
> **Glyph note — do not "restore" this.** This stub read `[-]` until 2026-09-01.
> In this tree `[-]` means **cancelled — scope dropped, won't happen at all**
> and is additionally owner-reserved; `[~]` means **deferred**
> (`docs/guidelines/agent-infra/roadmap-progress-mechanics.md:218-219`,
> `src/agent-src/scripts/update_roadmap_progress.ts:25`,
> `src/agent-src/templates/roadmaps.md:30`,
> `src/agent-src/contexts/execution/terminal-states.md:41`; owner-reserved at
> `src/agent-src/scripts/archive_completed_roadmaps.ts:396`). The error came from
> transcribing the council's **own** vocabulary — both seats wrote "DEFER `[-]`"
> throughout their responses. The parent roadmap was corrected to `[~]` by an R2
> review before it shipped and carries its own correction note; these stubs were
> not corrected with it.
>
> **No measurement has been taken and none is claimed.** The NOT RUN state the
> two predecessor blockers protected is preserved here verbatim in force.

## The council verdict, and why the outcome is B3 and not B1

AI council 2026-09-01, members **anthropic (claude-sonnet-4-5)** and
**openai (codex-default)**, 2 rounds, blind chairman, subscription transport
(`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`.

**The recorded verdict is B1 — build the runner and execute both arms —
sequenced after the run's sibling decisions.** Both seats reached it, and both
attached the same hard precondition, in their own words:

- anthropic: *"both arms in one coherent session, or neither"*, and *"if session
  timeout or context degradation occurs mid-execution (e.g. between RAW and
  STRIPPED arms), partial results are INVALID."*
- openai: *"if the autonomous drain cannot remain active across two future UTC
  boundaries, B1 is not a real terminal disposition. In that case, choose **B3**
  immediately rather than recording an execution commitment the run cannot
  fulfill."*

**The precondition was tested and it fails, on arithmetic rather than
judgement.** The pre-registration puts each arm at 30 calls per provider, so
both arms is 60 per provider against a hard cap of 50 per provider per UTC day
(`src/scripts/ai_council/cli_call_budget.ts:60`) — the two arms cannot share a
day. Running them on consecutive days requires one coherent session spanning a
UTC boundary, which the drain run cannot guarantee and which the anthropic seat
ruled invalidates partial results if it breaks.

So the disposition applied is **B3, taken under the openai seat's explicitly
named fallback** — not an override of the verdict, and not the agent
substituting its own preference for the council's. The B1 verdict stands as
recorded, with its precondition unmet.

## What is already built — this stub is close to executable

Read at commit `af77709fd`.

- **The assembler exists.** `src/scripts/ai_council/leakage_corpus.ts` —
  `assembleLeakageCorpus` walks the response directory recursively and returns
  `{items, families, excluded, census}`; the synthetic fixture is **refused by
  throw** (`SyntheticCorpusRefusal`), not excluded. Sensitivity proven in three
  sabotage probes on 2026-08-31.
- **All four design forks are recorded** in
  `internal/bench/council-provider-leakage/PREREG-anonymisation-and-sampling.md`.
- **The pattern list exists**, and this is the fact the blocker text had gone
  stale on: `src/scripts/ai_council/leakage_patterns.ts` (453 lines), version
  `leakage-patterns-v1-2026-08-31`, carrying `PATTERN_LIST_DIGEST`, pinning
  `ARM_LABEL = 'pattern-stripped'` and asserting the labels condition 6 forbids.
  Both arms are therefore **design-complete**.
- **Corpus census:** 1,402 eligible real bodies, anthropic 699 / openai 703.

## The one thing still missing

**A production runner.** `collectGuesses`
(`src/scripts/ai_council/provider_leakage_bench.ts:90`) and `scoreRecognition`
(`:136`) have **zero production callers** — the only references outside
comments are in `tests/scripts/ai_council/provider_leakage_bench.test.ts`.

## Execution sequence, as the council specified it

1. Finish any sibling council decisions first — the arm consumes ~60 % of a
   day's per-provider cap.
2. Freeze the sampled 60 bodies and the arm allocation **by id**, before any
   rater call. The corpus is live and grows while it is read.
3. Build the production runner.
4. **Validate it on a 3-item subset** and verify it produces valid scored
   output. Failure here restarts the decision rather than the run.
5. Execute RAW on one UTC day.
6. Execute PATTERN-STRIPPED on the next UTC day.
7. Record failures, retries, exclusions, model identifiers and timestamps.
   Retries must not silently exceed the 30-call-per-provider budget.
8. Score per the pre-registered plan.
9. Decide 3.4 from the scored, interpreted result.

## Step 3.4 closes IFF — all four, and collection alone is not enough

- both arms complete (60 valid guesses total);
- results scored per the pre-registered criteria;
- scored output passes the validity checks (raters responded, exclusions within
  bounds);
- the analysis is interpreted per the pre-registration.

Both seats were explicit that **arm completion does not auto-close 3.4**.

## The only claim the result may ever carry

> On the frozen 60-item sample, provider recognition is detectable only if the
> pre-registered pooled result reaches at least **37 correct guesses out of
> 60** (exact one-sided binomial against `p0 = 0.50`, `p = 0.0462`). Any
> RAW − STRIPPED claim uses the pre-registered paired comparison and estimates
> the effect of **those registered transformations**, never "label leakage" in
> general. Neither result estimates population prevalence.

**The accidental-denominator caveat is part of the claim, not a footnote.** The
1,402-body corpus is what an unrun reaper left behind
(`src/scripts/ai_council/recouncil_savings.ts:237-240`), so only within-item
recognition is defensible. A single rater's `n = 30` is descriptive only and is
never promoted to a finding.

## Claims forbidden while these steps are `[~]`

Transcribed 2026-09-01 from the archived parent's own 3.3 and 3.4 deferral
blocks
(`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-e-council-topology-evidence.md:1247-1263`
and `:1270-1296`) and its roadmap-level prohibition at `:101-104`. This stub
previously stated only the **permitted** claim; the prohibitions were carried in
the parent and had no home here.

- that provider recognition was measured — **no measurement was taken and none
  is claimed**;
- that recognition is at or below chance. `normalizationGateVerdict` returns
  `unrun` on empty data and specifically **not** `below-bar`, because
  `below-bar` would assert that recognition had been measured and found
  harmless — the exact false null step 3.4 exists to prevent;
- that style normalization is cleared to land. Only both conditions recorded met
  reaches `bar-cleared`;
- that arm completion closes 3.4 — the four conjuncts in the section above
  govern, and both seats were explicit that collection alone is not enough;
- any population-rate claim from the 1,402-body corpus, which is an accidental
  denominator left by an unrun reaper;
- a finding from a single rater's `n = 30`, which is descriptive only.

The only permitted claim is that the bench was **designed, pre-registered, and
NOT RUN**, plus the scoped result statement in the section above should it ever
execute.

## Floors carried forward unmoved

- **`>= 30` distinct items per arm**, read per arm and not pooled.
- **The synthetic-fixture prohibition** (`smoke-items.json` refused by throw).
- **No population-rate claim** from the 1,402-body corpus.
- **No re-freezing the analysis after observing results.**

The council was asked whether it wished to move any of these and declined.

## Resumption trigger

Two consecutive UTC-day windows can be reserved with the per-provider cap free
in both, and the run executing them can remain coherent across the boundary.
