---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: later/road-to-web-launch-readiness-benchmark
    relation: disjoint
    note: "holds the four source controls (P2, P5, P9, P10) this roadmap excludes by design; its Context section says the park stands and nothing here touches it, so the scopes are made disjoint deliberately rather than by accident"
  - slug: archive/road-to-web-launch-readiness
    relation: extends
    note: "built the web-launch-readiness command, its check config and the region axis; this roadmap corrects that config's legal citation and adds the authority/review_by contract it shipped without"
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

**Anchor verification, run against `2b3d2b347` before any edit.** Every file:line
in the table above still resolves: `web-launch-readiness.json:171` (the region
`_comment`) and `:184` (the escalation `why`), `check_web_launch_readiness.ts:45`
(the `Region` doc-comment), `:510` (the second line of the two-line disclaimer
string, which opens at `:509`), `web-launch-readiness.json:149` (the
`analytics-and-consent-wiring` `verification` field), and
`grade_target_readiness.ts:163-305` (ten `id:` fields, first to last). Zero
drifted anchors. Line numbers in the table are pre-change and are not rewritten,
so the table stays a record of what was found rather than of what is now there.

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

- [x] **1.1 Correct the shipped citation under option (b).** Line-scoped edits at
      `web-launch-readiness.json:171`, `:184` and
      `check_web_launch_readiness.ts:45`.
      verify: `grep -rn 'TMG' src` returns nothing outside a marked historical
      note; the DDG citation is reachable from all three sites through the one
      `authority` field they now point at.

      **Done under the resolved blocker, which changed the shape of this step.**
      The step was drafted for option (a) — swap the token at three sites — and
      the decision chose (b): the statute leaves prose entirely and lives in the
      structured `authority` field Phase 2 built, dated by `review_by`. So the
      three sites are still three edits, but two of them *remove* a citation
      rather than replacing one, and the single place the citation now exists is
      `web-launch-readiness.json:185`.

      | Site | Was | Is |
      |---|---|---|
      | `web-launch-readiness.json:171` (`regions._comment`) | "owes Impressum and Datenschutz by law (TMG 5 / DSGVO Art. 13)" | names the obligation, points at the escalation's dated `authority` field, cites nothing |
      | `web-launch-readiness.json:184` (escalation `why`) | "TMG 5 obliges an Impressum and DSGVO Art. 13 a Datenschutzerklaerung…" | "owes a published imprint and a privacy notice by law; the two citations and the date they must be re-read by live in this row's `authority` field, not in this sentence" |
      | `check_web_launch_readiness.ts:45` (the `Region` doc-comment) | "because TMG 5 and DSGVO Art. 13 make it owed rather than advisable" | "because German and EU law make it owed" + six lines saying where the citations went and why |
      | `web-launch-readiness.json:185` (`authority`) — **the sibling migration** | DSGVO Art. 13 only; the Impressum half deliberately withheld pending this blocker | **both** halves: DDG § 5 with `gesetze-im-internet.de/ddg`, DSGVO Art. 13 with the EUR-Lex consolidated text, and the supersession date that explains the staleness |

      **The sibling migration is part of the verdict, not an extension of it.**
      Both council seats said so independently: DSGVO Art. 13 is precedent only
      for the defect, not for the solution, and fixing one citation via (a)-shaped
      prose while leaving the other perpetuates the maintenance burden. So the
      correct half moved too, and `why` now names **no** statute at all.

      **Three residual `TMG` occurrences in `src/`, every one a marked historical
      note and none a statement of live law:** `web-launch-readiness.json:185`
      records the supersession inside the citation it replaced; and
      `check_web_launch_readiness.ts:151` + `:156` keep `TMG` as a *detector*
      token, with a new doc-comment saying in as many words that it is retained
      so a row naming it again is still caught. Reported rather than driven to
      zero — a grep count of zero would have removed the guard.

      **The contract did not have to change to survive this**, which is 2.1's
      third obligation discharged in practice: with `why` naming no statute the
      row is still policed, because `authority` and `review_by` travel together
      and their presence alone makes a row legal. Asserted directly by a new test
      that reads `authority` rather than prose, and by rewriting the two tests
      that had pinned the pre-decision form — `check_web_launch_readiness.test.ts`
      asserted `why` contained the literal `TMG`, and the config test's
      "or this contract polices nothing" guard read `why`, so after the migration
      it would have passed vacuously. Both were observed red before green.
- [x] **1.2 Search the tree for sibling dead citations.** One instance is a
      sample. Name the exact wrong construct — a statute reference with no
      authority attached — and grep for it across `src/`.
      verify: report the count of legal citations found and which files; zero
      further hits is a real answer and is recorded as one.

      **The construct, named literally:** a named legal instrument (`TMG`, `DDG`,
      `TTDSG`, `TDDDG`, `DSGVO`, `GDPR`, `BDSG`, `RDG`, `UWG`, `BGB`, `HGB`,
      `StGB`) or a numbered provision of one (`Art. N`, `Article N`, `§ N`)
      appearing in `src/` with no field naming its source and no field naming
      when it must be re-read.

      **Result — 35 citation sites across 21 files.** Three are the known TMG
      defect (`src/config/web-launch-readiness.json:171` and `:184`,
      `src/scripts/check_web_launch_readiness.ts:45`). The other **32 are all
      GDPR/DSGVO article references** (Art. 6, 7.3, 9, 13, 17, 28, 32, 33) **or
      German RDG § 2(1)**, and none names an instrument superseded as far as this
      session could establish. **Zero further dead citations — recorded as a real
      answer, not as an absence of looking.**

      Two honesty notes the count would otherwise hide. First, the liveness half
      is a knowledge claim, not a fetched-source verification: this package is
      not a legal advisor (`src/rules/legal-safety-floor.md`), so the construct,
      the regex and the file list are recorded above precisely so a later reader
      can re-run the sweep rather than trust this one. Second, the sweep found
      that **exactly one of the 35 sites is a machine-readable check row** — the
      escalation in `web-launch-readiness.json`. The remaining 34 are prose in
      skills, rules and domain docs, which `legal-safety-floor` governs and which
      Phase 2's row contract deliberately does not reach. That bound is what
      keeps 2.1 a schema change rather than a tree-wide prose rewrite.

## Phase 2 — Make a legal claim carry its own expiry

- [x] **2.1 Add `authority` and `review_by` to every check row that asserts a
      legal basis.** `authority` names the statute and its source; `review_by` is
      the date the citation must be re-read. This is the generalisation the TMG
      defect earns: the citation went stale for roughly sixteen months and
      nothing in the file could have surfaced it.
      verify: the config schema requires both fields on any row whose `why`
      names a statute, and the gate fails a row that omits them.

      Shipped as `legalRowViolations()` +`legalRowsOf()` in
      `src/scripts/check_web_launch_readiness.ts`, called by `loadConfig()`
      before it returns, so the contract is enforced on every read rather than by
      a schema test alone. It reaches **both** row kinds — `checks[]` and
      `regions.escalations[]` — because 1.2 established that the only row naming
      a statute today is an escalation, and a contract scoped to `checks[]` would
      have policed nothing.

      Three obligations, and the third is what makes the schema survive 1.1
      whichever way it goes: (1) a row whose `why` names a statute must carry
      both fields; (2) `authority` and `review_by` travel together, so a citation
      **moved out of prose into `authority`** — option (b) of the open blocker —
      is still dated; (3) a lapsed date fails. The gate is scoped, not blanket: a
      row asserting no legal basis owes no citation, asserted by its own test, or
      the contract would be unsatisfiable and therefore ignorable.

      **What this step deliberately did NOT do.** The escalation row's new
      `authority` carries only the DSGVO Art. 13 half — the half 1.1 already
      records as correct — and states in the field itself that the Impressum
      statute reference stays in `why` pending the `ddg-citation-authority`
      decision. Restating the contested citation would have created a **fourth**
      site for 1.1 to correct instead of three, and picking the replacement would
      have been deciding an owner-reserved question from inside a dependent step.
- [x] **2.2 Fail the gate on a lapsed `review_by`.** A date nothing reads is a
      comment. Overdue is a finding, not a silent pass.
      verify: set one row's `review_by` into the past in a fixture and assert the
      gate reports it; restore, and assert green. Neutralise-and-watch-it-fail,
      not a pass-only test.

      Both halves are in `tests/scripts/check_web_launch_readiness.test.ts`: the
      pure function is driven with a row moved to `2020-01-01` and then restored,
      and — the half that makes it load-bearing — `loadConfig()` is driven
      against a **real config file written to a temp root** with the shipped
      row's date moved to `2001-01-01`, asserted to throw `DeadScopeError`
      matching `/lapsed/`, then re-written unmodified and asserted to load. The
      twelve assertions of 2.1+2.2 were observed **red before green**: 12 failing
      on the tests-first commit, 0 after the implementation.

## Phase 3 — Perform the consent check the row already specifies

- [x] **3.1 Implement load-order detection.** The assertion is written at
      `web-launch-readiness.json:149`: *"Load the page with consent declined and
      assert no request to the analytics origin."* Replace the "Load order is NOT
      checked here" disclaimer at `check_web_launch_readiness.ts:510` with the
      strongest ordering assertion the checker's static frame can actually make,
      and say plainly in the message what it does and does not cover.
      verify: a fixture build with the analytics snippet above the consent gate
      is reported; one below it is not. Both directions, or the detector's
      polarity is untested.

      The strongest assertion the static frame can make is **source order within
      one file**, and the message now says exactly that and exactly what it
      excludes (runtime order, deferred and dynamic imports, cross-file bundler
      order). Fixtures `consent-order-bad/` and `consent-order-good/` differ only
      in which of two `<script>` lines comes first; the first is reported at
      `index.html:9` naming both line numbers, the second is not reported at all.

      **One defect found while building the detector, and pinned.** `CONSENT_RE`
      matches the bare word *consent*, so a `<meta name="description">`
      describing a consent banner would have been read as the gate's position and
      would have reported a mis-ordered page as correctly ordered. The ordering
      pass therefore reads only lines carrying executable markup, and
      `consent-order-bad/` keeps the word in its description **on purpose** so
      the near-miss is a test rather than a comment.
- [x] **3.2 Never widen the claim past the instrument.** If the static frame
      cannot decide ordering for a given bundler output, the message says
      `unknown`, not `pass`. An honest unknown is the repo's own convention.
      verify: a minified single-file fixture returns `unknown` and the gate does
      not exit 0 on it as though it had checked.

      `Report` gains an `unknown: Undecided[]` bucket which is neither a finding
      nor a pass, rendered under its own `UNDECIDED` heading, and an undecided
      check can never land in `passed`. Three undecidable shapes are separated
      and each names itself in the message: gate and tag on the **same line**, a
      line past 400 characters (**minified**), and a gate that lives in **another
      file**, where order is the bundler's and not the source's.

      **Exit-code contract widened, and this is a deliberate change to the
      command's surface**: `1` now means *a blocking finding **or** an applicable
      check the instrument could not decide*, and the header comment says so. The
      test makes the distinction sharp on purpose — on a marketing site this
      check is `situational`, so a real ordering **finding** exits 0 while an
      **undecided** one exits 1. The exit code tracks whether the instrument
      answered, not how severe the answer was.

## Phase 4 — Three grader dimensions

- [x] **4.1 Add `operational-recovery`, `mail-authenticity` and
      `privacy-obligations` to `grade_target_readiness.ts`.** Follow the existing
      0/1/2/3 ladder and the non-knockout convention the ten current dimensions
      use; do not touch the assurance registry's four-state vocabulary — adding a
      fifth state is a contract change and must not ride along.
      verify: the grader emits thirteen dimension ids; the registry's state
      vocabulary is byte-identical to its pre-change form.

      All three are **non-knockout**: a knockout added today would re-bind every
      existing verdict at L0 on the day it shipped, which changes what the level
      MEANS while looking like a change to what it measures. Asserted directly —
      the knockout set is still exactly the declared four.

      The three need to read INSIDE files (a DMARC policy is a string in a zone
      file, not a filename) and every existing probe is filename-shaped, so a
      `_textCorpus()` walk was added, bounded in three directions: a skip list,
      2,000 files, 256 KB per file. An unbounded read of an arbitrary target repo
      is a cost this grader cannot predict.

      **Registry touch, and its exact extent:** one line,
      `grader.dimensions: 10 → 13` in
      `src/config/assurance-capability-registry.json`, required by that file's
      own spec, which asserts the count against what the grader emits. The
      `state_vocabulary` block is byte-identical — the whole diff to that file is
      `1 insertion(+), 1 deletion(-)`. **This line is also Risk 3's mitigation
      discharged**: the dimension count is recorded in the same commit as the
      change, so the discontinuity in any trend line drawn across it is
      attributable rather than mysterious.
- [x] **4.2 Give `mail-authenticity` a real rung ladder.** SPF, DKIM and DMARC
      are absent from the tree entirely, so the content is new. The one rung that
      must not be fudged: `p=none` is a monitoring policy and is **not**
      protection — a domain publishing it scores below one that enforces.
      verify: a fixture with `p=none` scores strictly lower than one with
      `p=quarantine`, and the ladder says why in its own text.

      `0` no record · `1` SPF and/or DKIM published, **or** DMARC at `p=none`,
      **or** an enforcing policy with nothing to align against · `2` `p=quarantine`
      / `p=reject` with SPF or DKIM alongside · `3` `p=reject` with both
      mechanisms and an `rua=` reporting address.

      `p=none` is capped at 1 **even with SPF and DKIM alongside it**, and the
      grade's own `evidence` string says why in the output a reader actually
      sees: *"capped at Present: p=none is a monitoring policy and is NOT
      protection, because receivers are told to take no action on a message that
      fails."* Asserted three ways — strictly-lower, the cap at 1, and the
      wording. A fourth test pins the near-miss: a README **discussing** DMARC
      scores 0, because the signal is the record shape and not the word. The
      rung also has a case in `--self-test`, so it survives outside vitest.
- [x] **4.3 Stop at the grader.** No new skill, no new rule, no new CLI verb.
      The preamble payload has zero headroom against its grace ceiling and
      `check_always_budget` stands at 60,252 / 60,254 characters; a skill's
      catalogue entry alone would red the build.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget` and
      `check_always_budget` both report no change attributable to this roadmap.

      Held: zero files added or changed under `src/skills/`, `src/rules/`,
      `src/domains/` or `src/agent-src/`. The whole diff is two scripts, two
      config files, tests and fixtures.

      **Measured, before and after this roadmap's changes, same commands:**
      `check_always_budget` reads **60,252 / 60,254 chars (100.0 %) across 9
      rules**, byte-identical either side, exit 0. `check_preamble_payload_budget`
      reads **138,273 tok against a 107,646 ceiling**, again identical either
      side — it is **red on `origin/main` untouched** and prints its own
      attribution line, *"NO standing asset changed against the merge base — this
      diff did not cause the overage, it inherited it."* Pre-existing, reported,
      not inherited silently.

## Blockers

### blocker: ddg-citation-authority
- **Status:** resolved (2026-09-03, AI council: `anthropic/claude-sonnet-4-5` +
  `openai/codex-default`, three rounds, blind chairman, standing in for
  maintainer sign-off under the standing drain mandate)
- **Owner:** maintainer
- **Blocks:** — (was: 1.1)
- **What to do:** pick exactly one — (a) cite DDG § 5 directly, matching how the
  row cites DSGVO Art. 13, and accept that this package states a statute
  reference; or (b) drop the statute from the `why` text and describe the
  obligation without a citation, moving the legal reference into `authority`
  where 2.1 puts it behind a review date.
- **Decision:** **(b), unanimous** — remove the stale prose citation and use
  structured `authority` metadata. In the council's own words: *"This package is
  not a legal advisor and `legal-safety-floor` already governs how it may speak
  about law; a citation behind a dated `authority` field is checkable, and one in
  prose is what went stale for sixteen months."* The verdict agrees with this
  entry's own recommendation, which is worth stating plainly rather than reading
  as independent corroboration.

  Both seats attached the **same two binding conditions**, and both are part of
  the decision rather than commentary on it:

  1. **It ships atomically.** The prose correction, the populated `authority`
     field and the `review_by` date land together — one seat put it as *"do not
     present `review_by` as a completed control if it lands later."*
  2. **The sibling DSGVO Art. 13 citation migrates in the same change.** One
     seat: *"The DSGVO Art. 13 citation is precedent only for the defect, not
     the solution. Both citations should migrate to structured `authority`
     fields together. Fixing one via (a) while leaving the other creates
     inconsistency and perpetuates the maintenance burden."* The other agreed
     independently.

  Both conditions are discharged in the same commit as 1.1: `why` names no
  statute, `authority` carries DDG § 5 **and** DSGVO Art. 13 with a source for
  each, and `review_by` (2027-09-03) was already present and is what dates them.
  The council transcript is not cited by path — council output is gitignored and
  auto-pruned, so the durable trace is the date, the members and the quoted text
  above.
- **Resolved when:** ~~the three sites carry the chosen form and Phase 2's schema
  agrees with it~~ — both met. The three sites carry (b); the schema needed no
  change to agree with it, because 2.1's second obligation (`authority` and
  `review_by` travel together) was written for exactly this migration and keeps
  the row policed now that its `why` names nothing.
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

- [x] AC-1 — no file under `src/` cites TMG as live law, and the sibling-citation
      sweep has reported its count. *Second clause discharged by 1.2 (35 sites,
      21 files, zero further dead citations). First clause discharged by 1.1
      under the resolved blocker: three `TMG` strings remain in `src/`, one
      recording the supersession inside the citation that replaced it and two
      keeping it as a detector token under an explicit historical-note comment —
      none asserts it as live law, and driving the count to zero would have
      deleted the guard that catches a reintroduction.*
- [x] AC-2 — every check row asserting a legal basis carries `authority` and
      `review_by`, and a lapsed date fails the gate in a test that was observed
      red before it was observed green.
- [x] AC-3 — the consent check either asserts load order or returns `unknown`,
      and no longer emits a message declaring that it does not check.
- [x] AC-4 — `grade_target_readiness.ts` carries thirteen dimensions and the
      assurance registry's state vocabulary is unchanged.
- [x] AC-5 — the preamble and always-rule budgets report no delta attributable to
      this roadmap.
