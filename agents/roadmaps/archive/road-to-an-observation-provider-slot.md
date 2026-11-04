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
> **Arrivals:** 1 — `inbox-2026-11-u` (2026-11-03): Phase 0, the ledger must be
> able to say no before a provider observation can close a row.

## Goal

`/analyze:reference --transfer=rebuild|adapt` can take evidence from a runtime,
browser or binary observation tool the consumer has configured — a
reverse-engineering MCP server or a device-automation driver — and record that
evidence against obligation-ledger rows. Nothing is installed by default: with
no provider configured, the run behaves exactly as at the pin and says in one
line that runtime evidence was unavailable.

## Phase 0 — A ledger that can say no

At the pin `evaluateLedger` closes a row on a fabricated evidence id with an
empty verifier and on an authority outside its enum
(`src/scripts/_lib/reconstruction_ledger.ts:40-73`, reproduced round
`inbox-2026-11-u`). Step 2.1 would prove nothing on that verdict.

- [x] **0.1 Resolvable evidence.** `evaluateLedger(rows, ctx: {evidenceIds})` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/reconstruction_ledger.ts -->
      with `ctx` required; a row is `invalid` on an unknown evidence id, an
      authority outside the enum, or `verified` with an empty verifier.
      verify: `npx vitest run tests/scripts/reconstruction_ledger.test.ts` -> 0 and
      the fabricated-id case yields `invalid` with three errors, and removing
      each check turns exactly one case red.
      Done: `evaluateLedger(rows, ctx)` in `src/scripts/_lib/reconstruction_ledger.ts` with required `LedgerContext`; `resolveObligation` adds the three refusals and a refused row never counts as verified; contract closing rule 1 updated. `npx vitest run tests/scripts/reconstruction_ledger.test.ts` -> 0 (9 tests); the fabricated row yields `invalid` with exactly three errors, and commenting out each check in turn reds exactly that one case (8 of 9 stay green each time).
- [x] **0.2 A ledger CLI.** `reconstruction_ledger --check <file>`: exit 0 <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/reconstruction_ledger.ts -->
      closed, 1 open/unknown, 2 invalid or usage; the reference door invokes it
      from a code fence.
      verify: `npx vitest run tests/scripts/reconstruction_ledger_cli.test.ts` -> 0 and
      one case per exit code.
      Done: `src/scripts/reconstruction_ledger.ts` (`--check <file>`, JSON `{evidence_ids, obligations}`, a file without `evidence_ids` fails closed); the reference door invokes it from a bash fence in § Transfer modes, so the 2.1 entry rule reaches it. `npx vitest run tests/scripts/reconstruction_ledger_cli.test.ts` -> 0 (6 tests covering exit 0, 1 open, 1 unknown, 2 invalid, 2 no-evidence, 2 usage).
- [x] **0.3 Step 2.1 speaks the ledger's states.** Rewrite 2.1 as "verdict <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/production-entries.json -->
      `unknown` → `closed`" — the row status `unknown` does not exist
      (`reconstruction_ledger.ts:15`).
      verify: 2.1 names only states the ledger emits.
      Done: 2.1 now reads row `open` → `verified`, verdict `open` → `closed`, and `invalid` for an unrecorded id — every name is one `reconstruction_ledger.ts` emits. Deviation: the suggested "verdict `unknown` → `closed`" was not used because the ledger reads `unknown` only when it has no rows, so a one-row ledger moves `open` → `closed`.

## Phase 1 — The slot

- [x] **1.1 Declare the slot.** A settings key naming zero or more configured <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
      providers (MCP server name plus the evidence kinds it yields), class A,
      empty by default. `docs/contracts/reconstruction-obligations.md` names
      which equivalence tiers a provider observation may verify and which it
      may not (it never lifts a `visible-only` row to parity on its own).
      Done: `reconstruction.observation_providers` (list of `{server, kinds}`, kinds `runtime|browser|binary|device`, default `[]`) in the template and `src/server/schemas/settings.ts`; contract § Observation providers names `ux`/`behavior`/`protocol` as the tiers a provider may verify, refuses `byte` and `inspired-by` in `validateObligation`, and keeps `visible-only` out of parity. Deviation: class **C**, not A — it is a list of trusted evidence sources that decides which MCP server is called, so C-tests 2 and 5 of `settings-classes.md` fire; the plan yielded to the contract. `lint_settings_classes` -> A=11 B=4 C=104.
- [x] **1.2 Read it in the reference door.** The `--transfer` section of <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `src/domains/analysis-workbench/analyze/reference/command.md` checks the
      slot, calls a configured provider only through the host's MCP tools, and
      records each observation with its provider as `authority`.
      Done: § Runtime evidence — observation providers in the reference door runs `reconstruction_ledger --providers`, calls a listed provider only through the host's MCP tools, and records it as `verifier: provider:<server>` with an enum authority (`controlled-replay` / `external-claim`). Deviation, per Risk 2: the provider goes into `verifier`, not `authority` — Phase 0 refuses an authority outside the enum, and the enum stays unwidened.
- [x] **1.3 Absence is a stated result.** No provider, or a provider that does <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/reconstruction_ledger.ts -->
      not answer: the run records `coverage: unknown` for the runtime half and
      never treats it as "not observed".
      Done: `--providers` prints `runtime evidence unavailable · no observation provider configured · coverage: unknown` and exits 0 with the slot empty; a malformed slot exits 2 instead of reading as empty; the door records a non-answering provider as `coverage: unknown`. `npx vitest run tests/scripts/reconstruction_observation_provider.test.ts` -> 0 (11 tests).

## Phase 2 — Proof

- [x] **2.1 A ledger row closes on provider evidence.** A test feeds a recorded <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      provider observation into `evaluateLedger` and shows a `behavior` row
      move from `open` to `verified` — the ledger verdict `open` → `closed` —
      with the observation's id among the context's `evidenceIds`; without the
      observation the row stays `open` and the verdict `open`, and a row citing
      an observation id the run never recorded reads `invalid`.
      Done: `tests/scripts/reconstruction_observation_provider.test.ts` § 2.1 — `open` with no observation, `closed` with `OBS-1` recorded, `invalid` on unrecorded `OBS-9` and on a provider name as authority. Neutralising the tier guard reds exactly the tier case (10 of 11 stay green).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A provider observation is taken as parity | implementation | A runtime trace of a screen reads like behavior proof and closes a `visible-only` row | The contract names the tiers a provider may verify; the ledger test pins that a provider alone never lifts `visible-only` | Phase 1 — The slot |
| 2 | Step 1.2 records a provider as `authority`, which Phase 0 now refuses | implementation | Since 0.1 the ledger marks a row `invalid` on an authority outside its enum, so a provider name written as `authority` never verifies | 1.2 maps each configured provider onto an enum value (or widens the enum in the contract first), with a test that a provider row verifies | Phase 0 — A ledger that can say no |

## Acceptance Criteria

- [x] AC-1 — With the slot empty, a reference run produces the same output as
      at the pin, plus one line naming the missing runtime evidence.
- [x] AC-2 — No install path, setup step or default adds an observation tool.
