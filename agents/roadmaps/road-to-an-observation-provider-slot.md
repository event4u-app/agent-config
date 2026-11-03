---
complexity: lightweight
status: ready
tree_pin: d3d5d8dbd4
execution:
  mode: phase-checkpoints
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-10-29: activated above the WIP cap of five per agents/evidence/owner-directives/2026-10-29-activate-observation-provider-slot.md."
estate_offset_exempt: "Owner-directed above the WIP cap: agents/evidence/owner-directives/2026-10-29-activate-observation-provider-slot.md. Promoted from later/ on owner instruction (2026-10-29); no active roadmap is archived to offset it. Owner search at d3d5d8dbd4 (grep -rliE 'observation provider|provider slot' over agents/roadmaps, later, stubs) returned nothing."
relates:
  - slug: road-to-transfers-that-close-on-evidence
    relation: extends
    note: "Archived parent: ships the obligation ledger and --transfer; this adds runtime evidence for its rebuild and adapt rows."
---
# Road to an observation provider slot

> **Source:** owner answer to OQ-36 (`agents/owner-questions.md`, 2026-10-29),
> raised by round `inbox-2026-10-bj`.

## Goal

`/analyze:reference --transfer=rebuild|adapt` can take evidence from a runtime,
browser or binary observation tool the consumer has configured — a
reverse-engineering MCP server or a device-automation driver — and record that
evidence against obligation-ledger rows. Nothing is installed by default: with
no provider configured, the run behaves exactly as at the pin and says in one
line that runtime evidence was unavailable.

## Phase 1 — The slot

- [ ] **1.1 Declare the slot.** A settings key naming zero or more configured
      providers (MCP server name plus the evidence kinds it yields), class A,
      empty by default. `docs/contracts/reconstruction-obligations.md` names
      which equivalence tiers a provider observation may verify and which it
      may not (it never lifts a `visible-only` row to parity on its own).
- [ ] **1.2 Read it in the reference door.** The `--transfer` section of
      `src/domains/analysis-workbench/analyze/reference/command.md` checks the
      slot, calls a configured provider only through the host's MCP tools, and
      records each observation with its provider as `authority`.
- [ ] **1.3 Absence is a stated result.** No provider, or a provider that does
      not answer: the run records `coverage: unknown` for the runtime half and
      never treats it as "not observed".

## Phase 2 — Proof

- [ ] **2.1 A ledger row closes on provider evidence.** A test feeds a recorded
      provider observation into `evaluateLedger` and shows a `behavior` row
      move from `unknown` to `verified`, and the same row stay `unknown`
      without it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A provider observation is taken as parity | implementation | A runtime trace of a screen reads like behavior proof and closes a `visible-only` row | The contract names the tiers a provider may verify; the ledger test pins that a provider alone never lifts `visible-only` | Phase 1 — The slot |

## Acceptance Criteria

- [ ] AC-1 — With the slot empty, a reference run produces the same output as
      at the pin, plus one line naming the missing runtime evidence.
- [ ] AC-2 — No install path, setup step or default adds an observation tool.
