---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-release-finding-ordering
    relation: disjoint
    note: >
      Same ledger, same gate, deliberately non-overlapping halves. That roadmap
      owns WHEN the consumer reads inside the pull-request workflow, and is
      parked on a synthetic `release/*` branch no autonomous run may open. This
      one owns a post-tag read with no workflow involved, reproducible locally.
      Phase 3 here moves that roadmap's review date and nothing else.
estate_offset_exempt: "Cannot be offset. Its natural offset would be the parked sibling road-to-release-finding-ordering, and that one is Hard-Floor blocked on a synthetic release/* pull request no autonomous run may open — archiving it to pay for this would close the demonstration half by accounting rather than by doing it."
estate_growth_exempt: "Adds one active roadmap against a floor of 1. It closes the half of the release-findings gap that needs no synthetic `release/*` branch — a released version whose ledger was never written, and a gate that prints green for exactly that state — while the parked sibling keeps the half that is Hard-Floor blocked. Folding it into that roadmap would put reproducible-today work behind a maintainer-only demonstration, which is the partition that roadmap was created to avoid. Parking it leaves ten findings from a shipped release, one of them high-severity security, with no record at all."
---
# Road to the unwritten ledger

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0. Three reviewers independently raised the same point;
> the sharpest phrasing was *"Absence is not evidence of zero. Gerade bei
> Sicherheitsgates."* Every number below was re-derived against
> `main@56aa348b3` and the live pull request, not taken from the review.

## Goal

Release 14.16.0 has a findings ledger carrying all ten findings its own release
pull request reported, each with a complete disposition — and a released version
whose ledger is missing can no longer produce a green disposition check.

## The defect, measured

`agents/evidence/release-findings/` holds `9.14.0.json` and `14.15.0.json`.
There is no `14.16.0.json`, and 14.16.0 shipped on 2026-09-04T03:40:10Z
(PR #1836, merged).

That pull request's own gate comment reports **ten findings, one of them
`high (Blocking)` security**, and carries them in a machine-readable block:

```
64d61651eff3  high    security     src/scripts/git_authorization_hook.ts
              Authorization negation defect: trailing negation and
              interrogative suppression leaked operations
564f5716b621  medium  correctness  src/scripts/hooks/merge_impact.ts
fec596e8beb4  medium  correctness  src/scripts/git_authorization_hook.ts
b7f02ba65b83  low     correctness  src/scripts/hooks/merge_impact.ts
14193814d0ed  low     style        src/rules/security-sensitive-stop.md
1eb584e32407  low     claim        src/skills/accessibility-auditor/SKILL.md
06dac819fa16  low     style        src/skills/iconography/SKILL.md
6a202adf5669  low     correctness  src/scripts/design_slop_rules.ts
62a75157ca93  low     claim        src/skills/react-shadcn-ui/SKILL.md
87cfda3a665d  low     correctness  src/skills/design-intelligence/data/ux-guidelines.csv
```

Run against the current tree:

```
$ npx tsx src/scripts/check_finding_dispositions.ts --release 14.16.0
✅  no recorded findings for 14.16.0 (ledger absent)   exit 0
```

An absent ledger for a **released** version reads as zero findings. That is the
`allowEmpty` shape one level up from the ordering defect: the parked sibling
roadmap fixes when the consumer reads inside the pull-request workflow, and this
reads green afterwards, on a tag, with no workflow involved at all.

Two of the ten are **the same defect class the 14.15.0 ledger already recorded as
fixed** — `fec596e8beb4` (PR-number regex cap) against `220223cedd5e` (`fixed` in
`1cf8f708`), and `64d61651eff3` (negation) against `13713a1a9ae6` (`fixed` in
`6a08ed26`). Whether those are regressions, adjacent instances the first fix did
not reach, or duplicate reports is exactly what a disposition establishes and
what nobody can currently answer.

## Phase 1 — Write the ledger that is missing

- [ ] **1.1 Ingest the ten findings.** The machine block is intact on the pull
      request (`<!-- release-findings-json: … -->`), so the ingestion path exists
      without recovering an expired artifact: extract it and feed it to
      `check_finding_dispositions --ingest <file> --release 14.16.0`. Ingestion
      writes empty dispositions on purpose, which makes validation red until a
      human fills them.
      verify: `agents/evidence/release-findings/14.16.0.json` carries ten
      findings with the ids above, and
      `check_finding_dispositions --release 14.16.0` now exits **1**, not 0.
- [ ] **1.2 Disposition the high finding against the tree, not against the
      title.** `64d61651eff3` is reproduced and owned by
      `road-to-one-negation-vocabulary`, which measures a standing merge grant
      surviving `"Merge PR #12 auf keinen Fall."`. Its disposition is therefore
      neither `fixed` (nothing has landed) nor `false_positive`.
      verify: the entry names that roadmap as its receiver and its status is one
      the schema admits, with the reproduction cited in `verified_by`.
- [ ] **1.3 Disposition the remaining nine, each against the tree.** Several
      have plausibly been closed by commits inside the 14.16.0 window
      (`6fa2b068` for the rename/closed-vocabulary pair, `2bd8e506` for the WCAG
      claim, `4461e319` for iconography); a plausible mapping is not a
      disposition. Each entry states what was checked and where.
      verify: `check_finding_dispositions --release 14.16.0` exits 0, and every
      `fixed` row names a commit that a `git show --stat` resolves.
- [ ] **1.4 Say whether the two repeat classes are regressions.** For
      `fec596e8beb4` and `64d61651eff3`, the entry records whether the 14.15.0
      fix regressed, never covered this instance, or the finding is a duplicate
      report — one sentence each, with the evidence.
      verify: both entries carry the comparison to their 14.15.0 predecessor id.

## Phase 2 — Absence stops reading as zero

- [ ] **2.1 A released version with no ledger is red.** `check_finding_dispositions
      --release X.Y.Z` currently returns 0 on an absent file. Where the version
      resolves to a release that exists — a git tag, or an entry in
      `CHANGELOG.md` — an absent ledger is a failure, not a clean pass. A version
      that has not shipped keeps the current behaviour: there is nothing to
      record yet, and reddening that would gate every in-flight release branch
      on a file that cannot exist.
      verify: the gate exits non-zero for `--release 14.16.0` with the ledger
      removed, exits 0 for an unreleased version string, and a test pins both
      directions. A test that only asserts the red half cannot catch the day the
      predicate inverts.
- [ ] **2.2 Name the discriminator in the script's own docblock.** The gate's
      header already explains why the ledger and not the comment is the record;
      it must now also say what makes absence a finding, since a future reader
      changing `allowEmpty` is the person who needs it.
      verify: the docblock states the released-vs-unreleased discriminator and
      the source it reads it from.
- [ ] **2.3 Make a finding id legible as a finding id.** Three separate reviewers
      in this round searched the commit log for `7aee57d1` and reported "no fix
      found"; it is the first eight characters of finding id `7aee57d1e98e`, and
      it looks exactly like a short SHA. One line in the ledger schema's own
      description, and one in the rendered pull-request comment, naming the id as
      a finding id and pointing at the ledger.
      verify: the rendered comment carries the sentence, and a test asserts it is
      present rather than that it merely rendered.

## Phase 2b — A gate that cannot tell a documented defect from an introduced one

Observed on this roadmap's own pull request, 2026-09-04. The self-review gate ran
over a diff of six roadmaps and one evidence file — **prose describing defects,
introducing none** — and reported **ten findings, two of them
`high (Blocking)` security**. Every one maps 1:1 to a defect the diff *documents*:

```
5642305ff717  high  security  road-to-one-negation-vocabulary.md
              "Authorization negation defect now owned but not fixed"
e2fb09a4665b  high  security  road-to-defect-population-sweeps.md
              "Swallowed write in security hook"
```

The gate read the roadmap's own description of a defect elsewhere in the tree and
classified it as a defect in the diff. This is not a small false positive: it is
the shape that makes the enforcement flip the whole round demands unsafe. Under
`--enforce`, **every analysis pull request would be blocked by the findings it
was written to record**, and the only way to pass would be to describe defects
less precisely.

- [ ] **2b.1 State the class before the flip is taken.** The
      `self-review-gate-cost` blocker currently reads as a cost-and-authority
      question. It also has a correctness precondition: the gate must
      distinguish a defect the diff *introduces* from one it *documents*, or
      enforcement inverts the incentive on exactly the artefacts this package
      produces most.
      verify: the blocker text names this class with the run that produced it,
      and the ten finding ids are recorded so the next reading is a comparison.
- [ ] **2b.2 Find the cheapest discriminator, and say if there is none.**
      Candidates, none free: scope findings to non-prose paths; require a finding
      to cite a line the diff *changed* in the file it names rather than a line
      the prose quotes; or accept prose findings as advisory-only while code
      findings block. Each has a failure — the first exempts rules and skills,
      which are prose that ships; the second breaks on a genuine defect a diff
      introduces in a quoted example.
      verify: one discriminator is chosen with the other two's costs recorded, or
      the step states that none is cheap and the enforcement flip stays gated on
      it.

## Phase 3 — The sibling's review date meets its second occurrence

- [ ] **3.1 Pull `review_by` forward with the reason attached.**
      `agents/roadmaps/later/road-to-release-finding-ordering.md` carries
      `review_by: 2026-12-03`, set when the defect had one recorded occurrence.
      It now has two: 14.15.0's 91-second read, and 14.16.0 shipping with no
      ledger at all. A review date is a prediction about how long a parked item
      can wait, and a second occurrence inside one release cycle falsifies it.
      Move the date and record the second occurrence in that roadmap's own
      defect section — the date change without the evidence is a preference, not
      a finding.
      verify: the frontmatter date has moved, the roadmap's defect section names
      the 14.16.0 occurrence with its ledger absence, and this roadmap is listed
      in its `relates`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The nine non-high findings are dispositioned by plausibility | product | Three of them look closed by commits inside the release window, and reading a commit subject is much cheaper than checking the tree — a ledger full of unverified `fixed` rows is worse than no ledger, because it reads as adjudicated | 1.3 requires every `fixed` row to name a resolvable commit, and 1.4 forces the two repeat classes to be compared against their predecessor rather than closed on the title | Phase 1 — Write the ledger that is missing |
| 2 | The released-vs-unreleased predicate inverts silently | implementation | 2.1 makes the gate's behaviour depend on a lookup that can go wrong in both directions; a predicate that starts answering "unreleased" for everything restores today's green with no visible change | 2.1 requires a test pinning both directions, and states that a red-only test cannot catch the inversion | Phase 2 — Absence stops reading as zero |
| 3 | This roadmap is read as closing the ordering guarantee | product | It touches the same ledger and the same gate, and its Phase 2 makes a genuine fail-open red, so the parked sibling could be treated as covered | Phase 3 explicitly moves that roadmap's review date rather than its status, and AC-4 names the demonstration as still owed there | Phase 3 — The sibling's review date meets its second occurrence |

## Acceptance Criteria

- [ ] AC-1 — `agents/evidence/release-findings/14.16.0.json` exists and carries all
      ten findings from PR #1836 with complete dispositions, and
      `check_finding_dispositions --release 14.16.0` exits 0 because they are
      dispositioned, not because the file is absent.
- [ ] AC-2 — Removing that ledger turns the gate red, and an unreleased version
      string still passes, both pinned by tests.
- [ ] AC-3 — A finding id is identifiable as a finding id from the rendered pull
      request comment without opening the source.
- [ ] AC-4 — The `self-review-gate-cost` blocker names the documented-versus-
      introduced class, with the ten finding ids from the 2026-09-04 run, and
      either a chosen discriminator or a statement that none is cheap.
- [ ] AC-5 — `road-to-release-finding-ordering` records the 14.16.0 occurrence and
      a review date consistent with two occurrences; its own AC-2 demonstration
      is untouched and still owed.
