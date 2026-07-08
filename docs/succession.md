# Succession — the minimal knowledge to take over

> **Bus-factor doc (road-to-maintainer-bus-factor Phase 3).** If the maintainer
> is unavailable, this is what a successor needs to keep `main` healthy and cut
> releases. **No secret values live here — pointers only.** Companion:
> [`release-runbook.md`](release-runbook.md) (the how-to-release steps).

## Honest bus-factor (tracked, not inflated)

- **Distinct humans who have reviewed/merged in the trailing 90 days: 1** (the
  maintainer, `@matze4u`). The project is a single-maintainer repo; an AI
  self-review gate (deferred — see the roadmap Phase 1) raises the floor but is
  **not** independent human review.
- Recompute this number honestly at any time:

  ```bash
  # merged PRs in the last 90 days + who reviewed them
  gh pr list --state merged --search "merged:>=$(date -v-90d +%Y-%m-%d 2>/dev/null || date -d '90 days ago' +%Y-%m-%d)" \
    --json number,author,reviews \
    --jq '[.[] | .reviews[]?.author.login] | unique'
  ```

  Report the count as-is. A bus-factor of 1 stated plainly beats a bus-factor of
  1 implied to be more.

## Secrets / tokens — where they live, what they gate

Configured in **GitHub → Settings → Secrets and variables → Actions** (repo
secrets), never in the tree. None is required for the *core* release (version
bump + tag + GitHub Release); they gate the **downstream** publish/deploy legs.

| Secret | Gates | Missing → |
|---|---|---|
| `RELEASE_PR_TOKEN` (optional PAT / App token, `contents:write` + `pull-requests:write`) | Unattended release PR checks in [`release.yml`](../.github/workflows/release.yml) | One manual **"Approve workflows to run"** click per release (deliberate checkpoint, not a failure). |
| — (none: **npm OIDC Trusted Publishing**) | `publish-npm.yml` — uses `id-token: write`, no stored npm token | If OIDC trust is misconfigured on npmjs, npm publish fails; fix the trusted-publisher config on the npm package, not a secret. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_WORKER_SUBDOMAIN`, `MCP_SMOKE_TOKEN` | `deploy-mcp-worker.yml` (MCP worker deploy + smoke) | MCP worker deploy skips/fails; core release unaffected. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | `cross-model-canary.yml` + any AI-council / self-review automation | Canary + council automation skip; core release unaffected. |
| `GITHUB_TOKEN` (auto-provided) | all workflows' default auth | n/a — GitHub injects it. |

The live source of truth for which workflow needs which secret is the
`secrets.*` references in [`.github/workflows/`](../.github/workflows/) — grep
there if this table drifts:

```bash
grep -rhoE "secrets\.[A-Z_]+" .github/workflows/ | sort -u
```

## Operator-gated steps (need a human with credentials)

- **Release-PR workflow approval** — the "Approve workflows to run" click when
  `RELEASE_PR_TOKEN` is absent (see the runbook § 3.A).
- **Branch-protection ruleset** — applied in GitHub → Settings → Rules UI;
  source of truth mirrored in [`branch-protection-policy.md`](contracts/branch-protection-policy.md).
  Not in code; a successor edits it in the UI.
- **Repo administration** (visibility / rename / delete) — the
  `production-visibility` environment gates manual approval; see
  [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **npm trusted-publisher config** — set on npmjs.org for the package, not in
  this repo.

## "Healthy main" — what good looks like

- Latest `main` commit is green on all required checks for its PR shape
  (see [`branch-protection-policy.md`](contracts/branch-protection-policy.md),
  [`ci-green-floor.md`](contracts/ci-green-floor.md)).
- No drift gate red: `release-drift.yml`, `release-guard.yml`,
  `check-visibility-drift.yml`, the consistency + claims + proof gates.
- `docs/CLAIMS.md` resolves (`task check-claims`); `docs/proof.md` is in sync
  (`task build-proof-check`).
- No completed roadmap left unarchived in `agents/roadmaps/` (the
  `roadmap:progress-check` backstop).

## Minimal takeover checklist

1. Get `gh` authenticated as a repo admin; confirm `gh auth status`.
2. Read [`release-runbook.md`](release-runbook.md) end-to-end.
3. Confirm the secrets above are present for whichever downstream legs matter.
4. Cut a `--dry-run` release (`task release -- --dry-run`) to see the pipeline
   with zero mutations.
5. When ready, follow the runbook for a real release.
