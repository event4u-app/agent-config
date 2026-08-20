---
complexity: lightweight
---

# Roadmap Stubs — successor placeholders

> **Status** · stubs only. Created by Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md)
> so cross-references from the deployment-posture document and the
> archived `road-to-internal-ai-os-deployment.md` resolve.

Each file in this directory is a placeholder. None of them is active
work. Each enumerates the prerequisites a future maintainer (or
external contributor with funding) must satisfy before the stub can
be promoted to an active roadmap.

**Two kinds of stub live here, and they are gated differently.** The
original six are *empty-named placeholders* — proposals nobody has
started, created so cross-references resolve. The drain-transfer stubs
added from 2026-08-20 are the opposite: they carry work that was
**specified, sequenced and then found un-executable** from this
repository, moved out of a roadmap under a recorded council
disposition. The distinction is not cosmetic; it decides which gate
applies, so § Promotion criteria below is now explicitly scoped.

The stubs live under `stubs/` (not `agents/roadmaps/*.md` directly)
so they do not register with `task lint-roadmap-complexity` and do
not appear on `agents/roadmaps-progress.md`. Promotion to active
status moves the file up one directory and adds the complexity
frontmatter expected by the linter.

## Current stubs

| Stub | Triggers org-mode surface | Gates |
|---|---|---|
| [`road-to-team-sso.md`](road-to-team-sso.md) | SSO / OIDC sign-on | Recruited customer + funded security audit |
| [`road-to-central-policy.md`](road-to-central-policy.md) | Central policy enforcement | SSO must land first |
| [`road-to-team-context.md`](road-to-team-context.md) | Team-shared overrides server | Small-team-recipe (git overrides) hits scale limits |
| [`road-to-internal-connectors.md`](road-to-internal-connectors.md) | OAuth connectors (Google, Slack, M365) | Org customer agrees to per-connector scope review |
| [`road-to-worktree-lifecycle.md`](road-to-worktree-lifecycle.md) | Governed `/worktree:*` command cluster | ≥3 real demand signals + overlap check vs existing skills |
| [`road-to-council-visibility.md`](road-to-council-visibility.md) | `--council` in-flow verdicts + report format | Orchestration prove-or-drop resolved + ≥2 usage asks |

## Drain-run transfers

A second, separate group with a **different origin and different gates**. These
were not created by Phase 9 of the employee-product roadmap; they are work
transferred out of an active roadmap during a drain run because it needs a live
host session, a human observation, or a capability nobody is building. The
transferring roadmap records outcome state `transferred` so its archival never
reads as "outcome achieved".

Each carries the three-point integrity check that disposition requires: the
original `Resolved when` criterion **verbatim**, the complete list of dependent
steps moved, and a **named** re-entry producer with a detection probe — never
"when some subsystem exists for its own reason", which names nobody. Where a
probe was measurable on the transfer date its reading is recorded, so a future
reader can tell movement from noise.

Council disposition **B — transferred**, 2026-08-20
(anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2).

| Stub | Transferred from | Re-entry producer | Probe reading on transfer |
|---|---|---|---|
| [`road-to-host-aware-skill-projection.md`](road-to-host-aware-skill-projection.md) | `road-to-release-review-p0.md` Phase 1 + AC1 | Skill-projection maintainer | P1-P3 all measured **failing**: no same-`projection_mode` observation pair, `condense.ts` still throws on the scoped path, no published projected-away-skill finding |
| [`road-to-team-telemetry-behind-flag.md`](road-to-team-telemetry-behind-flag.md) | `road-to-always-on-orchestration.md` 5.4 | Maintainer of a flag-enabled environment | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` **unset** (3rd dated reading) |
| [`road-to-f4-full-stop-block.md`](road-to-f4-full-stop-block.md) | `road-to-always-on-orchestration.md` | Maintainer running the supported host | 9 `review_skipped` lines, all `exact`; canary **not captured** |
| [`road-to-gate-council-auto-dispatch.md`](road-to-gate-council-auto-dispatch.md) | `road-to-always-on-orchestration.md` | Gate-autonomy maintainer | 121 `quorum_result` events; 553 dispatch lines — **window has opened** |
| [`road-to-point-of-action-carrier.md`](road-to-point-of-action-carrier.md) | `road-to-always-on-orchestration.md` | Maintainer with a real multi-agent host session | **not locally measurable** — no lineage field in the hook envelope |

Four of these are one stub per blocker from the same roadmap, and merging them
was considered and refused: the two host-probe cases look adjacent but probe
different mechanisms (Stop-slot delivery versus PreToolUse agent identity)
against different telemetry streams (`review_skipped` versus F3-lite adoption),
and the council assigned them separate re-entry producers. One stub per distinct
evidence gap; a merged stub would have one probe standing in for two facts.

**The shared promotion criteria below do NOT apply to this group.** They are
org-mode gates — recruited customer, funded security audit, ADR lifting a
Hard-Floor item — and a drain-run transfer of internal work crosses no Hard
Floor and introduces no org surface. Each stub in this group carries its own
gates and says so.

## Promotion criteria (shared)

Applies to the six org-mode stubs in **Current stubs** above, not to the
drain-run transfers. Any of those stubs may move from `stubs/` to
`agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

### Drain-transfer stubs — the three shared criteria do NOT apply

```
A DRAIN-TRANSFER STUB IS GATED BY ITS OWN DETECTION PROBE.
NOT BY A RECRUITED CUSTOMER. NOT BY A FUNDED SECURITY AUDIT.
```

Stated explicitly because inheriting the shared criteria by proximity
would be wrong in both directions, and silently so. These four cross
**no Hard Floor** and introduce **no org-mode surface** — they are
blocked on a host environment variable, a live delivery observation, a
soak window and a host identity probe respectively. Requiring a
recruited customer and a funded audit would make them permanently
unpromotable for reasons that have nothing to do with what actually
blocks them, and a stub that cannot be promoted for an unrelated
reason is the parking lot the disposition framework's fifth
disposition (`E — abandon`) exists to avoid.

Each drain-transfer stub is promoted when **its own probe reads
positive**, and closed when its criterion is satisfied in **either**
direction — including the honest-null direction, where one exists and
is registered (the point-of-action carrier's "no discriminator is
publishable", the auto-dispatch gate's "telemetry says auto-fire adds
nothing and the gate stays recommend-only"). A measured null closes a
stub as legitimately as shipped work does.
