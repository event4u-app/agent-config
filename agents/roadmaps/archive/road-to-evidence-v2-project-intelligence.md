---
complexity: standard
status: ready
---

# Roadmap: Evidence v2 — Self-Building Project Intelligence

**Trigger:** Two independent external reviews of the shipped Evidence v1
(anti-hallucination discipline: `source-discovery-gate` rule + `source-discovery`
skill + CI + eval + ADRs + global layer ADR-100) plus the operator's v2 vision
("while working, the agent should continuously build committed context that
helps the next agent — coding standards, module structure, endpoint shape,
recurring mistakes — and learn from context-based mistakes to improve the
project-local and/or global context"). Evidence captured in
`agents/tmp/evidence-v1-feedback.txt` and `agents/tmp/evidence-v2.txt`, plus a
detailed v2 design proposal in the latter.

**Mode:** Evidence-gated, remediation-first. Every accumulation unit carries an
**eval gate** (does accumulated context *lower* error rate vs. v1, at acceptable
cost?) **and** a kill-switch. The guiding split is fixed: **capture may be
automatic; trust and commit are always gated.** Self-improvement and
self-reinforcement are the same mechanism — nothing self-written becomes durable,
trusted, shared truth until evidence or a human confirms it.

> **Council convergence (2026-06-16, claude-sonnet-4-5 + gpt-4o, design mode,
> 2 rounds + anonymous peer-review).** Both members converged on five load-bearing
> moves, several of which revise the original v2 proposal:
> 1. **The A/B/C taxonomy is correct but incomplete.** A/B/C are not three trust
>    gradations of *one* promote-from-intake flow — they are three different
>    problems with different validation logic: **A = derivation/parse** (deterministic
>    staleness), **B = statistical/sampling** (decay when code evolves), **C = causal
>    inference** (hypothesis needs counter-evidence tracking). Forcing them into one
>    flow makes B too strict or C too loose. They need separate validation rules and
>    storage (`curated/conventions/` vs `curated/lessons/`); the human promotion gate
>    may stay unified.
> 2. **v1 must be remediated *before* any v2 accumulation is built** (Phase 0): a real
>    cost-measurement baseline, an *uncrippled* v1 eval (fair control = a normally
>    careful agent, not a prompt-crippled one), and the ADR-100 global layer flipped to
>    **default-off / opt-in** until cross-project reuse is actually measured — the gate
>    ADR-098 set and ADR-100 bypassed.
> 3. **The dominant risk is contamination between v1 read-fresh and v2 cached-claims.**
>    Once something is in `curated/`, the agent has no incentive to re-check. The fix is
>    a **behavioral isolation contract** (v1 `source-discovery` reads curated context
>    only for heuristics, never to bypass a fresh structural read; v2 context skills are
>    write-only into intake) — a discipline enforced by skill design, **not** a
>    deployment boundary. Splitting A/B/C into separate packages is over-engineering.
> 4. **One eval is theater; sequence three.** Synthetic (does *correct* hand-built
>    context help? if not, stop) → single-project dogfood of real accumulation →
>    3-arm production eval (no-context / v1 / v2-accumulated) across many projects,
>    measuring efficacy **and** cost. Each gates the next.
> 5. **Class C anti-calcification needs a real test-tracking schema**, not just decay
>    language: `symptom` (falsifiable) vs `hypothesis` (causal claim) + a `history[]` of
>    confirmed / not-applicable / counter-evidence events + decay triggers
>    (no-confirmation window, counter-evidence ratio → demote to hypothesis).
>
> Peer-review surfaced four additional gaps folded in below: an **ephemeral memory
> tier** (not everything that helps the next agent should be committed), a **context
> budget** (accumulated context can make the agent *worse* — token cost, contradiction,
> unreviewable queue), **redaction on every intake write** (block, not just scrub),
> **multi-agent concurrency** (intake naming + promotion conflict detection), and a
> **v1→v2 migration** path for existing context-documents.

## Goal

Turn `agent-config` from an anti-hallucination system into one that *also* builds
genuine, committed project experience — without re-introducing the drift source v1
spent four design rounds locking out. v2 ships as an **additive layer on v1**, reusing
the existing `context-document` + `agents/memory/{intake,curated}` machinery rather
than a new system, and is sequenced safest-first: the one risk-free, on-thesis win
(standards-from-config) first; the riskiest, accumulation-based layer (learned lessons)
last and behind the hardest eval gate. Phase 0 repairs the three v1-feedback debts so
the same "skipped its own gate" failure cannot recur in v2.

## Terminology — the three knowledge classes (the spine)

| Class | Question it answers | Evidence source | Problem type | Storage |
|---|---|---|---|---|
| **A — Configured convention** | "What standard does this project enforce?" | the **real config file** (`.editorconfig`, `eslint.config.js`, `pint.json`, `pyproject.toml`/`ruff.toml`, commitlint, CI lint steps) | derivation/parse — deterministic staleness | pointer + digest, auto-refresh |
| **B — Observed convention** | "How is this project *usually* built?" (module layout, endpoint shape, naming) | ≥N real files showing the pattern | statistical/sampling — decays as code evolves | `curated/conventions/`, % match + confidence |
| **C — Learned lesson** | "What recurred as a mistake here?" | a **real failure** (failing test, real error, revert) | causal inference — hypothesis needs counter-evidence | `curated/lessons/`, symptom/hypothesis + history |

Two lines are fixed and non-negotiable:
- **A is derived evidence** (the config *is* the standard; the card is only a pointer
  + digest, never a flattened claim — conflicts stay visible as two pointers, not hidden
  in one derived claim).
- The **convention** of an endpoint (kebab-case plural paths, cursor pagination,
  RFC-7807 errors) is Class B and card-able; the **concrete shape of a concrete
  endpoint** stays **v1** — read fresh / probe + confirm, never cached.

## Phase 0 — v1 remediation (no v2 accumulation until this lands)

The three v1-feedback debts are repaid first; they are also the baseline every v2 eval
measures against. No accumulation layer is built until Phase 0 is green.

- [x] **Cost-measurement baseline.** Extend the existing v1 eval harness to record
      tokens / turns / wall-time per task arm (not just `invented_fields`). Without a
      cost baseline there is no go/no-go for an always-on discipline.
      <!-- done: README Metrics→cost block + mandatory result-schema cost field (input/output tokens, turns, wall_ms) -->
- [x] **Uncrippled v1 eval + fair control.** Re-run the v1 eval with the control arm =
      a *normally careful* agent (drop the "fast first pass, do not explore the repo"
      crippling), and fixtures that are not exclusively trap-baited. Record whether v1
      discipline still helps a careful agent and at what cost. Document the honest delta.
      <!-- done: results/fair-control-2026-06-16.json — careful_control invented 0/3 (same as discovery_on); honest-null on marginal lift; re-targets v2 toward surfaces a careful agent skips -->
- [x] **Flip ADR-100 global layer to default-off / opt-in** (or `public`-only, `vendor`
      off) until cross-project reuse is *measured* — the ADR-098 gate ADR-100 bypassed.
      Keep the kill-switch; invert the default. Record the decision and the
      measure-then-decide condition in an ADR amendment.
      <!-- done: enabled true→false in template.yml + settings.ts + agent-settings.md; ADR-103 records the measure-then-decide (≥2 projects) gate; evidence-discipline § Global layer updated -->
- [x] **Define the rollback target.** State explicitly: v2 rollback = disable all
      curated context except Class-A config-pointers; v1 discipline (no accumulated
      context) is the measurable baseline to revert *to*.
      <!-- done: evidence-discipline.md § "Evidence v2 rollback target (Phase 0)" -->

## Phase 1 — Class A: standards-from-config (the safe, immediate win)

Read-only, high-trust, no accumulation risk. Built before any intake/learning machinery.

- [x] **NEW skill `src/skills/standards-from-config/SKILL.md`.** Distil coding standards
      from real tooling config. Output is **pointer + digest**, never a flattened claim:
      e.g. `ruff.toml → line-length=88 (scope: src/**/*.py)`, not "project uses line
      length 88". Scope-aware (per-directory / inline overrides preserved); **conflict
      surfacing** = emit two pointers with two values rather than one ambiguous claim.
      <!-- done: skill authored, skill_linter PASS (0 issues) -->
- [x] **Auto-refresh, drift-proof.** The card re-reads the config; the config is the
      truth. Staleness = config-file mtime/hash changed → re-derive. No human gate needed
      for A (deterministic), but the digest is regenerated, not hand-edited.
      <!-- done: skill Procedure step 4 + Output-format frontmatter sources:{path,config_mtime} + refresh line -->
- [x] **Register Class A in `src/skills/context-document/SKILL.md`** as a context type
      with `trust: high (config-derived)` and the pointer-not-claim contract.
      <!-- done: context-types table row + "Standards cards — Class A" subsection -->
- [x] **Eval (synthetic, Phase-1 gate).** Hand-build a fixture project with known
      tooling config; verify the agent writing code *uses* the derived standards and that
      a config change flips the digest. Class A is near-tautological (it should help) —
      this gates *mechanism correctness*, not the v2 thesis.
      <!-- done: internal/evals/standards-from-config/ fixture + synthetic-2026-06-16.json — pointer-not-claim ✓, conflict-surfaced ✓, config-derived-used ✓, drift-trigger ✓ -->


## Phase 2 — Guardrails: memory tiering + the isolation contract

The foundational safety rails that B and C depend on. Built before any auto-capture.

- [x] **Add an ephemeral memory tier.** `agents/memory/ephemeral/` — auto-captured,
      gitignored, retained N days/tasks, **never promoted**. Trial-and-error, transient
      failures, task-local hypotheses live here, not in the intake→curated promotion
      queue. Intake is reserved for *generalizable* observations. This keeps the human
      promotion queue from drowning in per-session noise.
      <!-- done: gitignore-block.txt /agents/memory/ephemeral/ + project-intelligence "Memory tiers — three, not two" table -->
- [x] **The v1↔v2 isolation contract (the load-bearing guardrail).** Codify in
      `source-discovery-gate` + `source-discovery` that curated v2 context may be read
      **only for heuristics** (conventions, where-to-look hints), **never** to bypass a
      fresh structural read. v2 context skills are **write-only** into intake. A
      structural claim still requires a fresh source per v1, regardless of what curated
      context "knows". This is the single most-likely way v2 corrupts v1 — close it by
      skill design, not deployment isolation.
      <!-- done: source-discovery-gate Iron-Law block + source-discovery skill section + project-intelligence "isolation contract" block; load_context wired -->
- [x] **Redaction on every intake write.** The v1 regex-denylist redactor runs on
      *every* intake write *before* the file is created; a halt-trigger **blocks** the
      write (does not silently scrub-and-continue). Promotion review shows an
      original-vs-redacted diff so a human sees what was scrubbed. Closes the
      "Class-B auto-capture leaks a secret-in-pattern" gap.
      <!-- done: project-intelligence "Redaction on every intake write" contract block; the Phase-3 capture writer must obey it -->
- [x] **Multi-agent concurrency.** Intake filenames carry an agent-id / random suffix
      (no overwrite); the promotion flow detects near-duplicate / conflicting pending
      intake from other agents and surfaces it for human resolution.
      <!-- done: project-intelligence "Multi-agent concurrency" section (filename suffix + promotion conflict check) -->
- [x] **Context budget + prioritisation.** Quantitative ceilings so accumulation cannot
      degrade the agent: max curated size (start ~50 KB across A+B+C), max pending intake
      (~20), per-class budgets (A unlimited/deterministic; B ~10 per domain; C ~5 active,
      sorted by confirmation count). Over-budget → lowest-confidence / oldest items
      auto-expire or require explicit re-review. v2 must not become a write-only
      data structure that grows forever.
      <!-- done: project-intelligence "Context budget + prioritisation" table with start values + over-budget actions -->
- [x] **v1→v2 migration path.** Define what happens to existing v1 context-documents
      when v2 ships (frozen / re-ingested / deprecated) so the trust-semantics change
      cannot silently corrupt existing projects' evidence bases.
      <!-- done: project-intelligence "v1→v2 migration" section (v1 docs keep v1 semantics; no silent re-trust) -->

## Phase 3 — Class B: observed conventions (capture auto, commit gated)

Tests the actual v2 claim: do *observed conventions* (not just config digests) lower
error rate? Built on Phase-2 guardrails. Hand-curated arm proves value before any
auto-capture is built.

- [x] **Hand-curated arm first.** A human writes 3–5 Class-B intake suggestions for a
      real project (e.g. "API handlers return `{status, data}`", "modules own their own
      `agents/settings/contexts`") after observing patterns. No auto-capture yet.
      <!-- done: internal/evals/observed-conventions/fixtures/skill-conventions.md (hand-curated Class-B card, dogfood on this repo) -->
- [x] **Synthetic + dogfood eval (Phase-3 gate).** 3-arm comparison (no-context /
      v1-discovery / v1+hand-curated-B) on the fixture + one real dogfood project: does
      hand-curated B lower the error rate vs. v1 at acceptable cost? **If no → ship
      Class A only, kill Class B.** This is the gate that decides whether observed
      conventions are worth their token cost.
      <!-- done: results/dogfood-2026-06-16.json. GATE VERDICT (council, claude-sonnet-4-5+gpt-4o, 2026-06-16): eval INVALID for B — tested a linter-ENFORCED convention (Class-A constraint in disguise); correctness saturated (both 0), cost-lift was "pre-caching linter output". Gate malformed. Disposition: NARROW B → static-consensus + deviation-staleness; DEFER auto-capture; re-run on a non-linter convention before building the loop. -->
- [-] **Only on lift: auto-capture for B.** `source-discovery` proposes an intake signal
      when it sees a recurring convention ("I notice X — record as context?"), writes to
      intake (gitignored, low-trust), **never** treats it as fact, **never** silently
      commits (`scope-control`: create/draft ≠ commit). Promotion is the existing human
      `/memory` gate.
      <!-- moved → road-to-evidence-v2-accumulation-layer.md (draft) Phase 2. Lift was NOT shown for B (eval invalid — Class-A-in-disguise); council prefers static-consensus over an auto-capture loop and gates it on a discriminating (non-linter) re-run. Resolved here by spawning the follow-up. -->
- [x] **Staleness for B.** Curated conventions carry a `% match` + sample provenance;
      when the pattern no longer holds in sampled code (below threshold), the convention
      is demoted / flagged for re-sampling. B rots silently without this.
      <!-- done (reframed per council): project-intelligence "Class B — ... deviation-staleness" — static-analysis consensus pass + dominant_share threshold (e.g. 87%→<70% flags re-review), CI-cadence not calendar. This is the Class-B staleness mechanism AND the cheaper alternative to the auto-capture loop. -->
- [x] **Storage split.** `curated/conventions/` with B-specific validation
      (statistical-confidence rule), separate from Class-C lessons. Unified human gate,
      separate validation logic.
      <!-- done: project-intelligence "Class B storage + the human gate's teeth" — curated/conventions/ quarantine→approved two-stage split, observed_n/dominant_share/confirm_against validation, gate teeth (diff + deviation metric), separate from Class-C lessons. -->

## Phase 4 — Class C: learned lessons (gated behind the 3-arm production eval)

The riskiest layer — accumulation of *inferred* causes. Built last, only if the full
3-arm eval shows accumulated context nets positive. This is where self-reinforcement
of a wrong belief is the named failure mode.

- [x] **Evidence ≠ diagnosis schema.** A lesson separates `symptom` (the real,
      falsifiable failure — error text, failing test, reverted commit; durable,
      timestamped) from `hypothesis` (the agent's causal theory — low-trust, decaying).
      The card holds the symptom; the diagnosis is marked hypothesis, never a durable
      lesson. Wrong cause-theories must not calcify into superstition.
      <!-- done: project-intelligence § Class C "Evidence ≠ diagnosis" + lesson-card.md template (symptom=fact / hypothesis=theory sections) -->
- [x] **Test-tracking history (makes anti-calcification enforceable).** Each lesson
      carries a `history[]` of `{date, event: confirmed | not_applicable |
      counter_evidence, context}` and decay triggers — `no_confirmation_for: N days` →
      back to hypothesis; `counter_evidence_ratio > 0.3` → demote. "Decay language"
      without test-tracking is unenforceable; this schema is the mechanism.
      <!-- done: lesson-card.md frontmatter decay{} block + test-tracking history table; project-intelligence § Class C history schema -->
- [x] **Subject-not-person privacy floor.** Mistake-lessons default to project-local and
      *subject*-based ("this module is often wired wrong"), never *person*-based. Person
      scope only on explicit operator request, and only in the global/user-own scope —
      surfaced as a deliberate decision, never silently shipped.
      <!-- done: project-intelligence § Class C "Subject-not-person privacy floor" Iron-Law block + lesson-card.md subject:/scope: frontmatter -->
- [-] **3-arm production eval (Phase-4 gate, the existence question).** no-context /
      v1-discovery / v2-accumulated-context across 10+ tasks, measuring
      error/hallucination rate **and** cost. **Kill-criterion: if v2-accumulated context
      does not lower error rate vs. v1 (or cost rises disproportionately), the
      accumulation layer is NOT built** — v1's value stood alone, which is an acceptable
      outcome. "Self-improving" is a hypothesis, not a law.
      <!-- moved → road-to-evidence-v2-accumulation-layer.md (draft) Phase 1+3. The BUILD-the-accumulation-layer decision needs real multi-task spend + a discriminating (non-saturated) task design; both are the operator's call. Spec (P4.1/2/3/5) is built; the layer is gated in the follow-up. Resolved here by spawning the follow-up. -->
- [x] **Anti-calcification check wired to CI / a periodic pass.** A curated lesson not
      re-confirmed for X opportunities falls back to hypothesis automatically. Self-
      improvement requires forgetting.
      <!-- done (spec): project-intelligence § Class C "Anti-calcification check" — decay-trigger → auto-demote-to-hypothesis rule; lesson-card.md decay{} thresholds. The CI/periodic-pass wiring rides with the accumulation layer (deferred above); the rule + thresholds are specified now. -->

## Phase 5 — Global promotion (measure-then-decide, never auto)

Reuses the Phase-0 global-layer gate. No new logic.

- [x] **Class A/B global promotion** only when a convention is empirically reused across
      ≥2 projects — manually promoted, never auto, through the same measure-then-decide
      gate, same privacy floor (slugs / subject only, never contents / persons).
      <!-- done: project-intelligence § "Global promotion (A/B/C)" — reuses ADR-103 gate (default-off until ≥2-project reuse measured) -->
- [x] **Class C global promotion** only for cross-project *subject* lessons, same gate,
      same floor. Killing the global layer never kills project-local lessons (v1 F-5
      holds).
      <!-- done: same section — Class C global = subject lessons only, kill-global preserves project-local (v1 F-5) -->
- [x] **Promotion is suggestion-gated.** The agent may surface a promotion candidate;
      the human decides. No runtime self-modifying trusted store.
      <!-- done: same section — suggestion-gated, no runtime self-modifying trusted store (ADR-100 D-3 leads-only) -->

## What we explicitly do NOT build (scope discipline)

- **No new knowledge system.** v2 reuses `context-document` + `agents/memory/*`; it does
  not add a DB, vector store, daemon, or runtime.
- **No separate deployable A/B/C modules.** Logical separation in storage + validation
  only; the boundary that matters is v1-read-fresh vs v2-cached-trust (behavioral).
- **No auto-commit, no auto-promote, no auto-trust** of self-written context. Ever.
- **No flattened Class-A claims.** Pointer + digest only.
- **No person-based mistake tracking** in a committed team repo by default.
- **No accumulation layer (B/C) before its eval gate passes.** Null/negative signal
  stops that layer; Class A still ships.

## Reaffirmed v1 invariants (v2 does not weaken any)

1. No build-input, no source of truth — v2 context is lead + negative-fact memory only.
2. Evidence stays mandatory — a convention/lesson must point at real evidence (config,
   ≥N files, real failure), never "I noticed once".
3. Trust-tiering holds — self-written is hypothesis (`trust: low`) until evidence/human
   confirms; Class A is high-trust *because* config-derived, not because the agent likes it.
4. Honest enforcement — the self-capture log is instrumentation; the teeth are
   pointer-CI + the eval gates + the human promotion gate.
5. No runtime self-modifying trusted store.

## Acceptance criteria

- Phase 0 lands first: cost baseline recorded, uncrippled v1 eval run + documented,
  ADR-100 global default flipped to off/opt-in with the measure-then-decide condition
  written into an ADR amendment, rollback target stated.
- Class A ships as pointer-not-claim, scope-aware, conflict-surfacing, auto-refresh; its
  synthetic eval passes.
- Phase-2 guardrails (ephemeral tier, isolation contract, redaction-on-write,
  concurrency, context budget, migration path) land before any auto-capture.
- Class B auto-capture is built only after the hand-curated arm shows lift in the
  synthetic + dogfood eval; B carries staleness metadata.
- Class C is built only if the 3-arm production eval shows accumulated context lowers
  error rate vs. v1 at acceptable cost; it carries the evidence/diagnosis split + the
  test-tracking history + the anti-calcification pass.
- Every v2 context class is registered in `context-document` with its trust tag; no v1
  invariant is weakened; CI pointer-checks + the eval gates are the enforcement surface.
