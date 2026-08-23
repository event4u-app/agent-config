---
type: "auto"
tier: "2a"
description: "Scale-safe persistence — indexes with the queries, bounded reads, safe migrations, growth budgets, thin request path, durable async; heuristics advise"
triggers:
  - keyword: "migration"
  - keyword: "index"
  - keyword: "N+1"
  - keyword: "eager load"
  - keyword: "pagination"
  - keyword: "queue"
  - keyword: "job"
  - keyword: "retention"
  - keyword: "schema"
  - keyword: "SELECT *"
  - phrase: "will this scale"
  - phrase: "review this migration"
  - phrase: "add a table"
  - phrase: "send an email on"
routes_to:
  - "skill:schema-review"
workspaces: [engineering]
packs: [scale-discipline]
trust:
  level: professional
collision_ok:
  "migration": "R-A6 migration-safety owns reversibility/index/retention rules"
  "schema": "schema change routes the persistence pack floor (R-A6/R-A2)"
# obligation: line 41
obligation_frequency: "per-edit"
---

# Scale Discipline

Pack floor for the `scale-discipline` pack (default-off; auto-activates
when the pack is installed — `agent-config packs:active` says whether it is,
and names the degraded case where zero packs load and this floor cannot
activate at all). AI agents produce functionally correct but
scale-hostile persistence code — this rule binds the failure classes to
deterministic pattern lints where possible and to review advice where not.

## The Iron Law

```
INDEXES SHIP WITH THE QUERIES THAT NEED THEM. READS ARE BOUNDED.
MIGRATIONS ARE REVERSIBLE. APPEND-ONLY TABLES DECLARE RETENTION.
THE SYNC HANDLER DOES ONLY: VALIDATE → PERSIST → DISPATCH → RESPOND.
MUST-NOT-LOSE WORK GOES THROUGH A DURABLE QUEUE, AFTER COMMIT.
EVERY FINITE RESOURCE ON A PRODUCTION PATH HAS A KNOWN CEILING AND
QUANTIFIED HEADROOM. AN UNQUANTIFIED CEILING IS NOT HEADROOM.
A HEURISTIC FINDING IS ADVICE, NEVER A CI FAILURE.
EVERY WAIVER CARRIES A NON-EMPTY REASON.
```

## Rule surface (tier per the spike-verdict record: `lint_persistence` gates where a spike PASSED; unspiked rules — R-A4, R-A9, R-A11 — are advice/normative only)

- **R-A1 query-shape** — no query calls inside iteration over query
  results; batch/eager-load instead (F1).
- **R-A2 index-parity** — every FK and every WHERE/ORDER BY column has an
  index or an explicit `// no-index: <reason>` waiver (F2).
- **R-A3 bounded-reads** — list endpoints paginate or declare a bound; no
  `SELECT *` on production paths (F3).
- **R-A4 reference-over-copy** — new columns duplicating FK-reachable data
  need a waiver (F4) — *advice tier*.
- **R-A6 migration-safety** — reversible; NOT NULL needs a default;
  concurrent index creation where the driver supports it; no destructive
  op without a waivered reason (F6).
- **R-A7 growth-budget** — append-only tables declare retention: TTL,
  pruning job, partition rotation, or archive path (F7).
- **R-A8 thin-request-path** — offloadable-catalog calls (mail, PDF/media,
  third-party HTTP, bulk mutations, ML inference, outbound webhooks)
  inside a request handler fail lint unless waived
  `// sync-required: <reason>` (F9). The catalog is a positive list of
  expensive call classes — a single indexed insert never needs a job.
- **R-A9 event-decoupling** — side effects react to domain events or
  observers via (queued) listeners; the mutating call site does not
  enumerate its consumers (F10) — *advice tier*.
- **R-A10 durable-async** — must-not-lose work (promised emails, billing,
  audit fan-out) goes through a durable queue with retry/backoff and a
  dead-letter path — never in-process fire-and-forget. No broker? Use a
  DB-backed queue driver or a documented `// accepted-loss: <reason>`
  waiver — never a silent in-process fallback (F11).
- **R-A11 commit-ordering** — async dispatch that reads mutated state
  fires after commit (Laravel `afterCommit` / `ShouldDispatchAfterCommit`;
  generic: transactional outbox).
- **R-A12 finite-resource readiness** — a change that consumes a
  **finite, exhaustible** resource on a production path names that
  resource's **ceiling** and its **headroom at expected peak**. R-A7
  covers unbounded *growth* of append-only tables; this covers *exhaustion*
  of a fixed budget, which fails differently: growth degrades, exhaustion
  stops. In scope — connection-pool slots, worker/thread slots, file
  descriptors, disk, memory, inode count, third-party API quota and
  rate-limit budget, per-plan managed-service caps. A ceiling that cannot
  be stated is `unknown`, never "probably fine", and an unquantified
  ceiling is not headroom — *advice tier* (no spike; `lint_persistence`
  cannot read a third-party quota).

  **Saturation is the readiness question.** Utilisation against a known
  ceiling is the one predictive signal — the other three Golden Signals
  report what already happened. Where the ceiling belongs to an upstream
  provider, its rate-limit headers are the source, not an estimate.

## When NOT to fire

- No persistence surface in the change (docs, UI-only, config).
- Runtime performance analysis of live traffic — that is APM territory,
  not artifact linting.

## See also

- [`schema-review`](../skills/schema-review/SKILL.md) — runs the linter,
  emits the gap table + neutral waiver-density report.
- [`history-discipline`](history-discipline.md) — sibling pack floor;
  audit tables fall under R-A7 here.
- [`architecture`](architecture.md) — thin handlers; this rule is its
  persistence-shaped enforcement.
- [`logging-monitoring`](../skills/logging-monitoring/SKILL.md) — defines
  saturation as a Golden Signal; R-A12 is where that signal is asked for at
  review time rather than after an incident.
- [`operational-readiness`](../skills/operational-readiness/SKILL.md) —
  consumes R-A12 as one typed input; a resource with no known ceiling is a
  red there, never an amber.
- `src/scripts/lint_persistence.ts` — the deterministic backstop.
