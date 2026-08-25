---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-10-15
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this addition carries no roadmap of its own to retire: the run archived only status: draft roadmaps, which were never counted and therefore cannot serve as an offset. The addition is sanctioned on its own terms -- all eleven of its file:line citations re-resolve at HEAD, and it closes a gap the archived routing roadmaps explicitly left open: production skill selection runs on SKILL.md description text that no gating test reads."
---
# Road to routing assurance — testing what actually selects

> **Source:** agents/tmp.old/test-concept/road-to-routing-assurance.md

## Goal

Every mechanism that decides *what loads* — host-native description routing,
hook-emitted skill pointers, router-projected rule tiers, and the MCP delivery
path — has a test that runs on the SAME surface the mechanism actually decides
on, with a pre-registered floor, an affordable PR-time gate for the cheap part,
and an honest-null path for every claimed improvement.

## Context — the confirmed defects

All five anchors below were re-verified in this worktree at landing. Where a
figure moved, the correction is in the table at the foot of this file.

### D1 — The gated tests and the production surface are different artifacts

- Deterministic suites test `dist/router.json` trigger substrings:
  `trigger_coverage.ts:10` ("The deterministic *must-load* floor for the
  lean-initial-context migration"), plus `tests/eval/routing-matrix/`
  (94 fixture YAMLs and a README, positives and near-misses per tier-1 rule).
- Production skill selection on Claude Code runs on SKILL.md `description`
  frontmatter: `lint_skill_descriptions.ts:6-7` states it plainly — "the agent
  picks a skill from its `description`".
- The only test on that production surface is the live LLM eval, and it is
  explicitly non-gating: `rule_trigger_eval.ts:4` ("advisory only, never
  gating"), `:31` ("the advisory floor is REPORTED but never fails the run"),
  `:32-33` ("A live floor breach fails the SCHEDULED canary job only — PRs are
  never blocked by live results"). Live authorization derives exclusively from
  the key file the canary workflow materializes from repo secrets, with no
  env-var fallback (`:28-29`).
- Net: a description edit that breaks routing merges with green CI. The linters
  (`lint_skill_descriptions.ts`, `audit_skill_descriptions.ts`) catch structural
  defects (description-equals-name, no-routing-signal, length), not behavioral
  regressions.

### D2 — The documented failure mode is recall, the gates guard precision

- `tests/reasoning-layer-eval/RESULTS-trigger-2026-06-16.md:15-18`: headline
  "precision-perfect, recall-collapse" — recall collapsed for 4 of 5 scored
  disciplines.
- The must-load floor corpus is **26** cases (`tests/eval/trigger-coverage.yaml`,
  count of `prompt:` keys) against **120** rules (`src/rules/*.md`) and **299**
  skills (`src/skills/*/`). The routing-matrix discipline (at least 3 positives
  including one German, at least 2 near-misses) exists for tier-1 rules only —
  there is no per-skill equivalent at scale on the description surface.

### D3 — Catalogue size is reported, never treated as an independent variable

No suite sweeps catalogue size as an independent variable. `distractor` matches
2 files, both unrelated retrieval scripts (`second_brain_retrieval.ts`,
`memory_replay_24.ts`); `catalogue_size` matches 9 times in `src/scripts/`
across three files, but every one either *reports* the size
(`skill_trigger_eval.ts:436,450,1015`, `rule_trigger_eval.ts:224,243,379`,
`cross_model_smoke.ts:135,197,216`) or measures host-side delivery divergence
(`_lib/skill_catalogue_series.ts`) — none conditions selection accuracy on it.

The nudge-interference matrix deliberately ranks against a TWO-ENTRY temp
catalogue (`tests/eval/nudge-interference/prompts.yaml:9-10`) — correct for its
purpose, and exactly the opposite of pressure testing. This suite ships 299
skills.

### D4 — The delivery path has bifurcated, and the tests have not followed

**Restated at landing.** The source read "the delivery path is *about to*
bifurcate". It already has: `agents/roadmaps/archive/road-to-skill-delivery-over-mcp.md`
is archived at `status: ready`, 22 of 25 boxes done with 3 transferred, closed
2026-08-23 with the outcome header "`measured-null`". Its delivery artefacts are
in the tree: `suggest_skill_for_task` (reachable via `src/shared/skillRanking.ts`
and `src/cli/mcp/dispatch.test.ts`), `src/scripts/compute_skill_tiers.ts` and
`src/scripts/_lib/skill_catalogue.ts` all ship.

So two delivery paths exist today and every current eval assumes a single one.
The consequence for this roadmap is that **Phase 4 is actionable now** rather
than blocked on another roadmap's schedule — the hedge the source carried there
has been deleted.

### D5 — Live measurements are single-shot

No repetition parameter exists in `skill_trigger_eval.ts` (the only matches for
`repeat` are `String.repeat` calls). Trigger firing is stochastic; single-shot
rates are noisy floors.

## What already exists and is NOT re-proposed

This roadmap EXTENDS three artefacts and duplicates none: `trigger_coverage.ts`,
`tests/eval/routing-matrix/`, and `lint_trigger_precision.ts`.

- **Hook-layer routing** (pointer emission, delegation nudges) is already tested
  against the real predicates with positives AND pinned near-misses
  (`tests/eval/nudge-interference/prompts.yaml:4-7`) — untouched.
- **Deterministic router-artifact suites** stay the floor for the projection
  layer; this roadmap adds the description surface beside them.
- **Description STRUCTURE linting** stays the zero-cost first gate; Phase 1
  gates BEHAVIOR, which the linters cannot see.
- **Golden replay** (`tests/golden/harness.ts`) covers work_engine structure
  drift; routing is out of its scope by design and stays there.
- **Archived owners, cited not re-proposed:**
  `archive/road-to-tested-routing.md` (38/38) owns the ownership map and the
  deterministic matrices; `archive/road-to-routing-correctness.md` (14 done, 1
  cancelled) owns rule hygiene and `route:explain`, and its council disposition
  cut the runtime-resolver phase entirely — this roadmap does not revive it;
  `archive/road-to-agentic-engineering-assurance.md` (`status: done`) owns the
  frozen-corpus, false-verified and cost/latency doctrine this roadmap consumes.
- **`later/road-to-cross-model-routing-eval.md` remains the owner of every
  comparative cross-model claim.** This roadmap may clear that roadmap's gate
  (b) — the missing in-host harness — but it makes no cross-model claim of its
  own and does not unpark it.

## Phase 0 — Pre-registration and baseline capture

- [x] **0.1 Pre-register the metric set** in `docs/contracts/`: per-unit routing
      recall (unit = skill or routed rule), per-unit precision on near-misses,
      catalogue-conditioned selection accuracy, and delivery-path parity delta.
      Include the Phase 3 and Phase 4 null hypotheses verbatim.
      verify: **`docs/contracts/routing-assurance-metrics.md`** — four metrics,
      each with a definition, a unit and the surface it must be measured on.
      Both nulls are **quoted**, with the Phase-3 scope restriction carried into
      the quote because it is part of the pre-registration: the null *"settles
      exactly one question, the confusion measurement, and cancels nothing"* and
      may not claim authority over tiering.

      **Floors are deliberately NOT set here**, and the contract says why: 0.4
      requires each floor to derive from the 0.2 baseline, and that baseline is a
      live run which has not happened. Writing floors now would be inventing them
      — the move 0.4 forbids in its own title. What IS registered is the
      derivation rule plus **the tolerance, 0.10 absolute recall, fixed before
      any baseline exists** so it cannot be tuned to a result. Phase 4's epsilon
      is fixed the same way at 0.05.

      **The proxy gap is stated before it can be discovered**: Phase 1's checker
      asks whether a description is *distinguishable*, not whether a production
      model *selects* it, and no floor closes that gap. A green Phase-1 gate is
      never evidence that production routing works.
- [ ] **0.2 Run the existing live harness once as a frozen baseline** (canary
      budget), storing per-unit results as the regression reference.
      verify: the baseline artifact exists, names its commit and model, and its
      per-unit rows are machine-readable.

      **Open, and it gates 0.4.** This is a live LLM run against the canary
      budget. Token spend is authorised for this drain run, but a *frozen
      baseline* is only worth freezing if it is taken on the surface and model
      the regression reference will be compared against later — and a baseline
      captured mid-run by an autonomous session, then used to derive floors in
      the same session, is the shape 0.4's own title warns about. Recorded as
      the next real step rather than attempted here.
- [x] **0.3 Two ratchet files, one per scope** (rules / skills): coverage ratio
      = corpus cases / routed units, seeded at the measured current value. CI
      fails only on decrease, the same COUNT-ratchet disposition as
      `lint_trigger_precision.ts`.
      verify: **both states demonstrated on BOTH scopes**, not one.
      `check_routing_coverage` + `src/config/routing-coverage-seed.json`:

      ```
      = rules    94 / 105  = 0.8952  (seed 0.8952)
      = skills   76 / 299  = 0.2542  (seed 0.2542)
      ```

      Removing `routing-matrix/active-remediation.yaml` → `rules 93/105 = 0.8857
      < 0.8952`, **exit 1**; restored → exit 0. Removing
      `legal-practice-profile/evals/triggers.json` → `skills 75/299 = 0.2508 <
      0.2542`, **exit 1**; restored → exit 0.

      **The two seeds ARE defect D1, quantified.** The rules surface is ~90 %
      covered by a deterministic corpus that can fail a PR; the skills surface —
      the one production routes on — is **25 %**, covered only by a harness that
      is *"advisory only, never gating"*. One blended figure would read ~46 % and
      describe neither, which is why this is two ratchets and not one.

      **A ratio rather than a count**, because the denominator moves: adding 8
      skills without corpus cases lowers coverage while every count rises, and a
      count ratchet would call that progress. A test asserts exactly that case.

      **Wired to fail a build, not only a terminal.** `gate-coverage.yml` row
      (`min_scanned: 300`, canary `zz-canary-routing-coverage`), `ci-fast.yml`
      task, the `Taskfile.yml` `ci:` list, and a `rule-backstops.yml` step — plus
      `src/config/routing-coverage-seed.json` added to **both** `paths:` blocks,
      because without it a PR that lowered the seed alone would not trigger the
      gate that refuses exactly that edit.

      **`scanned` is the sum of the two DENOMINATORS, deliberately.** Reporting
      the covered count would make the gate's own dead-scope floor move with the
      thing it measures — a corpus case going missing would shrink `scanned` and
      the floor would follow it down.

      Three ratchets were checked rather than assumed. `--canary` confirms the
      planted skill is caught (`caught the planted contract-violation defect`).
      `--self-test` (7 cases, 5 rejecting) drives the real CLI, so
      `gate-self-test:registered-non-adopters` stayed at its baseline of 24
      instead of rising to 25; the `GateLedger` adoption kept
      `check_gate_completeness` at the 218 it already reads on `main`.

      One defect found while building it and worth recording: the first version
      compared the **raw float** in the per-scope row and the **rounded** value
      in the verdict, so `rules` printed `↑` and `skills` printed `❌` while the
      summary line correctly said green. A gate whose rows contradict its verdict
      is worse than one that is simply wrong — the reader cannot tell which half
      to trust. Both now share one exported `r4`.
- [ ] **0.4 Derive the floors, never invent them.** Each per-unit floor = its
      0.2 baseline value minus a fixed tolerance, written into the
      pre-registration BEFORE Phase 1 activates.
      verify: every floor in the contract traces to a 0.2 row; no floor is
      raised in the same PR that changes the thing it measures.

      **Open, blocked on 0.2 by construction** — there are no rows to trace to.
      What 0.1 could register in advance, and did, is the **derivation rule and
      the tolerance** (0.10 absolute recall), fixed before any baseline exists so
      the tolerance cannot be chosen after seeing the numbers. That is the half
      of 0.4 that does not need the baseline, and it is the half that is
      gameable if left until after.
- [x] **0.5 Claims-ledger entries** for every claim this roadmap will make
      ("diff-scoped gate catches description regressions", the Phase 3 and 4
      nulls), each with its evidence class and its null path — before any
      implementation lands.
      verify: **three entries registered with zero implementation code**, which
      is what makes them pre-registrations rather than descriptions:
      `claim:description-gate-catches-regressions`,
      `claim:catalogue-pressure-null`, `claim:delivery-path-parity`.
      `check_claims` resolves all three (ledger 91 entries, 27 unbacked) and
      `docs/proof.md` was regenerated in the same change.

      Each carries its null path explicitly. The parity entry also carries the
      consequence of a breach *before* a breach can soften it — *"blocks any MCP
      default-on decision; default-off holds until then"* — and records that the
      Phase-4.3 table adds **no new claim id**, which is why one entry covers the
      gate and not the table.

**Exit:** pre-registration merged, baseline artifact stored, ratchets green at
seed values.

## Phase 1 — A description-surface gate that PRs can afford

- [x] **1.1 Build `description_route_check`.** Input = full catalogue (name +
      description, the production routing condition) + a prompt; output =
      would-load set. Two backends: (a) the existing MockRouter for plumbing,
      (b) a cached live backend keyed on (catalogue-hash, prompt) so unchanged
      pairs cost zero.
      verify: **`src/scripts/description_route_check.ts`**, 17 tests. The dry
      backend runs with no key and no network. The zero-call assertion is the
      load-bearing one and is written as such — a second identical run leaves
      `inner.calls` at 1, and a cache that quietly re-called would still have
      produced the right verdict, so the verdict could not have caught it.

      **The cache key carries the catalogue hash, and a test proves why.** A
      description edit anywhere changes the routing condition for EVERY prompt,
      so a prompt-only key would serve a stale answer at exactly the moment the
      answer changed; the `MISSES when any description changes` case asserts the
      call count rises. The hash sorts by name first, so a filesystem reordering
      — not part of the routing condition — does not invalidate the cache.

      **The catalogue is read from `dist/agent-src/`, not `src/`** (418 units,
      all 418 carrying a description), because the projection is what a host
      loads. And it is the WHOLE estate even when the case scope is one unit:
      routing is competitive, so scoping the catalogue would change what is
      being measured, while scoping the cases is the cost control.
- [x] **1.2 Diff-scoped gating, inside the existing key boundary.** Because live
      authorization derives exclusively from the canary workflow's key file with
      no env-var fallback (`rule_trigger_eval.ts:28-29`), the live check CANNOT
      run in ordinary PR CI. It runs in the same secrets-bearing workflow class,
      triggered pre-merge for same-repo branches whose diff touches a
      `description`, over that unit's positives and near-misses only. Fork PRs
      and non-description diffs stay canary-only and advisory, exactly as today.
      verify: all three demonstrated, as unit cases on `scopeRun` and end-to-end
      on the CLI. Fork → `advisory — fork PR — the key file is unreachable by
      construction`; a `src/scripts/*.ts`-only diff → `advisory — no description
      surface in the diff`; `src/skills/legal-practice-profile/SKILL.md` →
      `scoped-live — 1 unit(s)`.

      **The refusal happens before any spend, with a reason**, rather than as a
      key error at the router — a fork PR takes the advisory path even if a
      secret were later added to that job, because the decision reads the event.

      **The PROJECTION counts as a description surface too.** A `dist`-only edit
      is what a host actually reads, and a source-only filter would miss exactly
      that case; a test pins both directions, including that a unit whose source
      AND projection changed appears once.

      `.github/workflows/description-route.yml` — dry tier per PR (no key, no
      spend), cached-live tier on schedule and dispatch, inside the key
      boundary. An absent secret is a `::notice::`, never a red: an absent
      secret is a repo-configuration fact, and a red check for one trains
      readers to ignore the workflow.
- [x] **1.3 Recall-first fail condition** — a positive that stops loading
      blocks; a near-miss that starts loading warns. This matches D2's direction.
      verify: two fixtures, one per direction. A positive that stops loading →
      `blocked: 1`, render exit **1**. A near-miss that starts loading →
      `warned: 1`, render exit **0**. A third case runs both at once and asserts
      neither masks the other.

      **The asymmetry is the point and is stated in the code**: an extra unit
      loading is a token cost, a missing unit is a missing obligation, and D2's
      measured direction in this repository is under-delivery.

      One design correction found by running it: `--dry` initially returned its
      own exit code, which made every description edit red — the dry backend is
      a NAME-substring matcher over a catalogue whose signal is the
      DESCRIPTION, so it misses nearly every real prompt by construction. Its
      exit is now forced to 0 with the reason printed. A gate red for a reason
      unrelated to the thing it measures is worse than no gate.
- [x] **1.4 Record the proxy gap as a stated limitation.** The checker asks a
      model "which units would you load given this catalogue" — that is NOT the
      host's full selection procedure. It is a regression detector on the
      description signal, and its fidelity to real sessions is a MEASURED
      quantity (5.4), never an assumption.
      verify: both surfaces carry it — `description_route_check.ts` § THE PROXY
      GAP, and `routing-assurance-metrics.md` § The proxy gap. The duplication is
      deliberate and each side now points at the other: a reader arriving at a
      red check reads the script, a reader arriving at the metric set reads the
      contract, and a limitation recorded in only one of the two is invisible
      from the other.

      The wording states the gap as **unquantified**, not small — its fidelity
      is step 5.4's measurement, which has not run.

**Exit:** checker ships with dry-run and cached-live backends, the pre-merge
diff-scoped workflow exists inside the key boundary, and either its first
true-positive or a recorded month of zero-noise operation is in the ledger.

## Phase 2 — Per-skill corpus at routing-matrix discipline

- [x] **2.1 Extend the routing-matrix CORPUS DISCIPLINE to skills** (not its
      matcher): one YAML per skill, at least 3 positives (at least 1 German), at
      least 2 near-misses. Validity is checked on the description surface via
      Phase 1's checker; the substring matcher stays a projection-layer tool
      with no opinion on descriptions.
      verify: **`lint_skill_trigger_corpus`** — 90 corpus files scanned, 15
      tests, `--self-test` 7/7 (4 rejecting). Too few positives, too few
      near-misses, a malformed file and a dead scan root all exit non-zero; no
      case reaches a reviewer.

      **AMENDED, by AI council 2/2 (`anthropic/claude-sonnet-4-5` +
      `openai/codex-default`), and recorded rather than performed silently.**
      This step's literal text said *"one YAML per skill"*. Taken literally it
      adds a THIRD corpus surface next to the 74 `queries`-shaped and 2
      `should_trigger`-shaped JSON files already in the tree and already read by
      `skill_trigger_eval`. Both seats: the step's stated objective is corpus
      DISCIPLINE and its verify condition is format-agnostic, so the discipline
      goes on the existing JSON. Both were also explicit that this is legitimate
      **only because it is amended in writing** — one seat: *"silent
      substitution would violate the roadmap's intent; explicit amendment
      preserves accountability"*. Migration of all 76 (option C) was rejected as
      scope creep inside a drain run; a second format (option B) as competing
      authorities.

      **Language is DECLARED, never detected**, on both seats' insistence:
      `"language": "de"` on the case. A detector would pass a German-looking
      English sentence and fail a short German one, and its failures would be
      unactionable. Forward-only, because zero of the 76 pre-existing files
      carry the field.

      **The council's sharpest point is carried into the gate's docstring:
      serialization, case semantics and coverage are three contracts, and
      choosing JSON answers only the first.** Whether a `trigger: false` case is
      a genuine NEAR-MISS rather than an unrelated negative is not
      machine-decidable, and the gate says so instead of pretending. Coverage
      stays with `check_routing_coverage`.

      **Grandfathering is by NAME (`brand-asset-generation`, `estimate-ticket`),
      not by a numeric baseline** — a count would let a third failure arrive
      while the number stayed put if one of the two were fixed in the same
      change.
- [x] **2.2 Priority order:** skills with recorded invocations first (hook
      telemetry), then tier by `model_tier`. Do not attempt all 299 in one drop;
      the 0.3 ratchet makes partial progress durable.
      verify: **the telemetry query was run and returned an HONEST NULL.**
      `skill_usage_report` on the current tree: *"Skills tracked: 299 · Active:
      **0** · Exposed-only: **0** · Dead: **299**"*. There are no recorded
      invocations, so the first ordering key ranks nothing — the query is
      recorded here precisely because its answer is empty, and an ordering
      presented as telemetry-derived would have been chosen by hand.

      The ordering therefore falls to this step's own stated second key,
      `model_tier`. Distribution over the 223 skills with no corpus: **high 65**,
      medium 87, inherit 69, lite 2. The batch is 14 `high`-tier skills, and the
      step's *"do not attempt all 299 in one drop"* is the reason it is 14 and
      not 65.

      **The exit condition "every top-invoked skill has a corpus file" is
      vacuously satisfied** — the top-invoked set is empty — and that is stated
      rather than claimed as coverage.
- [x] **2.3 Each corpus file doubles as the Phase 1 gate input**, so corpus
      growth directly widens the gated surface.
      verify: measured on the loader Phase 1 ships. Before the batch: **1,285
      cases over 170 units**. After: **1,369 over 184**. A scoped run for
      `src/skills/authz-review/SKILL.md` returns 6 cases where it previously
      returned 0 — the gated surface widened by exactly the corpus added.

      Coverage moved **0.2542 → 0.3010** (76 → 90 of 299) and the seed was
      RAISED to 0.3010 in the same change, so the gain cannot be given back
      silently. The ratchet may never be lowered; `history` in
      `routing-coverage-seed.json` records the move and its reason.

      **One real defect surfaced here and was fixed rather than noted.** Phase
      1's loader read only the `queries` shape, so the 2 `should_trigger`-shaped
      files contributed ZERO cases while `check_routing_coverage` counted them
      as covered — the file existed, so the ratio said yes and the corpus said
      nothing. Both readers now handle both shapes, and a test in each pins it.

**Exit:** skill-scope ratchet strictly above its seed; every top-invoked skill
has a corpus file.

> **Cut line.** Stopping after Phase 2 is a VALID end state: D1 and D2 are then
> repaired on the gated surface. Phases 3-6 each carry their own justification
> and none is a dependency of the ones before it — an estate decision can park
> any suffix of them in `later/` without stranding work.

## Phase 3 — Catalogue-pressure suite (pre-registered null)

- [ ] **3.1 Selection accuracy as a function of catalogue size:** run the Phase
      2 corpus at N in {12, 20, 50, full} with distractor sets sampled
      deterministically (FNV-1a order, the same discipline as
      `rule_trigger_eval.ts:20-21`, `:147`).
      verify: the same seed reproduces the same distractor set across runs.
- [ ] **3.2 Near-duplicate probe:** for the top-invoked skills, inject one
      paraphrased description twin and measure confusion. **This step measures
      confusion only.** It is not a tiering justification — see 3.3.
      verify: the confusion figure is published per skill pair, with the twin
      text archived.
- [ ] **3.3 Resolve the pre-registered null:** "selection accuracy at full
      catalogue is not worse than at N=20 by more than the floor delta."
      **Reframed at landing.** The source made this null cancel tiering work
      ("no tiering work is justified by this suite"). It can no longer do that:
      tiering already shipped, for a different reason — the host listing budget,
      via `compute_skill_tiers.ts`. So this null now settles exactly one
      question, the confusion measurement, and cancels nothing. If it holds,
      record it and stop. If it breaks, the result feeds the archived MCP
      roadmap's routable-skills-per-standing-token measurement rather than
      duplicating it.
      verify: one full pressure run archived with the null verdict either way,
      and the verdict text does not claim authority over tiering.

**Exit:** one archived pressure run with a recorded verdict; no follow-up work
item created unless the null broke.

## Phase 4 — Delivery-path parity (actionable now)

- [ ] **4.1 Parametrize the Phase 2 corpus over delivery path:** host-native
      listing versus MCP-tool listing. Same prompts, same floors. Both paths
      exist in the tree today (D4), so this step has no external dependency.
      verify: one corpus file runs on both paths and produces two comparable
      result rows.
- [ ] **4.2 Parity gate:** MCP-path recall may not undercut native-path recall
      by more than a pre-registered epsilon on the same corpus. A breach blocks
      any MCP default-on decision; default-off holds until then.
      verify: a synthetic recall gap larger than epsilon turns the gate red.
- [ ] **4.3 Publish the parity table** as evidence against the archived MCP
      roadmap's measured-null outcome, not as a separate claim.
      verify: the table cites the archived roadmap and adds no new claim id.

**Exit:** parity table exists for the full Phase 2 corpus on both paths.

## Phase 5 — Production traces close the loop

- [ ] **5.1 Harvest routing events from own sessions** via the existing hook
      dispatch (skill invoked, prompt text, catalogue hash) into a LOCAL,
      gitignored ledger. Prompt text stays local because 5.2 needs it verbatim;
      anything that leaves the machine carries hashes only. Batch-read, no
      runtime daemon.
      verify: the ledger path is gitignored; an export contains no free text.
- [ ] **5.2 A drain command proposes corpus candidates** from traces where a
      skill was invoked but its corpus has no matching positive (recall blind
      spots) — maintainer-confirmed before landing.
      verify: one real drain session produces at least one candidate, and an
      unconfirmed candidate cannot land.
- [ ] **5.3 Regression states on the frozen 0.2 baseline:** PASSED,
      ROUTING_CHANGED, REGRESSION — only REGRESSION (floor breach) gates.
      verify: three fixtures, one per state.
- [ ] **5.4 Proxy-fidelity report:** for prompts appearing in BOTH the trace
      ledger and the Phase 2 corpus, compare the checker's would-load verdict
      against what the session actually consulted. If it degrades, the Phase 1
      gate's verdicts are downgraded to advisory until repaired.
      verify: one report published; the downgrade path is executable and
      demonstrated on a synthetic degradation.

**Exit:** ledger populated from at least one real drain session, one
proxy-fidelity report published, at least one trace-sourced corpus candidate
landed or rejected with a reason.

## Phase 6 — Repetition and variance (live path only)

- [ ] **6.1 Add a repetition parameter to the live harness** (default 3 per
      case, canary only) and report trigger RATE rather than binary fire.
      verify: a single case run twice reports a rate, not a boolean.
- [ ] **6.2 Floors move from "fired" to "rate >= x"**, with x pre-registered
      per tier.
      verify: the 0.1 contract carries the restated floors before the first
      rate-gated run.
- [ ] **6.3 Cost note in the run report.** If the 3x cost breaks the canary
      budget, halve the rotation cap before touching repetition — coverage
      breadth via the ratchet matters more than per-case confidence.
      verify: the report carries a cost line; the rotation cap is the documented
      first lever.

**Exit:** floors restated as rates in the pre-registration, one canary cycle
completed at the new measurement.

## What this roadmap does NOT do

- No new runtime component; everything is CI, canary, or batch-read.
- No repeal of the advisory boundary for full-catalogue live runs.
- No claim that tiering or MCP delivery is better — Phases 3 and 4 exist to test
  those claims, with recorded nulls as acceptable outcomes.
- No cross-model claim, and no unparking of the cross-model roadmap.

## Blockers

None. Every phase runs inside an existing budget or an existing workflow class,
and the one external dependency the source carried (the MCP delivery path) has
already shipped — see D4.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate measures a proxy, not the host | implementation | The checker asks a model what it would load; real hosts weigh system context and may skip a skill they can handle inline, so a green gate may not mean working routing | Limitation stated in the module docstring and the contract (1.4); proxy fidelity is a measured quantity with a downgrade-to-advisory path (5.4) | Phase 1 — A description-surface gate that PRs can afford |
| 2 | Live spend on a per-PR path | implementation | A description-diff gate that calls a model on every PR could break the canary budget | Diff-scoped to description edits on same-repo branches only; cache keyed on catalogue-hash and prompt short-circuits to zero spend (1.1b, 1.2) | Phase 1 — A description-surface gate that PRs can afford |
| 3 | Corpus growth stalls at a token handful of skills | product | 299 skills against a 26-case floor is the defect; a corpus that grows by three files changes nothing | Ratchets seeded at the measured value fail only on decrease, making partial progress durable (0.3); priority order derived from telemetry, not taste (2.2) | Phase 0 — Pre-registration and baseline capture |
| 4 | Floors get raised to fit a change | implementation | A floor edited in the same PR as the thing it measures makes the gate decorative | 0.4 forbids it explicitly and derives every floor from the 0.2 baseline; the ratchet disposition is decrease-only | Phase 0 — Pre-registration and baseline capture |
| 5 | Trace ledger leaks prompt text | product | 5.2 needs prompts verbatim, so the ledger holds free text by design | Ledger is local and gitignored; anything leaving the machine carries hashes only, asserted by an export test (5.1) | Phase 5 — Production traces close the loop |
| 6 | Parity work drifts into a cross-model claim | product | Phase 4 compares delivery paths, which is one step from comparing models, a claim another roadmap owns | Scope stated twice (What this roadmap does NOT do, and the ownership note); 4.3 forbids a new claim id | Phase 4 — Delivery-path parity (actionable now) |

## Acceptance Criteria

- [ ] AC-1 — The pre-registration, the frozen baseline and both ratchets exist
      and predate the first Phase-1 commit in history.
- [ ] AC-2 — `description_route_check` runs on the full catalogue with a
      no-spend dry-run backend, and a repeated prompt-catalogue pair costs zero
      calls.
- [ ] AC-3 — The diff-scoped pre-merge gate blocks a description edit that
      breaks a positive, warns on a near-miss that starts loading, and leaves
      fork PRs on the advisory path — all three demonstrated.
- [ ] AC-4 — The skill-scope coverage ratchet stands strictly above its seed,
      and every top-invoked skill has a corpus file meeting the discipline.
- [ ] AC-5 — The Phase 3 null carries an archived verdict in either direction,
      and its text claims no authority over tiering.
- [ ] AC-6 — A parity table exists for the full Phase 2 corpus on both delivery
      paths, citing the archived MCP roadmap rather than raising a new claim.
- [ ] AC-7 — One proxy-fidelity report is published, and the
      downgrade-to-advisory path has been demonstrated on a synthetic
      degradation.
- [ ] AC-8 — Every floor is restated as a rate in the pre-registration before
      the first rate-gated canary cycle.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| D4 framing | "The delivery path is **about to** bifurcate, the tests are not" | "The delivery path **has** bifurcated, and the tests have not followed" | It already has. `archive/road-to-skill-delivery-over-mcp.md` is archived at `status: ready`, 22 of 25 done with 3 transferred, closed 2026-08-23 with outcome `measured-null`; `suggest_skill_for_task`, `compute_skill_tiers.ts` and `_lib/skill_catalogue.ts` all ship. |
| Phase 4.1 hedge | "once the MCP delivery roadmap ships the tool the default install registers — its own deliverable, phase numbering owned there" | Deleted; Phase 4 retitled "actionable now" | The dependency it deferred to is already satisfied. Keeping the hedge would have parked an actionable phase behind a completed roadmap. |
| D2 counts | 26 cases / 119 rules / 291 skills | 26 / **120** / **299** | Re-counted at HEAD: `ls -d src/rules/*.md` = 120, `ls -d src/skills/*/` = 299. The substance is unchanged and the ratio is **worse** than the source recorded. |
| D3 wording | "Zero hits for distractor/catalog-size testing … (the two grep hits are unrelated retrieval scripts)" | Rewritten to distinguish *reported* from *swept*, naming every matching file | The original read as "nothing matches", which is false and would have been refuted by the first grep. Nine `catalogue_size` hits exist in `src/scripts/`; the true finding is that all of them report or measure divergence, and none conditions selection accuracy on it. |
| Phase 3.3 framing | "If the null holds, record it and stop — no tiering work is justified by this suite" | Reframed as a confusion measurement that cancels nothing | Tiering already shipped for an unrelated reason (host listing budget, `compute_skill_tiers.ts`), so this null can no longer cancel it. Left as written, a held null would have read as retroactive evidence against shipped work. |
| Phase 3.2 scope | Implicitly a tiering input | Stated as "measures confusion only" | Same reason, applied at the step that feeds 3.3. |
| Routing-matrix count | "95 files" | 94 fixture YAMLs plus a README (95 directory entries) | `ls tests/eval/routing-matrix/` returns 95 names, of which one is `README.md`. "95 fixtures" would have overstated the corpus by one. |
| `status` | `draft` | `ready` | The landing brief adjudicated this file ready. All eleven citations re-resolve at HEAD and the one external dependency has shipped, so nothing remains conditional. |
| Frontmatter | No `owner`, no `review_by` | Both added | Required by the budget-ownership pattern for a non-draft roadmap. |
| External-source table | `[EXT-1]`–`[EXT-4]` with vendor names and URLs | Removed; the evidence is carried as this repository's own measurements | Per `src/rules/source-confidentiality.md`, derivation-attribution does not belong in tracked text. Every claim retained above is verified against this tree; no retained claim depended on an external citation. |
| Provenance block | "Drafted 2026-08-23 outside the repo, against the tree at `0add4611`" plus an estate-budget caveat | Replaced by a `Source:` pointer and the `estate_offset_exempt` key | The estate question is answered by the frontmatter key, not by prose; the pinned-commit caveat is superseded by re-verification at HEAD. |

**Verified at landing, not inherited.** Re-resolved in this worktree:
`trigger_coverage.ts:10`, `lint_skill_descriptions.ts:6-7`,
`rule_trigger_eval.ts:4`, `:28-29`, `:31`, `:32-33`, the 26/120/299 counts, the
95 routing-matrix directory entries, the two `distractor` files, the nine
`src/scripts/` `catalogue_size` hits and their three files, the absence of any
repetition parameter in `skill_trigger_eval.ts` (1064 lines; only `String.repeat`
matches), and the archived state of all four cited roadmaps.

**One anchor was NOT re-verified** and is carried forward from the source:
`tests/reasoning-layer-eval/RESULTS-trigger-2026-06-16.md:15-18` (the
"precision-perfect, recall-collapse" headline). It is a dated results artefact
rather than live code, so line drift there would not change D2's substance —
but the citation is inherited, not re-read, and is flagged here rather than
presented as checked.
