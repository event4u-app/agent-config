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

## Drain-transfer stubs (2026-08-20 — `road-to-always-on-orchestration`)

Transferred under council disposition **B — transferred**, 2026-08-20
(anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2). Each
carries the three-point integrity check that disposition requires: the
original `Resolved when` criterion **verbatim**, the complete list of
dependent steps moved, and a **named** re-entry producer with a
detection probe — never "when some subsystem exists for its own
reason", which names nobody.

| Stub | Evidence gap that blocks it | Re-entry producer | Probe reading today |
|---|---|---|---|
| [`road-to-team-telemetry-behind-flag.md`](road-to-team-telemetry-behind-flag.md) | Team payloads unobservable while the experimental host flag is unset | Maintainer of a flag-enabled environment | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` **unset** (3rd dated reading) |
| [`road-to-f4-full-stop-block.md`](road-to-f4-full-stop-block.md) | Live Stop-slot `additionalContext` delivery unverified; threshold needs a distribution | Maintainer running the supported host | 9 `review_skipped` lines, all `exact`; canary **not captured** |
| [`road-to-gate-council-auto-dispatch.md`](road-to-gate-council-auto-dispatch.md) | Transport soak unverified; pre-registered minima unwritten | Gate-autonomy maintainer | 121 `quorum_result` events; 553 dispatch lines — **window has opened** |
| [`road-to-point-of-action-carrier.md`](road-to-point-of-action-carrier.md) | Main-vs-subagent identity not establishable from this repository | Maintainer with a real multi-agent host session | **not locally measurable** — no lineage field in the hook envelope |

Four stubs for four blockers. Merging was considered and refused: the
two host-probe cases look adjacent but probe different mechanisms
(Stop-slot delivery vs PreToolUse agent identity) against different
telemetry streams (`review_skipped` vs F3-lite adoption), and the
council assigned them separate re-entry producers. One stub per
distinct evidence gap; a merged stub would have one probe standing in
for two facts.

## Promotion criteria — scoped by stub kind

### The original six (org-mode surfaces)

Any of the six stubs above the drain-transfer table may move from
`stubs/` to `agents/roadmaps/` only when **all three** of these are
true:

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
