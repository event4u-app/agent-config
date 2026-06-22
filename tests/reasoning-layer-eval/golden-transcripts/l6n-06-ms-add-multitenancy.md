# Transcript — slot 06: ms-add-multitenancy

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Add tenant isolation so each customer's data is scoped to their tenant across the whole app.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & unknowns:**
1. No codebase provided yet—I cannot inspect current data model, auth flow, or API structure
2. "Across the whole app" suggests multi-layer isolation needed: DB queries, API endpoints, possibly UI
3. Critical unknowns:
   - How is tenant identity currently established? (JWT claim? Session? URL param?)
   - What's the current data model? (Relational? Document? Multi-schema or shared schema?)
   - Are there existing row-level security (RLS) policies or ORM hooks?
   - Is this greenfield or retrofit on existing queries?
   - What's the scale? (100 customers or 100k?)

**Real goal inference:** Prevent data leakage where one customer can read/modify another customer's data, and enforce this at the database and API layers so mistakes in business logic don't become security holes.

**Recommendation before I proceed:** Share the codebase structure (stack, auth mechanism, current data layer). I'll focus on the highest-leverage isolation point first—likely either DB schema/queries or API middleware—depending on what I find.

**Load-bearing sequencing if I proceed blind:**
1. **Auth context extraction** – how tenant ID flows through the request (hardest, most upstream)
2. **DB layer enforcement** – query filtering or RLS (irreversible if retrofitted wrong)
3. **API route guards** – middleware to block cross-tenant access
4. **Audit** – identify unscoped queries that need fixing

---

## Answer

I need to see your codebase to add tenant isolation correctly. Provide:

1. **Stack** – framework (Next.js, Rails, Node+Express?), DB (PostgreSQL, MongoDB?), ORM (Prisma, Sequelize, etc.)
2. **Auth mechanism** – how the current request knows which user/tenant (JWT, session cookie, etc.)
3. **Data model** – sample schema showing how customer/tenant data is currently organized
4. **Entry points** – 1–2 example API routes or pages

Once I see these, I'll implement isolation at the narrowest upstream point (likely auth → request context → DB query filter) to minimize diff surface.

What's your stack?
~~~

**Tokens:** in 667 / out 514 / est $0.009711 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: identifies missing context upfront, refuses premature solution, answer is clean request for grounding info."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Grounding constraints & gaps:**

1. I don't know the current architecture:
   - Is this a monolith, microservices, or hybrid?
   - What's the data layer (SQL, NoSQL, other)?
   - Are there existing auth/user models?
   - Is there a defined "tenant" entity or do I need to create one?

2. Scope ambiguity:
   - "Whole app" — does this include APIs, background jobs, reporting, admin panels?
   - Do existing tenants already exist, or is this a green-field multi-tenant setup?
   - Are there shared/global data that should NOT be tenant-scoped?

3. Load-bearing unknowns (in order of impact):
   - **What is the current data model?** (Can't add isolation without seeing schema/ORM)
   - **How is the user identified today?** (tenant linkage depends on this)
   - **Acceptance criteria:** what does "isolation" mean to you? (query-level filtering? row-level security? network/API level?)

**Inferred real goal:**  
Ensure that API calls, queries, and UI views from User A (tenant X) cannot read, write, or infer data belonging to User B (tenant Y), even if they guess IDs or exploit bugs.

**Recommendation:**  
Show me the codebase structure (schema, auth model, request flow) so I can propose a minimal scoped change. A guess-based implementation will leave gaps.

---

## Answer

I cannot design this without seeing:

1. **Your data schema** — what tables/collections exist and how do they relate to users/accounts?
2. **Current auth flow** — how do you identify the user making a request?
3. **Framework & ORM** — (e.g., Rails + ActiveRecord, Django + ORM, Node.js + Sequelize, etc.)

**Ask one of these to unblock:**

- Can you share the main `User` / `Account` / schema files?
- Or paste a representative API endpoint + its database query?
- Or describe: "We have [framework], users belong to [organization/team/workspace], and data is currently [scoped/not scoped]"?

Once I see the actual structure, I'll give you a minimal, targeted diff that:
- Adds tenant context to the request (from user → tenant lookup)
- Adds `.where(tenant_id: current_tenant_id)` to queries (or equivalent in your ORM)
- Covers the critical path (which endpoints/models first)
~~~

**Tokens:** in 821 / out 593 / est $0.011358 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect notes-first. Grounded unknowns before designing. Refused premature solution. Answer clear & outcome-focused."}

**Output-token overhead (orchestrated vs distributed):** +15.4%
