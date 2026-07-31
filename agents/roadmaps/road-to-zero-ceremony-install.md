---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-detection]
related_adrs: [ADR-033, ADR-036, ADR-133, ADR-200, ADR-201]
related_contracts: [gui-wizard]
---

# Road to zero-ceremony install — make the install claim true before making it shorter

> The quickstart promises five minutes, documents its own npm failure mode
> inline, and advertises a flag that does not exist. Close the gap between what
> the install says and what it does, budget the payload that dominates the
> wall-clock, and only then reduce the number of doors.

## Goal

Every statement the install surfaces makes is true of the code that runs, the
npm payload is bounded by a pre-registered budget enforced in CI, and door
retirement happens only after the failure mode that door exists to absorb is
demonstrably covered elsewhere.

## Prerequisites

- [x] Host detection exists for 23 hosts and already pre-selects on first run.
- [x] The wizard's "Recommended" path already runs detection-driven with zero
      user *decisions* — two confirmations, no choices.
- [x] A non-interactive install path already exists and is unit-tested
      (skipped GUI on CI, non-TTY, headless, or any of a dozen flags).
- [x] `setup.sh` is CI-smoked across 3 OS × 2 Node versions.

## Context

Source: an external planning set, audited against the tree on 2026-07-31.
Corrections and refusals: [`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

What the audit changed about this roadmap's shape:

- **The doors are not equivalent.** The draft's verdict was "same Node ≥20
  requirement, zero unique capability". False: the curl door fetches a GitHub
  tarball and runs a dependency-inlined bundle via plain `node`, bypassing npm
  dependency resolution entirely — which is precisely the failure the
  quickstart's own `ETARGET` block documents. The npx door goes through the
  registry and can hit that failure. So the curl door is a **rescue path**, and
  retiring it before the npm path is safe re-breaks exactly the users who need
  it. The council converged on this coupling independently.
- **Its stated rationale has nonetheless rotted.** The installation docs still
  headline the curl door as "no Node required" while the script now requires
  `node`. The differentiator it was documented for is gone even though a real
  one remains. Both facts have to appear in the same breath or the decision gets
  made on a false premise in either direction.
- **"Zero prompts" is already true of the terminal.** An accepted ADR already
  makes the interactive global install zero-terminal-interaction — it hands off
  to the browser instead. The prompts the draft wants to remove are in the
  browser, not the shell. The honest goal is therefore "no browser handoff on
  the default path", which is a different and larger claim.
- **That flip touches a tier-1 rule.** The onboarding gate rule names the
  browser wizard the *sole* onboarding surface and is hook-enforced. Inverting
  the default is a kernel-rule edit under the slow-rollout gate, not a flag
  change — so it lands here as a blocker with the path named, not as a step.
- **`--gui` does not exist.** The README documents it anyway. Doc↔code
  convergence is mandatory regardless of which way the default goes.
- **No `npm pack` size gate exists** anywhere in CI. The payload budget is
  genuinely new work with no conflict.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| README quickstart honesty (drop "Five minutes", move `ETARGET` out) | **KEEP, resequenced** | The block may only leave the quickstart once the failure it documents is covered |
| Fix stale installation docs ("no Node required") | **KEEP, new** | Not in the draft; found by audit; a false premise for the door decision |
| `--gui` flag: implement, and converge docs with code | **KEEP** | The flag is documented and absent — a defect either way |
| Retire `setup.sh` | **KEEP, gated** | No ADR conflict, but a declared public-URL contract with 6-leg CI, and a real rescue path — gated on npm-path coverage |
| Zero-prompt (no browser handoff) as the default | **CUT → blocker** | Conflicts with an accepted ADR and a hook-enforced tier-1 rule; needs a kernel-rule edit under slow rollout |
| Payload budget + `npm pack` size gate | **KEEP** | Nothing enforces size today |
| Bulk-asset diet for the largest skill data dir | **KEEP** | 864 KB of an 8.9 MB payload, measured |
| Merge "Pipeline A/B" into one emitter | **CUT → reduce** | The draft's labels are not this repo's (the repo's Pipeline B is projection→`.augment/`, not the consumer installer); the rule-layer drift it targets is already prevented by a shared predicate; and collapsing `dist/agent-src/` was decided against on scope-discipline grounds. What remains is a narrow audit, below |
| Profile/pack questions deferred to point of need | **CUT** | Already true: packs prefill from the manifest and the Recommended path asks no questions |
| Cold-start wall-clock published as evidence | **KEEP** | Honest structural metric; never a guaranteed number |

## Phase 1 — Make every install statement true

Pure doc↔code convergence. Each item is a defect today.

- [ ] Remove "Five minutes" from the quickstart self-description; state what is
      structurally guaranteed instead (one command, detection-driven, nothing
      written before confirmation).
- [ ] Correct the installation docs' "no Node required" headline for the curl
      door — the script requires `node` today.
- [ ] Correct the installation docs' description of the retired installer
      scripts (they still describe entry points a prior ADR removed).
- [ ] Implement `--gui` as an explicit opt-in flag that forces the wizard, and
      make the README's description of it true. This is additive and does not
      change any default.
      <!-- verify: npx vitest run tests/cli/initRouting.test.ts -->
- [ ] Document the real opt-out set in one place (the non-interactive path
      already skips the GUI on CI, non-TTY, headless, and a dozen flags) — today
      a reader has to infer it from code.
      <!-- verify: npx vitest run tests/cli/initRouting.test.ts -->

**Exit criteria:** no install-surface sentence contradicts the code path it
describes; `--gui` exists and does what the README says; the opt-out set is
documented in one place.
**Rollback:** text-only reverts plus dropping one flag.

## Phase 2 — Cover the npm failure mode the rescue door absorbs

The `ETARGET` block is evidence, not clutter. It leaves the quickstart when the
failure stops happening — not before.

- [ ] Reproduce the documented failure deterministically in CI: an `.npmrc`
      with `prefer-offline=true` plus stale cached metadata, asserting the
      current error.
      <!-- verify: npx vitest run tests/install/npm_resolution.test.ts -->
- [ ] Make the npx path handle it without the user reading prose: detect the
      resolution failure and either retry with fresh metadata or fail with the
      exact one-line remedy. A troubleshooting paragraph is not a fix.
      <!-- verify: npx vitest run tests/install/npm_resolution.test.ts -->
- [ ] Only once that test is green: move the remaining `ETARGET` prose out of
      the quickstart into a troubleshooting page.
- [ ] Record what the curl door still uniquely provides after this phase — a
      registry-independent path — so the retirement decision in Phase 3 is made
      against the post-fix reality rather than today's.

**Exit criteria:** the planted-stale-metadata test reproduces the failure on
pre-fix code and passes after; the quickstart no longer carries recovery prose.
**Rollback:** revert the retry/error change; restore the prose block.

## Phase 3 — Door consolidation, gated on Phase 2

- [ ] Decide the curl door's disposition against the Phase-2 result, and record
      the decision with its reason. Blocker below carries the decision.
      <!-- blocked-by: curl-door-disposition -->
- [ ] If retired: keep the public URL alive as a stub that prints the npx
      one-liner and exits non-zero, add the breaking-change and migration
      entries, and keep the smoke workflow green against the stub rather than
      deleting the workflow.
      <!-- blocked-by: curl-door-disposition -->
- [ ] If retained: fix its documentation to describe what it actually is (a
      registry-independent rescue path that requires `node`) and stop counting
      it as redundant surface.
      <!-- blocked-by: curl-door-disposition -->

**Exit criteria:** the door's disposition is recorded with a reason; the public
URL still resolves either way; the smoke workflow is green.
**Rollback:** restore the script from history; the URL contract was never
broken.

## Phase 4 — Payload budget with CI teeth

- [ ] Measure and pre-register the tarball budget from the current measured
      size; record the measurement conditions alongside the number.
- [ ] Add an `npm pack` size gate to CI that fails above the budget. Nothing
      enforces size today.
      <!-- verify: npx vitest run tests/scripts/check_pack_size.test.ts -->
- [ ] Move the largest skill's bulk data directory (864 KB of an 8.9 MB
      payload) behind a checksum-pinned, versioned lazy fetch on first skill
      use; the skill degrades with a stated reason when the asset is absent and
      the network is unavailable.
      <!-- verify: npx vitest run tests/skills/lazy_assets.test.ts -->
- [ ] Audit the next two largest data directories and record the result —
      measured, not assumed.
- [ ] Add a per-skill payload-share cap to the same gate so no single skill can
      silently reclaim the space.
      <!-- verify: npx vitest run tests/scripts/check_pack_size.test.ts -->

**Exit criteria:** the gate fails on a deliberately oversized fixture and
passes on the real tree; the lazy-fetch path is exercised offline with a stated
degradation.
**Rollback:** drop the gate; restore the data directory to the payload.

## Phase 5 — Narrow emitter audit (what survives of the unification proposal)

- [ ] Audit which consumer-install emitters lack the projection-side predicate
      the rule layer already shares, and list each divergence with its file.
      This is the real content of the draft's "one pipeline" item once the
      already-shared rule predicate is accounted for.
- [ ] For each divergence found, either route it through the shared predicate
      or record why it must differ. Do not collapse the projected tree — that
      was decided against on scope-discipline grounds, and the byte-equality
      invariant between source and projection must survive untouched.
      <!-- verify: npx vitest run tests/install/emit_host_rules.test.ts -->
- [ ] Use this repo's own pipeline names in every artefact this phase touches;
      the source draft's A/B labels mean something different here and a drift
      check reads those names.

**Exit criteria:** every divergence is either routed through the shared
predicate or documented with a reason; the source↔projection byte-equality
check is still green.
**Rollback:** per-emitter reverts; no shared state changed.

## Phase 6 — Cold-start evidence

- [ ] Wall-clock a containerized bare-machine run (install → `doctor` green) in
      CI and publish it as a tracked number with its measurement conditions.
- [ ] State the structural guarantee separately from the number: one command,
      detection-driven, a bounded payload. The wall-clock is evidence, never a
      promise — network and registry latency are not ours to guarantee.

**Exit criteria:** the number is produced by CI with its conditions recorded
next to it.
**Rollback:** remove the job; no shipped claim depends on it.

## Blockers

### blocker: curl-door-disposition
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3
- **What to do:**
  1. Read the Phase-2 result: does the npx path now handle the registry
     resolution failure without prose?
  2. Decide whether a registry-independent install path is still wanted for
     restricted networks and mirrored registries.
  3. Note the constraint either way: the raw URL is a declared public contract
     with CI coverage across 3 OS × 2 Node versions — it must keep resolving
     even if the script becomes a stub.
- **Resolved when:** the disposition is recorded in this roadmap with its
  reason, and the smoke workflow reflects it.

### blocker: browser-handoff-default
- **Status:** open
- **Owner:** maintainer
- **Blocks:** any change making the non-browser path the default
- **What to do:**
  1. Note what is already true: the terminal path is already prompt-free, the
     Recommended path already asks zero questions (two confirmations), and
     detection already pre-selects. The remaining delta is the browser handoff
     itself, not choice overload.
  2. Note what stands in the way: an accepted ADR makes the browser handoff the
     interactive default, and the onboarding-gate rule — tier-1, hook-enforced
     — names the browser wizard the sole onboarding surface. Inverting this is
     a kernel-rule edit: own PR, ≥ 24 h between merges, per the slow-rollout
     gate.
  3. Note what is missing: there is no usage evidence either way, because zero
     external onboarding sessions have completed. The instrument that would
     produce it is the recruited session already open in the adoption roadmap.
  4. Decide: supersede the ADR and edit the rule, or keep the handoff and let
     `--no-ui` remain the documented escape.
- **Resolved when:** an ADR supersession plus a kernel-rule edit PR exists, or
  this roadmap records the handoff as retained by decision.

## Acceptance criteria

- No sentence on any install surface contradicts the code path it describes —
  checked per surface, not asserted globally.
- `--gui` exists and behaves as documented; the opt-out set is documented once.
- The npm resolution failure is reproduced by a test that fails pre-fix, and
  the quickstart carries no recovery prose after it passes.
- The curl door's disposition is recorded with a reason, and its public URL
  resolves either way.
- An `npm pack` size gate exists, fails on an oversized fixture, and carries a
  pre-registered budget with its measurement conditions.
- No single skill exceeds its pre-registered payload share.
- Every emitter divergence from the shared projection predicate is routed or
  documented; source↔projection byte equality is untouched.
- A cold-start wall-clock exists as a CI-produced number with conditions
  attached, and no shipped claim states it as a guarantee.
- The install story's shipped claims stay mechanical: one command, bounded
  payload, nothing written before confirmation. No claim that the install is
  fastest, easiest, or better than any alternative.

## Gate compliance, stated

The composition-ratchet polish gate is OPEN. Phases 1–2 are bug fixes (false
documentation, an unhandled failure the docs work around by hand). Phases 4–6
are CI/claims infrastructure. Phase 3 is a surface *retirement*, which reduces
rather than adds. Phase 5 is a divergence audit. The one item the gate would
genuinely bite — inverting the browser-handoff default — is deliberately a
blocker and not a step.

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory. Every
in-tree premise was re-verified on 2026-07-31; corrections and refusals are in
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

Council 2026-07-31 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
$0.14). Round 1 leaned toward splitting the arc into independent releases;
round 2 reversed on one specific coupling: retiring the curl door and covering
the npm failure mode are the same change, because the door's users are the
users the failure hits. That coupling is why Phase 3 is gated on Phase 2 rather
than sequenced beside it. Both members also converged that the browser-handoff
flip is a default inversion requiring the gate, not a small additive delta —
adopted verbatim as the blocker above. The council framed its answers as
release packaging; that framing is dropped, since roadmaps describe work and
release decisions are taken outside them.
