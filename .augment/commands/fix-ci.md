---
skills: [github-ci, quality-tools]
description: Fetch CI errors from GitHub Actions and fix them
---

# fix-ci

## Instructions

### 1. Identify failing run

`git branch --show-current` → `GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=5` → most recent failure.

### 2. Get failure details

Jobs: `runs/{run_id}/jobs`. Logs: `jobs/{job_id}/logs`. Fallback: `commits/{sha}/check-runs` + `/status`.

### 3. Analyze and fix

Project type: `artisan` → Laravel, else Composer. Common: PHPStan (fix, no baseline), ECS (`--fix`), Rector (`--fix`), tests, Biome/TS.

### 4. Verify locally

### Rules

- No commit/push. Fix root cause. Unclear → ask.

