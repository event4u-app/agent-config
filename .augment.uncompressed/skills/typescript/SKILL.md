---
name: typescript
description: "Use when writing TypeScript — strict typing, proper interfaces, generics, and modern patterns for frontend and Node.js projects."
source: package
---

# typescript

## When to use

Use this skill when:
- Writing `.ts` or `.tsx` files
- Adding types to JavaScript code
- Working with TypeScript configuration
- Defining interfaces, types, generics, or utility types

## Before writing code

1. **Check `tsconfig.json`** — understand `strict`, `target`, `module`, `paths`, and other settings.
2. **Check existing types** — look for `types/`, `@types/`, or `*.d.ts` files.
3. **Match existing patterns** — use `interface` vs `type` consistently with the project.
4. **Check strictness** — is `strict: true` enabled? Are there custom rules?

## Core rules

### Type annotations

- **Always type function parameters and return values.**
- **Type variables** when the type isn't obvious from the assignment.
- Use `const` assertions for literal types: `as const`.
- Prefer `unknown` over `any` — narrow with type guards.

### Interfaces vs Types

- Use `interface` for object shapes that may be extended.
- Use `type` for unions, intersections, mapped types, and utility types.
- Be consistent with the project's convention.

```typescript
// Interface — extendable object shape
interface User {
  id: number
  name: string
  email: string
}

// Type — union, utility, or complex type
type Status = 'active' | 'inactive' | 'pending'
type UserWithRole = User & { role: string }
type Nullable<T> = T | null
```

### Generics

- Use generics for reusable, type-safe functions and classes.
- Name generic parameters descriptively: `T`, `TItem`, `TResponse`.

```typescript
function findById<T extends { id: number }>(items: T[], id: number): T | undefined {
  return items.find(item => item.id === id)
}
```

### Null handling

- Use strict null checks (`strictNullChecks: true`).
- Use optional chaining: `user?.address?.city`.
- Use nullish coalescing: `value ?? defaultValue`.
- Avoid non-null assertions (`!`) — prefer type guards or explicit checks.

### Enums vs Union types

- Prefer **string union types** over enums for simple cases: `type Color = 'red' | 'blue'`.
- Use `const enum` or regular `enum` only when the project already uses them.

### Async code

- Use `async/await` over raw Promises.
- Type async functions: `async function fetch(): Promise<User[]>`.
- Handle errors with try/catch and typed error handling.

### Module patterns

- Use ES module syntax: `import` / `export`.
- Use named exports (unless the project convention is default exports).
- Use barrel files (`index.ts`) sparingly — they can cause circular dependencies.

### Utility types

Use built-in utility types:

| Type | Purpose |
|---|---|
| `Partial<T>` | All properties optional |
| `Required<T>` | All properties required |
| `Pick<T, K>` | Select specific properties |
| `Omit<T, K>` | Exclude specific properties |
| `Record<K, V>` | Object with typed keys and values |
| `Readonly<T>` | All properties readonly |

## Branded types for domain modeling

Prevent accidental mixing of primitive types that represent different domains:

```typescript
type Brand<K, T> = K & { __brand: T }
type UserId = Brand<string, 'UserId'>
type OrderId = Brand<string, 'OrderId'>

// Prevents: processOrder(userId, orderId) — compiler catches the swap
function processOrder(orderId: OrderId, userId: UserId) { }
```

Use for: critical domain primitives, API boundaries, currency/units, IDs.

## Type performance

When type checking is slow (10+ seconds):

```bash
# Diagnose
npx tsc --extendedDiagnostics --incremental false | grep -E "Check time|Files:|Lines:"

# Common fixes
# 1. Replace deep type intersections with interfaces (interfaces are cached)
# 2. Split large union types (>100 members)
# 3. Avoid circular generic constraints
# 4. Use type aliases to break recursion depth
```

Key `tsconfig.json` performance settings:

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true
  }
}
```

## Monorepo project references

For multi-package repos (Composer packages, npm packages):

```json
// Root tsconfig.json
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ui" }
  ]
}

// Package tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

- `composite: true` — enables project references and incremental builds.
- `declaration: true` — generates `.d.ts` files for cross-package type sharing.
- `declarationMap: true` — enables "Go to Definition" across packages.

## JS → TS migration strategy

For incremental migration of existing JavaScript projects:

1. **Enable `allowJs` + `checkJs`** in `tsconfig.json` — type-check JS files without renaming.
2. **Rename files gradually** — `.js` → `.ts`, `.jsx` → `.tsx`, one module at a time.
3. **Add types file by file** — start with shared types, then services, then components.
4. **Enable strict features one by one** — `strictNullChecks` first, then `noImplicitAny`, etc.

Priority order: shared types → API layer → services → components → tests.

## Configuration

Key `tsconfig.json` settings to check:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

## What NOT to do

- Do not use `any` — use `unknown` and narrow with type guards.
- Do not use non-null assertions (`!`) without a clear reason.
- Do not skip return types on public functions.
- Do not create overly complex generic types — keep them readable.
- Do not ignore TypeScript errors with `@ts-ignore` — fix the type issue.
- Do not mix `interface` and `type` inconsistently within the same project.


## Gotcha

- Don't use `any` — if the type is truly unknown, use `unknown` and narrow it.
- The model tends to use type assertions (`as Type`) instead of proper type narrowing — assertions hide bugs.
- `interface` for objects, `type` for unions/intersections/primitives — don't mix arbitrarily.

## Do NOT

- Do NOT use any — use unknown or proper types.
- Do NOT use type assertions (as) to silence errors — fix the types.
- Do NOT skip strict mode in tsconfig.json.

## Auto-trigger keywords

- TypeScript
- strict typing
- interfaces
- generics
- type definitions
