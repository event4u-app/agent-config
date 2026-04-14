---
name: nuxt
description: "Use when writing Nuxt applications — auto-imports, file-based routing, server routes, SEO, or content modules."
source: package
---

# nuxt

## When to use

Use this skill when working with Nuxt projects — file-based routing, server routes,
auto-imports, SEO, or Nuxt Content.

## Before writing code

1. **Detect Nuxt version** — check `package.json` for `nuxt` (v3 vs v4).
2. **Check modules** — `nuxt.config.ts` → `modules` array (Content, SEO, UI, etc.).
3. **Check UI framework** — Nuxt UI, Vuetify, Tailwind, or custom.
4. **Check TypeScript** — Nuxt 3+ has built-in TypeScript support.
5. **Read project docs** — `./agents/`, `nuxt.config.ts`.

## File conventions

| Directory | Purpose | Auto-imported |
|---|---|---|
| `pages/` | File-based routing | Yes (routes) |
| `components/` | Vue components | Yes (components) |
| `composables/` | Composable functions | Yes (composables) |
| `server/` | Server-side code | — |
| `server/api/` | API routes | — |
| `server/routes/` | Server routes | — |
| `middleware/` | Route middleware | Yes |
| `layouts/` | Page layouts | Yes |
| `plugins/` | App plugins | Yes |
| `utils/` | Utility functions | Yes |
| `content/` | Markdown content (Nuxt Content) | — |

## Auto-imports

Nuxt auto-imports Vue APIs, composables, and components:

```vue
<script setup lang="ts">
// No imports needed for:
// - ref, computed, watch, onMounted (Vue)
// - useRoute, useRouter, useFetch, useAsyncData (Nuxt)
// - Components from components/ directory
// - Composables from composables/ directory

const route = useRoute()
const { data: users } = await useFetch('/api/users')
</script>
```

**Do NOT** add manual imports for auto-imported items — Nuxt handles this.

## Data fetching

```vue
<script setup lang="ts">
// useFetch — SSR-friendly, auto-deduped
const { data, pending, error, refresh } = await useFetch('/api/users')

// useAsyncData — when you need custom fetch logic
const { data } = await useAsyncData('users', () => $fetch('/api/users'))

// useLazyFetch — non-blocking (renders immediately, loads in background)
const { data, pending } = useLazyFetch('/api/users')
</script>
```

| Composable | SSR | Blocking | Use case |
|---|---|---|---|
| `useFetch` | ✅ | ✅ | Default — API calls |
| `useAsyncData` | ✅ | ✅ | Custom fetch logic |
| `useLazyFetch` | ✅ | ❌ | Non-critical data |
| `$fetch` | ❌ | — | Client-only or server routes |

## Server routes

```ts
// server/api/users.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const users = await db.users.findMany({ limit: query.limit })
  return users
})

// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const user = await db.users.create(body)
  return user
})
```

File naming convention: `{name}.{method}.ts` (e.g., `users.get.ts`, `users.post.ts`).

## SEO

```vue
<script setup lang="ts">
// Per-page SEO
useHead({
  title: 'My Page',
  meta: [
    { name: 'description', content: 'Page description' },
  ],
})

// Or use useSeoMeta for type-safe SEO
useSeoMeta({
  title: 'My Page',
  ogTitle: 'My Page',
  description: 'Page description',
  ogDescription: 'Page description',
})
</script>
```

## Middleware

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useAuthUser()
  if (!user.value) {
    return navigateTo('/login')
  }
})
```

Apply in pages: `definePageMeta({ middleware: 'auth' })`.

## Nuxt Content

For content-driven sites using `@nuxt/content`:

```vue
<!-- pages/blog/[...slug].vue -->
<template>
  <ContentDoc />
</template>
```

Content lives in `content/` as Markdown, YAML, or JSON files.

## Core: auto-imports, `useFetch`, file-based routing, server routes, `useHead`/`useSeoMeta`, TypeScript.

## Gotcha: naming conflicts with auto-imports, `useAsyncData` needs unique keys, server routes run in Nitro (no Vue composables).

## Do NOT: manual imports for auto-imported, axios/fetch when useFetch works, manual routes, client logic in server/, `process.env` (use `useRuntimeConfig()`), skip SSR testing.
