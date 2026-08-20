---
complexity: lightweight
---

# Stub: road to task-completion observability

> **Stub — not active work.** One stub serving **two** roadmaps. Transferred out
> of [`road-to-orchestration-scope-decision.md`](../road-to-orchestration-scope-decision.md)
> and [`road-to-subagent-value-realization-followup.md`](../road-to-subagent-value-realization-followup.md)
> on 2026-08-20 by the drain-run disposition framework
> [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (disposition **B** — outcome `transferred`), which found
> `real-orchestration-usage` and `telemetry-sample-size` to be **one evidence
> gap wearing two names** and merged them into a single shared stub.
>
> Nothing here was rejected on merit and nothing is half-shipped. The build work
> both roadmaps needed is done; what is missing is an observation only a live
> host session can produce.
>
> **The line count is satisfied and is no longer the gate.** It was 99 when
> both blockers were written, 367 on 2026-08-17, and **570** at transfer — and
> the blockers never stopped being open. Both resolution criteria were rewritten
> off the count and onto the quality columns for exactly that reason.

## Resolved-when criterion — verbatim, and identical for both parents

Quoted from `real-orchestration-usage` (as rewritten 2026-08-17) and from
`telemetry-sample-size` (as rewritten 2026-08-16). The two are the same
sentence, which is the council's ground for merging them:

> **Resolved when:** a probe result records whether any hook slot sees the
> task-completion payload, and — if one does — the current-month audit log
> carries ≥ 20 orchestration lines whose **quality** columns are populated
> rather than `null`.

The council's own restatement of the same criterion, verbatim from the
disposition framework:

> **For B** — Original criterion for both: "a probe result records whether any
> hook slot sees the task-completion payload, and — if one does — the current-month
> audit log carries ≥20 orchestration lines whose quality columns are populated
> rather than `null`." Move Phase 1 telemetry seeding, Phase 2 evaluation, and
> Phase 3's dependent decision.

## The probe HAS been run, and it split the criterion in three

Full measurement:
[`agents/evidence/analysis/orchestration-task-completion-payload-probe.md`](../../evidence/analysis/orchestration-task-completion-payload-probe.md)
(2026-08-20, host `2.1.237`, `caa046343`). Recorded here because it changes what
this stub is waiting for — the first clause of the criterion is **partly
answered**, and the second is **structurally unreachable by the first**.

| Field group | Verdict | Basis |
|---|---|---|
| `dispatch_tokens`, `wall_clock_ms`, `tiers` — **sync** completion | **Seen by a hook today, and already read** | `orchestration_record_hook.ts:120`, `:193-199`; 8/8 agent-shaped transcript results carry `usage`; 40 of 570 audit rows numeric |
| Same — **background** dispatch | **Candidate slot named, unverified** | `subagent_stop` is bound (`hook_manifest.yaml:926`, `:967`); `transcript_path` present in the binary string table (exact-token count 1); no capture has confirmed it arrives on that slot's stdin |
| `first_pass_success`, `escalated` — the **quality** columns | **NOT payload-derivable at ANY slot, by construction** | `orchestration-telemetry.md:86-107` defines both over the parent's *subsequent* rework / re-dispatch — events that have not happened at task completion. `grep -rE 'first_pass_success\|escalated' src/scripts/hooks/` returns nothing |

**Read the third row before treating this stub as "waiting for a probe".** Even a
fully successful `SubagentStop` payload capture fills the cost and latency
columns for background dispatches and leaves the quality columns exactly as
`null` as they are today. The criterion's two clauses are therefore not one
chain: clause 1 has a live-host path, clause 2 does not have a hook path at all.
Its only producers are the model-carried `orchestration_record` emit step
(measured capture rate before the hook existed: 1 of 370) or new infrastructure
the telemetry contract explicitly declines to add
(`orchestration-telemetry.md:109-120`, the two-field cap and its
`Revisit-if: a verification harness exists`).

## Re-entry producer and detection probes

Promotion is not "when someone builds it". The producer is named, and each
precondition carries a probe a reader can run today and get a decidable answer
from. **P1 and P2 must both pass** — P1 alone fills cost, not quality.

| # | Precondition | Producer — who or what makes it true | Detection probe | Measured 2026-08-20 |
|---|---|---|---|---|
| P1 | A named live-host task-completion probe establishes the observable slot for a **background** dispatch | **Subagent-observability maintainer**, running the capture with `AGENT_HOOK_CAPTURE_DIR` set in the host's own hook environment (`dispatch_hook.ts:578` — instrument shipped, env is not a repository act) | A capture file under the capture dir with `native_event: SubagentStop` whose `raw_payload` carries `transcript_path`, **and** the transcript entry it points at carrying a `toolUseResult` with `usage` / `totalTokens` | **FAIL** — zero captures exist; the 3410 observed `subagent_stop` records read no usage field because `subagent_ledger_hook` never looks for one |
| P2 | ≥ 20 same-epoch orchestration lines with populated quality columns | **Subagent-observability maintainer** — either running `orchestration_record --first-pass-success/--escalated` reliably per dispatch, or landing the verification harness the two-field cap's `Revisit-if` names. **No hook can supply this**, per the probe's third row | `first_pass_success`, `escalated` and `task_class` all non-null on ≥ 20 rows of one `agents/runtime/state/audit/YYYY-MM.jsonl` | **FAIL** — 0 of 570 on all three in `2026-08`; the entire quality corpus is **one** hand-emitted July line |
| P3 | A population for the parallel arm of the pre-registered claim | Real fan-out dispatches — `spawn_count ≥ 2` | `spawn_count ≥ 2` on ≥ 1 row of the current-month audit log | **FAIL** — 0 of 570 (`1` in 569, `0` in 1); across 570 recorded dispatches the corpus has never produced a fan-out |

P3 is listed because it blocks the claim independently of the columns: the
pre-registered claim is scoped to `orch-02` + `orch-03` against a single-agent
baseline, and a corpus with no fan-out cannot speak to it whatever the columns
say. It was not part of either blocker's stated criterion; it is added here as a
measured precondition rather than left to surface later.

## Transferred work — the complete list, quoted as it stood

### From `road-to-orchestration-scope-decision.md` (closed 2026-08-20, all `[-]`)

Prerequisite:

- "≥20 real orchestration audit lines (parent followup Phase 1)."

Phase 2 — Accumulate real telemetry:

- "Run real delegable work with `subagents.enabled: true` under the
  post-ADR-117 default (`subagents.auto: on`) until
  `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥20 orchestration lines
  (parent followup Phase 1, Steps 1–3)."

Phase 3 — Gate the claim: prove or drop:

- "Feed the accumulated real telemetry through `gateVerdict()` /
  `resolveShippedDefault()`. PROVE = the pre-registered claim clears its
  threshold at held quality AND the negative control stayed quiet."
- "PROVE → mark the CLAIMS entry `backed` with a resolving pointer; the ADR-117
  `on` default is thereby CONFIRMED for the proven family (the bounded-downside
  basis upgrades to evidence); update the flip verdict."
- "DROP → record the renewed honest null; demote the default back to `ask` via
  ADR-117's retained demotion gate; **and** demote the orchestration surface
  from the public value proposition: README/site stop listing orchestration as a
  capability and instead state the honest stance — 'contract exists, default
  off, value not established; we do not ship unproven orchestration.' The
  contract stays internal."

Phase 4 — Position the minimalism (its own gate reads "only after Phase 3
resolves", so it travels with Phase 3):

- "Write `docs/orchestration-stance.md`: whichever way Phase 3 went, state the <!-- ref-ignore -->
  category contrast honestly — agent-config offers evidence-gated minimal
  dispatch (or none), explicitly not a swarm platform; each claim binds to a
  resolvable pointer, the category is described only by what is publicly
  observable, never a named competitor."
- "Add the `docs/proof.md` § 4 row: 'orchestration value is measured before
  default-on (or absent), not asserted.'"

Two carried caveats, both stated in the parent and neither resolved by this
transfer. The **DROP** step's first clause is **premise-stale**: there is no
`subagents.auto` key left to demote — always-on orchestration deleted it from
the template, the schema and the production path, leaving
`emergency.orchestration_halt` as the only switch. Its second clause, and both
Phase 4 steps, are **maintainer-owned**: they change what the package publicly
claims, which is decide-what-ships. And the Phase-4 `docs/proof.md` row cannot be
added as worded — "measured before default-on" is contradicted by the shipped
always-on default, so writing it would publish a false claim. Re-cutting that
sentence is a maintainer decision.

### From `road-to-subagent-value-realization-followup.md` (NOT closed here)

Quoted so this stub is complete for both parents. **That roadmap's checkboxes
are owned by a separate agent and were not touched by this transfer** — writing
the shared stub so it can point here is in scope; closing it is not.

Phase 1 — Seed real telemetry:

- **Step 2:** "Run the full delegable-task corpus (`orch-01`, `orch-02`,
  `orch-03`) under both arms (`agent-settings.orchestrated.yml` and
  `agent-settings.baseline.yml`) across enough sessions to reach ≥ 20
  orchestrated dispatches."

Phase 1 exit criteria, carried because the quality requirement lives there
rather than in the step:

- "≥ 20 orchestration lines in the audit log; `/cost:report` surfaces a
  non-empty orchestration summary; classifier recall recorded. The ≥ 20-dispatch
  measurement must include the `first_pass_success` / `escalated` quality
  columns (per road-to-proof-under-real-conditions Phase 4 — cost and quality
  reported as a pair, never savings alone)."

Its Phase 2 (confirm or demote the ADR-117 `auto: on` default) inherits the same
gap. Steps 1 and 3 of its Phase 1 are already `[x]` and are **not** transferred.

That roadmap's Step 2 carries its own independent staleness, recorded there and
repeated here so a promoter does not rediscover it: the "both arms" contrast is
expressed through `subagents.enabled` / `subagents.auto`, and both keys were
deleted, so the arms name a comparison the tree can no longer make.
`emergency.orchestration_halt` is the only remaining suppressor and using it as
an experimental arm would make the baseline indistinguishable from an incident —
recorded as an option to reject, not a plan.

## Baseline at transfer — so a later reader can tell movement from noise

`agents/runtime/state/audit/` (gitignored host state), measured 2026-08-20:

| | 2026-07 | 2026-08 |
|---|---:|---:|
| orchestration lines | 1 | **570** |
| `first_pass_success` / `escalated` / `task_class` non-null | 1 | **0** |
| `dispatch_tokens` numeric | 0 | **40** |
| `wall_clock_ms` numeric | 1 | 570 |
| `token_delta_provenance: measured` | 1 | **0** (`estimated` 570) |
| `spawn_count ≥ 2` | 1 (=3) | **0** |

`orchestration_savings_report` over the same corpus:
`dispatches: 570`, `first_pass_success_rate: n/a (n=1)`,
`escalation_rate: n/a (n=1)`, `measured share: 0%`, `MODELED cost reduction:
n/a`. The whole net figure is the single July line, and it reports tokens
**added** — neither PROVE nor DROP under the pre-registered thresholds.

The corpus grew 367 → 570 orchestration lines between 2026-08-17 and the
transfer date and **not one field verdict moved**. That is the movement test:
another few hundred lines is noise, a single row with three non-null quality
columns is signal.

## Seed content on promotion

- P1 first and alone: capture the `SubagentStop` payload, publish what it
  carries, and only then decide whether `subagent_stop` becomes a second
  telemetry writer. Do not widen `subagent_ledger_hook` speculatively — it is a
  capture-only instrument whose measurement window must stay uncontaminated.
- Do **not** attempt the quality columns from a hook. The probe's third row is
  definitional; a hook that wrote them would be writing a guess about events
  that have not occurred. Either make the model-carried emit reliable or build
  the verification harness the two-field cap names.
- `task_class` is the one genuinely buildable column (`tool_input` is readable at
  `orchestration_record_hook.ts:107`), and it is deliberately **not** seeded here:
  a second classification site could drift from the `user_prompt_submit` one and
  the corpus it feeds is meant to compare like with like. Decide it explicitly.
- Fan-out (P3) before either roadmap's claim is re-read. A verdict on a corpus
  of 570 single-spawn dispatches is a verdict about no fan-out at all.

## What does NOT apply to this stub

The **Promotion criteria (shared)** in [`README.md`](README.md) — recruited
customer, funded security audit, maintainer ADR lifting a Hard-Floor item —
govern the six org-mode stubs. They do not govern this one: it introduces no
product surface, needs no customer, and crosses no Hard Floor. Its gates are
P1-P3 above and nothing else. Promote per item, not per file.
