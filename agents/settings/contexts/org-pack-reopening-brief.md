# Org-Pack Reopening — decision brief

**Status:** **decided 2026-08-11 — declined.** The verdict and its reopen
condition are recorded in `## Decision` at the foot of this file; everything
above that section is the original brief, unedited.

Sections (a)-(d) below were written as **brief only** and deliberately carry
**no recommendation** — they state a lock, why the lock is surfaceable rather
than binding-by-default, the bar a reopening would clear, and one unresolved
contradiction. They are left exactly as written so the decision stays auditable
against an input that did not pre-commit it. The decision it served was owner
`maintainer` (blocker `org-pack-reopening`).

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

## Decision — 2026-08-11: **decline**

The external pack source root does **not** open. ADR-011 stands, no ADR is
commissioned, ADR-013 § packs is unamended, and the closed pack-id vocabulary in
`src/config/discovery/packs.yml:1-4` is untouched.

**How it was taken.** An AI-council pass over sections (a)-(d) above, converging
**2/2 on decline**. The brief was handed over verbatim and recommendation-free,
with both moves stated as genuinely open — the verdict was not authored into the
question. This is the first branch of the blocker's own `Resolved when`, which is
why it needs no ADR: a decline changes nothing, and only a reopening would have
been a contract change requiring a record.

**Citation order, as the council weighted it.** The order matters, because the
obvious lead citation is the wrong one:

1. **The unresolved `replace` contradiction (§ d) — primary.** The brief names
   reconciling it a **precondition** of any reopening, not a follow-up. It is
   unreconciled. So the proposal fails its own stated precondition before any
   external argument is reached, and the question is not "reopen despite the
   contradiction" but "reopen once it is resolved" — which is not yet asked.
2. **The capacity frame — secondary.** 116 rules, 289 skills, 12 in-repo packs,
   one maintainer. The load-bearing half is not maintenance volume but the
   **error surface**: in-repo, a syntax error is caught at PR time, a rule
   conflict is visible in one tree, and a kernel change is one update pass.
   Externalised, the error surfaces at runtime, conflicts need cross-repository
   reasoning, and a kernel change needs N external maintainers to act or
   backward compatibility held indefinitely.
3. **The closed id vocabulary — tertiary but hard.** An externally-supplied
   vocabulary is a direct contract change requiring an ADR-013 amendment in the
   same PR, not an additive feature. This one is direction-agnostic: § (b)'s
   mechanism-match distinction does not soften it.

**What is deliberately NOT the lead citation.** ADR-011's unfired design gate.
The brief's § (b) mechanism-match reading holds — ADR-011 tested *extraction* and
this proposal is *ingestion* — so leading with it would be the same category
error § (c) flags for ADR-088, pointed the other way. It still bears indirectly:
the overlap inventory the gate demands would have forced identity-collision,
precedence and trust-boundary answers, and those are unanswered in the ingestion
direction too. An unfired gate is a reason the design work is missing, not a
prohibition on the question.

**Reopen condition — falsifiable, both legs file-checkable.** This decision is
revisitable when **both** hold:

1. An ADR with `status: accepted` defines override precedence for
   `agents/overrides/` — specifically what `replace` mode means when a second
   layer also claims final say over the same artefact. This resolves § (d) and is
   the genuinely unmet need underneath the proposal: the override layer already
   ships, and what it lacks is governance, not a second ingestion path.
2. ADR-011's design gate has fired — `docs/contracts/domain-pack-overlap-inventory.md`
   exists with ≥ 3 falsifiable overlap predictions.

**Explicitly NOT a reopen condition:** an external-adoption signal. ADR-216
`:10-17` strikes it — *"adoption is not a project goal and therefore not a valid
gate."* A demand argument resting on adoption does not reopen this.
