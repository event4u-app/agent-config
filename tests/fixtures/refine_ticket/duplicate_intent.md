# PROJ-201 — Unified notifications + reporting dashboard for admins

## Description

Admins need one place to see both the notifications they've sent and
the reporting figures for the last 30 days. Combine the existing
notifications area and the reporting widgets into a single admin
dashboard so we don't have to click between two screens.

Also tie into the invoicing overview — if a customer has an unpaid
invoice, their notifications pane should show it.

## Acceptance criteria

- [ ] New `/admin/dashboard` route
- [ ] Shows notifications from the last 30 days
- [ ] Shows reporting figures (MRR, active users, churn)
- [ ] Shows unpaid invoices per customer inline
- [ ] Admin-only access

## Notes

We already have a notifications module, a reporting module, and an
invoicing module — this ticket is about stitching them together, not
rebuilding any of them.
