# Inbox round inbox-2026-10-e — disposition

<!-- evidence-type: analysis -->

> **Source:** `agents/tmp.old/inbox-2026-10-e/` — fifteen external reviews of
> the 16.3.0 release in one file, a supplied 49-row rescore with its JSON, a
> supplied comparative locks check (plan v21), and a status note. Verified
> against `main` at `a75bb3210` on 2026-10-06 by seven independent read-only
> passes, one per review slice plus one for the rescore, each followed by its
> own second pass. Codenames only; the true source is recorded once, encrypted,
> in the round's intake note.

## Owner decisions required

Every item below has arrived at least three times. Each question is written onto
the object that holds it, so the next round meets a posed question rather than
re-deriving one.

| # | Held object | Arrivals | Question already posed there |
|---|---|---|---|
| 1 | `later/road-to-opencode-runtime-probe.md` (was `stubs/`) | 14 | Answered 2026-10-06: parked in `later/` with a wake on 2026-12-24 or the day a machine with opencode exists. |
| 2 | `road-to-adversarial-verification-and-long-runs.md` (auto-merge) | 3 | Keep `allow_auto_merge: true` per ADR-268 § 3, or set it `false` and amend § 3? |
| 3 | `stubs/road-to-consumer-capability-share.md` | 7 | The consumer-value budget question; the published 16.3.0 mix (23 vs 1) does not reproduce (83 vs 3). |
| 4 | `later/road-to-release-finding-ordering.md` | 5 | Authorise one synthetic `release/*` PR, move `review_by`, or cancel AC-2. |
| 5 | `stubs/road-to-adr-134-expiry.md` | 4 | Post the launch decision, a successor deferral, or record the lapse. |
| 6 | `stubs/road-to-subagent-return-gate.md` | 29 | Unchanged; council D1 (2026-10-06) already refused the reviewer's option until `ok` is non-zero. |
| 7 | `stubs/road-to-runtime-orchestration-substrate.md` | 15 | Unchanged owner question on the shared state envelope. |
| 8 | `stubs/road-to-instructions-loaded-observer.md` | 5 | Bound by owner D10 (2026-10-06); waits on a host session. |
| 9 | `stubs/road-to-code-graph-benchmark-rerun.md` | 74 | Benchmark subjects owner-answered as b4 in `a75bb3210`; nothing new. |
| 10 | `stubs/road-to-a-path-route-under-delivery.md` | 3 | Both closure routes owner-reserved (`thin_rules.ts:137-144`). |
| 11 | `road-to-leading-every-row.md` | 3 | Programme record only; the rescore folds are carried by this round. |

Two arrivals below the escalation line were counted too:
`stubs/road-to-assurance-benchmark.md` (2).

## What the round produced

Ten roadmaps, each `status: ready` (the tenth, `road-to-installed-links-of-every-kind`, is named below):

| Roadmap | Carries |
|---|---|
| `road-to-a-ratification-fence-that-follows-its-imports` | The kernel-edit fence misses `concern_failure_policy.ts` and five more modules the dispatcher imports, plus the bundle budget file; AC-3 of the archived plumbing roadmap ticked over an unmet half. Finding `21900086c1a0`. |
| `road-to-release-evidence-that-reproduces` | Published mix 23 vs 1 against a measured 83 vs 3; the self-review spends its six chunks on review-input copies the R2 reviewer already excludes; ratification headers not derived from seat verdicts; budget moves missed on the PR; release manifests unchecked by content. |
| `road-to-findings-that-get-a-disposition` | 44 of 45 16.3.0 findings undispositioned; `isBlocking` excludes every medium security finding; `doctor --json` reaches the network unconditionally. |
| `road-to-gates-a-pull-request-can-hear` | Workflow-security warn-only; pack boundaries in no workflow; a lint that rewrites a tracked report; canary without a caller; branch-protection doc against the ruleset. |
| `road-to-parked-blockers-that-get-asked` | 40 `later/` files with open blockers that neither the lint nor `/roadmap:resolve-blockers` sees; a `[x]` over "NOT met"; blocker `path:line` citations unchecked. |
| `road-to-a-ranker-whose-ties-break-on-signal` | Alphabetical tie-break decides about a fifth of tuning and sealed rows; abstention unmeasured. The rerank cut stays. |
| `road-to-touched-file-quality-that-says-when-it-did-not-look` | An ignored file reads as a pass; the type checker's skip is not named; the scoped-forms table is checked against a copied list. |
| `road-to-blocking-time-by-cause` | Blocking share 0.62 to 0.89 with no cause per long call. |
| `road-to-enforcement-per-obligation` | `enforced_by` is rule-level and over-credits rules with one gated clause. Council-first. |

Steps added to existing roadmaps: two installed-layer steps (a default install
receives bodies twice; pending reinstall) first landed as 2.5 and 2.6 of
`road-to-an-installed-layer-that-is-thinned` and moved the same day to
`road-to-a-default-install-served-once`, because that file's same-day review
stamp could not carry them;
`road-to-a-graph-that-feeds-the-gate` 3.5 (feeder latency before 3.4);
`later/road-to-learning-you-can-see-carried` 2.4 (the GUI toggle is inert).
Links from every installed kind landed as their own roadmap,
`road-to-installed-links-of-every-kind`, because the roadmap that owns rule
links was re-reviewed the same day and its register cannot record a second
review on one date. Two stubs: `road-to-host-capabilities-observed-per-leg-and-slot`,
`road-to-review-inputs-out-of-the-hot-tree`. One fix in this change:
`stack-composition-2026-Q4.md:83` read 12 / 12 / 6 and the table counts
13 / 11 / 6 (one site; no other copy of the wrong figure in the tree).

## Point ledger

Counted per slice from the seven passes. Claims are verified against the tree;
demands are discharged.

| Slice | Claims | Demands | Pass 2 added |
|---|---:|---:|---:|
| reviews 1–2 | 56 | 20 | 4 |
| reviews 3–4 | 34 | 17 | 2 |
| reviews 5–8 | 30 | 26 | 3 |
| reviews 9–10 | 40 | 10 | 2 |
| reviews 11–13 | 44 | 20 | 3 |
| reviews 14–15 | 47 | 24 | 3 |
| rescore | 7 | 18 | 2 |
| plan v21 + status note | 8 | 2 | 0 |
| **total** | **266** | **137** | **19** |

Demand discharges: adopted into one of the nine roadmaps, the five step
additions or the two stubs; already-satisfied with a `file:line`; owner-decision
(table above, or an owner blocker in a new roadmap); or declined, below.

Claims the tree contradicts, worth naming: the context-signal sweep of the
ranker never ran (0 of 390 corpus rows carry the fields); `lint_originality`
carries no ratchet; "auto-merge is disabled" is false (`allow_auto_merge: true`
since #2114); a release-findings index at `agents/evidence/release-findings/releases.md`
does not exist; the workflow-security step cannot fail a PR, contrary to one
review's reading; the `rule_layer_overlap` module is from 9.28.0, not this window.
Plan v21's single re-run trigger fired the same day (`a75bb3210` is the first
`/roadmap:resolve-blockers` run), so its owner-register count of 9 is overtaken.

## Declined, one sentence each

- **A general foreign-root fixture for every runtime path** — the sibling scan
  over hooks that read `dist/` found no second repo-only resolver.
- **A unified coverage vocabulary across subsystems** — a rename with no named defect.
- **Observing how the UI halt fires** — no field population; the counter would read zero by construction.
- **A guard-strength ratchet** (third arrival) — any diff to a `block_*.ts` already needs a ratification record, and "checks fewer cases" is not decidable from a diff.
- **Framework semantics for the graph** — behind the graph stubs' entry condition (a winning class), as decided in round `inbox-2026-10-a`.
- **Semantic rerank or an embedding router** — cut by the archived ranker roadmap until a deterministic signal is measured; not reopened.
- **A shadow-bar filter on `writer === 'consumer'` as one code line** — the bar is a hand-read claim; the owner blocker `shadow-corpus-is-one-machine` holds it.
- **Blocking share below 30 %, top-1 above 70 %** — recorded as external targets, not adopted.
- **The 49 matrix scores** — opinion; only the gap claims beside them were verified.

## Coverage

```
batch     1 topic of 1; nothing deferred
sources   4 files, 1 source set, no revision sets
anchors   849 counted (census) → every anchor mapped to a row or a no-demand reason in its slice
passes    pass 1: 7 slices · pass 2: +19 rows · pass 3: 0 adopted-not-found
```
