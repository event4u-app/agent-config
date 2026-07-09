---
model_tier: medium
name: ai-code-blindspots
description: "Before finishing any code (endpoint, query, migration, render, file, infra, dependency, test) — the senior pre-ship checklist of invisible cross-cutting controls AI omits, with backstop greps"
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# ai-code-blindspots

AI writes the code the prompt literally asked for and stops. The controls a senior adds from unstated context — authorization, tenant scope, validation, transactions, encryption, rate limiting, output encoding, error handling, edge cases, package existence — are *invisible* to a single-file prompt, so they're the first thing dropped. They're also the classes pattern-linters miss. This skill is the pre-ship checklist: for the surface you wrote, assert the matching control is present, run the backstop grep, route to the deep skill when it needs more than a check.

A **routing + verification** layer — doesn't re-teach what the deep skills own. The "did I supply the invisible controls?" gate `senior-engineering-discipline` points at.

## When to use

- You wrote (or are finishing) an endpoint, query, migration, UI render, file/network op, infra resource, dependency change, or test — before calling it done.
- Reviewing an AI-authored diff, asking "what did it silently omit?".
- The `senior-engineering-discipline` rule fired and routed here.

Do NOT use when: change is prose/docs/config-only, or a one-line rename — no code surface to check.

## The Iron Law

```
FOR EVERY SURFACE YOU TOUCHED, NAME THE INVISIBLE CONTROL AND CONFIRM IT IS PRESENT.
"NOT MENTIONED IN THE PROMPT" IS EXACTLY WHY IT IS MISSING — CHECK IT ANYWAY.
A CONTROL DEFINED BUT NOT WIRED IS ABSENT. A grep IS CHEAPER THAN A BREACH.
```

## Procedure

1. List the surfaces this change touched (endpoint, query, migration, render, file/fetch, infra, dependency, test).
2. For each surface, take its row below: assert every listed invisible control is present (with file:line), and run the matching backstop grep.
3. For anything a grep flags or a check can't confirm, open the routed deep skill.
4. Emit the per-surface confirmation (Output format); surface any unresolved gap to the user — never silently omit.

## Surface → invisible controls → backstop

Run the row(s) for what you touched. The grep is a fast authoring-time backstop (not a substitute for reading the code); zero results = pass, a hit = look.

| Surface you wrote | Invisible controls to assert | Deep skill |
|---|---|---|
| **HTTP endpoint / route** | authorization (this principal may act on this resource — not just authenticated); tenant scope; **the three negative tests** (unauth→401, non-owner→403/404, cross-tenant→403); boundary input validation; rate limit actually wired; state-changing → CSRF + audit | `broken-access-control`, `authz-review`, `threat-modeling` |
| **DB query / ORM** | parameterized, never string-built; tenant predicate present; no `SELECT *` across a serialization boundary; N+1 avoided (eager load) | `source-discovery`, `security` |
| **Migration** | reversible (`down`); expand-contract for drop/rename (never a bare `DROP COLUMN` before code stops reading it); transaction; index on new FK/filter column | `engineering-safety-floor`, `migration-architect` |
| **User-controlled render (FE)** | output-encoded; no `dangerouslySetInnerHTML`/`v-html`/`innerHTML`/`eval` on non-constant input; no secret/token in client code; token not in `localStorage` | `frontend-render-security` |
| **File / outbound fetch** | path confined to an allowed base; SSRF allow-list + private-IP block on user-supplied URLs; size limit; server-side validation (never client-only) | `security`, `defense-in-depth` |
| **Infra / IaC** | least-privilege (no `Action:*`/`Resource:*`); encryption at rest; no `0.0.0.0/0` to mgmt/DB ports; no hardcoded creds; scanner-verified, not `plan`-verified | `engineering-safety-floor`, `terraform`, `secrets-management` |
| **New dependency** | exists on the real registry (not hallucinated); not typo-adjacent to a popular one; pinned + lockfile committed; CVE-scanned | `supply-chain-intake`, `dependency-upgrade` |
| **Secrets/credentials** | never a literal in source; env / secret-manager reference; password columns use bcrypt/argon2, never MD5/SHA | `secrets-management`, `domain-safety-pii` |
| **Test** | asserts general behavior; expected derived from inputs/seeded data, not hardcoded; boundary + error + abuse cases, not only happy path | `testing-anti-patterns`, `test-driven-development` |

### Backstop greps (authoring-time, cross-stack)

```bash
# Frontend insecure render / client secrets (React + Vue + vanilla)
rg -n 'dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|\beval\(|new Function\(' src/
rg -n 'NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)|VITE_.*(SECRET|KEY)|localStorage\.setItem\([^)]*[Tt]oken' src/
# String-built SQL (concatenation / interpolation into a query)
rg -n 'query\(.*(\+|\$\{|`).*\)|(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{)' src/
# Hardcoded secrets / weak hashing
rg -n 'AKIA[0-9A-Z]{16}|sk_live_|AIza[0-9A-Za-z_\-]{35}|password\s*=\s*["\x27]|md5\(|sha1\(' .
# Infra: wildcard IAM / open ingress / disabled TLS
rg -n '"Action"\s*:\s*"\*"|"Resource"\s*:\s*"\*"|0\.0\.0\.0/0|InsecureSkipVerify|verify=false|curl.*\| *bash' .
```

The greps name several ecosystems side by side on purpose: keep the ones for the stack in front of you; a hit means read that line, not auto-fix.

## Output format

1. A one-line per-surface confirmation for the change, e.g. `endpoint: authz ✓ tenant-scope ✓ rate-limit wired ✓ validation ✓`, naming file:line where each control lives (or `n/a — <reason>`).
2. The backstop grep(s) run for the touched surface(s), with result (zero hits, or the hit + how resolved).
3. For any control genuinely out of scope, an explicit note saying so — never a silent omission.

## Gotcha

- **Defined-but-not-wired** is the signature AI failure: rate-limit middleware or CSRF guard is *written* but never attached to the route. Check is "wired on THIS path?", not "exists somewhere?".
- **Semantically-valid-but-ignored**: an IaC attribute the provider silently ignores (a made-up `encrypted = true` on a resource that doesn't support it) *reads* as a present control but does nothing — a scanner catches it, a code read doesn't.
- A green grep is necessary, not sufficient — proves the obvious anti-pattern absent, not that the control is correct. Read the seam for anything security-sensitive.
- Routes; doesn't replace the deep skill. For auth/billing/tenant/secret paths, `security-sensitive-stop` still requires a threat pass *before* editing.

## Do NOT

- Do NOT treat "the prompt didn't ask for it" as a reason to omit a control — that's the exact blind spot.
- Do NOT mark a change done on a green happy-path test alone.
- Do NOT auto-rewrite a grep hit without reading it — some are intentional and belong in an allow-list with a reason.
- Do NOT duplicate the deep skills here — route to them.

## Auto-trigger keywords

- invisible controls
- ai code blindspots
- pre-ship checklist
- what did the AI omit
- cross-cutting controls

## See also

- [`senior-engineering-discipline`](../../rules/senior-engineering-discipline.md) — the anchor rule that routes here.
- [`frontend-render-security`](../frontend-render-security/SKILL.md), [`supply-chain-intake`](../supply-chain-intake/SKILL.md), [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md).
- [`authz-review`](../authz-review/SKILL.md), [`threat-modeling`](../threat-modeling/SKILL.md), [`defense-in-depth`](../defense-in-depth/SKILL.md), [`source-discovery`](../source-discovery/SKILL.md), [`secrets-management`](../secrets-management/SKILL.md).
