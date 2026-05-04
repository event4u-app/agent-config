---
name: fix:ci
cluster: fix
sub: ci
skills: [github-ci, quality-tools]
description: Fetch CI errors from GitHub Actions and fix them
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "CI is failing, fix the GitHub Actions errors, the pipeline is red"
  trigger_context: "open PR with failing checks"
---

# /fix ci
## Instructions

### 1. Identify the failing CI run

- Get the current branch name from `git branch --show-current`.
- Fetch the latest CI run for this branch via GitHub API:
  - `GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=5`
- Find the most recent failed run.

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

### Rules

- **Do NOT commit or push.** Only apply local fixes.
- **Do NOT skip or ignore errors** — fix the root cause.
- If a fix is unclear, explain the error and ask the user for guidance.
