---
recommended_model: sonnet
name: error-handling-patterns
description: "Use when picking a failure-reporting strategy — exceptions vs Result types, recoverable vs not, retry / circuit-breaker / graceful degradation — decision framework only, catalogues externalized."
domain: engineering
status: active
refresh_trigger: "≥30% of cited upstream pattern catalogues become deprecated, OR a new top-2 ecosystem (Python/JS/PHP/Go/Rust) ships a paradigm-shifting standard error model"
sunset_criterion: "When the upstream framework docs (Laravel, FastAPI, Express, Axum, Effect-TS) all carry an equivalent in-tree decision framework AND consumer projects no longer cite this skill in PR reviews for two consecutive review cycles."
workspaces:
  - engineering
packs:
  - engineering-base
---

# error-handling-patterns

Decision framework for picking an error-handling strategy. **Catalogues of language-specific code live upstream** (links in § Provenance) — this skill is the predicate, not the pattern library. Sunset-policy compliant: large language-specific catalogues stay in authoritative upstream docs.

## When to use

- Designing how a new feature, API, or service reports failure.
- Reviewing a diff that introduces a new exception class, `Result<T, E>`, or sentinel return.
- Debugging production noise that traces back to inconsistent error semantics.
- Choosing between retry, circuit-breaker, fallback, and fail-fast for an external dependency.

Do NOT use when:

- You only need the syntax for a `try/catch` in language X — read the upstream language guide directly.
- The failure is a single-call Laravel validation error — route to [`laravel-validation`](../laravel-validation/SKILL.md).
- The fix is a one-line null check in existing code — route to [`bug-analyzer`](../bug-analyzer/SKILL.md).

## Decision framework

### Step 1 — Classify the failure

```
Failure is:
  caller's fault (bad input, missing auth)         → reject at boundary, structured error
  expected operational (timeout, 404, rate-limit)  → Result-type / typed return; retry-aware
  unexpected operational (DB down, OOM, deadlock)  → exception; observability + alert
  programmer bug (null deref, off-by-one)          → crash early; do not catch
```

### Step 2 — Pick the reporting mechanism

```
IF failure is an EXPECTED, branchable outcome the caller will route on
  → Result type / tagged union / typed error return.
  Forces the caller to handle it; the type system is the proof.

IF failure is UNEXPECTED and most callers cannot do anything useful
  → exception, propagated to a single boundary handler.
  One layer (HTTP, queue, CLI) translates exceptions to user-facing errors.

IF failure is UNRECOVERABLE (invariant violated, data corruption)
  → fail loud, fail fast. No catch-and-continue.
  Log structured context, exit / panic / 500.

IF the language idiom forces one choice (Go: errors are values; Rust: Result;
   Python/PHP/JS: exceptions)
  → follow the idiom. Inventing a foreign mechanism is more cost than the
    correctness it buys.
```

### Step 3 — Pick the resilience strategy

```
External call?
  Idempotent + transient failure mode  → retry with exponential backoff + jitter, cap.
  Non-idempotent                       → no blind retry; require an idempotency key.
  Repeated failure across instances    → circuit breaker; open → half-open probe → close.
  Optional functionality               → graceful degradation (cached / default / null result).
  Required functionality               → propagate; surface to user with a recovery hint.
```

### Step 4 — Shape the error payload

Every produced error must carry: `code` (stable string), `message` (human-readable), `cause` (chained), `context` (sanitized inputs), `correlation_id` (request / trace).

Forbidden: secrets, raw SQL, full stack traces in user-facing surfaces, internal class names leaked through API boundaries.

### Step 5 — Define the boundary

Exactly **one** layer translates internal errors to the egress format (HTTP status + body, queue requeue policy, CLI exit code). Anywhere else doing this duplication is the bug.

## Procedure: Apply the framework to a new feature

1. **Inspect** the feature surface — identify every failure mode (each external call, each invariant, each user input class) and write it down.
2. Run Step 1 of the decision framework against each entry; write the classification next to it.
3. Pick reporting mechanism per Step 2; reject combinations the language idiom rejects.
4. For each external call, run Step 3 and write down the chosen resilience strategy.
5. Sketch the error payload shape (Step 4) and the single boundary (Step 5).
6. Hand the sketch to a reviewer **before** coding; cite this skill.

## Output format

1. The failure-mode table (mode · classification · mechanism · resilience strategy).
2. The shared error payload definition (code, message, cause, context, correlation_id).
3. The single boundary handler (file:line) where internal → egress translation happens.
4. The retry / circuit-breaker config (attempts, base, jitter, breaker thresholds), if any.

## Gotcha

- "Catch everything, log it, return null" silently destroys signal — every catch must either rethrow, translate, or recover with a written reason.
- Retries on non-idempotent calls are the second-most-common production incident; insist on idempotency keys before allowing retry.
- Circuit breakers without a half-open probe never close — they degrade to permanent failure.
- Mixing Result types and exceptions in the same module is worse than picking the wrong one — pick one per module and stay in it.
- Upstream pattern catalogues drift; trust the link, not memory. Refresh per `refresh_trigger` above.

## Do NOT

- Do NOT introduce a custom error mechanism that fights the language idiom.
- Do NOT swallow exceptions — every catch has a written purpose.
- Do NOT leak stack traces, secrets, or internal class names across the boundary.
- Do NOT retry without backoff + jitter + cap.
- Do NOT inline language-specific code catalogues into this skill — externalize per Sunset Policy.

## Auto-trigger keywords

- error handling strategy
- exceptions vs result
- retry pattern
- circuit breaker
- graceful degradation
- error payload shape

## Provenance

- Adopted from: `Microck/ordinary-claude-skills@8f5c83174f7aa683b4ddc7433150471983b93131:skills_all/error-handling-patterns/SKILL.md` (MIT, © 2025 Microck) — **Sunset Policy applied**: 636-line source reduced to a ~150-line decision framework; language catalogues externalized to the upstream resources below.
- Externalized catalogues:
  - Python: https://docs.python.org/3/tutorial/errors.html · https://docs.python.org/3/library/exceptions.html
  - PHP / Laravel: https://laravel.com/docs/errors · https://www.php.net/manual/en/language.exceptions.php
  - JS / TS: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling · https://www.typescriptlang.org/docs/handbook/2/narrowing.html
  - Go: https://go.dev/blog/error-handling-and-go · https://pkg.go.dev/errors
  - Rust: https://doc.rust-lang.org/book/ch09-00-error-handling.html
  - Resilience patterns: https://martinfowler.com/bliki/CircuitBreaker.html · https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Cross-linked: [`defense-in-depth`](../defense-in-depth/SKILL.md), [`laravel-validation`](../laravel-validation/SKILL.md), [`bug-analyzer`](../bug-analyzer/SKILL.md), [`api-design`](../api-design/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `error-handling-patterns`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`, `non-destructive-by-default`.
