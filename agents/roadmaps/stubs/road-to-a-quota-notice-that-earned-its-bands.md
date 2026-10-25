---
complexity: lightweight
review_by: 2026-12-25
---

# Stub: road to a quota notice that earned its bands

> **Stub — not active work.** Split out of
> `road-to-a-quota-the-user-sees-coming` (round `inbox-2026-10-ax`) because it
> needs elapsed time, not effort: the bands in `_lib/pressure.ts` (50 / 80 / 100
> and projected-full-before-reset) are stated defaults, not measured ones.

**Trigger:** two weeks of ledger snapshots on the maintainer machine after the
status-line tap is installed — `~/.event4u/agent-config/state/quota/` holding
snapshots that span at least three five-hour windows.

**What it measures, once triggered:**

- notices shown per window per machine (target ≤ 3);
- for each window that reached `exhausted`, how many minutes before the cliff
  the first notice fired (bar: before 50 % of the window was spent);
- whether `rate_limits` was ever absent in a session that had it before
  (the host-regression risk), read as the share of `unknown` snapshots.

**Outcome either way:** a miss revises the bands in `pressure.ts` with the
measured figure; it never removes the notice. Published in the PR that revises
the bands, not as a separate evidence file.
