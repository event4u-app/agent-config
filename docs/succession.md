# Succession — the minimal knowledge to take over

> **Bus-factor doc (road-to-maintainer-bus-factor Phase 3).** If the maintainer
> is unavailable, this is what a successor needs to keep `main` healthy and cut
> releases. **No secret values live here — pointers only.** Companion:
> [`release-runbook.md`](release-runbook.md) (the how-to-release steps).

## Honest bus-factor (tracked, not inflated)

Two different numbers get conflated under one label here, so both are stated
with the query that produces them. Window: the trailing 90 days.

- **Distinct humans who have REVIEWED a merged PR: 1** — `@matze4u`, the
  maintainer. No non-maintainer has reviewed a merged PR, so the project has
  **no independent human review**. An AI self-review gate (advisory, and inert
  without its secret — see [`self-review-gate.md`](self-review-gate.md)) raises
  the floor but is **not** independent human review.
- **Distinct humans who have MERGED to `main`: 2** — `@matze4u` and `@h3xa2`.
  The second authored *and* self-merged #765 and the 8.1.0 release #767 on
  2026-07-07, neither carrying a review. Two accounts hold effective merge
  rights on the trunk. **That is not two reviewers and must not be read as a
  bus-factor of 2** — an unreviewed self-merge adds a person who can ship, not
  a second pair of eyes.

Re-measured 2026-08-20 over 1228 merged PRs. The previously recorded figure was
a flat "reviewed/merged: 1", which was wrong under its own wording: the merger
set has held two accounts since 2026-07-07.

- Recompute honestly at any time. **The population exceeds `gh pr list`'s
  1000-row cap, so measure in slices and prove the slices are complete** — the
  command this file used to carry passed no `--limit` at all, so it silently
  read 30 of 1228 PRs and could not reproduce even its own number:

  ```bash
  SINCE=$(date -v-90d +%Y-%m-%d 2>/dev/null || date -d '90 days ago' +%Y-%m-%d)

  # 1. the population, so truncation is detectable
  gh api -X GET search/issues \
    --raw-field q="repo:event4u-app/agent-config is:pr is:merged merged:>=$SINCE" \
    --jq '.total_count'

  # 2. walk the window in slices of <1000 PRs (re-cut these for today's window)
  for r in 2026-05-22..2026-06-11 2026-06-12..2026-07-02 \
           2026-07-03..2026-07-23 2026-07-24..2026-08-20; do
    gh pr list --state merged --search "merged:$r" --limit 1000 \
      --json number,mergedBy,reviews \
      --jq '{n: length,
             reviewers: ([.[] | .reviews[]?.author.login] | unique),
             mergers:   ([.[] | .mergedBy.login]          | unique)}'
  done
  ```

  The slice `n` values **must** sum to `total_count`; if they do not, a slice
  exceeded the cap and a login can hide behind it. Report both counts as-is. A
  bus-factor of 1 stated plainly beats a bus-factor of 1 implied to be more.

## Secrets / tokens — where they live, what they gate

Configured in **GitHub → Settings → Secrets and variables → Actions** (repo
secrets), never in the tree. None is required for the *core* release (version
bump + tag + GitHub Release); they gate the **downstream** publish/deploy legs.

| Secret | Gates | Missing → |
|---|---|---|
| `RELEASE_PR_TOKEN` (optional PAT / App token, `contents:write` + `pull-requests:write`) | Unattended release PR checks in [`release.yml`](../.github/workflows/release.yml) | Possibly one manual **"Approve workflows to run"** click per release — **but do not rely on it as a gate.** Measured on 14.0.0 (2026-08-18) with the secret absent: checks started immediately, no approval was asked, and the run would have merged, tagged and published unattended. Whether the safeguard applies is a repo/org Actions setting. |
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
  `RELEASE_PR_TOKEN` is absent (see the runbook § 3.A). **Not a dependable
  checkpoint:** it did not appear on 14.0.0 (2026-08-18) and the release ran
  through to publish unattended. A human gate before a release merge has to come
  from branch protection or from cancelling the run.
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
