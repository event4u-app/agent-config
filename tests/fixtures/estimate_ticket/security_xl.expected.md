# Reference estimate output — Stripe webhook + queued per-tenant dispatch (Size: XL)

> Input: tests/fixtures/refine_ticket/security_sensitive.md

```markdown
## Estimate

- **Size:** XL
- **Risk:** High
- **Split:** Yes → four slices (see below)
- **Uncertainty:** Needs-spike (signature verification scheme; tenant
  resolution path)

## Sizing rationale

- **Surface area** — New public endpoint + signature verification +
  tenant resolution + queued job + admin log view. Four distinct
  subsystems.
- **Unknowns** — Two: the exact Stripe signature header format used by
  our chosen client library, and whether the existing tenant resolver
  accepts Stripe customer IDs directly or needs a mapping table.
- **Coordination** — High. Billing events are sensitive; the security
  team should review the threat model before merge; the platform team
  owns the queue worker that will pick up the job.
- **Testing cost** — Signature-verification unit tests, webhook
  replay-attack test, tenant-isolation test, queue-dispatch integration
  test, admin-only policy test. Manual verification against Stripe's
  webhook-test tool.

## Split points

1. **Public endpoint + signature verification** — deliverable as a
   standalone ticket; returns 202 on valid signature, 400 otherwise,
   no tenant / queue work yet. Gives security team something concrete
   to review.
2. **Tenant resolution from Stripe customer ID** — deliverable on top
   of slice 1; endpoint now knows which tenant a webhook belongs to.
3. **Queued job `UpdateSubscriptionStatus`** — deliverable on top of
   slices 1-2; dispatch + retry policy + observability.
4. **Admin log view at `/admin/webhooks/stripe`** — deliverable last;
   pure read-side feature with admin-only policy.

## Persona voices (sizing-focused)

- **Developer** — XL is accurate; four distinct subsystems. Slice 1
  alone is an L.
- **Senior Engineer** — Blast radius includes the tenant boundary and
  a public endpoint — any mistake here is a CVE-shaped incident. Run
  `threat-modeling` before sizing, not after.
- **Product Owner** — Incremental value only after slice 3; slices
  1-2 are infrastructure.
- **Stakeholder** — Timeline risk is real — signature scheme decision
  and security review can both block merge.
- **Critical Challenger** — Wrong-estimate risk: this grows from XL
  to "indefinite" if Stripe's signature verification doesn't match
  our existing webhook-sig helper.
- **AI Agent** — Slice 1 automatable with threat-modeling support;
  slices 3-4 require observability + alerting discussion with humans.

## Orchestration notes (from refine-ticket Phase 2 integration)

- `threat-modeling` — fired on: auth, webhook, secret, tenant, billing
- Admin-only log view introduces an authorization boundary — cite
  `authz-review` before slice 4.
```
