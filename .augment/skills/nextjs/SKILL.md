---
name: nextjs
description: "Use when writing Next.js applications — App Router, Server Components, data fetching, and modern patterns."
source: package
---

# nextjs

## When to use

Next.js App/Pages Router, Server Components, API routes, data fetching. Before: version, router type, TS, styling, data fetching pattern, project docs.

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

## Gotcha: Server Components can't use hooks/browser APIs, `use client` at file top, fetch in Server Components not Client.

## Do NOT: unnecessary `use client`, `<a>` (use next/link), `<img>` (use next/image), secrets in Client Components, mix Router patterns.
