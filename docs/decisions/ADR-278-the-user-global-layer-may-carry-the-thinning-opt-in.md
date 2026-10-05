---
adr: 278
status: accepted
date: 2026-10-05
decision: lean-projection-mode-and-hosts-are-mergeable-from-the-user-global-settings-layer
supersedes: —
superseded_by: —
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: delegated
  decision_makers: [agent]
  human_directed: true
evidence:
  strength: E1
  basis:
    - src/scripts/_lib/agent_settings.ts
    - src/scripts/_lib/lean_projection_mode.ts
    - src/install/installThinLayer.ts
    - tests/lib/agent_settings.test.ts
    - tests/scripts/install_thin_layer.test.ts
    - agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md
review_trigger: >-
  Reopened if `lean_projection` gains a key whose correct scope is per-project
  rather than per-machine, or if a consumer is observed wanting a different
  thinning mode in two checkouts on one machine — which this decision makes
  impossible to express for the global rule layer, deliberately.
---

# ADR-278 — The user-global layer may carry the thinning opt-in

## Status

accepted

## Context

`load_agent_settings` filters the user-global layer through `MERGEABLE_KEYS`
before merging it. `lean_projection.mode` and `lean_projection.hosts` were not on
that list, so a value written into
`~/.event4u/agent-config/settings/.agent-settings.yml` was read, dropped, and the
shipped template's value stood instead. No error, no warning, no effect.

Measured on 2026-10-05 with an isolated probe: a user-global file saying
`mode: delivery, hosts: [cursor]` against a template saying
`mode: delivery, hosts: [claude-code]` resolved to `hosts: ["claude-code"]` with
`modeExplicit: false` and a raw explicit value of `""`. After the whitelist rows:
`hosts: ["cursor"]`, `modeExplicit: true`, raw explicit `"delivery"`.

This is the third occurrence of one shape. ADR-219 found it for `personal.ide`
and `personal.pr_comment_bot_icon`, whose pre-migration spellings had been
whitelisted while the post-migration names were filtered out. ADR-271 found it
for `design.fidelity_mode`, whose own rule instructed the reader to resolve the
key "through the cascade that starts user-global" while the cascade discarded it.
In each case the key had a reader, the reader was correct, and the filter made
the user's decision unreachable.

What makes this instance load-bearing rather than cosmetic:
`road-to-an-installed-layer-that-is-thinned` step 1.1 keys an installer on this
value, and the thing being thinned is `~/.claude/rules` — a layer that belongs to
the machine and not to any checkout. On an ADR-020 global-only install there is
no project layer at all, so the user-global file is the only layer that could
carry the opt-in, and it was the one layer being filtered. The step was
unsatisfiable by construction on exactly the install shape it addresses.

## Decision

`lean_projection.mode` and `lean_projection.hosts` join `MERGEABLE_KEYS`.

The scope argument is the whole of it: both keys describe a MACHINE — which host
rule trees exist on it, and how much of the rule corpus an agent on it should
load at rest. Neither is a property of a checkout. A per-project override remains
possible because the project cascade merges last, so nothing is taken away; what
changes is that the per-machine layer stops being silently ignored.

**Whitelisting grants no permission and flips no default.** It decides only
whether a value SURVIVES the merge. An absent key still resolves through the
template exactly as before, every existing reader resolves what it resolved
before unless a user had already written a value the filter was discarding, and
the installer gate (`installerThinsHost`) independently refuses a mode whose only
source is the shipped template. Whether the installed layer is thinned BY DEFAULT
is a separate, owner-reserved question and is untouched here — it is blocker
`default-flip-of-the-installed-layer` on the roadmap above.

## Consequences

- A consumer who sets `lean_projection.mode` user-globally now gets the behaviour
  the setting names, on the projector, the delivery hook and the installer alike.
- `tests/lib/agent_settings.test.ts`'s exact-list pin moves by two rows. That pin
  exists to make a widening require a record; this is the record.
- One previously-green assertion changed meaning rather than breaking:
  `lean_projection_mode_parity.test.ts` asserted "no settings file anywhere"
  while reading the developer's real user-global file — true only while the
  filter hid it. The cases are now isolated (`EVENT4U_CONFIG_HOME` pinned per
  case) rather than weakened. A suite that states a layer state and then measures
  the machine it runs on agrees with CI and disagrees with a laptop, which is the
  worse of the two failures and was latent before this change.
- The cost is one real behaviour change on upgrade: a machine carrying a
  user-global `lean_projection` block that has been inert will start taking
  effect. That is the setting working, but it is a change, and a consumer who had
  written a value and then forgotten it will see the projector follow it.

## Alternatives

- **Leave the filter and key the installer on the project layer instead.**
  Rejected: it puts a machine-global mutation of `~/.claude/rules` behind a
  per-checkout value, so one project's setting would thin or un-thin the layer
  every other project on that machine reads.
- **Read the user-global file directly in `lean_projection_mode.ts`, bypassing
  the whitelist.** Rejected as a second reader of the same key — the precise
  defect `road-to-a-rule-carrier-that-works-outside-the-repo` step 1.2 removed,
  reintroduced one layer lower.
- **Delete the whitelist.** Out of scope and a much larger decision: the filter
  exists so a machine-wide file cannot set arbitrary project-shaped keys, and
  three repairs to its CONTENTS are not evidence against its EXISTENCE.

## Evidence

- `src/scripts/_lib/agent_settings.ts` — `_filter_whitelist` over the user-global
  layer, and `MERGEABLE_KEYS` with the two new rows beside the two prior repairs
  of the same filter. The filter is an exact-dotted-path match, so the rows admit
  `lean_projection.mode` and `lean_projection.hosts` and nothing else.
- `src/scripts/_lib/lean_projection_mode.ts` — the single resolver whose
  `modeExplicit` the installer reads, and `installerThinsHost`, which refuses a
  value whose only source is the shipped template. This is what carries the
  "grants nothing and flips no default" claim: whitelisting makes the value
  readable, and a separate predicate decides whether it is a consent.
- `src/install/installThinLayer.ts` — the consumer of that predicate, and the
  reason the scope argument is machine-shaped: the layer it rewrites is
  `~/.claude/rules`.
- `tests/lib/agent_settings.test.ts` — the exact-list pin this record is the ADR
  for, moved by exactly the two rows.
- `tests/scripts/install_thin_layer.test.ts` — the four `template-is-not-consent`
  cases plus the production call shape from a cwd that disagrees with the
  user-global layer, which is where "the project layer cannot decide this" is
  asserted in both directions.
- Measured both directions on an isolated probe, 2026-10-05, against a template
  saying `delivery`/`[claude-code]` and a user-global file saying
  `delivery`/`[cursor]`: before the rows, `modeExplicit: false`,
  `hosts: ["claude-code"]`, raw explicit `""`; after, `modeExplicit: true`,
  `hosts: ["cursor"]`, raw explicit `"delivery"`. The before reading is the
  load-bearing one — it is the template answering a question the user had
  already answered differently.
- `agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md` — step 1.1,
  which this unblocks, and blocker `default-flip-of-the-installed-layer`, which
  it does not touch.

**Strength `E1`, and not higher.** The probe is a single reproduction on one
machine with a synthetic cascade, not a measurement across installs; what it
establishes is that the filter discarded the value and no longer does. No
consumer install has been observed before and after.

## References

- ADR-219, ADR-271 — the two prior repairs of the same filter.
- ADR-267 — confines thinning to the projector; this ADR does not extend that,
  it only makes the mode readable where it is written.
- `agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md` — step 1.1 and
  blocker `default-flip-of-the-installed-layer`.
