---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: archive/road-to-retired-claims-stay-retired
    relation: extends
    note: "this is the second instance of the failure that roadmap closed; the retirement machinery it built is what Phase 1 widens rather than replaces"
  - slug: archive/road-to-gates-that-do-not-run
    relation: extends
    note: "same class from the other side — a gate that runs and passes because its needle is one variant short of what shipped"
  - slug: road-to-wired-instruments
    relation: disjoint
    note: "owns the count-gate scope fix named in this file's Context item 3; the two must not do that edit twice, but they share no mechanism here"
estate_offset_exempt: Added by the 2026-09-b inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to self-description truth

> **Source:** `agents/tmp.old/inbox-2026-09-b/s07/`, `.../s11/`, `.../s04/` and
> `.../s06/` — four independently drafted reviews that each found a different
> instance of one defect. Every claim below was re-verified against `c6b4f6407`
> by the run that wrote this file.

## Goal

Every shipped surface that describes this package describes it correctly, and
the gates that exist to keep it that way reach the surfaces where the errors
actually are. When this is finished, no consumer-visible file makes a claim
about this package that the package's own ledger has already retired, and no
gate passes green over a defect its own regex matches.

## Context

This package has unusually good machinery for keeping its claims honest —
`docs/CLAIMS.md` with a four-state ledger, `check_claims.ts` scanning five
publish surfaces, `check_artefact_count_messaging.ts` with a per-entry rationale
for every path it watches. The defect is not absence. In each case below the
gate exists, runs, and passes, because its **scope or its needle is one variant
short of the thing that shipped.**

Four verified instances:

1. **The retirement that forbids the wrong string.** `docs/CLAIMS.md:210-215`
   holds `claim: The whole layer is compiled into host agents with zero runtime
   daemon`, `withdrawn` on 2026-08-27, with
   `retires_phrasings: zero runtime daemon`. `README.md:30` ships the literal
   **`no background daemon`**. README is in `PUBLISH_SURFACES`, the gate runs
   over it, and it passes — the needle is a different variant of the same
   retired claim. The failure class is already named in this repo's own words at
   `docs/CLAIMS.md:83-88`: *retirement was bookkeeping with no reach.* This is
   its second instance, and the first one is documented directly above it.
2. **The same stale absolute in an ADR.** `ADR-118:43`'s constraint frame still
   reads "no runtime daemon (ADR-088)". Unmarkered prose is outside
   `check_claims.ts`'s frame by design (`:13`), so nothing will ever catch it.
3. **A count gate that cannot see the rules.** `check_artefact_count_messaging.ts`
   watches 16 curated doc paths (`:44-67`) and no rule path — while
   `src/rules/missing-skill-recovery.md` tells the reader 297 skills and
   `src/rules/token-budget-discipline.md` says ~290, against an actual 299.
   *(The scope fix and these two edits belong to
   `road-to-wired-instruments` Phase 4; they are named here only because they
   are the same defect and must not be done twice.)*
4. **A capability doc citing generators that do not exist.**
   `docs/capability-matrix.md:2-4` names `scripts/generate_capability_matrix.py`
   and `condense.py`. Neither file is in the tree; the Python era ended with
   ADR-200.

And one measurement that is true, published, and read wrongly by everyone who
cites it: enforcement coverage. Live run, this session:

```
enforcement coverage · 16/120 rules (13.3%) have a backstop that fails a CI build
  declared 39 · observer 10 · undeclared 81
```

The committed baseline `internal/reports/enforcement-coverage.json` still reads
`12.5 / 82 / 38` from 2026-08-27, because the ratchet fires only when coverage
*falls* — so an improvement never forces a regeneration and the checked-in
artefact permanently understates the tree. Reviewers reading it conclude the
number stands still. It moved; the file did not.

The 81 also does not mean what a reader assumes. Nine are kernel rules whose
`enforced_by` field `block_kernel_rule_writes` **denies outright, with no
agent-accessible override**. Ten are observer hooks that fire and cannot block.
One (`telegraph-speak`) has no carrier at all. The genuinely reachable
population is the ten, not the 81 — and a coverage floor set against 81 would
stall in its second release and be ignored, which is the failure
`check_release_highlights.ts` already documents for its own warning:
*"a warning that has been ignored eighteen times is not a warning; it is a
comment."*

## Phase 1 — Close the retirement blind spot

- [x] **1.1 Widen `retires_phrasings` on `claim:no-runtime-daemon`.** Add
      `no background daemon` and any sibling variant a `git log -S` sweep over
      the five publish surfaces turns up. The min-needle-length check at
      `check_claims.ts:130` bounds how short a variant may be; respect it.
      verify: with `README.md:30` unchanged, `./scripts-run src/scripts/check_claims`
      **fails** naming that line. Run this before 1.2 — the red is the evidence
      the widening has reach.

      **Red observed before green, as the step required.** With the phrasing list
      widened and `README.md` untouched, the gate reported:
      `README.md · claim:no-runtime-daemon — publishes the retired phrasing "no
      background daemon" — claim:no-runtime-daemon is withdrawn, so this wording
      may no longer ship`. That is the reach evidence; without it the widening
      would be an untested string edit.

      **The `git log -S` sweep found no third variant.** Run over all five
      `PUBLISH_SURFACES` for eight candidate phrasings — `no background daemon`,
      `zero runtime daemon`, `no runtime daemon`, `no daemon`, `without a
      daemon`, `daemonless`, `no resident process`, `no background process` —
      exactly two have ever appeared in a commit touching those files: the one
      already retired, and the one this step adds. The other six return zero
      commits and zero live hits. Zero is the real answer here and is recorded
      as such. `MIN_PHRASING_CHARS` is 12 (`check_claims.ts:124`); the added
      needle is 20 characters and clears it.
- [x] **1.2 Fix `README.md:30`.** The bullet's intent is right and its wording is
      retired. Replace the absolute with the governed form ADR-249 actually
      permits — no *mandatory* or *always-on* daemon — so the sentence keeps its
      meaning and stops repeating a withdrawn claim.
      verify: `check_claims` exits 0; `grep -c 'no background daemon' README.md` → 0.
- [x] **1.3 Fix `ADR-118:43`.** Same stale absolute, outside every gate's frame.
      Note in the same edit that unmarkered ADR prose is unscanned, so this one
      is a manual fix by construction.
      verify: `grep -rn 'no runtime daemon' docs/decisions/` returns only
      historical quotations that are marked as such.

## Phase 2 — Repair the capability-matrix provenance

- [x] **2.1 Point `docs/capability-matrix.md:2-4` at the generators that exist.**
      Establish first whether the file is still generated at all, or is now
      hand-maintained prose wearing a generated header. Say which in the file.
      verify: every script path named in the header resolves;
      `ls $(grep -oE '[a-z_/]+\.(ts|py)' docs/capability-matrix.md | head)` finds
      no missing file.

      **Answer: still generated.** `src/scripts/generate_capability_matrix.ts`
      exists, emits the file, and `--check` is wired as a CI drift gate. The file
      was not hand-maintained prose wearing a generated header — it was generated
      output whose header had gone stale relative to its own generator, which is
      a different defect with a different fix: the header strings live in the
      generator, so they were corrected there and the file regenerated. Hand-
      editing the output would have been reverted by the next run.
      The header now names `src/scripts/generate_capability_matrix.ts` and
      `src/scripts/condense.ts`, both of which resolve, and states plainly that
      the file is still generated. The two dead Python-era paths are *described*
      rather than reproduced in the replacement note, so the step's own verify —
      every path the header names resolves — stays literally true.
      **Pre-existing staleness, noted:** `--check` was already reporting
      `docs/capability-matrix.md` stale on clean `origin/main` at `2b3d2b347`, so
      the regeneration in this change also carries content drift this roadmap did
      not cause. It is included rather than split out, because the header fix
      cannot land without a regeneration.
- [x] **2.2 Sweep for sibling dead-generator references.** One instance is a
      sample, not the population — the Python era left named entry points across
      the docs tree.
      verify: report the count of `.py` references under `docs/` that resolve to
      no file, and the files. Zero is a real answer and is worth recording.

      **Report — the count is not zero, it is 1,089.** Swept on 2026-09-03 over
      every `docs/**/*.md`, matching path-shaped `.py` tokens and testing each
      against the tree:

      | Bucket | Occurrences | Distinct paths |
      |---|---|---|
      | live docs (contracts, decisions, guidelines, top-level) | **946** | 449 |
      | historical (`docs/archive/`, CHANGELOGs, `docs/migrations/`) | 143 | 51 |
      | **total** | **1,089** | 475 |

      The historical bucket is not drift — a changelog naming a file as it
      existed then is correct. The live bucket is, and it spans **233 doc
      files**. Worst offenders: `docs/decisions/adr-evidence-sweep-2026-08.md`
      (43), `docs/migration/yaml-roundtrip-spike.md` (25),
      `docs/contracts/install-layout.md` (15), `docs/contracts/STABILITY.md`
      (15), `docs/contracts/hook-architecture-v1.md` (14),
      `docs/architecture.md` (12), `docs/threat-model.md` (12). Most-cited dead
      paths: `scripts/install.py` (62), `install.py` (51),
      `scripts/release.py` (45), `scripts/condense.py` (23),
      `scripts/skill_linter.py` (19).

      **One instance was indeed a sample, and the population is three orders of
      magnitude larger than the instance.** Fixing 946 references across 233
      files is not lightweight work and is not this roadmap's scope — this step
      asked for the count and the files, and that is what it delivers. The
      population is carried to `later/road-to-python-era-doc-references` so the
      finding is tracked rather than buried in an archived roadmap.

## Phase 3 — Make the coverage number readable

- [x] **3.1 Regenerate the committed baseline.** `--write-baseline` against the
      live tree, so `internal/reports/enforcement-coverage.json` stops
      understating coverage by a full rule.
      verify: the committed file reads `13.3 / 81 / 39`, and the ratchet is still
      green.

      **Done, and it reads exactly that.** `internal/reports/enforcement-coverage.json`
      moved `12.5 / 82 / 38` → **`13.3 / 81 / 39`** (`blocking` 15 → 16). The
      ratchet is green on a fresh `--check` run against the regenerated file.
      The drift was structural rather than accidental: the ratchet fires only
      when coverage *falls*, so an improvement never forced a regeneration and
      the committed artefact had been understating the tree since 2026-08-27.
- [x] **3.2 Publish the three classes beside the number.** The gate already
      distinguishes kernel-denied, observer and carrier-less in its own output;
      the committed artefact and any surface that quotes the percentage should
      carry the same split, so a reader cannot mistake 81 for a backlog.
      verify: the baseline artefact names the three counts, and a reader can
      derive "≈10 reachable" from it without running the gate.

      **Done — the artefact now carries `kernel_denied: 9`, `observer: 10`,
      `carrier_less: 1`** beside `undeclared: 81`, and its `_doc` string says how
      to read them: a kernel rule cannot carry an `enforced_by` field at all
      because `block_kernel_rule_writes` refuses the write with no
      agent-accessible override, an observer has a carrier that fires and cannot
      block by design, and the one carrier-less rule (`telegraph-speak`, carrier
      `observer:maintainer-review`) has no machine carrier of any kind. The
      human report gained the same line. A reader lands on the observer set —
      ten — without running anything.
      The two counters were sabotage-probed: replacing them with the loose
      predicates a careless implementation would use turns 4 of the 7 new tests
      red, and restoring them turns all 32 green. Both negative directions are
      pinned — a kernel rule that DID classify is not kernel-denied, and a row
      that also declares a machine carrier is not carrier-less.
- [x] **3.3 Do NOT set a per-release coverage floor in this roadmap.** It is the
      recommendation the source review ranked highest and it is scoped against
      the wrong denominator. If a floor is wanted, it is a separate decision
      against the observer set.
      verify: this roadmap contains no numeric coverage target.

      **Held.** Every number in this file is a measurement of what is, never a
      target for what must be. The source review ranked a per-release floor
      highest; it is scoped against the wrong denominator, and this roadmap's own
      Phase 3 is what makes that visible — a floor against 81 would stall in its
      second release and be ignored, which is the failure
      `check_release_highlights.ts` already documents for its own warning. If a
      floor is wanted it is a separate decision against the observer set of ten,
      and it is not taken here.

## Blockers

### blocker: readme-daemon-wording
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** 1.2
- **What to do:** pick exactly one — (a) replace the absolute with the governed
  form ("no mandatory or always-on daemon"), keeping the bullet's promise and
  matching ADR-249; or (b) drop the daemon clause from the bullet entirely,
  since ADR-124's embedded-engine doctrine two lines earlier already says
  engines terminate with their invoking command.
- **Resolved when:** the chosen wording is in `README.md` and `check_claims`
  exits 0 with the widened phrasing list from 1.1 in place.
- **Recommendation:** (a). The bullet is doing marketing work — it is the
  "deliberately is not" list — and deleting the clause loses a real
  differentiator, while (a) keeps it and makes it true.
- **If you do nothing:** 1.1 lands and the build stays red, because the widened
  needle now matches the shipped README. Do not land 1.1 without 1.2 in the same
  change.
- **Decision:** **(a)** — the governed form. Decided by AI council on 2026-09-03
  (members: anthropic, openai), unanimous, in place of maintainer sign-off under
  a standing autonomous mandate. Both seats agreed with the roadmap's own
  recommendation and both named the same reason: the bullet is the "deliberately
  is not" list, so it is doing marketing work, and deleting the clause loses a
  real differentiator while (a) keeps it and makes it true. One seat added a
  condition adopted here: the claims gate should encode the *qualified*
  invariant, which is what widening `retires_phrasings` to catch the absolute
  does. `README.md` now reads "no mandatory or always-on daemon"; 1.1 and 1.2
  landed in the same change, as the blocker required.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The widened needle matches historical prose and reds unrelated files | implementation | `retires_phrasings` is substring matching over five surfaces; a short variant could hit a quotation or a changelog entry | Run 1.1 before 1.2 and read what it actually reports; keep needles above the min-length floor the gate already enforces | Phase 1 — Close the retirement blind spot |
| 2 | Fixing one variant leaves the class open | product | This is already the second instance of the same failure; a third variant of the same retired claim could ship tomorrow | 1.1 requires a `git log -S` sweep across all five publish surfaces, not a single-string patch | Phase 1 — Close the retirement blind spot |
| 3 | Regenerating the baseline reads as gaming the ratchet | product | A committed metric file that a run rewrites is exactly the shape a reviewer distrusts | 3.1 regenerates only in the improving direction and pairs the diff with the live gate output that produced it | Phase 3 — Make the coverage number readable |
| 4 | The capability-matrix header is fixed while the body stays stale | implementation | Repairing the provenance line says nothing about whether the table below it is current | 2.1 forces the generated-vs-hand-maintained question to be answered in the file rather than left implicit | Phase 2 — Repair the capability-matrix provenance |

## Acceptance Criteria

- [x] AC-1 — `./scripts-run src/scripts/check_claims` exits 0 with
      `no background daemon` present in `retires_phrasings`, and no publish
      surface carries that wording.
- [x] AC-2 — no ADR under `docs/decisions/` asserts an unqualified runtime-daemon
      absence outside a marked historical quotation.
- [x] AC-3 — every script path in `docs/capability-matrix.md`'s header resolves
      to a file that exists, and the dead-reference sweep reports its count.
- [x] AC-4 — `internal/reports/enforcement-coverage.json` agrees with a live gate
      run and carries the kernel-denied / observer / carrier-less split.
- [x] AC-5 — this roadmap sets no numeric coverage target, and says why in
      Phase 3.
