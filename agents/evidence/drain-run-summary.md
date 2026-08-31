<!-- evidence-type: analysis -->

# Autonomous drain run — 2026-08-31 (run 8)

> **INTERIM, and the directory is not empty.** The run was asked to empty
> `agents/roadmaps/`. It found **three** active roadmaps, closed one completely,
> advanced both others, and ends with **four** — because a council verdict
> required splitting owner-blocked work into its own ACTIVE receiver rather than
> parking or dropping it. That is a legitimate outcome of the mandate, not a
> failure to follow it: the mandate also said gates close only when their
> criterion is actually met.

## PRs

| PR | Roadmap | State |
|---|---|---|
| [#1763](https://github.com/event4u-app/agent-config/pull/1763) | `road-to-turnaround-followups` | **MERGED** 2026-08-31T01:08:37Z. 7/7 disposed, archived. CI 6 pass / 0 fail |
| [#1764](https://github.com/event4u-app/agent-config/pull/1764) | `road-to-governed-harness-evolution` | Open. 24/59 → 33/59, AC audit, Phase 7 split out. CI 40 pass / 0 fail at push time |
| [#1765](https://github.com/event4u-app/agent-config/pull/1765) | `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | Open. 18/77 → 26/77 done + 4 null-closed. CI 33 pass / 0 fail at push time |

## Council decisions (6 rounds; 4 convergent 2/2, 1 convergent 2/2 on REVISE, 1 degraded 1/2)

| # | Question | Seats | Verdict |
|---|---|---|---|
| 1 | How does `road-to-turnaround-followups` AC-1 close? | 2/2 | **Option 1, transfer to the stub** — with a falsifiable precondition both seats attached unprompted: *verify stub governance first* |
| 2 | Phase 7 of `governed-harness`, gated on owner-reserved merge authority | 2/2 | **Option 3, split into a new ACTIVE roadmap.** `later/` explicitly rejected: excluded from the dashboard and `/roadmap:process-*`, so it does not preserve active-estate membership |
| 3 | Is the Phase 2 council-topology benchmark executable at 50 calls/provider/day? | 2/2 | **Q1(a) new carrier · Q2(iii) NOT executable as written** — the roadmap defines dimensions but never the provider-call graph · Q3 zero-call work first, then 1B, then Phase 2, then 3.3 |
| 4 | Round 2: the Option-1 precondition FAILED — what now? | 2/2 | **Option 4, promote the stub into the active estate.** Both seats changed their answer and said so plainly |
| 5 | The twelve cascade stages (`governed-harness` 4.1) | **1/2 — DEGRADED** | **REVISE, not greenlight** — keep E9's arity, do not treat stage semantics as decided until the receipt trust boundary exists |
| 6 | The closed `WHERE × WHY` vocabularies (`governed-harness` 4.4) | 2/2 | **REVISE, not greenlight** — both named the same architecturally prior gap and the same defect in the question |

### The one that changed its own answer

Round 1 converged on transferring AC-1 into `stubs/road-to-obligation-delivery-verification.md`, and **both seats independently attached the same kill switch**: verify stub governance before transferring, or fall back.

**The check was run and it failed, on four readings:**

| Check | Result |
|---|---|
| Is `stubs/` a legal carry destination? | **No** — `archive_completed_roadmaps.ts` builds its candidate list as exactly `agents/roadmaps/<slug>.md` and `agents/roadmaps/later/<slug>.md` |
| Do stub blockers surface in `gates --all`? | **No** — `lint_roadmap_blockers.ts:35` scans `agents/roadmaps/*.md` non-recursively; three stub files carry `### blocker:` headings and appear in no gate |
| Do stubs appear on the dashboard? | **No** — `update_roadmap_progress` reports three roadmaps and no stub |
| Does `resume_probe` read them? | **No** — `later/` only |

Round 2 reversed to promoting the stub into the active estate. The active placement is a **narrow, expiring exception** to the Later-disposition Iron Law with all four properties the seats demanded — a named blocker, a measurable releasing condition, `owner: council`, and a kill switch at `review_by: 2026-09-30` after which it moves to `later/` without a further round.

## Descopes and transfers — carried, never cancelled

| Item | Receiver | Why |
|---|---|---|
| `turnaround-followups` AC-1 + step 1.1 + its blocker | `road-to-obligation-delivery-verification.md` (**promoted `stubs/` → ACTIVE**) | Release is wall-clock-bound: 2 usable sessions exist against a bar of 10, and ~8 more operator sessions is not work |
| `governed-harness` Phase 7 (7.1-7.7) + step 0.8 + AC-9 + the `merge-authority` blocker + the Phase 0 carried condition | `road-to-harness-promotion-bridge.md` (**new ACTIVE**) | ADR-239 § Decision 3 reserves merge authority to the owner; no council may grant it |
| Phase 4 of council-topology (4.2, 4.4, 4.5, 4.6) | — | `[-]` NULL-CLOSED by 4.1's verdict, executing a recorded maintainer-owned resolution |

Nothing was cancelled. Every `[-]` in this run means TRANSFERRED or NULL-CLOSED and says so at the item.

## Defects the execution found, that the roadmaps did not

1. **`resume_probe` reports `fired` on an archived roadmap that transferred its criterion unresolved.** `gates --all` said `later/road-to-elicitation-front-door.md` was resumable because `road-to-suggestion-block-capture` archived. That roadmap archived with AC-4 `[~] TRANSFERRED UNRESOLVED`, and `docs/CLAIMS.md:903` records the claim it names as `status: unbacked`. Two causes: the archive short-circuit at `resume_probe.ts:517-520` is the **documented contract** (`:23-25`) while the `active` branch at `:526-534` does check the named step, and `STEP_REF_RE` at `:124` matches only `N.N` so `AC-4` never reaches a `stepIsDone` that would handle it correctly. **Not fixed** — changing it is a contract decision. Recorded at `stubs/road-to-resume-probe-archive-asymmetry.md`.

2. **A frozen holdout's `SET-SHA256` does not recompute.** `governed-harness` AC-6 pins `7e091dfc…`; the artefact's own recipe yields `0667fbd9…` over a byte-identical file set. Cause located: the freeze commit `34318f7f` **also edited three of the files it was freezing**; 97/100 rows reproduce. The ordering half of the AC is intact. AC-6 left open.

3. **AC-10 is falsified as written.** The `no-runtime-daemon` marker it requires to be byte-identical is **gone** from `README.md`, and `docs/CLAIMS.md` moved it `backed` → `withdrawn` — removed by `68463a1e` under ADR-249, a different roadmap. Left open rather than re-keyed: re-keying would close it by redefinition.

4. **Phase 2 of council-topology costs 20 UTC days and nobody knew.** The frozen call manifest — 384 cells, 16 arms — totals **1,584 calls minimum / 1,804 worst case** (anthropic 814/924, openai 770/880) at 50/provider/day. At one item per family and N=2. At three items per family it is roughly 60 days. During those days no other council work can run.

5. **At N=2 the same benchmark licenses no promotion claim at all.** The already-committed 2.6 floors are n≥5 / n≥10. Phase 2 as costed produces descriptive comparison only.

6. **The `### blocker:` prefix bit in both directions in one repository.** Leaving it on a transfer stub made `lint_roadmap_blockers` parse a dead entry as live — one blocker with two live owners, `open_blockers 31 → 32`. The parent separately documents a 2026-08-29 repair of the *opposite* defect, where a real entry lost the prefix and went invisible.

7. **Step 4.5 of `governed-harness` contradicted decision E5** — its text said *include the fifth criterion*, E5 records a 2/2 verdict that it is OUT. Amended as a transcription, not a new decision.

8. **The native code graph is default-off, so step 4.6 is built on a weaker substitute.** `agent-config code-graph detect` → `no code-graph source detected`. `discovery_graph` (785 nodes / 1672 edges) does not extract `requires_skills`, so a code-symbol candidate gets a weak neighbourhood. The module **refuses** an unresolved surface rather than silently selecting zero regressions.

9. **One council seat fails reproducibly on one question shape.** The anthropic seat returned `exit_1`, empty stderr, 0 tokens, ~87 s on **three** attempts at the twelve-stage question — full form twice, split form once — while answering the other five questions normally. Degraded to the single seat and recorded, per the mandate.

10. **A council question of this run carried its own defect, and both seats caught it.** The 4.4 brief grounded `WHERE` in "the six-rung ladder" and called the anchor obvious **without enumerating its six values**. Both seats refused to treat their own answer as more than conditional. The next attempt must paste `LADDER_RUNGS` into the brief.

11. **Asked twice, one seat gave two different twelve-stage enumerations** — different names, order, and placement of the statistical stage. That is what non-convergence looks like, and it is a second independent reason 4.1 stays open.

## Where the run stopped, and why

**Not on quota, and not on a wall.** Council quota ended the run at roughly 20/50 per provider. Every gate this run touched is green on all three branches, and CI is green on all three.

- **`road-to-turnaround-followups` — CLOSED and merged.** Its one unresolved criterion is alive in the active estate with a kill switch.
- **`road-to-governed-harness-evolution` — 33/59.** Phases 4-6 hold 18 open steps. Two of them (4.1, 4.4) now have a recorded `REVISE` and a named prerequisite each where before they had nothing; the rest need either the receipt producer that does not exist, or the three-arm delivery measurement (6.1), which is spend-bearing.
- **`road-to-inbox-harvest-…-council-topology-evidence` — 26/77.** Phase 2's manifest exists and prices the phase honestly; running it needs 20 days of exclusive quota. 3.3 stays blocked on a corpus that **cannot be committed** — `agents/runtime/council/` is gitignored and auto-pruned — which no quota reset touches.

**The shape worth naming, because it decided three dispositions this run.** Every criterion this run could not discharge was moved into a file that a gate can actually read, and each move was verified against the mechanism rather than assumed: the carry annotation was checked against `DEFERRED_STEP_RE`, the destination against the sweep's two-path candidate list, the back-link against its `^parent_roadmap:` regex. Two council rounds were spent establishing that a `stubs/` file is prose with no governance, and one seat's kill switch is the only reason that was checked at all rather than discovered later by a silent drop.
