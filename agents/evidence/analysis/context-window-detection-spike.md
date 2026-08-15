# Context-window detection spike — can a session know the window it is in?

> **Pre-registered spike** for `road-to-inbox-harvest-2026-08-d-context-ledger`
> Step 1.2, with an honest-null outcome permitted before it ran. Executed
> 2026-08-15 against the tree at `e3bd96158`. Every claim below carries a
> `file:line` or a command output.

## The question

`src/config/recycle-threshold-budget.json:8` holds a flat recycle threshold of
800,000 tokens. Its own `known_limitation` at `:10` says a session with a window
of 200k or less auto-compacts near 160–206k and is **never served** by that
threshold, and names the reason: the transcript carries no explicit window
marker. Step 3.1 would replace the constant with a `{window → threshold}` table,
which requires knowing the window. This spike asks whether that is possible
today, before the table is designed.

## Verdict: **PARTIAL**

A usable signal exists. It arrives **after** the first auto-compaction of a
session, which is the event the recycle advisory exists to prevent. There is no
pre-compaction, per-session window signal in this tree.

## The model-id assumption is refuted

An earlier proposal on this axis assumed the window follows from the model
identifier. It does not, and the refutation is three independent facts:

- `src/scripts/_lib/cc_transcript.ts:81,285` parses `message.model` into
  `TranscriptRecord.model` as a **bare string** (`claude-sonnet-4-5`-shaped),
  confirmed by the fixtures at `tests/scripts/cc_transcript.test.ts:56,70,84,97`.
- **Nothing in the tree maps that string to a window size.** A sweep for
  `context_window` / `window_tokens` / `contextWindow` / `windowTokens` across
  `*.ts`, `*.json` and `*.md` returns exactly one non-trivial hit:
  `src/scripts/update_prices.ts:32` fetches an upstream price table whose
  filename literally names the context window — and its extractor
  `_toRowsFromLitellm` (`:93-130`) reads **only** the input and output
  per-token costs and discards every other field. The shipped fallback table
  at `src/scripts/ai_council/_default_prices.ts:25-44` has no window field
  either.
- **The distinction is not a property of the model at all.** A 1M window is an
  account/flag tier on the same model id, so even a complete model→window table
  would be ambiguous for exactly the identifier this estate runs on.

No environment variable carries it either: the only `CLAUDE_*` variables read
anywhere in `src/scripts/` are `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and
`CLAUDE_CODE_SESSION_ID` (`src/scripts/_lib/host_capability.ts:201,261`,
`src/scripts/_cli/handoff_sessions.ts:534`).

## The one real signal, and why it is late

`src/scripts/_lib/session_eol.ts` already parses what is needed.
`detectCompaction()` (`:108-119`) reads `compact_boundary` records and stores
`pre_tokens`, `post_tokens`, `trigger` and `timestamp` per event into
`EolCounters.compactions[]` (`:43-51,73`), written per session under
`agents/runtime/state/session-eol/`.

An observed `pre_tokens` **is** a window-boundary observation. The measured
distribution, from `agents/evidence/analysis/token-economy-recycling-phase1.md:61-64`,
is tight for the population that compacted at all: minimum 941,636, median
1,000,551, maximum 1,031,366 — 94–103 % of a 1M window. The same page (`:48`)
records a one-off classification, *peak > 210k ⇒ 1M window*, splitting 201
sessions into 190 on the 1M window and 11 on 200k or less.

Two limits, both load-bearing:

1. **That classification is not shipped code.** A grep for `210k` / `210,000` /
   `210000` across the whole tree finds it **only** in that prose page — not in
   `session_eol.ts`, not in `session_eol_report.ts`. It is a documented
   observation, not a reusable function.
2. **The observation coincides with the event it would prevent.** A session
   learns its window by compacting. For the *first* advisory in that same
   session the signal does not exist yet, and
   `agents/runtime/state/context-fill.json` — written by `writeContextFill()`
   (`src/scripts/hooks/session_eol_hook.ts:241-258`) — carries
   `final_context_tokens`, `recycle_threshold_tokens` and `past_threshold`, and
   **no window field at all**.

## What would close it to POSITIVE

Either of:

- an explicit host-emitted window marker alongside `message.model` in the
  transcript — which would also have to distinguish the account tier, since the
  model id alone cannot; or
- a maintained model→window table sourced from the field `update_prices.ts`
  already fetches and discards — which closes the *model* half and leaves the
  *tier* half open, so on its own it is not sufficient.

Neither exists today. A cross-session inference — classify the window from a
previous session's observed peak, as the 210k rule does — is a third path, and
it is a different mechanism with a different failure mode: it is unavailable on
a first session, and it silently mis-classifies a machine whose account tier
changed.

## Consequence for Step 3.1

The spike's gate condition was "a usable signal". PARTIAL is not the null that
parks the phase, and it is not the clean positive the step assumed. The decision
of what a window-aware threshold may be built on with a retrospective-only
signal is recorded separately with the step; this page is the measurement, not
the decision.
