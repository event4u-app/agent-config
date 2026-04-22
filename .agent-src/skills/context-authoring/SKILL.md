---
name: context-authoring
description: "Use when filling in knowledge-layer context files — auth-model, tenant-boundaries, data-sensitivity, deployment-order, observability — interactive walkthrough that turns templates into reviewer fuel."
source: package
---

# context-authoring

## When to use

Use this skill when:

- A new project has been scaffolded and the `agents/contexts/` files are still
  template stubs from `event4u/agent-config`.
- The user asks "help me fill in the auth model context", "set up tenant
  boundaries", or similar knowledge-layer work.
- A reviewer skill (`authz-review`, `data-flow-mapper`, `migration-safety`,
  `multi-tenant-boundary-review`, `secrets-and-config-review`) reports *"I
  cannot proceed — `agents/contexts/<file>.md` is still a template"*.
- After a significant architecture change that invalidates one of the five
  context files.

Do NOT use when:

- Writing a regular roadmap or feature doc — use `agent-docs-writing`.
- Creating a generic context document that does not map to one of the five
  knowledge-layer templates — use `context-create`.
- Filling in the engineering-memory YAML files (`domain-invariants.yml`, etc.)
  — use `/memory-add`.

## The five files

| File | What it answers | Who reads it |
|---|---|---|
| `auth-model.md` | Roles, permission model, impersonation, known exceptions | `authz-review`, `judge-security-auditor`, `threat-modeling` |
| `tenant-boundaries.md` | Tenancy type, scope propagation, known cross-tenant paths | `multi-tenant-boundary-review`, `blast-radius-analyzer`, `judge-security-auditor` |
| `data-sensitivity.md` | Field classification, masking rules, log-safe types | `data-exposure-review`, `data-flow-mapper`, logging reviewers |
| `deployment-order.md` | Migration strategy, feature flags, rollback plan | `migration-safety`, `judge-bug-hunter`, release reviewers |
| `observability.md` | Error tracking, log channels, metrics, known alerts | deploy reviewers, `bug-analyzer`, incident mode |

The templates ship in `.agent-src.uncompressed/templates/contexts/` and are
copied into `agents/contexts/` by the installer.

## Procedure: context-authoring

### Step 0: Inspect

1. List `agents/contexts/` — which of the five files exist? Which still contain
   the `<!-- Template shipped by event4u/agent-config. -->` HTML comment?
2. Ask the user which file to work on. Use numbered options:

   ```
   > 1. auth-model.md — roles, permissions, impersonation
   > 2. tenant-boundaries.md — tenancy type and scope propagation
   > 3. data-sensitivity.md — field classification and masking
   > 4. deployment-order.md — migrations, flags, rollback
   > 5. observability.md — errors, logs, metrics, alerts
   ```

3. If multiple files are stubs, default to the order above — `auth-model` is
   the prerequisite for `tenant-boundaries`; both feed `data-sensitivity`.

### Step 1: Harvest evidence before asking

For the chosen file, pull what the codebase already reveals before asking
the user. Record the file:line citations — they become the authoritative
source when the user is unsure.

| File | Harvest from |
|---|---|
| `auth-model.md` | Policy classes, Gate definitions, permission seeders, role enums, `@can` directives, middleware |
| `tenant-boundaries.md` | Base query scopes, connection-switching middleware, tenant-resolution service, global scopes, `.env` vars like `TENANT_*` |
| `data-sensitivity.md` | Eloquent `$hidden` / `$casts`, Sentry `beforeSend`, logging helpers, API resources, export commands |
| `deployment-order.md` | `database/migrations/`, feature-flag config (Pennant / LaunchDarkly), deploy scripts, CI workflow, rollback runbooks in `docs/` |
| `observability.md` | `config/logging.php`, Sentry init, dashboard links in READMEs, alert rules in Terraform/Grafana dashboards |

Start the walkthrough by showing the harvested evidence — the user only
has to confirm or correct, not invent from scratch.

### Step 2: Walk the template section by section

1. Open the template and treat **every HTML comment** as a question for the
   user. Do NOT fabricate answers to skip a section.
2. Present each section as:

   ```
   **Section:** <heading>
   **Template asks:** <what the comment says>
   **Evidence I found:** <file:line references or "none">
   **Proposed content:** <draft or "I need your input">

   > 1. Accept the draft
   > 2. Edit — tell me what's wrong
   > 3. I don't know — mark as "TBD" with a follow-up task
   ```

3. If the user picks "TBD", insert an HTML comment `<!-- TBD: <question> -->`
   at that spot — never a fabricated value. Reviewer skills key on the
   comment to warn about incomplete sections.

### Step 3: Preserve the file contract

1. Remove the top-of-file `<!-- Template shipped by ... -->` comment only
   after at least one section has been authored — an untouched file must
   stay recognisable as a stub.
2. Keep every heading the template ships with. Reviewer skills grep for
   exact section names (`## Known exceptions`, `## Known alerts`, etc.).
3. Do NOT add new top-level sections. The template surface is the
   contract — extend existing sections, file a proposal via
   `learning-to-rule-or-skill` to expand the template upstream.

### Step 4: Validate

1. Run `python3 scripts/check_portability.py` — project-specific content is
   expected here, but the check catches accidental copy of other projects'
   identifiers.
2. Run `python3 scripts/check_references.py` — cross-file links between the
   five contexts must resolve.
3. Confirm with the user: "is this accurate enough that a reviewer should
   treat it as the source of truth?" — anything less and a `<!-- TBD -->`
   marker stays.

## Output format

1. `agents/contexts/<file>.md` updated with project-specific content; every
   section either authored or explicitly marked `<!-- TBD: ... -->`.
2. A short summary comment back to the user: which sections are complete,
   which are `TBD`, and which downstream reviewer skills are now unblocked.
3. Optional: a proposal stub in `agents/learnings/` for any template gap
   the user hit (missing section, ambiguous field) — feeds the curated
   self-improvement pipeline via `learning-to-rule-or-skill`.

## Gotcha

- The model tends to fabricate plausible roles, fields, or alerts when
  harvesting comes up empty. Do NOT. An `<!-- TBD: ... -->` marker is
  always better than a made-up entry — reviewer skills trust this file.
- The model tends to collapse the template once it starts editing, losing
  the HTML comments that explain *why* a section exists. Preserve them
  until the section is authored — they are the authoring prompt.
- `data-sensitivity.md` is the highest-leverage file and also the one most
  likely to be skipped as "boring". Prioritise it after `auth-model` —
  missing entries here become production leaks, not review nits.
- Do not treat this skill as a form-filler. If a project is single-tenant,
  `tenant-boundaries.md` SHOULD be deleted, not stubbed — the checklist
  explicitly says so at the top of the file.

## Do NOT

- Do NOT copy content between projects. Every context file is local to its
  repo. Reuse of another project's roles, tenants, or alerts is a
  portability violation and a security risk.
- Do NOT commit TBD-heavy files without flagging them in the PR
  description. Reviewer skills will downgrade confidence, but a human
  reviewer should know the contexts are partial.
- Do NOT rename or restructure the template sections. Reviewer skills
  grep for exact headings.
