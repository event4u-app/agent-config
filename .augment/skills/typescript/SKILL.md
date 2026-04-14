---
name: typescript
description: "Use when writing TypeScript — strict typing, proper interfaces, generics, and modern patterns for frontend and Node.js projects."
source: package
---

# typescript

## When to use

`.ts`/`.tsx` files, types, TypeScript config, interfaces/generics. Before: `tsconfig.json`, existing types, match patterns, check strictness.

## Core rules

**Types:** always type params + returns, `unknown` over `any`, `as const` for literals. **Interface** = extendable objects. **Type** = unions/intersections/mapped. Be consistent.

**Generics:** descriptive names (`TItem`, `TResponse`). **Null:** strict checks, optional chaining, nullish coalescing, avoid `!`. **Enums:** prefer string unions. **Async:** `async/await`, typed `Promise<T>`. **Modules:** named exports, barrel files sparingly.

**Utility types:** `Partial<T>`, `Required<T>`, `Pick<T,K>`, `Omit<T,K>`, `Record<K,V>`, `Readonly<T>`.

## Branded types: `type Brand<K,T> = K & { __brand: T }` for domain IDs, currencies, units.

## Performance: `--extendedDiagnostics`, interfaces over intersections (cached), split large unions, `skipLibCheck: true`, `incremental: true`.

## Monorepo: `references` in root, `composite: true` + `declaration: true` + `declarationMap: true` in packages.

## JS→TS migration: `allowJs`+`checkJs` → rename gradually → types file by file → strict features one by one.

## Config: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.

## Gotcha: `unknown` not `any`, type guards not assertions (`as`), consistent interface/type usage.

## Do NOT: `any`, `as` to silence errors, skip strict, `@ts-ignore`, complex unreadable generics.
