---
complexity: structural
execution:
  mode: autonomous
---

# Road to design-detector evidence — make the traceability claim checkable and publish the number the expansion was deferred on

> The slop registry's prose promises that every rule stays traceable to a
> catalog entry, and a recorded deferral gates any registry growth on a
> false-positive number nobody ever measured. This roadmap turns the first
> promise into a gate and produces the second number, then spends it on the six
> catalog entries that are objective enough to detect.

## Goal

Close three verified, package-internal defects in the deterministic design-slop
layer: the catalog↔rule traceability the registry header asserts is **enforced
by nothing**, the false-positive evidence a prior deferral demands but which no
instrument in the tree can produce, and the six catalog entries that are
threshold-defined, already prose-anchored, and still undetected. No external
mechanism is borrowed, no new consumer surface is added, and the
dependency-free constraint in `src/scripts/design_slop_rules.ts:12-18` is
inviolate.

## Provenance

Origin: an external analysis artifact dropped into the maintainer inbox
(`agents/tmp.old/design-layer-gains/`), verified claim-by-claim against
`origin/main` at `431f89ffa` before this file was written. The source drafted
its claims at `1432c7a4`; `git log 1432c7a4..HEAD -- <design surfaces>` is
**empty**, so nothing it asserted about the design layer was overtaken by later
work — every wrong claim was wrong when written.

Sources are referenced by neutral descriptor per
[`source-confidentiality`](../../src/rules/source-confidentiality.md); links are
maintainer-recoverable only.

| Ref | What it is | Link |
|---|---|---|
| Source A | a deterministic design-lint suite with a 59-rule registry | `ENC1:expwZE3+Jnmj2/U4JHoEmSc9T6gAnsy+OKvTI1bTGfvUauDmIlwb3jqAQFoMpaC9Zss35WbCkd6j7NF5tKA9uw==` |
| Source B | a corpus of per-brand DESIGN.md interpretations | `ENC1:IFvovsYyr6j2pOi+AYRVzGFewNLiqknpRvuEDAq+94D8xPG5jBO+nY6O/+1sVORUPdQy1hSldbkcoIQAYSo8fw==` |
| Source C | a monolithic taste skill with dials and a design-read line | `ENC1:rksq6rnPAjYJf58njlWubL7h60t18EH2nhv7j37cIsdFyIA8XcPA1zIOOWuE8kzCg6LOzP7NNCd6xHIfZu+7Qg==` |
| Source D | a live-site taste-extraction workflow, web-analyzed only | `ENC1:mxlFBUpvW+Q5UTDHsxODVHAZ4RZvTIrZfvslC4HBwmgKK4sLGGqzuqzlKpO8oSz73M3e6tBfNSfb+DP2dl6+Dg==` |
| Source E | a hosted component-acquisition MCP proxy | `ENC1:WQGHEnjimPcEXcPClJp4XRpHHLP2+x4Jk9vYmFyH+g3YkeHNog84TlCPECNie4lvylts/QKl2TMXK2abd6DSpQ==` |

## Context

The artifact proposed six phases built on the premise that this package's design
layer is under-resolved against external tooling. Verification against the
current tree refutes most of that premise, and the refutation is the reason this
roadmap is one fifth the size of the proposal.

**Corrections to the source, recorded rather than silently applied:**

1. **The registry holds 19 rules, not 20.** The source's count included the
   `SlopRule` interface field declaration at `src/scripts/design_slop_rules.ts:52`
   (`grep -c 'id:'` = 20; `grep -cE '^\s+id: "'` = 19). Every "20 → 45–55"
   arithmetic in the proposal is off at the baseline. The unit test's fixture
   record carries 19 entries and asserts one positive plus one negative per rule
   (`src/scripts/design_slop_rules.test.ts:149`), which is an independent
   confirmation.
2. **`target` is not a field** in the rule schema. The engine union is
   `"css" | "html" | "jsx" | "copy"` at `design_slop_rules.ts:30`; the proposal
   planned against a second field that does not exist.
3. **Half the proposed "ports" already ship as rules.** Eyebrow overuse is
   `slop-t4-eyebrow-overuse` (`:264`), numbered section markers are
   `slop-l4-numbered-markers` (`:322`), em-dash density is `slop-cp1-em-dash`
   (`:378`). Two more are deliberately judgment-only, not missing: the icon-tile
   stack (T3) and nested cards (V7) are excluded at
   `docs/guidelines/design-antipatterns.md:46-48` because DOM-structure analysis
   was measured too false-positive-prone for a deterministic pass.
4. **There is no external-reference ingest gap.** The
   `design-system.json` import contract exists, carries
   `typography.families` + `typography.scale`, and lists `source.kind: "url"`
   first (`src/skills/design-system-capture/references/design-system-json.md:13-20`).
   The proposal's `design-reference-import` skill would be a second import
   surface beside the one `road-to-design-system-onramp` Phase 1 already owns.
5. **The corpus is not "aesthetic families only".** `data/design-languages/modern-dark.txt`
   and `bauhaus.txt` carry per-role size, weight, line-height and letter-spacing.
   Only font-features are absent across all 16 specs.
6. **Dials, the Design Read line, and the motion decision-tree all shipped.**
   The dials are live end-to-end (`src/skills/design-intelligence/references/context-and-registers.md:63-96`,
   persisted at `src/skills/design-system-capture/SKILL.md:101`); the Design Read
   line is at `src/skills/fe-design/references/design-read-and-memory.md:32`;
   the motion craft layer is `src/skills/fe-design/references/design-patterns.md:153`
   under a different filename than the proposal assumed. Re-proposing the dials
   would be the **third** pass on one decision.

**What survives verification — the three defects this roadmap owns:**

- **G1 — the traceability claim is enforced by nothing.** The registry header
  states that every rule cites its catalog id so prose and rule stay traceable.
  Nothing resolves that id against `docs/guidelines/design-antipatterns.md`: the
  unit test validates the *shape* `/^[A-Z]+\d+$/` (`design_slop_rules.test.ts:144`)
  and never opens the document. A rule citing `Z99` passes today. No linter among
  the ~130 in `src/scripts/` reads the catalog — the three references to it in
  the tree are all code comments. The doc is currently correct, so this is a
  latent defect: the drift would be silent, and two rules already break the
  id-naming convention the other seventeen follow (`slop-lock-shape` → V8,
  `slop-lock-colour` → C6).
- **G2 — the deferral's precondition is unreachable.** Registry growth beyond
  the objective subset was deferred pending proof of "a low false-positive rate
  in real consumer use". The package has no consumer telemetry, so no work in
  any plan can produce that evidence; the deferral cannot lift by any path that
  exists. The per-rule negative fixture is a *presence* guard (does the rule stay
  quiet on one crafted clean snippet), not a false-positive **rate** on
  real-world clean UI. This is the same shape as the harvest freeze that
  [ADR-216](../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  re-anchored, one layer down and still unfixed.
- **G3 — six catalog entries are threshold-defined and undetected.** Of the 26
  V/C/T/L/M/CP entries without a rule, four are declared judgment-only, several
  need render or comparison, and copy phrase-lists are council-rejected. Six are
  left that are single-property CSS thresholds already stated numerically in the
  catalog: C3, T9, T10, M1, M3, V4.

**Why G3 is not blocked by the G2 deferral.** The deferral names its scope
explicitly — "spacing-multiples / font-weight-count / magic-numbers … design-system
opinions, not quality floors". The six entries below are none of those: each is a
threshold the catalog already publishes as a number, in the same class as the
rules that shipped. Per
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), the
mechanism-match check comes first, and this is a different mechanism from the one
the deferral tested. The distinction is recorded here rather than assumed.

- **Feature:** none
- **Jira:** none

## Gap table

Every row is a verdict on the source proposal. `CUT` rows carry the record that
decides them, so the next reader does not re-propose an item this tree has
already settled — three of them have been proposed more than once.

| Harvest item | Verdict | Where it lands |
|---|---|---|
| Catalog↔rule parity as a CI gate | KEEP — internal defect, nothing owns it | Phase 1 |
| Fix the two id↔catalog naming breaks | KEEP | Phase 1 |
| A measurable false-positive baseline | KEEP — makes a stuck deferral reachable | Phase 2 |
| Registry recall metric | KEEP — rides the existing fixture corpus | Phase 2 |
| Detectors for C3, T9, T10, M1, M3, V4 | KEEP — objective thresholds, catalog-anchored | Phase 3 |
| Port ~35 tell classes from Source A | CUT — half already ship as rules; the rest are the deferred subjective set | — |
| Model-specific tell packs, host-gated | CUT — "no model-fingerprint dependency" is locked twice (`archive/road-to-anti-slop-detector.md:72`, `archive/road-to-design-exploration-skills.md:29`) | — |
| Browser / computed-style engine for consumers | CUT — violates the dependency-free constraint at `design_slop_rules.ts:12-18`, which records a council override and is treated here as an invariant, not a preference | — |
| Screenshot-contrast visual engine | CUT — already shipped as windowed SSIM in `internal/bench/ui/run.ts` | — |
| A second labeled fixture corpus | CUT — 19 positive/negative pairs exist; `road-to-frontend-skill-application:67` forbids authoring a second window | — |
| `design-reference-import` skill fetching by URL | CUT — the import lane is `road-to-design-system-onramp` Phase 1, and network egress at use time is refused by the 2026-06-28 lock plus [ADR-126](../../docs/decisions/ADR-126-internet-reach-operator-tooling.md) | — |
| Live-site extraction shipped in `existing-ui-audit` | CUT — accepting the contract is allowed, producing it is not (`docs/contracts/design-artifact-lifecycle.md:72-75`); the legal path is `road-to-source-first-frontend` Phase 4 | — |
| Vendoring per-brand DESIGN.md files from Source B | CUT — license posture plus token economy | — |
| Brand-grade token tables inside DESIGN.md | CUT — `DESIGN.md` captures decisions, not a copy of `.tokens.json` (`design-system-capture/SKILL.md:306`) | — |
| New `references/motion.md` in fe-design | CUT — the motion decision-tree ships at `design-patterns.md:153`; a second file forks it | — |
| Three dials as new brief keys | CUT — shipped end-to-end; this would be the third pass on one decision | — |
| Making the Design Read a blocking gate | CUT — decided as a self-check, explicitly "not a blocking gate" | — |
| Four refine-verb commands | CUT — pipeline stages are skills not commands ([ADR-048](../../docs/decisions/ADR-048-command-justification-rule.md)), and `road-to-surface-consolidation` targets 190 → <150 | — |
| Persona-framing intro paragraph | CUT — published honest null, Δ=0.17, p=0.607 (`docs/proof.md:82`) | — |
| Component acquisition via Source E | CUT — hosted MCP plus API key against the egress ladder | — |
| Default-ON flip for the design hooks | CUT — owned by `road-to-frontend-skill-application` Phase 5 | — |
| Typography section in the DESIGN.md template | FOLD — the import contract carries `typography` and the template has no destination for it; belongs beside the import work in `road-to-design-system-onramp` Phase 4, not here | — |

## Phase 1: The traceability claim becomes a gate

The registry header's promise is currently true and currently unguarded. A gate
costs one script and converts an assertion into a fact.

- [x] **Step 1:** Add `src/scripts/lint_design_antipattern_parity.ts` — for every
      rule in the registry, resolve its `catalogId` against a real table row in
      `docs/guidelines/design-antipatterns.md`; fail on an id that resolves to
      nothing. In the other direction, every V/C/T/L/M/CP catalog row must be
      either detector-backed, named in the document's own judgment-only carve-out
      (`:46-48`), or a `Q*` floor owned by `lint_design_quality` — an
      unclassified row fails. Follow the house gate contract: `--quiet`, a
      per-item line, exit 0 clean / 1 on failure, and a self-test.
      <!-- verify: npx vitest run tests/scripts/lint_design_antipattern_parity.test.ts -->
- [x] **Step 2:** Make the document's "deterministic detector backing" paragraph
      derived rather than hand-maintained: the gate asserts the listed set equals
      the registry's actual `catalogId` set, so the list cannot drift from the
      code that it describes. Landed as a stronger shape than planned — the
      prose enumeration is **deleted** rather than checked, and the single
      enumeration is the § Detector status table, where all 45 entries carry one
      of five statuses. Two lists cannot drift when there is one.
      <!-- verify: npx tsx src/scripts/lint_design_antipattern_parity.ts --quiet -->
- [x] **Step 3:** Rename the two id↔catalog naming breaks to the convention the
      other seventeen follow: `slop-lock-shape` → `slop-v8-lock-shape`,
      `slop-lock-colour` → `slop-c6-lock-colour`, with their fixture keys. The
      rename is the plan, not an option the gate picks — a step that defers its
      own decision is a placeholder. Downstream: the fixture record in
      `design_slop_rules.test.ts` and any `--json` consumer keyed on the old id.
      <!-- verify: npx vitest run src/scripts/design_slop_rules.test.ts -->
- [x] **Step 4:** Register the gate in the CI pipeline beside the other design
      linters, under CI-identical argv.
      <!-- verify: npx tsx src/scripts/lint_design_antipattern_parity.ts --quiet -->

**Exit criteria.** The gate fails on a synthetic rule citing a nonexistent
catalog id and on a synthetic catalog row that is neither backed, carved out, nor
a `Q*` floor; it passes on the tree as it stands; both naming breaks are resolved
or explicitly recorded.

**Rollback.** Delete the script and its CI registration; the registry and the
catalog are untouched by Steps 1, 2 and 4, and Step 3's rename is a single
mechanical revert.

## Phase 2: The number the deferral asks for

A deferral whose precondition no instrument can satisfy is a permanent stop
wearing a temporary label. This phase builds the instrument and publishes the
baseline — it does not lift the deferral, it makes lifting it possible.

- [x] **Step 1:** Record the finding in the `design_slop_rules.ts` header block,
      immediately after the paragraph that documents the dependency-free
      constraint (`:12-18`): the existing per-rule negative fixture is a presence
      guard on one crafted snippet, not a false-positive rate. Without it the
      next reader mistakes 19 green negatives for an FP measurement.
      <!-- verify: grep -c "presence guard" src/scripts/design_slop_rules.ts -->
- [x] **Step 2:** Assemble a **clean-UI corpus** under `internal/bench/corpora/`:
      real, non-slop markup and CSS drawn from the fixtures this repo already
      owns (`tests/design-artifacts/fixtures/`) plus hand-authored clean samples.
      Bounds, so "assemble a corpus" is checkable: **at least 8 samples per
      engine** across `css`, `html`, `jsx`, `copy`; each file carries a one-line
      header stating why it is clean; no sample is derived from any rule's
      negative fixture, since a fixture written to keep one regex quiet proves
      nothing about the others. Every sample is labeled clean, so a rule firing
      on any of them is a false positive by construction.
      **Independence, stated rather than implied:** the six Phase-3 rules are
      already named in this file, so the corpus is *not* authored blind to them.
      The independence this plan claims is temporal and mechanical — the corpus
      and its ceiling are committed and SHA-pinned before any Phase-3 rule
      exists, so the number cannot be moved after it is seen. It is not
      corpus-before-rules, and saying otherwise would be the stronger claim this
      ordering does not support.
- [x] **Step 3:** Pre-register the two metrics before measuring, in the house
      pre-registration shape used by `internal/bench/corpora/*-PREREG.md`:
      **per-rule false-positive count** on the clean corpus, and **recall** on
      the existing positive fixtures. Pre-registration names the ceiling before
      the number is known. The ceiling landed as **M1 = 0**, argued rather than
      picked: these rules surface to a human as flags, and one noisy rule
      discredits the quiet ones. M2 is recorded as **suite-enforced** rather
      than recomputed — `design_slop_rules.test.ts` already fails if a rule
      misses its own fixture, so a second implementation would print a number
      and add no evidence.
      <!-- verify: npx vitest run tests/scripts/design_slop_fp_bench.test.ts -->
- [x] **Step 4:** Run it and publish the 19-rule baseline to
      [`docs/CLAIMS.md`](../../docs/CLAIMS.md) with the counting method and the
      corpus SHA, so a later expansion has a comparable prior instead of a fresh
      epoch. An honest null — every rule clean, no discrimination shown — is a
      publishable outcome and is recorded as one.
      <!-- verify: npx vitest run tests/scripts/design_slop_fp_bench.test.ts -->

**Exit criteria.** The corpus is committed and SHA-pinned; the pre-registration
file names both metrics and the FP ceiling ahead of the run; the baseline numbers
are in the claims ledger with their counting method. **Kill-switch:** if the
baseline shows any *existing* rule firing on the clean corpus, that finding
outranks Phase 3 — the offending rule is demoted or tightened first, and Phase 3
does not open on a registry whose current rules are already false-positive.

**Rollback.** The corpus is additive and removable. The ledger entry is **not**
rolled back: `docs/CLAIMS.md` is append-only, so a withdrawn measurement is
superseded by a later entry stating what was wrong with it, never deleted.

## Phase 3: Six thresholds become rules

Each entry below is already published in the catalog as a number. Nothing is
ported and nothing is invented — the prose is the specification, and Phase 2's
baseline is the acceptance instrument.

**Entry condition — met, and not in the way the plan expected.** Phase 2 Step 4
is complete and the baseline is in the ledger at corpus `90544389b05c1d0b`. The
kill-switch **did** fire: `slop-c6-lock-colour` recorded M1 = 4 of 32 clean
files. It was discharged the way the pre-registration demands — demoted to
`judgment-only` with its count, not tuned — so the registry Phase 3 extends is
18 rules, every one of them at M1 = 0. The condition is that the switch was
handled, not that it stayed quiet; recording it as "did not fire" would be the
tidier sentence and the false one.

- [ ] **Step 1:** Add the six rules to `src/scripts/design_slop_rules.ts`, each
      keeping its catalog id, its severity from the P0–P3 semantics documented at
      `design_slop_rules.ts:20-27`, and the rebuttable-presumption behaviour:
      **C3** neon `box-shadow`/`text-shadow` accents on a dark
      surface · **T9** `text-transform: uppercase` on body-length text · **T10**
      `letter-spacing` above `0.05em` on body text · **M1** bounce or elastic
      easing curves on UI transitions · **M3** transform or filter animation on
      an `<img>` hover · **V4** `border-radius` above 16px on elements under
      200px wide. The dependency-free constraint at `design_slop_rules.ts:12-18`
      is a precondition, not a preference: all six are single-property text
      patterns, and any implementation reaching for a parser invalidates Phases 1
      and 2 along with itself.
      <!-- verify: npx vitest run src/scripts/design_slop_rules.test.ts -->
- [ ] **Step 2:** One positive and one negative fixture per new rule, per the
      "no untested tell" assertion the suite already enforces
      (`design_slop_rules.test.ts:149`).
      <!-- verify: npx vitest run src/scripts/design_slop_rules.test.ts -->
- [ ] **Step 3:** Re-run the Phase-2 bench and publish the delta. Acceptance is
      **per rule, not per batch** — an all-or-nothing bar would sink five clean
      rules for one noisy one, and would let a batch pass by averaging. Each rule
      is graded on its own: zero false positives on the clean corpus **and** a
      non-zero hit on its own positive fixture → ship; one or more false
      positives → demote to judgment-only and record it in the catalog carve-out
      with the count that demoted it. The step completes with N ∈ [0, 6] rules
      shipped, and **N = 0 is a valid, publishable outcome** — it would say the
      catalog's six thresholds do not survive contact with real clean markup,
      which is a finding rather than a failure.
      <!-- verify: npx vitest run tests/scripts/design_slop_fp_bench.test.ts -->
- [ ] **Step 4:** Update the catalog's detector-backing set — which Phase 1
      Step 2 now checks mechanically — and confirm the parity gate stays green
      at the new rule count, whatever N turned out to be.
      <!-- verify: npx tsx src/scripts/lint_design_antipattern_parity.ts --quiet -->

**Exit criteria.** Registry at 19 + N rules for the N that passed their own bar;
every demotion recorded in the carve-out with its false-positive count; parity
gate green at the new count; the delta published beside the baseline.

**Rollback.** Each rule is an independent data row with its own fixture pair, so
any single rule can be removed without touching the other five or the gate. The
published delta in `docs/CLAIMS.md` is append-only and is superseded by a
correcting entry, never deleted; the catalog's detector-backing set is
regenerated by the Phase-1 gate rather than hand-reverted.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The six new rules are the deferred subjective set under a different name | product | The deferral was written precisely to stop registry growth on taste, and a plan that adds rules while citing the deferral's own scope note is the shape that gets waved through. If the six are opinions rather than floors, this repeats the thing the deferral prevented | Each rule is a single numeric threshold the catalog already publishes, and Phase 2's clean corpus is the arbiter rather than the author's judgment — a rule that fires on clean markup is demoted in Phase 3 Step 3, not argued for | Phase 3, Context |
| 2 | The clean corpus is authored to make the rules pass | implementation | The same session builds the corpus and the rules it grades, which is the evaluator-independence failure this repo has already paid for once | Phase 2 lands and publishes the baseline **before** Phase 3 exists, the corpus is SHA-pinned, and the FP ceiling is pre-registered in Step 3 ahead of any number | Phase 2 |
| 3 | A parity gate that nothing can fail | implementation | The tree is currently consistent, so a gate written against it passes on day one and could be vacuously true — the "gates that scan nothing exit green" failure | Exit criteria require the gate to fail on two synthetic inputs, one per direction, before it counts as shipped | Phase 1 |
| 4 | This becomes a sixth concurrent design roadmap | product | Five design-adjacent plans are already open. ADR-216 re-anchored *harvest* restraint to maintainer capacity and argues the principle, but it caps nothing here — the only mechanical cap in the tree is `lint_roadmap_family_cap`, scoped to the `road-to-skill-ecosystem-*` family, which this roadmap is not in. So the restraint is an argument, not a gate, and is stated as one | Three phases, one new script, six data rows, no new skill, no new command, no new settings key; the gap table hands one item to an existing roadmap rather than absorbing it. If capacity is the binding constraint, the honest lever is archiving a finished design plan, not shrinking this one | Gap table |
| 5 | The published baseline is read as a quality claim | product | A recall number on nineteen crafted fixtures says how the regexes behave on their own fixtures, not how the detector performs on real UI | Step 4 records the counting method and the corpus SHA with the number, and the honest-null branch is named in advance | Phase 2 |
| 6 | The catalog list becomes a second source of truth | implementation | Phase 1 Step 2 makes the document's backing list machine-checked against the registry; if the check is one-directional the list can still drift | The gate asserts set equality in both directions, and Phase 3 Step 4 re-runs it after the registry changes | Phase 1, Phase 3 |

## Non-goals

- **No new skill, command, rule, or settings key.** The whole surface delta is
  one linter, one corpus, and six data rows.
- **No consumer-side dependency.** Nothing here adds a parser, a browser, or a
  network call to a path a consumer runs.
- **No enforcement flip.** Whether the design hooks default on is owned by
  `road-to-frontend-skill-application` Phase 5 and is untouched here.
- **No extraction, import, or crawler work.** Owned by
  `road-to-design-system-onramp` and `road-to-source-first-frontend`.

## Review notes

Challenged before execution by a single external reviewer (2026-08-13, two
rounds). Recorded as a **single-member review, not council convergence** — the
second seat failed both attempts on a `Not inside a trusted directory` transport
error and returned nothing, so one seat answered and one abstained by failure.

Accepted and applied: per-rule rather than per-batch acceptance in Phase 3
Step 3 with `N = 0` named as a publishable outcome; an explicit Phase-3 entry
condition on Phase 2; corpus bounds and a definition of *clean* in Phase 2
Step 2; a named destination for the Phase 2 Step 1 finding; the Phase-2
kill-switch; append-only handling of the ledger delta; the dependency-free
constraint restated as a precondition; and the correction that ADR-216 does not
in fact cap anything here (Risk 4). Phase 1 Step 3 stopped deferring its own
decision and now names the rename.

Declined, with the reason: the reviewer's fallback options — ship Phase 1 alone,
or demote Phase 2 to an informal spike — were rejected on the reviewer's own
argument from the round before, that halting pre-emptively abandons two of three
stated defects while the risk register already carries the mitigation. The
sequencing is the de-risking; a spike outside the roadmap would produce the same
number with less of a record.

The independence objection was **not** dismissed and is not fully answered: the
corpus is authored with the six rules already known. Phase 2 Step 2 now states
that limit in the plan rather than claiming a blindness the ordering does not
buy.

## Acceptance criteria

- The parity gate is registered in CI, fails on both synthetic inputs, and is
  green on the tree.
- Both id↔catalog naming breaks are renamed to the convention, fixtures included.
- The fixture-is-not-an-FP-rate finding is recorded in the registry header.
- The clean corpus is committed and SHA-pinned at ≥ 8 samples per engine; the
  pre-registration names both metrics and the FP ceiling before the run.
- The 19-rule baseline is in the claims ledger with its counting method.
- Every one of the six candidate rules has a recorded per-rule verdict — shipped
  with its fixture pair, or demoted with the false-positive count that demoted
  it. A roadmap that ships fewer than six and says which, and why, has met this
  criterion.
- The gap table's CUT rows each carry the record that decides them — a reader can
  check any verdict without re-deriving it.
