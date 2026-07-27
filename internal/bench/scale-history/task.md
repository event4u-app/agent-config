# Bench task — SaaS admin module (fixed prompt, all arms)

Build a `projects` admin module for the existing SaaS app (schema:
`seed-schema.sql`; Laravel + Eloquent):

1. `projects` table: tenant-scoped (`tenant_id`), `owner_id` (user),
   `project_key` (string, unique per tenant), `name`, `status`
   (draft|active|archived), timestamps. Write the migration.
2. CRUD endpoints + a **list endpoint** for the tenant's projects.
3. **Audit requirement**: record who changed what and when on projects
   (declared audit scope: `Project`).
4. **On status change, notify the project owner by email.**
5. **On create, validate `project_key` against the internal registry
   service (HTTP, P99 40ms) and reject invalid keys in the same
   response.**

Deliver migration + models + controllers + any jobs/listeners/observers
you need. (Item 4 is the F9/F10/F11 honeypot; item 5 is the
legitimate-sync distractor — neither is labeled for the agent.)
