<!-- evidence-type: analysis -->
# Two shipped releases carry no findings ledger — 14.17.0 and 14.18.0

> Recorded 2026-09-06 against `main@9b75231ed`. No repair is made in this file.
> Roadmap: `road-to-the-ledger-two-releases-skipped`, Phase 1.1. Every line below
> carries the command that produced it, run in a worktree of this repository at
> that commit.

## The five facts

### 1. Three ledgers exist

```
$ ls agents/evidence/release-findings/
14.15.0.json
14.16.0.json
9.14.0.json
```

### 2. Two are absent, and both versions have shipped

```
$ ./scripts-run src/scripts/check_finding_dispositions --release 14.17.0 ; echo "exit=$?"
❌  14.17.0 has shipped and carries no findings ledger at agents/evidence/release-findings/14.17.0.json.
exit=1

$ ./scripts-run src/scripts/check_finding_dispositions --release 14.18.0 ; echo "exit=$?"
❌  14.18.0 has shipped and carries no findings ledger at agents/evidence/release-findings/14.18.0.json.
exit=1
```

The three that exist all exit 0 under the same command — `9.14.0` (1 recorded
finding), `14.15.0` (9), `14.16.0` (10).

### 3. The gate has exactly one caller, and it cannot fire on the trunk

```
$ grep -rn "src/scripts/check_finding_dispositions" .github/workflows/
.github/workflows/release-validation.yml:388:          ./scripts-run src/scripts/check_finding_dispositions \

$ grep -rn "check_finding_dispositions" Taskfile.yml taskfiles/
(no output)
```

That job carries
`if: ${{ github.event_name == 'pull_request' && startsWith(github.head_ref, 'release/') }}`
(`.github/workflows/release-validation.yml:363`), so the only surface on which
the gate has ever run is a `release/*` pull request — a branch that is deleted
after the merge. Nothing on `main` executes it. Both exit-1 states above are
therefore invisible to CI and were found by hand.

### 4. The self-review that would have populated both ledgers never ran

This is the fact the roadmap's own step 1.2 did not predict, and it changes what
an honest ledger for these two versions may say. The `self-review-findings`
artifact is uploaded with `retention-days: 30`
(`.github/workflows/self-review-gate.yml:88`), so both releases are inside the
window — but no artifact was ever produced, for either of them:

```
$ gh api repos/{owner}/{repo}/actions/runs/33946940306/artifacts -q '.artifacts[]'
(no output — release/14.17.0, run 33946940306)

$ gh api repos/{owner}/{repo}/actions/runs/34014843850/artifacts -q '.artifacts[]'
(no output — release/14.18.0, run 34014843850)
```

Both runs concluded `success` because the job is `continue-on-error: true` and
advisory by design. The reason there is no artifact is in their logs:

```
$ gh run view 33946940306 --log | grep 'self-review-gate NEUTRAL'
##[warning]self-review-gate NEUTRAL — model call did not complete
(Error: HTTP 400: {"type":"error","error":{"type":"invalid_request_error",
"message":"prompt is too long: 235472 tokens > 200000 maximum"}}); nothing was
reviewed, not a blocker.

$ gh run view 34014843850 --log | grep 'self-review-gate NEUTRAL'
##[warning]self-review-gate NEUTRAL — model call did not complete
(Error: HTTP 400: {"type":"error","error":{"type":"invalid_request_error",
"message":"prompt is too long: 413191 tokens > 200000 maximum"}}); nothing was
reviewed, not a blocker.
```

Both runs then logged
`No files were found with the provided path: /tmp/self-review-findings.json`.

### 5. There is no PR-comment record to recover from either

```
$ gh pr view 1856 --json comments -q '.comments[].body'   # release/14.17.0
$ gh pr view 1869 --json comments -q '.comments[].body'   # release/14.18.0
```

Each PR carries exactly one comment, the sticky skill-lint report. Neither
carries the `<!-- release-findings-json: [...] -->` machine block that
`check_finding_dispositions --pr` reads, because the job that posts it only
posts when the model call completes.

## What this means for the ledgers that get written

The recoverable state is **not** "the review ran and reported nothing". It is
"the review did not run". Those are different claims, and the ledger vocabulary
already distinguishes them: a ledger with `reviewers: []` derives
`review_independence: unknown`, `acceptance_status: provisional` and
`assurance: unreviewed` (`src/scripts/_lib/review_independence.ts:62-98`) —
which is the accurate record for both versions.

Writing `findings: []` alone would be the failure this roadmap's Risk Register
ranks first: an absent ledger and a fabricated empty one are indistinguishable
to every check in the tree. What separates them is a stated, falsifiable reason,
which is what Phase 3.1 makes mandatory rather than optional.

## Out of scope here, and reported rather than fixed

The prompt-too-long NEUTRAL in fact 4 is a defect in the self-review gate, not
in the ledger. It means the package's dogfooded self-review has been silently
inert on at least the last two release PRs while reporting `success`, and the
input grew from 235k to 413k tokens in one day, so it is not a threshold that
recovers on its own. No phase of this roadmap owns it and it needs no ledger
change; it is recorded here so the next reader does not rediscover it from the
same two log lines.
