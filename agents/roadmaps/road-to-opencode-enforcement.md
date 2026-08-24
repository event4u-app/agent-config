---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24 from agents/tmp.old/feedback-14.11.0/road-to-opencode-enforcement.md. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this change archives nothing to offset against. Landed as status: draft so it charges no gated metric until a human flips it, because its own Phase 0 may falsify its premise -- see the surface-matrix contradiction in Context."
---
# Road to opencode enforcement — testing whether a real deny is reachable

> **Source:** `agents/tmp.old/feedback-14.11.0/road-to-opencode-enforcement.md`,
> a proposal that arrived with the 14.11.0 feedback bundle. Its own header records
> that this item *"blieb viermal liegen, weil ein Chat-Amendment kein Drain-Input
> ist"* — left lying four times because a chat amendment is not a drain input.
> It is a drain input now. Translated from German at landing; the reasoning is the
> proposal's, the verification below is this run's.

## Goal

Establish, by measurement rather than by doctrine, whether this package's
blocking concerns can actually **deny** on a host with an enforcement API — or
record an honest null saying why not. Finished means: six named concerns each have
a red-without-plugin / green-with-plugin transcript, or a documented failure cause
per concern, and the result feeds a decision record instead of a preference.

## Context — the defect is the repo's own, and it is recorded

The premise is not the reviewer's opinion. It is a commit message from this
repository, `8cc71baa9` (2026-08-23):

> *"fix(hooks): the P0 stop verdict is reported, not enforced — and say so
> everywhere"*

That is the accepted-risk line in the threat model, stated as a code change. This
package's blocking semantics on today's hosts are convention plus a small number
of hook gates. Verified independently while draining the 2026-08-24 inbox: of the
hosts carrying a `pre_tool_use` slot, exactly **one** — `claude` — honours a deny;
`augment` and `cowork` bind the slot and their trampolines discard dispatcher
output and `exit 0` unconditionally; `cursor`, `cline` and `gemini` alias a native
pre-tool event with no binding; `windsurf` and `copilot` have no pre-tool surface
at all.

So the gap is real, it is documented, and it is wide.

### The contradiction this roadmap must resolve first

The proposal claims opencode ships a plugin API — `permission.ask` with an
allow/deny/ask verdict, `tool.execute.before`, `shell.env`,
`experimental.chat.system.transform`, `experimental.session.compacting` — pinned
at `6386e67`, `packages/plugin/src/index.ts:222–334`.

This repository's own committed config says the opposite.
`src/config/surface-matrix.yml`:

```yaml
  opencode:
    surface: projection
    scope_path: "~/.opencode/"
    hooks: none
    notes: Plain projection (skill bundle); no plugin channel.
```

And `src/scripts/hook_manifest.yaml` contains **zero** occurrences of `opencode`.

**Exactly one of these is wrong, and this run cannot say which.** Verifying the
external plugin API needs a network fetch, which the analysis bound that produced
this file forbids. So it is `unverifiable` from here and it becomes Phase 0 rather
than an assumption — and either outcome is informative: if the plugin channel
exists, `surface-matrix.yml` carries a stale claim on a host we already ship to;
if it does not, this roadmap closes at Phase 0 with a null.

**What is NOT in question:** opencode is already a supported install target.
`grep -rl opencode src/ docs/` returns 12 files including
`src/install/toolDetection.ts`, `src/install/wizard-plan.ts`,
`src/scripts/install.ts` and `docs/installation.md`. So this is not opening a new
host — it is asking whether a host already in the matrix has a channel the matrix
says it lacks. That distinction matters for
[`domain-adoption-policy`](../../src/rules/domain-adoption-policy.md): no new
domain is being opened.

## Phase 0 — settle the premise before building anything

- [ ] **0.1 Verify whether opencode exposes a plugin API with a deny verdict**, at
      the pinned revision the proposal names. This needs a network fetch and is
      therefore a human or an explicitly network-authorised step, not an offline
      one.
      verify: the four hook names the proposal cites either resolve in the
      upstream source at the pin, or do not; record which, with the file and line.
- [ ] **0.2 Reconcile `surface-matrix.yml` with 0.1's answer in the same change.**
      If the channel exists, `hooks: none` and *"no plugin channel"* are stale and
      the matrix is wrong on a shipped host. If it does not, the proposal is wrong
      and this roadmap stops here.
      verify: `grep -A5 'opencode:' src/config/surface-matrix.yml` agrees with the
      recorded finding, and the change cites 0.1's evidence.
- [ ] **0.3 If and only if 0.1 is positive, write the PREREG.** One file,
      `internal/bench/opencode-enforcement-PREREG.md`, fixing six concerns before
      any measurement: `block-kernel-rule-writes`, `block-config-weakening`,
      `block-no-verify`, `git-authorization` (in the op-split semantics whose
      vector tests are the red/green template), `hardenedSpawnEnv` → `shell.env`,
      and kernel projection → `experimental.chat.system.transform`.
      verify: the file states, per concern, the success criterion **before** the
      measurement — red without the plugin (the action happens), green with it (the
      deny lands, with a transcript).

## Phase 1 — a thin carrier, never a second source of truth

- [ ] **1.1 A plugin package that translates host hooks onto the existing
      dispatcher.** `@event4u/agent-config-opencode` in the monorepo: a thin
      hook→`dispatch.js` translator with **no duplicated concern logic**. The
      scripts stay the one source; the plugin is a second carrier.
      verify: the package contains no copy of any concern's decision logic —
      `grep -rn 'block-kernel-rule-writes\|block_config_weakening' <pkg>/src` finds
      only dispatch wiring, never a re-implementation.
- [ ] **1.2 Per-concern red/green arms, exactly as the PREREG fixed them.** Each
      concern is demonstrated red without the plugin before its green counts —
      sensitivity by sabotage, not by assumption.
      verify: six transcript pairs, one per concern, each showing the action
      happening without the plugin and denied with it.

## Phase 2 — record the result, whichever way it goes

- [ ] **2.1 An ADR carrying the outcome per concern.** A documented failure with a
      named cause is a valid result and is the honest-null path the proposal
      itself declares.
      verify: the ADR states, per concern, `enforced` or `not-enforced` plus the
      cause, and no concern is left unstated.
- [ ] **2.2 Correct the enforcement-coverage claims that this changes.** If any
      concern now genuinely denies on a second host, the `enforced_by` lines and
      `check_enforcement_coverage`'s denominator both move.
      verify: `./scripts-run src/scripts/check_enforcement_coverage` reflects the
      new host, and no rule claims enforcement on a host where the arm came back
      red.

## Blockers

### blocker: b-opencode-plugin-api-unverified

- **What:** The proposal's central premise — that opencode exposes
  `permission.ask` with a deny verdict — contradicts `surface-matrix.yml`'s
  `hooks: none` and *"no plugin channel"*, and `hook_manifest.yaml` has zero
  opencode entries. Exactly one is wrong.
- **Blocks:** everything after Phase 0. Phases 1 and 2 are unwritable until this
  resolves.
- **What to do:** fetch `packages/plugin/src/index.ts` from the upstream
  repository at the pinned revision `6386e67` and check for the four hook names
  (`permission.ask`, `tool.execute.before`, `shell.env`,
  `experimental.chat.system.transform`). This requires network access, which the
  offline analysis bound forbids — so it is a human step or an explicitly
  network-authorised run. Then reconcile `src/config/surface-matrix.yml`.
- **Owner:** maintainer.
- **Recommendation:** do 0.1 and 0.2 as a single small change before reading the
  rest of this roadmap. It is cheap and it decides whether the rest exists.
- **If you do nothing:** a roadmap sits at `ready`-adjacent status on a premise
  that a committed config file contradicts, which is the shape a later reader
  cannot distinguish from a verified one.
- **Resolved when:** `surface-matrix.yml`'s opencode row and the upstream source
  at the pin agree, with the evidence recorded.
- **Status:** open.

### blocker: b-second-carrier-doctrine

- **What:** A plugin that denies is a second enforcement carrier. This package's
  doctrine is that scripts are the one source and hosts are carriers; a plugin
  that can deny where the dispatcher cannot is a new authority surface, not just
  a new binding.
- **Blocks:** 1.1's package layout, and 2.2's coverage claims.
- **What to do:** decide whether a host-specific carrier may hold a deny the
  dispatcher does not, and record it. Read `docs/contracts/hook-architecture-v1.md`
  § Which hosts carry `pre_tool_use` for the existing four-state model, and state
  which state opencode would occupy.
- **Owner:** maintainer.
- **Recommendation:** treat the plugin as a pure translator with no independent
  verdict, which keeps the four-state model intact and makes 1.1's no-duplication
  verify the load-bearing one.
- **If you do nothing:** a second carrier accretes its own logic, and the
  enforcement denominator becomes host-specific in a way `check_enforcement_coverage`
  cannot express.
- **Resolved when:** the decision is recorded in the Phase 2 ADR or in
  `hook-architecture-v1.md`.
- **Status:** open.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The premise is false and the roadmap is built anyway | implementation | `surface-matrix.yml` says opencode has no plugin channel. If that is right, Phases 1 and 2 describe work on an API that does not exist. | Phase 0 is a gate, not a preamble, and `b-opencode-plugin-api-unverified` blocks everything after it. | Phase 0 — settle the premise before building anything |
| 2 | The plugin becomes a second source of concern logic | implementation | Six concerns translated into a host plugin is six opportunities to re-implement a decision instead of dispatching it. | 1.1's verify greps the package for concern identifiers and fails on a re-implementation. | Phase 1 — a thin carrier, never a second source of truth |
| 3 | A green arm is claimed without a red one | implementation | A deny that was never shown to be absent proves nothing about the plugin; the action may have been impossible in that transcript for an unrelated reason. | The PREREG fixes red-without-plugin as a precondition of green-with-plugin, per concern, before any measurement. | Phase 0 — settle the premise before building anything |
| 4 | Enforcement claims widen faster than the evidence | product | Once one concern denies on one host, the temptation is to restate the package's blocking semantics generally. | 2.2 requires no rule to claim enforcement on a host whose arm came back red, and ties the denominator to the measured set. | Phase 2 — record the result, whichever way it goes |
| 5 | The null is treated as a failure and buried | product | An honest null here is a real result and the proposal says so, but a null after building a package reads as wasted work. | 2.1 requires the ADR to state a cause per concern; a documented failure is an outcome the ADR carries, not an absence. | Phase 2 — record the result, whichever way it goes |

## Acceptance Criteria

- [ ] **AC-1** — `surface-matrix.yml`'s opencode row and the upstream plugin source at the pinned revision agree, with the evidence recorded.
- [ ] **AC-2** — if the channel exists: six concerns each have a red-without-plugin and a green-with-plugin transcript. If it does not: Phase 0 records the null and the roadmap closes.
- [ ] **AC-3** — the plugin package contains no re-implementation of any concern's decision logic.
- [ ] **AC-4** — an ADR states, per concern, `enforced` or `not-enforced` with a cause, leaving none unstated.
- [ ] **AC-5** — no rule's `enforced_by` claims enforcement on a host whose arm came back red.

## Explicitly NOT in this roadmap

The proposal's own exclusions, kept: daemon questions, "AC-as-Runtime" (its
Option B), and any further host. Those are later gates; this is the six-concern
proof and nothing else.

Also not in scope: changing the advisory posture of any existing gate. The gap
this addresses is that a deny cannot land on most hosts, not that the package
declines to try.
