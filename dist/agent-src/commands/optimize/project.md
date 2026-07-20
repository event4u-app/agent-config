---
model_tier: high
name: optimize-project
pack: meta
tier: 2
visibility: internal
sub: project
cluster: optimize
skills: [project-analyzer, decision-review, roadmap-writing]
description: "Project-wide optimization sweep — inventory roadmaps, ADRs, agent folders (incl. modules), challenge stale decisions with the user in the loop, emit new roadmap(s). E.g. 'optimize this project'."
argument-hint: "[--max-questions=N]"
suggestion:
  eligible: false
  trigger_description: "optimize this project, optimize the project, what should we improve based on current state, challenge our old decisions, are our roadmaps and ADRs still right, optimiere das Projekt, hinterfrag unsere alten Entscheidungen"
  trigger_context: "user wants a project-wide review that questions existing state (roadmaps, ADRs, decisions, structures) and ends in new roadmap(s) — NOT a bug fix, NOT a single-decision audit (/analyze:decision), NOT agent-layer tooling (/optimize)"
workspaces:
  - engineering
  - agent-config-maintainer
packs:
  - meta
---

# /optimize-project

Project-wide optimization loop: **inventory → challenge → interview →
roadmap(s)**. Analyzes the project it runs in (package or consumer),
questions the existing state — roadmaps, ADRs, decisions, structures,
and in this package e.g. token consumption, memory, learnings — asks
the user when flipping an old decision would be a real improvement, and
ends by emitting one or more NEW roadmaps via `/roadmap:create`.

This is a **coordinator** over existing primitives — it composes, never
reimplements: `/project-health`-style inventory, `/challenge-me`
interview mechanics, `/analyze:decision`-style decision challenge,
`/roadmap:create` output.

> Looking for agent-layer tooling (skills, agents-dir, augmentignore,
> rtk filters)? That is the [`/optimize`](optimize.md)
> cluster — a different surface. This command optimizes the **project**,
> not the agent layer.

## When to invoke

- "Optimize this project" / "optimiere das Projekt".
- "What should we improve based on the current state?"
- "Challenge our old decisions" / "are our roadmaps and ADRs still right?"
- Periodic hygiene: many roadmaps have accumulated, decisions feel
  stale, structures grew organically and nobody has questioned them.

Do NOT invoke for: a single named bug ("fix this"), a single decision
audit (route to `/analyze:decision`), a code-only analysis
(`/project-analyze`), or AGENTS.md / agent-layer work (`/agents`,
`/optimize`).

## Steps

### Step 0 — Scope detection (read-only)

1. Detect the target type:
   - **Package mode** — this repo IS `event4u/agent-config` (marker:
     `src/config/budgets.yml` + `dist/agent-src/` present). Optimization
     surface additionally includes token budget, memory index,
     learnings/knowledge corpus, lint debt.
   - **Consumer mode** — any other project with an `agents/` tree
     and/or installed agent layer. Optimization surface = workflows,
     structures, docs, roadmaps, decisions.
2. Resolve module roots via
   `scripts/_lib/agent_settings.ts::enumerate_modules()` (Laravel shape:
   `app/Modules/*/agents/`); fall back to `modules.root_paths` in
   `.agent-settings.yml`.
3. Exclusions are hard: never analyze `vendor/`, `node_modules/`,
   `dist/`, or any generated projection (`.augment/`, `.claude/`,
   `.cursor/`).

### Step 1 — Inventory (read-only, parallel)

Gather without creating or modifying anything:

- **Roadmaps** — `agents/roadmaps/` (+ per-module roadmap dirs): counts
  per disposition (active / `later/` / `skipped/` / `archive/`),
  per-roadmap open/done/deferred checkbox counts, staleness
  (mtime > 60 days with open items), complete-but-unarchived.
- **Decisions** — ADR dirs (`docs/adr/`, `docs/decisions/`,
  `agents/decisions/`): count, age distribution, `status:` fields,
  superseded chains.
- **Agent folders** — `agents/` root + every module `agents/` folder:
  docs, features, contexts; orphaned or stale files (referencing
  deleted code).
- **Memory / learnings** (if present) — memory index size, knowledge
  cards, low-impact decisions corpus; entries whose subject no longer
  exists in the repo.
- **Package mode only** — current budget usage vs cap
  (`src/config/budgets.yml`), kernel share, corpus size trends, known
  lint debt, honest-null / don't-relitigate lock inventory (from memory
  index + `agents/settings/contexts/`).

Emit a compact inventory report (counts + flagged items), in the
user's language. Present findings incrementally, not as one dump.

### Step 2 — Findings & challenge candidates

Classify everything flagged in Step 1 into three buckets:

1. **Mechanical optimizations** — no decision needed, just work: stale
   roadmap cleanup, complete-but-unarchived roadmaps, dead references,
   missing module docs, memory entries pointing at deleted code.
2. **Decision-challenge candidates** — an existing decision (ADR, lock,
   council verdict, structural convention) whose original assumptions
   may no longer hold. For each candidate record: *the decision · the
   original assumption · what changed since · the expected gain from
   flipping · the flip cost/blast radius*. A candidate without a
   concrete "what changed" is not a candidate — drop it.
3. **Structural / process improvements** — recurring friction visible
   in the inventory (e.g. roadmap sprawl, duplicate contexts, token
   hot-spots in package mode).

Rank candidates by expected impact vs. effort. **Cap the
decision-challenge list at the top 5** (override: `--max-questions=N`).
Everything below the cap is carried into Step 4 as "further candidates"
— never silently dropped.

Before a candidate built on a claim about the current state enters the
interview, verify the claim against the real source (grep, file read,
live git/CI state) per
[`source-discovery-gate`](../../rules/source-discovery-gate.md) —
never challenge a decision based on a remembered or assumed fact.

**SHA-pinned verification.** Every `Verified:` prerequisite or
evidence line written into an output roadmap MUST be re-run inside the
output branch/worktree at its HEAD at verification time, and cite that
SHA — never carried over from an earlier checkout. If a claim-relevant
commit lands between verification and the roadmap's landing, the claim
must be re-verified (the cited SHA makes the gap detectable). A sweep
that verifies against a stale clone produces exactly the stale prose
it exists to repair. Two known false-negative traps: files that `grep`
classifies as binary return zero hits silently (use `grep -a` / `rg`),
and a parallel session may land the claimed gap between analysis and
authoring.

### Step 3 — Challenge interview (user-gated, budgeted)

One question per turn, numbered options with a recommendation —
the `/challenge-me` mechanics, per
[`ask-when-uncertain`](../../rules/ask-when-uncertain.md) and
[`user-interaction`](../../rules/user-interaction.md).

Per candidate, present:

```
> **Decision:** <what was decided, where it is recorded>
> **Then:** <original assumption>
> **Now:** <what changed — with evidence source>
> **Gain if flipped:** <expected improvement> · **Cost:** <blast radius>
>
> 1. Keep — assumptions still hold
> 2. Flip — schedule the change in the output roadmap
> 3. Re-evaluate via council — genuinely contested, worth a multi-model pass
> 4. Defer — park as "further candidate"
```

Hard rules for this step:

- **Locked decisions are never silently flipped.** An honest-null
  verdict, a "don't relitigate" note, a budget-canon line, or a locked
  council convergence follows
  [`decision-revisit-gate`](../../rules/decision-revisit-gate.md):
  check the lock's mechanism/scope actually matches the proposed change
  and its recorded revisit-conditions first; if it truly blocks, the
  only flip path offered is option 3 (council re-eval) — "Flip" is not
  offered for locks.
- **Session budget:** at most 5 interview questions by default
  (`--max-questions=N` to override). Budget exhausted → remaining
  candidates go to Step 4 as "further candidates".
- Interview answers are adopted immediately; never re-argue a settled
  answer.

### Step 4 — Synthesize → roadmap(s)

1. Group the accepted work — mechanical optimizations + flipped
   decisions + structural improvements — into **one or more roadmaps by
   concern** (keep k small; one roadmap per coherent theme, not one per
   finding).
2. For each group, route to [`/roadmap:create`](roadmap/create.md)
   with a structured seed: goal, findings (with evidence), accepted
   decisions from the interview, "further candidates" section for the
   uninterviewed remainder.
3. Council re-evals chosen in the interview (option 3) land as an
   explicit first step in the matching roadmap — do NOT auto-run the
   council from here.
4. Regenerate the roadmap dashboard in the same reply
   (`./agent-config roadmap:progress`) per
   [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md).
5. **Hand back and stop.** Per
   [`scope-control § Authoring vs. implementation`](../../rules/scope-control.md)
   the roadmap is the deliverable — never auto-offer
   `/roadmap:process-*` or start executing.

## Output

1. **Inventory report** (Step 1) — compact counts + flagged items.
2. **Findings report** (Step 2) — three buckets, ranked, with the
   challenge-candidate cards.
3. **Interview** (Step 3) — one question per turn, ≤ budget.
4. **Roadmap file(s)** (Step 4) — the only files this command creates,
   via `/roadmap:create`, plus the dashboard regen.

## Rules

- **Read-only until Step 4.** The only writes are the new roadmap
  file(s) and the dashboard regen. No code edits, no doc rewrites, no
  deletion — cleanup work becomes roadmap steps, not inline actions.
- **Never edit or delete existing roadmaps / ADRs / decisions** — a
  flipped decision becomes a roadmap step ("supersede ADR-NNN with …"),
  never an in-place edit from this command.
- **No commits, no push, no PR** — [`commit-policy`](../../rules/commit-policy.md).
- **Never silently flip a lock** — [`decision-revisit-gate`](../../rules/decision-revisit-gate.md).
- **One question per turn**, recommendation line under every options
  block.
- Mirror the user's language in all reports and questions.

## Gotchas

- **Unbounded interview** — without the question budget the
  decision-flip loop can eat the session. The cap is load-bearing;
  don't lift it silently.
- **Re-litigating without new evidence** — a challenge candidate needs
  a concrete "what changed". "I would decide differently today" is not
  evidence; check the lock's recorded revisit-conditions first.
- **Scope bleed into `/optimize`** — token/skill/agents-dir tooling
  findings in package mode are reported, but their execution routes to
  the `/optimize` cluster sub-commands inside the output roadmap.
- **Roadmap sprawl as output** — emitting five roadmaps for one theme
  recreates the problem this command exists to fix. Group by concern.
- **Vendor noise** — module enumeration must come from
  `enumerate_modules()`, never from a bare glob that catches `vendor/`.

## Do NOT

- Do NOT execute any of the found optimizations in this command's turn
  — the roadmap is the deliverable.
- Do NOT auto-run a council session; record it as a roadmap step.
- Do NOT offer "Flip" on locked decisions — council re-eval only.
- Do NOT create analysis files (that is `/project-analyze`); this
  command creates roadmaps only.
- Do NOT re-ask a settled interview answer.

## See also

- [`/optimize`](optimize.md) — agent-layer tooling
  cluster (skills, agents-dir, augmentignore, rtk); cross-linked on
  purpose — closest name, different surface.
- [`/project-analyze`](project-analyze.md) — deep code/stack
  analysis with analysis-file output.
- [`/project-health`](project-health.md) — quick read-only
  counts, no challenge loop.
- [`/analyze:decision`](analyze/decision.md)
  — single-decision audit; this command sweeps and hands hot ones to
  the interview.
- [`/challenge-me with-docs`](challenge-me/with-docs.md)
  — the interview mechanics this command borrows, applied to a seed
  instead of the project state.
- [`decision-revisit-gate`](../../rules/decision-revisit-gate.md) —
  the lock-flip discipline Step 3 enforces.
