# R2 Bootstrap — agent-config MCP

One-time setup for the R2 bucket that holds the Worker's release archive.
Owned by `mcp-cloud-scope.md` §3.3 and consumed by the deploy pipeline
(`.github/workflows/deploy-mcp-worker.yml`).

## Bucket

| Field | Value |
|---|---|
| Bucket name | `agent-config-mcp` |
| Location hint | `auto` (Cloudflare-chosen) |
| Public access | **off** — Worker reads via binding, never via signed URL |
| Object retention | indefinite — every release stays for forensics |

## Layout

```
agent-config-mcp/
├─ releases/
│  ├─ v<X.Y.Z>-<sha>/
│  │  ├─ content.json.gz    # gzipped content blob (R2 archival copy)
│  │  └─ manifest.json      # uncompressed manifest sidecar
│  └─ latest.txt            # one-line: v<X.Y.Z>-<sha>
└─ (no other prefixes)
```

`latest.txt` is the only mutable object. Every `releases/v*/` directory
is **immutable** once written; the pipeline refuses to overwrite an
existing release prefix.

## Bootstrap — one-time

Requires `wrangler` ≥ 4.0 and a Cloudflare API token with R2 admin scope.

```sh
# 1. Authenticate (interactive, opens browser).
npx wrangler login

# 2. Create the bucket.
npx wrangler r2 bucket create agent-config-mcp

# 3. Verify.
npx wrangler r2 bucket list | grep agent-config-mcp
```

The Worker binding is declared in `workers/mcp/wrangler.toml` under
`[[r2_buckets]]`. The pipeline reads/writes via the wrangler CLI in CI,
not via the Worker — A0-cloud invariant 2 forbids the Worker from
issuing R2 writes.

## Secrets in CI

The deploy pipeline needs two GitHub secrets:

| Secret | Scope |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `Workers Scripts:Edit` + `Workers R2 Storage:Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | account id (not a token) |

The token must be scoped to **this account only**; do not reuse a
production-tenant token.

## Manual fixes — break-glass

If `latest.txt` ends up pointing to a broken release, the recovery is to
repoint it manually:

```sh
# Repoint latest to a known-good release.
echo -n "v1.36.0-abc1234" | \
  npx wrangler r2 object put agent-config-mcp/releases/latest.txt --pipe
```

Past `releases/v*/` directories are not deleted in recovery — leave the
forensics intact.

## Terraform note

The repo does not yet manage CF resources via Terraform. When TF lands,
this bucket should move into a `cloudflare_r2_bucket` resource and this
doc shrinks to a pointer.
