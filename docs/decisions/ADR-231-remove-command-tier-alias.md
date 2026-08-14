---
adr: 231
status: accepted
date: 2026-08-14
decision: remove-command-tier-alias
supersedes: ADR-092
superseded_by: —
phase: road-to-tier-removal
type: structural
review_trigger: >-
  Reopen when (a) an external consumer of the integer `tier` key surfaces and
  reports breakage — the risk this decision ACCEPTED rather than disproved, in
  which case the rollback below is the response, (b) a runtime surface lands
  that can observe external manifest reads, which would let a future removal be
  evidenced instead of waived, or (c) the frozen `visible→0 / advanced→1 /
  internal→2` mapping ever stops being lossless, which is what makes the
  rollback a regenerate-and-publish rather than a redesign.
---

# ADR-231 — Remove the command `tier:` alias; `visibility:` is the sole classifier

- **Status:** Accepted (2026-08-14)
- **Supersedes:** [`ADR-092`](ADR-092-defer-command-tier-alias-removal.md) — the deferral it recorded is discharged by this decision.
- **Amended by, and built on:** [`ADR-137`](ADR-137-amend-tier-removal-reopen-triggers.md) (withdrew the structurally impossible second re-open trigger, leaving a maintainer-set sunset as the sole gate).
- **Related:** [`ADR-090`](ADR-090-visibility-command-frontmatter-field.md) (`visibility` as the named field); `agents/roadmaps/road-to-tier-removal.md`; `docs/contracts/command-surface-tiers.md`; `docs/contracts/discovery-manifest.schema.json`.

## Context

ADR-090 made `visibility:` (`visible` / `advanced` / `internal`) the named
command-surface classifier and kept the integer `tier:` (`0` / `1` / `2`) as a
back-compat alias. ADR-092 then deferred dropping the alias: the published
discovery manifest dual-emitted it, and the set of external npm consumers
reading the integer was unknown.

ADR-137 corrected the gate. The roadmap's re-open trigger set had two legs
joined by "exactly ONE must clear", but the second — evidence of zero external
reads — is impossible by construction in a no-runtime, file-first package with
no fetch endpoint. Withdrawing it left one leg with one unmet part: a concrete,
maintainer-set `sunset`.

On 2026-08-13 the maintainer set it (`sunset: '2026-08-13'`) and, asked
directly, answered *"sofortige Entfernung. wir haben lange genug gewartet."*
That is two acts: the date, and an express waiver of the wait-for-it-to-pass
leg.

## Decision

Remove the integer `tier` alias from every live surface:

- `tier:` is dropped from all 200 `src/domains/**/command.md` frontmatters.
- The `tier` property is removed from `command.schema.json`. Because that schema
  is `additionalProperties: false`, a leftover `tier:` is now a hard validation
  failure rather than something to reconcile.
- `lint_command_tiers.ts` enforces `visibility` alone; its tier↔visibility
  consistency clause is deleted. The **filename and gate id are kept** — the
  Taskfile entry, the CI workflow step, and the contract doc all key on them,
  and renaming would be a larger diff than the removal itself.
- The discovery manifest stops emitting `tier` on command artefacts, and its
  version goes **2 → 3**.
- The display-only `tier` fallbacks are dropped from `commands.ts`,
  `loadManifest.ts`, `build_catalog_index.ts` and `gen_discovery_baseline.ts`.

### Why the manifest version bumps

Dropping a published field is a breaking change for any consumer reading it,
and the manifest schema's own rule is "Bump on breaking change". Leaving it at
v2 would let a consumer that pins the version discover a silently-absent field
instead of a version it can test for. The `deprecations` entry is **retained**
with a new `removed_in: 3`, so a consumer still reading the old key can learn
what replaced it and when it went — an absent entry would say neither.

### What is deliberately NOT removed

- `audit_command_surface.ts`'s `_tier_at_ref` / `_is_visible_tier` — they read
  `tier:` out of **past** git revisions for the surface-growth baseline, and
  pre-ADR-090 blobs carry only the alias. Removing them would make every
  already-visible command look newly promoted.
- `lint_command_verbs.ts`'s `tier` fallback — same reason: it parses baseline
  blobs via `git show`.
- `lint_command_routing.ts` and `install.ts` keep their `visibility`-first,
  `tier`-fallback precedence. For `install.ts` the fallback is live back-compat:
  a consumer may hold a locked v2 manifest on disk that still carries the key.

## Consequences

- One classifier, one vocabulary. The silent-default failure mode the Phase-2
  migration removed internally cannot return through the alias.
- A v2-pinning manifest consumer breaks, loudly, on the version rather than
  quietly on a missing field.
- The `--tier=` CLI flag and the Tier-0/1/2 **taxonomy** are untouched: they are
  the naming of the three surface bands, not the frontmatter key. The contract
  now states the mapping explicitly (Tier-0 ↔ `visible`, and so on).

## The honesty note this decision must carry

**The unknown-consumer risk was accepted, not disproved.** The soak's measurable
half is clean — the deprecation signal shipped in npm 8.10.0 (2026-07-10) and
ran across 13 published versions, and `gh issue list --search "tier"` has always
returned empty. But no evidence ever showed zero external reads, and none could:
the 2026-06-16 council ruled fetch telemetry infeasible here. Known adoption is
roughly 7 stars and 1 fork, so quiet is close to uninformative. The maintainer
weighed that and judged the window sufficient. That is squarely their call — it
is **not** a measurement, and nothing in this repo should later cite it as one.

The standing mitigation is that the removal is cheaply reversible and **lossless**:
the mapping `visible→0`, `advanced→1`, `internal→2` is frozen, so restoring
`tier` is a regenerate-and-publish (re-add the schema property, re-enable the
dual-emit, derive the frontmatter key mechanically), not a redesign. No
information was destroyed. The three readers migrated in Phase 2 already prefer
`visibility` and keep a `tier` fallback, so they work with or without the alias
and need no reverting.

## Alternatives considered

1. **Keep deferring until the soak leg is genuinely met.** Rejected by the
   maintainer, explicitly and on the record. It was also close to unfalsifiable:
   with no way to observe reads, "the soak passed" could only ever mean "nobody
   complained", which is what the last month already showed.
2. **Remove the key but keep the manifest at v2.** Rejected — it hides a
   breaking change behind an unchanged version number, which is the failure the
   schema's own bump rule exists to prevent.
3. **Drop the `deprecations` entry along with the key.** Rejected — a consumer
   arriving after the removal is exactly the reader who needs the migration
   pointer most.
4. **Rename `lint_command_tiers.ts` to match what it now checks.** Deferred, not
   rejected: it would touch the Taskfile, the CI workflow, the contract and the
   test file for a cosmetic gain, and would bury the actual removal in a rename
   diff.
