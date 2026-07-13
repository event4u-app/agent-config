# Checklist — infrastructure / IaC / CI change

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches
Terraform/Pulumi, Dockerfiles, Kubernetes manifests, or CI workflows.

| Check | What to look for |
|---|---|
| **Least privilege** | No `Action:*` / `Resource:*` / `permissions: write-all`; the grant is the narrowest the task needs. |
| **No open management ports** | No `0.0.0.0/0` to SSH / DB / admin ports. |
| **Encryption** | Encryption at rest enabled on new storage; TLS on new endpoints. |
| **No hardcoded creds** | Secrets come from a vault / secret store, never inline in the manifest or workflow. |
| **CI-agent trust** | A workflow that runs an AI agent or executes PR-derived content checks its trigger (`pull_request_target` on fork PRs is attacker-influenced) and does not expose repo secrets to untrusted input — see [`agent-security-review`](../../agent-security-review/SKILL.md). |
| **Scanner backstop** | A real scanner (Checkov / Trivy) is the gate, not just a successful `plan`. |

Any prod-touching infra change (deploy, prod data/infra, secrets rotation) is a
**Tier-2** alignment flag requiring blast-radius + rollback per the engineering
safety floor — never approve it as a mechanical pass.
