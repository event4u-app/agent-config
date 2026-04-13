---
name: terraform
description: "Use when writing Terraform configurations — AWS modules, resources, variables, outputs, state management, and project conventions."
---

# terraform

## When to use

Terraform `.tf` files, infra modules, AWS resources. Before: repo structure (overrides), existing modules, `variables.tf`, `versions.tf`.

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

## Gotcha: `-auto-approve` needed in CI, always plan before apply, never commit state files.

## Do NOT: `*` in IAM ARNs, remove deletion_protection, change provider versions without Stage test.
- Do NOT hardcode AWS account IDs — use `data.aws_caller_identity.current`.
