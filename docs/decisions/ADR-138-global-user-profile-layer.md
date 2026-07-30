---
adr: 138
status: accepted
date: 2026-07-30
decision: global-user-profile-layer
supersedes: —
superseded_by: —
phase: road-to-global-user-memory-phase-1
type: structural
review_trigger: >-
  Reopen when the 90-day promotion-behaviour gate (road-to-global-user-memory
  Phase 5) fires its teardown review, when a project-local `.agent-user.md`
  needs to declare a field the global layer does NOT support (surfacing a gap
  in the disjoint-field authoring discipline), or when the deferred v2
  demographics fields are reconsidered — which must re-examine this ADR's
  strengthened-not-reopened exclusion first.
---

# ADR-138 — A global user-profile layer beneath `.agent-user.md`

## Status

Accepted (2026-07-30). Implements Phase 1 (read path) of
`agents/roadmaps/road-to-global-user-memory.md`, per the council cut recorded
in [`global-user-memory-cut`](../../agents/settings/contexts/global-user-memory-cut.md).

## Context

Before this change, the loader contract in
[`agent-user-schema.md`](../contracts/agent-user-schema.md) read, literally:

> 1. `.agent-user.md` at project root (this contract).
> 2. Nothing — agent uses generic address forms.

Every consumer project therefore needed its own `.agent-user.md`, re-answered
from scratch. The council cut named this as the U-layer gap: the agent's
memory of *the user* — as opposed to the project — had nowhere to live once,
and be read everywhere.

Two recorded locks bore on this:

1. `.agent-user.md` is project-local and v1-minimal; demographics are
   deferred to v2 pending usage data.
2. Project-shaped data must not live at the user-global layer
   (`agents_overlay.ts`'s `USER_GLOBAL_OVERLAY_KINDS` asymmetry — only
   `overrides/` is global-eligible; `contexts/` and `decisions/` are not).

Per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), both
were checked for mechanism match before being treated as blocking.

## Decision

Add `~/.event4u/agent-config/user/profile.md` (honouring
`$EVENT4U_CONFIG_HOME` and the legacy `~/.config/agent-config/` read-only
fallback, exactly like every other artefact under
`user_global_paths.ts`) as the **weakest** layer beneath the existing
project-local `.agent-user.md`. New loader order:

1. `~/.event4u/agent-config/user/profile.md` (global; weakest).
2. `.agent-user.md` at project root (unchanged; deepest, wins).
3. Nothing — agent uses generic address forms.

**Merge rule.** The authoring discipline is *disjoint fields* — the global
layer owns durable identity and style, the project layer owns project-specific
addenda, and the two should not normally carry the same field. The mechanism
for when they do anyway is **primitive-level deepest-wins**: the project
value for a given leaf (e.g. `style.pace`) replaces the global value outright
— never an object or array merge. `# Notes` is the one exception: both
layers' text is concatenated under `[global]` / `[project]` markers so
neither voice is silently dropped. Implemented in
[`agent_user_profile.ts`](../../src/scripts/_lib/agent_user_profile.ts).

**Cap.** The existing 100-line cap applies **per layer**, not as a shared
total. A shared cap would force the pathological choice the council named:
deleting global identity to make room for project context.

**Load model.** The global profile is read at session start *exactly* as the
project-local file is read today — same loader, same cap, no new always-on
cost. No session-start digest mechanism ships in this phase (a 200-word digest
was the recorded Q6 dissent in the council cut; it needs its own measurement
before it ships).

## Mechanism-match verdicts

| Lock | Verdict |
|---|---|
| `.agent-user.md` is project-local and v1-minimal; demographics deferred to v2 | **Different mechanism — does not block.** This change is *location*, not *richness*: the v1 schema is unchanged, the 100-line cap is unchanged, and the deferred-demographics exclusion is not merely kept — it is **strengthened** at global scope (global = longer retention = higher re-identification risk if it were ever lifted). |
| Project-shaped data must not live at the user-global layer (`USER_GLOBAL_OVERLAY_KINDS` asymmetry) | **Lock unamended.** `~/.event4u/agent-config/user/profile.md` is not an `agents/<kind>/<name>.md` overlay file — it does not extend `USER_GLOBAL_OVERLAY_KINDS`, and `contexts/`/`decisions/` remain excluded from that set exactly as before. A comment was added at the declaration site so a future reader does not mistake this ADR for a relaxation of that asymmetry. |

## Promotion-behaviour gate (Phase 5)

ADR-119 exists because a previous gate could never fire by construction: reuse
could only accrue while the layer was ON, and ON was withheld pending reuse —
the same self-locking-measurement deadlock ADR-117 broke for `subagents.auto`.
**This gate cannot repeat that failure because it is keyed to promotion
behaviour — human `/agents:user accept` decisions — which moves whether or not
the global profile ever loads at session start.** Loading is a read-time
convenience; promotion is a write-time human act, and the two are decoupled by
construction.

**Counters.** Four counts, no content, no PII — implemented in
[`user_memory_gate_counters.ts`](../../src/scripts/_lib/user_memory_gate_counters.ts)
as a struct of allowlisted non-negative-integer scalars with no field capable
of holding free-form content (the same shape `orchestration-telemetry.md` and
`artifact-engagement-recording.md` already use):

1. `projects_with_ge_10_sessions` — projects that reached the sessions floor.
2. `projects_with_promoted_observation` — of those (or any), how many carry at
   least one promoted global observation.
3. `observations_proposed` — total candidates that reached the global buffer.
4. `observations_accepted` — total candidates a human confirmed via
   `/agents:user accept`.

**Kill-criterion.** After 90 days live:

> If **< 40 %** of projects with ≥ 10 sessions carry ≥ 1 promoted global
> observation, **or** the review→accept rate (`observations_accepted` /
> `observations_proposed`) is **< 30 %**, a teardown review is mandatory. Its
> default outcome is **deprecation-with-archive**, unless defended with
> evidence at the review.

The 40 % floor catches "only power users use this"; the 30 % floor catches
"the loop proposes mostly junk". Either floor alone is sufficient to trigger
the review — they are not both required.

**Non-self-locking argument.** The metric this gate reads is a **count of
human accepts**, not a count of profile *loads*. A user who never has the
global profile read into a session can still generate a proposed observation
(the miner runs against session transcripts regardless of whether the profile
loaded) and can still accept it via `/agents:user accept` (a command the user
invokes directly, independent of session-start loading). So the numerator and
denominator of both ratios move as soon as the write path (Phase 2/3) and the
accept flow exist and are used — they do not require any further package work
on the read path, the loader, or session-start behaviour to accrue evidence.
This is the property ADR-119's Option A precedent established for
`knowledge.global_sharing`: the instrument is wired to the layer's *use*, not
to a downstream re-implementation of the layer.

**Residual dissent — the window.** The council recorded two candidate windows
for the N-layer gate (90 days vs 6 months; see
[`global-user-memory-cut`](../../agents/settings/contexts/global-user-memory-cut.md)
§ Residual dissent, Q5/Q9) without resolving which one binds the U-layer gate
specifically. **90 days ships** — it matches ADR-119's own measurement window
for the sibling global-knowledge-sharing flip, and a shorter window fails
faster on a genuinely dead layer without meaningfully under-counting a live
one (`seen_count` promotion requires only 3 human-confirmed sightings, which a
single active user can reach well inside 90 days). The 6-month alternative
remains available if the 90-day review finds the signal too thin to act on —
that would itself be evidence for widening the window, not a silent default.

**Why this gate can fire, in one line:** because the numerator and denominator
are both driven by an explicit human `/agents:user accept`, the count only
grows through actual use of the write path — never through the mere existence
of the read path — so it cannot be starved by the same "measurement requires
the very thing being measured" deadlock that made ADR-119 necessary.

### Breadth limb removed — the narrowing, stated in the open (2026-07-30)

The breadth limb of the promotion-behaviour kill criterion (**< 40% of projects
with ≥ 10 sessions carrying ≥ 1 promoted observation**) is **unimplementable under
the global-layer enumeration prohibition and is removed.** The criterion now fires
only on accept rate (**< 30% median review→accept**). This narrows the gate to
quality-of-adoption and excludes breadth-of-adoption: **a layer used well in few
projects will pass the 90-day gate.** This is a known limitation accepted to
preserve the no-enumeration guarantee.

Why it is unimplementable rather than merely unbuilt: both breadth counters need a
per-project record, and every primitive that can hold one either exposes the
project set (a directory to `readdir`, a digest set to a membership test, a
small-cardinality sketch whose empty registers prove absence for any guessable
path) or, once coarsened past testability, cannot resolve a 40% ratio at a
cardinality in the tens. Accurate implies enumerable; non-enumerable implies
non-decisional. The worked argument, the rejected candidates, and the council
review that forced this wording live in
[`promotion-gate-counting-primitive`](../../agents/settings/contexts/promotion-gate-counting-primitive.md).

A human counting their own projects at review time was considered and rejected as
the remedy: it outsources the automated gate's job and merely defers the same
enumeration by 90 days.


## Consequences

- A fresh session in a project with no `.agent-user.md` now addresses the
  user correctly and applies their style, sourced from the global profile.
- A project-local `.agent-user.md` still wins on every field it declares;
  `# Notes` from both layers survive with provenance markers.
- Two on-disk files now exist per user (global) / per project (local) instead
  of one per project; both stay files, no daemon, no index, no DB — consistent
  with the file-first precedent in `knowledge_global.ts` (ADR-100).
- No write path exists yet. Phase 2 (the learning channel) and its own guards
  are separately scoped and not part of this ADR.

## Alternatives considered

- **Shared line-cap across both layers.** Rejected — forces users to shrink
  their durable global identity every time a project adds local context.
- **Whole-object merge instead of primitive-level deepest-wins.** Rejected —
  an object merge silently blends unrelated project and global sub-fields
  (e.g. `identity: {name: ..., nickname: ...}`) in ways neither layer's author
  intended; primitive-level resolution keeps every override explainable as
  "this one field, this one layer".
- **Extending `USER_GLOBAL_OVERLAY_KINDS` to admit a `user` kind.** Rejected
  — the overlay cascade resolves `agents/<kind>/<name>.md`; the profile lives
  at `user/profile.md`, a different shape with its own resolution function.
  Bending the overlay kind list to fit would blur the asymmetry the lock
  protects.

## References

- `agents/roadmaps/road-to-global-user-memory.md` — Phase 1.
- [`global-user-memory-cut`](../../agents/settings/contexts/global-user-memory-cut.md) — council convergence record.
- [`agent-user-schema.md`](../contracts/agent-user-schema.md) — the updated loader/merge contract.
- [`user_global_paths.ts`](../../src/scripts/_lib/user_global_paths.ts) — the shared global-root resolver.
- [`agents_overlay.ts`](../../src/scripts/_lib/agents_overlay.ts) — the sibling cascade this ADR is distinguished from.
- [`user_memory_gate_counters.ts`](../../src/scripts/_lib/user_memory_gate_counters.ts) — the Phase 5 promotion-behaviour gate counters and `evaluateKillCriterion`.
- ADR-100 (file-first global knowledge layer), ADR-121 (sensitivity classes) — precedent for a global, file-first, no-daemon store.
- ADR-119 (global-knowledge-default-on) — the self-locking-measurement deadlock this gate's design avoids, and the 90-day measurement-window precedent it reuses.
