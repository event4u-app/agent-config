---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: no sibling roadmap owns docs/ dead-path repair. The archived
# road-to-contract-review-deadlines dispositioned the nine dead LINK targets and
# is cited below rather than related-to, because it is archived.
estate_offset_exempt: "Stays one active roadmap against a floor of 1, and does not add one — it was already active before this change. Re-scoped rather than replaced on a 2/2 AI-council verdict; it cannot be parked, because the narrow class it now covers is live normative contracts asserting present applicability of a file that does not exist, and it cannot fold into anything: no sibling roadmap owns docs/ path drift."
---
# Road to Python-era doc references

> **Re-scoped 2026-09-03 on a 2/2 AI-council verdict, and narrowed
> substantially.** The original scope — classify and repair all 946 dead `.py`
> occurrences across 233 files — was declined by both seats against this
> repository's own precedent. What replaced it is the class where the argument
> actually holds, and that class is now **closed**. The remainder is
> dispositioned per class with a written reason rather than left as pending
> work.

## Goal

A reader following a script path named in a live doc reaches a file that exists,
or is told plainly that the path is historical.

**Narrowed:** "a live doc" means a doc that asserts **present applicability** —
a contract saying a gate *is enforced by* a path, or a link a reader can click.
A backticked path inside a historical sentence is a name, not a promise, and is
dispositioned rather than rewritten.

## Context

The Python era ended with ADR-200. The entry points did not stop being named.

### The matcher, pinned

Risk #3 below requires a reproducible baseline, and the original Context
described the matcher in prose instead of pinning it — which is why the numbers
could not be reproduced. The matcher is:

```
[A-Za-z0-9_][A-Za-z0-9_./-]*\.py\b
```

run over `docs/**/*.md`, with the historical bucket defined as
**`docs/archive/` only** (see 1.2 for why the original `CHANGELOG*` glob was
wrong).

### The measurement, re-run 2026-09-03

| Bucket | Occurrences | Distinct paths |
|---|---|---|
| live docs | **946** | **441** |
| historical (`docs/archive/`) | 143 | 51 |
| **total** | **1,089** | **467** |

Live occurrences span **233 files**.

**Corrected from the original table, which said 449 distinct live and 475
total.** Every *occurrence* count reproduces to the digit, so the matcher is the
same one; the distinct counts do not, and 449/475 is an arithmetic or dedup
error inherited verbatim from the archived roadmap that produced it. The
original AC-1 said "every one of the 449", which was unsatisfiable by
construction.

### The syntactic split, which is what decided the scope

| Form | Occurrences | Who can see it |
|---|---|---|
| a markdown inline link target — `[x](path)` | **9** | a reader who clicks; the standing dead-link measurement |
| inside backticks | **905** | nothing |
| bare in prose | **32** | nothing |

A backticked `` `scripts/install.py` `` is not a link. A reader does not follow
it; they read it as the name of a thing. So "a dead path misleads a reader who
follows it" is strongest for the 9 and weakest for the 905.

### The precedent that narrowed this roadmap

ADR-200 — the record that *ended* the Python era — declined a directly
analogous change:

> "Renumbering was evaluated and declined: 521 files reference 'ADR-200' as a
> stable identifier; a rename would be a 521-file mechanical churn (projections,
> condensation hashes, docs) for zero behavioral gain."

The original scope was **larger** than the churn ADR-200 refused. Both council
seats held that the distinction which survives is **semantic actionability**,
not the token count: a *dead path a reader follows* or *a contract asserting a
gate that does not exist* misleads; a *name in a historical sentence* does not.

### Three things this roadmap must not assume

**Not every live-doc mention is drift.** An ADR whose *subject* is the Python
pilot names Python files correctly. `ADR-006` already carries
`historical: Python pilot; zero .py remains post-ADR-200` in its own
frontmatter, so its disposition was done before this roadmap existed.

**A mechanical rename is the tempting wrong fix.** Several Python-era scripts
were merged, split or dropped rather than ported, and a rename that invents a
successor is worse than the dead path it replaces, because it looks resolvable.

**Basename coincidence is not identity.** Before any replacement, three facts
must hold: the reference concerns **this** repository; it claims **present**
applicability; and the successor identity rests on **more than a matching
basename**. Both seats made this the gate on every rewrite.

## Phase 1 — Separate drift from history

- [x] **1.1 Pin the matcher and re-measure, and declare that the baseline.**
      Neither 449 nor 475 is reproducible, and recovering them is archaeology on
      an archived roadmap for zero behavioural gain. The regex above is pinned
      in this file, the numbers above are its output, and they are the baseline
      regardless of either prior figure.
      verify: the table in § The measurement reproduces from the pinned regex.
      **Done.** 946 / 143 / 1,089 occurrences and 233 files reproduce exactly;
      441 and 467 replace 449 and 475. Council D1(c), 2/2.
- [x] **1.2 Correct the historical bucket, which hid the sharpest instance.**
      The original filter was `docs/archive/` ∪ `CHANGELOG*` ∪
      `docs/migrations/`. Measured: `docs/archive/` is 43 files, **all** of them
      `CHANGELOG*`, and `docs/migrations/` holds exactly one file. So the
      `CHANGELOG*` glob added nothing except one file it should never have
      caught — `docs/contracts/CHANGELOG-conventions.md`, a **live normative
      contract**, which said in the present tense that a drift gate
      *"fails when"* the current era exceeds 250 lines and named a file that
      does not exist.
      verify: the historical filter is `docs/archive/` only, and the contract is
      in the work set.
      **Done, and the successor's identity is established beyond basename:**
      the target's own header calls itself a *"mirror of
      tests/test_changelog_eras.py"* and enforces the same
      `CURRENT_ERA_BODY_CAP = 250`. The original AC-4 required the CHANGELOGs
      byte-identical, which would have **preserved** this defect; it is rewritten
      below. Council D2(a), 2/2.
- [x] **1.3 Extend the taxonomy — three buckets do not partition the set.**
      The original AC-1 required three buckets with no remainder. At least two
      further classes exist, and forcing them into "correctly historical" would
      manufacture false provenance:
      **not this repository's Python era** — `docs/guidelines/agent-infra/ios-simulator-guide.md`
      contributes 10 occurrences that its own text calls *upstream* helpers to
      run from a cloned upstream repo; plus a naming-convention template using
      `src/scripts/foo/bar.py` as a literal placeholder, a `file.py:142` <!-- ref-ignore -->
      path-with-line format example, and a glob with `<NN>` placeholders where
      the matcher captured only the tail;
      **correct against a different root** — `docs/end-to-end-walkthroughs.md`
      names `src/calculator.py` and `tests/test_calculator.py`, and live twins <!-- ref-ignore -->
      exist at `tests/golden/sandbox/repo/src/calculator.ts` and
      `tests/golden/sandbox/repo/tests/calculator.test.ts`. The doc is describing
      a **sandbox repo's own root**. A unique-basename rewrite would have
      repointed it at a repo-root path and broken a correct document — Risk #1
      firing on real data.
      verify: the five classes are named in § The disposition, and AC-1 is
      reworded away from "three buckets".
      **Done.** Council D5(a), 2/2, including "do not call all leave-alone cases
      historical".

## Phase 2 — Repair the narrow class

- [x] **2.1 Repair every live contract asserting present applicability of a
      file that does not exist.** This is the class where the path-vs-identifier
      distinction holds without argument: a contract saying a gate *is enforced
      by* `X` is falsified when `X` does not exist.
      The search both seats asked for — "the glob hid one; there might be more" —
      found **35** such claims across `docs/contracts/`, not one.
      verify: zero present-tense or runnable-command references to a
      non-existent `.py` path remain in any live doc outside the accepted
      classes, measured by the same predicate that found them.
      **Done — 0 remaining across all of `docs/`** (excluding `docs/archive/`,
      `docs/decisions/`, `docs/adrs/` and `docs/migrations/`, which are the
      accepted history classes). 94 occurrences repaired across 41 files;
      the live-doc count fell from 946 to 852. Of the first 35 found:
      **4 were already correct** and are left alone — a dead label over a *live*
      link target (`[`scripts/_lib/fs_atomic.py`](…/fs_atomic.ts)`), which is
      the deliberate pattern `ADR-006` uses and which resolves when clicked.
      **21 were unambiguous** and repaired, each verified against the
      three-fact rule rather than by basename: several targets name themselves
      the py2ts twin in their own headers, one is the same path with a `.ts`
      extension, and the settings-sync successor was confirmed by running it and
      counting the 15 tests the contract claims.
      **7 were ambiguous by basename and resolved by a per-site read** — the
      council's D3(a) — once `dist/` projections were excluded as projections
      and the path tail was used: `install.py` resolved to
      `src/scripts/install.ts` at both sites (the installer, not the HTTP route)
      on the sentence's own reading.
      **3 had no successor and are described, not renamed**, per 2.2's own rule:
      the MCP import-surface guard did not survive the port *and its subject no
      longer applies* — it asserted no `subprocess`, `os.system` or `os.popen`,
      which are Python constructs — the MCP suite was **split** into three
      files, and the 34-test round-trip suite was **dropped** with no successor
      under any name.
      Two defects introduced by the repair itself were caught and fixed in the
      same pass: two sentences still called a now-`.ts` target "the Python
      module" / "Python", which is a *new* false claim created by fixing the
      path alone.
- [x] **2.2 Handle the no-successor cases by describing, not renaming.** Where
      no successor exists, say what happened rather than invent a path — the
      pattern `docs/capability-matrix.md` uses, where dead paths were described
      rather than reproduced so that every path the header names resolves.
      verify: no invented path; each entry either resolves or names no file.
      **Done** for the three inside 2.1's class. `check_references` is green and
      the standing dead-link count is unchanged at 297, so nothing was broken
      and no path was invented.
- [x] **2.3 Disposition the nine dead LINK targets — by citing the decision
      that already made them, not by remaking it.** These are the strongest
      class on the misleads-a-reader axis, and they are **already
      dispositioned**: the archived `road-to-contract-review-deadlines` step 4.2
      recorded that each names a file the migration **deleted** rather than
      renamed, that six of the nine sit in `docs/contracts/`, and that each is
      therefore *"a coverage claim with nothing behind it"*. It also named the
      condition for repair: *"deciding whether the coverage still exists, which
      is seven contracts read against the current suite"*.
      verify: the nine carry a reason, and this roadmap does not relitigate it.
      **Done.** Re-checked independently in this change: **none** of the nine
      has a successor under any name, which strengthens that record rather than
      reopening it. Repairing them means deciding whether seven contracts' rules
      are still covered — named in § What is not repaired as the one piece of
      remaining work with an owner.

## Phase 3 — Notice the next one

- [x] **3.1 Decide the gate question, and record the answer. The answer is no.**
      The original step called a dead-path linter over `docs/` "cheap to write".
      That premise was stale: `src/scripts/measure_docs_dead_links.ts` already
      exists, already breaks `.py` out as its own class, and already declines to
      be a gate for a recorded reason — *"MEASUREMENT ONLY … a gate landed
      before that decision would pre-empt it"*. It runs green: 297 dead links
      of 4,626 across 731 files, 9 with a `.py` target.
      And the scope question it defers was already answered **narrow** one
      surface over: `check_references` scans
      `['dist/agent-src', 'agents', 'docs/guidelines']`, and widening it to all
      of `docs/` was priced at ~300 findings and rejected as the flood that gets
      a gate waived rather than adopted. Re-measured: 297.
      verify: the decision is in this file with its reasoning.
      **Decided: no new gate.** Three reasons, all measured. (1) The standing
      instrument exists and covers the 9 — the only class with a clickable
      failure. (2) A backticked-token gate would need a leave-alone allowlist
      covering roughly **37 %** of the corpus (`docs/decisions/` +
      `docs/adrs/` alone is 346 of 946 occurrences), which is the
      "unignorable exclusion list" Risk #4 names as the shape a warning takes on
      its way to being ignored. (3) Gate registration keys on a name prefix
      (`lint|check|audit|skill|verify`), so `measure_docs_dead_links` cannot be
      registered as one without being renamed — and renaming it would assert
      the gate status its own header declines. Council D6(a), 2/2.

## The disposition — five classes, per-class reasons

Inventory: **946** live occurrences across 233 files. Repaired: **94**
occurrences across **41** files — the live-doc count is now **852** across
**221** files, measured with the same pinned matcher. The rest is dispositioned,
not pending.

The repaired set grew past the 35 claims of 2.1 because the predicate was
sharpened twice while executing, and both widenings were the council's: seat 1
asked for the command-example class, and seat 2 refused "categorical acceptance
of all 901" on the ground that "backticks often mark executable commands or
copyable paths — syntax alone cannot establish harmlessness". Adding
`blocks|returns|wraps` to the present-tense predicate and a runnable-command
predicate surfaced a tail in `docs/quality.md`, `docs/threat-model.md`,
`docs/command-flows.md`, `docs/setup/`, `docs/distribution/`,
`docs/maintainers/` and `docs/architecture/` that the first pass did not reach.
Every one of them was a live doc asserting present applicability.

| Class | Occurrences | Disposition |
|---|---|---|
| Live doc asserting present applicability | 94 occ. / 41 files | **REPAIRED** (Phase 2.1), or already correct as a dead label over a live link target |
| Dead markdown link target | 9 | **DISPOSITIONED** by the archived record cited in 2.3; repair condition named there and below |
| Decision records — `docs/decisions/` + `docs/adrs/` | 346 (36.6 %) | **ACCEPTED.** A decision record describing what was true when it was written is history wearing a live path — this roadmap's own § Three things says so, and ADR-200's churn reasoning applies unchanged |
| Not this repository's Python era | ~14 | **ACCEPTED, and must not be described as historical.** Upstream third-party helpers, a naming template's placeholder, a path-with-line format example, a glob whose tail the matcher captured. Calling these migration leftovers would be a fresh false claim |
| Correct against a different root | ~8 | **ACCEPTED.** The sandbox-repo walkthrough is correct as written from that repo's root; a rewrite would break a correct document |
| A linter's own search pattern | 1 | **ACCEPTED, and rewriting it would be a defect.** `docs/evaluator.md` documents `lint_pre_migration_refs` as matching "pip install / python install.py" — the dead path is the *pattern the gate looks for*, so repointing it would break the gate's own documentation |
| Dated history rows | 2 | **ACCEPTED.** `kernel-membership.md`'s "2026-05-06 | P2.2 condensation + …" row and a migration-divergence record whose subject *is* the Python↔TS parity test. Both describe what was true then |
| Remaining backticked / bare prose names | the balance | **ACCEPTED per ADR-200.** A name in a sentence a reader cannot follow is not a promise, and the churn-for-zero-behavioural-gain reasoning is this repository's own, applied to a larger set than it refused |

## What is not repaired, and what would reopen it

**One piece of work has an owner and a condition, and it is not a stub.** The
nine dead link targets are repairable only after deciding whether the coverage
their contracts claim still exists — seven contracts read against the current
suite. That decision is a maintainer's, it was already recorded as such, and
this roadmap does not re-take it.

**Reopening condition for the accepted classes:** a measured instance of a
backticked path actually misleading someone — an agent or a reader acting on a
name and reaching for a file that is not there. Until then the accepted classes
rest on the same argument ADR-200 accepted, and re-opening them on volume alone
would be re-taking a decision this repository has now made twice.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A mechanical rename invents a successor that never existed | implementation | Several Python-era scripts were merged, split or dropped rather than ported; a rename makes a dead path look resolvable, which is worse than leaving it dead. It fired on real data: the sandbox walkthrough's `calculator.py` has a unique-basename match that would have repointed a CORRECT document at a repo-root path | The three-fact rule in § Three things gates every replacement — this repository, present applicability, and identity beyond basename — and 2.1 records how each of the 21 was verified rather than asserting it | Phase 2 — Repair the narrow class |
| 2 | History is rewritten as if it were drift | product | A changelog or a decision record naming a file as it existed then is correct; editing it falsifies the record | The historical filter is `docs/archive/` only and 346 decision-record occurrences are an accepted class with a stated reason. The one file the old glob wrongly protected was a live contract, which is the opposite error and is why 1.2 exists | Phase 1 — Separate drift from history |
| 3 | The sweep is re-run with a different matcher and the numbers move | implementation | A count nobody can reproduce is not a baseline — and this was not a hypothetical: the original table's distinct counts did not reproduce | The regex is pinned literally in § The matcher, and 1.1 declares its output the baseline regardless of either prior figure | Phase 1 — Separate drift from history |
| 4 | A dead-path gate lands noisy and is ignored | product | An unignorable exclusion list is the shape a warning takes on its way to being a comment | 3.1 decided no gate, and priced it: the allowlist would cover ~37 % of the corpus, and the standing measurement already covers the only class with a clickable failure | Phase 3 — Notice the next one |
| 5 | "Disposition" is read as "repair" | product | The roadmap closes 57 occurrences of 946 and dispositions the rest. A reader skimming the acceptance criteria could take that as 946 repaired, which is the over-claim the whole re-scope exists to avoid | AC-1 and AC-2 below are deliberately split into two denominators — inventory completeness and repair completeness — and the § The disposition table states the repaired count against the inventory in the same row | The disposition — five classes, per-class reasons |

## Acceptance Criteria

- [x] AC-1 — **Inventory completeness.** Every one of the **441** distinct live
      dead paths falls into a named class, and the classes partition the set
      with no remainder. Five classes, not three; the count is 441, not 449.
- [x] AC-2 — **Repair completeness.** Every reference that is actionable —
      concerning this repository, claiming present applicability, and with an
      identity established beyond basename coincidence — is corrected. Measured
      as zero remaining present-tense claims naming a non-existent `.py` path in
      `docs/contracts/`.
- [x] AC-3 — No path was invented: every rewrite either points at a file that
      exists or names no file at all. `check_references` green; the standing
      dead-link count unchanged at 297.
- [x] AC-4 — `docs/archive/` and the named history-in-context files are
      byte-identical to their state at the start of the work.
      **Reworded from the original**, which also required "the CHANGELOGs"
      byte-identical and would therefore have preserved the live-contract defect
      1.2 found. `docs/archive/` is 43 files and every historical changelog is
      inside it, so the narrower wording loses nothing.
- [x] AC-5 — Phase 3 carries a recorded decision on the gate question, and the
      "no" states its reasoning. It does, with three measured reasons.
