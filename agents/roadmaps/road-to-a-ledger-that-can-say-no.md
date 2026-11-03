---
complexity: standard
status: ready
tree_pin: f9054d0f10
review_by: 2026-12-15
estate_offset_exempt: "Operator-directed in the invocation (2026-11-03: analyse the round, then process its roadmaps with /roadmap:process-full and merge); archived in the same PR when its open work closes, so the active count at merge is unchanged. Owner search at f9054d0f10 (grep -rlF for mcp_render, mergeHostConfigFile, productionEntries, reach exempt over agents/roadmaps/*.md, later, stubs) found no roadmap owning the host-config writers or the reach gate's entry rule; the ledger half lands on road-to-an-observation-provider-slot instead."
---
# Road to a ledger that can say no

> **Source:** `agents/tmp.old/inbox-2026-11-u/` (topic T1, supplied plan v3 plus transcript).
> **Arrivals:** 1 — `inbox-2026-11-u` (2026-11-03).

## Goal

Two surfaces report success on input that should fail. `mcp:render` rewrites a
host's MCP config and drops entries and comments it did not write, with exit 0
and no backup. The production-reach gate counts any prose mention of
`src/scripts/<path>` as a production entry, so a library no CLI ever calls
"reaches production" through its own test. Done means: a foreign server
survives a render, a nested duplicate key is refused, and an entry is only an
entry when something invokes it.

The ledger itself (`evaluateLedger` closing on a fabricated evidence id) is
owned by `road-to-an-observation-provider-slot` and lands there as Phase 0.

## Verified at the pin

| Claim | Verdict | Evidence |
|---|---|---|
| `mcp:render` drops foreign servers and comments, exit 0, no backup | reproduced | `src/scripts/mcp_render.ts:242-246,283-286` |
| nested duplicate key loses a value | reproduced | `src/install/hostConfigMerge.ts:130-131` |
| three install writes lack backup / readback | still-true | `src/install/install.ts:930,1261,1970` |
| `parseJsonLenient` / `mergeJsonContent` are test-only | still-true | `tests/install/conflict.test.ts:148-162` |
| prose mention counts as a production entry | reproduced (new finding) | `src/scripts/_lib/production_reach.ts:118-133` |
| contexts are not an entry source | reproduced | `analysis_validate` invoked at `src/agent-src/contexts/execution/analysis-loop.md:90` reads unreached |
| two `reach exempt:` reasons cite door prose, no call | still-true | `agents/roadmaps/archive/road-to-transfers-that-close-on-evidence.md:38,43` |
| lens name drift | still-true | `src/domains/analysis-workbench/analyze/reference/command.md:368,378,504` vs `src/scripts/analysis_ledger.ts:18` |
| `--transfer` missing from argument-hint | still-true | `src/domains/analysis-workbench/analyze/reference/command.md:11` |

Killed at verification: wrapping analyst lanes in `wrapUntrusted` (the emitted
prompts carry no fetched content, `src/scripts/analysis_prompts.ts:66-109`) and
rewriting archived `status: ready` (decided 2026-09-04,
`agents/evidence/analysis/archive-status-ready-population-2026-09-04.md`).

## Phase 1 — Host-config writers keep what they did not write

- [ ] **1.1 `mcp:render` through the merge path.** Route `cmd_render` through
      `mergeHostConfigFile` with a merger that replaces only the keys it renders
      under `mcpServers`; `cmd_check` compares only those keys.
      verify: `npx vitest run tests/scripts/mcp_render.test.ts` -> 0, with a
      fixture keeping a foreign server and a comment, a JSONC file reported as
      skipped, and a `.agent-config.bak` written — each seen red first.
- [ ] **1.2 Duplicate keys in every merged container.** `hostConfigMerge.ts`
      checks duplicates in each container the merge touches.
      verify: a nested duplicate fixture returns `skipped-duplicate-key`.
- [ ] **1.3 Backup and readback on the three install writes**
      (`install.ts:930`, `:1970`, the `--force` overwrite at `:1261`).
      verify: a temp-dir settings file gets a `.bak` and is re-read.
- [ ] **1.4 Delete the dead lenient parser.** Remove `parseJsonLenient`,
      `mergeJsonContent` and their test block.
      verify: `grep -rn "parseJsonLenient\|mergeJsonContent" src tests` -> 0.
- [ ] **1.5 `--transfer` in the reference door's argument-hint.**
      verify: grep finds it at `reference/command.md:11` and in `dist/`.

## Phase 2 — An entry is something that is invoked

- [ ] **2.1 Entries from invocations, not mentions.** In `productionEntries`, a
      `.md` mention is an entry only when the target has a main guard or the
      mention is a command line (`./scripts-run`, `node`, `tsx`); add
      `src/agent-src/contexts/**/*.md` as an entry source. The gate judges new
      ticks only, so nothing turns red retroactively; record the before/after
      `report_production_reach` digest.
      verify: fixture tests — prose mention of a `_lib` module is no entry, an
      invoked CLI is, the context-invoked `analysis_validate` is.
- [ ] **2.2 A prose exemption names its call.** A `reach exempt:` reason citing
      prose, a door or a command must carry the `file:line` of the invoking
      command.
      verify: against the estate the two ADR-288 lines read red and
      `archive/road-to-a-verdict-that-shows-its-frame.md:83` stays green.
- [ ] **2.3 Unreached engine modules get a disposition.** Each module 2.1 leaves
      unreached is either invoked by CLI from its door or labelled in the door
      as "reference spec, model-carried" (precedent:
      `src/domains/analysis-workbench/analyze/inbox/command.md`).
      verify: unreached count after 2.1 equals the labelled count.
- [ ] **2.4 One lens name.** Align "Overbuild & sequencing" at
      `reference/command.md:368,378,504`.
      verify: grep shows one spelling.

## Not in this roadmap

- Ratifying the claim comparator, two pre-registered reference runs, a committed
  counts-only run receipt, bundling the door CLIs for consumers — owner-gated,
  owned by `later/road-to-first-reference-analysis-observation` and
  `later/road-to-17-0-follow-ups`.
- Any reverse-engineering or app-clone capability (scope boundary of the round).

## Risk Register

| Risk | Mitigation |
|---|---|
| 2.1 changes which existing ticks count as reached | the gate judges new ticks only; digest before/after recorded |
| 1.1 changes `mcp:check` output | check compares only rendered keys; test both |
