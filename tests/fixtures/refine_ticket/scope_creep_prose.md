# PROJ-777 — Customer data sync overhaul

## Description

The customer data sync has grown unreliable over time. Sometimes rows
fail silently during the nightly pass. Other times they double up
across connectors without a clear cause. We need to revisit retries,
deduping, and the fallback path to make this solid again. Multiple
internal teams rely on this pipeline — Finance, Support, and Growth.
The last outage was fourteen days long before anyone noticed in
production. We should add an alert for this case. A lightweight
dashboard has been suggested as well.

## Acceptance criteria

- [ ] Investigate the current retry policy
- [ ] Rewrite the deduplication logic
- [ ] Add a monitoring alert on failed rows
- [ ] Confirm schema parity across connectors
- [ ] Update the sync runbook
- [ ] Notify downstream stakeholders
- [ ] Backfill rows that failed silently

## Notes

No new connectors in this ticket. Treat this as a reliability sweep.
