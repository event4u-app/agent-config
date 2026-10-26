---
complexity: lightweight
status: ready
tree_pin: f9af88efe0
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-ay verified at f9af88efe0 that the memory-recall concern quotes a stored memory description into additional_context with no data framing and no injection screen (src/scripts/hooks/memory_recall_hook.ts:397-420), while its two sibling injectors, hot-context and handoff-context, already spotlight their blocks as DATA; and that nothing pins the MCP server's no-network-listener property. Owner search, 2026-10-26 at f9af88efe0: `grep -rlF -e memory_recall_hook -e memory-recall -e buildEmission -e mcp_server -e createServer -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs` over the whole roadmap tree; the only subject owner it surfaced is later/road-to-a-memory-the-consumer-owns, which owns the consumer-facing recall substrate (recall_when, scope, bench classes) and not the framing of what the shipped concern emits today. Parking was rejected because the operator asked in the invocation for the round's roadmaps to be executed in the same run, and the roadmap is created and archived in one PR, so the active count never exceeds the cap of five."
relates:
  - slug: road-to-a-memory-the-consumer-owns
    relation: disjoint
    note: "Parked owner of the consumer recall substrate. Its Phase 3 lets consumer-written pages reach this same concern, which makes the framing here a precondition it inherits; nothing here re-plans its steps. Its new step 8.2 (recall log) came from the same round."
---
# Road to recall that reads as data

> **Source:** `agents/tmp.old/inbox-2026-10-ay/` — one owner transcript and two
> externally drafted comparison plans against an external multi-agent
> orchestration runtime (Source S1), drafted at `e494248c`, re-verified against
> `f9af88efe0` on 2026-10-26. The round's full point ledger and every
> disposition is
> [`inbox-2026-10-ay-disposition.md`](../../evidence/analysis/inbox-2026-10-ay-disposition.md);
> this roadmap carries only the two findings that were still true, small, and
> owned by nobody.

## Goal

Every memory the `memory-recall` concern injects reaches the agent marked as
stored data rather than as an instruction, and a stored description that is
itself shaped like an injection is withheld instead of quoted — on the shipped
concern, with a fixture that fails when either property is removed, and without
raising the hook-bundle ceiling. Separately, the MCP server's "stdio only, no
network listener" property is pinned by a test that turns red when a listener is
planted, instead of being true only because nobody has written one.

## Phase 1 — Memory recall emits data, not instructions

- [x] **1.1 Frame the quoted description as stored data.** `buildEmission` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/memory_recall_hook.ts -->
      quotes the memory's `description:` line after `It says:` with nothing
      telling the agent the text is data. Its siblings already do this
      (`hot_context_hook.ts:22`, `handoff_context_hook.ts:10`). Change the
      quote's lead-in so the emitted line names the text as stored data and not
      an instruction, inside the existing `CAP_BYTES` budget.
      verify: `npx vitest run tests/scripts/memory_recall_hook.test.ts` -> 0
      — a case asserts the framing words precede the quoted description, and the
      existing cap test still holds.
- [x] **1.2 Withhold an injection-shaped description.** Screen the description <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/memory_recall_hook.ts -->
      with the scanner the `injection-scan` concern already uses (`_scan` in
      `src/scripts/injection_scan_hook.ts`), not a second pattern list. On a
      hit, emit the pointer and the why-now, drop the quote, and say it was
      withheld — the slug stays actionable.
      verify: a fixture memory whose description reads like an override
      instruction yields an emission without that text and with the withheld
      note; neutralising the screen turns that test red (sensitivity), and
      restoring it turns it green.
- [x] **1.3 Fit inside the hook-bundle ceiling without a raise.** The bundle <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/memory_recall_hook.ts -->
      sat 55 bytes under its ceiling at `f9af88efe0`; offset this change's
      bytes inside the touched concern rather than adding a `raise_log` entry.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0
      — with `max_bytes` unchanged.

## Phase 2 — The MCP server's no-listener property is pinned

- [x] **2.1 Add a source invariant test for the MCP server.** Today nothing <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      fails if a network listener lands under `src/scripts/mcp_server/`: the
      only listener-shaped code in the MCP tests is a mock worker in
      `tests/scripts/mcp_parity_smoke.test.ts:90-103`. Add a test that scans
      the server's source files for a network bind (`listen(`, `createServer`,
      `0.0.0.0`) and fails on any hit.
      verify: `npx vitest run tests/scripts/mcp_server_no_listener.test.ts` -> 0
      on the tree; planting a
      `createServer(` line in a temporary copy of a server file turns it red.

## Decisions

| ID | Decision | Rung | Alternatives | Reason | Revisit-if |
|----|----------|------|--------------|--------|------------|
| D1 | Screen with the existing `_scan`, never a new list | tree | a dedicated memory pattern list; the secret detector | one detection surface cannot drift from itself; `_scan` is already in the dispatch bundle, so the import adds no module | the scanner's false-positive rate on real memory descriptions is measured above zero |
| D2 | Withhold, never rewrite, on a hit | tree | strip the matched span; quote anyway with a warning | the injection-scan concern deliberately never rewrites what the agent reads; a partial quote of an injection-shaped string still carries it | — |
| D3 | Offset bytes, do not raise the ceiling | tree | a `raise_log` entry | the ceiling is shrink-only and a raise is on the ratification gate's watched set; a 100-byte feature does not justify either | the change cannot be made byte-neutral without removing behaviour |
| D4 | A source scan, not a runtime probe, for 2.1 | tree | start the server and probe ports | the property is "no code binds a socket"; a runtime probe proves one launch path, the scan proves every file | the server gains a legitimate network transport by owner decision |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The screen withholds legitimate memories | implementation | A real memory description that discusses injection phrases (this repo has several) trips `_scan` and loses its quote | The pointer and why-now still emit, so the memory stays reachable; the withheld note names the reason so a false hit is visible, not silent | Phase 1 — Memory recall emits data, not instructions |
| 2 | The bundle ceiling reds the push | implementation | 55 bytes of headroom is less than the change | Step 1.3 measures before and after and offsets inside the concern | Phase 1 — Memory recall emits data, not instructions |

## Acceptance Criteria

- [x] AC-1 — A memory description injected by `memory-recall` is preceded by
      wording that names it stored data, and an injection-shaped description is
      not injected at all; both are asserted by tests that were seen red.
- [x] AC-2 — A network listener added under `src/scripts/mcp_server/` fails a
      test, and the hook bundle stays under an unchanged ceiling.
