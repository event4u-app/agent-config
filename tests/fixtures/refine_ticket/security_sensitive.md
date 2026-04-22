# PROJ-302 — Accept signed Stripe webhooks and dispatch queued jobs per tenant

## Description

We need a public endpoint that receives Stripe webhooks for invoice
payments. The endpoint validates the webhook signature with our
shared secret, looks up the tenant from the customer ID, and queues
a background job to update the subscription status.

Only admin users should be able to see the dispatch log in the admin
panel.

## Acceptance criteria

- [ ] `POST /webhooks/stripe` — public endpoint, no auth header, signature-verified
- [ ] Signature verified against `STRIPE_WEBHOOK_SECRET`
- [ ] Tenant resolved from Stripe `customer_id`
- [ ] Queued job `UpdateSubscriptionStatus` dispatched per tenant
- [ ] Admin-only log view at `/admin/webhooks/stripe`
- [ ] CVE-2023-99999 mitigations noted in the code comments

## Notes

Billing events are sensitive. PII (customer emails) will appear in
logs; redact before indexing.
