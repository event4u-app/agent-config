# Negative control — a monorepo whose own generator the suite never reaches

Step 0.1 of `road-to-repo-playbooks`. This fixture is **the pre-state**, not a target:
it exists so that "the suite ignores the repository's own procedure" is a recorded,
reproducible observation rather than an assertion.

## What this repository already has

| Artefact | Path | What it encodes |
|---|---|---|
| A component generator | `turbo/generators/config.ts` | file layout, **barrel export**, co-located test — decisions this monorepo already made |
| A package script | `package.json#scripts.new:component` → `turbo gen component` | the invocation a human here would type |
| A second script | `package.json#scripts.new:package` → `turbo gen workspace --type package` | the same for a whole workspace |
| Task descriptions | `turbo.json#tasks.*.description` | machine-readable statements of what each task is for |

## What the suite does today, asked "add a Toast component to `@org/ui`"

**It routes to `src/skills/react-shadcn-ui/` and never runs the generator.**

Verified against this commit rather than recalled — the search that establishes it:

```
$ grep -rn 'turbo gen\|turbo/generators\|plopfile' src/skills/ src/rules/
(no matches)
```

**Nothing in any shipped skill or rule mentions `turbo gen`, `turbo/generators`, or
`plopfile`.** So no dispatch path can propose this repository's generator: the suite's
component-shaped skills (`react-shadcn-ui`, `ui-component-architect`) are the only
candidates a router can reach, and both write files directly.

## Why that is a defect and not a preference

The generator is not a stylistic alternative to the skill — it is the **only** artefact
that knows this repository's answers. A component written by a generic skill lands without
the barrel export (`packages/ui/src/index.ts`), without the co-located test, and in
whatever layout the skill prefers. The result compiles and is wrong in the way that costs
a reviewer their afternoon.

And the failure is **silent**: the output looks like a component, so nothing signals that
the repository's own procedure was bypassed. That is what makes it worth a gate rather
than a note.

## What would make this fixture pass

A dispatch that proposes `turbo gen component` — or, once the playbook class exists, the
playbook whose `invokes` names it — **before** any shipped component skill. `grade:
configured`, because the generator is present in the tree and was seen rather than
assumed.

## What this fixture is NOT

- **Not a test of turbo.** `turbo` is never executed here; the files are read as
  configuration. The fixture works offline and installs nothing.
- **Not an endorsement.** `turbo` is one integration target among several
  (`nx`, `plop`); it is the fixture's subject because its generator config is a single
  readable file. Naming a tool this package works with is not derivation-attribution
  (`source-confidentiality`).
- **Not exhaustive.** Nx generators and Plop are deliberately out of the first release —
  their discovery needs a consumer binary, and the staleness check in Phase 3 must run
  without one.
