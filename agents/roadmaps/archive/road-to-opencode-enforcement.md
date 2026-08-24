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

- [x] **0.1 Verify whether opencode exposes a plugin API with a deny verdict**, at
      the pinned revision the proposal names. This needs a network fetch and is
      therefore a human or an explicitly network-authorised step, not an offline
      one.
      verify (discharged 2026-08-24): **all four resolve**, with file and line, in
      `agents/evidence/analysis/opencode-plugin-api-verification.md`.
      `permission.ask` (`index.d.ts:225`) · `tool.execute.before` (`:235`) ·
      `shell.env` (`:242`) · `experimental.chat.system.transform` (`:265`).
      **The proposal's premise was right and the committed config was wrong** —
      which is the direction `b-opencode-plugin-api-unverified` said exactly one of
      them had to be.

      **The pin is `1.18.21`, not `6386e67`, and that substitution is disclosed
      rather than glossed.** The blocker asked for a source file at a git sha; the
      published `@opencode-ai/plugin` and `@opencode-ai/sdk` type declarations were
      read instead — a stronger artefact for this question (it is the contract a
      plugin author compiles against), but **not the same artefact**, and
      equivalence was not demonstrated.

      **Two findings the proposal did not anticipate, and they are why 0.3 could
      not be written as specified.** (1) There is exactly ONE deny and it is not on
      the tool path: `tool.execute.before` output is `{ args: any }` — mutate-only,
      no refusal — so a concern gets every-call coverage OR the ability to refuse,
      never both, unlike Claude's `pre_tool_use`. (2) `Permission` carries **no
      tool name, arguments or path** as typed fields, only `pattern?` and an
      untyped `metadata` — and four of the six concerns 0.3 names decide on exactly
      those. The two needing no deny are the two that fit.
- [x] **0.2 Reconcile `surface-matrix.yml` with 0.1's answer in the same change.**
      If the channel exists, `hooks: none` and *"no plugin channel"* are stale and
      the matrix is wrong on a shipped host. If it does not, the proposal is wrong
      and this roadmap stops here.
      verify (discharged 2026-08-24): the row reads `hooks: plugin` and its notes
      cite the evidence file, `lint_surface_matrix` and
      `lint_supported_tools_matrix` both green.

      **`hooks: none` and "no plugin channel" were stale on a shipped host**, and
      `hook_manifest.yaml`'s zero opencode entries reflected that stale row rather
      than an upstream limitation.

      **`unbound` was tried first and refused, correctly.**
      `lint_surface_matrix`'s enum is
      `{managed-settings-block, settings-hooks-opt-in, plugin, none}`, and the
      refusal is right on the merits: every row in that file describes what the
      HOST offers, and whether this package binds it is `hook_manifest.yaml`'s
      business — where opencode still has **zero** entries. The notes carry the
      not-bound-here fact so the row cannot be read as a delivered capability.
- [x] **0.3 If and only if 0.1 is positive, write the PREREG.** One file,
      `internal/bench/opencode-enforcement-PREREG.md`, fixing six concerns before
      any measurement: `block-kernel-rule-writes`, `block-config-weakening`,
      `block-no-verify`, `git-authorization` (in the op-split semantics whose
      vector tests are the red/green template), `hardenedSpawnEnv` → `shell.env`,
      and kernel projection → `experimental.chat.system.transform`.
      verify (discharged 2026-08-24): `internal/bench/opencode-enforcement-PREREG.md`
      states, per concern, its criterion before any measurement.

      **Six, not two — and the form is what makes six honest.** One council seat
      argued for pre-registering only the two writable concerns and deferring four;
      the other argued that BRANCHES are writable for all six and that "unknown
      result" and "unwritable test" are different things. The second carried, and
      the first's objection is honoured by the form: the four deny-dependent
      concerns do not carry `criterion: undetermined` — that would not be a
      pre-registration — but a **capability probe with three predetermined
      outcomes** (all three hold → red/green; any fails → *unsupported on this host
      surface*, no enforcement claim; no transcript → **unevaluated**, which is
      neither).

      That third outcome is the state B1–B4 are in today, and naming it is the
      point: an autonomous run cannot install a plugin or drive a live session, so
      the honest reading is *unevaluated*, never *unsupported*.

      **Group A is fully writable now** — `shell.env` and
      `chat.system.transform`, both mutate-only, both matching their hook exactly.

      The PREREG also fixes the **translator invariant** as a measured property: a
      green in Group B counts only if the canonical script produced the verdict. A
      plugin that reads `metadata` and decides for itself falsifies the translator
      classification instead of counting.

## Phase 1 — a thin carrier, never a second source of truth

- [~] **1.1 A plugin package that translates host hooks onto the existing <!-- deferred: transferred to agents/roadmaps/stubs/road-to-opencode-runtime-probe.md — needs an installed plugin and a live opencode session -->
      dispatcher.** `@event4u/agent-config-opencode` in the monorepo: a thin
      hook→`dispatch.js` translator with **no duplicated concern logic**. The
      scripts stay the one source; the plugin is a second carrier.
      verify: the package contains no copy of any concern's decision logic —
      `grep -rn 'block-kernel-rule-writes\|block_config_weakening' <pkg>/src` finds
      only dispatch wiring, never a re-implementation.
- [~] **1.2 Per-concern red/green arms, exactly as the PREREG fixed them.** <!-- deferred: transferred with 1.1; Group B additionally gated on the runtime probe --> Each
      concern is demonstrated red without the plugin before its green counts —
      sensitivity by sabotage, not by assumption.
      verify: six transcript pairs, one per concern, each showing the action
      happening without the plugin and denied with it.

## Phase 2 — record the result, whichever way it goes

- [~] **2.1 An ADR carrying the outcome per concern.** <!-- deferred: there is no per-concern outcome to record until the transferred arms run; the fifth-state table in hook-architecture-v1.md carries the per-concern CAPABILITY in the meantime --> A documented failure with a
      named cause is a valid result and is the honest-null path the proposal
      itself declares.
      verify: the ADR states, per concern, `enforced` or `not-enforced` plus the
      cause, and no concern is left unstated.
- [~] **2.2 Correct the enforcement-coverage claims that this changes.** <!-- deferred: nothing to correct yet — no concern denies on opencode, and check_enforcement_coverage's denominator moves only when one does --> If any
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
- **Status:** resolved.
- **Resolution (2026-08-24):** the row now reads `hooks: plugin` and the evidence
  is `agents/evidence/analysis/opencode-plugin-api-verification.md`. **The
  proposal was right; the committed config was wrong** — `hooks: none` and "no
  plugin channel" were stale on a shipped host, and all four hook names resolve
  with file and line.

  **Two qualifications on the resolution, because neither is cosmetic.** The pin
  is **`1.18.21`, not the `6386e67` this blocker asked for** — the published type
  declarations were read instead of a source file at a sha, and equivalence was
  not demonstrated. And the channel is **narrower than "has a deny" suggests**:
  `permission.ask` is the only refusal and fires only where the host already asks,
  while `tool.execute.before` is mutate-only. That narrowness is what
  `docs/contracts/hook-architecture-v1.md` § The fifth state now records.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — recorded in `hook-architecture-v1.md`, and the answer
  is CONDITIONAL rather than the flat "translator" the recommendation proposed.**
  AI council 2/2 convergent. A plugin denial is a **new authority surface** if the
  plugin interprets `pattern` or `metadata` and derives a verdict the canonical
  script did not produce; it stays a **translator** only if it losslessly
  normalizes host input, invokes the existing script, and returns that script's
  verdict unchanged. **A type declaration cannot settle which**, so no
  classification is asserted in advance — the PREREG makes it a measured property
  instead, and a green whose verdict came from plugin-local logic falsifies the
  translator reading rather than counting.

  **The four-state model needed a FIFTH state**, and both seats reached that
  independently: `bound-but-capability-limited` — the host honours a blocking
  result, but invocation coverage or the availability of the canonical policy
  inputs is not guaranteed. opencode occupies it. Forcing it into one of the four
  would have been a false claim in either direction: `bound, can deny` asserts an
  enforcement nobody measured, `no surface` asserts a limitation that is false.

  **The classification is per CONCERN, never per host** — also both seats,
  independently, and it is the part that stops the state becoming a blanket claim.
  The contract carries a six-row table: two concerns **writable** (mutate-only,
  matching their hook exactly), four **probe-gated** (they need decision inputs
  `Permission` does not type).

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

- [x] **AC-1** — `surface-matrix.yml`'s opencode row and the upstream plugin source at the pinned revision agree, with the evidence recorded.
      **Met, with the pin corrected in the record rather than in the claim:** the row agrees with `@opencode-ai/plugin@1.18.21`, which is **not** the `6386e67` this criterion's blocker named. The substitution and its unproven equivalence are stated in the evidence file, in the roadmap step, and in the contract subsection.
- [~] **AC-2 — Preregistered opencode capability and behaviour evidence.** Before implementation, all six concerns define falsifiable fixtures and expected outcomes. `hardenedSpawnEnv` through `shell.env` and kernel projection through `experimental.chat.system.transform` each require red-without-plugin and green-with-plugin transcripts. Each deny-dependent concern — `block-kernel-rule-writes`, `block-config-weakening`, `block-no-verify`, `git-authorization` — first requires an `opencode-permission-payload-and-coverage` transcript proving that `permission.ask` fires for the guarded operation, exposes sufficient input for lossless normalization into the canonical enforcement script, and honours the script's denial. If capability is proved, that concern additionally requires red-without-plugin and green-with-plugin transcripts. If capability is disproved, the transcript records the concern as unsupported by this host surface and **no enforcement claim may be made**. Absent runtime evidence, the concern and AC-2 remain **incomplete**.

      **REPLACED 2026-08-24 (council 2/2). The original had no true branch.** It read *"if the channel exists: six concerns each have a red-without-plugin and a green-with-plugin transcript. If it does not: Phase 0 records the null and the roadmap closes."* The channel **exists** — so the null branch is unavailable — and the transcripts need a live session, so the transcript branch is unreachable offline. A criterion whose only two branches are both closed cannot be met or honestly failed.

      **Current state: the pre-registration half is DONE** (`internal/bench/opencode-enforcement-PREREG.md`, six concerns, branches fixed in advance). The transcript half is transferred to `stubs/road-to-opencode-runtime-probe.md`. B1–B4 are **unevaluated** — deliberately not *unsupported*, which would report a host limitation nobody established.

      **Marked `[~]` 2026-08-24, closing a bookkeeping gap rather than taking a new decision.** The council's 2/2 replacement of this criterion already transferred its transcript half; the box stayed `[ ]` while AC-3 and AC-4 — transferred for the same reason on the same day — were marked `[~]`. Three criteria resting on one transfer were reporting two states.

      Group A does not rescue it, and the stub says why in as many words: `hardenedSpawnEnv` → `shell.env` and kernel projection → `experimental.chat.system.transform` *"wait on the plugin package, not on the probe"* — and the plugin package IS 1.1, which transferred. So **both** halves of the transcript requirement sit behind the stub, not just Group B's four probe-gated concerns.
- [~] **AC-3** — the plugin package contains no re-implementation of any concern's decision logic. <!-- deferred: transferred with 1.1 — there is no package yet to check -->
      Transferred with 1.1. The invariant it encodes is **stronger** than a grep now: the PREREG's translator clause makes "the canonical script produced the verdict" a condition on every Group-B green, so a package that re-implements logic fails the measurement rather than only a text search.
- [~] **AC-4** — an ADR states, per concern, `enforced` or `not-enforced` with a cause, leaving none unstated. <!-- deferred with 2.1 — no per-concern outcome exists until the transferred arms run -->
      **The per-concern CAPABILITY is already stated**, which is the half that was decidable offline: `hook-architecture-v1.md` § The fifth state carries a six-row table — two **writable**, four **probe-gated** — with the missing decision input named per row. What is not stated is `enforced` / `not-enforced`, because nothing has been enforced or refused yet.
- [x] **AC-5** — no rule's `enforced_by` claims enforcement on a host whose arm came back red.
      **Met, and met vacuously — which is worth saying rather than presenting as a pass.** No arm has run, and no rule names opencode in `enforced_by`; `hook_manifest.yaml` carries zero opencode entries. The criterion is satisfied because nothing was claimed, not because a claim was checked. The PREREG's disproved-capability branch is what keeps it satisfied later: a concern whose probe fails is recorded unsupported and **may not** appear in an `enforced_by` line.

## Explicitly NOT in this roadmap

The proposal's own exclusions, kept: daemon questions, "AC-as-Runtime" (its
Option B), and any further host. Those are later gates; this is the six-concern
proof and nothing else.

Also not in scope: changing the advisory posture of any existing gate. The gap
this addresses is that a deny cannot land on most hosts, not that the package
declines to try.
