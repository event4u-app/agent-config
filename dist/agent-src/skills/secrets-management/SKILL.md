---
model_tier: medium
name: secrets-management
description: "Use when picking a secrets store, designing rotation, or wiring scanning gates — multi-cloud (Vault, AWS, Azure, GCP), CI, and Kubernetes — decision framework, provider deep-dives externalized."
domain: devops
status: active
refresh_trigger: "A cited provider deprecates an auth method, OR External Secrets Operator ships a major version with breaking CRD changes, OR ≥30% of cited scanner tools change their gate semantics."
sunset_criterion: "When provider docs (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) all converge on a single rotation + scanning standard AND consumer projects no longer cite this skill in PR reviews for two consecutive review cycles."
recommended_for_user_types: [ops, developer]
workspaces:
  - engineering
packs:
  - engineering-base
---

# secrets-management

Decision framework for storing, rotating, and scanning secrets across cloud, CI, and Kubernetes. **Provider deep-dives live upstream** (links in § Provenance) — this skill is the predicate, not the per-vendor cookbook. Sunset-policy compliant.

## When to use

- Designing where a new secret lives (env var, Vault, AWS Secrets Manager, Azure KV, GCP SM, GitHub/GitLab CI, k8s).
- Reviewing a diff that introduces a credential, API key, signing key, or DB password.
- Setting up secret rotation for an existing application.
- Wiring secret-scanning gates into pre-commit, CI, or org-policy.

Do NOT use when:

- The secret is project-AWS-only and `aws-infrastructure` already covers the placement — route there.
- The work is a security audit of running code — route to [`security-audit`](../security-audit/SKILL.md) or [`threat-modeling`](../threat-modeling/SKILL.md).
- The decision is which cipher to use for at-rest encryption — read the provider's KMS docs directly.

## Decision framework

### Step 1 — Pick the store

```
Ephemeral, dev-only, never leaves the laptop  → .env (gitignored). Stop.
Single-cloud, single-app                       → that cloud's native store
                                                  (AWS Secrets Manager / Azure Key Vault /
                                                  GCP Secret Manager).
Multi-cloud OR on-prem hybrid                  → HashiCorp Vault (or cloud-agnostic equivalent).
CI-only (deploy keys, signing tokens)          → GitHub/GitLab repo+environment secrets;
                                                  scope to environment (production/staging).
Kubernetes workload secrets                    → External Secrets Operator pulling from
                                                  the canonical store above; never hand-rolled
                                                  k8s `Secret` objects committed to git.
Cross-tenant / cross-org shared secret         → don't. Re-architect; shared secrets are an
                                                  outage and a breach class on their own.
```

### Step 2 — Pick the access pattern

```
Application reads at boot                      → fetch once, hold in memory; re-fetch on rotation event.
Application reads per-request                  → cache with TTL ≤ rotation period / 2.
Short-lived workload (Lambda, Job)             → fetch per-invocation; rely on platform IAM.
Long-lived workload                            → leased / dynamic credentials (Vault DB engine,
                                                  AWS IAM role) — never static creds.
Human access                                   → no shared logins; per-user identity + audit.
```

### Step 3 — Define the rotation contract

Every secret MUST have:

- **Owner** — team/person responsible for rotation; tracked in code or runbook.
- **Period** — calendar trigger (e.g. 90 days for static creds, hours/minutes for dynamic).
- **Mechanism** — automated (Lambda + Secrets Manager rotation, Vault dynamic secret, IAM role) or documented manual procedure.
- **Verification** — post-rotation health check; alert if old credential still observed in use after rotation grace window.

Static secrets without a rotation mechanism are a deferred incident — refuse to merge.

### Step 4 — Wire the scanning gates

Three layers, all required:

```
Pre-commit  → gitleaks / TruffleHog / detect-secrets pre-commit hook.
CI          → server-side scan on every PR; block merge on high-confidence finding.
Org policy  → push-protection at the SCM (GitHub Advanced Security secret scanning,
              GitLab Secret Detection); rotate any leaked secret immediately.
```

A leaked secret is rotated, not deleted. Git history retention defeats deletion.

### Step 5 — Egress controls

```
Logs                → mask before write; CI runners must mark secrets as masked.
Stack traces        → never include secret values; sanitize at the boundary.
Error responses     → never echo the secret back, even on failure.
Telemetry / APM     → strip from request/response captures; allowlist headers.
```

## Procedure: Apply to a new secret

1. **Inspect** the existing secret inventory and IaC for store conventions; run Step 1 and lock the store decision in code/IaC.
2. Define the access pattern (Step 2); choose static-vs-dynamic explicitly.
3. Write the rotation contract (Step 3) into the runbook **before** the secret ships.
4. Verify the three scanning gates (Step 4) cover the repo.
5. Audit egress paths (Step 5) for the new secret class.
6. Hand the design to a reviewer; cite this skill.

## Output format

1. Secret-inventory entry: name · store · access-pattern · owner · rotation-period · mechanism.
2. Scanner-gate matrix: layer · tool · scope · failure mode.
3. Egress-control checklist with sign-off per category.

## Gotcha

- "We rotate in Secrets Manager" — but the application caches the value forever. Cache TTL must be ≤ rotation grace.
- External Secrets Operator pulls into a k8s `Secret`; that Secret is base64, **not encrypted**. Threat-model node access accordingly.
- GitHub environment secrets are NOT available on `pull_request` events from forks — designs that rely on them silently break for external contributors.
- Vault dynamic creds expire faster than long-running connection pools assume; close + re-acquire on lease near-expiry, don't wait for the failure.
- Pre-commit scanners fire only when developers install the hook — CI scanners are the load-bearing gate.

## Do NOT

- Do NOT commit a secret, even to a private repo. Rotate any leaked secret; deletion does not work.
- Do NOT pass secrets via CLI args (`ps` exposes them) — use env or stdin.
- Do NOT echo secrets in logs, stack traces, error responses, or APM captures.
- Do NOT hand-roll Kubernetes `Secret` objects committed to git — use External Secrets Operator.
- Do NOT inline the per-provider cookbooks into this skill — externalize per Sunset Policy.

## Auto-trigger keywords

- secrets management
- secret rotation
- vault / aws secrets manager / azure key vault / gcp secret manager
- external secrets operator
- secret scanning / gitleaks / trufflehog
- credential leak

## Provenance

- Adopted from: an external reference (MIT, © 2025 an external reference) — **Sunset Policy applied**: 346-line provider cookbook reduced to a ~140-line decision framework; per-provider deep-dives externalized to upstream docs below.
- Externalized provider docs:
  - HashiCorp Vault: https://developer.hashicorp.com/vault/docs · https://developer.hashicorp.com/vault/docs/secrets/databases
  - AWS Secrets Manager: https://docs.aws.amazon.com/secretsmanager/ · rotation: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html
  - Azure Key Vault: https://learn.microsoft.com/en-us/azure/key-vault/general/
  - GCP Secret Manager: https://cloud.google.com/secret-manager/docs
  - External Secrets Operator: https://external-secrets.io/
  - GitHub secret scanning: https://docs.github.com/en/code-security/secret-scanning · gitleaks: https://github.com/gitleaks/gitleaks · TruffleHog: https://github.com/trufflesecurity/trufflehog
- Cross-linked: [`aws-infrastructure`](../aws-infrastructure/SKILL.md), [`security-audit`](../security-audit/SKILL.md), [`threat-modeling`](../threat-modeling/SKILL.md), [`security`](../security/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `secrets-management`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`, `non-destructive-by-default`.
