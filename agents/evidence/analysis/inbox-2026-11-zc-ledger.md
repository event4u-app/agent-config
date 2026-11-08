<!-- evidence-type: analysis -->

# Round inbox-2026-11-zc: point ledger and coverage, 2026-11-08

**Tree pin:** `ea21dd17a4`. **Sources:** `agents/tmp.old/inbox-2026-11-zc/`. There are three topics, 12 files and 664 anchors (`inbox_source_census`), and the lineage is clean. The intake note holds the true source as `ENC1`.

## Passes

- **Pass 1** extracted 138 claims, 55 demands and 83 instructions across t1, t2 and t3.
- **Pass 2** re-read each topic against the pass-1 ledger. It added 9 rows: the second shared-file fallback (`pendingFileFor`), the manifest-naming denies, the `rule_trips` green skip, the quote fence, and five owner demands from t1 `chat.txt:616-620` and t2 `writ.txt:7-17`. A third pass found nothing new, so the extraction converged at pass 3 and did not stop at the cap.
- **Pass 3** read the emitted text back against the ledger. Every `adopted` row below is findable at its target.

## Claims overtaken by the tree

- Git commits not bound to a reference: they are bound now.
- The four-arm trial: done.
- PR #2919: merged.
- "647 clauses": the tree has 680 clauses over 28 rules.
- README:120: the claim was never true at any commit, so it is declined.

## Dispositions

| Point | Topic | Disposition | Where |
|---|---|---|---|
| Credential deny prints its kill switch; lint misses it | t2 | adopted | `road-to-denies-that-name-no-bypass` 1.1, 1.2 |
| Denies tell the agent to remove their manifest entry | t2 | adopted | same, 1.3 |
| Deny drill skips green without a bundle | t2 | adopted | same, 1.4 |
| Recall fence closable by `"` | t2 | adopted | same, 2.1 |
| Empty session id shares the authorization file (two sites) | t2 | adopted | same, 2.2 |
| Start footprint ≤40k / ≤20k | t2, t3 | adopted, parked behind the comparison | `later/road-to-a-start-as-light-as-the-field` |
| No new start architecture before effect proof | t3 | adopted as that file's blocker | same |
| Adapt before removing (owner) | t1 | adopted | `later/road-to-proof-where-the-owner-sees-it` 4.6 and Arrivals 3 |
| Lower real model cost first-tier (owner) | t1 | adopted | same, Arrivals 3 |
| Look-first wording accepted (owner), 3rd arrival | t1, t3 | owner-decision (kernel PR) | same 1.6 |
| Per-model sets (owner) | t1 | adopted | `later/road-to-benchmark-obsolescence-lifecycle` Arrivals 3 |
| Full-vs-reduced bench before release, 4th arrival | t3 | owner-decision (spend, release gate) | `later/road-to-a-setup-that-decides-itself-carried` 5.2 |
| Self-issued billing yes, recurrence | t2 | owner-decision | `later/road-to-typed-grants-that-persist` Arrivals 3 |
| Opt-in ref gate for bulk-deletion commits | t2 | owner-decision | `later/road-to-a-hard-floor-the-shell-cannot-talk-past` Arrivals 3 |
| Learned changes measured in combination | t1 | adopted | `later/road-to-a-learner-the-measurements-gate` Arrivals 3 |
| Discipline profile "already loads" | t2 | diverged; stub keeps the wiring | `stubs/road-to-a-discipline-profile-that-loads` Arrivals 2 |
| Identical-failure budget | t3 | adopted | `stubs/road-to-a-strike-that-speaks` item 6 |
| Compaction outcome criterion | t3 | adopted | `road-to-state-and-pins-across-compaction` AC |
| Routing cause first | t3 | already-satisfied as open work | `road-to-routing-assurance-live-floors-carried` 1.3, 1.3b |
| Council round cap of about 3, then owner | t3 | owner-decision (governance self-amendment) | escalation block of this round |
| Numeric cost target; re-measure on current Sonnet and Opus | t1, t3 | owner-decision (spend) | escalation block of this round |
| Kernel cut binding | t2 | owner-decision | escalation block of this round |

**Collision noted:** in t2, two different demands both carry the id `D14`. Each was dispositioned on its own text.
