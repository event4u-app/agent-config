---
complexity: structural
status: ready
---

# Roadmap: Council Blind Review — three small deliberation-protocol adoptions from an external five-advisor prompt pattern

> **Source:** maintainer feedback `agents/tmp.old/lean-agent-2.txt` (2026-07-28) —
> a widely shared one-model "LLM Council" prompt (five advisor personas →
> anonymized peer review → chairman one-line verdict) proposed for adoption.
> **Pre-analysis verdict:** do NOT adopt the whole mechanism — five personas in
> one session share one bias vector and one context; that is the same-session
> trap the cross-context evidence (28.6% vs 21.7% F1) and the entire council
> design stand against. Three sub-mechanisms ARE genuine protocol upgrades.
> **Council:** AI council debate 2026-07-28 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds). Round 1 split on Ü1 (REJECT — "the
> non-deliberating chairman constraint already eliminates self-preference;
> blinding discards legitimate calibration signal" — vs adopt-with-changes);
> round 2 converged on **adopt-with-changes**: (a) shared-provider training
> fingerprints keep the naming-effect channel open even for a
> non-deliberating chairman (synthesis is still next-token prediction over a
> prompt that contains provider names), and (b) the identities-visible
> status quo was itself never measured — demanding an A/B for the change
> while granting the incumbent a free pass is asymmetric. All three
> decision rules were TIGHTENED on council demand (boilerplate risk for Ü3,
> n=3 underpowered for Ü1, p-hacking risk in Ü2's "at least one" rule) —
> the tightened rules below are the council-final versions. Recorded
> revisit condition (from the dissent): an A/B on n≥20 technical questions
> showing attributed synthesis yields HIGHER expert agreement than blind
> would reopen Ü1.

## Outcome (2026-08-20 — drain-run close)

**Archived does not mean achieved.** One of the three adoptions landed; the
other two are transferred with their verdict unmade — not negative.

| Item | State | What that means |
|---|---|---|
| Phase 1 — protocol diff | **satisfied** | Ü1-Ü3 machinery shipped behind four default-off flags plus `blind_review.ts`; neutrality lint + pinned Iron-Law sha256 in `tests/scripts/ai_council_blind_review.test.ts` (26/26 green, re-verified 2026-08-20). |
| Phase 2 — A/B re-run | **satisfied** | n=10 paired re-runs, $1.58 measured spend, 0 failed runs (`internal/bench/council-blind-review/results-2026-07-28.md`). |
| Phase 2 — decision rules | **Ü1 satisfied · Ü2/Ü3 transferred** | Ü1: 0/10 crit-a and 0/10 crit-b, rule met, adopted. Ü2/Ü3: the rules are fixed and unapplied — they need a maintainer blind reading. |
| Phase 3 — landing | **Ü1 satisfied · Ü2/Ü3 transferred** | Ü1 merged: `blind_chairman` default `true`, `--no-blind-chairman` opt-out, mandatory post-verdict de-anon map, anchored in `docs/contracts/ai-council-config.md:804-820`. Ü2/Ü3 merge-or-null unwritable without the readings. |
| Phase 3 — N1 `council-lite` paragraph | **abandoned** | No explicit maintainer demand signal; the N1 exclusion zone stands (skipped 2026-07-28). |

**The Ü2/Ü3 verdict is unmade, not null.** No honest null was recorded for
either: an honest null is a *measured* answer ("the preference was not
majority"), and the instrument here — a maintainer blind rating — never ran.
Calling this a null would claim a measurement nobody took. Transferred to
[`stubs/road-to-council-blind-ratings.md`](stubs/road-to-council-blind-ratings.md),
outcome state `transferred`.

**One thing this run found rather than inherited:** the prepared packet cannot
deliver a blind R1. Ü3's mandatory `## Collective blind spot` / `## One-line
verdict` sections *are* the arm label, and the fields-bearing synthesis is arm b
in **10 of 10** questions — verified by mapping those headings per question
against `internal/bench/council-blind-review/rating-key.md`, zero mismatches. A
rater who notices the pattern once has the key for every remaining pair. The
stub carries the two ways out (an R1-recut packet, or a reading explicitly
labelled non-blind) as blocker 4. R2 is unaffected.

**No agent rated anything, and that is the point.** The pre-registration names
the maintainer; substituting an AI rater would be exactly the self-preference
bias (E1/E2) this roadmap exists to measure. A council pass is not a substitute
either — a council seat is neither the maintainer nor blind to what it is asked.

## Goal

Three small, separately gated upgrades to the AI-council deliberation
protocol: (Ü1) blind the chairman/synthesis stage, (Ü2) orthogonal stance
assignment per seat incl. an ablated-context outsider seat, (Ü3) two
mandatory chairman output fields — plus one explicit non-adoption (N1: the
one-model five-persona pattern never becomes a council replacement or a new
surface). Expected protocol diff < 30 lines; no new mode, no new surface.

## V1 — source-verified baseline (2026-07-28, not an assumption)

- The **peer-review pass** and the **finding-scoring pass** are ALREADY
  blind: `consensus.anonymize_responses` / `anonymize_findings` hand
  reviewers A–E labels; `label_to_source` is kept engine-side for
  de-anonymization (`orchestrator.ts:1431`, `:1591`).
- The **member-chairman synthesis** is NOT blind — by recorded design
  intent: the transcript is built "WITH identities (the chairman judges
  attributed positions)" as `## <provider> - <model>` blocks
  (`council_cli.ts:1171-1180`).
- The **host-synthesis path** (`chairman.mode: host`, the default) renders
  response blocks headed `## <provider> · <model>` (`orchestrator.ts` render)
  — identities visible to the synthesizing host agent as well.

So Ü1 is a REAL change on two paths, and it must argue against a recorded
(commented, not benchmarked) design intent — surfaced per the
decision-revisit gate: the comment is an authored preference, not a
measured lock; the counter-evidence (E1/E2) is measured.

**Phase-2 structural discovery (2026-07-28):** with the current TWO-member
council, a member chairman is IMPOSSIBLE — both members deliberate and
`select_chairman` hard-enforces generator-cannot-self-judge (explicit
`member:` requests fall back to host too). The Ü1 member-chairman path is
dead code at member count 2 and becomes live only with a third configured
member. The A/B therefore uses a fresh isolated synthesizer session per arm
(artifact-only input) as the chairman stand-in — a STRONGER blind than
production host mode; method in `internal/bench/council-blind-review/`.

## Evidence

- **E1 — self-preference is real and causally coupled to self-recognition.**
  Panickssery/Bowman/Feng (NeurIPS 2024, arXiv:2404.13076): LLM evaluators
  rate their own outputs higher while humans rate them equal; models
  recognize their own outputs out-of-the-box; self-preference strength
  correlates linearly with self-recognition ability.
- **E2 — naming shifts judgments.** Koo et al. 2024: real model names vs
  anonymous aliases measurably change evaluations.
- **E3 — stance steering as prior art.** Multi-model consensus with assigned
  stances is productive prior art; stance × model yields more diversity than
  model alone. The outsider seat (deliberately ablated context) is the
  council translation of the isolation evidence carrying the sparring spike.
- **Honest relevance condition:** E1/E2 are measured on answer *ranking*;
  our chairman partly *synthesizes*. The effect on synthesis is plausible,
  not 1:1 proven — hence Phase 1 is a re-run test, not blind adoption.

## The three adoptions + one non-adoption

- **Ü1 — blind synthesis (hygiene candidate, council: adopt-with-changes).**
  Before the chairman stage (BOTH paths — council Q3 verdict: uniform
  standard), shuffle responses and strip provider identity to A–E labels —
  reusing the EXISTING `anonymize_responses` seam, no new mechanism.
  De-anonymization happens after the verdict is written (audit log keeps
  the full mapping — blind is only the chairman at decision time, never the
  archive). **Honest limitation on the host path** (`chairman.mode: host`,
  the default): the orchestrating host agent saw identified responses
  stream in during the session — render-time A–E labels reduce salience at
  synthesis time, they do not erase memory. Full blinding exists only on
  the member-chairman path; the doc states this instead of overclaiming.
- **Ü2 — stance assignment per seat (experimental).** Five orthogonal
  stances (skeptic / first-principles / opportunity / outsider / operator)
  rotated deterministically over providers (e.g. question-hash mod 5),
  UNDER the existing neutrality contract (a stance means "examine from
  perspective Y", never "recommend X"). The outsider seat gets deliberately
  ablated context (question + artifact only, no `project_context`).
- **Ü3 — two mandatory chairman fields.** `collective_blind_spot` ("what did
  ALL members miss") and `one_line_verdict` + `single_strongest_reason`.
  Extends the option-level stance tallying; replaces nothing.
- **N1 — NOT adopted:** the one-model five-persona mechanism as a council
  replacement or new core surface. At most a `council-lite` documentation
  paragraph in the existing council context (honestly labeled: "shared bias
  vector, not a council"), and only on an explicit demand signal —
  subtraction before addition.

## Phase 1 — Protocol diff (no model calls)

- [x] Draft the protocol/code diff for Ü1–Ü3 (expected < 30 lines protocol +
  a small engine change): Ü1 wires `anonymize_responses` into the
  member-chairman transcript builder (`council_cli.ts` `_maybe_run_chairman`)
  and the host-synthesis render path, with mandatory post-verdict
  de-anonymization in the audit artifact; Ü2 as a deterministic stance
  rotation (question-hash mod 5) in the deliberation prompts; Ü3 as two
  required fields in the synthesis template. Neutrality-contract text stays
  byte-identical (lint asserts it). Implemented as a new
  `src/scripts/ai_council/blind_review.ts` module + four default-off CLI
  flags on `council:run` (`--chairman`, `--blind-chairman`, `--stances`,
  `--chairman-fields`) — `debate` intentionally out of scope for Phase 1.
- [x] Stance prompts linted against the neutrality contract (no "recommend
  X" phrasing, only "examine from perspective Y"); the outsider seat's
  context ablation documented as an explicit special case of the
  artifact-only principle. Enforced by
  `tests/scripts/ai_council_blind_review.test.ts` (neutrality-lint test +
  the pinned sha256 of the Iron Law of Neutrality bullet).

## Phase 2 — Re-run test on existing artifacts (minimal spend)

- [x] Re-run already-decided council questions (the 2026-07-28 debate
  artifacts exist locally under `agents/runtime/council/responses/`) in two
  arms: (a) current protocol, (b) Ü1+Ü2+Ü3 — **≥10 paired re-runs**
  (available questions × repeats; per-run cost measured at ~$0.05, so the
  council-demanded n sits comfortably below the spend threshold). Same
  models, same budgets. Metrics: verdict changes; maintainer blind
  preference over the chairman syntheses (arms hidden); the two
  pre-registered degradation criteria below; `collective_blind_spot`
  content quality.
- [-] **Pre-registered decision rules (council-TIGHTENED versions, fixed
  now):** transferred 2026-08-20 — U1 rule applied and adopted (0/10 + 0/10);
  U2/U3 rules fixed but unapplied, moved to
  `stubs/road-to-council-blind-ratings.md` (disposition B, outcome
  `transferred`) because they require a maintainer blind rating.
  <!-- blocker 2026-07-28 (owner: maintainer — partially decided): Ü1 DECIDED — ADOPTED, 0/10 +
  0/10 degradation triggers on the n=10 A/B ($1.58 spend, 0 failed runs),
  default flipped + test-pinned. Ü2/Ü3 PENDING the maintainer blind ratings
  (internal/bench/council-blind-review/blind-rating-packet.md — R1 for Ü2
  majority preference over the 9 substantively-differing pairs, R2 for Ü3
  decision-influencing ≥2/3); substituting an AI rater would break the
  pre-registration (and would itself be the self-preference bias this
  roadmap is about). Evaluator facts: ü3-field present+specific 10/10;
  verdict drift 9/10 (bundled-arm caveat recorded in results file) -->
  - **Ü3** is adopted only if the maintainer — blind to arms — rates the
    `collective_blind_spot` field as *decision-influencing* (not merely
    non-trivial text; boilerplate like "insufficient testing discussion"
    does not count) in ≥2 of 3 sampled runs.
  - **Ü1** is adopted when ZERO of the ≥10 paired re-runs triggers a
    pre-registered degradation criterion: (a) the blind chairman contradicts
    a position ALL members agreed on, or (b) the blind verdict cites
    evidence present in no member response. Literature evidence carries the
    prior; the n≥10 non-degradation run is the floor the council demanded
    over the original n=3. Honest limit stated: the maintainer blind
    preference is a 1-person sample — recorded as such, never inflated into
    a significance claim.
  - **Ü2** — the experimental part — is adopted ONLY if the maintainer
    blind-prefers the stance-arm's verdict or reasoning in the MAJORITY of
    re-runs where the arms differ substantively (council: the original
    "at least one of many" rule was a p-hacking shape); otherwise honest
    null and Ü2 is dropped entirely (outsider seat included).
- Blocker: none — re-runs on existing questions, 2 rounds, existing budgets
  sit below the spend-authorization threshold; if that does not hold in a
  given case, `benchmark-spend-authorization` applies as usual.

## Phase 3 — Landing & close

- [-] Merge accepted adoptions into the deliberation protocol; anchor the
  de-anonymization step (Ü1) in the council audit log; document rejected
  parts as honest nulls in this roadmap at archive time. Transferred
  2026-08-20 — the Ü1 half is merged and anchored; the Ü2/Ü3 merge-or-null
  moved to `stubs/road-to-council-blind-ratings.md` (disposition B, outcome
  `transferred`), unwritable until the two readings exist.
  <!-- blocker 2026-07-28 (owner: maintainer — Ü1 half done): Ü1 MERGED — blind_chairman
  default true on council:run, --no-blind-chairman opt-out, mandatory
  post-verdict de-anon map in the artifact, § Blind synthesis anchored in
  docs/contracts/ai-council-config.md, default test-pinned (26/26 green).
  Ü2/Ü3 merge-or-null waits on the maintainer ratings above -->
- [-] Optional (only on explicit maintainer request): the N1 `council-lite`
  documentation paragraph in the council context.
  <!-- skipped 2026-07-28: no explicit maintainer request — per N1 the
  paragraph exists only on demand; the exclusion zone stands -->
- Acceptance: protocol lint green; one real council run under the new
  protocol documented; roadmap archived with a results summary.

## Risks

1. **Stance theater** — assigned roles produce performative rather than
   substantive divergence → the Phase-2 rule demands a blind-preferred
   *content* change, not merely a different tone.
2. **Neutrality-contract erosion via stances** → the contract stays the top
   layer; stance prompts are linted against the contract text (no
   "recommend X", only "examine from perspective Y").
3. **Blind review breaks audit traceability** → post-verdict
   de-anonymization is a mandatory step; the full mapping lands in the log;
   blind is only the chairman at decision time, never the archive.
4. **Scope creep toward a council-lite feature** → N1 is the exclusion zone;
   a documentation paragraph at most, with a demand-signal condition for
   anything beyond.

## Blockers

### blocker: maintainer-blind-ratings

- **Status:** resolved — transferred 2026-08-20 (disposition **B**, outcome
  state `transferred`). The gate is not cleared and no verdict was produced;
  the work moved to a maintainer-owned stub so this roadmap can close without
  claiming an outcome it never reached. See **Resolution** below.
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Ü2 and Ü3 adoption (Phase 2 pre-registered decision rules) and
  the Ü2/Ü3 half of Phase 3's merge-or-null. **Ü1 is NOT blocked** — it is
  decided, adopted and merged (`blind_chairman` default true, opt-out flag,
  mandatory post-verdict de-anon map, 26/26 test-pinned).
- **What to do:** rate the prepared blind packet at
  `internal/bench/council-blind-review/blind-rating-packet.md`, blind to arms.
  Two independent readings: **R1** for Ü2 — majority preference across the 9
  substantively-differing pairs; **R2** for Ü3 — is the `collective_blind_spot`
  field *decision-influencing* in ≥2 of 3 sampled runs (boilerplate such as
  "insufficient testing discussion" does not count).
- **Why no agent can close it:** the pre-registration names the *maintainer*
  as the rater. Substituting an AI rater would break the pre-registration and
  would itself be the self-preference bias this roadmap exists to measure — the
  one substitution that invalidates the result it produces.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Do R1 and R2 in one sitting against
  the prepared packet, and accept an **honest null** as a full outcome for
  either — the entry's own Resolved-when asks for adopt-or-honest-null and
  explicitly refuses a deferral, so "the preference was not majority" closes Ü2
  exactly as cleanly as adoption does. The sitting is bounded: the packet is
  already prepared, Ü1 is already adopted and out of scope, and the two
  readings have pre-registered decision rules rather than open-ended judgement.
- **If you do nothing:** Ü2 and Ü3 stay undecided and Phase 3's merge-or-null
  cannot be written at all, so the roadmap cannot terminate in either
  direction. Ü1's shipped behaviour is unaffected, which is what makes this
  the cheapest kind of blocker to leave open and the easiest to forget.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (do R1 and R2 in one sitting against the prepared packet, and accept
  an honest null as a full outcome for either) is accepted as the PROTOCOL and the
  honest-null permission is preserved. The readings themselves are blind human
  judgments, which Rule 3 in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  assigns `B` — they cannot be substituted by an architectural choice or inferred from
  an existing null. The batch-B row in
  [drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)
  carries the three-point check verbatim: original criterion, the U2 R1 / U3 R2 / Phase
  3 merge-or-null work moved, re-entry producer a named maintainer blind rater, probe
  timestamped records existing before arm disclosure.
- **Resolved when:** both readings exist, and each of Ü2 / Ü3 carries an
  adopt-or-honest-null verdict rather than a deferral.
- **Resolution (2026-08-20):** **disposition B — transferred**, outcome state
  `transferred`, per
  [`drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md)
  (adopted rationale: *"Blind human judgments cannot be substituted with an
  architectural choice or inferred from existing nulls."*). Destination stub:
  [`stubs/road-to-council-blind-ratings.md`](stubs/road-to-council-blind-ratings.md).
  Moved: R1 (Ü2), R2 (Ü3), and Phase 3's Ü2/Ü3 merge-or-null. Re-entry
  producer: a **named maintainer blind rater**; probe: timestamped R1 and R2
  records exist before arm disclosure, each carrying an adopt-or-null verdict —
  both probe halves measured **failing** 2026-08-20 (10 of 10 rating slots in
  the packet still read `____`; `grep -rl 'R1 preference'` finds no record
  outside the packet). The **Resolved when** criterion above is unchanged and
  travels verbatim into the stub. Ü1 is explicitly NOT transferred: decided,
  adopted, merged, test-pinned. New finding recorded in the stub as blocker 4:
  Ü3's mandatory sections are themselves the arm label, so the packet cannot
  deliver a blind R1 as prepared (fields-bearing synthesis = arm b in 10/10).

<!-- SURFACED 2026-08-14. This blocker existed and was invisible: it was
encoded twice as HTML comments inside step bodies (Phase 2's decision-rules
step and Phase 3's merge step) and this roadmap carried no `## Blockers`
section at all. A blocker sweep — `agent-config gates`, the dashboard's blocker
count, any reader scanning for what is waiting on them — could see none of it,
so a user-owned gate sat unrequested for weeks while reading as ordinary open
work. The two inline comments are deliberately LEFT IN PLACE: they carry the
per-step evidence (spend, degradation counts, evaluator facts) that belongs
next to the step it describes. This section is the index, not a replacement.
The same shape is the standing lesson recorded in
`agents/settings/contexts/buried-roadmap-blockers.md`: gating that only a
prose reader can see is gating the tooling cannot count. -->

## Explicitly NOT in this roadmap

- No adoption of the one-model five-persona mechanism as a mode, skill, or
  surface (N1).
- No changes to the sparring spike, the scope decision, or the archived
  lean-init roadmap.
- No new aggregator, ledger, or engine — Ü1 reuses the existing
  anonymization seam.
