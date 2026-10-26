---
adr: 2
status: accepted
date: 2024-04-15
supersedes: ADR-001
superseded_by: —
---

# ADR-002 — Read warehouse stock over SOAP, queued

Warehouse stock is read through the SOAP `GetStock` operation (`resources/wsdl/stock.wsdl`)
from a queued job, `app/Jobs/SyncStock.php`, so a slow partner never blocks a request.
Orders stay on REST.
