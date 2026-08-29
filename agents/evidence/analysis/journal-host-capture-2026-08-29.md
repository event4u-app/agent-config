<!-- evidence-type: analysis -->

# Runtime event journal — the HOST capture rate, published (Phase 2.1 / 2.2)

**Date:** 2026-08-29 · **Roadmap:** `road-to-journal-host-capture-measurement`,
steps 2.1 and 2.2 · **Instruments:**
`src/scripts/_lib/host_denominator.ts`, `src/scripts/measure_host_capture.ts`,
`tests/scripts/host_denominator.test.ts`

This page is written to be decidable **on its own**: every acceptance criterion
of the roadmap can be checked from here without opening the parent roadmap or
the 1.1 survey. The survey
(`agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`) remains
the derivation record for the obtainability table and is restated below rather
than pointed at, for that reason.

## The number, with its caption

> **Host capture rate — DEFAULT install: 0.00 %**
> Numerator **0** journal records · denominator **152,151** host-emitted events
> on the five journal-bound counted cells (**296,216** across all six counted
> cells) · population **2,281 Claude Code sessions** on one maintainer machine ·
> platform **`claude`** · window **2026-07-30 .. 2026-08-29** (30 days, the
> journal's own retention TTL) · install configuration **shipped defaults**,
> `hooks.runtime_journal.enabled` absent from every settings layer present,
> resolving to `false` · reconstruction rules **v1**.
>
> **This is a product-adoption / configuration result, not a capture-quality
> result.** The mechanism is behaving exactly as designed: the concern is
> default-OFF, so a default install records nothing and the store is never
> created. A reader who meets 0 % without this label reads a working mechanism
> as a broken one. The caption is mandatory and was required by the unanimous
> AI-council resolution of `measurement-population-default-off`.

> **Host capture rate — OPTED-IN install: POPULATION EMPTY IN MEASUREMENT SCOPE**
> Installs observable from the measuring machine: **1**. Of those, installs with
> `hooks.runtime_journal.enabled: true`: **0**. There is therefore no population
> for an opted-in rate to be over, and no denominator to construct.
>
> This is a **measured** finding, not a claim of principled impossibility. The
> measurement ran; it found the population empty. The distinction is
> load-bearing and was required verbatim by the AI council of 2026-08-29: *"the
> opted-in finding is 'population size = 0 in observable scope' (measured), not
> 'rate is unmeasurable' (principled impossibility). The former is honest; the
> latter invites misreading."*

**Neither of the two is "the" capture rate.** That prohibition is the unanimous
council resolution and it is repeated here because a later reader quoting one
figure without its caption is the failure mode both blockers exist to prevent.

### What replaced what

| | Before this measurement | After |
|---|---|---|
| Host capture rate | **`undefined`** — numerator unobserved, denominator unknown | **0.00 %** with a known denominator of 152,151, or 296,216 depending on scope, both stated |
| Opted-in rate | not distinguished from the above | **population empty in scope**, measured: 1 install observable, 0 opted in |
| Why the numerator is zero | not established | named status **`store-absent`** — the journal database does not exist at `<git-common-dir>/agent-journal/journal.sqlite`, because the concern is default-OFF and never created it |

The move from `undefined` to `0.00 % / 152,151` is the whole deliverable. A zero
over a known denominator is a result; a zero over an unknown one is not a number.

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
cells to six. Three candidate artefacts were examined. All three were read on
the **same** session transcript, and they disagree by a factor of 44:

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
asserting they remain mutually inconsistent, so a later attempt meets the
measurement before it meets the idea.

The 1.1 survey's own `Revisit-if` named this case — *"a host outside the six
cells is found to publish an emission count this package can read"* — and it
fired. The finding is that the candidate exists and is **incomplete**, which
widens nothing.

## The denominator, per cell

Pinned run, `./scripts-run src/scripts/measure_host_capture --json`, 2026-08-29:

| Cell (`claude`) | Host events | `journal-record` bound? |
|---|---|---|
| `session_start` | 2,281 | yes |
| `user_prompt_submit` | 3,259 | yes |
| `pre_tool_use` | 144,065 | **NO — numerator 0 by construction** |
| `post_tool_use` | 144,065 | yes |
| `subagent_start` | 1,273 | yes |
| `subagent_stop` | 1,273 | yes |
| **Total, 6 counted cells** | **296,216** | |
| **Total, 5 journal-bound counted cells** | **152,151** | |

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

### Session population

| | Count |
|---|---|
| Transcripts found on the machine | 2,303 |
| First record inside the window → **in population** | **2,281** |
| First record before the window → excluded | 17 |
| No parseable timestamped record → reported undatable | 5 |
| `user` records excluded by refinement 1 (`isMeta`) | 768 |
| `user` records excluded by refinement 2 (`isSidechain`) | 53,002 |

The two exclusion counts are published, not folded away, because they are large
enough to change the `user_prompt_submit` figure by an order of magnitude and a
reader should be able to see the size of what a refinement removed.

## The reconstruction rules, pinned at v1

A denominator whose derivation can be adjusted after the numerator is known is
not a denominator, so the rules carry a version
(`RECONSTRUCTION_RULE_VERSION = 1`) that a published rate cites.

| Cell | Rule |
|---|---|
| `session_start` | One per transcript file. A transcript exists if and only if a session started. |
| `user_prompt_submit` | A `type: "user"` record carrying no `tool_result` content block. **Refinement 1:** `isMeta: true` records excluded — an injected system reminder is not a user prompt submit. **Refinement 2:** `isSidechain: true` records excluded — a subagent's brief does not fire the host event in the parent session. |
| `pre_tool_use` / `post_tool_use` | One per `tool_use` content block in a `type: "assistant"` record. |
| `subagent_start` / `subagent_stop` | One per `tool_use` content block whose `name` is `Agent` or `Task`. A subset of the tool_use blocks, and a distinct host event. |

The four base rules are the 1.1 survey's own, carried verbatim. The two
refinements are **new here and named as such** rather than folded in silently:
both narrow the count, so adopting them quietly would have made the rate look
better than the survey's rules would have.

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
- **Every field is a bounded scalar.** Sixteen keys: thirteen counts, two ISO
  **calendar dates**, and one platform literal. Nothing here can hold a path, a project
  name, a session id, a prompt, or a tool name. `window_start` / `window_end`
  are refused at runtime unless they match `YYYY-MM-DD`, on the same reasoning
  the collector record states for its own date field: a per-second timestamp
  beside a session count reconstructs working hours.
- **An unknown key is REJECTED, not dropped.** `validateDenominator` throws
  ``unknown field '<name>' — REJECTED, not dropped``. Dropping is refused on
  purpose: a producer whose extra field is silently discarded has been told the
  field is fine, and the leak then lives upstream where this schema cannot see
  it.

### Sensitivity — observed, not argued

A test never seen red has unknown sensitivity, so the guard was broken on
purpose and the failure recorded:

**Probe:** add `payload: number` to `HostDenominator` and `'payload'` to
`DENOMINATOR_RECORD_KEYS`.

**Observed:**
- `npm run typecheck` → `src/scripts/_lib/host_denominator.ts(220,5): error
  TS2344: Type 'false' does not satisfy the constraint 'true'.` — line 217 is
  where `_RecordCarriesNoFreeFormField` is declared. **A free-form write does
  fail to type-check**, which is the literal wording AC-2 asks for.
- `npx vitest run tests/scripts/host_denominator.test.ts` → **10 of 20 tests
  red**, including the key-set binding assertion and the free-form-key
  assertion.

**Second probe, on the table's own claim:** add `journal-record` to the `claude`
`pre_tool_use` slot in `src/scripts/hook_manifest.yaml`. **Observed, in
isolation:** exactly **1 of 20** reds — *"matches `journal-record` bindings on
the claude platform"* — and the other 19 stay green, so the probe is targeted
rather than a blanket break. The "0 by construction" column is enforced by a
check, not by prose.

Each probe was applied on its own, reverted from an explicit backup copy, and
re-verified: **20 of 20 tests green, `npm run typecheck` clean, `npx eslint` clean
on all three files.**

## Limits — stated, because each one bounds the number above

1. **One machine.** The denominator is 2,281 sessions on one maintainer machine.
   This is **not** an ecosystem-wide capture rate and must not be quoted as one.
   Every table and caption on this page carries its scope for that reason.
2. **One platform.** `claude` only. The other seven have no host-published
   emission count within this package's reach, which is an absence of evidence
   inside a stated boundary — not a proof that those hosts publish nothing.
3. **Six of 43 bound cells.** A rate over six cells is a different claim from a
   rate over all of them. Both totals are given; neither is generalised.
4. **Self-observation.** The measuring session's own transcript is inside the
   population, and the denominator grew by 174 events across three runs during
   this work (296,042 → 296,154 → 296,216). The published figures are pinned to
   the 2026-08-29 run recorded above. The direction of the effect is known and
   harmless here — it inflates a denominator whose numerator is 0, so it can
   only make the reported rate lower, never higher.
5. **Reconstruction is derived, not published-as-a-count.** The transcript is
   host-written and independent of the hook path, which is what makes it a
   legitimate denominator, but the counts come from the four rules above rather
   than from a tally the host publishes. The derivation is versioned and
   re-runnable.
6. **The opted-in half is an empty population, and one machine's emptiness is
   not the world's.** 1 install observable, 0 opted in. A second machine with the
   setting on would give the opted-in rate a denominator; nothing here forecloses
   that, and it is the cheapest way to complete the pair.

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

1. *Scope the default result explicitly* — one maintainer machine, `claude`,
   2026-07-30..2026-08-29, six counted cells. Done in the caption, in every
   table, and in Limits 1–3.
2. *State the opted-in half as "population empty in measurement scope", NOT as
   "unmeasurable"* — the measurement ran and found the population empty, which
   reads differently to a later reader. Done verbatim in the second caption.
3. *Caption the default 0 % as a product-adoption / configuration result, not a
   capture-quality one* — the refinement from the earlier unanimous verdict,
   which the seat noted nobody had verified would actually appear. Done in the
   first caption.

**Rationale (seat's own):** *"The roadmap Goal explicitly permits 'the reason it
cannot exist is published in its place with the same rigour.' One measured rate
(0.00 % over 152,061 bound events) [sic — the seat was given the figure from an
earlier run of the same measurement; the pinned figure above is 152,151, and the
drift is the self-observation effect of Limit 4] plus one rigorously documented
empty-population finding satisfies that Goal. Replay (B) would measure the wrong
thing (dispatch path, not host capture) and risk AC-4 substitution violation.
Parking (C) makes completion hostage to external condition with no timeline."*

**Counter-argument, recorded because the seat required it be recorded rather
than resolved away:** the earlier unanimous (c) required *two rates with two
captions*, and a documented null is not literally a rate. Closing 2.1 therefore
rests on reading the Goal's alternative clause as overriding (c)'s strict numeric
requirement for the opted-in half. That reading is recorded here explicitly so a
future reader does not mistake the closure for a silent violation of a unanimous
verdict.

***Revisit-if:*** a second machine, or any machine, runs with
`hooks.runtime_journal.enabled: true` — the opted-in population stops being
empty and the pair can be completed by re-running
`measure_host_capture` there. Or: `hooks.runtime_journal.enabled` ships default-ON,
at which point the default-install figure above measures something else entirely
and must be re-taken rather than re-quoted.

## AC-5 — both blockers carry a recorded choice

Both are `Status: resolved` in the roadmap with a recorded option and rationale:
`host-denominator-obtainability` → **(b)**, resolved by measurement rather than
by tie-break (the anthropic seat's prediction that (b) would collapse into (c)
was tested by the 1.1 survey and came back false: six cells, not near-zero);
`measurement-population-default-off` → **(c)**, unanimous 2/2.

## Reproducing this

```bash
./scripts-run src/scripts/measure_host_capture              # human-readable
./scripts-run src/scripts/measure_host_capture --json       # machine-readable
./scripts-run src/scripts/measure_host_capture --days 7     # a shorter window
npx vitest run tests/scripts/host_denominator.test.ts       # the rules, on fixtures
```

The numbers will differ on another machine and will drift on this one as new
sessions land — that is the point of a population, and the reason the published
figures name their run.
