---
complexity: lightweight
review_by: 2027-01-25
---

# Stub: a route that names its guard

> **Stub — not active work.** Created 2026-10-25 by
> `road-to-a-finding-that-fails-a-test` (ledger row X6 of round
> `inbox-2026-10-ao`). Deferred because the two-account matrix finds missing
> authorization without it; the edge only pays once a consumer audit shows rows
> the matrix could not classify.

## Scope

Add a `guards` relation to `src/scripts/code_graph/types.ts` and emit it from the
providers that declare middleware or policies at the route (`laravel`,
`nextjs` middleware, `express` handler chains, `nestjs` guards, `spring`
annotations): `route --guards--> middleware|policy`. Every edge keeps
`resolved_via` and `provider`; an inferred guard is never merged with a declared
one. The security ledger then reports "route with no guard edge" as an
`enumeration: graph` row.

## Trigger

A `/audit code full` ledger on a real project carries `unreviewed` rows whose
reason is "guard not determinable".

## Kill criteria

- Two providers cannot express the guard without reading runtime config — keep
  the matrix as the only route-level signal.
