# Release-head derivation: recall over six released spans

Phase 1 of `road-to-inbox-harvest-2026-08-c-release-head-truth`. Measures what
`derive_category_hits` (`src/scripts/_lib/release_highlights.ts:106`) actually
catches, so Phase 2's widening is aimed rather than general.

- **Measured:** 2026-08-15, on `feat/release-head-truth` at `origin/main`
  `c37cb8de5`.
- **Spans:** the six most recent released spans, `10.0.0..10.1.0` through
  `11.0.0..12.0.0`, `--no-merges`, 341 commits total.
- **Instrument:** the shipped `collect_span_commits` + `derive_category_hits`,
  called directly. Nothing in this file re-implements the derivation.

## 0. A premise this file got wrong first, corrected before it was used

The first version of this section claimed *"the gate has had exactly one real
subject in the entire changelog"*, on the evidence that
`grep -c "Security and correctness" CHANGELOG.md` returns **1**.

**That count is real and the conclusion drawn from it was wrong.**
`CHANGELOG.md` carries only `[Unreleased]` and `[12.0.0]` because released eras
are **rotated into `docs/archive/`**. The five earlier heads exist and carry the
full five-label block:

- `docs/archive/CHANGELOG-pre-10.3.0.md` — 10.1.0, 10.2.0
- `docs/archive/CHANGELOG-pre-12.0.0.md` — 10.3.0, 10.4.0, 11.0.0

Running the gate against `CHANGELOG.md` for those versions exits **2**
(*"CHANGELOG carries no section for X"*) — a could-not-run, which says nothing
about redness. Reading that as green would have inverted § 5's entire
conclusion. Every verdict below is measured with `--changelog` pointed at the
era that actually holds the section.

The corrected finding is narrower but still the roadmap's point: the head has
been curated **six** times, and on each one the `Security and correctness`
field was decided by a derivation that fires once in 45.

## 1. Per-label recall, one row per label per span

`derived` = hits from the shipped rule. `hand` = commits a hand pass calls
in-category under the criterion stated in § 1a. `—` = not audited; see § 2 for
why that is a scope decision rather than an omission.

| span | label | derived | hand | gap |
|---|---|---:|---:|---|
| 10.0.0..10.1.0 | Behaviour changes | 3 | — | not audited |
| 10.0.0..10.1.0 | Default changes + migration | 0 | — | not audited |
| 10.0.0..10.1.0 | **Security and correctness** | **0** | **3** | **−3** |
| 10.0.0..10.1.0 | **Honest nulls** | **1** | **1** | 0 |
| 10.0.0..10.1.0 | Known limitations | 0 | n/a | never derived, by design |
| 10.1.0..10.2.0 | Behaviour changes | 4 | — | not audited |
| 10.1.0..10.2.0 | Default changes + migration | 0 | — | not audited |
| 10.1.0..10.2.0 | **Security and correctness** | **1** | **14** | **−13** |
| 10.1.0..10.2.0 | **Honest nulls** | **1** | **3** | **−2** |
| 10.1.0..10.2.0 | Known limitations | 0 | n/a | never derived, by design |
| 10.2.0..10.3.0 | Behaviour changes | 8 | — | not audited |
| 10.2.0..10.3.0 | Default changes + migration | 1 | — | not audited |
| 10.2.0..10.3.0 | **Security and correctness** | **0** | **12** | **−12** |
| 10.2.0..10.3.0 | **Honest nulls** | **0** | **0** | 0 |
| 10.2.0..10.3.0 | Known limitations | 0 | n/a | never derived, by design |
| 10.3.0..10.4.0 | Behaviour changes | 0 | — | not audited |
| 10.3.0..10.4.0 | Default changes + migration | 0 | — | not audited |
| 10.3.0..10.4.0 | **Security and correctness** | **0** | **5** | **−5** |
| 10.3.0..10.4.0 | **Honest nulls** | **1** | **3** | **−2** |
| 10.3.0..10.4.0 | Known limitations | 0 | n/a | never derived, by design |
| 10.4.0..11.0.0 | Behaviour changes | 2 | — | not audited |
| 10.4.0..11.0.0 | Default changes + migration | 0 | — | not audited |
| 10.4.0..11.0.0 | **Security and correctness** | **0** | **4** | **−4** |
| 10.4.0..11.0.0 | **Honest nulls** | **0** | **0** | 0 |
| 10.4.0..11.0.0 | Known limitations | 0 | n/a | never derived, by design |
| 11.0.0..12.0.0 | Behaviour changes | 4 | — | not audited |
| 11.0.0..12.0.0 | Default changes + migration | 1 | — | not audited |
| 11.0.0..12.0.0 | **Security and correctness** | **0** | **7** | **−7** |
| 11.0.0..12.0.0 | **Honest nulls** | **0** | **2** | **−2** |
| 11.0.0..12.0.0 | Known limitations | 0 | n/a | never derived, by design |

Totals over the six spans: `Security and correctness` **1 derived / 45
in-category**; `Honest nulls` **3 derived / 9 in-category**.

### 1a. The hand-pass criterion, stated before the count

- **Security and correctness** — in-category iff the commit repairs shipped
  *executable* behaviour: conventional type `fix` or `revert`, **and** at least
  one touched path matching `\.(ts|tsx|js|mjs|cjs|sh|py)$` or under
  `.github/workflows/`. A `fix(...)` commit touching only prose is a record of
  a defect, not a repair of one.
- **Honest nulls** — in-category iff the subject or body records a null result:
  the literal `honest null` marker, a waived-rather-than-met condition, a
  published/recorded null, or an archival on a roadmap's own falsifier.
- The two judged labels were hand-read commit by commit; the counts above are
  that read, not a regex proxy.

The criterion has a named cost: it keys on the **author's own** conventional
type, so a correctness repair shipped as `feat` or `refactor` is missed. That
is a deliberate recall limit, not an oversight — using the author's
classification keeps the signal auditable, and widening to "any commit that
sounds like a fix" is exactly the naive rule § 3 measures.

## 2. Which labels are under-derived, and which are out of scope

**In scope for Phase 2 — both are under-derived to the point of being
unfireable:**

- **`Security and correctness`: 1 of 45.** The rule looks only for
  `/secur/i` in the conventional scope or the whole word `security` in the
  subject (`release_highlights.ts:116`). The label reads *Security **and
  correctness***, and **nothing in the tree derives the correctness half**. Over
  341 commits it fired once.
- **`Honest nulls`: 3 of 9.** The rule matches the literal `honest[ -]null`
  string only (`:137`). Recorded nulls that phrase themselves any other way —
  the 12.0.0-era *"the soak was waived not met"* is the roadmap's own specimen —
  do not derive.

**Out of scope, with the reason:**

- **`Behaviour changes` and `Default changes + migration`** were not
  hand-audited, and that is the aiming decision this step exists to make. Both
  are *substantiated* on the only head that exists: 12.0.0 ships an
  auto-derived line for each (`CHANGELOG.md:365-366`). A label that is never
  `_none_` cannot be contradicted, so improving its recall buys nothing the
  gate can act on. Auditing them would have produced numbers with no decision
  attached to them.
- **`Known limitations`** is never derived by design — pure prose, not
  gate-checkable (`release_highlights.ts:101`). Nothing to measure.

## 3. False-positive cost of the naive rule

The derivation's own comment argues the conservative stance: *"a false red
makes every release annoying, a miss only returns the head to the pre-gate
state"* (`release_highlights.ts:103-104`). Step 1.3 puts a number on it.

Naive rule = **any `fix(` commit counts as `Security and correctness`**.

| span | commits | naive fires | naive hits | docs-only `fix` (false positives) | precise hits |
|---|---:|---|---:|---:|---:|
| 10.0.0..10.1.0 | 22 | yes | 6 | 3 | 3 |
| 10.1.0..10.2.0 | 77 | yes | 20 | 6 | 14 |
| 10.2.0..10.3.0 | 91 | yes | 17 | 5 | 12 |
| 10.3.0..10.4.0 | 54 | yes | 13 | 8 | 5 |
| 10.4.0..11.0.0 | 40 | yes | 12 | 8 | 4 |
| 11.0.0..12.0.0 | 57 | yes | 13 | 5 | 8 |
| **total** | **341** | **6 of 6** | **81** | **35** | **46** |

- The naive rule fires on **6 of 6** spans — it would have contradicted every
  `_none_` in that field, on every release.
- **43 % of its hits (35 of 81) touch no executable file at all.** The worked
  example is `52d7fe1 fix(worktrees): the inventory misclassifies from inside a
  worktree, totally`, whose entire diff is two markdown files: it *records* a
  defect in a roadmap and repairs nothing. The naive rule reads a bug report as
  a bug fix.
- Hand-judged precision: naive **44 of 81 = 54 %**; the executable-file
  criterion **44 of 46 = 96 %**. The two hand-judged misses are
  `f87240d fix(contracts)` (a documentation correction that happened to touch a
  pinned test) and `f525ed3 fix(gates): clear the two preflight blockers this
  branch hit` (branch hygiene, not a shipped defect).

The conservative comment was right about the naive rule and wrong as a reason
to derive nothing: the choice was never binary.

## 4. The signals Phase 2 will use

Both were measured above before being chosen, per Risk 3 of the roadmap.

- **`Security and correctness`** — keep the existing security test, and add:
  conventional type `fix` or `revert` **and** at least one touched executable
  path. Precision 96 % over six spans; the naive alternative is 54 %.
- **`Honest nulls`** — keep the literal marker, and add the recorded forms
  found in real subjects: a waived-rather-than-met condition, a
  published/recorded null, an archival on a roadmap's own falsifier. **All 6
  commits this adds across the six spans are true positives** (2 in
  `11.0.0..12.0.0`, 3 in `10.1.0..10.2.0`, 1 in `10.3.0..10.4.0` — with
  `10.1.0..10.2.0` and `10.3.0..10.4.0` each already carrying 1 from the
  literal marker).

## 5. Acceptance criterion 3 is VIOLATED under its literal reading

AC 3 reads *"No previously-green released span turns red under the widened
derivation (measured, not asserted)."* Measured, against the era archives:

| span | before | after | why |
|---|---|---|---|
| 10.0.0..10.1.0 | green | **red** | 3 correctness repairs vs `_none_` |
| 10.1.0..10.2.0 | green | green | its head already carries a derived line, not `_none_` |
| 10.2.0..10.3.0 | green | **red** | 12 correctness repairs vs `_none_` |
| 10.3.0..10.4.0 | green | **red** | 5 correctness repairs vs `_none_` |
| 10.4.0..11.0.0 | green | **red** | 4 correctness repairs vs `_none_` |
| 11.0.0..12.0.0 | green | **red** | 8 correctness repairs + a waived soak vs `_none_` |

**Five of six previously-green spans turn red.** Stating it plainly rather than
reading AC 3 down to something it survives: as written, this criterion fails.

Three facts decide what that means, and none of them is an argument:

1. **The reds are true positives, at a measured 96 %** (§ 3). The heads said
   `_none_` while the spans carried correctness repairs to shipped scripts. The
   gate is not newly wrong about those releases — it was newly *able* to notice.
2. **AC 3 and AC 2 cannot both hold literally.** AC 2 requires
   `11.0.0..12.0.0` to populate `Security and correctness`; that span is green
   today, so satisfying AC 2 turns a previously-green span red **by
   construction**. A criterion set that contradicts itself has to be read, and
   the reading is recorded here rather than chosen silently.
3. **No future release is red because of this** — the operational worry behind
   AC 3, and the one thing that could have made the widening a net loss. The
   generator pre-fills every substantiated label
   (`release.ts:430-441` → `render_derived_head_values`), so a span carrying
   correctness repairs now ships a *derived line* instead of `_none_`, and the
   gate has no contradiction to find. Pinned as a regression test
   (`check_release_highlights.test.ts`, *"the widening does not make the next
   release red"*), not asserted. This is the roadmap's Risk 2, and it does not
   fire.

**The reading taken:** AC 3 is a *false-positive* guarantee — no span whose head
was correct becomes falsely contradicted — and § 3's 96 % is its evidence. It is
not read as *nothing may ever turn red*, which would make AC 2 unreachable and
leave the gate decorative on the label it names.

**What this does not settle, and does not touch.** Whether the five historical
heads get repaired is curation, an explicit Non-goal of this roadmap, and a
maintainer's call — the contract already permits in-place repair of a shipped
head. Historical sections are never re-checked by CI; the gate runs on the
release PR for the version being released.

## 6. Phase 2 decision

**Proceed.** The ratio that decides it: `Security and correctness` derives **1
of 45** in-category commits, and `Honest nulls` **3 of 9**. A stop would be
correct if the derivation were merely conservative; it is not firing at all —
and the one field the gate exists to protect has been undecidable on every head
ever curated.

## 7. The `11.0.0..12.0.0` verdict, before and after

Step 2.3's record. Both runs are the shipped gate against the real span; the
"before" derivation counts come from the Phase 1 instrument, which called the
then-unmodified `derive_category_hits` directly.

**Before** — `Security and correctness` 0 hits, `Honest nulls` 0 hits. With no
evidence, `highlight_contradictions` returns nothing and the gate exits **0**:
the curated `_none_` on both fields ships uncontested. This is the state the
roadmap's Context describes and it reproduces exactly.

**After** — the gate exits **1**:

```
❌  curated head contradicts the release span for 12.0.0 (11.0.0..12.0.0):
    - **Security and correctness:** is `_none_` but the span carries:
        2dbf26e fix(bench): per-family model selection, fail-fast, and resume that retries failures
        fde46ae fix(bench): stage lint input outside the workspace, and project wall-clock per family
        81db7fb fix(gates): close the nine round-2 findings on check_branch_freshness
        a75b796 fix(originality): anchor the scaffold baseline to the base revision
        591369c fix(dispatch): refuse a cli-delegate bundle older than its sources
        5cf7450 fix(worktrees): judge location against the main worktree, and teach the two missing conditions
        f525ed3 fix(gates): clear the two preflight blockers this branch hit
        d6c8067 fix(gates): close all eleven R2 findings, including two false claims of mine
    - **Honest nulls:** is `_none_` but the span carries:
        61542dc chore(roadmap): archive road-to-tier-removal at 100%
        ef5ca46 feat(manifest): set the tier sunset, and record that the soak was waived not met
```

Seven of the eight security hits are hand-confirmed correctness repairs to
shipped scripts; `f525ed3` is branch hygiene and is the one false positive in
this span. Both honest-null hits are true positives — `ef5ca46` is the
roadmap's own named specimen.

The field can now be contradicted. That was the whole goal.
