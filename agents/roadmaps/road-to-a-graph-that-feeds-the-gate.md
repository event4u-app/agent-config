---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. later/road-to-a-graph-that-wins cannot absorb it — its Phase 3 is edge policy and new detectors, not this detector-F feeder, and its wake condition (two benchmark subject names) gates nothing here."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; this lane owns its code-intelligence row"
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "languages, benchmark and its own Phase 3 detectors stay parked there; nothing here reads a benchmark"
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "its detector-C rewrite landed; its Q1 shadow window is measured on ShadowRecord, which step 3.2 must not contaminate"
depends: [road-to-leading-every-row]
---
# Road to a graph that feeds the gate

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — a code-level comparison against a
> code-graph tool; every anchor below re-read at `9bc8cd4`. Class: external comparison
> corpus. Corrected from the supplied draft where reproduction diverged (tagged
> `corrected-from-reproduction`).

## Goal

The code graph reaches the searches an agent actually runs and feeds a gate decision in
shadow. At `9bc8cd4`: the context hook matches `[Grep, Glob, Read]` only
(`src/scripts/hook_manifest.yaml:511`, pinned by `tests/scripts/hooks/dispatch_hook.test.ts:247,282`)
and speaks once per session (`src/scripts/hooks/code_graph_context_hook.ts:88-99,167`);
staleness is commits behind or cache mtime (`src/scripts/code_graph/detect.ts:50-77`), so
an uncommitted edit reads `fresh`; there is no node view among the five MCP tools
(`src/scripts/mcp_server/graph_tools.ts:107-267`); and `untested --diff`
(`code_graph/verbs.ts:353`) has no caller beside detector F
(`hooks/turn_end_gate_hook.ts:843-920`). Done: a Bash search reaches the hook, staleness
reports `edited`, a `graph_node` tool exists, and `untested --diff` runs in shadow beside
F with its recall recorded on a labelled corpus. Nothing here changes what the stop gate
refuses.

## Phase 1 — Make the stale text true

- [x] **1.1 Correct the settings comment and the two prose mentions, keep the key.**
      The comment block above `code_graph: enabled: false`
      (`src/config/agent-settings.template.yml:1579-1606`) says the parser is a
      devDependency; `package.json:138` lists `web-tree-sitter` under `dependencies` and
      `src/vendor/grammars/` ships three wasm files. Rewrite the comment to say the key
      is inert and registered; repoint `src/agent-src/contexts/execution/auto-dispatch-classification.md:227,235`.
      The key itself stays: `docs/contracts/settings-classes.md:623` and
      `docs/MIGRATION.md:20` commit to "classified, not deleted". `corrected-from-reproduction`
      — the supplied step deleted it.
      verify: `grep -c 'devDependency' src/config/agent-settings.template.yml` -> /^0$/

## Phase 2 — A hook that reaches the search, and a staleness that sees the edit

- [x] **2.1 Match `Bash` and read the command.** Add `Bash` to the matcher at
      `hook_manifest.yaml:511` and to the pin test; in `classifyTool`
      (`code_graph_context_hook.ts:66-81`) treat a command whose head is `grep`, `rg`,
      `ag`, `find` or `git grep` as a structure search. Any other Bash command is silent
      and does not latch.
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts` -> 0
- [x] **2.2 Latch once per target, cap five per session.** Key the latch
      (`code_graph_context_hook.ts:88-114`) on the search token as well as the session,
      so the line fires once per distinct token, at most five times per session.
      verify: fixture — three distinct patterns yield three lines, the same pattern twice yields one, a sixth pattern yields none
- [x] **2.3 Staleness reports `edited` from `git status --porcelain`.** In `detect.ts`,
      after the commit count, a non-empty porcelain result over indexed paths yields a
      fourth state `edited` beside `fresh` / `behind:N` / `absent` (`:201`); `behind:0`
      stays the unknown-count fallback. The mtime variant is not used: restoring a
      stashed file rewrites its mtime and would never return to `fresh`.
      `corrected-from-reproduction`.
      verify: fixture in a temporary repository — modify an indexed file -> `edited`; revert with `git checkout -- <file>` -> `fresh`
- [x] **2.4 The MCP answers carry the new state.** `graph_tools.ts:258-260,287-289`
      already print `graphState`; add a fixture that the MCP `graph_query` envelope's
      `staleness` reads `edited`. The CLI `query` verb has no `--json`, so the supplied
      CLI verify was unexecutable. `corrected-from-reproduction`.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'staleness edited'` -> 0

## Phase 3 — One node tool, and the gate feeder in shadow

- [x] **3.1 `graph_node`: location, in-edges, out-edges, degree.** One MCP tool beside the
      five, over the loaded graph `affected` already walks (`code_graph/query.ts:339`).
      Parameters `id`, `direction` (`in|out|both`), `depth` 1–3, `relation` over the closed
      vocabulary; the seed ladder (`query.ts:196-207`) stays the only resolver; no
      free-text scoring.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'graph_node'` -> 0
- [x] **3.2 `untested --diff` in shadow beside detector F, on its own record.** When F is
      evaluated and the graph state is `fresh` or `edited`, also call `untested` over the
      turn's edit paths (`ToolCall.path`, `src/scripts/_lib/turn_end_transcript.ts:34-40`)
      and append both verdicts to a new per-stop file under `agents/state/` — not to
      `ShadowRecord`, which is the Q1 instrument of `road-to-a-stop-that-holds`. The exit
      code is untouched; a `behind:N` or `absent` graph contributes nothing.
      `corrected-from-reproduction` — no per-stop record exists today.
      verify: fixture — an untested production edit yields F and graph verdicts on the new record and an unchanged exit code
- [ ] **3.3 Recall on a labelled corpus, published.** ADR-277 (`:26-32`) reopens F when its
      catch rate is measured on labelled data. Label 50 stop records (25 with an untested
      production edit, 25 without) by a person or a council seat, never the hook's own
      run; report F recall, graph recall and their union with `capture_rate.wilsonInterval`
      (`_lib/capture_rate.ts:90`). Below n = 50 the report prints `underpowered`.
      verify: `grep -c 'underpowered\|n = 50' agents/evidence/analysis/graph-feeder-recall-2026-Q4.md` -> /[1-9]/
      STATE 2026-10-01: the page exists and the verify passes, and the step stays OPEN
      deliberately. It carries the PRE-REGISTRATION — the two arms, the labelling
      protocol, the Wilson reporting shape — written before any data existed, which is
      the only moment a threshold cannot be chosen by the counts. Its reading is
      `underpowered`, n = 0: step 3.2 shipped the recorder in the same change, so no
      stop record predates it. Flipping this box on an n = 0 page is exactly the
      condition D5 names as its own revisit trigger, so it is not flipped. What closes
      it: n >= 50 rows across distinct sessions in `agents/state/graph-feeder/`, then
      the protocol on that page, labelled by a person or a council seat and attributed.
      STATE 2026-10-03, re-measured rather than re-read: the recorder is producing
      data — 8 rows across 2 distinct sessions in `agents/state/graph-feeder/`. The
      LABELLED corpus is still n = 0, so the page's status is unchanged and the box
      stays open; accrual and corpus are separate counts and only the second one
      closes this step. The 2026-10-01 line above is kept rather than rewritten: it
      records the state at pre-registration, and the accrual figure is what moved.
      Re-measure before flipping — this count is a reading taken on a date, not a
      standing fact, and `agents/state/` is local and gitignored, so a clone reads 0.
- [~] **3.4 Promote the graph verdict into F.** Deferred behind 3.3; the ADR-277 reopen is
      an owner amendment, not a step here.

## Acceptance criteria

- The template comment no longer calls the parser a devDependency and the key is still registered.
- A Bash search in a fresh-graph repository yields one context line per distinct token, at most five per session; other Bash yields nothing.
- `graphState` returns `edited` for an uncommitted change to an indexed file and `fresh` once reverted.
- `graph_node` answers in-edges and out-edges for a seed the existing ladder resolves and refuses one it cannot.
- Every stop where a graph existed writes both verdicts to the feeder record, and no exit code changes because of the graph.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | keep `hooks.code_graph.enabled` registered; fix its text only | `docs/contracts/settings-classes.md:623`, `docs/MIGRATION.md:20` | the migration commitment is withdrawn |
| D2 | reversible-technical | agent | porcelain, not mtime, for `edited` | a restored file's mtime is new, so mtime cannot return to `fresh` | the probe is too slow on a large tree |
| D3 | reversible-technical | agent | a separate feeder record, not `ShadowRecord` | `ShadowRecord` is written only on `stop_hook_active` / `refused_turn` (`turn_end_gate_hook.ts:1332,1353`) and feeds the Q1 reading | the Q1 window closes |
| D5 | deterministic | agent | closure pass C1 (3.3's verify listed unfalsifiable): accepted — the evidence page's existence is the oracle, the n ≥ 50 bar is in the step text and in the acceptance criteria | `closure_scan` 2026-10-01; the family is a listing, never a gate (`closure_scan.ts:41-50`) | a reviewer flips 3.3 on a page with n < 50 |
| D4 | contested-technical | evidence | no free-text scoring in `graph_node` | `docs/CLAIMS.md:566-572` — free-text retrieval is the row the graph lost | a rerun wins a retrieval class |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The shadow verdict leaks into the exit code | implementation | 3.2 adds a graph call inside the function that decides a blocking stop; one wrong conditional and a stale graph refuses a tested turn. | 3.2's fixture proves the exit code unchanged; 3.4 stays deferred behind an owner amendment. | Phase 3 — One node tool, and the gate feeder in shadow |
| 2 | The Bash matcher makes the hook chatty and consumers turn it off | product | Every grep in a long session is a candidate line. | 2.2 caps at five per session and one per token; non-search Bash is silent. | Phase 2 — A hook that reaches the search, and a staleness that sees the edit |
| 3 | `git status` on a pre-tool hook costs latency | implementation | 2.3 adds a git probe to a hook that now also runs on Bash. | The probe runs only after the latch passes; the hook is advisory; the existing per-concern bench gains a Bash-shaped payload before 2.3 lands. | Phase 2 — A hook that reaches the search, and a staleness that sees the edit |
| 4 | The recall corpus is labelled by the model under test | product | Self-labels decide promotion. | 3.3 requires a person or council seat and records who labelled. | Phase 3 — One node tool, and the gate feeder in shadow |
