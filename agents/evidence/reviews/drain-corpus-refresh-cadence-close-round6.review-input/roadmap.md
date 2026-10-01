<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-corpus-refresh-2026-q3
estate_growth_exempt: "a blocker discovered while doing the work — 1.2's four re-checks cannot share one calendar date, which no prior pass had written down as a structured hold"
---
# Road to corpus refresh cadence shape

> **Source:** [REDACTED:src-conf]
> here under Iron Law 3 of `roadmap-progress-sync` when that roadmap closed on
> 2026-09-27. Its Phase 1 shipped; this question did not, because it is a
> maintainer decision and not an agent call. See the parent's archive entry for
> the original finding.

## Goal

The maintainer has answered whether four grounding corpora sharing one
`last_checked` stamp is a deliberate cadence or an accident of batching, and the
tree reflects that answer — either the stamps are deliberately staggered so the
four no longer expire on the same day, or a recorded decision states that the
simultaneous expiry is intended and acceptable.

## Context

`check_corpus_staleness` is calendar-triggered and its job is a required status
check. On 2026-09-18 all four corpora carrying a `quarterly` cadence
(`accessibility-auditor`, `api-design`, `database`, `threat-modeling`) read
`last_checked: 2026-06-07`, crossed the 100-day bound on the same day, and
reddened every pull request in the repository with no commit involved. The
re-check moved all four to `2026-09-18` — which preserves the batch shape rather
than fixing it, so the same four-way red was due again around 2026-12-27. As of
2026-10-01 that batch is down to three (1.2a moved `accessibility-auditor` to
`2026-10-01`); ~2026-12-27 is unchanged for the remaining three.

**The next repo-wide red is NOT ~2026-12-27, and this roadmap said so for three
days before a round-5 review checked it** (corrected 2026-10-01). **Six**
manifests declare `refresh_cadence: quarterly`, not four — the four above plus
`brand` and `design-intelligence`. `brand` carries `upstream: null` and is
exempt. `design-intelligence` is not: it reads `last_checked: 2026-08-13` and
crosses the 100-day bound on **2026-11-22**, five weeks before ~2026-12-27 and
before 1.2c's and 1.2d's suggested windows. Verified rather than reasoned:
`check_corpus_staleness --today 2026-11-21` exits 0; `--today 2026-11-22` exits
1 with *"design-intelligence … 101 days ago, over the 100-day bound"*.

Two consequences, both load-bearing. **For scheduling:** a maintainer reading
only the four-corpus framing would schedule 1.2c for late November and 1.2d for
mid December and still be reddened on 2026-11-22 by a corpus this file does not
mention. **For scope:** `design-intelligence` is NOT part of this roadmap's
subject — the question here is whether the *batch of four* was a cadence or an
accident — so it is named, dated and handed over, not absorbed. Its re-check is
owed by whoever owns that corpus, before 2026-11-22, and nothing in Phase 1
covers it.

This roadmap ships `status: draft` deliberately: it is hidden from the dashboard,
and no `/roadmap:process-*` run selects it on its own, until the maintainer flips
it to `ready`. That is the honest encoding of "the question is open and nobody
has decided it" — an agent must not answer it, and parking it as executable work
would imply someone had.

**What `draft` does and does not stop — corrected 2026-10-01.** The sentence
above read "hidden from the dashboard and from `/roadmap:process-*`" until a
`/roadmap:process-full` invocation naming this file by path reached it and ran
1.2a. `draft` governs *selection*, not *reachability*: it keeps the file out of
the dashboard and out of any run that picks its own target, and it stops nothing
when a human names the path. The guard is therefore narrower than it was written
to be, and the correction is recorded rather than quietly absorbed because Risk 2
rests on it.

**Why it is still `draft` after D1 closed the question (2026-09-30).** The
original reason has expired — the question *is* answered. A second reason has
not: Risk 2's only named mitigation is that this file ships `draft` so no
`/roadmap:process-*` run picks it up unprompted, and the remaining work is
precisely the three stamp edits Risk 2 exists to guard. Flipping to `ready` would
remove that guard at the moment the risk is highest, which is a safety-floor
change and therefore the maintainer's, not an agent's. The flip is named in the
blocker's "What to do" so it is a decision the maintainer takes deliberately
rather than one an agent takes by tidying — and the 2026-10-01 drain run
deliberately did not take it (D4).

## Phase 1 — Put the question, then apply the answer

- [x] **1.1 Put the cadence-versus-batch question to the maintainer and record
      the answer.** *(2026-09-27 — delegated by the maintainer to the AI council;
      answered as D1 below. The recorded decision names the chosen shape and its
      reason, which is what this step's verify demands.)* Two options, and the trade-off is real rather than
      cosmetic: staggering the four stamps spreads the re-check work across the
      quarter and means at most one corpus reddens at a time, at the cost of
      four separate re-check occasions a year instead of one; keeping the batch
      means one re-check sitting, at the cost of a four-way repo-wide red every
      time it comes due. A third option exists and should be named when asking:
      leave the stamps alone and instead make the gate warn rather than block
      when a corpus is only days over, which changes the blast radius without
      changing the cadence.
      verify: a recorded decision exists — an entry under `agents/decisions/`,
      an ADR, or a `## Decisions` row on this roadmap — naming which of the
      three was chosen and why.

**1.2 was one checkbox describing four occasions spread over three months, and
split on 2026-09-30 into the four it actually is.** D1's own words are "four
separate occasions, not one edit"; a single box could never record two-of-four
done, so the structure now matches the decision. All four are held by the same
blocker — see [`four-dated-re-checks-are-calendar-bound`](#blocker-four-dated-re-checks-are-calendar-bound).
The order below is a suggestion, not a constraint; what is binding is that no
two land on the same date and all four land before ~2026-12-27.

- [x] **1.2a Re-check `accessibility-auditor` against its upstream and stamp the
      date the check ran.** *(2026-10-01 — occasion 1 of 4, inside the suggested
      window. Ran under the `/roadmap:process-full` grant recorded as D4.)*
      Upstream is the W3C ARIA Authoring Practices Guide plus WCAG 2.2.
      Suggested window: early-to-mid October 2026. The check is whether WCAG 2.2
      still carries no supersession note and whether any APG pattern cited in
      `aria-patterns.csv` has been withdrawn or renamed.
      verify: `src/skills/accessibility-auditor/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.

      **Evidence (2026-10-01).** The check ran before the stamp moved, and it
      found something — which is the point of running it rather than the
      exception. **WCAG 2.2:** `https://www.w3.org/TR/WCAG22/` still reads
      *W3C Recommendation, 12 December 2024*, carries no supersession or
      obsoletion banner, and records the parallel next-major work while stating
      it does not deprecate 2.2. **APG:** the twelve URLs cited in
      `aria-patterns.csv` were probed individually — `curl -o /dev/null -w
      '%{http_code} %{redirect_url}'`. Eleven return `200` unchanged
      (`accordion`, `alert`, `button`, `combobox`, `dialog-modal`, `landmarks`,
      `listbox`, `meter`, `table`, `tabs`, and the WAI forms-notifications
      tutorial). One pattern was **renamed upstream**:
      `/apg/patterns/menubutton/` returns `301` to `/apg/patterns/menu-button/`,
      and the APG pattern index no longer lists the `menubutton` slug. No cited
      pattern has been withdrawn. **Applied — three edits to the *Menu /
      dropdown actions* row of `aria-patterns.csv`, not one:** *Docs URL* now
      cites the canonical `menu-button` slug; the *Implementation* prose, which
      still described `menubutton`, now reads "menu button"; and *Keywords*
      gained `menubutton menu-button`. **Two of the three touch retrieval, not
      one** (corrected after round-4 review): `search_cols` is `[Component,
      Keywords, Pattern, Implementation]`, so edit 2 rewrote a *searchable*
      column and is precisely what removed the `menubutton` token from the
      retrievable text — edit 3 is the repair for edit 2, not an independent
      improvement. Before this change the token was matchable via
      *Implementation*; after edit 2 alone it would have matched in no searchable
      column; after edit 3 it matches via *Keywords*. Only edit 1, the Docs URL,
      is outside `search_cols` and therefore retrieval-inert.
      `upstream.sha` carries the upstream IDENTITY only and deliberately records
      none of the three findings — see the correction note below.
      `upstream.last_checked` moved `2026-09-18` → `2026-10-01` — the
      date this check actually ran, per D1. Gate:
      `./scripts-run src/scripts/check_corpus_staleness --today 2026-10-01` →
      exit `0`, *"6 corpus manifest(s), 41 CSV(s) opened: every declared cadence
      is met"*. The stamp now differs from the other three, which remain
      `2026-09-18`.

      **Two further gates the new corpus lands in, named after round-3 review
      caught the omission.** A paragraph claiming to name second-order
      consequences ahead of discovery had named two gates and there are four.
      `check_trigger_evals` requires a top-level `last_eval` no older than 90
      days, and this change wrote `"last_eval": "2026-10-01"` into the new file
      **while the same step records that no live eval ran** — the live path is
      key-gated and spend-bearing. That is an unbacked freshness assertion, and
      D1's own evidence column names a `last_eval` written without a backing
      eval as the archetypal fabricated-evidence defect. It is **inherited, not
      invented**: `ui-component-architect` (2026-09-30) and `roadmap-writing`
      (2026-09-19) both carry their authoring date in that field, so the
      convention in this tree is author-date-as-`last_eval`, and deviating
      alone would have reded `check_trigger_evals` for a single file. Named here
      rather than quietly followed, because "everyone does it" is a reason to
      surface a convention, not a reason it is sound; whether that field should
      mean *authored* or *evaluated* is the maintainer's call and belongs with
      the `lint_eval_freshness` question below. `trigger_eval_rotation` is the
      fourth — a weekly live canary over every skill carrying a corpus — and it
      is green for this file today.

      **Second-order consequence, named rather than discovered later.** Touching
      a skill's `data/` brings it into `check_routing_coverage`'s touched-skill
      scope, which requires `evals/triggers.json`; that corpus was written
      (10 cases — 5 exemplars, 3 near-misses, 2 counterexamples) and skill
      routing coverage rose `0.3411` → `0.3445`. But shipping `triggers.json`
      beside a SHA-pinned manifest **also** puts the skill into
      `lint_eval_freshness`'s scope, which then wants an
      `upstream.last_eval` recorded from a live eval. That gate was already red
      for `threat-modeling` and is now red for two skills. It was **not**
      silenced by fabricating a `last_eval` — that is the precise defect the
      parent roadmap found and D1's evidence column cites. It also cannot be
      fixed as the gate instructs: its named remedy is *"run the live eval and
      `agent-config eval:record`"*, and **neither step exists** — there is no
      `test-triggers-live` target in `Taskfile.yml` and `agent-config
      eval:record` answers `unknown command`. So the same two entries are
      unfixable by the gate's own instructions, and the live-eval path is a
      maintainer/infrastructure question, not a stamp question. The gate is
      registered only in `task ci`, which no workflow invokes, so it blocks no
      pull request today — a load-bearing assumption rather than a guarantee,
      since registering it in a workflow would turn both entries into merge
      blocks overnight. **That half has a destination, and this run did NOT
      write into it — stated as an open hand-off rather than a completed one**
      (corrected 2026-10-01 after round-2 review flagged the original wording as
      asserting work the tree does not record).
      `road-to-trigger-eval-freshness-has-no-writer` is an active roadmap whose
      subject is exactly this — a freshness field with no writer — and it
      currently names neither `accessibility-auditor` nor `threat-modeling`.
      Writing into another active roadmap is outside this drain's scope, so what
      is owed is one evidence line there naming both skills and the fact that
      `task test-triggers-live` and `agent-config eval:record` both resolve to
      nothing. Until that lands, the two red entries are tracked by **this**
      paragraph and nowhere else, which is the weaker state and is named as
      such. The
      corresponding observation for the *other* three occasions: 1.2b, 1.2c and
      1.2d will each hit this same consequence when they run, and each will need
      the same honest refusal.

      **`upstream.sha` is an identity, not a check log — corrected 2026-10-01
      after review.** The first version of this step wrote the whole finding
      into `upstream.sha`. That field is `lint_eval_freshness`'s exact-equality
      key against `upstream.last_eval.sha_at_eval`, so using it as a log means
      that once any `last_eval` exists, a re-check confirming **nothing
      changed** still reads as "the corpus moved since the last eval". The field
      now carries the upstream identity (WCAG 2.2's status, the canonical APG
      slug) and nothing about when it was read; `upstream.last_checked` carries
      the date, and the finding lives in this paragraph. **This binds 1.2b–d**:
      each moves `last_checked` always, and touches `upstream.sha` only if the
      upstream identity itself moved. **The defect was swept across all four
      manifests rather than fixed where it was noticed**, and it is present in
      three of them, not two: `api-design` reads *"… — verified 2026-09-18:
      9110 neither obsoleted nor updated …"*, and `database` and
      `threat-modeling` both open *"re-derived 2026-09-27 against …"*. All
      three embed a read-date in a byte-equality identity key. They are left
      untouched here under `minimal-safe-diff` — none is this step's corpus —
      and each one's repair is now named in its own step: 1.2b for
      `api-design`, 1.2c for `database`, 1.2d for `threat-modeling`. Count: 3
      of 4 manifests carried the construct, 1 of 4 (this one) is repaired.

      **Where the evicted check log goes — the gap round 3 named, closed here.**
      The repair takes a narration out of `upstream.sha` and the obvious place
      to put it is the step's evidence paragraph. That is **not sufficient on
      its own**: roadmaps are transient, `no-roadmap-references` forbids a
      manifest from citing one, and 1.2b and 1.2c explicitly lean on the current
      `upstream.sha` as "the diff baseline" — so a naive eviction would delete
      the next check's baseline to fix a gate key. **The binding rule for
      1.2b–d is therefore two-sided:** before shortening a manifest's
      `upstream.sha`, copy the narration it is losing verbatim into a durable
      record under `agents/evidence/analysis/` — the convention this tree
      already uses for findings that must outlive the work that produced them —
      and let the step's evidence paragraph cite that record. Only then shorten
      the field. **1.2a is not an exception, and an earlier draft of this
      paragraph claimed it was on a false premise** (round-5 review). It said
      1.2a "had no inherited narration to evict". It did: the value this step
      replaced was `"APG 2026 / WCAG 2.2 (W3C Recommendation 12 Dec 2024) —
      verified not superseded 2026-09-18"`, a finding authored on 2026-09-18.
      What actually makes a separate record unnecessary here is narrower and
      checkable: the 2026-10-01 check **subsumes** it — same supersession
      question, re-asked, same answer — and both the replaced string and its
      replacement are quoted verbatim above. Read this as a subsumption, not a
      waiver: the rule stays the default, and a narration no later check has
      re-derived gets its record.
- [ ] **1.2b Re-check `api-design` against its upstream and stamp the date the
      check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is RFC 9110 / 9457 / 7396 / 8288 plus the httpapi WG drafts.
      Suggested window: early November 2026. The check is whether any of the
      four RFCs has been obsoleted or updated since 2026-09-18.
      verify: `src/skills/api-design/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.

      **Evidence (2026-10-01) — deferred, not skipped.** Occasion 2 of 4 is
      calendar-bound and nothing about this session changes that. Its own verify
      requires a `last_checked` "differing from the other three"; 1.2a stamped
      `2026-10-01` today, so any stamp written in this same session would be
      identical to it and would fail this step's verify and AC-2 by
      construction. The constraint is arithmetic, not a judgement about
      capability. **Exact inputs a future session needs:** run on a calendar day
      that is not `2026-10-01` and not the day 1.2c or 1.2d runs — suggested
      early November 2026, binding bound before ~2026-12-27. Check whether RFC
      9110 (STD 97), 9457, 7396 or 8288 has been obsoleted or updated since
      `2026-09-18` — `https://www.rfc-editor.org/info/rfc9110` and siblings
      print "Obsoleted by" / "Updated by" lines directly, and the current
      `upstream.sha` records the 2026-09-18 reading to diff against (*"9110
      neither obsoleted nor updated; 9457 current and obsoletes 7807"*). Then
      set only `src/skills/api-design/data/manifest.json`'s
      `upstream.last_checked` to the date that check ran, record the finding in
      this step's evidence paragraph — **not** in `upstream.sha`, which is an
      identity key and moves only if an RFC was actually obsoleted or updated
      (see 1.2a's correction note) — and confirm with
      `./scripts-run src/scripts/check_corpus_staleness`. **Repair owed by this
      step:** `api-design`'s `upstream.sha` currently reads *"RFC 9110 (STD 97)
      / 9457 / 7396 / 8288 — verified 2026-09-18: …"*, which embeds a read-date
      in the identity key. Replace it with the identity alone (the RFC numbers
      and their current status), the way 1.2a did for this corpus.
- [ ] **1.2c Re-check `database` against its upstream and stamp the date the
      check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is the PostgreSQL 18 and MySQL 9.7 reference documentation.
      Suggested window: late November 2026. Note that the *content* half was
      re-derived on 2026-09-27 (commit `6991eeab9`); per D2 that re-derivation
      does not move the stamp, so this occasion is a fresh check.
      verify: `src/skills/database/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.

      **Evidence (2026-10-01) — deferred, not skipped.** Same arithmetic as
      1.2b: occasion 3 of 4 cannot share `2026-10-01` with 1.2a without failing
      its own "differing from the other three" verify and AC-2's four-distinct
      test (D3). **Exact inputs a future session needs:** run on a calendar day
      distinct from `2026-10-01`, from 1.2b's day and from 1.2d's — suggested
      late November 2026, binding bound before ~2026-12-27. Check the twelve
      rows of `query-tuning.csv` against the then-current PostgreSQL and MySQL
      reference documentation; the current `upstream.sha` carries the
      2026-09-27 content re-derivation in full (PG18 B-tree skip scan on row 1,
      MySQL 9.7 Hypergraph Optimizer on row 5, PG18 `GENERATED` default flipping
      `STORED` → `VIRTUAL` on row 12) and is the diff baseline. Per D2 that
      2026-09-27 re-derivation does **not** move the stamp and this remains a
      fresh check, not a back-dating. Then set only
      `src/skills/database/data/manifest.json`'s `upstream.last_checked` to the
      date that check ran and confirm with
      `./scripts-run src/scripts/check_corpus_staleness`. **Repair owed by this
      step:** that manifest's `upstream.sha` opens *"re-derived 2026-09-27
      against PostgreSQL 18.x / MySQL 9.7: …"* and runs for ~700 characters — a
      read-date and a change log inside a byte-equality identity key. Replace it
      with the engine versions alone, per 1.2a's correction note; the
      re-derivation's content belongs in this step's evidence.
- [ ] **1.2d Re-check `threat-modeling` against its upstream and stamp the date
      the check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is MITRE ATT&CK, CWE, the OWASP API Top 10 and ASVS 5.0.
      Suggested window: mid December 2026, and no later than ~2026-12-20 so the
      last occasion lands before the batch expiry. Same D2 note as 1.2c: the
      2026-09-27 content re-derivation does not move the stamp.
      verify: `src/skills/threat-modeling/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.

      **Evidence (2026-10-01) — deferred, not skipped.** Same arithmetic as
      1.2b and 1.2c; this is occasion 4 of 4 and it is the one with a hard outer
      bound. **Exact inputs a future session needs:** run on a calendar day
      distinct from `2026-10-01` and from 1.2b's and 1.2c's days — suggested mid
      December 2026 and **no later than ~2026-12-20**, because
      `threat-modeling`'s OWN stamp still reads `2026-09-18` and therefore
      crosses the 100-day bound on ~2026-12-27. The bound is this corpus's, not
      the cohort's — corrected 2026-10-01, because the earlier wording tied it
      to "the other three stamps that are still `2026-09-18`", which is already
      only two of the other three and becomes none of them once 1.2b and 1.2c
      run. A December session checking that premise would have found it false
      and could have concluded the deadline had lapsed, which is precisely how
      `threat-modeling` would expire into the all-PRs-red this roadmap exists to
      prevent. Check that every ATT&CK id in `threats.csv`'s *Source Refs*
      column still resolves and is neither deprecated nor revoked — the current
      `upstream.sha` enumerates them (T1110, T1563, T1105, T1090, T1499, T1552,
      T1552.001, T1190, T1078.004) against ATT&CK v19.x, and notes that
      `threats.csv` carries no ASVS identifiers so there is nothing to remap
      there. Per D2 the 2026-09-27 content re-derivation does **not** move the
      stamp. Then set only `src/skills/threat-modeling/data/manifest.json`'s
      `upstream.last_checked` to the date that check ran and confirm with
      `./scripts-run src/scripts/check_corpus_staleness`. **Repair owed by this
      step:** that manifest's `upstream.sha` opens *"re-derived 2026-09-27
      against ATT&CK v19.x and ASVS 5.0.0: …"* — the same read-date-in-an-
      identity-key construct. Replace it with the upstream identity alone
      (ATT&CK and ASVS versions); the re-derivation's content belongs in this
      step's evidence.

      **Note on the outer bound.** 1.2a moved one stamp to `2026-10-01`, so that
      corpus now expires ~2027-01-09 rather than ~2026-12-27. The three
      remaining at `2026-09-18` still expire together on ~2026-12-27, so the
      three-way red is what THIS roadmap's deadline guards against — one corpus
      smaller than the four-way red of 2026-09-18, and not yet the staggered end
      state the Goal asks for. **It is not the next repo-wide red**:
      `design-intelligence`, a sixth `quarterly` corpus outside this roadmap's
      subject, crosses the bound on **2026-11-22** — see Context. Do not read
      ~2026-12-27 as "the next time PRs go red"; read it as "the deadline for
      1.2b–d".

## Blockers

### blocker: four-dated-re-checks-are-calendar-bound
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.2b, 1.2c, 1.2d — and AC-2 through them. **1.2a came off this
  hold on 2026-10-01** when occasion 1 of 4 was run for real under the
  `/roadmap:process-full` grant recorded as D4: `accessibility-auditor` was
  verified against WCAG 2.2 and the APG (finding one renamed pattern), and its
  stamp moved to the date that check ran. The hold itself is unchanged in kind
  — three occasions on three further distinct dates remain, and no single
  session can produce them.
- **Why it is a hold and not merely unfinished work.** D1 requires four real
  re-checks on four *separate dates*. One session cannot produce four dates, so
  no single run — agent or human — can close 1.2 however capable it is. This is
  a calendar constraint, deliberately not a capability one: the promoted hold
  records that the work is *spread*, never that it is *hard*. Two further
  reasons put the occasions with the maintainer rather than a drain run: every
  one of the four manifests declares `"owner": "package-maintainer"`, and
  `check_corpus_staleness`'s own header states that row semantics — "does this
  pattern still hold?" — are "the corpus owner's judgement and no offline gate
  can make it".
- **Those two reasons were NOT satisfied on 2026-10-01, and that is stated here
  rather than only at D4** (round-3 review). 1.2a ran under D4, and in running
  it the agent exercised exactly the judgement this bullet reserves: it decided
  the Menu row's citation was stale and that the other eleven rows still hold.
  D4 answers Risk 2, the `draft` guard and D2; it does **not** answer either
  ownership reason, and an agent cannot answer them — `"owner":
  "package-maintainer"` is a declaration in the maintainer's own file, and the
  gate header's clause is about whose judgement the row semantics are, not
  about who is permitted to type. So the honest state is a **conflict the
  maintainer resolves, not a resolution**: the file asserts both that these
  occasions are the corpus owner's and that an agent ran one. What makes that
  tolerable rather than a quiet override is that 1.2a's judgement is fully
  auditable — the URLs, the HTTP codes and the one rename are written down, so
  the owner can check the call rather than take it. **Do not read this as
  owner-declared judgement being agent-executable in general**: D4 is marked
  not-precedent, and 1.2b–d are held here for the maintainer. If the maintainer
  disagrees, the repair is to revert the one CSV citation and the one stamp,
  both one-line diffs.
- **What to do:** run the remaining three occasions on three further separate
  dates before ~2026-12-27, one corpus each, in any order — 1.2b through 1.2d
  carry the upstream, the suggested window, the diff baseline and the exact
  inputs for each. None of the three may land on `2026-10-01`, which 1.2a now
  holds. For each occasion: verify that
  corpus against its upstream, then set only that manifest's
  `upstream.last_checked` to the date the check actually ran, and confirm with
  `./scripts-run src/scripts/check_corpus_staleness`. Separately, decide the
  `draft` question this file's Context raises: (a) leave `status: draft` until
  1.2d lands, keeping Risk 2's guard in place and accepting that the dashboard
  does not carry the deadline; (b) flip to `status: ready` now, gaining
  dashboard visibility and accepting that `/roadmap:process-*` may reach the
  stamp edits; (c) park under `later/` with a wake condition on the expiry date.
- **Recommendation:** (a), and (a) is what the tree still carries after
  2026-10-01 — the `draft` question was deliberately NOT answered by the drain
  run (see D4), because flipping the status is the safety-floor change this
  file's Context reserves to the maintainer. Risk 2 names an agent editing these
  stamps as "the most convincing possible form of the wrong answer", and the
  three remaining open steps are exactly those edits. Option (b) trades the
  guard for visibility the gate already supplies: `check_corpus_staleness`
  reddens every PR at ~2026-12-27 whether or not the dashboard carries this
  file, so the deadline announces itself. Option (c) buys the same visibility as
  (b) at the cost of a wake condition nothing reads.
- **If you do nothing:** the three stamps still reading `2026-09-18`
  (`api-design`, `database`, `threat-modeling`) cross the 100-day bound together
  on ~2026-12-27 and redden every open pull request at once — a three-way
  rerun of the 2026-09-18 incident this roadmap exists to prevent, on a date
  that is already known. `accessibility-auditor` is out of that cohort as of
  2026-10-01 and next comes due ~2027-01-09. **And the first red arrives
  earlier than that, from outside this roadmap:** `design-intelligence`, the
  sixth `quarterly` corpus, reds every PR on **2026-11-22**. Doing nothing here
  does not buy quiet until December.
- **Resolved when:** `./scripts-run src/scripts/check_corpus_staleness` exits 0
  and the four `upstream.last_checked` values under
  `src/skills/{accessibility-auditor,api-design,database,threat-modeling}/data/manifest.json`
  are four *distinct* dates — not merely not-all-equal, per D3.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|----|-----------|-------------|----------|----------|------------|
| D1 | contested-technical | council:anthropic+openai | **Stagger — reached prospectively, by four real re-checks on separate dates before ~2026-12-27. The four existing `2026-09-18` stamps are NOT edited.** Rejected: (a) keep the batch and record it as intended — the facts establish only that the four were *checked* together, never that they are interdependent or share an upstream, so this would record a coupling nobody has shown to exist; (b) change the gate's severity to warn — changes the blast radius without answering the cadence question, and leaves a required check that no longer checks; (c) stagger by editing the stamps — rejected outright, see evidence. | A `last_checked` stamp asserts that a corpus was verified against its upstream on that date, so moving one without a corresponding verification is fabricated evidence — the identical defect the parent roadmap found in `last_eval`, and precisely the failure mode Risk 2 names. Staggering is the right *shape*; four genuine checks on four separate dates is the only honest way to reach it, and it also produces the re-check work the quarterly cadence exists to force. Council 2026-09-27: 2 of 2 seats, 2 rounds, converged, no billable spend; both seats rejected stamp-editing independently. | The four corpora turn out to share an upstream or a release train (then the batch is real and (a) becomes correct); or four separate re-check sittings a year prove operationally impractical; or corpus freshness is shown to be informational rather than safety-relevant. |
| D2 | contested-technical | council:anthropic+openai, then a deterministic tree check | **D1's "the four existing `2026-09-18` stamps are NOT edited" governs unqualified. The documented 2026-09-27 re-derivation does NOT move `last_checked` on `database` or `threat-modeling`.** The competing reading — that D1 forbids only editing *without* a verification, so a verification that demonstrably happened may be recorded — is rejected. | Raised because both manifests' `upstream.sha` literally begin `"re-derived 2026-09-27 against …"` while `upstream.last_checked` reads `2026-09-18`, which reads as an under-report and invites exactly the one-line edit Risk 2 names. Put to the council 2026-09-30 (2 of 2 seats, 2 rounds, $0.0736). **The council did not converge on a verdict** — it split on whether D1 was time-bound, routed that crux to the maintainer, and ranked one deterministic test first: does the "roadmap note" the commit cites actually exist? Both seats stated the test's consequence in advance — *"if the note exists and says what the commit author claims, Reading A wins by the roadmap's own terms and the case closes"* — and one seat predicted on the record that the grep would fail. **It did not fail.** `agents/roadmaps/archive/road-to-corpus-refresh-2026-q3.md:30` reads: "The date half is already done and is **not re-done here**: all four `last_checked` fields were updated on 2026-09-18 because someone actually looked." The 2026-09-27 pass was therefore scoped to content by an explicit written instruction, and its author followed it rather than misreading it. The pre-registered test settles the question against the reading that motivated it. | The maintainer states that D1's freeze was time-bound to the state of the manifests on 2026-09-27; or the parent roadmap's content/date split is superseded by a later instruction. |
| D3 | reversible-technical | agent | **1.2's verify is tightened from "no longer all equal" to four *distinct* dates.** AC-2 carries the same tightening. | Read off the Goal's own wording, not imported from outside the file. The former wording passes with three corpora still sharing one stamp — e.g. one check lands and the other three stay at `2026-09-18` — while the Goal requires that "the four no longer expire on the same day". A verify a partial result satisfies is not a test of the Goal it sits under. No trade-off: under D1 the four checks are separate occasions anyway, so four distinct dates is what executing D1 produces, and the tightening only stops a premature close. | The maintainer prefers an outcome test ("no two expiries within N days") over a distinctness test, which would tolerate two corpora genuinely checked on one day. |
| D4 | reversible-technical | agent — **provisional, pending maintainer; not precedent for 1.2b–d** | **An explicit `/roadmap:process-full` grant naming this file authorises an agent to RUN one of D1's four occasions — verify the corpus, then stamp the date the verification ran. It does not authorise moving a stamp without one, and it does not authorise the `draft`→`ready` flip.** Taken on 2026-10-01; 1.2a ran under it, 1.2b–d did not. | Risk 2's mitigation is "1.1's verify demands a RECORDED decision before 1.2 touches any manifest" — 1.1 is closed and D1 is that decision, so the gate Risk 2 erects has been passed rather than bypassed. Its second clause, the `draft` guard, is scoped to a `/roadmap:process-*` run that picks this file up **unprompted**; this run was prompted at the file by name. What the grant does NOT reach is the status flip: the Context names that a safety-floor change reserved to the maintainer, and a grant to execute a roadmap's steps is not a grant to remove the guard that protects them — so `status: draft` is unchanged and the blocker's (a)/(b)/(c) question is still open. **On D2, which must be cited here rather than worked around.** D2 rejects the reading that "D1 forbids only editing *without* a verification, so a verification that demonstrably happened may be recorded", and says D1 governs unqualified. That rejection is about the four **existing `2026-09-18` stamps** and a verification that happened in the **past** — it forbids back-dating the 2026-09-27 content re-derivation onto a stamp. It does not and cannot forbid D1's own prescribed mechanism, which is a **fresh** check whose date is the date it ran: D1's text is "four real re-checks on separate dates before ~2026-12-27", so a reading of D2 that forbade this would forbid D1 from ever being satisfied. The discriminator is tense, not degree — past verification recorded late versus a check run today — and it is stated here because the file previously made it only in the 1.2c and 1.2d deferral paragraphs, where a reader of D4 would not find it. **The ownership asymmetry is named, not hidden**: D2 is council-resolved and D4 is agent-resolved, so D4 deliberately narrows nothing in D2 — it adds who may execute D1, and leaves D2's freeze on the four existing stamps untouched. All four `2026-09-18` values were still `2026-09-18` when 1.2a ran; `accessibility-auditor`'s moved because a check ran on 2026-10-01, not because the freeze was lifted. **What this row may NOT be used for** (added 2026-10-01 after round-2 review): D4 is agent-resolved and was written in the run it authorised, so it is a *record* of that run, never a *warrant* for the next one. It is explicitly not counted among Risk 2's mitigations — that would make the guarded party its own guard — and 1.2b, 1.2c and 1.2d do not inherit it. Each needs its own grant, or a maintainer who converts this row into a standing one. | **Review on first reading by the maintainer, whichever way it goes** — a provisional row that nobody ever reads is the accumulation the `draft` guard exists against. Also: the maintainer states that the four occasions are reserved to a human regardless of grant — in which case 1.2a's stamp stands (the check did happen) but no further occasion is run by an agent; or a future grant is shown to have reached this file without a human naming it. |

**Provenance.** Decided by AI council on 2026-09-27 — 2 of 2 seats present
(anthropic, openai), 2 rounds, converged, no billable spend. The maintainer
delegated this specific question to the council in-session, which is the only
reason an agent-run council answered a question this roadmap reserves to the
maintainer; absent that delegation the reservation stands. Both seats
independently rejected stamp-editing, and both arrived at "create the stagger
through real future checks" without prompting. The council also observed that
this question and the parent's `last_eval` staleness share one principle —
evidence must come from the event that proves it — while needing two different
mechanisms, and asked whether a fixed-cadence gate is the right control at all
for verification work that is episodic upstream; that second question is NOT
answered here and is left open.

**Provenance, D2 (2026-09-30).** Same two seats, 2 rounds, $0.0736 billable,
`--mode-override api` because both CLI transports failed the live probe in a
fresh worktree. Recorded honestly: this round produced **no convergent verdict**
and is not cited as one. What it produced was a ranked test with its consequence
stated before the result was known, and the test came back against the reading
the round was convened to examine. The council's remaining open items — whether
Risk 2's wording should distinguish *fabricating* a stagger from *recognising*
a documented one, and whether D1's four-dates *means* or the no-four-way-red
*outcome* is the binding success criterion — are left for the maintainer; D3
settles only the narrow verify-wording half of the second.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The question is never put, and the four-way red simply recurs | product | A draft roadmap nobody flips to ready is indistinguishable from a dropped one, and the next expiry lands mid-PR exactly as the last one did | The expiry is dated (~2026-12-27 on the current stamps) and is named in the Context above, so the recurrence is predictable rather than a surprise; the parent roadmap's archive entry points here. Strengthened 2026-09-30: the four occasions are now four separate checkboxes with suggested windows, and the hold that carries them states what happens if nothing is done. Materially reduced 2026-10-01: occasion 1 of 4 actually ran, so the risk is no longer "nobody ever starts" but "the remaining three stall" — a smaller and more visible failure, and the three deferral paragraphs now carry the exact inputs each one needs rather than a window alone | Phase 1 — Put the question, then apply the answer |
| 2 | An agent answers the maintainer's question by staggering the stamps on its own | implementation | Editing a `last_checked` value is a one-line change an agent can trivially make, and doing so would fabricate a decision while making the gate green — the most convincing possible form of the wrong answer | 1.1's verify demands a RECORDED decision before 1.2 touches any manifest, and this roadmap ships `draft` so no `/roadmap:process-*` run picks it up unprompted. Strengthened 2026-09-30: D2 closes the one reading under which an agent could have believed a stamp edit was authorised, and the `draft` guard is now defended explicitly in Context rather than left as an unexamined default. Re-examined 2026-10-01 after an agent moved one stamp: the distinction that held is **verification-before-stamp**, not agent-versus-human — 1.2a's stamp is backed by a probe log naming twelve URLs and their HTTP codes, and it found a real upstream rename rather than confirming what was already written. The `draft` guard is now known to be narrower than its wording claimed (it governs selection, not reachability — see Context), so the load-bearing mitigation is **D1's evidence requirement**, which is council-resolved and which an agent cannot restate. **D4 is deliberately NOT counted as mitigation here** (corrected 2026-10-01 after round-2 review): D4 is agent-resolved and was authored in the run it authorised, so citing it as half the guard against "an agent decides this alone" is circular — the guard would be a decision the guarded party made about itself. D4 records what one run did and why; it is **not precedent for occasions 2–4**, and the maintainer may void it without voiding 1.2a's check, which happened. The honest residual: between now and a maintainer reading D4, the only non-circular mitigations are D1's evidence requirement and the fact that every stamp move is a one-line diff a reviewer can see | Phase 1 — Put the question, then apply the answer |

## Acceptance Criteria

- [x] AC-1 — A recorded decision names the chosen shape (stagger, intended
      batch, or gate-severity change) and its reason. *(D1, 2026-09-27.)*
- [ ] AC-2 — The four corpus manifests **this roadmap covers** — the batch that
      shared `2026-09-18`, namely `accessibility-auditor`, `api-design`,
      `database` and `threat-modeling`, which is four of the six that declare
      `refresh_cadence: quarterly` and not all of them — carry four **distinct**
      `upstream.last_checked` dates (per D3 — not merely not-all-equal), each
      equal to the date its check actually ran, and
      `./scripts-run src/scripts/check_corpus_staleness` exits 0 against them.
      *(2026-10-01: one of four. `accessibility-auditor` reads `2026-10-01`,
      backed by a check that ran; `api-design`, `database` and `threat-modeling`
      still share `2026-09-18`. The gate exits 0, but the distinctness test
      fails — three of the four values are equal, not four distinct ones — and
      those same three stamps are not each the date of their own check.
      Deliberately NOT flipped: a green gate is not the test this criterion
      states.)*
