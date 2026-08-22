---
complexity: lightweight
status: draft
parent_roadmap: road-to-demand-gate-audience
---

# Road to Demand-Gate Audience — Follow-up

**Goal.** Hold the two decisions the parent roadmap deliberately did not take,
so neither is lost and neither is taken by an agent on its own authority.

## Outcome — drained 2026-08-20 (`partially satisfied`), closed 2026-08-22 (`transferred`)

**Closed 2026-08-22 as `transferred`, not completed and not cancelled.** The one
remaining live item moved to
[`stubs/road-to-demand-gate-audience-default.md`](../stubs/road-to-demand-gate-audience-default.md)
on a 2-of-2 convergent AI-council ruling; the shipped default is untouched. The
2026-08-20 drain record below is unchanged and is what the transfer builds on.

## Outcome — drained 2026-08-20, outcome state `partially satisfied`

**Archived does not mean achieved, and this roadmap is not archived.** Of six
open lines: two were executable and are done, three are **abandoned** with the
reason recorded, and one remains open because it is a decision reserved to the
maintainer. The file stays in the active tree at `status: draft` — see § Why this
stays draft.

| Item | Line | Outcome | Evidence |
|---|---|---|---|
| 1 | Stated position on internal-vs-public | **open — owner-reserved** | Evidence half is a measured zero (below); the judgement half is the maintainer's |
| 1 | Migration note | **satisfied** | `agents/evidence/analysis/demand-gate-default-flip-migration-note.md` |
| 1 | Counter-test re-pointed | **satisfied** | `tests/contracts/demand_gate_audience.test.ts:72-108`, both directions sabotage-probed |
| 2 | `validate-feature-fit` move vs own guideline | **abandoned** | Option 2 is not expressible; see § Item 2 |
| 2 | Conditional routing for `improve-before-implement` | **abandoned** | Same |
| 2 | Whether worth doing at all | **abandoned** | No committed producer exists |

**The evidence half of Item 1 is a terminal null, not an unopened question.**
Searched for any instrument that could report the audience mix of installs
running this package: no `agents/runtime/` telemetry store, no
`src/scripts/telemetry/` module, no install-population record, and no claim in
`docs/CLAIMS.md` about consumer counts or composition. `project.audience` is
class C — the agent never writes it and nothing reports it — so no distribution
over it can exist by construction. The instrument returned zero; only a
maintainer judgement can close that line, which is why it stays open rather than
being dispositioned away.

**What the work turned up that the roadmap did not ask for.** The reason three
artefacts give for "an absent `audience` resolves to `public`" — *this package
has no defaults layer* — is stale. `load_agent_settings` merges a
template-defaults layer beneath every file layer
(`src/scripts/_lib/agent_settings.ts:873`), and measured with every file layer
pointed at a nonexistent path, `project.audience` resolves to `public` from the
template. The conclusion those artefacts state is right; the reason is false,
and the reason is what decides the flip's blast radius — the flip reaches every
install that never set the key, not only newly written settings files. The two
`audience`-local statements are corrected in this change; the shared contract
passage at `docs/contracts/settings-classes.md:113-120` carries the same stale
claim for the nine carve-out keys and is **surfaced, not edited** — out of scope
here.

## Why this stays `draft` and does not move to `later/`

`later/` is the right disposition on the contract's wording — open work blocked
on a decision that will resume. It is not taken, for a measured reason:
`later_roadmaps` sits at **52 against a ratchet baseline of 52**
(`./scripts-run src/scripts/check_estate_count`, 2026-08-20), so moving this
file in reds `check_estate_count`, and the only way through would be raising the
baseline to admit a new entry — which the ratchet exists to forbid. A `draft`
roadmap is already excluded from `active_roadmaps` and from the dashboard, so the
move would buy no visibility it does not already have. Recorded rather than
worked around: if the later-count falls below baseline, this file belongs in
`later/` with the resume condition "the maintainer answers Item 1".

## Context

`agents/roadmaps/archive/road-to-demand-gate-audience.md` fixed the demand gate's
single-addressee defect: § 8-pre gained an `L-self` build level, and
`project.audience` was added as a class-C settings key defaulting to `public`
(today's behaviour, unchanged for every existing install).

Two items from the source note were removed from that scope on purpose. Both are
listed there under **Non-goals**; both are copied here verbatim so the plan
survives.

This roadmap is `status: draft` — it is hidden from the dashboard and is not
executable until a human decides the question below. It carried **two** until
the 2026-08-20 drain run; Item 2 is abandoned with its reason recorded, so Item 1
is the only live one.

## Item 1 — Flip the shipped default from `public` to `internal`

The source note argues (translated): default `internal`, not `public` — most
repositories running this package are not products with a market, so today's de
facto default is `public`, which is the least likely assumption of the four.

That is a real argument, and the flip is a **consumer-facing default change**:
it alters agent behaviour in every existing install, including those whose
maintainers never read the change. The parent roadmap therefore shipped the
conservative value and left the flip here.

What would have to be true before flipping:

- [-] A stated position on whether an unconfigured repo running this package is more likely internal than public — evidence, or an explicit maintainer judgement recorded as such.
      **TRANSFERRED 2026-08-22 to
      [`stubs/road-to-demand-gate-audience-default.md`](../stubs/road-to-demand-gate-audience-default.md).**
      Not cancelled, and not resolved. The two halves are closed to an
      autonomous run for different reasons, and the stub keeps them apart:
      · **Disposition** — administrative only. No consumer-facing behaviour
        change; the shipped default stays `project.audience: public`.
      · **Unresolved decision** — the maintainer judgement, owner-reserved. An
        AI council (2026-08-22, 2 of 2 convergent) applied the
        `road-to-drain-commands` precedent of the same day: a council may not
        manufacture the owner decision a blocker reserves, and recording an
        owner's *absence* as an owner's *decision* fabricates satisfaction of a
        terminal condition. Cancelling outright would have read as a permanent
        rejection nobody ruled.
      · **Reopens when** — evidence exists, **or** an explicit maintainer
        judgement is recorded as such. Either alone suffices; neither implies
        council approval of the flip.
      Only the EVIDENCE half is a null; the item as a whole is not. The transfer
      target was verified rather than assumed: `stubs` is in `EXCLUDE_DIRS` at
      `src/agent-src/scripts/update_roadmap_progress.ts:88`, so the record
      genuinely leaves the active estate.
- [x] A migration note for existing installs: what changes for a repo that never sets the key.
      → `agents/evidence/analysis/demand-gate-default-flip-migration-note.md`.
      Derived from the tree with file:line per claim; takes no position on the flip.
- [x] The counter-test from the parent's Phase 4 re-pointed, so "the market path survives" is asserted against `audience: public` explicitly rather than against the default.
      → `tests/contracts/demand_gate_audience.test.ts`: the market-path assertion now
      matches the `public` **row's semantics** (all three questions + the full
      ladder); a new sibling test pins whichever default the template ships.
      Probed both ways — hollowing the `public` row reds the counter-test (the old
      assertion stayed green under that same sabotage, so this is strictly
      stronger), and flipping the template default reds only the new test while
      the counter-test stays green, which is the decoupling this line asked for.

## Item 2 — Move § 8-pre into the product workspace (the note's Stufe 3)

The note proposes lifting the demand gate out of the engineering guideline and
into the `product` workspace, so that the workspace setting actually controls
the behaviour instead of only appearing to.

**Two corrections to this framing, both from the tree.** The key is
`projection.rule_workspaces`, not `agents.rule_workspaces` — the latter does
not exist (0 hits in `src/config/agent-settings.template.yml`; the real key is
top-level `projection:` at `:80`). And it scopes the **rule layer only** —
`rule_scope.ts` filters rule *files*; § 8-pre lives in a guideline, which that
axis does not reach at all.

**The note's stated route is falsified.** It suggests folding § 8-pre into
`validate-feature-fit`, on the premise that the skill is product-scoped. It is
not: `src/skills/validate-feature-fit/SKILL.md` carries `workspaces:
[engineering]`. Moving the section there would gate nothing.

What would have to be decided:

- [-] Whether `validate-feature-fit` should itself move to `workspaces: [product]`, or whether § 8-pre gets its own product-scoped guideline.
      **Abandoned — the choice is not answerable as posed.** Option 2 is not
      expressible: **0 of 107** files under `docs/guidelines/` carry a
      `workspaces:` axis, and the projection symlinks that directory wholesale
      (`AUGMENT_SYMLINK_DIRS` in `src/scripts/condense.ts:2491-2494`). There is
      no such thing as a product-scoped guideline today. Option 1 is a *skill*
      move, governed by pack/profile projection rather than the rule axis this
      item names — so it would not gate § 8-pre either, which is the same class
      of error as the note's already-falsified premise.
- [-] Whether `improve-before-implement` may route **conditionally** — the rule is engineering-scoped, and a conditional route to a product-scoped target is a new routing shape, not a relocation.
      **Abandoned with the rest of Item 2.** It is downstream of the choice
      above: there is no product-scoped target to route to conditionally, so
      the question has no subject. Left as a question rather than answered —
      whoever reopens Item 2 on a corrected premise still owes it an answer.
- [-] Whether this is worth doing at all now that `project.audience` addresses the reported damage directly. The note itself ranks it last — its own wording is "stage 3 only when the workspace mechanism is being touched anyway".
      **Abandoned — no committed producer.** "When the workspace mechanism is
      being touched anyway" names nobody, which is exactly the re-entry
      condition a transfer may not rest on. Probed: the mechanism's owner,
      `road-to-request-scoped-rule-load`, is archived with **0** open steps, and
      no active roadmap commits to the workspace-scoping axis
      (`road-to-rule-coherence-followup:181` explicitly forbids forking
      projection-mode work). A declared Non-goal with no producer is abandoned,
      not parked.

## Prerequisites

- `agents/roadmaps/archive/road-to-demand-gate-audience.md` is complete (or archived).
- A maintainer judgement on **Item 1** — the one line still open. Until then this
  roadmap stays `draft`. Item 2 needs nothing: it is abandoned, not waiting.
