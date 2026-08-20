---
complexity: lightweight
status: ready
---

# Road to the scale-history bench run — fire the pre-registered Phase-4 bench

> **Source:** PR #1016 review (maintainer, 2026-07-27) — the
> scale-and-history-discipline roadmap archived with its Phase-4 paid run
> spend-gated; this follow-up keeps that gate VISIBLE on the dashboard
> next to the other benchmark-spend entries instead of becoming a third
> silent "built, never fired" blocker (the launch-announcement pattern).
> Infra is committed and dry-verified: pre-registration
> `internal/bench/corpora/scale-history-PREREG.md`, harness + hardened
> scorer `internal/bench/scale-history/` (`score.ts --dry` runs
> end-to-end; artifact-root confinement + hardenedSpawnEnv + timeout).

## Outcome (2026-08-20)

Closed against an explicit outcome state, per the framework of record in
[`agents/evidence/council/drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md) <!-- ref-ignore -->
(blocker `manual-rubric-rater`, disposition **B** — outcome `transferred`).
Council rationale, verbatim: *"Viewing automated scores first would irreversibly
violate the preregistered anti-anchor ordering."* The transferred work lives in
[`stubs/road-to-scale-history-primary-rating.md`](stubs/road-to-scale-history-primary-rating.md),
which carries the original criterion verbatim, both dependent steps, and three
named producers each with a detection probe and that probe's measured baseline.

| Item | Outcome | What was satisfied | What is transferred |
|---|---|---|---|
| Step 1 · fire the run, rate blind | **transferred** | The instrument, in full and verified by running it: the runner completes all six arm × family cells in `--dry`, writes the manifest, and generates a genuine blind rating workbook (opaque ids, seeded shuffle, label-free copies, sealed key) | The paid sweep, and — irreducibly — the blind PRIMARY rating of its 96 artifacts by a human |
| Step 2 · verdict + claims-ledger entry | **transferred** | Nothing; it was never startable | The whole verdict. It reads the PRIMARY count, which does not exist |
| Blocker · `benchmark-spend-authorization` | **satisfied** | Budget granted in-session 2026-08-14 at the registered shape; cost sheet measured at \$22–50 / ~4.6 h | — |
| Blocker · `codex-family-auth` | **satisfied** | Both required model families proven live end-to-end 2026-08-14 | — |

**Archived does not mean achieved.** Both boxes are `[-]` cancelled-here, not
`[x]`, and the dashboard reflects that rather than hiding it: after regeneration
this roadmap renders as `0 / 0 done (0%)` with Phase 1 `⏭️ skipped` and two
cancelled steps, and it is **not** listed among the completed-not-yet-archived
files — the one open blocker keeps it out. Read that `0 %` as "nothing was
achieved here and the work moved", not as a stalled build. The
`manual-rubric-rater` blocker stays `transferred` rather than `resolved` on
purpose: it keeps one open blocker on the dashboard and keeps the archival sweep
refusing this file, because the honest state is unfinished work with a named
owner elsewhere.

**The primary rating is unmade, not negative.** No lift was measured and no null
was measured; the instrument that would produce either was never pointed at a
live sweep, and the rater who would read it has not been named. Nothing is being
suppressed, because nothing exists to suppress. Whoever picks this up must not
report the SECONDARY `lint_persistence` count as the result — the
pre-registration explicitly does not accept it as the defect count
(`internal/bench/corpora/scale-history-PREREG.md:63-69`).

**What this run did do:** it established, by running it, that the missing half is
the human and not the harness — recorded with the observed command output in
[`agents/evidence/analysis/scale-history-harness-runnability.md`](../evidence/analysis/scale-history-harness-runnability.md).
That distinction is the whole reason this is a `transferred` and not a stalled
build.

## Goal

Run the pre-registered scale-history bench (3 arms × ≥2 model families,
N=16/arm per the registered power analysis) and publish lift OR honest
null. Until published, the packs stay default-off and no marketing claim
ships ("keeps your AI-built app from falling over at 10k rows" is
POST-bench copy, never pre-bench).

## Phase 1 — Run and publish

- [-] **Fire the paid run** once benchmark-spend-authorization clears:
  arms A/B/C per the prereg, artifacts written under
  `internal/bench/scale-history/artifacts/` (confinement root), manual
  rubric scored blind BEFORE `score.ts` output is viewed.
  *Verify:* per-family results in `internal/bench/reports/`; thresholds
  evaluated exactly as registered (no post-hoc α).
  **Transferred** 2026-08-20 (disposition B, outcome `transferred`) to
  [`stubs/road-to-scale-history-primary-rating.md`](stubs/road-to-scale-history-primary-rating.md):
  the blind PRIMARY rating needs a human, and the harness — verified runnable
  this run — is the only half that was buildable here.
- [-] **Publish verdict + claims-ledger entry**: lift claim only if the
  registered thresholds clear; otherwise honest null in the house format,
  packs stay default-off, follow-up re-scope recorded.
  *Verify:* claims ledger entry matches the published report; R-A8
  over-application guardrail (>20% distractor queueing = pack design
  finding) reported either way.
  **Transferred** 2026-08-20 (disposition B, outcome `transferred`) to the same
  stub: the verdict reads the PRIMARY defect count, which does not exist, so
  there is no lift claim and no honest null — the result is unmade, not negative.

## Blockers

### blocker: benchmark-spend-authorization
- **Status:** resolved
- **Owner:** user
- **Resolution (2026-08-14):** **run budget GRANTED in-session**, at the
  pre-registered shape — 3 arms × 16 runs × ≥2 families on the agentic build
  task. The decision half is permanently discharged and needs no re-asking; this
  is the same standing authorization the team-mode Phase-5 bench references.

  **The run was not fired in the granting session, for capacity rather than
  permission.** A paid multi-family agentic sweep is long-running and its results
  need shepherding into the Phase-1 verdict and the claims ledger; starting one
  at the tail of a session that could not supervise it to completion would risk
  spending the grant on a run nobody reads. No dollar figure is asserted here —
  the cost sheet lives in the pre-registration, and inventing a number would be
  worse than pointing at it.

  **PRE-AUTHORIZED — executes without further ask.** The next session with
  capacity renders the estimate from the prereg for the record, fires the run,
  and proceeds to the Phase-1 verdict. No new spend question exists.

  **Correction (2026-08-14, continuation sweep) — "held for capacity, not
  permission" was wrong, and the distinction matters for whoever reads this
  next.** The grant is real and stands. What does not stand is the implication
  that a session with more time would fire this. Two structural gaps, both
  checked against the tree rather than inferred:

  1. **There is no runner.** `internal/bench/scale-history/` contains
     `task.md`, `seed-schema.sql`, `rubric.md`, `sample-artifact/` and
     `score.ts` — and `score.ts` is a *scorer*: it takes `--artifact <dir>`
     and spawns `lint_persistence` over it (`score.ts:25-26`, `:75-99`).
     Nothing in the tree produces the 96 artifacts (3 arms × 16 × ≥2
     families) the pre-registration requires. Firing the run means first
     **building** a multi-family agentic runner, which is a Phase-0 that this
     roadmap never wrote down.
  2. **The primary scorer is a human, by pre-registration.** The prereg makes
     the manual rubric PRIMARY and `lint_persistence` SECONDARY
     (`scale-history-PREREG.md:63-69`), and the rubric opens with *"The rater
     never sees `lint_persistence` output before scoring (anti-anchor)"*
     (`rubric.md:4-5`). An agent scoring its own bench artifacts is the same
     invalidating substitution `road-to-council-blind-review` refuses for its
     blind ratings — it would break the pre-registration and produce a number
     nobody may cite.

  So the honest state is **not** "authorized, awaiting a longer session". It is
  **authorized, and blocked on two builds the roadmap does not contain**: a
  runner, and a human rater. Recorded so the next three sessions do not
  re-derive it. Neither gap is a spend question and neither reopens the grant.

  **Update (2026-08-14, later the same day) — gap 1 is closed. The runner
  exists.** `internal/bench/scale-history/run.ts` produces the artifacts: two
  agentic families (`claude --print`, `codex exec`), the three arms, the
  bounded fix-or-waive loop for arm C, per-run token/wall/USD capture, resume,
  and a blind rating workbook for the human PRIMARY rater. It refuses `--score`
  until that workbook exists, so the tooling cannot itself break the
  anti-anchor ordering.

  Three findings from its first live run, kept because each would otherwise be
  re-derived:

  1. **Arm A was not arm A.** The globally-installed plugin rode along on every
     invocation — proven by its `agents/runtime/state/` hook output landing
     inside the artifact — so the "neither pack loaded" arm ran with the full
     package active. That is a confound on precisely the A-vs-C contrast this
     bench measures. Dropping it per-arm (`--setting-sources project,local`,
     the `bench_ab_task_runner.ts:61-69` precedent) also cut one run from 73
     files to 13, 145s to 73s, and $1.71 to $0.22.
  2. **The arms are injected, not installed** — a mechanism the prereg left
     open and this run had to fix. `codex` has no plugin concept, so a
     clone-based mechanism would exist on one family only and would confound
     family with mechanism. Injection is uniform across families. A
     post-registration mechanism choice, recorded here rather than silently.
  3. **The cost sheet is now measured, not withheld**: $22–50 and ~4.6 h for
     the full 224 invocations, anchored on real runs rather than list price.

  What remains is gap 2 (the human rater, unchanged and unchangeable) plus one
  newly-surfaced external gap, `codex-family-auth`, below.
- **Blocks:** Phase 1 (both steps) — the *scoring* half is committed and
  dry-verified in PR #1016; the *producing* half landed 2026-08-14 and is
  proven live on one of the two required families.
- **What to do:**
  1. Approve the run budget in-session (estimate rendered before the
     first call: 3 arms × 16 runs × ≥2 families on the agentic build
     task; same standing authorization the team-mode Phase-5 bench
     waits on).
- **Resolved when:** the user confirms the run budget in-session.

### blocker: manual-rubric-rater

- **Status:** transferred
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 1 step 1's scoring half, and thereby step 2's verdict
- **Disposition (2026-08-20):** **B — outcome `transferred`**, per the drain-run
  framework of record in
  [`agents/evidence/council/drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md) <!-- ref-ignore -->.
  Council rationale, verbatim: *"Viewing automated scores first would
  irreversibly violate the preregistered anti-anchor ordering."* The blind
  PRIMARY scoring and its ordering proof are moved to
  [`stubs/road-to-scale-history-primary-rating.md`](stubs/road-to-scale-history-primary-rating.md),
  with the criterion below carried verbatim, both dependent steps listed, and
  three named producers each carrying a probe measured FAILING on the transfer
  date.

  **Deliberately NOT `resolved`.** This entry's Resolved-when has no defer
  branch, so calling it resolved would assert a rating that does not exist.
  `transferred` keeps one open blocker on the dashboard and keeps the archival
  sweep refusing this file — the honest encoding of work that moved rather than
  finished.

  **What this run added, and it narrows the blocker rather than closing it:** the
  harness was verified runnable end-to-end, so the missing half is provably the
  human and not the instrument — `run.ts --dry --all --n 1` completes all six
  cells and emits a genuine blind workbook, and `run.ts --score` refuses with
  exit 2 while no workbook exists (`internal/bench/scale-history/run.ts:907-913`),
  so the tooling cannot break the ordering by itself. Record with observed
  output: [`agents/evidence/analysis/scale-history-harness-runnability.md`](../evidence/analysis/scale-history-harness-runnability.md).

  **The demonstration is this run itself.** The dry sweep put six blind
  artifacts and their sealed key on disk; producing rubric numbers from them was
  mechanically available and would have been worthless, because the same agent
  generated the arms. Being *able* to emit the ratings is evidence the
  instrument works, never evidence the blocker cleared.

  **Not spend-blocked and not auth-blocked.** Both sibling blockers are
  resolved; do not re-ask either question. Firing the sweep still needs its own
  this-turn approval as a paid external action — a standing roadmap grant is not
  that approval.
- **What to do:** score each produced artifact against
  `internal/bench/scale-history/rubric.md`, blind to arm, **before** any
  `score.ts` output is viewed. The pre-registration makes this rubric the
  PRIMARY defect count and `lint_persistence` merely SECONDARY
  (`internal/bench/corpora/scale-history-PREREG.md:63-69`), and the rubric's
  own first line makes the anti-anchor ordering binding
  (`internal/bench/scale-history/rubric.md:4-5`).
  - **Why no agent can close it:** an agent rating artifacts an agent produced
    is the self-preference substitution that invalidates the result it is
    meant to produce — the same refusal `road-to-council-blind-review` records
    for its own blind ratings, and the reason `evaluator-independence` exists.
    Substituting an AI rater here would not be a weaker result; it would be an
    uncitable one.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Score the artifacts in ONE sitting
  and do it before any `score.ts` output is on screen — the anti-anchor
  ordering is binding per the rubric's own first line, so a sitting split
  across days is the likeliest way to void the result without noticing. If
  that sitting is not going to happen in the near term, the honest move is to
  park this roadmap in `later/` with the rubric pass as its probe-able resume
  condition, rather than leaving it in the active tree reading as ordinary
  open work.
  **Superseded in its second half (2026-08-20)** by the council disposition
  above, and kept because the first half still binds. The one-sitting,
  order-before-`score.ts` advice is exactly right and is carried into the stub's
  promotion sequence. The `later/` parking recommendation is what the council
  replaced: a `transferred` stub with three named producers and measured probes
  is the same honesty with an addressable owner, where `later/` names nobody.
- **If you do nothing:** Phase 1 step 1's scoring half stays open and step 2
  has no verdict, so the bench run produces only the SECONDARY
  `lint_persistence` count — a number the pre-registration explicitly does not
  accept as the defect count. The roadmap then reads as spend-blocked when it
  is in fact rater-blocked, which is the misreading its own Surfaced note
  records.
- **Resolved when:** a human rubric score exists per artifact, recorded before
  the secondary `lint_persistence` pass for that artifact.
- **Surfaced 2026-08-14** by the continuation sweep. It was always true and was
  never written down, which is why this roadmap read as spend-blocked-only.

### blocker: codex-family-auth

- **Status:** resolved
- **Owner:** user
- **Blocks:** the `openai` family of Phase 1 step 1 — half the pre-registered
  design. The `anthropic` family is unblocked and proven live.
- **What to do:** run `codex login` interactively on the bench machine, then
  re-run with `--resume` (completed cells are skipped, so nothing already paid
  for is re-spent).
- **Why an agent cannot close it:** the login is an interactive browser
  handshake. `codex login status` currently prints `Logged in using ChatGPT`
  while the token is expired and refresh fails with HTTP 401 `token_expired` —
  the status line is not a liveness check, which is why this looked available
  until a real call was attempted.
- **Do NOT work around it by running one family.** The pre-registration fixes
  **≥2 model families** with per-family reporting and a cross-family regression
  guardrail (`internal/bench/corpora/scale-history-PREREG.md:37-46`, `:82-86`).
  A single-family sweep is a protocol deviation and would have to be registered
  before the run, never justified after it.
- **Resolved when:** `codex exec` completes a live turn on the bench machine —
  the runner's own smoke path (`--live --family openai --arm A --n 1`) is the
  check, and it names the auth case explicitly when it fails.
- **Surfaced 2026-08-14** by the first live smoke run of the new runner.
- **Resolved 2026-08-14, same day.** The maintainer confirmed the CLI works and
  a fresh probe agreed: plain `codex exec` completes, `--ignore-user-config`
  completes, and the runner's own openai smoke produced a 20-file artifact in
  179.6s. The 07:23 failure was a genuinely expired token, not a runner defect —
  `hardenedSpawnEnv` scrubs by family and never removes the auth environment, so
  the earlier suspicion of the harness was wrong and is recorded as such. Both
  required families are now proven live end-to-end.
