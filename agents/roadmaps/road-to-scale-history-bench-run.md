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

## Goal

Run the pre-registered scale-history bench (3 arms × ≥2 model families,
N=16/arm per the registered power analysis) and publish lift OR honest
null. Until published, the packs stay default-off and no marketing claim
ships ("keeps your AI-built app from falling over at 10k rows" is
POST-bench copy, never pre-bench).

## Phase 1 — Run and publish

- [ ] **Fire the paid run** once benchmark-spend-authorization clears:
  arms A/B/C per the prereg, artifacts written under
  `internal/bench/scale-history/artifacts/` (confinement root), manual
  rubric scored blind BEFORE `score.ts` output is viewed.
  *Verify:* per-family results in `internal/bench/reports/`; thresholds
  evaluated exactly as registered (no post-hoc α).
- [ ] **Publish verdict + claims-ledger entry**: lift claim only if the
  registered thresholds clear; otherwise honest null in the house format,
  packs stay default-off, follow-up re-scope recorded.
  *Verify:* claims ledger entry matches the published report; R-A8
  over-application guardrail (>20% distractor queueing = pack design
  finding) reported either way.

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

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 1 step 1's scoring half, and thereby step 2's verdict
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
- **If you do nothing:** Phase 1 step 1's scoring half stays open and step 2
  has no verdict, so the bench run produces only the SECONDARY
  `lint_persistence` count — a number the pre-registration explicitly does not
  accept as the defect count. The roadmap then reads as spend-blocked when it
  is in fact rater-blocked, which is the misreading its own Surfaced note
  records.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (score in ONE sitting, before any `score.ts` output is on screen) is
  accepted as the ORDERING and it is the binding half: viewing automated scores first
  would irreversibly violate the preregistered anti-anchor ordering, which is why this
  is not agent-completable. Rule 3 assigns it `B`; the batch-B row in
  [drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)
  carries the three-point check verbatim: original criterion, Phase 1 Step 1's scoring
  half and Step 2's verdict moved, re-entry producer a named independent human rater,
  probe immutable timestamps showing every rubric score predates its `score.ts` /
  `lint_persistence` output.
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
