---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - later/road-to-web-launch-readiness-benchmark
  - archive/road-to-web-launch-readiness
estate_offset_exempt: Added by the 2026-09-b inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to ship-control coverage

> **Source:** `agents/tmp.old/inbox-2026-09-b/s02/`, a ten-item web-security
> control list run through three self-critique loops. Its architecture argument
> was already this repo's doctrine; its file:line defect claims survived
> re-verification against `c6b4f6407` almost intact, which is why the defects
> are here and the architecture is not.

## Goal

The pre-launch checker stops shipping a legal citation that has been wrong since
May 2024, stops advertising a check it declines to perform, and the target
grader can score three failure classes it is currently blind to. When this is
finished, no row in `web-launch-readiness.json` states a legal basis without an
authority and a review date attached to it.

## Context

The source proposed building `src/security/`, an AC-owned `url_trust` runtime
and a security router. Its own third loop killed all three and landed on the
right shape: put the controls where the carriers already are. That conclusion is
adopted; the ten-control architecture is not, because four of its ten
(`P2`, `P5`, `P9`, `P10`) are park-blocked by
`agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md`, which a 2/2
council split out precisely so the authoring session may not adjudicate its own
experiment. That park stands and this roadmap does not touch it.

What survives is four verified, unheld defects:

| Defect | Where | Verified |
|---|---|---|
| **TMG § 5 cited as live law** | `src/config/web-launch-readiness.json:171` and `:184`, `src/scripts/check_web_launch_readiness.ts:45` | `grep -rc DDG src` → zero matches anywhere in the tree |
| **A check that says it does not check** | `check_web_launch_readiness.ts:510` emits *"analytics present and no consent mechanism found anywhere in the build. Load order is NOT checked here."* | the row's own `verification` field at `web-launch-readiness.json:149` already specifies the missing test verbatim |
| **Three grader dimensions absent** | `grade_target_readiness.ts:163-305` carries ten ids, none covering recovery, mail authenticity or privacy obligations | enumerated from the file |
| **Mail authenticity has zero tree presence** | — | `grep -rln 'DMARC\|DKIM' src` → **no files** |

The first is the sharpest: this package ships a wrong statement of German law to
consumers, in a file whose whole purpose is telling them what they legally owe.
The TMG was superseded by the DDG (Digitale-Dienste-Gesetz) in May 2024; the
Impressum obligation moved to DDG § 5. The obligation the row asserts is still
real — only its citation is dead.

The second is a check advertising a capability it declines in the same string.
A consumer reading "consent mechanism found" reasonably concludes their consent
gate was verified; what was verified is that a consent-shaped file exists
somewhere in the build.

## Phase 1 — Correct the shipped legal citation

- [ ] **1.1 Replace TMG 5 with DDG 5 at all three sites.** Line-scoped edits at
      `web-launch-readiness.json:171`, `:184` and
      `check_web_launch_readiness.ts:45`. Keep the DSGVO Art. 13 half unchanged —
      it is correct.
      verify: `grep -rn 'TMG' src` returns nothing outside a marked historical
      note; `grep -rn 'DDG' src` names the three sites.
- [ ] **1.2 Search the tree for sibling dead citations.** One instance is a
      sample. Name the exact wrong construct — a statute reference with no
      authority attached — and grep for it across `src/`.
      verify: report the count of legal citations found and which files; zero
      further hits is a real answer and is recorded as one.

## Phase 2 — Make a legal claim carry its own expiry

- [ ] **2.1 Add `authority` and `review_by` to every check row that asserts a
      legal basis.** `authority` names the statute and its source; `review_by` is
      the date the citation must be re-read. This is the generalisation the TMG
      defect earns: the citation went stale for roughly sixteen months and
      nothing in the file could have surfaced it.
      verify: the config schema requires both fields on any row whose `why`
      names a statute, and the gate fails a row that omits them.
- [ ] **2.2 Fail the gate on a lapsed `review_by`.** A date nothing reads is a
      comment. Overdue is a finding, not a silent pass.
      verify: set one row's `review_by` into the past in a fixture and assert the
      gate reports it; restore, and assert green. Neutralise-and-watch-it-fail,
      not a pass-only test.

## Phase 3 — Perform the consent check the row already specifies

- [ ] **3.1 Implement load-order detection.** The assertion is written at
      `web-launch-readiness.json:149`: *"Load the page with consent declined and
      assert no request to the analytics origin."* Replace the "Load order is NOT
      checked here" disclaimer at `check_web_launch_readiness.ts:510` with the
      strongest ordering assertion the checker's static frame can actually make,
      and say plainly in the message what it does and does not cover.
      verify: a fixture build with the analytics snippet above the consent gate
      is reported; one below it is not. Both directions, or the detector's
      polarity is untested.
- [ ] **3.2 Never widen the claim past the instrument.** If the static frame
      cannot decide ordering for a given bundler output, the message says
      `unknown`, not `pass`. An honest unknown is the repo's own convention.
      verify: a minified single-file fixture returns `unknown` and the gate does
      not exit 0 on it as though it had checked.

## Phase 4 — Three grader dimensions

- [ ] **4.1 Add `operational-recovery`, `mail-authenticity` and
      `privacy-obligations` to `grade_target_readiness.ts`.** Follow the existing
      0/1/2/3 ladder and the non-knockout convention the ten current dimensions
      use; do not touch the assurance registry's four-state vocabulary — adding a
      fifth state is a contract change and must not ride along.
      verify: the grader emits thirteen dimension ids; the registry's state
      vocabulary is byte-identical to its pre-change form.
- [ ] **4.2 Give `mail-authenticity` a real rung ladder.** SPF, DKIM and DMARC
      are absent from the tree entirely, so the content is new. The one rung that
      must not be fudged: `p=none` is a monitoring policy and is **not**
      protection — a domain publishing it scores below one that enforces.
      verify: a fixture with `p=none` scores strictly lower than one with
      `p=quarantine`, and the ladder says why in its own text.
- [ ] **4.3 Stop at the grader.** No new skill, no new rule, no new CLI verb.
      The preamble payload has zero headroom against its grace ceiling and
      `check_always_budget` stands at 60,252 / 60,254 characters; a skill's
      catalogue entry alone would red the build.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget` and
      `check_always_budget` both report no change attributable to this roadmap.

## Blockers

### blocker: ddg-citation-authority
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.1
- **What to do:** pick exactly one — (a) cite DDG § 5 directly, matching how the
  row cites DSGVO Art. 13, and accept that this package states a statute
  reference; or (b) drop the statute from the `why` text and describe the
  obligation without a citation, moving the legal reference into `authority`
  where 2.1 puts it behind a review date.
- **Resolved when:** the three sites carry the chosen form and Phase 2's schema
  agrees with it.
- **Recommendation:** (b). This package is not a legal advisor and
  `legal-safety-floor` already governs how it may speak about law; a citation
  behind a dated `authority` field is checkable, and one in prose is what went
  stale for sixteen months.
- **If you do nothing:** the wrong citation keeps shipping. This is the one item
  here with an outward-facing cost today, so leaving it is a decision, not a
  deferral.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Correcting one statute reads as legal advice | product | Naming DDG § 5 puts this package closer to stating law than it should be, and `legal-safety-floor` forbids individual-case legal examination | The blocker's recommended option moves citations out of prose into a dated `authority` field, which is provenance rather than counsel | Phase 1 — Correct the shipped legal citation |
| 2 | Load-order detection is statically undecidable on real bundles | implementation | Minified or dynamically imported analytics defeats source-order inspection, and a detector that guesses is worse than one that abstains | 3.2 makes `unknown` a first-class result and forbids reporting a pass the instrument did not earn | Phase 3 — Perform the consent check the row already specifies |
| 3 | New grader dimensions score every existing target lower overnight | product | Three added dimensions with no prior data will read as a regression in any trend line drawn across the change | Record the dimension count in the same commit as the first post-change grading, so the discontinuity is attributable rather than mysterious | Phase 4 — Three grader dimensions |
| 4 | `review_by` becomes a date nobody reads | implementation | The repo already documents a warning ignored eighteen times; an unenforced date is the same shape | 2.2 makes a lapsed date fail rather than warn, and tests the failure by neutralising it | Phase 2 — Make a legal claim carry its own expiry |

## Acceptance Criteria

- [ ] AC-1 — no file under `src/` cites TMG as live law, and the sibling-citation
      sweep has reported its count.
- [ ] AC-2 — every check row asserting a legal basis carries `authority` and
      `review_by`, and a lapsed date fails the gate in a test that was observed
      red before it was observed green.
- [ ] AC-3 — the consent check either asserts load order or returns `unknown`,
      and no longer emits a message declaring that it does not check.
- [ ] AC-4 — `grade_target_readiness.ts` carries thirteen dimensions and the
      assurance registry's state vocabulary is unchanged.
- [ ] AC-5 — the preamble and always-rule budgets report no delta attributable to
      this roadmap.
