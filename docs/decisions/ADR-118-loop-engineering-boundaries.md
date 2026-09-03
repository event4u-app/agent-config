---
adr: 118
status: accepted
date: 2026-07-10
decision: loop-engineering-boundaries
supersedes: —
superseded_by: —
phase: loop-engineering
type: structural
---

# ADR-118 — Loop-engineering boundaries: one closure, four rejections, three deferrals, zero new loop surfaces

## Status

**Accepted** · 2026-07-10. Resolved by web research (five external articles + an
independent sweep) ground-truthed against the repo's loop inventory, plus an
AI-council debate (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
2026-07-10, converged). Executed by `road-to-loop-engineering`.

## Context

The June-2026 "loop engineering" wave (design the system that prompts the
agent: verification signal, budget shape, maker/checker topology, on-disk
state) is mostly a rebranding of ReAct + eval-driven development + bounded
autonomous agents. Its two durable contributions are the design vocabulary and
a precise failure-mode taxonomy: verification collapse ("done" is a claim, not
proof), comprehension debt, cognitive surrender, reward hacking (measured at
~15% of SE-task runs in one external evaluation), cost blowup on stuck retry
loops, context rot on long runs.

This package already implements the serious end of that canon: bounded
verify-fix loops (`verify-repair-loop` max_attempts=3, the N=3 validation
budget, context-hygiene 15/25 aborts), maker/checker separation (`judge-*`
cluster, `verify-budget`), human-gated self-improvement (5-stage pipeline,
≥2 independent evidence), and measurement infrastructure (bench:ab, trigger
evals, golden sets, orchestration telemetry, local analytics).

An inventory identified 8 places where a measure exists but no adjust-step is
wired. The question this ADR settles: which of those loops to close, and which
loop-shaped proposals to reject so they are not relitigated per hype cycle.

Constraint frame: single maintainer, token-frugality canon, no mandatory or
always-on daemon (ADR-088 / no-runtime-boundary as narrowed by ADR-249, which
permits a supervised resident process in core under four governance
conditions), human gates on anything irreversible. Under
these constraints, when human review + `git revert` is cheaper than designing,
maintaining, and debugging a closed loop, the loop is net-negative
infrastructure — false positives consume the binding resource (maintainer
attention), not compute.

> **Why this line was corrected by hand (2026-09-03).** It read "no runtime
> daemon" as an unqualified absolute after ADR-249 had already narrowed the
> property to "no *mandatory* or *always-on* daemon". Nothing caught it, and
> nothing could: `check_claims.ts` scans markered claims on five publish
> surfaces, and unmarkered ADR prose is outside that frame by design
> (`src/scripts/check_claims.ts:13`). An ADR asserting a retired absolute is
> therefore a manual fix by construction — worth stating here, because the
> absence of a gate is exactly what let the sentence survive the decision that
> falsified it.

## Decision

### 1. Automation threshold (the core principle)

Automate a measure→adjust loop **only** when all three hold:

1. the metric is a **direct** measure of the failure mode (not a proxy or a
   correlation),
2. the expected false-positive rate is low (order <5%), and
3. human judgment adds no unique information to the adjust decision.

"A number exists" is not "the number is trustworthy" (metric-existence
fallacy). Reversibility of the adjust-step alone never justifies automation:
investigating one false-positive automated action costs 20–45 minutes of
maintainer time against a 10-second revert.

### 2. Disposition of the 8 open loops

| # | Open loop | Disposition |
|---|---|---|
| 1 | Orchestration telemetry → `subagents.auto` demotion | **Manual by decision.** token_delta spikes for legitimate reasons; demotion needs qualitative judgment of the failure mode. The demotion path in `orchestration-benchmark-gate.md` stays a human one-line edit. |
| 2 | Artifact-engagement counts → skill pruning | **Never automated.** Selection bias both ways (low engagement ≠ low value: security / error-recovery / niche skills; high engagement ≠ high value). Engagement stays ONE input under `evidence-based-pruning`'s ≥2-independent-evidence floor; the pruning decision is always human. |
| 3 | Trigger-eval pass rate on cadence | **Closed** — the only closure. Structure/freshness/presence gates already ran in `task ci`; this ADR's roadmap adds a rotating live pass-rate measurement to the existing weekly canary (see §4). Direct metric, low false-positive, adjust-step = surfaced report. |
| 4 | bench-drift → blocking gate | **Stays advisory.** High false-positive proxy (timing variance, intentional behaviour changes); the manual `bench:baseline-ready` flip remains the enforcement gate. |
| 5 | Golden-set coverage ratchet (14/91 rules) | **Deferred; growth stays opportunistic.** A hard per-rule ratchet pressures toward mechanically-testable rules over useful rules; most uncovered rules are judgment-shaped. `road-to-golden-set-coverage` remains the deliberate path. |
| 6 | Live-app verdict source | **Deferred, unchanged** — owned by `road-to-live-app-verdict`; the package ships config, not apps. |
| 7 | Measured rule-adherence signal | **Rejected.** Annotated-corpus + threshold-tuning build with ongoing maintenance for marginally earlier restatement; ADR-054's coarse heuristics are intentional. |
| 8 | Success-signal re-evaluation at eval date | **Not automated.** Retroactive evaluation of sunk promotion decisions has low marginal information; active use surfaces bad promotions. The field stays authored documentation. |

### 3. Five written rejections (loop anti-patterns for this package)

1. **Open-ended hill-climbing on the config.** No loop may "optimize"
   rules/skills via iterated mutation + metric without a human checkpoint per
   iteration; the bench:ab soak + human decision is the floor for config
   change evaluation.
2. **Autonomous config self-editing.** The self-improvement pipeline stays
   human-gated at every stage; no loop commits changes to `src/skills/` or
   `src/rules/` without human approval. (Restates the existing pipeline
   contract as a loop boundary.)
3. **Unattended multi-hour runs without checkpoints.** Loops must remain
   reviewable/haltable on the maintainer's schedule; the existing halt
   conditions and N=3 budgets are the ceiling, not a starting point.
4. **Metric-optimizing loops without golden-set anchoring.** No loop whose
   success criterion is "metric goes up" without a golden-set eval anchoring
   what "good" means (Goodhart guard).
5. **Cross-session loop state in external services.** No vector DBs, job
   queues, or external orchestrators as loop state (restates ADR-088 in loop
   context): state lives in git-tracked files + the conversation.

Also rejected, same reasoning tier: a **loop-design contract/checklist
artifact** (premature formalization — the caps/judges/state patterns are
embedded in the existing loop surfaces and enforced by existing rules) and
**consumer-facing loop templates** (`/loop:design` et al. — scope creep;
agents answer loop-design questions in conversation using the package's
existing vocabulary). **No new loop surfaces**: no run-until-condition goal
command, no fresh-context re-loop mode for roadmap processing (bounded-scope
by design), no separate nightly self-check workflow (folded into the existing
weekly canary).

### 4. The one closure — periodic live trigger-eval pass rate

The existing weekly cross-model canary's secrets-gated live tier gains a
deterministic rotation over the skills that carry `evals/triggers.json`
(ISO-week keyed, ~5 suites/week), enforcing the per-domain precision/recall
floors from `eval:record`. A floor breach fails the **scheduled** job — the
failure is the maintainer notification; PRs are never blocked by live results.
The local interactive confirmation gate on `skill_trigger_eval` is untouched;
CI authorization derives exclusively from workflow-provided key secrets, and
the no-secrets path stays a logged no-op.

## Revisit-if

- **Any rejection above:** reopen only on evidence that closing the loop saves
  >2 h/month maintainer time in a structurally similar single-maintainer
  project (logged hours, not vibes) — via `decision-revisit-gate`
  mechanism-match, then council.
- **The §4 closure:** demote the canary pass-rate job to advisory
  (non-failing) if breaches are >~10% spurious over 50+ suite-runs.
- **§2 #5 coverage ratchet:** reconsider if ≥3 real regressions ship in rules
  that a golden task would have caught (counted, cited incidents).

## Consequences

- Future "should we automate X?" loop proposals test against §1 before any
  build; the disposition table is the precedent record.
- The weekly canary becomes the single periodic live-eval surface — additions
  to periodic self-checking extend it rather than adding workflows.
- Skill-pruning, default-demotion, and drift-blocking proposals cite this ADR
  instead of re-deriving the argument.

## Alternatives considered

- **Close more loops (coverage ratchet, engagement pruning, auto-demotion):**
  rejected — each fails at least one §1 criterion; the council's round-2
  convergence was explicit that "metric exists + reversible" is insufficient.
- **Loop-design contract:** rejected as compliance theater for a
  single-maintainer project; revisit on a second maintainer with real handoff
  friction.
- **Do nothing (pure documentation):** rejected — the trigger-eval pass-rate
  gap is real, direct-metric, and closable inside an existing workflow at
  near-zero maintenance cost.

## References

- `road-to-loop-engineering` roadmap (execution + provenance; external source
  links retained encrypted there per `source-confidentiality`).
- `docs/contracts/evidence-based-pruning.md` — §2 #2 anchor.
- `src/agent-src/contexts/execution/orchestration-benchmark-gate.md` — §2 #1 anchor.
- `docs/contracts/measurement-baseline.md` — §2 #4 anchor.
- ADR-088 (no external runtime), ADR-054 (adherence restate), ADR-106/-109/-117
  (orchestration gates), `docs/contracts/no-runtime-boundary.md`.
- Prior honest-nulls this ADR does not reopen: recursive-verification
  (2026-06-24), enforcement-projection, reminder-injection.
