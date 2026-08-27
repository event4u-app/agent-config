<!-- evidence-type: analysis -->
# Autonomous roadmap-drain run — 2026-08-27

The only report the maintainer reads. Every claim below was verified in this run;
where something was not done, it says so.

## PRs

| PR | Roadmap / subject | State |
|---|---|---|
| [#1675](https://github.com/event4u-app/agent-config/pull/1675) | `road-to-evidence-gated-change` | **merged** |
| [#1679](https://github.com/event4u-app/agent-config/pull/1679) | `road-to-consumer-repo-reality` | **merged** |
| [#1685](https://github.com/event4u-app/agent-config/pull/1685) | `road-to-kernel-invariant-restoration` — archived as **transferred** | **merged** |
| [#1687](https://github.com/event4u-app/agent-config/pull/1687) | three lapsed beta contracts — **unblocked every open PR in the repo** | **merged** |
| [#1682](https://github.com/event4u-app/agent-config/pull/1682) | `road-to-consolidation-lineage-integrity` | open |
| [#1683](https://github.com/event4u-app/agent-config/pull/1683) | `road-to-database-advice-correction` | open |
| [#1686](https://github.com/event4u-app/agent-config/pull/1686) | `road-to-turn-bound-authorization-integrity` | open |
| [#1689](https://github.com/event4u-app/agent-config/pull/1689) | `road-to-undeclared-obligation-disposition` | open |

Six roadmaps closed and archived; one infrastructure fix that was blocking all of
them.

## The one that mattered most, and it was not a roadmap

**Three contracts carrying `keep-beta-until: 2026-08-26` lapsed overnight.**
`check_beta_review_markers` hard-errors on a *fresh* lapse — one not in the
frozen baseline, *which may not grow* — so as of 2026-08-27 **every open PR in
the repository failed CI for a reason none of their authors caused.** Six were
blocked, including four of this run's own.

Each contract was read in full and disposed of on its own evidence: one promoted
(`promote-to: stable`), two extended to dates **derived** rather than chosen — an
anchor contract's own beta expiry, and the day after a demand-gate window closes.
Two defects surfaced while reading: a dead normative citation to a workflow that
does not exist, and five stale `.py` pointers left by the Python→TypeScript port.

## Council decisions — 7 sessions, $0.31, and one reversal

Every owner-reserved blocker went to the AI council under the maintainer's
delegation. Verdicts are transcribed into `agents/evidence/council/` rather than
linked, because council artefacts are gitignored and auto-pruned.

| decision | verdict |
|---|---|
| lineage-check enforcement surface | 2/2 — both surfaces, report-mode |
| kernel roadmap disposition | 2/2 — archive as transferred, **after** a dashboard-visible queue verified to render |
| migration recovery contract | 2/2 — two-branch, with an in-file, evidenced, owned roll-forward plan |
| small-table indexing wording | 2/2 — FK/uniqueness is the rule; three concepts kept apart |
| three beta contracts | 2/2 — extend · promote · extend |
| adoption-floor **recheck** | 2/2 — **reversed** an earlier PROMOTE from the same day |
| 221 preamble tokens | **1–1, no convergence — and moot, on a framing I got wrong** |

**The reversal is recorded, not hidden.** Round 1 decided a contract on a framing
*I* wrote that asserted "nothing in the file is marked open" — which was false.
The re-put stated the correction, quoted the earlier verdict back, and asked the
seats to say plainly if they were holding it. Both changed their answer, one
writing *"I am not holding an earlier verdict; on the corrected record, my
verdict is B."* The other two contracts were **not** re-put: a correction is to
one framing, not a second bite at the round.

**A second framing error surfaced after that.** The 221-token question was put to
the council as though the preamble ceiling were enforced only by a report-only
workflow; it is enforced by a test too, so the option that "won" was never
available. Recorded rather than quietly dropped — twice in one run is a pattern,
and the pattern is mine: I write the framings.

**Four council verdicts came back stricter than the roadmap's own
recommendation**, and that is the useful part: each seat independently found a
recommendation that could be satisfied by a *label* rather than by the thing the
label names.

## What actually changed in the tree

- **A notification is no longer a user turn.** A background task notification
  arrives on `user_prompt_submit` and was rewriting the git-authorization ledger
  to `authorized: []` mid-run — two measured stalls, and a working method that
  existed only to route around it. The retention semantics were never the bug;
  the input classification was. Fixed at the slot, not in one hook, so the
  suggestion-capture latch was fixed by the same predicate. Sabotage-verified in
  both suites.
- **A consolidation cannot silently omit a parent.** Four inbox folders declaring
  a consolidation, four with an incomplete lineage. The new checker reproduces
  the census exactly from committed fixtures and **found two folders the census
  missed**.
- **Four folklore passages** in database guidance that ships to every consumer
  install — composite-index ordering, `type=ALL` as a defect, unconditional
  subquery rewriting, and two absolute rules colliding on every small child table.
- **Two linters that nothing ran are now wired into CI**, taking the enforcement
  headline from 15/120 to 17/120. Found by declaring the rules that name them —
  and the declarations themselves could not ship, see below.

## Findings that were not on any roadmap

- **Three linters exist and nothing invokes them** — `lint_persistence.ts`,
  `lint_skill_frontmatter_safety.ts`, `bench_cross_source_eval.ts`, reachable from
  no workflow, taskfile or config.
- **The enforcement-coverage ratchet punishes honest declaration.** Two of its
  checks fired on a change that declared 14 rules truthfully, reporting events
  that did not happen — a rule with no declaration has no carrier, so declaring
  one can only *raise* both counters.
- **A cluster gate read the canonical metric but not its canonical exceptions**,
  on a pair sitting **14 millionths** below its threshold.
- **`origin/main` measures exactly the preamble grace ceiling, to the token**, and
  the ceiling is enforced by a test as well as by CI. So **no rule may gain an
  `enforced_by` field at all** right now: all 14 dispositions overshoot by 221,
  seven of them by 72, none by −17. The 82-rule cohort is fully dispositioned in
  the evidence report with exact declaration strings; not one could be written.

## Descoped, and where each went

Nothing was dropped silently. Two items no agent may execute are in the
owner-decision queue, counted by `agent-config stubs:due` and in the dashboard
header:

| stub | why it is human-only |
|---|---|
| `road-to-kernel-clause-1-restore` | `block_kernel_rule_writes` denies the write; `scope-control` requires an own PR with a ≥ 24 h soak no autonomous mandate lifts |
| `road-to-preamble-transfer-debt-221` | 14 decided declarations the ceiling will not admit, listed verbatim so applying them is mechanical |

**The kernel edit has not been made.** `check_rule_invariants` still exits
non-zero on `main`, and AC-1 of that roadmap is recorded as **NOT MET**. Its
checkbox flips because the item has a durable home, never because it landed.

## What was not attempted, and why

Eight roadmaps remain active. They were not reached, and the honest reason is
scope rather than blockage: `-database-erd-landing` needs a git-op authorization
and a contested `skill_count` allowance; `-database-evolution-tactics` and
`-database-relational-modeling` are 30 and 34 steps with infrastructure gates;
`-experience-loop-broadening` (47), `-capability-native-execution` (54),
`-governed-harness-evolution` (58) and `-inbox-harvest-2026-08-e` (77) are large
structural files, the last two with five and six blockers. Three more landed
from other sessions while this run was in flight.

**The estate did not reach zero, and it moved against the drain**: 12 active at
the start, 14 now — six archived here, and more authored by parallel sessions
than this run could close.

One reframing from the council is worth carrying: *"drain to empty"* and *"drain
of agent-actionable work"* are different goals, and only the second is
meaningful. A roadmap holding nothing but human-authorized edits is the boundary
of agent authority working as designed, not unfinished work.
