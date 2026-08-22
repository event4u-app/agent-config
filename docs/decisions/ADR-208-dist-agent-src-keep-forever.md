---
adr: 208
status: accepted
date: 2026-08-03
decision: dist-agent-src-is-the-shipped-projection-tree
supersedes: —
superseded_by: —
phase: road-to-renewal-adr-hygiene
type: structural
review_trigger: >-
  Reopen when (a) the installer or wizard-plan stops reading dist/agent-src/
  as its projection source — the anchoring premise of KEEP; (b) the
  byte-exactness gate (dist == rewrite(src)) is weakened or removed, which
  would revive the drift risk that collapse was meant to eliminate; or (c)
  the npm package size grows past 5 MB with dist/agent-src/ as a material
  contributor, making the duplication cost real instead of theoretical
---

# ADR-208 — `dist/agent-src/` is the shipped projection tree until its `review_trigger` fires; rewrite-at-projection-time is rejected

## Status

**Accepted** · 2026-08-03. Closes the open question ADR-201 deliberately
left undecided, per `road-to-renewal-adr-hygiene` Phase 2 with AI-council
convergence (claude-sonnet-4-5 + gpt-4o, design mode, 2026-08-03).
Decision only — no tree change ships with this record.

## Context

ADR-201 (accepted 2026-07-29) removed `.md` condensation: `dist/agent-src/`
is now a byte-identical, path-rewritten copy of `src/`, enforced by the
byte-exactness gate `dist == rewrite(src)`. Its § Open question asked:
should `dist/agent-src/` exist as a separate tree at all, or should the
per-tool projectors read `src/` and apply the rewrite at projection time?

ADR-201's own execution-verdict table already answered the adjacent
Question A with KEEP ("collapsing introduces risks without significant
benefits … maintains a comprehensible developer operations model" —
gpt-4o reversed its own collapse position in round 2). What remained open
was the narrower projector-side variant.

Facts as of this record: `dist/agent-src/` is the tree the npm package
ships and the installer reads (`CLAUDE_SKILL_BUNDLE →
['dist/agent-src/commands', 'commands']` in `src/install/wizard-plan.ts`,
mirrored in `src/scripts/install.ts`); the `.claude/` symlink layout the
open question named as an entanglement no longer exists (0 symlinks under
`dist/` and `.claude-plugin/`); the tree is git-diffable in review; the
byte-exactness gate makes src↔dist drift mechanically impossible.

## Decision

**KEEP, until `review_trigger` (a), (b) or (c) fires.** `dist/agent-src/`
remains the shipped, deterministically produced, git-diffable projection root:

1. The installer, the per-tool projectors, and the npm `files[]` surface
   keep reading `dist/agent-src/` — not `src/` — as the consumer-facing
   truth. `src/` remains the authoring truth (ADR-051); the byte-exactness
   gate remains the bridge.
2. Rewrite-at-projection-time (projectors reading `src/` directly) is
   **rejected**, not deferred: it would move the rewrite from one gated,
   diffable build step into every projector and the installer (a
   consumer-facing blast radius), repackage the npm surface, and reopen
   ADR-051's source-of-truth model — all to save one tracked tree whose
   only historical cost (drift) the byte-gate already eliminated.
3. The conditional roadmap step "if collapse is decided: execute the tree
   collapse as its own full-size PR" is void — nothing to execute.

## Consequences

- Positive: the installer/packaging surface stays untouched; reviewers
  keep seeing projection changes as ordinary diffs; the ADR-201 chain is
  closed instead of ambient.
- Negative / accepted: the repo permanently carries a second tracked copy
  of every governance `.md`. The cost is repo size and a `task sync`
  obligation per edit — both already priced in and CI-enforced.

## Alternatives considered

- **Collapse (projectors read `src/`)** — rejected as above; every named
  blocker (installer, npm packaging, ADR-051) is real, the benefit is one
  fewer tree.
- **Defer again** — rejected: ADR-201 explicitly parked the question for a
  deciding record; a second deferral is the perma-proposed pattern this
  roadmap exists to drain.

## References

- [ADR-201](ADR-201-remove-md-condensation.md) — the open question + Question-A KEEP verdict.
- [ADR-051](ADR-051-uncondensed-source-container-relocation.md) — the source-of-truth model KEEP preserves.
- `src/install/wizard-plan.ts`, `src/scripts/install.ts` — the consumer read path anchoring KEEP.
- `agents/roadmaps/road-to-renewal-adr-hygiene.md` Phase 2 — the authorizing step.
