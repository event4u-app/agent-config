---
complexity: lightweight
review_by: 2027-01-25
---

# Stub: a security chain that is measured, not asserted

> **Stub — not active work.** Created 2026-10-25 by
> `road-to-a-finding-that-fails-a-test` (Decision 5). It is a stub because its
> result needs spend and a held-out fixture: whether the chain beats a single
> `security-audit` pass is only readable after bench runs that cost model calls.

## Scope

1. A fixture app in two stacks (Laravel, Next.js) with at least eight planted
   findings each, three of them cross-file (route without policy, tenant scope
   missing in a repository, upload without type check), one secret and one
   comment addressed to the auditor. Exit of the fixture: today's single
   `security-audit` run does **not** reach 100 % — otherwise the instrument is
   saturated again (`internal/bench/reports/defect-finding.md`).
2. Pre-register a claim in `docs/CLAIMS.md` before the first run: precision,
   recall, overlap across three runs, cost per confirmed finding. Honest null
   allowed.
3. Arms: single `security-audit` · chain (`/audit code full`) · chain + one
   follow-up run. Deterministic scoring against the planted list, hard
   `--max-usd`.
4. The result decides whether `launch-readiness` *recommends* or only *offers*
   `/audit code full`.
5. Host probe: can an agent invoke the host-native diff security review, or only
   the human? Record `native | human-only | absent` per host before naming it as
   an additional independent seat.

6. A **false-all-clear rate** as a bench endpoint: the share of runs or
   replies that say "secure" or "no vulnerabilities" while planted findings
   are still open. It measures the failure a casual question produces.
7. **Host-native security results import.** Where a host plugin already
   writes a results file with a revision stamp, import its findings as
   `needs_validation`, stale when the stamp is not HEAD, rather than re-hunting.
8. **No double review per turn.** When a host plugin already reviews the diff
   at stop, the package does not run its own security diff review there too;
   measure the turn cost with and without.

> **Arrivals:** 1 — `inbox-2026-10-as` (2026-10-25) added items 6–8.

## Trigger

The owner authorises the bench spend, or a consumer runs `/audit code full` and
reports the ledger.

## Kill criteria

- The fixture cannot be made unsaturated in two attempts — drop the bench, keep
  the chain as procedure.
