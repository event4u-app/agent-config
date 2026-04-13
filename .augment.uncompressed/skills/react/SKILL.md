---
name: react
description: "Use when writing React components — TypeScript, hooks, clean state management, and modern patterns."
---

# react

## When to use

Use this skill when:
- Creating or editing React components (`.tsx` / `.jsx` files)
- Building UIs with React hooks and functional components
- Working with state management (Redux, Zustand, Context)
- Integrating React with a PHP backend (API-driven or embedded)

## Before writing code

1. **Detect React version** — check `package.json` for `react` version.
2. **Detect build tool** — Vite, Webpack, Create React App, Next.js, or other.
3. **Check TypeScript** — is `typescript` in `package.json`? Are files `.tsx` or `.jsx`?
4. **Check existing components** — match the style (functional vs class, hooks vs HOCs).
5. **Check state management** — Redux, Zustand, Context, or local state only.
6. **Check styling** — Tailwind, CSS Modules, styled-components, SCSS, or plain CSS.
7. **Read project docs** — check `./agents/` and `package.json` scripts.

## Component structure (TypeScript + hooks)

```tsx
import { useState, useEffect, useMemo } from 'react'

interface UserCardProps {
  userId: number
  onUpdate: (user: User) => void
}

export function UserCard({ userId, onUpdate }: UserCardProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fullName = useMemo(
    () => (user ? `${user.firstName} ${user.lastName}` : ''),
    [user],
  )

  useEffect(() => {
    setIsLoading(true)
    fetchUser(userId)
      .then(setUser)
      .finally(() => setIsLoading(false))
  }, [userId])

  if (isLoading) return <div>Loading...</div>
  if (!user) return null

  return (
    <div>
      <h1>{fullName}</h1>
      <button onClick={() => onUpdate(user)}>Update</button>
    </div>
  )
}
```

## Core rules

### Components
- Use **functional components** with hooks — no class components for new code.
- Use `function` declarations or arrow functions consistently with the project.
- Export components as **named exports** (unless the project uses default exports).
- One component per file for significant components.

### TypeScript
- Define `interface` for props — name it `{Component}Props`.
- Type state with generics: `useState<Type>()`.
- Type event handlers: `React.ChangeEvent<HTMLInputElement>`, etc.
- Avoid `any` — use `unknown` if the type is truly unknown.

### Hooks
- `useState` for local component state.
- `useEffect` for side effects (API calls, subscriptions). Always specify dependencies.
- `useMemo` / `useCallback` for expensive computations or stable references.
- Extract reusable logic into **custom hooks** (`use{Feature}.ts`).
- Follow the Rules of Hooks — only call hooks at the top level.

### State management
- **Local state** (`useState`): for UI state that doesn't leave the component.
- **Context**: for shared state across a subtree (theme, auth, locale).
- **Redux / Zustand**: for complex global state (check what the project uses).
- Keep state as close to where it's used as possible.

### Props
- **Props down, callbacks up** — parent passes data and handlers.
- Use destructuring in function parameters.
- Provide default values where appropriate.
- Use `children` prop for composition, slots-like patterns.

### API integration
- Use a centralized API layer (check for `api/`, `services/`, hooks like `useApi`).
- Handle loading, error, and empty states.
- Use `async/await` in `useEffect` (with cleanup for cancelled requests).
- Consider React Query / SWR if the project uses them.

## JSX conventions

- Use self-closing tags for elements without children: `<Component />`.
- Use fragments `<>...</>` to avoid unnecessary wrapper divs.
- Use conditional rendering: `{condition && <Component />}` or ternary.
- Always provide `key` on list items.
- Keep JSX readable — extract complex sections into sub-components or variables.

## Styling

- Match the project's CSS approach (Tailwind, CSS Modules, styled-components, SCSS).
- Use `className` (not `class`).
- Do not introduce a new styling approach.

## Composition patterns

### Compound components

Group related components that share implicit state:

```tsx
// Usage: <Select><Select.Option value="a">A</Select.Option></Select>
function Select({ children, value, onChange }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div role="listbox">{children}</div>
    </SelectContext.Provider>
  )
}
Select.Option = SelectOption
```

### Render props / Children as function

When a component needs to share internal state with its children:

```tsx
<DataFetcher url="/api/users">
  {({ data, isLoading, error }) => (
    isLoading ? <Spinner /> : <UserList users={data} />
  )}
</DataFetcher>
```

### Custom hooks for shared logic

Extract reusable stateful logic into hooks:

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}
```

### Error boundaries

Wrap sections that might fail with error boundaries:

```tsx
<ErrorBoundary fallback={<ErrorMessage />}>
  <RiskyComponent />
</ErrorBoundary>
```

## Performance rules (by priority)

### CRITICAL: Eliminate waterfalls

- **Parallelize async work** — use `Promise.all()` for independent operations, never sequential `await`.
- **Move `await` into branches** — defer awaiting until the value is actually needed.
- **Use `<Suspense>` boundaries** — stream content progressively instead of blocking the whole page.
- **Start promises early, await late** — in API routes and server components.

### CRITICAL: Bundle size

- **Import directly** — avoid barrel files (`index.ts` re-exports). Import from the specific module.
- **Use `next/dynamic` or `React.lazy()`** — for heavy components not needed on initial render.
- **Defer third-party scripts** — load analytics, logging, chat widgets after hydration.
- **Conditional loading** — load modules only when a feature is activated.

### HIGH: Server-side (Next.js / RSC)

- **`React.cache()`** — deduplicate per-request data fetching in Server Components.
- **Minimize client serialization** — pass only the data the client component needs, not entire objects.
- **Parallel fetching** — restructure components so independent data fetches run in parallel.

### MEDIUM: Re-render optimization

- **Don't subscribe to state only used in callbacks** — extract into refs.
- **Use `useMemo`** for expensive computations, `useCallback` for stable function references.
- **Primitive dependencies** — use primitive values in effect/memo dependencies, not objects.
- **Functional `setState`** — `setCount(prev => prev + 1)` for stable callbacks.
- **`startTransition`** — for non-urgent updates (search, filtering).
- **Profile first** — use React DevTools before optimizing. Don't optimize prematurely.

### LOW: JavaScript micro-optimizations

- Build `Map`/`Set` for repeated lookups instead of `.find()` in loops.
- Combine multiple `.filter().map()` into a single loop.
- Check `.length` before expensive comparisons.
- Hoist `RegExp` creation outside loops.

## React 19 patterns

### New hooks

| Hook | Purpose | Use when |
|---|---|---|
| `useActionState` | Form submission state (pending, error, result) | Server Actions, form handling |
| `useOptimistic` | Optimistic UI updates | Instant feedback while server processes |
| `use()` | Read resources (promises, context) in render | Replacing `useEffect` for data fetching |

### Compiler benefits (React 19+)

- Automatic memoization — less manual `useMemo`/`useCallback` needed.
- Focus on writing **pure components** — the compiler handles optimization.
- Still use `useMemo`/`useCallback` for React 18 and below.

## State management selection

| Complexity | Solution | When |
|---|---|---|
| Simple | `useState`, `useReducer` | Single component state |
| Shared local | Context | Theme, auth, locale — small subtree |
| Server state | React Query, SWR | API data with caching, revalidation |
| Complex global | Zustand, Redux Toolkit | Cross-cutting app state |

### Placement rules

| Scope | Where |
|---|---|
| Single component | `useState` |
| Parent-child | Lift state up |
| Subtree | Context |
| App-wide | Global store |
| Server data | React Query / SWR |

## What NOT to do

- Do not use class components in projects that use functional components.
- Do not mutate state directly — use setter functions.
- Do not skip `useEffect` dependencies (ESLint warns about this).
- Do not put business logic in components — extract into hooks or services.
- Do not use `any` for TypeScript types.
- Do not mix styling approaches within the same project.
- Do not create deeply nested component trees — flatten with composition.
- Do not use `useEffect` for derived state — use `useMemo` instead.


## Gotcha

- Don't use `useEffect` for data fetching in new React 18+ code — use Suspense or server components.
- The model tends to put too much state in a single component — lift state only when necessary.
- `key` props must be stable and unique — don't use array index as key on reorderable lists.

## Do NOT

- Do NOT use class components in projects that use functional components.
- Do NOT mutate state directly — use setter functions.
- Do NOT skip useEffect dependencies.
- Do NOT use any for TypeScript types.

## Auto-trigger keywords

- React
- hooks
- useState
- useEffect
- component
- JSX
