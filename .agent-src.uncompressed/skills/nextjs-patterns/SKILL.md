---
name: nextjs-patterns
description: "Writes Next.js App Router code — Server Components, Server Actions, RSC boundaries, route handlers, caching, and streaming — matching framework conventions and project architecture."
source: package
domain: engineering
---

# nextjs-patterns

## Compatibility

- **Tested against:** Next.js `14.x` and `15.x` (App Router), React `18+` / `19+`.
- Pages Router is **out of scope**. On a Pages-Router project (no `app/`),
  fall back to plain React skills; ask before introducing App Router.

## When to use

Use this skill for Next.js-specific code generation and editing on the App Router:

- Server Components (RSC) and Client Components (`"use client"`)
- Server Actions (`"use server"`)
- Route Handlers (`app/api/**/route.ts`)
- Layouts, templates, loading / error / not-found boundaries
- Data fetching with `fetch` + cache directives
- `revalidatePath` / `revalidateTag` invalidation
- Streaming and `<Suspense>` boundaries
- Middleware (`middleware.ts`)
- Metadata API (static + dynamic)
- Route Groups, Parallel Routes, Intercepting Routes

## When to use the analysis sibling

When the task is **understanding** how a Next.js app boots, where the
server/client boundary lives, what is cached vs streamed, or why a
hydration mismatch fires — defer to `project-analysis-nextjs` first,
then return here for the edit.

## Procedure: write Next.js code

1. **Confirm App Router** — `app/` directory exists; `next.config.{js,ts,mjs}` present.
2. **Confirm version** — `package.json` major for `next`. 14.x vs 15.x differs in
   default caching (15.x is uncached by default for `fetch`) and in `cookies()` /
   `headers()` being async.
3. **Inspect routing layout** — flat `app/` vs grouped (`app/(marketing)/`,
   `app/(app)/`); identify shared layouts and parallel routes.
4. **Inspect data layer** — Server Actions vs route handlers vs external API;
   ORM (Prisma, Drizzle) or fetch-based.
5. **Inspect styling** — Tailwind, CSS Modules, or styled engine; respect the
   chosen stack, do not mix.
6. **Check test conventions** — Vitest / Jest + RTL for components; Playwright
   for E2E; route-handler tests via `node` runtime.

## Server vs Client boundary

- **Server Components are the default.** Add `"use client"` only when a leaf
  component needs state, effects, browser APIs, or event handlers.
- The `"use client"` boundary is **viral upward at the import graph**, but you
  can keep a Server Component **rendered as a child** of a Client Component
  by passing it as a prop / `children` — that pattern keeps server logic out
  of the client bundle.
- Never put database access, secrets, or server-only modules inside a Client
  Component or a file imported by one. Use `import "server-only"` at the top
  of a server module to make leaks fail at build time.
- Symmetric guard: `import "client-only"` for code that must never run on the
  server (e.g. browser-only SDKs).
- Props passed from Server → Client must be serializable. No functions, no
  Dates with custom prototypes, no `Map` / `Set` — use plain JSON.

## Server Actions

- Declare with `"use server"` at the top of the file or per-function.
- Server Actions are **server-only RPC**; never call them from `useEffect` for
  pure data fetching — that is what Server Components are for.
- Always **validate input** (zod or equivalent) at the entry of the action —
  the caller is the client; treat it as hostile.
- Always **re-authorize** inside the action; do not trust client-side guards.
- After a mutation: call `revalidatePath()` / `revalidateTag()` or `redirect()`.
- Return shape: a `{ ok: true, data }` / `{ ok: false, error }` discriminated
  union — never throw across the action boundary for expected errors.
- Use `useActionState` (15.x) / `useFormState` (14.x) on the client for
  progressive enhancement; the form must work without JS.

## Route Handlers

- `app/api/**/route.ts` exports `GET`, `POST`, etc.
- Handlers run on the **node runtime by default**; opt into `edge` only when
  the dependency set supports it.
- Read request body once: `await req.json()` or `await req.formData()`.
- Return `Response` / `NextResponse`. Use `NextResponse.json` for JSON +
  consistent status codes.
- Authentication and rate limiting happen **inside** the handler or via
  `middleware.ts`; do not assume any framework default.
- Cache behavior: route handlers are dynamic by default in 15.x. Add
  `export const dynamic = 'force-static'` / `revalidate = N` explicitly.

## Caching and revalidation (14.x vs 15.x)

- **14.x**: `fetch` is cached by default (force-cache); opt out with
  `{ cache: 'no-store' }` or segment-level `export const dynamic = 'force-dynamic'`.
- **15.x**: `fetch` is **not cached by default**; opt in with
  `{ cache: 'force-cache' }` or `{ next: { revalidate: N } }`.
- Use **tag-based revalidation** for shared invalidation surface:
  `fetch(url, { next: { tags: ['posts'] } })` then `revalidateTag('posts')`.
- Use `revalidatePath('/blog/[slug]', 'page')` for targeted page invalidation.
- Never call `revalidate*` from a Client Component — wrap it in a Server Action.
- `unstable_cache` / `cache` (React) wrap pure server functions for memoization
  within a request; respect the difference between request-scoped and
  cross-request caching.

## Data fetching patterns

- Prefer fetching in **the Server Component that uses the data**, not in a
  layout, to allow per-route streaming.
- Parallel fetching: declare independent promises and `await` together —
  avoid sequential `await` chains that block streaming.
- `<Suspense>` boundaries make slow data non-blocking; wrap each independent
  data dependency in its own Suspense, not the whole page.
- `loading.tsx` is a default Suspense fallback for the segment; do not use it
  as a global spinner.
- Avoid `useEffect` for initial data load in Client Components — fetch on the
  server and pass props.

## Layouts, templates, error and not-found

- `layout.tsx` is a **persistent** wrapper across navigations; do not put
  per-page logic there.
- `template.tsx` re-renders on every navigation; use only when a layout
  cannot.
- `loading.tsx`, `error.tsx`, `not-found.tsx` are **per-segment**; nest them
  to localize fallbacks.
- `error.tsx` must be a Client Component (`"use client"`); accept `error` and
  `reset` props.

## Middleware

- `middleware.ts` at the project root runs on the **edge runtime** before a
  request hits a route — use for auth redirects, locale negotiation, A/B.
- No database access from middleware; the edge runtime cannot run most node
  drivers. Use a session cookie + lightweight verification.
- `matcher` config narrows which paths invoke it — never let middleware run
  on every asset.

## Metadata, performance, env

- Metadata: static `export const metadata`; dynamic `generateMetadata()`.
  `generateStaticParams` for static dynamic-segment generation.
- `next/image`, `next/font`, `next/dynamic` for images, fonts, code-split
  Client Components — never bare `<img>`, CSS `@import` Google Fonts, or
  unguarded heavy imports.
- A single `"use client"` near the top of a tree pulls the subtree into the
  client bundle — keep the boundary at the leaf.
- Env: server-only `DATABASE_URL` etc.; client-exposed must be prefixed
  `NEXT_PUBLIC_*` and is NOT secret. Validate env at boot (zod) and import
  the validated object — never `process.env` ad hoc.

## Output format

1. Next.js code following App Router conventions and the project's existing layout.
2. All related files (page, layout, server action, route handler, schema, test) as needed.
3. When a cache surface changes — point at the invalidation call (`revalidateTag` / `revalidatePath`).

## Do NOT

- Do NOT add `"use client"` to a file that does not need it — it pulls the
  subtree into the client bundle.
- Do NOT import server modules (db client, secrets) from a Client Component
  file — even transitively. Guard with `import "server-only"`.
- Do NOT call Server Actions from `useEffect` to fetch data — fetch on the server.
- Do NOT throw across a Server Action boundary for expected errors — return a
  result union.
- Do NOT trust client-side authorization in a Server Action or route handler —
  re-check.
- Do NOT mutate without revalidating — stale UI is a class of bug, not a design.
- Do NOT mix Pages Router and App Router patterns in one feature — pick one.
- Do NOT assume 14.x caching defaults on 15.x; verify the major before reasoning about cache.

## Gotcha

- **15.x async APIs**: `cookies()`, `headers()`, `params`, `searchParams` are
  **async** in 15.x. Code that ran on 14.x will silently misbehave (Promise
  rendered as an object) until awaited.
- **Hydration mismatch**: rendering `Date.now()`, `Math.random()`, or
  locale-dependent strings without `suppressHydrationWarning` or a Client
  boundary causes a hydration error.
- **`"use client"` is not opt-in for hooks**: it is required for any file
  using `useState`, `useEffect`, `useRef`, or browser globals.
- **Server Actions and forms**: a Server Action used as a form action must
  accept `FormData`. Mixing `FormData` and typed args breaks progressive
  enhancement.
- **Cache lies during dev**: dev mode ignores most cache directives. Verify
  caching behavior in a production build (`next build && next start`).
- **`revalidatePath` requires the route group syntax** for parallel/dynamic
  segments — bare paths silently miss.
- **Edge runtime ≠ Node**: most npm packages with native deps or Node-only
  APIs (`fs`, `crypto.createHash`) fail at the edge. Pin runtime per route.

## Auto-trigger keywords

- Next.js / App Router · Server Component (RSC) · Client Component (`"use client"`)
- Server Action (`"use server"`) · Route Handler (`app/api`) · `middleware.ts`
- `revalidatePath` / `revalidateTag` / `unstable_cache`
- `next/image` / `next/font` / `next/dynamic`
- `layout.tsx` / `loading.tsx` / `error.tsx` / `not-found.tsx`
