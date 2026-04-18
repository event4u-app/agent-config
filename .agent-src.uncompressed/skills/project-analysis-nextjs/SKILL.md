---
name: project-analysis-nextjs
description: "Use for deep Next.js analysis: server vs client boundaries, routing, data fetching, caching, rendering modes, and hydration/runtime issues."
source: package
---

# project-analysis-nextjs

## When to use

Use this skill when:

* The project uses Next.js
* There are SSR, SSG, ISR, or hydration issues
* Data fetching or caching behavior is unclear
* Client vs server behavior is inconsistent
* `universal-project-analysis` routes here after detecting Next.js

Do NOT use when:

* The task is a simple UI change
* The issue is purely React-local and not Next-specific
* The project is not Next.js

## Core principles

* Server and client are different execution environments
* Rendering mode determines behavior
* Data fetching defines lifecycle
* Caching changes reality
* Hydration must match server output
* Edge and Node runtimes behave differently

## Procedure

### 1. Identify Next.js setup

Check: Next.js version, App Router vs Pages Router, deployment target (Node vs Edge), TypeScript or JavaScript, config files.
Validate: routing system is clear, runtime environment is known.

### 2. Determine rendering model

Identify: SSR, SSG, ISR, client-side rendering.
Check: which pages/components use which mode, unexpected rendering mode switches, static vs dynamic boundaries.

### 3. Analyze server vs client boundaries

Inspect: server components, client components (`"use client"`), shared components.

Check:

* server-only code in client components
* client-only logic in server components
* unexpected serialization issues

### 4. Trace data fetching

Inspect: `fetch`, `getServerSideProps`/`getStaticProps` (Pages Router), server actions, API routes.

Check:

* where data is fetched
* duplication of requests
* incorrect caching
* missing revalidation

### 5. Analyze caching behavior

Check: fetch caching options, revalidation settings, route segment config, browser vs server cache differences.
Validate: stale data issues, unexpected cache hits, missing invalidation logic.

### 6. Analyze routing and navigation

Inspect: route structure, dynamic routes, layouts, navigation patterns.
Check: incorrect routing assumptions, layout reuse issues, navigation inconsistencies.

### 7. Detect hydration and runtime issues

Check: server vs client output mismatch, conditional rendering differences, browser-only APIs used on server, timezone/randomness differences.
Validate: hydration warnings, inconsistent UI between server and client.

### 8. Detect common Next.js anti-patterns

* mixing server and client concerns incorrectly
* overusing client components
* fetching data in the wrong layer
* ignoring caching behavior
* duplicating fetch logic across layers

### 9. Validate Next.js analysis quality

Check:

* rendering mode is explicit
* server/client boundary is clear
* data fetching flow is mapped
* caching behavior is understood
* hydration issues are explained

## Output format

1. Next.js setup summary
2. Rendering model overview
3. Server vs client boundary analysis
4. Data fetching findings
5. Caching behavior findings
6. Routing findings
7. Hydration/runtime issues
8. Key risks and fixes

## Gotcha

* Many bugs come from misunderstanding server vs client boundaries.
* Caching can make correct code appear broken.
* Hydration errors often indicate mismatched assumptions, not simple bugs.

## Do NOT

* Do NOT assume everything runs on the client
* Do NOT ignore caching behavior
* Do NOT mix server and client logic blindly
* Do NOT debug hydration issues without checking rendering differences
* Do NOT treat Next.js as "just React"
