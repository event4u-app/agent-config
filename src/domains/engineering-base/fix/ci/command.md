---
model_tier: medium
name: fix-ci
pack: engineering-base
visibility: internal
cluster: fix
sub: ci
skills: [github-ci, quality-tools]
description: Fetch CI errors from GitHub Actions and fix them
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix ci
## Instructions

### 0. Wait for the run to settle first

A run still in progress has no verdict to fix. Do NOT read a partial run and
start guessing — and do NOT end the turn reporting "CI is running".

```bash
until [ "$(gh pr checks <n> --json state \
    --jq '[.[] | select(.state=="IN_PROGRESS" or .state=="QUEUED" or .state=="PENDING")] | length')" = "0" ]
do sleep 45; done
```

Run that in the BACKGROUND so the turn resumes when the verdict lands; a
foreground sleep-poll chain is blocked and per-minute re-polling is the tool
loop `token-efficiency` forbids. If the waiter exits because `gh` itself failed
(network down), it has observed nothing — say so rather than treating it as a
pass.

Note `gh run view --log-failed` returns *"run is still in progress; logs will be
available when it is complete"* until the WHOLE run finishes, which is the other
reason to settle first.

### 1. Identify the failing CI run

- Get the current branch name from `git branch --show-current`.
- Fetch the latest CI run for this branch via GitHub API:
  - `GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=5`
- Find the most recent failed run.
- **Before fixing, establish whose failure it is.** Re-run the same gate against
  `origin/main`, and check whether any of your changed files appear in its
  inputs (`git diff origin/main --stat -- <path>`). A pre-existing trunk failure
  is reported, not adopted — and not ignored.
- **A local repro can differ from CI.** A developer checkout carries settings and
  generated trees a clean runner never has, so a gate can fail locally for an
  unrelated reason (or pass locally while CI fails). When they disagree, CI is
  authoritative; name the difference instead of assuming one cause.

### 2. Get the failure details

- Fetch the jobs for the failed run: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`
- For each failed job, fetch the logs: `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`
- If logs are not available via API, check the check-runs and status endpoints:
  - `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`
  - `GET /repos/{owner}/{repo}/commits/{sha}/status`

### 3. Analyze and fix

- Parse the error output to identify the root cause.
- Detect the project type: if `artisan` exists → Laravel, otherwise → Composer (see `rules/docker-commands.md`).
- Common CI failures:
  - **PHPStan errors** — fix the code, do NOT add to baseline or ignoreErrors.
  - **ECS (coding standard) errors** — run `vendor/bin/ecs check --fix` (auto-fix).
  - **Rector changes** — run `vendor/bin/rector process` (auto-fix).
  - **Test failures** — read the failing test, understand the assertion, fix the code or test.
  - **Biome / TypeScript errors** — run `npm run biome:fix` or `npm run tscheck` and fix.
- Fix errors in the local codebase.

### 4. Verify

- Re-run the failing tool locally (inside the PHP container) to confirm the fix.
- If multiple tools failed, fix and verify each one.

### 5. Land it when the CI being fixed belongs to an open PR

```
"FIX THE CI" NAMES A REMOTE STATE. A LOCAL-ONLY FIX LEAVES THE RED CHECK
EXACTLY AS RED, WHICH MAKES THE INSTRUCTION A NO-OP.
COMMIT, PUSH, THEN RE-VERIFY ON THE PUSHED HEAD.
A GREEN LOCAL RUN IS NOT THE VERDICT. A GREEN CI RUN ON AN EARLIER COMMIT
IS NOT THE VERDICT EITHER.
```

Applies only when the failing run belongs to an **open PR for the current
branch** — that is what makes the deliverable remote. Then:

1. Commit the fix (chunked, the agent picks the split per
   [`commit-policy`](../../../rules/commit-policy.md) — never ask how).
2. Update the branch against its PR base first:
   `./scripts-run src/scripts/sync_pr_branch`, then regenerate any derived files
   the merge touched (`task sync && task generate-tools`). A PR left behind its
   base accumulates conflicts for the moment someone wants to merge it, and a
   push against a moved base is rejected — both cost a round trip that this one
   call prevents.
3. Push. The instruction named it; do not raise a separate ask
   ([`/create-pr` § 4d item 5](../../../git/pr/create/command.md)).
4. Re-verify remotely: `./scripts-run src/scripts/check_pr_ci_current`, then
   settle the check set on the new head. Report the *remote* verdict, never the
   local one.

Bounded by N=3 per failing target ([`autonomous-execution`](../../../rules/autonomous-execution.md)).

### Rules

- **No open PR for this branch → do NOT commit or push.** Apply local fixes only
  and hand back. Without a PR there is no remote state the instruction could be
  about, so the deliverable really is the working tree.
- **A push is authorized for the named failure only.** Once the checks the user
  pointed at are green, further pushes need their own instruction — a one-off
  authorization is spent on the operation it was given for.
- **Never force-push over a commit you did not author** — including a
  GitHub *Update branch* merge on your own PR branch. Merge it in; the ask-first
  floor is [`git-history-discipline`](../../../rules/git-history-discipline.md)
  and nothing here reaches it.
- **Do NOT skip or ignore errors** — fix the root cause.
- If a fix is unclear, explain the error and ask the user for guidance.
