---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "Owner asked on 2026-11-21 to plan and work off every learning of the session retro; this file adds one active roadmap and zero open blockers for measure 11. No existing roadmap owns it: the two later graph roadmaps own refresh scheduling and the feeder, the two active map roadmaps own map output, and none touches graphState's unknown-count branch."
estate_offset_exempt: "Same owner request of 2026-11-21; the work cannot fold into later/road-to-a-graph-that-feeds-the-gate (parked on a corpus entry condition this fix must not wait for) nor into later/road-to-code-graph-refresh-during-a-session (parked on a WIP slot, and its scope is scheduling, not the state string). Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-a-graph-that-feeds-the-gate
    relation: extends
    note: "amends the closing clause of its done step 2.3 ('behind:0 stays the unknown-count fallback') — D3; its open step 2.5 rewrites the same context line later and inherits the states this file adds"
  - slug: road-to-code-graph-refresh-during-a-session
    relation: disjoint
    note: "owns refresh after session start, the coordinator and Windows; this file spawns nothing and only makes the state its 1.1 trigger reads honest"
  - slug: road-to-a-map-that-holds-on-the-real-repo
    relation: disjoint
    note: "owns map freshness (its 4.4 'built at', 4.7 built_at_commit in the manifest); this file owns the graph state in detect.ts and never touches agents/map/ output"
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: "owns bug, knowledge, answer and feedback lanes; no file in common"
# relates: probe — `roadmap:context --roadmap road-to-honest-graph-freshness --relates`
# (2026-11-21): scanned 1295 roadmap file(s), 0 sibling hits (slug-keyword axis).
# The four rows above come from the semantic half: grep -rlF over agents/roadmaps for
# 'behind:0', 'head_at_build', 'not-opted-in' plus the retro's own pointer, bodies read.
---
# Road to honest graph freshness

> The code-graph state line says how far behind the index is only when it knows, says
> "unknown" when it does not, says why the refresh did nothing, and tells a repository with
> no graph once that one can be built — without building it.

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude Code
> sessions across the owner's repositories), measure 11 of its P1 list, and the AI council
> round of the same day (members: anthropic, openai). Both members agreed: an automatic
> first graph build is not supported by the benchmark (2.8 M tokens per success with the
> map arm against 290 k without, at equal correctness), and the false freshness display is
> the part to fix now. Retro figures below (14 occurrences, 64–107 commits) are quoted from
> the retro, not re-measured here.

## Goal

`graphState` (`src/scripts/code_graph/detect.ts:323-334`) never returns a commit count it
did not compute: a native graph built by this release reports `behind:N` from an embedded
build commit, a graph without one reports `behind:unknown`, the refresh concern leaves a
record for every early return that a project home can hold, `auto-refresh status` names
the reason, and a repository with no graph gets one notice per repository naming the
build command. No code path in this roadmap starts a build.

## Prerequisites

- [ ] `npx vitest run tests/scripts/code_graph_context_hook.test.ts tests/scripts/hooks/code_graph_refresh_hook.test.ts tests/scripts/code_graph_refresh.test.ts` exits 0 on the starting tree.
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts tests/scripts/hooks/code_graph_refresh_hook.test.ts tests/scripts/code_graph_refresh.test.ts` -> 0

## Context

Verified against the tree at `811cea61d6`:

- **The fabricated zero.** `graphState` maps a stale source with no count to
  `behind:${typeof behind === 'number' ? behind : 0}` (`detect.ts:325-327`). The native
  cache is always probed with `embeddedSha = null` (`detect.ts:156`), so `freshness()`
  (`detect.ts:96-108`) falls back to mtime and yields `stale: true` with no
  `commits_behind`. Every stale native graph therefore prints "0 commit(s) behind"
  (`hooks/code_graph_context_hook.ts:368-370`). The retro counted this line 14 times in
  one consumer repository while it sat 64–107 commits behind.
- **The test already calls it a lie.** `tests/scripts/code_graph_context_hook.test.ts:105-109`
  pins `fresh` for the no-git case with the comment "`behind:0` would be a fabricated
  measurement" — but no test covers the git-repo, stale-mtime case that produces it.
- **No build commit in the native graph.** `CodeGraph` (`code_graph/types.ts:333-375`)
  has no commit field; only a consumer `graph.json` may carry `head_at_build`
  (`detect.ts:117,125`). The HEAD at build time is known — `cmdBuild` passes it to
  `registerUse` (`code_graph/cli.ts:258`), which stores `graph_commit` in the user-global
  project registry (`code_graph/projects_cli.ts:45-58`), skipped for worktrees (`:53-54`).
  The hook bundle cannot carry the user-global resolver (`detect.ts:315-320`).
- **Silent early returns.** `refreshFor` returns `disabled`, `unsupported`, `replay`,
  `not-opted-in` (twice) and `tracked` before `done()` is defined
  (`hooks/code_graph_refresh_hook.ts:217-228`), so nothing records them;
  `auto-refresh status` then prints `never` (`code_graph/cli.ts:1211,1219`). A graph built
  before the opt-in marker existed never gets one (retro audit: marker added 2026-11-01).
- **Absent is silent by design.** The context hook returns on `absent`
  (`code_graph_context_hook.ts:406`); its header (`:14-19`) argues an "absent" line is an
  advertisement. Retro: four consumer repositories have no `agents/map/` at all and
  nothing ever told a session that one can be built.
- **Consumers of the state string:** `code_graph_context_hook.ts:368` (slices the
  number), `code_graph/uncertainty.ts:53` (prefix), `map_viewer/shell.js:110-112` and
  `map_viewer/area_overview.js:13,54` (`/^behind:(\d+)$/`), `map_viewer/area_agent.js:86`
  (prefix), `_lib/graph_feeder_record.ts:279`, `_lib/regression_neighbourhood.ts:123,336`,
  `hooks/turn_end_gate_hook.ts:209`, `code_graph/prove.ts:280`, and the MCP envelope in
  `mcp_server/graph_tools.ts`.
- **Docs that describe the states:** `src/skills/code-intelligence/SKILL.md:213`,
  `src/rules/external-code-graph-interop.md:49`.

Out of scope, by the council verdict (D2): any automatic first build, and turning
auto-refresh on for a pre-marker graph without a local `build` or `map` run.

## Phase 1 — The native graph carries its build commit

- [ ] **1.1 Pick the carrier through the council.** First action: `agent-config council:status`;
      with two or more providers, put one design question to the council: (a) a
      `head_at_build` field in `CodeGraph`, serialized first so a bounded prefix read finds
      it; (b) a sidecar `code-graph-head.json` beside the cache, published in the same
      rename as the cache; (c) the registry's `graph_commit` (needs the user-global resolver
      the hook bundle lacks, `detect.ts:315-320`, and skips worktrees). Constraint stated in
      the question: `graphState` runs on PreToolUse and must not parse the full cache
      (`detect.ts:251-256`). Record the verdict as row D5. Council unreachable → record D5
      as `agent` with option (b) and revisit-if "council available".
      verify: `grep -cE '^\| D5 \|' agents/roadmaps/road-to-honest-graph-freshness.md` -> /^1$/
- [ ] **1.2 Failing test first: a counted behind.** New
      `tests/scripts/code_graph_build_commit.test.ts`: in a temporary git repository, run
      `code-graph build`, add three commits touching an indexed `.ts` file, assert
      `graphState(root)` is `behind:3`; a second case runs `code-graph refresh` and asserts
      the commit is re-stamped (`fresh` after refresh). Run it red: today it reads
      `behind:0`.
      verify: `npx vitest run tests/scripts/code_graph_build_commit.test.ts` -> 1
- [ ] **1.3 Stamp and read the commit.** Write the D5 carrier in `cmdBuild`
      (`code_graph/cli.ts:248-262`) and on the refresh publish path (`cli.ts:1114-1130`);
      in `detectSources` (`detect.ts:156`) pass the stamped SHA instead of `null`. A SHA git
      cannot resolve (rebased away, shallow clone) keeps today's mtime fallback.
      verify: `npx vitest run tests/scripts/code_graph_build_commit.test.ts tests/scripts/code_graph_refresh.test.ts tests/scripts/code_graph_freshness_consumer.test.ts` -> 0
- [ ] **1.4 Bound the read on the hook path.** Add a case to
      `tests/scripts/code_graph_build_commit.test.ts` that spies `fs.readFileSync`/`fs.readSync`
      during `graphState` on a synthetic 8 MB native cache and asserts no read of the cache
      path exceeds 64 KiB. Positive control: the same spy around `JSON.parse(fs.readFileSync(cache))`
      reports the full size.
      verify: `npx vitest run tests/scripts/code_graph_build_commit.test.ts -t 'bounded read'` -> 0

## Phase 2 — Unknown reads as unknown

- [ ] **2.1 Failing test first: no count, no zero.** In
      `tests/scripts/code_graph_context_hook.test.ts` (`describe('graphState — absent and fresh')`),
      add: a git repository with one commit, a native cache with no build commit whose mtime
      is set before the last commit → expect `behind:unknown`. Add to
      `describe('contextLine')`: `contextLine('behind:unknown')` contains "unknown" and does
      not contain "0 commit". Run red.
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts -t 'behind:unknown'` -> 1
- [ ] **2.2 Add the state and update every consumer in the same step.** `GraphState`
      (`detect.ts:237`) gains `'behind:unknown'`; `detect.ts:326-327` returns it when
      `commits_behind` is absent. Update the consumers listed in Context: the context line
      states "behind HEAD by an unknown number of commits — the index carries no build
      commit"; the two viewer regexes (`shell.js:110`, `area_overview.js:13,54`) get an
      explicit unknown branch in both languages; prefix readers stay unchanged (D1).
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts tests/scripts/code_graph.test.ts tests/scripts/graph_feeder_record.test.ts` -> 0
- [ ] **2.3 Zero-site sweep.** After 2.2, `detect.ts` holds no construct that turns a
      missing count into 0. Positive control: the same grep on the pinned tree finds the
      one site at `detect.ts:327`.
      verify: `git show 811cea61d6:src/scripts/code_graph/detect.ts | grep -c "behind : 0"` -> /^1$/
      verify: `grep -c "behind : 0" src/scripts/code_graph/detect.ts` -> /^0$/

## Phase 3 — The refresh says why it did nothing

- [ ] **3.1 Failing test first: a recorded opt-out.** In
      `tests/scripts/hooks/code_graph_refresh_hook.test.ts`, extend "does nothing without
      the explicit opt-in, even with a cache": assert `readRefreshRecords(root)['session-start']?.outcome`
      is `not-opted-in`. Add the same assertion for `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`
      (`disabled`). Assert a root without a project home gets no record file. Run red.
      verify: `npx vitest run tests/scripts/hooks/code_graph_refresh_hook.test.ts -t 'opt-in'` -> 1
- [ ] **3.2 Record every early return a project home can hold.** In `refreshFor`
      (`code_graph_refresh_hook.ts:217-228`), hoist `done()` above the early returns and
      call it for `disabled`, `unsupported`, `replay`, `not-opted-in` and `tracked` when
      `projectBuildPaths(root).buildDir` exists and is untracked; a root with no project home
      (`:222`) still writes nothing into the consumer tree. The throttle return `fresh`
      (`:231`) stays unrecorded and its comment says why.
      verify: `npx vitest run tests/scripts/hooks/code_graph_refresh_hook.test.ts` -> 0
- [ ] **3.3 `auto-refresh status` names the reason.** `cli.ts:1209-1226`: when the
      marker is absent and a cache exists, print "off — this graph predates the opt-in
      marker; `agent-config code-graph auto-refresh on` enables it"; the `graph:` line
      appends `(behind N)` or `(behind unknown)`. Test-first in
      `tests/scripts/code_graph_refresh.test.ts`, red before the edit.
      verify: `npx vitest run tests/scripts/code_graph_refresh.test.ts -t 'status names the reason'` -> 0
- [ ] **3.4 The behind line carries the last refresh outcome.** When the state is
      `behind:*` and the last `session-start` record's outcome is not `spawned`,
      `contextLine` appends "auto-refresh: <outcome>". Read the record from
      `projectBuildPaths(root).buildDir` (bundle-safe, no user-global resolver). Test-first
      in `tests/scripts/code_graph_context_hook.test.ts`.
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts -t 'auto-refresh outcome'` -> 0

## Phase 4 — One notice when no graph exists

- [ ] **4.1 Failing test first: one notice per repository.** In
      `tests/scripts/code_graph_context_hook.test.ts`: a git repository holding one indexed
      `.ts` file and no graph; the first search tool call emits one line naming
      `agent-config code-graph build` and `/project:map`; a second call from a different
      session id emits nothing; no process is spawned. Run red (today `:406` is silent).
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts -t 'absent notice'` -> 1
- [ ] **4.2 Implement the latched notice.** In `code_graph_context_hook.ts` `main`,
      on `absent` emit the notice once, latched under a repository-level key in the existing
      latch file (`latchFile`, `:223-225`); a repository with no indexable file stays silent.
      Rewrite header point 1 (`:14-19`) to state the bounded exception and cite D4.
      verify: `npx vitest run tests/scripts/code_graph_context_hook.test.ts` -> 0
- [ ] **4.3 No build path in the hook.** The context hook imports no process spawner.
      Positive control: the refresh hook does.
      verify: `grep -c "child_process" src/scripts/hooks/code_graph_refresh_hook.ts` -> /^[1-9]/
      verify: `grep -c "child_process" src/scripts/hooks/code_graph_context_hook.ts` -> /^0$/

## Phase 5 — Docs, projections, regression replay

- [ ] **5.1 Docs state the new states.** Edit `src/skills/code-intelligence/SKILL.md:213`
      and `src/rules/external-code-graph-interop.md:49`: `behind:unknown` → refresh or grep
      and say so, same disposition as `behind:N`; then `task sync` and `task generate-tools`.
      verify: `bash src/scripts/condense.sh --changed` -> /^$/
- [ ] **5.2 Hook bundle is current.** Regenerate the dispatch bundle the repo ships and
      run its freshness test.
      verify: `npx vitest run tests/scripts/check_hook_bundle_freshness.test.ts` -> 0
- [ ] **5.3 Replay the retro case.** In `tests/scripts/code_graph_build_commit.test.ts`,
      one fixture reproduces the consumer shape: a legacy cache without build commit, no
      opt-in marker, five commits after it. Assert: `graphState` is `behind:unknown`, the
      context line contains "auto-refresh: not-opted-in", and `auto-refresh status`
      contains "predates the opt-in marker".
      verify: `npx vitest run tests/scripts/code_graph_build_commit.test.ts -t 'retro replay'` -> 0

<!-- Release holds — none. No intermediate tree state of this roadmap is unpublishable.

     resequenced: the only state that could break a reader is a `GraphState` value no
     consumer handles; step 2.2 adds `behind:unknown` and updates every consumer in the same
     step, so no window opens. Phases 1, 3 and 4 add behaviour behind passing tests and
     each leaves the tree releasable.
-->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The new state is the literal `behind:unknown`, so every prefix reader (`uncertainty.ts:53`, `area_agent.js:86`) classes it as behind unchanged; only numeric-regex readers get an explicit branch | consumer list in Context | a consumer needs the count as a number and cannot branch |
| D2 | contested-technical | council:2026-11-21 (anthropic + openai) | No automatic first build and no automatic opt-in; fix the display and the notice only | retro benchmark: 2.8 M vs 290 k tokens per success, equal correctness | a re-run benchmark shows a graph arm beating the vanilla arm |
| D3 | reversible-technical | evidence | Replaces the clause of `road-to-a-graph-that-feeds-the-gate` step 2.3 "`behind:0` stays the unknown-count fallback" with `behind:unknown` | retro: 14 "0 behind" lines at 64–107 commits; `code_graph_context_hook.test.ts:105-109` names `behind:0` fabricated | never — a zero that is not measured is not a fallback |
| D4 | contested-technical | council:2026-11-21 (anthropic + openai) | The absent notice is one line per repository, latched, naming the build command; it never builds | both members listed "one-time 'no map' notice, no auto-build" | sessions show the notice ignored and repeated, or the owner disables it |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Hook latency regression | implementation | Reading a build commit from the native cache on every PreToolUse call parses a multi-MB JSON and slows every search tool call | 1.1 states the bound in the council question; 1.4 asserts no read over 64 KiB with a positive control | Phase 1 — The native graph carries its build commit |
| 2 | A consumer misreads the new state | implementation | A reader matching `/^behind:(\d+)$/` drops `behind:unknown` into its "other" branch and shows a raw state string | 2.2 updates every listed consumer in one step; the viewer branches are covered by the 2.2 test run | Phase 2 — Unknown reads as unknown |
| 3 | The notice becomes the advertisement the header warned about | product | A per-session or per-search notice on graph-less repositories turns into noise and gets ignored | D4: one line per repository, latched; 4.1 asserts silence on the second session | Phase 4 — One notice when no graph exists |
| 4 | Records written into a consumer tree that never opted in | product | Hoisting `done()` could create `agents/map/.build/` in a repository without a project home | 3.1 asserts no record without a project home; 3.2 records only into an existing, untracked build dir | Phase 3 — The refresh says why it did nothing |

## Acceptance Criteria

- [ ] AC-1 — On a git repository whose native graph was built by this release and then
      trailed by N commits, `graphState` returns `behind:N` (test 1.2 green).
- [ ] AC-2 — No code path returns `behind:0` for a stale source without a computed count;
      such a source reads `behind:unknown` (tests 2.1 and 5.3 green).
- [ ] AC-3 — Every early return of `refreshFor` on a root with an untracked project build
      dir leaves a record, and `auto-refresh status` prints its reason (tests 3.1–3.3 green).
- [ ] AC-4 — A repository with indexable files and no graph receives exactly one notice
      across sessions, and the context hook spawns no process (tests 4.1, 4.3 green).
- [ ] AC-5 — `bash src/scripts/condense.sh --changed` prints nothing and the hook-bundle
      freshness test passes.
- [ ] All quality gates pass: `task ci`.
