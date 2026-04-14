---
name: react
description: "Use when writing React components — TypeScript, hooks, clean state management, and modern patterns."
source: package
---

# react

## When to use

React components (`.tsx`/`.jsx`), hooks, state management, API integration with PHP backend.

## Before: detect React version, build tool (Vite/Webpack/Next), TS vs JS, existing component style, state management, styling approach, project docs.

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

**Components:** functional + hooks only, named exports, one per file. **TypeScript:** `{Component}Props` interface, `useState<Type>()`, no `any`. **Hooks:** `useState` (local), `useEffect` (side effects + deps), `useMemo`/`useCallback` (expensive), custom hooks (`use{Feature}.ts`). **State:** local → Context (subtree) → Redux/Zustand (global). Keep close to usage. **Props:** down + callbacks up, destructure, defaults, `children`. **API:** centralized layer, handle loading/error/empty, React Query/SWR if available.

## JSX: self-closing tags, fragments, conditional rendering, `key` on lists.

## Styling: match project approach, `className`, don't introduce new approach.

## Composition: compound components (shared context), render props, custom hooks (`useDebounce`, etc.), error boundaries.

## Performance (by priority)

**CRITICAL — waterfalls:** `Promise.all()` for independent ops, `<Suspense>` boundaries, start promises early.
**CRITICAL — bundle:** import directly (no barrel files), `React.lazy()`/`next/dynamic`, defer third-party scripts.
**HIGH — server (RSC):** `React.cache()`, minimize client serialization, parallel fetching.
**MEDIUM — re-renders:** refs for callback-only state, `useMemo`/`useCallback`, primitive deps, `startTransition`, profile first.
**LOW — micro:** Map/Set for lookups, single-pass filter+map.

## React 19: `useActionState` (forms), `useOptimistic` (instant feedback), `use()` (promises in render). Compiler auto-memoizes — focus on pure components.

## State: `useState`/`useReducer` (simple) → Context (subtree) → React Query/SWR (server) → Zustand/Redux (complex global).

## Gotcha: no `useEffect` for data fetching in 18+ (use Suspense), don't over-state in one component, stable unique `key` (no array index on reorderable).

## Do NOT: class components, mutate state directly, skip useEffect deps, `any` types, mix styling, nested trees, `useEffect` for derived state.
