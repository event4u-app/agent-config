<!-- evidence-type: analysis -->

# Subagent lifecycle — the drain-close measurements

> Evidence for the drain run of
> [`road-to-subagent-lifecycle-integrity`](../../roadmaps/road-to-subagent-lifecycle-integrity.md)
> on 2026-08-20. Six findings, each answering an open step from a source that
> already exists rather than from a mechanism nobody has built.
>
> **Every number below is read from the live `subagent-ledger` file in the
> maintainer's checkout**, `agents/runtime/state/subagent-ledger/2026-08.jsonl`.
> That file is gitignored runtime state and is appended to by other live
> sessions while it is being read, so the whole snapshot is frozen at one
> declared cutoff — **`ts < 2026-08-20T16:00:00.000Z`**, 4,249 records — and
> every aggregate below is computed over that cutoff only. A re-read after the
> cutoff will return larger counts; it is not a contradiction.
>
> **This is machine-local evidence.** It is not reproducible from a clean clone,
> because the instrument it reads is gitignored by construction
> (`.gitignore` → `/agents/runtime/`). That is a property of the ledger, not a
> defect of these findings, and it is why each one states its command.

## The window

The `session_id` fix (Phase 1 Step 4 correction (b)) is the boundary: records
written before it cannot be attributed to a session and were declared
undiscardable-by-filtering, so the baseline counts from the fix forward. Every
figure in B1–B4 is over records carrying `session_id`.

| | |
|---|---|
| Post-fix window | 2026-08-14T23:04:38Z → 2026-08-20T15:28:08Z |
| Distinct sessions | 57 |
| `subagent_start` records | 307 |
| `subagent_stop` records | 3,400 |
| `spawn_guard_shadow` records (whole file — the concern writes no `session_id`) | 325 |
| `subagent_reaped` records | 26 |
| `unidentified` records | 0 |

The ≥20-dispatch bar Phase 1 Step 4 sets is cleared by an order of magnitude.

## B1 — the Phase-1 baseline: three of four columns publish, and the fourth is named

Step 4 names four columns. Three are computable from the window as it stands;
the fourth is not, for the reason F2 of the return-channel file already gave.

**Parse-failure rate — 17 of 3,400 stops (0.50 %).** Every one of the 17 carries
`envelope_error_count: 5`, i.e. an identical validator-error count, which is
consistent with one recurring answer shape rather than 17 independent
malformations. `ok` appears **zero** times in the window: no dispatch in 3,400
has ever returned an envelope that satisfied `validateResponse`.

**Duration distribution — over the 271 stops that carry one.** A duration
requires a matched start, so 3,129 of 3,400 stops have none; the distribution
below describes the correlated 8.0 %, not the population, and the two facts
should not be quoted apart.

| min | p50 | p90 | p99 | max |
|---|---|---|---|---|
| 16.2 s | 316.2 s | 809.1 s | 1,635.7 s | 2,664.6 s (44.4 min) |

**Nested-spawn count — 0 of 307.** Every start record in the window reads
`depth_basis: "assumed-root"` and `parent_ref: null`. Not one payload has ever
supplied a parent linkage. See B4, which is the same observation viewed as an
answer to Phase 0 Step 4.

**Envelope return rate — NOT published, and the reason is the instrument.**
3,383 of 3,400 stops read the retired collapsed verdict `absent`, which meant
either "no message arrived" or "prose arrived". A rate off that column reads
0 % and measures the answer format, exactly as F2 said at n=25 and now says at
n=3,400. The four-way split (`no_message` / `no_envelope` / `fail` / `ok`)
landed with this drain run, so the column becomes measurable **forward from the
split commit** — the historical 3,383 stay unresolvable by filtering, the same
way the pre-`session_id` window did.

**A fifth number the step does not name, and it is the one that moved.**
`stop_loss_arms_exceeded` — the Phase 3 Step 3 shadow — fired on **138 of
3,400 stops (4.1 %)**: 119 tripped the 5 m arm only, 17 tripped 5 m + 15 m, and
2 tripped all three arms (5 m + 15 m + 30 m). The wall-clock stop-loss is not a
guard against a hypothetical.

```
# the whole snapshot, one pass, cutoff applied in the reader
python3 - agents/runtime/state/subagent-ledger/2026-08.jsonl   # see the header for the cutoff
```

## B2 — `last_assistant_message` is delivered on this host, and the instrument proves it

Phase 0 Step 2's first assertion — *does `last_assistant_message` arrive as
documented on THIS host version* — is answered **positively, without a raw
payload capture**, by the 17 `fail` records.

The proof is a property of the classifier, not an inference about it.
`classifyEnvelope` can only return `fail` after `_jsonObjectCandidates` decoded
at least one JSON object out of the message string, which requires the message
to have been a non-blank string carrying a JSON object. A `fail` record is
therefore an existence proof that the field was delivered — 17 times, across the
window.

**What it does not establish, stated because the difference is the whole
residue.** The ledger reads the field through
`str(payload, 'last_assistant_message', 'lastAssistantMessage')`, so a `fail`
proves that **one of those two key spellings** carried the message, not which.
The documented spelling is the snake_case one; the camelCase alias is defensive.
Settling *which* key the host actually sends needs the verbatim payload, and
that is precisely the half transferred to the stub.

It also establishes existence, never a rate: `absent` collapsed "no message" and
"prose", so the fraction of dispatches that delivered a message at all is not
derivable from the historical window. That is the forward measurement the split
enables.

## B3 — `agent_type` does not arrive on `SubagentStop`, now at 92 %

Phase 0 Step 2's second assertion was already answered negatively at n=25
(F4: 18 of 25 null). At n=3,400 the shape holds and sharpens: **3,129 of 3,400
stop records (92.0 %) read `agent_type: null`**. The 271 that carry one are
exactly the 271 with `start_seen: true` — the value is inherited from the
correlated start record, never delivered on the stop event itself.

The falsifier Phase 0 declared for this field has fired, and it fired the same
way at 136× the sample size.

## B4 — no payload has ever supplied a parent, in 632 observations

Phase 0 Step 4 asks whether `agent_id` / `agent_type` reach a
`PreToolUse` / `PostToolUse` payload inside a Task-spawned subagent. The raw
answer needs the capture. What the existing instruments already say is the
negative space around it, and they say it consistently:

- **307 of 307** `subagent_start` records: `depth_basis: "assumed-root"`,
  `parent_ref: null`. The nested-spawn signal Phase 1 Step 3 built has never
  once fired.
- **325 of 325** `spawn_guard_shadow` records:
  `depth_usable_for_derivation: false`, `depth_estimate_basis:
  "deepest-open-record-plus-one"`. That concern is the tree's only
  `pre_tool_use` observer of `Agent`/`Task` calls, and it records — by its own
  header, `spawn_guard_shadow_hook.ts:42` — that pre-spawn there is no
  `agent_id` to resolve a real parent from.
- A grep of `src/` for payload reads of `agent_id` / `agent_type` returns
  `subagent_ledger_hook.ts` only, bound on `subagent_start` / `subagent_stop`
  (`hook_manifest.yaml:925-926`, `:966-967`). **Nothing in the tree reads either
  field off a tool event.** The nearest neighbour,
  `orchestration_record_hook.ts:182-183`, reads `subagent_type` from the Task
  *tool input the orchestrator sent* — an orchestrator-side observation of what
  was requested, not an identity field of the executing agent.

**This is not the absence proof Phase 4 needs, and must not be read as one.**
`spawn_guard_shadow` fires on the parent's `Agent`/`Task` call, before a child
exists; a subagent's *own* tool events are a population these 632 records do not
sample. The honest statement is: zero positive observations exist, and no
instrument in the tree can currently produce one. The distinction matters
because Phase 4's falsifier cancels a phase on absence, and absence-of-evidence
is not it.

## B5 — Phase 5 Step 2: the before/after pair cannot be built, and cannot have moved

Step 2 asks for a re-measured tier distribution "via the Phase-1 ledger". Two
facts settle it, and neither needs a window.

**The named instrument does not carry the quantity.** `grep -in tier
src/scripts/hooks/subagent_ledger_hook.ts` returns nothing across all 736 lines.
No record shape — start, stop, reap, unidentified, shadow — has a tier, a model
name, or a routing field. The ledger cannot measure a tier distribution, before
or after.

**The wired caller cannot have changed one.** Step 1 traced it end to end and
published the pre-registered outcome: `recommendSliceTier` calls
`resolveSubagentRouting` at `delegation_nudge_hook.ts:342` with a hardcoded
`task_tier: "lite"` / `session_tier: "high"`, the result is interpolated into
prose at `:382` and injected as `additionalContext`, and nothing reads it back.
A value no consumer reads cannot move a distribution.

So the falsifier's own branch — *"Distribution unchanged with the caller wired →
tier drift is not routing-caused; publish and stop here"* — is taken, **on a
derivation rather than on a measured distribution**, and the distinction is
recorded rather than smoothed over. Making the measurement real would require
adding a tier field to the ledger and a consumer that reads the resolver's
output; both are new work, neither is this step, and the step's question is
answered without them.

## B6 — the Phase 3 Step 1 falsifier is evaluable, and does not fire

The shadow's replacement falsifier reads: zero `would_deny` across ≥ 20
dispatches at the **widest** candidate (`n4m8`) → remove the guard. Over 325
shadow records:

| candidate | `would_deny` |
|---|---|
| `n2m4` | 210 |
| `n3m6` | 151 |
| `n4m8` | **96** |

96 ≠ 0 at the widest arm, over 325 dispatches against a bar of 20. The
falsifier does not fire and the concurrency arm is not solving a problem this
estate lacks — it is describing one it has, monotonically across the candidate
spread. The flip decision itself is economic and belongs to the concern
activation policy; this finding only settles that the null was not the outcome.

Two caveats. The 325 records carry **no `session_id`** — the shadow concern
never writes one — so unlike B1–B4 this count aggregates every session that
touched the checkout, and the ≥20 bar is cleared many times over either way. And
the depth arm is not evaluated here at all: `depth_usable_for_derivation` is
`false` on all 325, so only the concurrency arm produced a verdict.

## B7 — Phase 7's blocking conditions: (a) is met, and (b)'s cheap route does not exist

**Condition (a) — MET.** The `do_not_touch` field has real producers. Searching
every `recycle-envelope*.json` under the maintainer's checkout and its
`.claude/worktrees/*` worktrees: **13 envelopes exist, 6 carry a non-empty
`do_not_touch`, and 3 of those 6 are entirely path-shaped** (every entry passes
`isPathRef`). Two of the three were written 2026-08-20T12:48, i.e. after the
shape enforcement landed, so the count is a fact about producers rather than an
artefact of an unchecked field. The falsifier at Phase 7 — *the field is unused
rather than unenforced* — is **refuted by observation**; the guard is not
cancelled.

One of those real entries is `agents/roadmaps/later/` — a bare directory with a
trailing slash. It validates, and under exact-string matching it would match
nothing. That is condition (c) arriving as a concrete case rather than a
hypothetical.

**Condition (b) — the preferred mitigation is unavailable as written, and this
is new.** The step prefers "reusing the envelope read the handoff consumer
already performs over a fresh unconditional file read". That read cannot be
reused: `handoff-context` is bound on **`session_start` only**
(`hook_manifest.yaml:892`, `:899`), and `consume_recycle_envelope` is
consume-on-read, **moved not copied** — every outcome except `absent` renames
`recycle-envelope.json` to `recycle-envelope.consumed.json`
(`handoff_context_hook.ts:156-170`, contract at
`_lib/recycle_envelope_paths.ts:11-23`). By the time any `pre_tool_use` fires,
the file the guard would read is gone, and the surviving `.consumed.json` is
explicitly the *last* envelope kept inspectable for debugging — possibly an
earlier session's.

So a fourth condition exists that the step never named: **the list has to be
published somewhere a per-tool-call reader can see it** — session state written
by the consumer, or a deliberate decision to read the consumed file and accept
its provenance. Until that is decided, "reuse the existing read" describes a
read that has already destroyed its own source.

**Chain cost, corrected.** The step's parenthetical cites
`hook_manifest.yaml:889` for "eleven concerns". The counts are right and the
citation is stale by six lines: augment binds **11** at `:895`, claude and
cowork bind **12** at `:903` and `:957` (the two rows carrying
`spawn-guard-shadow`). No other platform binds the slot at all.

`grep -rn 'do_not_touch' src/scripts/hooks/concern_registry.ts` returns nothing —
the guard has no registry line, so the step's own verify annotation still reads
"not shipped", correctly.

## What this evidence does NOT establish

- **That `agent_id` is absent from in-subagent tool events.** B4 is zero
  positive observations from instruments that cannot sample that population.
  Phase 4's falsifier needs the capture, not this file.
- **Which key spelling carries the final message.** B2 proves delivery under one
  of two accepted spellings, not which one.
- **An envelope return rate.** B1 names it as unmeasurable in the historical
  window and measurable forward from the split; no rate is published here.
- **A tier distribution.** B5 publishes a derivation, explicitly not a
  measurement.
- **Anything reproducible from a clean clone.** Every count reads gitignored
  runtime state on one machine.
