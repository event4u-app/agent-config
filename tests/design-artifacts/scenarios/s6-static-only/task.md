# Scenario 6 — a consumer with no renderer, walked cleanly

Step 4.2 of `road-to-svg-review-followups`.

**Task text handed to the owner, verbatim:**

> Check this icon for me. (Run in a project that has `@event4u/agent-config`
> installed and nothing else — no Playwright, because it is a devDependency of
> the package and not of the consumer.)

**Inputs:** `s1-new-logo/delivered/mark.svg`, unchanged. Nothing is authored;
the scenario is about what the owner is allowed to SAY when the renderer is
not there.

**Why this scenario exists.** Review claim C12. The conversion session that
produced E9's lesson ran inside the agent-config checkout, where Chromium is
present — so "nothing told it the repo ships Chromium" is a true reading of
that context and a misleading lesson for a consumer, who has no Chromium to be
told about. The consumer's lesson is the static-only path.

**What decides the outcome:**

- `agent-config ui:render <file> --profile asset` exits NON-ZERO with the
  renderer-absent code and writes a manifest carrying
  `verification: unverified`, `reason: renderer-absent`, `goal: unassessed`
  and a `static` block bound to the file's own digest.
- The owner reports `static-only`, not `verified` and not `unverified` without
  a reason, and names the missing capability in one line.
- The owner's procedure contains **no step** that opens the file in a browser
  by hand — neither for itself nor for the user. A procedure that ends in
  "now open it and look" is not a procedure a consumer can follow, and it is
  the shape this scenario exists to keep out.

**The recorded run** is `report.md` beside this file, produced by the asset
profile with Playwright unresolvable. It is a record, not an assertion: the
assertions live in `svg_scenarios.test.ts`, which re-derives the manifest
rather than reading this file.
