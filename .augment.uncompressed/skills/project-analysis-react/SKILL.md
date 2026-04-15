---
name: project-analysis-react
description: "Use for deep React analysis: component tree, state flow, props flow, hooks usage, rendering behavior, and React-specific failure patterns."
source: package
---

# project-analysis-react

## When to use

Use this skill when:

* The project uses React
* UI behavior is unclear or incorrect
* There are rendering issues, state bugs, or performance problems
* The issue spans multiple components or hooks
* `universal-project-analysis` routes here after detecting React

Do NOT use when:

* The task is a simple UI change
* The issue is isolated to a single component and obvious
* The project is not React-based

## Core principles

* Rendering is derived from state — not imperative logic
* State updates are async and batched
* Hooks define lifecycle, not classes
* Re-renders are the default, not the exception
* Props flow down, events flow up
* Memoization is a tool, not a default

## Procedure

### 1. Identify React setup

Check: React version, framework wrapper (Next.js, Vite, CRA, etc.), TypeScript or JavaScript, routing setup, state libraries (Redux, Zustand, Context).
Validate: React version is explicit, rendering environment is known (client-only vs SSR-capable).

### 2. Map component tree

Identify: root components, layout structure, nesting hierarchy, shared components, repeated patterns.
Check: deep nesting, prop drilling, duplicated logic across components.

### 3. Trace state flow

Identify: where state is defined, where it is updated, how it flows across components, what triggers updates.

Check:

* local vs global state boundaries
* unnecessary global state
* duplicated or conflicting state
* stale closures

### 4. Analyze hooks usage

Inspect: `useState`, `useEffect`, `useMemo`, `useCallback`, custom hooks, dependency arrays, side effects.

Check:

* missing dependencies
* infinite loops
* stale values
* unnecessary memoization
* side effects in render

### 5. Analyze rendering behavior

Check: what triggers re-renders, how often components re-render, conditional rendering logic, list rendering and keys.
Validate: unnecessary re-renders, missing keys, expensive renders, incorrect conditional branches.

### 6. Analyze async behavior

Inspect: data fetching, loading states, race conditions, effect cleanup.
Check: outdated responses overwriting newer state, missing cancellation logic, inconsistent loading/error handling.

### 7. Detect common React anti-patterns

* derived state stored unnecessarily
* business logic inside components
* deeply nested state objects
* large components with mixed responsibilities
* uncontrolled side effects

### 8. Validate React analysis quality

Check:

* component tree is clearly understood
* state flow is explicit
* hooks behavior is verified
* render triggers are identified
* async flow is explained

## Output format

1. React setup summary
2. Component tree overview
3. State flow analysis
4. Hooks and lifecycle findings
5. Rendering behavior findings
6. Async/data flow issues
7. Key risks and fixes

## Gotcha

* React bugs often come from stale state, not broken logic.
* Missing dependencies in hooks are one of the most common root causes.
* Overusing memoization can make code harder to reason about without solving real problems.

## Do NOT

* Do NOT treat React as imperative UI code
* Do NOT ignore dependency arrays
* Do NOT assume state updates are synchronous
* Do NOT ignore re-render behavior
* Do NOT optimize before understanding render flow
