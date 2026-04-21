---
name: terraform
description: "Use when writing Terraform — AWS modules, resources, variables, outputs, remote state — even when the user just says 'provision this infra' or 'add an S3 bucket' without naming Terraform."
source: package
---

# terraform

## When to use

Use this skill when writing or modifying Terraform configurations (`.tf` files), creating new infrastructure modules, or understanding AWS resource definitions.

## Procedure: Write Terraform config

1. Read the infrastructure repo structure (check `agents/overrides/skills/terraform.md` for the repo location).
2. Check existing modules in `modules/` for patterns and conventions.
3. Read `variables.tf` of the target module to understand required inputs.
4. Check `versions.tf` for provider version constraints.

## Project structure (typical)

```
{infrastructure-repo}/
├── environments/
│   ├── pro/                    # Production environment
│   │   ├── root.hcl            # Terragrunt root config
│   │   ├── core/               # Core infrastructure (VPC, DNS zones)
│   │   └── {service}/          # Per-service resources
│   └── sta/                    # Stage environment
│       └── ...
├── modules/
│   ├── core/                   # VPC, DNS, shared resources
│   └── {service}/              # Per-service module (ECS, ALB, ECR, etc.)
└── Taskfile.yml                # Task runner commands (or Makefile)
```

Read `agents/overrides/skills/terraform.md` for the actual repository layout and service names.

## Conventions

### Provider versions

- Always pin provider versions in `versions.tf`.
- Check `versions.tf` in the existing modules for the project's version constraints.

### Module sources

Prefer community or organization-specific Terraform modules from the Terraform Registry:

```hcl
module "alb" {
  source  = "{org}/application-load-balancer/aws"
  version = ">= 1.0.0, < 2.0.0"
}
```

Check existing modules in the project for which registry modules are used.

### Naming

- Resource prefix: `var.global_prefix` (e.g., `{project}-{env}`)
- All resources must include `tags = var.tags`
- Security groups: `${var.global_prefix}-<purpose>` (e.g., `-ecs`, `-mysql`, `-redis`)
- Log groups: `/aws/ecs/${cluster}/${service}`

### State management

- Remote state in **S3** with **DynamoDB** locking.
- State is encrypted.
- Key pattern: `${path_relative_to_include()}/terraform.tfstate`

### Variables

- Use typed `variable` blocks with `description`.
- Use `object()` types for complex inputs (not `any` unless unavoidable).
- Use `optional()` with defaults where appropriate.
- Group variables by domain (naming, network, ECS, Redis, database, etc.).

### Lifecycle rules

- Use `ignore_changes = [task_definition]` on ECS services — task definitions are managed by CI/CD, not Terraform.
- Use `deletion_protection = true` on databases.

### Security

- OIDC authentication for GitHub Actions (no long-lived credentials).
- Secrets stored in **AWS Secrets Manager**.
- Security groups follow least-privilege: only allow traffic between known services.
- IAM policies use specific resource ARNs, not wildcards (except where unavoidable).

## Common patterns

### ECS service with CodeDeploy (Blue/Green)

Used for web services with zero-downtime deployments:
- ALB → Target Group → ECS Service
- CodeDeploy handles traffic shifting
- Auto-rollback on CloudWatch alarms (5xx error rate)

### ECS service without CodeDeploy

Used for workers and schedulers:
- Direct ECS service update
- `deployment_controller { type = "ECS" }`
- `lifecycle { ignore_changes = [task_definition] }`

### GitHub OIDC IAM role

Each environment has a GitHub IAM role with:
- OIDC trust policy (scoped to repo + environment)
- Policies for ECR push/pull, ECS deployment, Secrets Manager read, CloudWatch logs

## Output format

1. Terraform configuration files (.tf) with proper module structure
2. Variables, outputs, and state management config

## Auto-trigger keywords

- Terraform
- AWS infrastructure
- modules
- resources
- state management

## Gotcha

- `terraform apply` without `-auto-approve` requires interactive confirmation — don't use in CI without the flag.
- The model forgets to run `terraform plan` before `apply` — always plan first, review changes.
- State files contain sensitive data — never commit them to Git. Use remote state (S3 + DynamoDB).

## Do NOT

- Do NOT use `*` in IAM resource ARNs unless absolutely necessary.
- Do NOT remove `deletion_protection` from databases.
- Do NOT change provider versions without testing in Stage first.
- Do NOT hardcode AWS account IDs — use `data.aws_caller_identity.current`.
