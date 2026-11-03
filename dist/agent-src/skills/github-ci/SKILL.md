---
model_tier: medium
name: github-ci
description: "When working with GitHub Actions — workflow YAML, quality gates, test matrices, deployment triggers, reusable workflows — even when the user just says 'my CI is failing' or 'add a check'."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# github-ci

## When to use

Use this skill when working with GitHub Actions workflows, CI pipeline configuration, or understanding the automated quality and deployment process.

## Procedure: Modify CI workflows

1. Read `.github/workflows/` to understand the full pipeline.
2. Check `AGENTS.md` for quality tool commands and testing setup.
3. Read `commands/fix/ci.md` for CI failure debugging workflow.

## Workflow overview

Do not assume a pipeline shape — read `.github/workflows/` and tabulate, per
workflow, its trigger (`on:`) and the environment or target it reaches:

| Workflow | Trigger | Environment / target |
|---|---|---|
| *(one row per file you read)* | | |

Note which jobs are **privileged** — they hold `id-token: write`,
`contents: write`, or a secret other than `GITHUB_TOKEN` — because the security
conventions below bind tighter there.

## Conventions

### Workflow structure

- Use **pinned action versions** with SHA hashes (not tags): `actions/checkout@<sha> # v6.0.2`
- Use **concurrency groups** to prevent duplicate runs: `group: ${{ github.workflow }}-${{ github.ref }}`
- Use **`fail-fast: false`** in matrix strategies for independent job execution.
- Extract shared logic into **reusable workflows** (`on: workflow_call`).
- **Free text reaches a script only through `env:`.** A `${{ }}` reading a
  free-text context — a `type: string` or untyped input, a release tag/name/body,
  a PR title/body/head ref, `github.head_ref`, a commit message, a label name —
  never sits inline in `run:` or a github-script `script:`; set it as a step
  `env:` variable and read it as `"$VAR"`. Hold a value that later steps
  re-interpolate (a resolved tag) to a fixed shape. Linter rule:
  `template-injection`.
- **Every `actions/checkout` states `persist-credentials`.** `false` by default;
  `true` only where a later step pushes, with a comment naming that step. Linter
  rule: `persist-credentials`.
- **No Actions cache in a privileged job.** A job with `id-token: write`,
  `contents: write` or a non-default secret does not restore a cache (`cache:`
  on a `setup-*` action, or `actions/cache`) — a lower-privilege workflow can
  write the entry it restores. Linter rule: `privileged-job-cache`.
- A job with **`container:`** MUST run `git config --global --add safe.directory "$GITHUB_WORKSPACE"` immediately after `actions/checkout` — the checkout is owned by a different UID than the container user, so without it every git-backed step dies with `fatal: detected dubious ownership`.

### Runtime version

- **Never hardcode** the language runtime version in workflows.
- Read it from the project's own source of truth (a Dockerfile `ARG`, `.nvmrc`,
  `engines`, `.tool-versions`) and pass it via job outputs to dependent jobs.

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

See `commands/fix/ci.md` for the full debugging workflow.


## Output format

1. Modified workflow YAML file(s) in `.github/workflows/`
2. Summary of pipeline changes and affected triggers

## Auto-trigger keywords

- GitHub Actions
- CI/CD
- workflow
- pipeline
- quality checks

## Gotcha

- CI workflows run on Ubuntu, not macOS — don't assume macOS-specific tools are available.
- The model forgets to add `--env=testing` to artisan commands in CI — tests will hit the wrong database.
- Secret names are case-sensitive in GitHub Actions — double-check the casing.
- Don't add `continue-on-error: true` to hide failures — fix the actual error.

## Do NOT

- Do NOT use unpinned action versions (e.g., `actions/checkout@v4`).
- Do NOT hardcode the runtime version — read it from the project's own source.
- Do NOT interpolate free text into `run:` — pass it through `env:`.
- Do NOT add new secrets without documenting them.
- Do NOT change runner types without considering cost and architecture (ARM vs x86).
