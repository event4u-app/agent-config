---
type: "always"
tier: "3"
description: "Priority Index for the four authority rules — Hard Floor → Permission Gate → Commit Default → Trivial-vs-Blocking; read first, route to canonical rule"
alwaysApply: true
source: package
---

# Agent Authority — Priority Index

Four rules answer **"may the agent do this autonomously?"** Higher band wins.

| Band | Trigger | Canonical rule |
|---|---|---|
| **1. Hard Floor** | Prod-trunk merge · deploy · push · prod data/infra · whimsical bulk deletion · bulk-deletion or infra commit | [`non-destructive-by-default`](non-destructive-by-default.md) |
| **2. Permission Gate** | Git op · branch / PR / tag · architectural or library change · scope expansion | [`scope-control`](scope-control.md) |
| **3. Commit Default** | About to commit — never, unless one of four exceptions fires | [`commit-policy`](commit-policy.md) |
| **4. Trivial-vs-Blocking** | Routine workflow question — act or ask | [`autonomous-execution`](autonomous-execution.md) |

## Rules

- Hard Floor wins, always — autonomy / roadmap / standing instruction never lift.
- Higher band wins on conflict — commit exception ≠ Hard Floor override; scope permission ≠ commit override.
- Unsure → [`ask-when-uncertain`](ask-when-uncertain.md).
