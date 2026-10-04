---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-corpus-refresh-2026-q3
estate_growth_exempt: "a blocker discovered while doing the work — 1.2's four re-checks cannot share one calendar date, which no prior pass had written down as a structured hold"
---
# Road to corpus refresh cadence shape

> **Source:** the deferred item 2.1 of `road-to-corpus-refresh-2026-q3`, carried
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
2026-10-04 that batch is down to **two** (1.2a moved `accessibility-auditor` to
`2026-10-01`; 1.2b moved `api-design` to `2026-10-04`); ~2026-12-27 is unchanged
for the remaining two, `database` and `threat-modeling`.

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
done, so the structure now matches the decision. All four were held by the same
blocker — see [`four-dated-re-checks-are-calendar-bound`](#blocker-four-dated-re-checks-are-calendar-bound);
**1.2a came off that hold on 2026-10-01 and 1.2b on 2026-10-04**, so the blocker
now holds 1.2c and 1.2d. The order below is a suggestion, not a constraint; what
is binding is that no two land on the same date and all four land before
~2026-12-27 — 1.2b ran ahead of its suggested window on exactly that permission.

**What the hold actually reserves — measured 2026-10-04, after a deliberate
search for a further exit.** The hold has two halves and only one is
irreducible. The **role** half — that these occasions are the corpus owner's —
already carries a named exit: D4 established that an explicit
`/roadmap:process-full` grant naming this file authorises an agent to run one
occasion, and 1.2a and 1.2b each ran under one (D4, D5). So the reservation is
role-shaped but not role-locked. The **calendar** half has no exit: one session
occupies one date, and nothing in this tree lets a single run produce two honest
ones. The one mechanism that looks like an exit is not one —
`check_corpus_staleness` accepts `--today`, but injecting a date to manufacture
a second stamp
is the fabricated evidence D1 exists to forbid, so it is a way to break the rule
rather than to satisfy it. Read the remaining hold as arithmetic, not as
permission, and do not re-derive the role question: it is answered.

**The second obstacle under this one, measured rather than discovered later.**
A stamp edit is never only a stamp edit. `check_routing_coverage` derives its
touched-skill set from `^src/skills/([^/]+)/`, so editing *any* path under a
skill — `data/manifest.json` included — makes that skill touched, and a touched
skill with a `SKILL.md` and no `evals/triggers.json` fails the gate, which runs
in `.github/workflows/rule-backstops.yml` and therefore blocks the pull request.
1.2b hit this for real: the one-line stamp reddened the gate with
`src/skills/api-design/evals/triggers.json`, and the corpus was written. **The
per-step delta, read off the tree on 2026-10-04:** `database` has no `evals/`
directory, so **1.2c will hit this and must budget for a trigger corpus**;
`threat-modeling` already ships `evals/triggers.json`, so **1.2d will not**.
Second-order cost, also measured: shipping a trigger corpus beside a SHA-pinned
manifest adds the skill to `lint_eval_freshness`, which went from two entries to
three when 1.2b landed. That gate is registered only in `taskfiles/ci-fast.yml`
and in **no** workflow — checked against a control that did find
`check_routing_coverage` in a workflow — so it blocks no pull request today.

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
      reports no staleness **for the four manifests this roadmap covers**. The
      gate is whole-tree and has no per-corpus flag, so from 2026-11-22 it exits
      1 on `design-intelligence`, which is out of scope here (see Context) — a
      bare "exits 0" would make this verify unsatisfiable without absorbing
      somebody else's work. Read the gate's findings list, not only its exit
      code.

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
      `upstream.sha` carries the upstream IDENTITY only — which, after the
      rename, *includes* `menu-button` as the canonical slug, so finding 3 is
      reflected there while findings 1 and 2 (the supersession check, the eleven
      unchanged URLs) are not. An earlier wording said the field "records none
      of the three findings"; that was false against the shipped value and
      against this step's own correction note below, and it mattered because
      1.2b–d are told to use this row as the worked example — a session
      following the false line would have stripped an identity component from
      three manifests that a session following the correction note would keep.
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
      convention in this tree is author-date-as-`last_eval`. **The stated cost
      of deviating was overstated and is corrected here** (round-7 review): this
      paragraph said omitting the field "would have reded `check_trigger_evals`
      for a single file", implying a green gate turned red. That gate is already
      red on this tree, independently — a fresh run exits 1 with **39** stale
      findings dated 2026-06-16 / 06-24 / 06-27. Omitting the field would have
      added a fortieth to an already-failing gate, which is a materially cheaper
      price than the sentence implied, and the sentence was carrying the
      decision. The convention is still followed, now for the honest reason:
      consistency with 102 siblings, not avoidance of a red that was already
      there. Named rather than quietly followed, because "everyone does it" is a
      reason to surface a convention, not a reason it is sound; whether that
      field should mean *authored* or *evaluated* is the maintainer's call and
      belongs with the `lint_eval_freshness` question below.

      `trigger_eval_rotation` is the fourth gate — a weekly live canary.
      **It is NOT a canary over every corpus each week, and the claim that it
      "is green for this file today" was itself an unbacked freshness assertion
      — in the paragraph written to flag exactly that class** (round-7 review).
      Rotation is a pure function of week index and suite name:
      `slot_of('accessibility-auditor', 12)` is 0, the run on 2026-10-01 reports
      `week=2961` with due slot 9, and this suite is not due until roughly
      2026-10-22. Nothing evaluated it today, so no green result for it could
      exist; and the run exits 1 anyway on an unrelated suite below its floor.
      The honest statement is that this file enters the rotation and first comes
      due in about three weeks.

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
      fixed **by this run**, which is a different and much weaker claim than the
      one this paragraph made until round-7 review checked it. **The retracted
      claim, stated plainly because it was load-bearing:** this step asserted
      that the gate's remedy — *"run the live eval and `agent-config
      eval:record`"* — named two steps that **"neither exist"**. Both exist.
      `test-triggers-live` is defined in `taskfiles/engine.yml` and reaches the
      root namespace through `Taskfile.yml`'s `flatten: true` include, so
      `task --list` prints it; `./agent-config eval:record` answers `error:
      required option '--eval-json <path>' not specified`, not `unknown
      command`. The error was a too-shallow check — the root `Taskfile.yml` and
      the CLI's top-level listing, neither of which shows a flattened include or
      a sub-verb's options — and it is the kind of absence claim
      `external-reference-deep-dive` exists to forbid.

      **What is actually true, which is a constraint and not a gap.**
      `test-triggers-live` is a live Claude-API run: it requires a key file at
      `~/.event4u/agent-config/anthropic.key` at mode 0600, an interactive tty,
      and an explicit `yes` at a cost preview. None of those is available to an
      autonomous drain run, and the spend is the maintainer's to authorise — so
      the two entries are **fixable, by a human, in one sitting**, not unfixable.
      That changes the disposition from "infrastructure gap" to "owed work with
      a known command", which is a better outcome than the one this paragraph
      originally reported. The gate is
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
      is owed is one evidence line there naming both skills and the real
      procedure: `task test-triggers-live -- <skill>` behind the 0600 key, a
      tty and a `yes` at the cost preview, then `agent-config eval:record
      --eval-json <path>`. **Do not carry the retracted "both resolve to
      nothing" wording into that hand-off** — it was false, and propagating it
      would record a non-existent infrastructure gap in a second active
      roadmap. Until that line lands, the two red entries are tracked by
      **this** paragraph and nowhere else, which is the weaker state and is
      named as such. The
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
      upstream identity itself moved. **A calendar year is not an identity**
      (corrected after round-7 review): the field first read `"… APG 2026
      menu-button"`, and `APG 2026` names nothing checkable — the Authoring
      Practices Guide is continuously published and ships no year-versioned
      release, so the token is a vintage marker of the same kind as the
      `verified … 2026-09-18` string the repair removed, and it would read stale
      in 2027 with no upstream change. It now reads
      `APG continuously-published, menu-button canonical slug`. Use this row as
      the worked example for 1.2b–d **after** that correction, not before: an
      identity is something a later reader can disagree with by checking the
      upstream, and a year nobody publishes is not. **The defect was swept across all four
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
- [x] **1.2b Re-check `api-design` against its upstream and stamp the date the
      check ran.** *(2026-10-04 — occasion 2 of 4, deliberately ahead of its
      suggested window, which the preamble permits. Ran under the
      `/roadmap:process-full` grant recorded as D5.)*
      Upstream is RFC 9110 / 9457 / 7396 / 8288 plus the httpapi WG drafts.
      Suggested window: early November 2026. The check is whether any of the
      four RFCs has been obsoleted or updated since 2026-09-18.
      verify: `src/skills/api-design/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      reports no staleness **for the four manifests this roadmap covers**. The
      gate is whole-tree and has no per-corpus flag, so from 2026-11-22 it exits
      1 on `design-intelligence`, which is out of scope here (see Context) — a
      bare "exits 0" would make this verify unsatisfiable without absorbing
      somebody else's work. Read the gate's findings list, not only its exit
      code.

      **Evidence (2026-10-04).** The hold on this step was calendar-bound, and
      the calendar moved: 1.2a took `2026-10-01` and this session ran on a
      different day, so the "differing from the other three" clause was
      satisfiable for the first time. The step was therefore due work rather
      than a wait, and it ran ahead of its suggested early-November window on
      the preamble's explicit permission.

      **The check, run before the stamp moved.** All four upstream RFCs were
      probed at `rfc-editor.org` and **none has been obsoleted or updated**
      since `2026-09-18`. Mastheads read: 9110 *STD 97, Standards Track, June
      2022* (obsoletes 2818/7230–7235/7538/7615/7694, updates 3864); 9457
      *Standards Track, July 2023* (obsoletes 7807); 7396 *Standards Track,
      October 2014* (obsoletes 7386); 8288 *Standards Track, October 2017*
      (obsoletes 5988). Each info page was parsed for an `Obsoleted by (n)` and
      an `Updated by (n)` block; all four returned **NONE** for both.
      **The negative is controlled, not assumed:** RFC 7807 — known to be
      obsoleted by 9457 — was run through the identical extractor and *did*
      report `Obsoleted by (1) RFC 9457`, so the detector demonstrably fires
      when there is something to find. Without that control a mistyped selector
      and a genuine no-change would have been byte-identical. Separately, all
      ten distinct URLs cited by `api-patterns.csv` return `200` under
      `curl -sL -o /dev/null -w '%{http_code}'`.

      **One finding the previous occasion could not have seen.** Its check was
      scoped to the four RFCs; the upstream declaration also names "httpapi WG
      drafts", and the *Idempotency* row cites
      `draft-ietf-httpapi-idempotency-key-header`. That draft is **Expired and
      archived** (`draft-...-07`, IESG state *Expired*, intended RFC status
      *None*). It expired `2026-04-18`, which **predates** the 2026-09-18
      reading — so this is newly *observed*, not newly *true*, and it is not a
      change since the last check. The sibling
      `draft-ietf-httpapi-ratelimit-headers` is an **Active** Internet-Draft.
      Neither has become an RFC. **Deliberately not acted on:** no RFC
      supersedes the expired draft and the WG lists no replacement, so there is
      no better citation to move to; rewriting the row would also pull the CSV
      into the touched-skill consequences for no retrieval gain. Recorded for
      the corpus owner instead of churned — the note tier of
      `active-remediation`, not silence.

      **The stamp, and why this date.** `upstream.last_checked` moved
      `2026-09-18` → `2026-10-04`. That is the **UTC** date the check ran,
      which is what the gate reads as today; the local calendar said
      `2026-10-05`, and stamping that would have been one day ahead of the gate
      reference and produced a `future-date` finding naming this very corpus
      — a real finding class in `check_corpus_staleness`, not a hypothetical
      — breaking the verify this step is trying to satisfy.

      **The repair this step owed, applied.** `upstream.sha` read *"RFC 9110
      (STD 97) / 9457 / 7396 / 8288 — verified 2026-09-18: 9110 neither
      obsoleted nor updated; 9457 current and obsoletes 7807"* — a read-date
      and a finding inside a byte-equality identity key. It now reads `RFC 9110
      (STD 97, 2022-06) / 9457 (2023-07, obsoletes 7807) / 7396 (2014-10) /
      8288 (2017-10) — all Standards Track`: identity only, nothing about when
      it was read, and every token disagreeable by checking the upstream. Per
      1.2a's two-sided rule the evicted narration needs a durable record unless
      a later check **subsumes** it — this one does: the same question (has any
      of the four moved?) was re-asked today and answered the same way, and
      both the replaced string and its replacement are quoted verbatim here.
      Count after this step: 3 of 4 manifests carried the read-date-in-identity
      construct, **2 of 4 are now repaired** (1.2a, 1.2b); `database` and
      `threat-modeling` remain, named in 1.2c and 1.2d.

      **Gate.** `./scripts-run src/scripts/check_corpus_staleness --today
      2026-10-04` → *"6 corpus manifest(s), 41 CSV(s) opened: every declared
      cadence is met"*, **no finding naming any of the four**. The four stamps
      now read `2026-10-01` / `2026-10-04` / `2026-09-18` / `2026-09-18` —
      three distinct values, so AC-2's four-distinct test is **not** yet met and
      the box stays open deliberately.

      **What the one-line stamp actually cost — the second obstacle, measured.**
      Touching `data/manifest.json` made `api-design` a touched skill for
      `check_routing_coverage`, which had no `evals/triggers.json` for it and
      exited 1 naming that exact path. The corpus was written rather than the
      gate worked around: 5 exemplars, 3 near-misses drawn from the neighbours
      this skill's own `SKILL.md` names (`api-endpoint`, `api-testing`) plus
      `openapi`, and 2 counterexamples guarding the "API" homonym. Skill routing
      coverage rose `0.3712` → `0.3746`. The honest cost: `api-design` now
      enters `lint_eval_freshness`, which went **2 → 3** entries, and its
      `last_eval` carries the **authoring** date with **no live eval behind it**
      — the tree's existing convention, named rather than quietly followed, and
      the same unbacked-freshness class 1.2a flagged on itself. That gate runs
      in no workflow (verified against a control), so it blocks nothing today.
- [ ] **1.2c Re-check `database` against its upstream and stamp the date the
      check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is the PostgreSQL 18 and MySQL 9.7 reference documentation.
      Suggested window: late November 2026. Note that the *content* half was
      re-derived on 2026-09-27 (commit `6991eeab9`); per D2 that re-derivation
      does not move the stamp, so this occasion is a fresh check.
      verify: `src/skills/database/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      reports no staleness **for the four manifests this roadmap covers**. The
      gate is whole-tree and has no per-corpus flag, so from 2026-11-22 it exits
      1 on `design-intelligence`, which is out of scope here (see Context) — a
      bare "exits 0" would make this verify unsatisfiable without absorbing
      somebody else's work. Read the gate's findings list, not only its exit
      code.

      **Evidence (2026-10-04) — still deferred, and the reason narrowed.**
      Occasion 3 of 4 cannot share a date with 1.2a (`2026-10-01`) or 1.2b
      (`2026-10-04`) without failing its own "differing from the other three"
      verify and AC-2's four-distinct test (D3). One session is one date and
      1.2b took this one, so this step is held by arithmetic alone — the role
      half of the hold is answered (see the phase preamble). **Its own second
      obstacle, measured 2026-10-04:** `src/skills/database/` has **no `evals/`
      directory**, so the stamp edit below *will* red `check_routing_coverage`
      — which does block the pull request — until
      `src/skills/database/evals/triggers.json` is written. Budget for the
      corpus, not just the one-line edit; use `src/skills/api-design/evals/
      triggers.json` (written by 1.2b) as the worked example.

      **Hand-over — exact anchors, read 2026-10-04.** In
      `src/skills/database/data/manifest.json`, line **33** currently reads
      `    "last_checked": "2026-09-18"` and line **32** opens
      `    "sha": "re-derived 2026-09-27 against PostgreSQL 18.x / MySQL 9.7: …"`
      (606-character value on 1.2d's manifest; this one runs ~700). If either
      line no longer reads that, the file moved under this note — re-locate
      before editing. The change, verbatim:

      ```json
      "sha": "PostgreSQL 18.x / MySQL 9.7 reference documentation (PostgreSQL 16.x and MySQL 8.4 also supported)",
      "last_checked": "<the UTC date the check actually ran>"
      ```

      Use the **UTC** date, not the local one: a stamp ahead of the gate's
      reference trips its `future-date` finding class and breaks this step's own
      verify (1.2b hit this). The command that flips the condition:
      `./scripts-run src/scripts/check_corpus_staleness --today <that date>` —
      read the findings list, not the exit code. **Exact inputs a future session needs:** run on a calendar day
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
      reports no staleness **for the four manifests this roadmap covers**. The
      gate is whole-tree and has no per-corpus flag, so from 2026-11-22 it exits
      1 on `design-intelligence`, which is out of scope here (see Context) — a
      bare "exits 0" would make this verify unsatisfiable without absorbing
      somebody else's work. Read the gate's findings list, not only its exit
      code.

      **Evidence (2026-10-04) — still deferred, and the reason narrowed.**
      Same arithmetic as 1.2c, now excluding `2026-10-04` as well; this is
      occasion 4 of 4 and the one with a hard outer bound. **Its own second
      obstacle, measured 2026-10-04 — and this one is cheap:**
      `src/skills/threat-modeling/evals/triggers.json` **already exists**, so
      unlike 1.2c this step will **not** red `check_routing_coverage`, and the
      skill is already one of `lint_eval_freshness`'s entries, so the stamp edit
      adds no new gate cost at all. 1.2d is the cheapest of the three remaining.

      **Hand-over — exact anchors, read 2026-10-04.** In
      `src/skills/threat-modeling/data/manifest.json`, line **81** currently
      reads `    "last_checked": "2026-09-18"` and line **80** opens
      `    "sha": "re-derived 2026-09-27 against ATT&CK v19.x and ASVS 5.0.0: …"`
      (a 606-character value). If either line no longer reads that, the file
      moved under this note — re-locate before editing. The change, verbatim:

      ```json
      "sha": "MITRE ATT&CK v19.x Enterprise matrix; OWASP ASVS 5.0.0; OWASP API Top 10",
      "last_checked": "<the UTC date the check actually ran>"
      ```

      Use the **UTC** date, for the reason 1.2c's hand-over gives. The command
      that flips the condition:
      `./scripts-run src/scripts/check_corpus_staleness --today <that date>` —
      read the findings list, not the exit code. **Exact inputs a future session needs:** run on a calendar day
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

      **Note on the outer bound.** 1.2a moved one stamp to `2026-10-01` and
      1.2b a second to `2026-10-04`, so those corpora now expire ~2027-01-09 and
      ~2027-01-12 rather than ~2026-12-27. The **two** remaining at `2026-09-18`
      still expire together on ~2026-12-27, so the two-way red is what THIS
      roadmap's deadline guards against — two corpora smaller than the four-way
      red of 2026-09-18, and not yet the staggered end state the Goal asks for.
      **A distinctness pass is not yet a stagger, and that is worth naming
      before it is mistaken for one.** D3's test is four *distinct* dates, which
      a three-day gap satisfies; the Goal's purpose — spreading the re-check
      work and keeping at most one corpus red at a time — is served only weakly
      by `2026-10-01` and `2026-10-04` sitting three days apart, and the two
      resulting expiries will land three days apart too. Nothing is wrong: D1
      forbids editing a stamp to widen the spacing, so the spacing is whatever
      the real check dates were. But it is why 1.2c and 1.2d should hold their
      late-November and mid-December windows, and it is the concrete case behind
      D3's own `revisit if` — a maintainer who prefers an outcome test ("no two
      expiries within N days") over a distinctness test now has a worked example
      of the difference rather than a hypothetical. **It is not the next repo-wide red**:
      `design-intelligence`, a sixth `quarterly` corpus outside this roadmap's
      subject, crosses the bound on **2026-11-22** — see Context. Do not read
      ~2026-12-27 as "the next time PRs go red"; read it as "the deadline for
      1.2b–d".

## Blockers

### blocker: four-dated-re-checks-are-calendar-bound
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.2c, 1.2d — and AC-2 through them. **1.2a came off this hold on
  2026-10-01 and 1.2b on 2026-10-04**, each when its occasion was run for real
  under an explicit `/roadmap:process-full` grant (D4, D5): `accessibility-
  auditor` was verified against WCAG 2.2 and the APG (finding one renamed
  pattern), `api-design` against RFC 9110/9457/7396/8288 (finding no
  obsoletion, under a control that proved the detector fires), and each stamp
  moved to the date its check ran. The hold is unchanged **in kind** and
  smaller **in extent** — two occasions on two further distinct dates remain,
  and no single session can produce them.
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
- **What to do:** run the remaining **two** occasions on two further separate
  dates before ~2026-12-27, one corpus each, in either order — 1.2c and 1.2d
  carry the upstream, the suggested window, the diff baseline, the exact
  anchors (file, line number, current content quoted) and the verbatim change
  for each. Neither may land on `2026-10-01` (1.2a) or `2026-10-04` (1.2b).
  **Cost is not equal between them, measured 2026-10-04:** 1.2c must also write
  `src/skills/database/evals/triggers.json` or it reds `check_routing_coverage`,
  which does block the PR; 1.2d needs no such corpus and is the cheaper of the
  two. **Keep their late-November and mid-December windows** rather than running
  them early: 1.2a and 1.2b are now only three days apart, so the spread the
  Goal asks for depends on the remaining two landing far from them and from each
  other. For each occasion: verify that
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
- **If you do nothing:** the **two** stamps still reading `2026-09-18`
  (`database`, `threat-modeling`) cross the 100-day bound together on
  ~2026-12-27 and redden every open pull request at once — a two-way rerun of
  the 2026-09-18 incident this roadmap exists to prevent, on a date that is
  already known. `accessibility-auditor` left that cohort on 2026-10-01 (next
  due ~2027-01-09) and `api-design` on 2026-10-04 (next due ~2027-01-12). **And the first red arrives
  earlier than that, from outside this roadmap:** `design-intelligence`, the
  sixth `quarterly` corpus, reds every PR on **2026-11-22**. Doing nothing here
  does not buy quiet until December.
- **Resolved when:** the four `upstream.last_checked` values under
  `src/skills/{accessibility-auditor,api-design,database,threat-modeling}/data/manifest.json`
  are four *distinct* dates — not merely not-all-equal, per D3 — and
  `./scripts-run src/scripts/check_corpus_staleness` reports **no staleness
  finding naming any of those four**. Deliberately NOT a bare "exits 0"
  (corrected 2026-10-01 after round-6 review): the gate is whole-tree and has no
  per-corpus flag, and `design-intelligence` — out of scope here, see Context —
  reds it from 2026-11-22, which falls inside 1.2c's and 1.2d's own suggested
  windows. An exit-code condition would have made this blocker unresolvable
  without absorbing another corpus's work, or resolvable only by recording a
  false reading. Read the findings list.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|----|-----------|-------------|----------|----------|------------|
| D1 | contested-technical | council:anthropic+openai | **Stagger — reached prospectively, by four real re-checks on separate dates before ~2026-12-27. The four existing `2026-09-18` stamps are NOT edited.** Rejected: (a) keep the batch and record it as intended — the facts establish only that the four were *checked* together, never that they are interdependent or share an upstream, so this would record a coupling nobody has shown to exist; (b) change the gate's severity to warn — changes the blast radius without answering the cadence question, and leaves a required check that no longer checks; (c) stagger by editing the stamps — rejected outright, see evidence. | A `last_checked` stamp asserts that a corpus was verified against its upstream on that date, so moving one without a corresponding verification is fabricated evidence — the identical defect the parent roadmap found in `last_eval`, and precisely the failure mode Risk 2 names. Staggering is the right *shape*; four genuine checks on four separate dates is the only honest way to reach it, and it also produces the re-check work the quarterly cadence exists to force. Council 2026-09-27: 2 of 2 seats, 2 rounds, converged, no billable spend; both seats rejected stamp-editing independently. | The four corpora turn out to share an upstream or a release train (then the batch is real and (a) becomes correct); or four separate re-check sittings a year prove operationally impractical; or corpus freshness is shown to be informational rather than safety-relevant. |
| D2 | contested-technical | council:anthropic+openai, then a deterministic tree check | **D1's "the four existing `2026-09-18` stamps are NOT edited" governs unqualified. The documented 2026-09-27 re-derivation does NOT move `last_checked` on `database` or `threat-modeling`.** The competing reading — that D1 forbids only editing *without* a verification, so a verification that demonstrably happened may be recorded — is rejected. | Raised because both manifests' `upstream.sha` literally begin `"re-derived 2026-09-27 against …"` while `upstream.last_checked` reads `2026-09-18`, which reads as an under-report and invites exactly the one-line edit Risk 2 names. Put to the council 2026-09-30 (2 of 2 seats, 2 rounds, $0.0736). **The council did not converge on a verdict** — it split on whether D1 was time-bound, routed that crux to the maintainer, and ranked one deterministic test first: does the "roadmap note" the commit cites actually exist? Both seats stated the test's consequence in advance — *"if the note exists and says what the commit author claims, Reading A wins by the roadmap's own terms and the case closes"* — and one seat predicted on the record that the grep would fail. **It did not fail.** `agents/roadmaps/archive/road-to-corpus-refresh-2026-q3.md:30` reads: "The date half is already done and is **not re-done here**: all four `last_checked` fields were updated on 2026-09-18 because someone actually looked." The 2026-09-27 pass was therefore scoped to content by an explicit written instruction, and its author followed it rather than misreading it. The pre-registered test settles the question against the reading that motivated it. | The maintainer states that D1's freeze was time-bound to the state of the manifests on 2026-09-27; or the parent roadmap's content/date split is superseded by a later instruction. |
| D3 | reversible-technical | agent | **1.2's verify is tightened from "no longer all equal" to four *distinct* dates.** AC-2 carries the same tightening. | Read off the Goal's own wording, not imported from outside the file. The former wording passes with three corpora still sharing one stamp — e.g. one check lands and the other three stay at `2026-09-18` — while the Goal requires that "the four no longer expire on the same day". A verify a partial result satisfies is not a test of the Goal it sits under. No trade-off: under D1 the four checks are separate occasions anyway, so four distinct dates is what executing D1 produces, and the tightening only stops a premature close. | The maintainer prefers an outcome test ("no two expiries within N days") over a distinctness test, which would tolerate two corpora genuinely checked on one day. |
| D4 | reversible-technical | agent | **PROVISIONAL, pending maintainer — and NOT precedent for 1.2b–d.** **An explicit `/roadmap:process-full` grant naming this file authorises an agent to RUN one of D1's four occasions — verify the corpus, then stamp the date the verification ran. It does not authorise moving a stamp without one, and it does not authorise the `draft`→`ready` flip.** Taken on 2026-10-01; 1.2a ran under it, 1.2b–d did not. | Risk 2's mitigation is "1.1's verify demands a RECORDED decision before 1.2 touches any manifest" — 1.1 is closed and D1 is that decision, so the gate Risk 2 erects has been passed rather than bypassed. Its second clause, the `draft` guard, is scoped to a `/roadmap:process-*` run that picks this file up **unprompted**; this run was prompted at the file by name. What the grant does NOT reach is the status flip: the Context names that a safety-floor change reserved to the maintainer, and a grant to execute a roadmap's steps is not a grant to remove the guard that protects them — so `status: draft` is unchanged and the blocker's (a)/(b)/(c) question is still open. **On D2, which must be cited here rather than worked around.** D2 rejects the reading that "D1 forbids only editing *without* a verification, so a verification that demonstrably happened may be recorded", and says D1 governs unqualified. That rejection is about the four **existing `2026-09-18` stamps** and a verification that happened in the **past** — it forbids back-dating the 2026-09-27 content re-derivation onto a stamp. It does not and cannot forbid D1's own prescribed mechanism, which is a **fresh** check whose date is the date it ran: D1's text is "four real re-checks on separate dates before ~2026-12-27", so a reading of D2 that forbade this would forbid D1 from ever being satisfied. The discriminator is tense, not degree — past verification recorded late versus a check run today — and it is stated here because the file previously made it only in the 1.2c and 1.2d deferral paragraphs, where a reader of D4 would not find it. **The ownership asymmetry is named, not hidden**: D2 is council-resolved and D4 is agent-resolved, so D4 deliberately narrows nothing in D2 — it adds who may execute D1, and leaves D2's freeze on the four existing stamps untouched. All four `2026-09-18` values were still `2026-09-18` when 1.2a ran; `accessibility-auditor`'s moved because a check ran on 2026-10-01, not because the freeze was lifted. **What this row may NOT be used for** (added 2026-10-01 after round-2 review): D4 is agent-resolved and was written in the run it authorised, so it is a *record* of that run, never a *warrant* for the next one. It is explicitly not counted among Risk 2's mitigations — that would make the guarded party its own guard — and 1.2b, 1.2c and 1.2d do not inherit it. Each needs its own grant, or a maintainer who converts this row into a standing one. | **Review on first reading by the maintainer, whichever way it goes** — a provisional row that nobody ever reads is the accumulation the `draft` guard exists against. Also: the maintainer states that the four occasions are reserved to a human regardless of grant — in which case 1.2a's stamp stands (the check did happen) but no further occasion is run by an agent; or a future grant is shown to have reached this file without a human naming it. |
| D5 | reversible-technical | agent | **PROVISIONAL, pending maintainer — and NOT precedent for 1.2c–1.2d.** **The second `/roadmap:process-full` grant naming this file authorised occasion 2 of 4 — `api-design` verified against its upstream, then stamped with the date that verification ran.** Taken 2026-10-04 under the same reading D4 records and on the same terms: it does not authorise moving a stamp without a check, and it does not authorise the `draft`→`ready` flip, which is untouched. | D4 states that each occasion needs its own grant rather than inheriting one; this run had its own, so D5 is that grant's record rather than an appeal to D4's. The substantive justification is unchanged from D4 and is not restated here. What D5 adds is a **measurement D4 could not make**: the hold's two halves are separable, and only the calendar half is irreducible — the role half has a named exit (an explicit grant) that has now been used twice, while no mechanism produces two honest dates in one session. A deliberate search for a further exit found none; `--today` is injection, not an exit. Also measured here and owed to the next two occasions: a stamp edit pulls its skill into `check_routing_coverage`'s touched-skill scope, which **does** block the PR — `api-design` needed a trigger corpus written, `database` will, `threat-modeling` will not. | **Review on first reading by the maintainer, whichever way it goes** — same standing as D4, and the two rows should be read together rather than as an accumulating pattern. If the maintainer rules the occasions human-only regardless of grant, 1.2a's and 1.2b's stamps stand (both checks did happen, both are auditable) and no further occasion is agent-run. |

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
<!-- risk-review: v1 | reviewed: 2026-10-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The question is never put, and the four-way red simply recurs | product | A draft roadmap nobody flips to ready is indistinguishable from a dropped one, and the next expiry lands mid-PR exactly as the last one did | **Two dates, and conflating them was this row's own defect until round-7 review** — `~2026-12-27` is when the three stamps still reading `2026-09-18` expire together, which is THIS roadmap's deadline; the next repo-wide red is `2026-11-22`, from `design-intelligence`, which is out of scope here. The row previously said "~2026-12-27 on the current stamps", true of no current set since 1.2a moved one to `2026-10-01` (next due ~2027-01-09). Both dates are now in the Context with their arithmetic, so the recurrence is predictable rather than a surprise; the parent roadmap's archive entry points here. Strengthened 2026-09-30: the four occasions are now four separate checkboxes with suggested windows, and the hold that carries them states what happens if nothing is done. Materially reduced 2026-10-01: occasion 1 of 4 actually ran, so the risk is no longer "nobody ever starts" but "the remaining three stall" — a smaller and more visible failure, and the three deferral paragraphs now carry the exact inputs each one needs rather than a window alone. **Re-reviewed 2026-10-04 against measured numbers:** occasion 2 of 4 ran, the cohort still sharing `2026-09-18` is down from three to **two**, and the two remaining deferrals now carry exact anchors — file, line number, the current content quoted so a shifted anchor is detectable, and the verbatim replacement — plus each step's **measured** gate cost (1.2c must also write a trigger corpus or it reds a PR-blocking gate; 1.2d needs none). Residual, and it is the honest one: two occasions still need two further distinct dates before ~2026-12-27, and nothing in this file makes a future session run them. The 2026-11-22 `design-intelligence` red is unchanged and is somebody else's | Phase 1 — Put the question, then apply the answer |
| 2 | An agent answers the maintainer's question by staggering the stamps on its own | implementation | Editing a `last_checked` value is a one-line change an agent can trivially make, and doing so would fabricate a decision while making the gate green — the most convincing possible form of the wrong answer | 1.1's verify demands a RECORDED decision before 1.2 touches any manifest, and this roadmap ships `draft` so no `/roadmap:process-*` run picks it up unprompted. Strengthened 2026-09-30: D2 closes the one reading under which an agent could have believed a stamp edit was authorised, and the `draft` guard is now defended explicitly in Context rather than left as an unexamined default. Re-examined 2026-10-01 after an agent moved one stamp: the distinction that held is **verification-before-stamp**, not agent-versus-human — 1.2a's stamp is backed by a probe log naming twelve URLs and their HTTP codes, and it found a real upstream rename rather than confirming what was already written. The `draft` guard is now known to be narrower than its wording claimed (it governs selection, not reachability — see Context), so the load-bearing mitigation is **D1's evidence requirement**, which is council-resolved and which an agent cannot restate. **D4 is deliberately NOT counted as mitigation here** (corrected 2026-10-01 after round-2 review): D4 is agent-resolved and was authored in the run it authorised, so citing it as half the guard against "an agent decides this alone" is circular — the guard would be a decision the guarded party made about itself. D4 records what one run did and why; it is **not precedent for occasions 2–4**, and the maintainer may void it without voiding 1.2a's check, which happened. The honest residual: between now and a maintainer reading D4, the only non-circular mitigations are D1's evidence requirement and the fact that every stamp move is a one-line diff a reviewer can see. **Re-reviewed 2026-10-04, after a SECOND agent-run occasion (1.2b).** Two runs is where a pattern could start forming, so the question was re-asked rather than assumed settled, and the discriminator is unchanged: verification-before-stamp. What changed is that the evidence standard went **up**, not down — 1.2b's check carries something 1.2a's did not, a **control**: the same extractor was run against RFC 7807, which is known to be obsoleted, and it reported the obsoletion, so the four no-change readings are demonstrably a working detector rather than a selector that matches nothing. A negative finding without a control is the shape this risk should fear most, because it looks identical to a check that never ran; that gap is now closed and should stay closed for 1.2c and 1.2d. **D5 is deliberately NOT counted as mitigation here**, on exactly D4's reasoning — it is agent-resolved and authored in the run it authorised, so citing it would again make the guarded party its own guard. Two provisional rows now await one maintainer reading; that queue is itself the residual, and it grows by one per occasion | Phase 1 — Put the question, then apply the answer |

## Acceptance Criteria

- [x] AC-1 — A recorded decision names the chosen shape (stagger, intended
      batch, or gate-severity change) and its reason. *(D1, 2026-09-27.)*
- [ ] AC-2 — The four corpus manifests **this roadmap covers** — the batch that
      shared `2026-09-18`, namely `accessibility-auditor`, `api-design`,
      `database` and `threat-modeling`, which is four of the six that declare
      `refresh_cadence: quarterly` and not all of them — carry four **distinct**
      `upstream.last_checked` dates (per D3 — not merely not-all-equal), each
      equal to the date its check actually ran, and
      `./scripts-run src/scripts/check_corpus_staleness` reports no staleness
      finding naming any of those four — not a bare exit 0, for the reason the
      blocker's Resolved-when gives.
      *(2026-10-04: **two of four**. `accessibility-auditor` reads `2026-10-01`
      and `api-design` reads `2026-10-04`, each backed by a check that actually
      ran; `database` and `threat-modeling` still share `2026-09-18`. The gate
      reports no finding naming any of the four, but the distinctness test still
      fails — three distinct values across four manifests, not four — and the
      two equal stamps are not each the date of their own check. Deliberately
      NOT flipped: a green gate is not the test this criterion states.)*
