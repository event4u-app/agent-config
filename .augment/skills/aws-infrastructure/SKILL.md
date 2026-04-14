---
name: aws-infrastructure
description: "Use when working with AWS resources — ECS Fargate, ECR, EFS, Secrets Manager, gomplate templates, or multi-environment deployment setup."
source: package
---

# aws-infrastructure

## When to use

AWS infra, deployment, ECS tasks, env-specific settings. NOT for: local dev (`docker`), app code.

## Before: `.aws/` dir, CI workflows, vars files, project overrides (`agents/overrides/skills/aws-infrastructure.md`).

## Architecture overview

### Environments (typical setup)

| Environment | Trigger | Notes |
|---|---|---|
| Review | PR with label | Ephemeral, per-branch |
| Stage | Push to `main` | Persistent, pre-production |
| Production | Release tag | Persistent, live |

### Common AWS services

| Service | Purpose |
|---|---|
| **ECS Fargate** | Container orchestration (no EC2 instances) |
| **ECR** | Docker image registry |
| **EFS** | Shared filesystem (private + public access points) |
| **Secrets Manager** | `.env` file storage per environment |
| **IAM Roles** | OIDC-based GitHub Actions authentication |
| **VPC** | Networking (security groups, subnets) |

### Vars file structure

Environment-specific config files (e.g., `.aws/*.vars.yaml`) typically contain:

```yaml
AWS:
  GlobalPrefix: {project}-{env}     # Resource naming prefix
  Region: eu-central-1              # AWS region
  RoleArn: arn:aws:iam::...        # GitHub Actions OIDC role
  ECS:
    Cluster: {project}-{env}       # ECS cluster name
  VPC:
    SecurityGroups: [...]
    Subnets: [...]
  EFS:
    FileSystemId: fs-...
```

Read the actual vars files in the project for concrete values.

### Template structure

Templates commonly use **gomplate** for rendering. Typical templates:

| Template | Purpose |
|---|---|
| `task-definition-web.tpl.yaml` | Web server (app + reverse proxy) |
| `task-definition-worker.tpl.yaml` | Queue worker |
| `task-definition-scheduler.tpl.yaml` | Task scheduler (cron) |
| `task-definition-migrations.tpl.yaml` | One-shot migration runner |

Template variables:
- `{{ .Env.DockerImage }}` — Full ECR image URI with tag
- `{{ .Env.CommitHash }}` — Git commit SHA
- `{{ (ds "Vars").AWS.* }}` — Values from the vars file

## Deploy: Stage/Prod = Build→ECR→Migrations(one-shot)→Deploy. Review = Build→ECR→Single service→PR comment.

## Auth: OIDC (no long-lived creds). Tags: `sha-<sha>` + `latest`/`<review-name>`. Secrets: AWS Secrets Manager (`<GlobalPrefix>-dotenv`). Platform: check arch (arm64/amd64).

## IaC: Terraform+Terragrunt in separate repo. See `terraform`/`terragrunt` skills.

## Gotcha: no hardcoded credentials, ECS task defs are immutable, gomplate `{{ }}` conflicts with other template engines.

## Do NOT: change VPC/subnet/SG without approval, modify IAM roles, hardcode account IDs, change GlobalPrefix, switch architecture without updating everything.
