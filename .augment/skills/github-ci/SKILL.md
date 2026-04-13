---
name: github-ci
description: "Use when working with GitHub Actions CI/CD — quality checks, test workflows, deployment triggers, or reusable workflow modules."
---

# github-ci

## When to use

GitHub Actions workflows, CI config, quality/deployment pipelines. Before: `.github/workflows/`, AGENTS.md, `.augment/commands/fix-ci.md`.

## Workflow overview

### Quality pipeline (`quality-tests.yml`)

Triggered on: `pull_request` to `main`, `workflow_dispatch`

Read `.github/workflows/` to discover the actual job matrix. Common patterns:

- PHP version is **extracted from Dockerfile** (`ARG PHP_VERSION`), not hardcoded.
- Static analysis may run on larger runners for memory.
- Tests run in **parallel** with a matrix strategy per test suite.
- Branch comparison for dead code and API docs.

### Deployment workflows

| Workflow | Trigger | Environment |
|---|---|---|
| `deploy-review.yaml` | PR with `review-env` label | Review (ephemeral) |
| `deploy-sta.yaml` | Push to `main` | Stage |
| `deploy-pro.yaml` | Tag `release-X.Y.Z` or schedule (Mon 8AM) | Production |
| `deploy.yml` | After "Static Code Analysis" succeeds on `main` | Envoyer trigger |
| `module-deploy.yaml` | Reusable workflow (called by others) | Parameterized |

### Other workflows

| Workflow | Purpose |
|---|---|
| `pr-review-gate.yaml` | Points-based review system (see `code-review` skill) |
| `destroy-review.yaml` | Cleanup ephemeral review environments |
| `add-labels.yml` | Auto-label PRs |
| `apply-pr-template.yaml` | Apply PR description template |
| `validate-deployment-files.yaml` | Validate AWS deployment configs |
| `template-db-dump.yaml` | Database dump utility |

## Conventions

### Workflow structure

- Use **pinned action versions** with SHA hashes (not tags): `actions/checkout@<sha> # v6.0.2`
- Use **concurrency groups** to prevent duplicate runs: `group: ${{ github.workflow }}-${{ github.ref }}`
- Use **`fail-fast: false`** in matrix strategies for independent job execution.
- Extract shared logic into **reusable workflows** (`module-deploy.yaml` pattern).

### Composer auth

Every workflow that installs dependencies needs:
1. `COMPOSER_AUTH` secret validation (check if set, validate JSON).
2. Fallback handling if auth is missing or masked.

### PHP version

- **Never hardcode** the PHP version in workflows.
- Always extract from Dockerfile: `awk -F= '/^ARG PHP_VERSION/ {print $2}' .docker/Dockerfile`
- Pass via job outputs to dependent jobs.

### Runners

Check `.github/workflows/` for the runner types used. Common patterns:
- Standard runners (`ubuntu-latest`) for light jobs.
- Larger or custom runners for heavy jobs (static analysis, tests).
- ARM runners if the project deploys to ARM-based infrastructure.

### Environment variables

- Use `env:` at job level for shared secrets.
- Use `$GITHUB_OUTPUT` for passing data between steps.
- Use `$GITHUB_ENV` for variables needed across multiple steps.

## Debugging CI failures

1. Get the failing run: `GET /repos/{owner}/{repo}/actions/runs?branch={branch}`
2. Get failed jobs: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`
3. Get logs: `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`
4. Fix locally, verify in container, then push.

See `.augment/commands/fix-ci.md` for the full debugging workflow.


## Gotcha: Ubuntu not macOS, `--env=testing` for artisan in CI, case-sensitive secrets, no `continue-on-error: true`.

## Do NOT: unpinned actions, hardcode PHP versions, undocumented secrets, runner type changes without cost check.
