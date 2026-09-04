---
model_tier: medium
name: aws-infrastructure
description: "Use when working with AWS resources — ECS Fargate, ECR, EFS, Secrets Manager, gomplate templates, multi-env deployments — even when the user says 'deploy to staging' without naming AWS."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# aws-infrastructure

## When to use

Use this skill when working with AWS infrastructure, deployment configurations, ECS task definitions, or environment-specific settings.

Do NOT use when:
- Local development setup (use `docker` skill)
- Application code changes

## Procedure: Modify AWS infrastructure

1. Read the `.aws/` directory (or equivalent) for environment configs and templates.
2. Read CI/CD workflows (e.g., `.github/workflows/`) for the deployment pipeline.
3. Check the environment-specific vars files.
4. **Read project-level overrides** — check `agents/overrides/skills/aws-infrastructure.md` for project-specific service names, prefixes, and infrastructure details.

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

## Deployment flow

### Standard (Stage/Production)

1. **Build**: Docker image → ECR (tag: SHA + `latest`)
2. **Migrations**: Run as ECS task (one-shot), wait for completion
3. **Deploy Services**: Update ECS services with new task definitions

### Review environments

1. **Build**: Docker image → ECR (tag: SHA + branch-hash)
2. **Deploy**: Create or update single ECS service (combined task)
3. **Comment**: Post deployment URL on PR

## Conventions

### Authentication

- GitHub Actions uses **OIDC** (no long-lived AWS credentials).
- Role ARN is per-environment in the vars file.
- `aws-actions/configure-aws-credentials` handles the OIDC exchange.

### Image tagging

- Primary tag: `sha-<full-commit-sha>` (immutable)
- Secondary tag: `latest` (Stage/Production) or `<review-env-name>` (Review)

### Secrets

- `.env` files are stored in **AWS Secrets Manager**.
- Naming convention: `<GlobalPrefix>-dotenv`.

### Platform

- Check the project's architecture target (`linux/arm64` for Graviton, `linux/amd64` for x86).
- Ensure CI runners match the target architecture.

## Infrastructure as Code

The underlying AWS resources (ECS clusters, ALBs, RDS, Redis, IAM roles, security groups, etc.)
are typically managed via **Terraform + Terragrunt** in a separate infrastructure repository.

See the `terraform` and `terragrunt` skills for general IaC conventions.

### Least privilege and permissive defaults

The conventions above describe how this project deploys. This section is the
floor underneath them, and it holds whether or not a given resource is managed
here or in the infrastructure repo.

- **Least-privilege IAM, always.** A task role, an OIDC role, or an execution
  role enumerates its actions and its resource ARNs. `Action: *` and
  `Resource: *` are not shorthand for "we will scope it later" - one
  compromised task credential then reaches every service and object in the
  account. A wildcard needs a named, reviewed exception written beside it.
- **Least-privilege networking.** A security group opens a port to the
  narrowest source that works: another security group id, a prefix list, a
  known CIDR. An internet-wide source belongs to a public listener and nothing
  else.
- **Permissive defaults are decisions.** A bucket with no public-access block,
  a database with `publicly_accessible` left true, a volume or snapshot with no
  encryption block - each of these works either way, which is why it survives
  review. Treat an absent security block as a finding, not as a silence.
- **Credentials come from Secrets Manager, never from a vars file.** A literal
  password, token, or key in a `.vars.yaml` or a task-definition template is
  the same defect as one in `.tf`, and the state and template files are as
  readable as the code.

Do not restate the mitigation here. The abuse case, the required controls, and
the negative test for each of the four live in the `infrastructure` surface
class of [`threat-modeling`](../threat-modeling/SKILL.md)'s corpus, which is
their single authority. Ask that skill's grounded-corpus step for the
`infrastructure` surface class - it carries the invocation - describing the
change, e.g. *iam role with a wildcard action*.

Those rows carry a `Decided by:` clause naming the check that actually decides
each one. For the IAM, networking, storage, and encryption rows it reads NO
CHECK IN THIS REPOSITORY; only the credential-in-a-file row names a real gate.
Nothing here parses IAM policy documents or cloud config, so the discipline
above is the enforcement, and saying otherwise would claim coverage this
package does not have.

See also the `terraform` skill's *Permissive defaults and missing security
blocks* section for the backstop greps over a `.tf` tree.

## Output format

1. Modified infrastructure config/template files
2. Environment-specific changes clearly separated
3. Summary of what changed and which environments are affected

## Auto-trigger keywords

- AWS
- ECS Fargate
- ECR
- EFS
- Secrets Manager
- deployment

## Gotcha

- Never hardcode AWS credentials — always use Secrets Manager or environment variables.
- ECS task definitions are immutable — you create new revisions, not edit existing ones.
- gomplate templates use `{{ }}` which conflicts with other template engines — escape carefully.

## Do NOT

- Do NOT change VPC/subnet/security group IDs without infrastructure team approval.
- Do NOT modify IAM role ARNs — they are managed via Terraform.
- Do NOT hardcode AWS account IDs in templates.
- Do NOT change the `GlobalPrefix` — it's used for resource naming across AWS.
- Do NOT switch platform architecture without updating all runners and ECS configs.
