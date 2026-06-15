---
complexity: structural
status: ready
---

# Roadmap: Evidence-first structure discovery

> The product is a **discipline**, not a knowledge database: no claim about a
> structure without evidence from a real source. A "knowledge card" is only an
> optional cache for *expensive* evidence — never a source of truth, never a
> build input.

**Trigger:** User asked that the agent, *before* coding, always inspect the
real structures it is about to work with — API docs / GraphQL schema / test
calls; DTOs / Models / Entities; live DB schema (tables, fields, relations,
keys, filter/sort/group); and, for vendor dependencies, their docs from
GitHub / GitLab / NPM / plugin homepages — so it stops hallucinating fields and
running in the wrong direction. The original ask also wanted a maintained lean
knowledge layer kept **both** globally (per-user) and in the consumer repo,
with a usage registry and automatic "used in 2+ projects → promote to global".

**Mode:** Council-gated, four rounds. R1 took the four architecture forks; R2
challenged the result against three external design drafts; R3 adjudicated two
external reviewers' refinements and resolved five forks; R4 (final pre-merge)
adjudicated the last precisions and hunted for integrity holes the added
precision introduced. The headline is the **evidence discipline**; the
global/registry layer is gated behind empirical reuse; cards are remote-only
with frontmatter trust-tiering. Every phase extends existing primitives
(`think-before-action`, `context-document`, `agents/settings/contexts/`, install
scopes, `size-enforcement`) over a parallel system.

> **Council convergence (2026-06-15, claude-sonnet-4-5 + gpt-4o, design mode, 4
> rounds).** **R1:** global layer + registry + auto-promotion rejected as
> runtime-shaped (re-opening the 2026-06-14 Layer-2 sunset); core-extension not
> a pack; lazy/manual refresh, no daemon/git-hooks; provenance on every
> artifact. **R2:** adopt the **discipline/invariant** headline (*no structural
> claim without evidence — file:line · SDL · migration · probe*); cards
> **remote-only**, local read **fresh**; trust-tier via **frontmatter tags**;
> the "stale pointers" objection is referential integrity → **pointer-CI**;
> L0–L4 are UX/doc guidance; global/registry → gated v2. **R3:** Discovery
> emits an **Evidence Report**; provenance on every item; missing structure →
> fixed flow; **honest enforcement** (self-log = instrumentation, teeth =
> pointer-CI + eval); L0–L4 descriptive-not-prescriptive; **F-1** no persistent
> bootstrap index (resolve fresh via `rg`/glob); **F-2** keep
> `anti-hallucination` (not `invariant`); **F-3** concrete card-worthy
> threshold; **F-4** eval early (Phase-1 smoke) + broad (per-surface variance);
> **F-5** Phase-4 measures only the global layer (killing global never kills
> cards). **R4** (final precisions, both greenlit commit): **P1 (must-fix
> before Phase 0)** — a card's *positive structure* is **never** "Verified"; it
> goes under **"Assumed (from card)"** until confirmed this session ("Verified"
> = confirmed-this-session OR durable card negative-facts/pointers only). **P2**
> — define "DB-not-in-codebase" (no repo migrations/models/app-code defining the
> schema AND not app-controlled); schema defined by app code (Mongoose/Prisma/
> Firestore) is in-codebase → local/read-fresh/no-card. **P3** — Evidence Report
> soft-capped ~10–20 decision-relevant facts. **P4** — negative-fact only after
> an **exhausted** search across all relevant sources (log searched/not_searched
> + a `revalidate_if` trigger); a negative-fact is a **current-state** fact, not
> a card-worthiness *decision*. **P5** — per-line `observed_at`/`source_version`;
> strict-mode content-compare CI + a multi-evidence git-ancestry consistency
> check in Phase 3. **P6** — invalidate session reads on `HEAD` change and
> **fail-fast** mid git-op (rebase/merge/cherry-pick). **P7** — card-worthiness
> assessed on *intended* use at discovery (upgradable later) + a cross-feature
> duplication check. **P8** — full evidence-quality metrics stay a follow-up
> (only minimal counters in the Phase-3 eval). Plus a **documentation-burden**
> guard: Phase 0 ships Evidence-Report **template automation** so P1+P4+P5 stay
> usable. **YAGNI** (all rounds): confidence scores, promotion-score weights,
> evidence graph, 4-knowledge-kinds taxonomy.

## Goal

Make the agent **prove its structural facts before it plans or codes** — every
field, endpoint, column, and value it uses traces to a real source, surfaced in
a short **Evidence Report** (what we know vs what we assume) before the plan —
so it stops inventing structure. Cover the three external surfaces the user
named (**DB schema** — read fresh, local; **API / GraphQL shape** — probe +
confirm; **vendor-package docs** — fetched from the net, cached as a remote card
pinned to the installed version), persist *expensive* evidence as a **thin,
trust-tiered, sourced** card whose trusted core is its negative facts and
pointers, and **anchor into existing primitives** rather than fork a parallel
system.

## Scope line — what this roadmap is, and is not

- **In scope (v1, council-endorsed):** the evidence-discipline rule + the
  discovery skill, the Evidence Report + its template tooling, the enforcement
  layer (pointer-CI + eval; the self-log honestly framed as instrumentation),
  fresh local discovery (no persistent index), remote-only trust-tiered cards,
  and the project-committed anti-hallucination layer.
- **Gated v2 (Phase 4 — instrument, measure, decide):** the per-user **global**
  card scope, the **usage registry**, "where did I use X", and promotion —
  built only if v1 shows real cross-project reuse. Killing the global layer
  never kills the cards.
- **Follow-up (not this roadmap):** full evidence-quality metrics (P8); a
  persistent local resolution index (only if `rg`-latency is measured to hurt).

## Terminology — discovery, evidence report, card

- **Discovery** — the mandatory act of reading the real source before planning.
- **Evidence** — a concrete trace for a claim (`file:line`, SDL type, migration,
  probe response), each carrying `observed_at / source / version`.
- **Evidence Report** — the structured Discovery output (gitignored session
  scratchpad, overwritten each task, soft-capped ~10–20 decision-relevant
  facts), in three buckets:
  - **Verified** — confirmed **this session** against a real source, **or**
    durable committed-card content (negative facts + pointers, pointer-CI green).
  - **Assumed (from card)** — positive structural claims taken from a committed
    card but **not** confirmed this session; explicitly a hypothesis. *(R4 P1: a
    card's positive structure is never "Verified", even with a green pointer.)*
  - **Gaps** — missing evidence required for the decision (negative facts).
  It feeds the plan; it is **not** a forensic log and is **not** hard enforcement.
- **Knowledge card** — an *optional* cache of **expensive** (remote) evidence,
  trust-tiered, never a source of truth. Two homes:
  - **Ephemeral session cache** (gitignored): `agents/memory/knowledge/session/` — Evidence Report + raw probe/introspection output + the absence-search log.
  - **Committed card** (tracked): a thin distillation under `agents/knowledge/<source>.md` (or the `context-document` Integration home — Phase 1 decides). Durable content (`trust: durable`) = negative facts + pointers; positive structure is a per-line, last-verified hypothesis.

## Phase 0 — Enforcement foundations (what makes the discipline real — honestly)
- [ ] **Evidence Report format + the "Verified vs Assumed (from card)" rule (R4 P1, must-fix here):** define the three buckets above; a committed card's positive structure lands under **Assumed (from card)**, never Verified. Soft-cap ~10–20 decision-relevant facts (smell-test, not a hard gate). This term carries through every later phase, so it is correct here or nowhere.
- [ ] **Template automation (R4 burden-guard):** ship a small Evidence-Report generator/helper so producing the report (buckets + per-line provenance + absence log) is cheap; without it the discipline gets skipped. Demonstrated in the Phase-0 acceptance test.
- [ ] **Provenance on every evidence item** (`observed_at`, `source`, `version` where one exists), **per line** for card positive-structure (R4 P5). Within-session staleness via file **mtime**, **plus** invalidate all session reads when `git rev-parse HEAD` changes, and **fail-fast** if a git operation is in progress (rebase/merge/cherry-pick markers present) rather than read an intermediate tree (R4 P6 + hole-3). Across sessions, always re-read. No file hashing.
- [ ] Adopt the **two-file split**: committed card (durable negative facts + pointers) vs the ephemeral gitignored session cache (Evidence Report + probe dumps + absence log).
- [ ] Extend `size-enforcement`: card ≤ ~150 lines + mandatory authoritative pointer; **pointer-resolution CI** (local path exists; URL 200, cached weekly); plus a **multi-evidence consistency check** (a card with >3 evidence items must have its `source_version`s in one git-ancestry chain; flag if they span >7 days — catches cherry-picked/stale "Frankenstein" cards, R4 hole-2). A broken pointer fails CI — the deterministic referential-integrity fix.
- [ ] **Honest enforcement framing** (carry into the Phase-5 ADR): the Evidence-Report / `card_claims` self-log is **instrumentation**, not hard enforcement (a model that invents a field can write a false "verified"). The real teeth are **pointer-CI** (deterministic) + the **anti-hallucination eval** (empirical). Do not oversell the log.
- [ ] Confirm `agents/memory/knowledge/session/` is gitignored; decide the committed card home (recommend `agents/knowledge/`, `context-document` Integration as fallback).

## Phase 1 — The evidence-discipline rule + discovery skill (anchored) + early eval
- [ ] Author the core rule `src/rules/source-discovery.md` (type `auto`, tier 2b, triggers = coding intents + "new/unknown API" + "new vendor package" + "DB-driven work", `workspaces: [engineering]`): the Iron-Law invariant — *no structural claim without evidence; local before remote; real source before guessing* — gate-skip for trivial work (per `rdp-gate`). The drafts' Appendix-A artifact is the starting text.
- [ ] Author the skill `src/skills/source-discovery/SKILL.md` (the procedure; emits the Evidence Report; hand-off target from `think-before-action`). The drafts' Appendix-B artifact is the starting text.
- [ ] Extend `think-before-action`: one-line "minimum read set" pointer — "external/expensive structure → `source-discovery`" — no body duplication (kernel-rule edit per `kernel-rule-edits`, own PR, soak).
- [ ] Extend the `context-document` skill: register the knowledge card as a specialized context type + its storage paths — the card mechanism **extends** `context-document`, not a second system.
- [ ] **Local structure resolution — NO persistent index (R3 F-1):** resolve name→path **fresh** via `rg`/glob each lookup, then read the file fresh; honor the git-op fail-fast from Phase 0. Record the persistent-index-with-validity-check design as a deferred optimization, built **only if** a measured `rg`-latency problem appears on large monorepos.
- [ ] Encode **L0–L4 as documentation only** — descriptive (human shorthand), **not** prescriptive: the same evidence rules apply at every tier; no enforced state machine, no per-tier evidence relaxation.
- [ ] **Smoke-eval at the end of this phase (R3 F-4):** one fixture task, discovery-off vs discovery-on, for an empirical signal that the discipline reduces invented fields **before** building Phases 2–3. Cite the result; **a null signal stops the roadmap** for reconsideration.

## Phase 2 — Surface coverage (local read-fresh; remote cached)
- [ ] **DB schema (in-codebase = local, read fresh — no card):** extend the `database` skill to dump tables, columns, types, primary/foreign/unique keys, indexes, relations and derived filter/sort/group-ability to the **session cache** with provenance, framework-neutral (MySQL/Postgres/SQLite; ORM-agnostic) per `framework-neutrality-in-generic-skills`. **In-codebase** = the schema is defined by repo migrations/models/ORM/app code (incl. schemaless stores like Mongoose/Prisma/Firestore rules) → always local/fresh. Migration = intended truth, live DB = actual; divergence is a drift signal. Only **negative facts** graduate to a committed card.
- [ ] **Missing data → fixed extension workflow (R3 R-C + R4 P4/hole-1):** (1) search → (2) not found → (3) record the **absence-search log** with `searched` *and* `not_searched` sources; a **negative-fact card is written only after the search is exhausted across all relevant sources** for that claim, with a `revalidate_if` trigger (e.g. "an OpenAPI spec / contracts dir is added"). A negative fact is a **current-state** fact ("searched X, didn't find X") — **not** a card-worthiness *decision* (that belongs in notes/ADR, never an anti-hallucination card). → (4) negative-fact card (`type: anti-hallucination`, `polarity: negative`, `actionable`, `next_step`) → (5) codebase-fitting extension plan (migration + model/cast/factory/seeder), plan only, never silent execution (`scope-control`).
- [ ] **API / GraphQL shape (probe + confirm):** resolve OpenAPI/Swagger or GraphQL introspection from config/task; else a **read-only idempotent `GET` probe** (`jq`-reduced; never full dump, write/stateful, or prod without permission; secrets-aware per `security-sensitive-stop`). Positive shape is `trust: low` ("Assumed (from card)" if card-sourced) — confirmed against live before use.
- [ ] **Vendor / external-DB docs (card-worthy) — concrete threshold + intended-use framing (R3 F-3, R4 P2/P7):** card-worthy = **(external package / remote API / DB-not-in-codebase¹)** AND **(≥3 distinct methods/fields *intended* to be used OR the source has >50 total methods and ≥1 is used OR a prior hallucination on it OR local types/README insufficient)**. The threshold is judged on **intended** use at discovery (a card may be upgraded later if usage grows — so it is still built *before* coding). ¹ *DB-not-in-codebase* = a DB whose schema is **not** in the repo (no migrations/models/ORM/app-code) **and** not controlled by this app (vendor SaaS, partner, legacy). For card-worthy deps named in the task: local-first (`node_modules`/`vendor` README + types + **installed version = ground truth**) then net (NPM/Packagist/PyPI → GitHub/GitLab → homepage); **pin the remote ref to the installed version**, never blind `main`. Reuse `external-reference-deep-dive` + `markitdown`; honor `source-confidentiality`, `untrusted-input-defense`, `lethal-trifecta-guard`.
- [ ] Add the `knowledge-card` template `src/agent-src/templates/contexts/knowledge-card.md`: trust via frontmatter (`type: anti-hallucination` — NOT `invariant`; `trust: durable`), provenance (`origin/url/ref/version`), **per-line** `observed_at`/`source_version` on positive-structure lines, `links.authoritative` + `links.local`, positive structure explicitly a last-verified hypothesis.

## Phase 3 — Anti-stale verification + full anti-hallucination eval
- [ ] **Honest freshness signal:** a cheap check (installed-version mismatch OR `last_verified` older than N days) flips a card to "lead-only" — negative facts + pointers stay usable, positive structure must be re-confirmed. Green is **not** correctness proof; high-risk/irreversible steps verify regardless. No `content_hash` theater.
- [ ] **Strict-mode pointer-CI (R4 P5):** beyond Phase-0 path-existence, add an opt-in content-compare check (`git show`-based) for positive-structure lines so "file exists but content drifted" is caught; required for any Phase-4 global card.
- [ ] **Verification matrix wiring:** after acting on discovered structure, verify with the real tool (curl / Playwright / debugger / test runner / DB query) per `think-before-action`; any "Assumed (from card)" / `trust: low` line used without this-session confirmation is a violation surfaced post-task.
- [ ] **Full anti-hallucination eval (R3 F-4):** ≥1 fixture **per surface** (DB / API / vendor), each with a multi-run discovery-off **variance baseline** vs discovery-on; plus a **cross-feature duplication check** (R4 P7: if >1 session discovers the same external structure without a card, flag "should-have-been-card-worthy"); plus **minimal evidence counters** (R4 P8 seed: evidence_count / assumptions / verified — counters only, full metrics are a follow-up). Lands `evals/` fixtures; cite results — acceptance #6 rests on this, not n=1.

## Phase 4 — Global scope, registry, promotion (gated v2 — instrument, measure, decide)
- [ ] **Instrument only (v1-safe):** a minimal local usage counter for committed cards (which card, which repo-slug — never local paths/contents). Repo identity, not path; a monorepo = one project. No global write, no promotion yet. Privacy floor per `source-confidentiality` + `low-impact-corpus-privacy-floor`.
- [ ] **Measure the right thing (R3 F-5):** over 4–6 weeks, measure **cross-project** reuse — the only signal that justifies the **global** layer. Note that within-project card value (negative facts, committed) is already delivered in v1 and is **independent**: a near-zero cross-project number kills *global*, not the cards.
- [ ] **Decide against kill-criteria:** near-zero → **kill** global + registry + promotion, record in the ADR, stop (value stood in the discipline + project cards — acceptable). Real reuse → **spawn a follow-up roadmap** with council prerequisites: pointer-CI (incl. strict-mode) green, global cards are leads/negative-facts only (never build inputs), promotion **manual** (no auto "≥2", no score weights), a `forget`/inspect command, global store under the install `global` scope (`~/.event4u/agent-config/knowledge/`).
- [ ] Surface the decision + numbers to the user as the gate latch (no silent build-out).

## Phase 5 — ADR, guardrails, sync
- [ ] Record an ADR (via `adr-create`): the evidence-first invariant; the Evidence Report + the **Verified vs Assumed-from-card** rule; the card trust-tiering model; cards remote-only with local-always-fresh + no persistent index; the **DB-not-in-codebase** boundary (incl. schemaless clause); the **honest enforcement reality** (self-log = instrumentation; teeth = pointer-CI + eval); `anti-hallucination` kept over `invariant`; negative-fact = current-state-fact (not a decision); the discipline ships as a core extension; the global/registry **gate** + kill-criteria.
- [ ] CI/lint guardrails: session cache gitignored; committed cards pass `md-language-check`, `check-refs`, the size-bound + pointer-resolution + multi-evidence-consistency checks; new rule/skill pass `skill_linter.py` + frontmatter validation + framework-neutrality lint; rule tier correct per `rule-type-governance`.
- [ ] Update catalog/discovery surfaces and `see also` cross-references for the new rule, skill, template, and the `think-before-action`/`context-document` edits (per `augment-edit-discipline` sync Iron Law); regenerate derived projections via the documented sync flow.

## Acceptance criteria

1. On non-trivial structural work the `source-discovery` rule fires and the agent produces an **Evidence Report** (Verified / Assumed-from-card / Gaps, soft-capped) with a real source per claim **before** the plan; a committed card's **positive structure is filed under "Assumed (from card)", never "Verified"**, and is confirmed against the live source before use.
2. **In-codebase structure** (DTO/Model/Entity/DB whose schema is defined in the repo or by app code) is resolved **fresh** (`rg`/glob, **no** persistent index) and read fresh each task, with a git-op fail-fast; every evidence item carries `observed_at/source`; only **negative facts** (written only after an exhausted, logged search) graduate to a committed card.
3. **Remote/external** sources may be cached as a **trust-tiered** card per the concrete card-worthy threshold (judged on intended use): negative facts + pointers are `trust: durable` (frontmatter-tagged `anti-hallucination`, not `invariant`); positive structure is a per-line last-verified hypothesis; ≤ ~150 lines with a mandatory pointer; remote ref pinned to the installed version.
4. **Pointer referential integrity** is enforced in CI (path-existence in v1, content-compare strict-mode in Phase 3) plus a multi-evidence git-ancestry consistency check; the self-log is documented (ADR) as instrumentation, not enforcement; freshness is an honest trust-tier signal.
5. **No runtime / no global build in v1** — no daemon, no vector DB, no writable per-user store, no persistent local index, no git-hook refresh, no auto-promotion; Phase 4 only instruments + measures (cross-project reuse, gating **global only**) + decides; any global build is a gated follow-up.
6. ADR landed; a **Phase-1 smoke-eval** (null-signal stops the roadmap) plus **per-surface eval fixtures with a variance baseline** (DB/API/vendor) show discovery-on reduces invented fields vs discovery-off; all relevant lint/CI gates green.
