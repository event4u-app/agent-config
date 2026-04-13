---
name: nextjs
description: "Use when writing Next.js applications — App Router, Server Components, data fetching, and modern patterns."
---

# nextjs

## When to use

Use this skill when working with Next.js projects — App Router, Pages Router,
Server Components, API routes, or data fetching patterns.

## Before writing code

1. **Detect Next.js version** — check `package.json` for `next` version.
2. **Detect router** — App Router (`app/`) or Pages Router (`pages/`).
3. **Check TypeScript** — `.tsx` files, `tsconfig.json`.
4. **Check styling** — Tailwind, CSS Modules, styled-components.
5. **Check data fetching** — Server Components, `fetch()`, React Query, SWR.
6. **Read project docs** — `./agents/`, `next.config.js`.

## App Router (Next.js 13+)

### File conventions

| File | Purpose |
|---|---|
| `page.tsx` | Route page component |
| `layout.tsx` | Shared layout (wraps children) |
| `loading.tsx` | Loading UI (Suspense boundary) |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |
| `route.ts` | API route handler |

### Server vs Client Components

```tsx
// Server Component (default) — runs on the server, no client JS
export default async function UsersPage() {
  const users = await fetchUsers() // Direct data fetching
  return <UserList users={users} />
}

// Client Component — runs in the browser
'use client'
export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

**Rules:**
- Components are **Server Components by default** — no `'use client'` needed.
- Add `'use client'` only when you need: `useState`, `useEffect`, event handlers, browser APIs.
- Keep `'use client'` boundaries as low as possible in the component tree.
- Server Components can import Client Components, but not vice versa.

### Data fetching

```tsx
// Server Component — fetch directly
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`, {
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  }).then(res => res.json())

  return <ProductDetail product={product} />
}
```

| Strategy | When to use |
|---|---|
| `fetch()` in Server Component | Default — data needed at render time |
| `cache: 'force-cache'` | Static data that rarely changes |
| `next: { revalidate: N }` | ISR — revalidate every N seconds |
| `cache: 'no-store'` | Dynamic data — always fresh |
| Client-side (SWR/React Query) | User-specific data, real-time updates |

### API Routes (Route Handlers)

```ts
// app/api/users/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const users = await db.users.findMany()
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await db.users.create({ data: body })
  return NextResponse.json(user, { status: 201 })
}
```

### Metadata

```tsx
// Static metadata
export const metadata = {
  title: 'My Page',
  description: 'Page description',
}

// Dynamic metadata
export async function generateMetadata({ params }) {
  const product = await fetchProduct(params.id)
  return { title: product.name }
}
```

## Pages Router (legacy)

- Use `getServerSideProps` for server-side rendering.
- Use `getStaticProps` + `getStaticPaths` for static generation.
- Use `getInitialProps` only if absolutely necessary (disables automatic static optimization).

## Core rules

- Prefer **Server Components** — move `'use client'` as deep as possible.
- Use **TypeScript** for all new files.
- Use **`next/image`** for images (automatic optimization).
- Use **`next/link`** for navigation (client-side transitions).
- Use **`next/font`** for font loading (no layout shift).
- Handle **loading and error states** with `loading.tsx` and `error.tsx`.
- Use **middleware** (`middleware.ts`) for auth, redirects, headers.

## Auto-trigger keywords

- Next.js
- App Router
- Server Components
- SSR
- ISR

## Gotcha

- Server Components can't use hooks or browser APIs — the model frequently forgets this distinction.
- `use client` directive must be at the top of the file — not inside a component.
- Don't fetch data in client components when a Server Component could do it — unnecessary client-side JavaScript.

## Do NOT

- Do not use `'use client'` on components that don't need browser APIs.
- Do not use `<a>` tags — use `next/link`.
- Do not use `<img>` tags — use `next/image`.
- Do not put secrets in Client Components — they're exposed to the browser.
- Do not use Pages Router patterns in App Router projects (or vice versa).
