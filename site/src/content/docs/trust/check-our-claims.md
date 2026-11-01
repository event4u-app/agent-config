---
title: Check our claims yourself
description: Every capability or number Agent Config publishes is tied to a test, a benchmark run or a line of code — here is how to check one, and where we publish the results that did not hold.
---

Every claim on this site points at evidence you can rerun. Start with the checker in a clone of the repository:

```bash
git clone https://github.com/event4u-app/agent-config && cd agent-config
npm ci
./scripts-run src/scripts/check_claims
```

## How it works

- **A ledger of claims.** Each public claim has an entry in the [claims ledger](/agent-config/claims/) with its evidence — a test, a benchmark report or a `file:line` — and a status. Only a `backed` entry may be cited.
- **The build checks the pages.** A number on the README or on a hand-written page of this site must carry a marker pointing at a backed entry; one that does not fails the check.
- **We publish what did not hold.** Measured nulls stay published, and features are retired or narrowed when the evidence does not support them; every published null links the run that produced it. <!-- claim:positioning-honest-nulls -->

## Where to look

- [Verify it yourself](/agent-config/proof/) — the claims, the nulls and the known limits, with the commands to reproduce them.
- [Discipline benchmark](/agent-config/benchmark/) — every run, including the ones that showed nothing.
- [Benchmark & cost, explained](/agent-config/trust/benchmark-and-cost/) — the same results in plain words.
- [What leaves your machine](/agent-config/trust/network/) — every network call, and how to switch it off.
