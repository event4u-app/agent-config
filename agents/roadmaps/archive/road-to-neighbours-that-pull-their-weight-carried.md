---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-neighbours-that-pull-their-weight
---
# Road to neighbours that pull their weight — carried

> **Source:** carried by the archival sweep on 2026-10-07 from
> [`road-to-neighbours-that-pull-their-weight`](archive/road-to-neighbours-that-pull-their-weight.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-neighbours-that-pull-their-weight deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-neighbours-that-pull-their-weight

- [x] **3.2 Execute the fingerprint-slot stub.** Bind `mcp_tool_fingerprint` to
      `post_tool_use`, observe-only, per `agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md`:
      its admissions-ledger row, `severity: advisory`, `fail_closed: false`, its three
      tests (first sighting silent, mutation reported, malformed input exit 0), the
      concern comment, then delete the stub. This raises the concern count, and
      the programme's growth claim does NOT cover that — corrected 2026-10-05, see
      the concern-count note under the blocker below.
      verify: fixture — the same foreign tool with a mutated description on the second call yields one context line and one ledger row

      **Attempted 2026-10-02, and the attempt refutes the step's premise.** The
      store digests `name`, `description` and `inputSchema`
      (`src/scripts/mcp_tool_fingerprint.ts:66-71`) and `recordFingerprint` takes an
      `McpToolDefinition`, not a tool call. A `post_tool_use` envelope carries
      `tool_name`, `tool_input` and `tool_response` — the CALL, never the
      DEFINITION. Verified from the dispatcher's own payload contract, whose two
      body classes are exactly `input` and `result`
      (`src/scripts/hooks/payload_stub.ts:20-70`), and by grepping every concern
      under `src/scripts/hooks/` for a description or schema key: there is none.
      Nothing else in the tree reads a third party's tool definitions either —
      `audit_mcp_tools.ts` and `build_mcp_catalog.ts` read THIS package's catalog,
      and `lint_mcp_config_security.ts` reads shipped config.

      The council of 2026-09-06 decided the pre-use-vs-post-use axis, which is a
      real trade-off and is correctly recorded in the stub. The axis it did not
      consider is whether the chosen slot can supply the module's input. Binding
      the concern anyway would produce a recorder that fires on every MCP call and
      records nothing — coverage on the manifest and in the admissions ledger with
      the observation floor still at zero, which is the stub's own
      "observe-only must never be cited as satisfying a preventive guarantee"
      failure one layer further down.

      **Deferred by decision D2 below, not parked.** This is a technical question
      and ADR-268 § 10 says a technical decision does not become owner-owned
      because it is hard, so it is decided here: the fingerprint store waits for a
      definition source, and the observation this slot CAN make is 3.3's name
      recorder. Revisit-if: a reader of third-party MCP tool descriptors exists in
      `src/scripts/`.

      **2026-10-06 execution of the revisit-if** (does not fire) — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Step 3.2.

      **Iron Law 3, surfaced 2026-10-06 — NOT archived.** Every other step closed
      that day, so this `[~]` is now what holds the file open. Criterion: as written
      above. Blocker: D2 — no reader of third-party tool descriptors exists. The
      preserving dispositions are council-routed: carry into a follow-up, or merge
      into `stubs/road-to-mcp-fingerprint-slot-binding.md`, which already owns the
      binding. The archival sweep's automatic carry was run and reverted in this
      lane, because it rewrites inbound `verify:` paths in `road-to-leading-every-row`
      while another lane edits that file (D15's ground). Not resolved here; next
      run, or the owner.

      **Outcome (2026-10-08, D1/D3 below): merged.** `road-to-leading-every-row`
      archived on 2026-10-07 (`agents/roadmaps/archive/road-to-leading-every-row.md`),
      so the conflict that forced the earlier revert no longer applies. Re-probed
      the revisit-if today: still no reader of third-party MCP tool descriptors in
      `src/scripts/` (confirmed via
      `grep -rn 'inputSchema\|McpToolDefinition' src/scripts/` — only this
      package's own MCP-server/catalog code). D2's underlying technical finding was
      already recorded verbatim as D1 in
      `stubs/road-to-mcp-fingerprint-slot-binding.md` (added 2026-10-02, when this
      step first attempted the binding); that stub now also carries today's
      re-probe. Closing here as merged into that stub — no new file, no duplicated
      record.
- [x] **3.4 Suggest `permissions.deny` for never-used foreign tools.** Deferred: writing a
      consumer's permission block is Class C and a product decision (K15).

      **Iron Law 3, surfaced 2026-10-06 — NOT archived.** A product decision
      (K15) on a Class C surface, so every disposition that drops or narrows it is
      the owner's; carrying it is council-routed and was not taken in this lane for
      the reason recorded under 3.2.

      **Outcome (2026-10-08, D2/D3 below): carried.** No existing active roadmap or
      stub owns the never-used-foreign-tool `permissions.deny` surface
      (`grep -rli 'permissions\.deny\|never-used foreign tool' agents/roadmaps/`
      outside `archive/` returns only this file). Carried to a new standalone
      stub, `stubs/road-to-permissions-deny-for-unused-foreign-tools.md`, which
      names K15 as the unresolved owner question and implements nothing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-07 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-neighbours-that-pull-their-weight |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | No third-party MCP tool-descriptor reader exists in `src/scripts/`, so `mcp_tool_fingerprint.ts` cannot be driven from the `post_tool_use` payload; the binding waits for a definition-source reader | First established 2026-10-02 (dispatcher body classes are exactly `input`/`result`, never a tool definition); re-confirmed 2026-10-06 and again 2026-10-08 via `grep -rn 'inputSchema\|McpToolDefinition' src/scripts/` | A reader of third-party MCP tool descriptors exists in `src/scripts/` |
| D2 | product-owned | owner | Whether to suggest `permissions.deny` entries for never-used foreign tools (K15) is not decided here | Writing a consumer's permission block is Class C, outside agent and council authority | The owner decides K15 |
| D3 | reversible-technical | council:2026-10-08 | Step 3.2 is merged into the existing stub `stubs/road-to-mcp-fingerprint-slot-binding.md` (already records D1's finding verbatim); step 3.4 is carried into a new stub, `stubs/road-to-permissions-deny-for-unused-foreign-tools.md`, naming D2/K15 as the open owner question | Council claude-sonnet-4-5 + codex, 2 rounds, 2/2 concluded, $0 (subscription seats). 3.2: the destination already owns the same binding, consolidating avoids fragmenting the record. 3.4: no existing active roadmap or stub covers the never-used-foreign-tool `permissions.deny` surface | A live roadmap or stub later claims the 3.4 surface explicitly, or the owner answers K15 |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-neighbours-that-pull-their-weight` is still `[ ]` without a recorded disposition.
