<!-- evidence-type: analysis -->

# Owner directive 2026-11-07 — no merge queue on `main`

The merge queue was enabled on ruleset `17749383` ("main protection") on
2026-11-07 at 02:55 (+01:00), as step 3 of `docs/contracts/ci-test-selection.md`
§ Enabling the gate. The same day, after the first merge had to wait in it, the
owner asked why it was enabled and then decided (verbatim, German):

> schalte es ab und vermerke das, damit es nicht mehr passiert. Das bringt keinen
> Vorteil. WEg damit

The ruleset entry of type `merge_queue` was removed the same day; the other
four rules (`deletion`, `required_status_checks`, `non_fast_forward`,
`pull_request`) are unchanged.

## What this binds

- No agent, roadmap, contract step or council verdict re-enables a merge queue
  on this repository. Proposing one is reopening an owner decision — it goes to
  the owner, never to the council.
- A PR merges directly once its required checks are green.
- The `merge_group` triggers in the workflows stay; they are inert without a
  queue and cost nothing.

## What the repository gives up, stated so it is not rediscovered as a bug

PRs run the selected test suites only (`ci-test-selection.md`). Without the
queue, a PR's green run is against its own merge base, not against the `main`
it lands on. A change that breaks only in combination with a newer `main`
surfaces in the full-suite `push: main` run after the merge, not before it.
The owner accepted that trade.

**Revisit if:** the owner raises it. Nothing else reopens this.
