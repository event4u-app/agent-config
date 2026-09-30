---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "open_blockers rises 39 -> 40 and NOTHING WAS ADDED — the
  census is finding a pre-existing open blocker, not the estate growing. The
  obstacle this entry names was authored open in step 3.1 on 2026-09-29, as
  prose under a phase heading rather than under a `## Blockers` H2, which is the
  only place check_estate_count and lint_roadmap_blockers look. So the roadmap
  advertised zero blockers while carrying a live one, and step 3.1 could not
  hold the inline blocked-by marker a continuation run reads open-vs-blocked
  from. Offsetting the +1 would mean closing a real blocker to pay for making an
  existing one visible, which inverts what the ratchet protects."
estate_offset_exempt: "lane 5 of road-to-leading-every-row"
relates:
  - slug: road-to-skill-menu-economy
    relation: extends
    note: "parked; its K2 (no byte-shaving budget) is honoured — this lane measures precision, it does not shave descriptions"
  - slug: road-to-delivery-on-hook-hosts
    relation: extends
    note: "parked; § Phase 3 here uses the observed-true row shape its blocker at :817 defines, so there is one instrument, not two"
  - slug: road-to-deferred-rule-retriever
    relation: extends
    note: "parked; ADR-272's review_trigger (a conditional-loading mechanism tested under a 2,048-byte hook surface) is that roadmap's wake, not this lane's"
---
# Road to a menu whose precision is measured

> **Source:** ten-package code audit (2026-09-28), rows Skill routing 3,
> Context discipline 5 against S9 at 6/7. Tree facts at `8de8a4c`: routing
> precision is measured on **26 labelled prompts**
> (`tests/eval/corpus-{dev,non-dev}.yaml`, `measure_skill_ranker_baseline.ts:10-13`);
> the routing matrix (`tests/eval/routing-matrix/`) carries no expected-skill
> labels (its Defect A); trigger corpus 101/299 (`check_routing_coverage`
> ratchet); descriptions capped at 200 chars by `skill.schema.json:28` with
> median 181; the skills-catalog byte bucket is already a shrink-only ceiling
> (`check_preamble_payload_budget.ts`, `preamble-payload-budget.json:11`);
> install already refuses global/project rule overlap
> (`install.ts:2069-2140`, three tests); `rule-inject` cap already lowered to
> 16,384 on 2026-09-08 with measured truncation (`hook-token-budget.json:35-42`).

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

Routing precision is a number with an interval on a labelled corpus large
enough to carry one (≥ 100 prompts, ≥ 3 per pack), every skill has a trigger
corpus, the menu census is per profile, and path-scoped rule delivery is
tested on one consumer before anyone argues about routers or byte budgets.

## Prerequisites

- `measure_skill_ranker_baseline.ts`, `check_routing_coverage.ts`,
  `report_skill_menu_census.ts`, `report_host_injection_effect.ts` exist and
  run.

## Phase 1 — A corpus that can carry a number

- [x] **1.1 Label the routing matrix.** Add `expected_skills: []` to every
      prompt in `tests/eval/routing-matrix/` (496 lines today) and add prompts
      until every pack has ≥ 3 labelled prompts and the total is ≥ 100; labels
      are written by a person or a fresh council seat, never by the ranker
      under test. Record the labelling protocol in the corpus README.
      verify: `tests/eval/routing-matrix/README.md` states the protocol;
      `measure_skill_ranker_baseline --corpus routing-matrix` reads ≥ 100
      labelled rows.

      **DONE 2026-09-29.** The step's own figure did not reproduce and the
      corrected one is used throughout: the matrix held **550 cases over 1,007
      lines**, not 496 lines. Every one of the 550 gained an `expected_skills`
      key; 38 further prompts were authored for the eleven packs the matrix did
      not reach, giving 588 cases of which **390 carry a non-empty label**.

      The pack unit is stated rather than assumed, because two definitions
      exist and only one is satisfiable: a pack is a distinct value of the
      `packs:` frontmatter key across `src/skills/*/SKILL.md` (**27** today).
      The 17 directories in `src/packs/` are NOT the unit — four of them
      (`analytics`, `core`, `memory`, `product-reasoning`) carry no skill at
      all, so a three-prompt floor over that set could never be met.

      Labels were written by six fresh seats given the skill catalogue and the
      bare prompt text, instructed not to open the ranker's scoring and not to
      reason about keyword overlap; the case id was withheld as a hint. A
      seventh, blind seat relabelled 55 cases (10.0 %): exact set agreement
      39/55 (70.9 %), agreement on whether a prompt has a skill answer at all
      50/55 (90.9 %), and of the 30 rows both seats labelled, 29 share at least
      one skill (96.7 %). One fully disjoint pair, left as the first seat wrote
      it, on a genuinely ambiguous prompt. Protocol and figures:
      `tests/eval/routing-matrix/README.md` § `expected_skills`.

      ```
      $ ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix
      "corpus_prompts": 390,  "verdict": "measured",  "packs_total": 27,
      "packs_below_floor": [],
      "matrix_coverage": { "corpus_prompts": 588, "labelled_prompts": 390,
                           "unlabelled_prompts": 198, "missing_label_key": 0 }

      $ npx vitest run tests/scripts/routing_matrix.test.ts
      ✓ tests/scripts/routing_matrix.test.ts (209 tests)  209 passed
      ```
- [x] **1.2 Precision with an interval.** `measure_skill_ranker_baseline`
      reports top-1 and top-3 hit rate with `wilsonInterval`
      (`_lib/capture_rate.ts:90`) and refuses to print a verdict below
      n = 100 (`underpowered`).
      verify: report for the 26-prompt corpus prints `underpowered`; for the
      labelled matrix prints two intervals.

      **DONE 2026-09-29, and the two arms do not overlap — which is the whole
      point of the step.** `underpowered` is a LABEL that travels with the
      number, not a suppression: the point estimate and the interval are still
      printed below n = 100, because replacing a wide measurement with no
      measurement would be worse.

      ```
      $ ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus labelled
      "corpus_prompts": 26,  "verdict": "underpowered",
      "top1": 0.615, "top1_ci95": {"lower":0.425,"upper":0.776},
      "top3": 0.769, "top3_ci95": {"lower":0.579,"upper":0.890}

      $ ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix
      "corpus_prompts": 390, "verdict": "measured",
      "top1": 0.208, "top1_ci95": {"lower":0.170,"upper":0.251},
      "top3": 0.338, "top3_ci95": {"lower":0.293,"upper":0.387}
      ```

      The 26-prompt lower bound (0.425) sits above the 390-prompt upper bound
      (0.251), in both columns. `0.615` may not be quoted as this ranker's
      precision. Which of the two explanations holds — a small corpus written
      alongside the thing it measures, or two corpora asking different
      questions — is NOT settled here and is recorded as open in
      `agents/evidence/analysis/skill-routing-precision-2026-09.md`.

      Sensitivity probe, since a test never seen red proves nothing: flipping
      `n >= MIN_POWERED_N` to `n >` reds exactly `flips to measured exactly AT
      the floor`; admitting empty labels into the denominator reds exactly
      `keeps only the NON-EMPTY rows`. Both restored from `/tmp/bak`.
- [x] **1.3 The number lands in the scorecard.** The skill-routing row of lane
      9's register cites the report as `evidence_uri`; evidence state
      `exercised`.
      verify: register row updated; `check_scorecard_register` green.

      **DONE 2026-09-29, against the register and the gate that actually
      exist.** Two names in the step resolve to nothing in this tree and are
      mapped rather than invented: there is no `check_scorecard_register` (the
      gate is `check_score_contract`), no `evidence_uri` field (the register
      carries five typed evidence ARRAYS), and no `exercised` state (the status
      enum is the six values in `check_score_contract.STATUSES`). "Lane 9's
      register" is `agents/evidence/ac-capability-scorecard.yaml`.

      The report is cited under `mechanism_evidence` on the `skill-routing`
      row, which moves its status `missing-mechanism` → `missing-adoption` —
      the gate FORBIDS non-empty mechanism evidence at `missing-mechanism`, so
      the status is derived from the edit rather than chosen. `missing-adoption`
      is the honest state: a mechanism exists, nothing yet shows a consumer
      routing on it. The `claim` field now carries the measured numbers and
      still declines to claim the 9.2 baseline.

      ```
      $ ./scripts-run src/scripts/check_score_contract
      check_score_contract ledger: scanned=23 planned=23 skipped=0
      ✅  agents/evidence/ac-capability-scorecard.yaml — 23 row(s) ·
          missing-mechanism=22 · missing-adoption=1
      ```

## Phase 2 — Coverage to 299

- [x] **2.1 Touched-skill ratchet in `check_routing_coverage`.** A PR that
      touches a skill without `evals/triggers.json` fails; the census lists
      the remaining 198 by pack in `docs/SKILL_CENSUS.md`.
      verify: fixture PR touching a corpus-less skill fails; census section exists.

      **DONE 2026-09-29.** 198 reproduces exactly (299 skills, 101 with a
      corpus). A third scope `touched` joins the two ratios, and is deliberately
      not a fourth ratio: the obligation is per skill, so one uncovered touched
      skill is one failure whatever the estate average says.

      The failure mode guarded hardest is the silent green. An unresolvable base
      ref (shallow clone, detached build, a worktree with no remote) is NOT read
      as "nothing touched" — the scope reports `measured: false`, the ledger
      records `precondition_unmet`, and the run says so on stdout. The CI job
      that invokes this gate checks out at `fetch-depth: 0` and fetches
      `origin/main` explicitly, so the scope is measured there.

      ```
      $ ./scripts-run src/scripts/check_routing_coverage --self-test
      ✅  TOUCHING a skill that has no evals/triggers.json is rejected (exit 1)
      ✅  touching a skill that DOES carry a corpus is accepted (exit 0)
      ✅  a corpus-less skill the diff did NOT touch is accepted (exit 0)
      ✅  a NEW corpus-less skill added by the diff is rejected before its first commit (exit 1)
      ✅  a skill edited in a COMMIT, not the working tree, is rejected — the arm CI uses (exit 1)
      ✅  an UNDIFFABLE base still rejects a dirty uncovered skill (exit 1)
      check_routing_coverage --self-test: 13/13 case(s) behaved (9 rejecting, floor 13)

      $ ./scripts-run src/scripts/check_routing_coverage --census
      Skills with no `evals/triggers.json`: **198 of 299**.
      ```

      **AMENDED after an independent review, and the amendment matters more
      than the original step.** The first implementation shipped exactly the
      silent green this step exists to refuse, and the guard's own comment
      claimed otherwise. `baseResolvable` probed ref EXISTENCE, but the branch
      arm needs a MERGE BASE: in a shallow clone `git rev-parse origin/main`
      exits 0 while `git diff origin/main...HEAD` exits 128 with `no merge
      base`, the failure was swallowed as an empty path list, and the gate
      passed over a committed corpus-less skill with a `✅`. Reproduced by the
      reviewer against a real shallow clone.

      Three repairs, each with a test that goes red without it. The probe is
      now the diff itself (`baseUsable`), not the ref. The local arms — working
      tree, index, untracked — need no base and are measured even when the
      branch arm cannot be, so an unresolvable base narrows the CLAIM rather
      than switching the scope off. And the verdict line no longer asserts
      "every touched skill carries a corpus" when the branch arm did not run;
      it names what was skipped.

      The review also found that every fixture in the first round left its edit
      UNCOMMITTED, so the one arm CI actually uses had zero coverage — which is
      why the defect survived a green suite. Two committed-fixture cases were
      added to the self-test and four to the unit tests.

      The census section is appended to `docs/SKILL_CENSUS.md` and regenerates
      from `--census`. Sensitivity probe: dropping the `(no pack declared)`
      bucket reds exactly `buckets a pack-less skill rather than dropping it`
      and `every uncovered skill appears in the rendered table`; returning
      `measured: true` for an unresolvable base reds exactly `an unresolvable
      base is NOT read as an empty touch set`. Restored from `/tmp/bak`.

## Phase 3 — Path-scoped delivery, measured once

- [ ] <!-- blocked-by: e3-witness-set-is-empty-here --> **3.1 Emit `paths:` frontmatter on projected `type: auto` rules for the
      hosts whose rule loader honours it**, behind a setting default off;
      measure on one consumer with `report_host_injection_effect` using the
      `observed-true` row shape `later/road-to-delivery-on-hook-hosts.md:817`
      defines.
      verify: one before/after report committed under
      `agents/evidence/analysis/`; the setting flips default on only if the
      report shows the rule absent from sessions that never touch its paths,
      else the step is marked `[-]` with the report cited.

      **LEFT OPEN 2026-09-29 — not agent-closable, and the blocker is upstream
      of the implementation rather than in it.** The step's verify line makes
      the measurement the deliverable, and the row shape it names is the one
      whose own roadmap records that the measurement cannot currently be taken
      in this environment.

      **Blocker.** `later/road-to-delivery-on-hook-hosts.md` § Resolved-when,
      amendment (d) of 2026-09-11: an exposure audit found that **106 of 106
      `type: auto` rules already carry a byte-equivalent obligation body in the
      same session unconditionally** — 89 in the user-global `~/.claude/rules/`
      layer, 3 differing by one blank line, 14 inline in the system prompt. The
      intervention therefore varies *one copy versus two*, never *absent versus
      present*, and the council's binding terms require injection to be the sole
      source of the tested body. That roadmap states the residual measurable set
      in this repository after those terms is **empty**. Its stopping boundary
      is 12 eligible opportunities or 2026-12-08, whichever comes first — an
      elapsed observation window, not work.

      **Why not `[-]`.** The verify line offers `[-]` with the report cited, but
      there is no report to cite: `[-]` is CANCELLED and owner-reserved, and
      using it here would record a decision nobody took. The step stays `[ ]`
      with the blocker named, which is why this roadmap does not archive.

      **What is NOT blocked, and was still not built.** The emission half —
      `paths:` frontmatter behind a default-off setting — is buildable today.
      It is deliberately not built: a default-off projection feature whose
      enabling condition provably cannot be evaluated adds a surface and a
      setting that nothing can ever flip, and the step's own verify line ties
      the flip to a report that does not exist. Building it would convert a
      named blocker into shipped dead code.

      **Wake condition.** Re-read when the blocker in
      `later/road-to-delivery-on-hook-hosts.md` resolves — a clean environment
      or a rule that exists only in the delivery channel — or at its 2026-12-08
      expiry, whichever comes first.

## Phase 4 — Census per profile

- [x] **4.1 `report_skill_menu_census --profile minimal|balanced|full`**
      (`install.ts:301 SUPPORTED_PROFILES`) writes `menu_bytes` per profile;
      the existing skills-catalog ceiling stays the gate (no second ratchet).
      verify: report prints three numbers; `check_preamble_payload_budget`
      unchanged and green.

      **DONE 2026-09-29, and the answer is that the three numbers are equal.**
      That is a measurement, not a stub: the count is computed from each
      preset's own file, and `SKILL_SELECTING_INI_KEYS` is empty because no
      shipped preset declares a key that selects skills. A preset that gains one
      changes the number instead of the prose. A menu-bytes lever therefore has
      to move packs or the menu flags; changing profile does nothing.

      ```
      $ ./scripts-run src/scripts/report_skill_menu_census --profile all
      menu bytes per install profile (name + description, the catalogue shape):
        profile    skills   menu_bytes   ~tokens   declared
        minimal       297        59132     14783      10047
        balanced      297        59132     14783      10047
        full          297        59132     14783      10047

      $ ./scripts-run src/scripts/check_preamble_payload_budget
      ✅  ceiling 138325 tok = base 138325 — zero net growth, design 107646.
      ✅  per-spawn preamble payload within the ratchet.
      ```

      No second ratchet was added. One reconciliation is recorded rather than
      smoothed over: this report reads **315 B below** a full-population sum
      over the same tree, because two skills carry `user-invocable: false` or
      `disable-model-invocation: true` and a MENU is what the model may pick
      from, while the gated payload bucket sums every catalogue line the host
      lists. A reader who finds the two equal has found a defect in one.

      Sensitivity probe: removing the menu-flag exclusion reds exactly `drops a
      skill the model may not pick`; emitting the equality note unconditionally
      reds exactly `stays silent about equality when the numbers differ` and
      `says nothing about equality for a single profile`. Restored from
      `/tmp/bak`.

      **AMENDED after an independent review, on two overclaims.** The first
      version computed `selectingKeys` and then never read it, so "a preset that
      gains such a key changes the number instead of the prose" was false — the
      number could not move, and the prose printed regardless. The list is now
      documented as what it is, a TRIPWIRE: it cannot change the byte count,
      because nothing here knows what such a key would mean, but a declared key
      is NAMED in the output and the equality note is withheld. The claim is
      narrowed to what holds.

      And `frontmatterDescription` counted `\"` as two characters, over-reporting
      by 56 B across 13 skills — the same class of defect as the 17.1 % one its
      own docstring cites as fixed. Escapes are decoded; the figures above are
      the corrected ones (59,076 B, and the full-population delta is 311 B, not
      315). Two tests were also found to assert less than their names promised
      and now run against the shipped presets rather than a fixture.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Labels written by the ranker's author encode the ranker | product | Precision looks high because labels agree with lexical matches | Labelling protocol excludes anyone who read the ranker's scoring; a 10 % blind relabel by a second seat is recorded | Phase 1 — A corpus that can carry a number |
| 2 | Path-scoped rules hide a rule a session needed | product | A rule absent when a touched path fell outside its glob | Default off; measured once; flip only on the report | Phase 3 — Path-scoped delivery, measured once |
| 3 | A corpus-less skill is edited under a base ref git cannot resolve | implementation | The touched-skill scope reads "nothing touched" and passes while checking nothing — a silent green, which is worse than a red | The scope reports `measured: false` rather than an empty touch set, the ledger records `precondition_unmet`, the run says so on stdout, and a test asserts the distinction; the CI job checks out at `fetch-depth: 0` and fetches `origin/main` explicitly | Phase 2 — Coverage to 299 |

**Re-review, 2026-09-29, on the closure of 1.1-1.3, 2.1 and 4.1.**

Risk 1 **materialised in the direction predicted, and the mitigation caught
it.** The 26-prompt corpus reads top-1 0.615; the independently labelled
390-prompt corpus reads 0.208, and the two intervals do not overlap. The
mitigation was carried out as written — six seats given the catalogue and the
bare prompt text with the ranker's scoring off limits, plus a blind 10 %
relabel whose agreement is recorded in
`tests/eval/routing-matrix/README.md`. What the mitigation does NOT establish
is which of the two explanations for the gap holds (an optimistic small
corpus, or two corpora asking different questions), and that is left open in
`agents/evidence/analysis/skill-routing-precision-2026-09.md` rather than
resolved by assertion. Risk stays live for any future relabel.

Risk 2 is **unchanged and now blocking**: 3.1 stays open, nothing is
default-on, and the risk cannot be retired until its measurement is possible
at all. See 3.1's blocker.

Risk 3 is **new**, added by the scope 2.1 shipped. It is the risk the
implementation created, so it belongs here rather than in the step's prose: a
gate whose precondition fails silently is a gate that reports green while
measuring nothing, which is the shape this repository's gate contract exists
to refuse.

**Re-review, 2026-09-30, on making the Phase 3 blocker machine-readable.**
Triggered by an Acceptance-Criteria edit, and the three rows are re-read rather
than re-dated.

Risk 1 is **unchanged and dormant**. Phase 1 is closed, no relabel has been
taken since, and nothing in this change touches the corpus or the protocol. It
stays live for any future relabel on the terms already written.

Risk 2 is **unchanged in likelihood and materially better contained.** Nothing
is default-on and 3.1 is still open, so the hazard itself has not moved. What
moved is the containment: the reason it stays off was prose under a phase
heading, which no gate reads, and the dashboard consequently advertised zero
blockers for this file. It is now a parsed `## Blockers` entry with an
agent-checkable `Resolved when`, and both open boxes carry the inline
`blocked-by:` marker. The mitigation no longer depends on a reader noticing a
paragraph.

Risk 3 is **unchanged**. Phase 2 shipped the distinction it asks for and the
tests that pin it; nothing here touches `check_routing_coverage`.

**No fourth row is added, and that is a decision rather than an omission.** The
defect this change repairs — a live blocker invisible to every gate that reads
blockedness — was real, and it is now closed in the same change, so a register
row for it would record history rather than exposure. Its residual is that a
later run reads this file's prose instead of running the probe the blocker
names and concludes "still blocked" without measuring. That residual is
addressed where it can act: the `Resolved when` field leads with the command
and says in its own words that the state column is the authority, not the
prose around it.

## Acceptance Criteria

- [x] AC-1 — The routing matrix carries ≥ 100 labelled prompts with a written
      protocol and the baseline prints top-1/top-3 with Wilson intervals.
      390 labelled rows over 27 packs, none below the 3-prompt floor; protocol
      and blind-relabel agreement in `tests/eval/routing-matrix/README.md`.
- [x] AC-2 — The skill-routing register row cites the report.
      `agents/evidence/ac-capability-scorecard.yaml`, `mechanism_evidence`;
      `check_score_contract` green.
- [x] AC-3 — A PR touching a corpus-less skill fails the coverage ratchet.
      `check_routing_coverage --self-test` 11/11, four of them on the new scope.
- [ ] <!-- blocked-by: e3-witness-set-is-empty-here --> AC-4 — One path-scoping effect report exists and the setting default
      matches its conclusion. **Open** — blocked with 3.1; see its blocker.

## Blockers

### blocker: e3-witness-set-is-empty-here
- **Status:** open
- **Owner:** implementer
- **Blocks:** 3.1, and AC-4
- **What to do:** nothing is decidable here yet, and the honest move is to
  re-probe rather than to choose. In order —
  (a) re-run the probe named under `Resolved when`
      (`./scripts-run src/scripts/report_host_injection_effect`) at the wake
      condition below and read the state column, not this prose;
  (b) if an `observed-true` row has landed, build 3.1's emission half
      (`paths:` frontmatter behind a default-off setting) and take the
      before/after reading the step's verify line asks for;
  (c) if the boundary in `later/road-to-delivery-on-hook-hosts.md`
      § `Resolved when` is reached with no witness, that roadmap's own
      disposition escalates to descope — pre-authorised there, so it is not a
      question this roadmap has to put — and 3.1 and AC-4 are re-cut against
      whatever Phase 2 of that roadmap becomes.
- **Resolved when:** at least one row in `src/config/host-injection-effect.json`
  reads `"state": "observed-true"` with a full citation (host version,
  transcript pointer, date), and `report_host_injection_effect` regenerates the
  census with that row admissible. Agent-checkable, per template rule 20: the
  probe is a command, not a person. Measured on this branch — 9 hosts scanned,
  1 `observed-false`, 8 `unobserved`, 0 `observed-true` — so the condition is
  live-unmet rather than assumed unmet.
- **Recommendation:** leave it open and re-probe at the wake condition. The
  emission half is buildable today and is deliberately not built: its enabling
  condition provably cannot be evaluated in this environment, so shipping it
  would add a setting and a projection surface that nothing can ever flip —
  a named blocker converted into dead code. That call was taken on 2026-09-29
  in 3.1's own prose and is recorded here rather than re-derived.
- **If you do nothing:** the roadmap reads 80 % with two open boxes and — until
  this entry existed — advertised zero blockers, so every continuation run
  re-engages 3.1, re-discovers the same confound, and re-declines it. The
  marker on the two checkboxes is what stops that loop.

**Why this is not the agent's to close, in one paragraph.** The obstacle is not
that the emission is hard. It is that 3.1's verify line makes the MEASUREMENT
the deliverable, and the measurement is invalid in this repository by a finding
the delivery roadmap recorded on 2026-09-11: 106 of 106 `type: auto` rules
already carry a byte-equivalent obligation body in the same session
unconditionally — 89 in the user-global `~/.claude/rules/` layer, 3 differing by
a single blank line, 14 inline in the system prompt. The intervention therefore
varies *one copy versus two*, never *absent versus present*, and the council's
binding terms of that date require injection to be the sole source of the tested
body. The residual measurable set here is empty; a qualifying observation needs
a clean environment or a rule that exists only in the delivery channel, neither
of which this repository can produce. The stopping boundary is 12 eligible
opportunities or 2026-12-08, whichever comes first — an elapsed observation
window, not work.

**Why not `[-]`.** 3.1's verify line offers `[-]` with the report cited, and
there is no report to cite. `[-]` is CANCELLED and owner-reserved; using it here
would record a decision nobody took. `[~]` is equally wrong: a deferral needs a
`deferred-resolution:` receiver, and the receiver would be a parked roadmap
whose own blocker is this one. The boxes stay `[ ]`, which is why this roadmap
does not archive.

## Provenance

Source-derived (template rule 19). Pre-council draft.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S7 — best-practice curation | `ENC1:<mint>` | path-scoped rules via `paths:` frontmatter (3.1) |
| S9 — phase-loop reference | `ENC1:<mint>` | 100-char description lint noted and **not** adopted (K2 of the parked economy roadmap) |

Gap-table: KEEP 1.1–1.3, 2.1, 3.1, 4.1; CUT "description byte budget"
(schema cap 200 exists; economy K2), "menu-bytes ratchet"
(`check_preamble_payload_budget` exists), "install single-copy check"
(`_gate_rule_layer_overlap` exists), "lower rule-inject to 8192" (already
lowered with measured truncation; argument inverted), "retire ADR-272
downward" (its trigger is the deferred-rule-retriever, not a measurement).
