---
adr: 3
status: accepted
date: 2024-03-01
supersedes: —
superseded_by: —
---

# ADR-003 — Customers live on the tenant connection

`app/Models/Customer.php` and its migration use the `tenant` connection declared in
`config/database.php`.
