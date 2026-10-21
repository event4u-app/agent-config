<!-- evidence-type: analysis -->

# The result store: build it now, behind an empty selection

AI council, 2026-10-20. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present before and after the run, one round, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`tool-results-d8-reopen-2026-10-20.question.md`. Raw response:
`agents/runtime/council/responses/toolres-d8-reopen-20261020.md` (local,
gitignored). For `road-to-tool-results-that-leave-a-handle`, rows D16 and D17.

## Why the row was reopened

D8 (2026-10-14) kept Phase 2 unbuilt until its caller existed, with the
revisit-if "either dependency lands, or the placeholders 1.1 ADR freezes the
stage interface before the stage is built". ADR-285 is accepted and
`src/scripts/hooks/egress_stage.ts` exists with all four modes, so the
condition fired.

## Verdict — both seats chose (A)

Build Phase 2 now inside the existing stage, with the selected-class set an
empty constant that D14 fills.

- **openai:** *"D8's explicit revisit condition has been met … This is no
  longer the rejected callerless store."* The equality between selected input,
  placeholder bytes, delivered bytes and stored bytes "can only be proved inside
  the real dispatcher stage". Its own counter: D14 may select nothing, leaving
  unused code; "bounded: keep the implementation private to the stage,
  configure no production classes, and make removal straightforward."
- **anthropic:** leaning (A); the empty-set abstraction is clean and settles
  the contracts before they are time-critical. Its own counter: contracts
  designed before the classes are known may not fit their size and access
  profile.

## The four open contracts

| Contract | anthropic | openai | Taken |
|---|---|---|---|
| (i) range unit | bytes | bytes, zero-based half-open, out of bounds refused, never clamped | both: bytes, half-open, refused not clamped |
| (ii) detector confidence | any credential-class match refuses | any reportable match at any confidence refuses; a detector failure or a recorded refusal refuses too | both |
| (iii) expired vs unknown | file mtime: present and old is expired, absent is unknown | a bare hash cannot tell them apart once the entry is deleted; an authenticated self-expiring handle (digest, expiry, version, MAC) | **split** — openai's taken, see below |
| (iv) concurrency | write-once temp file plus atomic rename, serial cleanup | the same, plus exclusive create, verify the bytes served, and an inter-process lock for cleanup | both, with openai's additions |

**On (iii).** The anthropic scheme answers `unknown` for an expired handle as
soon as cleanup has removed the file, which is the case 2.3 is written for
("a handle to an expired entry answers expired"). openai named that defect in
its own answer and its scheme has no such window, so it is taken on the
requirement, not on a count of seats. Recorded as a split all the same.

## What neither seat said, and the implementer decided

- Cleanup runs at the first store of each session rather than on the
  `session_start` event: the stage runs only on events that carry a body, and
  a `session_start` concern would add a manifest entry and bundle bytes for a
  store that is empty until a class is selected.
- The store is its own conditional chunk rather than part of the egress engine,
  so the engine keeps the headroom its ceiling reserves for the detector work
  queued on it.
- The read path is the existing `report_reducible_classes` entry point
  (`--read-handle`), not a new CLI verb, as 2.4 requires.
