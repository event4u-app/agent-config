---
type: "always"
tier: "3"
description: "Priority Index for the four authority rules — Hard Floor → Permission Gate → Commit Default → Trivial-vs-Blocking; read first, route to canonical rule"
alwaysApply: true
source: package
---

# Agent Authority — Priority Index

Four rules answer **"may the agent do this autonomously?"** Check bands in order; higher band wins.

| Band | Trigger | Canonical rule |
|---|---|---|
| **1. Hard Floor** | Prod-trunk merge · deploy · push · prod data/infra · whimsical bulk deletion · bulk-deletion or infra commit | [`non-destructive-by-default`](non-destructive-by-default.md) |
| **2. Permission Gate** | Git op · branch / PR / tag · architectural or library change · scope expansion | [`scope-control`](scope-control.md) |
| **3. Commit Default** | About to commit — never, unless one of four exceptions fires | [`commit-policy`](commit-policy.md) |
| **4. Trivial-vs-Blocking** | Routine workflow question — act or ask | [`autonomous-execution`](autonomous-execution.md) |

## Index rules

- **Hard Floor wins, always.** No autonomy setting, roadmap step, or standing instruction lifts it.
- **Higher band wins on conflict.** Commit exception ≠ Hard Floor override; scope permission ≠ commit override.
- **Index never restates an Iron Law.** Iron Laws live verbatim in canonical files; this router only points.
- **Unsure → ask.** [`ask-when-uncertain`](ask-when-uncertain.md) is the universal escape hatch.
