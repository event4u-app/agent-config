---
estate_offset_exempt: "A genuine addition, so this key is the right instrument here — unlike the twenty it was just removed from, which were already on main and not re-added by any diff. The gate charges per addition and this is one of three. No offset was available: nothing in the active tree is archivable, because the only roadmap at zero open steps carries two deferred items and roadmap-progress-sync Iron Law 3 requires its deferred-resolution gate to run before any archive; parking this one would bury a repair whose defect is measured and reproducible today. Charged as one reviewable line, per this gate own instruction."
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to requirements traceability minimal

> **Source:** agents/tmp.old/feedpack-points — a dropped inbox artifact
> proposing that a roadmap's requirements, acceptance criteria and evidence be
> linkable to each other. Every claim below was re-verified against the tree on
> 2026-08-22, and one of the findings turned out to be larger than the source
> stated and to cut both ways.

## Goal

A roadmap can optionally declare a requirement id, an acceptance id and
evidence refs, using grammars that already ship elsewhere in this tree rather
than a new vocabulary; and a listing gate can print the REQ-to-AC-to-EVIDENCE
table over the real roadmap corpus with the unlinked and unresolved counts
visible. When this is finished the question "is traceability worth enforcing
here" has a measured answer instead of an intuition — including the answer
"no", which is a legitimate outcome and has a live precedent.

## Context

**There is no requirement identifier anywhere in the execution contract.**
`src/agent-src/contexts/execution/roadmap-execution-contract.md` contains the
word "requirement" **zero** times. "acceptance" occurs **four** times — at
`:28`, `:34`, `:162` and `:200` — and all four mean *the user's acceptance of
the contract*, not an acceptance criterion. So nothing today ties a step to a
requirement, or an acceptance criterion to the evidence that discharged it.

**Two reusable grammars already ship, and neither needs inventing.**

1. **The claim-ledger slug form.** `docs/CLAIMS.md:33-40` defines
   `### claim: <kebab-id>` carrying `kind` / `evidence` / `status` /
   `last_verified`, with an optional `superseded_by` forward link. That is a
   working id-plus-lifecycle grammar for a corpus of assertions.
2. **Envelope `evidence_refs` as ref tokens, never bodies.**
   `src/scripts/_lib/subagent_response.ts:19` declares
   `evidence_refs?: string[]` on a finding, and `:88-90` rejects any element
   that is not a ref token — an entry containing a newline fails validation
   with `evidence_refs must be ref tokens, not bodies`. That is the pointer
   discipline this roadmap reuses verbatim.

**There is precedent for additive optional contract fields.** The same contract
carries `late_artifacts` as § 2a (`:102`) and `deferred_policy` as § 2b
(`:134`), both shipped in 14.8.0, both optional, both defaulting to the
conservative value. (A correction to the source draft, which placed both in
§ 2b.) So a third optional block is a shape the contract already has, not a new
kind of change.

**No such gate exists.** `ls src/scripts | grep -iE 'requir|trace'` yields
exactly three files — `check_skill_requires.ts`, `lint_explain_trace.ts`,
`print_required_checks.ts` — none of which reads a roadmap.

**The finding that is larger than the source stated, and it cuts both ways: NO
gate parses `verify:` structurally at all.** A grep for `verify:` across
`src/scripts/*.ts` returns, for roadmap purposes, exactly two hits — the
template prose emitted by `src/scripts/new_roadmap.ts:73`, and a comment at
`src/scripts/lint_evidence_artifacts.ts:272`. The remaining hits are unrelated
CLI-flag and fixture fields (`dispatch_r2_reviewer.ts:860` is the `--verify`
flag; `release_drill.ts` uses `verify` as a callback key). Both halves matter:

- **Nothing breaks.** An `[AC:<id>]` prefix on a `verify:` line cannot break a
  parser, because no parser reads those lines.
- **Nothing to build on.** There is also no existing extractor to extend, so
  the listing gate in Phase 1 writes the first structural reader of that
  annotation — and any claim about coverage rests entirely on it.

**The known failure mode has a live precedent, and it is registered as this
roadmap's falsifier.** `agents/roadmaps/later/road-to-plan-gates-measurement.md`
is parked precisely because its counter measured **0** — its own lines `:38`,
`:50` and `:188` record "Measured at parking time: 0", a trigger state of 0 of
10, and an advisory window of 0 of 10 gated PRs. A listing gate that lists
nothing is not a neutral outcome; it is that roadmap's outcome, arriving again.

## Phase 0 — Three optional fields and one annotation convention

> **Dogfooded here first, per step 0.3.** A convention its own author did not use
> is a convention nobody will. The rows below are this roadmap's own declaration,
> in the § 2c repeated-row form:
>
> ```yaml
> traceability:
>   - requirement_id: optional-fields-reuse-existing-grammars
>     acceptance_id: contract-names-both-source-grammars
>     evidence_refs:
>       - src/agent-src/contexts/execution/roadmap-execution-contract.md
>       - docs/CLAIMS.md
>       - src/scripts/_lib/subagent_response.ts
>   - requirement_id: listing-gate-cannot-fail-on-day-one
>     acceptance_id: exits-zero-on-a-dangling-ref
>     evidence_refs:
>       - src/scripts/check_requirements_trace.ts
>       - tests/scripts/check_requirements_trace.test.ts
>   - requirement_id: unresolved-count-is-a-number-not-a-verdict
>     acceptance_id: output-carries-integer-and-corpus-size
>     evidence_refs:
>       - src/scripts/check_requirements_trace.ts
>       - src/config/requirements-trace-budget.json
> ```
>
> Three rows and not three flat fields, because that is the shape § 2c settles:
> a flat collection is countable and not traceable.


- [x] **Step 0.1:** add `requirement_id`, `acceptance_id` and `evidence_refs`
      to the execution contract's § 2 as OPTIONAL fields, reusing the
      claim-slug kebab form for the two ids and the envelope's ref-token rule
      for `evidence_refs`. Absent means not declared, which is not the same
      claim as "there is no requirement".
      <!-- blocked-by: b-required-for-structural -->
      verify: `grep -c requirement_id src/agent-src/contexts/execution/roadmap-execution-contract.md`
      returns 1 or more, where the same grep against the `git show HEAD:` copy
      of that path returns 0.
- [x] **Step 0.2:** state the `[AC:<id>]` prefix convention for `verify:`
      lines, together with the verified fact that no gate parses those lines
      today — so a reader knows the convention is a new surface rather than an
      extension of an existing one.
      verify: the contract section names both the prefix form and the
      no-existing-parser fact; `./scripts-run src/scripts/lint_plan_risk_register`
      exits 0 afterwards.
- [x] **Step 0.3:** dogfood the three fields on this roadmap itself before
      asking any other roadmap to carry them. A convention its own author did
      not use is a convention nobody will.
      verify: this file's own § Phase 0 declares at least one
      `requirement_id`, and the value matches the claim-slug kebab pattern.

> **PHASE 0 LANDED 2026-08-22, and the SHAPE changed.** § 2c of the execution
> contract ships a **repeated trace row**, not the three flat fields step 0.1
> named:
> `traceability: [{requirement_id, acceptance_id, evidence_refs}]`.
> Both council seats made the same correction and it is the substantive one:
> with more than one requirement, more than one criterion and a shared pool of
> refs, three flat top-level fields are an ambiguous many-to-many — **countable
> but not traceable**. A gate over them reports a populated count while providing
> no dependable trace.
> Both grammars are reused as specified (claim-ledger kebab slug, envelope
> ref-token rule), and three things the step did not state are now stated because
> a slug grammar does not imply them: **namespace** (the roadmap file; two
> roadmaps may share an id for the same external requirement), **cardinality**
> (one row per requirement/acceptance pair), and **revision semantics** (refs are
> evaluated at the CURRENT head — so a completed roadmap can move from resolved
> to unresolved with no roadmap edit, which is the intended reading and is
> written down rather than discovered).
> `evidence_refs` are **syntactically safe tokens, not verified evidence** — the
> newline rule rejects bodies and says nothing about existence, scope or
> relevance.
> The `[AC:<id>]` convention and the no-parser fact are both recorded, and
> "gate" is disambiguated into its three senses with exactly listing and
> resolving shipping.

## Phase 1 — A listing gate and a growth-only ratchet

- [x] **Step 1.1:** ship `check_requirements_trace` as a **listing** gate:
      print a REQ-to-AC-to-EVIDENCE table over the active roadmap corpus with
      `unlinked` and `unresolved` columns, and exit **0 always**. A gate that
      can fail on day one reds the whole backlog, which is the failure this
      tree has already recorded once. <!-- ref-ignore -->
      verify: the script exits 0 on the current corpus AND on a fixture
      containing a deliberately dangling `[AC:…]` ref, and prints a non-empty
      table in both cases.

      **LANDED 2026-08-22.** `src/scripts/check_requirements_trace.ts`, exit 0
      always — including on a dangling `[AC:]` ref and on an empty corpus, both
      pinned by fixtures. **It exits 0 even on a DEAD SCAN SCOPE**, reporting the
      condition to stderr: turning that into a non-zero exit would make the
      listing a gate, which is the one thing it must not become.
      **Three populations, never summed** — `fixture` (synthetic, tests the
      reader, never counts toward adoption), `cohort` (frozen manifest, may
      include archived members, experimental history), `live` (active corpus,
      the compliance number and the only one a ratchet may read). The header says
      why: collapsing them is how a zero from non-adoption becomes
      indistinguishable from a zero from non-compliance.
      **A deliberately small reader, not a YAML parser.** The block may sit
      inside a blockquote — this roadmap dogfoods it that way — and a real parser
      would require the whole document to be YAML, which a roadmap is not.
      Registered in `gate-coverage.yml` (floor 15 against 25, because the estate
      is being drained deliberately and a tight floor would red on the drain
      working) and `taskfiles/ci-fast.yml`, with a `--self-test` so the
      non-adopter ratchet stays at its baseline of 24.
      **The self-test needed an argument, and it is recorded at the code:** a
      harness whose premise is "prove you can go red" meets a gate that cannot,
      so the one reject case is the harness's own truncation floor and the accept
      cases assert the reader DISCRIMINATES on its output instead. 10 unit tests
      besides.
- [x] **Step 1.2:** register a growth-only ratchet modelled on
      `src/config/estate-count-budget.json` — baseline is the MEASURED count at
      registration, never a target, with `owner` and `review_by` set, so the
      number can only walk down.
      verify: the new budget file carries `owner`, `review_by`, a `baseline`
      block and a `_comment` naming what the metric counts; and the recorded
      baseline equals what step 1.1's gate printed on the same commit.

      **LANDED** as `src/config/requirements-trace-budget.json` — `owner`,
      `review_by: 2027-08-22`, a four-key `baseline` (all **0**) and a `_comment`
      defining each key. Population is `live` only, and the file says why the
      other two are out of scope: a fixture is evidence about the reader, and a
      count over archived roadmaps cannot fall, which would make the ratchet
      meaningless.
      **The baseline's honest limit is recorded in the file itself:** four zeros
      over a corpus with **one** declarer cannot distinguish compliance from
      non-adoption — which is exactly the distinction Decision 2's separated
      falsifiers exist to keep apart.
- [x] **Step 1.3:** record the unresolved count as a number, not as a verdict.
      The point of the listing phase is the distribution, and a table summarised
      as "traceability is patchy" cannot be compared to the next reading.
      verify: the gate's output line carries an integer `unresolved` count and
      the corpus size it was computed over.

      **LANDED.** The line, verbatim from the run on this commit:
      `live: rows 3 · linked 3 · unlinked 0 · refs 7 · unresolved 0 ·
      ac_annotations 0 · dangling_ac 0 · malformed 0 · over 25 active roadmap(s),
      1 declaring`.
      Integers with the corpus they were computed over, and `1 declaring` beside
      `25` on purpose — a summary reading "traceability is patchy" cannot be
      compared to the next reading, and a rate without its denominator hides
      that adoption is one file.
      **`unresolved` moved during this change, which is the counter working.**
      It read **2** when the rows were first declared, because two of the seven
      refs pointed at the test file and the budget file before either existed;
      creating them took it to 0. Recorded because it is the only live
      demonstration in this roadmap that the number responds to the tree.

## Phase 2 — Dogfood on three real roadmaps, then decide

- [-] **Step 2.1:** carry the three fields on the two other roadmaps authored
      in this drain run — `road-to-subagent-envelope-adoption.md` and
      `road-to-code-graph-extractor-defect.md` — and on the active
      `road-to-subagent-lifecycle-integrity.md` Phase 2. Three real roadmaps,
      not four sibling drafts: three of the drafts the source draft assumed
      were dropped in this run and do not exist.
      verify: the gate's table lists all three files with a non-empty
      `requirement_id` column, and `unlinked` for those three rows is 0.
- [x] **Step 2.2:** read the `unresolved` count against the falsifier before
      proposing any enforcement. If the count over the dogfooded set is 0 and
      the count over the rest of the corpus is 0 because nothing declared the
      fields at all, that is the parked-precedent outcome and the honest move is
      to park this roadmap the same way.
      <!-- blocked-by: b-traceability-value-unmeasured -->
      verify: the recorded reading names both counts separately — dogfooded set
      and remainder — so a zero from adoption cannot be read as a zero from
      compliance.
- [x] **Step 2.3:** write the disposition down either way. A decision to park
      carries the measured counts and the condition that would reopen it; a
      decision to continue carries the count that justified it.
      verify: the disposition paragraph exists in this file and names an
      integer count; `./scripts-run src/scripts/lint_roadmap_blockers`
      exits 0.

## Phase 2 disposition — written down, per step 2.3

**The measurement was taken. Enforcement and the adoption conclusion are parked,
under separate named falsifiers, and the schema ships.**

Live reading on this commit: **rows 3 · linked 3 · unlinked 0 · refs 7 ·
unresolved 0 · dangling_ac 0 · malformed 0, over 25 active roadmaps, 1
declaring.**

**The two counts step 2.2 requires, reported separately** so a zero from
adoption cannot be read as a zero from compliance:

| Population | Declaring | unlinked | unresolved |
|---|---|---|---|
| Dogfooded set | **1** (this roadmap) | 0 | 0 |
| Remainder of the active corpus | **0** of 24 | 0 | 0 |

The remainder's zeros are **non-adoption**, not compliance. Nothing else declares
the fields, so there is nothing there to be compliant with.

**Judged against the four falsifiers, not against the one the roadmap proposed.**
Both council seats rejected reusing `road-to-plan-gates-measurement`'s
zero-adoption falsifier, and the reason is structural rather than a preference:
keeping the fields optional makes a zero-adoption falsifier **certain** to fire,
so that design creates the falsifier it exists to avoid.

- **No opportunity — FIRED.** Fewer than three eligible roadmaps entered the
  window. All three that step 2.1 named were archived by sibling PRs (#1542,
  #1538, #1532) in this same drain run, before any window opened. This parks the
  *adoption measurement*.
- **No adoption — FIRED.** Zero non-maintainer-prompted roadmaps adopted the
  fields; the single declarer is this mechanism's own roadmap. This parks
  *enforcement*, and explicitly **not** the schema.
- **Poor resolution — did NOT fire.** Resolution is deterministic, 10 unit tests
  and 5 self-test cases pass, and the counter was observed moving 2 → 0 on a real
  change.
- **No demonstrated value — NOT EVALUABLE.** No documented sample exists yet.
  Recorded as not-evaluable rather than as a pass or a failure.

**So: the schema and the inventory stay; the enforcing arm is not built and is
not scheduled.** That is not the parked-precedent outcome the roadmap braced
for — that precedent parked a *counter that measured nothing*, and this counter
measures three rows and responds to the tree. What is parked is the conclusion,
which is the honest scope of a corpus of one declarer.

**Reopening conditions, one per parked thing rather than one for all:** the
adoption measurement reopens when three or more eligible roadmaps are expected to
remain active across a window; enforcement reopens when at least one
non-maintainer-prompted roadmap adopts the fields. Neither reopens on a calendar.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The listing gate lists nothing and is kept anyway | product | Optional fields nobody declares produce an empty table, and an empty table reads as "clean" rather than as "unadopted" — this is exactly the parked precedent's outcome, arriving a second time with a different name | Step 2.2 requires the dogfooded count and the remainder count to be reported separately, and the blocker registers the parked roadmap as the explicit falsifier rather than as a cautionary aside | Phase 2 |
| 2 | The `[AC:…]` prefix becomes a de facto requirement without a decision | implementation | Once one gate reads the annotation, a later author adds a failing arm "for consistency", and an optional convention silently becomes mandatory for every roadmap including the 3 active and 57 parked ones | The gate is specified exit-0-always and is verified against a deliberately dangling ref; the required-for-structural question is held open in its own blocker rather than defaulted | Phase 1 |
| 3 | A new id vocabulary is invented instead of reused | implementation | Three fields is exactly the size at which inventing a private format feels cheaper than reading two existing ones, and the result is a third grammar for ids in a tree that already has two working ones | Step 0.1 names the claim-slug kebab form and the envelope ref-token rule as the sources, both with file and line, so a divergence is visible as a diff against a cited grammar | Phase 0 |
| 4 | The baseline is set as an aspiration rather than a measurement | implementation | A budget file whose baseline is a target reds on the day it lands and teaches readers to ignore it — the estate-count budget's own `_comment` records this as the reason it is measured-at-registration | Step 1.2 verifies the recorded baseline equals what the gate printed on the same commit, so an aspirational number cannot pass its own verify | Phase 1 |

## Acceptance Criteria

- [x] AC-1 — The execution contract carries `requirement_id`, `acceptance_id`
      and `evidence_refs` as optional § 2 fields, each pointing at the shipping
      grammar it reuses; and the contract states that no gate parses `verify:`
      lines today.
- [x] AC-2 — `check_requirements_trace` prints a REQ-to-AC-to-EVIDENCE table
      with integer `unlinked` and `unresolved` counts and the corpus size, and
      exits 0 on both the real corpus and a dangling-ref fixture. <!-- ref-ignore -->
- [x] AC-3 — A growth-only budget file exists with `owner`, `review_by` and a
      baseline equal to the gate's printed count on the registering commit.
- [-] AC-4 — Three real roadmaps carry the fields, and the recorded reading
      states the `unresolved` count for the dogfooded set and for the remainder
      separately — so an empty table from non-adoption is distinguishable from
      an empty table from compliance.

      **HALF MET, and the unmet half is not achievable in this run.** The
      separate-counts clause IS met — dogfooded set 1 declaring / 0 unlinked / 0
      unresolved, remainder 0 of 24 declaring — and the disposition says
      explicitly that the remainder's zeros are non-adoption rather than
      compliance, which is the distinction this criterion exists to force.
      **"Three real roadmaps" is not met: one does.** All three that step 2.1
      named were archived by sibling pull requests in this same drain run before
      any window opened. Marked `[-]` rather than `[x]`: reading "1 of 25
      declaring" as three real roadmaps would be the silent-green this roadmap's
      own falsifier discussion is written against. The council explicitly refused
      the alternative of *creating* roadmaps to satisfy it — a maintainer-authored
      fixture is evidence about the reader, not about uptake.
- [x] AC-5 — A disposition is written down naming an integer count: either
      continue, with the count that justified it, or park with the count and the
      reopening condition, following the parked precedent rather than quietly
      keeping an empty gate.

## Blockers

### blocker: b-traceability-value-unmeasured

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 2.2
- **Class:** 3
- **What to do:** pick exactly one — (a) accept
  `agents/roadmaps/later/road-to-plan-gates-measurement.md` as this roadmap's
  registered falsifier, so an `unresolved` count of 0 arising from
  non-adoption parks this roadmap the same way (that file records "Measured at
  parking time: 0" at `:38` and an advisory window of 0 of 10 at `:188`); or
  (b) declare a different falsifier with its own threshold and state why the
  parked precedent does not apply.
- **Recommendation:** (a). The precedent is not an analogy — it is the same
  mechanism, a counter over roadmap-shaped artefacts, measured at 0 and parked
  for that reason. Declaring a different falsifier means arguing that this
  counter will populate where that one did not, and there is no evidence for
  that argument yet.
- **If you do nothing:** Phase 2 reads an empty table as a clean result, the
  gate ships and stays green forever without listing anything, and the tree
  acquires a second counter that measures 0 next to the first.
- **Resolved when:** the falsifier is named at this blocker with its threshold,
  and step 2.2's reading is judged against it rather than against a narrative.
- **Resolution (2026-08-22) — (b), AGAINST this blocker's own recommendation, 2/2
  council** ([`traceability-blockers-2026-08-22.md`](../evidence/council/traceability-blockers-2026-08-22.md)).
  Both seats rejected reusing the parked precedent's zero-adoption falsifier, and
  the argument is structural rather than a preference: *"zero adoption does not
  falsify traceability value — it may indicate no opportunity, no incentive, poor
  documentation, or a measurement system that never operated."* One seat named
  the destructive loop plainly: keeping the fields optional makes a
  zero-adoption falsifier **certain** to fire, so the design creates the
  falsifier it exists to avoid.
  **Four falsifiers replace the one, and they park different things:** *no
  opportunity* (fewer than three eligible roadmaps enter the window) parks the
  adoption MEASUREMENT; *no adoption* (zero non-maintainer-prompted roadmaps)
  parks ENFORCEMENT and never the schema; *poor resolution* (non-deterministic,
  or over 20 in 100 manually-checked classifications false) parks the RESOLVER;
  *no demonstrated value* (a documented sample shows no concrete reviewer use)
  triggers removal or redesign.
  **Read on this commit:** the first two FIRED, the third did not, the fourth is
  not evaluable. So enforcement is unbuilt and unscheduled, the adoption
  conclusion is parked, and the schema plus the inventory ship. Each parked thing
  carries its own reopening condition, and none reopens on a calendar.

### blocker: b-required-for-structural

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 0.1
- **Class:** 3
- **What to do:** pick exactly one — (a) keep all three fields optional for
  every complexity, so `complexity: structural` roadmaps are under no
  additional obligation and Phase 0 ships a purely additive block; or (b)
  commit now to making them required for `complexity: structural` at a named
  later phase, and state which gate would enforce it.
- **Recommendation:** (a) for Phase 0, explicitly. Deciding requiredness before
  the listing phase has produced a single count is deciding it on intuition,
  and the additive-optional shape is the one `late_artifacts` and
  `deferred_policy` already established in the same contract section.
- **If you do nothing:** step 0.1 lands with the requiredness question
  unstated, and the first author to read the fields has to guess whether a
  structural roadmap omitting them is non-conforming.
- **Resolved when:** this blocker records (a) or (b), and if (b), names the
  phase and the enforcing gate.
- **Resolution (2026-08-22) — (a), 2/2 council.** All three fields stay optional
  for every complexity including `structural`; § 2c says so, and says that any
  later transition to required needs its own record and must not make existing
  roadmaps retroactively fail.
  **Both seats added that (a) alone is an incomplete decision**, and the addition
  is carried rather than noted: a slug grammar does not imply identity semantics,
  so § 2c now states the namespace (the roadmap file), the cardinality (one row
  per requirement/acceptance pair) and the rename policy (ids are
  content-addressed). Without those a second author cannot tell whether two
  roadmaps may share an id.
  **No enforcing gate is named because none ships.** The listing gate exits 0
  always, by design and by fixture — so requiredness has no mechanism behind it
  today, which is the state (a) describes rather than a gap in it.
