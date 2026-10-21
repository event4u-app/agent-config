<!-- evidence-type: analysis -->

# Where the project tree's rule-layer form comes from, once the key is gone

Repository `event4u/agent-config`. Answer with one option letter and a short
rationale. Do not restate the question.

## What just changed, and why this question is now blocking

`road-to-a-setup-that-decides-itself` Phase 4 removes the settings keys that
described how the package loads its rule layer. ADR-292 records it; this
council authorised an agent lane to execute it on 2026-10-20.

Removing `lean_projection.*` from the shipped template
(`src/config/agent-settings.template.yml`) had a consequence the step did not
name, found by running the suite rather than by reading the plan:

- `resolveLeanProjection` resolved its mode from the settings cascade, whose
  last layer was the shipped template. The template said `delivery`.
- With the key gone, the cascade resolves to `eager-all` — the full form.
- So the `rule-inject` hook concern's gate, which opens only on a thinned
  layer, now **closes on a default install**. Nine delivery tests across
  `tests/scripts/rule_inject_foreign_matrix.test.ts` and
  `rule_inject_default_install_no_double.test.ts` go red, each asserting that
  the template default delivers.

Two facts bound what this costs:

1. **No consumer's installed layer was ever thinned by the template.** The
   installer refuses a template-only value
   (`lean_projection_mode.ts` `installerThinsHost`, ADR-278 / D3: a template
   value is not consent). So on a default install the bodies were already
   full in `~/.claude/rules` and the concern was delivering into a layer that
   already had them.
2. **The PROJECT tree on the first host is a different story.** It runs
   `delivery` today under ADR-267, with 616/616 byte-equal deliveries,
   101/101 labelled rules reachable and 0 of 212 near-misses fired on the
   frozen routing-matrix corpus. That tree got its `delivery` from the same
   template key.

So the key's removal, taken alone, flips the project tree on the first host
from `delivery` to full and closes the delivery mechanism's only live gate.

## This is step 3.6's open question, reached from the other side

Step 3.6 — *the project tree uses the same function, with the project's own
dispatcher as its carrier* — has been open since 2026-10-18 with exactly this
screening note:

> Routed through 3.1 as it stands, it would read `delivery-unobserved` and fall
> back to full — a default change for every project tree on that host that is
> not a "no worse" move and has no consent behind it. The step needs either a
> project-tree effect row the function can read as observed, or a decision that
> the project tree keeps ADR-267's evidence as its proof; neither is in the
> tree.

The decision function (3.1, `_lib/layer_form_decision.ts`) returns `full` unless
the machine's own evidence says otherwise. The first host's behavioural effect
row in `src/config/host-injection-effect.json` is `unobserved`, and the
`InstructionsLoaded` observer that would produce an arrival record is built but
**not bound** (step 1.1, blocked on hook-bundle bytes). So 3.1 returns
`full (delivery-unobserved)` for every host today.

## Options

(a) **The project tree keeps ADR-267's evidence as its proof.** Move the
    project tree's form out of the settings cascade and into a shipped,
    non-settings source — a constant or table the package owns, carrying
    `delivery` for the first host exactly as the template did. Behaviour is
    unchanged, the key is gone, the nine tests stay green, and the delivery
    mechanism stays live for Phase 5 to measure. 3.6 then closes as "the
    project tree reads a shipped form, and will read 3.1's verdict once an
    observed effect row exists".

(b) **Route the project tree through 3.1 now and accept full.** The project
    tree reads `full (delivery-unobserved)`, delivery stops on the first host,
    the nine tests are rewritten to assert the full form, and the mechanism is
    dark until an observed row or an arrival record exists. Simplest, honest
    about the evidence, and strictly safer — but it un-does ADR-267's measured
    result with nothing measured against it, and Phase 5 then has no live
    computed arm to compare.

(c) **Keep one settings key for the project tree only**, removing it from the
    consumer surface. Contradicts the owner's 2026-10-12 directive and ADR-292.

(d) Something else — state it.

## Constraints that bound the answer

- The owner's directive: remove the keys, make it default and dynamic, **only
  if the package does not get worse and stays as reliable as it is today**.
- The roadmap's own line: *"Phase 4 ships either way: full is today's
  behaviour, now without its keys."*
- ADR-267 decision point 4 stands: an absent key resolves to the full form.
  The question is whether the PROJECT tree's `delivery` is "an absent key" or a
  decision ADR-267 already took on evidence.
- Nothing here changes what a CONSUMER's installed layer gets; fact 1 above.

## What a usable answer contains

1. One option letter.
2. If (a): what the shipped source must record so it is not a settings key in
   disguise — and what obliges it to be replaced by 3.1's verdict later.
3. The one condition that would reopen the choice.
