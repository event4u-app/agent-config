<!-- evidence-type: analysis -->

# Role-scoped spawn profiles — the drain-run evidence

> Evidence for the drain run of
> [`road-to-role-scoped-spawn-profiles`](../../roadmaps/archive/road-to-role-scoped-spawn-profiles.md)
> on 2026-08-23. Phase 0 is answered as far as it can be answered without a
> host-owner capture; Phases 1-2 are cancelled on a council decision and
> preserved as a stub; Phase 3 is executed in full.
>
> **Two provenance facts that bound every number below.**
> (1) The transcript figures are read from **one machine's**
> `~/.claude/projects` store, which is not in any repository and is not
> reproducible from a clean clone. (2) That store is **appended to while it is
> being read** — this session writes to it — so each figure is stamped with the
> run that produced it and a re-run will return larger counts. That is a
> property of the instrument, not a contradiction.

## A — Phase 0 Step 1: the three consumed findings, read-only

Consumed from
[`subagent-lifecycle-drain-close.md`](subagent-lifecycle-drain-close.md)
§§ B2/B3/B4. These are **closed input**. This drain re-derived none of them and
edited nothing in the dependency.

| # | Finding | Recorded count | Source |
|---|---|---|---|
| B2 | `last_assistant_message` **is** delivered on `SubagentStop` on the pinned host. The 17 `fail` classifier records are an existence proof: `classifyEnvelope` can only return `fail` after a JSON object was decoded out of the message string. | 17 `fail` records | `subagent-lifecycle-drain-close.md:87-113` |
| B3 | `agent_type` does **not** arrive on `SubagentStop`. The 271 records that carry one are exactly the 271 with a correlated `start` record — the value is inherited, never delivered. | **3,129 of 3,400** stops null (**92.0 %**) | `subagent-lifecycle-drain-close.md:113-123` |
| B4 | **Zero** payload-supplied parents. 307 of 307 `subagent_start` records read `depth_basis: "assumed-root"`, `parent_ref: null`; 325 of 325 `spawn_guard_shadow` records read `depth_usable_for_derivation: false`. | **0 in 632** observations | `subagent-lifecycle-drain-close.md:124-155` |

**What B2 and B4 explicitly do NOT establish**, restated because dropping the
caveat is how a second, wrong figure gets published for the same question:

- B2 proves **existence**, never a **rate**, and never **which** of the two
  accepted key spellings (`last_assistant_message` / `lastAssistantMessage`)
  the host sends — the ledger reads both and cannot distinguish them.
- B4 is **not an absence proof**. `spawn_guard_shadow` fires on the parent's
  `Agent`/`Task` call, before a child exists; a subagent's *own* tool events
  are a population those 632 records do not sample.

**The start-to-stop join rate is ~8 %** (271 correlated of 3,400,
`subagent-lifecycle-drain-close.md:113-123`), so most stops cannot be
attributed to a dispatcher at all. That figure comes from a **gitignored,
machine-local** ledger (`.gitignore:190` → `/agents/runtime/`): it is one
machine's traffic and generalises to nothing. In **this** worktree
`agents/runtime/state/subagent-ledger/` is empty (fresh checkout, 0 files), so
no rate was recomputed here — the number is cited from the committed evidence
file, not re-measured.

## B — Phase 0 Step 2: the host version pin

```
$ claude --version
2.1.241 (Claude Code)
```

- **Host version (literal, not a range):** `2.1.241 (Claude Code)`
- **Capture session date:** 2026-08-23
- **Status of the capture:** **declined** — see § C. The pin is recorded anyway
  because it is the version under which the *decline* and every Phase 3 figure
  below were taken, and a later re-read needs to know which host it is
  comparing against.

## C — Phase 0 Steps 3-4: the capture is declined, and the decision is a council one

`b-maintainer-run-capture` offered exactly two options: **(a)** the host owner
performs one time-boxed capture under the containment protocol in
[`stubs/road-to-subagent-payload-capture.md`](../../roadmaps/stubs/road-to-subagent-payload-capture.md),
or **(b)** the capture is declined, Phase 0 Steps 3-4 go `[-]`, and Phases 1-2
are cancelled with them.

**Council verdict: (b), convergent 2 of 2** — `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 2 rounds, blind peer review, actual cost \$0.0516.

Option (a) is not executable by an autonomous run, on three independent
grounds, each recorded in the tree rather than asserted here:

1. The stub names the actor as **"the host owner, performing a fresh-session
   capture on the machine whose `~/.claude/settings.json` the host reads. Not a
   maintainer role and not a CI job."**
2. The roadmap's own Non-goals list contains **"Automating the capture. The cut
   line is recorded and is not this roadmap's to move."**
3. The stub records the cut line as a **security** decision: *"injecting
   `AGENT_HOOK_CAPTURE_DIR` into host settings is a host-environment
   modification and the resulting verbatim capture is an egress risk"* — routed
   through `security-sensitive-stop` § self-modification because it is a
   user-global tool-configuration change reaching every other live session on
   the machine.

**Consequence, stated plainly.** The trimmable fraction Phase 0 Step 4 asks for
is **not computed**, because both its numerator and its denominator were
required to come from the capture. No fraction is published here — publishing
one from the projected tree instead is precisely the Risk-1 failure the roadmap
exists to prevent ("a confident number measuring the wrong thing").

The cancelled work is preserved with a three-point integrity check in
[`stubs/road-to-role-scoped-spawn-manifest.md`](../../roadmaps/stubs/road-to-role-scoped-spawn-manifest.md).

## D — Phase 0 Step 5: the continue-or-stop line

```
STOP for Phases 1-2. CONTINUE for Phase 3.
```

- **Branch taken:** stop.
- **The number it was taken on:** **zero** — not a small measured payload, but
  *no measurement at all*. The inventory Step 3 would have produced does not
  exist, so the honest branch is the one the roadmap itself pre-authorised in
  Step 5 ("the honest outcome of Phase 0 may be that the rest of this roadmap
  should not be built"), reached via the decline rather than via a small
  denominator.
- Phase 3 is declared independent of Phases 0-2 in both directions and is
  executed below.

## E — A finding against this roadmap's own Context section

The roadmap's Context paragraph reads:

> `agents/roadmaps/archive/road-to-subagent-lifecycle-integrity.md` is active
> with three open steps — Phase 2 Step 2 (line 504), Phase 2 Step 3 (line 549),
> Phase 7 Step 1 (line 843).

**Every clause of that is false as of 2026-08-23**, and the sentence contradicts
itself: it writes the `archive/` path and then calls the file active.

| Claim | Measured |
|---|---|
| "is active" | **Archived.** The file is at `agents/roadmaps/archive/`; its drain PR **#1532 merged 2026-08-22**. |
| "three open steps" | **Zero.** `grep -c '^- \[ \]'` returns **0**; the ledger is 15 `[x]` and 8 `[-]`. |
| lines 504 / 549 / 843 | **Moved.** The three named steps are at **521**, **587** and **772**, all `[-]`, all carrying a `transferred` disposition pointing at `stubs/road-to-subagent-payload-capture.md`. |

Corrected in place per the council's next step. The dependency itself was **not
edited** — the correction is to the sentence in the dependent file that
described it wrongly.

## F — Phase 3 Steps 1-2: the token-sink ranking, with its denominator

New instrument: [`src/scripts/token_sink_report.ts`](../../../src/scripts/token_sink_report.ts),
built on `_lib/cc_transcript.ts` (`scanTranscripts:260`, `aggregateByBucket:317`,
`billableInputTokens:124`, `weightedInputUnits:134`) rather than re-deriving any
of them.

```
$ ./scripts-run src/scripts/token_sink_report --max-age-days 90 --top 12
```

**Denominator, published first because a share without it is meaningless:**

| Field | Value |
|---|---|
| deduped assistant records | **132,410** of 255,895 seen (dedup **48.3 %**) |
| transcript legs scanned | **2,167** |
| date range | `2026-07-20T00:27:53.712Z` .. `2026-08-23T13:47:04.865Z` |
| window | 90 days · root `~/.claude/projects` |
| provenance | one machine's local store; **not** a property of the package |
| run stamp | 2026-08-23, host `2.1.241 (Claude Code)` |

**Ranking (weighted input units — cost-*shaped*, not a price):**

| Rank | Sink | Calls | Share |
|---|---|---:|---:|
| 1 | `main/claude-opus-5` | 76,800 | **66.3 %** |
| 2 | `subagent/claude-opus-5` | 30,228 | 15.6 % |
| 3 | `main/claude-fable-5` | 10,017 | 8.4 % |
| 4 | `subagent/claude-sonnet-5` | 8,507 | 4.8 % |
| 5 | `main/claude-opus-4-8` | 2,324 | 2.3 % |

Rolled up by bucket: **main 77.9 %**, **subagent 22.1 %**.

**The finding that matters for this roadmap, and it cuts against it.** The
subagent bucket is **22.1 %** of weighted input on this store, and the single
largest sink is the *orchestrator's own* main-bucket traffic at 66.3 %. A
per-role scoping manifest acts only on the 22.1 % — so even a hypothetical
perfect trim of every subagent payload is bounded by roughly a fifth of the
weighted input, before any quality cost. That is one machine's distribution and
generalises to nothing, but it is the first number anyone has attached to the
question, and it is an argument for the stop branch in § D rather than against
it.

## G — Phase 3 Step 3: the re-read measurement, before any suppression

New instrument: [`src/scripts/_lib/transcript_reads.ts`](../../../src/scripts/_lib/transcript_reads.ts).
A **leg** is one `.jsonl` file — one conversation with its own context window.
Legs are never joined: a file read once in the main leg and once inside a
subagent is **not** a re-read, because the second leg never held the first
one's context.

| Field | Value |
|---|---|
| read-shaped calls observed | **9,601** |
| duplicate reads (2nd..Nth **within** a leg) | **2,163** — **22.5 %** of all reads |
| distinct files re-read at least once in a leg | **889** |
| wasted tokens (**proxy**) | **3,077,169** |

**The wasted figure is a `chars / 4` proxy, never a measurement.** The
transcript records no per-tool-result token count, so the size of a duplicate
read is estimated from the JSON-encoded length of its `tool_result` body. The
field is named `wasted_tokens_proxy` in both the JSON and the text renderer so
the label cannot be dropped by taking the number alone.

**Top re-read sinks** (shape, not a naming-and-shaming list — the pattern is
what the suppression is built against):

| Rank | Shape | Reads | Dup | Wasted (proxy) |
|---|---|---:|---:|---:|
| 1 | a review-input `diff.patch` in a worktree | 44 | 40 | 128,158 |
| 2 | a large frontend `App.tsx` | 30 | 21 | 75,695 |
| 3 | a second review-input `diff.patch` | 19 | 16 | 69,949 |
| 4 | the same `App.tsx`, non-worktree path | 59 | 53 | 43,403 |
| 5 | a review-input `diff.patch` | 8 | 7 | 37,945 |

Four of the top five are **large single artefacts re-read inside one leg** —
review diffs and one big component file. That is the population the advisory in
§ H targets, and it is what the measurement was for: the suppression is aimed
at a measured pattern rather than at whatever the author happened to notice.

## H — Phase 3 Steps 4-5: the advisory rides the hot-context surface

**Step 4's path warning is real and was honoured.** The re-read suppression
landed in [`src/scripts/hot_context_hook.ts`](../../../src/scripts/hot_context_hook.ts)
— **not** under `src/scripts/hooks/`, which does not hold this file; an edit
written against that path would have changed nothing.

What landed: `_reread_lines()` plus a `## Re-Read Advisory` section in the
cache, populated from the leg's own transcript (`payload.transcript_path`, with
the defensive `transcriptPath` alias).

Both invariants Step 4 names are asserted, and each was **proved sensitive by
sabotage** — a test never seen red has unknown sensitivity:

| Invariant | How it holds | Sabotage that reds it |
|---|---|---|
| 400-word cap | The advisory is registered **last** in `trimOrder`, so it is the first section dropped when the cap bites. | Removing it from `trimOrder` → `expected … not to contain 'trimmed-away.ts'` |
| privacy floor **drops**, never rewrites | Every advisory line goes through `_redact_lines` → `redact_low_impact_entry`; a violating line is dropped whole and counted in the `Privacy floor: N line(s) dropped` stamp. | Bypassing `_redact_lines` → `expected … not to contain 'matze.b@galawork.de'` |
| paths never leak | Relativised to the workspace root; a path outside the root is dropped entirely rather than `../`-escaped. | Emitting `f.file_path` raw → two tests red |

**Two authoring defects this sabotage pass caught**, recorded because the
mechanism only exists because they were caught:

1. The first cap test was **insensitive**: `MAX_REREAD_LINES = 3` keeps three
   advisory lines under 400 words on its own, so the test passed with the
   advisory removed from `trimOrder` entirely. Replaced by a test that makes
   the cap actually bite and asserts *which* section went.
2. That replacement then **failed against correct code** on its first attempt:
   every record section is snippet-capped in *chars* (200/120/600), so 6-char
   filler words plateaued at ~385 words and the cap never bit. Single-character
   words fixed it, and the test now carries a precondition assertion so a
   future edit cannot silently return it to the never-bites state.

**Step 5 — advisory only, no refuse branch.** Verified by grep rather than
asserted: the only occurrence of the token `deny` in
`src/scripts/hot_context_hook.ts` is inside the doc comment stating there is no
such branch (`hot_context_hook.ts:176`); there is no `block`,
`permissionDecision`, `exit(2)` or `return 2` anywhere in the file, and `main()`
returns `0` on every path (`:442`, `:490`). A test asserts the write slot emits
an empty stdout, so the hook produces **no decision at all** on this surface.

## What this evidence does NOT establish

- **What a Task-spawned subagent actually receives.** Unanswered, by decision.
  No field or section inventory exists, and no trimmable fraction is published.
- **That scoping would save anything.** The 22.1 % subagent share bounds the
  ceiling of a perfect trim on one machine's store; it says nothing about what
  a real manifest would recover, and nothing about the quality cost the
  template's `+0.458, p=0.0135` discipline-lift figure warns about.
- **That the re-read advisory reduces tokens.** It emits three lines into a
  cache. Whether a later leg acts on them is unmeasured, and Step 5 deliberately
  forbids the mechanism that would force it.
- **Anything about a host other than `2.1.241 (Claude Code)`.** Only one host
  has native subagents (`src/scripts/condense.ts:2025-2026`); every figure here
  is single-host by construction.
