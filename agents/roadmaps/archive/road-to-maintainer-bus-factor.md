---
complexity: structural
status: ready
---

# Road to maintainer bus-factor — make the project reviewable and inheritable, and dogfood its own review machinery

> The project is positioned as a governance *standard*, but ships like a
> single-maintainer repo: no CODEOWNERS, 8.0.0 solo-merged, no external
> reviewers. The bus-factor is 1. Two things are controllable without inventing
> contributors: (1) put the package's OWN review machinery (`ai-council`,
> `adversarial-review`, `agent-security-review`) on the critical path as a
> standing second set of eyes; (2) make a release *inheritable* — a documented,
> reproducible verification runbook a second maintainer could execute. This
> roadmap does both, honestly bounded: an AI gate is not a human reviewer, and
> the roadmap says so.

## Outcome (2026-08-20)

Closed against explicit outcome states, per the framework of record in
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md) <!-- ref-ignore -->
(on `main` with PR #1463; today on `origin/drain/council-records`, so this is a
deliberate forward reference). Four items took council disposition **B** and are
**transferred** to
[`stubs/road-to-bus-factor-external-actions.md`](stubs/road-to-bus-factor-external-actions.md),
which carries each verbatim with a named producer, a detection probe and that
probe's measured baseline.

| Acceptance criterion | Outcome | What was satisfied | What is transferred |
|---|---|---|---|
| 1 · required, recorded dogfooded gate + proof page | **transferred** | Gate workflow, harness, and teeth (`classifyBlocking` / `gateVerdict`), plus the deterministic large-diff escalation | The live run and the proof-page claim — `ANTHROPIC_API_KEY` is absent, so no live review has ever run |
| 2 · CODEOWNERS + branch protection | **transferred** | `.github/CODEOWNERS` over the sensitive surfaces; the CONTRIBUTING rationale | The ruleset write. Live ruleset 17749383 has `require_code_owner_review: false`, `required_approving_review_count: 0`, and one required check — solo merges bypass the gate |
| 3 · inheritable release | **transferred** | `docs/release-runbook.md` + `docs/succession.md` | The cold dry-run by a human without prior runbook knowledge |
| 4 · honest reviewer count | **satisfied** | Tracked and *corrected* this run: the figure was stale and its recompute command read 30 of 1228 PRs | — |

**The bus factor is still 1.** The dashboard renders this roadmap at 100 %
because zero `[ ]` and zero `[~]` remain and `[-]` reads as complete. That
percentage describes who can do the residual work, not that the goal was
reached — which is exactly why the outcome states above exist and why criterion 4
is the only `satisfied` row. Distinct reviewers over the trailing 90 days is 1;
the second account that can merge has only self-merged unreviewed, widening who
can ship rather than who checks. Do not read the percentage as achievement, and
do not archive on the strength of it.

## Goal

Lower the bus-factor from 1 toward resilient: a required, dogfooded self-review
gate on every non-trivial PR, CODEOWNERS + branch protection, and a
release-verification runbook + succession doc that let a second person (or the
maintainer after a gap) ship a correct release without tribal knowledge.

## Context (measured, do not relitigate)

> Contributor-side complement: the `/contribution-precheck` command
> (`src/domains/meta/contribution-precheck/command.md`) gives external
> contributors the local PR-gate subset — link, don't duplicate, when phase
> items touch contributor process.

- Bus-factor signals (fresh `main`): no `.github/CODEOWNERS`; 8.0.0 (PR #764)
  solo-merged, 1 participant, no external reviewers, 37 checks green. Community
  scaffolding present (issue templates, PR template) but no review requirement.
- The review machinery to dogfood already exists in-repo: `ai-council`,
  `adversarial-review`, `agent-security-review` skills; advisor personas
  (`contrarian`, `first-principles`, `outsider`, `executor`, `expansionist`);
  `gateVerdict()` / council-verdict pattern; `check_claims.ts` and the proof
  drift gates.
- Honest bound (state it, don't paper over it): an AI adversarial-review gate
  raises the floor and catches regressions/claim-drift, but it is NOT equivalent
  to independent human review. The goal is resilience + reviewability, not a
  claim of external validation.
- The heavy CI (633+ test files, determinism/checksum/claims gates) already
  makes releases mechanically verifiable — what's missing is the human/process
  layer that makes them *inheritable*.

## Prerequisites

- [x] AI review machinery exists (`ai-council`, `adversarial-review`,
      `agent-security-review`, advisor personas).
- [x] Mechanical release gates exist (tests, determinism, claims).

## Phase 1 — Dogfood the review machinery as a pre-merge gate

- [x] Add a required PR workflow that runs `adversarial-review` +
      `agent-security-review` (and, for large diffs, `ai-council` with the
      advisor personas) against the diff, posting findings as a review. This is
      the package reviewing itself with the exact machinery it sells.
      <!-- PARTIAL 2026-07-10: the ADVISORY + INERT-WITHOUT-SECRET half shipped —
      `.github/workflows/self-review-gate.yml` (mirrors cross-model-canary: a
      no-spend dry-run plan job on every PR + a secret-gated live-advisory job
      that posts findings and skips as a logged no-op when ANTHROPIC_API_KEY is
      absent) driving `src/scripts/self_review_gate.ts` (loads the two review
      skill bodies as the system prompt, collects structured findings, posts a
      PR review). -->
      <!-- done 2026-07-20: part (c) large-diff ai-council escalation landed —
      `escalationReasons(files, changedLines)` (pure, unit-tested) flags a large
      diff (≥ 400 changed lines) OR a claim-affecting surface (CLAIMS/proof/
      comparison/README); the dry-run plan prints it and the posted review
      RECOMMENDS a maintainer `/council:pr` run. Detection is deterministic +
      zero-spend; per blocker `self-review-gate-cost` the paid multi-model
      council stays a run-time-authorized act, never a CI surprise-spend.
      Documented in docs/self-review-gate.md § Escalation. Remaining
      MAINTAINER-only: (a) the API secret + per-PR budget to run LIVE,
      (b) making it REQUIRED = Phase 2 branch protection. -->
- [x] Define the gate's teeth: security-sensitive or claim-affecting findings
      block merge; style findings advise. Wire the verdict through the existing
      `gateVerdict()` pattern so the outcome is recorded, not just printed.
      <!-- council 2026-07-08 (claude-sonnet-4-5 + gpt-4o): confirmed this
      exact shape — block ONLY on security/claim findings; full ai-council
      only on large or claim-affecting diffs; a 100%-blocking gate at
      solo-maintainer token cost would be ignored or gamed. -->
      <!-- done 2026-07-10: `self_review_gate.ts` exposes pure, unit-tested
      `classifyBlocking()` (blocks iff kind∈{security,claim} × severity∈
      {critical,high}) + `gateVerdict(findings,{enforce})` mirroring
      `check_quality_regression.gateVerdict` (0 pass / 2 block). The verdict is
      RECORDED via `renderReview()` (advisory phrasing = "WOULD block"), not just
      printed. Shipped `enforce:false` (advisory); the `--enforce` flip that
      arms the teeth is the maintainer's act, one flag. -->
- [-] Record it honestly on the proof page: "PRs pass a dogfooded AI
      adversarial-review + security gate; this is a floor, not independent human
      review."
      <!-- OPEN 2026-07-10: the literal "PRs pass a dogfooded AI gate" proof-page
      CLAIM is FALSE while the gate is inert-without-secret (no live run), so
      recording it now would breach check_claims / no-invented-facts. The honest
      advisory status IS documented in `docs/self-review-gate.md` (gate exists,
      advisory, inert without the secret; how to arm it). The proof-page floor
      CLAIM is the maintainer's to create the moment the gate goes live with the
      secret — not before. -->
      <!-- OPEN — same `self-review-gate-cost` block (the teeth decision). -->
      <!-- DEDUPED 2026-08-14: this step appeared TWICE, verbatim, with the
           second copy carrying only a weaker note ("records the Phase-1 gate,
           which is deferred above"). Both described one act, so the duplicate
           inflated count_open by 1 and would have needed closing twice. The
           surviving copy keeps the fuller note, which names WHY the claim
           cannot be recorded yet (check_claims / no-invented-facts while the
           gate is inert without the secret). No obligation was dropped. -->
      <!-- verified 2026-08-20: `gh secret list` returns exactly four repo
           secrets — CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN,
           CLOUDFLARE_WORKER_SUBDOMAIN, MCP_SMOKE_TOKEN. `ANTHROPIC_API_KEY` is
           ABSENT, so `live-advisory` is still a logged no-op and no live
           dogfooded review has ever run. The claim therefore remains FALSE and
           unrecordable. -->
      <!-- decision 2026-08-20: transferred to
           stubs/road-to-bus-factor-external-actions.md (council disposition B,
           outcome: transferred) — the stub carries this item verbatim with a
           named producer, a detection probe and the probe's measured 2026-08-20
           baseline. Marked [-] (not doable in this environment),
           NOT cancelled. Missing: the ANTHROPIC_API_KEY repo secret plus one
           live gate run. This step is still REQUIRED and stays maintainer-owned
           — see docs/self-review-gate.md § Arming it, item 4 ("Record the floor
           CLAIM on the proof page once it is live — not before"). Reversible:
           restore to [ ] the moment the secret is armed. -->

**Exit:** a required, recorded self-review gate runs on every non-trivial PR.
**Rollback:** demote to advisory (one workflow flag) — but a governance package
that won't gate its own PRs undercuts its thesis; prefer keeping teeth.

## Phase 2 — CODEOWNERS + branch protection

- [x] Add `.github/CODEOWNERS` mapping the sensitive surfaces (kernel rules,
      router compiler, install/uninstall, hooks, claims/proof generators) to the
      maintainer today, and to future co-maintainers as they appear.
      <!-- done 2026-07-09: .github/CODEOWNERS maps kernel rules, router
      compiler, install, hooks, claims/proof generators, release pipeline,
      workflows, and schemas to @matze4u (real paths verified). Enabling branch
      protection to REQUIRE Code-Owner review is the repo-admin step below. -->
- [-] Turn on branch protection requiring: green CI, the Phase-1 self-review
      gate, and CODEOWNERS review on the sensitive surfaces — so even the solo
      maintainer merges through the gate, not around it.
      <!-- OPEN — repo-admin action (GitHub → Settings → Rules), not a code
      change. CODEOWNERS is in place; requiring it via branch protection is the
      maintainer's UI step (branch-protection-policy.md is the source of truth). -->
      <!-- verified 2026-08-20: live ruleset READ (no write) via
           `gh api repos/event4u-app/agent-config/rulesets/17749383` — id 17749383
           "main protection", enforcement=active, updated_at 2026-06-16, applies to
           ~DEFAULT_BRANCH. It blocks deletion and non-fast-forward and requires a
           PR, but `require_code_owner_review: false`,
           `required_approving_review_count: 0`, and the required-check list is
           EXACTLY ONE context ("Sync + Generate Tools Consistency") — the
           Phase-1 `Self-review gate` check is NOT in it. So all three things this
           step asks for are measurably absent. The live state matches
           docs/contracts/branch-protection-policy.md § What is actually enforced
           byte-for-byte, so there is NO doc drift to fix (risk-register row 3
           is currently clean). -->
      <!-- decision 2026-08-20: transferred to
           stubs/road-to-bus-factor-external-actions.md (council disposition B,
           outcome: transferred) — the stub carries this item verbatim with a
           named producer, a detection probe and the probe's measured 2026-08-20
           baseline. Marked [-] (not doable in this environment),
           NOT cancelled. Missing: an admin ruleset WRITE on the production trunk
           — a Hard-Floor action under non-destructive-by-default that
           branch-protection-policy.md § Enforce half reserves to the maintainer
           and calls "deliberately NOT agent-executable". No human was reachable
           to confirm, so the conservative reversible option is to leave
           enforcement untouched and record the measurement. -->
- [x] Document the "why" in CONTRIBUTING: the maintainer holds themselves to the
      same gate as a contributor (the point of a governance standard).
      <!-- done 2026-07-09: CONTRIBUTING.md § "Reviewability and the self-imposed
      gate" — CODEOWNERS routing, the maintainer-through-the-gate principle, the
      honest AI≠human-review bound, and the small second-reviewer on-ramp. -->

**Exit:** CODEOWNERS + branch protection in effect; no direct-to-main merge on
sensitive surfaces bypasses the gate.
**Rollback:** loosen branch protection (repo setting) in a genuine emergency,
logged.

## Phase 3 — Make a release inheritable (the runbook)

- [x] Write `docs/release-runbook.md`: the exact, reproducible steps to cut a
      release — which gates must be green, how to run the benchmark sweeps and
      pin reports, how to update CLAIMS/proof, how the version-bump + changelog +
      breaking-changes index work — such that a second maintainer could execute
      it cold.
      <!-- done 2026-07-09: docs/release-runbook.md — the 9-step release.ts
      pipeline, both entry points (task release + release-labeled PR), the manual
      approve-workflows checkpoint, post-release verification, and --resume
      recovery; grounded in release.ts + release.yml + the release contracts. -->
- [x] Add a `docs/succession.md` (bus-factor doc): where the secrets/tokens
      live, which operator-gated steps need credentials, what "healthy main"
      looks like, and the minimal knowledge to take over. No secrets in the doc —
      pointers only.
      <!-- done 2026-07-09: docs/succession.md — secret/token inventory (pointers
      only: RELEASE_PR_TOKEN, npm OIDC, Cloudflare/MCP, AI keys), operator-gated
      steps, a "healthy main" definition, and the minimal takeover checklist. -->
- [-] Dry-run the runbook with the maintainer deliberately following ONLY the
      written steps (no tribal knowledge) on a no-op release; every gap found is
      a runbook fix.
      <!-- OPEN — maintainer-run: a written-steps-only no-op release dry-run is
      the real freshness test. Runbook § 7 gives a static staleness check; the
      live dry-run needs the maintainer. -->
      <!-- decision 2026-08-20: transferred to
           stubs/road-to-bus-factor-external-actions.md (council disposition B,
           outcome: transferred) — the stub carries this item verbatim with a
           named producer, a detection probe and the probe's measured 2026-08-20
           baseline. Marked [-] (not doable in this environment),
           NOT cancelled. Missing: a HUMAN who has not memorised the runbook,
           following only its written steps through a real no-op release cycle.
           An agent re-reading the document it can already see does not test
           freshness — risk-register row 4 names exactly this ("A release runbook
           read by the person who wrote it exercises their memory, not the
           document"), so simulating a pass here would be the fabricated evidence
           that row forbids. docs/release-runbook.md exists and is unchanged. -->

**Exit:** a release can be cut by following the runbook alone; the succession
doc names every operator-gated dependency.
**Rollback:** none — documentation only.

## Phase 4 — Lower bus-factor toward >1 (opportunistic, honest)

- [-] Identify the smallest reviewable surfaces a second reviewer could own
      (e.g. docs/claims, a single pack) and invite review there first — a
      realistic on-ramp, not "co-maintain the kernel on day one".
      <!-- OPEN — the on-ramp surfaces are IDENTIFIED (CONTRIBUTING names
      docs/claims or a single pack as the small first surface), but the actual
      INVITE needs a real external person — blocked on second-reviewer-availability. -->
      <!-- verified 2026-08-20: the blocker's own reopen condition (">=1
           non-maintainer has REVIEWED a merged PR") was re-measured, not assumed.
           Over the full trailing-90-day window (2026-05-22..2026-08-20, 1228
           merged PRs, counted in four sub-windows summing 266+211+297+454=1228 to
           match `search/issues` total_count exactly) the distinct PR-REVIEWER set
           is ["matze4u"] — the maintainer alone. No non-maintainer review exists,
           so the blocker does NOT reopen and this step stays out of reach. -->
      <!-- decision 2026-08-20: transferred to
           stubs/road-to-bus-factor-external-actions.md (council disposition B,
           outcome: transferred) — the stub carries this item verbatim with a
           named producer, a detection probe and the probe's measured 2026-08-20
           baseline. Marked [-] (not doable in this environment),
           NOT cancelled and NOT achieved. Missing: a real second human. The >1
           bus-factor target remains UNMET and parked pending adoption, exactly as
           risk-register row 2 requires it be reported. Reopens automatically the
           day a non-maintainer reviews a merged PR. -->
- [x] Track the real number honestly: distinct humans who have reviewed/merged
      in the trailing 90 days. Report it as-is; a bus-factor of 1 stated plainly
      beats a bus-factor of 1 implied to be more.
      <!-- done 2026-07-09: docs/succession.md tracks the trailing-90-day
      distinct-reviewer count honestly (currently 1) + a gh recompute one-liner;
      bound by the backed CLAIMS entry `bus-factor-tracked`. -->
      <!-- verified 2026-08-20: the tracking mechanism holds, but re-running it
           found the tracked NUMBER stale and its recompute command incapable of
           producing it. Two defects, both fixed in docs/succession.md this
           change: (a) the doc reported a flat "reviewed/merged: 1", wrong under
           its own wording — measured distinct REVIEWERS = 1 (["matze4u"]) but
           distinct MERGERS = 2 (["matze4u","h3xa2"], the second having authored
           and self-merged #765 and the 8.1.0 release #767 on 2026-07-07 with no
           review); (b) the documented one-liner passed NO `--limit`, so it read
           gh's default 30 of the window's 1228 merged PRs and silently
           under-reported. Replaced with a sliced query that cross-checks its
           slice sizes against `search/issues` total_count (266+211+297+454=1228).
           The reviewer figure of 1 — which is what CLAIMS `bus-factor-tracked`
           asserts — is unchanged and re-verified; the merger count is now
           reported alongside it with an explicit warning not to read it as a
           bus-factor of 2. -->

**Exit:** at least one non-maintainer review path exists and is documented; the
trailing-90-day reviewer count is tracked and reported truthfully.
**Rollback:** none — process + reporting only.

## Acceptance criteria

- Every non-trivial PR passes a required, recorded dogfooded self-review gate;
  the proof page states its scope AND its limit (not human review).
- `.github/CODEOWNERS` + branch protection route even solo merges through the
  gate on sensitive surfaces.
- A release-verification runbook + succession doc exist and have survived a
  written-steps-only dry run.
- The real trailing-90-day human-reviewer count is tracked and reported without
  inflation.

> **Status (2026-08-20).** Every agent-executable item in this roadmap is done.
> The four items that remain are marked `[-]` — **not cancelled, and not
> achieved**: each needs a credential, a repo-admin write, or a second human
> that no agent can supply. They stay maintainer-owned, and each carries the
> measurement that proves it is still outstanding.
>
> - **Criterion 1 (dogfooded gate) — NOT met.** The gate exists and is wired
>   (`self-review-gate.yml` + `self_review_gate.ts`, teeth defined via
>   `classifyBlocking`/`gateVerdict`), but `ANTHROPIC_API_KEY` is absent from the
>   repo secrets (verified 2026-08-20), so `live-advisory` is a logged no-op and
>   no live review has ever run. The proof-page claim stays unrecordable.
> - **Criterion 2 (CODEOWNERS + protection) — HALF met.** `.github/CODEOWNERS`
>   exists. The live ruleset (id 17749383, read 2026-08-20) has
>   `require_code_owner_review: false` and exactly ONE required check
>   (`Sync + Generate Tools Consistency`), so solo merges do **not** pass through
>   the gate. Arming it is a Hard-Floor admin write reserved to the maintainer.
> - **Criterion 3 (inheritable release) — HALF met.** Runbook + succession doc
>   exist; the written-steps-only cold dry-run needs a human and has not happened.
> - **Criterion 4 (honest reporting) — MET, and corrected this pass.** Distinct
>   trailing-90-day REVIEWERS = 1 (the maintainer); distinct MERGERS = 2. The
>   previously tracked flat "1" was wrong under its own wording and its recompute
>   command read 30 of 1228 PRs; both are fixed in `docs/succession.md`.
>
> **The bus-factor is still 1.** Two accounts can merge, but only one has ever
> reviewed, and one of the second account's two merges was an unreviewed release
> self-merge — which is a widening of who can ship, not of who checks. Roadmap
> stays open on the four maintainer items; archival is deliberately NOT taken here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The proof-page claim is recorded while the gate is inert | product | The Phase-1 step records "PRs pass a dogfooded AI adversarial-review + security gate". The gate ships `enforce:false` and is inert without its secret, so recording the claim before a live run states as fact something no run backs — a `check_claims` / no-invented-facts breach on the package's most consumer-visible page | **Revised 2026-08-20.** The claim was never recorded, so the risk never fired. The step is no longer `[ ]`: it is `[-]` and **transferred** (disposition B) to `stubs/road-to-bus-factor-external-actions.md`, which holds the criterion verbatim plus the probe that gates re-entry — `ANTHROPIC_API_KEY` present AND a `live-advisory` run that did not take its skip path. That second clause is the mitigation's new teeth: the workflow already runs and succeeds on every PR with the job skipping, so a run-exists probe would have been a false green and could have licensed exactly this claim. Honest advisory status stays in `docs/self-review-gate.md`; the claim remains the maintainer's to create | Phase 1 |
| 2 | The `>1` bus-factor target is reported as achieved when it is parked | product | Phase 4's target needs a second human reviewer. An explicit defer can be misread downstream as "phase complete", which would overstate the package's actual bus factor — the precise number this roadmap exists to be honest about | **Revised 2026-08-20 — this risk FIRED and is now structurally contained.** Marking the residue `[-]` left zero `[ ]` and zero `[~]`, so `roadmap:progress` rendered the roadmap at 100 % with all four phases `✅` while the bus factor was still 1: the overstatement this row predicted, arriving through the dashboard rather than through the blocker wording it was watching. Wording alone was the wrong control, because the dashboard does not read prose. Replaced with the outcome-state mechanism from the framework of record: every closure now records one of `satisfied` / `narrowed` / `transferred` / `abandoned`, this roadmap's `## Outcome` section states per criterion which applies (only criterion 4 is `satisfied`), and the >1 target is `transferred` to a stub whose probe is `distinct trailing-90-day reviewers > 1`, baseline 1. `second-reviewer-availability` stays deferred-pending-adoption and still reopens on the same measurement. Phases 1-3 remain solo-achievable | Phase 4 |
| 3 | Branch protection is armed in the UI and drifts from the documented matrix | implementation | The Phase-2 step is a GitHub Settings action outside the tree, so nothing in CI can observe whether the required-check set matches `branch-protection-policy.md` after it is armed | **Revised 2026-08-20.** Drift was measured rather than assumed: ruleset 17749383 read live matches `branch-protection-policy.md` byte-for-byte (`require_code_owner_review: false`, 0 approvals, one required check), so there is no drift today and nothing to reconcile. The step stays maintainer-owned and is still never closed from a code change — now `[-]` and **transferred**, with the stub carrying the three-condition probe that doubles as the drift detector, since it names the exact field values enforcement must reach. The sibling `-ci-economy` roadmap still owns the required-check matrix, so the two cannot silently disagree. Unchanged in substance: nothing in CI observes the ruleset, so this remains a read-and-compare obligation | Phase 2 |
| 4 | The runbook passes a dry-run only because its author ran it | implementation | A release runbook read by the person who wrote it exercises their memory, not the document. A gap only shows when someone follows the written steps literally from cold | **Revised 2026-08-20.** Substance unchanged and it held: no simulated pass was recorded this run. Now `[-]` and **transferred**, and the stub hardens the bar the prose only stated — the producer is named as a human who has *not* memorised the runbook (explicitly not its author), and the probe requires a dated cold-dry-run record naming executor and release, with an agent re-read stated as non-satisfying. Baseline: zero such records exist under `agents/evidence/` | Phase 3 |

## Blockers

### blocker: self-review-gate-cost
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** running `ai-council` on every PR has real token cost. Scope it:
  `adversarial-review` + `agent-security-review` on all non-trivial PRs (cheap),
  full `ai-council` only on large or claim-affecting diffs. Tune the trigger so
  the gate is not a tax on typo fixes.
- **Resolved when:** the gate runs within an acceptable per-PR budget and blocks
  on security/claim findings.
- **Resolution (2026-07-10, template rule 22 sweep):** not a human gate — the
  scoping decision is already made IN this blocker's own text (in-session
  `adversarial-review` + `agent-security-review` for non-trivial PRs; full
  spend-bearing `ai-council` only on large / claim-affecting diffs). The two
  cheap lenses are in-session skills (no external spend), and implementing +
  tuning the trigger is agent-executable Phase-1 work. The only spend-bearing
  branch (`ai-council` on big diffs) stays governed by the standing
  spend-authorization discipline at run time — no separate roadmap gate
  needed. The "Resolved when" stays Phase 1's exit criterion.

- **Correctness precondition on the enforcement flip, added 2026-09-04 by
  `road-to-the-unwritten-ledger` Phase 2b.** The cost-and-authority question
  above stays **resolved**; this does not reopen the spend decision. It records a
  *separate* precondition on arming the teeth (`docs/self-review-gate.md`
  § Arming it, steps 1-2), which that resolution never covered.

  **The class.** The gate cannot distinguish a defect a diff **introduces** from
  one it **documents**. Observed on pull request #1839 (merged
  2026-09-04T05:22:24Z), whose diff was six roadmaps and one evidence file —
  prose describing defects that live elsewhere in the tree, introducing none. The
  gate reported ten findings, two of them `high (Blocking)` security, and every
  one maps 1:1 to a defect the diff *documents*. Under `--enforce`, every analysis
  pull request this package produces would be blocked by the findings it was
  written to record, and the only way to pass would be to describe defects less
  precisely.

  **The ten ids, and why there are twenty.** That pull request carries **two**
  machine blocks, 3.5 minutes apart, with **zero id overlap** — so the next
  reading is a comparison against both, not one:

  | | run 1 · `2026-09-04T04:54:35Z` | run 2 · `2026-09-04T04:58:08Z` |
  |---|---|---|
  | high security | `5642305ff717`, `e2fb09a4665b` | `b9e68835cea0`, `3f5e513f11bd` |
  | medium | `65ad56f65cc7`, `75d5de0eda05`, `e43f97a96867`, `d3c5ab8e222d`, `fc51dd451cce` | `abb55a424fda`, `413c7c1e323e`, `d608a3340c48` |
  | low | `16ced138a92c`, `7b2aacbd97d7`, `47dbfbceee87` | `2f77c1f5837f`, `fb1f65bb44b1`, `bf3b9aced256`, `ca608713a7f9`, `e8d4dc032d28` |

  Eight of ten `(kind, file)` pairs match across the two runs — the same defects,
  reworded, some re-severitied. `parse_comment_findings` takes the LAST block, so
  a ledger dispositioned against run 1 is red against run 2.

  **The class is NOT prose-specific, which kills the obvious fix.** Finding
  `fec596e8beb4` on release pull request #1836 reported a seven-digit regex cap
  against `src/scripts/git_authorization_hook.ts` — a **code** file. The defect
  was already fixed inside the reviewed span, and the only occurrence of the
  pattern in the diff is the fix's own explanatory comment at `:644`, which the
  fix ADDED. The gate read a code comment describing a removed defect and reported
  it as live.

  **Discriminator: none is cheap. AI council, 2026-09-04, 2 seats
  (anthropic/claude-sonnet-4-5, openai/codex-default), 2 rounds, quorum 2/2
  concluded, $0.00 (subscription transport).** Verdict: *there is no cheap
  discriminator that reliably determines whether a diff introduced a defect rather
  than documented, repaired, moved, or exposed it.* The three candidates and their
  measured costs:

  | candidate | cost |
  |---|---|
  | scope findings to non-prose paths | fails on `fec596e8beb4`, which is in a `.ts` file; also exempts rules and skills, which are prose that ships |
  | require the finding to cite a line the diff CHANGED | fails on the same instance — `:644` *is* a changed line, added by the fix |
  | prose advisory, code blocking | fails on the same instance, which is a code finding and a false positive |

  The council added the general failure mode the three share, **causal
  misattribution**: an added executable line may merely expose, instrument, or
  refactor a pre-existing defect; a regression may be introduced by *deleting* a
  guard, or live in strings, templates, configuration, or dependency metadata; and
  the model-cited line is often supporting evidence rather than the causal line.
  A model-authored "reachable code path" requirement only moves the untrusted
  assertion into another field.

  **Recorded as a second, independent blocker: finding-id instability.** Because
  `finding_id` is `sha256(kind|title|file)`, a reworded title mints a new id for
  the same defect — which is what the twenty ids above measure. This falsifies the
  contract in `src/scripts/schemas/review-findings.schema.json`, which describes
  the id as *"Stable across runs, which is what lets the disposition ledger key on
  it"*. Council: this blocks enforcement in its own right, separately from the
  class above, because it breaks disposition persistence, deduplication, audit
  history and rerun comparison even if provenance classification were perfect. The
  recommended shape is three layers rather than one hash — `run_id` (one
  execution), `occurrence_id` (auditable, deliberately NOT stable across runs),
  and a ledger-**allocated** `issue_id` that is never re-derived — with
  reconciliation returning `matched | new | ambiguous`, and an ambiguous finding
  neither inheriting an old disposition nor silently invalidating it.

  **Status of the flip: still gated, now on three things** — the cost/authority
  question (resolved above), the documented-versus-introduced class (open, no
  cheap discriminator), and finding-id instability (open). A narrower pilot is
  defensible only if it is named for what it is, `added-code security
  enforcement`, carries a repository kill switch and an audited per-PR override,
  treats a malformed or duplicate result block as an infrastructure failure rather
  than silently as advisory (that downgrade is a fail-open trust-boundary error),
  and splits `security` from `claim` — requiring an executable anchor makes most
  of the `claim` category ineligible by construction, so the current
  `security|claim × high+` union cannot carry one policy.

### blocker: second-reviewer-availability
- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** 2026-08-14 — **explicitly deferred pending adoption**, which is
  the second of the two branches this blocker's own Resolved-when offers.
  Maintainer-delegated under the blanket in-session grant. The first branch
  ("≥1 non-maintainer has reviewed a merged PR") cannot be discharged by any
  authorization: it needs a second human, and this repo has no external adopter
  yet. Taking the defer branch is therefore the only honest close — it records
  that the >1 target is *parked on adoption*, not *achieved*. Phase 4's >1 target
  stays out of reach and must not be reported as met; Phases 1–3 were never
  gated on it and remain solo-achievable. **Reopens automatically** the day a
  non-maintainer reviews a merged PR — no further ask needed to resume.
- **Blocks:** Phase 4 (the >1 target only)
- **What to do:** a second human reviewer cannot be manufactured; this phase is
  opportunistic and gated on real external interest (couples to the adoption
  roadmap). Phases 1–3 do NOT depend on it — reviewability and inheritability are
  achievable solo.
- **Resolved when:** ≥1 non-maintainer has reviewed a merged PR, or the phase is
  explicitly deferred pending adoption.

## Routing note (feedback-8.11-2, 2026-07-12)

The reviewers' "maintainer map" ask is split: the one-page orientation map
shipped as `docs/maintainers/system-map.md` (a map, not a contract); the
DEEP operating material (release runbook, incident playbooks, succession,
per-subsystem ownership) stays owned by THIS roadmap's phases — the map
links here, not the other way around.
