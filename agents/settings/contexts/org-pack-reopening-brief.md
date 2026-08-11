# Org-Pack Reopening — decision brief

**Status:** brief only. It states a lock, why the lock is surfaceable rather
than binding-by-default, the bar a reopening would clear, and one unresolved
contradiction. It carries **no recommendation**, and the decision it serves is
owner `maintainer` (blocker `org-pack-reopening`).

The question it puts up: *should an external pack source root open, so that
org-level content can be pulled in from outside this repository?*

## (a) The governing lock

[`ADR-011-domain-pack-readiness.md`](../../../docs/decisions/ADR-011-domain-pack-readiness.md)
is `status: accepted` (`:3`) and decides:

> The platform stays thin-root and ships future domains (audio, image, docs,
> exports) as in-repo capability bundles, **not as separately-installable
> packs**, until at least two independent domains exist with overlapping
> execution surfaces. (`:64-67`)

The stance is explicitly falsifiable, via one design gate that fires *before* a
second heavyweight domain is built and two confirmation gates that fire after it
ships (`:95-128`). **The design gate has not fired:** it requires
`docs/contracts/domain-pack-overlap-inventory.md` with ≥ 3 falsifiable
overlap predictions, and that file does not exist. Gates 2 and 3 are downstream
of it, so all three are unmet. ADR-011 § (ii) names a placeholder roadmap
carrying the marker, held at `status: draft` precisely to stay
dashboard-suppressed until the design gate fires.

ADR-011 also ships an escape clause (`:130-136`): if all three gates fire and
extraction is *then* judged too expensive, the decision was wrong and the ADR is
reopened with the failure mode recorded. That clause is what makes the lock a
two-way door, and it is not the door this brief knocks on — no gate has fired.

## (b) Why this is surfaceable rather than a route-around

Under [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md) the
first check is mechanism-match, and here **the mechanisms differ**:

- ADR-011 governs pushing *core domains out* — extracting video, audio, image
  and siblings from this repository into separately-installable packs.
- The proposal is the opposite direction: pulling *org content in* from an
  external source root.

A verdict settles the mechanism it tested. ADR-011 tested extraction, so it does
not automatically decide ingestion — which is why this is raised as a named
reopening rather than treated as already-answered. That is a reason the question
may be *asked*; it is not an argument that the answer should be yes.

What ADR-011 does bear on directly, and what a reopening cannot sidestep: the
id vocabulary. `src/config/discovery/packs.yml:1-4` is a **closed** vocabulary
whose header states that amendments to the id set "require an ADR-013 amendment
in the same PR". An open or externally-supplied vocabulary is therefore a direct
contract change, not an additive feature.

## (c) The bar a reopening clears

[`ADR-088-no-external-runtime-federation.md`](../../../docs/decisions/ADR-088-no-external-runtime-federation.md)
§ 3 (`:93-103`) sets four questions any federation-shaped ADR must answer:

1. **Identity** — should the suite take on that identity at all.
2. **Generic design** — any neighbour, not one named vendor.
3. **Maintenance model** for N external bridges.
4. **Trust contract** — who validates external output, and how the safety
   floors (`non-destructive-by-default`, `commit-policy`,
   `verify-before-complete`) are enforced across the boundary.

**Stated honestly: ADR-088 does not forbid this proposal.** Its scope is driving
an external agent *runtime* — orchestrating external orchestrators — which is
not what an org-content source root is. It is cited here as the **bar**, never
as a prohibition. Using it as a prohibition would be the same category error
this brief flags in (b), pointed the other way.

## (d) The unresolved contradiction

The source proposal carries the non-goal *"no override semantics"* while also
claiming that manual duplication is the only option available today. **The
second claim is false**, and the two cannot both stand:

- `agents/overrides/` is the shipped project-local extension layer, present in
  the tree with `commands/`, `guidelines/`, `rules/`, `skills/`, `templates/`
  and `kernel-exceptions.yml`.
- [`override-management`](../../../src/skills/override-management/SKILL.md)
  `:50-51` defines two modes: **`extend`** (apply the original, then layer the
  override) and **`replace`** (ignore the original entirely).

So an override mechanism exists, is documented, and has a `replace` mode. A pack
system that declares no override semantics while a `replace` mode ships would
contradict at runtime — two layers claiming final say over the same artefact.
Any reopening reconciles the two **first**; this is a precondition, not a
follow-up item.

## Capacity frame

Re-measured at the time of writing: **116** rules (`src/rules/*.md`), **289**
skills (`src/skills/*/`), **12** in-repo packs (`src/domains/*/pack.yaml`).

A pack system is a capacity multiplier applied to the surface furthest from its
own budget.
[`ADR-216-restraint-reanchored-to-capacity.md`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
re-anchors every restraint gate to maintainer capacity, and its own
`review_trigger` (`:10-17`) strikes external adoption as a valid reopening
condition: *"Do NOT reopen on an external-adoption signal … adoption is not a
project goal and therefore not a valid gate."* That is the frame the decision is
taken in — a demand argument resting on adoption does not clear it.

## What this brief does not do

It does not recommend an outcome, estimate an implementation, or pre-commit an
ADR. Per the blocker, the two available moves are: **decline** — ADR-011 stands
and the deferred step closes `- [-]` citing it; or **reopen** — commission an
ADR answering the four questions in (c) and reconciling the `replace` mode in
(d), which lands as its own record with `status: accepted` amending ADR-011 and
ADR-013 § packs.
