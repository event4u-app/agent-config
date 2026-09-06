---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-host-enforcement-truth
    relation: disjoint
    note: >
      That roadmap owns per-host enforcement capability — can host H enforce
      decision D, answered from one table with an expiry. This one owns three
      published statements this repository makes about itself that the tree
      contradicts, none of them host-scoped.
estate_growth_exempt: "Three published statements contradicted by the tree they describe, each reproduced at 6af83a64b and owned by nothing: `docs/proof.md:307` publishes 81 rules as carrying no `enforced_by` `yet` while `internal/reports/enforcement-coverage.json` records `kernel_denied: 9` for rules a guard structurally forbids from ever carrying it; `src/domains/engineering-base/review/changes/command.md` says six judges in its description, its prose and its dispatch heading while listing seven in its own table and calling them seven four lines later; and `.github/workflows/site.yml:6` states the site is not public while `deploy-site.yml` has published it to Pages since 2026-07-05. This package's whole positioning is that its figures are resolved rather than asserted, which is what makes three self-contradicting ones a defect rather than a nit."
estate_offset_exempt: "Cannot be offset. Its three subjects sit on three unrelated surfaces with no shared owner, so there is no roadmap whose archival would pay for it without leaving one of them unowned."
---
# Road to figures that name their denominator

> **Source:** `agents/tmp.old/inbox-2026-09-r/` — one of eleven prepared harvest
> loops delivered on 2026-09-06. The judge-count drift and the coverage
> denominator were named there; the site-publicity contradiction is this run's
> own reproduction. Every figure below was re-derived rather than quoted.

## Goal

A number or a statement this repository publishes about itself is either true of
the tree or carries the reason it is not. Three are neither. **One:**
`docs/proof.md:307` reads `81 undeclared (no enforced_by yet)`, and
`internal/reports/enforcement-coverage.json` carries `kernel_denied: 9` with its
own `_doc` explaining that those rules "cannot carry an `enforced_by` field at
all — `block_kernel_rule_writes` refuses the write, no agent-accessible
override". Counting them as uncovered is a deliberate and defensible policy,
stated at `docs/proof.md:69`; publishing them under the word **yet** is not,
because for nine of the 81 there is no yet. **Two:**
`src/domains/engineering-base/review/changes/command.md` says "six specialized
judges" in its `description:` (`:12`), in its opening prose (`:27`) and in its
dispatch heading (`:112`), lists **seven** rows in the table at `:117-125`, and
says "The seven judges weight equally" at `:127`; the frontmatter `skills:` list
carries all seven. **Three:** `.github/workflows/site.yml:6` justifies its path
filter with "the site is not public yet", while `.github/workflows/deploy-site.yml`
has deployed to GitHub Pages on every push to `main` since `9762e0e68`
(2026-07-05). Out of scope by decision: changing the coverage policy itself
(whether kernel-denied rules count as uncovered is settled and stays settled),
and any change to which judges run.

## Phase 1 — The coverage line says what it counts

- [ ] **1.1 Publish the kernel-denied split beside the undeclared figure.** The
      resolver already computes `kernel_denied`; the published line drops it. Print it,
      and replace `yet` with wording that holds for the nine — the policy is unchanged,
      only the claim about their future is.
      verify: `docs/proof.md` § 4b names both numbers, and no published surface says
      `yet` about a rule `check_enforcement_coverage` reports as kernel-denied.
- [ ] **1.2 Fail the publication when the two disagree.** `check_enforcement_denominator`
      already reds when a figure appears in a doc the resolver did not generate; extend
      it so a published `undeclared` figure that omits the kernel-denied split is the
      same class of failure.
      verify: a branch that removes the split from `docs/proof.md` reddens the check,
      and restoring it greens it.

## Phase 2 — The command counts its own judges

- [ ] **2.1 Correct the count at every site, from the table.** The table is the
      authority: seven rows, seven frontmatter entries, seven dispatched. Bring `:12`,
      `:27`, `:112` and every remaining prose occurrence into line with it, keeping the
      passages that legitimately say "the other six" — those count a set minus one and
      are correct as written.
      verify: every cardinal in the file that refers to the judge set matches the row
      count of its own table, and the two "why the seventh exists" passages still read
      correctly against their neighbours.
- [ ] **2.2 Bind the number to the table.** A hand-typed count beside a list is the
      defect; a check that reads both is the fix.
      verify: adding an eighth row to the table without touching the prose reddens a
      check, and updating both greens it.

## Phase 3 — A workflow comment does not contradict its sibling

- [ ] **3.1 Correct the site-publicity statement.** `site.yml:6` reasons from a premise
      that stopped holding on 2026-07-05. Either the filter's justification is rewritten
      to the real reason, or the filter is widened to the surfaces `deploy-site.yml`
      already publishes — the two workflows disagree today about whether `docs/**`
      changes reach the site.
      verify: no comment in `.github/workflows/` asserts the site is unpublished, and
      the two workflows' path filters are either identical or their difference is
      stated in one of them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The coverage policy is changed while the label is being fixed | product | Subtracting the nine kernel-denied rules from the denominator would raise the published percentage without a single rule becoming more enforced, and it is the obvious next edit once the split is visible. | The goal names the policy as out of scope by decision and cites `docs/proof.md:69` where it is argued; 1.1 changes only the wording and adds a number, and 1.2's check fires on a missing split rather than on a particular ratio. | Phase 1 — The coverage line says what it counts |
| 2 | The judge-count fix breaks the passages that correctly say six | implementation | Several occurrences mean "the other six" — the set minus the one being discussed — so a mechanical replace of every `six` with `seven` would introduce errors while closing a consistency finding. | 2.1 names those passages explicitly and its verify requires them to still read correctly; 2.2's check compares against the table's row count rather than against a literal, so a legitimate "other six" is not a violation. | Phase 2 — The command counts its own judges |
| 3 | Widening the site filter starts publishing surfaces nobody reviewed | product | Phase 3 offers filter-widening as one of two outcomes, and the wider filter means `docs/**` changes deploy to a public site — a publishing change disguised as a comment fix. | 3.1's verify is satisfied by the cheaper outcome, a corrected justification with the filters left alone; widening is permitted but never required, and the step requires the difference between the two filters to be stated wherever it remains. | Phase 3 — A workflow comment does not contradict its sibling |
| 4 | Three unrelated surfaces make one roadmap that half-lands | implementation | The three defects share a shape and nothing else, so the cheap phases can ship while the one with a real check attached stalls, leaving a roadmap that looks mostly done and fixed the least. | Each phase carries its own binding check rather than a prose correction alone (1.2, 2.2), so a phase that lands only its wording half is visibly incomplete against its own acceptance criterion. | Phase 1 — The coverage line says what it counts |

## Acceptance Criteria

- [ ] AC-1 — The published enforcement figure names both the undeclared count and the kernel-denied count, and no surface claims a kernel-denied rule may yet declare.
- [ ] AC-2 — Removing the split from the published doc reddens a check that was green before this roadmap.
- [ ] AC-3 — Every cardinal describing the judge set in `review/changes/command.md` matches its own table, and the set-minus-one passages are unchanged.
- [ ] AC-4 — Adding a row to the judge table without touching the prose reddens a check.
- [ ] AC-5 — No workflow comment asserts the docs site is unpublished, and the two site workflows' path filters are identical or their difference is stated.
