---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: >
    ADR-278 is accepted with `provenance.kind: owner` and answers ADR-088 § 3 (a)–(d):
    identity, generic design, maintenance model, trust contract. Until it exists every
    phase here is runtime coupling ADR-088 § 3 calls out of scope.
  when: >
    After the owner rules on blocker b8 in `road-to-leading-every-row` and the ADR
    lands; no earlier date is meaningful because the decision is the gate.
  who: >
    The owner, for ADR-278; the maintainer, for confirming the two coexistence lanes
    are archived, because their census and precedence rule are this file's inputs.
review_by: 2026-12-31
capability_gap: none
estate_offset_exempt: "Parked from inbox round inbox-2026-10-b as part of the set road-to-leading-every-row declares; nothing here may start before ADR-278 exists."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "blocker b8 there is this file's gate"
  - slug: road-to-a-tree-that-keeps-its-neighbours
    relation: depends
    note: "the census, effect labels and environment label are the provider inventory this file reads"
  - slug: road-to-neighbours-that-pull-their-weight
    relation: depends
    note: "the precedence rule is the arbitration rubric; the fingerprint slot is the rug-pull observer"
  - slug: road-to-capability-native-execution
    relation: disjoint
    note: "parked; its blocker b-adr-088-external-runtime-federation (2026-08-29) records the same missing ADR"
depends: [road-to-leading-every-row, road-to-a-tree-that-keeps-its-neighbours, road-to-neighbours-that-pull-their-weight]
---
# Road to federation behind ADR-278

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — the federation half of a second
> author's proposal bundle, consolidated against this tree at `9bc8cd4` and against the
> two coexistence lanes of the same set. Class: external proposal set + owner directive.

## Goal

Once ADR-278 answers ADR-088 § 3 (`docs/decisions/ADR-088-*.md:95-105`), a neighbour's
capability can be invoked through one typed boundary and its result treated as evidence
with a provider stamp — never as this suite's completion. Done: one provider class
vocabulary, one invocation record in a sink that can hold it, a fallback ladder per class,
and an A/B/C reading on the assurance-benchmark stub's frozen corpus. ADR-088's frontmatter
marks it `superseded_by: ADR-124` for the engine-adoption reading only, and ADR-124 keeps
"no cross-vendor federation" literal — ADR-278 narrows both explicitly or not at all.

## Inputs ADR-278 must answer before Phase 1

- [ ] **0.1 Record the inputs the round produced, as questions, in the ADR draft.** MCP
      protocol capability discovery would need an outbound client `src/` does not have
      (K34); server identity is self-reported and is display-only; a provider's proof
      expires on digest change; the environment label of the tree lane (`controlled |
      coordinated | degraded | uncontrolled`) gates whether federation may run at all.
      verify: `grep -c 'uncontrolled' docs/decisions/ADR-278-*.md` -> /[1-9]/

## Phase 1 — Provider classes and one invocation record

- [ ] **1.1 Six provider classes, read from the census.** `content`, `intelligence`,
      `execution`, `orchestration`, `memory`, `verification`, one per census entry by
      shape; no vendor table.
      verify: `agent-config doctor neighbours --json` -> /"class":"(content|intelligence|execution|orchestration|memory|verification)"/
- [ ] **1.2 One invocation record in its own sink.** `{provider_id, digest, class,
      input_scope, allowed_effects, budget_ms, expected_result, evidence_ref,
      ac_verification_required}` goes to a new JSONL under `agents/runtime/state/`. Not the
      MCP telemetry log: `src/scripts/mcp_server/telemetry.ts:1-22` records inbound calls on
      our own server in a frozen five-field envelope (`docs/contracts/mcp-tool-stub-envelope.md`).
      `corrected-from-reproduction`.
      verify: fixture — one federated call appends exactly one line with the nine fields
- [ ] **1.3 A foreign `complete` is a provider status.** The stop gate's detectors are
      unchanged; a provider result reaches completion only as evidence they read.
      verify: `grep -c 'provider status' src/rules/neighbour-precedence.md` -> /[1-9]/

## Phase 2 — Fallback ladder per class

- [ ] **2.1 Native → alternate provider → `unsupported`.** A table per class in
      `docs/contracts/federation-fallback.md`; `unsupported` is a printed state.
      verify: `grep -c 'unsupported' docs/contracts/federation-fallback.md` -> /[6-9]|[1-9][0-9]/
- [ ] **2.2 Provider absence changes nothing on the native path.**
      verify: `npx vitest run tests/scripts/federation_fallback.test.ts` -> 0
- [ ] **2.3 Federation runs only under `controlled` or `coordinated`.** A slot the tree
      lane labels `degraded` or `uncontrolled` gets no federated call; observers may stack.
      verify: fixture — a foreign `permission` entry beside ours yields `degraded` and no federated call on that slot

## Phase 3 — Prove the combination on the frozen corpus

- [ ] **3.1 Arms A/B/C on the assurance-benchmark stub's corpus.** A = native, B = provider
      direct, C = native + provider, per task class, judged by direction with
      `_lib/paired_verdict.ts`; the threshold is pre-registered before the first run.
      verify: `grep -c 'federation-combination-lift' docs/CLAIMS.md` -> /[1-9]/
- [ ] **3.2 Preference is per task class and per provider digest.** A digest change sets
      the row to `expired`; no global switch.
      verify: fixture — a changed digest sets the row to `expired`
- [~] **3.3 Promote C where it wins.** Deferred behind 3.1 and the stub's own promotion probe.

## Acceptance criteria

- No phase starts before ADR-278 exists.
- Provider absence leaves the native path byte-identical.
- Every federated call has one record line with a provider digest, outside the MCP telemetry envelope.
- A `degraded` or `uncontrolled` slot never receives a federated call.
- The combination claim exists as `unbacked` with a pre-registered threshold before the first run.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | the invocation record gets its own sink | `src/scripts/mcp_server/telemetry.ts:1-22` is inbound-only with a frozen envelope | the envelope contract is reopened |
| D2 | deterministic | agent | closure pass C1 (0.1's verify listed unfalsifiable): accepted — the grep fails until the ADR draft names the environment label | `closure_scan` 2026-10-01; listing family, never a gate | ADR-278 is drafted without the label |

## Blockers

### blocker: adr-278-not-accepted
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — Provider classes and one invocation record
- **Question:** Has ADR-278 been accepted, answering ADR-088 § 3 (a)–(d)? The drafted answers sit in blocker b8 of `road-to-leading-every-row`.
- **Recommendation:** Answer b8 first; this park is the consequence of that answer, not a second question.
- **If you do nothing:** this file stays parked and the coexistence lanes ship inventory and rubric without invocation — a complete and useful state.
- **What to do:** pick exactly one — (a) accept ADR-278, then flip this blocker to `resolved` and move the file to `agents/roadmaps/`; (b) leave it parked until `review_by`.
- **Resolved when:** `test -f docs/decisions/ADR-278-*.md && grep -c 'provenance.kind: owner' docs/decisions/ADR-278-*.md` -> /1/

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The park is worked around under another slug | implementation | Each phase is small; the invocation record lands as "logging", the slot rule as "a doctor warning". | The blocker and the first acceptance criterion name the ADR; the programme's kill register names the broker shape. | Phase 1 — Provider classes and one invocation record |
| 2 | Arm C wins on a corpus chosen after the provider was installed | product | Task classes picked late measure the provider's strength. | 3.1 uses the stub's frozen corpus and a pre-registered threshold. | Phase 3 — Prove the combination on the frozen corpus |
| 3 | `degraded` is the common state and federation never runs | product | Most neighbours mutate permission on PreToolUse. | The label names the entries so the consumer can choose; the native path is unchanged either way. | Phase 2 — Fallback ladder per class |
