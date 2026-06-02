---
adr: 040
status: accepted
date: 2026-06-02
decision: execution-model-projection-time-filtering
supersedes: —
superseded_by: —
phase: v6.0.0 · experience-first rebuild
type: forward-looking
---

# ADR-040 — Pack-scoped surfacing is projection-time filtering, not a runtime resolver

## Status

**Accepted** · 2026-06-02. Authored as Phase 0 / Step 1 of
[`road-to-6.0.0-a-positioning-and-validation`](../../agents/roadmaps/road-to-6.0.0-a-positioning-and-validation.md),
the de-risking front of the experience-first rebuild. It makes the single
architectural decision the rest of the rebuild
([`road-to-6.0.0-b-pack-scoped-projection`](../../agents/roadmaps/road-to-6.0.0-b-pack-scoped-projection.md))
hinges on, **before** any migration code is written. Builds on
[`ADR-010`](ADR-010-profile-pack-preset-boundary.md) (profile / pack / preset
boundary), [`ADR-020`](ADR-020-global-only-consumer-scope.md) (global-only
consumer scope), and [`ADR-016`](ADR-016-installer-architecture.md) (installer
architecture).

## Context

The external 5.7.0 product review (`agents/tmp/feedback-6.0.0-part1.*`) and the
first draft of the rebuild plan both described pack-scoped surfacing as a
**"runtime resolver"** that decides "at runtime" which skills/commands a host
tool sees. For a package whose entire job is to **project files** into each
tool's native config tree (`.claude/`, `.cursor/`, `.augment/`, …), that framing
is architecturally incoherent:

- `agent-config` ships no agent loop, no LLM dispatcher, no daemon, and no
  request interception. The host tool (Claude Code, Augment, Cursor, Cline,
  Windsurf, Gemini CLI, Copilot) owns the runtime; the package is a **content
  layer** (README "What `agent-config` is — and what it isn't").
- The only mechanism the package controls is **what gets written where** during
  release (`scripts/build_discovery_manifest.py`) and install / sync
  (`scripts/install.py` projection of `.agent-src/` into each tool tree).
- A literal runtime resolver would require a long-lived process between the host
  tool and the filesystem — exactly the "agent runtime" the package explicitly
  is **not** (and which `README.md` lists as out of scope).

The AI council (claude-sonnet-4-5 + gpt-4o, 2 rounds + peer-review, 2026-06-02)
named this the "single most damaging ambiguity" in the rebuild and converged on
decoding "runtime resolver" as **projection-time filtering**.

Today the projection writes the **full** artefact set regardless of the active
profile or packs. Profiles (`ADR-010`, six seed profiles) and packs (surface
caps: commands ≤12, skills ≤15, personas ≤4) already exist as **selection
metadata**, but nothing yet filters the projected output by them. That gap is
what 6.0.0-B closes — and this ADR fixes the mechanism it must use.

## Decision

**Pack-scoped surfacing is implemented as projection-time filtering. There is no
runtime resolver in 6.0.0.**

Concretely, answering the four questions the roadmap requires:

### Where the filtering runs

In the **Node build / install projection** and in an explicit
**`agent-config use --profile=<id>`** switch. The projector
(`scripts/install.py` + the discovery/manifest layer) becomes
profile-and-pack-aware: it writes only the active profile + enabled packs'
artefacts into the tool trees. The filter is a **build-time set operation** over
the trusted source (`.agent-src/` → projected tree), not a request-time hook.

### How it integrates with host tools

**Zero integration.** Host tools keep reading the static files in their native
config directories exactly as they do today. They never learn that a profile
exists. The behavioural change is entirely upstream of the host tool: a
narrower set of files lands in `.claude/`/`.cursor/`/`.augment/`. No plugin API,
no hook, no interception, no protocol change on the host side.

### When projection happens

At two moments, both explicit and user-initiated:

1. **Install / sync** — `agent-config init`, `upgrade`, `refresh`, `sync` write
   the projected set for the currently-selected profile + packs.
2. **Profile / pack switch** — `agent-config use --profile=<id>` (wired in
   6.0.0-A / Step 8) re-runs the projection for the new selection and rewrites
   the tool trees.

There is **no** mid-session, per-request, or background re-projection. The set a
host tool reads is fixed between explicit switches.

### What `agent-config use` does in 6.0.0-A (no behavioural change)

The AI council (2026-06-02) flagged a sequencing trap: `use --profile=<id>` is
wired in 6.0.0-A (Step 8), but filtering does not land until 6.0.0-B. To avoid a
silent no-op that "succeeds but does nothing", the contract for 6.0.0-A is
explicit:

- `use --profile=<id>` **writes** `profile:` into `.agent-settings.yml` and
  re-runs the projection — but the projection still writes the **legacy-all**
  (full) set, because filtering ships later. It is **not** a silent no-op: it
  changes persisted selection state and prints what it set, plus a one-line note
  that surface-narrowing activates in 6.0.0-B.
- It MUST reject an unknown profile id (validate against the six seed profiles)
  rather than write garbage.
- It does **not** change which artefacts a host tool sees in 6.0.0-A. The
  "no projection-behaviour change" acceptance criterion holds: `use` moves the
  *setting*, not the *set*.

### Staleness and re-projection hygiene

The projected set is a snapshot taken at the last explicit projection
(install / sync / `use`). If upstream packs change (a surface cap moves, a pack
is deprecated) **after** projection, the tool trees are stale until the next
explicit `sync` / `use`. This is **accepted, not auto-corrected**: there is no
background watcher. `agent-config validate` already performs drift detection on
the manifest and is the surface that flags a stale projection; `sync` re-applies
the current selection. Auto-detection beyond `validate` is out of scope.

### Switching back / undo

The per-user undo for a profile switch is another explicit `use`:
`agent-config use --profile=<previous-id>` re-projects the prior selection. The
switch persists the *new* selection in `.agent-settings.yml`; the previous value
is recoverable from VCS / settings history. A dedicated `--rollback` flag is not
required in 6.0.0-A (the setting is the single source of truth and re-projection
is idempotent), but is noted as a possible 6.0.0-B affordance if field use shows
it is needed. (This per-user undo is distinct from the *release-level*
rollback criteria for the 6.1.0 default-flip — see the validation-gate note.)

### How a user sees the active selection

The active profile lives in `.agent-settings.yml` (`profile:`), and
`agent-config validate` / the Settings GUI surface it. `use` echoes the
resulting selection on every switch. No new per-tool-tree state file is
introduced — `.agent-settings.yml` stays the single source of truth for "which
experience is active".

### Trust boundary

The **projector writes**; **host tools read**. The projector
(`scripts/install.py` and friends, run under the global install per `ADR-020`)
is the only writer of `.claude/`/`.cursor/`/`.augment/`. Host tools treat those
trees as read-only inputs. The trusted root remains `.agent-src.uncondensed/` →
`.agent-src/`; the projection is a deterministic, re-runnable function of
(trusted source, active profile, enabled packs). This preserves the existing
trust model (`ADR-018`) — no new write surface, no new privileged process.

### Runtime resolver is scoped OUT of 6.0.0 (conditional)

A **true** runtime resolver — mid-session pack switching, the host tool querying
a live process for "which skills apply right now" — is explicitly **out of scope
for all of 6.0.0**. It is recorded as a **conditional** later possibility, gated
on evidence that users actually want mid-session switching (telemetry or
recruit-session signal). If it ever ships, it is a separate ADR and lives at the
tail of [`road-to-6.0.0-c-governance-and-evals`](../../agents/roadmaps/road-to-6.0.0-c-governance-and-evals.md)
or later — never silently as part of the projection work.

### Supersedes the README "skill-resolver out of scope" line

`README.md` ("What `agent-config` is — and what it isn't") lists **"Opinionated
skill-resolver algorithm"** in the *Out of scope* column. That line predates the
profile/pack axis. The AI council (2026-06-02) converged that the line must be
**refined, not blanket-removed** — there are two distinct things, and only one
moves:

- **Out of scope (unchanged):** an *opinionated, automatic* resolver that ranks
  or curates skills *for* the user without their choice (ML-based curation,
  relevance scoring, "the algorithm decides"). The package still does not do
  this.
- **In scope (the refinement):** *user-driven* projection-time **filtering** —
  the user picks a profile + packs, and the projector writes that subset. This
  is a deterministic set operation governed by an explicit user choice, not an
  opinionated runtime ranking.

So this ADR supersedes the *reading* of that line that says "we will never
select a subset of skills", while preserving the rejection of an automatic
resolver. The README NOT-table is updated in Phase 1 to draw exactly this
distinction (and a *runtime* resolver remains out of scope per above).

## Consequences

**Positive**

- The rebuild has one unambiguous mechanism to build against. 6.0.0-B
  enhances the projector; it does not invent a daemon.
- No host-tool integration work, no protocol negotiation, no new runtime
  process — the cheapest possible implementation of "focused command set".
- Deterministic and testable: the projected set is a pure function of
  (source, profile, packs); existing determinism checks
  (`check_discovery_determinism.py`) extend naturally.
- The trust boundary (`ADR-018`, `ADR-020`) is unchanged — no new attack
  surface.

**Negative / costs**

- Switching profiles requires an explicit `agent-config use` + re-projection;
  it is not instantaneous mid-session. Accepted: the council judged mid-session
  switching an unvalidated want.
- The projector gains profile/pack-awareness complexity (the set filter, the
  legacy-all default, the staged rollout flag). Contained to the build layer.
- Users who expected a "smart resolver" may be underwhelmed; mitigated by honest
  positioning (Phase 1) that frames **explicit switching as a feature**
  (predictable, inspectable, reproducible) rather than a limitation, and by the
  conditional runtime-resolver escape hatch.

**Neutral**

- 6.0.0-A ships **no** projection-behaviour change — only this decision, the
  positioning rewrite, and the `use` seam. The behavioural flip is 6.0.0-B,
  staged and opt-in (legacy-all default) per the validation-gate note
  ([Phase 0 / Step 2](../../agents/roadmaps/road-to-6.0.0-a-positioning-and-validation.md)).

## Alternatives considered

1. **Literal runtime resolver (rejected).** A long-lived process between host
   tool and filesystem. Incoherent for a content-layer package; would make
   `agent-config` an agent runtime it explicitly is not; requires per-host
   integration the package has no surface for. Rejected as architecturally
   wrong, not merely expensive.
2. **Host-tool plugin/hook that filters at read time (rejected).** Push the
   filter into each tool via its plugin API. Multiplies per-tool integration
   cost across 7+ tools, couples the package to every tool's plugin lifecycle,
   and breaks tools without a plugin surface. Rejected.
3. **Ship full set, document "ignore what you don't need" (rejected).** The
   status quo. Fails the core perception problem the rebuild exists to fix
   ("520 artefacts, where do I start?"). Rejected — it is the problem.
4. **Projection-time filtering (accepted).** Filter the projected set by profile
   + packs in the build/install layer; host tools read a pre-filtered static
   set. Cheapest, deterministic, zero host integration, preserves the trust
   boundary.

## References

- [`road-to-6.0.0-a-positioning-and-validation`](../../agents/roadmaps/road-to-6.0.0-a-positioning-and-validation.md) — this roadmap (Phase 0 / Step 1).
- [`road-to-6.0.0-b-pack-scoped-projection`](../../agents/roadmaps/road-to-6.0.0-b-pack-scoped-projection.md) — consumes this decision.
- [`ADR-010`](ADR-010-profile-pack-preset-boundary.md) — profile / pack / preset boundary.
- [`ADR-016`](ADR-016-installer-architecture.md) — installer architecture (the projector).
- [`ADR-018`](ADR-018-trust-and-safety-layer.md) — trust boundary this ADR preserves.
- [`ADR-020`](ADR-020-global-only-consumer-scope.md) — global-only consumer scope (where the projector runs).
- [`profile-system`](../contracts/profile-system.md) — the six seed profiles and pack surface caps.
- `README.md` § "What `agent-config` is — and what it isn't" — the superseded "skill-resolver out of scope" line.
