---
name: project-analysis-node-express
description: "Use for deep Node.js / Express project analysis: boot flow, middleware order, async behavior, data layer, auth/security, and Node-specific runtime failure patterns."
source: package
---

# project-analysis-node-express

## When to use

Use this skill when:

* The project uses Node.js with Express or a similar middleware-based HTTP stack
* A deep framework/runtime analysis is needed
* `universal-project-analysis` routes here after framework detection
* The issue spans middleware, async behavior, data access, or runtime/process handling

Do NOT use when:

* The task is a small isolated change
* The project is not Node/Express-like
* The issue is already isolated to another specialist skill

## Core principles

* Middleware order changes behavior
* Async mistakes often look like business logic bugs
* Process/runtime state matters in Node
* Package/version mismatches are common in JS ecosystems
* Event loop and connection management must be treated as first-class concerns

## Procedure

### 1. Confirm runtime and framework shape

Check: `package.json`, lock file, Node version requirements, entrypoint files, Express or similar framework usage, TS/JS setup, env/config loading.
Validate: Node/runtime version is explicit, major packages are identified, app entrypoint and boot path are known.

### 2. Analyze app boot and middleware registration

Inspect: server bootstrap, env/config loading, `app.use()` order, route registration, error middleware, DB connection startup, graceful shutdown handling.

Check:

* middleware order correctness
* error middleware shape (must have 4 params)
* CORS/body parsing/auth order
* startup/shutdown safety

### 3. Trace request-to-response flow

Trace: route → middleware chain → controller/handler → service layer → ORM/query layer → response handling.
Validate: request lifecycle is explicit, input validation/auth/error handling are visible, "headers already sent" or double-response risks are identified.

### 4. Analyze async/runtime behavior

Inspect: async middleware, `await` usage, promise handling, background jobs/workers, stream usage, event listeners, shared module state.

Check:

* missing awaits
* unhandled rejections
* race conditions
* event-loop blocking
* memory leaks
* circular dependency symptoms

### 5. Analyze data and security flow

Inspect: ORM/query layer, transactions, auth/token/session logic, rate limiting, input sanitization, raw SQL usage.

Check:

* pool exhaustion
* migration/schema drift
* JWT/session risks
* string interpolation risks
* trust boundary mistakes

### 6. Validate Node/Express analysis quality

Check:

* runtime version and package versions are explicit
* middleware order is mapped
* async and process-level behavior are analyzed
* auth/data/runtime risks are evidence-based
* next specialist skill is clear if needed

## Output format

1. Runtime/framework summary
2. Boot/middleware findings
3. Request/async flow findings
4. Data/security findings
5. Runtime/process risks
6. Key risks and next steps

## Gotcha

* In Node/Express systems, process/runtime behavior often explains bugs more than route code does.
* Middleware order and async mistakes can silently corrupt behavior without obvious stack traces.
* Shared module state and package hoisting/version mismatches create hidden cross-request problems.

## Do NOT

* Do NOT ignore middleware order
* Do NOT assume async code is correct just because no exception is thrown
* Do NOT ignore process-level behavior, shutdown, or shared module state
* Do NOT treat package/tutorial examples as version-safe without checking installed versions
* Do NOT stop at route handlers if the failure pattern points to runtime or middleware behavior
