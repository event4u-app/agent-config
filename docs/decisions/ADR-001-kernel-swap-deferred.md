---
adr: 001
status: accepted
date: 2026-05-06
decision: kernel-swap-deferred
supersedes: —
superseded_by: —
phase: road-to-kernel-and-router · P2.1
---

# ADR-001 — Kernel-Set Swap Deferred (variant a)

## Status

**Accepted** · 2026-05-06.

## Context

Phase 1.4 of `road-to-kernel-and-router` ran an AI Council
cross-check (Sonnet 4.5 + GPT-4o) against the locked 9-rule kernel
set in `docs/contracts/kernel-membership.md` § 4. Sonnet flagged that
`agent-authority` carries **no Iron-Law fence** — it is a routing
index dispatching to four other kernel rules (`non-destructive-by-default`,
`scope-control`, `commit-policy`, `autonomous-execution`) by Band.
Sonnet proposed swapping `agent-authority` out of the kernel and
promoting `autonomous-execution` in. Three resolution variants
landed in `kernel-membership.md` § 5.2:

| variant | sum-projected (× 0.712) | bucket budget | Iron-Law-override ADRs |
|---|---:|---|---|
| (a) status quo (current § 4) | 23 071 | ✓ ≤ 25k | 2 (`direct-answers`, `language-and-tone`) |
| (b) swap, raise hard cap to 27k | 26 213 | ✓ ≤ 27k | 3 (+`autonomous-execution`) |
| (c) swap + demote `verify-before-complete` | 24 545 | ✓ ≤ 25k | 3 (+`autonomous-execution`) |

## Decision

**Variant (a) — status quo through P2.2 + P3.1.**

- Keep `agent-authority` in the kernel.
- Keep `autonomous-execution` in `compress-and-keep` (auto-tier) per
  `docs/contracts/rule-classification.md` § 3.2.
- Re-evaluate the swap as a P3.2 ADR after the router schema and
  compiler ship.

## Consequences

### Accepted

- 25k hard cap stays intact (no governance erosion via cap-raise).
- 2 Iron-Law-override ADRs land in P2.2 if post-compression
  measurement confirms overage (`direct-answers`, `language-and-tone`).
- The 9-rule set carried into P2.2 is the locked § 4 list.

### Trade-offs

- Sonnet's Iron-Law-purity critique stands: `agent-authority`
  remains in the kernel without a fence of its own. Mitigation —
  the rule **mechanically depends** on four other kernel rules
  (every Band redirects), so its kernel residency is structurally
  load-bearing even if not syntactically Iron Law. Treated as a
  routing primitive that dispatches to Iron Laws, not a rule in
  parallel to them.
- `autonomous-execution` (5631 chars current, ~4009 projected)
  remains in auto-tier. Behaviour preserved because the rule
  already declares `type: auto` and ships under the `balanced` and
  `full` cost profiles by default.

## Re-evaluation trigger

Phase 3 (`docs/contracts/rule-router.md`) introduces a
`tier:` / `band:` / `priority:` schema in rule frontmatter. Once
that schema is locked in P3.1 and the compiler is wired in P3.2,
`agent-authority` becomes redundant: each kernel rule carries its
own band as frontmatter, and the compiled `router.json` resolves
precedence at build time. At that point:

- `agent-authority` migrates to a guideline
  (`docs/guidelines/agent-authority.md`) as documentation of the
  band model.
- `autonomous-execution` can be promoted into the kernel under a
  new ADR (ADR-N) that replaces this one, *if* its post-compression
  size fits the cap with no further demotion.

This deferral is **not** indefinite: P3.2 ships the router compiler;
the swap re-evaluation ADR is mandatory before P4.1 (rule → skill
migrations) so the migration plan reflects the final kernel set.

## Alternatives considered

- **Variant (b) — swap + raise cap to 27k.** Rejected. Raising the
  hard cap mid-roadmap weakens the original 25k contract that the
  whole roadmap is built around. If 27k turns out to be the real
  ceiling, that is a separate ADR after compression measurement
  proves the band, not a pre-emptive concession.
- **Variant (c) — swap + demote `verify-before-complete`.**
  Rejected. `verify-before-complete` carries criterion #1 (Iron
  Law) and gates completion-claims across every reply. Demoting it
  to auto-tier removes the floor that prevents the agent from
  claiming "done" without fresh evidence — a behavioural regression
  that the golden-transcript suite would catch but that no other
  kernel rule replaces.

## References

- `docs/contracts/kernel-membership.md` § 4, § 5.2
- `agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json`
- `agents/roadmaps/road-to-kernel-and-router.md` § Decisions, § Phase 2
- `.agent-src.uncompressed/rules/agent-authority.md` (subject)
- `.agent-src.uncompressed/rules/autonomous-execution.md` (proposed promotion)
