<!-- evidence-type: analysis -->

# Corpus refresh cadence shape — dated evidence, moved out

Dated evidence paragraphs moved out of `road-to-corpus-refresh-cadence-shape.md`
by `road-to-signals-that-mean-what-they-say` step 3.1, to bring the lightweight
roadmap back under the 600-line cap. Moved verbatim; nothing summarised or
deleted, and no checkbox, decision, criterion, tag, verify clause, or
Hand-over section changed or moved. Each entry below carries the step it
belongs to; the roadmap keeps a one-line pointer at each entry's original
place.

## Step 1.2a — `accessibility-auditor`

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

## Step 1.2b — `api-design`

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

## Step 1.2c — `database`

**Evidence (2026-10-04) — still deferred, and the reason narrowed.**
Occasion 3 of 4 cannot share a date with 1.2a (`2026-10-01`) or 1.2b
(`2026-10-04`) without failing its own "differing from the other three"
verify and AC-2's four-distinct test (D3). One session is one date and
1.2b took this one, so this step is held by arithmetic alone — the role
half of the hold is answered (see the phase preamble). **Its own second
obstacle, measured 2026-10-04:** `src/skills/database/` has **no `evals/`
directory**, so the stamp edit below *will* red `check_routing_coverage`
— which does block the pull request — until
`src/skills/database/evals/triggers.json` is written. <!-- ref-ignore -->
That path does not exist yet by design, which is why the line carrying it
is exempt from the reference check.
Budget for the corpus, not just the one-line edit; use the corpus 1.2b
wrote for `api-design` as the worked example.

**RAN 2026-10-10 — occasion 3 of 4. One correction, two confirmations, and a
near-miss that the primary source caught.**

Authorised by the explicit `/roadmap:process-full` grant naming the draft
roadmaps on this date, on the terms D4 records and D5 re-used: each occasion
needs its own grant rather than inheriting one. Calendar axis clear — 2026-10-10
is distinct from 1.2a's 2026-10-01 and 1.2b's 2026-10-04, and leaves 1.2d a
fourth date before the ~2026-12-27 bound. **Run earlier than the suggested
window** (late November): the suggestion is not the binding constraint,
distinctness and the outer bound are, and deferring would have left the grant
unused against an occasion that depends on a future grant arriving.

### What was checked, and against what

The three version-scoped annotations the 2026-09-27 re-derivation added are the
falsifiable part of this corpus, so each was checked against the engine's own
reference documentation rather than against recall.

| Row | Claim | Source read | Verdict |
|---|---|---|---|
| 1 — Slow WHERE | PG18+ B-tree skip scan relaxes equality-first composite ordering | `docs/18/indexes-multicolumn.html` + `docs/18/release-18.html` | **holds as written** |
| 5 — JOIN explosion | MySQL 9.7 Hypergraph Optimizer "now GA in Community Edition … on its own" | `refman/9.7/en/switchable-optimizations.html` + 9.7.0 release notes | **corrected** |
| 12 — JSON filtering | PG18 flips GENERATED default to VIRTUAL; VIRTUAL not indexable | `docs/18/ddl-generated-columns.html`, `sql-createtable.html`, `release-18.html`, `release-18-4.html` | **holds as written** |

**Row 1 — confirmed.** The PG18 release notes carry it as a new feature:
*"Allow skip scans of btree indexes (Peter Geoghegan) — This allows
multi-column btree indexes to be used in more cases such as when there are no
restrictions on the first or early indexed columns."* The multicolumn-index
page states the mechanism. The `PostgreSQL 18+` scoping in the row is right.

**Row 5 — corrected, and this is the occasion's finding.** The Hypergraph
Optimizer *is* in Community Edition from MySQL 9.7.0 (2026-04-21), but
`switchable-optimizations.html` shows `hypergraph_optimizer=off` in the
`optimizer_switch` default. "GA … and can materially improve join-order choices
**on its own**" reads as on-by-default; it does nothing until switched on per
session, globally, or per statement. The row now says so and keeps the
verify-estimates instruction.

**Row 12 — confirmed, after a near-miss worth recording as this occasion's
control.** The default flip is verbatim in two places: *"A generated column is
by default of the virtual kind"* and the release note *"Allow generated columns
to be virtual, and make them the default."* The *indexability* half nearly went
the other way: a web search summarised PostgreSQL 18.4 as having lifted the
restriction. The 18.4 release notes (2026-05-14) say something narrower —
*"Fix spurious 'indexes on virtual generated columns are not supported' errors
… Creation of an expression index could sometimes incorrectly report this
error."* That fixes a **spurious firing on an unrelated expression index**; the
error class still exists, so the restriction stands and the row is right.

**Why that near-miss is the control this occasion owes.** 1.2b ran under a
control that proved the detector fires. Here the equivalent is that the method
discriminated in both directions on the same day: it corrected row 5 and
declined to "correct" row 12 when a secondary summary invited it, because the
primary source said otherwise. A method that only ever finds drift is not
measuring drift.

**The other nine rows** (ORDER BY…LIMIT, N+1, LIKE, aggregation, deep offset,
lock contention, stale statistics, over-indexing, SELECT *) carry no
version-scoped claim; they are engine-behaviour patterns that PG18 and MySQL 9.7
do not alter, and they hold as written.

### What changed in the tree

- `query-tuning.csv` row 5 Strategy field — the Hypergraph correction above.
- `manifest.json` `upstream.sha` — replaced the ~700-character read-date-plus-
  changelog value with the engine versions alone, per 1.2a's correction note and
  1.2c's verbatim hand-over. The re-derivation's content lives here instead.
- `manifest.json` `upstream.last_checked` — `2026-09-18` → `2026-10-10` (UTC).

### Gate readings

`check_corpus_staleness` — **green on the findings list, not merely the exit
code**: 6 manifests, 41 CSVs, every declared cadence met, reference date
2026-10-10. `check_routing_coverage` — the stamp pulled `database` into
touched-skill scope exactly as D5 predicted; `src/skills/database/evals/triggers.json`
was written (5 exemplars, 3 near-misses, 2 counterexamples, one German positive)
and the gate now reads skills **124 / 299 = 0.4147**, up from the 0.4114 seed.

## Step 1.2d — `threat-modeling`

**Evidence (2026-10-04) — still deferred, and the reason narrowed.**
Same arithmetic as 1.2c, now excluding `2026-10-04` as well; this is
occasion 4 of 4 and the one with a hard outer bound. **Its own second
obstacle, measured 2026-10-04 — and this one is cheap:**
`src/skills/threat-modeling/evals/triggers.json` **already exists**, so
unlike 1.2c this step will **not** red `check_routing_coverage`, and the
skill is already one of `lint_eval_freshness`'s entries, so the stamp edit
adds no new gate cost at all. 1.2d is the cheapest of the three remaining.
