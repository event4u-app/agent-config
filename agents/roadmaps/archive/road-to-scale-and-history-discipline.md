---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to scale & history discipline — two packs, one deterministic linter substrate

> **Source:** `agents/tmp.old/scalable-projects.txt` (local inbox archive,
> gitignored) — maintainer feedback 2026-07-27: AI agents build functionally
> correct but scale-hostile apps (missing indexes, N+1, duplicated data
> instead of references, unbounded growth, no caching consideration) and get
> audit history wrong in both directions (missing entirely, or over-built as
> event sourcing where a row-level log suffices). Follow-up feedback added
> the async dimension: the synchronous call path must stay minimal —
> offload via queues, react via observers/events. The inbox file carries a
> pre-drafted roadmap from an external research chat; sources are retained
> there (local-only) and referenced here as Source A–E per
> `source-confidentiality`.
> **Council:** AI council debate 2026-07-27 (see Council-notes section).
> **Default state of all new features: OFF until benchmarked.**
> Depends on: consumer rule projection (9.0.0), `discipline_profile: auto`
> (8.0.0), claims-ledger gate, bench infrastructure (honesty-bench pattern).

## Goal

Give the suite a consumer-facing persistence vertical: two installable,
default-off packs — `scale-discipline` (query shape, index parity, bounded
reads, migration safety, growth budgets, thin request path, durable async)
and `history-discipline` (audit coverage, normative history-tier selection,
audit-table hygiene, privacy interlock) — backed by ONE deterministic linter
substrate (`lint_persistence`) that only gates what it can prove, with
falsification spikes BEFORE rules and a pre-registered bench BEFORE any
public claim. Prose without enforcement is token cost with unproven lift;
heuristics ship as advice, never as CI failures.

## Problem statement (verifiable failure classes)

"Deterministic" below means **deterministic pattern detection with an
auditable waiver process** (the Clippy/ESLint model): the linter identifies
the pattern class mechanically; the correctness of each instance may be
contextual and is handled by a reasoned waiver — never by the linter
claiming judgment it does not have (council round 2 convergence).

| # | Failure class | Typical shape | Pattern-detectable? |
|---|---|---|---|
| F1 | N+1 queries | query inside loop over prior query result | YES (AST: call-in-loop over result set) |
| F2 | Missing indexes | WHERE/ORDER BY/FK columns without index in migration | YES (migration diff vs. query surface) |
| F3 | Unbounded selects | `SELECT *` / no LIMIT / no pagination on list endpoints | YES (AST/grep) |
| F4 | Denormalized duplication | copied fields instead of FK reference | PARTIAL (schema heuristic) |
| F5 | No caching layer | hot read path hits DB every request | PARTIAL (needs trace/heuristic) |
| F6 | Unsafe migrations | irreversible, NOT NULL w/o default, non-concurrent index | YES (migration linter) |
| F7 | Unbounded table growth | log/history/queue tables without retention | YES (schema + absence-of-pruning) |
| F8 | Missing audit history | mutations on admin/tenant data without who/what/when | YES (mutation surface vs. audit hooks) |
| F9 | Sync work in request path | mail/PDF/image/external-HTTP/ML inline in handler | YES (offloadable call-class list per stack) |
| F10 | Inline side effects instead of events | consumers hard-wired into the mutating call | PARTIAL (heuristic) |
| F11 | Non-durable async | fire-and-forget for must-not-lose work | YES (call-class list per stack) |

F8 twin risk: agents that DO add history often add it wrong — event sourcing
where a row log suffices, or audit tables that themselves violate F7. The
vertical encodes a **decision matrix**, not a single pattern.

External prior art (real identities in the local inbox archive only):

- **Source A** — the Laravel ecosystem's official agent-skill collection.
- **Source B** — a community Laravel skill package whose slow-query command
  already covers F1–F3 detection for Eloquent; closest existing peer for
  the detection half. Fresh-clone sweep before Phase 2 (borrow-with-
  attribution if the license permits, per house pattern).
- **Source C** — a narrow community event-sourcing skill; evidence that
  narrow-scope skills stay reliable.
- **Source D** — an established Python linter's async rule family; proof
  that request-path blocking is CI-lintable deterministically. We replicate
  the approach per stack, not the rules.
- **Source E** — an external 2026 agent-DDL benchmark: skill files move
  agent output quality measurably **in both directions** (one model family
  regressed with the skill file). Strongest argument for the pre-registered
  bench with honest-null path, reported per model family, never averaged.
- Redis / queue-broker job docs — canonical offloadable catalog (email,
  payments, image processing, ML inference, webhooks); seed list for the
  R-A8 per-adapter config. (Integration recommendation, no anonymization
  needed.)

**Positioning claim (claims-ledger entry ONLY after the Phase 4 bench):**
this suite differs from point-skills by (a) deterministic linters where the
failure class allows it, (b) framework-scoped projection so consumers pay
tokens only for their stack, (c) audited claims. Until benched: hypothesis,
not claim. Do not front-run the bench in any announcement.

## Non-goals

- No runtime APM / query profiler — we lint artifacts (code, migrations,
  schema), not live traffic.
- No generic "performance best practices" prose rule without enforcement.
- No mandatory event sourcing — the audit vertical prescribes the
  *cheapest sufficient* history mechanism.
- No new always-on rules — everything enters through packs / scoped load;
  ONE routing rule per pack (ADR-110 pattern), depth lives in skills.
- **R-A5 cache-consideration: PARKED** — enters only if Phases 0–4 clear
  AND someone proposes a falsifiable detection mechanism. No prose-only
  cache rule ships. (Draft Phase 6 — closed by decision, not scheduled.)

## Architecture — two packs, one shared linter substrate

### Pack A: `scale-discipline` (rule surface, projected by stack)

- R-A1 **query-shape** — no query calls inside iteration over query
  results; batch/eager-load (F1)
- R-A2 **index-parity** — every FK and every WHERE/ORDER BY column has an
  index or an explicit `// no-index: <reason>` waiver (F2)
- R-A3 **bounded-reads** — list endpoints paginate or declare a bound; no
  `SELECT *` on production paths (F3)
- R-A4 **reference-over-copy** — new columns duplicating FK-reachable data
  require a waiver (F4) — *advice tier*
- R-A5 **cache-consideration** — PARKED (see Non-goals)
- R-A6 **migration-safety** — reversible; NOT NULL needs default;
  concurrent index creation where the driver supports it; no destructive
  op without a backup step (F6)
- R-A7 **growth-budget** — append-only tables declare retention (TTL,
  pruning job, partition rotation, or archive path) (F7)
- R-A8 **thin-request-path** — the sync handler does only: validate →
  persist primary state change → enqueue/dispatch → respond. Offloadable-
  catalog calls (mail, PDF/report, media processing, third-party HTTP,
  bulk mutations, ML inference, outbound webhooks) inside a handler fail
  lint unless waived `// sync-required: <reason>` (F9)
- R-A9 **event-decoupling** — side effects react to domain events/observers
  via (queued) listeners; the mutating call site does not enumerate its
  consumers. New side-effect domain = new listener, not a handler edit
  (F10) — *heuristic detection, normative for review*
- R-A10 **durable-async** — must-not-lose work (promised emails, billing,
  audit fan-out) goes through a durable queue with retry/backoff and a
  dead-letter path; never in-process fire-and-forget. Long jobs return a
  job id; status via polling/SSE (F11)
- R-A11 **commit-ordering** — async dispatch reading mutated state fires
  after commit (Laravel `afterCommit`/`ShouldDispatchAfterCommit`; generic:
  transactional outbox) (F11-adjacent)

### Pack B: `history-discipline`

- R-B1 **audit-coverage** — mutations on declared audit-scoped models emit
  who/what/when (actor id, diff or event, timestamp, correlation id) (F8)
- R-B2 **history-tier-selection** — normative decision matrix:

| Tier | Mechanism | Use when | Growth control |
|---|---|---|---|
| 0 | `updated_at`/`updated_by` columns | single-editor, no compliance need | none needed |
| 1 | Row-level audit log (Laravel: spatie/activitylog or owen-it/laravel-auditing; TS: thin custom audit table) | admin panels, SaaS tenant data, "wer hat was wann geändert" | retention REQUIRED (R-A7 applies) | <!-- md-language-check: ignore -->
| 2 | DB temporal/system-versioned tables | point-in-time queries, DB supports it | partition rotation |
| 3 | Event sourcing | domain genuinely event-driven, replay/projection needed | snapshotting + archive REQUIRED |

Default tier: **1**. Tier 3 requires an explicit architecture waiver —
agents must not "upgrade" to event sourcing unprompted.

- R-B3 **audit-table-hygiene** — audit storage indexed on
  (auditable_type, auditable_id, created_at); JSON diffs, not full-row
  copies, where a diff suffices; audit tables fall under R-A7
- R-B4 **privacy-interlock** — audit records inherit the deletion/
  anonymization obligations of the data they describe (GDPR Art. 17 path
  must exist)
- R-B5 **reliable-history-interlock** — audit capture is itself
  R-A10/R-A11-bound: same-transaction write (Tier-1 default; cheap single
  insert is allowed request-path work) OR outbox/afterCommit with a durable
  queue when offloaded. A lossy audit trail is worse than none.

### Shared substrate: `lint_persistence`

Deterministic checks for F1/F2/F3/F6/F7/F9/F11 + F8-coverage. Adapters:

- `adapter-raw-sql` — migration-file parsing, framework-agnostic
  (priority 1; F6/F7 need it regardless of ORM)
- `adapter-eloquent` — Laravel (priority 1; matches consumer reality)
- `adapter-prisma` — TS (priority 2); drizzle/typeorm later
- Offloadable catalog + waiver syntax are **per-adapter config data**, not
  hardcoded (Eloquent: `Mail::send` vs `Mail::queue`, non-`ShouldQueue`
  listeners, `Http::` in controllers; TS: nodemailer/fetch/puppeteer in
  route handlers, unawaited promises for must-not-lose work).
- Heuristic-tier findings (F4, F10) are emitted as `advice`, never CI
  failures. Iron-Law compliance: no rule claims certainty the linter
  cannot verify.
- Waiver hygiene: every waiver requires non-empty reason text (linted);
  waiver density reported **neutrally** in schema-review output — high
  density can mean informed exceptions (healthy) or rule misfit (fix the
  rule); the report states both readings, never treats density alone as a
  smell (council round 2).

### Skill layer

- `skill: schema-review` — invoked on migration diffs; runs
  lint_persistence + produces an indexed gap table in house format.
- `skill: history-design` — invoked when a model is declared audit-scoped;
  walks the R-B2 matrix; outputs tier decision + rationale artifact.

## Phase 0 — Falsification spikes (blocking)

> Pre-registered pass/fail per spike. Honest-null commitment: verdicts are
> published in `docs/spikes/` regardless of outcome. Any FAIL demotes the
> corresponding rule from CI-gate to advice-tier **in the shipped
> default**, permanently documented.

- [x] **S0.1 N+1 detection spike** (`spike_n1_detect`): 20 hand-built
  fixtures (10 true N+1, 10 look-alikes incl. eager-loaded loops AND
  bounded-small-loop cases — a loop over a constant 3-element set is not
  N+1; council round 2).
  PASS: ≥9/10 TP, ≤1/10 FP. FAIL → R-A1 ships review-guidance only.
  *Verify:* spike run output committed to `docs/spikes/`.
- [x] **S0.2 index-parity spike** (`spike_index_parity`): statically join
  query surface to migration schema on Eloquent + Prisma fixtures.
  PASS: ≥80% of WHERE columns resolved. FAIL → R-A2 degrades to FK-only.
  *Verify:* resolution rate published.
- [x] **S0.3 migration-lint spike** (`spike_migration_lint`): raw-SQL
  adapter over 15 unsafe-migration fixtures. PASS: 15/15 detected, zero
  parser crashes on a ≥50-file real-world migration harvest.
  *Verify:* fixture matrix + harvest crash count published.
- [x] **S0.4 audit-coverage spike** (`spike_audit_coverage`): given a
  declared audit scope, detect mutation call sites lacking audit emission
  in a multi-file fixture repo. PASS: recall ≥0.9 at precision ≥0.8.
  *Verify:* precision/recall published.
- [x] **S0.5 offload-detection spike** (`spike_offload_detect`): F9/F11
  catalog detection on 20 fixtures per stack incl. look-alikes
  (already-queued jobs, calls inside listeners, waivers).
  PASS: ≥9/10 TP, ≤1/10 FP per stack. FAIL → R-A8/R-A10 advice-tier.
  *Verify:* per-stack TP/FP table published.
- [x] **Spike verdict record**: one `docs/spikes/` summary mapping each
  verdict → rule tier (CI-gate vs advice) shipped as default.
  *Verify:* every R-rule's tier traces to a spike verdict or an explicit
  "not spike-gated" note.

## Phase 1 — Raw-SQL migration linter (smallest defensible wedge)

> Framework-agnostic, highest determinism, no ORM adapter risk. Ships
> behind `packs: [scale-discipline]`, default off.

- [x] **`lint_persistence` substrate + `adapter-raw-sql`**: R-A6
  (migration-safety) + R-A7 (growth-budget) checks; waiver syntax with
  required reason text.
  *Verify:* linter runs clean on its own fixture suite; unit tests green.
- [x] **Rule fixtures**: ≥12 fixtures covering R-A6/R-A7 violation + pass
  + waiver cases.
  *Verify:* fixtures assert both directions (violation detected, valid
  code passes).
- [x] **Pack surface**: `scale-discipline` pack registration (routing rule
  + pack frontmatter), default off; docs/wedge entry.
  *Verify:* discovery/CI checks green; pack not active by default.

## Phase 2 — Eloquent adapter + async rules

> Gated on S0.1/S0.2/S0.5 verdicts. Rules demoted per Phase 0 results.

- [x] **Source sweep (A + B)**: fresh-clone source-level sweep of Source A
  and Source B; license check; borrow-with-attribution vs rebuild decision
  recorded (identities stay in the local inbox archive; tracked record
  uses Source A/B).
  *Verify:* decision note committed (anonymized), license verdict stated.
- [x] **`adapter-eloquent`**: R-A1 (query-shape), R-A2 (index-parity),
  R-A3 (bounded-reads) detection per spike-verified mechanisms.
  *Verify:* spike fixture suites pass at ≥ pre-registered thresholds.
- [x] **Async rules in adapter**: R-A8 (thin-request-path, offloadable
  catalog as config), R-A10 (durable-async), R-A11 (commit-ordering).
  *Verify:* S0.5 fixture suite passes; catalog is config data, not code.
- [x] **False-positive verification pass**: run the adapter against ≥1
  real-world Laravel codebase (local consumer repo or public harvest);
  FP rate ≤5% or findings triaged with rule fixes.
  *Verify:* FP report committed.
- [x] **R-A9 event-decoupling**: ships advice-tier only; promotion
  requires a falsifiable detection proposal.
  *Verify:* advice-tier emission exists; no CI-gate path.

## Phase 3 — history-discipline pack

- [x] **Pack rules R-B1–R-B5**: one routing rule + normative tier matrix
  (R-B2) + hygiene/privacy/reliability interlocks, default off.
  *Verify:* discovery/CI green; R-B2 matrix normative (Tier-3 waiver
  required, default Tier 1).
- [x] **`skill: history-design`**: walks the R-B2 matrix; outputs tier
  decision + rationale artifact. Tier-1 reference implementations
  documented for Laravel (pick ONE of spatie/activitylog vs
  owen-it/laravel-auditing after source-level comparison — maintenance
  cadence, index defaults, pruning support; document the loser and why)
  and TS (thin custom audit-table pattern, no dependency).
  *Verify:* skill passes lint-skills; package comparison recorded.
- [x] **`skill: schema-review`**: invoked on migration diffs; runs
  lint_persistence, emits indexed gap table + waiver-density report.
  *Verify:* skill passes lint-skills; sample output committed as fixture.
- [x] **F8 audit-coverage check** in lint_persistence (per S0.4 verdict
  tier).
  *Verify:* S0.4 fixture suite passes at threshold.

## Phase 4 — Pre-registered bench (claims-ledger gate)

> Mirrors the honesty-bench pattern: design + corpora + harness are cheap
> and committed now; any PAID run stays behind the standing
> benchmark-spend authorization gate.

- [x] **Pre-registration committed before any data**: task = agent builds
  a small SaaS admin module (CRUD + list endpoint + audit requirement +
  mandated side effect "notify the owner by email on status change" — the
  F9/F10/F11 honeypot: inline vs fire-and-forget vs durable-after-commit
  — PLUS one **legitimate-sync distractor**: a cheap inline call that must
  NOT be queued, so over-application is measurable, not just
  under-application; council round 2).
  3 arms (A: no packs / B: packs advisory / C: packs CI-gating),
  ≥2 model families, reported per family, never averaged (Source E).
  Scoring: the **independent manual rubric is primary**; lint_persistence
  is secondary verification (measures linter recall/precision against the
  rubric) — no linter-grades-its-own-homework.
  Metrics: F1/F2/F3/F6/F7/F9/F11 defect counts, audit coverage %, token
  overhead, wall-clock, latency AND correctness (an arm that queues
  everything but loses the email scores worse than inline-sync).
  Thresholds: pre-registration includes a **power analysis** — N per arm
  is sized to detect the target effect at the registered confidence
  (N=10 floor; if underpowered for p<0.01, raise N or register the
  achievable confidence honestly — never post-hoc; council round 1).
  Publish lift only if Δ(defects A→C) clears the registered threshold AND
  token overhead ≤1.3×; otherwise honest null, packs stay default-off,
  roadmap re-scoped.
  *Verify:* pre-registration file committed before the first scored run.
- [x] **Bench harness + scoring committed**: seeded schema, honeypot task
  spec, scoring rubric, per-family reporting.
  *Verify:* harness runnable end-to-end on a dry (unpaid) smoke input.
- [x] **Run gate**: the first PAID scored run requires the standing
  benchmark-spend authorization (blocker carried from the council
  roadmap); until then everything above is committed, runnable
  infrastructure.
  *Verify:* spend gate referenced; no paid run without it.

## Phase 5 — TS adapter (Prisma) + projection scoping

- [x] **`adapter-prisma`**: schema.prisma parsing for R-A2 (index-parity:
  `@@index`/`@unique` vs relation/filter surface) + R-A7 (growth-budget on
  append-only models); minimal scope, drizzle/typeorm deferred until
  demand signal.
  *Verify:* Prisma fixture suite green.
- [x] **Projection scoping**: consumers without a persistence layer
  receive zero tokens from either pack; verified with the deterministic
  projection verifier (9.0.0).
  *Verify:* projection verifier output for a no-persistence consumer
  fixture shows zero pack tokens.

## Risks / open questions

- **Skill-file regression risk** (Source E): more guidance can lower
  output quality for some model families. Mitigation: bench reports per
  family; regression in any family is reported, not averaged away.
- **Overlap with Source A/B**: fresh-clone sweep before Phase 2;
  borrow-with-attribution where licenses permit, rather than rebuild.
- **Waiver abuse**: reason text required + waiver density reported.
- **Async over-application**: R-A8 must not push agents into queueing
  trivially cheap work — the offloadable catalog is a positive list of
  expensive call classes, not "everything but the DB write". The bench
  punishes over-queueing that loses correctness.
- **Infra assumption**: durable queues presuppose a broker. R-A10 degrades
  gracefully: DB-backed queue driver or a documented accepted-loss waiver
  — never a silent in-process fallback.
- **Adoption interaction**: this vertical is consumer-value-facing and
  could headline the still-unposted launch announcement ("keeps your
  AI-built app from falling over at 10k rows") — ONLY after the Phase 4
  bench. Do not front-run.

## Acceptance summary (pre-registered)

| Gate | Criterion |
|---|---|
| Phase 0 exit | 5 spike verdicts published; rules demoted per results |
| Phase 1 exit | migration linter: 0 crashes on the migration harvest, fixtures 100% |
| Phase 2 exit | FP-verification ≤5% on a real-world codebase |
| Phase 4 exit | pre-registration + harness committed; paid run spend-gated |
| Vertical "done" | packs installable, default-off, docs/wedge artifact, zero unbacked claims |

## Council notes

AI council debate 2026-07-27, 2 rounds, anthropic/claude-sonnet-4-5 +
openai/gpt-4o (actual cost $0.12). Round 1 split: one member attacked the
draft as "determinism theater" (F9/F11/F2 need business context; waivers
admit judgment; N=10 underpowered at p<0.01; honeypot too easy; suspected
linter-grades-itself circularity) and proposed shipping only F1/F3/F6/F7.
Round 2 converged — both members: waiver-based pattern detection is the
industry-standard model (Clippy `unwrap_used`, ESLint `no-console`); the
correct claim is "deterministic pattern detection + auditable exception
process", not context-free certainty; the honest-null bench design already
self-corrects if packs are redundant. Adopted refinements:

1. **Terminology**: "Deterministic?" → "Pattern-detectable?" with the
   waiver-model definition stated up front. No rule claims judgment the
   linter does not have.
2. **Bench power analysis pre-registered**: N sized to the target effect;
   registered confidence stated honestly if N=10 floor is underpowered.
3. **Manual rubric primary** in bench scoring; linter is secondary
   verification (recall/precision vs rubric) — anti-circularity made
   explicit.
4. **Legitimate-sync distractor** added to the bench task so
   over-application (queueing cheap work) is measured, not only
   under-application.
5. **Waiver density reported neutrally** — informed-exceptions vs
   rule-misfit, both readings stated.
6. **S0.1 fixtures** include bounded-small-loop look-alikes.

Rejected (with reason): "ship only F1/F3/F6/F7, drop the rest" — the
phase ordering already ships the most deterministic wedge first
(Phase 1 = F6/F7 raw SQL), and every contextual rule is spike-gated with
a pre-registered demotion path; the maximalist cut would also discard the
F8 audit vertical the feedback explicitly asked for. Session artefacts:
`agents/runtime/council/responses/scale-history-discipline/` (local-only,
auto-pruned).
