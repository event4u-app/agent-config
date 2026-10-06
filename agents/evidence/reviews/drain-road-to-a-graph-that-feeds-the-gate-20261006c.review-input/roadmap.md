<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "one blocker, discovered by doing the work rather than by planning it. Step 3.3's whole content is a measurement, and taking it is what revealed that its corpus has no positive class and that one of its two arms had been recording a path-shape defect instead of a verdict. The alternative to opening b1-labelled-positives-unreachable was to flip an open box on an undefined recall, which is the condition D5 already names as its own revisit trigger. The estate is one blocker larger because the tree now knows something it did not, and the two amendment options inside that blocker are owner-reserved precisely because the party that saw the counts may not choose between them."
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
- [ ] <!-- blocked-by: b1-labelled-positives-unreachable | asked: no — non-interactive drain run, which reports once at the end and cannot put a question; the ask is carried in the PR body and in the blocker below --> **3.3 Recall on a labelled corpus, published.** ADR-277 (`:26-32`) reopens F when its
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
      STATE 2026-10-06, the reading taken: **the accrual bar is MET and the step is
      still open, for a reason the pre-registration did not anticipate.** 84 rows
      across 5 distinct sessions, against a bar of 50. Taking the reading produced
      three findings, all on the evidence page. (i) The GRAPH ARM WAS VOID: the
      feeder handed `untested` absolute paths while the graph keys node ids on
      repo-relative ones. 19 rows carried a path; the 18 that reached the graph
      at all recorded `no-seeds`, and the nineteenth was skipped on `behind:0`
      and recorded `null` — so not one path-carrying row ever held a fact about
      the code. Probed at `c58d7eae`: `check_memory.ts`
      resolves 60 seeds relative and 0 absolute. Repaired in this change, with
      regression tests written against the absolute form and seen red first; the
      arm's accrual restarts at zero, because no pre-repair row is admissible
      evidence about the graph. It survived 3.2's review because every fixture fed
      a relative path, the one shape no host emits. (ii) The labelled corpus is
      **16 rows, and 16 of 16 are NEGATIVE** — labelled by the AI council, seats
      `anthropic` and `openai`, quorum 2/2, $0 billed, predictions withheld, no
      expected outcome stated. So **recall is UNDEFINED, 0/0 — not zero, and not a
      low score for either detector.** (iii) The counts, reported as counts: F
      fired on **0 of 84** accrued rows, and on **0 of the 16 labelled
      negatives**. NO RATE AND NO INTERVAL — the pre-registration says "below
      n = 50 this page reports the bar and the gap, never a rate", and an earlier
      version of this reading deleted that clause and published a Wilson interval
      anyway, which a completion review caught. The clause is restored verbatim
      and the rate is withdrawn. It is SPECIFICITY evidence either way, which
      settles the half ADR-277 already discharged and nothing about the half it
      left open.
      Why waiting does not fix it: the accrual channel is this suite's own
      governance work, whose base rate of untested production edits is at or near
      zero, and the 16 rows are not 16 independent observations — 4 distinct files,
      14 from one session, R14-R16 identical in every recorded field. The step is
      therefore BLOCKED rather than unfinished, on `b1-labelled-positives-unreachable`
      below: the remaining moves include amending a pre-registration after seeing
      its counts, which the party that saw them may not do.
- [x] **3.5 The feeder's cost on the stop slot, measured.** Added 2026-10-06 from round
      `inbox-2026-10-e`. `src/scripts/_lib/graph_feeder_record.ts:12-22` withdrew the
      "costs nothing" claim and leaves the latency unmeasured; a stop-hook timeout
      would discard F's refusal, so the shadow arm can weaken the gate it feeds. p50
      and p95 of the stop hook with and without the feeder, on a fixture repository,
      published beside the recall page; the number becomes a stated precondition of
      3.4 in that step's text.
      verify: `grep -c 'p95' agents/evidence/analysis/graph-feeder-latency-*.md` -> /^[1-9]/
      STATE 2026-10-06: measured by `src/scripts/bench_graph_feeder_latency.ts` and
      published at `agents/evidence/analysis/graph-feeder-latency-2026-Q4.md`. On a
      generated fixture the feeder adds p50 ≈ 32 ms / p95 ≈ 39 ms (200 modules) to a
      stop whose own work is under 1 ms; over this repository's real 59 MB index the
      feeder's work alone read p95 ≈ 583 ms and, on an earlier run, ≈ 1,007 ms, the
      graph open dominating. Exit codes identical in both arms.
- [~] **3.4 Promote the graph verdict into F.** Deferred behind 3.3 and 3.5; the ADR-277
      reopen is an owner amendment, not a step here. PRECONDITION from 3.5: the
      promotion reports the feeder's stop-slot increment — its work alone, measured by
      `bench_graph_feeder_latency --repo P --edit F` on the repository in question,
      which on the fixture agrees with the with-minus-without delta to within
      1.4 ms at p50 but differs by up to about 7 ms either way at p95, so the
      comparison rests on its median — against the
      published baseline (p95 583–1,007 ms over a 59 MB index, the cache load
      dominating); a promotion that does not first cut the load term inherits half a
      second to a second per stop on the gate's decision path.

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
| D6 | deterministic | evidence | the feeder relativises edit paths before the graph sees them, and stores the relativised form | probed at `c58d7eae`: `check_memory.ts` resolves 60 seeds relative, 0 absolute; of 19 path-carrying rows the 18 that reached the graph read `no-seeds` and the 19th was skipped on `behind:0` | the graph gains a resolver that takes absolute paths |
| D7 | deterministic | evidence | the pre-registration is NOT amended now that its counts are known — the 25/25 design stands and the shortfall is reported against it | the page's own clause: a threshold chosen after the counts is a threshold chosen by the counts | the owner amends it, via `b1` |
| D8 | product-owned | owner | b1: the positive stratum of the pre-registered corpus is accrued in two consumer repositories whose sessions are ordinary feature work — codenames C1 `ENC1:ldPWJChEkS3FS72jawL6YIevQ7ct3nEFcpiB+jqimF/6kCYTsaj3bHnlyruatJb2d4IpeQwQUY1bsBBHmqcoB9qsCRw05wNlSIvOiLJf0CKg61B5CpxfAWqngXJ34bzmd1JOO2/eWnBPNM3mk1HOD7o=` and C2 `ENC1:cdeCmP5q41+3aCe+e7/lSiKiKWV2Er3iK3myiDIEReGjpCdWQNPgYyZ6IhO3N+2DrgFEQg5zmeJ6e5O3gi6eTLf0uo9QZojiFixYNPMyEKL9EzxQrRjs8AbM0R6ZQHDAYbXnCB94lGhb9Aom1f/iGpI=` (encrypted per `source-confidentiality`; never written in plaintext anywhere in this repository, its commits or its PRs). The pre-registration is not amended | owner answer 2026-10-06 to blocker `b1-labelled-positives-unreachable`; this repository's channel produced 0 positives across 84 rows and 5 sessions | C1 and C2 together produce no positive within a quarter of feature work, or the owner withdraws either repository |

## Blockers

### blocker: b1-labelled-positives-unreachable
- **Status:** open — owner chose (a) on 2026-10-06 via `/roadmap:resolve-blockers` (D8): the corpus accrues in two consumer repositories under feature work, codenamed C1 and C2 and recorded only as `ENC1:` tokens in D8; closes when the positive stratum fills there, which is an accrual wait and no longer a question
- **Ownership:** product-owned
- **Owner:** user
- **Blocks:** step 3.3 — Recall on a labelled corpus, published
- **Question:** The pre-registered corpus needs 25 positive stop records. This repository's accrual channel produced 0 across 84 rows and 5 sessions, because its own sessions are governance work on a suite whose gates refuse untested production edits. Where do the positives come from — or does the design change?
- **Recommendation:** (a). The base rate of the positive class in this channel is the thing that is zero, and no amount of further accrual here moves it. A consumer repository under ordinary feature work produces the class in the ordinary course; this one does not. Note that (b) and (c) are both amendments to a pre-registration whose counts are now known, which is the one move the page forbids the party that has seen them — they are listed because they are real options for the owner, not because an agent weighed and declined them.
- **If you do nothing:** step 3.3 stays open and ADR-277's `review_trigger` stays unfired, so detector F's recall half remains unmeasured indefinitely while its false-positive half stays discharged. The graph arm accrues post-repair rows that nobody draws. Nothing breaks and nothing is learned.
- **What to do:** pick exactly one — (a) nominate a consumer repository whose sessions are feature work, and let the corpus accrue there until the positive stratum fills; (b) amend the pre-registration to a design the available channel can support, recording that the amendment was made with the counts in hand; (c) close step 3.3 and record that F's recall will not be measured, which leaves ADR-277's reopen condition permanently unmet and should be written into that ADR rather than only here.
- **Resolved when:** `agents/evidence/analysis/graph-feeder-recall-2026-Q4.md` carries a `Current reading` table whose `positives in corpus` column is non-zero for at least one arm, **or** this blocker carries the owner's (b) or (c) record naming which was chosen and why.
- **What is already done, so the owner is not asked to redo it.** The instrument is repaired (D6) and its regression is pinned against the shape a host actually emits. The accrual bar is met. The labelling machinery ran end to end — council quorum 2/2, predictions withheld, zero `cannot tell`, zero replacements — so the protocol itself is proven executable and only its input is missing. The specificity half is measured and reported. What is genuinely absent is one thing: a positive class.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The shadow verdict leaks into the exit code | implementation | 3.2 adds a graph call inside the function that decides a blocking stop; one wrong conditional and a stale graph refuses a tested turn. | 3.2's fixture proves the exit code unchanged; 3.4 stays deferred behind an owner amendment. | Phase 3 — One node tool, and the gate feeder in shadow |
| 2 | The Bash matcher makes the hook chatty and consumers turn it off | product | Every grep in a long session is a candidate line. | 2.2 caps at five per session and one per token; non-search Bash is silent. | Phase 2 — A hook that reaches the search, and a staleness that sees the edit |
| 3 | `git status` on a pre-tool hook costs latency | implementation | 2.3 adds a git probe to a hook that now also runs on Bash. | The probe runs only after the latch passes; the hook is advisory; the existing per-concern bench gains a Bash-shaped payload before 2.3 lands. | Phase 2 — A hook that reaches the search, and a staleness that sees the edit |
| 4 | The recall corpus is labelled by the model under test | product | Self-labels decide promotion. | 3.3 requires a person or council seat and records who labelled. | Phase 3 — One node tool, and the gate feeder in shadow |
| 5 | A latency reading from one machine is taken as the feeder's cost everywhere | implementation | 3.5 measures the stop hook on a fixture repository on the machine that runs it. | The page names the machine and the fixture; 3.4 states the number as a precondition, not a guarantee. | Phase 3 — One node tool, and the gate feeder in shadow |
