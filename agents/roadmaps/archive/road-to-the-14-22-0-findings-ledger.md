---
complexity: lightweight
status: ready
estate_offset_exempt: "Offsets nothing, and the reason is that the finding is a live trunk-wide CI stop rather than a plan. `check_finding_dispositions` is a step in the `Sync + Generate Tools Consistency` job, which `docs/contracts/branch-protection-policy.md` names as this repository's only required status check — so it is red on every open pull request until this closes, verified on two unrelated branches on 2026-09-08 (PR #1944 and PR #1923, identical message). Archiving or parking an unrelated roadmap to buy room for a red that blocks the merge queue would be the laundering the estate ratchet exists to prevent, performed in the ratchet's name. There is also nothing to fold it into: `grep -rl release-findings agents/roadmaps/*.md` returns only this file. It carries a 30-day deadline it did not choose — the artifact holding the evidence expires 2026-10-08 — which is the other reason it cannot wait behind a disposal. MEASURED accounting rather than predicted, on the branch that added it: `check_estate_count` reports `+1 active / -1 disposed` with `active_roadmaps 7 (floor 7, +0)` and `open_blockers 43 (floor 44, -1)`, because the same change archives `road-to-a-standing-budget-with-headroom`. So this line is a declared claim and not a consumed allowance in this diff; it is kept because the addition genuinely offsets nothing of its own, and deleting it would leave the next reader unable to tell whether that was considered or overlooked."
execution:
  mode: phase-checkpoints
---
# Road to the 14.22.0 findings ledger

> **Source:** the `Sync + Generate Tools Consistency` job on PR #1944, 2026-09-08
> — `❌ 14.22.0 has shipped and carries no findings ledger at
> agents/evidence/release-findings/14.22.0.json.` Found while settling CI on an
> unrelated roadmap PR; confirmed identical on PR #1923, so it is trunk-wide and
> not that branch's doing.

## Goal

`agents/evidence/release-findings/14.22.0.json` <!-- ref-ignore --> exists, its
blocking findings carry real dispositions, and `check_finding_dispositions` is
green — so the only required status check on this repository stops refusing
every pull request.

The marker is there because the path deliberately does not resolve yet: its
absence IS the finding, and `check_references` flagged it as broken on the first
CI run — which is the defect arriving from a second direction rather than a
nuisance. It comes off in step 1.1, together with the file appearing.

## What is actually wrong

Release 14.22.0 published without its findings ledger. The gate's own comment in
`.github/workflows/consistency.yml:362-381` predicted this exact window: the
ledger's other caller is `release-validation.yml`'s `finding-dispositions` job,
gated on `startsWith(github.head_ref, 'release/')`, and that branch is deleted
after the merge — so the gate reddens on the first push to `main` after
publication, which is now.

**The evidence exists and is perishable.** The `release/14.22.0` self-review run
succeeded and uploaded a `self-review-findings` artifact
(`gh run view 34214806821`, 16,863 bytes, `retention-days: 30`). Measured by
ingesting it into a scratch copy on 2026-09-08 and then reverting: **56 findings
— 3 critical, 12 high, 27 medium, 14 low**, of which `check_finding_dispositions`
names **11 as blocking and undispositioned**. `review_independence:
single-member`, `acceptance_status: provisional`, one reviewer (`anthropic`).

So this is NOT the "reviewed nothing" case that four earlier releases hit — the
review ran and its output is recoverable until **2026-10-08**, after which the
release can never be honestly dispositioned.

## Phase 1 — Ingest, then disposition

- [x] **1.1 Ingest the artifact before it expires.** Mechanical, no judgement:
      `gh run download 34214806821 -n self-review-findings -D <dir>` then
      `./scripts-run src/scripts/check_finding_dispositions --ingest
      <dir>/self-review-findings.json --release 14.22.0`. Deadline 2026-10-08 —
      after that the artifact is gone and 1.2 becomes impossible rather than
      merely open.
      verify: `agents/evidence/release-findings/14.22.0.json` exists and carries
      56 findings; `check_finding_dispositions` moves from "no findings ledger"
      to naming undispositioned blocking findings, which is progress rather than
      a green.
      Done 2026-09-08 in PR #1950 (`fix/adr-266-finding-dispositions`), inside
      the deadline with a month to spare. Ticked here 2026-09-09 on verification
      rather than on the commit message: the file exists at 84,022 bytes and
      carries **56 findings — 3 critical, 12 high, 27 medium, 14 low**, which
      matches the count this step predicted from the scratch ingest.

- [x] **1.2 Disposition the 11 blocking findings.** Each needs
      `{finding_id, status: fixed|false_positive|accepted_risk, commit,
      rationale, verified_by}`. Three are `critical security` — the self-review
      gate having reviewed nothing for four consecutive releases, ADR-262
      deleting `status: carrier` without migrating enforcement, and vendored
      grammars added without a supply-chain verification surface — and eight are
      `high`, mostly claim-shaped (a modified claim text with no measurement
      change, an unbacked denominator, 14.21.0 findings dispositioned before
      14.21.0 shipped).
      **This is a review pass, not a form fill.** A `false_positive` or
      `accepted_risk` written without verifying the finding puts a false claim
      into a governance ledger, which is worse than the red it clears.
      verify: `./scripts-run src/scripts/check_finding_dispositions` exits 0.
      Done 2026-09-08 in the same PR. Verified fresh 2026-09-09:
      `check_finding_dispositions` prints `scanned: 56` and
      `✅ all 56 recorded finding(s) for 14.22.0 dispositioned (blocking ones
      completely)`.
      **It was a review pass, and the shape of the verdicts is the evidence for
      that.** The eleven blocking findings resolve as **8 `false_positive`, 2
      `accepted_risk`, 1 `fixed`** — not eleven acceptances, which is the
      pressure Risk 3 named. Every one carries a `verified_by` and a rationale
      between 1,120 and 2,300 characters that names the files and lines checked;
      the `fixed` row carries its commit. The step's own count ("nine
      dispositioned `false_positive` and one `fixed`") is superseded by the
      committed ledger: it reads 8 / 2 / 1, and the ledger is the record.
      **Both `accepted_risk` verdicts were accepted WITH A RECEIVER, and the
      receiver has since fired.** `bb9f81e64fae` (critical — vendored grammars
      with no supply-chain verification surface) and `d1696732ac28` (high — the
      manifest's eleven conditions are all self-referential) both name
      `road-to-the-14-22-0-disposition-residuals` steps 1.1/1.2 as what closes
      them. That roadmap was completed and archived on 2026-09-09 (PR #1953):
      `src/scripts/_lib/vendored_grammar_upstream.ts` anchors the vendored bytes
      to the locked upstream and refuses rather than passes when it cannot, and
      `packed_binary_predicate.ts` states its threat boundary.
      The two rows are deliberately NOT rewritten to `fixed`. A disposition
      records what was true at the release it dispositions; editing it later to
      match a subsequent fix would make the ledger describe a release that never
      shipped. The discharge is recorded here, where it happened.

## Closed 2026-09-09 — what actually happened

The section below was written on 2026-09-08 by the run that found the red and
declined to close it. Both of its stated reasons were answered, and by different
means, so it is kept rather than deleted:

- **The ingest and the eleven dispositions landed in PR #1950**, a PR whose whole
  scope was this ledger — which is exactly the "not inside an unrelated roadmap
  PR" the section asks for.
- **The council quota was not a permanent state.** It read 50/50 on both seats
  again on 2026-09-09, and `council_cli run --mode-override api --proceed-anyway`
  takes the metered rung per invocation; two rounds cost $0.123 in total. A seat
  at its CLI limit is not an unavailable seat.

This file was then complete and unticked for a day: the work was done in another
PR and nobody came back to close the roadmap. That is the reason it is being
closed on verification rather than on a commit message — every claim above was
re-run against the tree on 2026-09-09.

## Why an autonomous run did not simply close it

The run that found this ingested the artifact, watched the red change its message
rather than clear, and **reverted the ingest** rather than carrying another
release's governance file inside an unrelated roadmap PR. It did not attempt 1.2:
three critical security findings and eight claim findings need verification
against the tree, the AI council was quota-exhausted at 50/50 on both seats so
the judgement calls could not be routed, and writing 11 unverified dispositions
is the manufactured-evidence failure this repository has already recorded once.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The artifact expires before 1.1 runs | implementation | 30-day retention from 2026-09-08. After 2026-10-08 the 56 findings are unrecoverable and 14.22.0 joins the four releases that shipped with no honest review record — the exact defect one of its own critical findings names | 1.1 is mechanical, needs no decision, and carries the run id and the deadline in its own text; this file is `status: ready` so it sits on the dashboard rather than in a drafts pile | Phase 1 — Ingest, then disposition |
| 2 | 1.1 lands alone and reads as the fix | implementation | Ingesting changes the red's message, so a later reader may believe the ledger being present is the green condition | 1.1's own verify says in those words that the message change is progress rather than a green, and 1.2 carries the exit-0 check | Phase 1 — Ingest, then disposition |
| 3 | Dispositions get written to clear the red | product | Eleven blocking findings with a required status check waiting on them is maximum pressure to write `accepted_risk` eleven times | 1.2 states that an unverified disposition is worse than the red; the ledger schema demands `verified_by` and `commit` per finding, so a bare status is not writable | Phase 1 — Ingest, then disposition |

## Acceptance Criteria

- [x] AC-1 — `./scripts-run src/scripts/check_finding_dispositions` exits 0 with
      `agents/evidence/release-findings/14.22.0.json` committed, so the required
      status check stops refusing unrelated pull requests.
      Met. Verified 2026-09-09: exit 0, `scanned: 56`. The file is tracked on
      `main`. The trunk-wide stop this roadmap was opened for is gone —
      `Sync + Generate Tools Consistency` has been green on every PR since,
      including the two this file's own `estate_offset_exempt` cites as evidence
      that it was red (#1944, #1923), and on #1953.
- [x] AC-2 — Every blocking finding in that ledger carries a disposition whose
      `rationale` names what was checked, not only what was decided. A ledger
      that is green because eleven findings were accepted without evidence does
      not satisfy this.
      Met, and measured rather than asserted. All eleven carry `verified_by`;
      rationale lengths run 1,120–2,300 characters and cite files and line
      ranges. The verdict mix is 8 `false_positive` / 2 `accepted_risk` / 1
      `fixed` — the failure this AC forbids would be eleven bare acceptances,
      and two is what the ledger has, each with a named receiver that has since
      closed (see 1.2).
