# Transcript — slot 10: ss-name-retry-fn

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

What's a good name for a function that retries a job with exponential backoff and a max-attempts cap?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a naming task with no ambiguity about requirements—exponential backoff + max attempts is fully specified. The reasoning protocol would be overkill here; I'll just apply judgment.

Key constraints:
- Must signal **retry** (the core action)
- Must signal **exponential backoff** (the strategy)
- Must signal **max-attempts** (the boundary condition)
- Should be readable in a call site and a job queue context

Common patterns in the wild:
- `retry_with_exponential_backoff()` — explicit but verbose
- `retry_exponential()` — concise, assumes "with max attempts"
- `retry()` with a strategy enum/class — clean if you have multiple strategies
- `execute_with_retries()` — job-agnostic, hides the backoff detail

## Answer

**Recommendation: `retry_with_exponential_backoff()`**

It's explicit, immediately readable, and the max-attempts cap is a natural parameter (not part of the name—that goes in the signature). This avoids ambiguity when someone reads the call six months later.

If you're in a context where you already have a retry abstraction and need to pick between strategies, a shorter name like `retry_exponential()` works if it's paired with clear documentation or type hints showing the max-attempts parameter.

Avoid burying the backoff strategy under a generic `retry()` unless you have a strategy object or enum doing the real work—that defers understanding to the parameter inspection.
~~~

**Tokens:** in 673 / out 348 / est $0.007239 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean notes→answer separation; grounded constraints; no premature code; coherent standalone recommendation."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a naming task, not a design task. The function's contract is clear: retry logic with exponential backoff and a max-attempts limit. No ambiguity about what it does. No need for the full reasoning protocol—this is a "list files" tier question.

What matters: clarity, convention, and domain fit.

**Candidate patterns:**
- `retryWithExponentialBackoff` — explicit, clear, common Java/TypeScript style
- `retryExponential` — shorter, assumes "backoff" is understood in retry context
- `executeWithRetry` — verb-first, clear intent, generic enough to compose
- `retryWithBackoff` — assumes exponential is the default strategy

**Convention check:** Most libraries (bulleted retry, axios, etc.) use verb-first patterns. Exponential backoff is the standard, so naming it explicitly is good when there are alternatives (linear, fibonacci, etc.).

## Answer

**`retryWithExponentialBackoff`**

Reasons:
- **Clarity:** The name fully specifies the strategy (exponential, not linear or fixed), making callsites self-documenting.
- **Convention:** Matches patterns in established libraries (retry, axios, node-retry).
- **Reduces surprise:** Callers see "exponential" and know to expect delay multipliers, not guessing at behavior.

If you need shorter and exponential backoff is your only retry strategy, **`retryWithBackoff`** is fine. If you're wrapping the function and need verb-first (e.g., in an executor pattern), **`executeWithRetry`** works.
~~~

**Tokens:** in 827 / out 374 / est $0.008091 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Clean notes-first. Naming task grounded correctly (no phantom constraints). No premature code. Answer clear+complete."}

**Output-token overhead (orchestrated vs distributed):** +7.5%
