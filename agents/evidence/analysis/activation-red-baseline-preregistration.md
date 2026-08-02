# Pre-registration — the activation red-baseline search

**Registered 2026-08-02, before any data was read.** Roadmap:
`road-to-activation-evidence-or-refusal`, Phase 0 step 1. This file is committed
in its own commit; every analysis commit that follows is later in the history.
The bar below is frozen: it is **not** edited after the data is read. If the
sweep produces something interesting that this bar excludes, that is recorded as
an out-of-scope observation, never as a bar amendment.

## What is being decided

The prior reminder-injection null
([`reminder-injection-verdict`](../../settings/contexts/reminder-injection-verdict.md))
tore its apparatus down at Δ = 0 pp and pre-committed a written revisit
condition: *someone produces a scenario corpus where the kernel-only baseline
demonstrably FAILS — a real red baseline, e.g. genuine > 3K-token distance in a
live multi-turn session.* This search either produces that corpus from data that
already exists on disk, or it does not. Nothing else is being decided here, and
no resolver code is in scope in any branch.

## Prior state disclosed at registration time

To keep "registered before looking" honest, here is everything already known
when this file was written — inventory only, no content read:

- `agents/runtime/.agent-chat-history` exists: 53,457 bytes, **15 lines** (one
  is the `{"t":"header"}` line, so ≤ 14 body entries). Its schema is
  `{t: user|agent|tool|phase, ts, text, s: session}`
  (`src/scripts/mine_session.ts:122`).
- `~/.claude/projects/**/*.jsonl` exists: **1,367** transcript files across 40+
  project directories, of which the `…-agent-config…` directories are this
  repository's own sessions.
- No message body from either source has been read.

The roadmap's Context section claims `agents/runtime/` "already carries redacted
chat-history JSONL — the corpus source exists". At ≤ 14 body entries that claim
is true in kind and thin in degree; the Claude-Code transcripts are the
`mine_session.ts`-documented fallback and carry the multi-turn sessions. Both
are in scope (§ Corpus).

## The bar — all five conditions, conjunctive

A red baseline exists **iff** the sweep yields **≥ 5 distinct sessions** that
each satisfy every one of:

1. **Length** — the session has **≥ 8 turns** (a turn = one user message plus
   the assistant's reply to it).
2. **Objective violation** — at some turn the session violates one of the three
   machine-checkable obligations in § Detectors. Judgement calls do not count.
3. **Rule in context** — the violated rule was **manually verified as still
   present in that session's context** at the failing turn (§ In-context
   verification). A rule that was never projected is a *scoping/projection*
   defect, recorded separately, and removed from this corpus.
4. **Distance** — turn-by-turn token accounting shows **≥ 3,000 tokens** of
   distance between the rule text and the failing decision (§ Distance).
5. **Host tier named** — the host/model tier of the failing turn is stated per
   row, from the transcript's own model field, never inferred.

**Fewer than 5 qualifying sessions → no red baseline → Branch A.** Four
qualifying sessions is not "nearly a red baseline"; it is Branch A with the
count recorded.

## Detectors — machine-checkable only

Exactly three, chosen because each has a mechanical negative signal. Anything
requiring a reading of intent is out of scope by construction.

**D-A · Unverified completion claim** (`verify-before-complete`, kernel).
An assistant turn asserts completion — matching, case-insensitively,
`\b(done|complete[d]?|fertig|erledigt|all (tests|checks) pass|passes|green)\b`
in a claim position — while **no** tool result in that same turn or the
preceding assistant turn came from a verification command (test runner, linter,
type-checker, build). Negative signal: the absence of a verification tool call
adjacent to the claim.

**D-B · Out-of-scope file touch** (`minimal-safe-diff` / `scope-control`,
kernel + tier-2). An `Edit`/`Write` tool call in the session targets a file
path that appears in **no** preceding user message of that session and in no
tool result the user's stated task named — i.e. the diff reaches a file the
stated task never named. Negative signal: path absent from the user's own turns.

**D-C · Forbidden commit shape** (`commit-policy` /
`no-decorative-emojis-in-git-surfaces` / `no-attribution-footers`, kernel +
tier-2). A `git commit` command in the session whose subject line carries an
emoji, or whose message carries an attribution footer
(`Generated with`, `Co-authored-by: <an AI assistant>`), or which runs with no
authorizing user turn anywhere earlier in the session (no `commit`/`committe`/
`push`/`/commit` token in any preceding user message). Negative signal:
mechanical string presence / absence.

A candidate row is produced per (session, turn, detector) hit. **Detector hits
are candidates, not findings** — conditions 3–5 must still pass.

## In-context verification (condition 3)

For each candidate, confirm the violated rule was in that session's context by
locating its text in the session's own system prompt / instruction block
(the transcript records it). Classify every candidate as exactly one of:

- `in-context-and-violated` — stays in the corpus.
- `not-projected` — the rule was absent from that session's context. Recorded in
  a separate section as a **projection/scoping defect**, removed from this
  corpus, and explicitly NOT counted toward the bar.
- `rejected` — with the reason (detector false positive, claim not in a claim
  position, path was named after all, commit was authorized, …).

## Distance (condition 4)

Distance is computed, not estimated, and deliberately as a **lower bound**:

```
distance(turn) = input_tokens(failing assistant turn) − input_tokens(first assistant turn of the session)
```

The first assistant turn's input already contains the whole system prompt (where
`eager-all` places the rule), so the difference is conversation grown *since*
the rule text — a conservative floor on rule→decision distance. `≥ 3000` passes.
Where a source carries no token accounting (the flat `.agent-chat-history`
schema does not), distance is computed from a 4-chars-per-token estimate over
the intervening text and the row is marked `estimated`; an `estimated` row can
satisfy condition 4 only at **≥ 6,000** tokens (2× the bar, to absorb the
estimator's error).

## Corpus

- `agents/runtime/.agent-chat-history` (all body entries).
- `~/.claude/projects/-Users-*agent-config*/**/*.jsonl` — this repository's own
  sessions, including its worktrees. Other projects' transcripts are **out of
  scope**: they are not governed by this package's projection, so a violation
  there proves nothing about rule activation under it.
- Sessions with fewer than 8 turns are counted in the denominator and excluded
  by condition 1.

## Privacy

The report carries **no verbatim conversation excerpts** beyond the minimal
obligation-bearing fragment needed to show the detector fired (≤ 15 words, per
[`content-quoting-floor`](../../../src/rules/content-quoting-floor.md)), with
absolute local paths, real names, and any credential-shaped string redacted per
[`domain-safety-pii`](../../../src/rules/domain-safety-pii.md). Session ids are
recorded as opaque ids, never as file paths under `$HOME`.

## Decision rule, both branches, written now

- **Bar met (≥ 5 qualifying sessions)** → **Branch B**. The question re-opens,
  and the cheapest candidate is tried first — written-down state, then the
  generated file→skill table, then the stop-event consumer — each measured
  against *this* corpus before the next is built. The runtime resolver is last
  and only after 1–3 measurably fail.
- **Bar not met** → **Branch A**. Recorded as a fourth null-adjacent finding,
  ADR-054 moves to `rejected` citing this attempt, the offline matcher's fate is
  decided in the same pass, and **D1 is refused permanently**. Re-opening then
  requires a materially weaker host tier entering the consumer set, or an
  explicitly funded n ≈ 50/arm run.

## What a null here does and does not mean

A null means: *in this repository's own recorded sessions, under this
projection, the three machine-checkable obligations do not fail at distance in a
way that a resolver would have caught.* It does **not** mean rules never fail —
only that the failure mode this corpus can see is not present at the
pre-registered bar. The report states the shape tested and the shape not tested.
