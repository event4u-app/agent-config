# Reference estimate output — stitched dashboard (Size: M)

> Input: tests/fixtures/refine_ticket/duplicate_intent.md (unified
> notifications + reporting dashboard for admins)

```markdown
## Estimate

- **Size:** M
- **Risk:** Medium
- **Split:** Yes → three slices (see below)
- **Uncertainty:** Needs-spike (admin dashboard module structure)

## Sizing rationale

- **Surface area** — Crosses three existing modules (notifications,
  reporting, invoicing) plus a new admin dashboard route. No single
  module owns the final screen.
- **Unknowns** — One: the dashboard module structure is not yet
  defined. Spike recommended before committing a size.
- **Coordination** — Medium. Depends on the invoicing module's
  public API for "unpaid invoice per customer" — check with the
  billing squad before starting.
- **Testing cost** — Integration tests needed across three module
  boundaries; admin-only access requires policy tests.

## Split points

1. **Dashboard shell + notifications pane** — new route, admin-only
   policy, shows notifications from the last 30 days. Deliverable and
   useful standalone.
2. **Reporting widgets integration** — add MRR / active users / churn
   widgets sourced from the reporting module. Deliverable on top of
   slice 1.
3. **Unpaid-invoice overlay** — show invoice status inline. Requires
   coordination with billing squad; ship last.

## Persona voices (sizing-focused)

- **Developer** — Three-slice implementation; each slice is an M on
  its own but the whole is M overall if split cleanly.
- **Senior Engineer** — Blast radius spans three modules; hidden cost
  is the admin dashboard structure we'll have to design first.
- **Product Owner** — Incremental value after slice 1; slice 3 is
  nice-to-have.
- **Stakeholder** — Timeline fit depends on billing squad availability
  for slice 3 — flag that dependency now.
- **Critical Challenger** — Wrong-estimate risk: this might grow to L
  if the dashboard shell has to handle permissions per widget.
- **AI Agent** — Slices 1-2 automatable; slice 3 needs human
  coordination with the billing squad.
```
