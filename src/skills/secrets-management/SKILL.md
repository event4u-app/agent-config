---
model_tier: medium
name: secrets-management
description: "When picking a secrets store, designing rotation, or wiring scanning gates — multi-cloud (Vault, AWS, Azure, GCP), CI and Kubernetes — decision framework, provider deep-dives externalized."
domain: devops
status: active
refresh_trigger: "A cited provider deprecates an auth method, OR External Secrets Operator ships a major version with breaking CRD changes, OR ≥30% of cited scanner tools change their gate semantics."
sunset_criterion: "When provider docs (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) all converge on a single rotation + scanning standard AND consumer projects no longer cite this skill in PR reviews for two consecutive review cycles."
recommended_for_user_types: [ops, developer]
workspaces:
  - engineering
packs:
  - engineering-base
triggers:
  - phrase: "secret rotation"
  - phrase: "secrets store"
  - phrase: "secret scanning"
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
AI-agent / MCP-server credential               → env-var indirection in the agent/MCP config
                                                  (`.mcp.json`, agent-config, CI YAML) — the
                                                  value lives in the store above; the config
                                                  holds only `${ENV_VAR}`. Never a raw key
                                                  inline, and the config path is gitignored if
                                                  it can hold one.
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

### Step 6 — Runtime guard: block before the secret lands

The scanning gates (Step 4) are the CI/pre-commit nets. The **earliest** gate is
the agent itself: before it writes a credential into a tracked file or stages a
commit, the [`secret-vcs-guard`](../../rules/secret-vcs-guard.md) rule runs the
`secret_detector` library and, on a hit,
STOPS → shows the match (`file:line` · kind · masked · why) → asks via numbered
options → offers the tiered alternative below. It never silently commits and
never silently strips. VCS-agnostic: the same detector runs against the diff for
git, SVN, and Mercurial (SVN/hg native hooks are server-side, a stronger but
later net). The deterministic CI backstop is `check_secret_leak` — the agent
gate is one layer, not the whole defense.

**False positives — audited allowlist, never a global mute.** Suppress a
confirmed non-secret with an inline `# secret-allow` marker on the line, or a
narrow entry (`path` or `path:line`) in a repo-root `.secret-allow` file. Each
`.secret-allow` entry SHOULD carry a one-line justification comment (`#  …`) so it
is reviewable in the diff; the entry is line-scoped, so it cannot mute a *new*
secret elsewhere in the same file.

**Tiered alternative to suggest when a secret is caught** (refines Step 1 for the
in-the-moment fix; cite OWASP Secrets Management Cheat Sheet + CWE-798 + 12-factor):

```
Solo / local, dev-only        → gitignored .env + committed .env.example (keys, no values).
Team / production app         → cloud secret manager (AWS/GCP/Azure) or Vault / Doppler.
Kubernetes / GitOps           → SOPS (encrypt values in the committed file) or Sealed Secrets.
CI / deploy                   → OIDC federation to the cloud — no long-lived stored credential.
```

## Remediation — a secret already reached VCS

Order matters; a history rewrite does **not** un-leak an already-pushed secret:

1. **Rotate / revoke the credential now.** Immediate, and the only step that
   actually stops the damage — assume it is compromised the moment it was pushed.
2. **`git rm` / a deletion commit is insufficient** — the secret stays in history
   (`git log`, blame, prior commits, clones, forks, CI logs).
3. **Purge history** with `git filter-repo` (preferred) or BFG Repo-Cleaner.
4. **Force-push + coordinate** re-clones; forks and existing clones still hold the
   old objects — which is why step 1 is the real fix.

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
- **Agent/MCP config is a new leak surface.** A raw provider key pasted into `.mcp.json`, an agent-config file, or a CI workflow YAML is a committed secret — the scanning gates (Step 4) must cover those paths too, and the config should reference `${ENV_VAR}`, never the literal. An MCP server that ingests untrusted content **and** holds a live key is the egress leg of the lethal trifecta — see [`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md).

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

- Adopted from: an external reference (internal provenance, redacted) — **Sunset Policy applied**: a large provider cookbook reduced to a ~140-line decision framework; per-provider deep-dives externalized to upstream docs below.
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
