---
adr: 271
status: accepted
date: 2026-09-09
decision: design-fidelity-mode-cascades-from-user-global
supersedes: —
superseded_by: —
type: structural
reopen_policy: directional
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: single
  decision_makers: [agent]
  human_directed: true
evidence:
  strength: E2
  basis:
    - src/scripts/_lib/agent_settings.ts
    - src/scripts/_cli/cmd_settings_get.ts
    - src/rules/design-fidelity.md
    - docs/contracts/settings-classes.md
    - tests/scripts/_cli/cmd_settings_get_user_global_drop.test.ts
review_trigger: >-
  A second `design.*` key is proposed for the whitelist, or a measurement shows
  a project legitimately needing a fidelity mode different from its developer's
  and being unable to express it.
---

# ADR-271 — `design.fidelity_mode` cascades from the user-global layer

## Status

Accepted, 2026-09-09. `MERGEABLE_KEYS` requires an ADR per key; this is that
ADR, and it covers exactly one key.

**Provenance, stated plainly because the same change carries a council record
and this is not part of it.** The AI council of 2026-09-09 decided the five
open blockers of `road-to-design-intent-conformance`; this key was **not** one
of them. Step 2.3 carried no blocker, so no decision was routed, and the
decision here is the agent's under the roadmap's own execution grant —
`agentic_mode: single`, human-directed by the roadmap. Recording it as a
council verdict would have been a provenance claim nothing supports.

## Context

`src/rules/design-fidelity.md` instructs the reader to resolve
`design.fidelity_mode` through the settings cascade, in those words: *"That
file is the project layer of a cascade that starts user-global, so 'missing'
means missing from every layer — `agent-config settings:get
design.fidelity_mode` reports the value and the file it came from."*

The cascade did not carry it. `MERGEABLE_KEYS`
(`src/scripts/_lib/agent_settings.ts`) is an exact allowlist of dotted paths
permitted to cascade from user-global into a project, and it listed no
`design.` key — so a value set user-globally was read by the loader and then
filtered out, with no error and no effect. The rule's own instruction could not
be followed.

The inbound round that surfaced this diagnosed it as *"the resolver does not
see the layer"*. That diagnosis is wrong and the correction changes the fix:
the layer **is** read, and the value is discarded afterwards by the whitelist.
A resolver bug would be fixed in the resolver; a whitelist omission is fixed
here, by a decision, which is why an ADR exists at all.

A second, independent half was found by the same verification pass and is
fixed in the same change rather than recorded here: `userGlobalDrop()` in
`src/scripts/_cli/cmd_settings_get.ts` probed only the flat
`agent-settings.yml` and never the canonical `settings/.agent-settings.yml`
that the setup wizard writes. So for a wizard user the warning that would have
announced the drop could not fire, and a discarded key read as a plain "not
set" — indistinguishable from a key nobody had set. That is a defect with a
verified wrong behaviour and a verified right one, not a decision.

## Decision

`design.fidelity_mode` joins `MERGEABLE_KEYS`.

## Why this key and not a `design.*` prefix

The whitelist is a list of **exact dotted paths**, deliberately, and this
change does not widen it into a prefix match. A prefix would pre-authorise
every future `design.` key — including the approximation-tolerance keys whose
values are still `null` and owner-reserved — and grant a cascade to keys that
have not been argued for. One key, one row, one ADR is the shape the constant
already has.

## Why user-global is the right layer for it

Whether an agent may deviate from a handed-over design is a property of **how
a person works**, not of a repository. A designer who sets `strict` once
expects it in every checkout, and a contractor who sets `structural` expects
that. The counter-case — a project that must pin a mode regardless of who is
working in it — is unaffected: the project layer still wins, because
user-global is the lowest layer in the cascade, not the highest.

## Class is unchanged

`docs/contracts/settings-classes.md` records `design.fidelity_mode` as **Class
C**, default `strict`, *"strict-mode selector, one of whose values is a Hard
Floor"*. Class C is unchanged by this ADR and nothing here weakens it: the
agent still may not write the key — `settings:set` refuses every C key by
construction — and a value only arrives by a human edit or through the GUI.
Whitelisting decides only whether a value a human already set **survives the
merge**.

The `hard-floor` value stays a Hard Floor wherever it resolves from. Cascading
a stricter value from user-global cannot weaken a project; cascading a looser
one is overridden by any project that states its own, which is the existing
precedence and not a new escape.

## Consequences

- A user-global `design.fidelity_mode` now resolves, and `agent-config
  settings:get design.fidelity_mode` names the layer it came from.
- A non-whitelisted user-global key now reports its drop from **either**
  user-global file, so the silent-discard case that hid this defect for the
  whole `design.` namespace is closed for every key at once.
- The exact-list pin in `tests/lib/agent_settings.test.ts` gains one row, which
  keeps the "widening requires an ADR" requirement executable rather than
  aspirational.

## Alternatives

- **Prefix-match `design.*`.** Rejected above: it pre-authorises keys nobody
  has argued for, including owner-reserved ones.
- **Leave it project-only and delete the cascade sentence from the rule.**
  Rejected: the sentence describes the behaviour a user reasonably expects from
  a per-developer working preference, and deleting it would resolve a
  contradiction by removing the correct half.
- **Reclassify the key so the agent can write it.** Not considered a live
  option — it is a Class-C reclassification, which is owner-reserved, and it is
  not needed for anything in this change.

## Evidence

**E2 — the decision rests on readings taken in this change, plus one shipped
sentence the tree contradicted.**

| Claim | Evidence |
|---|---|
| The rule instructs the reader to resolve this key through the cascade | `src/rules/design-fidelity.md` § Strictness, verbatim: *"That file is the project layer of a cascade that starts user-global"* |
| The cascade did not carry it | `MERGEABLE_KEYS` in `src/scripts/_lib/agent_settings.ts` listed no `design.` key |
| The layer IS read and the value discarded afterwards — not a resolver bug | `user_global_settings_paths()` returns both layers; the filter is `MERGEABLE_KEYS.includes(key)` in the loader, downstream of the read |
| The key now resolves and names its layer | `EVENT4U_CONFIG_HOME=<fixture> agent-config settings:get design.fidelity_mode` → `"structural"`, source = the fixture's `settings/.agent-settings.yml` |
| The drop warning could not fire for a wizard user | `userGlobalDrop()` probed only the flat `agent-settings.yml`; the wizard writes `settings/.agent-settings.yml` |
| It fires now | same fixture, `settings:get memory.learn_on_session_end` → the discard warning, naming the canonical file |
| That repair is SENSITIVE, not merely passing | neutralising the multi-layer probe reds exactly the three multi-layer cases (3 failed / 3 passed); restoring it returns 6 passed. `tests/scripts/_cli/cmd_settings_get_user_global_drop.test.ts` |
| The class is unchanged | `docs/contracts/settings-classes.md` still records C; `lint_settings_classes` green at 145 keys, A=26 B=3 C=116 |
| The whitelist stays an exact-path list | `tests/lib/agent_settings.test.ts` pins the full array; the new row is one entry, not a prefix |

**What the evidence does not establish**, named rather than implied:

- **That any consumer has this key set user-globally today.** Nobody measured
  that, and the change is worth making either way: a rule instructing a
  resolution the tree refuses is a defect whether or not it has bitten yet.
- **That `hard-floor` cascading from user-global is desirable.** It is
  *harmless* — a stricter value cannot weaken a project, and a looser one is
  overridden by any project that states its own — but "harmless" is an argument
  from the precedence order, not a measurement of use.
- **That the three-way surface gap is closed.** It is not.
  `lint_settings_classes` compares the template against the contract and never
  against the zod schema, which is how a sibling key in this same branch shipped
  in two of three surfaces. Recorded as a deferred finding in
  `agents/evidence/reviews/feat-cdd-fidelity-council.findings.md`, not fixed
  here.

## References

- `src/scripts/_lib/agent_settings.ts` — `MERGEABLE_KEYS`.
- `src/scripts/_cli/cmd_settings_get.ts` — `userGlobalDrop()`.
- `docs/contracts/settings-classes.md` — the A/B/C fence.
- ADR-219 — the previous `MERGEABLE_KEYS` widening, and the precedent for the
  one-key-one-ADR shape.
