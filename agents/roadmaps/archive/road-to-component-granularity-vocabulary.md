---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `./scripts-run src/scripts/roadmap_context atomic-component-intelligence`
# and the same probe for `component-legibility` and `component-library-intelligence`
# each returned `sibling roadmaps on the same topic: (none)` over
# `scanned: 753 roadmap file(s)`. Recorded with its known limit: the probe is a
# slug-keyword match and did NOT surface `archive/road-to-component-library-lifecycle.md`,
# which was found by reading `agents/tmp.old/component-library/` by hand. Empty
# here means "no live sibling", not "nothing adjacent exists" -- § Already
# shipped carries what the probe missed.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a measurement: three shipped surfaces name component granularity in three mutually inconsistent ways at HEAD b15b63d38, and two of the three disagreements are between a skill and the TypeScript that implements it."
estate_offset_exempt: "No archive move is available in this change. Net direction is favourable: two proposed roadmaps totalling 1,210 lines were reduced to this one file, roughly 70 per cent of the larger having been verified as already-shipped or already-planned in four unbuilt predecessors."
---
# Road to a component-granularity vocabulary — three surfaces, three taxonomies, none of them talking

> **Source:** `agents/tmp.old/atomic-design/` (2026-08-24) — a transcript and two
> drafted roadmaps totalling 1,210 lines. The larger of the two is dropped; what
> survives is recorded in § Dropped, with the measurement that killed each part.
> Every figure below was re-derived at HEAD `b15b63d38`.

## Goal

This suite names component granularity once, and the surfaces that classify,
inventory and budget components all use that one name set. Finished means: the
audit's `kind` values agree between the skill that specifies them and the
TypeScript that emits them, the granularity tier that already exists as a
prop budget is the same vocabulary the audit emits, `DESIGN.md`'s inventory
carries it as a column, and none of it hard-codes a five-level taxonomy this
repository never adopted.

## Context — measured 2026-08-24 at HEAD `b15b63d38`

Three shipped surfaces describe component granularity. No two agree, and two of
the three disagreements are between a skill and its own implementation.

| Surface | What it says | Reference |
|---|---|---|
| the audit **skill** | `kind: page\|partial\|component\|layout` | `src/skills/existing-ui-audit/SKILL.md:82` |
| the audit **code** | `kind: 'component' \| 'view' \| 'style' \| 'page'` | `src/cli/commands/uiAudit.ts:54` |
| the **architect** skill | `Primitive` / `Composite` / `Page section` — as a prop-count cap only | `src/skills/ui-component-architect/SKILL.md:120-124` |
| the **capture** skill | `\| Component \| Status \| Story file \| Registry item \|` — no granularity column at all | `src/skills/design-system-capture/SKILL.md:76` |

| # | Defect | Evidence |
|---|---|---|
| **D1** | **The audit skill and the audit code disagree in both directions.** The skill declares `partial` and `layout`, which the type cannot hold; the code emits `view` and `style`, which the skill never mentions. Only `page` and `component` are common. An audit artefact written by the code and read against the skill is being read against a contract it does not satisfy. | the two lines above |
| **D2** | **The classifier is a path regex with a catch-all.** `classify()` at `uiAudit.ts:122-127` tests four path shapes and ends `return 'component'`. Every React component from a one-line `Button` to a paginated `DataTable` lands in the same bucket, so the inventory carries no granularity signal — not because granularity is unmodelled, but because the fallback swallows it. | `uiAudit.ts:122-127` |
| **D3** | **A granularity vocabulary already exists and is emitted nowhere.** `ui-component-architect:120-124` distinguishes Primitive, Composite and Page section — with different prop caps per tier, so the distinction is already load-bearing for a review decision. Nothing writes the tier, nothing reads it, and no other surface knows the words. | `ui-component-architect/SKILL.md:118-126`; grep for the tier names outside that file |
| **D4** | **The `DESIGN.md` inventory has no granularity column.** Four columns, none of them saying whether the row is a primitive or a page section — so the artefact the architect consults first cannot answer the question the architect's own prop budget asks. | `design-system-capture/SKILL.md:76` |
| **D5** | **The data-boundary axis is undeclared in every component output.** Whether a component fetches or receives its data changes its reuse verdict, and this suite states the distinction only as one advisory corpus row — `design-intelligence/data/stacks/react.csv:52`, *"Container/Presentational split … Mixed data and UI in one"* as an anti-pattern. No skill emits it, no audit records it. | `react.csv:52`; grep across `src/skills/` for an emitted boundary field |
| **D6** | **Feature-prefixed component names are unaddressed.** A `CommentButton` beside a design-system `Button` shadows the primitive without replacing it, and nothing in the audit, the architect or the review names the pattern. Zero occurrences repo-wide and roadmap-wide, so it is a genuine gap rather than a re-statement. | `grep -rniE 'shadow(s|ing)? the (design[- ])?system' src/` → 0 |

## Field measurement — one real three-level library, 2026-08-24

The roadmap above was written from this tree alone. It was then run against a
production component library with `atoms/` (55), `molecules/` (3),
`organisms/` (2) and no `templates/` or `pages/`. Every number below is
re-derived, and two of them refute the roadmap's own reasoning.

**`classify()` is a constant function there.** Traced over the levelled tree:
**60 of 60 files → `component`**. Not "mostly" — every atom, every molecule,
every organism. D2 predicted the fallback swallows granularity; the measured
rate is 100 %, which makes 0.2's distribution step the load-bearing one rather
than a formality.

**The prop budget is inverted, and the worst offender is an atom.** Against
`ui-component-architect:122-124` (Primitive ≤ 6 · Composite ≤ 8 · Page section ≤ 4):

| component | its level | props | cap | over |
|---|---|---:|---:|---:|
| `file-upload` | **atom** | 19 | 6 | 3.2× |
| `date-navigator` | molecule | 18 | 8 | 2.25× |
| `picker-sheet` | organism | 14 | 4 | 3.5× |
| `duration-input` | molecule | 13 | 8 | 1.6× |
| `stepper` | molecule | 4 | 8 | — |

Higher-level components legitimately carry more props — every label, callback
and test id of an orchestrated pattern surfaces at its root — so a cap that
*tightens* as granularity rises flags the components that are correctly built.
And between 45 % and 72 % of the library declares no root prop interface at all
depending on how you count (`React.ComponentProps<'div'> & VariantProps<cva>` is
the dominant idiom), so for most components the number does not exist.

**No scalar separated the levels.** Composition depth, state, sub-component
count and props were each tested; each overlaps completely across `atoms/` and
`molecules/`, and several *invert*. Sub-component count is the most tempting
replacement and it fails too: `atoms/combobox` exports **16**, more than every
molecule (1, 1, 2) and more than one of the two organisms (`picker-sheet`, 1) —
while the other organism exports 23. Recorded because the obvious next move
after "props do not work" is "count exports instead", and the data says that is
the same mistake with a different field.

**The level was a bulk rename four days old.** Git shows 52 files moved flat →
`atoms/` in one commit, `molecules/` and `organisms/` created empty, and exactly
one promotion since — shipped as a breaking change, because a barrel-free
package with subpath-glob exports puts the level string in every consumer
import. So the level records *when a file was created*, and migrating one is
semver-major. That is why level churn looks low; it is not evidence that the
levels are right.

| # | Defect this surfaced | Evidence |
|---|---|---|
| **D7** | **The audit never reads `components.json`, and the skill says three times that it should.** `existing-ui-audit/SKILL.md:91` names it as *the* shadcn marker, `:104` uses its `"tailwind": {"config": ""}` for the v4 axis, `:135` says *"Read `components.json` for the registered style + base color"*. `grep -c 'components.json' src/cli/commands/uiAudit.ts` → **0**. `SYSTEM_MARKERS[0]` is the **path** `components/ui/[a-z-]+.tsx` instead. A library that renamed its primitives directory and recorded the rename in `components.json` (`"aliases": {"ui": ".../components/atoms"}`) therefore detects as having **no design system** — measured `design_system_markers: []` on a demonstrably shadcn-derived library. This is the same skill↔code class as D1, on the marker axis. | the three skill lines; `uiAudit.ts:92-99`; the grep |
| **D8** | **`classify()`'s `page` branch misfires on barrels, and its `view` value is dead outside one framework.** `uiAudit.ts:126` maps `index.[jt]sx?` to `page`; in a barrel-using codebase that hits `components/<feature>/index.tsx`, which is an export barrel, not a route. `view` requires `.blade.php` or `resources/views/`, so it is 0 in any JS tree. Both are separate from the catch-all and 0.1 should decide them explicitly rather than only aligning the two lists. | `uiAudit.ts:122-127` |

## Already shipped — read before proposing any mechanism here

`agents/roadmaps/archive/road-to-component-library-lifecycle.md` closed 23/23
with no deferrals. It landed the inventory contract, the architect's
read-inventory-first step, `storybook-workshop` with its story set and its
`one concept per story` Iron Law, the Storybook MCP path with the
never-use-an-undocumented-prop rule, the report-only script precedent
(`story_contrast_floor.ts`, `check_package_surface.ts`), and the fuzzy reuse
candidate ranking at `existing-ui-audit/SKILL.md:181`.

Separately, a **code graph already exists** and is an ADR-124 Class A engine:
`src/scripts/code_graph/{build,extract,query,detect,sqlite_store}.ts`, with
`affected()` at `query.ts:206` and verbs `build|detect|refresh|query|explain|affected|path`.
`./scripts-run src/scripts/code_graph/cli detect` reports
`native agents/runtime/state/code-graph-v1.json · STALE`. What it does not have
is JSX: `grep -ci jsx src/scripts/code_graph/extract.ts` → **0**. The real delta
is composition edges inside the existing extractor, not a second graph — and
building a second one would plausibly open a new engine class under ADR-133.

## Dropped — and what killed each part

| Proposal | Verdict |
|---|---|
| **`road-to-atomic-component-intelligence.md` (953 lines) as a whole** | dropped. Its Phase 2 specifies a read-only component analyzer with `uses`/`used_by` queries — that is the shipped Class-A engine described as a gap. Its Phase 6 adds a gate, which this repository prices at three ratchets (gate-coverage registration with a `scanned:` line and a canary, the shrink-only `gate-self-test:registered-non-adopters`, ci-parity) for a heuristic with no measured false-positive rate. Its Phases 7–8 specify a two-arm benchmark that three unbuilt predecessors in `agents/tmp.old/component-library/` already pre-register, on a dependency stack (`workspace-graph` → `intelligence` → `playbooks`) whose foundation was never built. |
| importing Frost's five-level taxonomy (atom/molecule/organism/template/page) | **not adopted, deliberately.** `grep -rniF 'atomic design' src/ docs/` → 0; the five levels have never been this repository's vocabulary. Adopting them would replace a three-tier distinction that already exists and is already load-bearing, and would import the classification churn the source's own critique documents. |
| *"never skip a level / extract atoms first"* | **rejected on a live lock.** `ADR-213` and `docs/guidelines/abstraction-thresholds.md:24` canonise `~4+ repeats AND real state (both conditions)`, with `lint_abstraction_thresholds.ts` enforcing it. Extract-first is the opposite rule. |
| *"no data fetching in components"* as a hard rule | dropped as stated. `react-shadcn-ui/SKILL.md:57` pins React 19, so a blanket prohibition is stale — but the rule's **underlying axis** survives as D5, which is about declaring the boundary, not forbidding one side of it. |
| a falsifiable presentational test *"renders identically with mock props in Storybook"* | **has no harness.** There is no `.storybook/` in this tree; the only story file is a test fixture. `story_contrast_floor.ts` is explicitly not that path — the archived roadmap records a four-part null on browser-in-CI. Kept as an idea with no verify line, therefore not kept. |
| the harvest analysis itself | worth preserving, not as estate. It belongs under `agents/evidence/analysis/`, anonymised to `Source A/B/C` with `ENC1:` links per [`source-confidentiality`](../../src/rules/source-confidentiality.md) — both source roadmaps name three external repositories outright, and `check_no_external_sources` is green on them only because those tokens are not in the denylist. |

## Phase 0 — fix the contract before widening it

- [ ] **0.1 Reconcile the audit `kind` enum between the skill and the code.**
      Two of four values disagree in each direction. Pick one set, and state which
      surface is authoritative — the type is emitted into
      `agents/runtime/state/ui-audit.json`, so the code's set is the one that
      exists in artefacts today.
      verify: the value list in `existing-ui-audit/SKILL.md:82` and the union in
      `ComponentEntry['kind']` are string-identical, asserted by a test that
      reads both files rather than restating either.

- [ ] **0.2 Record what `classify()`'s catch-all currently produces, before changing it.**
      A `return 'component'` fallback means the current distribution is unknown.
      Measure it over this repository's own fixtures and over one real consumer
      tree before assuming granularity is absent rather than merely uncollected.
      verify: a committed distribution table under `agents/evidence/analysis/`
      with a count per `kind` and the fallback share stated as a percentage.

- [ ] **0.3 Pin taxonomy independence — and pin NON-EQUIVALENCE, which is the live risk.**
      The vocabulary must not read as an endorsement of any external
      methodology; a fixture forbidding those words as emitted values is the
      cheap half. The expensive half is positional: a three-tier name set lines
      up 1:1 with a three-level directory, so a reader with such a tree open will
      read tier one as *"the thing in the first directory"*. Measured in the
      field library, a correct classifier and the directory disagree on **at
      least 14 of 61** components — so the equivalence is not merely unproven,
      it is false, and forbidding the words while permitting the equivalence
      hands the reader a wrong key instead of no key.
      verify: a fixture asserts the emitted vocabulary contains none of `atom`,
      `molecule`, `organism`, `template`; a second asserts that a component
      sitting in a directory named `atoms/` does **not** thereby classify as the
      first tier — the tier is derived, or it is a path regex with nicer words.

- [ ] **0.4 Measure the candidate discriminators before committing to any of them.**
      The field measurement tested four — composition depth, state,
      sub-component count, prop count — and all four overlap completely across
      the two lower levels, several inverting. Sub-component count is the
      tempting replacement after props fail and it fails the same way: one
      first-level component exported 16, more than every second-level component
      and more than one of the two third-level ones. Run the same four over this
      repository's fixtures before 1.1 picks a basis.
      verify: a committed table with one row per candidate and its measured
      separation across levels; a candidate with overlapping ranges is recorded
      as rejected, and 1.1 cites the surviving one or records that none survived.

- [ ] **0.5 Read the declared primitives location instead of matching a conventional path.**
      D7: `SYSTEM_MARKERS[0]` is the path `components/ui/[a-z-]+.tsx`, and
      `uiAudit.ts` never opens `components.json` — while the skill names it as
      the marker three separate times. A library that renamed its primitives
      directory and recorded the rename in that file's `aliases.ui` therefore
      reports as having no design system.
      verify: `grep -c 'components.json' src/cli/commands/uiAudit.ts` is
      non-zero; a fixture whose `aliases.ui` points somewhere other than
      `components/ui/` still yields a non-empty `design_system_markers`.

- [ ] **0.6 Decide the `page` and `view` branches explicitly, not only the enum.**
      D8: `index.[jt]sx?` → `page` hits every export barrel in a barrel-using
      codebase, and `view` requires markup this classifier will not see outside
      one server framework — measured 0 of 364 UI files in a JS tree. 0.1
      reconciles two lists; these two values need a decision, not an alignment.
      verify: the barrel case is covered by a fixture that does not classify as
      `page`, and `view` is either removed or its retention carries a reason.

## Phase 1 — one granularity vocabulary, on the surfaces that already need it

- [ ] **1.1 Adopt the tier names that already exist — on the reuse argument, not on the budget.**
      `primitive` / `composite` / `section`, taken from
      `ui-component-architect:122-124` rather than invented. **The justification
      narrows here.** D3 argued the names were load-bearing because a prop cap
      already depended on them; the field measurement refutes the cap — inverted
      at both upper tiers, and unmeasurable for the 45-72 % of a real library
      that declares no root prop interface. What survives is the weaker and still
      sufficient argument: these three words are already in the tree, so using
      them is unification rather than a fourth taxonomy. The basis for *deciding*
      a component's tier comes from 0.4, not from the cap.
      verify: the three names appear as a single exported constant;
      `ui-component-architect`'s table references that constant's values rather
      than restating them; and the prop caps are either re-derived against 0.4's
      measurement or marked advisory with the inversion recorded.

- [ ] **1.2 Emit granularity from the audit — code and skill together.**
      This is a TypeScript change, not a prose one: `ComponentEntry`,
      `classify()` and their tests in `src/cli/commands/uiAudit.ts`, plus the
      skill line. The source roadmap claimed this phase was "edits to five
      existing skills and one guideline"; that claim is false and is corrected
      here.
      verify: `ui-audit.json` carries a granularity field per entry; a fixture
      component of each tier classifies to its tier; the artefact's existing
      consumers still parse it (`directives/ui/audit.ts` reads
      `state.ui_audit` — its shape stays additive).

- [ ] **1.3 Add the granularity column to the `DESIGN.md` inventory.**
      verify: `design-system-capture/SKILL.md:76`'s table carries the column, and
      the skill's existing "empty cell rather than omission" rule covers it.

- [ ] **1.4 State the anti-dogma contract where the vocabulary is defined.**
      Three tiers is this repository's distinction, derived from a prop budget it
      already enforces. It is not a methodology, it does not imply a build order,
      and it never overrides `ADR-213`'s extraction threshold.
      verify: the contract sentence exists at the definition site and names
      `ADR-213` as the governing threshold; `lint_abstraction_thresholds` stays
      green.

## Phase 2 — the data-boundary axis

- [ ] **2.1 Declare the boundary as a field, not as a prohibition.**
      `presentational` or `data-bound: <where>`. D5 is that the axis is
      undeclared, not that one side of it is wrong — a React 19 component that
      fetches is legitimate, and a reuse verdict still needs to know.
      verify: the field is emitted for each audited component; a fixture pair
      differing only in a data call classifies differently.

- [ ] **2.2 Consume the boundary in the reuse verdict.**
      verify: the architect's reuse decision cites the field, and a case where
      the boundary alone changes the verdict is covered by a test.

## Phase 3 — name shadowing

- [ ] **3.1 Detect a feature-prefixed component shadowing a design-system primitive.**
      `CommentButton` beside `Button`. Report-only, following the precedent
      already in the tree (`story_contrast_floor.ts`, `check_package_surface.ts`)
      rather than adding a gate — a new gate costs three ratchets for a heuristic
      whose false-positive rate nobody has measured.
      verify: the check names the shadowing pair and the primitive it shadows;
      a negative fixture proves an unrelated `SubmitButton` in a tree with no
      `Button` primitive is not reported.

- [ ] **3.2 Decide whether the report ever becomes a gate — with 3.1's rate, not before.**
      verify: the decision is recorded with the measured false-positive count
      from a run over this repository's fixtures; "stays report-only" is a
      complete answer and is written down as one.

## Phase 4 — composition edges, inside the engine that exists

- [ ] **4.1 Extend `code_graph/extract.ts` to emit JSX composition edges.**
      `grep -ci jsx src/scripts/code_graph/extract.ts` is 0 today, and `affected()`
      already exists at `query.ts:206`. This is an extractor extension, not a new
      engine — which also keeps it clear of ADR-133's large-subsystem review,
      whereas a second graph would plausibly trip it.
      verify: a fixture component tree yields `renders` edges, and
      `code_graph/cli affected <component>` returns its consumers.

- [ ] **4.2 Confirm the graph artefact stays out of standing context.**
      `road-to-standing-payload-truth` reports two payload gates red at HEAD, one
      by +30,566 tokens. Nothing here may add to that.
      verify: the artefact is referenced by pointer and checksum, and
      `preamble_byte_census` reports no new gated bucket.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The vocabulary is read as an endorsement of a five-level methodology | product | The source is an atomic-design harvest; a three-tier vocabulary landing out of it will be read as a first step toward atoms and molecules, and the next contributor will "complete" it. | 0.3 pins the exclusion as an executable fixture rather than a sentence; 1.1 derives the names from a prop budget already in the tree; 1.4 states the contract at the definition site and binds it to ADR-213. | Phase 0 — fix the contract |
| 2 | Changing `ComponentEntry` breaks a live artefact consumer | implementation | `ui-audit.json` is read by `directives/ui/audit.ts` and gates the work engine's `refine` step; a shape change could red a path unrelated to this work. | 0.1 reconciles the enum before 1.2 widens it, so the two changes are separable; 1.2's verify requires existing consumers to still parse, and the field is additive rather than a replacement. | Phase 1 — one granularity vocabulary |
| 3 | Phase 4 grows into the second graph the source proposed | implementation | "Composition edges" is one refactor away from "a component graph", which is a new engine class and an ADR-133 review. | 4.1 is scoped to `extract.ts` and reuses `affected()`; no new store, no new CLI verb, no new persisted artefact beyond the existing `code-graph-v1.json`. | Phase 4 — composition edges |
| 4 | Granularity classification churns on ambiguous components | product | The source's own critique documents this: an `IconButton` is defensibly a primitive or a composite, and a classifier that flips between them teaches readers to ignore the field. | 0.2 measures the current distribution first, so churn is observable rather than hypothesised; the three tiers are coarser than five, which is the whole reason for reusing them; the prop-cap the tiers already carry gives an objective tie-break. | Phase 0 — fix the contract |
| 5 | The vocabulary is read as an alias for a three-level directory | product | Three tiers line up 1:1 with three level directories, and a reader will map them positionally. Measured, that mapping is wrong for at least 14 of 61 components in a real library — a 23 % disagreement between an emitted field and a directory the reader can see, which is the churn failure arriving through the door Risk 4 watches. | 0.3's second fixture pins non-equivalence directly: a directory name may not by itself produce a tier. 0.4 forces the tier to be derived from a measured discriminator, so there is something for it to be derived *from*. | Phase 0 — fix the contract |
| 6 | The shadowing check false-positives on legitimate feature components | implementation | Most `XButton` names are not shadowing anything, and a noisy report gets ignored the way this repository documents for over-wide gates. | 3.1 is report-only by construction and requires a negative fixture; 3.2 forbids promoting it to a gate without the measured rate. | Phase 3 — name shadowing |

## Acceptance Criteria

- [ ] **AC-1** — `existing-ui-audit/SKILL.md:82` and `ComponentEntry['kind']` carry a string-identical value set, asserted by a test that reads both.
- [ ] **AC-2** — the emitted granularity vocabulary contains no five-level taxonomy name, proven by a fixture that fails if one appears, AND a second fixture proves a directory name alone does not determine the tier.
- [ ] **AC-2b** — the four candidate discriminators are measured with their separation across levels recorded, and 1.1 cites the surviving one or records that none survived.
- [ ] **AC-2c** — `design_system_markers` is non-empty for a fixture whose declared primitives alias points outside `components/ui/`.
- [ ] **AC-2d** — an export barrel does not classify as `page`, and `view` is removed or its retention carries a reason.
- [ ] **AC-3** — `ui-audit.json` carries a granularity value per component, and one fixture per tier classifies to its tier.
- [ ] **AC-4** — `DESIGN.md`'s inventory table has a granularity column, and `ui-component-architect`'s prop budget reads its tier names from the shared constant rather than restating them.
- [ ] **AC-5** — the data-boundary field is emitted, and a test covers a case where it alone changes the reuse verdict.
- [ ] **AC-6** — the shadowing check reports a real pair and a negative fixture proves it stays silent on an unrelated name; whether it becomes a gate is recorded with a measured false-positive count.
- [ ] **AC-7** — `code_graph` emits JSX composition edges from its existing extractor, `affected()` resolves a component's consumers, and no new engine, store or CLI verb was added.
- [ ] **AC-8** — `preamble_byte_census` reports no new gated bucket after Phase 4.
- [ ] **AC-9** — the harvest analysis is preserved under `agents/evidence/analysis/` with external sources anonymised, and `check_no_external_sources` is green for a reason other than an incomplete denylist.
