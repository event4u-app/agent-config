# Self-Improvement Pipeline

Five-stage flow that turns real project experience into reviewed
rule / skill / command / guideline changes. Self-modification is a goal
(ADR-281, as amended 2026-10-07): for a proposal scoped to the package a
digest-bound AI council record is **required and is a review, not the
approval** — a council refusal fails closed, and a favourable verdict
recommends passage and stays advisory until the owner's authenticated
authorization is bound to the same digest. A change a user asked for keeps
that user's approval as now. A reviewed record makes a change ready, not
landed — every upstream change still ships via a PR.

Referenced by `road-to-curated-self-improvement.md`. Consumed by the live
artifacts — the `skill-improvement-trigger` rule and the existing skills
`learning-to-rule-or-skill`, `skill-improvement-pipeline`, and
`upstream-contribute` — each becomes a stage, not a standalone invocation.

## The five stages

```
Project event ── capture ── classify ── propose ── gate ── upstream
    │              │            │           │         │         │
 (bug,         learning-    scope:     proposal     human    upstream-
  success,     to-rule-or-  project-   doc          review    contribute
  review       skill        vs-        (full        +gate     PR
  pattern)                  package    evidence)    script
```

Each stage has a fixed input and a fixed output so the flow is
resumable and auditable. A stage that cannot produce its output
blocks — it does not hand a half-filled doc to the next stage.

### Stage 1 — Capture

- **Trigger:** a rule-worthy event. Bug pattern repeats, review
  finding recurs, a successful pattern is worth codifying.
  The existing `skill-improvement-trigger` rule signals the event.
- **Input:** raw observation (PR link, log line, review comment).
- **Output:** a signal appended to the intake stream
  `agents/memory/intake/signals-<YYYY-MM>.jsonl` by `memory_signal`, carrying
  its source, its evidence reference and its polarity. `learning_sidecar`
  verdicts that stream — decay, corroboration at two distinct origins, dead
  ends — into a gitignored overlay.
- **Guardrails:** nothing is written into `dist/agent-src/` at this stage, and
  the overlay is never auto-promoted. A single session can never mint a lesson;
  the stream lives in the consumer repo until a human curates it onward.

### Stage 2 — Classify

- **Trigger:** explicit invocation or pipeline progression.
- **Input:** the signal, and the sidecar's verdict over it, from Stage 1.
- **Output:** same file, frontmatter extended with:
  - `scope: project | package`
  - `type: rule | skill | command | guideline`
  - `stage: classified`
- **Guardrails:** classification is reversible. A `package`-scoped
  learning with single-repo evidence is auto-demoted to `project`
  at the gate.

### Stage 3 — Propose

- **Trigger:** classified learning enters the drafter.
- **Executor:** `learning-to-rule-or-skill` skill drafts the artefact
  body; `skill-improvement-pipeline` refines it.
- **Input:** classified learning + any referenced existing artefact.
- **Output:** proposal doc at
  `agents/proposals/<proposal_id>.md` following
  [`proposal.example.md`](../../templates/agents/proposal.example.md).
  Frontmatter `stage: proposed`.
- **Guardrails:** the draft body and the proposal doc are a single
  file. An artefact draft without its proposal wrapper is rejected.

### Stage 4 — Gate

- **Trigger:** proposal doc committed or staged.
- **Executor:** `./agent-config proposal:check`.
- **Input:** proposal doc from Stage 3.
- **Output:** verdict recorded in the proposal doc section 9
  (`pass | request changes | block`). Frontmatter `stage: gated`
  only after a `pass`.
- **Gate checks (all must pass):**
  1. At least **2 independent evidence** entries (distinct PRs,
     issues, or incidents) — the local row of the evidence threshold
     in `docs/contracts/retro-v1.md` § Evidence threshold.
  2. `skill_linter` zero errors on the draft body.
  3. `check_portability` zero violations (no project identifiers
     on `package`-scoped proposals).
  4. `check_references` resolves every link.
  5. `size-enforcement` within the budget for the artefact type.
  6. `preservation-guard` justifies any replacement (section 6 of
     the proposal doc).
- **Guardrails:** the gate is not a rubber stamp. A `block` verdict
  stays in the proposal as history; the pipeline restarts at
  Stage 3 if the author wants to revise.

### Stage 5 — Upstream

- **Trigger:** gate passed AND, for a proposal scoped to the package, a
  council ratification record reviewed it favourably AND the owner's
  authorization is on record (ADR-281 as amended 2026-10-07 — the council
  record is the review, the owner's authorization is the approval); where the
  council cannot conclude, the user decides by the route ADR-281 § 5 names. A
  proposal scoped to a consumer's own project needs that user's approval, as
  before.
  > **"whose `subject` matches" is deliberately absent here.** It described a
  > binding the gate does not perform at this pin: no record is bound to the
  > content it reviewed. Steps 2.1 and 2.2 of
  > `road-to-self-modification-that-a-council-must-pass` build that binding,
  > and the clause returns with them. Naming it before it exists would state a
  > guarantee a reader could rely on and the gate would not keep.
- **Executor:** the `upstream-contribute` skill decides *whether*, and
  `self-repair:release` — the one gated outward step — decides *what leaves*.
  The skill refuses invocation if the proposal frontmatter is not
  `stage: gated`.
- **Input:** gated proposal doc.
- **Output:** a pull request or an issue against `event4u-app/agent-config`
  carrying the proposal doc as the body. Standard package CI runs.
  Frontmatter `stage: upstream` and `upstream_pr_url` set.
- **Guardrails:** the skill never pushes and never opens a pull request
  itself, so there is one privacy floor and not two. No invocation edits any
  installed tree in the consumer repo; writes happen in the package checkout's
  branch only, and a consumer install reaches the issue step.

## Stage ownership

| Stage | Human role | Automation |
|---|---|---|
| 1 Capture | Any contributor | `skill-improvement-trigger` rule auto-triggers |
| 2 Classify | Drafter | `learning-to-rule-or-skill` suggests |
| 3 Propose | Drafter + reviewer | `skill-improvement-pipeline` refines |
| 4 Gate | Gate script | fully automated, block is final |
| 5 Upstream | Approver | `upstream-contribute` opens the PR |

## When to skip stages

- **Typo / wording fix** — direct PR, no proposal needed. Pipeline
  is for behaviour-changing proposals.
- **Documentation-only fix** — direct PR.
- **Adding a missing example** — direct PR if the rule semantics
  do not change.

When in doubt, run the pipeline. Overhead is bounded; churn from
unreviewed upstream changes is not.

## Anti-patterns

- **Do NOT** open an upstream PR without a proposal doc. Reviewers
  need the evidence in one place.
- **Do NOT** promote a learning with one piece of evidence. Two
  independent sources is the minimum; the gate enforces it.
- **Do NOT** edit the installed tree directly in a consumer project
  "just to try it out" — `.augment/` today, `.agent-src.uncondensed/`
  in a legacy install. Both are managed; drafts live in
  `agents/proposals/` and local changes in `agents/overrides/`.
- **Do NOT** treat a `block` verdict as a personal rejection. The
  gate checks structural shape, not author intent.

## See also

- [`proposal.example.md`](../../templates/agents/proposal.example.md) — the template every proposal derives from
- [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) — Understand → Research → Draft sequence used inside Stage 3
- [`preservation-guard`](../../rules/preservation-guard.md) — invoked by the gate to check replacement proposals
