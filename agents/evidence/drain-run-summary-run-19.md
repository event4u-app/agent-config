<!-- evidence-type: analysis -->
# Autonomous roadmap-drain — run 19, 2026-09-03/04

> **Sibling of `drain-run-summary.md`, not a replacement for it.** That file
> holds **run 18** of the same day and is marked `current-binding`. This run was
> asked to write its summary to that path; doing so would have destroyed run
> 18's record, which is irreversible and not a thing an autonomous run should
> decide. If the series convention is genuinely single-file, promoting this over
> it is a one-command maintainer action; until then both records exist.

Machine-readable summary of one autonomous drain over
`event4u-app/agent-config`. Five active roadmaps entered the run; five have a
pull request and a terminal disposition. No question was put to the maintainer;
every decision went to the AI council.

## The inventory the run actually found

The seed order supplied with the mandate listed **36** roadmaps. The live tree
held **5**. The seed was recomputed rather than trusted, which is why the queue
below bears no resemblance to it.

Queue rule applied: all five were at 0 % progress, so they sorted ascending by
declared complexity, then by checkbox count.

## Pull requests

| # | PR | Roadmap | Disposition | Steps |
|---|---|---|---|---|
| 1 | [#1831](https://github.com/event4u-app/agent-config/pull/1831) | `road-to-declared-coverage-truth` | **complete, archived** | 9/9 + 4/4 AC |
| 2 | [#1833](https://github.com/event4u-app/agent-config/pull/1833) | `road-to-tell-currency` | **complete, archived** | 11 done · 3 deferred · 0 open |
| 3 | [#1834](https://github.com/event4u-app/agent-config/pull/1834) | `road-to-binding-findings` | **complete, archived** | 18 done · 2 deferred · 0 open |
| 4 | [#1832](https://github.com/event4u-app/agent-config/pull/1832) | `road-to-council-topology-evidence-followups` | **cannot close — corrected in place** | 0/38, unchanged by design |
| 5 | [#1835](https://github.com/event4u-app/agent-config/pull/1835) | `road-to-python-era-doc-references` | **re-scoped, then complete, archived** | all met under the narrowed definition |

## Council decisions

Four rounds, all at $0.0000 (subscription transport). Quota after the run:
anthropic 24/50, openai 24/50.

| Round | Seats | Verdict |
|---|---|---|
| `declared-coverage-truth` — 3 execution decisions | **1 of 2** (openai transport failure, `os_error: ENOBUFS`) — **DEGRADED, recorded as such** | **AMEND all three** |
| `tell-currency` — 6 interlocking forks | 2/2 | judgment-only detectors · guidance to `fe-design` · T4 deferred · corpus in scope |
| `binding-findings` — 10 forks | 2/2 | **partition**: close the verifiable work, split the ordering guarantee |
| `python-era-doc-references` — 7 decisions incl. "worth doing at all" | 2/2 | **narrow, do not decline**; pin the matcher; no new gate |

### Decisions that changed shipped behaviour

- **`endpoint` as a trigger keyword was narrowed after the council refuted the
  argument for it.** The execution had defended a bare `endpoint` as having no
  honest near-miss; the council named "Document the API endpoint parameter",
  which the rule's own § When NOT to fire excludes. The claim was false, so the
  trigger became `public endpoint` + `status endpoint`.
- **`road-to-python-era-doc-references` was re-scoped, not executed as written.**
  Its own premise — repair 946 occurrences across 233 files — was larger than the
  churn ADR-200 explicitly declined. 94 occurrences were repaired; the rest is
  dispositioned per class.
- **`road-to-binding-findings` was partitioned.** Four authorization defects and
  the release ledger closed; the ordering guarantee could not.

## Descopes, each with a named receiver

| From | What | Receiver | Why |
|---|---|---|---|
| `tell-currency` 1.1, 3.2, AC-3b | fixture corpus; the T4 widening | `later/road-to-tell-detector-promotions.md` | the clean corpus carries no near-miss for the four new tells, so an `M1 = 0` would be a vacuous pass; and T4 is `backed`, so its prose cannot move without its rule |
| `tell-currency` 4.1 remainder | 41 grounding-corpus collisions | `later/road-to-grounding-corpus-catalog-parity.md` | "stated as intentional" would be false — they are defects; the first step is a scope decision, not an edit |
| `binding-findings` 1.1, AC-2 | the release-finding ordering guarantee | `later/road-to-release-finding-ordering.md` | **Hard Floor.** The demonstration needs a synthetic `release/*` pull request, which `non-destructive-by-default` names and no autonomy lifts |
| `binding-findings` — 3 findings | `9b91a14e9d35`, `0687468c0d65`, `26c9fdbcedc2` | same receiver | dispositioned `accepted_risk` with a receiver rather than an expiring note |

Three `later/` roadmaps added, each claiming its estate growth with a reason.
`check_estate_count` green on every branch.

## The one roadmap that could not be closed, and why that is correct

`road-to-council-topology-evidence-followups` is a **deferral carrier** holding
38 open obligations. Its own recorded boundary is a 2-round, 2/2-quorum council
verdict on this exact question: *preserve all 38 in place · preserve the three
resumption triggers · do not archive, cancel, promote or transfer · do not claim
its work is complete.* The file additionally states that re-asking after an
unwelcome verdict is verdict shopping. Under the decision-revisit gate that is a
mechanism match with no new counter-evidence, so no new council was convened and
the lock applies.

The two facts that would have to move, both re-measured in the run:
`council:status` reports **2 enabled of 5** seats against a trigger needing
`n >= 5`; and the Phase-2 benchmark needs **1,584–1,804 provider calls across 20
consecutive UTC days**, monopolising both seats — which are the repository's own
decision mechanism.

All 38 checkboxes are byte-identical. Four factual claims were corrected.

## Defects found that no roadmap had named

| Found | Where | Fixed |
|---|---|---|
| A trailing negation leaked on the `release` op — `"Nach Release 1.5 bitte nicht mergen."` authorized `release` | authorization hook | yes |
| The `pr-merge` pattern carried its **own** inline negation lookbehind — the duplicate vocabulary its own comment warned would drift, and had | authorization hook | yes |
| `jetzt` was in the imperative-escape list and `now` was not, so the German sentence authorized and the English one did not | authorization hook | yes |
| A **second** silent persistence swallow ~130 lines from the one the roadmap named | authorization hook | yes |
| `transition-all duration-200` in a column literally named `Code Example Good` — the `backed` M4 tell handed over as the good example | grounding corpus | yes |
| Two catalog id ranges (`V1–V7` / `L1–L8`) that read as correct and made three `backed` entries unreachable | two apply skills | yes |
| 35 present-tense claims naming a dead `.py` path in `docs/contracts/`, where the roadmap knew of one | contracts | yes, plus a tail — 94 total |
| A live normative contract excluded from its own roadmap's work set by a `CHANGELOG*` glob that protected nothing else | `CHANGELOG-conventions.md` | yes |

## Defects the run introduced and caught itself

Recorded because a run that only lists what it fixed is not a record.

- Two sentences called a now-`.ts` target "the Python module" / "Python" — a
  *new* false claim created by fixing the path alone.
- A `.ts` import specifier `tsc` rejects — caught by the pre-push typecheck.
- Box-drawing dividers in a comment — caught by `lint_code_comments` on CI.
- `review_independence: null` on the release ledger, which asserts the enum's
  missing value and is worse than absent — caught by `check_review_schema`.
- **Two tests that measured their machine rather than the code**: a `git show`
  probe against a base commit a shallow CI clone cannot resolve (reproduced
  against a real `git clone --depth 1`), and a `chmod 0o500` probe a root runner
  ignores. Both now skip on an explicit environment fact.
- My own roadmap tripped `check_references` by quoting example paths;
  `<!-- ref-ignore -->` added.
- A forbidden roadmap-path citation from a stable artifact, and a stale
  `stubs/` path — caught by `check_no_roadmap_refs`.

## Honest limits of this run

- **One council round was DEGRADED**, not convergent: `declared-coverage-truth`
  answered 1 of 2 seats on a transport failure. Its verdict is reported as one
  voice throughout, never as agreement.
- **One council round split** on `tell-currency` Fork 5. Resolved toward the
  stricter reading with the reasoning recorded, not presented as consensus.
- **A recon subagent's transient reading was rejected** rather than used: it read
  one council seat as `unavailable`, and a direct `council:status` showed both
  `available`. The stale figure is deliberately absent from the roadmap.
- **Iron Law 3 fired on two archivals** (unresolved `[~]` items normally require
  asking the maintainer). Under this run's mandate that routed to the council,
  which ruled on both; the archiver's own `deferralProblems` check passed.
- **No roadmap was closed by weakening a gate.** One budget breach was paid by
  condensing the same file's own frontmatter comment (+40 tok → +6) rather than
  raising the ceiling the budget file itself refuses to raise.
- **The nine dead documentation links were not repaired** and are not claimed to
  be. A prior recorded decision dispositioned them and named the work required;
  re-taking it would relitigate a lock without new evidence.

## Verification posture

Every roadmap's PR carries its gate output. Across the run: the full local
vitest suite, the roadmap gate battery, `check_estate_count`,
`lint_plan_risk_register`, `check_references`, `check_review_schema`,
`check_finding_dispositions`, the design-slop M1 bench, and the changed-files
typecheck and lint pass. Remote CI is the authoritative gate and every red it
reported was read, reproduced locally, and fixed — never bypassed.
