# Cloudflare MCP — Operator Setup

One-stop landing for onboarding a Cloudflare account to host the
`agent-config-mcp` Worker. Combines bucket bootstrap, DNS, GitHub
secrets, and troubleshooting in one place.

Governed by [`docs/contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md)
(A0-cloud). Deploys run **only** in CI
([`.github/workflows/deploy-mcp-worker.yml`](../../.github/workflows/deploy-mcp-worker.yml))
— per A0-cloud invariant 7, never `wrangler deploy` from a developer
machine.

## TL;DR — the happy path

```sh
task mcp:cloud:login        # one-time, opens browser
task mcp:cloud:setup        # check → r2-create → r2-verify → whoami
# Copy account id from output → GitHub Secrets (see § GitHub Secrets)
# Create scoped API token (see § API Token) → GitHub Secrets
# Done. First `release: published` triggers the deploy.
```

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | <https://nodejs.org/> or `nvm install 20` |
| `npx`/`wrangler` | wrangler ≥ 4.0 (auto-fetched on first run) | bundled with Node |
| `gh` CLI | latest | <https://cli.github.com/> (only for manual `deploy-dispatch`) |
| Cloudflare account | any plan | <https://dash.cloudflare.com/sign-up> |

Run `task mcp:cloud:check` to verify all four in one shot.

## Step 1 — Cloudflare login

```sh
task mcp:cloud:login
```

Opens a browser to authorize wrangler against your Cloudflare account.
One-time per developer machine; the token is stored in
`~/Library/Preferences/.wrangler/` (macOS) or `~/.wrangler/` (Linux).

## Step 2 — Enable R2

Cloudflare requires a one-time plan activation before R2 buckets can
be created. **You will hit error `code: 10042` on the first attempt
if you skip this.**

1. <https://dash.cloudflare.com/?to=/:account/r2/overview>
2. Click **Purchase R2 Plan**
3. Select **Free Tier** — 10 GB storage / 1 M Class-A / 10 M Class-B
   ops per month at **$0** (credit card required, $0 within quota,
   $0 egress)
4. Confirm; wait ~30 s for activation

## Step 3 — Create the R2 bucket

```sh
task mcp:cloud:r2-create     # idempotent — safe to re-run
task mcp:cloud:r2-verify     # ✅ if present
```

The bucket is named `agent-config-mcp` and configured per
[`docs/setup/mcp-r2-bootstrap.md`](mcp-r2-bootstrap.md) (private,
indefinite retention, Worker reads via binding).

`task mcp:cloud:setup` chains steps 1, 3, and the account-id readout
in one shot.

## Step 4 — API Token

The CI deploy pipeline needs a **scoped** token — never reuse the
Global API Key or a production-tenant token.

Dashboard → **My Profile → API Tokens → Create Token → Custom token**:

| Permission | Resource | Access |
|---|---|---|
| Account · Workers Scripts | your account | Edit |
| Account · Workers R2 Storage | your account | Edit |
| User · User Details | — | Read |

If you uncomment the `routes` block in `workers/mcp/wrangler.toml`
(custom domain cutover, Phase 5.2), add **Zone · DNS · Edit** on the
relevant zone.

Copy the generated token immediately — Cloudflare shows it once.

## Step 5 — GitHub Secrets

Repository → **Settings → Secrets and variables → Actions → New
repository secret**:

| Secret | Value | Source |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | scoped token from Step 4 | dashboard |
| `CLOUDFLARE_ACCOUNT_ID` | account id | `task mcp:cloud:whoami` |

Set them in **Actions** secrets, not **Codespaces** or **Dependabot**
scopes.

## Step 6 — Validate

Trigger the deploy workflow manually against an existing tag — no
release event needed:

```sh
task mcp:cloud:deploy-dispatch TAG=v1.37.0
gh run watch
```

Green smoke step → `latest.txt` repoints → release is live on
`*.workers.dev`. A red smoke step leaves `latest.txt` on the previous
release.

## Step 7 — DNS (optional, Phase 5.2)

Custom domain `mcp.<your-domain>` setup lives in
[`docs/setup/mcp-cloud-endpoints.md`](mcp-cloud-endpoints.md) § DNS
setup. Until cutover, the Worker serves on the free
`agent-config-mcp.<account>.workers.dev` URL.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `code: 10042` on bucket create | R2 not enabled on account | Step 2 — Enable R2 |
| `wrangler whoami` shows no Account ID | not logged in | `task mcp:cloud:login` |
| Workflow fails on `wrangler deploy` with auth error | secret missing/wrong scope | re-check Step 4 token permissions |
| Smoke step red after deploy | bundle vs. SDK mismatch | check `compatibility_date` in `wrangler.toml` |
| Bucket create returns `already exists` | bucket present | not an error — `task mcp:cloud:r2-verify` to confirm |

## Available tasks

| Task | Purpose |
|---|---|
| `task mcp:cloud:check` | Preflight — tools + login status |
| `task mcp:cloud:login` | Interactive wrangler login |
| `task mcp:cloud:whoami` | Print account id for GitHub Secret |
| `task mcp:cloud:r2-create` | Create R2 bucket (idempotent) |
| `task mcp:cloud:r2-verify` | Verify R2 bucket exists |
| `task mcp:cloud:setup` | Full chain — check → r2 → whoami |
| `task mcp:cloud:dev` | Local `wrangler dev` on :8787 |
| `task mcp:cloud:deploy-dispatch TAG=v…` | Manual workflow trigger |

## See also

- [`docs/contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md) — A0-cloud contract
- [`docs/setup/mcp-r2-bootstrap.md`](mcp-r2-bootstrap.md) — R2 layout & break-glass
- [`docs/setup/mcp-cloud-endpoints.md`](mcp-cloud-endpoints.md) — URL shapes & DNS
- [`workers/mcp/README.md`](../../workers/mcp/README.md) — Worker source overview
