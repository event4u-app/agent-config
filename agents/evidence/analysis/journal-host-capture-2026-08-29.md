<!-- evidence-type: analysis -->

# Runtime event journal — the HOST capture rate, published (Phase 2.1 / 2.2)

**Date:** 2026-08-29 · **Roadmap:** `road-to-journal-host-capture-measurement`,
steps 2.1 and 2.2 · **Instruments:**
`src/scripts/_lib/host_denominator.ts`, `src/scripts/measure_host_capture.ts`,
`tests/scripts/host_denominator.test.ts`

**Revision 2 — rewritten after a blind R2 completion review of 2026-08-29
returned 18 findings (1 high, 8 medium, 9 low).** Revision 1's headline rate was
`0.00 %` over a denominator of 152,151, and the review established that
denominator was over the wrong population: it counted every transcript on the
machine while the numerator reads one repository's journal. The rate is still
`0.00 %` — the numerator was and is zero — but the number under the line has
changed, and § *What the review changed* records what and why. Revision 1's
figures are superseded, not merely restated.

This page is written to be decidable **on its own**: every acceptance criterion
of the roadmap can be checked from here without opening the parent roadmap or
the 1.1 survey. The survey
(`agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`) remains
the derivation record for the obtainability table and is restated below rather
than pointed at, for that reason.

## The number, with its caption

> **Host capture rate — DEFAULT install: 0.00 %**
> Numerator **0** journal records · denominator **127,711** host-emitted events
> on the five journal-bound counted cells (**249,586** across all six counted
> cells) · population **1,428 Claude Code sessions across the 476 worktrees of
> ONE repository** on one maintainer machine · platform **`claude`** · scope
> **repository** — the same population the numerator's store can reach · window
> **2026-07-31 .. 2026-08-29** (30 calendar days, inclusive both ends; the
> journal's own retention TTL is 30) · install configuration **shipped
> defaults**: 1 settings layer present, **0** carrying
> `hooks.runtime_journal.enabled` at all, so the value resolves from the shipped
> default `false` · reconstruction rules **v2**.
>
> **This is a product-adoption / configuration result, not a capture-quality
> result.** The mechanism is behaving exactly as designed: the concern is
> default-OFF, so a default install records nothing and the store is never
> created. A reader who meets 0 % without this label reads a working mechanism
> as a broken one. The caption is mandatory and was required by the unanimous
> AI-council resolution of `measurement-population-default-off`.

> **Host capture rate — OPTED-IN install: POPULATION EMPTY IN MEASUREMENT SCOPE**
> Settings layers observable from the measuring machine: **1**. Of those, layers
> carrying `hooks.runtime_journal.enabled` at all: **0**; layers setting it
> `true`: **0**. There is therefore no population for an opted-in rate to be
> over, and no denominator to construct.
>
> This is a **measured** finding, not a claim of principled impossibility. The
> measurement ran; it found the population empty. The distinction is
> load-bearing and was required verbatim by the AI council of 2026-08-29: *"the
> opted-in finding is 'population size = 0 in observable scope' (measured), not
> 'rate is unmeasurable' (principled impossibility). The former is honest; the
> latter invites misreading."*
>
> The unit is **settings layers**, not installs, and the two are not the same:
> one machine carrying both a project and a user-global layer would report two.
> Revision 1 published the layer count under the word "installs"; the review
> caught it.

**Neither of the two is "the" capture rate.** That prohibition is the unanimous
council resolution and it is repeated here because a later reader quoting one
figure without its caption is the failure mode both blockers exist to prevent.

### What replaced what

| | Before this measurement | After |
|---|---|---|
| Host capture rate | **`undefined`** — numerator unobserved, denominator unknown | **0.00 %** with a known denominator of 127,711, or 249,586 depending on cell scope, both stated |
| Opted-in rate | not distinguished from the above | **population empty in scope**, measured: 1 settings layer observable, 0 carrying the key |
| Why the numerator is zero | not established | named status **`store-absent`** — the journal database does not exist at `<git-common-dir>/agent-journal/journal.sqlite`, because the concern is default-OFF and never created it |

The move from `undefined` to `0.00 % / 127,711` is the whole deliverable. A zero
over a known denominator is a result; a zero over an unknown one is not a number.

## What the review changed, and why the denominator moved

The review's single **high** finding is the one that moved the published figure,
and it is worth stating as the defect it was rather than as a refinement:

> The numerator reads `resolveJournal(process.cwd())` — **one repository's**
> journal, at that repository's common git dir, shared by its worktrees and
> reaching nothing else. Revision 1's denominator walked **every** project
> directory under `~/.claude/projects`. The ratio was therefore over two
> different populations. It was invisible in the published run only because the
> numerator was `0 / store-absent`, and this page's own `Revisit-if` told the
> next reader to re-run the script on a machine where it would not have been —
> where it would have silently deflated the rate by every session outside the
> measured repository.

The fix is a recorded `scope` field on the denominator record, defaulting to
`repository`, resolved from `git worktree list --porcelain` rather than from a
path prefix (a linked worktree may live anywhere — this repository's own live
under `/private/tmp/`). A failure to resolve the scope returns an **empty** scope
rather than falling back to machine-wide, because a silent widening is the defect
being fixed. `--scope machine` still exists and its rate is printed with an
explicit `UNMATCHED` warning.

**Both figures, so the size of the correction is visible:**

| | repository scope (**published**) | machine scope (a different figure) |
|---|---|---|
| Sessions in window | **1,428** | 2,249 |
| Denominator, 6 cells | **249,586** | 290,723 |
| Denominator, 5 bound cells | **127,711** | 149,338 |
| Divisible by this numerator | **yes** | **no** |

Revision 1 published 152,151 for the five bound cells — a machine-scoped count
over a 31-day window. The published figure is now 127,711: **16 % lower**, and
over a population the numerator can actually reach.

The second finding that moved a number: revision 1's window was inclusive at
both ends while its start was computed as `now − days`, so `--days 30` spanned
**31** calendar days and the caption said 30. The denominator therefore covered
one day the numerator's 30-day TTL cannot retain. Fixed to `now − (days − 1)`;
the window is now `2026-07-31 .. 2026-08-29`, exactly 30 days.

Seventeen further findings and their dispositions are in
`agents/evidence/reviews/road-to-journal-host-capture-measurement.findings.md`.
The ones that changed what this page *says* rather than what it *computes*:

- **The sidechain rule for assistant records was unstated** while governing
  about 97 % of the count. It is now rule text, versioned, and the sidechain
  share is published so a reader who disagrees can subtract it rather than
  re-deriving the count.
- **`session_start` was published as an iff and is not one** — the host fires it
  again on resume, clear and compact, and a compacted session can produce a
  second file. Both failure directions are now stated, and the population figure
  inherits that imprecision.
- **The numerator is host-agnostic while the denominator is `claude`-only.**
  `JournalEvent` carries no platform field, so an event written by another bound
  host on the same repository would count into the numerator. Unfixable without
  widening the record; stated in Limits instead.
- **The settings parse resolved silently toward `default`.** It is now anchored
  to the `hooks:` parent, indentation-tolerant, and distinguishes an absent key
  from a parse failure — with a published counter for each, because the
  population label both captions rest on is read from exactly this.

## AC-4 — the dispatch figure is NOT this figure, and here is why they do not compare

`agents/evidence/analysis/runtime-journal-capture-2026-08-28.md` publishes
**100.00 %, denominator 1,000 envelopes**. That figure is not reported as a host
figure anywhere on this page, and the two are not comparable, for a reason of
kind rather than of size:

- **The dispatch figure's denominator is authored by the test.** 1,000 envelopes
  were constructed and handed to `journal_record_hook.recordedFor()` on an armed
  temporary root. It measures whether the writer drops anything handed to it. It
  is a **floor on the writer**, and a real one.
- **This page's denominator is authored by the host.** It is reconstructed from
  Claude Code's own per-session transcripts, which exist whether or not any hook
  is bound and which this package does not write. Neither side of the ratio is
  derived from the other, which is the property that makes it a capture rate.

A denominator a mechanism produces for itself cannot measure that mechanism's
capture: it counts opportunities the mechanism already knew about. Reporting the
first as the second would be the category substitution the parent's evidence page
had to refuse once already, and the AI council named it again on 2026-08-29 when
it rejected building a dispatch counter for this purpose — *"incomplete valid
evidence is preferable to complete evidence for the wrong metric."*

The same refusal applies to a **replay**: arming a temporary root and feeding it
one envelope per reconstructed host event would re-derive a number close to
100 %, over a larger denominator, that a reader could mistake for a host rate.
It was considered as option (B) of the closure question below and refused for
exactly that reason.

## AC-1 — the obtainability table, all 80 cells, no blank

Every `(platform, event)` cell. `counted` = a host artefact this package can
read publishes a durable count. `emits-but-uncounted` = the host emits and no
count is readable from within this package's reach. `not-bound` = the slot is
not wired for that platform in `src/scripts/hook_manifest.yaml`.

| event | augment | claude | cowork | cursor | cline | windsurf | gemini | copilot |
|---|---|---|---|---|---|---|---|---|
| `session_start` | emits-but-uncounted | **counted** | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `session_end` | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound | emits-but-uncounted | not-bound |
| `user_prompt_submit` | not-bound | **counted** | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `pre_tool_use` | emits-but-uncounted | **counted** | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |
| `post_tool_use` | emits-but-uncounted | **counted** | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound | emits-but-uncounted | not-bound |
| `stop` | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `pre_compact` | not-bound | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound |
| `agent_error` | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound |
| `subagent_start` | not-bound | **counted** | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |
| `subagent_stop` | not-bound | **counted** | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |

**Totals:** 6 `counted` · 34 `emits-but-uncounted` · 40 `not-bound` · 80 cells.
43 bound. Unchanged from the 1.1 survey, and the `stop` row was **re-examined on
new evidence during this measurement and still resolves to
`emits-but-uncounted`** — see the next section.

### `stop` was re-opened and stayed refused — three candidates, three readings

`stop` matters more than the other refused cells: it **is** journal-bound on
`claude`, so a denominator for it would widen the measured set from five bound
cells to six. Three candidate artefacts were examined. All three were read on the
**same** session transcript, and they disagree by a factor of about 44
(305 / 7 = 43.6):

| Reading | Candidate | Refused because |
|---|---|---|
| 305 | assistant records carrying a `stop_reason` | Counts assistant **messages**, not turn completions. Every one read `stop_reason: "tool_use"` and none `end_turn`, while the hook fires once per turn — an over-count of roughly two orders of magnitude. (Established by the 1.1 survey.) |
| 95 | `type: "last-prompt"` records | Written once per assistant leaf, **repeating the same prompt text** each time, so it is a per-turn marker whose mapping onto the `stop` hook event is unverified rather than a published count. |
| 7 | `hookInfos` entries whose command carries `--event stop` | **Host-authored and event-named — the strongest of the three, and a genuinely new finding.** The host writes `type: "system"` records carrying `hookCount` / `hookInfos`, and the command string names `--platform claude --event stop`. But it appears on only ~7 of ~95 turns in the same session, co-occurring with `hookAdditionalContext` / `preventedContinuation`: the host records these entries **selectively**, so the artefact **under-counts** dispatches. |

Two of the three would have produced a plausible-looking `stop` denominator. A
denominator chosen from among three mutually inconsistent candidates is a number
whose footnote is load-bearing, so `stop` stays out of both counted sets. The
three readings and their refusals are kept **in code**
(`STOP_CANDIDATES` in `src/scripts/_lib/host_denominator.ts`) with a test
asserting the factor stays between 43 and 44 — a range, because revision 1's
prose said 40 in one place and 44 in another while the only assertion was
`> 10`, so neither number was pinned by anything.

The 1.1 survey's own `Revisit-if` named this case — *"a host outside the six
cells is found to publish an emission count this package can read"* — and it
fired. The finding is that the candidate exists and is **incomplete**, which
widens nothing.

## The denominator, per cell

Pinned run, `./scripts-run src/scripts/measure_host_capture --json`, 2026-08-29,
`scope: repository`:

| Cell (`claude`) | Host events | `journal-record` bound? |
|---|---|---|
| `session_start` | 1,428 | yes |
| `user_prompt_submit` | 2,168 | yes |
| `pre_tool_use` | 121,875 | **NO — numerator 0 by construction** |
| `post_tool_use` | 121,875 | yes |
| `subagent_start` | 1,120 | yes |
| `subagent_stop` | 1,120 | yes |
| **Total, 6 counted cells** | **249,586** | |
| **Total, 5 journal-bound counted cells** | **127,711** | |

`pre_tool_use` is separated rather than averaged in, because its zero means
something different: that slot carries the safety guards (`block-no-verify`,
`block-unauthorized-git`, `block-kernel-rule-writes`, …) and the journal is not
among them, so its numerator is zero **by construction** and not
zero-because-nothing-fired. Both totals are published so a reader can see which
scope a rate is over. **This claim is self-checking**: a test in
`tests/scripts/host_denominator.test.ts` reads the `claude` platform block of
`src/scripts/hook_manifest.yaml` and reds if the bound set stops matching
`JOURNAL_BOUND_COUNTED_EVENTS` — so binding the journal to `pre_tool_use` later
breaks the test instead of quietly falsifying this table.

### Session population, and everything the walk excluded

| | Count |
|---|---|
| Worktrees the repository scope resolved to | 476 |
| Transcripts inside the scope | 1,485 |
| Project directories skipped as out of scope | 79 |
| Earliest record inside the window → **in population** | **1,428** |
| Earliest record before the window → excluded | 53 |
| Earliest record after the window → excluded | 0 |
| No parseable timestamped record → reported undatable | 4 |
| Directories the walk could not read | 0 |
| Transcript lines that did not parse as JSON | 6,650 |
| `user` records excluded by refinement 1 (`isMeta`) | 675 |
| `user` records excluded by refinement 2 (`isSidechain`) | 47,738 |
| Of the tool_use total, sidechain-authored | 46,540 |
| Of the Agent/Task total, sidechain-authored | 188 |

Every one of these is published rather than folded away, and four of them exist
only because the review asked for them. **6,650 unparseable lines** were
previously discarded with no counter at all, in a module whose own docstring
argues that a denominator silently missing part of its population is worse than
none. **0 unreadable directories** is a real answer and worth having: revision 1
swallowed every `readdirSync` failure, so a non-zero would have been invisible.
The two refinement counters are **independent** — a record carrying both flags
increments both — which revision 1 published as though they partitioned.

## The reconstruction rules, pinned at v2

A denominator whose derivation can be adjusted after the numerator is known is
not a denominator, so the rules carry a version
(`RECONSTRUCTION_RULE_VERSION = 2`) that a published rate cites. v1 was the 1.1
survey's four rules plus the two `user`-record refinements; v2 states two rules
v1 left implicit and corrects one derivation.

| Cell | Rule |
|---|---|
| `session_start` | One per transcript file. **NOT an iff** — the host fires `SessionStart` again on resume, clear and compact while a resumed session appends to the SAME file (**under-count**), and a compacted or forked session can produce a SECOND file for one logical session (**over-count** on the population side). Both directions are present and neither is corrected, so this is the least precise of the six cells and the 1,428 population figure inherits that. |
| `user_prompt_submit` | A `type: "user"` record carrying no `tool_result` content block. **Refinement 1:** `isMeta: true` excluded — an injected system reminder is not a user prompt submit. **Refinement 2:** `isSidechain: true` excluded — a subagent's brief does not fire the host event in the parent session. The two counters are **independent**. |
| `pre_tool_use` / `post_tool_use` | One per `tool_use` content block in a `type: "assistant"` record. **Sidechain records ARE INCLUDED** — a subagent's tool call fires the parent session's tool hooks — and the share (46,540 of 121,875) is published so a reader who disagrees can subtract it. v1 left this rule unstated while it governed 97 % of the six-cell total. |
| `subagent_start` / `subagent_stop` | One per `tool_use` content block whose `name` is `Agent` or `Task`. A subset of the tool_use blocks, and a distinct host event. Sidechain-nested spawns included, share published (188 of 1,120). |

One derivation changed: a transcript's window placement is now decided by the
**minimum** record timestamp, not the first timestamp in file order. A
back-dated leading record would otherwise decide whether the whole file's counts
land in the denominator at all.

## AC-2 — the denominator's record type, held to the numerator's standard

The numerator's record (`JournalEvent`) carries a committed key set bound to the
type in both directions and a compile-time refusal of free-form keys. AC-2
requires the same of the denominator, and the reason is not symmetry for its own
sake: a denominator computed inline in a script has no record type to assert, so
the two halves of one ratio would have been held to different privacy standards.

`HostDenominator` in `src/scripts/_lib/host_denominator.ts`:

- **Committed key set, bound both ways.** `DENOMINATOR_RECORD_KEYS` is asserted
  against `keyof HostDenominator` in both directions (`_KeysCoverTheRecord`,
  `_KeysAddNothing`). A field added without its key, or a key without its field,
  does not compile.
- **Free-form keys are a compile error, using the numerator's own list.**
  `_RecordCarriesNoFreeFormField` applies the journal's exported `NoFreeForm`
  guard to `HostDenominator`. The guard is **imported, not re-implemented**, so
  the two records cannot drift apart.
- **Every field is a bounded scalar.** Twenty-three keys: nineteen counts, two
  ISO **calendar** dates, one scope literal, one platform literal. Nothing here
  can hold a path, a project name, a session id, a prompt, or a tool name.
  `window_start` / `window_end` are refused at runtime unless they match
  `YYYY-MM-DD`, on the same reasoning the collector record states for its own
  date field: a per-second timestamp beside a session count reconstructs working
  hours. An **inverted** window is refused too — it would otherwise file every
  transcript as out-of-window and report a zero denominator instead of a bad
  input.
- **An unknown key is REJECTED, not dropped.** `validateDenominator` throws
  ``unknown field '<name>' — REJECTED, not dropped``. Dropping is refused on
  purpose: a producer whose extra field is silently discarded has been told the
  field is fine, and the leak then lives upstream where this schema cannot see
  it. An unrecognised `scope` is refused on the same terms, because an
  unrecorded scope is exactly how a denominator ends up over a different
  population than its numerator.

### Sensitivity — observed in isolation, not argued

A test never seen red has unknown sensitivity, so each guard was broken on
purpose, **separately**, and the reading recorded:

**Probe 1:** add `payload: number` to `HostDenominator` and `'payload'` to
`DENOMINATOR_RECORD_KEYS`.
**Observed:** `npm run typecheck` → `src/scripts/_lib/host_denominator.ts:
error TS2344: Type 'false' does not satisfy the constraint 'true'` on
`_RecordCarriesNoFreeFormField`. **A free-form write does fail to type-check**,
which is the literal wording AC-2 asks for. Plus a large fraction of the suite
red on the key-set binding and the free-form-key assertions.

**Probe 2, on the table's own claim:** add `journal-record` to the `claude`
`pre_tool_use` slot in `src/scripts/hook_manifest.yaml`.
**Observed, in isolation:** exactly **1** test reds — *"matches `journal-record`
bindings on the claude platform"* — and the rest stay green, so the probe is
targeted rather than a blanket break. The "0 by construction" column is enforced
by a check, not by prose.

Each probe was applied on its own, reverted from an explicit backup copy, and
re-verified. Current state: **43 of 43 tests green, `npm run typecheck` clean,
`npx eslint` clean on all three files.**

## Limits — stated, because each one bounds the number above

1. **One machine, one repository.** The denominator is 1,428 sessions across one
   repository's 476 worktrees on one maintainer machine. This is **not** an
   ecosystem-wide capture rate and must not be quoted as one. Every table and
   caption on this page carries its scope for that reason.
2. **One platform.** `claude` only. The other seven have no host-published
   emission count within this package's reach, which is an absence of evidence
   inside a stated boundary — not a proof that those hosts publish nothing.
3. **Six of 43 bound cells.** A rate over six cells is a different claim from a
   rate over all of them. Both totals are given; neither is generalised.
4. **The numerator is host-agnostic; the denominator is not.** `JournalEvent`
   carries no `platform` field, so a record written by another bound host on the
   same repository (the `augment` or `cowork` slots) would count into the
   numerator against a `claude`-only denominator. That can only bias the rate
   **upward**. It is unfixable without widening the journal's record, which is
   not this roadmap's to do, so it is stated instead of silently carried.
5. **`session_start` is imprecise in both directions**, per the rule table — so
   the 1,428 population figure is an estimate with a known failure mode, not a
   count.
6. **Self-observation.** The measuring session's own transcript is inside the
   population, and the six-cell denominator grew by 13 events between two runs
   minutes apart (249,573 → 249,586). The published figures are pinned to the
   JSON run recorded above. The direction is known and harmless here — it
   inflates a denominator whose numerator is 0, so it can only make the reported
   rate lower, never higher.
7. **Reconstruction is derived, not published-as-a-count.** The transcript is
   host-written and independent of the hook path, which is what makes it a
   legitimate denominator, but the counts come from the rules above rather than
   from a tally the host publishes. The derivation is versioned and re-runnable.
8. **The opted-in half is an empty population, and one machine's emptiness is
   not the world's.** 1 settings layer observable, 0 carrying the key. A second
   machine with the setting on would give the opted-in rate a denominator;
   nothing here forecloses that, and it is the cheapest way to complete the pair.
9. **6,650 lines did not parse**, out of a corpus of 1,485 transcripts. They are
   counted and published rather than dropped, but they are not attributed: a
   truncated tail line and a genuinely malformed record are not distinguished.

## The closure decision — AI council 2026-08-29, DEGRADED (1 of 2 seats)

**Quorum met (1 needed, 1 present); this is NOT convergence.** The `openai` seat
did not answer: the first attempt returned `os_error: ENOBUFS`, and the free
`council_cli estimate` probe then reported the seat `unavailable (live_probe:
last exchange 2026-08-29 — other)`, so it was not re-attempted. Recorded as
degraded rather than presented as agreement. Present seat: `anthropic`
(`claude-sonnet-4-5`). Cost: $0.00 — subscription-authed, nothing billed.

**Question:** the default rate is measured and publishable; the opted-in rate has
no population. Is that a discharge of step 2.1 and of the earlier unanimous
option (c), which said *publish both*?

**Options put:** (A) publish the default rate as measured and the opted-in half
as a documented empty population, close 2.1 on the Goal's explicit *"or the
reason it cannot exist is published in its place with the same rigour"* clause ·
(B) refuse to close on a null and produce the opted-in figure by replay ·
(C) leave 2.1 open and park the roadmap in `later/`.

**Verdict: (A), with three additions the seat made mandatory.** All three are
implemented above:

1. *Scope the default result explicitly* — one maintainer machine, one
   repository, `claude`, 2026-07-31..2026-08-29, six counted cells. Done in the
   caption, in every table, and in Limits 1–3.
2. *State the opted-in half as "population empty in measurement scope", NOT as
   "unmeasurable"* — the measurement ran and found the population empty, which
   reads differently to a later reader. Done verbatim in the second caption.
3. *Caption the default 0 % as a product-adoption / configuration result, not a
   capture-quality one* — the refinement from the earlier unanimous verdict,
   which the seat noted nobody had verified would actually appear. Done in the
   first caption.

**Rationale (seat's own):** *"The roadmap Goal explicitly permits 'the reason it
cannot exist is published in its place with the same rigour.' One measured rate
plus one rigorously documented empty-population finding satisfies that Goal.
Replay (B) would measure the wrong thing (dispatch path, not host capture) and
risk AC-4 substitution violation. Parking (C) makes completion hostage to
external condition with no timeline."*

**Counter-argument, recorded because the seat required it be recorded rather
than resolved away:** the earlier unanimous (c) required *two rates with two
captions*, and a documented null is not literally a rate. Closing 2.1 therefore
rests on reading the Goal's alternative clause as overriding (c)'s strict numeric
requirement for the opted-in half. That reading is recorded here explicitly so a
future reader does not mistake the closure for a silent violation of a unanimous
verdict.

***Revisit-if:*** any machine runs with `hooks.runtime_journal.enabled: true` —
the opted-in population stops being empty and the pair can be completed by
re-running `measure_host_capture` **on that machine and in that repository**, the
scope qualifier being the correction this revision exists for. Or:
`hooks.runtime_journal.enabled` ships default-ON, at which point the
default-install figure above measures something else entirely and must be
re-taken rather than re-quoted.

## AC-5 — both blockers carry a recorded choice

Both are `Status: resolved` in the roadmap with a recorded option and rationale:
`host-denominator-obtainability` → **(b)**, resolved by measurement rather than
by tie-break (the anthropic seat's prediction that (b) would collapse into (c)
was tested by the 1.1 survey and came back false: six cells, not near-zero);
`measurement-population-default-off` → **(c)**, unanimous 2/2.

## Reproducing this

```bash
./scripts-run src/scripts/measure_host_capture                    # published scope
./scripts-run src/scripts/measure_host_capture --json             # machine-readable
./scripts-run src/scripts/measure_host_capture --scope machine    # a DIFFERENT figure
./scripts-run src/scripts/measure_host_capture --days 7           # a shorter window
npx vitest run tests/scripts/host_denominator.test.ts             # the rules, on fixtures
```

The numbers will differ in another repository or on another machine, and will
drift on this one as new sessions land — that is the point of a population, and
the reason the published figures name their run and their scope.
