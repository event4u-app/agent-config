---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "No existing roadmap, stub or later/ entry carries a bytes or network-egress metric — a grep for one across agents/roadmaps/ returns zero — so there is nothing to archive, park or merge this into, and every byte claim the tree might later make is unbacked until this row exists."
relates: []
---
# Road to a bytes row that exists

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t03/` — a four-file supplied-plan set
> (two independent agent proposals, each revised once) plus the transcript that
> commissioned them. Class: external agent proposals about this repo, pinned to a
> commit eight days behind the current trunk.

## Goal

`src/config/metric-registry.yml` gains at least one declared metric whose unit is
**bytes**, produced by machinery that already exists, with a named consumer and a
named decision — so that a statement of the form "this change moved N bytes" can be
made at all. Falsifiable: today `grep -niE 'bytes|egress|network' src/config/metric-registry.yml`
returns one incidental prose hit and no metric entry, and no evidence artefact under
`agents/evidence/` carries a per-session or per-call byte figure. The goal is met when
that grep returns a declared entry and one fixture run writes a value for it.

## Why this is not already the case

The tree measures **tokens** well and **bytes** not at all. `check_preamble_payload_budget.ts`
reports 138,325 standing-payload tokens (re-derived 2026-09-29, unchanged from the
supplied set's figure); `agents/evidence/analysis/agent-turnaround-2026-08-30.md:30-35`
reports 42.6 API rounds per request; `agents/evidence/analysis/token-economy-recycling-phase1.md:45`
reports a median final context of 519,349 tokens. Every one of those is a token count.
A chat API is stateless, so the same context is re-sent each round — but nothing in the
tree states a byte figure for it, and `src/config/metric-registry.yml` has no row that
could hold one.

## Phase 1 — Declare the metric before producing it

- [x] **1.1 Add the byte metrics to `src/config/metric-registry.yml`.** One entry per
      quantity, each carrying the file's own mandatory `consumer` / `decision` / `absent`
      fields. Minimum set: `provider_bytes_per_call` (derived), `tool_raw_bytes` and
      `tool_delivered_bytes` (measured). A metric with no consumer must not land — that
      is this file's own stated rule, and it is the reason this phase precedes any
      emitter.
      verify: `npx tsx src/scripts/lint_metric_consumers.ts` passes and
      `grep -c 'bytes' src/config/metric-registry.yml` is greater than 1
      **Evidence (2026-09-29).** `npx tsx src/scripts/lint_metric_consumers.ts` →
      `13 metric(s), each naming a consumer, a decision and what fails without it.`
      `grep -c 'bytes' src/config/metric-registry.yml` → `20`. Four byte entries
      landed, one more than the stated minimum: `tool-raw-bytes`,
      `tool-delivered-bytes`, `transcript-bytes-per-token` and
      `host-fetch-and-transport-bytes`.
- [x] **1.2 Give every byte value a `basis` field in the entry's own description.**
      One of `measured | derived | proxy | unavailable`. A derived figure and a counted
      one must not be readable as the same number. In particular `git count-objects -v`
      measures local object-store size and is never labelled a transfer figure.
      verify: each new entry's description names its basis; `grep -A4 'bytes' src/config/metric-registry.yml`
      shows one basis word per entry

      **Evidence (2026-09-29).** Every byte entry carries a `basis:` key — the
      field is declared in the file's own header block alongside `unit`, with the
      four values enumerated and `git count-objects -v` named there as the
      standing example of a local reading that is never a transfer figure.
      `grep -c 'basis:' src/config/metric-registry.yml` → one per byte entry.
## Phase 2 — Derive provider bytes from the readers that already exist

- [x] **2.1 Add a derived byte column to the existing transcript readers.** The
      readers that produced `token-economy-recycling-phase1.md` and
      `downshift-vs-cache.md` already parse `input_tokens`, `cache_creation_input_tokens`
      and `cache_read_input_tokens` per call. Multiply by a per-fixture bytes-per-token
      factor that is **measured on the fixture, never assumed**, and emit it alongside the
      token column. No new reader.
      verify: re-running the reader over its existing fixture emits a byte column whose
      basis reads `derived`, and the token columns are byte-identical to the prior run
      **Evidence (2026-09-29).** `tests/scripts/cc_transcript.test.ts` →
      *'leaves the token columns byte-identical whether or not bytes are
      measured'* and *'multiplies and labels the result derived, carrying the
      factor with it'*. `tests/scripts/cache_realization_report.test.ts` →
      *'labels every emitted figure derived and prints the factor beside it'* and
      *'renders the unavailable basis rather than a figure when no factor
      exists'*. 78 tests green across the three touched files. No new reader.
- [x] **2.2 Record the factor with the fixture, not in code.** The bytes-per-token
      ratio varies by content; a constant in a script would become the third conflicting
      figure this repo has been burned by. It lives in the fixture file that produced it.
      verify: `grep -rn 'bytes_per_token' src/scripts` returns no hardcoded numeric literal

      **Evidence (2026-09-29).** `grep -rn 'bytes_per_token' src/scripts` returns
      five hits and NO numeric literal: a field declaration, a division of two
      counted sums (`bytes / tokens`), a multiplication by that measured factor,
      and two `toFixed(4)` format-precision calls. `measureBytesPerToken` returns
      the honest null when the corpus supplies no ratio rather than substituting
      a default — asserted by *'propagates the honest null instead of
      substituting a default factor'*.
## Phase 3 — Count tool-result bytes where the envelope already carries them

- [x] **3.1 Record `raw_bytes` for each tool result at `post_tool_use`.**
      `src/scripts/hooks/dispatch_hook.ts` already receives the full result on that event
      — its own header documents an A/B run over a 2 MB payload — so the count is a
      `Buffer.byteLength` on a value the dispatcher holds. Write it through the existing
      `_lib/collector_record.ts` path, never a new store.
      verify: a scripted `post_tool_use` dispatch over a fixture payload writes one
      record whose `raw_bytes` equals the fixture's byte length
      **Evidence (2026-09-29).** `tests/scripts/tool_result_bytes_hook.test.ts`
      records through the existing collector path; *'counts BYTES for a multibyte
      payload - a char count would under-report'* pins that the count is a byte
      length and not a character count.
- [x] **3.2 Leave `delivered_bytes` equal to `raw_bytes` until something rewrites.**
      Nothing in the tree emits `updatedToolOutput` — `grep -rn updatedToolOutput src docs`
      returns 0 — so the delta is zero by construction today. Recording both now is what
      makes a later reduction measurable rather than asserted.
      verify: `grep -rn updatedToolOutput src docs | wc -l` still reads 0, and the record
      carries both fields with equal values
      **Evidence (2026-09-29).** `grep -rn updatedToolOutput src docs | wc -l` →
      `0`, unchanged. *'records both fields with equal values on every measurable
      line'* and *'the construction still holds: nothing in the tree rewrites a
      tool result'* assert both halves — the equality today and the reason it is
      an equality rather than a coincidence.
- [x] **3.3 Default the recording off outside the maintainer workspace.** A byte
      counter on every tool call is a second dark instrument if it ships on by default.
      verify: with no maintainer workspace resolved, a dispatch writes no byte record

      **Evidence (2026-09-29).** *'writes NO byte record at all when no maintainer
      workspace resolves'*, plus *'stays off for a DIFFERENT package, not merely
      for a root with no package.json'* — the near-miss that a `package.json`
      check alone would have passed — and a deliberate consumer opt-in via an env
      marker.
## Phase 4 — Refuse a byte claim that has no row behind it

- [x] **4.1 Extend the claims gate to byte figures.** `src/scripts/check_claims.ts`
      and `docs/CLAIMS.md` already govern numbers this package states about itself. A
      byte figure with no registry entry and no ledger line is refused, exactly as any
      other unbacked claim is.
      verify: `npx tsx src/scripts/check_claims.ts` fails on a fixture claim carrying a
      byte figure with no backing entry, and passes once the entry exists
      **Evidence (2026-09-29).** `check_claims` gained `parse_byte_metric_ids` +
      `is_byte_metric_claim`, keyed on the ids declared with `unit: bytes` in the
      registry — NOT on the word bytes, per Risk 5. `--self-test` → `8/8 case(s)
      behaved`, including all three directions: a byte figure naming a declared
      metric with no ledger entry REJECTS, the same figure with a `kind: quant`
      entry behind it ACCEPTS, and ordinary prose reading *'the example payload
      below is 2048 bytes long'* ACCEPTS because it names no declared id.
      Sensitivity probed: dropping the new disjunct from `is_quantified_claim`
      reds exactly the first of those three and nothing else.
- [x] **4.2 State the unreachable terms as unreachable.** The host's own fetch tool
      and the model transport are not observable from here. They are recorded as
      `unavailable`, never estimated into a total.
      verify: the registry entries name which terms are out of reach, in those words

      **Evidence (2026-09-29).** `host-fetch-and-transport-bytes` carries
      `basis: unavailable`, a `producer:` of *'none — the host's own fetch tool
      and the model transport are not observable from inside this package'*, and
      a `decision:` stating that a byte total may not be published as complete.
      No value is produced and none is estimated into a sum.
## Phase 5 — Deferred until a value exists to bound

- [~] **5.1 A shrink-only bound on a byte metric.** A ratchet over a quantity with no
      recorded history is a number invented at its own baseline. Deferred until Phases 2
      and 3 have written values across at least one fixture set.
      <!-- deferred-resolution: merged-into=road-to-a-byte-bound-and-a-public-figure -->
- [~] **5.2 Any public statement of what this package moves over the network.**
      Deferred for the same reason: `README.md` carries one incidental hit and
      `ONBOARDING.md` none, and a first public figure should be a measured one.
      <!-- deferred-resolution: merged-into=road-to-a-byte-bound-and-a-public-figure -->

## Deferred items — carried, not dropped

Archived 2026-09-30 with Phase 5 deferred. Both items were carried to
`later/road-to-a-byte-bound-and-a-public-figure.md`, which carries a
`relates:` row naming this roadmap, so the link is verifiable from both ends.

| This roadmap's step | Lands as | Why it was not built here |
|---|---|---|
| 5.1 A shrink-only bound on a byte metric | 1.1 | A ratchet over a quantity with no recorded history is a number invented at its own baseline. No change supplies elapsed days. |
| 5.2 Any public statement of what this package moves over the network | 1.2 | A first public figure should be a measured one, and the census had one day of values. |

**Resolution record** (`roadmap-progress-sync` Iron Law 3). Disposition: carry
into a follow-up created in the same change — the council row, not the owner row,
because the items stay live in the estate. Options weighed: fix-now (impossible,
both need elapsed time), merge into existing active work (nothing live covered
byte ratchets; the only byte-metric roadmap was this one), restore to `[ ]`
(would block archival on a condition nobody can meet today), cancel as `[-]` or
keep-in-archive (owner rows, not taken). Reviewed by the AI council 2026-09-30,
2 of 2 seats (anthropic, openai): carry APPROVED, and the single combined
destination I proposed was REFUSED — both seats required a split, on the ground
that one file coupling two independently maturing evidence streams would wake
carrying half-unworkable steps. Split accordingly; the sibling item from
`road-to-a-verify-clause-that-can-fail` went to its own file. **Dissent
recorded:** one seat offered cancelling all three as `[-]` with a `revisit-if`
as the safer alternative, on the ground that no mechanism un-parks a `later/`
roadmap. That is true — nothing reads an expired `review_by` — and the
destination files record it as a named gap. The disposition was not taken
because it is an owner row and the user asked for archival, not cancellation.
What closes these items: the destination's `entry_condition`.

## Acceptance criteria

- `src/config/metric-registry.yml` declares at least three byte-unit metrics, each
  passing `lint_metric_consumers` with a real consumer and a real decision.
- Each declared metric names its basis as one of `measured`, `derived`, `proxy` or
  `unavailable`, and no `git count-objects` reading is labelled a transfer figure.
- The two existing transcript readers emit a derived byte column over their existing
  fixtures with their token columns unchanged.
- One `post_tool_use` fixture dispatch records `raw_bytes` and `delivered_bytes`, equal
  by construction, through the existing collector path.
- The byte recorder writes nothing when no maintainer workspace is resolved.
- `check_claims` refuses a byte figure that has no declared metric behind it.
- Honest null is a first-class outcome: if the derived column cannot be produced
  without a hardcoded ratio, the phase closes with that recorded and no metric lands.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A derived byte figure is read as a counted one and quoted as truth | product | Phase 2 multiplies an existing token column by a bytes-per-token factor. The output is a number in a bytes column sitting beside measured token counts, and nothing in the cell distinguishes the two. The tree has already been burned by conflicting figures quoted onward as fact; a derived byte number that enters a claim as a measurement is the same failure with a new unit, and it is unfalsifiable after the fact because the arithmetic is not recorded next to the result. | Step 1.2 makes `basis` a mandatory field on every byte entry with `measured` and `derived` as separate values, and 1.2's verify greps each entry's description for exactly one basis word. The ordering is the control: Phase 1 lands the basis field before Phase 2 produces the first derived value, so no derived number can exist without one. | Phase 1 — Declare the metric before producing it |
| 2 | A byte counter on every tool call becomes a second unread instrument | product | Step 3.1 writes a record on every `post_tool_use` dispatch. This repo already carries instruments nobody reads, and a per-call counter shipped on by default is the cheapest way to add another — it accumulates volume, costs a write per tool call in every consumer install, and answers no question anyone asked. | Step 3.3 defaults the recording off wherever no maintainer workspace resolves, and its verify asserts a dispatch writes nothing in that state. Step 1.1 refuses any entry that does not name a `consumer` and a `decision`, and Phase 1 precedes Phase 3, so the emitter cannot land before a named reader exists for it. | Phase 3 — Count tool-result bytes where the envelope already carries them |
| 3 | Re-serialising the envelope to count bytes costs more than it reports | implementation | A byte count taken by re-stringifying a result the dispatcher already parsed doubles the serialisation work on the hot path for every tool call, and the payloads are not small — the dispatcher's own header documents an A/B run over 2 MB. An instrument that measures overhead by adding overhead corrupts what it reports. | Step 3.1 binds the count to `Buffer.byteLength` on the value the dispatcher already holds and forbids a new store, routing the write through the existing `_lib/collector_record.ts` path. There is no re-parse and no second traversal; the measurement is one length read on a value already in memory. | Phase 3 — Count tool-result bytes where the envelope already carries them |
| 4 | A hardcoded bytes-per-token constant becomes a third conflicting figure | implementation | The bytes-per-token ratio varies with content, so a literal in a script is correct for the fixture that produced it and silently wrong for everything else. Once it is in source it gets reused by the next reader, diverges from the fixture it came from, and the tree carries two byte figures that disagree with no way to tell which measured what. | Step 2.2 puts the factor in the fixture file that measured it rather than in code, and its verify is a negative grep: `grep -rn 'bytes_per_token' src/scripts` must return no hardcoded numeric literal. A constant reintroduced later fails that check rather than passing silently. | Phase 2 — Derive provider bytes from the readers that already exist |
| 5 | The claims gate blocks legitimate prose that merely contains a number of bytes | implementation | Step 4.1 teaches `check_claims.ts` to refuse unbacked byte figures. A detector keyed on the word bytes near a number reds on ordinary documentation — a file size in a README, a payload example in a contract — and the cheapest repair for a gate that reds on correct prose is to weaken it until it finds nothing. | Step 4.1 keys the gate on a declared byte metric name from `src/config/metric-registry.yml`, not on the word bytes, so only a figure claiming a registered metric is checked. Its verify pins both directions: a fixture claim with no backing entry must fail, and the same claim must pass once the entry exists. | Phase 4 — Refuse a byte claim that has no row behind it |
