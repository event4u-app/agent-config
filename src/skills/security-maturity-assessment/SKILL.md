---
model_tier: high
name: security-maturity-assessment
description: "Use when the user wants a security-maturity scorecard / posture assessment of a module — category ratings with evidence, not a vulnerability hunt. Also on 'wie sicher ist dieses Modul aufgestellt?'"
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# security-maturity-assessment

Rate how mature a module's security **posture** is — category by category,
every rating backed by `file:line` evidence — instead of hunting individual
vulnerabilities. The output is a scorecard a maintainer can re-run and diff,
not a finding list.

## When to use

- "How mature / well-set-up is this module's security?" — posture, not holes
- Baseline before a hardening effort, or re-assessment after one
- A stakeholder needs a defensible rating per category with cited evidence

Do NOT use when:

- Hunting concrete vulnerabilities — route to [`security-audit`](../security-audit/SKILL.md)
- One route/action's authorization chain — route to [`authz-review`](../authz-review/SKILL.md)
- Pre-implementation threat model for a new feature — route to [`threat-modeling`](../threat-modeling/SKILL.md)
- Writing new secure code — route to [`security`](../security/SKILL.md)
- AI-agent config/behaviour review — route to [`agent-security-review`](../agent-security-review/SKILL.md)

## The nine categories

| # | Category | Critical? | What to inspect |
|---|---|---|---|
| 1 | Input validation | **Yes** | Request-boundary validation primitives on every entry point; no inline ad-hoc checks |
| 2 | Authorization | **Yes** | Per-object ownership/tenant checks, policy coverage, field-level access |
| 3 | Secrets handling | **Yes** | No hardcoded creds; env/vault usage; secrets absent from logs and VCS |
| 4 | Error handling | No | No swallowed exceptions; no stack traces / internals leaked to clients |
| 5 | Logging & audit | No | Security events (auth, permission denials, admin actions) logged; no PII in logs |
| 6 | Dependency hygiene | No | Lockfiles present; known-CVE scan wired; update cadence visible |
| 7 | Data boundaries | No | Serializers/resources whitelist fields; exports/queues don't leak internals |
| 8 | Tenant isolation | **Yes** (multi-tenant only; else N/A) | Tenant scoping on queries, jobs, caches; cross-tenant negative tests |
| 9 | Security test coverage | No | Negative tests exist (401/403/404 paths, abuse cases), not only happy-path |

## Rating rubric

| Rating | Meaning |
|---|---|
| **Missing** | No control exists for the category |
| **Weak** | Ad-hoc, inconsistent — some paths covered, most not |
| **Moderate** | Control present and usual, with named gaps |
| **Satisfactory** | Consistent across the surface; minor gaps only |
| **Strong** | Consistent AND enforced (CI gate, test, linter) or negatively tested |

## Procedure

1. **Scope** — name the module/paths under assessment; list entry points
   (routes, jobs, commands, webhooks). A scorecard without a stated scope is
   not reproducible.
2. **Assess each category** — inspect the code the category names. Every
   rating cites evidence:
   - Positive evidence: `file:line` of the control (`app/Http/Requests/…:12`).
   - Absence evidence: the searches run that came back empty (name the grep
     patterns) — "not found" beats "probably missing".
   - Multi-tenant N/A: single-tenant systems rate category 8 `N/A`; it drops
     out of the roll-up.
3. **Roll up deterministically** — the overall rating is computed, not vibed:
   - `overall = min( median(all rated categories), one step above the lowest critical-category rating )`
   - Consequences: any critical category **Missing** caps overall at **Weak**;
     any critical **Weak** caps overall at **Moderate**. Non-critical
     categories move the median but can never lift the cap.
4. **Recommend** — max 3 next steps, ordered by which would raise the overall
   rating (i.e. fix the lowest critical category first).

## Output format

1. **Scope block** — module/paths + entry-point list, so the scorecard is
   re-runnable.
2. **Scorecard table** — one row per category:
   `Category | Rating | Evidence (file:line or named empty searches) | Gap`.
   Every row MUST carry evidence; a rating without a citation is invalid.
3. **Overall rating** — with the roll-up shown (`median=…, lowest critical=…,
   cap=… → overall=…`), never a bare verdict.
4. **Top-3 next steps** — ordered by roll-up impact.

## Gotcha

- The model tends to rate from vibes ("looks well-structured") — a rating
  row without `file:line` or named empty searches is invalid; redo it.
- Don't let a Strong non-critical category mask a Weak critical one — the
  cap rule exists precisely because a polished logging setup does not offset
  missing authorization.
- A vulnerability found mid-assessment is **out of scope** for the scorecard
  — note it and route to [`security-audit`](../security-audit/SKILL.md)
  (with its false-positive gate) instead of inlining findings here.

## Do NOT

- Do NOT emit a rating without evidence — every row cites `file:line` or the
  empty searches that prove absence.
- Do NOT average away critical categories — the deterministic cap always wins.
- Do NOT turn the scorecard into a finding list — posture assessment and
  vulnerability hunting are different deliverables.
- Do NOT assess unscoped ("the whole app") when the user named a module.

## See also

- [`security-audit`](../security-audit/SKILL.md) — vulnerability hunting with the false-positive gate.
- [`defense-in-depth`](../defense-in-depth/SKILL.md) — layering controls the scorecard checks for.
- [`ai-code-blindspots`](../ai-code-blindspots/SKILL.md) — the per-surface invisible-controls checklist.
