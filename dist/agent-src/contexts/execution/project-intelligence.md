# Project Intelligence — Evidence v2 self-building context (capture auto, trust gated)

Definitional spine for **Evidence v2**: agent builds project- (and optionally user-)
context *while working*, so the next agent starts smarter. Additive on the v1
[`evidence-discipline`](evidence-discipline.md) — weakens **no** v1 invariant. Loaded
alongside the v1 spine by [`source-discovery-gate`](../../rules/source-discovery-gate.md);
executable Class-A procedure is [`standards-from-config`](../../skills/standards-from-config/SKILL.md).

## The one guiding principle

```
CAPTURE MAY BE AUTOMATIC. TRUST AND COMMIT NEVER.
SELF-IMPROVEMENT AND SELF-REINFORCEMENT ARE THE SAME MECHANISM —
THE ONLY DEFENSE IS THAT NOTHING SELF-WRITTEN IS DURABLE, TRUSTED, SHARED TRUTH
UNTIL EVIDENCE OR A HUMAN CONFIRMS IT.
```

v1 trust-tiering pulled one level up: in v1 a card's *positive structure* is a
hypothesis; in v2 a *learned lesson about the project or the user* is equally a
hypothesis. Both are leads, not truth.

## Three context classes — different problems, different validation

Not one promote-from-intake flow. A/B/C are three problems with different validation
logic and storage; the human promotion gate may be unified, the validation rules are not.

| Class | Question | Evidence source | Problem type | Trust | Storage |
|---|---|---|---|---|---|
| **A — configured convention** | what standard is enforced? | the real config file | derivation/parse (deterministic staleness) | high (config-derived) | `agents/settings/contexts/` standards card — pointer+digest, auto-refresh |
| **B — observed convention** | how is this usually built? | ≥N real files | statistical/sampling (decays as code evolves) | medium — lead, confirm against code | `curated/conventions/` (% match) |
| **C — learned lesson** | what recurred as a mistake? | a real failure (test/error/revert) | causal inference (needs counter-evidence) | lowest — intake until curated | `curated/lessons/` (symptom/hypothesis + history) |

Fixed lines: **A is derived evidence** (the config *is* the standard; card is
pointer+digest, never a flattened claim — conflicts surface as two pointers). The
*convention* of an endpoint is Class B and card-able; the **concrete shape of a
concrete endpoint stays v1** — read fresh, never cached.

## The self-building loop

```
OBSERVE  →  write INTAKE  →  (human promotion gate)  →  commit CURATED
(auto)      (auto, gitignored,    (existing /memory flow,    (shared truth,
             low-trust)            user-confirmed)             team-visible)
```

Agent MAY *suggest* an intake signal in its reply ("I notice X — record as
context?") but never treats it as fact and never silently commits
([`scope-control`](../../rules/scope-control.md): create/draft ≠ commit). Intake
*grows* automatically; only the step to trusted, shared truth is human.

## Memory tiers — three, not two

| Tier | Home | Tracked? | Holds | Promotes? |
|---|---|---|---|---|
| **ephemeral** | `agents/memory/ephemeral/` | gitignored | trial-and-error, transient failures, task-local hypotheses; retained N days | **never** |
| **intake** | `agents/memory/intake/` | gitignored | *generalizable* observations — promotion candidates only | via human gate |
| **curated** | `agents/memory/<type>/*.yml`, `agents/settings/contexts/` | tracked | human-promoted shared truth | (is the promoted state) |

Trial-and-error and transient state go to **ephemeral** (never promoted), keeping the
intake promotion queue free of per-session noise. Only generalizable observations reach
intake.

## Class B — verifiability boundary, static-consensus, deviation-staleness (council 2026-06-16)

A dogfood eval (claude-sonnet-4-5 + gpt-4o, design mode, 2 rounds) surfaced a trap
and re-framed how Class B is built:

- **Linter-enforced ≠ observed.** A convention the tooling *enforces* (required
  sections, frontmatter keys) is a **Class-A constraint**, not Class-B — capturing
  it as B is double-counting; a careful agent reaches it by running the linter.
  **Class B is only for conventions the tooling does NOT enforce** (response-shape
  `{data, meta}`, `config/` not `configs/`, test-description phrasing, section
  *ordering* the linter ignores). Verifiability is the boundary: prefer
  mechanically-checkable; gate subjective ones behind higher evidence
  (`observed_n ≥ 10`).
- **Problem is consensus-detection, not capture.** "How is this usually built?" is
  answered by a **static-analysis consensus pass** over the real codebase ("87% of
  test files are `*.test.ts`"), human-curated to the dominant pattern — not by an
  agent free-writing observations into intake.
- **Staleness = deviation metric (not a calendar).** Re-run the consensus pass on a
  cadence / in CI; when dominant pattern's share drops below threshold (e.g. 87% →
  < 70%), flag for re-review. Cheap, evidence-grounded, no background daemon.
- **Auto-capture loop is deferred.** Agent-driven capture→intake loop is **not** built
  on current evidence (eval was invalid for B — it tested a Class-A constraint). Gated
  on a re-run with a *discriminating* non-linter convention. Static-consensus pass
  banks most of the cost win without accumulation risk. Re-evaluate only if
  static-consensus proves insufficient.

## Class B storage + the human gate's teeth

Curated Class-B conventions under `agents/memory/curated/conventions/` with:

- **Two-stage split** — freshly captured/consensus-derived convention lands in
  `quarantine/` (not yet agent-readable); human promotes to `approved/`
  (agent-readable). Auto-derived noise never reaches agent context before review.
- **B-specific validation** (statistical, not causal): each convention carries
  `observed_n`, `dominant_share`, `confirm_against` (sibling/code to check before
  relying on it). Separate validation logic from Class-C lessons.
- **Gate teeth:** promotion shows original-vs-derived diff + deviation metric;
  convention below consensus threshold cannot be promoted.

## Class C — learned lessons (the safety spec; accumulation layer eval-gated)

Riskiest class: an *inference* about why something went wrong. **Accumulation layer**
(agent writing lessons into intake during normal work) is **NOT built** until a 3-arm
eval shows accumulated context lowers error rate at acceptable cost on a
*discriminating* task. What IS specified now is the **shape a lesson must take** so
it cannot calcify a wrong belief.

### Evidence ≠ diagnosis (the core split)

A lesson has two parts with different trust:

- **`symptom` (durable-ish, falsifiable):** *what* really went wrong — real error
  text, failing test name, reverted commit SHA. Timestamped, cited.
- **`hypothesis` (inference, low-trust, decaying):** *why* — agent's causal theory.
  Marked a hypothesis, **never** a durable lesson, until repeatedly confirmed. A
  wrong cause-theory must never harden into superstition.

Card holds symptom as fact, diagnosis as hypothesis. Human promotion gate confirms
the *causal claim*, not just "did the symptom happen".

### Test-tracking history (makes anti-calcification enforceable)

Decay language without test-tracking is unenforceable. Each lesson carries:

```yaml
lesson:
  symptom: "<real error / failing test / revert>"
  hypothesis: "<causal theory — low trust>"
  confidence: 0.0-1.0
  history:
    - { date: YYYY-MM-DD, event: confirmed | not_applicable | counter_evidence, context: "<task/where>" }
  decay:
    no_confirmation_for_days: 90      # → demote to hypothesis
    counter_evidence_ratio_gt: 0.3    # ≥30% disconfirmations → demote
```

`event` logged when a *situation the lesson claims to govern* recurs:
`confirmed` (claim held), `not_applicable` (situation changed — lesson no longer
governs), `counter_evidence` (claim failed). Absence of recurrence is **not**
confirmation.

### Anti-calcification check

Curated lesson that hits either decay trigger (`no_confirmation_for_days` or
`counter_evidence_ratio_gt`) is **automatically demoted to hypothesis** — by a
periodic pass / CI step, wired alongside the accumulation layer if it ships.
Self-improvement requires forgetting; without demotion, lessons rot into noise.

### Subject-not-person privacy floor

```
MISTAKE-LESSONS DEFAULT TO PROJECT-LOCAL AND SUBJECT-BASED, NEVER PERSON-BASED.
"THIS MODULE IS OFTEN WIRED WRONG" — NOT "PERSON Y MAKES MISTAKES".
```

Person-scoped lessons only on explicit operator request, and only in the
global/user-own scope (never a committed team repo by default). Person-based
mistake tracking in a shared repo has a social dynamic the operator must opt into
deliberately, never silently.

### The existence gate (why the accumulation layer is deferred)

`Self-improving` is a hypothesis, not a law — accumulated context can *raise* the
error rate. Accumulation layer ships only if a 3-arm eval (no-context / v1 /
v2-accumulated) on a *discriminating* task shows it lowers error rate at acceptable
cost. Kill-criterion: if it does not, layer is not built and agent runs v1 + Class A
(the rollback target in [`evidence-discipline`](evidence-discipline.md)). Eval
requires real multi-task spend and valid (non-saturated) task design.

## The v1↔v2 isolation contract (the load-bearing guardrail)

```
CURATED v2 CONTEXT IS READ FOR HEURISTICS ONLY — NEVER TO BYPASS A FRESH STRUCTURAL READ.
v2 CONTEXT SKILLS ARE WRITE-ONLY INTO INTAKE. A STRUCTURAL CLAIM STILL REQUIRES A
FRESH SOURCE PER v1, REGARDLESS OF WHAT CURATED CONTEXT "KNOWS".
```

Dominant failure: once something is in `curated/`, agent has no incentive to re-check,
and v2's cached claims contaminate v1's read-fresh discipline. Defense is behavioral,
enforced by skill design (not a deployment boundary): v2 context informs *where to
look* and *what to expect* (heuristics), but field/endpoint/column/value is still
confirmed against a live source this session. Class A is the one high-trust class,
and even it is read for heuristics, never to skip a structural read.

## Redaction on every intake write

```
THE PRIVACY REDACTOR RUNS ON EVERY INTAKE WRITE, BEFORE THE FILE IS CREATED.
A HALT-TRIGGER BLOCKS THE WRITE — IT DOES NOT SILENTLY SCRUB-AND-CONTINUE.
```

v1 regex-denylist redactor (`low-impact-corpus-privacy-floor` +
`source-confidentiality`) gates every intake write. On a hit it **blocks** the write
and surfaces the offending pattern; never silently rewrites. Promotion review shows
original-vs-redacted diff so a human sees what was scrubbed.

## Multi-agent concurrency

Parallel agents share one project tree. Intake writes therefore:

- carry an **agent-id / random suffix** in filename (no overwrite of another agent's
  pending intake);
- pass a **promotion conflict check** — human promotion flow surfaces near-duplicate /
  conflicting pending intake from other agents for human resolution rather than
  last-write-wins.

## Context budget + prioritisation

Accumulated context can make the agent *worse* — token cost, contradiction,
unreviewable queue. Quantitative ceilings (starting values, tune on evidence):

| Bound | Start | Over-budget action |
|---|---|---|
| total curated size (A+B+C) | ~50 KB | lowest-confidence / oldest items expire or need re-review |
| pending intake queue | ~20 | block new intake until queue drains |
| Class A budget | unlimited | deterministic, low-entropy |
| Class B per domain | ~10 conventions | demote the weakest by % match |
| Class C active lessons | ~5, sorted by confirmation count | demote the least-confirmed |

v2 must never become a write-only structure that grows forever.

## v1→v2 migration

When v2 ships, existing v1 context-documents are **not** silently re-trusted. They
keep their v1 semantics (present-state snapshots a human curates); v2 adds A/B/C-tagged
classes *alongside* them. No existing card's trust level changes without an explicit
human pass — trust-semantics change cannot silently corrupt an existing project's
evidence base.

## Global promotion (A/B/C) — reuse the measure-then-decide gate, never auto

No new mechanism: global promotion reuses the ADR-100 / **ADR-103** gate
(`knowledge.global_sharing`, **default-off until cross-project reuse is measured
across ≥ 2 real projects**; `record-seen` sightings are the instrument).

- **Class A / B (conventions):** project-local committed by default. Global only when
  the *same* convention is empirically reused across ≥ 2 projects — **manually
  promoted, never auto**, through the measure-then-decide gate, same privacy floor
  (slugs / subject only, never contents / persons).
- **Class C (lessons):** global only for cross-project **subject** lessons. Same gate,
  same floor. Killing the global layer never kills project-local lessons (v1 F-5 holds).
- **Suggestion-gated, always.** Agent may *surface* a promotion candidate; human
  decides. **No runtime self-modifying trusted store** — global store stays file-first,
  leads-only cache (ADR-100 Decision-3).

## Reaffirmed v1 invariants (v2 weakens none)

1. No build-input, no source of truth — v2 context is lead + negative-fact memory.
2. Evidence stays mandatory — a convention/lesson points at real evidence (config,
   ≥N files, real failure), never "I noticed once".
3. Trust-tiering holds — self-written is hypothesis until evidence/human confirms;
   Class A is high-trust *because* config-derived.
4. Honest enforcement — the self-capture log is instrumentation; the teeth are
   pointer-CI + eval gates + human promotion gate.
5. No auto-commit, no auto-promote, no runtime self-modifying trusted store.

## See also

- [`evidence-discipline`](evidence-discipline.md) — the v1 spine v2 builds on.
- [`standards-from-config`](../../skills/standards-from-config/SKILL.md) — Class A procedure.
- [`source-discovery`](../../skills/source-discovery/SKILL.md) — v1 read-fresh (Class A/B/C never bypass it).
- [`context-document`](../../skills/context-document/SKILL.md) — parent context mechanism + storage.
