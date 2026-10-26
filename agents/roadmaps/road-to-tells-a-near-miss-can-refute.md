---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The owner asked in the invoking turn of 2026-10-26 for this round's roadmaps to be processed with /roadmap:process-full in the same run (the operator exception of /analyze:inbox Phase 6). This file supersedes later/road-to-tell-detector-promotions, which this change archives with its five open items carried here (later -1, active +1); that file's subject has now arrived four times. No active roadmap owns design-tell evaluation validity (grep -l 'design_slop\\|tell-detector\\|near-miss' over agents/roadmaps/*.md returned none), and none is finished, so none can be archived to offset it."
supersedes:
  - later/road-to-tell-detector-promotions
relates:
  - slug: road-to-a-control-that-matches-its-neighbours
    relation: disjoint
    note: "Sibling from the same round. Owns UI consistency of follow-up edits, two consistency registry rules, the open-state probe and the page visual diff. Its rules pass this roadmap's near-miss gate (Phase 1) before leaving shadow."
  - slug: road-to-consumer-invocations-that-install
    relation: disjoint
    note: "Parked in later/. Already lists both shipped sites this file depends on (detect_ai_tells from humanizer, lint_design_slop from design-review); no step here adds a CLI verb or converts an invocation."
  - slug: road-to-svg-witness-provenance
    relation: disjoint
    note: "Parked in later/. Owns SVG witness provenance. Phase 7 here only calls the existing asset profile for the `mark` class; 7.5 and 7.7's new witness readings land only through that roadmap's own pre-registration."
---
# Road to tells a near-miss can refute

> **Source:** `agents/tmp.old/inbox-2026-10-az/B/` — one owner transcript
> (2026-10-24), one externally drafted plan and one plan drafted against
> `main@b9b3fb5dd`. Re-verified against `main@f9af88efe0` on 2026-10-26: no
> commit since the pin touched any design-tell, prose-tell, hook, render or skill
> path the register names. Corrections are under *What verification changed*.
>
> **Arrivals:** 4 — this round; earlier: `inbox-2026-09-l`,
> `agents/roadmaps/archive/road-to-design-craft-antislop.md`,
> `agents/roadmaps/stubs/road-to-frontend-power-detector-promotions.md` (carried
> from the superseded `later/road-to-tell-detector-promotions`).
>
> **The owner's demand:** improve agent-config from a deep analysis of a clip
> recommending three skills against AI tells in design, prose and logos; learn,
> use and adapt; three challenge loops; a roadmap.

## Context — the instrument cannot say no

The tree already has more tell machinery than the three sources together: a 50+
entry design catalog with a parity gate, a 26-rule deterministic slop detector, a
40-rule prose detector with a pre-registered FP bench, and an SVG render witness.
What stops it from being better is that its design-side instrument cannot refute.

| # | Defect | Evidence at `f9af88efe0` |
|---|---|---|
| D1 | The slop context gate is a raw substring test over the whole DESIGN.md: "We never use Inter" **suppresses** T7; "sand" matches "thousands". **Reproduced** with a scratch fixture: 1 finding without the DESIGN.md, `[]` with it. | `src/scripts/lint_design_slop.ts:110` (`raw.includes`); gates `src/scripts/design_slop_rules.ts:301,365,595,619` |
| D2 | The design FP corpus does not discriminate: 26 rules × 32 clean files, M1 = 0 for every rule, which the pre-registration itself reads as "the corpus fails to discriminate". The public claim still reads "18 of the 19". | `internal/bench/design-slop-fp/run.ts` output; `docs/CLAIMS.md:812-817` (`last_verified: 2026-08-13`) |
| D3 | Structural tells have no witness on the page profile: `ui:render` captures 8 computed properties and no geometry; nothing reads `*.styles.json` but its writer. V7, L1, L2, L6, L7, T2, T3 stay `judgment-only`. Geometry already exists one profile over. | `src/cli/commands/uiRender.ts:56-65,422-424`; `src/cli/commands/uiRenderAsset.ts:790`; `docs/guidelines/design-antipatterns.md:256,268,279,284` |
| D4 | A consumer install cannot render: `@playwright/test` is a devDependency. | `package.json:113`; degradation text in `uiRender.ts` near `:318` |
| D5 | The design hooks cannot tell an introduced finding from an incumbent one — the false-alarm path the hook's own header names as Risk 1. | `src/scripts/hooks/design_pass_hook.ts:40-44`; `lint_svg_asset.ts:22,229` has the `--baseline` shape |
| D6 | Two copy registries for one concept: `BUZZWORDS` (slop) and `tell-ai-vocabulary` (prose); CP3 is `judgment-only` "council-rejected" while the prose detector ships `tell-negative-parallelism` as backed. The rejection was recorded as "decided without a number, re-open on measurement only". | `design_slop_rules.ts:167`; `src/scripts/ai_tells_rules.ts:348,411`; `design-antipatterns.md:298-301`; `agents/roadmaps/archive/road-to-frontend-power.md:252` |
| D7 | Prose-detector recall on an independently written corpus was never measured; the only lift claim is on a self-seeded corpus. The drafted plan's 20/40 · 0/40 · 11-families-at-zero reading used an external corpus not in the tree and is **unverified here**. | `docs/CLAIMS.md:548` |
| D8 | The humanizer's factual-integrity guard is prose: the model self-reports `[VERIFY: …]`; nothing diffs numbers, dates or names. | `src/skills/humanizer/SKILL.md:115-123`; no `--baseline` in `detect_ai_tells` |
| D9 | PRODUCT.md is a private dialect with no format detection: here it means interaction patterns, elsewhere in the ecosystem durable product truth; capture reads and rewrites without checking. | `src/skills/design-system-capture/SKILL.md:143-152,191-214` |
| D10 | The persisted register is never read in production: `ui_authority` ranks DESIGN.md/PRODUCT.md, but its only production caller never passes `design_md`. | `src/scripts/_lib/ui_authority.ts:23,107-108,167-171`; `src/scripts/_lib/design_sync_reconcile.ts:44-55,98` |
| D11 | The humanizer ships only in `gtm-marketing`; 5 pack-boundary rows (3 meta skills link into it; it links out to two engineering-base rules). | `src/skills/humanizer/SKILL.md:12`; `lint_pack_boundaries` (120 baselined, 5 humanizer) |
| D12 | Logo work has no process and no small-size proof: "legible at 16 px" is a brief constraint never checked; the skill never names `--profile asset --class mark`; no divergence, critique or shelf step; evals are `triggers.json` only. | `src/skills/logo-generation/SKILL.md:41,59-64`; `uiRenderAsset.ts:149-156` |
| D13 | The tree fails its own catalog: `src/ui` 19 findings (12 CP1, 7 V1), `site` 15 (14 CP1, 1 V1), no DESIGN.md. Two V1 stripes are neutral 3px borders (`--color-border`, `--color-border-strong`) the catalog neither exempts nor names — the first real-code near-miss. | `lint_design_slop --dir src/ui|site --json`; `src/ui/app.css:742,853`; `design-antipatterns.md:113` |
| D14 | The catalog's scheduled 2026-Q4 currency review is due; 0 hits for marquee, grid-line background, blinking cursor, stragglers, occlusion, hard-offset shadow, halo, clip-path, flush-to-edge. | `design-antipatterns.md:51,57` |
| D15 | Suppression syntax is inconsistent in its documentation (`svg-asset-disable … [-- reason]` optional, `design-slop-disable` none) and neither parser records a reason. | `lint_svg_asset.ts:11-14`; `src/scripts/_lib/svg_rules.ts:1435,1437`; `lint_design_slop.ts:29-31` |
| D16 | The settings comment claims "the universal gate is the lint_design_slop linter/CI", but no workflow runs it (only the parity check and a bench task). | `src/config/agent-settings.template.yml:1317`; `.github/workflows/consistency.yml:962-963`; `taskfiles/bench-ui.yml:36-45` |
| D17 | Carried from the superseded later/ file: the four interaction/texture signals M6, M7, M8, V9 have no legitimate near-miss in the clean corpus; `enginesForExt` classifies no engine for `.ts`/`.js`, where reveal hooks and `mousemove` handlers live; T4 cannot reach a sentence-case badge above an `h1`. | `agents/roadmaps/archive/road-to-tell-detector-promotions.md` (after this change) |

## Goal

Every `backed` design tell carries an M1 measured on a corpus that contains a
legitimate near-miss for it; a DESIGN.md can only silence a rule by declaring
intent; hooks report what an edit introduced; and logo and prose outputs carry
deterministic proof where a claim is made.

## Phase 0 — Close the cheap lies first (no new surface)

- [x] **0.1 Falsifying fixtures for D1, before the fix.** Done 2026-10-26: `tests/scripts/design_slop_context_gate.test.ts`, 3 red before 0.2 (the first substring control fired nothing and was rebuilt to fire C5 and C3, with a guard against an empty control). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/design_slop_rules.ts --> Three DESIGN.md
      fixtures: negation ("never use Inter"), substring collision ("thousands",
      "glowing", "spill"), scope (the keyword under a "What we avoid" heading).
      verify: `npx vitest run tests/scripts/design_slop_context_gate.test.ts` is
      red before 0.2 and green after.
- [x] **0.2 A declared-intent reader replaces the substring gate.** Done 2026-10-26: `declaredIntent` in `lint_design_slop.ts`, `legacyHas` report-only as `would_have_suppressed`; FP bench unchanged; CLI body split to `lint_design_slop_main.ts` to keep the hook bundle under its ceiling. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/design_slop_rules.ts --> Only a
      frontmatter key (`intent: [warm-neutral, …]`) or an `## Intentional`
      section counts; matching is word-bounded; a negated sentence never counts.
      The free-text fallback stays one minor version report-only ("would have
      suppressed `<rule>` on `<phrase>`").
      verify: 0.1 green; `src/scripts/design_slop_rules.test.ts` and
      `tests/scripts/design_slop_vs_provided.test.ts` unchanged-green; the FP
      bench count unchanged.
- [x] **0.3 One ignore syntax with a reason.** Done 2026-10-26: `_lib/ignore_reason.ts`; slop `--json` lists `suppressions` with reasons; both linters report `ignore-without-reason`; the svg JSON stays an array, so its reasons are recorded in `RuleIgnore.reasons` and reported on stderr. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/ignore_reason.ts --> `design-slop-disable[-line|-next-line]
      <rule> -- <reason>` and the svg parser records the reason it already
      documents; a reasonless ignore still applies for one minor version and is
      reported `ignore-without-reason`.
      verify: fixtures with and without a reason; `--json` carries `reason` on
      every honoured suppression in both linters.
- [x] **0.4 Restate the two stale texts.** Done 2026-10-26: claim restated as the 2026-10-26 null epoch, history kept; `build_proof` rerun; the settings comment drops the "universal gate" sentence. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml --> `docs/CLAIMS.md:812-817` gains the
      26-rule run as a new epoch reported as the null it is, keeping the
      2026-08-13 figure as history; the settings comment at
      `agent-settings.template.yml:1317` names what actually runs.
      verify: `task check-claims` green; `grep -n "universal gate"
      src/config/agent-settings.template.yml` returns the corrected wording.

## Phase 1 — A corpus that can say no

The gate for every later promotion.

- [ ] **1.1 Pre-register before building.**
      `internal/bench/corpora/design-slop-nearmiss-PREREG.md` with metrics,
      predicted non-zero rules and the honest-null reading, in the form of
      `prose-tells-fp-PREREG.md`.
      verify: the PREREG commit precedes the corpus commit.
- [ ] **1.2 One near-miss per backed rule, authored independently.** For each of
      the 26 rules one legitimate use a naive detector would flag (a neutral 3px
      citation rule for V1, a danger-state stripe, …); tune/holdout split as in
      the prose bench.
      verify: for every rule ≥ 1 file the PREREG labels its near-miss; the bench
      prints per-split M1.
- [ ] **1.3 Near-misses for the four interaction signals** (carried A1): a
      lazy-loading or scroll-progress `IntersectionObserver`, cursor tracking
      driving a functional canvas, hover opacity on a disabled control, grain
      without V9's gradient composition.
      verify: the corpus digest changes; each of M6, M7, M8, V9 has ≥ 1
      legitimate use a naive detector would flag.
- [ ] **1.4 Real code as a labelled split.** The D13 findings in `src/ui/` and
      `site/`, labelled by hand TP or near-miss with a one-line basis, kept as
      the `dogfood/` split.
      verify: a labels file with one row per finding, basis and labeller; the
      bench reports precision on `dogfood/` separately.
- [~] **1.5 External near-misses as a separately reported split.** The external
      design source's should-pass fixtures under its licence, with
      `provenance/borrows.jsonl` rows and attribution, reported only as their own
      split, never folded into the headline (lineage overlap with the catalog).
      Blocked: `external-test-data-licence` (OQ-20).
      verify: licence text and SHA pinned; three named splits in the bench output.
- [ ] **1.6 Run, record, let rules fall.** A rule with M1 > 0 on a near-miss is
      tuned once, then demoted to `judgment-only` (the C6 precedent).
      verify: a new CLAIMS epoch with per-split M1;
      `lint_design_antipattern_parity` green after any demotion.

## Phase 2 — A witness for what only a render can show

- [ ] **2.1 Browser reach for consumers without a new dependency.** Resolve
      `playwright-core` when the consumer has it and pass `executablePath` for a
      discovered system Chrome/Edge/Chromium; the renderer-absent path stays as
      honest as today. Adding `playwright-core` (13 MB) as a runtime dependency
      or a zero-dependency CDP client is OQ-21.
      verify: with `playwright-core` resolvable and a system browser,
      `agent-config ui:render <fixture>` writes `verification` ≠ `unverified`;
      without one it degrades exactly as today.
- [ ] **2.2 Geometry and dark scheme on the page profile.** Bounding boxes,
      parent chain to depth 4, visibility; `CAPTURED_PROPERTIES` extended only by
      what a pre-registered rule reads; reuse `uiRenderAsset.ts:790`'s helper; a
      `prefers-color-scheme: dark` pass where the page declares one.
      verify: `src/cli/commands/uiRender.test.ts` asserts the new fields; the
      manifest schema version bumps.
- [ ] **2.3 A `render` engine in the slop registry.** Rules read `*.styles.json`
      and geometry, never the screenshot; a fifth input class beside
      `css`/`html`/`jsx`/`copy` (`design_slop_rules.ts:38`); the parity table
      accepts `backed (render)`.
      verify: `lint_design_slop --render <manifest>` runs the engine; parity lint
      accepts the new status form.
- [ ] **2.4 Scanner reach for `.ts`/`.js`** (carried A2). Decide and record:
      widen `enginesForExt` — which re-opens M1 for every existing rule on the
      larger surface — or scope interaction rules to colocated-markup extensions
      and say so in § Detector status.
      verify: the decision with its measurement; if widened, every existing rule
      carries a fresh M1.
- [ ] **2.5 Promote one row per epoch, cheapest first.** L7, L6, V7, L2, T3,
      T2/L1, then M6, M7, M8, V9 (carried A3). Each needs M1 = 0 on every
      Phase 1 split, recall ≥ 1 on its positive fixture, and a
      `provenance/borrows.jsonl` row or an own-analysis label.
      verify: per row, `backed` in § Detector status, a CLAIMS epoch line, parity
      green.
- [ ] **2.6 T4 by position, prose and status in step** (carried B1/B2). A
      dependency-free adjacency heuristic for a badge immediately preceding an
      `h1` (render geometry where available), with its failure mode stated; T4's
      prose describes only what its rule reaches.
      verify: a pill badge above an `h1` flags, a status chip in a table row does
      not; parity green.

## Phase 3 — Say only what the edit introduced

- [ ] **3.1 A git baseline for hook findings.** Baseline = `git show HEAD:<path>`
      (or the index blob), empty for an untracked file; a finding whose rule and
      normalised snippet exist in the baseline is `incumbent`, reported as a
      count, never a block. No pre-hook needed.
      verify: a fixture with a pre-existing and a new side-stripe reports
      `introduced: 1, incumbent: 1`; P0 floors still block when introduced.
- [ ] **3.2 Measure before keeping it.** Replay the hook over the diffs of the
      `tests/eval/frontend-corpus/cases/` and count stop-pass findings with and
      without attribution.
      verify: a numbers table in the PR; if attribution hides an introduced P0 in
      any case, 3.1 reverts.
- [ ] **3.3 Cost receipt.** Measure tokens and hook time on non-UI transcripts
      before and after Phases 3 and 6 and assert the design catalog loads 0 times
      there. A measurement, not a gate.
      verify: a before/after table in the PR.

## Phase 4 — One copy engine

- [ ] **4.1 The slop `copy` engine delegates to the tell registry.** CP1/CP2/CP5
      keep their ids and become views over `ai_tells_rules.ts`; one buzzword
      source; the dash cap stays one constant.
      verify: findings on the FP corpus and on `src/ui` + `site/` identical before
      and after (snapshot); `grep -n "const BUZZWORDS"
      src/scripts/design_slop_rules.ts` → gone.
- [ ] **4.2 Answer the rejection with the number that exists.** CP3 maps to
      `tell-negative-parallelism`; CP4 and T5 to candidate rules on the prose FP
      bench; each gets `backed` or a named null with its M1.
      verify: the T5, CP3, CP4 rows of `design-antipatterns.md` carry a status
      with an M1 or a named null; parity green.

## Phase 5 — Prose: recall on someone else's corpus, facts that cannot move

- [~] **5.1 External recall/FP split.** An external humanizer corpus's
      before/after pairs as `tests/fixtures/ai-tells/external/`, reported as
      their own split (recall per family, FP on the after side); scoped as
      mechanism reach, not real-draft lift. Blocked:
      `external-test-data-licence` (OQ-20).
      verify: the bench prints an `external` split; CLAIMS gains a separate claim
      scoped to it.
- [ ] **5.2 New deterministic families only where a matcher exists.** In
      strength order, each pre-registered and FP-run on the clean prose corpus:
      heading echoed in the first sentence (token overlap), repeated sentence
      openings (≥ 3 consecutive same first bigram), a repeated one-line closer,
      a strawman-preemption opener list, a self-describing-document list. The
      rest stay model-judged and are listed so in
      `src/skills/humanizer/references/anti-aiisms.md`. A family lands only at
      M1 = 0; German equivalents in the same PR or named as gaps.
      verify: per family, clean-corpus M1 = 0 and recall ≥ 1 on its positive
      fixtures; rule-count delta equals families passed.
- [ ] **5.3 Deterministic fact diff.** `detect_ai_tells --baseline <before.md>
      <after.md>` extracts numbers, dates, currency, URLs, code spans and
      capitalised multi-word names from both texts; anything lost or added is a
      hard finding. The humanizer's step 6 calls it instead of `[VERIFY]`.
      verify: fixtures for a dropped number, a changed date, an added name and a
      pure reword (clean); `src/skills/humanizer/SKILL.md` step 6 names the
      command.
- [ ] **5.4 Reach.** Replace the humanizer's cross-pack links with
      named-not-linked prose (the convention `logo-generation` uses).
      verify: `lint_pack_boundaries` drops by 5 humanizer rows with no new
      `suggests` edge.

## Phase 6 — Product truth that survives a second skill

- [ ] **6.1 Dialect detection before any write.** `design-system-capture`
      classifies an existing PRODUCT.md as `ac-interaction`, `product-truth`
      (Register / Users / Product Purpose / Anti-references / Design Principles)
      or `unknown`; a file it does not own is read, never rewritten; additions
      are proposed as a diff.
      verify: three fixtures; the foreign-format fixture is byte-identical after
      a capture run.
- [ ] **6.2 Interop, not a rename.** The template becomes a superset (Register,
      Users, Purpose, Anti-references, Principles, and Interaction patterns as
      one section).
      verify: template diff; `design-system-capture/evals/evals.json` gains a case
      reading an external-format file.
- [ ] **6.3 Wire the dead authority level.** A reader produces
      `design_md`/`product_md` `{present, register}` from declared fields only
      (0.2's reader) and passes them to `resolveUiAuthority`; T7/T8 consume the
      stated register.
      verify: a DESIGN.md declaring `register: product` lifts T7 on Inter and an
      undeclared one does not; `src/scripts/_lib/ui_authority.test.ts` green; a
      non-test producer of `design_md` exists.

## Phase 7 — Logos with a process and a proof

- [ ] **7.1 Process.** `logo-generation` gains a divergence step (≥ 3 concepts
      of different mark types, one-line idea each), a stop point before the
      export kit, and a critique mode (scorecard, top-3 fixes, equity note) for a
      supplied mark.
      verify: the SKILL.md diff; the body stays under the skill size lint.
- [ ] **7.2 Name the witness it already has.** The vector path runs
      `agent-config ui:render <mark.svg> --profile asset --class mark` (16/32 px
      on light and dark); legibility is never claimed without that capture.
      verify: `grep -n "profile asset" src/skills/logo-generation/SKILL.md` ≥ 1.
- [ ] **7.3 Shelf test from the user's inputs.** User-supplied competitor or
      category marks render beside the candidate at the same sizes; nothing is
      bundled; `image-likeness-and-rights` stays mandatory.
      verify: an eval case with two supplied marks; no third-party mark is added
      to the tree.
- [ ] **7.4 Behaviour evals.** Three cases: a three-direction brief, a
      favicon/app-icon brief that stops before the kit, a critique of a supplied
      mark.
      verify: `src/skills/logo-generation/evals/evals.json` with 3 cases accepted
      by `src/scripts/run_skill_evals.ts`.
- [ ] **7.5 Export kit.** Define the kit 7.1 stops before: SVG, PNG at 1×/2×,
      favicon set with webmanifest, light/dark lockups, reproducible from one
      command.
      verify: the command produces the kit twice byte-identical from one fixture.
- [ ] **7.6 (candidate, pre-register first) Mark audit readings.** Monochrome and
      reversed renders at the mark sizes, a 96 px capture, and sub-pixel detail at
      16 px (features under 1 px rendered extent); path complexity and
      text-to-path only through `road-to-svg-witness-provenance`'s
      pre-registration, otherwise named nulls.
      verify: a PREREG file, or the step closes as a named null.

## Phase 8 — Currency and the mirror

- [ ] **8.1 The 2026-Q4 review the catalog scheduled.** Re-date the
      current-generation section; add D14's tells only where ≥ 2 independent
      sources name them or the dogfood split shows them, each as `candidate` or
      `judgment-only`, never `backed`.
      verify: `design-antipatterns.md:51` carries the new date; parity green.
- [ ] **8.2 The tree's own UI declares or fixes.** A `DESIGN.md` for `src/ui/` and
      `site/` declaring the stripe system where it is semantic through 0.2's
      reader; non-semantic stripes removed; CP1 in the site docs under the cap or
      a declared voice exception.
      verify: `lint_design_slop --dir src/ui` and `--dir site` report only
      declared or justified findings; the count is in the PR body.
- [~] **8.3 (maintainer-run) Differential oracle.** The external detector beside
      ours on the Phase 1 splits, from the maintainer's machine only (external
      code, never in CI); every disagreement becomes a triage row. Waits on a
      maintainer run: executing third-party code is outside an agent run.
      Blocked: `maintainer-run-differential-oracle`.
      verify: a triage table under `agents/evidence/analysis/`; zero dependency
      added.

## Blockers

### blocker: external-test-data-licence
- **Status:** open — 2026-10-26, put to the owner as OQ-20 in `agents/owner-questions.md`
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** steps 1.5, 5.1
- **Question:** May third-party test data enter the tree as attributed, separately reported splits — the external design source's should-pass fixtures (Apache-2.0) and the external humanizer corpus's before/after pairs (MIT)? Taking third-party licensed material into the repository is a licensing commitment, which is owner-reserved.
- **Recommendation:** (a) — both licences permit it with attribution, both stay separate splits never folded into a headline, and without them the detector is only ever judged on corpora this repo wrote.
- **If you do nothing:** Phases 0-4 and 6-8 run; the external splits stay absent and every precision claim stays self-judged.
- **What to do:** pick exactly one — (a) accept both as attributed separate splits; or (b) accept the MIT pairs only; or (c) accept neither and cancel 1.5 and 5.1.
- **Resolved when:** OQ-20 sits under `## Answered` in `agents/owner-questions.md` and Status reads resolved.

### blocker: maintainer-run-differential-oracle
- **Status:** open — 2026-10-26, waits on a maintainer run
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 8.3
- **Question:** Run the external detector on your machine, or cancel 8.3? The run executes third-party code, which an agent run does not do.
- **Recommendation:** run it after Phase 1 lands, so the splits exist to compare on.
- **If you do nothing:** 8.3 stays open; nothing else here waits on it.
- **What to do:** pick exactly one — (a) run the external detector locally on the three Phase 1 splits and commit the triage table; or (b) cancel 8.3.
- **Resolved when:** the triage table exists under `agents/evidence/analysis/` or 8.3 is cancelled, and Status reads resolved.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Land active and process now; supersede and archive `later/road-to-tell-detector-promotions`, carrying its five items (1.3, 2.4, 2.5, 2.6). | The owner's invoking turn of 2026-10-26. | — |
| D2 | reversible-technical | agent | Browser reach first by resolving an optional `playwright-core` and a system browser, without adding a dependency; the dependency or CDP-client choice is OQ-21. | A runtime dependency changes every consumer install; the resolution path changes none. | OQ-21 is answered. |
| D3 | reversible-technical | agent | Humanizer reach by de-linking (5.4), not by moving packs. | No schema change; the `logo-generation` precedent. | A pack restructure is planned anyway. |
| D4 | reversible-technical | agent | PRODUCT.md interop by superset template, not by renaming this tree's file. | One file means one thing in both ecosystems; no migration. | — |
| D5 | reversible-technical | agent | Hook attribution never unblocks an incumbent P0; it is reported, never downgraded. | The P0 floor is a safety floor. | — |
| D6 | reversible-technical | agent | The drafted plan's step 0.5 (inbox note to `road-to-consumer-invocations-that-install`) is dropped as already satisfied. | That roadmap already lists both sites (`:65`, `:70`). | — |
| D7 | reversible-technical | agent | Kept from the drafted plan's kill register: no porting of the source's design commands (CLI budget 119/119, ADR-041); no external detector as a dependency; no detector evasion goal; no bundled third-party logo library; no 0-10 self-scores; no blocking every hook finding; external fixtures never in the headline number; no second DESIGN/PRODUCT schema. | Drafted plan K1-K8; `src/config/evaluator-budgets.json` `cli_help_command_count`. | — |
| D8 | reversible-technical | agent | Declined from the external plan: a typed `design_evidence` envelope and trace links, a `capability-gap.json` inventory, render caches and budget tiers, a 20-task × 3-run blind benchmark with token release gates, skill-listing retrieval, an upstream watcher, a public gallery, a logo metadata search adapter. | No measurement would fill a new schema yet; the defect register is the inventory; 3.3 produces the cost evidence first; retrieval is out of topic; the trademark concern of D7 extends to metadata search. Already in the tree: the polish ceiling, SVG active-content rules, the authority ranking, the provenance ledgers, encrypted links, PR-only merge flow. | 3.3 shows a cost the declined items would address. |
| D9 | deterministic | evidence | Closure pass ran 2026-10-26: the only hit is the quoted owner demand in the Source header; OQ-20 carries the owner-owned residue and 8.3 waits on a maintainer run. | `closure_scan` over this file. | — |

## What verification changed

- No in-scope source changed since the pin; only line numbers in
  `docs/CLAIMS.md` and the settings template moved (now `:812-817`, `:1317`).
- D7's external figures could not be re-measured; the claim is stated as
  unverified and 5.1 carries the baseline.
- D15 is narrower: the svg syntax documents an optional reason, neither parser
  records one.
- 0.5 was redundant (D6); 3.2's "baseline transcripts" do not exist and now
  replays the frontend-corpus cases; 5.2's `patterns.md` is
  `references/anti-aiisms.md`; test paths in 0.2 and 6.3 are under `src/scripts/`.
- The superseded file's A2, A3, B1 and B2 had no counterpart in the drafted
  plan; they are 2.4, 2.5 and 2.6. Its A1 covers four signals, now 1.3.
- From the external plan: page dark-scheme capture (2.2), a cost receipt (3.3),
  an export kit (7.5) and mark audit readings (7.6).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Near-misses demote most backed rules | product | The detector loses coverage when it finally meets refutable data. | One tuning attempt per rule before demotion (1.6); a demotion is an honest null, not a loss. | Phase 1 — A corpus that can say no |
| 2 | The intent reader breaks existing DESIGN.md files | implementation | Projects relying on substring suppression get findings back. | One minor version of report-only fallback (0.2). | Phase 0 — Close the cheap lies first (no new surface) |
| 3 | Render rules are flaky across browsers | implementation | Geometry differs by engine and fonts. | Rules read computed styles and boxes, never pixels; one row per epoch (2.5). | Phase 2 — A witness for what only a render can show |
| 4 | Attribution hides an introduced defect | product | A normalised snippet collides with an incumbent one. | 3.2 replays before keeping it; P0 floors still block (D5). | Phase 3 — Say only what the edit introduced |

## Acceptance Criteria

- [ ] AC-1 — No DESIGN.md sentence silences a rule unless it declares intent; 0.1's fixtures prove it.
- [ ] AC-2 — Every `backed` design tell has an M1 on a corpus containing a legitimate near-miss for it.
- [ ] AC-3 — Hook reports separate introduced from incumbent findings, and no introduced P0 is hidden in 3.2's replay.
- [ ] AC-4 — `logo-generation` never claims small-size legibility without an asset-profile capture.
- [ ] AC-5 — The humanizer's fact check is a command, not a self-report.
