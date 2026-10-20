---
adr: 292
status: accepted
date: 2026-10-20
decision: the-package-decides-its-own-rule-layer-form
supersedes: ADR-267, ADR-278
supersedes_scope: >-
  ADR-267 decision 3 only — the rollback is one setting. ADR-278 in full.
superseded_by: —
phase: road-to-a-setup-that-decides-itself · Phase 4
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [owner, council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/setup-key-removal-release-class-20261020.md
    - agents/evidence/council/setup-key-removal-release-class-20261018.md
    - agents/roadmaps/road-to-a-setup-that-decides-itself.md
    - src/scripts/_lib/layer_form_decision.ts
    - src/scripts/_lib/layer_form_evidence.ts
    - src/scripts/_lib/settings_removed_keys.ts
    - docs/decisions/ADR-290-node-floor-22-as-a-major.md
review_trigger: >-
  Reopened if a consumer needs the full form on a machine where they cannot
  re-run install, or if the computed decision is observed returning `thinned`
  on a machine whose arrival record does not satisfy it.
---

# ADR-292 — The package decides its own rule-layer form; no settings key does

## Status

Accepted 2026-10-20. The removal was directed by the owner on 2026-10-12
("remove the lean settings, make it default and dynamic — but only if the
package does not get worse; it must stay as reliable as it is today"). Its
release class and timing were decided by the AI council, 2/2, in two rounds:
round 1 (2026-10-18) settled the class, round 2 (2026-10-20) settled the timing
and authorised an agent lane to execute it.

## Context

Four keys described how the package loads its rule layer, and none of them
described it consistently.

- `lean_projection.mode` resolved to `delivery` in the shipped template, to
  `eager-all` in the schema default, and to `eager-all` again in the parser's
  fallback — while the installer refused a template-only value outright, so the
  template's `delivery` reached no machine on its own.
- `projection.mode` carried `scoped` in the template against a `legacy-all`
  schema default.
- `projection.rule_workspaces` selected which workspaces project, a
  maintainer-only distinction with no consumer meaning.
- `projection.mode: tiered` was a retired experiment that `install.ts` still
  acted on.

One of these produced exactly the silence a knob exists to prevent: on
2026-10-02 the delivery concern read a settings file that does not exist on a
normal install, resolved `eager-all`, and closed its own gate while thin stubs
sat on disk. A key that four readers disagree about is not a control surface; it
is four defaults wearing one name.

## Decision

**The form of the rule layer is computed, per layer, host and machine, and no
settings key selects it.**

1. The decision function (`_lib/layer_form_decision.ts`) returns `full` whenever
   any of its conditions fails, is missing, is stale or is contradicted, and for
   every consequence-class and `safety-floor` rule under every input. `thinned`
   is reachable only on evidence the machine can check when the form matters.
2. The forms stay an **internal enum**. Removing the keys removes the consumer
   surface, not the vocabulary the projector and the delivery experiment use.
3. The operator rollback is a shipped table row (`src/config/layer-form-brakes.json`),
   not a setting. The consumer brake is `install --full`, which writes one field
   into the install receipt that only the decision function reads.
4. Every removed key gets a tombstone in `REMOVED_KEYS`, so a leftover value is
   ignored with one named line rather than silently applied or silently dropped.
5. For one release window an explicitly written `eager-all` or `legacy-all` — the
   two values that mean *keep the full layer* — is read once and converted into
   the receipt pin. Every other prior value is dropped. Both are printed.
6. This removal ships in a **semver-major**, on the same major as ADR-290's Node
   floor. An agent lane may implement it; it may not cut that release, and these
   commits may not enter an earlier minor.

## What this supersedes

- **ADR-267 decision 3** — *the rollback is one setting*. It is now two things
  that are not settings: a shipped brake table the maintainer owns, and an
  install-time receipt field the consumer owns.
- **ADR-278** — *the user-global layer may carry the thinning opt-in*. There is
  no opt-in key left to carry, so the record describes a mergeable key that no
  longer exists.
- **D3 of `road-to-an-installed-layer-that-is-thinned`** — *the template value is
  not consent*. True while the key existed; it now has no key to apply to.

ADR-267's other decisions stand, including its reading that an absent key
resolves to the full form — which is the behaviour the computed function keeps
as its own default.

## Consequences

- A consumer never sets, reads or reasons about how the package loads its rule
  layer. `doctor --check layer-form` says which form each layer is in and why.
- The next release is a major. That was settled before this record and is not
  reopened by it.
- A machine downgraded to a release that still reads the keys finds them absent
  and resolves to `eager-all` / `legacy-all` — the full form, which is the safe
  direction.
- The dynamic half stays unreachable until the `InstructionsLoaded` binding
  ships: with no arrival record the function returns `full`, which is today's
  behaviour. **Phase 4 is therefore safe to land ahead of that binding** — what
  it removes is the keys, not the full form.

## Alternatives considered

- **Keep one key as the rollback** (ADR-267 decision 3, and step 3.1 of
  `road-to-an-installed-layer-that-is-thinned`). Rejected by the owner's
  directive, and independently by the measurement above: the one key that
  existed to be the rollback is the one that produced the silence.
- **Remove the keys in a minor.** Ruled out by blocker `what-a-minor-may-remove`,
  closed 2026-10-14: a key may leave in a minor only when no consumer can rely on
  it, and both `lean_projection.mode: delivery` and `projection.mode: tiered`
  are relied-on behaviour.
- **Hold every Phase 4 commit off `main` until the major is being cut.** The
  round-2 council's option (c); not chosen, with the operational risk it would
  have avoided recorded in that verdict rather than dismissed — if a critical fix
  must ship before the major, the release is cut from a commit before Phase 4.

## References

- `agents/evidence/council/setup-key-removal-release-class-20261020{,.question}.md`
- `agents/evidence/council/setup-key-removal-release-class-20261018.md`
- ADR-267, ADR-278, ADR-290
