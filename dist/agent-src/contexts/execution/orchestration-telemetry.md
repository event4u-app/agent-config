# Orchestration Telemetry

Per-dispatch orchestration metrics, recorded for every auto-dispatch the
orchestration layer performs. These ride as an **optional** `orchestration`
sub-object on the existing audit-log-v1 JSONL line — additive and
non-breaking. A line without an `orchestration` object is still a valid
audit-log-v1 line; readers that do not understand the field ignore it (per the
v1 forward-compat rule on unknown fields).

## Shape

```json
{
  "task_size_estimate": 0,
  "spawn_count": 0,
  "tiers": [],
  "token_delta": 0,
  "token_delta_provenance": "estimated",
  "wall_clock_ms": 0,
  "outcome": "DONE",
  "verify_mode": "deterministic",
  "verdict_changed_outcome": null,
  "task_class": null,
  "dispatch_mode": null,
  "tier_chosen": null,
  "tier_source": null,
  "dispatch_tokens": null,
  "session_tier": null,
  "escalated_from": null,
  "verify_result_by_tier": null,
  "first_pass_success": null,
  "escalated": null
}
```

## Field semantics

| Field | Type | Meaning |
|---|---|---|
| `task_size_estimate` | int | Pre-dispatch estimate of the task's size (the orchestrator's sizing heuristic). Counts only, no body. |
| `spawn_count` | int | Number of subagents dispatched for this task. `0` → handled in-session. |
| `empty_cycles` | int \| null | Trigger fires suppressed as duplicates since the last outcome record. Reported as its OWN quantity and never folded into a success rate's numerator or denominator: a duplicate is not an outcome, and it is also not nothing — a rising count is what an idle loop looks like from outside. `null` = not tracked by this producer, which is **not** the same as zero duplicates observed. Deduplication rule in `src/scripts/_lib/empty_cycles.ts`: same key AND inside the window, both conjuncts required. |
| `tiers` | string[] | Model tiers dispatched to, one entry per spawn class (e.g. `["sonnet","opus"]`). Tier names only, no prompts. |
| `token_delta` | int | Net token cost of the dispatch versus the in-session baseline. Positive = orchestration cost more; negative = saved tokens. Counts only. |
| `token_delta_provenance` | enum | `"measured"` when sourced from host-reported `usage` metadata (preferred); `"estimated"` when self-estimated from response length (mark always when host usage is unavailable). |
| `wall_clock_ms` | int | Wall-clock duration of the dispatch, milliseconds. |
| `outcome` | enum | One of `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` · `BLOCKED` · `killed`. |
| `verify_mode` | enum | How the dispatch's output was verified: `deterministic` · `judge` · `none`. |
| `verdict_changed_outcome` | bool \| null | **A3 extension (ADR-109 Track A).** For a review/verdict subagent (e.g. `production-validator`): did the subagent's verdict actually change the outcome versus the in-session baseline? `true` = it caught a real issue the baseline missed or flipped a false `READY`→`NOT READY`; `false` = same outcome as baseline (no lift); `null` = not a verdict dispatch / not measured. **Negative-control tasks (a clean single-file task) MUST record `false`** — a subagent that reports `true` on a control is producing spurious findings and fails Gate A. This is an additive field on THIS object, not a second schema. Counts/boolean only, no bodies. |
| `dispatch_mode` | enum \| null | **Form-gate extension (road-to-opt-subagent-harvest P2).** Which orchestration mode the deterministic form gate selected for this dispatch (`do-and-judge`, `do-and-judge-two-stage`, `do-in-steps`, `do-in-parallel`, `do-competitively`, `judge-with-debate`, `do-in-worktrees`, `do-with-live-app-judge`) or `none` (gate declined dispatch). Mode id only. `null` = pre-extension line. Makes the form-gate's value measurable inside the ADR-117 prove-or-drop window. |
| `task_class` | string \| null | **Routing extension (road-to-cost-aware-model-routing Phase 0).** Category id of the dispatched slice (e.g. `read-only-fanout`, `mechanical-edit`, `implementation`, `review-synthesis`). Enum-style id only, never free-form task text. `null` = pre-extension line / unclassified. |
| `tier_chosen` | string \| null | Tier the slice was dispatched on (`lite` \| `medium` \| `high`). `null` = pre-extension line. |
| `tier_source` | enum \| null | Where `tier_chosen` came from: `static` (frontmatter/category pin) · `inferred` (deterministic per-slice inference) · `inherit` (session tier — no downshift decision). Lets the evidence gate score inferred routing separately from static pinning. |
| `escalated_from` | string \| null | When the slice was re-dispatched after a verification failure: the tier of the FAILED attempt (e.g. `lite` when a lite return failed verify and the slice re-ran on `medium`). `null` = no escalation. |
| `verify_result_by_tier` | object \| null | Map of tier → verification result for every attempt of this slice (e.g. `{"lite":"fail","medium":"pass"}`). Values: `pass` \| `fail` \| `skipped`. Feeds the per-tier verify-pass-rate tripwire. Enums only, no verdict bodies. |
| `dispatch_tokens` | int \| null | **Cost-% extension.** Absolute tokens the dispatched slice consumed (measured subagent usage). Feeds the MODELED cost-% in `orchestration_savings_report`, which needs an absolute base the token-count delta lacks. `null` = not recorded. Counts only. |
| `session_tier` | string \| null | **Cost-% extension.** The orchestrator's OWN tier — the baseline the downshift cost-% measures `tier_chosen` against (a `high`→`lite` downshift is a rate win the token count can't see). `null` = not recorded. |
| `first_pass_success` | bool \| null | **QUALITY extension (council verdict: quality × cost paired).** `true` = the subagent return was adopted without parent rework; `false` = the parent had to rework the return before adopting. Precise rework definition: § Operationalization below. `null` = pre-extension line / not measured. Boolean only, no bodies. |
| `escalated` | bool \| null | **QUALITY extension (council verdict: quality × cost paired).** `true` = the slice was retried on a higher tier after a verification failure; `false` = no escalation. Semantics: § Operationalization below. `null` = pre-extension line / not measured. Boolean only, no bodies. |
| `init_tokens` | int \| null | **Lean-init extension (road-to-lean-agent-init Phase 3).** Spawn-payload tokens at worker init — the payload-truth measurement feeding the Phase-5 baseline gate (p95 < ~1,500 tokens/worker drops the L2/L3 bets). `null` = not measured. Counts only. |
| `payload_hash` | string \| null | **Lean-init extension.** 8–64-char hex digest of the spawn payload — prefix-stability / cache measurement. A hash can never smuggle content (privacy by construction). `null` = not measured. |
| `lookup_class` | enum \| null | **Lean-init extension.** Lookup class the L0 rung matched: `definition` · `references` · `string-existence` · `report-run`. `null` = not a lookup-shaped dispatch. |
| `route_taken` | enum \| null | **Lean-init + dispatch-economy extension.** `primitive` (deterministic primitive answered — no spawn) · `ask` (rung-0.5 single completion via `ask_transport`, no session) · `subagent` (escalated). With `lookup_class`, measures the tool-not-agent rung's hit rate. `primitive` and `ask` lines are the TWO recordable zero-spawn events (`spawn_count: 0`) — the routing decision itself is the datum the cost claim reads. |
| `budget_hit` | bool \| null | **Lean-init extension.** Worker hit its `max_tokens_per_worker` stop-loss (L0b) and returned the structured partial result. Feeds budget-seed refinement. `null` = not measured. |
| `correctness_match` | bool \| null | **Lean-init extension.** Golden/correctness comparison verdict for a primitive route (primitive answer ≡ agent answer). Populated only when a comparison arm actually ran (bench/golden mode); on real zero-spawn primitive routes there is no agent answer to compare against, so `null` is the NORMAL field value — never read `null` as "unchecked = suspicious". |
| `cache_hit` | bool \| null | **Lean-init extension (Phase 4 prefix stability).** Provider-reported prompt-cache hit on the spawn payload. Measurement only — no savings claim without provider-response evidence. `null` = not measured. |
| `origin` | string \| null | **Lean-init extension (council Q5 segregation).** Id-shaped sample tag (`lean-init-2026`) keeping lean-init efficiency lines cleanly separable from the `road-to-orchestration-scope-decision` sample. `null` = untagged line. Never free-form. |
| `rules_carried` | int \| null | **Lean-init extension (L6 demand signal).** Rules in the worker's scoped projection — the carried set. With `rules_used`, yields the per-worker rule-usage quota the parked `later/road-to-deferred-rule-retriever` resume condition asks for ("are worker rules actually carried unused?"). `null` = not measured. Counts only. |
| `rules_used` | int \| null | **Lean-init extension (L6 demand signal).** Rules the worker actually applied/cited. Validation: never exceeds `rules_carried`. `null` = not measured. Counts only. |
| `work_tokens` | int \| null | **Dispatch-economy extension.** Tokens the worker consumed AFTER init — the delta from first worker turn to envelope close. With `init_tokens`, yields the `dispatch_floor` ratio (`src/config/dispatch-economy-metrics.json`). Sourced from the transcript ledger (`_lib/cc_transcript.ts` `billable_input` semantics) by the report/backfill, never model-estimated without the tag below. `null` = not measured. |
| `floor_provenance` | enum \| null | **Dispatch-economy extension.** Provenance of the `init_tokens`/`work_tokens` pair: `measured` (transcript ledger) · `estimated`. Auto-defaults to `estimated` when either field is present untagged — mirrors `token_delta_provenance`. `null` = neither field present. |
| `model_requested` | string \| null | **Served-model-truth extension (`inbox-harvest-2026-08-b-ledger-truth` Phase 1).** The model id that was ASKED for — the id `tier_chosen`, `tier_source`, `session_tier` and the downshift cost-% are all derived from. `null` = not recorded. Id only, never free-form. |
| `model_served` | string \| null | **Served-model-truth extension.** The model id the provider reported ANSWERING with. `''`/`null` when the transport reports none (every CLI client) — absent is the honest value, not a defect. Attribution only: never route or tier on it. |
| `model_divergent` | bool \| null | **Served-model-truth extension.** DERIVED, never supplied: `true` when both ids are present and differ (an alias or provider substitution — every tier-derived figure on this line attributes to a model that never ran), `false` when both are present and match. `null` when either is absent, because a comparison that never happened must not read as "checked, and they matched". |
| `return_channel_chars` | int \| null | **Dispatch-economy extension (Phase 6.3).** Serialized chars of the tool result returned into the orchestrator context (sync completions, hook-derived count — content never enters the record). Detector for "isolation win refunded through the return channel"; committed cap: `MAX_ENVELOPE_CHARS` (12,000) via `return_channel` in `dispatch-economy-metrics.json`. `null` = async ack. |

These routing + cost fields are additive and optional — a line without them is
still a valid orchestration line; readers ignore unknown fields per the v1
forward-compat rule.

## Operationalization — `first_pass_success` / `escalated` (definitions, no schema change)

The two quality booleans are only comparable across sessions when "parent
rework" means the same thing everywhere. The mechanical decision table:

```
first_pass_success = TRUE iff the parent adopts the subagent work product
with NO scope-relevant modification and issues NO corrective follow-up
prompt to the same subagent within the same task scope.

EXCLUDED from "modification" (still TRUE):
  - auto-formatter output (prettier / eslint --fix / pint --fix)
  - import sorting
  - lockfile regeneration
  - whitespace-only diffs

INCLUDED as rework (FALSE):
  - any business-logic line diff to the returned work product
  - added or changed tests
  - changed API contract / signature
  - manual conflict resolution
  - architectural restructuring of the returned diff

escalated = TRUE iff the parent re-dispatched the same slice to a higher
tier after a verification failure. A mechanism metric, not a quality
verdict — it records that the escalation path fired, not how good the
final output was.
```

**Honest boundary:** both fields are machine-observable proxies from the
orchestrator's own actions; they do NOT measure output quality directly. An
adopted-without-rework return can still be mediocre; a rejected return can
have failed on a formality. Field extensions (`verification_passed`,
`parent_rework_level`, `regression_detected`, `task_completed`,
`judge_confidence`, `human_rejected`) are explicitly NOT added: five of the
six are unobservable without new infrastructure (verification harness, diff
classifier, judge step, human feedback loop) and would breach the counts-only
privacy floor or record guesses. Revisit-if: a verification harness exists
that makes a candidate field machine-observable without content inspection.
The two-field cap is a council decision (2026-07-10); this section
operationalizes it rather than widening it.

## Privacy floor

Counts and ids only — **no bodies**. This preserves the audit-log-v1 privacy
floor: no prompts, no conversation snippets, no subagent output, no secrets.
`tiers` carries tier names, never model prompts or completions.

## Example line

One JSON object per line, UTF-8, no trailing whitespace. The `orchestration`
object is an additive extension on an otherwise standard audit-log-v1 line:

```json
{"schema_version":1,"id":"01HXY...","ts":"2026-06-23T12:34:56Z","work_id":"PROJ-7-2026-06-23T12-30-00Z","phase":"implement","outcome":"success","confidence_band":"high","risk_class":"low","memory":{"asks":2,"hits":1},"verify":{"claims":1,"first_try_passes":1},"rules_applied":["verify-before-complete"],"persona":"backend","input_kind":"orchestration","type":"phase","orchestration":{"task_size_estimate":3,"spawn_count":2,"tiers":["sonnet","opus"],"token_delta":4200,"wall_clock_ms":18500,"outcome":"DONE","verify_mode":"deterministic"}}
```

## Emit procedure (how the orchestrating agent writes telemetry)

After every auto-dispatched orchestration run, the orchestrating agent writes one
telemetry line to `agents/runtime/state/audit/YYYY-MM.jsonl` (the existing
audit-log-v1 path, where `YYYY-MM` is the current UTC month). The line is a
standard audit-log-v1 object with `input_kind: "orchestration"` and an
`orchestration` sub-object carrying this shape.

**No hook or daemon required.** The agent writes the line directly — the
no-runtime-compatible capture path (decided 2026-06-30, maintainer decision;
see `road-to-subagent-value-realization.md § Council notes`). Do NOT
hand-author the JSON: run the recorder, which validates the inputs and builds a
conformant audit-log-v1 line from the counts you already have:

```bash
./scripts-run src/scripts/orchestration_record --spawn-count <n> \
  --token-delta <±n> --provenance measured|estimated \
  [--tier-chosen lite|medium|high] [--tier-source static|inferred|inherit] \
  [--task-class <id>] [--tiers a,b] [--dispatch-outcome DONE|BLOCKED|…] \
  [--first-pass-success true|false] [--escalated true|false]
```

A capture **hook** is now the primary path where the host has a
`post_tool_use` slot: the 2026-08-07 transcript backfill measured that
SYNCHRONOUS dispatch results DO carry `resolvedModel` / `totalTokens` /
`usage` — the 2026-06-30 "payload carries no usage" premise held only for
async dispatches, which stay metrics-absent. The `orchestration-record`
concern (`src/scripts/hooks/orchestration_record_hook.ts`, registered in
`hook_manifest.yaml`) emits the line deterministically on every Agent/Task
completion; measured model-carried capture before it existed was 1 of 370
dispatches (0.27 %). The CLI above stays for hosts without the slot and for
orchestrator-side records the hook cannot see. Reader:
`src/scripts/orchestration_savings_report.ts`.

**`token_delta` sourcing priority:**
1. Host-reported: read `usage.output_tokens` (and `usage.input_tokens` if
   available) from the response metadata of each subagent call. Use the sum
   minus the estimated single-agent baseline. Set `token_delta_provenance:
   "measured"`.
2. Self-estimate fallback: if host usage metadata is unavailable, estimate from
   response length (chars / 4 ≈ tokens). Set `token_delta_provenance:
   "estimated"`. This estimate is lossy; measured is always preferred.

## Savings report

Aggregate the accumulated telemetry into a token-savings report:

```bash
./scripts-run src/scripts/orchestration_savings_report [--dir <path>] [--format text|json]
```

It sums `token_delta` across dispatches (negative = net saved) and splits by
provenance (measured vs estimated), `tier_chosen`, and `task_class`. **Quality
and cost render as PAIRED columns** (council verdict — never savings alone):
`first_pass_success_rate` and `escalation_rate` aggregate over the lines that
carry the quality booleans (per the § Operationalization definitions above); with ≥ 20 such lines in the window the real rates
render beside the savings figures, below 20 the quality columns render as
`n/a (n=<count>)`. It reports
**ABSOLUTE net tokens saved, never a percentage**: the telemetry records net
delta, not the absolute in-session baseline, so a "% of session saved" is not
derivable from this data. A percentage would require an additive
absolute-baseline field on this object (deferred follow-up). Reader:
[`src/scripts/_lib/orchestration_savings.ts`](../../../../src/scripts/_lib/orchestration_savings.ts).

## Payload-hash drift report (`payload_hash` × `cache_hit`)

Join the two fields into a stable/unstable prefix-stability cohort split:

```bash
./scripts-run src/scripts/orchestration_payload_hash_drift [--dir <path>] [--format text|json]
```

Reader: [`src/scripts/_lib/payload_hash_drift.ts`](../../../../src/scripts/_lib/payload_hash_drift.ts).
Zero recorded lines carrying both fields is the current expected state — both
are lean-init extensions with no caller wiring a real value into them yet;
the report says so rather than presenting empty input as a pass.

**Refusal (report, never act).** `cache_hit` is a provider-reported proxy for
HOST-controlled cache behaviour — this package causes the dispatch but does
not control whether the host reports a hit. Per
[`ADR-118`](../../../../docs/decisions/ADR-118-loop-engineering-boundaries.md)
§1 (a measure→adjust loop is automated only when it is a *direct* measure of
the failure mode, the false-positive rate is low, and human judgement adds no
unique information), a host-controlled proxy fails the direct-measure
condition outright. No consumer of `payload_hash` or `cache_hit` may wire a
measure→adjust step off them — no default flip, no tier change, no dispatch
throttle. They are read-only diagnostic fields.

## Registered always-on metrics and kill criteria (pre-registered 2026-08-09)

The always-on orchestration doctrine fixes "the stack is always available"
and moves falsifiability into its TRIGGERS. Registered before any behaviour
data existed, so later readings cannot be fitted to a desired outcome:

| Metric | Source | Kill/tighten criterion (per layer, applied by evidence-bearing PR, never a settings flag) |
|---|---|---|
| Dispatch rate per delegable verdict | `orchestration_record` vs nudge/ladder verdict lines | A layer whose verdicts are measurably ignored gets its trigger set tightened or the injected line removed |
| Judgment-ladder precision (verdict vs what the session did) | ladder verdict telemetry joined with dispatch/team records | A rung below registered precision at review gets its signal set tightened; a rung nobody hits gets removed |
| Council fire rate + unactioned-verdict rate | pass artifacts + handoff adoption | Unactioned-verdict rate is the kill criterion for any auto-fire trigger |
| Per-session quota burn per provider | transport/attendance records | Sustained quota exhaustion tightens `cli_call_budget` defaults, never re-introduces an activation gate |
| Metered-fallback spend | billing-classified transport records | Target trends to ~0 on CLI hosts; a rising trend is a transport-resolution defect to fix, not a reason to disable |

Review discipline: each criterion is evaluated against an accumulation
window (the gated blockers name their own windows); a reading below the bar
removes or tightens THE TRIGGER, and the removal PR cites the numbers.

## Related

- [`audit-log-v1`](../../../../docs/contracts/audit-log-v1.md) — the frozen
  JSONL contract this object rides on; the `orchestration` field is optional
  and additive, schema_version unchanged.
- [`host-capability-manifest`](host-capability-manifest.md) — the manifest that
  decides whether a dispatch is even attempted; `spawn_count` and `tiers`
  reflect what it enabled.
