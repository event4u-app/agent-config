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

AI writes the code the prompt literally asked for and stops. The controls a senior adds from unstated context — authorization, tenant scope, validation, transactions, encryption, rate limiting, output encoding, error handling, edge cases, package existence — are *invisible* to a single-file prompt, so they are the first thing dropped. They are also the classes pattern-linters miss. This skill is the pre-ship checklist: for the surface you just wrote, assert the matching control is present, run the backstop grep, and route to the deep skill when it needs more than a check.

This is a **routing + verification** layer — it does not re-teach what the deep skills own. It is the "did I supply the invisible controls?" gate that `senior-engineering-discipline` points at.

## When to use

- You have written (or are about to finish) an endpoint, query, migration, UI render, file/network op, infra resource, dependency change, or test — before you call it done.
- Reviewing an AI-authored diff and asking "what did it silently omit?".
- The `senior-engineering-discipline` rule fired and routed you here.

Do NOT use when: the change is prose/docs/config-only, or a one-line rename — there is no code surface to check.

## The Iron Law

```
FOR EVERY SURFACE YOU TOUCHED, NAME THE INVISIBLE CONTROL AND CONFIRM IT IS PRESENT.
"NOT MENTIONED IN THE PROMPT" IS EXACTLY WHY IT IS MISSING — CHECK IT ANYWAY.
A CONTROL DEFINED BUT NOT WIRED IS ABSENT. A grep IS CHEAPER THAN A BREACH.
```

## Procedure

1. **Inspect** the change and list the surfaces it touched (endpoint, query, migration, render, file/fetch, infra, dependency, test) — analyze what you actually wrote before checking it.
2. For each surface, take its row below: assert every listed invisible control is present (with file:line), and run the matching backstop grep.
3. For anything a grep flags or a check can't confirm, open the routed deep skill.
4. Emit the per-surface confirmation (Output format); surface any unresolved gap to the user — never silently omit.

## Surface → invisible controls → backstop

Run the row(s) for what you touched. The grep is a fast authoring-time backstop (not a substitute for reading the code); zero results is the pass, a hit is a prompt to look.

| Surface you wrote | Invisible controls to assert | Deep skill |
|---|---|---|
| **HTTP endpoint / route** | authorization (this principal may act on this resource — not just authenticated); tenant scope; **the three negative tests** (unauth→401, non-owner→403/404, cross-tenant→403/404); input validation at the boundary; rate limit actually wired; state-changing → CSRF + audit log | `broken-access-control`, `authz-review`, `threat-modeling` |
| **DB query / ORM** | parameterized, never string-built; tenant predicate present; no `SELECT *` across a serialization boundary; N+1 avoided (eager load) | `source-discovery`, `security` |
| **Migration** | reversible (`down`); expand-contract for drop/rename (never a bare `DROP COLUMN` before code stops reading it); transaction; index on new FK/filter column | `engineering-safety-floor`, `migration-architect` |
| **User-controlled render (FE)** | output-encoded; no `dangerouslySetInnerHTML`/`v-html`/`innerHTML`/`eval` on non-constant input; no secret/token in client code; token not in `localStorage`. **This surface also carries the four completeness rows below — they are part of it, not an optional extra.** | `frontend-render-security` |
| **Third-party asset in shipped markup / CSS** | delivery is self-hosted through the project's own route (framework font/asset primitive, bundled package, or locally-served file) — a font/icon/stylesheet CDN link transmits the **visitor's IP** to that third party on every page view; a hotlink only on a stated consumer opt-in; `integrity` + `crossorigin` if a CDN link stays | `design-fidelity-mechanics` § Asset & imagery discipline (owner), `typography-system` |
| **File / outbound fetch** | path confined to an allowed base; SSRF allow-list + private-IP block on user-supplied URLs; size limit; **explicit timeout** (no unbounded/default-infinite wait); server-side validation (never client-only) | `security`, `defense-in-depth` |
| **Infra / IaC** | least-privilege (no `Action:*`/`Resource:*`); encryption at rest; no `0.0.0.0/0` to mgmt/DB ports; no hardcoded creds; scanner-verified, not `plan`-verified | `engineering-safety-floor`, `terraform`, `secrets-management` |
| **New dependency** | package exists on the real registry (not hallucinated); not typo-adjacent to a popular one; pinned + lockfile committed; CVE-scanned | `supply-chain-intake`, `dependency-upgrade` |
| **Secrets/credentials** | never a literal in source; env / secret-manager reference; password columns use bcrypt/argon2, never MD5/SHA; **agent/MCP config too** — no raw key in `.mcp.json` / agent-config / CI YAML / a committed `.env` (env-var indirection, gitignored) | `secrets-management`, `domain-safety-pii` |
| **Error path / timeout / retry** | failure handled, never silently swallowed (no empty `catch {}`); external call has a bounded timeout; retry is capped + backed-off + idempotent (no retry storm); the error surfaced to the caller carries no secret / stack / PII; a partial failure leaves consistent state (no half-written record) | `systematic-debugging`, `defense-in-depth` |
| **Concurrency / shared state** | check-then-act guarded (DB lock / atomic op / transaction — not a read-modify-write race); retried write carries an idempotency key; no unbounded parallel fan-out; shared mutable state synchronized | `source-discovery`, `security` |
| **Test** | asserts general behavior; expected derived from inputs/seeded data, not hardcoded; boundary + error + abuse cases, not only happy path | `testing-anti-patterns`, `test-driven-development` |

### Render surface — the completeness rows

Every row above is a **security** control. These four are the **completeness**
controls for the same surface — the states an agent most reliably omits, because
the prompt named the happy path and nothing else. A render that ships only the
populated state is not finished; it is one of four states written.

**The grep polarity is INVERTED here, and reading it the other way is the failure
mode this table has.** Above, zero hits is the pass. Below, **zero hits next to a
render that fetches or iterates is the prompt to look** — the state is probably
absent. A hit is not a pass either: the column is a `heuristic`, a locator for
code to read, never proof the state behaves. A framework abstraction can
implement all four correctly and match none of these patterns, and a codebase can
match all four while shipping a broken empty state.

| State | Assert on the render you wrote | Backstop grep (heuristic — zero hits is the prompt) |
|---|---|---|
| **Empty** | the zero-rows / no-results case renders a deliberate state, not a bare frame or a collapsed layout; it says what is missing and what the user can do next | `rg -n -e '\.length\s*[=<]' -e '\bisEmpty\b' -e 'count\(\)\s*[=<]' -e '\bempty\b'` — over the file that maps the collection |
| **Loading** | the pending case renders (skeleton, spinner, disabled control); no layout shift on arrival; the state is reachable from the actual async call, not only defined | `rg -n -e 'isLoading' -e 'isPending' -e 'isFetching' -e 'Skeleton' -e 'Spinner' -e 'aria-busy'` |
| **Error** | the failed case renders a recoverable state with a retry or a next step; the message carries no stack, secret or PII (the `frontend-render-security` row owns that half) | `rg -n -e 'isError' -e 'onError' -e 'ErrorBoundary' -e '\.catch\(' -e 'role="alert"'` |
| **Keyboard path** | every interactive element is reachable and operable by keyboard alone, with a visible focus ring; a click handler on a non-button element carries a role, `tabindex` and a key handler | `rg -n -e 'onClick' -e '@click' -e 'v-on:click'` lists the handlers, then `rg -n -e 'tabIndex' -e 'tabindex' -e 'onKeyDown' -e '@keydown' -e 'role='` on the same file — a handler with no match on the second is the prompt |

Route to `accessibility-auditor` for the keyboard row when the surface is more
than a handful of controls — this row asserts the path exists, it is not a WCAG
pass.

### Backstop greps (authoring-time, cross-stack)

```bash
# Frontend insecure render / client secrets (React + Vue + vanilla)
rg -n 'dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|\beval\(|new Function\('
rg -n 'NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)|VITE_.*(SECRET|KEY)|localStorage\.setItem\([^)]*[Tt]oken'
# String-built SQL (concatenation / interpolation into a query)
rg -n 'query\(.*(\+|\$\{|`).*\)|(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{)'
# Hardcoded secrets / weak hashing
rg -n 'AKIA[0-9A-Z]{16}|sk_live_|AIza[0-9A-Za-z_\-]{35}|password\s*=\s*["\x27]|md5\(|sha1\(' .
# Infra: wildcard IAM / open ingress / disabled TLS
rg -n '"Action"\s*:\s*"\*"|"Resource"\s*:\s*"\*"|0\.0\.0\.0/0|InsecureSkipVerify|verify=false|curl.*\| *bash' .
# Raw secret in an agent/MCP/CI config (should be an env-var reference, not a literal)
rg -n '(sk_live_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|AIza[0-9A-Za-z_\-]{35})' --glob '*.mcp.json' --glob '.mcp.json' --glob '*.env' --glob '**/agent*config*' --glob '.github/workflows/*'
# Swallowed error (empty catch) / unbounded external call (no timeout arg)
rg -n 'catch\s*\([^)]*\)\s*\{\s*\}|except[^:]*:\s*pass' .
```

Stack-specific patterns (the greps name several ecosystems side by side on purpose): keep the ones for the stack in front of you; a hit means read that line, not auto-fix.

## Output format

1. A one-line per-surface confirmation for the change, e.g. `endpoint: authz ✓ tenant-scope ✓ rate-limit wired ✓ validation ✓`, naming the file:line where each control lives (or `n/a — <reason>`).
2. The backstop grep(s) run for the touched surface(s), with their result (zero hits, or the hit + how it was resolved).
3. For any control that is genuinely out of scope, an explicit note saying so — never a silent omission.

## Gotcha

- **Defined-but-not-wired** is the signature AI failure: the rate-limit middleware or CSRF guard is *written* but never attached to the route. The check is "is it wired on THIS path?", not "does the code exist somewhere?".
- **Semantically-valid-but-ignored**: an IaC attribute that the provider silently ignores (a made-up `encrypted = true` on a resource that doesn't support it) *reads* as a present control but does nothing — a scanner catches it, a code read does not.
- A green grep is necessary, not sufficient — it proves the obvious anti-pattern is absent, not that the control is correct. Read the seam for anything security-sensitive.
- This checklist routes; it does not replace the deep skill. For an auth/billing/tenant/secret path, `security-sensitive-stop` still requires a threat pass *before* editing.
- **Run it per surface, not once at the end.** In a multi-file / agentic change the omission compounds — each new endpoint, query, or fetch is its own blind spot. Re-run the matching row when each surface lands, not as a single sweep after the whole feature is "done" (by then the missing control is buried under later diffs).

## Do NOT

- Do NOT treat "the prompt didn't ask for it" as a reason to omit a control — that is the exact blind spot.
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
