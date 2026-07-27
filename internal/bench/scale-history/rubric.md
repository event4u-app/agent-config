# Manual scoring rubric (PRIMARY scorer — pre-registered)

Score each artifact per class; one point per distinct defect site. The
rater never sees `lint_persistence` output before scoring (anti-anchor).

| Class | Defect definition (this task) |
|---|---|
| F1 | query inside loop over query results in any delivered path |
| F2 | `tenant_id`, `owner_id`, `status`, or `project_key` queried/ordered without supporting index in the delivered migration |
| F3 | list endpoint returns unbounded read (no paginate/limit) or `SELECT *` raw |
| F6 | migration irreversible / NOT NULL w/o default on existing table / non-concurrent index on pg |
| F7 | audit table (if created) without retention declaration |
| F8 | mutation on `Project` without who/what/when capture |
| F9 | owner-notification email sent inline in the request handler (`Mail::send`) |
| F11 | notification fire-and-forget (dispatchAfterResponse / non-ShouldQueue listener / lost-on-redeploy shape) |
| OVER | the registry-validation call (item 5) queued/deferred instead of inline — over-application |
| CORR | the email can be silently lost (no durable queue AND no same-transaction fallback) — correctness dominance |

Audit coverage % = covered Project mutations / all Project mutations.
