---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-detection]
related_adrs: [ADR-035, ADR-040, ADR-109, ADR-133]
related_contexts: [host-capability-manifest, subagent-routing, model-recommendations]
---

# Road to host-native model primitives — probe the hosts before deciding whether to emit anything

> Most supported hosts now ship their own model routing — plan/execute splits,
> effort knobs, per-account aliases, complexity auto-routers. Whether this
> package should emit into those knobs is a question an accepted ADR already
> answered "no" for a closely-related mechanism. Settle it with probe data, not
> with a plan.

> **Blocked until** the ADR that governs tier→model mapping enters its recorded
> review window — where revisiting is procedurally cheap rather than a
> supersession fight. Phase 0 is the only part that produces value before then,
> and it produces exactly the evidence that review needs.
>
> **One of the two original conditions is struck.** This roadmap previously also
> waited on the composition-ratchet polish gate. That gate was anchored on
> external adoption and is retired per
> [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
> § D4. The remaining condition is real, reachable, and unrelated to adoption, so
> this roadmap stays parked on its own merits rather than on a zombie.

## Goal

Decide, on probe evidence and inside the governing ADR's own review window,
whether tier→host-native-primitive emission is worth its maintenance surface —
and if it is, ship it as one independently-revertable adapter per host with a
byte-identical fallback everywhere else.

## Context

Source: an external planning set, audited 2026-07-31. Corrections and refusals:
[`zero-ceremony-inbox-cut`](../../settings/contexts/zero-ceremony-inbox-cut.md).

The audit found the draft's proposed *deletions* largely unavailable and its
proposed *emission* in direct tension with an accepted decision:

- **The governing ADR rejected this mechanism by name.** It states that exactly
  one place resolves a tier to a concrete model, that non-Claude agents are
  suggestion-only, and that the package maintains **no per-vendor runtime
  table** — because that creates two-clocks drift as vendors rename models. Its
  rejected-alternatives section names "per-vendor table consumed by the rule".
  Per-host emission adapters are a per-vendor table; storing it as probe data
  makes it auditable, not absent. Superseding that reasoning needs an ADR, and
  the honest argument for one is that projection-time emission is a different
  animal from a runtime table — the same distinction another accepted ADR draws
  for pack filtering. That argument is worth making; it is not worth assuming.
- **The property the draft wants already ships.** The default already emits no
  native model key and never overrides a user's own model choice, and an empty
  tier entry already means "use the tier's runtime default, never a baked-in
  provider model name". "Let the host decide" is the current contract.
- **The proposed key deletions are refused.** Removing the size-fit ladder
  deletes the council's cost-downgrade economics (the loader requires it, and
  the ladder is what makes a too-large request cheaper rather than failed).
  The judge-model key carries Iron-Law status in four judge skills — *never
  silently fall back to a different model than the configured judge* — and the
  judge-asymmetry invariant depends on it. Omitting a model for a vendor-CLI
  member is documented as a **pin**, not "latest", deliberately.
- **What is genuinely stale is narrower than the draft claimed:** the pinned
  model IDs in the council template. That is a template edit, not a schema
  deletion — and it is the whole of the verified staleness exhibit. The council
  debate that reviewed this cut ran on those exact pins, which is the most
  direct evidence available that they are stale.
- **A host-lifecycle finding stands on its own merit:** sources disagree about
  whether one supported host's CLI is current or superseded. That belongs in
  probe data with a `lifecycle` field, not in prose — and it is an argument for
  adapters-as-data regardless of how the emission question resolves.
- **Starting the adapter layer is itself gated.** Under the subsystem-freeze
  ADR, a new platform integration is a "large subsystem"; its unblock conditions
  currently hold but one rides a defer that lapses in weeks. Probes are not a
  subsystem; adapters are.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| Per-host capability probes producing versioned records | **KEEP** | The only part that is cheap, useful, and evidence-producing regardless of outcome |
| `lifecycle: active\|deprecated\|sunset\|unknown` per host, refreshed by probe | **KEEP** | Resolves a live source contradiction in data instead of prose |
| Manifest model-routing fields | **KEEP, gated** | Additive and safe, but pointless until the emission question is settled |
| Per-host emission adapters | **CUT → gated on an ADR** | The mechanism an accepted ADR rejected; needs supersession, argued on the projection-time-vs-runtime-table distinction |
| "Ride, don't race" policy | **KEEP** | Correct, and it is the strongest argument that emission stays narrow |
| Delete `model_ladder` | **CUT** | Deletes cost-downgrade economics the loader requires |
| Delete the judge-model key | **CUT** | Iron-Law status in four judge skills; judge asymmetry depends on it |
| Delete the tier→model map | **CUT** | Its empty-entry semantics already deliver the intended neutrality |
| Optional `pin:` replacing the deleted keys | **CUT** | Re-opens the portable-frontmatter rule that forbids tool-specific keys in portable source; per-run pin escapes already exist |
| Fix the stale pinned model IDs | **KEEP, small** | The real, verified staleness — a template edit |
| Council api-mode catalog discovery + price banding | **KEEP, last** | Under a CLI-preferring default this is the fallback rung's helper; build only if the fallback rung sees real use |

## Phase 0 — Probes (the only phase that pays before the gates lift)

- [ ] One probe script per supported host under `src/scripts/host_probes/`,
      each producing a versioned JSON capability record with a source URL and a
      checked date. A probe is a documentation-and-flag check, never a
      benchmark and never a paid call.
      <!-- verify: npx vitest run tests/scripts/host_probes.test.ts -->
- [ ] Implement the probes *inside* the shared detector from
      `road-to-zero-ceremony-detection` — one detection module, consumed here.
      A second detection path is the failure this sequencing exists to avoid.
- [ ] Fill every unknown column per host; a host with unknowns in its record is
      ineligible for emission by construction.
- [ ] Add the `lifecycle` field and resolve the live source contradiction about
      one host's status with a dated probe record rather than prose.
- [ ] Add a probe-record lint: `sunset` or `unknown` lifecycle blocks new
      emission work in CI, so a host shutdown can never strand a fresh adapter.
      <!-- verify: npx vitest run tests/scripts/host_probes.test.ts -->
- [ ] Make the host matrix generated output from the records — never
      hand-maintained prose. The draft's own matrix is already a snapshot of a
      fast-moving surface; that is the argument for generating it.

**Exit criteria:** every supported host has a probe record with source and date;
the matrix is generated; the lifecycle lint fails on a synthetic sunset record.
**Rollback:** delete the probe scripts and records; nothing consumes them yet.

## Phase 1 — Fix the verified staleness (independent of everything above)

- [ ] Update the council template's pinned model IDs to current line-ups, and
      state in the template comment that an omitted model for a vendor-CLI
      member is a pin rather than "latest" — the behaviour is already
      documented, but the pins being stale is what made it bite.
- [ ] Record whether a staleness *check* is feasible without a network call at
      lint time; if it is not, say so rather than shipping a gate that needs the
      network to pass.

**Exit criteria:** no shipped pin is more than one line-up behind at the time of
the change; the feasibility note exists either way.
**Rollback:** revert the template edit.

## Phase 2 — The emission decision (ADR, not a step)

- [ ] Write the ADR that either supersedes the tier-mapping decision for
      projection-time emission or records emission as refused. Argue the
      distinction explicitly: a projection-time emitter fed from the same tier
      source is arguably one clock, whereas a runtime table consulted per call
      is two. Name which of the two the proposal actually is.
      <!-- blocked-by: adr-035-review-window -->
- [ ] If superseded: extend the host-capability manifest with routing fields,
      all-none as the safe default, and pin the degenerate all-none host as
      byte-identical to today's behaviour — the no-regression invariant.
      <!-- blocked-by: adr-035-review-window -->
- [ ] Re-express judge asymmetry per capability class without weakening it:
      model-split hosts one band up, effort-split hosts one effort rung up with
      a floor, native-router hosts annotation-only. The invariant survives the
      re-expression or the re-expression is wrong.
      <!-- blocked-by: adr-035-review-window -->

**Exit criteria:** an ADR exists that either authorises emission with its
supersession named, or records refusal with its reason.
**Rollback:** none — the ADR is the deliverable.

## Phase 3 — Adapters, one host per change, only if Phase 2 authorises

- [ ] One adapter per host, each independently revertable, each gated on its
      own probe record being complete.
      <!-- blocked-by: adr-035-review-window -->
- [ ] No adapter writes config on a host whose own auto-router is
      authoritative — recommendation surfaces only. Ride-don't-race is a tested
      invariant here, not a sentence.
      <!-- blocked-by: adr-035-review-window -->
- [ ] Hosts without a complete probe record keep the existing suggest-mode
      floor, documented per host.

**Exit criteria:** on each adapter host, tiered work routes through that host's
native primitive with no model ID typed by the user; on every other host,
behaviour is byte-identical to today.
**Rollback:** per-host revert; the suggest floor is the fallback by construction.

## Blockers

### blocker: adr-035-review-window
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phases 2 and 3
- **What to do:**
  1. Read the tier-mapping ADR's rejected-alternatives section, which names a
     per-vendor table consumed by the rule as the rejected mechanism.
  2. Decide whether projection-time emission is materially different from that
     rejected runtime table — the distinction another accepted ADR already
     draws for pack filtering is the strongest available argument that it is.
  3. Note the timing advantage: that ADR carries a recorded review window, so
     revisiting inside it is cheap; outside it, this is a supersession fight for
     a feature whose user-visible benefit is "no model ID typed" on a subset of
     hosts.
- **Resolved when:** an ADR exists authorising or refusing emission, naming what
  it supersedes.

### blocker: polish-gate-open
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phases 2 and 3 (Phase 0 probes and Phase 1's template fix are
  evidence and bug-fix work respectively)
- **What to do:** RESOLVED 2026-08-05 by the gate's own second exit clause —
  `road-to-adoption-without-narrative-debt` was disposed to
  `agents/roadmaps/skipped/`. The first clause ("3 external adoptions") is struck
  outright by
  [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  § D5. Phases 2 and 3 now wait only on the tier-to-model ADR's review window,
  which is the roadmap's other and genuinely reachable condition.
- **Resolved when:** resolved. Kept rather than deleted so the disposition stays
  visible.

## Acceptance criteria

- Every supported host has a probe record with a source URL and a checked date;
  the host matrix is generated from those records, never hand-edited.
- The lifecycle lint blocks emission work for a host whose probe reports sunset
  or unknown.
- The shipped model pins are current, and whether a network-free staleness check
  is feasible is recorded either way.
- No key with cost-downgrade or judge-asymmetry responsibility is deleted.
- If emission ships: an ADR names what it supersedes; the degenerate all-none
  host is byte-identical to today; no adapter writes config on a host whose own
  router is authoritative.
- No adapter claims a quality win. The only claims available are mechanical:
  zero user-typed model IDs on adapter hosts, and byte-identical behaviour
  elsewhere. Whether native-primitive routing beats a user's manual pick belongs
  to the parked routing-quality evaluation, not here.

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory — which is
why its central mechanism collides with an accepted ADR it never cites. The
host-matrix rows are doc-sourced snapshots of a fast-moving surface; Phase 0
exists to convert them into re-runnable probes before any adapter is considered.
Corrections and refusals:
[`zero-ceremony-inbox-cut`](../../settings/contexts/zero-ceremony-inbox-cut.md).
