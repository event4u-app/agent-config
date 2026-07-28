---
adr: 137
status: accepted
date: 2026-07-28
decision: amend-tier-removal-reopen-triggers
supersedes: —
superseded_by: —
phase: road-to-tier-removal
type: structural
review_trigger: >-
  Reopen when (a) a timestamped commit PRIOR to the roadmap's publication shows
  the maintainers already knew Trigger 2 was impossible when they wrote "exactly
  ONE must clear" — that would prove the OR-clause always had a single real leg,
  making the existing soak evidence sufficient on its own terms and this
  amendment unnecessary (the council's recorded dissent), (b) a runtime surface
  ever lands that CAN observe external manifest reads, which would resurrect
  withdrawn Trigger 2 as a genuine alternative, or (c) an external consumer of
  the integer `tier` key is identified — which converts the unknown-consumer
  risk into a known one and requires a migration path, not just a sunset date.
---

# ADR-137 — Amend the `tier`-removal re-open triggers: withdraw the impossible one, keep the sunset gate

- **Status:** Accepted (2026-07-28)
- **Amends:** [`ADR-092`](ADR-092-defer-command-tier-alias-removal.md) (the defer decision and its trigger set). ADR-092 is **not** superseded — its deferral stands; only the trigger set is corrected.
- **Related:** [`ADR-090`](ADR-090-visibility-command-frontmatter-field.md) (`visibility` as the named field); [`ADR-051`](ADR-051-uncondensed-source-container-relocation.md); `agents/roadmaps/road-to-tier-removal.md`; `docs/contracts/command-surface-tiers.md`; `src/rules/decision-revisit-gate.md`.

## Context

ADR-092 deferred dropping the integer `tier:` command classifier because the
published `discovery-manifest.json` dual-emits it and external npm consumers are
unknown. The deferral was institutionalised in `road-to-tier-removal` with two
pre-registered re-open triggers, of which **exactly one** had to clear before
removal:

1. **Versioned manifest** — a v2 manifest ships; the deprecated key carries a
   deprecation signal **plus a maintainer-set sunset**; a soak window passes with
   no breakage reported.
2. **Zero-external-read evidence** — manifest-fetch telemetry shows no external
   integer-`tier` reads.

Both legs are now known to be unsatisfiable as written:

- **Trigger 2 is impossible by construction.** A 2026-06-16 council ruled fetch
  telemetry infeasible in a no-runtime / file-first package: there is no server
  and no fetch endpoint, so external reads cannot be observed under any manifest
  shape. Critically, that ruling came **after** the trigger set was written — at
  authoring time both legs were believed achievable.
- **Trigger 1 is two-thirds met.** Verified 2026-07-28 by unpacking the real npm
  tarball of 8.10.0: `dist/discovery/discovery-manifest.json` carries
  `version: 2` and a top-level `deprecations` entry for `tier`
  (`replacement: visibility`, `since: ADR-092`). The signal has been published
  continuously from 8.10.0 (2026-07-10) through 9.8.0 (2026-07-26) — 13 published
  versions across 18 days — and `gh issue list --state all --search "tier"`
  returns an empty list, so no external breakage has ever been reported. But the
  published `sunset` is **`null`**: no sunset date was ever set, and "maintainer-set
  sunset" is a conjunct of the trigger, not a formality.

The tempting move is to treat Trigger 2 as "inert rather than blocking" and read
Trigger 1's soak as effectively satisfied. A 2026-07-28 AI council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds) rejected that on both
members' reasoning, and this ADR records why.

## Decision

**1. Trigger 2 is withdrawn** from the re-open set as structurally impossible in
a no-runtime package. It is recorded as withdrawn, not silently dropped.

**2. Trigger 1 becomes the sole gate**, unchanged in substance: a published
`sunset` date on the `tier` deprecation entry, and that date passing with no
external breakage reported.

**3. Setting the sunset date is a maintainer act, not an agent act.** The agent
may record the amendment, gather the soak evidence, and prepare the removal; it
may not choose the date.

**4. Nothing is removed until the amended gate clears.** The 18-day / 13-version
quiet window is logged as supporting evidence, explicitly **not** as gate
satisfaction.

## Rationale

- **An OR-clause whose second leg becomes impossible is a broken gate, not a
  one-leg gate.** When the trigger set was published, both legs were live
  alternatives. Reinterpreting it after the fact as "the achievable leg was
  always the only real one" retro-fits the gate to whichever leg survived. The
  honest repair is an explicit amendment with the reasoning on the record — which
  is what this ADR is.
- **Low risk is not gate satisfaction.** The council's sharpest line, verbatim:
  *"This conflates 'the risk is low' with 'the gate is satisfied'. If we bypass an
  unsatisfied gate because we've separately convinced ourselves the risk is low,
  we've just deleted the gate while pretending to respect it."* The whole point of
  pre-registering a trigger is to separate risk assessment from execution.
- **`sunset: null` is a published factual claim.** The manifest is a data contract.
  Removing `tier` while the shipped artifact says no sunset was set would
  contradict the package's own published state — the failure mode its
  honest-nulls positioning exists to prevent.
- **The quiet window is weak evidence on this package.** Known adoption is ~7
  GitHub stars and 1 fork with no documented external adopter, so "no issues
  filed" is close to uninformative about unknown consumers. Saying so is cheaper
  than discovering it through a broken consumer.
- **Amending is not relitigating.** Per `decision-revisit-gate`, a lock encodes
  what was true when written. The infeasibility ruling is new information about
  the *mechanism the trigger named*, so correcting the trigger is in-scope; the
  underlying deferral decision is untouched.

## Consequences

**Positive**

- The gate is executable again: one concrete maintainer act (publish a sunset
  date) unblocks the whole removal path, instead of an unsatisfiable conjunction.
- The removal is now small and safe. The internal Runtime-Risk readers were
  migrated to `visibility` on 2026-07-28 under the same roadmap, so what remains
  is the emitter, the schema property, the consistency clause, the frontmatter
  keys, and four display-only fallbacks.
- The reasoning survives the session: a future maintainer reading the trigger set
  will not have to rediscover that one leg was impossible.

**Negative / accepted cost**

- Removal is delayed by at least one publish cycle plus the chosen sunset window,
  after 18 days of quiet that many maintainers would have treated as sufficient.
  That delay is the price of not deleting a gate while claiming to respect it.
- `tier` keeps being dual-emitted meanwhile, so the manifest stays slightly
  larger and the deprecation stays visible to consumers for longer.

**Revisit condition (recorded dissent).** One council member named the evidence
that would reopen the rejected reading: a timestamped commit **prior** to the
roadmap's publication showing the maintainers already knew Trigger 2 was
impossible when they wrote "exactly ONE must clear". That would prove the
OR-clause always had a single real leg, making the current soak evidence
sufficient on its own terms and this amendment unnecessary.

## Alternatives considered

- **Treat Trigger 2 as inert and Trigger 1's soak as satisfied; remove now.**
  Rejected: silently edits a published gate, and contradicts the shipped
  `sunset: null`. This was the position argued in council round 1 and abandoned
  by its own author in round 2.
- **Set the sunset date in this run and start the clock immediately.** Rejected:
  the council was explicit that the date "would need to be set by a human
  maintainer to ensure accountability and intentionality, rather than by an
  automated agent making potentially uninformed decisions". The date encodes how
  much notice unknown consumers deserve — a judgement the agent has no basis for.
- **Withdraw both triggers and defer removal indefinitely.** Rejected: it
  converts a solvable evidence problem into a permanent block, and the `tier`
  alias would then be carried forever by default rather than by decision.
- **Remove `tier` only from internal code and keep emitting it forever.**
  Rejected as a decision, adopted as an intermediate: the internal migration
  landed, but "forever" would leave the manifest advertising a deprecation that
  never resolves.

## References

- `agents/roadmaps/road-to-tier-removal.md` — Phase 1 soak evidence, Phase 2
  just-in-time audit + internal migration, blocker `trigger-set-amendment`.
- `docs/contracts/command-surface-tiers.md` — the tier/visibility contract.
- `src/scripts/build_discovery_manifest.ts` — the `deprecations` block where the
  sunset date lands.
