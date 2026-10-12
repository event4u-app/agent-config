# Scenario 6 — recorded run

Produced by `agent-config ui:render <file> --profile asset` with
`@playwright/test` unresolvable, over
`s1-new-logo/delivered/mark.svg`. Not hand-written.

```
exit code: 3   (EXIT_RENDERER_ABSENT = 3)
```

## The manifest it wrote

```json
{
  "verification": "unverified",
  "reason": "renderer-absent",
  "goal": "unassessed",
  "profile": "asset",
  "static": {
    "errors": 0,
    "digest": "eb8c8505b1bb7d5fff6ae58b0f8fca40d4028bdd6fb912ceedf4e2271bb6c56e"
  },
  "captures": [],
  "degradation_reason": "@playwright/test is not installed — it is a devDependency, so a consumer install has no browser. Install it, or scope any verdict to the static checks that actually ran."
}
```

## What the owner reports from it

> `static-only` — the static witness found
> 0 error finding(s) on digest
> `eb8c8505b1bb7d5f…`.
> No renderer resolved: `@playwright/test` is a devDependency of the
> package and is absent here, so the viewport-dependent readings were
> not taken.

No step of that report asks anybody to open the file in a browser.

