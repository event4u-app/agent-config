---
complexity: lightweight
status: ready
execution:
  mode: autonomous
---

# Roadmap: Council quota accounting truth

> Make the shared CLI-call budget say the truth: one cap source, an atomic
> counter, a reachable operator surface, and a booking record that names who
> spent it.

## Goal

Every number the CLI-call budget reports is the number the gate enforces, is
written without losing concurrent increments, and carries the consumer that
booked it — so an overrun is explainable instead of merely visible.

## Prerequisites

- [x] Live counter state read at authoring time (`~/.event4u/agent-config/cli-calls.json`).
- [x] Consumer set closed: exactly two files construct a `CliClient`
      (`src/scripts/council_cli.ts`, `src/scripts/ai_team/team_dispatch.ts`).
- [x] Cap value confirmed live, not inferred (`council quota` output below).

## Context

The trigger was an operator-visible failure: a council dispatch returned 0 of 2
seats, both `cli_quota_exhausted`, with counters displayed as `anthropic 72/50`
and `openai 99/50`. The originating analysis reached this repo without live-tree
access and proposed a concurrency race as the cause, plus four additive budget
workstreams.

Verification against the tree refuted the race and found a different, smaller,
fully-named set of defects. The counter is not primarily *overrun* — it is
**unattributable and reported from a different source than it is enforced
from**. Every phase below fixes a defect with a file:line, in ascending order of
blast radius.

Source: [`agents/tmp.old/council-quota`](../../tmp.old/council-quota) (see § Provenance).

### Verified evidence

All facts below were read from the tree or from a live zero-cost probe at
authoring time. No claim here is carried over unverified from the source.

| ID | Fact | Provenance |
|----|------|------------|
| F1 | One shared bucket: `cli-calls.json` at the user-global write target, keyed `provider → count`, scoped to the UTC day via a `date` field. | `src/scripts/ai_council/clients.ts:988,1011,1024,1060` |
| F2 | Cap is a **code-level default of 50 seeded for every known provider**, overridable per provider. It is per *day*, not per window or session. | `src/scripts/ai_council/config.ts:1936,1949-1951` |
| F3 | The gate is a single `used >= max` check at `ask()` entry; booking happens at three later sites, once per call. Concurrency inside one process can overshoot only by the in-flight count. | `src/scripts/ai_council/clients.ts:1413-1416,1485,1508,1532` |
| F4 | The overrun is live and affects providers the council does not even have enabled: `anthropic 72/50 · gemini 63/50 · openai 99/50 · perplexity 45/50 · xai 45/50`. | `council quota` output, authoring time |
| F5 | `record_cli_call` is a non-atomic cross-process read-modify-write (`load → +1 → writeFileSync`), with no lock and no temp-file rename. Concurrent writers **lose** increments, so true consumption is ≥ the displayed number. | `src/scripts/ai_council/clients.ts:1060-1071` |
| F6 | The bucket has **no attribution field**. Its entire schema is `{date, counts:{provider:n}}` — there is no consumer, workload class, or call-site dimension. | `src/scripts/ai_council/clients.ts:1060-1071` |
| F7 | Three config surfaces describe one budget, and the **reported** cap does not come from the **enforced** one: `cmd_quota` resolves caps from `.agent-settings.yml → ai_council.cli_call_budget.max_calls_per_day`, while the gate resolves them from `.ai-council.yml → cli_call_budget` via `_build_cli_call_budget`, and `ai_team` enforces its own third ceiling. | `src/scripts/council_cli.ts:3373-3375,891`; `src/scripts/ai_council/config.ts:1938-1980`; `src/scripts/ai_team/config.ts:80` |
| F8 | Exactly two files construct a `CliClient`, so the consumer set is closed and enumerable. | grep for `CliClient(` / `make_cli_client` across `src/` |
| F9 | The team-side quota report hardcodes `counts['openai']`, so it reports the wrong bucket for any non-openai team model. | `src/scripts/ai_team/team_dispatch.ts:552-555` |
| F10 | `quota_summary_line` filters to capped clients and returns an **empty string** when none resolve — the operator gets no warning in exactly the configuration where the bucket runs unguarded. | `src/scripts/ai_council/clients.ts:1114-1116` |
| F11 | The `quota` verb exists in `council_cli.ts` but `agent-config council:quota` reports `unknown command`; it is reachable only via `scripts-run`. The documented recovery path does not resolve. | `src/scripts/council_cli.ts:3371,3507`; live invocation |
| F12 | 171 calls are booked across five providers while both council seats report qualification `unknown` because *no exchange with this provider has ever been recorded*. The bucket therefore does not measure council usage. | `council:status` output, authoring time; `cli-calls.json` contents |
| F13 | Failed calls are booked **by explicit documented decision** (so a broken CLI cannot loop through the budget), except `file_not_found` where no process ran. | `src/scripts/ai_council/clients.ts` step-3 comment above line 1532 |
| F14 | Reset semantics are UTC-midnight rollover plus an explicit `quota --reset <provider> --confirm`. Waiting genuinely works. | `src/scripts/ai_council/clients.ts:1080-1098`; `src/scripts/council_cli.ts:3378-3387` |
| F15 | `cli_quota_exhausted` is returned both for the **internal** pre-spawn refusal and as the classification of **provider-side** stderr, so one string means two different things and the operator cannot tell which occurred. | `src/scripts/ai_council/clients.ts:1439,1601` |
| F16 | **The overrun was test pollution.** `stubCli` built CLI clients with no `cli_calls_path`; `ask()` books unconditionally, so every stubbed call spent one real call from the operator's user-global counter — **+36 per run of one test file**, against a cap of 50/provider/day. Found by the Phase 4 attribution sidecar on its first day. | measured live; `tests/scripts/ai_council/clients.test.ts` `stubCli`; see Phase 4 § F16 |

F12 is the finding that reorders the work. A reservation or partitioning scheme
cannot be implemented, benchmarked, or falsified against a bucket that records
no consumer — so attribution is a prerequisite, not a feature, and every
"reserve a council tranche" proposal is unbuildable until it lands.

### Gap table against the originating analysis

| Proposed item | Verdict | Reason |
|---|---|---|
| WS-0 measurement integrity | **KEEP, rewritten** | Real, but the mechanism is not a race. Becomes: one cap source, atomic write, attribution. |
| S-1 spike — "does the gate admit > cap under concurrent load?" | **CUT** | F3: gate-once, book-once per call, so concurrency overshoot is bounded by the in-flight count. The overrun needs an attribution field to explain, not a load test. Running the spike would measure a mechanism that is not the cause. |
| D1 candidate (c) — "failed calls booked accidentally" | **CUT** | F13: deliberate and documented, with a stated rationale. |
| D1 candidate (d) — "counter and gate read different state" | **KEEP, promoted to Phase 1** | F7: true for the *cap*, not the count. This is the confirmed defect and the source ranked it last. |
| WS-1 budget partitioning / council reserve | **FOLD into Phase 4** | F6: no attribution dimension exists, so a reserved tranche is neither implementable nor measurable today. Attribution first; the partition is then a config question rather than a mechanism. |
| WS-2 admission control — "`estimate` becomes a gate" | **FOLD, narrowed into Phase 2** | `estimate` models **USD** cost, not the call bucket. The correct surface is the pre-run summary that already exists (F10), given a call-budget dimension. |
| WS-3 class-fit telemetry | **FOLD, reduced** | The events log already carries an `action` taxonomy including `block_quota` plus a `gate_class` boolean. What is missing is a field, not a telemetry system. Reduced to the attribution field in Phase 4. |
| WS-4 batched questionnaires | **CUT** | F12: 171 bookings against 0 recorded exchanges means the cost driver is unattributed consumption, not question volume. Batching optimizes the wrong term and carries the highest risk in the set (blind-review contamination). |
| EV-6 — "cap *appears* to be 50" | **RESOLVED to fact** | F2 plus the live `council quota` output. No longer an inference. |
| "Does the interactive session share the pool?" | **RESOLVED: no** | F8: only two files construct a `CliClient`, and the host session is neither. |
| "How and when does the counter reset?" | **RESOLVED** | F14. |
| CUT list (auto-raise cap · retry-until-quota loops · verdict caching · agent analysis as council verdict · provider-side negotiation) | **KEEP verbatim** | All five remain correct. F15 sharpens the last one: the internal and provider-side cases are currently indistinguishable, which is a reporting defect rather than a reason to negotiate with providers. |

Work prevented by this verification pass: the S-1 concurrency spike, the
failed-call-booking investigation, the reset-semantics question, the
cap-configurability question, the shared-pool question, the entire WS-4 branch,
and the "build a telemetry system" framing of WS-3.

### Design decisions — own analysis, council unavailable

The council is configured with two seats and is **structurally unreachable at
authoring time**: every provider bucket is at or past its cap (F4), so a
dispatch is refused before spawning. The decisions below are therefore the
agent's own analysis, explicitly not a council verdict, with the reason named —
per `council-availability`. They are ordinary technical calls, each anchored to
a verified fact:

- **Cap source unification precedes everything** because a fix validated
  against the wrong number is not validated (F7).
- **Attribution lands last** because it is the only schema change in the set and
  therefore carries the largest test blast radius (F6).
- **No new configuration key is introduced.** Every phase reduces the number of
  surfaces describing this budget; adding a sixth would be self-defeating.

Once a bucket resets, the natural re-dispatch is the Phase 4 partitioning
question — it is the only genuinely contested design choice left, and it is
deliberately out of scope here.

## Phase 1 — One cap source

The reported cap and the enforced cap resolve from different files (F7). Until
that is one resolution, "exhausted" in the report and "refused" at the gate are
independent claims.

- [x] Trace both cap resolutions and record, in a comment at each site, which
      file each one reads. <!-- verify: grep -n "cli_call_budget" src/scripts/council_cli.ts src/scripts/ai_council/config.ts -->
- [x] Make `cmd_quota` resolve the cap through the same path the gate uses, so a
      single provider entry cannot report one number and enforce another. <!-- verify: npx vitest run tests/scripts/ai_council/council_cli.test.ts -->
- [x] Cover the divergence with a test that fails when the report and the gate
      disagree for one provider. <!-- verify: npx vitest run tests/scripts/ai_council/config.test.ts -->

**Landed as:** `resolve_cli_call_caps` in `src/scripts/ai_council/config.ts` — one
exported authority, consumed by all three call sites (`_build_cli_call_budget`,
`build_members`, `cmd_quota`). The strict builder now validates and then delegates
seeding rather than re-implementing it, so a fourth resolution path cannot be added
without deleting a test. The `cmd_quota` empty-caps branch is gone by construction:
the line it printed told the operator they were unguarded while the gate was
capping them.

**Exit criteria:** `npx vitest run tests/scripts/ai_council/council_cli.test.ts`
and `npx vitest run tests/scripts/ai_council/config.test.ts` both exit 0, and a
test exists that fails when report and gate diverge.

**Rollback:** revert the resolution change; the two paths return to independent
reads, which is the current state.

## Phase 2 — The operator surface is reachable and honest

Four independent reporting defects, each small and each currently able to
mislead the operator at exactly the moment they are debugging a budget failure.

- [x] Wire the `quota` verb into the `agent-config` dispatcher so the documented
      recovery path resolves (F11). <!-- verify: ./agent-config council:quota -->
- [x] Replace the hardcoded `counts['openai']` in the team quota snapshot with
      the provider actually derived from the configured team model (F9). <!-- verify: npx vitest run tests/scripts/ai_team -->
- [x] Make `quota_summary_line` emit an explicit uncapped statement instead of an
      empty string when no cap resolves, so silence never reads as "within
      budget" (F10). <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] Distinguish the internal pre-spawn refusal from the provider-side stderr
      classification, so `cli_quota_exhausted` no longer names two different
      events (F15). <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->

**Landed as:** `council:quota` in `_dispatch.bash` + `src/cli/registry.ts`, output
identical to the `scripts-run` path · `TeamReviewQuota.provider` read from
`client.name` (schema `team-review-status.json` updated: `provider` required, and
its `additionalProperties: false` is why the field could not be added silently) ·
`quota_summary_line` now treats **any number** as a cap so an explicit `0` is
reported instead of dropped, and names genuinely-uncapped members rather than
returning the empty string · `QUOTA_SOURCE_LOCAL_BUDGET` / `QUOTA_SOURCE_PROVIDER`
on `metadata.quota_source`.

**Two findings beyond the planned four.** A cap of `0` — the strictest setting
available — was being dropped by a Python-truthy filter, so the provider that
admits nothing reported nothing; that is the same defect class as F10 and is fixed
with it. And the team-side blocking message asserted "resets at UTC midnight"
unconditionally, which is true only of our own counter; it now branches on
`quota_source` instead of stating the wrong remedy for a vendor refusal.

**Noted, not fixed** (outside this roadmap's scope, no step opened): three further
`council_cli` verbs — `debate`, `replay`, `shadow-report` — exist in
`_SUBCOMMANDS` but are absent from both the dispatcher and the registry, so they
are unreachable via `agent-config` exactly as `quota` was. Same defect class, four
files, no evidence yet that anyone needs them from that entry point. Separately,
`_CLI_PROVIDERS` in `council_cli.ts` duplicates `_VALID_PROVIDERS` in `config.ts`
verbatim; they agree today, and nothing detects it if they stop.

**Exit criteria:** `./agent-config council:quota` exits 0 and prints the same
per-provider lines the `scripts-run` path prints; the three vitest files above
exit 0; an internal refusal and a provider-side refusal are distinguishable from
the returned response alone.

**Rollback:** each of the four is independently revertable; none depends on
another.

## Phase 3 — Atomic booking

The counter loses concurrent increments (F5), which means it under-reports. That
direction matters: every number in this roadmap is a floor, not a measurement.

- [x] Replace the read-modify-write in `record_cli_call` with a write that
      cannot interleave — write to a temp file in the same directory, then
      rename over the target. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] Add a test that fires concurrent bookings against a temporary state path
      and asserts no increment is lost. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->

**Landed as:** `_writeCliCallsAtomically` (same-directory temp + `renameSync`) and
`_withCliCallsLock` (bounded `O_EXCL` lock, stale-lock breaking, always proceeds
after ~1s rather than stalling a dispatch). Both `record_cli_call` and
`reset_cli_call_counts` route through them — the sibling search found the identical
write construct in exactly those two places and nowhere else in the tree.

**F5 was understated, and the correction is measured.** The usual reading is "the
counter loses increments". The sharper mechanism: `load_cli_call_counts` swallows a
`JSON.parse` failure and returns `{}`, so a reader landing mid-write sees **zero
calls used** and the gate admits everything until the next successful write — one
interleaved write can blank the budget rather than cost it one increment.

Measured against the pre-fix implementation, on this machine, with the lock
neutralised: **6 concurrent cross-process bookings recorded as 1.** Five of six
lost, and the surviving value was a *reset*, not a decrement. Two consequences
worth carrying forward: the live figures in the evidence table (anthropic 72,
gemini 63, openai 99) are **floors**, not measurements — true consumption was
higher, plausibly much higher; and this is a second, independent path by which the
displayed count could sit below a cap the gate was applying. n=1, one machine, one
filesystem — it establishes the direction and the mechanism, not a factor.

**Exit criteria:** the concurrency test exists and exits 0; the state file is
never observed truncated or partially written during the run.

**Rollback:** restore the direct `writeFileSync`; behaviour returns to
lossy-but-working.

## Phase 4 — Attribution

The bucket records `provider → count` and nothing else (F6), which is why 171
bookings against 0 recorded exchanges (F12) cannot be explained. This phase adds
the missing dimension and stops there — it deliberately does not add
partitioning, reservation, or admission control, because those are the decisions
attribution exists to inform.

- [x] Extend the booking record with a consumer dimension, so each increment
      names which of the two enumerated consumers (F8) booked it. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] Keep the reader backward-compatible: a state file written without the new
      dimension still loads and still gates correctly. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] Surface the attribution in the quota report so an overrun names its
      consumer. <!-- verify: ./agent-config council:quota -->
- [x] Update every test that asserts the old `{date, counts}` shape. <!-- verify: npx vitest run tests/scripts/ai_council -->
- [x] Record in this roadmap's evidence table what the attribution shows on the
      first real overrun after landing, or state plainly that no overrun has
      occurred yet.

**Landed as:** a sidecar at `<counter-path>.attribution.json` holding
`provider → consumer → count`, written under the Phase 3 lock and best-effort by
contract; `CLI_CONSUMER_COUNCIL` / `CLI_CONSUMER_TEAM` declared at the two
construction sites, `CLI_CONSUMER_UNKNOWN` as the default; `load_cli_call_attribution`
fail-soft; `council:quota` names the consumers per provider.

**Sidecar, not a new key in `cli-calls.json`** — a deviation from the step's
wording, taken deliberately and for three reasons: the gate reads that file and
Phase 3 had just made it trustworthy, so diagnostic data must not be able to
corrupt gating; a failed attribution write is swallowed while a failed counter
write is not; and it keeps the counter's on-disk shape unchanged, which preserved
the existing frozen byte-parity golden instead of retiring it as a side effect.
Own analysis — the council was quota-refused.

### F16 — the overrun was TEST POLLUTION. Attribution found it in minutes.

The last step asked what attribution shows on the first overrun. It answered
immediately, and it refutes the diagnosis this roadmap was built on — including
this roadmap's own F2/F7 framing of the mechanism.

Observed on landing: the live counters had **risen during this very session**
(anthropic 72 → 136, gemini 63 → 119, openai 99 → 187, xai 45 → 85,
perplexity 45 → 85), and every booking was attributed `unknown` — that is,
neither of the two enumerated consumers. The write timestamps matched the test
runs exactly.

Cause, measured: `stubCli` in `tests/scripts/ai_council/clients.test.ts`
constructed every CLI client **without** `cli_calls_path` and stubbed
`_runSubprocess` — but step 3 of `ask()` calls `_recordCallQuietly()`
unconditionally, which falls back to `_cliCallsStatePath()`, the developer's real
`~/.event4u/agent-config/cli-calls.json`. Every stubbed `ask()` spent one call
from the operator's live daily budget.

- **Measured before the fix:** one run of that single test file booked **+36**
  real calls (anthropic +8, openai +11, gemini +7, xai +5, perplexity +5).
- **Against the shipped cap of 50 per provider per day, two runs of one test file
  exhaust the council.** That is the entire reported symptom — 0 of 2 seats, both
  `cli_quota_exhausted`, counters far past the cap, and F12's 171 bookings with
  no council exchange ever recorded.
- **Fix:** one line — `stubCli` defaults `cli_calls_path` to a per-call temp file.
- **Verified:** the same file re-run books **+0**; the full `ai_council` +
  `ai_team` suite, **1017 tests, books +0**. The sibling search is therefore
  complete rather than sampled: one construct, one site, all callers covered.
- **Guarded:** a regression test asserts at the seam that `stubCli` never resolves
  to the user-global path, because a filesystem observation would pass on exactly
  the machine where the next regression would hide.

**What this retires.** The concurrency race (already CUT on F3) is doubly dead. The
F2/F7 "two ceilings, one bucket" story explains how a *reported* cap can differ
from an *enforced* one — a real defect, fixed in Phase 1 — but it is **not** what
drove the counters past 50; test pollution was. Phases 1–3 remain worth having on
their own terms (an honest report, an atomic counter, a reachable recovery
command), and none of them would have found this. **Attribution did, on its first
day.** That is the strongest available argument for the phase ordering this
roadmap chose, and it was luck of sequencing rather than foresight — the plan
expected to wait for a future overrun.

**Still open, deliberately.** Whether any *non-test* path also books
unattributed. Today's answer is no for the two enumerated consumers, but the
counter's pre-fix history is unattributable by construction, so the 136/187/119
standing figures cannot be decomposed retroactively. The next real overrun is now
self-explaining; this one is not.

**Exit criteria:** `npx vitest run tests/scripts/ai_council` exits 0; a legacy
state file without the consumer dimension loads and gates; the quota report
names a consumer per provider.

**Rollback:** the reader stays backward-compatible by construction, so reverting
the writer leaves existing state files readable.

## Acceptance Criteria

- [x] The cap a report prints is the cap the gate enforces, covered by a test
      that fails on divergence. <!-- verify: npx vitest run tests/scripts/ai_council/config.test.ts -->
- [x] `./agent-config council:quota` resolves and matches the `scripts-run`
      output. <!-- verify: ./agent-config council:quota -->
- [x] No configuration in which the budget is unguarded produces an empty
      warning. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] An internal quota refusal is distinguishable from a provider-side one. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] Concurrent bookings lose no increments, proven by a test. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] The booking record names its consumer, and a pre-attribution state file
      still loads and gates. <!-- verify: npx vitest run tests/scripts/ai_council/clients.test.ts -->
- [x] No new configuration key was introduced by any phase. <!-- verify: git diff -- src/config/agent-settings.template.yml src/server/schemas/settings.ts -->
- [x] The gap table's CUT rows are still CUT — no phase reintroduces the
      concurrency spike, batching, or a reservation mechanism.
- [x] The test suite books nothing into the operator's live counter (F16). <!-- verify: npx vitest run tests/scripts/ai_council tests/scripts/ai_team -->

**Evidence.** Both entry points byte-identical (`diff` clean). No diff in
`agent-settings.template.yml` or `settings.ts` — zero new keys. 1017 tests across
`ai_council` + `ai_team` green, and a before/after read of the live counter shows
a **+0** delta where it was +36.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The schema change breaks a wide test surface | implementation | `clients.ts` is a Python-mirrored module with extensive tests asserting the exact `{date, counts}` shape; a new dimension can red a large number of them at once. | Attribution is the last phase, behind three independently revertable ones; the reader stays backward-compatible by construction, so the blast radius is the writer and its assertions rather than the gate. | Phase 4 |
| 2 | Unifying the cap source changes an operator's effective cap silently | product | If the two surfaces currently resolve to different numbers for some provider, unification moves someone's live cap without them asking. | Phase 1 records both resolutions in a comment at each site before changing either, so the delta is visible in the diff rather than discovered at runtime; no new key is introduced, so the surviving surface is one the operator already configures. | Phase 1 |
| 3 | The overrun arithmetic is still not closed after all four phases | implementation | The phases make the counter trustworthy and attributable, but how 99 was reached against a gate at 50 is not itself explained by any of them. | Attribution is precisely the instrument that closes it, and Phase 4 ends with an explicit step to record what the first post-landing overrun shows — or to state that none occurred. The roadmap does not claim to have explained the arithmetic. | Phase 4 |
| 4 | Atomic-rename behaves differently across filesystems | implementation | Same-directory rename is atomic on the platforms this runs on, but a state path on a network mount is not guaranteed. | The temp file is created in the target's own directory rather than a system temp dir, which keeps the rename within one filesystem; the concurrency test asserts the invariant rather than the mechanism. | Phase 3 |
| 5 | Fixing reporting reduces pressure to fix consumption | product | An honest, attributed counter may make the underlying over-consumption feel addressed when nothing about consumption changed. | The goal sentence is scoped to accounting truth and says so; the gap table records partitioning as folded-pending-attribution rather than done, so the open decision stays visible. | Phase 4 |

## CUT — recorded to prevent re-litigation

| Item | Reason |
|------|--------|
| Concurrency spike against a low test cap | F3: the gate is checked once per call and books once; overshoot is bounded by in-flight count. The spike would measure a mechanism that is not the cause. |
| Investigating whether failed calls are booked | F13: deliberate, documented, with a stated rationale. |
| Batched council questionnaires | F12: the cost driver is unattributed consumption, not question volume. Highest-risk item in the set for the smallest verified benefit. |
| Auto-raising the cap on exhaustion | Removes the signal and converts a budget into a suggestion. Cap changes are explicit human decisions. |
| Retry-until-quota-returns loops | Burns the next window on a stale question; leaving the decision open is already the correct behaviour. |
| Substituting agent analysis for a council verdict | Already forbidden by `council-availability`; restated so it is never reintroduced as an optimization. |
| Cross-session council verdict caching | Verdict staleness against tree movement is unbounded. |
| Provider-side rate-limit negotiation or account rotation | The defect is internal accounting. F15 refines this: the internal and provider-side cases are currently indistinguishable, which Phase 2 fixes. |
| A new configuration key for any of the above | The budget already has three surfaces (F7); every phase reduces that count. |

## Provenance

Originating input: an external assistant ideation thread, handed over as an
inbox artifact together with the transcript that produced it. The artifact was
drafted **without live-tree access** and marked every repo-dependent claim as
requiring verification; this roadmap is the verification pass, and it refuted
the originating diagnosis while keeping the defect-first framing.

- Source thread: `ENC1:+v3SxQ0PArZASk9IAjlGZVtev5YNnMASJ62+w36OH1gIMNknroR2hv11DEIXn3YWCYA7+SFgmTQmXw4iV9G166it+X2p0UJVJ+pCFGdMv6dt6IfYFCjfpkaRvWWoz7U75M8T0zIOV05jQjf6r5IQE1otXTb8+TtiO2WY`
- Consumed artifact: [`agents/tmp.old/council-quota`](../../tmp.old/council-quota)
- Council convergence: none available. Both configured seats were
  quota-refused at authoring time (F4), so the design decisions above are the
  agent's own analysis with the unavailability named, per `council-availability`.
  The one genuinely contested choice — how the budget should be partitioned once
  attribution exists — is deliberately left out of scope and is the natural
  first re-dispatch when a bucket resets.
