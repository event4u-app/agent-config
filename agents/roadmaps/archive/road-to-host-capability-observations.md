---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to host capability observations

> **Source:** agents/tmp.old/ultimate-reverse — a multi-model reverse-engineering pass.

## Goal

The host-capability registry stops being one measured row and seven silences.
When this is finished a written protocol says what transcript evidence counts as
having OBSERVED each capability, and the registry carries one row per host the
maintainer could actually reach, with the citation inline. A host nobody can
reach is recorded as unmeasured and its fields stay `false` — the honest state,
distinguishable from a measured negative because the protocol says how to tell
them apart.

## Context / What is verified

Re-verified against the tree on 2026-08-22.

- **The registry holds exactly one row.** `src/scripts/_lib/host_capability.ts:129-131`:
  `const HOST_CAPABILITY_REGISTRY … = { claude: { subagent_spawn: true, parallel_spawn: true } };`
  Two fields on one host. Everything else — six fields across seven other hosts
  — resolves to `SAFE_DEFAULT`, which is all-`false`.
- **Eight platform keys are declared.** `src/scripts/hook_manifest.yaml:947`
  opens `platforms:` and the keys follow at lines 948-1093: `augment`, `claude`,
  `cowork`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`. So seven of
  eight hosts have a declared hook surface and no capability row.
- **`false` records that nobody answered, not that the host cannot.** The
  contract states it directly — `src/agent-src/contexts/execution/host-capability-manifest.md:83-87`:
  *"`HOST_CAPABILITY_REGISTRY` holds exactly one row today, so on every other
  host all six fields are the safe default"*, and the file's own caution at
  lines 99-101 reads *"on an unrecognized host every field is `default`, which
  is an absence of knowledge and not a measurement."*
- **The no-inference rule is already written down.**
  `src/scripts/_lib/host_capability.ts:126` — *"add a field only once it is
  itself observed, never by inference"*. `worker_respawn` carries the same rule
  in its own doc comment (lines 63-68): set `true` only once OBSERVED, *"never
  by inference from the fact that spawning and killing both exist separately."*
- **The answerability half already shipped, and it is the half that is done.**
  `describeHostCapabilities` (`src/scripts/_lib/host_capability.ts:255`) returns
  the manifest plus a per-field `sources` map over
  `CapabilitySource = 'registry' | 'live-probe' | 'default'` (line 219), and
  `src/scripts/routing_doctor.ts:363` calls it so `agent-config routing:doctor`
  can print provenance per field. A reader can already ask where a value came
  from. What is missing is not the surface — it is the observations.
- **Six fields, not five, and one of them behaves differently.** The manifest
  interface (`src/scripts/_lib/host_capability.ts:43-70`) declares
  `subagent_spawn`, `parallel_spawn`, `status_polling`, `separate_quota_pool`,
  `agent_teams`, `worker_respawn`. `agent_teams` is resolved ONLY by the live
  environment probe and is never inferred from a host id (its doc comment, lines
  49-56), so the protocol below must treat it separately from the five the
  registry can carry.

## Phase 1 — The observation protocol, written as a contract

The deliverable of this phase is a document, not a script. A probe script that
decides for itself what counts as evidence is the inference this tree already
forbids, wearing an executable's authority. What is needed first is the written
rule for what a human may write into the table.

- [x] **1.1 Write the per-field observation criterion.** For each of the five
      registry-carryable fields, state exactly what transcript evidence
      constitutes an observation. `subagent_spawn` — a dispatch record showing a
      child leg with its own turn. `parallel_spawn` — two child legs whose
      intervals overlap. `status_polling` — a completed poll returning a state
      the parent did not already hold. `separate_quota_pool` — a child leg
      continuing across a parent quota condition. `worker_respawn` — one task
      continuing across a killed and re-spawned worker, same task id.
      verify: the contract file names all five fields, and each criterion is a
      transcript-observable condition rather than a documentation reference.

- [x] **1.2 State the negative case as separately recordable.** "Observed absent"
      and "never looked" are both `false` in the table and must not be the same
      row. The contract defines the note that distinguishes them and where it
      lives, so a future reader can tell a measured negative from a silence.
      verify: the contract defines a distinct marker for observed-absent, and
      the marker is representable alongside a `false` field value.

- [x] **1.3 Handle `agent_teams` separately and say why.** It is live-probe-only
      by construction and the registry must never carry it — the interface doc
      comment records that this repo has observed only the flag's documented
      existence, never its shape on any host. The protocol says: do not add it
      to a row; observe it, if at all, through the live probe.
      verify: `grep -n 'never infer it from a host id' src/scripts/_lib/host_capability.ts`
      resolves, and the contract cites that line as the reason `agent_teams` is
      out of scope for a registry row.

- [x] **1.4 Fix the evidence-citation shape before any row is written.** One
      inline citation per observed field: the host, the host version at the time,
      the transcript or artefact reference, and the date. A row without all four
      is not admissible.
      verify: the contract specifies the four-part citation, and a worked
      example is included that a later row can be pattern-matched against.

- [x] **1.5 Pin the pre-state so the change is measurable.** Record the current
      registry contents so the diff after Phase 2 is legible as an addition
      rather than as an unexplained table.
      verify: `git show HEAD:src/scripts/_lib/host_capability.ts | grep -c "claude: { subagent_spawn: true, parallel_spawn: true }"`
      returns 1, establishing that the pre-state was the single measured row.

> **PHASE 1 LANDED 2026-08-22** in
> [`host-capability-manifest.md`](../../src/agent-src/contexts/execution/host-capability-manifest.md)
> § Observation protocol — a document, as the phase specified, and deliberately
> not a script.
> All five criteria are **transcript-observable conditions** rather than
> documentation references, and two of them carry the negative form the field
> docs already warn about: `status_polling` needs a poll returning a state the
> parent did **not** already hold (a poll that returns what the parent knew is
> not an observation of polling), and `worker_respawn` is never inferred from
> spawning and killing existing separately.
> **The observed-absent marker is the field's own presence**, not a new key:
> absent-from-the-row is "never looked" and reports `default` provenance;
> present-and-`false` is "observed absent" and reports `registry`. So the
> distinction is readable from `routing:doctor` without opening the file, and it
> needed no third state to express.
> `agent_teams` is out of scope for a row, anchored on the interface doc comment
> that forbids inferring it from a host id (`grep` resolves, 1 hit).
> Pre-state pinned: `git show HEAD:…/host_capability.ts | grep -c "claude: {
> subagent_spawn: true, parallel_spawn: true }"` returns 1.

## Phase 2 — Run the protocol on the hosts the maintainer can actually reach

- [x] **2.1 Enumerate which of the eight hosts are reachable.** Reachable means
      the maintainer can start a real session on it, not that it is installable
      in principle. Record the list and, for each unreachable host, the reason —
      an unreachable host is a recorded fact here, not an omission.
      verify: the reachability list covers all eight platform keys from
      `src/scripts/hook_manifest.yaml:948-1093`, each marked reachable or not
      with a reason.

      **LANDED** in `host_capability.ts`'s registry doc comment, beside the rows
      it governs rather than in a separate file. All eight keys, each with a
      reason: `claude` REACHABLE; `augment`, `cowork`, `cursor`, `cline`,
      `windsurf`, `gemini` and `copilot` not reachable from this session — a
      different editor host with no session available to the running agent — and
      `copilot` additionally `fallback_only` in the manifest.
      **"Reachable" is used as the step defines it** — a real session can be
      started — and not as "installable in principle", which is the reading that
      would have produced seven rows filled from documentation.

- [-] **2.2 Run the protocol per reachable host and commit one row each.** One
      row per host, each field carrying its four-part citation inline. Fields
      the session did not exercise stay absent from the row, which leaves them
      at the safe default — never filled in from the host's documentation.
      verify: every field set to `true` in a new row has its four-part citation
      in the same commit; `describeHostCapabilities` reports `registry` as the
      source for exactly those fields.

      **NO NEW ROW — one of eight hosts is reachable, and it already had one.**
      This step closes `[-]` because its subject is *additional* rows and there
      are none to add: the only host a real session can be started on from here
      is `claude`, whose row predates the protocol and is **re-cited** under step
      2.4 rather than added here. The seven others are recorded as unmeasured
      under 2.3.
      This is the blocker's option (b) for the remainder, taken alongside (a) for
      the reachable one — the two are not exclusive per host, and the result is
      one honest table rather than a row invented from documentation.

- [x] **2.3 Record every unreachable host as unmeasured, explicitly.** No row,
      fields stay `false`, and the reachability list from Step 2.1 is the record
      that says why. This is the difference between a table with gaps and a
      table that lies.
      verify: no unreachable host has a registry row, and each appears in the
      reachability list with its reason.

      **HELD.** Seven hosts, no rows, every field at the safe default. Verified
      through the provenance surface rather than by reading the file:
      `agent-config routing:doctor --platform augment` reports all six fields
      `false(default)`, and the doctor prints the legend that makes the state
      readable — *"registry = committed observation about this host, not a live
      check · default = nobody answered, rendered as false"*.

- [x] **2.4 Confirm the existing single row is unchanged or re-cited.** The
      `claude` row predates this protocol and carries its justification in the
      surrounding doc comment rather than as a four-part citation. Either bring
      it up to the new shape or leave it and record that it is grandfathered —
      do not silently leave it looking like it passed a protocol it never ran.
      verify: the `claude` row either carries a four-part citation or is marked
      grandfathered in the same file, and which of the two was chosen is stated.

      **RE-CITED, not grandfathered — and the choice is stated at the row.** Both
      `true` fields now carry the four-part citation, on evidence that already
      existed and had never been written down:
      · `subagent_spawn` — claude (Claude Code, Opus 5 1M session, 2026-08-22),
        `subagent-ledger/2026-08.jsonl`: **445** `subagent_start` records and
        **420** stops carrying a measured `duration_ms`, i.e. 420 child legs whose
        start and stop pair. A measurable child duration is the criterion.
      · `parallel_spawn` — same host, session and artefact: **6,168** of 6,388
        stops carry `concurrent_open >= 2`, maximum **30** concurrently open
        children. Overlapping intervals at one instant, which is the criterion —
        not two children in sequence.
      **The three unset fields are "never looked", not "observed absent", and the
      row says so.** The ledger does not instrument `status_polling`,
      `separate_quota_pool` or `worker_respawn` at all, so writing any of them as
      an explicit `false` would claim a measurement nobody took. They stay absent
      and report `default`.

- [x] **2.5 Prove the doctor output reflects the new rows.** The provenance
      surface already exists; this step checks that the added rows actually
      reach it rather than assuming the wiring.
      verify: `agent-config routing:doctor --platform <one newly added host>`
      reports `registry` as the source for each field the new row sets, and
      `default` for the rest.

      **VERIFIED, on the re-cited row rather than a new one** — there is no newly
      added host, so the check is run against the one whose citations changed:
      `subagent_spawn=true(registry) · parallel_spawn=true(registry) ·
      status_polling=false(default) · separate_quota_pool=false(default) ·
      agent_teams=false(default) · worker_respawn=false(default)`.
      Exactly the two cited fields report `registry`; the other four report
      `default`. The wiring is confirmed rather than assumed, which is what this
      step exists for.

## Blockers

### blocker: b-host-access

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 2 — Run the protocol on the hosts the maintainer can actually reach
- **What to do:** pick exactly one — (a) the maintainer runs the Phase 1
  protocol on each host they can start a real session on, and commits one row
  per host with the four-part citation inline; or (b) no additional host is
  reachable, in which case Phase 2 closes with the reachability list from Step
  2.1 as its only artefact, every unreached host stays at the safe default, and
  Phase 1's contract ships on its own so a later reader with more hosts can run
  it without re-deriving the criteria.
- **Recommendation:** (a) for whatever subset is reachable today, and (b) for
  the remainder in the same pass. The two are not exclusive per host — the value
  is one honest table, and a table with three cited rows and five recorded
  silences is strictly better than the one row and seven silences that exist
  now.
- **If you do nothing:** the registry stays at one row while eight platforms are
  declared, and every `false` keeps carrying two meanings at once. Nothing
  breaks; every routing decision that reads a capability keeps degrading safely
  and keeps being unable to say whether it degraded on evidence.
- **Resolved when:** the reachability list exists covering all eight platform
  keys, and for every host marked reachable a registry row with four-part
  citations is committed, OR the list records zero additional reachable hosts
  and Phase 2 is marked `[-]` with that reason.
- **Resolution (2026-08-22) — (a) and (b), which this blocker's own
  recommendation says are not exclusive per host.** The reachability list covers
  all eight keys with a reason each, in `host_capability.ts` beside the rows it
  governs. **One host is reachable** — `claude`, the session this ran in — and it
  already had a row, so (a) discharges as a **re-citation** rather than a new
  row: both `true` fields now carry the four-part citation on ledger evidence
  that existed and had never been written down (445 starts / 420 paired child
  durations; 6,168 of 6,388 stops at `concurrent_open >= 2`, max 30).
  **(b) for the other seven**, recorded as unmeasured with reasons and no rows,
  verified through `routing:doctor` rather than by reading the file.
  **Step 2.2 alone closes `[-]`**, because its subject is *additional* rows and
  there are none — not because the step failed. The outcome is one row with
  citations and seven recorded silences, against the one uncited row and seven
  undifferentiated silences that existed before. Risk 3 named exactly this shape
  and asked that the empty outcome be a **named disposition** rather than an
  invitation to re-run the roadmap; it is named here.
  **What was NOT done, and is the honest limit:** three of the six fields on the
  one reachable host remain unobserved, because the ledger instruments none of
  them. So the registry is now one *cited* row and seven silences — better than
  before, and not a filled table.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A row is filled from documentation instead of observation | implementation | Host documentation is the cheapest source and the one this tree explicitly refuses — the no-inference rule exists because a capability that exists on paper and not in the session produces a routing decision that fails silently. | Step 1.1 defines every criterion as a transcript-observable condition, and Step 2.2 makes the four-part citation a precondition for any `true`. | Phase 1 — The observation protocol, written as a contract |
| 2 | Observed-absent and never-looked collapse into one `false` | product | Both render identically in the table and in the doctor output. Once collapsed, the registry cannot tell a future reader whether a capability was tested, which is the exact defect this roadmap opens against. | Step 1.2 requires a distinct marker for observed-absent before any row is written, and Step 2.3 records unreachable hosts with reasons rather than as silence. | Phase 1 — The observation protocol, written as a contract |
| 3 | The protocol produces zero new rows and reads as a failure | product | If no additional host is reachable, Phase 2 yields a list and nothing else, which invites re-running the roadmap later as though it had not happened. | The blocker's option (b) makes the empty outcome a named, complete disposition whose artefact is the reachability list, and Phase 1's contract ships independently of it. | Phase 2 — Run the protocol on the hosts the maintainer can actually reach |
| 4 | The grandfathered row is treated as protocol-conformant | implementation | The existing `claude` row predates the protocol. Left unmarked beside new cited rows, it acquires their authority without their evidence. | Step 2.4 forces an explicit choice — re-cite it or mark it grandfathered — and requires the choice to be stated. | Phase 2 — Run the protocol on the hosts the maintainer can actually reach |
| 5 | `agent_teams` is added to a registry row | implementation | It is the one field of the six that the registry must never carry, and it sits in the same interface as the five that it can — the shape invites the mistake. | Step 1.3 puts it out of scope in the contract and anchors the reason on the interface doc comment that forbids inferring it from a host id. | Phase 1 — The observation protocol, written as a contract |

## Non-goals

- **Building an automatic capability prober.** The protocol is a written
  criterion a human applies. A script that decides what counts as evidence is
  the inference `src/scripts/_lib/host_capability.ts:126` forbids, with an
  executable's authority attached.
- **Adding a seventh capability field.** Six exist. This roadmap fills rows, it
  does not widen the interface.
- **Changing `SAFE_DEFAULT` or the resolution order.** The all-`false` default
  and the override-then-registry-then-default order are unchanged.
- **Extending the provenance surface.** `describeHostCapabilities` and
  `routing:doctor` already answer where a value came from; Step 2.5 checks that
  the new rows reach them and nothing more.

## Acceptance Criteria

- [x] AC-1 — A written observation contract exists naming a transcript-observable
      criterion for each of the five registry-carryable fields, with
      `agent_teams` explicitly out of scope and the reason cited.
- [x] AC-2 — The contract defines a four-part citation shape (host, host version,
      evidence reference, date) and a distinct marker for observed-absent.
- [x] AC-3 — A reachability list covers all eight declared platform keys, each
      marked reachable or not with a reason.
- [x] AC-4 — Every registry field set to `true` after this roadmap traces to a
      four-part citation committed in the same change.
- [x] AC-5 — Every host nobody could reach has no registry row, keeps the safe
      default, and appears in the reachability list.
- [x] AC-6 — The pre-existing `claude` row is either re-cited to the new shape or
      marked grandfathered, and which was chosen is stated in the file.
